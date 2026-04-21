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
- GAS 変更フロー：
  1. `gas/Code.js` を編集（ローカルまたはClaude Code経由）
  2. `cd gas && clasp push` でGAS側に同期
  3. GASエディタで「デプロイ → 新しいデプロイを管理 → 編集 → バージョン更新 → デプロイ」で本番反映

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
