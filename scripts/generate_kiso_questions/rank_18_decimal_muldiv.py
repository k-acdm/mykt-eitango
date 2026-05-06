# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""18級：小数 乗除（仕様書 §6.5）。

Phase 1（2026-05-07 夜）: 30→50 題化、Band D を新設して 4 Band 構成に。

A: 整数 × 小数 / 整数 ÷ 小数 / 小数 ÷ 整数（割り切れる組のみ）15 問
   subcounts={"mul": 8, "div": 7}
B: 小数 × 小数 / 小数 ÷ 小数（小さめ）15 問
   subcounts={"mul": 8, "div": 7}
C: 小数 × 小数 / 小数 ÷ 小数（やや大きめ）10 問
   subcounts={"mul": 5, "div": 5}
D: 答えが整数になる muldiv（新設、slot_index 駆動）10 問
   subcounts={"mul_int_ans": 5, "div_int_ans": 5}
   - mul_int_ans: 5 × 0.6 = 3 / 20 × 0.25 = 5 系（位置先頭/末尾両方）
   - div_int_ans: 12 ÷ 1.5 = 8 / 6 ÷ 0.5 = 12 系（中学算数の躓きポイント）

割り切れない割り算は出さない（仕様書 §6.5：厳密値のみ）。
被除数 = 除数 × 商 で先に商を決め、戻して被除数を作る。

# TODO_PHASE3: 以下は Phase 3 で導入予定（rank_18）
#   1. 4 項以上の乗除
#   2. 小数 × 分数の混在（rank_17 領域）
#   3. 「割り切れない割り算」（小数の循環）— 仕様書 §6.5 厳密値原則のため入れない
#   4. rank_15 Band D との部分構造重複（共に整数答え muldiv）→ Phase 1 では
#      分数 vs 小数で文脈分離されるため許容
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Optional, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import OP_LATEX, decimal_latex
from common.sympy_helpers import (
    is_finite_decimal,
    assert_problem_fractions_in_lowest_terms,
)


# --- 既存ヘルパー（無修正） -------------------------------------------------

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


def _evaluate(terms: List[sp.Rational], ops: List[str]) -> sp.Rational:
    result = terms[0]
    for op, t in zip(ops, terms[1:]):
        result = result * t if op == "*" else result / t
    return sp.Rational(result)


# --- 既存 generator（演算子強制版に書き換え、ロジック本体は温存） -----------

def _gen_int_x_dec_with_op(
    rng: random.Random, int_max: int, decimals: int, op: str,
) -> Optional[Tuple[List[sp.Rational], List[str]]]:
    """整数 × 小数 / 整数 ÷ 小数 / 小数 ÷ 整数（演算子強制版）。

    op: "*" or "/"
    """
    if op == "*":
        # 整数 × 小数（順序ランダム）
        a = sp.Rational(rng.randint(2, max(2, int_max)))
        b = _gen_decimal_simple(rng, int_max, decimals)
        if rng.random() < 0.5:
            a, b = b, a
        return [a, b], ["*"]
    # 割り算：商 q と除数 d を先に決め、被除数 = q * d
    # 「小数 ÷ 整数（割り切れる）」と「整数 ÷ 整数で商が小数」の 2 系統
    q = _gen_decimal_simple(rng, int_max, decimals)
    d = sp.Rational(rng.randint(2, int_max))
    a = q * d  # 小数（or たまたま整数）
    return [a, d], ["/"]


def _gen_dec_x_dec_with_op(
    rng: random.Random, int_max: int, decimals: int, op: str,
) -> Tuple[List[sp.Rational], List[str]]:
    """小数 × 小数 / 小数 ÷ 小数（演算子強制版）。"""
    if op == "*":
        a = _gen_decimal_simple(rng, int_max, decimals)
        b = _gen_decimal_simple(rng, int_max, decimals)
        return [a, b], ["*"]
    # 商と除数を先に決めて、被除数 = 商 × 除数
    q = _gen_decimal_simple(rng, int_max, decimals)
    d = _gen_decimal_simple(rng, int_max, decimals)
    a = q * d
    return [a, d], ["/"]


# --- Band D 用ヘルパー：答えが整数になる小数乗除 ----------------------------

def _gen_mul_int_ans(
    rng: random.Random, int_max: int, decimals: int, int_first: bool,
) -> Optional[Tuple[List[sp.Rational], List[str]]]:
    """Band D mul_int_ans: 「整数 × 小数 = 整数」になる組を生成。

    例: 5 × 0.6 = 3 / 20 × 0.25 = 5 / 0.4 × 25 = 10
    int_first: True なら整数先頭、False なら小数先頭

    実装: 0.<frac>（既約後の denom = scale/g, numerator = frac/g）に対して
    k * (frac/scale) が整数になるには k が scale/g の倍数であればよい。
    k = (scale/g) * m （m は整数）と置けば、結果は frac/g * m で必ず整数。
    """
    from math import gcd
    scale = 10 ** decimals
    # 小数部 frac を選ぶ（末尾ゼロ排除、非零）
    while True:
        frac = rng.randint(1, scale - 1)
        if frac % 10 != 0:
            break
    int_part_dec = rng.randint(0, 9)  # 小数の整数部（0..9）
    # 0.<frac> 部分の既約 denom = scale / g（小数部分のみで議論）
    g = gcd(frac + int_part_dec * scale, scale)
    denom = scale // g
    # k は denom の倍数。k <= int_max
    if denom > int_max:
        return None
    multiplier = rng.randint(1, int_max // denom)
    k = denom * multiplier
    if k < 2:
        return None
    dec = sp.Rational(int_part_dec * scale + frac, scale)
    if dec == 0:
        return None
    int_term = sp.Rational(k)
    if int_first:
        terms = [int_term, dec]
    else:
        terms = [dec, int_term]
    return terms, ["*"]


def _gen_div_int_ans(
    rng: random.Random, int_max: int, decimals: int,
) -> Optional[Tuple[List[sp.Rational], List[str]]]:
    """Band D div_int_ans: 「整数 ÷ 小数 = 整数」になる組を生成。

    例: 12 ÷ 1.5 = 8 / 6 ÷ 0.5 = 12 / 9 ÷ 0.3 = 30
    実装: 商 q（整数）× 除数 d（小数）= 被除数。被除数が整数になるには
    d の既約分母で q を割り切れる必要がある（q は denom の倍数）。
    int_max は被除数（整数）の上限と q の上限の両方に効く。
    """
    from math import gcd
    scale = 10 ** decimals
    while True:
        frac = rng.randint(1, scale - 1)
        if frac % 10 != 0:
            break
    int_part_dec = rng.randint(0, 9)  # 除数の整数部
    full = int_part_dec * scale + frac  # 既約前の分子
    g = gcd(full, scale)
    denom = scale // g
    if denom > int_max:
        return None
    # 商 q は denom の倍数（q * full/scale が整数になるため）
    # q は 2..int_max の範囲、被除数 = q * (full/scale) も int_max 以下
    q_max = min(int_max // denom, 30)  # 商上限
    if q_max < 2:
        return None
    multiplier = rng.randint(2, max(2, q_max))
    q = denom * (multiplier // denom) if multiplier % denom != 0 else multiplier
    if q < 2:
        return None
    # multiplier から q を再構築
    # シンプルに: q = denom * 任意整数
    q_factor = rng.randint(1, max(1, q_max // denom))
    q = denom * q_factor
    if q < 2:
        return None
    dec = sp.Rational(full, scale)
    if dec == 0:
        return None
    dividend = sp.Rational(q) * dec  # 被除数
    if dividend.q != 1:
        return None  # 念のため
    if dividend.p < 2 or dividend.p > int_max:
        return None
    terms = [dividend, dec]
    return terms, ["/"]


# --- slot_index 駆動 dispatcher -------------------------------------------

def _resolve_band_abc_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """A/B/C 共通：slot_index → "mul" / "div"。"""
    mul_total = subcounts.get("mul", 0)
    if slot_index < mul_total:
        return "mul"
    return "div"


def _resolve_band_d_subkind(
    slot_index: int, subcounts: Dict[str, int]
) -> Tuple[str, int]:
    """slot_index → (subkind, sub_slot_index)。

    subkind ∈ {"mul_int_ans", "div_int_ans"}。
    sub_slot_index は subkind 内での 0-based 位置（int_first 判定に使用）。
    """
    cumulative = 0
    for subkind in ("mul_int_ans", "div_int_ans"):
        c = subcounts.get(subkind, 0)
        if c == 0:
            continue
        if slot_index < cumulative + c:
            return subkind, slot_index - cumulative
        cumulative += c
    return "div_int_ans", slot_index - cumulative


# --- generate_problem -------------------------------------------------------

def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    全 Band で slot_index 駆動：
      A: slot 0-7=mul, 8-14=div（演算子均等強制）
      B: slot 0-7=mul, 8-14=div
      C: slot 0-4=mul, 5-9=div
      D: slot 0-4=mul_int_ans（位置先頭/末尾を交互）, 5-9=div_int_ans
    """
    cfg = get_band(18, band)
    kind = cfg["kind"]
    int_max = cfg["int_max"]
    subcounts = cfg.get("subcounts", {})

    forced_op: Optional[str] = None
    forced_subkind: Optional[str] = None
    sub_slot: int = 0

    if band in ("A", "B", "C"):
        forced_subkind = _resolve_band_abc_subkind(slot_index, subcounts)
        forced_op = "*" if forced_subkind == "mul" else "/"
    elif band == "D":
        forced_subkind, sub_slot = _resolve_band_d_subkind(slot_index, subcounts)
    else:
        raise NotImplementedError(f"rank 18 band {band}")

    for _ in range(500):
        if kind == "int_x_dec":
            decimals = cfg["decimals"]
            res = _gen_int_x_dec_with_op(rng, int_max, decimals, forced_op)
            if res is None:
                continue
            terms, ops = res
            meta_kind = forced_subkind  # "mul" / "div"
        elif kind == "dec_x_dec":
            decimals = cfg["decimals"]
            terms, ops = _gen_dec_x_dec_with_op(rng, int_max, decimals, forced_op)
            meta_kind = forced_subkind
        elif kind == "int_ans_muldiv":
            decimals_options = cfg.get("decimals_options", [1, 2])
            decimals = rng.choice(decimals_options)
            if forced_subkind == "mul_int_ans":
                # int_first を sub_slot で交互（偶数 slot は整数先頭、奇数は小数先頭）
                int_first = (sub_slot % 2 == 0)
                res = _gen_mul_int_ans(rng, int_max, decimals, int_first)
            else:  # div_int_ans
                res = _gen_div_int_ans(rng, int_max, decimals)
            if res is None:
                continue
            terms, ops = res
            meta_kind = forced_subkind
        else:
            raise NotImplementedError(kind)

        result = _evaluate(terms, ops)
        if result <= 0:
            continue
        if not is_finite_decimal(result):
            continue
        # 結果サイズガード（教育的価値）
        if abs(result) > 100 or abs(result) < sp.Rational(1, 1000):
            continue
        # Band D 整数答え強制
        if kind == "int_ans_muldiv" and result.q != 1:
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
                "kind": meta_kind,
                "terms_p_q": [(int(t.p), int(t.q)) for t in terms],
                "ops": ops,
                "value_p": int(result.p),
                "value_q": int(result.q),
            },
        }
    raise RuntimeError(f"rank 18 band {band}: 500 retries exhausted")


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
    # Band A/B/C の演算子整合性
    if meta.get("kind") == "mul":
        if meta["ops"] != ["*"]:
            return False
    elif meta.get("kind") == "div":
        if meta["ops"] != ["/"]:
            return False
    # Band D 検証：答えが整数 + 構造整合
    elif meta.get("kind") == "mul_int_ans":
        if expected.q != 1:
            return False
        if meta["ops"] != ["*"]:
            return False
        # 整数項と小数項の両方を含む
        has_int = any(t.q == 1 for t in terms)
        has_dec = any(t.q != 1 for t in terms)
        if not (has_int and has_dec):
            return False
    elif meta.get("kind") == "div_int_ans":
        if expected.q != 1:
            return False
        if meta["ops"] != ["/"]:
            return False
        # 構造：整数 ÷ 小数 = 整数
        if terms[0].q != 1:
            return False
        if terms[1].q == 1:
            return False
    return True
