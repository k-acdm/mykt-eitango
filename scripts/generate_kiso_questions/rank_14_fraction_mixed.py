# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""14級：分数 四則混合（仕様書 §6.5）。

Phase 1（2026-05-07）:
  A: 2項 四則混合 12 問（既存ロジック踏襲）
  B: 3項 四則混合（括弧なし、優先順位で計算）14 問（既存ロジック踏襲）
  C: 3項 四則混合（括弧あり、先頭カッコのみ）12 問（既存ロジック踏襲）
  D: 整数を含む混合 12 問（新設、slot_index 駆動 3 サブパターン）
     - int_addsub: 整数 ± 分数（4 問）
     - int_mul:    整数 × 分数（4 問）
     - int_div:    整数 ÷ 分数（4 問）

§6.4.0 既約性原則：問題式の各分数は GCD=1。

# TODO_PHASE3: 以下は Phase 3 で導入予定（rank_14）
#   1. 帯分数表記（2\\frac{1}{3} + 1\\frac{1}{2}）
#   2. 小数混在（0.5 + 1/2）
#   3. 4項以上の四則混合
#   4. Band A の演算子配分（現状 - が偏っている、subcounts={"add":3,"sub":3,"mul":3,"div":3} 化候補）
#   5. 後半カッコ（3/4 - (1/2 + 1/4)）— ただし「カッコの外し方」が本質のため、
#      rank_14 のスコープではなく rank_09 Band D paren_addsub の領域。
#      rank_14 の Phase 3 にも入れない方針（ふくちさん 2026-05-07 判断）
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import frac_latex_raw, OP_LATEX, paren_expr_latex
from common.sympy_helpers import (
    pick_coprime_numerator,
    assert_problem_fractions_in_lowest_terms,
)


def _gen_fraction(rng: random.Random, denom_max: int) -> Tuple[int, int]:
    d = rng.randint(2, denom_max)
    n = pick_coprime_numerator(rng, d)
    return n, d


def _eval_with_precedence(terms: List[Tuple[int, int]], ops: List[str]) -> sp.Rational:
    """×÷ → +- の優先順位で左結合畳み込み。"""
    flat_terms = [sp.Rational(*t) for t in terms]
    flat_ops = list(ops)
    i = 0
    while i < len(flat_ops):
        if flat_ops[i] in ("*", "/"):
            l, r = flat_terms[i], flat_terms[i + 1]
            v = l * r if flat_ops[i] == "*" else (l / r if r != 0 else None)
            if v is None:
                raise ZeroDivisionError
            flat_terms[i] = v
            del flat_terms[i + 1]
            del flat_ops[i]
        else:
            i += 1
    result = flat_terms[0]
    for op, t in zip(flat_ops, flat_terms[1:]):
        result = result + t if op == "+" else result - t
    return sp.Rational(result)


def _eval_with_paren(terms, ops):
    """先頭 2 項を括弧優先で評価して 3 項目と合わせる。"""
    a, b, c = [sp.Rational(*t) for t in terms]
    op1, op2 = ops
    if op1 == "+":
        inner = a + b
    elif op1 == "-":
        inner = a - b
    elif op1 == "*":
        inner = a * b
    else:
        inner = a / b if b != 0 else None
    if inner is None:
        raise ZeroDivisionError
    if op2 == "+":
        return inner + c
    if op2 == "-":
        return inner - c
    if op2 == "*":
        return inner * c
    if c == 0:
        raise ZeroDivisionError
    return inner / c


def _build_no_parens(terms, ops):
    parts = [frac_latex_raw(*terms[0])]
    for op, t in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(frac_latex_raw(*t))
    return " ".join(parts)


def _build_with_parens(terms, ops):
    a, b, c = terms
    op1, op2 = ops
    inner = f"{frac_latex_raw(*a)} {OP_LATEX[op1]} {frac_latex_raw(*b)}"
    return f"{paren_expr_latex(inner)} {OP_LATEX[op2]} {frac_latex_raw(*c)}"


# --- Band D: 整数を含む混合 ヘルパー ----------------------------------------

def _term_str(t: Tuple[int, int]) -> str:
    """項 (n,d) を LaTeX 化。d==1 なら整数表記、それ以外は frac_latex_raw。"""
    n, d = t
    if d == 1:
        return f"{n}"
    return frac_latex_raw(n, d)


def _build_two_term(terms, ops):
    """2 項用：整数項を含めて表示できる版。"""
    parts = [_term_str(terms[0])]
    for op, t in zip(ops, terms[1:]):
        parts.append(OP_LATEX[op])
        parts.append(_term_str(t))
    return " ".join(parts)


def _gen_int_addsub_fraction(rng: random.Random, denom_max: int, int_max: int):
    """整数 ± 分数：(整数, 分数) または (分数, 整数) の順序を両方含む。"""
    n, d = _gen_fraction(rng, denom_max)
    k = rng.randint(1, int_max)
    op = rng.choice(["+", "-"])
    int_first = rng.choice([True, False])
    if int_first:
        terms = [(k, 1), (n, d)]
    else:
        terms = [(n, d), (k, 1)]
    return terms, [op]


def _gen_int_mul_fraction(rng: random.Random, denom_max: int, int_max: int):
    """整数 × 分数：(整数, 分数) または (分数, 整数) の順序を両方含む。"""
    n, d = _gen_fraction(rng, denom_max)
    k = rng.randint(2, int_max)
    int_first = rng.choice([True, False])
    if int_first:
        terms = [(k, 1), (n, d)]
    else:
        terms = [(n, d), (k, 1)]
    return terms, ["*"]


def _gen_int_div_fraction(rng: random.Random, denom_max: int, int_max: int):
    """整数 ÷ 分数：(整数, 分数) または (分数, 整数) の順序を両方含む。"""
    n, d = _gen_fraction(rng, denom_max)
    k = rng.randint(2, int_max)
    int_first = rng.choice([True, False])
    if int_first:
        terms = [(k, 1), (n, d)]
    else:
        terms = [(n, d), (k, 1)]
    return terms, ["/"]


def _resolve_band_d_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → "int_addsub" / "int_mul" / "int_div"。

    cumulative dispatch 方式：subcounts の順序通りに dispatch する。
    例: subcounts={"int_addsub":4, "int_mul":4, "int_div":4}, count=12
        slot 0..3   → "int_addsub"
        slot 4..7   → "int_mul"
        slot 8..11  → "int_div"

    rank_03/02/07/08/01/12/11/13/09 で確立した方式と同一。
    rng.choice の偶然依存を解消し、教育的配分を**確実**に守る。
    """
    cumulative = 0
    for subkind in ("int_addsub", "int_mul", "int_div"):
        cumulative += subcounts.get(subkind, 0)
        if slot_index < cumulative:
            return subkind
    return "int_div"  # フォールバック（subcounts 合計超過時）


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    Band D（int_with_frac）のみ slot_index 駆動で 3 サブパターン
    （int_addsub / int_mul / int_div）を決定論的に dispatch する。
    A/B/C は slot_index を無視（既存挙動を温存）。
    """
    cfg = get_band(14, band)
    kind = cfg["kind"]

    # Band D：slot_index でサブパターンを強制指定
    forced_subkind = None
    if kind == "int_with_frac":
        forced_subkind = _resolve_band_d_subkind(slot_index, cfg.get("subcounts", {}))

    for _ in range(500):
        try:
            if kind == "two_term":
                denom_max = cfg["denom_max"]
                terms = [_gen_fraction(rng, denom_max) for _ in range(2)]
                ops = [rng.choice(["+", "-", "*", "/"])]
                result = _eval_with_precedence(terms, ops)
                latex = _build_no_parens(terms, ops)
                meta_kind = kind
            elif kind == "three_term_no_parens":
                denom_max = cfg["denom_max"]
                terms = [_gen_fraction(rng, denom_max) for _ in range(3)]
                ops = [rng.choice(["+", "-", "*", "/"]) for _ in range(2)]
                result = _eval_with_precedence(terms, ops)
                latex = _build_no_parens(terms, ops)
                meta_kind = kind
            elif kind == "three_term_parens":
                denom_max = cfg["denom_max"]
                terms = [_gen_fraction(rng, denom_max) for _ in range(3)]
                ops = [rng.choice(["+", "-", "*", "/"]) for _ in range(2)]
                result = _eval_with_paren(terms, ops)
                latex = _build_with_parens(terms, ops)
                meta_kind = kind
            elif kind == "int_with_frac":
                denom_max = cfg["denom_max"]
                if forced_subkind == "int_addsub":
                    int_max = cfg.get("int_max_addsub", 10)
                    terms, ops = _gen_int_addsub_fraction(rng, denom_max, int_max)
                elif forced_subkind == "int_mul":
                    int_max = cfg.get("int_max_muldiv", 12)
                    terms, ops = _gen_int_mul_fraction(rng, denom_max, int_max)
                else:  # int_div
                    int_max = cfg.get("int_max_muldiv", 12)
                    terms, ops = _gen_int_div_fraction(rng, denom_max, int_max)
                result = _eval_with_precedence(terms, ops)
                latex = _build_two_term(terms, ops)
                meta_kind = forced_subkind
            else:
                raise NotImplementedError(kind)
        except ZeroDivisionError:
            continue

        if result <= 0:
            continue
        if result == 0:
            continue
        # 結果が 1 の自明な問題を弾く
        if result == 1:
            continue
        # あまりに巨大 / 微小な結果は教育的でないので除外
        if abs(result) > 1000 or abs(result) < sp.Rational(1, 10000):
            continue

        canonical = av.canonical_for_rational(result)
        allowed = av.variants_for_rational(result)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 14,
                "band": band,
                "kind": meta_kind,
                "terms": [list(t) for t in terms],
                "ops": ops,
                "value_p": int(result.p),
                "value_q": int(result.q),
            },
        }
    raise RuntimeError(f"rank 14 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    terms = [tuple(t) for t in meta["terms"]]
    expected = sp.Rational(meta["value_p"], meta["value_q"])
    if meta["kind"] == "three_term_parens":
        recom = _eval_with_paren(terms, meta["ops"])
    else:
        # two_term / three_term_no_parens / int_addsub / int_mul / int_div
        recom = _eval_with_precedence(terms, meta["ops"])
    if recom != expected:
        return False
    if av.canonical_for_rational(expected) != problem["answerCanonical"]:
        return False
    # Band D（整数項を含む）では問題式に整数 1 桁/2 桁が混じるため、
    # assert_problem_fractions_in_lowest_terms は「分数のみ」を検査するヘルパー。
    # 整数項は分数として書かれていないため検査をスキップしても整合する。
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    # Band D 追加検証：整数項と分数項が両方含まれていること
    if meta["kind"] in ("int_addsub", "int_mul", "int_div"):
        has_int = any(t[1] == 1 for t in terms)
        has_frac = any(t[1] != 1 for t in terms)
        if not (has_int and has_frac):
            return False
    return True
