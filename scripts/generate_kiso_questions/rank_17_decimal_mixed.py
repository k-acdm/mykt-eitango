# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""17級：小数 四則混合（仕様書 §6.5）。

Phase 1（2026-05-07 夜）: 30→50 題化、Band D を新設して 4 Band 構成に。
**Phase 1 完全制覇の歴史的 commit**（rank_20 と並行で完走、全 20 単元 1000 問達成）。

A: 2 項小数四則 12 問（slot_index 駆動、演算子均等化）
   subcounts={"add": 3, "sub": 3, "mul": 3, "div": 3}
   既存 +:- :× :÷ = 24 : 10 : 14 : 2 の偏りを完全解消
B: 3 項小数四則 14 問（カッコなし、既存 _gen_three_term 踏襲、count 拡大）
   ÷ なし（割り切れない組リスク回避、Phase 3 で対応）
C: 3 項小数四則 12 問（カッコあり、既存 _gen_three_term + _eval_with_paren 踏襲）
D: 答えが整数になる 3 項小数四則 12 問（新設、slot_index 駆動）
   subcounts={"no_paren": 6, "with_paren": 6}
   - no_paren: 1.5 × 2 + 1 = 4 系（演算子優先順位 + 整数答え）
   - with_paren: (0.8 + 0.4) × 5 = 6 系（カッコ + 整数答え）

すべて有限小数で完結する組のみ採用（仕様書 §6.5：割り切れない割り算は出さない）。

# TODO_PHASE3: 以下は Phase 3 で導入予定（rank_17）
#   1. 4 項以上の四則混合
#   2. 二重カッコ（((1.2 + 0.5) × 2) + 0.3）
#   3. 帯分数・分数混在 — rank_14 の領域、rank_17 では入れない
#   4. 後半カッコ（3.5 - (1.2 + 0.5)）— rank_09 領域として Phase 3 にも入れない
#      （rank_14/16/19 と同方針、ふくちさん 2026-05-07 判断踏襲）
#   5. Band B/C で ÷ を含む 3 項（割り切れる組のみ慎重に追加）
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Optional, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import OP_LATEX, decimal_latex, paren_expr_latex
from common.sympy_helpers import (
    is_finite_decimal,
    assert_problem_fractions_in_lowest_terms,
)


def _gen_decimal_simple(rng: random.Random, int_max: int, decimals: int) -> sp.Rational:
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


def _eval_with_precedence(
    terms: List[sp.Rational], ops: List[str]
) -> sp.Rational:
    """優先順位（×÷ → +-）を尊重して左から畳み込む。"""
    flat_terms = list(terms)
    flat_ops = list(ops)
    i = 0
    while i < len(flat_ops):
        if flat_ops[i] in ("*", "/"):
            l, r = flat_terms[i], flat_terms[i + 1]
            v = l * r if flat_ops[i] == "*" else l / r
            flat_terms[i] = v
            del flat_terms[i + 1]
            del flat_ops[i]
        else:
            i += 1
    result = flat_terms[0]
    for op, t in zip(flat_ops, flat_terms[1:]):
        result = result + t if op == "+" else result - t
    return sp.Rational(result)


# --- 既存ヘルパー（無修正） -------------------------------------------------

def _gen_two_term(rng, int_max, decimals):
    a = _gen_decimal_simple(rng, int_max, decimals)
    b = _gen_decimal_simple(rng, int_max, decimals)
    op = rng.choice(["+", "-", "*", "/"])
    if op == "/":
        # 商と除数を先に決めて被除数を作り直す
        q = _gen_decimal_simple(rng, int_max, decimals)
        d = _gen_decimal_simple(rng, int_max, decimals)
        a = q * d
        b = d
    return [a, b], [op]


def _gen_three_term(rng, int_max, decimals):
    """3 項：÷ は使わずに簡易化（17 級 B/C は ÷ なしでも十分難）。"""
    terms = [_gen_decimal_simple(rng, int_max, decimals) for _ in range(3)]
    ops = [rng.choice(["+", "-", "*"]) for _ in range(2)]
    return terms, ops


def _build_latex_no_parens(terms, ops):
    parts = [decimal_latex(terms[0])]
    for op, t in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(decimal_latex(t))
    return " ".join(parts)


def _build_latex_with_parens(terms, ops):
    """3 項のうち先頭 2 項を括弧で包む。例：(1.5 + 2.3) × 4。"""
    a, b, c = terms
    op1, op2 = ops
    inner = f"{decimal_latex(a)} {OP_LATEX[op1]} {decimal_latex(b)}"
    outer = f"{paren_expr_latex(inner)} {OP_LATEX[op2]} {decimal_latex(c)}"
    return outer


def _eval_with_paren(terms, ops):
    """先頭 2 項を括弧優先で評価。"""
    a, b, c = terms
    op1, op2 = ops
    inner = a + b if op1 == "+" else a - b if op1 == "-" else a * b if op1 == "*" else a / b
    if op2 == "+":
        return inner + c
    if op2 == "-":
        return inner - c
    if op2 == "*":
        return inner * c
    return inner / c


# --- 新ヘルパー：演算子強制（Band A）-------------------------------------

def _gen_two_term_with_op(
    rng: random.Random, int_max: int, decimals: int, op: str,
) -> Tuple[List[sp.Rational], List[str]]:
    """Band A 用：演算子を強制した 2 項小数。

    op: '+' / '-' / '*' / '/'
    既存 _gen_two_term と同じロジックを op 強制版に書き換え。
    """
    if op == "/":
        # 商と除数を先に決めて被除数を作り直す
        q = _gen_decimal_simple(rng, int_max, decimals)
        d = _gen_decimal_simple(rng, int_max, decimals)
        return [q * d, d], ["/"]
    a = _gen_decimal_simple(rng, int_max, decimals)
    b = _gen_decimal_simple(rng, int_max, decimals)
    if op == "-" and a < b:
        a, b = b, a
    return [a, b], [op]


# --- Band D 用：答えが整数になる 3 項小数四則 -----------------------------

def _gen_int_ans_three_term_no_paren(
    rng: random.Random, int_max: int, decimals: int,
) -> Optional[Tuple[List[sp.Rational], List[str]]]:
    """Band D no_paren: カッコなしの 3 項小数四則で答えが整数になる組を生成。

    例: 1.5 × 2 + 1 = 4 / 3 + 0.5 × 4 = 5 / 4.5 - 0.5 × 1 = 4
    演算子は +/-/× のみ（÷ なし、既存仕様維持）。
    """
    terms = [_gen_decimal_simple(rng, int_max, decimals) for _ in range(3)]
    ops = [rng.choice(["+", "-", "*"]) for _ in range(2)]
    return terms, ops


def _gen_int_ans_three_term_with_paren(
    rng: random.Random, int_max: int, decimals: int,
) -> Optional[Tuple[List[sp.Rational], List[str]]]:
    """Band D with_paren: カッコあり 3 項小数四則で答えが整数になる組を生成。

    例: (0.8 + 0.4) × 5 = 6 / (2.5 - 0.5) × 3 = 6 / (1.5 + 1.5) + 4 = 7
    演算子は +/-/× のみ。
    """
    terms = [_gen_decimal_simple(rng, int_max, decimals) for _ in range(3)]
    ops = [rng.choice(["+", "-", "*"]) for _ in range(2)]
    return terms, ops


# --- slot_index 駆動 dispatcher -------------------------------------------

def _resolve_band_a_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """Band A: slot_index → "add" / "sub" / "mul" / "div"（cumulative dispatch）。"""
    cumulative = 0
    for subkind in ("add", "sub", "mul", "div"):
        c = subcounts.get(subkind, 0)
        if c == 0:
            continue
        if slot_index < cumulative + c:
            return subkind
        cumulative += c
    return "div"  # フォールバック


def _resolve_band_d_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """Band D: slot_index → "no_paren" / "with_paren"（cumulative dispatch）。"""
    no_paren = subcounts.get("no_paren", 0)
    if slot_index < no_paren:
        return "no_paren"
    return "with_paren"


# 演算子マッピング
_OP_NAME_TO_SYM = {"add": "+", "sub": "-", "mul": "*", "div": "/"}


# --- generate_problem -------------------------------------------------------

def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    Band A: slot 0-2=add, 3-5=sub, 6-8=mul, 9-11=div（演算子均等化）
    Band B: 既存ロジック踏襲（slot_index 不使用）
    Band C: 既存ロジック踏襲（slot_index 不使用）
    Band D: slot 0-5=no_paren（答え整数強制）, 6-11=with_paren（答え整数強制）
    """
    cfg = get_band(17, band)
    int_max = cfg["int_max"]
    decimals = cfg["decimals"]
    subcounts = cfg.get("subcounts", {})

    forced_op: Optional[str] = None
    forced_subkind: Optional[str] = None

    if band == "A":
        forced_subkind = _resolve_band_a_subkind(slot_index, subcounts)
        forced_op = _OP_NAME_TO_SYM[forced_subkind]
    elif band == "D":
        forced_subkind = _resolve_band_d_subkind(slot_index, subcounts)

    for _ in range(800):
        try:
            if band == "A":
                terms, ops = _gen_two_term_with_op(rng, int_max, decimals, forced_op)
                result = _eval_with_precedence(terms, ops)
                latex = _build_latex_no_parens(terms, ops)
                meta_kind = forced_subkind  # add / sub / mul / div
                parens = False
            elif band == "B":
                # 既存ロジック踏襲（3項括弧なし）
                terms, ops = _gen_three_term(rng, int_max, decimals)
                if "/" in ops:
                    continue
                result = _eval_with_precedence(terms, ops)
                latex = _build_latex_no_parens(terms, ops)
                meta_kind = "three_term_no_parens"
                parens = False
            elif band == "C":
                # 既存ロジック踏襲（3項括弧あり）
                terms, ops = _gen_three_term(rng, int_max, decimals)
                if "/" in ops:
                    continue
                result = _eval_with_paren(terms, ops)
                latex = _build_latex_with_parens(terms, ops)
                meta_kind = "three_term_parens"
                parens = True
            elif band == "D":
                if forced_subkind == "no_paren":
                    res = _gen_int_ans_three_term_no_paren(rng, int_max, decimals)
                    if res is None:
                        continue
                    terms, ops = res
                    result = _eval_with_precedence(terms, ops)
                    latex = _build_latex_no_parens(terms, ops)
                    parens = False
                else:  # with_paren
                    res = _gen_int_ans_three_term_with_paren(rng, int_max, decimals)
                    if res is None:
                        continue
                    terms, ops = res
                    result = _eval_with_paren(terms, ops)
                    latex = _build_latex_with_parens(terms, ops)
                    parens = True
                meta_kind = forced_subkind
                # Band D は答え整数を強制
                if result.q != 1:
                    continue
            else:
                raise NotImplementedError(band)
        except ZeroDivisionError:
            continue

        if result <= 0:
            continue
        if not is_finite_decimal(result):
            continue
        if abs(result) > 200:
            continue

        # Band A は「小数四則混合」の導入として、答えが小数になる組合せのみ採用
        # （`1.2 + 5.8 = 7` のような整数答えは除外）。Band B/C は教育的多様性として許容。
        if band == "A" and result.q == 1:
            continue

        canonical = av.canonical_decimal_for_rational(result)
        allowed = av.variants_for_decimal_answer(result)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 17,
                "band": band,
                "kind": meta_kind,
                "terms_p_q": [(int(t.p), int(t.q)) for t in terms],
                "ops": ops,
                "parens": parens,
                "value_p": int(result.p),
                "value_q": int(result.q),
            },
        }
    raise RuntimeError(f"rank 17 band {band}: 800 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    terms = [sp.Rational(p, q) for p, q in meta["terms_p_q"]]
    expected = sp.Rational(meta["value_p"], meta["value_q"])
    if meta.get("parens") and len(terms) == 3:
        recomputed = _eval_with_paren(terms, meta["ops"])
    else:
        recomputed = _eval_with_precedence(terms, meta["ops"])
    if recomputed != expected:
        return False
    if av.canonical_decimal_for_rational(expected) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    # Band A 演算子整合性
    if meta.get("kind") in ("add", "sub", "mul", "div"):
        expected_op = _OP_NAME_TO_SYM[meta["kind"]]
        if meta["ops"] != [expected_op]:
            return False
    # Band D 検証：答えが整数 + 3 項
    if meta.get("kind") in ("no_paren", "with_paren"):
        if expected.q != 1:
            return False
        if len(terms) != 3:
            return False
        if meta.get("kind") == "no_paren" and meta.get("parens"):
            return False
        if meta.get("kind") == "with_paren" and not meta.get("parens"):
            return False
    return True
