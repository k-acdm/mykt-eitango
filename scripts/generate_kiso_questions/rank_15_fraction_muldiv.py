# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""15級：分数 乗除（仕様書 §6.5）。

A: 分数 × 整数 / 分数 ÷ 整数 （途中約分が活きる組のみ採用）
B: 分数 × 分数 / 分数 ÷ 分数
C: 3項 乗除（混合）

D 以降の帯分数・小数混在は Phase 3。

§6.4.0 既約性原則：問題式の各分数は GCD=1（pick_coprime_numerator で保証）。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

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


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(15, band)
    kind = cfg["kind"]
    denom_max = cfg["denom_max"]

    for _ in range(500):
        if kind == "frac_int":
            int_max = cfg["int_max"]
            n, d = _gen_fraction(rng, denom_max)
            k = rng.randint(2, int_max)
            op = rng.choice(["*", "/"])
            terms = [(n, d), (k, 1)]
            ops = [op]
        elif kind == "frac_frac":
            n1, d1 = _gen_fraction(rng, denom_max)
            n2, d2 = _gen_fraction(rng, denom_max)
            op = rng.choice(["*", "/"])
            terms = [(n1, d1), (n2, d2)]
            ops = [op]
        elif kind == "three_term":
            terms = [_gen_fraction(rng, denom_max) for _ in range(3)]
            ops = [rng.choice(["*", "/"]) for _ in range(2)]
        else:
            raise NotImplementedError(kind)

        try:
            value = _evaluate(terms, ops)
        except ZeroDivisionError:
            continue
        if value <= 0:
            continue
        # 自明な結果（1 や同じ分子/分母）は除外
        if value == 1:
            continue

        latex = _build_latex(terms, ops)
        canonical = av.canonical_for_rational(value)
        allowed = av.variants_for_rational(value)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 15,
                "band": band,
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
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
