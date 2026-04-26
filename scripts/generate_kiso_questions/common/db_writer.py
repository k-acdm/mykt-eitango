"""KisoQuestions シートへの一括書き込みヘルパー（仕様書 §3.1, §6.6）。

役割
====
``main.py`` が rank 別 JSON を ``out/`` に出力した後、その JSON を読み込んで
スプレッドシートの ``KisoQuestions`` シートに一括投入する。GAS 側の
``ensureKisoSheets()`` が事前に呼ばれて 8 列ヘッダーが整っている前提。

認証方式
=========
Google Cloud の **Service Account** JSON を使う。手元の環境変数 or
コマンドライン引数で credentials JSON のパスを指定。サービスアカウントの
メールアドレスを対象スプレッドシートの「編集者」として共有しておく。

* 環境変数: ``KISO_GSPREAD_CREDENTIALS`` … 認証 JSON のパス
* 環境変数: ``KISO_SPREADSHEET_ID``      … スプレッドシートの ID

書き込み戦略
=============
* シート上の既存データはヘッダー行のみ残して全削除（`clear()` ではなく
  2 行目以降を ``delete_rows``）
* 全 600 問（Phase 1+2 完了状態）を ``rank ASC, band ASC, generated index ASC``
  で並べた DataFrame として一気に ``update`` 呼び出し
* gspread の API quota（write 60 / minute）に配慮して 1 回の呼び出しで全件投入

questionId の付番ルール
=========================
JSON には rank/band/問題 LaTeX しか入っていないため、
``q_{rank}_{連番6桁}`` の連番を db_writer 側で **書き込み時に確定** させる。

* rank 単位で 1 から振り、band 順 → 生成順 を保つ
* 例: rank=20, band=A の 1 問目 → ``q_20_000001``
* 同じ rank の B/C は連番を継続（A 終了時点が 010、B は 011〜020、…）

CLI
====

::

    python -m common.db_writer \\
        --json-dir out/ \\
        --credentials path/to/service_account.json \\
        --spreadsheet-id <ID> \\
        --ranks 1,2,3,...,20

実行例：

* ``python -m common.db_writer``                     # 全 JSON を投入
* ``python -m common.db_writer --ranks 20,16``       # 特定 rank のみ
* ``python -m common.db_writer --dry-run``           # 投入せずに行数だけ表示
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Iterable, List, Optional

# Phase 1+2 で確定済みの rank 名（仕様書 §6.5 のテーブルと一致）
RANK_NAMES: Dict[int, str] = {
    20: "整数四則混合",
    19: "小数加減",
    18: "小数乗除",
    17: "小数四則混合",
    16: "分数加減",
    15: "分数乗除",
    14: "分数四則混合",
    13: "正負の数 加減",
    12: "正負の数 乗除",
    11: "正負の数 四則混合",
    10: "単位・比・割合",
    9:  "式の計算・中1",
    8:  "一次方程式・比例式",
    7:  "式の計算・中2",
    6:  "連立方程式",
    5:  "式の計算・中3",
    4:  "乗法公式",
    3:  "因数分解",
    2:  "平方根",
    1:  "二次方程式",
}

KISO_QUESTIONS_HEADERS = [
    "questionId",
    "rank",
    "rankName",
    "difficultyBand",
    "problemLatex",
    "answerCanonical",
    "answerAllowed",
    "generatedAt",
]


def _jst_now_iso() -> str:
    jst = timezone(timedelta(hours=9))
    return datetime.now(jst).isoformat(timespec="seconds")


def load_rank_payload(json_dir: str, rank: int) -> Dict[str, Any]:
    """``out/questions_rank_XX.json`` を読み込む。"""
    path = os.path.join(json_dir, f"questions_rank_{rank:02d}.json")
    if not os.path.exists(path):
        raise FileNotFoundError(f"rank {rank} の JSON が見つかりません: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_rows_for_rank(payload: Dict[str, Any], generated_at: str) -> List[List[Any]]:
    """1 つの rank ペイロードから KisoQuestions の行データを組み立てる。"""
    rank = int(payload["rank"])
    rank_name = RANK_NAMES.get(rank, f"rank {rank}")
    rows: List[List[Any]] = []
    for idx, prob in enumerate(payload["problems"], start=1):
        question_id = f"q_{rank:02d}_{idx:06d}"
        rows.append([
            question_id,
            rank,
            rank_name,
            prob["band"],
            prob["problemLatex"],
            prob["answerCanonical"],
            json.dumps(prob["answerAllowed"], ensure_ascii=False),
            generated_at,
        ])
    return rows


def collect_all_rows(json_dir: str, ranks: Iterable[int]) -> List[List[Any]]:
    """指定 rank すべてを KisoQuestions 1 シートに展開する行データに集約。"""
    generated_at = _jst_now_iso()
    all_rows: List[List[Any]] = []
    for rank in ranks:
        payload = load_rank_payload(json_dir, rank)
        all_rows.extend(build_rows_for_rank(payload, generated_at))
    return all_rows


def open_kiso_sheet(credentials_path: str, spreadsheet_id: str):
    """gspread でスプレッドシートを開いて KisoQuestions シートを返す。"""
    # 遅延 import: db_writer をインポートしただけで gspread が必要にならないように
    import gspread
    from google.oauth2.service_account import Credentials

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_file(credentials_path, scopes=scopes)
    client = gspread.authorize(creds)
    sh = client.open_by_key(spreadsheet_id)
    try:
        ws = sh.worksheet("KisoQuestions")
    except gspread.WorksheetNotFound:
        # フォールバック: シート未作成時は新規作成 + ヘッダー設定
        # 通常は GAS 側 ensureKisoSheets() で先に作っておくほうが安全
        ws = sh.add_worksheet(title="KisoQuestions", rows="1", cols=str(len(KISO_QUESTIONS_HEADERS)))
        ws.append_row(KISO_QUESTIONS_HEADERS, value_input_option="RAW")
    return ws


def write_to_sheet(ws, rows: List[List[Any]], replace_all: bool = True) -> None:
    """KisoQuestions に一括書き込み。

    replace_all=True: ヘッダーを残してデータ行を削除してから書き込み（再投入時の冪等性）
    replace_all=False: 末尾追記（同じ rank を 2 度入れるとデータ重複なので注意）
    """
    # ヘッダーがあるか軽く確認
    header = ws.row_values(1)
    if not header or header[0] != "questionId":
        ws.update("A1", [KISO_QUESTIONS_HEADERS])

    if replace_all:
        last_row = ws.row_count
        if last_row > 1:
            # 2 行目以降を削除（ヘッダーは残す）
            ws.delete_rows(2, last_row)

    if not rows:
        return

    # 一括 update（A2 から len(rows) 行 × 8 列）
    last_col_letter = chr(ord("A") + len(KISO_QUESTIONS_HEADERS) - 1)
    end_row = 1 + len(rows)
    range_str = f"A2:{last_col_letter}{end_row}"
    ws.update(range_str, rows, value_input_option="RAW")


def parse_args(argv: List[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="KisoQuestions シートへの一括書き込み"
    )
    p.add_argument(
        "--json-dir",
        default="out",
        help="rank 別 JSON のあるディレクトリ（既定: out）",
    )
    p.add_argument(
        "--ranks",
        default=",".join(str(r) for r in sorted(RANK_NAMES.keys(), reverse=True)),
        help="投入する rank（カンマ区切り、既定: 全 20 rank）",
    )
    p.add_argument(
        "--credentials",
        default=os.environ.get("KISO_GSPREAD_CREDENTIALS"),
        help="Google Service Account JSON のパス。"
             "省略時は環境変数 KISO_GSPREAD_CREDENTIALS を参照",
    )
    p.add_argument(
        "--spreadsheet-id",
        default=os.environ.get("KISO_SPREADSHEET_ID"),
        help="対象スプレッドシートの ID。"
             "省略時は環境変数 KISO_SPREADSHEET_ID を参照",
    )
    p.add_argument(
        "--append",
        action="store_true",
        help="既存データを残して末尾追記（既定はヘッダー以外を全消去してから書き込み）",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="シートに書き込まず、行数とサンプルを表示するだけ",
    )
    return p.parse_args(argv)


def _ensure_utf8_console() -> None:
    """Windows の cp932 コンソールでも日本語が読めるように stdout/stderr を UTF-8 へ。"""
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is not None and hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8")
            except Exception:
                pass


def main(argv: List[str]) -> int:
    _ensure_utf8_console()
    args = parse_args(argv)
    ranks = [int(r.strip()) for r in args.ranks.split(",") if r.strip()]

    rows = collect_all_rows(args.json_dir, ranks)
    print(f"集計完了: {len(rows)} 行（{len(ranks)} rank, {args.json_dir}/ から）")
    # rank 別の行数サマリ
    counts: Dict[int, int] = {}
    for r in rows:
        counts[int(r[1])] = counts.get(int(r[1]), 0) + 1
    for rk in sorted(counts.keys()):
        print(f"  rank {rk:2d} ({RANK_NAMES.get(rk, '?'):<14}): {counts[rk]} 行")

    if args.dry_run:
        print("\n[dry-run] スプレッドシートに書き込みません。先頭 3 行のサンプル:")
        for sample in rows[:3]:
            print("  " + " | ".join(str(c)[:60] for c in sample))
        return 0

    if not args.credentials:
        print(
            "[ERROR] credentials が未指定です。--credentials または "
            "環境変数 KISO_GSPREAD_CREDENTIALS で Service Account JSON のパスを指定してください。",
            file=sys.stderr,
        )
        return 2
    if not args.spreadsheet_id:
        print(
            "[ERROR] spreadsheet-id が未指定です。--spreadsheet-id または "
            "環境変数 KISO_SPREADSHEET_ID で対象スプレッドシートの ID を指定してください。",
            file=sys.stderr,
        )
        return 2

    print(f"\nスプレッドシートに接続: {args.spreadsheet_id}")
    ws = open_kiso_sheet(args.credentials, args.spreadsheet_id)
    print("KisoQuestions シートを取得")

    write_to_sheet(ws, rows, replace_all=not args.append)
    mode = "末尾追記" if args.append else "全置換（ヘッダー以外を削除してから投入）"
    print(f"書き込み完了: {len(rows)} 行 / モード: {mode}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
