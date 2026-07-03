"""許容表記（answerAllowed）の機械生成（仕様書 §6.4.3, §6.8）。

採点時は OCR 結果と allowed のいずれかを完全一致で照合するため、
ここで生成する表記が**そのまま正解扱い**となる。

主要ルール:
- 既約分数のみ正解（決定2）
- 簡約形のみ正解（決定3）
- 帯分数・仮分数は両方許容（決定1）
- 分数 ⇔ 有限小数 は両方許容（無限小数のときは分数のみ）
- スラッシュ全角／半角、空白あり／なし、マイナス全角／半角を機械生成
"""

from __future__ import annotations

from typing import Iterable, List, Set, Tuple

import sympy as sp

from . import sympy_helpers as shp


# ---- 表記カノニカル生成 ---------------------------------------------------

def _integer_canonical(n: int) -> str:
    return str(n)


def _improper_canonical(num: int, den: int) -> str:
    """既約仮分数のプレーン表記（`a/b`、負号は分子側）。"""
    n, d = shp.reduce_fraction(num, den)
    if d == 1:
        return _integer_canonical(n)
    return f"{n}/{d}"


def _mixed_canonical(num: int, den: int) -> str | None:
    """帯分数のプレーン表記（`c a/b`）。

    真分数（|num| < |den|）または整数のときは None を返す。
    """
    n, d = shp.reduce_fraction(num, den)
    if d == 1:
        return None
    if abs(n) < d:
        return None
    whole, rem, den2 = shp.improper_to_mixed(n, d)
    if rem == 0:
        return None
    sign = "-" if whole < 0 else ""
    return f"{sign}{abs(whole)} {rem}/{den2}"


# ---- 表記バリエーション展開 -----------------------------------------------

def _expand_minus_variants(s: str) -> List[str]:
    """マイナス記号のバリエーションを展開。

    生徒が書きうる代替記号は採点時に正規化で吸収するが、
    ここでも代表的なものを列挙して allowed に含めておく。
    """
    if "-" not in s:
        return [s]
    return [
        s,
        s.replace("-", "−"),  # U+2212
        s.replace("-", "ー"),  # U+30FC（OCR 揺れ対策）
    ]


def _expand_slash_variants(s: str) -> List[str]:
    """スラッシュの全角／半角を展開。"""
    if "/" not in s:
        return [s]
    return [s, s.replace("/", "／")]


def _expand_space_variants(s: str) -> List[str]:
    """空白の半角↔全角を展開。

    帯分数 `1 1/2` などで空白を**除去すると `11/2` と曖昧化**するため、
    除去バリアントは生成しない（半角↔全角のみ）。
    """
    if " " not in s:
        return [s]
    return [s, s.replace(" ", "\u3000")]


def _cross_expand(seeds: Iterable[str], expanders) -> List[str]:
    """seeds をエクスパンダで順次展開して重複排除。"""
    result: Set[str] = set(seeds)
    for fn in expanders:
        new_results: Set[str] = set()
        for s in result:
            for variant in fn(s):
                new_results.add(variant)
        result = new_results
    return sorted(result)


# ---- 公開 API：種類別に許容表記を返す -------------------------------------

def variants_for_integer(n: int) -> List[str]:
    """整数の許容表記。"""
    seed = _integer_canonical(n)
    return _cross_expand([seed], [_expand_minus_variants])


def variants_for_rational(value: sp.Rational) -> List[str]:
    """有理数（既約後の値）の許容表記。

    生成内容:
      - 仮分数（既約）
      - 帯分数（仮分数が真分数でない場合のみ）
      - 有限小数（表せる場合のみ）
      - それぞれにマイナス／スラッシュ／空白のバリエーション
    """
    r = sp.Rational(value)
    n, d = r.p, r.q
    if d == 1:
        return variants_for_integer(n)

    seeds: Set[str] = set()
    seeds.add(_improper_canonical(n, d))

    mixed = _mixed_canonical(n, d)
    if mixed is not None:
        seeds.add(mixed)

    if shp.is_finite_decimal(r):
        seeds.add(shp.rational_to_decimal_str(r))

    return _cross_expand(
        seeds,
        [_expand_minus_variants, _expand_slash_variants, _expand_space_variants],
    )


def canonical_for_rational(value: sp.Rational) -> str:
    """answerCanonical 用の標準表記（仮分数 or 整数）。"""
    r = sp.Rational(value)
    if r.q == 1:
        return _integer_canonical(r.p)
    return _improper_canonical(r.p, r.q)


def canonical_decimal_for_rational(value: sp.Rational) -> str:
    """小数文脈（19/18/17級）用の canonical：有限小数があれば優先、なければ仮分数。"""
    r = sp.Rational(value)
    if r.q == 1:
        return _integer_canonical(r.p)
    if shp.is_finite_decimal(r):
        return shp.rational_to_decimal_str(r)
    return _improper_canonical(r.p, r.q)


def variants_for_decimal_answer(value: sp.Rational) -> List[str]:
    """小数文脈の答えの許容表記。

    canonical = 有限小数優先、allowed には小数 + 既約分数（仮分数 / 帯分数）の両方。
    19/18/17 級の答えは原則すべて有限小数になる前提。
    """
    r = sp.Rational(value)
    n, d = r.p, r.q
    if d == 1:
        return variants_for_integer(n)

    seeds: Set[str] = set()
    if shp.is_finite_decimal(r):
        seeds.add(shp.rational_to_decimal_str(r))
    seeds.add(_improper_canonical(n, d))
    mixed = _mixed_canonical(n, d)
    if mixed is not None:
        seeds.add(mixed)
    return _cross_expand(
        seeds,
        [_expand_minus_variants, _expand_slash_variants, _expand_space_variants],
    )


# ---- 多項式（9級）用：シンプルな variants ---------------------------------

def variants_for_xy_solution(x_val: sp.Rational, y_val: sp.Rational) -> List[str]:
    """6級（連立方程式）用の解の許容表記。

    canonical: ``x = 3, y = 2`` の形式（既約分数 / 整数を ``canonical_for_rational`` で得る）。
    展開：等号前後の空白あり/なし、カンマ前後の空白あり/なし、スラッシュ全/半角、マイナス全/半角。
    """
    x_str = canonical_for_rational(x_val)
    y_str = canonical_for_rational(y_val)
    canonical = f"x = {x_str}, y = {y_str}"
    seeds: Set[str] = {canonical}
    # 等号前後の空白除去
    seeds.add(canonical.replace(" = ", "="))
    # カンマ後の空白除去
    seeds.add(canonical.replace(", ", ","))
    seeds.add(canonical.replace(" = ", "=").replace(", ", ","))
    return _cross_expand(
        sorted(seeds),
        [_expand_minus_variants, _expand_slash_variants],
    )


def canonical_for_xy_solution(x_val: sp.Rational, y_val: sp.Rational) -> str:
    """連立方程式の解の標準表記："x = a, y = b"。"""
    return f"x = {canonical_for_rational(x_val)}, y = {canonical_for_rational(y_val)}"


# ---- 方程式（x= 形）用：rank1 二次 / rank8 一次 --------------------------
# 2026-07-03：一次(rank8)・二次(rank1) を x= 必須ルールに統一（連立に倣うデータ駆動）。
#   採点側 _kisoNormalize は「= 前後の空白」を保持する（連続空白の圧縮のみ）ため、
#   "x=5" / "x =5" / "x= 5" / "x = 5" の 4 形を allowed に明示的に含める必要がある。
#   ★ x= 必須：素の数値（"5" 等）は allowed に一切含めない → x= なしは不正解になる。

_X_EQ_SPACINGS = ("x=", "x =", "x= ", "x = ")


def _x_prefix_expand(bodies: Iterable[str]) -> List[str]:
    """右辺本体の集合に "x=" の空白ゆらぎ 4 種を付与し、マイナス/スラッシュ揺れを展開。"""
    seeds: Set[str] = set()
    for b in bodies:
        for pref in _X_EQ_SPACINGS:
            seeds.add(pref + b)
    return _cross_expand(sorted(seeds), [_expand_minus_variants, _expand_slash_variants])


def variants_for_x_single(x_val: sp.Rational) -> Tuple[str, List[str]]:
    """一次方程式（rank8）：単一解を "x=..." 形（x= 必須、素の数値は含めない）。

    canonical = "x=<既約>"（例 "x=5"、"x=3/2"）。
    allowed = 分数/帯分数/小数の各表記 × "x=" の空白ゆらぎ × 記号ゆらぎ。
    """
    r = sp.Rational(x_val)
    canonical = "x=" + canonical_for_rational(r)
    bodies = set(variants_for_rational(r))
    allowed = _x_prefix_expand(bodies)
    return canonical, allowed


def variants_for_x_roots(
    tokens: List[str],
    canonical_body: str | None = None,
    extra_bodies: Iterable[str] | None = None,
) -> Tuple[str, List[str]]:
    """二次方程式（rank1）：複数解を "x=(1回) t1, t2" 形（順序非依存・x= 必須）。

    tokens: 解トークンのリスト（例 ["3", "5"]、["-√5", "√5"]、["3"]=重解/単一）。
    canonical_body: canonical の本体を明示（例 "±3"、"±√5"）。None なら ", ".join(tokens)。
    extra_bodies: 追加で許容する本体（例 ± 形 "±3" を comma 形と併存させる）。

    ★ "x=t1, x=t2"（各解に x を付ける形）は生成しない（要件により却下）。
    ★ 2 解の順序は permutations で両方許容（順序非依存）。
    """
    from itertools import permutations

    bodies: Set[str] = set()
    for perm in set(permutations(tokens)):
        for sep in (", ", ","):
            bodies.add(sep.join(perm))
    if extra_bodies:
        bodies.update(extra_bodies)
    body_for_canonical = canonical_body if canonical_body is not None else ", ".join(tokens)
    bodies.add(body_for_canonical)
    canonical = "x=" + body_for_canonical
    allowed = _x_prefix_expand(bodies)
    return canonical, allowed


def variants_for_factored_pair(canonical: str) -> List[str]:
    """因数分解の答え `(f1)(f2)` 形式の許容バリエーション（rank_03 Band B / Band C diff_squares 用）。

    canonical 例：``(x - 5)(x + 2)``、``(x + 4)(x + 6)``、``(x + 10)(x - 10)``。
    `factored_pair_latex(m, n)` の出力（必ず `(x ± a)(x ± b)` 形）を前提とする。

    Phase 1 から Phase 2 Wave 2 まで、`canonical` は `sorted([m, n])` で数値昇順固定だったため、
    生徒が教科書的慣習（正の項を先に書く、絶対値小さい順）で書いた答えが不正解判定される
    バグが発生していた（例：canonical `(x - 5)(x + 8)` ⇔ 生徒 `(x + 8)(x - 5)`）。
    本関数は `(f1)(f2)` ⇔ `(f2)(f1)` の入替バリエーションを機械的に追加し、
    さらに既存の表記揺れ（空白なし、マイナス各種記号）展開を適用する。

    対象：
      - rank_03 Band B (trinomial_simple): (x + m)(x + n) 形
      - rank_03 Band C diff_squares: (x + a)(x - a) 形

    対象外（呼び出し側で別関数を使う）：
      - rank_03 Band C perfect_square_pos/neg: (x ± a)² 単一因子なので順序問題なし
      - rank_03 Band A common_factor: a(bx + cy) 形（外側因子 × 内側多項式の構造、本関数の対象外）

    重複排除の最終結果を sorted 順で返す。
    """
    import re

    # `(x ± a)(x ± b)` を 2 つの因子 `(x ± a)` と `(x ± b)` に厳密分解。
    # factored_pair_latex の出力仕様：内側は `var` / `var + k` / `var - |k|` のいずれか。
    pattern = re.compile(r"^\(([^()]+)\)\(([^()]+)\)$")
    m = pattern.match(canonical)
    if not m:
        # 想定外の形式：従来の variants_for_polynomial にフォールバック（安全側）
        return variants_for_polynomial(canonical)

    f1, f2 = m.group(1), m.group(2)
    # canonical 順 + 入替順の 2 形を基底にする
    # 同一因子（理論的には起こらない、`_gen_trinomial_simple` は m != n を強制）でも
    # set による重複排除で `(x + a)(x + a)` のみとして扱う
    seeds: Set[str] = {f"({f1})({f2})", f"({f2})({f1})"}

    # 各 seed に既存の表記揺れ展開（空白なし、マイナス variant）を適用
    # 空白なし：`(x - 5)(x + 2)` → `(x-5)(x+2)`
    no_space_seeds: Set[str] = set()
    for s in seeds:
        no_space_seeds.add(s)
        no_space_seeds.add(s.replace(" + ", "+").replace(" - ", "-"))

    # マイナス記号 variant（U+2212、U+30FC）：`(x - 5)` → `(x − 5)` / `(x ー 5)`
    return _cross_expand(sorted(no_space_seeds), [_expand_minus_variants])


def variants_for_polynomial(canonical: str) -> List[str]:
    """多項式の許容表記（9級用）。

    canonical 例：``5x``、``2x + 6``、``-3x - 4``、``\\frac{2}{3}x``。
    展開する variants：
      - 演算子前後の空白あり／なし／全角空白
      - マイナス全/半角
    分数係数 `\\frac{a}{b}x` の場合 `a/b x` 形式の代替は OCR 揺れ対策で許容。
    係数が分数の場合の既約性は呼び出し側で保証する前提（§6.4.0）。
    """
    seeds: Set[str] = set()
    seeds.add(canonical)
    # 演算子前後の空白なし版
    no_sp = canonical.replace(" + ", "+").replace(" - ", "-")
    seeds.add(no_sp)
    # \frac{a}{b}x → a/b x の表記（分数係数）
    import re

    frac_pat = re.compile(r"\\frac\{(-?\d+)\}\{(\d+)\}")
    for s in list(seeds):
        if "\\frac" in s:
            seeds.add(frac_pat.sub(r"\1/\2 ", s))
            seeds.add(frac_pat.sub(r"\1/\2", s))
    return _cross_expand(
        sorted(seeds),
        [_expand_minus_variants],
    )
