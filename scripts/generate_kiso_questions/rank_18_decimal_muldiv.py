# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""18級：小数 乗除（仕様書 §6.5）。

A: 整数 × 小数 / 整数 ÷ 小数 / 小数 ÷ 整数（割り切れる組のみ）
B: 小数 × 小数 / 小数 ÷ 小数（小さめ）
C: 小数 × 小数 / 小数 ÷ 小数（やや大きめ）

割り切れない割り算は出さない（仕様書 §6.5：厳密値のみ）。
被除数 = 除数 × 商 で先に商を決め、戻して被除数を作る。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import OP_LATEX, decimal_latex
from common.sympy_helpers import (
    is_finite_decimal,
    assert_problem_fractions_in_lowest_terms,
)


def _gen_decimal_simple(rng: random.Random, int_max: int, decimals: int) -> sp.Rational:
    """末尾ゼロを避けた、非零の有限小数。"""
    int_part = rng.randint(0, int_max)
    if decimals == 0:
        if int_part == 0:
            int_part = rng.randint(1, max(1, int_max))
        return sp.Rational(int_part, 1)
    while True:
        frac_part = rng.randint(1, 10**decimals - 1)
        if frac_part % 10 != 0:
            break
    return sp.Rational(int_part * 10**decimals + frac_part, 10**decimals)


def _gen_int_x_dec(
    rng: random.Random, int_max: int, decimals: int
) -> Tuple[List[sp.Rational], List[str]]:
    """整数 × 小数 / 整数 ÷ 小数 / 小数 ÷ 整数。割り切れる組のみ。"""
    op = rng.choice(["*", "/"])
    if op == "*":
        # 整数 × 小数（順序ランダム）
        a = sp.Rational(rng.randint(2, max(2, int_max)))
        b = _gen_decimal_simple(rng, int_max, decimals)
        if rng.random() < 0.5:
            a, b = b, a
        return [a, b], ["*"]
    # 割り算：商 q と除数 d を先に決め、被除数 = q * d
    if rng.random() < 0.5:
        # 整数 ÷ 小数：q = 小数、d = 小数 ⇒ 被除数 = 整数になるよう調整
        # 実装簡略化のため「小数 ÷ 整数（割り切れる）」で代用
        q = _gen_decimal_simple(rng, int_max, decimals)
        d = sp.Rational(rng.randint(2, int_max))
        a = q * d  # 小数
        return [a, d], ["/"]
    else:
        # 整数 ÷ 整数で割り切れる商が小数になるケース
        q = _gen_decimal_simple(rng, int_max, decimals)
        d = sp.Rational(rng.randint(2, int_max))
        a = q * d
        return [a, d], ["/"]


def _gen_dec_x_dec(
    rng: random.Random, int_max: int, decimals: int
) -> Tuple[List[sp.Rational], List[str]]:
    """小数 × 小数 / 小数 ÷ 小数。"""
    op = rng.choice(["*", "/"])
    if op == "*":
        a = _gen_decimal_simple(rng, int_max, decimals)
        b = _gen_decimal_simple(rng, int_max, decimals)
        return [a, b], ["*"]
    # 商と除数を先に決めて、被除数 = 商 × 除数
    q = _gen_decimal_simple(rng, int_max, decimals)
    d = _gen_decimal_simple(rng, int_max, decimals)
    a = q * d
    return [a, d], ["/"]


def _evaluate(terms: List[sp.Rational], ops: List[str]) -> sp.Rational:
    result = terms[0]
    for op, t in zip(ops, terms[1:]):
        result = result * t if op == "*" else result / t
    return sp.Rational(result)


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(18, band)
    kind = cfg["kind"]
    int_max = cfg["int_max"]
    decimals = cfg["decimals"]

    for _ in range(300):
        if kind == "int_x_dec":
            terms, ops = _gen_int_x_dec(rng, int_max, decimals)
        elif kind == "dec_x_dec":
            terms, ops = _gen_dec_x_dec(rng, int_max, decimals)
        else:
            raise NotImplementedError(kind)
        result = _evaluate(terms, ops)
        if result <= 0:
            continue
        if not is_finite_decimal(result):
            continue
        # 結果が大きすぎる/小さすぎる組は避ける（教育的価値が低い）
        if abs(result) > 100 or abs(result) < sp.Rational(1, 1000):
            continue

        parts = [decimal_latex(terms[0])]
        for op, t in zip(ops, terms[1:]):
            parts.append(OP_LATEX[op])
            parts.append(decimal_latex(t))
        latex = " ".join(parts)

        canonical = av.canonical_decimal_for_rational(result)
        allowed = av.variants_for_decimal_answer(result)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 18,
                "band": band,
                "terms_p_q": [(int(t.p), int(t.q)) for t in terms],
                "ops": ops,
                "value_p": int(result.p),
                "value_q": int(result.q),
            },
        }
    raise RuntimeError(f"rank 18 band {band}: 300 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    terms = [sp.Rational(p, q) for p, q in meta["terms_p_q"]]
    expected = sp.Rational(meta["value_p"], meta["value_q"])
    if _evaluate(terms, meta["ops"]) != expected:
        return False
    if av.canonical_decimal_for_rational(expected) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
