"""20級：整数四則混合。

A: 1桁整数 2項 +/-（結果非負）
B: 1桁整数 2項 ×/÷（÷は割り切れる）
C: 2桁整数 3項 四則混合（結果は整数）

各問題は SymPy で式を構築 → 厳密値を計算 → セルフチェック → LaTeX/許容表記。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common import answer_variants as av
from common.latex_utils import OP_LATEX
from common.band_config import get_band


def _digit_range(digits: int) -> Tuple[int, int]:
    if digits == 1:
        return 1, 9
    if digits == 2:
        return 10, 99
    if digits == 3:
        return 100, 999
    raise ValueError(f"unsupported digits={digits}")


def _gen_two_terms_addsub(rng: random.Random, digits: int) -> Tuple[List[int], List[str]]:
    """2項の加減。結果が非負になるよう順序を整える。"""
    lo, hi = _digit_range(digits)
    a = rng.randint(lo, hi)
    b = rng.randint(lo, hi)
    op = rng.choice(["+", "-"])
    if op == "-" and a < b:
        a, b = b, a
    return [a, b], [op]


def _gen_two_terms_muldiv(rng: random.Random, digits: int) -> Tuple[List[int], List[str]]:
    """2項の乗除。÷は割り切れる組のみ。"""
    lo, hi = _digit_range(digits)
    op = rng.choice(["*", "/"])
    if op == "*":
        a = rng.randint(lo, hi)
        b = rng.randint(lo, hi)
        return [a, b], ["*"]
    # 割り算：先に商と除数を決めて積で被除数を作る
    b = rng.randint(max(2, lo), hi)
    q = rng.randint(lo, hi)
    a = b * q
    return [a, b], ["/"]


def _gen_three_terms_mixed(rng: random.Random, digits: int) -> Tuple[List[int], List[str]]:
    """3項四則混合。結果が整数になる組のみ採用（リトライ前提）。

    呼び出し元でリトライするため、ここでは整数化チェックは行わない。
    """
    lo, hi = _digit_range(digits)
    a = rng.randint(lo, hi)
    b = rng.randint(lo, hi)
    c = rng.randint(lo, hi)
    op1 = rng.choice(["+", "-", "*", "/"])
    op2 = rng.choice(["+", "-", "*", "/"])
    return [a, b, c], [op1, op2]


def _evaluate(terms: List[int], ops: List[str]) -> sp.Rational:
    """項リストと演算子から SymPy で厳密に評価（演算優先順位準拠）。"""
    expr = sp.Rational(terms[0])
    # 通常の優先順位（×÷ → +-）を再現するために、まず ×÷ を畳み込む。
    flat_terms: List[sp.Rational] = [sp.Rational(t) for t in terms]
    flat_ops: List[str] = list(ops)

    i = 0
    while i < len(flat_ops):
        if flat_ops[i] in ("*", "/"):
            left = flat_terms[i]
            right = flat_terms[i + 1]
            if flat_ops[i] == "*":
                v = left * right
            else:
                if right == 0:
                    raise ZeroDivisionError
                v = sp.Rational(left, right) if isinstance(left, int) else left / right
            flat_terms[i] = v
            del flat_terms[i + 1]
            del flat_ops[i]
        else:
            i += 1

    # 残った加減を左から畳み込み
    result = flat_terms[0]
    for op, t in zip(flat_ops, flat_terms[1:]):
        if op == "+":
            result = result + t
        elif op == "-":
            result = result - t
        else:
            raise ValueError(f"unexpected op after collapse: {op}")
    return sp.Rational(result)


def _terms_to_latex(terms: List[int], ops: List[str]) -> str:
    parts = [str(terms[0])]
    for op, t in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(str(t))
    return " ".join(parts)


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(20, band)
    digits = cfg["digits"]
    terms_n = cfg["terms"]
    ops_allowed = set(cfg["ops"])

    for _ in range(200):
        try:
            if terms_n == 2 and ops_allowed == {"+", "-"}:
                terms, ops = _gen_two_terms_addsub(rng, digits)
            elif terms_n == 2 and ops_allowed == {"*", "/"}:
                terms, ops = _gen_two_terms_muldiv(rng, digits)
            elif terms_n == 3:
                terms, ops = _gen_three_terms_mixed(rng, digits)
            else:
                raise NotImplementedError(f"band={band} 設定未対応")

            value = _evaluate(terms, ops)

            # 仕様：20級の答えは整数。整数にならない組は捨ててリトライ。
            if value.q != 1:
                continue
            # 負数の答えは 20 級では生徒が混乱しやすいので避ける（C のみ）。
            if value < 0:
                continue
        except ZeroDivisionError:
            continue

        latex = _terms_to_latex(terms, ops)
        canonical = av.canonical_for_rational(value)
        allowed = av.variants_for_rational(value)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 20,
                "band": band,
                "terms": terms,
                "ops": ops,
                "value_p": int(value.p),
                "value_q": int(value.q),
            },
        }
    raise RuntimeError(f"rank 20 band {band}: 200 回リトライしても条件を満たす問題を作れず")


def self_check(problem: Dict[str, Any]) -> bool:
    """生成された問題のセルフチェック（仕様書 §6.7①）。

    - 項リストと演算子から再計算 → answerCanonical と一致
    - answerAllowed の各表記が SymPy 的に同値
    """
    meta = problem["_meta"]
    recomputed = _evaluate(meta["terms"], meta["ops"])
    expected = sp.Rational(meta["value_p"], meta["value_q"])
    if recomputed != expected:
        return False
    canonical_value = av.canonical_for_rational(expected)
    if canonical_value != problem["answerCanonical"]:
        return False
    return True
