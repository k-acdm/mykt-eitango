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
    # 15級：分数 乗除
    15: {
        # A: 分数 × 整数 / 分数 ÷ 整数
        # B: 分数 × 分数 / 分数 ÷ 分数
        # C: 3項 乗除（混合）
        "A": {"count": 10, "kind": "frac_int", "denom_max": 10, "int_max": 10},
        "B": {"count": 10, "kind": "frac_frac", "denom_max": 10},
        "C": {"count": 10, "kind": "three_term", "denom_max": 8},
    },
    # 14級：分数 四則混合
    14: {
        # A: 2項 四則混合
        # B: 3項 四則混合（括弧なし、優先順位）
        # C: 3項 四則混合（括弧あり）
        "A": {"count": 10, "kind": "two_term", "denom_max": 10},
        "B": {"count": 10, "kind": "three_term_no_parens", "denom_max": 8},
        "C": {"count": 10, "kind": "three_term_parens", "denom_max": 8},
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
    # 8級：一次方程式・比例式
    8: {
        # A: ax = b（DESIGN_PRINCIPLES.md 原則 2 により整数解のみ。x_max が解の絶対値上限）
        # B: ax + b = c または ax + b = cx + d
        # C: 比例式 a:b = c:x（DESIGN_PRINCIPLES.md 原則 2 により x が整数になる組のみ）
        "A": {"count": 10, "kind": "ax_eq_b", "coef_max": 9, "x_max": 9},
        "B": {"count": 10, "kind": "ax_b_eq_cx_d", "coef_max": 6, "const_max": 12},
        "C": {"count": 10, "kind": "proportion", "value_max": 12},
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
        # A: (ax+b)(cx+d) — 基本展開（a, c は ±1〜±2）
        # B: (ax+b)(cx+d) — 一般係数（a, c, b, d は ±1〜±5）
        # C: 3項 × 2項（trinomial × binomial）
        "A": {"count": 10, "kind": "two_by_two_simple", "coef_max": 2, "const_max": 5},
        "B": {"count": 10, "kind": "two_by_two_general", "coef_max": 5, "const_max": 6},
        "C": {"count": 10, "kind": "trinomial_by_binomial", "coef_max": 3, "const_max": 5},
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
    1: {
        # A: 因数分解で解ける整数解（重解含む）
        # B: 因数分解で解ける有理数解 or x² = c のシンプルな無理数解
        # C: 解の公式必須の無理数解（(p ± √d)/q 形式）
        "A": {"count": 10, "kind": "factorable_int", "max_root": 7},
        "B": {"count": 10, "kind": "rational_or_simple_sqrt", "max_root": 5, "max_a": 3},
        "C": {"count": 10, "kind": "irrational", "max_a": 2, "max_bc": 5},
    },
    # 6級：連立方程式
    6: {
        # A: 簡単な整数係数（DESIGN_PRINCIPLES.md 原則 2 で coef_max=3 に縮小）
        # B: 中程度（係数大きめ、整数解）
        # C: 解が分数になるケースを許容
        "A": {"count": 10, "kind": "simple_int", "coef_max": 3, "sol_max": 5},
        "B": {"count": 10, "kind": "general_int", "coef_max": 6, "sol_max": 8},
        "C": {"count": 10, "kind": "frac_solution", "coef_max": 5, "sol_denom_max": 4},
    },
    # 10級：単位・比・割合（10問固定スロット構造）
    # 各 Band で 10 問生成、スロット 1〜10 を 1 問ずつ。
    10: {
        "A": {"count": 10, "complexity": "easy"},
        "B": {"count": 10, "complexity": "medium"},
        "C": {"count": 10, "complexity": "hard"},
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
