"""13級：正負の数 加減（仕様書 §6.5）。

A: 括弧付き 2項 +/- （例：(+9)+(+5)）— 同符号のみ
B: 括弧付き 2項 +/- （混合符号、例：(+3)-(-7)）
C: 括弧なし 2項 +/- （例：-47+58）

D 以降の小数・分数混在、3項は Phase 3 で追加。
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


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(13, band)
    kind = cfg["kind"]
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
    a, b, op = meta["a"], meta["b"], meta["op"]
    expected = a + b if op == "+" else a - b
    if expected != meta["result"]:
        return False
    if av.canonical_for_rational(sp.Rational(expected)) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
