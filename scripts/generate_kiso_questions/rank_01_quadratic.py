# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""1級：二次方程式（仕様書 §6.5、§6.8 決定 2/3）。

Phase 1（2026-05-05）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。

A: 因数分解で解ける整数解 15 問。重解と 0 含みは控えめに（slot_index 駆動）
   - subcounts={"double_root":1, "with_zero":1, "normal":13}
B: x²=c 形のみ 5 問。旧 P_rational（たすき掛け）は中学範囲外なので完全排除
C: 解の公式（無理数解）15 問。k>1 系（x = -1±2√3 等）を slot_index 駆動で
   必ず 5 問確保（k_eq_1=10 / k_gt_1=5）。max_bc=5 では k>1 が組合せ的に
   ほぼ出ないため、k>1 専用に max_bc_kgt1=12 を導入
D: 平方根法（新設）15 問。(x-p)²=q 形と ax²=c 形（with_p=7 / ax2_eq_c=8）

§6.8 決定 2: 解が分数なら必ず既約形
§6.8 決定 3: 解に √ が含まれる場合は簡約形・有理化済みのみ正解

問題式：``ax^2 + bx + c = 0`` または ``(x ± p)^2 = q`` または ``a x^2 = c``。
"""

from __future__ import annotations

import random
from math import gcd
from typing import Any, Dict, List, Set

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import poly_latex
from common.sympy_helpers import (
    simplify_sqrt,
    is_perfect_square,
    assert_problem_fractions_in_lowest_terms,
)


def _signed_int(rng: random.Random, max_abs: int, min_abs: int = 1) -> int:
    while True:
        v = rng.randint(-max_abs, max_abs)
        if abs(v) >= min_abs:
            return v


def _build_quadratic_problem(a: int, b: int, c: int) -> str:
    """ax² + bx + c = 0 の問題式 LaTeX。"""
    lhs = poly_latex([a, b, c])
    return f"{lhs} = 0"


# --- 解の表記（plain text） ------------------------------------------------

def _format_int_solutions(m: int, n: int) -> str:
    """整数解 2 つ：``x = m, n``（昇順）。重解なら ``x = m``。"""
    if m == n:
        return f"x = {m}"
    a, b = sorted([m, n])
    return f"x = {a}, {b}"


def _variants_for_int_solutions(m: int, n: int) -> List[str]:
    """整数解の許容表記。"""
    canonical = _format_int_solutions(m, n)
    seeds: Set[str] = {canonical}
    seeds.add(canonical.replace(" = ", "=").replace(", ", ","))
    seeds.add(canonical.replace(", ", ","))
    seeds.add(canonical.replace(" = ", "="))
    if m != n:
        a, b = sorted([m, n])
        rev = f"x = {b}, {a}"
        seeds.add(rev)
        seeds.add(rev.replace(" = ", "=").replace(", ", ","))
    result: Set[str] = set()
    for s in seeds:
        result.add(s)
        if "-" in s:
            result.add(s.replace("-", "−"))
            result.add(s.replace("-", "ー"))
    return sorted(result)


def _variants_for_pm_int(root: int) -> List[str]:
    """``x = ±root`` 形の許容表記（root > 0）。"""
    canonical = f"x = -{root}, {root}"
    seeds: Set[str] = {
        canonical,
        canonical.replace(" = ", "=").replace(", ", ","),
        canonical.replace(", ", ","),
        canonical.replace(" = ", "="),
        f"x = {root}, -{root}",
        f"x = ±{root}",
        f"x=±{root}",
    }
    result: Set[str] = set()
    for s in seeds:
        result.add(s)
        if "-" in s:
            result.add(s.replace("-", "−"))
            result.add(s.replace("-", "ー"))
    return sorted(result)


# --- Band A: 因数分解で解ける整数解 ----------------------------------------

def _gen_factorable_int(rng, max_root, subkind=None):
    """(x - m)(x - n) = 0 → x² - (m+n)x + mn = 0。

    subkind:
      - None         : 任意（既存挙動、後方互換）
      - 'double_root': m == n に強制（m == n == 0 は除外）
      - 'with_zero'  : m == 0 xor n == 0 に強制
      - 'normal'     : 両方非ゼロかつ m != n に強制
    """
    while True:
        if subkind == "double_root":
            m = _signed_int(rng, max_root, min_abs=1)
            n = m
        elif subkind == "with_zero":
            zero_first = rng.choice([True, False])
            other = _signed_int(rng, max_root, min_abs=1)
            m, n = (0, other) if zero_first else (other, 0)
        elif subkind == "normal":
            m = _signed_int(rng, max_root, min_abs=1)
            n = _signed_int(rng, max_root, min_abs=1)
            if m == n:
                continue
        else:
            m = rng.randint(-max_root, max_root)
            n = rng.randint(-max_root, max_root)
            if m == 0 and n == 0:
                continue
        a, b, c = 1, -(m + n), m * n
        problem_latex = _build_quadratic_problem(a, b, c)
        canonical = _format_int_solutions(m, n)
        allowed = _variants_for_int_solutions(m, n)
        return problem_latex, canonical, allowed, {
            "kind": "factorable_int", "a": a, "b": b, "c": c, "m": m, "n": n,
            "subkind": subkind or "any",
        }


# --- Band B: x² = c 形（square-free のみ） ----------------------------------

def _gen_x2_eq_c(rng):
    """x² = c → x² - c = 0、解 ±√c（c は square-free、正、2-49）。

    旧 _gen_rational_or_simple_sqrt の P_x2_eq_c パートを独立 generator に分離。
    P_rational（たすき掛けで解く有理数解）は中学範囲外のため Phase 1 では除外。
    """
    c_candidates = [n for n in range(2, 50) if simplify_sqrt(n) == (1, n)]
    c = rng.choice(c_candidates)
    A, B, C = 1, 0, -c
    problem_latex = _build_quadratic_problem(A, B, C)
    canonical = f"x = -√{c}, √{c}"
    seeds: Set[str] = {
        canonical,
        canonical.replace(" = ", "=").replace(", ", ","),
        canonical.replace(", ", ","),
        canonical.replace(" = ", "="),
        f"x = √{c}, -√{c}",
        f"x = ±√{c}",
        f"x=±√{c}",
    }
    expanded: Set[str] = set()
    for s in seeds:
        expanded.add(s)
        if "-" in s:
            expanded.add(s.replace("-", "−"))
            expanded.add(s.replace("-", "ー"))
    allowed = sorted(expanded)
    return problem_latex, canonical, allowed, {
        "kind": "x2_eq_c", "a": A, "b": B, "c": C, "c_radicand": c,
    }


# --- Band C: 解の公式が必要な無理数解 -------------------------------------

def _gen_irrational(rng, max_a, max_bc, k_constraint=None):
    """ax² + bx + c = 0 の解の公式：x = (-b ± √D) / (2a)、D = b² - 4ac。

    条件：D > 0 かつ D は完全平方でない（無理数解）。

    k_constraint:
      - None     : 任意（既存挙動、後方互換）
      - 'k_eq_1' : 簡約後の係数 k_red == 1 のみ採用
      - 'k_gt_1' : 簡約後の係数 k_red >= 2 のみ採用

    k_gt_1 は max_bc=5 では組合せ的にほぼ出ないため、呼び出し側で max_bc を
    拡張する（band_config の max_bc_kgt1）。retry 上限も増やす。
    """
    max_attempts = 500 if k_constraint is None else 3000
    for _ in range(max_attempts):
        a = rng.randint(1, max_a)
        b = rng.randint(-max_bc, max_bc)
        c = rng.randint(-max_bc, max_bc)
        D = b * b - 4 * a * c
        if D <= 0 or is_perfect_square(D):
            continue
        k, d = simplify_sqrt(D)
        p_raw = -b
        q_raw = 2 * a
        k_raw = k
        g = gcd(gcd(abs(p_raw), abs(k_raw)), abs(q_raw))
        if q_raw < 0:
            g = -g
        if g == 0:
            continue
        p_red = p_raw // g
        k_red = k_raw // g
        q_red = q_raw // g
        if k_red < 0:
            k_red = -k_red
        # k_constraint チェック
        if k_constraint == "k_eq_1" and k_red != 1:
            continue
        if k_constraint == "k_gt_1" and k_red < 2:
            continue
        problem_latex = _build_quadratic_problem(a, b, c)

        ksqrt = f"√{d}" if k_red == 1 else f"{k_red}√{d}"
        if p_red == 0:
            if q_red == 1:
                canonical = f"x = ±{ksqrt}"
            else:
                canonical = f"x = ±{ksqrt}/{q_red}"
        else:
            if q_red == 1:
                canonical = f"x = {p_red}±{ksqrt}"
            else:
                canonical = f"x = ({p_red}±{ksqrt})/{q_red}"

        def _build_pair(sign_first: bool) -> str:
            if p_red == 0:
                pos = ksqrt if q_red == 1 else f"{ksqrt}/{q_red}"
                neg = f"-{ksqrt}" if q_red == 1 else f"-{ksqrt}/{q_red}"
            else:
                if q_red == 1:
                    pos = f"{p_red}+{ksqrt}"
                    neg = f"{p_red}-{ksqrt}"
                else:
                    pos = f"({p_red}+{ksqrt})/{q_red}"
                    neg = f"({p_red}-{ksqrt})/{q_red}"
            if sign_first:
                return f"x = {pos}, {neg}"
            return f"x = {neg}, {pos}"

        pair_pos_first = _build_pair(sign_first=True)
        pair_neg_first = _build_pair(sign_first=False)

        seeds: Set[str] = {
            canonical,
            canonical.replace(" = ", "=").replace(" ± ", "±").replace(" ", ""),
            canonical.replace(" = ", "="),
            pair_pos_first,
            pair_pos_first.replace(" = ", "=").replace(", ", ","),
            pair_pos_first.replace(", ", ","),
            pair_pos_first.replace(" = ", "="),
            pair_neg_first,
            pair_neg_first.replace(" = ", "=").replace(", ", ","),
        }
        allowed = sorted(seeds)
        return problem_latex, canonical, allowed, {
            "kind": "irrational",
            "a": a, "b": b, "c": c,
            "p": p_red, "k": k_red, "d": d, "q": q_red,
        }
    return None


# --- Band D: 平方根法（新設、Phase 1） ------------------------------------
# 教育的根拠（ふくちさん 36 年の塾長経験）:
#   中3 二次方程式の核心は「因数分解 → 平方根法 → 解の公式の使い分け」だが、
#   旧構成では平方根法（(x-p)²=q と ax²=c）が一切練習できなかった。
#   Band D を新設して slot_index 駆動で 2 サブパターンを決定論的に分離する
#   （rank_05/06/08 の Band D 新設パターンと同じ）。
#
# サブパターン:
#   with_p    : (x ± p)² = q（q は完全平方、整数解）— 7 問
#   ax2_eq_c  : a x² = c（c/a は完全平方、整数解）— 8 問
#
# Phase 1 では q / c/a を完全平方に限定し、整数解のみとする。
# TODO_PHASE3: q や c/a が square-free（無理数解）になる問題は Band E 以降で導入。

def _gen_sqrt_method_with_p(rng):
    """(x ± p)² = q 形（q は完全平方、整数解）。

    例: (x - 3)² = 16 → x = 7, -1
    例: (x + 2)² = 25 → x = 3, -7
    p ∈ ±1〜±5（非ゼロ）、root ∈ {2, 3, 4, 5}、q = root²。
    解：x = p ± root（整数解 2 つ）。
    """
    p = _signed_int(rng, 5, min_abs=1)
    root = rng.choice([2, 3, 4, 5])
    q = root * root
    m = p + root
    n = p - root
    # 問題式: (x - p)² = q  ※ p > 0 → "x - p"、p < 0 → "x + |p|"
    if p > 0:
        problem_latex = f"(x - {p})^2 = {q}"
    else:
        problem_latex = f"(x + {abs(p)})^2 = {q}"
    canonical = _format_int_solutions(m, n)
    allowed = _variants_for_int_solutions(m, n)
    return problem_latex, canonical, allowed, {
        "kind": "sqrt_method", "subkind": "with_p",
        "p": p, "q": q, "m": m, "n": n,
    }


def _gen_sqrt_method_ax2_eq_c(rng):
    """a x² = c 形（c/a は完全平方、整数解）。

    例: 2x² = 18 → x = ±3
    例: 3x² = 12 → x = ±2
    a ∈ {2, 3, 4, 5}、root ∈ {2, 3, 4, 5, 6}、c = a · root²。
    解：x = ±root。
    """
    a = rng.choice([2, 3, 4, 5])
    root = rng.choice([2, 3, 4, 5, 6])
    c = a * root * root
    problem_latex = f"{a}x^2 = {c}"
    canonical = f"x = -{root}, {root}"
    allowed = _variants_for_pm_int(root)
    return problem_latex, canonical, allowed, {
        "kind": "sqrt_method", "subkind": "ax2_eq_c",
        "a": a, "c": c, "root": root,
    }


# --- slot_index 駆動の決定論的サブパターン dispatcher ----------------------

def _resolve_band_a_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """Band A：slot_index → "double_root" / "with_zero" / "normal"。"""
    cumulative = 0
    for subkind in ("double_root", "with_zero", "normal"):
        n = int(subcounts.get(subkind, 0))
        if slot_index < cumulative + n:
            return subkind
        cumulative += n
    return "normal"  # フォールバック


def _resolve_band_c_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """Band C：slot_index → "k_eq_1" / "k_gt_1"。"""
    cumulative = 0
    for subkind in ("k_eq_1", "k_gt_1"):
        n = int(subcounts.get(subkind, 0))
        if slot_index < cumulative + n:
            return subkind
        cumulative += n
    return "k_eq_1"  # フォールバック


def _resolve_band_d_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """Band D：slot_index → "with_p" / "ax2_eq_c"。"""
    cumulative = 0
    for subkind in ("with_p", "ax2_eq_c"):
        n = int(subcounts.get(subkind, 0))
        if slot_index < cumulative + n:
            return subkind
        cumulative += n
    return "ax2_eq_c"  # フォールバック


# --- 問題生成エントリポイント ---------------------------------------------

def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードで呼び出し側のスロット位置を受け取る。

    Band A/C/D で slot_index 駆動の決定論的サブパターン分離を行う。
    Band B は slot_index を無視（kind="x2_eq_c" 単一）。
    """
    cfg = get_band(1, band)
    kind = cfg["kind"]

    for _ in range(500):
        if kind == "factorable_int":
            sub = _resolve_band_a_subkind(slot_index, cfg.get("subcounts", {}))
            built = _gen_factorable_int(rng, cfg["max_root"], subkind=sub)
        elif kind == "x2_eq_c":
            built = _gen_x2_eq_c(rng)
        elif kind == "irrational":
            sub = _resolve_band_c_subkind(slot_index, cfg.get("subcounts", {}))
            # k_gt_1 のときは max_bc を拡張する（max_bc=5 では k>1 がほぼ出ない）
            max_bc = cfg["max_bc"] if sub == "k_eq_1" else cfg.get("max_bc_kgt1", cfg["max_bc"])
            built = _gen_irrational(rng, cfg["max_a"], max_bc, k_constraint=sub)
        elif kind == "sqrt_method":
            sub = _resolve_band_d_subkind(slot_index, cfg.get("subcounts", {}))
            if sub == "with_p":
                built = _gen_sqrt_method_with_p(rng)
            elif sub == "ax2_eq_c":
                built = _gen_sqrt_method_ax2_eq_c(rng)
            else:
                raise NotImplementedError(f"unknown subkind: {sub}")
        else:
            raise NotImplementedError(kind)
        if built is None:
            continue
        problem_latex, canonical, allowed, info = built
        return {
            "problemLatex": problem_latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 1,
                "band": band,
                **info,
            },
        }
    raise RuntimeError(f"rank 1 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    kind = meta["kind"]
    x = sp.symbols("x")

    if kind == "factorable_int":
        a, b, c = meta["a"], meta["b"], meta["c"]
        sols = sp.solve(a * x ** 2 + b * x + c, x)
        m, n = meta["m"], meta["n"]
        expected_set = {sp.Rational(m), sp.Rational(n)}
        actual_set = set(sp.Rational(s) for s in sols)
        if expected_set != actual_set:
            return False
        if _format_int_solutions(m, n) != problem["answerCanonical"]:
            return False
    elif kind == "x2_eq_c":
        a, b, c = meta["a"], meta["b"], meta["c"]
        sols = sp.solve(a * x ** 2 + b * x + c, x)
        cr = meta["c_radicand"]
        expected_set = {sp.sqrt(cr), -sp.sqrt(cr)}
        actual_set = set(sp.simplify(s) for s in sols)
        if expected_set != actual_set:
            return False
    elif kind == "irrational":
        a, b, c = meta["a"], meta["b"], meta["c"]
        sols = sp.solve(a * x ** 2 + b * x + c, x)
        p, k, d, q = meta["p"], meta["k"], meta["d"], meta["q"]
        s1 = sp.Rational(p, q) + sp.Rational(k, q) * sp.sqrt(d)
        s2 = sp.Rational(p, q) - sp.Rational(k, q) * sp.sqrt(d)
        expected_set = {sp.simplify(s1), sp.simplify(s2)}
        actual_set = set(sp.simplify(s) for s in sols)
        if expected_set != actual_set:
            return False
    elif kind == "sqrt_method":
        subkind = meta["subkind"]
        if subkind == "with_p":
            p, q, m, n = meta["p"], meta["q"], meta["m"], meta["n"]
            # (x - p)² = q  ⇔  m + n = 2p, m * n = p² - q
            if m + n != 2 * p:
                return False
            if m * n != p * p - q:
                return False
            # 整数解として canonical 表現が一致
            if _format_int_solutions(m, n) != problem["answerCanonical"]:
                return False
        elif subkind == "ax2_eq_c":
            a, c, root = meta["a"], meta["c"], meta["root"]
            # a · root² = c
            if a * root * root != c:
                return False
            if root <= 0:
                return False
        else:
            return False
    else:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
