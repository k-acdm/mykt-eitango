# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""10級：単位・比・割合（仕様書 §6.5、Phase 2 グループ③）。

**他級と異なる構造**：10 問固定スロット制。Band A/B/C で 10 問生成する際、
スロット 1〜10 を順に 1 問ずつ出題する。`generate_problem(band, rng, slot_index=i)`
で i (0..9) → スロット (1..10) にマッピング。

スロット定義：
  1: 長さ単位換算（m, cm, mm, km）
  2: 面積単位換算 #1（㎡, ㎠, ha, a, k㎡）
  3: 面積単位換算 #2（同上、別パターン）
  4: 容積単位換算（L, mL, dL, ㎤）
  5: 重さ単位換算（kg, g, mg, t）
  6: 時間換算（時間, 分, 秒）
  7: 速さ換算（時速, 分速, 秒速）
  8: 比（a:b = c:? の空欄埋め）
  9: 割合相互変換（小数 ↔ % ↔ 割分厘）
  10: 割合応用（X の Y% は何 ？）

§6.4.0 既約性原則：スロット 8（比）は最簡比に統一（generate 時に gcd で約分）。
答え側は `canonical_decimal_for_rational` または `canonical_for_rational` 経由で
既約・有限小数優先を保証。
"""

from __future__ import annotations

import random
from math import gcd
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.sympy_helpers import (
    is_finite_decimal,
    rational_to_decimal_str,
    assert_problem_fractions_in_lowest_terms,
)


def _R(p, q=1) -> sp.Rational:
    return sp.Rational(p, q)


def _decimal_str(value: sp.Rational) -> str:
    """有限小数なら小数表記、整数なら整数、それ以外は仮分数。"""
    return av.canonical_decimal_for_rational(value)


def _build_unit_problem(value: sp.Rational, from_u: str, to_u: str) -> str:
    r"""``value\,\text{from} = \square\,\text{to}`` 形式の LaTeX。"""
    return f"{_decimal_str(value)}\\,\\text{{{from_u}}} = \\square\\,\\text{{{to_u}}}"


# ===========================================================================
# 各単位の現実的な数値範囲（教育的整合性を担保）
# ===========================================================================
# Phase 2 グループ③ で発見：Band C で k㎡ が 44709 のような非現実的な値になる
# のを防ぐため、各単位の典型的な数値域を明示し、生成時に強制する。
# Band 間の難易度差は「桁数・小数の有無・換算倍率の複雑さ」で出す。

UNIT_RANGES: Dict[str, Tuple[sp.Rational, sp.Rational]] = {
    # 長さ
    "km": (_R(1, 10), _R(100)),       # 0.1〜100 km
    "m":  (_R(1, 10), _R(10000)),
    "cm": (_R(1),     _R(10000)),
    "mm": (_R(1),     _R(10000)),
    # 面積
    "k㎡": (_R(1),    _R(100)),       # 市町村サイズまで
    "ha": (_R(1),     _R(10000)),
    "a":  (_R(1),     _R(10000)),
    "㎡": (_R(1),     _R(100000)),
    "㎠": (_R(1),     _R(1000000)),
    # 容積
    "kL": (_R(1, 10), _R(100)),
    "L":  (_R(1, 10), _R(1000)),
    "dL": (_R(1),     _R(10000)),
    "mL": (_R(1),     _R(10000)),
    "㎤": (_R(1),     _R(10000)),
    # 重さ
    "t":  (_R(1, 10), _R(100)),
    "kg": (_R(1, 10), _R(1000)),
    "g":  (_R(1),     _R(10000)),
    "mg": (_R(1),     _R(10000)),
}


def _pick_src_for_conv(
    band: str, rng: random.Random, from_u: str, to_u: str, factor: sp.Rational
) -> sp.Rational | None:
    """from_u → to_u の換算で、両単位とも UNIT_RANGES 内に収まる src を生成。

    Band ごとに値の形式（整数 / 1 桁小数 / 2 桁小数）を変えて難易度差を出す。
    有効な値が存在しなければ None を返す（呼び出し側でリトライ or fallback）。
    """
    src_lo, src_hi = UNIT_RANGES[from_u]
    tgt_lo, tgt_hi = UNIT_RANGES[to_u]
    # src と src*factor の両方が範囲内になる src の有効範囲
    eff_lo = max(src_lo, tgt_lo / factor)
    eff_hi = min(src_hi, tgt_hi / factor)
    if eff_lo > eff_hi:
        return None

    if band == "A":
        # 整数（1〜10 範囲で入門配慮）
        lo = max(int(sp.ceiling(eff_lo)), 1)
        hi = min(int(sp.floor(eff_hi)), 10)
        if lo > hi:
            return None
        return _R(rng.randint(lo, hi))
    if band == "B":
        # 1 桁小数 X.Y（末尾ゼロ避け）または 2 桁整数
        lo10 = max(int(sp.ceiling(eff_lo * 10)), 10)
        hi10 = min(int(sp.floor(eff_hi * 10)), 990)
        if lo10 > hi10:
            return None
        for _ in range(50):
            v = rng.randint(lo10, hi10)
            if v % 10 != 0:
                return _R(v, 10)
        return _R(lo10 + 5, 10) if (lo10 + 5) % 10 != 0 else _R(lo10, 10)
    # Band C：整数 or 1 桁小数（教育的に自然な値）。
    # 変動性は「大きな値」「逆方向変換で答えが小数」で出す（2 桁小数 src は
    # `671.71 mm` のような不自然な表記を生むため避ける）。
    use_decimal = rng.random() < 0.3  # 30% 1 桁小数、70% 整数
    if use_decimal:
        lo10 = max(int(sp.ceiling(eff_lo * 10)), 10)
        hi10 = int(sp.floor(eff_hi * 10))
        if lo10 > hi10:
            return None
        for _ in range(50):
            v = rng.randint(lo10, hi10)
            if v % 10 != 0:
                return _R(v, 10)
        return _R(lo10, 10)
    # 整数（範囲全体活用）
    lo = max(int(sp.ceiling(eff_lo)), 1)
    hi = int(sp.floor(eff_hi))
    if lo > hi:
        return None
    return _R(rng.randint(lo, hi))


# ===========================================================================
# Slot 1: 長さ単位換算
# ===========================================================================

LENGTH_CASES_AB = [
    ("m", "cm", _R(100)), ("km", "m", _R(1000)),
    ("cm", "mm", _R(10)), ("m", "mm", _R(1000)),
]
LENGTH_CASES_C = [
    ("cm", "m", _R(1, 100)), ("m", "km", _R(1, 1000)),
    ("mm", "m", _R(1, 1000)), ("mm", "cm", _R(1, 10)),
]


def _gen_slot_1_length(band: str, rng: random.Random):
    """長さ単位換算。UNIT_RANGES で現実的な値域を強制。"""
    cases = LENGTH_CASES_C if band == "C" else LENGTH_CASES_AB
    for _ in range(20):
        from_u, to_u, factor = rng.choice(cases)
        src = _pick_src_for_conv(band, rng, from_u, to_u, factor)
        if src is None:
            continue
        answer = src * factor
        problem_latex = _build_unit_problem(src, from_u, to_u)
        canonical = _decimal_str(answer)
        allowed = av.variants_for_decimal_answer(answer)
        return problem_latex, canonical, allowed, {
            "slot": 1, "src_p": src.p, "src_q": src.q,
            "factor_p": factor.p, "factor_q": factor.q,
            "from_u": from_u, "to_u": to_u,
        }
    raise RuntimeError(f"slot 1 band {band} retries exhausted")


# ===========================================================================
# Slot 2 / 3: 面積単位換算
# ===========================================================================

# 面積換算ファクター辞書（基本：1 ㎡ = 10000 ㎠ など）
AREA_FACTORS = {
    ("㎡", "㎠"): _R(10000),
    ("㎠", "㎡"): _R(1, 10000),
    ("ha", "㎡"): _R(10000),
    ("㎡", "ha"): _R(1, 10000),
    ("a", "㎡"): _R(100),
    ("㎡", "a"): _R(1, 100),
    ("k㎡", "㎡"): _R(1000000),
    ("㎡", "k㎡"): _R(1, 1000000),
    ("ha", "a"): _R(100),
    ("a", "ha"): _R(1, 100),
    ("k㎡", "ha"): _R(100),
}


# 面積換算の組み合わせ：Band A は易しめ、B/C は徐々に複雑な単位ペア
AREA_CASES_A = [("㎡", "㎠"), ("a", "㎡"), ("ha", "a")]
AREA_CASES_B = [("㎡", "㎠"), ("ha", "㎡"), ("k㎡", "㎡"), ("ha", "a")]
AREA_CASES_C = [("㎠", "㎡"), ("㎡", "ha"), ("k㎡", "ha"), ("a", "ha"), ("㎡", "a")]


def _gen_slot_area(band: str, rng: random.Random, slot_no: int):
    """面積換算。UNIT_RANGES で現実的な値域を強制。"""
    if band == "A":
        cases = AREA_CASES_A
    elif band == "B":
        cases = AREA_CASES_B
    else:
        cases = AREA_CASES_C
    for _ in range(30):
        from_u, to_u = rng.choice(cases)
        factor = AREA_FACTORS[(from_u, to_u)]
        src = _pick_src_for_conv(band, rng, from_u, to_u, factor)
        if src is None:
            continue
        answer = src * factor
        problem_latex = _build_unit_problem(src, from_u, to_u)
        canonical = _decimal_str(answer)
        allowed = av.variants_for_decimal_answer(answer)
        return problem_latex, canonical, allowed, {
            "slot": slot_no, "src_p": src.p, "src_q": src.q,
            "factor_p": factor.p, "factor_q": factor.q,
            "from_u": from_u, "to_u": to_u,
        }
    raise RuntimeError(f"slot {slot_no} band {band} retries exhausted")


def _gen_slot_2_area(band, rng):
    return _gen_slot_area(band, rng, 2)


def _gen_slot_3_area(band, rng):
    return _gen_slot_area(band, rng, 3)


# ===========================================================================
# Slot 4: 容積単位換算
# ===========================================================================

VOLUME_FACTORS = {
    ("L", "mL"): _R(1000),
    ("mL", "L"): _R(1, 1000),
    ("L", "dL"): _R(10),
    ("dL", "L"): _R(1, 10),
    ("L", "㎤"): _R(1000),
    ("㎤", "L"): _R(1, 1000),
    ("dL", "mL"): _R(100),
    ("dL", "㎤"): _R(100),
    ("mL", "㎤"): _R(1),  # 同じ
}


VOLUME_CASES_A = [("L", "mL"), ("L", "dL"), ("dL", "mL")]
VOLUME_CASES_B = [("L", "㎤"), ("L", "mL"), ("dL", "㎤")]
VOLUME_CASES_C = [("㎤", "L"), ("mL", "L"), ("dL", "L")]


def _gen_slot_4_volume(band, rng):
    """容積単位換算。UNIT_RANGES で現実的な値域を強制。"""
    if band == "A":
        cases = VOLUME_CASES_A
    elif band == "B":
        cases = VOLUME_CASES_B
    else:
        cases = VOLUME_CASES_C
    for _ in range(30):
        from_u, to_u = rng.choice(cases)
        factor = VOLUME_FACTORS[(from_u, to_u)]
        src = _pick_src_for_conv(band, rng, from_u, to_u, factor)
        if src is None:
            continue
        answer = src * factor
        problem_latex = _build_unit_problem(src, from_u, to_u)
        canonical = _decimal_str(answer)
        allowed = av.variants_for_decimal_answer(answer)
        return problem_latex, canonical, allowed, {
            "slot": 4, "src_p": src.p, "src_q": src.q,
            "factor_p": factor.p, "factor_q": factor.q,
            "from_u": from_u, "to_u": to_u,
        }
    raise RuntimeError(f"slot 4 band {band} retries exhausted")


# ===========================================================================
# Slot 5: 重さ単位換算
# ===========================================================================

WEIGHT_FACTORS = {
    ("kg", "g"): _R(1000),
    ("g", "kg"): _R(1, 1000),
    ("g", "mg"): _R(1000),
    ("mg", "g"): _R(1, 1000),
    ("t", "kg"): _R(1000),
    ("kg", "t"): _R(1, 1000),
    ("t", "g"): _R(1000000),
}


WEIGHT_CASES_A = [("kg", "g"), ("g", "mg"), ("t", "kg")]
WEIGHT_CASES_B = [("kg", "g"), ("t", "kg"), ("g", "mg")]
WEIGHT_CASES_C = [("g", "kg"), ("mg", "g"), ("kg", "t")]


def _gen_slot_5_weight(band, rng):
    """重さ単位換算。UNIT_RANGES で現実的な値域を強制。"""
    if band == "A":
        cases = WEIGHT_CASES_A
    elif band == "B":
        cases = WEIGHT_CASES_B
    else:
        cases = WEIGHT_CASES_C
    for _ in range(30):
        from_u, to_u = rng.choice(cases)
        factor = WEIGHT_FACTORS[(from_u, to_u)]
        src = _pick_src_for_conv(band, rng, from_u, to_u, factor)
        if src is None:
            continue
        answer = src * factor
        problem_latex = _build_unit_problem(src, from_u, to_u)
        canonical = _decimal_str(answer)
        allowed = av.variants_for_decimal_answer(answer)
        return problem_latex, canonical, allowed, {
            "slot": 5, "src_p": src.p, "src_q": src.q,
            "factor_p": factor.p, "factor_q": factor.q,
            "from_u": from_u, "to_u": to_u,
        }
    raise RuntimeError(f"slot 5 band {band} retries exhausted")


# ===========================================================================
# Slot 6: 時間換算
# ===========================================================================

def _gen_slot_6_time(band, rng):
    """時間 ↔ 分 ↔ 秒。1 時間 = 60 分、1 分 = 60 秒。"""
    if band == "A":
        # 整数の易しい変換：5 時間 → 何分、4 分 → 何秒、120 秒 → 何分
        cases = [
            ("時間", "分", _R(60), rng.randint(2, 9)),  # h→m
            ("分", "秒", _R(60), rng.randint(2, 9)),    # m→s
        ]
        from_u, to_u, factor, src_int = rng.choice(cases)
        src = _R(src_int)
    elif band == "B":
        # 小数や分数：3.2 時間 → 192 分、2.5 分 → 150 秒
        cases = [
            ("時間", "分", _R(60), _R(rng.randint(15, 50), 10)),
            ("分", "秒", _R(60), _R(rng.randint(15, 50), 10)),
        ]
        from_u, to_u, factor, src = rng.choice(cases)
    else:  # C：逆方向（分→時間で分数解、秒→分）
        cases = [
            ("分", "時間", _R(1, 60), _R(rng.choice([90, 120, 150, 180, 200]))),
            ("秒", "分", _R(1, 60), _R(rng.choice([120, 150, 180, 240, 300]))),
        ]
        from_u, to_u, factor, src = rng.choice(cases)
    answer = src * factor
    problem_latex = _build_unit_problem(src, from_u, to_u)
    # 答えは整数 / 有限小数 / 既約分数
    if answer.q == 1:
        canonical = av.canonical_for_rational(answer)
        allowed = av.variants_for_rational(answer)
    elif is_finite_decimal(answer):
        canonical = av.canonical_decimal_for_rational(answer)
        allowed = av.variants_for_decimal_answer(answer)
    else:
        canonical = av.canonical_for_rational(answer)
        allowed = av.variants_for_rational(answer)
    return problem_latex, canonical, allowed, {
        "slot": 6, "src_p": src.p, "src_q": src.q,
        "factor_p": factor.p, "factor_q": factor.q,
        "from_u": from_u, "to_u": to_u,
    }


# ===========================================================================
# Slot 7: 速さ換算
# ===========================================================================

def _gen_slot_7_speed(band, rng):
    """時速・分速・秒速の換算。1 時速 km = 1000/60 分速 m など。

    Band A: 時速 60km → 分速 1km、時速 120km → 分速 2km（綺麗な値）
    Band B: 時速 72km → 分速 1.2km
    Band C: 分速 → 秒速、複合変換
    """
    if band == "A":
        # 時速 X km → 分速 X/60 km、X が 60 の倍数。
        # 答えが 1〜10 の範囲で多様に出るよう、60 の倍数 1〜10 倍を全てカバー。
        multiples = [60, 120, 180, 240, 300, 360, 420, 480, 540, 600]
        cases = [
            ("時速", "分速", "km", "km", _R(1, 60), rng.choice(multiples[:6])),  # 1〜6 倍（時速 km は速度過大を避ける）
            ("分速", "秒速", "m", "m", _R(1, 60), rng.choice(multiples)),  # 1〜10 倍（分速 600m = 秒速 10m まで OK）
        ]
        a, b, ua, ub, factor, src_int = rng.choice(cases)
        src = _R(src_int)
        problem_latex = f"{a}{src_int}\\,\\text{{{ua}}} = {b}\\square\\,\\text{{{ub}}}"
    elif band == "B":
        # 時速 X km → 分速 何 m（× 1000/60）
        cases = [
            ("時速", "分速", "km", "m", _R(1000, 60), rng.choice([72, 120, 180])),
        ]
        a, b, ua, ub, factor, src_int = rng.choice(cases)
        src = _R(src_int)
        problem_latex = f"{a}{src_int}\\,\\text{{{ua}}} = {b}\\square\\,\\text{{{ub}}}"
    else:  # C
        # 分速 X m → 秒速 ? m
        cases = [
            ("分速", "秒速", "m", "m", _R(1, 60), rng.choice([60, 90, 120, 180])),
        ]
        a, b, ua, ub, factor, src_int = rng.choice(cases)
        src = _R(src_int)
        problem_latex = f"{a}{src_int}\\,\\text{{{ua}}} = {b}\\square\\,\\text{{{ub}}}"
    answer = src * factor
    if answer.q == 1:
        canonical = av.canonical_for_rational(answer)
        allowed = av.variants_for_rational(answer)
    elif is_finite_decimal(answer):
        canonical = av.canonical_decimal_for_rational(answer)
        allowed = av.variants_for_decimal_answer(answer)
    else:
        canonical = av.canonical_for_rational(answer)
        allowed = av.variants_for_rational(answer)
    return problem_latex, canonical, allowed, {
        "slot": 7, "src_p": src.p, "src_q": src.q,
        "factor_p": factor.p, "factor_q": factor.q,
        "from_u": ua, "to_u": ub, "src_int": src_int,
    }


# ===========================================================================
# Slot 8: 比（a:b = c:?）
# ===========================================================================

def _gen_slot_8_ratio(band, rng):
    """a:b = c:? の空欄埋め。a:b は最簡比（gcd=1）。

    Band A: 解が小整数になる組
    Band B: 解が 2 桁整数
    Band C: 解が分数になる組
    """
    if band == "A":
        # k 倍：a:b = (k*a):? → ? = k*b。a, b は互いに素、k は 2..5
        for _ in range(50):
            a = rng.randint(2, 6)
            b = rng.randint(2, 6)
            if gcd(a, b) != 1:
                continue
            k = rng.randint(2, 5)
            c = k * a
            answer = k * b
            problem_latex = f"{a}:{b} = {c}:\\square"
            canonical = av.canonical_for_rational(_R(answer))
            allowed = av.variants_for_rational(_R(answer))
            return problem_latex, canonical, allowed, {
                "slot": 8, "a": a, "b": b, "c": c, "answer": answer,
            }
    elif band == "B":
        # k 倍が大きい
        for _ in range(50):
            a = rng.randint(2, 9)
            b = rng.randint(2, 9)
            if gcd(a, b) != 1:
                continue
            k = rng.randint(5, 12)
            c = k * a
            answer = k * b
            problem_latex = f"{a}:{b} = {c}:\\square"
            canonical = av.canonical_for_rational(_R(answer))
            allowed = av.variants_for_rational(_R(answer))
            return problem_latex, canonical, allowed, {
                "slot": 8, "a": a, "b": b, "c": c, "answer": answer,
            }
    else:  # C: 答えが分数
        for _ in range(50):
            a = rng.randint(3, 9)
            b = rng.randint(2, 9)
            if gcd(a, b) != 1:
                continue
            c = rng.randint(2, a - 1)  # k が分数になるケース
            ans = _R(c * b, a)
            if ans.q == 1:
                continue  # 整数になるなら Band B
            problem_latex = f"{a}:{b} = {c}:\\square"
            canonical = av.canonical_for_rational(ans)
            allowed = av.variants_for_rational(ans)
            return problem_latex, canonical, allowed, {
                "slot": 8, "a": a, "b": b, "c": c,
                "answer_p": ans.p, "answer_q": ans.q,
            }
    raise RuntimeError(f"slot 8 band {band} retries exhausted")


# ===========================================================================
# Slot 9: 割合相互変換（小数 ↔ % ↔ 割分厘）
# ===========================================================================

def _gen_slot_9_ratio_conv(band, rng):
    """割合の相互変換。
    Band A: 0.5 → 何 % / 25% → 小数 / 0.6 → 何 割
    Band B: 0.125 → 何 % / 12.5% → 小数 / 0.85 → 何 割何 分
    Band C: 1.25 → 何 % / 3 割 5 分 → 何 % / 0.005 → 何 厘
    """
    if band == "A":
        cases = ["dec_to_pct_simple", "pct_to_dec_simple", "dec_to_wari"]
        ck = rng.choice(cases)
        if ck == "dec_to_pct_simple":
            # 0.5 → 何 %、答え 50
            dec_int = rng.choice([1, 2, 3, 4, 5, 6, 7, 8, 9])
            src = _R(dec_int, 10)
            answer = _R(dec_int * 10)
            problem_latex = f"{_decimal_str(src)} = \\square\\,\\%"
        elif ck == "pct_to_dec_simple":
            # 25% → 0.25
            pct_int = rng.choice([10, 20, 25, 30, 50, 75])
            src_pct = pct_int  # 表示用
            answer = _R(pct_int, 100)
            problem_latex = f"{src_pct}\\,\\% = \\square"
        else:  # dec_to_wari
            # 0.6 → 何割、答え 6
            dec_int = rng.choice([1, 2, 3, 4, 5, 6, 7, 8, 9])
            src = _R(dec_int, 10)
            answer = _R(dec_int)
            problem_latex = f"{_decimal_str(src)} = \\square\\,\\text{{割}}"
    elif band == "B":
        cases = ["dec_to_pct_2dec", "pct_to_dec_2dec"]
        ck = rng.choice(cases)
        if ck == "dec_to_pct_2dec":
            # 0.58 → 58%
            dec_int = rng.randint(11, 99)
            src = _R(dec_int, 100)
            answer = _R(dec_int)
            problem_latex = f"{_decimal_str(src)} = \\square\\,\\%"
        else:
            # 12.5% → 0.125
            pct_int = rng.choice([125, 175, 225, 375])  # 12.5%, 17.5% 等
            src_str = _decimal_str(_R(pct_int, 10))
            answer = _R(pct_int, 1000)
            problem_latex = f"{src_str}\\,\\% = \\square"
    else:  # C
        cases = ["dec_to_pct_over1", "wari_compound_to_pct"]
        ck = rng.choice(cases)
        if ck == "dec_to_pct_over1":
            # 1.25 → 125%
            dec_int = rng.randint(110, 250)
            src = _R(dec_int, 100)
            answer = _R(dec_int)
            problem_latex = f"{_decimal_str(src)} = \\square\\,\\%"
        else:
            # 3 割 5 分 → 35%（= 0.35 を %）
            wari = rng.randint(1, 9)
            bu = rng.randint(0, 9)
            answer = _R(wari * 10 + bu)
            problem_latex = f"{wari}\\,\\text{{割}}{bu}\\,\\text{{分}} = \\square\\,\\%"
    canonical = av.canonical_decimal_for_rational(answer)
    allowed = av.variants_for_decimal_answer(answer)
    return problem_latex, canonical, allowed, {
        "slot": 9, "answer_p": answer.p, "answer_q": answer.q,
    }


# ===========================================================================
# Slot 10: 割合応用（X の Y% は何 ？）
# ===========================================================================

def _gen_slot_10_application(band, rng):
    """割合の応用問題。
    Band A: X の Y% は何（綺麗な整数）
    Band B: X の P 割は何
    Band C: X は Y の何% か（逆問題）
    """
    if band == "A":
        # 200g の 30% → 60g
        x = rng.choice([100, 200, 400, 500, 800, 1000])
        pct = rng.choice([10, 20, 25, 30, 50, 75])
        answer = _R(x * pct, 100)
        unit = rng.choice(["g", "円", "m", "L"])
        problem_latex = f"{x}\\,\\text{{{unit}}} の {pct}\\,\\%は何\\,\\text{{{unit}}}？"
    elif band == "B":
        # 2000 円の 3 割 → 600 円
        x = rng.choice([100, 200, 500, 1000, 2000, 3000])
        wari = rng.randint(1, 9)
        answer = _R(x * wari, 10)
        unit = rng.choice(["円", "g", "m"])
        problem_latex = f"{x}\\,\\text{{{unit}}} の {wari}\\,\\text{{割}}は何\\,\\text{{{unit}}}？"
    else:  # C: 逆
        # 25g は 500g の何% か → 5%
        for _ in range(50):
            base = rng.choice([100, 200, 500, 1000])
            part = rng.randint(5, base)
            # part / base * 100 が綺麗な数になる組
            ratio = _R(part * 100, base)
            if not is_finite_decimal(ratio):
                continue
            unit = rng.choice(["g", "円", "m"])
            answer = ratio
            problem_latex = (
                f"{part}\\,\\text{{{unit}}} は {base}\\,\\text{{{unit}}} の何\\,\\%？"
            )
            break
    canonical = av.canonical_decimal_for_rational(answer)
    allowed = av.variants_for_decimal_answer(answer)
    return problem_latex, canonical, allowed, {
        "slot": 10, "answer_p": answer.p, "answer_q": answer.q,
    }


# ===========================================================================
# ディスパッチャ
# ===========================================================================

SLOT_GENERATORS = {
    1: _gen_slot_1_length,
    2: _gen_slot_2_area,
    3: _gen_slot_3_area,
    4: _gen_slot_4_volume,
    5: _gen_slot_5_weight,
    6: _gen_slot_6_time,
    7: _gen_slot_7_speed,
    8: _gen_slot_8_ratio,
    9: _gen_slot_9_ratio_conv,
    10: _gen_slot_10_application,
}


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """slot_index (0..9) で 10 個のスロットを 1 周回す。"""
    slot = (slot_index % 10) + 1
    gen = SLOT_GENERATORS[slot]
    problem_latex, canonical, allowed, info = gen(band, rng)
    return {
        "problemLatex": problem_latex,
        "answerCanonical": canonical,
        "answerAllowed": allowed,
        "_meta": {
            "rank": 10,
            "band": band,
            **info,
        },
    }


def self_check(problem: Dict[str, Any]) -> bool:
    """各スロットの計算を再実行して canonical と一致するか確認。"""
    meta = problem["_meta"]
    slot = meta.get("slot")
    canonical = problem["answerCanonical"]

    # Slot 1〜5：単位換算（src * factor = answer）
    if slot in (1, 2, 3, 4, 5):
        src = sp.Rational(meta["src_p"], meta["src_q"])
        factor = sp.Rational(meta["factor_p"], meta["factor_q"])
        recom = src * factor
        if av.canonical_decimal_for_rational(recom) != canonical:
            return False
    elif slot == 6 or slot == 7:
        src = sp.Rational(meta["src_p"], meta["src_q"])
        factor = sp.Rational(meta["factor_p"], meta["factor_q"])
        recom = src * factor
        if recom.q == 1 or not is_finite_decimal(recom):
            if av.canonical_for_rational(recom) != canonical:
                return False
        else:
            if av.canonical_decimal_for_rational(recom) != canonical:
                return False
    elif slot == 8:
        a, b, c = meta["a"], meta["b"], meta["c"]
        # a:b = c:? → ? = b*c/a
        ans = sp.Rational(b * c, a)
        if av.canonical_for_rational(ans) != canonical:
            return False
        # 比 a:b の既約性チェック（GCD=1）
        if gcd(a, b) != 1:
            return False
    elif slot in (9, 10):
        ans = sp.Rational(meta["answer_p"], meta["answer_q"])
        if av.canonical_decimal_for_rational(ans) != canonical:
            return False
    else:
        return False

    # 設計原則：問題式に分数が含まれる場合は既約性を検証
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
