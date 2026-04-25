"""各級の A〜H バンドごとの生成計画（仕様書 §6.4.4）。

Phase 1 はプロトタイプのため A/B/C 各 10 問のみ。Phase 2 以降で
紙教材画像（A〜H 全 8 セット）を参照して残り D〜H と count を埋める。

各バンドの設定は dict で持つ。キーの意味は級ごとに違うため、
各 `rank_XX_*.py` 側で BAND_PLAN[<rank>][<band>] を解釈する。

============================================================================
**全級共通の設計原則：問題式の分数は常に既約形**（紙教材準拠）
============================================================================
問題式に登場する各分数は、必ず GCD(分子, 分母) == 1 でなければならない。
- ✅ OK: ``5/6 - 2/3``、``3/8 + 1/4``
- ❌ NG: ``4/6 - 3/6``（4/6 は GCD=2）、``6/9 + 2/9``

これは 16 級（分数加減）に限らず、15 級（分数乗除）、14 級（分数四則混合）、
12 級以降の累乗・分数混在まで**全ての級で適用**される設計原則。

実装上の保証は二段構え：
  1. 生成側：``common.sympy_helpers.pick_coprime_numerator`` で分子を選ぶ
  2. 検証側：``common.sympy_helpers.assert_problem_fractions_in_lowest_terms``
     を各級の ``self_check`` から呼ぶ（rank_20 のように分数を含まない級でも
     no-op として呼んでおき、将来の表示形式変更を自動検知する）

なお**答え側**の既約性・簡約性は別系統の責務（仕様書 §6.8 決定 2/3）で、
``common.answer_variants.canonical_for_rational`` が保証する。
"""

from __future__ import annotations

from typing import Any, Dict


BAND_PLAN: Dict[int, Dict[str, Dict[str, Any]]] = {
    # 20級：整数四則混合
    20: {
        "A": {"count": 10, "digits": 1, "terms": 2, "ops": ["+", "-"], "parens": False},
        "B": {"count": 10, "digits": 1, "terms": 2, "ops": ["*", "/"], "parens": False},
        "C": {"count": 10, "digits": 2, "terms": 3, "ops": ["+", "-", "*", "/"], "parens": False},
        # D〜H は Phase 2 で追加
    },
    # 19級：小数 加減
    19: {
        # int_max: 整数部最大、decimals: 小数桁数（A/B は同位取り、C は混在）
        "A": {"count": 10, "int_max": 9, "decimals": 1, "terms": 2},
        "B": {"count": 10, "int_max": 9, "decimals": 2, "terms": 2},
        # C: 桁違い（整数 vs 小数、または 1 桁 vs 3 桁の小数）
        "C": {"count": 10, "int_max": 9, "decimals_options": [(0, 3), (3, 0), (1, 3), (2, 1)], "terms": 2},
    },
    # 18級：小数 乗除
    18: {
        # A: 整数 × 小数 / B: 小数 × 小数（割り切れる積） / C: 桁数大きめ
        "A": {"count": 10, "kind": "int_x_dec", "int_max": 9, "decimals": 1},
        "B": {"count": 10, "kind": "dec_x_dec", "int_max": 5, "decimals": 1},
        "C": {"count": 10, "kind": "dec_x_dec", "int_max": 9, "decimals": 1},
    },
    # 17級：小数 四則混合
    17: {
        "A": {"count": 10, "terms": 2, "ops": ["+", "-", "*", "/"], "parens": False, "int_max": 5, "decimals": 1},
        "B": {"count": 10, "terms": 3, "ops": ["+", "-", "*", "/"], "parens": False, "int_max": 5, "decimals": 1},
        "C": {"count": 10, "terms": 3, "ops": ["+", "-", "*", "/"], "parens": True,  "int_max": 5, "decimals": 1},
    },
    # 16級：分数加減
    16: {
        # same_denom: 同分母 / mixed_denom: 異分母 / terms: 項数 / allow_mixed: 帯分数を許可
        "A": {"count": 10, "same_denom": True,  "terms": 2, "allow_mixed": False, "denom_max": 10},
        "B": {"count": 10, "same_denom": False, "terms": 2, "allow_mixed": False, "denom_max": 12},
        "C": {"count": 10, "same_denom": False, "terms": 2, "allow_mixed": False, "denom_max": 15},
        # D〜H で帯分数・3項・小数混在を導入予定
    },
    # 13級：正負の数 加減
    13: {
        # A: 括弧付き（+9）+（+5）/ B: 括弧付き（混合符号）/ C: 括弧なし
        "A": {"count": 10, "kind": "paren", "max_abs": 9, "terms": 2, "same_sign_only": True},
        "B": {"count": 10, "kind": "paren", "max_abs": 9, "terms": 2, "same_sign_only": False},
        "C": {"count": 10, "kind": "noparen", "max_abs": 99, "terms": 2, "same_sign_only": False},
    },
    # 12級：正負の数 乗除
    12: {
        # A: 1桁 2項 ×/÷ / B: 累乗込み / C: 3項 ×/÷
        "A": {"count": 10, "kind": "muldiv", "max_abs": 9, "terms": 2, "powers": False},
        "B": {"count": 10, "kind": "powers", "max_abs": 5, "exp_max": 3},
        "C": {"count": 10, "kind": "muldiv", "max_abs": 9, "terms": 3, "powers": False},
    },
    # 11級：正負の数 四則混合（最難関級）
    11: {
        # A: 2項 四則混合（括弧付き符号） / B: 累乗を含む 2 項 / C: 3項 + 括弧 + 累乗
        "A": {"count": 10, "kind": "two_term_mixed", "max_abs": 9},
        "B": {"count": 10, "kind": "with_power",     "max_abs": 5, "exp_max": 3},
        "C": {"count": 10, "kind": "three_term_paren_power", "max_abs": 5, "exp_max": 2},
    },
    # 9級：式の計算 中1
    9: {
        # A: 同類項 / B: 分配法則 / C: 単項式の乗除
        "A": {"count": 10, "kind": "like_terms", "terms": 2, "coef_max": 9},
        "B": {"count": 10, "kind": "distribute", "coef_max": 5, "const_max": 5},
        "C": {"count": 10, "kind": "monomial_muldiv", "coef_max": 6},
    },
}


def get_band(rank: int, band: str) -> Dict[str, Any]:
    if rank not in BAND_PLAN:
        raise KeyError(f"rank {rank} の BAND_PLAN が未定義")
    if band not in BAND_PLAN[rank]:
        raise KeyError(f"rank {rank} の band {band} が未定義")
    return BAND_PLAN[rank][band]


def list_bands(rank: int):
    return sorted(BAND_PLAN.get(rank, {}).keys())
