# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""11級：正負の数 四則混合（仕様書 §6.5）— 最難関級。

Phase 1（2026-05-05）: 30→50 題に拡充、Band C を slot_index 駆動化。

A: 2項 四則混合 15 問（括弧付き符号、両正排除で 11 級らしさ維持）
B: 累乗を含む 2 項 15 問（×/÷ + 累乗）
C: 3項 + 括弧 + 累乗 20 問（**slot_index 駆動の 2 サブパターン分離**）
   - subcounts={"inner_paren_x_power":10, "power_op_term_op_term":10}
   - 既存の P1（内側カッコ × 累乗）と P2（累乗 + 項 × 項）を slot_index で
     決定論分離（rng.choice の偶然依存を解消）

Phase 1 では小数・分数の混在は扱わない（D 以降で導入予定）。
答えは整数になる組のみ採用（11 級 Phase 1 はまず整数演算で安定させる）。
TODO_PHASE3: 4 項以上、分数係数、二重括弧は Phase 3 で導入。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import (
    OP_LATEX,
    signed_int_latex_paren,
    signed_int_latex_leading,
    power_latex,
    paren_expr_latex,
)
from common.sympy_helpers import assert_problem_fractions_in_lowest_terms


def _signed_int(rng: random.Random, max_abs: int, min_abs: int = 2) -> int:
    while True:
        v = rng.randint(-max_abs, max_abs)
        if abs(v) < min_abs:
            continue
        return v


def _gen_two_term_mixed(rng, max_abs):
    """2 項 四則混合：a op b、先頭は符号付き整数、2 項目は (+a)/(-a) で囲む。

    **11 級らしさ（最難関）を保つため、a > 0 かつ b > 0 のケースを完全排除**：
    両正は 13 級レベル（単純な正の数同士の四則）になるため、Band A に出さない。

    実装：op を先に決めて a/b を構築 → 最後に「両正なら片方を反転」を適用。
    `+ - *` ではどちらを反転しても結果の演算は妥当。`/` ではどちらを反転しても
    被除数 = b*q で構築済みなので「割り切れる」性質は保たれる（n が b の倍数なら
    -b の倍数でもある）。
    """
    op = rng.choice(["+", "-", "*", "/"])
    if op == "/":
        # 商と除数を先に決めて被除数 = b * q（割り切れることを保証）
        b = _signed_int(rng, max_abs)
        q = _signed_int(rng, max_abs)
        a = b * q
    else:
        a = _signed_int(rng, max_abs)
        b = _signed_int(rng, max_abs)

    # 両正排除（最後に適用、op に関わらず）
    if a > 0 and b > 0:
        if rng.random() < 0.5:
            a = -a
        else:
            b = -b

    if op == "+":
        result = a + b
    elif op == "-":
        result = a - b
    elif op == "*":
        result = a * b
    else:
        if b == 0 or a % b != 0:
            return None
        result = a // b

    latex = f"{signed_int_latex_leading(a)} {OP_LATEX[op]} {signed_int_latex_paren(b)}"
    return latex, result, {"kind": "two_term_mixed", "a": a, "b": b, "op": op}


def _gen_with_power(rng, max_abs, exp_max):
    """累乗を含む 2 項 ×/÷。例： (-3)^2 \\times 4、 -3^2 \\div 3 等。"""
    base_abs = rng.randint(2, max_abs)
    exp = rng.randint(2, exp_max)
    pat = rng.choice(["paren_signed", "leading_minus", "positive"])
    if pat == "paren_signed":
        # 符号付きの base：負のときは (-3)^2 のように括弧、正のときは 3^2（裸表記）
        sign = rng.choice([-1, 1])
        base_signed = sign * base_abs
        power_str = power_latex(
            signed_int_latex_leading(base_signed), exp, base_is_signed=(base_signed < 0)
        )
        power_value = base_signed ** exp
    elif pat == "leading_minus":
        power_str = "-" + power_latex(str(base_abs), exp)
        power_value = -(base_abs ** exp)
    else:
        power_str = power_latex(str(base_abs), exp)
        power_value = base_abs ** exp
    # 累乗の後に ×/÷（もしくは +/-）
    op = rng.choice(["*", "+", "-"])
    if op == "*":
        b = _signed_int(rng, max_abs)
        result = power_value * b
    elif op == "+":
        b = _signed_int(rng, max_abs)
        result = power_value + b
    else:
        b = _signed_int(rng, max_abs)
        result = power_value - b
    latex = f"{power_str} {OP_LATEX[op]} {signed_int_latex_paren(b)}"
    return latex, result, {
        "kind": "with_power",
        "power_value": power_value,
        "op": op,
        "b": b,
    }


def _gen_three_term_paren_power(rng, max_abs, exp_max, pattern=None):
    """3 項 + 括弧 + 累乗：例 (2 - 5) \\times (-3)^2、(-3)^2 - 4 \\times 2 など。

    パターン：
      P1: (a op1 b) op2 power           （内側カッコ展開 → 累乗倍率）
      P2: power op1 a op2 b             （累乗結果 → 項の演算、op2 は × で優先順位発揮）

    pattern: None なら rng.choice（既存挙動、後方互換）。"P1" / "P2" で強制指定可。
    Phase 1（2026-05-05）から Band C は generate_problem 側で slot_index 駆動の
    決定論的サブパターン分離を行う（_resolve_band_c_subkind 経由）。
    """
    if pattern is None:
        pattern = rng.choice(["P1", "P2"])
    base_abs = rng.randint(2, max_abs)
    exp = 2
    sign = rng.choice([-1, 1])
    base_signed = sign * base_abs
    power_str = power_latex(
        signed_int_latex_leading(base_signed), exp, base_is_signed=(base_signed < 0)
    )
    power_value = base_signed ** exp

    if pattern == "P1":
        a = _signed_int(rng, max_abs)
        b = _signed_int(rng, max_abs)
        op1 = rng.choice(["+", "-"])
        op2 = rng.choice(["*"])
        inner = a + b if op1 == "+" else a - b
        result = inner * power_value
        inner_latex = f"{signed_int_latex_leading(a)} {OP_LATEX[op1]} {signed_int_latex_paren(b)}"
        latex = f"{paren_expr_latex(inner_latex)} {OP_LATEX[op2]} {power_str}"
        return latex, result, {
            "kind": "three_paren_power_P1",
            "a": a, "b": b, "op1": op1, "op2": op2,
            "power_value": power_value,
        }
    # P2: power_value op1 a op2 b （op2 が * のときは a op2 b が先）
    a = _signed_int(rng, max_abs)
    b = _signed_int(rng, max_abs)
    op1 = rng.choice(["+", "-"])
    op2 = "*"
    sub = a * b
    result = power_value + sub if op1 == "+" else power_value - sub
    latex = f"{power_str} {OP_LATEX[op1]} {signed_int_latex_paren(a)} {OP_LATEX[op2]} {signed_int_latex_paren(b)}"
    return latex, result, {
        "kind": "three_paren_power_P2",
        "a": a, "b": b, "op1": op1, "op2": op2,
        "power_value": power_value,
    }


def _resolve_band_c_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → "inner_paren_x_power" (P1) / "power_op_term_op_term" (P2)。

    cumulative dispatch 方式：subcounts の順序通りに dispatch する。
    例: subcounts={"inner_paren_x_power":10, "power_op_term_op_term":10}, count=20
        slot 0..9   → "inner_paren_x_power" (P1)
        slot 10..19 → "power_op_term_op_term" (P2)

    rank_03/02/07/08/01 で確立した方式と同一。rng.choice の偶然依存を解消し、
    教育的配分を**確実**に守る。
    """
    cumulative = 0
    for subkind in ("inner_paren_x_power", "power_op_term_op_term"):
        n = int(subcounts.get(subkind, 0))
        if slot_index < cumulative + n:
            return subkind
        cumulative += n
    return "inner_paren_x_power"  # フォールバック


# サブパターン名 → _gen_three_term_paren_power の pattern 引数へのマッピング
_BAND_C_SUBKIND_TO_PATTERN = {
    "inner_paren_x_power":  "P1",
    "power_op_term_op_term": "P2",
}


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    Band C（three_term_paren_power）のみ slot_index 駆動で 2 サブパターン
    （inner_paren_x_power / power_op_term_op_term）を決定論的に dispatch する。
    A/B は slot_index を無視（既存挙動を温存）。
    """
    cfg = get_band(11, band)
    kind = cfg["kind"]
    max_abs = cfg["max_abs"]

    # Band C：slot_index で P1/P2 を強制指定
    forced_pattern = None
    if kind == "three_term_paren_power":
        sub = _resolve_band_c_subkind(slot_index, cfg.get("subcounts", {}))
        forced_pattern = _BAND_C_SUBKIND_TO_PATTERN.get(sub)

    for _ in range(500):
        if kind == "two_term_mixed":
            built = _gen_two_term_mixed(rng, max_abs)
            if built is None:
                continue
            latex, result, info = built
        elif kind == "with_power":
            latex, result, info = _gen_with_power(rng, max_abs, cfg["exp_max"])
        elif kind == "three_term_paren_power":
            latex, result, info = _gen_three_term_paren_power(
                rng, max_abs, cfg["exp_max"], pattern=forced_pattern
            )
        else:
            raise NotImplementedError(kind)
        if result == 0:
            continue
        if abs(result) > 10000:
            continue

        canonical = av.canonical_for_rational(sp.Rational(result))
        allowed = av.variants_for_rational(sp.Rational(result))
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 11,
                "band": band,
                "result": int(result),
                **info,
            },
        }
    raise RuntimeError(f"rank 11 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    expected = meta["result"]
    kind = meta["kind"]
    # 各 kind の result は生成側で計算済み。再計算は info から可能なものに限る。
    if kind == "two_term_mixed":
        a, b, op = meta["a"], meta["b"], meta["op"]
        if op == "+":
            recom = a + b
        elif op == "-":
            recom = a - b
        elif op == "*":
            recom = a * b
        else:
            recom = a // b
        if recom != expected:
            return False
    elif kind == "with_power":
        op, b, pv = meta["op"], meta["b"], meta["power_value"]
        if op == "*":
            recom = pv * b
        elif op == "+":
            recom = pv + b
        else:
            recom = pv - b
        if recom != expected:
            return False
    elif kind == "three_paren_power_P1":
        a, b, op1, op2, pv = meta["a"], meta["b"], meta["op1"], meta["op2"], meta["power_value"]
        inner = a + b if op1 == "+" else a - b
        recom = inner * pv if op2 == "*" else inner / pv
        if recom != expected:
            return False
    elif kind == "three_paren_power_P2":
        a, b, op1, op2, pv = meta["a"], meta["b"], meta["op1"], meta["op2"], meta["power_value"]
        sub = a * b
        recom = pv + sub if op1 == "+" else pv - sub
        if recom != expected:
            return False
    if av.canonical_for_rational(sp.Rational(expected)) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
