"""SymPy 計算ヘルパー（仕様書 §6.4.2）。"""

from __future__ import annotations

from math import gcd
from typing import Tuple

import sympy as sp


def to_rational(value) -> sp.Rational:
    if isinstance(value, sp.Rational):
        return value
    if isinstance(value, int):
        return sp.Rational(value, 1)
    if isinstance(value, float):
        return sp.nsimplify(value, rational=True)
    if isinstance(value, str):
        return sp.Rational(value)
    raise TypeError(f"to_rational: unsupported type {type(value)}")


def is_integer_ratio(frac: sp.Rational) -> bool:
    return sp.Rational(frac).q == 1


def reduce_fraction(num: int, den: int) -> Tuple[int, int]:
    if den == 0:
        raise ZeroDivisionError("denominator must not be zero")
    if den < 0:
        num, den = -num, -den
    g = gcd(abs(num), abs(den))
    if g == 0:
        return 0, 1
    return num // g, den // g


def improper_to_mixed(num: int, den: int) -> Tuple[int, int, int]:
    """仮分数 (num/den) を帯分数 (whole, n, d) に変換。

    分子の絶対値が分母より小さい場合は whole=0 を返す。
    符号は whole 側に持たせ、(n, d) は常に非負・既約。
    """
    if den == 0:
        raise ZeroDivisionError
    n, d = reduce_fraction(num, den)
    sign = -1 if n < 0 else 1
    n_abs = abs(n)
    whole = sign * (n_abs // d)
    rem = n_abs - (n_abs // d) * d
    return whole, rem, d


def mixed_to_improper(whole: int, num: int, den: int) -> Tuple[int, int]:
    if den == 0:
        raise ZeroDivisionError
    sign = -1 if whole < 0 else 1
    total = abs(whole) * den + num
    return sign * total, den


def sqrt_simplify(expr) -> sp.Expr:
    """平方根を含む式を最簡形に正規化。"""
    return sp.sqrtdenest(sp.radsimp(sp.simplify(expr)))


def expand_and_simplify(expr) -> sp.Expr:
    return sp.simplify(sp.expand(expr))


def is_finite_decimal(rational: sp.Rational) -> bool:
    """有理数が有限小数で表せるか（既約後の分母が 2^a * 5^b の形）。"""
    r = sp.Rational(rational)
    d = r.q
    while d % 2 == 0:
        d //= 2
    while d % 5 == 0:
        d //= 5
    return d == 1


def rational_to_decimal_str(rational: sp.Rational) -> str:
    """有限小数として表せる Rational を `0.5` のような文字列にする。"""
    r = sp.Rational(rational)
    if not is_finite_decimal(r):
        raise ValueError("not a finite decimal")
    # 必要桁数だけ表示し、末尾の 0 と不要な小数点を落とす。
    # 分母の素因数 2^a * 5^b の max(a,b) が必要桁数。
    d = r.q
    a = b = 0
    while d % 2 == 0:
        d //= 2
        a += 1
    while d % 5 == 0:
        d //= 5
        b += 1
    digits = max(a, b)
    if digits == 0:
        return str(r.p)
    s = sp.Rational(r).evalf(50, chop=True)
    # evalf は丸め誤差なく表現できるため、固定小数点フォーマットに変換。
    sign = "-" if r < 0 else ""
    n_abs = abs(r.p)
    d_abs = r.q
    scaled = n_abs * (10 ** digits) // d_abs
    int_part = scaled // (10 ** digits)
    frac_part = scaled - int_part * (10 ** digits)
    frac_str = str(frac_part).zfill(digits).rstrip("0")
    if frac_str == "":
        return f"{sign}{int_part}"
    return f"{sign}{int_part}.{frac_str}"
