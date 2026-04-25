# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""12級：正負の数 乗除（仕様書 §6.5）。

A: 1桁 2項 ×/÷（割り切れる組のみ）
B: 累乗を含む単独項 (-3)^2、-3^2 など
C: 3項 ×/÷

D 以降の累乗と分数の混在は Phase 3 以降。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import OP_LATEX, signed_int_latex_paren, signed_int_latex_leading, power_latex
from common.sympy_helpers import assert_problem_fractions_in_lowest_terms


def _signed_int(rng: random.Random, max_abs: int, min_abs: int = 1) -> int:
    """±[min_abs..max_abs] からランダムに 1 つ。

    乗除の項としては ``min_abs=2`` を渡して ±1 を弾くことで、`× (+1)` のような
    自明な項を避けるのを推奨。
    """
    while True:
        v = rng.randint(-max_abs, max_abs)
        if abs(v) < min_abs:
            continue
        return v


def _signed_paren_or_leading(n: int, leading: bool) -> str:
    """先頭項なら符号付きそのまま、2項目以降は (+/-n) で囲む。"""
    if leading:
        return signed_int_latex_leading(n)
    return signed_int_latex_paren(n)


def _gen_muldiv(rng, max_abs, terms_n):
    """正負の整数 terms_n 項の ×/÷。最終結果が整数（割り切れる）になる組を返す。"""
    op_choices = ["*", "/"]
    while True:
        terms = []
        ops = []
        # 商と除数を先に決めてから被除数を逆算する戦略は複雑なので、
        # ここは「全演算が割り切れる」よう、各 / の右辺が左辺を割り切る整数になるよう
        # ステップごとに調整する。
        cur = _signed_int(rng, max_abs, min_abs=2)
        terms.append(cur)
        for _ in range(terms_n - 1):
            op = rng.choice(op_choices)
            if op == "*":
                t = _signed_int(rng, max_abs, min_abs=2)
                cur = cur * t
            else:
                # ÷：cur を割り切る整数 t を選ぶ（±1 を除外）
                divisors = [
                    d for d in range(-max_abs, max_abs + 1)
                    if abs(d) >= 2 and cur % d == 0
                ]
                if not divisors:
                    break
                t = rng.choice(divisors)
                cur = cur // t
            terms.append(t)
            ops.append(op)
        else:
            if cur == 0 or abs(cur) > max_abs ** terms_n:
                continue
            return terms, ops, cur


def _build_muldiv_latex(terms: List[int], ops: List[str]) -> str:
    parts = [_signed_paren_or_leading(terms[0], leading=True)]
    for op, t in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(_signed_paren_or_leading(t, leading=False))
    return " ".join(parts)


def _gen_power(rng, max_abs, exp_max):
    """累乗単項：(-3)^2、-3^2、5^2 など。

    紙教材の流れに沿い、いくつかのパターンを混ぜる：
      pattern1: (signed)^exp        e.g., (-3)^{2} → 9
      pattern2: -base^exp           e.g., -3^{2} → -9
      pattern3: base^exp            e.g., 4^{2} → 16
    """
    base_abs = rng.randint(2, max_abs)
    exp = rng.randint(2, exp_max)
    pattern = rng.choice(["paren_signed", "leading_minus", "positive"])
    if pattern == "paren_signed":
        # (-base)^exp（負のときのみ括弧、正なら裸の `base^exp`）
        sign = rng.choice([-1, 1])
        base_signed = sign * base_abs
        latex = power_latex(
            signed_int_latex_leading(base_signed), exp, base_is_signed=(base_signed < 0)
        )
        result = base_signed ** exp
    elif pattern == "leading_minus":
        # -base^exp = -(base^exp)
        latex = "-" + power_latex(str(base_abs), exp)
        result = -(base_abs ** exp)
    else:
        latex = power_latex(str(base_abs), exp)
        result = base_abs ** exp
    return latex, result, {"pattern": pattern, "base_abs": base_abs, "exp": exp}


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(12, band)
    kind = cfg["kind"]
    max_abs = cfg["max_abs"]

    if kind == "powers":
        for _ in range(200):
            latex, result, info = _gen_power(rng, max_abs, cfg["exp_max"])
            if result == 0:
                continue
            canonical = av.canonical_for_rational(sp.Rational(result))
            allowed = av.variants_for_rational(sp.Rational(result))
            return {
                "problemLatex": latex,
                "answerCanonical": canonical,
                "answerAllowed": allowed,
                "_meta": {
                    "rank": 12,
                    "band": band,
                    "kind": "powers",
                    "result": result,
                    **info,
                },
            }
        raise RuntimeError(f"rank 12 band {band}: power gen exhausted")

    # muldiv（A/C）
    terms_n = cfg["terms"]
    for _ in range(500):
        terms, ops, result = _gen_muldiv(rng, max_abs, terms_n)
        if result == 0:
            continue
        latex = _build_muldiv_latex(terms, ops)
        canonical = av.canonical_for_rational(sp.Rational(result))
        allowed = av.variants_for_rational(sp.Rational(result))
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 12,
                "band": band,
                "kind": "muldiv",
                "terms": terms,
                "ops": ops,
                "result": result,
            },
        }
    raise RuntimeError(f"rank 12 band {band}: muldiv gen exhausted")


def _eval_muldiv(terms, ops):
    cur = terms[0]
    for op, t in zip(ops, terms[1:]):
        if op == "*":
            cur = cur * t
        else:
            cur = cur // t  # 割り切れる前提
    return cur


def _eval_power(info):
    base_abs = info["base_abs"]
    exp = info["exp"]
    pat = info["pattern"]
    if pat == "paren_signed":
        # signed の base が分からないので latex から復元できないが、
        # _meta["result"] を直接信用する設計でもある。安全側で result を再構成しないが、
        # self_check では _meta["result"] と canonical の整合のみ検証。
        return None
    if pat == "leading_minus":
        return -(base_abs ** exp)
    return base_abs ** exp


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    expected = meta["result"]
    if meta["kind"] == "muldiv":
        if _eval_muldiv(meta["terms"], meta["ops"]) != expected:
            return False
    else:
        recomputed = _eval_power(meta)
        if recomputed is not None and recomputed != expected:
            return False
    if av.canonical_for_rational(sp.Rational(expected)) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
