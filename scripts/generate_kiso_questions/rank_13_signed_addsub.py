# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""13級：正負の数 加減（仕様書 §6.5）。

Phase 1（2026-05-05）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。

A: 括弧付き 2項 +/- 12 問（例：(+9)+(+5)）— 同符号のみ
B: 括弧付き 2項 +/- 12 問（混合符号、例：(+3)-(-7)）
C: 括弧なし 2項 +/- 11 問（例：-47+58）
D: 括弧付き 3項加減 15 問（新設、例：(+5) + (-3) - (+2)）

中1 加減の山場「3 項計算」が旧構成で欠落していたため Band D 新設で解消
（rank_05/06/08/01 と同じ Band D 新設パターン）。
TODO_PHASE3: 小数・分数の混合、カッコ + カッコなし混在は Phase 3 で導入。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import OP_LATEX, signed_int_latex_paren, signed_int_latex_leading
from common.sympy_helpers import assert_problem_fractions_in_lowest_terms


def _signed_int(rng: random.Random, max_abs: int, allow_zero: bool = False) -> int:
    """±[1..max_abs] からランダムに 1 つ。allow_zero=True で 0 も含む。"""
    while True:
        v = rng.randint(-max_abs, max_abs)
        if v == 0 and not allow_zero:
            continue
        return v


def _gen_three_term_addsub(rng, max_abs):
    """Band D 用：3 項加減（括弧付き）。

    例：``(+5) + (-3) - (+2) = 0`` → 結果ゼロ排除のためリトライ
        ``(-7) - (+3) + (-2) = -12``

    a, b, c は ±[1..max_abs]（非ゼロ）、op1/op2 は {+, -} からランダム。
    結果 = 0 は退屈なので排除。先頭項も括弧付き（rank_13 既存挙動と同様）。
    """
    while True:
        a = _signed_int(rng, max_abs)
        b = _signed_int(rng, max_abs)
        c = _signed_int(rng, max_abs)
        op1 = rng.choice(["+", "-"])
        op2 = rng.choice(["+", "-"])
        v = a
        v = v + b if op1 == "+" else v - b
        v = v + c if op2 == "+" else v - c
        if v == 0:
            continue
        latex = (
            f"{signed_int_latex_paren(a)} "
            f"{OP_LATEX[op1]} {signed_int_latex_paren(b)} "
            f"{OP_LATEX[op2]} {signed_int_latex_paren(c)}"
        )
        return latex, v, {
            "kind": "three_term_addsub",
            "a": a, "b": b, "c": c, "op1": op1, "op2": op2,
        }


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    rank_13 は現状 slot_index を使ったサブパターン分離はしていない（A/B/C/D とも
    単一 generator）。将来 Band D サブパターン化する場合は slot_index 利用可。
    """
    cfg = get_band(13, band)
    kind = cfg["kind"]

    if kind == "three_term_addsub":
        for _ in range(300):
            latex, result, info = _gen_three_term_addsub(rng, cfg["max_abs"])
            canonical = av.canonical_for_rational(sp.Rational(result))
            allowed = av.variants_for_rational(sp.Rational(result))
            return {
                "problemLatex": latex,
                "answerCanonical": canonical,
                "answerAllowed": allowed,
                "_meta": {
                    "rank": 13,
                    "band": band,
                    "result": result,
                    **info,
                },
            }
        raise RuntimeError(f"rank 13 band {band}: 300 retries exhausted")

    # 既存挙動（A/B/C）：パラメータと kind=paren/noparen を踏襲
    max_abs = cfg["max_abs"]
    same_sign_only = cfg.get("same_sign_only", False)

    for _ in range(300):
        a = _signed_int(rng, max_abs)
        b = _signed_int(rng, max_abs)
        op = rng.choice(["+", "-"])
        if same_sign_only and ((a > 0) != (b > 0)):
            continue

        result = a + b if op == "+" else a - b
        if result == 0:
            continue

        if kind == "paren":
            # (+9) + (+5) のように、両項とも (+n) / (-n) で囲む
            latex = f"{signed_int_latex_paren(a)} {OP_LATEX[op]} {signed_int_latex_paren(b)}"
        elif kind == "noparen":
            # 先頭は符号付き整数、2 項目以降も符号で繋ぐ。
            # ただし `-47 + 58` のように、b が負のときは `+ -58` を `- 58` に統合する書き方を選ぶ。
            # ここでは括弧なしで素直に：先頭は signed_int_latex_leading、次の項は op + |b|。
            # b が負なら op="+" で b=-58 と書きたいが、紙教材は `-47 + 58` のような形式なので
            # 「項としての符号付き整数 + 演算子は + or - のみ」で表す。
            # 簡略化：b は |b| として表示し、op の +/- に符号を吸収。
            sign_b = "+" if (b > 0 and op == "+") or (b < 0 and op == "-") else "-"
            # b 自身が負だった場合は op の符号を反転させて吸収
            display_op = "+" if (op == "+" and b > 0) or (op == "-" and b < 0) else "-"
            display_b = abs(b)
            latex = f"{signed_int_latex_leading(a)} {display_op} {display_b}"
            # 上記単純化により result の意味が変わらないことを確認
            # （op == "+" and b < 0 → display "- |b|"；op == "-" and b < 0 → display "+ |b|" 等）
        else:
            raise NotImplementedError(kind)

        canonical = av.canonical_for_rational(sp.Rational(result))
        allowed = av.variants_for_rational(sp.Rational(result))
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 13,
                "band": band,
                "kind": kind,
                "a": a,
                "b": b,
                "op": op,
                "result": result,
            },
        }
    raise RuntimeError(f"rank 13 band {band}: 300 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    kind = meta.get("kind")
    if kind == "three_term_addsub":
        a, b, c, op1, op2 = meta["a"], meta["b"], meta["c"], meta["op1"], meta["op2"]
        expected = a
        expected = expected + b if op1 == "+" else expected - b
        expected = expected + c if op2 == "+" else expected - c
        if expected != meta["result"]:
            return False
    else:
        a, b, op = meta["a"], meta["b"], meta["op"]
        expected = a + b if op == "+" else a - b
        if expected != meta["result"]:
            return False
    if av.canonical_for_rational(sp.Rational(meta["result"])) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
