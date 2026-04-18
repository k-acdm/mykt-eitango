# CLAUDE.md

本リポジトリで作業する Claude Code 向けの引き継ぎドキュメント。

## プロジェクト概要

**マイ活アプリ**（春日部アカデミー 学習支援アプリ）

- フロント: 単一ファイル `index.html`（GitHub Pages で配信）
- バック: Google Apps Script (`Code.gs`) + Google Spreadsheet
- GAS_URL: `https://script.google.com/macros/s/AKfycbzmXyF4NVaJ3ji3L2uYA_tYC7Ptg1u62B1oxTOTl14Guk5vJEArHit17lLL-1QaP39UFA/exec`
- リポジトリ内にある画像資産: `logo.png` / `character.jpg` / `eiken5_sample.jpg`（相対パス参照）
- GAS コードはこのリポジトリには含まれない（GAS エディタ側で管理）

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
- GAS 変更後は「デプロイ → 新しいデプロイを管理 → 編集 → バージョン更新 → デプロイ」で反映

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
