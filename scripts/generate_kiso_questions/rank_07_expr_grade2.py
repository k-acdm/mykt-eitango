# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""7級：式の計算 中2（仕様書 §6.5）。

A: 多項式の加減 — (3x + 2) + (x - 5) → 4x - 3
B: 多項式 × 整数 / 整数で割る — 2(3x + 1) → 6x + 2 / (4x + 6) ÷ 2 → 2x + 3
C: 単項式の累乗 — (2x)^3 → 8x^3、(-3a)^2 → 9a^2

D 以降の分数係数・多変数・筆算形式は Phase 3 以降。
§6.4.0 既約性原則：問題式・答え式の分数係数は既約形（ここでは整数係数中心）。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.sympy_helpers import (
    is_lowest_terms,
    assert_problem_fractions_in_lowest_terms,
)


def _coef_str(coef: int, leading: bool) -> str:
    if coef == 0:
        return ""
    if leading:
        if coef == 1:
            return ""
        if coef == -1:
            return "-"
        return str(coef)
    abs_c = abs(coef)
    return "" if abs_c == 1 else str(abs_c)


def _term_x_latex(coef: int, var: str, exp: int, leading: bool) -> str:
    """coef * var^exp（exp=0 なら定数項）。"""
    if coef == 0:
        return ""
    if exp == 0:
        if leading:
            return str(coef)
        return str(abs(coef))
    cs = _coef_str(coef, leading=leading)
    var_part = var if exp == 1 else f"{var}^{{{exp}}}"
    if cs == "" or cs == "-":
        return f"{cs}{var_part}"
    return f"{cs}{var_part}"


def _poly_latex(coeffs: List[int], var: str = "x") -> str:
    """係数リスト [a_n, a_{n-1}, ..., a_0] を LaTeX に。

    最高次から並べる。ゼロ係数の項はスキップ。先頭は符号付きそのまま、
    以降は op(+/-) と絶対値で連結。
    """
    n = len(coeffs) - 1
    parts: List[str] = []
    for i, c in enumerate(coeffs):
        exp = n - i
        if c == 0:
            continue
        if not parts:
            parts.append(_term_x_latex(c, var, exp, leading=True))
        else:
            op = " + " if c > 0 else " - "
            parts.append(op + _term_x_latex(c, var, exp, leading=False))
    return "".join(parts) if parts else "0"


def _gen_linear_poly(rng, coef_max, const_max) -> Tuple[int, int]:
    """ax + b （a, b ともに非零）。"""
    while True:
        a = rng.randint(-coef_max, coef_max)
        b = rng.randint(-const_max, const_max)
        if a != 0 and b != 0:
            return a, b


def _gen_poly_addsub(rng, coef_max, const_max):
    """(ax + b) + (cx + d) もしくは (ax + b) - (cx + d)。"""
    a, b = _gen_linear_poly(rng, coef_max, const_max)
    c, d = _gen_linear_poly(rng, coef_max, const_max)
    op = rng.choice(["+", "-"])
    if op == "+":
        ra, rb = a + c, b + d
    else:
        ra, rb = a - c, b - d
    if ra == 0 and rb == 0:
        return None
    problem_latex = f"({_poly_latex([a, b])}) {op} ({_poly_latex([c, d])})"
    canonical = _poly_latex([ra, rb])
    return problem_latex, canonical, {"a": a, "b": b, "c": c, "d": d, "op": op,
                                      "ra": ra, "rb": rb}


def _gen_poly_int_muldiv(rng, coef_max, const_max, factor_max):
    """k(ax + b) もしくは (ax + b) ÷ k（k が a, b の公約数）。"""
    op = rng.choice(["*", "/"])
    if op == "*":
        a, b = _gen_linear_poly(rng, coef_max, const_max)
        # k は ±[2..factor_max]、自明な ±1 を弾く
        k = rng.choice([n for n in range(-factor_max, factor_max + 1) if abs(n) >= 2])
        ra, rb = k * a, k * b
        problem_latex = f"{k if k > 0 else f'({k})'}({_poly_latex([a, b])})"
        canonical = _poly_latex([ra, rb])
        return problem_latex, canonical, {"k": k, "a": a, "b": b, "ra": ra, "rb": rb, "op": op}
    # ÷ k：a, b が k の倍数になるよう構築
    k = rng.choice([n for n in range(2, factor_max + 1)])  # 正の k のみで簡略化
    ra = rng.randint(-coef_max, coef_max)
    rb = rng.randint(-const_max, const_max)
    if ra == 0 or rb == 0:
        return None
    a, b = ra * k, rb * k
    problem_latex = f"({_poly_latex([a, b])}) \\div {k}"
    canonical = _poly_latex([ra, rb])
    return problem_latex, canonical, {"k": k, "a": a, "b": b, "ra": ra, "rb": rb, "op": op}


def _gen_monomial_power(rng, coef_max, exp_max):
    """(coef * var)^exp → coef^exp * var^exp。

    例：(2x)^3 → 8x^3、(-3a)^2 → 9a^2、(-2y)^3 → -8y^3
    """
    var = rng.choice(["x", "y", "a", "b"])
    coef = rng.choice([n for n in range(-coef_max, coef_max + 1) if abs(n) >= 2])
    exp = rng.randint(2, exp_max)
    result_coef = coef ** exp
    result_exp = exp

    # 問題式：(coef * var)^exp。coef が ±1 なら裸の var をそのまま、coef が負なら括弧
    if coef == 1:
        inside = var
    elif coef == -1:
        inside = f"-{var}"
    else:
        inside = f"{coef}{var}"
    problem_latex = f"({inside})^{{{exp}}}"

    # 答え：result_coef * var^result_exp
    canonical = _term_x_latex(result_coef, var, result_exp, leading=True)
    return problem_latex, canonical, {
        "var": var, "coef": coef, "exp": exp,
        "result_coef": result_coef, "result_exp": result_exp,
    }


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(7, band)
    kind = cfg["kind"]

    for _ in range(500):
        if kind == "poly_addsub":
            built = _gen_poly_addsub(rng, cfg["coef_max"], cfg["const_max"])
        elif kind == "poly_int_muldiv":
            built = _gen_poly_int_muldiv(rng, cfg["coef_max"], cfg["const_max"], cfg["factor_max"])
        elif kind == "monomial_power":
            built = _gen_monomial_power(rng, cfg["coef_max"], cfg["exp_max"])
        else:
            raise NotImplementedError(kind)
        if built is None:
            continue
        problem_latex, canonical, info = built

        allowed = av.variants_for_polynomial(canonical)
        return {
            "problemLatex": problem_latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 7,
                "band": band,
                "kind": kind,
                **info,
            },
        }
    raise RuntimeError(f"rank 7 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    kind = meta["kind"]
    if kind == "poly_addsub":
        a, b, c, d, op = meta["a"], meta["b"], meta["c"], meta["d"], meta["op"]
        ra_exp, rb_exp = (a + c, b + d) if op == "+" else (a - c, b - d)
        if ra_exp != meta["ra"] or rb_exp != meta["rb"]:
            return False
        if _poly_latex([ra_exp, rb_exp]) != problem["answerCanonical"]:
            return False
    elif kind == "poly_int_muldiv":
        if meta["op"] == "*":
            ra_exp, rb_exp = meta["k"] * meta["a"], meta["k"] * meta["b"]
        else:
            if meta["a"] % meta["k"] != 0 or meta["b"] % meta["k"] != 0:
                return False
            ra_exp, rb_exp = meta["a"] // meta["k"], meta["b"] // meta["k"]
        if ra_exp != meta["ra"] or rb_exp != meta["rb"]:
            return False
        if _poly_latex([ra_exp, rb_exp]) != problem["answerCanonical"]:
            return False
    elif kind == "monomial_power":
        rc = meta["coef"] ** meta["exp"]
        re_ = meta["exp"]
        if rc != meta["result_coef"] or re_ != meta["result_exp"]:
            return False
        expected = _term_x_latex(rc, meta["var"], re_, leading=True)
        if expected != problem["answerCanonical"]:
            return False
    else:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
