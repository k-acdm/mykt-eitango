"""17級：小数 四則混合（仕様書 §6.5）。

A: 2項 四則混合（括弧なし）
B: 3項 四則混合（括弧なし、優先順位で計算）
C: 3項 四則混合（括弧あり）

すべて有限小数で完結する組のみ採用（仕様書 §6.5：割り切れない割り算は出さない）。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import OP_LATEX, decimal_latex, paren_expr_latex
from common.sympy_helpers import (
    is_finite_decimal,
    assert_problem_fractions_in_lowest_terms,
)


def _gen_decimal_simple(rng: random.Random, int_max: int, decimals: int) -> sp.Rational:
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


def _eval_with_precedence(
    terms: List[sp.Rational], ops: List[str]
) -> sp.Rational:
    """優先順位（×÷ → +-）を尊重して左から畳み込む。"""
    flat_terms = list(terms)
    flat_ops = list(ops)
    i = 0
    while i < len(flat_ops):
        if flat_ops[i] in ("*", "/"):
            l, r = flat_terms[i], flat_terms[i + 1]
            v = l * r if flat_ops[i] == "*" else l / r
            flat_terms[i] = v
            del flat_terms[i + 1]
            del flat_ops[i]
        else:
            i += 1
    result = flat_terms[0]
    for op, t in zip(flat_ops, flat_terms[1:]):
        result = result + t if op == "+" else result - t
    return sp.Rational(result)


def _gen_two_term(rng, int_max, decimals):
    a = _gen_decimal_simple(rng, int_max, decimals)
    b = _gen_decimal_simple(rng, int_max, decimals)
    op = rng.choice(["+", "-", "*", "/"])
    if op == "/":
        # 商と除数を先に決めて被除数を作り直す
        q = _gen_decimal_simple(rng, int_max, decimals)
        d = _gen_decimal_simple(rng, int_max, decimals)
        a = q * d
        b = d
    return [a, b], [op]


def _gen_three_term(rng, int_max, decimals):
    """3 項：÷ は使わずに簡易化（17 級 B/C は ÷ なしでも十分難）。"""
    terms = [_gen_decimal_simple(rng, int_max, decimals) for _ in range(3)]
    ops = [rng.choice(["+", "-", "*"]) for _ in range(2)]
    return terms, ops


def _build_latex_no_parens(terms, ops):
    parts = [decimal_latex(terms[0])]
    for op, t in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(decimal_latex(t))
    return " ".join(parts)


def _build_latex_with_parens(terms, ops):
    """3 項のうち先頭 2 項を括弧で包む。例：(1.5 + 2.3) × 4。

    括弧優先で計算した結果を返す（_eval_with_paren と整合）。
    """
    a, b, c = terms
    op1, op2 = ops
    inner = f"{decimal_latex(a)} {OP_LATEX[op1]} {decimal_latex(b)}"
    outer = f"{paren_expr_latex(inner)} {OP_LATEX[op2]} {decimal_latex(c)}"
    return outer


def _eval_with_paren(terms, ops):
    """先頭 2 項を括弧優先で評価。"""
    a, b, c = terms
    op1, op2 = ops
    inner = a + b if op1 == "+" else a - b if op1 == "-" else a * b if op1 == "*" else a / b
    if op2 == "+":
        return inner + c
    if op2 == "-":
        return inner - c
    if op2 == "*":
        return inner * c
    return inner / c


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(17, band)
    terms_n = cfg["terms"]
    parens = cfg["parens"]
    int_max = cfg["int_max"]
    decimals = cfg["decimals"]

    for _ in range(500):
        try:
            if parens and terms_n == 3:
                terms, ops = _gen_three_term(rng, int_max, decimals)
                # ÷ は括弧外側で使ってもよいが、簡易化のため除外
                if "/" in ops:
                    continue
                # 括弧の場合は ÷ を 1 箇所許可（最後の op）してもよいが、まず ÷ なしで
                result = _eval_with_paren(terms, ops)
                latex = _build_latex_with_parens(terms, ops)
            elif terms_n == 3:
                terms, ops = _gen_three_term(rng, int_max, decimals)
                result = _eval_with_precedence(terms, ops)
                latex = _build_latex_no_parens(terms, ops)
            else:
                terms, ops = _gen_two_term(rng, int_max, decimals)
                result = _eval_with_precedence(terms, ops)
                latex = _build_latex_no_parens(terms, ops)
        except ZeroDivisionError:
            continue
        if result <= 0:
            continue
        if not is_finite_decimal(result):
            continue
        if abs(result) > 200:
            continue
        # Band A は「小数四則混合」の導入として、答えが小数になる組合せのみ採用
        # （`1.2 + 5.8 = 7` のような整数答えは除外）。Band B/C は教育的多様性として許容。
        if band == "A" and result.q == 1:
            continue

        canonical = av.canonical_decimal_for_rational(result)
        allowed = av.variants_for_decimal_answer(result)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 17,
                "band": band,
                "terms_p_q": [(int(t.p), int(t.q)) for t in terms],
                "ops": ops,
                "parens": parens,
                "value_p": int(result.p),
                "value_q": int(result.q),
            },
        }
    raise RuntimeError(f"rank 17 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    terms = [sp.Rational(p, q) for p, q in meta["terms_p_q"]]
    expected = sp.Rational(meta["value_p"], meta["value_q"])
    if meta.get("parens") and len(terms) == 3:
        recomputed = _eval_with_paren(terms, meta["ops"])
    else:
        recomputed = _eval_with_precedence(terms, meta["ops"])
    if recomputed != expected:
        return False
    if av.canonical_decimal_for_rational(expected) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
