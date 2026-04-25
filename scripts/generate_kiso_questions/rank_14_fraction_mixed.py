# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""14級：分数 四則混合（仕様書 §6.5）。

A: 2項 四則混合（+/-/×/÷）
B: 3項 四則混合（括弧なし、優先順位で計算）
C: 3項 四則混合（括弧あり）

D 以降の帯分数・小数混在は Phase 3。
§6.4.0 既約性原則：問題式の各分数は GCD=1。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import frac_latex_raw, OP_LATEX, paren_expr_latex
from common.sympy_helpers import (
    pick_coprime_numerator,
    assert_problem_fractions_in_lowest_terms,
)


def _gen_fraction(rng: random.Random, denom_max: int) -> Tuple[int, int]:
    d = rng.randint(2, denom_max)
    n = pick_coprime_numerator(rng, d)
    return n, d


def _eval_with_precedence(terms: List[Tuple[int, int]], ops: List[str]) -> sp.Rational:
    """×÷ → +- の優先順位で左結合畳み込み。"""
    flat_terms = [sp.Rational(*t) for t in terms]
    flat_ops = list(ops)
    i = 0
    while i < len(flat_ops):
        if flat_ops[i] in ("*", "/"):
            l, r = flat_terms[i], flat_terms[i + 1]
            v = l * r if flat_ops[i] == "*" else (l / r if r != 0 else None)
            if v is None:
                raise ZeroDivisionError
            flat_terms[i] = v
            del flat_terms[i + 1]
            del flat_ops[i]
        else:
            i += 1
    result = flat_terms[0]
    for op, t in zip(flat_ops, flat_terms[1:]):
        result = result + t if op == "+" else result - t
    return sp.Rational(result)


def _eval_with_paren(terms, ops):
    """先頭 2 項を括弧優先で評価して 3 項目と合わせる。"""
    a, b, c = [sp.Rational(*t) for t in terms]
    op1, op2 = ops
    if op1 == "+":
        inner = a + b
    elif op1 == "-":
        inner = a - b
    elif op1 == "*":
        inner = a * b
    else:
        inner = a / b if b != 0 else None
    if inner is None:
        raise ZeroDivisionError
    if op2 == "+":
        return inner + c
    if op2 == "-":
        return inner - c
    if op2 == "*":
        return inner * c
    if c == 0:
        raise ZeroDivisionError
    return inner / c


def _build_no_parens(terms, ops):
    parts = [frac_latex_raw(*terms[0])]
    for op, t in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(frac_latex_raw(*t))
    return " ".join(parts)


def _build_with_parens(terms, ops):
    a, b, c = terms
    op1, op2 = ops
    inner = f"{frac_latex_raw(*a)} {OP_LATEX[op1]} {frac_latex_raw(*b)}"
    return f"{paren_expr_latex(inner)} {OP_LATEX[op2]} {frac_latex_raw(*c)}"


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(14, band)
    kind = cfg["kind"]
    denom_max = cfg["denom_max"]

    for _ in range(500):
        try:
            if kind == "two_term":
                terms = [_gen_fraction(rng, denom_max) for _ in range(2)]
                ops = [rng.choice(["+", "-", "*", "/"])]
                result = _eval_with_precedence(terms, ops)
                latex = _build_no_parens(terms, ops)
            elif kind == "three_term_no_parens":
                terms = [_gen_fraction(rng, denom_max) for _ in range(3)]
                ops = [rng.choice(["+", "-", "*", "/"]) for _ in range(2)]
                result = _eval_with_precedence(terms, ops)
                latex = _build_no_parens(terms, ops)
            elif kind == "three_term_parens":
                terms = [_gen_fraction(rng, denom_max) for _ in range(3)]
                ops = [rng.choice(["+", "-", "*", "/"]) for _ in range(2)]
                result = _eval_with_paren(terms, ops)
                latex = _build_with_parens(terms, ops)
            else:
                raise NotImplementedError(kind)
        except ZeroDivisionError:
            continue

        if result <= 0:
            continue
        if result == 0:
            continue
        # 結果が 1 の自明な問題を弾く
        if result == 1:
            continue
        # あまりに巨大 / 微小な結果は教育的でないので除外
        if abs(result) > 1000 or abs(result) < sp.Rational(1, 10000):
            continue

        canonical = av.canonical_for_rational(result)
        allowed = av.variants_for_rational(result)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 14,
                "band": band,
                "kind": kind,
                "terms": [list(t) for t in terms],
                "ops": ops,
                "value_p": int(result.p),
                "value_q": int(result.q),
            },
        }
    raise RuntimeError(f"rank 14 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    terms = [tuple(t) for t in meta["terms"]]
    expected = sp.Rational(meta["value_p"], meta["value_q"])
    if meta["kind"] == "three_term_parens":
        recom = _eval_with_paren(terms, meta["ops"])
    else:
        recom = _eval_with_precedence(terms, meta["ops"])
    if recom != expected:
        return False
    if av.canonical_for_rational(expected) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
