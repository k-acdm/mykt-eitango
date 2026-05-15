/**
 * マイ活アプリ - Code.gs
 */

const APP_TITLE       = 'マイ活アプリ＜英単語＞';
const SHEET_STUDENTS  = 'Students';
const SHEET_QUESTIONS = 'Questions';
const SHEET_ATTEMPTS  = 'Attempts';
const SHEET_Q5        = 'Question5';
const SHEET_HPLOG     = 'HPLog';
const SHEET_EXCHANGES = 'Exchanges';
const SHEET_QUOTE   = 'Quote';
const SHEET_NOTICE  = 'Notice';
const SHEET_SANGO_TOPICS      = 'SangoTopics';
const SHEET_SANGO_SUBMISSIONS = 'SangoSubmissions';
const SHEET_WABUN1_TOPICS      = 'Wabun1Topics';
const SHEET_WABUN1_SUBMISSIONS = 'Wabun1Submissions';
const SHEET_KISO_QUESTIONS = 'KisoQuestions';
const SHEET_KISO_SESSIONS  = 'KisoSessions';
const SHEET_KISO_PHOTOS    = 'KisoPhotos';
const SHEET_LISON_CONTENTS    = 'LisonContents';
const SHEET_LISON_SUBMISSIONS = 'LisonSubmissions';
const SHEET_TEACHERS          = 'Teachers';
const SHEET_TEACHER_MESSAGES  = 'TeacherMessages';
const SHEET_MESSAGE_READS     = 'MessageReads';
// SpecialAccounts シート（Step 1：2026-05-09 新設）
//   テスト枠 / 先生枠 / 招待枠 / 体験枠 を Students から分離管理する。
//   Step 1 ではシート新規作成 + Students 1001〜1010 をコピーのみ（Students は無変更）。
//   統合読み込みは Step 2、Students 削除は Step 4 以降。
const SHEET_SPECIAL_ACCOUNTS  = 'SpecialAccounts';
// Phase 4：講師の操作ログ（admin の監査用、永久保存）。_ensureSheetWithHeaders で自動作成される。
const SHEET_TEACHER_ACTIONS   = 'TeacherActions';
// accountType 列に入る値（最右列。Students の列構成に追加される列）
const SPECIAL_ACCOUNT_TYPES = {
  TEST:       'test',          // 1001〜1099 テスト枠
  TEACHER:    'teacher',       // 2001〜2099 先生枠
  INVITED:    'invited',       // 3001〜3099 招待枠
  EXPERIENCE: 'experience'     // 4001〜4099 体験枠（将来用）
};
const SPECIAL_ACCOUNT_TYPE_HEADER = 'accountType';

const COL_ID         = 0;
const COL_NAME       = 1;
const COL_NICKNAME   = 2;
const COL_CLEARED    = 3;
const COL_UPDATED    = 4;
const COL_HP         = 5;
const COL_STREAK     = 6;  // ログイン連続日数
const COL_LAST_TEST  = 7;
const COL_LAST_LOGIN = 8;

const LEVEL_ORDER     = ['5級', '4級', '3級', '準2級', '2級', '準1級'];
const EXCHANGE_RANKS  = {
  bronze:   { label: 'ブロンズ',   hp: 30000 },
  silver:   { label: 'シルバー',   hp: 120000 },
  gold:     { label: 'ゴールド',   hp: 400000 },
  platinum: { label: 'プラチナ',   hp: 1200000 },
  diamond:  { label: 'ダイヤ',     hp: 3500000 },
  legend:   { label: 'レジェンド', hp: 10000000 },
};

function _ss()       { return SpreadsheetApp.getActiveSpreadsheet(); }
function _todayJST() { return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd'); }
function _nowJST()   { return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'); }

// =============================================
// 教育日（連続日数判定用の「1日」） — 4:00 AM JST 区切り
// =============================================
// 用途: 連続日数（streak）判定の "今日" を 4:00 AM JST 区切りで返す。
//       深夜まで学習している生徒が 0:00 を跨いで再ログインしても streak が
//       過剰加算されないようにするための仕組み。
// 適用開始: 2026-04-27 00:00 JST 以降のみ新ロジックを適用。それ以前は
//           既存の _todayJST() と完全に同じ挙動（4/26 中の復旧作業との互換性のため）。
// 切替時刻: JST 04:00。0:00〜03:59 JST は前日の教育日。
// 例:
//   2026-04-27 03:30 JST → 教育日 '2026-04-26'（前日扱い）
//   2026-04-27 04:00 JST → 教育日 '2026-04-27'
//   2026-04-26 23:00 JST → 教育日 '2026-04-26'（旧ロジック、cutoff 前なので _todayJST と同じ）
//   2026-04-27 00:00 JST → 教育日 '2026-04-26'（cutoff 後の新ロジック、hour=0 なので前日扱い）
//   ※ 上記 23:00 と 00:00 で同じ教育日になり、跨いだ再ログインで streak が壊れない

// 教育日システムの適用開始時刻（2026-04-27 00:00 JST = 2026-04-26 15:00 UTC）
const EDU_DAY_CUTOVER_MS = Date.UTC(2026, 3, 26, 15, 0, 0);  // JS の月は 0-based: 3=April

function _todayEducationalJST() {
  const now = new Date();
  // 適用開始前: 旧ロジック完全互換
  if (now.getTime() < EDU_DAY_CUTOVER_MS) {
    return _todayJST();
  }
  // 適用開始後: JST 04:00 区切り
  const jstHour = parseInt(Utilities.formatDate(now, 'Asia/Tokyo', 'H'), 10);
  if (jstHour < 4) {
    // 前日扱い: 24h 前の JST 日付を返す
    const yesterday = new Date(now.getTime() - 86400000);
    return Utilities.formatDate(yesterday, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  return Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
}

// 教育日基準の昨日（教育日 today から 1 日引く）
function _yesterdayEducationalJST() {
  const today = _todayEducationalJST();
  // 'yyyy-MM-dd' を JST 12:00 として解釈し、24h 引いて再フォーマット（DST 等の影響ゼロ）
  const d = new Date(today + 'T12:00:00+09:00');
  d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function _toDateStr(val) {
  if (!val) return '';
  try {
    var s = String(val);
    // 純粋な日付文字列（_todayJST() が返す 'yyyy-MM-dd' 形式、末尾なし）
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;
    // _nowJST() フォーマット 'yyyy-MM-dd HH:mm:ss'（タイムゾーンマーカーなし、JST 解釈で OK）
    if (s.match(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/)) return s.slice(0, 10);
    // それ以外（Date オブジェクト・ISO 8601 タイムゾーン付き文字列など）は JST に再フォーマット
    // ★ 4/24 Day 2 Stage 2 で導入されたキャッシュは Date を JSON.stringify するため
    //   ISO UTC 文字列 (例 "2026-04-25T15:00:00.000Z") として戻ってくる。
    //   旧実装は anchor 不足の正規表現で先頭 10 文字を slice しており、
    //   JST 0:00 を UTC で表現すると 1 日前になるため off-by-one が発生していた（連続日数バグの根本原因）。
    return Utilities.formatDate(new Date(val), 'Asia/Tokyo', 'yyyy-MM-dd');
  } catch(e) { return String(val).slice(0, 10); }
}
function _props() { return PropertiesService.getScriptProperties(); }

// =============================================
// パフォーマンス共通ヘルパー
// =============================================
// シートの末尾 N 行を返す（追記専用シート向け：最新の行を最小コストで読む）
// ヘッダー行はスキップし、データ行のみ返す。N が実データ行数より大きい場合は全データ行を返す。
function _readLastNRows(sh, n) {
  if (!sh) return [];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const numRead = Math.min(last - 1, Math.max(0, n|0));
  if (numRead <= 0) return [];
  return sh.getRange(last - numRead + 1, 1, numRead, sh.getLastColumn()).getValues();
}

// キャッシュヒット/ミス診断ログ（DEBUG_CACHE プロパティが '1' の時のみ出力）
// GAS エディタから有効化: PropertiesService.getScriptProperties().setProperty('DEBUG_CACHE','1')
// 有効化後、各リクエストの実行ログ（Executions パネル）に [cache HIT/MISS/INV] として出力される
// 性能影響を抑えるため、PropertiesService 読み取りは 1 リクエストあたり 1 回に抑制
// （GAS は各 doGet 呼び出しで var を再評価するので、リクエスト境界で自動リセット）
var _debugCacheFlag = null;  // null = 未取得 / true = on / false = off
function _cacheLog(key, kind, extra) {
  try {
    if (_debugCacheFlag === null) {
      _debugCacheFlag = (_props().getProperty('DEBUG_CACHE') === '1');
    }
    if (!_debugCacheFlag) return;
    if (kind === 'hit')             console.log('[cache HIT]  ' + key);
    else if (kind === 'miss')       console.log('[cache MISS] ' + key + (extra ? ' ' + extra : ''));
    else if (kind === 'invalidate') console.log('[cache INV]  ' + key);
    else if (kind === 'update')     console.log('[cache UPD]  ' + key + (extra ? ' ' + extra : ''));
  } catch(e) { /* ログ失敗でリクエストは絶対に落とさない */ }
}

// CacheService 経由で値を取得。hit すれば JSON.parse、miss なら loader() で取得 → キャッシュ
// value のシリアライズが 95KB を超える場合はキャッシュをスキップ（Script Cache の 100KB/key 制限対応）
function _getCachedValues(key, ttlSec, loader) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) {
    _cacheLog(key, 'hit');
    try { return JSON.parse(hit); } catch(e) { /* 破損キャッシュは無視 */ }
  }
  const val = loader();
  try {
    const ser = JSON.stringify(val);
    if (ser.length < 95000) {
      cache.put(key, ser, ttlSec || 21600);
      _cacheLog(key, 'miss', 'put=' + ser.length + 'B');
    } else {
      console.warn('[cache skip >95KB]', key, 'size=' + ser.length);
      _cacheLog(key, 'miss', 'skip>95KB');
    }
  } catch(e) {
    console.error('[cache put error]', key, e);
  }
  return val;
}

// 指定キーのキャッシュを 1 件クリア
function _invalidateCache(key) {
  try {
    CacheService.getScriptCache().remove(key);
    _cacheLog(key, 'invalidate');
  } catch(e) { /* ignore */ }
}

// 指定キー群をまとめてクリア
function _invalidateCacheAll(keys) {
  try {
    CacheService.getScriptCache().removeAll(keys);
    if (keys && keys.forEach) keys.forEach(function(k){ _cacheLog(k, 'invalidate'); });
  } catch(e) { /* ignore */ }
}

// =============================================
// Students シートキャッシュ（Day 2 Stage 2 / G1）
// =============================================
// ログイン・提出・ニックネーム変更など書き込み系のホットパスが毎回全件読みで
// 300ms ほどかかっていたのを削減。TTL 6 時間。書き込み後は in-place で
// キャッシュを更新するため、次回読み取りも cache hit を維持できる。
function _getStudentsValues() {
  return _getCachedValues('cache_students_values', 21600, function() {
    const sh = _ss().getSheetByName(SHEET_STUDENTS);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getDataRange().getValues();
  });
}

// Students キャッシュを書き込み後に in-place 更新する
// - rowIdx: 0-based index（ヘッダー行含む / 行番号 - 1 ではなく getValues() の添字）
// - updates: { [colIdx]: newValue, ... }（colIdx は 0-based 列番号）
// - キャッシュ未保持（miss 済 or 未取得）なら no-op。次回 read で fresh に取得される
// - JSON シリアライズが 95KB を超える場合は invalidate にフォールバック
// - 例外時は invalidate にフォールバック（データ不整合を残さない）
function _updateStudentsCacheRow(rowIdx, updates) {
  const KEY = 'cache_students_values';
  try {
    const cache = CacheService.getScriptCache();
    const hit = cache.get(KEY);
    if (!hit) return; // 未保持 → 次回 read で miss → 再取得でよい
    const values = JSON.parse(hit);
    if (!values[rowIdx]) return;
    Object.keys(updates).forEach(function(k){
      values[rowIdx][parseInt(k, 10)] = updates[k];
    });
    const ser = JSON.stringify(values);
    if (ser.length < 95000) {
      cache.put(KEY, ser, 21600);
      _cacheLog(KEY, 'update', 'row=' + rowIdx);
    } else {
      cache.remove(KEY);
      _cacheLog(KEY, 'invalidate', 'update skip: size=' + ser.length);
    }
  } catch(e) {
    try {
      CacheService.getScriptCache().remove(KEY);
      _cacheLog(KEY, 'invalidate', 'update failed: ' + e);
    } catch(_) {}
  }
}

// =============================================
// 行シフト事故防止ヘルパー（2026-05-09 Step 0：SpecialAccounts 化前の地ならし）
// =============================================
// 背景：2026-05-08 の Students シート行追加事故と同種の事故を絶対に起こさない
//       ため、書き込み系コードは「行番号ベース」から「生徒IDベース」に統一する。
//       事故の機序：cache（_getStudentsValues）が stale な状態で、cache 上の
//       行 index `i` をそのままシートの `i+1` 行への書き込み先として使うと、
//       ふくちさんが手元でシートに行を追加していた場合に既存生徒の物理行が
//       シフトしているため、別生徒の行を上書きしてしまう。
//
// 解決方針：
//   1) DRY：_findStudentRowIndex は values から sid で 0-based index を返す純粋関数
//   2) 書き込み前は _findStudentRowOnSheet で必ずシートからフレッシュに行特定する
//   3) cache 更新は _updateStudentsCacheBySid で sid キーに統一（cache 上の
//      index と sheet 上の index が乖離していても安全に更新できる）

// 純粋ヘルパー：values 配列から sid に一致する行を 0-based index で返す。
// values は _getStudentsValues() / sheet.getDataRange().getValues() どちらも可。
// 戻り値: 0-based index（values[index][COL_ID] === sid）、見つからなければ -1
function _findStudentRowIndex(values, sid) {
  const target = String(sid || '').trim();
  if (!target || !values || !values.length) return -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][COL_ID] || '').trim() === target) return i;
  }
  return -1;
}

// 書き込み前のフレッシュ行特定。
// シートを直接読んで sid に対応する行を探し、書き込み先として安全な
// { sheet, rowIdx, rowValues, allValues } を返す。cache は経由しないため、
// 行シフトが起きていても正しい行を返す。
//
// 戻り値:
//   { sheet, rowIdx, rowValues, allValues } — 見つかった場合
//   null — sheet が無い or sid が見つからない
function _findStudentRowOnSheet(sid) {
  const sheet = _ss().getSheetByName(SHEET_STUDENTS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const allValues = sheet.getDataRange().getValues();
  const rowIdx = _findStudentRowIndex(allValues, sid);
  if (rowIdx < 0) return null;
  return { sheet: sheet, rowIdx: rowIdx, rowValues: allValues[rowIdx], allValues: allValues };
}

// sid 経由で cache を in-place 更新。
// _updateStudentsCacheRow（rowIdx 引数版）と違い、cache 上で sid を再検索して
// その行を更新するため、cache の index と sheet の index が乖離していても
// 「正しい sid の cache エントリ」を更新できる。
// cache が未保持 / sid が cache に無い場合は invalidate にフォールバック。
function _updateStudentsCacheBySid(sid, updates) {
  const KEY = 'cache_students_values';
  try {
    const cache = CacheService.getScriptCache();
    const hit = cache.get(KEY);
    if (!hit) return; // 未保持：次回 read で fresh に取得される
    const values = JSON.parse(hit);
    const idx = _findStudentRowIndex(values, sid);
    if (idx < 0) {
      // cache に sid が存在しない（cache が古いか、新規生徒など）→ 安全側で invalidate
      cache.remove(KEY);
      _cacheLog(KEY, 'invalidate', 'sid not in cache: ' + sid);
      return;
    }
    Object.keys(updates).forEach(function(k){
      values[idx][parseInt(k, 10)] = updates[k];
    });
    const ser = JSON.stringify(values);
    if (ser.length < 95000) {
      cache.put(KEY, ser, 21600);
      _cacheLog(KEY, 'update', 'sid=' + sid + ' row=' + idx);
    } else {
      cache.remove(KEY);
      _cacheLog(KEY, 'invalidate', 'update skip: size=' + ser.length);
    }
  } catch(e) {
    try {
      CacheService.getScriptCache().remove(KEY);
      _cacheLog(KEY, 'invalidate', 'update by sid failed: ' + e);
    } catch(_) {}
  }
}

// =============================================
// SpecialAccounts シート（Step 1：2026-05-09 新設）
// =============================================
// 用途：テスト枠（1001〜1099）/ 先生枠（2001〜2099）/ 招待枠（3001〜3099）/
//       体験枠（4001〜4099、将来用）を Students から分離管理する。
//
// 列構成：Students シートの列（生徒ID / 氏名 / ニックネーム / クリア済セット /
//        最終更新 / 累計HP / 連続日数 / 最終テスト日 / 最終ログイン日）と完全同一
//        の順序 + 最右列に accountType 列を追加。
//
// Step 1 のスコープ：
//   - シート新規作成 + accountType 列保証
//   - Students 1001〜1010 を **コピー**（Students は無変更）
//   - Students からの削除は絶対にしない（Step 4 まで温存）
//
// 後続 Step：
//   - Step 2：_getAllAccountsValues 等の統合読み込み + 各 API の参照書き換え
//   - Step 3：並行運用での動作確認
//   - Step 4：Students から 1001〜1010 を削除
//   - Step 5：先生枠・招待枠の追加投入

// テスト枠 ID 判定（1001〜1010）。
// Students の ID は数値型 / 文字列型どちらでも来る可能性があるため両対応。
// trim 後に Number 化し、整数かつ 1001〜1010 の範囲内なら true。
function _isTestAccountId(idValue) {
  const s = String(idValue == null ? '' : idValue).trim();
  if (!s) return false;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1001 && n <= 1010;
}

// SpecialAccounts シートが無ければ新規作成し、ヘッダー行を「Students の現状ヘッダー
// + accountType」でセットする。既存の場合は accountType 列の存在のみ保証
// （schema migration、既存データには触れない = 冪等）。
//
// 戻り値: { ok, created, headerColumns, accountTypeColIndex (0-based), message? }
//   - created: 今回シートを新規作成したか
//   - headerColumns: ヘッダー列数（Students 列数 + 1）
//   - accountTypeColIndex: accountType 列の 0-based index
function ensureSpecialAccountsSheet() {
  try {
    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    if (!stuSheet) return { ok: false, message: 'Students シートが見つかりません' };

    // Students シートのヘッダー行を読み取る（accountType 列を末尾に追加するため）
    const stuLastCol = Math.max(1, stuSheet.getLastColumn());
    const stuHeader = stuSheet.getRange(1, 1, 1, stuLastCol).getValues()[0];
    if (stuHeader.length < 9) {
      return { ok: false, message: 'Students シートのヘッダーが想定外（最低 9 列必要）: ' + JSON.stringify(stuHeader) };
    }

    // 期待ヘッダー = Students ヘッダー + 'accountType'
    const desiredHeader = stuHeader.slice().concat([SPECIAL_ACCOUNT_TYPE_HEADER]);

    let sh = ss.getSheetByName(SHEET_SPECIAL_ACCOUNTS);
    let created = false;
    if (!sh) {
      // 新規作成
      sh = ss.insertSheet(SHEET_SPECIAL_ACCOUNTS);
      sh.getRange(1, 1, 1, desiredHeader.length).setValues([desiredHeader]);
      created = true;
      Logger.log('[ensureSpecialAccountsSheet] 新規作成: ' + desiredHeader.length + ' 列 / ヘッダー = ' + JSON.stringify(desiredHeader));
    } else {
      // 既存：accountType 列が無ければ末尾に追加（schema migration）。既存データは変更しない。
      const existingLastCol = Math.max(1, sh.getLastColumn());
      const existingHeader = sh.getRange(1, 1, 1, existingLastCol).getValues()[0];
      if (existingHeader.indexOf(SPECIAL_ACCOUNT_TYPE_HEADER) < 0) {
        sh.getRange(1, existingLastCol + 1).setValue(SPECIAL_ACCOUNT_TYPE_HEADER);
        Logger.log('[ensureSpecialAccountsSheet] 既存シートに accountType 列を追加（' + (existingLastCol + 1) + ' 列目）');
      } else {
        Logger.log('[ensureSpecialAccountsSheet] 既存（変更なし）: ' + existingLastCol + ' 列');
      }
    }

    // accountType 列の最終位置を確定して返す
    const lastCol = sh.getLastColumn();
    const finalHeader = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const accountTypeColIdx = finalHeader.indexOf(SPECIAL_ACCOUNT_TYPE_HEADER);
    return {
      ok: true,
      created: created,
      headerColumns: finalHeader.length,
      accountTypeColIndex: accountTypeColIdx
    };
  } catch (e) {
    console.error('[ensureSpecialAccountsSheet]', e);
    Logger.log('[ensureSpecialAccountsSheet] ERROR: ' + e);
    return { ok: false, message: String(e) };
  }
}

// テスト枠 1001〜1010 を Students から SpecialAccounts に **コピー**する。
// Students シートには触れない（行削除は Step 4 で別途実施）。
//
// 挙動：
//   - 内部で ensureSpecialAccountsSheet を呼び、accountType 列の存在を保証
//   - Students から ID が 1001〜1010 の行を抽出
//   - 同 ID が SpecialAccounts に既に存在する行はスキップ（再実行安全 = 冪等）
//   - 全列値を完全コピー（Date 型 / 数値型 / 文字列型を保持）
//   - accountType 列に 'test' をセット
//   - 一括書き込み（setValues 1 回）
//   - 実行ログに「N 件コピー、M 件スキップ」+ ID リストを出力
//
// 戻り値: { ok, copied, skipped, copiedIds, skippedIds, message? }
function copyTestAccountsFromStudents() {
  try {
    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    if (!stuSheet) return { ok: false, message: 'Students シートが見つかりません' };

    // SpecialAccounts シート + accountType 列の存在を保証
    const ensureRes = ensureSpecialAccountsSheet();
    if (!ensureRes.ok) return ensureRes;

    const spSheet = ss.getSheetByName(SHEET_SPECIAL_ACCOUNTS);
    const accountTypeColIdx = ensureRes.accountTypeColIndex; // 0-based
    const targetCols = ensureRes.headerColumns;

    // Students の全データを読み込み（cache 経由禁止：最新値を確実にコピーするため）
    const stuValues = stuSheet.getDataRange().getValues();
    if (stuValues.length < 2) return { ok: false, message: 'Students シートにデータ行がありません' };

    // SpecialAccounts に既に存在する ID を集合化（重複防止 = 冪等性のキー）
    const existingIds = {};
    if (spSheet.getLastRow() >= 2) {
      const spValues = spSheet.getDataRange().getValues();
      for (let i = 1; i < spValues.length; i++) {
        const sid = String(spValues[i][COL_ID] || '').trim();
        if (sid) existingIds[sid] = true;
      }
    }

    // Students から 1001〜1010 を抽出してコピー対象を組み立てる
    const rowsToAppend = [];
    const copiedIds = [];
    const skippedIds = [];
    for (let i = 1; i < stuValues.length; i++) {
      const idValue = stuValues[i][COL_ID];
      if (!_isTestAccountId(idValue)) continue;
      const sid = String(idValue).trim();
      if (existingIds[sid]) {
        skippedIds.push(sid);
        continue;
      }
      // SpecialAccounts の列数に合わせて行を構築
      //   - 0..(targetCols - 2): Students の各列値をコピー（Students 側に該当列が無ければ ''）
      //   - accountTypeColIdx:    'test' をセット（最右列）
      const newRow = new Array(targetCols).fill('');
      for (let c = 0; c < targetCols; c++) {
        if (c === accountTypeColIdx) continue; // 後でセット
        if (c < stuValues[i].length) newRow[c] = stuValues[i][c];
      }
      newRow[accountTypeColIdx] = SPECIAL_ACCOUNT_TYPES.TEST;
      rowsToAppend.push(newRow);
      copiedIds.push(sid);
    }

    // 一括追記（追記対象が 0 件ならスキップ）
    if (rowsToAppend.length > 0) {
      const startRow = spSheet.getLastRow() + 1;
      spSheet.getRange(startRow, 1, rowsToAppend.length, targetCols).setValues(rowsToAppend);
    }

    const summary = '[copyTestAccountsFromStudents] ' +
      copiedIds.length + ' 件コピー (' + (copiedIds.join(', ') || '-') + ') / ' +
      skippedIds.length + ' 件スキップ (' + (skippedIds.join(', ') || '-') + ')';
    Logger.log(summary);
    console.log(summary);

    return {
      ok: true,
      copied: copiedIds.length,
      skipped: skippedIds.length,
      copiedIds: copiedIds,
      skippedIds: skippedIds
    };
  } catch (e) {
    console.error('[copyTestAccountsFromStudents]', e);
    Logger.log('[copyTestAccountsFromStudents] ERROR: ' + e);
    return { ok: false, message: String(e) };
  }
}

// =============================================
// SpecialAccounts化 Step 4（2026-05-09）：Students からテスト枠を物理削除
// =============================================
// Students シートから 1001〜1010（テスト枠）の行を物理削除する。一回限りの実行を想定。
//
// 前提：
//   - Step 1（copyTestAccountsFromStudents）が完了し、SpecialAccounts に
//     1001〜1010 が複製されていること。
//   - 実行前にスプレッドシートのコピーバックアップを取ること（強く推奨）。
//
// ⚠️ この操作は行シフトを発生させる。2026-05-08 の Students シート行追加
//    事故と同種のリスクパターンだが、Step 0〜2 の sid ベース化と統合読み込み
//    により後続の挙動への影響は無い。万一のため、安全要件 1〜7 を全段で実施。
//
// 安全要件（仕様書 §安全要件 1〜7）：
//   1. 削除前 Students 行数を記録
//   2. 削除対象（1001〜1010）の検出件数をログ出力
//   3. SpecialAccounts に同IDが全てコピー済か事前確認（1件でも欠けたら中断）
//   4. 削除実行（行番号降順で deleteRow ループ）
//   5. 削除後の行数確認（差分が削除件数と一致するか）
//   6. 実生徒の代表サンプル（5桁ID）が削除されていないことを確認
//   7. すべての関連キャッシュをクリア
//
// 並行運用フェーズ（Step 1〜3）中の test枠 への更新について：
//   Students 優先動作のため、test枠 でログイン・学習した分は Students 側に
//   蓄積されており、SpecialAccounts には Step 1 時点のスナップショットしかない。
//   Step 4 でその差分は失われる（ふくちさん許容、test 用途のため）。
//
// 戻り値: { ok, deleted, message?, summary? }
function removeTestAccountsFromStudents() {
  try {
    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    if (!stuSheet) {
      const msg = 'Students シートが見つかりません';
      Logger.log('[removeTestAccountsFromStudents] ERROR: ' + msg);
      return { ok: false, message: msg };
    }
    const spSheet = ss.getSheetByName(SHEET_SPECIAL_ACCOUNTS);
    if (!spSheet) {
      const msg = 'SpecialAccounts シートが見つかりません。Step 1（ensureSpecialAccountsSheet + copyTestAccountsFromStudents）を先に実行してください';
      Logger.log('[removeTestAccountsFromStudents] ERROR: ' + msg);
      return { ok: false, message: msg };
    }

    // UI が利用可能なら確認ダイアログを表示（メニュー経由実行のとき）
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); } catch (e) { /* スクリプトエディタからの直接実行などで UI が無い場合 */ }

    if (ui) {
      const r = ui.alert(
        'Students からテスト枠を削除（Step 4）',
        '⚠️ Students シートから 1001〜1010 の行を物理削除します。\n\n' +
        '実行前にスプレッドシートのバックアップを取りましたか？\n' +
        '（ファイル → コピーを作成）\n\n' +
        'なお、Step 1〜3 の並行運用期間中に 1001〜1010 でログインや学習が\n' +
        'あった場合、その分の更新（HP・連続日数等）は SpecialAccounts には\n' +
        '反映されていない可能性があります（Students 優先動作のため）。\n' +
        'SpecialAccounts には Step 1 時点のスナップショットが保存されています。\n\n' +
        '「はい」で削除を続行、「いいえ」で中断します。',
        ui.ButtonSet.YES_NO
      );
      if (r !== ui.Button.YES) {
        Logger.log('[removeTestAccountsFromStudents] ユーザーキャンセル');
        return { ok: false, message: '中断しました（バックアップ未確認またはキャンセル）' };
      }
    }

    // 安全要件 1：削除前 Students 行数を記録
    const beforeRowCount = stuSheet.getLastRow();
    Logger.log('[removeTestAccountsFromStudents] 削除前 Students 行数 = ' + beforeRowCount);

    // 安全要件 2：削除対象（1001〜1010）の検出
    //   Students シート全体を読み込み、1001〜1010 の行を { sheetRow: 1-based, sid } で集約。
    //   実生徒の代表サンプル（5桁ID）も最大 5 件保存（事後検証用）。
    const stuValues = stuSheet.getDataRange().getValues();
    const targets = [];
    const realSidSamples = [];
    for (let i = 1; i < stuValues.length; i++) {
      const sid = String(stuValues[i][COL_ID] || '').trim();
      if (!sid) continue;
      if (_isTestAccountId(stuValues[i][COL_ID])) {
        targets.push({ sheetRow: i + 1, sid: sid });
      } else if (realSidSamples.length < 5) {
        realSidSamples.push(sid);
      }
    }
    Logger.log('[removeTestAccountsFromStudents] 削除対象 ' + targets.length + ' 件: ' +
      (targets.map(function(t){ return t.sid; }).join(', ') || '-'));
    Logger.log('[removeTestAccountsFromStudents] 実生徒サンプル: ' + (realSidSamples.join(', ') || '-'));

    if (targets.length === 0) {
      const msg = 'Students シートに 1001〜1010 の行がありません（既に削除済み？）';
      Logger.log('[removeTestAccountsFromStudents] ' + msg);
      if (ui) ui.alert('情報', msg, ui.ButtonSet.OK);
      return { ok: true, deleted: 0, message: msg };
    }

    // 安全要件 3：SpecialAccounts に同 ID が全てコピー済か事前確認
    const spValues = spSheet.getDataRange().getValues();
    const spSids = {};
    for (let i = 1; i < spValues.length; i++) {
      const sid = String(spValues[i][COL_ID] || '').trim();
      if (sid) spSids[sid] = true;
    }
    const missingInSpecial = targets
      .filter(function(t){ return !spSids[t.sid]; })
      .map(function(t){ return t.sid; });
    if (missingInSpecial.length > 0) {
      const msg = 'SpecialAccounts シートに以下の ID が存在しません：' + missingInSpecial.join(', ') +
        '\n\nStep 1（copyTestAccountsFromStudents）を先に実行してから再試行してください。\n' +
        '※ Students 側の削除は中断しました（データ保全のため）。';
      Logger.log('[removeTestAccountsFromStudents] ABORT: ' + msg);
      if (ui) ui.alert('削除を中断しました', msg, ui.ButtonSet.OK);
      return { ok: false, message: msg, missingInSpecial: missingInSpecial };
    }
    Logger.log('[removeTestAccountsFromStudents] SpecialAccounts 側に全 ' + targets.length + ' 件確認済 → 削除実行');

    // 安全要件 4：削除実行（行番号降順で deleteRow）
    //   昇順だと先頭を削除した時点で後続の行番号がずれるため、必ず降順で削除する。
    targets.sort(function(a, b){ return b.sheetRow - a.sheetRow; });
    const deletedSids = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      stuSheet.deleteRow(t.sheetRow);
      deletedSids.push(t.sid);
      Logger.log('[removeTestAccountsFromStudents] deleteRow(' + t.sheetRow + ') sid=' + t.sid);
    }

    // 安全要件 5：削除後の行数確認
    const afterRowCount = stuSheet.getLastRow();
    const expectedDelta = targets.length;
    const actualDelta = beforeRowCount - afterRowCount;
    if (actualDelta !== expectedDelta) {
      Logger.log('[removeTestAccountsFromStudents] WARN: 行数差分が想定と一致しません：削除前=' +
        beforeRowCount + ' / 削除後=' + afterRowCount + ' / 差分=' + actualDelta + ' / 想定=' + expectedDelta);
      // 警告だが処理は続行（削除自体は完了している）
    } else {
      Logger.log('[removeTestAccountsFromStudents] OK: 行数差分一致 (' + actualDelta + ' 件)');
    }

    // 安全要件 6：実生徒の代表サンプルが削除後も存在することを確認
    const afterValues = stuSheet.getDataRange().getValues();
    const afterSids = {};
    for (let i = 1; i < afterValues.length; i++) {
      const sid = String(afterValues[i][COL_ID] || '').trim();
      if (sid) afterSids[sid] = true;
    }
    const missingSamples = realSidSamples.filter(function(sid){ return !afterSids[sid]; });
    if (missingSamples.length > 0) {
      // 致命的：実生徒が消えた → 即時中断 + 警告
      const msg = '🚨 実生徒の代表サンプルが削除後に存在しません：' + missingSamples.join(', ') +
        '\n\n直ちにバックアップから復旧してください！';
      Logger.log('[removeTestAccountsFromStudents] CRITICAL: ' + msg);
      if (ui) ui.alert('🚨 致命的エラー', msg, ui.ButtonSet.OK);
      return { ok: false, message: msg, missingSamples: missingSamples };
    }
    // テスト枠が残っていないことも確認（仕様上 0 件のはず）
    const remainingTestSids = Object.keys(afterSids).filter(function(sid){
      const n = Number(sid);
      return Number.isInteger(n) && n >= 1001 && n <= 1010;
    });
    if (remainingTestSids.length > 0) {
      Logger.log('[removeTestAccountsFromStudents] WARN: 削除後に残存テスト枠あり: ' + remainingTestSids.join(', '));
    } else {
      Logger.log('[removeTestAccountsFromStudents] OK: Students 側のテスト枠は 0 件');
    }

    // 安全要件 7：すべての関連キャッシュをクリア
    //   _getStudentsValues / _getAllAccountsValues / 派生ランキング等を破棄。
    //   _getSpecialAccountsValues も並行運用で stale 化している可能性があるため一緒にクリア。
    _invalidateCache('cache_students_values');
    _invalidateCache('cache_special_accounts_values');
    _invalidateCache('cache_ranking_last_week');
    Logger.log('[removeTestAccountsFromStudents] cache invalidate 完了');

    // SpecialAccounts 側の保全確認（無変更であることを念押し）
    let spTestCount = 0;
    for (let i = 1; i < spValues.length; i++) {
      if (_isTestAccountId(spValues[i][COL_ID])) spTestCount++;
    }
    Logger.log('[removeTestAccountsFromStudents] SpecialAccounts のテスト枠（保全確認）= ' + spTestCount + ' 件');

    const summary = {
      beforeRowCount:              beforeRowCount,
      afterRowCount:               afterRowCount,
      actualDelta:                 actualDelta,
      expectedDelta:               expectedDelta,
      deletedSids:                 deletedSids,
      remainingTestSidsInStudents: remainingTestSids,
      specialAccountsTestCount:    spTestCount,
      realStudentSamplesPreserved: realSidSamples.filter(function(sid){ return afterSids[sid]; })
    };
    Logger.log('[removeTestAccountsFromStudents] サマリ: ' + JSON.stringify(summary));

    if (ui) {
      ui.alert(
        '削除完了',
        '✅ ' + targets.length + ' 件のテスト枠を Students シートから削除しました。\n\n' +
        '削除前 ' + beforeRowCount + ' 行 → 削除後 ' + afterRowCount + ' 行（差分 ' + actualDelta + '）\n' +
        '実生徒サンプル ' + realSidSamples.length + ' 件すべて保全確認済\n' +
        'SpecialAccounts のテスト枠 ' + spTestCount + ' 件（無変更）\n\n' +
        '実行ログの詳細は GAS エディタの「実行数（実行ログ）」で確認できます。\n\n' +
        'これで 1001〜1010 でログインすると SpecialAccounts 側で動作するようになりました。',
        ui.ButtonSet.OK
      );
    }

    return { ok: true, deleted: targets.length, summary: summary };
  } catch (e) {
    console.error('[removeTestAccountsFromStudents]', e);
    Logger.log('[removeTestAccountsFromStudents] EXCEPTION: ' + e);
    return { ok: false, message: String(e) };
  }
}

// =============================================
// カスタムメニュー（スプレッドシートを開いた時に発火）
// =============================================
// SpecialAccounts シートのセットアップ用メニューを追加する。
// 既存の onOpen は無いため新設。将来別のメニュー項目を増やす場合はここに追記。
// onOpen 内で例外が起きると以後のメニュー描画が止まるため、try/catch で握り潰す。
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🔧 マイ活アプリ')
      .addSubMenu(
        ui.createMenu('SpecialAccounts')
          .addItem('① シート初期化（ヘッダー作成 / accountType 列追加）', 'ensureSpecialAccountsSheet')
          .addItem('② テスト枠コピー（1001〜1010 を Students からコピー、削除なし）', 'copyTestAccountsFromStudents')
          .addItem('③ Students からテスト枠を削除（Step 4 / ⚠️ 一回限りの操作）', 'removeTestAccountsFromStudents')
      )
      .addToUi();
  } catch (e) {
    // onOpen は権限が無い実行コンテキストでも呼ばれる場合があるため、エラーは無視する
    console.error('[onOpen]', e);
  }
}

// =============================================
// 統合読み込みヘルパー（SpecialAccounts化 Step 2：2026-05-09）
// =============================================
// 用途：生徒向け API および「全アカウント対象」の管理 API から、Students と
//       SpecialAccounts を横断して生徒を扱えるようにする。
//
// 設計：
//  - _getSpecialAccountsValues : SpecialAccounts シートの cache 読み（_getStudentsValues と対称）
//  - _getAllAccountsValues     : Students + SpecialAccounts 結合（Students 優先で sid 重複を排除）
//  - _findAccountRowOnSheet    : sid から「どのシート / どの行」かをフレッシュ読みで返す
//  - _updateAccountCacheBySid  : sid を含むキャッシュを自動判定して更新
//
// Students 優先の理由：Step 2 の並行運用フェーズで 1001〜1010 が両シートに存在
//   する状態が生じる。既存挙動と互換を保つため Students を先に検索し、見つかれば
//   そのまま使う（Students 側が更新される）。Step 4 で Students から削除されたら
//   自動的に SpecialAccounts 側に切り替わる。

// SpecialAccounts シートの全 values を cache 経由で取得（_getStudentsValues と対称）。
// シートが無い / データ行ゼロの場合は [] を返す（呼び出し側で length チェック）。
function _getSpecialAccountsValues() {
  return _getCachedValues('cache_special_accounts_values', 21600, function() {
    const sh = _ss().getSheetByName(SHEET_SPECIAL_ACCOUNTS);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getDataRange().getValues();
  });
}

// Students + SpecialAccounts を結合した values を返す。
// - ヘッダー行は Students のものを採用（先頭 1 行）
// - SpecialAccounts のデータ行を末尾に追加。ただし sid が Students に既存なら
//   重複行をスキップ（Students 優先 = Step 4 までの並行運用フェーズへの配慮）
// - 戻り値の各行は Students 列構成 + SpecialAccounts のみ accountType 列が末尾にある
//   構造のまま（既存コードは row[COL_ID]〜row[COL_LAST_LOGIN] までしか触らないので問題なし）
function _getAllAccountsValues() {
  const stuRows = _getStudentsValues();
  const spRows  = _getSpecialAccountsValues();
  if (!stuRows || stuRows.length === 0) {
    return spRows && spRows.length > 0 ? spRows.slice() : [];
  }
  if (!spRows || spRows.length < 2) {
    return stuRows.slice();
  }
  // Students の sid 集合（重複排除キー）
  const stuSids = {};
  for (let i = 1; i < stuRows.length; i++) {
    const sid = String(stuRows[i][COL_ID] || '').trim();
    if (sid) stuSids[sid] = true;
  }
  const combined = stuRows.slice();
  for (let i = 1; i < spRows.length; i++) {
    const sid = String(spRows[i][COL_ID] || '').trim();
    if (!sid) continue;
    if (stuSids[sid]) continue;  // Students 優先：SpecialAccounts 側の重複行をスキップ
    combined.push(spRows[i]);
  }
  return combined;
}

// sid から「どのシート / どの行」かをフレッシュ読みで特定する。
// Students を先に検索し、見つからなければ SpecialAccounts を検索（Students 優先）。
// 戻り値: { sheet, rowIdx, rowValues, allValues, sheetName } または null
//   - sheet:     書き込み先の Sheet オブジェクト
//   - rowIdx:    0-based index（書き込みは sheet.getRange(rowIdx + 1, ...)）
//   - rowValues: その行の値配列
//   - allValues: そのシートの全 values（呼び出し側で他列を読みたい場合用）
//   - sheetName: 'Students' or 'SpecialAccounts'（呼び出し側で識別したい場合用）
function _findAccountRowOnSheet(sid) {
  // 1) Students を先に検索（既存挙動と互換）
  const stuLoc = _findStudentRowOnSheet(sid);
  if (stuLoc) {
    return {
      sheet:      stuLoc.sheet,
      rowIdx:     stuLoc.rowIdx,
      rowValues:  stuLoc.rowValues,
      allValues:  stuLoc.allValues,
      sheetName:  SHEET_STUDENTS
    };
  }
  // 2) SpecialAccounts を検索
  const spSheet = _ss().getSheetByName(SHEET_SPECIAL_ACCOUNTS);
  if (!spSheet || spSheet.getLastRow() < 2) return null;
  const spValues = spSheet.getDataRange().getValues();
  const idx = _findStudentRowIndex(spValues, sid);
  if (idx < 0) return null;
  return {
    sheet:      spSheet,
    rowIdx:     idx,
    rowValues:  spValues[idx],
    allValues:  spValues,
    sheetName:  SHEET_SPECIAL_ACCOUNTS
  };
}

// 書き込み後のキャッシュ更新を sid ベースで自動ディスパッチする。
// Students cache → SpecialAccounts cache の順で sid を再検索し、見つかった
// 側のキャッシュを in-place 更新する。どちらにも見つからなければ両方を
// invalidate（cache stale 時の安全策）。
function _updateAccountCacheBySid(sid, updates) {
  const STU_KEY = 'cache_students_values';
  const SP_KEY  = 'cache_special_accounts_values';
  try {
    const cache = CacheService.getScriptCache();

    // 1) Students cache を先に試す（既存挙動と互換）
    const stuHit = cache.get(STU_KEY);
    if (stuHit) {
      const values = JSON.parse(stuHit);
      const idx = _findStudentRowIndex(values, sid);
      if (idx >= 0) {
        Object.keys(updates).forEach(function(k){
          values[idx][parseInt(k, 10)] = updates[k];
        });
        const ser = JSON.stringify(values);
        if (ser.length < 95000) {
          cache.put(STU_KEY, ser, 21600);
          _cacheLog(STU_KEY, 'update', 'sid=' + sid + ' row=' + idx);
        } else {
          cache.remove(STU_KEY);
          _cacheLog(STU_KEY, 'invalidate', 'update skip: size=' + ser.length);
        }
        return; // 更新済
      }
    }

    // 2) SpecialAccounts cache を試す
    const spHit = cache.get(SP_KEY);
    if (spHit) {
      const values = JSON.parse(spHit);
      const idx = _findStudentRowIndex(values, sid);
      if (idx >= 0) {
        Object.keys(updates).forEach(function(k){
          values[idx][parseInt(k, 10)] = updates[k];
        });
        const ser = JSON.stringify(values);
        if (ser.length < 95000) {
          cache.put(SP_KEY, ser, 21600);
          _cacheLog(SP_KEY, 'update', 'sid=' + sid + ' row=' + idx);
        } else {
          cache.remove(SP_KEY);
          _cacheLog(SP_KEY, 'invalidate', 'update skip: size=' + ser.length);
        }
        return;
      }
    }

    // 3) どちらの cache にも見つからない場合
    //    → 両方の cache が stale 可能性。安全側で両方 invalidate。
    if (stuHit) { cache.remove(STU_KEY); _cacheLog(STU_KEY, 'invalidate', 'sid not in either cache: ' + sid); }
    if (spHit)  { cache.remove(SP_KEY);  _cacheLog(SP_KEY,  'invalidate', 'sid not in either cache: ' + sid); }
  } catch(e) {
    try {
      const cache = CacheService.getScriptCache();
      cache.remove(STU_KEY);
      cache.remove(SP_KEY);
      _cacheLog(STU_KEY, 'invalidate', 'update by sid failed: ' + e);
    } catch(_) {}
  }
}

// 診断ログを有効化（GAS エディタから直接実行）
// 実行後、各リクエストの Executions ログに [cache HIT/MISS/INV] が出力される
function enableDebugCache() {
  try {
    _props().setProperty('DEBUG_CACHE', '1');
    console.log('[DEBUG_CACHE] enabled. 各リクエストのログに cache HIT/MISS/INV が出力されます。');
    return { ok: true, enabled: true };
  } catch(err) {
    console.error('[enableDebugCache]', err);
    return { ok: false, message: String(err) };
  }
}

// 診断ログを無効化（GAS エディタから直接実行）
// 本番運用時はオフにしてログ書き込みのオーバーヘッド（~10ms/回）を削減
function disableDebugCache() {
  try {
    _props().deleteProperty('DEBUG_CACHE');
    console.log('[DEBUG_CACHE] disabled.');
    return { ok: true, enabled: false };
  } catch(err) {
    console.error('[disableDebugCache]', err);
    return { ok: false, message: String(err) };
  }
}

// 手動キャッシュ全クリア用（GAS エディタから直接実行）
// Questions シート等、管理画面経由でない更新の反映を急ぐ場合に使用
function clearAllCache() {
  try {
    const keys = [
      'cache_q5_rows',
      'cache_q_rows_4級', 'cache_q_rows_3級', 'cache_q_rows_準2級',
      'cache_q_rows_2級', 'cache_q_rows_準1級',
      'cache_sango_topics_values',
      'cache_wabun1_topics_values',
      'cache_quote_values',
      'cache_notice_values',
      'cache_ranking_last_week',
      'cache_students_values',
      'cache_special_accounts_values'
    ];
    // 基礎計算 KisoQuestions の rank 別キャッシュ（1〜20）
    for (let r = 1; r <= 20; r++) keys.push('cache_kiso_q_rows_' + r);
    CacheService.getScriptCache().removeAll(keys);
    return { ok: true, cleared: keys.length };
  } catch(err) {
    console.error('[clearAllCache]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// doGet
// =============================================
function doGet(e) {
  if (e && e.parameter && e.parameter.params) {
    try {
      const params = JSON.parse(e.parameter.params);
      const action = params.action;
      let result;
      if      (action === 'loginStudent')     result = loginStudent(params.studentId);
      else if (action === 'saveNickname')     result = saveNickname(params.studentId, params.nickname);
      else if (action === 'getTodaysSet')     result = getTodaysSet(params.studentId, params.level);
      else if (action === 'saveAttempt')      result = saveAttempt(params.studentId, params.setNo, params.score, params.total, params.passed, params.level, params.sessionNo);
      else if (action === 'getHistory')       result = getHistory(params.studentId);
      else if (action === 'getSetWords')      result = getSetWords(params.setNo, params.level);
      else if (action === 'submitPhoto')      result = submitPhoto(params.studentId, params.setNo, params.imageBase64, params.words);
      else if (action === 'getWeeklyRanking') result = getWeeklyRanking();
      else if (action === 'getQuote')         result = getQuote();
      else if (action === 'getNotice')        result = getNotice();
      else if (action === 'getNoticeHistory') result = getNoticeHistory();
      else if (action === 'submitExchange')    result = submitExchange(params.studentId, params.rank);
      else if (action === 'getExchangeStatus') result = getExchangeStatus(params.studentId);
      else if (action === 'adminLogin')        result = adminLogin(params);
      // Phase 3 講師管理：一覧取得は読み取りなので doGet 経由。書き込み 5 関数は doPost のみ
      else if (action === 'adminListTeachers') result = adminListTeachers(params);
      // Phase 4 操作ログ：閲覧（admin-only）。書き込みは _logTeacherAction が内部で副作用として行う
      else if (action === 'getTeacherActionsList') result = getTeacherActionsList(params);
      else if (action === 'completeFirstLogin') result = completeFirstLogin(params);
      else if (action === 'adminAddQuote')     result = adminAddQuote(params);
      else if (action === 'adminAddNotice')    result = adminAddNotice(params);
      else if (action === 'adminListStudents') result = adminListStudents(params);
      else if (action === 'getStudentsListForGrant') result = getStudentsListForGrant(params);
      else if (action === 'getCalendarMonthSummary') result = getCalendarMonthSummary(params);
      else if (action === 'getCalendarDayDetail')    result = getCalendarDayDetail(params);
      else if (action === 'getStudentView') result = getStudentView(params);  
      else if (action === 'getSangoTopic')             result = getSangoTopic();
      else if (action === 'submitSango')               result = submitSango(params);
      else if (action === 'adminAddSangoTopic')        result = adminAddSangoTopic(params);
      else if (action === 'adminAddSangoTopicsWeek')   result = adminAddSangoTopicsWeek(params);
      else if (action === 'adminListSangoSubmissions') result = adminListSangoSubmissions(params);
      else if (action === 'adminSetSangoTeacherWork')   result = adminSetSangoTeacherWork(params);
      else if (action === 'adminSetSangoComment')      result = adminSetSangoComment(params);
      else if (action === 'getSangoSubmissions') result = getSangoSubmissions(params);
      // 2026-05-12 サンゴタン AI フィードバック関連
      else if (action === 'getSangoStarredForStudent')  result = getSangoStarredForStudent(params);
      else if (action === 'getSangoWeeklyFeatured')     result = getSangoWeeklyFeatured();
      else if (action === 'getSangoHallOfFame')         result = getSangoHallOfFame(params);
      else if (action === 'adminSangoStar')             result = adminSangoStar(params);
      else if (action === 'adminSangoPublish')          result = adminSangoPublish(params);
      else if (action === 'getSangoPastTopicsRecent')   result = getSangoPastTopicsRecent();
      else if (action === 'getSangoPastTopicsPaged')    result = getSangoPastTopicsPaged(params);
      else if (action === 'getChildActivityRecent')    result = getChildActivityRecent(params);
      else if (action === 'getWabun1Topic')             result = getWabun1Topic(params);
      else if (action === 'submitWabun1')               result = submitWabun1(params);
      // ※ wabun1 の OCR（ocrWabun1Photo）は base64 画像を送るため実体は doPost 経由。
      //   ただし submitLison 事故（CLAUDE.md #148、2026-04-29）の再発防止として
      //   doGet にも登録しておく（GET でクエリ長超過しても unknown action は出さない）。
      //   doPost のルーティングと必ずセットで保持すること。
      else if (action === 'ocrWabun1Photo')             result = ocrWabun1Photo(params);
      else if (action === 'getWabun1Submissions')       result = getWabun1Submissions(params);
      else if (action === 'getWabun1AnswersAfterSubmit') result = getWabun1AnswersAfterSubmit(params);
      else if (action === 'getWabun1PastTopicsRecent')   result = getWabun1PastTopicsRecent(params);
      else if (action === 'getWabun1PastTopicsPaged')    result = getWabun1PastTopicsPaged(params);
      else if (action === 'adminAddWabun1TopicsWeek')   result = adminAddWabun1TopicsWeek(params);
      else if (action === 'adminSetWabun1AnswerWeek')   result = adminSetWabun1AnswerWeek(params);
      else if (action === 'adminListWabun1Submissions') result = adminListWabun1Submissions(params);
      else if (action === 'adminSetWabun1Comment')      result = adminSetWabun1Comment(params);
      else if (action === 'startKisoSession')        result = startKisoSession(params.studentId, params.rank, params.count);
      else if (action === 'getKisoRetryQuestions')   result = getKisoRetryQuestions(params.sessionId);
      else if (action === 'getKisoTodayRawHP')       result = getKisoTodayRawHP(params);
      else if (action === 'getKisoPhotosList')       result = getKisoPhotosList(params);
      // 基礎計算 履歴一覧（生徒画面 screen-kiso-history、カンジー方式踏襲）
      else if (action === 'getKisoHistoryForStudent') result = getKisoHistoryForStudent(params);
      // Phase 6: 基礎計算 答案写真の認証付き base64 配信。
      //   getKisoPhotoBlob          → admin/teacher 用（閲覧 + DL 可、UI 側で DL ボタン表示）
      //   getKisoPhotoBlobForStudent → 生徒 Mode B 用（sid×fileId 突合、閲覧のみ）
      //   doPost にも保護登録（CLAUDE.md #148 原則踏襲）。
      else if (action === 'getKisoPhotoBlob')          result = getKisoPhotoBlob(params);
      else if (action === 'getKisoPhotoBlobForStudent') result = getKisoPhotoBlobForStudent(params);
      // 閲覧系操作ログ：DL ボタン押下時の独立ログ記録（キャッシュヒット時でも確実に記録）
      else if (action === 'logKisoPhotoDownload')      result = logKisoPhotoDownload(params);
      // ※ ここにリスオン関連（getLisonContent, submitLison）のルーティングを必ず残す。
      //   Phase 1-A コミット 71b8c93 で追加。過去に管理画面リファクタ作業で巻き込まれて
      //   消えかけ、ふくちさん側の clasp push が古いまま実機テストで「録音送信が失敗する」
      //   症状を起こした実績あり（2026-04-29）。両ルーティングはセットで保持すること。
      else if (action === 'getLisonContent')         result = getLisonContent(params.level);
      else if (action === 'submitLison')              result = submitLison(params);
      // Phase 6: リスオン録音の認証付き base64 配信（DL 抑止用、admin/teacher 両方再生可）。
      //   doPost にも保護登録（submitLison 事故 / CLAUDE.md #148 の教訓）。
      else if (action === 'getLisonRecordingBlob')    result = getLisonRecordingBlob(params);
      // ※ ここにカンジー関連（getKanjiSet, submitKanjiYomi）のルーティングを必ず残す。
      //   2026-05-02 新規追加。submitKanjiKaki は base64 画像があるため doPost 側のみ。
      else if (action === 'getKanjiSet')              result = getKanjiSet(params);
      else if (action === 'submitKanjiYomi')          result = submitKanjiYomi(params);
      else if (action === 'getKanjiTodayRawHP')       result = getKanjiTodayRawHP(params);
      else if (action === 'getKanjiHistory')          result = getKanjiHistory(params);
      // ※ ここにコブタン（古文単語）関連のルーティングを必ず残す。
      //   2026-05-08 新規追加。4 択問題のみ（写真 OCR なし）のため doPost 不要、すべて doGet。
      //   ensureKobunSheets は GAS エディタからの 1 回限りセットアップ用で、ここには登録しない。
      // 今日の運勢（2026-05-13 新規、旧「秘密の扉」のリブランド）
      // 4 択や写真送信は無いので doGet 単独で十分。骨格データのみ返す軽量 API。
      else if (action === 'getTodayFortune')          result = getTodayFortune(params);
      // 誕生日保存（2026-05-13 Phase 2 段階A 新規）: 'MM-DD' を Students/SpecialAccounts
      // に保存。任意項目のため未登録でも getTodayFortune は問題なく動く（星座運のみ非表示）。
      else if (action === 'saveBirthday')             result = saveBirthday(params);
      // 誕生日サプライズ表示制御（2026-05-14 Phase 2 段階C 新規）
      //   checkBirthdayGreet : ログイン直後に「今、サプライズ画面を表示すべきか」を判定。
      //   markBirthdayGreetShown : サプライズ画面の「ありがとう」ボタン押下で年フラグを書き込む。
      else if (action === 'checkBirthdayGreet')       result = checkBirthdayGreet(params);
      else if (action === 'markBirthdayGreetShown')   result = markBirthdayGreetShown(params);
      // アバター機能 Phase α（2026-05-15 新規）：ベース選択 + 所持機能のみ。
      //   getAvatarState : ホーム表示 / アバターコーナー画面で呼ぶ（base + items + equipped + nickname）。
      //   saveAvatarBase : アバター選択画面の「決定」押下で呼ぶ（base のみ書き換え）。
      // Phase β（着せ替え）/ γ（マイカツ君との会話）はスコープ外。列だけ先行で用意済み。
      else if (action === 'getAvatarState')           result = getAvatarState(params);
      else if (action === 'saveAvatarBase')           result = saveAvatarBase(params);
      else if (action === 'getKobunSet')              result = getKobunSet(params);
      else if (action === 'submitKobunSet')           result = submitKobunSet(params);
      else if (action === 'getKobunTodayRawHP')       result = getKobunTodayRawHP(params);
      else if (action === 'getKobunHistory')          result = getKobunHistory(params);
      else if (action === 'getKobunProgress')         result = getKobunProgress(params);
      // 先生からのメッセージ（生徒画面：メッセージ一覧 + 未読件数）
      // ※ 管理画面の送信系（sendTeacherMessage）と既読化（markMessageAsRead）は doPost 側に登録。
      //   ensureTeachersSheet / ensureTeacherMessagesSheets は GAS エディタからの 1 回限り
      //   セットアップ用で、ここには登録しない（CLAUDE.md の運用ルール準拠）。
      else if (action === 'getMessagesForStudent')   result = getMessagesForStudent(params);
      else if (action === 'getUnreadMessageCount')   result = getUnreadMessageCount(params);
      // 管理画面: リスオン問題入力（getLisonLevels は無認証、他 2 つは _verifyTeacher で teacherId+password 検証）
      else if (action === 'getLisonLevels')                  result = getLisonLevels();
      else if (action === 'getLisonContentsWeek')            result = getLisonContentsWeek(params);
      else if (action === 'listLisonContentsWeeks')          result = listLisonContentsWeeks(params);
      // 管理画面: リスオン録音メタ一覧
      else if (action === 'getLisonSubmissionsList')         result = getLisonSubmissionsList(params);
      // ※ リスオン保守バッチ（migrateLisonRecordingsToShared / migrateLisonSubmissionsAddFileId
      //   / cleanupLisonOldRecordings）は URL 経由を遮断（Phase 2、漏洩耐性向上）。
      //   関数本体は残しており、GAS エディタからの手動実行 + Time-based Trigger（cleanup）は
      //   引き続き動作する。将来 URL 経由が必要になった時はここに else if を再追加すること。
      else if (action === 'ping')             result = { ok: true };
      else result = { ok: false, message: 'unknown action: ' + action };
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      console.error('[doGet API]', err);
      return ContentService.createTextOutput(JSON.stringify({ ok: false, message: String(err) })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  try {
    const tmpl = HtmlService.createTemplateFromFile('Index');
    tmpl.appUrl = ScriptApp.getService().getUrl();
    return tmpl.evaluate().setTitle(APP_TITLE).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput('<p>読み込みに失敗しました。</p>').setTitle(APP_TITLE);
  }
}

// =============================================
// doPost（写真判定用）
// =============================================
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    let result;
    if      (action === 'submitPhoto')              result = submitPhoto(params.studentId, params.setNo, params.imageBase64, params.words);
    // 管理画面の大量データ投入用（GET ではクエリ長制限を超えるため POST 経由）
    else if (action === 'adminAddWabun1TopicsWeek') result = adminAddWabun1TopicsWeek(params);
    // 同上：三語短文の週単位一括登録（28 件で 8KB 超過、CLAUDE.md #93 と同パターン）
    else if (action === 'adminAddSangoTopicsWeek')  result = adminAddSangoTopicsWeek(params);
    // 基礎計算：写真提出（base64 画像が大きいため POST 経由）
    else if (action === 'submitKisoAnswer')         result = submitKisoAnswer(params.sessionId, params.imageBase64, params.hasWorkPhoto);
    else if (action === 'submitKisoWorkPhoto')      result = submitKisoWorkPhoto(params.sessionId, params.imageBase64, params.photoIndex);
    // ※ 和文英訳① の OCR（ocrWabun1Photo）は base64 画像を送るため doPost 経由必須。
    //   2026-04-30 に Cloud Vision → Gemini Vision 切替時に追加（CLAUDE.md 参照）。
    //   doGet にも保護として登録済み。両ルーティングはセットで保持すること。
    else if (action === 'ocrWabun1Photo')           result = ocrWabun1Photo(params);
    // ※ ここにリスオン関連（submitLison）のルーティングを必ず残す。
    //   クライアント側（index.html submitLisonRecording）は録音 base64 を gasPost で送るため、
    //   doGet だけでなく doPost にも必須。Phase 1-A 実装時に doPost への登録漏れがあり、
    //   本番デプロイ後の初回テストで「unknown action: submitLison」エラーを起こした実績あり
    //   （2026-04-29）。getLisonContent は GET（cachedGasGet）なので doGet のみで OK。
    else if (action === 'submitLison')              result = submitLison(params);
    // Phase 6: リスオン録音 base64 配信（doGet にも保護登録、両方セットで保持）。
    else if (action === 'getLisonRecordingBlob')    result = getLisonRecordingBlob(params);
    // Phase 6: 基礎計算 答案写真 base64 配信（doGet にも保護登録、両方セットで保持）。
    else if (action === 'getKisoPhotoBlob')          result = getKisoPhotoBlob(params);
    else if (action === 'getKisoPhotoBlobForStudent') result = getKisoPhotoBlobForStudent(params);
    // 閲覧系操作ログ：DL ボタン押下時の独立ログ記録
    else if (action === 'logKisoPhotoDownload')      result = logKisoPhotoDownload(params);
    // 基礎計算 履歴一覧（doGet にも保護登録、両方セットで保持）
    else if (action === 'getKisoHistoryForStudent')  result = getKisoHistoryForStudent(params);
    // 管理画面: リスオン問題の週単位一括登録（5 レベル × 3 問 + 英文 / 和訳で URL 長を
    // 超えるため POST 必須、CLAUDE.md #93 と同パターン）。
    else if (action === 'adminSaveLisonContentsWeek') result = adminSaveLisonContentsWeek(params);
    // カンジー：書き提出（写真 base64 が大きいため POST 経由）
    else if (action === 'submitKanjiKaki')          result = submitKanjiKaki(params);
    // 管理画面：HP 手動付与（誤実行防止のため POST 強制、Students.HP と HPLog を直接書き換える）
    else if (action === 'executeManualHpGrant')     result = executeManualHpGrant(params);
    // 先生からのメッセージ（管理画面：送信 / 生徒画面：既読化）
    // ※ 管理者認証必須の sendTeacherMessage は POST 強制（誤送信防止）。
    //   markMessageAsRead は誤書き込みリスクが極小だが POST に統一（doGet にも登録すると
    //   キャッシュに乗って既読化のレスポンスが古くなり得るため、書き込み系は POST のみ）。
    else if (action === 'sendTeacherMessage')       result = sendTeacherMessage(params);
    else if (action === 'markMessageAsRead')        result = markMessageAsRead(params);
    // Phase 3 講師管理：書き込み系 5 関数は誤実行防止のため POST 強制
    //   adminListTeachers（読み取り）は doGet のみ。
    else if (action === 'adminAddTeacher')                  result = adminAddTeacher(params);
    else if (action === 'adminResetTeacherPassword')        result = adminResetTeacherPassword(params);
    else if (action === 'adminSetTeacherActive')            result = adminSetTeacherActive(params);
    else if (action === 'adminSetTeacherRole')              result = adminSetTeacherRole(params);
    else if (action === 'adminUpdateTeacherDisplayNickname') result = adminUpdateTeacherDisplayNickname(params);
    else result = { ok: false, message: 'unknown action: ' + action };
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('[doPost]', err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, message: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =============================================
// ログイン（キャラクターステージ対応版）
// =============================================
function loginStudent(studentId) {
  try {
    // 2026-05-09 Step 0：行シフト事故防止のため、書き込み対象行は必ず
    // シートからフレッシュに sid で特定する（cache 経由禁止）。
    // 読み取り側のキャッシュ最適化（_getStudentsValues）は他の read-only API でのみ使う。
    const stuLoc = _findAccountRowOnSheet(studentId);
    if (!stuLoc) return { ok: false, message: '生徒IDが見つかりません。先生に確認してください。' };
    const row = stuLoc.rowValues;
    // 4/27 cutover 後は教育日（4:00 AM JST 区切り）。それ以前は _todayJST と同じ
    const today = _todayEducationalJST();
    const now   = _nowJST();

    const nickname     = String(row[COL_NICKNAME] || '').trim();
    const isFirstLogin = (nickname === '');
    let   currentHP    = Number(row[COL_HP])     || 0;
    let   streak       = Number(row[COL_STREAK]) || 0;
    const lastLogin    = _toDateStr(row[COL_LAST_LOGIN]);

    // 未ログイン日数を計算
    let missedDays = 0;
    if (lastLogin && lastLogin !== today) {
      const diff = (new Date(today) - new Date(lastLogin)) / (1000 * 60 * 60 * 24);
      missedDays = Math.floor(diff);
    }

    // 今日まだログインしていない場合のみ更新
    let loginBonus = 0;
    if (lastLogin !== today) {
      loginBonus = 10;
      currentHP += loginBonus;

      if (missedDays === 1) {
        streak += 1;    // 昨日から連続
      } else if (missedDays === 0) {
        streak = 1;     // 初回ログイン
      } else {
        streak = 1;     // 2日以上空いたのでリセット
      }

      // 2026-05-12 バグ④-本質 Phase B（案 A）：書き込み順序を _logHP → Students に変更。
      // 旧: Students 更新（HP / STREAK / LAST_LOGIN）→ _logHP（失敗してもサイレント）
      // 新: _logHP（戻り値で成否確認）→ 成功時のみ Students 更新
      //
      // _logHP が失敗した場合は Students.HP / STREAK / LAST_LOGIN を一切更新せずに
      // エラー応答を返す。これにより lastLogin が今日に書き換わらないので、生徒が
      // 再ログインすれば +10HP がもう一度試行され、自動救済される。
      const logRes = _logHP(studentId, loginBonus, loginBonus, 'login');
      if (!logRes.ok) {
        console.error('[loginStudent] HPLog 書き込みに失敗しました。HP/STREAK/LAST_LOGIN を更新せず終了。', logRes.error);
        return { ok: false, message: '内部エラーが発生しました。もう一度試してください。', errorCode: 'HP_LOG_FAILED' };
      }

      // 4/26 修正: 連続日数バグ対策で LAST_TEST 列を含む 5 列 setValues を廃止
      //   旧: setValues E-I（UPDATED, HP, STREAK, LAST_TEST=preserved, LAST_LOGIN）
      //       → preservedLastTest が cache 経由（stale な ISO 文字列の可能性）でリスク
      //   新: setValues E-G（UPDATED, HP, STREAK）+ setValue I（LAST_LOGIN）
      //       LAST_TEST には触らない（saveAttempt が必要に応じて自分で書く）
      // 2026-05-09 Step 0：書き込み行は stuLoc.rowIdx（フレッシュ）を使う
      stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_UPDATED + 1, 1, COL_STREAK - COL_UPDATED + 1)
           .setValues([[now, currentHP, streak]]);
      stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_LAST_LOGIN + 1).setValue(today);
      const updates = {};
      updates[COL_UPDATED]    = now;
      updates[COL_HP]         = currentHP;
      updates[COL_STREAK]     = streak;
      updates[COL_LAST_LOGIN] = today;
      _updateAccountCacheBySid(studentId, updates);
    }

    // ステージ・称号・節目を計算
    const yesterday    = _getYesterdayJST();
    const prevDayCount = _getPrevDayCount(studentId, yesterday);
    const stage        = _calcStage(streak, missedDays, prevDayCount);
    const title        = _getTitle(streak);
    // 節目・称号ランクアップ チェック
    let milestoneInfo = null;
    if (loginBonus > 0) {
      const isMsDay  = _isMilestone(streak);
      const rankUpCheck = (missedDays === 1) && (_getTitle(streak) !== _getTitle(streak - 1));
      if (isMsDay || rankUpCheck) {
        milestoneInfo = {
          streak:      streak,
          isMilestone: isMsDay,
          isRankUp:    rankUpCheck,
          prevTitle:   missedDays === 1 ? _getTitle(streak - 1) : '',
          newTitle:    title
        };
      }
    }

    return {
      ok:          true,
      studentId:   String(row[COL_ID]).trim(),
      name:        String(row[COL_NAME] || ''),
      nickname,
      isFirstLogin,
      totalHP:     currentHP,
      loginBonus,
      streak,
      stage,
      title,
      milestone: milestoneInfo
    };
  } catch (err) {
    console.error('[loginStudent]', err);
    return { ok: false, message: '内部エラーが発生しました。' };
  }
}

// =============================================
// キャラクター関連ヘルパー
// =============================================
// 4/27 cutover 後は教育日基準の昨日を返す。それ以前は旧ロジック互換。
function _getYesterdayJST() {
  return _yesterdayEducationalJST();
}

function _getTitle(streak) {
  if (streak >= 1900) return 'マイカツ神';
  if (streak >= 1700) return 'マイカツ伝説';
  if (streak >= 1500) return 'マイカツCEO';
  if (streak >= 1300) return 'マイカツ会長';
  if (streak >= 1100) return 'マイカツ仙人';
  if (streak >= 900)  return 'マイカツ長老';
  if (streak >= 730)  return 'マイカツ賢者';
  if (streak >= 650)  return 'マイカツ皇帝';
  if (streak >= 550)  return 'マイカツ王';
  if (streak >= 450)  return 'マイカツ総理';
  if (streak >= 365)  return 'マイカツ将軍';
  if (streak >= 300)  return 'マイカツ大臣';
  if (streak >= 240)  return 'マイカツ貴族';
  if (streak >= 180)  return 'マイカツ社長';
  if (streak >= 150)  return 'マイカツ専務';
  if (streak >= 120)  return 'マイカツ常務';
  if (streak >= 90)   return 'マイカツ部長';
  if (streak >= 60)   return 'マイカツ課長';
  if (streak >= 45)   return 'マイカツ英雄';
  if (streak >= 30)   return 'マイカツ勇者';
  if (streak >= 21)   return 'マイカツ騎士';
  if (streak >= 14)   return 'マイカツ戦士';
  if (streak >= 7)    return 'マイカツ若頭';
  if (streak >= 3)    return 'マイカツ足軽';
  return 'マイカツ見習い';
}

// =============================================
// マイルストーン判定
// =============================================
function _isMilestone(streak) {
  if (streak === 3 || streak === 7) return true;
  if (streak >= 30  && streak % 30  === 0) return true;
  if (streak >= 100 && streak % 100 === 0) return true;
  if (streak >= 365 && streak % 365 === 0) return true;
  return false;
}

// ★ 2026-05-08 全コンテンツ対応に拡張（ふくちさん最終確認、案 B-1 採用）
//
// 旧仕様（〜2026-05-07）: SHEET_ATTEMPTS（英単語RUSH のテスト合格ログ専用）を末尾
// 200 行走査して studentId + yesterday に一致する件数を返す。
//
// 新仕様（2026-05-08〜）: HPLog（全コンテンツの活動が _logHP で集約される唯一の点）
// を末尾 500 行走査し、_isCountableActivityType で「学習活動」と判定された type の
// 件数を返す。1 日に何回でもカウント（案 B-1）。
//
// 設計判断（HPLog 1 シート vs 6 シート個別走査）:
//   - HPLog にすべてのコンテンツの活動が集約されている（test / sango / wabun1 /
//     kiso_* / kanji_* / lison）。カンジーは提出ログ専用シートを持たないため、
//     HPLog 集約方式でしか網羅対応できない
//   - 1 シート読みで網羅的、6 シート個別走査より高速
//   - 将来コンテンツ追加時は _logHP に新 type で書き込む + _isCountableActivityType
//     の許可リストに 1 行追加 で対応可（拡張性高）
//   - 末尾 500 行（旧 200 → 拡張）でマルチコンテンツの活動量増加に対応
//
// 旧 Attempts 単独カウント時の挙動との互換性:
//   - 英単語RUSH 1 セット合格 → HPLog に type='test' が 1 件 → 同じ 1 カウント（互換）
//   - 三語短文 / 基礎計算 / 和文英訳① / リスオン / カンジー の活動も自動カウント
function _getPrevDayCount(studentId, yesterday) {
  const sh = _ss().getSheetByName(SHEET_HPLOG);
  if (!sh) return 0;
  let count = 0;
  const sid = String(studentId).trim();
  // 末尾 500 行のみ走査（マルチコンテンツの活動量増加に対応、旧 200 行から拡張）
  const data = _readLastNRows(sh, 500);
  for (let i = 0; i < data.length; i++) {
    // HPLog 列: 0=timestamp, 1=studentId, 2=rawHP, 3=hpGained, 4=type
    if (String(data[i][1]).trim() !== sid) continue;
    if (_toDateStr(data[i][0])    !== yesterday) continue;
    if (_isCountableActivityType(String(data[i][4] || ''))) count++;
  }
  return count;
}

// 学習活動として「prevDayCount に計上する type」かどうかを判定。
// マイ活アプリの全コンテンツの活動を網羅し、運営付与・ログインボーナス・練習モード
// は除外する。新コンテンツ追加時はここに 1 行足すだけで対応可。
//
// カウント対象（学習活動）:
//   完全一致:    'test' / 'sango' / 'wabun1' / 'lison'
//   プレフィックス: 'kiso_*' / 'kanji_*'
// 除外対象:
//   完全一致:    'login' / 'manual_grant'
//   プレフィックス: 'apology_*'（apology_streak_bonus / apology_kiso / apology_wabun1）
//   サフィックス:  '*_practice'（カンジー HP 上限到達後の練習モード）
function _isCountableActivityType(type) {
  if (!type) return false;
  if (type === 'login') return false;
  if (type === 'manual_grant') return false;
  if (type.indexOf('apology_') === 0) return false;
  // _practice 接尾の判定（カンジー練習モード等）
  const PRACTICE_SUFFIX = '_practice';
  if (type.length >= PRACTICE_SUFFIX.length &&
      type.substring(type.length - PRACTICE_SUFFIX.length) === PRACTICE_SUFFIX) return false;
  // カウント対象（完全一致）
  if (type === 'test' || type === 'sango' || type === 'wabun1' || type === 'lison') return true;
  // カウント対象（プレフィックス）
  if (type.indexOf('kiso_')  === 0) return true;
  if (type.indexOf('kanji_') === 0) return true;
  if (type.indexOf('kobun_') === 0) return true;
  // 未知の type はデフォルト除外（明示的に許可リストに追加してから有効化）
  return false;
}

function _calcStage(streak, missedDays, prevDayCount) {
  if (missedDays >= 3)                                       return 1;
  if (missedDays === 2)                                      return 2;
  if (missedDays === 1)                                      return 3;
  if (streak >= 3 && prevDayCount >= 2)                      return 7;
  if (missedDays === 0 && prevDayCount >= 1 && streak >= 2)  return 6;
  if (missedDays === 0 && prevDayCount >= 1)                 return 5;
  return 4;
}

// =============================================
// ニックネーム保存
// =============================================
function saveNickname(studentId, nickname) {
  try {
    // 2026-05-09 Step 0：行シフト事故防止のため、書き込み対象行は必ず
    // シートからフレッシュに sid で特定する（cache 経由禁止）
    const stuLoc = _findAccountRowOnSheet(studentId);
    if (!stuLoc) return { ok: false, message: '生徒IDが見つかりません。' };
    const trimmed = nickname.trim();
    stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_NICKNAME + 1).setValue(trimmed);
    const updates = {};
    updates[COL_NICKNAME] = trimmed;
    _updateAccountCacheBySid(studentId, updates);
    return { ok: true, nickname: trimmed };
  } catch (err) {
    return { ok: false, message: '保存に失敗しました。' };
  }
}

// =============================================
// 今日のセット取得（1日2セット対応）
// =============================================
function getTodaysSet(studentId, level) {
  try {
    const sid   = String(studentId).trim();
    const lv    = String(level || '4級').trim();
    // 4/27 cutover 後は教育日基準。pass1/pass2 の "今日" 判定も同基準で揃える
    const today = _todayEducationalJST();
    const props = _props();

    const pass1Key = 'pass1_' + sid + '_' + lv;
    const pass2Key = 'pass2_' + sid + '_' + lv;
    const done1 = (props.getProperty(pass1Key) || '') === today;
    const done2 = (props.getProperty(pass2Key) || '') === today;

    if (done1 && done2) {
      return { ok: true, alreadyDone: true, sessionNo: 3, level: lv, setNo: 0, words: [] };
    }

    const sessionNo = done1 ? 2 : 1;
    const is5       = (lv === '5級');

    let targetLv  = lv;
    let clearKey  = 'cleared_' + sid + '_' + targetLv;
    let cleared   = parseInt(props.getProperty(clearKey) || '0', 10);
    let targetSet = cleared + 1;

    let isRound2 = false;
    if (is5) {
      const maxSet = _getMaxSetForLevel('5級');
      if (cleared >= maxSet) { isRound2 = true; targetSet = (cleared - maxSet) + 1; }
    }

    if (sessionNo === 2 && !is5) {
      const maxSet = _getMaxSetForLevel(targetLv);
      if (maxSet > 0 && cleared >= maxSet) {
        const nextLv = _getNextLevel(targetLv);
        if (nextLv) {
          targetLv  = nextLv;
          clearKey  = 'cleared_' + sid + '_' + targetLv;
          cleared   = parseInt(props.getProperty(clearKey) || '0', 10);
          targetSet = cleared + 1;
        }
      }
    }

    // レベル絞り込み済みの行だけをキャッシュ経由で取得
    const rowsOfLevel = _getQuestionRowsForLevel(targetLv);
    const words = is5
      ? _getWords(rowsOfLevel, targetSet, '5級')
      : _getWordsQ4(rowsOfLevel, targetSet, targetLv);

    if (words.length === 0) {
      return { ok: false, message: 'セット' + targetSet + '（英検' + targetLv + 'レベル）のデータがまだありません。' };
    }
    return { ok: true, setNo: targetSet, words, alreadyDone: false, level: targetLv, sessionNo, isRound2: isRound2 || false };
  } catch (err) {
    console.error('[getTodaysSet]', err);
    return { ok: false, message: '問題データの取得に失敗しました。' };
  }
}

// =============================================
// テスト結果保存
// =============================================
function saveAttempt(studentId, setNo, score, total, passed, level, sessionNo) {
  try {
    const aSheet = _ss().getSheetByName(SHEET_ATTEMPTS);
    const now    = _nowJST();
    // 4/27 cutover 後は教育日基準。LAST_TEST と pass1/pass2 の同期がズレないよう揃える
    const today  = _todayEducationalJST();
    const sid    = String(studentId).trim();
    const lv     = String(level || '4級').trim();
    const sNo    = Number(sessionNo) || 1;

    // 2026-05-09 Step 0：行シフト事故防止のため、書き込み対象行はシートから sid で
    // フレッシュに特定する。氏名 / 現在 HP / streak / cleared 等の現在値もここから読む。
    const stuLoc = _findAccountRowOnSheet(sid);
    const studentName = stuLoc ? String(stuLoc.rowValues[COL_NAME] || '') : '';

    // Attempts: 日時 / 生徒ID / 氏名 / セット番号 / 得点 / 合否 / 級 / 端末(任意) / メモ(任意)
    aSheet.appendRow([now, sid, studentName, setNo, score, passed ? '合格' : '不合格', lv, '', '']);
    if (!passed) return { ok: true };

    const props   = _props();
    const passKey = sNo === 1 ? 'pass1_' + sid + '_' + lv : 'pass2_' + sid + '_' + lv;
    props.setProperty(passKey, today);

    const clearKey    = 'cleared_' + sid + '_' + lv;
    const clearedSets = parseInt(props.getProperty(clearKey) || '0', 10);
    if (setNo > clearedSets) props.setProperty(clearKey, String(setNo));

    // HP計算（streak ベース：ログイン連続日数 × week²）
    //   1セットクリアにつき 50 × (連続週数)² HPを加算
    //   → 1日2セット完了で合計 100 × (連続週数)² HP
    if (!stuLoc) return { ok: false };
    const sRow      = stuLoc.rowValues;
    const currentHP = Number(sRow[COL_HP]) || 0;
    const streak    = Number(sRow[COL_STREAK]) || 1;  // 最低1
    const week      = Math.ceil(streak / 7);
    const hpGained  = 50 * week * week;
    const newHP     = currentHP + hpGained;

    // 2026-05-12 バグ④-本質 Phase B（案 A）：書き込み順序を _logHP → Students に変更。
    // HPLog 書き込みに失敗した場合は Students.HP / CLEARED / LAST_TEST を更新せずに
    // エラー応答を返す。Attempts シートと PropertiesService（pass1/pass2/cleared_*）の
    // 更新はそのまま残す（合格記録自体は有効、HP だけが付与されなかった状態）。
    const logRes = _logHP(sid, hpGained, hpGained, 'test');
    if (!logRes.ok) {
      console.error('[saveAttempt] HPLog 書き込みに失敗しました。HP/CLEARED/LAST_TEST を更新せず終了。', logRes.error);
      return { ok: false, message: '内部エラーが発生しました。もう一度試してください。', errorCode: 'HP_LOG_FAILED' };
    }

    // 4/26 修正: 連続日数バグ対策で STREAK 列を含む 5 列 setValues を廃止
    //   旧: setValues D-H（CLEARED, UPDATED, HP, STREAK=preservedStreak, LAST_TEST）
    //       → preservedStreak が cache 経由（stale な値の可能性）→ シートの STREAK を破壊するリスク
    //   新: setValues D-F（CLEARED, UPDATED, HP）+ setValue H（LAST_TEST）
    //       STREAK には絶対に触らない（loginStudent のみが書き込む列）
    // 2026-05-09 Step 0：書き込み行は stuLoc.rowIdx（フレッシュ）を使う
    const currentCleared = Number(sRow[COL_CLEARED]) || 0;
    const newCleared = (setNo > currentCleared) ? setNo : currentCleared;
    stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_CLEARED + 1, 1, COL_HP - COL_CLEARED + 1)
          .setValues([[newCleared, now, newHP]]);
    stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_LAST_TEST + 1).setValue(today);
    const updates = {};
    updates[COL_CLEARED]   = newCleared;
    updates[COL_UPDATED]   = now;
    updates[COL_HP]        = newHP;
    updates[COL_LAST_TEST] = today;
    _updateAccountCacheBySid(sid, updates);
    _invalidateCache('cache_ranking_last_week');

    return { ok: true, clearHP: hpGained, bonusHP: 0, hpGained, totalHP: newHP, streak: streak, week: week };
  } catch (err) {
    console.error('[saveAttempt]', err);
    return { ok: false };
  }
}

// =============================================
// HPログ記録
// =============================================
// シグネチャ：_logHP(studentId, rawHP, hpGained, type)
//   - rawHP : 倍率適用前の素点（仕様書 §8.7 で確定済み）
//   - hpGained : 倍率適用後の獲得HP（=実際の Students シートに加算される値）
// 既存コンテンツ（英単語RUSH/三語短文/和文英訳①）は素点と倍率後HPが同値のため
// rawHP に hpGained と同じ値を渡せば後方互換。基礎計算 Phase 4 で submitKisoAnswer
// が rawHP（素点）を別の値（倍率前）として記録するために本シグネチャに統一する。
// 2026-05-12 バグ④-本質 Phase B（案 A）：戻り値 + flush + 即時リトライ + テレメトリ
//   - 戻り値: { ok: true } / { ok: false, error: string }
//   - 成功時は SpreadsheetApp.flush() で確実に書き込み（別 execution への可視性保証）
//   - 失敗時は 500ms 待機して 1 回だけリトライ（一時的 quota / lock / 内部エラー対策）
//   - DEBUG_HPLOG プロパティが 'true' のときのみ成功/失敗を console.log に記録
//
// 呼び出し元の責務（順序変更方式 = Q2 採用）：
//   先に _logHP を呼び、result.ok === true を確認してから Students.HP 加算に進む。
//   _logHP が失敗した場合は Students.HP を加算せず、関数全体としてエラー応答を返す。
//   これにより「Students 進 + HPLog 欠落」の不一致パターン（パターン A・B）を構造的に防ぐ。
function _logHP(studentId, rawHP, hpGained, type) {
  const sid = String(studentId).trim();

  // テレメトリ flag（PropertiesService 読み取りは 1 関数呼び出しで 1 回のみ）
  let debug = false;
  try {
    debug = (PropertiesService.getScriptProperties().getProperty('DEBUG_HPLOG') === 'true');
  } catch (propErr) {
    // PropertiesService 失敗時はテレメトリ無効として継続
  }

  const MAX_ATTEMPTS  = 2;
  const RETRY_WAIT_MS = 500;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const ss = _ss();
      let sh   = ss.getSheetByName(SHEET_HPLOG);
      if (!sh) {
        sh = ss.insertSheet(SHEET_HPLOG);
        sh.getRange(1, 1, 1, 5).setValues([['timestamp', 'studentId', 'rawHP', 'hpGained', 'type']]);
      }
      sh.appendRow([_nowJST(), sid, rawHP, hpGained, type]);
      SpreadsheetApp.flush();  // v12 教訓踏襲：appendRow 直後の flush で確実に永続化
      if (debug) {
        console.log('[_logHP] sid=' + sid + ' type=' + type + ' attempts=' + attempt + ' ok=true');
      }
      return { ok: true };
    } catch (e) {
      lastError = e;
      console.error('[_logHP] attempt=' + attempt + ' sid=' + sid + ' type=' + type, e);
      if (attempt < MAX_ATTEMPTS) {
        Utilities.sleep(RETRY_WAIT_MS);
      }
    }
  }

  if (debug) {
    console.log('[_logHP] sid=' + sid + ' type=' + type + ' attempts=' + MAX_ATTEMPTS + ' ok=false error=' + String(lastError && lastError.message || lastError));
  }
  return { ok: false, error: String(lastError && lastError.message || lastError) };
}

// =============================================
// 一回限りの移行：HPLog に rawHP カラムを追加し既存レコードを埋め戻す
// =============================================
// 用途：既存 HPLog（4 列：timestamp/studentId/hpGained/type）に rawHP カラムを
//       hpGained の左側に挿入し、全既存レコードに rawHP = hpGained を埋め戻す。
// 実行：GAS エディタから手動で 1 回だけ実行（clasp push 後）。
//       既に rawHP カラムが存在する場合は何もしない（冪等）。
// 戻り値：{ ok, alreadyMigrated, addedRows, message }
function migrateHpLogAddRawHp() {
  try {
    const ss = _ss();
    const sh = ss.getSheetByName(SHEET_HPLOG);
    if (!sh) {
      return { ok: true, alreadyMigrated: false, addedRows: 0, message: 'HPLog シートが存在しません（次回 _logHP 呼び出し時に新形式で自動作成されます）' };
    }
    // ヘッダー走査：既に rawHP がある場合はスキップ（冪等）
    const lastCol = sh.getLastColumn();
    if (lastCol >= 1) {
      const header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
      if (header.indexOf('rawHP') >= 0) {
        return { ok: true, alreadyMigrated: true, addedRows: 0, message: '既に rawHP カラムが存在します（migration 実行済み）' };
      }
    }
    // 旧形式の確認：column 3 が 'hpGained' であることを確認
    const oldHeader = sh.getRange(1, 1, 1, Math.max(4, lastCol)).getValues()[0];
    if (oldHeader[2] !== 'hpGained') {
      return { ok: false, message: '旧形式の HPLog ヘッダーが想定と異なります（column 3 が "hpGained" ではない）：' + JSON.stringify(oldHeader) };
    }
    // 新カラムを column 3 の前に挿入（既存 hpGained は column 4 へ右シフト）
    sh.insertColumnBefore(3);
    // 新ヘッダー設定
    sh.getRange(1, 3).setValue('rawHP');
    // 既存レコードの埋め戻し：rawHP（column 3）に hpGained（column 4、シフト後）の値をコピー
    const lastRow = sh.getLastRow();
    let backfilled = 0;
    if (lastRow >= 2) {
      const hpValues = sh.getRange(2, 4, lastRow - 1, 1).getValues();
      sh.getRange(2, 3, lastRow - 1, 1).setValues(hpValues);
      backfilled = lastRow - 1;
    }
    return { ok: true, alreadyMigrated: false, addedRows: backfilled, message: `rawHP カラムを追加し、${backfilled} 件のレコードに rawHP = hpGained を埋め戻しました。` };
  } catch (err) {
    console.error('[migrateHpLogAddRawHp]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 連続日数の一括復旧（4/24 Day 2 Stage 2 バグ対策）
// =============================================
// 用途: 各生徒の "実際にログインした日" を全活動ログから推定し、Students.STREAK を再計算。
//
// "ログインした日" の判定 (multi-source):
//   ふくちさんとの仕様確認: アプリは「ログインしないとテスト等の課題は出来ない」。
//   よって以下のいずれかが存在する日は "その日ログインした" と推定できる。
//     1. HPLog の type='login' レコード      ← 通常はこれが主信号
//     2. HPLog の type='test'/'sango'/'wabun1' その他全 type ← 何らかの活動 = ログイン済
//     3. Attempts シートのレコード（テスト受験）← 受験 = ログイン済
//   _toDateStr バグ (4/24 Day 2 Stage 2 で発動) の影響で、loginStudent が
//   稀に HPLog 'login' を書き損ねるケースが疑われる（24009 岩倉、23030 髙山）。
//   その救済として 2 と 3 を fallback signal として使う。
//
// 引数: opts = { dryRun?: boolean, force?: boolean }
//   - dryRun=true: シートを更新せず、旧→新の対比だけを返す（必ず最初に dryRun で確認）
//   - force=true:  実行済みフラグ無視（このスクリプトでは未使用、apologyStreakBonus と
//                  シグネチャを揃えるため受け入れるだけ）
//
// 注: 4/26 復旧では旧 _todayJST 基準（カレンダー日）。4:00 AM 教育日への切替は
//     loginStudent 等が 4/27 から自動適用するため、この関数は触らない。
//
// 戻り値: { ok, dryRun, totalStudents, updateCount, updates: [...] }
//   updates[i] = {
//     rowIdx, sid, name, nickname,
//     oldStreak, newStreak,
//     activeDays,           // 全 source 統合後のユニーク活動日数
//     lastActiveDate,       // ソート後の最終日
//     loginDays,            // HPLog type='login' のみの日数（参考）
//     fallbackOnlyDays,     // HPLog 'login' が無く Attempts/他 type のみで救済された日のリスト
//   }
// ※ Step 2：本関数は Students 専用（実生徒のみ対象）。テスト枠 / 先生枠 / 招待枠 等の
//   SpecialAccounts は streak 復旧の対象外（HPLog から復旧する設計の前提が実生徒のみ）。
function recoverAllStudentsStreak(opts) {
  try {
    opts = opts || {};
    const dryRun = !!opts.dryRun;

    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    const logSheet = ss.getSheetByName(SHEET_HPLOG);
    const atSheet  = ss.getSheetByName(SHEET_ATTEMPTS);
    if (!stuSheet) return { ok: false, message: 'Students シートが見つかりません' };
    if (!logSheet && !atSheet) return { ok: false, message: 'HPLog/Attempts どちらも見つかりません' };

    // cache 経由禁止: すべて直接読み
    const stuValues = stuSheet.getDataRange().getValues();
    const logValues = logSheet ? logSheet.getDataRange().getValues() : [];
    const atValues  = atSheet  ? atSheet.getDataRange().getValues()  : [];

    // ---- Source 1+2: HPLog（全 type）----------------------------------
    //   - 'login' フラグだけ別途記録して fallback 検出に使う
    const loginDatesBySid    = {};   // {sid: {date: true}} - HPLog type='login' のみ
    const activeDatesBySid   = {};   // {sid: {date: true}} - 全活動の集合（最終的に streak 計算に使う）

    if (logValues.length >= 2) {
      const logHeader = logValues[0];
      const cTimestamp = logHeader.indexOf('timestamp');
      const cSid       = logHeader.indexOf('studentId');
      const cType      = logHeader.indexOf('type');
      if (cTimestamp < 0 || cSid < 0 || cType < 0) {
        return { ok: false, message: 'HPLog ヘッダーが想定外: ' + JSON.stringify(logHeader) };
      }
      for (let i = 1; i < logValues.length; i++) {
        const row = logValues[i];
        const sid = String(row[cSid] || '').trim();
        if (!sid) continue;
        // apology_streak_bonus はログインを意味しないので除外
        const type = String(row[cType] || '').trim();
        if (type === 'apology_streak_bonus') continue;
        const dateStr = _toDateStr(row[cTimestamp]);
        if (!dateStr) continue;
        if (!activeDatesBySid[sid]) activeDatesBySid[sid] = {};
        activeDatesBySid[sid][dateStr] = true;
        if (type === 'login') {
          if (!loginDatesBySid[sid]) loginDatesBySid[sid] = {};
          loginDatesBySid[sid][dateStr] = true;
        }
      }
    }

    // ---- Source 3: Attempts（テスト受験ログ）-----------------------------
    //   列構成: 日時 / 生徒ID / 氏名 / セット番号 / 得点 / 合否 / 級 / 端末 / メモ
    //   テスト受験には必ずログインが必要 → 同日は "ログインした日" と推定
    if (atValues.length >= 2) {
      // ヘッダー検出（古いシートでヘッダー名が異なる可能性に備える）
      const atHeader = atValues[0];
      let atTs  = atHeader.indexOf('日時');
      let atSid = atHeader.indexOf('生徒ID');
      if (atTs  < 0) atTs  = 0; // フォールバック: 列 A
      if (atSid < 0) atSid = 1; // フォールバック: 列 B
      for (let i = 1; i < atValues.length; i++) {
        const row = atValues[i];
        const sid = String(row[atSid] || '').trim();
        if (!sid) continue;
        const dateStr = _toDateStr(row[atTs]);
        if (!dateStr) continue;
        if (!activeDatesBySid[sid]) activeDatesBySid[sid] = {};
        activeDatesBySid[sid][dateStr] = true;
      }
    }

    // ---- 各生徒について連続日数を再計算 ----------------------------------
    const updates = [];
    for (let i = 1; i < stuValues.length; i++) {
      const sid = String(stuValues[i][COL_ID] || '').trim();
      if (!sid) continue;
      const oldStreak = Number(stuValues[i][COL_STREAK]) || 0;
      const activeMap = activeDatesBySid[sid];
      const loginMap  = loginDatesBySid[sid] || {};

      let newStreak = 0;
      let lastActiveDate = '';
      let activeDayCount = 0;
      let loginDayCount  = 0;
      const fallbackOnlyDays = [];   // login 信号が無く救済された日（参考用）

      if (activeMap) {
        const sortedDates = Object.keys(activeMap).sort();
        activeDayCount = sortedDates.length;
        let streak = 0;
        let prev = null;
        for (let j = 0; j < sortedDates.length; j++) {
          const d = sortedDates[j];
          if (!loginMap[d]) fallbackOnlyDays.push(d);
          if (prev === null) {
            streak = 1;
          } else {
            const diffMs = new Date(d) - new Date(prev);
            const diffDays = Math.round(diffMs / 86400000);
            if      (diffDays === 1) streak += 1;
            else if (diffDays === 0) { /* 同日は維持 */ }
            else streak = 1;
          }
          prev = d;
        }
        newStreak = streak;
        lastActiveDate = prev || '';
        loginDayCount = Object.keys(loginMap).length;
      }

      if (oldStreak !== newStreak) {
        updates.push({
          rowIdx: i,
          sid: sid,
          name: String(stuValues[i][COL_NAME] || ''),
          nickname: String(stuValues[i][COL_NICKNAME] || ''),
          oldStreak: oldStreak,
          newStreak: newStreak,
          activeDays: activeDayCount,
          lastActiveDate: lastActiveDate,
          loginDays: loginDayCount,
          fallbackOnlyDays: fallbackOnlyDays
        });
      }
    }

    // dryRun でなければシート書き込み + cache invalidate
    if (!dryRun && updates.length > 0) {
      for (let k = 0; k < updates.length; k++) {
        const u = updates[k];
        stuSheet.getRange(u.rowIdx + 1, COL_STREAK + 1).setValue(u.newStreak);
      }
      _invalidateCache('cache_students_values');
      _invalidateCache('cache_ranking_last_week');
    }

    return {
      ok: true,
      dryRun: dryRun,
      totalStudents: stuValues.length - 1,
      updateCount: updates.length,
      updates: updates
    };
  } catch (err) {
    console.error('[recoverAllStudentsStreak]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 個別生徒の活動診断（連続日数バグ調査用）
// =============================================
// 用途: 特定生徒の HPLog / Attempts の生レコードを抽出して、ログイン日の歯抜けや
//       activity との相関を可視化する。GAS エディタで個別実行する想定。
// 例:   diagnoseStudentActivity('24009', 30) で 24009 岩倉の過去 30 日を調査。
// 戻り値:
//   {
//     ok, studentId, name, nickname, currentStreak,
//     hpLogEntries: [{date, time, type, rawHP, hpGained, message}, ...],   // 新しい順
//     attemptsEntries: [{date, time, setNo, score, passed, level}, ...],   // 新しい順
//     daySummary: [{date, hasLogin, hasAttempt, hasOtherHp, otherTypes:[...]}, ...]  // 古い順
//     missingLoginDays: [...],   // attempts/他 type はあるが type='login' が無い日
//     suspectedRecoverableStreak: N,   // multi-source で推定される連続日数
//   }
function diagnoseStudentActivity(studentId, days) {
  try {
    const sid = String(studentId || '').trim();
    if (!sid) return { ok: false, message: 'studentId を指定してください' };
    const lookbackDays = Number(days) || 30;

    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    const logSheet = ss.getSheetByName(SHEET_HPLOG);
    const atSheet  = ss.getSheetByName(SHEET_ATTEMPTS);
    if (!stuSheet) return { ok: false, message: 'Students シートが見つかりません' };

    // 生徒情報
    let studentName = '', studentNick = '', currentStreak = 0;
    const stuValues = stuSheet.getDataRange().getValues();
    for (let i = 1; i < stuValues.length; i++) {
      if (String(stuValues[i][COL_ID] || '').trim() === sid) {
        studentName   = String(stuValues[i][COL_NAME] || '');
        studentNick   = String(stuValues[i][COL_NICKNAME] || '');
        currentStreak = Number(stuValues[i][COL_STREAK]) || 0;
        break;
      }
    }

    // カットオフ日付
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    const cutoffStr = Utilities.formatDate(cutoffDate, 'Asia/Tokyo', 'yyyy-MM-dd');

    // HPLog 抽出
    const hpLogEntries = [];
    if (logSheet && logSheet.getLastRow() >= 2) {
      const logValues = logSheet.getDataRange().getValues();
      const logHeader = logValues[0];
      const cTimestamp = logHeader.indexOf('timestamp');
      const cSid       = logHeader.indexOf('studentId');
      const cType      = logHeader.indexOf('type');
      const cRawHP     = logHeader.indexOf('rawHP');
      const cHpGained  = logHeader.indexOf('hpGained');
      const cMessage   = logHeader.indexOf('message');
      for (let i = 1; i < logValues.length; i++) {
        const row = logValues[i];
        if (String(row[cSid] || '').trim() !== sid) continue;
        const ts = row[cTimestamp];
        const dateStr = _toDateStr(ts);
        if (!dateStr || dateStr < cutoffStr) continue;
        const tStr = (ts instanceof Date) ? Utilities.formatDate(ts, 'Asia/Tokyo', 'HH:mm:ss') :
                     (typeof ts === 'string' && ts.length >= 19) ? ts.slice(11, 19) : '';
        hpLogEntries.push({
          date: dateStr,
          time: tStr,
          type: String(row[cType] || ''),
          rawHP: cRawHP >= 0 ? row[cRawHP] : '',
          hpGained: cHpGained >= 0 ? row[cHpGained] : '',
          message: cMessage >= 0 ? String(row[cMessage] || '') : ''
        });
      }
    }
    hpLogEntries.sort(function(a, b){
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.time < b.time ? 1 : a.time > b.time ? -1 : 0;
    });

    // Attempts 抽出
    const attemptsEntries = [];
    if (atSheet && atSheet.getLastRow() >= 2) {
      const atValues = atSheet.getDataRange().getValues();
      const atHeader = atValues[0];
      let atTs  = atHeader.indexOf('日時');
      let atSid = atHeader.indexOf('生徒ID');
      if (atTs  < 0) atTs  = 0;
      if (atSid < 0) atSid = 1;
      for (let i = 1; i < atValues.length; i++) {
        const row = atValues[i];
        if (String(row[atSid] || '').trim() !== sid) continue;
        const ts = row[atTs];
        const dateStr = _toDateStr(ts);
        if (!dateStr || dateStr < cutoffStr) continue;
        const tStr = (ts instanceof Date) ? Utilities.formatDate(ts, 'Asia/Tokyo', 'HH:mm:ss') :
                     (typeof ts === 'string' && ts.length >= 19) ? ts.slice(11, 19) : '';
        attemptsEntries.push({
          date: dateStr,
          time: tStr,
          setNo: row[3],
          score: row[4],
          passed: row[5],
          level: row[6]
        });
      }
    }
    attemptsEntries.sort(function(a, b){
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.time < b.time ? 1 : a.time > b.time ? -1 : 0;
    });

    // 日付別サマリ
    const daysMap = {}; // {date: {login, attempt, otherTypes}}
    hpLogEntries.forEach(function(e){
      if (!daysMap[e.date]) daysMap[e.date] = { login: false, attempt: false, otherTypes: [] };
      if (e.type === 'login') daysMap[e.date].login = true;
      else if (e.type !== 'apology_streak_bonus') {
        if (daysMap[e.date].otherTypes.indexOf(e.type) < 0) daysMap[e.date].otherTypes.push(e.type);
      }
    });
    attemptsEntries.forEach(function(e){
      if (!daysMap[e.date]) daysMap[e.date] = { login: false, attempt: false, otherTypes: [] };
      daysMap[e.date].attempt = true;
    });
    const sortedDays = Object.keys(daysMap).sort();
    const daySummary = sortedDays.map(function(d){
      const m = daysMap[d];
      return {
        date: d,
        hasLogin: m.login,
        hasAttempt: m.attempt,
        hasOtherHp: m.otherTypes.length > 0,
        otherTypes: m.otherTypes
      };
    });

    // login が無いが activity がある日 = recovery v2 で救済される日
    const missingLoginDays = daySummary
      .filter(function(d){ return !d.hasLogin && (d.hasAttempt || d.hasOtherHp); })
      .map(function(d){ return d.date; });

    // multi-source streak 推定（recoverAllStudentsStreak v2 と同じロジック）
    let suspectedStreak = 0, prev = null;
    for (let i = 0; i < sortedDays.length; i++) {
      const d = sortedDays[i];
      if (prev === null) suspectedStreak = 1;
      else {
        const diffDays = Math.round((new Date(d) - new Date(prev)) / 86400000);
        if      (diffDays === 1) suspectedStreak += 1;
        else if (diffDays === 0) { /* same day */ }
        else suspectedStreak = 1;
      }
      prev = d;
    }

    return {
      ok: true,
      studentId: sid,
      name: studentName,
      nickname: studentNick,
      currentStreak: currentStreak,
      lookbackDays: lookbackDays,
      hpLogEntries: hpLogEntries,
      attemptsEntries: attemptsEntries,
      daySummary: daySummary,
      missingLoginDays: missingLoginDays,
      suspectedRecoverableStreak: suspectedStreak
    };
  } catch (err) {
    console.error('[diagnoseStudentActivity]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 自動バックアップ機能
// =============================================
// 用途: マイ活アプリのスプレッドシートを毎日 1 ファイル丸ごとコピーし、
//       Google Drive 内の「マイ活_バックアップ」フォルダに保存する。
//       30 日を超えた旧バックアップは自動削除。
// 想定運用: GAS Time-based Trigger で毎日 02:00〜03:00 に runDailyBackup() を実行。
//   - 週次切替トリガー(03:00〜04:00) と被らないようにずらしている。
// 実装ポリシー:
//   - バックアップフォルダはマイドライブ直下に固定名で作成（重複検索）。
//   - ファイル名は 'mykt-eitango-backup_YYYY-MM-DD'（拡張子は makeCopy が自動）。
//   - BackupLog シート（自動作成）に timestamp/status/fileId/message を追記。
//   - エラー時もシートにログを残し、例外は throw しない（Trigger を停止させない）。

const BACKUP_FOLDER_NAME = 'マイ活_バックアップ';
const BACKUP_FILE_PREFIX = 'mykt-eitango-backup_';
const BACKUP_RETAIN_DAYS = 30;
const SHEET_BACKUP_LOG   = 'BackupLog';

// マイドライブ直下にバックアップフォルダを 1 個確保（同名複数個の場合は最初の 1 個を採用）
function _ensureBackupFolder() {
  const it = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(BACKUP_FOLDER_NAME);
}

// BackupLog シートを確保（未存在なら作成、ヘッダー付き）
function _ensureBackupLogSheet() {
  const ss = _ss();
  let sh = ss.getSheetByName(SHEET_BACKUP_LOG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_BACKUP_LOG);
    sh.getRange(1, 1, 1, 4).setValues([['timestamp', 'status', 'fileId', 'message']]);
  }
  return sh;
}

// BackupLog にログ追記（status: 'success' | 'failure' | 'cleanup'）
function _logBackup(status, fileId, message) {
  try {
    const sh = _ensureBackupLogSheet();
    sh.appendRow([_nowJST(), status, fileId || '', message || '']);
  } catch (e) {
    console.error('[_logBackup]', e);
  }
}

// 30 日超のバックアップファイルを削除（ファイル名から日付を抽出）
function _cleanupOldBackups(folder) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - BACKUP_RETAIN_DAYS);
    const cutoffMs = cutoff.getTime();
    const files = folder.getFiles();
    let deleted = 0;
    while (files.hasNext()) {
      const f = files.next();
      const name = f.getName();
      // mykt-eitango-backup_2026-04-26 形式から日付を抽出
      const m = name.match(/_(\d{4}-\d{2}-\d{2})/);
      if (!m) continue;
      const fileDate = new Date(m[1]);
      if (isNaN(fileDate.getTime())) continue;
      if (fileDate.getTime() < cutoffMs) {
        f.setTrashed(true);
        deleted += 1;
      }
    }
    if (deleted > 0) {
      _logBackup('cleanup', '', BACKUP_RETAIN_DAYS + ' 日超のバックアップ ' + deleted + ' 件をゴミ箱へ移動');
    }
    return deleted;
  } catch (err) {
    console.error('[_cleanupOldBackups]', err);
    _logBackup('cleanup', '', 'cleanup 失敗: ' + String(err));
    return 0;
  }
}

// 日次バックアップ本体（Time-based Trigger から呼ばれる）
// 戻り値: { ok, fileId?, fileName?, deleted?, message? }
function runDailyBackup() {
  try {
    const ss = _ss();
    const ssId = ss.getId();
    const fileName = BACKUP_FILE_PREFIX + _todayJST();

    // 既に同名バックアップが今日分あればスキップ（同じ日に複数回実行された場合）
    const folder = _ensureBackupFolder();
    const existing = folder.getFilesByName(fileName);
    if (existing.hasNext()) {
      const ex = existing.next();
      _logBackup('success', ex.getId(), '当日バックアップ既存のためスキップ: ' + fileName);
      const deleted = _cleanupOldBackups(folder);
      return { ok: true, fileId: ex.getId(), fileName: fileName, skipped: true, deleted: deleted };
    }

    // makeCopy: スプレッドシート全体をコピー
    const sourceFile = DriveApp.getFileById(ssId);
    const copy = sourceFile.makeCopy(fileName, folder);
    const fileId = copy.getId();
    _logBackup('success', fileId, 'バックアップ作成: ' + fileName);

    // 古いバックアップを削除
    const deleted = _cleanupOldBackups(folder);

    return { ok: true, fileId: fileId, fileName: fileName, deleted: deleted };
  } catch (err) {
    console.error('[runDailyBackup]', err);
    _logBackup('failure', '', String(err));
    return { ok: false, message: String(err) };
  }
}

// バックアップ一覧取得（管理画面/動作確認用）
// 戻り値: { ok, files: [{name, fileId, createdAt, size}, ...] }
function listBackups() {
  try {
    const folder = _ensureBackupFolder();
    const files = folder.getFiles();
    const list = [];
    while (files.hasNext()) {
      const f = files.next();
      list.push({
        name: f.getName(),
        fileId: f.getId(),
        createdAt: Utilities.formatDate(f.getDateCreated(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
        size: f.getSize()
      });
    }
    list.sort(function(a, b){ return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0; });
    return { ok: true, files: list, folderName: BACKUP_FOLDER_NAME };
  } catch (err) {
    console.error('[listBackups]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// お詫び連続日数 +1 機能（4/26 連続日数バグの被害補償）
// =============================================
// 用途: 生徒IDを持つ全生徒の Students.STREAK を +1。併せて HPLog に
//       type='apology_streak_bonus' のお詫び記録を残す。
//       対象判定: 生徒ID（COL_ID）が空欄でなければ全員。ニックネームの
//       有無は問わない（ふくちさん方針：「+1 を生かすかは生徒次第。
//       ちゃんとやる子にとっては得、そうじゃない子にとっては意味ない。
//       これで良い。」）
// 想定運用: 4/27 朝、生徒のログインが始まる前に GAS エディタから 1 回だけ実行。
//           Time-based Trigger は設定しない。
// 引数: opts = { dryRun?: boolean, force?: boolean }
//   - dryRun=true: シートを更新せず、対象生徒一覧（旧→新の対比）を返す
//   - force=true:  実行済みフラグを無視して強制実行（緊急再実行用）
// 冪等性: なし。同じ日に2回実行すると2人分加算される。
//   そのため PropertiesService に APOLOGY_FLAG_KEY フラグを保存し、
//   2回目以降は force=true でない限りエラーで止める。
// 戻り値: { ok, dryRun, alreadyExecuted?, totalStudents, updated, skipped, updates: [...] }
//   - skipped は生徒ID空欄の行（ヘッダー直下の空行など）のカウント

const APOLOGY_FLAG_KEY = 'apology_streak_bonus_executed_2026_04_27';
const APOLOGY_TYPE     = 'apology_streak_bonus';
const APOLOGY_MESSAGE  = '連続日数+1のお詫び付与';

// HPLog にメッセージ列があれば追加し、ヘッダー位置を返す
// 戻り値: { sh, cTimestamp, cSid, cRawHP, cHpGained, cType, cMessage(=null if not present) }
function _ensureHpLogMessageColumn() {
  const ss = _ss();
  let sh = ss.getSheetByName(SHEET_HPLOG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_HPLOG);
    sh.getRange(1, 1, 1, 6).setValues([['timestamp', 'studentId', 'rawHP', 'hpGained', 'type', 'message']]);
  } else {
    const lastCol = Math.max(1, sh.getLastColumn());
    const header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    if (header.indexOf('message') < 0) {
      sh.getRange(1, lastCol + 1).setValue('message');
    }
  }
  // 再読込
  const lastCol2 = sh.getLastColumn();
  const header2 = sh.getRange(1, 1, 1, lastCol2).getValues()[0];
  return {
    sh: sh,
    cTimestamp: header2.indexOf('timestamp'),
    cSid:       header2.indexOf('studentId'),
    cRawHP:     header2.indexOf('rawHP'),
    cHpGained:  header2.indexOf('hpGained'),
    cType:      header2.indexOf('type'),
    cMessage:   header2.indexOf('message'),
    lastCol:    lastCol2
  };
}

// ※ Step 2：本関数は Students 専用（実生徒のみ対象）。お詫び連続日数 +1 は実生徒の被害補償。
function apologyStreakBonus(opts) {
  try {
    opts = opts || {};
    const dryRun = !!opts.dryRun;
    const force  = !!opts.force;

    const props = _props();
    const flagged = props.getProperty(APOLOGY_FLAG_KEY) === '1';
    if (flagged && !force && !dryRun) {
      return {
        ok: false,
        alreadyExecuted: true,
        message: '既に実行済みです（' + APOLOGY_FLAG_KEY + '）。再実行する場合は apologyStreakBonus({ force: true }) を使ってください。'
      };
    }

    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    if (!stuSheet) return { ok: false, message: 'Students シートが見つかりません' };

    // cache 経由禁止: 直接読み（ふくちさんの dryRun 確認時に最新値を見せたいため）
    const stuValues = stuSheet.getDataRange().getValues();
    const totalStudents = stuValues.length - 1;

    const updates = [];
    let skipped = 0;
    for (let i = 1; i < stuValues.length; i++) {
      const sid = String(stuValues[i][COL_ID] || '').trim();
      const nickname = String(stuValues[i][COL_NICKNAME] || '').trim();
      // 生徒IDが空欄の行のみ除外（ヘッダー後の空行など）
      // ニックネームの有無は問わない（ふくちさん方針：「+1 を生かすかは生徒次第」）
      if (!sid) { skipped += 1; continue; }
      const oldStreak = Number(stuValues[i][COL_STREAK]) || 0;
      const newStreak = oldStreak + 1;
      updates.push({
        rowIdx: i,
        sid: sid,
        name: String(stuValues[i][COL_NAME] || ''),
        nickname: nickname,
        oldStreak: oldStreak,
        newStreak: newStreak
      });
    }

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        alreadyExecuted: flagged,
        totalStudents: totalStudents,
        updated: updates.length,
        skipped: skipped,
        updates: updates
      };
    }

    // 本番実行: STREAK 列の一括書き込み
    if (updates.length > 0) {
      // 連続範囲で setValues できないので 1 件ずつ setValue
      // （生徒数 100 名程度なら数秒で終わる）
      for (let k = 0; k < updates.length; k++) {
        const u = updates[k];
        stuSheet.getRange(u.rowIdx + 1, COL_STREAK + 1).setValue(u.newStreak);
      }

      // HPLog にお詫び記録を追加
      const log = _ensureHpLogMessageColumn();
      const now = _nowJST();
      const rowsToAppend = updates.map(function(u){
        const row = new Array(log.lastCol).fill('');
        if (log.cTimestamp >= 0) row[log.cTimestamp] = now;
        if (log.cSid       >= 0) row[log.cSid]       = u.sid;
        if (log.cRawHP     >= 0) row[log.cRawHP]     = 0;
        if (log.cHpGained  >= 0) row[log.cHpGained]  = 0;
        if (log.cType      >= 0) row[log.cType]      = APOLOGY_TYPE;
        if (log.cMessage   >= 0) row[log.cMessage]   = APOLOGY_MESSAGE;
        return row;
      });
      log.sh.getRange(log.sh.getLastRow() + 1, 1, rowsToAppend.length, log.lastCol)
            .setValues(rowsToAppend);

      // cache invalidate（書き込み済みの STREAK が cache 経由で stale にならないように）
      _invalidateCache('cache_students_values');
      _invalidateCache('cache_ranking_last_week');

      // 実行済みフラグ
      props.setProperty(APOLOGY_FLAG_KEY, '1');
    }

    return {
      ok: true,
      dryRun: false,
      alreadyExecuted: flagged,
      forced: flagged && force,
      totalStudents: totalStudents,
      updated: updates.length,
      skipped: skipped,
      updates: updates
    };
  } catch (err) {
    console.error('[apologyStreakBonus]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// お詫びHP 機能（和文英訳①の判定基準改善のお詫び）
// =============================================
// 背景: 4/27 本番運用開始日、和文英訳①の判定が「スペース・全半角・句読点」も
//       完全一致を要求していたため、内容は正しいのに不正解判定された生徒が多発。
//       4/27 中に判定基準を緩和したため、過去のデータ再判定はせず（A案）、
//       「この問題に取り組んだ生徒」全員にお詫びHPを一律付与する。
// 想定運用: GAS エディタから 1 回だけ実行。Time-based Trigger は設定しない。
// 対象判定: Wabun1Submissions に指定日の提出記録がある生徒（重複は ID で uniq）
//          + additionalStudentIds に指定された生徒（手動追加、ログにない救済対象）
//          - excludeStudentIds に指定された生徒（テストアカウント等を除外）
// 引数: opts = { dryRun?, force?, date?, hpAmount?, additionalStudentIds?, excludeStudentIds? }
//   - date: 'yyyy-MM-dd'（既定 '2026-04-27'）。Wabun1Submissions の timestamp の
//           日付部分（JST）が一致した行を集計。
//   - hpAmount: 一律付与額（既定 100）。和文英訳① 1 セットの通常獲得 HP と同額。
//   - additionalStudentIds: string[]（既定 []）。ログに残らないが本人申告等で
//     取り組みが確認できた生徒の ID。ログ既存の ID と重複した場合はログ側を優先
//     （二重加算しない）。updates 内で source='manual' / manuallyAdded=true で識別可能。
//   - excludeStudentIds: string[]（既定 []）。テストアカウントや実際には取り組んで
//     いない生徒を除外する。ログ由来 / 手動追加どちらからも除外され、updates にも
//     含まれない（HP 加算もされない）。excludeStudentIds は additionalStudentIds より
//     優先（同じ ID が両方にあれば除外側が勝つ）。
//   - dryRun: シートを更新せず対象一覧を返す
//   - force:  実行済みフラグを無視して強制実行
// 冪等性: PropertiesService に APOLOGY_WABUN1_FLAG_KEY_PREFIX + date のフラグを
//   保存。同じ日付に対する 2 回目以降は force=true でない限りエラーで止める。
//   注意: 手動追加分の追加だけのために再実行する場合も force=true が必要。
// 戻り値: { ok, dryRun, alreadyExecuted?, date, hpAmount, totalSubmitters,
//   additionalRequested, additionalApplied, excludeRequested, excludeApplied,
//   totalTargets, updated, skipped, updates: [...] }
//   - totalSubmitters: ログ由来の対象人数（除外前）
//   - additionalRequested: 手動指定された人数
//   - additionalApplied: 手動指定のうちログ重複を除いて実際に追加された人数（除外前）
//   - excludeRequested: 除外指定された人数
//   - excludeApplied: 実際に除外された人数（候補に含まれていたもののみカウント）
//   - totalTargets: 最終対象人数（ログ + 手動 - 除外、重複除く）
//   - skipped: Students に存在しない studentId（退会・誤入力など）のカウント

const APOLOGY_WABUN1_TYPE              = 'apology_wabun1';
const APOLOGY_WABUN1_MESSAGE_TEMPLATE  = '和文英訳①の判定基準改善のお詫び付与（{date}分）';
const APOLOGY_WABUN1_FLAG_KEY_PREFIX   = 'apology_wabun1_executed_';

// 共通: 指定日（JST）に Wabun1Submissions に提出記録のある studentId のユニーク集合を返す
// 戻り値: Map（key=studentId, value={ count: 提出回数, firstAt: 最初の timestamp }）
function _wabun1SubmittersByDate(dateStr) {
  const out = {};
  const sh = _ss().getSheetByName(SHEET_WABUN1_SUBMISSIONS);
  if (!sh || sh.getLastRow() < 2) return out;
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) continue;
    const ts = new Date(r[0]);
    if (isNaN(ts.getTime())) continue;
    const ds = Utilities.formatDate(ts, 'Asia/Tokyo', 'yyyy-MM-dd');
    if (ds !== dateStr) continue;
    const sid = String(r[1] || '').trim();
    if (!sid) continue;
    const tsStr = Utilities.formatDate(ts, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    if (!out[sid]) {
      out[sid] = { count: 1, firstAt: tsStr, lastAt: tsStr };
    } else {
      out[sid].count += 1;
      if (tsStr < out[sid].firstAt) out[sid].firstAt = tsStr;
      if (tsStr > out[sid].lastAt)  out[sid].lastAt  = tsStr;
    }
  }
  return out;
}

// 公開ヘルパー: 指定日の和文英訳①提出者一覧を返す（GAS エディタから事前確認用）
// params: { date?: 'yyyy-MM-dd' }（既定: 今日）
// 戻り値: { ok, date, count, submitters: [{ studentId, name, nickname, count, firstAt, lastAt }] }
// ※ Step 2：本関数は Students 専用（apologyWabun1Bonus の内部関数として）。
function getWabun1SubmittersByDate(params) {
  try {
    const date = String((params && params.date) || _todayJST());
    const stuRows = _getStudentsValues();
    const stuMap = {};
    if (stuRows && stuRows.length > 1) {
      for (let i = 1; i < stuRows.length; i++) {
        const sid = String(stuRows[i][COL_ID] || '').trim();
        if (!sid) continue;
        stuMap[sid] = {
          name:     String(stuRows[i][COL_NAME] || '').trim(),
          nickname: String(stuRows[i][COL_NICKNAME] || '').trim()
        };
      }
    }
    const subMap = _wabun1SubmittersByDate(date);
    const submitters = Object.keys(subMap).map(function(sid){
      const s = subMap[sid];
      const info = stuMap[sid] || { name: '', nickname: '' };
      return {
        studentId: sid,
        name:      info.name,
        nickname:  info.nickname,
        count:     s.count,
        firstAt:   s.firstAt,
        lastAt:    s.lastAt
      };
    }).sort(function(a, b){ return a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0; });
    return { ok: true, date: date, count: submitters.length, submitters: submitters };
  } catch (err) {
    console.error('[getWabun1SubmittersByDate]', err);
    return { ok: false, message: String(err) };
  }
}

// ※ Step 2：本関数は Students 専用（実生徒のみ対象）。お詫び HP 付与は実生徒の被害補償。
function apologyWabun1Bonus(opts) {
  try {
    opts = opts || {};
    const dryRun   = !!opts.dryRun;
    const force    = !!opts.force;
    const date     = String(opts.date || '2026-04-27');
    const hpAmount = (opts.hpAmount != null) ? Number(opts.hpAmount) : 100;
    if (!(hpAmount > 0)) return { ok: false, message: 'hpAmount は 1 以上の数値で指定してください' };

    // 手動追加対象（ログに残らないが本人申告等で取り組みが確認できた生徒）
    // - 文字列の trim、空欄/null 除去
    // - 重複は後段で排除（ログ既存の生徒と重複した場合はログ側を優先＝source='log'）
    const additionalRaw = Array.isArray(opts.additionalStudentIds) ? opts.additionalStudentIds : [];
    const additionalNorm = [];
    const additionalSeen = {};
    for (let i = 0; i < additionalRaw.length; i++) {
      const sid = String(additionalRaw[i] == null ? '' : additionalRaw[i]).trim();
      if (!sid) continue;
      if (additionalSeen[sid]) continue;
      additionalSeen[sid] = true;
      additionalNorm.push(sid);
    }

    // 除外対象（テストアカウント / 実際には取り組んでいない生徒）
    // ログ由来・手動追加どちらからも除外する（excludeStudentIds が最優先）
    const excludeRaw = Array.isArray(opts.excludeStudentIds) ? opts.excludeStudentIds : [];
    const excludeSet = {};
    const excludeNorm = [];
    for (let i = 0; i < excludeRaw.length; i++) {
      const sid = String(excludeRaw[i] == null ? '' : excludeRaw[i]).trim();
      if (!sid) continue;
      if (excludeSet[sid]) continue;
      excludeSet[sid] = true;
      excludeNorm.push(sid);
    }

    const flagKey = APOLOGY_WABUN1_FLAG_KEY_PREFIX + date;
    const props = _props();
    const flagged = props.getProperty(flagKey) === '1';
    if (flagged && !force && !dryRun) {
      return {
        ok: false,
        alreadyExecuted: true,
        message: '既に実行済みです（' + flagKey + '）。再実行する場合は apologyWabun1Bonus({ date: \'' + date + '\', force: true }) を使ってください。'
      };
    }

    // 提出者集計（ログ由来）
    const subMap = _wabun1SubmittersByDate(date);
    const submitterIds = Object.keys(subMap);
    // 手動追加だが既にログにいる ID は二重加算しない（source='log' を優先）
    const onlyManualIds = additionalNorm.filter(function(sid){ return !subMap[sid]; });
    // 除外前の合計（excludeApplied 算出のため保持）
    const preExcludeIds = submitterIds.concat(onlyManualIds);
    // 除外適用後の最終対象
    const allTargetIds = preExcludeIds.filter(function(sid){ return !excludeSet[sid]; });
    const excludeApplied = preExcludeIds.length - allTargetIds.length;

    if (allTargetIds.length === 0) {
      return {
        ok: true, dryRun: dryRun, date: date, hpAmount: hpAmount,
        totalSubmitters: submitterIds.length,
        additionalRequested: additionalNorm.length, additionalApplied: 0,
        excludeRequested: excludeNorm.length, excludeApplied: excludeApplied,
        totalTargets: 0, updated: 0, skipped: 0, updates: []
      };
    }

    // Students 走査（cache 経由禁止: ふくちさんに最新値を見せる）
    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    if (!stuSheet) return { ok: false, message: 'Students シートが見つかりません' };
    const stuValues = stuSheet.getDataRange().getValues();
    const sidToRow = {};
    for (let i = 1; i < stuValues.length; i++) {
      const sid = String(stuValues[i][COL_ID] || '').trim();
      if (sid) sidToRow[sid] = i;
    }

    const updates = [];
    let skipped = 0;
    allTargetIds.forEach(function(sid){
      const rowIdx = sidToRow[sid];
      if (rowIdx == null) { skipped += 1; return; }
      const fromLog = !!subMap[sid];
      const sub = subMap[sid] || {};
      const oldHP = Number(stuValues[rowIdx][COL_HP]) || 0;
      const newHP = oldHP + hpAmount;
      updates.push({
        rowIdx: rowIdx,
        sid: sid,
        name:     String(stuValues[rowIdx][COL_NAME] || ''),
        nickname: String(stuValues[rowIdx][COL_NICKNAME] || ''),
        source: fromLog ? 'log' : 'manual',
        manuallyAdded: !fromLog,
        submissionCount: sub.count || 0,
        firstAt: sub.firstAt || '',
        lastAt:  sub.lastAt  || '',
        oldHP: oldHP,
        newHP: newHP,
        hpAdded: hpAmount
      });
    });

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        alreadyExecuted: flagged,
        date: date,
        hpAmount: hpAmount,
        totalSubmitters: submitterIds.length,
        additionalRequested: additionalNorm.length,
        additionalApplied: onlyManualIds.length,
        excludeRequested: excludeNorm.length,
        excludeApplied: excludeApplied,
        totalTargets: allTargetIds.length,
        updated: updates.length,
        skipped: skipped,
        updates: updates
      };
    }

    if (updates.length > 0) {
      // HP 列を 1 件ずつ書き込み（連続範囲ではないため setValues 不可）
      for (let k = 0; k < updates.length; k++) {
        const u = updates[k];
        stuSheet.getRange(u.rowIdx + 1, COL_HP + 1).setValue(u.newHP);
      }

      // HPLog にお詫び記録（ログ由来も手動追加も同じ type='apology_wabun1' で統一）
      const log = _ensureHpLogMessageColumn();
      const now = _nowJST();
      const message = APOLOGY_WABUN1_MESSAGE_TEMPLATE.replace('{date}', date);
      const rowsToAppend = updates.map(function(u){
        const row = new Array(log.lastCol).fill('');
        if (log.cTimestamp >= 0) row[log.cTimestamp] = now;
        if (log.cSid       >= 0) row[log.cSid]       = u.sid;
        if (log.cRawHP     >= 0) row[log.cRawHP]     = u.hpAdded;
        if (log.cHpGained  >= 0) row[log.cHpGained]  = u.hpAdded;
        if (log.cType      >= 0) row[log.cType]      = APOLOGY_WABUN1_TYPE;
        if (log.cMessage   >= 0) row[log.cMessage]   = message;
        return row;
      });
      log.sh.getRange(log.sh.getLastRow() + 1, 1, rowsToAppend.length, log.lastCol)
            .setValues(rowsToAppend);

      // cache invalidate
      _invalidateCache('cache_students_values');
      _invalidateCache('cache_ranking_last_week');

      // 実行済みフラグ
      props.setProperty(flagKey, '1');
    }

    return {
      ok: true,
      dryRun: false,
      alreadyExecuted: flagged,
      forced: flagged && force,
      date: date,
      hpAmount: hpAmount,
      totalSubmitters: submitterIds.length,
      additionalRequested: additionalNorm.length,
      additionalApplied: onlyManualIds.length,
      excludeRequested: excludeNorm.length,
      excludeApplied: excludeApplied,
      totalTargets: allTargetIds.length,
      updated: updates.length,
      skipped: skipped,
      updates: updates
    };
  } catch (err) {
    console.error('[apologyWabun1Bonus]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// お詫びHP 機能（基礎計算の写真送信不具合のお詫び）
// =============================================
// 背景: 4/27 本番運用開始日、基礎計算の写真送信が gasPost 未定義により
//       「マイカツ君が照合中」のまま固まり、KisoSessions にはセッション開始の
//       記録だけが残ったが採点・HP 付与は実行されなかった。
//       4/27 中に修正を入れたため、過去のセッション再採点はせず、
//       「セッションを開始した（=取り組もうとした）生徒」全員にお詫びHPを一律付与する。
// 想定運用: GAS エディタから 1 回だけ実行。Time-based Trigger は設定しない。
// 対象判定: KisoSessions の startedAt 日付部分（JST）が指定日と一致する生徒
//          （重複は ID で uniq）+ additionalStudentIds に指定された生徒
//          - excludeStudentIds に指定された生徒（テストアカウント等を除外）
// 引数: opts = { dryRun?, force?, date?, hpAmount?, additionalStudentIds?, excludeStudentIds? }
//   - date: 'yyyy-MM-dd'（既定 '2026-04-27'）。KisoSessions.startedAt は文字列
//           'yyyy-MM-dd HH:mm:ss' 形式（_nowJST 由来）なので先頭 10 文字で日付一致判定。
//   - hpAmount: 一律付与額（既定 100）。
//   - additionalStudentIds: string[]（既定 []）。ログに残らない救済対象。
//     セッション既存 ID と重複した場合はセッション側を優先（二重加算しない）。
//     updates 内で source='manual' / manuallyAdded=true で識別可能。
//   - excludeStudentIds: string[]（既定 []）。テストアカウントや実際には取り組んで
//     いない生徒を除外。セッション由来 / 手動追加どちらからも除外され、updates にも
//     含まれない（HP 加算もされない）。excludeStudentIds は additionalStudentIds より
//     優先（同じ ID が両方にあれば除外側が勝つ）。
//   - dryRun: シートを更新せず対象一覧を返す
//   - force:  実行済みフラグを無視して強制実行
// 冪等性: PropertiesService に APOLOGY_KISO_FLAG_KEY_PREFIX + date のフラグを保存。
//   2 回目以降は force=true でない限りエラーで止める。
//   注意: 手動追加分の追加だけのために再実行する場合も force=true が必要。
// 戻り値: { ok, dryRun, alreadyExecuted?, date, hpAmount, totalChallengers,
//   additionalRequested, additionalApplied, excludeRequested, excludeApplied,
//   totalTargets, updated, skipped, updates: [...] }
//   - totalChallengers: KisoSessions 由来の対象人数（除外前）
//   - additionalRequested: 手動指定された人数
//   - additionalApplied: 手動指定のうちセッション重複を除いて実際に追加された人数（除外前）
//   - excludeRequested: 除外指定された人数
//   - excludeApplied: 実際に除外された人数（候補に含まれていたもののみカウント）
//   - totalTargets: 最終対象人数（セッション + 手動 - 除外、重複除く）
//   - skipped: Students に存在しない studentId のカウント

const APOLOGY_KISO_TYPE              = 'apology_kiso';
const APOLOGY_KISO_MESSAGE_TEMPLATE  = '基礎計算の写真送信不具合のお詫び付与（{date}分）';
const APOLOGY_KISO_FLAG_KEY_PREFIX   = 'apology_kiso_executed_';

// 共通: 指定日（JST）に KisoSessions に startedAt のある studentId のユニーク集合を返す
// 戻り値: Map（key=studentId, value={ sessionCount, firstAt, lastAt, ranks: [unique], counts: [unique] }）
// startedAt は _nowJST() 由来の 'yyyy-MM-dd HH:mm:ss' 文字列前提（先頭10文字で日付判定）
// 列順序は KISO_SESSIONS_HEADERS 参照: [0]sessionId [1]studentId [2]rank [3]count
//   [4]questionIds [5]status [6]attempts [7]startedAt [8]completedAt [9]hpEarned [10]wrongIds
function _kisoChallengersByDate(dateStr) {
  const out = {};
  const sh = _ss().getSheetByName(SHEET_KISO_SESSIONS);
  if (!sh || sh.getLastRow() < 2) return out;
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const sid = String(r[1] || '').trim();
    if (!sid) continue;
    // startedAt は文字列 or Date のどちらでも安全に扱う
    let startedRaw = r[7];
    if (!startedRaw) continue;
    let startedStr;
    if (startedRaw instanceof Date) {
      startedStr = Utilities.formatDate(startedRaw, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    } else {
      startedStr = String(startedRaw);
    }
    const ds = startedStr.slice(0, 10);
    if (ds !== dateStr) continue;
    const rank = Number(r[2]) || 0;
    const count = Number(r[3]) || 0;
    if (!out[sid]) {
      out[sid] = { sessionCount: 1, firstAt: startedStr, lastAt: startedStr, ranks: [], counts: [] };
    } else {
      out[sid].sessionCount += 1;
      if (startedStr < out[sid].firstAt) out[sid].firstAt = startedStr;
      if (startedStr > out[sid].lastAt)  out[sid].lastAt  = startedStr;
    }
    if (rank && out[sid].ranks.indexOf(rank) < 0)   out[sid].ranks.push(rank);
    if (count && out[sid].counts.indexOf(count) < 0) out[sid].counts.push(count);
  }
  // ranks / counts を昇順ソート
  Object.keys(out).forEach(function(sid){
    out[sid].ranks.sort(function(a, b){ return a - b; });
    out[sid].counts.sort(function(a, b){ return a - b; });
  });
  return out;
}

// 公開ヘルパー: 指定日の基礎計算チャレンジ生徒一覧を返す（GAS エディタから事前確認用）
// params: { date?: 'yyyy-MM-dd' }（既定: 今日）
// 戻り値: { ok, date, count, challengers: [{ studentId, name, nickname, sessionCount, firstAt, lastAt, ranks, counts }] }
// ※ Step 2：本関数は Students 専用（apologyKisoBonus の内部関数として）。
function getKisoChallengersByDate(params) {
  try {
    const date = String((params && params.date) || _todayJST());
    const stuRows = _getStudentsValues();
    const stuMap = {};
    if (stuRows && stuRows.length > 1) {
      for (let i = 1; i < stuRows.length; i++) {
        const sid = String(stuRows[i][COL_ID] || '').trim();
        if (!sid) continue;
        stuMap[sid] = {
          name:     String(stuRows[i][COL_NAME] || '').trim(),
          nickname: String(stuRows[i][COL_NICKNAME] || '').trim()
        };
      }
    }
    const subMap = _kisoChallengersByDate(date);
    const challengers = Object.keys(subMap).map(function(sid){
      const s = subMap[sid];
      const info = stuMap[sid] || { name: '', nickname: '' };
      return {
        studentId:    sid,
        name:         info.name,
        nickname:     info.nickname,
        sessionCount: s.sessionCount,
        firstAt:      s.firstAt,
        lastAt:       s.lastAt,
        ranks:        s.ranks,
        counts:       s.counts
      };
    }).sort(function(a, b){ return a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0; });
    return { ok: true, date: date, count: challengers.length, challengers: challengers };
  } catch (err) {
    console.error('[getKisoChallengersByDate]', err);
    return { ok: false, message: String(err) };
  }
}

// ※ Step 2：本関数は Students 専用（実生徒のみ対象）。お詫び HP 付与は実生徒の被害補償。
function apologyKisoBonus(opts) {
  try {
    opts = opts || {};
    const dryRun   = !!opts.dryRun;
    const force    = !!opts.force;
    const date     = String(opts.date || '2026-04-27');
    const hpAmount = (opts.hpAmount != null) ? Number(opts.hpAmount) : 100;
    if (!(hpAmount > 0)) return { ok: false, message: 'hpAmount は 1 以上の数値で指定してください' };

    // 手動追加対象（apologyWabun1Bonus と同設計）
    const additionalRaw = Array.isArray(opts.additionalStudentIds) ? opts.additionalStudentIds : [];
    const additionalNorm = [];
    const additionalSeen = {};
    for (let i = 0; i < additionalRaw.length; i++) {
      const sid = String(additionalRaw[i] == null ? '' : additionalRaw[i]).trim();
      if (!sid) continue;
      if (additionalSeen[sid]) continue;
      additionalSeen[sid] = true;
      additionalNorm.push(sid);
    }

    // 除外対象（テストアカウント / 実際には取り組んでいない生徒）
    // セッション由来・手動追加どちらからも除外する（excludeStudentIds が最優先）
    const excludeRaw = Array.isArray(opts.excludeStudentIds) ? opts.excludeStudentIds : [];
    const excludeSet = {};
    const excludeNorm = [];
    for (let i = 0; i < excludeRaw.length; i++) {
      const sid = String(excludeRaw[i] == null ? '' : excludeRaw[i]).trim();
      if (!sid) continue;
      if (excludeSet[sid]) continue;
      excludeSet[sid] = true;
      excludeNorm.push(sid);
    }

    const flagKey = APOLOGY_KISO_FLAG_KEY_PREFIX + date;
    const props = _props();
    const flagged = props.getProperty(flagKey) === '1';
    if (flagged && !force && !dryRun) {
      return {
        ok: false,
        alreadyExecuted: true,
        message: '既に実行済みです（' + flagKey + '）。再実行する場合は apologyKisoBonus({ date: \'' + date + '\', force: true }) を使ってください。'
      };
    }

    // KisoSessions 由来のチャレンジ集計
    const subMap = _kisoChallengersByDate(date);
    const challengerIds = Object.keys(subMap);
    const onlyManualIds = additionalNorm.filter(function(sid){ return !subMap[sid]; });
    // 除外前の合計（excludeApplied 算出のため保持）
    const preExcludeIds = challengerIds.concat(onlyManualIds);
    // 除外適用後の最終対象
    const allTargetIds = preExcludeIds.filter(function(sid){ return !excludeSet[sid]; });
    const excludeApplied = preExcludeIds.length - allTargetIds.length;

    if (allTargetIds.length === 0) {
      return {
        ok: true, dryRun: dryRun, date: date, hpAmount: hpAmount,
        totalChallengers: challengerIds.length,
        additionalRequested: additionalNorm.length, additionalApplied: 0,
        excludeRequested: excludeNorm.length, excludeApplied: excludeApplied,
        totalTargets: 0, updated: 0, skipped: 0, updates: []
      };
    }

    // Students 走査（cache 経由禁止: ふくちさんに最新値を見せる）
    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    if (!stuSheet) return { ok: false, message: 'Students シートが見つかりません' };
    const stuValues = stuSheet.getDataRange().getValues();
    const sidToRow = {};
    for (let i = 1; i < stuValues.length; i++) {
      const sid = String(stuValues[i][COL_ID] || '').trim();
      if (sid) sidToRow[sid] = i;
    }

    const updates = [];
    let skipped = 0;
    allTargetIds.forEach(function(sid){
      const rowIdx = sidToRow[sid];
      if (rowIdx == null) { skipped += 1; return; }
      const fromLog = !!subMap[sid];
      const sub = subMap[sid] || {};
      const oldHP = Number(stuValues[rowIdx][COL_HP]) || 0;
      const newHP = oldHP + hpAmount;
      updates.push({
        rowIdx: rowIdx,
        sid: sid,
        name:     String(stuValues[rowIdx][COL_NAME] || ''),
        nickname: String(stuValues[rowIdx][COL_NICKNAME] || ''),
        source: fromLog ? 'log' : 'manual',
        manuallyAdded: !fromLog,
        sessionCount: sub.sessionCount || 0,
        ranks:        sub.ranks  || [],
        counts:       sub.counts || [],
        firstAt: sub.firstAt || '',
        lastAt:  sub.lastAt  || '',
        oldHP: oldHP,
        newHP: newHP,
        hpAdded: hpAmount
      });
    });

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        alreadyExecuted: flagged,
        date: date,
        hpAmount: hpAmount,
        totalChallengers: challengerIds.length,
        additionalRequested: additionalNorm.length,
        additionalApplied: onlyManualIds.length,
        excludeRequested: excludeNorm.length,
        excludeApplied: excludeApplied,
        totalTargets: allTargetIds.length,
        updated: updates.length,
        skipped: skipped,
        updates: updates
      };
    }

    if (updates.length > 0) {
      // HP 列を 1 件ずつ書き込み
      for (let k = 0; k < updates.length; k++) {
        const u = updates[k];
        stuSheet.getRange(u.rowIdx + 1, COL_HP + 1).setValue(u.newHP);
      }

      // HPLog にお詫び記録（全 updates 同じ type='apology_kiso'）
      const log = _ensureHpLogMessageColumn();
      const now = _nowJST();
      const message = APOLOGY_KISO_MESSAGE_TEMPLATE.replace('{date}', date);
      const rowsToAppend = updates.map(function(u){
        const row = new Array(log.lastCol).fill('');
        if (log.cTimestamp >= 0) row[log.cTimestamp] = now;
        if (log.cSid       >= 0) row[log.cSid]       = u.sid;
        if (log.cRawHP     >= 0) row[log.cRawHP]     = u.hpAdded;
        if (log.cHpGained  >= 0) row[log.cHpGained]  = u.hpAdded;
        if (log.cType      >= 0) row[log.cType]      = APOLOGY_KISO_TYPE;
        if (log.cMessage   >= 0) row[log.cMessage]   = message;
        return row;
      });
      log.sh.getRange(log.sh.getLastRow() + 1, 1, rowsToAppend.length, log.lastCol)
            .setValues(rowsToAppend);

      // cache invalidate
      _invalidateCache('cache_students_values');
      _invalidateCache('cache_ranking_last_week');

      // 実行済みフラグ
      props.setProperty(flagKey, '1');
    }

    return {
      ok: true,
      dryRun: false,
      alreadyExecuted: flagged,
      forced: flagged && force,
      date: date,
      hpAmount: hpAmount,
      totalChallengers: challengerIds.length,
      additionalRequested: additionalNorm.length,
      additionalApplied: onlyManualIds.length,
      excludeRequested: excludeNorm.length,
      excludeApplied: excludeApplied,
      totalTargets: allTargetIds.length,
      updated: updates.length,
      skipped: skipped,
      updates: updates
    };
  } catch (err) {
    console.error('[apologyKisoBonus]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 基礎計算 Phase 4-1：シート整備
// =============================================
// 用途: KisoQuestions / KisoSessions / KisoPhotos の 3 シートを存在保証する。
//       各シートが未作成であればヘッダー行付きで自動作成する。
//       仕様書 §3.1 に基づく列構成。
//
// 読み出し時に毎回呼ばれる安価なチェックなので、_ss().getSheetByName() の
// オーバーヘッドのみ。シート存在時は即座に return。
//
// 列構成は仕様書を信頼ソースとし、ここでは ensure 関数のヘッダー行と
// 順序を仕様書と完全一致させる。

const KISO_QUESTIONS_HEADERS = [
  'questionId',         // q_{rank}_{連番6桁}
  'rank',               // 1〜20
  'rankName',           // 例：「分数：四則混合」
  'difficultyBand',     // A〜H
  'problemLatex',       // MathJax 表示用
  'answerCanonical',    // 標準解
  'answerAllowed',      // JSON 配列文字列
  'generatedAt'         // 生成日時
];

const KISO_SESSIONS_HEADERS = [
  'sessionId',          // kiso_{sid}_{ts}_{random}
  'studentId',
  'rank',               // 1〜20
  'count',              // 5 or 10
  'questionIds',        // JSON 配列（初回抽出時の全問題ID、固定）
  'status',             // in_progress / passed / failed_retry
  'attempts',           // 提出回数
  'startedAt',
  'completedAt',
  'hpEarned',           // 素点（ボーナス前）
  'wrongIds',           // JSON 配列（前回不正解だった問題IDのサブセット、再挑戦用）
  'hasWorkPhoto',       // 撮影前確認画面で生徒が「途中式の写真も送る」を選んだか（TRUE/FALSE）
  'problemLatexes'      // JSON 配列（startKisoSession 時の問題 LaTeX、questionIds と並列）
                        // Phase 2（100題化）以降の問題プール入れ替えでも、進行中セッションの
                        // 表示が破綻しないよう、開始時の latex を保存。getKisoRetryQuestions /
                        // submitKisoAnswer の表示用 problemLatex はこれを優先参照。
                        // 採点に使う answerAllowed / answerCanonical は引き続き DB から取得
                        // （Phase 2 投入前に diagnose/abandon で in_progress を停止させる運用）。
                        // 既存セッション（この列が空）は従来通り DB ルックアップで動作する。
];

const KISO_PHOTOS_HEADERS = [
  'sessionId',
  'studentId',
  'rank',
  'count',
  'driveFileId',
  'shareUrl',
  'submittedAt',
  'deleteAfter',        // submittedAt + 15 日
  'photoType',          // 'answer'（解答用紙）/ 'work'（途中式、複数枚可）
  'photoIndex'          // 解答は常に 1、途中式は 1, 2, 3... と増える
];

// 共通ヘルパー：シート存在保証 + ヘッダー行設定 + 最低行数の確保
// - シートが無ければ作成し、ヘッダーを 1 行目に設定
// - シートはあるがヘッダーが空ならヘッダーだけ追加（既存データには触らない）
// - シートが既にヘッダー付きで存在し、かつ headers の末尾に追加列があれば、欠落分だけ末尾に追記
// - minRows が指定されていて、かつ現在のシートの最大行数がそれ未満なら、insertRowsAfter で拡張
//   （gspread からの一括 update 時に "exceeds grid limits" エラーを避けるため）
function _ensureSheetWithHeaders(sheetName, headers, minRows) {
  const ss = _ss();
  let sh = ss.getSheetByName(sheetName);
  let created = false;
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    created = true;
  } else if (sh.getLastRow() === 0) {
    // 完全に空のシート（手動作成された直後など）
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    // 既にヘッダー付きで存在 → schema migration 対応
    // 注意：sh.getLastColumn() は「データ行を含めて」最後に値があるカラム位置を返す。
    // ヘッダー行に値がなくても、データ行のどこかに値があればその列も existingLastCol に含まれる。
    // 例：ヘッダーは A〜H（8 列）だが、データ行の K 列にメモがあれば getLastColumn() = 11。
    // この場合、existingHeaders は 11 件取得され、I〜K のヘッダーセル値は空文字になる。
    // 旧実装ではこれを「11 列分の既存ヘッダー」と見做して、末尾追記だけで I〜K の空ヘッダーを放置していた。
    // 2026-05-12 修正：既存ヘッダー範囲内の空セルも new headers の値で埋める自己修復ロジックを追加。
    //   - 既存ヘッダー位置のセル値が **空文字 or null** なら、new headers の対応位置で埋める
    //   - 既存値が non-empty なら温存（誤改名を防ぐため後方互換）
    //   - これにより「データ行に値があるが、ヘッダー行は空」というシートに対しても再実行で自己修復可能
    const existingLastCol = Math.max(1, sh.getLastColumn());
    const existingHeaders = sh.getRange(1, 1, 1, existingLastCol).getValues()[0];

    // 範囲内の空ヘッダーセルを自己修復
    const fillCount = Math.min(existingHeaders.length, headers.length);
    let needFillUpdate = false;
    const filledHeaders = existingHeaders.slice(0, fillCount);
    for (let i = 0; i < fillCount; i++) {
      const v = filledHeaders[i];
      if (v === '' || v === null || v === undefined) {
        filledHeaders[i] = headers[i];
        needFillUpdate = true;
      }
    }
    if (needFillUpdate) {
      sh.getRange(1, 1, 1, fillCount).setValues([filledHeaders]);
    }

    // 末尾の欠落列を追記（既存ロジック）
    if (headers.length > existingHeaders.length) {
      const append = headers.slice(existingHeaders.length);
      sh.getRange(1, existingHeaders.length + 1, 1, append.length).setValues([append]);
    }
  }
  // シート最大行数を最低 minRows まで拡張
  if (minRows && sh.getMaxRows() < minRows) {
    sh.insertRowsAfter(sh.getMaxRows(), minRows - sh.getMaxRows());
  }
  return { sh: sh, created: created };
}

// 各シートの最低行数（書き込みボリューム + バッファ）
// KisoQuestions: 600 問（Phase 1+2）→ 将来 ~20000 問への拡張余地として 2100 確保
// KisoSessions:  appendRow ベース（1 行ずつ追加）なので default で十分。1100 で念のため
// KisoPhotos:    最大 600 枚/15 日 想定なので 1100 で十分
const KISO_MIN_ROWS_QUESTIONS = 2100;
const KISO_MIN_ROWS_SESSIONS  = 1100;
const KISO_MIN_ROWS_PHOTOS    = 1100;

function _ensureKisoQuestionsSheet() {
  return _ensureSheetWithHeaders(SHEET_KISO_QUESTIONS, KISO_QUESTIONS_HEADERS, KISO_MIN_ROWS_QUESTIONS).sh;
}
function _ensureKisoSessionsSheet() {
  return _ensureSheetWithHeaders(SHEET_KISO_SESSIONS, KISO_SESSIONS_HEADERS, KISO_MIN_ROWS_SESSIONS).sh;
}
function _ensureKisoPhotosSheet() {
  return _ensureSheetWithHeaders(SHEET_KISO_PHOTOS, KISO_PHOTOS_HEADERS, KISO_MIN_ROWS_PHOTOS).sh;
}

// 3 シートをまとめて存在保証（GAS エディタからの 1 回限りセットアップ実行用）
// db_writer.py が KisoQuestions に書き込む前に、このシートが存在し、かつ正しい
// ヘッダーが設定されていることを保証するため、Phase 4-1 着手時に最初に実行する。
// 戻り値: { ok, created: { questions, sessions, photos } } - 各 boolean は新規作成されたか
function ensureKisoSheets() {
  try {
    const q = _ensureSheetWithHeaders(SHEET_KISO_QUESTIONS, KISO_QUESTIONS_HEADERS, KISO_MIN_ROWS_QUESTIONS);
    const s = _ensureSheetWithHeaders(SHEET_KISO_SESSIONS,  KISO_SESSIONS_HEADERS,  KISO_MIN_ROWS_SESSIONS);
    const p = _ensureSheetWithHeaders(SHEET_KISO_PHOTOS,    KISO_PHOTOS_HEADERS,    KISO_MIN_ROWS_PHOTOS);
    return {
      ok: true,
      created: {
        questions: q.created,
        sessions:  s.created,
        photos:    p.created
      },
      maxRows: {
        questions: q.sh.getMaxRows(),
        sessions:  s.sh.getMaxRows(),
        photos:    p.sh.getMaxRows()
      },
      headers: {
        questions: KISO_QUESTIONS_HEADERS,
        sessions:  KISO_SESSIONS_HEADERS,
        photos:    KISO_PHOTOS_HEADERS
      }
    };
  } catch (err) {
    console.error('[ensureKisoSheets]', err);
    return { ok: false, message: String(err) };
  }
}

// 動作確認用：KisoQuestions シートからランダム抽出（rank 指定、count 件）
// 仕様書 §3.3 のセッション開始時の問題抽出ロジックを単体で叩けるようにする。
// Phase 4-2 の startKisoSession の試金石として、Phase 4-1 段階でも動かせる。
// 戻り値: { ok, rank, requested, found, sample: [{questionId, problemLatex, answerCanonical}, ...] }
function sampleKisoQuestions(rank, count) {
  try {
    const r = Number(rank) || 0;
    const n = Math.max(1, Math.min(20, Number(count) || 3));
    const sh = _ensureKisoQuestionsSheet();
    if (sh.getLastRow() < 2) return { ok: true, rank: r, requested: n, found: 0, sample: [] };
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const cId    = header.indexOf('questionId');
    const cRank  = header.indexOf('rank');
    const cLatex = header.indexOf('problemLatex');
    const cCan   = header.indexOf('answerCanonical');
    const candidates = [];
    for (let i = 1; i < values.length; i++) {
      if (Number(values[i][cRank]) === r) {
        candidates.push({
          questionId: String(values[i][cId] || ''),
          problemLatex: String(values[i][cLatex] || ''),
          answerCanonical: String(values[i][cCan] || '')
        });
      }
    }
    // Fisher-Yates の途中で打ち切る（必要分だけシャッフル）
    const m = candidates.length;
    const sample = [];
    const taken = {};
    const k = Math.min(n, m);
    while (sample.length < k) {
      const idx = Math.floor(Math.random() * m);
      if (taken[idx]) continue;
      taken[idx] = true;
      sample.push(candidates[idx]);
    }
    return { ok: true, rank: r, requested: n, found: m, sample: sample };
  } catch (err) {
    console.error('[sampleKisoQuestions]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 基礎計算 Phase 4-2：採点ヘルパー
// =============================================

const _KISO_CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];

// 採点用テキスト正規化（仕様書 §7.3）
// 全角→半角、各種マイナス記号統一、√ → \sqrt{n}、空白圧縮など
function _kisoNormalize(s) {
  if (s === null || s === undefined) return '';
  let t = String(s);
  // 全角数字 → 半角
  t = t.replace(/[０-９]/g, function(ch){ return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); });
  // 全角英字 → 半角
  t = t.replace(/[Ａ-Ｚａ-ｚ]/g, function(ch){ return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); });
  // 全角スラッシュ → 半角
  t = t.replace(/／/g, '/');
  // 全角空白 → 半角
  t = t.replace(/　/g, ' ');
  // 各種マイナス記号 → '-'
  t = t.replace(/[−‐‑‒–—―ー─]/g, '-');
  // 全角ピリオド → 半角
  t = t.replace(/．/g, '.');
  // 全角カンマ → 半角
  t = t.replace(/，/g, ',');
  // 全角コロン → 半角
  t = t.replace(/：/g, ':');
  // 全角パーセント → 半角
  t = t.replace(/％/g, '%');
  // 全角プラス → 半角
  t = t.replace(/＋/g, '+');
  // 全角イコール → 半角
  t = t.replace(/＝/g, '=');
  // √ 系記号を \sqrt{n} に統一（OCR で V や ν と誤読される場合があるが、本処理の範囲外）
  t = t.replace(/[√✓]\s*\{([^}]+)\}/g, '\\sqrt{$1}');     // √{15} → \sqrt{15}
  t = t.replace(/[√✓]\s*([0-9]+)/g, '\\sqrt{$1}');         // √15 → \sqrt{15}

  // 指数表記の統一（rank3/4/5/7 の x^{n} canonical と Gemini OCR の x^n を一致させる）
  // ① Unicode 上付き数字を caret 形式へ：x² → x^2、x¹⁰ → x^10
  //   生徒が紙に書いた x² を OCR が ² のまま返してくるケースを救済。
  //   _kisoNormalize 共通の規則として、入る前の表記揺れをすべて x^N に揃える。
  t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, function(seq) {
    const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    let out = '';
    for (let i = 0; i < seq.length; i++) {
      const idx = SUP.indexOf(seq[i]);
      out += (idx >= 0) ? String(idx) : seq[i];
    }
    return '^' + out;
  });
  // ② LaTeX 形式 x^{n} → x^n（poly_latex / square_factor_latex の生成形を caret に統一）
  //   例：x^{2} → x^2、(x + 3)^{2} → (x + 3)^2、x^{10} → x^10、x^{-2} → x^-2
  //   Gemini OCR は「指数は ^ を使う」プロンプトで x^2 を返すため、両者の形を揃える。
  t = t.replace(/\^\{(-?\d+)\}/g, '^$1');
  // 空白の連続を 1 つに圧縮
  t = t.replace(/[ \t]+/g, ' ');
  // 行末の改行は空白に統一
  t = t.replace(/[\r\n]+/g, ' ').replace(/[ \t]+/g, ' ');

  // 単項プラス記号の除去（"+2" → "2"、"x=+5" → "x=5"）
  // 数値・分数・平方根（\sqrt）の前に来る + のみ対象。binary plus（"1+2"）は変えない。
  // パターン1: 文字列先頭の "+" + 数字/小数点/バックスラッシュ
  t = t.replace(/^(\s*)\+(\s*)(?=[\d.\\])/, '$1$2');
  // パターン2: "=" の直後の "+" + 数字/小数点/バックスラッシュ（連立方程式の "x=+5" 対応）
  t = t.replace(/=\s*\+\s*(?=[\d.\\])/g, '=');

  // 純粋な数値（整数 / 小数）の正規化（"2.0" → "2"、"0.50" → "0.5"、"03" → "3"）
  // 分数 "1/2"・帯分数・平方根・連立方程式 "x=5, y=-2" 等は対象外（パターン非一致）
  const trimmedForNum = t.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmedForNum)) {
    const n = parseFloat(trimmedForNum);
    if (isFinite(n)) t = String(n);
  }

  // 前後の空白除去
  return t.trim();
}

function _kisoGcd(a, b) {
  a = Math.abs(a | 0);
  b = Math.abs(b | 0);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function _kisoIsSquareFree(n) {
  if (n < 0) n = -n;
  if (n <= 1) return true;
  for (let p = 2; p * p <= n; p++) {
    if (n % (p * p) === 0) return false;
  }
  return true;
}

// 厳格性チェック（仕様書 §6.8 決定2・3、§7.3 既約性・簡約性の厳格チェック）
// 生徒答えの正規化済み文字列を受け取り、不適格な形式（非既約分数・非簡約平方根・非有理化）
// が含まれていれば false を返す。含まれていなければ（あるいは一切判定対象が無い場合は）true。
function _kisoCheckStrictForm(text) {
  if (!text) return true;

  // 1) 帯分数 c a/b の判定: a < b かつ gcd(a, b) = 1
  //    OCR 取り込み後を想定し、"1 1/2" のような半角空白区切りを許容
  const mixedRe = /(^|[^\d/])(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)/g;
  let m;
  while ((m = mixedRe.exec(text)) !== null) {
    const a = parseInt(m[4], 10);
    const b = parseInt(m[5], 10);
    if (b === 0) return false;
    if (a >= b) return false;       // 帯分数の真分数部は a < b
    if (_kisoGcd(a, b) !== 1) return false;
  }

  // 2) 普通の分数 a/b: gcd(a, b) = 1
  //    帯分数として既にチェック済みの "c a/b" の "a/b" は二重に判定されるが、a < b と
  //    gcd=1 が満たされている前提なので no-op となる
  const fracRe = /(-?)(\d+)\s*\/\s*(\d+)/g;
  while ((m = fracRe.exec(text)) !== null) {
    const num = parseInt(m[2], 10);
    const den = parseInt(m[3], 10);
    if (den === 0) return false;
    if (_kisoGcd(num, den) !== 1) return false;
  }

  // 3) \sqrt{n} の n は square-free
  const sqrtRe = /\\sqrt\{(\d+)\}/g;
  while ((m = sqrtRe.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (!_kisoIsSquareFree(n)) return false;
  }

  // 4) 有理化チェック: 分母に \sqrt が来る形は不可
  if (/\/\s*\\sqrt\{/.test(text)) return false;            // a/\sqrt{b} 形
  if (/\\frac\{[^{}]*\}\{[^{}]*\\sqrt[^{}]*\}/.test(text)) return false;  // \frac{a}{...\sqrt...}

  return true;
}

// 1 つの問題に対する OCR 後文字列と allowedJson との照合
// allowedJson はシート上の JSON 文字列（["3/2","1 1/2",...]）
// 戻り値: boolean（match → true）
function _kisoMatchAnswer(studentRaw, allowedJson) {
  const norm = _kisoNormalize(studentRaw);
  if (!norm) return false;
  if (!_kisoCheckStrictForm(norm)) return false;
  let allowed;
  try {
    allowed = (typeof allowedJson === 'string') ? JSON.parse(allowedJson) : allowedJson;
  } catch (e) {
    return false;
  }
  if (!Array.isArray(allowed)) return false;
  for (let i = 0; i < allowed.length; i++) {
    if (norm === _kisoNormalize(allowed[i])) return true;
  }
  return false;
}

// OCR 全文を問題番号で分割（仕様書 §7.2、§7.6 ケース2）
// 受理する番号マーカー：①〜⑩ / (1)〜(10) / 1.〜10. / 1)〜10) / 1、〜10、 / 1: 〜
// 戻り値: 長さ N の配列。answers[i-1] = 問題 i に対する答え文字列（trim 済み、無回答は ''）
function _kisoSplitByQuestionNumbers(text, count) {
  const result = new Array(count).fill('');
  if (!text || count <= 0) return result;
  const escapeRe = function(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  const markers = []; // [{num, start, end}]
  for (let i = 0; i < count; i++) {
    const num = i + 1;
    const candidates = [];
    // ①〜⑩
    if (i < 10) {
      const c = _KISO_CIRCLED[i];
      const idx = text.indexOf(c);
      if (idx >= 0) candidates.push({ start: idx, end: idx + c.length });
    }
    // (N) パターン
    const parenRe = new RegExp('\\(\\s*' + num + '\\s*\\)', 'g');
    let pm = parenRe.exec(text);
    if (pm) candidates.push({ start: pm.index, end: pm.index + pm[0].length });
    // N.  N)  N、  N: パターン（前が数字だと "21." を "1." として誤検出するため除外）
    // 行頭/空白/改行直後の数字 + 終端記号
    const dotRe = new RegExp('(^|[^0-9])' + num + '\\s*[.\\)、:]', 'g');
    let dm = dotRe.exec(text);
    if (dm) {
      // m[1] が空文字列なら num の先頭は m.index、それ以外は m.index + 1
      const numStart = dm.index + (dm[1] ? dm[1].length : 0);
      candidates.push({ start: numStart, end: dm.index + dm[0].length });
    }
    if (candidates.length > 0) {
      candidates.sort(function(a,b){ return a.start - b.start; });
      markers.push({ num: num, start: candidates[0].start, end: candidates[0].end });
    }
  }
  // start 位置でソート
  markers.sort(function(a,b){ return a.start - b.start; });
  // 各マーカーの直後から、次のマーカーの直前までを答えとして抽出
  for (let i = 0; i < markers.length; i++) {
    const segStart = markers[i].end;
    const segEnd = (i + 1 < markers.length) ? markers[i + 1].start : text.length;
    const ans = text.substring(segStart, segEnd).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    result[markers[i].num - 1] = ans;
  }
  return result;
}

// =============================================
// 基礎計算 Phase 4-2：データアクセス
// =============================================

// 級別キャッシュ：各 rank に該当する KisoQuestions の行（ヘッダー除く）を返す
// 既存の _getQuestionRowsForLevel と同じ「初回 miss で全 rank 一括キャッシュ」パターン
function _getKisoQuestionRowsForRank(rank) {
  const r = Number(rank);
  const cache = CacheService.getScriptCache();
  const key = 'cache_kiso_q_rows_' + r;
  const hit = cache.get(key);
  if (hit) {
    _cacheLog(key, 'hit');
    try { return JSON.parse(hit); } catch (e) { /* 破損キャッシュは無視 */ }
  }
  // miss: 全件読みして rank 別に分割キャッシュ
  const sh = _ensureKisoQuestionsSheet();
  if (sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const header = values[0];
  const cRank = header.indexOf('rank');
  if (cRank < 0) return [];
  const byRank = {};
  for (let i = 1; i < values.length; i++) {
    const rk = Number(values[i][cRank]);
    if (!rk) continue;
    if (!byRank[rk]) byRank[rk] = [];
    byRank[rk].push(values[i]);
  }
  Object.keys(byRank).forEach(function(rk){
    const k = 'cache_kiso_q_rows_' + rk;
    try {
      const ser = JSON.stringify(byRank[rk]);
      if (ser.length < 95000) cache.put(k, ser, 21600);
      else console.warn('[cache skip >95KB]', k, 'size=' + ser.length);
    } catch (e) { console.error('[kiso cache put]', k, e); }
  });
  return byRank[r] || [];
}

// 指定の questionId 配列に対応する問題行を返す（順序は questionIds の順）
// rank 単位でキャッシュを呼ぶため、問題セットが同じ rank に揃っていれば 1 回の cache hit で済む
function _getKisoQuestionsByIds(questionIds) {
  if (!questionIds || questionIds.length === 0) return [];
  // questionId は q_{rank:02d}_{連番:06d} 形式 → rank をパース
  const byId = {};
  const ranksToFetch = {};
  for (let i = 0; i < questionIds.length; i++) {
    const qid = String(questionIds[i]);
    const m = qid.match(/^q_(\d+)_/);
    if (m) ranksToFetch[Number(m[1])] = true;
  }
  Object.keys(ranksToFetch).forEach(function(rk){
    const rows = _getKisoQuestionRowsForRank(Number(rk));
    // ヘッダー位置はシート全体と同じ
    // KisoQuestions: questionId / rank / rankName / difficultyBand / problemLatex /
    //                answerCanonical / answerAllowed / generatedAt
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      byId[String(r[0])] = {
        questionId: String(r[0]),
        rank: Number(r[1]),
        rankName: String(r[2] || ''),
        difficultyBand: String(r[3] || ''),
        problemLatex: String(r[4] || ''),
        answerCanonical: String(r[5] || ''),
        answerAllowedJson: String(r[6] || '[]')
      };
    }
  });
  // 入力順で並べる
  const out = [];
  for (let i = 0; i < questionIds.length; i++) {
    const got = byId[String(questionIds[i])];
    if (got) out.push(got);
  }
  return out;
}

// 指定 rank の in_progress セッションを列挙する診断ツール（GAS エディタ実行専用）。
//
// 用途：問題プール変更（rank_04 50題化など）の前に、影響を受ける可能性がある
// 進行中セッションを把握するための pre-flight 診断。読み取りのみで副作用なし。
//
// 使い方：GAS エディタの関数ドロップダウンから diagnoseRank4InProgress または
// diagnoseKisoInProgressByRank(rank) を選択して実行。実行ログに一覧が出る。
//
// 戻り値: { ok, rank, count, sessions: [{ sessionId, studentId, studentName,
//          studentNickname, startedAt, questionIdsPreview }] }
// ※ Step 2：本関数は Students 専用（Phase 4 投入時のセッション診断は実生徒のみが対象。
//   テスト枠の進行中セッションがあっても問題ないが、診断結果としては実生徒のみで十分）。
function diagnoseKisoInProgressByRank(rank) {
  try {
    const r = Number(rank);
    if (!r || r < 1 || r > 20) return { ok: false, message: 'rank は 1〜20 を指定してください' };

    const sh = _ss().getSheetByName(SHEET_KISO_SESSIONS);
    if (!sh) return { ok: false, message: 'KisoSessions シートが見つかりません' };
    if (sh.getLastRow() < 2) return { ok: true, rank: r, count: 0, sessions: [] };

    const values = sh.getDataRange().getValues();
    const header = values[0];
    const cSession = header.indexOf('sessionId');
    const cSid     = header.indexOf('studentId');
    const cRank    = header.indexOf('rank');
    const cStatus  = header.indexOf('status');
    const cStarted = header.indexOf('startedAt');
    const cQids    = header.indexOf('questionIds');

    // Students から氏名/ニックネームをルックアップ（追跡しやすくするため）
    const stuValues = _getStudentsValues();
    const sidToStu = {};
    for (let i = 1; i < stuValues.length; i++) {
      const sid = String(stuValues[i][COL_ID] || '').trim();
      if (!sid) continue;
      sidToStu[sid] = {
        nickname: String(stuValues[i][COL_NICKNAME] || ''),
        name:     String(stuValues[i][COL_NAME] || '')
      };
    }

    const sessions = [];
    for (let i = 1; i < values.length; i++) {
      if (Number(values[i][cRank]) !== r) continue;
      if (String(values[i][cStatus]) !== 'in_progress') continue;
      const ts = values[i][cStarted];
      const startedStr = (ts instanceof Date)
        ? Utilities.formatDate(ts, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
        : String(ts || '');
      const sid = String(values[i][cSid] || '');
      const stu = sidToStu[sid] || { nickname: '', name: '' };
      sessions.push({
        sessionId: String(values[i][cSession] || ''),
        studentId: sid,
        studentName:     stu.name,
        studentNickname: stu.nickname,
        startedAt: startedStr,
        questionIdsPreview: String(values[i][cQids] || '').slice(0, 120)
      });
    }
    // 新しい順
    sessions.sort(function(a, b){ return a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0; });

    console.log('[diagnoseKisoInProgressByRank] rank=' + r + ' in_progress count=' + sessions.length);
    sessions.forEach(function(s, i){
      console.log('  ' + (i + 1) + '. sid=' + s.studentId
        + ' (' + (s.studentNickname || s.studentName || '?') + ')'
        + ' startedAt=' + s.startedAt
        + ' sessionId=' + s.sessionId);
    });

    return { ok: true, rank: r, count: sessions.length, sessions: sessions };
  } catch (err) {
    console.error('[diagnoseKisoInProgressByRank]', err);
    return { ok: false, message: String(err) };
  }
}

// ショートカット: rank=4 の診断（rank_04 50題化前の pre-flight 用）
function diagnoseRank4InProgress() {
  return diagnoseKisoInProgressByRank(4);
}

// ショートカット: rank=3 の診断（rank_03 50題化前の pre-flight 用）
function diagnoseRank3InProgress() {
  return diagnoseKisoInProgressByRank(3);
}

// ショートカット: rank=2 の診断（rank_02 50題化前の pre-flight 用）
function diagnoseRank2InProgress() {
  return diagnoseKisoInProgressByRank(2);
}

// ショートカット: rank=7 の診断（rank_07 50題化前の pre-flight 用）
function diagnoseRank7InProgress() {
  return diagnoseKisoInProgressByRank(7);
}

// ショートカット: rank=5 の診断（rank_05 50題化前の pre-flight 用）
function diagnoseRank5InProgress() {
  return diagnoseKisoInProgressByRank(5);
}

// ショートカット: rank=6 の診断（rank_06 50題化 + Band D 新設前の pre-flight 用）
function diagnoseRank6InProgress() {
  return diagnoseKisoInProgressByRank(6);
}

// ショートカット: rank=8 の診断（rank_08 50題化 + Band D 新設前の pre-flight 用）
function diagnoseRank8InProgress() {
  return diagnoseKisoInProgressByRank(8);
}

// ショートカット: rank=1 の診断（rank_01 50題化 + Band B 純化 + Band D 新設前の pre-flight 用）
function diagnoseRank1InProgress() {
  return diagnoseKisoInProgressByRank(1);
}

// ショートカット: rank=13 の診断（rank_13 50題化 + Band D 新設前の pre-flight 用）
function diagnoseRank13InProgress() {
  return diagnoseKisoInProgressByRank(13);
}

// ショートカット: rank=12 の診断（rank_12 50題化 + Band B 構造改革前の pre-flight 用、特に重要）
function diagnoseRank12InProgress() {
  return diagnoseKisoInProgressByRank(12);
}

// ショートカット: rank=11 の診断（rank_11 50題化 + Band C slot_index 駆動化前の pre-flight 用）
function diagnoseRank11InProgress() {
  return diagnoseKisoInProgressByRank(11);
}

// ショートカット: rank=9 の診断（rank_09 50題化 + Band D 新設前の pre-flight 用）
function diagnoseRank9InProgress() {
  return diagnoseKisoInProgressByRank(9);
}

// ショートカット: rank=10 の診断（rank_10 50題化 + 10 スロット維持 + count 増加 + 弱 slot 補強前の pre-flight 用）
function diagnoseRank10InProgress() {
  return diagnoseKisoInProgressByRank(10);
}

// ショートカット: rank=14 の診断（rank_14 50題化 + Band D 整数を含む混合 新設前の pre-flight 用）
function diagnoseRank14InProgress() {
  return diagnoseKisoInProgressByRank(14);
}

// ショートカット: rank=15 の診断（rank_15 50題化 + Band D 整数答え muldiv 新設前の pre-flight 用）
function diagnoseRank15InProgress() {
  return diagnoseKisoInProgressByRank(15);
}

// ショートカット: rank=16 の診断（rank_16 50題化 + Band D 3項加減新設前の pre-flight 用）
function diagnoseRank16InProgress() {
  return diagnoseKisoInProgressByRank(16);
}

// ショートカット: rank=18 の診断（rank_18 50題化 + Band D 答えが整数 muldiv 新設前の pre-flight 用）
function diagnoseRank18InProgress() {
  return diagnoseKisoInProgressByRank(18);
}

// ショートカット: rank=19 の診断（rank_19 50題化 + Band D 3項加減新設前の pre-flight 用）
function diagnoseRank19InProgress() {
  return diagnoseKisoInProgressByRank(19);
}

// ショートカット: rank=17 の診断（rank_17 50題化 + Band D 答え整数 3項小数四則 新設前の pre-flight 用）
function diagnoseRank17InProgress() {
  return diagnoseKisoInProgressByRank(17);
}

// ショートカット: rank=20 の診断（rank_20 50題化 + Band D カッコあり新設 + digits=1 化前の pre-flight 用）
function diagnoseRank20InProgress() {
  return diagnoseKisoInProgressByRank(20);
}

// 指定 rank の in_progress セッションを 'abandoned' に書き換える管理関数
// （GAS エディタ実行専用、doGet 未登録）。
//
// 用途：問題プール差し替え（rank_04 50題化など）の前に、進行中セッションを
// 強制終了して questionId 解決の不整合を防ぐ。次回タップで新セッションが
// 自然に作られるため生徒側は実害なし。
//
// 安全策:
//   1. 書き換え前に対象セッションを必ず console.log + 構造化データで返却
//   2. opts.dryRun === true なら書き換えずログ + 戻り値のみ
//   3. 既に 'abandoned' / 'passed' / 'failed_retry' の行はスキップ（冪等）
//   4. completedAt にも abandonment 時刻を記録（履歴追跡用）
//
// 使い方（GAS エディタ）:
//   abandonRank4InProgress({ dryRun: true })   // まず diagnostic
//   abandonRank4InProgress()                   // 確認後に実行
function abandonKisoInProgressByRank(rank, opts) {
  try {
    opts = opts || {};
    const dryRun = !!opts.dryRun;

    const r = Number(rank);
    if (!r || r < 1 || r > 20) return { ok: false, message: 'rank は 1〜20 を指定してください' };

    const sh = _ss().getSheetByName(SHEET_KISO_SESSIONS);
    if (!sh) return { ok: false, message: 'KisoSessions シートが見つかりません' };
    if (sh.getLastRow() < 2) return { ok: true, rank: r, dryRun: dryRun, targets: [], updated: 0 };

    const values = sh.getDataRange().getValues();
    const header = values[0];
    const cSession    = header.indexOf('sessionId');
    const cSid        = header.indexOf('studentId');
    const cRank       = header.indexOf('rank');
    const cStatus     = header.indexOf('status');
    const cStarted    = header.indexOf('startedAt');
    const cCompleted  = header.indexOf('completedAt');

    if (cStatus < 0)    return { ok: false, message: 'status 列が見つかりません' };
    if (cCompleted < 0) return { ok: false, message: 'completedAt 列が見つかりません' };

    // 1. 対象抽出（書き換え前に列挙してログ出力）
    const targets = [];  // { rowIdx (1-based), sessionId, studentId, startedAt }
    for (let i = 1; i < values.length; i++) {
      if (Number(values[i][cRank]) !== r) continue;
      if (String(values[i][cStatus]) !== 'in_progress') continue;
      const ts = values[i][cStarted];
      const startedStr = (ts instanceof Date)
        ? Utilities.formatDate(ts, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
        : String(ts || '');
      targets.push({
        rowIdx: i + 1,  // 1-based シート行番号
        sessionId: String(values[i][cSession] || ''),
        studentId: String(values[i][cSid] || ''),
        startedAt: startedStr
      });
    }

    console.log('[abandonKisoInProgressByRank] rank=' + r
      + ' targets=' + targets.length
      + (dryRun ? ' (DRY RUN)' : ''));
    targets.forEach(function(t, i){
      console.log('  ' + (i + 1) + '. row=' + t.rowIdx
        + ' sid=' + t.studentId
        + ' startedAt=' + t.startedAt
        + ' sessionId=' + t.sessionId);
    });

    if (dryRun || targets.length === 0) {
      return { ok: true, rank: r, dryRun: dryRun, targets: targets, updated: 0 };
    }

    // 2. 一括書き換え（status='abandoned' + completedAt=now）
    const nowStr = _nowJST();
    let updated = 0;
    for (let k = 0; k < targets.length; k++) {
      const t = targets[k];
      sh.getRange(t.rowIdx, cStatus + 1).setValue('abandoned');
      sh.getRange(t.rowIdx, cCompleted + 1).setValue(nowStr);
      updated++;
    }
    console.log('[abandonKisoInProgressByRank] updated=' + updated + ' at ' + nowStr);

    // 3. 検証：再読み込みして status が反映されていることを確認
    const verifyValues = sh.getDataRange().getValues();
    let verifiedOk = 0;
    let verifiedNg = 0;
    for (let k = 0; k < targets.length; k++) {
      const t = targets[k];
      const newStatus = String(verifyValues[t.rowIdx - 1][cStatus]);
      if (newStatus === 'abandoned') verifiedOk++;
      else {
        verifiedNg++;
        console.error('[abandonKisoInProgressByRank] verify NG: row=' + t.rowIdx
          + ' expected=abandoned actual=' + newStatus);
      }
    }
    console.log('[abandonKisoInProgressByRank] verified: ok=' + verifiedOk + ' ng=' + verifiedNg);

    return {
      ok: verifiedNg === 0,
      rank: r,
      dryRun: false,
      targets: targets,
      updated: updated,
      verified: { ok: verifiedOk, ng: verifiedNg },
      completedAt: nowStr
    };
  } catch (err) {
    console.error('[abandonKisoInProgressByRank]', err);
    return { ok: false, message: String(err) };
  }
}

// ショートカット: rank=4 の一括 abandoned 化（rank_04 50題化前の pre-flight 用）
function abandonRank4InProgress(opts) {
  return abandonKisoInProgressByRank(4, opts);
}

// ショートカット: rank=3 の一括 abandoned 化（rank_03 50題化前の pre-flight 用）
function abandonRank3InProgress(opts) {
  return abandonKisoInProgressByRank(3, opts);
}

// ショートカット: rank=2 の一括 abandoned 化（rank_02 50題化前の pre-flight 用）
function abandonRank2InProgress(opts) {
  return abandonKisoInProgressByRank(2, opts);
}

// ショートカット: rank=7 の一括 abandoned 化（rank_07 50題化前の pre-flight 用）
function abandonRank7InProgress(opts) {
  return abandonKisoInProgressByRank(7, opts);
}

// ショートカット: rank=5 の一括 abandoned 化（rank_05 50題化前の pre-flight 用）
function abandonRank5InProgress(opts) {
  return abandonKisoInProgressByRank(5, opts);
}

// ショートカット: rank=6 の一括 abandoned 化（rank_06 50題化 + Band D 新設前の pre-flight 用）
function abandonRank6InProgress(opts) {
  return abandonKisoInProgressByRank(6, opts);
}

// ショートカット: rank=8 の一括 abandoned 化（rank_08 50題化 + Band D 新設前の pre-flight 用）
function abandonRank8InProgress(opts) {
  return abandonKisoInProgressByRank(8, opts);
}

// ショートカット: rank=1 の一括 abandoned 化（rank_01 50題化 + Band B 純化 + Band D 新設前の pre-flight 用）
function abandonRank1InProgress(opts) {
  return abandonKisoInProgressByRank(1, opts);
}

// ショートカット: rank=13 の一括 abandoned 化（rank_13 50題化 + Band D 新設前の pre-flight 用）
function abandonRank13InProgress(opts) {
  return abandonKisoInProgressByRank(13, opts);
}

// ショートカット: rank=12 の一括 abandoned 化（rank_12 50題化 + Band B 構造改革前の pre-flight 用、特に重要）
// 構造改革により既存問題プールが全置換されるため、進行中セッションは必ず abandoned 化すること。
function abandonRank12InProgress(opts) {
  return abandonKisoInProgressByRank(12, opts);
}

// ショートカット: rank=11 の一括 abandoned 化（rank_11 50題化 + Band C slot_index 駆動化前の pre-flight 用）
function abandonRank11InProgress(opts) {
  return abandonKisoInProgressByRank(11, opts);
}

// ショートカット: rank=9 の一括 abandoned 化（rank_09 50題化 + Band D 新設前の pre-flight 用）
function abandonRank9InProgress(opts) {
  return abandonKisoInProgressByRank(9, opts);
}

// ショートカット: rank=10 の一括 abandoned 化（rank_10 50題化前の pre-flight 用）
// slot 7 の構造的バグ（unique=3, 4）解消で問題プールが置換されるため、進行中セッションは
// abandoned 化推奨。
function abandonRank10InProgress(opts) {
  return abandonKisoInProgressByRank(10, opts);
}

// ショートカット: rank=14 の一括 abandoned 化（rank_14 50題化 + Band D 整数を含む混合 新設前の pre-flight 用）
// 30→50 題化で問題プールが入れ替わるため、進行中セッションは abandoned 化推奨。
function abandonRank14InProgress(opts) {
  return abandonKisoInProgressByRank(14, opts);
}

// ショートカット: rank=15 の一括 abandoned 化（rank_15 50題化 + Band D 整数答え muldiv 新設前の pre-flight 用）
// 30→50 題化で問題プールが入れ替わるため、進行中セッションは abandoned 化推奨。
function abandonRank15InProgress(opts) {
  return abandonKisoInProgressByRank(15, opts);
}

// ショートカット: rank=16 の一括 abandoned 化（rank_16 50題化 + Band D 3項加減新設前の pre-flight 用）
// 30→50 題化で問題プールが入れ替わるため、進行中セッションは abandoned 化推奨。
function abandonRank16InProgress(opts) {
  return abandonKisoInProgressByRank(16, opts);
}

// ショートカット: rank=18 の一括 abandoned 化（rank_18 50題化 + Band D 答えが整数 muldiv 新設前の pre-flight 用）
// 30→50 題化で問題プールが入れ替わるため、進行中セッションは abandoned 化推奨。
function abandonRank18InProgress(opts) {
  return abandonKisoInProgressByRank(18, opts);
}

// ショートカット: rank=19 の一括 abandoned 化（rank_19 50題化 + Band D 3項加減新設前の pre-flight 用）
// 30→50 題化で問題プールが入れ替わるため、進行中セッションは abandoned 化推奨。
function abandonRank19InProgress(opts) {
  return abandonKisoInProgressByRank(19, opts);
}

// ショートカット: rank=17 の一括 abandoned 化（rank_17 50題化 + Band D 答え整数 3項小数四則 新設前の pre-flight 用）
// 30→50 題化で問題プールが入れ替わるため、進行中セッションは abandoned 化推奨。
function abandonRank17InProgress(opts) {
  return abandonKisoInProgressByRank(17, opts);
}

// ショートカット: rank=20 の一括 abandoned 化（rank_20 50題化 + Band D カッコあり新設 + digits=1 化前の pre-flight 用）
// 30→50 題化で問題プールが入れ替わるため、進行中セッションは abandoned 化推奨。
function abandonRank20InProgress(opts) {
  return abandonKisoInProgressByRank(20, opts);
}

// セッション行から保存済みの problemLatex マップ {questionId: latex} を構築する。
// Phase 2 防衛策。startKisoSession で `problemLatexes` 列に保存した JSON 配列を、
// 同じセッションの `questionIds` と並列にひも付けて返す。
//
// 後方互換：以下のいずれかの場合は空マップ {} を返し、呼び出し側は従来通り
// `_getKisoQuestionsByIds` の DB ルックアップ結果を使う。
//   (a) 列がまだ存在しない（schema migration 前の旧シート）
//   (b) 列はあるが値が空（旧セッションで未保存）
//   (c) JSON parse 失敗 / 配列長が不一致 / 値が配列でない
function _buildKisoStoredLatexMap(row, header) {
  const cQids   = header.indexOf('questionIds');
  const cLatexes = header.indexOf('problemLatexes');
  if (cQids < 0 || cLatexes < 0) return {};
  const rawLatexes = String(row[cLatexes] || '').trim();
  if (!rawLatexes) return {};
  let qids = [];
  let latexes = [];
  try { qids = JSON.parse(String(row[cQids] || '[]')); } catch (e) { return {}; }
  try { latexes = JSON.parse(rawLatexes); } catch (e) { return {}; }
  if (!Array.isArray(qids) || !Array.isArray(latexes)) return {};
  if (qids.length !== latexes.length) return {};
  const out = {};
  for (let i = 0; i < qids.length; i++) {
    out[String(qids[i])] = String(latexes[i] || '');
  }
  return out;
}

// KisoSessions シートを sessionId で線形検索（直近のセッションは末尾近く）
// 戻り値: { rowIdx (1-based), sheet, header, row } | null
function _findKisoSessionRow(sessionId) {
  const sh = _ensureKisoSessionsSheet();
  if (sh.getLastRow() < 2) return null;
  const values = sh.getDataRange().getValues();
  const header = values[0];
  const cId = header.indexOf('sessionId');
  if (cId < 0) return null;
  // 末尾から検索（直近のセッションが対象になりやすい）
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][cId]) === String(sessionId)) {
      return { rowIdx: i + 1, sheet: sh, header: header, row: values[i] };
    }
  }
  return null;
}

// 教育日 (4 AM 区切り) ベースで timestamp を 'yyyy-MM-dd' 文字列に変換
// HPLog の timestamp は JST カレンダー時刻（_nowJST 由来）。HP 上限を教育日基準で
// 集計するため、04:00 未満なら前日扱いに丸める。
function _toEducationalDateStr(ts) {
  if (!ts) return '';
  let d;
  try {
    d = (ts instanceof Date) ? ts : new Date(ts);
  } catch (e) { return ''; }
  if (isNaN(d.getTime())) {
    // 文字列の場合は単純に先頭 10 文字を返す（_toDateStr の挙動と互換）
    const s = String(ts);
    return s.match(/^\d{4}-\d{2}-\d{2}/) ? s.slice(0, 10) : '';
  }
  if (d.getTime() < EDU_DAY_CUTOVER_MS) {
    return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  const jstHour = parseInt(Utilities.formatDate(d, 'Asia/Tokyo', 'H'), 10);
  if (jstHour < 4) {
    const yesterday = new Date(d.getTime() - 86400000);
    return Utilities.formatDate(yesterday, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

// 当日（教育日基準）の基礎計算で獲得した「素点 rawHP」を合計する
// 仕様書 §8.3：1 日の素点上限 100HP の判定に使う
// type が 'kiso_' で始まり、かつ '_practice' で終わらないログのみ集計
function _kisoTodayRawHP(studentId) {
  const sh = _ss().getSheetByName(SHEET_HPLOG);
  if (!sh) return 0;
  const today = _todayEducationalJST();
  const data = _readLastNRows(sh, 200);  // 当日分の集計には十分
  // HPLog 列: timestamp(0) / studentId(1) / rawHP(2) / hpGained(3) / type(4) / message(5)
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]).trim() !== String(studentId).trim()) continue;
    const type = String(row[4] || '');
    if (type.indexOf('kiso_') !== 0) continue;
    if (type.length >= 9 && type.lastIndexOf('_practice') === type.length - 9) continue;
    const dateStr = _toEducationalDateStr(row[0]);
    if (dateStr !== today) continue;
    total += Number(row[2]) || 0;
  }
  return total;
}

// セッション ID 生成（kiso_{studentId}_{ts}_{random}）
function _kisoSessionId(studentId) {
  const ts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  const rand = Math.random().toString(36).substring(2, 8);
  return 'kiso_' + String(studentId).trim() + '_' + ts + '_' + rand;
}

// =============================================
// 基礎計算 Phase 7：B-1 当日素点合計 公開 API
// =============================================
// 仕様書 §4.3 後半：問題数選択画面の動的 HP 上限案内に使う。
// 1 日の素点上限は 100HP（既存コンテンツから独立、§8.3）。
// 戻り値:
//   {
//     ok: true,
//     todayRawHP: number,        // 当日（教育日基準）の kiso 素点合計
//     remaining: number,         // あと獲得できる素点（100 - todayRawHP、下限 0）
//     isAtLimit: boolean,        // 上限到達済（remaining === 0）
//     cap: 100                   // 1 日の素点上限（参考値）
//   }
// 5 / 10 題セットの場合、残量が baseRawHP（50 / 100）未満なら
// 残量分が部分的に加算され、残量 0 なら練習モードになる（既存仕様）。
function getKisoTodayRawHP(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    const todayRawHP = _kisoTodayRawHP(sid);
    const cap = 100;
    const remaining = Math.max(0, cap - todayRawHP);
    return {
      ok: true,
      studentId: sid,
      todayRawHP: todayRawHP,
      remaining: remaining,
      isAtLimit: remaining === 0,
      cap: cap
    };
  } catch (err) {
    console.error('[getKisoTodayRawHP]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 基礎計算 Phase 7：B-2 OCR 信頼度判定（仕様書 §7.6 ケース4）
// =============================================
// 閾値：実機テストで微調整するため定数化。
// 0.6 は仕様書 §7.6 / §7.7 の暫定値。実機データに合わせて変更する場合は
// この値だけを書き換える。
// 注：2026-04-28 から OCR エンジンは Gemini Vision に切替済み。Gemini は
// トークン信頼度を提供しないため、現状この閾値は呼び出されない（フォールバック
// 復活時のために残置）。
const KISO_OCR_CONFIDENCE_THRESHOLD = 0.6;

// Gemini Vision で答案写真の OCR + 番号別答え抽出を一括実行。
// - 戻り値（成功）: { ok:true, ocrText:'<JSON 文字列>', answersMap:{"1":"1/4",...}, attempts: 1|2 }
// - 戻り値（失敗）: { ok:false, message:'...', retake?:true }
//   retake:true は「画像問題で生徒に再撮影を促す」、retake なしは「サーバ問題」
// モデル: gemini-2.5-flash（安定版・OCR 精度向上、2026-04-29 切替）
//   旧 gemini-2.0-flash は 2026-03-06 から新規ユーザー利用不可、2026-06-01 廃止予定
//   モデル変更時はこの関数内の `const model = ...` の 1 行を書き換えるだけで OK
//
// 自動リトライ機構（2026-04-29 追加）：
//   GAS UrlFetchApp の「帯域幅の上限」エラーや HTTP 429 / 5xx 等の一時的失敗で
//   生徒に失敗を見せないため、内部で 1 回だけ自動再試行する（500ms 待機）。
//   - リトライ対象：fetch 例外 / HTTP 429 / HTTP 5xx /
//     トップレベル error の quota|rate|limit|exhaust|busy|unavail|帯域 メッセージ
//   - リトライ非対象：HTTP 4xx（401/403/404 等の永続エラー） / promptFeedback ブロック /
//     SAFETY finishReason / 答えの JSON 解析失敗
//   - リトライ成功時は console.log で初回エラー内容を記録（運用観察用）
function _kisoOcrWithGemini(imageBase64, numQuestions) {
  const apiKey = _props().getProperty('GEMINI_API_KEY');
  if (!apiKey) return { ok: false, message: 'GEMINI_API_KEY が設定されていません' };
  const model = 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  const prompt =
    'これは数学の解答用紙の写真です。番号（①②③④⑤⑥⑦⑧⑨⑩）の後に書かれた「答え」を抽出してください。\n' +
    '\n' +
    '【書式ルール】\n' +
    '・分数は「分子/分母」の形式（例：3/4）。横線分数も縦書き分数も同じ形式に統一。\n' +
    '・帯分数は「整数 分子/分母」の形式、半角スペース 1 個で区切る（例：1 1/2）\n' +
    '・平方根は「√数字」「整数√数字」の形式（例：√3、2√5）\n' +
    '・指数は「^」を使う（例：2^3、x^2）\n' +
    '・マイナス記号は半角ハイフン「-」（例：-7、-3/4）\n' +
    '・「x = 5, y = -2」のような連立方程式の解は文字列のまま「x=5, y=-2」と書く\n' +
    '\n' +
    '【出力ルール】\n' +
    '・出力は JSON オブジェクトのみ。前後の説明文や ```json などのコードブロックは絶対に含めない\n' +
    '・キーは番号の文字列 "1", "2", ..., "' + numQuestions + '"\n' +
    '・値は答えの文字列（読み取れない場合は空文字 ""）\n' +
    '・1〜' + numQuestions + ' 番までを対象とする\n' +
    '・存在しない番号や読み取れない番号は空文字 "" を入れる（キー自体は省略しない）\n' +
    '\n' +
    '【出力例】\n' +
    '{"1": "1/4", "2": "1", "3": "17/30", "4": "2√5", "5": ""}';

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: String(imageBase64) } }
      ]
    }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json'
    }
  };
  const fetchOpts = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };

  // リトライ設定（合計で最大 2 回試行）
  const MAX_ATTEMPTS  = 2;
  const RETRY_WAIT_MS = 500;
  const QUOTA_PATTERN = /quota|rate|limit|exhaust|busy|unavail|帯域/i;
  let lastErrorSummary = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    // ① fetch 段階の例外（帯域幅・ネットワーク等）
    try {
      res = UrlFetchApp.fetch(url, fetchOpts);
    } catch (e) {
      const exMsg = String(e);
      console.error('[Gemini fetch exception attempt=' + attempt + ']', exMsg);
      lastErrorSummary = 'fetch exception: ' + exMsg;
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, message: 'Gemini API 通信エラー：' + exMsg + '（自動リトライ後も失敗）' };
    }

    const code = res.getResponseCode();
    const raw  = res.getContentText();

    // ② HTTP 429 / 5xx は一時的失敗として自動リトライ
    if (code === 429 || (code >= 500 && code < 600)) {
      console.error('[Gemini retryable HTTP attempt=' + attempt + ']', code, raw.substring(0, 400));
      lastErrorSummary = 'HTTP ' + code;
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, message: 'Gemini API が混雑しています（HTTP ' + code + '）。少し時間をおいて再送信してください。' };
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      console.error('[Gemini JSON parse error]', code, e, raw.substring(0, 800));
      return { ok: false, message: 'Gemini API: 応答 JSON が不正（HTTP ' + code + '）' };
    }

    // ③ トップレベル error（請求枠 / 認証 / モデル名違反 / 帯域幅エラー等）
    //    quota/rate/limit/exhaust/busy/unavail/帯域 系メッセージのみリトライ対象
    if (json && json.error) {
      const errMsg = String(json.error.message || '');
      console.error('[Gemini top-level error attempt=' + attempt + ']', code, JSON.stringify(json.error));
      if (QUOTA_PATTERN.test(errMsg) && attempt < MAX_ATTEMPTS) {
        lastErrorSummary = 'top-level error: ' + errMsg;
        Utilities.sleep(RETRY_WAIT_MS);
        continue;
      }
      return { ok: false, message: 'Gemini API: ' + (errMsg || 'error') };
    }

    // ④ 以下はリトライ非対象（画像内容 or 永続的失敗）
    if (json && json.promptFeedback && json.promptFeedback.blockReason) {
      console.error('[Gemini blocked]', JSON.stringify(json.promptFeedback));
      return { ok: false, retake: true, message: '画像のチェックでブロックされました。別の写真でもう一度試してください。' };
    }

    const candidates = json && json.candidates;
    if (!candidates || !candidates[0]) {
      console.error('[Gemini no candidates]', code, raw.substring(0, 800));
      return { ok: false, message: 'Gemini 応答に候補がありません（HTTP ' + code + '）' };
    }
    const cand = candidates[0];
    if (cand.finishReason && cand.finishReason !== 'STOP' && cand.finishReason !== 'MAX_TOKENS') {
      console.error('[Gemini abnormal finishReason]', cand.finishReason, JSON.stringify(cand));
      return { ok: false, retake: true, message: '画像の解析が中断されました（' + cand.finishReason + '）。もう一度撮影してください。' };
    }
    const parts = cand.content && cand.content.parts;
    if (!parts || !parts[0] || typeof parts[0].text !== 'string') {
      console.error('[Gemini no text part]', JSON.stringify(cand));
      return { ok: false, retake: true, message: '画像から文字を読み取れませんでした。明るい場所でもう一度撮影してください。' };
    }
    const ocrText = String(parts[0].text || '').trim();
    if (!ocrText) {
      return { ok: false, retake: true, message: '画像から文字を読み取れませんでした。明るい場所でもう一度撮影してください。' };
    }
    // responseMimeType=application/json でも稀に ```json ... ``` が混じることがある保険
    let jsonStr = ocrText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    let answersMap;
    try {
      answersMap = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[Gemini answers JSON parse]', e, ocrText.substring(0, 400));
      return { ok: false, retake: true, message: '答えの解析に失敗しました。もう一度撮影してください。' };
    }
    if (!answersMap || typeof answersMap !== 'object' || Array.isArray(answersMap)) {
      console.error('[Gemini answers not object]', typeof answersMap, ocrText.substring(0, 400));
      return { ok: false, retake: true, message: '答えの解析に失敗しました（不正な形式）。もう一度撮影してください。' };
    }

    // ⑤ 成功（リトライ後成功なら運用観察用にログ）
    if (attempt > 1) {
      console.log('[Gemini retry success] attempt=' + attempt + ' initial_error=' + lastErrorSummary);
    }
    return { ok: true, ocrText: ocrText, answersMap: answersMap, attempts: attempt };
  }

  // ループ完走（理論上は到達しない）— 防御的フォールバック
  return { ok: false, message: 'Gemini API: 不明なエラー（リトライ完了後）：' + lastErrorSummary };
}

// =============================================
// 和文英訳① 用 Gemini Vision OCR（2026-04-30 切替）
// =============================================
// 旧 Cloud Vision DOCUMENT_TEXT_DETECTION では「は↔12」「f↔t」「c↔e」のような
// 形似文字の手書き誤認識が頻発（ウミネコさんの実例で複数発生）。languageHints を
// 入れただけでは効果不十分だったため、文脈プロンプトを渡せる Gemini Vision に切替。
//
// 戻り値（成功）: { ok:true, ocrText:'<plain text、行頭問題番号付き>', attempts: 1|2 }
// 戻り値（失敗）: { ok:false, message:'...', retake?:true }
//   retake:true は「画像問題で生徒に再撮影を促す」、retake なしは「サーバ問題」
//
// モデル・リトライ機構は _kisoOcrWithGemini と完全同一。
//   - HTTP 429 / 5xx / 帯域幅エラーで内部 1 回自動リトライ（500ms wait）
//   - HTTP 4xx / promptFeedback ブロック / SAFETY finishReason はリトライ対象外
function _wabun1OcrWithGemini(imageBase64) {
  const apiKey = _props().getProperty('GEMINI_API_KEY');
  if (!apiKey) return { ok: false, message: 'GEMINI_API_KEY が設定されていません' };
  const model = 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  // 教育的文脈プロンプト（2026-05-08 夕、文脈推測補正の根絶のため厳格化）。
  // 旧プロンプトでは「文脈から最も妥当な文字に補正してください」「文脈に基づき補正してください」
  // のような表現があり、AI が拡張解釈して「（モニョ）→（メニュー）」のような意味的補正を実害発生
  // させていた。「モニョ」は和文英訳① の意図的なプレースホルダー記号で、絶対に他の語に変換
  // してはいけない。カンジー OCR (commit 05b5809、5/7 夜) と同じ「AI/LLM の親切さが裏目に出る」
  // パターン。「忠実に読み取る、文脈推測補正は絶対禁止」を最優先原則として再強調。
  // 字形類似ペアの判別は「文脈」ではなく「字形ベース」と明記し、AI の拡張解釈を防ぐ。
  const prompt =
    'これは中学生の手書きの英訳答案です。日本語の指示文に対して英語で回答した答案を写真に撮ったものです。\n' +
    '\n' +
    '【最重要原則（絶対遵守、他のすべての指示に優先）】\n' +
    '・画像に書かれている文字列を、そのまま忠実に読み取ってください。\n' +
    '・文脈や常用語・常識的な熟語に基づく単語の置き換え・推測補正は絶対に禁止します。\n' +
    '・「モニョ」「ホニャ」「ナニカ」「ホゲ」のような不自然なカタカナ表記が現れても、絶対に他の語に変換せず、書かれている通りに読み取ってください。これらは問題側で意図的に置かれた「英訳すべき場所のプレースホルダー記号」であり、変換すると問題の意図が完全に台無しになります。\n' +
    '・例（重要）：「私たちはこのレストランで（モニョ）を注文する」と書かれていても、「メニュー」と推測補正してはいけません。「モニョ」のままです。\n' +
    '・例：「（ホニャ）を食べる」と書かれていても、「ご飯」「パン」などに変換してはいけません。「ホニャ」のままです。\n' +
    '・カッコ「（」「(」「[」内の不自然なカタカナ表記は、すべて問題上の意図的なプレースホルダーとして扱い、絶対に変換しないでください。\n' +
    '・文意が不自然に感じても、書かれている通りに読み取ることが最優先です。AI が「気を利かせて」常識的な単語に寄せる補正は禁止です。\n' +
    '\n' +
    '【書式の前提】\n' +
    '・答案には日本語と英語が混在しています。\n' +
    '・問題番号（1〜4 のいずれか）は行頭にのみ現れます（例：「1.」「2.」「3.」「4.」）。\n' +
    '・問題番号以外の位置（本文の中）に数字は含まれません。\n' +
    '\n' +
    '【字形類似ペアの判別（字形ベースで判定、文脈推測ではない）】\n' +
    '・字形が似ていて誤読しやすい組合せがあります。これらは「実際に書かれた字形」を見て、字形が最も近い文字を選んでください。「文脈で意味が通るかどうか」は判断基準ではありません。\n' +
    '・f と t（縦棒の有無や横棒の位置で字形が異なる）\n' +
    '・c と e（左半分の閉じ方で字形が異なる）\n' +
    '・「は」と「12」（縦棒 2 本の見た目で混同しやすいが、字形は明確に異なる）\n' +
    '・1（数字）と l（小文字 L）と I（大文字アイ）\n' +
    '・0（数字）と o（小文字オー）と O（大文字オー）\n' +
    '・字形が崩れて複数候補が考えられる場合でも、書かれている字形に最も近い文字を選んでください。「文脈に合うもの」ではなく「字形に最も近いもの」が判別基準です。\n' +
    '\n' +
    '【出力ルール】\n' +
    '・答案の文字を原文のままテキストで出力してください。\n' +
    '・行頭の問題番号は半角の「1.」「2.」「3.」「4.」の形式に揃えてください（書式が違っても揃える）。\n' +
    '・改行は生徒の答案どおりに保ってください（行頭に問題番号がくるように）。\n' +
    '・出力はテキストのみ。前置き・説明・コードブロック（```）は絶対に含めないでください。\n' +
    '・綴りミスや文法ミスを「修正」しないでください。生徒が書いた文字をそのまま読み取るのが原則です。';

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: String(imageBase64) } }
      ]
    }],
    generationConfig: {
      temperature: 0
    }
  };
  const fetchOpts = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };

  const MAX_ATTEMPTS  = 2;
  const RETRY_WAIT_MS = 500;
  const QUOTA_PATTERN = /quota|rate|limit|exhaust|busy|unavail|帯域/i;
  let lastErrorSummary = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = UrlFetchApp.fetch(url, fetchOpts);
    } catch (e) {
      const exMsg = String(e);
      console.error('[Gemini wabun1 fetch exception attempt=' + attempt + ']', exMsg);
      lastErrorSummary = 'fetch exception: ' + exMsg;
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, message: 'Gemini API 通信エラー：' + exMsg + '（自動リトライ後も失敗）' };
    }

    const code = res.getResponseCode();
    const raw  = res.getContentText();

    if (code === 429 || (code >= 500 && code < 600)) {
      console.error('[Gemini wabun1 retryable HTTP attempt=' + attempt + ']', code, raw.substring(0, 400));
      lastErrorSummary = 'HTTP ' + code;
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, message: 'Gemini API が混雑しています（HTTP ' + code + '）。少し時間をおいて再送信してください。' };
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      console.error('[Gemini wabun1 JSON parse error]', code, e, raw.substring(0, 800));
      return { ok: false, message: 'Gemini API: 応答 JSON が不正（HTTP ' + code + '）' };
    }

    if (json && json.error) {
      const errMsg = String(json.error.message || '');
      console.error('[Gemini wabun1 top-level error attempt=' + attempt + ']', code, JSON.stringify(json.error));
      if (QUOTA_PATTERN.test(errMsg) && attempt < MAX_ATTEMPTS) {
        lastErrorSummary = 'top-level error: ' + errMsg;
        Utilities.sleep(RETRY_WAIT_MS);
        continue;
      }
      return { ok: false, message: 'Gemini API: ' + (errMsg || 'error') };
    }

    if (json && json.promptFeedback && json.promptFeedback.blockReason) {
      console.error('[Gemini wabun1 blocked]', JSON.stringify(json.promptFeedback));
      return { ok: false, retake: true, message: '画像のチェックでブロックされました。別の写真でもう一度試してください。' };
    }

    const candidates = json && json.candidates;
    if (!candidates || !candidates[0]) {
      console.error('[Gemini wabun1 no candidates]', code, raw.substring(0, 800));
      return { ok: false, message: 'Gemini 応答に候補がありません（HTTP ' + code + '）' };
    }
    const cand = candidates[0];
    if (cand.finishReason && cand.finishReason !== 'STOP' && cand.finishReason !== 'MAX_TOKENS') {
      console.error('[Gemini wabun1 abnormal finishReason]', cand.finishReason, JSON.stringify(cand));
      return { ok: false, retake: true, message: '画像の解析が中断されました（' + cand.finishReason + '）。もう一度撮影してください。' };
    }
    const parts = cand.content && cand.content.parts;
    if (!parts || !parts[0] || typeof parts[0].text !== 'string') {
      console.error('[Gemini wabun1 no text part]', JSON.stringify(cand));
      return { ok: false, retake: true, message: '画像から文字を読み取れませんでした。明るい場所でもう一度撮影してください。' };
    }
    let ocrText = String(parts[0].text || '').trim();
    // 念のため：稀に ```...``` コードブロックで返してくる場合の保険
    ocrText = ocrText.replace(/^```(?:[a-zA-Z]+)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    if (!ocrText) {
      return { ok: false, retake: true, message: '画像から文字を読み取れませんでした。明るい場所でもう一度撮影してください。' };
    }

    if (attempt > 1) {
      console.log('[Gemini wabun1 retry success] attempt=' + attempt + ' initial_error=' + lastErrorSummary);
    }
    return { ok: true, ocrText: ocrText, attempts: attempt };
  }

  return { ok: false, message: 'Gemini API: 不明なエラー（リトライ完了後）：' + lastErrorSummary };
}

// 和文英訳① OCR エンドポイント（doPost 経由、frontend `sendWabun1Photo` から呼ばれる）。
// params: { action:'ocrWabun1Photo', imageBase64:'...' }
// 戻り値: _wabun1OcrWithGemini と同形（ok / ocrText / attempts / message / retake）
function ocrWabun1Photo(params) {
  const imageBase64 = String((params && params.imageBase64) || '');
  if (!imageBase64) return { ok: false, message: '画像データが見つかりません' };
  return _wabun1OcrWithGemini(imageBase64);
}

// Vision API レスポンスから symbol レベルの confidence を平均で取得。
// fullTextAnnotation.pages[].blocks[].paragraphs[].words[].symbols[].confidence
// 全 symbol の単純平均を返す（symbol 数 0 の場合は 1 を返して足切りを発動させない）。
function _kisoAverageOcrConfidence(fullAnno) {
  try {
    if (!fullAnno || !fullAnno.pages) return 1;
    let sum = 0, count = 0;
    const pages = fullAnno.pages || [];
    for (let p = 0; p < pages.length; p++) {
      const blocks = pages[p].blocks || [];
      for (let b = 0; b < blocks.length; b++) {
        const paragraphs = blocks[b].paragraphs || [];
        for (let pa = 0; pa < paragraphs.length; pa++) {
          const words = paragraphs[pa].words || [];
          for (let w = 0; w < words.length; w++) {
            const symbols = words[w].symbols || [];
            for (let s = 0; s < symbols.length; s++) {
              const c = symbols[s].confidence;
              if (typeof c === 'number') {
                sum += c;
                count += 1;
              }
            }
          }
        }
      }
    }
    if (count === 0) return 1;
    return sum / count;
  } catch (e) {
    console.warn('[_kisoAverageOcrConfidence]', e);
    return 1;
  }
}

// =============================================
// 基礎計算 Phase 4-3：Drive 連携
// =============================================
// 仕様書 §3.4：
//   - ルートフォルダ：マイ活_基礎計算_答案写真
//   - 年月サブフォルダ：マイ活_基礎計算_答案写真/YYYY-MM/
//   - ファイル名：{生徒ID}_{rank}_{sessionId}.jpg
//   - 保存期間：15 日（cleanupKisoPhotos が日次トリガーで削除）

const KISO_PHOTO_ROOT_FOLDER = 'マイ活_基礎計算_答案写真';
const KISO_PHOTO_RETAIN_DAYS = 15;

// マイドライブ直下にルートフォルダを 1 個確保（同名複数個の場合は最初の 1 個を採用）
function _ensureKisoPhotoRootFolder() {
  const it = DriveApp.getFoldersByName(KISO_PHOTO_ROOT_FOLDER);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(KISO_PHOTO_ROOT_FOLDER);
}

// 年月サブフォルダ（'2026-04' 形式）を確保
function _ensureKisoPhotoFolder(yearMonth) {
  const root = _ensureKisoPhotoRootFolder();
  const it = root.getFoldersByName(yearMonth);
  if (it.hasNext()) return it.next();
  return root.createFolder(yearMonth);
}

// 1 枚を Drive に保存し、KisoPhotos に 1 行追記する。
// 戻り値: { ok, fileId, shareUrl, deleteAfter, fileName }
//   - 失敗時: { ok: false, message }
// submitKisoAnswer の初回提出経路（Phase 4-2 で組み込み済み）から呼ばれる。
function _saveKisoPhoto(studentId, sessionId, rank, count, imageBase64) {
  try {
    const sid = String(studentId || '').trim();
    if (!sid)       return { ok: false, message: '生徒IDが空です' };
    if (!sessionId) return { ok: false, message: 'sessionId が空です' };
    if (!imageBase64) return { ok: false, message: '画像データが空です' };

    // base64 → Blob
    const decoded = Utilities.base64Decode(String(imageBase64));
    const blob = Utilities.newBlob(decoded, 'image/jpeg', 'tmp.jpg');

    // 提出日（教育日基準でファイル分類するとフォルダ跨ぎが微妙なので、ここはカレンダー JST）
    const submittedAt = _nowJST();
    const submittedDate = _todayJST();              // 'yyyy-MM-dd'
    const yearMonth = submittedDate.slice(0, 7);    // 'yyyy-MM'

    // 削除予定日 = submittedDate + 15 日
    const delAfter = new Date(submittedDate + 'T12:00:00+09:00');
    delAfter.setDate(delAfter.getDate() + KISO_PHOTO_RETAIN_DAYS);
    const deleteAfter = Utilities.formatDate(delAfter, 'Asia/Tokyo', 'yyyy-MM-dd');

    // フォルダ確保 + ファイル作成
    const folder = _ensureKisoPhotoFolder(yearMonth);
    const fileName = sid + '_' + rank + '_' + sessionId + '.jpg';
    const file = folder.createFile(blob).setName(fileName);
    const fileId = file.getId();
    // Phase 6：setSharing(ANYONE_WITH_LINK) を削除。写真は Drive 直アクセス不可。
    // 表示は GAS プロキシ経由で base64 配信する設計に変更：
    //   - admin/teacher → getKisoPhotoBlob（閲覧 + DL 可）
    //   - 生徒 Mode B   → getKisoPhotoBlobForStudent（sid×fileId 突合チェック、閲覧のみ）
    // shareUrl は KisoPhotos.shareUrl 列の互換性のため 'private' プレースホルダー。
    const shareUrl = 'private';

    // KisoPhotos シートに記録（解答用紙: photoType='answer' / photoIndex=1）
    const sh = _ensureKisoPhotosSheet();
    sh.appendRow([
      sessionId,
      sid,
      Number(rank) || 0,
      Number(count) || 0,
      fileId,
      shareUrl,
      submittedAt,
      deleteAfter,
      'answer',
      1
    ]);
    // ⚠️ 書き込み確定（flush）：直後の getKisoPhotoBlobForStudent 突合で
    // appendRow が反映されていない事例の防止策（Apps Script の Sheets 内部
    // バッファリングで別 execution の読み取りに反映されない既知問題）。
    SpreadsheetApp.flush();

    return {
      ok: true,
      fileId: fileId,
      shareUrl: shareUrl,
      deleteAfter: deleteAfter,
      fileName: fileName
    };
  } catch (err) {
    console.error('[_saveKisoPhoto]', err);
    return { ok: false, message: String(err) };
  }
}

// 途中式写真を Drive に保存し、KisoPhotos に photoType='work' で 1 行追記する。
// AI 認識（Vision API）は呼ばない。Drive 保存と DB 記録のみ。
// - sessionId は事前に startKisoSession 済みである必要がある
// - photoIndex は呼び出し側で 1, 2, 3... と通し番号管理する
// 戻り値: { ok, fileId, shareUrl, deleteAfter, fileName, photoIndex }
function _saveKisoWorkPhoto(studentId, sessionId, rank, count, imageBase64, photoIndex) {
  try {
    const sid = String(studentId || '').trim();
    if (!sid)         return { ok: false, message: '生徒IDが空です' };
    if (!sessionId)   return { ok: false, message: 'sessionId が空です' };
    if (!imageBase64) return { ok: false, message: '画像データが空です' };
    const idx = Number(photoIndex) || 1;

    const decoded = Utilities.base64Decode(String(imageBase64));
    const blob = Utilities.newBlob(decoded, 'image/jpeg', 'tmp.jpg');

    const submittedAt   = _nowJST();
    const submittedDate = _todayJST();
    const yearMonth     = submittedDate.slice(0, 7);

    const delAfter = new Date(submittedDate + 'T12:00:00+09:00');
    delAfter.setDate(delAfter.getDate() + KISO_PHOTO_RETAIN_DAYS);
    const deleteAfter = Utilities.formatDate(delAfter, 'Asia/Tokyo', 'yyyy-MM-dd');

    const folder = _ensureKisoPhotoFolder(yearMonth);
    const fileName = sid + '_' + rank + '_' + sessionId + '_work' + idx + '.jpg';
    const file = folder.createFile(blob).setName(fileName);
    const fileId = file.getId();
    // Phase 6：setSharing(ANYONE_WITH_LINK) を削除。_saveKisoPhoto と同方針。
    // 表示は getKisoPhotoBlob / getKisoPhotoBlobForStudent 経由の base64 配信。
    const shareUrl = 'private';

    const sh = _ensureKisoPhotosSheet();
    sh.appendRow([
      sessionId,
      sid,
      Number(rank) || 0,
      Number(count) || 0,
      fileId,
      shareUrl,
      submittedAt,
      deleteAfter,
      'work',
      idx
    ]);
    // _saveKisoPhoto と同方針：appendRow の書き込み確定
    SpreadsheetApp.flush();

    return {
      ok: true,
      fileId: fileId,
      shareUrl: shareUrl,
      deleteAfter: deleteAfter,
      fileName: fileName,
      photoIndex: idx
    };
  } catch (err) {
    console.error('[_saveKisoWorkPhoto]', err);
    return { ok: false, message: String(err) };
  }
}

// Drive 上の 1 ファイルをゴミ箱へ。既に削除されているなどのエラーは握りつぶす（best-effort）。
// 戻り値: { ok: boolean, error?: string }
function _deleteKisoPhoto(driveFileId) {
  try {
    if (!driveFileId) return { ok: true };
    DriveApp.getFileById(String(driveFileId)).setTrashed(true);
    return { ok: true };
  } catch (err) {
    console.warn('[_deleteKisoPhoto]', driveFileId, err);
    return { ok: false, error: String(err) };
  }
}

// =============================================
// Phase 6：基礎計算 答案写真の認証付き base64 配信
// =============================================

// fileId から KisoPhotos シートで sid / sessionId を逆引き（操作ログ details 用）。
// 見つからなければ空オブジェクト（ログ記録は best-effort、業務処理は壊さない）。
function _kisoPhotoLookupByFileId(fileId) {
  try {
    const sh = _ss().getSheetByName(SHEET_KISO_PHOTOS);
    if (!sh || sh.getLastRow() < 2) return {};
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const cFid = header.indexOf('driveFileId');
    const cSid = header.indexOf('studentId');
    const cSes = header.indexOf('sessionId');
    if (cFid < 0) return {};
    const target = String(fileId || '').trim();
    for (let i = 1; i < values.length; i++) {
      const rowFid = String(values[i][cFid] || '').trim();
      if (rowFid === target) {
        return {
          sid:       (cSid >= 0) ? String(values[i][cSid] || '').trim() : '',
          sessionId: (cSes >= 0) ? String(values[i][cSes] || '').trim() : ''
        };
      }
    }
  } catch (e) {
    console.error('[_kisoPhotoLookupByFileId]', e);
  }
  return {};
}

// admin / teacher 用の写真 base64 配信（閲覧 + DL 用途）。
// 入力: { teacherId, password, fileId }
// 出力: _verifyTeacherAndGetDriveBlob(params, true) のレスポンスをそのまま返す
// 共通基盤 (_verifyTeacherAndGetDriveBlob) は録音側 commit 1 で実装済。
//
// 操作ログ：成功時に KISO_PHOTO_VIEW を記録（admin/teacher の閲覧監査用）。
// DL ボタン押下経由のログは別 API logKisoPhotoDownload で独立記録（DL は外部
// 持出の重要行為のため独立カウント、ふくちさん指示）。
function getKisoPhotoBlob(params) {
  const res = _verifyTeacherAndGetDriveBlob(params, true);
  if (res && res.ok) {
    try {
      const teacherId = String((params && params.teacherId) || '').trim();
      const fileId    = String((params && params.fileId)    || '').trim();
      const meta = _kisoPhotoLookupByFileId(fileId);
      _logTeacherAction(teacherId, 'KISO_PHOTO_VIEW', '', 'success', {
        fileId:    fileId,
        sid:       meta.sid       || '',
        sessionId: meta.sessionId || ''
      });
    } catch (e) {
      console.error('[getKisoPhotoBlob log]', e);
    }
  }
  return res;
}

// admin/teacher が「⬇️ ダウンロード」ボタンを押した時に明示的にログ記録する API。
// getKisoPhotoBlob のキャッシュヒット時でも DL を確実に記録できるよう独立 API。
// 入力: { teacherId, password, fileId }
// 出力: { ok:true } または { ok:false, message }
//
// 認証スコープ：_verifyTeacher 通過（admin/teacher 両方OK、active=true 限定）。
// 写真の DL は admin/teacher 両方可（HANDOVER.md Q10）。
function logKisoPhotoDownload(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const fileId = String((params && params.fileId) || '').trim();
    if (!fileId) return { ok: false, message: 'fileId が指定されていません' };
    const meta = _kisoPhotoLookupByFileId(fileId);
    _logTeacherAction(_teacher.teacherId, 'KISO_PHOTO_DOWNLOAD', '', 'success', {
      fileId:    fileId,
      sid:       meta.sid       || '',
      sessionId: meta.sessionId || ''
    });
    return { ok: true };
  } catch (err) {
    console.error('[logKisoPhotoDownload]', err);
    return { ok: false, message: String(err) };
  }
}

// 生徒（Mode B 過去セッション再表示）用の写真 base64 配信（閲覧のみ、DL 不可は UI 側で実施）。
// ふくちさん確定ルール（HANDOVER.md Q10）：
//   「生徒は自分の sid に紐付く写真のみ閲覧可能、他生徒の写真は閲覧不可」
//
// セキュリティの核心：
//   1) studentId と fileId のペアが KisoPhotos シートに存在することを確認
//   2) 一致しなければ拒否（他生徒のファイル盗み見を防止）
//   3) 一致すれば DriveApp.getFileById でブロブ化 → base64 返却
//
// 入力: { studentId, fileId }
// 出力: { ok:true, base64, mime, fileName, sizeBytes }
//      { ok:false, message:'生徒IDが指定されていません' }
//      { ok:false, message:'fileId が指定されていません' }
//      { ok:false, message:'アクセス権がありません' }  ← sid×fileId 不一致
//      { ok:false, message:'ファイルが見つかりません' }
function getKisoPhotoBlobForStudent(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    const fileId = String((params && params.fileId) || '').trim();
    if (!fileId) return { ok: false, message: 'fileId が指定されていません' };

    // KisoPhotos シートで { studentId, fileId } のペア突合
    const sh = _ss().getSheetByName(SHEET_KISO_PHOTOS);
    if (!sh || sh.getLastRow() < 2) {
      return { ok: false, message: 'アクセス権がありません' };
    }
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const cSid = header.indexOf('studentId');
    const cFid = header.indexOf('driveFileId');
    if (cSid < 0 || cFid < 0) {
      console.warn('[getKisoPhotoBlobForStudent] KisoPhotos シートのヘッダー構造が想定外');
      return { ok: false, message: 'アクセス権がありません' };
    }
    let matched = false;
    let sidMatchCount = 0;
    let fidMatchCount = 0;
    let sampleSidRows = []; // sid 一致した行の fileId（デバッグ用、上限 5 件）
    for (let i = 1; i < values.length; i++) {
      const rowSidRaw = values[i][cSid];
      const rowFidRaw = values[i][cFid];
      const rowSid = String(rowSidRaw == null ? '' : rowSidRaw).trim();
      const rowFid = String(rowFidRaw == null ? '' : rowFidRaw).trim();
      if (rowSid === sid && rowFid === fileId) {
        matched = true;
        break;
      }
      if (rowSid === sid) {
        sidMatchCount++;
        if (sampleSidRows.length < 5) sampleSidRows.push({ rowFid: rowFid, rowFidLen: rowFid.length, rowFidType: typeof rowFidRaw });
      }
      if (rowFid === fileId) fidMatchCount++;
    }
    if (!matched) {
      // ⚠️ セキュリティガード：他生徒の fileId を直接叩いてもここで拒否される。
      // バグ調査用に詳細ログを残す（2026-05-11 追加）：
      //   sid 一致行があるのに fileId が違う → 撮影写真の sid×fileId ペアが意図と違う
      //   fileId 一致行があるのに sid が違う → 他生徒の fileId 直叩き（正常拒否）
      //   両方ゼロ → KisoPhotos シート未反映（appendRow 反映遅延）or fileId が不正
      console.warn('[getKisoPhotoBlobForStudent] sid×fileId 突合失敗', {
        sid: sid,
        sidLen: sid.length,
        fileId: fileId,
        fileIdLen: fileId.length,
        sidMatchCount: sidMatchCount,
        fidMatchCount: fidMatchCount,
        sampleSidRows: sampleSidRows,
        totalRows: values.length - 1
      });
      return { ok: false, message: 'アクセス権がありません' };
    }

    // 突合 OK：Drive から取得して base64 化
    let file;
    try {
      file = DriveApp.getFileById(fileId);
    } catch (e) {
      console.error('[getKisoPhotoBlobForStudent] DriveApp.getFileById failed:', fileId, e);
      return { ok: false, message: 'ファイルが見つかりません' };
    }
    try {
      const blob = file.getBlob();
      const bytes = blob.getBytes();
      return {
        ok: true,
        base64: Utilities.base64Encode(bytes),
        mime: blob.getContentType() || 'image/jpeg',
        fileName: file.getName() || '',
        sizeBytes: bytes.length
      };
    } catch (e) {
      console.error('[getKisoPhotoBlobForStudent] blob/base64 failed:', fileId, e);
      return { ok: false, message: 'ファイル取得に失敗しました：' + String(e) };
    }
  } catch (err) {
    console.error('[getKisoPhotoBlobForStudent]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// Phase 6：既存 KisoPhotos の一括非公開化バッチ（GAS エディタ手動実行のみ）
// =============================================
// KisoPhotos シートの driveFileId 列を駆動して
// DriveApp.getFileById(fileId).setSharing(PRIVATE, VIEW) を実行する。
//
// 6 分実行制限対策として { startIndex, limit } で分割実行可能：
//   - 初回：migrateKisoPhotosToPrivate() → startIndex=0, limit=200 で実行
//   - 続行：戻り値の hasMore=true なら、ふくちさんが
//          migrateKisoPhotosToPrivate({startIndex: <nextStartIndex>}) を実行
//   - hasMore=false まで繰り返し
//
// 削除済み・既に PRIVATE のファイルは個別スキップ（errors:[] に蓄積するが部分成功許容）。
//
// ⚠️ Phase 2 commit 59857f2 の保守バッチ原則踏襲、URL ルーティング登録なし。
//
// 戻り値: { ok, total, processedFromIndex, processedTo, succeeded, failed,
//          errors:[{fileId, reason}], hasMore, nextStartIndex, elapsedSec }
//
// ロールバック手段：緊急時は手動で setSharing(ANYONE_WITH_LINK) を Drive UI から復元可能。
// （リスオン側の migrateLisonRecordingsToShared に相当する逆方向バッチは KisoPhotos には
//   従来も存在しなかったため、Phase 6 でも追加しない。緊急時は Drive UI から個別復元）。
function migrateKisoPhotosToPrivate(params) {
  const t0 = Date.now();
  const startIndex = Math.max(0, Number(params && params.startIndex) || 0);
  const limit      = Math.max(1, Math.min(500, Number(params && params.limit) || 200));
  const result = {
    ok: true,
    total: 0,
    processedFromIndex: startIndex,
    processedTo: startIndex,
    succeeded: 0,
    failed: 0,
    errors: [],
    hasMore: false,
    nextStartIndex: startIndex,
    elapsedSec: 0
  };
  try {
    const sh = _ss().getSheetByName(SHEET_KISO_PHOTOS);
    if (!sh || sh.getLastRow() < 2) {
      console.log('[migrateKisoPhotosToPrivate] KisoPhotos が空です');
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iFid = header.indexOf('driveFileId');
    if (iFid < 0) {
      console.warn('[migrateKisoPhotosToPrivate] driveFileId 列が見つかりません');
      result.ok = false;
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }

    // データ行から fileId を抽出（重複は許容、Drive 側で setSharing は冪等なので問題なし）
    const fileIds = [];
    for (let i = 1; i < values.length; i++) {
      const fid = String(values[i][iFid] || '').trim();
      if (fid) fileIds.push(fid);
    }
    result.total = fileIds.length;

    const endIndex = Math.min(startIndex + limit, fileIds.length);
    result.processedTo = endIndex;
    result.hasMore = endIndex < fileIds.length;
    result.nextStartIndex = result.hasMore ? endIndex : fileIds.length;

    if (startIndex >= fileIds.length) {
      console.log('[migrateKisoPhotosToPrivate] startIndex 超過。total=' + result.total
        + ', startIndex=' + startIndex);
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }

    console.log('[migrateKisoPhotosToPrivate] 開始: total=' + result.total
      + ', range=[' + startIndex + ',' + endIndex + ')');

    for (let k = startIndex; k < endIndex; k++) {
      const fid = fileIds[k];
      try {
        const file = DriveApp.getFileById(fid);
        // setSharing(PRIVATE, VIEW) で「リンク共有解除、明示共有先のみ閲覧可」状態。
        // GAS スクリプトオーナー以外はアクセス不可になる。setSharing 引数は
        // commit adb9c10 で確立した正しい enum 値を使用（NONE は存在しない）。
        file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
        result.succeeded++;
      } catch (e) {
        result.failed++;
        result.errors.push({ fileId: fid, reason: String(e) });
        console.warn('[migrateKisoPhotosToPrivate] failed: fileId=' + fid + ' err=' + e);
      }
      // 進捗ログ：20 件ごと（写真は録音より大量想定なので間引く）
      if ((k - startIndex + 1) % 20 === 0) {
        console.log('[migrateKisoPhotosToPrivate] 進捗 '
          + (k - startIndex + 1) + '/' + (endIndex - startIndex)
          + ' succeeded=' + result.succeeded + ' failed=' + result.failed);
      }
    }

    console.log('[migrateKisoPhotosToPrivate] 完了: succeeded=' + result.succeeded
      + ' failed=' + result.failed + ' hasMore=' + result.hasMore
      + ' nextStartIndex=' + result.nextStartIndex);

    result.elapsedSec = (Date.now() - t0) / 1000;
    return result;
  } catch (err) {
    console.error('[migrateKisoPhotosToPrivate]', err);
    result.ok = false;
    result.elapsedSec = (Date.now() - t0) / 1000;
    return result;
  }
}

// =============================================
// 基礎計算 履歴一覧 API（生徒画面 screen-kiso-history 用）
// =============================================
// 入力: { studentId, limit?: 50 }
// 出力: { ok, items:[{
//          sessionId, rank, rankName, count, status,
//          correctCount, total, hpEarned, photoFileId,
//          startedAt, completedAt,
//          results:[{ no, questionId, problemLatex, answerCanonical,
//                     studentAnswer:'', correct }]
//        }, ...], total }
//
// 設計：
// - KisoSessions シートの status='passed' / 'failed_retry' のみ
//   ('in_progress' / 'abandoned' は除外、生徒の振り返り対象外)
// - studentId で絞り込み + completedAt 降順
// - results 配列は wrongIds / questionIds / problemLatexes から構築
//   - studentAnswer は KisoSessions に永続保存されていないため空文字
//     （フロント側の _showKisoReview は「履歴データには残っていません」表示）
//   - answerCanonical は KisoQuestions シートからルックアップ
// - photoFileId は KisoPhotos シートから sessionId + photoType='answer' で取得
//
// パフォーマンス考慮：
// - KisoQuestions / KisoPhotos のルックアップは Map にキャッシュして O(N+M+K)
// - 末尾 N 行読みではなく全件スキャン（KisoSessions は 1000 行台まで現実的）
function getKisoHistoryForStudent(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    const limit = Math.max(1, Math.min(200, Number(params && params.limit) || 50));

    const ss = _ss();
    const sesSh = ss.getSheetByName(SHEET_KISO_SESSIONS);
    if (!sesSh || sesSh.getLastRow() < 2) return { ok: true, items: [], total: 0 };

    const sesValues = sesSh.getDataRange().getValues();
    const sH = sesValues[0];
    const cSesId    = sH.indexOf('sessionId');
    const cSesSid   = sH.indexOf('studentId');
    const cSesRank  = sH.indexOf('rank');
    const cSesCount = sH.indexOf('count');
    const cSesQids  = sH.indexOf('questionIds');
    const cSesStat  = sH.indexOf('status');
    const cSesStart = sH.indexOf('startedAt');
    const cSesEnd   = sH.indexOf('completedAt');
    const cSesHp    = sH.indexOf('hpEarned');
    const cSesWrong = sH.indexOf('wrongIds');
    const cSesLatex = sH.indexOf('problemLatexes');
    if (cSesId < 0 || cSesSid < 0 || cSesStat < 0) {
      return { ok: false, message: 'KisoSessions シートのヘッダー構造が想定外です' };
    }

    // 1. KisoSessions から sid + status='passed'/'failed_retry' を抽出
    const sessions = [];
    for (let i = 1; i < sesValues.length; i++) {
      const r = sesValues[i];
      if (String(r[cSesSid] || '').trim() !== sid) continue;
      const status = String(r[cSesStat] || '').trim();
      if (status !== 'passed' && status !== 'failed_retry') continue;
      const completedAtRaw = (cSesEnd >= 0) ? r[cSesEnd] : '';
      const completedAt = (completedAtRaw instanceof Date)
        ? Utilities.formatDate(completedAtRaw, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
        : String(completedAtRaw || '');
      const startedAtRaw = (cSesStart >= 0) ? r[cSesStart] : '';
      const startedAt = (startedAtRaw instanceof Date)
        ? Utilities.formatDate(startedAtRaw, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
        : String(startedAtRaw || '');
      sessions.push({
        sessionId:   String(r[cSesId] || ''),
        rank:        Number(r[cSesRank]) || 0,
        count:       Number(r[cSesCount]) || 0,
        status:      status,
        startedAt:   startedAt,
        completedAt: completedAt,
        hpEarned:    Number(r[cSesHp]) || 0,
        questionIds: String((cSesQids  >= 0) ? r[cSesQids]  : ''),
        wrongIds:    String((cSesWrong >= 0) ? r[cSesWrong] : ''),
        problemLatexes: String((cSesLatex >= 0) ? r[cSesLatex] : '')
      });
    }
    if (sessions.length === 0) return { ok: true, items: [], total: 0 };

    // completedAt 降順 → limit 件で打ち切り
    sessions.sort(function(a, b){
      return a.completedAt < b.completedAt ? 1 : (a.completedAt > b.completedAt ? -1 : 0);
    });
    const trimmed = sessions.slice(0, limit);

    // 2. KisoQuestions シートから rank → rankName マップ + questionId → {problemLatex, answerCanonical} マップ
    const qSh = ss.getSheetByName(SHEET_KISO_QUESTIONS);
    const rankNameMap = {};       // rank → rankName
    const questionMap = {};       // questionId → { problemLatex, answerCanonical }
    if (qSh && qSh.getLastRow() >= 2) {
      const qValues = qSh.getDataRange().getValues();
      const qH = qValues[0];
      const qCQid  = qH.indexOf('questionId');
      const qCRank = qH.indexOf('rank');
      const qCName = qH.indexOf('rankName');
      const qCLtx  = qH.indexOf('problemLatex');
      const qCCan  = qH.indexOf('answerCanonical');
      if (qCQid >= 0) {
        for (let i = 1; i < qValues.length; i++) {
          const qid = String(qValues[i][qCQid] || '').trim();
          if (!qid) continue;
          const rk = (qCRank >= 0) ? (Number(qValues[i][qCRank]) || 0) : 0;
          const rn = (qCName >= 0) ? String(qValues[i][qCName] || '').trim() : '';
          if (rk && rn && !rankNameMap[rk]) rankNameMap[rk] = rn;
          questionMap[qid] = {
            problemLatex:    (qCLtx  >= 0) ? String(qValues[i][qCLtx]  || '') : '',
            answerCanonical: (qCCan  >= 0) ? String(qValues[i][qCCan]  || '') : ''
          };
        }
      }
    }

    // 3. KisoPhotos シートから sessionId → photoFileId（photoType='answer' のみ）
    const pSh = ss.getSheetByName(SHEET_KISO_PHOTOS);
    const photoMap = {};
    if (pSh && pSh.getLastRow() >= 2) {
      const pValues = pSh.getDataRange().getValues();
      const pH = pValues[0];
      const pCSes  = pH.indexOf('sessionId');
      const pCFid  = pH.indexOf('driveFileId');
      const pCType = pH.indexOf('photoType');
      if (pCSes >= 0 && pCFid >= 0) {
        for (let i = 1; i < pValues.length; i++) {
          const ses = String(pValues[i][pCSes] || '').trim();
          if (!ses) continue;
          const ptype = (pCType >= 0) ? String(pValues[i][pCType] || '').trim() : 'answer';
          if (ptype && ptype !== 'answer') continue; // 途中式は除外（メイン解答のみ）
          if (photoMap[ses]) continue; // 最初の 1 件で十分（同じ session に複数 answer はないはず）
          photoMap[ses] = String(pValues[i][pCFid] || '');
        }
      }
    }

    // 4. 各セッションについて results 配列を構築
    const items = trimmed.map(function(s) {
      let qids = [];
      let wrongs = [];
      let latexes = [];
      try { qids   = s.questionIds ? JSON.parse(s.questionIds) : []; } catch (e) { qids = []; }
      try { wrongs = s.wrongIds    ? JSON.parse(s.wrongIds)    : []; } catch (e) { wrongs = []; }
      try { latexes = s.problemLatexes ? JSON.parse(s.problemLatexes) : []; } catch (e) { latexes = []; }
      const wrongSet = {};
      for (let k = 0; k < wrongs.length; k++) wrongSet[String(wrongs[k])] = true;

      const total = qids.length || s.count || 0;
      const correctCount = total - wrongs.length;
      const results = qids.map(function(qid, idx) {
        const qstr = String(qid);
        const meta = questionMap[qstr] || {};
        // problemLatex は KisoSessions の保存値（problemLatexes）優先、無ければ KisoQuestions から
        const latex = (Array.isArray(latexes) && latexes[idx]) ? String(latexes[idx]) : (meta.problemLatex || '');
        return {
          no:              idx + 1,
          questionId:      qstr,
          problemLatex:    latex,
          answerCanonical: meta.answerCanonical || '',
          studentAnswer:   '',  // KisoSessions に永続保存されていないため空（フロント側でフォールバック表示）
          correct:         !wrongSet[qstr]
        };
      });

      const rankName = rankNameMap[s.rank] || ('rank ' + s.rank);
      return {
        sessionId:    s.sessionId,
        rank:         s.rank,
        rankName:     rankName,
        count:        s.count,
        status:       s.status,
        correctCount: correctCount,
        total:        total,
        hpEarned:     s.hpEarned,
        photoFileId:  photoMap[s.sessionId] || '',
        startedAt:    s.startedAt,
        completedAt:  s.completedAt,
        results:      results
      };
    });

    return { ok: true, items: items, total: sessions.length };
  } catch (err) {
    console.error('[getKisoHistoryForStudent]', err);
    return { ok: false, message: String(err) };
  }
}

// 管理画面用：保存中の答案写真を取得
// 仕様書 §5.3 / §5.4：
//   - studentId 指定なし → 生徒一覧サマリ（写真ありの生徒のみ、最新提出日時の降順）
//   - studentId 指定あり → その生徒の写真を提出日時降順で全件返却
// 認証必須（_verifyTeacher）
function getKisoPhotosList(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const sidFilter = String((params && params.studentId) || '').trim();

    const sh = _ensureKisoPhotosSheet();
    if (sh.getLastRow() < 2) {
      return sidFilter
        ? { ok: true, mode: 'detail', studentId: sidFilter, photos: [] }
        : { ok: true, mode: 'summary', students: [] };
    }
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const cSession = header.indexOf('sessionId');
    const cSid     = header.indexOf('studentId');
    const cRank    = header.indexOf('rank');
    const cCount   = header.indexOf('count');
    const cFileId  = header.indexOf('driveFileId');
    const cShare   = header.indexOf('shareUrl');
    const cSubmit  = header.indexOf('submittedAt');
    const cDelete  = header.indexOf('deleteAfter');
    const cPhType  = header.indexOf('photoType');     // 新列：列が無い古いシートは -1
    const cPhIdx   = header.indexOf('photoIndex');

    // 生徒名マップ（Step 2：全アカウント対象 = Students + SpecialAccounts）
    const stuRows = _getAllAccountsValues();
    const nameMap = {};
    for (let i = 1; i < stuRows.length; i++) {
      const id = String(stuRows[i][COL_ID] || '').trim();
      if (!id) continue;
      const real = String(stuRows[i][COL_NAME] || '').trim();
      const nick = String(stuRows[i][COL_NICKNAME] || '').trim();
      nameMap[id] = { real: real, nick: nick };
    }

    // KisoSessions も読み込んで status / attempts / rankName / hasWorkPhoto を引く
    const sesSh = _ensureKisoSessionsSheet();
    const sesMap = {};
    if (sesSh.getLastRow() >= 2) {
      const sv = sesSh.getDataRange().getValues();
      const sh0 = sv[0];
      const sCSession  = sh0.indexOf('sessionId');
      const sCStatus   = sh0.indexOf('status');
      const sCAttempts = sh0.indexOf('attempts');
      const sCRank     = sh0.indexOf('rank');
      const sCHasWork  = sh0.indexOf('hasWorkPhoto');
      for (let i = 1; i < sv.length; i++) {
        const id = String(sv[i][sCSession] || '');
        if (!id) continue;
        const hwRaw = (sCHasWork >= 0) ? sv[i][sCHasWork] : '';
        sesMap[id] = {
          status: String(sv[i][sCStatus] || ''),
          attempts: Number(sv[i][sCAttempts]) || 0,
          rank: Number(sv[i][sCRank]) || 0,
          hasWorkPhoto: (hwRaw === true || hwRaw === 'TRUE' || hwRaw === 'true' || hwRaw === 1)
        };
      }
    }

    // KisoPhotos 行を整形
    const photos = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const sid = String(row[cSid] || '').trim();
      if (!sid) continue;
      if (sidFilter && sid !== sidFilter) continue;
      const fileId = String(row[cFileId] || '');
      const sessionId = String(row[cSession] || '');
      const submittedTs = row[cSubmit];
      const submittedAt = (submittedTs instanceof Date)
        ? Utilities.formatDate(submittedTs, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
        : String(submittedTs || '');
      const deleteAfter = _toDateStr(row[cDelete]);
      const ses = sesMap[sessionId] || {};
      // photoType / photoIndex 列が無い古いシートでは答案写真として扱う
      const photoType = (cPhType >= 0) ? (String(row[cPhType] || '').trim() || 'answer') : 'answer';
      const photoIndex = (cPhIdx >= 0) ? (Number(row[cPhIdx]) || 1) : 1;
      photos.push({
        sessionId: sessionId,
        studentId: sid,
        studentName: (nameMap[sid] && nameMap[sid].real) || '',
        studentNickname: (nameMap[sid] && nameMap[sid].nick) || '',
        rank: Number(row[cRank]) || 0,
        count: Number(row[cCount]) || 0,
        driveFileId: fileId,
        shareUrl: String(row[cShare] || ''),
        thumbnailUrl: fileId ? ('https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400') : '',
        viewUrl: fileId ? ('https://drive.google.com/file/d/' + fileId + '/view') : '',
        submittedAt: submittedAt,
        deleteAfter: deleteAfter,
        sessionStatus: ses.status || '',
        sessionAttempts: ses.attempts || 0,
        photoType: photoType,
        photoIndex: photoIndex,
        hasWorkPhoto: !!ses.hasWorkPhoto
      });
    }

    // 提出日時降順
    photos.sort(function(a, b){ return a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : 0; });

    if (sidFilter) {
      return { ok: true, mode: 'detail', studentId: sidFilter, photos: photos };
    }

    // §5.3 サマリ：studentId ごとに集約
    const bySid = {};
    photos.forEach(function(p){
      if (!bySid[p.studentId]) {
        bySid[p.studentId] = {
          studentId: p.studentId,
          studentName: p.studentName,
          studentNickname: p.studentNickname,
          photoCount: 0,
          latestSubmittedAt: '',
          earliestDeleteAfter: ''
        };
      }
      const e = bySid[p.studentId];
      e.photoCount += 1;
      if (!e.latestSubmittedAt || p.submittedAt > e.latestSubmittedAt) e.latestSubmittedAt = p.submittedAt;
      if (!e.earliestDeleteAfter || (p.deleteAfter && p.deleteAfter < e.earliestDeleteAfter)) e.earliestDeleteAfter = p.deleteAfter;
    });
    const students = Object.keys(bySid).map(function(k){ return bySid[k]; });
    students.sort(function(a, b){ return a.latestSubmittedAt < b.latestSubmittedAt ? 1 : a.latestSubmittedAt > b.latestSubmittedAt ? -1 : 0; });

    return { ok: true, mode: 'summary', students: students };
  } catch (err) {
    console.error('[getKisoPhotosList]', err);
    return { ok: false, message: String(err) };
  }
}

// 日次クリーンアップ（仕様書 §3.4）
// - KisoPhotos を走査し、deleteAfter <= today のレコードについて：
//   1. Drive ファイルを setTrashed
//   2. シート行を削除
// - GAS UI から Time-based Trigger を 03:00〜04:00 に手動設定する想定
//   （バックアップが 02:00〜03:00、教育日切替が 04:00 のため、その合間）
// 戻り値: { ok, processed, deleted, failed: [...], dryRun }
function cleanupKisoPhotos(opts) {
  try {
    opts = opts || {};
    const dryRun = !!opts.dryRun;

    const sh = _ensureKisoPhotosSheet();
    if (sh.getLastRow() < 2) {
      return { ok: true, processed: 0, deleted: 0, failed: [], dryRun: dryRun };
    }
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const cFileId = header.indexOf('driveFileId');
    const cDelete = header.indexOf('deleteAfter');
    const cSid    = header.indexOf('studentId');

    const today = _todayJST();
    const failed = [];
    const targetRowIdxs = [];   // 1-based 行番号（ヘッダー行は 1、データは 2 から）

    for (let i = 1; i < values.length; i++) {
      const delAfter = _toDateStr(values[i][cDelete]);
      if (!delAfter) continue;
      if (delAfter > today) continue;             // まだ保持期間内
      targetRowIdxs.push({
        rowNum: i + 1,
        fileId: String(values[i][cFileId] || ''),
        studentId: String(values[i][cSid] || ''),
        deleteAfter: delAfter
      });
    }

    let deleted = 0;
    if (!dryRun) {
      // Drive 削除（先に一括）
      for (let k = 0; k < targetRowIdxs.length; k++) {
        const t = targetRowIdxs[k];
        const r = _deleteKisoPhoto(t.fileId);
        if (!r.ok) failed.push({ fileId: t.fileId, error: r.error });
      }
      // シート行削除（末尾→先頭の順、行番号ズレ防止）
      const sortedDesc = targetRowIdxs.slice().sort(function(a, b){ return b.rowNum - a.rowNum; });
      for (let k = 0; k < sortedDesc.length; k++) {
        try {
          sh.deleteRow(sortedDesc[k].rowNum);
          deleted += 1;
        } catch (err) {
          failed.push({ rowNum: sortedDesc[k].rowNum, error: String(err) });
        }
      }
    }

    return {
      ok: true,
      processed: targetRowIdxs.length,
      deleted: dryRun ? 0 : deleted,
      failed: failed,
      dryRun: dryRun,
      targets: targetRowIdxs
    };
  } catch (err) {
    console.error('[cleanupKisoPhotos]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 基礎計算 Phase 4-2：公開 API
// =============================================

// セッション開始（仕様書 §3.3 ステップ1）
// - rank に該当する問題から count 件をランダム抽出
// - KisoSessions に新行追加（status=in_progress, attempts=0, wrongIds=[]）
// - フロントには問題文のみ返却（answerCanonical / answerAllowed は送らない）
function startKisoSession(studentId, rank, count) {
  try {
    const sid = String(studentId || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    const r = Number(rank);
    if (!r || r < 1 || r > 20) return { ok: false, message: 'rank は 1〜20 を指定してください' };
    const n = Number(count);
    if (n !== 5 && n !== 10) return { ok: false, message: 'count は 5 または 10 のみ対応' };

    // rank 該当問題を取得
    const candidates = _getKisoQuestionRowsForRank(r);
    if (candidates.length < n) {
      return { ok: false, message: 'rank ' + r + ' の問題数が不足しています（必要 ' + n + ' / 在庫 ' + candidates.length + '）' };
    }

    // ランダム抽出（Fisher–Yates の途中打ち切り）+ problemLatex 重複排除
    // 生成側 main.py で seen_latex で重複は防いでいるが、過去デプロイ分の救済 +
    // 二重対策として、サーバ側でも problemLatex のユニーク性を保証する。
    // KisoQuestions の列構成：questionId(0) / rank(1) / rankName(2) /
    //                         difficultyBand(3) / problemLatex(4) / ...
    //
    // 2 段階方式：
    //   ① candidates から problemLatex でユニーク化したサブセット uniqueByLatex を作る
    //   ② uniqueByLatex から n 個ランダム抽出
    //   ③ unique 不足のときは元 candidates から行ユニークで充足（rank_04 Band C 等の救済）
    const uniqueByLatex = [];
    {
      const seenLatex = {};
      for (let i = 0; i < candidates.length; i++) {
        const plx = String(candidates[i][4] || '');
        if (plx && seenLatex[plx]) continue;  // 既に同 latex を採用済み → スキップ
        seenLatex[plx] = true;
        uniqueByLatex.push(candidates[i]);
      }
    }
    const taken = {};
    const picked = [];
    let safetyMax = uniqueByLatex.length * 3 + 10;  // ほぼ無限ループ回避用（unique=0 時の +10）
    while (picked.length < n && picked.length < uniqueByLatex.length && safetyMax-- > 0) {
      const idx = Math.floor(Math.random() * uniqueByLatex.length);
      if (taken[idx]) continue;
      taken[idx] = true;
      picked.push(uniqueByLatex[idx]);
    }
    // フォールバック：unique latex 数 < n のときは元 candidates から行ユニークで充足
    // （rank_04 Band C のような count > unique 上限ケースの最後の砦）
    if (picked.length < n) {
      console.warn('[startKisoSession] dedup unique 不足: rank=' + r
        + ' candidates=' + candidates.length + ' uniqueLatex=' + uniqueByLatex.length
        + ' n=' + n + ' picked=' + picked.length + ' → 行ユニークで充足');
      const pickedIds = {};
      picked.forEach(function(row){ pickedIds[String(row[0] || '')] = true; });
      for (let i = 0; i < candidates.length && picked.length < n; i++) {
        const qid = String(candidates[i][0] || '');
        if (pickedIds[qid]) continue;  // 既に採用済みの行はスキップ
        pickedIds[qid] = true;
        picked.push(candidates[i]);
      }
    }

    // セッション保存
    const sessionId = _kisoSessionId(sid);
    const startedAt = _nowJST();
    const questionIds = picked.map(function(row){ return String(row[0]); });
    // Phase 2 防衛策：抽出時の problemLatex を questionIds と並列で保存。
    // 進行中セッションが Phase 2 の問題プール入れ替えに巻き込まれても、
    // 生徒の画面表示は開始時の問題のまま固定される（採点は DB ルックアップなので
    // 運用上は abandonRank<N>InProgress で in_progress を停止させてから入れ替える）。
    // KisoQuestions 列: questionId(0)/rank(1)/rankName(2)/difficultyBand(3)/problemLatex(4)/...
    const problemLatexes = picked.map(function(row){ return String(row[4] || ''); });
    const sh = _ensureKisoSessionsSheet();
    // ヘッダー駆動 appendRow（KISO_SESSIONS_HEADERS と同順で構築）
    // hasWorkPhoto は初回提出時に submitKisoAnswer が更新するためここでは空文字
    sh.appendRow([
      sessionId,                     // 0 sessionId
      sid,                           // 1 studentId
      r,                             // 2 rank
      n,                             // 3 count
      JSON.stringify(questionIds),   // 4 questionIds
      'in_progress',                 // 5 status
      0,                             // 6 attempts
      startedAt,                     // 7 startedAt
      '',                            // 8 completedAt
      0,                             // 9 hpEarned
      '[]',                          // 10 wrongIds
      '',                            // 11 hasWorkPhoto（提出時に上書き）
      JSON.stringify(problemLatexes) // 12 problemLatexes（Phase 2 防衛策）
    ]);

    // フロントへ返す JSON（answer 系は除外）
    // KisoQuestions 列: questionId(0)/rank(1)/rankName(2)/difficultyBand(3)/problemLatex(4)/...
    const rankName = String(picked[0][2] || '');
    const questions = picked.map(function(row, i){
      return {
        no: i + 1,
        questionId: String(row[0]),
        problemLatex: String(row[4] || '')
      };
    });

    return {
      ok: true,
      sessionId: sessionId,
      studentId: sid,
      rank: r,
      rankName: rankName,
      count: n,
      questions: questions,
      createdAt: startedAt
    };
  } catch (err) {
    console.error('[startKisoSession]', err);
    return { ok: false, message: String(err) };
  }
}

// 再挑戦用問題取得（仕様書 §4.8 / §7.5）
// - KisoSessions の wrongIds を読み、該当問題の問題文だけを返す
// - 正解は返さない（紙教材の趣旨：生徒が自力で考え直す）
function getKisoRetryQuestions(sessionId) {
  try {
    const sid = String(sessionId || '').trim();
    if (!sid) return { ok: false, message: 'sessionId が必要です' };
    const found = _findKisoSessionRow(sid);
    if (!found) return { ok: false, message: 'セッションが見つかりません: ' + sid };

    const header = found.header;
    const row = found.row;
    const cWrong = header.indexOf('wrongIds');
    const cStatus = header.indexOf('status');
    const cQids = header.indexOf('questionIds');
    const cRank = header.indexOf('rank');

    const status = String(row[cStatus] || '');
    if (status === 'passed') {
      return { ok: false, message: 'このセッションは既に合格済みです' };
    }

    let wrongIds = [];
    try { wrongIds = JSON.parse(String(row[cWrong] || '[]')); } catch (e) { wrongIds = []; }
    if (!Array.isArray(wrongIds) || wrongIds.length === 0) {
      // 初回未提出 or wrongIds 未保存。questionIds（全件）にフォールバック
      try {
        const qids = JSON.parse(String(row[cQids] || '[]'));
        if (Array.isArray(qids)) wrongIds = qids;
      } catch (e) { /* 諦める */ }
    }

    const probs = _getKisoQuestionsByIds(wrongIds);
    // Phase 2 防衛策：保存済み problemLatex があれば優先（DB プール入れ替え後も
    // 生徒が見ていた問題テキストのまま再開できる）。空マップなら従来通り DB の値。
    const storedLatexMap = _buildKisoStoredLatexMap(row, header);
    const rankNum = Number(row[cRank]);
    const rankName = probs.length > 0 ? probs[0].rankName : '';
    const questions = probs.map(function(p, i){
      const stored = storedLatexMap[p.questionId];
      return {
        no: i + 1,
        questionId: p.questionId,
        problemLatex: (stored !== undefined && stored !== '') ? stored : p.problemLatex
      };
    });

    return {
      ok: true,
      sessionId: sid,
      rank: rankNum,
      rankName: rankName,
      count: questions.length,
      questions: questions
    };
  } catch (err) {
    console.error('[getKisoRetryQuestions]', err);
    return { ok: false, message: String(err) };
  }
}

// 答案写真の提出（仕様書 §7 採点 + §8 HP 加算）
// - imageBase64: 生徒のアップロード画像（base64、フロントでリサイズ済み）
// - 初回 (attempts=0): questionIds 全件を採点。80% 合格判定。初回のみ写真を Drive に保存（Phase 4-3）
// - 再挑戦 (attempts>=1): wrongIds のみ採点。全問正解で合格。写真は保存しない
function submitKisoAnswer(sessionId, imageBase64, hasWorkPhoto) {
  try {
    const sid = String(sessionId || '').trim();
    if (!sid) return { ok: false, message: 'sessionId が必要です' };
    if (!imageBase64) return { ok: false, message: '画像が空です' };

    const found = _findKisoSessionRow(sid);
    if (!found) return { ok: false, message: 'セッションが見つかりません: ' + sid };
    const header = found.header;
    const row = found.row;
    const sheet = found.sheet;
    const rowIdx = found.rowIdx;

    const cSid       = header.indexOf('studentId');
    const cRank      = header.indexOf('rank');
    const cCount     = header.indexOf('count');
    const cQids      = header.indexOf('questionIds');
    const cStatus    = header.indexOf('status');
    const cAttempts  = header.indexOf('attempts');
    const cCompleted = header.indexOf('completedAt');
    const cHpEarned  = header.indexOf('hpEarned');
    const cWrong     = header.indexOf('wrongIds');
    const cHasWork   = header.indexOf('hasWorkPhoto');

    const studentId = String(row[cSid] || '').trim();
    const rank = Number(row[cRank]);
    const count = Number(row[cCount]);
    const status = String(row[cStatus] || '');
    const prevAttempts = Number(row[cAttempts]) || 0;

    if (status === 'passed') {
      return { ok: false, message: 'このセッションは既に合格済みです' };
    }

    let allQids = [];
    try { allQids = JSON.parse(String(row[cQids] || '[]')); } catch (e) { allQids = []; }
    if (!Array.isArray(allQids) || allQids.length === 0) {
      return { ok: false, message: 'セッションに問題IDが保存されていません' };
    }

    const isFirstAttempt = (prevAttempts === 0);

    // 採点対象 ID リスト
    let targetIds;
    if (isFirstAttempt) {
      targetIds = allQids.slice();
    } else {
      let prevWrong = [];
      try { prevWrong = JSON.parse(String(row[cWrong] || '[]')); } catch (e) { prevWrong = []; }
      targetIds = (Array.isArray(prevWrong) && prevWrong.length > 0) ? prevWrong : allQids.slice();
    }

    // Gemini Vision で OCR + 番号別に答えを抽出
    // 旧 Vision API は分数の縦書き・手書き認識精度が低く、本番運用で誤判定が頻発したため
    // Gemini API（multimodal）に切替。Gemini は番号 → 答え の対応付けまで一括で行う。
    const geminiRes = _kisoOcrWithGemini(imageBase64, targetIds.length);
    if (!geminiRes.ok) return geminiRes;   // {ok:false, message, retake?} をそのまま返却
    const ocrText = geminiRes.ocrText;     // Gemini の生 JSON 応答（管理画面ログ用にプレビューする）
    const answersMap = geminiRes.answersMap;  // {"1":"1/4", "2":"1", ...}

    // 番号 → 答え の配列を組み立て
    const studentAnswers = [];
    for (let i = 0; i < targetIds.length; i++) {
      const num = i + 1;
      const a = (answersMap[String(num)] !== undefined) ? answersMap[String(num)] : answersMap[num];
      studentAnswers.push(String(a == null ? '' : a));
    }

    // 全部空なら再撮影を促す（Gemini が画像を全く読めなかったケース）
    let _nonEmptyCount = 0;
    for (let i = 0; i < studentAnswers.length; i++) {
      if (String(studentAnswers[i]).trim() !== '') _nonEmptyCount += 1;
    }
    if (_nonEmptyCount === 0) {
      return { ok: false, retake: true, message: '写真から答えが読み取れませんでした。明るい場所で、もう一度はっきり撮影してください。' };
    }

    // 各問題を採点
    const probs = _getKisoQuestionsByIds(targetIds);
    const probById = {};
    probs.forEach(function(p){ probById[p.questionId] = p; });
    // Phase 2 防衛策：保存済み problemLatex があれば results の表示用フィールドに優先採用。
    // 採点に使う answerAllowedJson / answerCanonical は引き続き probs（DB ルックアップ）を
    // 信頼源とする（運用上は abandonRank<N>InProgress で in_progress を停止させてから
    // 問題プールを入れ替えるため、DB と保存値が乖離しているケースは想定しない）。
    const storedLatexMap = _buildKisoStoredLatexMap(row, header);

    const results = [];
    let correctCount = 0;
    const newWrongIds = [];
    for (let i = 0; i < targetIds.length; i++) {
      const qid = targetIds[i];
      const p = probById[qid];
      const studentText = studentAnswers[i] || '';
      let correct = false;
      if (p) correct = _kisoMatchAnswer(studentText, p.answerAllowedJson);
      if (correct) correctCount += 1;
      else newWrongIds.push(qid);
      const storedLatex = storedLatexMap[qid];
      const displayLatex = (storedLatex !== undefined && storedLatex !== '')
        ? storedLatex
        : (p ? p.problemLatex : '');
      results.push({
        no: i + 1,
        questionId: qid,
        problemLatex: displayLatex,
        // answerCanonical を含める（Mode B 過去セッション閲覧で使用）。
        // startKisoSession のレスポンスには載せない（未提出時に正解漏洩を避けるため）が、
        // 提出後は採点結果と一緒に返してフロントで localStorage 保存 → Mode B で表示。
        answerCanonical: p ? p.answerCanonical : '',
        studentAnswer: studentText,
        correct: correct
      });
    }

    // 合格判定
    let passed = false;
    if (isFirstAttempt) {
      // 80% 以上で合格（仕様書 §7.4）
      passed = (correctCount / targetIds.length) >= 0.80;
    } else {
      // 再挑戦は全問正解で合格（仕様書 §7.5）
      passed = (newWrongIds.length === 0);
    }

    const now = _nowJST();
    const newAttempts = prevAttempts + 1;

    // セッション更新の準備
    const newStatus = passed ? 'passed' : 'failed_retry';
    let hpInfo = { rawHP: 0, hpGained: 0, isPractice: false, todayTotalAfter: 0, week: 1, streak: 1 };

    // 合格時の HP 計算
    if (passed) {
      // 2026-05-09 Step 0：行シフト事故防止のため、書き込み対象行はシートから sid で
      // フレッシュに特定する。streak / 現在 HP もここから読む。
      const stuLoc = _findAccountRowOnSheet(studentId);
      const streakValue = stuLoc ? (Number(stuLoc.rowValues[COL_STREAK]) || 1) : 1;
      const currentHP   = stuLoc ? (Number(stuLoc.rowValues[COL_HP])     || 0) : 0;
      const week = Math.ceil(streakValue / 7);
      const baseRawHP = (count === 5) ? 50 : 100;       // 仕様書 §8.1
      const todayTotalBefore = _kisoTodayRawHP(studentId);
      const remaining = Math.max(0, 100 - todayTotalBefore);
      const effectiveRawHP = Math.min(baseRawHP, remaining);   // 仕様書 §8.5 ケース 2
      const isPractice = (effectiveRawHP === 0);
      const hpGained = effectiveRawHP * week * week;

      // 2026-05-12 バグ④-本質 Phase B（案 A）：書き込み順序を _logHP → Students に変更。
      // 非練習モード（hpGained > 0）で HPLog 書き込みに失敗した場合は Students.HP /
      // KisoSessions 更新をスキップし、セッションを in_progress のまま残してエラー応答を
      // 返す（生徒は同じ写真で再提出すれば次回成功する）。
      // 練習モード（hpGained === 0）の場合は付与する HP がないため、_logHP 失敗は警告
      // ログのみで処理を継続する（KisoSessions / 写真保存は実行）。
      const logType = 'kiso_' + rank + '_' + count + (isPractice ? '_practice' : '');
      const logRes  = _logHP(studentId, effectiveRawHP, hpGained, logType);
      if (!logRes.ok && !isPractice && hpGained > 0) {
        console.error('[submitKisoAnswer] HPLog 書き込みに失敗しました。HP/KisoSessions 更新せず終了。', logRes.error);
        return { ok: false, message: '内部エラーが発生しました。もう一度試してください。', errorCode: 'HP_LOG_FAILED' };
      }

      // Students.HP 更新（in-place）
      if (!isPractice && stuLoc && hpGained > 0) {
        const newHP = currentHP + hpGained;
        stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_HP + 1).setValue(newHP);
        const upd = {};
        upd[COL_HP] = newHP;
        _updateAccountCacheBySid(studentId, upd);
      }

      _invalidateCache('cache_ranking_last_week');

      hpInfo = {
        rawHP: effectiveRawHP,
        hpGained: hpGained,
        isPractice: isPractice,
        todayTotalAfter: todayTotalBefore + effectiveRawHP,
        week: week,
        streak: streakValue,
        baseRawHP: baseRawHP,
        sessionType: logType
      };
    }

    // KisoSessions 行更新（status / attempts / wrongIds / completedAt / hpEarned）
    sheet.getRange(rowIdx, cStatus + 1).setValue(newStatus);
    sheet.getRange(rowIdx, cAttempts + 1).setValue(newAttempts);
    sheet.getRange(rowIdx, cWrong + 1).setValue(JSON.stringify(newWrongIds));
    if (passed) {
      sheet.getRange(rowIdx, cCompleted + 1).setValue(now);
      sheet.getRange(rowIdx, cHpEarned + 1).setValue(hpInfo.rawHP);
    }
    // 初回提出時のみ hasWorkPhoto を記録（再挑戦時は維持）。列が無い古いシートはスキップ
    if (isFirstAttempt && cHasWork >= 0) {
      sheet.getRange(rowIdx, cHasWork + 1).setValue(hasWorkPhoto === true || hasWorkPhoto === 'true');
    }

    // 初回提出のみ写真を Drive に保存（Phase 4-3 で本実装済み、_saveKisoPhoto が
    // KisoPhotos シート追記まで完結する）
    let photoInfo = null;
    if (isFirstAttempt) {
      try {
        photoInfo = _saveKisoPhoto(studentId, sid, rank, count, imageBase64);
      } catch (e) {
        console.error('[_saveKisoPhoto error]', e);
        photoInfo = { ok: false, message: String(e) };
      }
    }

    return {
      ok: true,
      sessionId: sid,
      attempts: newAttempts,
      isFirstAttempt: isFirstAttempt,
      passed: passed,
      total: targetIds.length,
      correctCount: correctCount,
      results: results,
      wrongIds: newWrongIds,
      hpInfo: hpInfo,
      photoInfo: photoInfo,
      ocrPreview: ocrText.length > 600 ? ocrText.substring(0, 600) + '…' : ocrText
    };
  } catch (err) {
    console.error('[submitKisoAnswer]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 途中式写真の提出（AI 認識なし、Drive 保存のみ）
// =============================================
// - sessionId に紐づく KisoSessions 行が存在する必要がある（startKisoSession 済み前提）
// - 送られてきた photoIndex が空・0 などの場合は、現状の最大 + 1 を採用
//   （フロントが連番管理するが、サーバ側でも保険として上書き）
// - KisoPhotos に photoType='work' で 1 行追加
// - 戻り値: { ok, photoIndex, fileId, deleteAfter }
function submitKisoWorkPhoto(sessionId, imageBase64, photoIndex) {
  try {
    const sid = String(sessionId || '').trim();
    if (!sid) return { ok: false, message: 'sessionId が必要です' };
    if (!imageBase64) return { ok: false, message: '画像が空です' };

    const found = _findKisoSessionRow(sid);
    if (!found) return { ok: false, message: 'セッションが見つかりません: ' + sid };
    const header = found.header;
    const row = found.row;
    const cSid   = header.indexOf('studentId');
    const cRank  = header.indexOf('rank');
    const cCount = header.indexOf('count');
    const studentId = String(row[cSid] || '').trim();
    const rank  = Number(row[cRank]);
    const count = Number(row[cCount]);

    // 現状 KisoPhotos にある同 sessionId / photoType='work' の最大 photoIndex を取得し +1
    const phSheet = _ensureKisoPhotosSheet();
    let nextIndex = Number(photoIndex) || 0;
    if (phSheet.getLastRow() >= 2) {
      const values = phSheet.getDataRange().getValues();
      const ph = values[0];
      const cPhSession = ph.indexOf('sessionId');
      const cPhType    = ph.indexOf('photoType');
      const cPhIdx     = ph.indexOf('photoIndex');
      if (cPhSession >= 0 && cPhType >= 0 && cPhIdx >= 0) {
        let maxIdx = 0;
        for (let i = 1; i < values.length; i++) {
          if (String(values[i][cPhSession] || '') !== sid) continue;
          if (String(values[i][cPhType]    || '') !== 'work') continue;
          const idx = Number(values[i][cPhIdx]) || 0;
          if (idx > maxIdx) maxIdx = idx;
        }
        // フロントから渡された photoIndex が現状 max 以下なら、サーバ側で max+1 に補正
        if (nextIndex <= maxIdx) nextIndex = maxIdx + 1;
      }
    }
    if (nextIndex < 1) nextIndex = 1;

    const saveRes = _saveKisoWorkPhoto(studentId, sid, rank, count, imageBase64, nextIndex);
    if (!saveRes.ok) return saveRes;

    return {
      ok: true,
      sessionId: sid,
      photoIndex: saveRes.photoIndex,
      fileId: saveRes.fileId,
      shareUrl: saveRes.shareUrl,
      deleteAfter: saveRes.deleteAfter
    };
  } catch (err) {
    console.error('[submitKisoWorkPhoto]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 先週の期間を返す（月曜〜日曜）
// =============================================
function _getLastWeekRange() {
  const todayStr = _todayJST();
  const d        = new Date(todayStr);
  const dow      = d.getDay(); // 0=日, 1=月, ...6=土

  // 今週の月曜日
  const daysFromMon = (dow === 0) ? 6 : dow - 1;
  const thisMon = new Date(d);
  thisMon.setDate(d.getDate() - daysFromMon);

  // 先週の月曜日・日曜日
  const lastMon = new Date(thisMon);
  lastMon.setDate(thisMon.getDate() - 7);
  const lastSun = new Date(thisMon);
  lastSun.setDate(thisMon.getDate() - 1);

  const fmt = date => Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
  return { start: fmt(lastMon), end: fmt(lastSun) };
}

// =============================================
// 週間HPランキング取得
// =============================================
function getWeeklyRanking() {
  try {
    // 派生結果をキャッシュ（6h TTL、saveAttempt / submitSango / submitWabun1 でクリア）
    const cached = CacheService.getScriptCache().get('cache_ranking_last_week');
    if (cached) {
      _cacheLog('cache_ranking_last_week', 'hit');
      try { return JSON.parse(cached); } catch(e) { /* 破損キャッシュは無視 */ }
    }
    const ss       = _ss();
    const logSheet = ss.getSheetByName(SHEET_HPLOG);

    const range = _getLastWeekRange();
    const HP_PER_TEST = 50;

    // 生徒マスタ（Step 2：全アカウント対象 = Students + SpecialAccounts。
    // ふくちさん方針「テスト枠が実生徒に勝ったら面白い」のためテスト枠も集計対象に含める）
    const stuRows = _getAllAccountsValues();
    if (!stuRows || stuRows.length < 2) return { ok: false, message: 'Studentsシートが見つかりません。' };
    const stuMap  = {};
    for (let i = 1; i < stuRows.length; i++) {
      const sid = String(stuRows[i][COL_ID]).trim();
      stuMap[sid] = {
        nickname: (String(stuRows[i][COL_NICKNAME] || '').trim()) || '名無し',
        totalHP:  Number(stuRows[i][COL_HP])     || 0,
        streak:   Number(stuRows[i][COL_STREAK]) || 0
      };
    }

    // HPLogから先週分の type='test' のみ件数カウント（1件 = 50HP、連続週数ボーナス除外）
    // HPLog 列構成（rawHP 追加後）：[0]timestamp [1]studentId [2]rawHP [3]hpGained [4]type
    const countMap = {};
    if (logSheet) {
      const logRows = logSheet.getDataRange().getValues();
      for (let i = 1; i < logRows.length; i++) {
        if (logRows[i][4] !== 'test') continue;
        const dateStr = _toDateStr(logRows[i][0]);
        if (dateStr < range.start || dateStr > range.end) continue;
        const sid = String(logRows[i][1]).trim();
        countMap[sid] = (countMap[sid] || 0) + 1;
      }
    }

    // 上位10名を選出
    const ranking = Object.keys(countMap)
      .filter(sid => countMap[sid] > 0 && stuMap[sid])
      .map(sid => ({
        nickname: stuMap[sid].nickname,
        weeklyHP: countMap[sid] * HP_PER_TEST,
        totalHP:  stuMap[sid].totalHP,
        title:    _getTitle(stuMap[sid].streak)
      }))
      .sort((a, b) => b.weeklyHP - a.weeklyHP)
      .slice(0, 10);

    const result = { ok: true, ranking, period: range };
    // 派生結果をキャッシュ（6h TTL）
    try {
      const ser = JSON.stringify(result);
      CacheService.getScriptCache().put('cache_ranking_last_week', ser, 21600);
      _cacheLog('cache_ranking_last_week', 'miss', 'put=' + ser.length + 'B');
    } catch(e) { console.error('[ranking cache put]', e); }
    return result;
  } catch(err) {
    console.error('[getWeeklyRanking]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 写真判定（Vision API）
// =============================================
function submitPhoto(studentId, setNo, imageBase64, words) {
  try {
    const apiKey = _props().getProperty('VISION_API_KEY');
    if (!apiKey) return { ok: false, message: 'APIキーが設定されていません。' };

    const url  = 'https://vision.googleapis.com/v1/images:annotate?key=' + apiKey;
    const body = {
      requests: [{
        image:    { content: imageBase64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }]
      }]
    };

    const res  = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(body), muteHttpExceptions: true
    });

    const json = JSON.parse(res.getContentText());
    if (!json.responses || !json.responses[0]) {
      return { ok: false, message: '画像の読み取りに失敗しました。' };
    }

    // OCR テキスト・期待単語の正規化（2026-05-08 追加、フロント sendPhoto と統一）
    // 手書きの隙間が OCR で「スペース」と認識され "classmate" → "class mate" のように
    // 分断されて完全一致判定が失敗する問題への対策。小文字化 + 全空白文字
    // （半角・全角・改行・タブ + zero-width 系の不可視文字）を全削除する。
    // 和文英訳① _normalizeWabun1 と同方針。
    const _normForDictation = function(s) {
      return String(s == null ? '' : s).toLowerCase().replace(/[\s　​‌‍⁠﻿]+/g, '');
    };

    const rawDetected = json.responses[0].fullTextAnnotation
      ? json.responses[0].fullTextAnnotation.text : '';
    const detected = _normForDictation(rawDetected);

    if (!detected) {
      return { ok: true, passed: false, message: '文字が読み取れませんでした。明るい場所でもう一度撮影してください。' };
    }

    const failedWords = [];
    for (const w of words) {
      const word  = _normForDictation(w);
      const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const count = (detected.match(regex) || []).length;
      if (count < 3) failedWords.push(w);
    }

    return failedWords.length === 0
      ? { ok: true, passed: true }
      : { ok: true, passed: false, failedWords, message: '以下の単語が3回書かれていないか、読み取れませんでした：' + failedWords.join('、') };
  } catch (err) {
    console.error('[submitPhoto]', err);
    return { ok: false, message: '判定中にエラーが発生しました：' + String(err) };
  }
}

// =============================================
// 合格済み履歴取得
// =============================================
function getHistory(studentId) {
  try {
    const sid    = String(studentId).trim();
    const aSheet = _ss().getSheetByName(SHEET_ATTEMPTS);
    const rows   = aSheet.getDataRange().getValues();
    const seen   = new Set();
    const history = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[1]).trim() !== sid) continue;
      if (row[5] !== '合格') continue;
      const lv    = String(row[6]);
      const setNo = Number(row[3]);
      const key   = lv + '_' + setNo;
      if (seen.has(key)) continue;
      seen.add(key);
      history.push({ date: String(row[0]).slice(0, 10), setNo, level: lv });
    }
    history.reverse();
    return { ok: true, history };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 指定セットの単語取得
// =============================================
function getSetWords(setNo, level) {
  try {
    const lv    = String(level).trim();
    const rows  = _getQuestionRowsForLevel(lv);
    const words = lv === '5級'
      ? _getWords(rows, Number(setNo), '5級')
      : _getWordsQ4(rows, Number(setNo), lv);
    if (words.length === 0) return { ok: false, message: 'データが見つかりません。' };
    return { ok: true, words };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 問題データ取得ヘルパー（レベル別キャッシュ対応）
// =============================================
// 指定レベルに該当する問題行（ヘッダー除く、レベルで絞り込み済）を返す
// - 5級: Q5 シート全体がそのまま対象（全行 5 級なのでフィルタ不要）
// - 4級〜準1級: Questions シートをレベル列（col 11）で分割してキャッシュ
// 初回 cache miss 時は Questions シートを 1 回読んで全レベルを一括キャッシュ
function _getQuestionRowsForLevel(lv) {
  if (lv === '5級') {
    return _getCachedValues('cache_q5_rows', 21600, function() {
      const sh = _ss().getSheetByName(SHEET_Q5);
      if (!sh || sh.getLastRow() < 2) return [];
      const values = sh.getDataRange().getValues();
      return values.slice(1); // ヘッダー除外
    });
  }
  const cache = CacheService.getScriptCache();
  const key = 'cache_q_rows_' + lv;
  const hit = cache.get(key);
  if (hit) {
    _cacheLog(key, 'hit');
    try { return JSON.parse(hit); } catch(e) { /* 破損キャッシュは無視 */ }
  }
  // cache miss: Questions シートを 1 回全件読み → レベル列で分割 → 全レベル一括保存
  _cacheLog(key, 'miss', 'reading full Questions sheet');
  const sh = _ss().getSheetByName(SHEET_QUESTIONS);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const byLevel = {};
  for (let i = 1; i < values.length; i++) {
    const g = String(values[i][11] || '').trim();
    if (!g) continue;
    if (!byLevel[g]) byLevel[g] = [];
    byLevel[g].push(values[i]);
  }
  Object.keys(byLevel).forEach(function(g){
    const k = 'cache_q_rows_' + g;
    try {
      const ser = JSON.stringify(byLevel[g]);
      if (ser.length < 95000) {
        cache.put(k, ser, 21600);
        _cacheLog(k, 'miss', 'put=' + ser.length + 'B (bulk)');
      } else {
        console.warn('[cache skip >95KB]', k, 'size=' + ser.length);
        _cacheLog(k, 'miss', 'skip>95KB');
      }
    } catch(e) { console.error('[cache put]', k, e); }
  });
  return byLevel[lv] || [];
}

function _getMaxSetForLevel(lv) {
  const rows = _getQuestionRowsForLevel(lv);
  let max = 0;
  for (let i = 0; i < rows.length; i++) {
    max = Math.max(max, Number(rows[i][0]) || 0);
  }
  return max;
}

function _getNextLevel(lv) {
  const idx = LEVEL_ORDER.indexOf(lv);
  return (idx >= 0 && idx < LEVEL_ORDER.length - 1) ? LEVEL_ORDER[idx + 1] : null;
}

// rowsOfLevel はレベル絞り込み済（ヘッダーなし）。setNo でさらに絞り込む。5級シート形状（10列）
function _getWords(rowsOfLevel, setNo, lv) {
  const words = [];
  for (let i = 0; i < rowsOfLevel.length; i++) {
    const row = rowsOfLevel[i];
    if (Number(row[0]) !== setNo) continue;
    words.push({
      setNo: Number(row[0]), qNo: Number(row[1]),
      word: String(row[2]), meaning: String(row[3]),
      choiceA: String(row[4]), choiceB: String(row[5]),
      choiceC: String(row[6]), choiceD: String(row[7]),
      answer: String(row[8]), grade: String(row[9])
    });
  }
  return words;
}

// rowsOfLevel はレベル絞り込み済（ヘッダーなし）。4級以上シート形状（12列）
function _getWordsQ4(rowsOfLevel, setNo, lv) {
  const words = [];
  for (let i = 0; i < rowsOfLevel.length; i++) {
    const row = rowsOfLevel[i];
    if (Number(row[0]) !== setNo) continue;
    words.push({
      setNo: Number(row[0]), qNo: Number(row[1]),
      word: String(row[2]), meaning: String(row[3]),
      example: String(row[4] || ''), blank: String(row[5] || ''),
      choiceA: String(row[6]), choiceB: String(row[7]),
      choiceC: String(row[8]), choiceD: String(row[9]),
      answer: String(row[10]), grade: String(row[11])
    });
  }
  return words;
}

// =============================================
// 景品交換申請
// =============================================
function submitExchange(studentId, rank) {
  try {
    const ss       = _ss();
    const exSheet  = ss.getSheetByName(SHEET_EXCHANGES);
    if (!exSheet) return { ok: false, message: 'シートが見つかりません。' };

    const rankDef = EXCHANGE_RANKS[rank];
    if (!rankDef) return { ok: false, message: '不明なランクです。' };

    const sid  = String(studentId).trim();
    // Step 2：全アカウント対象（テスト枠でも景品交換の動作確認ができるように）
    const rows = _getAllAccountsValues();
    if (!rows || rows.length < 2) return { ok: false, message: 'シートが見つかりません。' };

    let currentHP = 0, nickname = '';
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][COL_ID]).trim() !== sid) continue;
      currentHP = Number(rows[i][COL_HP]) || 0;
      nickname  = String(rows[i][COL_NICKNAME] || '').trim();
      break;
    }
    if (!nickname) return { ok: false, message: '生徒IDが見つかりません。' };

    if (currentHP < rankDef.hp) {
      return { ok: false, message: rankDef.label + 'の交換には ' + rankDef.hp.toLocaleString() + ' HPが必要です。現在 ' + currentHP.toLocaleString() + ' HP です。' };
    }

    const exRows = exSheet.getDataRange().getValues();
    for (let i = 1; i < exRows.length; i++) {
      if (String(exRows[i][1]).trim() === sid && String(exRows[i][3]) === rank) {
        return { ok: false, message: rankDef.label + 'はすでに申請・交換済みです。' };
      }
    }

    exSheet.appendRow([_nowJST(), sid, nickname, rank, currentHP, '申請中']);
    return { ok: true, message: rankDef.label + 'の交換申請を受け付けました！先生に声をかけてね。' };
  } catch(err) {
    console.error('[submitExchange]', err);
    return { ok: false, message: '申請に失敗しました。' };
  }
}

function getExchangeStatus(studentId) {
  try {
    const sid      = String(studentId).trim();
    const ss       = _ss();
    const exSheet  = ss.getSheetByName(SHEET_EXCHANGES);

    // Step 2：全アカウント対象（テスト枠でも交換ステータス取得できるように）
    let currentHP = 0;
    const stuRows = _getAllAccountsValues();
    for (let i = 1; i < stuRows.length; i++) {
      if (String(stuRows[i][COL_ID]).trim() === sid) {
        currentHP = Number(stuRows[i][COL_HP]) || 0; break;
      }
    }

    const exchanged = {};
    if (exSheet) {
      const exRows = exSheet.getDataRange().getValues();
      for (let i = 1; i < exRows.length; i++) {
        if (String(exRows[i][1]).trim() === sid) {
          exchanged[String(exRows[i][3])] = String(exRows[i][5]);
        }
      }
    }

    const ranks = Object.keys(EXCHANGE_RANKS).map(key => ({
      key,
      label:       EXCHANGE_RANKS[key].label,
      hp:          EXCHANGE_RANKS[key].hp,
      canExchange: currentHP >= EXCHANGE_RANKS[key].hp && !exchanged[key],
      status:      exchanged[key] || null
    }));

    return { ok: true, currentHP, ranks };
  } catch(err) {
    return { ok: false, message: String(err) };
  }
}

// =============================================
// テスト用
// =============================================
function testGet5() {
  const result = getTodaysSet('1004', '5級');
  console.log(JSON.stringify(result));
}

function testVisionAuth() {
  const apiKey = _props().getProperty('VISION_API_KEY');
  const url = 'https://vision.googleapis.com/v1/images:annotate?key=' + apiKey;
  UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: '{}', muteHttpExceptions: true });
  console.log('権限承認OK');
}

function getDeployUrl() {
  console.log(ScriptApp.getService().getUrl());
}

// =============================================
// 今日の一言（Quoteシート）
//   Quoteシートの列: date | text | author
//   今日の日付と一致する行があれば優先、なければランダム1件
// =============================================
// =====================================================
// 今日の一言
// =====================================================

function getQuote() {
  try {
    // Quote シート全体をキャッシュ経由で取得（6h TTL、adminAddQuote でクリア）
    var values = _getCachedValues('cache_quote_values', 21600, function() {
      var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUOTE);
      if (!sh) return [];
      return sh.getDataRange().getValues();
    });
    if (!values || values.length < 2) return { ok:false, message:'データがありません' };

    // ヘッダー行からインデックスを動的に取得（列順が変わっても動くように）
    var header = values[0].map(function(h){ return String(h).trim().toLowerCase(); });
    var iDate   = header.indexOf('date');
    var iText   = header.indexOf('text');
    var iAuthor = header.indexOf('author');
    // ヘッダーが無い場合のフォールバック
    if (iText < 0) { iDate = 0; iText = 1; iAuthor = 2; }

    // text が空の行を除外
    var rows = values.slice(1).filter(function(r){
      return String(r[iText] || '').trim() !== '';
    });
    if (rows.length === 0) return { ok:false, message:'有効なデータがありません' };

    // 今日の日付（JST）
    var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

    // date 列が今日と一致する行を優先
    var match = null;
    for (var i = 0; i < rows.length; i++) {
      var d = rows[i][iDate];
      if (!d) continue;
      var dStr = '';
      if (d instanceof Date) {
        dStr = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
      } else {
        var parsed = new Date(d);
        dStr = isNaN(parsed.getTime())
          ? String(d).trim()
          : Utilities.formatDate(parsed, 'Asia/Tokyo', 'yyyy-MM-dd');
      }
      if (dStr === today) { match = rows[i]; break; }
    }

    // 一致が無ければランダム
    var row = match || rows[Math.floor(Math.random() * rows.length)];
    return {
      ok: true,
      quote: {
        text:   String(row[iText]   || '').trim(),
        author: iAuthor >= 0 ? String(row[iAuthor] || '').trim() : ''
      }
    };
  } catch (e) {
    return { ok:false, message: String(e) };
  }
}

function setAdminPassword() {
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', 'ここにパスワードを入力');
}

// =====================================================
// 管理画面用 API
// =====================================================

// ⚠️ Phase 1 で _verifyAdmin（ADMIN_PASSWORD ベース）から _verifyTeacher（Teachers シートベース）に
// 認証フローを切替済（CLAUDE.md 講師ログイン機能 Phase 1 参照）。_verifyAdmin / setAdminPassword は
// Phase 2 完了まで保険として残置するが、新しい認証フローでは呼ばれない。
function _verifyAdmin(password) {
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  return !!stored && password === stored;
}

// =====================================================
// 講師ログイン基盤（Phase 1）
// =====================================================
// 設計：
//  - Teachers シート 7 列（A〜G）：teacherId / teacherName / password(SHA-256 hex) / role / displayNickname / active / firstLoginCompleted
//  - パスワードは SHA-256 + teacherId を salt としてハッシュ化、64 文字 hex で保存（平文は保存しない）
//  - role は 'admin' / 'teacher' の 2 段階（案 A）
//  - active=false の講師はログイン拒否
//  - firstLoginCompleted は Phase 1.5 で初回ログインフローの分岐に使う（Phase 1 では認証成功時に値を返すだけ）

// 任意の値を boolean に正規化する。'TRUE' / 'true' / true / 1 / '1' を真と判定。
// 空セル（''）は false 扱い。
function _teacherTruthy(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1) return true;
  if (v === 0) return false;
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

// SHA-256(salt + plaintext) を 64 文字小文字 hex で返す。
// salt は teacherId を使用する想定。空文字でも動作する（テスト用途）。
function _passwordHash(plaintext, salt) {
  const input = String(salt || '') + String(plaintext == null ? '' : plaintext);
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    // computeDigest は signed byte（-128〜127）を返すので 0xFF マスクで unsigned 化
    let b = bytes[i] & 0xFF;
    let h = b.toString(16);
    if (h.length === 1) h = '0' + h;
    hex += h;
  }
  return hex; // 64 文字
}

// Teachers シートから teacherId に対応する行情報を取得する。
// active=false の場合は null を返す（ログイン拒否）。
// 戻り値: { teacherId, teacherName, passwordHash, role, displayNickname, active, firstLoginCompleted } or null
function _getTeacherInfo(teacherId) {
  try {
    const target = String(teacherId || '').trim();
    if (!target) return null;
    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh || sh.getLastRow() < 2) return null;
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iId   = header.indexOf('teacherId');
    const iName = header.indexOf('teacherName');
    const iPw   = header.indexOf('password');
    const iRole = header.indexOf('role');
    const iNick = header.indexOf('displayNickname');
    const iAct  = header.indexOf('active');
    const iFlc  = header.indexOf('firstLoginCompleted');
    if (iId < 0 || iPw < 0) return null;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][iId] || '').trim() !== target) continue;
      const active = (iAct >= 0) ? _teacherTruthy(values[i][iAct]) : false;
      if (!active) return null; // active=false ならログイン拒否
      return {
        teacherId:           target,
        teacherName:         iName >= 0 ? String(values[i][iName] || '').trim() : '',
        passwordHash:        String(values[i][iPw] || '').trim(),
        role:                iRole >= 0 ? String(values[i][iRole] || '').trim() : '',
        displayNickname:     iNick >= 0 ? String(values[i][iNick] || '').trim() : '',
        active:              true,
        firstLoginCompleted: iFlc >= 0 ? _teacherTruthy(values[i][iFlc]) : false
      };
    }
    return null;
  } catch (e) {
    console.error('[_getTeacherInfo]', e);
    return null;
  }
}

// 講師認証。teacherId + 平文パスワードを照合。
// 成功時: { teacherId, teacherName, role, displayNickname, active, firstLoginCompleted }（passwordHash は除外）
// 失敗時: null
// 失敗のケース：teacherId 空 / password 空 / 行が無い / active=false / ハッシュ不一致
function _verifyTeacher(teacherId, password) {
  const target = String(teacherId || '').trim();
  const pw     = String(password == null ? '' : password);
  if (!target || !pw) return null;
  const info = _getTeacherInfo(target);
  if (!info) return null;
  // シート上のハッシュが空（パスワード未設定）の場合はログイン不可
  if (!info.passwordHash) return null;
  const calc = _passwordHash(pw, target);
  // 大文字混在で保存された場合に備えて小文字統一で比較
  if (calc.toLowerCase() !== String(info.passwordHash).toLowerCase()) return null;
  return {
    teacherId:           info.teacherId,
    teacherName:         info.teacherName,
    role:                info.role,
    displayNickname:     info.displayNickname,
    active:              info.active,
    firstLoginCompleted: info.firstLoginCompleted
  };
}

// GAS エディタから手動実行する初期パスワード設定関数。
// （Phase 3 の講師管理 UI で UI 化される予定だが、それまでの繋ぎとして用意）
// 引数の plaintext は console.log しない（漏洩防止）。
//
// 使い方（GAS エディタ）：
//   setInitialTeacherPassword('t102', 'noblesse0311')
function setInitialTeacherPassword(teacherId, plaintext) {
  try {
    const target = String(teacherId || '').trim();
    if (!target) { Logger.log('teacherId が空です'); return { ok: false }; }
    if (plaintext == null || String(plaintext) === '') { Logger.log('plaintext が空です'); return { ok: false }; }
    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh || sh.getLastRow() < 2) { Logger.log('Teachers シートが見つかりません'); return { ok: false }; }
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iId = header.indexOf('teacherId');
    const iPw = header.indexOf('password');
    if (iId < 0 || iPw < 0) { Logger.log('teacherId / password 列が見つかりません'); return { ok: false }; }
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][iId] || '').trim() !== target) continue;
      const hash = _passwordHash(plaintext, target);
      sh.getRange(i + 1, iPw + 1).setValue(hash);
      Logger.log('[setInitialTeacherPassword] ' + target + ' のパスワードハッシュを更新しました');
      return { ok: true };
    }
    Logger.log('teacherId ' + target + ' が見つかりません。先に行を追加してください');
    return { ok: false };
  } catch (e) {
    console.error('[setInitialTeacherPassword]', e);
    return { ok: false, message: String(e) };
  }
}

// Teachers シートのパスワード列を一括でハッシュ化する。
// 平文パスワードがハッシュ済みかどうかは、文字列長で判定（SHA-256 hex は 64 文字、平文は通常それより短い）。
// 既にハッシュ化されている行（64 文字 + hex 構成）はスキップ。
//
// ⚠️ ふくちさんが GAS エディタから 1 度だけ手動実行する想定。
// 実行後、平文パスワードは Teachers シートから完全に消える。
//
// Phase 1 投入時の実行順序：
//   1. clasp push（ただしまだ新版はデプロイしない）
//   2. ★ migrateTeachersPasswordHash() を手動実行（既存平文をハッシュ化）
//   3. ensureTeachersSheet() を手動実行（G 列追加 + t101 firstLoginCompleted=TRUE）
//   4. 新版を Apps Script でデプロイ
function migrateTeachersPasswordHash() {
  try {
    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh) { Logger.log('Teachers シートが見つかりません'); return { ok: false, migrated: 0 }; }
    const lastRow = sh.getLastRow();
    if (lastRow < 2) { Logger.log('Teachers シートに行がありません'); return { ok: true, migrated: 0 }; }
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iId = header.indexOf('teacherId');
    const iPw = header.indexOf('password');
    if (iId < 0 || iPw < 0) { Logger.log('teacherId / password 列が見つかりません'); return { ok: false, migrated: 0 }; }
    let migrated = 0;
    let skipped  = 0;
    let emptyRow = 0;
    const hexRe = /^[0-9a-f]{64}$/i;
    for (let i = 1; i < values.length; i++) {
      const sid = String(values[i][iId] || '').trim();
      const pw  = String(values[i][iPw] || '').trim();
      if (!sid) { emptyRow++; continue; } // teacherId 空欄行はスキップ（バッファ枠 t108-t110 等）
      if (!pw) { emptyRow++; continue; }  // password 空欄もスキップ
      if (hexRe.test(pw)) { skipped++; continue; } // 既にハッシュ化済み
      // 平文 → ハッシュ化
      const hash = _passwordHash(pw, sid);
      sh.getRange(i + 1, iPw + 1).setValue(hash);
      migrated++;
    }
    Logger.log('[migrateTeachersPasswordHash] migrated=' + migrated + ' skipped=' + skipped + ' empty=' + emptyRow);
    return { ok: true, migrated: migrated, skipped: skipped, emptyRow: emptyRow };
  } catch (e) {
    console.error('[migrateTeachersPasswordHash]', e);
    return { ok: false, message: String(e) };
  }
}

// 講師ログイン。Phase 1：teacherId + パスワードで Teachers シートを検索しハッシュ照合。
// 戻り値: { ok, teacherId, role, displayNickname, firstLoginCompleted } または { ok:false, message }
function adminLogin(params) {
  const teacherId = String((params && params.teacherId) || '').trim();
  const password  = String((params && params.password) || '');
  if (!teacherId || !password) {
    return { ok: false, message: '講師IDとパスワードを入力してください' };
  }
  const teacher = _verifyTeacher(teacherId, password);
  if (!teacher) {
    // エラーメッセージは曖昧に保つ（teacherId 存在の有無を漏らさない）
    return { ok: false, message: '講師IDまたはパスワードが違います' };
  }
  return {
    ok:                  true,
    teacherId:           teacher.teacherId,
    role:                teacher.role,
    displayNickname:     teacher.displayNickname || '',
    firstLoginCompleted: !!teacher.firstLoginCompleted
  };
}

// =====================================================
// 講師ログイン Phase 1.5：初回ログインフロー
// =====================================================
// 設計：
//  - 初期パスワード `noblesse0311`（および t101 のみ過去の `noblesse`）は
//    変更後パスワードとして再利用不可（運用上の共通配布値のため）
//  - 認証は通常通り _verifyTeacher（旧パスワードでハッシュ照合）
//  - firstLoginCompleted=TRUE の行は再実行を拒否（誤操作防止）
//  - パスワードと displayNickname の両方をバリデーションした上で C/E/G 列を一括更新

// 初期パスワードかどうかを判定。
// t101 は移行期に `noblesse` で運用していたため、両方を禁止対象に含める。
// それ以外の講師は `noblesse0311`（一斉配布用）のみが禁止対象。
function _isInitialPassword(plaintext, teacherId) {
  const pw  = String(plaintext == null ? '' : plaintext);
  const tid = String(teacherId || '').trim();
  if (pw === 'noblesse0311') return true;
  if (tid === 't101' && pw === 'noblesse') return true;
  return false;
}

// Teachers シートで teacherId に該当する行を探し、
//   C列（password）= newPasswordHash
//   E列（displayNickname）= newDisplayNickname
//   G列（firstLoginCompleted）= TRUE
// を一括更新する（setValues で 1 回の呼び出し）。
// 列の順序が想定と違っても header.indexOf で動的に探すので、ヘッダー駆動で安全に動く。
// ただし C/E/G が連続していない可能性に備え、3 セルを個別に書き込む（パフォーマンス影響は無視できる範囲）。
//
// 戻り値: 成功時 true、失敗時 false（行が無い / 列が無い）
function _completeFirstLogin(teacherId, newPasswordHash, newDisplayNickname) {
  try {
    const target = String(teacherId || '').trim();
    if (!target) return false;
    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh || sh.getLastRow() < 2) return false;
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iId   = header.indexOf('teacherId');
    const iPw   = header.indexOf('password');
    const iNick = header.indexOf('displayNickname');
    const iFlc  = header.indexOf('firstLoginCompleted');
    if (iId < 0 || iPw < 0 || iNick < 0 || iFlc < 0) return false;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][iId] || '').trim() !== target) continue;
      const row = i + 1;
      sh.getRange(row, iPw   + 1).setValue(newPasswordHash);
      sh.getRange(row, iNick + 1).setValue(newDisplayNickname);
      sh.getRange(row, iFlc  + 1).setValue(true); // boolean TRUE で書く（_teacherTruthy が真と判定）
      return true;
    }
    return false;
  } catch (e) {
    console.error('[_completeFirstLogin]', e);
    return false;
  }
}

// 初回ログイン時のパスワード変更 + displayNickname 設定。
// 引数: { teacherId, password, newPassword, newPasswordConfirm, newDisplayNickname }
// 戻り値: { ok:true, displayNickname } または { ok:false, message }
//
// バリデーション順序（早期リターン）：
//   1. 旧パスワード認証（_verifyTeacher）
//   2. 既に firstLoginCompleted=TRUE なら拒否
//   3. 新パスワードのバリデーション（6 文字以上 / 確認一致 / 初期パスワード再利用禁止）
//   4. displayNickname のバリデーション（trim 後 1〜10 文字）
//   5. ハッシュ化 → シート更新
function completeFirstLogin(params) {
  try {
    const teacherId            = String((params && params.teacherId) || '').trim();
    const password             = String((params && params.password) || '');
    const newPassword          = String((params && params.newPassword) || '');
    const newPasswordConfirm   = String((params && params.newPasswordConfirm) || '');
    const newDisplayNickname   = String((params && params.newDisplayNickname) || '').trim();

    // 1. 認証
    const teacher = _verifyTeacher(teacherId, password);
    if (!teacher) {
      return { ok: false, message: '講師IDまたはパスワードが違います' };
    }
    // 2. 既に完了済の行は再実行不可
    if (teacher.firstLoginCompleted) {
      return { ok: false, message: '既に初期設定が完了しています' };
    }
    // 3-a. 新パスワード長
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, message: 'パスワードは6文字以上で入力してください' };
    }
    // 3-b. 確認一致
    if (newPassword !== newPasswordConfirm) {
      return { ok: false, message: 'パスワード（確認）が一致しません' };
    }
    // 3-c. 初期パスワード再利用禁止
    if (_isInitialPassword(newPassword, teacherId)) {
      return { ok: false, message: '初期パスワードと同じものは使用できません。別のパスワードに変更してください' };
    }
    // 4. displayNickname
    if (!newDisplayNickname || newDisplayNickname.length < 1 || newDisplayNickname.length > 10) {
      return { ok: false, message: '表示名は1〜10文字で入力してください' };
    }
    // 5. ハッシュ化 + シート更新
    const newHash = _passwordHash(newPassword, teacherId);
    const ok = _completeFirstLogin(teacherId, newHash, newDisplayNickname);
    if (!ok) {
      return { ok: false, message: 'シート更新に失敗しました。管理者に連絡してください' };
    }
    return { ok: true, displayNickname: newDisplayNickname };
  } catch (e) {
    console.error('[completeFirstLogin]', e);
    return { ok: false, message: String(e) };
  }
}

// =====================================================
// 講師ログイン基盤（Phase 2）：ロール別権限ガード
// =====================================================
// 設計：
//  - role は Phase 1 で 'admin' / 'teacher' の 2 段階（t101 = admin / t102〜t109 = teacher）
//  - _verifyTeacher 成功後に _requireAdmin で admin 専用判定を行う
//  - エラー文言は「この操作は管理者のみ可能です」で統一（論点④）
//  - 保守バッチ系（migrateLisonRecordingsToShared / migrateLisonSubmissionsAddFileId /
//    cleanupLisonOldRecordings）は doGet / doPost ルーティングから完全に削除済み
//    （Phase 2、漏洩耐性向上）。関数本体は残しており、GAS エディタからの手動実行 +
//    Time-based Trigger（cleanupLisonOldRecordings 日次）のみで動作する。
//    将来 URL 経由が必要になった時はルーティング再追加 + admin ガードを併せて入れること。

// teacher オブジェクトの role が 'admin' かを判定する。
// _verifyTeacher の戻り値（成功時オブジェクト、失敗時 null）を渡す前提。
// null / undefined / role 列が空 / 'teacher' などはすべて false。
function _requireAdmin(teacher) {
  return !!(teacher && teacher.role === 'admin');
}

// =====================================================
// 講師管理（Phase 3）
// =====================================================
// 設計（CLAUDE.md 講師ログイン機能 Phase 3 / 論点 P1〜P10 確定事項参照）：
//  - admin 専用の講師管理 UI 用バックエンド。読み取り 1（doGet）+ 書き込み 5（doPost）。
//  - 物理削除なし。「削除」は active=false で兼用（P2）。
//  - パスワード再発行は 'noblesse0311' 固定 + firstLoginCompleted=false（P3、Phase 1.5 と整合）。
//  - 新規追加は teacherId 自動採番（P4、_findNextTeacherId）。
//  - 各操作の return 直前に Phase 4 操作ログ用 TODO コメントを残す（P7）。

// 「最後の active=true admin 喪失防止」ロックの根拠：
// このアプリの admin 権限は実質的に塾長（t101 ふくち）専属であり、
// admin が誰もいなくなる状態 = アプリそのものの終了を意味する。
// このチェックは技術的事故防止であると同時に、アプリの存続を守る仕組み。
//
// active=true かつ role='admin' の講師数を返す。
// excludeTeacherId が指定された場合は、その teacherId を除外してカウントする
// （「ある講師の active を false にしたら admin が 0 になるか」の事前判定用）。
function _countActiveAdmins(excludeTeacherId) {
  try {
    const exclude = excludeTeacherId ? String(excludeTeacherId).trim() : '';
    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh || sh.getLastRow() < 2) return 0;
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iId   = header.indexOf('teacherId');
    const iRole = header.indexOf('role');
    const iAct  = header.indexOf('active');
    if (iId < 0 || iRole < 0 || iAct < 0) return 0;
    let count = 0;
    for (let i = 1; i < values.length; i++) {
      const sid  = String(values[i][iId] || '').trim();
      if (!sid) continue;
      if (exclude && sid === exclude) continue;
      const role = String(values[i][iRole] || '').trim();
      const act  = _teacherTruthy(values[i][iAct]);
      if (role === 'admin' && act) count++;
    }
    return count;
  } catch (e) {
    console.error('[_countActiveAdmins]', e);
    return 0;
  }
}

// Teachers シートから全行情報を取得する（active 問わず、Phase 3 講師管理 UI 用）。
// _getTeacherInfo は active=false で null を返すため一覧用には使えないので別途用意。
// passwordHash は返さず hasPassword（boolean）で代替（情報漏洩防止）。
// 戻り値: [{ teacherId, teacherName, role, displayNickname, active, firstLoginCompleted, hasPassword, rowIndex(1-indexed) }, ...]
function _getAllTeacherRows() {
  try {
    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh || sh.getLastRow() < 2) return [];
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iId   = header.indexOf('teacherId');
    const iName = header.indexOf('teacherName');
    const iPw   = header.indexOf('password');
    const iRole = header.indexOf('role');
    const iNick = header.indexOf('displayNickname');
    const iAct  = header.indexOf('active');
    const iFlc  = header.indexOf('firstLoginCompleted');
    if (iId < 0) return [];
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      const sid = String(values[i][iId] || '').trim();
      if (!sid) continue; // teacherId 空欄行（バッファ枠）はスキップ
      const pwHash = iPw >= 0 ? String(values[i][iPw] || '').trim() : '';
      rows.push({
        teacherId:           sid,
        teacherName:         iName >= 0 ? String(values[i][iName] || '').trim() : '',
        role:                iRole >= 0 ? String(values[i][iRole] || '').trim() : '',
        displayNickname:     iNick >= 0 ? String(values[i][iNick] || '').trim() : '',
        active:              iAct >= 0 ? _teacherTruthy(values[i][iAct]) : false,
        firstLoginCompleted: iFlc >= 0 ? _teacherTruthy(values[i][iFlc]) : false,
        hasPassword:         !!pwHash,
        rowIndex:            i + 1 // 1-indexed
      });
    }
    return rows;
  } catch (e) {
    console.error('[_getAllTeacherRows]', e);
    return [];
  }
}

// teacherId から Teachers シート上の行番号（1-indexed）を返す。見つからなければ -1。
function _findTeacherRowIndex(teacherId) {
  try {
    const target = String(teacherId || '').trim();
    if (!target) return -1;
    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh || sh.getLastRow() < 2) return -1;
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iId = header.indexOf('teacherId');
    if (iId < 0) return -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][iId] || '').trim() === target) return i + 1;
    }
    return -1;
  } catch (e) {
    console.error('[_findTeacherRowIndex]', e);
    return -1;
  }
}

// 既存全 teacherId から t<数字> パターンの最大値を取り出し、+1 した次の ID を返す。
// 例：t101 / t102 / t108 がある場合 → 't109' を返す。
// t101 のみの場合 → 't102' を返す。
// 既存値ゼロの場合 → 't101' を返す（理論上 ensureTeachersSheet で t101 は必ず作られているので発生しない）。
// 999 を超えた場合は安全側で例外（4 桁拡張は将来対応）。
function _findNextTeacherId() {
  const rows = _getAllTeacherRows();
  let maxNum = 100; // t101 が最低ライン
  rows.forEach(function(r) {
    const m = /^t(\d{3,})$/.exec(r.teacherId);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  });
  const next = maxNum + 1;
  if (next > 999) throw new Error('teacherId が t999 を超えました（4 桁拡張が必要）');
  return 't' + next;
}

// 管理画面：講師一覧を取得する（Phase 3）。
// 認証必須、admin 専用。passwordHash は返さない（hasPassword 真偽値のみ）。
// active=false の行も含めて全件返す（管理画面の「無効化された講師」セクション用）。
function adminListTeachers(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    const rows = _getAllTeacherRows();
    // クライアントには rowIndex は返さない（内部実装の漏洩を避ける）
    const teachers = rows.map(function(r) {
      return {
        teacherId:           r.teacherId,
        teacherName:         r.teacherName,
        role:                r.role,
        displayNickname:     r.displayNickname,
        active:              r.active,
        firstLoginCompleted: r.firstLoginCompleted,
        hasPassword:         r.hasPassword
      };
    });
    return { ok: true, teachers: teachers };
  } catch (err) {
    console.error('[adminListTeachers]', err);
    return { ok: false, message: String(err) };
  }
}

// 管理画面：講師を新規追加する（Phase 3）。
// teacherId は自動採番（P4）。クライアントから newTeacherId は受け取らない。
// 入力: { teacherId, password, teacherName, role, displayNickname? }
// 出力: { ok, teacherId, initialPassword:'noblesse0311' } または { ok:false, message }
// 初期パスワードは 'noblesse0311' 固定、active=true、firstLoginCompleted=false で投入。
// 講師が初回ログインすると Phase 1.5 のフローでパスワード変更 + displayNickname 設定が強制される。
function adminAddTeacher(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };

    const teacherName     = String((params && params.teacherName) || '').trim();
    const role            = String((params && params.role) || '').trim();
    const displayNickname = String((params && params.displayNickname) || '').trim();

    if (!teacherName) return { ok: false, message: '氏名は必須です' };
    if (role !== 'admin' && role !== 'teacher') {
      return { ok: false, message: '役割は admin / teacher のいずれかを指定してください' };
    }
    if (displayNickname && (displayNickname.length < 1 || displayNickname.length > 10)) {
      return { ok: false, message: '表示名は1〜10文字で入力してください（空欄の場合は初回ログイン時に講師が設定）' };
    }

    const newTeacherId = _findNextTeacherId();

    // 念のため重複チェック（_findNextTeacherId が壊れていた場合のセーフネット）
    if (_findTeacherRowIndex(newTeacherId) >= 0) {
      return { ok: false, message: 'teacherId 採番に失敗しました（既存と衝突）' };
    }

    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh) return { ok: false, message: 'Teachers シートが見つかりません' };

    // ヘッダーから列順を取得し、新規行を組み立てる
    const lastCol = sh.getLastColumn();
    const header  = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const iId   = header.indexOf('teacherId');
    const iName = header.indexOf('teacherName');
    const iPw   = header.indexOf('password');
    const iRole = header.indexOf('role');
    const iNick = header.indexOf('displayNickname');
    const iAct  = header.indexOf('active');
    const iFlc  = header.indexOf('firstLoginCompleted');
    if (iId < 0 || iName < 0 || iPw < 0 || iRole < 0 || iNick < 0 || iAct < 0 || iFlc < 0) {
      return { ok: false, message: 'Teachers シートのヘッダー構造が想定と異なります' };
    }

    const initialPassword = 'noblesse0311';
    const newRow = [];
    for (let i = 0; i < header.length; i++) newRow[i] = '';
    newRow[iId]   = newTeacherId;
    newRow[iName] = teacherName;
    newRow[iPw]   = _passwordHash(initialPassword, newTeacherId);
    newRow[iRole] = role;
    newRow[iNick] = displayNickname; // 空欄可
    newRow[iAct]  = true;
    newRow[iFlc]  = false; // 初回ログイン時に Phase 1.5 フローへ強制誘導

    sh.appendRow(newRow);

    _logTeacherAction(_teacher.teacherId, 'TEACHER_ADD', newTeacherId, 'success', { role: role, name: teacherName });
    return { ok: true, teacherId: newTeacherId, initialPassword: initialPassword };
  } catch (err) {
    console.error('[adminAddTeacher]', err);
    return { ok: false, message: String(err) };
  }
}

// 管理画面：講師のパスワードを再発行する（Phase 3）。
// 入力: { teacherId, password, targetTeacherId }
// 出力: { ok, initialPassword:'noblesse0311' } または { ok:false, message }
// 動作: 該当行の password を 'noblesse0311' のハッシュにリセット + firstLoginCompleted=false に。
// 次回ログイン時に Phase 1.5 の初回フロー（パスワード変更 + 表示名設定）に再誘導される。
// 自分自身（_teacher.teacherId === targetTeacherId）への再発行も許可（自分で再ログインすればよい、P5）。
function adminResetTeacherPassword(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };

    const targetTeacherId = String((params && params.targetTeacherId) || '').trim();
    if (!targetTeacherId) return { ok: false, message: '対象 teacherId を指定してください' };

    const rowIdx = _findTeacherRowIndex(targetTeacherId);
    if (rowIdx < 0) return { ok: false, message: '対象の講師が見つかりません: ' + targetTeacherId };

    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh) return { ok: false, message: 'Teachers シートが見つかりません' };
    const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const iPw  = header.indexOf('password');
    const iFlc = header.indexOf('firstLoginCompleted');
    if (iPw < 0 || iFlc < 0) return { ok: false, message: 'Teachers シートのヘッダー構造が想定と異なります' };

    const initialPassword = 'noblesse0311';
    sh.getRange(rowIdx, iPw  + 1).setValue(_passwordHash(initialPassword, targetTeacherId));
    sh.getRange(rowIdx, iFlc + 1).setValue(false);

    _logTeacherAction(_teacher.teacherId, 'TEACHER_PASSWORD_RESET', targetTeacherId, 'success', {});
    return { ok: true, initialPassword: initialPassword };
  } catch (err) {
    console.error('[adminResetTeacherPassword]', err);
    return { ok: false, message: String(err) };
  }
}

// 管理画面：講師の active を切り替える（Phase 3）。
// 入力: { teacherId, password, targetTeacherId, active:bool }
// 出力: { ok } または { ok:false, message }
// 制約: 「最後の active=true admin」を非アクティブ化する操作は拒否（P1、ロックアウト防止）。
//       具体的には active=false にしようとしている対象が現在 admin かつ
//       _countActiveAdmins(targetTeacherId 除外) === 0 の場合に拒否。
function adminSetTeacherActive(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };

    const targetTeacherId = String((params && params.targetTeacherId) || '').trim();
    const active          = !!(params && params.active);
    if (!targetTeacherId) return { ok: false, message: '対象 teacherId を指定してください' };

    const rowIdx = _findTeacherRowIndex(targetTeacherId);
    if (rowIdx < 0) return { ok: false, message: '対象の講師が見つかりません: ' + targetTeacherId };

    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh) return { ok: false, message: 'Teachers シートが見つかりません' };
    const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const iRole = header.indexOf('role');
    const iAct  = header.indexOf('active');
    if (iRole < 0 || iAct < 0) return { ok: false, message: 'Teachers シートのヘッダー構造が想定と異なります' };

    // 最後の active=true admin 喪失防止チェック（active=false にする時のみ）
    if (active === false) {
      const currentRole = String(sh.getRange(rowIdx, iRole + 1).getValue() || '').trim();
      const currentAct  = _teacherTruthy(sh.getRange(rowIdx, iAct  + 1).getValue());
      if (currentRole === 'admin' && currentAct) {
        // この講師を除外したカウントが 0 なら、ここを false にすると admin が 0 になる
        if (_countActiveAdmins(targetTeacherId) === 0) {
          return { ok: false, message: '最後の管理者の権限/有効状態は変更できません' };
        }
      }
    }

    sh.getRange(rowIdx, iAct + 1).setValue(!!active);

    _logTeacherAction(_teacher.teacherId, 'TEACHER_SET_ACTIVE', targetTeacherId, 'success', { active: !!active });
    return { ok: true };
  } catch (err) {
    console.error('[adminSetTeacherActive]', err);
    return { ok: false, message: String(err) };
  }
}

// 管理画面：講師の role を切り替える（Phase 3）。
// 入力: { teacherId, password, targetTeacherId, role:'admin'|'teacher' }
// 出力: { ok } または { ok:false, message }
// 制約: 「最後の active=true admin」を teacher にする操作は拒否（P1、ロックアウト防止）。
//       具体的には role='teacher' にしようとしている対象が現在 active=true & admin かつ
//       _countActiveAdmins(targetTeacherId 除外) === 0 の場合に拒否。
function adminSetTeacherRole(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };

    const targetTeacherId = String((params && params.targetTeacherId) || '').trim();
    const role            = String((params && params.role) || '').trim();
    if (!targetTeacherId) return { ok: false, message: '対象 teacherId を指定してください' };
    if (role !== 'admin' && role !== 'teacher') {
      return { ok: false, message: '役割は admin / teacher のいずれかを指定してください' };
    }

    const rowIdx = _findTeacherRowIndex(targetTeacherId);
    if (rowIdx < 0) return { ok: false, message: '対象の講師が見つかりません: ' + targetTeacherId };

    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh) return { ok: false, message: 'Teachers シートが見つかりません' };
    const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const iRole = header.indexOf('role');
    const iAct  = header.indexOf('active');
    if (iRole < 0 || iAct < 0) return { ok: false, message: 'Teachers シートのヘッダー構造が想定と異なります' };

    // 最後の active=true admin 喪失防止チェック（teacher にする時のみ）
    if (role === 'teacher') {
      const currentRole = String(sh.getRange(rowIdx, iRole + 1).getValue() || '').trim();
      const currentAct  = _teacherTruthy(sh.getRange(rowIdx, iAct  + 1).getValue());
      if (currentRole === 'admin' && currentAct) {
        if (_countActiveAdmins(targetTeacherId) === 0) {
          return { ok: false, message: '最後の管理者の権限/有効状態は変更できません' };
        }
      }
    }

    sh.getRange(rowIdx, iRole + 1).setValue(role);

    _logTeacherAction(_teacher.teacherId, 'TEACHER_SET_ROLE', targetTeacherId, 'success', { role: role });
    return { ok: true };
  } catch (err) {
    console.error('[adminSetTeacherRole]', err);
    return { ok: false, message: String(err) };
  }
}

// 管理画面：講師の displayNickname を変更する（Phase 3）。
// 入力: { teacherId, password, targetTeacherId, displayNickname }
// 出力: { ok, displayNickname } または { ok:false, message }
// 制約: displayNickname は 1〜10 文字（completeFirstLogin と同じバリデーション）。
function adminUpdateTeacherDisplayNickname(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };

    const targetTeacherId  = String((params && params.targetTeacherId) || '').trim();
    const displayNickname  = String((params && params.displayNickname) || '').trim();
    if (!targetTeacherId) return { ok: false, message: '対象 teacherId を指定してください' };
    if (!displayNickname || displayNickname.length < 1 || displayNickname.length > 10) {
      return { ok: false, message: '表示名は1〜10文字で入力してください' };
    }

    const rowIdx = _findTeacherRowIndex(targetTeacherId);
    if (rowIdx < 0) return { ok: false, message: '対象の講師が見つかりません: ' + targetTeacherId };

    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh) return { ok: false, message: 'Teachers シートが見つかりません' };
    const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const iNick = header.indexOf('displayNickname');
    if (iNick < 0) return { ok: false, message: 'Teachers シートのヘッダー構造が想定と異なります' };

    sh.getRange(rowIdx, iNick + 1).setValue(displayNickname);

    _logTeacherAction(_teacher.teacherId, 'TEACHER_UPDATE_NICKNAME', targetTeacherId, 'success', { displayNickname: displayNickname });
    return { ok: true, displayNickname: displayNickname };
  } catch (err) {
    console.error('[adminUpdateTeacherDisplayNickname]', err);
    return { ok: false, message: String(err) };
  }
}

function adminAddQuote(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    if (!params.date || !params.text)   return { ok: false, message: '日付と本文は必須です' };
    const sh = _ss().getSheetByName(SHEET_QUOTE);
    if (!sh) return { ok: false, message: 'Quoteシートが見つかりません' };
    sh.appendRow([params.date, params.text, params.author || '']);
    _invalidateCache('cache_quote_values');
    return { ok: true };
  } catch(err) {
    console.error('[adminAddQuote]', err);
    return { ok: false, message: String(err) };
  }
}

function adminAddNotice(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    if (!params.date || !params.title || !params.body) return { ok: false, message: '日付・タイトル・本文は必須です' };
    const sh = _ss().getSheetByName(SHEET_NOTICE);
    if (!sh) return { ok: false, message: 'Noticeシートが見つかりません' };
    sh.appendRow([params.date, params.title, params.body]);
    _invalidateCache('cache_notice_values');
    return { ok: true };
  } catch(err) {
    console.error('[adminAddNotice]', err);
    return { ok: false, message: String(err) };
  }
}

// 管理画面：生徒一覧（Students シートの入力順、ID 空欄行はスキップ）
function adminListStudents(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    // Step 2：全アカウント対象（Students + SpecialAccounts）。
    // 管理画面で 1001〜1010 等の特殊枠も一覧に含めるため。
    const values = _getAllAccountsValues();
    if (!values || values.length < 2) return { ok: true, students: [] };
    const students = [];
    for (let i = 1; i < values.length; i++) {
      const sid = String(values[i][COL_ID] || '').trim();
      if (!sid) continue;
      students.push({
        studentId: sid,
        name:      String(values[i][COL_NAME] || '').trim(),
        nickname:  String(values[i][COL_NICKNAME] || '').trim()
      });
    }
    return { ok: true, students: students };
  } catch(err) {
    console.error('[adminListStudents]', err);
    return { ok: false, message: String(err) };
  }
}

// =====================================================
// HP 手動付与（管理画面）
// =====================================================
// Students シート全件を返す。確認画面でのボーナス計算に必要なため
// streak（連続日数）も含む。adminListStudents と異なり streak を含む。
// 認証必須。生徒ID 空欄行はスキップ。
function getStudentsListForGrant(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    // Step 2：全アカウント対象。テスト枠への HP 付与（動作確認等）も可能にする。
    const values = _getAllAccountsValues();
    if (!values || values.length < 2) return { ok: true, students: [] };
    const students = [];
    for (let i = 1; i < values.length; i++) {
      const sid = String(values[i][COL_ID] || '').trim();
      if (!sid) continue;
      students.push({
        studentId: sid,
        name:      String(values[i][COL_NAME]     || '').trim(),
        nickname:  String(values[i][COL_NICKNAME] || '').trim(),
        streak:    Number(values[i][COL_STREAK])   || 0
      });
    }
    return { ok: true, students: students };
  } catch(err) {
    console.error('[getStudentsListForGrant]', err);
    return { ok: false, message: String(err) };
  }
}

// HP 手動付与の実行。管理者認証必須。doPost 経由のみ（誤実行防止）。
// params: {
//   password:    管理者パスワード
//   studentIds:  対象生徒ID配列（必須、1件以上）
//   rawHp:       素点HP（必須、1以上の整数）
//   reason:      付与理由（必須、HPLog の message に保存）
//   applyBonus:  true なら streak から week² 倍率を算出して加算
// }
// 各生徒について：
//   week = Math.ceil(streak / 7)（streak<1 のときは streak=1 扱いで week=1）
//   multiplier = applyBonus ? week*week : 1
//   hpGained = rawHp * multiplier
//   Students の HP 列に hpGained を加算（直接 setValue + cache invalidate）
//   HPLog に 1 行 type='manual_grant' / message=reason で記録
// 二重実行防止なし（管理者判断に任せる仕様）。
function executeManualHpGrant(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };

    const studentIds = (params && Array.isArray(params.studentIds)) ? params.studentIds : [];
    const rawHpRaw   = Number(params && params.rawHp);
    const reason     = String((params && params.reason) || '').trim();
    const applyBonus = !!(params && params.applyBonus);

    if (studentIds.length === 0) return { ok: false, message: '対象生徒が指定されていません' };
    if (!Number.isFinite(rawHpRaw) || rawHpRaw < 1 || Math.floor(rawHpRaw) !== rawHpRaw) {
      return { ok: false, message: '素点HPは1以上の整数を指定してください' };
    }
    if (!reason) return { ok: false, message: '付与理由は必須です' };

    const rawHp = Math.floor(rawHpRaw);

    // 重複・空文字を除去した正規化済みID集合
    const idSet = {};
    const normIds = [];
    studentIds.forEach(function(s){
      const v = String(s || '').trim();
      if (v && !idSet[v]) { idSet[v] = true; normIds.push(v); }
    });
    if (normIds.length === 0) return { ok: false, message: '対象生徒が指定されていません' };

    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    if (!stuSheet) return { ok: false, message: 'Students シートが見つかりません' };
    const spSheet  = ss.getSheetByName(SHEET_SPECIAL_ACCOUNTS); // 無くても可（Step 1 未実行時など）

    // cache 経由禁止：ここは最新値を直接読む（管理画面実行直前の HP を正確に加算するため）
    // Step 2：Students + SpecialAccounts の両シートから sid → 行情報マップを構築。
    //         同 sid が両シートに存在する場合は Students 優先（既存挙動と互換）。
    const stuValues = stuSheet.getDataRange().getValues();
    const spValues  = (spSheet && spSheet.getLastRow() >= 2) ? spSheet.getDataRange().getValues() : [];

    const rowBySid = {};  // sid → { sheet, sheetName, rowIdx (0-based), values }
    for (let i = 1; i < stuValues.length; i++) {
      const sid = String(stuValues[i][COL_ID] || '').trim();
      if (sid) rowBySid[sid] = { sheet: stuSheet, sheetName: SHEET_STUDENTS, rowIdx: i, values: stuValues[i] };
    }
    for (let i = 1; i < spValues.length; i++) {
      const sid = String(spValues[i][COL_ID] || '').trim();
      if (sid && !(sid in rowBySid)) {
        rowBySid[sid] = { sheet: spSheet, sheetName: SHEET_SPECIAL_ACCOUNTS, rowIdx: i, values: spValues[i] };
      }
    }

    const updates = [];
    const notFound = [];
    let touchedSpecial = false;
    normIds.forEach(function(sid) {
      if (!(sid in rowBySid)) { notFound.push(sid); return; }
      const r = rowBySid[sid];
      if (r.sheetName === SHEET_SPECIAL_ACCOUNTS) touchedSpecial = true;
      const name   = String(r.values[COL_NAME]     || '').trim();
      const streak = Math.max(1, Number(r.values[COL_STREAK]) || 1);
      const week   = Math.ceil(streak / 7);
      const mult   = applyBonus ? (week * week) : 1;
      const hpGained = rawHp * mult;
      const curHP    = Number(r.values[COL_HP]) || 0;
      updates.push({
        sid:        sid,
        name:       name,
        sheet:      r.sheet,
        sheetName:  r.sheetName,
        rowIdx:     r.rowIdx,
        streak:     streak,
        week:       week,
        multiplier: mult,
        rawHp:      rawHp,
        hpGained:   hpGained,
        newHP:      curHP + hpGained
      });
    });

    if (updates.length === 0) {
      return { ok: false, message: '指定された生徒が見つかりません: ' + notFound.join(', ') };
    }

    // Students / SpecialAccounts の HP 列を 1 件ずつ書き込み（行 index は事前に各シートで構築済）
    for (let k = 0; k < updates.length; k++) {
      const u = updates[k];
      u.sheet.getRange(u.rowIdx + 1, COL_HP + 1).setValue(u.newHP);
    }

    // HPLog に 1 行ずつ記録（既存の 6 列構造を _ensureHpLogMessageColumn 経由で保証）
    const log = _ensureHpLogMessageColumn();
    const now = _nowJST();
    const rowsToAppend = updates.map(function(u){
      const row = new Array(log.lastCol).fill('');
      if (log.cTimestamp >= 0) row[log.cTimestamp] = now;
      if (log.cSid       >= 0) row[log.cSid]       = u.sid;
      if (log.cRawHP     >= 0) row[log.cRawHP]     = u.rawHp;
      if (log.cHpGained  >= 0) row[log.cHpGained]  = u.hpGained;
      if (log.cType      >= 0) row[log.cType]      = 'manual_grant';
      if (log.cMessage   >= 0) row[log.cMessage]   = reason;
      return row;
    });
    log.sh.getRange(log.sh.getLastRow() + 1, 1, rowsToAppend.length, log.lastCol)
          .setValues(rowsToAppend);

    // cache invalidate（書き込みが行われたシートの cache を破棄。SpecialAccounts も touched なら同様）
    _invalidateCache('cache_students_values');
    if (touchedSpecial) _invalidateCache('cache_special_accounts_values');
    _invalidateCache('cache_ranking_last_week');

    // Phase 4 操作ログ：複数生徒を 1 行に集約（targetTeacherId は空、details に明細）。
    // ここまで来た時点で全副作用（HP 加算 + HPLog 追記 + cache invalidate）が確定済み。
    _logTeacherAction(_teacher.teacherId, 'MANUAL_HP_GRANT', '', 'success', {
      studentIds:    normIds,
      rawHp:         rawHp,
      applyBonus:    applyBonus,
      reason:        reason,
      count:         updates.length,
      notFoundCount: notFound.length,
      totalHp:       updates.reduce(function(s,u){return s + u.hpGained;}, 0)
    });

    let totalHp = 0;
    const results = updates.map(function(u){
      totalHp += u.hpGained;
      return {
        studentId:  u.sid,
        name:       u.name,
        streak:     u.streak,
        week:       u.week,
        multiplier: u.multiplier,
        rawHp:      u.rawHp,
        hpGained:   u.hpGained
      };
    });

    return {
      ok: true,
      results:  results,
      totalHp:  totalHp,
      notFound: notFound,
      reason:   reason,
      applyBonus: applyBonus
    };
  } catch(err) {
    console.error('[executeManualHpGrant]', err);
    return { ok: false, message: String(err) };
  }
}

// =====================================================
// 先生からのメッセージ
// =====================================================
// 設計概要（CLAUDE.md 該当セクション参照）：
//   - 先生 → 生徒 への一方向メッセージ。生徒からの返信は LINE に一本化（このアプリでは不可）。
//   - Teachers シートは「将来の講師ログイン」用に枠だけ作るが、今回の機能では送信者
//     ニックネーム（例：「ふく先生」）の表示にのみ使用。送信時に最新の表示用ニックネームを
//     スナップショットして TeacherMessages.senderNickname に保存し、後から Teachers の表記
//     を変更しても過去メッセージはそのまま残る運用とする。
//   - 既読は MessageReads シート（studentId × messageId）の追加で表現。冪等：既存ならスキップ。
//   - targetType は 'individual' / 'all' のみ受理。'group' は将来用にデータ層では許容するが
//     書き込み API では弾く（フロント側もボタンで弾く運用）。
//
// シート構造：
//   Teachers          : teacherId / teacherName / password / role / displayNickname / active
//   TeacherMessages   : timestamp / messageId / senderId / senderNickname / targetType / targetIds / content / createdAt
//   MessageReads      : studentId / messageId / readAt
// ⚠️ Phase 1（講師ログイン機能）で G 列 firstLoginCompleted を追加。
// 既存シートが 6 列（〜active）の場合は ensureTeachersSheet() で末尾追記マイグレーションを行う。
const TEACHERS_HEADERS         = ['teacherId','teacherName','password','role','displayNickname','active','firstLoginCompleted'];
const TEACHER_MESSAGES_HEADERS = ['timestamp','messageId','senderId','senderNickname','targetType','targetIds','content','createdAt'];
const MESSAGE_READS_HEADERS    = ['studentId','messageId','readAt'];
const TEACHER_MESSAGE_MAX_LEN  = 500;
const TEACHER_INITIAL_PASSWORD = 'TEMP_PASSWORD_CHANGE_ME';
const TEACHER_PRIMARY_ID       = 't101'; // ふくちさんの teacherId（admin role）

// Phase 4：操作ログ（TeacherActions）の列構成
//   timestamp       : 'yyyy-MM-dd HH:mm:ss'（_nowJST 由来）
//   actorTeacherId  : 操作を実行した講師の teacherId
//   action          : 'TEACHER_ADD' / 'TEACHER_PASSWORD_RESET' / 'TEACHER_SET_ACTIVE' /
//                     'TEACHER_SET_ROLE' / 'TEACHER_UPDATE_NICKNAME' / 'MANUAL_HP_GRANT'
//   targetTeacherId : 操作対象の teacherId（MANUAL_HP_GRANT の場合は空、複数生徒は details に集約）
//   result          : 'success' / 'failure'（v1 では常に 'success'。失敗ログは Phase 4.5 以降で別シート対応）
//   details         : JSON 文字列（action ごとに異なる構造、可読化はフロント側で行う）
const TEACHER_ACTIONS_HEADERS  = ['timestamp','actorTeacherId','action','targetTeacherId','result','details'];

// Phase 4：講師の操作ログを記録するヘルパー
// - シート未存在なら _ensureSheetWithHeaders で自動作成（手動セットアップ不要）
// - 内部 catch でラップし、ログ書き込みの失敗が呼び出し元の正常処理を壊さないようにする
//   （監査ログ書き込み失敗 ≠ 業務処理失敗。ログ用シートが消えても業務は継続させる方針）
// - 戻り値なし（log は副作用のみ）
// - キャッシュなし（ログは常に最新を読む方針、件数増加対策は Phase 5 以降で末尾 N 行読みヘルパー導入を検討）
function _logTeacherAction(actorTeacherId, action, targetTeacherId, result, details) {
  try {
    const sh = _ensureSheetWithHeaders(SHEET_TEACHER_ACTIONS, TEACHER_ACTIONS_HEADERS).sh;
    const detailsStr = (details && typeof details === 'object')
      ? JSON.stringify(details)
      : (details ? String(details) : '{}');
    sh.appendRow([
      _nowJST(),
      String(actorTeacherId || ''),
      String(action || ''),
      String(targetTeacherId || ''),
      String(result || 'success'),
      detailsStr
    ]);
  } catch (err) {
    console.error('[_logTeacherAction]', err, { actor: actorTeacherId, action: action });
    // ログ失敗はサイレント。呼び出し元の処理は継続させる
  }
}

// 管理画面：操作ログ一覧を取得（Phase 4、admin-only）
// 入力: { teacherId, password, dateFrom?:'yyyy-MM-dd', dateTo?:'yyyy-MM-dd',
//         actionFilter?:string, page?:number, pageSize?:number }
//   - dateFrom/dateTo を省略すると直近 7 日（dateTo=今日, dateFrom=6 日前）
//   - actionFilter 省略 or 'ALL' で全件
//   - page は 1 始まり、pageSize default 50（最大 200 でガード）
// 出力: { ok, items:[...], total, page, pageSize, hasNewer, hasOlder,
//         dateFrom, dateTo, actionFilter, actions:[期間内に存在する action 種別の集合] }
function getTeacherActionsList(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };

    const sh = _ss().getSheetByName(SHEET_TEACHER_ACTIONS);
    if (!sh || sh.getLastRow() < 2) {
      return { ok: true, items: [], total: 0, page: 1, pageSize: 50,
               hasNewer: false, hasOlder: false, actions: [] };
    }
    // dateFrom/dateTo の正規化（'yyyy-MM-dd' 期待、文字列比較で範囲判定）
    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const dateTo   = String((params && params.dateTo)   || today);
    const dateFrom = String((params && params.dateFrom) || (function(){
      const d = new Date(); d.setDate(d.getDate() - 6);
      return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
    })());
    const actionFilter = String((params && params.actionFilter) || 'ALL');
    const page     = Math.max(1, Number(params && params.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(params && params.pageSize) || 50));

    const values = sh.getDataRange().getValues();
    const allActions = {};
    const filtered = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[0]) continue;
      // Google Sheets が _nowJST() の文字列を datetime 型に自動変換することがあり、
      // getValues() で Date オブジェクトとして返る場合がある。Date でも文字列でも両対応。
      // adminListSangoSubmissions / adminListWabun1Submissions と同じ正規化パターン。
      const ts = (r[0] instanceof Date)
        ? Utilities.formatDate(r[0], 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
        : String(r[0]);
      const datePart = ts.substring(0, 10); // 'yyyy-MM-dd'
      if (datePart < dateFrom || datePart > dateTo) continue;
      const act = String(r[2] || '');
      allActions[act] = true;
      if (actionFilter !== 'ALL' && act !== actionFilter) continue;
      filtered.push({
        timestamp:       ts,
        actorTeacherId:  String(r[1] || ''),
        action:          act,
        targetTeacherId: String(r[3] || ''),
        result:          String(r[4] || ''),
        details:         String(r[5] || '')
      });
    }
    // 新しい順
    filtered.sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const end   = Math.min(start + pageSize, total);
    const items = filtered.slice(start, end);

    return {
      ok: true,
      items: items,
      total: total,
      page: page,
      pageSize: pageSize,
      hasNewer: page > 1,
      hasOlder: end < total,
      dateFrom: dateFrom,
      dateTo: dateTo,
      actionFilter: actionFilter,
      actions: Object.keys(allActions).sort()
    };
  } catch (err) {
    console.error('[getTeacherActionsList]', err);
    return { ok: false, message: String(err) };
  }
}

// GAS エディタから手動実行するセットアップ関数。冪等。
// 役割：
//   - シートが無ければ作成
//   - G 列 firstLoginCompleted が無ければ追加（既存 6 列構造への後方互換マイグレーション）
//   - t101（ふくちさん、admin）行が無ければ追加。既にあれば既存値を保護しつつ
//     firstLoginCompleted を TRUE にセット（既ログイン中ユーザーのため）
//   - t102〜t110 の既存行は B〜F 列を絶対に書き換えない。G 列 firstLoginCompleted のみ
//     未設定（空欄）なら FALSE で初期化する（Phase 1 投入後の整合性確保）
//
// 戻り値: { ok, sheetCreated, columnAdded, t101RowAdded, t101FirstLoginSet, otherFirstLoginInitialized, note }
function ensureTeachersSheet() {
  try {
    const r = _ensureSheetWithHeaders(SHEET_TEACHERS, TEACHERS_HEADERS);
    const sh = r.sh;

    // ヘッダー行を確認。G 列 firstLoginCompleted が無ければ追加マイグレーションを行う。
    // _ensureSheetWithHeaders はシート新規作成時のみ TEACHERS_HEADERS を書き込むため、
    // 既存シート（6 列構造）の場合はここで明示的に G 列を追加する。
    let columnAdded = false;
    const lastCol = sh.getLastColumn();
    let header = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    let iFlc = header.indexOf('firstLoginCompleted');
    if (iFlc < 0) {
      // 末尾に firstLoginCompleted 列を追加
      const newCol = lastCol + 1;
      sh.getRange(1, newCol).setValue('firstLoginCompleted');
      columnAdded = true;
      // ヘッダー再読込（インデックス更新）
      header = sh.getRange(1, 1, 1, newCol).getValues()[0];
      iFlc = header.indexOf('firstLoginCompleted');
    }

    const iId   = header.indexOf('teacherId');
    const iName = header.indexOf('teacherName');
    const iPw   = header.indexOf('password');
    const iRole = header.indexOf('role');
    const iNick = header.indexOf('displayNickname');
    const iAct  = header.indexOf('active');

    let t101RowAdded = false;
    let t101FirstLoginSet = false;
    let otherFirstLoginInitialized = 0;

    const lastRow = sh.getLastRow();
    let t101RowIdx = -1; // 1-indexed の行番号
    if (lastRow >= 2) {
      const idCol = sh.getRange(2, iId + 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < idCol.length; i++) {
        const sid = String(idCol[i][0] || '').trim();
        if (sid === TEACHER_PRIMARY_ID) { t101RowIdx = i + 2; break; }
      }
    }

    if (t101RowIdx < 0) {
      // t101 行を新規追加（admin / firstLoginCompleted=TRUE）
      // パスワードは仮値（migrateTeachersPasswordHash 実行時にハッシュ化される）
      // 列数分を埋める（追加後のヘッダーに従う）
      const newRow = [];
      newRow[iId]   = TEACHER_PRIMARY_ID;
      newRow[iName] = '福地';
      newRow[iPw]   = TEACHER_INITIAL_PASSWORD;
      newRow[iRole] = 'admin';
      newRow[iNick] = 'ふく先生';
      newRow[iAct]  = true;
      newRow[iFlc]  = true;
      // ヘッダー長まで埋める（不足セルは ''）
      for (let i = 0; i < header.length; i++) if (newRow[i] === undefined) newRow[i] = '';
      sh.appendRow(newRow);
      t101RowAdded = true;
      t101FirstLoginSet = true;
    } else {
      // t101 行は既存。G 列 firstLoginCompleted が空 or false なら TRUE にセット。
      // ⚠️ B〜F 列（teacherName / password / role / displayNickname / active）は絶対に書き換えない。
      const cur = sh.getRange(t101RowIdx, iFlc + 1).getValue();
      if (!_teacherTruthy(cur)) {
        sh.getRange(t101RowIdx, iFlc + 1).setValue(true);
        t101FirstLoginSet = true;
      }
    }

    // t102〜t110 等の既存行：teacherId が入っていて firstLoginCompleted 列が完全に空の場合のみ FALSE を投入。
    // ⚠️ 既に TRUE / FALSE が明示的に入っている場合は絶対に書き換えない。
    // ⚠️ B〜F 列も絶対に書き換えない（読むだけ）。
    const lastRowAfter = sh.getLastRow();
    if (lastRowAfter >= 2) {
      const range = sh.getRange(2, 1, lastRowAfter - 1, header.length).getValues();
      for (let i = 0; i < range.length; i++) {
        const sid = String(range[i][iId] || '').trim();
        if (!sid) continue;                            // teacherId 空欄（バッファ枠）はスキップ
        if (sid === TEACHER_PRIMARY_ID) continue;      // t101 は上で処理済
        const flcCell = range[i][iFlc];
        const isEmpty = (flcCell === '' || flcCell === null || flcCell === undefined);
        if (isEmpty) {
          sh.getRange(i + 2, iFlc + 1).setValue(false);
          otherFirstLoginInitialized++;
        }
      }
    }

    return {
      ok: true,
      sheetCreated:               r.created,
      columnAdded:                columnAdded,
      t101RowAdded:               t101RowAdded,
      t101FirstLoginSet:          t101FirstLoginSet,
      otherFirstLoginInitialized: otherFirstLoginInitialized,
      note: t101RowAdded
        ? '⚠️ t101 のパスワードを Teachers シート上で安全な値に書き換えてください（または migrateTeachersPasswordHash を実行）'
        : (columnAdded ? 'G 列 firstLoginCompleted を追加しました' : '既に最新スキーマです')
    };
  } catch (err) {
    console.error('[ensureTeachersSheet]', err);
    return { ok: false, message: String(err) };
  }
}

// GAS エディタから 1 回だけ実行するセットアップ関数。冪等：既存ならスキップ。
// TeacherMessages / MessageReads の 2 シートをまとめて初期化。
// 戻り値: { ok, created: { messages, reads } }
function ensureTeacherMessagesSheets() {
  try {
    const m = _ensureSheetWithHeaders(SHEET_TEACHER_MESSAGES, TEACHER_MESSAGES_HEADERS);
    const r = _ensureSheetWithHeaders(SHEET_MESSAGE_READS,    MESSAGE_READS_HEADERS);
    return { ok: true, created: { messages: m.created, reads: r.created } };
  } catch (err) {
    console.error('[ensureTeacherMessagesSheets]', err);
    return { ok: false, message: String(err) };
  }
}

// Teachers シートから指定講師ID の表示用ニックネームを取得。見つからなければ '先生'。
function _lookupTeacherDisplayNickname(senderId) {
  try {
    const sh = _ss().getSheetByName(SHEET_TEACHERS);
    if (!sh || sh.getLastRow() < 2) return '先生';
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iId   = header.indexOf('teacherId');
    const iNick = header.indexOf('displayNickname');
    if (iId < 0 || iNick < 0) return '先生';
    const target = String(senderId || '').trim();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][iId] || '').trim() === target) {
        return String(values[i][iNick] || '').trim() || '先生';
      }
    }
    return '先生';
  } catch (e) {
    return '先生';
  }
}

// targetIds 文字列から個別生徒ID配列を生成（個別送信時のみ）。カンマ区切り想定。
function _parseIndividualTargetIds(targetIdsStr) {
  if (!targetIdsStr) return [];
  return String(targetIdsStr).split(',')
    .map(function(s){ return s.trim(); })
    .filter(function(s){ return !!s; });
}

// 管理画面：メッセージ送信。認証必須・doPost 経由のみ。
// params: { teacherId, password, targetType, targetIds, content }
//   teacherId/password: _verifyTeacher で認証。送信者の表示名は Teachers シートの
//                       displayNickname を送信時点でスナップショット保存。
//                       ⚠️ params.senderId は受け付けない（なりすまし防止 / Phase 1）。
//                          認証された teacherId を強制的に senderId として使用する。
//   targetType: 'individual' | 'all' （'group' は明示的にエラー）
//                'all' は admin（塾長）のみ可能（Phase 2 で _requireAdmin ガード）。
//                'individual' は admin / teacher 両方可能。
//   targetIds:  individual 時は studentId 配列 or カンマ区切り文字列。all 時は無視。
//   content:    メッセージ本文（TEACHER_MESSAGE_MAX_LEN = 500 文字まで）。
// 戻り値: { ok, messageId, senderNickname, recipientCount, targetType }
//         または { ok:false, message }
// シート自動初期化：冒頭で ensureTeacherMessagesSheets() を呼ぶため事前セットアップ不要（Phase 5）。
// 操作ログ：成功時に _logTeacherAction で MESSAGE_SEND を記録（Phase 5、本文全文を含む）。
function sendTeacherMessage(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };

    // Phase 5：TeacherMessages / MessageReads の自動初期化（冪等）。
    // Phase 4 の _ensureSheetWithHeaders 思想と統一して、手動セットアップ工程を不要にする。
    // 初期化失敗はログのみ。後段の getSheetByName で検出して安全弁が働く。
    try {
      ensureTeacherMessagesSheets();
    } catch (e) {
      console.error('[sendTeacherMessage] ensureTeacherMessagesSheets failed:', e);
    }

    // ⚠️ なりすまし防止：params.senderId は受け付けず、認証された teacherId を強制使用する。
    //    クライアントから渡された senderId は完全に無視する。
    const senderId   = _teacher.teacherId;
    const targetType = String((params && params.targetType) || '').trim();
    const content    = String((params && params.content) || '').trim();

    if (targetType === 'group') {
      return { ok: false, message: 'グループ送信は準備中です' };
    }
    if (targetType !== 'individual' && targetType !== 'all') {
      return { ok: false, message: '送信先タイプが不正です' };
    }
    // Phase 2：全員送信は admin（塾長）のみ可能。teacher は個別送信のみ。
    if (targetType === 'all' && !_requireAdmin(_teacher)) {
      return { ok: false, message: 'この操作は管理者のみ可能です' };
    }
    if (!content) return { ok: false, message: 'メッセージ本文を入力してください' };
    if (content.length > TEACHER_MESSAGE_MAX_LEN) {
      return { ok: false, message: 'メッセージは ' + TEACHER_MESSAGE_MAX_LEN + ' 文字以内で入力してください' };
    }

    let targetIdsCsv = '';
    let recipientCount = 0;
    if (targetType === 'individual') {
      // params.targetIds は配列 or カンマ区切り文字列のどちらでも受け付ける
      let arr = [];
      if (Array.isArray(params.targetIds)) arr = params.targetIds.slice();
      else if (params.targetIds) arr = _parseIndividualTargetIds(params.targetIds);
      // 重複除去 + 空除去
      const seen = {};
      const uniq = [];
      arr.forEach(function(s){
        const v = String(s || '').trim();
        if (v && !seen[v]) { seen[v] = true; uniq.push(v); }
      });
      if (uniq.length === 0) return { ok: false, message: '宛先生徒を 1 人以上選択してください' };
      targetIdsCsv = uniq.join(',');
      recipientCount = uniq.length;
    } else {
      // 'all'
      targetIdsCsv = 'ALL';
      // 件数表示用に全アカウント（Students + SpecialAccounts）の ID 数を集計
      // Step 2：テスト枠もメッセージを受け取るため対象に含む（_readMessagesForStudent 側で
      //   targetType='all' は全 sid 一致なので、テスト枠でも届く＝集計対象に含めるのが整合）
      try {
        const stuValues = _getAllAccountsValues();
        if (stuValues && stuValues.length >= 2) {
          let n = 0;
          for (let i = 1; i < stuValues.length; i++) {
            if (String(stuValues[i][COL_ID] || '').trim()) n++;
          }
          recipientCount = n;
        }
      } catch (e) { recipientCount = 0; }
    }

    // 表示用ニックネームを送信時点でスナップショット
    const senderNickname = _lookupTeacherDisplayNickname(senderId);

    // messageId を生成（GAS の Utilities.getUuid()）
    const messageId = 'M_' + Utilities.getUuid();
    const now = _nowJST();

    const sh = _ss().getSheetByName(SHEET_TEACHER_MESSAGES);
    if (!sh) return { ok: false, message: 'TeacherMessages シートが見つかりません' };
    sh.appendRow([now, messageId, senderId, senderNickname, targetType, targetIdsCsv, content, now]);

    // Phase 5：操作ログ記録（教育者の振り返り用、本文全文を含む）。
    //   ふくちさん判断：「思い出す必要がある時は正確に思い出さなくてはいけない。
    //   『たしかこうだったはず』はコミュニケーションのズレの原因になる」
    //   → details に content 全文 + targetType='individual' なら studentIds 配列も含める。
    //   targetType='all' の場合は studentIds は省略（'ALL' は受信者数で表現）。
    const _logDetails = {
      targetType:     targetType,
      recipientCount: recipientCount,
      contentLength:  content.length,
      content:        content,
      messageId:      messageId
    };
    if (targetType === 'individual') {
      _logDetails.studentIds = _parseIndividualTargetIds(targetIdsCsv);
    }
    _logTeacherAction(_teacher.teacherId, 'MESSAGE_SEND', '', 'success', _logDetails);

    return {
      ok: true,
      messageId:      messageId,
      senderNickname: senderNickname,
      recipientCount: recipientCount,
      targetType:     targetType
    };
  } catch (err) {
    console.error('[sendTeacherMessage]', err);
    return { ok: false, message: String(err) };
  }
}

// 内部ヘルパー：指定生徒の既読 messageId Set を返す
function _readMessageIdsForStudent(studentId) {
  const set = {};
  const sh = _ss().getSheetByName(SHEET_MESSAGE_READS);
  if (!sh || sh.getLastRow() < 2) return set;
  const values = sh.getDataRange().getValues();
  const header = values[0];
  const iSid = header.indexOf('studentId');
  const iMid = header.indexOf('messageId');
  if (iSid < 0 || iMid < 0) return set;
  const target = String(studentId || '').trim();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][iSid] || '').trim() !== target) continue;
    const mid = String(values[i][iMid] || '').trim();
    if (mid) set[mid] = true;
  }
  return set;
}

// 内部ヘルパー：指定生徒宛のメッセージ行を抽出（targetType=all + individual 該当のみ）。
// timestamp 降順で返す。各 row はオブジェクト。
function _readMessagesForStudent(studentId) {
  const out = [];
  const sh = _ss().getSheetByName(SHEET_TEACHER_MESSAGES);
  if (!sh || sh.getLastRow() < 2) return out;
  const values = sh.getDataRange().getValues();
  const header = values[0];
  const iTs   = header.indexOf('timestamp');
  const iMid  = header.indexOf('messageId');
  const iSid  = header.indexOf('senderId');
  const iNick = header.indexOf('senderNickname');
  const iType = header.indexOf('targetType');
  const iTids = header.indexOf('targetIds');
  const iCont = header.indexOf('content');
  const iCre  = header.indexOf('createdAt');
  if (iMid < 0) return out;

  const target = String(studentId || '').trim();
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const mid = String(r[iMid] || '').trim();
    if (!mid) continue;
    const tType = String(r[iType] || '').trim();
    const tIds  = String(r[iTids] || '').trim();
    let matched = false;
    if (tType === 'all') {
      matched = true;
    } else if (tType === 'individual') {
      if (tIds) {
        const arr = _parseIndividualTargetIds(tIds);
        for (let k = 0; k < arr.length; k++) {
          if (arr[k] === target) { matched = true; break; }
        }
      }
    }
    // 'group' その他は今回の生徒画面では表示しない（将来用）
    if (!matched) continue;
    out.push({
      timestamp:      r[iTs]  ? Utilities.formatDate(new Date(r[iTs]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss') : '',
      messageId:      mid,
      senderId:       String(r[iSid] || '').trim(),
      senderNickname: String(r[iNick] || '').trim() || '先生',
      targetType:     tType,
      content:        String(r[iCont] || ''),
      createdAt:      r[iCre] ? Utilities.formatDate(new Date(r[iCre]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss') : ''
    });
  }
  // timestamp 降順
  out.sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });
  return out;
}

// 生徒画面：自分宛メッセージ一覧（既読フラグ付き、新しい順）
// params: { studentId }
function getMessagesForStudent(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    const messages = _readMessagesForStudent(sid);
    if (messages.length === 0) return { ok: true, messages: [] };
    const readSet = _readMessageIdsForStudent(sid);
    messages.forEach(function(m){ m.isRead = !!readSet[m.messageId]; });
    return { ok: true, messages: messages };
  } catch (err) {
    console.error('[getMessagesForStudent]', err);
    return { ok: false, message: String(err) };
  }
}

// 生徒画面：未読件数のみ取得（ホーム画面の赤バッジ用、軽量）
// params: { studentId }
function getUnreadMessageCount(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    const messages = _readMessagesForStudent(sid);
    if (messages.length === 0) return { ok: true, count: 0 };
    const readSet = _readMessageIdsForStudent(sid);
    let count = 0;
    for (let i = 0; i < messages.length; i++) {
      if (!readSet[messages[i].messageId]) count++;
    }
    return { ok: true, count: count };
  } catch (err) {
    console.error('[getUnreadMessageCount]', err);
    return { ok: false, message: String(err) };
  }
}

// 生徒画面：メッセージを既読化（冪等：既存ならスキップ）。doPost 経由のみ。
// params: { studentId, messageId }
function markMessageAsRead(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    const mid = String((params && params.messageId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    if (!mid) return { ok: false, message: 'messageId が指定されていません' };

    const sh = _ss().getSheetByName(SHEET_MESSAGE_READS);
    if (!sh) return { ok: false, message: 'MessageReads シートが見つかりません。先に ensureTeacherMessagesSheets() を実行してください' };

    // 冪等チェック（既に読まれているか）
    if (sh.getLastRow() >= 2) {
      const values = sh.getDataRange().getValues();
      const header = values[0];
      const iSid = header.indexOf('studentId');
      const iMid = header.indexOf('messageId');
      if (iSid >= 0 && iMid >= 0) {
        for (let i = 1; i < values.length; i++) {
          if (String(values[i][iSid] || '').trim() === sid &&
              String(values[i][iMid] || '').trim() === mid) {
            return { ok: true, alreadyRead: true };
          }
        }
      }
    }
    sh.appendRow([sid, mid, _nowJST()]);
    return { ok: true, alreadyRead: false };
  } catch (err) {
    console.error('[markMessageAsRead]', err);
    return { ok: false, message: String(err) };
  }
}

// =====================================================
// カレンダー（管理画面：日付起点で生徒の活動を見る）
// =====================================================
// HPLog の type 文字列をコンテンツ名（日本語）に変換。
// login は「活動」とみなさず除外する想定（呼び出し側で skip してから使う）。
function _calendarContentName(type) {
  if (!type) return 'その他';
  const t = String(type).trim();
  if (t === 'test')   return '英単語RUSH';
  // 将来 eitan / eitango 表記に切り替わった場合の互換も用意（現行 saveAttempt は 'test'）
  if (t === 'eitan' || t === 'eitango') return '英単語RUSH';
  if (t === 'sango')  return '三語短文';
  if (t === 'wabun1') return '和文英訳①';
  if (t === 'lison')  return '英語リスオン';
  if (t === 'manual_grant') return '手動付与';
  if (t.indexOf('kiso_')  === 0) return '基礎計算';
  if (t.indexOf('kanji_') === 0) return 'カンジー';
  if (t.indexOf('kobun_') === 0) return 'コブタン';
  if (t.indexOf('apology_') === 0) return 'お詫びHP';
  return 'その他（' + t + '）';
}

// 「activity」とみなす type フィルタ（login は除外）
function _calendarIsActivity(type) {
  return !!type && String(type).trim() !== 'login';
}

// 指定月の各日付の活動生徒数を返す。
// params: { yearMonth: 'YYYY-MM' }
// 戻り値: { ok, yearMonth, days: [{ date: 'YYYY-MM-DD', studentCount }] }
// キャッシュ: cache_calendar_<yearMonth>（15分 TTL）
function getCalendarMonthSummary(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const ym = String((params && params.yearMonth) || '').trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) return { ok: false, message: 'yearMonth は YYYY-MM 形式で指定してください' };

    const cacheKey = 'cache_calendar_' + ym;
    const result = _getCachedValues(cacheKey, 900, function() {
      const ss = _ss();
      const sh = ss.getSheetByName(SHEET_HPLOG);
      const days = {};
      // 月初〜月末の枠を空 set で初期化
      const year  = parseInt(ym.slice(0, 4), 10);
      const month = parseInt(ym.slice(5, 7), 10); // 1〜12
      const lastDay = new Date(year, month, 0).getDate(); // 翌月 0 日 = 当月末日
      for (let d = 1; d <= lastDay; d++) {
        const ds = ym + '-' + (d < 10 ? '0' + d : String(d));
        days[ds] = {};  // sid set として使用
      }
      if (sh && sh.getLastRow() >= 2) {
        const rows = sh.getDataRange().getValues();
        // [0]ts [1]sid [2]rawHP [3]hpGained [4]type [5]message
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const ds = _toDateStr(r[0]);
          if (!ds || !days[ds]) continue;
          const sid = String(r[1] || '').trim();
          if (!sid) continue;
          const type = String(r[4] || '').trim();
          if (!_calendarIsActivity(type)) continue;
          days[ds][sid] = true;
        }
      }
      const list = [];
      Object.keys(days).sort().forEach(function(ds){
        list.push({ date: ds, studentCount: Object.keys(days[ds]).length });
      });
      return { yearMonth: ym, days: list };
    });
    return { ok: true, yearMonth: result.yearMonth, days: result.days };
  } catch(err) {
    console.error('[getCalendarMonthSummary]', err);
    return { ok: false, message: String(err) };
  }
}

// 指定日の活動生徒一覧と生徒別 HP 内訳を返す（リアルタイム反映、キャッシュなし）。
// params: { date: 'YYYY-MM-DD' }
// 戻り値: { ok, date, students: [{ studentId, name, nickname, totalHp,
//                                  breakdown: [{ content, hp }] }] }
function getCalendarDayDetail(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const date = String((params && params.date) || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: 'date は YYYY-MM-DD 形式で指定してください' };

    const ss = _ss();
    const sh = ss.getSheetByName(SHEET_HPLOG);

    // sid → 氏名・ニックネーム
    // Step 2：全アカウント対象（Students + SpecialAccounts）。テスト枠も名前表示できるようにする。
    const stuValues = _getAllAccountsValues();
    const stuMap = {};
    if (stuValues && stuValues.length >= 2) {
      for (let i = 1; i < stuValues.length; i++) {
        const sid = String(stuValues[i][COL_ID] || '').trim();
        if (!sid) continue;
        stuMap[sid] = {
          name:     String(stuValues[i][COL_NAME]     || '').trim(),
          nickname: String(stuValues[i][COL_NICKNAME] || '').trim()
        };
      }
    }

    // sid → { totalHp, byContent: { [contentName]: hp } }
    const acc = {};
    if (sh && sh.getLastRow() >= 2) {
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const ds = _toDateStr(r[0]);
        if (ds !== date) continue;
        const sid = String(r[1] || '').trim();
        if (!sid) continue;
        const type = String(r[4] || '').trim();
        if (!_calendarIsActivity(type)) continue;
        const hp = Number(r[3]) || 0;
        const cname = _calendarContentName(type);
        if (!acc[sid]) acc[sid] = { totalHp: 0, byContent: {} };
        acc[sid].totalHp += hp;
        acc[sid].byContent[cname] = (acc[sid].byContent[cname] || 0) + hp;
      }
    }

    const students = Object.keys(acc).sort().map(function(sid){
      const a = acc[sid];
      const info = stuMap[sid] || { name: '', nickname: '' };
      // 練習モード（_practice 接尾の rawHP=0 行など、HP 0 のレコード）は内訳表示から除外。
      // 「活動した」判定（acc[sid] の有無）には残すため、生徒一覧からは消えない。
      const breakdown = Object.keys(a.byContent).sort()
        .filter(function(c){ return Number(a.byContent[c]) > 0; })
        .map(function(c){
          return { content: c, hp: a.byContent[c] };
        });
      return {
        studentId: sid,
        name:      info.name,
        nickname:  info.nickname,
        totalHp:   a.totalHp,
        breakdown: breakdown
      };
    });
    // 表示順：ID 昇順（呼び出し側で再ソートしやすい安定順）
    return { ok: true, date: date, students: students };
  } catch(err) {
    console.error('[getCalendarDayDetail]', err);
    return { ok: false, message: String(err) };
  }
}

// =====================================================
// 連絡事項（Notice）共通ヘルパー
// =====================================================

// Notice シート全体をキャッシュ経由で取得（6h TTL、adminAddNotice でクリア）
function _getNoticeValues() {
  return _getCachedValues('cache_notice_values', 21600, function() {
    var sh = _ss().getSheetByName(SHEET_NOTICE);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getDataRange().getValues();
  });
}

function _readNoticeRows() {
  var values = _getNoticeValues();
  if (!values || values.length < 2) return { rows: [], iDate: -1, iTitle: -1, iBody: -1 };
  var header = values[0];
  var iDate  = header.indexOf('date');
  var iTitle = header.indexOf('title');
  var iBody  = header.indexOf('body');
  var rows = values.slice(1)
    .map(function(r, idx){ return { r: r, idx: idx }; })
    .filter(function(o){ return o.r[iDate] || o.r[iTitle] || o.r[iBody]; });
  return { rows: rows, iDate: iDate, iTitle: iTitle, iBody: iBody };
}

function _sortNoticeRows(rows, iDate) {
  return rows.sort(function(a, b){
    var da = new Date(a.r[iDate]).getTime() || 0;
    var db = new Date(b.r[iDate]).getTime() || 0;
    if (db !== da) return db - da;
    return b.idx - a.idx; // 同日なら後に追加された行（idx 大）を先に
  });
}

function _mapNotice(o, iDate, iTitle, iBody) {
  return {
    date:  o.r[iDate] ? Utilities.formatDate(new Date(o.r[iDate]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
    title: o.r[iTitle] || '',
    body:  o.r[iBody]  || ''
  };
}

// =====================================================
// ダッシュボード用：最新 3 件
// =====================================================

function getNotice() {
  try {
    var d = _readNoticeRows();
    if (d.rows.length === 0) return { ok: true, notices: [] };
    var sorted = _sortNoticeRows(d.rows, d.iDate).slice(0, 3);
    var notices = sorted.map(function(o){ return _mapNotice(o, d.iDate, d.iTitle, d.iBody); });
    return { ok: true, notices: notices };
  } catch(err) {
    console.error('[getNotice]', err);
    return { ok: false, message: String(err) };
  }
}

// =====================================================
// 「過去の連絡事項を見る」用：全件
// =====================================================

function getNoticeHistory() {
  try {
    var d = _readNoticeRows();
    if (d.rows.length === 0) return { ok: true, notices: [] };
    var sorted = _sortNoticeRows(d.rows, d.iDate);
    var notices = sorted.map(function(o){ return _mapNotice(o, d.iDate, d.iTitle, d.iBody); });
    return { ok: true, notices: notices };
  } catch(err) {
    console.error('[getNoticeHistory]', err);
    return { ok: false, message: String(err) };
  }
}

// =====================================================
// 保護者閲覧モード
// =====================================================

function getStudentView(params) {
  try {
    const sid = String(params.studentId || '').trim();
    if (!sid) return { ok: false, message: '生徒IDを入力してください' };

    // Step 2：全アカウント対象。テスト枠でも保護者画面の動作確認ができるよう
    //   _findAccountRowOnSheet（Students 優先、フォールバック SpecialAccounts）を使う。
    const stuLoc = _findAccountRowOnSheet(sid);
    if (!stuLoc) return { ok: false, message: '生徒IDが見つかりません' };
    const row = stuLoc.rowValues;
    const nickname = (String(row[COL_NICKNAME] || '').trim()) || '名無し';
    const totalHP  = Number(row[COL_HP])     || 0;
    const streak   = Number(row[COL_STREAK]) || 0;
    const stage    = _calcStage(streak, 0, 0);
    const title    = _getTitle(streak);
    return {
      ok: true,
      studentId: sid,
      nickname:  nickname,
      totalHP:   totalHP,
      streak:    streak,
      stage:     stage,
      title:     title
    };
  } catch(err) {
    console.error('[getStudentView]', err);
    return { ok: false, message: String(err) };
  }
}

/**
 * 学習進捗を一括リセット
 * ScriptProperties の cleared_* / pass1_* / pass2_* キーを全て削除する。
 *
 * ⚠️ 破壊的操作につき GAS エディタから手動実行すること。
 *    doGet ルーティングには登録しない（URL 経由で叩けないようにする）。
 */
function resetAllProgress() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const targets = Object.keys(all).filter(function(k) {
    return k.indexOf('cleared_') === 0
        || k.indexOf('pass1_')   === 0
        || k.indexOf('pass2_')   === 0;
  });
  targets.forEach(function(k){ props.deleteProperty(k); });

  console.log('[resetAllProgress] 削除件数: ' + targets.length);
  console.log('[resetAllProgress] 削除キー: ' + JSON.stringify(targets));

  return { ok: true, deleted: targets.length, keys: targets };
}

// =====================================================
// 三語短文
// =====================================================

// レベル表示順：難易度順（A=大学入試 / S=高校入試 / B=中学校 / T=小学校高学年）
const _SANGO_LEVEL_ORDER = ['A', 'S', 'B', 'T'];
function _sangoLevelRank(l) {
  const i = _SANGO_LEVEL_ORDER.indexOf(String(l || '').trim().toUpperCase());
  return i < 0 ? 999 : i;
}
function _sangoSortByLevel(arr) {
  return arr.sort(function(a, b){ return _sangoLevelRank(a.level) - _sangoLevelRank(b.level); });
}
const _SANGO_WEEKDAYS_JP = ['日','月','火','水','木','金','土'];

// JST で深夜3時を日付境界とする「今日」の日付文字列（yyyy-MM-dd）
function _sangoToday() {
  const now = new Date();
  const jst = new Date(Utilities.formatDate(now, 'Asia/Tokyo', "yyyy/MM/dd HH:mm:ss"));
  jst.setHours(jst.getHours() - 3); // 3時より前なら前日扱い
  return Utilities.formatDate(jst, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function _sangoPrevDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00+09:00');
  d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

// SangoTopics シート全体をキャッシュ経由で取得（6h TTL、書き込み系でクリア）
function _getSangoTopicsValues() {
  return _getCachedValues('cache_sango_topics_values', 21600, function() {
    const sh = _ss().getSheetByName(SHEET_SANGO_TOPICS);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getDataRange().getValues();
  });
}

function _readSangoTopicsByDate(dateStr) {
  const values = _getSangoTopicsValues();
  if (values.length < 2) return [];
  const header = values[0];
  const iDate  = header.indexOf('date');
  const iLevel = header.indexOf('level');
  const iW1    = header.indexOf('word1');
  const iW2    = header.indexOf('word2');
  const iW3    = header.indexOf('word3');
  const iTW    = header.indexOf('teacher_work');
  const iWN    = header.indexOf('week_no');
  // 2026-05-11 バグ① 修正：(date, level) で重複排除（後勝ち）。
  // 真因：adminAddSangoTopicsWeek が dedupe せず appendRow するため、同じ週を 2 回貼り付け
  // すると SangoTopics シートに同 (date, level) が複数行残り、本日のお題画面に同じレベルが
  // 数回〜十数回連続表示されていた。シートの行は後勝ち（管理者が誤って 2 回貼ったら最新
  // のものを採用）が自然なので、走査中に同 level に遭遇したら値を上書きする。
  const byLevel = {};
  const orderedLevels = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[iDate]) continue;
    const ds = Utilities.formatDate(new Date(r[iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
    if (ds !== dateStr) continue;
    const level = String(r[iLevel] || '').trim();
    const entry = {
      level: level,
      words: [r[iW1], r[iW2], r[iW3]].map(function(w){ return String(w || '').trim(); }).filter(Boolean),
      teacher_work: String(r[iTW] || '').trim(),
      week_no: iWN >= 0 ? String(r[iWN] || '').trim() : '',
      date: ds
    };
    if (!byLevel[level]) orderedLevels.push(level);
    byLevel[level] = entry;  // 後勝ち
  }
  return orderedLevels.map(function(l){ return byLevel[l]; });
}

// 今日のお題（各レベル）と前日の福地作品（各レベル）を返す
function getSangoTopic() {
  try {
    const today = _sangoToday();
    const yest  = _sangoPrevDate(today);
    const tRows = _readSangoTopicsByDate(today);
    const yRows = _readSangoTopicsByDate(yest);
    const topics = _sangoSortByLevel(tRows.map(function(t){ return { level: t.level, words: t.words }; }));
    const teacherWorks = _sangoSortByLevel(yRows.map(function(t){ return { level: t.level, work: t.teacher_work, date: t.date }; }));
    let weekNo = '';
    if (tRows.length > 0) {
      for (let i = 0; i < tRows.length; i++) {
        if (tRows[i].week_no) { weekNo = tRows[i].week_no; break; }
      }
    }
    return { ok: true, today: today, yesterday: yest, topics: topics, teacherWorks: teacherWorks, weekNo: weekNo };
  } catch(err) {
    console.error('[getSangoTopic]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// SangoSubmissions シート定義（2026-05-12 拡張）
// =============================================
// 既存 8 列（A〜H）：timestamp / studentId / studentName / level / words / work / method / teacher_comment
// 新規 6 列（I〜N）：ai_category / ai_feedback / ai_reasoning / starred / starred_at / published_in_week
// schema migration：既存シートに対しては _ensureSheetWithHeaders が末尾列だけ自動追記する。
// 既存提出レコードの新 6 列は空欄のまま（後方互換、AI 判定なし扱い）。
const SANGO_SUBMISSIONS_HEADERS = [
  'timestamp',           // A: 提出日時
  'studentId',           // B: 生徒 ID
  'studentName',         // C: ニックネーム
  'level',               // D: レベル（A/B/S/T）
  'words',               // E: お題 3 単語
  'work',                // F: 生徒作品本文
  'method',              // G: 提出方法（text / photo）
  'teacher_comment',     // H: 先生コメント（既存）
  'ai_category',         // I: AI 判定（excellent / good / needs_improvement）
  'ai_feedback',         // J: 生徒向けフィードバック本文
  'ai_reasoning',        // K: 管理画面用の判定理由
  'starred',             // L: ふくちさんが⭐認定したか（TRUE / FALSE / 空）
  'starred_at',          // M: 認定日時
  'published_in_week'    // N: 公開された週（'2026-W19' 形式）
];
// SangoSubmissions の列インデックス（読み書き両用）
const SANGO_SUB_COL_TIMESTAMP    = 0;
const SANGO_SUB_COL_SID          = 1;
const SANGO_SUB_COL_NICKNAME     = 2;
const SANGO_SUB_COL_LEVEL        = 3;
const SANGO_SUB_COL_WORDS        = 4;
const SANGO_SUB_COL_WORK         = 5;
const SANGO_SUB_COL_METHOD       = 6;
const SANGO_SUB_COL_TEACHER_COMM = 7;
const SANGO_SUB_COL_AI_CATEGORY  = 8;
const SANGO_SUB_COL_AI_FEEDBACK  = 9;
const SANGO_SUB_COL_AI_REASONING = 10;
const SANGO_SUB_COL_STARRED      = 11;
const SANGO_SUB_COL_STARRED_AT   = 12;
const SANGO_SUB_COL_PUBLISHED    = 13;

// SangoSubmissions シートの存在保証 + schema migration
// GAS エディタから手動 1 回実行（clasp push 後の初回セットアップ）。
// 既存シートには新 6 列（I〜N）を末尾追記する（_ensureSheetWithHeaders の機能）。
function ensureSangoSubmissionsSheet() {
  try {
    const r = _ensureSheetWithHeaders(SHEET_SANGO_SUBMISSIONS, SANGO_SUBMISSIONS_HEADERS);
    return { ok: true, created: r.created, sheet: SHEET_SANGO_SUBMISSIONS, headers: SANGO_SUBMISSIONS_HEADERS };
  } catch (err) {
    console.error('[ensureSangoSubmissionsSheet]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// サンゴタン AI フィードバック（Anthropic Claude Haiku 4.5）
// =============================================
// 2026-05-12 新機能：三語短文の生徒作品に対して、サンゴタンが AI を使って
//   即時フィードバックを返す。
// 入力：生徒の作品文 + お題 3 単語
// 出力：{ ok, category, feedback, reasoning } or { ok:false, error }
//   - category: 'excellent' | 'good' | 'needs_improvement'
//   - feedback: 生徒に見せる短いフィードバック（絵文字込み、最大 80 字程度）
//   - reasoning: 管理画面用の判定理由（最大 200 字）
// 注：末尾エクスキューズ「サンゴタンはAIなので…」はここでは付与せず、
//     呼び出し側（submitSango）で結合してフロントに返す。
// 失敗時：1 回リトライ、それでもダメなら { ok:false, error } を返す。
//        呼び出し側はフィードバックなしで提出を完了させる（HP は付与済み）。
function _sangoAiFeedback(submissionText, topic1, topic2, topic3) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('[_sangoAiFeedback] ANTHROPIC_API_KEY が設定されていません');
    return { ok: false, error: 'ANTHROPIC_API_KEY missing' };
  }

  const submission = String(submissionText || '').trim();
  if (!submission) return { ok: false, error: 'submission empty' };

  const w1 = String(topic1 || '').trim();
  const w2 = String(topic2 || '').trim();
  const w3 = String(topic3 || '').trim();

  const systemPrompt =
    'あなたは「サンゴタン」という、三語短文（3つの単語を使った日本語の短い作文）の\n' +
    '作品を読んでフィードバックを返すキャラクターです。\n' +
    '温かい目線で、生徒の作品を評価してください。\n' +
    '\n' +
    '【絶対ルール】\n' +
    '・「次も頑張ろう」と思える表現で書く（生徒を傷つけない）\n' +
    '・改善点を伝える場合も、優しく前向きな言い方にする\n' +
    '・短く（最大 80 字以内、絵文字 1〜2 個入れて親しみやすく）\n' +
    '・出力は JSON 形式のみ。前置き・説明・コードブロック（```）は絶対に含めない。\n' +
    '\n' +
    '【評価軸】\n' +
    '・3 つの単語を活かして文に組み込めているか（順序は不問）\n' +
    '・日本語として自然か（不自然な言い回し / 誤用 / 文法ミス）\n' +
    '・創意工夫（視点の面白さ / 比喩 / ユーモア / 情景描写）\n' +
    '\n' +
    '【判定カテゴリ】\n' +
    '・"excellent"          … 3 単語をしっかり活かし、日本語も自然で、視点や表現に光るものがある\n' +
    '・"good"               … 3 単語を使い、日本語も自然。標準的に良い作品\n' +
    '・"needs_improvement"  … 単語の使い方が不自然、または日本語に明らかな違和感がある\n' +
    '\n' +
    '【出力形式（厳密に JSON のみ）】\n' +
    '{\n' +
    '  "category": "excellent" | "good" | "needs_improvement",\n' +
    '  "feedback": "生徒向けの短いコメント（絵文字込み、80字以内）",\n' +
    '  "reasoning_internal": "判定理由を管理画面用に簡潔に（200字以内、絵文字なしで構わない）"\n' +
    '}\n';

  const userPrompt =
    '【今日のお題（3 単語）】\n' +
    '1) ' + w1 + '\n' +
    '2) ' + w2 + '\n' +
    '3) ' + w3 + '\n' +
    '\n' +
    '【生徒が書いた作品】\n' +
    submission + '\n' +
    '\n' +
    'この作品を評価して、上記のルール・出力形式に厳密に従って JSON のみ出力してください。';

  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  };

  const fetchOpts = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };

  const url = 'https://api.anthropic.com/v1/messages';
  const MAX_ATTEMPTS  = 2;
  const RETRY_WAIT_MS = 500;
  const QUOTA_PATTERN = /quota|rate|limit|overload|busy|unavailable/i;
  const VALID_CATEGORIES = { 'excellent': 1, 'good': 1, 'needs_improvement': 1 };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try { res = UrlFetchApp.fetch(url, fetchOpts); }
    catch (e) {
      const exMsg = String(e);
      console.error('[_sangoAiFeedback fetch exception attempt=' + attempt + ']', exMsg);
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, error: 'fetch exception: ' + exMsg };
    }
    const code = res.getResponseCode();
    const raw  = res.getContentText();
    if (code === 429 || (code >= 500 && code < 600)) {
      console.error('[_sangoAiFeedback retryable HTTP attempt=' + attempt + ']', code, raw.substring(0, 400));
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, error: 'HTTP ' + code };
    }
    if (code !== 200) {
      console.error('[_sangoAiFeedback HTTP error]', code, raw.substring(0, 400));
      // 4xx 系は永続エラー（auth / quota_exceeded など）なのでリトライしない
      return { ok: false, error: 'HTTP ' + code };
    }

    let json;
    try { json = JSON.parse(raw); }
    catch (e) {
      console.error('[_sangoAiFeedback response JSON parse error]', e, raw.substring(0, 400));
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, error: 'response not JSON: ' + String(e) };
    }

    // Anthropic は top-level type='error' で返すことがある（500 / 529 等）
    if (json && json.type === 'error') {
      const errMsg = String((json.error && json.error.message) || 'error');
      console.error('[_sangoAiFeedback top-level error attempt=' + attempt + ']', JSON.stringify(json.error));
      if (QUOTA_PATTERN.test(errMsg) && attempt < MAX_ATTEMPTS) {
        Utilities.sleep(RETRY_WAIT_MS); continue;
      }
      return { ok: false, error: 'anthropic error: ' + errMsg };
    }

    // 正常応答：content[0].text を取り出す
    const content = json && json.content;
    if (!Array.isArray(content) || !content[0] || typeof content[0].text !== 'string') {
      console.error('[_sangoAiFeedback unexpected response shape]', JSON.stringify(json).substring(0, 400));
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, error: 'unexpected response shape' };
    }

    let responseText = String(content[0].text || '').trim();
    // フォールバック保険：コードブロック装飾が混入していたら剥がす
    responseText = responseText.replace(/^```(?:[a-zA-Z]+)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    // JSON 本体を抽出（プロンプト指示で JSON のみのはずだが、保険として { ... } 部分を抜き出す）
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[_sangoAiFeedback no JSON in response]', responseText.substring(0, 400));
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, error: 'no JSON in response' };
    }

    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch (e) {
      console.error('[_sangoAiFeedback inner JSON parse error]', e, jsonMatch[0].substring(0, 400));
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, error: 'inner JSON parse: ' + String(e) };
    }

    const cat = String(parsed.category || '').trim();
    const fb  = String(parsed.feedback || '').trim();
    const rsn = String(parsed.reasoning_internal || '').trim();
    if (!VALID_CATEGORIES[cat] || !fb) {
      console.error('[_sangoAiFeedback validation failed]', JSON.stringify(parsed).substring(0, 400));
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, error: 'validation failed' };
    }

    return { ok: true, category: cat, feedback: fb, reasoning: rsn, attempts: attempt };
  }

  return { ok: false, error: 'all attempts exhausted' };
}

function submitSango(params) {
  try {
    const sid    = String(params.studentId || '').trim();
    const level  = String(params.level     || '').trim();
    const words  = String(params.words     || '').trim();
    const work   = String(params.work      || '').trim();
    const method = String(params.method    || '').trim();
    if (!sid || !level || !work) return { ok: false, message: '必要な情報が不足しています' };

    const ss = _ss();
    // 2026-05-09 Step 0：行シフト事故防止のため、書き込み対象行はシートから sid で
    // フレッシュに特定する（cache 経由禁止）。氏名 / streak / HP もここから読む。
    const stuLoc = _findAccountRowOnSheet(sid);
    if (!stuLoc) return { ok: false, message: 'Studentsシートが見つかりません' };
    const studentName = String(stuLoc.rowValues[COL_NICKNAME] || '').trim() || '名無し';

    const subSheet = ss.getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (!subSheet) return { ok: false, message: 'SangoSubmissionsシートが見つかりません' };
    const now = new Date();
    subSheet.appendRow([now, sid, studentName, level, words, work, method]);
    // 2026-05-12 サンゴタンAIフィードバック：appendRow 直後に行番号を取得して、
    // 後段の setValues（AI 結果書き込み）で同じ行を更新する。
    // appendRow は同期実行のため、直後の getLastRow() は自分が append した行を指す。
    const submissionRowIdx = subSheet.getLastRow();

    // HPLog の type='sango' で当日分チェック（末尾 200 行のみ走査、3時基準で日付判定）
    // HPLog 列構成（rawHP 追加後）：[0]timestamp [1]studentId [2]rawHP [3]hpGained [4]type
    const todayStr = _sangoToday();
    let alreadyGranted = false;
    const logSheet = ss.getSheetByName(SHEET_HPLOG);
    if (logSheet) {
      const logRows = _readLastNRows(logSheet, 200);
      for (let i = 0; i < logRows.length; i++) {
        if (String(logRows[i][1]).trim() !== sid) continue;
        if (logRows[i][4] !== 'sango') continue;
        const todayForLog = (function(ts){
          const t = new Date(ts); t.setHours(t.getHours() - 3);
          return Utilities.formatDate(t, 'Asia/Tokyo', 'yyyy-MM-dd');
        })(logRows[i][0]);
        if (todayForLog === todayStr) { alreadyGranted = true; break; }
      }
    }

    let hpGained = 0;
    if (!alreadyGranted) {
      // streak ベースの週数計算で 200 × week²
      const streak = Number(stuLoc.rowValues[COL_STREAK]) || 1;
      const week = Math.ceil(streak / 7);
      hpGained = 200 * week * week;

      // 2026-05-12 バグ④-本質 Phase B（案 A）：書き込み順序を _logHP → Students に変更。
      // HPLog 書き込み失敗時は Students.HP を加算せず、提出は受理した状態でエラー応答を返す。
      // SangoSubmissions は appendRow 済み（提出記録は保持）。
      const logRes = _logHP(sid, hpGained, hpGained, 'sango');
      if (!logRes.ok) {
        console.error('[submitSango] HPLog 書き込みに失敗しました。HP を加算せず終了。', logRes.error);
        return { ok: false, message: '内部エラーが発生しました。もう一度試してください。', errorCode: 'HP_LOG_FAILED' };
      }

      const cur = Number(stuLoc.rowValues[COL_HP]) || 0;
      const newHP = cur + hpGained;
      stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_HP + 1).setValue(newHP);
      const upd = {};
      upd[COL_HP] = newHP;
      _updateAccountCacheBySid(sid, upd);
      _invalidateCache('cache_ranking_last_week');
    }

    // 2026-05-12 サンゴタンAIフィードバック：HP 付与完了後に AI を呼び出す。
    // alreadyGranted=true（本日 2 回目以降）でも AI は呼ぶ（生徒は何度も書きたいので
    // 毎回フィードバックを返す）。
    // AI 失敗時はフィードバックなしで提出を完了させる（HP は付与済み）。
    // 末尾エクスキューズ「サンゴタンはAIなので…」はフロントに返す文字列のみに付与し、
    // シートに保存する ai_feedback には含めない（管理画面では純粋な AI 出力を見たい）。
    let aiFeedbackForFrontend = null;
    try {
      // 2026-05-12 修正：フロントは topic.words.join(' / ') で送ってくるため、'/' も区切り文字に含める。
      // 旧 regex（'/' なし）だと '原因 / 説得 / 寛容' を ['原因','/','説得','/','寛容'] に分割し、
      // w1='原因', w2='/', w3='説得' が AI に渡って「『/』が活かされてない」と誤判定された。
      const wordsArr = words.split(/[,、,，\/\s]+/).filter(function(s){ return s && s.trim(); }).map(function(s){ return s.trim(); });
      const w1 = wordsArr[0] || '';
      const w2 = wordsArr[1] || '';
      const w3 = wordsArr[2] || '';
      const fb = _sangoAiFeedback(work, w1, w2, w3);
      if (fb && fb.ok) {
        // SangoSubmissions の I, J, K 列（AI 関連）に書き込み。
        // L〜N 列（starred / starred_at / published_in_week）は admin が後から書く列なので触らない。
        try {
          subSheet.getRange(
            submissionRowIdx,
            SANGO_SUB_COL_AI_CATEGORY + 1,
            1,
            3
          ).setValues([[fb.category, fb.feedback, fb.reasoning]]);
        } catch (writeErr) {
          console.error('[submitSango] AI フィードバック列の書き込み失敗', writeErr);
          // 書き込み失敗してもフロントへの応答は続行（生徒体験を優先）
        }
        aiFeedbackForFrontend = {
          category: fb.category,
          feedback: fb.feedback + '\n\nサンゴタンはAIなので間違う可能性もあります。ゴメンナサイ🙇‍♂️💦'
        };
      } else {
        console.warn('[submitSango] AI フィードバック失敗（提出は完了）', fb && fb.error);
      }
    } catch (aiErr) {
      // AI 呼び出しの try-catch：何があっても提出完了の応答を阻害しない
      console.error('[submitSango] AI フィードバック処理で例外', aiErr);
    }

    return { ok: true, hpGained: hpGained, aiFeedback: aiFeedbackForFrontend };
  } catch(err) {
    console.error('[submitSango]', err);
    return { ok: false, message: String(err) };
  }
}

function adminAddSangoTopic(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    if (!params.date || !params.level || !params.word1 || !params.word2 || !params.word3 || !params.teacher_work) {
      return { ok: false, message: '必須項目を入力してください' };
    }
    const sh = _ss().getSheetByName(SHEET_SANGO_TOPICS);
    if (!sh) return { ok: false, message: 'SangoTopicsシートが見つかりません' };
    sh.appendRow([params.date, params.level, params.word1, params.word2, params.word3, params.teacher_work]);
    _invalidateCache('cache_sango_topics_values');
    return { ok: true };
  } catch(err) {
    console.error('[adminAddSangoTopic]', err);
    return { ok: false, message: String(err) };
  }
}

// 週単位の一括登録（月〜日 × レベルA/S/B/T を一気に追加）
// 期待する params: { password, start, weekNo, items: [{date, level, word1, word2, word3}, ...] }
// teacher_work は送られてこない想定（後で adminSetSangoTeacherWork で個別に上書きする運用）
// week_no は週全体で1つの番号（全itemsに同じ番号を付与）
function adminAddSangoTopicsWeek(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    const items = params.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, message: '登録するお題がありません' };
    }
    const weekNo = params.weekNo || '';
    const sh = _ss().getSheetByName(SHEET_SANGO_TOPICS);
    if (!sh) return { ok: false, message: 'SangoTopicsシートが見つかりません' };

    const errors = [];
    const rowsToAppend = [];
    items.forEach(function(item, idx){
      if (!item.date || !item.level || !item.word1 || !item.word2 || !item.word3) {
        errors.push((idx + 1) + '件目：date/level/word1-3 のいずれかが空です');
        return;
      }
      rowsToAppend.push([
        item.date,
        item.level,
        item.word1,
        item.word2,
        item.word3,
        '',
        weekNo
      ]);
    });

    if (rowsToAppend.length === 0) {
      return { ok: false, message: '有効な行がありません', errors: errors };
    }

    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    _invalidateCache('cache_sango_topics_values');

    return { ok: true, added: rowsToAppend.length, errors: errors };
  } catch(err) {
    console.error('[adminAddSangoTopicsWeek]', err);
    return { ok: false, message: String(err) };
  }
}

function adminListSangoSubmissions(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, submissions: [] };

    // Step 2：全アカウント対象（Students + SpecialAccounts）。テスト枠の提出も生徒名表示できるように。
    const nameMap = {};
    const stuRows = _getAllAccountsValues();
    if (stuRows && stuRows.length >= 2) {
      for (let i = 1; i < stuRows.length; i++) {
        const sid = String(stuRows[i][COL_ID] || '').trim();
        if (!sid) continue;
        nameMap[sid] = String(stuRows[i][COL_NAME] || '').trim();
      }
    }

    const values = sh.getDataRange().getValues();
    const submissions = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[0]) continue;
      const sid = String(r[1] || '').trim();
      // 2026-05-12 サンゴタンAIフィードバック関連 6 列も含めて返す
      // starred は型ゆらぎ吸収（TRUE / true / 1 / '1' すべて真扱い）
      const starredVal = r[SANGO_SUB_COL_STARRED];
      const isStarred = (starredVal === true) || (String(starredVal).toLowerCase() === 'true') || (starredVal === 1) || (String(starredVal) === '1');
      const starredAtRaw = r[SANGO_SUB_COL_STARRED_AT];
      let starredAtStr = '';
      if (starredAtRaw) {
        try { starredAtStr = Utilities.formatDate(new Date(starredAtRaw), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'); }
        catch(e) { starredAtStr = String(starredAtRaw); }
      }
      submissions.push({
        timestamp:      Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
        studentId:      sid,
        studentName:    String(r[2] || ''),
        studentRealName: nameMap[sid] || '',
        level:          String(r[3] || ''),
        words:          String(r[4] || ''),
        work:           String(r[5] || ''),
        method:         String(r[6] || ''),
        teacher_comment: String(r[7] || ''),
        ai_category:    String(r[SANGO_SUB_COL_AI_CATEGORY] || ''),
        ai_feedback:    String(r[SANGO_SUB_COL_AI_FEEDBACK] || ''),
        ai_reasoning:   String(r[SANGO_SUB_COL_AI_REASONING] || ''),
        starred:        isStarred,
        starred_at:     starredAtStr,
        published_in_week: String(r[SANGO_SUB_COL_PUBLISHED] || '')
      });
    }
    submissions.sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });
    return { ok: true, submissions: submissions, currentWeek: _sangoCurrentIsoWeek() };
  } catch(err) {
    console.error('[adminListSangoSubmissions]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 管理画面：⭐認定 / 公開 設定（2026-05-12 新機能）
// =============================================
// adminSangoStar: starred 列を TRUE / 空 にトグル。starred_at にもタイムスタンプを書く。
//   認定を取り消した場合は published_in_week 列もクリア（公開停止）。
function adminSangoStar(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const ts   = String((params && params.timestamp) || '').trim();
    const sid  = String((params && params.studentId) || '').trim();
    const star = !!(params && params.star);  // true: 認定、false: 取消
    if (!ts || !sid) return { ok: false, message: 'timestamp / studentId が必要です' };
    const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: false, message: '提出が見つかりません' };
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[SANGO_SUB_COL_TIMESTAMP]) continue;
      const rowTs  = Utilities.formatDate(new Date(r[SANGO_SUB_COL_TIMESTAMP]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      const rowSid = String(r[SANGO_SUB_COL_SID] || '').trim();
      if (rowTs === ts && rowSid === sid) {
        const now = _nowJST();
        // starred 列 + starred_at 列を 1 回の setValues で更新
        sh.getRange(i + 1, SANGO_SUB_COL_STARRED + 1, 1, 2).setValues([[star ? true : '', star ? now : '']]);
        // 認定取消時は published_in_week もクリア（公開も停止）
        if (!star) {
          sh.getRange(i + 1, SANGO_SUB_COL_PUBLISHED + 1).setValue('');
        }
        return { ok: true, starred: star, starred_at: star ? Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss') : '' };
      }
    }
    return { ok: false, message: '該当する提出が見つかりません' };
  } catch (err) {
    console.error('[adminSangoStar]', err);
    return { ok: false, message: String(err) };
  }
}

// adminSangoPublish: published_in_week 列に「今週」をセット / 解除。
//   認定済み（starred=TRUE）でない作品の公開はエラー。
function adminSangoPublish(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const ts      = String((params && params.timestamp) || '').trim();
    const sid     = String((params && params.studentId) || '').trim();
    const publish = !!(params && params.publish);
    if (!ts || !sid) return { ok: false, message: 'timestamp / studentId が必要です' };
    const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: false, message: '提出が見つかりません' };
    const values = sh.getDataRange().getValues();
    const currentWeek = _sangoCurrentIsoWeek();
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[SANGO_SUB_COL_TIMESTAMP]) continue;
      const rowTs  = Utilities.formatDate(new Date(r[SANGO_SUB_COL_TIMESTAMP]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      const rowSid = String(r[SANGO_SUB_COL_SID] || '').trim();
      if (rowTs === ts && rowSid === sid) {
        const starredVal = r[SANGO_SUB_COL_STARRED];
        const isStarred = (starredVal === true) || (String(starredVal).toLowerCase() === 'true') || (starredVal === 1) || (String(starredVal) === '1');
        if (publish && !isStarred) {
          return { ok: false, message: '⭐認定された作品のみ公開できます。先に⭐認定してください。' };
        }
        sh.getRange(i + 1, SANGO_SUB_COL_PUBLISHED + 1).setValue(publish ? currentWeek : '');
        return { ok: true, publishedWeek: publish ? currentWeek : '' };
      }
    }
    return { ok: false, message: '該当する提出が見つかりません' };
  } catch (err) {
    console.error('[adminSangoPublish]', err);
    return { ok: false, message: String(err) };
  }
}

// 管理画面：先生の作品（個別登録）
// 既存の (date, level) 行を検索して teacher_work 列を上書きする
function adminSetSangoTeacherWork(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    const date  = String(params.date  || '').trim();
    const level = String(params.level || '').trim();
    const work  = String(params.teacher_work || '').trim();
    if (!date || !level || !work) return { ok: false, message: '必須項目を入力してください' };
    const sh = _ss().getSheetByName(SHEET_SANGO_TOPICS);
    if (!sh || sh.getLastRow() < 2) return { ok: false, message: '該当するお題が見つかりません。先に週単位一括登録をしてください' };
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iDate  = header.indexOf('date');
    const iLevel = header.indexOf('level');
    const iTW    = header.indexOf('teacher_work');
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[iDate]) continue;
      const ds = Utilities.formatDate(new Date(r[iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
      const lv = String(r[iLevel] || '').trim();
      if (ds === date && lv === level) {
        sh.getRange(i + 1, iTW + 1).setValue(work);
        _invalidateCache('cache_sango_topics_values');
        return { ok: true };
      }
    }
    return { ok: false, message: '該当する日付・レベルのお題が見つかりません。先に週単位一括登録をしてください' };
  } catch(err) {
    console.error('[adminSetSangoTeacherWork]', err);
    return { ok: false, message: String(err) };
  }
}

function adminSetSangoComment(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const ts  = String(params.timestamp || '').trim();
    const sid = String(params.studentId || '').trim();
    const comment = String(params.comment != null ? params.comment : '');
    if (!ts || !sid) return { ok: false, message: 'timestamp / studentId が必要です' };
    const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: false, message: '該当する提出が見つかりません' };
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[0]) continue;
      const rowTs  = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      const rowSid = String(r[1] || '').trim();
      if (rowTs === ts && rowSid === sid) {
        sh.getRange(i + 1, 8).setValue(comment);
        return { ok: true };
      }
    }
    return { ok: false, message: '該当する提出が見つかりません' };
  } catch(err) {
    console.error('[adminSetSangoComment]', err);
    return { ok: false, message: String(err) };
  }
}

function getSangoSubmissions(params) {
  try {
    const sid = String(params.studentId || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, submissions: [] };
    const values = sh.getDataRange().getValues();
    const submissions = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[0]) continue;
      if (String(r[1] || '').trim() !== sid) continue;
      submissions.push({
        timestamp:       Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
        studentId:       String(r[1] || ''),
        studentName:     String(r[2] || ''),
        level:           String(r[3] || ''),
        words:           String(r[4] || ''),
        work:            String(r[5] || ''),
        method:          String(r[6] || ''),
        teacher_comment: String(r[7] || '')
      });
    }
    submissions.sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });
    return { ok: true, submissions: submissions };
  } catch(err) {
    console.error('[getSangoSubmissions]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// サンゴタン ISO 8601 週番号ヘルパー（2026-05-12 新機能）
// =============================================
// 「今週」を 'yyyy-Www' 形式（例：2026-W19）の文字列で表す。月曜始まり。
// admin が「今週公開」をチェック → published_in_week 列にこの文字列を書き、
// 生徒画面の getSangoWeeklyFeatured が同じ文字列でフィルタする。
// 教育日 4:00 AM は適用しない（週単位の粒度なので深夜 0:00 切替で十分）。
function _sangoIsoWeekStr(d) {
  // d を JST の Date として解釈し、ISO 8601 ルールで週番号を決定する。
  const tz = 'Asia/Tokyo';
  const ymd = Utilities.formatDate(d, tz, 'yyyy-MM-dd').split('-');
  // 当日 0:00 JST の Date を作る（UTC 表記）
  const today = new Date(Date.UTC(Number(ymd[0]), Number(ymd[1]) - 1, Number(ymd[2])));
  // ISO weekday: 月=1 ... 日=7
  const day = today.getUTCDay() || 7;
  // その週の木曜日に揃える（ISO 8601：木曜が含まれる年がその週の年）
  today.setUTCDate(today.getUTCDate() + 4 - day);
  const year = today.getUTCFullYear();
  // その年の最初の木曜日と比較して週番号を計算
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNo = Math.ceil((((today - yearStart) / 86400000) + 1) / 7);
  return year + '-W' + (weekNo < 10 ? '0' + weekNo : String(weekNo));
}
function _sangoCurrentIsoWeek() {
  return _sangoIsoWeekStr(new Date());
}

// =============================================
// サンゴタン「今週の秀逸作品」（2026-05-12 新機能）
// =============================================
// ふくちさんが admin で⭐認定 + 「今週公開」設定した作品を、生徒のホーム画面に
// カード表示するための API。starred=TRUE かつ published_in_week=現在週の作品を返す。
// 認証不要（生徒全員に同じ内容を見せる仕様）。
function getSangoWeeklyFeatured() {
  try {
    const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
    const currentWeek = _sangoCurrentIsoWeek();
    if (!sh || sh.getLastRow() < 2) return { ok: true, featured: [], currentWeek: currentWeek };
    const values = sh.getDataRange().getValues();
    const out = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[SANGO_SUB_COL_TIMESTAMP]) continue;
      const starredVal = r[SANGO_SUB_COL_STARRED];
      const isStarred = (starredVal === true) || (String(starredVal).toLowerCase() === 'true') || (starredVal === 1) || (String(starredVal) === '1');
      if (!isStarred) continue;
      const publishedWeek = String(r[SANGO_SUB_COL_PUBLISHED] || '').trim();
      if (publishedWeek !== currentWeek) continue;
      const ts = Utilities.formatDate(new Date(r[SANGO_SUB_COL_TIMESTAMP]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      out.push({
        submissionId:    ts + '_' + String(r[SANGO_SUB_COL_SID] || '').trim(),
        timestamp:       ts,
        studentNickname: String(r[SANGO_SUB_COL_NICKNAME] || '').trim() || '名無し',
        level:           String(r[SANGO_SUB_COL_LEVEL] || ''),
        words:           String(r[SANGO_SUB_COL_WORDS] || ''),
        work:            String(r[SANGO_SUB_COL_WORK] || ''),
        publishedWeek:   publishedWeek
      });
    }
    // timestamp 降順（新しい認定が先頭）
    out.sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });
    return { ok: true, featured: out, currentWeek: currentWeek };
  } catch(err) {
    console.error('[getSangoWeeklyFeatured]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// サンゴタン殿堂アーカイブ（2026-05-12 新機能）
// =============================================
// ホーム画面の秀逸作品カードから「殿堂アーカイブを見る」で遷移。
// 過去に⭐認定 + 公開された作品を週ごとにグループ化、1 ページ 4 週ずつ
// ページネーション。
// 引数：{ weekOffset:0 }（0 = 最新 4 週、1 = さらに次の 4 週、...）
function getSangoHallOfFame(params) {
  try {
    const offset = Math.max(0, parseInt((params && params.weekOffset) || 0, 10) || 0);
    const PAGE_SIZE = 4;
    const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, weeks: [], hasMore: false, weekOffset: offset };
    const values = sh.getDataRange().getValues();
    // starred=TRUE かつ published_in_week 非空 の行だけを抽出
    const items = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[SANGO_SUB_COL_TIMESTAMP]) continue;
      const starredVal = r[SANGO_SUB_COL_STARRED];
      const isStarred = (starredVal === true) || (String(starredVal).toLowerCase() === 'true') || (starredVal === 1) || (String(starredVal) === '1');
      if (!isStarred) continue;
      const publishedWeek = String(r[SANGO_SUB_COL_PUBLISHED] || '').trim();
      if (!publishedWeek) continue;
      const ts = Utilities.formatDate(new Date(r[SANGO_SUB_COL_TIMESTAMP]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      items.push({
        submissionId:    ts + '_' + String(r[SANGO_SUB_COL_SID] || '').trim(),
        timestamp:       ts,
        studentNickname: String(r[SANGO_SUB_COL_NICKNAME] || '').trim() || '名無し',
        level:           String(r[SANGO_SUB_COL_LEVEL] || ''),
        words:           String(r[SANGO_SUB_COL_WORDS] || ''),
        work:            String(r[SANGO_SUB_COL_WORK] || ''),
        publishedWeek:   publishedWeek
      });
    }
    // 週ごとにグループ化
    const groupMap = {};
    items.forEach(function(it){
      if (!groupMap[it.publishedWeek]) groupMap[it.publishedWeek] = [];
      groupMap[it.publishedWeek].push(it);
    });
    // 週を降順にソート（'yyyy-Www' 文字列で辞書順比較 = 時系列降順と一致）
    const sortedWeeks = Object.keys(groupMap).sort(function(a, b){ return a < b ? 1 : a > b ? -1 : 0; });
    // ページネーション
    const startIdx = offset * PAGE_SIZE;
    const endIdx   = startIdx + PAGE_SIZE;
    const pageWeeks = sortedWeeks.slice(startIdx, endIdx);
    const hasMore   = sortedWeeks.length > endIdx;
    const weeks = pageWeeks.map(function(w){
      // 週内は timestamp 降順
      const itemsInWeek = groupMap[w].sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });
      return { week: w, items: itemsInWeek };
    });
    return { ok: true, weeks: weeks, hasMore: hasMore, weekOffset: offset, totalWeeks: sortedWeeks.length };
  } catch(err) {
    console.error('[getSangoHallOfFame]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// サンゴタン⭐認定通知（2026-05-12 新機能）
// =============================================
// 生徒が次回ログイン時 / ホーム表示時に呼び出して、自身の作品で
// ⭐認定（starred=TRUE）されているものを返す。フロント側は localStorage
// で「mykt_sango_starred_seen_<sid>_<submission_id>」フラグを管理し、
// 未読の⭐があれば派手な演出を表示。
// 注：「秀逸作品」「公開」等の情報は意図的に返さない（仕様）。生徒には
// 「特別な称号をもらった」とだけ伝え、公開対象選定はふくちさんに委ねる。
function getSangoStarredForStudent(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, starred: [] };
    const values = sh.getDataRange().getValues();
    const out = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[SANGO_SUB_COL_TIMESTAMP]) continue;
      if (String(r[SANGO_SUB_COL_SID] || '').trim() !== sid) continue;
      // starred 列が TRUE / true / 1 のいずれかなら⭐認定済
      const starredVal = r[SANGO_SUB_COL_STARRED];
      const isStarred = (starredVal === true) || (String(starredVal).toLowerCase() === 'true') || (starredVal === 1) || (String(starredVal) === '1');
      if (!isStarred) continue;
      const ts = Utilities.formatDate(new Date(r[SANGO_SUB_COL_TIMESTAMP]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      const starredAtRaw = r[SANGO_SUB_COL_STARRED_AT];
      let starredAt = '';
      if (starredAtRaw) {
        try { starredAt = Utilities.formatDate(new Date(starredAtRaw), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'); }
        catch(e) { starredAt = String(starredAtRaw); }
      }
      out.push({
        // submissionId は timestamp + sid をシンプルに結合した一意キー
        submissionId: ts + '_' + sid,
        timestamp:    ts,
        level:        String(r[SANGO_SUB_COL_LEVEL] || ''),
        words:        String(r[SANGO_SUB_COL_WORDS] || ''),
        work:         String(r[SANGO_SUB_COL_WORK] || ''),
        starred_at:   starredAt
      });
    }
    // starred_at（または timestamp）降順で並べる（最新の⭐認定が先頭）
    out.sort(function(a, b){
      const aKey = a.starred_at || a.timestamp;
      const bKey = b.starred_at || b.timestamp;
      return aKey < bKey ? 1 : aKey > bKey ? -1 : 0;
    });
    return { ok: true, starred: out };
  } catch(err) {
    console.error('[getSangoStarredForStudent]', err);
    return { ok: false, message: String(err) };
  }
}

// 過去のお題（日付範囲で一括取得）→ 日付降順 × レベルA→S→B→T でまとめる
// startStr / endStr は 'yyyy-MM-dd'。start <= end の範囲を返す
function _readSangoTopicsByDateRange(startStr, endStr) {
  const values = _getSangoTopicsValues();
  if (values.length < 2) return [];
  const header = values[0];
  const iDate  = header.indexOf('date');
  const iLevel = header.indexOf('level');
  const iW1    = header.indexOf('word1');
  const iW2    = header.indexOf('word2');
  const iW3    = header.indexOf('word3');
  const iTW    = header.indexOf('teacher_work');
  const iWN    = header.indexOf('week_no');
  // 2026-05-11 バグ① 修正：(date, level) で重複排除（後勝ち）。
  // _readSangoTopicsByDate と同じ理由で、過去画面・アーカイブ画面の同レベル重複表示を防ぐ。
  const byKey = {};
  const orderedKeys = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[iDate]) continue;
    const ds = Utilities.formatDate(new Date(r[iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
    if (ds < startStr || ds > endStr) continue;
    const level = String(r[iLevel] || '').trim();
    const key = ds + '\t' + level;
    const entry = {
      date:  ds,
      level: level,
      word1: String(r[iW1] || '').trim(),
      word2: String(r[iW2] || '').trim(),
      word3: String(r[iW3] || '').trim(),
      teacher_work: iTW >= 0 ? String(r[iTW] || '').trim() : '',
      week_no:      iWN >= 0 ? String(r[iWN] || '').trim() : ''
    };
    if (!byKey[key]) orderedKeys.push(key);
    byKey[key] = entry;  // 後勝ち
  }
  return orderedKeys.map(function(k){ return byKey[k]; });
}

// 日付降順 × レベルA→S→B→T にまとめたレスポンス topics 配列を生成
function _buildSangoTopicsByDate(rows) {
  const byDate = {};
  rows.forEach(function(r) {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });
  const dates = Object.keys(byDate).sort(function(a, b){ return a < b ? 1 : a > b ? -1 : 0; });
  return dates.map(function(d) {
    const levels = _sangoSortByLevel(byDate[d].slice());
    const wd = _SANGO_WEEKDAYS_JP[new Date(d + 'T12:00:00+09:00').getDay()];
    return {
      date: d,
      weekday: wd,
      levels: levels.map(function(r){
        return {
          level: r.level,
          word1: r.word1,
          word2: r.word2,
          word3: r.word3,
          teacher_work: r.teacher_work,
          week_no: r.week_no
        };
      })
    };
  });
}

// JST 基準の「昨日」起点で N 日前の日付文字列を返す
function _sangoDateAgo(daysAgo) {
  const today = _sangoToday();
  const d = new Date(today + 'T12:00:00+09:00');
  d.setDate(d.getDate() - daysAgo);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

// 直近1週間分（昨日〜7日前）のお題と福地の作品
function getSangoPastTopicsRecent() {
  try {
    const endStr   = _sangoDateAgo(1); // 昨日
    const startStr = _sangoDateAgo(7); // 7日前
    const rows = _readSangoTopicsByDateRange(startStr, endStr);
    return { ok: true, topics: _buildSangoTopicsByDate(rows) };
  } catch(err) {
    console.error('[getSangoPastTopicsRecent]', err);
    return { ok: false, message: String(err) };
  }
}

// 1週間単位のページング（weekOffset=1 → 14日前〜8日前 / weekOffset=2 → 21日前〜15日前 ...）
function getSangoPastTopicsPaged(params) {
  try {
    const weekOffset = Math.max(1, Number((params && params.weekOffset) || 1) | 0);
    const endStr   = _sangoDateAgo(weekOffset * 7 + 1);
    const startStr = _sangoDateAgo(weekOffset * 7 + 7);
    const rows = _readSangoTopicsByDateRange(startStr, endStr);

    // 次ページにデータがあるかをチェック
    const nextEnd   = _sangoDateAgo((weekOffset + 1) * 7 + 1);
    const nextStart = _sangoDateAgo((weekOffset + 1) * 7 + 7);
    const nextRows = _readSangoTopicsByDateRange(nextStart, nextEnd);

    return {
      ok: true,
      weekOffset: weekOffset,
      topics: _buildSangoTopicsByDate(rows),
      hasMore: nextRows.length > 0
    };
  } catch(err) {
    console.error('[getSangoPastTopicsPaged]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 保護者画面・管理画面：お子様（生徒）の学習履歴（直近7日 + ページング）
// params: { studentId, offset }
//   offset=0 → 本日〜6日前 / offset=1 → 7〜13日前 / offset=2 → 14〜20日前 ...
//   ※ 旧仕様（〜2026-05-04）は「昨日〜7日前」で本日が範囲外だったため、
//     本日学習した生徒の活動が翌日 JST 4:00（教育日切替）まで表示されない
//     リアルタイム反映バグがあった。本日を含めるよう修正済み。
// =============================================
function getChildActivityRecent(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    const offset = Math.max(0, Number((params && params.offset) || 0) | 0);

    const endDaysAgo   = offset * 7;      // 新しい方（offset=0 → 本日）
    const startDaysAgo = offset * 7 + 6;  // 古い方（本日 + 過去6日 = 7日分）
    const endStr   = _sangoDateAgo(endDaysAgo);
    const startStr = _sangoDateAgo(startDaysAgo);

    const byDate = {};
    for (let i = endDaysAgo; i <= startDaysAgo; i++) {
      const d = _sangoDateAgo(i);
      const wd = _SANGO_WEEKDAYS_JP[new Date(d + 'T12:00:00+09:00').getDay()];
      byDate[d] = {
        date: d,
        weekday: wd,
        login: false,
        eitango: { done: false, details: [] },
        sango:   { done: false, level: null, timestamp: null },
        wabun1:  { done: false, hpGained: 0 },
        kiso:    { done: false, hpGained: 0, rawHP: 0, sessions: [] },
        lison:   { done: false, hpGained: 0, levels: [] },
        kanji:   { done: false, hpGained: 0, rawHP: 0, sessions: [] },
        kobun:   { done: false, hpGained: 0, rawHP: 0, sessions: [] },
        extras:  []  // 未知の HPLog type は自動でここに集約（将来コンテンツの自動対応）
      };
    }

    const ss = _ss();
    let hasMore = false;

    // HPLog: login / test / sango / wabun1 / kiso_* / lison のフラグ + hasMore 判定
    // 末尾 2000 行のみ読む（追記専用シートなので末尾 = 最新、約 40 日分カバー想定）
    // apology_* 系は学習行動ではないので学習履歴には反映しない（HP は加算済み、ランキングには出る）
    const APOLOGY_TYPES = { apology_streak_bonus: 1, apology_wabun1: 1, apology_kiso: 1 };
    const hpSheet = ss.getSheetByName(SHEET_HPLOG);
    if (hpSheet && hpSheet.getLastRow() >= 2) {
      const rows = _readLastNRows(hpSheet, 2000);
      // 先頭行が startStr より新しければ「さらに古い行がある」→ hasMore 候補
      if (rows.length > 0 && hpSheet.getLastRow() - 1 > rows.length) {
        // 読んだ範囲より古い行が存在する。その古い行に該当生徒の log があるかは判定不可だが、
        // 保守的に hasMore=true 扱い（archive ボタンの誤表示はあっても致命的でない）
        hasMore = true;
      }
      // HPLog 列構成（rawHP 追加後）：[0]timestamp [1]studentId [2]rawHP [3]hpGained [4]type
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (String(r[1] || '').trim() !== sid) continue;
        const ds = _toDateStr(r[0]);
        if (!ds) continue;
        if (ds < startStr) { hasMore = true; continue; }
        if (ds > endStr) continue;
        if (!byDate[ds]) continue;
        const type = String(r[4] || '').trim();
        if (APOLOGY_TYPES[type]) continue;  // 学習履歴には反映しない
        const hp  = Number(r[3]) || 0;
        const raw = Number(r[2]) || 0;
        if      (type === 'login') byDate[ds].login = true;
        else if (type === 'test')  byDate[ds].eitango.done = true;
        else if (type === 'sango') byDate[ds].sango.done   = true;
        else if (type === 'wabun1') {
          byDate[ds].wabun1.done = true;
          byDate[ds].wabun1.hpGained = hp;
        }
        else if (type === 'lison') {
          byDate[ds].lison.done = true;
          byDate[ds].lison.hpGained += hp;
        }
        else if (type.indexOf('kiso_') === 0) {
          // 'kiso_<rank>_<count>' or 'kiso_<rank>_<count>_practice'
          byDate[ds].kiso.done = true;
          byDate[ds].kiso.hpGained += hp;
          byDate[ds].kiso.rawHP    += raw;
          const m = /^kiso_(\d+)_(\d+)(_practice)?$/.exec(type);
          if (m) {
            byDate[ds].kiso.sessions.push({
              rank:       parseInt(m[1], 10),
              count:      parseInt(m[2], 10),
              isPractice: !!m[3],
              hpGained:   hp,
              rawHP:      raw
            });
          }
        }
        else if (type.indexOf('kanji_') === 0) {
          // 'kanji_<level>_<count>' or 'kanji_<level>_<count>_practice'
          // level は '5' / '4' / '3' / '準2' / '2'（'準2' を含むため _ で素朴に split しない）
          byDate[ds].kanji.done = true;
          byDate[ds].kanji.hpGained += hp;
          byDate[ds].kanji.rawHP    += raw;
          const m = /^kanji_(準?\d+)_(\d+)(_practice)?$/.exec(type);
          if (m) {
            byDate[ds].kanji.sessions.push({
              level:      m[1],
              count:      parseInt(m[2], 10),
              isPractice: !!m[3],
              hpGained:   hp,
              rawHP:      raw
            });
          }
        }
        else if (type.indexOf('kobun_') === 0) {
          // 'kobun_<round>_<count>' or 'kobun_<round>_<count>_practice'
          // round は '1' or '2'（周回）、count は 5 or 10
          byDate[ds].kobun.done = true;
          byDate[ds].kobun.hpGained += hp;
          byDate[ds].kobun.rawHP    += raw;
          const m = /^kobun_(\d+)_(\d+)(_practice)?$/.exec(type);
          if (m) {
            byDate[ds].kobun.sessions.push({
              round:      m[1],
              count:      parseInt(m[2], 10),
              isPractice: !!m[3],
              hpGained:   hp,
              rawHP:      raw
            });
          }
        }
        else {
          // 未知の type は extras に集約（将来 wabun2/kanji/social/science/kobun 等が
          // 追加されたとき HPLog に新 type を流すだけで自動表示される）
          byDate[ds].extras.push({ type: type, hpGained: hp });
        }
      }
    }

    // ================================================================
    // 2026-05-15 構造的バグ修正：HPLog 単独依存からの脱却（全コンテンツ網羅）
    // ----------------------------------------------------------------
    // 多くのコンテンツが HPLog に書き込むのは「合格 + HP 付与あり」の場合のみで、
    //   - wabun1：allCorrect && !alreadyGranted の時のみ
    //   - test (英単語RUSH)：passed の時のみ
    //   - kiso：passed の時のみ
    //   - kanji（書き）：passed の時のみ（読みは独立 API で HPLog に書かない）
    //   - kobun：passed の時のみ
    //   - sango / lison：!alreadyGranted の時のみ
    // 提出記録自体は各 *Submissions / *Sessions シートに常に残るため、それらを
    // 「学習活動の事実」のフォールバックとして必ず参照する。これがないと、
    // 「不正解だった日」「同日 2 回目以降の挑戦」が学習履歴に出ない問題が発生。
    //
    // 過去のバグ事例：
    //   5/7  マイカツ君 Stage が単一コンテンツ依存（_getPrevDayCount）→ HPLog 集約に修正
    //   5/14 コブタンが「その他」表記 → _calendarContentName / _isCountableActivityType 拡張
    //   5/15 学習履歴 全コンテンツ ✗ ← この修正で対処（同種の構造的バグ）
    //
    // 読み取り行数も増やす：直近 7 日分で 70 生徒 × 2 件/日 = 約 1000 件/週。
    // 余裕を見て主要シートは 2000〜5000 行を読む。
    // ================================================================

    // ▼ Attempts（英単語RUSH）: 合格 1 件でも eitango.done=true 化（旧実装は details のみ補完）
    //   列構成: [0]timestamp [1]studentId [2]studentName [3]setNo [4]score [5]合否 [6]level
    const atSheet = ss.getSheetByName(SHEET_ATTEMPTS);
    if (atSheet && atSheet.getLastRow() >= 2) {
      const rows = _readLastNRows(atSheet, 2000);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (String(r[1] || '').trim() !== sid) continue;
        const ds = _toDateStr(r[0]);
        if (!ds || !byDate[ds]) continue;
        const pass = String(r[5] || '').trim();
        if (pass !== '合格') continue;
        // 2026-05-15 バグ修正：HPLog 'test' が無くても done=true にする（合格記録があれば十分）
        byDate[ds].eitango.done = true;
        byDate[ds].eitango.details.push({
          level: String(r[6] || '').trim(),
          set: Number(r[3]) || 0
        });
      }
    }

    // ▼ SangoSubmissions: 提出があれば done=true（行数 500 → 2000 に拡張）
    //   列構成: [0]timestamp [1]studentId [2]studentName [3]level [4]words [5]work [6]method
    const sgSheet = ss.getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (sgSheet && sgSheet.getLastRow() >= 2) {
      const rows = _readLastNRows(sgSheet, 2000);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue;
        if (String(r[1] || '').trim() !== sid) continue;
        const tsStr = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
        const ds = tsStr.slice(0, 10);
        if (!byDate[ds]) continue;
        byDate[ds].sango.done = true;
        if (!byDate[ds].sango.timestamp) {
          byDate[ds].sango.level     = String(r[3] || '').trim();
          byDate[ds].sango.timestamp = tsStr;
        }
      }
    }

    // ▼ Wabun1Submissions: 提出があれば done=true（新規追加フォールバック）
    //   列構成: [0]timestamp [1]studentId [2]studentName [3]workText [4]method [5]teacher_comment [6]skipJson
    //   2026-05-15 バグ修正：submitWabun1 は allCorrect 時のみ HPLog 書き込む仕様のため、
    //   不正解を含む提出は HPLog に残らない。Wabun1Submissions は appendRow 常時実行のため
    //   ここをフォールバックとして必ず参照する。hpGained は HPLog からの集計値を温存。
    const wbSheet = ss.getSheetByName(SHEET_WABUN1_SUBMISSIONS);
    if (wbSheet && wbSheet.getLastRow() >= 2) {
      const rows = _readLastNRows(wbSheet, 2000);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue;
        if (String(r[1] || '').trim() !== sid) continue;
        const tsStr = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
        const ds = tsStr.slice(0, 10);
        if (!byDate[ds]) continue;
        byDate[ds].wabun1.done = true;
        // hpGained は HPLog 集計値（全問正解 + 初回付与時のみ）を維持。
        // 提出のみ（不正解含む）は hpGained = 0 のままで done だけ true。
      }
    }

    // ▼ KisoSessions: 提出があれば kiso.done=true（新規追加フォールバック）
    //   列構成: [0]sessionId [1]studentId [2]rank [3]count [4]questionIds [5]status
    //           [6]attempts [7]startedAt [8]completedAt [9]hpEarned [10]wrongIds [11]hasWorkPhoto [12]problemLatexes
    //   2026-05-15 バグ修正：submitKisoAnswer は passed 時のみ HPLog 書き込む。
    //   不合格セッションは status='failed_retry' で KisoSessions に残るが HPLog に出ない。
    //   ここをフォールバックとして使う。attempts > 0（提出した）かつ startedAt が範囲内なら done。
    //   セッション情報（rank, count）も sessions 配列に流し込み、表示に活用。
    const ksSheet = ss.getSheetByName(SHEET_KISO_SESSIONS);
    if (ksSheet && ksSheet.getLastRow() >= 2) {
      const rows = _readLastNRows(ksSheet, 2000);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (String(r[1] || '').trim() !== sid) continue;
        const attempts = Number(r[6]) || 0;
        if (attempts <= 0) continue;  // 0 回提出（in_progress 直後）はスキップ
        const startedAt = r[7];
        if (!startedAt) continue;
        const tsStr = Utilities.formatDate(new Date(startedAt), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
        const ds = tsStr.slice(0, 10);
        if (!byDate[ds]) continue;
        // 既に HPLog 経由で sessions が積まれていれば、KisoSessions ベースの sessions は追加しない
        // （重複表示を避ける。HPLog 側がより詳細な情報を持つため優先）。
        // HPLog なしのセッション（不合格・未完了）の場合のみ done=true セットアップ。
        const alreadyHasHpLogSession = byDate[ds].kiso.done && byDate[ds].kiso.sessions.length > 0;
        if (!alreadyHasHpLogSession) {
          byDate[ds].kiso.done = true;
          // HPLog 経由の sessions がない場合は KisoSessions から最低限の情報を流す
          const rank = Number(r[2]) || 0;
          const count = Number(r[3]) || 0;
          const status = String(r[5] || '');
          byDate[ds].kiso.sessions.push({
            rank:       rank,
            count:      count,
            isPractice: false,
            hpGained:   0,
            rawHP:      0,
            status:     status,  // 'in_progress' / 'passed' / 'failed_retry'
            attempts:   attempts
          });
        }
      }
    }

    // ▼ KanjiSubmissions: 提出があれば kanji.done=true（新規追加フォールバック）
    //   列構成: [0]timestamp [1]sid [2]level [3]sessionId [4]no [5]expected [6]studentWrote [7]isCorrect [8]readable
    //   2026-05-15 バグ修正：submitKanjiKaki は passed 時のみ HPLog 書き込むが、
    //   KanjiSubmissions は needsRetake でも 1 問ずつ appendRow される。
    //   1 セッション = 5〜10 行のため、行数は他より多めに 5000 を読む。
    //   level 値は '5' / '4' / '3' / '準2' / '2' のいずれか（kanji_yomi の levelKey を統一前提）。
    const kjSheet = ss.getSheetByName(SHEET_KANJI_SUBMISSIONS);
    if (kjSheet && kjSheet.getLastRow() >= 2) {
      const rows = _readLastNRows(kjSheet, 5000);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue;
        if (String(r[1] || '').trim() !== sid) continue;
        const tsStr = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
        const ds = tsStr.slice(0, 10);
        if (!byDate[ds]) continue;
        byDate[ds].kanji.done = true;
        // HPLog 経由でセッション情報が積まれていなければ、KanjiSubmissions から
        // セッション情報を 1 つだけ生成（複数行 = 同一セッションの可能性高、雑な重複防止）。
        const lv = String(r[2] || '').trim();
        const hasSessionForLevel = byDate[ds].kanji.sessions.some(function(s){ return s.level === lv; });
        if (lv && !hasSessionForLevel) {
          byDate[ds].kanji.sessions.push({
            level:      lv,
            count:      0,  // KanjiSubmissions からは count 推定困難
            isPractice: false,
            hpGained:   0,
            rawHP:      0
          });
        }
      }
    }

    // ▼ LisonSubmissions: level 補完（行数 500 → 2000 に拡張）
    //   列構成: [0]timestamp [1]studentId [2]studentName [3]level [4]weekStart [5]quizScore [6]recordingUrl [7]hpGained
    //   alreadyGranted（同日 2 回目以降）でも提出記録は残るので、HPLog に lison 行が無い日でも
    //   ここで done=true になる（保護者画面で「練習はした」が見える）
    const lsSheet = ss.getSheetByName(SHEET_LISON_SUBMISSIONS);
    if (lsSheet && lsSheet.getLastRow() >= 2) {
      const rows = _readLastNRows(lsSheet, 2000);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue;
        if (String(r[1] || '').trim() !== sid) continue;
        const tsStr = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
        const ds = tsStr.slice(0, 10);
        if (!byDate[ds]) continue;
        byDate[ds].lison.done = true;
        const level = String(r[3] || '').trim();
        if (level && byDate[ds].lison.levels.indexOf(level) < 0) {
          byDate[ds].lison.levels.push(level);
        }
      }
    }

    // ▼ kobun: 専用の Submissions シートが存在しないため、HPLog 単独依存のまま。
    //   不合格・途中放棄の活動は学習履歴に出ない。これは仕様（HP 付与時のみ記録）。
    //   将来 KobunSubmissions シートが追加された場合はここにフォールバックを追加すること。

    // 2026-05-11 バグ④ 修正：HP 獲得記録があるのにログイン ❌ 表示の矛盾解消。
    // 真因：HPLog の type='login' レコードのみで login フラグを判定していたため、
    // 何らかの事情で login レコードが欠落した日（過去の連続日数バグ #97-99 復旧前の日付・
    // 教育日切替前後の境界・手動編集・処理失敗等）に「HP 獲得済みなのにログイン❌」が
    // 表示されていた。HP 獲得は必ずログイン後に発生するという因果関係から、いずれかの
    // 学習活動が記録されている日は login=true を保証する（推論ベース）。
    // 既存の type='login' 直接ヒット経路は無修正なので、login レコードがある日は従来通り。
    Object.keys(byDate).forEach(function(ds){
      const d = byDate[ds];
      if (d.login) return;  // 既に true ならスキップ
      if (d.eitango.done || d.sango.done || d.wabun1.done || d.kiso.done || d.lison.done || d.kanji.done || d.kobun.done) {
        d.login = true;
      } else if (d.extras && d.extras.length > 0) {
        d.login = true;
      }
    });

    // 新しい順に配列化
    const days = [];
    for (let i = endDaysAgo; i <= startDaysAgo; i++) {
      days.push(byDate[_sangoDateAgo(i)]);
    }

    return { ok: true, offset: offset, days: days, hasMore: hasMore };
  } catch(err) {
    console.error('[getChildActivityRecent]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 和文英訳① 共通ヘルパー
// =============================================
const _WABUN1_DAY_OFFSET = { '月':0, '火':1, '水':2, '木':3, '金':4, '土':5, '日':6 };
const _WABUN1_FW_DIGITS = { '１':'1', '２':'2', '３':'3', '４':'4' };

// start(yyyy-MM-dd) から n 日後の JST 日付文字列
function _wabun1AddDays(startStr, n) {
  const d = new Date(startStr + 'T12:00:00+09:00');
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

// 正誤判定用: 表記ゆらぎを吸収して厳密判定する
// ■ 緩和（同一視する）
//   1. すべての空白文字を削除（半角/全角スペース・タブ・改行）
//   2. 全角英数を半角に統一
//   3. 日本語の装飾句読点「、」「。」「，」は削除（有無を判定対象外、英文 . , は厳格）
//      - 「，」(U+FF0C) は「、」と同等扱い（2026-04-30）。日本語 IME で全角コンマを
//        使う書き方も「、」と同じく装飾的とみなして判定対象外にする。
//   4. 類似句読点・記号を半角に統一（「．」⇔「.」、ハイフン類など）
// ■ 維持（厳格に判定）
//   - 文末ピリオド「.」(U+002E) は厳格判定（英文に必須）
//   - 半角コンマ「,」(U+002C) は厳格判定（英文に必須）
//   - 大文字小文字（2026-04-29 から厳格化）：学校テストの採点基準に合わせるため
//     toLowerCase を撤廃。文頭小文字 / 文中大文字は ❌ として判定される。
//     全角→半角変換は case を保持する（Ａ→A, ａ→a）。
function _normalizeWabun1(s) {
  if (s == null) return '';
  let t = String(s);
  // 0. モニョ表記の正規化（2026-05-02 追加）
  //    「モニョ」「モノョ」「モ二ョ」（ニ U+30CB / ノ U+30CE / 二 U+4E8C）を「モニョ」に統一。
  //    OCR の誤認識（ニ→ノ、ニ→二）を吸収するための救済処理。
  //    前後のカッコは「」『』""''""''（）()[] のいずれも有無を問わず吸収する。
  //    spec の `""` `''` は smart quotes（U+201C/D, U+2018/9）。straight quotes
  //    `"` (U+0022) と `'` (U+0027) も含めて test case 3「半角ダブルクオート」に対応。
  //    この後 punctMap で「→" 」→" に変換されるため、最終正規化形は `"モニョ"`。
  t = t.replace(/[「『""''"'(（\[]?\s*モ[ニノ二]ョ\s*[」』""''"')）\]]?/g, '「モニョ」');
  // 1. 全角英数を半角に（case は保持）
  t = t.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(ch){
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
  // 2. 日本語の句読点（、 。 ，）を削除（仕様：装飾的要素として判定対象外）
  //    「、」(U+3001) と「。」(U+3002) は日本語問題で必須でないため、有無を判定に
  //    影響させない。英語の「,」(U+002C) と「.」(U+002E) は引き続き厳格判定。
  //    全角コンマ「，」(U+FF0C) は「、」と同等扱い（2026-04-30 修正）。日本語 IME で
  //    全角コンマを使う書き方も「、」と同じく装飾的とみなし削除する。
  //    全角ピリオド「．」(U+FF0E) は次の punctMap で半角「.」に統一（英語ピリオド
  //    として扱う、日本語 IME の混入を英語句読点として救済）。
  t = t.replace(/[、。，]/g, '');
  // 3. 類似句読点・記号を半角に統一
  //    （「、」「。」「，」は前段で削除済みなので punctMap には含めない）
  const punctMap = {
    '．': '.',
    '？': '?', '！': '!',
    '：': ':', '；': ';',
    '（': '(', '）': ')',
    '［': '[', '］': ']',
    '｛': '{', '｝': '}',
    '「': '"', '」': '"', '『': '"', '』': '"',
    '“': '"', '”': '"',  // “ ”
    '‘': "'", '’': "'",  // ‘ ’
    'ー': '-', '−': '-', '－': '-', '‐': '-', '‑': '-', '–': '-', '—': '-'
  };
  t = t.replace(/[．？！：；（）［］｛｝「」『』“”‘’ー−－‐‑–—]/g, function(ch){
    return punctMap[ch] || ch;
  });
  // 3. すべての空白文字を削除（半角/全角スペース・タブ・改行・その他 Unicode 空白）
  //    生徒が紙の幅で改行して書く（"Africa is\nfor my\nfamily"）→ OCR が改行込みで
  //    返してくるケースを救済するため、改行（\n / \r\n / \r）も含めてすべて吸収する。
  //    \s は \f\n\r\t\v + 通常空白 + 多くの Unicode 空白（U+00A0 NBSP 含む）にマッチ。
  //    防御的に、OCR が稀に挟む zero-width 系の不可視文字（U+200B〜200D / U+FEFF /
  //    U+2060 word-joiner）も併せて削除（\s ではマッチしないため明示）。
  t = t.replace(/[\s　​‌‍⁠﻿]+/g, '');
  // 大文字小文字は厳格判定のため lowercasing しない（2026-04-29 仕様変更）
  return t;
}

// OCR テキストから番号区切りで各タスクの解答を抽出
// 対応マーカー: "1." "1．" "1," "1、" "1)" "1）" "(1)" "（1）"（半角/全角数字に対応）
// 案D（2026-04-29）：(?=\s) 先読みを削除して明示的な区切り記号を必須化。
//   旧仕様では "There are 4\napples" のように答え本文中の数字 1-4 が
//   行頭・空白先読みで誤って問題番号と認識される事故があった。
//   現仕様：番号の後に . / ． / , / 、 / ) / ） / カッコ括り のいずれかが必須。
//   フロント _wabun1CheckNumbers / _wabun1ParseWork と regex を統一。
function _parseWabun1Work(text) {
  const out = { 1:'', 2:'', 3:'', 4:'' };
  if (!text) return out;
  const t = '\n' + String(text);
  const re = /\n\s*(?:[(（]\s*([1-4１-４])\s*[)）]|([1-4１-４])[.．,、)）])\s*/g;
  const markers = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    const raw = m[1] || m[2];
    const no = Number(_WABUN1_FW_DIGITS[raw] || raw);
    if (no >= 1 && no <= 4) {
      markers.push({ no: no, markerPos: m.index, contentStart: re.lastIndex });
    }
  }
  for (let i = 0; i < markers.length; i++) {
    const end = (i + 1 < markers.length) ? markers[i + 1].markerPos : t.length;
    // 同じ番号が複数回出たら最後の出現を採用
    out[markers[i].no] = t.substring(markers[i].contentStart, end).trim();
  }
  return out;
}

// =============================================
// 不正解理由の自動分類（採点結果画面で生徒に表示）
// =============================================
// 戻り値: { type: 'no_answer'|'monyo_missing'|'contraction'|'period_missing'
//          |'comma_missing'|'case_mismatch'|'spelling'|'other',
//          message: 生徒向け自然言語 }
//
// 優先順は CLAUDE.md「採点正規化関数の仕様 / feedbackType 8 分類」を参照。
// 上から判定して最初に該当したものを返す。
// 注: 旧 fullstop_missing は _normalizeWabun1 で「。」を削除する仕様変更
//     （日本語句読点を判定対象外にする 2026-04-30 修正）に伴い廃止。
//     「。」が両方の文字列から削除されるため、末尾「。」抜けは correct 扱いに。
// 追記: monyo_missing は 2026-05-02 追加。正解にモニョ表記があるのに生徒の答案に
//       ない場合、ピリオド/カンマ系より優先して通知する。
function _wabun1ClassifyFeedback(studentRaw, studentNorm, correctRaw, correctNorm, divergeAt) {
  // 1. no_answer: 生徒の答えが空（OCR で読み取れず or パースで取れず）
  if (!studentNorm || studentNorm.length === 0) {
    return { type: 'no_answer', message: '答えが読み取れませんでした。OCR の認識を確認してください' };
  }
  // 2. monyo_missing: 正解にモニョ表記があるのに生徒の答案には無い（2026-05-02 追加）
  //    _normalizeWabun1 でモニョ変種は「モニョ」→ punctMap で `"モニョ"` に統一されている。
  //    また raw 文字列上で「モ + (ニ|ノ|二) + ョ」を検出することで、未正規化段階での
  //    モニョ有無もカバーする（カッコ無しで書いた場合等を含む）。
  const monyoCoreRe = /モ[ニノ二]ョ/;
  if (monyoCoreRe.test(String(correctRaw || '')) && !monyoCoreRe.test(String(studentRaw || ''))) {
    return { type: 'monyo_missing', message: '「モニョ」と書く部分が抜けています' };
  }
  // 3. contraction: studentRaw に短縮形パターン（' or ’ + 1〜3 文字英字）あり
  //    かつ correctRaw には無い（正解側に "John's" 等がある場合は対象外）
  const contractionRe = /['’][a-z]{1,3}\b/i;
  if (contractionRe.test(String(studentRaw || '')) && !contractionRe.test(String(correctRaw || ''))) {
    return { type: 'contraction', message: '短縮形（don\'t や isn\'t など）はここでは使えません' };
  }
  // 4. period_missing: 末尾の半角ピリオドが抜けている（英語問題のみ。日本語の「。」は
  //    _normalizeWabun1 で両方から削除されるためここに到達しない）
  if (studentNorm + '.' === correctNorm) {
    return { type: 'period_missing', message: '末尾のピリオド「.」が抜けています' };
  }
  // 5. comma_missing: カンマ全削除で一致 + 正解側のほうがカンマが多い（英語問題のみ。
  //    日本語の「、」「，」は _normalizeWabun1 で両方から削除されるため誤分類されない）
  const stripComma = function(s){ return String(s || '').replace(/,/g, ''); };
  const studentCommaCount = (studentNorm.match(/,/g) || []).length;
  const correctCommaCount = (correctNorm.match(/,/g) || []).length;
  if (correctCommaCount > studentCommaCount && stripComma(studentNorm) === stripComma(correctNorm)) {
    return { type: 'comma_missing', message: 'カンマ「,」が抜けています' };
  }
  // 6. case_mismatch: 大文字小文字を無視すれば一致
  if (studentNorm.length === correctNorm.length
      && studentNorm.toLowerCase() === correctNorm.toLowerCase()
      && studentNorm !== correctNorm) {
    return { type: 'case_mismatch', message: '大文字・小文字が違います' };
  }
  // 7. spelling: divergeAt > 1 かつ長さの差が 5 以下（おおむね同じ長さで部分的に違う）
  //    位置は「文の前半 / 中ほど / 後半」の大まか表現で示す
  const lenDiff = Math.abs(studentNorm.length - correctNorm.length);
  if (divergeAt > 1 && lenDiff <= 5) {
    const cn = correctNorm.length || 1;
    let pos;
    if      (divergeAt < cn / 3)         pos = '文の前半';
    else if (divergeAt < (cn * 2) / 3)   pos = '文の中ほど';
    else                                  pos = '文の後半';
    return { type: 'spelling', message: pos + 'にスペルミスの可能性があります' };
  }
  // 8. other: 上記いずれにも当てはまらない
  return { type: 'other', message: '正解と違う部分があります。もう一度確認してください' };
}

// Wabun1Topics から指定日の 1 行を読み込む（ヒットなしで null）
// Wabun1Topics シート全体をキャッシュ経由で取得（6h TTL、書き込み系でクリア）
function _getWabun1TopicsValues() {
  return _getCachedValues('cache_wabun1_topics_values', 21600, function() {
    const sh = _ss().getSheetByName(SHEET_WABUN1_TOPICS);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getDataRange().getValues();
  });
}

// 13列スキーマ（v2）対応のヘッダー解決ヘルパー
// 列名から列インデックスを引く。新仕様（japanese_text / skip_text）と
// 旧仕様（skip1..4）の両方を扱えるように吸収する
// skip_questions（スキップ可能な問題番号の JSON 配列、例 [3,4]）は v2.1 で追加。
// 既存シートに列がない場合は indexOf=-1 のまま、_wabun1RowToObj で空配列扱い。
function _wabun1HeaderIndices(header) {
  const iSkipText = header.indexOf('skip_text');
  const iSkipLegacy = [1,2,3,4].map(function(n){ return header.indexOf('skip' + n); });
  return {
    iDate:     header.indexOf('date'),
    iWN:       header.indexOf('week_no'),
    iT:        [1,2,3,4].map(function(n){ return header.indexOf('task' + n); }),
    iJP:       header.indexOf('japanese_text'),
    iA:        [1,2,3,4].map(function(n){ return header.indexOf('answer' + n); }),
    iSkipText:      iSkipText,
    iSkipLegacy:    iSkipLegacy,
    iSkipQuestions: header.indexOf('skip_questions'),
    iWL:       header.indexOf('word_list')
  };
}

// スキップ番号配列の正規化: 文字列 / 配列 / null を [1-4] の Number 配列に変換
// - JSON 文字列の場合は parse、失敗時は空配列
// - "3,4" 形式（カンマ区切り）も許容
// - 1〜4 の範囲外は除外、重複排除、昇順ソート
function _normalizeWabun1SkipList(raw) {
  if (raw == null || raw === '') return [];
  let arr = raw;
  if (typeof raw === 'string') {
    const s = String(raw).trim();
    if (!s) return [];
    try {
      arr = JSON.parse(s);
    } catch (e) {
      // カンマ区切りフォールバック
      arr = s.replace(/[\[\]\s]/g, '').split(',');
    }
  }
  if (!Array.isArray(arr)) return [];
  const seen = {};
  const out = [];
  arr.forEach(function(v){
    const n = Number(v);
    if (!(n >= 1 && n <= 4)) return;
    const k = Math.floor(n);
    if (seen[k]) return;
    seen[k] = true;
    out.push(k);
  });
  out.sort(function(a, b){ return a - b; });
  return out;
}

// 1 行を構造化オブジェクトに変換
function _wabun1RowToObj(r, h) {
  const tasksAll = [1,2,3,4].map(function(n, idx){
    return {
      no: n,
      text: h.iT[idx] >= 0 ? String(r[h.iT[idx]] || '').trim() : ''
    };
  });
  const tasks = tasksAll.filter(function(t){ return !!t.text; });
  const rawAnswers = [0,1,2,3].map(function(idx){
    return h.iA[idx] >= 0 ? String(r[h.iA[idx]] || '').trim() : '';
  });
  const answers = tasks.map(function(t){ return rawAnswers[t.no - 1]; });

  // skip_text は新仕様で 1 列。旧 skip1..4 が残っている場合は最初に値があるものを採用
  let skipText = h.iSkipText >= 0 ? String(r[h.iSkipText] || '').trim() : '';
  if (!skipText) {
    for (let i = 0; i < 4; i++) {
      if (h.iSkipLegacy[i] >= 0) {
        const s = String(r[h.iSkipLegacy[i]] || '').trim();
        if (s) { skipText = s; break; }
      }
    }
  }

  const wlRaw = h.iWL >= 0 ? String(r[h.iWL] || '').trim() : '';
  const word_list = wlRaw ? wlRaw.split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean) : [];
  const skipQuestions = (h.iSkipQuestions >= 0)
    ? _normalizeWabun1SkipList(r[h.iSkipQuestions])
    : [];
  const ds = Utilities.formatDate(new Date(r[h.iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
  return {
    date: ds,
    week_no: h.iWN >= 0 ? String(r[h.iWN] || '').trim() : '',
    tasks: tasks,
    answers: answers,
    japanese_text: h.iJP >= 0 ? String(r[h.iJP] || '').trim() : '',
    skip_text: skipText,
    skip_questions: skipQuestions,
    word_list: word_list
  };
}

function _readWabun1TopicsByDate(dateStr) {
  const values = _getWabun1TopicsValues();
  if (values.length < 2) return null;
  const h = _wabun1HeaderIndices(values[0]);
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[h.iDate]) continue;
    const ds = Utilities.formatDate(new Date(r[h.iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
    if (ds !== dateStr) continue;
    return _wabun1RowToObj(r, h);
  }
  return null;
}

// =============================================
// 生徒用：今日の問題と前日の正解を取得
// today には answers を含めない（漏洩防止）
// =============================================
function getWabun1Topic(params) {
  try {
    const today = _sangoToday();
    const yest  = _sangoPrevDate(today);
    const t = _readWabun1TopicsByDate(today);
    const y = _readWabun1TopicsByDate(yest);
    const todayOut = t ? {
      date: t.date,
      week_no: t.week_no,
      tasks: t.tasks,
      japanese_text: t.japanese_text,
      skip_text: t.skip_text,
      skip_questions: t.skip_questions || [],
      word_list: t.word_list
    } : null;
    const yesterdayOut = y ? {
      date: y.date,
      tasks: y.tasks.map(function(tk){ return { no: tk.no, text: tk.text }; }),
      japanese_text: y.japanese_text,
      skip_text: y.skip_text,
      skip_questions: y.skip_questions || [],
      answers: y.answers
    } : null;
    return { ok: true, today: todayOut, yesterday: yesterdayOut };
  } catch(err) {
    console.error('[getWabun1Topic]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 生徒用：解答提出（完全一致判定 + HP加算 + 記録）
// params: { studentId, workText, parsedAnswers?, skipQuestions? }
//   - parsedAnswers: 案C（2026-04-29 導入）。フロント側でパース済みの問題別答え
//                    JSON 文字列 {"1":"...","2":"...","3":"...","4":"..."}
//                    与えられたら GAS 側の _parseWabun1Work をスキップして
//                    そのまま採点に使う（確認画面表示と判定入力を完全一致）
//                    無ければ workText から従来通り _parseWabun1Work で抽出（後方互換）
//   - skipQuestions: 生徒が「スキップする」を押した問題番号配列
//                    （JSON 文字列 / 配列 / カンマ区切り文字列を許容）
//                    topic.skip_questions（許可リスト）と突合し、許可されたもののみ採用。
//                    スキップ済みの問題は空欄でも自動的に正解扱い + skipped:true。
// =============================================
function submitWabun1(params) {
  try {
    const sid      = String((params && params.studentId) || '').trim();
    const workText = String((params && params.workText)  || '').trim();
    if (!sid || !workText) return { ok: false, message: '必要な情報が不足しています' };

    const todayStr = _sangoToday();
    const topic = _readWabun1TopicsByDate(todayStr);
    if (!topic || topic.tasks.length === 0) {
      return { ok: false, message: '今日の和文英訳①の問題が登録されていません' };
    }

    // スキップ番号を正規化 + 許可リスト（topic.skip_questions）で絞り込み
    // 生徒が許可外の番号を送ってきても無視して採点対象に戻す（ずる対策）
    const requestedSkips = _normalizeWabun1SkipList(params && params.skipQuestions);
    const allowedSet = {};
    (topic.skip_questions || []).forEach(function(n){ allowedSet[n] = true; });
    const appliedSkips = requestedSkips.filter(function(n){ return allowedSet[n]; });
    const skipSet = {};
    appliedSkips.forEach(function(n){ skipSet[n] = true; });

    // 案C：フロントから parsedAnswers が来ていればそれを優先採用。
    // 無ければ従来通り workText から GAS 側で _parseWabun1Work してフォールバック。
    let parsed = null;
    const rawParsed = params && params.parsedAnswers;
    if (rawParsed) {
      try {
        const obj = (typeof rawParsed === 'string') ? JSON.parse(rawParsed) : rawParsed;
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          parsed = {
            1: String(obj['1'] != null ? obj['1'] : (obj[1] != null ? obj[1] : '')),
            2: String(obj['2'] != null ? obj['2'] : (obj[2] != null ? obj[2] : '')),
            3: String(obj['3'] != null ? obj['3'] : (obj[3] != null ? obj[3] : '')),
            4: String(obj['4'] != null ? obj['4'] : (obj[4] != null ? obj[4] : ''))
          };
        }
      } catch(e) {
        console.warn('[submitWabun1] parsedAnswers JSON parse failed, falling back to workText parse', e);
      }
    }
    if (!parsed) parsed = _parseWabun1Work(workText);

    const results = topic.tasks.map(function(t, idx){
      if (skipSet[t.no]) {
        return { no: t.no, correct: true, skipped: true };
      }
      const studentRaw = String(parsed[t.no] != null ? parsed[t.no] : '');
      const correctRaw = String(topic.answers[idx] != null ? topic.answers[idx] : '');
      const studentNorm = _normalizeWabun1(studentRaw);
      const correctNorm = _normalizeWabun1(correctRaw);
      const correct = correctNorm !== '' && studentNorm === correctNorm;
      if (correct) return { no: t.no, correct: true };

      // 不正解時：divergeAt を計算 → 診断ログ → 教育的フィードバック
      let divergeAt = 0;
      while (divergeAt < studentNorm.length && divergeAt < correctNorm.length
             && studentNorm.charCodeAt(divergeAt) === correctNorm.charCodeAt(divergeAt)) divergeAt++;

      // 診断ログ：判定失敗時に正規化後文字列を Apps Script ログに残す。
      // 「改行のはずなのに ❌」「ピリオド見落としで ❌」「不可視文字混入で ❌」など真因切り分け用。
      // CLAUDE.md「採点正規化関数の仕様」セクション参照。
      if (correctNorm !== '') {
        const codeAtStudent = (divergeAt < studentNorm.length)
          ? 'U+' + studentNorm.charCodeAt(divergeAt).toString(16).toUpperCase().padStart(4, '0')
          : '(end)';
        const codeAtCorrect = (divergeAt < correctNorm.length)
          ? 'U+' + correctNorm.charCodeAt(divergeAt).toString(16).toUpperCase().padStart(4, '0')
          : '(end)';
        const trunc = function(s, n) {
          const str = String(s == null ? '' : s);
          return str.length <= n ? str : str.substring(0, n) + '...(' + str.length + ')';
        };
        console.log('[submitWabun1 ❌]'
          + ' sid=' + sid
          + ' no=' + t.no
          + ' divergeAt=' + divergeAt
          + ' codeStudent=' + codeAtStudent
          + ' codeCorrect=' + codeAtCorrect
          + ' studentNorm=' + JSON.stringify(studentNorm)
          + ' correctNorm=' + JSON.stringify(correctNorm)
          + ' parsedRaw='   + JSON.stringify(trunc(studentRaw, 200))
          + ' canonicalRaw=' + JSON.stringify(trunc(correctRaw, 200))
          + ' workTextRaw=' + JSON.stringify(trunc(workText, 300)));
      }
      // フィードバック分類（正解と違う部分の自動解析）
      const fb = _wabun1ClassifyFeedback(studentRaw, studentNorm, correctRaw, correctNorm, divergeAt);
      return {
        no:              t.no,
        correct:         false,
        studentRaw:      studentRaw,
        correctRaw:      correctRaw,
        studentNorm:     studentNorm,
        correctNorm:     correctNorm,
        divergeAt:       divergeAt,
        feedbackType:    fb.type,
        feedbackMessage: fb.message
      };
    });
    const allCorrect = results.length > 0 && results.every(function(r){ return r.correct; });

    const ss = _ss();
    // 2026-05-09 Step 0：行シフト事故防止のため、書き込み対象行はシートから sid で
    // フレッシュに特定する（cache 経由禁止）。
    const stuLoc = _findAccountRowOnSheet(sid);
    if (!stuLoc) return { ok: false, message: 'Studentsシートが見つかりません' };
    const studentName = String(stuLoc.rowValues[COL_NICKNAME] || '').trim() || '名無し';

    // 提出は毎回記録（正誤問わず）
    // 列構成: timestamp(1) | studentId(2) | studentName(3) | work(4) | method(5)
    //         | teacher_comment(6) | skip_questions(7)
    // skip_questions 列が未作成のシートは appendRow で自動的に右側に値が追加される。
    // ヘッダー行に列名がない既存シートでもデータとしては正しく保存される。
    const subSheet = ss.getSheetByName(SHEET_WABUN1_SUBMISSIONS);
    if (!subSheet) return { ok: false, message: 'Wabun1Submissionsシートが見つかりません' };
    const now = new Date();
    const skipJson = appliedSkips.length > 0 ? JSON.stringify(appliedSkips) : '';
    subSheet.appendRow([now, sid, studentName, workText, 'photo', '', skipJson]);

    // HPLog type='wabun1' で当日分既に付与済みか確認（末尾 200 行のみ走査）
    // HPLog 列構成（rawHP 追加後）：[0]timestamp [1]studentId [2]rawHP [3]hpGained [4]type
    let alreadyGranted = false;
    const logSheet = ss.getSheetByName(SHEET_HPLOG);
    if (logSheet) {
      const logRows = _readLastNRows(logSheet, 200);
      for (let i = 0; i < logRows.length; i++) {
        if (String(logRows[i][1]).trim() !== sid) continue;
        if (logRows[i][4] !== 'wabun1') continue;
        const todayForLog = (function(ts){
          const dt = new Date(ts); dt.setHours(dt.getHours() - 3);
          return Utilities.formatDate(dt, 'Asia/Tokyo', 'yyyy-MM-dd');
        })(logRows[i][0]);
        if (todayForLog === todayStr) { alreadyGranted = true; break; }
      }
    }

    let hpGained = 0;
    if (allCorrect && !alreadyGranted) {
      const streak = Number(stuLoc.rowValues[COL_STREAK]) || 1;
      const week = Math.ceil(streak / 7);
      // 素点HP は 2026-04-29 以降の教育日から 100 → 200 に変更（4/29 当日含む、過去分は遡及しない）
      // todayStr は _sangoToday() の JST 3 時区切り。問題の日替わり・alreadyGranted 判定と同じ基準で揃える
      const baseHp = (todayStr >= '2026-04-29') ? 200 : 100;
      hpGained = baseHp * week * week;

      // 2026-05-12 バグ④-本質 Phase B（案 A）：書き込み順序を _logHP → Students に変更。
      // HPLog 書き込み失敗時は Students.HP を加算せず、提出は受理した状態でエラー応答を返す。
      // Wabun1Submissions は appendRow 済み（提出記録は保持）。
      const logRes = _logHP(sid, hpGained, hpGained, 'wabun1');
      if (!logRes.ok) {
        console.error('[submitWabun1] HPLog 書き込みに失敗しました。HP を加算せず終了。', logRes.error);
        return { ok: false, message: '内部エラーが発生しました。もう一度試してください。', errorCode: 'HP_LOG_FAILED' };
      }

      const cur = Number(stuLoc.rowValues[COL_HP]) || 0;
      const newHP = cur + hpGained;
      stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_HP + 1).setValue(newHP);
      const upd = {};
      upd[COL_HP] = newHP;
      _updateAccountCacheBySid(sid, upd);
      _invalidateCache('cache_ranking_last_week');
    }

    return {
      ok: true,
      allCorrect: allCorrect,
      results: results,
      hpGained: hpGained,
      alreadyGranted: alreadyGranted,
      appliedSkips: appliedSkips
    };
  } catch(err) {
    console.error('[submitWabun1]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 生徒用：自分の和文英訳①提出履歴（新しい順）
// =============================================
function getWabun1Submissions(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    const sh = _ss().getSheetByName(SHEET_WABUN1_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, submissions: [] };
    const values = sh.getDataRange().getValues();
    const submissions = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[0]) continue;
      if (String(r[1] || '').trim() !== sid) continue;
      const tsStr = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      submissions.push({
        timestamp:       tsStr,
        date:            tsStr.slice(0, 10),
        studentId:       sid,
        studentName:     String(r[2] || ''),
        work:            String(r[3] || ''),
        method:          String(r[4] || ''),
        teacher_comment: String(r[5] || ''),
        skip_questions:  _normalizeWabun1SkipList(r[6])
      });
    }
    submissions.sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });
    return { ok: true, submissions: submissions };
  } catch(err) {
    console.error('[getWabun1Submissions]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 共通ヘルパー：JST 3時切替基準の日付文字列（timestamp が 3時より前なら前日扱い）
// submitWabun1 の alreadyGranted 判定と同じロジック
// =============================================
function _wabun1LogDate(ts) {
  const d = new Date(ts);
  d.setHours(d.getHours() - 3);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

// 指定 studentId が提出した日付の Set を返す（3時切替基準）
function _wabun1SubmittedDatesBySid(sid) {
  const set = {};
  const sh = _ss().getSheetByName(SHEET_WABUN1_SUBMISSIONS);
  if (!sh || sh.getLastRow() < 2) return set;
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) continue;
    if (String(r[1] || '').trim() !== sid) continue;
    set[_wabun1LogDate(r[0])] = true;
  }
  return set;
}

// Wabun1Topics から日付範囲で 1 回スキャン。各行を tasks/answers/word_list 構造に整形して返す
function _readWabun1TopicsByDateRange(startStr, endStr) {
  const values = _getWabun1TopicsValues();
  if (values.length < 2) return [];
  const h = _wabun1HeaderIndices(values[0]);
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[h.iDate]) continue;
    const ds = Utilities.formatDate(new Date(r[h.iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
    if (ds < startStr || ds > endStr) continue;
    out.push(_wabun1RowToObj(r, h));
  }
  return out;
}

// 日付降順 + 曜日付与してレスポンス形状に整形
function _buildWabun1TopicsByDate(rows) {
  const sorted = rows.slice().sort(function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return sorted.map(function(r) {
    const wd = _SANGO_WEEKDAYS_JP[new Date(r.date + 'T12:00:00+09:00').getDay()];
    return {
      date: r.date,
      weekday: wd,
      week_no: r.week_no,
      tasks: r.tasks,
      answers: r.answers,
      japanese_text: r.japanese_text,
      skip_text: r.skip_text,
      skip_questions: r.skip_questions || [],
      word_list: r.word_list
    };
  });
}

// =============================================
// 生徒用：提出済みの場合のみ今日の正解を返す（運用ポリシー：一度解いた問題はいつでも正解が見られる）
// params: { studentId }
// =============================================
function getWabun1AnswersAfterSubmit(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, error: '生徒IDが指定されていません' };
    const today = _sangoToday();
    const submittedSet = _wabun1SubmittedDatesBySid(sid);
    if (!submittedSet[today]) {
      return { ok: false, error: 'まだ今日の問題を提出していないため、正解を表示できません。' };
    }
    const topic = _readWabun1TopicsByDate(today);
    if (!topic || !topic.tasks || topic.tasks.length === 0) {
      return { ok: false, error: '本日の問題が登録されていません' };
    }
    return { ok: true, answers: topic.answers, date: today };
  } catch(err) {
    console.error('[getWabun1AnswersAfterSubmit]', err);
    return { ok: false, error: String(err) };
  }
}

// =============================================
// 生徒用：過去の問題と正解（直近1週間）
// 提出有無に関わらず Wabun1Topics の全データを返す（三語短文と挙動を統一）
// params: なし（studentId は受け取るが利用しない＝後方互換）
// =============================================
function getWabun1PastTopicsRecent(params) {
  try {
    const endStr   = _sangoDateAgo(1);
    const startStr = _sangoDateAgo(7);
    const rows = _readWabun1TopicsByDateRange(startStr, endStr);
    return { ok: true, topics: _buildWabun1TopicsByDate(rows) };
  } catch(err) {
    console.error('[getWabun1PastTopicsRecent]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 生徒用：過去の問題と正解（1週間単位のページング）
// weekOffset=1 → 14日前〜8日前 / weekOffset=2 → 21日前〜15日前 ...
// 提出有無に関わらず Wabun1Topics の全データを返す（三語短文と挙動を統一）
// params: { weekOffset }（studentId は受け取るが利用しない＝後方互換）
// =============================================
function getWabun1PastTopicsPaged(params) {
  try {
    const weekOffset = Math.max(1, Number((params && params.weekOffset) || 1) | 0);
    const endStr   = _sangoDateAgo(weekOffset * 7 + 1);
    const startStr = _sangoDateAgo(weekOffset * 7 + 7);
    const rows = _readWabun1TopicsByDateRange(startStr, endStr);
    const nextEnd   = _sangoDateAgo((weekOffset + 1) * 7 + 1);
    const nextStart = _sangoDateAgo((weekOffset + 1) * 7 + 7);
    const nextRows = _readWabun1TopicsByDateRange(nextStart, nextEnd);
    return {
      ok: true,
      weekOffset: weekOffset,
      topics: _buildWabun1TopicsByDate(rows),
      hasMore: nextRows.length > 0
    };
  } catch(err) {
    console.error('[getWabun1PastTopicsPaged]', err);
    return { ok: false, message: String(err) };
  }
}

// kind 文字列を正規化：全角数字→半角、'スキップN' / 'スキップ' → 'スキップ'（番号は無視）
// 戻り値は許容種別の正規形（'問題1'..'問題4' / '日本文' / '正解1'..'正解4' / 'スキップ' / '単語'）。
// 不明な種別は空文字を返す。
function _wabun1NormalizeKind(rawKind) {
  let k = String(rawKind == null ? '' : rawKind).trim();
  if (!k) return '';
  // 全角数字を半角化
  k = k.replace(/[１-４]/g, function(c){ return _WABUN1_FW_DIGITS[c] || c; });
  if (/^問題[1-4]$/.test(k)) return k;
  if (k === '日本文') return '日本文';
  if (/^正解[1-4]$/.test(k)) return k;
  if (/^スキップ[1-4]?$/.test(k)) return 'スキップ';
  if (k === '単語') return '単語';
  return '';
}

// =============================================
// 管理画面：和文英訳① 週単位一括登録（縦→横変換、新仕様 13 列）
// params: { password, start, weekNo, items:[{day, kind, content}...] }
//   kind の許容: '問題1'..'問題4' / '日本文' / 'スキップ'(N省略可) / '単語' / '正解1'..'正解4'
// 同じ date の行が既にある場合は上書き、なければ末尾に追加（部分投入を許容）
// =============================================
function adminAddWabun1TopicsWeek(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    const start = String(params.start || '').trim();
    const weekNo = (params.weekNo == null || params.weekNo === '') ? '' : params.weekNo;
    const items = params.items || [];
    if (!start) return { ok: false, message: '週開始日(start)が必要です' };
    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, message: '登録するデータがありません' };
    }

    // 曜日ごとにバケット
    const byDay = {};
    items.forEach(function(it){
      const day  = String((it && it.day)  || '').trim();
      const kind = _wabun1NormalizeKind((it && it.kind) || '');
      const content = String((it && it.content) == null ? '' : it.content);
      if (!(day in _WABUN1_DAY_OFFSET)) return;
      if (!kind) return; // 未知の種別は無視
      if (!byDay[day]) byDay[day] = { tasks: ['','','',''], japanese_text: '', skip_text: '', answers: ['','','',''], words: [] };
      if      (kind === '問題1')     byDay[day].tasks[0]   = content;
      else if (kind === '問題2')     byDay[day].tasks[1]   = content;
      else if (kind === '問題3')     byDay[day].tasks[2]   = content;
      else if (kind === '問題4')     byDay[day].tasks[3]   = content;
      else if (kind === '日本文')    byDay[day].japanese_text = content;
      else if (kind === 'スキップ')  byDay[day].skip_text  = content;
      else if (kind === '正解1')     byDay[day].answers[0] = content;
      else if (kind === '正解2')     byDay[day].answers[1] = content;
      else if (kind === '正解3')     byDay[day].answers[2] = content;
      else if (kind === '正解4')     byDay[day].answers[3] = content;
      else if (kind === '単語' && content) byDay[day].words.push(content);
    });

    // 行データ組み立て（部分投入を許容するので問題1 空でもエラーにせず警告で扱う）
    const errors = [];
    const rowsByDate = {};
    Object.keys(byDay).forEach(function(day){
      const data = byDay[day];
      const date = _wabun1AddDays(start, _WABUN1_DAY_OFFSET[day]);
      if (!data.tasks[0]) {
        errors.push(day + '曜日(' + date + ')：問題1が空です（書き込みスキップ）');
        return;
      }
      // 13 列：date | week_no | task1 | japanese_text | task2 | task3 | task4 | skip_text | word_list | answer1..4
      rowsByDate[date] = [
        date, weekNo,
        data.tasks[0], data.japanese_text, data.tasks[1], data.tasks[2], data.tasks[3],
        data.skip_text,
        data.words.join('\n'),
        data.answers[0], data.answers[1], data.answers[2], data.answers[3]
      ];
    });

    const dates = Object.keys(rowsByDate);
    if (dates.length === 0) {
      return { ok: false, message: '有効な行がありません', errors: errors };
    }

    const sh = _ss().getSheetByName(SHEET_WABUN1_TOPICS);
    if (!sh) return { ok: false, message: 'Wabun1Topicsシートが見つかりません' };

    // 既存行を date でルックアップして同じ日付なら上書き、なければ追加
    let updated = 0;
    let added = 0;
    const existingMap = {};
    if (sh.getLastRow() >= 2) {
      const values = sh.getDataRange().getValues();
      const iDate = values[0].indexOf('date');
      if (iDate >= 0) {
        for (let i = 1; i < values.length; i++) {
          if (!values[i][iDate]) continue;
          const ds = Utilities.formatDate(new Date(values[i][iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
          existingMap[ds] = i + 1; // シート上の行番号（1-indexed）
        }
      }
    }
    const appendRows = [];
    dates.forEach(function(date){
      const row = rowsByDate[date];
      if (existingMap[date]) {
        sh.getRange(existingMap[date], 1, 1, row.length).setValues([row]);
        updated++;
      } else {
        appendRows.push(row);
      }
    });
    if (appendRows.length > 0) {
      const startRow = sh.getLastRow() + 1;
      sh.getRange(startRow, 1, appendRows.length, appendRows[0].length).setValues(appendRows);
      added = appendRows.length;
    }
    _invalidateCache('cache_wabun1_topics_values');
    return { ok: true, added: added, updated: updated, errors: errors };
  } catch(err) {
    console.error('[adminAddWabun1TopicsWeek]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 管理画面：和文英訳① 正解の週単位一括登録
// params: { password, start, items:[{day, kind:'正解1'..'正解4', content}] }
// 既存の Wabun1Topics 該当行の answer1..4 を更新
// =============================================
function adminSetWabun1AnswerWeek(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    const start = String(params.start || '').trim();
    const items = params.items || [];
    if (!start) return { ok: false, message: '週開始日(start)が必要です' };
    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, message: '登録するデータがありません' };
    }

    const byDay = {};
    items.forEach(function(it){
      const day  = String((it && it.day)  || '').trim();
      const kind = String((it && it.kind) || '').trim();
      const content = String((it && it.content) == null ? '' : it.content);
      if (!(day in _WABUN1_DAY_OFFSET)) return;
      if (!byDay[day]) byDay[day] = ['','','',''];
      if      (kind === '正解1') byDay[day][0] = content;
      else if (kind === '正解2') byDay[day][1] = content;
      else if (kind === '正解3') byDay[day][2] = content;
      else if (kind === '正解4') byDay[day][3] = content;
    });

    const sh = _ss().getSheetByName(SHEET_WABUN1_TOPICS);
    if (!sh || sh.getLastRow() < 2) {
      return { ok: false, message: 'Wabun1Topicsに登録がありません。先に週単位一括登録をしてください' };
    }
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iDate = header.indexOf('date');
    const iA = [1,2,3,4].map(function(n){ return header.indexOf('answer' + n); });

    let updated = 0;
    const errors = [];
    Object.keys(byDay).forEach(function(day){
      const date = _wabun1AddDays(start, _WABUN1_DAY_OFFSET[day]);
      const answers = byDay[day];
      let found = false;
      for (let i = 1; i < values.length; i++) {
        if (!values[i][iDate]) continue;
        const ds = Utilities.formatDate(new Date(values[i][iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
        if (ds !== date) continue;
        for (let k = 0; k < 4; k++) {
          if (iA[k] >= 0) sh.getRange(i + 1, iA[k] + 1).setValue(answers[k]);
        }
        updated++;
        found = true;
        break;
      }
      if (!found) errors.push(day + '曜日(' + date + ')：該当する問題行が見つかりません');
    });

    if (updated > 0) _invalidateCache('cache_wabun1_topics_values');
    return { ok: true, updated: updated, errors: errors };
  } catch(err) {
    console.error('[adminSetWabun1AnswerWeek]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 管理画面：和文英訳① 提出一覧（新しい順）
// params: { password, date?, studentId? } 両方省略可
// =============================================
function adminListWabun1Submissions(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const filterDate = String((params && params.date) || '').trim();
    const filterSid  = String((params && params.studentId) || '').trim();

    const sh = _ss().getSheetByName(SHEET_WABUN1_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, submissions: [] };

    // Step 2：全アカウント対象（Students + SpecialAccounts）。テスト枠の提出も生徒名表示できるように。
    const nameMap = {};
    const stuRows = _getAllAccountsValues();
    if (stuRows && stuRows.length >= 2) {
      for (let i = 1; i < stuRows.length; i++) {
        const sid = String(stuRows[i][COL_ID] || '').trim();
        if (!sid) continue;
        nameMap[sid] = String(stuRows[i][COL_NAME] || '').trim();
      }
    }

    const values = sh.getDataRange().getValues();
    const submissions = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[0]) continue;
      const sid = String(r[1] || '').trim();
      const tsStr = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      const ds = tsStr.slice(0, 10);
      if (filterSid  && sid !== filterSid)  continue;
      if (filterDate && ds  !== filterDate) continue;
      submissions.push({
        timestamp:       tsStr,
        studentId:       sid,
        studentName:     String(r[2] || ''),
        studentRealName: nameMap[sid] || '',
        date:            ds,
        work:            String(r[3] || ''),
        method:          String(r[4] || ''),
        teacher_comment: String(r[5] || ''),
        skip_questions:  _normalizeWabun1SkipList(r[6])
      });
    }
    submissions.sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });
    return { ok: true, submissions: submissions };
  } catch(err) {
    console.error('[adminListWabun1Submissions]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 管理画面：和文英訳① 先生コメント保存
// params: { password, timestamp, studentId, comment }
// =============================================
function adminSetWabun1Comment(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const ts  = String(params.timestamp || '').trim();
    const sid = String(params.studentId || '').trim();
    const comment = String(params.comment != null ? params.comment : '');
    if (!ts || !sid) return { ok: false, message: 'timestamp / studentId が必要です' };
    const sh = _ss().getSheetByName(SHEET_WABUN1_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: false, message: '該当する提出が見つかりません' };
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[0]) continue;
      const rowTs  = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      const rowSid = String(r[1] || '').trim();
      if (rowTs === ts && rowSid === sid) {
        sh.getRange(i + 1, 6).setValue(comment);
        return { ok: true };
      }
    }
    return { ok: false, message: '該当する提出が見つかりません' };
  } catch(err) {
    console.error('[adminSetWabun1Comment]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 英語リスオン (lison) — 週次配信のリスニング＆音読コンテンツ
// =============================================
// シート構造（ふくちさんが手動作成。シート未作成時は graceful にエラー返却）：
//   LisonContents:    weekStart | level | englishText | japaneseText
//                     | q1_text | q1_answer | q1_explanation
//                     | q2_text | q2_answer | q2_explanation
//                     | q3_text | q3_answer | q3_explanation
//   LisonSubmissions: timestamp | studentId | studentName | level | weekStart
//                     | quizScore | recordingUrl | hpGained | fileId
//                     ※ fileId 列は 2026-05-04 追加（migrateLisonSubmissionsAddFileId
//                       で既存行も埋める運用）。古いシート（8 列）にも graceful 対応。
//
// レベル文字列: '4' / '3' / 'pre2' / '2' / 'pre1'
// 4 級の正誤問題の answer は '○' / '✖'、他級は 'T' / 'F'（LisonContents の値で完全一致比較）
// 週は月曜起点。weekStart は _sangoToday() を _lisonGetWeekStart で月曜化したもの。
// HP: 4/3/pre2 = 素点 100、2/pre1 = 素点 200。連続週²倍率（streak/7 切り上げ²）は他コンテンツと同じ。
// 1日1レベル1HP（同日同レベル提出は alreadyGranted）。録音は alreadyGranted でも保存・記録する。
//
// 録音保存期間: LISON_RETENTION_DAYS 日（2026-05-04 時点では 15 日）。
// cleanupLisonOldRecordings() を Time-based Trigger で日次実行する想定。
// =============================================

// 2026-05-15 拡張：英単語RUSH と並びを揃え、準2級プラス（'pre2plus'）と 1級（'1'）を追加。
// LISON_VALID_LEVELS の順序は管理画面タブ・生徒画面ボタンの表示順にそのまま反映される。
const LISON_VALID_LEVELS = ['4', '3', 'pre2', 'pre2plus', '2', 'pre1', '1'];

// レベルメタデータ（管理画面で動的生成するタブ・answer select の選択肢に利用）。
// answerType: 'maru' = ○/✖（4 級のみ、教科書準拠の表記）、'tf' = T/F（3 級以上の英文 T/F 問題）。
// 順序は LISON_VALID_LEVELS と一致させる（管理画面のタブ並びがそのまま再現される）。
const LISON_LEVEL_META = [
  { value: '4',        label: '4 級',         answerType: 'maru' },
  { value: '3',        label: '3 級',         answerType: 'tf'   },
  { value: 'pre2',     label: '準 2 級',      answerType: 'tf'   },
  { value: 'pre2plus', label: '準 2 級プラス', answerType: 'tf'   },
  { value: '2',        label: '2 級',         answerType: 'tf'   },
  { value: 'pre1',     label: '準 1 級',      answerType: 'tf'   },
  { value: '1',        label: '1 級',         answerType: 'tf'   }
];

// LisonContents シートのヘッダー（13 列、A〜M）。
// _readLisonContentRow / 管理画面（adminSaveLisonContentsWeek 等）の両方で
// この配列を参照することで、列順入れ替えや schema migration に強くする。
const LISON_CONTENTS_HEADERS = [
  'weekStart', 'level',
  'englishText', 'japaneseText',
  'q1_text', 'q1_answer', 'q1_explanation',
  'q2_text', 'q2_answer', 'q2_explanation',
  'q3_text', 'q3_answer', 'q3_explanation'
];

// 既存運用が手動で行を追加していくスタイルなので min_rows は控えめ（appendRow 中心）。
// 5 レベル × 12 ヶ月分 ≈ 260 週 = 1300 行を想定して 1500 を確保。
const LISON_CONTENTS_MIN_ROWS = 1500;

// 録音の保存期間（日数）。Drive ファイルとシート行を両方削除する基準。
// 値を変更したい場合（20 日 / 30 日など）はここ 1 箇所のみ。
const LISON_RETENTION_DAYS = 15;

// JST 3 時区切りの今日の日付から、その週の月曜日（含む）の 'yyyy-MM-dd' を返す。
// 月曜は当日、火〜土は前日〜5 日前、日曜は 6 日前。
function _lisonGetWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00+09:00');
  const dow = d.getDay(); // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  const offset = (dow === 0) ? 6 : (dow - 1);
  d.setDate(d.getDate() - offset);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

// レベルごとの素点HP（連続週²倍率を掛ける前の値）
// 2026-05-15 拡張：'pre2plus' / '1' を追加（2 級・準 1 級と同じ 200HP）
function _lisonBaseHpForLevel(level) {
  if (level === '2' || level === 'pre1' || level === '1' || level === 'pre2plus') return 200;
  return 100; // '4' / '3' / 'pre2'
}

// LisonContents から (weekStart, level) 一致行を 1 件取得。無ければ null。
// シート未作成・空・ヘッダー欠損時はすべて null を返す（graceful）。
function _readLisonContentRow(weekStart, level) {
  const sh = _ss().getSheetByName(SHEET_LISON_CONTENTS);
  if (!sh || sh.getLastRow() < 2) return null;
  const values = sh.getDataRange().getValues();
  const header = values[0];
  const idx = function(name) { return header.indexOf(name); };
  const iWS = idx('weekStart');
  const iLV = idx('level');
  if (iWS < 0 || iLV < 0) return null;
  const iEng = idx('englishText');
  const iJa  = idx('japaneseText');
  const iQ1T = idx('q1_text'), iQ1A = idx('q1_answer'), iQ1E = idx('q1_explanation');
  const iQ2T = idx('q2_text'), iQ2A = idx('q2_answer'), iQ2E = idx('q2_explanation');
  const iQ3T = idx('q3_text'), iQ3A = idx('q3_answer'), iQ3E = idx('q3_explanation');
  const get = function(row, i) { return (i >= 0) ? row[i] : ''; };
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const wsRaw = row[iWS];
    if (!wsRaw) continue;
    let ws;
    if (wsRaw instanceof Date) {
      ws = Utilities.formatDate(wsRaw, 'Asia/Tokyo', 'yyyy-MM-dd');
    } else {
      ws = String(wsRaw).trim();
    }
    if (ws !== weekStart) continue;
    if (String(row[iLV]).trim() !== level) continue;
    return {
      weekStart: ws,
      level: level,
      englishText:  String(get(row, iEng) || ''),
      japaneseText: String(get(row, iJa)  || ''),
      questions: [
        { text: String(get(row, iQ1T) || ''), answer: String(get(row, iQ1A) || '').trim(), explanation: String(get(row, iQ1E) || '') },
        { text: String(get(row, iQ2T) || ''), answer: String(get(row, iQ2A) || '').trim(), explanation: String(get(row, iQ2E) || '') },
        { text: String(get(row, iQ3T) || ''), answer: String(get(row, iQ3A) || '').trim(), explanation: String(get(row, iQ3E) || '') }
      ]
    };
  }
  return null;
}

// =============================================
// 管理画面：LisonContents シートのヘッダー保証（冪等）
// 既存シートが古い 8 列構成等の場合に末尾に欠落列を追記する（破壊的変更なし）。
// シートが存在しなければ新規作成。GAS エディタからの 1 回限り実行を想定。
// =============================================
function ensureLisonContentsSheet() {
  try {
    const r = _ensureSheetWithHeaders(SHEET_LISON_CONTENTS, LISON_CONTENTS_HEADERS, LISON_CONTENTS_MIN_ROWS);
    return {
      ok: true,
      created: r.created,
      maxRows: r.sh.getMaxRows(),
      headers: LISON_CONTENTS_HEADERS
    };
  } catch (err) {
    console.error('[ensureLisonContentsSheet]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 公開API: リスオンのレベル一覧（管理画面のタブ動的生成用）
// 認証不要。LISON_LEVEL_META をそのまま返す。
// 戻り値: { ok, levels: [{ value, label, answerType }, ...] }
// =============================================
function getLisonLevels() {
  return {
    ok: true,
    levels: LISON_LEVEL_META.map(function(m){
      return { value: m.value, label: m.label, answerType: m.answerType };
    })
  };
}

// =============================================
// 管理画面：LisonContents の (weekStart, level) 行マップを構築
// 戻り値: { rowByKey: { 'weekStart|level': rowIdx1based, ... }, sheet, header, indices }
// header から動的に列インデックスを引く（schema migration 対応）。
// =============================================
function _readLisonContentsIndex(sheet) {
  const sh = sheet || _ss().getSheetByName(SHEET_LISON_CONTENTS);
  if (!sh) return { sheet: null, header: null, rowByKey: {}, indices: null };
  if (sh.getLastRow() < 1) {
    return { sheet: sh, header: null, rowByKey: {}, indices: null };
  }
  const values = sh.getDataRange().getValues();
  const header = values[0];
  const idx = function(name) { return header.indexOf(name); };
  const indices = {
    iWS:  idx('weekStart'),
    iLV:  idx('level'),
    iEng: idx('englishText'),
    iJa:  idx('japaneseText'),
    iQ1T: idx('q1_text'), iQ1A: idx('q1_answer'), iQ1E: idx('q1_explanation'),
    iQ2T: idx('q2_text'), iQ2A: idx('q2_answer'), iQ2E: idx('q2_explanation'),
    iQ3T: idx('q3_text'), iQ3A: idx('q3_answer'), iQ3E: idx('q3_explanation')
  };
  const rowByKey = {};
  if (indices.iWS < 0 || indices.iLV < 0) {
    return { sheet: sh, header: header, rowByKey: rowByKey, indices: indices };
  }
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const wsRaw = row[indices.iWS];
    if (!wsRaw) continue;
    let ws;
    if (wsRaw instanceof Date) {
      ws = Utilities.formatDate(wsRaw, 'Asia/Tokyo', 'yyyy-MM-dd');
    } else {
      ws = String(wsRaw).trim();
    }
    const lv = String(row[indices.iLV] || '').trim();
    if (!ws || !lv) continue;
    rowByKey[ws + '|' + lv] = r + 1; // 1-based シート行番号
  }
  return { sheet: sh, header: header, rowByKey: rowByKey, indices: indices };
}

// =============================================
// 管理画面：1 週分のコンテンツを一括保存（5 レベル × 3 問 + 英文 / 和訳）
// params:
//   { password, weekStart: 'YYYY-MM-DD',
//     levels: [{ level, englishText, japaneseText,
//                questions: [{ text, answer, explanation }, x3] }, ...] }
// 部分投入（5 レベル全部揃わなくても可）を許容、空のレベルはスキップ。
// (weekStart, level) 一致行があれば setValues で上書き、なければ appendRow。
// 戻り値: { ok, added, updated, errors: [] }
// =============================================
function adminSaveLisonContentsWeek(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    const weekStart = String((params && params.weekStart) || '').trim();
    const levels = (params && params.levels) || [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return { ok: false, message: 'weekStart は YYYY-MM-DD 形式で指定してください' };
    }
    if (!Array.isArray(levels)) {
      return { ok: false, message: 'levels が配列ではありません' };
    }

    // シート存在保証 + 列構成チェック
    const ensure = _ensureSheetWithHeaders(SHEET_LISON_CONTENTS, LISON_CONTENTS_HEADERS, LISON_CONTENTS_MIN_ROWS);
    const sh = ensure.sh;
    const idx = _readLisonContentsIndex(sh);
    if (!idx.indices || idx.indices.iWS < 0 || idx.indices.iLV < 0) {
      return { ok: false, message: 'LisonContents のヘッダーに weekStart / level 列が見つかりません' };
    }

    // 入力レベルの正規化 + 空判定（空レベルはスキップ）
    const errors = [];
    const targets = []; // { level, englishText, japaneseText, questions: [...] }
    for (let i = 0; i < levels.length; i++) {
      const it = levels[i] || {};
      const level = String(it.level || '').trim();
      if (!level) continue;
      if (LISON_VALID_LEVELS.indexOf(level) < 0) {
        errors.push('未定義のレベルをスキップ: ' + level);
        continue;
      }
      const eng = String(it.englishText == null ? '' : it.englishText);
      const ja  = String(it.japaneseText == null ? '' : it.japaneseText);
      const qs  = Array.isArray(it.questions) ? it.questions : [];
      const q1  = qs[0] || {}; const q2 = qs[1] || {}; const q3 = qs[2] || {};
      const allEmpty =
        !eng.trim() && !ja.trim() &&
        !String(q1.text || '').trim() && !String(q1.answer || '').trim() && !String(q1.explanation || '').trim() &&
        !String(q2.text || '').trim() && !String(q2.answer || '').trim() && !String(q2.explanation || '').trim() &&
        !String(q3.text || '').trim() && !String(q3.answer || '').trim() && !String(q3.explanation || '').trim();
      if (allEmpty) continue; // 完全に空のレベルは無視（既存行があってもそのまま残す）
      targets.push({
        level: level,
        englishText: eng,
        japaneseText: ja,
        questions: [
          { text: String(q1.text || ''), answer: String(q1.answer || '').trim(), explanation: String(q1.explanation || '') },
          { text: String(q2.text || ''), answer: String(q2.answer || '').trim(), explanation: String(q2.explanation || '') },
          { text: String(q3.text || ''), answer: String(q3.answer || '').trim(), explanation: String(q3.explanation || '') }
        ]
      });
    }
    if (targets.length === 0) {
      return { ok: false, message: '保存対象のレベルがありません（少なくとも 1 レベルは入力してください）', errors: errors };
    }

    // ヘッダー順に並んだ行データを組み立てるヘルパー
    function _buildRow(t) {
      // header.indexOf 経由で各値を埋める。LISON_CONTENTS_HEADERS と一致前提。
      const row = new Array(LISON_CONTENTS_HEADERS.length).fill('');
      const set = function(col, v) { const i = idx.header.indexOf(col); if (i >= 0) row[i] = v; };
      set('weekStart',     weekStart);
      set('level',         t.level);
      set('englishText',   t.englishText);
      set('japaneseText',  t.japaneseText);
      set('q1_text',       t.questions[0].text);
      set('q1_answer',     t.questions[0].answer);
      set('q1_explanation',t.questions[0].explanation);
      set('q2_text',       t.questions[1].text);
      set('q2_answer',     t.questions[1].answer);
      set('q2_explanation',t.questions[1].explanation);
      set('q3_text',       t.questions[2].text);
      set('q3_answer',     t.questions[2].answer);
      set('q3_explanation',t.questions[2].explanation);
      return row;
    }

    let added = 0;
    let updated = 0;
    const appendRows = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const key = weekStart + '|' + t.level;
      const row = _buildRow(t);
      if (idx.rowByKey[key]) {
        sh.getRange(idx.rowByKey[key], 1, 1, row.length).setValues([row]);
        updated++;
      } else {
        appendRows.push(row);
      }
    }
    if (appendRows.length > 0) {
      const startRow = sh.getLastRow() + 1;
      sh.getRange(startRow, 1, appendRows.length, appendRows[0].length).setValues(appendRows);
      added = appendRows.length;
    }
    return { ok: true, added: added, updated: updated, errors: errors };
  } catch (err) {
    console.error('[adminSaveLisonContentsWeek]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 管理画面：1 週分のコンテンツを読み出し（編集モード用）
// params: { password, weekStart }
// 戻り値: { ok, weekStart, levels: [{ level, englishText, japaneseText, questions: [...] }, ...] }
// 認証必須（生徒側 getLisonContent は無認証だが、管理画面は念のため認証あり）。
// =============================================
function getLisonContentsWeek(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    const weekStart = String((params && params.weekStart) || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return { ok: false, message: 'weekStart は YYYY-MM-DD 形式で指定してください' };
    }
    const sh = _ss().getSheetByName(SHEET_LISON_CONTENTS);
    const result = { ok: true, weekStart: weekStart, levels: [] };
    if (!sh || sh.getLastRow() < 2) return result;
    // LISON_VALID_LEVELS の順序を保つため、各レベルを順番に読みに行く
    for (let i = 0; i < LISON_VALID_LEVELS.length; i++) {
      const lv = LISON_VALID_LEVELS[i];
      const c = _readLisonContentRow(weekStart, lv);
      if (!c) continue;
      result.levels.push({
        level: c.level,
        englishText: c.englishText,
        japaneseText: c.japaneseText,
        questions: c.questions
      });
    }
    return result;
  } catch (err) {
    console.error('[getLisonContentsWeek]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 管理画面：直近 N 週の登録状況を一覧
// params: { password, limit?: 8 }
// 戻り値: { ok, weeks: [{ weekStart, levels: [...投入済みレベル], complete: bool }, ...] }
// weekStart 降順、最大 limit 件。
// =============================================
function listLisonContentsWeeks(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!_requireAdmin(_teacher)) return { ok: false, message: 'この操作は管理者のみ可能です' };
    const limit = Math.max(1, Math.min(60, Number((params && params.limit) || 8)));
    const sh = _ss().getSheetByName(SHEET_LISON_CONTENTS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, weeks: [] };
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iWS = header.indexOf('weekStart');
    const iLV = header.indexOf('level');
    if (iWS < 0 || iLV < 0) return { ok: true, weeks: [] };
    // weekStart → Set<level> のマップを作る
    const byWS = {};
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const wsRaw = row[iWS];
      if (!wsRaw) continue;
      let ws;
      if (wsRaw instanceof Date) {
        ws = Utilities.formatDate(wsRaw, 'Asia/Tokyo', 'yyyy-MM-dd');
      } else {
        ws = String(wsRaw).trim();
      }
      const lv = String(row[iLV] || '').trim();
      if (!ws || LISON_VALID_LEVELS.indexOf(lv) < 0) continue;
      if (!byWS[ws]) byWS[ws] = {};
      byWS[ws][lv] = true;
    }
    // weekStart 降順にソート
    const allWS = Object.keys(byWS).sort(function(a, b){ return a < b ? 1 : a > b ? -1 : 0; });
    const weeks = allWS.slice(0, limit).map(function(ws){
      // LISON_VALID_LEVELS の順序を保ったまま投入済みレベルだけ残す
      const lvs = LISON_VALID_LEVELS.filter(function(lv){ return !!byWS[ws][lv]; });
      return {
        weekStart: ws,
        levels: lvs,
        complete: lvs.length === LISON_VALID_LEVELS.length
      };
    });
    return { ok: true, weeks: weeks };
  } catch (err) {
    console.error('[listLisonContentsWeeks]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 公開API: 今週分のリスオンコンテンツを取得
// =============================================
function getLisonContent(level) {
  try {
    const lv = String(level || '').trim();
    if (LISON_VALID_LEVELS.indexOf(lv) < 0) {
      return { ok: false, message: 'level が不正です（4 / 3 / pre2 / 2 / pre1 のいずれか）' };
    }
    const weekStart = _lisonGetWeekStart(_sangoToday());
    const content = _readLisonContentRow(weekStart, lv);
    if (!content) {
      return { ok: false, message: 'このレベルの今週分のコンテンツはまだ準備中です' };
    }
    return {
      ok: true,
      weekStart: content.weekStart,
      level: content.level,
      englishText: content.englishText,
      japaneseText: content.japaneseText,
      questions: content.questions
    };
  } catch(err) {
    console.error('[getLisonContent]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// Phase 6 共通基盤：認証付き Drive ファイル base64 配信
// =============================================
// 録音 (LisonRecordings) と 答案写真 (KisoPhotos) で共通利用。
// Drive 直接公開 (setSharing(ANYONE_WITH_LINK)) を廃止し、本ヘルパーを通して
// base64 で配信する。クライアント側は base64 → Blob → Blob URL 経由で
// <audio> / <img> に流し込む（DL ボタンは UI 側で削除、controlsList=nodownload で
// ブラウザ右クリック保存等のカジュアル DL も抑止）。
//
// 認証スコープ：
//   allowTeacher = true   → admin / teacher 両方の認証通過を許可（再生・閲覧用途）
//   allowTeacher = false  → admin（owner）のみ
//
// 戻り値：
//   { ok:true, base64, mime, fileName, sizeBytes }
//   { ok:false, message:'認証エラー' }                          ← 認証失敗
//   { ok:false, message:'この操作は管理者のみ可能です' }        ← teacher が admin 専用 API 呼出
//   { ok:false, message:'fileId が指定されていません' }         ← 引数不正
//   { ok:false, message:'ファイルが見つかりません' }            ← Drive 削除済み・ID 不正
//   { ok:false, message:'ファイル取得に失敗しました：<詳細>' }  ← Drive API その他エラー
function _verifyTeacherAndGetDriveBlob(params, allowTeacher) {
  try {
    // 1. 認証
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    if (!allowTeacher && !_requireAdmin(_teacher)) {
      return { ok: false, message: 'この操作は管理者のみ可能です' };
    }

    // 2. fileId 検証
    const fileId = String((params && params.fileId) || '').trim();
    if (!fileId) return { ok: false, message: 'fileId が指定されていません' };

    // 3. Drive ファイル取得（GAS オーナー = ふくちさん権限で動作するため
    //    setSharing(NONE) のファイルでも問題なくアクセス可能）
    let file;
    try {
      file = DriveApp.getFileById(fileId);
    } catch (e) {
      console.error('[_verifyTeacherAndGetDriveBlob] DriveApp.getFileById failed:', fileId, e);
      return { ok: false, message: 'ファイルが見つかりません' };
    }

    // 4. Blob → base64
    try {
      const blob = file.getBlob();
      const bytes = blob.getBytes();
      const base64 = Utilities.base64Encode(bytes);
      const mime = blob.getContentType() || '';
      const fileName = file.getName() || '';
      return {
        ok: true,
        base64: base64,
        mime: mime,
        fileName: fileName,
        sizeBytes: bytes.length
      };
    } catch (e) {
      console.error('[_verifyTeacherAndGetDriveBlob] blob/base64 failed:', fileId, e);
      return { ok: false, message: 'ファイル取得に失敗しました：' + String(e) };
    }
  } catch (err) {
    console.error('[_verifyTeacherAndGetDriveBlob]', err);
    return { ok: false, message: String(err) };
  }
}

// fileId から LisonSubmissions シートで sid / level を逆引き（操作ログ details 用）。
// fileId 列優先、無ければ recordingUrl から regex 抽出（古い行への後方互換）。
function _lisonLookupByFileId(fileId) {
  try {
    const sh = _ss().getSheetByName(SHEET_LISON_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return {};
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const cFid = header.indexOf('fileId');
    const cSid = header.indexOf('studentId');
    const cLv  = header.indexOf('level');
    const cUrl = header.indexOf('recordingUrl');
    const target = String(fileId || '').trim();
    for (let i = 1; i < values.length; i++) {
      let rowFid = (cFid >= 0) ? String(values[i][cFid] || '').trim() : '';
      if (!rowFid && cUrl >= 0) {
        rowFid = _lisonExtractFileId(String(values[i][cUrl] || ''));
      }
      if (rowFid === target) {
        return {
          sid:   (cSid >= 0) ? String(values[i][cSid] || '').trim() : '',
          level: (cLv  >= 0) ? String(values[i][cLv]  || '').trim() : ''
        };
      }
    }
  } catch (e) {
    console.error('[_lisonLookupByFileId]', e);
  }
  return {};
}

// リスオン録音の認証付き base64 配信（admin / teacher 両方再生可、DL は UI 側で抑止）。
// 用途: admin.html リスオン録音再生 UI が <audio> + Blob URL 方式で再生する際の音声取得。
// 入力: { teacherId, password, fileId }
// 出力: _verifyTeacherAndGetDriveBlob(params, true) のレスポンスをそのまま返す
//
// 操作ログ：成功時に LISON_RECORDING_PLAY を記録（admin/teacher の再生監査用）。
// 録音は誰も DL 不可（Q10）のため、再生 = 唯一の閲覧経路。すべて記録対象。
function getLisonRecordingBlob(params) {
  const res = _verifyTeacherAndGetDriveBlob(params, true);
  if (res && res.ok) {
    try {
      const teacherId = String((params && params.teacherId) || '').trim();
      const fileId    = String((params && params.fileId)    || '').trim();
      const meta = _lisonLookupByFileId(fileId);
      _logTeacherAction(teacherId, 'LISON_RECORDING_PLAY', '', 'success', {
        fileId: fileId,
        sid:    meta.sid   || '',
        level:  meta.level || ''
      });
    } catch (e) {
      console.error('[getLisonRecordingBlob log]', e);
    }
  }
  return res;
}

// =============================================
// 録音 Drive 保存（基礎計算 _saveKisoPhoto と同様のパターン）
// =============================================
const LISON_RECORDING_ROOT_FOLDER = 'LisonRecordings';

// MIME 文字列から拡張子を判定。判定不能なら 'webm' をデフォルトに。
function _lisonExtFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.indexOf('webm') >= 0) return 'webm';
  if (m.indexOf('m4a')  >= 0) return 'm4a';
  if (m.indexOf('mp4')  >= 0) return 'mp4';
  if (m.indexOf('mpeg') >= 0) return 'mp3';
  if (m.indexOf('mp3')  >= 0) return 'mp3';
  if (m.indexOf('ogg')  >= 0) return 'ogg';
  if (m.indexOf('wav')  >= 0) return 'wav';
  if (m.indexOf('aac')  >= 0) return 'aac';
  return 'webm';
}

// マイドライブ直下に LisonRecordings フォルダを 1 個確保
function _ensureLisonRecordingsFolder() {
  const it = DriveApp.getFoldersByName(LISON_RECORDING_ROOT_FOLDER);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(LISON_RECORDING_ROOT_FOLDER);
}

// 録音 1 本を Drive に保存。ファイル名: lison_<sid>_<level>_<yyyymmddHHMMSS>.<ext>
// 戻り値: { ok, fileId, shareUrl, fileName } / 失敗時 { ok:false, message }
function _saveLisonRecording(sid, level, base64Data, mime) {
  try {
    if (!sid)        return { ok: false, message: '生徒IDが空です' };
    if (!base64Data) return { ok: false, message: '録音データが空です' };
    const ext = _lisonExtFromMime(mime);
    const decoded = Utilities.base64Decode(String(base64Data));
    const blob = Utilities.newBlob(decoded, mime || ('audio/' + ext), 'tmp.' + ext);
    const tsStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
    const fileName = 'lison_' + sid + '_' + level + '_' + tsStr + '.' + ext;
    const folder = _ensureLisonRecordingsFolder();
    const file = folder.createFile(blob).setName(fileName);
    // Phase 6：setSharing(ANYONE_WITH_LINK) を削除。録音は Drive 直アクセス不可。
    // 再生は getLisonRecordingBlob 経由で base64 配信する設計に変更（DL 抑止のため）。
    // shareUrl は LisonSubmissions.recordingUrl 列の互換性のために残置するが、
    // 値は 'private' プレースホルダー（過去ファイルの URL とは値で区別可能）。
    return {
      ok: true,
      fileId: file.getId(),
      shareUrl: 'private',
      fileName: fileName
    };
  } catch(err) {
    console.error('[_saveLisonRecording]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 共通ヘルパー: Drive URL から fileId を抽出
// =============================================
function _lisonExtractFileId(url) {
  if (!url) return '';
  const m = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

// =============================================
// 既存 LisonRecordings の一括公開化バッチ（旧仕様、Phase 6 ロールバック用に残置）
// =============================================
// ⚠️ Phase 6（録音 DL 抑止）以降、本関数は通常運用では使用しない。
//    Phase 6 で逆方向の migrateLisonRecordingsToPrivate を新設しており、
//    本関数は「Phase 6 を巻き戻したい場合の緊急ロールバック手段」として残置。
//    通常の運用ではアクセスする必要なし。
//
// LisonSubmissions シートの全 recordingUrl から fileId を抽出して
// DriveApp.getFileById(fileId).setSharing(ANYONE_WITH_LINK, VIEW) を実行する。
// すでに公開済みのファイルでも setSharing は冪等なので二重実行してもエラーにならない。
//
// 戻り値: { ok, total, succeeded, failed, errors:[{fileId,reason}], elapsedSec }
//
// 削除済みファイル等で getFileById が throw したら個別にスキップして次へ。
function migrateLisonRecordingsToShared(params) {
  // ⚠️ Phase 2 で doGet / doPost ルーティングを削除済。GAS エディタからの手動実行のみで動作する。
  const t0 = Date.now();
  const result = {
    ok: true,
    total: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    elapsedSec: 0
  };
  try {
    const sh = _ss().getSheetByName(SHEET_LISON_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) {
      console.log('[migrateLisonRecordingsToShared] LisonSubmissions が空です');
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iUrl = header.indexOf('recordingUrl');
    if (iUrl < 0) {
      // 後方互換: 列名が無い古いシート構造の場合は固定インデックス 6 を使用
      console.warn('[migrateLisonRecordingsToShared] header に recordingUrl 列がありません。インデックス 6 にフォールバック');
    }
    const urlIdx = (iUrl >= 0) ? iUrl : 6;

    // fileId 単位で deduplicate（同じ fileId が複数行に出ることはほぼ無いが安全側）
    const seen = {};
    const targets = [];
    for (let i = 1; i < values.length; i++) {
      const url = String(values[i][urlIdx] || '').trim();
      if (!url) continue;
      const fid = _lisonExtractFileId(url);
      if (!fid) continue;
      if (seen[fid]) continue;
      seen[fid] = true;
      targets.push(fid);
    }
    result.total = targets.length;
    console.log('[migrateLisonRecordingsToShared] 対象 ' + result.total + ' 件の公開化を開始');

    for (let k = 0; k < targets.length; k++) {
      const fid = targets[k];
      try {
        const file = DriveApp.getFileById(fid);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        result.succeeded += 1;
      } catch (err) {
        result.failed += 1;
        result.errors.push({ fileId: fid, reason: String(err && err.message || err) });
      }
      // 100 件ごとに進捗をログ
      if ((k + 1) % 100 === 0) {
        console.log('[migrateLisonRecordingsToShared] 進捗 ' + (k + 1) + '/' + result.total
                    + ' (succeeded=' + result.succeeded + ', failed=' + result.failed + ')');
      }
    }
    result.elapsedSec = (Date.now() - t0) / 1000;
    console.log('[migrateLisonRecordingsToShared] 完了: total=' + result.total
                + ', succeeded=' + result.succeeded
                + ', failed=' + result.failed
                + ', elapsedSec=' + result.elapsedSec.toFixed(2));
    return result;
  } catch (err) {
    console.error('[migrateLisonRecordingsToShared]', err);
    result.ok = false;
    result.errors.push({ fileId: '', reason: String(err) });
    result.elapsedSec = (Date.now() - t0) / 1000;
    return result;
  }
}

// =============================================
// 管理画面: リスオン録音メタ一覧（直近 30 日）
// =============================================
// params:
//   - password   : 管理者パスワード（必須）
//   - studentId? : 指定時は該当生徒のみ。未指定なら全生徒
// 戻り値: { ok, submissions: [{
//   timestamp, studentId, studentName, studentRealName, level,
//   weekStart, quizScore, recordingUrl, fileId, hpGained
// }, ...] }
// timestamp 降順。30 日より古い行は除外。
function getLisonSubmissionsList(params) {
  try {
    const _teacher = _verifyTeacher(params && params.teacherId, params && params.password);
    if (!_teacher) return { ok: false, message: '認証エラー' };
    const filterSid = String((params && params.studentId) || '').trim();

    const sh = _ss().getSheetByName(SHEET_LISON_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, submissions: [] };

    // 突合用（real name 補完）。Step 2：全アカウント対象 = Students + SpecialAccounts。
    const stuRows = _getAllAccountsValues();
    const realNameMap = {};
    if (stuRows && stuRows.length >= 2) {
      for (let i = 1; i < stuRows.length; i++) {
        const sid = String(stuRows[i][COL_ID] || '').trim();
        if (!sid) continue;
        realNameMap[sid] = String(stuRows[i][COL_NAME] || '').trim();
      }
    }

    const values = sh.getDataRange().getValues();
    // 列構成（9 列、2026-05-04 以降）:
    //   [0]timestamp [1]studentId [2]studentName [3]level [4]weekStart
    //   [5]quizScore [6]recordingUrl [7]hpGained [8]fileId
    // 旧シート（8 列、fileId なし）でも fileId は recordingUrl から regex 抽出してフォールバック。
    const header = values[0] || [];
    const iFileId = header.indexOf('fileId'); // 列が無ければ -1（後方互換）
    // LISON_RETENTION_DAYS より前の行は除外（cleanup で削除されるはずだが
    // 念のため UI 側でもフィルタする）
    const cutoffMs = Date.now() - LISON_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const submissions = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[0]) continue;
      const ts = new Date(r[0]);
      if (isNaN(ts.getTime())) continue;
      if (ts.getTime() < cutoffMs) continue;
      const sid = String(r[1] || '').trim();
      if (filterSid && sid !== filterSid) continue;
      const url = String(r[6] || '').trim();
      // fileId は専用列を優先、無ければ URL から regex 抽出（後方互換）
      const fid = (iFileId >= 0)
        ? (String(r[iFileId] || '').trim() || _lisonExtractFileId(url))
        : _lisonExtractFileId(url);
      submissions.push({
        timestamp: Utilities.formatDate(ts, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
        studentId: sid,
        studentName: String(r[2] || ''),
        studentRealName: realNameMap[sid] || '',
        level: String(r[3] || '').trim(),
        weekStart: r[4] instanceof Date
          ? Utilities.formatDate(r[4], 'Asia/Tokyo', 'yyyy-MM-dd')
          : String(r[4] || '').trim(),
        quizScore: Number(r[5]) || 0,
        recordingUrl: url,
        fileId: fid,
        hpGained: Number(r[7]) || 0
      });
    }
    submissions.sort(function(a, b){
      return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0;
    });
    return { ok: true, submissions: submissions };
  } catch (err) {
    console.error('[getLisonSubmissionsList]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// Phase 6: 既存 LisonRecordings の一括非公開化バッチ（GAS エディタ手動実行のみ）
// =============================================
// LisonSubmissions シートの fileId 列を駆動して
// DriveApp.getFileById(fileId).setSharing(NONE, NONE) を実行する。
// fileId 列が空の古い行は recordingUrl から regex で抽出してフォールバック。
//
// 6 分実行制限対策として { startIndex, limit } で分割実行可能：
//   - 初回：migrateLisonRecordingsToPrivate() → startIndex=0, limit=100 で実行
//   - 続行：戻り値の hasMore=true なら、ふくちさんが
//          migrateLisonRecordingsToPrivate({startIndex: <nextStartIndex>}) を実行
//   - hasMore=false まで繰り返し
//
// 削除済み・既に NONE のファイルは個別スキップ（getFileById が throw or setSharing が
// 失敗しても errors に蓄積するだけで、succeeded カウントには加算しない）。
//
// ⚠️ Phase 2 commit 59857f2 と同じく doGet / doPost ルーティングに登録しない。
//    GAS エディタの関数ドロップダウンからの手動実行のみで動作する。
//
// 戻り値: { ok, total, processedFromIndex, processedTo, succeeded, failed,
//          errors:[{fileId, reason}], hasMore, nextStartIndex, elapsedSec }
//
// ロールバック手段：緊急時は migrateLisonRecordingsToShared を実行すれば公開化に戻せる。
function migrateLisonRecordingsToPrivate(params) {
  const t0 = Date.now();
  const startIndex = Math.max(0, Number(params && params.startIndex) || 0);
  const limit      = Math.max(1, Math.min(500, Number(params && params.limit) || 100));
  const result = {
    ok: true,
    total: 0,
    processedFromIndex: startIndex,
    processedTo: startIndex,
    succeeded: 0,
    failed: 0,
    errors: [],
    hasMore: false,
    nextStartIndex: startIndex,
    elapsedSec: 0
  };
  try {
    const sh = _ss().getSheetByName(SHEET_LISON_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) {
      console.log('[migrateLisonRecordingsToPrivate] LisonSubmissions が空です');
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const iFid = header.indexOf('fileId');
    const iUrl = header.indexOf('recordingUrl');
    if (iFid < 0 && iUrl < 0) {
      console.warn('[migrateLisonRecordingsToPrivate] fileId / recordingUrl 列が見つかりません');
      result.ok = false;
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }

    // データ行から fileId を抽出（fileId 列優先、無ければ recordingUrl から regex 抽出）。
    // recordingUrl が 'private' プレースホルダーの場合（Phase 6 以降の新規録音）は
    // fileId 列に値が入っているはずなので問題なし。
    const fileIds = [];
    for (let i = 1; i < values.length; i++) {
      let fid = (iFid >= 0) ? String(values[i][iFid] || '').trim() : '';
      if (!fid && iUrl >= 0) {
        fid = _lisonExtractFileId(String(values[i][iUrl] || ''));
      }
      if (fid) fileIds.push(fid);
    }
    result.total = fileIds.length;

    // startIndex から limit 件分だけ処理
    const endIndex = Math.min(startIndex + limit, fileIds.length);
    result.processedTo = endIndex;
    result.hasMore = endIndex < fileIds.length;
    result.nextStartIndex = result.hasMore ? endIndex : fileIds.length;

    if (startIndex >= fileIds.length) {
      console.log('[migrateLisonRecordingsToPrivate] startIndex 超過。total=' + result.total
        + ', startIndex=' + startIndex);
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }

    console.log('[migrateLisonRecordingsToPrivate] 開始: total=' + result.total
      + ', range=[' + startIndex + ',' + endIndex + ')');

    for (let k = startIndex; k < endIndex; k++) {
      const fid = fileIds[k];
      try {
        const file = DriveApp.getFileById(fid);
        // 完全非公開化：DriveApp.Access.PRIVATE = 「リンク共有解除、明示的に共有された
        // 人のみアクセス可」状態。Permission.VIEW は明示共有先の権限指定（共有先が
        // いない限り効果なし、オーナー = GAS スクリプトのみアクセス可になる）。
        // ⚠️ DriveApp.Access.NONE は存在しない enum 値（undefined → エラー）。
        //    PRIVATE が「リンクを知る誰でもアクセス」を解除する正しい値。
        file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
        result.succeeded++;
      } catch (e) {
        result.failed++;
        result.errors.push({ fileId: fid, reason: String(e) });
        console.warn('[migrateLisonRecordingsToPrivate] failed: fileId=' + fid + ' err=' + e);
      }
      // 進捗ログ：10 件ごと
      if ((k - startIndex + 1) % 10 === 0) {
        console.log('[migrateLisonRecordingsToPrivate] 進捗 '
          + (k - startIndex + 1) + '/' + (endIndex - startIndex)
          + ' succeeded=' + result.succeeded + ' failed=' + result.failed);
      }
    }

    console.log('[migrateLisonRecordingsToPrivate] 完了: succeeded=' + result.succeeded
      + ' failed=' + result.failed + ' hasMore=' + result.hasMore
      + ' nextStartIndex=' + result.nextStartIndex);

    result.elapsedSec = (Date.now() - t0) / 1000;
    return result;
  } catch (err) {
    console.error('[migrateLisonRecordingsToPrivate]', err);
    result.ok = false;
    result.elapsedSec = (Date.now() - t0) / 1000;
    return result;
  }
}

// =============================================
// LisonSubmissions に fileId 列を追加するマイグレーション（1 回限り手動実行）
// =============================================
// 1) シートのヘッダー行に "fileId" 列が無ければ末尾に追加
// 2) 全データ行を走査し、fileId 列が空なら recordingUrl から regex で抽出して埋める
// 3) 既に fileId が入っている行はスキップ（冪等。再実行しても害なし）
//
// 想定運用: GAS エディタの関数ドロップダウンから 1 回だけ実行。
// 戻り値: { ok, total, succeeded, failed, errors:[{row,reason}], elapsedSec }
function migrateLisonSubmissionsAddFileId(params) {
  // ⚠️ Phase 2 で doGet / doPost ルーティングを削除済。GAS エディタからの手動実行のみで動作する。
  const t0 = Date.now();
  const result = {
    ok: true,
    total: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    elapsedSec: 0
  };
  try {
    const sh = _ss().getSheetByName(SHEET_LISON_SUBMISSIONS);
    if (!sh) {
      console.log('[migrateLisonSubmissionsAddFileId] LisonSubmissions シートが見つかりません');
      result.ok = false;
      result.errors.push({ row: 0, reason: 'LisonSubmissions シートなし' });
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }
    if (sh.getLastRow() < 1) {
      console.log('[migrateLisonSubmissionsAddFileId] 空シート');
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }

    // ヘッダーを取得（1 列目から最終列まで）
    const lastCol = sh.getLastColumn();
    const headerRange = sh.getRange(1, 1, 1, lastCol);
    let header = headerRange.getValues()[0];
    let iFileId = header.indexOf('fileId');

    // ヘッダーに fileId 列が無ければ末尾に追加
    if (iFileId < 0) {
      const newCol = lastCol + 1;
      sh.getRange(1, newCol).setValue('fileId');
      iFileId = newCol - 1; // 0-indexed
      console.log('[migrateLisonSubmissionsAddFileId] ヘッダー行に fileId 列を追加（列 ' + newCol + '）');
      header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    }

    if (sh.getLastRow() < 2) {
      console.log('[migrateLisonSubmissionsAddFileId] データ行なし、ヘッダーのみ追加して終了');
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }

    // 全データ行を取得（ヘッダー追加後の最新の列幅で）
    const dataRange = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn());
    const values = dataRange.getValues();
    result.total = values.length;
    console.log('[migrateLisonSubmissionsAddFileId] 対象 ' + result.total + ' 行を走査開始');

    const iUrl = header.indexOf('recordingUrl');
    if (iUrl < 0) {
      console.warn('[migrateLisonSubmissionsAddFileId] header に recordingUrl 列がありません。インデックス 6 にフォールバック');
    }
    const urlIdx = (iUrl >= 0) ? iUrl : 6;

    for (let i = 0; i < values.length; i++) {
      const rowNum = i + 2; // 1-based シート行番号
      try {
        const existing = String(values[i][iFileId] || '').trim();
        if (existing) continue; // 既に値あり → スキップ（冪等）
        const url = String(values[i][urlIdx] || '').trim();
        if (!url) continue; // URL も無い → 何もしない（古い空行など）
        const fid = _lisonExtractFileId(url);
        if (!fid) {
          result.failed += 1;
          result.errors.push({ row: rowNum, reason: 'fileId 抽出不可: ' + url });
          continue;
        }
        // シートに直接書き込み（バッチで setValues しないのは fileId 列のみで小規模なため）
        sh.getRange(rowNum, iFileId + 1).setValue(fid);
        result.succeeded += 1;
      } catch (err) {
        result.failed += 1;
        result.errors.push({ row: rowNum, reason: String(err && err.message || err) });
      }
      if ((i + 1) % 100 === 0) {
        console.log('[migrateLisonSubmissionsAddFileId] 進捗 ' + (i + 1) + '/' + result.total
                    + ' (succeeded=' + result.succeeded + ', failed=' + result.failed + ')');
      }
    }
    result.elapsedSec = (Date.now() - t0) / 1000;
    console.log('[migrateLisonSubmissionsAddFileId] 完了: total=' + result.total
                + ', succeeded=' + result.succeeded
                + ', failed=' + result.failed
                + ', elapsedSec=' + result.elapsedSec.toFixed(2));
    return result;
  } catch (err) {
    console.error('[migrateLisonSubmissionsAddFileId]', err);
    result.ok = false;
    result.errors.push({ row: 0, reason: String(err) });
    result.elapsedSec = (Date.now() - t0) / 1000;
    return result;
  }
}

// =============================================
// 古いリスオン録音の自動削除（Time-based Trigger で日次実行）
// =============================================
// LisonSubmissions シートを走査し、timestamp が LISON_RETENTION_DAYS 日以上前の
// レコードについて：
//   1. Drive ファイル（fileId）を setTrashed(true)
//   2. シート行を削除
// を実行する。
//
// params:
//   - dryRun?: true なら削除せず対象一覧をログ表示するだけ
//
// 戻り値: {
//   ok, totalChecked, deleted, alreadyMissing, errors:[{row,fileId,reason}],
//   dryRun, elapsedSec, targets:[{row,fileId,timestamp}]  // dryRun のみ詳細
// }
//
// エラー方針:
//   - DriveApp.getFileById で例外（File not found 等）→ alreadyMissing として
//     カウント。シート行は削除する（孤児行を残さない）
//   - その他の例外 → errors に追加し、シート行は削除しない（次回再試行対象に残す）
//
// 想定運用: Apps Script エディタの「時計アイコン」→「トリガーを追加」
//   → 関数: cleanupLisonOldRecordings / イベント: 時間主導 / 日タイマー / 午前 4-5 時
function cleanupLisonOldRecordings(params) {
  // ⚠️ Phase 2 で doGet / doPost ルーティングを削除済。GAS エディタ手動実行 +
  //    Time-based Trigger（日次 04:00-05:00）のみで動作する。Trigger は params 未指定で呼ぶ。
  const t0 = Date.now();
  const dryRun = !!(params && params.dryRun);
  const result = {
    ok: true,
    totalChecked: 0,
    deleted: 0,
    alreadyMissing: 0,
    errors: [],
    dryRun: dryRun,
    elapsedSec: 0,
    targets: []
  };
  try {
    const sh = _ss().getSheetByName(SHEET_LISON_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) {
      console.log('[cleanupLisonOldRecordings] LisonSubmissions が空 or 未作成');
      result.elapsedSec = (Date.now() - t0) / 1000;
      return result;
    }

    const values = sh.getDataRange().getValues();
    const header = values[0] || [];
    const iFileId = header.indexOf('fileId');
    const iUrl = header.indexOf('recordingUrl');
    const urlIdx = (iUrl >= 0) ? iUrl : 6;

    const cutoffMs = Date.now() - LISON_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    // 削除対象を収集（行番号は 1-based）
    const targets = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (!r[0]) continue;
      const ts = new Date(r[0]);
      if (isNaN(ts.getTime())) continue;
      result.totalChecked += 1;
      if (ts.getTime() >= cutoffMs) continue; // まだ保持期間内
      const url = String(r[urlIdx] || '').trim();
      const fid = (iFileId >= 0)
        ? (String(r[iFileId] || '').trim() || _lisonExtractFileId(url))
        : _lisonExtractFileId(url);
      targets.push({
        row: i + 1, // 1-based
        fileId: fid,
        timestamp: Utilities.formatDate(ts, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
      });
    }

    console.log('[cleanupLisonOldRecordings] 対象 ' + targets.length + ' 件 / 全行 '
                + result.totalChecked + ' 件 / 保持期間 ' + LISON_RETENTION_DAYS + ' 日'
                + (dryRun ? ' [dry-run]' : ''));

    if (dryRun) {
      result.targets = targets;
      result.elapsedSec = (Date.now() - t0) / 1000;
      // dry-run でも対象が多い場合は最初の数件のみログ
      const sample = targets.slice(0, 10);
      sample.forEach(function(t) {
        console.log('  [would delete] row=' + t.row + ', fileId=' + t.fileId + ', ts=' + t.timestamp);
      });
      if (targets.length > 10) console.log('  ... and ' + (targets.length - 10) + ' more');
      return result;
    }

    // 本番削除：Drive 削除 → 行削除（行は末尾→先頭の順で削除して行番号ズレ回避）
    const successRows = [];   // Drive 削除 OK or alreadyMissing → シート行も消す
    for (let k = 0; k < targets.length; k++) {
      const t = targets[k];
      if (!t.fileId) {
        // fileId 取れない孤児行は警告ログを出してシートからは削除する
        console.warn('[cleanupLisonOldRecordings] row=' + t.row + ' fileId 取得不可、シート行のみ削除');
        successRows.push(t.row);
        continue;
      }
      try {
        const file = DriveApp.getFileById(t.fileId);
        file.setTrashed(true);
        result.deleted += 1;
        successRows.push(t.row);
      } catch (err) {
        const msg = String(err && err.message || err);
        // ファイル既削除済み（Not Found 系）は alreadyMissing にカウント、行も削除
        if (/not\s*found|見つかりません|無効な ID/i.test(msg)) {
          result.alreadyMissing += 1;
          successRows.push(t.row);
        } else {
          // その他のエラー（権限・通信など）はシート行を残して再試行対象に
          result.errors.push({ row: t.row, fileId: t.fileId, reason: msg });
        }
      }
      if ((k + 1) % 100 === 0) {
        console.log('[cleanupLisonOldRecordings] 進捗 ' + (k + 1) + '/' + targets.length
                    + ' (deleted=' + result.deleted + ', alreadyMissing=' + result.alreadyMissing
                    + ', errors=' + result.errors.length + ')');
      }
    }

    // シート行削除（末尾→先頭の順）
    successRows.sort(function(a, b){ return b - a; });
    for (let k = 0; k < successRows.length; k++) {
      try {
        sh.deleteRow(successRows[k]);
      } catch (err) {
        result.errors.push({ row: successRows[k], fileId: '', reason: 'deleteRow 失敗: ' + String(err) });
      }
    }

    result.elapsedSec = (Date.now() - t0) / 1000;
    console.log('[cleanupLisonOldRecordings] 完了: totalChecked=' + result.totalChecked
                + ', deleted=' + result.deleted
                + ', alreadyMissing=' + result.alreadyMissing
                + ', errors=' + result.errors.length
                + ', elapsedSec=' + result.elapsedSec.toFixed(2));
    return result;
  } catch (err) {
    console.error('[cleanupLisonOldRecordings]', err);
    result.ok = false;
    result.errors.push({ row: 0, fileId: '', reason: String(err) });
    result.elapsedSec = (Date.now() - t0) / 1000;
    return result;
  }
}

// =============================================
// 公開API: 録音とクイズ解答を送信、HP を付与
// =============================================
// params:
//   - sid             : 生徒ID
//   - level           : '4' / '3' / 'pre2' / '2' / 'pre1'
//   - quizAnswers     : 3 要素の配列（'T'/'F' or '○'/'✖'）。文字列 JSON でも可
//   - recordingBase64 : data URL を含まない純粋な base64 文字列
//   - recordingMime   : 'audio/webm' / 'audio/mp4' など
//
// 同日同レベル既提出（JST 3 時区切り）は alreadyGranted=true → hpGained=0。
// 録音の Drive 保存と LisonSubmissions への記録は alreadyGranted でも実施。
// HP 加算時のみ Students HP 更新 + _logHP + ランキングキャッシュ invalidate。
//
// 戻り値: { ok, hpGained, alreadyGranted, quizScore, recordingUrl }
// =============================================
function submitLison(params) {
  try {
    const sid             = String((params && params.sid)             || '').trim();
    const level           = String((params && params.level)           || '').trim();
    const recordingBase64 = String((params && params.recordingBase64) || '');
    const recordingMime   = String((params && params.recordingMime)   || '');

    // バリデーション
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    if (LISON_VALID_LEVELS.indexOf(level) < 0) {
      return { ok: false, message: 'level が不正です（4 / 3 / pre2 / 2 / pre1 のいずれか）' };
    }
    if (!recordingBase64) return { ok: false, message: '録音データが必要です' };

    // quizAnswers を配列化
    let quizAnswers = (params && params.quizAnswers) || [];
    if (typeof quizAnswers === 'string') {
      try { quizAnswers = JSON.parse(quizAnswers); }
      catch(e) { return { ok: false, message: 'quizAnswers の JSON パースに失敗しました' }; }
    }
    if (!Array.isArray(quizAnswers) || quizAnswers.length !== 3) {
      return { ok: false, message: 'quizAnswers は 3 要素の配列である必要があります' };
    }

    // 今日（JST 3 時区切り）と今週の月曜日を取得
    const todayStr  = _sangoToday();
    const weekStart = _lisonGetWeekStart(todayStr);

    // コンテンツ取得（採点に必要）
    const content = _readLisonContentRow(weekStart, level);
    if (!content) {
      return { ok: false, message: 'このレベルの今週分のコンテンツはまだ準備中です' };
    }

    // 2026-05-09 Step 0：行シフト事故防止のため、書き込み対象行はシートから sid で
    // フレッシュに特定する（cache 経由禁止）。
    const ss = _ss();
    const stuLoc = _findAccountRowOnSheet(sid);
    if (!stuLoc) return { ok: false, message: 'Studentsシートが見つかりません' };
    const studentName = String(stuLoc.rowValues[COL_NICKNAME] || '').trim() || '名無し';

    // 採点（正解数 0〜3、完全一致比較）
    let quizScore = 0;
    for (let i = 0; i < 3; i++) {
      const sa = String(quizAnswers[i] != null ? quizAnswers[i] : '').trim();
      const ca = String(content.questions[i].answer || '').trim();
      if (sa && ca && sa === ca) quizScore++;
    }

    // alreadyGranted 判定（LisonSubmissions シートを読む。append より前に確認）
    // 列インデックス: [0]timestamp [1]studentId [2]studentName [3]level
    //                [4]weekStart [5]quizScore [6]recordingUrl [7]hpGained
    let alreadyGranted = false;
    const subSheet = ss.getSheetByName(SHEET_LISON_SUBMISSIONS);
    if (!subSheet) return { ok: false, message: 'LisonSubmissionsシートが見つかりません' };
    {
      const subRows = _readLastNRows(subSheet, 200);
      for (let i = 0; i < subRows.length; i++) {
        if (String(subRows[i][1]).trim() !== sid) continue;
        if (String(subRows[i][3]).trim() !== level) continue;
        const ts = subRows[i][0];
        if (!ts) continue;
        // wabun1 / sango と同じ JST 3 時区切りで「今日」と同じ日かチェック
        const dt = new Date(ts);
        dt.setHours(dt.getHours() - 3);
        const dStr = Utilities.formatDate(dt, 'Asia/Tokyo', 'yyyy-MM-dd');
        if (dStr === todayStr) { alreadyGranted = true; break; }
      }
    }

    // 録音を Drive に保存（alreadyGranted でも記録は残す）
    const saveRes = _saveLisonRecording(sid, level, recordingBase64, recordingMime);
    if (!saveRes.ok) {
      return { ok: false, message: '録音保存に失敗しました：' + (saveRes.message || '') };
    }

    // HP 計算（連続週²倍率は他コンテンツと同じ）
    let hpGained = 0;
    if (!alreadyGranted) {
      const streak = Number(stuLoc.rowValues[COL_STREAK]) || 1;
      const week = Math.ceil(streak / 7);
      const baseHp = _lisonBaseHpForLevel(level);
      hpGained = baseHp * week * week;

      // 2026-05-12 バグ④-本質 Phase B（案 A）：書き込み順序を _logHP → Students に変更。
      // HPLog 書き込み失敗時は Students.HP / LisonSubmissions 追記をスキップしてエラー応答
      // を返す。Drive に保存済みの録音ファイルは残るが、再提出時に alreadyGranted=false
      // のまま再度 HP 付与経路に入る（LisonSubmissions に未追記のため）→ 次回成功で救済。
      const logRes = _logHP(sid, hpGained, hpGained, 'lison');
      if (!logRes.ok) {
        console.error('[submitLison] HPLog 書き込みに失敗しました。HP/LisonSubmissions を更新せず終了。', logRes.error);
        return { ok: false, message: '内部エラーが発生しました。もう一度試してください。', errorCode: 'HP_LOG_FAILED' };
      }

      // Students シート HP 加算（書き込みはフレッシュ rowIdx + setValue、in-place キャッシュ更新）
      const cur = Number(stuLoc.rowValues[COL_HP]) || 0;
      const newHP = cur + hpGained;
      stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_HP + 1).setValue(newHP);
      const upd = {};
      upd[COL_HP] = newHP;
      _updateAccountCacheBySid(sid, upd);
      _invalidateCache('cache_ranking_last_week');
    }

    // LisonSubmissions に追記（alreadyGranted のときも recordingUrl と quizScore は残す）
    // 列構成（9 列）: timestamp / studentId / studentName / level / weekStart /
    //                quizScore / recordingUrl / hpGained / fileId
    // fileId は 2026-05-04 追加。古いシート（8 列）でも appendRow は 9 要素を許容
    // するが、保守上は migrateLisonSubmissionsAddFileId() を 1 回実行して
    // ヘッダー行と既存データに fileId 列を埋めること。
    subSheet.appendRow([
      _nowJST(),
      sid,
      studentName,
      level,
      weekStart,
      quizScore,
      saveRes.shareUrl,
      hpGained,
      saveRes.fileId || ''
    ]);

    return {
      ok: true,
      hpGained: hpGained,
      alreadyGranted: alreadyGranted,
      quizScore: quizScore,
      recordingUrl: saveRes.shareUrl
    };
  } catch(err) {
    console.error('[submitLison]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 和文英訳① モニョ判定バグのお詫びHP付与（2026-05-02 分）
// =============================================
// 背景: 2026-05-02 に発覚した [モニョ] 表記の判定バグ（OCR の ニ→ノ 誤認識を
//       吸収する正規化が未実装で、影響を受けた生徒の答案が ❌ 判定されていた）
//       への対応として、被害を受けた生徒 5 名に
//         (1) 連続週数²ボーナス込みの本来 HP（生徒ごとに異なる）
//         (2) バグ報告協力のお礼 1,000HP（一律）
//       の 2 種類を付与する。
//
// 想定運用: GAS エディタから 1 回だけ実行。Time-based Trigger は設定しない。
// 二重実行防止: 各生徒について HPLog に
//               type='apology_wabun1' AND message に '2026-05-02' を含む
//               レコードが既にあればスキップ（生徒単位で個別判定）。
//
// HPLog 列構成（_ensureHpLogMessageColumn 経由で 6 列を保証）:
//   timestamp | studentId | rawHP | hpGained | type | message
// =============================================
// ※ Step 2：本関数は Students 専用（実生徒のみ対象）。一回限りのお詫び付与で対象 5 名は実生徒。
function apologyWabun1MonyoBug_20260502() {
  const TARGET_DATE = '2026-05-02';
  const APOLOGY_TYPE = 'apology_wabun1';
  const THANKS_TYPE  = 'apology_wabun1_thanks';
  const APOLOGY_MESSAGE = '和文英訳①モニョ判定バグのお詫び付与（' + TARGET_DATE + '分・連続週数²ボーナス込み）';
  const THANKS_MESSAGE  = '和文英訳①バグ報告協力のお礼（' + TARGET_DATE + '分）';
  const THANKS_HP = 1000;

  // 対象生徒 5 名（studentId / 名前 / 素点HP（連続週数²込み））
  const TARGETS = [
    { sid: '24003', name: '古内伶奈', baseHp: 7200 },
    { sid: '24040', name: '川島桃子', baseHp:  200 },
    { sid: '22029', name: '中綾音',   baseHp: 7200 },
    { sid: '24017', name: '加藤煌生', baseHp: 1800 },
    { sid: '24039', name: '川島杏子', baseHp:  200 }
  ];

  const summary = { processed: 0, skipped: 0, errors: 0, totalHpAdded: 0, results: [] };

  try {
    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    if (!stuSheet) {
      Logger.log('[apologyWabun1MonyoBug_20260502] ERROR: Students シートが見つかりません');
      return { ok: false, message: 'Students シートが見つかりません' };
    }

    // HPLog を 6 列構造で確保 + ヘッダーインデックス取得
    const log = _ensureHpLogMessageColumn();

    // Students シートを直接読み（cache 経由禁止：最新 HP を反映するため）
    const stuValues = stuSheet.getDataRange().getValues();
    const sidToRow = {};
    for (let i = 1; i < stuValues.length; i++) {
      const sid = String(stuValues[i][COL_ID] || '').trim();
      if (sid) sidToRow[sid] = i;
    }

    // HPLog を全件読み（二重実行チェック用）。今回は最大数千行想定で全件で問題なし
    const logValues = (log.sh.getLastRow() >= 2)
      ? log.sh.getRange(2, 1, log.sh.getLastRow() - 1, log.lastCol).getValues()
      : [];

    Logger.log('=== apologyWabun1MonyoBug_20260502 開始 ===');
    Logger.log('対象 ' + TARGETS.length + ' 名 / HPLog 既存 ' + logValues.length + ' 件');

    const newLogRows = [];
    const stuUpdates = [];   // [{ rowIdx, newHP }]
    const now = _nowJST();

    for (let t = 0; t < TARGETS.length; t++) {
      const target = TARGETS[t];
      const sid = target.sid;
      const label = sid + ' ' + target.name;

      // 二重実行チェック: type='apology_wabun1' かつ message に TARGET_DATE を含む既存記録
      let alreadyDone = false;
      for (let r = 0; r < logValues.length; r++) {
        const row = logValues[r];
        const rSid  = String(row[log.cSid]  != null ? row[log.cSid]  : '').trim();
        const rType = String(row[log.cType] != null ? row[log.cType] : '').trim();
        const rMsg  = String(row[log.cMessage] != null ? row[log.cMessage] : '');
        if (rSid === sid && rType === APOLOGY_TYPE && rMsg.indexOf(TARGET_DATE) >= 0) {
          alreadyDone = true;
          break;
        }
      }
      if (alreadyDone) {
        Logger.log('[SKIP] ' + label + ' : 既に ' + TARGET_DATE + ' 分のお詫び付与記録あり');
        summary.skipped += 1;
        summary.results.push({ sid: sid, name: target.name, status: 'skipped', reason: 'already_processed' });
        continue;
      }

      // Students シートに該当行があるか
      const rowIdx = sidToRow[sid];
      if (rowIdx == null) {
        Logger.log('[ERROR] ' + label + ' : Students シートに該当 ID なし');
        summary.errors += 1;
        summary.results.push({ sid: sid, name: target.name, status: 'error', reason: 'student_not_found' });
        continue;
      }

      const totalAdd = target.baseHp + THANKS_HP;
      const oldHP = Number(stuValues[rowIdx][COL_HP]) || 0;
      const newHP = oldHP + totalAdd;

      // HPLog 行 1: お詫び付与（素点HP × 連続週数²）
      const apologyRow = new Array(log.lastCol).fill('');
      if (log.cTimestamp >= 0) apologyRow[log.cTimestamp] = now;
      if (log.cSid       >= 0) apologyRow[log.cSid]       = sid;
      if (log.cRawHP     >= 0) apologyRow[log.cRawHP]     = target.baseHp;
      if (log.cHpGained  >= 0) apologyRow[log.cHpGained]  = target.baseHp;
      if (log.cType      >= 0) apologyRow[log.cType]      = APOLOGY_TYPE;
      if (log.cMessage   >= 0) apologyRow[log.cMessage]   = APOLOGY_MESSAGE;
      newLogRows.push(apologyRow);

      // HPLog 行 2: バグ報告協力のお礼（一律 1,000HP）
      const thanksRow = new Array(log.lastCol).fill('');
      if (log.cTimestamp >= 0) thanksRow[log.cTimestamp] = now;
      if (log.cSid       >= 0) thanksRow[log.cSid]       = sid;
      if (log.cRawHP     >= 0) thanksRow[log.cRawHP]     = THANKS_HP;
      if (log.cHpGained  >= 0) thanksRow[log.cHpGained]  = THANKS_HP;
      if (log.cType      >= 0) thanksRow[log.cType]      = THANKS_TYPE;
      if (log.cMessage   >= 0) thanksRow[log.cMessage]   = THANKS_MESSAGE;
      newLogRows.push(thanksRow);

      stuUpdates.push({ rowIdx: rowIdx, oldHP: oldHP, newHP: newHP, totalAdd: totalAdd });
      summary.processed += 1;
      summary.totalHpAdded += totalAdd;
      summary.results.push({
        sid: sid, name: target.name, status: 'ok',
        baseHp: target.baseHp, thanksHp: THANKS_HP, totalAdd: totalAdd,
        oldHP: oldHP, newHP: newHP
      });
      Logger.log('[OK] ' + label + ' : +' + totalAdd + 'HP (素点' + target.baseHp + ' + お礼' + THANKS_HP + ') / HP ' + oldHP + ' → ' + newHP);
    }

    // 一括書き込み（HPLog → Students の順、片方失敗時の整合性は最低限維持）
    if (newLogRows.length > 0) {
      const startRow = log.sh.getLastRow() + 1;
      log.sh.getRange(startRow, 1, newLogRows.length, log.lastCol).setValues(newLogRows);
      Logger.log('[HPLog] ' + newLogRows.length + ' 行追記 (row ' + startRow + ' から)');
    }
    for (let u = 0; u < stuUpdates.length; u++) {
      const upd = stuUpdates[u];
      stuSheet.getRange(upd.rowIdx + 1, COL_HP + 1).setValue(upd.newHP);
    }
    if (stuUpdates.length > 0) {
      _invalidateCache('cache_students_values');
      _invalidateCache('cache_ranking_last_week');
      Logger.log('[Students] ' + stuUpdates.length + ' 名の HP を更新 / cache invalidate 完了');
    }

    Logger.log('=== 完了: 処理 ' + summary.processed + ' / スキップ ' + summary.skipped + ' / エラー ' + summary.errors + ' / 合計 +' + summary.totalHpAdded + 'HP ===');
    return { ok: true, summary: summary };
  } catch (err) {
    Logger.log('[apologyWabun1MonyoBug_20260502] FATAL: ' + err);
    console.error('[apologyWabun1MonyoBug_20260502]', err);
    return { ok: false, message: String(err), summary: summary };
  }
}

// ============================================================
// カンジー（漢字）コンテンツ（2026-05-02 新規）
// ============================================================
// シート構成:
//   KanjiYomi (11 列): セット番号 | 問番号 | 漢字ID | 漢字 | 問題 | 選A | 選B | 選C | 選D | 正解 | 級
//   KanjiKaki ( 7 列): セット番号 | 問番号 | 漢字ID | 漢字 | 問題 | 書き正解 | 級
// 級表記: '5' / '4' / '3' / '準2' / '2'（漢検 5級〜2級）
// 強調マーカー: 問題文中の {xxx} は出題ターゲット部分、フロントで色付き表示
// HP: rawHP = 50（10問セット）/ 100（20問セット）。1日 100HP 上限（kanji 内独立）。
//     上限到達後は練習モード（HP 加算なし）。連続週²ボーナスは他コンテンツと同じ。
//     合格判定は読み 全問正解 → 書き 全問正解 の二段階（2026-05-08 仕様変更）。
//     ふくちさん 36 年経験「漢字は英単語と同様に『知識』なので、全問正解が理にかなってる。
//     基礎計算は思考系なので 8 割で良し」の教育的判断に基づく。英単語RUSH と同じく満点合格。
// HPLog type: 'kanji_<level>_<count>' or 'kanji_<level>_<count>_practice'
//   level は '5' / '4' / '3' / '準2' / '2'（'準' を含むため _ で区切ると 'kanji_準2_10' になる点に注意）
const SHEET_KANJI_YOMI = 'KanjiYomi';
const SHEET_KANJI_KAKI = 'KanjiKaki';
// 2026-05-12 バグ⑤ Phase B（案A）：書き判定結果の永続化用シート。軽量版F'。
// 1 提出ごとに各問 1 行ずつ appendRow（5 問セットで 5 行、10 問セットで 10 行）。
// 「正しく書いたのに ❌」報告時の事後検証 / プロンプト調整評価の基盤。
const SHEET_KANJI_SUBMISSIONS = 'KanjiSubmissions';
const KANJI_VALID_LEVELS = ['5', '4', '3', '準2', '2'];
const KANJI_DAILY_RAWHP_CAP = 100;
const KANJI_PASS_RATIO = 1.0;  // 2026-05-08 0.8 → 1.0（全問正解で合格）。知識系コンテンツとしての英単語RUSH 整合
const KANJI_YOMI_HEADERS = ['セット番号', '問番号', '漢字ID', '漢字', '問題', '選A', '選B', '選C', '選D', '正解', '級'];
const KANJI_KAKI_HEADERS = ['セット番号', '問番号', '漢字ID', '漢字', '問題', '書き正解', '級'];
// KanjiSubmissions（9 列）: timestamp / sid / level / sessionId / no / expected / studentWrote / isCorrect / readable
// - readable: 'yes'（読み取れた）/ 'no'（判別不能）/ 'blank'（答え欄空白）
// - needsRetake=true で採点保留になった提出も記録（再撮影誘導の発生も追跡）
const KANJI_SUBMISSIONS_HEADERS = ['timestamp', 'sid', 'level', 'sessionId', 'no', 'expected', 'studentWrote', 'isCorrect', 'readable'];

// シート初期化（GAS エディタから手動 1 回実行する想定、冪等）
function ensureKanjiSheets() {
  const ss = _ss();
  let ySheet = ss.getSheetByName(SHEET_KANJI_YOMI);
  if (!ySheet) {
    ySheet = ss.insertSheet(SHEET_KANJI_YOMI);
    ySheet.getRange(1, 1, 1, KANJI_YOMI_HEADERS.length).setValues([KANJI_YOMI_HEADERS]);
    ySheet.setFrozenRows(1);
    Logger.log('[ensureKanjiSheets] KanjiYomi シートを新規作成しました');
  } else {
    Logger.log('[ensureKanjiSheets] KanjiYomi シートは既に存在します');
  }
  let kSheet = ss.getSheetByName(SHEET_KANJI_KAKI);
  if (!kSheet) {
    kSheet = ss.insertSheet(SHEET_KANJI_KAKI);
    kSheet.getRange(1, 1, 1, KANJI_KAKI_HEADERS.length).setValues([KANJI_KAKI_HEADERS]);
    kSheet.setFrozenRows(1);
    Logger.log('[ensureKanjiSheets] KanjiKaki シートを新規作成しました');
  } else {
    Logger.log('[ensureKanjiSheets] KanjiKaki シートは既に存在します');
  }
  // 2026-05-12 バグ⑤ Phase B：KanjiSubmissions シート（書き判定結果の永続化）
  let sSheet = ss.getSheetByName(SHEET_KANJI_SUBMISSIONS);
  if (!sSheet) {
    sSheet = ss.insertSheet(SHEET_KANJI_SUBMISSIONS);
    sSheet.getRange(1, 1, 1, KANJI_SUBMISSIONS_HEADERS.length).setValues([KANJI_SUBMISSIONS_HEADERS]);
    sSheet.setFrozenRows(1);
    Logger.log('[ensureKanjiSheets] KanjiSubmissions シートを新規作成しました');
  } else {
    Logger.log('[ensureKanjiSheets] KanjiSubmissions シートは既に存在します');
  }
  return { ok: true, message: 'カンジー用シートを確認/作成しました（KanjiYomi / KanjiKaki / KanjiSubmissions）' };
}

// セッション ID 生成（kanji_{studentId}_{ts}_{random}）
function _kanjiSessionId(studentId) {
  const ts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  const rand = Math.random().toString(36).substring(2, 8);
  return 'kanji_' + String(studentId).trim() + '_' + ts + '_' + rand;
}

// 当日（教育日基準）の kanji rawHP 合計（_practice 接尾は除外）
function _kanjiTodayRawHP(studentId) {
  const sh = _ss().getSheetByName(SHEET_HPLOG);
  if (!sh) return 0;
  const today = _todayEducationalJST();
  const data = _readLastNRows(sh, 200);
  // HPLog 列: timestamp(0) / studentId(1) / rawHP(2) / hpGained(3) / type(4) / message(5)
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]).trim() !== String(studentId).trim()) continue;
    const type = String(row[4] || '');
    if (type.indexOf('kanji_') !== 0) continue;
    if (type.length >= 9 && type.lastIndexOf('_practice') === type.length - 9) continue;
    const dateStr = _toEducationalDateStr(row[0]);
    if (dateStr !== today) continue;
    total += Number(row[2]) || 0;
  }
  return total;
}

// 当日素点の公開 API（フロントの問題数選択画面で「あと N HP」表示用）
function getKanjiTodayRawHP(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    const todayRawHP = _kanjiTodayRawHP(sid);
    const cap = KANJI_DAILY_RAWHP_CAP;
    const remaining = Math.max(0, cap - todayRawHP);
    return {
      ok: true,
      studentId: sid,
      todayRawHP: todayRawHP,
      remaining: remaining,
      isAtLimit: remaining === 0,
      cap: cap
    };
  } catch (err) {
    console.error('[getKanjiTodayRawHP]', err);
    return { ok: false, message: String(err) };
  }
}

// KanjiYomi / KanjiKaki シートから「セット番号でペアリングした」問題セットを返す
// 2026-05-08 仕様変更：英単語RUSH と同様、セット番号 → 問題番号順で「上から順に」拾う。
//   - 漢字ID は内部キーとしては保持するが、ペアリングには使わない（v2 引き継ぎ書 §出題ロジック）
//   - 「次にやるセット番号」は PropertiesService（kanji_next_<sid>_<level>）で生徒ごと追跡
//   - 不合格時は next を更新しない（同じセットで再挑戦）→ submitKanjiKaki 合格時のみ +1/+2
//   - 級の最終セットを超えたら 1 に戻す（無限ループ可能）
//
// params: { studentId, level, count }
//   - level: '5' / '4' / '3' / '準2' / '2'（bare 表記）
//   - count: 5 or 10（読みの問題数。書きも同数）
//   - count=5  → 1 セット = 読み 5 + 書き 5
//   - count=10 → 連続する 2 セット = 読み 10 + 書き 10
//
// 戻り値（フロント互換性のため既存ペア構造 + 進捗 hint を追加）:
//   { ok:true, sessionId, level, count, questions:[{kanjiId, kanji, yomi:{question, choices, correct}, kaki:{question, answer}}],
//     setNumbers:[N, ...], maxSetForLevel }
function getKanjiSet(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    const level = String((params && params.level) || '').trim();
    const count = parseInt((params && params.count) || 0, 10) || 0;
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    if (KANJI_VALID_LEVELS.indexOf(level) < 0) return { ok: false, message: 'レベル指定が不正です' };
    if (count !== 5 && count !== 10) return { ok: false, message: '問題数は 5 または 10 を指定してください' };

    const ss = _ss();
    const ySheet = ss.getSheetByName(SHEET_KANJI_YOMI);
    const kSheet = ss.getSheetByName(SHEET_KANJI_KAKI);
    if (!ySheet || !kSheet || ySheet.getLastRow() < 2 || kSheet.getLastRow() < 2) {
      return { ok: false, message: 'このレベルの問題はまだ準備中だよ。もう少し待っててね！' };
    }
    const yRows = ySheet.getDataRange().getValues();
    const kRows = kSheet.getDataRange().getValues();
    // ヘッダーは固定（仕様）。列インデックスは 0 始まりで定数化
    // KanjiYomi: 0=セット 1=問 2=ID 3=漢字 4=問題 5=A 6=B 7=C 8=D 9=正解 10=級
    // KanjiKaki: 0=セット 1=問 2=ID 3=漢字 4=問題 5=書き正解 6=級
    // K/G 列の値は '5級' / '4級' / '3級' / '準2級' / '2級' 形式。bare level からの正規化キーで突合する。
    const levelKey = (level === '準2') ? '準2級' : (level + '級');

    // セット番号 → 問題行配列（問番号順にソート）
    const yomiBySet = {};
    for (let i = 1; i < yRows.length; i++) {
      const r = yRows[i];
      if (String(r[10] || '').trim() !== levelKey) continue;
      const sn = parseInt(r[0], 10);
      if (!sn) continue;
      if (!yomiBySet[sn]) yomiBySet[sn] = [];
      yomiBySet[sn].push(r);
    }
    const kakiBySet = {};
    for (let i = 1; i < kRows.length; i++) {
      const r = kRows[i];
      if (String(r[6] || '').trim() !== levelKey) continue;
      const sn = parseInt(r[0], 10);
      if (!sn) continue;
      if (!kakiBySet[sn]) kakiBySet[sn] = [];
      kakiBySet[sn].push(r);
    }

    // 両シートに存在するセット番号の集合（昇順ソート）
    const availableSets = Object.keys(yomiBySet)
      .filter(function(sn){ return !!kakiBySet[sn]; })
      .map(function(sn){ return parseInt(sn, 10); })
      .sort(function(a, b){ return a - b; });
    if (availableSets.length === 0) {
      return { ok: false, message: 'このレベルの問題はまだ準備中だよ。もう少し待っててね！' };
    }
    const minSet = availableSets[0];
    const maxSet = availableSets[availableSets.length - 1];
    const availableSet = {};
    availableSets.forEach(function(sn){ availableSet[sn] = true; });

    // PropertiesService から「次にやるセット番号」を取得（初期値 1）
    const propKey = 'kanji_next_' + sid + '_' + level;
    let nextSetNum = parseInt(_props().getProperty(propKey) || String(minSet), 10);
    if (!nextSetNum || nextSetNum > maxSet || nextSetNum < minSet) nextSetNum = minSet;

    // count に応じてセット数（5問=1セット / 10問=2セット）
    const setsNeeded = (count === 10) ? 2 : 1;
    const targetSets = [];
    let cursor = nextSetNum;
    let safety = availableSets.length + 5;  // 無限ループ防止
    while (targetSets.length < setsNeeded && safety-- > 0) {
      if (cursor > maxSet) cursor = minSet;
      if (availableSet[cursor]) {
        targetSets.push(cursor);
      }
      cursor++;
    }
    if (targetSets.length === 0) {
      return { ok: false, message: 'このレベルの問題はまだ準備中だよ。もう少し待っててね！' };
    }

    // questions 配列を構築（セット番号順、問番号順）
    // 既存フロントが期待するペア構造：[{kanjiId, kanji, yomi, kaki}]
    // セット番号 N の問番号 i 番目同士をそのまま並べる（漢字 ID は表示しないので一致不要）
    const questions = [];
    targetSets.forEach(function(sn){
      const yomiRows = (yomiBySet[sn] || []).slice().sort(function(a, b){ return parseInt(a[1], 10) - parseInt(b[1], 10); });
      const kakiRows = (kakiBySet[sn] || []).slice().sort(function(a, b){ return parseInt(a[1], 10) - parseInt(b[1], 10); });
      const pairLen = Math.min(yomiRows.length, kakiRows.length);
      for (let i = 0; i < pairLen; i++) {
        const y = yomiRows[i];
        const k = kakiRows[i];
        questions.push({
          // kanjiId は読み・書きで体系が違うため pair の鍵に使わないが、
          // 既存フロント（_retryKanjiKaki の idSet 構築 / 再挑戦時の対象抽出）が
          // q.kanjiId に依存しているので、再挑戦時に一意に識別できる合成 ID を採用する。
          // 形式: 'set<setNum>_q<問番号>'（同セッション内ユニーク、生徒解答経路に閉じる）
          kanjiId: 'set' + sn + '_q' + parseInt(y[1], 10),
          kanji:   String(y[3] || k[3] || '').trim(),
          yomi: {
            question: String(y[4] || ''),
            choices: {
              A: String(y[5] || ''),
              B: String(y[6] || ''),
              C: String(y[7] || ''),
              D: String(y[8] || '')
            },
            correct: String(y[9] || '').trim().toUpperCase()
          },
          kaki: {
            question: String(k[4] || ''),
            answer:   String(k[5] || '').trim()
          },
          // 参考情報（クライアント側で必要なら表示可能）
          setNum: sn,
          qNum: parseInt(y[1], 10)
        });
      }
    });

    if (questions.length === 0) {
      return { ok: false, message: 'このレベルの問題はまだ準備中だよ。もう少し待っててね！' };
    }

    const sessionId = _kanjiSessionId(sid);
    return {
      ok: true,
      sessionId: sessionId,
      level: level,
      count: questions.length,
      requestedCount: count,
      setNumbers: targetSets,
      maxSetForLevel: maxSet,
      questions: questions
    };
  } catch (err) {
    console.error('[getKanjiSet]', err);
    return { ok: false, message: String(err) };
  }
}

// 指定級の最大セット番号（読み・書き両方に存在するものの最大）
function _getMaxKanjiSetNum(level) {
  const ss = _ss();
  const ySheet = ss.getSheetByName(SHEET_KANJI_YOMI);
  const kSheet = ss.getSheetByName(SHEET_KANJI_KAKI);
  if (!ySheet || !kSheet) return 0;
  const levelKey = (level === '準2') ? '準2級' : (level + '級');
  const yRows = ySheet.getDataRange().getValues();
  const kRows = kSheet.getDataRange().getValues();
  const ySet = {};
  for (let i = 1; i < yRows.length; i++) {
    if (String(yRows[i][10] || '').trim() !== levelKey) continue;
    const sn = parseInt(yRows[i][0], 10);
    if (sn) ySet[sn] = true;
  }
  let maxN = 0;
  for (let i = 1; i < kRows.length; i++) {
    if (String(kRows[i][6] || '').trim() !== levelKey) continue;
    const sn = parseInt(kRows[i][0], 10);
    if (!sn || !ySet[sn]) continue;
    if (sn > maxN) maxN = sn;
  }
  return maxN;
}

// 指定級の最小セット番号（リセット時の戻り先）
function _getMinKanjiSetNum(level) {
  const ss = _ss();
  const ySheet = ss.getSheetByName(SHEET_KANJI_YOMI);
  const kSheet = ss.getSheetByName(SHEET_KANJI_KAKI);
  if (!ySheet || !kSheet) return 1;
  const levelKey = (level === '準2') ? '準2級' : (level + '級');
  const yRows = ySheet.getDataRange().getValues();
  const kRows = kSheet.getDataRange().getValues();
  const ySet = {};
  for (let i = 1; i < yRows.length; i++) {
    if (String(yRows[i][10] || '').trim() !== levelKey) continue;
    const sn = parseInt(yRows[i][0], 10);
    if (sn) ySet[sn] = true;
  }
  let minN = 0;
  for (let i = 1; i < kRows.length; i++) {
    if (String(kRows[i][6] || '').trim() !== levelKey) continue;
    const sn = parseInt(kRows[i][0], 10);
    if (!sn || !ySet[sn]) continue;
    if (minN === 0 || sn < minN) minN = sn;
  }
  return minN || 1;
}

// 読み問題の採点（HP は加算しない）
// params: { studentId, level, sessionId, answers:[{kanjiId, chosen}] }
//   - chosen: 'A' / 'B' / 'C' / 'D'
//   - kanjiId は getKanjiSet が返した合成 ID 'set<N>_q<n>' 形式（2026-05-08 仕様）
// 戻り値: { ok, passed, correctCount, total, results:[{kanjiId, chosen, correct, isCorrect}] }
function submitKanjiYomi(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    const level = String((params && params.level) || '').trim();
    const rawAnswers = (params && params.answers) || [];
    let answers = rawAnswers;
    if (typeof rawAnswers === 'string') {
      try { answers = JSON.parse(rawAnswers); } catch(e) { answers = []; }
    }
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    if (KANJI_VALID_LEVELS.indexOf(level) < 0) return { ok: false, message: 'レベル指定が不正です' };
    if (!Array.isArray(answers) || answers.length === 0) return { ok: false, message: '解答データがありません' };

    // サーバー側で正解を再ルックアップ（クライアント信頼を避ける）
    // 2026-05-08 修正：以下 2 バグを解消
    //   (a) 旧コード `if (lv !== level) continue;` は K列='5級' vs level='5' で常に不一致 → correctMap 空
    //       → levelKey で正規化（'5' → '5級' 等）してから比較
    //   (b) 旧コードは漢字ID列（C列、'K5_189' 等）で correctMap キー化していたが、
    //       getKanjiSet が返す合成 ID 'set<N>_q<n>' とは別体系。
    //       → setNum + qNum を合成キー化して getKanjiSet と整合
    const levelKey = (level === '準2') ? '準2級' : (level + '級');
    const ySheet = _ss().getSheetByName(SHEET_KANJI_YOMI);
    if (!ySheet || ySheet.getLastRow() < 2) return { ok: false, message: 'KanjiYomi シートが見つかりません' };
    const yRows = ySheet.getDataRange().getValues();
    const correctByKey = {};  // keyed by 'set<N>_q<n>'
    for (let i = 1; i < yRows.length; i++) {
      const r = yRows[i];
      if (String(r[10] || '').trim() !== levelKey) continue;
      const sn = parseInt(r[0], 10);
      const qn = parseInt(r[1], 10);
      if (!sn || !qn) continue;
      correctByKey['set' + sn + '_q' + qn] = String(r[9] || '').trim().toUpperCase();
    }

    let correctCount = 0;
    const results = answers.map(function(a){
      const kid = String((a && a.kanjiId) || '').trim();
      const chosen = String((a && a.chosen) || '').trim().toUpperCase();
      const expected = correctByKey[kid] || '';
      const isCorrect = !!expected && chosen === expected;
      if (isCorrect) correctCount += 1;
      return { kanjiId: kid, chosen: chosen, correct: expected, isCorrect: isCorrect };
    });
    const total = results.length;
    // 2026-05-08 仕様変更：全問正解で合格（KANJI_PASS_RATIO = 1.0）。
    // 厳密一致比較で「count に依存しない」シンプルな判定に統一（10問セット時の 5/10 など bug の根絶）。
    const passed = total > 0 && correctCount === total;
    return { ok: true, passed: passed, correctCount: correctCount, total: total, results: results };
  } catch (err) {
    console.error('[submitKanjiYomi]', err);
    return { ok: false, message: String(err) };
  }
}

// カンジー書き問題：Gemini Vision で OCR + 正解照合 + HP 加算
// params: { studentId, level, sessionId, photoBase64, count, expectedAnswers, isRetry }
//   - count: 全体セットの問題数（5 or 10、HP 計算用。再挑戦時も元の count を渡す）
//   - expectedAnswers: [{kanjiId, no, answer}] 各問の正解（再挑戦時は不正解のみ）
//   - isRetry: true なら再挑戦（HP 上限判定はパス済みで合格時は付与）
// 戻り値:
//   通常採点時:    { ok, passed, needsRetake:false, correctCount, total, results, hpInfo, isRetry, attempts }
//   再撮影誘導時:  { ok, passed:false, needsRetake:true, retakeReasonNos:[3,7], total, attempts, message }
//   ※ results[].studentWrote / readable は Vision の判定結果（フロント表示用）
//   ※ ocrText フィールドは案 A で廃止（互換性のため空文字を返す）
function submitKanjiKaki(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    const level = String((params && params.level) || '').trim();
    const sessionId = String((params && params.sessionId) || '').trim();
    const photoBase64 = String((params && params.photoBase64) || '');
    const count = parseInt((params && params.count) || 0, 10) || 0;
    const isRetry = !!(params && params.isRetry);
    const rawExpected = (params && params.expectedAnswers) || [];
    let expectedAnswers = rawExpected;
    if (typeof rawExpected === 'string') {
      try { expectedAnswers = JSON.parse(rawExpected); } catch(e) { expectedAnswers = []; }
    }
    if (!sid)   return { ok: false, message: '生徒IDが必要です' };
    if (KANJI_VALID_LEVELS.indexOf(level) < 0) return { ok: false, message: 'レベル指定が不正です' };
    if (!photoBase64) return { ok: false, message: '画像データがありません' };
    if (!Array.isArray(expectedAnswers) || expectedAnswers.length === 0) {
      return { ok: false, message: '正解データがありません' };
    }
    if (count !== 5 && count !== 10) return { ok: false, message: '問題数は 5 または 10 を指定してください' };

    // 2026-05-12 バグ⑤ Phase B（案 A）：
    // 旧 _kanjiOcrWithGemini（自由 OCR + cursor 前進 indexOf 照合）から
    // _kanjiJudgeWithGemini（正解候補ヒント付き判定タスク）に切り替え。
    // 判定結果は Vision から直接 results 配列で返ってくるため、サーバ側の
    // 文字列突合は不要になる。
    const judgeRes = _kanjiJudgeWithGemini(photoBase64, expectedAnswers);
    if (!judgeRes || !judgeRes.ok) return judgeRes || { ok: false, message: '判定に失敗しました' };

    // judgeRes.results は [{ no, match, studentWrote, readable }, ...] 形式。
    // expectedAnswers と同順で並んでいる（_kanjiJudgeWithGemini 内で索引化済）。
    // 採点 + 再撮影誘導の判定：
    //   readable='no' の問が 1 つでもあれば「採点保留 + 再撮影誘導」を発動。
    //   この場合、HP 加算もセット進捗更新もしない（生徒の答案ノートはそのまま使える）。
    //   readable='blank' は「書き忘れ」なので不正解扱い（通常採点を継続）。
    const judgeResults = Array.isArray(judgeRes.results) ? judgeRes.results : [];
    const retakeReasonNos = [];
    judgeResults.forEach(function(r, idx){
      if (r && r.readable === 'no') {
        retakeReasonNos.push(Number((r && r.no) || (idx + 1)));
      }
    });
    const needsRetake = retakeReasonNos.length > 0;

    // results の正規化（expectedAnswers との対応保持）
    let correctCount = 0;
    const results = expectedAnswers.map(function(e, idx){
      const judgeItem = judgeResults[idx] || {};
      const ans = String((e && e.answer) || '').trim();
      const isCorrect = !!judgeItem.match;
      if (isCorrect) correctCount += 1;
      return {
        kanjiId:      String((e && e.kanjiId) || ''),
        no:           Number((e && e.no) || 0),
        expected:     ans,
        isCorrect:    isCorrect,
        studentWrote: String(judgeItem.studentWrote || ''),
        readable:     String(judgeItem.readable || '')
      };
    });
    const total = results.length;

    // KanjiSubmissions シートに判定結果を永続化（軽量版 F'、needsRetake でも記録）
    // 生徒からの「正しく書いたのに ❌」報告に対する事後検証 + プロンプト調整の基盤。
    try {
      const subSheet = _ss().getSheetByName(SHEET_KANJI_SUBMISSIONS);
      if (subSheet) {
        const ts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
        results.forEach(function(r){
          subSheet.appendRow([
            ts,
            sid,
            level,
            sessionId,
            r.no,
            r.expected,
            r.studentWrote,
            r.isCorrect,
            r.readable
          ]);
        });
        SpreadsheetApp.flush();  // v12 教訓（CLAUDE.md）：appendRow 直後の flush で別 execution への反映保証
      } else {
        console.error('[submitKanjiKaki] KanjiSubmissions シートが存在しません。ensureKanjiSheets() を実行してください。');
      }
    } catch (writeErr) {
      console.error('[submitKanjiKaki KanjiSubmissions write]', writeErr);
      // 永続化失敗時もユーザー応答は継続（採点結果は返す）
    }

    // 再撮影誘導時：採点 + HP 付与をスキップして即座に返却
    // 生徒画面では「読み取れなかった問X があります、もう一度撮影してね」と
    // 表示し、kanji_next も進めない（不合格扱いではないため）。
    if (needsRetake) {
      return {
        ok: true,
        passed: false,
        needsRetake: true,
        retakeReasonNos: retakeReasonNos,
        total: total,
        results: results,                  // フロントが必要なら参照可だが通常は使わない
        attempts: judgeRes.attempts || 1,
        message: '読み取れなかった答えがあります（問 ' + retakeReasonNos.join('、') + '）'
      };
    }

    // 通常採点（合格判定）：全問正解で合格（KANJI_PASS_RATIO = 1.0）。
    // 知識系コンテンツ方針（5/8 ふくちさん哲学）。書きも読みと同じ満点合格。
    const passed = total > 0 && correctCount === total;

    // HP 加算判定（合格時のみ）
    // 2026-05-09 Step 0：行シフト事故防止のため、書き込み対象行はシートから sid で
    // フレッシュに特定する（cache 経由禁止）。
    const stuLoc = passed ? _findAccountRowOnSheet(sid) : null;

    let hpInfo = { rawHP: 0, hpGained: 0, granted: false, isPractice: false, alreadyAtCap: false };
    if (passed) {
      const baseRawHP = (count === 10) ? 100 : 50;
      const todayRawHP = _kanjiTodayRawHP(sid);
      const remaining = Math.max(0, KANJI_DAILY_RAWHP_CAP - todayRawHP);
      const grantedRawHP = Math.min(baseRawHP, remaining);
      const isPractice = (remaining === 0);
      const alreadyAtCap = (remaining === 0);

      if (grantedRawHP > 0 && stuLoc) {
        const streak = Number(stuLoc.rowValues[COL_STREAK]) || 1;
        const week = Math.ceil(streak / 7);
        const hpGained = grantedRawHP * week * week;

        // 2026-05-12 バグ④-本質 Phase B（案 A）：書き込み順序を _logHP → Students に変更。
        // HPLog 書き込み失敗時は Students.HP / 進捗（kanji_next）更新をスキップして
        // エラー応答を返す。KanjiSubmissions は既に appendRow 済み（事後検証に有用）。
        // 同じセットを再挑戦すれば次回成功で救済される。
        const logRes = _logHP(sid, grantedRawHP, hpGained, 'kanji_' + level + '_' + count);
        if (!logRes.ok) {
          console.error('[submitKanjiKaki] HPLog 書き込みに失敗しました。HP/進捗を更新せず終了。', logRes.error);
          return { ok: false, message: '内部エラーが発生しました。もう一度試してください。', errorCode: 'HP_LOG_FAILED' };
        }

        const cur = Number(stuLoc.rowValues[COL_HP]) || 0;
        const newHP = cur + hpGained;
        stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_HP + 1).setValue(newHP);
        const upd = {}; upd[COL_HP] = newHP;
        _updateAccountCacheBySid(sid, upd);
        _invalidateCache('cache_ranking_last_week');
        hpInfo = { rawHP: grantedRawHP, hpGained: hpGained, granted: true, isPractice: false, alreadyAtCap: false, streak: streak, week: week };
      } else if (isPractice) {
        // 練習モード（既に上限到達）：HPLog にも記録するが _practice 接尾で除外可能に。
        // 練習モードは付与する HP がないため、_logHP 失敗時も警告ログのみで処理を継続する
        // （戻り値を無視）。進捗更新は実施される。
        _logHP(sid, 0, 0, 'kanji_' + level + '_' + count + '_practice');
        hpInfo = { rawHP: 0, hpGained: 0, granted: false, isPractice: true, alreadyAtCap: true };
      }

      // 進捗追跡：合格時のみ「次にやるセット番号」をインクリメント
      // (5 問セット → +1、10 問セット → +2)。級の最終セットを超えたら最初に戻す。
      // 練習モードでも next は更新（HP は付与されないが進捗は進める = 学習の連続性優先）
      try {
        const propKey = 'kanji_next_' + sid + '_' + level;
        const propsSvc = _props();
        const minSet = _getMinKanjiSetNum(level);
        const maxSet = _getMaxKanjiSetNum(level);
        let curNext = parseInt(propsSvc.getProperty(propKey) || String(minSet), 10);
        if (!curNext || curNext < minSet || curNext > maxSet) curNext = minSet;
        const advance = (count === 10) ? 2 : 1;
        let newNext = curNext + advance;
        if (newNext > maxSet) newNext = minSet;  // 級を一周したら最初に戻す
        propsSvc.setProperty(propKey, String(newNext));
      } catch (progressErr) {
        console.error('[submitKanjiKaki progress update]', progressErr);
        // 進捗更新失敗時もユーザー応答は成功扱い（HP は加算済み）
      }
    }

    return {
      ok: true,
      passed: passed,
      needsRetake: false,
      correctCount: correctCount,
      total: total,
      results: results,
      hpInfo: hpInfo,
      // 案 A では生 OCR テキスト全文は取得しない（判定タスクのため）。
      // フロント互換性のため空文字を返す（フロント側で details ブロックを出さなくなる）。
      ocrText: '',
      isRetry: isRetry,
      attempts: judgeRes.attempts || 1
    };
  } catch (err) {
    console.error('[submitKanjiKaki]', err);
    return { ok: false, message: String(err) };
  }
}

// カンジー履歴（おさらい画面用）：HPLog から sid のカンジー実施履歴を新しい順に返す
// type 'kanji_<level>_<count>' / 'kanji_<level>_<count>_practice' をパース。
// セット番号は HPLog に記録されないため一覧のみ（クリックで問題内容再表示は将来課題）。
function getKanjiHistory(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    const sh = _ss().getSheetByName(SHEET_HPLOG);
    if (!sh || sh.getLastRow() < 2) return { ok: true, history: [] };
    const rows = _readLastNRows(sh, 2000);
    // HPLog 列: [0]timestamp [1]studentId [2]rawHP [3]hpGained [4]type [5]message
    const history = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (String(r[1] || '').trim() !== sid) continue;
      const type = String(r[4] || '').trim();
      if (type.indexOf('kanji_') !== 0) continue;
      const m = /^kanji_(準?\d+)_(\d+)(_practice)?$/.exec(type);
      if (!m) continue;
      let ts;
      try { ts = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'); }
      catch (e) { ts = String(r[0] || ''); }
      history.push({
        timestamp:  ts,
        date:       ts.slice(0, 10),
        level:      m[1],
        count:      parseInt(m[2], 10),
        hpGained:   Number(r[3]) || 0,
        rawHP:      Number(r[2]) || 0,
        isPractice: !!m[3]
      });
    }
    history.sort(function(a, b){
      return a.timestamp < b.timestamp ? 1 : (a.timestamp > b.timestamp ? -1 : 0);
    });
    return { ok: true, history: history };
  } catch (err) {
    console.error('[getKanjiHistory]', err);
    return { ok: false, message: String(err) };
  }
}

// OCR 照合用の軽い正規化（kanji 比較が中心なので、空白・全半角の揺れだけ吸収）
function _kanjiNormalizeText(s) {
  if (s == null) return '';
  let t = String(s);
  // 全角英数 → 半角（かな・漢字は保持）
  t = t.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(ch){
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
  // 空白系すべて削除（半角/全角スペース/タブ/改行/zero-width）
  t = t.replace(/[\s　​‌‍⁠﻿]+/g, '');
  return t;
}

// Gemini Vision で手書き漢字答案を OCR
// 戻り値: { ok, ocrText, attempts } | { ok:false, message, retake? }
function _kanjiOcrWithGemini(imageBase64) {
  const apiKey = _props().getProperty('GEMINI_API_KEY');
  if (!apiKey) return { ok: false, message: 'GEMINI_API_KEY が設定されていません' };
  const model = 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  // 2026-05-08 厳格化：「字形が概ね正しければ」の寛容指示を削除し、偏旁の同定を厳格に。
  // 背景：5 級書き取りで生徒の「即読」（誤字）を「朗読」と OCR 誤認識し正解判定された事故。
  // submitKanjiKaki 側の cursor 前進方式は indexOf による完全部分文字列マッチで既に厳密
  // （Node 検証 7/7 PASS、CLAUDE.md 採点ロジック表参照）。真因は OCR が字形の似た別漢字
  // を「気を利かせて」正解側に寄せていた点にあるため、プロンプトで明示的に禁じる。
  //
  // 2026-05-08 夜 追加強化：5 級書き取りで「怒鳴→焚き / 網→称 / 齢→断」のような
  // 字形が完全に遠い別漢字への誤読が発生（生徒①の実害報告）。原因は 5/7 夜厳格化で
  // 補正禁止になった結果、Gemini Vision の素の認識精度の限界が露呈したこと。複合要因：
  //   - 漢字境界のセグメンテーション失敗（「怒鳴」2文字を「焚き」1文字+仮名と読み違える）
  //   - 答案用紙内の問題文や設問との混在
  //   - 撮影環境（影・畳・紙質）への耐性
  //   - 複雑漢字（10 画以上）の細部解像不足
  // → 厳格モード（補正禁止）は維持しつつ、認識順序 / 答案領域 / 背景除去 / 複雑漢字の
  //    判別困難時の挙動の 4 ブロックを追加。さらに反例「焚き/怒鳴・称/網・断/齢」を
  //    明示して飛躍誤読を防ぐ。画像パイプラインも 1600/0.85 に強化（index.html 側）。
  const prompt =
    'これは小中高生の手書きの漢字答案です。採点に直結するため、書かれた字形を厳格に読み取ってください。\n' +
    '\n' +
    '【書式の前提】\n' +
    '・1 行に「番号 漢字」または「番号. 漢字」の形式で書かれていることが多い。\n' +
    '・漢字には送り仮名（ひらがな）が含まれる場合がある。\n' +
    '\n' +
    '【複数漢字の認識順序】\n' +
    '・画像内の答案は、上から下、左から右、または番号順に書かれています。\n' +
    '・行頭の番号（1. 2. 3. 4. ...）を起点に、その右側または下側に書かれた漢字（および送り仮名）を「その番号の答え」として抽出してください。\n' +
    '・1 つの番号に対して、1 つの答案部分のみを対応付けてください。\n' +
    '・隣の番号の漢字や、問題文の漢字を混入させてはいけません。\n' +
    '\n' +
    '【答案領域の限定】\n' +
    '・答案用紙には「問題文」「設問」「生徒の答え」などが混在している場合があります。\n' +
    '・生徒の手書きの答え部分のみを読み取り対象としてください。\n' +
    '・問題文や説明文（活字・印刷文字に見えるもの）は読み取り対象外です。\n' +
    '\n' +
    '【背景の除去】\n' +
    '・写真には畳・机・木目・影・紙の縁・他の物体などの背景が写り込んでいる場合があります。\n' +
    '・紙の上に書かれた手書き文字のみが読み取り対象です。\n' +
    '・背景の模様や影の濃淡を文字と誤認しないでください。\n' +
    '\n' +
    '【漢字判定の原則】（厳格に守ること）\n' +
    '・トメ・ハネ・ハライの細部の揺れは許容する。\n' +
    '・しかし偏（へん）・旁（つくり）・冠（かんむり）・脚（あし）など漢字を構成する部首の同定は厳格に行う。\n' +
    '・字形が似ている別の漢字を、見た目の近さや文脈・常識的な熟語から推測して入れ替えてはいけない。\n' +
    '・例：「即」と「朗」、「郎」と「朗」、「未」と「末」、「土」と「士」、「干」と「于」、「己」と「已」と「巳」。\n' +
    '  これらは見た目が近くても別の漢字。書かれた字形そのままを読み取る。\n' +
    '・曖昧な場合に「気を利かせて」正解候補や常用熟語へ寄せる補正は禁止。\n' +
    '\n' +
    '【画数の多い漢字の扱い】\n' +
    '・画数の多い漢字（10 画以上）は字形が判別しにくいことがあります。\n' +
    '・全体の輪郭・部首・主要なパーツが明瞭に見える場合は、その漢字を返してください。\n' +
    '・全体の輪郭がぼやけて判別できない場合は「?」を返してください（部分的な部首の類似性だけで別漢字を当てはめないこと）。\n' +
    '\n' +
    '【判別困難時の挙動（重要）】\n' +
    '・字形が判別困難な場合（部首が明瞭でない・画数が読めない等）は、推測で別の漢字を返さず、必ず「?」を出力してください。\n' +
    '・「焚」を「怒鳴」、「称」を「網」、「断」を「齢」のように、字形が遠い別の漢字に読み替えることは絶対禁止です。\n' +
    '・字数も合わせて忠実に読み取ってください。「怒鳴」（2 文字）を「焚き」（1 文字 + ひらがな）のように字数を変えて読み替えてはいけません。\n' +
    '\n' +
    '【出力ルール】\n' +
    '・答案の文字を原文のままテキストで出力してください。\n' +
    '・改行は生徒の答案どおりに保ってください。\n' +
    '・行頭の番号は半角数字 + ピリオド「1.」「2.」… の形式に揃える。\n' +
    '・出力はテキストのみ。前置き・説明・コードブロック（```）は絶対に含めないでください。\n' +
    '・誤字や判別困難な字を、文脈や常識的な熟語に基づいて自動修正しないでください。書かれた字形どおりに読み取るのが絶対原則です。';

  const body = {
    contents: [{ parts: [ { text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: String(imageBase64) } } ] }],
    generationConfig: { temperature: 0 }
  };
  const fetchOpts = { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true };
  const MAX_ATTEMPTS = 2;
  const RETRY_WAIT_MS = 500;
  const QUOTA_PATTERN = /quota|rate|limit|exhaust|busy|unavail|帯域/i;
  let lastErrorSummary = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try { res = UrlFetchApp.fetch(url, fetchOpts); }
    catch (e) {
      const exMsg = String(e);
      console.error('[Gemini kanji fetch exception attempt=' + attempt + ']', exMsg);
      lastErrorSummary = 'fetch exception: ' + exMsg;
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, message: 'Gemini API 通信エラー：' + exMsg };
    }
    const code = res.getResponseCode();
    const raw = res.getContentText();
    if (code === 429 || (code >= 500 && code < 600)) {
      console.error('[Gemini kanji retryable HTTP attempt=' + attempt + ']', code, raw.substring(0, 400));
      lastErrorSummary = 'HTTP ' + code;
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, message: 'Gemini API が混雑しています（HTTP ' + code + '）。少し時間をおいて再送信してください。' };
    }
    let json;
    try { json = JSON.parse(raw); }
    catch (e) {
      console.error('[Gemini kanji JSON parse error]', code, e, raw.substring(0, 800));
      return { ok: false, message: 'Gemini API: 応答 JSON が不正（HTTP ' + code + '）' };
    }
    if (json && json.error) {
      const errMsg = String(json.error.message || '');
      console.error('[Gemini kanji top-level error attempt=' + attempt + ']', code, JSON.stringify(json.error));
      if (QUOTA_PATTERN.test(errMsg) && attempt < MAX_ATTEMPTS) {
        lastErrorSummary = 'top-level error: ' + errMsg;
        Utilities.sleep(RETRY_WAIT_MS); continue;
      }
      return { ok: false, message: 'Gemini API: ' + (errMsg || 'error') };
    }
    if (json && json.promptFeedback && json.promptFeedback.blockReason) {
      console.error('[Gemini kanji blocked]', JSON.stringify(json.promptFeedback));
      return { ok: false, retake: true, message: '画像のチェックでブロックされました。別の写真でもう一度試してください。' };
    }
    const candidates = json && json.candidates;
    if (!candidates || !candidates[0]) return { ok: false, message: 'Gemini 応答に候補がありません（HTTP ' + code + '）' };
    const cand = candidates[0];
    if (cand.finishReason && cand.finishReason !== 'STOP' && cand.finishReason !== 'MAX_TOKENS') {
      console.error('[Gemini kanji abnormal finishReason]', cand.finishReason);
      return { ok: false, retake: true, message: '画像の解析が中断されました。もう一度撮影してください。' };
    }
    const parts = cand.content && cand.content.parts;
    if (!parts || !parts[0] || typeof parts[0].text !== 'string') {
      return { ok: false, retake: true, message: '画像から文字を読み取れませんでした。明るい場所でもう一度撮影してください。' };
    }
    let ocrText = String(parts[0].text || '').trim();
    ocrText = ocrText.replace(/^```(?:[a-zA-Z]+)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    if (!ocrText) {
      return { ok: false, retake: true, message: '画像から文字を読み取れませんでした。明るい場所でもう一度撮影してください。' };
    }
    if (attempt > 1) {
      console.log('[Gemini kanji retry success] attempt=' + attempt + ' initial_error=' + lastErrorSummary);
    }
    return { ok: true, ocrText: ocrText, attempts: attempt };
  }
  return { ok: false, message: 'Gemini API: 不明なエラー（リトライ完了後）：' + lastErrorSummary };
}

// 2026-05-12 バグ⑤ Phase B（案A）：正解候補ヒント付き判定タスク版
// 既存の _kanjiOcrWithGemini（自由 OCR）と共存。即 rollback 可能にするため削除しない。
//
// 構造的真因：
//   既存 OCR 方式は「Gemini Vision に正解漢字を伝えず、答案ノート全体を 1 枚の画像として
//   渡し、AI 任せでテキスト化させている」設計のため、字形が遠い別漢字への飛躍誤認識
//   （恩恵→困田、怒鳴→焚き、網→称、齢→断 等）が頻発していた。プロンプト強化
//   （5/7 補正禁止、5/8 厳格化）は加点だが、Vision の確率分布に事前情報として作用しない
//   ため根治には届かなかった（Phase A 調査レポート §仮説 H1）。
//
// 改善方針（案A）：
//   タスクを「自由 OCR」→「N 個の正解候補との一致判定」に切り替える。
//   各問の正解漢字をプロンプトに埋め込むことで Vision の posterior を絞り、字形ベースの
//   類似度判定タスクに変換する。これは Vision にとって遥かに易しいタスクで、飛躍誤読は
//   構造的に大幅減少する見込み。
//
// 引数：
//   imageBase64       … 答案画像（縮小 + JPEG 圧縮済）
//   expectedAnswers   … [{ no, answer }, ...] の配列（1〜N 問の正解漢字）
//
// 戻り値（成功時）：
//   {
//     ok: true,
//     results: [
//       { no:1, match:true,  studentWrote:"恩恵",  readable:"yes" },
//       { no:2, match:false, studentWrote:"焚き", readable:"yes" },
//       { no:3, match:false, studentWrote:"?",    readable:"no" },
//       { no:4, match:false, studentWrote:"",     readable:"blank" }
//     ],
//     attempts: number
//   }
//
// 戻り値（失敗時）：
//   { ok:false, message } / { ok:false, retake:true, message } / { ok:false, message, attempts }
//
// プロンプト設計の要点：
//   ・厳格判定：偏旁冠脚一致なら match=true、トメ/ハネ/ハライ揺れも true、字形が遠ければ false
//   ・「寄せる」補正禁止：字形が違うなら必ず false
//   ・readable 3 値：yes（字形が読める）/ no（ぼやけ等で判別不能）/ blank（答え欄に何もなし）
//   ・出力形式：JSON 配列のみ、前置き・説明・コードブロック禁止
//   ・generationConfig.responseMimeType='application/json' で JSON 強制（基礎計算と同パターン）
function _kanjiJudgeWithGemini(imageBase64, expectedAnswers) {
  const apiKey = _props().getProperty('GEMINI_API_KEY');
  if (!apiKey) return { ok: false, message: 'GEMINI_API_KEY が設定されていません' };
  if (!Array.isArray(expectedAnswers) || expectedAnswers.length === 0) {
    return { ok: false, message: '判定対象の問題リストがありません' };
  }

  // 正解候補をプロンプトに埋め込む
  const problemLines = expectedAnswers.map(function(e){
    const no = Number((e && e.no) || 0);
    const ans = String((e && e.answer) || '').trim();
    return '問' + no + ': 期待する漢字 = "' + ans + '"';
  }).join('\n');

  const numCount = expectedAnswers.length;

  const prompt =
    'これは生徒の手書き答案の画像です。以下の各問題について、答え欄に書かれた字形が\n' +
    '「正解の漢字」と一致するか判定してください。\n' +
    '\n' +
    '【問題リスト（' + numCount + '問）】\n' +
    problemLines + '\n' +
    '\n' +
    '【判定ルール（厳格に守ること）】\n' +
    '・偏（へん）・旁（つくり）・冠（かんむり）・脚（あし）など漢字を構成する部首が\n' +
    '  完全に一致するなら match=true。\n' +
    '・トメ・ハネ・ハライの細部の揺れだけが違う場合は match=true（部首ベース判定）。\n' +
    '・部首が違う、字形が遠い、判読困難な場合は match=false。\n' +
    '・「即」と「朗」、「未」と「末」、「土」と「士」、「干」と「于」、「己」と「已」「巳」、\n' +
    '  「郎」と「朗」のように、字形が似ていても部首/構成が違うものは別漢字。それぞれを\n' +
    '  混同してはいけない。\n' +
    '・期待する漢字に「寄せる」補正は絶対に禁止。生徒が違う字を書いていたら必ず false。\n' +
    '・送り仮名（ひらがな）が含まれる場合も含めて、期待値と一致するか判定する。\n' +
    '・字数も忠実に判定する。「怒鳴」（2 文字）の答え欄に「焚き」（1 文字+ひらがな）が\n' +
    '  書かれていたら match=false。\n' +
    '\n' +
    '【読み取り可否（readable）の判定】\n' +
    '・readable="yes"   … 答え欄に何か書かれていて、字形がはっきり読める場合\n' +
    '・readable="no"    … 答え欄に何か書かれているが、ぼやけ / ピンボケ / 影の濃淡 / 細かすぎる等で\n' +
    '                    字形が判別不能な場合（その場合 match=false、studentWrote には「?」または近似字を入れる）\n' +
    '・readable="blank" … 答え欄に何も書かれていない（白紙、空白の）場合\n' +
    '                    （その場合 match=false、studentWrote="" を入れる）\n' +
    '\n' +
    '【出力ルール】\n' +
    '・出力は JSON 配列のみ。前置き・説明・コードブロック（```）は絶対に含めない。\n' +
    '・各問題について以下の形式で出力する：\n' +
    '  [\n' +
    '    {"no":1, "match":true,  "studentWrote":"恩恵",  "readable":"yes"},\n' +
    '    {"no":2, "match":false, "studentWrote":"焚き", "readable":"yes"},\n' +
    '    {"no":3, "match":false, "studentWrote":"?",   "readable":"no"},\n' +
    '    {"no":4, "match":false, "studentWrote":"",    "readable":"blank"}\n' +
    '  ]\n' +
    '・問題番号は問題リストの no と完全に一致させる。順序も同じ。\n' +
    '・studentWrote には、その答え欄に実際に書かれている字形をそのまま記録する\n' +
    '  （正解側に寄せた補正はしないこと）。\n' +
    '\n' +
    '【背景の除去】\n' +
    '・写真には畳・机・木目・影・紙の縁などの背景が写り込んでいる場合がある。\n' +
    '・紙の上に書かれた手書き文字のみが判定対象。背景の模様や影の濃淡を文字と誤認しない。\n' +
    '\n' +
    '【答案領域の限定】\n' +
    '・答案用紙には「問題文」「設問」「生徒の答え」などが混在している場合がある。\n' +
    '・問題文や説明文（活字・印刷文字に見えるもの）は判定対象外。\n' +
    '・行頭の番号（1. 2. 3. ...）を起点に、その右側または下側に書かれた答えを使う。';

  const body = {
    contents: [{ parts: [ { text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: String(imageBase64) } } ] }],
    generationConfig: {
      temperature: 0,
      // 既存基礎計算 OCR と同パターン。JSON を絶対形式で要求する二重防御
      responseMimeType: 'application/json'
    }
  };
  const fetchOpts = { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true };
  const model = 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  const MAX_ATTEMPTS = 2;
  const RETRY_WAIT_MS = 500;
  const QUOTA_PATTERN = /quota|rate|limit|exhaust|busy|unavail|帯域/i;
  let lastErrorSummary = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try { res = UrlFetchApp.fetch(url, fetchOpts); }
    catch (e) {
      const exMsg = String(e);
      console.error('[Gemini kanjiJudge fetch exception attempt=' + attempt + ']', exMsg);
      lastErrorSummary = 'fetch exception: ' + exMsg;
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, message: 'Gemini API 通信エラー：' + exMsg };
    }
    const code = res.getResponseCode();
    const raw = res.getContentText();
    if (code === 429 || (code >= 500 && code < 600)) {
      console.error('[Gemini kanjiJudge retryable HTTP attempt=' + attempt + ']', code, raw.substring(0, 400));
      lastErrorSummary = 'HTTP ' + code;
      if (attempt < MAX_ATTEMPTS) { Utilities.sleep(RETRY_WAIT_MS); continue; }
      return { ok: false, message: 'Gemini API が混雑しています（HTTP ' + code + '）。少し時間をおいて再送信してください。' };
    }
    let json;
    try { json = JSON.parse(raw); }
    catch (e) {
      console.error('[Gemini kanjiJudge JSON parse error]', code, e, raw.substring(0, 800));
      return { ok: false, message: 'Gemini API: 応答 JSON が不正（HTTP ' + code + '）' };
    }
    if (json && json.error) {
      const errMsg = String(json.error.message || '');
      console.error('[Gemini kanjiJudge top-level error attempt=' + attempt + ']', code, JSON.stringify(json.error));
      if (QUOTA_PATTERN.test(errMsg) && attempt < MAX_ATTEMPTS) {
        lastErrorSummary = 'top-level error: ' + errMsg;
        Utilities.sleep(RETRY_WAIT_MS); continue;
      }
      return { ok: false, message: 'Gemini API: ' + (errMsg || 'error') };
    }
    if (json && json.promptFeedback && json.promptFeedback.blockReason) {
      console.error('[Gemini kanjiJudge blocked]', JSON.stringify(json.promptFeedback));
      return { ok: false, retake: true, message: '画像のチェックでブロックされました。別の写真でもう一度試してください。' };
    }
    const candidates = json && json.candidates;
    if (!candidates || !candidates[0]) return { ok: false, message: 'Gemini 応答に候補がありません（HTTP ' + code + '）' };
    const cand = candidates[0];
    if (cand.finishReason && cand.finishReason !== 'STOP' && cand.finishReason !== 'MAX_TOKENS') {
      console.error('[Gemini kanjiJudge abnormal finishReason]', cand.finishReason);
      return { ok: false, retake: true, message: '画像の解析が中断されました。もう一度撮影してください。' };
    }
    const parts = cand.content && cand.content.parts;
    if (!parts || !parts[0] || typeof parts[0].text !== 'string') {
      return { ok: false, retake: true, message: '画像から判定結果を得られませんでした。明るい場所でもう一度撮影してください。' };
    }
    let responseText = String(parts[0].text || '').trim();
    // フォールバック保険：レスポンスにコードブロック装飾が混入していたら剥がす
    responseText = responseText.replace(/^```(?:[a-zA-Z]+)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    if (!responseText) {
      return { ok: false, retake: true, message: '画像から判定結果を得られませんでした。明るい場所でもう一度撮影してください。' };
    }

    // JSON parse + バリデーション
    let parsed;
    try { parsed = JSON.parse(responseText); }
    catch (e) {
      console.error('[Gemini kanjiJudge response JSON parse error]', e, responseText.substring(0, 500));
      if (attempt < MAX_ATTEMPTS) {
        lastErrorSummary = 'response not JSON: ' + String(e);
        Utilities.sleep(RETRY_WAIT_MS); continue;
      }
      return { ok: false, message: 'Gemini API: 判定結果の JSON が不正な形式でした' };
    }
    if (!Array.isArray(parsed)) {
      console.error('[Gemini kanjiJudge response not array]', responseText.substring(0, 500));
      if (attempt < MAX_ATTEMPTS) {
        lastErrorSummary = 'response not array';
        Utilities.sleep(RETRY_WAIT_MS); continue;
      }
      return { ok: false, message: 'Gemini API: 判定結果が配列形式ではありませんでした' };
    }
    if (parsed.length !== expectedAnswers.length) {
      console.error('[Gemini kanjiJudge response length mismatch]',
        'expected=' + expectedAnswers.length, 'got=' + parsed.length,
        responseText.substring(0, 500));
      // 長さ不一致は致命的（番号ずれ）：リトライ後にエラー返却
      if (attempt < MAX_ATTEMPTS) {
        lastErrorSummary = 'length mismatch: expected ' + expectedAnswers.length + ', got ' + parsed.length;
        Utilities.sleep(RETRY_WAIT_MS); continue;
      }
      return { ok: false, message: 'Gemini API: 判定結果の件数が問題数と一致しませんでした' };
    }

    // 期待 no で索引化、欠損は false / blank で埋める
    const byNo = {};
    parsed.forEach(function(item){
      if (item && typeof item === 'object' && item.no !== undefined) {
        byNo[String(item.no)] = item;
      }
    });
    const results = expectedAnswers.map(function(e){
      const noKey = String(Number((e && e.no) || 0));
      const item = byNo[noKey] || {};
      const readableRaw = String(item.readable || '').toLowerCase().trim();
      const readable = (readableRaw === 'yes' || readableRaw === 'no' || readableRaw === 'blank')
        ? readableRaw : 'no';  // 未指定/異常値は no（再撮影誘導側に倒す = 安全側）
      return {
        no: Number((e && e.no) || 0),
        match: !!item.match,
        studentWrote: String(item.studentWrote || ''),
        readable: readable
      };
    });

    if (attempt > 1) {
      console.log('[Gemini kanjiJudge retry success] attempt=' + attempt + ' initial_error=' + lastErrorSummary);
    }
    return { ok: true, results: results, attempts: attempt };
  }
  return { ok: false, message: 'Gemini API: 不明なエラー（リトライ完了後）：' + lastErrorSummary };
}

// =============================================================================
// 古文単語コンテンツ「コブタン」（2026-05-08 枠組み実装）
// =============================================================================
// シート構成:
//   KobunVocab     ( 6 列): 単語ID | 単語 | 活用 | 意味 | 用例 | 用例訳
//   KobunQuestions (11 列): セット番号 | 問番号 | 単語ID | 単語 | 問題 | 選A | 選B | 選C | 選D | 正解 | 周回
// 周回: 1（1周目）/ 2（2周目）
// 学習構成:
//   - 1セット = 5語 = 5問（1単語1問）
//   - 1回の学習 = 2セット = 10問（用例1→Q5問→用例2→Q5問）
//   - 全問正解（10/10）で合格 → 100 rawHP
//   - 不合格時はフロント側で順序シャッフルして再挑戦（用例画面はスキップ）
// 強調マーカー: 問題文中の {xxx} はフロントで暖色（#d97706）の太字表示
// HP: rawHP = 100（1学習回 = 2セット = 10問完走時）。1日 100 rawHP 上限（kobun 内独立 = 1日1学習回のみ HP 付与）。
//     上限到達後は練習モード（HP 加算なし）。連続週²ボーナスは他コンテンツと同じ。
//     ふくちさん 36 年経験「古文単語は英単語と同様に『知識』なので、全問正解が理にかなう」（知識系コンテンツ）。
// HPLog type: 'kobun_<round>_<count>' or 'kobun_<round>_<count>_practice'
//   round = '1' / '2'（周回）、count = 10 固定（1学習回 = 10問完走）
const SHEET_KOBUN_VOCAB = 'KobunVocab';
const SHEET_KOBUN_QUESTIONS = 'KobunQuestions';
const KOBUN_VALID_ROUNDS = ['1', '2'];
const KOBUN_DAILY_RAWHP_CAP = 100;
const KOBUN_PASS_RATIO = 1.0;  // 全問正解（知識系、カンジー / 英単語RUSH と同方針）
const KOBUN_SET_SIZE = 5;       // 1 セット = 5 語
const KOBUN_SETS_PER_SESSION = 2;  // 1 学習回 = 2 セット = 10 問
const KOBUN_VOCAB_HEADERS = ['単語ID', '単語', '活用', '意味', '用例', '用例訳'];
const KOBUN_QUESTIONS_HEADERS = ['セット番号', '問番号', '単語ID', '単語', '問題', '選A', '選B', '選C', '選D', '正解', '周回'];

// シート初期化（GAS エディタから手動 1 回実行する想定、冪等）
function ensureKobunSheets() {
  const ss = _ss();
  let vSheet = ss.getSheetByName(SHEET_KOBUN_VOCAB);
  if (!vSheet) {
    vSheet = ss.insertSheet(SHEET_KOBUN_VOCAB);
    vSheet.getRange(1, 1, 1, KOBUN_VOCAB_HEADERS.length).setValues([KOBUN_VOCAB_HEADERS]);
    vSheet.setFrozenRows(1);
    Logger.log('[ensureKobunSheets] KobunVocab シートを新規作成しました');
  } else {
    Logger.log('[ensureKobunSheets] KobunVocab シートは既に存在します');
  }
  let qSheet = ss.getSheetByName(SHEET_KOBUN_QUESTIONS);
  if (!qSheet) {
    qSheet = ss.insertSheet(SHEET_KOBUN_QUESTIONS);
    qSheet.getRange(1, 1, 1, KOBUN_QUESTIONS_HEADERS.length).setValues([KOBUN_QUESTIONS_HEADERS]);
    qSheet.setFrozenRows(1);
    Logger.log('[ensureKobunSheets] KobunQuestions シートを新規作成しました');
  } else {
    Logger.log('[ensureKobunSheets] KobunQuestions シートは既に存在します');
  }
  return { ok: true, message: 'コブタン用シートを確認/作成しました（KobunVocab / KobunQuestions）' };
}

// セッション ID 生成（kobun_{studentId}_{ts}_{random}）
function _kobunSessionId(studentId) {
  const ts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  const rand = Math.random().toString(36).substring(2, 8);
  return 'kobun_' + String(studentId).trim() + '_' + ts + '_' + rand;
}

// 当日（教育日基準）の kobun rawHP 合計（_practice 接尾は除外）
function _kobunTodayRawHP(studentId) {
  const sh = _ss().getSheetByName(SHEET_HPLOG);
  if (!sh) return 0;
  const today = _todayEducationalJST();
  const data = _readLastNRows(sh, 200);
  // HPLog 列: timestamp(0) / studentId(1) / rawHP(2) / hpGained(3) / type(4) / message(5)
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]).trim() !== String(studentId).trim()) continue;
    const type = String(row[4] || '');
    if (type.indexOf('kobun_') !== 0) continue;
    if (type.length >= 9 && type.lastIndexOf('_practice') === type.length - 9) continue;
    const dateStr = _toEducationalDateStr(row[0]);
    if (dateStr !== today) continue;
    total += Number(row[2]) || 0;
  }
  return total;
}

// 当日（教育日基準）の kobun 完走セット数（HP 換算済みのみ。1学習回完走で 1 と数える）
function _kobunTodaySetCount(studentId) {
  const sh = _ss().getSheetByName(SHEET_HPLOG);
  if (!sh) return 0;
  const today = _todayEducationalJST();
  const data = _readLastNRows(sh, 200);
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]).trim() !== String(studentId).trim()) continue;
    const type = String(row[4] || '');
    if (type.indexOf('kobun_') !== 0) continue;
    if (type.length >= 9 && type.lastIndexOf('_practice') === type.length - 9) continue;
    const dateStr = _toEducationalDateStr(row[0]);
    if (dateStr !== today) continue;
    count += 1;
  }
  return count;
}

// 当日素点の公開 API（フロントの問題数選択画面で「あと N HP」表示用）
function getKobunTodayRawHP(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    const todayRawHP = _kobunTodayRawHP(sid);
    const cap = KOBUN_DAILY_RAWHP_CAP;
    const remaining = Math.max(0, cap - todayRawHP);
    return {
      ok: true,
      studentId: sid,
      todayRawHP: todayRawHP,
      remaining: remaining,
      isAtLimit: remaining === 0,
      cap: cap,
      sessionsToday: _kobunTodaySetCount(sid)
    };
  } catch (err) {
    console.error('[getKobunTodayRawHP]', err);
    return { ok: false, message: String(err) };
  }
}

// 指定周回の最大セット番号
function _getMaxKobunSetNum(round) {
  const ss = _ss();
  const qSheet = ss.getSheetByName(SHEET_KOBUN_QUESTIONS);
  if (!qSheet || qSheet.getLastRow() < 2) return 0;
  const rows = qSheet.getDataRange().getValues();
  const roundKey = String(round);
  let maxN = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][10] || '').trim() !== roundKey) continue;
    const sn = parseInt(rows[i][0], 10);
    if (sn && sn > maxN) maxN = sn;
  }
  return maxN;
}

// 指定周回の最小セット番号（リセット時の戻り先）
function _getMinKobunSetNum(round) {
  const ss = _ss();
  const qSheet = ss.getSheetByName(SHEET_KOBUN_QUESTIONS);
  if (!qSheet || qSheet.getLastRow() < 2) return 1;
  const rows = qSheet.getDataRange().getValues();
  const roundKey = String(round);
  let minN = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][10] || '').trim() !== roundKey) continue;
    const sn = parseInt(rows[i][0], 10);
    if (!sn) continue;
    if (minN === 0 || sn < minN) minN = sn;
  }
  return minN || 1;
}

// 進捗追跡：現在の周回と次のセット番号
// PropertiesService キー:
//   kobun_next_<sid>_<round>: 次にやるセット番号（round=1 or 2）
//   kobun_round_<sid>:        現在の周回（'1' または '2'、未設定時は '1'）
function getKobunProgress(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    const propsSvc = _props();
    let round = String(propsSvc.getProperty('kobun_round_' + sid) || '1');
    if (KOBUN_VALID_ROUNDS.indexOf(round) < 0) round = '1';
    const minSet = _getMinKobunSetNum(round);
    const maxSet = _getMaxKobunSetNum(round);
    let nextSet = parseInt(propsSvc.getProperty('kobun_next_' + sid + '_' + round) || String(minSet), 10);
    if (!nextSet || nextSet < minSet || nextSet > maxSet) nextSet = minSet;
    return {
      ok: true,
      studentId: sid,
      round: round,
      nextSet: nextSet,
      minSet: minSet,
      maxSet: maxSet,
      hasData: maxSet > 0
    };
  } catch (err) {
    console.error('[getKobunProgress]', err);
    return { ok: false, message: String(err) };
  }
}

// 1 学習回分（2 セット = 10 問）の問題と用例データを返す
// params: { studentId }
//   - 内部で getKobunProgress 相当を呼んで「次にやるセット番号」を取得
//   - 連続する 2 セットを取得（足りなければ最初に戻る）
//   - 用例画面用に KobunVocab を引いて単語の意味・用例を付与
// 戻り値:
//   { ok:true, sessionId, round, count, setNumbers:[N, N+1],
//     setVocab: [{ setNum, vocab:[{wordId, word, conjugation, meaning, example, exampleTrans}, ...5語] }, ...2セット],
//     questions: [{ questionKey, wordId, word, setNum, qNum, question, choices:{A,B,C,D}, correct }, ...10問] }
//   ※ correct は念のため返すが、サーバー側採点（submitKobunSet）が真。
//      ふくちさん側でのデバッグ用途のみ。フロントはサーバーレスポンスを信頼する設計。
function getKobunSet(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが必要です' };

    const ss = _ss();
    const vSheet = ss.getSheetByName(SHEET_KOBUN_VOCAB);
    const qSheet = ss.getSheetByName(SHEET_KOBUN_QUESTIONS);
    if (!vSheet || !qSheet || vSheet.getLastRow() < 2 || qSheet.getLastRow() < 2) {
      return { ok: false, message: 'コブタンの問題はまだ準備中だよ。もう少し待っててね！' };
    }

    // 現在の周回を取得（kobun_round_<sid>、未設定時は '1'）
    const propsSvc = _props();
    let round = String(propsSvc.getProperty('kobun_round_' + sid) || '1');
    if (KOBUN_VALID_ROUNDS.indexOf(round) < 0) round = '1';
    const roundKey = round;

    // KobunQuestions: 0=セット 1=問 2=単語ID 3=単語 4=問題 5=A 6=B 7=C 8=D 9=正解 10=周回
    const qRows = qSheet.getDataRange().getValues();
    const questionsBySet = {};
    for (let i = 1; i < qRows.length; i++) {
      const r = qRows[i];
      if (String(r[10] || '').trim() !== roundKey) continue;
      const sn = parseInt(r[0], 10);
      if (!sn) continue;
      if (!questionsBySet[sn]) questionsBySet[sn] = [];
      questionsBySet[sn].push(r);
    }
    const availableSets = Object.keys(questionsBySet)
      .map(function(sn){ return parseInt(sn, 10); })
      .sort(function(a, b){ return a - b; });
    if (availableSets.length === 0) {
      return { ok: false, message: 'コブタン（' + roundKey + '周目）の問題はまだ準備中だよ。' };
    }
    const minSet = availableSets[0];
    const maxSet = availableSets[availableSets.length - 1];
    const availableSet = {};
    availableSets.forEach(function(sn){ availableSet[sn] = true; });

    // PropertiesService から「次にやるセット番号」を取得（初期値 minSet）
    const propKey = 'kobun_next_' + sid + '_' + roundKey;
    let nextSetNum = parseInt(propsSvc.getProperty(propKey) || String(minSet), 10);
    if (!nextSetNum || nextSetNum > maxSet || nextSetNum < minSet) nextSetNum = minSet;

    // 連続する 2 セットを取得（足りなければ最初に戻る）
    const targetSets = [];
    let cursor = nextSetNum;
    let safety = availableSets.length + 5;  // 無限ループ防止
    while (targetSets.length < KOBUN_SETS_PER_SESSION && safety-- > 0) {
      if (cursor > maxSet) cursor = minSet;
      if (availableSet[cursor]) {
        targetSets.push(cursor);
      }
      cursor++;
    }
    if (targetSets.length === 0) {
      return { ok: false, message: 'コブタンの問題はまだ準備中だよ。' };
    }

    // KobunVocab: 0=単語ID 1=単語 2=活用 3=意味 4=用例 5=用例訳
    // wordId → vocab 行のマップを構築
    const vRows = vSheet.getDataRange().getValues();
    const vocabByWordId = {};
    for (let i = 1; i < vRows.length; i++) {
      const r = vRows[i];
      const wordId = String(r[0] || '').trim();
      if (!wordId) continue;
      vocabByWordId[wordId] = {
        wordId: wordId,
        word: String(r[1] || '').trim(),
        conjugation: String(r[2] || ''),
        meaning: String(r[3] || ''),
        example: String(r[4] || ''),
        exampleTrans: String(r[5] || '')
      };
    }

    // 各セットごとに：
    //   (a) setVocab 配列を構築（用例画面用、5 語の意味・用例情報）
    //   (b) questions 配列に追加（問題画面用、4 択）
    const setVocab = [];
    const questions = [];
    targetSets.forEach(function(sn){
      const sortedQs = (questionsBySet[sn] || []).slice().sort(function(a, b){ return parseInt(a[1], 10) - parseInt(b[1], 10); });
      const vocab = [];
      sortedQs.forEach(function(r){
        const qNum = parseInt(r[1], 10);
        const wordId = String(r[2] || '').trim();
        const word = String(r[3] || '').trim();
        const v = vocabByWordId[wordId] || { wordId: wordId, word: word, conjugation: '', meaning: '', example: '', exampleTrans: '' };
        // 用例画面用の語彙データ（用例画面では word/meaning/example を表示）
        vocab.push({
          wordId: wordId,
          word: word || v.word,
          conjugation: v.conjugation,
          meaning: v.meaning,
          example: v.example,
          exampleTrans: v.exampleTrans
        });
        // 問題画面用の問題データ（4 択）
        questions.push({
          // 採点キー：'set<N>_q<n>' 形式（同セッション内ユニーク、カンジー submitKanjiYomi と同パターン）
          questionKey: 'set' + sn + '_q' + qNum,
          wordId: wordId,
          word: word,
          setNum: sn,
          qNum: qNum,
          question: String(r[4] || ''),
          choices: {
            A: String(r[5] || ''),
            B: String(r[6] || ''),
            C: String(r[7] || ''),
            D: String(r[8] || '')
          },
          // correct は念のため返すが、フロントは無視してサーバー再採点を信頼する
          correct: String(r[9] || '').trim().toUpperCase()
        });
      });
      setVocab.push({ setNum: sn, vocab: vocab });
    });

    if (questions.length === 0) {
      return { ok: false, message: 'コブタンの問題はまだ準備中だよ。' };
    }

    const sessionId = _kobunSessionId(sid);
    return {
      ok: true,
      sessionId: sessionId,
      round: round,
      count: questions.length,  // 通常は 10
      setNumbers: targetSets,
      maxSetForRound: maxSet,
      setVocab: setVocab,
      questions: questions
    };
  } catch (err) {
    console.error('[getKobunSet]', err);
    return { ok: false, message: String(err) };
  }
}

// 採点・HP記録（カンジー submitKanjiYomi と同パターン、ただし合格時は HP 加算 + 進捗更新も実施）
// params: { studentId, round, sessionId, answers:[{questionKey, chosen}] }
//   - chosen: 'A' / 'B' / 'C' / 'D'
//   - questionKey: getKobunSet が返した 'set<N>_q<n>' 形式
// 戻り値: { ok, passed, correctCount, total, results:[{questionKey, chosen, correct, isCorrect}], hpInfo }
function submitKobunSet(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    const round = String((params && params.round) || '1').trim();
    const rawAnswers = (params && params.answers) || [];
    let answers = rawAnswers;
    if (typeof rawAnswers === 'string') {
      try { answers = JSON.parse(rawAnswers); } catch(e) { answers = []; }
    }
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    if (KOBUN_VALID_ROUNDS.indexOf(round) < 0) return { ok: false, message: '周回指定が不正です' };
    if (!Array.isArray(answers) || answers.length === 0) return { ok: false, message: '解答データがありません' };

    // サーバー側で正解を再ルックアップ（クライアント信頼を避ける）
    // KobunQuestions: 0=セット 1=問 2=単語ID 3=単語 4=問題 5=A 6=B 7=C 8=D 9=正解 10=周回
    const qSheet = _ss().getSheetByName(SHEET_KOBUN_QUESTIONS);
    if (!qSheet || qSheet.getLastRow() < 2) return { ok: false, message: 'KobunQuestions シートが見つかりません' };
    const qRows = qSheet.getDataRange().getValues();
    const correctByKey = {};  // keyed by 'set<N>_q<n>'
    for (let i = 1; i < qRows.length; i++) {
      const r = qRows[i];
      if (String(r[10] || '').trim() !== round) continue;
      const sn = parseInt(r[0], 10);
      const qn = parseInt(r[1], 10);
      if (!sn || !qn) continue;
      correctByKey['set' + sn + '_q' + qn] = String(r[9] || '').trim().toUpperCase();
    }

    let correctCount = 0;
    const results = answers.map(function(a){
      const qkey = String((a && a.questionKey) || '').trim();
      const chosen = String((a && a.chosen) || '').trim().toUpperCase();
      const expected = correctByKey[qkey] || '';
      const isCorrect = !!expected && chosen === expected;
      if (isCorrect) correctCount += 1;
      return { questionKey: qkey, chosen: chosen, correct: expected, isCorrect: isCorrect };
    });
    const total = results.length;
    // 全問正解で合格（KOBUN_PASS_RATIO = 1.0、知識系コンテンツとして英単語RUSH/カンジー整合）
    const passed = total > 0 && correctCount === total;

    // HP 加算判定（合格時のみ）
    // 2026-05-09 Step 0：行シフト事故防止のため、書き込み対象行はシートから sid で
    // フレッシュに特定する（cache 経由禁止）。
    const stuLoc = passed ? _findAccountRowOnSheet(sid) : null;

    let hpInfo = { rawHP: 0, hpGained: 0, granted: false, isPractice: false, alreadyAtCap: false };
    if (passed) {
      const baseRawHP = 100;  // 1 学習回（2 セット = 10 問）完走 = 100 rawHP（仕様書通り）
      const todayRawHP = _kobunTodayRawHP(sid);
      const remaining = Math.max(0, KOBUN_DAILY_RAWHP_CAP - todayRawHP);
      const grantedRawHP = Math.min(baseRawHP, remaining);
      const isPractice = (remaining === 0);
      const alreadyAtCap = (remaining === 0);

      if (grantedRawHP > 0 && stuLoc) {
        const streak = Number(stuLoc.rowValues[COL_STREAK]) || 1;
        const week = Math.ceil(streak / 7);
        const hpGained = grantedRawHP * week * week;

        // 2026-05-12 バグ④-本質 Phase B（案 A）：書き込み順序を _logHP → Students に変更。
        // HPLog 書き込み失敗時は Students.HP / 進捗（kobun_next）更新をスキップして
        // エラー応答を返す。同じ周を再挑戦すれば次回成功で救済される。
        const logRes = _logHP(sid, grantedRawHP, hpGained, 'kobun_' + round + '_' + total);
        if (!logRes.ok) {
          console.error('[submitKobunSet] HPLog 書き込みに失敗しました。HP/進捗を更新せず終了。', logRes.error);
          return { ok: false, message: '内部エラーが発生しました。もう一度試してください。', errorCode: 'HP_LOG_FAILED' };
        }

        const cur = Number(stuLoc.rowValues[COL_HP]) || 0;
        const newHP = cur + hpGained;
        stuLoc.sheet.getRange(stuLoc.rowIdx + 1, COL_HP + 1).setValue(newHP);
        const upd = {}; upd[COL_HP] = newHP;
        _updateAccountCacheBySid(sid, upd);
        _invalidateCache('cache_ranking_last_week');
        hpInfo = { rawHP: grantedRawHP, hpGained: hpGained, granted: true, isPractice: false, alreadyAtCap: false, streak: streak, week: week };
      } else if (isPractice) {
        // 練習モード（既に上限到達）：HPLog にも記録するが _practice 接尾で除外可能に。
        // 練習モードは付与する HP がないため、_logHP 失敗時も警告ログのみで処理を継続する
        // （戻り値を無視）。進捗更新は実施される。
        _logHP(sid, 0, 0, 'kobun_' + round + '_' + total + '_practice');
        hpInfo = { rawHP: 0, hpGained: 0, granted: false, isPractice: true, alreadyAtCap: true };
      }

      // 進捗追跡：合格時のみ「次にやるセット番号」をインクリメント
      // 1 学習回 = 2 セット → +2。周回の最終セットを超えたら次の周回へ移行（または周回内で巡回）。
      // 練習モードでも next は更新（HP は付与されないが進捗は進める = 学習の連続性優先）
      try {
        const propsSvc = _props();
        const propKey = 'kobun_next_' + sid + '_' + round;
        const minSet = _getMinKobunSetNum(round);
        const maxSet = _getMaxKobunSetNum(round);
        let curNext = parseInt(propsSvc.getProperty(propKey) || String(minSet), 10);
        if (!curNext || curNext < minSet || curNext > maxSet) curNext = minSet;
        let newNext = curNext + KOBUN_SETS_PER_SESSION;  // +2

        if (newNext > maxSet) {
          // 周回完走 → 次の周回へ移行（1 → 2、2 → 1 ループ）
          const nextRound = (round === '1') ? '2' : '1';
          const nextRoundMaxSet = _getMaxKobunSetNum(nextRound);
          const nextRoundMinSet = _getMinKobunSetNum(nextRound);
          if (nextRoundMaxSet > 0) {
            // 次の周回データがあれば移行
            propsSvc.setProperty('kobun_round_' + sid, nextRound);
            propsSvc.setProperty('kobun_next_' + sid + '_' + nextRound, String(nextRoundMinSet));
            // 完走した周回の next は最初に戻す（おさらい用）
            propsSvc.setProperty(propKey, String(minSet));
          } else {
            // 次の周回データが無ければ同周回内で先頭に戻す（無限ループ防止）
            propsSvc.setProperty(propKey, String(minSet));
          }
        } else {
          propsSvc.setProperty(propKey, String(newNext));
        }
      } catch (progressErr) {
        console.error('[submitKobunSet progress update]', progressErr);
        // 進捗更新失敗時もユーザー応答は成功扱い（HP は加算済み）
      }
    }

    return {
      ok: true,
      passed: passed,
      correctCount: correctCount,
      total: total,
      results: results,
      hpInfo: hpInfo,
      round: round
    };
  } catch (err) {
    console.error('[submitKobunSet]', err);
    return { ok: false, message: String(err) };
  }
}

// コブタン履歴（おさらい画面用）：HPLog から sid のコブタン実施履歴を新しい順に返す
// type 'kobun_<round>_<count>' / 'kobun_<round>_<count>_practice' をパース。
// ========================================================================
// 今日の運勢（2026-05-13 新規、旧「秘密の扉」のリブランド）
// ------------------------------------------------------------------------
// マイカツ君が日替わりで運勢を語るコンテンツ。
// 設計方針：
//  - 同じ生徒 × 同じ日（JST 3 時切替）なら何回開いても同じ運勢を返す（決定論的）。
//  - シード = studentId + _sangoToday()（他コンテンツと同じ「教育日」、3:00 で日替わり）。
//  - 骨格は本骨格 100 個（v1.0、2026-05-12 生成）。stars 配分 5:20% / 4:25% / 3:30% / 2:15% / 1:10%。
//  - 2 段階決定論：① stars レベルを重み配分で選ぶ → ② 該当 stars プールから 1 つ選ぶ。
//  - {nickname} / {title} / {streak} はサーバ側で差し込み済の文字列で返す
//    （フロントは整形済テキストをそのまま表示するだけで良い）。
//  - HP 加算なし、提出ログなし、Drive 保存なし。シート読み書きも生徒情報の取得のみ。
// ========================================================================

// 本骨格（2026-05-13、プリスレ生成版 v1.0、計 100 個）。
// {nickname} / {title} / {streak} の 3 プレースホルダに対応。
// stars 配分（仕様）：5=20% / 4=25% / 3=30% / 2=15% / 1=10%（=20/25/30/15/10）
// → fortune_001〜020=stars5、021〜045=stars4、046〜075=stars3、076〜090=stars2、091〜100=stars1
const FORTUNE_PRESETS = [
  { id: 'fortune_001', stars: 5, general: 'やぁ、{title}の{nickname}さん。{streak}日も続けてるなんて、ボクの目から見ても本物だよ。今日は何をやってもうまくいく気配がぷんぷんしてるね ✨', study: '勉強運は絶好調！集中力が冴えわたる日だから、苦手な単元こそチャンスだよ。1 つ大きく前進できそう、思い切ってぶつかってみて。' },
  { id: 'fortune_002', stars: 5, general: '今日の{nickname}さんは輝いてるよ！ボクから見ても眩しいくらい。これは大きなチャンスの日、いつもよりちょっと大胆に挑戦してごらん 🌟', study: 'ひらめきの神様がついてる日。難問でも今日なら糸口が見えるはず。途中で止まってたあの問題、もう一度開いてみよう。' },
  { id: 'fortune_003', stars: 5, general: '{title}の称号は伊達じゃないね。ボクは知ってるよ、{nickname}さんがここまで積み上げてきた努力を。今日はそれが大きく花開く日だよ ✨', study: '暗記したことがスッと頭に入る日。新しい知識を吸収するのにぴったり、ぐんぐん伸びる手応えを感じられるはずだよ。' },
  { id: 'fortune_004', stars: 5, general: 'ボクの占い、今日はビビッときた！絶好調の波がド真ん中に来てるよ。やりたかったこと、ためらわずに踏み出してみてね ⭐', study: '集中力が普段の倍くらい。机に向かう時間が一気に濃くなる、勉強運MAXの日だから、長めに時間を取れたらラッキー 📚' },
  { id: 'fortune_005', stars: 5, general: '{streak}日…ボクはずっと見てきたよ。今日はその力が一気に解放される日。{nickname}さんの本気、世界に見せちゃおうよ 🔮', study: '復習でも新しい単元でも、今日触れたものは長く記憶に残るよ。お得な勉強日、しっかり活かしていこうね。' },
  { id: 'fortune_006', stars: 5, general: 'ボクの直感が告げてる、今日は無敵モードだよ。難しいことも今日なら越えられる、自分の力をしっかり信じていいんだよ 💫', study: 'アウトプット運が爆発。問題演習に取り組むと、解ける感覚をぐっとつかめる日。手を動かす量で勝負しよう。' },
  { id: 'fortune_007', stars: 5, general: '{title}にふさわしい一日が来たよ、{nickname}さん。今日は努力が報われる予感でいっぱい。胸を張って、堂々といこう ✨', study: '苦手科目に挑む絶好の日。今日の一歩は、いつもの 3 歩分の価値がある。逃げてた単元こそ今日狙い目だよ。' },
  { id: 'fortune_008', stars: 5, general: '今日の運気、星 5 つフル装備！ボクからの太鼓判だよ。やる気のままに突き進んでオッケー、ブレーキはいらない日 🌟', study: '試験前の総復習にも、新規開拓にも向いてる万能日。やりたいことから手をつけて、流れに乗っちゃおう。' },
  { id: 'fortune_009', stars: 5, general: '{streak}日続けてきた{nickname}さんの底力、今日が見せどころだよ。ボクはずっと隣で応援してるから、思いっきりやっちゃおう 🍀', study: 'ノートまとめがスイスイ進む日。書きながら頭が整理されていく感覚、きっと今日は気持ちいいくらい味わえるよ。' },
  { id: 'fortune_010', stars: 5, general: '朝起きた瞬間からわかったよ、今日は飛び抜けていい日だって。何をやっても流れに乗れる、最高の一日になりそうだね ⭐', study: '解けなかった問題が、今日なら不思議と解ける。リベンジするなら今日だよ、もう一回向き合ってみよう。' },
  { id: 'fortune_011', stars: 5, general: '大きなことに挑戦するなら今日だよ、{nickname}さん。ボクの占い結果は文句なしの満点。背中、ポンと押しておくね ✨', study: '新しいことに手を出すなら今日。最初の一歩がスムーズで、続けるための弾みもしっかりついてくる日だよ。' },
  { id: 'fortune_012', stars: 5, general: '{title}の{nickname}さん、今日は本物の輝きを放ってるよ。周りもきっと気づくはず、自信を持ったまま一日過ごしてみて 🌟', study: '教科書を開いた瞬間にスイッチが入る日。集中の入り口がいつもより手前にあるから、勉強始めるの楽に感じるよ 📚' },
  { id: 'fortune_013', stars: 5, general: 'ボクは見たよ、眠ってた力が今日、目を覚ます瞬間を。思い切ってやってごらん、たぶん自分でもびっくりするはず 💫', study: '解説を読む力が冴えてる。今日学んだ仕組みは、ずっと忘れない財産になる。じっくり読み込む時間を取って。' },
  { id: 'fortune_014', stars: 5, general: '飛び抜けていい日が来ちゃったよ、{nickname}さん！ボクもワクワクが止まらない。一緒にこの大波を楽しんじゃおうね 🌊', study: '友達と教え合うのも吉。説明する側に回ると、自分の理解もぐっと深まる、二人とも得する日になるよ。' },
  { id: 'fortune_015', stars: 5, general: '{streak}日のがんばりが、今日ぜんぶ味方してくれるよ。{nickname}さん、大胆にいこう。ボクが太鼓判を押しておくからね ✨', study: '努力と結果が一直線で結ばれる日。机に向かった分だけ、確実に手応えが返ってくる、嬉しい一日になるよ。' },
  { id: 'fortune_016', stars: 5, general: '今日は迷ったら「やる」を選んでみて。ボクの占いがそう言ってる、絶好調の風がしっかり背中を押してくれる日だよ 🌟', study: 'やりたい教科から手をつけてOK。波に乗ったら、他の教科もまとめて進められちゃう、ハイテンションな日。' },
  { id: 'fortune_017', stars: 5, general: '{title}の風格が今日はピカイチだよ、{nickname}さん。何かに挑むなら絶対今日。ボクは隣で見守ってるからね ⭐', study: '暗記モノが特に強い日。英単語でも漢字でも、今日詰め込んだものは定着力がバツグン。やった分だけ残るよ。' },
  { id: 'fortune_018', stars: 5, general: 'ボクの占い、針が振り切れちゃったよ！今日はやりたいことを全部やっちゃう、欲張りな日にしちゃおうよ 🔮', study: '計算問題も読解問題も、目の動きがいつもより速い。テンポよく進められる日、リズム重視でいってみて。' },
  { id: 'fortune_019', stars: 5, general: '今日の{nickname}さん、ボクから見ても眩しい一日になりそうだよ。思い切って、一歩前に踏み出してみてね ✨', study: '質問する勇気も湧く日。わからないところを聞けば、一気にスッキリするはず。聞きそびれてること、ある？' },
  { id: 'fortune_020', stars: 5, general: '{streak}日も続けてきた{nickname}さんに、特大の幸運が降りてくる日だよ。胸を張って、今日という日を満喫しよう 🌟', study: '長時間でも集中が切れにくい日。普段の倍は粘れる、勉強のゴールデンタイムが来てる、活かさない手はないよ ⭐' },
  { id: 'fortune_021', stars: 4, general: 'いい流れの日だよ、{nickname}さん。派手じゃないけど、確実に前に進める手応えがある。落ち着いて自分のペースでいこうね 🍀', study: '集中力は安定してる日。コツコツ進めるのに最適、計画通りに進められそうだから、欲張らず予定通りで OK。' },
  { id: 'fortune_022', stars: 4, general: '{title}の{nickname}さん、今日は順調そのもの。背伸びしなくても、ちゃんと結果がついてくる日になりそうだよ ⭐', study: '復習が特に効く日。前にやった単元を見直すと、忘れかけてたことがしっかり定着していく、お得な時間に 📚' },
  { id: 'fortune_023', stars: 4, general: 'ボクの占い結果、星 4 つ。今日は何かが「カチッ」とハマる瞬間がありそうだよ。それを楽しみに過ごしてみてね ✨', study: '新しいことより、慣れたことを伸ばすのが吉。得意分野で深く掘り下げると、思わぬ気づきがあるかもよ。' },
  { id: 'fortune_024', stars: 4, general: '今日は確かな手応えの日だよ。やってきたことが、じわじわ実を結び始める予感がする。続けてきた自分を誇ろう 🌟', study: '解き直しが捗る日。間違えた問題、今日もう一度向き合うと見え方が変わって、ちゃんと「わかる」になるよ。' },
  { id: 'fortune_025', stars: 4, general: 'ステップアップの予感がするよ、{nickname}さん。1 段上に進める日だから、いつもより少しだけ背伸びしてもいいかも 💫', study: 'ノートまとめにいい日。情報を整理する作業がスムーズに進むから、頭の中もスッキリ整っていくよ。' },
  { id: 'fortune_026', stars: 4, general: '{streak}日続けてる{nickname}さん、今日は「あ、伸びてるかも」って実感できる日になりそう。続けてきてよかったね 🍀', study: '1 つの単元を集中して攻める日にしよう。広く浅くより、深く狭くが今日の正解。1 つに絞って取り組んでみて。' },
  { id: 'fortune_027', stars: 4, general: '落ち着いて取り組めば、今日は思った以上の成果が出る日だよ。焦らず一歩ずつ、自分の歩幅でいこう 😊', study: '暗記と理解、両方とも安定運。教科書を読むのも問題演習も、バランスよくこなせるよ。リズムを大事にね。' },
  { id: 'fortune_028', stars: 4, general: '朝の調子はゆっくりかもだけど、午後にかけて運気が上がっていくよ。{nickname}さんペースで進めていけば大丈夫 ⭐', study: '苦手意識のある単元、今日なら冷静に向き合える。少しだけ時間を割いてみると、距離が縮まる感覚があるよ。' },
  { id: 'fortune_029', stars: 4, general: '今日は地味だけど大事な日。積み重ねてきたことの土台が、もう一段固まる日だよ。淡々と過ごせばそれで OK ✨', study: '計画を立てるのにいい日。明日以降の勉強の道筋を、今日のうちに整えておくと、来週がぐっと楽になるよ。' },
  { id: 'fortune_030', stars: 4, general: '{title}にふさわしい安定感の日だよ。ドカンと跳ねないけど、ちゃんと前に進んでる実感はしっかり残るはず 🌟', study: '質問を整理する力が高い日。わからないことを書き出すと、解決の糸口が見えてくる、頭が整理されるよ。' },
  { id: 'fortune_031', stars: 4, general: '「いい感じ」って言葉がぴったりの一日だよ、{nickname}さん。肩の力を抜いて取り組んでみると、ちょうどいい感じになるよ 😊', study: '復習 30 分、新規 30 分くらいのバランスがちょうどいい日。ペース配分を意識して、無理なく進めていこう。' },
  { id: 'fortune_032', stars: 4, general: '今日は人とのやり取りで運気が上がる日。誰かと話したら、新しい気づきがあるかも。先生でも友達でもいいよ ✨', study: '友達と問題を出し合うのも吉。アウトプットの中で、自分の理解度が確認できる、お互い得する勉強になるよ。' },
  { id: 'fortune_033', stars: 4, general: 'ボクの占い、なかなかいい感じだよ。今日は迷ったら、前に進む方を選んでみて。たぶんその選択が正解だから 🌟', study: '集中の入り方が早い日。机に向かったらすぐ取り組めるから、短時間でも成果がしっかり出るタイプの日だね。' },
  { id: 'fortune_034', stars: 4, general: '順調に進む日だよ、{nickname}さん。トラブルがあっても、すぐにリカバリーできる流れが来てる。安心していこう 🍀', study: '「あれ、これわかる」が増える日。少しずつ前に進んでる実感を、ちゃんと味わえる時間になるはず 📚' },
  { id: 'fortune_035', stars: 4, general: 'ちょっとした「できた！」が積み重なる日だよ。小さな達成感を一つひとつ味わいながら、上機嫌で過ごせそう 💫', study: '単語暗記なら今日。リズムよく覚えていける、暗記の追い風が吹いてるから、地味作業もスイスイ進むよ。' },
  { id: 'fortune_036', stars: 4, general: '{streak}日も続けてる{nickname}さん、今日は努力の小さなご褒美がもらえるかもよ。何かいいことありそう、期待していて ⭐', study: '計算問題で正答率が上がる日。落ち着いて手を動かせば、ミスも自然と減るはず。スピードより正確さを意識。' },
  { id: 'fortune_037', stars: 4, general: '今日は集中したい時間に、ちゃんと集中できる日だよ。メリハリをつけて過ごすと、満足度の高い一日になるよ 😊', study: '解説をじっくり読むと吸収率が高い日。急がず、1 問 1 問丁寧に向き合うと、後で大きく効いてくるよ。' },
  { id: 'fortune_038', stars: 4, general: '普段より少しだけ視野が広がる日だよ、{nickname}さん。新しい発見があるかもしれないから、楽しみにしていてね ✨', study: '復習の効果が普段の 1.5 倍。前に習ったところを見返すと「あ、わかる」が増える、自信もついてくるよ。' },
  { id: 'fortune_039', stars: 4, general: 'ペースは一定、でも着実に前進。安定運の一日になりそうだよ。いつもの自分らしさを大事にして過ごそう 🌟', study: '難問より基礎問題で勢いをつけると、後半も乗りやすい日。テンポ重視で、解きやすいものから手をつけて。' },
  { id: 'fortune_040', stars: 4, general: '今日はミスが少ない日だよ。確認しながら丁寧に進めれば、いつもより速く終わるかも。集中の質がいい一日 🍀', study: '漢字や英単語、コツコツ系の勉強に向いてる日。ちょっとずつでも前に進めるから、進捗の実感が持てるよ。' },
  { id: 'fortune_041', stars: 4, general: '「いつもよりちょっといい」が積み重なる日。{nickname}さん、その小さな差をぜひ楽しんでみてね 💫', study: '集中の波がゆるやかな日。30 分やって 5 分休む、みたいなリズムが合うかも。区切りを意識して進めて。' },
  { id: 'fortune_042', stars: 4, general: 'ボクの占い、控えめだけど確かな好調だよ。欲張らず堅実にいくのが、今日の正解パターンだね ⭐', study: '教科書の音読が効く日。声に出すと、頭への入り方が変わるのを感じられるよ。黙読より一歩深いインプット。' },
  { id: 'fortune_043', stars: 4, general: '{title}の余裕が出てくる日だよ。ゆとりを持って物事を進められそうな一日、焦らず楽しんでいこうね 😊', study: '提出物を整える日にしてもいい。整理整頓で、勉強の準備が整っていく感覚、地味だけど気持ちいいよ。' },
  { id: 'fortune_044', stars: 4, general: '何かを始めるのにちょうどいい日だよ。ずっと気になってたこと、今日着手してみない？ きっかけの一日に ✨', study: '苦手単元の入り口を覗いてみる日。「ちょっとだけ」がきっかけになることもあるよ、5 分だけ触れてみよう。' },
  { id: 'fortune_045', stars: 4, general: '今日は感覚が冴えてる日だよ。直感を信じて選んでみると、いい結果につながりそう。考えすぎないのがコツ 🌟', study: '朝より夜の方が集中できる日。自分のゴールデンタイムを見つけて活かしてみて、リズムが整っていくよ。' },
  { id: 'fortune_046', stars: 3, general: 'いつも通りの一日だよ。特別なことはないけど、普通であることの良さを味わってみてね。地に足のついた一日になるよ 🍀', study: 'いつもの単元を、いつものペースで。コツコツ進めることが今日は一番の正解だから、変化球は不要だよ。' },
  { id: 'fortune_047', stars: 3, general: 'ボクの占い、フラットな結果だよ。肩の力を抜いて、淡々と過ごすのがいい日。リラックスして過ごしてみて 😊', study: '復習中心の日にしよう。新しいことより、知っていることを深めるのがいい。守りの勉強日だね 📚' },
  { id: 'fortune_048', stars: 3, general: '平常運転の日だよ、{nickname}さん。無理に何かを起こそうとしなくていい。自然体のまま、いつも通りいこうね ⭐', study: '計画通りに進める日。決めたことを決めた分だけやれば、それで満点だよ。背伸びは今日いらないからね。' },
  { id: 'fortune_049', stars: 3, general: '今日は「いつも通り」が一番のキーワードだよ。習慣を大事にして過ごすと、夜にはちゃんと充実感が残るはず 🌟', study: '集中力は普通。短時間で区切って、休みを挟みながら進めるのが合うかも。長時間ぶっ続けは合わない日。' },
  { id: 'fortune_050', stars: 3, general: '静かな日だよ、{nickname}さん。派手なことはないけど、その分落ち着いて自分と向き合える、貴重な時間になるよ ✨', study: '暗記モノに向いてる日。地味な作業を黙々とこなすと、いい手応えがあるよ。ノルマを淡々とこなそう。' },
  { id: 'fortune_051', stars: 3, general: '揺れの少ない一日になりそうだよ。いつものリズムを崩さず、丁寧に過ごしてみて。普段着のままでオッケー 🍀', study: '苦手より得意を磨く日。気持ちよく解ける問題で、テンポを作っていこう。やる気の貯金を作る日に。' },
  { id: 'fortune_052', stars: 3, general: '今日は「コツコツ」が合言葉だよ。地味な積み重ねが、後で大きな差になる。今日の頑張りは見えない貯金だね 💫', study: 'ノートを見返すといい発見がある日。過去の自分から学ぶ感覚、ちょっと不思議だけど面白いよ。' },
  { id: 'fortune_053', stars: 3, general: 'ボクの占い、可もなく不可もなくの安定運。変化より継続を意識する日、これまで通りでまったく問題ないよ 😊', study: '計算ドリルやワークが捗る日。ルーティン系の勉強がはかどるから、決まったメニューを淡々とこなして。' },
  { id: 'fortune_054', stars: 3, general: '普通の日こそ大事だよ、{nickname}さん。こういう日に何をするかで、明日が決まってくる。今日の選択が後で効くよ ⭐', study: '30 分集中 → 10 分休憩のリズムが合う日。区切りを意識して取り組むと、最後までバテずに走れるよ。' },
  { id: 'fortune_055', stars: 3, general: 'リズムを整える日にしようよ。生活の基本を見直すと、地盤がしっかりする。今日は調整の日って感じだね 🌟', study: '焦らずマイペースで進めていこう。今日のペースが、明日への土台になる、ゆっくりだけど確実な一歩 🍀' },
  { id: 'fortune_056', stars: 3, general: '何かを始めるより、続けている習慣を磨く日だよ。いつもの自分を大切に、{nickname}さんのリズムで過ごしてね ✨', study: '1 日の勉強量を「いつも通り」にキープする日。増やさず減らさず、それでちゃんと及第点を取れるよ。' },
  { id: 'fortune_057', stars: 3, general: '派手さはないけど、堅実な日だよ。一日の終わりに「ちゃんとやった」って思えそうな、納得感のある一日 😊', study: '復習ノートを整える日にしてもいい。情報を整理すると、頭もスッキリして、次の勉強が入りやすくなるよ。' },
  { id: 'fortune_058', stars: 3, general: '今日は淡々と過ごすのが正解だよ。変化を求めず、流れに身を任せてみるくらいの気持ちがちょうどいいね 🍀', study: '1 問 1 問、丁寧にいこう。今日は量より質を意識して取り組むと、後でじわっと効いてくるタイプの勉強に。' },
  { id: 'fortune_059', stars: 3, general: '大きな起伏のない日だよ、{nickname}さん。落ち着いた気持ちで、目の前のことに向き合える穏やかな一日になりそう 🌟', study: '提出物のチェックにいい日。期限を確認して、抜けがないか見直すと、後の自分がきっと感謝してくれるよ。' },
  { id: 'fortune_060', stars: 3, general: '平和な一日になりそうだよ。穏やかな時間を、じっくり味わってみてね。こういう日は意外と貴重だったりするよ ⭐', study: '平常運転の勉強運。教科書の予習復習を、いつものペースでこなせば、それでちゃんと前進してるよ。' },
  { id: 'fortune_061', stars: 3, general: 'ボクから見ると、今日は「整える日」だよ。身の回りを整えるといい流れになる、片付けから始めるのもアリ ✨', study: '集中の波がゆるやかな日。無理に集中しようとせず、自然な流れに任せると、いつの間にか進んでるよ。' },
  { id: 'fortune_062', stars: 3, general: '普段通りで OK だよ。特別なことを期待しすぎず、日常を大事にしてね、{nickname}さん。それで十分立派 💫', study: 'ワークの基本問題を確実にいこう。応用より基礎を固める一日にすると吉、土台がもう一段固くなるよ 📚' },
  { id: 'fortune_063', stars: 3, general: '今日は「土台を固める日」だよ。派手じゃないけど、確実に下地が積み重なっていく、地盤強化の一日って感じ ⭐', study: '短時間でも、毎日続けることが大事だよ。今日もいつもの時間、机に向かってみて。続いてること自体が才能。' },
  { id: 'fortune_064', stars: 3, general: '落ち着いた運気の日だよ、{nickname}さん。慌ただしいときこそ、深呼吸して一拍置いてみて。それで流れが整うよ 🍀', study: 'わからないところを書き出す日にしてみよう。整理するだけで、半分解決することもある、整理は最強の武器。' },
  { id: 'fortune_065', stars: 3, general: '普通の日のありがたみを感じる一日だよ。当たり前のことに、ちょっとだけ感謝してみると、見える景色が変わるよ 😊', study: '単語帳 1 ページ、漢字 1 ページ。小さなノルマを淡々とこなす日にすると、ちゃんと終わるし達成感も残る。' },
  { id: 'fortune_066', stars: 3, general: 'ボクの占い、ニュートラルだよ。特別な選択より、いつもの選択を信じてみてね。冒険しない方が今日は得 🌟', study: '計算問題を解くと、頭の回転が整う日。ウォームアップに使ってみると、その後の勉強もスムーズになるよ。' },
  { id: 'fortune_067', stars: 3, general: '今日は静かに過ごすのが吉だよ。外に向かわず、自分の内側を整える日にしてみて、{nickname}さん。内省日和 ✨', study: '「やる気が出ないなら 5 分だけ」で十分。始めれば、続きは自然についてくる、最初の 5 分が最大の山だよ。' },
  { id: 'fortune_068', stars: 3, general: '起伏のない、安定した一日だよ。こういう日に基礎を固めると、後で効いてくる。地味な日ほどあとで光るよ ⭐', study: '復習が一番効く日。新規より、過去の単元の再確認に時間を使ってみて。穴がじわじわ埋まっていく感覚。' },
  { id: 'fortune_069', stars: 3, general: '「いつもの」を大事にする日だよ。決まったルーティンをこなすだけでも、ちゃんと上出来。当たり前は実は立派 🍀', study: '平らな勉強運だね。ガツガツ進めるより、自分のペースを守る方が結果が出るタイプの日になりそうだよ。' },
  { id: 'fortune_070', stars: 3, general: '大冒険はお休みの日だよ、{nickname}さん。慣れた道を歩いて、足元を確かめながら進もう。それで十分前進だから 💫', study: '教科書の音読、ノートのまとめ、地味な作業が今日の追い風。派手な勉強より、静かな勉強が合う日だね。' },
  { id: 'fortune_071', stars: 3, general: '今日は「変えない勇気」を持つ日だよ。続けてきたことを、変えずに続けようね。変えないことも立派な選択 🌟', study: '1 教科に絞って取り組む日にしようか。あれもこれもより、深く一点突破が吉。集中対象を絞ってね。' },
  { id: 'fortune_072', stars: 3, general: 'ボクから一言、今日は地道にいこうね。派手な成果より、確かな手応えを大事にする一日にしてみて ⭐', study: '焦って先に進むより、戻ってチェックする方が今日は得だよ。確認の一日、進まないことを恐れないで。' },
  { id: 'fortune_073', stars: 3, general: '静かに自分と向き合う日にしようよ、{nickname}さん。考える時間を持つと、何か見えてくるかも。内省は栄養だよ ✨', study: '解いた問題の見直しが効く日。答え合わせを丁寧にすると、思ってもみなかった発見があったりするよ。' },
  { id: 'fortune_074', stars: 3, general: 'ペースを守る一日にしようね。速すぎず遅すぎず、自分のリズムをキープすると、夜にちょうどよく疲れるよ 😊', study: '集中時間より、勉強時間の確保が大事な日。机に向かう時間を作るだけでも、今日はそれで合格点だよ。' },
  { id: 'fortune_075', stars: 3, general: '今日はあえて「普通」を選ぶ日だよ。普通であることの強さを、{nickname}さんも感じてみてね。継続は力なり、本当に 🍀', study: 'いつもの参考書、いつもの問題集。慣れたものを使う方が今日は伸びるよ、新しい教材に手を出さなくて OK 🌟' },
  { id: 'fortune_076', stars: 2, general: '今日はちょっと焦らず、ゆっくりいこうね、{nickname}さん。深呼吸して、できることから始めるのが今日の正解だよ 🍀', study: '今日は復習だけでも OK だよ。新しい単元に手を出すより、わかってる範囲を確かめる方が今日は吉。' },
  { id: 'fortune_077', stars: 2, general: '慌ただしくなりがちな日だよ。一呼吸置いてから動き出すと、流れがちゃんと整うから、急がないでね 😊', study: '集中が続きにくい日かも。10 分やって 5 分休む、短い区切りで進めてみると、意外と進むよ。' },
  { id: 'fortune_078', stars: 2, general: '無理しなくていい日だよ、{nickname}さん。ペースを落として、丁寧に過ごしてみてね。スピードより質の日 ✨', study: '難問は明日に回そう。今日は基礎問題で、解ける感覚を取り戻す方が大事。自信を持って解ける問題を選んで。' },
  { id: 'fortune_079', stars: 2, general: 'ボクの占い、ちょっと注意の日。急ぐより確認を意識してみるといいよ。慎重さがそのまま安全につながる日 🌟', study: 'ミスしやすい日だから、答えを書いたら必ずもう一度確認するクセを意識してみて。それだけで全然違うよ。' },
  { id: 'fortune_080', stars: 2, general: '今日は「立ち止まる勇気」を持つ日だよ。無理に進まなくていい、一旦止まって周りを見渡してみてね ⭐', study: '量より質、を心がけてみて。1 問でも丁寧に解けたら、今日は十分よくやった、自分を褒めていい日だよ。' },
  { id: 'fortune_081', stars: 2, general: '力を抜いていこうね、{nickname}さん。頑張りすぎは禁物、自分を労わる時間もちゃんと作ってあげてね 🍀', study: '焦って進めるより、わからないところを書き出すだけでも OK。整理することが、ちゃんと勉強だからね。' },
  { id: 'fortune_082', stars: 2, general: '今日はゆっくりがキーワードだよ。急かされても、自分のペースを守ってね。流されないことが今日の課題 😊', study: '苦手単元には触れない日にしても OK。得意な分野で気持ちを整えてあげると、また明日頑張れるよ。' },
  { id: 'fortune_083', stars: 2, general: 'ちょっとミスしやすい日かもしれないよ。いつもの倍、確認しながら進めると安心。慎重モードでいこう ✨', study: '短時間集中型の日。15 分集中、5 分休憩のリズムで取り組むと、頭が疲れにくくて長続きするよ 📚' },
  { id: 'fortune_084', stars: 2, general: '焦らないでね、{nickname}さん。今日は「できなくても OK」のマインドで過ごしてみよう。優しさを自分にも 🌟', study: '教科書を眺めるだけでも勉強だよ。今日はハードルを下げて、続けることを優先しよう。それで合格。' },
  { id: 'fortune_085', stars: 2, general: 'ボクから一言、今日は無理しないでね。休むのも立派な選択肢、頑張る日ばっかりだと心が疲れちゃうから 🍀', study: '復習中心がベストだよ。新規開拓より、知識の再確認に時間を使うと、安心感のある勉強時間になるよ。' },
  { id: 'fortune_086', stars: 2, general: '流れがちょっと逆風の日。流されないように、ゆっくり一歩ずつね。慌てなければちゃんと前には進むよ ⭐', study: '計画通りに進まなくても気にしない日。「やれた分で OK」のマインドで、自分を責めずに過ごしてね。' },
  { id: 'fortune_087', stars: 2, general: '急がば回れの一日だよ、{nickname}さん。ショートカットより、正攻法でいく方が安全。寄り道も学びだよ 😊', study: '暗記より理解、応用より基礎。今日は守りの勉強がちょうどいい、攻めるのは明日以降に取っておこう。' },
  { id: 'fortune_088', stars: 2, general: '心配ごとがあっても、深呼吸してね。今日は無理に解決しようとしなくていい、寝かせる時間も必要だよ ✨', study: '解けない問題に時間をかけすぎないで。30 分悩んだら、解説を見るのも勇気。撤退も戦略の一つだよ。' },
  { id: 'fortune_089', stars: 2, general: 'ペースダウンの日だよ。いつもの 70%くらいで動くと、ちょうどいいかも。アクセル少し緩めて運転して 🌟', study: '1 日のノルマを少なめに設定する日。達成感を味わうために、ハードルを思い切って下げてみてね。' },
  { id: 'fortune_090', stars: 2, general: '今日は守りの日だよ。攻めるより、いつもの自分を守ることを優先してね、{nickname}さん。守るのも立派な戦略 🍀', study: '5 分でもいい、机に向かえたら今日は合格。続けることが、何より大事、ゼロじゃないことを大切にして 🍀' },
  { id: 'fortune_091', stars: 1, general: '今日はゆっくり休んでも大丈夫だよ、{nickname}さん。明日に向けて、心と体を整える日にしてあげてね 🍀', study: '今日は勉強もペースダウンで OK。教科書を開いただけで合格、ハードル下げて続けることだけ意識して。' },
  { id: 'fortune_092', stars: 1, general: 'ボクからお願い、今日は無理しないでね。休むことも立派な努力なんだよ、サボりとは違うから安心して 😊', study: '5 分でも机に向かえたら大成功だよ。続けることだけ意識して、今日はがんばらないことを目標に。' },
  { id: 'fortune_093', stars: 1, general: 'ペースを大幅に落とす日だよ。いつもの半分でもいいから、自分を大事にしてね。優先順位は自分 1 番 ✨', study: '復習も新規もお休みで OK。代わりにノートを整理するだけでもいい、勉強机に座るだけで十分だよ。' },
  { id: 'fortune_094', stars: 1, general: '今日は「やらない選択」もアリだよ、{nickname}さん。罪悪感は持たないで、ゆっくり過ごす日にしようね 🌟', study: '勉強より休息を優先する日。エネルギー切れの状態で進めても頭に入らない、今日は充電に専念しよう。' },
  { id: 'fortune_095', stars: 1, general: '心と体の充電日だよ。何もしない時間も大事、明日のためにエネルギーを蓄える、それも立派な過ごし方 ⭐', study: '単語 1 個、漢字 1 個でも今日は OK。「ゼロじゃない」が大事、続いてる事実を絶やさないこと。' },
  { id: 'fortune_096', stars: 1, general: 'ボクの占い、今日は休息推奨だよ。頑張った自分にご褒美の時間をあげてね、自分への投資だと思って 🍀', study: '教科書を眺めるだけ、解説を読むだけ。インプットだけの日にしても、それで今日は十分なんだよ。' },
  { id: 'fortune_097', stars: 1, general: '流れが穏やかすぎる日だよ。無理に動かず、ふんわり過ごすのが正解。今日は省エネモードで生きていこう 😊', study: '今日できなかった分は、明日少しずつ取り戻せば OK。気負わずいこう、明日の自分に任せていいよ 🍀' },
  { id: 'fortune_098', stars: 1, general: '立ち止まる勇気を持とうね、{nickname}さん。休むことは、後退じゃないんだよ。準備期間って呼んでもいい ✨', study: '1 問でも解けたら拍手モノだよ。今日のハードルは思いっきり下げて取り組んで、自分に優しくね。' },
  { id: 'fortune_099', stars: 1, general: '今日は深呼吸の一日だよ。ゆっくり吸って、ゆっくり吐いて、それだけでも OK。呼吸を整えるだけで価値ある 🌟', study: '勉強机に座るだけでも勉強。動き出せたら、それだけで上出来、続きは出来そうなら少しだけでいいよ。' },
  { id: 'fortune_100', stars: 1, general: '明日に備える日だよ、{nickname}さん。今日は無理せず、リセットの時間を大事にしてね。ボクも一緒に休むよ ⭐', study: '「明日からまた頑張る」って決めるだけでも、今日の役目は十分果たせたよ。決意もちゃんと勉強の一部 🌟' }
];

// stars レベルを決定論的に選ぶ（重み配分 5=20% / 4=25% / 3=30% / 2=15% / 1=10%）。
// mod 100 でマッピング、変動なし。
function _fortunePickStars(seedHash) {
  const mod = seedHash % 100;
  if (mod < 20) return 5;       // 0..19 → 20%
  if (mod < 45) return 4;       // 20..44 → 25%
  if (mod < 75) return 3;       // 45..74 → 30%
  if (mod < 90) return 2;       // 75..89 → 15%
  return 1;                     // 90..99 → 10%
}

// 選ばれた stars の骨格プールから 1 つを決定論的に選ぶ。
// 万一プールが空（将来 stars 配分を弄って空にした等）の場合は全プールから fallback。
function _fortunePickPreset(stars, seedHash) {
  const pool = FORTUNE_PRESETS.filter(function(p){ return p.stars === stars; });
  if (pool.length === 0) {
    return FORTUNE_PRESETS[seedHash % FORTUNE_PRESETS.length];
  }
  return pool[seedHash % pool.length];
}

const FORTUNE_LUCKY_COLORS  = ['赤', '青', '黄', '緑', '紫', '白', '黒', 'ピンク', 'オレンジ', '水色', '金', '銀'];
const FORTUNE_LUCKY_NUMBERS = [1, 3, 5, 7, 9, 11, 13, 17, 21, 23, 29, 33];
const FORTUNE_LUCKY_FOODS   = ['いちご', 'りんご', 'チョコ', 'おにぎり', 'カレー', 'うどん', 'プリン', 'バナナ', 'たまご', 'みかん', 'パン', 'アイス'];

// 簡易ハッシュ（GAS で使える、決定論的）。同じ文字列なら同じ非負整数を返す。
function _fortuneHash(seedStr) {
  let h = 0;
  const s = String(seedStr || '');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0; // 32bit
  }
  return Math.abs(h);
}

// ニックネーム空欄時の差し込みフォールバック。
// {nickname} の直後に「さん」が付くテンプレートで「あなたさん」にならないよう、
// nickname 自体を '' にし、'さん' を取り除く形で 2 段階置換する。
function _fortuneApplyVariables(template, vars) {
  let t = String(template || '');
  const nick = String(vars.nickname || '').trim();
  if (nick) {
    t = t.replace(/\{nickname\}/g, nick);
  } else {
    // 「{nickname}さん」→「あなた」、孤立 {nickname} もフォールバック
    t = t.replace(/\{nickname\}さん/g, 'あなた');
    t = t.replace(/\{nickname\}/g, 'あなた');
  }
  t = t.replace(/\{title\}/g,  String(vars.title  || ''));
  t = t.replace(/\{streak\}/g, String(vars.streak || 0));
  return t;
}

// ========================================================================
// 誕生日 & 星座（2026-05-13 Phase 2 段階A 新規）
// ------------------------------------------------------------------------
// 用途：誕生日（MM-DD）を Students/SpecialAccounts シートに保存し、星座運の
//       選択 + 誕生日サプライズ（誕生日と今日が一致した時の祝賀バナー）に使う。
//
// プライバシー方針：
//   - 「月・日」のみ保存（年は保存しない）。星座判定と誕生日マッチにしか
//     使わないため、年情報は不要。
//   - 形式：'MM-DD'（例：'08-15'、'01-09'）。空文字 = 未入力。
//
// 実装方針：
//   - 列名 'BIRTHDAY' をヘッダーから動的に解決する（COL_BIRTHDAY 定数は使わない）。
//     理由：SpecialAccounts シートは accountType 列が末尾に既に存在するため、
//     固定インデックスにすると 2 シート間で位置が乖離する。ヘッダー駆動なら
//     どちらのシートでも安全に動く。
//   - 列がなければ saveBirthday 内で末尾に追加（schema migration）。
//   - キャッシュ整合性：列を追加した場合 / 値を書き込んだ場合は対応する
//     Students/SpecialAccounts キャッシュを invalidate（次回 read で fresh）。
// ========================================================================

const BIRTHDAY_HEADER_NAME = 'BIRTHDAY';

// allValues の 1 行目（ヘッダー）から 'BIRTHDAY' 列の 0-based index を返す。
// 列が存在しなければ -1。allValues は _findAccountRowOnSheet 等が返す
// 「シート全体の values 配列」を想定。
function _findBirthdayColIdx(allValues) {
  if (!allValues || !allValues.length || !allValues[0] || !allValues[0].length) return -1;
  const header = allValues[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === BIRTHDAY_HEADER_NAME) return i;
  }
  return -1;
}

// 指定シートに 'BIRTHDAY' 列があれば 0-based index を返す。
// なければ最右列の右側に追加してその index を返す。
// 戻り値: { idx, created }（created=true なら今回追加したことを示す）
function _ensureBirthdayColOnSheet(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === BIRTHDAY_HEADER_NAME) {
      return { idx: i, created: false };
    }
  }
  // 末尾に追加（既存データ列には触らない）
  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue(BIRTHDAY_HEADER_NAME);
  return { idx: newCol - 1, created: true };
}

// loc.allValues から birthday 文字列（'MM-DD' or ''）を抽出する。
// loc は _findAccountRowOnSheet が返したもの。BIRTHDAY 列がなければ ''。
//
// ★ 注意（2026-05-13 段階A バグ修正）：
//   Google Sheets はセルの数値フォーマット未指定状態で setValue('05-13') すると、
//   '05-13' を「日付（5/13）」と解釈して Date オブジェクトとして保存することがある
//   （ロケール依存）。getDataRange().getValues() で読み戻すと Date インスタンスが
//   返ってきて、String(date) は "Tue May 13 2026 ..." のような形式になり、
//   _validateBirthdayMMDD の /^\d{2}-\d{2}$/ にマッチせず星座運がまるごと
//   非表示になる（段階A の動作確認で発生したバグ 2/3 の真因）。
//   対策：① saveBirthday 側で setNumberFormat('@') で text に固定（新規書き込み分の根本対策）
//        ② 本関数で Date オブジェクトを MM-DD に再構成（既書込分の救済 + 防御）
function _readBirthdayFromLoc(loc) {
  if (!loc) return '';
  const bIdx = _findBirthdayColIdx(loc.allValues);
  if (bIdx < 0) return '';
  const v = loc.rowValues[bIdx];
  if (v == null || v === '') return '';
  // Date 救済：Google Sheets が "05-13" を自動的に日付化していたケースに対応。
  // 年情報は捨てて MM-DD に再構成（プライバシー仕様にも合致）。
  if (v instanceof Date) {
    const mm = v.getMonth() + 1;
    const dd = v.getDate();
    return (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  }
  return String(v).trim();
}

// MM-DD 文字列のバリデーション（うるう年は問題なし＝年なし保存のため 2/29 OK）。
// 戻り値: { ok, message?, mm, dd, normalized? }
function _validateBirthdayMMDD(s) {
  const t = String(s || '').trim();
  if (!/^\d{2}-\d{2}$/.test(t)) {
    return { ok: false, message: '誕生日の形式が正しくありません（MM-DD）' };
  }
  const mm = parseInt(t.substring(0, 2), 10);
  const dd = parseInt(t.substring(3, 5), 10);
  if (!mm || mm < 1 || mm > 12) return { ok: false, message: '月は 1〜12 で指定してください' };
  if (!dd || dd < 1 || dd > 31) return { ok: false, message: '日は 1〜31 で指定してください' };
  // 月別の上限チェック（2/29 は許容、4/31 等の不正値は弾く）
  const maxDay = (function(){
    if (mm === 2) return 29; // うるう年関係なく 2/29 まで許容
    if ([4, 6, 9, 11].indexOf(mm) >= 0) return 30;
    return 31;
  })();
  if (dd > maxDay) return { ok: false, message: mm + '月は ' + maxDay + ' 日までです' };
  return { ok: true, mm: mm, dd: dd, normalized: t };
}

// 12 星座テーブル（トロピカル方式）。
const ZODIAC_TABLE = [
  { z: 'capricorn',   jp: '山羊座',   sym: '♑', period: '12/22〜1/19',  start: [12, 22], end: [1, 19] },
  { z: 'aquarius',    jp: '水瓶座',   sym: '♒', period: '1/20〜2/18',   start: [1, 20],  end: [2, 18] },
  { z: 'pisces',      jp: '魚座',     sym: '♓', period: '2/19〜3/20',   start: [2, 19],  end: [3, 20] },
  { z: 'aries',       jp: '牡羊座',   sym: '♈', period: '3/21〜4/19',   start: [3, 21],  end: [4, 19] },
  { z: 'taurus',      jp: '牡牛座',   sym: '♉', period: '4/20〜5/20',   start: [4, 20],  end: [5, 20] },
  { z: 'gemini',      jp: '双子座',   sym: '♊', period: '5/21〜6/21',   start: [5, 21],  end: [6, 21] },
  { z: 'cancer',      jp: '蟹座',     sym: '♋', period: '6/22〜7/22',   start: [6, 22],  end: [7, 22] },
  { z: 'leo',         jp: '獅子座',   sym: '♌', period: '7/23〜8/22',   start: [7, 23],  end: [8, 22] },
  { z: 'virgo',       jp: '乙女座',   sym: '♍', period: '8/23〜9/22',   start: [8, 23],  end: [9, 22] },
  { z: 'libra',       jp: '天秤座',   sym: '♎', period: '9/23〜10/23',  start: [9, 23],  end: [10, 23] },
  { z: 'scorpio',     jp: '蠍座',     sym: '♏', period: '10/24〜11/22', start: [10, 24], end: [11, 22] },
  { z: 'sagittarius', jp: '射手座',   sym: '♐', period: '11/23〜12/21', start: [11, 23], end: [12, 21] }
];

/**
 * MM-DD 形式の誕生日から星座を判定。
 * @param {string} birthday - "MM-DD" 形式（例："08-15"）
 * @return {{zodiac, zodiac_jp, symbol, period}|null}
 *   - 2/29 生まれは 2/19〜3/20 の範囲なので「魚座」になる（内部仕様）
 */
function _getZodiac(birthday) {
  const v = _validateBirthdayMMDD(birthday);
  if (!v.ok) return null;
  const m = v.mm;
  const d = v.dd;
  for (let i = 0; i < ZODIAC_TABLE.length; i++) {
    const item = ZODIAC_TABLE[i];
    const sm = item.start[0], sd = item.start[1];
    const em = item.end[0],   ed = item.end[1];
    if (sm === em) {
      if (m === sm && d >= sd && d <= ed) {
        return { zodiac: item.z, zodiac_jp: item.jp, symbol: item.sym, period: item.period };
      }
    } else {
      // 月またぎ（山羊座のみ：12/22〜1/19）
      if ((m === sm && d >= sd) || (m === em && d <= ed)) {
        return { zodiac: item.z, zodiac_jp: item.jp, symbol: item.sym, period: item.period };
      }
    }
  }
  return null;
}

// ========================================================================
// 星座運 本骨格（2026-05-13 Phase 2 段階B、プリスレ生成版 v2.0、計 60 個）。
// ------------------------------------------------------------------------
// 12 星座 × 5 stars レベル = 60 個。順序は aries→taurus→...→pisces、
// 各星座内は stars=5→1（プリスレが既にこの順序で出力済みのまま保持）。
// {nickname} 差し込みは stars=5/4/2 にあり（テンプレ側で「呼びかけ」が
// 入る位置のみ）、_fortuneApplyVariables で nickname/title/streak を差し込む。
// 将来 zodiac × stars の組み合わせを複数化したくなった時は、同じ zodiac+stars
// の preset を複数追加すれば _zodiacPickPreset が自動的に hash で選択する設計。
// ========================================================================
const ZODIAC_PRESETS = [
  { id: 'zodiac_aries_5',       zodiac: 'aries',       zodiac_jp: '牡羊座', stars: 5, message: '牡羊座の{nickname}さん、今日は持ち前の行動力が大爆発する日だよ。直感を信じて、一気に飛び込んでみて ⭐' },
  { id: 'zodiac_aries_4',       zodiac: 'aries',       zodiac_jp: '牡羊座', stars: 4, message: '牡羊座らしい情熱がうまく回る日。リーダーシップを発揮するチャンス、声を上げると流れが変わるよ 🌟' },
  { id: 'zodiac_aries_3',       zodiac: 'aries',       zodiac_jp: '牡羊座', stars: 3, message: '今日の牡羊座は自分のペースで OK。突っ走らず、ときどき後ろも振り返ってみてね 🍀' },
  { id: 'zodiac_aries_2',       zodiac: 'aries',       zodiac_jp: '牡羊座', stars: 2, message: '牡羊座の{nickname}さん、今日は行動力が空回りしがち。一呼吸置いてから動くと、ちゃんと噛み合うよ 😊' },
  { id: 'zodiac_aries_1',       zodiac: 'aries',       zodiac_jp: '牡羊座', stars: 1, message: '牡羊座も今日は休む日があっていい。急がず、明日また走り出せば大丈夫だよ ✨' },
  { id: 'zodiac_taurus_5',      zodiac: 'taurus',      zodiac_jp: '牡牛座', stars: 5, message: '牡牛座の{nickname}さん、粘り強さが実を結ぶ日。続けてきたことが、大きな成果として返ってくるよ ⭐' },
  { id: 'zodiac_taurus_4',      zodiac: 'taurus',      zodiac_jp: '牡牛座', stars: 4, message: '牡牛座らしい安定感がプラスに働く日。じっくり積み上げると、確実に手応えが出るよ 🌟' },
  { id: 'zodiac_taurus_3',      zodiac: 'taurus',      zodiac_jp: '牡牛座', stars: 3, message: '今日はいつもの牡牛座ペースで OK。変えなくていい、慣れた道がそのまま正解だよ 🍀' },
  { id: 'zodiac_taurus_2',      zodiac: 'taurus',      zodiac_jp: '牡牛座', stars: 2, message: '牡牛座の{nickname}さん、マイペースを乱されがちな日。流されず、自分のリズムを守ってね 😊' },
  { id: 'zodiac_taurus_1',      zodiac: 'taurus',      zodiac_jp: '牡牛座', stars: 1, message: '牡牛座は動かない勇気も強み。今日はじっとしてるくらいでちょうどいいんだよ ✨' },
  { id: 'zodiac_gemini_5',      zodiac: 'gemini',      zodiac_jp: '双子座', stars: 5, message: '双子座の{nickname}さん、好奇心が冴えわたる日。気になったこと、片っ端から手を出してみていいよ ⭐' },
  { id: 'zodiac_gemini_4',      zodiac: 'gemini',      zodiac_jp: '双子座', stars: 4, message: '双子座らしいコミュ力がフル稼働の日。誰かと話すと、いい流れが舞い込んでくるよ 🌟' },
  { id: 'zodiac_gemini_3',      zodiac: 'gemini',      zodiac_jp: '双子座', stars: 3, message: '今日の双子座は機敏な動きが普段通りに発揮できる日。軽やかに過ごしてみて 🍀' },
  { id: 'zodiac_gemini_2',      zodiac: 'gemini',      zodiac_jp: '双子座', stars: 2, message: '双子座の{nickname}さん、あれこれ手を出しすぎず、今日は 1 つに絞ると吉だよ 😊' },
  { id: 'zodiac_gemini_1',      zodiac: 'gemini',      zodiac_jp: '双子座', stars: 1, message: '双子座も今日は情報の波から少し離れて、静かに過ごす日にしてみてね ✨' },
  { id: 'zodiac_cancer_5',      zodiac: 'cancer',      zodiac_jp: '蟹座',   stars: 5, message: '蟹座の{nickname}さん、持ち前の優しさが返ってくる日だよ。人に恵まれる予感、大切にしてね ⭐' },
  { id: 'zodiac_cancer_4',      zodiac: 'cancer',      zodiac_jp: '蟹座',   stars: 4, message: '蟹座の共感力で誰かを支えると、自分にも温かい力が返ってくる日になるよ 🌟' },
  { id: 'zodiac_cancer_3',      zodiac: 'cancer',      zodiac_jp: '蟹座',   stars: 3, message: '今日の蟹座は身近な人と穏やかに過ごすのが吉。落ち着いた時間が栄養になるよ 🍀' },
  { id: 'zodiac_cancer_2',      zodiac: 'cancer',      zodiac_jp: '蟹座',   stars: 2, message: '蟹座の{nickname}さん、感情が揺れやすい日。深呼吸して、落ち着いて過ごしてね 😊' },
  { id: 'zodiac_cancer_1',      zodiac: 'cancer',      zodiac_jp: '蟹座',   stars: 1, message: '蟹座は心を守る日も大事。安心できる場所で、ゆっくり充電してね ✨' },
  { id: 'zodiac_leo_5',         zodiac: 'leo',         zodiac_jp: '獅子座', stars: 5, message: '獅子座の{nickname}さん、持ち前の輝きが今日は特別。周りからも注目される予感、堂々といこう ⭐' },
  { id: 'zodiac_leo_4',         zodiac: 'leo',         zodiac_jp: '獅子座', stars: 4, message: '獅子座らしい自信を持って表現すると、いい反応が返ってくる日。胸を張って 🌟' },
  { id: 'zodiac_leo_3',         zodiac: 'leo',         zodiac_jp: '獅子座', stars: 3, message: '今日の獅子座はいつも通り堂々と。特別なことをしなくても、存在感は十分だよ 🍀' },
  { id: 'zodiac_leo_2',         zodiac: 'leo',         zodiac_jp: '獅子座', stars: 2, message: '獅子座の{nickname}さん、今日は目立とうとせず、控えめにいくのが吉。一歩引く勇気を 😊' },
  { id: 'zodiac_leo_1',         zodiac: 'leo',         zodiac_jp: '獅子座', stars: 1, message: '獅子座も今日はスポットライトはお休み。影でゆっくり休息する日にしようね ✨' },
  { id: 'zodiac_virgo_5',       zodiac: 'virgo',       zodiac_jp: '乙女座', stars: 5, message: '乙女座の{nickname}さん、緻密さが冴え渡る日。細かい作業がいつもより完璧に進む、満足度高い一日に ⭐' },
  { id: 'zodiac_virgo_4',       zodiac: 'virgo',       zodiac_jp: '乙女座', stars: 4, message: '乙女座の分析力が活きる日。データや情報を整理してみると、新しい発見があるよ 🌟' },
  { id: 'zodiac_virgo_3',       zodiac: 'virgo',       zodiac_jp: '乙女座', stars: 3, message: '今日の乙女座は几帳面さを発揮しつつ、コツコツ進めれば OK。地味な作業も丁寧に 🍀' },
  { id: 'zodiac_virgo_2',       zodiac: 'virgo',       zodiac_jp: '乙女座', stars: 2, message: '乙女座の{nickname}さん、完璧主義は今日は禁物。70%できれば合格、それでいいんだよ 😊' },
  { id: 'zodiac_virgo_1',       zodiac: 'virgo',       zodiac_jp: '乙女座', stars: 1, message: '乙女座も今日は細かいこと気にしない日。少し大雑把に過ごすくらいがちょうどいいよ ✨' },
  { id: 'zodiac_libra_5',       zodiac: 'libra',       zodiac_jp: '天秤座', stars: 5, message: '天秤座の{nickname}さん、バランス感覚が最高潮の日。調整役として周りから頼られる予感だよ ⭐' },
  { id: 'zodiac_libra_4',       zodiac: 'libra',       zodiac_jp: '天秤座', stars: 4, message: '天秤座の美意識が冴える日。好きなものに囲まれて過ごすと、エネルギーが湧いてくるよ 🌟' },
  { id: 'zodiac_libra_3',       zodiac: 'libra',       zodiac_jp: '天秤座', stars: 3, message: '今日の天秤座は周りとの調和を大事に。いつも通りの社交モードで吉だよ 🍀' },
  { id: 'zodiac_libra_2',       zodiac: 'libra',       zodiac_jp: '天秤座', stars: 2, message: '天秤座の{nickname}さん、迷いやすい日。決めきれなくても自分を責めないでね 😊' },
  { id: 'zodiac_libra_1',       zodiac: 'libra',       zodiac_jp: '天秤座', stars: 1, message: '天秤座も今日は人付き合いはお休み。一人の時間を、じっくり楽しんでみてね ✨' },
  { id: 'zodiac_scorpio_5',     zodiac: 'scorpio',     zodiac_jp: '蠍座',   stars: 5, message: '蠍座の{nickname}さん、洞察力が最大化する日。物事の本質を見抜ける、頼もしい一日になるよ ⭐' },
  { id: 'zodiac_scorpio_4',     zodiac: 'scorpio',     zodiac_jp: '蠍座',   stars: 4, message: '蠍座らしい集中力が深まる日。1 つのことに没頭すると、大きな手応えが残るよ 🌟' },
  { id: 'zodiac_scorpio_3',     zodiac: 'scorpio',     zodiac_jp: '蠍座',   stars: 3, message: '今日の蠍座はいつもの深さで物事に向き合えば OK。自分の感覚を信じてみて 🍀' },
  { id: 'zodiac_scorpio_2',     zodiac: 'scorpio',     zodiac_jp: '蠍座',   stars: 2, message: '蠍座の{nickname}さん、考えすぎ注意の日。今日は表面をなぞるくらいでちょうどいいよ 😊' },
  { id: 'zodiac_scorpio_1',     zodiac: 'scorpio',     zodiac_jp: '蠍座',   stars: 1, message: '蠍座も今日は深掘りはお休み。軽やかに、表面を泳ぐくらいで過ごしてみてね ✨' },
  { id: 'zodiac_sagittarius_5', zodiac: 'sagittarius', zodiac_jp: '射手座', stars: 5, message: '射手座の{nickname}さん、冒険心が最高潮の日。新しい挑戦をするなら、今日が絶好のタイミング ⭐' },
  { id: 'zodiac_sagittarius_4', zodiac: 'sagittarius', zodiac_jp: '射手座', stars: 4, message: '射手座の自由な発想が活きる日。好きなことに時間を使うと、ひらめきが降りてくるよ 🌟' },
  { id: 'zodiac_sagittarius_3', zodiac: 'sagittarius', zodiac_jp: '射手座', stars: 3, message: '今日の射手座は楽観的にいつも通りで OK。気楽にいくのが、結局いちばん効くんだよ 🍀' },
  { id: 'zodiac_sagittarius_2', zodiac: 'sagittarius', zodiac_jp: '射手座', stars: 2, message: '射手座の{nickname}さん、風呂敷を広げすぎず、今日は足元を見るのが吉だよ 😊' },
  { id: 'zodiac_sagittarius_1', zodiac: 'sagittarius', zodiac_jp: '射手座', stars: 1, message: '射手座も今日は行動範囲を狭めて OK。休むのも、自由のうちの一つだよ ✨' },
  { id: 'zodiac_capricorn_5',   zodiac: 'capricorn',   zodiac_jp: '山羊座', stars: 5, message: '山羊座の{nickname}さん、努力が形になる日。目指してた目標が、一気に近づく予感がするよ ⭐' },
  { id: 'zodiac_capricorn_4',   zodiac: 'capricorn',   zodiac_jp: '山羊座', stars: 4, message: '山羊座の堅実さが報われる日。コツコツ積み上げてきた成果が、ちゃんと見える形で返ってくるよ 🌟' },
  { id: 'zodiac_capricorn_3',   zodiac: 'capricorn',   zodiac_jp: '山羊座', stars: 3, message: '今日の山羊座はマイペースで前進すれば OK。地道な一歩を、いつも通り重ねてね 🍀' },
  { id: 'zodiac_capricorn_2',   zodiac: 'capricorn',   zodiac_jp: '山羊座', stars: 2, message: '山羊座の{nickname}さん、頑張りすぎ注意の日。適度に肩の力を抜くのも、立派な戦略だよ 😊' },
  { id: 'zodiac_capricorn_1',   zodiac: 'capricorn',   zodiac_jp: '山羊座', stars: 1, message: '山羊座も今日は目標を一旦置いて、自分を労う日にしてみて。休むのも目標の一部 ✨' },
  { id: 'zodiac_aquarius_5',    zodiac: 'aquarius',    zodiac_jp: '水瓶座', stars: 5, message: '水瓶座の{nickname}さん、独創性が冴える日。自分らしいアイデアを、堂々と出してみて ⭐' },
  { id: 'zodiac_aquarius_4',    zodiac: 'aquarius',    zodiac_jp: '水瓶座', stars: 4, message: '水瓶座の自由な発想が、周りにも刺激を与える日。型にはまらない発想を、堂々と表に出してみてね 🌟' },
  { id: 'zodiac_aquarius_3',    zodiac: 'aquarius',    zodiac_jp: '水瓶座', stars: 3, message: '今日の水瓶座はいつも通り自分の道で進めば OK。マイペースが今日は強みだよ 🍀' },
  { id: 'zodiac_aquarius_2',    zodiac: 'aquarius',    zodiac_jp: '水瓶座', stars: 2, message: '水瓶座の{nickname}さん、個性を主張しすぎず、ちょっと周りに合わせるくらいがちょうどいい日 😊' },
  { id: 'zodiac_aquarius_1',    zodiac: 'aquarius',    zodiac_jp: '水瓶座', stars: 1, message: '水瓶座も今日は一人の時間で静かに過ごす日に。インプットだけの日があってもいいよ ✨' },
  { id: 'zodiac_pisces_5',      zodiac: 'pisces',      zodiac_jp: '魚座',   stars: 5, message: '魚座の{nickname}さん、感受性が冴えわたる日。創造的なひらめきが舞い込んでくる、特別な一日に ⭐' },
  { id: 'zodiac_pisces_4',      zodiac: 'pisces',      zodiac_jp: '魚座',   stars: 4, message: '魚座の優しさが人を動かす日。誰かをそっと支えると、自分の心も温かくなるよ 🌟' },
  { id: 'zodiac_pisces_3',      zodiac: 'pisces',      zodiac_jp: '魚座',   stars: 3, message: '今日の魚座は夢想にひたる時間も大事。いつも通り、自分の世界を持って過ごしてね 🍀' },
  { id: 'zodiac_pisces_2',      zodiac: 'pisces',      zodiac_jp: '魚座',   stars: 2, message: '魚座の{nickname}さん、感情に振り回されないで、今日は現実をそっと見つめてみてね 😊' },
  { id: 'zodiac_pisces_1',      zodiac: 'pisces',      zodiac_jp: '魚座',   stars: 1, message: '魚座も今日は心の充電日。好きな世界に浸るのが、ちゃんと栄養になるよ ✨' }
];

// 星座 × stars レベルから 1 個選ぶ（決定論的）。
// 現状は各組み合わせ 1 個ずつなので形式的だが、同じ zodiac+stars を複数追加すれば
// _fortuneHash で自動的に複数候補から選択する設計にしてある（将来拡張用）。
// プール 0 件のケースは理論上発生しないが、安全側で同 zodiac の任意 1 個に
// フォールバック → それも無ければ ZODIAC_PRESETS[0]。
function _zodiacPickPreset(zodiac, stars, seedHash) {
  const pool = ZODIAC_PRESETS.filter(function(p){ return p.zodiac === zodiac && p.stars === stars; });
  if (pool.length > 0) return pool[seedHash % pool.length];
  // フォールバック 1：同 zodiac の任意 1 個
  const same = ZODIAC_PRESETS.filter(function(p){ return p.zodiac === zodiac; });
  if (same.length > 0) return same[seedHash % same.length];
  // フォールバック 2：全体から（理論上到達しない）
  return ZODIAC_PRESETS[seedHash % ZODIAC_PRESETS.length];
}

// ========================================================================
// 誕生日サプライズ 本骨格（2026-05-13 Phase 2 段階B、プリスレ生成版 v2.0、計 10 個）
// ------------------------------------------------------------------------
// 全メッセージに {nickname} 差し込み点あり。_fortuneApplyVariables で nickname を
// 差し込む（未入力なら 'あなた' フォールバック）。
// シードは studentId + year（西暦）。同じ年内は同じメッセージ、翌年は別メッセージ
// が当たる設計で、複数年の継続利用でも飽きない。
// ========================================================================
const BIRTHDAY_MESSAGES = [
  { id: 'birthday_msg_001', message: '🎂 お誕生日おめでとう、{nickname}さん！ボクからの贈り物は、今日いちにちの大きな幸運だよ。思いっきり笑顔で過ごしてね 🎉✨' },
  { id: 'birthday_msg_002', message: '{nickname}さん、生まれてきてくれてありがとう 🎁 今日は 1 年に 1 度のスペシャルデー、ボクからの応援を受け取ってね 🌟' },
  { id: 'birthday_msg_003', message: '🎉 ハッピーバースデー、{nickname}さん!ボクは知ってるよ、ここまで頑張ってきた{nickname}さんのこと。今日は誇らしい日だね ✨' },
  { id: 'birthday_msg_004', message: '特別な日が来たよ、{nickname}さん 🎂 今日はマイカツ君からの祝福を、ぜんぶ受け取って。新しい 1 年もずっと隣にいるからね 🎁' },
  { id: 'birthday_msg_005', message: '{nickname}さんの新しい 1 年がスタートする日！🌟 ボクからの願いは、{nickname}さんが毎日笑っていられること。おめでとう 🎉' },
  { id: 'birthday_msg_006', message: '今日は{nickname}さん主役の日だよ 🎂 ボクは小さな相棒だけど、今日いちにちは特大の応援を送るからね、おめでとう ✨🎁' },
  { id: 'birthday_msg_007', message: 'ボクから{nickname}さんへ、特別なお祝いを 🎉 努力を続けてきた{nickname}さんに、今日は最高の運気をプレゼントするよ 🌟' },
  { id: 'birthday_msg_008', message: '1 年に 1 度の{nickname}さんデーがやってきた 🎂 今日はゆったり、好きなことをして過ごしてね。お祝いの気持ちを込めて ✨🎉' },
  { id: 'birthday_msg_009', message: '「ありがとう」を伝えたい日、{nickname}さん 🎁 一緒に学んでくれて、ボクは毎日嬉しいよ。これからもよろしくね、おめでとう ✨' },
  { id: 'birthday_msg_010', message: '新しい 1 年の始まりに、ボクからエールを送るよ、{nickname}さん 🎂 今日は最高の 1 日にしようね、おめでとう 🎉🌟' }
];

// 誕生日サプライズメッセージを決定論的に選択。
// シード：studentId + year（西暦 4 桁）。
// - 同じ年内は同じメッセージ（誕生日に何度開いても同じ）
// - 翌年は別メッセージが当たる可能性が高い（同じ生徒の連年体験を新鮮に保つ）
// 戻り値：{ id, message } のオブジェクト。呼び出し側で nickname 差し込みを行う。
function _pickBirthdaySurpriseMessage(studentId, year) {
  const seed = String(studentId || '') + '_' + String(year || '');
  const hash = _fortuneHash(seed);
  return BIRTHDAY_MESSAGES[hash % BIRTHDAY_MESSAGES.length];
}

// =============================================
// saveBirthday：誕生日を Students / SpecialAccounts シートに保存
// =============================================
function saveBirthday(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    const raw = String((params && params.birthday)  || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };

    // 空文字を渡された場合は「削除」扱い（誕生日入力をやめる経路の予備）
    let valueToWrite = '';
    if (raw !== '') {
      const v = _validateBirthdayMMDD(raw);
      if (!v.ok) return { ok: false, message: v.message };
      valueToWrite = v.normalized;
    }

    // 書き込み対象行をフレッシュに特定（Students 優先、フォールバック SpecialAccounts）
    const loc = _findAccountRowOnSheet(sid);
    if (!loc) return { ok: false, message: '生徒IDが見つかりません' };

    // 該当シートで BIRTHDAY 列を保証
    const ensure = _ensureBirthdayColOnSheet(loc.sheet);
    const birthdayColIdx = ensure.idx;

    // 値を書き込み。
    // ★ 重要（2026-05-13 バグ修正）：setNumberFormat('@') でセルを text 固定してから書く。
    //   これをしないと Google Sheets が '05-13' を「5/13（日付型）」と解釈して Date 化し、
    //   読み戻し時に _readBirthdayFromLoc が String(Date) を返して MM-DD 比較に失敗する。
    //   段階A 初版で「星座運が表示されない / 誕生日バナーが出ない」バグの真因だった。
    const cell = loc.sheet.getRange(loc.rowIdx + 1, birthdayColIdx + 1);
    cell.setNumberFormat('@');
    cell.setValue(valueToWrite);

    // キャッシュ整合性：
    //   - 列を今回追加した場合は、cache の各行に BIRTHDAY 列分のスロットが
    //     存在しないため in-place 更新だと配列長不一致になる。安全側で
    //     対応シートのキャッシュを invalidate（次回 read で fresh）。
    //   - 列が既にあった場合も、cache 経由読み取りで invalidate しておくのが
    //     最も簡単（保存頻度は低いので追加 read コストは無視できる範囲）。
    try {
      const cache = CacheService.getScriptCache();
      if (loc.sheetName === SHEET_STUDENTS) {
        cache.remove('cache_students_values');
        _cacheLog('cache_students_values', 'invalidate', 'saveBirthday sid=' + sid);
      } else {
        cache.remove('cache_special_accounts_values');
        _cacheLog('cache_special_accounts_values', 'invalidate', 'saveBirthday sid=' + sid);
      }
    } catch(_) {}

    return { ok: true, birthday: valueToWrite };
  } catch (err) {
    console.error('[saveBirthday]', err);
    return { ok: false, message: String(err) };
  }
}

// ========================================================================
// 誕生日サプライズ画面 表示制御（2026-05-14 Phase 2 段階C 新規）
// ------------------------------------------------------------------------
// 仕様：
//   - 誕生日当日の「初回ログイン時のみ」サプライズ画面を全画面表示。
//   - その年に既に見たら同日内に再ログインしても表示しない（年単位リセット）。
//   - 翌年の誕生日には再度 1 回だけ表示される。
//
// 実装方針：
//   - Students / SpecialAccounts シートに 'LAST_BIRTHDAY_GREET_YEAR' 列を新設
//     （BIRTHDAY 列と同じヘッダー駆動パターン、固定インデックスは使わない）。
//   - 形式は西暦 4 桁の数値文字列（例：'2026'）。空文字は「未表示」。
//   - 年取得は _sangoToday() の先頭 4 文字（教育日基準で 0:00〜2:59 は前日年）。
//
// セル書き込み時：Google Sheets の locale 自動変換を防ぐため
// setNumberFormat('@') で text 固定してから setValue（BIRTHDAY 列と同じ防御）。
// ========================================================================

const GREET_YEAR_HEADER_NAME = 'LAST_BIRTHDAY_GREET_YEAR';

// allValues の 1 行目（ヘッダー）から GREET_YEAR 列の 0-based index を返す。
// 列が存在しなければ -1。
function _findGreetYearColIdx(allValues) {
  if (!allValues || !allValues.length || !allValues[0] || !allValues[0].length) return -1;
  const header = allValues[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === GREET_YEAR_HEADER_NAME) return i;
  }
  return -1;
}

// 指定シートに GREET_YEAR 列があれば 0-based index を返す。
// なければ最右列の右側に追加してその index を返す。
// 戻り値: { idx, created }（created=true なら今回追加したことを示す）
function _ensureGreetYearColOnSheet(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === GREET_YEAR_HEADER_NAME) {
      return { idx: i, created: false };
    }
  }
  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue(GREET_YEAR_HEADER_NAME);
  return { idx: newCol - 1, created: true };
}

// loc.allValues から LAST_BIRTHDAY_GREET_YEAR 文字列（西暦4桁 or ''）を抽出する。
// 列がなければ '' を返す。Date 化されていた場合は getFullYear() で救済（BIRTHDAY と同じ防御）。
function _readGreetYearFromLoc(loc) {
  if (!loc) return '';
  const gIdx = _findGreetYearColIdx(loc.allValues);
  if (gIdx < 0) return '';
  const v = loc.rowValues[gIdx];
  if (v == null || v === '') return '';
  if (v instanceof Date) {
    // 万一 Sheets が日付として解釈したら、年だけ救済（'2026-01-01' → 2026 など）
    return String(v.getFullYear());
  }
  // 数値・文字列両対応（'2026' / 2026 のいずれも 4 桁文字列に正規化）
  const s = String(v).trim();
  // 末尾 '.0' などの数値表現が混ざってもよいよう、頭から数字を取る
  const m = s.match(/^\d{4}/);
  return m ? m[0] : s;
}

// 誕生日サプライズ画面を「今、表示すべきか」を判定。
// params: { studentId }
// 戻り値:
//   { ok: true, shouldShow: false }                      … 表示不要
//   { ok: true, shouldShow: true, message, nickname }    … 表示すべき（message は差し込み済み）
//   { ok: false, message }                                … エラー
function checkBirthdayGreet(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };

    const loc = _findAccountRowOnSheet(sid);
    if (!loc) return { ok: true, shouldShow: false };

    const birthday = _readBirthdayFromLoc(loc);  // 'MM-DD' or ''
    if (!birthday) return { ok: true, shouldShow: false };

    const today = _sangoToday();  // 'yyyy-MM-dd'（教育日基準）
    if (!today || today.length < 10) return { ok: true, shouldShow: false };

    const todayMMDD = today.substring(5);  // 'MM-dd'
    if (todayMMDD !== birthday) return { ok: true, shouldShow: false };

    const year = today.substring(0, 4);  // 西暦 4 桁
    const lastYear = _readGreetYearFromLoc(loc);
    if (lastYear === year) return { ok: true, shouldShow: false };  // 今年は表示済み

    // 表示すべき → メッセージを取得して nickname 差し込みまで実施
    const nickname = String(loc.rowValues[COL_NICKNAME] || '').trim();
    const streak   = Number(loc.rowValues[COL_STREAK]) || 0;
    const title    = _getTitle(streak);
    const preset = _pickBirthdaySurpriseMessage(sid, year);
    const message = _fortuneApplyVariables(preset.message, {
      nickname: nickname,
      title:    title,
      streak:   streak
    });

    return {
      ok: true,
      shouldShow: true,
      message:  message,
      nickname: nickname
    };
  } catch (err) {
    console.error('[checkBirthdayGreet]', err);
    return { ok: false, message: String(err) };
  }
}

// 誕生日サプライズ画面で「ありがとう、マイカツ君！」ボタン押下時に呼ぶ。
// Students / SpecialAccounts シートの LAST_BIRTHDAY_GREET_YEAR 列に今年の西暦を書き込む。
// 戻り値: { ok: true, year } / { ok: false, message }
function markBirthdayGreetShown(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };

    const loc = _findAccountRowOnSheet(sid);
    if (!loc) return { ok: false, message: '生徒IDが見つかりません' };

    const today = _sangoToday();
    if (!today || today.length < 4) return { ok: false, message: '日付の取得に失敗しました' };
    const year = today.substring(0, 4);

    // 列を保証（なければ追加）
    const ensure = _ensureGreetYearColOnSheet(loc.sheet);
    const colIdx = ensure.idx;

    // ★ 重要：BIRTHDAY 列と同様に setNumberFormat('@') で text 固定してから書く。
    //   '2026' のような数値文字列を Sheets が「数値」として保存することがあり、
    //   _readGreetYearFromLoc 側で正規化はしているが、書き込み時に text 固定する
    //   方が読み戻しの揺れが少なく安全。
    const cell = loc.sheet.getRange(loc.rowIdx + 1, colIdx + 1);
    cell.setNumberFormat('@');
    cell.setValue(year);

    // キャッシュ整合性：列を追加した場合 / 値を書き換えた場合は対応シートの
    // キャッシュを invalidate（次回 read で fresh）。saveBirthday と同パターン。
    try {
      const cache = CacheService.getScriptCache();
      if (loc.sheetName === SHEET_STUDENTS) {
        cache.remove('cache_students_values');
        _cacheLog('cache_students_values', 'invalidate', 'markBirthdayGreetShown sid=' + sid);
      } else {
        cache.remove('cache_special_accounts_values');
        _cacheLog('cache_special_accounts_values', 'invalidate', 'markBirthdayGreetShown sid=' + sid);
      }
    } catch(_) {}

    return { ok: true, year: year };
  } catch (err) {
    console.error('[markBirthdayGreetShown]', err);
    return { ok: false, message: String(err) };
  }
}

// ========================================================================
// アバター機能 Phase α（2026-05-15 新規）
// ------------------------------------------------------------------------
// 仕様：
//   - Students / SpecialAccounts シートに 3 列を新設：
//       AVATAR_BASE      : 'boy' / 'girl' / 'neutral' / ''（未選択）
//       AVATAR_ITEMS     : 所持着せ替えアイテム ID 配列の JSON 文字列（Phase β 用、現状 '[]'）
//       AVATAR_EQUIPPED  : 現在装着中のアイテム ID マップの JSON 文字列（Phase β 用、現状 '{}'）
//   - Phase α は「ベース 1 枚を選んで所持する」だけのスコープ。
//     items / equipped はスキーマだけ用意して空で持っておき、Phase β で初めて書き込み。
//
// 実装方針（BIRTHDAY 列追加と完全同パターン）：
//   - 列名をヘッダーから動的に解決（固定インデックス不使用）。SpecialAccounts シートとの
//     位置乖離を吸収。
//   - 列がなければ saveAvatarBase 内で末尾に追加（schema migration）。
//   - 書き込み時：setNumberFormat('@') で text 固定してから setValue
//     （Sheets ロケールの自動変換から保護。BIRTHDAY 列追加時の事例と同根対策）。
//   - 読み込み時：JSON.parse 失敗時は空配列 / 空オブジェクトに戻す（防御的）。
//   - キャッシュ整合性：書き込み時は対応シートの cache を invalidate。
// ========================================================================

const AVATAR_BASE_HEADER_NAME     = 'AVATAR_BASE';
const AVATAR_ITEMS_HEADER_NAME    = 'AVATAR_ITEMS';
const AVATAR_EQUIPPED_HEADER_NAME = 'AVATAR_EQUIPPED';

// 許容するベース値（クライアントから来る値はこの 3 つに限定）
const AVATAR_BASE_ALLOWED = ['boy', 'girl', 'neutral'];

// --- 列インデックス検出ヘルパー（_findBirthdayColIdx と同パターン） ---
// allValues を信頼してヘッダー検索する高速版。allValues が truncated だったり
// 列が更新後にまだ反映されていない場合は -1 を返すため、呼び出し側で
// _findAvatarBaseColIdxOnSheet にフォールバックする実装を必ず併用すること。
function _findAvatarBaseColIdx(allValues) {
  if (!allValues || !allValues.length || !allValues[0] || !allValues[0].length) return -1;
  const header = allValues[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === AVATAR_BASE_HEADER_NAME) return i;
  }
  return -1;
}
function _findAvatarItemsColIdx(allValues) {
  if (!allValues || !allValues.length || !allValues[0] || !allValues[0].length) return -1;
  const header = allValues[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === AVATAR_ITEMS_HEADER_NAME) return i;
  }
  return -1;
}
function _findAvatarEquippedColIdx(allValues) {
  if (!allValues || !allValues.length || !allValues[0] || !allValues[0].length) return -1;
  const header = allValues[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === AVATAR_EQUIPPED_HEADER_NAME) return i;
  }
  return -1;
}

// --- シート直接読みの読み取り専用ヘルパー（防御的フォールバック用） ---
// _ensureAvatar*ColOnSheet は「無ければ作成」する副作用があるため、READ 経路で
// 使うわけにいかない。これらは「無ければ -1」を返す read-only 版。
// loc.allValues 経由の検索で見つからなかった時のフォールバックとして使う。
// getDataRange().getValues() の戻り値が、ロケール / 空セル絡みで予期せず
// truncated になっているケースを救済する。
function _findAvatarBaseColIdxOnSheet(sheet) {
  if (!sheet) return -1;
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === AVATAR_BASE_HEADER_NAME) return i;
  }
  return -1;
}
function _findAvatarItemsColIdxOnSheet(sheet) {
  if (!sheet) return -1;
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === AVATAR_ITEMS_HEADER_NAME) return i;
  }
  return -1;
}
function _findAvatarEquippedColIdxOnSheet(sheet) {
  if (!sheet) return -1;
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === AVATAR_EQUIPPED_HEADER_NAME) return i;
  }
  return -1;
}

// --- 列保証ヘルパー（_ensureBirthdayColOnSheet と同パターン） ---
// それぞれ 0-based index と created フラグを返す。
function _ensureAvatarBaseColOnSheet(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === AVATAR_BASE_HEADER_NAME) {
      return { idx: i, created: false };
    }
  }
  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue(AVATAR_BASE_HEADER_NAME);
  return { idx: newCol - 1, created: true };
}
function _ensureAvatarItemsColOnSheet(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === AVATAR_ITEMS_HEADER_NAME) {
      return { idx: i, created: false };
    }
  }
  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue(AVATAR_ITEMS_HEADER_NAME);
  return { idx: newCol - 1, created: true };
}
function _ensureAvatarEquippedColOnSheet(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() === AVATAR_EQUIPPED_HEADER_NAME) {
      return { idx: i, created: false };
    }
  }
  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue(AVATAR_EQUIPPED_HEADER_NAME);
  return { idx: newCol - 1, created: true };
}

// loc.allValues から AVATAR_BASE 値を抽出。許容外の値は '' に正規化（防御的）。
//
// 二段階フォールバック（2026-05-15 バグ修正）：
//   1) loc.allValues（_findAccountRowOnSheet が getDataRange().getValues() で
//      取得した値）でヘッダー検索 + rowValues[idx] で値読み
//   2) ↑で見つからなかった時、loc.sheet を直接シート読みしてヘッダー検索 +
//      個別セル読み（getRange(rowIdx+1, idx+1).getValue()）でフォールバック
//
// なぜフォールバックが必要か：
//   - getDataRange().getValues() が空セル絡みで、ヘッダー行に空セルがあると
//     その列を含めなかったり、行の長さが不揃いになるエッジケースを観測。
//   - シートに途中で空ヘッダー列（生徒シートの K, L）があり、後ろに AVATAR_*
//     列が並ぶレイアウトでこの問題が出やすい。
//   - 直接シート読みは fresh で確実だが遅いため、フォールバック扱いに留めて
//     primary 経路は高速版を維持する。
function _readAvatarBaseFromLoc(loc) {
  if (!loc) return '';

  // 1) Primary: loc.allValues 経由のヘッダー検索
  let idx = _findAvatarBaseColIdx(loc.allValues);

  // 2) Fallback: シートから直接ヘッダー再検索
  if (idx < 0 && loc.sheet) {
    idx = _findAvatarBaseColIdxOnSheet(loc.sheet);
    if (idx >= 0) {
      console.warn('[_readAvatarBaseFromLoc] header not found in loc.allValues, fallback to sheet read',
                   'sheetName=' + (loc.sheetName || ''), 'idx=' + idx);
    }
  }
  if (idx < 0) return '';

  // 3) Try rowValues first
  let v;
  if (loc.rowValues && idx < loc.rowValues.length) {
    v = loc.rowValues[idx];
  }

  // 4) Fallback: rowValues が truncated だった / undefined 等の場合は個別セル読み
  if ((v == null || v === '') && loc.sheet && typeof loc.rowIdx === 'number' && loc.rowIdx >= 0) {
    try {
      const cellVal = loc.sheet.getRange(loc.rowIdx + 1, idx + 1).getValue();
      if (cellVal != null && cellVal !== '') {
        v = cellVal;
        console.warn('[_readAvatarBaseFromLoc] rowValues empty, fallback to direct cell read',
                     'sheetName=' + (loc.sheetName || ''), 'rowIdx=' + loc.rowIdx, 'colIdx=' + idx,
                     'value=' + JSON.stringify(cellVal));
      }
    } catch (e) {
      console.error('[_readAvatarBaseFromLoc] direct cell read failed', e);
    }
  }

  if (v == null || v === '') return '';
  const s = String(v).trim();
  return (AVATAR_BASE_ALLOWED.indexOf(s) >= 0) ? s : '';
}

// loc.allValues から AVATAR_ITEMS（JSON 配列文字列）を抽出。
// パース失敗 / 配列でない場合は空配列を返す（Phase β で安全に拡張できるよう防御）。
// AVATAR_BASE と同じ二段階フォールバックを適用。
function _readAvatarItemsFromLoc(loc) {
  if (!loc) return [];

  // 1) Primary
  let idx = _findAvatarItemsColIdx(loc.allValues);
  // 2) Fallback: シートから直接ヘッダー再検索
  if (idx < 0 && loc.sheet) {
    idx = _findAvatarItemsColIdxOnSheet(loc.sheet);
  }
  if (idx < 0) return [];

  // 3) Try rowValues first
  let v;
  if (loc.rowValues && idx < loc.rowValues.length) {
    v = loc.rowValues[idx];
  }
  // 4) Fallback: 個別セル読み
  if ((v == null || v === '') && loc.sheet && typeof loc.rowIdx === 'number' && loc.rowIdx >= 0) {
    try {
      const cellVal = loc.sheet.getRange(loc.rowIdx + 1, idx + 1).getValue();
      if (cellVal != null && cellVal !== '') v = cellVal;
    } catch (e) {
      // 黙って空配列にフォールバック
    }
  }

  if (v == null || v === '') return [];
  try {
    const parsed = JSON.parse(String(v));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// loc.allValues から AVATAR_EQUIPPED（JSON オブジェクト文字列）を抽出。
// パース失敗 / オブジェクトでない場合は空オブジェクトを返す。
// AVATAR_BASE と同じ二段階フォールバックを適用。
function _readAvatarEquippedFromLoc(loc) {
  if (!loc) return {};

  // 1) Primary
  let idx = _findAvatarEquippedColIdx(loc.allValues);
  // 2) Fallback: シートから直接ヘッダー再検索
  if (idx < 0 && loc.sheet) {
    idx = _findAvatarEquippedColIdxOnSheet(loc.sheet);
  }
  if (idx < 0) return {};

  // 3) Try rowValues first
  let v;
  if (loc.rowValues && idx < loc.rowValues.length) {
    v = loc.rowValues[idx];
  }
  // 4) Fallback: 個別セル読み
  if ((v == null || v === '') && loc.sheet && typeof loc.rowIdx === 'number' && loc.rowIdx >= 0) {
    try {
      const cellVal = loc.sheet.getRange(loc.rowIdx + 1, idx + 1).getValue();
      if (cellVal != null && cellVal !== '') v = cellVal;
    } catch (e) {
      // 黙って空オブジェクトにフォールバック
    }
  }

  if (v == null || v === '') return {};
  try {
    const parsed = JSON.parse(String(v));
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (e) {
    return {};
  }
}

// --- 公開 API ---

// 単一シートから sid に対応する行を「フレッシュ読み」で探し、AVATAR 列の値を
// 取り出すヘルパー（getAvatarState 用の独立実装）。
//
// 設計方針（2026-05-15 二度目のバグ修正）：
//   - 既存の _findAccountRowOnSheet / _readAvatarBaseFromLoc は loc を経由する。
//     一度目の修正でフォールバック層を増やしたが、それでもダメだったため、
//     さらにシンプルな実装に変えて「Students と SpecialAccounts を別々に」
//     試す。
//   - sid 比較を更に防御的に（前後の不可視文字も除去、数値/文字列両方を比較）。
//   - 列ヘッダー検索もスペース除去・正規化を強化。
//   - 1 つのシートで AVATAR_BASE が見つからなくても、もう一方のシートを試す
//     （Students 優先だが、片方にしか書かれていないケースを救済）。
//   - レスポンスに `_debug` を含めてフロントの DevTools から確認可能にする。
function _avatarReadFromSheetBySid(sheet, sid) {
  const out = {
    found:        false,
    rowIdx:       -1,
    base:         '',
    items:        [],
    equipped:     {},
    nickname:     '',
    baseColIdx:   -1,
    itemsColIdx:  -1,
    equipColIdx:  -1,
    baseRaw:      null,
    itemsRaw:     null,
    equipRaw:     null,
    error:        null
  };
  if (!sheet) return out;
  try {
    if (sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return out;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const allValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const header = allValues[0] || [];

    // === 列ヘッダー検索（強化版：trim + 不可視文字除去 + case 不変） ===
    function _normHeader(v) {
      // 不可視/ゼロ幅文字も含めて削ぎ落とす
      return String(v == null ? '' : v).replace(/[\s​‌‍﻿ ]+/g, '').toUpperCase();
    }
    const TARGET_BASE  = _normHeader(AVATAR_BASE_HEADER_NAME);
    const TARGET_ITEMS = _normHeader(AVATAR_ITEMS_HEADER_NAME);
    const TARGET_EQUIP = _normHeader(AVATAR_EQUIPPED_HEADER_NAME);
    for (let c = 0; c < header.length; c++) {
      const h = _normHeader(header[c]);
      if (h && out.baseColIdx  < 0 && h === TARGET_BASE)  out.baseColIdx  = c;
      if (h && out.itemsColIdx < 0 && h === TARGET_ITEMS) out.itemsColIdx = c;
      if (h && out.equipColIdx < 0 && h === TARGET_EQUIP) out.equipColIdx = c;
    }

    // === sid に対応する行を線形探索（数値/文字列両対応 + 不可視除去） ===
    function _normSid(v) {
      return String(v == null ? '' : v).replace(/[\s​‌‍﻿ ]+/g, '');
    }
    const target = _normSid(sid);
    let rowIdx = -1;
    for (let r = 1; r < allValues.length; r++) {
      if (_normSid(allValues[r][COL_ID]) === target) { rowIdx = r; break; }
    }
    if (rowIdx < 0) return out;

    out.found  = true;
    out.rowIdx = rowIdx;
    out.nickname = String(allValues[rowIdx][COL_NICKNAME] || '').trim();

    // === AVATAR_BASE 値読み（rowValues 経由 → 失敗なら個別セル読み） ===
    if (out.baseColIdx >= 0) {
      const rv = allValues[rowIdx];
      let v = (out.baseColIdx < rv.length) ? rv[out.baseColIdx] : null;
      // rowValues が truncated の場合は個別セル読みで救済
      if ((v == null || v === '') && rowIdx >= 0) {
        try { v = sheet.getRange(rowIdx + 1, out.baseColIdx + 1).getValue(); } catch(_) {}
      }
      out.baseRaw = v;
      if (v != null && v !== '') {
        const s = String(v).trim();
        if (AVATAR_BASE_ALLOWED.indexOf(s) >= 0) out.base = s;
      }
    }

    // === AVATAR_ITEMS 値読み ===
    if (out.itemsColIdx >= 0) {
      const rv = allValues[rowIdx];
      let v = (out.itemsColIdx < rv.length) ? rv[out.itemsColIdx] : null;
      if ((v == null || v === '') && rowIdx >= 0) {
        try { v = sheet.getRange(rowIdx + 1, out.itemsColIdx + 1).getValue(); } catch(_) {}
      }
      out.itemsRaw = v;
      if (v != null && v !== '') {
        try {
          const parsed = JSON.parse(String(v));
          if (Array.isArray(parsed)) out.items = parsed;
        } catch(_) {}
      }
    }

    // === AVATAR_EQUIPPED 値読み ===
    if (out.equipColIdx >= 0) {
      const rv = allValues[rowIdx];
      let v = (out.equipColIdx < rv.length) ? rv[out.equipColIdx] : null;
      if ((v == null || v === '') && rowIdx >= 0) {
        try { v = sheet.getRange(rowIdx + 1, out.equipColIdx + 1).getValue(); } catch(_) {}
      }
      out.equipRaw = v;
      if (v != null && v !== '') {
        try {
          const parsed = JSON.parse(String(v));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) out.equipped = parsed;
        } catch(_) {}
      }
    }
  } catch (e) {
    out.error = String(e);
  }
  return out;
}

// アバター状態を取得（ホーム / アバターコーナーから呼ぶ）。
// params: { studentId }
// return: { ok, base, items, equipped, nickname, _debug } or { ok:false, message }
//
// 2026-05-15 二度目のバグ修正：Students 優先で見つかってもベース未設定なら
//   SpecialAccounts も試す独立読み出し方式に変更。`_findAccountRowOnSheet` を
//   経由せず、`_avatarReadFromSheetBySid` で各シートを直接走査する。
//   レスポンスの `_debug` フィールドにシートごとの検索結果が入るため、ふくち
//   さんの DevTools（F12 → Console → ネットワークタブで getAvatarState の
//   応答 JSON を確認）で内部状態が把握できる。
function getAvatarState(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };

    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    const spSheet  = ss.getSheetByName(SHEET_SPECIAL_ACCOUNTS);

    const stuRes = _avatarReadFromSheetBySid(stuSheet, sid);
    const spRes  = _avatarReadFromSheetBySid(spSheet,  sid);

    // 値の採用ルール：
    //   1) Students 側に行が見つかり、AVATAR_BASE が非空 → Students 採用
    //   2) Students 側に行が見つかったが AVATAR_BASE が空、かつ SpecialAccounts
    //      側に行 + 非空の base がある → SpecialAccounts 採用
    //   3) Students 側に行がない、かつ SpecialAccounts 側に行 → SpecialAccounts 採用
    //   4) どちらにもない → 空状態を返す
    let chosen = null;
    let chosenSheetName = '';
    if (stuRes.found && stuRes.base) {
      chosen = stuRes; chosenSheetName = SHEET_STUDENTS;
    } else if (stuRes.found && !stuRes.base && spRes.found && spRes.base) {
      chosen = spRes;  chosenSheetName = SHEET_SPECIAL_ACCOUNTS;
    } else if (stuRes.found) {
      chosen = stuRes; chosenSheetName = SHEET_STUDENTS;
    } else if (spRes.found) {
      chosen = spRes;  chosenSheetName = SHEET_SPECIAL_ACCOUNTS;
    }

    if (!chosen) {
      console.warn('[getAvatarState] account row not found in either sheet', 'sid=' + sid);
      return {
        ok: true, base: '', items: [], equipped: {}, nickname: '',
        _debug: { sid: sid, students: _avatarDbgSummary(stuRes), special: _avatarDbgSummary(spRes) }
      };
    }

    const result = {
      ok:       true,
      base:     chosen.base || '',
      items:    Array.isArray(chosen.items) ? chosen.items : [],
      equipped: (chosen.equipped && typeof chosen.equipped === 'object') ? chosen.equipped : {},
      nickname: chosen.nickname || '',
      _debug: {
        sid:          sid,
        chosen:       chosenSheetName,
        students:     _avatarDbgSummary(stuRes),
        special:      _avatarDbgSummary(spRes)
      }
    };

    if (!result.base) {
      console.warn('[getAvatarState] returning empty base after both-sheet check',
        'sid=' + sid,
        'chosen=' + chosenSheetName,
        'stu.found=' + stuRes.found,
        'stu.baseColIdx=' + stuRes.baseColIdx,
        'stu.baseRaw=' + JSON.stringify(stuRes.baseRaw),
        'sp.found=' + spRes.found,
        'sp.baseColIdx=' + spRes.baseColIdx,
        'sp.baseRaw=' + JSON.stringify(spRes.baseRaw)
      );
    }
    return result;
  } catch (err) {
    console.error('[getAvatarState]', err);
    return { ok: false, message: String(err) };
  }
}

// _debug 用のサマリ生成（応答 JSON サイズを抑えるため不要なフィールドは省く）。
function _avatarDbgSummary(r) {
  if (!r) return { found: false };
  return {
    found:       r.found,
    rowIdx:      r.rowIdx,
    baseColIdx:  r.baseColIdx,
    itemsColIdx: r.itemsColIdx,
    equipColIdx: r.equipColIdx,
    baseRaw:     r.baseRaw,
    error:       r.error
  };
}

// アバターベースを保存（アバター選択画面の「決定」押下時）。
// params: { studentId, base }
// return: { ok, base, _debug } or { ok:false, message }
//
// 2026-05-15 二度目のバグ修正：生徒が Students と SpecialAccounts の両方に
//   存在する場合、どちらに書くかが getAvatarState の読み出し先と乖離する
//   リスクを排除するため、両方に書き込む方式に変更。
//   どちらの読み出し経路でも同じ値が見つかるため、bug が再発しない。
function saveAvatarBase(params) {
  try {
    const sid  = String((params && params.studentId) || '').trim();
    const base = String((params && params.base) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    if (AVATAR_BASE_ALLOWED.indexOf(base) < 0) {
      return { ok: false, message: 'アバターの種類が正しくありません' };
    }

    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    const spSheet  = ss.getSheetByName(SHEET_SPECIAL_ACCOUNTS);

    // 両シートで sid に対応する行を探し、見つかったシート「すべて」に書き込む。
    // 1004 が Students にも SpecialAccounts にも存在する場合、両方に同じ値を
    // 書くことで、読み出し時のどちらが先に hit しても同じ値が返る。
    const stuRes = _avatarReadFromSheetBySid(stuSheet, sid);
    const spRes  = _avatarReadFromSheetBySid(spSheet,  sid);

    const writeTargets = [];
    if (stuRes.found) writeTargets.push({ sheet: stuSheet, rowIdx: stuRes.rowIdx, sheetName: SHEET_STUDENTS });
    if (spRes.found)  writeTargets.push({ sheet: spSheet,  rowIdx: spRes.rowIdx,  sheetName: SHEET_SPECIAL_ACCOUNTS });

    if (writeTargets.length === 0) {
      return { ok: false, message: '生徒IDが見つかりません' };
    }

    const debugWrites = [];
    for (let t = 0; t < writeTargets.length; t++) {
      const tgt = writeTargets[t];
      // 3 列を保証（無ければ末尾に追加）。
      const ensureBase     = _ensureAvatarBaseColOnSheet(tgt.sheet);
      const ensureItems    = _ensureAvatarItemsColOnSheet(tgt.sheet);
      const ensureEquipped = _ensureAvatarEquippedColOnSheet(tgt.sheet);

      // ★ setNumberFormat('@') で text 固定してから setValue
      //   （BIRTHDAY 列追加時に Date 化された事例の同根対策。Phase β で
      //    items='["hat_01"]' のような文字列を書く時にも効く）。
      const cellBase = tgt.sheet.getRange(tgt.rowIdx + 1, ensureBase.idx + 1);
      cellBase.setNumberFormat('@');
      cellBase.setValue(base);

      debugWrites.push({
        sheetName: tgt.sheetName,
        rowIdx:    tgt.rowIdx,
        baseColIdx: ensureBase.idx,
        baseColCreated: ensureBase.created
      });

      // キャッシュ整合性：列を追加した場合は配列長が変わるため必ず invalidate。
      try {
        const cache = CacheService.getScriptCache();
        if (tgt.sheetName === SHEET_STUDENTS) {
          cache.remove('cache_students_values');
          _cacheLog('cache_students_values', 'invalidate', 'saveAvatarBase sid=' + sid);
        } else {
          cache.remove('cache_special_accounts_values');
          _cacheLog('cache_special_accounts_values', 'invalidate', 'saveAvatarBase sid=' + sid);
        }
      } catch(_) {}
    }

    return { ok: true, base: base, _debug: { sid: sid, writes: debugWrites } };
  } catch (err) {
    console.error('[saveAvatarBase]', err);
    return { ok: false, message: String(err) };
  }
}

function getTodayFortune(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };

    // 生徒情報取得（Students / SpecialAccounts 統合読み込み）
    const loc = _findAccountRowOnSheet(sid);
    let nickname = '';
    let streak   = 0;
    let birthday = '';
    if (loc) {
      nickname = String(loc.rowValues[COL_NICKNAME] || '').trim();
      streak   = Number(loc.rowValues[COL_STREAK]) || 0;
      birthday = _readBirthdayFromLoc(loc);  // 'MM-DD' or ''
    }
    const title = _getTitle(streak);

    // 決定論的シード：sid + 教育日（JST 3 時切り替え、yyyy-MM-dd）
    // _sangoToday() は他コンテンツ（コブタン/カンジー/リスオン/三語短文）と同じ切替基準。
    // 0:00〜2:59 は「前日」の運勢、3:00〜23:59 は「当日」の運勢を返す。
    const today = _sangoToday();
    const seed  = sid + '_' + today;
    const baseHash = _fortuneHash(seed);

    // 骨格選択：2 段階決定論
    //   1) 別シード（_stars 付与）で stars レベル（5/4/3/2/1）を重み配分で選ぶ
    //   2) 該当 stars のプールから 1 つ選ぶ
    const stars  = _fortunePickStars(_fortuneHash(seed + '_stars'));
    const preset = _fortunePickPreset(stars, _fortuneHash(seed + '_pick'));

    // 差し込み（nickname/title/streak）
    const vars = { nickname: nickname, title: title, streak: streak };
    const general = _fortuneApplyVariables(preset.general, vars);
    const study   = _fortuneApplyVariables(preset.study,   vars);

    // ラッキー要素：別シードでバラけさせる
    const luckyColor  = FORTUNE_LUCKY_COLORS [_fortuneHash(seed + '_color')  % FORTUNE_LUCKY_COLORS.length];
    const luckyNumber = FORTUNE_LUCKY_NUMBERS[_fortuneHash(seed + '_number') % FORTUNE_LUCKY_NUMBERS.length];
    const luckyFood   = FORTUNE_LUCKY_FOODS  [_fortuneHash(seed + '_food')   % FORTUNE_LUCKY_FOODS.length];

    // 星座運（誕生日が登録されている場合のみ）
    // 段階B：本骨格 60 個（12 星座 × 5 stars）から zodiac × stars で 1 個選択。
    // 各組み合わせは現状 1 個ずつなのでシードによる選択は形式的だが、将来同じ
    // 組み合わせを複数追加すれば _zodiacPickPreset が自動で hash 選択する設計。
    let zodiacBlock = null;
    if (birthday) {
      const z = _getZodiac(birthday);
      if (z) {
        const zPreset = _zodiacPickPreset(z.zodiac, stars, _fortuneHash(seed + '_zodiac'));
        const zMsg = _fortuneApplyVariables(zPreset.message, vars);
        zodiacBlock = {
          symbol:   z.symbol,
          jp:       z.zodiac_jp,
          zodiac:   z.zodiac,
          period:   z.period,
          message:  zMsg
        };
      }
    }

    // 誕生日サプライズ（生徒の誕生日 MM-DD と 今日（_sangoToday の MM-DD 部分）が一致したら表示）
    // 段階B：本骨格 10 個から studentId + year シードで 1 個を決定論的に選択。
    //   - 同じ年内は何度開いても同じメッセージ（誕生日に複数回見ても同一）
    //   - 翌年は別メッセージが当たる可能性が高い（連年体験を新鮮に保つ）
    // 段階C で別途「ログイン直後のサプライズ画面」を実装予定。
    let birthdaySurprise = null;
    if (birthday && today && today.length >= 10) {
      const todayMMDD = today.substring(5); // 'yyyy-MM-dd' → 'MM-dd'
      if (todayMMDD === birthday) {
        // year は _sangoToday() の yyyy-MM-dd の先頭 4 文字を採用（教育日基準で
        // 0:00〜2:59 が前日扱いの場合は前日の年）。1/1 跨ぎでも矛盾しない。
        const year = today.substring(0, 4);
        const bPreset = _pickBirthdaySurpriseMessage(sid, year);
        birthdaySurprise = {
          id:      bPreset.id,
          message: _fortuneApplyVariables(bPreset.message, vars)
        };
      }
    }

    return {
      ok: true,
      fortune: {
        stars:   preset.stars,
        general: general,
        study:   study,
        lucky: {
          color:  luckyColor,
          number: luckyNumber,
          food:   luckyFood
        },
        zodiac:           zodiacBlock,        // 未入力 / 判定失敗時は null（フロントで非表示）
        birthday_surprise: birthdaySurprise   // 誕生日マッチ時のみ object、それ以外は null
      },
      meta: {
        nickname:     nickname,
        title:        title,
        streak:       streak,
        has_birthday: !!birthday,            // フロントで「登録する/変更する」ボタン文言切替に使う
        birthday:     birthday                // 入力済み MM-DD（未入力なら ''）。フロント側で
                                              // 入力画面のデフォルト値設定に使う。
      }
    };
  } catch (err) {
    console.error('[getTodayFortune]', err);
    return { ok: false, message: String(err) };
  }
}

function getKobunHistory(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが必要です' };
    const sh = _ss().getSheetByName(SHEET_HPLOG);
    if (!sh || sh.getLastRow() < 2) return { ok: true, history: [] };
    const rows = _readLastNRows(sh, 2000);
    // HPLog 列: [0]timestamp [1]studentId [2]rawHP [3]hpGained [4]type [5]message
    const history = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (String(r[1] || '').trim() !== sid) continue;
      const type = String(r[4] || '').trim();
      if (type.indexOf('kobun_') !== 0) continue;
      const m = /^kobun_(\d+)_(\d+)(_practice)?$/.exec(type);
      if (!m) continue;
      let ts;
      try { ts = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'); }
      catch (e) { ts = String(r[0] || ''); }
      history.push({
        timestamp:  ts,
        date:       ts.slice(0, 10),
        round:      m[1],
        count:      parseInt(m[2], 10),
        hpGained:   Number(r[3]) || 0,
        rawHP:      Number(r[2]) || 0,
        isPractice: !!m[3]
      });
    }
    history.sort(function(a, b){
      return a.timestamp < b.timestamp ? 1 : (a.timestamp > b.timestamp ? -1 : 0);
    });
    return { ok: true, history: history };
  } catch (err) {
    console.error('[getKobunHistory]', err);
    return { ok: false, message: String(err) };
  }
}
