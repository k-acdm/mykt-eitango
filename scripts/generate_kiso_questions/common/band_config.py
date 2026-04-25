"""各級の A〜H バンドごとの生成計画（仕様書 §6.4.4）。

Phase 1 はプロトタイプのため A/B/C 各 10 問のみ。Phase 2 以降で
紙教材画像（A〜H 全 8 セット）を参照して残り D〜H と count を埋める。

各バンドの設定は dict で持つ。キーの意味は級ごとに違うため、
各 `rank_XX_*.py` 側で BAND_PLAN[<rank>][<band>] を解釈する。
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
