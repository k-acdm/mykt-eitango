# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""15級：分数 乗除（仕様書 §6.5）。

Phase 1（2026-05-07）:
  A: 分数 op 整数 12 問（slot_index 駆動 × 6 / ÷ 6 均等 + 約分強制）
  B: 分数 op 分数 18 問（slot_index 駆動 × 9 / ÷ 9 均等 + 約分強制）
  C: 3 項乗除 12 問（slot_index 駆動 4 通り組み合わせ均等 mm/md/dm/dd 各 3 問）
  D: 答えが整数になる muldiv 8 問（新設、slot_index 駆動 mul_int_ans 4 / div_int_ans 4）

§6.4.0 既約性原則：問題式の各分数は GCD=1（pick_coprime_numerator で保証）。

Band D 設計ポイント:
  - mul_int_ans: 整数 × 分数 = 整数 形 例 8 × 3/4 = 6（k = d*m を選び、結果 = m*n が整数）
  - div_int_ans: 整数 ÷ 分数 = 整数 形 例 6 ÷ 2/3 = 9（k = n*m を選び、結果 = m*d が整数）
  - 整数の位置（先頭/末尾）を slot 内で交互に均等配分

# TODO_PHASE3: 以下は Phase 3 で導入予定（rank_15）
#   1. 帯分数表記（2\\frac{1}{3} × 1\\frac{1}{2}）
#   2. 小数混在（0.5 × 1/2）
#   3. 4項以上の乗除
#   4. rank_14 Band D との完全分離（100題化時に rank_15 Band A を末尾整数のみに、
#      rank_14 Band D を先頭整数のみにするなど。Phase 1 では頻度低のため許容）
"""

from __future__ import annotations

import random
from math import gcd
from typing import Any, Dict, List, Optional, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import frac_latex_raw, OP_LATEX
from common.sympy_helpers import (
    pick_coprime_numerator,
    assert_problem_fractions_in_lowest_terms,
)


def _gen_fraction(rng: random.Random, denom_max: int) -> Tuple[int, int]:
    """既約分数 (n, d) を返す。d ∈ [2, denom_max]、n ∈ [1, d-1] coprime。"""
    d = rng.randint(2, denom_max)
    n = pick_coprime_numerator(rng, d)
    return n, d


def _evaluate(terms: List[Tuple[int, int]], ops: List[str]) -> sp.Rational:
    result = sp.Rational(*terms[0])
    for op, (n, d) in zip(ops, terms[1:]):
        v = sp.Rational(n, d)
        if op == "*":
            result = result * v
        elif op == "/":
            if v == 0:
                raise ZeroDivisionError
            result = result / v
        else:
            raise ValueError(f"unsupported op: {op}")
    return sp.Rational(result)


def _build_latex(terms: List[Tuple[int, int]], ops: List[str]) -> str:
    parts = [frac_latex_raw(*terms[0])]
    for op, (n, d) in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(frac_latex_raw(n, d))
    return " ".join(parts)


# --- Band D 用ヘルパー（整数項を含む 2 項用 LaTeX） -------------------------

def _term_str(t: Tuple[int, int]) -> str:
    """項 (n,d) を LaTeX 化。d==1 なら整数表記、それ以外は frac_latex_raw。"""
    n, d = t
    if d == 1:
        return f"{n}"
    return frac_latex_raw(n, d)


def _build_two_term_with_int(terms, ops):
    """2 項用：整数項を含めて表示できる版（rank_14 と同パターン）。"""
    parts = [_term_str(terms[0])]
    for op, t in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(_term_str(t))
    return " ".join(parts)


# --- 約分判定ヘルパー -------------------------------------------------------

def _has_cancel_band_a(n: int, d: int, k: int, op: str) -> bool:
    """Band A の「分数 op 整数」で約分が活きるか。

    n ⊥ d 前提：
      mul: result = (n*k)/d → gcd(n*k, d) = gcd(k, d) （n⊥d より）
      div: result = n/(d*k) → gcd(n, d*k) = gcd(n, k) （n⊥d より）
    """
    if op == "*":
        return gcd(k, d) > 1
    return gcd(n, k) > 1  # op == "/"


def _has_cancel_band_b(n1: int, d1: int, n2: int, d2: int, op: str) -> bool:
    """Band B の「分数 op 分数」で約分が活きるか。

    n1 ⊥ d1, n2 ⊥ d2 前提：
      mul: result_pre = (n1*n2)/(d1*d2) → gcd(n1*n2, d1*d2) > 1
      div: result_pre = (n1*d2)/(d1*n2) → gcd(n1*d2, d1*n2) > 1
    """
    if op == "*":
        return gcd(n1 * n2, d1 * d2) > 1
    return gcd(n1 * d2, d1 * n2) > 1  # op == "/"


# --- slot_index 駆動 サブパターン dispatcher（cumulative） ------------------

def _resolve_band_a_subkind(slot_index: int, subcounts: Dict[str, int]) -> Tuple[str, int]:
    """slot_index → (subkind, sub_slot_index)。subkind ∈ {"mul", "div"}。

    cumulative dispatch：rank_03/02/07/08/01/12/11/13/09/14 と同方式。
    sub_slot_index は subkind 内での 0-based 位置（force_cancel 判定に使う）。
    """
    cumulative = 0
    for subkind in ("mul", "div"):
        c = subcounts.get(subkind, 0)
        if slot_index < cumulative + c:
            return subkind, slot_index - cumulative
        cumulative += c
    return "div", slot_index - cumulative + subcounts.get("div", 0)


def _resolve_band_b_subkind(slot_index: int, subcounts: Dict[str, int]) -> Tuple[str, int]:
    """slot_index → (subkind, sub_slot_index)。subkind ∈ {"mul", "div"}。"""
    cumulative = 0
    for subkind in ("mul", "div"):
        c = subcounts.get(subkind, 0)
        if slot_index < cumulative + c:
            return subkind, slot_index - cumulative
        cumulative += c
    return "div", slot_index - cumulative + subcounts.get("div", 0)


def _resolve_band_c_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → "mm" / "md" / "dm" / "dd"。"""
    cumulative = 0
    for subkind in ("mm", "md", "dm", "dd"):
        cumulative += subcounts.get(subkind, 0)
        if slot_index < cumulative:
            return subkind
    return "dd"


def _resolve_band_d_subkind(slot_index: int, subcounts: Dict[str, int]) -> Tuple[str, int]:
    """slot_index → (subkind, sub_slot_index)。subkind ∈ {"mul_int_ans", "div_int_ans"}。"""
    cumulative = 0
    for subkind in ("mul_int_ans", "div_int_ans"):
        c = subcounts.get(subkind, 0)
        if slot_index < cumulative + c:
            return subkind, slot_index - cumulative
        cumulative += c
    return "div_int_ans", slot_index - cumulative + subcounts.get("div_int_ans", 0)


_BAND_C_OPS_MAP = {
    "mm": ["*", "*"],
    "md": ["*", "/"],
    "dm": ["/", "*"],
    "dd": ["/", "/"],
}


# --- Band 別 generator ------------------------------------------------------

def _gen_band_a_with_op(rng: random.Random, denom_max: int, int_max: int,
                        op: str, force_cancel: bool):
    """Band A: 「分数 op 整数」（末尾整数固定、既存ロジック踏襲）。

    force_cancel=True なら _has_cancel_band_a が真の組のみ採用。
    """
    n, d = _gen_fraction(rng, denom_max)
    k = rng.randint(2, int_max)
    if force_cancel and not _has_cancel_band_a(n, d, k, op):
        return None
    terms = [(n, d), (k, 1)]
    return terms, [op]


def _gen_band_b_with_op(rng: random.Random, denom_max: int, op: str,
                        force_cancel: bool):
    """Band B: 「分数 op 分数」（既存ロジック踏襲）。

    force_cancel=True なら _has_cancel_band_b が真の組のみ採用。
    """
    n1, d1 = _gen_fraction(rng, denom_max)
    n2, d2 = _gen_fraction(rng, denom_max)
    if force_cancel and not _has_cancel_band_b(n1, d1, n2, d2, op):
        return None
    terms = [(n1, d1), (n2, d2)]
    return terms, [op]


def _gen_band_c_with_ops(rng: random.Random, denom_max: int,
                         ops_pattern: str):
    """Band C: 3 項乗除（既存ロジック踏襲、演算子は ops_pattern で固定）。"""
    terms = [_gen_fraction(rng, denom_max) for _ in range(3)]
    ops = list(_BAND_C_OPS_MAP[ops_pattern])
    return terms, ops


def _gen_mul_int_ans(rng: random.Random, denom_max: int, int_max: int,
                     int_first: bool):
    """Band D mul_int_ans: 「整数 × 分数 = 整数」形を生成。

    n ⊥ d 前提で、k = d * m を選べば result = (k*n)/d = m*n が整数になる。
    int_first: True → 整数先頭、False → 分数先頭。
    """
    # d を選ぶ → m を選ぶ（k = d*m が int_max 以内）→ n を選ぶ（n⊥d, n≠0）
    d = rng.randint(2, denom_max)
    m_max = int_max // d
    if m_max < 1:
        return None
    m = rng.randint(1, m_max)
    k = d * m
    if k < 2:
        return None  # 整数は 2 以上に揃える（rank_14 Band D と同じ）
    n = pick_coprime_numerator(rng, d)
    if int_first:
        terms = [(k, 1), (n, d)]
    else:
        terms = [(n, d), (k, 1)]
    return terms, ["*"]


def _gen_div_int_ans(rng: random.Random, denom_max: int, int_max: int,
                     int_first: bool):
    """Band D div_int_ans: 「整数 ÷ 分数 = 整数」形を生成。

    n ⊥ d 前提で、k = n * m を選べば result = k / (n/d) = (k*d)/n = m*d が整数になる。

    注意: int_first=False（「真分数 ÷ 整数 = 整数」）は **数学的に不可能**。
    n/d ÷ k = n/(d*k) を整数にするには d*k | n が必要だが、n⊥d かつ n<d より
    解なし。よって int_first パラメータは div_int_ans では無視し、常に整数先頭で生成する。
    （spec の「整数の位置 先頭/末尾均等」要請は mul_int_ans のみ適用、
     div_int_ans は教育的に整数先頭が標準形）
    """
    # int_first 引数は受け取るが無視（常に True）
    _ = int_first
    # d を選ぶ → n を選ぶ（n⊥d, n≠0）→ m を選ぶ（k = n*m が int_max 以内）
    d = rng.randint(2, denom_max)
    n = pick_coprime_numerator(rng, d)
    m_max = int_max // n
    if m_max < 1:
        return None
    m = rng.randint(1, m_max)
    k = n * m
    if k < 2:
        return None  # 整数は 2 以上
    terms = [(k, 1), (n, d)]
    return terms, ["/"]


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    全 Band で slot_index 駆動（rank_03/02/07/08/01/12/11/13/09/14 と同方式）：
      A: 演算子 mul/div 均等 + 約分強制（前半 force_cancel=True, 後半 free）
      B: 演算子 mul/div 均等 + 約分強制（前半 force_cancel=True, 後半 free）
      C: 3 項演算子組み合わせ mm/md/dm/dd 均等
      D: mul_int_ans / div_int_ans 均等、整数位置 slot 内で交互
    """
    cfg = get_band(15, band)
    kind = cfg["kind"]

    # サブパターン強制指定（band 別）
    forced_op: Optional[str] = None
    forced_ops_pattern: Optional[str] = None
    forced_subkind: Optional[str] = None
    sub_slot: int = 0
    force_cancel: bool = False

    subcounts = cfg.get("subcounts", {})

    if kind == "frac_int":  # Band A
        forced_op_subkind, sub_slot = _resolve_band_a_subkind(slot_index, subcounts)
        forced_op = "*" if forced_op_subkind == "mul" else "/"
        force_cancel = sub_slot < cfg.get("force_cancel_min_per_op", 0)
    elif kind == "frac_frac":  # Band B
        forced_op_subkind, sub_slot = _resolve_band_b_subkind(slot_index, subcounts)
        forced_op = "*" if forced_op_subkind == "mul" else "/"
        force_cancel = sub_slot < cfg.get("force_cancel_min_per_op", 0)
    elif kind == "three_term":  # Band C
        forced_ops_pattern = _resolve_band_c_subkind(slot_index, subcounts)
    elif kind == "int_ans_muldiv":  # Band D
        forced_subkind, sub_slot = _resolve_band_d_subkind(slot_index, subcounts)

    for _ in range(500):
        if kind == "frac_int":
            denom_max = cfg["denom_max"]
            int_max = cfg["int_max"]
            res = _gen_band_a_with_op(rng, denom_max, int_max, forced_op, force_cancel)
            if res is None:
                continue
            terms, ops = res
            try:
                value = _evaluate(terms, ops)
            except ZeroDivisionError:
                continue
            latex = _build_latex(terms, ops)  # 既存：末尾整数を frac_latex_raw(k, 1) で表示
            meta_kind = "frac_int"

        elif kind == "frac_frac":
            denom_max = cfg["denom_max"]
            res = _gen_band_b_with_op(rng, denom_max, forced_op, force_cancel)
            if res is None:
                continue
            terms, ops = res
            try:
                value = _evaluate(terms, ops)
            except ZeroDivisionError:
                continue
            latex = _build_latex(terms, ops)
            meta_kind = "frac_frac"

        elif kind == "three_term":
            denom_max = cfg["denom_max"]
            terms, ops = _gen_band_c_with_ops(rng, denom_max, forced_ops_pattern)
            try:
                value = _evaluate(terms, ops)
            except ZeroDivisionError:
                continue
            latex = _build_latex(terms, ops)
            meta_kind = "three_term"

        elif kind == "int_ans_muldiv":
            denom_max = cfg["denom_max"]
            int_max = cfg["int_max"]
            int_first = (sub_slot % 2 == 0)  # 偶数 slot は整数先頭、奇数は分数先頭
            if forced_subkind == "mul_int_ans":
                res = _gen_mul_int_ans(rng, denom_max, int_max, int_first)
            else:
                res = _gen_div_int_ans(rng, denom_max, int_max, int_first)
            if res is None:
                continue
            terms, ops = res
            try:
                value = _evaluate(terms, ops)
            except ZeroDivisionError:
                continue
            latex = _build_two_term_with_int(terms, ops)
            meta_kind = forced_subkind
        else:
            raise NotImplementedError(kind)

        if value <= 0:
            continue
        if value == 1:
            continue
        # 極端値ガード（rank_14 と整合）
        if abs(value) > 1000 or abs(value) < sp.Rational(1, 10000):
            continue
        # Band D: 答えが整数になることを必須
        if kind == "int_ans_muldiv" and value.q != 1:
            continue

        canonical = av.canonical_for_rational(value)
        allowed = av.variants_for_rational(value)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 15,
                "band": band,
                "kind": meta_kind,
                "terms": [list(t) for t in terms],
                "ops": ops,
                "value_p": int(value.p),
                "value_q": int(value.q),
            },
        }
    raise RuntimeError(f"rank 15 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    terms = [tuple(t) for t in meta["terms"]]
    expected = sp.Rational(meta["value_p"], meta["value_q"])
    if _evaluate(terms, meta["ops"]) != expected:
        return False
    if av.canonical_for_rational(expected) != problem["answerCanonical"]:
        return False
    # 既約性原則：問題式の各分数は GCD=1
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    # Band D 追加検証：整数項と分数項が両方含まれる + 答えが整数
    if meta["kind"] in ("mul_int_ans", "div_int_ans"):
        has_int = any(t[1] == 1 for t in terms)
        has_frac = any(t[1] != 1 for t in terms)
        if not (has_int and has_frac):
            return False
        if expected.q != 1:
            return False
    return True
