"""基礎計算 問題生成ドライバ（仕様書 §6.6）。

使い方:
    python main.py                 # 実装済みの全級を生成
    python main.py --ranks 20      # 20 級のみ
    python main.py --ranks 20,16   # 20 と 16 級
    python main.py --seed 42       # 乱数シード（既定 42、再現性確保）
    python main.py --out out.json  # JSON 出力先（既定 out/問題_<rank>.json）

Phase 1 はスプレッドシート書き込み未実装。JSON にダンプしてセルフチェック結果のみ
コンソールに出す。
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import random
import sys
import time
from typing import Any, Dict, List

from common.band_config import BAND_PLAN, list_bands


# 級番号 → モジュール名
RANK_MODULES: Dict[int, str] = {
    20: "rank_20_integer_mixed",
    16: "rank_16_fraction_addsub",
}


def parse_args(argv: List[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="基礎計算 問題生成スクリプト")
    p.add_argument(
        "--ranks",
        default=",".join(str(r) for r in sorted(RANK_MODULES.keys(), reverse=True)),
        help="生成する級（カンマ区切り）。例: 20,16",
    )
    p.add_argument("--seed", type=int, default=42, help="乱数シード（再現性確保）")
    p.add_argument(
        "--out-dir",
        default="out",
        help="JSON 出力先ディレクトリ",
    )
    return p.parse_args(argv)


def generate_for_rank(rank: int, seed: int) -> Dict[str, Any]:
    if rank not in RANK_MODULES:
        raise KeyError(f"rank {rank} は未実装")
    if rank not in BAND_PLAN:
        raise KeyError(f"rank {rank} の BAND_PLAN が未定義")

    mod = importlib.import_module(RANK_MODULES[rank])
    rng = random.Random(seed + rank)  # 級ごとに独立した RNG
    bands = list_bands(rank)

    out_problems: List[Dict[str, Any]] = []
    failed_self_check = 0
    t0 = time.time()
    for band in bands:
        cfg = BAND_PLAN[rank][band]
        count = cfg["count"]
        for _ in range(count):
            problem = mod.generate_problem(band, rng)
            ok = mod.self_check(problem)
            if not ok:
                failed_self_check += 1
            out_problems.append(
                {
                    "rank": rank,
                    "band": band,
                    "problemLatex": problem["problemLatex"],
                    "answerCanonical": problem["answerCanonical"],
                    "answerAllowed": problem["answerAllowed"],
                }
            )
    elapsed = time.time() - t0
    return {
        "rank": rank,
        "bands": bands,
        "count": len(out_problems),
        "failed_self_check": failed_self_check,
        "elapsed_sec": round(elapsed, 3),
        "problems": out_problems,
    }


def write_json(out_dir: str, rank: int, payload: Dict[str, Any]) -> str:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"questions_rank_{rank:02d}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return path


def print_summary(payload: Dict[str, Any]) -> None:
    rank = payload["rank"]
    print(f"=== rank {rank} ===")
    print(f"  bands           : {payload['bands']}")
    print(f"  total problems  : {payload['count']}")
    print(f"  failed selfcheck: {payload['failed_self_check']}")
    print(f"  elapsed         : {payload['elapsed_sec']} sec")
    # サンプル 3 問だけ表示
    for sample in payload["problems"][:3]:
        print(
            f"    [{sample['band']}] {sample['problemLatex']}  =  {sample['answerCanonical']}"
        )
    print()


def main(argv: List[str]) -> int:
    args = parse_args(argv)
    ranks = [int(r.strip()) for r in args.ranks.split(",") if r.strip()]
    overall_failed = 0
    for rank in ranks:
        payload = generate_for_rank(rank, args.seed)
        path = write_json(args.out_dir, rank, payload)
        print_summary(payload)
        print(f"  -> wrote {path}")
        overall_failed += payload["failed_self_check"]
    if overall_failed:
        print(f"\n[ERROR] selfcheck 失敗が {overall_failed} 件あります", file=sys.stderr)
        return 1
    print("\nAll selfchecks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
