# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""5級：多項式の展開（仕様書 §6.5）。

Phase 1（2026-04-30）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。

A: (ax + b)(cx + d) — 基本展開（a, c は ±1〜±2、Band A のみ (a,b)<=(c,d) 辞書順正規化） / count=13
B: (ax + b)(cx + d) — 一般係数（a, c は ±1〜±5）/ count=13
C: 3項 × 2項 — (ax² + bx + c)(dx + e) など / count=12
D: (ax + b)² — 係数付き平方公式の直接展開（a >= 2 で rank_04 (x+a)² と差別化）/ count=12
   - 例: (2x+3)² = 4x² + 12x + 9、(3x-2)² = 9x² - 12x + 4
   - 中3生がミスしやすい典型: (2x)²=4x² の係数二乗忘れ / 中央項の係数倍忘れ等
   - rank_04 (x+a)² は「公式記憶」、Band D は「直接展開で公式を導く」アプローチで差別化

すべて単一変数 x、整数係数のみ（分数係数は §6.4.0 既約性必須だが Phase 3 で扱う）。
TODO_PHASE3: 多変数（x, y）の展開、分数係数の展開、(ax+b)³ などは Phase 3 で導入。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import poly_latex, term_var_latex
from common.sympy_helpers import assert_problem_fractions_in_lowest_terms


def _signed(rng, max_abs: int, min_abs: int = 1) -> int:
    while True:
        v = rng.randint(-max_abs, max_abs)
        if abs(v) >= min_abs:
            return v


def _binomial_latex(a: int, b: int) -> str:
    """(ax + b) 形式の LaTeX。a, b は非零の前提。"""
    a_term = term_var_latex(a, "x", 1, leading=True)
    if b > 0:
        return f"({a_term} + {b})"
    return f"({a_term} - {abs(b)})"


def _trinomial_latex(a: int, b: int, c: int) -> str:
    """(ax² + bx + c) 形式の LaTeX。a は非零、b/c は 0 含む。"""
    return f"({poly_latex([a, b, c])})"


def _gen_two_by_two(rng, coef_max, const_max, normalize=False):
    """(ax + b)(cx + d) の 2 項 × 2 項展開。

    normalize=True のとき、数学的に同一の問題 (x+3)(-2x+4) と (-2x+4)(x+3) を
    統一するため (a, b) <= (c, d) になるよう辞書順正規化する（rank_04 Band A
    と同方針）。Band A（coef_max=2）で発生しやすい同型重複を解消する目的で
    Phase 1（2026-04-30）から導入。Band B（coef_max=5）は未正規化のまま運用。
    """
    a = _signed(rng, coef_max)
    b = _signed(rng, const_max)
    c = _signed(rng, coef_max)
    d = _signed(rng, const_max)
    if normalize and (a, b) > (c, d):
        a, b, c, d = c, d, a, b
    # 結果係数：(ac, ad+bc, bd)
    c2 = a * c
    c1 = a * d + b * c
    c0 = b * d
    problem_latex = f"{_binomial_latex(a, b)}{_binomial_latex(c, d)}"
    canonical = poly_latex([c2, c1, c0])
    return problem_latex, canonical, {
        "kind": "two_by_two", "a": a, "b": b, "c": c, "d": d,
        "c2": c2, "c1": c1, "c0": c0,
    }


def _gen_trinomial_by_binomial(rng, coef_max, const_max):
    """(ax² + bx + c)(dx + e)。a, d は非零。b, c は 0 含む。"""
    a = _signed(rng, coef_max)
    b = rng.randint(-const_max, const_max)  # b は 0 でも OK
    c = _signed(rng, const_max)              # c=0 だと x の因数化扱いになるので非零
    d = _signed(rng, coef_max)
    e = _signed(rng, const_max)
    # (a x^2 + b x + c)(d x + e)
    #   = a d x^3 + (a e + b d) x^2 + (b e + c d) x + c e
    c3 = a * d
    c2 = a * e + b * d
    c1 = b * e + c * d
    c0 = c * e
    problem_latex = f"{_trinomial_latex(a, b, c)}{_binomial_latex(d, e)}"
    canonical = poly_latex([c3, c2, c1, c0])
    return problem_latex, canonical, {
        "kind": "trinomial_by_binomial",
        "a": a, "b": b, "c": c, "d": d, "e": e,
        "c3": c3, "c2": c2, "c1": c1, "c0": c0,
    }


def _gen_square_with_coef(rng, coef_max, const_max):
    """(ax + b)² の直接展開。a >= 2 で rank_04 (x+a)² と差別化。

    展開: (ax + b)² = a²x² + 2abx + b²
    符号正規化: a > 0 として (b の符号で +/- パターンを区別)
      - (-ax+b)² = (ax-b)² なので a < 0 は同じ問題に正規化される
      - したがって a ∈ [2, coef_max]（正のみ）、b ∈ ±1〜±const_max（非零）

    教育的意図: 中3生がミスしやすい典型を 12 問で量を確保。
      - (2x)² = 2x² と書く誤り → 4x²
      - 2·2x·3 = 12x の中央項処理ミス
      - 末項 b² の符号見落とし（実は常に正）
    """
    a = rng.randint(2, coef_max)  # a >= 2、rank_04 (x+a)²（a=1）と差別化
    b = _signed(rng, const_max)   # 非零、符号は ±
    c2 = a * a
    c1 = 2 * a * b
    c0 = b * b
    a_term = term_var_latex(a, "x", 1, leading=True)  # 例: "2x"
    if b > 0:
        problem_latex = f"({a_term} + {b})^{{2}}"
    else:
        problem_latex = f"({a_term} - {abs(b)})^{{2}}"
    canonical = poly_latex([c2, c1, c0])
    return problem_latex, canonical, {
        "kind": "square_with_coef", "a": a, "b": b,
        "c2": c2, "c1": c1, "c0": c0,
    }


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(5, band)
    kind = cfg["kind"]

    for _ in range(300):
        if kind == "two_by_two_simple":
            built = _gen_two_by_two(rng, cfg["coef_max"], cfg["const_max"], normalize=True)
        elif kind == "two_by_two_general":
            built = _gen_two_by_two(rng, cfg["coef_max"], cfg["const_max"], normalize=False)
        elif kind == "trinomial_by_binomial":
            built = _gen_trinomial_by_binomial(rng, cfg["coef_max"], cfg["const_max"])
        elif kind == "square_with_coef":
            built = _gen_square_with_coef(rng, cfg["coef_max"], cfg["const_max"])
        else:
            raise NotImplementedError(kind)
        problem_latex, canonical, info = built

        allowed = av.variants_for_polynomial(canonical)
        return {
            "problemLatex": problem_latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 5,
                "band": band,
                **info,
            },
        }
    raise RuntimeError(f"rank 5 band {band}: 300 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    x = sp.symbols("x")
    if meta["kind"] == "two_by_two":
        expr = (meta["a"] * x + meta["b"]) * (meta["c"] * x + meta["d"])
        expected = [meta["c2"], meta["c1"], meta["c0"]]
    elif meta["kind"] == "trinomial_by_binomial":
        expr = (meta["a"] * x ** 2 + meta["b"] * x + meta["c"]) * (meta["d"] * x + meta["e"])
        expected = [meta["c3"], meta["c2"], meta["c1"], meta["c0"]]
    elif meta["kind"] == "square_with_coef":
        # rank_04 (x+a)² との差別化ガード: a >= 2 を強制
        if meta["a"] < 2:
            return False
        if meta["b"] == 0:
            return False
        expr = (meta["a"] * x + meta["b"]) ** 2
        expected = [meta["c2"], meta["c1"], meta["c0"]]
    else:
        return False
    expanded = sp.expand(expr)
    coeffs = sp.Poly(expanded, x).all_coeffs()
    while len(coeffs) < len(expected):
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
