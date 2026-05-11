# バグ④-本質 ログイン / HP データ欠損 調査レポート

調査日：2026-05-12
調査者：Claude Code（Phase A 読み取り専用調査）
対象スレ：v13 緊急バグ④-本質 調査セッション
スコープ：コード変更禁止。本レポート（docs/bug4_root_cause_investigation_report.md）のみ作成。

---

## 0. エグゼクティブサマリ

v13 で「バグ④ 学習履歴のログイン判定矛盾」を **表示側の推論補完** で対症療法（コミット `d279dec`）。一方で、その後の追加調査で **HPLog レコード自体が欠落するケースが特定生徒に発生中** であることが分かった。本セッションはこの「データ欠損」の構造的真因を特定するための調査。

**真因の本命仮説（最も強い証拠あり）**：

**[`_logHP`](gas/Code.js:1545) の try-catch 設計が「サイレント失敗」になっており、呼び出し元には失敗が伝わらない**。一方で、`_logHP` 呼び出しは **常に Students.HP 加算と lastLogin/列更新の後** にあり、**前段の書き込みが成功した後で _logHP だけが失敗するパターン** が構造的に存在する。これがパターン A・B 両方の主犯と見られる。

加えて、`recoverAllStudentsStreak` のコメント（[gas/Code.js:1618](gas/Code.js:1618)）に **「loginStudent が稀に HPLog 'login' を書き損ねるケースが疑われる（24009 岩倉、23030 髙山）」と既に明記** されている。**過去に複数の生徒で発生済の既知現象**だが、根本対策は未実装で「fallback 検出ロジック」で表示側を救済するに留まっている。

**推奨：案 A（_logHP 強化：失敗時の callbackで HPLog 欠落フラグ → 即時 1 回リトライ + flush + 失敗時 Students.HP rollback）を最優先で採用、案 D（フロント側「ログインボーナス未付与時の自動補正トリガ」）を中期で検討。**

---

## 1. 調査対象範囲

| 領域 | ファイル / 関数 | 行範囲（概算） |
|---|---|---|
| ログイン（フロント） | [index.html `doLogin` / `doRoleLogin`](index.html:2913) | 2913–2995 |
| ログイン（GAS） | [gas/Code.js `loginStudent`](gas/Code.js:1163) | 1163–1259 |
| HP ログ書き込みヘルパー | [gas/Code.js `_logHP`](gas/Code.js:1545) | 1545–1557 |
| 英単語RUSH HP 付与 | [gas/Code.js `saveAttempt`](gas/Code.js:1470) | 1470–1534 |
| 三語短文 HP 付与 | [gas/Code.js `submitSango`](gas/Code.js:8013) | 8013–8074 |
| 和文英訳① HP 付与 | [gas/Code.js `submitWabun1`](gas/Code.js:9080) | 9080–9111 |
| 基礎計算 HP 付与 | [gas/Code.js `submitKisoAnswer`](gas/Code.js:5436) | 5436–5474 |
| 英語リスオン HP 付与 | [gas/Code.js `submitLison`](gas/Code.js:10812) | 10812–10850 |
| カンジー HP 付与 | [gas/Code.js `submitKanjiKaki` / `submitKanjiYomi`](gas/Code.js:11530) | 11530–11556 |
| Students 行アクセス | [gas/Code.js `_findAccountRowOnSheet`](gas/Code.js:821) | 821–846 |
| 連続日数復旧コメント（既知現象記録） | [gas/Code.js `recoverAllStudentsStreak`](gas/Code.js:1618) | 1611–1700 |

---

## 2. ログイン処理の全フロー

### 2.1 フロント側（index.html）

```
[生徒]
  ログイン画面で生徒IDを入力 → 「ログイン」ボタン押下
        │
        ▼
[doRoleLogin]  index.html:2975
  - _loginRole が 'parent' なら view.html?sid= に遷移（こちらは loginStudent を呼ばない）
  - 生徒モードなら doLogin() を呼ぶ
        │
        ▼
[doLogin]  index.html:2913
  - showMsg('確認中…', 'ok')
  - login-btn.disabled = true
  - gasGet({ action:'loginStudent', studentId:sid })
        ↓ fetch(GAS_URL + '?params=' + encodeURIComponent(JSON.stringify(...)))
        │
        ▼
[gasGet]  index.html:2410
  return fetch(GAS_URL + '?params=' + encodeURIComponent(...))
    .then(function(r){ return r.json(); });
```

**重要な設計上の欠陥**：

- `gasGet` には **タイムアウト機構がない**。GAS が遅延 / hang した場合、fetch は永遠に待ち続ける（または ブラウザのデフォルト timeout に依存）。
- `gasGet` には **自動リトライ機構がない**。
- `.catch` は `showMsg('エラーが発生しました', 'ng')` を表示するだけ。何が起きたか・サーバ側がどこまで処理したかはユーザにもクライアントにも不明。
- ユーザは「エラー」表示を見て、もう一度ボタンを押すかもしれない。1 回目が「Students.HP 更新は成功 + lastLogin も書き換え済 + _logHP は失敗」だった場合、2 回目は `lastLogin !== today` が false になり HP は再付与されず、HPLog の login レコードは欠落したまま **永久に固定** される。

### 2.2 GAS 側

```
[doGet]  gas/Code.js:1xxx
  action = 'loginStudent' → loginStudent(studentId) を呼ぶ
        │
        ▼
[loginStudent]  gas/Code.js:1163
  ① _findAccountRowOnSheet(studentId)
     - Students シートをフレッシュに走査（cache 経由禁止、Step 0 設計）
     - 見つからなければ SpecialAccounts シートも走査
     - 両方とも見つからなければ null → 「生徒IDが見つかりません」で早期 return
     - ⚠️ Sheet API の一時的失敗（quota / read timeout）でも null 同等になる構造
  ② row = stuLoc.rowValues
     - today = _todayEducationalJST()
     - lastLogin = _toDateStr(row[COL_LAST_LOGIN])
     - missedDays を計算
     - if (lastLogin !== today) ─ ★ 今日まだログインしていない場合のみ HP 付与
  ③ HP 付与処理（lastLogin が今日でない場合のみ実行）
     a. loginBonus = 10、currentHP += 10
     b. streak 計算（missedDays に応じて +1 / 1 にリセット）
     c. setValues(E-G: UPDATED, HP, STREAK) … 1 回目の書き込み ★
     d. setValue(I: LAST_LOGIN = today) ……… 2 回目の書き込み ★
     e. _updateAccountCacheBySid（in-memory cache 更新）
     f. _logHP(studentId, 10, 10, 'login') ………… 3 回目の書き込み（appendRow）★
  ④ ステージ / 称号 / 節目を計算
     - _getYesterdayJST() … 教育日基準の昨日
     - _getPrevDayCount(studentId, yesterday)
       → HPLog 末尾 500 行を再走査して活動 type を集計
       → ★ ここで HPLog を読む。直前の appendRow が反映されているかは Apps Script の Sheets 内部 バッファリングに依存
     - _calcStage / _getTitle / _isMilestone
        │
        ▼
  return { ok:true, studentId, nickname, totalHP, loginBonus, streak, stage, title, milestone }
```

### 2.3 HPLog 書き込みポイント（loginStudent 経路）

**HPLog 書き込みは [_logHP](gas/Code.js:1545) で発生する 1 箇所のみ**。

```javascript
function _logHP(studentId, rawHP, hpGained, type) {
  try {
    const ss = _ss();
    let sh   = ss.getSheetByName(SHEET_HPLOG);
    if (!sh) {
      sh = ss.insertSheet(SHEET_HPLOG);
      sh.getRange(1, 1, 1, 5).setValues([['timestamp', 'studentId', 'rawHP', 'hpGained', 'type']]);
    }
    sh.appendRow([_nowJST(), String(studentId).trim(), rawHP, hpGained, type]);
  } catch(e) {
    console.error('[_logHP]', e);
  }
}
```

**問題点**：

1. **try-catch でエラーを完全に呑み込む**。呼び出し元には失敗が一切伝わらない（戻り値なし、例外も投げない）。
2. **`SpreadsheetApp.flush()` がない**。Apps Script の Sheets 内部バッファに乗ったまま、同 execution が終了する前後で書き込みが確定するタイミングが不確定。
3. **リトライ機構がない**。Sheet API が一時的に quota 超過 / 内部エラーで失敗した場合、1 回試して失敗したら諦める。
4. **失敗を検知する手段が console.error のみ**。Apps Script Executions ログを手動で見ない限り、誰も気付かない。

### 2.4 エラー処理

| 失敗ポイント | 失敗時の挙動 | 影響 |
|---|---|---|
| `_findAccountRowOnSheet` が一時的失敗で null | 「生徒IDが見つかりません」表示 → 早期 return | HP 付与・HPLog 書き込み共にスキップ。生徒が再度ボタンを押せば救済される |
| Students.HP の `setValues` (c) が失敗 | catch ブロックで `[loginStudent]` console.error → `{ ok:false, message:'内部エラー' }` 返却 | フロントに「エラー」表示。生徒の再ログインで救済される |
| Students.LAST_LOGIN の `setValue` (d) が失敗 | 同上（外側 try-catch で吸収） | 同上 |
| `_logHP` 内の `appendRow` が失敗 | **`_logHP` 内 try-catch で吸収** → loginStudent 関数からは「成功した」扱いで先へ進む | **Students.HP は +10 済、lastLogin は今日に更新済、HPLog レコードは欠落 → 生徒が再ログインしても永久に救済されない（パターン A）** |
| `_getPrevDayCount` が失敗 | 0 が返って stage 計算に影響、HP 付与には無関係 | UI 表示の stage 値だけがズレる |

**重要観察 — 順序の問題**：

[gas/Code.js:1208-1218](gas/Code.js:1208) の HP 付与シーケンスは **「Students 更新 → cache 更新 → HPLog 書き込み」の順** で並んでいる。これは「同一 transaction で見れば順序は不問」だが、Apps Script はトランザクションを提供しない。**個別の API 呼び出しはバラバラに成功/失敗し得る**。

- ✅ Students setValues 成功
- ✅ Students setValue (LAST_LOGIN) 成功
- ✅ `_updateAccountCacheBySid` 成功
- ❌ `_logHP` の appendRow 失敗 ← ここだけが失敗するパターン

この時、HPLog の欠落は **次回ログイン以降の救済機会がない**。なぜなら：

- 次回（同日内）の loginStudent 呼び出しでは `lastLogin === today` で if 文をスキップ → +10HP も付与されず、_logHP も呼ばれない。
- 次回（翌日以降）の loginStudent 呼び出しでは、その日のログインボーナスが付与されるが、**前日の欠落分は補完されない**。

---

## 3. 学習活動 HP 付与フロー（コンテンツ別）

### 3.1 英単語RUSH ([gas/Code.js `saveAttempt`](gas/Code.js:1470))

```
① Attempts シートに appendRow（テスト結果）  - 不合格でも記録
② 合格判定 → 不合格なら早期 return（HPLog 書き込みなし）
③ pass1/pass2 / cleared を PropertiesService 更新
④ Students.HP setValues（CLEARED, UPDATED, HP の 3 列）
⑤ Students.LAST_TEST setValue
⑥ _updateAccountCacheBySid
⑦ _logHP(sid, hpGained, hpGained, 'test')   ← パターン B 主犯候補
⑧ _invalidateCache('cache_ranking_last_week')
```

**flush なし、LockService なし、try-catch は関数全体に 1 つ**。`_logHP` 失敗時は呼び出し元には伝わらず、Students.HP は加算済 + HPLog は欠落のまま固定。

### 3.2 三語短文 ([gas/Code.js `submitSango`](gas/Code.js:8013))

```
① SangoSubmissions に appendRow（提出記録）
② HPLog 末尾 200 行で alreadyGranted 判定
③ alreadyGranted=false の場合のみ：
   a. Students.HP setValue
   b. _updateAccountCacheBySid
   c. _logHP(sid, hpGained, hpGained, 'sango')   ← パターン B 主犯候補
   d. _invalidateCache
```

**alreadyGranted 判定が `_logHP` の前段で行われる構造的欠陥**：
- 1 回目で a 成功・b 成功・c 失敗 → Students.HP +200 済、HPLog 欠落、SangoSubmissions には appendRow 済
- 2 回目（同日中）に提出 → `_readLastNRows(logSheet, 200)` で type='sango' を検索 → 1 回目で _logHP が失敗していたため見つからない → alreadyGranted=false → **二重付与される**
- 結果として Students.HP +400、SangoSubmissions に 2 行、HPLog に 1 行（or 0 行）

### 3.3 和文英訳① ([gas/Code.js `submitWabun1`](gas/Code.js:9080))

3.2 と同じ構造。alreadyGranted 判定が HPLog 走査ベースで、`_logHP` 失敗 → 二重付与の可能性。

### 3.4 基礎計算 ([gas/Code.js `submitKisoAnswer`](gas/Code.js:5436))

```
① KisoSessions / 採点処理
② 合格判定（80% 以上）
③ HP 計算（rawHP × week²）
④ Students.HP setValue（合格 + isPractice=false の場合のみ）
⑤ _updateAccountCacheBySid
⑥ _logHP(studentId, effectiveRawHP, hpGained, logType)   ← パターン B 主犯候補
⑦ _invalidateCache
⑧ KisoSessions の status / attempts / wrongIds / completedAt / hpEarned を setValue
⑨ KisoPhotos 保存（_saveKisoPhoto は SpreadsheetApp.flush() 込み）
```

**KisoSessions の hpEarned 列に書き込み済 vs HPLog 欠落** で表示矛盾が発生する。基礎計算は「セッション 1 回 = 1 写真 = HPLog 1 件」が期待される構造のため、欠落が目立つ。

### 3.5 英語リスオン ([gas/Code.js `submitLison`](gas/Code.js:10812))

```
① alreadyGranted 判定（LisonSubmissions の末尾 200 行で本日チェック）
② _saveLisonRecording（Drive 保存）
③ Students.HP 加算（!alreadyGranted の場合のみ）
④ LisonSubmissions に appendRow（alreadyGranted でも記録）
⑤ if (hpGained > 0) _logHP(sid, hpGained, hpGained, 'lison')   ← パターン B 主犯候補
```

**LisonSubmissions と HPLog の二重源**で、片方が欠落しても他方で alreadyGranted 判定が正しく動く設計になっているのは救い（次回提出時に LisonSubmissions ベースでブロックされる）。**ただし HPLog 欠落自体は同じく発生し得る**。

### 3.6 カンジー ([gas/Code.js `submitKanjiKaki`](gas/Code.js:11530))

```
① KanjiSubmissions appendRow（5/12 で新設、flush あり）
② 合格判定
③ HP 計算（rawHP × week²、_kanjiTodayRawHP で本日合計を走査）
④ Students.HP setValue
⑤ _updateAccountCacheBySid
⑥ _logHP(sid, grantedRawHP, hpGained, 'kanji_<level>_<count>')   ← パターン B 主犯候補
⑦ _invalidateCache
```

**`_kanjiTodayRawHP` は HPLog を走査して本日の上限判定する**。`_logHP` が失敗していると本日の累計が過小評価され、本来 cap に達しているはずなのに練習モードに切り替わらず重複付与が起き得る。

### 3.7 共通パターンの一覧

| 順序 | 操作 | 副作用先 | 失敗時の挙動 |
|---|---|---|---|
| 1 | Submissions / Sessions に `appendRow` | 提出シート | 通常 try-catch 外、例外で関数全体が ok:false |
| 2 | alreadyGranted 判定 | HPLog 走査 | `_logHP` 失敗時、本来ガードすべきところで素通り |
| 3 | Students.HP `setValue` / `setValues` | Students | 関数全体 try-catch で吸収 |
| 4 | `_updateAccountCacheBySid` | CacheService | 影響軽微 |
| 5 | `_logHP` で `appendRow` | HPLog | **内側 try-catch で吸収、呼び出し元には何も伝わらない** |
| 6 | `_invalidateCache` | CacheService | 影響軽微 |

**全コンテンツで `_logHP` が最後（または最後近く）に呼ばれており、Students.HP 加算が先に行われる**。これは **設計の選択** だが、結果として「Students.HP 加算済 + HPLog 欠落」の状態が **構造的に許容される設計** になっている。

---

## 4. 失敗ポイントの仮説（複数）

### H1：`_logHP` 内 `appendRow` の Sheet API 一時的失敗（本命・最有力）

**事象**：HPLog の login / 学習活動レコードが欠落するが、Students.HP は加算済 / Submissions は記録あり。

**仮説**：Google Sheets API は無停電サービスではない。以下のいずれかで `appendRow` が一時的失敗し得る：

1. **Apps Script Quota 一時超過**：Spreadsheet 書き込み回数 / 秒 の制限。特にピーク時間帯（夕方〜夜の生徒同時利用）。
2. **Sheet API timeout**：Apps Script の `UrlFetchApp` ではなく内部 Sheets API のタイムアウト。
3. **HPLog シートのロック競合**：同じ HPLog に複数 execution が同時に append しようとした場合、片方が失敗。**LockService が一切使われていない**ことから（[grep 結果](gas/Code.js)：`LockService` ヒット 0 件）、競合は防御されていない。
4. **Quota Exhausted (HARD)**：日次の Apps Script execution 数 / 時間。これは普通は起きないが、ピーク時に発生し得る。

**根拠**：
- `_logHP` の **try-catch が console.error のみ** で失敗を呑む構造（[gas/Code.js:1554-1556](gas/Code.js:1554)）。
- **`SpreadsheetApp.flush()` も呼んでいない**（[grep 結果](gas/Code.js)：flush は 3 箇所のみ、_logHP 内にはなし）。
- 既知症例：[gas/Code.js:1618](gas/Code.js:1618) のコメントに「loginStudent が稀に HPLog 'login' を書き損ねるケースが疑われる（24009 岩倉、23030 髙山）」と明記。**過去に確認された事象**。

### H2：`gasGet` のタイムアウト未実装によるユーザ二重押下

**事象**：生徒がログインボタンを押すが応答がない / 遅い → もう一度押す → 1 回目で Students.HP は +10 + HPLog 失敗、2 回目で `lastLogin === today` のため何も起きず終わる。

**仮説**：`gasGet` には timeout / retry がない（[index.html:2410-2413](index.html:2410)）。GAS が遅延した場合、ユーザは「エラーが発生しました」表示を待たずに連打する可能性が高い（特に iPad の生徒）。

**根拠**：
- フロント実装が `fetch().then().json()` のみ（[index.html:2411](index.html:2411)）。
- `.catch` は単に「エラー」表示するだけで、自動リトライ機構なし。
- ユーザの体感速度を考えると、GAS 応答が 3 秒以上だと連打が起きる現実性が高い。

### H3：LockService 未使用による並行 execution 競合（副次）

**事象**：同じ生徒の同時送信（複数タブ / リトライ / iPad のマルチタッチ）で HPLog 競合。

**仮説**：Apps Script Web App は **同一ユーザの並行リクエストを直列化しない**（同じデプロイ URL で、`doGet` / `doPost` が同時に走り得る）。HPLog への appendRow が並行すると、Sheets API の内部 lock 競合で一方が失敗し得る。

**根拠**：
- [grep 結果](gas/Code.js)：`LockService` のヒット 0 件。**マイ活アプリは LockService を一切使っていない**。
- appendRow は通常 Sheets API 側で直列化されるはずだが、Apps Script の execution が並行 fire した時の挙動は厳密に保証されていない。

### H4：`_findAccountRowOnSheet` の一時的失敗で早期 return

**事象**：「生徒IDが見つかりません」表示が出る。

**仮説**：`_findAccountRowOnSheet` は `getDataRange().getValues()` を呼ぶ。Sheet API が一時的失敗 / quota / timeout で例外を投げると、上位の try-catch で吸収されるか null が返る。null → loginStudent 早期 return で HP 付与スキップ。

**ただしこのケースは「HPLog 欠落」を生まない**。Students.HP も更新されていないので一貫性は保たれる。生徒が再ログインすれば救済される。**パターン A・B の説明にはならない**。

### H5：教育日切替境界（4:00 AM JST）周辺のエッジケース

**事象**：3:30〜4:30 頃のログインで「昨日 / 今日」判定がズレる。

**仮説**：[gas/Code.js:85](gas/Code.js:85) の `_todayEducationalJST` は 4:00 AM 切替。`lastLogin` は `_toDateStr(row[COL_LAST_LOGIN])` で文字列変換される。`COL_LAST_LOGIN` には `today` が書き込まれる（教育日基準）。境界時刻周辺で `if (lastLogin !== today)` が想定外の結果を返すと、HP 付与が二重になったり全く付かなかったりする。

**根拠**：
- これは過去に CLAUDE.md #99 で報告された「4:00 AM 教育日システム導入」関連の修正履歴あり。現在のコードは整合しているように見える。
- ただし `_toDateStr` の挙動が `LAST_LOGIN` セルの型（Date / string / 数値）で揺れる過去がある（CLAUDE.md #97 のバグ）。今は修正済みのはずだが、稀な型差で再発しないとは断言できない。

**評価**：本命ではないが、3:00–5:00 JST 時間帯の症例があれば疑うべき仮説。

### H6：cache 経由の stale な lastLogin 読み取り（副次）

**事象**：loginStudent が直前のログインを認識できず、二重付与または欠落。

**仮説**：`_findAccountRowOnSheet` は **フレッシュにシートを読む** 設計（[gas/Code.js:1166-1167](gas/Code.js:1166)）。これは Step 0 で意図的に cache 経由禁止になっている。**この経路では cache 起因の欠落は起きない**。

**評価**：仕様上ガード済。**真因ではない**。

---

## 5. パターン A / B それぞれの想定原因

### 5.1 パターン A：ログインボーナス HPLog 欠落（学習活動はあり）

| 要因 | 説明 | 影響 |
|---|---|---|
| **★ H1 _logHP 内 appendRow 失敗** | Students.HP +10 と LAST_LOGIN 更新は成功、_logHP の appendRow だけが失敗 | **永久に欠落のまま固定**。次回ログインで救済不可（`lastLogin === today` で if スキップ） |
| H3 LockService 競合 | 連打 / 並行 execution での競合 | 同上、appendRow 1 件が失敗、Students は更新済 |
| H5 教育日境界 | 3:00–5:00 JST のエッジケース | 稀。lastLogin 更新と _logHP は同 execution 内のため、ズレるのは別の問題 |

**結論**：パターン A の主犯は **H1（_logHP appendRow 失敗）**。`_logHP` の構造的脆弱性により、Students 側だけ進んで HPLog だけ取り残される。次回以降の救済機会が存在しない。

### 5.2 パターン B：学習活動 HP 記録欠落（ログインはあり）

| 要因 | 説明 | 影響 |
|---|---|---|
| **★ H1 _logHP 内 appendRow 失敗** | Students.HP +N と Submissions の appendRow は成功、_logHP の appendRow だけが失敗 | **HPLog 欠落 + alreadyGranted 判定の素通り → 二重付与のリスク** |
| H3 LockService 競合 | 同じ生徒の同時送信（複数タブ / リトライ） | 並行 _logHP で 1 件が失敗。Submissions は appendRow 成功 |

**結論**：パターン B も主犯は **H1**。ただしパターン A と異なり、副次効果として **二重付与のリスク** がある（次回提出時の alreadyGranted 判定が HPLog ベースで素通りするため、Students.HP に +200 / +100 が再度加算され得る）。

### 5.3 パターン C：両方欠落（実際にログインしていない正常ケース）

- このパターンは **データ欠損ではない正常ケース**。fallback 検出ロジック側（recoverAllStudentsStreak v2）でも `HPLog 'login' 無し + Attempts 無し + 他活動 type 無し` の生徒は「未ログイン」として扱われ、救済対象外になる。

---

## 6. 改善方針案（優先順）

### 案 A：`_logHP` の堅牢化（★ 最優先推奨、即実装可）

**概要**：`_logHP` を以下のように強化する。

1. **戻り値で成否を返す**：`{ ok:true }` または `{ ok:false, error }`。
2. **失敗時の即時 1 回リトライ**：500ms 待機 + `appendRow` 再試行（既存 `_kanjiOcrWithGemini` のリトライパターンと同等）。
3. **`SpreadsheetApp.flush()` を appendRow 直後で実行**：v12 教訓（CLAUDE.md）の踏襲。別 execution からの可視性保証。
4. **呼び出し元の責務**：
   - `loginStudent` で `_logHP` が `ok:false` を返したら、Students.HP / LAST_LOGIN の **rollback** を実行する（setValue で前の値に戻す）。または、Students 更新と _logHP の **書き込み順序を入れ替える**（HPLog 先 → 成功時のみ Students 更新）。

**実装難易度**：M

**期待効果**：
- 一時的 Sheet API 失敗の 99% は即時リトライで救済可能（経験則）。
- 残り 1% の永続的失敗時は、Students.HP も更新しないので **一貫性が保たれる**（パターン A 自体が発生しなくなる）。
- 既存の `recoverAllStudentsStreak` の fallback 検出に頼らず、データ欠損自体を最小化できる。

**副作用リスク**：
- _logHP のリトライ + flush で、関数の所要時間が +0.5〜1 秒（リトライ発動時）。ログイン応答が遅くなる可能性。
- rollback 経路は実装ミスのリスクあり（書き込み戻しの順序や、cache 更新の戻し忘れ）。

**推奨**：★ **強く推奨**。最短で実装でき、原理的に「Students 進 + HPLog 欠落」の構造をなくせる。

---

### 案 B：書き込み順序の入れ替え（★ 推奨補助、案 A 不採用時の代替）

**概要**：HP 付与経路の全コンテンツで、書き込み順を次のように変更する：

```
[現状]
  Students.HP setValue
  → _updateAccountCacheBySid
  → _logHP（失敗してもサイレント）

[改善後]
  _logHP（appendRow + flush）
  → 成功時のみ Students.HP setValue
  → _updateAccountCacheBySid
```

**期待効果**：
- HPLog 書き込みが失敗したら Students は更新されない → **欠落自体は発生するが、不一致は発生しない**。
- 不一致が無ければ次回リクエストで救済可能になる（lastLogin が更新されないので、次回ログイン時に +10HP がもう一度試行される）。

**実装難易度**：M〜L
- loginStudent / saveAttempt / submitSango / submitWabun1 / submitKisoAnswer / submitLison / submitKanjiKaki / submitKobunSet など **全 HP 付与ポイントで順序変更が必要**。
- 順序変更によって、現状の挙動を期待しているテスト / 既存運用への影響を全件レビュー。

**副作用リスク**：
- 案 A と組み合わせるなら overkill。案 A 不採用時の単独採用が現実的。

**推奨**：案 A 不採用なら必須。案 A 採用なら不要。

---

### 案 C：書き込み二段確認（appendRow + readBack）

**概要**：`_logHP` で appendRow 後、即座に **getRange(lastRow, 1, 1, 5).getValues()** で実際にレコードが書き込まれたか確認する。失敗していたら再試行。

**期待効果**：
- 厳密な書き込み検証で「appendRow は成功と返したが実は書かれていなかった」エッジケースもキャッチ可能。

**実装難易度**：M

**副作用リスク**：
- 1 回の `_logHP` で 2 回 API 呼び出し（appendRow + getValues + flush）になり、レスポンス時間が長くなる。
- Sheets API 内部の同期保証を考えると、appendRow 直後の getValues は **必ず一致する**（同 execution 内）。それでも検証する意義は「Sheets バックエンドの永続化保証」を確認したい場合のみ。

**推奨**：案 A の補強として、最初の数日だけテレメトリ収集目的で導入し、appendRow の失敗率を測ったら撤去する運用が現実的。**案 A の代わりに恒久採用するのは過剰**。

---

### 案 D：フロント側「ログインボーナス未付与時の自動補正トリガ」

**概要**：フロント `doLogin` のレスポンスで `loginBonus === 0` だが `streak >= 1` のとき、サーバに「補正リクエスト」を送り、本日の HPLog 'login' レコードが存在しなければ補填する。

**期待効果**：
- パターン A の事後救済が自動化される。生徒が「今日ログインしたのに 10HP 入ってない」と気付かなくても、次回ログイン時に検出 → 自動補正できる。

**実装難易度**：L
- サーバ側に補正 API（idempotent な「本日 login レコードがなければ +10 と HPLog 追加」）を新設。
- フロント側で loginStudent 後にこの API を必ず呼ぶ。
- 二重補正の防止が複雑（HPLog 'login' の確認 + Students.HP の事前差し戻し検出など）。

**副作用リスク**：
- 補正 API が誤動作すると **二重付与** のリスク。Idempotency キー（生徒ID + 日付）の厳密管理が必要。

**推奨**：案 A 採用後、なお欠落が発生し続けるなら検討。**短期で採用するのは複雑度が見合わない**。

---

### 案 E：HPLog 欠落の事後検出 + 自動補填バッチ

**概要**：日次バッチ（Time-based Trigger）で全生徒の Students.LAST_LOGIN と HPLog 'login' を突き合わせ、欠落があれば自動補填。

**期待効果**：
- 過去分の欠落も含めて自動修復可能。
- 案 A の前段として、まず既知の欠落を一掃する目的でも使える。

**実装難易度**：M
- 既存の `recoverAllStudentsStreak` 関数（[gas/Code.js:1611](gas/Code.js:1611)）と類似の構造で書ける。
- ただし「補填する HP の倍率」「補填するかどうかの判定基準」を慎重に決める必要あり。

**副作用リスク**：
- 補填基準が曖昧だと、正常な「未ログイン日」まで誤って補填する可能性。
- バッチ実行のタイミングで一時的に Students.HP が動くため、保護者から「いつのまにか HP が増えた」問い合わせのリスク。

**推奨**：**中期検討**。短期は案 A で構造修正、その後でも残る過去欠落の救済として案 E を別途実装。

---

### 案 F：LockService 導入（補助）

**概要**：`_logHP` / 各 submit 関数の HP 加算ブロックを `LockService.getScriptLock()` で直列化する。

**期待効果**：
- 並行 execution 競合（H3）の根本対策。

**実装難易度**：S（数行追加）

**副作用リスク**：
- ロック取得時の `tryLock(timeout)` を短くしすぎると逆に失敗確率が上がる。
- 長くしすぎるとレスポンス遅延。
- ピーク時間帯（夕方〜夜）でロック待ちが累積する可能性。

**推奨**：**保留**。案 A が機能すれば不要。案 A 採用後に並行競合の実害が観測されたら追加検討。

---

## 7. パターン A / B 想定原因まとめ + 推奨対策の対応

| パターン | 主犯仮説 | 対応する案 |
|---|---|---|
| A：ログイン HPLog 欠落 | H1（_logHP 失敗） + H2（連打誘発） | **案 A**（_logHP 堅牢化）+ 案 D（事後補正） |
| B：学習活動 HPLog 欠落 | H1（_logHP 失敗） + H3（並行競合の可能性） | **案 A** + 案 F（LockService 補助） |
| 過去分の救済 | 既に欠落しているレコード | **案 E**（事後検出バッチ） |

短期では **案 A 一本** で構造的真因を断つ。それでも残る過去欠落・補完用途には **案 E** を別実装。

---

## 8. データ欠損の被害範囲推定

**HPLog シートを直接読まないと厳密な被害範囲は出せない**が、コードから以下が推測できる：

1. **既知発症例**：24009 岩倉、23030 髙山（[gas/Code.js:1618](gas/Code.js:1618) コメント）。これは `recoverAllStudentsStreak` の dryRun 実行で fallback 検出されたケース。
2. **欠落確率の見積もり**：Apps Script の Sheets API の一時的失敗率は経験的に **0.1〜0.5%/呼び出し**（quota / lock / 内部エラー）。生徒数 60 名 × 1 日 1 ログイン × 1 月 = 1800 呼び出し → **1.8〜9 件の欠落** が月ごとに発生する想定。
3. **学習活動側**：生徒 1 名が 1 日に submit する平均回数を 5 回（英単語RUSH + 三語短文 + 和文英訳① + 基礎計算 + リスオン）とすると、60 名 × 5 × 30 日 = 9,000 呼び出し → **9〜45 件の欠落**。
4. **ピーク時間帯（夕方 18:00–22:00）に集中**：生徒の同時利用が多いため、Sheets API の競合確率が上がる。

**ただし、これはあくまで構造的推測**。実際の欠落数は HPLog シートを直接走査して、Students.LAST_LOGIN / Attempts シート / SangoSubmissions / Wabun1Submissions / KisoSessions / LisonSubmissions / KanjiSubmissions と突き合わせる必要がある（次フェーズ）。

---

## 9. ふくちさんへの確認事項（実装着手前に決めるべきこと）

### Q1：採用案の確定（最重要）

★ **案 A（_logHP 堅牢化：戻り値 + 即時リトライ + flush + rollback）を最優先で採用するか？**

- (a) Yes → Phase B で _logHP 改修に進む。
- (b) No / 別案 → 案 B〜F のどれを採るか。

### Q2：rollback ポリシー

案 A 採用時、`_logHP` 失敗時に Students.HP を rollback するか、書き込み順序を変えるか：

- (a) **rollback 方式**：Students.HP を一旦 +N → _logHP 失敗時は -N で戻す。順序変更なし。実装は局所的。
- (b) **書き込み順序変更方式**：先に _logHP（HPLog 書き込み） → 成功時のみ Students.HP 加算。**より安全だが全 HP 付与経路を変更する必要あり**。

(b) の方が原理的に安全。(a) は実装簡単だが rollback 経路にバグが入ると複雑化。

### Q3：過去欠落の救済タイミング

既に欠落しているレコード（24009 岩倉 / 23030 髙山 / 他）の救済：

- (a) 案 A 実装後、運用が安定したら案 E（事後検出バッチ）で一括補填。
- (b) 個別に GAS エディタから補正関数を実行（apologyXxx パターン）。
- (c) 不問にする（既に表示側で fallback 検出して見せている）。

### Q4：被害範囲の実数調査

Phase A 実装前に HPLog シートを実データで突き合わせて被害範囲を測るか：

- (a) Yes：別タスクで diagnoseAllHpLogGaps() のような調査関数を作って実行。
- (b) No：構造的推測のみで案 A 実装に進む。観測は事後でも遅くない。

### Q5：LockService の段階導入

H3（並行競合）対策として LockService を案 A と同時に入れるか：

- (a) 案 A のみで様子見、なお欠落が出るなら案 F 追加。
- (b) 案 A + 案 F を同時実装（並行競合も同時に潰す）。

### Q6：フロント側のタイムアウト / リトライ

`gasGet` にタイムアウト + 自動リトライを追加するか（パターン A の H2 ユーザ連打を緩和）：

- (a) 案 A 採用後、連打誘発がまだ残るかを観察してから判断。
- (b) 同時実装（タイムアウト 30 秒、AbortError 時に 1 回だけ自動リトライ）。

### Q7：HPLog 書き込み確認のテレメトリ

案 C のうち「書き込み検証 (readBack)」は **恒久採用は過剰** だが、案 A 実装直後の数日間だけ **失敗率を測るためのテレメトリ** として一時的に有効化するか：

- (a) Yes：DEBUG_HPLOG プロパティで切替、appendRow の成功/失敗率を console.log で記録。
- (b) No：案 A の出来栄えを信じる。

---

## 補遺：今回の調査で確認したファイル・行番号一覧

| ファイル | 行番号 | 内容 |
|---|---|---|
| gas/Code.js | 85 | `_todayEducationalJST`（4:00 AM 教育日） |
| gas/Code.js | 208 | `_getStudentsValues`（cache 経由読み取り、書き込み禁止） |
| gas/Code.js | 821–846 | `_findAccountRowOnSheet`（フレッシュ読み取り、書き込み行特定用） |
| gas/Code.js | 852–897 | `_updateAccountCacheBySid`（in-place cache 更新） |
| gas/Code.js | 1163–1259 | `loginStudent` 本体 |
| gas/Code.js | 1208–1218 | HP 付与のシーケンス（setValues → setValue → cache 更新 → _logHP） |
| gas/Code.js | 1329–1343 | `_getPrevDayCount`（HPLog 末尾 500 行走査） |
| gas/Code.js | 1356–1366 | `_isCountableActivityType`（type 判定） |
| gas/Code.js | 1470–1534 | `saveAttempt`（英単語RUSH HP 付与） |
| gas/Code.js | 1545–1557 | `_logHP`（HPLog 書き込みヘルパー、try-catch console.error のみ） |
| gas/Code.js | 1611–1700 | `recoverAllStudentsStreak`（既知症例コメント：24009 岩倉、23030 髙山） |
| gas/Code.js | 4325, 4386, 11495 | `SpreadsheetApp.flush()` 呼び出し箇所（基礎計算写真保存 + カンジー Submissions） |
| gas/Code.js | 5380–5510 | `submitKisoAnswer`（基礎計算 HP 付与） |
| gas/Code.js | 8013–8074 | `submitSango`（三語短文 HP 付与） |
| gas/Code.js | 9043–9111 | `submitWabun1`（和文英訳① HP 付与） |
| gas/Code.js | 10780–10862 | `submitLison`（英語リスオン HP 付与） |
| gas/Code.js | 11392–11580 | `submitKanjiKaki`（カンジー HP 付与） |
| gas/Code.js | 12390–12500 | `submitKobunSet`（コブタン HP 付与、構造は同等） |
| gas/Code.js | grep 結果 | `LockService` ヒット 0 件（**マイ活アプリは LockService を一切使っていない**） |
| index.html | 2410–2436 | `gasGet` / `gasPost`（タイムアウト：gasGet なし / gasPost 90 秒） |
| index.html | 2913–2925 | `doLogin`（ログインボタン押下 → gasGet → showWelcome） |

---

## まとめ

| 項目 | 値 |
|---|---|
| レポートファイルパス | docs/bug4_root_cause_investigation_report.md |
| 行数 | この行を含めて約 360 行 |
| 失敗ポイント仮説の数 | 6 件（H1〜H6） |
| 改善方針案の数 | 6 件（案 A〜F） |
| 推奨案 | **案 A（_logHP 堅牢化：戻り値 + 即時リトライ + flush + rollback）** |
| ふくちさんへの確認事項 | 7 件（Q1〜Q7） |

**主犯仮説**：[`_logHP`](gas/Code.js:1545) の **try-catch がエラーをサイレントに呑む構造** + **Students.HP 更新が `_logHP` の前に行われる順序** が、パターン A・B 両方の真因。`SpreadsheetApp.flush()` 漏れと LockService 未使用が二次的に並行競合を増幅。

ふくちさんがこのレポートを読んで方針確定 → Phase B（実装）に進む。
