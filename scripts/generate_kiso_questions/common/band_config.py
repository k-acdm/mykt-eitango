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
    # 16級：分数加減
    16: {
        # same_denom: 同分母 / mixed_denom: 異分母 / terms: 項数 / allow_mixed: 帯分数を許可
        "A": {"count": 10, "same_denom": True,  "terms": 2, "allow_mixed": False, "denom_max": 10},
        "B": {"count": 10, "same_denom": False, "terms": 2, "allow_mixed": False, "denom_max": 12},
        "C": {"count": 10, "same_denom": False, "terms": 2, "allow_mixed": False, "denom_max": 15},
        # D〜H で帯分数・3項・小数混在を導入予定
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
