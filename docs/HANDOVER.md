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

---

## 本番反映の記録（2026-09-01）

### カンジー：再開した書き画面のホーム導線を隠し、書き画面にも逃げ道を出す

- 反映内容
  - 案A：再開した書き画面から「🏠 ホーム画面に戻る」を隠す（通常の初回は従来どおり表示）
  - 案C：写真送信に失敗した後だけ、撮影前の書き画面にも「LINE へ送り直す」逃げ道を出す
- 実装コミット：`8615f4c`
- **反映前の main（切り戻し先）：`cfde645a976a239fdbe106d19777c09991f0bcde`**
- **マージコミット：`3790c580d0a05990af6a565ea6256e382e3cfb88`**
- 版バッジ：`20260901-0321`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 3790c580d0a05990af6a565ea6256e382e3cfb88 && git push origin main && git checkout dev
  ```

### 送信が届いたことを各キャラクターが伝える受領メッセージ（2026-09-01）

- 反映内容
  - 7コンテンツ（基礎計算・カンジー・三語短文・和文英訳①・英単語RUSH5級書き取り・マイ課題・オリワンテス）で、
    サーバーが受け取った後にだけキャラクターが「受け取ったよ」と伝える（文言は 2026-08-18 塾長確定版）
  - マイ課題の宿題は全教科が届いたときだけ出す（一部成功では出さない）
- 実装コミット：`15f92df`（受領メッセージ）／`87f1bbb`（マイ課題の全教科条件）
  ＋ `06d1846`（HANDOVER 記録・コード差分なし）
- **反映前の main（切り戻し先）：`3790c580d0a05990af6a565ea6256e382e3cfb88`**
- **マージコミット：`660a95560d5503ea63d811c1a278597d25ed2f41`**
- 版バッジ：`20260901-0453`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 660a95560d5503ea63d811c1a278597d25ed2f41 && git push origin main && git checkout dev
  ```

### 写真を送る画面の逃げ道と、受領メッセージの出す順番（2026-09-02）

- 反映内容
  - 受領メッセージを「送信中」を見せ切った後に出す（送信中 1.5 秒 → 受領 2.5 秒 → 結果）
  - 写真を送る画面のホームボタン6箇所を LINE 案内が出る形に差し替え
    （5級書き取り／カンジー書き／基礎計算 問題／基礎計算 解答撮影／三語短文 お題／和文英訳① 問題）
  - 英検5級の「← レベル選択に戻る」を書き取り画面に出さない
    （案内を通らずに帰れる抜け道だったため。級はホーム経由で従来どおり変えられる）
  - 逃げ道の表示判定を、メモリのフラグに加えて端末に残る未送信の印でも見るようにした
    （カメラ起動で画面が読み込み直されてもフラグが消えないようにするため）
- 実装コミット：`9c59b5d`（受領の順番＋ホーム4箇所）／`21de362`（ホーム2箇所＋5級のレベル選択＋印での判定）
  ＋ `0a6ed14`（前回分の HANDOVER 記録・コード差分なし）
- **反映前の main（切り戻し先）：`660a95560d5503ea63d811c1a278597d25ed2f41`**
- **マージコミット：`911708722bbc3aa3e4770d6bce439d85d2578a64`**
- 版バッジ：`20260902-0425`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 注意：未送信の印は次のログインで先生への通知が成功すると消えるので、
  読み込み直しても逃げ道が「必ず」出るわけではない（電波が悪いままなら残る）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 911708722bbc3aa3e4770d6bce439d85d2578a64 && git push origin main && git checkout dev
  ```

### ただ帰っただけの生徒を「送れなかった」扱いにしない（2026-09-02 夜）

- 背景（生徒3名から報告）
  - 写真はサーバーに届いていて管理画面にも記録があるのに、
    「📌 送れなかった学習が1件あります」の帯が出続けていた
  - 原因＝9/2 未明に、写真を送る6画面のホームボタンを LINE 案内経由にした際、
    「分かりました」を押すと未送信の印（mykt_unsent_manual）が書かれていた。
    しかも成功しても消えない作りだったため、ただ帰っただけで未送信扱いになっていた
  - 最初に持ち込んだのは `9c59b5d`（9/2 01:14）、`21de362`（04:25）で対象画面が4→6に増えた
    ※ 8/31 版では同じ操作をしても帯は出ないことを実際に動かして確認済み
- 反映内容
  - LINE 案内を通った記録の保存先を `mykt_line_handoff` に分けた
    （未送信を数える関数がこのキーを見ないので、帯・ログアウト警告・先生への通知・
      逃げ道ボタンの4つすべてから構造的に外れる＝除外の書き忘れで再発しない）
    ★記録自体は残す（コンテンツ名と時刻）。報告があったときに辿れる
    ★先生への通知には、別の用事で通知が飛ぶときだけ「参考／LINEへ回した：…」を書き添える
      （これ単独では通知を飛ばさない＝失敗していない生徒には何も起きない）
  - 未送信の印の「束」を端末（`mykt_unsent_flow`）に残した
    （カメラ起動で画面が読み込み直されるとメモリの束が消え、
      やり直して成功しても印が残っていたため。束の名前に生徒IDを含めて巻き添えを防ぐ）
  - 未送信の帯が出ている間だけ、本文の下に帯の高さぶんの余白を足した
    （基礎計算の問題10 や「ホーム画面に戻る」が帯に隠れていたため。帯の位置は変えていない）
  - 生徒の設定の初回移行を「サーバーが3項目とも未設定のとき」だけに絞った
    （1つでも設定を持っている生徒に、残りを端末の値で埋めないため）
- 実装コミット：`aeb7556`（未送信扱いの修正・束の永続化・帯の余白）／`071cbf4`（設定の初回移行）
  ＋ `7eb57b5`（前回分の HANDOVER 記録・コード差分なし）
- **反映前の main（切り戻し先）：`911708722bbc3aa3e4770d6bce439d85d2578a64`**
- **マージコミット：`c100faa6f980b1b4f15ee760046e7493349a9ea3`**
- 版バッジ：`20260902-2251`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 反映後、配信物そのもので確認したこと
  - ホームボタン →「分かりました」→ 帯が出ない・未送信の印0件・逃げ道も出ない
  - 本当に送信に失敗したら、帯・逃げ道・ログアウト警告・先生への通知は従来どおり出る
  - 失敗 → 読み込み直し → やり直して成功 → 帯も逃げ道も消える（端末の束が効いている）
  - 帯が出ていても、ページ末尾で隠れる中身が無い（body に 70px の余白が付く）
  - 6画面ともホームボタンは LINE 案内を通る（黙って帰れない状態は維持）
- 注意：この修正は「これから印が付かないようにする」もの。
  すでに端末に付いている印は、次のログインで先生への通知が成功したときに消える。
  今すぐ消したい生徒には、一度ログアウト → ログインしてもらうのが早い
- 注意：帯は画面下に貼り付いたままなので、途中までスクロールした瞬間は
  そのとき一番下にある行に重なる。今回の余白で保証したのは
  「どの内容もスクロールすれば必ず帯の外に出せる＝読めなくなるものが無い」こと
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 c100faa6f980b1b4f15ee760046e7493349a9ea3 && git push origin main && git checkout dev
  ```

### カンジー：書きに進んだ時点で問題の並びを確定する（2026-09-03）

- 反映内容
  - 書き画面に入った時点で「いま出している並び」を端末に保存し、再開しても同じ並びで出す
    （読みのシャッフルは四択のために残すが、書きには持ち込まない）
  - 過去のセッションボタンを押しても「書きまで進んだ」印を消さないようにした
    （消すと以後の自動再開がずっと読みからになってしまうため）
  - 「最初から新しくやり直す」に「問題が新しくなるので、今書いた分は使えなくなります」を添えた
  - 過去のセッションボタンを畳んだ（見出し「📚 過去のセッションを見直す」は残す）
- 実装コミット：`1507218`（カンジーの並び確定ほか）
  ＋ `d672b2e`（前回分の HANDOVER 記録・コード差分なし）
- **反映前の main（切り戻し先）：`c100faa6f980b1b4f15ee760046e7493349a9ea3`**
- **マージコミット：`17d4fda883b9da5cbedc58e62d88b8a848ab9c1b`**
- 版バッジ：`20260903-0058`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 17d4fda883b9da5cbedc58e62d88b8a848ab9c1b && git push origin main && git checkout dev
  ```

### 管理画面：写真・録音・HP内訳の取得をPOST化しURLにパスワードを載せない（2026-09-03 夜）

- 背景
  - admin.html の adminGasGet は全リクエストに講師の teacherId + password を自動付与する。
    GET だとそれが URL に載り、アクセスログに平文で残る。
  - サーバー（AWS）は GET と POST で別ルーティングのため、POST 未登録の action を
    POST に変えると unknown action で管理画面が壊れる。よって「サーバーが既に POST を
    受け付ける」ことを実測できた 11 箇所だけを、この第1段で置き換えた。
- 反映内容（adminGasGet → adminGasPost の1語置換のみ・11箇所）
  - getKisoPhotosList / getKisoPhotoBlob / logKisoPhotoDownload
  - getMyTaskPhotosList / getMyTaskPhotoBlob
  - getLisonRecordingBlob / adminGetStudentHpBreakdown / setSurveyActive
  - ★残り 78 箇所（POST 未登録）は1文字も触れていない。GET のまま
  - 写真・録音の DL は JSON の base64 をクライアント側で Blob 化しており、
    URL を直接叩かないため POST 化しても壊れない
- POST で正しいデータが返ることは塾長がコンソールで実測済み
  （getKisoPhotosList / getMyTaskPhotosList / adminGetStudentHpBreakdown の
   GET/POST 応答一致、写真一覧が生徒25名分 POST で返ることを確認）
- 実装コミット：`5e904eb`
  ＋ `5867269`（前回分の HANDOVER 記録・コード差分なし）
- **反映前の main（切り戻し先）：`17d4fda883b9da5cbedc58e62d88b8a848ab9c1b`**
- **マージコミット：`ead584d31baff7e0bc948e9b23bee49c8acb557c`**
- 版バッジ：`20260903-2333`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 反映後、配信物で確認したこと
  - admin.html：adminGasGet 80 / adminGasPost 59（置換前 91/48 から ±11 で整合）
  - 11 action が POST 側にある／78 箇所の代表 action（adminListStudents 等）は GET のまま
  - 生徒画面（index / view）はバッジ以外の実質差分ゼロ
- ★次の段（第2段・書き込み系6種のPOST登録）は AWS 側の作業。別途投げる：
  adminSangoStar / adminSangoPublish / adminSetSangoComment /
  adminSetWabun1Comment / adminSetSangoTeacherWork / adminQuestionRead
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 ead584d31baff7e0bc948e9b23bee49c8acb557c && git push origin main && git checkout dev
  ```

### 管理画面：書き込み系6種を POST 化しURLに本文とパスワードを載せない（2026-09-04）

- 反映内容
  - 三語短文の星付け／公開／コメント、和文英訳①のコメント、先生の作品登録、問題の読み取りの6種を
    `adminGasGet` → `adminGasPost` に切り替え（サーバー側 03361dc で POST 受付の登録済み、GET も残っている）
  - コメント本文とパスワードが URL に載らなくなる
  - 6種はいずれも `adminGasGet` の直接呼び出し1箇所ずつで、`submitAdminForm` 等の共通経路は通っていないため
    他の action への巻き込みなし（配信物で 6種=POST / 6種以外86種は従来どおりを確認）
  - 生徒画面（index / view）はバージョンバッジ以外の変更なし
- 実装コミット：`0017711`（6種の POST 化）
  ＋ `208f67a`（前回分の HANDOVER 記録・コード差分なし）
- **反映前の main（切り戻し先）：`ead584d31baff7e0bc948e9b23bee49c8acb557c`**
- **マージコミット：`7974dec3a0be9aad82ddf7be7c82a038d6d59733`**
- 版バッジ：`20260904-0520`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 実際の書き込み動作はテスト枠で要確認（ローカルでは通信を差し替えた経路確認まで）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 7974dec3a0be9aad82ddf7be7c82a038d6d59733 && git push origin main && git checkout dev
  ```

### 和文英訳①：合格の結果画面に直接ホームの出口を追加（2026-09-04）

- 背景・事象
  - 和文英訳①で写真送信に成功しHPを獲得した後、ホームへ戻ると
    LINE案内（「写真を送り直してください」）が出ていた（送信成功なのに出る＝実害）。
  - 原因＝結果画面にホームボタンが無く、唯一の出口「← 問題画面に戻る」が
    9/2に差し替えた問題画面（photoEscapeToHome force=true）へ導くため。
    force=true は送信成否に関わらず必ずLINE案内を出す。
- 反映内容
  - _showWabun1Result の合格分岐（res.allCorrect が真）の body にだけ、
    goHome() を呼ぶ直接ホームボタンを動的に足した。
  - ★不合格（else節）には足さない＝逃げ道にならない。
    提出未完了・送信失敗では本関数自体が呼ばれない＝途中では出ない。
  - alreadyGranted（当日2回目の合格）も allCorrect=true なので含まれる。
  - 問題画面のホームは photoEscapeToHome のまま＝「問題画面で黙って帰らせない」を維持。
  - 三語短文は完了画面(sango-done)に既に goHome() の直接ホームがあり、採点が無く
    完了画面は提出成功でのみ到達するため、追加不要と判断（既存で成功後に直接帰れる）。
- 実装コミット：`0d3469d`
  ＋ `d050b20`（前回分の HANDOVER 記録・コード差分なし）
- **反映前の main（切り戻し先）：`7974dec3a0be9aad82ddf7be7c82a038d6d59733`**
- **マージコミット：`cf1c34c2f83646033913ed8f98ce208ba34f78ae`**
- 版バッジ：`20260904-2254`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 反映後、配信物そのもので確認したこと
  - 合格の結果画面 → 足したホーム（goHome）で直接帰れる（LINE案内なし）
  - 不合格の結果画面 → ホームボタンが出ない（逃げ道でない）
  - 問題画面のホーム → photoEscapeToHome('wabun1', true) のまま
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 cf1c34c2f83646033913ed8f98ce208ba34f78ae && git push origin main && git checkout dev
  ```

### サンゴタンの今週の秀逸作品を保護者画面(view.html)にも表示 ＋ 生徒画面タイトル文言更新（2026-09-05）

- 背景・内容
  - 生徒画面(index.html)にあった「サンゴタンが選んだ今週の秀逸作品」を、
    保護者画面(view.html)にも新規表示（保護者にも子ども達の良い作品を見せる）。
  - 併せて両画面のセクションタイトルを新文言
    「🐠 サンゴタンが選んだ今週の三語短文秀逸作品」に統一（コンテンツ名を明示）。
- 反映内容（view.html への移植）
  - 置き場所＝ランキングの下・連絡事項の上（dash-section）。
  - 今週の秀逸作品カードのみ（★殿堂アーカイブは含めない）。
  - ★保護者はクリック遷移しないのでカードに onclick を付けない。
  - エスケープは view.html 既存の `_esc` を使用（他生徒作品の XSS 対策）。
  - `_doDirectView` の `loadLatestNotice()` 直後に `loadSangoWeeklyFeatured()` を呼ぶ。
  - `getSangoWeeklyFeatured` は無認証パブリックのため★サーバー(GAS)変更なし。
  - 本人向け既読管理（`_isSangoStarredSeen` 等）は保護者に不要なので写していない。
  - 生徒画面は【B】タイトル1行の変更のみ（殿堂ボタン等は不変）。
- 実装コミット：`9312ac5`
- **反映前の main（切り戻し先）：`cf1c34c2f83646033913ed8f98ce208ba34f78ae`**
- **マージコミット：`b2a1b4b1f5dfcc2a3e566d8f7bf539aba12bfd0a`**
- 版バッジ：`20260905-0028`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 反映後、配信物そのもので確認したこと
  - 生徒画面のタイトルが新文言「🐠 サンゴタンが選んだ今週の三語短文秀逸作品」
  - 保護者画面に秀逸作品セクション（loadSangoWeeklyFeatured / _renderSangoFeaturedCard）が載っている
  - 保護者画面のタイトルも新文言
  - 保護者の既存表示（ランキング・連絡事項・「お子様の学習状況を見る」）が健在
  - 削除行は全8行のうち実コード削除は index.html の旧タイトル1行のみ、残り7行は版スタンプ
  - ※ライブGASの実データでカードが実際に描画される最終確認は、有効な保護者トークンと
    「今週の⭐認定作品」が必要なため未実施（＝確かめていない）。表示経路はコードと
    静的スナップショットのDOM実測でPASS。
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 b2a1b4b1f5dfcc2a3e566d8f7bf539aba12bfd0a && git push origin main && git checkout dev
  ```

### 和文英訳①：生徒用「過去の提出とコメント」履歴画面を追加（2026-09-05）

- 背景・内容
  - 生徒が自分の和文英訳①の過去提出と、そこに付いた**先生コメントを見られる**ようにする。
  - 保護者画面(view.html)の `getWabun1Submissions` は既に teacher_comment を返して
    いたが、生徒画面がそれを呼んでいなかっただけ。★サーバー(GAS)変更なし。
- 反映内容（index.html への追加のみ・削除ゼロ）
  - 手本＝三語短文の `showSangoHistory()` をそのまま踏襲。
  - 入口ボタン「📖 過去の提出作品」＝問題画面(screen-wabun1-topic)の
    「📚 過去の問題と正解」直下（三語短文と同じく復習系ボタンをまとめる配置）。
  - 新画面 `screen-wabun1-history` ＋ `showWabun1History()`。
  - `cachedGasGet({action:'getWabun1Submissions', studentId:_studentId})` で本人の提出のみ取得。
  - 三語短文との差異：level/words 無し、date（YYYY-MM-DD）表示、skip_questions 対応。
  - コメントは既存と同じ青枠（💬 先生からのコメント）で表示。
  - view.html は無変更（版バッジのみ stamp-version が更新）。三語短文の履歴と
    9/4 の和文英訳①合格画面ホームボタンは無改変。
- 実装コミット：`e326323`
- **反映前の main（切り戻し先）：`b2a1b4b1f5dfcc2a3e566d8f7bf539aba12bfd0a`**
- **マージコミット：`7c5fa8d64ad1847466b518e76eac019941bbd91d`**
- 版バッジ：`20260905-0349`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `showWabun1History` / `screen-wabun1-history` が載っている
  - ゲート判定 49 行は全て `+`（追加のみ）＝本履歴機能そのもの、削除行ゼロ
  - view.html の差分は版バッジ1行のみ（履歴ロジックの混入なし）
  - ※ライブGASの実データでの提出一覧・コメント描画の最終確認は、有効な生徒ログインと
    先生コメント付き提出データが必要なため未実施（＝確かめていない）。表示経路は
    ローカル配信＋スタブ応答での DOM 実測（date/コメント青枠/skip/level無し/語チップ無し・
    空/失敗/戻る導線・三語短文の非回帰）で PASS。
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 7c5fa8d64ad1847466b518e76eac019941bbd91d && git push origin main && git checkout dev
  ```

### 写真送信LINE案内カードの文言変更（見出し追加＋「ボクら」）（2026-09-05）

- 背景・内容
  - 写真送信の逃げ道カード（`#photo-escape-overlay`）の文言が「送り直してください」
    のみで、★問題画面から帰っただけ（force=true）でも出るため「送ってないのに
    送り直せ」と不自然だった。見出しを足し「送った／送っていない」両方を拾う文言に。
  - このカードは5コンテンツ（eiken5 / sango / wabun1 / kiso / kanji）が共通で使う
    1箇所（index.html:6470）。ここを直すと5コンテンツ全部に反映される。
- 反映内容（index.html の文言のみ・1箇所）
  - 見出し（太字・error バブル色 #9a3412）「答案の写真が届いてないけど、送りましたか？」を新設。
  - 本文「もし送ったのであれば、通信の不具合によってボクらの方に届いてないので、
    『春アカ公式LINE』の方に送り直してください。先生がそれを見てHPを付与します。」
  - ★photoEscapeToHome / _photoEscapeConfirmed / LINE handoff 記録には一切触れず。
  - カードが出る条件（5コンテンツ・force / 失敗後）は不変。リスオン録音には従来どおり出ない。
  - view.html / admin.html は無変更（版バッジのみ stamp-version が更新）。
- 実装コミット：`f53c088`
- **反映前の main（切り戻し先）：`7c5fa8d64ad1847466b518e76eac019941bbd91d`**
- **マージコミット：`8979defc14bf0cdb191bbe5e74aa5c38e7a6855d`**
- 版バッジ：`20260905-0438`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 反映後、配信物そのもので確認したこと
  - ゲート判定 3 行は全て意図した文言変更（旧文言1行削除＋新見出し・新本文2行追加）。
  - 削除行の全数：実コード削除は旧文言1行のみ、残り7行は版バッジ／CDNの `?v=` 更新。
  - 配信 index.html に新文言（見出し「答案の写真が届いてないけど…」・本文「ボクら…」）が載っている。
  - view.html の差分は版バッジ1行のみ（ロジック混入なし）。
  - 反映前のローカル実測：5コンテンツすべてでカード表示・見出し太字(#9a3412)・本文「ボクら」・
    「分かりました」でホーム復帰・LINE handoff 5件記録・リスオン非表示（配線0）を DOM 実測で PASS。
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 8979defc14bf0cdb191bbe5e74aa5c38e7a6855d && git push origin main && git checkout dev
  ```

### 和文英訳①：先生コメントの「新着あり」バッジを履歴入口に追加（2026-09-05）

- 背景・内容
  - 生徒が先生コメントの新着に気づけるよう、和文英訳①の履歴入口ボタン
    「📖 過去の提出作品」に赤い新着バッジ（🔴 NEW）を追加。
  - サーバー側は実装済（59e421b、`getUnreadCommentCount` / `markCommentsViewed`）。
    案2＝「最後に履歴を開いた日時より後のコメントを新着」。★本反映でDBテーブルも作成済＝バッジが実際に生きる。
- 反映内容（index.html のみ）
  - 入口ボタンに既存 `.msg-home-badge` クラスを流用（新部品は作らない）、id は別 `wabun1-comment-badge`。
    件数は出さず「🔴 NEW」の印のみ。
  - `loadWabun1CommentBadge()` を新設し、ホーム表示時（`showWelcome` / `goHome`）に
    `loadUnreadMessageCount` の隣で `getUnreadCommentCount(content='wabun1')` を取得。
  - 履歴を開いたら `markCommentsViewed(content='wabun1')` を呼びバッジを即消し。
  - 失敗（テーブル未作成含む reject / ok:false）は黙って非表示＝画面は壊さない。
  - 先生メッセージ未読バッジ（`msg-home-badge`）・HP/提出/採点ロジックには一切触れない。
  - view.html / admin.html は無変更（版バッジのみ stamp-version が更新）。
- 実装コミット：`6fb6025`
- **反映前の main（切り戻し先）：`8979defc14bf0cdb191bbe5e74aa5c38e7a6855d`**
- **マージコミット：`0c9e78d6485ff4c6db77be92d665cd9870a98d44`**
- 版バッジ：`20260905-0520`（index / view / admin の3ファイル）
- GitHub Actions：success ／ 配信物と origin/main の sha256 は3ファイルとも一致
- 反映後、配信物そのもので確認したこと
  - ゲート判定 24 行は全て意図したバッジ実装（旧・入口ボタン1行削除＋バッジ付き版・関数・呼出）。
  - 削除行の全数：実コード削除は旧・入口ボタン1行のみ、残り7行は版バッジ／CDNの `?v=` 更新。
  - 配信 index.html に `wabun1-comment-badge` / `loadWabun1CommentBadge` /
    `getUnreadCommentCount` / `markCommentsViewed` が載っている。
  - view.html の差分は版バッジ1行のみ（ロジック混入なし）。
  - 反映前のローカル実測（スタブ）：新着あり→バッジ表示（🔴 NEW・件数なし）／履歴を開く→
    markCommentsViewed(content=wabun1) 呼出＋バッジ消滅／失敗(reject・ok:false)でも壊れず非表示／
    先生メッセージ未読バッジ併存／9/5 履歴画面の非回帰、を DOM 実測で PASS。
  - ※実DBテーブルでの実データ挙動（実際に新着が出て既読で消える）の最終確認は、先生コメント付き
    提出データと生徒ログインが必要なため配信環境では未実施（＝確かめていない）。表示経路は
    ローカル実測でPASS、テーブルは本反映で作成済み。
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 0c9e78d6485ff4c6db77be92d665cd9870a98d44 && git push origin main && git checkout dev
  ```

### 三語短文：提出したらカード非表示＋先生コメント「注目！」バッジ ／ 和文英訳①：合格したらカード非表示・バッジ文言（2026-09-05）

- 背景・内容（塾長方針＝「問題に足を踏み入れたら合格/提出まで逃がさない。正規に完了したら邪魔物は出さない」）
  - 和文英訳①：合格した生徒が結果画面→「← 問題画面に戻る」→問題画面→ホームと進むと
    LINE案内カード（`photo-escape-overlay`）が出る2段階経路の罠が残っていた（生徒「いつも出る」）。
  - 三語短文：採点が無い＝提出で完了。提出後にお題画面へ戻ってホームを押すと同じカードが出ていた。
  - 併せて、和文英訳①バッジ文言を「NEW」→「注目！」に変更。三語短文にも同じ先生コメント新着バッジを新設。
- 反映内容（index.html のみ。ロジックは生徒画面のみ）
  - 和文英訳①：`_wabun1State.passedToday` を新設。**`res.allCorrect === true` のときだけ**立てる
    （`hasSubmitted` は不合格でも立つため使わない）。問題画面ホームを `wabun1HomeFromTopic()` に差し替え、
    真なら `goHome()`（カード無し）／偽なら従来どおり `photoEscapeToHome('wabun1', true)`。
  - 三語短文：`_sangoSubmittedToday` を新設。**提出成功の一点でだけ**立てる
    （`submitSangoText` 成功／`confirmSangoPhoto` 成功）。お題画面ホームを `sangoHomeFromTopic()` に差し替え。
  - 逃げ道防止：どちらも新規入場（`showWabun1Topic`／`showSangoTopic`）でリセット、
    ログアウト（`_doLogoutFinalize`）でクリア、localStorage 不使用（サーバー真実のみをキーに）。
  - 三語短文バッジ：履歴入口「📖 過去の提出作品」に `.msg-home-badge` を流用（id は別 `sango-comment-badge`）。
    `loadSangoCommentBadge()` を新設し `showWelcome`／`goHome` で `getUnreadCommentCount(content='sango')` を取得（件数なし・「🔴 注目！」の印のみ）。
    履歴を開いたら `markCommentsViewed(content='sango')` を呼び即消し。失敗は握り潰して非表示（画面は壊さない）。
  - 先生メッセージ未読バッジ（`msg-home-badge`）・和文英訳①バッジ（content='wabun1'）・他コンテンツ（kiso/kanji/eiken5）・星付け/公開/提出/採点ロジックには一切触れない。
  - view.html / admin.html は無変更（版バッジのみ stamp-version が更新）。
- 実装コミット：`8e3327d`（和文英訳①合格カード非表示）／`7a93a6c`（バッジ文言 注目！）／`83c62d6`（三語短文）
- **反映前の main（切り戻し先）：`0c9e78d6485ff4c6db77be92d665cd9870a98d44`**
- **マージコミット：`13ea84f86d59f8c4cef92b7c8cdba46e6021bf25`**
- 版バッジ：`20260905-1906`（index / view / admin の3ファイル）
- 反映前チェック：本番 `getUnreadCommentCount?content=sango` が正常応答することを確認
  （`?params=` 形式で実測 → `{"ok":true,"content":"sango","hasUnread":false}`。対照 content=wabun1 も同形で正常）。
  ＝サーバー側（5772780）と `comment_updated_at` 列は本番稼働中で、今日のような「列が無いのに呼ぶ」ずれは起きない。
- GitHub Actions：success（run 33967426932）／git blob（コミット実体）と配信物の sha256 が3ファイルとも一致
  （index `72ae27fb…` / view `161dcc6c…` / admin `7149f29e…`。※ローカル作業ツリーは CRLF のため一致比較は git blob 基準で実施）。
- 反映後、配信物そのもので確認したこと
  - ゲート判定 68 行は全て意図した三語/wabun1 の変更（`_sangoSubmittedToday`×7・`loadSangoCommentBadge`・
    `sango-comment-badge`・`sangoHomeFromTopic`・`passedToday`×10・`wabun1HomeFromTopic`・「注目！」）。想定外なし。
  - 削除行の全数：実コード削除はお題/問題画面ホームの旧 onclick 2行（分岐関数へ差し替え）＋版バッジ/CDN `?v=` 更新のみ。
  - 配信 index.html にホーム分岐関数（`onclick="sangoHomeFromTopic()"`／`onclick="wabun1HomeFromTopic()"`）が載り、
    ボタンからの旧 `photoEscapeToHome('sango'/'wabun1', true)` 直呼びは消滅（分岐関数内のみ）。
  - 反映前のローカル実測（実コード関数本体をNodeで再現）：
    A1 合格/提出→戻る→ホーム=カード無し／A2 未提出→ホーム=カード（逃げ道でない）／
    A3 提出→ログアウト→再入場=非継承カード／B4 新着→バッジ表示／B5 履歴で markCommentsViewed(sango) 呼出+消灯／
    B6 `getUnreadCommentCount` 失敗でも壊れず非表示、を PASS（wabun1 5/5・三語+バッジ 10/10）。
  - ※実DBテーブルでの実データ挙動（実際に新着が出て既読で消える／実機で罠が消える）の最終確認は、
    先生コメント付き提出データと生徒ログインが必要なため配信環境では未実施（＝確かめていない）。
    表示経路・分岐ロジックはローカル実測でPASS、本番APIは正常応答を確認済み。
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 13ea84f86d59f8c4cef92b7c8cdba46e6021bf25 && git push origin main && git checkout dev
  ```

### 切り抜き「✂️ 切り抜いて再判定」後のフリーズ修正（2026-09-06）

- 背景・内容（2026-05-02 の切り抜き機能追加以来の既存バグ。今日の改修とは無関係）
  - 切り抜きモーダル（`screen-crop-modal`）で「✂️ 切り抜いて再判定」を押すと、再OCRは走って結果も出るが、
    モーダルから出る `showScreen` が抜けていたため結果が裏の写真画面に描かれ、画面がフリーズしたように見えていた。
  - `kiso`/`kanji` は `onCropped` で `showScreen(confirm)` 済み＝固まらない。抜けていたのは `sango`/`wabun1`/`eiken5` の3つ。
- 反映内容（index.html のみ。各 `onCropped` の再OCR呼び出しの直前に `showScreen` を1行追加）
  - 三語短文：`sendSangoPhoto` の前に `showScreen('screen-sango-photo')`
  - 和文英訳①：`sendWabun1Photo` の前に `showScreen('screen-wabun1-topic')`
    （失敗メッセージ `wabun1-camera-msg` は topic 画面にあるため topic に戻す。成功時は `sendWabun1Photo` が `screen-wabun1-confirm` へ遷移）
  - 英検5級：`sendPhoto` の前に `showScreen('screen-dictation')`
  - 切り抜き機構（`openCropForReOcr`/`applyCropForReOcr`/`cancelCropForReOcr`）・再OCR関数・HP/提出/採点・
    今日の基本方針/バッジ/受領メッセージには不干渉。`kiso`/`kanji` は無変更。追加のみ（実コード削除ゼロ）。
  - view.html / admin.html は無変更（版バッジのみ stamp-version が更新）。
- 実装コミット：`37512da`
- **反映前の main（切り戻し先）：`63c318653011a5d8e21f9e58dbbf7144601a8644`**
- **マージコミット：`93881537a812dd1a081fecc448b796dd1e71fc4a`**
- 版バッジ：`20260906-0030`（index / view / admin の3ファイル）
- GitHub Actions：success（run 33975891257）／git blob（コミット実体）と配信物の sha256 が3ファイルとも一致
  （index `f2996051…` / view `a7824a93…` / admin `715629d5…`）。
- 反映後、配信物そのもので確認したこと
  - ゲート判定 11 行は全て意図した3つの `showScreen` 追加＋説明コメント（sango-photo / wabun1-topic / dictation）。想定外なし。
  - 削除行：スタンプ（版バッジ・CDN `?v=`）以外の実コード削除はゼロ（追加のみの修正）。
  - 配信 index.html に `showScreen('screen-sango-photo')` / `showScreen('screen-wabun1-topic')` / `showScreen('screen-dictation')` が載っている。
  - 反映前のローカル実測（実 crop フロー＋各 send関数の遷移をNodeで再現）：
    三語=結果が見える／和文英訳①成功=confirm・失敗=topic camera-msg で見える／
    英検5級 合格=today・不合格/字雑=dictation で見える／kiso・kanji 従来どおり／切り抜き画像が再OCRに渡る／
    キャンセルは returnScreen へ／対照:showScreen無ならモーダル残留を検知、を 11/11 PASS。
  - ※実機（iPad/Android の Cropper.js 実物・サーバー往復・実写真）での end-to-end は配信環境では未実施（＝確かめていない）。
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 93881537a812dd1a081fecc448b796dd1e71fc4a && git push origin main && git checkout dev
  ```

### ログイン失敗時に「通信の問題」を分かりやすく伝える（案A）（2026-09-06）

- 背景・内容
  - ログインが通信失敗（タイムアウト / 通信断）したとき、`doLogin.catch` が汎用「エラーが発生しました。」を
    出すだけで、生徒に「通信の問題」だと伝わらなかった。
- 反映内容（index.html のみ。doLogin 周辺のみ）
  - 区別は構造的に既に分離：`res.ok===false`（サーバーが応答して拒否＝合言葉違い等）は従来の
    サーバーメッセージのまま（無変更）。`.catch`（gasPost の reject＝サーバー無応答＝タイムアウト/通信断）が通信失敗経路。
  - `_isNetworkLikeError(err)` を新設（`navigator.onLine===false` / `err.name==='TypeError'|'AbortError'` /
    `サーバー応答がありません|timeout|failed to fetch|networkerror|load failed|abort` 系メッセージ）。
    通信系なら「今サーバーにつながらなかったみたい。📶 電波のいい場所で、もう一度ログインしてね。」＋ `_showOfflineBanner()`。
    通信系でない想定外エラーは従来どおり汎用文言（通信メッセージと混ざらない）。
  - 副作用回避：`_offline` は立てない（doLogin 成功時にクリアされず、成功後も学習がブロックされ残るため）。
    バナー残存防止に doLogin 冒頭で `_hideOfflineBanner()`（再試行で成功したら残らない）。
  - ログイン画面に留まる・`ok:false` 経路・HP/提出ロジックは無変更。
  - view.html / admin.html は無変更（版バッジのみ stamp-version が更新）。
- 実装コミット：`ee3d34a`
- **反映前の main（切り戻し先）：`ee216ef990c9c21cce86d4db9c5f2a208892dc12`**
- **マージコミット：`343125beabfaa09b443ec95742db182734060502`**
- 版バッジ：`20260906-0120`（index / view / admin の3ファイル）
- GitHub Actions：success（run 33977812891）／git blob（コミット実体）と配信物の sha256 が3ファイルとも一致
  （index `2e025075…` / view `d1f3a85b…` / admin `83a2179b…`）。
- 反映後、配信物そのもので確認したこと
  - ゲート判定 29 行は全て doLogin/通信メッセージ関連（他機能キーワードなし）。想定外なし。
  - 削除行：実コード削除は旧・単独 catch の1行のみ（新・出し分け catch への置換）。他はスタンプ。
  - 配信 index.html に `function _isNetworkLikeError` と「今サーバーにつながらなかったみたい」が載っている。
  - 反映前のローカル実測（doLogin 制御フローと `_isNetworkLikeError` をNodeで再現）：
    タイムアウト/fetch失敗/onLine=false → 通信メッセージ＋バナー＋ログイン画面に留まる／
    合言葉違い(ok:false) → 従来サーバーメッセージ・バナー無し（通信と混ざらない）／正常ログイン→ホーム／
    失敗→再試行成功でバナー残らない／非通信エラー→汎用文言、を 14/14 PASS。
  - ※実機（機内モード等で実際に通信断→ログイン）での end-to-end は配信環境では未実施（＝確かめていない）。
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 343125beabfaa09b443ec95742db182734060502 && git push origin main && git checkout dev
  ```

### 「この日の作品を見る」に先生コメント・秀逸認定・公開を追加＋アイコン 📎→👀（2026-09-07）

- 背景・内容
  - 管理画面「生徒の振り返りコメント」→カレンダー→日付→振り返り日別画面（`screen-admin-reflections-day`）の
    各カードの「この日の作品を見る」（`toggleDayWorks` → `_renderDayWorks`）に、これまで解答確認ページでしか
    できなかった操作をインラインで持ち込み、ページ移動なしで完結させる。
  - あわせて「この日の作品を見る」ボタンのアイコン 📎（灰/銀色で青系グラデ背景に沈む）を 👀 に変更（視認性）。
- 反映内容（admin.html のみ。生徒画面 index / view は不変）
  - 先生コメント：三語短文・和文英訳①・オリワンテスの3カードに3状態（表示/編集/未入力）でインライン付与。
    送信後その場で表示に更新。action＝`adminSetSangoComment` / `adminSetWabun1Comment` / `adminSetOriwantesComment`。
  - 秀逸認定・今週分として公開：三語短文のみ。認定済バッジ・公開中表示をその場更新。
    action＝`adminSangoStar` / `adminSangoPublish`。
  - ★書き込みキー＝`getStudentDayWorks` の生 `submittedAt`（秒まで）＋トップ `studentId`。表示用整形は不使用。
    オリワンテスは `submissionId`。状態＝`starred` で認定済、`starred && publishedInWeek === currentWeek` で公開中。
  - 出し分け：他コンテンツ（kiso/mytask/lison/apology 等）には付けない。書き込みは `adminGasPost`
    （teacherId/password 自動付与・POST・認証ガード済み）。
  - day-works 専用の `_dwEdit` キャッシュ／`_dw*` 関数を新設（既存 `_xxxSubCache` は流用せず衝突回避）。
    解答確認ページ（既存の `saveSangoComment`/`starSangoSub`/`saveWabun1Comment`/`saveOriwantesComment` 等）は無改変。
  - アイコンは 📎→👀 を day-works の5箇所（開/閉/リセット）で一貫置換。フォームの「📎 画像」は対象外。
  - index / view は無変更（版バッジ・CDN `?v=` のみ stamp-version が更新）。
- 実装コミット：`81de7bb`（アイコン 📎→👀）／`07051b1`（先生コメント・秀逸認定・公開 本体）
- **反映前の main（切り戻し先）：`3a9f3f96be23d251d9abacab4b001da391420ac1`**
- **マージコミット：`27b853343e564ffd698d4a473de607bee85b29d4`**
- 版バッジ：`20260907-0443`（index / view / admin の3ファイル）
- GitHub Actions：配信物の版バッジが `20260907-0443` に切り替わったことでデプロイ成功を確認
  （gh 未導入のため run 番号は未取得）／git HEAD（`27b8533`）実体と配信物の sha256 が3ファイルとも一致
  （admin `b7a5a9f8…` / index `b383bc61…` / view `85748312…`）。
- 反映後、配信物そのもので確認したこと
  - ゲート判定（index/view から版バッジ・CDN `?v=` を除外）＝0 行＝生徒/保護者画面は実質不変。
  - 削除行：admin 10 / index 4 / view 1 ＝計15（版バッジ・CDN `?v=` のスタンプと、コメント/認定/公開追加に伴う
    `_dwTextSection`/`_dwOriwantesSection` の差し替え分。既存機能の削除はなし）。
  - 配信 admin.html に `dwSaveComment` / `_dwToggleSangoStar` / `dwTogglePublishSango` / `_dwRawSubmittedAt` が載り、
    👀 が5箇所・旧📎（この日の作品/閉じる）は0。
  - 反映前のローカル実測（admin.html をブラウザにロードし、モックデータ＋モック `adminGasPost` で）：
    出し分け（コメント＝三語/和文/オリの3、認定・公開＝三語のみ、他コンテンツ無し）／
    書き込みキー＝生 `submittedAt`（秒まで）＋`studentId`／オリは `submissionId`／
    送信・認定・公開後にカードがその場更新（表示/認定済/公開中）／既存の解答確認ページ関数は無改変、を実測 PASS。
  - ※実機（実サーバーの `getStudentDayWorks` 実データ＋実書き込み＝実際にコメント/認定/公開を1件保存）での
    end-to-end は配信環境では未実施（＝確かめていない）。反映後に実データ1件で「送信→反映」を1回試すのが確実。
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 27b853343e564ffd698d4a473de607bee85b29d4 && git push origin main && git checkout dev
  ```

### 疎通チェック Stage A/B：基礎計算の学習開始に「通信切れ警告」（学習は止めない）（2026-09-08）
- 中身（生徒画面）：基礎計算を始めるとき、通信が切れている/不安定だと警告バナーを出す。ただし
  **学習は止めない**（既定 `CONNECTIVITY_BLOCK=false`＝警告して続行）。つながっているときは従来どおり
  （直近90秒にサーバー成功していれば ping 省略＝**待ち0秒・警告なし**）。**基礎計算だけ**（他6入口は同期版のまま）。
- 実装：`showKisoRankSelect` を `_ensureOnlineThenStartAsync(_showKisoRankSelectStart)` に差し替え、開始本体を
  `_showKisoRankSelectStart()` に切り出し（本体は不変）。Stage A の部品（`_pingOnlineWithRetry` 2回リトライ・
  機内モード即false・成功で `_lastServerOkTs` 更新／`CONNECTIVITY_FRESH_MS=90000`／`PING_TIMEOUT=6000`／
  `ATTEMPTS=2`）を接続。続行時の警告文言は「続行できるが注意」に：`_showOfflineBanner(msg)` に任意引数を追加し、
  引数なしは従来の強い文言（`OFFLINE_BANNER_DEFAULT_MSG`）を完全維持、soft 文言 `CONNECTIVITY_SOFT_WARN`＝
  「⚠️ 通信が不安定かも。このまま進めるけど、切れていると記録されないことがあるよ」。HP・提出・採点・写真は無改変、`_offline` も新設しない。
- 実装コミット：`fdff6f9`（Stage A 部品・未適用）／`e394342`（Stage B 基礎計算入口の接続＋soft文言）
- **反映前の main（切り戻し先）：`27b853343e564ffd698d4a473de607bee85b29d4`**
- **マージコミット：`31f08a9c6f0b2f15d608ed840c0cfb02e6ecbc10`**
- 版バッジ：`20260908-0008`（index / view / admin の3ファイル）
- GitHub Actions：配信物の版バッジが `20260908-0008` に切り替わったことでデプロイ成功を確認
  （gh 未導入のため run 番号は未取得）／`git rev-parse origin/main`＝`31f08a9…` 実体と配信物の sha256 が3ファイルとも一致
  （index `bb394619…` / view `04e097c4…` / admin `a6424022…`。`core.autocrlf=true` のため比較は `git show origin/main:` のLF blob で実施）。
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `_ensureOnlineThenStartAsync(_showKisoRankSelectStart)` が1件・`function _showKisoRankSelectStart()` が1件。
  - 他6入口（showToday / showSangoTopic / showWabun1Topic / showLisonRankSelect / showKanjiLevelSelect）は同期版
    `if (!_ensureOnlineThenStart()) return;` を保持・async は0。showPhonicsStart は従来の typeof 同期ガードを保持（async 0）。
  - 削除行 全10：旧版バッジ/CDN `?v=`（20260907-0443）7行＋「📶 オフラインです…」旧テキスト行（span化で移動）＋
    基礎計算入口の旧同期ガード1行＋`_showOfflineBanner` 1行版（複数行版へ置換）。旧版バッジ `20260907-` は配信物に0件。
  - ブラウザ実測（前セッション）：ping省略で待ち0秒／ping成功で開始／**BLOCK=false + ping失敗＝警告バナー(soft)出るが開始できる**／
    BLOCK=true で停止（切替有効）／機内モードは ping せず即警告。級選択で20ボタン描画。
  - ※実機（iPad 実機・実サーバー）での「通信切れ時に基礎計算を始めて soft バナーが出る」end-to-end は配信環境では未実施（横展開の実機確認とセットで別途）。
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 31f08a9c6f0b2f15d608ed840c0cfb02e6ecbc10 && git push origin main && git checkout dev
  ```

### 基礎計算・試作：解答の写真に「ページ内カメラ（getUserMedia）」を従来併設（2026-09-08）
- 中身（生徒画面）：基礎計算の「解答の写真」画面（`screen-kiso-answer-intro`）に、ページ内カメラの
  試作ボタン **「📷 撮影と送信がうまく行かない場合はこちらから試してみて」** を従来の「📷 撮影する」の直下に併設。
  従来の capture 方式（`kiso-photo-input` / `onKisoPhotoSelected`）は**1文字も変更なし**（他生徒は従来どおり）。
- 狙い：`capture` 付き input はシステムカメラUIを起動して WebView を読み込み直し、撮った写真が消える
  （藤生さん端末・iOS26 で顕著）。`getUserMedia` はページ内でカメラを扱いアプリ切替をしないので、
  読み込み直しの引き金を引かない見込み（音声 getUserMedia＝リスオン録音が本番稼働・reload バナー無しが傍証）。
- 実装：`startKisoInPageCamera`（getUserMedia video facingMode environment / ideal 1920x1080・audio:false、
  playsinline+muted+srcObject+play()）→ `<video>` 表示 → 「✅ この画面で撮る」で `captureKisoInPagePhoto`
  （video フレームを canvas に drawImage → 既存と同じ縮小 長辺1000px/JPEG0.6）→ `_kisoState` に載せ確認画面へ。
  以降（プレビュー・端末保存・送信・採点）は既存流用・無変更。`stopKisoInPageCamera` で `track.stop`
  （撮影後・やめる・pagehide）＝カメラ解放。非対応/拒否は throw せず従来ボタンへ誘導するフォールバック。
- ブラウザ実測（前セッション、getUserMedia を canvas.captureStream でスタブ）：起動→video表示→撮影で
  base64(data:image/jpeg)生成→確認画面遷移→track が `ended`（解放）→box非表示、拒否/非対応で画面が壊れず
  従来ボタン健在、を PASS。従来 `onKisoPhotoSelected` は無変更。
- 実装コミット：`8b359c5`（ページ内カメラ試作 併設）／`f37a2ff`（ボタン文言変更・動作は無変更）
- **反映前の main（切り戻し先）：`31f08a9c6f0b2f15d608ed840c0cfb02e6ecbc10`**
- **マージコミット：`536698016c3d11068b90989381a641b5d09cfdcc`**
- 版バッジ：`20260908-1351`（index / view / admin の3ファイル）
- GitHub Actions：配信物の版バッジが `20260908-1351` に切り替わったことでデプロイ成功を確認
  （gh 未導入のため run 番号は未取得）／`git rev-parse origin/main`＝`5366980…` 実体と配信物の sha256 が3ファイルとも一致
  （index `4b4bc006…` / view `003696ad…` / admin `33be47f8…`。`core.autocrlf=true` のため比較は `git show origin/main:` のLF blob で実施）。
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `function startKisoInPageCamera()`＝1・新ボタン文言＝1・`function stopKisoInPageCamera()`＝1、
    従来 `function onKisoPhotoSelected(event)`＝1・`id="kiso-photo-input"`＝1・`>📷 撮影する<`＝2（解答画面＋途中式案内）健在、
    旧文言「その場で撮る（試験）」＝0。削除行 全7＝旧版バッジ/CDN `?v=`(20260908-0008) のみ（実コード削除0）。
  - ※**藤生さんの実機（iOS26）でしか確かめられない項目は未確認**：①ページ内カメラで読み込み直しが起きないこと（＝目的達成の可否）
    ②背面カメラ起動 ③答案の文字が読める解像度か ④インライン表示（全画面化しない）⑤カメラ許可ダイアログの出方。
    まずは藤生さんに新ボタンで試してもらい上記を確認するのが次段。読み込み直しが起きるならこの方向は見直し。
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 536698016c3d11068b90989381a641b5d09cfdcc && git push origin main && git checkout dev
  ```

---

## 2026-09-09 本番反映：生徒ホーム改良（学習コンテンツ画面 screen-content-menu 新設）

- 反映内容（dev→main マージ、2 コミット）
  - `a78b9b2` feat(生徒ホーム)：学習コンテンツを別画面 `screen-content-menu` に移動／ホームに「今日の学習を始める」「今日の運勢」を配置／各コンテンツの出口を「学習コンテンツ画面に戻る」に／特典3ボタンをランキング下に移動＋順序変更／「英単語ゲーム（準備中）」を追加
  - `98e0db7` docs(handover)：基礎計算・試作 ページ内カメラ getUserMedia 従来併設 の本番反映を記録
- **反映前の main（切り戻し先）：`536698016c3d11068b90989381a641b5d09cfdcc`**（＝`5366980`）
- **マージコミット：`c8ba5810220b95bc29aa4aea42ca1ad1865cc1c1`**（＝`c8ba581`）
- 版バッジ：`20260908-1739`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `c8ba581` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`c8ba581…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show main:` の LF blob と完全一致（`core.autocrlf=true` のため作業コピー CRLF ではなく blob で照合）
  - index `bab7d7c2…` / view `c8793617…` / admin `a538bc7f…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `screen-content-menu`＝4・`goContentMenu`＝36・「今日の学習を始める」＝3・「今日の運勢」＝6・「英単語ゲーム」＝3 が載っている
  - ゲート：`origin/main..dev` は2本のみ（想定通り）／admin・view の差分は版バッジ・`?v=` スタンプのみ
  - 無変更確認：`goHome` / `photoEscape` / `_setRetryHomeBtn` は差分の変更行に一切出現せず（0 行）
  - 削除行：admin・view は版バッジのみ。index.html は実コード削除 108 行あるが、これは学習コンテンツ画面移設・ホーム再構成・出口変更の意図した大規模リファクタの一部（sha256 完全一致でリファクタ後コードがそのまま配信されていることを確認済み）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 c8ba5810220b95bc29aa4aea42ca1ad1865cc1c1 && git push origin main && git checkout dev
  ```

---

## 2026-09-09 本番反映：ホーム2ボタンの見た目調整（CSSのみ・動作不変）

- 反映内容（dev→main マージ、2 コミット）
  - `1d375f3` style(生徒ホーム)：「今日の学習を始める」(start-learning-btn) を暖色グラデ `linear-gradient(135deg,#ff5252,#ff8f3c,#ffca28)`（赤→橙→黄）＋影を暖色化＋両脇に ✨（`::before`/`::after` 絶対配置）／「今日の運勢」(fortune-home-btn) を中央寄せ（`align-items:center`・`text-align:center`・左右 padding 40px）＋両脇に ✨。**CSS のみ・onclick 等の動作は無変更**
  - `478d7d8` docs(handover)：生徒ホーム改良(screen-content-menu 新設)の本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`c8ba5810220b95bc29aa4aea42ca1ad1865cc1c1`**（＝`c8ba581`）
- **マージコミット：`4ca2c5a86219e3e43e51c054a9f1b34caefbe6f9`**（＝`4ca2c5a`）
- 版バッジ：`20260909-0427`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `4ca2c5a` で `completed / success` を確認（API 確認）。`git rev-parse origin/main`＝`4ca2c5a…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show main:` の LF blob と完全一致（`core.autocrlf=true` のため blob で照合）
  - index `78122d23…` / view `9c4f6fe2…` / admin `99e29e04…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に 暖色グラデ `#ff5252,#ff8f3c,#ffca28`＝1・`start-learning-btn::before/::after`(✨)＝1・`fortune-home-btn::before/::after`(✨)＝1 が載っている
  - onclick 無変更：`class="start-learning-btn" onclick="goContentMenu()"`＝1・`class="fortune-home-btn" onclick="showFortuneScreen()"`＝1（従来どおり）
  - 削除行 全数：index.html 7（版バッジ/`?v=` 4＋実コード削除 3＝旧CSS 2ブロックの旧行）／ view.html 1（版バッジのみ）／ admin.html 2（版バッジ＋`?v=`）。実コード削除は CSS のみで想定どおり
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 4ca2c5a86219e3e43e51c054a9f1b34caefbe6f9 && git push origin main && git checkout dev
  ```

## 2026-09-10 本番反映：リスオン 録音前ステップの逃げ道撤去＋録音画面の案内経由出口（案2）

- 反映内容（dev→main マージ、2 コミット）
  - `e1517a6` fix(リスオン)：Step1〜4（録音前）の「🏠 ホームに戻る（最初からやり直しになるよ）」を撤去（カンジー読みに倣い、始めたら提出まで途中で帰れない。前進導線＝「次へ進む」「解答と解説を確認」「次へ進む（音読録音）」は温存）／Step5（録音）は素の `goHome` を撤去し、写真系 `photoEscapeToHome` と同型の「録音がうまくいかない場合はこちら」案内 overlay（`#lison-escape-overlay`）→ `goContentMenu` に差し替え（LINE 内ブラウザ等で `getUserMedia` が使えず録音不可な生徒がこの画面に閉じ込められる事象＝藤生さんの症状への出口。「分かりました」で LINE 回送を記録し学習コンテンツ画面へ）／`confirmLisonExit` の出口を `goHome`→`goContentMenu` に統一。**HP・提出・採点・完了画面（screen-lison-done は従来どおり goContentMenu）・他コンテンツは無変更**
  - `395e1ad` docs(handover)：ホーム2ボタンの見た目調整の本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`4ca2c5a86219e3e43e51c054a9f1b34caefbe6f9`**（＝`4ca2c5a`）
- **マージコミット：`14a1eacb319c04ad171a3685cf40cdce20fbc8ac`**（＝`14a1eac`）
- 版バッジ：`20260910-2232`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `14a1eac` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`14a1eac…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show main:` の LF blob と完全一致（`core.autocrlf=true` のため blob で照合）
  - index `e4579b1b…` / view `5ac59a12…` / admin `e0e343f2…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に 旧逃げ道「ホームに戻る（最初からやり直しになるよ）」＝0（Step1〜4 撤去・Step5 差し替え済）／`lisonEscapeToHome`＝3／`id="lison-escape-overlay"`＝1／「録音がうまくいかない場合はこちら」＝1
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`e1517a6` リスオン／`395e1ad` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
  - 削除行 全数：index.html 11（版バッジ/`?v=` 4＋実コード削除 7＝Step1〜4 の逃げ道ボタン4＋Step5 旧ボタン1＋`confirmLisonExit` の confirm 文言/`goHome` 2）／ view.html 1（版バッジのみ）／ admin.html 2（版バッジ＋`?v=`）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 14a1eacb319c04ad171a3685cf40cdce20fbc8ac && git push origin main && git checkout dev
  ```

## 2026-09-11 本番反映：長い一覧13画面の先頭にも「戻る」ボタン（上下両方・生徒リクエスト）

- 反映内容（dev→main マージ、2 コミット）
  - `ab6ee69` feat(一覧画面)：長い一覧13画面（過去の提出作品・履歴・おさらい・アーカイブ等）の `.container`／`<main>` 先頭に、各画面の下ボタンと文言・onclick・見た目を完全同一にした「戻る」ボタン（`margin-bottom:14px`）を1個ずつ追加。手本＝`screen-student-messages`／`screen-student-reflections`（上下両方に同一の戻るボタン）。**下ボタン・「📜さらに過去のもの」等は無変更、一覧の動的生成にも非干渉（一覧要素の id は不変）**。対象13画面：sango-history／wabun1-history／history／kanji-history／kiso-history／lison-my-recordings／notice-history／sango-past／sango-archive／sango-hall-of-fame／wabun1-past／wabun1-archive／kiso-review
  - `a350f1b` docs(handover)：リスオン逃げ道撤去＋録音案内出口(案2)の本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`14a1eacb319c04ad171a3685cf40cdce20fbc8ac`**（＝`14a1eac`）
- **マージコミット：`fcfbdbaa4c75ae21eed67844145f7623969a1f3f`**（＝`fcfbdba`）
- 版バッジ：`20260911-2326`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `fcfbdba` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`fcfbdba…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show main:` の LF blob と完全一致（`core.autocrlf=true` のため blob で照合）
  - index `608badc1…` / view `3038eafd…` / admin `beedc8f9…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html の13画面すべてで、一覧本体の直前（container/main 先頭）に**下と同一の戻るボタン**が載っている（各画面で「上ボタン→一覧要素」の順・onclick 一致を正規表現で全数 ALL PASS）
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`ab6ee69` 上戻るボタン／`395e1ad`→`a350f1b` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
  - 削除行 全数：index.html 4（**すべて版バッジ/`?v=`。実コード削除ゼロ＝13ボタンは純追加**）／ view.html 1（版バッジ）／ admin.html 2（版バッジ＋`?v=`）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 fcfbdbaa4c75ae21eed67844145f7623969a1f3f && git push origin main && git checkout dev
  ```

## 2026-09-13 本番反映：アバター背景37枚を正方形配置＋背景装着時は枠全体cover（置物・桜を消す）

- 反映内容（dev→main マージ、3 コミット）
  - `35e3204` feat(アバター)：背景を `.avatar-stage` 全体に **cover** で敷く表示改修（Step3）。`.avatar-bg-img` を `.avatar-wrap` 内→`.avatar-stage` 直下（home/corner の2箇所）へ移動し、CSS を `position:absolute; inset:0; width/height:100%; object-fit:cover; border-radius:22px（モバイル20px）; z-index:0` に変更。背景装着時（`.avatar-stage.has-bg`）は桜/オーラに加え**置物（`.avatar-deco`）も非表示**に。アバター本体（`.avatar-slot` z-index:2）は背景の手前・中央下を維持。**`_applyStageBackground` の JS は無変更（id参照のまま動作）**
  - `d458aef` feat(アバター背景)：背景37枚を正方形 **1254×1254** で更新（`bg_01`〜`bg_30` を旧縦長887×1774から上書き・`bg_31`〜`bg_37` を新規追加）。配置先は `images/avatar/backgrounds/` のみ、`base_*.png`/`hats`/`makeup` は無変更
  - `a8257be` docs(handover)：一覧13画面の上戻るボタン追加の本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`fcfbdbaa4c75ae21eed67844145f7623969a1f3f`**（＝`fcfbdba`）
- **マージコミット：`a6a3a5ce722b69c2d5231c63d44181d3d9782bff`**（＝`a6a3a5c`）
- 版バッジ：`20260912-2357`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `a6a3a5c` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`a6a3a5c…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の LF blob と完全一致
  - index `b76b5558…` / view `32438bfb…` / admin `9b1a308c…`
- 反映後、配信物そのもので確認したこと
  - 背景 `bg_01`〜`bg_37` の **37枚すべてが本番配信（HTTP 206 Range）** され、**全て 1254×1254 正方形**（IHDR を実測）。うち **`bg_31`〜`bg_37`（新規7枚）** も全数配信・正方形（マージ diff で `create mode 100644`＝新規追加）
  - 配信 index.html に cover 化 CSS（`object-fit: cover; z-index: 0; border-radius: 22px`）＝1、`has-bg .avatar-deco { display:none }`＝あり、bg-img の stage 直下移動コメント＝2（home/corner）
  - ゲート：`origin/main..dev` は3本のみ（想定通り＝`35e3204` 表示改修／`d458aef` 背景37枚／`a8257be` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ／想定外の混入なし
- **生徒の見た目への影響**：背景アイテムは全て「予告（非公開）」で生徒はまだ装着できないため、**デフォルト（背景未装着）の見た目は無変更＝生徒の通常表示に変化は出ない**（置物・桜・ラベンダー枠のまま）。変わるのは将来背景を装着できるようになった時のみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 a6a3a5ce722b69c2d5231c63d44181d3d9782bff && git push origin main && git checkout dev
  ```

## 2026-09-17 本番反映：ログインの「LINE通知の登録」を「LINEから直接開かないで」注意書きに差し替え

- 背景：LINEから直接アプリを開くと音・写真・録音・ログインの不具合が出る（藤生さん・小林青空さんで実発生）。全生徒への予防として、ログイン画面のLINE通知登録ボタン2つ＋タイトルを非表示にし、同じ位置に注意書きを表示
- 反映内容（dev→main マージ、2 コミット）
  - `031946b` feat(ログイン)：`.line-register-section` 内のLINE登録ボタン2つ＋タイトル＋説明を `display:none` ブロックに退避し、同位置に注意書きを表示。タイトルは赤文字（`.line-open-warning-title`＝`#d32f2f` 太字）、本文（`.line-open-warning-body`）＝「通常のブラウザ（Safari/Chrome）から開いて。LINEから開くと音・写真・録音・ログインの不具合が生じます。（実際に報告されてます）」。CSS新設＋≤480pxレスポンシブ。**機能温存**：`startLineLoginFlow` / `_applyLineRegisteredButtons` / `_initLineRegisteredFlag` は削除せず、ボタン/ラベル要素もDOMに残す（`line-register-label-*` の ID 参照を壊さない・将来また表示に戻せる）
  - `5c306da` docs(handover)：前回反映（アバター背景37枚）の記録
- **反映前の main（切り戻し先）：`a6a3a5ce722b69c2d5231c63d44181d3d9782bff`**（＝`a6a3a5c`）
- **マージコミット：`c60bac952fbf198dba2e368ba5fcea07ae935cb8`**（＝`c60bac9`）
- 版バッジ：`20260917-0357`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `c60bac9` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`c60bac9…` 実体を確認
- 配信物 sha256 が3ファイルとも `git show HEAD:` blob と完全一致
  - index `51854a10…` / view `71b49e80…` / admin `27c04cb3…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に注意書き「LINEから直接開かないでください」「実際に報告されてます」＝あり
  - LINE登録関数の温存＝`startLineLoginFlow`/`_applyLineRegisteredButtons`/`_initLineRegisteredFlag` の grep ヒット（定義3＋コメント1＝4）／登録ボタン要素（`id="line-register-btn-*"`）2件がDOMに残存
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`031946b` 注意書き差し替え／`5c306da` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ／想定外の混入なし
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 c60bac952fbf198dba2e368ba5fcea07ae935cb8 && git push origin main && git checkout dev
  ```

## 2026-09-17 本番反映：ログイン注意書きタイトルを枠いっぱいに拡大（CSSのみ・見た目）

- 背景：「⚠️ LINEから直接開かないでください」（`.line-open-warning-title`）が本文と同程度で目立ちが弱かったため、枠の横幅いっぱいに1行で収まる範囲で大きくする（見た目のみ）
- 反映内容（dev→main マージ、2 コミット）
  - `daf9db7` style(ログイン)：`.line-open-warning-title` の `font-size` を `15px` → **`clamp(15px, 4.2vw, 21px)`** に変更（画面幅連動）。≤480px の固定 `font-size:14px` 上書きを削除しグローバル clamp に委譲。**色（#d32f2f）・太字（700）・文言・本文（.line-open-warning-body）は無変更**。実機検証：デスクトップ21px / モバイル375px 約15.76px、両方1行・はみ出しなし（`scrollWidth==clientWidth`）
  - `58a840d` docs(handover)：前回反映（LINE注意書き差し替え）の記録
- **反映前の main（切り戻し先）：`c60bac952fbf198dba2e368ba5fcea07ae935cb8`**（＝`c60bac9`）
- **マージコミット：`ce32a891eaa64e755606216f8311b2050eeb90e1`**（＝`ce32a89`）
- 版バッジ：`20260917-0421`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `ce32a89` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`ce32a89…` 実体を確認
- 配信物 sha256 が3ファイルとも `git show HEAD:` blob と完全一致
  - index `f690a407…` / view `094d36e0…` / admin `cb4abe99…`
- 配信 index.html に `clamp(15px, 4.2vw, 21px)` が載っていることを確認
- ゲート：`origin/main..dev` は2本のみ（想定通り＝`daf9db7` タイトル拡大／`58a840d` HANDOVER記録）／CLAUDE.md ゲート判定数値=6（タイトルCSSの実変更行）／admin・view の差分は版バッジ・`?v=` スタンプのみ／想定外の混入なし
- **生徒の見た目への影響**：ログイン画面の注意書きタイトルが枠いっぱいに大きく1行表示されるのみ（機能・文言・色は不変）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 ce32a891eaa64e755606216f8311b2050eeb90e1 && git push origin main && git checkout dev
  ```

## 2026-09-17 本番反映：三語短文秀逸作品タイトルから「今週の」を削除（文言のみ）

- 背景：サーバー側が秀逸作品を「直近2日で選ばれたもの表示」に変更済のため、ホーム画面タイトルの「今週の」が実態と不整合になっていた
- 反映内容（dev→main マージ、2 コミット）
  - `539a09f` style(三語短文)：ホーム画面の秀逸作品タイトル `🐠 サンゴタンが選んだ今週の三語短文秀逸作品` → **`🐠 サンゴタンが選んだ三語短文秀逸作品`**（「今週の」削除・絵文字🐠維持）。文言のみ、描画/殿堂導線は無変更
  - `40e06c8` docs(handover)：前回反映（LINE注意書きタイトル拡大）の記録
- **反映前の main（切り戻し先）：`ce32a891eaa64e755606216f8311b2050eeb90e1`**（＝`ce32a89`）
- **マージコミット：`b1028fcf0996c5bf451ac7a584e7d3a747cf8c56`**（＝`b1028fc`）
- 版バッジ：`20260917-0510`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `b1028fc` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`b1028fc…` 実体を確認
- 配信物 sha256 が3ファイルとも `git show HEAD:` blob と完全一致
  - index `a2f7288d…` / view `7c449c3a…` / admin `23c36b45…`
- 配信 index.html でタイトルが「🐠 サンゴタンが選んだ三語短文秀逸作品」であること、旧文言「今週の」が 0 件（消滅）を確認
- ゲート：`origin/main..dev` は2本のみ（想定通り＝`539a09f` タイトル変更／`40e06c8` HANDOVER記録）／CLAUDE.md ゲート判定数値=2（タイトル1行変更）／admin・view の差分は版バッジ・`?v=` スタンプのみ／想定外の混入なし
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 b1028fcf0996c5bf451ac7a584e7d3a747cf8c56 && git push origin main && git checkout dev
  ```

## 2026-09-17 本番反映：マイ課題告知に Students/SpecialAccounts タブ + 行内「この生徒に告知」ボタン

- 反映内容（dev→main マージ、2 コミット。管理画面 admin.html のみ実質変更／生徒画面は不変）
  - `4655ff6` feat(マイ課題告知)：対象生徒一覧（`_renderKadaiStudentsTable`）の上に **Students / SpecialAccounts タブ**を追加。判定＝`accountType==='student'` を Students、それ以外（test/teacher/invited/experience/未設定）を SpecialAccounts（シート可視化と同基準）。件数付き。タブ切替は表示行を絞るだけで**選択状態 `_kadaiSelected` は保持**。各行に **「この生徒に告知」ボタン**を追加し、**その行の✅が入っている時だけ有効**（未選択は disabled、`kadaiToggleRow` で同期）。押下 `kadaiAnnounceOne(sid)` は `saveMyTaskAnnouncement` に `studentIds:[sid]`（1名）＋入力欄の現在値（subject/content/announcedDate）を送信。**一括ボタン `submitKadaiAnnounce` は無改修で温存**。告知状況（`listAllActiveMyTaskAnnouncements`）のタブは、当該 API が accountType を返すかバックエンド（別リポ `mykt-eitango-aws`）で確認できないため**第2段階に見送り**
  - `7cd3a7a` docs(handover)：三語短文秀逸作品タイトルの「今週の」削除の本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`b1028fcf0996c5bf451ac7a584e7d3a747cf8c56`**（＝`b1028fc`）
- **マージコミット：`26e74a6af69c65728fe97ce51d6c989b74a41809`**（＝`26e74a6`）
- 版バッジ：`20260917-1612`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `26e74a6` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`26e74a6…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の LF blob と完全一致
  - index `6e6d8167…` / view `ec01d78c…` / admin `b0e45495…`
- 反映後、配信物そのもので確認したこと
  - 配信 admin.html に `kadai-tab-btn`＝3・`kadai-row-announce-btn`＝3・`function setKadaiTab`／`function kadaiAnnounceOne` 定義・「この生徒に告知」文言あり
  - **生徒画面（index/view）は実質不変**：`origin/main..dev` の index/view 差分は版バッジ・`?v=` スタンプのみ（実コード差分ゼロ）
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`4655ff6` タブ+行ボタン／`7cd3a7a` HANDOVER記録）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 26e74a6af69c65728fe97ce51d6c989b74a41809 && git push origin main && git checkout dev
  ```

## 2026-09-17（第2段階）本番反映：マイ課題告知状況に Students/SpecialAccounts タブ + 行内「修正」「削除」

- 反映内容（dev→main マージ、2 コミット。管理画面 admin.html のみ実質変更／生徒画面は不変）
  - `d98cbac` feat(マイ課題告知)：告知状況（`_renderKadaiAnnouncements`）に対象生徒一覧と同じ **Students / SpecialAccounts タブ**（`accountType==='student'` か否か・件数付き・切替で絞る。サーバーが listAll に accountType を返すようになったため第1段階で見送っていたタブを実装）。各告知の行に **「修正」「削除」** ボタン（操作列）を追加。**修正＝行内インライン編集**（教科＝`<select>` / 宿題内容＝`<input>` の両方）で、保存は `updateMyTaskAnnouncement` を **studentId + oldSubject（元の教科）** で特定し newSubject/newContent を送信。**衝突エラー（案B）は握りつぶさず、編集行の⚠️メッセージ＋トーストで講師に表示**（編集行は開いたまま・再読込しない）。**削除＝confirm 確認ダイアログ**（誤削除防止・元に戻せない旨明記）→ `deleteMyTaskAnnouncement` を studentId + subject で送信。修正・削除の成功後は `loadKadaiAnnouncements`（listAll）で再読込＋「修正しました」「取り消しました」トースト。**既存の告知作成（`submitKadaiAnnounce`・行内 `kadaiAnnounceOne`・対象生徒タブ）は無改修で温存**
  - `dd677d2` docs(handover)：マイ課題告知タブ+行内告知ボタンの本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`26e74a6af69c65728fe97ce51d6c989b74a41809`**（＝`26e74a6`）
- **マージコミット：`1363ca4f6aab46913ba2975ecf7663451c215302`**（＝`1363ca4`）
- 版バッジ：`20260917-1755`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `1363ca4` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`1363ca4…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の LF blob と完全一致
  - index `cd219979…` / view `f85e1ef7…` / admin `122133d4…`
- 反映後、配信物そのもので確認したこと
  - 配信 admin.html に `function kadaiSaveAnnounceEdit`／`kadaiDeleteAnnounce`／`setKadaiAnnounceTab`＝各1、`updateMyTaskAnnouncement`／`deleteMyTaskAnnouncement`＝各1、`kadai-ann-edit-btn`＝2、確認ダイアログ文言「この告知を取り消しますか」＝1
  - **生徒画面（index/view）は実質不変**：`origin/main~1..origin/main` の index/view 差分は版バッジ・`?v=` スタンプのみ（実コード差分ゼロ）
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`d98cbac` 修正/削除UI／`dd677d2` HANDOVER記録）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 1363ca4f6aab46913ba2975ecf7663451c215302 && git push origin main && git checkout dev
  ```

## 2026-09-17（見た目修正）本番反映：三語短文秀逸作品カードの区切り「/」の丸囲みを外す

- 反映内容（dev→main マージ、2 コミット。生徒画面 index.html の見た目のみ変更）
  - `c2cca3d` fix(三語短文秀逸作品)：`_renderSangoFeaturedCard` で、お題の3語を空白区切りで分割する際に**空白で囲まれた「/」（半角/全角）が独立トークン化**し、3語と同じ `.sango-featured-word` 丸囲みチップが付いていた不具合を修正。区切りトークン（`/^[\/／]+$/`）は素のテキスト `.sango-featured-sep` で描画し、**3つの言葉だけ丸囲みチップを維持**。ニックネーム・レベル・本文の表示は無変更。**共有関数のためホーム秀逸カードと殿堂アーカイブ（`_renderSangoHofWeekBlock`）の両方が一貫して修正される**
  - `65e0f20` docs(handover)：マイ課題告知状況タブ+修正/削除UIの本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`1363ca4f6aab46913ba2975ecf7663451c215302`**（＝`1363ca4`）
- **マージコミット：`a7a9a8c33e9eebf6d0ec0fc425feabd2794b5cd5`**（＝`a7a9a8c`）
- 版バッジ：`20260917-1819`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `a7a9a8c` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`a7a9a8c…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の LF blob と完全一致
  - index `91c3925a…` / view `a99119e4…` / admin `c38fb085…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `.sango-featured-sep` が CSS 定義＋JS 使用で計2出現（区切り「/」を素テキスト化する分岐が載っている）。3語は `.sango-featured-word` チップのまま
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`c2cca3d`「/」丸囲み外し／`65e0f20` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 a7a9a8c33e9eebf6d0ec0fc425feabd2794b5cd5 && git push origin main && git checkout dev
  ```

## 2026-09-18 本番反映：HP手動付与の対象生徒に Students/SpecialAccounts タブ（マイ課題と同作法）

- 反映内容（dev→main マージ、2 コミット。管理画面 admin.html のみ実質変更／生徒画面は不変）
  - `0ccac9a` feat(HP手動付与)：対象生徒一覧（`_renderHpGrantStudentsTable`）の上に **Students / SpecialAccounts タブ**を追加。マイ課題告知と同基準・同作法（`_hpGrantIsStudentAcct`＝`accountType==='student'`→Students、それ以外→SpecialAccounts／`setHpGrantTab`／状態 `_hpGrantTab`。件数付き）。タブ切替は表示行を絞るだけで**選択状態 `_hpGrantSelected` は保持**。連続日数列は維持。**全選択/全解除/再読み込み/付与実行は無改修で温存**。CSS は既存 `.kadai-tab-bar`/`.kadai-tab-btn` を流用。マイ課題側（`_kadai*`/`setKadaiTab`）には非影響（別変数・別関数）
  - `c4bb656` docs(handover)：三語短文秀逸作品カードの区切り「/」丸囲み外しの本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`a7a9a8c33e9eebf6d0ec0fc425feabd2794b5cd5`**（＝`a7a9a8c`）
- **マージコミット：`c1d5864383ebceb6030626f885e342349bf97642`**（＝`c1d5864`）
- 版バッジ：`20260918-0032`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `c1d5864` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`c1d5864…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の LF blob と完全一致
  - index `fe01728b…` / view `357b627c…` / admin `cce0bc0a…`
- 反映後、配信物そのもので確認したこと
  - 配信 admin.html に `function setHpGrantTab`＝1・`function _hpGrantIsStudentAcct`＝1・`_hpGrantTab`＝4（HP付与タブが載っている）
  - **生徒画面（index/view）は実質不変**：`origin/main~1..origin/main` の index/view 差分は版バッジ・`?v=` スタンプのみ（実コード差分ゼロ）
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`0ccac9a` HP付与タブ／`c4bb656` HANDOVER記録）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 c1d5864383ebceb6030626f885e342349bf97642 && git push origin main && git checkout dev
  ```

## 2026-09-18 本番反映：カンジー書きの採点失敗時に「春アカ公式LINEで採点」案内（ループ解消）

- 反映内容（dev→main マージ、2 コミット。生徒画面 index.html の変更）
  - `0fde950` feat(カンジー書き)：`submitKanjiKakiPhoto` の採点失敗（`!res.ok`＝Gemini429/HP_LOG_FAILED 等・`.catch`＝通信/90秒タイムアウト）時に、汎用エラー（`_showSubmitError`「あ、失敗したみたい！もう一回押してね」）ではなく **新規オーバーレイ `#kanji-line-overlay`** で「春アカ公式LINEで採点します」案内を表示（`_showKanjiLineHandoff`）。「分かりました」→ `_kanjiLineConfirmed`：**`_recordLineHandoff('カンジー書き(LINEへ)')` + `goContentMenu()`**（リスオン `_lisonEscapeConfirmed` と同作法・LINE回送を記録・閉じ込め回避）。**`res.retake`（写真が読めない＝撮り直しで直る）/ `needsRetake` は従来どおり撮り直し誘導のまま**（LINE案内にしない）。**Gemini 成功時の通常フロー（採点・合格・HP付与・結果画面）は無改修**。`.catch` では未送信の印・逃げ道ボタン（`_recordUnsentAwareness`/`_markPhotoSendFailed`）を外し LINE案内に一本化（二重表示回避）。**カンジーのみ変更**、基礎計算・和文英訳①等の `_showSubmitError` は無傷
  - `1d94463` docs(handover)：HP手動付与の対象生徒タブの本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`c1d5864383ebceb6030626f885e342349bf97642`**（＝`c1d5864`）
- **マージコミット：`a70c639dd3171671233852800a5727e9b5ca6e89`**（＝`a70c639`）
- 版バッジ：`20260918-0140`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `a70c639` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`a70c639…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の LF blob と完全一致
  - index `1981d907…` / view `058f1de2…` / admin `7af1fdb5…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `id="kanji-line-overlay"`＝1・`function _showKanjiLineHandoff`＝1・`function _kanjiLineConfirmed`＝1・ラベル「カンジー書き(LINEへ)」＝1・文面「カンジーの「書き」は春アカ公式LINEで採点します」＝1
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`0fde950` カンジーLINE案内／`1d94463` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 a70c639dd3171671233852800a5727e9b5ca6e89 && git push origin main && git checkout dev
  ```

## 2026-09-18 本番反映：マイカツ君 stage 4 を「ゆっくり控えめに揺れる」に（CSSのみ）

- 背景：マイカツ君の stage 4（前日課題なしの標準状態）は元々 `anim:'none'`（揺れない）だった。ゆっくり控えめに揺れる状態にし、stage 5（元気な揺れ）との差別化は維持
- 反映内容（dev→main マージ、2 コミット）
  - `ba7bb26` feat(マイカツ君)：`@keyframes cbob-slow`（振幅3px）を新設し、STAGE_DEF の stage 4 の anim を `none` → **`cbob-slow 2.8s ease-in-out infinite`** に変更。stage 5 の `cbob`（振幅7px/1.2s・元気）は無変更。他stage（7/6/5/3/2/1）・状態表現ロジックは無変更。ブラウザ実測：stage4=cbob-slow/2.8s、stage5=cbob/1.2s で差を確認
  - `d348d9c` docs(handover)：前回反映（カンジー書き採点失敗時のLINE案内）の記録
- **反映前の main（切り戻し先）：`a70c639dd3171671233852800a5727e9b5ca6e89`**（＝`a70c639`）
- **マージコミット：`2ea7807b24861b9531850a8f544fb80b19646ac7`**（＝`2ea7807`）
- 版バッジ：`20260918-0403`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `2ea7807` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`2ea7807…` 実体を確認
- 配信物 sha256 が3ファイルとも `git show HEAD:` blob と完全一致
  - index `5e6f9127…` / view `aa19da3f…` / admin `8802ed87…`
- 配信 index.html に `@keyframes cbob-slow` と `cbob-slow 2.8s ease-in-out infinite` が載っていること、stage 5 の `cbob 1.2s ease-in-out infinite` が温存されていることを確認
- ゲート：`origin/main..dev` は2本のみ（想定通り＝`ba7bb26` マイカツ君揺れ／`d348d9c` HANDOVER記録）／CLAUDE.md ゲート判定数値=4（keyframes追加2行 + stage4 anim変更の -1/+1）／admin・view の差分は版バッジ・`?v=` スタンプのみ／想定外の混入なし
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 2ea7807b24861b9531850a8f544fb80b19646ac7 && git push origin main && git checkout dev
  ```

## 2026-09-18 本番反映：アバター服（種別A）完成画像72枚 + 組み合わせ表示 + itemId 読取

- 反映内容（dev→main マージ、4 コミット。生徒画面 index.html + 画像72枚。**服は全て非公開＝生徒の見た目に変化なし**）
  - `8af3106` feat(アバター)：服の完成画像72枚 `images/avatar/outfits/AV0000001〜072.png`（887×1774・透過）を配置（A-1）
  - `1573ae1` feat(アバター)：`AVATAR_OUTFIT_MAP`（base×tops×bottoms→AV番号1〜72、Excel対応表どおり）を定数化。`_renderAvatarSlot`（ホーム）/`showAvatarCorner`（コーナー）の人体 img を `_avatarBodyImgPath()` で決定（装着 tops/bottoms の item_code→対応表）。未装着・不明な組合せ・onerror は素体 `base_*.png` に安全フォールバック（割れ防止）。`_applyEquipResult` でホーム+コーナーを即再描画（A-3/A-5）。背景表示は無改修
  - `a0c7362` fix(アバター)：`_equipItemCode` を `itemId || itemCode || item_code || code` に変更（サーバー実キー itemId＝AvatarActions.php:424 を最優先。従来 itemId が読めず常に素体に落ちていた不具合を解消）
  - `9e3239f` docs(handover)：マイカツ君 stage 4 ゆらぎ追加の本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`2ea7807b24861b9531850a8f544fb80b19646ac7`**（＝`2ea7807`）
- **マージコミット：`ba56bb5e73f8138ef30582bf8239c0a9760f1870`**（＝`ba56bb5`）
- 版バッジ：`20260918-1615`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `ba56bb5` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`ba56bb5…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の LF blob と完全一致
  - index `8ee226e9…` / view `50107967…` / admin `f5483856…`
- 反映後、配信物そのもので確認したこと
  - **`images/avatar/outfits/AV0000001〜072` の72枚すべて本番配信**（HTTP 206/200・未配信0、AV0000001 は 887×1774 実測）。マージ diff で全72枚 `create mode 100644`＝新規
  - 配信 index.html に `AVATAR_OUTFIT_MAP`・`function _avatarBodyImgPath`・`detail.itemId ||`・`_applyAvatarCornerBody`・`AVATAR_OUTFIT_DIR` が載っている
  - **服は全て非公開（予告）のまま**：フロントは「装着済みの tops/bottoms の描画」だけを変更。装着可否（購入・equip）はサーバー側で非公開のため生徒は服を装着できず、生徒の見た目に変化は出ない
  - ゲート：`origin/main..dev` は4本のみ（想定通り＝`a0c7362`/`1573ae1`/`8af3106`/`9e3239f`）／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 ba56bb5e73f8138ef30582bf8239c0a9760f1870 && git push origin main && git checkout dev
  ```

## 2026-09-18 本番反映：アバター背景37枚を圧縮版に差し替え（90MB→29MB・見た目不変）

- 反映内容（dev→main マージ、2 コミット。生徒画面の背景画像のみ差し替え）
  - `cb52d51` chore(アバター背景)：`images/avatar/backgrounds/` の bg_01〜37（37枚）を圧縮版で上書き（同名・削除→再配置で確実に git 反映）。**37枚すべて md5 変化・全て小型化**、合計 **約90MB→約29MB（約1/3）**。**正方形 1254×1254px は維持**（減色済み・劣化なし確認済み）。表示ロジック・対応表・base_*/outfits/hats/makeup は無変更。差し替え前に現行37枚をリポジトリ外にバックアップ（`C:\Users\Manager\mykt-eitango_backups\backgrounds_backup_20260918\`、**本コミットには含めない**）
  - `1b4007d` docs(handover)：アバター服(種別A)72枚+組み合わせ表示+itemId読取の本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`ba56bb5e73f8138ef30582bf8239c0a9760f1870`**（＝`ba56bb5`）
- **マージコミット：`e76deb18ede7b4d674bfcc7790de584db1f58d7f`**（＝`e76deb1`）
- 版バッジ：`20260918-1615`（画像のみ差し替えのため HTML 無変更＝版バッジ据え置き。index/view/admin の配信 sha256 は前回反映と MATCH）
- GitHub Actions（pages build and deployment）：head_sha `e76deb1` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`e76deb1…` 実体を確認。
- 反映後、配信物そのもので確認したこと
  - 背景37枚すべて本番配信（HTTP 206/200・未配信0）、**全37枚 1254×1254 実測**（正方形維持）
  - `bg_13_castle.png` の配信 Content-Length＝801,375 バイト＝origin/main の圧縮版 blob サイズと一致（＝圧縮版が確実に配信されている。旧版は約 2.58MB だった）
  - **バックアップ（backgrounds_backup_*）は本番に載っていない**：ゲート・マージ差分とも backup の混入なしを確認
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`cb52d51` 背景圧縮版／`1b4007d` HANDOVER記録）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 e76deb18ede7b4d674bfcc7790de584db1f58d7f && git push origin main && git checkout dev
  ```

## 2026-09-18 本番反映：ホームのアバター画像タップ→ショップ遷移を外す（ミスタップ防止）

- 反映内容（dev→main マージ、2 コミット。生徒画面 index.html の変更）
  - `a4a5684` fix(ホーム)：ホームの `#avatar-slot` から `onclick="onAvatarSlotTap()"` / `role="button"` / `tabindex="0"` を除去し、アバター画像タップでのショップ（コーナー）遷移を無効化（ミスタップ防止）。クリック可能な見た目も無効化（`#avatar-slot { cursor:default }`＋hover の拡大/影を none、`#avatar-slot` 限定でコーナー枠は無影響）。**アバターショップ入口はホーム下部の「✨ アバターショップ ✨」ボタン（`#card-avatar-corner` / `onAvatarCardTap`）が温存**（未選択→選択画面 / 選択済→コーナー画面の分岐も健在）。`onAvatarSlotTap`/`onAvatarCardTap` 関数・アバター表示（背景/服/立ち位置）は無変更
  - `7ab3eae` docs(handover)：背景37枚 圧縮版差し替えの本番反映を記録（前回反映分の記録）
- **反映前の main（切り戻し先）：`e76deb18ede7b4d674bfcc7790de584db1f58d7f`**（＝`e76deb1`）
- **マージコミット：`ef57550f794498b5d6430cfce5137c4c60d4778b`**（＝`ef57550`）
- 版バッジ：`20260918-2347`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `ef57550` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`ef57550…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の LF blob と完全一致
  - index `84b124e9…` / view `8ca53f12…` / admin `2f91e768…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html の `#avatar-slot` に `onclick="onAvatarSlotTap"` の直接付与＝0（タップ遷移が外れた）／`#avatar-slot { cursor: default }`＝1
  - 下部入口 `id="card-avatar-corner" onclick="onAvatarCardTap"`＝1（温存）／`function onAvatarSlotTap` 定義＝1（健在）
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`a4a5684` タップ遷移外し／`7ab3eae` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 ef57550f794498b5d6430cfce5137c4c60d4778b && git push origin main && git checkout dev
  ```

## 2026-09-19 本番反映：アバター オーラ中間層（Phase2 種別B）を実装＋オーラ画像12枚を配置

- 反映内容（dev→main マージ、3 コミット。生徒画面 index.html の実装＋画像追加）
  - `9c506af` feat(アバター)：オーラ画像12枚 `aura_01`〜`aura_12` を `images/avatar/aura/` に新設配置（共通1枚・base非依存）
  - `99847a0` feat(アバター)：オーラ中間層を実装（**背景 z:0 の上・人体 z:1 の下**に重ねる 1:1 overlay）。`.avatar-aura-img`（PC 240px/max200px・モバイル 180px/max150px）、ホーム/コーナー2枠に `#avatar-aura-img`／`#avatar-corner-aura-img` を追加。`_avatarAuraImgPath()`＝`equippedDetails.aura` の itemId（`_equipItemCode`）を `images/avatar/aura/<code>.png` に解決、未装着は `''`。`_applyAuraImg()` で src 反映＋読み込み失敗/未装着は非表示（割れ画像を出さない）。ベース未設定（プレースホルダ）ではオーラも非表示
  - `c8bc1e7` docs(handover)：アバター画像タップ遷移外し（`ef57550`）の本番反映を記録（前回反映分の記録）
  - **★ オーラは全て非公開（生徒はまだ装着不可）＝装着者ゼロのため見た目に変化なし**。装着経路が開くまで中間層は常に非表示
- **反映前の main（切り戻し先）：`ef57550f794498b5d6430cfce5137c4c60d4778b`**（＝`ef57550`）
- **マージコミット：`be58a2907fc105a9e582487517ca2202654bf5a8`**（＝`be58a29`）
- 版バッジ：`20260919-0027`（index / view / admin の3ファイル一致）
- GitHub Actions（pages build and deployment）：head_sha `be58a29` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`be58a29…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の blob と完全一致
  - index `f79ed591…` / view `0b14b0be…` / admin `b6b87b94…`
- 反映後、配信物そのもので確認したこと
  - **オーラ画像12枚すべて本番配信（`aura_01`〜`aura_12` HTTP 200・未配信0）**、各 Content-Length が origin/main の blob サイズと一致
  - 配信 index.html に `avatar-aura-img`＝6箇所ヒット（CSS 2＋img要素 2＋JS適用 2）＝オーラ中間層が確実に載っている
  - ゲート：`origin/main..dev` は3本のみ（想定通り＝`99847a0` オーラ中間層／`9c506af` オーラ画像12枚／`c8bc1e7` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 be58a2907fc105a9e582487517ca2202654bf5a8 && git push origin main && git checkout dev
  ```

## 2026-09-19 本番反映：撮影画面9箇所に「写真がスマホに溜まる」注意帯を追加（CSSのみ）

- 背景：撮った写真がカメラロールに溜まり「容量不足で撮れない」を防ぐため、各撮影画面の下部に整理を促す注意帯を常時表示
- 反映内容（dev→main マージ、2 コミット）
  - `a82db59` feat(撮影画面)：共通CSS `.photo-storage-note`（淡い黄背景 #fff8e1 + 濃いオレンジ枠 #f59e0b/文字 #b45309・太字・横長・角丸・≤480pxで縮小）を新設し、確定文面「📸 撮った写真はスマホに残ります。写真がいっぱいになると撮れなくなるので、ときどき「写真」アプリで整理（削除）してね。」を **9撮影画面の下部（コンテナ末尾）** に同一文面で追加。対象：dictation / sango-photo / wabun1-topic / kiso-work-intro / kiso-answer-intro / mytask-self-capture / mytask-hw-capture / oriwantes-create / kanji-kaki。**#6 kiso-work-after（もう1枚追加）は重複回避で除外**。撮影ロジック・file input（capture 10個健在）・他注意帯（reload-warn等）は無変更（表示のみ）
  - `1d10d94` docs(handover)：前回反映（アバター オーラ中間層＋オーラ画像12枚）の記録
- **反映前の main（切り戻し先）：`be58a2907fc105a9e582487517ca2202654bf5a8`**（＝`be58a29`）
- **マージコミット：`dddeaac0300bfb1c94a6fb4532a9103cbb8422ab`**（＝`dddeaac`）
- 版バッジ：`20260919-0459`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `dddeaac` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`dddeaac…` 実体を確認
- 配信物 sha256 が3ファイルとも `git show HEAD:` blob と完全一致
  - index `45103c2f…` / view `71b49e80…` / admin `cb4abe99…`
- 配信 index.html に `.photo-storage-note` CSS定義と、`class="photo-storage-note"` が **9箇所** 載っていることを確認（モバイル375pxで太字・目立つ配色・横長・はみ出しなしを実機確認）
- ゲート：`origin/main..dev` は2本のみ（想定通り＝`a82db59` 注意帯／`1d10d94` HANDOVER記録）／CLAUDE.md ゲート判定数値=12（CSS 3行＋注意帯9箇所）／admin・view の差分は版バッジ・`?v=` スタンプのみ／想定外の混入なし
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 dddeaac0300bfb1c94a6fb4532a9103cbb8422ab && git push origin main && git checkout dev
  ```

## 2026-09-20 本番反映：アバター段階2 置物系4種の定位置描画＋置物画像77枚配置

- 反映内容（dev→main マージ、4 コミット。生徒画面。★置物は全て非公開＝生徒の見た目に変化なし）
  - `ee1280e` feat(アバター)：コラボ背景15枚 `collab_01`〜`collab_15` を `images/avatar/collab/` に新設配置（DB collab_001〜015 紐付け用）
  - `3e70a8c` feat(アバター)：置物系62枚を新設配置（`item_01`〜20 / `pet_01`〜15 / `trophy_01`〜27）
  - `d2ca5e2` feat(アバター)：段階2 置物系4種を定位置に描画。`.avatar-stage` に置物4ゾーン（`avatar-deco-zone`＝collab/trophy/pets/items、z:3で背景/服/オーラの前面）を新設。`equippedDetails` のスロット別キー（pet_1/2・item_1/2・collab_1〜4・trophy_1〜4）をスロット順に描画（ペット/小物=足元・内→外／コラボ=左縦4・下→上／バッジ=右縦4・下→上）。imagePath 優先＋itemId フォールバック。未装着スロットは出さず onerror で割れ防止。**has-bg の非表示リストに含めない＝背景装着時も置物を残す（背景と両立）**。ホーム枠/コーナー枠の両方、着け外し即反映。置物がある側のマイカツ君プレースホルダ deco のみ隠す（無い側は従来表示＝回帰なし）
  - `1e58cba` docs(handover)：撮影画面9箇所の写真容量注意帯の本番反映を記録（前回反映分）
  - **★ 置物は全て非公開（予告）＝生徒はまだ装着不可。equippedDetails にスロットが入らない限り描画されないため見た目に変化なし**
- **反映前の main（切り戻し先）：`dddeaac0300bfb1c94a6fb4532a9103cbb8422ab`**（＝`dddeaac`）
- **マージコミット：`1f248f39ee946a6989ad25e709aa548fd2577293`**（＝`1f248f3`）
- 版バッジ：`20260920-0020`（index / view / admin の3ファイル一致）
- GitHub Actions（pages build and deployment）：head_sha `1f248f3` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`1f248f3…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の blob と完全一致
  - index `7d2fd14d…` / view `bf464205…` / admin `658a4123…`
- 反映後、配信物そのもので確認したこと
  - **置物画像77枚すべて本番配信（HTTP 200・未配信0）**：collab 15 / item 20 / pet 15 / trophy 27
  - 配信 index.html に `avatar-deco-zone`＝10ヒット（CSS 4＋ホーム枠4＋コーナー枠…実装分）＝置物描画ロジックが確実に載っている
  - 置物は全て非公開のまま（描画はスロット装着時のみ＝生徒の見た目に影響なし）
  - ゲート：`origin/main..dev` は4本のみ（想定通り＝`d2ca5e2` 置物描画／`3e70a8c` 置物62枚／`ee1280e` コラボ15枚／`1e58cba` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 1f248f39ee946a6989ad25e709aa548fd2577293 && git push origin main && git checkout dev
  ```

## 2026-09-20 本番反映：アバター置物 段階2 配置修正①②（枠外コラボ/バッジ・足元ライン）

- 背景：段階2で置物を描画したが配置が指示と相違。①コラボ/バッジを枠の外へ、②ペット/小物をアバター足元ラインへ、の2点修正。※置物は非公開のまま＝生徒への表示影響なし
- 反映内容（dev→main マージ、2 コミット）
  - `68d6474` fix(アバター置物)：**修正①** collab（左）/trophy（右）ゾーンを `.avatar-stage` の【外】へ移動（`.avatar-home-row` を flex `align-items:flex-end` にし、collab=stage前・trophy=stage後の枠外縦列に。CSS で collab/trophy を `position:static` 化・`column-reverse` 下→上・_1が最下段。ホーム/コーナー両方）。**修正②** ペット/小物の `bottom` を 10px→**36px**（モバイル 8px→**35px**）に上げ、アバター足元ライン（stage下端から約36px、実測差 -1〜-3px）へ整合。描画ロジック（`_renderAvatarDecoZone` 等）は無変更、段階0スロット制の返り値をそのまま使用。空状態はマイカツ君 deco 復活（回帰なし）
  - `a648703` docs(handover)：前回反映（段階2 置物描画＋画像77枚）の記録
- **反映前の main（切り戻し先）：`1f248f39ee946a6989ad25e709aa548fd2577293`**（＝`1f248f3`）
- **マージコミット：`c20a03c356d69832d882f9d614752a6d40f0e355`**（＝`c20a03c`）
- 版バッジ：`20260920-0409`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `c20a03c` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`c20a03c…` 実体を確認
- 配信物 sha256 が3ファイルとも `git show HEAD:` blob と完全一致
  - index `3a6aa682…` / view `223d5fa1…` / admin `065915c1…`
- 配信 index.html に `.avatar-deco-collab, .avatar-deco-trophy { position: static …}` と `bottom: 36px`（足元ライン）が載っていることを確認
- 検証（ブラウザ実測 desktop900 / mobile375、ホーム・コーナー両方）：コラボ=枠外左に縦4（下→上）/ バッジ=枠外右に縦4 / ペット・小物=足元ライン（差 -1〜-3px）/ モバイル横スクロールなし（row303・stage240）/ 背景・服・オーラ・本体は従来どおり
- ゲート：`origin/main..dev` は2本のみ（想定通り＝`68d6474` 配置修正／`a648703` HANDOVER記録）／CLAUDE.md ゲート判定数値=39（CSS 4箇所＋DOM 6箇所の移動・コメント）／admin・view の差分は版バッジ・`?v=` スタンプのみ／想定外の混入なし
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 c20a03c356d69832d882f9d614752a6d40f0e355 && git push origin main && git checkout dev
  ```

## 2026-09-20 本番反映：アバター足元の置物を外側へずらし足先を出す（横位置のみ）

- 背景：足元のペット・小物（内側＝ハムスター/リンゴ）がアバターの足先を隠していたため、横位置だけ外側へ寄せた。高さ・コラボ/バッジ・スマホ表示は不変。※置物は非公開＝生徒表示影響なし
- 反映内容（dev→main マージ、2 コミット）
  - `973569d` fix(アバター置物)：足元 pets/items の中央からの内側マージンを **デスクトップ 8px→38px／モバイル 8px→30px** に拡大（外側置物が枠 overflow で切れない範囲）。高さ（bottom 36/35px）・左右内→外2つ・コラボ枠外左/バッジ枠外右・スマホ表示は無変更。実測：足先が見え、外側エッジは stage 半幅内（desktop 146<160 / mobile 114<120）、横スクロールなし
  - `d6ca166` docs(handover)：前回反映（段階2 配置修正①②）の記録
- **反映前の main（切り戻し先）：`c20a03c356d69832d882f9d614752a6d40f0e355`**（＝`c20a03c`）
- **マージコミット：`52fa8bb829e0c1c209082c514bba25871b7bfff2`**（＝`52fa8bb`）
- 版バッジ：`20260920-0430`（index / view / admin の3ファイル）
- GitHub Actions（pages build and deployment）：head_sha `52fa8bb` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`52fa8bb…` 実体を確認
- 配信物 sha256 が3ファイルとも `git show HEAD:` blob と完全一致
  - index `ba60905c…` / view `61427fa5…` / admin `67ab0fe9…`
- 配信 index.html に `margin-right: 38px`（desktop）と `margin-right: 30px`（mobile）が載っていることを確認
- 検証（ブラウザ実測 desktop900 / mobile375）：足先が見える／ペット左・小物右・内→外2つ維持／高さ従来どおり／コラボ枠外左・バッジ枠外右従来どおり／横スクロールなし／背景・服・オーラ・本体・空状態deco 従来どおり
- ゲート：`origin/main..dev` は2本のみ（想定通り＝`973569d` 足元ずらし／`d6ca166` HANDOVER記録）／CLAUDE.md ゲート判定数値=9（pets/items margin＋コメント）／admin・view の差分は版バッジ・`?v=` スタンプのみ／想定外の混入なし
- 補足：反映作業中、ツール出力に実体のない壊れた表示（誤った checkout/fast-forward ログ）が混入したが、`git rev-parse origin/main` の実体確認で origin は無変更（c20a03c）と判定し、正規手順で反映した（誤反映なし）
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 52fa8bb829e0c1c209082c514bba25871b7bfff2 && git push origin main && git checkout dev
  ```

## 2026-09-20 本番反映：置物の自由入れ替えUI（段階B）＋人体3体差し替え

- 反映内容（dev→main マージ、3 コミット。生徒画面。★置物・服とも非公開＝生徒の見た目に変化なし）
  - `b5c0201` feat(アバター)：段階B 置物の自由入れ替えUI。クローゼットの置物カテゴリ（pet/item/collab/trophy）を「装着枠（slotLimit個）＋持ち物一覧」に拡張。装着枠＝埋（画像＋「外す」）/空（＋）、持ち物＝未装着を「装着する」。**外す＝`setAvatarEquip{unequip:true, categoryKey: slotKey}`（スロット指定・サーバー仕様）**／装着＝`setAvatarEquip{itemId}`（空きに入る/満杯で押し出し）。押し出しは `res.pushed` を見て軽量トースト「○○がクローゼットに戻りました」。**1排他カテゴリ（背景/服/オーラ）は従来の grid・`unequipAvatarCategory` のまま無変更**。着用案内バナー（買っただけでは着られない旨）をクローゼット上部に常時表示。ホーム `.avatar-home-row` 直下・左下に「👕きせかえ」リンク→`showAvatarCloset()`。slotLimits/slotKey/pushed はサーバー返り値を消費（フィールド名ゆらぎに防御的フォールバック）
  - `e073c82` fix(アバター)：人体3体 `AV0000012`/`AV0000035`/`AV0000049` を画像の乱れ修正版に差し替え（887×1774・透過維持、**AV番号・対応表 `AVATAR_OUTFIT_MAP` は不変**、他69体・他フォルダ無変更）
  - `869de7a` docs(handover)：足元置物の外側ずらしの本番反映を記録（前回反映分）
  - **★ 置物は非公開のまま＝生徒はまだ装着不可。服も非公開のため3体差し替えも生徒の見た目に影響なし**
- **反映前の main（切り戻し先）：`52fa8bb829e0c1c209082c514bba25871b7bfff2`**（＝`52fa8bb`）
- **マージコミット：`8dc08dc0aa33210305d51c8c998d8352dc4043cf`**（＝`8dc08dc`）
- 版バッジ：`20260920-1709`（index / view / admin の3ファイル一致）
- GitHub Actions（pages build and deployment）：head_sha `8dc08dc` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`8dc08dc…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の blob と完全一致
  - index `6fe49c8c…` / view `cef80a63…` / admin `bace4756…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `avatar-closet-link`＝5／`avatar-closet-guide`＝2／`unequipAvatarSlot`＝2／`avatar-slot-tray`＝2＝置物入れ替えUI（きせかえリンク・着用案内・スロット外す・装着枠）が確実に載っている
  - **AV3体すべて修正版で本番配信（HTTP 200・配信md5＝origin/main blob md5 一致）**：`AV0000012`=d66ef84b / `AV0000035`=bf6ec0f8 / `AV0000049`=3c45eed8
  - 置物・服とも非公開のまま（生徒の見た目に影響なし）
  - ゲート：`origin/main..dev` は3本のみ（想定通り＝`e073c82` 3体差替／`b5c0201` 置物入れ替えUI／`869de7a` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 8dc08dc0aa33210305d51c8c998d8352dc4043cf && git push origin main && git checkout dev
  ```

## 2026-09-20 本番反映：バッジ飾り棚UI（段階C-1）

- 反映内容（dev→main マージ、2 コミット。生徒画面。★バッジは非公開＝生徒の見た目に変化なし）
  - `06766a1` feat(アバター)：段階C-1 バッジ飾り棚UI。ホーム `.avatar-home-row` 直下・右下に「🏆バッジ棚」入口ボタン（左下＝👕きせかえ と対）→ `showBadgeShelf()`。新画面 `screen-badge-shelf`（trophy カテゴリ専用ビュー）＝金色の棚意匠（`.badge-shelf-rack`）に**装着枠4＋所持バッジ一覧**。飾る＝`equipAvatarItem`／しまう＝`unequipAvatarSlot(slotKey='trophy_n')`＝**段階B の入れ替えロジックを流用（重複実装なし）**。再描画は `_afterEquipReRender()` が「開いている画面（クローゼット/バッジ棚）」に分岐し B・C-1 が同じ equip/unequip を共有。各バッジ画像タップ→ `openBadgeZoom`（既存 `.modal-overlay` 流用・名前つき拡大）。「棚を閉じる」→ `goHome()`。排他カテゴリ（背景/服/オーラ）・置物クローゼット（段階B）は無変更。初取得演出（C-2、newlyAcquiredBadges）は未着手
  - `747a771` docs(handover)：置物入れ替えUI（段階B）＋人体3体差し替えの本番反映を記録（前回反映分）
  - **★ バッジは非公開（本付与は公開直前）＝生徒はまだ所持しないため飾り棚は空表示、見た目に影響なし**
- **反映前の main（切り戻し先）：`8dc08dc0aa33210305d51c8c998d8352dc4043cf`**（＝`8dc08dc`）
- **マージコミット：`742c874a9624c1fe84c0530e59e1928076146164`**（＝`742c874`）
- 版バッジ：`20260920-2058`（index / view / admin の3ファイル一致）
- GitHub Actions（pages build and deployment）：head_sha `742c874` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`742c874…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の blob と完全一致
  - index `4a403803…` / view `08fd01c6…` / admin `51300d7a…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `showBadgeShelf`＝3／`screen-badge-shelf`＝3／`badge-shelf-rack`＝4／`openBadgeZoom`＝3／`avatar-shelf-link`＝3＝バッジ飾り棚UI（入口・棚・拡大）が確実に載っている
  - バッジは非公開のまま（生徒の見た目に影響なし）
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`06766a1` バッジ飾り棚／`747a771` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 742c874a9624c1fe84c0530e59e1928076146164 && git push origin main && git checkout dev
  ```

## 2026-09-20 本番反映：バッジ保管庫の見た目改善（4段の棚＋戻り位置＋名称変更）

- 反映内容（dev→main マージ、2 コミット。生徒画面。★バッジは非公開＝生徒の見た目に変化なし）
  - `73d3c77` feat(アバター)：段階C-1 の見た目改善3点。
    - **修正①**：保管庫を閉じる → `goHomeToAvatar()`（`goHome()` 後に `#screen-welcome .avatar-home-row` を `scrollIntoView({block:'center'})`）でアバター行（アバター＋置物＋バッジ＋きせかえ/保管庫ボタン）が見える位置へ戻す（最上部でない）。smooth はブラウザにより不発のため instant、フォールバック（`window.scrollTo` 計算）も実装
    - **修正②-a**：枠外左右（コラボ左／バッジ右）を「4段の棚」に。`.avatar-deco-collab / .avatar-deco-trophy` の `:not(:empty)` 時のみ木目の保管庫背景を出し、各画像の下に棚板（`border-bottom`）を敷いて置物/バッジが各段に乗って見えるように。**配置（段階2：下→上4つ）は不変**＝背景と棚板を足すだけ。**未所持（ゾーン空）は従来どおり透明**（`:not(:empty)` ガード＝回帰なし）。ホーム/コーナー共通クラスのため両方に適用
    - **修正②-b**：名称変更「バッジ棚」→「バッジ保管庫」（入口ボタン・画面ヘッダー）、「棚を閉じる」→「保管庫を閉じる」（上下2箇所）、intro「棚に飾れる」→「保管庫に飾れる」。関数名（`showBadgeShelf` 等）・入れ替え/拡大ロジックは不変
  - `cfceff4` docs(handover)：バッジ飾り棚UI（段階C-1）の本番反映を記録（前回反映分）
  - **★ バッジは非公開＝生徒はまだ所持しないため保管庫は空、枠外ゾーンも空（透明）＝見た目に影響なし**
- **反映前の main（切り戻し先）：`742c874a9624c1fe84c0530e59e1928076146164`**（＝`742c874`）
- **マージコミット：`f4d047f5a04ddb4abaeeab8bc16c9343033161dd`**（＝`f4d047f`）
- 版バッジ：`20260920-2134`（index / view / admin の3ファイル一致）
- GitHub Actions（pages build and deployment）：head_sha `f4d047f` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`f4d047f…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の blob と完全一致
  - index `b08d186a…` / view `5141058a…` / admin `cfe661f3…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `バッジ保管庫`＝2／`保管庫を閉じる`＝2／`goHomeToAvatar`＝4／棚CSS `:not(:empty)`＝4＝名称変更・戻り関数・4段の棚が確実に載っている
  - バッジは非公開のまま（生徒の見た目に影響なし）
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`73d3c77` 保管庫の見た目改善／`cfceff4` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 f4d047f5a04ddb4abaeeab8bc16c9343033161dd && git push origin main && git checkout dev
  ```

## 2026-09-20 本番反映：バッジ保管庫 intro 文言修正（「棚に飾れるのは」に戻す）

- 反映内容（dev→main マージ、2 コミット。生徒画面。★バッジは非公開＝生徒の見た目に変化なし）
  - `5c3e588` fix(アバター)：保管庫画面 intro（`_renderBadgeShelf`）の文言を「保管庫に飾れるのは 4 つまで。」→**「棚に飾れるのは 4 つまで。」**の1箇所のみ修正（飾る先は枠外の「棚」が正しいため）。入口ボタン「バッジ保管庫」・ヘッダー「バッジ保管庫」・「保管庫を閉じる」×2 の名称は変更なし。関数名・入れ替え/拡大ロジックも不変
  - `7876578` docs(handover)：バッジ保管庫の見た目改善（4段の棚＋戻り位置＋名称）の本番反映を記録（前回反映分）
- **反映前の main（切り戻し先）：`f4d047f5a04ddb4abaeeab8bc16c9343033161dd`**（＝`f4d047f`）
- **マージコミット：`350fab54335e5b62aa11347707d1e8e4aae80e1c`**（＝`350fab5`）
- 版バッジ：`20260920-2154`（index / view / admin の3ファイル一致）
- GitHub Actions（pages build and deployment）：head_sha `350fab5` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`350fab5…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の blob と完全一致
  - index `1e4f80c4…` / view `87984d5d…` / admin `26aa6bda…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `棚に飾れるのは`＝1／`保管庫に飾れる`＝0＝intro が「棚に飾れるのは」に戻った／`バッジ保管庫`＝2（名称は維持）
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`5c3e588` 文言修正／`7876578` HANDOVER記録）／index の実質差分は intro 1行のみ／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 350fab54335e5b62aa11347707d1e8e4aae80e1c && git push origin main && git checkout dev
  ```

## 2026-09-20 本番反映：バッジ初取得演出（段階C-2）

- 反映内容（dev→main マージ、2 コミット。生徒画面。★バッジ非公開・本付与前＝生徒の見た目に変化なし＝休眠コード）
  - `1fe03ab` feat(アバター)：段階C-2 バッジ初取得演出。トリガー＝`_loadAvatarStateOnHome` の `getAvatarState` 応答で `res.newlyAcquiredBadges` があればホーム表示後に `_maybeShowBadgeAcquire` を発火。新画面 `screen-badge-acquire`（誕生日サプライズの bsurprise 背景/紙吹雪/カード/ボタン資産を流用）でバッジ画像を `@keyframes bsurprise-pop` でズームアップ＋発光＋トロフィー系紙吹雪。お祝いコピー「やったね！バッジをゲット！」＋バッジ名。複数同時獲得は「つぎへ▶」で順に（カウント n/N）、最後は「とじる」。とじる→ `markBadgeSeen(itemIds)` を fire-and-forget（誕生日 `markBirthdayGreetShown` と同型）＋ getAvatarState キャッシュ破棄→ホーム復帰。セッション既読 `_badgeAcquireShownIds` で再演出しない保険。誕生日サプライズ表示中はスキップ（順序で競合回避）。`#screen-badge-acquire { overflow:hidden }` でモバイル横はみ出し防止。保管庫(C-1)・置物・背景・服・オーラは無変更
  - `34140ce` docs(handover)：保管庫 intro 文言修正（棚に飾れるのは）の本番反映を記録（前回反映分）
  - **★ バッジは非公開・本付与前＝newlyAcquiredBadges が空のため演出は発火しない（休眠コード）＝生徒の見た目に影響なし**
- **反映前の main（切り戻し先）：`350fab54335e5b62aa11347707d1e8e4aae80e1c`**（＝`350fab5`）
- **マージコミット：`4d336f504feaeefa0383121b860a5881f013bbb4`**（＝`4d336f5`）
- 版バッジ：`20260920-2224`（index / view / admin の3ファイル一致）
- GitHub Actions（pages build and deployment）：head_sha `4d336f5` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`4d336f5…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の blob と完全一致
  - index `ed9c24b1…` / view `97e73ddf…` / admin `cb939c97…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `screen-badge-acquire`＝3／`newlyAcquiredBadges`＝4／`markBadgeSeen`＝4／`_maybeShowBadgeAcquire`＝3／`やったね！バッジをゲット`＝1＝C-2演出（画面・トリガー・既読化）が確実に載っている
  - バッジは非公開・本付与前＝演出は発火しない（生徒の見た目に影響なし）
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`1fe03ab` C-2演出／`34140ce` HANDOVER記録）／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 4d336f504feaeefa0383121b860a5881f013bbb4 && git push origin main && git checkout dev
  ```

## 2026-09-21 本番反映：①服の試着・購入前プレビュー

- 反映内容（dev→main マージ、2 コミット。生徒画面。★フロント純追加・サーバー/DB/HP 不変。★服・ショップは非公開＝生徒の見た目に変化なし）
  - `dee8294` feat(アバター)：①服の試着・購入前プレビュー。ショップの tops/bottoms カードに「👗 試着する」を追加。現在の装着（equippedDetails.tops/.bottoms）に試着1点を重ねた姿を専用モーダル `#avatar-tryon-modal` で表示する純プレビュー。★`_avatarState` を一切書き換えない非破壊方式（`_avatarBodyImgPathWith(topsCode, bottomsCode)` で合成パスだけ算出）＝`setAvatarEquip`・`submitExchange` を呼ばず、サーバー/DB/HP に一切触れない。試着ボタンは `_avatarCanTryOn(categoryKey, itemCode)` が `AVATAR_OUTFIT_MAP` を引いて着姿を描ける服だけに動的表示（コード直書きなし＝将来マップ拡張で自動追従、素体落ちする服・outfit には出さない）。base 照合は必ず生徒自身の base（boy/girl/neutral 取り違えなし）。完成画像が読めなければ素体に安全落ち。交換導線は任意で購入可能・未所持時のみ既存 `buyAvatarItem` を流用。閉じたら痕跡ゼロ（元から不変なので復元処理不要）。C-2演出・保管庫・置物・背景・オーラ・服の既存表示は無変更（`_renderAvatarShopCategory` にボタン1行追加した以外はすべて新規追加）
  - `897a011` docs(handover)：バッジ初取得演出（段階C-2）の本番反映を記録（前回反映分）
  - **★ 服・ショップは非公開＝生徒の見た目に変化なし。試着は「見るだけ」の一時プレビューで既存の購入・装着導線は不変**
- **反映前の main（切り戻し先）：`4d336f504feaeefa0383121b860a5881f013bbb4`**（＝`4d336f5`）
- **マージコミット：`8e8c4b526b4c30c9a508b742817ada31db26784c`**（＝`8e8c4b5`）
- 版バッジ：`20260921-0335`（index / view / admin の3ファイル一致）
- GitHub Actions（pages build and deployment）：head_sha `8e8c4b5` で `completed / success` を確認（gh 未導入のため API で確認）。`git rev-parse origin/main`＝`8e8c4b5…` 実体を確認。
- 配信物 sha256 が3ファイルとも `git show origin/main:` の blob と完全一致
  - index `73c8ec1a…` / view `f1967b03…` / admin `15a5f891…`
- 反映後、配信物そのもので確認したこと
  - 配信 index.html に `tryOnAvatarItem`／`試着する`／`_avatarCanTryOn` 系が計7ヒット＝試着機能が確実に載っている
  - ローカル検証（モック `_avatarState`+`getAvatarShop` 注入）：描ける服 tops_002 に試着ボタン出る／描けない tops_005・outfit には出ない／3 base で正しい別AV（boy=AV2・girl=AV6・neutral=AV10、取り違えなし）／現装着に重ねる合成（boy×tops_001＋bottoms_003=AV28、girl×tops_002＋bottoms_003=AV48）／閉じたら `_avatarState` 不変・`setAvatarEquip`=0回・`submitExchange`=0回／モバイル375px 横スクロールなし
  - ゲート：`origin/main..dev` は2本のみ（想定通り＝`dee8294` 試着／`897a011` HANDOVER記録）／index の実質差分は+101行の純追加のみ／admin・view の差分は版バッジ・`?v=` スタンプのみ
- 切り戻し（push -f は使わない）：
  ```bash
  git checkout main && git revert --no-edit -m 1 8e8c4b526b4c30c9a508b742817ada31db26784c && git push origin main && git checkout dev
  ```
