"""16級：分数加減。

A: 同分母 2項 +/- （結果は既約分数 or 整数）
B: 異分母 2項 +/- （分母 ≤ 12）
C: 異分母 2項 +/- （分母 ≤ 15）

D 以降の帯分数・3項・小数混在は Phase 2 以降で実装。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common import answer_variants as av
from common.latex_utils import frac_latex_raw, OP_LATEX
from common.band_config import get_band


def _gen_addsub_pair_same_denom(
    rng: random.Random, denom_max: int
) -> Tuple[List[Tuple[int, int]], List[str]]:
    """同分母 2項。結果非負・既約分数 or 整数になる組を選ぶ。"""
    d = rng.randint(2, denom_max)
    a = rng.randint(1, d - 1)
    b = rng.randint(1, d - 1)
    op = rng.choice(["+", "-"])
    if op == "-" and a < b:
        a, b = b, a
    return [(a, d), (b, d)], [op]


def _gen_addsub_pair_diff_denom(
    rng: random.Random, denom_max: int
) -> Tuple[List[Tuple[int, int]], List[str]]:
    """異分母 2項。"""
    while True:
        d1 = rng.randint(2, denom_max)
        d2 = rng.randint(2, denom_max)
        if d1 == d2:
            continue
        n1 = rng.randint(1, d1 - 1)
        n2 = rng.randint(1, d2 - 1)
        op = rng.choice(["+", "-"])
        # 結果非負を保証
        if op == "-" and sp.Rational(n1, d1) < sp.Rational(n2, d2):
            n1, n2 = n2, n1
            d1, d2 = d2, d1
        return [(n1, d1), (n2, d2)], [op]


def _evaluate(terms: List[Tuple[int, int]], ops: List[str]) -> sp.Rational:
    result = sp.Rational(*terms[0])
    for op, (n, d) in zip(ops, terms[1:]):
        v = sp.Rational(n, d)
        if op == "+":
            result += v
        elif op == "-":
            result -= v
        else:
            raise ValueError(f"unsupported op: {op}")
    return sp.Rational(result)


def _terms_to_latex(terms: List[Tuple[int, int]], ops: List[str]) -> str:
    parts = [frac_latex_raw(*terms[0])]
    for op, (n, d) in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(frac_latex_raw(n, d))
    return " ".join(parts)


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(16, band)
    same_denom = cfg["same_denom"]
    terms_n = cfg["terms"]
    denom_max = cfg["denom_max"]

    for _ in range(300):
        if terms_n != 2:
            raise NotImplementedError("Phase 1 では 2 項のみ実装")
        if same_denom:
            terms, ops = _gen_addsub_pair_same_denom(rng, denom_max)
        else:
            terms, ops = _gen_addsub_pair_diff_denom(rng, denom_max)

        value = _evaluate(terms, ops)
        if value < 0:
            continue
        # 結果が 0 になる組は基礎計算では退屈なので避ける
        if value == 0:
            continue

        latex = _terms_to_latex(terms, ops)
        canonical = av.canonical_for_rational(value)
        allowed = av.variants_for_rational(value)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 16,
                "band": band,
                "terms": [list(t) for t in terms],
                "ops": ops,
                "value_p": int(value.p),
                "value_q": int(value.q),
            },
        }
    raise RuntimeError(f"rank 16 band {band}: 300 回リトライしても条件を満たす問題を作れず")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    terms = [tuple(t) for t in meta["terms"]]
    recomputed = _evaluate(terms, meta["ops"])
    expected = sp.Rational(meta["value_p"], meta["value_q"])
    if recomputed != expected:
        return False
    if av.canonical_for_rational(expected) != problem["answerCanonical"]:
        return False
    return True
