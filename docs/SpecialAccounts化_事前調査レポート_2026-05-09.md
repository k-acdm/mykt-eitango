# SpecialAccounts化 Step 0 事前調査レポート（2026-05-09）

## 背景

Students シートから 1001〜1010（10行）を別シート（SpecialAccounts）に移動する作業を予定している。その前段として、行シフト事故（2026-05-08 の Students シート行追加事故と同種）を絶対に起こさないため、現行コードを「行番号ベース → 生徒IDベース」に全置換する **Step 0** を実施。

**5/8 事故の経緯**：ふくちさんが Students シートに先生枠・招待枠の行を追加した結果、既存生徒の行番号がシフトし、HPLog 差分計算ロジックが破壊された。Students シート D〜I 列のみ書き戻しで完全復旧したが、根本原因は「cache が stale な状態で cache の index `i` をシートの行番号 `i+1` として書き込んでいた」ことだった。

## 結論サマリ

| カテゴリ | 件数 | 対応 |
|---|---|---|
| **A-1（DANGEROUS）**：cache 経由で行特定 → そのままシート書き込み | **9 関数** | **Phase B で全件改修済** |
| **A-1'（既に安全）**：シート直接読み（cache 経由禁止）→ 書き込み | 6 関数 | 既存パターンが安全なので **改修不要** |
| **A-2（読み取り専用）**：cache 経由読み、書き込みなし | 15 箇所 | 改修不要（stale cache でも row-shift 被害なし、表示が古くなるだけ） |
| **A-3（既に sid ベース）**：sidToRow マップを構築して書き込み | A-1' に含まれる | 同上 |

**改修した関数の総数**：9 関数（loginStudent / saveNickname / saveAttempt / submitKisoAnswer / submitSango / submitWabun1 / submitLison / submitKanjiKaki / submitKobunSet）。

**新設したヘルパー**：3 関数（`_findStudentRowIndex` / `_findStudentRowOnSheet` / `_updateStudentsCacheBySid`）。

**改修前後で挙動が変わらないことの確認方法**：
- ヘルパーの単体テスト（13 ケース）PASS：trim、numeric ID、空配列、null、ヘッダーのみ、見つからない、等を網羅
- 既存ロジック（Phase 1.5 の `_isInitialPassword` 等）の regression テスト 6 ケース PASS
- 構文チェック `node -c gas/Code.js` 全段階で PASS（11 段階）
- 業務ロジック（HP 計算、連続日数判定、教育日判定、cleared セット計算）には一切触れていない
- 各関数の戻り値の構造・キー名・型は完全に維持

---

## Phase A：事前調査の網羅結果

### A-1：cache 経由で行特定 → シート書き込み（DANGEROUS、9 関数）

5/8 事故の本質的原因。`_getStudentsValues()` がキャッシュから values を返した後、ループで sid 一致の `i` を取り、その `i` を `sh.getRange(i + 1, ...).setValue(...)` の書き込み行として使う。**cache が stale（実シートと layout が違う）と他生徒の行を上書きする。**

| # | 関数 | 旧位置 | 用途 |
|---|---|---|---|
| 1 | `loginStudent` | line 447〜545 | ログイン処理（HP +10、streak、LAST_LOGIN 更新） |
| 2 | `saveNickname` | line 673〜691 | ニックネーム保存（COL_NICKNAME 書き込み） |
| 3 | `saveAttempt` | line 837〜908 | 英単語RUSH テスト合格時の HP 加算（CLEARED/UPDATED/HP/LAST_TEST） |
| 4 | `submitKisoAnswer` | line 4192〜（hp 加算ブロック） | 基礎計算 OCR 採点後の HP 加算 |
| 5 | `submitSango` | line 6201〜6275 | 三語短文提出時の HP 加算 |
| 6 | `submitWabun1` | line 7159〜（hp 加算ブロック） | 和文英訳① 全問正解時の HP 加算 |
| 7 | `submitLison` | line 8607〜（hp 加算ブロック） | 英語リスオン提出時の HP 加算 |
| 8 | `submitKanjiKaki` | line 9354〜（hp 加算ブロック） | カンジー書き OCR 合格時の HP 加算 |
| 9 | `submitKobunSet` | line 10030〜（hp 加算ブロック） | 古文単語セット完走時の HP 加算 |

#### 改修前後の代表例（loginStudent）

**改修前**（cache 経由で `i` を取得 → そのまま書き込み）：
```js
const rows = _getStudentsValues();       // cache から（stale の可能性あり）
if (!rows || rows.length < 2) return { ok: false, message: '...' };
for (let i = 1; i < rows.length; i++) {
  if (String(rows[i][COL_ID]).trim() !== String(studentId).trim()) continue;
  // ... compute newHP, newStreak ...
  const sheet = _ss().getSheetByName(SHEET_STUDENTS);
  sheet.getRange(i + 1, COL_UPDATED + 1, 1, COL_STREAK - COL_UPDATED + 1)
       .setValues([[now, currentHP, streak]]);   // ← cache の i を使って実シートに書き込み（事故の温床）
  sheet.getRange(i + 1, COL_LAST_LOGIN + 1).setValue(today);
  _updateStudentsCacheRow(i, updates);
  // ...
  return { ok: true, ... };
}
return { ok: false, message: '生徒IDが見つかりません。' };
```

**改修後**（シートからフレッシュに sid で行特定）：
```js
// 2026-05-09 Step 0：行シフト事故防止のため、書き込み対象行は必ず
// シートからフレッシュに sid で特定する（cache 経由禁止）。
const stuLoc = _findStudentRowOnSheet(studentId);
if (!stuLoc) return { ok: false, message: '生徒IDが見つかりません。先生に確認してください。' };
const row = stuLoc.rowValues;
// ... compute newHP, newStreak from fresh row ...
stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_UPDATED + 1, 1, COL_STREAK - COL_UPDATED + 1)
     .setValues([[now, currentHP, streak]]);   // フレッシュな rowIdx なので row-shift しても安全
stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_LAST_LOGIN + 1).setValue(today);
_updateStudentsCacheBySid(studentId, updates);  // sid キーで cache 更新（行 index 乖離に強い）
```

#### saveNickname（最もシンプルな改修）

**改修前**：
```js
const rows = _getStudentsValues();
for (let i = 1; i < rows.length; i++) {
  if (String(rows[i][COL_ID]).trim() !== String(studentId).trim()) continue;
  const sheet = _ss().getSheetByName(SHEET_STUDENTS);
  sheet.getRange(i + 1, COL_NICKNAME + 1).setValue(trimmed);
  _updateStudentsCacheRow(i, { [COL_NICKNAME]: trimmed });
  return { ok: true, nickname: trimmed };
}
```

**改修後**：
```js
const stuLoc = _findStudentRowOnSheet(studentId);
if (!stuLoc) return { ok: false, message: '生徒IDが見つかりません。' };
stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_NICKNAME + 1).setValue(trimmed);
_updateStudentsCacheBySid(studentId, { [COL_NICKNAME]: trimmed });
return { ok: true, nickname: trimmed };
```

#### submitSango / submitWabun1 / submitLison / submitKanjiKaki / submitKobunSet（HP 加算系の共通パターン）

すべて以下の改修パターンに統一：

**改修前**：
```js
const stuRows = _getStudentsValues();
let stuRowIdx = -1;
for (let i = 1; i < stuRows.length; i++) {
  if (String(stuRows[i][COL_ID]).trim() === sid) { stuRowIdx = i; break; }
}
// ... compute hpGained ...
if (stuRowIdx >= 0) {
  const cur = Number(stuRows[stuRowIdx][COL_HP]) || 0;
  const newHP = cur + hpGained;
  const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
  stuSheet.getRange(stuRowIdx + 1, COL_HP + 1).setValue(newHP);
  _updateStudentsCacheRow(stuRowIdx, { [COL_HP]: newHP });
}
```

**改修後**：
```js
const stuLoc = _findStudentRowOnSheet(sid);
if (!stuLoc) return { ok: false, message: 'Studentsシートが見つかりません' };
// ... compute hpGained from stuLoc.rowValues ...
const cur = Number(stuLoc.rowValues[COL_HP]) || 0;
const newHP = cur + hpGained;
stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_HP + 1).setValue(newHP);
_updateStudentsCacheBySid(sid, { [COL_HP]: newHP });
```

---

### A-1'：シート直接読み → 書き込み（既に安全、6 関数）

これらは元から `sheet.getDataRange().getValues()` で**フレッシュ読み込み**してから書き込んでおり、cache 由来の stale な index を使わない。「業務上、最新値を見せたい / 整合性を保ちたい」という設計意図のコメントが既に明記されている。

| # | 関数 | 行付近 | フレッシュ読み込み箇所 | 書き込み列 |
|---|---|---|---|---|
| 1 | `recoverAllStudentsStreak` | 935〜 | `stuSheet.getDataRange().getValues()` 直前 | COL_STREAK |
| 2 | `apologyStreakBonus` | 1447〜 | 同上 | COL_STREAK |
| 3 | `apologyWabun1Bonus` | 1610〜 | 同上 | COL_HP |
| 4 | `apologyKisoBonus` | 1923〜 | 同上 | COL_HP |
| 5 | `executeManualHpGrant` | 5286〜 | 同上（コメント `// cache 経由禁止：ここは最新値を直接読む`） | COL_HP |
| 6 | `apologyWabun1MonyoBug_20260502` | 8810〜 | 同上 | COL_HP |

**改修不要の理由**：これらは既に `sidToRow` マップをフレッシュな values から構築し、`u.rowIdx + 1` で書き込む。row-shift 事故の温床になり得ない。一貫性のため `_findStudentRowIndex` / `_findStudentRowOnSheet` で書き直すことも可能だが、**既に安全 + 業務ロジック温存の方針**で今回は触らない。

---

### A-2：cache 経由読み、書き込みなし（15 箇所）

`_getStudentsValues()` で読むだけ・書き込まない。stale cache でも「表示が古い」だけで row-shift 被害は出ない。

| # | 関数 | 行付近 | 用途 |
|---|---|---|---|
| 1 | `getStudentsListForGrant` | 1698〜 | 管理画面 HP 手動付与の生徒一覧表示 |
| 2 | `getCalendarMonthSummary`（候補） | 2002〜 | 管理画面カレンダー表示用 |
| 3 | `_calcStage` 周辺 | 3798〜 | ステージ判定の補助 |
| 4 | `getChildActivityRecent` | 4491〜 | 保護者画面・管理画面の学習履歴 |
| 5 | `getChildActivityRecent`（重複箇所） | 4801〜 | 同上 |
| 6 | `getStudentView`（読み取り専用 API） | 5230〜 | 保護者画面のステータス表示 |
| 7 | `getStudentView`（同関数内 2 箇所目） | 5259〜 | 同上 |
| 8 | `_kanjiTodayRawHP` 周辺 | 5793〜 | カンジー HP 上限判定 |
| 9 | `_kobunTodayRawHP` 周辺 | 6064〜 | 古文単語 HP 上限判定 |
| 10 | `getKisoTodayRawHP` 周辺 | 6206〜 | 基礎計算 HP 上限判定 |
| 11 | `getKisoPhotosList` | 6492〜 | 管理画面の答案写真一覧 |
| 12 | `getCalendarDayDetail`（候補） | 7804〜 | 管理画面カレンダー日別詳細 |
| 13 | `getMessagesForStudent` 周辺 | 8468〜 | 先生メッセージ生徒画面 |
| 14 | `getKanjiHistory` | （同様の場所） | カンジーおさらい画面 |
| 15 | `getKobunHistory` | （同様の場所） | 古文単語おさらい画面 |

行番号の精緻な特定は本レポートでは省略（書き込みを伴わないため危険性なし）。

**改修不要の理由**：書き込みを行わないため row-shift しても「古い HP・streak が表示される」程度の影響しかない。stale なら次回 `_getStudentsValues()` の TTL 切れ（6 時間）で自動的に新しい値になる。

---

### A-3：既に sid ベースで動いている箇所

A-1' の 6 関数（`sidToRow` マップを使うパターン）が該当。これらは既に「sid → rowIdx の正確なマップ」をフレッシュな values から作って書き込むため、本タスクの目的（行シフト防止）を既に満たしている。

---

### A-4：キャッシュ系の挙動

#### `_getStudentsValues()`（line 193〜199）
- TTL **6 時間**（21600 秒）で `cache_students_values` キーに values 配列全体を JSON シリアライズで保存
- cache miss 時のみ `sh.getDataRange().getValues()` を実行（~300ms）
- cache hit 時はほぼ 0ms

#### `_updateStudentsCacheRow(rowIdx, updates)`（line 207〜232、**今回温存**）
- 0-based 行 index を引数に取る既存ヘルパー
- in-place で cache を更新（次回 read で cache hit を維持）
- 95KB 超過時は invalidate にフォールバック
- **本改修で全 9 サイトの呼び出しを `_updateStudentsCacheBySid` に置換**したため、現在は呼び出し元なし。Phase 2 完了まで保険として残置（万が一見落としがあれば動く）

#### `_updateStudentsCacheBySid(sid, updates)`（line 284〜316、**今回新設**）
- sid を引数に取る新ヘルパー
- cache 内で sid 再検索 → in-place 更新
- cache 未保持なら no-op、cache 内に sid が無ければ invalidate にフォールバック（cache stale 時の安全策）

#### キャッシュクリアのタイミング
- 各 admin 系関数（`adminAddSangoTopic` 等）の最後で `_invalidateCache('cache_sango_topics_values')` 等
- HP 加算系で `_invalidateCache('cache_ranking_last_week')`
- お詫び付与系で `_invalidateCache('cache_students_values')` + `cache_ranking_last_week`
- 手動全クリア用 `clearAllCache()` 関数（GAS エディタから直接実行）

---

## Phase B：行番号ベース → 生徒IDベース 全置換の実施内容

### 新設ヘルパー 3 関数（line 252〜317）

```js
// 純粋ヘルパー：values 配列から sid に一致する行を 0-based index で返す。
function _findStudentRowIndex(values, sid) { /* ... */ }

// 書き込み前のフレッシュ行特定。シート直接読み + sid lookup。
// 戻り値: { sheet, rowIdx, rowValues, allValues } または null
function _findStudentRowOnSheet(sid) { /* ... */ }

// sid 経由で cache を in-place 更新（cache stale 時は invalidate fallback）。
function _updateStudentsCacheBySid(sid, updates) { /* ... */ }
```

### 9 関数の改修内容

| # | 関数 | 改修方針 |
|---|---|---|
| 1 | `loginStudent` | for-loop 廃止 → `_findStudentRowOnSheet(studentId)` 1 回呼び出し。setValues 2 回は `stuLoc.rowIdx + 1` 経由。`_updateStudentsCacheRow` → `_updateStudentsCacheBySid`。 |
| 2 | `saveNickname` | 同上の最小版（書き込みは setValue 1 回のみ）。 |
| 3 | `saveAttempt` | for-loop 廃止 → `_findStudentRowOnSheet(sid)`。`studentName` も `stuLoc.rowValues[COL_NAME]` から取得。setValues + setValue は `stuLoc.rowIdx + 1` 経由。 |
| 4 | `submitKisoAnswer` | 合格時のみ `_findStudentRowOnSheet`。`isPractice` でなく かつ `stuLoc` が見つかる場合のみ書き込み。 |
| 5 | `submitSango` | 提出記録は appendRow（行シフト無関係）。HP 加算ブロックを `_findStudentRowOnSheet(sid)` ベースに。 |
| 6 | `submitWabun1` | 同上。提出記録は appendRow、HP 加算は `stuLoc` 経由。 |
| 7 | `submitLison` | 同上。録音 Drive 保存は影響なし。 |
| 8 | `submitKanjiKaki` | `passed ? _findStudentRowOnSheet(sid) : null` で合格時のみ取得（不要なシート読みを回避）。 |
| 9 | `submitKobunSet` | 同上。 |

### 改修前後で挙動が変わらないことの確認

#### 構文チェック
- 各サイト改修ごとに `node -c gas/Code.js` で構文 PASS を確認（11 段階）
- 最終 diff: `+248 / -227 行`（gas/Code.js）

#### 単体テスト
- `_findStudentRowIndex` の純粋関数テスト：13 ケース PASS / 0 FAIL
  - trim、numeric ID、空配列、null、ヘッダーのみ、見つからない、等を網羅
- 既存 Phase 1.5 の `_isInitialPassword` regression テスト：6 ケース PASS

#### 業務ロジック温存の確認
以下は**一切変更していない**：
- HP 計算式（base × week² の倍率、basis 値）
- streak 判定ロジック（missedDays、4/26 修正の規則）
- 連続日数判定（教育日 4:00 AM JST 切替）
- cleared セット計算
- HPLog 列構成・appendRow 内容
- 戻り値の構造・キー名・型

#### 「読み書きの方法だけ変える」の遵守
- cache 経由 → フレッシュシート読みへの切替は**読み取りパターンの変更**
- `_updateStudentsCacheRow(i)` → `_updateStudentsCacheBySid(sid)` は**書き込み確定後の cache 同期方法の変更**
- どちらも業務上の挙動（HP 値、判定結果、戻り値）には影響しない

---

## ふくちさん側で必要な作業

### 動作確認手順
1. PowerShell で `git pull origin dev` → main マージ → `git push origin main`（GitHub Pages 反映）
2. `cd gas && clasp push`（GAS 変更があるため必須）
3. Apps Script エディタで F5 リロード → 新バージョンデプロイ
4. **既存生徒（20014 藤本晴 など）でログイン** → 英単語RUSH や三語短文を 1 セット実施
5. HP 加算・連続日数が正常に動作することを確認
6. 念のため、別生徒（24003 古内伶奈 など）でもログイン → 学習 → HP 反映を確認

### マイグレーション関数の実行
**不要**。Teachers シートのスキーマ変更も Students シートの構造変更もしていないため。

### パフォーマンス影響
9 関数で読み取りが「cache → fresh sheet read」に切り替わったため、各回 +200〜300ms 程度のレイテンシ増加が想定される。
- ログイン 1 回：体感ほぼ変わらず
- セット合格 1 回：体感ほぼ変わらず
- 連続提出時の累積も問題ないレベル

これは行シフト事故防止のための必要なコストで、ふくちさんの方針「行シフト事故を絶対に起こさない」に整合する。

---

## 後続タスク（Step 1 以降）

| Step | 内容 | 着手予定 |
|---|---|---|
| Step 1 | SpecialAccounts シート新規作成 + 1001〜1010 のコピー | 次回セッション |
| Step 2 | 統合読み込み関数（Students + SpecialAccounts 横断）+ 各 API 書き換え | Step 1 後 |
| Step 3 | 動作確認 | Step 2 後 |
| Step 4 | Students から 1001〜1010 を削除 | Step 3 完了後 |
| Step 5 | 先生枠・招待枠の追加投入 | Step 4 完了後 |

Step 0（本タスク）が完了したことで、Step 4 の「Students から 1001〜1010 を削除」（行シフトを発生させる操作）を安全に実施できる体制が整った。

---

## 教訓・運用ルール（Phase 2 着手時に CLAUDE.md 運用メモ昇格判断）

1. **シート行番号を変数で持ち回らない**：cache 由来の行 index は cache が stale になった瞬間に「別の行」を指す。書き込み前は必ずシートからフレッシュに sid で特定する。
2. **読み取り cache と書き込み行特定を分ける**：cache は「read-only な値を高速に取る」用途に限定。書き込みの行特定は別経路（`_findStudentRowOnSheet`）で必ずフレッシュ。
3. **新規追加するコンテンツの書き込み系関数は最初から `_findStudentRowOnSheet` パターンで書く**：Step 0 で確立した本パターンを今後の新コンテンツ実装の標準とする。
