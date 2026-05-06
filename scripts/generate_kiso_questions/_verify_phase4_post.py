"""KisoQuestions シート Phase 4 投入後検証（rank_17/20 対応版、★ Phase 1 完全制覇 ★）。

過去の rank_02 / rank_03 / rank_04 / rank_05 / rank_06 / rank_07 / rank_08 / rank_01 /
rank_11 / rank_12 / rank_13 / rank_09 / rank_10 / rank_14 / rank_15 / rank_16 /
rank_18 / rank_19 投入後検証（CLAUDE.md #155-160 / #171）と同じパターンで
gspread からシートを直接読み出し、**Phase 1 完全制覇**（全 20 単元 50 題化、合計
1000 問達成）の投入結果を検証する。

最後の 2 単元 rank_17（小数四則混合）と rank_20（整数四則混合）の Phase 1 拡充
（rank_17: Band D 答え整数 3 項小数四則、rank_20: digits=1 化 + Band D カッコあり）
の投入で、全 20 単元が 50 題化、計 1000 問。

検証項目:
  T1  全 rank 行数 = 1000
  T2  rank 別行数（全 20 rank が 50、★ RANKS_30 は空 ★）
  T3  rank=6 Band 配分（A=5, B=20, C=10, D=15）
  T4  questionId 重複ゼロ（880 件全てユニーク）
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
  T19 rank=10 Band 配分（A=17, B=17, C=16）
       + slot 6 に時刻表記「X 時間 Y 分 = N 分」が含まれる
       + slot 7 Band B/C の cases 拡張済み（時速 240km まで）
  T20 rank=14 Band 配分（A=12, B=14, C=12, D=12）
       + Band D サブパターン配分（int_addsub=4, int_mul=4, int_div=4）
       + Band D 全 12 問に整数項 + 分数項の両方が含まれる
       + Band D 配置順 slot 0-3=addsub, 4-7=mul, 8-11=div（決定論的）
  T21 rank=15 Band 配分（A=12, B=18, C=12, D=8）
       + Band A 演算子配分（mul=6, div=6）
       + Band B 演算子配分（mul=9, div=9）
       + Band C ops_pattern 配分（mm=3, md=3, dm=3, dd=3）
       + Band D サブパターン配分（mul_int_ans=4, div_int_ans=4）
       + Band D 全 8 問の答えが整数
       + Band A/B 約分強制（A は各演算子 ≥3、B は各演算子 ≥5）
  T22 rank=16 Band 配分（A=15, B=15, C=10, D=10）
       + Band A 演算子配分（add=8, sub=7、slot 0-1 が int_ans=1）
       + Band B サブパターン配分（easy_lcm=5, medium_lcm=5, hard_lcm=5）
       + Band C サブパターン配分（medium_lcm=5, hard_lcm=5、easy_lcm=0）
       + Band B/C 全問の lcm が各サブパターン範囲内
       + Band D サブパターン配分（all_add=5, add_sub_mix=5）
       + Band D add_sub_mix で + と - が両方含まれる
       + Band D 全 10 問が 3 項
       + Band D に整数答えが 1 問以上（all_add の slot 0）
  T23 rank=18 Band 配分（A=15, B=15, C=10, D=10）
       + Band A/B/C 演算子配分（A: mul=8 div=7、B: mul=8 div=7、C: mul=5 div=5）
       + Band A 決定論的配置（slot 0-7 = mul、slot 8-14 = div）
       + Band D サブパターン配分（mul_int_ans=5, div_int_ans=5）
       + Band D 全 10 問の答えが整数
       + Band D mul_int_ans 整数 + 小数項両方含む
       + Band D div_int_ans 「整数 ÷ 小数」形式（先頭整数、第 2 項小数）
  T24 rank=19 Band 配分（A=15, B=15, C=10, D=10）
       + Band A 演算子配分（+ 8: int_ans 2 + add 通常 6 / - 7）
       + Band A slot 0-1 が int_ans 強制（整数答え）
       + Band B 演算子配分（add=8, sub=7）
       + Band C サブパターン配分（int_minus_dec=5, rest_diff=5）
       + Band C int_minus_dec が slot 0-4 配置 + 「整数 - 小数」形式
       + Band D サブパターン配分（all_add=5, add_sub_mix=5）
       + Band D slot 0（all_add）が整数答え強制
       + Band D add_sub_mix で + と - 両方含まれる
       + Band D 全 10 問が 3 項
  T25 rank=17 Band 配分（A=12, B=14, C=12, D=12）
       + Band A 演算子配分（add=3, sub=3, mul=3, div=3、slot 0-2/3-5/6-8/9-11）
       + Band A 演算子均等化（既存 + 24 / × 14 / ÷ 2 偏り解消）
       + Band B 全 14 問が「カッコなし、÷ 含まない」
       + Band C 全 12 問が「カッコあり、÷ 含まない」
       + Band D サブパターン配分（no_paren=6, with_paren=6）
       + Band D 全 12 問の答えが整数
  T26 rank=20 Band 配分（A=5, B=5, C=20, D=20）
       + Band A/B 自明問題許容（6-6=0、9÷9=1 等、ふくちさん 2026-05-07 判断）
       + Band C digits=1 化（全項が 1 桁整数、結果 100 以下）
       + Band C サブパターン slot 配置（plus_dom=7, minus_dom=6, mul_dom=7）
       + Band D 全 20 問が 3 項カッコあり
       + Band D サブパターン slot 配置（add_outer=7, mul_outer=7, div_outer=6）
       + Band D 結果 100 以下

★ Phase 1 完全制覇マイルストーン：全 20 rank が 50 題化、合計 1000 問達成 ★

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


# 期待値（CLAUDE.md #171 + rank_01/08/09/11/12/13 + rank_10 + rank_14/15/16 +
# rank_18/19 + rank_17/20 Phase 1 拡充の Phase 4 投入仕様）
# ★ Phase 1 完全制覇 ★：全 20 単元 50 題化、合計 1000 問達成。
EXPECTED_TOTAL = 1000
RANKS_30 = []  # 全 rank が 50 題化、Phase 1 完全制覇後は RANKS_30 空
RANKS_50 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
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
# 単位・比・割合 中1（Phase 1、2026-05-06 拡充、10 スロット維持 + count 増加）
EXPECTED_RANK_10_BANDS = {"A": 17, "B": 17, "C": 16}
# slot 7 Band B/C cases 拡張（構造的バグ修正の証拠、ふくちさん指定の時速 240km まで）
EXPECTED_RANK_10_SLOT7_B_VALUES = {60, 72, 90, 120, 144, 150, 180, 240}     # 時速 km
EXPECTED_RANK_10_SLOT7_C_VALUES = {60, 120, 180, 240, 300, 360, 420, 480, 540, 600}  # 分速 m
# 分数四則混合 無学年（Phase 1、2026-05-07 拡充、Band D 整数を含む混合 新設）
EXPECTED_RANK_14_BANDS = {"A": 12, "B": 14, "C": 12, "D": 12}
# rank_14 Band D の slot_index 駆動 3 サブパターン（_resolve_band_d_subkind 由来、cumulative dispatch）
EXPECTED_RANK_14_BAND_D_SUBPATTERNS = {"int_addsub": 4, "int_mul": 4, "int_div": 4}
# 分数乗除 無学年（Phase 1、2026-05-07 拡充、4 Band 全て slot_index 駆動 + Band D 整数答え muldiv 新設）
EXPECTED_RANK_15_BANDS = {"A": 12, "B": 18, "C": 12, "D": 8}
# rank_15 各 Band の slot_index 駆動 サブパターン（cumulative dispatch）
EXPECTED_RANK_15_BAND_A_SUBPATTERNS = {"mul": 6, "div": 6}
EXPECTED_RANK_15_BAND_B_SUBPATTERNS = {"mul": 9, "div": 9}
EXPECTED_RANK_15_BAND_C_SUBPATTERNS = {"mm": 3, "md": 3, "dm": 3, "dd": 3}
EXPECTED_RANK_15_BAND_D_SUBPATTERNS = {"mul_int_ans": 4, "div_int_ans": 4}
# rank_15 約分強制：Band A は各演算子 3 問以上、Band B は各演算子 5 問以上が「約分が活きる組」
EXPECTED_RANK_15_BAND_A_FORCE_CANCEL_MIN_PER_OP = 3
EXPECTED_RANK_15_BAND_B_FORCE_CANCEL_MIN_PER_OP = 5
# 分数加減 無学年（Phase 1、2026-05-07 拡充、Band D 3 項加減新設、4 Band 全て slot_index 駆動）
EXPECTED_RANK_16_BANDS = {"A": 15, "B": 15, "C": 10, "D": 10}
# rank_16 Band A 演算子配分（slot 0-1=int_ans, 2-7=add 通常, 8-14=sub）
EXPECTED_RANK_16_BAND_A_ADD_TOTAL = 8  # int_ans (2) + add 通常 (6)
EXPECTED_RANK_16_BAND_A_SUB_TOTAL = 7
EXPECTED_RANK_16_BAND_A_INT_ANS = 2  # slot 0-1 が答え=1
# rank_16 Band B サブパターン配分（lcm 範囲）
EXPECTED_RANK_16_BAND_B_SUBPATTERNS = {"easy_lcm": 5, "medium_lcm": 5, "hard_lcm": 5}
# rank_16 Band C サブパターン配分（easy_lcm を含まない）
EXPECTED_RANK_16_BAND_C_SUBPATTERNS = {"medium_lcm": 5, "hard_lcm": 5}
# rank_16 Band D サブパターン配分（slot_index 駆動）
EXPECTED_RANK_16_BAND_D_SUBPATTERNS = {"all_add": 5, "add_sub_mix": 5}
# 小数乗除 無学年（Phase 1、2026-05-07 夜 拡充、Band D 答えが整数 muldiv 新設、slot_index 駆動）
EXPECTED_RANK_18_BANDS = {"A": 15, "B": 15, "C": 10, "D": 10}
# Band A/B/C 演算子配分（slot 0-(mul-1)=mul, 残り=div）
EXPECTED_RANK_18_BAND_A_MUL = 8
EXPECTED_RANK_18_BAND_A_DIV = 7
EXPECTED_RANK_18_BAND_B_MUL = 8
EXPECTED_RANK_18_BAND_B_DIV = 7
EXPECTED_RANK_18_BAND_C_MUL = 5
EXPECTED_RANK_18_BAND_C_DIV = 5
# Band D サブパターン配分（slot_index 駆動）
EXPECTED_RANK_18_BAND_D_SUBPATTERNS = {"mul_int_ans": 5, "div_int_ans": 5}
# 小数加減 無学年（Phase 1、2026-05-07 夜 拡充、Band D 3 項加減新設、slot_index 駆動）
EXPECTED_RANK_19_BANDS = {"A": 15, "B": 15, "C": 10, "D": 10}
# rank_19 Band A 演算子配分（subcounts {"add":8,"sub":7,"int_ans":2}, int_ans は add 含む）
# slot 0-1=int_ans (+), slot 2-7=add 通常 (+), slot 8-14=sub (-)
EXPECTED_RANK_19_BAND_A_PLUS = 8  # int_ans 2 + add 通常 6
EXPECTED_RANK_19_BAND_A_MINUS = 7
EXPECTED_RANK_19_BAND_A_INT_ANS = 2  # slot 0-1 が整数答え強制
# rank_19 Band B 演算子配分
EXPECTED_RANK_19_BAND_B_ADD = 8
EXPECTED_RANK_19_BAND_B_SUB = 7
# rank_19 Band C サブパターン配分（int_minus_dec / rest_diff）
EXPECTED_RANK_19_BAND_C_SUBPATTERNS = {"int_minus_dec": 5, "rest_diff": 5}
# rank_19 Band D サブパターン配分
EXPECTED_RANK_19_BAND_D_SUBPATTERNS = {"all_add": 5, "add_sub_mix": 5}
# 小数四則混合 無学年（Phase 1、2026-05-07 夜 拡充、Band D 答え整数 3 項小数四則 新設）
EXPECTED_RANK_17_BANDS = {"A": 12, "B": 14, "C": 12, "D": 12}
# Band A 演算子配分（slot 0-2 add, 3-5 sub, 6-8 mul, 9-11 div、各 3 問均等）
EXPECTED_RANK_17_BAND_A_SUBPATTERNS = {"add": 3, "sub": 3, "mul": 3, "div": 3}
# Band D サブパターン配分（slot_index 駆動）
EXPECTED_RANK_17_BAND_D_SUBPATTERNS = {"no_paren": 6, "with_paren": 6}
# 整数四則混合 無学年（Phase 1、2026-05-07 夜 拡充、digits=1 化 + Band D カッコあり 新設）
EXPECTED_RANK_20_BANDS = {"A": 5, "B": 5, "C": 20, "D": 20}
# Band A/B 配分（入門編、自明問題許容）
EXPECTED_RANK_20_BAND_A_SUBPATTERNS = {"add": 3, "sub": 2}
EXPECTED_RANK_20_BAND_B_SUBPATTERNS = {"mul": 3, "div": 2}
# Band C サブパターン配分（演算子均等化）
EXPECTED_RANK_20_BAND_C_SUBPATTERNS = {"plus_dom": 7, "minus_dom": 6, "mul_dom": 7}
# Band D サブパターン配分（外側演算子分離）
EXPECTED_RANK_20_BAND_D_SUBPATTERNS = {"add_outer": 7, "mul_outer": 7, "div_outer": 6}
# Band C/D 結果値域（小学校算数の暗算範囲）
EXPECTED_RANK_20_RESULT_MAX = 100


def _rank17_classify_band_a_op(latex: str) -> str:
    """rank=17 Band A の演算子を判定。"""
    if "\\times" in latex:
        return "mul"
    if "\\div" in latex:
        return "div"
    if " + " in latex:
        return "add"
    if " - " in latex:
        return "sub"
    return "unknown"


def _rank17_classify_band_d_subkind(latex: str) -> str:
    """rank=17 Band D の no_paren / with_paren を判定。"""
    if "\\left(" in latex or "(" in latex:
        return "with_paren"
    return "no_paren"


def _rank20_classify_band_d_outer(latex: str) -> str:
    """rank=20 Band D の外側演算子（add_outer / mul_outer / div_outer）を判定。

    形式: \\left(... \\right) op2 c
    """
    import re as _re
    m = _re.search(r"\\right\)\s+(\\times|\\div|[+\-])\s+", latex)
    if not m:
        return "unknown"
    op2 = m.group(1)
    if op2 == "\\times":
        return "mul_outer"
    if op2 == "\\div":
        return "div_outer"
    if op2 in ("+", "-"):
        return "add_outer"
    return "unknown"


def _rank20_extract_int_operands(latex: str):
    """rank=20 の latex から整数オペランドを抽出（カッコ・演算子を除いた数値群）。"""
    cleaned = latex.replace("\\left(", "").replace("\\right)", "")
    cleaned = cleaned.replace("\\times", " ").replace("\\div", " ")
    import re as _re
    return [int(x) for x in _re.findall(r"-?\d+", cleaned)]


def _rank19_classify_band_c_subkind(latex: str) -> str:
    """rank=19 Band C の latex を int_minus_dec / rest_diff に分類。

    形式: "<整数> - <小数>" のみ int_minus_dec、それ以外は rest_diff。
    """
    parts = latex.split(" - ")
    if len(parts) == 2:
        left = parts[0].strip()
        right = parts[1].strip()
        # 左が整数（"\d+" のみ、小数点なし）、右が小数（小数点あり）
        if "." not in left and left.lstrip("-").isdigit() and "." in right:
            return "int_minus_dec"
    return "rest_diff"


def _rank19_classify_band_d_subkind(latex: str) -> str:
    """rank=19 Band D の 3 項加減を all_add / add_sub_mix に分類。"""
    import re as _re
    ops = []
    for m in _re.finditer(r"\s([+\-])\s", latex):
        ops.append(m.group(1))
    if len(ops) != 2:
        return "unknown"
    if ops[0] == "+" and ops[1] == "+":
        return "all_add"
    if "+" in ops and "-" in ops:
        return "add_sub_mix"
    return "minus_minus"  # 仕様違反検出


def _rank18_split_terms(latex: str) -> list[str]:
    """rank=18 の 2 項を分割（\\times / \\div の前後）。"""
    import re as _re
    parts = _re.split(r"\s\\(?:times|div)\s", latex)
    return [p.strip() for p in parts]


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


def classify_rank14_band_d_subkind(latex: str) -> str:
    """rank=14 Band D の latex を int_addsub / int_mul / int_div のいずれかに分類。

    演算子の出現で判定（カッコなし、2 項のみの構造を前提）：
      int_mul     : "\\times" を含む
      int_div     : "\\div" を含む
      int_addsub  : 上記以外（"+" or "-" のみ）
    """
    if "\\times" in latex:
        return "int_mul"
    if "\\div" in latex:
        return "int_div"
    return "int_addsub"


def classify_rank15_band_c_ops_pattern(latex: str) -> str:
    """rank=15 Band C の 3 項 ×/÷ 組み合わせを分類。

    出現順に 'm' (=×) / 'd' (=÷) を取って 'mm' / 'md' / 'dm' / 'dd' を返す。
    """
    import re as _re
    ops_in_order = []
    for tok in _re.finditer(r"\\times|\\div", latex):
        ops_in_order.append("m" if tok.group(0) == "\\times" else "d")
    return "".join(ops_in_order)


def rank15_band_a_cancel_active(latex: str) -> bool:
    """rank=15 Band A 「分数 op 整数」で約分が活きるか判定。

    n ⊥ d 前提：
      mul: gcd(k, d) > 1
      div: gcd(n, k) > 1
    """
    import re as _re
    from math import gcd as _gcd
    m = _re.match(r"^\\frac\{(\d+)\}\{(\d+)\}\s+(\\times|\\div)\s+(\d+)$", latex)
    if not m:
        return False
    n, d = int(m.group(1)), int(m.group(2))
    is_mul = m.group(3) == "\\times"
    k = int(m.group(4))
    return _gcd(k, d) > 1 if is_mul else _gcd(n, k) > 1


def _rank16_extract_fractions(latex: str):
    """rank_16 用: \\frac{n}{d} を全件抽出して [(n, d), ...] を返す。"""
    import re as _re
    pairs = []
    for m in _re.finditer(r"\\frac\{(-?\d+)\}\{(\d+)\}", latex):
        pairs.append((int(m.group(1)), int(m.group(2))))
    return pairs


def _rank16_lcm(a: int, b: int) -> int:
    from math import gcd as _gcd
    return a * b // _gcd(a, b)


def classify_rank16_band_bc_subkind(latex: str) -> str:
    """rank=16 Band B/C の latex を easy_lcm / medium_lcm / hard_lcm に分類。

    異分母 2 項加減の lcm を見て:
      easy_lcm:   lcm <= 12
      medium_lcm: 13 <= lcm <= 30
      hard_lcm:   lcm > 30
    """
    pairs = _rank16_extract_fractions(latex)
    if len(pairs) != 2:
        return "unknown"
    d1, d2 = pairs[0][1], pairs[1][1]
    if d1 == d2:
        return "unknown"
    l = _rank16_lcm(d1, d2)
    if l <= 12:
        return "easy_lcm"
    if l <= 30:
        return "medium_lcm"
    return "hard_lcm"


def classify_rank16_band_d_subkind(latex: str) -> str:
    """rank=16 Band D の 3 項加減を all_add / add_sub_mix に分類。

    演算子 ' + ' / ' - ' を抽出して 2 個取り、両方 '+' なら all_add、
    + と - が混在 or 両方 '-' なら add_sub_mix。
    """
    import re as _re
    ops = []
    for m in _re.finditer(r"\s([+\-])\s", latex):
        ops.append(m.group(1))
    if len(ops) != 2:
        return "unknown"
    if ops[0] == "+" and ops[1] == "+":
        return "all_add"
    if "+" in ops and "-" in ops:
        return "add_sub_mix"
    # 両方 '-' は仕様上禁止だが念のため分類（fail 検出用）
    return "minus_minus"


def rank15_band_b_cancel_active(latex: str) -> bool:
    """rank=15 Band B 「分数 op 分数」で約分が活きるか判定。

    n1 ⊥ d1, n2 ⊥ d2 前提：
      mul: gcd(n1*n2, d1*d2) > 1
      div: gcd(n1*d2, d1*n2) > 1
    """
    import re as _re
    from math import gcd as _gcd
    m = _re.match(
        r"^\\frac\{(\d+)\}\{(\d+)\}\s+(\\times|\\div)\s+\\frac\{(\d+)\}\{(\d+)\}$",
        latex,
    )
    if not m:
        return False
    n1, d1 = int(m.group(1)), int(m.group(2))
    is_mul = m.group(3) == "\\times"
    n2, d2 = int(m.group(4)), int(m.group(5))
    if is_mul:
        return _gcd(n1 * n2, d1 * d2) > 1
    return _gcd(n1 * d2, d1 * n2) > 1


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
    # T1: 全 rank 行数 = EXPECTED_TOTAL（920）
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
    # T19: rank=10 Band 配分 + slot 6 時刻表記 + slot 7 拡張
    # ============================================================
    band_counts_10: Counter = Counter()
    for r in rows:
        try:
            if int(r[i_rank]) == 10:
                band_counts_10[r[i_band]] += 1
        except (ValueError, IndexError):
            pass

    for band, expected in EXPECTED_RANK_10_BANDS.items():
        actual = band_counts_10.get(band, 0)
        check(
            f"T19 rank=10 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=10 全 latex（Band 横断、slot rotation で出題されるため）
    rank10_latexes = [
        r[i_latex] for r in rows
        if len(r) > i_latex
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 10
    ]

    # slot 6 に時刻表記「X 時間 Y 分 = ? 分」が含まれる
    hm_pattern = _re.compile(r"\d+\\,\\text\{時間\}\d+\\,\\text\{分\}\s*=\s*\\square\\,\\text\{分\}")
    hm_count = sum(1 for l in rank10_latexes if hm_pattern.search(l))
    check(
        "T19 rank=10 slot 6 時刻表記「X 時間 Y 分 = N 分」が含まれる",
        hm_count > 0,
        f"hm_to_min count={hm_count}",
    )

    # slot 7 Band B（時速 km → 分速 m）の値が拡張範囲内
    rank10_b_latexes = [
        r[i_latex] for r in rows
        if len(r) > i_latex
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 10
        and r[i_band] == "B"
    ]
    slot7_b_values_seen = set()
    for l in rank10_b_latexes:
        m = _re.match(r"^時速(\d+)\\,\\text\{km\}\s*=\s*分速", l)
        if m:
            slot7_b_values_seen.add(int(m.group(1)))
    invalid_b = slot7_b_values_seen - EXPECTED_RANK_10_SLOT7_B_VALUES
    check(
        "T19 rank=10 slot 7 Band B の値が拡張範囲内（時速 km）",
        not invalid_b and len(slot7_b_values_seen) > 0,
        f"観測値={sorted(slot7_b_values_seen)}, 拡張範囲外={sorted(invalid_b)}",
    )

    # slot 7 Band C（分速 m → 秒速 m）の値が拡張範囲内
    rank10_c_latexes = [
        r[i_latex] for r in rows
        if len(r) > i_latex
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 10
        and r[i_band] == "C"
    ]
    slot7_c_values_seen = set()
    for l in rank10_c_latexes:
        m = _re.match(r"^分速(\d+)\\,\\text\{m\}\s*=\s*秒速", l)
        if m:
            slot7_c_values_seen.add(int(m.group(1)))
    invalid_c = slot7_c_values_seen - EXPECTED_RANK_10_SLOT7_C_VALUES
    check(
        "T19 rank=10 slot 7 Band C の値が拡張範囲内（分速 m）",
        not invalid_c and len(slot7_c_values_seen) > 0,
        f"観測値={sorted(slot7_c_values_seen)}, 拡張範囲外={sorted(invalid_c)}",
    )

    # ============================================================
    # T20: rank=14 Band 配分 + Band D サブパターン配分 + Band D 形式チェック
    # ============================================================
    band_counts_14: Counter = Counter()
    rank14_rows = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 14
    ]
    for r in rank14_rows:
        band_counts_14[r[i_band]] += 1

    for band, expected in EXPECTED_RANK_14_BANDS.items():
        actual = band_counts_14.get(band, 0)
        check(
            f"T20 rank=14 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=14 Band D 全 12 問のサブパターン配分
    band_d_rows_14 = [r for r in rank14_rows if r[i_band] == "D"]
    sub_counts_14: Counter = Counter()
    for r in band_d_rows_14:
        sub_counts_14[classify_rank14_band_d_subkind(r[i_latex])] += 1

    for sub, expected in EXPECTED_RANK_14_BAND_D_SUBPATTERNS.items():
        actual = sub_counts_14.get(sub, 0)
        check(
            f"T20 rank=14 Band D {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=14 Band D 全 12 問が「整数項 + 分数項」両方含む
    def _has_standalone_int(lx: str) -> bool:
        # \frac{...}{...} を伏せた残りに整数が出ればOK
        stripped = _re.sub(r"\\frac\{[^}]*\}\{[^}]*\}", "", lx)
        return bool(_re.search(r"\b\d+\b", stripped))

    def _has_fraction(lx: str) -> bool:
        return bool(_re.search(r"\\frac\{", lx))

    band_d_structure_ok_14 = sum(
        1 for r in band_d_rows_14
        if _has_standalone_int(r[i_latex]) and _has_fraction(r[i_latex])
    )
    check(
        "T20 rank=14 Band D 全 12 問に整数項と分数項の両方が含まれる",
        band_d_structure_ok_14 == 12,
        f"actual={band_d_structure_ok_14}/12",
    )

    # rank=14 Band D の slot 配置順が決定論的（先頭4=addsub, 中4=mul, 末4=div）
    slot_order_ok_14 = True
    for i, r in enumerate(band_d_rows_14):
        sub = classify_rank14_band_d_subkind(r[i_latex])
        if i < 4 and sub != "int_addsub":
            slot_order_ok_14 = False
        if 4 <= i < 8 and sub != "int_mul":
            slot_order_ok_14 = False
        if i >= 8 and sub != "int_div":
            slot_order_ok_14 = False
    check(
        "T20 rank=14 Band D 配置順 slot 0-3=addsub, 4-7=mul, 8-11=div（決定論的）",
        slot_order_ok_14,
    )

    # ============================================================
    # rank=14 Band D サンプル表示（実機目視用）
    # ============================================================
    print("\n--- rank=14 Band D サンプル（slot_index 順、int_addsub/int_mul/int_div 各 4 問） ---")
    for i, r in enumerate(band_d_rows_14):
        sub = classify_rank14_band_d_subkind(r[i_latex])
        print(f"  D[{i+1:2d}] ({sub:10s}): {r[i_latex]:42s}  =>  {r[i_canonical]}")

    # ============================================================
    # T21: rank=15 Band 配分 + Band A/B 演算子配分 + Band C ops_pattern 配分
    #      + Band D サブパターン配分 + Band D 全問の答えが整数
    #      + Band A/B の約分強制（最低半数）
    # ============================================================
    band_counts_15: Counter = Counter()
    rank15_rows = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 15
    ]
    for r in rank15_rows:
        band_counts_15[r[i_band]] += 1

    for band, expected in EXPECTED_RANK_15_BANDS.items():
        actual = band_counts_15.get(band, 0)
        check(
            f"T21 rank=15 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=15 Band A 演算子配分
    band_a_rows_15 = [r for r in rank15_rows if r[i_band] == "A"]
    a_op_counts: Counter = Counter()
    for r in band_a_rows_15:
        if "\\times" in r[i_latex]:
            a_op_counts["mul"] += 1
        elif "\\div" in r[i_latex]:
            a_op_counts["div"] += 1
    for sub, expected in EXPECTED_RANK_15_BAND_A_SUBPATTERNS.items():
        actual = a_op_counts.get(sub, 0)
        check(
            f"T21 rank=15 Band A {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=15 Band B 演算子配分
    band_b_rows_15 = [r for r in rank15_rows if r[i_band] == "B"]
    b_op_counts: Counter = Counter()
    for r in band_b_rows_15:
        if "\\times" in r[i_latex]:
            b_op_counts["mul"] += 1
        elif "\\div" in r[i_latex]:
            b_op_counts["div"] += 1
    for sub, expected in EXPECTED_RANK_15_BAND_B_SUBPATTERNS.items():
        actual = b_op_counts.get(sub, 0)
        check(
            f"T21 rank=15 Band B {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=15 Band C ops_pattern 配分（mm / md / dm / dd 各 3）
    band_c_rows_15 = [r for r in rank15_rows if r[i_band] == "C"]
    c_pattern_counts: Counter = Counter()
    for r in band_c_rows_15:
        c_pattern_counts[classify_rank15_band_c_ops_pattern(r[i_latex])] += 1
    for sub, expected in EXPECTED_RANK_15_BAND_C_SUBPATTERNS.items():
        actual = c_pattern_counts.get(sub, 0)
        check(
            f"T21 rank=15 Band C {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=15 Band D サブパターン配分（mul_int_ans / div_int_ans 各 4）
    band_d_rows_15 = [r for r in rank15_rows if r[i_band] == "D"]
    d_sub_counts: Counter = Counter()
    for r in band_d_rows_15:
        if "\\times" in r[i_latex]:
            d_sub_counts["mul_int_ans"] += 1
        elif "\\div" in r[i_latex]:
            d_sub_counts["div_int_ans"] += 1
    for sub, expected in EXPECTED_RANK_15_BAND_D_SUBPATTERNS.items():
        actual = d_sub_counts.get(sub, 0)
        check(
            f"T21 rank=15 Band D {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=15 Band D 全問の答えが整数（既約分数の分母 = 1）
    import re as _re_d_int
    d_int_answers = sum(
        1 for r in band_d_rows_15
        if _re_d_int.match(r"^\d+$", r[i_canonical])
    )
    check(
        "T21 rank=15 Band D 全 8 問の答えが整数",
        d_int_answers == 8,
        f"actual={d_int_answers}/8",
    )

    # rank=15 Band A/B 約分強制（最低半数：A は各演算子 3 問以上、B は各演算子 5 問以上）
    a_mul_cancel = sum(
        1 for r in band_a_rows_15
        if "\\times" in r[i_latex] and rank15_band_a_cancel_active(r[i_latex])
    )
    a_div_cancel = sum(
        1 for r in band_a_rows_15
        if "\\div" in r[i_latex] and rank15_band_a_cancel_active(r[i_latex])
    )
    check(
        f"T21 rank=15 Band A mul で約分が活きる ≥ {EXPECTED_RANK_15_BAND_A_FORCE_CANCEL_MIN_PER_OP}",
        a_mul_cancel >= EXPECTED_RANK_15_BAND_A_FORCE_CANCEL_MIN_PER_OP,
        f"actual={a_mul_cancel}",
    )
    check(
        f"T21 rank=15 Band A div で約分が活きる ≥ {EXPECTED_RANK_15_BAND_A_FORCE_CANCEL_MIN_PER_OP}",
        a_div_cancel >= EXPECTED_RANK_15_BAND_A_FORCE_CANCEL_MIN_PER_OP,
        f"actual={a_div_cancel}",
    )

    b_mul_cancel = sum(
        1 for r in band_b_rows_15
        if "\\times" in r[i_latex] and rank15_band_b_cancel_active(r[i_latex])
    )
    b_div_cancel = sum(
        1 for r in band_b_rows_15
        if "\\div" in r[i_latex] and rank15_band_b_cancel_active(r[i_latex])
    )
    check(
        f"T21 rank=15 Band B mul で約分が活きる ≥ {EXPECTED_RANK_15_BAND_B_FORCE_CANCEL_MIN_PER_OP}",
        b_mul_cancel >= EXPECTED_RANK_15_BAND_B_FORCE_CANCEL_MIN_PER_OP,
        f"actual={b_mul_cancel}",
    )
    check(
        f"T21 rank=15 Band B div で約分が活きる ≥ {EXPECTED_RANK_15_BAND_B_FORCE_CANCEL_MIN_PER_OP}",
        b_div_cancel >= EXPECTED_RANK_15_BAND_B_FORCE_CANCEL_MIN_PER_OP,
        f"actual={b_div_cancel}",
    )

    # ============================================================
    # rank=15 Band D サンプル表示（実機目視用）
    # ============================================================
    print("\n--- rank=15 Band D サンプル（slot_index 順、mul_int_ans/div_int_ans 各 4 問、答えは全て整数） ---")
    for i, r in enumerate(band_d_rows_15):
        sub = "mul_int_ans" if "\\times" in r[i_latex] else "div_int_ans"
        print(f"  D[{i+1:2d}] ({sub:11s}): {r[i_latex]:36s}  =>  {r[i_canonical]}")

    # ============================================================
    # T22: rank=16 Band 配分 + 各 Band サブパターン配分 + lcm 範囲 + 整数答え
    # ============================================================
    band_counts_16: Counter = Counter()
    rank16_rows = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 16
    ]
    for r in rank16_rows:
        band_counts_16[r[i_band]] += 1

    for band, expected in EXPECTED_RANK_16_BANDS.items():
        actual = band_counts_16.get(band, 0)
        check(
            f"T22 rank=16 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # rank=16 Band A 演算子配分（add 8 / sub 7 / int_ans 2 は add の中に含む）
    band_a_rows_16 = [r for r in rank16_rows if r[i_band] == "A"]
    a_add_count = sum(1 for r in band_a_rows_16 if " + " in r[i_latex])
    a_sub_count = sum(1 for r in band_a_rows_16 if " - " in r[i_latex])
    a_int_ans_count = sum(1 for r in band_a_rows_16 if r[i_canonical] == "1")
    check(
        f"T22 rank=16 Band A add 演算子 == {EXPECTED_RANK_16_BAND_A_ADD_TOTAL}",
        a_add_count == EXPECTED_RANK_16_BAND_A_ADD_TOTAL,
        f"actual={a_add_count}",
    )
    check(
        f"T22 rank=16 Band A sub 演算子 == {EXPECTED_RANK_16_BAND_A_SUB_TOTAL}",
        a_sub_count == EXPECTED_RANK_16_BAND_A_SUB_TOTAL,
        f"actual={a_sub_count}",
    )
    check(
        f"T22 rank=16 Band A 整数答え（=1）== {EXPECTED_RANK_16_BAND_A_INT_ANS}",
        a_int_ans_count == EXPECTED_RANK_16_BAND_A_INT_ANS,
        f"actual={a_int_ans_count}",
    )

    # rank=16 Band A int_ans が slot 0-1 に配置（決定論的）
    if len(band_a_rows_16) >= 2:
        slot0_int = band_a_rows_16[0][i_canonical] == "1"
        slot1_int = band_a_rows_16[1][i_canonical] == "1"
        check(
            "T22 rank=16 Band A slot 0-1 が int_ans（決定論的配置）",
            slot0_int and slot1_int,
            f"slot0={band_a_rows_16[0][i_canonical]}, slot1={band_a_rows_16[1][i_canonical]}",
        )

    # rank=16 Band B サブパターン配分（lcm ベース）
    band_b_rows_16 = [r for r in rank16_rows if r[i_band] == "B"]
    b_sub_counts: Counter = Counter()
    for r in band_b_rows_16:
        b_sub_counts[classify_rank16_band_bc_subkind(r[i_latex])] += 1
    for sub, expected in EXPECTED_RANK_16_BAND_B_SUBPATTERNS.items():
        actual = b_sub_counts.get(sub, 0)
        check(
            f"T22 rank=16 Band B {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )
    unknown_b_16 = b_sub_counts.get("unknown", 0)
    check(
        "T22 rank=16 Band B 未分類（unknown）ゼロ",
        unknown_b_16 == 0,
        f"unknown={unknown_b_16}",
    )

    # rank=16 Band C サブパターン配分（easy_lcm 含まない）
    band_c_rows_16 = [r for r in rank16_rows if r[i_band] == "C"]
    c_sub_counts: Counter = Counter()
    for r in band_c_rows_16:
        c_sub_counts[classify_rank16_band_bc_subkind(r[i_latex])] += 1
    for sub, expected in EXPECTED_RANK_16_BAND_C_SUBPATTERNS.items():
        actual = c_sub_counts.get(sub, 0)
        check(
            f"T22 rank=16 Band C {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )
    c_easy_count = c_sub_counts.get("easy_lcm", 0)
    check(
        "T22 rank=16 Band C easy_lcm == 0（含まれない）",
        c_easy_count == 0,
        f"actual={c_easy_count}",
    )

    # rank=16 Band D サブパターン配分（slot_index 駆動）
    band_d_rows_16 = [r for r in rank16_rows if r[i_band] == "D"]
    d_sub_counts_16: Counter = Counter()
    for r in band_d_rows_16:
        d_sub_counts_16[classify_rank16_band_d_subkind(r[i_latex])] += 1
    for sub, expected in EXPECTED_RANK_16_BAND_D_SUBPATTERNS.items():
        actual = d_sub_counts_16.get(sub, 0)
        check(
            f"T22 rank=16 Band D {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )
    # add_sub_mix で + と - が両方含まれる（[-,-] の minus_minus がゼロ）
    minus_minus_count = d_sub_counts_16.get("minus_minus", 0)
    check(
        "T22 rank=16 Band D add_sub_mix で + と - 両方含む（[-,-] ゼロ）",
        minus_minus_count == 0,
        f"minus_minus={minus_minus_count}",
    )

    # rank=16 Band D 全 10 問が 3 項
    d_three_term_count = sum(
        1 for r in band_d_rows_16
        if len(_rank16_extract_fractions(r[i_latex])) == 3
    )
    check(
        "T22 rank=16 Band D 全 10 問が 3 項",
        d_three_term_count == 10,
        f"actual={d_three_term_count}/10",
    )

    # rank=16 Band D に整数答えが 1 問以上（all_add の slot 0 が force_int_ans）
    import re as _re_d_int_16
    d_int_answers_16 = sum(
        1 for r in band_d_rows_16
        if _re_d_int_16.match(r"^\d+$", r[i_canonical])
    )
    check(
        "T22 rank=16 Band D に整数答えが 1 問以上（all_add の slot 0）",
        d_int_answers_16 >= 1,
        f"actual={d_int_answers_16}（slot 0 が force_int_ans）",
    )

    # rank=16 Band B/C 全問の lcm が各サブパターン範囲内
    # （classify_rank16_band_bc_subkind が unknown を返さないこと、
    #  かつ subcounts と一致することで間接的に保証されている）

    # ============================================================
    # rank=16 Band A サンプル表示（実機目視用）
    # ============================================================
    print("\n--- rank=16 Band A サンプル（slot_index 順、int_ans 2 / add 6 / sub 7） ---")
    for i, r in enumerate(band_a_rows_16):
        if i < 2:
            sub = "int_ans"
        elif " + " in r[i_latex]:
            sub = "add"
        else:
            sub = "sub"
        print(f"  A[{i+1:2d}] ({sub:7s}): {r[i_latex]:34s}  =>  {r[i_canonical]}")

    print("\n--- rank=16 Band B サンプル（easy/medium/hard 各 5、lcm 表示） ---")
    for i, r in enumerate(band_b_rows_16):
        sub = classify_rank16_band_bc_subkind(r[i_latex])
        pairs = _rank16_extract_fractions(r[i_latex])
        l = _rank16_lcm(pairs[0][1], pairs[1][1]) if len(pairs) == 2 else 0
        print(f"  B[{i+1:2d}] ({sub:11s} lcm={l:3d}): {r[i_latex]:36s}  =>  {r[i_canonical]}")

    print("\n--- rank=16 Band C サンプル（medium/hard 各 5、easy_lcm 含まず） ---")
    for i, r in enumerate(band_c_rows_16):
        sub = classify_rank16_band_bc_subkind(r[i_latex])
        pairs = _rank16_extract_fractions(r[i_latex])
        l = _rank16_lcm(pairs[0][1], pairs[1][1]) if len(pairs) == 2 else 0
        print(f"  C[{i+1:2d}] ({sub:11s} lcm={l:3d}): {r[i_latex]:36s}  =>  {r[i_canonical]}")

    print("\n--- rank=16 Band D サンプル（all_add 5 / add_sub_mix 5、3 項加減） ---")
    for i, r in enumerate(band_d_rows_16):
        sub = classify_rank16_band_d_subkind(r[i_latex])
        print(f"  D[{i+1:2d}] ({sub:11s}): {r[i_latex]:48s}  =>  {r[i_canonical]}")

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
    # rank=10 サンプル表示（slot 6 時刻表記 + slot 7 速さ拡張）
    # ============================================================
    rank10_rows_all = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 10
    ]
    print("\n--- rank=10 slot 6 時刻表記サンプル（Phase 1 新規） ---")
    for r in rank10_rows_all:
        if hm_pattern.search(r[i_latex]):
            print(f"  [{r[i_band]}] {r[i_latex]:55s}  =>  {r[i_canonical]}")

    print("\n--- rank=10 slot 7 速さサンプル（Phase 1 拡張、時速 240km まで） ---")
    speed_pattern = _re.compile(r"(時速|分速|秒速)")
    for r in rank10_rows_all:
        if speed_pattern.search(r[i_latex]):
            print(f"  [{r[i_band]}] {r[i_latex]:55s}  =>  {r[i_canonical]}")

    # ============================================================
    # T23: rank=18 Band 配分 + Band A/B/C 演算子配分 + Band D サブパターン配分
    # + Band D 全問整数答え + Band D 構造（mul は整数+小数、div は整数÷小数）
    # ============================================================
    band_counts_18: Counter = Counter()
    rank18_rows = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 18
    ]
    for r in rank18_rows:
        band_counts_18[r[i_band]] += 1

    for band, expected in EXPECTED_RANK_18_BANDS.items():
        actual = band_counts_18.get(band, 0)
        check(
            f"T23 rank=18 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # Band A/B/C 演算子配分
    def _count_ops(band_rows):
        m = sum(1 for r in band_rows if "\\times" in r[i_latex])
        d = sum(1 for r in band_rows if "\\div" in r[i_latex])
        return m, d

    band_a_rows_18 = [r for r in rank18_rows if r[i_band] == "A"]
    band_b_rows_18 = [r for r in rank18_rows if r[i_band] == "B"]
    band_c_rows_18 = [r for r in rank18_rows if r[i_band] == "C"]
    band_d_rows_18 = [r for r in rank18_rows if r[i_band] == "D"]

    a_mul, a_div = _count_ops(band_a_rows_18)
    b_mul, b_div = _count_ops(band_b_rows_18)
    c_mul, c_div = _count_ops(band_c_rows_18)
    check(
        f"T23 rank=18 Band A mul == {EXPECTED_RANK_18_BAND_A_MUL}",
        a_mul == EXPECTED_RANK_18_BAND_A_MUL,
        f"actual={a_mul}",
    )
    check(
        f"T23 rank=18 Band A div == {EXPECTED_RANK_18_BAND_A_DIV}",
        a_div == EXPECTED_RANK_18_BAND_A_DIV,
        f"actual={a_div}",
    )
    check(
        f"T23 rank=18 Band B mul == {EXPECTED_RANK_18_BAND_B_MUL}",
        b_mul == EXPECTED_RANK_18_BAND_B_MUL,
        f"actual={b_mul}",
    )
    check(
        f"T23 rank=18 Band B div == {EXPECTED_RANK_18_BAND_B_DIV}",
        b_div == EXPECTED_RANK_18_BAND_B_DIV,
        f"actual={b_div}",
    )
    check(
        f"T23 rank=18 Band C mul == {EXPECTED_RANK_18_BAND_C_MUL}",
        c_mul == EXPECTED_RANK_18_BAND_C_MUL,
        f"actual={c_mul}",
    )
    check(
        f"T23 rank=18 Band C div == {EXPECTED_RANK_18_BAND_C_DIV}",
        c_div == EXPECTED_RANK_18_BAND_C_DIV,
        f"actual={c_div}",
    )

    # Band A 決定論的配置：slot 0-7 mul、slot 8-14 div
    a_0to7_mul = all("\\times" in r[i_latex] for r in band_a_rows_18[:8])
    a_8to14_div = all("\\div" in r[i_latex] for r in band_a_rows_18[8:])
    check(
        "T23 rank=18 Band A slot 0-7 が mul（決定論的）",
        a_0to7_mul,
    )
    check(
        "T23 rank=18 Band A slot 8-14 が div（決定論的）",
        a_8to14_div,
    )

    # Band D サブパターン配分
    d_mul = sum(1 for r in band_d_rows_18 if "\\times" in r[i_latex])
    d_div = sum(1 for r in band_d_rows_18 if "\\div" in r[i_latex])
    check(
        "T23 rank=18 Band D mul_int_ans == 5",
        d_mul == EXPECTED_RANK_18_BAND_D_SUBPATTERNS["mul_int_ans"],
        f"actual={d_mul}",
    )
    check(
        "T23 rank=18 Band D div_int_ans == 5",
        d_div == EXPECTED_RANK_18_BAND_D_SUBPATTERNS["div_int_ans"],
        f"actual={d_div}",
    )

    # Band D 全 10 問の答えが整数
    import re as _re_d18
    d18_int_count = sum(1 for r in band_d_rows_18 if _re_d18.match(r"^-?\d+$", r[i_canonical]))
    check(
        "T23 rank=18 Band D 全 10 問の答えが整数",
        d18_int_count == 10,
        f"actual={d18_int_count}/10",
    )

    # Band D mul_int_ans 全 5 問に整数項 + 小数項
    band_d_mul_18 = [r for r in band_d_rows_18 if "\\times" in r[i_latex]]
    mul_struct_ok = 0
    for r in band_d_mul_18:
        toks = _rank18_split_terms(r[i_latex])
        if len(toks) == 2:
            t0_int = "." not in toks[0]
            t1_int = "." not in toks[1]
            # ちょうど 1 つが整数（小数点なし）
            if t0_int != t1_int:
                mul_struct_ok += 1
    check(
        "T23 rank=18 Band D mul_int_ans 全 5 問に整数項 + 小数項",
        mul_struct_ok == 5,
        f"actual={mul_struct_ok}/5",
    )

    # Band D div_int_ans 全 5 問が「整数 ÷ 小数」（先頭整数、第 2 項小数）
    band_d_div_18 = [r for r in band_d_rows_18 if "\\div" in r[i_latex]]
    div_struct_ok = 0
    for r in band_d_div_18:
        toks = _rank18_split_terms(r[i_latex])
        if len(toks) == 2 and "." not in toks[0] and "." in toks[1]:
            div_struct_ok += 1
    check(
        "T23 rank=18 Band D div_int_ans 全 5 問が「整数 ÷ 小数」形式",
        div_struct_ok == 5,
        f"actual={div_struct_ok}/5",
    )

    # ============================================================
    # rank=18 Band D サンプル表示（実機目視用）
    # ============================================================
    print("\n--- rank=18 Band D サンプル（slot_index 順、mul_int_ans 5 / div_int_ans 5、答え全て整数） ---")
    for i, r in enumerate(band_d_rows_18):
        sub = "mul_int_ans" if "\\times" in r[i_latex] else "div_int_ans"
        print(f"  D[{i+1:2d}] ({sub:11s}): {r[i_latex]:34s}  =>  {r[i_canonical]}")

    # ============================================================
    # T24: rank=19 Band 配分 + Band A 演算子配分 + Band C int_minus_dec 配置
    # + Band D サブパターン配分 + Band D 整数答え保証
    # ============================================================
    band_counts_19: Counter = Counter()
    rank19_rows = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 19
    ]
    for r in rank19_rows:
        band_counts_19[r[i_band]] += 1

    for band, expected in EXPECTED_RANK_19_BANDS.items():
        actual = band_counts_19.get(band, 0)
        check(
            f"T24 rank=19 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # Band A 演算子配分（+ 8 = int_ans 2 + add 通常 6 / - 7）
    band_a_rows_19 = [r for r in rank19_rows if r[i_band] == "A"]
    a_plus = sum(1 for r in band_a_rows_19 if " + " in r[i_latex])
    a_minus = sum(1 for r in band_a_rows_19 if " - " in r[i_latex])
    check(
        f"T24 rank=19 Band A + 演算子 == {EXPECTED_RANK_19_BAND_A_PLUS}",
        a_plus == EXPECTED_RANK_19_BAND_A_PLUS,
        f"actual={a_plus}",
    )
    check(
        f"T24 rank=19 Band A - 演算子 == {EXPECTED_RANK_19_BAND_A_MINUS}",
        a_minus == EXPECTED_RANK_19_BAND_A_MINUS,
        f"actual={a_minus}",
    )

    # Band A slot 0-1 が int_ans 強制（整数答え）
    if len(band_a_rows_19) >= 2:
        slot0_int_19 = bool(_re.match(r"^-?\d+$", band_a_rows_19[0][i_canonical]))
        slot1_int_19 = bool(_re.match(r"^-?\d+$", band_a_rows_19[1][i_canonical]))
        check(
            "T24 rank=19 Band A slot 0-1 が int_ans 強制（整数答え）",
            slot0_int_19 and slot1_int_19,
            f"slot0={band_a_rows_19[0][i_canonical]}, slot1={band_a_rows_19[1][i_canonical]}",
        )

    # Band B 演算子配分
    band_b_rows_19 = [r for r in rank19_rows if r[i_band] == "B"]
    b_plus = sum(1 for r in band_b_rows_19 if " + " in r[i_latex])
    b_minus = sum(1 for r in band_b_rows_19 if " - " in r[i_latex])
    check(
        f"T24 rank=19 Band B add == {EXPECTED_RANK_19_BAND_B_ADD}",
        b_plus == EXPECTED_RANK_19_BAND_B_ADD,
        f"actual={b_plus}",
    )
    check(
        f"T24 rank=19 Band B sub == {EXPECTED_RANK_19_BAND_B_SUB}",
        b_minus == EXPECTED_RANK_19_BAND_B_SUB,
        f"actual={b_minus}",
    )

    # Band C サブパターン配分（int_minus_dec / rest_diff）
    band_c_rows_19 = [r for r in rank19_rows if r[i_band] == "C"]
    c_subs_19: Counter = Counter()
    for r in band_c_rows_19:
        c_subs_19[_rank19_classify_band_c_subkind(r[i_latex])] += 1
    for sub, expected in EXPECTED_RANK_19_BAND_C_SUBPATTERNS.items():
        actual = c_subs_19.get(sub, 0)
        check(
            f"T24 rank=19 Band C {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # Band C int_minus_dec が slot 0-4 配置
    if len(band_c_rows_19) >= 5:
        c_0to4_imd = all(
            _rank19_classify_band_c_subkind(band_c_rows_19[i][i_latex]) == "int_minus_dec"
            for i in range(5)
        )
        check(
            "T24 rank=19 Band C slot 0-4 が int_minus_dec（決定論的）",
            c_0to4_imd,
        )

    # Band D サブパターン配分
    band_d_rows_19 = [r for r in rank19_rows if r[i_band] == "D"]
    d_subs_19: Counter = Counter()
    for r in band_d_rows_19:
        d_subs_19[_rank19_classify_band_d_subkind(r[i_latex])] += 1
    for sub, expected in EXPECTED_RANK_19_BAND_D_SUBPATTERNS.items():
        actual = d_subs_19.get(sub, 0)
        check(
            f"T24 rank=19 Band D {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )
    minus_minus_19 = d_subs_19.get("minus_minus", 0)
    check(
        "T24 rank=19 Band D add_sub_mix で + と - 両方含む（[-,-] ゼロ）",
        minus_minus_19 == 0,
        f"minus_minus={minus_minus_19}",
    )

    # Band D 全 10 問が 3 項
    def _count_ops_19(latex):
        return len(_re.findall(r"\s[+\-]\s", latex))
    d_3term = sum(1 for r in band_d_rows_19 if _count_ops_19(r[i_latex]) == 2)
    check(
        "T24 rank=19 Band D 全 10 問が 3 項",
        d_3term == 10,
        f"actual={d_3term}/10",
    )

    # Band D slot 0（all_add）が整数答え強制
    if len(band_d_rows_19) >= 1:
        d_slot0_int = bool(_re.match(r"^-?\d+$", band_d_rows_19[0][i_canonical]))
        check(
            "T24 rank=19 Band D slot 0（all_add）が整数答え強制",
            d_slot0_int,
            f"slot0 canonical={band_d_rows_19[0][i_canonical]}",
        )

    # ============================================================
    # rank=19 サンプル表示（実機目視用）
    # ============================================================
    print("\n--- rank=19 Band A サンプル（slot 0-1 が int_ans 強制） ---")
    for i, r in enumerate(band_a_rows_19[:8]):
        sub = "int_ans" if i < 2 else "add"
        print(f"  A[{i+1:2d}] ({sub:7s}): {r[i_latex]:24s}  =>  {r[i_canonical]}")

    print("\n--- rank=19 Band C int_minus_dec 5 問（中学算数の躓きポイント） ---")
    for i, r in enumerate(band_c_rows_19[:5]):
        print(f"  C[{i+1:2d}] (int_minus_dec): {r[i_latex]:26s}  =>  {r[i_canonical]}")

    print("\n--- rank=19 Band D サンプル（all_add 5 / add_sub_mix 5、3 項加減） ---")
    for i, r in enumerate(band_d_rows_19):
        sub = _rank19_classify_band_d_subkind(r[i_latex])
        print(f"  D[{i+1:2d}] ({sub:11s}): {r[i_latex]:34s}  =>  {r[i_canonical]}")

    # ============================================================
    # T25: rank=17 Band 配分 + Band A 演算子均等化 + Band D 答え整数 3 項小数四則
    # ============================================================
    rank17_rows = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 17
    ]
    band_counts_17: Counter = Counter()
    for r in rank17_rows:
        band_counts_17[r[i_band]] += 1

    for band, expected in EXPECTED_RANK_17_BANDS.items():
        actual = band_counts_17.get(band, 0)
        check(
            f"T25 rank=17 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # Band A 演算子均等化（add=3, sub=3, mul=3, div=3）
    band_a_rows_17 = [r for r in rank17_rows if r[i_band] == "A"]
    a_op_counts_17: Counter = Counter()
    for r in band_a_rows_17:
        a_op_counts_17[_rank17_classify_band_a_op(r[i_latex])] += 1
    for sub, expected in EXPECTED_RANK_17_BAND_A_SUBPATTERNS.items():
        actual = a_op_counts_17.get(sub, 0)
        check(
            f"T25 rank=17 Band A {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # Band A 演算子配置（slot 0-2 add, 3-5 sub, 6-8 mul, 9-11 div）
    expected_slot_ops_17 = ["add", "add", "add", "sub", "sub", "sub",
                             "mul", "mul", "mul", "div", "div", "div"]
    a_slot_ok_17 = all(
        _rank17_classify_band_a_op(band_a_rows_17[i][i_latex]) == expected_slot_ops_17[i]
        for i in range(min(12, len(band_a_rows_17)))
    )
    check(
        "T25 rank=17 Band A 演算子配置（slot 0-2 add / 3-5 sub / 6-8 mul / 9-11 div）",
        a_slot_ok_17,
    )

    # Band B/C 全問が「÷ 含まない」（既存仕様維持）
    band_b_rows_17 = [r for r in rank17_rows if r[i_band] == "B"]
    band_c_rows_17 = [r for r in rank17_rows if r[i_band] == "C"]
    b_no_div = all("\\div" not in r[i_latex] for r in band_b_rows_17)
    c_no_div = all("\\div" not in r[i_latex] for r in band_c_rows_17)
    check("T25 rank=17 Band B 全問が「÷ 含まない」", b_no_div)
    check("T25 rank=17 Band C 全問が「カッコあり、÷ 含まない」",
          c_no_div and all("\\left(" in r[i_latex] for r in band_c_rows_17))

    # Band D サブパターン配分
    band_d_rows_17 = [r for r in rank17_rows if r[i_band] == "D"]
    d_sub_counts_17: Counter = Counter()
    for r in band_d_rows_17:
        d_sub_counts_17[_rank17_classify_band_d_subkind(r[i_latex])] += 1
    for sub, expected in EXPECTED_RANK_17_BAND_D_SUBPATTERNS.items():
        actual = d_sub_counts_17.get(sub, 0)
        check(
            f"T25 rank=17 Band D {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # Band D 全問の答えが整数
    import re as _re_d_int_17
    d_int_count_17 = sum(
        1 for r in band_d_rows_17 if _re_d_int_17.match(r"^-?\d+$", r[i_canonical])
    )
    check(
        "T25 rank=17 Band D 全 12 問の答えが整数",
        d_int_count_17 == 12,
        f"actual={d_int_count_17}/12",
    )

    # ============================================================
    # rank=17 サンプル表示
    # ============================================================
    print("\n--- rank=17 Band A サンプル（slot 0-2 add / 3-5 sub / 6-8 mul / 9-11 div） ---")
    for i, r in enumerate(band_a_rows_17):
        sub = expected_slot_ops_17[i] if i < len(expected_slot_ops_17) else "?"
        print(f"  A[{i+1:2d}] ({sub:3s}): {r[i_latex]:28s}  =>  {r[i_canonical]}")

    print("\n--- rank=17 Band D サンプル（no_paren 6 / with_paren 6、全問整数答え） ---")
    for i, r in enumerate(band_d_rows_17):
        sub = "no_paren" if i < 6 else "with_paren"
        print(f"  D[{i+1:2d}] ({sub:10s}): {r[i_latex]:34s}  =>  {r[i_canonical]}")

    # ============================================================
    # T26: rank=20 Band 配分 + digits=1 化 + Band C/D サブパターン配分
    # ============================================================
    rank20_rows = [
        r for r in rows
        if len(r) > i_canonical
        and r[i_rank].strip().isdigit()
        and int(r[i_rank]) == 20
    ]
    band_counts_20: Counter = Counter()
    for r in rank20_rows:
        band_counts_20[r[i_band]] += 1

    for band, expected in EXPECTED_RANK_20_BANDS.items():
        actual = band_counts_20.get(band, 0)
        check(
            f"T26 rank=20 Band {band} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # Band A/B 演算子配分
    band_a_rows_20 = [r for r in rank20_rows if r[i_band] == "A"]
    band_b_rows_20 = [r for r in rank20_rows if r[i_band] == "B"]
    band_c_rows_20 = [r for r in rank20_rows if r[i_band] == "C"]
    band_d_rows_20 = [r for r in rank20_rows if r[i_band] == "D"]

    a_add_20 = sum(1 for r in band_a_rows_20 if " + " in r[i_latex])
    a_sub_20 = sum(1 for r in band_a_rows_20 if " - " in r[i_latex])
    b_mul_20 = sum(1 for r in band_b_rows_20 if "\\times" in r[i_latex])
    b_div_20 = sum(1 for r in band_b_rows_20 if "\\div" in r[i_latex])
    check(f"T26 rank=20 Band A add == {EXPECTED_RANK_20_BAND_A_SUBPATTERNS['add']}",
          a_add_20 == EXPECTED_RANK_20_BAND_A_SUBPATTERNS["add"], f"actual={a_add_20}")
    check(f"T26 rank=20 Band A sub == {EXPECTED_RANK_20_BAND_A_SUBPATTERNS['sub']}",
          a_sub_20 == EXPECTED_RANK_20_BAND_A_SUBPATTERNS["sub"], f"actual={a_sub_20}")
    check(f"T26 rank=20 Band B mul == {EXPECTED_RANK_20_BAND_B_SUBPATTERNS['mul']}",
          b_mul_20 == EXPECTED_RANK_20_BAND_B_SUBPATTERNS["mul"], f"actual={b_mul_20}")
    check(f"T26 rank=20 Band B div == {EXPECTED_RANK_20_BAND_B_SUBPATTERNS['div']}",
          b_div_20 == EXPECTED_RANK_20_BAND_B_SUBPATTERNS["div"], f"actual={b_div_20}")

    # Band C/D digits=1 化検証（全項が 1 桁整数）
    cd_all_single = True
    for r in band_c_rows_20 + band_d_rows_20:
        ops = _rank20_extract_int_operands(r[i_latex])
        if not all(0 <= n <= 9 for n in ops):
            cd_all_single = False
            break
    check("T26 rank=20 Band C/D 全項が 1 桁整数（digits=1 化の証拠）", cd_all_single)

    # Band C 結果値域 100 以下
    c_max_20 = max((abs(int(r[i_canonical])) for r in band_c_rows_20
                     if r[i_canonical].lstrip("-").isdigit()), default=0)
    check(
        f"T26 rank=20 Band C 全結果が {EXPECTED_RANK_20_RESULT_MAX} 以下",
        c_max_20 <= EXPECTED_RANK_20_RESULT_MAX,
        f"max={c_max_20}",
    )

    # Band C サブパターン slot 配置（plus_dom 7 / minus_dom 6 / mul_dom 7）
    c_slot_07_plus = sum(1 for r in band_c_rows_20[:7] if " + " in r[i_latex])
    c_slot_7to12_minus = sum(1 for r in band_c_rows_20[7:13] if " - " in r[i_latex])
    c_slot_13to19_times = sum(1 for r in band_c_rows_20[13:20] if "\\times" in r[i_latex])
    check("T26 rank=20 Band C slot 0-6 plus_dom（+ を必ず含む）== 7",
          c_slot_07_plus == 7, f"actual={c_slot_07_plus}")
    check("T26 rank=20 Band C slot 7-12 minus_dom（- を必ず含む）== 6",
          c_slot_7to12_minus == 6, f"actual={c_slot_7to12_minus}")
    check("T26 rank=20 Band C slot 13-19 mul_dom（× を必ず含む）== 7",
          c_slot_13to19_times == 7, f"actual={c_slot_13to19_times}")

    # Band D 全 20 問がカッコあり
    d_all_paren = all("\\left(" in r[i_latex] for r in band_d_rows_20)
    check("T26 rank=20 Band D 全 20 問が 3 項カッコあり", d_all_paren)

    # Band D 外側演算子サブパターン slot 配置
    d_outer_counts: Counter = Counter()
    for r in band_d_rows_20:
        d_outer_counts[_rank20_classify_band_d_outer(r[i_latex])] += 1
    for sub, expected in EXPECTED_RANK_20_BAND_D_SUBPATTERNS.items():
        actual = d_outer_counts.get(sub, 0)
        check(
            f"T26 rank=20 Band D {sub} == {expected}",
            actual == expected,
            f"actual={actual}",
        )

    # Band D 結果値域 100 以下
    d_max_20 = max((abs(int(r[i_canonical])) for r in band_d_rows_20
                     if r[i_canonical].lstrip("-").isdigit()), default=0)
    check(
        f"T26 rank=20 Band D 全結果が {EXPECTED_RANK_20_RESULT_MAX} 以下",
        d_max_20 <= EXPECTED_RANK_20_RESULT_MAX,
        f"max={d_max_20}",
    )

    # Band D 全問の答えが整数（rank_20 全体）
    import re as _re_d_int_20
    d_int_count_20 = sum(
        1 for r in rank20_rows if _re_d_int_20.match(r"^-?\d+$", r[i_canonical])
    )
    check(
        "T26 rank=20 全 50 問の答えが整数",
        d_int_count_20 == 50,
        f"actual={d_int_count_20}/50",
    )

    # ============================================================
    # rank=20 サンプル表示
    # ============================================================
    print("\n--- rank=20 Band A/B サンプル（自明問題許容、入門編） ---")
    for i, r in enumerate(band_a_rows_20):
        sub = "add" if i < 3 else "sub"
        print(f"  A[{i+1}] ({sub}): {r[i_latex]:14s}  =>  {r[i_canonical]}")
    for i, r in enumerate(band_b_rows_20):
        sub = "mul" if i < 3 else "div"
        print(f"  B[{i+1}] ({sub}): {r[i_latex]:14s}  =>  {r[i_canonical]}")

    print("\n--- rank=20 Band C サンプル（plus_dom 7 / minus_dom 6 / mul_dom 7、digits=1） ---")
    for i, r in enumerate(band_c_rows_20):
        sub = ("plus_dom" if i < 7 else "minus_dom" if i < 13 else "mul_dom")
        print(f"  C[{i+1:2d}] ({sub:9s}): {r[i_latex]:22s}  =>  {r[i_canonical]}")

    print("\n--- rank=20 Band D サンプル（add_outer 7 / mul_outer 7 / div_outer 6） ---")
    for i, r in enumerate(band_d_rows_20):
        sub = ("add_outer" if i < 7 else "mul_outer" if i < 14 else "div_outer")
        print(f"  D[{i+1:2d}] ({sub:9s}): {r[i_latex]:30s}  =>  {r[i_canonical]}")

    # ============================================================
    # 結果サマリ
    # ============================================================
    print("\n" + "=" * 50)
    print(f"検証結果: {pass_count} PASS / {fail_count} FAIL")
    print("=" * 50)
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
