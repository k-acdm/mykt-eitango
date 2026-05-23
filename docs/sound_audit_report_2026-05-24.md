# マイ活アプリ 効果音調査レポート（2026-05-24）

**作業セッション**：理社重要語句のホーム画面カード調整＋セリフ調整＋効果音調査
**対象コミット**：`30b783d` 時点（理社重要語句 枠組み実装直後）
**目的**：① 全効果音ファイルとその使用場面を体系化、② 理社重要語句が「英単語RUSH と同じ効果音」を使う仕様と整合しているか確認

---

## 1. 効果音ファイル一覧（オーディオアセット）

リポジトリルート（`./`）に MP3 ファイル **5 個**のみ。他フォルダ（`images/`, `docs/` 等）には音声ファイル無し。

| ファイル | サイズ | 最終更新 | 想定用途 |
|---|---|---|---|
| `correct.mp3` | 42,630 B（41.6 KB） | 2026-04-17 | 正解音（短いポジティブな効果音） |
| `wrong.mp3`   | 13,791 B（13.5 KB） | 2026-04-17 | 不正解音（短いネガティブな効果音） |
| `pass.mp3`    | 54,144 B（52.9 KB） | 2026-04-17 | 合格ファンファーレ（セット 20 問満点合格時） |
| `fail.mp3`    | 86,516 B（84.5 KB） | 2026-04-17 | 不合格音（セット失敗時） |
| `chime.mp3`   | 50,053 B（48.9 KB） | 2026-04-22 | 汎用 HP 獲得チャイム（提出完了・祝賀演出） |

**合計サイズ**：247,134 B（241 KB） — 軽量、初回ロードへの影響は無視できる範囲。
**形式**：全て MP3。WAV/OGG/M4A/AAC は存在しない。

参照経路は `new Audio('./correct.mp3')` のように**ルートからの相対パス**（リポジトリルート = GitHub Pages の `/mykt-eitango/` に展開）。

---

## 2. SFX レジストリ（JS 側）

**位置**：[index.html:4589-4623](../index.html)

```javascript
var SFX = {
  correct: new Audio('./correct.mp3'),
  wrong:   new Audio('./wrong.mp3'),
  pass:    new Audio('./pass.mp3'),
  fail:    new Audio('./fail.mp3'),
  chime:   new Audio('./chime.mp3')
};
// 初期化（preload + 音量設定）：master volume 0.8、chime のみ 0.9（少し大きめ）
// iOS Safari 対策：初回ユーザー操作（pointerdown/touchstart/click/keydown）で
//   全 Audio を muted 再生して unlock する _unlockSfx() を登録
function playSfx(name) {
  var a = SFX[name]; if (!a) return;
  try {
    a.pause(); a.currentTime = 0;
    var p = a.play();
    if (p && p.catch) p.catch(function(err){ console.warn('[SFX] play failed:', name, ...); });
  } catch(e) { console.warn('[SFX] error:', name, e); }
}
```

**設計の特徴**：
- 5 種固定のレジストリ（追加するなら SFX オブジェクトに 1 行追記するだけ）
- 全 SFX で `pause()` + `currentTime=0` の re-init を毎回行う（連続呼び出しでも頭から再生）
- iOS Safari の autoplay ロック対策が組み込み済（初回タップで全 SFX を unmute-play して unlock）
- play() の Promise 失敗を warn ログに残すが UI 上はエラー出さない（音声 ON は UX の付加価値、必須ではない）

**admin.html / view.html**：音声再生コード**ゼロ**。`playSfx` の呼び出しもなく、`new Audio(...)` もない。SFX は生徒向け index.html 専用。

---

## 3. 全呼び出し地点一覧（playSfx の使われ方、文脈付き）

`grep -n "playSfx(" index.html` で抽出した全 27 箇所（function 定義行 4616 を除く 26 callsite）を、コンテンツ別にマッピング。

### 3-A. 英単語RUSH（RUSH君）— **correct / wrong / pass / fail の 4 種すべて利用**

| Line | SFX | 場面 | 関数 |
|---|---|---|---|
| 6438 | `correct` | 4 択問題で正解クリック直後 | `answer()` |
| 6439 | `wrong`   | 4 択問題で不正解クリック直後 | `answer()` |
| 6461 | `fail`    | 20 問終了時に合格点に届かなかった | `finishTest()` |
| 6558 | `pass`    | 20 問終了時に合格（満点） | `_submitAttempt()` |

**特徴**：1 問ごとの即時フィードバック（correct/wrong）+ セット末の合否（pass/fail）の **2 段構え**。最も SFX を使い込んでいるコンテンツ。

### 3-B. 三語短文（サンゴタン）— **chime のみ**

| Line | SFX | 場面 | 関数 |
|---|---|---|---|
| 7579 | `chime` | 提出完了 → HP獲得画面 | `_showSangoFinalDone()` |
| 7824 | `chime` | 殿堂入り（starred）作品表示モーダル | `_showSangoStarred()` |

**特徴**：採点が無いコンテンツ（提出のみで HP）なので correct/wrong 不要。

### 3-C. 和文英訳①（ニチエイ）— **chime のみ**

| Line | SFX | 場面 | 関数 |
|---|---|---|---|
| 8401 | `chime` | 結果画面（HP 獲得モーダル） | `_showWabun1Result()` |

**特徴**：全問正解判定はサーバ側、結果画面表示時に祝賀。

### 3-D. 基礎計算（キソ"K"さん）— **chime のみ**

| Line | SFX | 場面 | 関数 |
|---|---|---|---|
| 9562 | `chime` | セット完了 → HP獲得画面 | `_showKisoDoneFromState()` |

**特徴**：OCR 採点なので correct/wrong は出さず、最後に祝賀チャイム 1 発。

### 3-E. 英語リスオン（リスオン）— **chime のみ**

| Line | SFX | 場面 | 関数 |
|---|---|---|---|
| 10373 | `chime` | 録音提出 → 完了画面 | `_lisonShowDone()` |

### 3-F. 国語長文読解（ジャパニン）— **chime 1 箇所**

| Line | SFX | 場面 | 関数 |
|---|---|---|---|
| 11215 | `chime` | HP獲得画面（hp > 0 のとき条件付き） | `_showKokugoHpGrant()`（hp-grant 表示） |

**注**：エージェント版調査では「国語長文は SFX 未使用」と報告されたが、実際は HP 獲得時に 1 回 chime を鳴らしている。前段の 4 択問題（q1/q2）には correct/wrong を入れていない（採点まとめ表示型のため、1 問ごとフィードバックの設計ではない）。

### 3-G. カンジー（漢字博士）— **correct / wrong / chime / fail の 4 種**

| Line | SFX | 場面 | 関数 |
|---|---|---|---|
| 11354 | `correct` | 書き問題 OCR 正解時 | `_onKanjiKakiClick()` |
| 11358 | `wrong`   | 書き問題 OCR 不正解時 | `_onKanjiKakiClick()` |
| 11420 | `chime`   | 読みパス → 書きへ遷移 | `_showKanjiYomiResult()` |
| 11433 | `fail`    | 読み 8 割未満で不合格 | `_showKanjiYomiResult()` |
| 11692 | `fail`    | 書き不合格時 | `_renderKanjiKakiResult()` |
| 11826 | `chime`   | カンジー全完了 → HP獲得画面 | `_showKanjiDone()` 系 |

**特徴**：英単語RUSH と並んで SFX 利用が最も豊富。読み（4 択）と書き（OCR）でフィードバック構造を切り分けている。

### 3-H. 古文単語（コブタン）— **correct / wrong / chime / fail の 4 種**

| Line | SFX | 場面 | 関数 |
|---|---|---|---|
| 11981 | `correct` | 4 択問題で正解 | `_onKobunAnswerClick()` |
| 11985 | `wrong`   | 4 択問題で不正解 | `_onKobunAnswerClick()` |
| 12066 | `chime`   | ステージ通過 → 次へ | `_showKobunDoneResult()` |
| 12079 | `fail`    | ステージ不合格 → 再挑戦 | `_showKobunDoneResult()` |
| 12132 | `chime`   | セッション完了 → HP獲得画面 | `_showKobunDone()` |

**特徴**：カンジーと同設計。1 問単位 + ステージ単位の 2 段フィードバック。

### 3-I. 計算タイムトライアル（トラール）— **使用なし**

`grep -n "playSfx" index.html | grep -E "ct-|trial|calctrial"` で 0 件。
独自のキャラ演出（紙吹雪・カウントアップ・キャラ振動）を優先しており、SFX は使っていない。

### 3-J. 振り返り・絶対ミッション・先生メッセージ等の付随機能 — **chime**

| Line | SFX | 場面 | 関数 |
|---|---|---|---|
| 4890 | `chime` | 振り返り完走 / 絶対ミッション完走時のお祝い | `_showReflectionBonus()` 系 |
| 6963 | `chime` | reflection-release-modal が開いた瞬間（保留 HP が解放されたとき） | reflection 関連 |
| 11215 | `chime` | 国語長文 HP獲得（再掲） | — |

**特徴**：横断機能（HP 保留解除、ミッション完走）で控えめに鳴らす。

### 3-K. 理社重要語句（リーカ / シャカネキ）— **本セッションで実装追加（後述 §5）**

実装前は **0 箇所**だったが、本レポート作成と同時に以下 4 箇所を追加：

| Line | SFX | 場面 | 関数 |
|---|---|---|---|
| 13154 | `correct` | 1 問正解クリック直後 | `_rishaRenderFeedback()` |
| 13158 | `wrong`   | 1 問不正解クリック直後 | `_rishaRenderFeedback()` |
| 13202 | `pass`    | 10 問完答（合格） → HP加算前 | `_rishaOnSetComplete()` |
| 13207 | `fail`    | 10 問終了時に誤答あり → リトライ前 | `_rishaOnSetComplete()` |

英単語RUSH と完全同パターン（correct/wrong + pass/fail の 2 段構え）。

---

## 4. 横断サマリー表（誰がどの SFX を使っているか）

| コンテンツ | correct | wrong | chime | pass | fail | 設計タイプ |
|---|:-:|:-:|:-:|:-:|:-:|---|
| **英単語RUSH** | ✅ | ✅ | — | ✅ | ✅ | **フル**（1問即時 + セット末合否） |
| 三語短文      | — | — | ✅ | — | — | 控えめ（提出時のみ） |
| 和文英訳①    | — | — | ✅ | — | — | 控えめ |
| 基礎計算      | — | — | ✅ | — | — | 控えめ |
| 英語リスオン  | — | — | ✅ | — | — | 控えめ |
| **カンジー**  | ✅ | ✅ | ✅ | — | ✅ | フル（pass のみ未使用） |
| **古文単語**  | ✅ | ✅ | ✅ | — | ✅ | フル（pass のみ未使用） |
| 国語長文      | — | — | ✅ | — | — | 控えめ |
| 計算タイムトライアル | — | — | — | — | — | **無音**（独自演出のみ） |
| **理社重要語句** ★ NEW | ✅ | ✅ | — | ✅ | ✅ | **フル**（本セッションで実装） |
| （横断）振り返り完走系 | — | — | ✅ | — | — | 控えめ |
| （横断）HP 保留解放 | — | — | ✅ | — | — | 控えめ |

**設計タイプの解説**：
- **フル**：1 問ごとの即時フィードバック（correct/wrong）+ セット末の合否（pass/fail）の 2 段構え。学習量が多い 4 択型コンテンツに採用。
- **控えめ**：完了時の chime 1 発のみ。採点が複雑（OCR / AI フィードバック / 録音）で 1 問ごとフィードバックを出しにくい、または採点ロジックが「全問まとめて」型のコンテンツに採用。
- **無音**：計算タイムトライアルだけ。タイマー音や独自の祝賀演出（紙吹雪・カウントアップ）を優先する設計判断。

---

## 5. 理社重要語句との整合性チェック

### 5-1. 仕様
ユーザーから「英単語RUSH と同じ効果音を使う」旨が指示されていた（理社実装時の前提条件）。

### 5-2. 実装前の状態（コミット 30b783d 時点）
**理社の playSfx 呼び出しはゼロ件**。全 6 画面（major/minor/unit/question/grading/done）と全関数（`_rishaRenderFeedback` / `_rishaOnSetComplete` / `_rishaSubmitFinish` / `_rishaRenderDoneScreen` 等）を grep したが SFX 呼び出しは一切なかった。**実装漏れと判断**。

### 5-3. 本セッションで追加した実装
英単語RUSH の `answer()` / `finishTest()` / `_submitAttempt()` の SFX パターンを参考に、理社にも同等の SFX 呼び出しを 4 箇所追加した：

| 場所 | 何を | なぜ |
|---|---|---|
| `_rishaRenderFeedback()` 内 isCorrect 分岐の正解側 | `playSfx('correct')` | 英単語RUSH `answer()` L6438 と同パターン |
| `_rishaRenderFeedback()` 内 isCorrect 分岐の不正解側 | `playSfx('wrong')` | 英単語RUSH `answer()` L6439 と同パターン |
| `_rishaOnSetComplete()` allCorrect=true 分岐 | `playSfx('pass')` | 英単語RUSH `_submitAttempt()` L6558 と同パターン |
| `_rishaOnSetComplete()` allCorrect=false 分岐 | `playSfx('fail')` | 英単語RUSH `finishTest()` L6461 と同パターン |

全て `try { ... } catch(e) {}` でラップ（SFX 未初期化 / iOS Safari 未 unlock 時の安全弁、他コンテンツと同パターン）。

### 5-4. 整合性確認
- ✅ 5 種の SFX ファイル（correct / wrong / pass / fail / chime）は全て使用中、未使用ファイルなし
- ✅ コード側に存在しないファイル名への参照なし（broken refs ゼロ）
- ✅ 理社の SFX 利用は英単語RUSH と同設計（フル：1 問即時 + セット末合否）
- ✅ admin.html / view.html には SFX 関連コードなし（生徒画面専用、想定通り）

---

## 6. 発見事項・推奨事項

### 主要な発見
1. **理社重要語句の SFX 実装が当初漏れていた** → 本セッションで追加修正済
2. **計算タイムトライアルは意図的に無音設計** → 独自のキャラ演出（紙吹雪・カウントアップ）が完備されているため、SFX 追加は今のところ不要
3. **SFX システムは 5 種固定で簡潔** → 追加するなら SFX オブジェクトに 1 行追記 + 5 番目ファイルを repo root に置くだけ
4. **国語長文の SFX は控えめ（chime 1 発のみ）** → 4 択 2 問構成だが「1 問ごとフィードバックなし、まとめて表示型」の設計のため意図通り

### 設計の含意
- 「フル SFX」コンテンツ（4 件：英単語RUSH / カンジー / 古文単語 / 理社）はすべて **4 択 + 1 問ごとフィードバック** 型
- 「控えめ SFX」コンテンツ（5 件：三語短文 / 和文英訳① / 基礎計算 / リスオン / 国語長文）はすべて **採点まとめて表示** 型または **採点なし提出のみ** 型
- このパターンは新コンテンツの SFX 設計判断の指針になる：4 択 1 問ずつ採点なら「フル」、それ以外なら「控えめ」

### 将来の SFX 追加候補（参考、本セッションでは実装しない）
- 計算タイムトライアル：ボーナスステージ突入時の `chime`、最終結果表示時の `pass` あたりは検討余地あり
- 国語長文 q1/q2 採点に correct/wrong を追加することもできるが、現状の「採点後にまとめて結果カード表示」UX を崩すので非推奨

---

## 付録：完全なファイル一覧と use サイト

### A-1. 全 SFX ファイル
```
./chime.mp3    50,053 B   2026-04-22
./correct.mp3  42,630 B   2026-04-17
./fail.mp3     86,516 B   2026-04-17
./pass.mp3     54,144 B   2026-04-17
./wrong.mp3    13,791 B   2026-04-17
```

### A-2. 全 playSfx() 呼び出し（27 箇所、関数定義 1 箇所を除く 26 callsite）
本セッション後の最終状態：

```
4616 (def) function playSfx(name) { ... }
4890       playSfx('chime') — 振り返り/絶対ミッション完走
6438       playSfx('correct') — 英単語RUSH 正解
6439       playSfx('wrong')   — 英単語RUSH 不正解
6461       playSfx('fail')    — 英単語RUSH 不合格
6558       playSfx('pass')    — 英単語RUSH 合格
6963       playSfx('chime')   — 振り返り保留HP解放モーダル
7579       playSfx('chime')   — 三語短文 提出完了
7824       playSfx('chime')   — 三語短文 殿堂入りモーダル
8401       playSfx('chime')   — 和文英訳① 結果画面
9562       playSfx('chime')   — 基礎計算 セット完了
10373      playSfx('chime')   — 英語リスオン 録音提出完了
11215      playSfx('chime')   — 国語長文 HP獲得（条件付き）
11354      playSfx('correct') — カンジー 書き問題 正解
11358      playSfx('wrong')   — カンジー 書き問題 不正解
11420      playSfx('chime')   — カンジー 読みパス→書きへ遷移
11433      playSfx('fail')    — カンジー 読み不合格
11692      playSfx('fail')    — カンジー 書き不合格
11826      playSfx('chime')   — カンジー 完了
11981      playSfx('correct') — 古文単語 正解
11985      playSfx('wrong')   — 古文単語 不正解
12066      playSfx('chime')   — 古文単語 ステージ通過
12079      playSfx('fail')    — 古文単語 ステージ不合格
12132      playSfx('chime')   — 古文単語 セッション完了
13154      playSfx('correct') — ★ 理社 正解（本セッション追加）
13158      playSfx('wrong')   — ★ 理社 不正解（本セッション追加）
13202      playSfx('pass')    — ★ 理社 セット合格（本セッション追加）
13207      playSfx('fail')    — ★ 理社 セット不合格（本セッション追加）
```

---

**レポート作成**：2026-05-24
**作成手段**：Explore sub-agent による grep ベース調査 + メインスレッドでの検証・補正
**コミット対象**：このレポートは `docs/sound_audit_report_2026-05-24.md` として git 管理（将来の SFX 設計判断の参照資料として残す）
