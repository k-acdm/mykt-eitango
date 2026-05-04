# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""8級：一次方程式・比例式（仕様書 §6.5）。

Phase 1（2026-05-05）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。

A: ax = b（5 問）
B: ax + b = cx + d または ax + b = c（25 問、単元の主役）
C: 比例式 a:b = c:x（10 問、整数解のみ）
D: カッコ付き方程式（10 問、light/standard/heavy を slot_index 駆動で分離）

中1 一次方程式の核心は「移項」と「カッコの展開」。旧構成は B のパターンしかなく、
カッコ付きの問題（中1 単元の山場）が一切なかったため Phase 1 で Band D を新設し、
教育的ギャップを解消する（rank_05 / rank_06 で Band D 新設したのと同パターン）。

D 以降の小数係数・分数係数は Phase 3 以降。
解は整数または既約分数（§6.4.0）。

問題式は等式：左辺・右辺を分けて LaTeX で表示。
答えは「x の値」のみ（整数または既約分数の文字列）。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import frac_latex_raw
from common.sympy_helpers import assert_problem_fractions_in_lowest_terms


def _signed_int(rng: random.Random, max_abs: int, min_abs: int = 1) -> int:
    while True:
        v = rng.randint(-max_abs, max_abs)
        if abs(v) >= min_abs:
            return v


def _format_term_x(coef: int, leading: bool) -> str:
    """coef * x の項表示。leading=True なら符号付きそのまま、False なら絶対値（呼び出し側で符号）。"""
    if coef == 0:
        return ""
    if leading:
        if coef == 1:
            return "x"
        if coef == -1:
            return "-x"
        return f"{coef}x"
    abs_c = abs(coef)
    return "x" if abs_c == 1 else f"{abs_c}x"


def _format_const(c: int, leading: bool) -> str:
    if c == 0:
        return ""
    if leading:
        return str(c)
    return str(abs(c))


def _build_lhs(a: int, b: int) -> str:
    """ax + b の表示（b=0 なら ax のみ、a=0 なら b のみ）。"""
    if a == 0:
        return _format_const(b, leading=True) or "0"
    s = _format_term_x(a, leading=True)
    if b != 0:
        op = " + " if b > 0 else " - "
        s += op + _format_const(b, leading=False)
    return s


def _build_rhs(c: int, d: int = 0, has_x: bool = False) -> str:
    """has_x=False なら c のみ。has_x=True なら cx + d。"""
    if not has_x:
        return _format_const(c, leading=True) or "0"
    s = _format_term_x(c, leading=True)
    if d != 0:
        op = " + " if d > 0 else " - "
        s += op + _format_const(d, leading=False)
    return s


def _build_paren_term(a: int, b: int) -> str:
    """``a(x + b)`` 形の表示。a の符号を保持しつつカッコ内は符号付き多項式で表示。

    例:  a=2, b=3   →  "2(x + 3)"
         a=-3, b=-1 →  "-3(x - 1)"
         a=1, b=2   →  "(x + 2)"   ← 係数 1 は省略
         a=-1, b=2  →  "-(x + 2)"  ← 係数 -1 はマイナスのみ
    """
    inner = "x"
    if b > 0:
        inner += f" + {b}"
    elif b < 0:
        inner += f" - {abs(b)}"
    if a == 1:
        return f"({inner})"
    if a == -1:
        return f"-({inner})"
    return f"{a}({inner})"


def _build_paren_minus_paren(a: int, b: int, c: int, d: int) -> str:
    """``a(x + b) - c(x + d)`` 形の表示。c は正の整数を想定（呼び出し側で保証）。

    例:  a=2, b=3, c=1, d=4  →  "2(x + 3) - (x + 4)"
         a=3, b=-2, c=2, d=1 →  "3(x - 2) - 2(x + 1)"
    """
    left = _build_paren_term(a, b)
    # 右側は「- c(x + d)」を作る：第二項が「+」始まりなら "- " で繋ぐ
    if c == 1:
        right = f"- (x{' + ' + str(d) if d > 0 else (' - ' + str(abs(d)) if d < 0 else '')})"
    else:
        inner = "x"
        if d > 0:
            inner += f" + {d}"
        elif d < 0:
            inner += f" - {abs(d)}"
        right = f"- {c}({inner})"
    return f"{left} {right}"


def _gen_ax_eq_b(rng, coef_max, x_max):
    """ax = b → x = b/a。

    DESIGN_PRINCIPLES.md 原則 2 に基づき、Band A は **整数解のみ** に制限する。
    実装：先に x_sol（整数）を選び、b = a * x_sol で逆算 → x が必ず整数になる。

    TODO_PHASE3: 解が分数になる ax=b 問題（割り切れない係数）は Phase 3 の Band E 以降で復活させる。
    """
    a = _signed_int(rng, coef_max, min_abs=2)
    x_sol = _signed_int(rng, x_max)
    if x_sol == 0:
        return None
    b = a * x_sol
    x_val = sp.Rational(b, a)  # 必ず整数（Rational(p, 1) 形）
    latex = f"{_build_lhs(a, 0)} = {_build_rhs(b)}"
    return latex, x_val, {"kind": "ax_eq_b", "a": a, "b": b}


def _gen_ax_b_eq_cx_d(rng, coef_max, const_max):
    """ax + b = cx + d → x = (d - b) / (a - c)。a != c。"""
    while True:
        a = _signed_int(rng, coef_max, min_abs=2)
        c = _signed_int(rng, coef_max)
        if a == c:
            continue
        b = _signed_int(rng, const_max)
        d = _signed_int(rng, const_max)
        x_val = sp.Rational(d - b, a - c)
        if x_val == 0:
            continue
        latex = f"{_build_lhs(a, b)} = {_build_rhs(c, d, has_x=True)}"
        return latex, x_val, {"kind": "ax_b_eq_cx_d", "a": a, "b": b, "c": c, "d": d}


def _gen_proportion(rng, value_max):
    """a : b = c : x → x = b * c / a。

    DESIGN_PRINCIPLES.md 原則 2 に基づき、Band C 入門段階は **x が整数になる組のみ** 採用。
    実装：x_int を先に選び、a, b, c を「a が b*x_int を割り切る」よう構築する。

    TODO_PHASE3: 比例式で複雑な分数解（22/9、108/13 など）になる組は
    Phase 3 の Band E 以降で復活させる。
    """
    for _ in range(500):
        x_int = rng.randint(2, value_max)
        a = rng.randint(2, value_max)
        b = rng.randint(2, value_max)
        # c = a * x_int / b → 正の整数になる必要がある
        prod = a * x_int
        if prod % b != 0:
            continue
        c = prod // b
        if c < 2 or c > value_max:
            continue
        x_val = sp.Rational(x_int)
        latex = f"{a} : {b} = {c} : x"
        return latex, x_val, {"kind": "proportion", "a": a, "b": b, "c": c}
    return None


# ----------------------------------------------------------------
# Band D: カッコ付き一次方程式（Phase 1 新設、2026-05-05）
# ----------------------------------------------------------------
# 教育的根拠（ふくちさん 36 年の塾長経験）:
#   中1 一次方程式の山場は「カッコの展開」。旧構成は ax+b=cx+d 形しかなく、
#   この最重要パターンが完全に欠落していた。Phase 1 で Band D を新設し、
#   教育的ギャップを解消する（rank_05 / rank_06 と同じ Band D 新設パターン）。
#
# 3 サブパターンを slot_index で決定論的に分離：
#   light    : a(x+b) = c              （右辺は定数、導入レベル）
#   standard : a(x+b) = c(x+d)         （両辺カッコ、単元の主役）
#   heavy    : a(x+b) - c(x+d) = e     （カッコ複数 + 移項、応用）
#
# 配分: subcounts={"light":2, "standard":6, "heavy":2} （ふくちさん教育的判断）

def _gen_paren_form_light(rng, coef_max, const_max, x_max):
    """軽め: a(x + b) = c → 展開後 ax + ab = c → x = (c - ab) / a。

    実装：先に x_sol を整数で決め、a, b を選び c = a*(x_sol + b) で逆算。
    a >= 2 強制（係数 1 は退屈）。b != 0 強制（カッコ内が x のみは退屈）。
    """
    while True:
        a = _signed_int(rng, coef_max, min_abs=2)
        b = _signed_int(rng, const_max, min_abs=1)
        x_sol = _signed_int(rng, x_max)
        if x_sol == 0:
            continue
        c = a * (x_sol + b)
        if abs(c) > coef_max * (x_max + const_max) + 5:
            continue  # 表示が大きすぎる場合は再試行
        x_val = sp.Rational(x_sol)
        latex = f"{_build_paren_term(a, b)} = {_build_rhs(c)}"
        return latex, x_val, {"kind": "paren_form", "subkind": "light",
                              "a": a, "b": b, "c": c}


def _gen_paren_form_standard(rng, coef_max, const_max, x_max):
    """標準: a(x + b) = c(x + d) → 展開後 ax + ab = cx + cd → (a-c)x = cd - ab。

    実装：先に x_sol を整数で決め、a, b, c, d を選んで等式が成立するように構築。
      LHS = a*(x_sol + b) = a*x_sol + a*b
      RHS = c*(x_sol + d) = c*x_sol + c*d
      LHS == RHS となるためには a*(x_sol+b) == c*(x_sol+d) が必要。
      → c, d を先に選び、それに合わせて (a, b) のうち b を逆算する：
        a*(x_sol + b) = c*(x_sol + d)
        b = (c*(x_sol + d) - a*x_sol) / a = c*(x_sol + d)/a - x_sol
      a が c*(x_sol+d) を割り切る組のみ採用。
    a != c 強制（同じだと自明な恒等式）。a, c >= 2 強制（係数 1 は退屈で簡単すぎ）。
    """
    for _ in range(500):
        a = _signed_int(rng, coef_max, min_abs=2)
        c = _signed_int(rng, coef_max, min_abs=2)
        if a == c:
            continue
        d = _signed_int(rng, const_max, min_abs=1)
        x_sol = _signed_int(rng, x_max)
        if x_sol == 0:
            continue
        # b = (c*(x_sol + d) - a*x_sol) / a が整数になる必要がある
        num = c * (x_sol + d) - a * x_sol
        if num % a != 0:
            continue
        b = num // a
        if b == 0:
            continue  # b=0 だと a*x = c*(x+d) と簡略化されて軽めパターンと混ざる
        if abs(b) > const_max:
            continue
        # 整合性確認：a*(x_sol + b) == c*(x_sol + d)
        if a * (x_sol + b) != c * (x_sol + d):
            continue
        x_val = sp.Rational(x_sol)
        latex = f"{_build_paren_term(a, b)} = {_build_paren_term(c, d)}"
        return latex, x_val, {"kind": "paren_form", "subkind": "standard",
                              "a": a, "b": b, "c": c, "d": d}
    return None


def _gen_paren_form_heavy(rng, coef_max, const_max, x_max):
    """重め: a(x + b) - c(x + d) = e。c は正の整数（マイナス符号を - で吸収）。

    展開: ax + ab - cx - cd = e  →  (a-c)x = e + cd - ab
    実装：先に x_sol を整数で決め、a, b, c, d を選んで e を逆算。
      e = a*(x_sol + b) - c*(x_sol + d)
    a, c >= 2 強制。a != c 強制。b, d は非ゼロ。
    """
    for _ in range(500):
        a = _signed_int(rng, coef_max, min_abs=2)
        c = rng.randint(2, coef_max)  # 正の整数（マイナスは式の "- c(...)" で表現）
        if a == c:
            continue
        b = _signed_int(rng, const_max, min_abs=1)
        d = _signed_int(rng, const_max, min_abs=1)
        x_sol = _signed_int(rng, x_max)
        if x_sol == 0:
            continue
        e = a * (x_sol + b) - c * (x_sol + d)
        # 結果 e の絶対値が大きくなりすぎないように軽くガード
        if abs(e) > coef_max * (x_max + const_max) * 2:
            continue
        x_val = sp.Rational(x_sol)
        latex = f"{_build_paren_minus_paren(a, b, c, d)} = {_build_rhs(e)}"
        return latex, x_val, {"kind": "paren_form", "subkind": "heavy",
                              "a": a, "b": b, "c": c, "d": d, "e": e}
    return None


def _resolve_band_d_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → サブパターン名（"light" / "standard" / "heavy"）の決定論的 dispatch。

    rank_03 / rank_02 / rank_07 で確立した方式と同一。rng の偶然に依存させず
    教育的配分を**確実**に守る。

    例: subcounts={"light":2, "standard":6, "heavy":2}, count=10
        slot_index 0,1           → "light"
        slot_index 2..7          → "standard"
        slot_index 8,9           → "heavy"
    """
    cumulative = 0
    for subkind in ("light", "standard", "heavy"):
        n = int(subcounts.get(subkind, 0))
        if slot_index < cumulative + n:
            return subkind
        cumulative += n
    # フォールバック（subcounts 合計 < count の場合は最後の有効サブパターンを返す）
    for subkind in ("heavy", "standard", "light"):
        if int(subcounts.get(subkind, 0)) > 0:
            return subkind
    return "standard"


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    """generate_problem は ``slot_index`` キーワードで呼び出し側のスロット位置を受け取る。

    Band D（paren_form）のみ slot_index を使ってサブパターンを決定論的に dispatch する。
    A/B/C は slot_index を無視（既存挙動を温存）。
    """
    cfg = get_band(8, band)
    kind = cfg["kind"]

    for _ in range(500):
        if kind == "ax_eq_b":
            built = _gen_ax_eq_b(rng, cfg["coef_max"], cfg["x_max"])
        elif kind == "ax_b_eq_cx_d":
            built = _gen_ax_b_eq_cx_d(rng, cfg["coef_max"], cfg["const_max"])
        elif kind == "proportion":
            built = _gen_proportion(rng, cfg["value_max"])
        elif kind == "paren_form":
            subkind = _resolve_band_d_subkind(slot_index, cfg.get("subcounts", {}))
            if subkind == "light":
                built = _gen_paren_form_light(rng, cfg["coef_max"], cfg["const_max"], cfg["x_max"])
            elif subkind == "standard":
                built = _gen_paren_form_standard(rng, cfg["coef_max"], cfg["const_max"], cfg["x_max"])
            elif subkind == "heavy":
                built = _gen_paren_form_heavy(rng, cfg["coef_max"], cfg["const_max"], cfg["x_max"])
            else:
                raise NotImplementedError(f"unknown subkind: {subkind}")
        else:
            raise NotImplementedError(kind)
        if built is None:
            continue
        latex, x_val, info = built
        canonical = av.canonical_for_rational(x_val)
        allowed = av.variants_for_rational(x_val)
        return {
            "problemLatex": latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 8,
                "band": band,
                "x_p": int(x_val.p),
                "x_q": int(x_val.q),
                **info,
            },
        }
    raise RuntimeError(f"rank 8 band {band}: 500 retries exhausted")


def _verify_solution(meta: Dict[str, Any], x_val: sp.Rational) -> bool:
    """解 x_val が問題式を満たすかチェック。"""
    kind = meta["kind"]
    if kind == "ax_eq_b":
        return meta["a"] * x_val == meta["b"]
    if kind == "ax_b_eq_cx_d":
        return meta["a"] * x_val + meta["b"] == meta["c"] * x_val + meta["d"]
    if kind == "proportion":
        # a : b = c : x ⇒ a * x = b * c
        return meta["a"] * x_val == meta["b"] * meta["c"]
    if kind == "paren_form":
        subkind = meta.get("subkind", "")
        a = meta["a"]; b = meta["b"]
        if subkind == "light":
            # a(x + b) = c
            return a * (x_val + b) == meta["c"]
        if subkind == "standard":
            # a(x + b) = c(x + d)
            return a * (x_val + b) == meta["c"] * (x_val + meta["d"])
        if subkind == "heavy":
            # a(x + b) - c(x + d) = e
            return a * (x_val + b) - meta["c"] * (x_val + meta["d"]) == meta["e"]
    return False


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    x_val = sp.Rational(meta["x_p"], meta["x_q"])
    if not _verify_solution(meta, x_val):
        return False
    if av.canonical_for_rational(x_val) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
