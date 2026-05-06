# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""19級：小数 加減（仕様書 §6.5）。

Phase 1（2026-05-07 夜）: 30→50 題化、Band D を新設して 4 Band 構成に。

A: 1 桁同位 2項加減 15 問（slot_index 駆動）
   subcounts={"add": 8, "sub": 5, "int_ans": 2}
   - slot 0-1: int_ans 強制（"2.3 + 1.7 = 4" 系で「足したら整数になる」体験を保証）
   - slot 2-7: add 通常（残り 6 問）
   - slot 8-12: sub（5 問）
B: 2 桁同位 2項加減 15 問（slot_index 駆動 + 演算子均等）
   subcounts={"add": 8, "sub": 7}
C: 桁違い 2項加減 10 問（slot_index 駆動 + 「整数 - 小数」躓き保証）
   subcounts={"int_minus_dec": 5, "rest_diff": 5}
   - int_minus_dec: 5 - 2.3 系（中学算数の最大躓きポイント）
   - rest_diff: 整数 + 小数、桁違い小数同士
D: 3項加減（新設、slot_index 駆動）10 問
   subcounts={"all_add": 5, "add_sub_mix": 5}
   - all_add: 3 項全て加算（うち slot 0 は整数答え強制）
   - add_sub_mix: + と - を最低各 1 個含む

§6.4.0 既約性原則は本級に該当する分数を含まないため自動的に通過する。
小数値は `decimal_latex` で表示、`canonical_decimal_for_rational` で
有限小数として canonical を得る。

# TODO_PHASE3: 以下は Phase 3 で導入予定（rank_19）
#   1. 4 項以上の加減
#   2. 3 桁同位（B の拡張）
#   3. 帯分数・分数混在（rank_16/17 領域）
#   4. 後半カッコ（3.5 - (1.2 + 0.5)）— rank_09 領域として Phase 3 にも入れない
#      （rank_14/16 と同方針、ふくちさん 2026-05-07 判断踏襲）
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

def _gen_decimal(
    rng: random.Random, int_max: int, decimals: int, force_decimal_form: bool = True
) -> sp.Rational:
    """整数部 0..int_max、小数部 decimals 桁。

    decimals > 0 かつ force_decimal_form=True のときは小数部を非零に強制し、
    `1 + 4.3` のように一方が整数表記に化けるのを防ぐ（同位取り Band A/B 用）。
    Band C など意図的に「整数 vs 小数」を混在させたい場合は decimals=0 を渡す。
    """
    int_part = rng.randint(0, int_max)
    if decimals == 0:
        if int_part == 0:
            int_part = rng.randint(1, max(1, int_max))
        return sp.Rational(int_part, 1)
    if force_decimal_form:
        # 末尾ゼロも避ける（5.10 を 5.1 と表示しないため）
        while True:
            frac_part = rng.randint(1, 10**decimals - 1)
            if frac_part % 10 != 0:
                break
    else:
        frac_part = rng.randint(0, 10**decimals - 1)
        if int_part == 0 and frac_part == 0:
            frac_part = rng.randint(1, 10**decimals - 1)
    return sp.Rational(int_part * 10**decimals + frac_part, 10**decimals)


def _evaluate(terms: List[sp.Rational], ops: List[str]) -> sp.Rational:
    result = terms[0]
    for op, t in zip(ops, terms[1:]):
        result = result + t if op == "+" else result - t
    return sp.Rational(result)


# --- 新ヘルパー：演算子強制 / 整数答え強制 / サブパターン強制 --------------

def _gen_band_a_with_op(
    rng: random.Random, int_max: int, decimals: int,
    op: str, force_int_ans: bool = False,
):
    """Band A 用：演算子を強制した同位取り 2項。

    op: '+' or '-'
    force_int_ans: True なら答えが整数になる組（例 2.3 + 1.7 = 4）を強制（'+' のみ意味あり）
    """
    if force_int_ans and op != "+":
        return None
    a = _gen_decimal(rng, int_max, decimals)
    if force_int_ans:
        # a + b = 整数 になる b を選ぶ：a の小数部 frac、b の小数部は (10^decimals - frac)
        # ただし末尾ゼロ排除のため frac, 10^decimals - frac とも非零で末尾非零を要求
        scale = 10 ** decimals
        a_frac = (a.p * scale // a.q) % scale
        if a_frac == 0:
            return None  # a 自身が整数なら整数答えに意味なし
        b_frac = scale - a_frac
        if b_frac % 10 == 0:
            return None  # 末尾ゼロ（5.10 表示）排除
        # b の整数部はランダム（0..int_max）。a + b > 0 ならOK
        b_int = rng.randint(0, int_max)
        b = sp.Rational(b_int * scale + b_frac, scale)
        result = a + b
        if result <= 0:
            return None
        return [a, b], ["+"]

    b = _gen_decimal(rng, int_max, decimals)
    if op == "-" and a < b:
        a, b = b, a
    return [a, b], [op]


def _gen_band_b_with_op(
    rng: random.Random, int_max: int, decimals: int, op: str,
):
    """Band B 用：演算子を強制した同位取り 2項。"""
    a = _gen_decimal(rng, int_max, decimals)
    b = _gen_decimal(rng, int_max, decimals)
    if op == "-" and a < b:
        a, b = b, a
    return [a, b], [op]


def _gen_band_c_int_minus_dec(rng: random.Random, int_max: int):
    """Band C 用：「整数 - 小数」（5 - 2.3 系、中学算数の躓きポイント）。

    整数は 1..int_max+1（少し広めに、9 - 6.287 系も含む）。
    小数は 1〜3 桁から選択（decimals_options に整合）。
    結果非負を保証。
    """
    a_int_value = rng.randint(2, int_max + 1)
    a = sp.Rational(a_int_value, 1)
    decimals = rng.choice([1, 2, 3])
    b = _gen_decimal(rng, int_max, decimals)
    if a <= b:
        return None
    return [a, b], ["-"]


def _gen_band_c_rest_diff(rng: random.Random, int_max: int,
                           decimals_options):
    """Band C 用：その他の桁違い加減。

    decimals_options から 1 つ選ぶ（既存挙動踏襲）が、
    「整数 - 小数」（int_minus_dec で扱う）と完全に重ならない組のみ採用。

    具体的には: 演算子は + or -、(decs_a, decs_b) を decimals_options から選び、
    decs_a == 0 かつ op == '-' の組（= 整数 - 小数）を除外。
    """
    decs_a, decs_b = rng.choice(decimals_options)
    a = _gen_decimal(rng, int_max, decs_a)
    b = _gen_decimal(rng, int_max, decs_b)
    op = rng.choice(["+", "-"])
    # int_minus_dec と被るパターンを除外
    if op == "-" and decs_a == 0 and decs_b > 0:
        return None
    if op == "-" and a < b:
        a, b = b, a
    if a == b:
        return None
    return [a, b], [op]


def _gen_three_term_addsub(
    rng: random.Random, int_max: int, decimals: int, mode: str,
    force_int_ans: bool = False,
):
    """Band D 用：3項加減。

    mode='all_add': 3項全て足し算（演算子は ['+', '+'] 固定）
    mode='add_sub_mix': + と - を最低各 1 個含む（[+,-]、[-,+]）
    force_int_ans: True なら結果が整数になる組を強制
    """
    a = _gen_decimal(rng, int_max, decimals)
    b = _gen_decimal(rng, int_max, decimals)
    c = _gen_decimal(rng, int_max, decimals)

    if mode == "all_add":
        ops = ["+", "+"]
    elif mode == "add_sub_mix":
        # 仕様：「+ と - を最低各 1 個含む」。[+,-]/[-,+] の 2 候補のみ（rank_16 と同方針）。
        ops = rng.choice([["+", "-"], ["-", "+"]])
    else:
        raise ValueError(f"unsupported mode: {mode}")

    # 計算（途中値ガード：途中で 0 になる「実質 2 項」問題は教育的に冗長）
    intermediate = a + b if ops[0] == "+" else a - b
    if intermediate == 0:
        return None
    v = intermediate + c if ops[1] == "+" else intermediate - c

    if v <= 0:
        return None
    if force_int_ans and v.q != 1:
        return None
    return [a, b, c], ops, v


# --- slot_index 駆動 dispatcher -------------------------------------------

def _resolve_band_a_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → "int_ans" / "add" / "sub"。

    配置：
      slot 0..1            : int_ans（force_int_ans=True で生成）
      slot 2..(2+add-2-1)  : add 通常（add - int_ans 個）
      slot 残り            : sub
    """
    add_total = subcounts.get("add", 0)
    sub_total = subcounts.get("sub", 0)
    int_ans_total = subcounts.get("int_ans", 0)
    if slot_index < int_ans_total:
        return "int_ans"
    add_remaining = add_total - int_ans_total
    if slot_index < int_ans_total + add_remaining:
        return "add"
    return "sub"


def _resolve_band_b_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → "add" / "sub"。"""
    add_total = subcounts.get("add", 0)
    if slot_index < add_total:
        return "add"
    return "sub"


def _resolve_band_c_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → "int_minus_dec" / "rest_diff"。"""
    cumulative = 0
    for subkind in ("int_minus_dec", "rest_diff"):
        c = subcounts.get(subkind, 0)
        if c == 0:
            continue
        if slot_index < cumulative + c:
            return subkind
        cumulative += c
    return "rest_diff"


def _resolve_band_d_subkind(slot_index: int, subcounts: Dict[str, int]) -> Tuple[str, int]:
    """slot_index → (subkind, sub_slot_index)。

    sub_slot_index は subkind 内での 0-based 位置（force_int_ans 判定に使用）。
    """
    cumulative = 0
    for subkind in ("all_add", "add_sub_mix"):
        c = subcounts.get(subkind, 0)
        if c == 0:
            continue
        if slot_index < cumulative + c:
            return subkind, slot_index - cumulative
        cumulative += c
    return "add_sub_mix", slot_index - cumulative


# --- generate_problem -------------------------------------------------------

def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    全 Band で slot_index 駆動：
      A: slot 0-1=int_ans, 2-7=add, 8-12=sub
      B: slot 0-7=add, 8-14=sub
      C: slot 0-4=int_minus_dec, 5-9=rest_diff
      D: slot 0-4=all_add（slot 0 は force_int_ans）, 5-9=add_sub_mix
    """
    cfg = get_band(19, band)
    int_max = cfg["int_max"]
    subcounts = cfg.get("subcounts", {})

    # 各 Band でサブパターン強制
    forced_subkind: Optional[str] = None
    forced_op: Optional[str] = None
    force_int_ans: bool = False
    forced_three_term_mode: Optional[str] = None

    if band == "A":
        forced_subkind = _resolve_band_a_subkind(slot_index, subcounts)
        if forced_subkind == "int_ans":
            forced_op = "+"
            force_int_ans = True
        elif forced_subkind == "add":
            forced_op = "+"
        else:  # sub
            forced_op = "-"
    elif band == "B":
        forced_subkind = _resolve_band_b_subkind(slot_index, subcounts)
        forced_op = "+" if forced_subkind == "add" else "-"
    elif band == "C":
        forced_subkind = _resolve_band_c_subkind(slot_index, subcounts)
    elif band == "D":
        forced_subkind, sub_slot = _resolve_band_d_subkind(slot_index, subcounts)
        forced_three_term_mode = forced_subkind
        # all_add の slot 0（sub_slot=0）は整数答え強制
        if forced_subkind == "all_add" and sub_slot == 0:
            force_int_ans = True
    else:
        raise NotImplementedError(f"rank 19 band {band}")

    for _ in range(500):
        if band == "A":
            decimals = cfg["decimals"]
            res = _gen_band_a_with_op(rng, int_max, decimals, forced_op,
                                       force_int_ans=force_int_ans)
            if res is None:
                continue
            terms, ops = res
            meta_kind = forced_subkind
        elif band == "B":
            decimals = cfg["decimals"]
            res = _gen_band_b_with_op(rng, int_max, decimals, forced_op)
            if res is None:
                continue
            terms, ops = res
            meta_kind = forced_subkind
        elif band == "C":
            decimals_options = cfg["decimals_options"]
            if forced_subkind == "int_minus_dec":
                res = _gen_band_c_int_minus_dec(rng, int_max)
            else:
                res = _gen_band_c_rest_diff(rng, int_max, decimals_options)
            if res is None:
                continue
            terms, ops = res
            meta_kind = forced_subkind
        elif band == "D":
            decimals = cfg["decimals"]
            res = _gen_three_term_addsub(rng, int_max, decimals,
                                          forced_three_term_mode,
                                          force_int_ans=force_int_ans)
            if res is None:
                continue
            terms, ops, _v = res
            meta_kind = forced_three_term_mode
        else:
            raise NotImplementedError(band)

        result = _evaluate(terms, ops)

        # 共通ガード
        if result <= 0:
            continue
        if not is_finite_decimal(result):
            continue
        # 整数答えの強制（再確認）
        if force_int_ans and result.q != 1:
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
                "rank": 19,
                "band": band,
                "kind": meta_kind,
                "terms_p_q": [(int(t.p), int(t.q)) for t in terms],
                "ops": ops,
                "value_p": int(result.p),
                "value_q": int(result.q),
            },
        }
    raise RuntimeError(f"rank 19 band {band}: 500 retries exhausted")


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
    # Band A int_ans 検証：答えが整数
    if meta.get("kind") == "int_ans":
        if expected.q != 1:
            return False
    # Band C int_minus_dec 検証：先頭が整数（q==1）、第 2 項が小数（q>1）
    if meta.get("kind") == "int_minus_dec":
        if len(terms) != 2:
            return False
        if terms[0].q != 1:
            return False
        if terms[1].q == 1:
            return False
        if meta["ops"] != ["-"]:
            return False
    # Band D 検証：3 項であること
    if meta.get("kind") == "all_add":
        if len(terms) != 3 or meta["ops"] != ["+", "+"]:
            return False
    elif meta.get("kind") == "add_sub_mix":
        if len(terms) != 3:
            return False
        # + と - を最低各 1 個含む（rank_16 と同方針）
        if "+" not in meta["ops"] or "-" not in meta["ops"]:
            return False
    return True
