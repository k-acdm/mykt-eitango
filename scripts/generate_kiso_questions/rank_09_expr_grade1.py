# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""9級：式の計算 中1（仕様書 §6.5）。

Phase 1（2026-05-06）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。

A: 同類項整理 13 問（slot_index 駆動の 3 サブパターン）
   - two_term=7   : 既存ロジック踏襲、2 項単項式（3x + 2x = 5x 等）
   - three_term=3 : 新規、3 項同類項（2x + 3x - 4x = x 等）
   - with_const=3 : 新規、定数項込み（2x + 3 + x - 5 = 3x - 2 等）
B: 分配法則 13 問：2(x + 3) → 2x + 6、-(x - 4) → -x + 4 など（既存ロジック踏襲）
C: 単項式の乗除 11 問：6x ÷ 2 → 3x、(-3) × 2x → -6x、12x ÷ 8 → (3/2)x（既存ロジック踏襲）
D: カッコ展開 + 加減 13 問（新設）：(ax + b) ± (cx + d) 形
   - 中1 教科書の山場「カッコ展開 + 符号反転」を集中練習
   - 第 2 カッコの符号反転を伴う -(...) 形を多めに（rng.choices で 2:3）

§6.4.0 の既約性原則：分数係数が登場する場合（C 級の一部）、係数 a/b は GCD=1 を強制。

TODO_PHASE3: distribute_addsub（2(x+3) + 3(x-1) 系）は中2 rank_07 範囲のため
rank_09 では Phase 1 で導入しない。100 題化時に rank_07 への含有を確認すること。
4 項以上の同類項、二重括弧、分数係数、複数文字は Phase 3 の Band E 以降で導入。
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
# Phase 1 で 3 サブパターンを slot_index 駆動で分離：
#   two_term   : 既存 _gen_like_terms（k1 x op k2 x）
#   three_term : 3 項同類項（k1 x op1 k2 x op2 k3 x）
#   with_const : 定数項込み（a x op1 b op2 c x op3 d）

def _gen_like_terms(rng, coef_max):
    """k1 x op k2 x = (k1±k2) x（Band A two_term サブパターン、既存ロジック温存）"""
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
            "kind": "like_terms", "subkind": "two_term",
            "k1": k1, "k2": k2, "op": op,
            "result_coef_p": int(sp.Rational(result_coef).p),
            "result_coef_q": int(sp.Rational(result_coef).q),
        }


def _gen_three_term_like_terms(rng, coef_max):
    """3 項同類項：k1 x op1 k2 x op2 k3 x = (k1±k2±k3) x

    例：2x + 3x - 4x = x、5x - 2x + x = 4x
    全 k_i 非ゼロ、結果非ゼロ。問題式は紙教材準拠（先頭 signed、2/3 項目は |k| x + op）。
    """
    while True:
        k1 = rng.randint(-coef_max, coef_max)
        k2 = rng.randint(-coef_max, coef_max)
        k3 = rng.randint(-coef_max, coef_max)
        if k1 == 0 or k2 == 0 or k3 == 0:
            continue
        op1 = rng.choice(["+", "-"])
        op2 = rng.choice(["+", "-"])
        result_coef = k1
        result_coef = result_coef + k2 if op1 == "+" else result_coef - k2
        result_coef = result_coef + k3 if op2 == "+" else result_coef - k3
        if result_coef == 0:
            continue
        first = _term_latex(sp.Rational(k1), "x", is_leading=True)
        # 2 項目：op1 と k2 の符号を吸収
        op1_disp = op1 if k2 > 0 else ("-" if op1 == "+" else "+")
        second = _term_latex(sp.Rational(abs(k2)), "x", is_leading=False)
        # 3 項目：op2 と k3 の符号を吸収
        op2_disp = op2 if k3 > 0 else ("-" if op2 == "+" else "+")
        third = _term_latex(sp.Rational(abs(k3)), "x", is_leading=False)
        latex = f"{first} {op1_disp} {second} {op2_disp} {third}"
        canonical = _build_monomial_latex(sp.Rational(result_coef))
        return latex, canonical, sp.Rational(result_coef), {
            "kind": "like_terms", "subkind": "three_term",
            "k1": k1, "k2": k2, "k3": k3, "op1": op1, "op2": op2,
            "result_coef_p": int(sp.Rational(result_coef).p),
            "result_coef_q": int(sp.Rational(result_coef).q),
        }


def _gen_with_const_like_terms(rng, coef_max, const_max):
    """定数項込み同類項：a x [b の符号付き] c x の符号付き [d の符号付き] = (a+c)x + (b+d)

    例：2x + 3 + x - 5 = 3x - 2、3x - 4 - x + 7 = 2x + 3
    a, b, c, d は全て非ゼロ。x 係数 = a + c、定数 = b + d ともに非ゼロを強制
    （x 係数 0 だと多項式が定数のみになり「同類項整理」の趣旨から外れる、
     定数 0 だと結果が単項式になり Band A two_term と被る）。
    a/b/c/d の符号で正負を表現するため、紙教材の「2x + 3 + x - 5」のような
    自然な符号並びを直接構築できる。
    """
    while True:
        a = rng.randint(-coef_max, coef_max)
        c = rng.randint(-coef_max, coef_max)
        b = rng.randint(-const_max, const_max)
        d = rng.randint(-const_max, const_max)
        if a == 0 or c == 0 or b == 0 or d == 0:
            continue
        x_coef = a + c
        const_part = b + d
        if x_coef == 0 or const_part == 0:
            continue
        first = _term_latex(sp.Rational(a), "x", is_leading=True)
        # 2 項目: 定数 b（符号で表現）
        second_op = "+" if b > 0 else "-"
        second_val = abs(b)
        # 3 項目: c x（符号で表現）
        third_op = "+" if c > 0 else "-"
        third_term = _term_latex(sp.Rational(abs(c)), "x", is_leading=False)
        # 4 項目: 定数 d（符号で表現）
        fourth_op = "+" if d > 0 else "-"
        fourth_val = abs(d)
        latex = f"{first} {second_op} {second_val} {third_op} {third_term} {fourth_op} {fourth_val}"
        canonical = _build_linear_latex(sp.Rational(x_coef), sp.Rational(const_part))
        return latex, canonical, (sp.Rational(x_coef), sp.Rational(const_part)), {
            "kind": "like_terms", "subkind": "with_const",
            "a": a, "b": b, "c": c, "d": d,
            "x_coef_p": int(sp.Rational(x_coef).p),
            "x_coef_q": int(sp.Rational(x_coef).q),
            "const_p": int(sp.Rational(const_part).p),
            "const_q": int(sp.Rational(const_part).q),
        }


def _resolve_band_a_subkind(slot_index, subcounts):
    """slot_index → "two_term" / "three_term" / "with_const" の決定論的 dispatch。

    cumulative dispatch 方式（rank_03/02/07/08/01 と同方式）。
    例: subcounts={"two_term":7, "three_term":3, "with_const":3}, count=13
        slot 0..6   → two_term   (7 問)
        slot 7..9   → three_term (3 問)
        slot 10..12 → with_const (3 問)
    """
    cumulative = 0
    for subkind in ("two_term", "three_term", "with_const"):
        n = int(subcounts.get(subkind, 0))
        if slot_index < cumulative + n:
            return subkind
        cumulative += n
    return "two_term"  # フォールバック


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


# Band D: カッコ展開 + 加減（Phase 1 新設、2026-05-06） ----------------------
# 中1 教科書の山場「カッコ展開 + 符号反転」を集中練習する単元。
# 形式：(ax + b) ± (cx + d)
#   - 第 1 項のカッコ：常に +(...)（先頭の + は省略）
#   - 第 2 項のカッコ：+(...) または -(...)
#   - 教育的に -(...) を多めに（rng.choices で 2:3 の比率、符号反転問題を主役化）
# パラメータ：a, c ∈ ±[1..coef_max]、b, d ∈ ±[1..const_max]、全て非ゼロ
# TODO_PHASE3: distribute_addsub（2(x+3) + 3(x-1) 系）は中2 rank_07 範囲のため
# rank_09 では Phase 1 で導入しない。100 題化時に rank_07 への含有を確認すること。

def _gen_paren_addsub(rng, coef_max, const_max):
    """カッコ展開 + 加減：(ax + b) ± (cx + d) → (a±c)x + (b±d)

    例：(2x + 3) + (-x + 1) = x + 4
        (3x - 5) - (x + 2) = 2x - 7   （符号反転の典型）
        (-2x + 4) - (3x - 1) = -5x + 5
        (4x - 7) + (-2x + 3) = 2x - 4
        (-x + 6) - (2x - 5) = -3x + 11
    結果の x 係数 / 定数項とも非ゼロを強制（多項式として残るよう）。
    """
    while True:
        a = rng.randint(-coef_max, coef_max)
        b = rng.randint(-const_max, const_max)
        c = rng.randint(-coef_max, coef_max)
        d = rng.randint(-const_max, const_max)
        if a == 0 or c == 0 or b == 0 or d == 0:
            continue
        # 第 2 カッコの outer_op：教育的に -(...) を多めに（2:3）
        outer_op = rng.choices(["+", "-"], weights=[2, 3])[0]
        if outer_op == "+":
            x_coef = a + c
            const_part = b + d
        else:
            x_coef = a - c
            const_part = b - d
        if x_coef == 0 or const_part == 0:
            continue
        # 問題式：(ax + b) outer_op (cx + d)
        first_inner  = _build_linear_latex(sp.Rational(a), sp.Rational(b))
        second_inner = _build_linear_latex(sp.Rational(c), sp.Rational(d))
        latex = f"({first_inner}) {outer_op} ({second_inner})"
        canonical = _build_linear_latex(sp.Rational(x_coef), sp.Rational(const_part))
        return latex, canonical, (sp.Rational(x_coef), sp.Rational(const_part)), {
            "kind": "paren_addsub",
            "a": a, "b": b, "c": c, "d": d, "outer_op": outer_op,
            "x_coef_p": int(sp.Rational(x_coef).p),
            "x_coef_q": int(sp.Rational(x_coef).q),
            "const_p": int(sp.Rational(const_part).p),
            "const_q": int(sp.Rational(const_part).q),
        }


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードを受け取る（main.py の inspect 機構）。

    Band A は slot_index 駆動の 3 サブパターン分離（two_term / three_term / with_const）、
    Band B/C は slot_index を無視（既存挙動温存）、Band D は単一 generator。
    """
    cfg = get_band(9, band)
    kind = cfg["kind"]

    for _ in range(300):
        if kind == "like_terms":
            sub = _resolve_band_a_subkind(slot_index, cfg.get("subcounts", {}))
            if sub == "two_term":
                latex, canonical, _, info = _gen_like_terms(rng, cfg["coef_max"])
            elif sub == "three_term":
                latex, canonical, _, info = _gen_three_term_like_terms(rng, cfg["coef_max"])
            elif sub == "with_const":
                latex, canonical, _, info = _gen_with_const_like_terms(
                    rng, cfg["coef_max"], cfg.get("const_max", 7)
                )
            else:
                raise NotImplementedError(f"unknown subkind: {sub}")
        elif kind == "distribute":
            latex, canonical, _, info = _gen_distribute(
                rng, cfg["coef_max"], cfg["const_max"]
            )
        elif kind == "monomial_muldiv":
            latex, canonical, _, info = _gen_monomial_muldiv(rng, cfg["coef_max"])
        elif kind == "paren_addsub":
            latex, canonical, _, info = _gen_paren_addsub(
                rng, cfg["coef_max"], cfg["const_max"]
            )
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
        sub = meta.get("subkind", "two_term")
        if sub == "two_term":
            k1, k2, op = meta["k1"], meta["k2"], meta["op"]
            rec = k1 + k2 if op == "+" else k1 - k2
            expected = sp.Rational(meta["result_coef_p"], meta["result_coef_q"])
            if sp.Rational(rec) != expected:
                return False
            if _build_monomial_latex(expected) != problem["answerCanonical"]:
                return False
        elif sub == "three_term":
            k1, k2, k3 = meta["k1"], meta["k2"], meta["k3"]
            op1, op2 = meta["op1"], meta["op2"]
            rec = k1
            rec = rec + k2 if op1 == "+" else rec - k2
            rec = rec + k3 if op2 == "+" else rec - k3
            expected = sp.Rational(meta["result_coef_p"], meta["result_coef_q"])
            if sp.Rational(rec) != expected:
                return False
            if _build_monomial_latex(expected) != problem["answerCanonical"]:
                return False
        elif sub == "with_const":
            a, b, c, d = meta["a"], meta["b"], meta["c"], meta["d"]
            rec_x = sp.Rational(a + c)
            rec_const = sp.Rational(b + d)
            x_exp = sp.Rational(meta["x_coef_p"], meta["x_coef_q"])
            const_exp = sp.Rational(meta["const_p"], meta["const_q"])
            if rec_x != x_exp or rec_const != const_exp:
                return False
            if _build_linear_latex(x_exp, const_exp) != problem["answerCanonical"]:
                return False
        else:
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
    elif kind == "paren_addsub":
        a, b, c, d = meta["a"], meta["b"], meta["c"], meta["d"]
        outer_op = meta["outer_op"]
        if outer_op == "+":
            rec_x = sp.Rational(a + c); rec_const = sp.Rational(b + d)
        else:
            rec_x = sp.Rational(a - c); rec_const = sp.Rational(b - d)
        x_exp = sp.Rational(meta["x_coef_p"], meta["x_coef_q"])
        const_exp = sp.Rational(meta["const_p"], meta["const_q"])
        if rec_x != x_exp or rec_const != const_exp:
            return False
        if _build_linear_latex(x_exp, const_exp) != problem["answerCanonical"]:
            return False
    else:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
