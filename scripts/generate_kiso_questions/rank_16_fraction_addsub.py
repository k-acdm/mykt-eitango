# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""16級：分数 加減（仕様書 §6.5）。

Phase 1（2026-05-07 夕）: 30→50 題化、Band D を新設して 4 Band 構成に。

A: 同分母 2項 加減 15 問（slot_index 駆動）
   subcounts={"add": 8, "sub": 7, "int_ans": 2}
   - slot 0-1: int_ans 強制（"1/3 + 2/3 = 1" 系で「足したら整数になる」体験を保証）
   - slot 2-7: add 通常（残り 6 問）
   - slot 8-14: sub 通常（7 問）
B: 異分母 2項 加減 15 問（slot_index 駆動 + 通分難易度サブパターン分離）
   subcounts={"easy_lcm": 5, "medium_lcm": 5, "hard_lcm": 5}
   - easy_lcm:   lcm <= 12（簡単な通分、例 1/2 + 1/3 = 5/6）
   - medium_lcm: 13 <= lcm <= 30
   - hard_lcm:   lcm > 30
C: 異分母 2項 加減 10 問（中〜難の通分、easy_lcm 含まない）
   subcounts={"medium_lcm": 5, "hard_lcm": 5}
D: 3項加減 10 問（新設、slot_index 駆動）
   subcounts={"all_add": 5, "add_sub_mix": 5}
   - all_add: 3項全て足し算（うち slot 0 は整数答え強制）
   - add_sub_mix: + と - を最低各 1 個含む

§6.4.0 既約性原則：問題式の各分数は GCD=1（pick_coprime_numerator で保証）。

設計原則（紙教材準拠）:
  問題式に登場する各分数は**常に既約形**。例：✅ `5/6 - 2/3`、❌ `4/6 - 3/6`。
  これは pick_coprime_numerator で分子を選ぶことで保証し、self_check の
  assert_problem_fractions_in_lowest_terms で二重に検証する。

# TODO_PHASE3: 以下は Phase 3 で導入予定（rank_16）
#   1. 帯分数表記（2\\frac{1}{3} + 1\\frac{1}{2}）
#   2. 小数混在（0.5 + 1/2）
#   3. 4項以上の加減
#   4. 後半カッコ（3/4 - (1/2 + 1/4)）— ただし「カッコの外し方」が本質のため、
#      rank_16 のスコープではなく rank_09 Band D paren_addsub の領域。
#      rank_16 の Phase 3 にも入れない方針（ふくちさん 2026-05-07 判断踏襲、
#      rank_14 と同方針）
#   5. rank_14 Band D との完全分離（rank_14 では 2項 整数±分数を扱う、
#      rank_16 では 2項 整数±分数を入れない方針で分業済み）
"""

from __future__ import annotations

import random
from math import gcd
from typing import Any, Dict, List, Optional, Tuple

import sympy as sp

from common import answer_variants as av
from common.latex_utils import frac_latex_raw, OP_LATEX
from common.band_config import get_band
from common.sympy_helpers import (
    pick_coprime_numerator,
    assert_problem_fractions_in_lowest_terms,
)


def _lcm(a: int, b: int) -> int:
    return a * b // gcd(a, b)


# --- 既存ヘルパー（rank_15 Phase 1 と同じ思想で温存） -----------------------

def _gen_addsub_pair_same_denom(
    rng: random.Random, denom_max: int
) -> Tuple[List[Tuple[int, int]], List[str]]:
    """同分母 2項。各分数 a/d, b/d は既約。結果非負・非ゼロ。

    a と d、b と d が互いに素になるよう pick_coprime_numerator で選ぶ。
    d=2 のとき真分数は 1/2 のみで a=b=1 となるため、引き分け（a==b）の '-' は
    呼び出し側の値ゼロ拒否で弾かれる。
    """
    d = rng.randint(2, denom_max)
    a = pick_coprime_numerator(rng, d)
    b = pick_coprime_numerator(rng, d)
    op = rng.choice(["+", "-"])
    if op == "-" and a < b:
        a, b = b, a
    return [(a, d), (b, d)], [op]


def _gen_addsub_pair_diff_denom(
    rng: random.Random, denom_max: int
) -> Tuple[List[Tuple[int, int]], List[str]]:
    """異分母 2項。各分数は既約。結果非負を保証。"""
    d1 = rng.randint(2, denom_max)
    d2 = rng.randint(2, denom_max)
    while d1 == d2:
        d2 = rng.randint(2, denom_max)
    n1 = pick_coprime_numerator(rng, d1)
    n2 = pick_coprime_numerator(rng, d2)
    op = rng.choice(["+", "-"])
    if op == "-" and sp.Rational(n1, d1) < sp.Rational(n2, d2):
        n1, n2 = n2, n1
        d1, d2 = d2, d1
    return [(n1, d1), (n2, d2)], [op]


# --- 新ヘルパー：演算子・通分難易度・整数答えの強制 ------------------------

def _gen_band_a_with_op(
    rng: random.Random, denom_max: int, op: str, force_int_ans: bool = False
):
    """Band A 用：演算子を強制した同分母 2項。

    op: '+' or '-'
    force_int_ans: True なら答え=1 になる組（例 1/3 + 2/3 = 1）を強制。
                   '+' のみ意味があり、'-' で True を渡すと None 返却（非対応）。
    既約条件・結果非負ガードは呼び出し側ループで担保。
    """
    if force_int_ans and op != "+":
        return None
    d = rng.randint(2, denom_max)
    a = pick_coprime_numerator(rng, d)
    if force_int_ans:
        # a + b = d を満たす b を選ぶ。b = d - a で a≠b の組（=自明 1/2+1/2 排除）も許容。
        # b は 1..d-1 の範囲、b と d が互いに素である必要がある。
        b = d - a
        if b < 1 or b >= d:
            return None
        if gcd(b, d) != 1:
            return None
        return [(a, d), (b, d)], ["+"]

    b = pick_coprime_numerator(rng, d)
    if op == "-" and a < b:
        a, b = b, a
    return [(a, d), (b, d)], [op]


def _gen_band_bc_with_lcm_range(
    rng: random.Random, denom_max: int,
    lcm_min: int, lcm_max: int,
):
    """Band B/C 用：通分難易度（lcm）を範囲制約した異分母 2項。

    [lcm_min, lcm_max] の範囲内の lcm(d1, d2) の組のみ採用。
    範囲外なら None 返却（呼び出し側でリトライ）。
    """
    d1 = rng.randint(2, denom_max)
    d2 = rng.randint(2, denom_max)
    if d1 == d2:
        return None
    l = _lcm(d1, d2)
    if l < lcm_min or l > lcm_max:
        return None
    n1 = pick_coprime_numerator(rng, d1)
    n2 = pick_coprime_numerator(rng, d2)
    op = rng.choice(["+", "-"])
    if op == "-" and sp.Rational(n1, d1) < sp.Rational(n2, d2):
        n1, n2 = n2, n1
        d1, d2 = d2, d1
    return [(n1, d1), (n2, d2)], [op]


def _gen_three_term_addsub(
    rng: random.Random, denom_max: int, mode: str,
    force_int_ans: bool = False,
):
    """Band D 用：3項加減。

    mode='all_add': 3項全て足し算（演算子は ['+', '+'] 固定）
    mode='add_sub_mix': + と - を最低各 1 個含む（[+,-]、[-,+]、[-,-]）
    force_int_ans: True なら結果が整数（特に 1）になる組を強制
    """
    d1 = rng.randint(2, denom_max)
    d2 = rng.randint(2, denom_max)
    d3 = rng.randint(2, denom_max)
    n1 = pick_coprime_numerator(rng, d1)
    n2 = pick_coprime_numerator(rng, d2)
    n3 = pick_coprime_numerator(rng, d3)

    if mode == "all_add":
        ops = ["+", "+"]
    elif mode == "add_sub_mix":
        # 仕様：「+ と - を最低各 1 個含む」。
        # [-,-] は + を含まないため除外。候補は [+,-] / [-,+] の 2 通りのみ。
        ops = rng.choice([["+", "-"], ["-", "+"]])
    else:
        raise ValueError(f"unsupported mode: {mode}")

    terms = [(n1, d1), (n2, d2), (n3, d3)]

    # 計算（途中値の自明ゼロも排除：例 1/2 - 1/2 + 6/7 のような第1+第2でゼロ）
    a = sp.Rational(n1, d1)
    b = sp.Rational(n2, d2)
    c = sp.Rational(n3, d3)
    intermediate = a + b if ops[0] == "+" else a - b
    if intermediate == 0:
        return None  # 途中で 0 になる「実質 2 項」問題は教育的に冗長
    v = intermediate + c if ops[1] == "+" else intermediate - c

    if v <= 0:
        return None
    if force_int_ans and v.q != 1:
        return None
    # 答え=1 ガードは呼び出し側で（int_ans モードのみ許容）

    return terms, ops, v


def _evaluate(terms: List[Tuple[int, int]], ops: List[str]) -> sp.Rational:
    """加減のみの左結合評価。"""
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


# --- slot_index 駆動 サブパターン dispatcher（cumulative） -----------------
# rank_03/02/07/08/01/12/11/13/09/14/15 と同方式。
# 配置順:
#   Band A: slot 0-1 が int_ans、2-7 が add（残り 6）、8-14 が sub（7）
#   Band B: slot 0-4 easy_lcm、5-9 medium_lcm、10-14 hard_lcm
#   Band C: slot 0-4 medium_lcm、5-9 hard_lcm
#   Band D: slot 0-4 all_add（slot 0 は整数答え強制）、5-9 add_sub_mix

def _resolve_band_a_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → "int_ans" / "add" / "sub"。

    配置：
      slot 0..1            : int_ans（force_int_ans=True で生成、'+' 演算子）
      slot 2..(2+add-2-1)  : add 通常（add - int_ans 個）
      slot 残り            : sub
    """
    add_total = subcounts.get("add", 0)
    sub_total = subcounts.get("sub", 0)
    int_ans_total = subcounts.get("int_ans", 0)
    # int_ans は add の中に含む（add に既に int_ans が含まれた数として配分）
    if slot_index < int_ans_total:
        return "int_ans"
    add_remaining = add_total - int_ans_total
    if slot_index < int_ans_total + add_remaining:
        return "add"
    return "sub"


def _resolve_band_bc_subkind(
    slot_index: int, subcounts: Dict[str, int]
) -> str:
    """slot_index → easy_lcm / medium_lcm / hard_lcm。

    cumulative dispatch。Band B は 3 サブ、Band C は 2 サブ（medium/hard）。
    """
    cumulative = 0
    for subkind in ("easy_lcm", "medium_lcm", "hard_lcm"):
        c = subcounts.get(subkind, 0)
        if c == 0:
            continue
        if slot_index < cumulative + c:
            return subkind
        cumulative += c
    # フォールバック（範囲外）
    return "hard_lcm"


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


# lcm 範囲のマッピング
_LCM_RANGES = {
    "easy_lcm":   (1, 12),
    "medium_lcm": (13, 30),
    "hard_lcm":   (31, 10**6),
}


# --- generate_problem -------------------------------------------------------

def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    全 Band で slot_index 駆動：
      A: slot 0-1=int_ans, 2-7=add, 8-14=sub
      B: slot 0-4=easy_lcm, 5-9=medium_lcm, 10-14=hard_lcm
      C: slot 0-4=medium_lcm, 5-9=hard_lcm
      D: slot 0-4=all_add（slot 0 は force_int_ans）, 5-9=add_sub_mix
    """
    cfg = get_band(16, band)
    subcounts = cfg.get("subcounts", {})
    denom_max = cfg["denom_max"]

    # 各 Band でサブパターン強制
    forced_subkind: Optional[str] = None
    forced_op: Optional[str] = None
    force_int_ans: bool = False
    forced_lcm_range: Optional[Tuple[int, int]] = None
    forced_three_term_mode: Optional[str] = None

    if band == "A":
        forced_subkind = _resolve_band_a_subkind(slot_index, subcounts)
        if forced_subkind == "int_ans":
            forced_op = "+"
            force_int_ans = True
        elif forced_subkind == "add":
            forced_op = "+"
        else:  # "sub"
            forced_op = "-"
    elif band in ("B", "C"):
        forced_subkind = _resolve_band_bc_subkind(slot_index, subcounts)
        forced_lcm_range = _LCM_RANGES[forced_subkind]
    elif band == "D":
        forced_subkind, sub_slot = _resolve_band_d_subkind(slot_index, subcounts)
        forced_three_term_mode = forced_subkind  # all_add or add_sub_mix
        # all_add の slot 0（sub_slot=0）は整数答え強制
        if forced_subkind == "all_add" and sub_slot == 0:
            force_int_ans = True
    else:
        raise NotImplementedError(f"rank 16 band {band}")

    for _ in range(500):
        if band == "A":
            res = _gen_band_a_with_op(rng, denom_max, forced_op, force_int_ans=force_int_ans)
            if res is None:
                continue
            terms, ops = res
            value = _evaluate(terms, ops)
            meta_kind = forced_subkind  # "int_ans" / "add" / "sub"
        elif band in ("B", "C"):
            lcm_min, lcm_max = forced_lcm_range
            res = _gen_band_bc_with_lcm_range(rng, denom_max, lcm_min, lcm_max)
            if res is None:
                continue
            terms, ops = res
            value = _evaluate(terms, ops)
            meta_kind = forced_subkind  # "easy_lcm" / "medium_lcm" / "hard_lcm"
        elif band == "D":
            res = _gen_three_term_addsub(
                rng, denom_max, forced_three_term_mode,
                force_int_ans=force_int_ans,
            )
            if res is None:
                continue
            terms, ops, value = res
            meta_kind = forced_three_term_mode  # "all_add" / "add_sub_mix"
        else:
            raise NotImplementedError(band)

        # 共通ガード
        if value < 0:
            continue
        if value == 0:
            continue
        # 結果が 1 の自明な問題を弾く（ただし int_ans モードでは許容）
        if value == 1 and not force_int_ans:
            continue
        # 極端値ガード
        if abs(value) > 1000 or abs(value) < sp.Rational(1, 10000):
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
                "kind": meta_kind,
                "terms": [list(t) for t in terms],
                "ops": ops,
                "value_p": int(value.p),
                "value_q": int(value.q),
            },
        }
    raise RuntimeError(f"rank 16 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    terms = [tuple(t) for t in meta["terms"]]
    expected = sp.Rational(meta["value_p"], meta["value_q"])
    if _evaluate(terms, meta["ops"]) != expected:
        return False
    if av.canonical_for_rational(expected) != problem["answerCanonical"]:
        return False
    # 設計原則：問題式の各分数が既約であること（紙教材準拠）
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    # Band A int_ans 追加検証：答えが整数（==1 を許容）
    if meta["kind"] == "int_ans":
        if expected.q != 1:
            return False
    # Band B/C lcm 範囲検証：問題の lcm がサブパターン範囲内
    if meta["kind"] in ("easy_lcm", "medium_lcm", "hard_lcm"):
        if len(terms) != 2:
            return False
        d1, d2 = terms[0][1], terms[1][1]
        if d1 == d2:
            return False
        l = _lcm(d1, d2)
        lcm_min, lcm_max = _LCM_RANGES[meta["kind"]]
        if not (lcm_min <= l <= lcm_max):
            return False
    # Band D 検証：3項であること、演算子モードと整合
    if meta["kind"] == "all_add":
        if len(terms) != 3 or meta["ops"] != ["+", "+"]:
            return False
    elif meta["kind"] == "add_sub_mix":
        if len(terms) != 3:
            return False
        # 仕様：+ と - を最低各 1 個含む（[-,-] や all_add は不可）
        if "+" not in meta["ops"] or "-" not in meta["ops"]:
            return False
    return True
