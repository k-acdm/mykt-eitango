# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""19級：小数 加減（仕様書 §6.5）。

A: 1桁小数 2項 +/-（同位取り）
B: 2桁小数 2項 +/-（同位取り）
C: 桁違い 2項 +/-（整数と小数 / 1桁と3桁の小数 等）

D〜H（3項・3桁同士など）は Phase 3 で追加。
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
    rational_to_decimal_str,
    assert_problem_fractions_in_lowest_terms,
)


def _gen_decimal(
    rng: random.Random, int_max: int, decimals: int, force_decimal_form: bool = True
) -> sp.Rational:
    """整数部 0..int_max、小数部 decimals 桁。

    decimals > 0 かつ force_decimal_form=True のときは小数部を非零に強制し、
    `1 + 4.3` のように一方が整数表記に化けるのを防ぐ（同位取り Band A/B 用）。
    Band C など意図的に「整数 vs 小数」を混在させたい場合は decimals=0 を渡す。
    """
    int_part = rng.randint(0, int_max)
    if decimals == 0:
        if int_part == 0:
            int_part = rng.randint(1, max(1, int_max))
        return sp.Rational(int_part, 1)
    if force_decimal_form:
        # 末尾ゼロも避ける（5.10 を 5.1 と表示しないため）
        while True:
            frac_part = rng.randint(1, 10**decimals - 1)
            if frac_part % 10 != 0:
                break
    else:
        frac_part = rng.randint(0, 10**decimals - 1)
        if int_part == 0 and frac_part == 0:
            frac_part = rng.randint(1, 10**decimals - 1)
    return sp.Rational(int_part * 10**decimals + frac_part, 10**decimals)


def _evaluate(terms: List[sp.Rational], ops: List[str]) -> sp.Rational:
    result = terms[0]
    for op, t in zip(ops, terms[1:]):
        result = result + t if op == "+" else result - t
    return sp.Rational(result)


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(19, band)
    int_max = cfg["int_max"]
    terms_n = cfg.get("terms", 2)

    for _ in range(300):
        # 各項の桁数を決定
        if "decimals_options" in cfg:  # band C: 桁違い
            decs_a, decs_b = rng.choice(cfg["decimals_options"])
            terms = [_gen_decimal(rng, int_max, decs_a), _gen_decimal(rng, int_max, decs_b)]
        else:
            decimals = cfg["decimals"]
            terms = [_gen_decimal(rng, int_max, decimals) for _ in range(terms_n)]
        ops = [rng.choice(["+", "-"]) for _ in range(terms_n - 1)]
        result = _evaluate(terms, ops)
        if result <= 0:
            continue
        # 答えは有限小数になるはずだが念のため
        if not is_finite_decimal(result):
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
                "rank": 19,
                "band": band,
                "terms_p_q": [(int(t.p), int(t.q)) for t in terms],
                "ops": ops,
                "value_p": int(result.p),
                "value_q": int(result.q),
            },
        }
    raise RuntimeError(f"rank 19 band {band}: 300 retries exhausted")


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
