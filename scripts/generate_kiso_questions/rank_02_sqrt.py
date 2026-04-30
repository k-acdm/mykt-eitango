# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""2級：平方根（仕様書 §6.5、§6.8 決定3）。

Phase 1（2026-04-30）: 30→50 題に拡充、Band C を 3 サブパターンに分離。

A: 簡約のみ — √n → a√b（b は square-free） / count=17
B: 簡約 + 加減 — c√n + d√m → 同じ b に簡約後、係数を加減 / count=17
C: 乗除 と 有理化（slot_index 駆動の決定論的サブパターン分離、count=16）
   subcounts={"mul":6, "rationalize":5, "div":5}（ふくちさん教育的判断、ほぼ均等）
   - mul         : √a × √b → c√d。subslot 0〜4 は a,b ∈ [2,15]、subslot 5 のみ
                   [16,30] で中堅レベルの刺激を残す（生徒上位層への刺激として）
   - rationalize : a / √b → a√b / b。b ∈ {2,3,5,6,7,10}、a ∈ [1,12]（教科書頻出）
   - div         : √a / √b → 簡約 or (c√d)/e。最終 denom ≤ 12 で極端な分母を排除

TODO_PHASE3: 二重根号、有理化が複雑な分子分母（例: 1/(√3+1)）、Band C-mul の
extended range をさらに広げる、rationalize の b を拡張する等は Phase 3 の Band D 以降で導入。

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
#
# 旧 _gen_muldiv_rationalize（P1/P2/P3 を rng でランダム選択）は廃止。
# rank_03 で確立した「slot_index 駆動の決定論的サブパターン分離」方式に移行。
# 比率を rng の偶然に依存させず subcounts={"mul":6, "rationalize":5, "div":5} で固定。
#
# 教育的引き締め（ふくちさん 36 年の塾長経験ベース）:
#   - mul:        a,b ∈ [2,15] が基本。subslot=5（6 問中の最終 1 問）のみ [16,30] で
#                 中堅レベルの刺激を残す（√13×√11 = √143 のような問題）
#   - rationalize: b ∈ {2,3,5,6,7,10}（square-free） / a ∈ [1,12]
#                  教科書頻出の典型問題（1/√2 = √2/2、3/√5 = 3√5/5 等）に集中
#   - div:        答えの denom ≤ 12 を制約。極端な分母（22 等）の問題を排除

# Band C-mul：通常範囲（subslot 0〜4 の 5 問）と刺激枠（subslot 5 の 1 問）
_MUL_RATIONAL_RANGE = (2, 15)
_MUL_STIMULATING_RANGE = (16, 30)


def _gen_mul(rng, subslot):
    """√a × √b → c√d（簡約形、d は square-free、整数化しない）。

    subslot=5（mul 6 問中の最後の 1 問）のときだけ a,b ∈ [16,30] の中堅レベル。
    それ以外は a,b ∈ [2,15] の教科書典型範囲。
    a ≤ b に正規化（数学的に同一の問題 √3×√2 と √2×√3 を統一、rank_04 Band A と同方針）。

    教育的引き締め（ふくちさん指針）:
      - subslot=5 で result_radicand ≤ 200 を制約に追加。
      - これにより √13×√11=√143 は許容、√29×√30=√870 は除外される。
      - 通常範囲 [2,15] は積最大 15*15=225 で自然に収まるため制約不要。
    """
    if subslot == 5:
        lo, hi = _MUL_STIMULATING_RANGE
        radicand_cap = 200
    else:
        lo, hi = _MUL_RATIONAL_RANGE
        radicand_cap = None
    while True:
        a = rng.randint(lo, hi)
        b = rng.randint(lo, hi)
        if a > b:
            a, b = b, a
        n_result = a * b
        if is_perfect_square(n_result):
            continue
        c, d = simplify_sqrt(n_result)
        if d == 1:
            continue
        if radicand_cap is not None and d > radicand_cap:
            continue
        problem_latex = f"\\sqrt{{{a}}} \\times \\sqrt{{{b}}}"
        canonical = _sqrt_plain(c, d)
        return problem_latex, canonical, {
            "kind": "muldiv_P1", "a": a, "b": b,
            "result_coef": c, "result_radicand": d,
        }


# Band C-rationalize：a / √b → a√b / b の典型有理化
_RATIONALIZE_DENOM_CANDIDATES = (2, 3, 5, 6, 7, 10)


def _gen_rationalize(rng):
    """a / √b → a√b / b（既約化済み）。

    b ∈ {2,3,5,6,7,10}（square-free、教科書頻出）、a ∈ [1,12]。
    分子の係数 num_coef と分母 denom は gcd で既約化する。
    """
    from math import gcd
    while True:
        b = rng.choice(_RATIONALIZE_DENOM_CANDIDATES)
        a = rng.randint(1, 12)
        g = gcd(a, b)
        num_coef = a // g
        denom = b // g
        if denom == 1:
            continue  # 整数化（√b が消える）は除外
        problem_latex = f"\\frac{{{a}}}{{\\sqrt{{{b}}}}}"
        canonical = f"{_sqrt_plain(num_coef, b)}/{denom}"
        return problem_latex, canonical, {
            "kind": "muldiv_P2", "a": a, "b": b,
            "num_coef": num_coef, "denom": denom,
        }


# Band C-div：√a / √b → 簡約 or 有理化済みの (c√d)/e
def _gen_div(rng, n_max):
    """√a / √b → 既約化済みの (num_coef √num_radicand)/denom 形式。

    教育的引き締め: 最終 denom ≤ 12 を制約に追加し、極端な分母（22, 17 等）を排除。
    """
    from math import gcd
    while True:
        a = rng.randint(2, n_max)
        b = rng.randint(2, n_max)
        if is_perfect_square(b):
            continue
        n_under = a * b
        if is_perfect_square(n_under):
            continue
        c, d = simplify_sqrt(n_under)
        g = gcd(c, b)
        num_coef = c // g
        denom = b // g
        if denom == 1 and d == 1:
            continue  # 整数化
        if denom > 12:
            continue  # ★ 教育的引き締め：denom ≤ 12 のみ採用
        problem_latex = f"\\frac{{\\sqrt{{{a}}}}}{{\\sqrt{{{b}}}}}"
        if denom == 1:
            canonical = _sqrt_plain(num_coef, d)
        else:
            canonical = f"{_sqrt_plain(num_coef, d)}/{denom}"
        return problem_latex, canonical, {
            "kind": "muldiv_P3", "a": a, "b": b,
            "num_coef": num_coef, "num_radicand": d, "denom": denom,
        }


# slot_index 駆動の決定論的 Band C dispatcher（rank_03 と同パターン）
_BAND_C_PATTERN_ORDER = ["mul", "rationalize", "div"]


def _resolve_band_c_subkind(slot_index: int, subcounts: Dict[str, int]) -> Tuple[str, int]:
    """slot_index → (subkind, subslot)。subslot は subkind 内での 0-based 位置。

    例: subcounts={"mul": 6, "rationalize": 5, "div": 5}
        slot 0-5  → ("mul", 0..5)
        slot 6-10 → ("rationalize", 0..4)
        slot 11-15→ ("div", 0..4)

    比率を rng の偶然に依存させず**決定論的**に固定する目的。同じ slot_index を
    指定すれば dedup_retry 時も同じサブパターンが選ばれる（main.py 仕様）。
    """
    prev_boundary = 0
    for kind in _BAND_C_PATTERN_ORDER:
        cnt = int(subcounts.get(kind, 0))
        if slot_index < prev_boundary + cnt:
            return kind, slot_index - prev_boundary
        prev_boundary += cnt
    raise ValueError(
        f"slot_index {slot_index} が subcounts {subcounts} の範囲外。"
        f"band_config の count と subcounts の総和が一致しているか確認"
    )


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    cfg = get_band(2, band)
    kind = cfg["kind"]

    for _ in range(500):
        if kind == "simplify_only":
            built = _gen_simplify_only(rng, cfg["n_max"])
        elif kind == "addsub_with_simplify":
            built = _gen_addsub_with_simplify(rng, cfg["coef_max"], cfg["n_max"])
        elif kind == "muldiv_rationalize":
            # Band C: subcounts と slot_index で (subkind, subslot) を決定論的に dispatch
            subkind, subslot = _resolve_band_c_subkind(slot_index, cfg["subcounts"])
            if subkind == "mul":
                built = _gen_mul(rng, subslot)
            elif subkind == "rationalize":
                built = _gen_rationalize(rng)
            else:  # "div"
                built = _gen_div(rng, cfg["n_max"])
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
