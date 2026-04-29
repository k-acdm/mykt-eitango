# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""3級：因数分解（仕様書 §6.5）。

A: 共通因数のみ — ax + ay → a(x + y)、3a²x − 6ax² → 3ax(a − 2x) のような単純型
B: x² + bx + c → (x + m)(x + n) — 係数 1 の二次三項式
C: x² − a²（差の平方）または x² ± 2ax + a²（完全平方）

TODO_PHASE3: ax² + bx + c のたすき掛け（係数 1 でない二次三項式の因数分解）は
Phase 3 の Band D 以降で導入。

問題式は展開した多項式、答えは因数分解した形。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import (
    poly_latex, factored_pair_latex, square_factor_latex, term_var_latex,
)
from common.sympy_helpers import assert_problem_fractions_in_lowest_terms
from math import gcd


def _gen_common_factor(rng, factor_max, term_max):
    """ax + ay → a(x + y)。Band A：共通因数 a × (x + y) のみ。

    シンプル版：a * (b*x + c*y) → 展開すると ab*x + ac*y。
    a, b, c は ±[1..*]、|a| >= 2（共通因数の意義のため）、b != 0、c != 0。

    **重要**: 内側 (b*x + c*y) にさらに共通因数が残らないよう gcd(|b|, |c|) == 1 を強制
    （正しい因数分解は最大公約数を外に出した形でなければならない）。

    **教科書標準の符号規則（DESIGN_PRINCIPLES.md 原則 2 適用）**:
    内側 (b*x + c*y) の **leading 項（x の係数）を正にする**よう、必要に応じて a の符号を反転。
    これは多項式の標準表記（leading coefficient を正にする慣習）と整合する。
      - 全項負：-30x - 12y → -6(5x + 2y)（外側を負、内側全部正）
      - 全項正：30x + 12y → 6(5x + 2y)（そのまま）
      - 混合（leading 負）：-30x + 12y → -6(5x - 2y)、-4x + 6y → -2(2x - 3y)
      - 混合（leading 正）：30x - 12y → 6(5x - 2y)、4x - 6y → 2(2x - 3y)
    """
    while True:
        a = rng.randint(2, factor_max)  # まずは正の整数で生成
        b = rng.randint(-term_max, term_max)
        c = rng.randint(-term_max, term_max)
        if b == 0 or c == 0:
            continue
        if gcd(abs(b), abs(c)) != 1:
            continue  # 内側に共通因数が残るので不適

        # 教科書標準：leading 項を正にする
        if b < 0:
            a, b, c = -a, -b, -c

        # 結果項：(ab) x + (ac) y（問題式は不変）
        ab = a * b
        ac = a * c
        problem_latex = f"{term_var_latex(ab, 'x', 1, leading=True)} {'+' if ac > 0 else '-'} {term_var_latex(abs(ac), 'y', 1, leading=False)}"
        # 答え：a(bx + cy)。a は正/負の両方ありうる
        inner = f"{term_var_latex(b, 'x', 1, leading=True)} {'+' if c > 0 else '-'} {term_var_latex(abs(c), 'y', 1, leading=False)}"
        canonical = f"{a}({inner})"
        return problem_latex, canonical, {
            "kind": "common_factor", "a": a, "b": b, "c": c,
        }


def _gen_trinomial_simple(rng, root_max):
    """x² + bx + c → (x + m)(x + n)。

    m, n を整数で先に決め、b = m + n、c = m * n を逆算。
    自明 (m=0 or n=0、つまり c=0) は除外。
    """
    while True:
        m = rng.randint(-root_max, root_max)
        n = rng.randint(-root_max, root_max)
        if m == 0 or n == 0:
            continue
        if m == n:
            continue  # 完全平方（Band C 相当）はここでは除外
        b = m + n
        c = m * n
        problem_latex = poly_latex([1, b, c])
        # 答えは (x + min)(x + max)：m, n を昇順にソート
        ms, ns = sorted([m, n])
        canonical = factored_pair_latex(ms, ns)
        return problem_latex, canonical, {
            "kind": "trinomial_simple", "m": ms, "n": ns, "b": b, "c": c,
        }


def _gen_diff_squares(rng, const_max):
    """Band C diff: x² − a² = (x + a)(x − a)。"""
    a = rng.randint(1, const_max)
    problem_latex = poly_latex([1, 0, -a * a])
    canonical = factored_pair_latex(a, -a)
    return problem_latex, canonical, {"kind": "diff_squares", "a": a}


def _gen_perfect_square_pos(rng, const_max):
    """Band C perfect_pos: x² + 2ax + a² = (x + a)²。"""
    a = rng.randint(1, const_max)
    problem_latex = poly_latex([1, 2 * a, a * a])
    canonical = square_factor_latex(a)
    return problem_latex, canonical, {"kind": "perfect_square_pos", "a": a}


def _gen_perfect_square_neg(rng, const_max):
    """Band C perfect_neg: x² − 2ax + a² = (x − a)²。"""
    a = rng.randint(1, const_max)
    problem_latex = poly_latex([1, -2 * a, a * a])
    canonical = square_factor_latex(-a)
    return problem_latex, canonical, {"kind": "perfect_square_neg", "a": a}


# Band C サブパターンの登録順（dispatcher が boundary を組み立てる順序）
_BAND_C_PATTERN_ORDER = ["diff", "perfect_pos", "perfect_neg"]
_BAND_C_GENERATORS = {
    "diff":         _gen_diff_squares,
    "perfect_pos":  _gen_perfect_square_pos,
    "perfect_neg":  _gen_perfect_square_neg,
}


def _resolve_band_c_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index (0-based) と subcounts dict から生成すべきサブパターンを決定。

    例: subcounts={"diff": 6, "perfect_pos": 11, "perfect_neg": 11}
        slot 0-5  → "diff"、slot 6-16 → "perfect_pos"、slot 17-27 → "perfect_neg"

    比率を rng の偶然に依存させず**決定論的**に固定する目的。同じ slot_index を
    指定すれば dedup_retry 時も同じサブパターンが選ばれる（`main.py` 仕様）。
    """
    boundary = 0
    for kind in _BAND_C_PATTERN_ORDER:
        boundary += int(subcounts.get(kind, 0))
        if slot_index < boundary:
            return kind
    raise ValueError(
        f"slot_index {slot_index} が subcounts {subcounts} の範囲外。"
        f"band_config の count と subcounts の総和が一致しているか確認"
    )


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    cfg = get_band(3, band)
    kind = cfg["kind"]

    for _ in range(300):
        if kind == "common_factor":
            built = _gen_common_factor(rng, cfg["factor_max"], cfg["term_max"])
        elif kind == "trinomial_simple":
            built = _gen_trinomial_simple(rng, cfg["root_max"])
        elif kind == "diff_or_perfect_square":
            # Band C: subcounts と slot_index でサブパターンを決定論的に dispatch
            subkind = _resolve_band_c_subkind(slot_index, cfg["subcounts"])
            built = _BAND_C_GENERATORS[subkind](rng, cfg["const_max"])
        else:
            raise NotImplementedError(kind)
        problem_latex, canonical, info = built

        allowed = av.variants_for_polynomial(canonical)
        return {
            "problemLatex": problem_latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 3,
                "band": band,
                **info,
            },
        }
    raise RuntimeError(f"rank 3 band {band}: 300 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    x, y = sp.symbols("x y")
    if meta["kind"] == "common_factor":
        a, b, c = meta["a"], meta["b"], meta["c"]
        expected = a * (b * x + c * y)
        # 問題式は a*b*x + a*c*y の展開形。SymPy で expand → factor で再構築可能性確認
        expanded = sp.expand(expected)
        # 期待 expanded = (a*b)*x + (a*c)*y
        if expanded != (a * b) * x + (a * c) * y:
            return False
    elif meta["kind"] == "trinomial_simple":
        m, n = meta["m"], meta["n"]
        expr = (x + m) * (x + n)
        expanded = sp.expand(expr)
        coeffs = sp.Poly(expanded, x).all_coeffs()
        while len(coeffs) < 3:
            coeffs = [0] + coeffs
        if [int(c) for c in coeffs] != [1, meta["b"], meta["c"]]:
            return False
        if factored_pair_latex(*sorted([m, n])) != problem["answerCanonical"]:
            return False
    elif meta["kind"] == "diff_squares":
        a = meta["a"]
        if sp.expand((x + a) * (x - a)) != x ** 2 - a ** 2:
            return False
    elif meta["kind"] == "perfect_square_pos":
        a = meta["a"]
        if sp.expand((x + a) ** 2) != x ** 2 + 2 * a * x + a ** 2:
            return False
    elif meta["kind"] == "perfect_square_neg":
        a = meta["a"]
        if sp.expand((x - a) ** 2) != x ** 2 - 2 * a * x + a ** 2:
            return False
    else:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
