"""KisoQuestions シート Phase 4 投入後検証（rank_09 対応版）。

過去の rank_02 / rank_03 / rank_04 / rank_05 / rank_06 / rank_07 / rank_08 / rank_01 /
rank_11 / rank_12 / rank_13 投入後検証（CLAUDE.md #155-160 / #171）と同じパターンで
gspread からシートを直接読み出し、rank_09 50題化（Band D 新設 + Band A slot_index
化）の投入結果を検証する。

検証項目:
  T1  全 rank 行数 = 840
  T2  rank 別行数（rank 10/14-20 が 30、rank 1-9 + 11-13 が 50）
  T3  rank=6 Band 配分（A=5, B=20, C=10, D=15）
  T4  questionId 重複ゼロ（820 件全てユニーク）
  T5  problemLatex 重複ゼロ（rank 内で全てユニーク）
  T6  rank=6 Band D に y=... 形と x=... 形の両方が含まれる
  T7  rank=8 Band 配分（A=5, B=25, C=10, D=10）
  T8  rank=8 Band D サブパターン配分（light=2, standard=6, heavy=2）
  T9  rank=8 Band D 形式チェック（light: 右辺定数 / standard: 両辺カッコ / heavy: カッコ複数+移項）
  T10 既存 rank の行数 regression なし
  T11 rank=1 Band 配分（A=15, B=5, C=15, D=15）
  T12 rank=1 Band B 全問が x²-c=0 形（たすき掛け = leading coef ≠ 1 が含まれない）
  T13 rank=1 Band C: k_eq_1=10 / k_gt_1=5（k>1 が 30%以上）
  T14 rank=1 Band D サブパターン配分（with_p=7, ax2_eq_c=8）
  T15 rank=11 Band 配分（A=15, B=15, C=20）
  T16 rank=12 Band 配分（A=15, B=15, C=20）+ Band B サブ配分（paren_neg=5, leading_minus=5, positive=5）
       + Band B 結果ガード |result| ≤ 1000
  T17 rank=13 Band 配分（A=12, B=12, C=11, D=15）+ Band D 全問が 3 項計算
  T18 rank=9  Band 配分（A=13, B=13, C=11, D=13）
       + Band A サブ配分（two_term=7, three_term=3, with_const=3）
       + Band D 全問が "(...) ± (...)" 形 + -(...) 符号反転が過半数

実行:
  cd scripts/generate_kiso_questions
  python _verify_phase4_post.py
"""

from __future__ import annotations

import os
import sys
from collections import Counter

# 遅延 import: gspread が無い環境で import エラーを避けるためここで import
import gspread
from google.oauth2.service_account import Credentials


# 期待値（CLAUDE.md #171 + rank_08 + rank_01 + rank_11/12/13 + rank_09 Phase 1 拡充の Phase 4 投入仕様）
EXPECTED_TOTAL = 840
RANKS_30 = [10, 14, 15, 16, 17, 18, 19, 20]
RANKS_50 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13]
EXPECTED_RANK_06_BANDS = {"A": 5, "B": 20, "C": 10, "D": 15}
EXPECTED_RANK_08_BANDS = {"A": 5, "B": 25, "C": 10, "D": 10}
# Band D の slot_index 駆動サブパターン配分（_resolve_band_d_subkind 由来）
EXPECTED_RANK_08_BAND_D_SUBPATTERNS = {"light": 2, "standard": 6, "heavy": 2}
EXPECTED_RANK_01_BANDS = {"A": 15, "B": 5, "C": 15, "D": 15}
EXPECTED_RANK_01_BAND_C_SUBPATTERNS = {"k_eq_1": 10, "k_gt_1": 5}
EXPECTED_RANK_01_BAND_D_SUBPATTERNS = {"with_p": 7, "ax2_eq_c": 8}
# 正負の数 3 単元（Phase 1、2026-05-05 拡充）
EXPECTED_RANK_11_BANDS = {"A": 15, "B": 15, "C": 20}
EXPECTED_RANK_12_BANDS = {"A": 15, "B": 15, "C": 20}
# rank_12 Band B の slot_index 駆動 3 サブパターン（_resolve_band_b_subkind 由来、interleave 方式）
EXPECTED_RANK_12_BAND_B_SUBPATTERNS = {"paren_neg": 5, "leading_minus": 5, "positive": 5}
EXPECTED_RANK_12_BAND_B_MAX_RESULT_ABS = 1000
EXPECTED_RANK_13_BANDS = {"A": 12, "B": 12, "C": 11, "D": 15}
# 式の計算 中1（Phase 1、2026-05-06 拡充）
EXPECTED_RANK_09_BANDS = {"A": 13, "B": 13, "C": 11, "D": 13}
# rank_09 Band A の slot_index 駆動 3 サブパターン（_resolve_band_a_subkind 由来）
EXPECTED_RANK_09_BAND_A_SUBPATTERNS = {"two_term": 7, "three_term": 3, "with_const": 3}


def classify_rank12_band_b_subkind(latex: str) -> str:
    """rank=12 Band B の latex を paren_neg / leading_minus / positive のいずれかに分類。

      paren_neg     : "(-数字)^{exp}"     例: (-3)^{2}
      leading_minus : "-数字^{exp}"       例: -3^{2}
      positive      : "数字^{exp}"        例: 3^{2}
    """
    import re as _re
    if _re.match(r"^\(-\d+\)\^\{?\d+\}?$", latex):
        return "paren_neg"
    if _re.match(r"^-\d+\^\{?\d+\}?$", latex):
        return "leading_minus"
    if _re.match(r"^\d+\^\{?\d+\}?$", latex):
        return "positive"
    return "unknown"


def classify_rank09_band_a_subkind(latex: str) -> str:
    """rank=9 Band A の latex を two_term / three_term / with_const に分類。

    紙教材形式：先頭 signed → ' ' → op → ' ' → 次項 → ... の構造。
      two_term   : "Xx op Yx"           （x 項 2 つ、演算子 1 つ）
      three_term : "Xx op Yx op Zx"     （x 項 3 つ、演算子 2 つ）
      with_const : "Xx op N op Yx op N" （x 項 + 定数 + x 項 + 定数 の 4 項）
    """
    tokens = latex.strip().split()
    if not tokens:
        return "unknown"
    # 偶数 index が項、奇数 index が op
    terms = [tokens[i] for i in range(0, len(tokens), 2)]
    is_x_term = lambda t: t.endswith("x")
    if len(terms) == 2 and all(is_x_term(t) for t in terms):
        return "two_term"
    if len(terms) == 3 and all(is_x_term(t) for t in terms):
        return "three_term"
    if len(terms) == 4:
        x_count = sum(1 for t in terms if is_x_term(t))
        const_count = sum(1 for t in terms if not is_x_term(t))
        if x_count == 2 and const_count == 2:
            return "with_const"
    return "unknown"


def classify_rank09_band_d_form(latex: str) -> str:
    """rank=9 Band D の latex が "(...) ± (...)" 形か判定。

    形式：第 1 カッコ + outer_op + 第 2 カッコ
    判定:
      - "paren_addsub" : (open paren 2、close paren 2、トップレベル op が 1 つ)
      - "unknown"      : それ以外
    """
    import re as _re
    if _re.match(r"^\(.+\)\s+[+\-]\s+\(.+\)$", latex):
        opens = latex.count("(")
        closes = latex.count(")")
        if opens == 2 and closes == 2:
            return "paren_addsub"
    return "unknown"


def classify_rank13_band_d_form(latex: str) -> str:
    """rank=13 Band D の latex が 3 項加減（paren 形式）か判定。

    形式: "(±a) op1 (±b) op2 (±c)" のように (+/-数字) のかたまりが 3 つ + op が 2 つ。
    判定:
      - "three_term" : (±数字) のかたまりが 3 つ存在
      - "unknown"    : それ以外
    """
    import re as _re
    matches = _re.findall(r"\([+-]\d+\)", latex)
    if len(matches) == 3:
        return "three_term"
    return "unknown"


def classify_rank01_band_d_subkind(latex: str) -> str:
    """rank=1 Band D の latex を with_p / ax2_eq_c のいずれかに分類。

      with_p   : "(x ± p)^2 = q" 形
      ax2_eq_c : "a x^2 = c" 形（a >= 2 の整数係数）
    """
    if "(x" in latex and ")^2" in latex:
        return "with_p"
    # a x^2 = c 形: 先頭が数字 + "x^2 = "
    import re
    if re.match(r"^\d+x\^2\s*=\s*\d+$", latex):
        return "ax2_eq_c"
    return "unknown"


def classify_rank01_band_c_subkind(latex: str, canonical: str) -> str:
    """rank=1 Band C の canonical を k_eq_1 / k_gt_1 に分類。

    canonical 内の k 係数が 1（数字+√d 表記がない）か k>=2（数字+√d 表記あり）かで判定。
    """
    import re
    if re.search(r"\d+√", canonical):
        return "k_gt_1"
    return "k_eq_1"


def classify_band_d_subkind(latex: str) -> str:
    """rank=8 Band D の latex を light / standard / heavy のいずれかに分類。

    _verify_rank08.mjs の classifyDLatex と同じ判定ロジック。
      heavy   : 左辺に "(" が 2 つ以上 + 左辺に " - " を含む（最優先）
      standard: 右辺に "(" を含む（両辺カッコ）
      light   : 上記以外（左辺カッコ 1 つ、右辺は定数）
    """
    parts = latex.split(" = ", 1)
    if len(parts) != 2:
        return "unknown"
    lhs, rhs = parts
    lhs_opens = lhs.count("(")
    rhs_has_paren = "(" in rhs
    # heavy を最優先で判定（右辺定数だが左辺にカッコ 2 つあるパターン）
    if lhs_opens >= 2 and " - " in lhs:
        return "heavy"
    if rhs_has_paren:
        return "standard"
    if lhs_opens == 1:
        return "light"
    return "unknown"


def _ensure_utf8_console() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is not None and hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8")
            except Exception:
                pass


def open_kiso_sheet():
    creds_path = os.environ.get("KISO_GSPREAD_CREDENTIALS")
    sheet_id = os.environ.get("KISO_SPREADSHEET_ID")
    if not creds_path:
        sys.exit("[ERROR] KISO_GSPREAD_CREDENTIALS が未設定です")
    if not sheet_id:
        sys.exit("[ERROR] KISO_SPREADSHEET_ID が未設定です")
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
    sh = client.open_by_key(sheet_id)
    return sh.worksheet("KisoQuestions")


def main() -> int:
    _ensure_utf8_console()
    print("KisoQuestions シートに接続中...")
    ws = open_kiso_sheet()

    # 全データ取得（ヘッダー込み）
    values = ws.get_all_values()
    if len(values) < 2:
        sys.exit("[ERROR] データ行がありません")
    header = values[0]
    rows = values[1:]
    print(f"取得完了: ヘッダー {len(header)} 列 / データ {len(rows)} 行\n")

    # 列インデックスを動的取得（列順変更に強い）
    try:
        i_qid = header.index("questionId")
        i_rank = header.index("rank")
        i_band = header.index("difficultyBand")
        i_latex = header.index("problemLatex")
        i_canonical = header.index("answerCanonical")
    except ValueError as e:
        sys.exit(f"[ERROR] 必須列が見つかりません: {e}")

    pass_count = 0
    fail_count = 0

    def check(label: str, ok: bool, detail: str = "") -> None:
        nonlocal pass_count, fail_count
        mark = "PASS" if ok else "FAIL"
        if ok:
            pass_count += 1
        else:
            fail_count += 1
        msg = f"[{mark}] {label}"
        if detail:
            msg += f" — {detail}"
        print(msg)

    # ============================================================
    # T1: 全 rank 行数 = 760
    # ============================================================
    check(
        f"T1 全 rank 行数 == {EXPECTED_TOTAL}",
        len(rows) == EXPECTED_TOTAL,
        f"actual={len(rows)}",
    )

    # ============================================================
    # T2: rank 別行数
    # ============================================================
    rank_counts: Counter = Counter()
    for r in rows:
        try:
            rank_counts[int(r[i_rank])] += 1
        except (ValueError, IndexError):
            pass

    for rk in sorted(set(RANKS_30 + RANKS_50)):
        expected = 30 if rk in RANKS_30 else 50
        actual = rank_counts.get(rk, 0)
        check(
            f"T2 rank {rk:2d} 行数 == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # ============================================================
    # T3: rank=6 Band 配分（A=5, B=20, C=10, D=15）
    # ============================================================
    band_counts_06: Counter = Counter()
    for r in rows:
        try:
            if int(r[i_rank]) == 6:
                band_counts_06[r[i_band]] += 1
        except (ValueError, IndexError):
            pass

    for band, expected in EXPECTED_RANK_06_BANDS.items():
        actual = band_counts_06.get(band, 0)
        check(
            f"T3 rank=6 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # ============================================================
    # T4: questionId 重複ゼロ（760 件全てユニーク）
    # ============================================================
    qids = [r[i_qid] for r in rows if len(r) > i_qid]
    qid_counter = Counter(qids)
    qid_dupes = [(q, c) for q, c in qid_counter.items() if c > 1]
    check(
        f"T4 questionId ユニーク（{len(qids)} 件）",
        not qid_dupes,
        f"重複 {len(qid_dupes)} 件" if qid_dupes else f"unique={len(set(qids))}",
    )
    if qid_dupes:
        for q, c in qid_dupes[:5]:
            print(f"      重複: {q} × {c}")

    # ============================================================
    # T5: problemLatex 重複ゼロ（rank 単位）
    # ============================================================
    latex_dupes_total = 0
    for rk in sorted(set(RANKS_30 + RANKS_50)):
        latexes = [
            r[i_latex] for r in rows
            if len(r) > i_latex
            and r[i_rank].strip().isdigit()
            and int(r[i_rank]) == rk
        ]
        c = Counter(latexes)
        dupes = [(l, n) for l, n in c.items() if n > 1]
        if dupes:
            latex_dupes_total += len(dupes)
            print(f"      [WARN] rank {rk}: problemLatex 重複 {len(dupes)} 件")
            for l, n in dupes[:3]:
                print(f"        {l[:80]} × {n}")
    check(
        "T5 全 rank で problemLatex ユニーク",
        latex_dupes_total == 0,
        "重複ゼロ" if latex_dupes_total == 0 else f"合計重複 {latex_dupes_total} 件",
    )

    # ============================================================
    # T6: rank=6 Band D に y=... 形と x=... 形の両方が含まれる
    # ============================================================
    band_d_latexes = [
        r[i_latex] for r in rows
        if len(r) > i_latex
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 6
        and r[i_band] == "D"
    ]
    # _build_substitution_lhs の出力は "y = ..." または "x = ..."
    # eq1（先頭の式）が y= or x= 形なので "\\begin{cases} y = " / "\\begin{cases} x = " で限定
    Y_PREFIX = "\\begin{cases} y = "
    X_PREFIX = "\\begin{cases} x = "
    has_y_form = sum(1 for l in band_d_latexes if l.startswith(Y_PREFIX))
    has_x_form = sum(1 for l in band_d_latexes if l.startswith(X_PREFIX))
    # 全 Band D の eq1 が y= or x= 形のはずなので両方非ゼロ + 合計 == Band D 件数
    check(
        f"T6 rank=6 Band D に y=... 形が含まれる",
        has_y_form > 0,
        f"y=... 形 {has_y_form} 問 / Band D 全 {len(band_d_latexes)} 問",
    )
    check(
        f"T6 rank=6 Band D に x=... 形が含まれる",
        has_x_form > 0,
        f"x=... 形 {has_x_form} 問 / Band D 全 {len(band_d_latexes)} 問",
    )
    check(
        "T6 rank=6 Band D y=... 形 + x=... 形 == Band D 全件",
        has_y_form + has_x_form == len(band_d_latexes),
        f"y={has_y_form} + x={has_x_form} = {has_y_form + has_x_form} / 全 {len(band_d_latexes)} 問",
    )

    # ============================================================
    # T7: rank=8 Band 配分（A=5, B=25, C=10, D=10）
    # ============================================================
    band_counts_08: Counter = Counter()
    for r in rows:
        try:
            if int(r[i_rank]) == 8:
                band_counts_08[r[i_band]] += 1
        except (ValueError, IndexError):
            pass

    for band, expected in EXPECTED_RANK_08_BANDS.items():
        actual = band_counts_08.get(band, 0)
        check(
            f"T7 rank=8 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # ============================================================
    # T8: rank=8 Band D サブパターン配分（light=2, standard=6, heavy=2）
    # ============================================================
    band_d_latexes_08 = [
        r[i_latex] for r in rows
        if len(r) > i_latex
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 8
        and r[i_band] == "D"
    ]
    sub_counts_08: Counter = Counter()
    for l in band_d_latexes_08:
        sub_counts_08[classify_band_d_subkind(l)] += 1

    for sub, expected in EXPECTED_RANK_08_BAND_D_SUBPATTERNS.items():
        actual = sub_counts_08.get(sub, 0)
        check(
            f"T8 rank=8 Band D {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )
    # 'unknown' が 0 件であることも確認
    unknown_count = sub_counts_08.get("unknown", 0)
    check(
        f"T8 rank=8 Band D 未分類問題ゼロ",
        unknown_count == 0,
        f"unknown={unknown_count}",
    )

    # ============================================================
    # T9: rank=8 Band D 形式チェック
    #   light:    右辺が定数（カッコを含まない）
    #   standard: 両辺カッコ（"(" がちょうど 2 個）
    #   heavy:    左辺に "(" 2 個以上 + " - " 区切り
    # ============================================================
    light_latexes    = [l for l in band_d_latexes_08 if classify_band_d_subkind(l) == "light"]
    standard_latexes = [l for l in band_d_latexes_08 if classify_band_d_subkind(l) == "standard"]
    heavy_latexes    = [l for l in band_d_latexes_08 if classify_band_d_subkind(l) == "heavy"]

    light_ok = all("(" not in l.split(" = ", 1)[1] for l in light_latexes)
    check(
        "T9 light 形式: 右辺は定数（カッコなし）",
        light_ok,
        f"light {len(light_latexes)} 問すべて OK" if light_ok else "違反あり",
    )

    standard_ok = all(l.count("(") == 2 for l in standard_latexes)
    check(
        "T9 standard 形式: \"(\" がちょうど 2 個",
        standard_ok,
        f"standard {len(standard_latexes)} 問すべて OK" if standard_ok else "違反あり",
    )

    heavy_ok = all(
        l.split(" = ", 1)[0].count("(") >= 2 and " - " in l.split(" = ", 1)[0]
        for l in heavy_latexes
    )
    check(
        "T9 heavy 形式: 左辺に \"(\" 2 個以上 + \" - \" 区切り",
        heavy_ok,
        f"heavy {len(heavy_latexes)} 問すべて OK" if heavy_ok else "違反あり",
    )

    # ============================================================
    # T10: 既存 rank の行数 regression なし（T2 で既に網羅、サマリ表示のみ）
    # ============================================================
    print("\n--- rank 別行数サマリ ---")
    for rk in sorted(rank_counts.keys()):
        expected = 50 if rk in RANKS_50 else 30
        mark = "OK" if rank_counts[rk] == expected else "NG"
        print(f"  rank {rk:2d}: {rank_counts[rk]:3d} 行（期待 {expected:3d}）{mark}")

    # ============================================================
    # T11: rank=1 Band 配分（A=15, B=5, C=15, D=15）
    # ============================================================
    band_counts_01: Counter = Counter()
    for r in rows:
        try:
            if int(r[i_rank]) == 1:
                band_counts_01[r[i_band]] += 1
        except (ValueError, IndexError):
            pass

    for band, expected in EXPECTED_RANK_01_BANDS.items():
        actual = band_counts_01.get(band, 0)
        check(
            f"T11 rank=1 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # ============================================================
    # T12: rank=1 Band B 全問が x²-c=0 形（たすき掛け = leading coef ≠ 1 が含まれない）
    # ============================================================
    band_b_latexes_01 = [
        r[i_latex] for r in rows
        if len(r) > i_latex
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 1
        and r[i_band] == "B"
    ]
    # x²-c=0 形は "x^{2} - <num> = 0" で始まる（係数 1）。たすき掛けは "<n>x^{2}" で始まる
    import re as _re
    band_b_form_ok = all(
        _re.match(r"^x\^\{2\}\s*-\s*\d+\s*=\s*0$", l) for l in band_b_latexes_01
    )
    band_b_no_tasuki = not any(_re.match(r"^\d+x\^\{2\}", l) for l in band_b_latexes_01)
    check(
        f"T12 rank=1 Band B 全問が x²-c=0 形",
        band_b_form_ok,
        f"{len(band_b_latexes_01)} 問すべて OK" if band_b_form_ok else "違反あり",
    )
    check(
        "T12 rank=1 Band B にたすき掛け（leading coef ≠ 1）が含まれない",
        band_b_no_tasuki,
        "たすき掛けゼロ" if band_b_no_tasuki else "違反あり",
    )

    # ============================================================
    # T13: rank=1 Band C: k_eq_1=10 / k_gt_1=5（k>1 が 30%以上）
    # ============================================================
    band_c_rows_01 = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 1
        and r[i_band] == "C"
    ]
    sub_counts_01_c: Counter = Counter()
    for r in band_c_rows_01:
        sub_counts_01_c[classify_rank01_band_c_subkind(r[i_latex], r[i_canonical])] += 1

    for sub, expected in EXPECTED_RANK_01_BAND_C_SUBPATTERNS.items():
        actual = sub_counts_01_c.get(sub, 0)
        check(
            f"T13 rank=1 Band C {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )
    if len(band_c_rows_01) > 0:
        ratio_kgt1 = sub_counts_01_c.get("k_gt_1", 0) / len(band_c_rows_01)
        check(
            f"T13 rank=1 Band C k_gt_1 比率 >= 30%",
            ratio_kgt1 >= 0.30,
            f"actual={ratio_kgt1*100:.1f}%",
        )

    # ============================================================
    # T14: rank=1 Band D サブパターン配分（with_p=7, ax2_eq_c=8）
    # ============================================================
    band_d_latexes_01 = [
        r[i_latex] for r in rows
        if len(r) > i_latex
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 1
        and r[i_band] == "D"
    ]
    sub_counts_01_d: Counter = Counter()
    for l in band_d_latexes_01:
        sub_counts_01_d[classify_rank01_band_d_subkind(l)] += 1

    for sub, expected in EXPECTED_RANK_01_BAND_D_SUBPATTERNS.items():
        actual = sub_counts_01_d.get(sub, 0)
        check(
            f"T14 rank=1 Band D {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )
    unknown_count_01 = sub_counts_01_d.get("unknown", 0)
    check(
        f"T14 rank=1 Band D 未分類問題ゼロ",
        unknown_count_01 == 0,
        f"unknown={unknown_count_01}",
    )

    # ============================================================
    # T15: rank=11 Band 配分（A=15, B=15, C=20）
    # ============================================================
    band_counts_11: Counter = Counter()
    for r in rows:
        try:
            if int(r[i_rank]) == 11:
                band_counts_11[r[i_band]] += 1
        except (ValueError, IndexError):
            pass

    for band, expected in EXPECTED_RANK_11_BANDS.items():
        actual = band_counts_11.get(band, 0)
        check(
            f"T15 rank=11 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # ============================================================
    # T16: rank=12 Band 配分 + Band B サブ配分 + 結果ガード
    # ============================================================
    band_counts_12: Counter = Counter()
    for r in rows:
        try:
            if int(r[i_rank]) == 12:
                band_counts_12[r[i_band]] += 1
        except (ValueError, IndexError):
            pass

    for band, expected in EXPECTED_RANK_12_BANDS.items():
        actual = band_counts_12.get(band, 0)
        check(
            f"T16 rank=12 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=12 Band B のサブパターン配分（_resolve_band_b_subkind の interleave 順序）
    band_b_rows_12 = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 12
        and r[i_band] == "B"
    ]
    sub_counts_12_b: Counter = Counter()
    for r in band_b_rows_12:
        sub_counts_12_b[classify_rank12_band_b_subkind(r[i_latex])] += 1

    for sub, expected in EXPECTED_RANK_12_BAND_B_SUBPATTERNS.items():
        actual = sub_counts_12_b.get(sub, 0)
        check(
            f"T16 rank=12 Band B {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )
    unknown_count_12_b = sub_counts_12_b.get("unknown", 0)
    check(
        f"T16 rank=12 Band B 未分類問題ゼロ",
        unknown_count_12_b == 0,
        f"unknown={unknown_count_12_b}",
    )

    # rank=12 Band B 結果ガード |result| ≤ 1000
    result_violations = []
    for r in band_b_rows_12:
        try:
            v = int(r[i_canonical])
            if abs(v) > EXPECTED_RANK_12_BAND_B_MAX_RESULT_ABS:
                result_violations.append((r[i_latex], v))
        except (ValueError, TypeError):
            pass  # canonical が整数でない場合（このランクでは想定外だが防御的に無視）
    check(
        f"T16 rank=12 Band B 結果ガード |result| ≤ {EXPECTED_RANK_12_BAND_B_MAX_RESULT_ABS}",
        not result_violations,
        f"違反 {len(result_violations)} 件" if result_violations else f"全 {len(band_b_rows_12)} 問 OK",
    )
    for latex, v in result_violations[:3]:
        print(f"      [WARN] {latex} = {v}")

    # ============================================================
    # T17: rank=13 Band 配分 + Band D が 3 項計算
    # ============================================================
    band_counts_13: Counter = Counter()
    for r in rows:
        try:
            if int(r[i_rank]) == 13:
                band_counts_13[r[i_band]] += 1
        except (ValueError, IndexError):
            pass

    for band, expected in EXPECTED_RANK_13_BANDS.items():
        actual = band_counts_13.get(band, 0)
        check(
            f"T17 rank=13 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=13 Band D の全問が 3 項計算であること
    band_d_latexes_13 = [
        r[i_latex] for r in rows
        if len(r) > i_latex
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 13
        and r[i_band] == "D"
    ]
    three_term_count = sum(
        1 for l in band_d_latexes_13 if classify_rank13_band_d_form(l) == "three_term"
    )
    check(
        "T17 rank=13 Band D 全問が 3 項計算（(±a)(±b)(±c) 形）",
        three_term_count == len(band_d_latexes_13) and three_term_count > 0,
        f"three_term={three_term_count} / 全 {len(band_d_latexes_13)} 問",
    )
    # 結果ゼロ排除（教育的価値の維持）
    zero_count_13_d = sum(
        1 for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 13
        and r[i_band] == "D"
        and r[i_canonical].strip() == "0"
    )
    check(
        "T17 rank=13 Band D 結果ゼロ排除",
        zero_count_13_d == 0,
        f"zero_count={zero_count_13_d}",
    )

    # ============================================================
    # T18: rank=9 Band 配分 + Band A サブ配分 + Band D 形式
    # ============================================================
    band_counts_09: Counter = Counter()
    for r in rows:
        try:
            if int(r[i_rank]) == 9:
                band_counts_09[r[i_band]] += 1
        except (ValueError, IndexError):
            pass

    for band, expected in EXPECTED_RANK_09_BANDS.items():
        actual = band_counts_09.get(band, 0)
        check(
            f"T18 rank=9 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=9 Band A の slot_index 駆動 3 サブパターン
    band_a_latexes_09 = [
        r[i_latex] for r in rows
        if len(r) > i_latex
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 9
        and r[i_band] == "A"
    ]
    sub_counts_09_a: Counter = Counter()
    for l in band_a_latexes_09:
        sub_counts_09_a[classify_rank09_band_a_subkind(l)] += 1

    for sub, expected in EXPECTED_RANK_09_BAND_A_SUBPATTERNS.items():
        actual = sub_counts_09_a.get(sub, 0)
        check(
            f"T18 rank=9 Band A {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )
    unknown_count_09_a = sub_counts_09_a.get("unknown", 0)
    check(
        f"T18 rank=9 Band A 未分類問題ゼロ",
        unknown_count_09_a == 0,
        f"unknown={unknown_count_09_a}",
    )

    # rank=9 Band D の全問が "(...) ± (...)" 形 + -(...) 符号反転が過半数
    band_d_latexes_09 = [
        r[i_latex] for r in rows
        if len(r) > i_latex
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 9
        and r[i_band] == "D"
    ]
    paren_addsub_count = sum(
        1 for l in band_d_latexes_09 if classify_rank09_band_d_form(l) == "paren_addsub"
    )
    check(
        "T18 rank=9 Band D 全問が \"(...) ± (...)\" 形",
        paren_addsub_count == len(band_d_latexes_09) and paren_addsub_count > 0,
        f"paren_addsub={paren_addsub_count} / 全 {len(band_d_latexes_09)} 問",
    )

    # 第 2 カッコの直前の outer_op が "-" の問題が過半数（教育的に符号反転を主役化）
    import re as _re
    minus_count_09_d = sum(
        1 for l in band_d_latexes_09 if _re.search(r"\)\s+-\s+\(", l)
    )
    plus_count_09_d = sum(
        1 for l in band_d_latexes_09 if _re.search(r"\)\s+\+\s+\(", l)
    )
    check(
        "T18 rank=9 Band D -(...) 符号反転が過半数",
        minus_count_09_d > plus_count_09_d,
        f"minus={minus_count_09_d}, plus={plus_count_09_d}",
    )

    # ============================================================
    # rank=6 Band D サンプル表示（実機目視用）
    # ============================================================
    print("\n--- rank=6 Band D サンプル（最初の 5 問の eq1 部分） ---")
    for i, l in enumerate(band_d_latexes[:5]):
        # \begin{cases} <eq1> \\ <eq2> \end{cases}
        # eq1 を抽出
        try:
            head = l.split("\\begin{cases}", 1)[1].split("\\\\", 1)[0].strip()
        except IndexError:
            head = l[:80]
        print(f"  D[{i+1}] eq1: {head[:80]}")

    # ============================================================
    # rank=8 Band D サンプル表示（実機目視用、light/standard/heavy 各 2 問）
    # ============================================================
    print("\n--- rank=8 Band D サンプル（slot_index 順、light/standard/heavy） ---")
    for i, l in enumerate(band_d_latexes_08):
        sub = classify_band_d_subkind(l)
        print(f"  D[{i+1:2d}] ({sub:8s}): {l[:90]}")

    # ============================================================
    # rank=1 Band C k_gt_1 サンプル + Band D サブパターンサンプル（実機目視用）
    # ============================================================
    print("\n--- rank=1 Band C k_gt_1 サンプル（係数付き解 k>=2） ---")
    for r in band_c_rows_01:
        if classify_rank01_band_c_subkind(r[i_latex], r[i_canonical]) == "k_gt_1":
            print(f"  C k_gt_1: {r[i_latex]}  =>  {r[i_canonical]}")

    print("\n--- rank=1 Band D サンプル（slot_index 順、with_p / ax2_eq_c） ---")
    for i, l in enumerate(band_d_latexes_01):
        sub = classify_rank01_band_d_subkind(l)
        # canonical も表示
        canon = ""
        for r in rows:
            if (len(r) > i_canonical and r[i_rank].strip().isdigit()
                and int(r[i_rank]) == 1 and r[i_band] == "D" and r[i_latex] == l):
                canon = r[i_canonical]
                break
        print(f"  D[{i+1:2d}] ({sub:9s}): {l:30s}  =>  {canon}")

    # ============================================================
    # rank=12 Band B サンプル表示（実機目視用、interleave 順序確認）
    # slot 0,1,2 で paren_neg → leading_minus → positive が並ぶことを目視確認できる
    # ============================================================
    print("\n--- rank=12 Band B サンプル（interleave 順序、slot 0-5） ---")
    band_b_latexes_12 = [r[i_latex] for r in band_b_rows_12]
    for i, l in enumerate(band_b_latexes_12[:6]):
        sub = classify_rank12_band_b_subkind(l)
        canon = band_b_rows_12[i][i_canonical]
        print(f"  B[{i+1:2d}] ({sub:13s}): {l:18s}  =>  {canon}")

    # ============================================================
    # rank=13 Band D サンプル表示（実機目視用、3 項加減）
    # ============================================================
    print("\n--- rank=13 Band D サンプル（3 項加減、最初の 5 問） ---")
    for i, l in enumerate(band_d_latexes_13[:5]):
        # canonical を取得
        canon = ""
        for r in rows:
            if (len(r) > i_canonical and r[i_rank].strip().isdigit()
                and int(r[i_rank]) == 13 and r[i_band] == "D" and r[i_latex] == l):
                canon = r[i_canonical]
                break
        print(f"  D[{i+1:2d}]: {l:45s}  =>  {canon}")

    # ============================================================
    # rank=9 Band A サブパターンサンプル + Band D 符号反転サンプル
    # ============================================================
    rank09_a_rows = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 9
        and r[i_band] == "A"
    ]
    print("\n--- rank=9 Band A サンプル（slot_index 順、two_term/three_term/with_const） ---")
    for i, r in enumerate(rank09_a_rows):
        sub = classify_rank09_band_a_subkind(r[i_latex])
        print(f"  A[{i+1:2d}] ({sub:11s}): {r[i_latex]:30s}  =>  {r[i_canonical]}")

    rank09_d_rows = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 9
        and r[i_band] == "D"
    ]
    print("\n--- rank=9 Band D サンプル（特に符号反転 -(...) パターン） ---")
    import re as _re_d
    minus_rows = [r for r in rank09_d_rows if _re_d.search(r"\)\s+-\s+\(", r[i_latex])]
    for r in minus_rows[:6]:
        print(f"  D[-]: {r[i_latex]:42s}  =>  {r[i_canonical]}")

    # ============================================================
    # 結果サマリ
    # ============================================================
    print("\n" + "=" * 50)
    print(f"検証結果: {pass_count} PASS / {fail_count} FAIL")
    print("=" * 50)
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
