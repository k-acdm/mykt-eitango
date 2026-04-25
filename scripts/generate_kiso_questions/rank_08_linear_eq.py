# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""8級：一次方程式・比例式（仕様書 §6.5）。

A: ax = b
B: ax + b = c または ax + b = cx + d
C: 比例式 a:b = c:x

D 以降の小数係数・分数係数は Phase 3 以降。
解は整数または既約分数（§6.4.0）。

問題式は等式：左辺・右辺を分けて LaTeX で表示。
答えは「x の値」のみ（整数または既約分数の文字列）。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import frac_latex_raw
from common.sympy_helpers import assert_problem_fractions_in_lowest_terms


def _signed_int(rng: random.Random, max_abs: int, min_abs: int = 1) -> int:
    while True:
        v = rng.randint(-max_abs, max_abs)
        if abs(v) >= min_abs:
            return v


def _format_term_x(coef: int, leading: bool) -> str:
    """coef * x の項表示。leading=True なら符号付きそのまま、False なら絶対値（呼び出し側で符号）。"""
    if coef == 0:
        return ""
    if leading:
        if coef == 1:
            return "x"
        if coef == -1:
            return "-x"
        return f"{coef}x"
    abs_c = abs(coef)
    return "x" if abs_c == 1 else f"{abs_c}x"


def _format_const(c: int, leading: bool) -> str:
    if c == 0:
        return ""
    if leading:
        return str(c)
    return str(abs(c))


def _build_lhs(a: int, b: int) -> str:
    """ax + b の表示（b=0 なら ax のみ、a=0 なら b のみ）。"""
    if a == 0:
        return _format_const(b, leading=True) or "0"
    s = _format_term_x(a, leading=True)
    if b != 0:
        op = " + " if b > 0 else " - "
        s += op + _format_const(b, leading=False)
    return s


def _build_rhs(c: int, d: int = 0, has_x: bool = False) -> str:
    """has_x=False なら c のみ。has_x=True なら cx + d。"""
    if not has_x:
        return _format_const(c, leading=True) or "0"
    s = _format_term_x(c, leading=True)
    if d != 0:
        op = " + " if d > 0 else " - "
        s += op + _format_const(d, leading=False)
    return s


def _gen_ax_eq_b(rng, coef_max, x_max):
    """ax = b → x = b/a。

    DESIGN_PRINCIPLES.md 原則 2 に基づき、Band A は **整数解のみ** に制限する。
    実装：先に x_sol（整数）を選び、b = a * x_sol で逆算 → x が必ず整数になる。

    TODO_PHASE3: 解が分数になる ax=b 問題（割り切れない係数）は Phase 3 の Band D 以降で復活させる。
    """
    a = _signed_int(rng, coef_max, min_abs=2)
    x_sol = _signed_int(rng, x_max)
    if x_sol == 0:
        return None
    b = a * x_sol
    x_val = sp.Rational(b, a)  # 必ず整数（Rational(p, 1) 形）
    latex = f"{_build_lhs(a, 0)} = {_build_rhs(b)}"
    return latex, x_val, {"kind": "ax_eq_b", "a": a, "b": b}


def _gen_ax_b_eq_cx_d(rng, coef_max, const_max):
    """ax + b = cx + d → x = (d - b) / (a - c)。a != c。"""
    while True:
        a = _signed_int(rng, coef_max, min_abs=2)
        c = _signed_int(rng, coef_max)
        if a == c:
            continue
        b = _signed_int(rng, const_max)
        d = _signed_int(rng, const_max)
        x_val = sp.Rational(d - b, a - c)
        if x_val == 0:
            continue
        latex = f"{_build_lhs(a, b)} = {_build_rhs(c, d, has_x=True)}"
        return latex, x_val, {"kind": "ax_b_eq_cx_d", "a": a, "b": b, "c": c, "d": d}


def _gen_proportion(rng, value_max):
    """a : b = c : x → x = b * c / a。

    DESIGN_PRINCIPLES.md 原則 2 に基づき、Band C 入門段階は **x が整数になる組のみ** 採用。
    実装：x_int を先に選び、a, b, c を「a が b*x_int を割り切る」よう構築する。

    TODO_PHASE3: 比例式で複雑な分数解（22/9、108/13 など）になる組は
    Phase 3 の Band E 以降で復活させる。
    """
    for _ in range(500):
        x_int = rng.randint(2, value_max)
        a = rng.randint(2, value_max)
        b = rng.randint(2, value_max)
        # c = a * x_int / b → 正の整数になる必要がある
        prod = a * x_int
        if prod % b != 0:
            continue
        c = prod // b
        if c < 2 or c > value_max:
            continue
        x_val = sp.Rational(x_int)
        latex = f"{a} : {b} = {c} : x"
        return latex, x_val, {"kind": "proportion", "a": a, "b": b, "c": c}
    return None


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(8, band)
    kind = cfg["kind"]

    for _ in range(500):
        if kind == "ax_eq_b":
            built = _gen_ax_eq_b(rng, cfg["coef_max"], cfg["x_max"])
        elif kind == "ax_b_eq_cx_d":
            built = _gen_ax_b_eq_cx_d(rng, cfg["coef_max"], cfg["const_max"])
        elif kind == "proportion":
            built = _gen_proportion(rng, cfg["value_max"])
        else:
            raise NotImplementedError(kind)
        if built is None:
            continue
        latex, x_val, info = built
        canonical = av.canonical_for_rational(x_val)
        allowed = av.variants_for_rational(x_val)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 8,
                "band": band,
                "x_p": int(x_val.p),
                "x_q": int(x_val.q),
                **info,
            },
        }
    raise RuntimeError(f"rank 8 band {band}: 500 retries exhausted")


def _verify_solution(meta: Dict[str, Any], x_val: sp.Rational) -> bool:
    """解 x_val が問題式を満たすかチェック。"""
    kind = meta["kind"]
    if kind == "ax_eq_b":
        return meta["a"] * x_val == meta["b"]
    if kind == "ax_b_eq_cx_d":
        return meta["a"] * x_val + meta["b"] == meta["c"] * x_val + meta["d"]
    if kind == "proportion":
        # a : b = c : x ⇒ a * x = b * c
        return meta["a"] * x_val == meta["b"] * meta["c"]
    return False


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    x_val = sp.Rational(meta["x_p"], meta["x_q"])
    if not _verify_solution(meta, x_val):
        return False
    if av.canonical_for_rational(x_val) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
