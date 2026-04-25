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

from typing import Iterable, List, Set

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
