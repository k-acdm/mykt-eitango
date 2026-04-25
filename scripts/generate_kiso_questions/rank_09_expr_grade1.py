# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""9級：式の計算 中1（仕様書 §6.5）。

A: 同類項整理：3x + 2x → 5x、4x - 3x → x など
B: 分配法則：2(x + 3) → 2x + 6、-(x - 4) → -x + 4 など
C: 単項式の乗除：6x ÷ 2 → 3x、(-3) × 2x → -6x、12x ÷ 8 → (3/2)x

§6.4.0 の既約性原則：分数係数が登場する場合（C 級の一部）、係数 a/b は GCD=1 を強制。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import OP_LATEX, frac_latex, frac_latex_no_sign
from common.sympy_helpers import (
    reduce_fraction,
    is_lowest_terms,
    assert_problem_fractions_in_lowest_terms,
)


# 共通：x の単項式 / 一次式の文字列化 ----------------------------------------

def _coef_str(coef: sp.Rational, is_leading: bool) -> str:
    """係数 → 文字列。±1 は省略、分数は \\frac で表現。

    is_leading=True なら先頭項として符号付き、False なら絶対値のみ（呼び出し側で +/- を付ける）。
    """
    if coef == 0:
        return ""
    sign = "-" if coef < 0 else ""
    abs_coef = abs(coef)
    if abs_coef == 1:
        body = ""
    elif abs_coef.q == 1:
        body = str(abs_coef.p)
    else:
        body = f"\\frac{{{abs_coef.p}}}{{{abs_coef.q}}}"
    return f"{sign}{body}" if is_leading else body


def _term_latex(coef: sp.Rational, var: str, is_leading: bool) -> str:
    """coef * var を LaTeX 表記に。x と分数係数の間に空白なし（紙教材準拠）。"""
    cs = _coef_str(coef, is_leading=is_leading)
    if coef == 0:
        return ""
    if cs == "" or cs == "-":
        return f"{cs}{var}"
    return f"{cs}{var}"


def _const_str(c: sp.Rational, is_leading: bool) -> str:
    if c == 0:
        return ""
    if is_leading:
        return frac_latex(c.p, c.q)  # 既約分数 or 整数
    return frac_latex_no_sign(c.p, c.q)


def _build_linear_latex(a: sp.Rational, b: sp.Rational) -> str:
    """ax + b の LaTeX。a, b の符号も適切に扱う。

    a == 0 なら定数項のみ、b == 0 なら ax のみ。
    """
    if a == 0:
        return _const_str(b, is_leading=True) or "0"
    parts = [_term_latex(a, "x", is_leading=True)]
    if b != 0:
        op = "+" if b > 0 else "-"
        parts.append(op)
        parts.append(_const_str(b, is_leading=False))
    return " ".join(parts)


def _build_monomial_latex(coef: sp.Rational, var: str = "x") -> str:
    """coef × var のみ。"""
    return _term_latex(coef, var, is_leading=True)


# Band A: 同類項整理 --------------------------------------------------------

def _gen_like_terms(rng, coef_max):
    """k1 x op k2 x = (k1±k2) x"""
    while True:
        k1 = rng.randint(-coef_max, coef_max)
        k2 = rng.randint(-coef_max, coef_max)
        if k1 == 0 or k2 == 0:
            continue
        op = rng.choice(["+", "-"])
        result_coef = k1 + k2 if op == "+" else k1 - k2
        if result_coef == 0:
            continue
        # 紙教材風：両項とも非ゼロで、結果も非ゼロ
        # 問題式：先頭は signed、2 項目は |k2| x（op で符号付与）
        first = _term_latex(sp.Rational(k1), "x", is_leading=True)
        second_op = op if k2 > 0 else ("-" if op == "+" else "+")
        second = _term_latex(sp.Rational(abs(k2)), "x", is_leading=False)
        latex = f"{first} {second_op} {second}"
        canonical = _build_monomial_latex(sp.Rational(result_coef))
        return latex, canonical, sp.Rational(result_coef), {
            "kind": "like_terms", "k1": k1, "k2": k2, "op": op,
            "result_coef_p": int(sp.Rational(result_coef).p),
            "result_coef_q": int(sp.Rational(result_coef).q),
        }


# Band B: 分配法則 ----------------------------------------------------------

def _gen_distribute(rng, coef_max, const_max):
    """k(x + c) → kx + kc。k は ±1..coef_max、c は ±1..const_max。

    k == 1 のときは `(x + c)` ではなく `-(x + c)` のような前付き符号で出すのが自然。
    """
    while True:
        k = rng.randint(-coef_max, coef_max)
        c = rng.randint(-const_max, const_max)
        if k == 0 or c == 0:
            continue
        # 問題式：k が ±1 のときは `(x + c)` `-(x + c)`、それ以外は `k(x + c)`
        op = "+" if c > 0 else "-"
        inner_latex = f"x {op} {abs(c)}"
        if k == 1:
            problem_latex = f"(x {op} {abs(c)})"
        elif k == -1:
            problem_latex = f"-(x {op} {abs(c)})"
        else:
            problem_latex = f"{k}(x {op} {abs(c)})"
        # 答え：kx + kc
        a = sp.Rational(k)
        b = sp.Rational(k * c)
        canonical = _build_linear_latex(a, b)
        return problem_latex, canonical, (a, b), {
            "kind": "distribute", "k": k, "c": c,
            "a_p": int(a.p), "a_q": int(a.q),
            "b_p": int(b.p), "b_q": int(b.q),
        }


# Band C: 単項式の乗除 -------------------------------------------------------

def _gen_monomial_muldiv(rng, coef_max):
    """単項式 ×/÷ 整数。例: 6x ÷ 2、(-3) × 2x、12x ÷ 8。

    乗算：(整数) × (kx) → 結果係数 = 整数 * k
    除算：(kx) ÷ (整数) → 結果係数 = k / 整数（既約分数なら OK）
    """
    while True:
        op = rng.choice(["*", "/"])
        if op == "*":
            a = rng.randint(-coef_max, coef_max)  # 整数（符号付き）
            k = rng.randint(-coef_max, coef_max)  # 単項式の係数
            if a == 0 or k == 0:
                continue
            if abs(a) == 1 or abs(k) == 1:
                continue  # × 1 / × -1 を避ける
            # 紙教材風：(a) × kx ※ a または kx が負なら括弧で囲む
            a_str = f"({a})" if a < 0 else f"{a}"
            kx_str = _term_latex(sp.Rational(k), "x", is_leading=True)
            if k < 0:
                kx_str = f"({kx_str})"
            problem_latex = f"{a_str} {OP_LATEX['*']} {kx_str}"
            result_coef = sp.Rational(a * k)
        else:
            k = rng.randint(-coef_max, coef_max)  # 単項式の係数（被除数）
            d = rng.randint(2, coef_max)  # 除数（正のみで簡略化）
            if k == 0:
                continue
            kx_str = _term_latex(sp.Rational(k), "x", is_leading=True)
            problem_latex = f"{kx_str} {OP_LATEX['/']} {d}"
            result_coef = sp.Rational(k, d)
            # 結果係数の既約性は Rational が自動保証
            if not is_lowest_terms(result_coef.p, result_coef.q):
                continue  # 念のため
        canonical = _build_monomial_latex(result_coef)
        return problem_latex, canonical, result_coef, {
            "kind": "monomial_muldiv", "op": op,
            "result_coef_p": int(result_coef.p),
            "result_coef_q": int(result_coef.q),
        }


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(9, band)
    kind = cfg["kind"]

    for _ in range(300):
        if kind == "like_terms":
            latex, canonical, result_coef, info = _gen_like_terms(rng, cfg["coef_max"])
        elif kind == "distribute":
            latex, canonical, result_pair, info = _gen_distribute(
                rng, cfg["coef_max"], cfg["const_max"]
            )
        elif kind == "monomial_muldiv":
            latex, canonical, result_coef, info = _gen_monomial_muldiv(rng, cfg["coef_max"])
        else:
            raise NotImplementedError(kind)

        allowed = av.variants_for_polynomial(canonical)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 9,
                "band": band,
                **info,
            },
        }
    raise RuntimeError(f"rank 9 band {band}: 300 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    kind = meta["kind"]
    if kind == "like_terms":
        k1, k2, op = meta["k1"], meta["k2"], meta["op"]
        rec = k1 + k2 if op == "+" else k1 - k2
        expected = sp.Rational(meta["result_coef_p"], meta["result_coef_q"])
        if sp.Rational(rec) != expected:
            return False
        if _build_monomial_latex(expected) != problem["answerCanonical"]:
            return False
    elif kind == "distribute":
        k, c = meta["k"], meta["c"]
        rec_a = sp.Rational(k)
        rec_b = sp.Rational(k * c)
        a_exp = sp.Rational(meta["a_p"], meta["a_q"])
        b_exp = sp.Rational(meta["b_p"], meta["b_q"])
        if rec_a != a_exp or rec_b != b_exp:
            return False
        if _build_linear_latex(a_exp, b_exp) != problem["answerCanonical"]:
            return False
    elif kind == "monomial_muldiv":
        expected = sp.Rational(meta["result_coef_p"], meta["result_coef_q"])
        if not is_lowest_terms(expected.p, expected.q):
            return False
        if _build_monomial_latex(expected) != problem["answerCanonical"]:
            return False
    else:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
