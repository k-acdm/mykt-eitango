"""各級の A〜H バンドごとの生成計画（仕様書 §6.4.4）。

Phase 1 はプロトタイプのため A/B/C 各 10 問のみ。Phase 2 以降で
紙教材画像（A〜H 全 8 セット）を参照して残り D〜H と count を埋める。

各バンドの設定は dict で持つ。キーの意味は級ごとに違うため、
各 `rank_XX_*.py` 側で BAND_PLAN[<rank>][<band>] を解釈する。

⚠️ **設計原則は ``DESIGN_PRINCIPLES.md`` に集約**
全級・全フェーズ共通の設計原則（既約性、Band A〜C の入門難易度調整など）は、
本ファイル冒頭ではなく ``scripts/generate_kiso_questions/DESIGN_PRINCIPLES.md``
に記載。新規追加・修正の前に必ず一読のこと。
"""

from __future__ import annotations

from typing import Any, Dict


BAND_PLAN: Dict[int, Dict[str, Dict[str, Any]]] = {
    # 20級：整数四則混合
    # Phase 1（2026-05-07 夜）: 30→50 題化、Band D 新設で 4 Band 構成 + digits=1 化。
    # ふくちさん教育的判断（36 年塾長経験、小学校算数の最も基礎・四則混合の入口）:
    #   - A: 1 桁 2項加減 5 問（入門、subcounts add=3 / sub=2）
    #   - B: 1 桁 2項乗除 5 問（入門、subcounts mul=3 / div=2）
    #   - C: 1 桁 3項四則混合 20 問（**digits=2→1 必須、構造的修正**）
    #     subcounts={"plus_dom": 7, "minus_dom": 6, "mul_dom": 7}（演算子均等化）
    #   - D: 1 桁 3項括弧あり 20 問（新設、ふくちさん「カッコの理解は基礎の山場」）
    #     subcounts={"add_outer": 7, "mul_outer": 7, "div_outer": 6}
    # **digits 縮小の理由**：旧 Band C は digits=2 で結果が 134,044 等の暗算範囲外
    # （`62 × 23 × 94` 等）。小学校算数として教育的に重すぎるため digits=1 化。
    # Band A/B の自明問題（6-6=0、9÷9=1 等）は **教育的価値があるため許容**
    # （ふくちさん 2026-05-07 判断、「同じ数を引くと 0」「同じ数で割ると 1」の
    # 体感が入門としての本質）。
    # TODO_PHASE3: 4 項以上、二重カッコ、digits=2 の 3 項は Phase 3 以降。
    # 負の数は rank_11/12/13 領域として rank_20 に入れない。
    20: {
        "A": {"count": 5, "digits": 1, "terms": 2, "ops": ["+", "-"], "parens": False,
              "subcounts": {"add": 3, "sub": 2}},
        "B": {"count": 5, "digits": 1, "terms": 2, "ops": ["*", "/"], "parens": False,
              "subcounts": {"mul": 3, "div": 2}},
        "C": {"count": 20, "digits": 1, "terms": 3, "ops": ["+", "-", "*", "/"], "parens": False,
              "subcounts": {"plus_dom": 7, "minus_dom": 6, "mul_dom": 7}},
        "D": {"count": 20, "kind": "three_term_paren", "digits": 1,
              "subcounts": {"add_outer": 7, "mul_outer": 7, "div_outer": 6}},
    },
    # 19級：小数 加減
    # Phase 1（2026-05-07 夜）: 30→50 題化、Band D 新設で 4 Band 構成に。
    # ふくちさん教育的判断（36 年塾長経験、小数加減は小数の入口・桁揃えの山場）:
    #   - A: 1 桁同位 2項加減 15 問（slot_index 駆動 + 演算子均等 + 整数答え保証）
    #     subcounts={"add": 8, "sub": 7, "int_ans": 2}
    #     - slot 0-1: int_ans 強制（"2.3 + 1.7 = 4" 系で「足したら整数になる」体験を保証）
    #     - slot 2-7: add 通常（残り 6 問、+ 演算子だが整数答えは強制せず偶発許容）
    #     - slot 8-14: sub（7 問）
    #     - 合計: 2 + 6 + 7 = 15（int_ans 2 + add 通常 6 + sub 7、ふくちさん仕様 typo
    #       sub:5 → sub:7 に修正、count=15 整合性維持）
    #   - B: 2 桁同位 2項加減 15 問（slot_index 駆動 + 演算子均等）
    #     subcounts={"add": 8, "sub": 7}
    #   - C: 桁違い 2項加減 10 問（slot_index 駆動 + 「整数 - 小数」躓き保証）
    #     subcounts={"int_minus_dec": 5, "rest_diff": 5}
    #     - int_minus_dec: 5 - 2.3 系（中学算数の最大躓きポイント）
    #     - rest_diff: 整数 + 小数、桁違い小数同士
    #   - D: 3項加減（新設）10 問（slot_index 駆動）
    #     subcounts={"all_add": 5, "add_sub_mix": 5}
    #     - all_add: 3 項全て加算（うち slot 0 は整数答え強制）
    #     - add_sub_mix: + と - を最低各 1 個含む
    # ふくちさん哲学「小数の計算は中1 正負の数（rank_11/12/13）への前段階」を反映。
    # rank_16（分数加減）と同思想で Band D 3 項加減を新設。
    # TODO_PHASE3: 4 項以上、3 桁同位、帯分数・分数混在は Phase 3 以降。
    # 後半カッコ（3.5 - (1.2 + 0.5)）は rank_09 Band D paren_addsub の領域として
    # rank_19 では入れない方針（rank_14/16 と同方針）。
    19: {
        "A": {"count": 15, "int_max": 9, "decimals": 1, "terms": 2,
              "subcounts": {"add": 8, "sub": 7, "int_ans": 2}},
        "B": {"count": 15, "int_max": 9, "decimals": 2, "terms": 2,
              "subcounts": {"add": 8, "sub": 7}},
        "C": {"count": 10, "int_max": 9,
              "decimals_options": [(0, 3), (3, 0), (1, 3), (2, 1)], "terms": 2,
              "subcounts": {"int_minus_dec": 5, "rest_diff": 5}},
        "D": {"count": 10, "kind": "three_term_addsub", "int_max": 9, "decimals": 1,
              "subcounts": {"all_add": 5, "add_sub_mix": 5}},
    },
    # 18級：小数 乗除
    # Phase 1（2026-05-07 夜）: 30→50 題化、Band D 新設で 4 Band 構成に。
    # ふくちさん教育的判断（36 年塾長経験、小数の山場・小数点の移動）:
    #   - A: 整数 × 小数 / 整数 ÷ 小数 / 小数 ÷ 整数 15 問（slot_index 駆動 + 演算子均等）
    #     subcounts={"mul": 8, "div": 7}
    #   - B: 小数 × 小数 / 小数 ÷ 小数 15 問（小さめ、slot_index 駆動 + 演算子均等）
    #     subcounts={"mul": 8, "div": 7}
    #   - C: 小数 × 小数 / 小数 ÷ 小数 10 問（やや大きめ、slot_index 駆動 + 演算子均等）
    #     subcounts={"mul": 5, "div": 5}
    #   - D: 答えが整数になる muldiv 10 問（新設、slot_index 駆動）
    #     subcounts={"mul_int_ans": 5, "div_int_ans": 5}
    #     - mul_int_ans: 5 × 0.6 = 3 / 20 × 0.25 = 5 系（位置先頭/末尾両方）
    #     - div_int_ans: 12 ÷ 1.5 = 8 / 6 ÷ 0.5 = 12 系（中学算数の躓きポイント）
    # rank_15（分数乗除）Band D（答えが整数 muldiv）と完全対称、教育的に映える。
    # TODO_PHASE3: 4 項以上、小数 × 分数の混在は Phase 3 以降。
    # 「割り切れない割り算」（小数の循環）は仕様書 §6.5 厳密値原則のため入れない。
    18: {
        "A": {"count": 15, "kind": "int_x_dec", "int_max": 9, "decimals": 1,
              "subcounts": {"mul": 8, "div": 7}},
        "B": {"count": 15, "kind": "dec_x_dec", "int_max": 5, "decimals": 1,
              "subcounts": {"mul": 8, "div": 7}},
        "C": {"count": 10, "kind": "dec_x_dec", "int_max": 9, "decimals": 1,
              "subcounts": {"mul": 5, "div": 5}},
        "D": {"count": 10, "kind": "int_ans_muldiv", "int_max": 50,
              "decimals_options": [1, 2],
              "subcounts": {"mul_int_ans": 5, "div_int_ans": 5}},
    },
    # 17級：小数 四則混合
    # Phase 1（2026-05-07 夜）: 30→50 題化、Band D 新設で 4 Band 構成に。
    # ふくちさん教育的判断（36 年塾長経験、小数の山場・四則混合の頂点）:
    #   - A: 2 項小数四則 12 問（slot_index 駆動、演算子均等化で ÷ 偏り少なすぎ解消）
    #     subcounts={"add": 3, "sub": 3, "mul": 3, "div": 3}
    #   - B: 3 項小数四則 14 問（カッコなし、既存ロジック踏襲、count のみ拡大）
    #   - C: 3 項小数四則 12 問（カッコあり、既存ロジック踏襲、count のみ拡大）
    #   - D: 答えが整数になる 3 項小数四則 12 問（新設、slot_index 駆動）
    #     subcounts={"no_paren": 6, "with_paren": 6}
    #     - 例 1.5 × 2 + 1 = 4 / (0.8 + 0.4) × 5 = 6
    # rank_14（分数四則混合）Band D（整数を含む混合）と完全対称な構造、
    # 教育的に「答え整数の達成感」を保証する rank_17 の主役 Band D。
    # TODO_PHASE3: 4 項以上、二重カッコ、Band B/C で ÷ を含む 3 項は Phase 3 以降。
    # 帯分数・分数混在は rank_14 領域。後半カッコは rank_09 領域として
    # Phase 3 にも入れない（rank_14/16/19 と同方針）。
    17: {
        "A": {"count": 12, "terms": 2, "ops": ["+", "-", "*", "/"], "parens": False,
              "int_max": 5, "decimals": 1,
              "subcounts": {"add": 3, "sub": 3, "mul": 3, "div": 3}},
        "B": {"count": 14, "terms": 3, "ops": ["+", "-", "*"], "parens": False,
              "int_max": 5, "decimals": 1},
        "C": {"count": 12, "terms": 3, "ops": ["+", "-", "*"], "parens": True,
              "int_max": 5, "decimals": 1},
        "D": {"count": 12, "kind": "int_ans_three_term",
              "int_max": 5, "decimals": 1,
              "subcounts": {"no_paren": 6, "with_paren": 6}},
    },
    # 15級：分数 乗除
    # Phase 1（2026-05-07）: 30→50題化、Band D を新設して 4 Band 構成に。
    # ふくちさん教育的判断（36年塾長経験）:
    #   - A: 分数 op 整数 12 問（既存ロジック踏襲、slot_index 駆動で × 6 / ÷ 6 均等保証）
    #   - B: 分数 op 分数 18 問（単元の主役、slot_index 駆動で × 9 / ÷ 9 均等保証）
    #   - C: 3 項乗除 12 問（slot_index 駆動で 4 通り組み合わせ均等：×× / ×÷ / ÷× / ÷÷ 各 3 問）
    #   - D: 答えが整数になる muldiv 8 問（新設、subcounts 4/4）
    # 「演算子配分の偶然依存を解消、約分の感覚を意図的に体験させる」設計。
    # rank_14 Band D との部分重複（末尾整数 muldiv）は Phase 1 では許容、
    # Phase 3 の 100 題化時に位置で完全分離する方針。
    15: {
        "A": {
            "count": 12, "kind": "frac_int",
            "denom_max": 10, "int_max": 12,
            "subcounts": {"mul": 6, "div": 6},
            # 「約分が活きる組」を最低半数（mul/div 各 3 問以上）強制：
            # mul は 分子と整数の gcd > 1、div は 同左 で判定
            "force_cancel_min_per_op": 3,
        },
        "B": {
            "count": 18, "kind": "frac_frac",
            "denom_max": 10,
            "subcounts": {"mul": 9, "div": 9},
            # 「約分が活きる組」を最低半数（mul/div 各 5 問以上）強制：
            # mul は 分子分母の積の gcd > 1、div は 分子分母クロス積の gcd > 1
            "force_cancel_min_per_op": 5,
        },
        "C": {
            "count": 12, "kind": "three_term",
            "denom_max": 8,
            # 3 項演算子組み合わせ均等：mm=×× / md=×÷ / dm=÷× / dd=÷÷ 各 3 問
            "subcounts": {"mm": 3, "md": 3, "dm": 3, "dd": 3},
        },
        # Band D: 答えが整数になる muldiv 8 問（新設）。
        #   mul_int_ans: 整数 × 分数 = 整数 形（位置：先頭/末尾を均等）
        #   div_int_ans: 整数 ÷ 分数 = 整数 形（位置：先頭/末尾を均等）
        # 整数値範囲 2..12（rank_14 Band D と整合）。
        "D": {
            "count": 8, "kind": "int_ans_muldiv",
            "denom_max": 8, "int_max": 12,
            "subcounts": {"mul_int_ans": 4, "div_int_ans": 4},
        },
    },
    # 14級：分数 四則混合
    # Phase 1（2026-05-07）: 30→50題化、Band D を新設して 4 Band 構成に。
    # ふくちさん教育的判断（36年塾長経験）:
    #   - A: 2項 四則混合 12 問（既存ロジック踏襲）
    #   - B: 3項 四則混合 括弧なし 14 問（既存ロジック踏襲、単元の主役）
    #   - C: 3項 四則混合 括弧あり（先頭カッコのみ）12 問（既存ロジック踏襲）
    #   - D: 整数を含む混合 12 問（新設、小学校算数の核心パターン補完）
    # 「分数の四則混合は中学数学の躓きの根本原因」哲学に基づき、
    # 小学校算数で必須の「整数 ± 分数」「整数 × 分数」「整数 ÷ 分数」を
    # Band D として量で確保（rank_15 Band A frac_int との整合性も改善）。
    14: {
        "A": {"count": 12, "kind": "two_term", "denom_max": 10},
        "B": {"count": 14, "kind": "three_term_no_parens", "denom_max": 8},
        "C": {"count": 12, "kind": "three_term_parens", "denom_max": 8},
        # Band D: 整数を含む混合。slot_index 駆動で 3 サブパターンを決定論的に分離。
        #   int_addsub: 整数 ± 分数（4 問）— 例 3 - 5/6 = 13/6
        #   int_mul:    整数 × 分数（4 問）— 例 6 × 2/3 = 4（約分が活きる組を多めに）
        #   int_div:    整数 ÷ 分数（4 問）— 例 3 ÷ 1/4 = 12（逆数倍の理解）
        # 整数の位置（先頭/末尾）は両方含む。
        "D": {
            "count": 12, "kind": "int_with_frac",
            "denom_max": 8, "int_max_addsub": 10, "int_max_muldiv": 12,
            "subcounts": {"int_addsub": 4, "int_mul": 4, "int_div": 4},
        },
    },
    # 16級：分数加減
    # Phase 1（2026-05-07 夕）: 30→50 題化、Band D 新設で 4 Band 構成に。
    # ふくちさん教育的判断（36 年塾長経験、分数 3 兄弟の最後・分数加減の核心）:
    #   - A: 同分母 2項加減 15 問（slot_index 駆動 + 演算子均等 + 整数答え保証）
    #     subcounts={"add": 8, "sub": 7, "int_ans": 2}
    #     - slot 0-1: int_ans 強制（"1/3 + 2/3 = 1" 系を確実に 2 問入れる教育的訴求）
    #     - slot 2-7: add 通常（残り 6 問）
    #     - slot 8-14: sub 通常（7 問）
    #   - B: 異分母 2項加減 15 問（slot_index 駆動 + 通分難易度サブパターン分離）
    #     subcounts={"easy_lcm": 5, "medium_lcm": 5, "hard_lcm": 5}
    #     - easy_lcm: lcm <= 12（簡単な通分）
    #     - medium_lcm: 13 <= lcm <= 30（中くらい）
    #     - hard_lcm: lcm > 30（難しい）
    #   - C: 異分母 2項加減 10 問（中〜難の通分、easy_lcm 含まない）
    #     subcounts={"medium_lcm": 5, "hard_lcm": 5}
    #   - D: 3項加減（新設）10 問（slot_index 駆動）
    #     subcounts={"all_add": 5, "add_sub_mix": 5}
    #     - all_add: 3項全て足し算（うち最低 1 問は整数答え保証）
    #     - add_sub_mix: + と - を最低各 1 個含む
    # ふくちさん哲学「分数の加減（特に通分）は分数の最初の躓き、ここでつまずく
    # 生徒は中学数学全体で詰まる」「lcm が小さい組から大きい組まで段階的に練習」
    # を反映、通分難易度を slot_index で意図的に保証。
    # rank_14 Band D（2項 整数 ± 分数）と完全に直交（rank_16 では 2項整数±分数を
    # 入れない方針で分業）。
    # TODO_PHASE3: 帯分数表記、小数混在、4 項以上、後半カッコは Phase 3 以降。
    # 後半カッコ（3/4 - (1/2 + 1/4)）は rank_09 Band D paren_addsub の領域として
    # rank_16 では入れない方針（ふくちさん 2026-05-07 判断、rank_14 と同方針）。
    16: {
        "A": {
            "count": 15, "same_denom": True, "terms": 2, "denom_max": 10,
            "subcounts": {"add": 8, "sub": 7, "int_ans": 2},
        },
        "B": {
            "count": 15, "same_denom": False, "terms": 2, "denom_max": 12,
            "subcounts": {"easy_lcm": 5, "medium_lcm": 5, "hard_lcm": 5},
        },
        "C": {
            "count": 10, "same_denom": False, "terms": 2, "denom_max": 15,
            "subcounts": {"medium_lcm": 5, "hard_lcm": 5},
        },
        "D": {
            "count": 10, "kind": "three_term_addsub", "terms": 3, "denom_max": 8,
            "subcounts": {"all_add": 5, "add_sub_mix": 5},
        },
    },
    # 13級：正負の数 加減
    # Phase 1（2026-05-05）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。
    # ふくちさん教育的判断（36 年塾長経験、中1 1学期前半の最入門単元）:
    #   - A: 括弧付き同符号 12 問（既存ロジック踏襲）
    #   - B: 括弧付き混合符号 12 問（既存ロジック踏襲、躓きポイント）
    #   - C: 括弧なし 11 問（既存ロジック踏襲、max_abs=99 で 2 桁同士の暗算）
    #   - D: 3 項加減（新設、紙教材で扱う中1 加減の最終形）15 問
    # 中1 加減の山場「3 項計算」が旧構成では完全に欠落していたため Phase 1 で
    # Band D を新設（rank_05/06/08/01 と同じ Band D 新設パターン）。
    # TODO_PHASE3: 小数・分数の混合、カッコ + カッコなし混在は Phase 3 で導入。
    13: {
        "A": {"count": 12, "kind": "paren",   "max_abs": 9,  "terms": 2, "same_sign_only": True},
        "B": {"count": 12, "kind": "paren",   "max_abs": 9,  "terms": 2, "same_sign_only": False},
        "C": {"count": 11, "kind": "noparen", "max_abs": 99, "terms": 2, "same_sign_only": False},
        "D": {"count": 15, "kind": "three_term_addsub", "max_abs": 9},
    },
    # 12級：正負の数 乗除
    # Phase 1（2026-05-05）: 30→50 題に拡充、Band B を構造改革（unique pool 24→48）。
    # ふくちさん教育的判断（36 年塾長経験）:
    #   - A: 1 桁 2 項 ×/÷ 15 問（既存ロジック踏襲）
    #   - B: 累乗 15 問（**構造改革必須**、slot_index 駆動の 3 サブパターン分離）
    #     - subcounts={"paren_neg":5, "leading_minus":5, "positive":5}
    #     - 教育的並び: slot 0/1/2 で (-3)²/-3²/3² が並ぶ interleave 方式で違いを認識させる
    #     - max_abs=5→9、exp_max=3 維持、結果ガード |result|≤1000
    #     - unique pool: 3 sub × 8 base × 2 exp = 48（旧 24 から倍増）
    #   - C: 3 項 ×/÷ 20 問（既存ロジック踏襲、count のみ +10）
    # 中1 乗除の山場「(-3)² と -3² の違い」を slot 駆動で意識的に並べることで
    # 教育効果を最大化する（生徒の 8 割が間違える典型ミス）。
    # TODO_PHASE3: 累乗と乗除の混合（(-3)²×4）、4 項以上、分数乗除は Phase 3 で導入。
    12: {
        "A": {"count": 15, "kind": "muldiv", "max_abs": 9, "terms": 2, "powers": False},
        "B": {
            "count": 15, "kind": "powers", "max_abs": 9, "exp_max": 3, "max_result_abs": 1000,
            "subcounts": {"paren_neg": 5, "leading_minus": 5, "positive": 5},
        },
        "C": {"count": 20, "kind": "muldiv", "max_abs": 9, "terms": 3, "powers": False},
    },
    # 11級：正負の数 四則混合（最難関級）
    # Phase 1（2026-05-05）: 30→50 題に拡充、Band C を slot_index 駆動化。
    # ふくちさん教育的判断（36 年塾長経験）:
    #   - A: 2 項四則混合 15 問（既存ロジック踏襲、両正排除で 11 級らしさ維持）
    #   - B: 累乗を含む 2 項 15 問（既存ロジック踏襲）
    #   - C: 3 項 + 括弧 + 累乗 20 問（**slot_index 駆動の 2 サブパターン分離**）
    #     - subcounts={"inner_paren_x_power":10, "power_op_term_op_term":10}
    #     - 既存 P1/P2 を slot_index で決定論分離（rng.choice の偶然依存を解消）
    # 中1 1 学期後半の集大成、3 単元の最難関。
    # TODO_PHASE3: 4 項以上、分数係数、二重括弧は Phase 3 で導入。
    11: {
        "A": {"count": 15, "kind": "two_term_mixed",        "max_abs": 9},
        "B": {"count": 15, "kind": "with_power",            "max_abs": 5, "exp_max": 3},
        "C": {
            "count": 20, "kind": "three_term_paren_power", "max_abs": 5, "exp_max": 2,
            "subcounts": {"inner_paren_x_power": 10, "power_op_term_op_term": 10},
        },
    },
    # 8級：一次方程式・比例式
    # Phase 1（2026-05-05）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。
    # ふくちさん教育的判断（36年塾長経験）:
    #   - A: ax=b の最易レベル 5 問（x_max を 9→12 に拡張、coef_max=10）
    #   - B: ax+b=cx+d の標準（移項の脱落ポイント）20→25 問に増量。パラメータ無修正
    #   - C: 比例式 10 問（value_max を 12→15 に拡張）
    #   - D: カッコ付き 10 問（新設、軽め2 / 標準6 / 重め2 を slot_index 駆動で決定論的分離）
    # 中1 一次方程式の核心は「移項」と「カッコの展開」。旧構成は B のパターンしかなく、
    # カッコ付きの問題（中1 単元の山場）が一切なかったため Phase 1 で Band D を新設し、
    # 教育的ギャップを解消する（rank_05 / rank_06 で Band D 新設したのと同パターン）。
    # Band D の subcounts: 軽め (a(x+b)=c) は導入用に少量、標準 (a(x+b)=c(x+d)) は単元の主役、
    # 重め (a(x+b)-c(x+d)=e) は応用として少量という塾長判断。
    # TODO_PHASE3: 小数係数・分数係数の方程式は Phase 3 の Band E 以降で導入。
    8: {
        "A": {"count": 5,  "kind": "ax_eq_b", "coef_max": 10, "x_max": 12},
        "B": {"count": 25, "kind": "ax_b_eq_cx_d", "coef_max": 6, "const_max": 12},
        "C": {"count": 10, "kind": "proportion", "value_max": 15},
        "D": {
            "count": 10,
            "kind": "paren_form",
            "coef_max": 6, "const_max": 8, "x_max": 8,
            "subcounts": {"light": 2, "standard": 6, "heavy": 2},
        },
    },
    # 7級：式の計算 中2
    7: {
        # Phase 1（2026-04-30）: 30→50題化、Band C を 3 サブパターン分離
        # A: 多項式の加減
        # B: 多項式 × 整数 or 多項式 ÷ 整数
        # C: 単項式の乗除と累乗（slot_index 駆動の決定論的サブパターン分離）
        #    subcounts={"power":5, "mono_mul":6, "mono_div":5}（ふくちさん教育的判断、
        #    mono_mul を 1 問多めに）
        #      - power     : 既存の (coef·var)^exp 単項式の累乗
        #      - mono_mul  : 単項式×単項式（同変数 / 異変数 両対応）
        #      - mono_div  : 単項式÷単項式（整数結果と分数結果両方）
        # 教育的拡充: 旧構成では中2 文字式の核「単項式の乗除」が抜けていたため Phase 1 で網羅。
        "A": {"count": 17, "kind": "poly_addsub", "coef_max": 6, "const_max": 8},
        "B": {"count": 17, "kind": "poly_int_muldiv", "coef_max": 5, "const_max": 8, "factor_max": 6},
        "C": {
            "count": 16,
            "kind": "mono_mixed",
            "coef_max": 5, "exp_max": 3,  # power サブパターン用に保持
            "subcounts": {"power": 5, "mono_mul": 6, "mono_div": 5},
        },
    },
    # 5級：式の計算 中3（多項式の展開）
    5: {
        # Phase 1（2026-04-30）: 30→50題化、Band D を新設して 4 Band 構成に
        # A: (ax+b)(cx+d) — 基本展開（a, c は ±1〜±2）。Band A のみ (a,b)<=(c,d) 辞書順正規化
        # B: (ax+b)(cx+d) — 一般係数（a, c, b, d は ±1〜±5）
        # C: 3項 × 2項（trinomial × binomial）
        # D: (ax+b)² — 係数付き平方公式の直接展開（a >= 2 で rank_04 (x+a)² と差別化）
        # 教育的根拠（ふくちさん 36 年の塾長経験）：
        #   (ax+b)² は中3生がミスしやすい典型パターン
        #   - (2x)² を 2x² と書く（正しくは 4x²）
        #   - 中央項の係数倍を忘れる（2·2x·3 = 12x）
        #   - 係数の二乗処理を忘れる
        #   公式記憶の rank_04 (x+a)² と差別化し、直接展開で量を確保する単元
        "A": {"count": 13, "kind": "two_by_two_simple", "coef_max": 2, "const_max": 5},
        "B": {"count": 13, "kind": "two_by_two_general", "coef_max": 5, "const_max": 6},
        "C": {"count": 12, "kind": "trinomial_by_binomial", "coef_max": 3, "const_max": 5},
        "D": {"count": 12, "kind": "square_with_coef", "coef_max": 5, "const_max": 6},
    },
    # 4級：乗法公式（フェーズ1: 50題化、2026-04-30）
    # A: (x+a)(x+b) — Band A の (a,b) は数値昇順に正規化済（rank_04_expansion._gen_type_xab）
    # B: (x+a)^2 / (x-a)^2
    # C: (x+a)(x-a)
    # const_max=12 は中3 乗法公式の典型範囲（紙教材準拠）。
    # unique pool: A 全 24*23/2=276（順序統一後）、B 24、C 12。
    # 配分は紙教材の難易度比率に沿って A=45% / B=35% / C=20%。
    # TODO_PHASE2: 100題化。const_max=15 や Band D 新設で対応。
    4: {
        "A": {"count": 23, "kind": "type_xab", "const_max": 12},
        "B": {"count": 17, "kind": "type_square", "const_max": 12},
        "C": {"count": 10, "kind": "type_diff_squares", "const_max": 12},
    },
    # 3級：因数分解（フェーズ1: 50題化、2026-04-30）
    # A: 共通因数のみ：ax + ay = a(x + y)
    # B: x² + bx + c → (x + m)(x + n)
    # C: x² - a² または x² ± 2ax + a²（完全平方、3 サブパターン）
    # TODO_PHASE3: ax² + bx + c のたすき掛けは Phase 3 の Band D 以降で導入
    # const_max=12 は中3 因数分解の典型範囲（紙教材準拠、rank_04 と整合）。
    # Band C の subcounts: ふくちさんの教育的判断「差の平方は見分けが簡単で
    # 思考量が少ない」を反映し diff を少なめ。perfect_pos/neg はそれなりに
    # 思考が必要なため均等。
    # unique pool（const_max=12 のとき）:
    #   A common_factor: 数百〜千単位（factor/term 組合せ豊富）
    #   B trinomial_simple: C(24,2) = 276
    #   C diff: 12 / perfect_pos: 12 / perfect_neg: 12（合計 36）
    # TODO_PHASE2: 100題化。const_max=15 や Band D（たすき掛け）追加で対応。
    3: {
        "A": {"count": 11, "kind": "common_factor", "factor_max": 9, "term_max": 6},
        "B": {"count": 11, "kind": "trinomial_simple", "root_max": 9},
        "C": {
            "count": 28,
            "kind": "diff_or_perfect_square",
            "const_max": 12,
            "subcounts": {"diff": 6, "perfect_pos": 11, "perfect_neg": 11},
        },
    },
    # 2級：平方根（Phase 1: 30→50題化、2026-04-30）
    2: {
        # A: 簡約のみ √n → a√b
        # B: 簡約 + 加減 (a√b ± c√d → 同じ b に統一)
        # C: 乗除 と 有理化（rank_03 と同じ slot_index 駆動の 3 サブパターン分離）
        #    subcounts={"mul": 6, "rationalize": 5, "div": 5}（ふくちさん教育的判断、ほぼ均等）
        #    教育的引き締めは rank_02_sqrt.py 内の各 generator に実装：
        #      - mul: 5 問は a,b ∈ [2,15] / 1 問だけ [16,30] で中堅レベルの刺激を残す
        #      - rationalize: b ∈ {2,3,5,6,7,10}（square-free）/ a ∈ [1,12]
        #      - div: 答えの denom ≤ 12 を制約、極端な radicand を排除
        # TODO_PHASE3: 二重根号、複雑な分子分母（1/(√3+1) 等）は Phase 3 の Band D 以降で導入
        "A": {"count": 17, "kind": "simplify_only", "n_max": 200},
        "B": {"count": 17, "kind": "addsub_with_simplify", "coef_max": 5, "n_max": 50},
        "C": {
            "count": 16,
            "kind": "muldiv_rationalize",
            "n_max": 30,
            "subcounts": {"mul": 6, "rationalize": 5, "div": 5},
        },
    },
    # 1級：二次方程式
    # Phase 1（2026-05-05）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。
    # ふくちさん教育的判断（36年塾長経験）:
    #   - A: 因数分解で解ける整数解 15 問。重解と 0 含みは控えめに（slot_index 駆動で
    #        double_root=1 / with_zero=1 / normal=13 に決定論分離）
    #   - B: x²=c 形のみ 5 問（旧 P_rational ＝たすき掛けは中学範囲外なので完全排除）
    #   - C: 解の公式（無理数解）15 問。k>1 系（x=-1±2√3 等）を slot_index 駆動で
    #        必ず 5 問確保（k_eq_1=10 / k_gt_1=5）
    #   - D: 平方根法（新設）15 問。(x-p)²=q 形と ax²=c 形を slot_index 駆動で
    #        with_p=7 / ax2_eq_c=8 に決定論分離
    # 中3 二次方程式の核心は「因数分解 → 平方根法 → 解の公式の使い分け」だが、
    # 旧構成は B にたすき掛け（中学範囲外）が混入していた上、平方根法（(x-p)²=q
    # と ax²=c）が一切練習できなかった。Phase 1 で Band B 純化 + Band D 新設し、
    # 教育的ギャップを解消する（rank_05 / rank_06 / rank_08 と同じ Band D 新設パターン）。
    # Band C の max_bc_kgt1=12 は教育的拡張：max_bc=5 では k>1 が組合せ的にほぼ
    # 出ないため、k>1 専用にパラメータを拡張して中堅レベルの問題を確保する
    # （k=1 部分は max_bc=5 のまま「易しめ」を維持、DESIGN_PRINCIPLES.md 原則 2）。
    # TODO_PHASE3: 解の公式 a >= 3 の問題、(x-p)²=q で q が square-free（無理数解）、
    # ax²+bx+c=0 のたすき掛けは Phase 3 の Band E 以降で導入。
    1: {
        "A": {
            "count": 15,
            "kind": "factorable_int",
            "max_root": 7,
            "subcounts": {"double_root": 1, "with_zero": 1, "normal": 13},
        },
        "B": {"count": 5, "kind": "x2_eq_c"},
        "C": {
            "count": 15,
            "kind": "irrational",
            "max_a": 2, "max_bc": 5, "max_bc_kgt1": 12,
            "subcounts": {"k_eq_1": 10, "k_gt_1": 5},
        },
        "D": {
            "count": 15,
            "kind": "sqrt_method",
            "subcounts": {"with_p": 7, "ax2_eq_c": 8},
        },
    },
    # 6級：連立方程式
    6: {
        # Phase 1（2026-05-04）: 30→50題化、Band D を新設して 4 Band 構成に。
        # ふくちさん教育的判断（36年塾長経験）:
        #   - A: 最易レベル導入 5 問（rank_08 と同思想）coef_max を 3→4 に拡張、整数解
        #   - B: 標準加減法 20 問（単元の主役、既存ロジック踏襲）
        #   - C: 分数解 10 問（sol_denom_max 4→5 で 1/5, 2/5 を追加）
        #   - D: 代入法向け 15 問（新設、単元の山場の半分）
        # 中2連立方程式の核心は「加減法 vs 代入法 を選び分ける訓練」。
        # 旧構成は加減法しか練習できなかったため Phase 1 で代入法 Band D を新設し、
        # 教育的ギャップを解消する（rank_05 で Band D 新設したのと同パターン）。
        "A": {"count": 5,  "kind": "simple_int",     "coef_max": 4, "sol_max": 5},
        "B": {"count": 20, "kind": "general_int",    "coef_max": 6, "sol_max": 8},
        "C": {"count": 10, "kind": "frac_solution",  "coef_max": 5, "sol_denom_max": 5},
        "D": {"count": 15, "kind": "substitution_form", "coef_max": 5, "sol_max": 6},
    },
    # 10級：単位・比・割合（10 問固定スロット構造）
    # Phase 1（2026-05-06）: 30 → 50 題に拡充（10 スロット維持 + count 増加 + 弱 slot 補強）。
    # ふくちさん教育的判断（36 年塾長経験）+ 事前調査で確定（案 A 採用）:
    #   - 10 スロット固定構造は Phase 2 グループ③で確立した教育設計（slot 順 = 教科書順）
    #   - count=17/17/16 で main.py の slot rotation により以下のように展開:
    #       count=17 → slot 1..10, 1..7（slot 1..7 が 2 問、slot 8..10 が 1 問）
    #       count=16 → slot 1..10, 1..6（slot 1..6 が 2 問、slot 7..10 が 1 問）
    #   - slot 6 (時間) は Band C で時刻表記「1 時間 30 分 = 90 分」を新規追加（unique 16+）
    #   - slot 7 (速さ) は Band B/C の cases リスト拡張で構造的バグ修正
    #     （旧 unique=3, 4 → 拡張後 unique 10+、教育的に時速 240km まで含める）
    # 既存生徒側機能への影響なし（generator のロジック本体は無修正、cases リストの拡張のみ）。
    10: {
        "A": {"count": 17, "complexity": "easy"},
        "B": {"count": 17, "complexity": "medium"},
        "C": {"count": 16, "complexity": "hard"},
    },
    # 9級：式の計算 中1
    # 9級：式の計算 中1
    # Phase 1（2026-05-06）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。
    # ふくちさん教育的判断（36 年塾長経験）:
    #   - A: 同類項 13 問（slot_index 駆動の 3 サブパターン）
    #     - two_term=7（既存ロジック踏襲、2 項単項式）
    #     - three_term=3（新規、3 項同類項）
    #     - with_const=3（新規、定数項込み）
    #   - B: 分配法則 13 問（既存ロジック踏襲、count のみ 10→13）
    #   - C: 単項式の乗除 11 問（既存ロジック踏襲、count のみ 10→11）
    #   - D: カッコ展開 + 加減 13 問（新設、(ax+b) ± (cx+d) 形）
    #     - 中1 文字式の山場「カッコ展開 + 符号反転」の集中練習
    #     - 第 2 カッコの符号反転を伴う -(...) 形を多めに（rng.choices で 2:3）
    # 中1 教科書の山場「カッコ展開 + 符号反転」が旧構成で完全に欠落していたため、
    # Phase 1 で Band D を新設し教育的ギャップを解消する
    # （rank_05/06/08/01/13 と同じ Band D 新設パターン）。
    # TODO_PHASE3: distribute_addsub（2(x+3) + 3(x-1) 系）は中2 rank_07 範囲のため
    # rank_09 では Phase 1 で導入しない。100 題化時に rank_07 への含有を確認すること。
    # 4 項以上の同類項、二重括弧、分数係数、複数文字は Phase 3 の Band E 以降で導入。
    9: {
        "A": {
            "count": 13, "kind": "like_terms", "coef_max": 9, "const_max": 7,
            "subcounts": {"two_term": 7, "three_term": 3, "with_const": 3},
        },
        "B": {"count": 13, "kind": "distribute",      "coef_max": 5, "const_max": 5},
        "C": {"count": 11, "kind": "monomial_muldiv", "coef_max": 6},
        "D": {"count": 13, "kind": "paren_addsub",    "coef_max": 5, "const_max": 7},
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
