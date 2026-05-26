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
    # Phase 2 Wave 3（2026-05-26）: 50→100題化、★ Band E 新設（digits=2、|result| 上限なし） ★
    # ふくちさん教育原則「rank_20 は暗算演習コンテンツではない、上限不要」
    # （CLAUDE.md「マイ活アプリの教育設計原則」追記済）。
    # Band A/B/C/D は据え置き or 倍化、Band E で digits=2 拡張（TODO_PHASE3 消化）。
    #   A: 10 問（自明問題保持、subcounts add=6/sub=4）
    #   B: 10 問（自明問題保持、subcounts mul=6/div=4）
    #   C: 30 問（digits=1 維持、subcounts スケール plus_dom=11/minus_dom=9/mul_dom=10）
    #   D: 30 問（digits=1 維持、subcounts スケール add_outer=11/mul_outer=10/div_outer=9）
    #   E: 20 問（digits=2、|result| 上限なし）
    #     - subcounts: np_plus=4/np_minus=3/np_mul=3（no_paren）+ wp_add=4/wp_mul=3/wp_div=3（with_paren）
    #     - 例：97 × 89 = 8633、(67 + 28) × 5 = 475 等、暗算範囲外も意図的に含む
    #     - 教育目的：筆算する習慣を強制（CLAUDE.md「マイ活アプリの教育設計原則」参照）
    # ❌ TODO_PHASE3 から「digits=2 の 3 項」を消化（Band E で復活）
    # TODO_PHASE3 残：4 項以上、二重カッコは Phase 3 で導入予定
    20: {
        "A": {"count": 10, "digits": 1, "terms": 2, "ops": ["+", "-"], "parens": False,
              "subcounts": {"add": 6, "sub": 4}},
        "B": {"count": 10, "digits": 1, "terms": 2, "ops": ["*", "/"], "parens": False,
              "subcounts": {"mul": 6, "div": 4}},
        "C": {"count": 30, "digits": 1, "terms": 3, "ops": ["+", "-", "*", "/"], "parens": False,
              "subcounts": {"plus_dom": 11, "minus_dom": 9, "mul_dom": 10}},
        "D": {"count": 30, "kind": "three_term_paren", "digits": 1,
              "subcounts": {"add_outer": 11, "mul_outer": 10, "div_outer": 9}},
        "E": {
            "count": 20, "kind": "digits2_three_term", "digits": 2,
            "subcounts": {
                "np_plus":  4,  # no_paren plus_dom
                "np_minus": 3,  # no_paren minus_dom
                "np_mul":   3,  # no_paren mul_dom
                "wp_add":   4,  # with_paren add_outer
                "wp_mul":   3,  # with_paren mul_outer
                "wp_div":   3,  # with_paren div_outer
            },
        },
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
    # Phase 2 Wave 1（2026-05-26）: 50→100 題化、単純倍化（各 Band count 2 倍 + 全 subcounts 2 倍）。
    # 事前 probe で 9.7-15.0x unique margin が確認できたため安全。
    # Band A の int_ans は 2→4 に倍増（slot 0-3 で整数答え強制、教育的訴求を維持）。
    19: {
        "A": {"count": 30, "int_max": 9, "decimals": 1, "terms": 2,
              "subcounts": {"add": 16, "sub": 14, "int_ans": 4}},
        "B": {"count": 30, "int_max": 9, "decimals": 2, "terms": 2,
              "subcounts": {"add": 16, "sub": 14}},
        "C": {"count": 20, "int_max": 9,
              "decimals_options": [(0, 3), (3, 0), (1, 3), (2, 1)], "terms": 2,
              "subcounts": {"int_minus_dec": 10, "rest_diff": 10}},
        "D": {"count": 20, "kind": "three_term_addsub", "int_max": 9, "decimals": 1,
              "subcounts": {"all_add": 10, "add_sub_mix": 10}},
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
    # Phase 2 Wave 1（2026-05-26）: 50→100 題化、単純倍化（各 Band count 2 倍 + 全 subcounts 2 倍）。
    # 事前 probe で 8.4-14.8x unique margin が確認できたため安全。
    18: {
        "A": {"count": 30, "kind": "int_x_dec", "int_max": 9, "decimals": 1,
              "subcounts": {"mul": 16, "div": 14}},
        "B": {"count": 30, "kind": "dec_x_dec", "int_max": 5, "decimals": 1,
              "subcounts": {"mul": 16, "div": 14}},
        "C": {"count": 20, "kind": "dec_x_dec", "int_max": 9, "decimals": 1,
              "subcounts": {"mul": 10, "div": 10}},
        "D": {"count": 20, "kind": "int_ans_muldiv", "int_max": 50,
              "decimals_options": [1, 2],
              "subcounts": {"mul_int_ans": 10, "div_int_ans": 10}},
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
    # Phase 2 Wave 1（2026-05-26）: 50→100 題化、単純倍化（各 Band count 2 倍 + 全 subcounts 2 倍）。
    # 事前 probe で 10.7-12.5x unique margin が確認できたため安全。
    17: {
        "A": {"count": 24, "terms": 2, "ops": ["+", "-", "*", "/"], "parens": False,
              "int_max": 5, "decimals": 1,
              "subcounts": {"add": 6, "sub": 6, "mul": 6, "div": 6}},
        "B": {"count": 28, "terms": 3, "ops": ["+", "-", "*"], "parens": False,
              "int_max": 5, "decimals": 1},
        "C": {"count": 24, "terms": 3, "ops": ["+", "-", "*"], "parens": True,
              "int_max": 5, "decimals": 1},
        "D": {"count": 24, "kind": "int_ans_three_term",
              "int_max": 5, "decimals": 1,
              "subcounts": {"no_paren": 12, "with_paren": 12}},
    },
    # 15級：分数 乗除
    # Phase 1（2026-05-07）: 30→50題化、Band D を新設して 4 Band 構成に。
    # Phase 2 Wave 2（2026-05-26）: 50→100 題化、Band D の denom_max 8→10、int_max 12→15 拡張。
    # 拡張後 Band D unique pool 340（mul 130 + div 210）= 21x margin。A/B/C は 26x〜161x margin 確認済、単純倍化。
    # 約分強制も倍化（A: 3→6、B: 5→10）。
    # ふくちさん教育的判断（36年塾長経験）:
    #   - A: 分数 op 整数 24 問（slot_index 駆動で × 12 / ÷ 12 均等保証）
    #   - B: 分数 op 分数 36 問（単元の主役、slot_index 駆動で × 18 / ÷ 18 均等保証）
    #   - C: 3 項乗除 24 問（slot_index 駆動で 4 通り組み合わせ均等：×× / ×÷ / ÷× / ÷÷ 各 6 問）
    #   - D: 答えが整数になる muldiv 16 問（subcounts 8/8、Phase 2 で denom_max 10/int_max 15）
    # 「演算子配分の偶然依存を解消、約分の感覚を意図的に体験させる」設計。
    # rank_14 Band D との部分重複（末尾整数 muldiv）は Phase 1 では許容、
    # Phase 3 の 100 題化時に位置で完全分離する方針。
    15: {
        "A": {
            "count": 24, "kind": "frac_int",
            "denom_max": 10, "int_max": 12,
            "subcounts": {"mul": 12, "div": 12},
            # 「約分が活きる組」を最低半数（mul/div 各 6 問以上）強制：
            # mul は 分子と整数の gcd > 1、div は 同左 で判定
            "force_cancel_min_per_op": 6,
        },
        "B": {
            "count": 36, "kind": "frac_frac",
            "denom_max": 10,
            "subcounts": {"mul": 18, "div": 18},
            # 「約分が活きる組」を最低半数（mul/div 各 10 問以上）強制：
            # mul は 分子分母の積の gcd > 1、div は 分子分母クロス積の gcd > 1
            "force_cancel_min_per_op": 10,
        },
        "C": {
            "count": 24, "kind": "three_term",
            "denom_max": 8,
            # 3 項演算子組み合わせ均等：mm=×× / md=×÷ / dm=÷× / dd=÷÷ 各 6 問
            "subcounts": {"mm": 6, "md": 6, "dm": 6, "dd": 6},
        },
        # Band D: 答えが整数になる muldiv 16 問（Phase 2 Wave 2 で 8→16 倍化 + param 拡張）。
        #   mul_int_ans: 整数 × 分数 = 整数 形（位置：先頭/末尾を均等）
        #   div_int_ans: 整数 ÷ 分数 = 整数 形（位置：先頭/末尾を均等）
        # 整数値範囲 2..15（Phase 2 で 12→15 拡張、rank_14 Band D と整合）。
        "D": {
            "count": 16, "kind": "int_ans_muldiv",
            "denom_max": 10, "int_max": 15,
            "subcounts": {"mul_int_ans": 8, "div_int_ans": 8},
        },
    },
    # 14級：分数 四則混合
    # Phase 1（2026-05-07）: 30→50題化、Band D を新設して 4 Band 構成に。
    # Phase 2 Wave 1（2026-05-26）: 50→100 題化、単純倍化（各 Band count 2 倍 + Band D subcounts 2 倍）。
    # 事前 probe で 10.7-12.5x unique margin が確認できたため安全。
    # ふくちさん教育的判断（36年塾長経験）:
    #   - A: 2項 四則混合 24 問（既存ロジック踏襲）
    #   - B: 3項 四則混合 括弧なし 28 問（既存ロジック踏襲、単元の主役）
    #   - C: 3項 四則混合 括弧あり（先頭カッコのみ）24 問（既存ロジック踏襲）
    #   - D: 整数を含む混合 24 問（小学校算数の核心パターン補完）
    # 「分数の四則混合は中学数学の躓きの根本原因」哲学に基づき、
    # 小学校算数で必須の「整数 ± 分数」「整数 × 分数」「整数 ÷ 分数」を
    # Band D として量で確保（rank_15 Band A frac_int との整合性も改善）。
    14: {
        "A": {"count": 24, "kind": "two_term", "denom_max": 10},
        "B": {"count": 28, "kind": "three_term_no_parens", "denom_max": 8},
        "C": {"count": 24, "kind": "three_term_parens", "denom_max": 8},
        # Band D: 整数を含む混合。slot_index 駆動で 3 サブパターンを決定論的に分離。
        #   int_addsub: 整数 ± 分数（8 問）— 例 3 - 5/6 = 13/6
        #   int_mul:    整数 × 分数（8 問）— 例 6 × 2/3 = 4（約分が活きる組を多めに）
        #   int_div:    整数 ÷ 分数（8 問）— 例 3 ÷ 1/4 = 12（逆数倍の理解）
        # 整数の位置（先頭/末尾）は両方含む。
        "D": {
            "count": 24, "kind": "int_with_frac",
            "denom_max": 8, "int_max_addsub": 10, "int_max_muldiv": 12,
            "subcounts": {"int_addsub": 8, "int_mul": 8, "int_div": 8},
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
    # Phase 2 Wave 2（2026-05-26）: 50→100 題化、Band A の denom_max 10→14 拡張で unique 184→672（22.4x margin）。
    # 既存 Band B/C/D は probe で 72x〜196x margin 確認済、単純倍化のみ。
    # subcounts も倍化。
    16: {
        "A": {
            "count": 30, "same_denom": True, "terms": 2, "denom_max": 14,
            "subcounts": {"add": 16, "sub": 14, "int_ans": 4},
        },
        "B": {
            "count": 30, "same_denom": False, "terms": 2, "denom_max": 12,
            "subcounts": {"easy_lcm": 10, "medium_lcm": 10, "hard_lcm": 10},
        },
        "C": {
            "count": 20, "same_denom": False, "terms": 2, "denom_max": 15,
            "subcounts": {"medium_lcm": 10, "hard_lcm": 10},
        },
        "D": {
            "count": 20, "kind": "three_term_addsub", "terms": 3, "denom_max": 8,
            "subcounts": {"all_add": 10, "add_sub_mix": 10},
        },
    },
    # 13級：正負の数 加減
    # Phase 1（2026-05-05）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。
    # Phase 2 Wave 1（2026-05-26）: 50→100 題化、単純倍化（パラメータ無修正、count のみ 2 倍）。
    # 事前 probe で 7.5-13.6x unique margin が確認できたため安全。
    # ふくちさん教育的判断（36 年塾長経験、中1 1学期前半の最入門単元）:
    #   - A: 括弧付き同符号 24 問（既存ロジック踏襲）
    #   - B: 括弧付き混合符号 24 問（既存ロジック踏襲、躓きポイント）
    #   - C: 括弧なし 22 問（既存ロジック踏襲、max_abs=99 で 2 桁同士の暗算）
    #   - D: 3 項加減 30 問（紙教材で扱う中1 加減の最終形）
    # 中1 加減の山場「3 項計算」が旧構成では完全に欠落していたため Phase 1 で
    # Band D を新設（rank_05/06/08/01 と同じ Band D 新設パターン）。
    # TODO_PHASE3: 小数・分数の混合、カッコ + カッコなし混在は Phase 3 で導入。
    13: {
        "A": {"count": 24, "kind": "paren",   "max_abs": 9,  "terms": 2, "same_sign_only": True},
        "B": {"count": 24, "kind": "paren",   "max_abs": 9,  "terms": 2, "same_sign_only": False},
        "C": {"count": 22, "kind": "noparen", "max_abs": 99, "terms": 2, "same_sign_only": False},
        "D": {"count": 30, "kind": "three_term_addsub", "max_abs": 9},
    },
    # 12級：正負の数 乗除
    # Phase 1（2026-05-05）: 30→50 題に拡充、Band B を構造改革（unique pool 24→48）。
    # Phase 2 Wave 2（2026-05-26）: 50→100 題化、Band B param 拡張 + ★ Band D 新設（累乗 + 乗除の混合）★
    # ふくちさん 2026-05-26 セッション明示判断：「累乗 + 乗除の混合を追加するのは大賛成。
    # なかなかこの手のものを練習できるものは無いけれど地味に大事な部分。
    # あくまでこれは中1範囲のカテゴリー。全体の中でこのタイプが1割くらいあると嬉しい。」
    # ふくちさん教育的判断（36 年塾長経験）:
    #   - A: 1 桁 2 項 ×/÷ 30 問（既存ロジック踏襲、probe 10x margin 確認済）
    #   - B: 累乗 30 問（slot_index 駆動 3 サブパターン、max_abs 9→13、exp_max 3→4、max_result 1000→2000）
    #     - subcounts={"paren_neg":10, "leading_minus":10, "positive":10}
    #     - 教育的並び: slot 0/1/2 で (-3)²/-3²/3² が並ぶ interleave 方式
    #     - 拡張後 unique pool ≈ 28/pattern × 3 = 84 (2.8x margin)
    #   - C: 3 項 ×/÷ 30 問（既存ロジック踏襲、probe 147x margin 確認済）
    #   - ★ D: 累乗 + 乗除の混合 10 問（新設、ふくちさん 2026-05-26 教育判断）
    #     - subcounts={"pow_op_int":6, "pow_op_int_op_int":4}
    #     - 中1範囲のみ（中2 式計算と地続きにしない）、累乗 → 乗除 の二段階を意識的に練習
    #     - 累乗形式は 3 形式（paren_neg/leading_minus/positive）を slot_index で interleave
    #     - 答えは整数を保証（÷ の右辺は被除数を割り切る整数）
    # 中1 乗除の山場「(-3)² と -3² の違い」を slot 駆動で意識的に並べることで
    # 教育効果を最大化する（生徒の 8 割が間違える典型ミス）。
    # TODO_PHASE3 消化（2026-05-26）：「累乗と乗除の混合（(-3)²×4）」を Phase 2 Wave 2 の Band D で実装済。
    # TODO_PHASE3 残：4 項以上、分数乗除は Phase 3 で導入。
    12: {
        "A": {"count": 30, "kind": "muldiv", "max_abs": 9, "terms": 2, "powers": False},
        "B": {
            "count": 30, "kind": "powers", "max_abs": 13, "exp_max": 4, "max_result_abs": 2000,
            "subcounts": {"paren_neg": 10, "leading_minus": 10, "positive": 10},
        },
        "C": {"count": 30, "kind": "muldiv", "max_abs": 9, "terms": 3, "powers": False},
        "D": {
            "count": 10, "kind": "power_muldiv",
            "max_abs_power": 5, "exp_max": 3, "max_abs_int": 9, "max_result_abs": 500,
            "subcounts": {"pow_op_int": 6, "pow_op_int_op_int": 4},
        },
    },
    # 11級：正負の数 四則混合（最難関級）
    # Phase 1（2026-05-05）: 30→50 題に拡充、Band C を slot_index 駆動化。
    # Phase 2 Wave 1（2026-05-26）: 50→100 題化、単純倍化（各 Band count 2 倍 + Band C subcounts 2 倍）。
    # 事前 probe で 6.8-8.0x unique margin が確認できたため安全。
    # ふくちさん教育的判断（36 年塾長経験）:
    #   - A: 2 項四則混合 30 問（既存ロジック踏襲、両正排除で 11 級らしさ維持）
    #   - B: 累乗を含む 2 項 30 問（既存ロジック踏襲）
    #   - C: 3 項 + 括弧 + 累乗 40 問（**slot_index 駆動の 2 サブパターン分離**）
    #     - subcounts={"inner_paren_x_power":20, "power_op_term_op_term":20}
    #     - 既存 P1/P2 を slot_index で決定論分離（rng.choice の偶然依存を解消）
    # 中1 1 学期後半の集大成、3 単元の最難関。
    # TODO_PHASE3: 4 項以上、分数係数、二重括弧は Phase 3 で導入。
    11: {
        "A": {"count": 30, "kind": "two_term_mixed",        "max_abs": 9},
        "B": {"count": 30, "kind": "with_power",            "max_abs": 5, "exp_max": 3},
        "C": {
            "count": 40, "kind": "three_term_paren_power", "max_abs": 5, "exp_max": 2,
            "subcounts": {"inner_paren_x_power": 20, "power_op_term_op_term": 20},
        },
    },
    # 8級：一次方程式・比例式
    # Phase 1（2026-05-05）: 30→50 題に拡充、Band D を新設して 4 Band 構成に。
    # Phase 2 Wave 2（2026-05-26）: 50→100 題化、単純倍化（既存 param で全 Band probe 43x〜9000x margin 確認済）。
    # Band D subcounts も倍化（light=4 / standard=12 / heavy=4）。
    # ふくちさん教育的判断（36年塾長経験）:
    #   - A: ax=b の最易レベル 10 問（x_max=12、coef_max=10、unique 432 pool）
    #   - B: ax+b=cx+d の標準（移項の脱落ポイント）50 問（unique 9208 pool）
    #   - C: 比例式 20 問（value_max=15、unique 582 pool）
    #   - D: カッコ付き 20 問（軽め4 / 標準12 / 重め4 を slot_index 駆動で決定論的分離）
    # 中1 一次方程式の核心は「移項」と「カッコの展開」。旧構成は B のパターンしかなく、
    # カッコ付きの問題（中1 単元の山場）が一切なかったため Phase 1 で Band D を新設し、
    # 教育的ギャップを解消する（rank_05 / rank_06 で Band D 新設したのと同パターン）。
    # Band D の subcounts: 軽め (a(x+b)=c) は導入用に少量、標準 (a(x+b)=c(x+d)) は単元の主役、
    # 重め (a(x+b)-c(x+d)=e) は応用として少量という塾長判断。
    # TODO_PHASE3: 小数係数・分数係数の方程式は Phase 3 の Band E 以降で導入。
    8: {
        "A": {"count": 10, "kind": "ax_eq_b", "coef_max": 10, "x_max": 12},
        "B": {"count": 50, "kind": "ax_b_eq_cx_d", "coef_max": 6, "const_max": 12},
        "C": {"count": 20, "kind": "proportion", "value_max": 15},
        "D": {
            "count": 20,
            "kind": "paren_form",
            "coef_max": 6, "const_max": 8, "x_max": 8,
            "subcounts": {"light": 4, "standard": 12, "heavy": 4},
        },
    },
    # 7級：式の計算 中2
    7: {
        # Phase 1（2026-04-30）: 30→50題化、Band C を 3 サブパターン分離
        # Phase 2 Wave 1（2026-05-26）: 50→100 題化、単純倍化（各 Band count 2 倍 + Band C subcounts 2 倍）。
        # 事前 probe で 8x unique margin が確認できたため安全。
        # A: 多項式の加減 34 問
        # B: 多項式 × 整数 or 多項式 ÷ 整数 34 問
        # C: 単項式の乗除と累乗 32 問（slot_index 駆動の決定論的サブパターン分離）
        #    subcounts={"power":10, "mono_mul":12, "mono_div":10}（Phase 1 比率維持、
        #    mono_mul を 2 問多めに）
        #      - power     : 既存の (coef·var)^exp 単項式の累乗
        #      - mono_mul  : 単項式×単項式（同変数 / 異変数 両対応）
        #      - mono_div  : 単項式÷単項式（整数結果と分数結果両方）
        # 教育的拡充: 旧構成では中2 文字式の核「単項式の乗除」が抜けていたため Phase 1 で網羅。
        "A": {"count": 34, "kind": "poly_addsub", "coef_max": 6, "const_max": 8},
        "B": {"count": 34, "kind": "poly_int_muldiv", "coef_max": 5, "const_max": 8, "factor_max": 6},
        "C": {
            "count": 32,
            "kind": "mono_mixed",
            "coef_max": 5, "exp_max": 3,  # power サブパターン用に保持
            "subcounts": {"power": 10, "mono_mul": 12, "mono_div": 10},
        },
    },
    # 5級：式の計算 中3（多項式の展開）
    # Phase 1（2026-04-30）: 30→50題化、Band D を新設して 4 Band 構成に。
    # Phase 2 Wave 2（2026-05-26）: 50→100 題化、Band D の coef_max 5→7 拡張で unique 48→72（3.0x margin）。
    # A/B/C は probe で 31x〜365x margin 確認済、単純倍化で安全。
    5: {
        # A: (ax+b)(cx+d) — 基本展開（a, c は ±1〜±2）。Band A のみ (a,b)<=(c,d) 辞書順正規化
        # B: (ax+b)(cx+d) — 一般係数（a, c, b, d は ±1〜±5）
        # C: 3項 × 2項（trinomial × binomial）
        # D: (ax+b)² — 係数付き平方公式の直接展開（a ∈ [2,7]、Phase 2 で a の上限拡張）
        # 教育的根拠（ふくちさん 36 年の塾長経験）：
        #   (ax+b)² は中3生がミスしやすい典型パターン
        #   - (2x)² を 2x² と書く（正しくは 4x²）
        #   - 中央項の係数倍を忘れる（2·2x·3 = 12x）
        #   - 係数の二乗処理を忘れる
        #   公式記憶の rank_04 (x+a)² と差別化し、直接展開で量を確保する単元
        "A": {"count": 26, "kind": "two_by_two_simple", "coef_max": 2, "const_max": 5},
        "B": {"count": 26, "kind": "two_by_two_general", "coef_max": 5, "const_max": 6},
        "C": {"count": 24, "kind": "trinomial_by_binomial", "coef_max": 3, "const_max": 5},
        "D": {"count": 24, "kind": "square_with_coef", "coef_max": 7, "const_max": 6},
    },
    # 4級：乗法公式
    # Phase 1（2026-04-30）: 30→50題化、3 Band 構成。const_max=12（紙教材準拠）。
    # Phase 2 Wave 3（2026-05-26）: 50→100題化、★ Band D 新設（多変数化 4 パターン）★
    #   ふくちさん指示「rank_04 Band D は候補 A（多変数化）」
    #   完全に中3 教科書範囲内、2 変数 (x, y) の乗法公式：
    #     - (x+y)(x-y) → x² - y²              （xy_basic、slot 0 固定、最も基本）
    #     - (x+ay)(x-ay) → x² - a²y²          （xy_diff_coef、a∈[2..5]、4 問）
    #     - (ax+by)² → a²x² + 2abxy + b²y²    （xy_square、a∈[2..5], b∈±[1..5]、7 問）
    #     - (ax+by)(ax-by) → a²x² - b²y²      （xy_diff_double、a∈[2..5], b∈[1..5]、8 問）
    # const_max は 12→15 に拡張：
    #   B (type_square) unique 24→30、C (type_diff_squares) unique 12→15
    #   配分 A=45/B=20/C=15/D=20 = 100
    #   - A=45 (probe 大量 unique、十分)
    #   - B=20 (margin 1.5x、dedup retry でカバー可能)
    #   - C=15 (margin 1.0x、各 a に対し 1 問のみ = unique 限界)
    #   - D=20 (Pattern 1=1 固定 + 2=4 + 3=7 + 4=8)
    # TODO_PHASE2 → 消化済（Band D 新設で 100 題化達成）
    4: {
        "A": {"count": 45, "kind": "type_xab", "const_max": 15},
        "B": {"count": 20, "kind": "type_square", "const_max": 15},
        "C": {"count": 15, "kind": "type_diff_squares", "const_max": 15},
        "D": {
            "count": 20,
            "kind": "type_multivar",
            "subcounts": {
                "xy_basic": 1,           # (x+y)(x-y) — slot 0 固定、教科書最基本形
                "xy_diff_coef": 4,       # (x+ay)(x-ay) a∈[2..5]
                "xy_square": 7,          # (ax+by)² a∈[2..5], b∈±[1..5]
                "xy_diff_double": 8,     # (ax+by)(ax-by) a∈[2..5], b∈[1..5]
            },
        },
    },
    # 3級：因数分解
    # Phase 1（2026-04-30）: 30→50題化、Band C を 3 サブパターン分離
    # Phase 2 Wave 3（2026-05-26）: 50→100題化、param 拡張のみ（新 Band なし）
    #   ふくちさん指示「たすき掛けは高校範囲なので、たすき掛け自体をここでは出題しない」
    #   （CLAUDE.md でも「中学範囲外として永久温存」明記）→ Band D 新設は中止。
    #   Band A/B/C を param 拡張で対応：
    #     A: factor_max 9→12, term_max 6→8（unique 1886, margin 62.9x）
    #     B: root_max 9→12（unique 276, margin 9.2x）
    #     C: const_max 12→20（unique 各 sub 20、計画提示の 15 では subcounts 不足のため拡張）
    #        中3 因数分解で a∈[1..20]、a²=400 までは紙教材範囲内（教育的妥当性 OK）
    # A: 共通因数のみ：ax + ay = a(x + y)
    # B: x² + bx + c → (x + m)(x + n)
    # C: x² - a² または x² ± 2ax + a²（完全平方、3 サブパターン）
    # ❌ TODO_PHASE3 から「たすき掛け」を削除（ふくちさん 2026-05-26 確定、中学範囲外として永久温存）
    # Band C の subcounts: ふくちさん教育的判断「差の平方は見分けが簡単で思考量が少ない」を反映し
    #   diff を少なめ、perfect_pos/neg は均等。
    #   比率 6:11:11 を維持して 9:15:16 = 40 にスケール（各 margin 1.25x 以上）
    3: {
        "A": {"count": 30, "kind": "common_factor", "factor_max": 12, "term_max": 8},
        "B": {"count": 30, "kind": "trinomial_simple", "root_max": 12},
        "C": {
            "count": 40,
            "kind": "diff_or_perfect_square",
            "const_max": 20,
            "subcounts": {"diff": 9, "perfect_pos": 15, "perfect_neg": 16},
        },
    },
    # 2級：平方根
    # Phase 1（2026-04-30）: 30→50題化、Band C を 3 サブパターン分離
    # Phase 2 Wave 3（2026-05-26）: 50→100題化、param 拡張のみ（新 Band なし）
    #   ふくちさん指示「複雑な有理化（1/(√3+1) 等）は埼玉県高校入試の『学校選択問題』
    #   レベルなので、ここでは出題しない」→ Band D 新設は中止。
    #   Band A/B/C を count 拡張で対応：
    #     A: n_max=200 維持、unique 65 で count 25（margin 2.6x、入門段階）
    #     B: coef_max=5, n_max=50 で unique 5484、count 35（margin 156x、余裕大）
    #     C: subcounts を mul:16, rationalize:12, div:12 にスケール、count 40
    #        各 sub の unique pool: mul=166, rationalize=56, div=426（全 sub 4x+ margin）
    # A: 簡約のみ √n → a√b
    # B: 簡約 + 加減 (a√b ± c√d → 同じ b に統一)
    # C: 乗除 と 有理化（subcounts={mul:16, rationalize:12, div:12} = 40）
    #    教育的引き締め（rank_02_sqrt.py の各 generator に実装）:
    #      - mul: subslot=5 のみ a,b ∈ [16,30] の刺激範囲。Wave 3 拡大後も subslot 5 のみ刺激維持
    #      - rationalize: b ∈ {2,3,5,6,7,10}（square-free）/ a ∈ [1,12]
    #      - div: 答えの denom ≤ 12 を制約、極端な radicand を排除
    # ❌ TODO_PHASE3 から「複雑な分子分母 1/(√3+1)」を削除
    #    （ふくちさん 2026-05-26 確定、学校選択問題レベルなので中学範囲外として永久温存）
    # TODO_PHASE3 残：二重根号 √(5+2√6) は高校範囲のため Phase 3 でも導入しない可能性あり
    2: {
        "A": {"count": 25, "kind": "simplify_only", "n_max": 200},
        "B": {"count": 35, "kind": "addsub_with_simplify", "coef_max": 5, "n_max": 50},
        "C": {
            "count": 40,
            "kind": "muldiv_rationalize",
            "n_max": 30,
            "subcounts": {"mul": 16, "rationalize": 12, "div": 12},
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
    # Phase 2 Wave 3（2026-05-26）: 50→100 題化、★ Band E 新設（解の公式 a∈[2..7]） ★
    # ふくちさん指示「解の公式にぶっこんで解く問題なので、a はいくつでも良い」
    # → 既存 Band C は a∈[1..2]（易しめ）を維持、Band E で a∈[2..7] に拡張して
    #   解の公式の計算負荷を体感させる教育目的。
    # 各 Band の probe 結果（margin、target 比）：
    #   A double_root=1 margin 18x / with_zero=1 margin 18x / normal=23 margin 6.7x
    #   B x2_eq_c=10 margin 3.0x
    #   C k_eq_1=17 margin 5.9x / k_gt_1=8 margin 13.4x
    #   D with_p=10 margin 4.0x / ax2_eq_c=10 margin 2.0x
    #   E k_eq_1=13 margin 15x+ / k_gt_1=7 margin 28x+（a∈[2..7] で unique 大幅増）
    1: {
        "A": {
            "count": 25,
            "kind": "factorable_int",
            "max_root": 9,
            "subcounts": {"double_root": 1, "with_zero": 1, "normal": 23},
        },
        "B": {"count": 10, "kind": "x2_eq_c"},
        "C": {
            "count": 25,
            "kind": "irrational",
            "max_a": 2, "max_bc": 5, "max_bc_kgt1": 12,
            "subcounts": {"k_eq_1": 17, "k_gt_1": 8},
        },
        "D": {
            "count": 20,
            "kind": "sqrt_method",
            "subcounts": {"with_p": 10, "ax2_eq_c": 10},
        },
        # Band E（Phase 2 Wave 3 新設）：解の公式 a∈[2..7]。
        # 既存 _gen_irrational に min_a=2 オプションを追加して流用。
        # 教育目的：a≥2 の二次方程式は中3 受験対策で頻出、解の公式の計算負荷を体感させる。
        # TODO_PHASE3 消化：「解の公式 a >= 3」を 1 つ消化（a∈[2..7] で網羅）。
        "E": {
            "count": 20,
            "kind": "irrational",
            "min_a": 2, "max_a": 7, "max_bc": 5, "max_bc_kgt1": 12,
            "subcounts": {"k_eq_1": 13, "k_gt_1": 7},
        },
    },
    # 6級：連立方程式
    6: {
        # Phase 1（2026-05-04）: 30→50題化、Band D を新設して 4 Band 構成に。
        # Phase 2 Wave 1（2026-05-26）: 50→100 題化、単純倍化（パラメータ無修正、count のみ 2 倍）。
        # 事前 probe で 5-30x unique margin が確認できたため安全。
        # ふくちさん教育的判断（36年塾長経験）:
        #   - A: 最易レベル導入 10 問（rank_08 と同思想）coef_max を 3→4 に拡張、整数解
        #   - B: 標準加減法 40 問（単元の主役、既存ロジック踏襲）
        #   - C: 分数解 20 問（sol_denom_max 4→5 で 1/5, 2/5 を追加）
        #   - D: 代入法向け 30 問（新設、単元の山場の半分）
        # 中2連立方程式の核心は「加減法 vs 代入法 を選び分ける訓練」。
        # 旧構成は加減法しか練習できなかったため Phase 1 で代入法 Band D を新設し、
        # 教育的ギャップを解消する（rank_05 で Band D 新設したのと同パターン）。
        "A": {"count": 10, "kind": "simple_int",     "coef_max": 4, "sol_max": 5},
        "B": {"count": 40, "kind": "general_int",    "coef_max": 6, "sol_max": 8},
        "C": {"count": 20, "kind": "frac_solution",  "coef_max": 5, "sol_denom_max": 5},
        "D": {"count": 30, "kind": "substitution_form", "coef_max": 5, "sol_max": 6},
    },
    # 10級：単位・比・割合（10 問固定スロット構造）
    # Phase 1（2026-05-06）: 30 → 50 題に拡充（10 スロット維持 + count 増加 + 弱 slot 補強）。
    # Phase 2 Wave 1（2026-05-26）: 50 → 100 題化、10 スロット構造維持（CLAUDE.md #211 教訓）。
    # 単純倍化（slot rotation で自動的に各 slot のカバレッジが約 2 倍に）。
    # ふくちさん教育的判断（36 年塾長経験）+ 事前調査で確定（案 A 採用）:
    #   - 10 スロット固定構造は Phase 2 グループ③で確立した教育設計（slot 順 = 教科書順）。
    #     **再編せず、count 倍化のみで対応**（CLAUDE.md #211 「rank_10 のような N 問固定スロット
    #     構造は教育設計の核心、無闇に Band 構造へ再編しない」）
    #   - count=34/34/32 で main.py の slot rotation により以下のように展開:
    #       count=34 → slot 1..10 × 3, 1..4（slot 1..4 が 4 問、slot 5..10 が 3 問）
    #       count=32 → slot 1..10 × 3, 1..2（slot 1..2 が 4 問、slot 3..10 が 3 問）
    #   - slot 6 (時間) は Band C で時刻表記「1 時間 30 分 = 90 分」を新規追加（unique 16+）
    #   - slot 7 (速さ) は Band B/C の cases リスト拡張で構造的バグ修正
    #     （旧 unique=3, 4 → 拡張後 unique 10+、教育的に時速 240km まで含める）
    # 既存生徒側機能への影響なし（generator のロジック本体は無修正、cases リストの拡張のみ）。
    # 事前 probe（dedup retry 込み）で 100% unique 達成を確認。
    10: {
        "A": {"count": 34, "complexity": "easy"},
        "B": {"count": 34, "complexity": "medium"},
        "C": {"count": 32, "complexity": "hard"},
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
    # Phase 2 Wave 2（2026-05-26）: 50→100 題化、B/C の param 拡張で unique pool 不足解消。
    #   - Band A: subcounts 倍化（two_term=14, three_term=6, with_const=6）、probe 56x margin
    #   - Band B: coef_max 5→7、const_max 5→8 拡張（100→224 unique、8.6x margin）
    #   - Band C: coef_max 6→9 拡張（160→400 unique、18x margin）
    #   - Band D: 単純倍化（probe 183x margin）
    9: {
        "A": {
            "count": 26, "kind": "like_terms", "coef_max": 9, "const_max": 7,
            "subcounts": {"two_term": 14, "three_term": 6, "with_const": 6},
        },
        "B": {"count": 26, "kind": "distribute",      "coef_max": 7, "const_max": 8},
        "C": {"count": 22, "kind": "monomial_muldiv", "coef_max": 9},
        "D": {"count": 26, "kind": "paren_addsub",    "coef_max": 5, "const_max": 7},
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
