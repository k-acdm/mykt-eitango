# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""4級：乗法公式（仕様書 §6.5）。

A: (x + a)(x + b) → x² + (a+b)x + ab
B: (x + a)² または (x - a)² → x² ± 2ax + a²
C: (x + a)(x - a) → x² - a²

すべて単一変数 x。a, b は ±[1..const_max] の整数。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import poly_latex, factored_pair_latex, square_factor_latex
from common.sympy_helpers import assert_problem_fractions_in_lowest_terms


def _signed(rng, max_abs: int, min_abs: int = 1) -> int:
    while True:
        v = rng.randint(-max_abs, max_abs)
        if abs(v) >= min_abs:
            return v


def _expand_xab(a: int, b: int) -> Tuple[int, int, int]:
    """(x+a)(x+b) = x² + (a+b)x + ab。係数 (1, a+b, ab) を返す。"""
    return 1, a + b, a * b


def _gen_type_xab(rng, const_max):
    """Band A: (x+a)(x+b)。a, b は同符号でも異符号でも OK。

    除外条件:
    - a == b: 平方（Band B 相当）
    - a + b == 0: 差の平方 (x-c)(x+c) = x^2 - c^2（Band C 相当、cross-band 重複防止）

    数学的に同一の問題 (x+a)(x+b) と (x+b)(x+a) を統一するため、数値順で a <= b に
    並べ替える（unique pool の二重計上 / 同一セッション内の実質重複を防ぐ）。
    """
    while True:
        a = _signed(rng, const_max)
        b = _signed(rng, const_max)
        if a == b:
            continue  # 平方は Band B
        if a + b == 0:
            continue  # 差の平方は Band C
        if a > b:
            a, b = b, a
        c2, c1, c0 = _expand_xab(a, b)
        problem_latex = factored_pair_latex(a, b)
        canonical = poly_latex([c2, c1, c0])
        return problem_latex, canonical, {
            "kind": "type_xab", "a": a, "b": b,
            "c2": c2, "c1": c1, "c0": c0,
        }


def _gen_type_square(rng, const_max):
    """Band B: (x+a)² または (x-a)²。"""
    a = _signed(rng, const_max)  # ±[1..const_max]
    # (x + a)^2 = x^2 + 2a x + a^2
    c2, c1, c0 = 1, 2 * a, a * a
    problem_latex = square_factor_latex(a)
    canonical = poly_latex([c2, c1, c0])
    return problem_latex, canonical, {
        "kind": "type_square", "a": a,
        "c2": c2, "c1": c1, "c0": c0,
    }


def _gen_type_diff_squares(rng, const_max):
    """Band C: (x+a)(x-a) = x² - a²。"""
    a = rng.randint(1, const_max)  # 正のみで簡略化（符号を入れ替えても結果同じ）
    c2, c1, c0 = 1, 0, -a * a
    # 表示は (x + a)(x - a) または (x - a)(x + a)
    problem_latex = factored_pair_latex(a, -a)
    canonical = poly_latex([c2, c1, c0])
    return problem_latex, canonical, {
        "kind": "type_diff_squares", "a": a,
        "c2": c2, "c1": c1, "c0": c0,
    }


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(4, band)
    kind = cfg["kind"]

    for _ in range(300):
        if kind == "type_xab":
            built = _gen_type_xab(rng, cfg["const_max"])
        elif kind == "type_square":
            built = _gen_type_square(rng, cfg["const_max"])
        elif kind == "type_diff_squares":
            built = _gen_type_diff_squares(rng, cfg["const_max"])
        else:
            raise NotImplementedError(kind)
        problem_latex, canonical, info = built

        allowed = av.variants_for_polynomial(canonical)
        return {
            "problemLatex": problem_latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 4,
                "band": band,
                **info,
            },
        }
    raise RuntimeError(f"rank 4 band {band}: 300 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    # SymPy で展開して期待形と一致するか厳密検証
    x = sp.symbols("x")
    if meta["kind"] == "type_xab":
        expr = (x + meta["a"]) * (x + meta["b"])
    elif meta["kind"] == "type_square":
        expr = (x + meta["a"]) ** 2
    elif meta["kind"] == "type_diff_squares":
        expr = (x + meta["a"]) * (x - meta["a"])
    else:
        return False
    expanded = sp.expand(expr)
    coeffs = sp.Poly(expanded, x).all_coeffs()
    expected = [meta["c2"], meta["c1"], meta["c0"]]
    # SymPy 側は最高次のみを返すので、長さを揃える
    while len(coeffs) < 3:
        coeffs = [0] + coeffs
    if [int(c) for c in coeffs] != expected:
        return False
    if poly_latex(expected) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
