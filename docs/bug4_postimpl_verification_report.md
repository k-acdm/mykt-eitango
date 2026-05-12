# バグ④-本質 Phase B 実装の事後検証レポート

検証日：2026-05-12
検証者：Claude Code（Phase C 読み取り専用検証）
対象スレ：v13 緊急バグ④-本質 事後検証セッション
スコープ：コード変更禁止。本レポート（docs/bug4_postimpl_verification_report.md）のみ作成。

---

## 0. エグゼクティブサマリ

Phase B（コミット `0d7d702` 〜 `2f98c71`、計 9 本）で実装された「`_logHP` 堅牢化 + 書き込み順序逆転（_logHP 先 → Students 後）」を、HP 付与経路 **9 関数**（うち実質的に _logHP を呼ぶのは 8 関数）について検証。

**最終判定：✅ Phase B 実装は健全。本番運用継続 OK。**

- 9 関数すべてで HP 計算ロジック（連続週数ボーナス：rawHP × week²）が**順序変更前後で同じ値**を算出するように、入力値（streak / week / multiplier）は `_logHP` より前で取得・計算済み
- `_logHP` 失敗時の rollback（Students.HP 更新スキップ）は**全関数で一貫**して実装
- フロント側のエラーコード（`errorCode: 'HP_LOG_FAILED'`）は 8 箇所すべてで統一表記
- 軽微な懸念 4 件あり（重大度低、緊急修正不要）

懸念点はいずれも「順序変更の副次効果として残る、提出シートの過剰レコード」「練習モードの _logHP 失敗を無視する設計判断」「フロント側の `errorCode` 未活用」に関するもので、構造的バグや HP 計算の崩れではない。本番運用継続に支障なし。

---

## 1. Phase B の変更内容サマリ（コミット 9 本の差分要点）

| SHA | 対象 | 差分（行数） | 要点 |
|---|---|---|---|
| `0d7d702` | `_logHP` 堅牢化 | +48 / -8 | 戻り値 `{ok}` + リトライ 1 回 + `SpreadsheetApp.flush()` + `DEBUG_HPLOG` テレメトリ |
| `c9cb15b` | `loginStudent` | +13 / -2 | _logHP 先 → Students 更新（HP / STREAK / LAST_LOGIN）。失敗時は全更新スキップ |
| `ecd31ed` | `saveAttempt` | +10 / -2 | _logHP 先 → Students 更新（CLEARED / UPDATED / HP / LAST_TEST）。Attempts は維持 |
| `229391e` | `submitSango` | +9 / -3 | _logHP 先 → Students.HP 加算。Submissions は維持 |
| `a6bc7a8` | `submitWabun1` | +9 / -3 | _logHP 先 → Students.HP 加算。Submissions は維持 |
| `b3615b1` | `submitKisoAnswer` | +13 / -3 | _logHP 先 → Students / KisoSessions 更新。練習モード時は失敗無視で続行 |
| `85f7ec0` | `submitLison` | +12 / -8 | _logHP 先 → Students 加算 → LisonSubmissions 追記。最も厳密な順序設計 |
| `b134303` | `submitKanjiKaki` | +12 / -3 | _logHP 先 → Students / 進捗（kanji_next）更新。練習モード時は失敗無視 |
| `2f98c71` | `submitKobunSet` | +12 / -3 | _logHP 先 → Students / 進捗（kobun_next）更新。練習モード時は失敗無視 |

**合計：+143 / -34 行（gas/Code.js）**

---

## 2. 各 HP 付与経路の検証結果

### 2.1 loginStudent（[gas/Code.js:1163](gas/Code.js)）

**HP 計算式**：10HP 固定（連続週数ボーナスなし）

**順序の正当性**：
- streak / missedDays / loginBonus / currentHP（=+10 後）はすべて `_logHP` 呼び出し（L1209）より**前のローカル変数として算出済み**（L1175-1200）
- HP 計算は week² 倍率を**使わない**ためシンプル
- `_logHP` 失敗時：L1210-1213 で early return。Students.HP / STREAK / LAST_LOGIN への setValues / setValue は L1221-1223 にあり、return 後なので実行されない ✅
- `_updateAccountCacheBySid` も同様に未実行 ✅

**生徒の体験**：
- 失敗時：「内部エラーが発生しました。もう一度試してください。」表示 + ログイン未完了 → 再試行で +10HP がもう一度試行されて自動救済 ✅
- `lastLogin` が今日に書き換わらないため、同日内に再ログインしても if 文を通って HP 付与経路に入る

**検証結果**：✅ 正常

### 2.2 saveAttempt（[gas/Code.js:1481](gas/Code.js)）

**HP 計算式**：`50 × week²`（week = ceil(streak / 7)）

**順序の正当性**：
- `stuLoc = _findAccountRowOnSheet(sid)` でフレッシュに取得（L1493、cache 経由禁止）
- `streak = sRow[COL_STREAK]`、`week = ceil(streak/7)`、`hpGained = 50 * week * week` を `_logHP` より前で算出（L1514-1517）
- `_logHP` は L1523、`rawHP=hpGained, hpGained=hpGained, type='test'`（英単語RUSH は素点=倍率後HP）✅
- 失敗時：L1524-1527 で early return。Students.HP / CLEARED / LAST_TEST 更新（L1537-1539）は未実行 ✅

**前段書き込みの副作用**：
- Attempts シート appendRow（L1497）：**_logHP より前**で実行済（合格・不合格問わず）
- PropertiesService `pass1_*` / `pass2_*` / `cleared_*`（L1500-1506）：**_logHP より前**で実行済
- 副次効果：失敗時は「合格と記録されたが HP が付かない」状態。生徒は次回提出すれば再採点され、`pass1/pass2` は idempotent な setProperty で上書き、`cleared_*` は `setNo > clearedSets` false で更新スキップ → **重複なし**で再付与される ✅

**不合格時の挙動**：
- L1498 `if (!passed) return { ok: true };` で早期 return → `_logHP` 呼ばれない、HP も付与されない ✅

**検証結果**：✅ 正常

### 2.3 submitSango（[gas/Code.js:8082](gas/Code.js)）

**HP 計算式**：`200 × week²`

**順序の正当性**：
- `stuLoc = _findAccountRowOnSheet(sid)` でフレッシュに取得
- `streak / week / hpGained = 200 * week * week` を `_logHP` より前で算出（L8124-8126）
- `_logHP` は L8131、`rawHP=hpGained, hpGained=hpGained, type='sango'`（素点=倍率後HP）✅
- 失敗時：L8132-8135 で early return。Students.HP setValue（L8139）と cache 更新は未実行 ✅

**前段書き込みの副作用**：
- SangoSubmissions appendRow（L8101）：**_logHP より前**で実行済
- 副次効果：失敗時は提出記録が残るが HP は付かない。次回提出時の alreadyGranted 判定で本日の `'sango'` type の HPLog がないため `alreadyGranted=false` → 再試行で HP 付与経路に再度入る ✅

**alreadyGranted 判定との整合性**：
- `_logHP` 成功で確実に HPLog に書き込まれるため、二重付与のリスクが**構造的に解消**（旧コードでは _logHP 失敗時に alreadyGranted 素通りで二重付与の可能性あり、これが Phase A H1 の重要な副次効果）✅

**検証結果**：✅ 正常

### 2.4 submitWabun1（[gas/Code.js:9043](gas/Code.js)）

**HP 計算式**：`baseHp × week²`（baseHp = `todayStr >= '2026-04-29' ? 200 : 100`）

**順序の正当性**：
- `stuLoc = _findAccountRowOnSheet(sid)` でフレッシュに取得（L9124）
- `streak / week / baseHp / hpGained` を `_logHP` より前で算出（L9158-9163）
- 4/29 以降の base 200 への切替ロジックは保持 ✅
- `_logHP` は L9168、`rawHP=hpGained, hpGained=hpGained, type='wabun1'`（素点=倍率後HP）✅
- 失敗時：L9169-9172 で early return。Students.HP 更新は未実行 ✅

**前段書き込みの副作用**：
- Wabun1Submissions appendRow（L9137、`subSheet.appendRow([now, sid, studentName, workText, 'photo', '', skipJson])`）：**_logHP より前**で実行済（正誤問わず）
- 副次効果：submitSango と同じパターン、提出記録は残るが HP は再試行で正しく付与 ✅

**合格判定**：
- L9119 `allCorrect = results.length > 0 && results.every(r => r.correct)` で全問正解判定
- L9157 `if (allCorrect && !alreadyGranted)` で HP 付与
- 不合格時は `_logHP` も呼ばれない ✅

**検証結果**：✅ 正常

### 2.5 submitKisoAnswer（[gas/Code.js:5436](gas/Code.js)）

**HP 計算式**：`effectiveRawHP × week²`（基礎計算のみ rawHP ≠ hpGained）

**順序の正当性**：
- `passed=true` の場合のみ HP 付与経路に入る（L5495）
- `stuLoc = _findAccountRowOnSheet(studentId)` でフレッシュに取得（L5498）
- `streakValue / week / baseRawHP / todayTotalBefore / remaining / effectiveRawHP / isPractice / hpGained` を `_logHP` より前で算出（L5499-5507）
- `todayTotalBefore = _kisoTodayRawHP(studentId)` で本日累計を再走査 → 過去の `_logHP` 成功記録に基づき正確に計算 ✅
- `_logHP` は L5516、`rawHP=effectiveRawHP（素点）, hpGained=hpGained（倍率後）, type='kiso_<rank>_<count>'` ⚠️ **基礎計算は素点と倍率後HPが異なる**。引数渡しが他コンテンツと違うがこれは仕様通り ✅

**通常モード時の失敗時挙動**：
- L5517 `if (!logRes.ok && !isPractice && hpGained > 0)` で early return
- Students.HP setValue（L5525）、KisoSessions の status / attempts / wrongIds / completedAt / hpEarned 更新（L5546-5552）、写真保存（L5563）すべて未実行 ✅
- 同じセッションを再提出すれば次回成功で救済 ✅

**練習モード時の失敗時挙動**：
- `isPractice === true && hpGained === 0` の場合：警告ログのみ出力、early return しない
- KisoSessions / 写真保存は実行される
- HPLog `kiso_*_practice` レコードは `_isCountableActivityType()` で**活動集計から除外される**（CLAUDE.md 運用ルール）ため、欠落しても害は最小 ✅
- これは仕様通りの設計判断（HP 付与がないため失敗で全体を巻き戻すのは過剰）

**合格判定（部分点含む）**：
- L5481 `passed = (correctCount / targetIds.length) >= 0.80`（初回 80% 以上）
- L5484 `passed = (newWrongIds.length === 0)`（再挑戦は全問正解）
- 不合格時は HP 計算ブロックに入らず `_logHP` 呼ばれない ✅

**検証結果**：✅ 正常

### 2.6 submitLison（[gas/Code.js:10780](gas/Code.js)）

**HP 計算式**：`baseHp × week²`（baseHp は `_lisonBaseHpForLevel(level)`、4/3/pre2=100、2/pre1=200）

**順序の正当性（最も厳密）**：
- `stuLoc = _findAccountRowOnSheet(sid)` でフレッシュに取得（L10855）
- alreadyGranted 判定（L10870-10886）→ Drive 録音保存（L10889、_saveLisonRecording）→ HP 計算（L10895-10900）→ `_logHP`（L10906）→ Students.HP 更新（L10913-10918）→ LisonSubmissions appendRow（L10928-10938）の順
- **`_logHP` 失敗時は LisonSubmissions への appendRow すら実行されない**（L10907-10910 で early return）⚠️ ← これが他コンテンツと違う、より厳密な設計

**Drive 録音保存の扱い**：
- 録音は `_logHP` より前で Drive に保存済（L10889）
- 失敗時：Drive ファイルは残るが LisonSubmissions に未追記 → 次回提出時の alreadyGranted 判定で本日のレコードが見つからず `alreadyGranted=false` → 再試行で HP 付与経路に再度入る ✅
- 副次効果：Drive に同日録音が複数ファイル残る可能性。ただし運用上「録音は何度でも撮り直せる」前提のため許容範囲

**alreadyGranted=true 経路**：
- L10870-10886 で本日既に提出済の場合：HP 付与をスキップしつつ Drive 保存と LisonSubmissions 追記は実施
- このパスでは `_logHP` を呼ばないため Phase B の対象外 ✅

**検証結果**：✅ 正常（他コンテンツより厳密な構造でむしろ模範的）

### 2.7 submitKanjiKaki（[gas/Code.js:11502](gas/Code.js)）

**HP 計算式**：`grantedRawHP × week²`（カンジー：素点 50 / 100、上限 100 rawHP/日）

**順序の正当性**：
- `passed=true` の場合のみ HP 付与経路に入る（L11618）
- `stuLoc = _findAccountRowOnSheet(sid)` でフレッシュに取得（L11615）
- `baseRawHP / todayRawHP / remaining / grantedRawHP / isPractice / streak / week / hpGained` を `_logHP` より前で算出（L11619-11629）
- `_logHP` は L11635、`rawHP=grantedRawHP（素点）, hpGained=hpGained（倍率後）, type='kanji_<level>_<count>'` ⚠️ 基礎計算と同様、素点と倍率後HPが異なる

**KanjiSubmissions の事前 appendRow + flush**：
- L11571-11583 で KanjiSubmissions に**全問の判定結果**を appendRow + `SpreadsheetApp.flush()`
- これは v12 教訓踏襲：事後検証用に判定結果を永続化（合格・不合格・再撮影誘導すべてで実行）
- `_logHP` より前で実行済のため、`_logHP` 失敗時もこの記録は残る ✅
- 副次効果：失敗時は判定結果が KanjiSubmissions に残るが HP は付かない。生徒は同セットを再挑戦すれば再採点され、KanjiSubmissions に追加レコードが残るが事後検証上は問題なし

**通常モード時の失敗時挙動**：
- L11636-11639 で early return（Students.HP / 進捗 kanji_next 更新スキップ）✅

**練習モード時の挙動**：
- `grantedRawHP > 0 && stuLoc` の if 分岐に入らず L11648-11653 の `else if (isPractice)` に進む
- `_logHP(sid, 0, 0, 'kanji_<level>_<count>_practice')` 呼び出しは戻り値を**無視**（コメントに明記）
- 進捗 kanji_next は更新される（L11656 以降）✅
- 健全：HP 付与がないため失敗時の rollback 不要

**合格判定**：
- L11610 `passed = total > 0 && correctCount === total`（全問正解、知識系コンテンツ方針、KANJI_PASS_RATIO = 1.0）✅

**検証結果**：✅ 正常

### 2.8 submitKanjiYomi（[gas/Code.js:11438](gas/Code.js)）

**`_logHP` 呼び出しの有無**：
- L11438-11490 を精査。`_logHP` の呼び出し**なし** ✅
- 戻り値は `{ ok, passed, correctCount, total, results }` のみ。HP 付与は行わない
- Phase B のコミット履歴にも submitKanjiYomi の変更なし

**設計上の位置づけ**：
- カンジーは「読み 4 択 → 書き OCR」の二段合格制。読みは判定のみ、書きで HP 付与というフロー
- 合格判定は L11484 `passed = total > 0 && correctCount === total`（全問正解、知識系コンテンツ方針、5/8 ふくちさん哲学）
- HP 付与経路と完全に分離されているため Phase B の影響範囲外 ✅

**検証結果**：✅ 正常（Phase B 影響なし）

### 2.9 submitKobunSet（[gas/Code.js:12476](gas/Code.js)）

**HP 計算式**：`grantedRawHP × week²`（コブタン：素点 100 / 学習回、上限 100 rawHP/日）

**順序の正当性**：
- `passed=true` の場合のみ HP 付与経路に入る（L12523）
- `stuLoc = _findAccountRowOnSheet(sid)` でフレッシュに取得（L12520）
- `baseRawHP / todayRawHP / remaining / grantedRawHP / isPractice / streak / week / hpGained` を `_logHP` より前で算出（L12524-12534）
- `_logHP` は L12539、`rawHP=grantedRawHP（素点）, hpGained=hpGained（倍率後）, type='kobun_<round>_<count>'` ⚠️ 基礎計算 / カンジーと同様

**通常モード時の失敗時挙動**：
- L12540-12543 で early return（Students.HP / 進捗 kobun_next 更新スキップ）✅

**練習モード時の挙動**：
- L12552-12557 の `else if (isPractice)` で `_logHP(sid, 0, 0, 'kobun_<round>_<count>_practice')` 呼び出し（戻り値無視）
- 進捗 kobun_next は更新される（L12560 以降）✅

**合格判定**：
- L12515 `passed = total > 0 && correctCount === total`（全問正解、KOBUN_PASS_RATIO = 1.0、知識系）✅
- 不合格時は HP 計算ブロックに入らず `_logHP` 呼ばれない ✅

**検証結果**：✅ 正常（submitKanjiKaki と完全に対称的な設計）

---

## 3. 共通パターンの確認

### 3.1 順序変更の一貫性

| 関数 | 1. 事前計算 | 2. _logHP | 3. 失敗時 early return | 4. Students 更新 | 5. cache 更新 / invalidate |
|---|---|---|---|---|---|
| loginStudent | streak / loginBonus | ✅ | ✅ | ✅ | ✅ |
| saveAttempt | streak / week / hpGained | ✅ | ✅ | ✅ | ✅ |
| submitSango | streak / week / hpGained | ✅ | ✅ | ✅ | ✅ |
| submitWabun1 | streak / week / baseHp / hpGained | ✅ | ✅ | ✅ | ✅ |
| submitKisoAnswer | streak / effectiveRawHP / hpGained | ✅ | ✅（非練習モード時） | ✅ | ✅ |
| submitLison | streak / week / baseHp / hpGained | ✅ | ✅ | ✅ | ✅ |
| submitKanjiKaki | streak / grantedRawHP / hpGained | ✅ | ✅（非練習モード時） | ✅ | ✅ |
| submitKobunSet | streak / grantedRawHP / hpGained | ✅ | ✅（非練習モード時） | ✅ | ✅ |

**全 8 関数で順序が完全に一貫**している。検証 OK。

### 3.2 エラー応答の統一

全 8 箇所で `return { ok: false, message: '内部エラーが発生しました。もう一度試してください。', errorCode: 'HP_LOG_FAILED' };` で**完全に統一**（grep 結果より）：

```
gas/Code.js:1212   loginStudent
gas/Code.js:1526   saveAttempt
gas/Code.js:5519   submitKisoAnswer
gas/Code.js:8134   submitSango
gas/Code.js:9171   submitWabun1
gas/Code.js:10909  submitLison
gas/Code.js:11638  submitKanjiKaki
gas/Code.js:12542  submitKobunSet
```

console.error メッセージも全関数で `[関数名] HPLog 書き込みに失敗しました。...` のフォーマット統一 ✅

### 3.3 練習モード時の設計判断

submitKisoAnswer / submitKanjiKaki / submitKobunSet の 3 関数で「練習モード時の `_logHP` 失敗を無視する」設計が採用されている：

- 練習モードは `hpGained === 0`、付与する HP がないため失敗で全体を巻き戻すのは過剰
- HPLog の `_practice` サフィックスは `_isCountableActivityType()`（[gas/Code.js:1356](gas/Code.js)）で**活動集計から除外**されるため、欠落しても学習履歴・マイカツ君 Stage 計算への影響なし
- 進捗（KisoSessions / kanji_next / kobun_next）は更新される → 学習の連続性を優先

**判定：健全な設計判断。本番運用継続 OK。**

---

## 4. 発見した懸念点

### 懸念点 1：saveAttempt の Attempts シート / PropertiesService 事前更新（軽微）

**該当箇所**：[gas/Code.js:1497](gas/Code.js)（Attempts appendRow）、L1500-1506（pass1/pass2/cleared PropertiesService）

**症状**：`_logHP` が失敗して early return した場合でも、Attempts シートには「合格」レコードが記録され、PropertiesService の `pass1_*` / `pass2_*` / `cleared_*` も更新済になる。生徒が再提出すれば再採点されるが、Attempts シートに重複レコードが残る。

**重大度**：低
- `pass1_*` / `pass2_*` は idempotent な setProperty で上書きされる → 重複ボーナス発生せず
- `cleared_*` は `setNo > clearedSets` の比較で更新スキップ → 重複なし
- Attempts シートに重複レコードが残るが、解析時の判別は容易（HPLog `'test'` 不在で識別可能）

**修正案**：必要に応じて、`_logHP` 失敗時に Attempts シートに「失敗マーカー」列を追加する案が考えられるが、現状運用での実害は確認されておらず、緊急修正は不要。

### 懸念点 2：submitSango / submitWabun1 の Submissions 事前 appendRow（軽微）

**該当箇所**：[gas/Code.js:8101](gas/Code.js)（SangoSubmissions appendRow）、[gas/Code.js:9137](gas/Code.js)（Wabun1Submissions appendRow）

**症状**：`_logHP` 失敗時、Submissions に提出記録が残るが HP は付かない。生徒が再提出すれば HP 付与経路が再走するが、Submissions に重複レコードが残る。

**重大度**：低
- alreadyGranted 判定は HPLog ベース → `_logHP` 失敗時は `alreadyGranted=false` のため再付与経路が正しく走る ✅
- Submissions の重複レコードは管理画面の「提出一覧」表示で見えるが、`teacher_comment` 等の運用上の混乱は限定的

**修正案**：意図的な設計（コミットメッセージに「提出記録は保持」と明記）。緊急修正は不要。

### 懸念点 3：フロント側で `errorCode` が未活用（軽微、次フェーズで UX 改善余地）

**該当箇所**：[index.html](index.html) 全体（`grep errorCode index.html` ヒット 0 件）

**症状**：GAS から返される `errorCode: 'HP_LOG_FAILED'` をフロント側で識別する分岐がない。生徒には共通エラーメッセージ「内部エラーが発生しました。もう一度試してください。」が表示されるのみ。

**重大度**：低
- 機能的には問題なし：生徒に再試行を促すメッセージは表示される
- 自動救済（再ログインで HP 再付与、再提出で HP 再付与）は正しく機能する

**修正案**：次フェーズの UX 改善で、HP_LOG_FAILED 専用の「もう一度送信ボタン」を表示するなどの提案検討余地あり。緊急対応不要。

### 懸念点 4：DEBUG_HPLOG プロパティの取り扱い（運用上の注意）

**該当箇所**：[gas/Code.js:1580](gas/Code.js)

**症状**：`PropertiesService.getScriptProperties().getProperty('DEBUG_HPLOG')` が `'true'` のときのみ詳細ログ出力。本番運用後は OFF にする必要あり。

**重大度**：情報（運用ルールの明示）

**対応**：
- Phase B 投入直後の数日は ON（成功/失敗率のテレメトリ収集）
- 安定確認後は GAS エディタの「プロジェクトの設定 → スクリプト プロパティ」で `DEBUG_HPLOG` を削除（または `'false'` に設定）
- 詳細ログのフォーマット例：
  ```
  [_logHP] sid=24009 type=login attempts=1 ok=true
  [_logHP] sid=24009 type=test attempts=2 ok=false error=...
  ```

---

## 5. テレメトリ確認

### 5.1 DEBUG_HPLOG プロパティ

**設計**（[gas/Code.js:1574-1615](gas/Code.js)）：
- `PropertiesService.getScriptProperties().getProperty('DEBUG_HPLOG') === 'true'` の場合のみ console.log 出力
- PropertiesService 読み取りは 1 関数呼び出しで 1 回のみ（`let debug` で結果を保存して使い回し）
- PropertiesService 失敗時は `debug=false` フォールバック（テレメトリ無効化）

**フォーマット**：
- 成功時：`[_logHP] sid=<sid> type=<type> attempts=<回数> ok=true`
- 失敗時（最終）：`[_logHP] sid=<sid> type=<type> attempts=2 ok=false error=<エラーメッセージ>`
- 失敗時（attempt 中）：常に `console.error('[_logHP] attempt=<回数> sid=<sid> type=<type>', e)` を出力（DEBUG_HPLOG 無関係に）

### 5.2 後で OFF にする手順

1. GAS エディタを開く
2. 左サイドメニュー「プロジェクトの設定」
3. 「スクリプト プロパティ」セクション
4. `DEBUG_HPLOG` の行を削除（または値を `false` に変更）
5. 保存

**推奨タイミング**：Phase B 投入後 1〜2 週間運用 → Apps Script Executions 画面で「リトライ発動率」「最終失敗率」を確認 → 失敗率が想定通り低い（0.1〜0.5%）なら OFF

---

## 6. ふくちさんへの確認事項

### Q1：DEBUG_HPLOG プロパティの ON / OFF タイミング

Phase B 投入直後のテレメトリ収集期間をどの程度確保するか：

- (a) 1 週間 ON → 失敗率を確認後 OFF
- (b) 2 週間 ON → より多くのサンプルを集めてから OFF
- (c) 1 ヶ月 ON → 月次サイクルで確認
- (d) 当面 ON のままにする

**推奨：(a) または (b)**。長期 ON のままだと console.log が累積して quota を圧迫する可能性があるため、安定確認後は OFF が望ましい。

### Q2：HPLog 書き込みリトライ率の許容ライン

Apps Script Executions ログで「初回失敗 → 2 回目で成功（attempts=2 ok=true）」の割合を観察した結果、**どの程度なら許容**か：

- 全 _logHP 呼び出しの 0.5% 未満：許容、現状維持
- 0.5〜2%：要観察、LockService 等の追加対策を検討
- 2% 以上：H3（並行競合）が想定より多い → 案 F（LockService 導入）を実装検討

### Q3：errorCode を活用したフロント UX 改善の優先度

懸念点 3 の対応について：

- (a) 次フェーズで `errorCode === 'HP_LOG_FAILED'` 専用の「もう一度送信ボタン」を実装
- (b) 一旦現状の汎用エラーメッセージのままで運用観察、生徒からの問い合わせが増えたら実装
- (c) 不要（生徒の再試行で自動救済されるため UX 改善の優先度は低い）

**推奨：(b)**。生徒からのフィードバックを待ってから判断。

---

## 7. 最終判定

# ✅ Phase B 実装は健全。本番運用継続 OK。

### 根拠

1. **HP 計算ロジックが順序変更前後で不変**
   - 全 8 関数で、streak / week / hpGained / rawHP は `_logHP` より前のローカル変数で算出済
   - 連続週数ボーナス（rawHP × week²）の計算が壊れていない

2. **`_logHP` 失敗時の rollback が一貫**
   - 通常モード時：8 関数すべてで `errorCode: 'HP_LOG_FAILED'` early return
   - Students.HP / 各種シート / 進捗 PropertiesService の更新を全てスキップ
   - 自動救済可能（再ログイン / 再提出で HP 付与経路が再走）

3. **練習モード時の設計判断が合理的**
   - submitKisoAnswer / submitKanjiKaki / submitKobunSet で `_logHP` 失敗を無視
   - HP 付与なし、`_practice` サフィックスで活動集計から除外 → 害は最小

4. **alreadyGranted 判定の信頼性向上**
   - HPLog 確実書き込みにより、二重付与のリスク（Phase A H1 の副次効果）が構造的に解消

5. **Phase B 投入で構造的問題が解消、本番安全**

### 軽微な懸念点（緊急修正不要）

- 懸念点 1〜4 はいずれも「副次的な提出シート過剰レコード」「UX 改善余地」レベル
- 重大度はすべて低、運用継続中に必要に応じて対応可能

### 次のアクション（提案）

1. **DEBUG_HPLOG プロパティを ON のまま 1〜2 週間運用** → 失敗率を測定
2. **Apps Script Executions で `[_logHP]` ログを定期確認** → リトライ成功率、最終失敗率を観察
3. **想定どおり失敗率が低い場合は DEBUG_HPLOG を OFF** にして本番運用継続
4. **想定より失敗率が高い場合は案 F（LockService 導入）を追加検討**（Phase A レポート Q5 参照）

---

## 補遺：今回の検証で確認したファイル・行番号一覧

| ファイル | 行番号 | 内容 |
|---|---|---|
| gas/Code.js | 1163-1259 | `loginStudent` 本体（Phase B 後） |
| gas/Code.js | 1481-1553 | `saveAttempt` 本体（Phase B 後） |
| gas/Code.js | 1574-1616 | `_logHP` 堅牢化済本体 |
| gas/Code.js | 5436-5570 | `submitKisoAnswer` 本体（Phase B 後） |
| gas/Code.js | 8082-8154 | `submitSango` 本体（Phase B 後） |
| gas/Code.js | 9043-9180 | `submitWabun1` 本体（Phase B 後） |
| gas/Code.js | 10780-10951 | `submitLison` 本体（Phase B 後） |
| gas/Code.js | 11438-11490 | `submitKanjiYomi` 本体（_logHP 呼び出しなし） |
| gas/Code.js | 11502-11680 | `submitKanjiKaki` 本体（Phase B 後） |
| gas/Code.js | 12476-12610 | `submitKobunSet` 本体（Phase B 後） |
| gas/Code.js | grep errorCode | 8 箇所すべて `HP_LOG_FAILED` で統一 |
| index.html | grep errorCode | ヒット 0 件（フロントは未対応、汎用エラー表示） |

---

## まとめ

| 項目 | 値 |
|---|---|
| レポートファイルパス | docs/bug4_postimpl_verification_report.md |
| 検証した関数の数 | 9 関数（うち実質 _logHP を呼ぶのは 8 関数、submitKanjiYomi は呼ばない設計） |
| 発見した懸念点の数 | 4 件（すべて重大度 = 低） |
| 重大な懸念（緊急修正必要） | 0 件 |
| 軽微な懸念（要観察） | 4 件 |
| 最終判定 | ✅ Phase B 実装は健全。本番運用継続 OK |
| ふくちさんへの確認事項 | 3 件（Q1〜Q3、いずれも運用判断レベル） |

**主たる結論**：Phase B（コミット `0d7d702` 〜 `2f98c71`）は Phase A レポートで推奨された案 A + Q2(b) 案（_logHP 堅牢化 + 書き込み順序変更）を完全に実装。HP 計算ロジック・rollback ロジック・エラー応答すべてで一貫性が保たれており、構造的な不具合は確認されない。本番運用継続 OK。
