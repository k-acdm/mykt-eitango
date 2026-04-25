# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""1級：二次方程式（仕様書 §6.5、§6.8 決定 2/3）。

A: 因数分解で解ける整数解（重解含む）— x² + bx + c = 0、解は m, n の整数
B: 因数分解で解ける有理数解 or x² = c のシンプルな無理数解
C: 解の公式必須の無理数解（(p ± √d)/q 形式）

§6.8 決定 2: 解が分数なら必ず既約形
§6.8 決定 3: 解に √ が含まれる場合は簡約形・有理化済みのみ正解

問題式：``ax^2 + bx + c = 0`` の形式、a >= 1。
答え：``x = m, n``（整数 or 既約分数）または ``x = m`` （重解）または
       ``x = (p+√d)/q, (p-√d)/q``（無理数）。
"""

from __future__ import annotations

import random
from math import gcd
from typing import Any, Dict, List, Set, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import poly_latex
from common.sympy_helpers import (
    simplify_sqrt,
    is_perfect_square,
    assert_problem_fractions_in_lowest_terms,
)


def _build_quadratic_problem(a: int, b: int, c: int) -> str:
    """ax² + bx + c = 0 の問題式 LaTeX。"""
    lhs = poly_latex([a, b, c])
    return f"{lhs} = 0"


def _format_rational(p: int, q: int) -> str:
    """plain text で既約分数 or 整数。"""
    if q == 0:
        raise ZeroDivisionError
    g = gcd(abs(p), abs(q))
    p, q = p // g, q // g
    if q < 0:
        p, q = -p, -q
    if q == 1:
        return str(p)
    return f"{p}/{q}"


# --- 解の表記（plain text） ------------------------------------------------

def _format_int_solutions(m: int, n: int) -> str:
    """整数解 2 つ：``x = m, n``（昇順）。重解なら ``x = m``。"""
    if m == n:
        return f"x = {m}"
    a, b = sorted([m, n])
    return f"x = {a}, {b}"


def _format_rational_solutions(sol1: sp.Rational, sol2: sp.Rational) -> str:
    """有理数解 2 つ：``x = a, b``。重解なら ``x = a``。a, b は SymPy Rational。"""
    if sol1 == sol2:
        return f"x = {av.canonical_for_rational(sol1)}"
    # 数値で昇順
    s1 = av.canonical_for_rational(sol1)
    s2 = av.canonical_for_rational(sol2)
    if sol1 < sol2:
        return f"x = {s1}, {s2}"
    return f"x = {s2}, {s1}"


def _format_irrational_solutions(p: int, d: int, q: int) -> str:
    """(p+√d)/q, (p-√d)/q 形式の無理数解（plain text）。

    q > 0 を強制し、gcd(p, q, d_coef) で約分は呼び出し側責務。
    d は square-free（簡約済み）。
    """
    if q == 1:
        return f"x = {p}+√{d}, {p}-√{d}"
    return f"x = ({p}+√{d})/{q}, ({p}-√{d})/{q}"


def _variants_for_int_solutions(m: int, n: int) -> List[str]:
    """整数解の許容表記。"""
    canonical = _format_int_solutions(m, n)
    seeds: Set[str] = {canonical}
    seeds.add(canonical.replace(" = ", "=").replace(", ", ","))
    seeds.add(canonical.replace(", ", ","))
    seeds.add(canonical.replace(" = ", "="))
    # 順序を反転した版も許容
    if m != n:
        a, b = sorted([m, n])
        rev = f"x = {b}, {a}"
        seeds.add(rev)
        seeds.add(rev.replace(" = ", "=").replace(", ", ","))
    # マイナス全/半角
    result: Set[str] = set()
    for s in seeds:
        result.add(s)
        if "-" in s:
            result.add(s.replace("-", "−"))
            result.add(s.replace("-", "ー"))
    return sorted(result)


def _variants_for_rational_solutions(sol1: sp.Rational, sol2: sp.Rational) -> List[str]:
    canonical = _format_rational_solutions(sol1, sol2)
    seeds: Set[str] = {canonical}
    seeds.add(canonical.replace(" = ", "=").replace(", ", ","))
    seeds.add(canonical.replace(", ", ","))
    seeds.add(canonical.replace(" = ", "="))
    # 順序反転
    if sol1 != sol2:
        s1 = av.canonical_for_rational(sol1)
        s2 = av.canonical_for_rational(sol2)
        if sol1 < sol2:
            rev = f"x = {s2}, {s1}"
        else:
            rev = f"x = {s1}, {s2}"
        seeds.add(rev)
    result: Set[str] = set()
    for s in seeds:
        result.add(s)
        for variant in [s.replace("-", "−"), s.replace("-", "ー"),
                        s.replace("/", "／")]:
            result.add(variant)
    return sorted(result)


def _variants_for_irrational_solutions(p: int, d: int, q: int) -> List[str]:
    canonical = _format_irrational_solutions(p, d, q)
    seeds: Set[str] = {canonical}
    # 空白除去
    seeds.add(canonical.replace(" = ", "=").replace(", ", ","))
    seeds.add(canonical.replace(", ", ","))
    seeds.add(canonical.replace(" = ", "="))
    # 順序反転：マイナス先 → プラス先
    if q == 1:
        rev = f"x = {p}-√{d}, {p}+√{d}"
    else:
        rev = f"x = ({p}-√{d})/{q}, ({p}+√{d})/{q}"
    seeds.add(rev)
    seeds.add(rev.replace(" = ", "=").replace(", ", ","))
    result: Set[str] = set()
    for s in seeds:
        result.add(s)
        for variant in [s.replace("-", "−"), s.replace("/", "／")]:
            result.add(variant)
    return sorted(result)


# --- Band A: 因数分解で解ける整数解 ----------------------------------------

def _gen_factorable_int(rng, max_root):
    """(x - m)(x - n) = 0 → x² - (m+n)x + mn = 0。m, n は整数（重解 m == n も可）。"""
    while True:
        m = rng.randint(-max_root, max_root)
        n = rng.randint(-max_root, max_root)
        # 退屈な x = 0, 0 や x = 0, k は避ける
        if m == 0 and n == 0:
            continue
        # 自明な x = 0, k 系も少し控えめに（教育的にはアリだが、Band A 入門で偏らないよう
        # 1 問程度に留めたい場合は別途制御）
        a, b, c = 1, -(m + n), m * n
        problem_latex = _build_quadratic_problem(a, b, c)
        canonical = _format_int_solutions(m, n)
        allowed = _variants_for_int_solutions(m, n)
        return problem_latex, canonical, allowed, {
            "kind": "factorable_int", "a": a, "b": b, "c": c, "m": m, "n": n,
        }


# --- Band B: 因数分解で解ける有理数解 or x² = c の単純無理数解 -----------

def _gen_rational_or_simple_sqrt(rng, max_root, max_a):
    """2 種類をランダム選択：
      P_rational: (ax - p)(x - r) = 0 → 解 p/a, r。a >= 2、gcd(a, p) = 1。
      P_x2_eq_c: x² = c → 解 ±√c（c は square-free）。
    """
    pattern = rng.choice(["P_rational", "P_x2_eq_c"])
    if pattern == "P_rational":
        for _ in range(50):
            a = rng.randint(2, max_a)
            p = rng.randint(-max_root, max_root)
            r = rng.randint(-max_root, max_root)
            if p == 0 or gcd(abs(p), a) != 1:
                continue
            # 解：p/a と r。
            sol1 = sp.Rational(p, a)
            sol2 = sp.Rational(r)
            if sol1 == sol2:
                continue
            # 二次式：(ax - p)(x - r) = ax² - (ar + p)x + pr
            A = a
            B = -(a * r + p)
            C = p * r
            problem_latex = _build_quadratic_problem(A, B, C)
            canonical = _format_rational_solutions(sol1, sol2)
            allowed = _variants_for_rational_solutions(sol1, sol2)
            return problem_latex, canonical, allowed, {
                "kind": "rational_factorable",
                "a": A, "b": B, "c": C,
                "sol1_p": int(sol1.p), "sol1_q": int(sol1.q),
                "sol2_p": int(sol2.p), "sol2_q": int(sol2.q),
            }
        return None
    # P_x2_eq_c: x² = c → x² - c = 0、解 ±√c（c は square-free、正）
    c_candidates = [n for n in range(2, 50) if simplify_sqrt(n) == (1, n)]
    c = rng.choice(c_candidates)
    A, B, C = 1, 0, -c
    problem_latex = _build_quadratic_problem(A, B, C)
    # 解：+√c, -√c → plain text "x = √c, -√c"（昇順は -√c, √c）
    canonical = f"x = -√{c}, √{c}"
    allowed = sorted({
        canonical,
        canonical.replace(" = ", "=").replace(", ", ","),
        canonical.replace(", ", ","),
        canonical.replace(" = ", "="),
        f"x = √{c}, -√{c}",
        f"x = ±√{c}",
        f"x=±√{c}",
    })
    return problem_latex, canonical, allowed, {
        "kind": "x2_eq_c", "a": A, "b": B, "c": C, "c_radicand": c,
    }


# --- Band C: 解の公式が必要な無理数解 -------------------------------------

def _gen_irrational(rng, max_a, max_bc):
    """ax² + bx + c = 0 の解の公式：x = (-b ± √D) / (2a)、D = b² - 4ac。

    条件：D > 0 かつ D は完全平方でない（無理数解）。
    解の表記：(-b)/2a が有理数、√D は簡約 (k * √d)、最終形は (p + √D')/q。
    """
    for _ in range(500):
        a = rng.randint(1, max_a)
        b = rng.randint(-max_bc, max_bc)
        c = rng.randint(-max_bc, max_bc)
        D = b * b - 4 * a * c
        if D <= 0 or is_perfect_square(D):
            continue
        # √D を簡約：D = k² * d → √D = k √d
        k, d = simplify_sqrt(D)
        # x = (-b ± k √d) / (2a)
        p_raw = -b
        q_raw = 2 * a
        k_raw = k
        # 既約化：gcd(p_raw, k_raw, q_raw) で約分
        g = gcd(gcd(abs(p_raw), abs(k_raw)), abs(q_raw))
        if q_raw < 0:
            g = -g
        if g == 0:
            continue
        p_red = p_raw // g
        k_red = k_raw // g
        q_red = q_raw // g
        # k_red < 0 の場合、(p+ k√d)/q = (p - |k|√d)/q として正値に正規化
        # 通常 q_red > 0 で k_red > 0（gcd で吸収済み）
        if k_red < 0:
            k_red = -k_red
            # 解の +/- は対称なので影響なし
        problem_latex = _build_quadratic_problem(a, b, c)

        # 解の表記
        ksqrt = f"√{d}" if k_red == 1 else f"{k_red}√{d}"

        # canonical：教科書標準の ± 表記（1 行にまとめる）
        if p_red == 0:
            # ±k√d/q または ±k√d
            if q_red == 1:
                canonical = f"x = ±{ksqrt}"
            else:
                canonical = f"x = ±{ksqrt}/{q_red}"
        else:
            if q_red == 1:
                canonical = f"x = {p_red}±{ksqrt}"
            else:
                canonical = f"x = ({p_red}±{ksqrt})/{q_red}"

        # 個別列挙形（生徒が +/- に分けて書いてもOK）
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


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(1, band)
    kind = cfg["kind"]

    for _ in range(500):
        if kind == "factorable_int":
            built = _gen_factorable_int(rng, cfg["max_root"])
        elif kind == "rational_or_simple_sqrt":
            built = _gen_rational_or_simple_sqrt(rng, cfg["max_root"], cfg["max_a"])
        elif kind == "irrational":
            built = _gen_irrational(rng, cfg["max_a"], cfg["max_bc"])
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
    a, b, c = meta["a"], meta["b"], meta["c"]
    x = sp.symbols("x")
    sols = sp.solve(a * x ** 2 + b * x + c, x)
    if meta["kind"] == "factorable_int":
        m, n = meta["m"], meta["n"]
        expected_set = {sp.Rational(m), sp.Rational(n)}
        actual_set = set(sp.Rational(s) for s in sols)
        if expected_set != actual_set:
            return False
        if _format_int_solutions(m, n) != problem["answerCanonical"]:
            return False
    elif meta["kind"] == "rational_factorable":
        s1 = sp.Rational(meta["sol1_p"], meta["sol1_q"])
        s2 = sp.Rational(meta["sol2_p"], meta["sol2_q"])
        expected_set = {s1, s2}
        actual_set = set(sp.Rational(s) for s in sols)
        if expected_set != actual_set:
            return False
    elif meta["kind"] == "x2_eq_c":
        cr = meta["c_radicand"]
        expected_set = {sp.sqrt(cr), -sp.sqrt(cr)}
        actual_set = set(sp.simplify(s) for s in sols)
        if expected_set != actual_set:
            return False
    elif meta["kind"] == "irrational":
        p, k, d, q = meta["p"], meta["k"], meta["d"], meta["q"]
        s1 = sp.Rational(p, q) + sp.Rational(k, q) * sp.sqrt(d)
        s2 = sp.Rational(p, q) - sp.Rational(k, q) * sp.sqrt(d)
        expected_set = {sp.simplify(s1), sp.simplify(s2)}
        actual_set = set(sp.simplify(s) for s in sols)
        if expected_set != actual_set:
            return False
    else:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
