# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""12級：正負の数 乗除（仕様書 §6.5）。

Phase 1（2026-05-05）: 30→50 題に拡充、Band B を構造改革（unique pool 24→48）。

A: 1桁 2項 ×/÷ 15 問（割り切れる組のみ）
B: 累乗 15 問（**slot_index 駆動の決定論的 3 サブパターン分離**）
   - subcounts={"paren_neg":5, "leading_minus":5, "positive":5}
   - 教育的並び：interleave 方式（slot 0,1,2 = (-3)²/-3²/3² 同形セット）
   - max_abs=9 / exp_max=3 / 結果ガード |result| ≤ 1000
C: 3項 ×/÷ 20 問（既存ロジック踏襲、count のみ +10）

中1 乗除の山場「(-3)² と -3² の違い」を slot_index 駆動で意識的に並べ、
生徒の典型ミスを認識訴求で予防する設計（ふくちさん 36 年塾長判断）。
TODO_PHASE3: 累乗と乗除の混合（(-3)²×4）、4 項以上、分数乗除は Phase 3 で導入。
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
    """累乗単項：(-3)^2、-3^2、5^2 など。後方互換用ラッパー。

    Phase 1 の Band B 構造改革（2026-05-05）以降は generate_problem 側で
    slot_index 駆動の 3 サブパターン分離（_gen_power_paren_neg /
    _gen_power_leading_minus / _gen_power_positive）に切り替えた。
    本関数は呼び出し元から外れたが、将来の他級流用のため温存する。

    紙教材の流れに沿い、いくつかのパターンを混ぜる：
      pattern1: (signed)^exp        e.g., (-3)^{2} → 9
      pattern2: -base^exp           e.g., -3^{2} → -9
      pattern3: base^exp            e.g., 4^{2} → 16
    """
    base_abs = rng.randint(2, max_abs)
    exp = rng.randint(2, exp_max)
    pattern = rng.choice(["paren_signed", "leading_minus", "positive"])
    if pattern == "paren_signed":
        sign = rng.choice([-1, 1])
        base_signed = sign * base_abs
        latex = power_latex(
            signed_int_latex_leading(base_signed), exp, base_is_signed=(base_signed < 0)
        )
        result = base_signed ** exp
    elif pattern == "leading_minus":
        latex = "-" + power_latex(str(base_abs), exp)
        result = -(base_abs ** exp)
    else:
        latex = power_latex(str(base_abs), exp)
        result = base_abs ** exp
    return latex, result, {"pattern": pattern, "base_abs": base_abs, "exp": exp}


# --- Band B 構造改革（Phase 1、2026-05-05）---------------------------------
# slot_index 駆動の決定論的 3 サブパターン分離：
#   paren_neg     : (-base)^exp   → 括弧付き負基底（中1 教科書の典型問題）
#   leading_minus : -base^exp     → 先頭マイナス（教育的躓きポイント）
#   positive      : base^exp      → 純粋累乗
# 教育的並び（interleave 方式）：slot 0/1/2 で (-3)²/-3²/3² を並べて違いを認識させる。
# パラメータ拡張：max_abs=5→9（base ∈ [2..9]）、exp_max=3 維持、結果ガード |r|≤1000。

def _gen_power_paren_neg(rng, max_abs, exp_max, max_result_abs):
    """`(-base)^exp` 形（必ず負基底のカッコ付き、結果は exp が偶数なら正・奇数なら負）。"""
    while True:
        base_abs = rng.randint(2, max_abs)
        exp = rng.randint(2, exp_max)
        result = (-base_abs) ** exp
        if abs(result) > max_result_abs or result == 0:
            continue
        latex = power_latex(
            signed_int_latex_leading(-base_abs), exp, base_is_signed=True
        )
        return latex, result, {
            "pattern": "paren_neg", "base_abs": base_abs, "exp": exp,
        }


def _gen_power_leading_minus(rng, max_abs, exp_max, max_result_abs):
    """`-base^exp` 形（leading minus、結果は常に負）。

    教育的に重要：(-3)² と -3² を比較するために必要なパターン。
    """
    while True:
        base_abs = rng.randint(2, max_abs)
        exp = rng.randint(2, exp_max)
        result = -(base_abs ** exp)
        if abs(result) > max_result_abs or result == 0:
            continue
        latex = "-" + power_latex(str(base_abs), exp)
        return latex, result, {
            "pattern": "leading_minus", "base_abs": base_abs, "exp": exp,
        }


def _gen_power_positive(rng, max_abs, exp_max, max_result_abs):
    """`base^exp` 形（pure positive、結果は常に正）。"""
    while True:
        base_abs = rng.randint(2, max_abs)
        exp = rng.randint(2, exp_max)
        result = base_abs ** exp
        if abs(result) > max_result_abs:
            continue
        latex = power_latex(str(base_abs), exp)
        return latex, result, {
            "pattern": "positive", "base_abs": base_abs, "exp": exp,
        }


def _resolve_band_b_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → "paren_neg" / "leading_minus" / "positive" の決定論的 dispatch。

    interleave 方式：subcounts の合計が count 全体（Phase 1 では 15）になることを
    前提に、3 種を順番に出す。例えば count=15, subcounts={paren_neg:5, leading_minus:5,
    positive:5} のとき：
      slot 0  → paren_neg     (例: (-3)^2 = 9)
      slot 1  → leading_minus (例: -3^2 = -9)
      slot 2  → positive      (例: 3^2 = 9)
      slot 3  → paren_neg     (次のサイクル開始)
      slot 4  → leading_minus
      slot 5  → positive
      ...
      slot 14 → positive
    各 cycle で 3 形式が並ぶことで「同じ base/exp の見え方の違い」を生徒が
    認識しやすい設計（ふくちさん 36 年塾長経験ベース）。
    """
    order = ["paren_neg", "leading_minus", "positive"]
    return order[slot_index % len(order)]


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    Band B（powers）のみ slot_index 駆動で 3 サブパターン（paren_neg / leading_minus
    / positive）を decision-deterministic に dispatch する。A/C は slot_index を無視。
    """
    cfg = get_band(12, band)
    kind = cfg["kind"]
    max_abs = cfg["max_abs"]

    if kind == "powers":
        max_result_abs = cfg.get("max_result_abs", 1000)
        sub = _resolve_band_b_subkind(slot_index, cfg.get("subcounts", {}))
        for _ in range(200):
            if sub == "paren_neg":
                latex, result, info = _gen_power_paren_neg(rng, max_abs, cfg["exp_max"], max_result_abs)
            elif sub == "leading_minus":
                latex, result, info = _gen_power_leading_minus(rng, max_abs, cfg["exp_max"], max_result_abs)
            elif sub == "positive":
                latex, result, info = _gen_power_positive(rng, max_abs, cfg["exp_max"], max_result_abs)
            else:
                raise NotImplementedError(f"unknown subkind: {sub}")
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

    # muldiv（A/C）— slot_index は無視（既存挙動温存）
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
    if pat == "paren_neg":
        # (-base)^exp
        return (-base_abs) ** exp
    if pat == "paren_signed":
        # 旧 _gen_power（後方互換ラッパー）の場合：sign が不明なため info["result"] を信用
        return None
    if pat == "leading_minus":
        return -(base_abs ** exp)
    # positive / 旧 positive
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
