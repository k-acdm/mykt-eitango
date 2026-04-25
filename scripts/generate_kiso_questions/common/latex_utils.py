r"""SymPy → LaTeX 変換と表示形式の統一（仕様書 §6.4.1）。

MathJax で表示することを前提に、表記を統一する。
- 分数：\frac{a}{b}（\dfrac ではない）
- 乗算：\times
- 除算：\div（問題側で必要なときのみ。解答側は通常分数化）
- 累乗：x^{2}、(-3)^{2}（負数は括弧付き）
- 平方根：\sqrt{8}
"""

from __future__ import annotations

from typing import Iterable, List

import sympy as sp

from . import sympy_helpers as shp


def int_term(n: int, leading: bool = False) -> str:
    """整数項を式中の文字列に変換。

    leading=True なら先頭項なので符号は - のみ表記、+ は省略。
    leading=False なら 2 項目以降なので、+/- を区切りとして外で扱うことを想定し、
    返値は絶対値の整数（呼び出し側で符号と結合）。
    """
    if leading:
        return f"-{abs(n)}" if n < 0 else f"{n}"
    return f"{abs(n)}"


def frac_latex(num: int, den: int) -> str:
    """既約分数を LaTeX に。負号は分子に。整数の場合は数字のみ。"""
    n, d = shp.reduce_fraction(num, den)
    if d == 1:
        return f"{n}"
    if n < 0:
        return f"-\\frac{{{abs(n)}}}{{{d}}}"
    return f"\\frac{{{n}}}{{{d}}}"


def frac_latex_no_sign(num: int, den: int) -> str:
    """符号なしの既約分数 LaTeX。呼び出し側で符号を付ける用途。"""
    n, d = shp.reduce_fraction(abs(num), abs(den))
    if d == 1:
        return f"{n}"
    return f"\\frac{{{n}}}{{{d}}}"


def frac_latex_raw(num: int, den: int) -> str:
    r"""**約分せずに**そのまま `\frac{num}{den}` を返す（問題式の表示用）。

    問題に書かれている分数の形を保ちたい場合に使う。`frac_latex` / `frac_latex_no_sign`
    は答え側など「既約形を出したい」場合に使う。

    ⚠️ **設計原則**：問題式の分数は紙教材準拠で常に既約形でなければならない
    （band_config.py 冒頭の設計原則を参照）。本関数は与えられた (num, den) を
    そのまま表示するだけで、既約性は呼び出し側の責任。生成側は
    ``common.sympy_helpers.pick_coprime_numerator`` で分子を選び、検証側は
    ``assert_problem_fractions_in_lowest_terms`` で self_check する。
    """
    if den == 1:
        return f"{num}"
    if num < 0:
        return f"-\\frac{{{abs(num)}}}{{{den}}}"
    return f"\\frac{{{num}}}{{{den}}}"


def mixed_frac_latex(whole: int, num: int, den: int) -> str:
    """帯分数 c\\frac{a}{b} の LaTeX。num=0 なら整数。"""
    if num == 0:
        return f"{whole}"
    if whole == 0:
        if num < 0:
            return f"-\\frac{{{abs(num)}}}{{{den}}}"
        return f"\\frac{{{num}}}{{{den}}}"
    sign = "-" if whole < 0 else ""
    return f"{sign}{abs(whole)}\\frac{{{num}}}{{{den}}}"


def join_terms(terms: List[str], ops: List[str]) -> str:
    """項リストと演算子リストを結合。

    terms[0] op[0] terms[1] op[1] terms[2] ... の形式で結合する。
    terms[0] のみ符号付きとして扱い、他項は ops 側で +/- が表現される前提。
    """
    if len(terms) != len(ops) + 1:
        raise ValueError("terms と ops の長さが整合しない")
    parts = [terms[0]]
    for op, t in zip(ops, terms[1:]):
        parts.append(op)
        parts.append(t)
    return " ".join(parts)


# 演算子の LaTeX 表記
OP_LATEX = {
    "+": "+",
    "-": "-",
    "*": "\\times",
    "/": "\\div",
}


def decimal_latex(value) -> str:
    """有限小数の Rational / int / float / 文字列を LaTeX 数値文字列に。

    整数なら "12"、小数なら "1.5" のように返す。`\\frac` は使わない。
    無限小数は `ValueError`。
    """
    r = shp.to_rational(value)
    if r.q == 1:
        return str(r.p)
    if not shp.is_finite_decimal(r):
        raise ValueError(f"decimal_latex: {value} は有限小数ではない")
    return shp.rational_to_decimal_str(r)


def signed_int_latex_paren(n: int) -> str:
    """正負の数を括弧付きで表示（13級 Band A 用）：(+9) / (-5)。"""
    if n >= 0:
        return f"(+{n})"
    return f"(-{abs(n)})"


def signed_int_latex_leading(n: int) -> str:
    """先頭項として正負の数を括弧なしで表示：9 / -5（先頭の + は省略）。"""
    if n >= 0:
        return f"{n}"
    return f"-{abs(n)}"


def power_latex(base_str: str, exp: int, base_is_signed: bool = False) -> str:
    """累乗の LaTeX。負数や符号付きが base のときは外側を括弧で包む。

    例：power_latex("3", 2) → "3^{2}"、power_latex("-3", 2, True) → "(-3)^{2}"
    """
    if base_is_signed:
        return f"({base_str})^{{{exp}}}"
    return f"{base_str}^{{{exp}}}"


def paren_expr_latex(s: str) -> str:
    r"""式を `\left(...\right)` で包む（17級・11級の括弧用）。"""
    return f"\\left({s}\\right)"
