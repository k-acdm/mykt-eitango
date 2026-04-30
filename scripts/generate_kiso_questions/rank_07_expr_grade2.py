# ============================================================
# 重要：このスクリプトを編集する前に必ず読んでください
# scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md
# ============================================================
"""7級：式の計算 中2（仕様書 §6.5）。

Phase 1（2026-04-30）: 30→50 題に拡充、Band C を 3 サブパターンに分離。

A: 多項式の加減 — (3x + 2) + (x - 5) → 4x - 3 / count=17
B: 多項式 × 整数 / 整数で割る — 2(3x + 1) → 6x + 2 / (4x + 6) ÷ 2 → 2x + 3 / count=17
C: 単項式の乗除と累乗（slot_index 駆動の決定論的サブパターン分離、count=16）
   subcounts={"power":5, "mono_mul":6, "mono_div":5}（ふくちさん教育的判断、mono_mul を 1 問多めに）
   - power     : 既存の (coef·var)^exp 単項式の累乗
   - mono_mul  : 単項式×単項式（同変数 2x²·3x=6x³ / 異変数 2x·3y=6xy 両対応）
   - mono_div  : 単項式÷単項式（整数結果と分数結果（7xy÷2x=7y/2 など）両方を生成）

教育的拡充の動機：中2 文字式の標準カリキュラム（多項式の加減、多項式と数の乗除、
単項式の乗除・累乗）のうち、旧構成では「単項式の乗除」が抜けていたため
Phase 1 で網羅させた。

§6.4.0 既約性原則：問題式・答え式の分数係数は既約形。
TODO_PHASE3: 筆算形式、3 変数、より複雑な指数関係（負の指数等）は Phase 3 以降。
"""

from __future__ import annotations

import random
import re
from math import gcd
from typing import Any, Dict, List, Tuple

import sympy as sp

from common.band_config import get_band
from common import answer_variants as av
from common.sympy_helpers import (
    is_lowest_terms,
    assert_problem_fractions_in_lowest_terms,
)


def _coef_str(coef: int, leading: bool) -> str:
    if coef == 0:
        return ""
    if leading:
        if coef == 1:
            return ""
        if coef == -1:
            return "-"
        return str(coef)
    abs_c = abs(coef)
    return "" if abs_c == 1 else str(abs_c)


def _term_x_latex(coef: int, var: str, exp: int, leading: bool) -> str:
    """coef * var^exp（exp=0 なら定数項）。"""
    if coef == 0:
        return ""
    if exp == 0:
        if leading:
            return str(coef)
        return str(abs(coef))
    cs = _coef_str(coef, leading=leading)
    var_part = var if exp == 1 else f"{var}^{{{exp}}}"
    if cs == "" or cs == "-":
        return f"{cs}{var_part}"
    return f"{cs}{var_part}"


def _poly_latex(coeffs: List[int], var: str = "x") -> str:
    """係数リスト [a_n, a_{n-1}, ..., a_0] を LaTeX に。

    最高次から並べる。ゼロ係数の項はスキップ。先頭は符号付きそのまま、
    以降は op(+/-) と絶対値で連結。
    """
    n = len(coeffs) - 1
    parts: List[str] = []
    for i, c in enumerate(coeffs):
        exp = n - i
        if c == 0:
            continue
        if not parts:
            parts.append(_term_x_latex(c, var, exp, leading=True))
        else:
            op = " + " if c > 0 else " - "
            parts.append(op + _term_x_latex(c, var, exp, leading=False))
    return "".join(parts) if parts else "0"


def _gen_linear_poly(rng, coef_max, const_max) -> Tuple[int, int]:
    """ax + b （a, b ともに非零）。"""
    while True:
        a = rng.randint(-coef_max, coef_max)
        b = rng.randint(-const_max, const_max)
        if a != 0 and b != 0:
            return a, b


def _gen_poly_addsub(rng, coef_max, const_max):
    """(ax + b) + (cx + d) もしくは (ax + b) - (cx + d)。"""
    a, b = _gen_linear_poly(rng, coef_max, const_max)
    c, d = _gen_linear_poly(rng, coef_max, const_max)
    op = rng.choice(["+", "-"])
    if op == "+":
        ra, rb = a + c, b + d
    else:
        ra, rb = a - c, b - d
    if ra == 0 and rb == 0:
        return None
    problem_latex = f"({_poly_latex([a, b])}) {op} ({_poly_latex([c, d])})"
    canonical = _poly_latex([ra, rb])
    return problem_latex, canonical, {"a": a, "b": b, "c": c, "d": d, "op": op,
                                      "ra": ra, "rb": rb}


def _gen_poly_int_muldiv(rng, coef_max, const_max, factor_max):
    """k(ax + b) もしくは (ax + b) ÷ k（k が a, b の公約数）。"""
    op = rng.choice(["*", "/"])
    if op == "*":
        a, b = _gen_linear_poly(rng, coef_max, const_max)
        # k は ±[2..factor_max]、自明な ±1 を弾く
        k = rng.choice([n for n in range(-factor_max, factor_max + 1) if abs(n) >= 2])
        ra, rb = k * a, k * b
        problem_latex = f"{k if k > 0 else f'({k})'}({_poly_latex([a, b])})"
        canonical = _poly_latex([ra, rb])
        return problem_latex, canonical, {"k": k, "a": a, "b": b, "ra": ra, "rb": rb, "op": op}
    # ÷ k：a, b が k の倍数になるよう構築
    k = rng.choice([n for n in range(2, factor_max + 1)])  # 正の k のみで簡略化
    ra = rng.randint(-coef_max, coef_max)
    rb = rng.randint(-const_max, const_max)
    if ra == 0 or rb == 0:
        return None
    a, b = ra * k, rb * k
    problem_latex = f"({_poly_latex([a, b])}) \\div {k}"
    canonical = _poly_latex([ra, rb])
    return problem_latex, canonical, {"k": k, "a": a, "b": b, "ra": ra, "rb": rb, "op": op}


def _gen_monomial_power(rng, coef_max, exp_max):
    """(coef * var)^exp → coef^exp * var^exp。

    例：(2x)^3 → 8x^3、(-3a)^2 → 9a^2、(-2y)^3 → -8y^3
    """
    var = rng.choice(["x", "y", "a", "b"])
    coef = rng.choice([n for n in range(-coef_max, coef_max + 1) if abs(n) >= 2])
    exp = rng.randint(2, exp_max)
    result_coef = coef ** exp
    result_exp = exp

    # 問題式：(coef * var)^exp。coef が ±1 なら裸の var をそのまま、coef が負なら括弧
    if coef == 1:
        inside = var
    elif coef == -1:
        inside = f"-{var}"
    else:
        inside = f"{coef}{var}"
    problem_latex = f"({inside})^{{{exp}}}"

    # 答え：result_coef * var^result_exp
    canonical = _term_x_latex(result_coef, var, result_exp, leading=True)
    return problem_latex, canonical, {
        "var": var, "coef": coef, "exp": exp,
        "result_coef": result_coef, "result_exp": result_exp,
    }


# --- 単項式（mono_mul / mono_div）用ヘルパー -------------------------------
#
# 中2 文字式の単項式乗除を扱う。複数変数（x, y, a, b）対応、整数結果と分数結果両方。
# 変数は alphabetical 順（a, b, x, y）に正規化して canonical 出力する。

_MONO_VAR_POOL = ["x", "y", "a", "b"]


def _build_mono_part(vars_dict: Dict[str, int]) -> str:
    """vars_dict（{var: exp > 0}）を alphabetical-sorted な LaTeX 変数部に。

    例: {'x': 2, 'y': 1} -> 'x^{2}y'
        {} -> ''（all vars cancelled）
    """
    parts: List[str] = []
    for v in sorted(vars_dict.keys()):
        e = vars_dict[v]
        if e <= 0:
            continue
        if e == 1:
            parts.append(v)
        else:
            parts.append(f"{v}^{{{e}}}")
    return "".join(parts)


def _mono_term_latex(coef: int, vars_dict: Dict[str, int]) -> str:
    """単項式の LaTeX（問題式の各因子・整数係数の canonical 共通）。

    coef=1 / -1 / 0、変数なし、変数あり全パターンに対応。
    """
    var_part = _build_mono_part(vars_dict)
    if coef == 0:
        return "0"
    if not var_part:
        return str(coef)
    if coef == 1:
        return var_part
    if coef == -1:
        return f"-{var_part}"
    return f"{coef}{var_part}"


def _mono_canonical_int(coef: int, vars_dict: Dict[str, int]) -> str:
    return _mono_term_latex(coef, vars_dict)


def _mono_canonical_frac(num: int, denom: int, vars_dict: Dict[str, int]) -> str:
    """既約分数 num/denom（denom > 1）係数 + 変数部の canonical。

    例: num=7, denom=2, vars_dict={'y':1} -> '\\frac{7}{2}y'
        num=-7, denom=2, vars_dict={} -> '-\\frac{7}{2}'
    """
    var_part = _build_mono_part(vars_dict)
    abs_num = abs(num)
    sign = "-" if num < 0 else ""
    return f"{sign}\\frac{{{abs_num}}}{{{denom}}}{var_part}"


def _mono_variants(num: int, denom: int, vars_dict: Dict[str, int]) -> List[str]:
    """単項式の許容表記を生成。

    - 整数結果: variants_for_polynomial に委譲（caret 形式 x^2 / brace 形式 x^{2} 両方）
    - 分数結果: variants_for_polynomial に加えて以下を明示生成：
        * \\frac{N}{D}{vars}  （canonical）
        * N/D{vars}            （スラッシュ前置・スペースなし）
        * N/D {vars}           （スラッシュ前置・スペースあり）
        * N{vars}/D            （スラッシュ後置）
        * \\frac{N{vars}}{D}   （変数を分子内に）
      - vars 部は brace 形式（x^{2}）と caret 形式（x^2）の両方を網羅
      - 純粋分数（vars なし）は variants_for_rational で小数形（3.5 等）も追加
    マイナス符号は半角「-」/ 全角「−」/ 長音「ー」の 3 形を最後に展開。
    """
    if denom == 1:
        canonical = _mono_canonical_int(num, vars_dict)
        seeds: set = set(av.variants_for_polynomial(canonical))
    else:
        canonical = _mono_canonical_frac(num, denom, vars_dict)
        seeds = set(av.variants_for_polynomial(canonical))
        var_part = _build_mono_part(vars_dict)
        if not var_part:
            # 純粋分数（変数がすべて約分された場合） — 小数・帯分数・既約形等を追加
            seeds.update(av.variants_for_rational(sp.Rational(num, denom)))
        else:
            abs_num = abs(num)
            sign = "-" if num < 0 else ""
            num_display = "" if abs_num == 1 else str(abs_num)
            # caret 形式の var 部（x^{2}y -> x^2y）
            var_caret = re.sub(r"\^\{(-?\d+)\}", r"^\1", var_part)
            for vform in {var_part, var_caret}:
                # スラッシュ後置 "7y/2"
                seeds.add(f"{sign}{num_display}{vform}/{denom}")
                # \frac{7y}{2}（変数を分子内に）
                seeds.add(f"{sign}\\frac{{{num_display}{vform}}}{{{denom}}}")
                # スラッシュ前置 caret 形式 "7/2y"（前置 brace 形式は variants_for_polynomial が生成済）
                if vform == var_caret:
                    seeds.add(f"{sign}{abs_num}/{denom}{vform}")
                    seeds.add(f"{sign}{abs_num}/{denom} {vform}")
    # マイナス全/半角バリアント拡張
    expanded: set = set()
    for s in seeds:
        expanded.add(s)
        if "-" in s:
            expanded.add(s.replace("-", "−"))
            expanded.add(s.replace("-", "ー"))
    return sorted(expanded)


def _gen_mono_mul(rng):
    """単項式 × 単項式。同変数（2x²·3x = 6x³）と異変数（2x · 3y = 6xy）を生成。

    - var1, var2 ∈ {x, y, a, b}（同じでも異なってもよい）
    - coef1, coef2 ∈ [-5, 5] \\ {0}（両方 ±1 は退屈なので除外）
    - exp1, exp2 ∈ [1, 3]（同変数で合計 > 5 はごちゃつくので除外）
    - 結果 coef = coef1 × coef2、結果 vars: 同変数なら指数加算、異変数なら両方残す
    """
    coef_pool = [n for n in range(-5, 6) if n != 0]
    while True:
        var1 = rng.choice(_MONO_VAR_POOL)
        var2 = rng.choice(_MONO_VAR_POOL)
        coef1 = rng.choice(coef_pool)
        coef2 = rng.choice(coef_pool)
        # 両方 ±1 は教育的に退屈なので除外（結果は単純な単項式そのもの）
        if abs(coef1) == 1 and abs(coef2) == 1:
            continue
        exp1 = rng.randint(1, 3)
        exp2 = rng.randint(1, 3)
        # 同変数で指数合計 > 5 は教育的に複雑すぎるため除外
        if var1 == var2 and exp1 + exp2 > 5:
            continue
        # 結果 vars 構築
        result_vars: Dict[str, int] = {}
        result_vars[var1] = result_vars.get(var1, 0) + exp1
        result_vars[var2] = result_vars.get(var2, 0) + exp2
        result_coef = coef1 * coef2
        # 問題式 LaTeX（入力順を保持、教育的多様性のため var 並び替えはしない）
        # 第2因子が負の場合は括弧で囲む（中2 教科書標準: 3b × (-4a³)）。
        # 第1因子の負号は先頭にあるので括弧不要（-4x × 3x³）。
        m1 = _mono_term_latex(coef1, {var1: exp1})
        m2 = _mono_term_latex(coef2, {var2: exp2})
        m2_disp = f"({m2})" if coef2 < 0 else m2
        problem_latex = f"{m1} \\times {m2_disp}"
        canonical = _mono_canonical_int(result_coef, result_vars)
        return problem_latex, canonical, {
            "var1": var1, "coef1": coef1, "exp1": exp1,
            "var2": var2, "coef2": coef2, "exp2": exp2,
            "result_coef": result_coef, "result_vars": dict(result_vars),
        }


def _gen_mono_div(rng):
    """単項式 ÷ 単項式。整数結果と分数結果（7xy ÷ 2x = 7y/2）両方を生成。

    制約：
    - 分子の vars は 1〜2 種、分母の vars は分子の vars の subset（分母指数 ≤ 分子指数）
    - num_coef ∈ [-5, 5] \\ {0}、denom_coef ∈ [2, 5]（denom_coef = 1 は trivial なので除外）
    - 結果は num_coef / denom_coef を gcd 約分（既約分数 or 整数）
    - result が "1"（vars なし、num=denom=1 後）など trivial な場合は除外
    """
    coef_pool = [n for n in range(-5, 6) if n != 0]
    while True:
        # 分子の var セット（1 種 or 2 種）
        num_vars_count = rng.choice([1, 2])
        chosen_vars = rng.sample(_MONO_VAR_POOL, num_vars_count)
        num_vars = {v: rng.randint(1, 3) for v in chosen_vars}
        # 分母 vars: 分子 vars の subset、各 var の指数は 1〜分子の指数
        denom_vars_count = rng.randint(1, num_vars_count)
        denom_var_keys = rng.sample(chosen_vars, denom_vars_count)
        denom_vars = {v: rng.randint(1, num_vars[v]) for v in denom_var_keys}
        # 係数
        num_coef = rng.choice(coef_pool)
        denom_coef = rng.randint(2, 5)
        # 結果 vars: 分子 - 分母（指数差し引き、0 になる var は除外）
        result_vars: Dict[str, int] = {}
        for v, e in num_vars.items():
            new_e = e - denom_vars.get(v, 0)
            if new_e > 0:
                result_vars[v] = new_e
        # 結果 coef: gcd 約分
        g = gcd(abs(num_coef), denom_coef)
        result_num = num_coef // g
        result_denom = denom_coef // g
        # trivial な結果は除外（"1" / "-1"、変数なし）
        if not result_vars and result_denom == 1 and abs(result_num) == 1:
            continue
        # 問題式 LaTeX
        m_num = _mono_term_latex(num_coef, num_vars)
        m_denom = _mono_term_latex(denom_coef, denom_vars)
        problem_latex = f"{m_num} \\div {m_denom}"
        if result_denom == 1:
            canonical = _mono_canonical_int(result_num, result_vars)
        else:
            canonical = _mono_canonical_frac(result_num, result_denom, result_vars)
        return problem_latex, canonical, {
            "num_coef": num_coef, "num_vars": dict(num_vars),
            "denom_coef": denom_coef, "denom_vars": dict(denom_vars),
            "result_num": result_num, "result_denom": result_denom,
            "result_vars": dict(result_vars),
        }


# slot_index 駆動の決定論的 Band C dispatcher（rank_03 / rank_02 と同パターン）
_BAND_C_PATTERN_ORDER = ["power", "mono_mul", "mono_div"]


def _resolve_band_c_subkind(slot_index: int, subcounts: Dict[str, int]) -> str:
    """slot_index → subkind の決定論的 dispatch。

    例: subcounts={"power":5, "mono_mul":6, "mono_div":5}
        slot 0-4   → "power"
        slot 5-10  → "mono_mul"
        slot 11-15 → "mono_div"
    """
    boundary = 0
    for kind in _BAND_C_PATTERN_ORDER:
        boundary += int(subcounts.get(kind, 0))
        if slot_index < boundary:
            return kind
    raise ValueError(
        f"slot_index {slot_index} が subcounts {subcounts} の範囲外。"
        f"band_config の count と subcounts の総和が一致しているか確認"
    )


def generate_problem(band: str, rng: random.Random, slot_index: int = 0) -> Dict[str, Any]:
    cfg = get_band(7, band)
    kind = cfg["kind"]

    for _ in range(500):
        if kind == "poly_addsub":
            built = _gen_poly_addsub(rng, cfg["coef_max"], cfg["const_max"])
        elif kind == "poly_int_muldiv":
            built = _gen_poly_int_muldiv(rng, cfg["coef_max"], cfg["const_max"], cfg["factor_max"])
        elif kind == "mono_mixed":
            # Band C: subcounts と slot_index でサブパターンを決定論的に dispatch
            subkind = _resolve_band_c_subkind(slot_index, cfg["subcounts"])
            if subkind == "power":
                built = _gen_monomial_power(rng, cfg["coef_max"], cfg["exp_max"])
            elif subkind == "mono_mul":
                built = _gen_mono_mul(rng)
            else:  # mono_div
                built = _gen_mono_div(rng)
            # subkind 情報を info に保存（self_check で使用）
            if built is not None:
                pl, cn, info = built
                info["subkind"] = subkind
                built = (pl, cn, info)
        elif kind == "monomial_power":
            # 旧構成（band_config で kind が "monomial_power" のままの場合）の互換用
            built = _gen_monomial_power(rng, cfg["coef_max"], cfg["exp_max"])
        else:
            raise NotImplementedError(kind)
        if built is None:
            continue
        problem_latex, canonical, info = built

        # 許容表記の生成: subkind 別
        subkind = info.get("subkind", kind)
        if subkind in ("mono_mul", "mono_div"):
            allowed = _mono_variants(
                info.get("result_num", info.get("result_coef", 0)),
                info.get("result_denom", 1),
                info.get("result_vars", {}),
            )
        else:
            allowed = av.variants_for_polynomial(canonical)
        return {
            "problemLatex": problem_latex,
            "answerCanonical": canonical,
            "answerAllowed": allowed,
            "_meta": {
                "rank": 7,
                "band": band,
                "kind": subkind if subkind in ("mono_mul", "mono_div", "power") else kind,
                **info,
            },
        }
    raise RuntimeError(f"rank 7 band {band}: 500 retries exhausted")


def self_check(problem: Dict[str, Any]) -> bool:
    meta = problem["_meta"]
    kind = meta["kind"]
    if kind == "poly_addsub":
        a, b, c, d, op = meta["a"], meta["b"], meta["c"], meta["d"], meta["op"]
        ra_exp, rb_exp = (a + c, b + d) if op == "+" else (a - c, b - d)
        if ra_exp != meta["ra"] or rb_exp != meta["rb"]:
            return False
        if _poly_latex([ra_exp, rb_exp]) != problem["answerCanonical"]:
            return False
    elif kind == "poly_int_muldiv":
        if meta["op"] == "*":
            ra_exp, rb_exp = meta["k"] * meta["a"], meta["k"] * meta["b"]
        else:
            if meta["a"] % meta["k"] != 0 or meta["b"] % meta["k"] != 0:
                return False
            ra_exp, rb_exp = meta["a"] // meta["k"], meta["b"] // meta["k"]
        if ra_exp != meta["ra"] or rb_exp != meta["rb"]:
            return False
        if _poly_latex([ra_exp, rb_exp]) != problem["answerCanonical"]:
            return False
    elif kind in ("monomial_power", "power"):
        rc = meta["coef"] ** meta["exp"]
        re_ = meta["exp"]
        if rc != meta["result_coef"] or re_ != meta["result_exp"]:
            return False
        expected = _term_x_latex(rc, meta["var"], re_, leading=True)
        if expected != problem["answerCanonical"]:
            return False
    elif kind == "mono_mul":
        # SymPy で式を評価し、結果が canonical と数学的に等価か確認
        symbols = {v: sp.Symbol(v) for v in set([meta["var1"], meta["var2"]])}
        m1 = meta["coef1"] * symbols[meta["var1"]] ** meta["exp1"]
        m2 = meta["coef2"] * symbols[meta["var2"]] ** meta["exp2"]
        product = sp.expand(m1 * m2)
        # 結果 vars を SymPy 式に
        rv = meta["result_vars"]
        expected_expr = sp.Integer(meta["result_coef"])
        for v, e in rv.items():
            if v not in symbols:
                symbols[v] = sp.Symbol(v)
            expected_expr *= symbols[v] ** e
        expected_expr = sp.expand(expected_expr)
        if sp.simplify(product - expected_expr) != 0:
            return False
        if _mono_canonical_int(meta["result_coef"], rv) != problem["answerCanonical"]:
            return False
    elif kind == "mono_div":
        # SymPy で除算結果を確認
        all_vars = set(meta["num_vars"].keys()) | set(meta["denom_vars"].keys()) | set(meta["result_vars"].keys())
        symbols = {v: sp.Symbol(v) for v in all_vars}
        m_num = sp.Integer(meta["num_coef"])
        for v, e in meta["num_vars"].items():
            m_num *= symbols[v] ** e
        m_denom = sp.Integer(meta["denom_coef"])
        for v, e in meta["denom_vars"].items():
            m_denom *= symbols[v] ** e
        quotient = sp.simplify(m_num / m_denom)
        # 期待値（result_num/result_denom * result_vars の積）
        expected_expr = sp.Rational(meta["result_num"], meta["result_denom"])
        for v, e in meta["result_vars"].items():
            expected_expr *= symbols[v] ** e
        if sp.simplify(quotient - expected_expr) != 0:
            return False
        # canonical 一致確認
        if meta["result_denom"] == 1:
            expected_canon = _mono_canonical_int(meta["result_num"], meta["result_vars"])
        else:
            expected_canon = _mono_canonical_frac(meta["result_num"], meta["result_denom"], meta["result_vars"])
        if expected_canon != problem["answerCanonical"]:
            return False
        # 既約性チェック（結果分数が gcd=1）
        if meta["result_denom"] > 1:
            if gcd(abs(meta["result_num"]), meta["result_denom"]) != 1:
                return False
    else:
        return False
    try:
        assert_problem_fractions_in_lowest_terms(problem["problemLatex"])
    except AssertionError:
        return False
    return True
