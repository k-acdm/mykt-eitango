# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""6級：連立方程式（仕様書 §6.5）。

A: 簡単な整数係数（解も整数）
B: 中程度（係数大きめ、解は整数）
C: 解が分数になるケースを許容

加減法・代入法どちらでも解ける形式（特に方法を限定しない）。
SymPy の solve() で解の整合性を厳密検証。

問題式：``\\begin{cases} ... \\\\ ... \\end{cases}`` で 2 式を縦に並べる。
答え：``x = a, y = b``（整数 or 既約分数）。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.sympy_helpers import (
    pick_coprime_numerator,
    is_lowest_terms,
    assert_problem_fractions_in_lowest_terms,
)


def _signed_int(rng: random.Random, max_abs: int, min_abs: int = 1) -> int:
    while True:
        v = rng.randint(-max_abs, max_abs)
        if abs(v) >= min_abs:
            return v


def _format_term_xy_latex(coef: int, var: str, leading: bool) -> str:
    if coef == 0:
        return ""
    if leading:
        if coef == 1:
            return var
        if coef == -1:
            return f"-{var}"
        return f"{coef}{var}"
    abs_c = abs(coef)
    return var if abs_c == 1 else f"{abs_c}{var}"


def _build_eq_latex(a: int, b: int, c: int) -> str:
    """ax + by = c の LaTeX。a または b が 0 のとき適切に簡略化。"""
    parts: List[str] = []
    if a != 0:
        parts.append(_format_term_xy_latex(a, "x", leading=True))
    if b != 0:
        if not parts:
            parts.append(_format_term_xy_latex(b, "y", leading=True))
        else:
            op = " + " if b > 0 else " - "
            parts.append(op + _format_term_xy_latex(b, "y", leading=False))
    lhs = "".join(parts) if parts else "0"
    return f"{lhs} = {c}"


def _build_simultaneous_latex(eq1: Tuple[int, int, int], eq2: Tuple[int, int, int]) -> str:
    a1, b1, c1 = eq1
    a2, b2, c2 = eq2
    return (
        "\\begin{cases} "
        + _build_eq_latex(a1, b1, c1)
        + " \\\\ "
        + _build_eq_latex(a2, b2, c2)
        + " \\end{cases}"
    )


def _gen_int_solution_eqs(rng, coef_max, sol_max):
    """解 (x_sol, y_sol) を整数で先に決め、係数を選んで 2 式を構築。

    eq1: a1 x + b1 y = c1, c1 = a1*x_sol + b1*y_sol
    eq2: a2 x + b2 y = c2, c2 = a2*x_sol + b2*y_sol
    判別式 a1*b2 - a2*b1 ≠ 0（一意解を持つ条件）。

    DESIGN_PRINCIPLES.md 原則 2 に基づく入門難易度調整：
      - Band A は band_config.py で coef_max=3 にしてシンプルな係数に限定
      - Band B/C で順次中程度の係数を許可

    TODO_PHASE3: 係数 ±4〜±6 を含む中程度の連立方程式は Band B/C 終盤 or
    Phase 3 の Band D 以降で本格的に扱う。
    """
    while True:
        x_sol = _signed_int(rng, sol_max)
        y_sol = _signed_int(rng, sol_max)
        a1 = _signed_int(rng, coef_max)
        b1 = _signed_int(rng, coef_max)
        a2 = _signed_int(rng, coef_max)
        b2 = _signed_int(rng, coef_max)
        det = a1 * b2 - a2 * b1
        if det == 0:
            continue
        c1 = a1 * x_sol + b1 * y_sol
        c2 = a2 * x_sol + b2 * y_sol
        return (a1, b1, c1), (a2, b2, c2), sp.Rational(x_sol), sp.Rational(y_sol)


def _gen_frac_solution_eqs(rng, coef_max, sol_denom_max):
    """解が既約分数になるケース。x_sol / y_sol は分子・分母が GCD=1 の有理数。"""
    while True:
        # 解の分母を選ぶ（共通分母にしておくと係数が整数のままでも分数解になる）
        d = rng.randint(2, sol_denom_max)
        nx = pick_coprime_numerator(rng, d)
        ny = pick_coprime_numerator(rng, d)
        sign_x = rng.choice([-1, 1])
        sign_y = rng.choice([-1, 1])
        x_sol = sp.Rational(sign_x * nx, d)
        y_sol = sp.Rational(sign_y * ny, d)
        # 整数係数かつ右辺も整数になるよう、係数を d の倍数に
        # 簡単のため：a1, b1, a2, b2 を d で割り切れる係数に限定する
        # → そうすると c1 = a1*x + b1*y も整数になる
        candidates = [k for k in range(-coef_max * d, coef_max * d + 1)
                      if k != 0 and k % d == 0]
        if not candidates:
            continue
        a1 = rng.choice(candidates)
        b1 = rng.choice(candidates)
        a2 = rng.choice(candidates)
        b2 = rng.choice(candidates)
        det = a1 * b2 - a2 * b1
        if det == 0:
            continue
        c1 = a1 * x_sol + b1 * y_sol
        c2 = a2 * x_sol + b2 * y_sol
        if c1.q != 1 or c2.q != 1:
            continue
        return (a1, b1, int(c1.p)), (a2, b2, int(c2.p)), x_sol, y_sol


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(6, band)
    kind = cfg["kind"]

    for _ in range(500):
        if kind in ("simple_int", "general_int"):
            eq1, eq2, x_sol, y_sol = _gen_int_solution_eqs(rng, cfg["coef_max"], cfg["sol_max"])
        elif kind == "frac_solution":
            eq1, eq2, x_sol, y_sol = _gen_frac_solution_eqs(rng, cfg["coef_max"], cfg["sol_denom_max"])
        else:
            raise NotImplementedError(kind)

        # 退屈な解（x=0 or y=0）は教育的価値が低いので避ける
        if x_sol == 0 or y_sol == 0:
            continue

        # SymPy で実際に解を確認（厳密検証）
        x, y = sp.symbols("x y")
        sols = sp.solve(
            [
                sp.Eq(eq1[0] * x + eq1[1] * y, eq1[2]),
                sp.Eq(eq2[0] * x + eq2[1] * y, eq2[2]),
            ],
            (x, y),
        )
        if not sols:
            continue
        if isinstance(sols, dict):
            x_check = sp.Rational(sols.get(x, 0))
            y_check = sp.Rational(sols.get(y, 0))
        else:
            # tuple/list 形式
            x_check = sp.Rational(sols[0])
            y_check = sp.Rational(sols[1])
        if x_check != x_sol or y_check != y_sol:
            continue

        latex = _build_simultaneous_latex(eq1, eq2)
        canonical = av.canonical_for_xy_solution(x_sol, y_sol)
        allowed = av.variants_for_xy_solution(x_sol, y_sol)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 6,
                "band": band,
                "kind": kind,
                "eq1": list(eq1),
                "eq2": list(eq2),
                "x_p": int(x_sol.p),
                "x_q": int(x_sol.q),
                "y_p": int(y_sol.p),
                "y_q": int(y_sol.q),
            },
        }
    raise RuntimeError(f"rank 6 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    a1, b1, c1 = meta["eq1"]
    a2, b2, c2 = meta["eq2"]
    x_sol = sp.Rational(meta["x_p"], meta["x_q"])
    y_sol = sp.Rational(meta["y_p"], meta["y_q"])
    # 連立方程式の解として満たすか
    if a1 * x_sol + b1 * y_sol != c1:
        return False
    if a2 * x_sol + b2 * y_sol != c2:
        return False
    if av.canonical_for_xy_solution(x_sol, y_sol) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
