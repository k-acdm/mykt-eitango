# 基礎計算 Phase 4 着手プロンプト集

- **作成日**：2026年4月25日
- **目的**：Phase 4（GAS バックエンド実装）の作業を3段階に分割し、各段階で Claude Code に投げるプロンプトをあらかじめ用意しておくドキュメント
- **使い方**：各 Phase の段階に応じて、該当セクションのプロンプトをコピーして Claude Code に投げる

---

## Phase 4 全体の構成

| Phase | 内容 | 想定時間 | 依存 |
|---|---|---:|---|
| Phase 4-1 | 基盤整備（シート、Drive権限、600問投入） | 60〜90分 | HPLog rawHP 改修済み（完了済） |
| Phase 4-2 | コア実装（startKisoSession, getKisoRetryQuestions, submitKisoAnswer） | 90〜120分 | Phase 4-1 |
| Phase 4-3 | 周辺機能（Drive連携、getKisoPhotosList, cleanupKisoPhotos） | 45〜60分 | Phase 4-2 |
| **合計** | | **3〜4.5時間** | |

---

## Phase 4-1：基盤整備

```
基礎計算 Phase 4-1 に着手します。Phase 4 全体は3段階に分割：
- Phase 4-1：基盤整備（本依頼）
- Phase 4-2：コア実装（startKisoSession, getKisoRetryQuestions, submitKisoAnswer）
- Phase 4-3：周辺機能（Drive連携実装、getKisoPhotosList, cleanupKisoPhotos）

【最初に必読】
- docs/基礎計算_仕様書.md（特に §3, §6, §7, §8, §9）
- docs/基礎計算_Phase4_調査レポート.md
- scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md（Phase 4 でも参照）

【Phase 4-1 の作業内容】

1. シート整備（KisoQuestions, KisoSessions, KisoPhotos の3シート新設）
   - 各シートの列構成は仕様書 §3.1 の通り
   - GAS で自動的にシートが作られるように、初回呼び出し時のシート存在チェック＋作成ロジックを共通化
   - 列ヘッダーも自動セット

2. appsscript.json に Drive 権限を追加
   - oauthScopes に "https://www.googleapis.com/auth/drive" を追加
   - 既存スコープを壊さないように注意

3. KisoQuestions シートに Phase 1+2 で生成した 600 問の投入
   - scripts/generate_kiso_questions/main.py を --ranks 1,2,3,...,20 で全実行
   - 出力されたJSONをスプレッドシートに一括投入
   - 投入用の Python スクリプト（common/db_writer.py）を新規作成
   - gspread を使う、認証は Google Service Account JSON
   - 認証情報の取得方法と置き場所もドキュメント化

4. 動作確認
   - 3シートが正しく作られているか
   - KisoQuestions に 600 問が投入されているか（rank ごとに 30 問ずつ × 20級）
   - サンプルクエリでランダム抽出ができるか確認

【コミット指示】
作業完了後、dev に直接コミット＋push してください。

コミットメッセージ案：
feat(基礎計算): Phase 4-1 — シート整備＋600問DB投入＋Drive権限追加

- 新規シート3つ作成（KisoQuestions, KisoSessions, KisoPhotos）
- KisoQuestions に Phase 1+2 で生成した全600問を投入
- common/db_writer.py を新設（gspread経由）
- appsscript.json に Drive oauthScopes 追加
- Phase 4-2 への準備完了

【完了報告】

以下を含めて報告してください：
- 投入された問題数（級ごとの内訳）
- Drive 権限追加後の oauthScopes 一覧
- 認証情報の置き場所と運用方法
- Phase 4-2 着手前にユーザーが手動で実施すべき作業（あれば、例：clasp push、デプロイ更新、Drive権限の再承認など）
```

---

## Phase 4-2：コア実装

```
基礎計算 Phase 4-2 に着手します。Phase 4-1 で整備された基盤の上に、
コア機能（startKisoSession, getKisoRetryQuestions, submitKisoAnswer）を実装します。

【最初に必読】
- docs/基礎計算_仕様書.md（特に §3.3 セッション管理、§7 採点ロジック、§8 HP加算ロジック）
- docs/基礎計算_Phase4_調査レポート.md（流用可能ヘルパーの一覧）
- scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md

【Phase 4-2 の作業内容】

1. startKisoSession(studentId, rank, count) の実装
   - 仕様書 §3.3 ステップ1
   - KisoQuestions から rank 該当の問題を count 件ランダム抽出
   - KisoSessions に行追加（status=in_progress, questionIds=[...]）
   - フロントには問題文のみ返却（answerCanonical, answerAllowed は送らない、§3.2 セキュリティ要件）
   - エラーハンドリング：rank 不正、count 不正、当該rank の問題数不足、認証

2. getKisoRetryQuestions(sessionId) の実装
   - 仕様書 §4.8 再挑戦
   - KisoSessions から不正解だった問題のみ抽出
   - 同じく問題文のみ返却

3. submitKisoAnswer(sessionId, imageBase64) の実装 ★Phase 4-2 の山場
   - 仕様書 §7 採点ロジック全般
   - サブステップ：
     1. Vision API で OCR 実行（既存の submitPhoto パターン流用、Code.js:748）
     2. OCR結果を問題番号で分割（仕様書 §7.2）
     3. 各問題について answerAllowed と照合（§7.3、既約性・簡約性の厳格チェック）
     4. 正答率80%判定（§7.4）
     5. 合格時：
        - HPLog に記録（rawHP=素点、hp=素点×倍率、source=kiso_{rank}_{count}）
        - 1日素点上限100HPの判定（仕様書 §8.3、§8.5 ケース2の min(100, 100-既獲得素点) 計算）
        - 上限超過時は練習モード扱い（rawHP=0, hp=0, source 末尾に _practice）
        - KisoSessions の status=passed, completedAt 更新
     6. 不合格時：
        - KisoSessions の status=failed_retry, attempts インクリメント
        - 不正解問題のIDリストをセッションに保存
     7. 初回提出のみ写真をDriveに保存（§3.4、§4.6）
        - Phase 4-3 で完成させる Drive 連携を呼び出す
        - Phase 4-2 時点では呼び出しのフックだけ用意（実装は Phase 4-3 で）
     8. レスポンス組み立て：⭕❌配列、合格判定、HP情報、解説情報

【設計原則の遵守】
- 仕様書 §6.8 決定2（既約分数のみ正解）：採点で厳格チェック
- 仕様書 §6.8 決定3（簡約・有理化済みのみ正解）：採点で厳格チェック
- メモリ#9（HP上限到達後も練習モード可能）：練習モードへの移行ロジック必須

【コミット指示】
作業完了後、dev に直接コミット＋push してください。

コミットメッセージ案：
feat(基礎計算): Phase 4-2 — コア実装（セッション開始/再挑戦/採点）

- startKisoSession：問題ランダム抽出、セッション作成
- getKisoRetryQuestions：不正解問題のみ再表示
- submitKisoAnswer（山場）：OCR + 厳格採点 + 80%判定 + HP付与（素点上限判定含む）
- 練習モード対応（HP上限到達後も学習可能）
- Drive 連携は Phase 4-3 で完成、本Phaseではフックのみ

【完了報告】

以下を含めて報告してください：
- 各関数の動作確認方法（テスト用の入力・期待出力）
- 実装中に発見した既存コードの問題点（あれば）
- Phase 4-3 への引き継ぎ事項
```

---

## Phase 4-3：周辺機能

```
基礎計算 Phase 4-3 に着手します。Drive連携の本実装と、写真閲覧・自動削除を完成させます。
これで Phase 4 全体が完了します。

【最初に必読】
- docs/基礎計算_仕様書.md（特に §3.4 写真ストレージ、§5 管理画面）
- docs/基礎計算_Phase4_調査レポート.md
- 仕様書 §3.4 の Drive フォルダ構造、ファイル名規則

【Phase 4-3 の作業内容】

1. Drive 連携基盤の完成
   - Phase 4-1 で oauthScopes は追加済み、本Phaseで実装
   - フォルダ構造：マイ活_基礎計算_答案写真/YYYY-MM/
   - ファイル名規則：{生徒ID}_{rank}_{sessionId}.jpg
   - 関数化：
     - _ensureKisoPhotoFolder(yearMonth)：年月フォルダの存在保証
     - _saveKisoPhoto(studentId, rank, sessionId, imageBase64)：保存して fileId 返す
     - _deleteKisoPhoto(driveFileId)：削除（setTrashed(true)）
   - Phase 4-2 で用意した submitKisoAnswer のフックを実装で埋める

2. getKisoPhotosList(studentId) の実装
   - 仕様書 §5.3、§5.4
   - 管理画面用、認証必須
   - KisoPhotos シートから生徒の保存中写真を取得
   - フロントに必要な情報（級、提出日時、削除予定日、サムネURL、フルサイズURL）をまとめて返す
   - 認証：_verifyAdmin パターンを流用

3. cleanupKisoPhotos() の実装
   - 仕様書 §3.4 自動削除
   - KisoPhotos シートを走査、deleteAfter <= 今日 の行を処理
   - Drive 上のファイルを削除（setTrashed）+ シートの行削除
   - 同様に英語長文リスニング音読の録音も将来同じパターンで削除予定（cleanupListeningRecordings）
   - エラーハンドリング：削除済みファイルへの参照、権限エラー

4. Time-based Trigger の設定（手動）
   - cleanupKisoPhotos を毎日 3:00〜4:00 に自動実行
   - GAS UI から手動でトリガー設定（コードは作らない）
   - ユーザーへの設定手順を完了報告に明記

5. 動作確認
   - submitKisoAnswer の初回写真送信で Drive 保存が動くか
   - getKisoPhotosList が管理画面から呼べるか
   - cleanupKisoPhotos を手動実行して正しく削除されるか（テスト用に短期日のレコードを作って確認）

【コミット指示】
作業完了後、dev に直接コミット＋push してください。

コミットメッセージ案：
feat(基礎計算): Phase 4-3 — Drive連携完成、写真閲覧・自動削除実装

- _ensureKisoPhotoFolder, _saveKisoPhoto, _deleteKisoPhoto 実装
- submitKisoAnswer の初回写真保存フックを実装で埋める
- getKisoPhotosList（管理画面用、認証必須）実装
- cleanupKisoPhotos（日次トリガー用）実装
- Time-based Trigger は GAS UI から手動設定、設定手順を完了報告に明記
- 基礎計算 Phase 4 全体完了：バックエンド GAS 実装が稼働可能な状態に

【完了報告】

以下を含めて報告してください：
- Drive のフォルダ構造（実際に作られたフォルダパス）
- Time-based Trigger の手動設定手順（ユーザー作業）
- Phase 5（フロント実装）への引き継ぎ事項
- 動作確認結果（写真保存・閲覧・削除の各経路）
```

---

## Phase 4 完了後のチェックリスト

Phase 4-1, 4-2, 4-3 すべて完了後、以下を確認：

- [ ] `clasp push` 完了、GAS に最新コード反映
- [ ] GAS デプロイ更新（新バージョン）
- [ ] KisoQuestions に 600 問投入済み
- [ ] Drive のルートフォルダ「マイ活_基礎計算_答案写真」が存在
- [ ] Time-based Trigger が cleanupKisoPhotos に設定済み（毎日3:00〜4:00）
- [ ] Phase 5（フロント実装）の依頼プロンプト準備
- [ ] CLAUDE.md に Phase 4 完了の記録

---

## 次の Phase（参考）

Phase 4 完了後の流れ：

| Phase | 内容 | 想定時間 |
|---|---|---:|
| Phase 5 | フロント（index.html）：級選択、問題表示、写真撮影、結果画面 | 2〜3日 |
| Phase 6 | 管理画面（admin.html）：写真閲覧機能 | 1〜2日 |
| Phase 7 | 実機動作確認＋調整 | 2〜3日 |

Phase 5 以降の依頼プロンプトは、Phase 4 完了時に状況に応じて作成。
