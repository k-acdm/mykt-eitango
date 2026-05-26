# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""4級：乗法公式（仕様書 §6.5）。

A: (x + a)(x + b) → x² + (a+b)x + ab
B: (x + a)² または (x - a)² → x² ± 2ax + a²
C: (x + a)(x - a) → x² - a²

すべて単一変数 x。a, b は ±[1..const_max] の整数。
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import poly_latex, factored_pair_latex, square_factor_latex
from common.sympy_helpers import assert_problem_fractions_in_lowest_terms


def _signed(rng, max_abs: int, min_abs: int = 1) -> int:
    while True:
        v = rng.randint(-max_abs, max_abs)
        if abs(v) >= min_abs:
            return v


def _expand_xab(a: int, b: int) -> Tuple[int, int, int]:
    """(x+a)(x+b) = x² + (a+b)x + ab。係数 (1, a+b, ab) を返す。"""
    return 1, a + b, a * b


def _gen_type_xab(rng, const_max):
    """Band A: (x+a)(x+b)。a, b は同符号でも異符号でも OK。

    除外条件:
    - a == b: 平方（Band B 相当）
    - a + b == 0: 差の平方 (x-c)(x+c) = x^2 - c^2（Band C 相当、cross-band 重複防止）

    数学的に同一の問題 (x+a)(x+b) と (x+b)(x+a) を統一するため、数値順で a <= b に
    並べ替える（unique pool の二重計上 / 同一セッション内の実質重複を防ぐ）。
    """
    while True:
        a = _signed(rng, const_max)
        b = _signed(rng, const_max)
        if a == b:
            continue  # 平方は Band B
        if a + b == 0:
            continue  # 差の平方は Band C
        if a > b:
            a, b = b, a
        c2, c1, c0 = _expand_xab(a, b)
        problem_latex = factored_pair_latex(a, b)
        canonical = poly_latex([c2, c1, c0])
        return problem_latex, canonical, {
            "kind": "type_xab", "a": a, "b": b,
            "c2": c2, "c1": c1, "c0": c0,
        }


def _gen_type_square(rng, const_max):
    """Band B: (x+a)² または (x-a)²。"""
    a = _signed(rng, const_max)  # ±[1..const_max]
    # (x + a)^2 = x^2 + 2a x + a^2
    c2, c1, c0 = 1, 2 * a, a * a
    problem_latex = square_factor_latex(a)
    canonical = poly_latex([c2, c1, c0])
    return problem_latex, canonical, {
        "kind": "type_square", "a": a,
        "c2": c2, "c1": c1, "c0": c0,
    }


def _gen_type_diff_squares(rng, const_max):
    """Band C: (x+a)(x-a) = x² - a²。"""
    a = rng.randint(1, const_max)  # 正のみで簡略化（符号を入れ替えても結果同じ）
    c2, c1, c0 = 1, 0, -a * a
    # 表示は (x + a)(x - a) または (x - a)(x + a)
    problem_latex = factored_pair_latex(a, -a)
    canonical = poly_latex([c2, c1, c0])
    return problem_latex, canonical, {
        "kind": "type_diff_squares", "a": a,
        "c2": c2, "c1": c1, "c0": c0,
    }


# --- Band D（Phase 2 Wave 3 新設、2026-05-26）------------------------------
# 多変数化（2 変数 x, y を使う中3 教科書範囲の乗法公式 4 パターン）。
# ふくちさん教育的判断：「多変数の乗法公式は中3 教科書範囲、必ずカバーすべき」。
#
# サブパターン（slot_index で決定論的 dispatch）:
#   xy_basic         : (x+y)(x-y) → x² - y²              （最も基本、slot 0 で必ず出題）
#   xy_diff_coef     : (x+ay)(x-ay) → x² - a²y²          a∈[2..5]、4 問
#   xy_square        : (ax+by)² → a²x² + 2abxy + b²y²    a∈[2..5], b∈±[1..5]、7 問
#   xy_diff_double   : (ax+by)(ax-by) → a²x² - b²y²      a∈[2..5], b∈[1..5]\(1,1)、8 問
# 計 20 問。
#
# Pattern 1 と 2 を統合せず分離した理由：教育上「(x+y)(x-y) 単独」を最初に 1 問必ず
# 体験させたい（最も基本形、スロット 0 固定）。Pattern 2 以降は係数付きで展開。


def _multivar_canonical(c_x2: int, c_xy: int, c_y2: int) -> str:
    """``c_x2·x² + c_xy·xy + c_y2·y²`` 形の canonical LaTeX を構築。

    各係数が 0 / ±1 / 他の場合を整形：
    - c=0 の項は省略
    - c=1 / -1 は係数を省略（先頭以外でも符号は項間 op で表現）
    - x² は ``x^{2}``、y² は ``y^{2}``、xy はそのまま
    """
    def _term(coef: int, var_part: str, leading: bool) -> str:
        if coef == 0:
            return ""
        if leading:
            sign = "" if coef > 0 else "-"
            mag = abs(coef)
            mag_str = "" if mag == 1 and var_part else str(mag)
            return f"{sign}{mag_str}{var_part}"
        # 中間／末尾項：op を後付けで足すため、ここでは絶対値のみ返す
        mag = abs(coef)
        mag_str = "" if mag == 1 and var_part else str(mag)
        return mag_str + var_part

    terms = [
        (c_x2, "x^{2}"),
        (c_xy, "xy"),
        (c_y2, "y^{2}"),
    ]
    # 先頭の非零項を見つける
    first_idx = next((i for i, (c, _) in enumerate(terms) if c != 0), None)
    if first_idx is None:
        return "0"

    parts = [_term(terms[first_idx][0], terms[first_idx][1], leading=True)]
    for i in range(first_idx + 1, len(terms)):
        coef, var_part = terms[i]
        if coef == 0:
            continue
        op = " + " if coef > 0 else " - "
        parts.append(op + _term(coef, var_part, leading=False))
    return "".join(parts)


def _gen_xy_basic(rng):
    """slot 0 固定: (x+y)(x-y) → x² - y²。最も基本の多変数公式。"""
    problem_latex = "(x + y)(x - y)"
    canonical = _multivar_canonical(1, 0, -1)
    return problem_latex, canonical, {
        "kind": "type_multivar", "subkind": "xy_basic",
        "c_x2": 1, "c_xy": 0, "c_y2": -1,
    }


def _gen_xy_diff_coef(rng):
    """(x + ay)(x - ay) → x² - a²y²、a∈[2..5]。"""
    a = rng.randint(2, 5)
    problem_latex = f"(x + {a}y)(x - {a}y)"
    c_y2 = -(a * a)
    canonical = _multivar_canonical(1, 0, c_y2)
    return problem_latex, canonical, {
        "kind": "type_multivar", "subkind": "xy_diff_coef",
        "a": a, "c_x2": 1, "c_xy": 0, "c_y2": c_y2,
    }


def _coef_var_str(coef: int, var: str) -> str:
    """係数付き変数の表記。coef=1 / -1 は係数省略。

    例: 1, 'y' → 'y'、3, 'y' → '3y'、-1, 'y' → '-y'。
    """
    if coef == 1:
        return var
    if coef == -1:
        return f"-{var}"
    return f"{coef}{var}"


def _gen_xy_square(rng):
    """(ax + by)² → a²x² + 2abxy + b²y²、a∈[2..5], b∈±[1..5]\\{0}。

    b の符号で中央項符号が変わるため (a, b) と (a, -b) は別問題。
    """
    a = rng.randint(2, 5)
    b = _signed(rng, 5, min_abs=1)
    c_x2 = a * a
    c_xy = 2 * a * b
    c_y2 = b * b
    # 問題式: (ax + by)² または (ax - |b|y)²
    # b=±1 のときは係数を省略して "y" / "-y" 表記
    ax_str = f"{a}x"  # a >= 2 なので必ず係数付き
    by_abs = abs(b)
    if by_abs == 1:
        by_str = "y"
    else:
        by_str = f"{by_abs}y"
    if b > 0:
        problem_latex = f"({ax_str} + {by_str})^{{2}}"
    else:
        problem_latex = f"({ax_str} - {by_str})^{{2}}"
    canonical = _multivar_canonical(c_x2, c_xy, c_y2)
    return problem_latex, canonical, {
        "kind": "type_multivar", "subkind": "xy_square",
        "a": a, "b": b, "c_x2": c_x2, "c_xy": c_xy, "c_y2": c_y2,
    }


def _gen_xy_diff_double(rng):
    """(ax + by)(ax - by) → a²x² - b²y²、a∈[2..5], b∈[1..5]。

    a∈[2..5] に固定（a=1 は Pattern 1/2 の領域）。
    b=1 のときは "y" 単独表記（"1y" は教育上不自然なので回避）。
    """
    a = rng.randint(2, 5)
    b = rng.randint(1, 5)
    c_x2 = a * a
    c_y2 = -(b * b)
    ax_str = f"{a}x"
    by_str = "y" if b == 1 else f"{b}y"
    problem_latex = f"({ax_str} + {by_str})({ax_str} - {by_str})"
    canonical = _multivar_canonical(c_x2, 0, c_y2)
    return problem_latex, canonical, {
        "kind": "type_multivar", "subkind": "xy_diff_double",
        "a": a, "b": b, "c_x2": c_x2, "c_xy": 0, "c_y2": c_y2,
    }


def _resolve_band_d_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → サブパターン名。cumulative dispatch（rank_03/02/07/08 と同方式）。"""
    cumulative = 0
    for subkind in ("xy_basic", "xy_diff_coef", "xy_square", "xy_diff_double"):
        n = int(subcounts.get(subkind, 0))
        if slot_index < cumulative + n:
            return subkind
        cumulative += n
    return "xy_diff_double"  # フォールバック


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    cfg = get_band(4, band)
    kind = cfg["kind"]

    for _ in range(300):
        if kind == "type_xab":
            built = _gen_type_xab(rng, cfg["const_max"])
        elif kind == "type_square":
            built = _gen_type_square(rng, cfg["const_max"])
        elif kind == "type_diff_squares":
            built = _gen_type_diff_squares(rng, cfg["const_max"])
        elif kind == "type_multivar":
            # Band D（Phase 2 Wave 3 新設）：多変数化 4 パターン
            sub = _resolve_band_d_subkind(slot_index, cfg.get("subcounts", {}))
            if sub == "xy_basic":
                built = _gen_xy_basic(rng)
            elif sub == "xy_diff_coef":
                built = _gen_xy_diff_coef(rng)
            elif sub == "xy_square":
                built = _gen_xy_square(rng)
            elif sub == "xy_diff_double":
                built = _gen_xy_diff_double(rng)
            else:
                raise NotImplementedError(f"unknown subkind: {sub}")
        else:
            raise NotImplementedError(kind)
        problem_latex, canonical, info = built

        allowed = av.variants_for_polynomial(canonical)
        return {
            "problemLatex": problem_latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 4,
                "band": band,
                **info,
            },
        }
    raise RuntimeError(f"rank 4 band {band}: 300 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    # SymPy で展開して期待形と一致するか厳密検証
    x = sp.symbols("x")
    if meta["kind"] == "type_xab":
        expr = (x + meta["a"]) * (x + meta["b"])
    elif meta["kind"] == "type_square":
        expr = (x + meta["a"]) ** 2
    elif meta["kind"] == "type_diff_squares":
        expr = (x + meta["a"]) * (x - meta["a"])
    elif meta["kind"] == "type_multivar":
        # Band D（Phase 2 Wave 3 新設）：多変数 (x, y) の乗法公式
        return _self_check_multivar(meta, problem)
    else:
        return False
    expanded = sp.expand(expr)
    coeffs = sp.Poly(expanded, x).all_coeffs()
    expected = [meta["c2"], meta["c1"], meta["c0"]]
    # SymPy 側は最高次のみを返すので、長さを揃える
    while len(coeffs) < 3:
        coeffs = [0] + coeffs
    if [int(c) for c in coeffs] != expected:
        return False
    if poly_latex(expected) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True


def _self_check_multivar(meta: Dict[str, Any], problem: Dict[str, Any]) -> bool:
    """Band D（type_multivar）の self_check。SymPy で 2 変数展開を厳密検証。"""
    x, y = sp.symbols("x y")
    sub = meta["subkind"]
    if sub == "xy_basic":
        expr = (x + y) * (x - y)
    elif sub == "xy_diff_coef":
        a = meta["a"]
        expr = (x + a * y) * (x - a * y)
    elif sub == "xy_square":
        a, b = meta["a"], meta["b"]
        expr = (a * x + b * y) ** 2
    elif sub == "xy_diff_double":
        a, b = meta["a"], meta["b"]
        expr = (a * x + b * y) * (a * x - b * y)
    else:
        return False
    expanded = sp.expand(expr)
    # 期待係数：x², xy, y²
    c_x2_actual = int(expanded.coeff(x, 2).coeff(y, 0))
    c_xy_actual = int(expanded.coeff(x, 1).coeff(y, 1))
    c_y2_actual = int(expanded.coeff(x, 0).coeff(y, 2))
    if (c_x2_actual, c_xy_actual, c_y2_actual) != (meta["c_x2"], meta["c_xy"], meta["c_y2"]):
        return False
    # canonical の再構築一致確認
    if _multivar_canonical(meta["c_x2"], meta["c_xy"], meta["c_y2"]) != problem["answerCanonical"]:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
