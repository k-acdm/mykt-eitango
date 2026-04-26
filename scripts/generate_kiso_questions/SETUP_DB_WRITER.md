# db_writer.py セットアップ手順

`scripts/generate_kiso_questions/common/db_writer.py` を実行して `KisoQuestions` シートに 600 問を一括投入するための準備手順。**1 回だけセットアップすれば後は `python -m common.db_writer` を叩くだけ**。

## 1. 必要な前提

| 項目 | 状態 |
|---|---|
| Python 3.11+ | ✅ 自宅PC・塾PC とも 3.14.4 |
| 生成済み JSON 600 問 | ✅ `python main.py` で `out/questions_rank_*.json` 生成済み |
| マイ活アプリのスプレッドシート | ✅ 既存 |
| Google Cloud Service Account | ⚠️ **未作成**（本ドキュメントの対象） |

## 2. Google Cloud Service Account の作成

スプレッドシートに API 経由で書き込むには、人間アカウントの OAuth ではなく **Service Account（サービスアカウント）** を使う。GAS とは独立した認証口で、認証 JSON を 1 回作れば再ログイン不要。

### 2-1. Google Cloud プロジェクトを開く（または作る）

https://console.cloud.google.com/ にログイン。マイ活アプリ用の既存プロジェクトがあればそれを使い、なければ新規作成（プロジェクト名は任意、例：`mykt-eitango`）。

### 2-2. 必要な API を有効化

「API とサービス」→「ライブラリ」から以下 2 つを有効化：

- **Google Sheets API**
- **Google Drive API**（gspread が裏で参照する）

### 2-3. Service Account を作る

「IAM と管理」→「サービスアカウント」→「サービスアカウントを作成」：

- **名前**：`mykt-eitango-writer`（任意）
- **役割**：付与不要（GCP 内のロールは不要、共有設定で十分）
- 作成後、「鍵を追加」→「新しい鍵を作成」→ **JSON** を選択 → ダウンロード

### 2-4. JSON ファイルを安全な場所に置く

ダウンロードした JSON（`mykt-eitango-writer-XXXXX.json`）を以下のいずれかへ：

- 自宅PC の例：`C:\Users\Manager\Documents\gcp-credentials\mykt-eitango-writer.json`
- 塾PC の例：（塾PC 上にも同じ JSON をコピーしておくと両環境で実行可能）

**重要**：この JSON は**絶対に git にコミットしない**。`.gitignore` に登録済みのパス（リポジトリ外）に置く。

### 2-5. スプレッドシートに Service Account を共有

ダウンロードした JSON 内の `"client_email"` の値（例：`mykt-eitango-writer@xxxxx.iam.gserviceaccount.com`）を確認。

マイ活アプリのスプレッドシート（GAS が紐付いている本体）を Drive で開き、「共有」ボタン → 上記メールアドレスを **編集者** として追加。

## 3. 環境変数の設定（推奨）

毎回 `--credentials` `--spreadsheet-id` を打つのは煩雑なので、シェル起動時に環境変数で渡す。

### 3-1. スプレッドシート ID を取得

GAS エディタからプロジェクトを開いた状態で `_ss().getId()` を実行 or スプレッドシート URL の `https://docs.google.com/spreadsheets/d/{ここがID}/edit` を確認。

### 3-2. PowerShell の場合（自宅PC・塾PC とも Windows 想定）

```powershell
# 一時的な設定（ターミナル閉じると消える）
$env:KISO_GSPREAD_CREDENTIALS = "C:\Users\Manager\Documents\gcp-credentials\mykt-eitango-writer.json"
$env:KISO_SPREADSHEET_ID = "1AbCdEfG..."  # 実際の ID に置き換え
```

恒久的に設定したい場合は「システムのプロパティ」→「環境変数」から `KISO_GSPREAD_CREDENTIALS` と `KISO_SPREADSHEET_ID` をユーザー環境変数として登録。

## 4. 依存ライブラリのインストール

```powershell
cd C:\Users\Manager\mykt-eitango\scripts\generate_kiso_questions
python -m pip install -r requirements.txt
```

`gspread` `google-auth` `sympy` `pandas` がインストールされる。

## 5. KisoQuestions シートの事前準備（GAS 側）

GAS エディタで `ensureKisoSheets()` を **1 回だけ** 実行する。`KisoQuestions` / `KisoSessions` / `KisoPhotos` の 3 シートが（無ければ）自動作成され、ヘッダー行が設定される。

戻り値で各シートが新規作成されたかどうかが分かる：

```javascript
{
  ok: true,
  created: { questions: true, sessions: true, photos: true },
  headers: { questions: [...], sessions: [...], photos: [...] }
}
```

## 6. 投入実行

### 6-1. dry-run（書き込まずに行数のみ確認）

```powershell
cd C:\Users\Manager\mykt-eitango\scripts\generate_kiso_questions
python -m common.db_writer --dry-run
```

期待出力：

```
集計完了: 600 行（20 rank, out/ から）
  rank  1 (二次方程式      ): 30 行
  ...
  rank 20 (整数四則混合      ): 30 行
[dry-run] スプレッドシートに書き込みません。先頭 3 行のサンプル:
  q_20_000001 | 20 | 整数四則混合 | A | 3 + 2 | 5 | ["5"] | 2026-04-27T...
```

### 6-2. 本番投入

```powershell
python -m common.db_writer
```

実行内容：

1. `out/questions_rank_*.json` 全 20 ファイルを読み込み
2. `questionId` を `q_{rank:02d}_{連番:06d}` で振り直し（rank ごとに 1 から）
3. KisoQuestions シートのデータ行（ヘッダー以外）を全削除
4. 600 行を一括書き込み

期待出力：

```
集計完了: 600 行（20 rank, out/ から）
...
スプレッドシートに接続: 1AbCdEfG...
KisoQuestions シートを取得
書き込み完了: 600 行 / モード: 全置換（ヘッダー以外を削除してから投入）
```

## 7. 動作確認（GAS 側）

GAS エディタで `sampleKisoQuestions(20, 3)` を実行。20 級から 3 問ランダム抽出されたサンプルが返る：

```javascript
{
  ok: true,
  rank: 20,
  requested: 3,
  found: 30,    // 20 級の総問題数
  sample: [
    { questionId: "q_20_000017", problemLatex: "...", answerCanonical: "..." },
    { questionId: "q_20_000003", problemLatex: "...", answerCanonical: "..." },
    { questionId: "q_20_000028", problemLatex: "...", answerCanonical: "..." }
  ]
}
```

`found: 30` が表示されれば 20 級分の投入が成功している。同じく `sampleKisoQuestions(1, 3)` で 1 級も `found: 30` が出れば全 20 rank 投入完了。

## 8. トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `Permission denied: The caller does not have permission` | スプレッドシートに Service Account を共有していない | §2-5 を実施 |
| `gspread.exceptions.SpreadsheetNotFound` | spreadsheet-id が間違っている | §3-1 を再確認 |
| `FileNotFoundError: out/questions_rank_*.json` | main.py を未実行 | `python main.py` を先に実行 |
| `quota exceeded` | API 呼び出し回数制限 | 数分待ってから再実行（書き込みは 60req/min） |
| `Range (KisoQuestions!A2:H601) exceeds grid limits. Max rows: 1` | KisoQuestions シートの最大行数が小さすぎる（過去版の `ensureKisoSheets` で作成された場合に発生） | 後述の §10 を実施 |

## 9. 再投入する場合

問題データを更新したい場合：

1. `python main.py` で再生成（必要な rank のみなら `--ranks 14,16` などで限定）
2. `python -m common.db_writer` で再投入（既存データは全削除されてから新データが入る）

特定 rank だけ更新したい場合：

```powershell
python -m common.db_writer --ranks 14,16
```

ただし、`--ranks 14,16` 指定でも `--append` をつけないと **シート全体が削除される**ことに注意。特定 rank だけ差し替えたい時は `--append` を使うか、シートで該当 rank の行を手動削除してから `--append` で投入。

## 10. シート行数不足エラーからの復旧手順

### 症状

```
APIError: [400]: Range (KisoQuestions!A2:H601) exceeds grid limits.
Max rows: 1, max columns: 26
```

### 原因

過去版の `ensureKisoSheets()` は新規シートを最大行数 1 で作成していたため、600 行の bulk update がグリッドサイズを超えて 400 エラーになる。

### 修正内容（既に dev に push 済）

- **GAS 側**：`_ensureSheetWithHeaders` に `minRows` 引数を追加。`KisoQuestions` は 2100 行、`KisoSessions` / `KisoPhotos` は 1100 行を最低保証。
- **db_writer.py 側**：`write_to_sheet` の冒頭で `_ensure_sheet_capacity` を呼び、書き込みに必要なサイズを動的に確保（gspread の `add_rows` / `add_cols`）。

### 復旧手順（ふくちさん作業）

既存の KisoQuestions シートを **削除する必要はない**。新コードを反映すれば自動拡張される。

1. **GAS 新コードを反映**：
   ```powershell
   cd gas
   clasp push
   ```
   GAS エディタで「デプロイ → 新しいデプロイを管理 → 編集 → バージョン更新 → デプロイ」

2. **シート最大行数を一括拡張**（GAS エディタから 1 回実行）：
   ```javascript
   ensureKisoSheets()
   ```
   既存シートを再利用しつつ最大行数だけ 2100 / 1100 / 1100 に引き上げる。戻り値の `maxRows` フィールドで実際の最大行数が確認できる：
   ```javascript
   {
     ok: true,
     created: { questions: false, sessions: false, photos: false },
     maxRows: { questions: 2100, sessions: 1100, photos: 1100 },
     headers: { ... }
   }
   ```

3. **db_writer 側もコードを最新化**：
   ```powershell
   git pull origin dev
   ```
   （リポジトリを更新済みなら自動で `db_writer.py` の修正が入る）

4. **再投入**：
   ```powershell
   cd scripts/generate_kiso_questions
   python -m common.db_writer
   ```
   今度は db_writer 側でも書き込み前にサイズを再確認するため、GAS 側のシート設定とは独立して動く。

5. **確認**：GAS エディタで `sampleKisoQuestions(20, 3)` などを叩き、`found: 30` が返れば成功。
