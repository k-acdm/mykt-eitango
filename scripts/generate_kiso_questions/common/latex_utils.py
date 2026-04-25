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
