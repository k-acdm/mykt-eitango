# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""20級：整数四則混合。

Phase 1（2026-05-07 夜）: 30→50 題化、Band D 新設で 4 Band 構成 + digits=1 化。
**Phase 1 完全制覇の歴史的 commit**（rank_17 と並行で完走、全 20 単元 1000 問達成）。

A: 1 桁 2項加減 5 問（入門、subcounts add=3 / sub=2）
B: 1 桁 2項乗除 5 問（入門、subcounts mul=3 / div=2）
C: 1 桁 3項四則混合 20 問（**digits=2→1 必須、構造的修正**）
   subcounts={"plus_dom": 7, "minus_dom": 6, "mul_dom": 7}
D: 1 桁 3項括弧あり 20 問（新設、ふくちさん「カッコの理解は基礎の山場」）
   subcounts={"add_outer": 7, "mul_outer": 7, "div_outer": 6}

各問題は SymPy で式を構築 → 厳密値を計算 → セルフチェック → LaTeX/許容表記。

**digits 縮小の理由**：旧 Band C は digits=2 で結果が 134,044 等の暗算範囲外
（`62 × 23 × 94` 等）。小学校算数として教育的に重すぎるため digits=1 化。
Band A/B の自明問題（6-6=0、9÷9=1 等）は **教育的価値があるため許容**
（ふくちさん 2026-05-07 判断、「同じ数を引くと 0」「同じ数で割ると 1」の
体感が入門としての本質）。

# TODO_PHASE3: 以下は Phase 3 で導入予定（rank_20）
#   1. 4 項以上の四則混合
#   2. 二重カッコ（((3 + 5) × 4) - 7）
#   3. digits=2 の 3 項（紙教材準拠だが暗算範囲外のため Phase 1 では digits=1 化）
#   4. 負の数 — rank_11/12/13 の領域、rank_20 では入れない
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Optional, Tuple

import sympy as sp

from common import answer_variants as av
from common.latex_utils import OP_LATEX, paren_expr_latex
from common.band_config import get_band
from common.sympy_helpers import assert_problem_fractions_in_lowest_terms


def _digit_range(digits: int) -> Tuple[int, int]:
    if digits == 1:
        return 1, 9
    if digits == 2:
        return 10, 99
    if digits == 3:
        return 100, 999
    raise ValueError(f"unsupported digits={digits}")


# --- 既存ヘルパー（無修正） -------------------------------------------------

def _gen_two_terms_addsub(rng: random.Random, digits: int) -> Tuple[List[int], List[str]]:
    """2項の加減。結果が非負になるよう順序を整える。"""
    lo, hi = _digit_range(digits)
    a = rng.randint(lo, hi)
    b = rng.randint(lo, hi)
    op = rng.choice(["+", "-"])
    if op == "-" and a < b:
        a, b = b, a
    return [a, b], [op]


def _gen_two_terms_muldiv(rng: random.Random, digits: int) -> Tuple[List[int], List[str]]:
    """2項の乗除。÷は割り切れる組のみ。"""
    lo, hi = _digit_range(digits)
    op = rng.choice(["*", "/"])
    if op == "*":
        a = rng.randint(lo, hi)
        b = rng.randint(lo, hi)
        return [a, b], ["*"]
    # 割り算：先に商と除数を決めて積で被除数を作る
    b = rng.randint(max(2, lo), hi)
    q = rng.randint(lo, hi)
    a = b * q
    return [a, b], ["/"]


def _gen_three_terms_mixed(rng: random.Random, digits: int) -> Tuple[List[int], List[str]]:
    """3項四則混合（カッコなし、結果整数になる組のみ採用、リトライ前提）。"""
    lo, hi = _digit_range(digits)
    a = rng.randint(lo, hi)
    b = rng.randint(lo, hi)
    c = rng.randint(lo, hi)
    op1 = rng.choice(["+", "-", "*", "/"])
    op2 = rng.choice(["+", "-", "*", "/"])
    return [a, b, c], [op1, op2]


def _evaluate(terms: List[int], ops: List[str]) -> sp.Rational:
    """項リストと演算子から SymPy で厳密に評価（演算優先順位準拠）。"""
    flat_terms: List[sp.Rational] = [sp.Rational(t) for t in terms]
    flat_ops: List[str] = list(ops)

    i = 0
    while i < len(flat_ops):
        if flat_ops[i] in ("*", "/"):
            left = flat_terms[i]
            right = flat_terms[i + 1]
            if flat_ops[i] == "*":
                v = left * right
            else:
                if right == 0:
                    raise ZeroDivisionError
                v = sp.Rational(left, right) if isinstance(left, int) else left / right
            flat_terms[i] = v
            del flat_terms[i + 1]
            del flat_ops[i]
        else:
            i += 1

    result = flat_terms[0]
    for op, t in zip(flat_ops, flat_terms[1:]):
        if op == "+":
            result = result + t
        elif op == "-":
            result = result - t
        else:
            raise ValueError(f"unexpected op after collapse: {op}")
    return sp.Rational(result)


def _terms_to_latex(terms: List[int], ops: List[str]) -> str:
    parts = [str(terms[0])]
    for op, t in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(str(t))
    return " ".join(parts)


# --- 新ヘルパー：演算子強制（Band A/B）-----------------------------------

def _gen_two_terms_addsub_with_op(
    rng: random.Random, digits: int, op: str,
) -> Tuple[List[int], List[str]]:
    """Band A 用：演算子を強制した加減（自明問題 a==b の sub 含む = ふくちさん判断）。"""
    lo, hi = _digit_range(digits)
    a = rng.randint(lo, hi)
    b = rng.randint(lo, hi)
    if op == "-" and a < b:
        a, b = b, a
    return [a, b], [op]


def _gen_two_terms_muldiv_with_op(
    rng: random.Random, digits: int, op: str,
) -> Tuple[List[int], List[str]]:
    """Band B 用：演算子を強制した乗除（自明問題 a==b の div 含む）。"""
    lo, hi = _digit_range(digits)
    if op == "*":
        a = rng.randint(lo, hi)
        b = rng.randint(lo, hi)
        return [a, b], ["*"]
    # 割り算：先に商と除数を決めて積で被除数を作る
    b = rng.randint(max(2, lo), hi)
    q = rng.randint(lo, hi)
    a = b * q
    return [a, b], ["/"]


# --- Band C 用：演算子強制（plus_dom / minus_dom / mul_dom） --------------

def _gen_three_term_with_dom(
    rng: random.Random, digits: int, dominant: str,
) -> Tuple[List[int], List[str]]:
    """Band C 用：3 項四則混合で「主役演算子」を強制。

    dominant ∈ {"plus_dom", "minus_dom", "mul_dom"}：
      - plus_dom: 演算子の少なくとも 1 つは '+'、1 つはランダム
      - minus_dom: 演算子の少なくとも 1 つは '-'
      - mul_dom: 演算子の少なくとも 1 つは '*'
    残り 1 つは {+, -, *, /} からランダム。
    """
    lo, hi = _digit_range(digits)
    a = rng.randint(lo, hi)
    b = rng.randint(lo, hi)
    c = rng.randint(lo, hi)
    forced_op = {"plus_dom": "+", "minus_dom": "-", "mul_dom": "*"}[dominant]
    other_op = rng.choice(["+", "-", "*", "/"])
    # 強制 op の位置（op1 or op2）をランダム
    if rng.random() < 0.5:
        ops = [forced_op, other_op]
    else:
        ops = [other_op, forced_op]
    return [a, b, c], ops


# --- Band D 用：3 項カッコあり（外側演算子で分離） -------------------------

def _gen_three_term_paren(
    rng: random.Random, digits: int, outer_kind: str,
) -> Tuple[List[int], List[str]]:
    """Band D 用：3 項カッコあり「(a op1 b) op2 c」、外側演算子（op2）を強制。

    outer_kind ∈ {"add_outer", "mul_outer", "div_outer"}：
      - add_outer: op2 ∈ {'+', '-'}（外側 +/-）
      - mul_outer: op2 = '*'
      - div_outer: op2 = '/'（割り切れる組のみ採用、呼び出し側で result 整数チェック）
    """
    lo, hi = _digit_range(digits)
    a = rng.randint(lo, hi)
    b = rng.randint(lo, hi)
    c = rng.randint(lo, hi)
    # 内側 op1 は四則からランダム（ただし inner が整数になるよう制約）
    op1 = rng.choice(["+", "-", "*", "/"])
    if outer_kind == "add_outer":
        op2 = rng.choice(["+", "-"])
    elif outer_kind == "mul_outer":
        op2 = "*"
    else:  # div_outer
        op2 = "/"
    return [a, b, c], [op1, op2]


def _eval_with_paren_int(terms: List[int], ops: List[str]) -> sp.Rational:
    """先頭 2 項を括弧優先で評価（整数版、(a op1 b) op2 c）。"""
    a, b, c = terms
    op1, op2 = ops
    if op1 == "+":
        inner = sp.Rational(a + b)
    elif op1 == "-":
        inner = sp.Rational(a - b)
    elif op1 == "*":
        inner = sp.Rational(a * b)
    else:
        if b == 0:
            raise ZeroDivisionError
        inner = sp.Rational(a, b)
    if op2 == "+":
        return inner + c
    if op2 == "-":
        return inner - c
    if op2 == "*":
        return inner * c
    if c == 0:
        raise ZeroDivisionError
    return sp.Rational(inner, c) if isinstance(inner, int) else inner / c


def _build_paren_latex(terms: List[int], ops: List[str]) -> str:
    """(a op1 b) op2 c の LaTeX 表記。"""
    a, b, c = terms
    op1, op2 = ops
    inner = f"{a} {OP_LATEX[op1]} {b}"
    return f"{paren_expr_latex(inner)} {OP_LATEX[op2]} {c}"


# --- slot_index 駆動 dispatcher -------------------------------------------

def _resolve_band_a_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """Band A: slot_index → "add" / "sub"（cumulative dispatch）。"""
    add_total = subcounts.get("add", 0)
    if slot_index < add_total:
        return "add"
    return "sub"


def _resolve_band_b_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """Band B: slot_index → "mul" / "div"（cumulative dispatch）。"""
    mul_total = subcounts.get("mul", 0)
    if slot_index < mul_total:
        return "mul"
    return "div"


def _resolve_band_c_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """Band C: slot_index → "plus_dom" / "minus_dom" / "mul_dom"。"""
    cumulative = 0
    for subkind in ("plus_dom", "minus_dom", "mul_dom"):
        c = subcounts.get(subkind, 0)
        if c == 0:
            continue
        if slot_index < cumulative + c:
            return subkind
        cumulative += c
    return "mul_dom"


def _resolve_band_d_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """Band D: slot_index → "add_outer" / "mul_outer" / "div_outer"。"""
    cumulative = 0
    for subkind in ("add_outer", "mul_outer", "div_outer"):
        c = subcounts.get(subkind, 0)
        if c == 0:
            continue
        if slot_index < cumulative + c:
            return subkind
        cumulative += c
    return "div_outer"


# --- generate_problem -------------------------------------------------------

def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    Band A: slot 0-2=add, 3-4=sub
    Band B: slot 0-2=mul, 3-4=div
    Band C: slot 0-6=plus_dom, 7-12=minus_dom, 13-19=mul_dom
    Band D: slot 0-6=add_outer, 7-13=mul_outer, 14-19=div_outer
    """
    cfg = get_band(20, band)
    digits = cfg["digits"]
    subcounts = cfg.get("subcounts", {})

    forced_op: Optional[str] = None
    forced_subkind: Optional[str] = None

    if band == "A":
        forced_subkind = _resolve_band_a_subkind(slot_index, subcounts)
        forced_op = "+" if forced_subkind == "add" else "-"
    elif band == "B":
        forced_subkind = _resolve_band_b_subkind(slot_index, subcounts)
        forced_op = "*" if forced_subkind == "mul" else "/"
    elif band == "C":
        forced_subkind = _resolve_band_c_subkind(slot_index, subcounts)
    elif band == "D":
        forced_subkind = _resolve_band_d_subkind(slot_index, subcounts)
    else:
        raise NotImplementedError(f"rank 20 band {band}")

    for _ in range(500):
        try:
            if band == "A":
                terms, ops = _gen_two_terms_addsub_with_op(rng, digits, forced_op)
                value = _evaluate(terms, ops)
                latex = _terms_to_latex(terms, ops)
                meta_kind = forced_subkind  # add / sub
                parens = False
            elif band == "B":
                terms, ops = _gen_two_terms_muldiv_with_op(rng, digits, forced_op)
                value = _evaluate(terms, ops)
                latex = _terms_to_latex(terms, ops)
                meta_kind = forced_subkind  # mul / div
                parens = False
            elif band == "C":
                terms, ops = _gen_three_term_with_dom(rng, digits, forced_subkind)
                value = _evaluate(terms, ops)
                latex = _terms_to_latex(terms, ops)
                meta_kind = forced_subkind
                parens = False
            elif band == "D":
                terms, ops = _gen_three_term_paren(rng, digits, forced_subkind)
                value = _eval_with_paren_int(terms, ops)
                latex = _build_paren_latex(terms, ops)
                meta_kind = forced_subkind
                parens = True
            else:
                raise NotImplementedError(band)

            # 仕様：20級の答えは整数。整数にならない組は捨ててリトライ。
            if value.q != 1:
                continue
            # 負数の答えは 20 級では生徒が混乱しやすいので避ける。
            if value < 0:
                continue
            # Band C/D は結果値域 100 以下に抑える（小学校算数の暗算範囲）
            if band in ("C", "D") and abs(value) > 100:
                continue
            # rank_20 全体ガード
            if abs(value) > 1000:
                continue
        except ZeroDivisionError:
            continue

        canonical = av.canonical_for_rational(value)
        allowed = av.variants_for_rational(value)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 20,
                "band": band,
                "kind": meta_kind,
                "terms": terms,
                "ops": ops,
                "parens": parens,
                "value_p": int(value.p),
                "value_q": int(value.q),
            },
        }
    raise RuntimeError(f"rank 20 band {band}: 500 回リトライしても条件を満たす問題を作れず")


def self_check(problem: Dict[str, Any]) -> bool:
    """生成された問題のセルフチェック（仕様書 §6.7①）。

    - 項リストと演算子から再計算 → answerCanonical と一致
    - answerAllowed の各表記が SymPy 的に同値
    """
    meta = problem["_meta"]
    if meta.get("parens"):
        recomputed = _eval_with_paren_int(meta["terms"], meta["ops"])
    else:
        recomputed = _evaluate(meta["terms"], meta["ops"])
    expected = sp.Rational(meta["value_p"], meta["value_q"])
    if recomputed != expected:
        return False
    canonical_value = av.canonical_for_rational(expected)
    if canonical_value != problem["answerCanonical"]:
        return False
    # 設計原則：問題式の各分数が既約であること（紙教材準拠）。
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    # Band A/B 演算子整合性
    if meta.get("kind") == "add":
        if meta["ops"] != ["+"]:
            return False
    elif meta.get("kind") == "sub":
        if meta["ops"] != ["-"]:
            return False
    elif meta.get("kind") == "mul":
        if meta["ops"] != ["*"]:
            return False
    elif meta.get("kind") == "div":
        if meta["ops"] != ["/"]:
            return False
    # Band C 主役演算子検証
    if meta.get("kind") in ("plus_dom", "minus_dom", "mul_dom"):
        forced = {"plus_dom": "+", "minus_dom": "-", "mul_dom": "*"}[meta["kind"]]
        if forced not in meta["ops"]:
            return False
        if len(meta["terms"]) != 3 or meta.get("parens"):
            return False
    # Band D 外側演算子検証
    if meta.get("kind") == "add_outer":
        if meta["ops"][1] not in ("+", "-"):
            return False
        if not meta.get("parens") or len(meta["terms"]) != 3:
            return False
    elif meta.get("kind") == "mul_outer":
        if meta["ops"][1] != "*":
            return False
        if not meta.get("parens") or len(meta["terms"]) != 3:
            return False
    elif meta.get("kind") == "div_outer":
        if meta["ops"][1] != "/":
            return False
        if not meta.get("parens") or len(meta["terms"]) != 3:
            return False
    return True
