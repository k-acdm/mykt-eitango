# 基礎計算 Phase 4 着手前 調査レポート

- **作成日**: 2026-04-25
- **対象**: [gas/Code.js](../gas/Code.js)（2527 行、関数 60+、`doGet` 41 action 分岐）
- **目的**: 仕様書 [§9.4](基礎計算_仕様書.md) で予定する Phase 4（GAS バックエンド）の新規 5 関数実装に向けて、既存コードからの流用可能箇所と新規作成が必要な部分を切り分ける

---

## 1. Code.js の全体構造

### 定数定義（行 1-37）

- **シート定数**: `SHEET_STUDENTS` / `SHEET_QUESTIONS` / `SHEET_Q5` / `SHEET_ATTEMPTS` / `SHEET_HPLOG` / `SHEET_EXCHANGES` / `SHEET_QUOTE` / `SHEET_NOTICE` / `SHEET_SANGO_TOPICS` / `SHEET_SANGO_SUBMISSIONS` / `SHEET_WABUN1_TOPICS` / `SHEET_WABUN1_SUBMISSIONS`
- **Students 列定数**: `COL_ID=0` / `COL_NAME=1` / `COL_NICKNAME=2` / `COL_CLEARED=3` / `COL_UPDATED=4` / `COL_HP=5` / `COL_STREAK=6` / `COL_LAST_TEST=7` / `COL_LAST_LOGIN=8`
- **その他**: `LEVEL_ORDER`（級配列）、`EXCHANGE_RANKS`（HP 閾値）

### ルーティング

- **`doGet(e)` ([Code.js:228](../gas/Code.js#L228))**: `params.action` で分岐、現在 41 アクション。新規追加は `else if (action === 'startKisoSession')` のように 1 行ずつ追加する既存パターンに沿う
- **`doPost(e)` ([Code.js:293](../gas/Code.js#L293))**: 大容量画像の `submitPhoto` のみ対応。base64 を body 経由で受ける。Phase 4 の `submitKisoAnswer` も画像受け渡しは doPost 経由が適切

### 共通ヘルパー（流用可能）

| ヘルパー | 行 | 用途 |
|---|---:|---|
| `_ss()` | 40 | アクティブ Spreadsheet 取得 |
| `_todayJST()` | 41 | `yyyy-MM-dd` |
| `_nowJST()` | 42 | `yyyy-MM-dd HH:mm:ss` |
| `_props()` | 53 | `PropertiesService.getScriptProperties()` |
| `_readLastNRows(sh, n)` | 60 | 末尾 N 行のみ走査（HPLog 当日チェック用） |
| `_getCachedValues(key, ttlSec, loader)` | 90 | キャッシュ統合ラッパー（後述） |
| `_invalidateCache(key)` / `_invalidateCacheAll(keys)` | 114 / 122 | キャッシュ無効化 |
| `_logHP(studentId, hpGained, type)` | 639 | HPLog への 1 行追記 |
| `_verifyAdmin(password)` | 1118 | 管理者認証 |

### エラーハンドリング（統一パターン）

すべての API 関数は以下に従う：

```javascript
try {
  // 処理
  return { ok: true, ...data };
} catch (err) {
  console.error('[funcName]', err);
  return { ok: false, message: String(err) };
}
```

---

## 2. 既存コンテンツの GAS 関数分析

### 英単語RUSH 系（10 関数、行 310-635）

中核：`saveAttempt(studentId, setNo, score, total, passed, level, sessionNo)` ([Code.js:567](../gas/Code.js#L567))

- HP 計算: `clearHP × week²`、`week = Math.ceil(streak / 7)`（[Code.js:607-608](../gas/Code.js#L607)）
- Students 一括更新: `getRange(i+1, COL_CLEARED+1, 1, 5).setValues(...)`（5 列まとめて更新、[Code.js:618-619](../gas/Code.js#L618)）
- HPLog 追記: `logSheet.appendRow([now, sid, hpGained, 'test'])`（[Code.js:626](../gas/Code.js#L626)）
- キャッシュ更新: `_updateStudentsCacheRow(i, updates)` ([Code.js:625](../gas/Code.js#L625)) + `_invalidateCache('cache_ranking_last_week')` ([Code.js:627](../gas/Code.js#L627))

### 三語短文系（10 関数、行 1334-1788）

中核：`submitSango(params)` ([Code.js:1406](../gas/Code.js#L1406))

- 提出記録: `subSheet.appendRow([now, sid, studentName, level, words, work, method])`（[Code.js:1432](../gas/Code.js#L1432)）
- **当日付与済みチェック**（重要パターン）: HPLog 末尾 200 行を `_readLastNRows` で読み、`type='sango'` で絞って 3 時基準の日付一致を判定（[Code.js:1439-1448](../gas/Code.js#L1439)）
- HP 計算: `200 × week²`（[Code.js:1456](../gas/Code.js#L1456)）
- HPLog 追記: `logSheet.appendRow([now, sid, hpGained, 'sango'])`（[Code.js:1466](../gas/Code.js#L1466)）

### 和文英訳①系（10 関数、行 1909-2525）

中核：`submitWabun1(params)` ([Code.js:2022](../gas/Code.js#L2022))

- 解答パース: `_parseWabun1Work(workText)`（[Code.js:1916](../gas/Code.js#L1916)）→ 問題番号ごとに分割
- 照合: `_normalizeWabun1()` で空白/全半角/大小区別を吸収して完全一致比較
- 全問正解判定: `results.every(r => r.correct)`（[Code.js:2041](../gas/Code.js#L2041)）
- HP 計算: `100 × week²`（完全一致時のみ、[Code.js:2083](../gas/Code.js#L2083)）
- HPLog 追記: `logSheet.appendRow([now, sid, hpGained, 'wabun1'])`（[Code.js:2093](../gas/Code.js#L2093)）

### 共通点（基礎計算で流用可能）

1. **「提出記録 → 当日付与済みチェック → HP 計算 → HPLog 追記 → キャッシュ無効化」のパイプライン**
2. **末尾 N 行読み戦略**: HPLog のフルスキャン回避、毎回 200 行で十分
3. **3 時基準の日付境界**: 子供の生活リズム配慮、深夜跨ぎ対応
4. **`{ok, ...}` 形式の戻り値**

---

## 3. HPLog シートの現状

### 列構成（4 列、`_logHP` の `appendRow` で確定、[Code.js:645,647](../gas/Code.js#L645)）

| 列 index | 列名 | 型 | 値の例 |
|---:|---|---|---|
| 0 | timestamp | string | `2026-04-25 14:35:22` |
| 1 | studentId | string | `S001` |
| 2 | hpGained | number | 50, 100, 200, 400 など |
| 3 | type | string | `login` / `test` / `sango` / `wabun1` |

### `type` 値の網羅（grep 結果）

- `'login'`（[Code.js:361](../gas/Code.js#L361)、ログインボーナス）
- `'test'`（[Code.js:626](../gas/Code.js#L626)、英単語RUSH）
- `'sango'`（[Code.js:1466](../gas/Code.js#L1466)、三語短文）
- `'wabun1'`（[Code.js:2093](../gas/Code.js#L2093)、和文英訳①）

→ **基礎計算で追加する `type`**: 仕様書 §8.4 では `kiso_{rank}_{count}` 形式（例: `kiso_14_10`）、練習モードは `_practice` サフィックス（例: `kiso_14_5_practice`）。既存の単純な type 名と異なるため、type フィルタロジックの確認が必要：

- `submitSango` 等の当日チェックは `type === 'sango'` の **完全一致**。基礎計算側で当日素点累計を出すには `type.startsWith('kiso_')` の **接頭辞マッチ** にする必要あり

### 既存レコード数

未確認（実シート参照不可）。`_readLastNRows` パターンが既に確立されているため大量レコードでも問題なし。

### `rawHP` カラム追加の影響範囲

**既存レコードへの影響**: `appendRow` は新カラムを undefined で埋めるため**書き込み側はブレーキ不要**。ただし、`_logHP(studentId, hpGained, type)` の **シグネチャ変更が全 4 箇所に波及**：

| 呼び出し元 | 行 | 現状 |
|---|---:|---|
| `loginStudent` | 361 | `_logHP(sid, 10, 'login')` |
| `saveAttempt` | 626 | `logSheet.appendRow([now, sid, hpGained, 'test'])` |
| `submitSango` | 1466 | `logSheet.appendRow([now, sid, hpGained, 'sango'])` |
| `submitWabun1` | 2093 | `logSheet.appendRow([now, sid, hpGained, 'wabun1'])` |

→ 全箇所で `rawHP` 引数を追加するか、既存 `hpGained` をそのまま `rawHP` 扱いにする「埋め戻し」で対応可能（仕様書 §8.7）。Phase 4 の最初に実施する移行作業として位置づけ。

---

## 4. Vision API の利用状況

### 実装箇所：`submitPhoto` ([Code.js:748](../gas/Code.js#L748))

- **呼び出し**: `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`
- **タイプ**: `DOCUMENT_TEXT_DETECTION` `maxResults: 1`
- **API キー**: `_props().getProperty('VISION_API_KEY')`
- **入力**: `imageBase64` 文字列（フロントで base64 化済み）
- **出力解析**: `json.responses[0].fullTextAnnotation?.text`

### 基礎計算での流用度

**完全に流用可能**。`submitKisoAnswer` でもまったく同じ呼び出し方で OCR 取得 → 仕様書 §7.2-§7.3 のロジック（問題番号分割 + `answerAllowed` 照合）を新規実装する。OCR 信頼度（`confidence`）の活用は既存コードでは未使用なので、§7.6 ケース4 の閾値判定（< 0.6 で再撮影要求）は新規ロジックとなる。

---

## 5. CacheService の利用状況

### 基盤（[Code.js:88-173](../gas/Code.js#L88)）

- TTL 統一 21600 秒（6 時間）
- 95 KB 超は自動スキップ（一括取得は分割キャッシュ前提）

### 既存キャッシュキー（13 個）

| キー | 無効化契機 |
|---|---|
| `cache_students_values` | `_updateStudentsCacheRow` で in-place、または提出系で invalidate |
| `cache_q_rows_<級>` | `clearAllCache()` で一括（手動運用） |
| `cache_q5_rows` | 同上 |
| `cache_sango_topics_values` | adminAddSangoTopic / adminAddSangoTopicsWeek / adminSetSangoTeacherWork |
| `cache_wabun1_topics_values` | adminAddWabun1TopicsWeek / adminSetWabun1AnswerWeek |
| `cache_quote_values` / `cache_notice_values` | adminAddQuote / adminAddNotice |
| `cache_ranking_last_week` | saveAttempt / submitSango / submitWabun1 |

### 基礎計算での適用判断

**KisoQuestions シートをキャッシュすべきか → YES（級別分割が望ましい）**

- 想定規模: 各級 500-1000 問 × 20 級 = 約 15,000-20,000 問。フルキャッシュは 95 KB 制限を超える可能性大
- **推奨パターン**: `_getQuestionRowsForLevel(lv)`（[Code.js:847](../gas/Code.js#L847)）と同じ「級別分割キャッシュ」を採用 → `cache_kiso_q_rows_<rank>`（20 個）
- **無効化**: 開発時は `clearAllCache()` を拡張、本番は KisoQuestions シートを稼働中に書き換えないため不要
- **`KisoSessions` はキャッシュしない**: `sessionId` 単位の頻繁な更新があるため、毎回フル走査 or 末尾 N 行読みで対応

---

## 6. Google Drive 連携の有無

### 結論：**現状 DriveApp は使用されていない**

`grep DriveApp|Drive\.|newTrigger` の結果：
- `ScriptApp.getService().getUrl()` のみ（[Code.js:283, 1040](../gas/Code.js#L283)）
- `DriveApp` / `Drive` API / `ScriptApp.newTrigger` の実例なし

### Phase 4 で新規導入が必要な機能

仕様書 §3.4 / §9.4 の要件：

1. **写真ファイルアップロード**:
   - `DriveApp.getFolderById(...)` でルートフォルダ取得
   - 年月サブフォルダの取得 or 新規作成（`createFolder`）
   - `folder.createFile(blob)` で画像を保存
   - 共有 URL 取得: `file.getUrl()` または `setShareViaLink()`
2. **`KisoPhotos` シートへ 1 行追加**: `[sessionId, studentId, rank, count, driveFileId, shareUrl, submittedAt, deleteAfter]`
3. **Time-based Trigger（日次クリーンアップ）**:
   - `cleanupKisoPhotos()` を 3:00-4:00 に毎日実行
   - GAS UI で手動セットアップ or `ScriptApp.newTrigger().timeBased().everyDays(1).atHour(3).create()`
4. **権限設定**: `appsscript.json` の `oauthScopes` に `https://www.googleapis.com/auth/drive` を追加（現在は Spreadsheet と URL Fetch のみ）

→ Drive 周りは**完全な新規実装領域**。既存コードからの参考はゼロ。Phase 4 で別ドキュメント（運用手順書）が必要になりそう。

---

## 7. Phase 4 で「流用可能」「新規作成必須」の切り分け

### ✅ 流用可能（既存パターンをそのまま or 微修正で使える）

| 項目 | 流用元 |
|---|---|
| `doGet` ルーティング追加（5 行追加するだけ） | [Code.js:228](../gas/Code.js#L228) のパターン |
| `doPost` 経由の画像受信 | `submitPhoto` ([Code.js:748](../gas/Code.js#L748)) |
| Vision API 呼び出し | `submitPhoto` の本体ロジック |
| `_logHP` ヘルパー | そのまま使える（rawHP 追加でシグネチャ拡張だけ） |
| 当日付与済みチェック | `submitSango` / `submitWabun1` のパターン |
| HP 計算式 (`rawHP × week²`) | `saveAttempt` / `submitSango` / `submitWabun1` |
| Students シート更新 + キャッシュ in-place 更新 | `saveAttempt` ([Code.js:618-625](../gas/Code.js#L618)) |
| 級別分割キャッシュ | `_getQuestionRowsForLevel` ([Code.js:847](../gas/Code.js#L847)) |
| `_verifyAdmin` 認証 | 既存 admin 系 13 関数のパターン |
| エラーハンドリング | 全関数共通 |

### ⚠️ 新規作成必須

| 項目 | 規模 | 備考 |
|---|---|---|
| **`KisoQuestions` シート作成 + データ投入** | 大 | Phase 3 で `db_writer.py` 実装、600 問 → 数千問へ拡張も |
| **`KisoSessions` シート作成 + sessionId 生成** | 中 | `kiso_{sid}_{ts}_{random}` 形式、衝突回避ロジック |
| **`KisoPhotos` シート作成** | 小 | 列定義のみ |
| **採点ロジック（OCR 結果の問題番号分割 + `answerAllowed` 照合）** | 大 | 仕様書 §7.2-§7.4 の実装、既約性・簡約性の厳格チェック含む |
| **Google Drive 連携（保存/取得/削除）** | 中 | DriveApp 全般、フォルダ階層管理 |
| **Time-based Trigger 設定** | 小 | GAS UI で 1 回設定 |
| **`HPLog.rawHP` カラム追加と既存レコード埋め戻し** | 小 | 4 箇所のシグネチャ変更 + 一回限りの埋め戻しスクリプト |
| **当日素点累計の判定ロジック（`type.startsWith('kiso_')` 接頭辞マッチ）** | 小 | 既存の完全一致パターンの拡張 |
| **練習モード判定（素点上限 100HP/日 到達後）** | 中 | 仕様書 §8.3-§8.5 |
| **再挑戦時のセッション継続ロジック** | 中 | `KisoSessions.attempts` インクリメント、不正解 ID 抽出 |

---

## 8. 仕様書 §9.4 新規 5 関数の実装難易度判定

| 関数 | 難易度 | 理由 |
|---|:---:|---|
| **`startKisoSession(studentId, rank, count)`** | **中** | 新規だが構造はシンプル。`KisoQuestions` から級別ランダム抽出（`_getQuestionRowsForLevel` 流用可）、`sessionId` 生成、`KisoSessions` 追記、フロントへ JSON 返却。**新規シート 2 個（KisoQuestions/KisoSessions）の整備が前提** |
| **`submitKisoAnswer(sessionId, imageBase64)`** | **難** | **最も複雑。複数システムの統合**：① Vision API（既存パターン流用）、② OCR 結果の問題番号分割（新規）、③ `answerAllowed` 照合 + 既約性厳格チェック（新規）、④ 80% 合格判定（仕様書 §7.4）、⑤ 全問正解判定（再挑戦時）、⑥ `KisoSessions.status` 更新、⑦ HP 計算 + 練習モード判定 + `_logHP`、⑧ 初回提出時のみ Drive 保存 + `KisoPhotos` 追記。**8 個のサブステップ** |
| **`getKisoRetryQuestions(sessionId)`** | **易** | `KisoSessions` を `sessionId` で 1 行検索 → 最後の OCR 結果から不正解問題 ID を抽出 → `KisoQuestions` から問題文取得して返却。**state は KisoSessions に記録済み前提**（`submitKisoAnswer` 側で書き込んでおく必要あり） |
| **`getKisoPhotosList(studentId)`** | **易** | `KisoPhotos` シートを studentId で絞ってフィルタするだけ。`adminListSangoSubmissions` ([Code.js:1541](../gas/Code.js#L1541)) と同パターン。`shareUrl` を含めてレコードを返す |
| **`cleanupKisoPhotos()`** | **中** | Drive 削除 + シート行削除 + Trigger 設定が必要。Drive 周りが新規領域なので慣れが必要だが、ロジック自体は単純：`KisoPhotos` を走査して `deleteAfter <= 今日` の行について `DriveApp.getFileById(driveFileId).setTrashed(true)` + 行削除。**Trigger は GAS UI で手動セットアップが想定（コードでは関数定義のみ）** |

---

## 9. 推奨される Phase 4 実装順序

依存関係と難易度を踏まえた順序：

1. **準備**: スプレッドシートに `KisoQuestions` / `KisoSessions` / `KisoPhotos` の 3 シートをヘッダー付きで作成（手動 or `ensureSheets()` ヘルパー）
2. **`HPLog.rawHP` カラム追加 + 既存 4 箇所の埋め戻し**（Phase 4 の前提作業）
3. **`startKisoSession` 実装** ← まず生徒画面で問題が表示できる状態を作る
4. **`getKisoRetryQuestions` 実装** ← セッション継続ロジック確立（実機テストはまだ不要）
5. **`submitKisoAnswer` 実装** ← 最大の山場。Vision API → 採点 → HP 付与 までの一連
6. **Drive 連携追加**: `oauthScopes` 拡張、`KisoPhotos` 書き込み、`getKisoPhotosList`
7. **`cleanupKisoPhotos` 実装** + Trigger セットアップ
8. **練習モード判定の組み込み** + テスト（仕様書 §8.3-§8.5）

---

## 10. 結論サマリ

- **流用度は高い**：エラーハンドリング、HP ロジック、Vision API、キャッシュ、Students 更新パターンはすべて既存コードに前例あり
- **新規開発の重心は 3 つ**：① 採点エンジン（OCR 後の問題番号分割と `answerAllowed` 照合の厳格性）、② Drive 連携、③ セッション継続ロジック
- **難易度の山は `submitKisoAnswer`**。8 サブステップを順番に組み立てる必要があり、Phase 4 全体の 50% 以上の工数が集中する見込み
- **rawHP カラム追加は破壊的変更**だが、影響箇所は 4 関数のみで対応容易
- **Drive 連携の `oauthScopes` 追加が必須**: 既存コードはこの権限なし。`appsscript.json` への明示的な追加とユーザー側の OAuth 同意が初回必要

---

## 関連ドキュメント

- [docs/基礎計算_仕様書.md](基礎計算_仕様書.md) §3 データ設計、§7 採点ロジック、§8 HP 加算、§9.4 Phase 4 計画
- [scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md](../scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md) 全級・全 Phase 共通の設計原則
- [gas/Code.js](../gas/Code.js) 既存実装本体（2527 行）
