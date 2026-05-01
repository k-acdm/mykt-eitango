# CLAUDE.md

本リポジトリで作業する Claude Code 向けの引き継ぎドキュメント。

## プロジェクト概要

**マイ活アプリ**（春日部アカデミー 学習支援アプリ）

- フロント: 単一ファイル `index.html`（GitHub Pages で配信）
- バック: Google Apps Script + Google Spreadsheet
- GAS_URL: `https://script.google.com/macros/s/AKfycbzmXyF4NVaJ3ji3L2uYA_tYC7Ptg1u62B1oxTOTl14Guk5vJEArHit17lLL-1QaP39UFA/exec`
- リポジトリ内にある画像資産: `logo.png` / `character.jpg` / `eiken5_sample.jpg`（相対パス参照）
- GASコードは `gas/Code.js` にある（claspで管理）。修正後は `gas/` フォルダで `clasp push` を実行してGAS側に同期する

### スプレッドシートのシート構成

| シート | 用途 | 主な列 |
|---|---|---|
| Students | 生徒マスタ | ID / Name / Nickname / Cleared / Updated / HP / Streak / LastTest / LastLogin |
| Questions | 4級以上の問題 | setNo / qNo / word / meaning / example / blank / 選択肢ABCD / answer / grade |
| Question5 | 5級の問題 | setNo / qNo / word / meaning / 選択肢ABCD / answer / grade |
| Attempts | テスト受験ログ | 日時 / 生徒ID / 氏名 / セット番号 / 得点 / 合否 / 級 / 端末 / メモ |
| HPLog | HP付与ログ | timestamp / studentId / hpGained / type |
| Exchanges | 景品交換申請 | 日時 / sid / nickname / rank / currentHP / status |
| Quote | 今日の一言 | date / text / author |
| Notice | 塾からの連絡事項 | date / title / body |

### GAS action 一覧（doGet ルーティング）

`loginStudent / saveNickname / getTodaysSet / saveAttempt / getHistory / getSetWords / submitPhoto / getWeeklyRanking / submitExchange / getExchangeStatus / getQuote / getNotice / ping`

### 運用メモ

- コミット作者は `k-acdm <k-academy@mbr.nifty.com>`（リポジトリ内 git config 未設定のため `-c user.name= -c user.email=` で都度指定）
- **★ Claude Code → ふくちさん間の同期ルール（鉄則）**：Claude Code が dev に push したら、ふくちさんは `clasp push` する前に必ず以下を実行する：
  1. `cd C:\Users\Manager\mykt-eitango`
  2. `git checkout dev`
  3. `git pull origin dev` ← **必須**
  4. `git log --oneline -3` で Claude Code の最新コミットがローカルにあるか確認
  5. その後 `cd gas && clasp push`

  これを怠ると「ローカルが古いまま GAS に古いコードを上げてしまう」事故が起きる（2026-04-28 / 2026-04-29 に複数回発生）。Claude Code の dev push と clasp push の間は順序依存。
- GAS 変更フロー：
  1. `gas/Code.js` を編集（ローカルまたはClaude Code経由）
  2. `cd gas && clasp push` でGAS側に同期
  3. **★ GAS エディタは必ず F5 で強制リロードしてから確認・デプロイ**。開きっぱなしの状態では `clasp push` の差分が画面に反映されておらず、古いコードがデプロイされる事故につながる（2026-04-29 早朝に発生）。「push したのに古いコードに見える」と感じたら 100% F5 し忘れ
  4. GAS エディタで「デプロイ → 新しいデプロイを管理 → 編集 → バージョン更新 → デプロイ」で本番反映
- **`clasp pull` は使用しない**。GASへの変更は常に `clasp push` で一方通行。手元の `gas/Code.js` を最新に保ち、それをGASに反映する運用とする。過去に「デプロイ忘れ状態の GAS から `clasp pull` して手元の新実装を事故で revert」した事例があるため、`pull` は原則禁止。万が一 GAS エディタで直接編集した場合は、`gas/Code.js` にも同じ変更を手動で入れてから `clasp push` する
- **バージョン表示は `document.lastModified` から自動生成のため手動更新不要**。3 ファイル（`index.html` / `view.html` / `admin.html`）の右下に表示される `vYYYY.MM.DD` は GH Pages の Last-Modified ヘッダー由来で、HTML が実際にどの時点のバージョンかを反映する。タップで `?v=timestamp` 付き強制リロード可能（iPad Safari のキャッシュ問題への診断兼対策）
- **GAS 側 Script Cache 運用**: `gas/Code.js` は問題データ・お題・連絡・Quote・ランキングを CacheService でキャッシュしている（TTL 6 時間）。管理画面経由の書き込みは自動でキャッシュをクリアする。**Questions シートを直接スプレッドシートで編集**した場合は自動クリアされないため、即反映したいときは GAS エディタから `clearAllCache()` を手動実行するか、最大 6 時間待つ

---

## 作業ログ

### 2026-04-17

#### 1. HP 計算式の不具合調査と修正
- **事象**: 想定以上に HP を稼いでいる生徒が複数名存在（最大 130,950 HP 等）
- **原因**:
  - 主因: 結果ボタン連打による `saveAttempt` の多重送信（2026-04-16 の `adabf0d` で対策済み）
  - 副因: 計算式自体がポリシーより 1.5〜3 倍多く付与していた
- **ポリシー確認** (`ポイント計算_26-04-15.xlsx`):
  - 1 日あたり `10 (ログイン) + 100 × ROUNDUP(連続日数/7)²`
  - セットクリアにつき `50 × (週数)²`（1 日 2 セットで合計 `100 × (週数)²`）
- **GAS 修正** (`saveAttempt` 内 HP 計算ブロック):
  - 変更前: `clearHP(50 or 100) + clearHP × week²` をセット毎に付与
  - 変更後: `50 × week²` をセット毎に付与（base 削除、week² ガード削除）
  - 返却値 `clearHP` に `hpGained` を入れて後方互換を維持
- **既存の過剰 HP**: 据え置き（巻き戻し処理はしない）
- **生徒向け説明**: 新式を表組みで作成済み（配布用）

#### 2. Attempts シートの列構成修正
- **追加**: `生徒ID` の隣に `氏名` 列（`Students` シートから自動取得）
- **修正**: `端末（任意）` 列に級が誤って入っていた不整合を解消。`級` 列を独立させ `端末` は空欄に戻す
- **新列構成（9 列）**: `日時 / 生徒ID / 氏名 / セット番号 / 得点 / 合否 / 級 / 端末(任意) / メモ(任意)`
- **GAS 修正**:
  - `saveAttempt`: 冒頭で Students から氏名ルックアップ、`appendRow` を 9 要素化、HP 計算でも同じ `sRows` を再利用
  - `getHistory`: 列インデックスを `row[2→3] / row[4→5] / row[5→6]` に変更
- **シート移行手順**: C 列に氏名列挿入 → VLOOKUP で埋める → 値固定 → G1 を `級` にリネーム → H 列を新規挿入し `端末（任意）`

#### 3. ログイン画面刷新 + ホーム画面のダッシュボード化（コミット `ee1e54f`）
- **ログイン画面**:
  - タイトル `マイ活アプリ＜英単語＞` → **`マイ活アプリ`**
  - 背景を黄→オレンジ→ピンク→紫のグラデーションヒーロー化
  - タイトルもグラデーション文字
  - 下部に `logo.png`（春日部アカデミーロゴ）を表示
- **ホーム画面（ダッシュボード化）**: 上から 5 セクション構成
  1. 今日の一言 (`getQuote`、当日日付一致優先、なければランダム)
  2. マイカツ君エリア（従来通り）
  3. コンテンツボタン 9 種（英単語のみ有効、他は準備中バッジ＋半透明）
     - 英単語 / 三語短文 / 和文英訳① / 和文英訳② / 英語長文リスニング＆音読 / 基礎計算 / 漢字 / 社会の重要用語 / 理科の重要用語
     - 「英語長文リスニング＆音読」は名称が長いため 2 列ぶち抜き
  4. 塾からの連絡事項 (`getNotice`、最新 1 件を全文表示)
  5. 先週の週間HPランキング（従来通り）
  6. 最下部にサブ操作（おさらい / 音声設定）
- **JS 追加**: `loadTodayQuote()` / `loadLatestNotice()`（`showWelcome` から呼び出し）
- **準備中アラート文言分離**:
  - `showComingSoonLevel(name)` → `英検○○レベルは現在準備中です。…`（レベル選択画面用）
  - `showComingSoon(name)` → `○○ は現在準備中です。…`（ダッシュボード汎用）
- **GAS 追加実装（反映要）**:
  - 定数: `SHEET_QUOTE = 'Quote'` / `SHEET_NOTICE = 'Notice'`
  - ルーティング: `getQuote` / `getNotice`
  - 関数: `getQuote()`（date 列が今日なら優先、なければランダム） / `getNotice()`（最大日付 1 件を返却）

#### 4. 「テストを終了する」ボタンの不具合修正（worktree: `vigilant-rubin`）
- **事象**: テスト結果画面 / おさらい画面の「🚪 テストを終了する」を押しても画面が変わらない
- **原因**: `closeApp()` 内の `window.close()` / `top.close()` は、JS で開いたタブ以外ではブラウザ側でサイレント失敗する。フォールバックの `setTimeout(showScreen('screen-closed'), 300)` は動くはずだが、ユーザー体験としては「閉じられない → 画面遷移もない」ように見えていた
- **修正** ([index.html](index.html) `closeApp()`): ウィンドウクローズ試行を廃止し、`_stopAudio()` + `_historyMode = false` リセット + `showScreen('screen-welcome')` でダッシュボード復帰に変更
- **副次効果**: `screen-closed`（「このタブを閉じてください」画面）は現在どこからも呼ばれていない。将来削除して良い

#### 5. 「今日の一言」が表示されない不具合修正（worktree: `vigilant-rubin`）
- **事象**: ダッシュボードにフォールバック文言「今日も一歩ずつ、コツコツ頑張ろう！」が常に表示され、Quote シートの内容が反映されない
- **原因**: GAS 側 `getQuote()` の関数本体が未実装だった（`doGet` ルーティングは `else if (action === 'getQuote') result = getQuote();` で既に存在していたが、関数そのものが無いため参照エラー → fetch 側で res.ok=false 相当の扱いになりフォールバックに落ちていた）
- **GAS 修正**: `getQuote()` / `getNotice()` の関数本体を実装（反映済み）
  - JST タイムゾーン前提：`Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd')` で統一比較
  - 日付セルが `Date` 型 / 文字列 / 数値のいずれでも動作
  - ヘッダー行からインデックスを動的取得（列順変更に強い）
  - `text` 空行は除外してランダム選択に混ざらないよう防御
- **フロント修正** ([index.html](index.html) `loadTodayQuote()`):
  - `_normalizeQuote()` ヘルパーを追加：`{text, author}` オブジェクト / 配列 `[date, text, author]` / フィールド名ゆらぎ（`quote` / `body` / `message` 等）を吸収
  - GAS リクエストに `_ts: Date.now()` を付与してキャッシュバスト（スプレッドシート更新後の古い値表示を防止）

#### 6. 「おさらい」ボタンの移設（worktree: `vigilant-rubin`）
- **変更前**: ダッシュボード最下部の `sub-action-row` に「📖 おさらい」と「🔊 音声設定」の 2 ボタン並列
- **変更後**:
  - ダッシュボードからは「📖 おさらい」を削除（`sub-action-row.single` クラスで音声設定のみ 1 列化）
  - レベル選択画面（`screen-level`）の最下部に以下 2 ボタンを追加：
    1. 「📖 今までの単語をおさらいする」（緑グラデ、`showHistory()`）
    2. 「← ダッシュボードに戻る」（グレーグラデ、`showScreen('screen-welcome')`）
- **意図**: 英単語の学習フロー内に「おさらい」を置くことで動線を明確化。ダッシュボードをシンプルに保つ

#### 7. 英単語RUSH 改名 / beforeUnloadHandler 復活 / 過去の連絡事項ページ追加（worktree: `nervous-gould-01144d`, dev ブランチ）
- **【1】コンテンツ名変更**: ダッシュボードの「英単語」ボタンを「英単語RUSH」に変更（[index.html:318](index.html:318)）。文中の普通名詞「英単語」（書き取り指示文・テスト設問文）は据え置き
- **【2】beforeUnloadHandler 復活**: ページ離脱時の確認ダイアログを復活（[index.html](index.html) script 末尾）
  - `function beforeUnloadHandler(e) { e.preventDefault(); e.returnValue = '本当にこのページを離れますか？'; return e.returnValue; }`
  - `window.addEventListener('beforeunload', beforeUnloadHandler);`
- **【3】過去の連絡事項ページ追加**:
  - ダッシュボードの連絡事項カード直下に「📜 過去の連絡事項を見る」ボタンを追加（オレンジグラデ）
  - 新画面 `screen-notice-history` を追加：タイトル「📜 過去の連絡事項」、全件を `.notice-card` で縦並び表示、最下部に「← ホームに戻る」
  - JS 関数 `showNoticeHistory()` を追加：`gasGet({ action:'getNoticeHistory', _ts:Date.now() })` を呼び、`res.notices` 配列を描画。フィールド名ゆらぎ（`notices/history/data`、`title/subject`、`body/text/message`）と HTML エスケープに対応
  - GAS 側に `getNoticeHistory` アクション追加が必要（TODO 参照）

#### 10. 管理画面に週間HPランキングタブ + 画像保存機能を追加（2026-04-18）
- **配置**: `admin.html` に新タブ「🏆 週間HPランキング」追加
- **拡張**: Registry パターンを拡張し、従来のフォーム型 (`type: 'form'` 相当) に加えて **`type: 'custom'` + `render(section)` コールバック** 型モジュールをサポート。`buildAdminUI()` で分岐処理
- **表示**: 既存 `getWeeklyRanking` を叩いてランキング表示。生徒向け `index.html` より大きめのフォントサイズ（印刷/画像保存時の視認性重視）
  - `rank-num`: 28px（既存 20px）
  - `rank-nick`: 20px（既存 14px）
  - `.title`（称号）: 15px（既存 12px）
  - `rank-weekly`: 20px（既存 14px）
  - `rank-total`: 14px（既存 11px）
- **操作ボタン**:
  - `🔄 最新データ取得`: `loadAdminRanking()` 再実行
  - `📷 画像として保存`: `saveRankingImage()` → `html2canvas` でキャプチャ → `ranking_YYYYMMDD.png` としてダウンロード
- **html2canvas**: CDN から読込 (`https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js`)。`scale: 2` で高解像度出力
- **GAS 変更**: 不要（既存 `getWeeklyRanking` を流用）

---

#### 9. 保護者向け閲覧モード（view.html）新規作成（2026-04-18）
- **配置**: リポジトリルートに `view.html` を新設。GitHub Pages で `/view.html` として公開。`index.html`（生徒向け）/ `admin.html`（管理者向け）とは独立
- **方針**: 生徒の学習状況・ランキング・連絡事項の **閲覧専用**。テスト / 学習 / ニックネーム変更は一切不可。beforeunload / popstate / SFX は搭載しない
- **アクセス方法**: 生徒IDのみでログイン（パスワード不要）。保護者向け URL を個別配布して運用
- **表示内容**:
  - ① お子様のステータス（ニックネーム / 称号 / 連続日数 / キャラクター画像（stage別ビジュアル）/ 累積HP）
  - ② 先週の週間HPランキング（既存 `getWeeklyRanking` 流用。自分の子のニックネーム行を緑枠＋「← あなたのお子様」ハイライト）
  - ③ 塾からの連絡事項（最新3件 + 過去一覧画面への遷移ボタン、既存 `getNotice` / `getNoticeHistory` 流用）
- **重要な制約**: `loginStudent` は副作用（ログインボーナス付与 / streak 更新 / LastLogin 書換）があるため保護者閲覧では使えない。代わりに **読み取り専用の `getStudentView` アクションを GAS 側に新設する必要がある**（TODO 参照）
- **色テーマ**: 生徒向けアプリとの視覚的差別化のため、緑〜ティール系グラデーション（生徒向けはピンク〜紫、管理者向けは青紫）

---

#### 8. 管理画面（admin.html）新規作成（worktree: `nervous-gould-01144d`, dev ブランチ）
- **配置**: リポジトリルートに `admin.html` を新設。GitHub Pages で `/admin.html` として公開。`index.html`（生徒向け）とは独立
- **設計方針**: モジュール Registry パターンで拡張容易化。新機能追加は `registerAdminModule({...})` を 1 つ足すだけ（タブ / フォーム / バリデーション / 送信処理は自動生成）
- **初期搭載モジュール**:
  - `quote`（Quote シート追加）: `date` / `text` / `body`（author）
  - `notice`（Notice シート追加）: `date` / `title` / `body`
- **拡張予定**: 英単語RUSH 以外のコンテンツ問題追加など（モジュール定義例をコメントで残した）
- **UI**: ヘッダー（青紫グラデ） + タブ切替 + フォームカード + 送信トースト通知
- **認証**: GAS Script Properties の `ADMIN_PASSWORD` とパスワード照合（`adminLogin` API）。成功時は `sessionStorage.adminPassword` に保存、全 admin API 呼び出しに同梱。タブ閉じで自動失効。認証エラー時は自動ログアウト
- **フィールド型**: `text` / `date` / `number` / `textarea` をサポート。`default` に関数を渡すと動的デフォルト値（例：今日の日付）
- **GAS 側に以下の追加実装が必要**（TODO 参照）:
  - Script Properties: `ADMIN_PASSWORD`
  - 関数: `_verifyAdmin(pw)` / `adminLogin()` / `adminAddQuote()` / `adminAddNotice()`
  - `doGet` ルーティング追加

#### 11. ダッシュボード連絡事項 1 件 → 3 件表示（2026-04-17 夜）
- **フロント** ([index.html](index.html)):
  - `screen-welcome` の連絡事項セクションを固定単一 `notice-card` → 動的リスト `notice-list` コンテナに変更
  - `loadLatestNotice()` を書き換え、最大 3 件を縦並びにレンダリング。HTML エスケープ実装、旧 `res.notice`（単数形）レスポンスへのフォールバックも保持
- **GAS 側更新が必要**（TODO 参照）: `getNotice` の戻り値を `{ok, notices: [...最大3件]}` に、`getNoticeHistory` を同日タイブレーク対応（`date` 降順 → 同日は行番号降順で **後から appendRow された方を先に**）
- **意図**: 4 件目以降は「📜 過去の連絡事項を見る」で閲覧可。同日に複数投稿された場合も新しい順で正しく並ぶ

#### 12. 2026-04-18 小規模対応まとめ
- **レベル選択画面に問題一新告知バナー追加** ([index.html](index.html))
  - 文言: 「🎉 4月20日に問題を一新しました！」
  - 表示条件: **JST 2026-04-20 04:00 以降のみ**（`new Date('2026-04-20T04:00:00+09:00').getTime()` と `Date.now()` を比較）
  - デザイン: 赤〜黄グラデ + 白フチ + 脈動アニメーション（`announcePulse` 1.6 秒周期）
  - 削除容易性: HTML / CSS / JS の 3 ブロック全てを `[2026-04-20 問題一新告知]` マーカーコメントで囲み、告知不要時はブロック削除のみで完全除去可能
  - `showLevelSelect()` から `_applyLevelAnnouncement()` を呼び出し、画面遷移ごとに再判定（日付跨ぎ時にも再読込不要）
- **GAS ユーティリティ `resetAllProgress()` 関数をユーザーに提供**（リポジトリには含めず、GAS エディタから手動実行する想定）
  - `PropertiesService.getScriptProperties()` から `cleared_*` / `pass1_*` / `pass2_*` プレフィックスのキーを一括削除
  - `doGet` には登録しない（URL 経由の誤爆防止）
  - 戻り値: `{ok: true, deleted: 件数, keys: [...]}` + `console.log` に件数出力
- **worktree / ローカルブランチ整理**
  - 不要 worktree `sweet-snyder` を `git worktree remove --force` で削除（残存: `main` と `nervous-gould-01144d`）
  - `claude/*` ローカルブランチ 4 本（`distracted-turing` / `intelligent-lehmann` / `nervous-gould-01144d` / `sweet-snyder`）を全て `git branch -d` で削除。全て `main` にマージ済みの確認を取った上で実行

### 2026-04-19

#### 13. 三語短文コンテンツ新規実装（dev `12f588b` → main `4338bbc`）
- **ダッシュボード**: 「三語短文」ボタンを有効化（[index.html](index.html) `c-sango` / `showSangoTopic()`）。従来の「準備中」badge と `disabled` クラスを削除
- **新3画面追加**（[index.html](index.html)）:
  - `screen-sango-topic`: 今日のお題表示（レベル別カードで3語を chip 表示 + 前日の福地作品 + 4項目の注意書き + 提出ボタン2種）
  - `screen-sango-text`: レベルタブ → 3語再掲 → textarea → `submitSango` action（method=`text`）で送信
  - `screen-sango-photo`: レベルタブ → カメラ起動 → Vision API（`DOCUMENT_TEXT_DETECTION`）で OCR → 「これでよろしいですか？」確認UI → はい/いいえ。`method=photo` で送信
- **HP 加算**: 提出成功で +200HP（1日1回のみ）。2回目以降は `hpGained:0` を返す仕様。HPLog の `type='sango'` で当日有無を判定（3時基準）
- **拡張性**: レベルは `SANGO_LEVELS = ['A', 'S']` で配列管理。3〜4 レベルへの拡張時はこの配列に追加するだけで UI（タブ・プレビュー・パーサ）全てが追従
- **管理画面（admin.html）**:
  - 三語短文のお題入力を **Excel コピペ方式 + ライブプレビュー** に刷新
    - 週の開始日（月曜）を1つ選択 + 大きな textarea に Excel 14行をそのまま貼り付け
    - 対応フォーマット: `（レベルA）[TAB]月曜日[TAB]→[TAB]単語1[TAB]単語2[TAB]単語3`（5列（→なし）/6列 両対応、括弧省略可、曜日3表記対応「月/月曜/月曜日」）
    - パース結果をレベル別テーブルで即時プレビュー。エラー行は赤表示、同じ (日付,レベル) の重複も検出
  - **先生の作品は個別登録**（日付 + レベル select + 作品 textarea）。既存の (date,level) 行の `teacher_work` 列を GAS 側で `setValue` 上書き。該当行が無ければエラーメッセージで誘導
  - **提出一覧タブ** 追加：`adminListSangoSubmissions` を叩いて新しい順にカード表示（`_esc` で XSS 防御、`📷 写真` / `✏️ 直接入力` ラベル）
- **GAS TODO 記載**（CLAUDE.md 下部）:
  - シート `SangoTopics` / `SangoSubmissions` の列定義
  - 定数 `SHEET_SANGO_TOPICS` / `SHEET_SANGO_SUBMISSIONS`
  - `doGet` ルーティング 5 行（`getSangoTopic` / `submitSango` / `adminAddSangoTopicsWeek` / `adminSetSangoTeacherWork` / `adminListSangoSubmissions`）
  - 関数実装（ヘルパー `_sangoToday` / `_sangoPrevDate` / `_readSangoTopicsByDate` 含む）
- **表示切替は深夜3時基準**: `_sangoToday()` で JST 3時より前は前日扱い（Quote/Notice と同じパターン）
- **制約メモ**: `items` は GAS の GET クエリ内 JSON として送られる。レベル2×7日=14件までなら URL 長は余裕だが、レベル4に増やすと 7000 文字を超え得るため、その時は POST 対応 or レベル単位分割送信が必要
- **未反映**: GAS 側のシート作成・関数追加は未実施（TODO 参照）

#### 14. worktree とステールブランチの整理（2026-04-19）
- `hopeful-nightingale-1e40f3` worktree を `git worktree remove` で git 登録解除（未コミット分を dev/main に commit → merge → push した後に実行）
- ステール branch `claude/hopeful-nightingale-1e40f3` を `git branch -D` で削除
- 残骸ディレクトリ `.claude/worktrees/intelligent-lehmann/` を `rm -rf` で削除
- `.claude/worktrees/hopeful-nightingale-1e40f3/` のファイルシステム実体は作業中セッションが使用していたため削除不可。セッション終了後に別ターミナルから `rm -rf` 予定

#### 15. 三語短文「過去の提出作品」機能を追加（2026-04-19、dev `2524d09` → main `797a48b`）
- **生徒画面** ([index.html](index.html)):
  - お題画面（`screen-sango-topic`）の「作品を提出する（写真）」ボタンと「ホーム画面に戻る」ボタンの間に「📖 過去の提出作品」ボタンを追加（紫グラデ）
  - 新画面 `screen-sango-history` を追加：ヘッダーにログイン中の生徒ID表示、提出作品のリスト、末尾に「← お題画面に戻る」ボタン
  - JS 関数 `showSangoHistory()` を追加：`gasGet({ action:'getSangoSubmissions', studentId:_studentId })` を呼び、自分（ログイン中の生徒ID）の提出を新しい順にカード表示
  - カード内容: レベル / 提出日時 / 提出方法（📷 写真 or ✏️ 直接入力）/ 3語の chip / 作品本文（`white-space: pre-wrap` で改行保持）
- **保護者画面** ([view.html](view.html)):
  - 連絡事項セクション直下に「📖 三語短文の提出作品を見る」ボタン（紫グラデ）を追加
  - 新画面 `screen-sango-history`（保護者版）と `loadSangoHistory()` を追加：同じ `getSangoSubmissions` を叩いてログイン中の生徒の提出を一覧表示
- **GAS 側実装は未反映**（TODO 参照）: `getSangoSubmissions(params)` を新規追加する。`adminListSangoSubmissions` と違い **認証なし / studentId で絞り込み** の読み取り専用。レスポンス形状は `adminListSangoSubmissions` と同一の `{ok, submissions: [{timestamp, studentId, studentName, level, words, work, method}, ...]}`
- **動作確認の前提**: GAS 側の `getSangoSubmissions` を実装してデプロイするまで、両画面でボタンを押すと「読み込みに失敗しました」が表示される

#### 16. 三語短文のレベルを A/S の 2 種 → A/B/S/T の 4 種に拡張（2026-04-19、dev `a104f19` → main `797a48b`）
- **変更箇所は 1 行のみ** ([admin.html:180](admin.html:180)):
  ```javascript
  var SANGO_LEVELS = ['A', 'B', 'S', 'T'];  // 旧: ['A', 'S']
  ```
- **自動追従する UI**:
  - お題貼り付けエリアの案内「4レベル × 7日 = 28行分」に自動更新
  - プレビュー表：レベル A / B / S / T の 4 表を自動生成
  - パーサのバリデーション：未定義レベル検出メッセージも「定義：A/B/S/T」に追従
  - 先生の作品 登録ドロップダウン：A / B / S / T の 4 択に拡張
- **生徒画面（[index.html](index.html)）は変更不要**: レベルタブ（お題表示 / 直接入力 / 写真提出）は GAS の `getSangoTopic` が返す `topics` 配列を元に動的生成されるため、GAS 側で A/B/S/T のお題が登録されれば自動で 4 タブ表示される
- **URL 長の懸念**: 管理画面「お題の週単位一括登録」で送る items は 4 レベル × 7 日 = 28 件になり、JSON 文字列を GET クエリに載せる構造上 **URL 長が 7000 文字を超える可能性がある**（#13 記載済みの既知リスク）。実運用で `414 URI Too Long` が出たらレベル単位の分割送信 or `doGet` → `doPost` への切替が必要

#### 17. GAS `adminAddSangoTopicsWeek` 実装（2026-04-19、GAS エディタ側で直接反映 / リポジトリ変更なし）
- **背景**: 管理画面「お題を一括登録する」ボタンが送信する action `adminAddSangoTopicsWeek` の GAS 側実装が未反映のままだった（#13 TODO の一部）
- **事前確認（リポジトリ側の送信形状を調査）**:
  - [admin.html:307-336](admin.html:307) `submitSangoPaste()` の送信JSON:
    ```
    { action: 'adminAddSangoTopicsWeek', password, start: 'YYYY-MM-DD', items: [{ date, level, word1, word2, word3 }, ...] }
    ```
  - `teacher_work` は一括登録では送らない（個別登録は別 action `adminSetSangoTeacherWork`）
  - items の各要素は 5 キー固定（`date / level / word1 / word2 / word3`）
- **GAS 側で適用した修正（ユーザーが GAS エディタで直接反映）**:
  1. `doGet` ルーティング分岐に 1 行追加（`else if (action === 'adminAddSangoTopic')` の直下）:
     ```javascript
     else if (action === 'adminAddSangoTopicsWeek')   result = adminAddSangoTopicsWeek(params);
     ```
  2. `adminAddSangoTopic` の直下に `adminAddSangoTopicsWeek` 関数を新規追加。実装要点:
     - `_verifyAdmin(params.password)` で認証
     - items の必須チェック（date/level/word1-3 のいずれか空なら該当行をエラー配列に蓄積）
     - `teacher_work` 列は空文字で 6 列目に埋める（後から `adminSetSangoTeacherWork` で上書きされる運用）
     - `sh.getRange(startRow, 1, n, 6).setValues(rows)` で一括書き込み（appendRow ループより高速）
     - 戻り値 `{ ok:true, added:N, errors:[] }`
- **リポジトリ方針は従来通り**: Code.gs はリポジトリに含めず GAS エディタ側で管理（CLAUDE.md 運用メモに準拠）
- **関連作業（このセッションの確認のみ・コード変更なし）**:
  - [index.html:514-529](index.html:514) 三語短文お題表示画面の HTML 構造と、[index.html:1081-1112](index.html:1081) の `showSangoTopic()` / `_renderSangoTopic()` の描画ロジックを再確認（変更は加えていない）
  - worktree 整理: 追加 worktree は作業中の `strange-hertz-693d49` (dev) のみで、削除対象なし（現状維持）

### 2026-04-20

#### 18. 三語短文 `adminAddSangoTopicsWeek` エラー修正（昨日からの継続）
- **背景**: 2026-04-19 夜に GAS エディタ側で直接反映した `adminAddSangoTopicsWeek`（#17）が実運用時にエラーを起こしていたため、当日中に追加修正を入れて復旧済み
- **対応**: 管理画面から週単位一括登録が正常に通ることを本番 URL で確認
- **本セッションでの追加作業**: 後述の #19 で `gas/Code.js` 側を週番号対応に書き換えた際、同関数を丸ごと差し替える形で現行の最新ロジックへ整流

#### 19. clasp 導入で GAS `Code.js` をリポジトリ管理下に（コミット `4104508`、main に直接 push）
- **背景**: 従来は「`Code.gs` はリポジトリに含めず GAS エディタ側で管理」だったが、編集・差分レビュー・履歴追跡のために clasp で GAS とリポジトリを同期する運用に切替
- **追加されたもの**:
  - `.gitignore`（ルート、18 行）: ビルド成果物 / OS ゴミ / `.clasp` 認証情報など
  - `gas/.clasp.json` / `gas/.claspignore` / `gas/appsscript.json`
  - `gas/Code.js`（1372 行、現行 GAS の全文を clasp pull で取り込んだもの）
  - `CLAUDE.md` 運用メモを「GAS 変更フロー: 編集 → `cd gas && clasp push` → GAS エディタでデプロイ」に更新
- **フロー変更**:
  - 以後、Code.js の修正は `gas/Code.js` で編集 → ユーザーが手動で `clasp push` → 新しいデプロイ更新
  - Claude Code 側は `clasp push` を実行しない（ユーザー手動）
- **main に直接 push した理由**: 作業効率優先の特殊対応。通常フローとは逆向きだが、後続セッションで `main → dev` のマージで dev にも取り込み整合を回復（作業ログ #20 冒頭参照）
- **git config**: 手元で `k-acdm <k-academy@mbr.nifty.com>` を設定。以後 `-c user.name=... -c user.email=...` の都度指定は不要になったはずだが、Claude Code 側のコミットは念のため都度指定を継続

#### 20. 三語短文 週番号（week_no）対応（dev `c5afb17` / `eff1131` / `0a26400` → main `4dd6e81` / `e60e6d5` / `302bb46`）
- **背景**: お題に週番号を紐付け、生徒画面のトップに「三語短文【第○○週目】　本日のお題」バナーを出したい。併せて A/B/S/T の各レベルに意味付け（大学入試レベル等）を表示
- **スプレッドシート**: `SangoTopics` シートに 7 列目 `week_no` を追加済（ユーザー手動）
- **セッション冒頭の整流**:
  - 並行作業で `elegant-driscoll-fff1f4` worktree（dev）が残っていたのを削除（未コミット無し、origin/dev より 7 コミット遅れ状態）
  - 本 worktree `priceless-lederberg-d3ee9b` を `claude/priceless-lederberg-d3ee9b` → `dev` に切替
  - `origin/main` の clasp 導入コミット（#19）を `dev` に merge（`206ed98`）して dev 側にも `gas/Code.js` を取り込み
- **GAS 側 ([gas/Code.js](gas/Code.js))** コミット `c5afb17`:
  - `adminAddSangoTopicsWeek`: `params.weekNo` を受け取り各行の 7 列目に付与。`items` バリデーション + エラー集計 + まとめて `setValues` で一括書き込み（従来版から整理）
  - `_readSangoTopicsByDate`: `header.indexOf('week_no')` で列位置を動的取得し、返却オブジェクトに `week_no` を含める（列未存在時は空文字）
  - `getSangoTopic`: レスポンスに `weekNo` を追加（その日のお題行の最初の `week_no` を採用）
- **管理画面 ([admin.html:211-215](admin.html:211) / [admin.html:321-325](admin.html:321))** コミット `eff1131`:
  - プレビュー直下に「第○○週（週番号）」の number input（id `sango-paste-week-no`）を追加（空欄可）
  - `submitSangoPaste` が `gasGet` 送信時に `weekNo` を同梱
- **生徒画面 ([index.html](index.html))** コミット `0a26400`:
  - 定数 `SANGO_LEVEL_DESCRIPTIONS = { A: '大学入試レベル', S: '高校入試レベル', B: '中学校の教科書レベル', T: '小学校高学年の教科書レベル' }` を追加
  - 変数 `_sangoWeekNo` を追加、`showSangoTopic` で `res.weekNo` を保存
  - `_renderSangoTopic` を差し替え: 先頭に `.sango-title-banner` を描画（週番号が空なら「三語短文　本日のお題」にフォールバック）。各レベル見出しの直後に `.sango-level-desc` で説明を付記
  - CSS: `.sango-title-banner`（赤〜ピンクのグラデ / 白文字 / 角丸） + `.sango-level-desc`（13px・グレー）を追加
- **動作確認**: 本番 URL（GitHub Pages）で UI 反映を確認済み

#### 21. HP 計算ロジックを streak ベースで統一（dev `e69e2a7` → main `ef68e95`）
- **目的**: 今まで `saveAttempt` だけが独自の `testStreak_*` / `testLast_*`（PropertiesService）で週数管理していたのを廃止し、全コンテンツで **Students シートの `COL_STREAK`（ログイン連続日数）** を唯一のソースに統一
- **統一後の式**:
  - ログイン: `+10` 固定（week 倍率なし、1 日 1 回）
  - 課題クリア: `基本HP × ceil(streak/7)²`
    - 英単語RUSH 1 セット合格: 基本 `50`（→ 1 日 2 セットで `100 × week²`、従来通り）
    - 三語短文 提出（1 日 1 回）: 基本 `200`（**新規: 従来の固定 200 に `week²` 倍率が追加**）
- **[gas/Code.js](gas/Code.js) の差分** (`saveAttempt` / `submitSango` で合計 +8 / -21):
  - `saveAttempt`: `testStreakKey` / `testLastKey` による PropertiesService 読み書きブロックを丸ごと削除し、`Number(sRows[i][COL_STREAK]) || 1` で代用。返却値の `streak` / `week` も新ロジック値を返す
  - `submitSango`: `hpGained = 200;` → `const streak = ... COL_STREAK ... || 1; const week = Math.ceil(streak/7); hpGained = 200 * week * week;`
- **既存の `testStreak_*` / `testLast_*` プロパティ**: 参照されなくなるが意図的に放置。将来的に必要なら `resetAllProgress` に削除ロジックを追加する方針
- **テスト**: UI は本番確認済み。HP 加算ロジックの実データ確認は明日以降

### 2026-04-21

#### 22. 塾PCへの clasp 導入（作業環境整備）
- **背景**: 2026-04-20 に自宅PCで clasp 導入済み（#19）。塾PCでも `gas/Code.js` の編集→push フローを同じ手順で使えるよう環境整備
- **手順**:
  1. Node.js / npm インストール済みを確認
  2. `npm install -g @google/clasp`
  3. `clasp login` で Google アカウント認証
  4. `git config user.name / user.email` を `k-acdm / k-academy@mbr.nifty.com` に設定
  5. `git pull` で自宅PC 側の作業分（clasp 導入コミット含む）を取り込み
  6. `clasp pull` / `clasp push` で双方向同期の動作確認
- **結果**: 塾PC でも自宅PC と同一フロー（`gas/Code.js` 編集 → `cd gas && clasp push` → GAS エディタでデプロイ）で作業可能に

#### 23. 管理画面「三語短文の提出一覧」に本名表示を追加（dev `1f4cfd3` → main `7963e92`）
- **背景**: 従来「ニックネーム（ID）」表示だったが、先生視点で誰の提出か即座に判別しづらいケースがあった
- **[gas/Code.js](gas/Code.js) `adminListSangoSubmissions`**:
  - 冒頭で Students シートを読み、`studentId → COL_NAME` のマップを作成
  - submission オブジェクトに `studentRealName` フィールドを追加
- **[admin.html](admin.html) `loadSangoSubmissions`**:
  - 表示を「ニックネーム（本名）」形式に変更
  - 4 パターンのフォールバック（nick あり/real あり → `nick（real）` / nick のみ → `nick` / real のみ → `（real）` / 両方空 → `（不明）`）
- フロント・GAS ともデプロイ済み、本番 URL で確認済み

#### 24. 三語短文に「先生コメント」機能を追加（dev `03a4ac9` → main `229bc8e`）
- **スプレッドシート**: `SangoSubmissions` シートに H 列 `teacher_comment` を追加（手動）
- **[gas/Code.js](gas/Code.js)**:
  - `adminListSangoSubmissions` / `getSangoSubmissions` のレスポンス各 submission に `teacher_comment: String(r[7] || '')` を追加（H 列 = index 7）
  - `adminSetSangoComment(params)` を新規追加: `_verifyAdmin` → `(timestamp, studentId)` で行を特定（timestamp は `Utilities.formatDate` で JST `yyyy-MM-dd HH:mm:ss` に揃えて文字列比較）→ H 列（`getRange(i+1, 8)`）に `setValue`。空文字も許容（コメント削除用途）
  - `doGet` ルーティングに `adminSetSangoComment` を 1 行追加
- **[admin.html](admin.html)**: 各提出カードの末尾にコメント UI（`#sango-comment-{idx}`）を追加、3 状態遷移
  - 🟦 表示モード（コメントあり）: 青系背景 + 「💬 先生のコメント」+ 本文 + 編集ボタン
  - 🟧 編集モード: オレンジ系背景 + textarea + 保存/キャンセル
  - ⚪ 未コメント: グレー背景 + textarea + 送信
  - 空文字保存で未コメント状態に戻る（削除）
  - `_sangoSubCache` でカード index → submission をキャッシュし、onclick 引数を index のみに（timestamp/studentId の文字列エスケープを回避）
  - 通信/認証エラーは既存パターン（`showToast` / `doAdminLogout`）に準拠
- **[index.html](index.html) / [view.html](view.html)**: `showSangoHistory` / `loadSangoHistory` のカード HTML 末尾に青系コメントボックスを追加。`teacher_comment` が非空のときのみ描画、空/未定義ならカード見た目は従来通り。`white-space: pre-wrap` で改行保持、`_sangoEscHtml` / `_esc` で XSS 防御
- フロント・GAS ともデプロイ済み、本番 URL で動作確認済み

#### 25. Word 形式「ClaudeCode_作業ルーティン_v2」を作成（リポジトリ外）
- clasp 対応版の作業ルーティン資料を Word 形式で作成（ローカル資料、リポジトリには含めない）
- 塾PC / 自宅PC 両方から clasp を使う運用に合わせた更新版

#### 26. 三語短文 生徒画面「過去のお題と福地の作品」画面新設 / 全画面レベル順 A→S→B→T 統一（dev `2a3c5be` → main `dc81f1f`）
- **背景・目的**: 本日のお題画面に表示していた「福地の作品」は**前日**のお題に対する作品例であり、同じカード内に表示される**本日の3語**とは無関係。生徒が混乱するため、先生作品を別画面に分離。併せて全画面でレベル表示順を難易度順（A=大学入試 / S=高校入試 / B=中学校の教科書 / T=小学校高学年の教科書）に統一
- **[index.html](index.html)**:
  - `_renderSangoTopic` から `teacher_work` 表示ブロック（`sango-teacher-work` div と `_sangoTeacherWorks` wMap 構築）を削除し、本日のお題カードは**3語のみ表示**のシンプルな状態に
  - お題画面に「📚 過去のお題と福地の作品」ボタンを追加（「📖 過去の提出作品」の上、オレンジ〜ピンクグラデ）
  - 新画面 `screen-sango-past`（直近1週間、昨日→7日前の新しい順、既存の豪華カード `.sango-level-card` を流用、`teacher_work` が空のレベルはカードは表示するが福地作品エリアのみ非表示）。画面下部に「📜 さらに過去のもの」「🏠 本日のお題画面に戻る」ボタン
  - 新画面 `screen-sango-archive`（1週間以前を 1週間ずつページング、コンパクトカード `.sango-archive-card`、ページングボタン「← 新しい1週間へ」「次のページ（さらに古い1週間へ） →」、ヘッダーに「（○週前）」表示、state は `_sangoArchiveWeek`）
  - CSS 追加: `.sango-past-date-header`（ピンク〜赤グラデの日付ヘッダー）/ `.sango-archive-date-header`（青系コンパクト）/ `.sango-archive-card` / `.sango-archive-word` / `.sango-archive-tw` / `.sango-archive-pager` など
- **[gas/Code.js](gas/Code.js)**:
  - レベル順ヘルパー追加: `_SANGO_LEVEL_ORDER = ['A','S','B','T']` / `_sangoLevelRank(l)` / `_sangoSortByLevel(arr)` / `_SANGO_WEEKDAYS_JP`
  - 既存 `getSangoTopic` のソートを文字列比較（A→B→S→T）から `_sangoSortByLevel`（A→S→B→T）に変更
  - 新規ヘルパー `_readSangoTopicsByDateRange(startStr, endStr)`（全行1回スキャン + 日付範囲フィルタ）/ `_buildSangoTopicsByDate(rows)`（日付降順 × レベル A→S→B→T で `{date, weekday, levels:[...]}` 配列を生成）/ `_sangoDateAgo(daysAgo)`（JST 3時基準の「昨日」起点で N 日前の日付文字列）
  - 新規関数 `getSangoPastTopicsRecent()`: 昨日〜7日前の7日分
  - 新規関数 `getSangoPastTopicsPaged(params)`: `weekOffset` 引数で1週間単位ページング（`weekOffset=1` → 8日前〜14日前、`=2` → 15日前〜21日前）、次ページ有無は `hasMore` フラグで返却
  - `doGet` ルーティングに 2 行追加（`getSangoPastTopicsRecent` / `getSangoPastTopicsPaged`）
- **[admin.html](admin.html)**: `SANGO_LEVELS = ['A', 'B', 'S', 'T']` → `['A', 'S', 'B', 'T']`（1行変更）。これ1行で以下が自動追従：お題貼り付けプレビュー表のレベル順 / 先生の作品（個別登録）レベルプルダウン / パーサの未定義レベルエラーメッセージ（「定義：A/S/B/T」）
- **[view.html](view.html)**: 提出作品リストは timestamp 降順で level 順の UI は存在しないため変更なし
- **ワークフロー**: dev `2a3c5be` → main へ `--no-ff` merge (`dc81f1f`) → `clasp push` → GAS デプロイ更新 → 本番 URL で動作確認済み（生徒画面・管理画面ともに完璧に動作）

#### 27. 次回作業予定（メモ）
- **和文英訳①** の実装に着手予定。設計は完了済み、シート構造・フォーマットは合意済み
- **STEP 1**: `Wabun1Topics` / `Wabun1Submissions` シートの新設（ふくちさんが先に手動で作成）
- その後「英語長文リスニング＆音読」に進む予定

### 2026-04-22

本日は塾PCで作業。UI 改修 4 件 + 和文英訳① Phase 1/2（データ基盤 + 管理画面）まで実装。

#### 28. 英単語RUSHレベル選択画面に副題追加（dev `aa37351` / `7d53372` → main `5154890`）
- **背景**: 生徒が学習のゴールをイメージしやすいよう、各英検レベルに「総語数／セット数」を表示
- **[index.html](index.html)**:
  - `.level-btn` 左側 `<span>` を `.level-btn-main`（縦 flex）でラップし `.level-btn-name` + `.level-btn-sub` の 2 段構成に
  - 有効 6 レベル（5/4/3/準2/2/準1）に副題を付与。準2級プラス/1級 は「準備中」バッジのまま副題なし（現状ポリシー未確定のため）
  - 各レベルの副題（デスクトップ 15px / モバイル 13px / `#888` / `letter-spacing: .3px`）:
    - 5級「計590語｜118セット」/ 4級「計690語｜138セット」/ 3級「計1,150語｜230セット」
    - 準2級「計1,470語｜294セット」/ 2級「計1,700語｜340セット」/ 準1級「計1,900語｜380セット」
- **2 段階で実施**: 初回 12px/11px で実装 → レビューで 2 回り大きく（15px/13px）に調整

#### 29. HP算出方法のホーム画面表示（dev `4093949` → main `c3f0f35`）
- **背景**: 生徒・保護者に HP の仕組みを常時可視化。ポイント稼ぎのモチベ喚起
- **[index.html](index.html)**（コンテンツボタンに HP バッジ + HP 情報セクション）:
  - `.content-btn .badge-hp`: 白半透明 + オレンジ文字（`#d97706`）のバッジを右上に配置（既存 `.badge-soon` と同位置）
  - 英単語RUSH「50HP/セット」/ 三語短文「200HP/日」のみ付与（準備中コンテンツには付けない）
  - `.hp-info-card` セクション（クリーム〜薄ピンクグラデ `#fff7ed → #fef3f2`）を「コンテンツを選ぼう」の直下・連絡事項の上に新設
  - 常時表示: `毎日ログイン：+10HP` / `課題クリア：基本HP × 連続週数²` + `※連続週数 = 連続ログイン日数 ÷ 7 の切り上げ`
  - 開閉式トグル `toggleHpInfo()` で計算例（例1 連続5日 合計260HP / 例2 連続15日 倍率9倍）を `max-height` スライドで展開
- **[view.html](view.html)**: 同じ `.hp-info-card` を「三語短文の提出作品」セクションの下に配置。保護者画面にもコンテンツ理解用として同内容表示
- モバイル（480px以下）: padding / font-size を微縮小

#### 30. マイカツ君のセリフを吹き出し化（index.html のみ、dev `6446566` → main `210bdbf`）
- **背景**: セリフを「マイカツ君が話しかけている」見た目にして親しみを強化
- **[index.html](index.html)** のみ変更（view.html 対象外：保護者画面にはセリフ無し）:
  - 新レイアウト: `.mate-row`（flex-row） = `.mate-avatar`（画像 150px + 固定ラベル `.chara-name` 「マイカツ君」）+ `.chara-bubble`（flex:1、右配置）
  - 吹き出し: 白背景 / `2px solid #c8dcff` / 角丸 20px / 紺文字 `#2d3a8c` / 影 `0 3px 12px rgba(79,125,240,.15)`
  - しっぽ: `::before`（枠色 `#c8dcff`）+ `::after`（背景 `#fff`）の二枚重ねでボーダー付き三角形を実現（左中央、マイカツ君を指す）
  - モバイル（480px以下）: `.mate-row` を column に、しっぽを上向き三角に差し替え（枠色 bottom + 背景 bottom の二枚重ね）
- **JS 変更は無し**: 既存 `document.getElementById('chara-msg').textContent = ...` の id を維持したため、セリフ生成ロジックはそのまま動作
- **旧 `.chara-msg` クラス**: `.chara-bubble` に置き換え（class だけ差し替え、id は同じ）。`.chara-msg` CSS は使われなくなったが削除はしていない

#### 31. 保護者閲覧に学習履歴機能を追加（dev `52a7540` / `fb887ac` → main `a1d1563` / `48551e7`）
- **背景**: 保護者にとって最重要な「我が子の日別達成状況」を一元表示
- **[gas/Code.js](gas/Code.js) `getChildActivityRecent(params)`**:
  - params: `{ studentId, offset:0 }`。offset=0 → 昨日〜7日前、offset=1 → 8〜14日前...
  - HPLog / Attempts / SangoSubmissions の 3 シートを 1 回ずつスキャンして日別集約
  - HPLog 駆動で `login` / `eitango.done` / `sango.done` フラグ、Attempts 合格のみで `eitango.details`（級・セット番号）補完、SangoSubmissions で `sango.level` / `sango.timestamp` 補完
  - `hasMore` 判定は HPLog の古い行検出のみで簡易化（1 パス内で副産物取得、追加 I/O なし）
- **[view.html](view.html)**:
  - 「📅 お子様の学習履歴を見る」ボタンをステータス直下・ランキングの上に追加（紫グラデ `#a18cd1 → #fbc2eb`）
  - 新画面 `screen-child-history`（直近7日、offset=0 固定）/ `screen-child-history-archive`（ページング、offset≥1）
  - カード UI: 日付ヘッダー（`#fff7ed → #fef3f2` グラデ、`#b45309` 文字）+ ログイン ✅/❌（`#10b981`/`#b8b8b8`）+ 英単語RUSH（級ごとに `セット1・2 合格` 形式）+ 三語短文（レベル + 作品を見るボタン）
  - 注意書きバナー（`#fffbe6` 背景 + 黄左枠）「⚠️ 三語短文はアプリでの提出が4/20（月）の分からです」を両画面の上部に配置
  - `loadSangoHistory(targetTs)` を拡張: 各カードに `data-ts` 属性付与、render 後に target を `querySelector` で検索 → `scrollIntoView` + `.hl` クラスで 2.2 秒フェードアウトハイライト
  - `jumpToSangoSubmission(ts)` 関数: 画面遷移 + スクロールジャンプの一連フロー
  - モバイル（480px以下）でラベル幅・フォントサイズ縮小

#### 32. 和文英訳① Phase 1: データ基盤（dev `8d31e65` → main `4080ad2`）
- **シート新設**（ふくちさんが事前に手動作成済）:
  - `Wabun1Topics`（15列）: date / week_no / task1〜4 / answer1〜4 / skip1〜4 / word_list
  - `Wabun1Submissions`（6列）: timestamp / studentId / studentName / work / method / teacher_comment
- **[gas/Code.js](gas/Code.js)** に以下を追加（+460行）:
  - **定数**: `SHEET_WABUN1_TOPICS` / `SHEET_WABUN1_SUBMISSIONS`
  - **共通ヘルパー**:
    - `_WABUN1_DAY_OFFSET` （月=0 ... 日=6）
    - `_WABUN1_FW_DIGITS` （全角数字 → 半角マップ）
    - `_wabun1AddDays(startStr, n)` （JST 日付加算）
    - `_normalizeWabun1(s)` （case-insensitive + `\s+` 畳み、ピリオド/カンマは保持）
    - `_parseWabun1Work(text)` （番号区切りパーサ、正規表現 `/\n\s*(?:[(（]\s*([1-4１-４])\s*[)）]|([1-4１-４])\s*[.．])\s*/g` で半角/全角数字 + 半角/全角ピリオド + カッコ `(1)`/`（1）` 対応）
    - `_readWabun1TopicsByDate(dateStr)` （header.indexOf で列位置動的取得、task/answer/skip/word_list を構造化して返却）
  - **生徒用 3 関数**:
    - `getWabun1Topic(params)`: today（answers 非返却）+ yesterday（answers 含む）を返す。日付切替は朝3時境界（`_sangoToday()` / `_sangoPrevDate()` 流用）
    - `submitWabun1(params)`: 解答パース → 完全一致照合 → 全正解かつ当日初回のみ `hpGained = 100 × week²`（COL_STREAK ベース）。Wabun1Submissions には正誤問わず毎回 appendRow、HPLog は加算時のみ `type='wabun1'`
    - `getWabun1Submissions(params)`: 自分の提出履歴（timestamp 降順）
  - **管理用 4 関数**:
    - `adminAddWabun1TopicsWeek(params)`: 縦→横変換。items を `day` でバケット化し `問題1〜4` / `スキップ1〜4` / `単語` を処理。初版は answer を空文字で埋める
    - `adminSetWabun1AnswerWeek(params)`: 正解のみの週単位更新（後からの修正用に残置）
    - `adminListWabun1Submissions(params)`: date / studentId フィルタ、realName ルックアップ
    - `adminSetWabun1Comment(params)`: timestamp + studentId で行特定、6列目を更新
  - **doGet ルーティング**: 7行追加（getWabun1Topic / submitWabun1 / getWabun1Submissions / adminAddWabun1TopicsWeek / adminSetWabun1AnswerWeek / adminListWabun1Submissions / adminSetWabun1Comment）

#### 33. 和文英訳① Phase 2: 管理画面（dev `bed67cf` → main `1f7cd1a`）
- **運用方針変更（重要）**: Phase 1 の「問題登録と正解登録を別フォーム」から「問題＋正解を同時に1フォームで登録」に変更。アプリへの実装後は両方揃った状態で運用するため
- **[gas/Code.js](gas/Code.js) `adminAddWabun1TopicsWeek` 拡張**:
  - 曜日バケットに `answers: ['','','','']` を追加
  - `kind === '正解1'〜'正解4'` 分岐追加、行組み立て時 answer 4 列にマッピング
  - 正解 0〜4 件を許容（後からの追加登録対応）
- **[admin.html](admin.html)** に 2 タブ追加（`sango-submissions` の直後、`ranking` の前）:
  - **タブ 1「📝 和文英訳①」**:
    - 週開始日（月曜）+ TSV textarea + 週番号（任意）+ 一括登録ボタン
    - textarea 形式: `曜日 [TAB] 種別 [TAB] 内容` × N 行
    - 許容種別: 問題1〜4 / 正解1〜4 / スキップ1〜4 / 単語（計 13 種）
    - パーサ `parseWabun1Paste(text, startStr)`: `SANGO_DAY_MAP` 流用、4 列目以降はタブ再結合で内容内タブを保護、`day` は `charAt(0)` で GAS 側 `_WABUN1_DAY_OFFSET` と整合
    - プレビュー: 6 列サマリ表（日付 / 問題数 / 正解数 / スキップ数 / 単語数 / 問題1冒頭30字）。問題1未入力曜日は赤字警告
    - `submitWabun1Paste()` → `adminAddWabun1TopicsWeek` 呼び出し、成功時トースト + フォームクリア、認証エラー時は `doAdminLogout()`
  - **タブ 2「📋 和文英訳① 提出」**:
    - 日付 filter + 生徒ID filter + 絞り込み/更新ボタン
    - 提出カード: タイムスタンプ + 📷写真 + 生徒ID / ニックネーム（本名）/ OCR テキスト全文（`white-space: pre-wrap`）
    - 3 状態コメント UI（青=表示 / 橙=編集 / グレー=未コメント）を三語短文と完全同構造で実装（関数名 prefix を `wabun1` に変更、`_wabun1SubCache` / `editWabun1Comment` / `saveWabun1Comment` / `cancelWabun1CommentEdit`）
    - 認証エラー時は `doAdminLogout()`
- **動作確認**: 管理画面で TSV 貼り付け → プレビュー → 登録 → スプレッドシート反映まで確認済み

#### 34. 今日の環境・ワークフローメモ
- **塾PC で作業、これから自宅PC に移行予定**。両PCとも clasp 導入済みなので `git pull` + `clasp pull` で同期可能
- **運用開始予定**: 和文英訳① は 4/27（月）スタート。それまでに Phase 3（生徒・保護者画面）を完成させる
- **残タスク**:
  - Phase 3（生徒画面 + 保護者画面）: index.html / view.html の大規模改修（詳細は下記）
    - コンテンツカードに「小中学生用」表記 + 「中学生用」表記の追加 + HP バッジ
    - 和文英訳①のお題表示画面（今日の問題、前日の問題＋正解、固定表示内容、YouTube動画リンク）
    - 写真提出→ OCR（Vision API）→「これで良いですか？」確認→番号検出チェック→正解照合→結果表示（各タスク ✅/❌）→再提出ループ
    - 「正解を表示する」ボタン（1 回目送信後のみ表示、運用でカンニング防止）
    - モニョ記号の斜線パターンマスク化（仕様要確認）
    - 過去の提出作品画面、過去のお題と正解画面
    - 保護者画面に「和文英訳①の提出作品」画面、`getChildActivityRecent` に和文英訳①の項目追加（HPLog type='wabun1' で判定）
  - 問題データの用意（ふくちさん作業、1 週間分 = 4/27〜5/3）
  - 運用開始前の生徒・保護者への告知文作成
  - マニュアル v4 作成（和文英訳①実装完了後）

#### 35. 自宅PC へ移行 + Phase 3-A/3-B 着手
- 塾PC で #28-34 完了後、夜に自宅PC へ移行
- 自宅PC 側で `git pull` により塾PC 分（`ebc0b84` ログ / `bed67cf` wabun1 Phase 2 含む）を取り込み
- worktree `quizzical-clarke-f27056` を `claude/*` ブランチから `dev` に切替、古い dev worktree `interesting-engelbart-7d1057`（未コミット無し、9 コミット遅れ）を `git worktree remove` で整理

#### 36. 和文英訳① Phase 3-A：生徒画面の基本機能（dev `c1f3308` → main `6a5498d`）
- **index.html のみ変更（+407 / -4）**、Code.js は触らず
- **ホーム画面コンテンツカード改修**: `c-wabun1` を disabled 解除 → 「100HP/日」HP バッジ + 「小中学生用」副題（`.content-btn-sub` CSS 追加、英単語RUSH・三語短文には手を入れず wabun1 のみ）、`onclick` を `showWabun1Topic()` に差し替え
- **お題表示画面（`screen-wabun1-topic`）新設**:
  - 今日の日付ラベル（`yyyy年M月d日（曜）`）+ 黄色系警告バナー（問題番号を書いてね）
  - 【今日の問題】: `.wabun1-task-list` + `.wabun1-task` 構造で task1〜4 表示、スキップ条件は赤字（`.wabun1-task-skip`）、`[モニョ]` マーカーは `_wabun1RenderText` で CSS 斜線パターン `.monyo-mask`（`repeating-linear-gradient 45deg` + 幅 2.6em + `color:transparent` + `user-select:none`）に置換
  - 【単語リスト】: `word_list` 配列を箇条書き表示（`.wabun1-wordlist` + `.wabun1-wordlist-item`、緑系）
  - 📸 大きな紫グラデ写真提出ボタン → 隠し `<input type="file" accept="image/*" capture="environment">` をクリック起動
  - 「📚 過去の問題と正解」「📖 過去の提出作品」ボタン（Phase 3-A ではプレースホルダ画面に遷移するだけ）
  - 固定表示セクション: 「🔴注目！＜英語の名詞の使い方＞」解説カード（`.wabun1-fixed-tip`、黄色系）+ 励まし文（`.wabun1-fixed-encourage`）+ 「🔴解説動画🔴」2 本（日本語の並べかえ / モニョの法則）を `.wabun1-video-card` のサムネ風リンクボタンで `target="_blank" rel="noopener"` 表示
- **写真提出フロー**:
  - `onWabun1PhotoSelected` → 1200px リサイズ + 0.7 JPEG（三語短文の `onSangoPhotoSelected` を流用）→ `sendWabun1Photo` で Vision API DOCUMENT_TEXT_DETECTION
  - OCR 完了後、フロント側で番号チェック（`_wabun1CheckNumbers`）。GAS `_parseWabun1Work` と同一の正規表現 `/\n\s*(?:[(（]\s*([1-4１-４])\s*[)）]|([1-4１-４])\s*[.．])\s*/g` で半角/全角数字 1-4 + ピリオド + カッコ囲みを検出、不足番号を「⚠️ 問題番号（〇. 〇.）が見つかりませんでした」と具体表示で差し戻し
  - 番号揃ったら `screen-wabun1-confirm` へ遷移、OCR 全文プレビュー + 「✅ はい、これで提出」「📸 もう一度撮る」
  - 「💡 正解を表示する」ボタンは `_wabun1State.hasSubmitted` で制御（1 回目送信後から表示）、Phase 3-A ではスタブ表示（「Phase 3-B で拡張予定」）
- **結果画面（`screen-wabun1-result`）新設**:
  - 全問正解: `.wabun1-result-success` カード（黄金グラデ + `@keyframes wabun1-glow` 1.8 秒アニメ）+ 紙吹雪 8 絵文字（`.wabun1-confetti` + `@keyframes wabun1-confetti-fall`、位置/delay ランダム、overflow:hidden）+ HP 数字カウントアップ（`_wabun1AnimateHp`、1 秒 ease-out、`requestAnimationFrame`）+ `playSfx('chime')`。既に当日 HP 獲得済みなら「本日のHPは既に獲得済みです」の簡易版表示
  - 部分不正解: `.wabun1-result-partial` カード + タスク別 ✅/❌ 一覧 + 不正解タスク番号の明示 + 「正解を表示」「もう一度撮影」ボタン
- **音源（chime.mp3）**: main 側で upload 済みの `chime.mp3`（50,053 bytes）を `git merge origin/main` で dev に取り込み、`SFX` オブジェクトに登録（`chime` のみ volume 0.9、他は既存 0.8 維持）、iOS Safari unlock も既存の仕組みで自動対応
- **Phase 3-A 時点の制約**: 「正解を表示する」は GAS 側の新 API `getWabun1AnswersAfterSubmit` 未実装のためスタブ表示（Phase 3-B で中身を差し替え、state/ボタン表示ロジックは維持）

#### 37. 和文英訳① Phase 3-B：過去画面 + 正解表示 API（dev `bdbb827` → main `deb3748`）
- **運用ポリシー**: 「一度解いた問題の正解はいつでも見られる」。submitWabun1 のレスポンスに含めるだけではリロード/再ログイン後に見られなくなるため、新 API で「提出記録があれば」いつでも取得可能な設計
- **[gas/Code.js](gas/Code.js)**（+166 行）:
  - 共通ヘルパー追加:
    - `_wabun1LogDate(ts)`: JST 3 時切替基準（`submitWabun1` の `alreadyGranted` と同一ロジック、`setHours(-3)` → `yyyy-MM-dd`）で timestamp から日付文字列を抽出
    - `_wabun1SubmittedDatesBySid(sid)`: 指定 studentId が提出した日付の Set を返す（Wabun1Submissions を 1 回スキャン）
    - `_readWabun1TopicsByDateRange(startStr, endStr)`: Wabun1Topics を 1 回スキャン、各行を tasks/answers/word_list 構造に整形（`_readWabun1TopicsByDate` と同じロジックの範囲版）
    - `_buildWabun1TopicsByDate(rows)`: 日付降順 + 曜日付与でレスポンス形状に整形（`_SANGO_WEEKDAYS_JP` 流用）
  - 新 API 3 本:
    - `getWabun1AnswersAfterSubmit(params)`: 今日の提出ログが submittedSet にあれば `_readWabun1TopicsByDate(today).answers` を返却、なければ `{ok:false, error:'まだ今日の問題を提出していないため...'}`
    - `getWabun1PastTopicsRecent(params)`: 昨日〜7 日前、submittedSet に含まれる日付のみ返却（運用ポリシー「この生徒が提出した日のみ表示」）
    - `getWabun1PastTopicsPaged(params)`: `weekOffset` 指定で 1 週単位ページング、次週の submittedSet 内件数で `hasMore` 判定（空ページ + 次ページあり状態も許容、三語短文と同挙動）
  - `doGet` ルーティング 3 行追加（`getWabun1Submissions` 分岐の直後）
- **[index.html](index.html)**（+199 / -21）:
  - Phase 3-A プレースホルダ 2 画面を動的コンテナ化: `screen-wabun1-past`（`#wabun1-past-body` + 「📜 さらに過去のもの」ボタン）/ `screen-wabun1-history`（`#wabun1-history-list`）
  - 新画面: `screen-wabun1-archive`（`#wabun1-archive-body` + `#wabun1-archive-pager` + `#wabun1-archive-label`、三語短文の `screen-sango-archive` と同構造）
  - CSS 追加: `.wabun1-past-date-header`（紫グラデ、豪華版）/ `.wabun1-past-pager` / `.wabun1-answer-line`（緑左枠で正解表示）/ `.wabun1-archive-date-header`（薄紫、コンパクト版）/ `.wabun1-archive-card` / `.wabun1-archive-task*` / `.wabun1-archive-answer` / `.wabun1-archive-wordlist` / `.wabun1-sub-card` / `.wabun1-sub-*`（提出履歴カード）
  - `showWabun1Answers()` 差し替え: スタブ → `gasGet({action:'getWabun1AnswersAfterSubmit'})` 呼び出し。成功時は `_wabun1State.topic.tasks` をベースに番号付きで `answers[]` を描画（topic が null の場合は answers 配列の順序で描画）。失敗時はモーダル内にエラー文言表示。`hasSubmitted` によるボタン表示判定は Phase 3-A のまま維持、モーダルは複数回開閉可能
  - `showWabun1Past()`: `getWabun1PastTopicsRecent` を呼び、`_renderWabun1PastDateBlock` で日付ごとに問題一覧 + 各問題直下の「正解：〜」行 + 単語リストを豪華カードで描画。ゼロ件時は「まだ提出した問題がありません。まずは今日の問題に挑戦してみよう！」
  - `showWabun1Archive(weekOffset)`: `_wabun1ArchiveWeek` を更新して `getWabun1PastTopicsPaged` を呼び、コンパクトカード版 `_renderWabun1ArchiveDateBlock` で描画。ページャは三語短文と同パターン（← 新しい1週間へ / 次のページ（さらに古い1週間へ） →）
  - `showWabun1History()`: 既存 `getWabun1Submissions` 流用 → タイムスタンプ + 提出方法ラベル（📷 写真 / ✏️ 直接入力）+ OCR テキスト（`white-space:pre-wrap`）+ 先生コメント（青系ボックス、`teacher_comment` が非空時のみ）
  - モニョマスクは Phase 3-A の `_wabun1RenderText(raw)` をそのまま再利用（問題文のみ、正解文には適用しない）
- **clasp push 反映済み**、GAS 新バージョンデプロイ完了。UI レベルの表示確認のみ済、実機での写真撮影〜提出〜過去画面までの一連フローは明日 4/23 塾 PC で確認予定

#### 38. 今日の残タスクと明日以降の予定
- **明日 4/23 塾 PC**:
  - Phase 3-A / 3-B の実機動作確認（写真撮影 → OCR → 番号チェック → 正解照合 → 結果表示 → HP 獲得エフェクト → chime.mp3 → 過去画面 → 「正解を表示する」ボタン）
  - Phase 3-C 着手予定: 保護者画面の和文英訳①対応（`view.html` の提出作品画面、`getChildActivityRecent` に和文英訳①項目追加。HPLog `type='wabun1'` で判定）
  - Phase 3-C: 三語短文の提出成功時に Phase 3-A と同じエフェクト（紙吹雪 + カウントアップ + chime.mp3）を追加
- **4/26 土**: テスト動作確認 + バグ修正日
- **4/27 月**: 本番運用開始
- **その他**: 問題データの用意（ふくちさん作業、4/27〜5/3 の 1 週間分）、運用開始前の告知文、マニュアル v4 作成（TOC 付き、呼称は「マイ活アプリ（旧：マイ活アプリ＜英単語＞）」）

### 2026-04-23

#### 39. 塾PC 移行時の worktree 整理
- 前日（自宅PC）分が `origin/dev` に push 済み（22 コミット：#35-38）。塾PC ローカルは未取得だった
- 旧 dev worktree `tender-payne-6a1afc`（塾PC で作成、未コミット無し / origin/dev より 22 遅れ）を `git worktree remove` で削除
- 現セッション worktree `elated-swartz-2ed7dc` を `git switch dev` で dev に切替、`git pull --ff-only origin dev` で 22 コミット fast-forward
- 以降の作業はこの worktree（dev ブランチ直）で継続。塾PC 側では他に `claude/*` ローカルブランチ無し（整理済み）

#### 40. iPad 再撮影バグ修正: retakeWabun1PhotoFromResult 新設（dev `a934a2b` → main `addab15`）
- **事象**: iPad で結果画面「📸 もう一度撮影する」→ 撮影はできるが OCR 処理が走らず確認画面に進まない
- **原因**: iOS Safari で display:none 配下の file input `click()` は camera を開くが **onchange が届かない**既知挙動。`<input id="wabun1-photo-input">` は `screen-wabun1-topic` 内に配置されており、結果画面表示時は親 screen が display:none の状態
- **修正** ([index.html](index.html)): `retakeWabun1PhotoFromResult()` 新関数を追加。`_wabun1State.ocrText=''` / `input.value=''` / preview クリア / `showScreen('screen-wabun1-topic')` で file input を**表示中 screen に戻してから** `setTimeout 50ms` で click。結果画面のボタン onclick を差し替え
- 既存 `retakeWabun1Photo()`（確認画面用）は触らず影響範囲最小化。`hasSubmitted` は残して「正解を表示する」ボタン表示状態を維持

#### 41. 和文英訳① UI 改修 4 件（dev `fa5b7c4` → main `addab15`）
- **番号認識 regex の寛容度拡張** ([index.html](index.html) `_wabun1CheckNumbers`): 数字の後ろに `.` `．` `,` `、` `)` `）` スペース 改行 のいずれかでも認識（lookahead）。Android OCR で全角ピリオドが欠ける / 改行が入るケースに対応
- **「過去の提出作品」機能削除**: ボタン / `screen-wabun1-history` / `showWabun1History()` / 未使用 CSS (`.wabun1-sub-*` 6 件) を一括削除。GAS `getWabun1Submissions` は管理画面で引き続き利用するため温存（理由：和文英訳①は「正解と同じ英文」を書くコンテンツなので、自分の解答を見返す意味が薄い）
- **「お題」→「問題」表記統一**（wabun1 のみ）: 「← お題画面に戻る」× 4 を「← 問題画面に戻る」に変更。三語短文の「お題」表記は据え置き（創作コンテンツなので「お題」が適切）
- **重要メッセージ強調ボックス化**: `.wabun1-fixed-encourage` を暖色ボックス化（背景 `#fff5e6` / border `2px solid #fb923c` / 太字 / padding 広め / 微シャドウ）。本文に `<br><br>` で段落区切り追加

#### 42. 【重大バグ修正】フロント/GAS の番号パーサ regex 完全統一（dev `9fbaf89` → main `4a36fd6`）
- **事象**: 再撮影後、画面に表示される OCR 結果は正しく更新されているのに、送信すると「正解と同じ英文のはず」が不正解判定される
- **真因**: #41 でフロント regex を loose 版にしたが、GAS `_parseWabun1Work` は古い厳格版（`.` または `．` または `()` 必須）のまま。フロントで番号チェックが通っても GAS 側で番号マーカーを検出できず `parsed[n] = ''` となり「空文字 vs 正解」で必ず不正解判定
  - 典型ケース: OCR が `3\nThis is test three.` のように 3 の後に改行を入れる（Android 多発）→ GAS 側は `3.` や `3,` を要求するのでマッチせず
- **修正 (unified regex)**:
  ```js
  /\n\s*(?:[(（]\s*([1-4１-４])\s*[)）]|([1-4１-４])(?:[.．,、)）]|(?=\s)))\s*/g
  ```
  - `1.` `1．` `1,` `1、` `1)` `1）` → 消費型
  - `1 ` `1\n` → `(?=\s)` 先読み + 後続 `\s*` で空白/改行を消費
  - フロント `_wabun1CheckNumbers` ([index.html](index.html)) / GAS `_parseWabun1Work` ([gas/Code.js](gas/Code.js)) の両方に **同じ regex** を適用 → 乖離を解消
- **副次対応**: [index.html](index.html) `submitWabun1Answer` の直前で `console.log` を追加。画面表示テキストと `_wabun1State.ocrText` の一致確認用（将来の切り分け用）
- **教訓**: フロント/GAS で同等の regex を持たせる場合、**どちらか一方の更新時に他方も必ず同期する**。別ファイル・別言語で二重管理になっていた設計を反省

#### 43. UI 追加改修 2 件（dev `9fbaf89` → main `4a36fd6`）
- **番号差し戻しメッセージの位置変更**: `#wabun1-camera-msg` を `#wabun1-photo-preview` の**上**に配置入れ替え（従来は下で生徒が気付きにくかった）
- **強調メッセージのフォントサイズ**: `.wabun1-fixed-encourage` の `font-size` を 16px → 18px（`.btn-wide` と統一）

#### 44. 和文英訳① Phase 3-C 完了（dev `e6f5d15` → main `38aa36b`）
- **[gas/Code.js](gas/Code.js) `getChildActivityRecent` 拡張**: `byDate` に `wabun1: { done:false, hpGained:0 }` を追加、HPLog ループに `type === 'wabun1'` 分岐を追加して `hpGained` を集計
- **[view.html](view.html) `_renderChildDays` 拡張**: 三語短文行の直下に和文英訳①行を追加。提出日 → `✅ 全問正解（XHP獲得）`、未提出日 → `❌`（作品を見るボタンなし = #41 で過去の提出作品機能を削除した方針と整合）
- **[index.html](index.html) 三語短文 HP エフェクト追加**:
  - 新 `screen-sango-done`（`screen-sango-photo` 直後）
  - 新関数 `_showSangoDone(hp, alreadyGranted)`: wabun1 の CSS（`.wabun1-result-success` / `.wabun1-confetti` / `.wabun1-result-hp-num` / `.wabun1-result-already`）と `_wabun1AnimateHp` / `playSfx('chime')` を流用
  - `submitSangoText` / `confirmSangoPhoto(true)` の成功時 showMsg+setTimeout を `_showSangoDone(hp, hp === 0)` に置換
  - `alreadyGranted` 判定は GAS の `hpGained === 0` 仕様を proxy として活用（GAS 側変更不要）
  - 対象: 全レベル（A/S/B/T）× 全提出方法（text/photo）

#### 45. 本日の動作確認結果と次フェーズ予定
- **動作確認結果**（iPad / Android 両方、本番 URL）:
  - 和文英訳①: 写真撮影 → OCR → 番号チェック → 正解照合 → 全問正解 → 紙吹雪 + HP カウントアップ + chime.mp3 / 不正解時再撮影 / 正解表示ボタン / 過去の問題と正解 / アーカイブページング — 全フロー正常
  - 三語短文 HP 獲得エフェクト: 正常動作
  - 保護者画面の学習履歴に和文英訳①行: 期待通り表示
  - **和文英訳①の実装は完了**
- **worktree / branch 整理**: ステールローカルブランチ `claude/elated-swartz-2ed7dc`（#39 で dev に切替済のため用途なし、main にマージ済でユニークコミットなし）を `git branch -d` で削除
- **残タスク**:
  - 問題データ用意（4/27〜5/3 の 1 週間分、ふくちさん作業）
  - 4/26（土）全体動作確認 + 必要ならバグ修正
  - 4/27（月）本番運用開始
  - 生徒・保護者への告知文作成（クロと一緒に作成予定）
  - マニュアル v4 作成（生徒 + 保護者向け、TOC 付き、「マイ活アプリ（旧：マイ活アプリ＜英単語＞）」呼称。和文英訳①完了に伴い着手可能）
- **将来タスク（メモ）**: 週間HPランキングの 3 カテゴリ分割（小中高別） / 英単語RUSH 英検 5 級の書き取り採点詳細化（生徒要望、どこが間違いかの可視化） / アバター機能（Gemini API 連携、1-2 日規模）
- **環境情報**: 塾PC での作業完了 → 自宅PC に移行予定

#### 46. 自宅PC 移行 + 和文英訳① 問題表示画面の固定表示エリア改修（dev `c173e17` → main `f148bca`）
- **worktree 整理**: 塾PC 側の stale worktree `quizzical-clarke-f27056`（dev 追従、origin/dev より 6 遅れ / 未コミット無し）を `git worktree remove` で削除。stale branch `claude/quizzical-clarke-f27056` / `claude/competent-ellis-ffdf72` も `git branch -d`。現 worktree `competent-ellis-ffdf72` を dev に切替、`git pull --ff-only` で #40-45 分 (塾PC 作業) を取り込み
- **背景・目的**: 「採点は完全一致のみ⭕」という運用ポリシーを生徒に事前に明示し、かつ「注目！英語の名詞の使い方」の視認性を改善して学習効果を上げる
- **[index.html](index.html) 変更点**:
  - 新規 CSS: `.wabun1-fixed-grading`（パープル系：背景 `#F3E5F5` / 枠 `2px solid #9C27B0` / 見出し `#6A1B9A`、段落 `<p>` 区切り）/ `.wabun1-keyphrase`（青太字 `#1565C0`）/ `.wabun1-example-bad`（赤 `#D32F2F` + monospace + インデント）/ `.wabun1-example-good`（緑 `#388E3C` + monospace + インデント）
  - 既存 `.wabun1-fixed-tip` を黄系 → 青系に差し替え（背景 `#E3F2FD` / 枠 `2px solid #1976D2` / 本文 14px）。赤見出しはボックス内上部に維持
  - 注目ボックス本文を HTML 構造化: キーフレーズ3箇所（「数えられる名詞の単数形」「a (an) を付ける」「複数形にする」）を `<span class="wabun1-keyphrase">` で青太字、例文を ❌赤 / ⭕緑 の monospace + インデント `div` に分離
  - 新規「📝 採点について」パープル系ボックスを注目ボックスと「毎日地道にコツコツと」の間に追加。3 段落構成（採点方針 / 厳しくする理由 / 励まし）
- **固定表示エリアの最終順序**: ① 🔴 注目！ 英語の名詞の使い方（青系）→ ② 📝 採点について（パープル系・新規）→ ③ 💍 毎日地道にコツコツと（温かい色）→ ④ 🔴 解説動画🔴（YouTube × 2）

#### 47. 和文英訳① 英文例の視認性強化（2段階、dev `a411da4` / `f6a4a35` → main `0dcfab9` / `f1742bb`）
- **背景**: 注目ボックス内の `❌ I have pen.` などの英文例が、スマホで monospace の線が細く視認性が悪い。生徒テストで「見えない」フィードバック
- **第1段階 (`a411da4`)**: `.wabun1-example-bad` / `.wabun1-example-good` に `font-weight:bold` + `font-size:1.1em` + `line-height:1.8` を追加。monospace は維持（「英文の正解例」という視覚的アイコン性を保つ）
- **第2段階 (`f6a4a35`)**: 1段階目でも細く見えたため更に強化。`font-weight` 700 → 900 / `font-size` 1.1em → 1.2em / `-webkit-text-stroke:0.5px currentColor` で ❌赤・⭕緑それぞれの色で輪郭強調を追加。monospace 維持

#### 48. ふくちさん向け Excel 問題データテンプレート提供
- **目的**: 4/27〜5/3 の本番運用開始にあたり、ふくちさんが Wabun1Topics へ投入するための週単位テンプレートを整備
- **ファイル**: `和文英訳①_問題データテンプレート.xlsx`（リポジトリには含めないローカル資料）
- **構成**: 月〜日の 7 日分。月〜木・土・日は 3 問パターン、金曜のみ 4 問パターン + モニョ記号入力例。使い方メモシート付き。4/20 の週の実データをサンプルに埋め込み、管理画面の TSV パース形式とそのまま整合
- **告知文**: 生徒・保護者向けの本番開始告知はふくちさん自身で作成済（クロの関与なし）

#### 49. 運用方針の更新と次コンテンツ計画
- **マニュアル v4 の作成タイミング変更**: 和文英訳①完了直後ではなく、**全コンテンツ実装完了後にまとめて作成**する方針に変更（細切れ改版のコストを回避）
- **次コンテンツ = 基礎計算** に決定
- **既存計画の訂正**:
  - 「英語長文読解」＋「英語長文音読」は **「英語長文リスニング＆音読」** に統合（1 コンテンツ扱い）
  - 「古文読解」は予定なし（過去の作業ログで誤って追加されていたため訂正）
  - 「和文英訳②」は実装が複雑になるため **最後に着手**
- **4/27 本番運用までの残タスク**:
  - ふくちさんが 4/27〜5/3 の問題データ作成（提供テンプレ使用）
  - 4/26（土）全体動作確認 + 必要ならバグ修正
  - 4/27（月）本番運用開始

### 2026-04-24

塾PC で作業。大規模リファクタリング 2 件（管理画面ダッシュボード化 / GAS パフォーマンス改善）+ UI 改修数件。

#### 50. 塾PC 移行と環境整理（朝）
- 塾PC に残っていた旧 worktree `tender-payne-6a1afc`（dev、22 コミット遅れ / 未コミット無し）を `git worktree remove` で削除
- 現セッション worktree `cranky-hertz-2afec9` を dev に切替 → `git pull --ff-only origin dev` で 22 コミット fast-forward 取り込み（#46-49 分）
- stale ローカルブランチも整理済み

#### 51. 英単語RUSH 英検5級 書き取り採点の詳細フィードバック実装（dev `e88810a` → main `1c6300d`）
- **背景**: 生徒から「どこで間違えたか分からない」要望。従来は「以下の単語が3回書かれていないか読み取れませんでした：apple、cat、dog」の一行表示のみ
- **調査結果**: 単語ごとの正誤判定は既に `failedWords` 内に存在、**表示していないだけ** → 表示追加で済む改修（ロジック新規作成不要）
- **[index.html](index.html) 変更点** (+52 / -3):
  - `failedWords` を `string[]` → `{word, count}[]` オブジェクト配列化（[index.html:1297](index.html:1297)）。既存の `.length === 0` 合格判定は配列要素数比較なので影響なし
  - 新関数 `_renderPhotoFail(failedWords, rawText, confPct)` ([index.html:1303](index.html:1303)): 失敗単語リスト（`❌ apple（認識：2/3回）` 形式の独立行）+ OCR 全文ボックス（monospace / max-height: 280px / scroll）+ ヒント文言（黄アクセント）を構造化 HTML で innerHTML 投入
  - CSS +14 クラス（`.dictation-fail-*` / `.dictation-ocr-*` / `.dictation-hint*`）。既存パレット（`.ng=#c00`、`.ok=#007a3d`）に揃えた配色
  - XSS 安全：OCR 全文を innerHTML に入れる前に `escH()` で HTML エスケープ
- **影響範囲**: **単語不足エラー時の表示のみ**。合格時 / OCR失敗 / 字が雑い時 / エラー時は従来の `showMsg` のまま変更なし

#### 52. iPad Safari のキャッシュ問題調査と判明（#51 動作確認中）
- **事象**: 実機テストで改修 UI が表示されず、旧 UI（カンマ区切り 1 行）が出続ける
- **調査結果**: コード・GitHub Pages 配信とも完全に正常（curl で新コード 8 か所ヒット確認）。**iPad Safari の disk キャッシュが古い HTML を返していた**ことが確定
  - 決定的証拠：ユーザーが見ていた「apple、cat、dog」（読点区切り 1 行）形式は**新コードでは絶対に生成されない**（新コードは独立行のため）
- **暫定対処**: `?v=20260423` を URL に付与して cache bust → 新 UI 表示確認 OK
- **再発防止策**: #54 で恒久対策を実装

#### 53. 管理画面の大規模リファクタリング：ダッシュボード構造化（dev `3405fd9` → main `113955e`）
- **背景**: ログイン後に 7 タブが並ぶ構造を、先生の動線を明確にするため 3 モードに整理
- **新構成**: ダッシュボード（3 カード）→ 各モード画面の階層構造
  - 👥 生徒の実施状況（新規：Students 一覧 → 学習履歴ドリルダウン）
  - 📝 問題等の入力と解答確認（既存 6 タブを包含、ランキング除外）
  - 🏆 週間HPランキング（タブから独立画面へ）
- **[admin.html](admin.html) +425 / -39**:
  - 新 HTML 5 画面: `screen-admin-dashboard` / `screen-admin-students` / `screen-admin-child-history` / `screen-admin-child-archive` / `screen-admin-ranking`
  - 既存 `screen-admin-main` → `screen-admin-tabs` に改名（タブ UI 構造は不変）
  - 新 CSS: `.dashboard-*` 5 クラス + `.header-btns`（480px 以下でログアウトをアイコンのみに縮小）+ `.admin-page` / `.students-table-*` / `.child-*`（[view.html](view.html) から移植 13 クラス）
  - 新 JS: `goAdminDashboard()` / `goAdminTabs()`（`_adminTabsBuilt` で 1 回だけ構築）/ `goAdminRanking()` / `goAdminStudents()` / `goAdminChildHistory()` / `goAdminChildArchive()` / `loadStudents()` / `selectStudent()` / `_renderAdminChildDays()` / `loadAdminChildHistory()` / `loadAdminChildArchive()` / `adminChildArchivePrev/Next()`
  - ログイン成功後 → `screen-admin-dashboard` に遷移、ランキングモジュール登録削除
  - 学習履歴タイトル：「📅 〇〇さんの学習履歴」（氏名ベース、管理画面では「作品を見る」ボタンは削除＝既存タブと重複のため）
- **[gas/Code.js](gas/Code.js)**:
  - `doGet` に `adminListStudents` ルーティング追加
  - `adminListStudents(params)` 関数追加（認証必須、ID 空欄行スキップ、シート入力順で返却）
  - `getChildActivityRecent` は既存実装を流用（認証不要、studentId 指定で動く）
- **レスポンシブ**: 480px 以下でログアウトはアイコン（🚪）のみ、テキスト非表示

#### 54. キャッシュ対策：no-cache メタタグ + 自動バージョン表示（dev `c18ee3c` / `1ad05c7` → main `451cbe4` / `8c465f0`）
- **背景**: #52 の iPad キャッシュ問題の再発防止策
- **実装 1（3 ファイル共通）**: no-cache 系メタタグ 3 行を `<head>` に追加
  ```html
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  ```
- **実装 2（3 ファイル共通）**: 右下固定のバージョンバッジ
  - **`document.lastModified` から自動生成**（手動更新不要）。GH Pages の Last-Modified ヘッダー由来で、HTML が実際にどの時点のバージョンかを反映 → iPad で古いキャッシュが使われていれば日付が古く見える＝**キャッシュ診断としても機能**
  - 表示形式：`vYYYY.MM.DD`、10px・`#999`・半透明白背景・角丸 4px
  - **タップで `?v=Date.now()` 付き強制リロード**（キャッシュバイパス）
- **実装 3（微調整）**: 当初右下配置 → 「⚠️ 戻るボタンは押さないでね」と重なるため**左下に移動**（3 ファイルとも `right:10px` → `left:10px`）
- **CLAUDE.md**: 「バージョン表示は自動生成のため手動更新不要」を運用メモに追記

#### 55. GAS パフォーマンス調査と改善 Day 1 実装（dev `24c0f6d`）
- **背景**: 「全画面で遅い、最近特に遅くなった」の体感報告。運用で増えるシート（HPLog / Attempts / SangoSubmissions）を全件走査する関数が原因と推測
- **静的コード解析**: 84 関数、`getDataRange()` 43 箇所、`CacheService` 使用 0、Top 5 ボトルネック特定（B1: getChildActivityRecent / B2: loginStudent→_getPrevDayCount / B3: getTodaysSet + _getMaxSetForLevel / B4: submitWabun1/submitSango / B5: getSangoTopic）
- **推奨順 4→2→3→1 で実装**:
  - **改善 4**: 重複関数削除（`getQuote` L833 先勝ち版 / `getExchangeStatus` L731 先勝ち版。後勝ちで死んだコードだった）
  - **改善 2**: 末尾 N 行読みヘルパー `_readLastNRows(sh, n)` 追加 + 3 関数適用（`getChildActivityRecent`: HPLog 2000/Attempts 1000/SangoSubmissions 500 / `submitWabun1` / `submitSango`: HPLog 200）
  - **改善 3**: `_getPrevDayCount` を末尾 200 行読みに変更（`loginStudent` ボトルネック解消）
  - **改善 1**: `CacheService` 導入（TTL 6 時間）
    - Questions シートを**レベル別分割キャッシュ**（`cache_q_rows_<level>`、100KB 上限対応）。初回 cache miss 時に全件読み → 全レベルを一括保存 → 以降 cache hit。95KB 超は警告ログ + フォールバック
    - Q5 / SangoTopics / Wabun1Topics / Quote / Notice / 週間HPランキングも同様にキャッシュ化
    - **自動 invalidation**: 管理画面書き込み系 7 関数（adminAddQuote / adminAddNotice / adminAddSangoTopic / adminAddSangoTopicsWeek / adminSetSangoTeacherWork / adminAddWabun1TopicsWeek / adminSetWabun1AnswerWeek）+ HP 付与系 3 関数（saveAttempt / submitSango / submitWabun1）で対応キャッシュをクリア
    - 手動全クリア用 `clearAllCache()` 関数追加（Questions シート直接編集時の即反映用、GAS エディタから実行）
  - **CLAUDE.md**: Script Cache 運用メモを追記
- **静的指標変化**: `getDataRange()` 43 → 31、`CacheService` 使用 0 → 多数
- **期待効果**: ログイン 3〜5s → 0.8〜1.5s、問題表示 2〜4s → 0.5〜1s、学習履歴 1.5〜3s → 0.3〜0.6s。**体感 3 倍高速化見込み**
- **自宅PCに引継ぎ**: clasp push → GAS 新バージョンデプロイ → 実機動作確認の順

#### 56. 残タスクメモ（自宅PC 以降）
- **直近**: `cd gas && clasp push` → GAS デプロイ → 実機で各処理の速度確認
- **Day 1 動作確認観点**:
  - ログインの体感速度（特に 2 回目以降の cache hit 時）
  - 各コンテンツ（英単語RUSH / 三語短文 / 和文英訳①）の問題表示速度
  - 提出処理の速度
  - 学習履歴の表示速度（管理画面・保護者画面とも）
  - 管理画面で書き込み → 生徒画面で即反映（invalidation 動作確認）
- **問題があれば対応、なければ Day 2（優先度中）の改善検討**
  - 改善 5：`getSangoTopic` を 1 回読みに統合
  - 改善 6：`_getMaxSetForLevel` の二重読み排除（Day 1 で改善 1c により実質解消済み）
  - 改善 7：`appendRow → setValues` 化 + `_logHP` バッファリング
  - 改善 8：Students 行番号マップのキャッシュ
- **その他の保留タスク**:
  - 「タップで拡大バグ」の調査・修正
  - 管理画面の動作確認
  - 基礎計算コンテンツの企画・実装（ユーザー指示で着手予定）

#### 57. 自宅PC移行時の `clasp pull` 事故と修復（朝の作業）
- **事象**: 塾PC→自宅PC 切替時、GAS エディタでの新バージョンデプロイを忘れたまま `clasp pull` した結果、**Day 1 未デプロイの古い GAS コードがローカルに降ってきて main worktree の `gas/Code.js` が Day 1 適用前の状態に戻る事故**が発生
- **検出**: Claude Code が `git status` で main worktree 側に「Day 1 revert 方向の大きな未コミット差分」を発見し、クラスパ pull 事故と推測
- **修復手順**（ユーザー実施）:
  1. main worktree で `git checkout -- gas/Code.js` で未コミット差分を破棄
  2. dev（Stage 1 コミット + CLAUDE.md 運用ルール追記を含む）を main に `--no-ff` マージ
  3. `git pull origin main`
  4. `clasp push` で Day 1 + Stage 1 を一気に GAS へ反映
  5. GAS エディタで新バージョンをデプロイ
- **再発防止ルール追記**（CLAUDE.md 運用メモ）: **`clasp pull` は使用しない**。GAS への変更は常に `clasp push` で一方通行。手元の `gas/Code.js` を最新に保ち、それを GAS に反映する運用とする。GAS エディタで直接編集した場合は `gas/Code.js` にも同じ変更を入れてから push する

#### 58. GAS パフォーマンス改善 Day 2 Stage 1: キャッシュ診断ログ（dev `4111958` / `0b3d923` → main `e1616fd`）
- **目的**: Day 1 のキャッシュが実際に機能しているか可視化（Day 2 改善の invalidation 漏れリスク検知用）
- **[gas/Code.js](gas/Code.js) 実装**:
  - `_cacheLog(key, kind, extra)` ヘルパーを追加。`kind` は `'hit' / 'miss' / 'invalidate' / 'update'`
  - `DEBUG_CACHE` プロパティが `'1'` の時のみ `console.log` 出力。本番時は near-zero cost
  - `_debugCacheFlag` で 1 リクエストあたり PropertiesService 読み取りを 1 回に抑制
  - `_getCachedValues` / `_invalidateCache` / `_invalidateCacheAll` を計装
  - `getWeeklyRanking` / `_getQuestionRowsForLevel` の raw cache 呼び出しも計装
  - `enableDebugCache()` / `disableDebugCache()` を追加（GAS エディタ関数ドロップダウンから実行してトグル可能）

#### 59. Day 1 + Stage 1 動作確認（実測 + 分析）
- **計測環境**: GAS Executions 一覧の実行時間列から分布を観察
- **実測（バージョン77）**:
  - 0.5〜0.9 秒で終わる処理: 6〜7 件（キャッシュヒット系の読み取り）
  - 2〜4 秒かかる処理: 6〜7 件（書き込み系、Students 全件読み含む）
  - 最長: 4.363 秒 / 4.232 秒（loginStudent 系と推測）
- **体感**: ログイン 1 回目は少し速い / 2 回目は確実に速い / コンテンツ表示はほぼ変化なし
- **分析結論**: Day 1 は読み取り系に効いたが、**書き込み系（ログイン / 提出）が Students 全件読みで 2〜4 秒残る**。事前分析「Day 1 は書き込み系を改善できていない」が実測で裏付けられた
- **制約**: GAS エディタ UI 上で個別実行の詳細ログ（cache HIT/MISS 分布）が開けず、分布の直接確認は未達。実測時間の分布からキャッシュは部分的に効いていると判断。UI 制約の代替手段は後日検討

#### 60. GAS パフォーマンス改善 Day 2 Stage 2: Students キャッシュ + setValues 一括化（dev `e6d8398` → main `ffe8624`）
- **背景**: #59 の実測で書き込み系ボトルネック（Students 全件読み ~300ms × 毎回 + 複数回 setValue ~800ms）が確定
- **G1: Students シート全体キャッシュ**（[gas/Code.js](gas/Code.js) +131/-51 行）
  - `_getStudentsValues()` ヘルパーを追加（TTL 6h）
  - `_updateStudentsCacheRow(rowIdx, updates)` で in-place 更新
    - 書き込み後も次回読みが cache hit を維持できる（単純 invalidate 方式より高速）
    - 例外時 / 95KB 超過時は自動で invalidate にフォールバック
  - 対象 12 関数を `sheet.getDataRange().getValues()` → `_getStudentsValues()` に置換
    - `loginStudent` / `saveNickname` / `saveAttempt` / `getWeeklyRanking` / `submitExchange` / `getExchangeStatus` / `adminListStudents` / `getStudentView` / `submitSango` / `adminListSangoSubmissions` / `submitWabun1` / `adminListWabun1Submissions`
- **G2: setValues で 5 列一括書き込み**
  - `loginStudent`: UPDATED(4)〜LAST_LOGIN(8) の 5 列を 1 回 setValues（LAST_TEST(7) は保持）→ 4 回 setValue から 1 回に
  - `saveAttempt`: CLEARED(3)〜LAST_TEST(7) の 5 列を 1 回 setValues（STREAK(6) は保持）→ 最大 4 回 setValue から 1 回に
  - submitSango / submitWabun1 は HP 単発書き込みのため setValue 維持、in-place cache update のみ追加
- **診断ログ拡張**: `_cacheLog` に `'update'` kind を追加（in-place 更新を `[cache UPD]` で可視化）
- **`clearAllCache`** のキーリストに `cache_students_values` を追加
- **期待効果（warm 状態）**: loginStudent 1400→250-500ms、saveAttempt 1900→500-900ms、submit 系 1900→700-1100ms

#### 61. Stage 2 動作確認 → ホーム画面 HP 表示バグ発見
- **体感速度**: 劇的ではないが許容範囲。書き込み系が確実に軽くなった感触
- **発見したバグ**: テスト合格 / 三語短文提出 / 和文英訳①提出 いずれも、結果画面では正しい新 HP を表示するが、**ホーム画面に戻ると welcome-hp がログイン時の値のまま**
- **Claude Code 調査結果**: **Stage 2 のリグレッションではなく pre-existing のフロントエンド表示バグ**
  - 根拠: Stage 2 の変更範囲は `gas/Code.js` のみ（`git log --oneline -5 -- index.html` で確認）
  - `welcome-hp` 要素を更新するのは [index.html:1209](index.html:1209) の `showWelcome()` 1 箇所のみ
  - `showWelcome()` は `doLogin` / `doSaveNickname` からしか呼ばれない
  - `goHome()` ([index.html:1431](index.html:1431)) は `showScreen('screen-welcome')` を呼ぶだけで HP 再取得・再描画しない
  - 結果画面の HP（サーバ返値由来）が正しい = `saveAttempt` / `submitSango` / `submitWabun1` は正しく新 HP をサーバから返している = Stage 2 のキャッシュも正常に機能している
  - これまで「ログイン → テスト → ログアウト」の流れが多かったため気づかれていなかった長年のバグ

#### 62. Option A: ホーム画面 HP 表示バグ修正（dev `387175f` → main `ffe8624`）
- **方針**: フロントエンド最小修正。サーバコールなし、GAS コード変更なし、Stage 3 以降と非干渉
- **[index.html](index.html) +16/-5 行**:
  - `var _totalHP = 0;` を追加（セッション中の最新 HP を in-memory で保持）
  - `doLogin` 成功時: `_totalHP = res.totalHP`
  - `doSaveNickname` 成功時: `_totalHP = 10`（初ログインボーナス）
  - `showResult`: `_totalHP = saveRes.totalHP`（saveAttempt はレスポンスに totalHP を含む）
  - `submitSangoText` / 三語短文写真提出 / `_showWabun1Result`: `_totalHP += res.hpGained`（これらは hpGained のみ返すため加算追従）
  - `goHome()`: `welcome-hp` を `_totalHP.toLocaleString()` で再描画
  - `doLogout`: `_totalHP = 0` にリセット
  - onclick 4 箇所を `showScreen('screen-welcome')` → `goHome()` に統一（HP リフレッシュを全経路で保証）
- **動作確認は塾PC 再開時の最初のタスク**（下記 #63 参照）

#### 63. 次回作業予定（塾PC 再開時）
- **環境情報**:
  - 自宅PC 作業終了（2026-04-24 夜）、数時間後に塾PC で再開予定
  - 両 PC とも clasp 導入済み（`git pull` + `clasp pull` は**禁止**、`clasp push` のみで運用）
  - `DEBUG_CACHE` は ON のまま（塾PC 再開後もログは継続して出る）
  - GAS Executions の UI 上で詳細ログが開けない問題は**未解決**（代替手段は後日検討）
- **最優先タスク**: **Option A の動作確認**（#62）
  - `?v=タイムスタンプ` でキャッシュバスター付き URL を踏み、HTML を強制更新
  - ログイン → HP 表示確認
  - テスト合格 → 結果画面 +50HP 確認 → ホーム戻る → HP 加算反映確認
  - 三語短文提出 → ホーム戻る → さらに +200HP 反映確認
  - 和文英訳①提出（全問正解）→ ホーム戻る → +100HP 反映確認
  - 連続提出時も HP が正しく追従するか確認
- **OK なら Stage 3（F1 プリフェッチ + F2 クライアントキャッシュ）着手**
  - 期待効果: コンテンツタップ 3000ms → ほぼ 0ms
  - F1: ログイン後のバックグラウンドプリフェッチ（`getSangoTopic` / `getWabun1Topic` を非同期で先読み）
  - F2: `cachedGasGet(params, ttlMs)` ラッパーでクライアントセッションキャッシュ
- **Stage 3 後に判断**: E1（楽観UI）の実装可否
- **その他の保留タスク**:
  - 「タップで拡大バグ」の調査・修正
  - 管理画面の動作確認
  - 基礎計算コンテンツの企画・実装
- **Day 2 Priority 3（G3/G4/G6）**: 時間が余れば実装

### 2026-04-25

本日は塾PCで作業。Stage 3 + E1 実装でパフォーマンス改善フェーズ完了、小バグ修正、企画進行、ブログ執筆。本スレは添付ファイル上限到達のため自宅PC再開時は新スレで作業。

#### 64. Option A main マージ＆動作確認完了
- Option A（ホーム画面HP表示バグ修正）は #62 で実装済み。本日朝に実機（`?v=タイムスタンプ` キャッシュバスター付き）で動作確認
- テスト合格 / 三語短文提出 / 和文英訳①提出いずれも結果画面に正しい新HP表示、ホームに戻っても反映、連続提出でも追従 — 全経路正常
- 速度も「まあまあ速い」との評価 → Stage 3 + E1 の実装に進む判断

#### 65. GAS パフォーマンス改善 Stage 3 F1: ログイン後トピック先読み（dev `966b67f` → main `dc7a545`）
- **設計方針**: `var _prefetched = {}` map に Promise を保持、`showWelcome()` 末尾で `_prefetchTopics()` を呼び `getSangoTopic` / `getWabun1Topic` を並列先読み。`showSangoTopic` / `showWabun1Topic` で consume（使い切り型、再タップは従来通り fetch）、`doLogout` でリセット
- Option A の `_totalHP` には未干渉
- [index.html](index.html) +19/-3 行
- 期待効果: 初回コンテンツタップ 3000ms → ほぼ 0ms（prefetch hit 時）

#### 66. GAS パフォーマンス改善 Stage 3 F2: クライアントサイドセッションキャッシュ（dev `f9192a0` → main `dc7a545`）
- **設計方針**: `cachedGasGet(params, ttlMs)` 新設、既存 `gasGet` は無改修のラッパー方式
- キャッシュキー = `_ts` を除いた params のソート JSON、成功 (`res.ok === true`) のみキャッシュ、TTL 既定 5 分（300_000ms）
- 6 エンドポイント差し替え: `getQuote` / `getNotice` / `getWeeklyRanking` / `getHistory` / `getSangoSubmissions` / `getWabun1AnswersAfterSubmit`
- Invalidation hook 4 箇所:
  - `saveAttempt` 成功 → `getHistory` + `getWeeklyRanking`
  - `submitSango` (text/photo) 成功 → `getSangoSubmissions`
  - `submitWabun1` 成功 → `getWabun1AnswersAfterSubmit`
- `doLogout` で `_gasCache = {}` リセット
- Option A の `_totalHP` には未干渉
- [index.html](index.html) +37/-8 行
- 期待効果: 画面往復 2 回目以降 3000ms → 0ms（TTL 内なら GAS 呼び出しゼロ）

#### 67. パフォーマンス改善 E1: 楽観的UI + マイカツ君エラー演出（dev `6ee8e58` → main `464020a`）
- **HP 予測式の調査で判明**: GAS `submitSango` / `submitWabun1` は「固定値 200/100」ではなく `200 × week²` / `100 × week²`（week = `Math.ceil(streak/7)`）。ユーザーの仕様認識にズレがあり実装前に訂正
- **楽観的UI 対象**（即座に結果画面表示 → 裏で送信 → 差分があれば再描画）:
  - 英単語RUSH 満点合格: `50 × Math.ceil(streak/7)²` 予測、`_submitAttemptOptimistic(total)` 関数に分離
  - 三語短文 (text/photo): `200 × Math.ceil(streak/7)²` 予測、当日 2 回目以降は 0 を予測（localStorage キー `mykt_hp_<sid>_sango_<JST3am日付>` で判定）
- **楽観的UI 対象外（和文英訳①）**: 全問正解判定がサーバー側のため楽観表示は誤誘導リスク。代わりに「マイカツ君がキミの英文をチェック中…」中立ローディング overlay（`character.jpg` + ドット点滅アニメ 400ms 周期、青系吹き出し `#eff6ff` + `#60a5fa`）
- **エラー演出**: 共通 overlay（`character.jpg` + 暖色吹き出し `#fff7ed` + `#fb923c`）「あ、失敗したみたい！もう一回押してね」+「もう一度送信する」/「キャンセル」の 2 ボタン
  - `.catch()`（ネットワーク/タイムアウト）と `res.ok === false`（サーバーエラー）両方を失敗扱い
  - ロールバック: `_totalHP -= predicted` + `_unmarkHpGrantedToday('sango')`
  - リトライ: `_pendingRetry` クロージャで楽観的UIごと再走
  - キャンセル: `_pendingDismiss` で画面復帰（英単語RUSH → `goHome` / 三語短文 → 入力画面 / 和文英訳① → 確認画面で送信ボタン再有効化）
- **送信中インジケーター**: `.submit-pending-ind`（結果画面右下固定、スピナー + 「送信中…」13px グレー）、サーバー応答で非表示
- **新規追加 state**: `_streak`（`doLogin` で保存、`doLogout` でリセット） / `_pendingRetry` / `_pendingDismiss` / `_gradingDotsTimer` / localStorage 当日フラグ群（JST 3 時切替で自動ローテート）
- [index.html](index.html) +225/-25 行
- 動作確認: 全経路正常、HP 誤表示なし、連続提出時も追従

#### 68. パフォーマンス改善総合評価
- Option A + Stage 2 + Stage 3 + E1 の総合評価：**「劇的ではないが実用レベル」**。書き込み系は Option A + E1 で瞬時体感、読み取り系は F1/F2 で 2 回目以降ほぼ即時
- HP 誤表示なし、全体動作正常
- **パフォーマンス改善フェーズは一区切り**。以降は新機能実装にリソース配分

#### 69. B：タップで拡大バグ修正（dev `6535567` → main `3b75de3`）
- **症状**: 英単語RUSH 英検 5 級 書き取り画面の見本画像「こんな感じで書いてね（タップで拡大）」をタップしても無反応
- **真因**: [index.html:462](index.html:462) のモーダル DOM `#img-modal` と [index.html:60-62](index.html:60) の CSS `.modal-overlay.active` は完備されていたが、`onclick="openModal()"` から呼ばれる `openModal()` / `closeModal()` の **JS 関数本体が未定義**。タップ時に `ReferenceError` で何も起きていなかった
- **修正** ([index.html:1375-1376](index.html:1375)): 2 行追加で完結
  ```js
  function openModal()  { document.getElementById('img-modal').classList.add('active'); }
  function closeModal() { document.getElementById('img-modal').classList.remove('active'); }
  ```
- 動作確認: 5 級 書き取り画面で見本画像タップ → 拡大表示、背景タップ → 閉じる、iOS Safari / Android Chrome 両方 OK

#### 70. A：管理画面動作確認（既完了と判明）
- 4/22-23 セッション（#53 管理画面ダッシュボード化）で実装完了＆軽く動作確認済と判明
- **詳細な動作確認は運用で検証していく方針**で終了

#### 71. ブログ記事執筆（はてなブログ連動企画）
- **タイトル形式**：「【マイ活アプリ通信＠AIクロ】…」（AI「クロ」が執筆した記事だと分かる命名）
- **1 本目**: 「はじめまして！マイ活アプリの裏側にいるAIのクロです」**公開済み**
- **2 本目**: 「AI目線で見る「マイ活アプリ」のここが凄い」→ **4/26 公開予定**
- ふくちさんの文体を分析 → 親しみやすい話し言葉ベースに統一
- **今後の構成**: クロがマイ活アプリ関連記事を執筆、ふくちさんが他テーマを執筆。コントラストを楽しむ構成

#### 72. 将来タスク（記憶保存）
- **メモリ#6**: 管理画面「生徒実施状況」のカレンダー機能（日付起点で閲覧可能に）
- **メモリ#7**: 講師ログイン機能＋ `Teachers` シート新規作成
- **メモリ#8**: 先生→生徒メッセージング機能（生徒からの返信は LINE へ）

#### 73. D：基礎計算コンテンツ企画進行
- **仕様書受領**（ふくちさん）: 20 級〜1 級、無学年〜中 3 レベルの 20 種類
- **紙教材画像**: 20 枚 × 2（前半 + 後半）受領、PNG 変換済み（`/home/claude/calc_images/` と `/home/claude/calc_images_kouhan/`）
- **技術方針確定**:
  - **MathJax** で数式表示（紙教材と同じ見た目）
  - **Gemini API** で問題生成
  - **Vision API**（既存）で採点用 OCR 流用
  - **全 20 級一気に実装**（Phase 分けしない）
- **HP 上限**: 100/日確定（5 題 50HP × 2 or 10 題 100HP × 1）
- **連立方程式の後半 2 枚画像は未受領**（スレ添付上限、次スレへ持ち越し）
- **引き継ぎ書**: `/mnt/user-data/outputs/引き継ぎ書_基礎計算コンテンツ企画.md` にファイル出力済み
- **仕様書作成は新スレで継続**

#### 74. Gemini API キー状態確認
- **Vision API key** (`VISION_API_KEY`): GAS Script Properties に既存（三語短文/和文英訳①の OCR で使用中）、流用可能
- **Gemini API key**: [gas/Code.js](gas/Code.js) 内で `GEMINI` / `gemini` いずれの文字列もゼロヒット → **新規取得 + Script Properties に `GEMINI_API_KEY` として登録が必要**
- **フロント側 `VISION_KEY`** ([index.html:909](index.html:909)) は GAS 側とは別のハードコード。既存の三語短文/和文英訳① OCR で直接叩いている
- **コード参照されている既存キー一覧**: `VISION_API_KEY` / `ADMIN_PASSWORD` / `DEBUG_CACHE` / 動的キー `cleared_*` / `pass1_*` / `pass2_*`

#### 75. 次回（自宅PC）作業予定
- **環境**: 塾PC 作業終了、数時間後に自宅PCで再開。Claude Code 側は**新スレで開始**（現スレは添付ファイル上限到達）
- **新スレ開始時の最初のルーティン**: 環境整理（`git pull` → `dev` 切替 → ステール worktree/ブランチ削除）。`clasp pull` は禁止（運用ルール通り）
- **新スレの最初の実作業**: 基礎計算コンテンツの仕様書作成を新スレで継続（#73 引き継ぎ書参照）
- **パフォーマンス改善フェーズ終了**のため、以降は新機能（基礎計算）の実装がメイン

#### 76. 自宅PC再開 + 環境整理
- 新worktree `cranky-shockley-6bcc54` を `claude/*` から `dev` に切替、`origin/dev` から 5 コミット fast-forward（#64-75 分取り込み）
- ステール dev worktree `romantic-yonath-8d676e`（未コミット無し / origin/dev より 5 遅れ）を `git worktree remove` で削除
- ステール branch `claude/cranky-shockley-6bcc54` を `git branch -d` で削除
- `clasp pull` は運用ルール通り使用せず（Code.js の変更なしのドキュメント作業のため `clasp push` も不要）

#### 77. 基礎計算コンテンツ 仕様書 v1.0 完成（Claude.ai メインスレ側で実施）
- **背景**: 昨日 #73 で企画段階（Gemini API 方針 + HP 上限 100/日 + MathJax + Vision API 流用）まで決定していた。本日 Claude.ai メインスレで仕様書化を進めた
- **経緯（v0.3 → v0.5.1 → v1.0 確定）**:
  - v0.3（初稿）: Gemini API リアルタイム生成方式を前提に開始
  - v0.5.1 進行中に **重大な方針転換**: Gemini API 方式は計算科目で致命的（LLM は「もっともらしい誤答」を数式で生成するリスクがあり、採点結果として誤解答を ⭕ と判定する事故が起きうる）
  - **A案（Python + SymPy 事前生成方式）に切替**: 問題・解答を事前にバッチ生成 → スプレッドシート（問題DB）に投入 → 生徒画面はDBから出題のみ、という構造。計算精度はSymPyが保証、LLMの判断を採点経路から完全に排除
- **v1.0 で確定した全設計判断**（仕様書 §2-§8）:
  - **表記ルール**: 仮分数・帯分数 両方許容、既約分数のみ正解扱い、簡約形のみ正解（`2/4` → `1/2` を要求）
  - **採点**: 空欄は自動で不正解、OCR 信頼度 0.6 閾値で低信頼時は再撮影誘導、部分点なし（全問正解のみ HP 付与）
  - **HP 加算**:
    - `rawHP`（新概念）: 各級1セット 50HP × 最大2セット = 100HP/日 上限
    - 1 日 3 セット目以降は「練習モード」（HP 付与なし、学習継続はOK）
    - 5問セット → 10問セット へ切り上がる際は **rawHP は切り捨てず維持**（運用上の公平性）
- **仕様書ファイル**: docs/基礎計算_仕様書.md（1362 行、10 セクション：概要 / 問題DB / 生成パイプライン / 採点 / HP / 管理画面 / UI / 段階導入 / 実装ステップ / 付録）
- **リポジトリ配置**: コミット `29974d1` で dev に push 済（`docs/` ディレクトリ新設）

#### 78. 次回（塾PC）作業予定
- **環境**: 自宅PC 作業終了、塾PC へ移行予定。Claude Code は新スレで継続可
- **新スレ開始時の最初のルーティン**: `git pull` → `dev` 切替 → ステール worktree/ブランチ削除（`clasp pull` は禁止のまま）
- **最初の実作業**: **Phase 1 の問題生成スクリプト プロトタイプ実装**
  - docs/基礎計算_仕様書.md §9.2 の依頼プロンプトを Claude Code に投げて着手
  - Phase 1 スコープ: 共通モジュール（SymPy ラッパー・表記正規化・出力フォーマッタ）+ 20級・16級の2級分
- **以降の Phase 構成**: Phase 2〜7 で残り18級の問題生成 → GAS 実装（問題DB 読み取り・HP ロジック）→ フロント実装（出題画面・MathJax レンダリング・OCR 採点）→ 管理画面（進捗確認）→ 動作確認

#### 79. 基礎計算 Phase 1 実装完了：問題生成スクリプトのプロトタイプ
- **環境セットアップ**: 塾PC に Python 3.14.4 を新規インストール → `python -m pip install sympy`（pip コマンドは PATH 未設定だが `python -m pip` で動作） → SymPy 1.14.0 動作確認
- **配置**: `scripts/generate_kiso_questions/` 新設、コードは git 管理。生成 JSON は `out/` で `.gitignore` 化（再生成可能）
- **共通モジュール 4 本** (`scripts/generate_kiso_questions/common/`):
  - `sympy_helpers.py`: `to_rational` / `reduce_fraction` / `improper_to_mixed` / `mixed_to_improper` / `is_finite_decimal` / `rational_to_decimal_str`（Rational から有限小数文字列への厳密変換、丸め誤差なし）
  - `latex_utils.py`: `frac_latex`（既約表示）/ `frac_latex_raw`（**約分せずそのまま表示**、問題式用）/ `mixed_frac_latex` / `OP_LATEX` 辞書
  - `answer_variants.py`: `variants_for_integer` / `variants_for_rational`（仮分数・帯分数・有限小数の各バリエーション + マイナス全/半角・スラッシュ全/半角・帯分数の空白半/全角を機械生成。**帯分数の空白除去は曖昧化するため除外**=`'1 1/2'` ⇔ `'11/2'` 問題回避） / `canonical_for_rational`
  - `band_config.py`: `BAND_PLAN[20|16]["A"|"B"|"C"]` のみ Phase 1 で実装。D〜H は Phase 2 で紙教材画像参照しつつ追加
- **20級 (rank_20_integer_mixed.py)**:
  - A: 1桁整数 2項 +/-（結果非負）
  - B: 1桁整数 2項 ×/÷（÷は割り切れる組のみ、商と除数を先に決めて積で被除数構築）
  - C: 2桁整数 3項 四則混合（×÷ → +- の優先順位を SymPy で厳密実装、結果が整数で非負になる組のみリトライ採用）
- **16級 (rank_16_fraction_addsub.py)**:
  - A: 同分母 2項 +/-（結果非負・非ゼロ）
  - B: 異分母 2項 +/-（分母 ≤ 12）
  - C: 異分母 2項 +/-（分母 ≤ 15）
  - 問題式の表示は `frac_latex_raw`（生成時の (n,d) をそのまま表示）。約分すると `(4/6) - (3/6)` が `(2/3) - (1/2)` と表示され Band A が異分母に化ける**バグを発見・修正**
- **共通インターフェース**: 各 rank モジュールが `generate_problem(band, rng) -> dict` と `self_check(problem) -> bool` を実装
- **main.py**: `--ranks 20,16` でカンマ区切り指定可、`--seed 42` で再現性確保（級ごとに `seed + rank` で独立 RNG）。各級ごとに `out/questions_rank_XX.json` を出力 + サマリ（生成数 / セルフチェック失敗数 / 経過秒）をコンソール表示
- **動作確認結果**: 20級・16級 各 30 問（A/B/C × 10）、計 60 問すべてセルフチェック PASS、`answerCanonical` ∈ `answerAllowed` も全件通過、帯分数表記（例: `4/3` の allowed に `'1 1/3'` が含まれる）も確認
- **既知の制限（Phase 2 以降で対応）**:
  - 20級 A は問題空間が狭く（1桁+1桁の和差で結果非負 → 約45通り）10問中 1 件重複が出ることあり。重複排除は未実装
  - D〜H バンド未実装、各バンドの count も Phase 1 用に 10 で固定
  - スプレッドシート書き込み (`db_writer.py`) 未実装（Phase 3 で `gspread` 経由）
- **実行例**: `cd scripts/generate_kiso_questions && python main.py` で `out/questions_rank_20.json` / `out/questions_rank_16.json` 生成

---

## 基礎計算 Phase 3 着手前必読

Phase 3（D〜H バンド拡張・スプレッドシート投入）に着手する前に、**必ず以下を読んでから作業を開始すること**：

### 1. 設計原則ドキュメント（最重要）

[scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md](scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md)

全級・全フェーズ共通で守るべき原則を集約。Phase 1・Phase 2 で発見された不具合と対策が体系化されている：

- **原則 1**：問題式の分数は常に既約形（Phase 1 で確立、生成側 + 検証側の二段構え）
- **原則 2**：Band A〜C は教育的入門として紙教材より易しめに調整（Phase 2 で確立）
- **原則 3**：Phase 3 で必ず復活させるべき「省略済み難易度」一覧

### 2. ❗️ 「省略済み難易度」の復活漏れを絶対に防ぐ

DESIGN_PRINCIPLES.md §「原則 3」の表に列挙された問題タイプは、**Band D〜H 拡張時に必ず復活させる**。

現時点（Phase 2 グループ②a 完了時）の対象：

- 8級：解が分数の `ax = b`（割り切れない係数）→ Band D 以降
- 8級：複雑な分数解になる比例式（22/9、108/13 など）→ Band E 以降
- 6級：係数 ±4〜±6 の中程度連立方程式 → Band B/C 終盤 or D 以降

各 rank_*.py 内の `# TODO_PHASE3:` コメントを `grep -r "TODO_PHASE3"` で検索すれば確認可能。

### 3. 紙教材との整合確認

Band A〜H 全体で、紙教材（春日部アカデミー「計算級別トレーニング」）と**同等の難易度カバレッジ**を確保するのが Phase 3 の最終目標。

### 4. 新原則の追加について

Phase 3 着手中に新たな設計原則が発見された場合：
1. DESIGN_PRINCIPLES.md に追記（原則 N として連番）
2. 該当する rank_*.py を修正（該当箇所に `# TODO_PHASE3:` または原則番号付きコメント）
3. 本セクションにも記載を更新

### 2026-04-26

塾PCで作業。**基礎計算 Phase 1+2 完全完了**（20級・600問が selfcheck PASS）+ HPLog rawHP リファクタ + Phase 4 着手準備 + 仕様書 3 本追加・更新。明日 4/27 月曜の和文英訳① 新仕様運用開始に向けた緊急対応も準備。本日の作業はすべて self-contained で、塾PC→自宅PC への引き継ぎ準備完了状態。

#### 80. 基礎計算 Phase 2 グループ②a 完了 + 設計原則体系化（dev `d975610` → `c253000` 仕様書 v1.2）
- **新規 5 級**: 15級（分数乗除）/ 14級（分数四則混合）/ 8級（一次方程式・比例式）/ 7級（式の計算 中2）/ 6級（連立方程式）
- **教育的調整**:
  - 8級 Band A：`ax = b` の「a が b の約数」制約で整数解のみに（割り切れない係数を排除）
  - 8級 Band C：比例式の解は整数のみに（22/9, 108/13 などの複雑解を排除）
  - 6級 Band A：x+y型・係数 ±1〜3 のシンプルな連立に
- **設計原則体系化**: `scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md` 新規作成、全14ランク *.py 冒頭にヘッダーコメント追加、CLAUDE.md に「Phase 3 着手前必読」セクション追加
- **仕様書 v1.2**: §6.4.0 を「設計原則の集約セクション」に格上げ

#### 81. 基礎計算 Phase 2 グループ②b 完了（dev `7c491c1`）
- **新規 5 級**: 5級（多項式の展開）/ 4級（乗法公式）/ 3級（因数分解）/ 2級（平方根）/ 1級（二次方程式）
- **§6.8 決定3 厳守**: 2級で `b` は square-free 強制、1級 Band C も `p/k/q` を gcd 約分済
- **教科書標準ルール採用**:
  - 3級 Band A: leading項（x の係数）を必ず正に → `4x - 6y → 2(2x - 3y)`
  - 1級 Band C: 解の公式を ± 表記でまとめる → `x = -2±√5`、`x = (-1±√41)/4`
- **TODO_PHASE3 コメント付与**: 3級たすき掛け、2級二重根号、5級多変数展開など

#### 82. 基礎計算 Phase 2 グループ③ 完了（dev `fb27434`）
- **10級（単位・比・割合）**: 他級と異なる「10問固定スロット構造」
- **`UNIT_RANGES` 辞書**で全 18 単位の現実的範囲を一元管理（k㎡: 1〜100、ha: 1〜10000 など）
- **`_pick_src_for_conv` ヘルパー**で「両単位とも UNIT_RANGES 内」を保証 → 44709 km² のような非現実的値を完全排除
- slot 7（速さ）Band A: `multiples = [60, 120, ..., 600]` で答えが 1〜10 に多様分布
- main.py を拡張：`generate_problem(band, rng, slot_index=...)` を slot rotation 対応

#### 83. 仕様書 v1.3 → v1.4 + 英語長文 v0.6 → v0.7（dev `e8faa01`、`285eb8f`）
- **基礎計算 v1.3**: §6.5 各級表に Band A/B/C 設計詳細・Phase 3 復活対象を追記
- **基礎計算 v1.4**: ホーム画面バッジ表記を「50〜100HP/日」→「50〜100HP/セット」に4箇所一括修正
- **英語長文 v0.7**: 級選択画面のお題サマリ削除（生徒が易しい級に逃げないよう）、リスニング音声をボタン押下待ちに、録音は時間制限なしを明示

#### 84. Phase 4 着手前 調査レポート作成（dev `fc4210f`）
- **`docs/基礎計算_Phase4_調査レポート.md`** 新規（280 行）
- 既存 Code.js（2527行、関数60+、action 41 分岐）を網羅分析
- 流用可能なもの（_logHP、Vision API、CacheService、当日チェックパターン）と新規作成必須のもの（Drive 連携、KisoQuestions/Sessions/Photos シート、採点エンジン）を切り分け
- 5 関数の実装難易度判定：startKisoSession 中 / submitKisoAnswer 難（Phase 4 工数の50%超）/ getKisoRetryQuestions 易 / getKisoPhotosList 易 / cleanupKisoPhotos 中

#### 85. Phase 4 着手プロンプト集（dev `931e53b`）
- **`docs/基礎計算_Phase4_着手プロンプト集.md`** 新規（246 行）
- Phase 4-1（基盤整備、60〜90分）/ Phase 4-2（コア実装、90〜120分）/ Phase 4-3（周辺機能、45〜60分）の 3 段階に分割
- 各段階で Claude Code に投げるプロンプトを完成形で用意 → 次回着手時はコピペで即起動可

#### 86. HPLog rawHP カラム追加 + `_logHP` シグネチャ統一（dev `e347e7a`）
- **背景**: 仕様書 §8.7 で確定した「rawHP は素点、hp は倍率後」を既存 4 関数（loginStudent / saveAttempt / submitSango / submitWabun1）にも適用、Phase 4 で submitKisoAnswer を追加する前段の準備
- **コード変更**:
  - `_logHP(studentId, rawHP, hpGained, type)` の 4 引数化、シート初期化を 5 列に
  - 4 呼び出し元を新シグネチャで統一（直接 `appendRow` だった submitSango/submitWabun1 も `_logHP` 経由に統一）
  - HPLog 読み取りインデックスを 5 箇所更新（type: [3]→[4]、wabun1 hpGained: [2]→[3]）
- **`migrateHpLogAddRawHp()` 関数を新規追加**: 既存全レコードを `rawHP = hpGained` で埋め戻し（冪等）
- **本番反映完了**: `clasp push` → GAS エディタで `migrateHpLogAddRawHp()` 実行 → 新バージョンデプロイ → 既存コンテンツ動作確認 OK

#### 87. 英語長文リスニング＆音読 仕様書 v0.6 新規（dev `7d50ee6`）
- **`docs/英語長文リスニング_音読_仕様書.md`** 新規（1139 行）
- 4 シート構成（LongTopics / LongSubmissions / LongPhotos / LongCache）、TTS 推奨設定（Google Cloud Text-to-Speech、Studio/Neural2 音声、級別速度）
- 4 枠別入力 UI（英文本体 / 日本語訳文 / 正誤問題 / 正解と解説）、採点なし設計（送信 = 完了で HP 付与）
- 週次切替（月曜 3:00〜4:00）、HP（4級〜準2級=100、2級〜準1級=200）、音読録音 15 日保存（基礎計算と同 Drive 基盤）
- v0.7 で級選択画面のお題サマリ削除など 3 件の調整（同コミット内）

#### 88. 和文英訳① データ仕様変更ドキュメント v1.0（dev `aa17758`）
- **`docs/和文英訳①_新仕様変更_v2.md`** 新規（321 行）
- **背景**: 4/27（月）からの実運用開始に向け、ふくちさんが Excel テンプレート（4列：曜日/種別/内容/補助列）を再設計
- **データ構造変更**: Wabun1Topics を 15 列 → 13 列に（japanese_text 独立、skip 1 列統合）
- **§7 に Claude Code 実装プロンプト**を完成形で用意 → 自宅PC作業で即実装着手可
- **緊急性**: 4/27 朝までに問題データ投入が必要

#### 89. 環境・本日のコミット履歴サマリ
- **塾PC で作業終了**、数時間後に自宅PC で再開予定
- **本日の主要コミット**（all on dev、main にもこの後マージ）:
  - `d975610` Phase 2 グループ②a + 設計原則体系化
  - `c253000` 仕様書 v1.2
  - `7c491c1` Phase 2 グループ②b
  - `fb27434` Phase 2 グループ③（10級）
  - `e8faa01` 仕様書 v1.3
  - `285eb8f` 仕様書 v1.4 + 英語長文 v0.7
  - `fc4210f` Phase 4 調査レポート
  - `7d50ee6` 英語長文 v0.6（v0.7 内容含む）
  - `931e53b` Phase 4 着手プロンプト集
  - `e347e7a` HPLog rawHP リファクタ
  - `aa17758` 和文英訳① 新仕様変更 v1.0
- **clasp 状態**: HPLog 改修分は本日 `clasp push` 済、本番反映済み
- **未反映**: 和文英訳① 新仕様の実装は未着手（自宅PC で着手予定）

#### 90. 次回（自宅PC）作業予定
- **環境セットアップ**: 自宅PC に Python が未インストールの場合は [python.org](https://www.python.org/downloads/) から最新版インストール（「Add python.exe to PATH」必須）
- **新スレ開始時のルーティン**: `git pull` → `dev` 切替 → ステール worktree/ブランチ削除（`clasp pull` は禁止）
- **最初の実作業**: 和文英訳① 新仕様の実装。`docs/和文英訳①_新仕様変更_v2.md` §7 の Claude Code 実装プロンプトをそのままコピーして投げる
- **完了後**: ふくちさんが Excel から問題データを管理画面に貼り付けて投入 → 4/27 月曜の実運用開始
- **その後**: Phase 4 着手（`docs/基礎計算_Phase4_着手プロンプト集.md` の Phase 4-1 から）

#### 91. 自宅PC 移行 + 和文英訳① 新仕様実装着手
- **環境**: 自宅PC に Python 3.14.4 を新規インストール（PATH 追加済）。塾PC からの引き継ぎ作業は #90 の手順通り
- **worktree 整理**: ステール dev worktree `cranky-shockley-6bcc54`（origin/dev より 8 コミット遅れ / 未コミット無し）を `git worktree remove`。stale branch `claude/cranky-shockley-6bcc54` も `git branch -d`
- 現 worktree `thirsty-vaughan-7efe2d` を dev に切替、`origin/dev` から 16 コミット fast-forward で取り込み（#80-90 分）

#### 92. 和文英訳① データ仕様変更 v2.0：13 列構造実装（dev `4676e28` → main `04c7018`）
- **背景**: ふくちさんが再設計した Excel テンプレート（4列：曜日/種別/内容/補助列）を「A〜C 列だけコピペ」で投入できる運用に切替。詳細は [docs/和文英訳①_新仕様変更_v2.md](docs/和文英訳①_新仕様変更_v2.md)
- **`Wabun1Topics` 13 列構造に再設計**:
  - 旧 15 列（task1〜4 / answer1〜4 / skip1〜4 / word_list ほか）→ 新 13 列：`date | week_no | task1 | japanese_text | task2 | task3 | task4 | skip_text | word_list | answer1〜4`
  - **task1 から `japanese_text` を独立列として分離**（指示文と日本文の視認性向上）
  - **`skip1`〜`skip4` を `skip_text` に統合**（番号区別なし、1日1メッセージ）
- **GAS 側 ([gas/Code.js](gas/Code.js))** 実装変更:
  - `_wabun1HeaderIndices` / `_wabun1RowToObj` ヘルパーを新設し、`_readWabun1TopicsByDate` / `_readWabun1TopicsByDateRange` をヘッダー駆動に統合（DRY 化）
  - `getWabun1Topic` / `_buildWabun1TopicsByDate` のレスポンスに `japanese_text` / `skip_text` を含める
  - `_wabun1NormalizeKind` を新設し、`adminAddWabun1TopicsWeek` を新仕様で書き直し
    - 種別の許容を拡張：`日本文` / `スキップ`（番号省略可、`スキップ1`〜`スキップ4` も可）+ 全角数字（`問題１`/`正解１`/`スキップ１`）の半角化
    - **同一 `date` の行があれば setValues で上書き、なければ末尾に追加**（部分投入を許容）
  - 旧 `skip1`〜`skip4` 列が残っているシートに対しても下位互換ロジック（最初に値があるものを skipText に採用）
- **管理画面 ([admin.html](admin.html))**:
  - `WABUN1_VALID_KINDS` の固定配列廃止 → フロント側にも `_wabun1NormalizeKind` を追加してパース時に正規化（GAS 側と同じ regex で同期）
  - プレビュー表に「日本文」「スキップ」列を新設（単一カラム集計）、`日本文` 未入力曜日は赤字警告
  - placeholder / 注意書きを 4/27 サンプルデータベースに刷新
- **生徒画面 ([index.html](index.html))**:
  - `_renderWabun1Topic` で task1 の指示文の直下に「日本文」を独立ボックス（暖色枠 `.wabun1-japanese`）で表示
  - `skip_text` は問題リスト先頭に**1 箇所のバナー**（`.wabun1-skip-banner`、赤系）で統一表示。旧の per-task `t.skip` 表示を削除
  - 過去の問題画面 (`_renderWabun1PastDateBlock`) と archive 画面 (`_renderWabun1ArchiveDateBlock`) も同設計に追従
- **動作確認**: 仕様書 §3.3 サンプル TSV を Node.js で admin.parse → GAS.buildRows まで通し、13 列の正しい順序で出力されること、全角数字・スキップ番号有無の正規化が機能することを確認
- **採点ロジック**: `submitWabun1` は `topic.tasks` / `topic.answers` を参照しているだけのため変更不要

#### 93. 和文英訳①：一括登録の 400 Bad Request 緊急修正（dev `ee6cccb` → main `04c7018`）
- **事象**: ふくちさんが 4/27〜5/3 の 7 日分（89 行）を貼り付けて「一括登録する」を押すと **400 Bad Request**
- **真因**: `gasGet` は `fetch(URL?params=...)` で送るが、items 配列を含む JSON が encodeURIComponent 後に **Apps Script Web App の URL 長制限（およそ 8KB）を超過**してリクエストが拒否される
- **修正**:
  - **GAS 側 ([gas/Code.js](gas/Code.js))**: `doPost` のディスパッチ分岐に `adminAddWabun1TopicsWeek` を追加（既存 `submitPhoto` と同パターン、`JSON.parse(e.postData.contents)` で受ける）
  - **管理画面 ([admin.html](admin.html))**: `gasPost(params)` ヘルパーを新設、`submitWabun1Paste` の送信を `gasGet` → `gasPost` に切替
  - **CORS 対策**: `Content-Type: text/plain;charset=utf-8` で送ることで CORS preflight (`OPTIONS`) を発生させず simple request の範疇に収める。Apps Script は preflight に応答しないためこれが唯一の手段
- **波及検討（今回スコープ外）**: 三語短文 `adminAddSangoTopicsWeek` も 4 レベル × 7 日 = 28 件で 7000 字超え得る既知リスク（CLAUDE.md #13 / #16）。現在は問題ない規模で運用中だが、将来 400 が再発したら同じ POST パターンで対応可能

#### 94. 4/27〜5/3 の問題データ投入完了 ★クライマックス
- ふくちさんが新仕様 13 列の `Wabun1Topics` シートを再構築（旧データ全削除 → 新ヘッダー入力）
- `cd gas && clasp push` → GAS エディタで新バージョンデプロイ
- 管理画面で 7 日分（月〜日）の TSV を貼り付け → POST 経由で正常投入完了。スプレッドシートに 7 行確認
- **4/27（月）からの実運用準備完了**

#### 95. 本日全体の累計成果（塾PC + 自宅PC）
- 基礎計算 仕様書 v1.0 → v1.4
- 基礎計算 Phase 1+2 完全完了（20級・600 問）+ DESIGN_PRINCIPLES.md 体系化
- Phase 4 調査レポート + 着手プロンプト集
- 英語長文リスニング&音読 仕様書 v0.7
- HPLog rawHP カラム追加 + 既存 4 関数シグネチャ統一（本番反映済み）
- 和文英訳① 13 列構造実装 + doPost 切替 + 本番投入完了

#### 96. 次回再開時の手順
- **PowerShell で Claude Code 起動前に以下を実行**（ふくちさんの手動操作 worktree も dev に揃え、Claude Code とのズレを防ぐ）:
  ```powershell
  cd C:\Users\Manager\mykt-eitango
  git checkout dev
  git pull origin dev
  ```
- **次回主要タスク**: 基礎計算 Phase 4-1（基盤整備、所要 60〜90 分）
- [docs/基礎計算_Phase4_着手プロンプト集.md](docs/基礎計算_Phase4_着手プロンプト集.md) の §Phase 4-1 セクションをコピーして Claude Code に投げる
- 環境前提: 自宅PC・塾PC とも Python 3.14.4 / clasp 導入済、`clasp pull` は禁止のまま運用継続

### 2026-04-26 夜〜2026-04-27 早朝（マラソンセッション：連続日数バグ復旧 + 基礎計算実装完走）

朝の保護者からの問い合わせ「29日連続が1日に戻っている」を起点に、原因究明 → 復旧 → 教育日システム導入 → 自動バックアップ → お詫び付与までを終え、同夜のうちに基礎計算コンテンツの実装フルセット（Phase 4〜7 のうち事前実装可能分）を完了。コミット 10 件超・約 3000 行のコード変更。

#### 97. 連続日数バグ：原因究明 + 一括復旧（dev `bc1037f` / `6118ec7` / `d4f54bf`）
- **事象**: 朝、保護者から「29 日連続だったのが 1 日に戻っている」との問い合わせ。13 名の生徒で `Students.STREAK` が異常リセット。手動修正一切なし。保護者・生徒に一斉告知済み（本日中復旧を約束）
- **真因（深夜特定）**: [gas/Code.js](gas/Code.js) の `_toDateStr` 正規表現 `/^\d{4}-\d{2}-\d{2}/` に末尾アンカー `$` がなく、ISO 8601 datetime 文字列にもマッチして UTC 日付の先頭 10 文字を slice していた
- **発動経路**: 4/24 commit `e6d8398`（Day 2 Stage 2）で導入された Students キャッシュが Date を `JSON.stringify` するため、`LAST_LOGIN` セルが Date 自動フォーマットされた生徒のみ「JST 0:00 → UTC で前日 15:00」のズレが入り、cache 経由読み取り時に 1 日前の日付が返る → `missedDays = 2` 誤判定 → `streak = 1` リセット → `saveAttempt` の setValues が STREAK 列に `preservedStreak = 1` を書き戻して永続化
- **修正コミット 3 件**:
  1. `bc1037f` 原因分析レポート [docs/連続日数バグ_原因分析_2026-04-26.md](docs/連続日数バグ_原因分析_2026-04-26.md)
  2. `6118ec7` `recoverAllStudentsStreak({dryRun})` 関数を新設（HPLog `type='login'` から再計算）
  3. `d4f54bf` `_toDateStr` の正規表現修正 + `loginStudent` / `saveAttempt` の setValues 範囲を分割（STREAK / LAST_TEST 列を「保持書き込み」する経路を排除し責務分離）

#### 98. 自動バックアップ機能（dev `87bb59b`）
- **目的**: 同種の事故時に即時復旧できる体制づくり
- **実装関数**: `runDailyBackup()` / `_ensureBackupFolder()` / `_cleanupOldBackups()` / `_ensureBackupLogSheet()` / `_logBackup()` / `listBackups()`
- **動作**: スプレッドシート全体を Drive 「マイ活_バックアップ」フォルダに `mykt-eitango-backup_YYYY-MM-DD` でコピー、30 日超は自動ゴミ箱送り、BackupLog シートに記録
- **Time-based Trigger**: 毎日 02:00〜03:00（手動設定済み）

#### 99. recoverAllStudentsStreak v2 + 4:00 AM 教育日システム（dev `b0c88fd`）
- **dryRun の漏れ被害者発見**: 24009 岩倉、23030 髙山が初版 recovery で漏れた → `Attempts` に記録があるのに HPLog `type='login'` が無い日があると判明
- **仕様変更**: ふくち判断「アプリはログインしないとテストはできない」→ HPLog の他 type と Attempts も「ログイン日」シグナルとして採用する multi-source 化
- **戻り値拡張**: `activeDays` / `lastActiveDate` / `loginDays` / `fallbackOnlyDays` を追加
- **`diagnoseStudentActivity(studentId, days)`**: 個別生徒の HPLog/Attempts を時系列で抽出する診断ツールを新設
- **4:00 AM 教育日システム**: `_todayEducationalJST()` / `_yesterdayEducationalJST()` を新設、**2026-04-27 00:00 JST から発動**
  - JST 04:00 区切りで「1 日」を判定 → 深夜跨ぎの再ログインで連続日数が壊れない
  - cutover 前は `_todayJST()` と完全互換、cutover 後のみ JST hour < 4 で前日扱い
  - `loginStudent` / `saveAttempt` / `getTodaysSet` / `_getYesterdayJST` を切替（`_sangoToday` / `runDailyBackup` / `_getLastWeekRange` / `recoverAllStudentsStreak` は明示維持）
- **本番復旧結果**: 13 名の連続日数を正しい値に復旧

#### 100. お詫び連続日数 +1（dev `d620abd` → `2a3b620` で対象範囲修正）
- **`apologyStreakBonus(opts)`**: HPLog に `type='apology_streak_bonus'` で 6 列レコード（`message='連続日数+1のお詫び付与'`）+ Students.STREAK +1
- **対象判定の修正**: 旧（ニックネーム空欄を除外）→ 新（生徒IDが空欄でない全員）。ふくち方針「+1 を生かすかは生徒次第」
- **冪等性ガード**: `apology_streak_bonus_executed_2026_04_27` フラグで 2 回目以降は `force:true` でないとブロック
- **本番実行結果**: **65 名の STREAK が +1**（4/27 早朝、生徒ログイン前に実行）
- **告知**: 朝 LINE で生徒・保護者に予約送信済み

#### 101. 基礎計算 Phase 4-1 — 基盤整備＋600 問 DB 投入＋Drive 権限追加（dev `b2e35c4` / `f3075f3`）
- **シート整備**: `KisoQuestions` / `KisoSessions` / `KisoPhotos` の 3 シートを `ensureKisoSheets()` で自動作成（ヘッダー + 最低行数保証）
- **`appsscript.json`**: `oauthScopes` に `https://www.googleapis.com/auth/drive` 追加、既存 4 スコープも明示宣言
- **600 問投入**: Phase 1+2 で生成済 20 級 × 30 問を `KisoQuestions` シートへ。`scripts/generate_kiso_questions/common/db_writer.py` を新設（gspread + Service Account JSON 認証）
  - 認証情報: `mykt-eitango-writer.json` を `C:\Users\Manager\Documents\gcp-credentials\` に配置（自宅PC 側のみ）
  - 環境変数 `KISO_GSPREAD_CREDENTIALS` / `KISO_SPREADSHEET_ID` で渡す（手順は [SETUP_DB_WRITER.md](scripts/generate_kiso_questions/SETUP_DB_WRITER.md)）
- **`f3075f3`**: 一発目の投入で `Range exceeds grid limits` エラー発生 → `_ensureSheetWithHeaders` に `minRows` 引数追加 + db_writer 側にも `_ensure_sheet_capacity` 追加（defense in depth）

#### 102. 基礎計算 Phase 4-2 — コア API（dev `c6ca4be`）
- **3 公開 API**: `startKisoSession(studentId, rank, count)` / `getKisoRetryQuestions(sessionId)` / `submitKisoAnswer(sessionId, imageBase64)`
- **採点ヘルパー**:
  - `_kisoNormalize(s)`: 全角→半角、各種マイナス、`√n`→`\sqrt{n}` 等
  - `_kisoCheckStrictForm(text)`: 既約分数（gcd=1）、square-free な平方根、有理化済みのみ受理
  - `_kisoSplitByQuestionNumbers(text, count)`: ①〜⑩ / (1)〜(10) / 1. などで分割
  - `_kisoMatchAnswer(studentRaw, allowedJson)`: 正規化 → 厳格チェック → allowed 全要素と完全一致比較
- **データアクセス**: `_getKisoQuestionRowsForRank(rank)` 級別キャッシュ + `_kisoTodayRawHP(sid)` で 1 日の素点上限判定
- **schema migration**: `KISO_SESSIONS_HEADERS` に `wrongIds` 列追加、`_ensureSheetWithHeaders` に「ヘッダー欠損時の末尾追記」ロジック追加
- **Node.js で 40 件のテスト全 PASS**: 正規化 / 既約性 / 番号分割

#### 103. 基礎計算 Phase 4-3 — Drive 連携完成（dev `fe5f798`）
- **Drive 連携**:
  - ルート: `マイ活_基礎計算_答案写真`、年月サブフォルダ: `YYYY-MM/`
  - ファイル名: `{studentId}_{rank}_{sessionId}.jpg`
  - `_ensureKisoPhotoFolder(yearMonth)` / `_saveKisoPhoto(...)` / `_deleteKisoPhoto(driveFileId)`
- **`_saveKisoPhoto` を Phase 4-2 stub から本実装に置換**: `submitKisoAnswer` の初回提出経路から自動的に保存される
- **`getKisoPhotosList(params)`**: 管理画面用、認証必須。`studentId` 指定なしで生徒一覧サマリ、ありで写真詳細リスト。サムネ・viewUrl も導出
- **`cleanupKisoPhotos(opts)`**: 日次クリーンアップ。`deleteAfter <= today` の行を Drive 削除 + シート行削除。`dryRun` 対応
- **Time-based Trigger**: 毎日 03:00〜04:00（手動設定済み、バックアップ 02:00-03:00 と教育日切替 04:00 の合間）

#### 104. 基礎計算 Phase 5 — 生徒画面実装（dev `5a0d5f5` → `caaeb34` で文言調整）
- **MathJax v3 CDN 読み込み**: `startup.typeset=false` で手動制御、`MathJax.typesetPromise()` で動的描画
- **ホーム画面**: 「基礎計算」プレースホルダ → 稼働中カードに切替（バッジ「50〜100HP/セット」、サブ「小学校高学年〜中学生」）
- **新規 6 画面**:
  - `screen-kiso-rank` 級選択（20 級を 4 区分セクション分け）
  - `screen-kiso-count` 問題数選択
  - `screen-kiso-problem` 問題表示（MathJax）
  - `screen-kiso-confirm` 撮影確認
  - `screen-kiso-result` 採点結果（合格/不合格、⭕❌リスト）
  - `screen-kiso-done` HP獲得 / 練習完了（紙吹雪 + カウントアップ + chime）
- **写真処理**: 長辺 1600px / JPEG 0.8 にリサイズ → base64 → `gasPost('submitKisoAnswer', ...)`
- **練習モード**: `hpInfo.isPractice === true` で「練習完了」演出（HP 表示なし、chime のみ）
- **`caaeb34` で 3 修正**: 級選択画面の最上部に教育的赤太字メッセージ「自分に必要だと思うものをやりましょう。先生がアドバイスする場合もあります。」追加 + 級バッジ削除 + 注意書き文言更新

#### 105. 基礎計算 Phase 6 — 管理画面（dev `d2bd073`）
- **ダッシュボードに 4 つ目のカード追加**: 「📷 基礎計算・答案写真」
- **新規 2 画面**:
  - `screen-admin-kiso-students` 生徒一覧（仕様書 §5.3、表形式：生徒ID / 氏名 / 写真枚数 / 最新提出日時 / 最早削除予定日）
  - `screen-admin-kiso-photos` 生徒別写真詳細（仕様書 §5.4、カードグリッド：サムネ / 級 / 問題数 / ステータス / 提出日時 / 削除予定日 / 拡大ボタン）
- **削除予定日ラベル**: 残 3 日以下は赤太字、0 日「（本日削除）」、負「（期限超過）」
- **拡大表示**: `window.open(p.viewUrl, '_blank')` で Drive UI に遷移（仕様書 §5.5）

#### 106. 基礎計算 Phase 7 — 事前実装可能分（dev `1a1054a`）
仕様書 §9.7 のチェックリスト 14 項目のうち、実機テスト前に事前実装できる 2 件を完成：
- **B-1：問題数選択画面の動的 HP 上限案内**（仕様書 §4.3 後半）
  - GAS 新 API `getKisoTodayRawHP(params)` 公開（`_kisoTodayRawHP` ラップ）
  - フロント `_renderKisoCountNotice(res)` で 3 状態切替: 0-49（緑通常）/ 50-99（黄警告「あと N HP」）/ 100（紫上限到達）
- **B-2：OCR 信頼度低時の再撮影誘導**（仕様書 §7.6 ケース 4 / §7.7）
  - `KISO_OCR_CONFIDENCE_THRESHOLD = 0.6`（実機テスト後の微調整は **この 1 行だけ** を書き換え）
  - `_kisoAverageOcrConfidence(fullAnno)` で symbol レベルの confidence 平均を算出
  - `submitKisoAnswer` 内で閾値未満なら `{ ok:false, retake:true, avgConfidence, threshold, message }` を返却（採点処理スキップ、KisoSessions の attempts は増やさない）
  - フロント側は Phase 5 で `res.retake === true` ハンドリング実装済み → 変更不要

#### 107. 和文英訳① 表示修正（dev `af67613`）
- スキップ注意の表示位置を「問題1 の上」→「問題4 の下」に移動
- スタイルを「⚠️ ラベル + ピンク枠 + 背景色」→「シンプルな赤太字（枠なし）」に
- 3 画面（今日の問題 / 過去の問題 / アーカイブ）で一貫修正
- 4/27 本番運用開始の準備として実施

#### 108. ブログ第4回「ある朝、お母さんから一通のメッセージが届いた」完成
- 連続日数バグの保護者問い合わせから始まる本日の対応を物語化
- ブログ系の作業は CLAUDE.md 管轄外（リポジトリには含めない）

#### 109. 本日の累計成果
- **コミット 10+ 件、約 3000 行のコード変更**
- **緊急対応 3 件**: 連続日数バグ原因究明 + 復旧 + 4:00 AM 教育日 + お詫び +1（65 名）
- **新コンテンツ完全実装**: 基礎計算（Phase 4-1〜Phase 7 B-1/B-2 まで）
- **インフラ強化**: 自動バックアップ機能、診断ツール `diagnoseStudentActivity`、`recoverAllStudentsStreak` v2

#### 110. 4/27 朝のふくちさん側の作業
- 朝の LINE 告知（予約送信済み）への保護者・生徒の反応に対応
- 塾で生徒に基礎計算を試してもらう（仕様書 §9.7 のチェックリスト 14 項目を実機確認）
- 必要なら OCR 閾値（`KISO_OCR_CONFIDENCE_THRESHOLD = 0.6`）の微調整

#### 111. 明日中の作業（塾PC のセットアップ）
- JSON ファイル `mykt-eitango-writer.json` を USB 等で塾PC にコピー
- `C:\Users\Manager\Documents\gcp-credentials\mykt-eitango-writer.json` に配置
- Python パッケージインストール:
  ```powershell
  cd C:\Users\Manager\mykt-eitango\scripts\generate_kiso_questions
  python -m pip install -r requirements.txt
  ```
- 環境変数の恒久設定（`KISO_GSPREAD_CREDENTIALS` / `KISO_SPREADSHEET_ID`）

#### 112. 次回開発再開時の主要タスク
- **基礎計算の実機テスト結果を踏まえた微調整**（Phase 7 残：仕様書 §9.7 のチェックリスト確認）
- **リスニング&音読コンテンツの実装着手**（仕様書 [docs/英語長文リスニング_音読_仕様書.md](docs/英語長文リスニング_音読_仕様書.md) v0.7）
- **基礎計算 Phase 3** も将来的に着手予定（D〜H 拡張、計約 1500 問に増量。`scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md` の TODO_PHASE3 復活対象を必ず網羅）

#### 113. 次回再開時の手順
- **PowerShell で Claude Code 起動前に実行**:
  ```powershell
  cd C:\Users\Manager\mykt-eitango
  git checkout dev
  git pull origin dev
  ```
- 環境前提: 自宅PC・塾PC とも Python 3.14.4 / clasp 導入済、`clasp pull` は禁止のまま運用継続

### 2026-04-27 夕方〜2026-04-28 早朝（本番運用初日の緊急対応 + スキップ機能実装）

塾PCで作業。4/27 本番運用開始日に発生した基礎計算フリーズバグの緊急修正、和文英訳① 判定基準の緩和、お詫びHP 機能の新設・拡張、和文英訳① スキップ機能の実装、基礎計算 級選択画面の文言調整。今夜だけで 7 コミット。

#### 114. 緊急対応：基礎計算「マイカツ君が照合中」フリーズバグ（dev `1c3ea08` → main `d377f06`）
- **症状**: iPad（塾Wi-Fi）で 4/27 17:00 過ぎ、20級 初回テストで写真送信後「マイカツ君が照合中」のまま数分間反応せず、画面を閉じる以外なくなる事象が発生。Drive の `マイ活_基礎計算_答案写真/2026-04/` に該当時刻の写真ファイル無し → アップロード自体が成功していないことが切り分け済
- **真因**: [index.html](index.html) に `gasPost` 関数の **定義が存在しない**。Phase 5（コミット `5a0d5f5`）で `submitKisoPhoto` を実装した際、`admin.html` から `gasPost` をコピーするのを忘れていた
  - `submitKisoPhoto()` は `_kisoShowGrading(true)` → `gasPost(...)` の順で呼び出すため、`gasPost` で **同期 ReferenceError** が発生 → `.then().catch()` チェーンに到達する前に例外が伝搬 → 「照合中」表示だけが残り、ボタンも disabled のまま固まる
  - GAS にリクエストが届いていないため Drive にも記録なし（観測事実と完全一致）
- **設計差異の発見**: wabun1 / 三語短文はフロントから直接 Vision API を叩く設計（base64 画像は GAS に送らない、テキストだけ GET）→ `gasPost` 不要。基礎計算だけは GAS 経由で OCR + 採点 + Drive 保存するため `gasPost` 必須
- **修正** ([index.html](index.html) +51 / -21):
  - `gasGet` 直下に `gasPost(params, timeoutMs=90000)` を新設。`AbortController` でタイムアウト時に専用エラーメッセージ（「サーバー応答がありません…」）を投げる
  - `submitKisoPhoto()` を try/catch ラップ。同期 throw が起きても必ず `_kisoShowGrading(false)` + ボタン再有効化 + アラート表示が動く
  - `.catch()` のエラーメッセージも `err.message` 優先表示に改善
- 同夜のうちに main 反映 → 本番デプロイ完了

#### 115. 和文英訳① 正誤判定の緩和（dev `1557978` → main `d377f06`）
- **背景**: 4/27 本番運用初日、和文英訳①の判定が「スペース・全半角・句読点」も完全一致を要求していたため、内容は正しいのに不正解判定された生徒が多発
- **`_normalizeWabun1` 全面書き直し** ([gas/Code.js](gas/Code.js)):
  - **緩和（同一視）**: 全角英数 → 半角統一 / 類似句読点・記号を半角統一（「、」⇔「,」、「．」⇔「.」、ハイフン類、引用符類、括弧類）/ すべての空白文字を削除（半角/全角スペース・タブ・改行）/ 大文字小文字を無視
  - **維持（厳格判定）**: 文末ピリオド「.」は punctuation としてそのまま残す（英文に必須）/ 文末句点「。」は punctMap に含めず別記号として保持（日本文に必須、教育的意義の維持）
  - punctMap で 27 種類の類似記号を半角化、`[\s　]+` 正規表現で空白系をすべて削除
- **方針**: 過去のデータ再判定はせず（A案）、当日の提出者全員にお詫びHPを一律付与する救済処置（次項参照）

#### 116. お詫びHP 機能の新設（apologyWabun1Bonus、dev `1557978` / `84b2013`）
- **目的**: #115 の判定厳しすぎ問題のお詫び。和文英訳① 1 セットの通常獲得 HP（`100 × week²` の base）と同額の **100HP** を一律付与
- **`_wabun1SubmittersByDate(dateStr)`**: 内部ヘルパー、Wabun1Submissions の指定日提出者を `{ count, firstAt, lastAt }` で集計
- **`getWabun1SubmittersByDate(params)`**: 公開ヘルパー、Students 突合し name/nickname も付与した一覧。GAS エディタからの事前確認用
- **`apologyWabun1Bonus({ dryRun, force, date='2026-04-27', hpAmount=100, additionalStudentIds })`**:
  - apologyStreakBonus と同じ構造（`PropertiesService` フラグ `apology_wabun1_executed_<date>` で冪等性ガード、HPLog `type='apology_wabun1'`、`message='和文英訳①の判定基準改善のお詫び付与（{date}分）'`）
  - **`additionalStudentIds`**（dev `84b2013` で追加）: ログに残らないが本人申告等で取り組みが確認できた生徒の手動追加。ログ既存 ID と重複時はログ側を優先（二重加算しない）。`source='manual'` / `manuallyAdded:true` で識別
  - 戻り値に `totalSubmitters / additionalRequested / additionalApplied / totalTargets` を追加
- **doGet 非登録**: 個人情報リスク回避のため GAS エディタ専用
- **本番実行結果**: **12 名に +100HP**（11 名は関数経由、川島桃子は手動追加）

#### 117. 和文英訳① 部分スキップ機能の実装（dev `f29c6c5` → main `d377f06`）
- **背景**: スキップ注意（例：「○○をまだ塾でやってない人は、3と4はやらないで〜！」）の対象者が、3 と 4 を空欄で提出すると不合格判定される設計ミスを解消
- **新シート列**:
  - **Wabun1Topics に `skip_questions` 列**（最右に追加）。JSON 配列で部分スキップ可能な問題番号を指定（例 `[3,4]`、`[2,3]`）。空欄なら全問必須（既存通り）
  - **Wabun1Submissions に `skip_questions` 列**（最右、7 列目）。生徒がスキップした番号を JSON で記録。既存 6 列構造（teacher_comment まで）は完全に維持、appendRow を 7 要素に拡張
  - `adminSetWabun1Comment` は 6 列目固定書き込みのため影響なし
- **GAS 採点ロジック** ([gas/Code.js](gas/Code.js)):
  - `_normalizeWabun1SkipList(raw)`: 文字列・配列・カンマ区切り（`"3,4"`）すべて受理する正規化ヘルパー。1〜4 範囲外は除外、重複排除、昇順ソート
  - `submitWabun1` が `params.skipQuestions` を受け付け、`topic.skip_questions` と突合。**許可外の番号は無視**（採点対象に戻す＝ずる対策）
  - スキップ済み問題は空欄でも `correct:true + skipped:true`、全体合否は「スキップ含む全問正解」で判定
  - 戻り値に `appliedSkips` 配列を追加
  - `_wabun1HeaderIndices` に `iSkipQuestions` 追加、`_wabun1RowToObj` のレスポンスに `skip_questions` 配列を含める
  - `getWabun1Submissions` / `adminListWabun1Submissions` のレスポンスにも `skip_questions` を追加
- **生徒画面** ([index.html](index.html)):
  - `_wabun1State.skipApplied` フラグ追加
  - 問題リスト直下に「⊘ 3・4番 をスキップする」ボタン（橙、`topic.skip_questions` が空配列の日は非表示＝既存通り）
  - 押下で該当 task に `skipped` クラス + 「これはやらない」灰色バッジ。「スキップを解除する」グレーボタンで OFF（押し間違い対策）
  - `_wabun1CheckNumbers` にスキップ番号を渡し、該当番号は OCR テキストに無くても差し戻されないように
  - `submitWabun1Answer` リクエストに `skipQuestions` を JSON で同梱
  - 結果画面で skipped 問題を「⊘ スキップ」表示、不正解ハイライトの対象から除外
- **管理画面** ([admin.html](admin.html)):
  - 提出一覧カードのヘッダー直下に「⊘ スキップ：3・4番」橙バッジ。ずるしてスキップしている生徒（解ける問題までスキップ）が一目で分かる
- **本番運用**: 4/28 の問題（一般動詞の否定文）に `[3, 4]` を設定済

#### 118. 基礎計算 お詫びHP 機能の新設（apologyKisoBonus、dev `a23727b` → main `d377f06`）
- **背景**: #114 の gasPost 未定義バグにより、4/27 に基礎計算で写真送信した生徒は KisoSessions にセッション開始記録だけが残り、採点・HP 付与が一切実行されなかった。和文英訳①と同パターンで救済
- **`_kisoChallengersByDate(dateStr)`**: 内部ヘルパー、KisoSessions の `startedAt` 日付一致で `{ sessionCount, firstAt, lastAt, ranks, counts }` を集計。`startedAt` は文字列・Date のどちらでも安全に扱う
- **`getKisoChallengersByDate({ date? })`**: 公開ヘルパー、Students 突合した一覧。事前確認用
- **`apologyKisoBonus({ date='2026-04-27', dryRun, force, hpAmount=100, additionalStudentIds })`**: apologyWabun1Bonus と完全に同じシグネチャ・構造
  - 定数: `APOLOGY_KISO_TYPE = 'apology_kiso'` / `APOLOGY_KISO_MESSAGE_TEMPLATE = '基礎計算の写真送信不具合のお詫び付与（{date}分）'` / `APOLOGY_KISO_FLAG_KEY_PREFIX = 'apology_kiso_executed_'`
- **本番実行結果**: **9 名に +100HP**（excludeStudentIds でテストアカウント等を除外、次項参照）
- **両方取り組んだ生徒**: 和文英訳① + 基礎計算の両方で被害があった生徒は **+200HP**（妥当な救済として意図通り）

#### 119. お詫びHP 関数に excludeStudentIds オプション追加（dev `8c5ea22`）
- **背景**: テストアカウントや実際には取り組んでいない生徒（誤ってセッションを開始した等）を除外したいケースが発生
- **両関数に `excludeStudentIds` オプション追加**（後方互換、省略可）:
  - 配列で生徒IDを指定（trim、空欄/null 除去、自身の中での重複排除）
  - **ログ由来 / 手動追加（additionalStudentIds）どちらからも除外**
  - `excludeStudentIds` は `additionalStudentIds` より優先（同じ ID が両方にあれば除外側が勝つ）
  - 除外された生徒は `updates` に含まれず、HP 加算もされない
  - 戻り値に `excludeRequested`（指定数）/ `excludeApplied`（実際に除外された人数）を追加
  - 実装パターンは両関数で対称（`preExcludeIds = challengerIds.concat(onlyManualIds)` → `filter` で `!excludeSet[sid]` を残す）

#### 120. 基礎計算 級選択画面の追加文言（dev `075d4ca` → main `d377f06`）
- **教育メッセージを 1 行 → 2 項目に拡張**:
  1. 自分に必要だと思うものをやりましょう。先生がアドバイスする場合もあります。
  2. 毎回違った問題が表示されます。「全問正解が当たり前」の状態になるまで、何度も練習しましょう。
- **CSS 装飾**: 行頭文字「●」は HTML に直接書かず CSS の `::before` で実装（`<ul class="kiso-rank-intro">` + `<li>` 構造、`list-style:none`、`li::before { content: "●"; position:absolute; left:0; ... }`）。文字色（赤 `#dc2626`）・太字・font-size 16px は維持
- **ヘッダーラベル変更**: `screen-kiso-rank` の `<span>` を「級を選んでね」→「**単元を選んでね**」（生徒視点では「単元」の方が直感的）

#### 121. 本日のコミット履歴サマリ
| コミット | 概要 |
|---|---|
| `1c3ea08` | fix(基礎計算): submitKisoPhoto のフリーズを修正（gasPost 未定義 + 同期throw対策） |
| `1557978` | feat(和文英訳①): 判定基準緩和 + お詫びHP付与機能 |
| `84b2013` | feat(和文英訳①お詫びHP): additionalStudentIds オプションで手動救済対象を追加可能に |
| `f29c6c5` | feat(和文英訳①): 部分スキップ機能（生徒UI + 採点ロジック + 提出記録 + 管理画面表示） |
| `a23727b` | feat(基礎計算お詫びHP): apologyKisoBonus + getKisoChallengersByDate を新設 |
| `8c5ea22` | feat(お詫びHP): apologyWabun1Bonus / apologyKisoBonus に excludeStudentIds オプションを追加 |
| `075d4ca` | feat(基礎計算): 級選択画面の教育的メッセージ2項目化 + ヘッダーラベル「単元を選んでね」 |

#### 122. ふくちさん側の作業（4/28 朝）
- **朝のお詫び告知 LINE への保護者・生徒の反応に対応**（予約送信済み）
- **塾で生徒に基礎計算と和文英訳①を試してもらう**（実機確認）
- 和文英訳① 4/28 の問題（一般動詞の否定文）に `skip_questions = [3, 4]` を設定済

#### 123. 明日中の作業（塾PC のセットアップ、再掲）
- JSON ファイル `mykt-eitango-writer.json` を USB 等で塾PC にコピー
- `C:\Users\Manager\Documents\gcp-credentials\mykt-eitango-writer.json` に配置
- Python パッケージインストール:
  ```powershell
  cd C:\Users\Manager\mykt-eitango\scripts\generate_kiso_questions
  python -m pip install -r requirements.txt
  ```
- 環境変数の恒久設定（`KISO_GSPREAD_CREDENTIALS` / `KISO_SPREADSHEET_ID`）

#### 124. 次回開発再開時の主要タスク
- **基礎計算の実機テスト結果を踏まえた微調整**（仕様書 §9.7 のチェックリスト確認、必要なら OCR 閾値 `KISO_OCR_CONFIDENCE_THRESHOLD = 0.6` の調整）
- **リスニング&音読コンテンツの実装着手**（仕様書 [docs/英語長文リスニング_音読_仕様書.md](docs/英語長文リスニング_音読_仕様書.md) v0.7）
- **和文英訳② の実装着手**（実装が複雑になるため最後の予定だったが、リスニング&音読の優先度に応じて順序検討）
- **基礎計算 Phase 3** も将来的に着手予定（D〜H 拡張、計約 1500 問。`scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md` の TODO_PHASE3 復活対象を必ず網羅）

#### 125. 次回再開時の手順
- **PowerShell で Claude Code 起動前に実行**:
  ```powershell
  cd C:\Users\Manager\mykt-eitango
  git checkout dev
  git pull origin dev
  ```
- 環境前提: 自宅PC・塾PC とも Python 3.14.4 / clasp 導入済、`clasp pull` は禁止のまま運用継続

### 2026-04-28 午前

自宅PCで作業。英語長文リスニング＆音読コンテンツのリブランディング（「英語リスオン」へのリネーム）+ ホーム画面のレイアウト整理 + 秘密の扉カードの伏線設置 + リスのマスコットアイコン導入。コードは `index.html` のみ、GAS 変更なし。

#### 126. ホーム画面構成変更：英語リスオンへリネーム + 秘密の扉カード新設（dev `35e271f` → main `3e265f1`）
- **背景・目的**: 「英語長文リスニング＆音読」は名称が長く 2 列ぶち抜き表示になっていた。短く覚えやすい新名称「英語リスオン」（リス + リッスン）に置き換え、半分サイズ化することで他コンテンツと同じグリッド密度に揃える。併せてホーム画面の最後の空き枠に「秘密の扉」を伏線として設置（将来「本日の運勢」ページへの遷移ボタンとして機能予定）
- **ホーム画面の最終レイアウト**:
  - 行 1: 英単語RUSH / 三語短文
  - 行 2: 和文英訳① / 和文英訳②
  - 行 3: 基礎計算 / **英語リスオン**（半分サイズ化、副題「英語長文リスニング＆音読」）
  - 行 4: 社会の重要用語 / 理科の重要用語
  - 行 5: 漢字 / **秘密の扉**（新規）
- **[index.html](index.html) 変更点**:
  - CSS: `.content-btn.c-listening { ... grid-column: span 2; }` を **`.content-btn.c-lison { ... }`** に置換（`grid-column: span 2` 撤廃）
  - 内部識別子の lison 統一: `c-listening` → `c-lison`（CSS クラスのみが既存実装。JS 関数・変数は未実装のため対象なし）。view.html / admin.html / gas/Code.js には listening 参照ゼロを確認済
  - 英語リスオンカード: `<span class="ico">🎧</span>` + メインラベルの構成は維持しつつ、副題 `<span class="content-btn-sub">英語長文リスニング＆音読</span>` を追加（既存の `.content-btn-sub` パターン= 11px グレー、和文英訳①・基礎計算と同じスタイル）。「準備中」バッジは継続
  - 秘密の扉カード新設:
    - 専用クラス `.c-himitsu`（`linear-gradient(135deg,#5b21b6,#1e1b4b)` 深紫グラデ + `position:relative; overflow:hidden`）
    - `::before` / `::after` で角に ✨ 装飾（top-left / bottom-right）
    - 専用副題クラス `.content-btn-sub-equal`（メインと同じ 16px / 14px、`display:block` `font-weight:bold` `opacity:.95`）— 通常の `.content-btn-sub` より大きい特殊仕様
    - クリック時 `showHimitsuDoor()` で「🚪 秘密の扉はまだ閉じています…\n近日公開、お楽しみに！」アラート（簡易実装、将来「本日の運勢」ページに差し替え予定）
- **コミット経緯**: 当初 `git push origin HEAD:dev` で fast-forward 成功（`7e9a8aa..35e271f`）

#### 127. 英語リスオン マスコットアイコン導入：リスのイラスト配置（dev `7270829` / `8426c7f` → main `4571dd9`）
- **背景**: 英語リスオンの「マスコット」として、ヘッドフォンを着けて英語の本を読むリスのイラストを Gemini で生成（PNG / 透過）。ふくちさんが GitHub Web UI 経由でリポジトリトップに `lison-icon.png` を先行アップロード（commit `8ae8c7b "Add files via upload"`）
- **配置パターン: A（絵文字 🎧 をマスコット画像に差し替え）を採用**
  - 理由: リスが既にヘッドフォン着用 → 「リスニング」のメタファーをリス自体が担うため、絵文字を残すと意味が冗長。中央上部の既存スポット（絵文字位置）にそのまま収めることで他カードとの構造的一貫性を維持しつつマスコットを最大限目立たせる。サブラベル「英語長文リスニング＆音読」とも自然な階層関係になる
- **[images/lison-icon.png](images/lison-icon.png)**: トップレベル `lison-icon.png` を `images/` に整理（新規ディレクトリ）。重複となった top-level の `lison-icon.png` は削除
- **CSS** ([index.html](index.html)) に `.ico-mascot` を新設（既存 `.ico` 絵文字系とは別系統）:
  - サイズ: PC 高さ 48px / モバイル 40px
  - `width: auto; object-fit: contain` で歪みなし
  - `margin: 0 auto 6px` で中央揃え（`text-align: center` の親内で block 要素を中央寄せ）
  - `filter: drop-shadow(0 2px 4px rgba(0,0,0,.25))` で深紺グラデ背景に対する立体感
  - `transition: transform .2s` + `:not(.disabled):hover { transform: scale(1.06) }` で有効化後に hover でわずかに拡大するリアクション（準備中の現状は disabled で発動しない）
- **HTML 変更**: 英語リスオンカードの `<span class="ico">🎧</span>` を `<img class="ico-mascot" src="images/lison-icon.png" alt="">` に置換
- **rebase 経緯**: 初回 push が non-fast-forward で reject。原因はふくちさんが GitHub Web UI で `8ae8c7b` を先行 push していたため。`git rebase origin/dev` でその commit を取り込み、続けて top-level の重複 `lison-icon.png` を削除する commit を追加 (`8426c7f`)。最終的に origin/dev はクリーンな状態（icon は images/ に1つだけ）

#### 128. マスコット背景：半透明白の角丸パッド追加（dev `6a34c57` → main `3e265f1`）
- **背景**: 実機表示で「白の四角形が見える」フィードバック → 透過 PNG ではあるものの、深紺グラデに対してリスのシルエットが沈んで見える + デザイン的にマスコットを浮かせたい意図と判断
- **`.ico-mascot` の差し替え**:
  - `background: rgba(255,255,255,.18)` 薄い白パッドを追加
  - `border-radius: 14px`（PC）/ `12px`（モバイル）でやわらかい印象
  - `padding: 6px`（PC）/ `5px`（モバイル）でリスがパッドに張り付かない適度な余白
  - `box-sizing: border-box` でカード内の高さ予算を維持。サイズも正方化（PC 56×56 / モバイル 48×48）→ 角丸正方形のパッドに統一感
  - hover 時は `background: rgba(255,255,255,.26)` に強める軽いインタラクション（disabled 解除後に発動）

#### 129. 本日午前のコミット履歴サマリ
- **dev へ push 済み**:
  - `35e271f feat(ホーム画面): 英語リスオンへリネーム + 秘密の扉カード新設 + 配置変更`
  - `8ae8c7b Add files via upload`（ふくちさん GitHub Web UI 経由）
  - `7270829 feat(ホーム画面): 英語リスオンカードにリスのマスコットアイコンを配置`
  - `8426c7f chore: トップレベルの lison-icon.png を削除（images/ に集約）`
  - `6a34c57 style(ホーム画面): 英語リスオン マスコットに半透明白の角丸パッドを追加`
- **main マージ済み**: ふくちさん側で都度 `git merge --no-ff dev` + `git push origin main` を実行。最終 main HEAD: `3e265f1 Merge branch 'dev' (リスマスコット 半透明白パッド)`
- **GAS 変更なし**: `gas/Code.js` 触れず → `clasp push` 不要

#### 130. 次回（数時間後・塾PC）の主要タスク
- **塾PC のセットアップ**（CLAUDE.md #111 / #123 参照、まだ未完了の場合）:
  - USB 持参で `mykt-eitango-writer.json` を `C:\Users\Manager\Documents\gcp-credentials\` に配置
  - Python パッケージ: `cd C:\Users\Manager\mykt-eitango\scripts\generate_kiso_questions && python -m pip install -r requirements.txt`
  - 環境変数恒久設定: `KISO_GSPREAD_CREDENTIALS` / `KISO_SPREADSHEET_ID`
- **英語リスオンの本実装着手**（仕様書 [docs/英語長文リスニング_音読_仕様書.md](docs/英語長文リスニング_音読_仕様書.md) v0.7 ベース）:
  - 仕様: 週次更新、120-250 語の長文、リスニング → 訳付きリスニング → 正誤 3 問 → 音読録音送信
  - HP: 4 級〜準2 級 = 100、2 級〜準1 級 = 200
  - 採点なし（送信 = 完了で HP 付与）
  - 注意: 仕様書内のシート名 `ListeningPassages` / `ListeningSessions` / `ListeningRecordingsMeta` は本実装着手時に **`Lison...` 系へリネームするか検討**（内部識別子の lison 統一方針との整合性）
- **その他**: 状況に応じて 4/28 朝の本番運用フィードバックを反映

#### 131. 次回再開時の手順
- **PowerShell で Claude Code 起動前に実行**（塾PC でも同じ）:
  ```powershell
  cd C:\Users\Manager\mykt-eitango
  git checkout dev
  git pull origin dev
  ```
- 環境前提: 自宅PC・塾PC とも Python 3.14.4 / clasp 導入済、`clasp pull` は禁止のまま運用継続

### 2026-04-29

塾PC で作業。基礎計算 OCR の安定化（Gemini 課金 + モデル切替 + リトライ機構）と、和文英訳① の整合性バグ修正。本日のコミットは合計 7 件。

#### 132. Gemini API 課金設定完了
- ふくちさん側で Google AI Studio から Gemini API の **Tier 1 前払い ¥5,000** を設定
- これにより `gemini-2.5-flash` 含む安定版モデルへのアクセス権を獲得
- 従来の無料枠（Free Tier）よりレート制限が緩和、本番運用に必要な転送量を確保
- 旧 `gemini-2.0-flash` は 2026-03-06 から新規ユーザー利用不可、2026-06-01 廃止予定のため、課金設定と並行してモデル切替が必須となった

#### 133. 基礎計算 OCR を Gemini 2.0-flash → 2.5-flash に切替（dev `4c8d960`）
- **背景**: 実機テストで「This model models/gemini-2.0-flash is no longer available to new users」エラーが発生
- **変更**: [gas/Code.js](gas/Code.js) `_kisoOcrWithGemini` 内 `const model = 'gemini-2.0-flash'` を `'gemini-2.5-flash'` に変更（1 行）
- **コメントも更新**：旧モデルの廃止情報をメモとして残置（将来のモデル切替時の参考用）
- **副次効果**：2.5-flash は安定版で OCR 精度の向上が期待できる（特に分数の縦書き・手書き）
- **影響範囲**：プロンプト・レスポンス処理ロジック・リトライ機構はすべて無変更
- 他ファイル（CLAUDE.md / docs / index.html / admin.html）にバージョン特定参照なしを grep で確認

#### 134. 基礎計算 OCR 自動リトライ機構の実装（dev `d13cf66`）
- **背景**: 実機テストで「Gemini API 通信エラー：帯域幅の上限を超えています」が散発、手動再送で 2 回目成功するケースが多かった。GAS UrlFetchApp の一時的なバンド幅判定 / Gemini レート制限が原因
- **実装**: `_kisoOcrWithGemini` を for ループ化、最大 2 回試行（`MAX_ATTEMPTS = 2`、`RETRY_WAIT_MS = 500`）
- **リトライ対象**:
  - ① fetch 段階の例外（"帯域幅の上限"等の UrlFetchApp throw）
  - ② HTTP 429（Too Many Requests）/ HTTP 5xx（5xx 全般）
  - ③ トップレベル error の `quota|rate|limit|exhaust|busy|unavail|帯域` 系メッセージ（日本語「帯域」もカバー）
- **リトライ非対象**: HTTP 4xx（永続認証エラー）/ promptFeedback ブロック / SAFETY finishReason / 答え JSON 解析失敗
- **ロギング**: 各 attempt で `console.error`、リトライ成功時 `console.log '[Gemini retry success] attempt=2 initial_error=...'` で運用観察用に記録
- **戻り値**: `attempts: 1|2` を含めて呼出側で活用余地

#### 135. 基礎計算 写真サイズ縮小 + UX 改善（dev `3d3a3f3`）
- **写真サイズ最適化**: 1200px / JPEG 0.7 → **1000px / 0.6**（解答・途中式とも）
  - 945KB → 約 500-600KB に縮小、UrlFetchApp 帯域への負担軽減
  - `onKisoPhotoSelected` / `onKisoWorkPhotoSelected` 両方に適用
- **採点中overlayの安心文言**: 「マイカツ君が答えをチェック中…」の下に「少し時間がかかる場合があります」（12px グレー）を追加。リトライで遅延しても生徒が不安にならないよう
- **エラー文言の具体化**: 「もう一度お試しください」→「ネットワークが不安定な可能性があります。少し待ってから再送信してください」に 4 箇所変更
- 新 CSS `.kiso-grading-sub` 追加

#### 136. 和文英訳① 整合性バグ修正：フロント先行パース + 問題別表示（dev `42db4f3`）
- **背景**: 複数生徒から「確認画面では正解通りに表示されていたのに、送信後に❌判定された」報告
- **真因**: GAS 側 `_parseWabun1Work` の regex に `(?=\s)` 先読みが含まれ、答え本文中に行頭で「数字 1-4 + 空白」が出現すると問題番号マーカーとして誤検出。例：手書き OCR で `There are 4\napples` が `4` を #4 マーカーとして拾う → 答え 2 が "There are" だけにカット、答え 4 が "apples on the table." になる
- **対策（案C）**: フロント側で OCR 直後にパースし、確認画面で **問題ごとに切り出された答え** を表示。提出時はパース済みデータを `parsedAnswers` JSON として GAS に同梱送信
- **フロント [index.html](index.html)**:
  - 新ヘルパー `_wabun1ParseWork(text)` （GAS と同一 regex）/ `_renderWabun1ParsedList(parsed)`
  - 確認画面に「📝 採点に使う文字列（問題ごとに切り出したもの）」青系カードを追加
  - 注意書き「⚠️ ここに表示された文字列がそのまま採点に使われます」
  - 生 OCR は `<details>/<summary>` で折り畳み式に変更（透明性のため残置）
  - 撮り直し時に `parsedAnswers` もリセット
- **GAS [gas/Code.js](gas/Code.js) `submitWabun1`**:
  - `params.parsedAnswers` を新規受入、JSON 文字列をオブジェクト化して採用
  - 与えられた場合は `_parseWabun1Work` をスキップ → 確認画面表示と完全一致した文字列で採点
  - parsedAnswers なし時は従来通り `_parseWabun1Work(workText)` にフォールバック（後方互換）
  - workText（生 OCR）は引き続き `Wabun1Submissions` に保存
- 新 CSS: `.wabun1-parsed-list` / `.wabun1-parsed-item` / `.wabun1-parsed-no` / `.wabun1-parsed-text`（empty・skipped variant）/ `.wabun1-parsed-help` / `.wabun1-ocr-raw`（折り畳み expander）

#### 137. 和文英訳① regex 厳格化（dev `19adbcc`）
- **案D**: 番号検出 regex から `(?=\s)` 先読みを削除、明示的な区切り記号を必須化
- 旧: `([1-4１-４])(?:[.．,、)）]|(?=\s))` → 新: `([1-4１-４])[.．,、)）]`
- → 番号の後に `.` `．` `,` `、` `)` `）` または括弧括り `(1)` が**必須**
- 答え本文中の `There are 4 apples` の `4` は誤検出されなくなる
- 3 箇所の regex を統一: フロント `_wabun1CheckNumbers` / `_wabun1ParseWork` / GAS `_parseWabun1Work`
- 副次：生徒が「`1 ans`」（区切り記号なし）と書くと番号認識されなくなるが、案 C（前 commit）の確認画面で「読み取れていません」が表示されて撮り直し誘導される

#### 138. 和文英訳① 大文字小文字厳格化（dev `037cea7`）
- **背景**: 学校テストでは「文頭小文字」「文中大文字」は ✖ になる。アプリ側だけ緩く ⭕ にすると生徒が学校で失点して困る → 本来仕様（厳格）に戻す
- **変更**: `_normalizeWabun1` から `t.toLowerCase()` を削除
- **例**: 正解 `I have a pen.` に対して
  - 旧: `i have a pen.` も `I Have A Pen.` も両方 ⭕（緩い判定）
  - 新: `I have a pen.` のみ ⭕、それ以外は ❌
- **告知**: 生徒・保護者へのアナウンスはふくちさん側で別途実施予定（朝の LINE 等で「採点ルールを学校テストの基準に合わせます」と周知）
- 全角→半角変換（Ａ→A, ａ→a）は case を保持するため、全角入力は問題なし

#### 139. CLAUDE.md 運用ルール追記
- GAS 変更フローに **「GASエディタを開きっぱなしの場合は必ず F5 でリロード」** を追記
- 過去に「`clasp push` したのに古いコードに見える」混乱が発生。開いているエディタには push 差分が反映されないため、リロード必須

#### 140. 本日のコミット一覧
| SHA | 内容 |
|---|---|
| `42db4f3` | 和文英訳① 案C：フロント先行パース + 問題別表示 + parsedAnswers JSON 送信 |
| `19adbcc` | 和文英訳① 案D：regex から (?=\s) 先読み削除、明示的区切り記号を必須化 |
| `037cea7` | 和文英訳① 大文字小文字厳格化（toLowerCase 削除） |
| `d13cf66` | 基礎計算 Gemini OCR 自動リトライ機構（HTTP 429/5xx・帯域幅エラーで内部 1 回） |
| `3d3a3f3` | 基礎計算 写真 1200/0.7 → 1000/0.6 + 採点中安心文言 + エラー文言具体化 |
| `4c8d960` | 基礎計算 Gemini モデル 2.0-flash → 2.5-flash |

#### 141. 次回（自宅PC 数時間後）の主要タスク
- **環境**: 塾PC 作業終了、数時間後に自宅PC で再開予定
- **新スレ開始時のルーティン**:
  ```powershell
  cd C:\Users\Manager\mykt-eitango
  git checkout dev
  git pull origin dev
  ```
- **ふくちさん側の作業**（自宅PC 開始前に完了予定）:
  - `cd gas && clasp push` → GAS エディタで F5 リロード → 新バージョンデプロイ
  - main マージ + push
  - 実機テスト：基礎計算 OCR（2.5-flash 切替・リトライ動作・写真サイズ縮小後の精度）/ 和文英訳①（確認画面の問題別表示・大文字小文字厳格化）
- **次のタスク候補**:
  - 実機テストフィードバックの反映
  - 英語リスオン本実装（仕様書 [docs/英語長文リスニング_音読_仕様書.md](docs/英語長文リスニング_音読_仕様書.md) v0.7）
  - 基礎計算 Phase 3（DESIGN_PRINCIPLES.md の TODO_PHASE3 復活対象）

### 2026-04-29 早朝（自宅PC再開：和文英訳① HP増額 + 緊急 +100HP 付与 + リスオン Phase 1-A）

#### 142. 和文英訳① 素点HP 100→200（2026-04-29 以降の教育日から、dev `7203bfc`）
- **背景**: 4/27 本番運用後の運用評価で、和文英訳①（base 100HP）が三語短文（base 200HP）と比べて取り組みコストの割に HP が低いとの判断。base を倍増して 200HP に揃える
- **方針**: 日付分岐方式。**過去のクリア記録は遡及しない**（既存の HPLog はそのまま）。連続週²倍率のロジックは据え置き（`base × week²`、week = `ceil(streak/7)`）
- **適用境界**: 2026-04-29 以降の教育日（4/29 当日含む）。日付基準は wabun1 既存の `_sangoToday()`（JST 3 時区切り）を流用 — 「今日の問題」「alreadyGranted 判定」「base HP の切替」がすべて同じ瞬間に揃う
- **GAS 修正** ([gas/Code.js:5158](gas/Code.js:5158) `submitWabun1`):
  ```javascript
  const baseHp = (todayStr >= '2026-04-29') ? 200 : 100;
  hpGained = baseHp * week * week;
  ```
- **フロント修正** ([index.html](index.html)): ホーム画面 和文英訳①カードの HP バッジ `100HP/日` を date-aware に
  - バッジに `id="badge-wabun1-hp"` を付与
  - `_wabun1BaseHp()` / `_applyWabun1HpBadge()` を新設（既存 `_todayKeyJST3am()` 流用＝GAS と同じ JST 3 時区切り）
  - `showWelcome` から `_applyWabun1HpBadge()` 呼び出し → 4/29 以降は「200HP/日」表示
- **動的表示は自動追従**: view.html / admin.html の学習履歴カード（`d.wabun1.hpGained` をサーバ値そのまま表示）/ 結果画面の HP animate 表示はサーバ値由来のため変更不要

#### 143. LINE 提出組への +100HP 緊急付与（手動加算、Students F列 + HPLog 9 行）
- **背景**: 和文英訳① が判定厳しすぎ（後の v2 緩和で対応済 #115）+ 基礎計算 gasPost 未定義事故（#114）等で、4/27〜28 にアプリ提出が成立せず LINE で代替提出した生徒組への補填
- **対象 7 名**: 古内伶奈、清水未唄、川島杏子、中綾音、松本凌玖、加藤煌生、早川康佑
- **付与額**:
  - 5 名（古内伶奈、川島杏子、中綾音、松本凌玖、早川康佑）: +100HP（基礎計算分）
  - 2 名（清水未唄、加藤煌生）: +200HP（基礎計算分 +100 + 和文英訳①分 +100）
  - 合計 +900HP
- **作業内容**: ふくちさんが GAS エディタからではなくスプレッドシート上で手動編集
  - **Students シート F 列（HP）**: 7 名分の HP に手動加算
  - **HPLog 9 行追加**: 5 行が `type='apology_kiso'`、2 名 × 2 行が `type='apology_kiso'` + `type='apology_wabun1'`
  - HPLog の type は #116 / #118 で導入済の `apology_kiso` / `apology_wabun1` を流用（新設ではなく再利用）
- **`apology_kiso` / `apology_wabun1` 関数経由ではない理由**: 関数経由は CLAUDE.md #100 / #116 / #118 で導入済だが、対象が「LINE 提出」かつ少人数のため、関数で対象抽出するより目視で確実に手動加算する方が速い・確実と判断

#### 144. 英語リスオン Phase 1-A: GAS 基盤実装（dev `8dcb101` / `71b8c93`）
- **スコープ**: GAS の基盤構造のみ。フロント画面（級選択・Step 1-6・MediaRecorder UI）・Web Speech API 連携は次フェーズ（Phase 1-B）
- **シート構造**（ふくちさん手動作成予定、未作成時は graceful にエラー返却）:
  - `LisonContents`（13 列）: weekStart / level / englishText / japaneseText / q1_text / q1_answer / q1_explanation / q2_* / q3_*
  - `LisonSubmissions`（8 列）: timestamp / studentId / studentName / level / weekStart / quizScore / recordingUrl / hpGained
  - レベル文字列: `'4'` / `'3'` / `'pre2'` / `'2'` / `'pre1'`
  - 4 級の正誤問題の answer は `'○'` / `'✖'`、他級は `'T'` / `'F'`（LisonContents の値で完全一致比較）
- **HP 仕様**:
  - 4/3/pre2 = 素点 100、2/pre1 = 素点 200
  - 連続週²倍率（`streak/7` 切り上げ²）は他コンテンツと同じ
  - 1 日 1 レベル 1 回まで（`{sid, level, JST 3 時区切り今日}` 一致で alreadyGranted、hpGained = 0）
  - 録音は alreadyGranted でも Drive 保存・LisonSubmissions 記録を実施
- **新規追加**:
  - 定数: `SHEET_LISON_CONTENTS` / `SHEET_LISON_SUBMISSIONS` / `LISON_VALID_LEVELS` / `LISON_RECORDING_ROOT_FOLDER`
  - ヘルパー: `_lisonGetWeekStart(dateStr)`（JST 3 時区切りの今日からその週の月曜日）/ `_lisonBaseHpForLevel(level)` / `_readLisonContentRow(weekStart, level)`（ヘッダー駆動の 1 行読み）/ `_lisonExtFromMime(mime)`（webm/mp4/m4a/mp3/ogg/wav/aac 判定、不明時 webm デフォルト）/ `_ensureLisonRecordingsFolder()` / `_saveLisonRecording(sid, level, base64, mime)`（ファイル名 `lison_<sid>_<level>_<yyyymmddHHMMSS>.<ext>`）
  - 公開 API: `getLisonContent(level)`（戻り値 weekStart / level / englishText / japaneseText / questions[3]）/ `submitLison({ sid, level, quizAnswers, recordingBase64, recordingMime })`（戻り値 ok / hpGained / alreadyGranted / quizScore / recordingUrl）
  - doGet ルーティング: `getLisonContent` / `submitLison` を ping の直前に追加
- **既存パターン流用**: `_sangoToday()`（JST 3 時区切り）/ `_logHP()`（rawHP=hpGained、wabun1/sango と同パターン）/ `_readLastNRows()` / `_getStudentsValues()` / `_updateStudentsCacheRow()` / `_saveKisoPhoto` の Drive 保存パターン
- **動作確認**: 構文チェック（`node -c gas/Code.js`）まで。LisonContents / LisonSubmissions シートはまだ未作成のため、実機での完全動作確認は Phase 1-B 完了後

#### 145. 次回作業候補（メモ）
- 塾PC で Python セットアップ（USB 持参の JSON 鍵を `C:\Users\Manager\Documents\gcp-credentials\` に配置 → `pip install -r requirements.txt` → 環境変数 `KISO_GSPREAD_CREDENTIALS` / `KISO_SPREADSHEET_ID` 恒久設定）
- リスオン Phase 1-B: フロント実装（級選択画面・Step 1-6・音声再生・録音 UI・送信中・完了画面）
- 当面のタスク順: 漢字 → 社会・理科の重要語句 → 和文英訳② → **古文単語**（高校生向け、新設）→ 秘密の扉（本日の運勢）→ ログイン画面の生徒/保護者一本化 → 管理画面の中身修正 → セキュリティ対策
- 1 ヵ月以内: **紙の宿題連動機能**（教材を写真撮影 → AI 採点 + オリジナル問題生成）
- 中長期: アプリ単科展開（法的整理、Firebase 移行検討）

#### 採点正規化関数の仕様（新コンテンツ追加時の参考）

各コンテンツの採点で「生徒の答え」と「正解」を比較する際の正規化方針をここに集約する。
新しい採点系コンテンツを実装するときは、以下を**最低ライン**として揃えること。

**全コンテンツ共通の必須要件**
- 改行（`\n` / `\r\n` / `\r`）は空白と等価とみなして吸収する。
  生徒が紙の幅で改行して書く → OCR がそのまま改行込みで返してくるケースを救済するため。
- 全角英数 → 半角に変換する。OCR の揺れを吸収。
- 類似句読点を半角統一（全角コンマ・ピリオドなど）。但し日本語文末「。」は保持。
- 連続空白は単一空白に圧縮するか、全空白を削除するか、コンテンツの性質で選択。
- **不可視文字対策**：`\s` は U+200B〜200D（zero-width 系）/ U+2060（word joiner）/ U+FEFF（BOM）を**マッチしない**。OCR が稀に挟むためこれらも明示的に除去対象に含める。

**和文英訳① (`_normalizeWabun1` @ gas/Code.js)**
1. 全角英数 → 半角（case 保持）
2. **日本語の装飾句読点（「、」U+3001 / 「。」U+3002 / 「，」U+FF0C）を削除**（判定対象外、2026-04-30〜）
   - 「、」「。」「，」は有っても無くても ⭕（日本語問題で生徒が省略しても正解扱い）
   - 「，」(全角コンマ) は「、」と同等扱い（2026-04-30 夕方追加）。日本語 IME で全角コンマを使う書き方も装飾的とみなす
   - 英語の「,」「.」は引き続き厳格判定（必須）
3. 類似句読点を半角統一（`．→.` 等。日本語 IME での全角英記号混入を救済。「，」は前段で削除済みのため対象外）
4. **すべての空白文字を削除**（`/[\s　​‌‍⁠﻿]+/g` — `\s` + 全角スペース + 6 種の zero-width 文字）
5. 大文字小文字は厳格判定（`toLowerCase` しない、2026-04-29〜）
6. 文末英文ピリオド「.」の有無は厳格判定（OCR が小さい点を見落とす対策として、確認画面に赤太字の注意書きを表示）

**基礎計算 (`_kisoNormalize` @ gas/Code.js)**
- 全角→半角、各種マイナス記号統一、`√n` → `\sqrt{n}` 統一
- 単項プラス除去（`+2` → `2`、`x=+5` → `x=5`）
- 純粋数値正規化（`2.0` → `2`、`0.50` → `0.5`、`010` → `10`）
- 厳格性チェック（既約分数 / square-free 平方根 / 有理化済み）は別関数 `_kisoCheckStrictForm`

**判定失敗時の診断ログ**
`submitWabun1` には判定失敗時に診断情報を `console.log` で残す機能あり。新コンテンツでも同様の診断ログを必ず仕込むこと。出力フィールド：

| フィールド | 内容 |
|---|---|
| `sid` | 生徒ID |
| `no` | 問題番号（1-4） |
| `divergeAt` | 正規化後文字列の最初に違う位置のインデックス |
| `codeStudent` / `codeCorrect` | divergeAt 位置の char code（U+XXXX 16進）。不可視文字や全角半角の差分を可視化 |
| `studentNorm` / `correctNorm` | `_normalizeWabun1` 適用後の文字列 |
| `parsedRaw` | フロント `_wabun1ParseWork` がその問題用に切り出した原文（≤200 文字） |
| `canonicalRaw` | スプレッドシートの `Wabun1Topics.answer<N>` 原文（≤200 文字） |
| `workTextRaw` | OCR テキスト全文（≤300 文字） |

**feedbackType 8 分類（採点結果画面の不正解理由を生徒に表示）**
`submitWabun1` は不正解時に `_wabun1ClassifyFeedback` で違いを自動分類し、結果画面の各 ❌ 問題の下に diff カード（きみの答え / 正解 / feedbackMessage）を表示する。判定優先順は上から。

| 優先 | type | 判定条件 | message 例 |
|---|---|---|---|
| 1 | `no_answer` | studentNorm が空 | `答えが読み取れませんでした。OCR の認識を確認してください` |
| 2 | `monyo_missing` | correctRaw に `/モ[ニノ二]ョ/` 検出 + studentRaw には無い（2026-05-02 追加） | `「モニョ」と書く部分が抜けています` |
| 3 | `contraction` | studentRaw に `/['’][a-z]{1,3}\b/i` 検出 + correctRaw には無い | `短縮形（don't や isn't など）はここでは使えません` |
| 4 | `period_missing` | studentNorm + `.` === correctNorm | `末尾のピリオド「.」が抜けています` |
| 5 | `comma_missing` | カンマ全削除で一致 + 正解側のほうがカンマ多い | `カンマ「,」が抜けています` |
| 6 | `case_mismatch` | 大文字小文字を無視すれば一致（同じ長さ） | `大文字・小文字が違います` |
| 7 | `spelling` | divergeAt > 1 かつ長さの差 ≤ 5 | `文の{前半／中ほど／後半}にスペルミスの可能性があります` |
| 8 | `other` | 上記いずれにも該当せず | `正解と違う部分があります。もう一度確認してください` |

旧 `fullstop_missing`（末尾「。」抜け）は 2026-04-30 の仕様変更で廃止。
`_normalizeWabun1` が「。」を両方から削除するため、末尾「。」抜けは correct 扱いとなり分類自体が発生しない。

**モニョ表記の運用ルール（2026-05-02 確定）**
和文英訳①の問題文中で「英訳に含めるべきだが、まだ習っていない語句」を伏せる装飾を「モニョ」と呼ぶ。
- **問題文の表記**：スプレッドシート上は `「モニョ」` のようにカギカッコ付きで書く。アプリ側はそのまま表示（旧 `[モニョ]` の CSS 斜線マスク方式は廃止）。
- **答案の許容バリエーション**：`_normalizeWabun1` の冒頭で以下を `「モニョ」` に統一する。
  - `モ + (ニ U+30CB | ノ U+30CE | 二 U+4E8C) + ョ` ＝ OCR の `ニ→ノ` `ニ→二` 誤認識を吸収
  - 前後のカッコは `「」 『』 "" '' " ' （） () []` のいずれも、有無・種類を問わず吸収
- その後 `punctMap` で `「→"` `」→"` に変換され、最終正規化形は `"モニョ"` となる（両側同じ処理を通すので比較は問題なし）。
- **monyo_missing 判定**：`_wabun1ClassifyFeedback` で `correctRaw` に `モ[ニノ二]ョ` があるのに `studentRaw` に無い場合、優先度 2（no_answer の次）として通知する。これにより「モニョを書き忘れた答案」がスペルミス等の汎用フィードバックではなくピンポイントな指摘になる。

新コンテンツに同様の自動 feedback を入れる場合、上記をテンプレートとして参考に。実装は [`gas/Code.js`](gas/Code.js) `_wabun1ClassifyFeedback` を参照。

**生徒から「正解のはずなのに ❌」と相談を受けたときの真因特定手順**
1. GAS エディタを開く → 左サイドバーの「実行数」（Executions）アイコン
2. フィルタで関数 `doPost` または `doGet` を選択、生徒の提出時刻でログを絞り込む
3. 該当行をクリック → 詳細ログを表示
4. `[submitWabun1 ❌]` で始まる行を探す
5. 真因の判定：
   - **`divergeAt` の位置**：序盤なら大文字小文字 / 全角半角ミス、末尾なら句読点抜け
   - **`codeStudent` / `codeCorrect`**：U+0020（半角スペース）/ U+3000（全角）/ U+200B〜200D（zero-width）等が出てきたら不可視文字混入。`(end)` 表示なら片方が短い（句読点抜け等）
   - **`studentNorm` vs `correctNorm`**：正規化後でも違う = 真の意味の違い。同じ = 正規化バグ
   - **`parsedRaw` vs `workTextRaw`**：パース時に問題番号で切り出された範囲が正しいか確認。番号誤検出があれば regex の問題
6. 真因が判明したら：
   - 正規化漏れ → `_normalizeWabun1` を強化
   - パース誤検出 → `_parseWabun1Work` の regex 調整
   - canonical のシート入力ミス → ふくちさんが Wabun1Topics を修正
   - OCR の見落とし（小さい点を拾えない）→ 確認画面の赤太字注意書きで生徒に再撮影を促す（commit 71d117f）

#### 将来のリファクタ案件: doGet / doPost のルーティング共通化
- 現状 `gas/Code.js` の `doGet` / `doPost` で個別に `if (action === '...')` 分岐を書いている。POST が必要なエンドポイント（写真・録音など base64 が大きい系）は両方に登録漏れがないか手動確認が必要で、Phase 1-A submitLison のようにデプロイ後に「unknown action」が出る事故が複数回発生している
- 改善案：`function handleAction(action, params) { ... }` を 1 つ用意し、`doGet` / `doPost` はパラメータ抽出だけして共通関数に委譲する。新エンドポイント追加時は handleAction に 1 行追加するだけで GET/POST 両対応になる
- スコープ：~80 のルーティング分岐すべての書き換え + 全コンテンツの動作確認が必要なため、新コンテンツ実装が一段落したタイミングで着手する案件として保留

### 2026-04-30（塾PC：リスオン Phase 1-B 完成 + 基礎計算過去セッション + 採点フィードバック多数）

塾PC で長丁場の 1 日。リスオン Phase 1-B フロント全実装、複数のバグ修正と仕様改善、基礎計算の過去セッション再表示機能、採点結果画面の自動フィードバック化、和文英訳① の正規化精度向上を一気に進めた。20+ コミット。

#### 146. 英語リスオン Phase 1-B：フロント全実装（dev `4d8f346` 〜 `f2c01c6`、6 コミット）
- 級選択画面、Step 1〜5 + 完了画面 = 7 画面 + 送信オーバーレイを新設
- Web Speech API（女性 voice / rate 0.9）で文単位連続再生、世代トークンで停止対応
- MediaRecorder（webm/mp4/aac の優先順 isTypeSupported）でマイク録音
- リスのマスコット演出（アイドル時 bob、再生中 listening 傾き、完了時 jump）+ シーン別セリフ
- モバイル 480px 以下のレスポンシブ調整 17 箇所

#### 147. リスオン Phase 1-B：致命的バグ + UI 修正（dev `99a629e` / `856bd65`）
- Step 3 T/F ボタン無反応バグ修正：onclick の `JSON.stringify(v)` で `'"T"'` がダブルクォート衝突 → シングルクォート埋め込みに変更
- 級選択「ちょうせん」→「挑戦」、Step 1 / Step 2 で「English」「日本語訳」ラベル削除 + textContent 直流し化（`white-space: pre-wrap` の literal 描画問題を解消）
- Step 2 は仕様変更で英文表示削除、訳のみ表示（音声は引き続き英文）

#### 148. リスオン submitLison ルーティング欠損修正（dev `aceb7a1` / `b6603aa` / `0b2245a`）
- doGet 側に保護コメント追加（commit `aceb7a1`）
- Step 5 英文表示の label 削除 + 「ロスト」表現を「最初からやり直しになるよ」に統一（commit `b6603aa`）
- 真因確定：**doPost 側に `submitLison` のルーティング登録が無かった**ため「unknown action」エラー。doPost に追加 + 保護コメントを併設（commit `0b2245a`）
- CLAUDE.md「将来のリファクタ案件」に doGet/doPost ルーティング共通化案を追記

#### 149. 和文英訳①：判定改善 4 件
- **確認画面の注意書きを箇条書きに拡張**（commit `71d117f` / `0794010` / `e0368aa`）：ピリオド・カンマ → スペルミス → 短縮形（don't 等）の 3 項目。文言「あえて」→「ここでは」
- **改行正規化の防御的強化**（commit `d3857b3`）：`_normalizeWabun1` の `[\s　]+` に zero-width 文字 6 種（U+200B〜200D / U+2060 / U+FEFF）を追加。判定失敗時の診断ログを強化（codeStudent / codeCorrect / parsedRaw / canonicalRaw / workTextRaw）+ CLAUDE.md に「真因特定 6 ステップ手順」追記
- **採点結果画面で不正解理由を可視化**（commit `89e1657`）：`_wabun1ClassifyFeedback` を新設、不正解時に diff カード（きみの答え / 正解 / 自動分類フィードバック）を表示。8 → 7 分類（Node 16/16 PASS、CLAUDE.md に分類表追記）
- **日本語句読点（、 。）を判定対象外に修正**（commit `a43198b`）：punctMap で「、」が「,」に変換され誤分類されていたバグ。両方を削除する仕様に変更。`fullstop_missing` 分類は到達不能になったため廃止（feedbackType 7 分類に整理）

#### 150. 基礎計算：数値正規化 + 上付き文字対応（dev `1cad195` / `d3595ba`）
- `_kisoNormalize` に単項プラス除去（`+2` → `2`、`x=+5` → `x=5`）+ 純粋数値正規化（`2.0` → `2`、`0.50` → `0.5`）追加（Node 22/22 PASS）
- 同関数に Unicode 上付き数字 → caret 形式（`x²` → `x^2`）+ LaTeX `^{n}` → `^n` のブレース除去を追加（rank_03/04/05/07 全 4 ランク救済、Node 24/24 PASS）

#### 151. 管理画面・保護者画面 学習履歴に基礎計算・リスオン追加（dev `1b912d5`）
- GAS `getChildActivityRecent` 拡張：`kiso` / `lison` / `extras` フィールド追加。HPLog の `kiso_*` / `lison` を分岐、未知 type は `extras` に集約（将来コンテンツの自動表示）
- LisonSubmissions から level 補完
- admin.html / view.html を data-driven 化（`CHILD_HISTORY_ROWS` 配列、新コンテンツ追加 = 1 件足すだけ）
- 注意書き文言「⚠️ アプリ実装以前の LINE 提出状況は反映されていません。」に統一

#### 152. 基礎計算 過去セッション再表示機能 Mode A/B（dev `ce40e30` / `d54a06e` / `e118fd9` / `a0c3464`、4 コミット）
- localStorage `mykt_kiso_recent_<rank>` で当日 + 前日のセッションを保持（最大 5 件）
- 問題画面に「📚 過去のセッションを見直す（同じ単元）」+ ボタン 2 つ（1つ前 / 2つ前、未送信=黄色 / 採点済み=緑 / 該当なし=灰色）
- **Mode A**（未送信再開）：確認ダイアログ → 同セッション復元 + 「📂 再開バナー」+ 写真撮り直し → 通常通り採点 → HP 加算
- **Mode B**（採点済閲覧）：新画面 `screen-kiso-review` で写真 + 問題 + AI 読み取り + 正解（MathJax）+ ⭕❌ をカード式に表示
- GAS 基盤：`_saveKisoPhoto` に `setSharing(ANYONE_WITH_LINK, VIEW)` 追加（Drive thumbnail URL で `<img>` 表示可能に）+ submitKisoAnswer の results に `answerCanonical` を含める

#### 153. 基礎計算 同一セッション内の問題重複を排除（dev `606d949`）
- 真因：rank_04 Band C は (x+a)(x-a) の a∈[1,9] = 9 unique しかないのに count=10 → 構造的に重複
- 方針 A（生成側、根本対策）：main.py に `seen_latex` set + 50 回 retry + WARN ログ追加。ランク全体（バンドをまたいで）で `problemLatex` のユニーク性を保証
- 方針 B（GAS 側、保険）：startKisoSession で 2 段階 dedup（uniqueByLatex 構築 → 抽出 → unique 不足時は行ユニークでフォールバック）。既存 600 問の即時救済
- Node 単体テスト 5/5 PASS、全 20 ランク生成テストで rank 4 のみ WARN 1 件（band_config 調整は別タスク）

#### 154. 終了処理（夕方）
- worktree 整理：goofy-poitras-31d2d2（dev、本日の作業 worktree）と main worktree のみ。stale なし
- CLAUDE.md：feedbackType 7 分類 / 問題重複排除 / 過去セッション機能 / リスオン保護コメント などすべて反映確認
- **基礎計算 問題プール拡充計画** を CLAUDE.md に新セクションとして追加（明日以降の作業準備、優先度 A〜C で整理）
- 本日の全 commit を main にマージして塾PC 作業終了

#### 155. 基礎計算 rank_04 を 30題 → 50題 に拡充（Phase 1 完了、dev `e10d745` / `0a64f01` / `6ce217d` / `b3b3d77`）
- **背景**: 拡充計画 #154 の優先度 A、最初の対象。Band C「(x+a)(x-a)」が a∈{1..9} で unique=9、count=10 で構造的に重複が発生する根本バグの解消も兼ねる
- **設計判断**（事前合意）:
  - const_max を全 Band で 9 → 12（中3 乗法公式の典型範囲、紙教材準拠）
  - count 配分 A=23 / B=17 / C=10（合計 50、比率 45% / 35% / 20%）
  - Band A は `(x+a)(x+b)` で `min(a,b)` を先頭に並べ替え（数学的に同一の問題 (x+3)(x+5) と (x+5)(x+3) を一つの LaTeX に統一）
  - 併せて `a+b==0`（差の平方型）を Band A から除外し Band C と cross-band 重複を防止
- **コード変更** ([rank_04_expansion.py](scripts/generate_kiso_questions/rank_04_expansion.py) / [band_config.py](scripts/generate_kiso_questions/common/band_config.py)):
  - `_gen_type_xab` で `if a > b: a, b = b, a` の正規化 + `a + b == 0` 除外
  - `factored_pair_latex` 本体は無改修（rank_03 が canonical answer 生成で流用しているため副作用回避）
  - `band_config.BAND_PLAN[4]` を新仕様に更新、コメントで Phase 2 の 100 題化方針を明記
- **検証結果**:
  - `python main.py` で全 20 rank 生成 → 620 / 620 unique / 0 failed / 0 dedup_warn
  - Node 検証スクリプト（`out/_verify_phase1.mjs`、gitignore 配下）で 184 PASS / 0 FAIL
    - T1 全 rank 重複ゼロ / T2 Band A 順序統一 / T3 上付き文字判定（rank 3/4/5/7 計 140 問）/ T4 rank_04 サマリ
- **Phase 4 投入手順（in_progress セッション影響評価込み）**:
  1. `diagnoseRank4InProgress()` 関数を新設（dev `6ce217d`）→ 8 件の in_progress 検出
     - 内訳: テストアカウント 5 件（sid=1004 4セッション、sid=1002 1セッション）+ 実在生徒の放置セッション 3 件（sid=22029 ウミネコ）
     - ウミネコさんは乗法公式バグ報告者で、これらは動作確認時の放置分
  2. `abandonRank4InProgress(opts)` 関数を新設（dev `b3b3d77`）→ 8 件すべて 'abandoned' に書き換え
     - 安全策：書き換え前ログ出力 + dryRun サポート + 書き換え後の再読み込み検証
     - 実行結果: targets=8 / updated=8 / verified={ ok: 8, ng: 0 } @ 2026-04-30 05:01:46
  3. `python -m common.db_writer` で 620 行を一括投入（dry-run → 本番）
  4. gspread で post-verification（`out/_verify_phase4_post.py`、gitignore 配下）:
     - 全 rank 行数一致（rank=4 が 50、他 19 rank が 30）/ 合計 620 行
     - questionId 重複 0 件 / 全 rank で problemLatex 重複 0 件
     - rank_04 サンプル: q_04_000001 `(x - 11)(x - 10) = x^2 - 21x + 110` 〜 q_04_000050 `(x + 11)(x - 11) = x^2 - 121`
- **将来タスク追記**: 「KisoSessions に problemLatex 保存」防衛策を「基礎計算 問題プール拡充計画」セクションに記載（dev `6ce217d`）。Phase 2 100題化の前に着手予定（所要 1〜1.5 時間）
- **既知の minor 警告**: db_writer.py の `ws.update(range_str, rows, ...)` で gspread の DeprecationWarning。動作には影響なく、近い将来 `ws.update(values=rows, range_name=range_str)` に直す
- **次回**: 拡充計画 優先度 A の残り（rank_02 平方根 / rank_03 因数分解）

#### 156. 基礎計算 rank_03 を 30題 → 50題 に拡充（Phase 1 完了、dev `d938a90` / `6fe2fb3` / `<merge>`）
- **背景**: 拡充計画 優先度 A の 2 つ目。rank_04 と異なり構造的バグはなく既存 30 問はクリーン。ふくちさんの教育的判断で「差の平方は思考量少なめ」を反映した **Band C サブパターンの内訳重み付け** が今回の特徴
- **設計判断**（事前合意）:
  - Band A: count 10 → 11（共通因数）/ Band B: 10 → 11（三項式）— 中3 因数分解の核心、ほぼ均等
  - Band C: 10 → 28（差の平方/完全平方）— 内訳 **diff=6 / perfect_pos=11 / perfect_neg=11**
  - const_max を全 Band で 9 → 12（紙教材準拠、rank_04 と整合）
- **コード変更** ([rank_03_factorization.py](scripts/generate_kiso_questions/rank_03_factorization.py) / [band_config.py](scripts/generate_kiso_questions/common/band_config.py)):
  - 旧 `_gen_diff_or_perfect_square`（3 パターンランダム選択）を廃止
  - 3 つの独立 generator を新設: `_gen_diff_squares` / `_gen_perfect_square_pos` / `_gen_perfect_square_neg`
  - サブパターン dispatcher `_resolve_band_c_subkind(slot_index, subcounts)` を新設。**比率を rng の偶然に依存させず slot_index で決定論的に固定**
  - `generate_problem(band, rng, slot_index=0)` 化（既存 main.py の slot_index 機構を流用、rank_10 と同じパターン）
  - band_config rank=3 に `subcounts={"diff":6, "perfect_pos":11, "perfect_neg":11}` を追加
- **検証結果**:
  - `python main.py` で rank_03: 50/50 unique / 0 failed / 0 dedup_warn
  - 全 20 rank で 640/640 unique（rank 3, 4 が 50、他 18 rank が 30）
  - Node 検証スクリプト（`out/_verify_phase1.mjs`）に T5（rank_03 サマリ + Band C 内訳）と T6（Band A 共通因数の最簡化 gcd(b,c)=1, |a|≥2）を追加 → **216 PASS / 0 FAIL**
- **Phase 4 投入手順**:
  1. `diagnoseRank3InProgress` / `abandonRank3InProgress` ショートカット 2 関数を追加（dev `6fe2fb3`、汎用関数は無修正の薄いラッパー）
  2. diagnose で 3 件の in_progress を検出: sid=24027 (BP) 1件、sid=24009 (サソリ) 2件、すべて 4/27〜28 の放置セッション
  3. `abandonRank3InProgress()` で 3 件すべて 'abandoned' に書き換え、verified={ ok: 3, ng: 0 } @ 2026-04-30 05:42:35
  4. `python -m common.db_writer` で 640 行を一括投入（dry-run → 本番、全置換モード）
  5. gspread post-verification（`out/_verify_phase4_post.py` を rank_03 対応に拡張）:
     - 全 rank 行数一致（rank 3 = 50、rank 4 = 50、他 18 rank = 30）/ 合計 640 行
     - questionId / problemLatex とも重複ゼロ
     - Band C サブパターン内訳: diff=6 / perfect_pos=11 / perfect_neg=11 / ? = 0 ✓
     - rank_03 サンプル: q_03_000001 `-30x - 12y = -6(5x + 2y)` 〜 q_03_000050（Band 別に並ぶ）
- **既存挙動の温存**:
  - `factored_pair_latex` 本体は無修正（rank_03 既存ロジックは `sorted([m,n])` で正規化済）
  - Band A の符号正規化（leading 項を正に）は既存通り
  - `self_check` は既に 3 サブパターン kind を処理済みで無修正
- **次回**: 拡充計画 優先度 A の残り（rank_02 平方根）/ あるいは優先度 B（rank_05〜08）

#### 157. 自宅PC セッション終了処理（2026-04-30 早朝、dev `<this commit>`）
- **今夜の主な成果**:
  - rank_04 拡充完了（30→50題、Phase 1〜4、CLAUDE.md #155）
  - rank_03 拡充完了（30→50題、Phase 1〜4、Band C 3 サブパターン分離方式、CLAUDE.md #156）
  - **既存セッション保護機構の確立**：`diagnoseKisoInProgressByRank(rank)` / `abandonKisoInProgressByRank(rank, opts)` を汎用化、rank=N ショートカット 2 関数（diagnose / abandon）×2 ランク = 計 4 関数で在庫増。今後の単元拡充時は 1 行のショートカット追加で再利用可
- **このセッションで得た教訓（再発防止メモ）**:
  - 1. 拡充作業の「pre-flight 診断 → abandoned 化 → 投入 → 後検証」フローは安定。**今後どの単元拡充でも同パターンで進められる**
  - 2. **`diagnose / abandon の汎用関数化**：`rank` を引数にした単一実装で全ランク対応。ふくちさんからは `diagnoseRank<N>InProgress()` のような薄いショートカットで GAS エディタの関数ドロップダウンから引数なし実行可能
  - 3. **複数サブパターンの比率保証は `slot_index` 駆動の決定論的 dispatcher が有効**（rank_03 Band C で初採用、rank_10 と同じパターン）。rng の偶然に依存させない設計で、ふくちさんが指定した教育的比率 6/11/11 が**確実**に守られる
  - 4. **教育的判断は数値ベース判断より重要**：rank_03 Band C の内訳「差の平方は思考量少なめだから 6 問だけ」「完全平方プラス/マイナスはそれぞれ 11 問」というふくちさんの 36 年の塾長経験ベースの判断は、unique pool の数学的余裕（27 / 36）を見るだけでは出てこない。今後も配分は ふくちさんの教育的判断を起点に
  - 5. **既存挙動の温存原則**：今回 `factored_pair_latex` 本体は無修正のまま rank_04 / rank_03 の意図する正規化を達成（rank_04 は呼び出し側で a≤b ソート、rank_03 は元から sorted 済）。共有関数を触らない方が副作用が小さい
- **環境状態（次回再開時用）**:
  - dev = origin/dev = origin/main（同期済、ふくちさん側で main マージ・push 完了）
  - working tree clean
  - rank_04, rank_03 の問題は本番投入済（KisoQuestions シート 640 行）
  - GAS 側に診断/abandoned 関数あり（rank_03 / rank_04 ショートカット含む）
  - Python 環境（自宅PC）：3.14.4、gspread / google-auth / sympy インストール済
  - 環境変数：`KISO_GSPREAD_CREDENTIALS` / `KISO_SPREADSHEET_ID` 設定済
- **次回タスク候補**（優先順）:
  - a. **rank_02 平方根の拡充**（優先度 A 最後、所要 1.5 時間目安）
  - b. **漢字コンテンツの実装着手**（仕様書完成後）
  - c. **リスオンコンテンツの作成支援**（3〜準1級）
  - d. **商標表記のフッター追加**（軽め）
- **新スレ開始時のルーティン**:
  ```powershell
  cd C:\Users\Manager\mykt-eitango
  git checkout dev
  git pull origin dev
  ```
  `clasp pull` は禁止のまま運用継続。`gas/Code.js` への変更は常に `clasp push` で一方通行
- **次回の Phase 4 簡略化**: 既存の `diagnoseKisoInProgressByRank(rank)` / `abandonKisoInProgressByRank(rank, opts)` 汎用関数は既にあるため、新ショートカットは `diagnoseRank2InProgress()` / `abandonRank2InProgress(opts)` の 2 行追加で済む（rank_03 では `feat(GAS): rank_03 投入前診断・abandoned 化のショートカット関数` で 10 行のコミットだった）

### 2026-04-30 夕方（塾PC：和文英訳① 注意書き整理 + 基礎計算 rank_02 拡充）

#### 158. 基礎計算 rank_02 を 30題 → 50題 に拡充（Phase 1 完了、dev `5c80b48` / `0440827` / `<this commit>`）
- **背景**: 拡充計画 優先度 A の最後の単元。事前調査では「一意空間が狭い」と評価されていたが、実測では Band A=65 unique（n_max=200）、Band B=5642 unique、Band C=1927 unique と十分な余裕があり、構造的バグはなかった。むしろ既存 Band C には教育的に不自然な答え（√29×√30=√870、√19/√22=√418/22 等）が混入していたため、count 拡大と並行して教育的引き締めを実施
- **設計判断**（事前合意）:
  - count 配分 A=17 / B=17 / C=16（合計 50、ふくちさん教育的判断「ほぼ均等」）
  - Band C を rank_03 で確立した slot_index 駆動の決定論的サブパターン分離方式に移行
  - subcounts={"mul":6, "rationalize":5, "div":5}（ふくちさん指針「ほぼ均等」）
- **教育的引き締め**（ふくちさん 36 年の塾長経験ベース）:
  - **mul** 通常 a,b ∈ [2,15] / subslot 5（6 問中の最後の 1 問）のみ [16,30] かつ result_radicand ≤ 200
    - 実例: subslot 5 で `√22×√30 = 2√165` を生成（中堅レベル刺激として残す）
    - `√29×√30 = √870` 等の極端な radicand は 200 上限で除外
    - ふくちさん指針「中堅は OK / 極端なものは NG / 1〜2問が目安」を完全に満たす
  - **rationalize** b ∈ {2,3,5,6,7,10}（square-free）/ a ∈ [1,12]
    - 実例: 1/√2=√2/2、3/√5=3√5/5、12/√10=6√10/5 等の教科書頻出に集中
  - **div** 答えの denom ≤ 12 を制約
    - 実例: √27/√30=3√10/10、√10/√24=√15/6、√29/√24=√174/12 等
    - 旧 `√19/√22=√418/22` のような極端な分母は denom=22 で除外
  - mul に a≤b 正規化を追加（rank_04 Band A と同方針、`√3×√2` と `√2×√3` の数学的同一問題を統一）
- **コード変更**:
  - [common/band_config.py](scripts/generate_kiso_questions/common/band_config.py): rank_02 を新 count + subcounts 構造に
  - [rank_02_sqrt.py](scripts/generate_kiso_questions/rank_02_sqrt.py): 旧 `_gen_muldiv_rationalize`（rng ランダム選択）を廃止、`_gen_mul` / `_gen_rationalize` / `_gen_div` の 3 つに分離。`_resolve_band_c_subkind(slot_index, subcounts) -> (subkind, subslot)` で決定論的 dispatch（subslot 情報を mul に渡して subslot=5 のみ刺激範囲）。`generate_problem(band, rng, slot_index=0)` 化（main.py の slot_index 機構を流用）
  - 既存挙動の温存: Band A は無修正（n_max=200、`_gen_simplify_only`）、Band B も無修正
- **検証結果**:
  - `python main.py` で全 20 rank 生成: 660/660 unique / 0 failed selfcheck / 0 dedup_warn
  - Node 検証スクリプト [_verify_rank02.mjs](scripts/generate_kiso_questions/out/_verify_rank02.mjs)（gitignore 配下）で **13 PASS / 0 FAIL**
    - T1 rank_02 50/50 unique / T2 Band 数 17/17/16 / T3 Band A は c√d (c≥2 + square-free) / T4 Band B 非ゼロ単項 / T5 Band C-mul 6 問 a≤b + radicand≤200 / T6 Band C-rationalize 5 問 b ∈ {2,3,5,6,7,10} + 既約 / T7 Band C-div 5 問 denom≤12 / T8 rank_03/04 regression なし / T9 全 20 rank 660 問 横断重複ゼロ
- **Phase 4 投入手順（in_progress セッション影響評価込み）**:
  1. `diagnoseRank2InProgress()` / `abandonRank2InProgress(opts)` ショートカット 2 関数を追加（dev `0440827`、汎用関数は無修正の薄いラッパー）
  2. ふくちさんが GAS エディタから `abandonRank2InProgress()` を実行 → 2 件の in_progress を検出（両方とも 4 号ちゃんのテストアカウント、verified={ ok: 2, ng: 0 } @ 2026-04-30 18:22:56）
  3. `python -m common.db_writer --dry-run` で 660 行 / rank=2 が 50 行を確認
  4. `python -m common.db_writer` で本番投入（全置換モード、660 行）
  5. gspread post-verification: rank ごとの行数（rank 1 = 30、rank 2/3/4 = 50、他 16 rank = 30、合計 660 ✓）/ rank=2 Band 数（A=17, B=17, C=16 ✓）/ questionId 重複 0 / problemLatex 重複 0 / Band C サンプル目視で mul=6 / rationalize=5 / div=5 確認
  6. rank_02 サンプル: q_02_000035〜000040 が mul（最後 q_02_000040 が `√22×√30 = 2√165` 刺激枠）/ q_02_000041〜000045 が rationalize / q_02_000046〜000050 が div
- **既存挙動の温存**:
  - Band A `_gen_simplify_only` は無修正
  - Band B `_gen_addsub_with_simplify` は無修正
  - `_variants_for_sqrt` / `_variants_for_rationalized` は無修正（許容表記の生成ロジックは流用）
  - `self_check` は元々 muldiv_P1/P2/P3 を分岐処理しており新ロジックでも無修正で動作
- **次回タスク候補**: 拡充計画 優先度 B（rank_05〜08）または優先度 C（rank_11〜20）

#### 159. 基礎計算 rank_07 を 30題 → 50題 に拡充（Phase 1 完了、dev `bf29784` / `0d610af` / `<this commit>`）
- **背景**: 拡充計画 優先度 B の最初。事前調査で Band A (73,728 unique) / Band B (2,720 unique) は余裕、Band C (64 unique) もタイトだが構造的バグなしと確認。むしろ**中2 文字式の標準カリキュラムから「単項式の乗除（2x×3y=6xy、8xy÷2x=4y 等）」が抜けている**点が教育的な課題として浮上したため、count 拡大と同時に Band C のサブパターン分離で網羅させる方針に
- **設計判断**（事前合意）:
  - count 配分 A=17 / B=17 / C=16（合計 50、ふくちさん教育的判断）
  - Band C を rank_03 / rank_02 で確立した slot_index 駆動の決定論的サブパターン分離方式
  - subcounts={"power":5, "mono_mul":6, "mono_div":5}（mono_mul を 1 問多めに：生徒が最初に学ぶ基本パターンのため）
  - **異変数対応**: 2x × 3y = 6xy、3b × (-4a³) = -12a³b など
  - **分数結果対応**: 7xy ÷ 2x = 7y/2 など、既約分数係数の単項式
- **教育的拡充の動機**: 中2 文字式の標準カリキュラムは「多項式の加減 / 多項式と数の乗除 / 単項式の乗除・累乗」だが、旧 rank_07 は最後の「単項式の乗除」が抜けていた。Phase 1 でこれを補完
- **コード変更**:
  - [common/band_config.py](scripts/generate_kiso_questions/common/band_config.py): rank_07 を新 count + subcounts 構造に。kind を `monomial_power` → `mono_mixed` に変更（Band C の dispatcher 名）
  - [rank_07_expr_grade2.py](scripts/generate_kiso_questions/rank_07_expr_grade2.py) +324/-13:
    - 新ヘルパー: `_build_mono_part` / `_mono_term_latex` / `_mono_canonical_int` / `_mono_canonical_frac` / `_mono_variants`
    - 新 generator: `_gen_mono_mul`（同変数 / 異変数両対応、第2因子が負なら括弧で囲む）/ `_gen_mono_div`（整数結果と分数結果両方、結果 trivial "1"/"-1" は除外）
    - `_resolve_band_c_subkind`: rank_03 / rank_02 と同じ slot_index dispatcher
    - `generate_problem(band, rng, slot_index=0)` 化（main.py の slot_index 機構を流用）
    - `self_check` 拡張: SymPy で mul/div 結果を検証 + mono_div の既約性ガード
  - 旧 `_gen_monomial_power` は無修正（power サブパターンとして再利用）
- **`_mono_variants` の許容表記網羅**（中2 で生徒が書く全形式をカバー）:
  - 整数結果: `variants_for_polynomial` に委譲（caret 形式 `4x^2` / brace 形式 `4x^{2}` 両方）
  - 分数結果（係数分数 + 変数あり）: 5 形式 × brace/caret × マイナス 3 形（-, −, ー）
    - `\frac{N}{D}{vars}`（canonical）
    - `N/D{vars}`（前置スペースなし）
    - `N/D {vars}`（前置スペースあり、variants_for_polynomial が生成）
    - `N{vars}/D`（後置）
    - `\frac{N{vars}}{D}`（変数を分子内に）
    - 例: `-\frac{4}{3}x` から 15 variants 生成
  - 純粋分数（vars すべて約分）: `variants_for_rational` で小数形（3.5 等）も追加
- **検証結果**:
  - `python main.py` で rank_07: 50/50 unique / 0 failed selfcheck / 0 dedup_warn
  - 全 20 rank で 680/680 unique（rank 1, 5-6, 8-20 が 30、rank 2/3/4/7 が 50）
  - Node 検証スクリプト [_verify_rank07.mjs](scripts/generate_kiso_questions/out/_verify_rank07.mjs)（gitignore 配下）で **13 PASS / 0 FAIL**
    - T1 rank_07 50/50 unique / T2 Band 数 17/17/16 / T3-T4 Band A/B 線形多項式 / T5 power 5 問 / T6 mono_mul 6 問 整数係数 / T7 mono_div 5 問 既約分数 + trivial 除外 / T8 rank_02/03/04 regression なし / T9 全 20 rank 680 問 横断重複ゼロ
- **Phase 4 投入手順**:
  1. `diagnoseRank7InProgress` / `abandonRank7InProgress` ショートカット 2 関数を追加（dev `0d610af`、汎用関数は無修正の薄いラッパー）
  2. ふくちさんが GAS エディタから `abandonRank7InProgress()` を実行 → 12 件の in_progress を検出・abandoned 化、verified={ ok: 12, ng: 0 } @ 2026-04-30 20:36:47
  3. `python -m common.db_writer --dry-run` で 680 行 / rank=7 が 50 行を確認
  4. `python -m common.db_writer` で本番投入（全置換モード、680 行）
  5. gspread post-verification: rank ごとの行数（rank 1, 5-6, 8-20 が 30、rank 2/3/4/7 が 50、合計 680 ✓）/ rank=7 Band 数（A=17, B=17, C=16 ✓）/ questionId 重複 0 / problemLatex 重複 0
  6. rank_07 サンプル: q_07_000035〜000039 が power / q_07_000040〜000045 が mono_mul（最後 q_07_000045 が `2b × (-3y³) = -6by³`）/ q_07_000046〜000050 が mono_div（最後 q_07_000050 が `-5bx³ ÷ 3x³ = -5/3 b`）
- **既存挙動の温存**:
  - Band A `_gen_poly_addsub` は無修正
  - Band B `_gen_poly_int_muldiv` は無修正
  - Band C-power（旧 monomial_power）の生成ロジックは無修正、kind 名のみ "power" に変わる
  - rank_02 / rank_03 / rank_04 への影響なし（regression テストで確認済）
- **次回タスク候補**: 拡充計画 優先度 B 残り（rank_05 / rank_06 / rank_08）

#### 160. 基礎計算 rank_05 を 30題 → 50題 に拡充（Phase 1 完了、dev `27e7e24` / `6e3c0b9` / `<this commit>`）
- **背景**: 拡充計画 優先度 B の 2 つ目。事前調査では Band A=1,600 / Band B=14,400 / Band C=39,600 unique と pool 余裕大、構造的バグなし。中3「展開」のカリキュラムは既存 3 Band（基本展開 / 一般展開 / 3項×2項）で網羅済だったが、ふくちさん教育的判断で **(ax+b)² の直接展開練習を量で確保** するため Band D を新設する案 D を採用
- **設計判断**（事前合意）:
  - count 配分 A=13 / B=13 / C=12 / D=12（合計 50、均等割）
  - rank_05 は唯一の **4 Band 構成**（他のランクは 3 Band）
  - Band D = 新規 (ax+b)² 直接展開（kind="square_with_coef"）
  - Band A に (a,b) ≤ (c,d) 辞書順正規化を追加（rank_04 Band A と同方針）
- **教育的拡充の動機**（ふくちさん 36 年の塾長経験）:
  - (ax+b)² は中3生がミスしやすい典型パターン:
    - (2x)² を 2x² と書く誤り（正しくは 4x²、係数の二乗忘れ）
    - 中央項の係数倍を忘れる（2·2x·3 = 12x の処理）
    - 末項 b² の符号見落とし
  - rank_04 (x+a)² は「公式記憶」アプローチ、Band D は a ≥ 2 で差別化し「直接展開で公式を導く」量の確保を目的
- **コード変更**:
  - [common/band_config.py](scripts/generate_kiso_questions/common/band_config.py): rank=5 を 4 Band 構造（A/B/C/D = 13/13/12/12）に拡張
  - [rank_05_expr_grade3.py](scripts/generate_kiso_questions/rank_05_expr_grade3.py) +74/-14:
    - 新 generator `_gen_square_with_coef`: a ∈ [2, coef_max]（a ≥ 2 強制で rank_04 と差別化）/ b ∈ ±1〜±const_max（非零）/ canonical = poly_latex([a², 2ab, b²])
    - `_gen_two_by_two` に `normalize` パラメータ追加（Band A のみ True、Band B は False）
    - `generate_problem` の dispatch に square_with_coef を追加
    - `self_check` を square_with_coef 対応に拡張: a ≥ 2 / b != 0 ガード + 数学的展開検証
  - 既存 Band A/B/C のロジックは無修正（Band A は normalize=True パスを通すだけ）
- **検証結果**:
  - `python main.py` で rank_05: 50/50 unique / 0 failed selfcheck / 0 dedup_warn
  - 全 20 rank で 700/700 unique（rank 1, 6, 8-20 が 30、rank 2/3/4/5/7 が 50）
  - Node 検証スクリプト [_verify_rank05.mjs](scripts/generate_kiso_questions/out/_verify_rank05.mjs)（gitignore 配下）で **15 PASS / 0 FAIL**
    - T1 rank_05 50/50 unique / T2 Band 数 13/13/12/12 / T3 Band A の (a,b) ≤ (c,d) 辞書順正規化 / T4 Band B coef ≤ ±5 / T5 Band C trinomial × binomial / T6 Band D の a ≥ 2 ガード（rank_04 差別化） / T7 Band D 答えの数学的展開一致（a²x² + 2abx + b²） / T8 rank_02/03/04/07 の 50/50 unique 維持（regression なし）/ T9 全 20 rank 700 問 横断重複ゼロ
- **Phase 4 投入手順**:
  1. `diagnoseRank5InProgress` / `abandonRank5InProgress` ショートカット 2 関数を追加（dev `6e3c0b9`、汎用関数は無修正の薄いラッパー）
  2. ふくちさんが GAS エディタから `abandonRank5InProgress()` を実行 → 5 件の in_progress を検出・abandoned 化、verified={ ok: 5, ng: 0 } @ 2026-04-30 21:42:55
  3. `python -m common.db_writer --dry-run` で 700 行 / rank=5 が 50 行を確認
  4. `python -m common.db_writer` で本番投入（全置換モード、700 行）
  5. gspread post-verification: rank ごとの行数（rank 1, 6, 8-20 が 30、rank 2/3/4/5/7 が 50、合計 700 ✓）/ rank=5 Band 数（A=13, B=13, C=12, D=12 ✓）/ questionId 重複 0 / problemLatex 重複 0
  6. rank_05 Band D サンプル: q_05_000039〜q_05_000050 が Band D（12 問）。a ∈ {2,3,4,5}、b ∈ {±1, ±2, ±3, ±5, ±6} の多様な組み合わせ
- **既存挙動の温存**:
  - Band A/B/C の generator は `normalize` パラメータ追加以外無修正
  - 他ランク（rank_02/03/04/07）への影響なし（regression テストで確認済）
- **次回タスク候補**: 拡充計画 優先度 B 残り（rank_06 連立方程式 / rank_08 一次方程式・比例式）

### 2026-05-02（モニョバグ修正 + OCR 救済機能 + カンジー本体実装）

自宅PC で長時間セッション。和文英訳① のモニョ判定バグ修正・お詫びHP付与から始まり、写真提出系コンテンツ全体への OCR 注意書き展開、Cropper.js による切り抜き救済機能の共通基盤化、最後にカンジー（漢字）コンテンツの本体実装まで一気に進めた。

- **和文英訳① モニョバグ修正**（dev `83fb00f`）: `[モニョ]` の CSS 斜線マスクを廃止し、問題文に `「モニョ」`（カギカッコ付き）をそのまま表示する仕様に変更。`_normalizeWabun1` の冒頭に Step 0 を追加し、`モ + (ニ U+30CB | ノ U+30CE | 二 U+4E8C) + ョ` の OCR 誤認識を吸収（前後カッコの種類・有無を問わず統一）。`_wabun1ClassifyFeedback` に `monyo_missing` を優先度 2 として追加し、feedbackType を 7 → 8 分類に拡張。CLAUDE.md にモニョ運用ルールセクション追記。
- **お詫びHP 付与**（dev `142877c`、本番実行済）: `apologyWabun1MonyoBug_20260502()` を新設。バグ被害の 5 名に「素点HP（連続週²ボーナス込み）+ お礼 1,000HP」の 2 種を HPLog 2 行で記録し、Students.HP に加算。冪等チェックは `apology_wabun1` + message に "2026-05-02" 含む既存記録の有無で生徒単位判定。本番実行で **計 +21,600HP** 付与:
  - 24003 古内伶奈 +8,200（素点 7,200 + お礼 1,000）
  - 24040 川島桃子 +1,200（素点 200 + お礼 1,000）
  - 22029 中綾音 +8,200（素点 7,200 + お礼 1,000）
  - 24017 加藤煌生 +2,800（素点 1,800 + お礼 1,000）
  - 24039 川島杏子 +1,200（素点 200 + お礼 1,000）
- **OCR 注意書きの統一展開**（dev `7403234` / `47cf1d9`）: 「AIが誤って読み取ることがあるよ。違う場合は「もう一度撮る」を押してね（同じ写真でも結果が変わることがあるよ）」を 4 コンテンツに完全一致で展開。三語短文・基礎計算は `.wabun1-period-warn` を流用、英検5級は構造的に確認画面が無いため失敗フィードバック（`_renderPhotoFail`）の `.dictation-hint` 内に統合。和文英訳①の既存表示も「AI が」（半角スペース）+ `<strong>` ラップを除去して 4 箇所完全一致に統一。
- **写真切り抜き救済機能**（dev `41380d6`）: Cropper.js 1.6.2 を cdnjs から `defer` 読み込み。共通モーダル `#screen-crop-modal` + 共通エントリ `openCropForReOcr({sourceDataUrl, returnScreen, onCropped})` を新設。4 コンテンツ全てに「✂️ 切り抜いて再判定」ボタンを配置（和文英訳①・三語短文・基礎計算は確認画面、英検5級は失敗フィードバック内）。各コンテンツに撮影直後の dataUrl 保持フィールドを追加（`_wabun1State.lastSourceDataUrl` / `_sangoLastSourceDataUrl` / `_kisoState.photoDataUrl` / `_eikenLastSourceDataUrl`）。Cropper オプションは `viewMode:1` + `zoomable:false` でドラッグ範囲指定に特化、長辺 1600px / JPEG 0.8 で出力。将来カンジー追加時はボタン追加 + crop callback 関数 1 つで組込可能。
- **カンジー（漢字）コンテンツ本体実装**（dev `f873aae`）: 漢検 5級〜2級の 5 レベル、読み 4択 + 書き OCR の二段合格制。10問セット（読み5+書き5）= 50HP、20問セット = 100HP（連続週²ボーナス込み）。1日100HP 上限、超過時は練習モード（既存方針踏襲）。
  - **GAS**: シート定数 + ヘッダー + 初期化関数 `ensureKanjiSheets()`（冪等、GAS エディタから手動 1 回実行）。公開 API 4 関数: `getKanjiSet`（漢字IDで読み・書きをペア化、シャッフル）/ `submitKanjiYomi`（サーバー側で正解再ルックアップして 8 割判定、HP 加算なし）/ `submitKanjiKaki`（Gemini Vision で OCR → 期待解答が含まれるか照合 → 8 割合格時のみ HP 加算、写真は保存しない）/ `getKanjiTodayRawHP`（残量表示用）。HPLog type は `kanji_<level>_<count>` または `_practice` 接尾。
  - **フロント**: 8 画面追加（レベル選択 / 問題数選択 / 読み問題 / 読み結果 / 書き問題 / 書き写真確認 / 書き結果 / HP獲得演出）。`{xxx}` を `<span class="kanji-emphasis">` で赤太字レンダリングするヘルパー、4 表情の中国仙人風キャラクター演出（default / thinking / celebrate / encourage、images/kanjii-*.png 参照）+ 吹き出しセリフ、英単語RUSH と同じ 4択 UI、不合格時はシャッフルしてやり直し（読み）/ 間違えた問題だけ再提出（書き）、写真確認画面に OCR 注意書き + 切り抜きボタンを既に組込済、HP獲得演出は wabun1-result-success スタイル + 紙吹雪 + カウントアップ + chime を流用。
  - **ホーム画面のボタン**: onclick のみ更新（`showComingSoon('漢字')` → `showKanjiLevelSelect()`）。準備中バッジ・disabled クラス・「漢字」ラベルは据え置き（最終ステップで一括差し替え予定）。
- **残タスク（次回以降）**: キャラクター画像（kanjii-*.png）のリポジトリ追加 / ホーム画面「漢字」→「カンジー」+ サブタイトル追加 / ホーム「準備中」バッジ → HP バッジ差し替え / 学習履歴への kanji 専用ブランチ追加（必要に応じて、現状は extras フィールドで自動表示）/ 問題データ投入（5級から順次、別スレで作成中）。

---

## 基礎計算 問題プール拡充計画

### 現状（2026-04-30 時点）
- 各単元 約 30 題、合計約 600 題
- 一部単元（rank_04 Band C など）は数学的に重複不可避（9 unique で count=10）
- 同一セッション内の重複は生成側 + GAS 側の二重 dedup で解消済み（commit `606d949`）

### 目標
- フェーズ 1：全単元 50 題、合計 1000 題
- フェーズ 2：全単元 100 題、合計 2000 題
- 全単元で重複ゼロを保証（数学的に不可能な Band は再設計）

### 進行方針
- 1 回 1 単元ずつ、丁寧に増産
- 各単元の Band 構成、パラメータ範囲、generator を見直し
- 教育的バランスを保ちつつパラメータ空間を拡張

### 増産優先度（進捗 2026-04-30 更新）

**優先度 A（Band 不足が確定、最優先）→ 2026-04-30 完了**
- ✅ **rank_04 乗法公式**（Band C が 9 問のみ、報告バグの単元）— 完了 2026-04-30、CLAUDE.md #155
- ✅ **rank_02 平方根**（Band C 構造の整理 + 教育的引き締め）— 完了 2026-04-30、CLAUDE.md #158
- ✅ **rank_03 因数分解**（square_factor_latex で限定）— 完了 2026-04-30、CLAUDE.md #156

**優先度 B（使用頻度高）→ 進行中**
- ✅ **rank_07 中2 式の計算**（単項式の乗除を新規追加で教科書範囲を網羅）— 完了 2026-04-30、CLAUDE.md #159
- ✅ **rank_05 中3 式の計算**（Band D 新設で (ax+b)² 直接展開を量で確保）— 完了 2026-04-30、CLAUDE.md #160
- ⏳ rank_08 一次方程式
- ⏳ rank_06 連立方程式

**優先度 C（パラメータ空間が広い、余裕あり）**
- ⏳ rank_11〜rank_20（整数・小数・正負・分数の四則）

**Phase 1 全体進捗**: 5 / 20 単元完了（250 / 1000 題、25%）

### 進捗管理
- 各単元増産時に main.py の WARN ログを確認（重複検出の有無）
- 実機で数セッション解いて品質チェック
- 完了した単元を ✅ で記録
- 順序は Claude Code の判断に委任で OK

### 標準的な作業フロー
1. 既存 rank_XX_*.py の Band 構成と generator を確認
2. 一意な問題数を計測（main.py で生成 → unique_latex を見る）
3. 教育的判断：パラメータ拡張 / 新 Band 追加 / count 調整
4. Python 側を修正
5. main.py で問題生成、KisoQuestions シートに投入（db_writer.py）
6. Node テスト相当 + main.py の WARN で重複ゼロ確認
7. 実機で数セッション解いて目視チェック

### 1 単元あたりの作業時間目安
- 調査・設計：30 分
- Python 修正：30 分
- 生成・投入：15 分
- 検証：15 分
- 合計：約 1.5 時間

### 将来タスク：KisoSessions に problemLatex を保存する防衛策（Phase 2 100題化の前に着手）

**背景**: 現在の `KisoSessions.questionIds` は質問IDのみを保存し、採点・再挑戦時は `_getKisoQuestionsByIds` で `KisoQuestions` シートから都度ルックアップする設計。問題プールを差し替えると、既存の進行中セッションの questionId が新しい問題に解決されてしまい、生徒が見ていた旧問題と採点対象がずれる事故が発生し得る（rank_04 50題化時に診断＋投入順序で対処、CLAUDE.md #155 参照）。

**改善案**: `startKisoSession` でセッション作成時に `questionIds` と並んで `problemLatexes`（JSON 配列）も保存。採点・再挑戦時は KisoSessions の保存値を優先参照し、KisoQuestions ルックアップはフォールバック扱いにする。

**期待効果**:
- 問題プール変更時もセッションが破綻しない
- KisoQuestions シートが整合性を失っても採点が継続できる（耐障害性）
- 過去セッション再表示（CLAUDE.md #152）の表示も保存値優先になり安定する

**スコープ・所要見込み**:
- KISO_SESSIONS_HEADERS に列追加（既存セッションへの後方互換: 列が無ければ従来動作にフォールバック）
- `startKisoSession` 1 行追加 + appendRow 1 値追加
- `_getKisoQuestionsByIds` を呼んでいる 3 箇所（採点 / 再挑戦 / 過去セッション再表示）の参照優先順を変更
- 約 1〜1.5 時間

**着手タイミング**: 全単元 100題化（Phase 2）に進む前。50題化（Phase 1）の段階で全単元を一通り回した後に実施するのが自然。

---

## TODO（未反映の GAS 側作業）

- [ ] `Code.gs` に `saveAttempt` 新 HP 計算式を反映
- [ ] `Code.gs` に Attempts 列構成変更（氏名ルックアップ + 9 列化 + `getHistory` 列インデックス更新）を反映
- [x] `Code.gs` に `SHEET_QUOTE` / `SHEET_NOTICE` 定数追加 + `doGet` ルーティング追加 + `getQuote` / `getNotice` 関数追加（2026-04-17 完了）
- [ ] スプレッドシート: `Attempts` シートの既存データ移行（C 列挿入 + VLOOKUP + G1 リネーム + H 列挿入）
- [x] スプレッドシート: `Quote` / `Notice` シート新規作成と初期データ投入（2026-04-17 完了）
- [ ] `dev` ブランチの push と main への merge（未 push の `ee1e54f` あり）
- [ ] worktree `vigilant-rubin` の内容（`closeApp` 修正 / `loadTodayQuote` 堅牢化 / おさらいボタン移設）を main に反映
- [ ] 不要になった `screen-closed` の削除判断
- [ ] `Code.gs` の `getNotice` / `getNoticeHistory` を以下の通り更新（ダッシュボード表示を最新 1 件 → 3 件に変更、同日複数投稿時は**行番号の大きい方が後に追加された**という前提で新しい順に表示）：
  - `getNotice`: 戻り値を `{ok, notice: {...}}` → `{ok, notices: [...]}` に変更。**最新 3 件**を返す
  - `getNoticeHistory`: 同日の並び順を行番号降順でタイブレーク
  - 並び替えロジック: `date` 降順、同日は **行番号（`idx`）降順**
  - フロント側 `loadLatestNotice()` は新形式 `res.notices` を受け取り最大 3 件を描画（旧 `res.notice` 形式にもフォールバック実装済み）

  ```javascript
  // doGet 内に追加（getNoticeHistory がまだなら）
  else if (action === 'getNoticeHistory') result = getNoticeHistory();

  // 共通ヘルパー：日付降順 + 行番号（後に追加された方）降順
  function _sortNoticeRows(rows, iDate) {
    return rows.sort(function(a, b){
      var da = new Date(a.r[iDate]).getTime() || 0;
      var db = new Date(b.r[iDate]).getTime() || 0;
      if (db !== da) return db - da;
      return b.idx - a.idx; // 同日なら後に追加された行（idx 大）を先に
    });
  }

  function _readNoticeRows() {
    var sh = _ss().getSheetByName(SHEET_NOTICE);
    if (!sh || sh.getLastRow() < 2) return { rows: [], iDate: -1, iTitle: -1, iBody: -1 };
    var values = sh.getDataRange().getValues();
    var header = values[0];
    var iDate  = header.indexOf('date');
    var iTitle = header.indexOf('title');
    var iBody  = header.indexOf('body');
    var rows = values.slice(1)
      .map(function(r, idx){ return { r: r, idx: idx }; })
      .filter(function(o){ return o.r[iDate] || o.r[iTitle] || o.r[iBody]; });
    return { rows: rows, iDate: iDate, iTitle: iTitle, iBody: iBody };
  }

  function _mapNotice(o, iDate, iTitle, iBody) {
    return {
      date:  o.r[iDate] ? Utilities.formatDate(new Date(o.r[iDate]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
      title: o.r[iTitle] || '',
      body:  o.r[iBody]  || ''
    };
  }

  // ダッシュボード用：最新 3 件
  function getNotice() {
    try {
      var d = _readNoticeRows();
      if (d.rows.length === 0) return { ok: true, notices: [] };
      var sorted = _sortNoticeRows(d.rows, d.iDate).slice(0, 3);
      var notices = sorted.map(function(o){ return _mapNotice(o, d.iDate, d.iTitle, d.iBody); });
      return { ok: true, notices: notices };
    } catch(err) {
      console.error('[getNotice]', err);
      return { ok: false, message: String(err) };
    }
  }

  // 「過去の連絡事項を見る」用：全件
  function getNoticeHistory() {
    try {
      var d = _readNoticeRows();
      if (d.rows.length === 0) return { ok: true, notices: [] };
      var sorted = _sortNoticeRows(d.rows, d.iDate);
      var notices = sorted.map(function(o){ return _mapNotice(o, d.iDate, d.iTitle, d.iBody); });
      return { ok: true, notices: notices };
    } catch(err) {
      console.error('[getNoticeHistory]', err);
      return { ok: false, message: String(err) };
    }
  }
  ```

- [ ] `Code.gs` の `getWeeklyRanking` 集計ロジックを変更。HPLog の `type === 'test'` ログのみを対象に、**1 件 = 50HP 固定** で集計する（連続週数ボーナスの影響を除外）。`type === 'login'` は集計対象外。`totalHP` は Students シートの HP 列。称号は `_getTitle(streak)`。期間は `_getLastWeekRange()`。上位 10 名のみ。HPLog 列は直接インデックス（`0=timestamp / 1=studentId / 2=hpGained / 3=type`）。フロント改修は不要。実装（既存コードスタイル準拠）：

```javascript
function getWeeklyRanking() {
  try {
    const ss       = _ss();
    const logSheet = ss.getSheetByName(SHEET_HPLOG);
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    if (!stuSheet) return { ok: false, message: 'Studentsシートが見つかりません。' };

    const range = _getLastWeekRange();
    const HP_PER_TEST = 50;

    // 生徒マスタ（ニックネーム・累積HP・連続日数）
    const stuRows = stuSheet.getDataRange().getValues();
    const stuMap  = {};
    for (let i = 1; i < stuRows.length; i++) {
      const sid = String(stuRows[i][COL_ID]).trim();
      stuMap[sid] = {
        nickname: (String(stuRows[i][COL_NICKNAME] || '').trim()) || '名無し',
        totalHP:  Number(stuRows[i][COL_HP])     || 0,
        streak:   Number(stuRows[i][COL_STREAK]) || 0
      };
    }

    // HPLogから先週分の type='test' のみ件数カウント（1件 = 50HP）
    const countMap = {};
    if (logSheet) {
      const logRows = logSheet.getDataRange().getValues();
      for (let i = 1; i < logRows.length; i++) {
        if (logRows[i][3] !== 'test') continue;
        const dateStr = _toDateStr(logRows[i][0]);
        if (dateStr < range.start || dateStr > range.end) continue;
        const sid = String(logRows[i][1]).trim();
        countMap[sid] = (countMap[sid] || 0) + 1;
      }
    }

    // 上位10名を選出
    const ranking = Object.keys(countMap)
      .filter(sid => countMap[sid] > 0 && stuMap[sid])
      .map(sid => ({
        nickname: stuMap[sid].nickname,
        weeklyHP: countMap[sid] * HP_PER_TEST,
        totalHP:  stuMap[sid].totalHP,
        title:    _getTitle(stuMap[sid].streak)
      }))
      .sort((a, b) => b.weeklyHP - a.weeklyHP)
      .slice(0, 10);

    return { ok: true, ranking, period: range };
  } catch(err) {
    console.error('[getWeeklyRanking]', err);
    return { ok: false, message: String(err) };
  }
}
```

- [ ] 保護者閲覧画面（`view.html`）用の **読み取り専用** GAS API `getStudentView` を追加。`loginStudent` と違ってログインボーナス付与・streak 更新・LastLogin 書換などの副作用を一切発生させない。Students シートから指定生徒の表示用データのみを返却。フロント `view.html` から `doViewLogin()` 経由で呼び出し済み。

  1. **`doGet` ルーティングに追加**：
     ```javascript
     else if (action === 'getStudentView') result = getStudentView(params);
     ```

  2. **関数本体**：
     ```javascript
     function getStudentView(params) {
       try {
         const sid = String(params.studentId || '').trim();
         if (!sid) return { ok: false, message: '生徒IDを入力してください' };
         const sh = _ss().getSheetByName(SHEET_STUDENTS);
         if (!sh) return { ok: false, message: 'Studentsシートが見つかりません' };
         const rows = sh.getDataRange().getValues();
         for (let i = 1; i < rows.length; i++) {
           if (String(rows[i][COL_ID]).trim() !== sid) continue;
           const nickname = (String(rows[i][COL_NICKNAME] || '').trim()) || '名無し';
           const totalHP  = Number(rows[i][COL_HP])     || 0;
           const streak   = Number(rows[i][COL_STREAK]) || 0;
           // stage / title は既存の判定ロジックを流用
           const stage = (typeof _getStage === 'function') ? _getStage(streak) : 4;
           const title = _getTitle(streak);
           return {
             ok: true,
             studentId: sid,
             nickname: nickname,
             totalHP:  totalHP,
             streak:   streak,
             stage:    stage,
             title:    title
           };
         }
         return { ok: false, message: '生徒IDが見つかりません' };
       } catch(err) {
         console.error('[getStudentView]', err);
         return { ok: false, message: String(err) };
       }
     }
     ```

  3. **補足**: `_getStage(streak)` が既存コードに無ければ、`loginStudent` 内で stage を決めているロジックを抽出して共通関数化するか、このコード内にインラインで書いてください（保護者向けは stage に厳密でなくても OK なので、簡易判定で十分）

  4. **動作確認**: デプロイ後、`https://k-acdm.github.io/mykt-eitango/view.html` に生徒IDでログイン → 該当生徒の情報が表示されることを確認。かつ Students シートの `LastLogin` / `Streak` / `HP` が **書き変わらない** ことを確認

- [ ] 管理画面（`admin.html`）用の GAS API を追加。Script Properties に `ADMIN_PASSWORD` を設定後、以下の実装を `Code.gs` に追加：

  1. **Script Properties** に追加：
     - キー: `ADMIN_PASSWORD` / 値: `<管理者パスワード>`
     - GAS エディタ → プロジェクトの設定 → スクリプト プロパティ から設定

  2. **`doGet` ルーティングに追加**：
     ```javascript
     else if (action === 'adminLogin')      result = adminLogin(params);
     else if (action === 'adminAddQuote')   result = adminAddQuote(params);
     else if (action === 'adminAddNotice')  result = adminAddNotice(params);
     ```

  3. **関数本体**：

     ```javascript
     function _verifyAdmin(password) {
       const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
       return !!stored && password === stored;
     }

     function adminLogin(params) {
       if (!_verifyAdmin(params.password)) return { ok: false, message: 'パスワードが違います' };
       return { ok: true };
     }

     function adminAddQuote(params) {
       try {
         if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
         if (!params.date || !params.text)   return { ok: false, message: '日付と本文は必須です' };
         const sh = _ss().getSheetByName(SHEET_QUOTE);
         if (!sh) return { ok: false, message: 'Quoteシートが見つかりません' };
         sh.appendRow([params.date, params.text, params.author || '']);
         return { ok: true };
       } catch(err) {
         console.error('[adminAddQuote]', err);
         return { ok: false, message: String(err) };
       }
     }

     function adminAddNotice(params) {
       try {
         if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
         if (!params.date || !params.title || !params.body) return { ok: false, message: '日付・タイトル・本文は必須です' };
         const sh = _ss().getSheetByName(SHEET_NOTICE);
         if (!sh) return { ok: false, message: 'Noticeシートが見つかりません' };
         sh.appendRow([params.date, params.title, params.body]);
         return { ok: true };
       } catch(err) {
         console.error('[adminAddNotice]', err);
         return { ok: false, message: String(err) };
       }
     }
     ```

  4. **デプロイ後の確認**: `https://k-acdm.github.io/mykt-eitango/admin.html` にアクセス → 設定したパスワードでログイン → Quote / Notice 追加フォームが動作することを確認

- [ ] 三語短文コンテンツ用の GAS 実装とシート追加（2026-04-18 フロント実装済み）。ダッシュボードの「三語短文」ボタン・3画面（お題表示 / テキスト提出 / 写真提出）・管理画面（お題追加 / 提出一覧）は実装済みで、GAS 側が未実装のため現状は動作しない。
  - **進捗（2026-04-19）**: `adminAddSangoTopicsWeek`（ルーティング + 関数）は GAS エディタ側で反映済み（作業ログ #17 参照）。残りは `getSangoTopic` / `submitSango` / `adminSetSangoTeacherWork` / `adminListSangoSubmissions` と各種シート作成・ヘルパー関数（`_sangoToday` / `_sangoPrevDate` / `_readSangoTopicsByDate`）。

  1. **スプレッドシート新規作成**：
     - **SangoTopicsシート** 1行目ヘッダー: `date | level | word1 | word2 | word3 | teacher_work`
     - **SangoSubmissionsシート** 1行目ヘッダー: `timestamp | studentId | studentName | level | words | work | method`

  2. **定数追加**：
     ```javascript
     const SHEET_SANGO_TOPICS      = 'SangoTopics';
     const SHEET_SANGO_SUBMISSIONS = 'SangoSubmissions';
     ```

  3. **`doGet` ルーティングに追加**：
     ```javascript
     else if (action === 'getSangoTopic')              result = getSangoTopic();
     else if (action === 'submitSango')                result = submitSango(params);
     else if (action === 'adminAddSangoTopicsWeek')    result = adminAddSangoTopicsWeek(params);
     else if (action === 'adminSetSangoTeacherWork')   result = adminSetSangoTeacherWork(params);
     else if (action === 'adminListSangoSubmissions')  result = adminListSangoSubmissions(params);
     ```

  4. **関数本体**（表示切替は深夜3時基準 / HP加算は1日1回のみ200HP固定）：

     ```javascript
     // JST で深夜3時を日付境界とする「今日」の日付文字列（yyyy-MM-dd）
     function _sangoToday() {
       const now = new Date();
       const jst = new Date(Utilities.formatDate(now, 'Asia/Tokyo', "yyyy/MM/dd HH:mm:ss"));
       jst.setHours(jst.getHours() - 3); // 3時より前なら前日扱い
       return Utilities.formatDate(jst, 'Asia/Tokyo', 'yyyy-MM-dd');
     }
     function _sangoPrevDate(dateStr) {
       const d = new Date(dateStr + 'T12:00:00+09:00');
       d.setDate(d.getDate() - 1);
       return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
     }
     function _readSangoTopicsByDate(dateStr) {
       const sh = _ss().getSheetByName(SHEET_SANGO_TOPICS);
       if (!sh || sh.getLastRow() < 2) return [];
       const values = sh.getDataRange().getValues();
       const header = values[0];
       const iDate  = header.indexOf('date');
       const iLevel = header.indexOf('level');
       const iW1    = header.indexOf('word1');
       const iW2    = header.indexOf('word2');
       const iW3    = header.indexOf('word3');
       const iTW    = header.indexOf('teacher_work');
       const out = [];
       for (let i = 1; i < values.length; i++) {
         const r = values[i];
         if (!r[iDate]) continue;
         const ds = Utilities.formatDate(new Date(r[iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
         if (ds !== dateStr) continue;
         out.push({
           level: String(r[iLevel] || '').trim(),
           words: [r[iW1], r[iW2], r[iW3]].map(function(w){ return String(w || '').trim(); }).filter(Boolean),
           teacher_work: String(r[iTW] || '').trim(),
           date: ds
         });
       }
       return out;
     }

     // 今日のお題（各レベル）と前日の福地作品（各レベル）を返す
     function getSangoTopic() {
       try {
         const today = _sangoToday();
         const yest  = _sangoPrevDate(today);
         const tRows = _readSangoTopicsByDate(today);
         const yRows = _readSangoTopicsByDate(yest);
         const cmp = function(a,b){ return a.level < b.level ? -1 : a.level > b.level ? 1 : 0; };
         const topics = tRows.map(function(t){ return { level: t.level, words: t.words }; }).sort(cmp);
         const teacherWorks = yRows.map(function(t){ return { level: t.level, work: t.teacher_work, date: t.date }; }).sort(cmp);
         return { ok: true, today: today, yesterday: yest, topics: topics, teacherWorks: teacherWorks };
       } catch(err) {
         console.error('[getSangoTopic]', err);
         return { ok: false, message: String(err) };
       }
     }

     // 提出保存＋HP加算（1日1回のみ200HP）。HPLog の type='sango' で当日分の付与有無を判定
     function submitSango(params) {
       try {
         const sid    = String(params.studentId || '').trim();
         const level  = String(params.level     || '').trim();
         const words  = String(params.words     || '').trim();
         const work   = String(params.work      || '').trim();
         const method = String(params.method    || '').trim();
         if (!sid || !level || !work) return { ok: false, message: '必要な情報が不足しています' };

         const ss = _ss();
         const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
         if (!stuSheet) return { ok: false, message: 'Studentsシートが見つかりません' };
         const stuRows = stuSheet.getDataRange().getValues();
         let studentName = '';
         let stuRowIdx = -1;
         for (let i = 1; i < stuRows.length; i++) {
           if (String(stuRows[i][COL_ID]).trim() === sid) {
             studentName = String(stuRows[i][COL_NICKNAME] || '').trim() || '名無し';
             stuRowIdx = i;
             break;
           }
         }

         const subSheet = ss.getSheetByName(SHEET_SANGO_SUBMISSIONS);
         if (!subSheet) return { ok: false, message: 'SangoSubmissionsシートが見つかりません' };
         const now = new Date();
         subSheet.appendRow([now, sid, studentName, level, words, work, method]);

         // HPLog の type='sango' で当日分チェック
         const todayStr = _sangoToday();
         let alreadyGranted = false;
         const logSheet = ss.getSheetByName(SHEET_HPLOG);
         if (logSheet) {
           const logRows = logSheet.getDataRange().getValues();
           for (let i = 1; i < logRows.length; i++) {
             if (String(logRows[i][1]).trim() !== sid) continue;
             if (logRows[i][3] !== 'sango') continue;
             const d = Utilities.formatDate(new Date(logRows[i][0]), 'Asia/Tokyo', 'yyyy-MM-dd');
             // 3時基準で前日扱いも考慮するため _sangoToday 基準で比較
             const todayForLog = (function(ts){
               const t = new Date(ts); t.setHours(t.getHours() - 3);
               return Utilities.formatDate(t, 'Asia/Tokyo', 'yyyy-MM-dd');
             })(logRows[i][0]);
             if (todayForLog === todayStr) { alreadyGranted = true; break; }
           }
         }
         let hpGained = 0;
         if (!alreadyGranted) {
           hpGained = 200;
           if (stuRowIdx >= 0) {
             const cur = Number(stuRows[stuRowIdx][COL_HP]) || 0;
             stuSheet.getRange(stuRowIdx + 1, COL_HP + 1).setValue(cur + hpGained);
           }
           if (logSheet) logSheet.appendRow([now, sid, hpGained, 'sango']);
         }
         return { ok: true, hpGained: hpGained };
       } catch(err) {
         console.error('[submitSango]', err);
         return { ok: false, message: String(err) };
       }
     }

     // 管理画面：三語短文のお題（週単位一括追加、Excel コピペ用）
     // params.items = [{date, level, word1, word2, word3}, ...]
     //   - 3語は必須。teacher_work は別途 adminSetSangoTeacherWork で登録するためここでは常に空
     function adminAddSangoTopicsWeek(params) {
       try {
         if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
         const items = params.items;
         if (!items || !items.length) return { ok: false, message: 'データがありません' };
         for (let i = 0; i < items.length; i++) {
           const it = items[i] || {};
           if (!it.date || !it.level || !it.word1 || !it.word2 || !it.word3) {
             return { ok: false, message: (i+1) + '件目に必須項目の欠けがあります' };
           }
         }
         const sh = _ss().getSheetByName(SHEET_SANGO_TOPICS);
         if (!sh) return { ok: false, message: 'SangoTopicsシートが見つかりません' };
         const rows = items.map(function(it) {
           return [
             it.date,
             String(it.level || ''),
             String(it.word1 || ''),
             String(it.word2 || ''),
             String(it.word3 || ''),
             ''  // teacher_work は後から adminSetSangoTeacherWork で埋める
           ];
         });
         sh.getRange(sh.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
         return { ok: true, added: rows.length };
       } catch(err) {
         console.error('[adminAddSangoTopicsWeek]', err);
         return { ok: false, message: String(err) };
       }
     }

     // 管理画面：先生の作品（個別登録）
     // 既存の (date, level) 行を検索して teacher_work 列を上書きする
     function adminSetSangoTeacherWork(params) {
       try {
         if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
         const date  = String(params.date  || '').trim();
         const level = String(params.level || '').trim();
         const work  = String(params.teacher_work || '').trim();
         if (!date || !level || !work) return { ok: false, message: '必須項目を入力してください' };
         const sh = _ss().getSheetByName(SHEET_SANGO_TOPICS);
         if (!sh || sh.getLastRow() < 2) return { ok: false, message: '該当するお題が見つかりません。先に週単位一括登録をしてください' };
         const values = sh.getDataRange().getValues();
         const header = values[0];
         const iDate  = header.indexOf('date');
         const iLevel = header.indexOf('level');
         const iTW    = header.indexOf('teacher_work');
         for (let i = 1; i < values.length; i++) {
           const r = values[i];
           if (!r[iDate]) continue;
           const ds = Utilities.formatDate(new Date(r[iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
           const lv = String(r[iLevel] || '').trim();
           if (ds === date && lv === level) {
             sh.getRange(i + 1, iTW + 1).setValue(work);
             return { ok: true };
           }
         }
         return { ok: false, message: '該当する日付・レベルのお題が見つかりません。先に週単位一括登録をしてください' };
       } catch(err) {
         console.error('[adminSetSangoTeacherWork]', err);
         return { ok: false, message: String(err) };
       }
     }

     // 管理画面：三語短文の提出一覧（新しい順）
     function adminListSangoSubmissions(params) {
       try {
         if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
         const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
         if (!sh || sh.getLastRow() < 2) return { ok: true, submissions: [] };
         const values = sh.getDataRange().getValues();
         const submissions = [];
         for (let i = 1; i < values.length; i++) {
           const r = values[i];
           if (!r[0]) continue;
           submissions.push({
             timestamp:   Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
             studentId:   String(r[1] || ''),
             studentName: String(r[2] || ''),
             level:       String(r[3] || ''),
             words:       String(r[4] || ''),
             work:        String(r[5] || ''),
             method:      String(r[6] || '')
           });
         }
         submissions.sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });
         return { ok: true, submissions: submissions };
       } catch(err) {
         console.error('[adminListSangoSubmissions]', err);
         return { ok: false, message: String(err) };
       }
     }
     ```

  5. **動作確認**:
     - 管理画面「✏️ 三語短文のお題」で週の開始日（月曜）を選択 → Excel から14行（2レベル×7日）をコピーして貼り付け → プレビュー表に認識結果が表示される
     - 「お題を一括登録する」→ SangoTopics シートに14行が追加される（`teacher_work` 列は空）
     - 続けて「📝 先生の作品（個別登録）」で日付・レベルを選び作品を登録 → 既存行の `teacher_work` 列が上書きされる
     - 生徒画面ダッシュボード「三語短文」→ お題表示画面に今日のお題と前日の福地作品が表示される
     - テキスト提出・写真提出の両方で提出できる / HP加算は1日1回のみ200HPで、2回目は `hpGained:0` が返る
     - 管理画面「📋 三語短文の提出」に提出が新しい順で並ぶ
     - **注意**: items は GAS の GET クエリ `params` 内に JSON 文字列として入る。レベル2 × 7日分（=最大14件）なら URL 長は問題ないが、将来レベルを4まで増やすと URL 長が 7000 文字を超える可能性があるので、その時は `doGet` で POST 対応するか、レベル単位に分割送信する

- [ ] 三語短文「過去の提出作品」画面用の GAS API `getSangoSubmissions` を追加（生徒画面 `index.html` の「📖 過去の提出作品」ボタン・保護者画面 `view.html` の「📖 三語短文の提出作品を見る」ボタンから呼び出し）。`adminListSangoSubmissions` と違い **認証なし / studentId で絞り込み** の読み取り専用。

  1. **`doGet` ルーティングに追加**：
     ```javascript
     else if (action === 'getSangoSubmissions') result = getSangoSubmissions(params);
     ```

  2. **関数本体**：
     ```javascript
     function getSangoSubmissions(params) {
       try {
         const sid = String(params.studentId || '').trim();
         if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
         const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
         if (!sh || sh.getLastRow() < 2) return { ok: true, submissions: [] };
         const values = sh.getDataRange().getValues();
         const submissions = [];
         for (let i = 1; i < values.length; i++) {
           const r = values[i];
           if (!r[0]) continue;
           if (String(r[1] || '').trim() !== sid) continue;
           submissions.push({
             timestamp:   Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
             studentId:   String(r[1] || ''),
             studentName: String(r[2] || ''),
             level:       String(r[3] || ''),
             words:       String(r[4] || ''),
             work:        String(r[5] || ''),
             method:      String(r[6] || '')
           });
         }
         submissions.sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });
         return { ok: true, submissions: submissions };
       } catch(err) {
         console.error('[getSangoSubmissions]', err);
         return { ok: false, message: String(err) };
       }
     }
     ```

  3. **動作確認**:
     - 生徒画面「三語短文」→ お題画面の「📖 過去の提出作品」ボタンで、**自分の提出作品のみ** が新しい順に表示される
     - 保護者画面（`view.html`）「📖 三語短文の提出作品を見る」で、ログイン中の生徒の提出作品が同様に表示される
     - 他の生徒IDの作品が混ざらないこと
     - 提出ゼロの場合は「まだ提出した作品はありません。」と表示されること
