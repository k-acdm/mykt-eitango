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
