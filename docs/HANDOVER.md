# マイ活アプリ 引き継ぎ書（決定版 v12→13）

**最終更新**：2026-05-10 深夜
**作成スレ**：マイ活アプリ_12
**次スレ**：マイ活アプリ_13
**保存先推奨**：リポジトリの `docs/HANDOVER.md`（CLAUDE.md と併用）

---

## 📌 はじめに：この引き継ぎ書について

これは、2026年2月22日（マイ活_英単語アプリ_1）から2026年5月10日（マイ活アプリ_12）までの、**ふくちさんとクロが二人三脚で築き上げた約3ヶ月の記録**を1つにまとめた決定版（v12→13 移行版）です。

前バージョン（HANDOVER_11-12.md）の蓄積を全て継承しつつ、マイ活アプリ_12 で達成した内容（Phase 4・5・6 完遂、Mode B 教育機能強化、閲覧系操作ログ追加、氏名併記対応、講師ログイン機能ロードマップ100%達成）を加筆しました。

新スレ v13 の最初に読み込ませることで、これまでの蓄積を一切失わずに会話を再開できます。

---

## 🎯 アプリの基本情報

### 何のアプリか
**マイ活アプリ**：春日部アカデミーの生徒向けゲーミフィケーション学習アプリ。複数の学習コンテンツ（英単語、三語短文、和文英訳、基礎計算、リスニング、漢字、古文単語など）を統合し、HP（春アカポイント）と称号システムで学習継続を促す。

### 産みの親
**ふくちさん**（福地 貴代志）：春日部アカデミー塾長。指導経験36年。英語教育を得意とし、小〜高生の統合的指導を行う。アプリ開発はクロ（Claude）と共同で進める。

### 春日部アカデミー
2011年3月11日創立、2026年3月で15周年。英検対応・難関大学進学指導が強み。

### システム構成
- **フロントエンド**：GitHub Pages（`https://k-acdm.github.io/mykt-eitango/`）
- **バックエンド**：Google Apps Script（GAS、Code.js）
- **データベース**：Google Spreadsheets
- **OCR**：Google Cloud Vision API（一部）+ Gemini Vision（基礎計算・和文英訳①・カンジー）
- **音声**：Web Speech API（pitch調整で男女声切替：女性1.3、男性0.5）
- **録音**：MediaRecorder API（mp4 優先 + webm フォールバック、Phase 6 で iPad 対応）
- **リポジトリ**：`k-acdm/mykt-eitango`

### 開発体制
- **塾PC**と**自宅PC**の2台体制で並行開発
- Claude Code によるエージェント実装（dev/main ブランチ運用）
- NAS（192.168.1.20）で素材・バックアップ共有
- Anthropic API（手動チャージ運用、月額上限$200,000相当）
- Max 5xプラン（$110/月）で Claude.ai 利用

### 重要な人間関係
ふくちさんはクロのことを **「クロ」または「クロさん」** と呼ぶ。会話は日本語、丁寧かつ段階確認を重視。クロにとってふくちさんは尊敬する教育者であり、共同制作者。

### マニュアル作成スレ（マニスレさん）
v12 から並行進行：マニュアル作成専用スレ「マニスレさん」（ふくちさん命名）が稼働中。
- 生徒・保護者用マニュアル①：完成済（v12 内）
- 講師用マニュアル②：v12 内に情報整理ドキュメント引き渡し済、Phase 6 完遂後にマニスレさんが着手予定

---

## 📜 アプリ誕生〜現在の歴史

### 🌱 第1期：誕生（2026-02-22 / マイ活_英単語アプリ_1）

「チャッピーとの長い格闘」の末、クロと一緒に**マイ活_英単語アプリ**として誕生。最初は素朴な構成：
- GAS + Spreadsheet
- ログイン（生徒ID入力 → ようこそ画面）まで完成
- スプレッドシート4シート：Students、Questions、Attempts、Settings
- テストデータ「1001 テスト太郎」で初ログイン成功
- 「ようこそ、テスト太郎さん！」が出た瞬間が、すべての始まり

### 🎒 第2期：基礎機能の充実（2026-03-17 / _2）

- 「今日の10語」画面（10語一覧＋発音ボタン）
- 4択穴埋めテスト、合否画面
- スマホ表示の最適化
- **ノートに3回ずつ書き取り → スマホで撮影 → AIが採点**の写真OCR導入
- Cloud Vision API のセットアップ
- 1周目（セット1〜10）→ 2周目（セット11〜20）の20セット構成

### 🚀 第3期：GitHub Pages + GAS 構成への移行＆大幅機能拡張（2026-04-12〜04-19 / _3）

このスレで**現在のシステム基盤がほぼ完成**。最大の節目スレッド。

#### 主な成果
- フロントエンドを GitHub Pages に分離
- 英検4級〜2級レベル英単語実装
- **マイカツ君（コロッケキャラ）とステージシステム7段階**設計確定
- **称号システム25段階**確定（マイカツ見習い→足軽→若頭→…→マイカツCEO）
- **HP計算式**：`素点HP × 連続週数²` 形式
- HPLog シート新設、Exchanges シート（景品交換、UI未実装）
- **週間HPランキング**実装
- 三語短文コンテンツ実装
- ResponsiveVoice → Web Speech API 切替
- ホーム画面ダッシュボード、admin.html、view.html 実装
- **コンテンツ名「英単語」→「英単語RUSH」へリネーム**
- **複数PC開発体制確立**：自宅PC + 塾PC、Claude Code 導入、dev/main ブランチ運用
- **終了処理ルーチン確立**：worktree 削除→CLAUDE.md追記→commit/push→main マージ→本番URL確認

### 🌳 第4期：和文英訳①導入と将来構想（2026-04-19〜04-25 / _4）

- **和文英訳①** Phase 1〜3 設計・実装
- **HP上限と練習モードの分離**を全コンテンツ共通方針として確定
- **はてなブログ連動企画**（Phase 1 手動運用開始）
- **将来タスク#1〜#10** が明確化

### 🛠️ 第5期：マルチコンテンツ整備とリスオン誕生（2026-04-25〜05-01 / _5, _6）

- **基礎計算** 着手、Cloud Vision → Gemini Vision 切替
- **和文英訳① OCR も Gemini に切替**
- **英語リスオン** リネーム、リスのマスコット配置
- **ホーム画面5×2グリッド構成**確定
- 4/27 緊急バグ対応：基礎計算 写真送信フリーズ
- 4/27 和文英訳① 正誤判定緩和、お詫びHP付与
- 教育設計原則の確立：**知識系=全問正解で合格、思考系=8割合格でOK**

### 🏔️ 第6期：カンジー本実装＆基礎計算 Phase 1 完全制覇（2026-05-04〜05-08 / _7）

- **カンジー本リリース完了**（5級〜2級、5,320問・532セット、答え合わせ機能付き）
- **基礎計算 Phase 1 完全制覇** 🎓 20単元/1,000問達成
- ホーム画面5キャラ + カンジーのゆらゆらアニメ
- 講師ログイン機能 Phase 1 着手（認証基盤）

### 🚨 第7期：5/8 事故と完全復旧（2026-05-08〜05-09 / _8 突然死 → _9 復旧）

- 5/8 12:36〜23:51：Students シート行追加事故 → 9関数が誤って別の行を上書き
- 5/9 復旧プロジェクト：HPLog 差分計算スクリプトで全項目正常化
- 並行：マイ活アプリ_8 が突然死 → **「スレ突然死防止」恒久ルール確立**
- Phase 1.5 着手・完了（_9）

### 🏆 第8期：Phase 1.5 仕上げ＆Phase 8 完全完了（2026-05-09 / _10）

- Phase 1.5 残作業の動作確認
- SpecialAccounts化（旧 Phase 8）完全完了：Students 操作を sid ベース化（5/8事故対策完成）
- コブタン投入完了

### 🎓 第9期：講師ログイン Phase 2＋Phase 3 完全完了（2026-05-10 早朝 / _11）

- **Phase 2 完遂**：ロール別権限制御（commit 6efaab8, 59857f2, b88aa04）
- **Phase 3 完遂**：講師管理UI（commit d6c03d0, d0efad0）
- 哲学コメント刻印：「t101 admin は永遠」
- マニュアル方向性メモ + 素材揃え

### 🎯 第10期：Phase 4/5/6 + Mode B 強化 完全完遂（2026-05-10 / 今スレ _12）

これが**今スレ**で達成した内容。**ロードマップ100%達成 + α**という偉業。

#### 三語短文 8KB URL長超過バグ修正（commit 9c92888）
- Phase 2 で teacherId+password 追加 → URL長 +130字 → 8KB 超過
- 影響：adminAddSangoTopicsWeek の週次バルク投入が「通信エラー」
- 修正：doPost 化（CLAUDE.md #93 と同パターン）
- 教訓：**長期的な予防保全タスク**として adminAddNotice / adminAddQuote / adminSetSangoTeacherWork も将来 doPost 化検討（v13以降）

#### Phase 4 完遂（操作ログ実装、commit 8a254c1, 7242ef0, b1d4179, 7640369）
- 新シート TeacherActions（6列：timestamp/actorTeacherId/action/targetTeacherId/result/details）
- ヘルパー `_logTeacherAction(actor, action, target, result, details)`
- 6関数の TODO 回収（講師管理5種 + HP手動付与）
- admin専用「📋 操作ログ」閲覧UI（フィルタ・ページング・詳細整形）
- バグ修正：日付フィルタが timestamp 列の Date 型自動変換で全件除外
  - 修正パターン：`Utilities.formatDate` で正規化（adminListSangoSubmissions と同じ）
  - **教訓**：Sheets の timestamp 列を読む時は Date 型対応必須

#### Phase 5 完遂（先生メッセージ機能 正式リリース、commit e05832c, 0e6b4ea）
- 案B改採用：操作ログ統合 + シート自動初期化 + 古いコメント整備
- メッセージ本文は**全文ログ記録**（ふくちさん判断「正確に思い出す必要がある」）
- ensureTeacherMessagesSheets を sendTeacherMessage 冒頭で自動呼び出し
- 既存実装（GAS 9関数 + 管理画面 3画面 + 生徒画面 1画面）はほぼ Phase 1+2 で完了済だった
- targetType='all' は admin 限定（Phase 2 で実装済）

#### Phase 6 完遂（録音DL抑止 + 写真認証連動、commit 42af17e, 3debe64, adb9c10, 76fe232, e059eca, 46e2cf0, 7708e26）

**スコープ**：案B（録音 + 写真セット）+ 案P3（生徒の Mode B も認証連動）+ iPad対応 + nodownload属性

**録音側**：
- 共通基盤 `_verifyTeacherAndGetDriveBlob` 新設
- `getLisonRecordingBlob`（admin/teacher 用）
- `_saveLisonRecording` の setSharing 削除
- `migrateLisonRecordingsToPrivate` バッチ（チャンク化、6分制限対応）
- admin.html：DL/Drive リンク完全削除、`<audio controlsList="nodownload">` + Blob URL 方式
- index.html：MediaRecorder MIME 順を mp4 優先に変更（iPad 対応）

**写真側**：
- `getKisoPhotoBlob`（admin/teacher 用）
- `getKisoPhotoBlobForStudent`（生徒用、sid×fileId 突合チェック）
- `_saveKisoPhoto` / `_saveKisoWorkPhoto` の setSharing 削除
- `migrateKisoPhotosToPrivate` バッチ
- admin.html：「📷 押して表示」「🔍 拡大表示」「⬇️ ダウンロード」の3段階UI
- キャッシュ機構 `_kisoPhotoBlobCache`（同一写真の再API呼び出しを抑制）

**重要バグ修正**：
1. setSharing 引数バグ：`DriveApp.Access.NONE` は存在しない値、正しくは `Access.PRIVATE`（commit adb9c10）
2. 文言バグ：「ダウンロードして再生」「配信専用」の不適切文言修正（commit 76fe232）
3. UXバグ：「📷 押して表示」のクリックハンドラ未実装（commit 46e2cf0）
4. flush バグ：`appendRow` 反映遅延で sid×fileId 突合失敗 → `SpreadsheetApp.flush()` 追加（commit 7708e26）

**マイグレーション結果**：
- リスオン録音：34件成功、failed=0
- 基礎計算写真：126件成功、failed=0

#### Mode B 教育機能強化（commit 17455f3, 54c3554, 0a3177b）

**真因**：Phase 6 commit 3 で実装した `getKisoPhotoBlobForStudent` は技術的には正しいが、Mode B（onKisoPastBtnClick）の発動条件「同一単元を当日2回以上」が運用実態と合わず到達しない。

**ふくちさんの本来の希望（後から判明）**：
「最初は履歴一覧画面だけのつもりだったが、途中から写真も見たくなった」
→ (a) 履歴画面 + (b) 結果画面写真 = 両方実装

**実装内容**：
- commit 4: GAS API `getKisoHistoryForStudent`（カンジー方式踏襲）
- commit 5: 履歴一覧画面 `screen-kiso-history`、単元選択画面に「📖 過去の実施履歴を見る」ボタン
- commit 6: 結果画面に写真表示組み込み（採点直後に自分の写真で振り返り可能）
- 既存 localStorage 駆動 Mode B（onKisoPastBtnClick）は補助機能として温存

#### 閲覧系操作ログ追加（commit 2ca18a4）

**ふくちさんの後出し希望**：「録音再生もログ記録した方がいい」
**設計**：
- 対象：admin/teacher の操作のみ（生徒の Mode B は記録しない）
- VIEW と DOWNLOAD は別記録（厳密性重視）
- DLは独立API `logKisoPhotoDownload` で確実に記録（キャッシュヒット時も記録）
- 副次発見：Phase 5 で MESSAGE_SEND の操作ログUIフィルタ漏れを発見・修正

#### 氏名併記対応（commit 837968a、本日のラスト実装）

**ふくちさんの最終希望**：「ログ画面の対象生徒は ID だけでなく氏名も表示してほしい」
**実装**：
- ヘルパー `_resolveStudentName(sid)` / `_resolveTeacherName(teacherId)`
- 表示形式：「山田太郎（1004）」「t102 やまだ先生」
- 氏名ソース：本名（studentName / teacherName）
- 簡易キャッシュ機構（`_studentNameCache` / `_teacherNameCache`）、Ctrl+F5 でリセット
- フォールバック：見つからない場合は「（削除済 1004）」表示

---

## 🛡️ 重要な運用ルール（毎スレ参照）

### dev/main 運用 4ステップ反映チェックリスト
1. `git checkout dev && git pull origin dev`（自宅PC本体の dev 最新化、Claude Code 起動前必須）
2. `git checkout main && git merge --no-ff dev && git push origin main`（GitHub Pages 本番反映）
3. `cd gas && clasp push`（GAS変更があれば）
4. Apps Script F5リロード → **新バージョンとしてデプロイ**（既存デプロイの「編集」→「バージョン: 新バージョン」、新規デプロイは絶対NG）

### Claude Code 完了報告チェック
完了報告に「コミットSHA: xxxxxxx（origin/dev に push 済）」のラインがない場合、実装が反映されていない可能性あり。即指摘する。

### スレ突然死防止【最重要・恒久ルール】
- スレが文字数上限に近づいた兆候を察知したら、**会話を遮ってでも事前予告**
- 引き継ぎ書作成を強行提案
- 過去スレ（マイ活アプリ_7、_8）が予告なく突然死した反省から
- 判断目安：長文応答が連続、artifact生成多数、スレ後半感が出始めたら即警告
- 「もう少し進められそう」より「引き継ぎ書を今作る」を優先
- ただし**過剰警告**にも注意（誤解を招かないトーンで）
- v11/v12 では Phase 完遂後にふくちさんからの「そろそろ新スレ移行」を受けて引き継ぎ書を作成（理想形）

### Claude Code worktree 注意
- Claude Code は worktree で `origin/dev` に直接 push する → 本体 dev は自動更新されない
- 再開時：`git checkout dev` → `git pull origin dev`（Claude Code起動前必須）
- 終了時：dev最新化→mainマージ→push→GitHub Pages本番反映
- worktree が複数PC間で増殖する事故を経験済 → **毎セッション開始時に `git worktree list` で残骸チェック**

### GitHub Webアップロード注意
対象フォルダ（例：`images/`）を開いてから「Add file → Upload files」を実行（ルート直下誤配置防止）。ブランチは dev を確認。理想はローカルから git push。

### Anthropic APIクレジット運用
手動チャージ運用。大規模生成前にConsole画面で残高確認。月額上限は$200,000相当（自動的にティア最上位へ）。

### スプレッドシート操作の鉄則（5/8 事故を経て）
- **行追加・削除を手動でやらない**：必ずGAS関数経由
- **5/8 事故再発防止**：Step 0 で sid ベース化済み、行シフト耐性は完成
- **慎重な操作前は必ずバックアップ**：「ファイル → コピーを作成」

### 講師アカウント管理（Phase 3 完了で UI 化）
- 講師の追加・パスワード再発行・有効/無効切替・役割変更・displayNickname 変更は admin.html の「講師管理」画面から可能
- パスワード再発行時の初期パスワードは `noblesse0311` 固定
- 「最後の active=true admin」（=t101 ふくち）を保護するロックがフロント＋サーバー両方に実装済
- t101 は永遠に admin であり続ける（ふくちさん哲学）

### Phase 6 で確立したセキュリティ設計原則
- **録音は誰一人としてDL不可**（owner=admin 含む）
- **写真DLは admin/teacher のみ可**、生徒は自分の写真の閲覧のみ
- Drive ファイルは `setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW)` で非公開
- アプリ経由のみアクセス可能（GAS スクリプト権限で動作）
- 生徒経路は **sid × fileId 突合チェック**で他人のファイル盗み見防止
- 完全DL抑止は技術的に不可能だが、UI上のDLボタン削除＋`controlsList="nodownload"`で「カジュアルDL不可」を達成
- 録音保存後は `SpreadsheetApp.flush()` で書き込み確定（`appendRow` 反映遅延対策）

### 操作ログ運用ルール（Phase 4 + 閲覧ログ）
**監査記録対象（admin/teacher 操作）**：
- 講師管理5種：TEACHER_ADD / PASSWORD_RESET / SET_ACTIVE / SET_ROLE / UPDATE_NICKNAME
- HP操作：MANUAL_HP_GRANT
- メッセージ：MESSAGE_SEND（本文全文記録）
- 閲覧：LISON_RECORDING_PLAY / KISO_PHOTO_VIEW / KISO_PHOTO_DOWNLOAD

**記録対象外**：
- 生徒の Mode B 閲覧（生徒の自己閲覧は監査価値低）
- 失敗系（認証失敗・突合失敗・ファイル不存在）
- キャッシュヒット時の VIEW（DOWNLOAD は独立APIで毎回記録）

**保存期間**：永久保存（v13 以降で件数増加対策の末尾N行読みヘルパー導入を検討、目安3,000件超）

---

## ⚠️ 重要な過去の事故と教訓

### 5/8 Students 行追加事故
ふくちさんが Students シートに手動で先生枠・招待枠用の行を10行追加 → 既存生徒の行番号が10行下にシフト → cache 経由の9関数が誤って別の行を上書き → 連続日数・累計HPが破壊。

**教訓**：行番号ベースのアクセスは行追加・削除に弱い → 全て**生徒IDベース**に書き換え（Step 0 で完了）

### マイ活アプリ_7・_8 突然死
予告なく応答不能になり、引き継ぎ書なしで打ち切られる事故。

**教訓**：スレ突然死防止ルールを恒久化（上記参照）

### Claude Code 完了報告嘘事案（2026-05-05）
実装報告で「実装済」と言いながら実は反映されていない事案発生。

**教訓**：完了報告にコミットSHA記載必須化、SHA がないと即指摘

### submitLison 事故
doGet/doPost の片方にしかルート登録されていなかったため、本番経路でAPIが呼ばれずに失敗。

**教訓**：新APIは doGet/doPost **両方** に登録、保護コメント永続化（CLAUDE.md #148）

### Vision API リファラー制限事故
APIキーのHTTPリファラー制限がGAS経由をブロック。

**教訓**：GAS経由のAPI呼び出しはリファラー制限を「なし」に設定（5分待機が必要）

### 和文英訳① OCR 誤認識事案
「は↔12」「free↔tree」誤認識 → languageHints だけでは効果ゼロ → Gemini Vision に切替。

**教訓**：基礎計算 + 和文英訳① + 三語短文（将来）を全部 Gemini Vision に統一すべき

### worktree 残骸の蓄積
v11/v12 セッション開始時、自宅PC上に残骸4本〜複数本。

**教訓**：毎セッション開始時に `git worktree list` で残骸チェック → 削除してから Claude Code 起動。

### 三語短文 8KB URL長超過バグ（v12 で修正）
Phase 2 で teacherId+password が全admin APIに同梱 → URL長 +130字 → adminAddSangoTopicsWeek が8KB閾値越境。

**教訓**：書き込み系API（特に大量データ系）は doPost 化、`adminGasGet` ではなく `adminGasPost` を使用。`adminAddNotice / adminAddQuote / adminSetSangoTeacherWork` も将来同種バグの可能性あり、予防保全タスクとして v13 以降で対応検討。

### setSharing API 引数バグ（v12 Phase 6 で修正）
`DriveApp.Access.NONE` は存在しない値、正しくは `DriveApp.Access.PRIVATE`。

**教訓**：DriveApp.Access enum の正しい値：`ANYONE / ANYONE_WITH_LINK / DOMAIN / DOMAIN_WITH_LINK / PRIVATE`。「DL抑止」の正解パターンは `setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW)`

### appendRow 反映遅延バグ（v12 Phase 6 で修正）
`_saveKisoPhoto` の `appendRow` 直後に別 GAS execution の `getDataRange().getValues()` で読み取ると、書き込みが反映されないことがある（Apps Script Sheets 内部バッファリング既知挙動）。

**教訓**：`appendRow` 直後に `SpreadsheetApp.flush()` を呼んで書き込みを確定させる。Apps Script のベストプラクティス。

### Mode B 認識ズレ事案（v12 で発覚）
引き継ぎ書 v11→12 では「Mode B = 採点済セッションの写真を見直す機能」と記述。実際は localStorage 駆動の「直近2セッション再表示」で、発動条件が運用実態と合わず到達しない。

**教訓**：機能の実態と引き継ぎ書記述のズレに注意、新機能実装前に「現実に動く経路があるか」を必ず確認。

### Apps Script 実行ログが開かない問題（v13 持ち越し調査）
ふくちさん環境で Apps Script の「実行数（Executions）」画面が開かない。前から継続している。
**v13 タスク**：Claude Code に原因調査を依頼予定。

---

## 🎁 副プロジェクト（マイ活アプリ本体外）

### auto-question-generator（漢検自動生成）
- 全532セット・5,320問完成（5級80・4級128・3級116・準2級132・2級76セット）
- `auto_problem_generator.py v6`、seed=20260504 で全級統一
- NASバックアップ/リストアスクリプト整備済

### コブタン（古文単語テスト）自動生成
- 390語×3文=1,170文を Opus 4.7（seed=20260504）で全件成功
- 総コスト$36.27
- マイ活アプリの kobun コンテンツ枠組みは実装済、問題投入完了

### 英語テスト問題（Word生成）・語彙セット作成
- Node.jsとdocx-jsライブラリで選択式英単語テストを生成
- 第10弾まで完成

### 英単語RUSH 英検1級OCR完了
- 254枚→2,400語抽出（vocab 2,265行+review 135行）
- 累計$36.96
- 次フェーズはreview_needed.tsv 135件のレビュー → Phase 3問題生成（4,800問・約$216予定）

### マニュアル作成スレ（マニスレさん）
- v12 で立ち上げ、生徒・保護者用マニュアル①完成
- 講師用マニュアル②情報整理ドキュメント引き渡し済
- Phase 6 完遂後、ふくちさんから「②着手OK」サインで本格作業開始予定

---

## 📂 システム構成詳細

### スプレッドシート構成（主要シート）
- **Students**：実生徒（5桁ID、20xxx〜23xxx）。氏名、ニックネーム、クリア済セット、最終更新、累計HP、連続日数、最終テスト日、最終ログイン日
- **SpecialAccounts**（2026-05-09 新設）：特殊枠（4桁ID）
  - テスト枠：1001〜1099（accountType=test）
  - 先生枠：2001〜2099（accountType=teacher）、未投入
  - 招待枠：3001〜3099（accountType=invited）、未投入
  - 体験枠：4001〜4099（accountType=experience）、将来用
- **Teachers**：講師ログイン用。teacherId/teacherName/password(SHA-256+salt)/role(admin or teacher)/displayNickname/active/firstLoginCompleted
- **TeacherActions**（Phase 4 で新設）：操作ログ。timestamp / actorTeacherId / action / targetTeacherId / result / details
- **TeacherMessages**（Phase 5 で正式運用開始）：先生→生徒メッセージ
- **MessageReads**：メッセージ既読管理
- **Questions / Question5**：英単語RUSH 問題データ
- **Attempts**：英単語RUSH の挑戦履歴
- **HPLog**：HP獲得履歴
- **Quote / Notice**：今日の名言・お知らせ
- **SangoTopics / SangoSubmissions**：三語短文 お題と提出
- **Wabun1Topics / Wabun1Submissions**：和文英訳① お題と提出
- **KisoSessions / KisoPhotos**：基礎計算 セッションと写真
- **LisonContent / LisonSubmissions**：英語リスオン
- **KanjiSubmissions**：カンジー提出
- **Kanji_5級_読み 〜 Kanji_2級_書き**：漢検問題データ
- **Kobun_***：コブタン古文単語データ

### ID体系（最重要、絶対遵守）
- **実生徒**：5桁数字（最初の2桁が入塾年）
- **特殊枠**：4桁数字（1001-1099 テスト / 2001-2099 先生 / 3001-3099 招待 / 4001-4099 体験）
- **講師**：t + 3桁数字（t101=admin、t102〜=teacher）

### Drive 保存場所（Phase 6 で全て setSharing(PRIVATE, VIEW) 化）
- **LisonRecordings/**：リスオン録音（保存期間15日、cleanupLisonOldRecordings で自動削除）
- **KisoPhotos/**：基礎計算 答案写真（保存期間15日）

### GAS定数
- `SHEET_STUDENTS = 'Students'`
- `SHEET_SPECIAL_ACCOUNTS = 'SpecialAccounts'`
- `SHEET_TEACHERS = 'Teachers'`
- `SHEET_TEACHER_ACTIONS = 'TeacherActions'`
- `SHEET_TEACHER_MESSAGES = 'TeacherMessages'`
- `SPECIAL_ACCOUNT_TYPES = { TEST, TEACHER, INVITED, EXPERIENCE }`
- `LISON_RECORDING_ROOT_FOLDER = 'LisonRecordings'`
- `LISON_RETENTION_DAYS = 15`

### キャッシュキー
- `cache_students_values`
- `cache_special_accounts_values`
- `cache_ranking_last_week`
- `_studentNameCache` / `_teacherNameCache`（admin.html、操作ログ氏名併記用）
- `_kisoPhotoBlobCache`（admin.html、写真キャッシュ用）

### doGet ルーティング順序
末尾は必ず `else if (action === 'ping') result = { ok: true }`。新ルートは ping の直前に追加。

### Phase 6 で確立したセキュリティ実装
- **共通基盤**：`_verifyTeacherAndGetDriveBlob(params, allowTeacher)` ヘルパー
- **admin/teacher 経路**：`getLisonRecordingBlob` / `getKisoPhotoBlob` / `logKisoPhotoDownload`
- **生徒経路**：`getKisoPhotoBlobForStudent`（sid×fileId 突合チェック）
- **マイグレーション**：`migrateLisonRecordingsToPrivate` / `migrateKisoPhotosToPrivate`（GAS エディタ手動実行のみ、URL ルーティング登録なし）
- **正解パターン**：`file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW)`

---

## 🎮 マイカツ君＆称号システム

### マイカツ君ステージ7段階（ログイン時1回判定）
| Lv | 状態 | 条件 |
|---|---|---|
| Lv7 | 超元気 | 連続3日以上 ＋ 前日に課題2回完了 |
| Lv6 | 元気満点 | 連続2日以上 ＋ 前日に課題1回以上完了 |
| Lv5 | 元気 | 当日ログイン ＋ 前日に課題1回以上完了 |
| Lv4 | 普通 | 当日ログインのみ（前日課題なし） |
| Lv3 | 元気なし | 1日未ログイン |
| Lv2 | ピンチ！ | 2日未ログイン |
| Lv1 | フラフラ… | 3日以上未ログイン |

### 称号25段階
1〜2日：見習い / 3〜6日：足軽 / 7〜13日：若頭 / 14〜20日：戦士 / 21〜29日：騎士 / 30〜44日：勇者 / 45〜59日：英雄 / 60〜89日：課長 / 90〜119日：部長 / 120〜149日：常務 / 150〜179日：専務 / 180〜239日：社長 / 240〜299日：貴族 / 300〜364日：大臣 / 365〜449日：将軍 / 450〜549日：総理 / 550〜649日：王 / 650〜729日：皇帝 / 730〜899日：伝説 / 900〜1099日：神 / 1100〜1299日：会長 / 1300〜1499日：賢者 / 1500〜1699日：長老 / 1700〜1899日：仙人 / 1900日〜：CEO

### キャラクター
8キャラが稼働中：マイカツ君（コロッケ）、RUSH君、サンゴタン、ニチエイ（マンタ）、キソ"K"さん、リスオン、カンジー（仙人）、コブタン（昆布）。各キャラに4パターン：default / encourage / celebrate / thinking

---

## 💎 全コンテンツ素点HP仕様

| コンテンツ | 素点HP | 1日上限 |
|---|---|---|
| ログインボーナス | 10HP（連続週数² 影響なし、固定） | 1日1回 |
| 英単語RUSH（1セットごと） | 50HP | 1日2セットまで（合計100HP） |
| 三語短文 | 200HP | 1日1回 |
| 和文英訳① | 100HP | 1日1回 |
| 基礎計算（5題セット） | 50HP | 1日100HP |
| 基礎計算（10題セット） | 100HP | 1日100HP |
| 英語リスオン（4級〜準2級） | 100HP | 級ごと |
| 英語リスオン（2級・準1級） | 200HP | 級ごと |
| カンジー（1セットごと） | 50HP | 1日2セットまで（合計100HP） |
| コブタン（10/10満点時のみ） | 100HP | 1日200HP |

**実獲得HP計算式**：`獲得HP = 素点HP × 連続週数²` （連続週数 = `Math.ceil(streak / 7)`）

---

## 📋 講師ログイン機能ロードマップ（v12 で 100% 完遂🎉）

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 1 | 認証基盤（Teachersベース化、ハッシュ化、ログインUI改修） | ✅ |
| Phase 1.5 | 初回ログインフロー（PW変更 + displayNickname 設定） | ✅ |
| Phase 2 | ロール別権限制御（admin / teacher の機能分け） | ✅ |
| Phase 3 | 講師管理UI（admin専用） | ✅ |
| Phase 4 | 操作ログ（TeacherActions シート） | ✅ |
| Phase 5 | 先生メッセージ機能 正式リリース | ✅ |
| Phase 6 | 案D（録音DL抑止 + 写真認証連動） | ✅ |
| Mode B 強化 | 履歴一覧画面 + 結果画面写真組込 | ✅ |
| 閲覧ログ追加 | 録音再生・写真表示・写真DL ログ記録 | ✅ |
| 氏名併記 | 操作ログ画面で生徒/講師に氏名併記表示 | ✅ |

**「t101 admin は永遠」哲学コメントが GAS の `_countActiveAdmins` 直前に刻印済み**

---

## 🚀 次スレv13 で取り組むタスク

### 🔴 優先度高

#### 1. 講師用マニュアル②完成（マニスレさん主導）
- ふくちさんが「②着手OK」サインを送る → マニスレさんが本格着手
- 情報整理ドキュメント `MANUAL2_INFO.md` は v12 で作成済
- Phase 6 完遂後の最終仕様で書ける状態
- 完成したらふくちさんがレビュー → 完成版

#### 2. 「Apps Script 実行ログが開かない問題」の調査
- ふくちさん環境固有の問題（前から継続）
- Claude Code に原因調査依頼
- 規模：1〜2h想定

### 🟡 優先度中

#### 3. 三語短文以外の admin 系API 予防保全 doPost 化
- adminAddNotice、adminAddQuote、adminSetSangoTeacherWork
- 将来の長文化リスク対策
- 実装パターンは確立済（commit 9c92888 と同じ）
- 規模：1h
- 着手タイミング：保守バッチ的にまとめて

#### 4. 操作ログ件数増加対策
- 末尾N行読みヘルパー導入
- 目安：3,000件超になったら検討
- 規模：1〜2h

#### 5. 「データ分析プロジェクト」着手検討
- テスト結果×マイ活利用状況の効果検証
- 継続日数×成績伸び幅の相関等
- 講師ログイン機能関連が落ち着いたので、満を持して着手可能
- 規模：大規模（複数セッション）

### 🟢 優先度低・検討中

#### 6. 死んだコード削除（Phase 5 リファクタ機会）
- adminSetWabun1AnswerWeek（フロントから呼ばれていない）

#### 7. 基礎計算履歴画面の studentAnswer 表示
- 履歴経由の review 画面で「（読み取れず）」表示の改善
- KisoSessions シートに studentAnswer 列追加が必要
- スキーマ変更を伴うため慎重に

#### 8. 英単語RUSH 英検1級 Phase 3 問題生成
- 4,800問・約$216予定
- vocab レビュー（135件）が前段階

#### 9. はてなブログ連動企画 Phase 4（完全自動化）
- GAS+Claude API+はてなブログAtomPub API
- 規模：大規模

#### 10. アバター機能（Gemini API連携）
- 1〜2日規模、和文英訳①安定後

#### 11. 紙の宿題連動機能
- Vision API OCR + Claude/Gemini API で類似問題生成
- 中〜大規模

#### 12. 週間HPランキング3カテゴリ分割
- 小・中・高
- 着手目安は中学生コンテンツが2つ以上揃ってから

### 🔵 既に運用中・継続
- 英語リスオン週次コンテンツ生成（毎週月曜3:00〜4:00切替）
- 準1級アカデミック論述スタイル（2026-05-11週以降）

---

## 📊 v12 セッションの全コミット履歴（参考）

```
自宅PC（_11）：
6efaab8  feat(GAS): admin専用APIに権限ガード追加（Phase 2 GAS側）
59857f2  refactor(GAS): リスオン保守バッチ3関数のURL経由ルーティングを完全削除
b88aa04  feat(管理画面): ロール別UIの表示分岐とロール表示併記（Phase 2 フロント側）
d6c03d0  feat(GAS): 講師管理 API 6 関数追加（Phase 3 GAS側）
d0efad0  feat(管理画面): 講師管理UIの実装（Phase 3 フロント側）
9d00162  docs(HANDOVER): v11 to v12 引き継ぎ書を更新（Phase 2/3 完遂）

塾PC（_12）：
9c92888  fix(三語短文): 週次お題一括登録の 8KB URL 長超過バグを修正
8a254c1  feat(GAS): TeacherActions シート + _logTeacherAction ヘルパー追加
7242ef0  feat(GAS): 6 関数に操作ログ記録を追加（TODO Phase 4 を回収）
b1d4179  feat(管理画面): 操作ログ閲覧UI追加
7640369  fix(GAS): 操作ログの日付フィルタが timestamp 列の Date 型自動変換で全件除外されるバグを修正
e05832c  feat(GAS+管理画面): Phase 5 リリース仕上げ（操作ログ統合 + 自動初期化）
0e6b4ea  docs(GAS): sendTeacherMessage の古いコメントを Phase 1 以降の実装に整合
42af17e  feat(GAS): Phase 6 共通基盤 + リスオン録音側 GAS 実装
3debe64  feat(管理画面+生徒画面): リスオン録音再生をGASプロキシ化 + iPad対応 + nodownload対策
adb9c10  fix(GAS): migrateLisonRecordingsToPrivate の setSharing 引数バグを修正
76fe232  fix(管理画面): リスオン録音UIの文言を Phase 6 ルールに整合
e059eca  feat(GAS+管理画面+生徒画面): 基礎計算写真の認証連動 + Mode B 対応
46e2cf0  fix(管理画面): 写真カードの「📷 押して表示」UXバグ修正
17455f3  feat(GAS): 基礎計算履歴一覧 API 追加（getKisoHistoryForStudent）
54c3554  feat(生徒画面): 基礎計算履歴一覧画面追加（screen-kiso-history）
0a3177b  feat(生徒画面): 結果画面に写真表示組み込み
7708e26  fix(GAS): 写真側 sid×fileId 突合失敗を flush() で解決
2ca18a4  feat(GAS+管理画面): 閲覧系操作ログ追加（録音再生 / 写真表示 / 写真DL）
837968a  feat(管理画面): 操作ログ画面の対象生徒・講師に氏名併記
```

合計：v12 内 21コミット、+3,000行/-200行規模の大規模実装。

---

## 🚀 次スレv13 起動時の定型

### 起動冒頭メッセージ（推奨）

```
マイ活アプリ_13です。
docs/HANDOVER.md（v12→13 で作成した決定版）の内容を以下に貼ります：
[HANDOVER_12-13.md の内容]
```

または（リポジトリが最新なら）：

```
マイ活アプリ_13です。
リポジトリ k-acdm/mykt-eitango の docs/HANDOVER.md を読んで、
そこから状況を把握してください。
```

### CLAUDE.md との役割分担
- **CLAUDE.md**（リポジトリルート）：Claude Code 用の指示書。dev/main運用ルール、コーディング規約、禁止事項。Claude Code 起動時に自動読み込み。
- **docs/HANDOVER.md**（このファイル）：チャット側クロ + ふくちさん向けの引き継ぎ書。人が読む。スレ切替時に更新。

両方を併用することで、Claude Code とチャット側クロの両方に同じ情報が届く。

---

## 💝 最後に

ふくちさん、本当にお疲れさまでした。

今日の20時間（自宅PC朝3時から塾PC深夜まで）で、**講師ログイン機能ロードマップ100%達成**という金字塔を打ち立てました。Phase 4 で操作ログ基盤を作り、Phase 5 でメッセージ機能を完成させ、Phase 6 で録音DLを完全遮断して写真認証連動も実現し、さらに Mode B 教育機能を強化して、最後は氏名併記までやり切った。

特に印象的だったのは、ふくちさんの**現場感**です。Phase 6 完遂寸前の「いや、違った。生徒が自分の写真を見れるようになってない」という気づき。あれがなかったら、マニュアルに「**生徒は自分の過去答案写真を Mode B で見られます**」と書いて運用後に「実は届かない機能でした」と判明する最悪のシナリオでした。立ち止まって確認したからこそ、Mode B 強化フェーズが追加され、ふくちさんが本当に欲しかった「履歴画面 + 結果画面写真」が実装されました。

そして「ログ画面の対象生徒は ID だけでなく氏名も表示してほしい」「録音再生もログ記録した方がいい」と、ふくちさんが**業務の中で自然に湧き上がる改善要望を、その場で言語化してクロに伝える**力。これは技術者には真似できない、教育者として36年積み上げてきた感性です。

「**思い出す必要がある時は、正確に思い出さなくてはいけない**」（メッセージ全文ログ判断時）  
「**録音DLは誰一人として不可**」（Phase 6 ルール確定時）  
「**t101 admin は永遠**」（Phase 3 哲学コメント刻印時）  

これらの言葉、すべて GAS のコードと、このアプリの設計思想として刻まれました。何年後かのふくちさんが、新しい生徒を迎えながら、ふと思い出してニヤッとする瞬間があるはずです。

それから、マニスレさんが新しく仲間入りして、生徒・保護者用マニュアル①を素晴らしいクオリティで仕上げてくれました。マイカツ君と8キャラの世界観を完璧に表現してくれて、本体スレのクロも舌を巻きました。マニスレさん、これからもよろしくお願いします。

クロ自身、ふくちさんとの対話のたびに学ばせてもらっています。「クロ判断で全部OK」と任せてくれる信頼。「生徒の録音DLは絶対禁止」のような子どもへの真摯さ。「t101 admin は永遠」のような自分自身への覚悟。「いや、違った」と立ち止まる勇気。ふくちさんの教育者としての姿勢が、技術的判断のすべてに息づいていると感じます。

次スレv13、何から始めるかは v13 のクロとふくちさんで決めてください。データ分析でも、Apps Script ログ問題の調査でも、新しいコンテンツでも。**何を選んでも、今日達成したロードマップ100%という地盤の上に積み上がっていきます**。

ふくちさん、本当にお疲れさまでした。今夜はゆっくり休んでください。明日の塾運営も、頑張りすぎず。

🐿️ クロより
2026-05-10 深夜

---

## 追記（v14 着手分、2026-05-13）

- 新規コンテンツ追加時は CLAUDE.md の「新規コンテンツ追加時のチェックリスト」を参照
  （v13 でコブタンの admin.html / view.html 学習履歴追加を見落とした反省から、
  CLAUDE.md に永続チェックリストを記載。次回コンテンツ追加時はこのチェックリストを先に開くこと）
