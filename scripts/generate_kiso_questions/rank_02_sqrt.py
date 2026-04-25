# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""2級：平方根（仕様書 §6.5、§6.8 決定3）。

A: 簡約のみ — √n → a√b（b は square-free）
B: 簡約 + 加減 — c√n + d√m → 同じ b に簡約後、係数を加減
C: 乗除 と 有理化 — 1/√n → √n/n、a/√b → a√b/b 等

TODO_PHASE3: 二重根号、有理化が複雑な分子分母（例: 1/(√3+1)）は Phase 3 の Band D 以降で導入。

§6.8 決定3 を厳守：
  - 答えはすべて簡約形（√8 などは NG、必ず 2√2）
  - 分母に √ が残らない（必ず有理化）
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Set, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.latex_utils import sqrt_term_latex, frac_latex_raw
from common.sympy_helpers import (
    simplify_sqrt,
    is_perfect_square,
    assert_problem_fractions_in_lowest_terms,
)


# --- 2 級用の答え表記（plain text） ----------------------------------------

def _sqrt_plain(coef: int, radicand: int) -> str:
    """plain-text 表記の a√b（OCR 比較用）。

    例：(2, 3) → "2√3"、(1, 5) → "√5"、(-3, 2) → "-3√2"、(5, 1) → "5"
    """
    if coef == 0:
        return "0"
    if radicand == 1:
        return str(coef)
    if coef == 1:
        return f"√{radicand}"
    if coef == -1:
        return f"-√{radicand}"
    return f"{coef}√{radicand}"


def _variants_for_sqrt(coef: int, radicand: int) -> List[str]:
    """単項 a√b の許容表記。"""
    if radicand == 1:
        return av.variants_for_integer(coef)
    base = _sqrt_plain(coef, radicand)
    seeds: Set[str] = {base}
    # 空白入り版
    if coef not in (1, -1):
        seeds.add(base.replace(f"{coef}√" if coef > 0 else f"{abs(coef)}√",
                               f"{coef} √" if coef > 0 else f"{abs(coef)} √"))
    # 全角・半角マイナス
    result: Set[str] = set()
    for s in seeds:
        result.add(s)
        if "-" in s:
            result.add(s.replace("-", "−"))
            result.add(s.replace("-", "ー"))
    return sorted(result)


def _variants_for_rationalized(num_coef: int, num_radicand: int, denom: int) -> List[str]:
    """有理化済み (num_coef * √num_radicand) / denom の許容表記（plain text）。

    分子は簡約形、分母は正の整数。num_radicand=1 なら整数分子（普通の分数）。
    """
    if num_radicand == 1:
        # 普通の有理数（既約）
        return av.variants_for_rational(sp.Rational(num_coef, denom))
    # 分子の単項表記
    num_str = _sqrt_plain(num_coef, num_radicand)
    base = f"{num_str}/{denom}"
    seeds: Set[str] = {base}
    # スラッシュ全角
    seeds.add(base.replace("/", "／"))
    # マイナス全/半角
    result: Set[str] = set()
    for s in seeds:
        result.add(s)
        if "-" in s:
            result.add(s.replace("-", "−"))
            result.add(s.replace("-", "ー"))
    return sorted(result)


# --- Band A: 簡約のみ -------------------------------------------------------

def _gen_simplify_only(rng, n_max):
    """√n（n は完全平方でない、かつ簡約後 b > 1 になるよう n に平方因子を含む）。"""
    while True:
        n = rng.randint(2, n_max)
        # 完全平方は答えが整数になり 2 級らしくないので除外
        if is_perfect_square(n):
            continue
        a, b = simplify_sqrt(n)
        # 簡約後の係数が 1 だと「√n がそのまま」になり、簡約問題として価値が薄い
        if a == 1:
            continue
        # 問題：√n、答え：a√b
        problem_latex = f"\\sqrt{{{n}}}"
        canonical = _sqrt_plain(a, b)
        return problem_latex, canonical, {
            "kind": "simplify_only", "n": n, "a": a, "b": b,
        }


# --- Band B: 簡約 + 加減 ----------------------------------------------------

def _gen_addsub_with_simplify(rng, coef_max, n_max):
    """c1 √n1 ± c2 √n2 → 簡約後に同じ b に揃い、係数を加減できる組のみ採用。

    **重要**: 共通 radicand b は **square-free**（平方因子を含まない）でなければならない。
    `is_perfect_square` だけでは 8 = 4*2 のような「完全平方ではないが平方因子を含む数」を
    弾けないため、`simplify_sqrt(b) == (1, b)` で判定する。
    """
    while True:
        # b は square-free（√b がそれ以上簡約できない）
        b_candidates = [n for n in range(2, n_max + 1) if simplify_sqrt(n) == (1, n)]
        b = rng.choice(b_candidates)
        # 簡約後の係数となる k_i を選ぶ（1 含む。両方 1 は除外）
        k1 = rng.randint(1, 5)
        k2 = rng.randint(1, 5)
        if k1 == 1 and k2 == 1:
            continue
        # 元の radicand
        n1 = b * k1 * k1
        n2 = b * k2 * k2
        if n1 > n_max or n2 > n_max:
            continue
        # 元の係数 c1, c2（±1〜±coef_max、ここは ±1 も許容）
        c1 = rng.choice([n for n in range(-coef_max, coef_max + 1) if n != 0])
        c2 = rng.choice([n for n in range(-coef_max, coef_max + 1) if n != 0])
        # 結果係数：c1 * k1 + c2 * k2（符号は op 込み）
        op = rng.choice(["+", "-"])
        result_coef = c1 * k1 + c2 * k2 if op == "+" else c1 * k1 - c2 * k2
        if result_coef == 0:
            continue  # 自明 0 は退屈
        # 問題式 LaTeX
        def term_latex(c, n):
            if c == 1:
                return f"\\sqrt{{{n}}}"
            if c == -1:
                return f"-\\sqrt{{{n}}}"
            return f"{c}\\sqrt{{{n}}}"
        first = term_latex(c1, n1)
        op_latex = " + " if op == "+" else " - "
        second = term_latex(abs(c2), n2)
        # c2 が負だと op の符号を反転させる必要があるが、ここは「式そのまま」表記で済ませる
        # 例：3√2 + (-2)√3 → 3√2 - 2√3 として表示
        if c2 < 0:
            actual_op = " - " if op == "+" else " + "
            second = term_latex(abs(c2), n2)
            problem_latex = f"{first}{actual_op}{second}"
        else:
            problem_latex = f"{first}{op_latex}{second}"
        canonical = _sqrt_plain(result_coef, b)
        return problem_latex, canonical, {
            "kind": "addsub_with_simplify",
            "c1": c1, "n1": n1, "c2": c2, "n2": n2, "op": op,
            "k1": k1, "k2": k2, "b": b,
            "result_coef": result_coef,
        }


# --- Band C: 乗除 と 有理化 -------------------------------------------------

def _gen_muldiv_rationalize(rng, n_max):
    """3 パターンをランダム選択：
      P1: √a × √b → 簡約形（c√d）
      P2: a / √b → a√b / b（有理化）
      P3: √a / √b → 簡約形 or 既約の (c√d)/e
    """
    pattern = rng.choice(["P1", "P2", "P3"])
    if pattern == "P1":
        a = rng.randint(2, n_max)
        b = rng.randint(2, n_max)
        n_result = a * b
        if is_perfect_square(n_result):
            return None  # 整数になると Band C 入門としては微妙
        c, d = simplify_sqrt(n_result)
        if d == 1:
            return None
        problem_latex = f"\\sqrt{{{a}}} \\times \\sqrt{{{b}}}"
        canonical = _sqrt_plain(c, d)
        return problem_latex, canonical, {
            "kind": "muldiv_P1", "a": a, "b": b,
            "result_coef": c, "result_radicand": d,
        }
    if pattern == "P2":
        a = rng.randint(2, n_max)
        b = rng.randint(2, n_max)
        # 【入門難易度配慮】b は square-free に限定（√12 のような未簡約表示を避ける）
        # TODO_PHASE3: b に平方因子がある（√12 → 2√3 を経由してから有理化）ケースは
        # Phase 3 の Band D 以降で導入
        if simplify_sqrt(b) != (1, b):
            return None
        # a / √b = a√b / b （簡約：分子の係数 a と分母 b は既約に）
        from math import gcd
        g = gcd(a, b)
        num_coef = a // g
        denom = b // g
        if denom == 1:
            return None  # 整数化（P1 と被る）
        problem_latex = f"\\frac{{{a}}}{{\\sqrt{{{b}}}}}"
        canonical = f"{_sqrt_plain(num_coef, b)}/{denom}"
        return problem_latex, canonical, {
            "kind": "muldiv_P2", "a": a, "b": b,
            "num_coef": num_coef, "denom": denom,
        }
    # P3: √a / √b
    a = rng.randint(2, n_max)
    b = rng.randint(2, n_max)
    if is_perfect_square(b):
        return None
    # √a / √b = √(a/b)。a/b が整数なら √(a/b) → 簡約。
    # 一般には √(a/b) = √(ab) / b（有理化）
    n_under = a * b
    if is_perfect_square(n_under):
        return None
    c, d = simplify_sqrt(n_under)
    # (c√d)/b → 既約化：gcd(c, b) で約分
    from math import gcd
    g = gcd(c, b)
    num_coef = c // g
    denom = b // g
    if denom == 1 and d == 1:
        return None  # 整数化
    problem_latex = f"\\frac{{\\sqrt{{{a}}}}}{{\\sqrt{{{b}}}}}"
    if denom == 1:
        canonical = _sqrt_plain(num_coef, d)
    else:
        canonical = f"{_sqrt_plain(num_coef, d)}/{denom}"
    return problem_latex, canonical, {
        "kind": "muldiv_P3", "a": a, "b": b,
        "num_coef": num_coef, "num_radicand": d, "denom": denom,
    }


def generate_problem(band: str, rng: random.Random) -> Dict[str, Any]:
    cfg = get_band(2, band)
    kind = cfg["kind"]

    for _ in range(500):
        if kind == "simplify_only":
            built = _gen_simplify_only(rng, cfg["n_max"])
        elif kind == "addsub_with_simplify":
            built = _gen_addsub_with_simplify(rng, cfg["coef_max"], cfg["n_max"])
        elif kind == "muldiv_rationalize":
            built = _gen_muldiv_rationalize(rng, cfg["n_max"])
        else:
            raise NotImplementedError(kind)
        if built is None:
            continue
        problem_latex, canonical, info = built

        # 許容表記の生成（kind 別）
        if kind == "simplify_only":
            allowed = _variants_for_sqrt(info["a"], info["b"])
        elif kind == "addsub_with_simplify":
            allowed = _variants_for_sqrt(info["result_coef"], info["b"])
        elif kind == "muldiv_rationalize":
            if info["kind"] == "muldiv_P1":
                allowed = _variants_for_sqrt(info["result_coef"], info["result_radicand"])
            elif info["kind"] == "muldiv_P2":
                allowed = _variants_for_rationalized(info["num_coef"], info["b"], info["denom"])
            else:  # P3
                allowed = _variants_for_rationalized(info["num_coef"], info["num_radicand"], info["denom"])
        return {
            "problemLatex": problem_latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 2,
                "band": band,
                **info,
            },
        }
    raise RuntimeError(f"rank 2 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    kind = meta["kind"]
    # SymPy で問題式を評価し、答えと一致するか確認
    if kind == "simplify_only":
        n = meta["n"]
        a, b = meta["a"], meta["b"]
        # √n == a * √b in SymPy
        if sp.sqrt(n) != a * sp.sqrt(b):
            return False
        if _sqrt_plain(a, b) != problem["answerCanonical"]:
            return False
    elif kind == "addsub_with_simplify":
        c1, n1, c2, n2, op = meta["c1"], meta["n1"], meta["c2"], meta["n2"], meta["op"]
        b = meta["b"]
        rc = meta["result_coef"]
        expr = c1 * sp.sqrt(n1) + c2 * sp.sqrt(n2) if op == "+" else c1 * sp.sqrt(n1) - c2 * sp.sqrt(n2)
        if sp.simplify(expr - rc * sp.sqrt(b)) != 0:
            return False
        if _sqrt_plain(rc, b) != problem["answerCanonical"]:
            return False
    elif kind == "muldiv_P1":
        a, b = meta["a"], meta["b"]
        rc, rd = meta["result_coef"], meta["result_radicand"]
        if sp.simplify(sp.sqrt(a) * sp.sqrt(b) - rc * sp.sqrt(rd)) != 0:
            return False
        if _sqrt_plain(rc, rd) != problem["answerCanonical"]:
            return False
    elif kind == "muldiv_P2":
        a, b = meta["a"], meta["b"]
        nc, dn = meta["num_coef"], meta["denom"]
        # a / √b == nc * √b / dn
        lhs = sp.Rational(a) / sp.sqrt(b)
        rhs = sp.Rational(nc) * sp.sqrt(b) / sp.Rational(dn)
        if sp.simplify(lhs - rhs) != 0:
            return False
    elif kind == "muldiv_P3":
        a, b = meta["a"], meta["b"]
        nc, nr, dn = meta["num_coef"], meta["num_radicand"], meta["denom"]
        lhs = sp.sqrt(a) / sp.sqrt(b)
        rhs = sp.Rational(nc) * sp.sqrt(nr) / sp.Rational(dn) if dn != 1 else sp.Rational(nc) * sp.sqrt(nr)
        if sp.simplify(lhs - rhs) != 0:
            return False
    else:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
