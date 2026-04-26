/**
 * マイ活アプリ - Code.gs
 * 更新：2026-04-17
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
      'cache_students_values'
    ];
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
      else if (action === 'adminAddQuote')     result = adminAddQuote(params);
      else if (action === 'adminAddNotice')    result = adminAddNotice(params);
      else if (action === 'adminListStudents') result = adminListStudents(params);
      else if (action === 'getStudentView') result = getStudentView(params);  
      else if (action === 'getSangoTopic')             result = getSangoTopic();
      else if (action === 'submitSango')               result = submitSango(params);
      else if (action === 'adminAddSangoTopic')        result = adminAddSangoTopic(params);
      else if (action === 'adminAddSangoTopicsWeek')   result = adminAddSangoTopicsWeek(params);
      else if (action === 'adminListSangoSubmissions') result = adminListSangoSubmissions(params);
      else if (action === 'adminSetSangoTeacherWork')   result = adminSetSangoTeacherWork(params);
      else if (action === 'adminSetSangoComment')      result = adminSetSangoComment(params);
      else if (action === 'getSangoSubmissions') result = getSangoSubmissions(params);
      else if (action === 'getSangoPastTopicsRecent')   result = getSangoPastTopicsRecent();
      else if (action === 'getSangoPastTopicsPaged')    result = getSangoPastTopicsPaged(params);
      else if (action === 'getChildActivityRecent')    result = getChildActivityRecent(params);
      else if (action === 'getWabun1Topic')             result = getWabun1Topic(params);
      else if (action === 'submitWabun1')               result = submitWabun1(params);
      else if (action === 'getWabun1Submissions')       result = getWabun1Submissions(params);
      else if (action === 'getWabun1AnswersAfterSubmit') result = getWabun1AnswersAfterSubmit(params);
      else if (action === 'getWabun1PastTopicsRecent')   result = getWabun1PastTopicsRecent(params);
      else if (action === 'getWabun1PastTopicsPaged')    result = getWabun1PastTopicsPaged(params);
      else if (action === 'adminAddWabun1TopicsWeek')   result = adminAddWabun1TopicsWeek(params);
      else if (action === 'adminSetWabun1AnswerWeek')   result = adminSetWabun1AnswerWeek(params);
      else if (action === 'adminListWabun1Submissions') result = adminListWabun1Submissions(params);
      else if (action === 'adminSetWabun1Comment')      result = adminSetWabun1Comment(params);
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
    // G1: Students キャッシュから読む（cold miss 時のみ全件読み）
    const rows = _getStudentsValues();
    if (!rows || rows.length < 2) return { ok: false, message: 'Studentsシートが見つかりません。' };
    const today = _todayJST();
    const now   = _nowJST();

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][COL_ID]).trim() !== String(studentId).trim()) continue;

      const nickname     = String(rows[i][COL_NICKNAME] || '').trim();
      const isFirstLogin = (nickname === '');
      let   currentHP    = Number(rows[i][COL_HP])     || 0;
      let   streak       = Number(rows[i][COL_STREAK]) || 0;
      const lastLogin    = _toDateStr(rows[i][COL_LAST_LOGIN]);

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

        // 4/26 修正: 連続日数バグ対策で LAST_TEST 列を含む 5 列 setValues を廃止
        //   旧: setValues E-I（UPDATED, HP, STREAK, LAST_TEST=preserved, LAST_LOGIN）
        //       → preservedLastTest が cache 経由（stale な ISO 文字列の可能性）でリスク
        //   新: setValues E-G（UPDATED, HP, STREAK）+ setValue I（LAST_LOGIN）
        //       LAST_TEST には触らない（saveAttempt が必要に応じて自分で書く）
        const sheet = _ss().getSheetByName(SHEET_STUDENTS);
        sheet.getRange(i + 1, COL_UPDATED + 1, 1, COL_STREAK - COL_UPDATED + 1)
             .setValues([[now, currentHP, streak]]);
        sheet.getRange(i + 1, COL_LAST_LOGIN + 1).setValue(today);
        const updates = {};
        updates[COL_UPDATED]    = now;
        updates[COL_HP]         = currentHP;
        updates[COL_STREAK]     = streak;
        updates[COL_LAST_LOGIN] = today;
        _updateStudentsCacheRow(i, updates);
        // 既存コンテンツは素点と倍率後HPが同値のため rawHP = hpGained
        _logHP(studentId, loginBonus, loginBonus, 'login');
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
        studentId:   String(rows[i][COL_ID]).trim(),
        name:        String(rows[i][COL_NAME] || ''),
        nickname,
        isFirstLogin,
        totalHP:     currentHP,
        loginBonus,
        streak,
        stage,
        title,
        milestone: milestoneInfo
      };
    }
    return { ok: false, message: '生徒IDが見つかりません。先生に確認してください。' };
  } catch (err) {
    console.error('[loginStudent]', err);
    return { ok: false, message: '内部エラーが発生しました。' };
  }
}

// =============================================
// キャラクター関連ヘルパー
// =============================================
function _getYesterdayJST() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
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

function _getPrevDayCount(studentId, yesterday) {
  const sh = _ss().getSheetByName(SHEET_ATTEMPTS);
  if (!sh) return 0;
  // 末尾 200 行のみ走査（昨日の件数判定には十分）
  const data = _readLastNRows(sh, 200);
  let count  = 0;
  const sid = String(studentId).trim();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][1]).trim() === sid &&
        _toDateStr(data[i][0])    === yesterday) count++;
  }
  return count;
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
    // G1: キャッシュ経由で読み、書き込み後にキャッシュを in-place 更新
    const rows = _getStudentsValues();
    if (!rows || rows.length < 2) return { ok: false, message: '生徒IDが見つかりません。' };
    const trimmed = nickname.trim();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][COL_ID]).trim() !== String(studentId).trim()) continue;
      const sheet = _ss().getSheetByName(SHEET_STUDENTS);
      sheet.getRange(i + 1, COL_NICKNAME + 1).setValue(trimmed);
      const updates = {};
      updates[COL_NICKNAME] = trimmed;
      _updateStudentsCacheRow(i, updates);
      return { ok: true, nickname: trimmed };
    }
    return { ok: false, message: '生徒IDが見つかりません。' };
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
    const today = _todayJST();
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
    const today  = _todayJST();
    const sid    = String(studentId).trim();
    const lv     = String(level || '4級').trim();
    const sNo    = Number(sessionNo) || 1;

    // G1: Studentsシートをキャッシュ経由で読む
    const sRows = _getStudentsValues();
    let studentRowIdx = -1;
    let studentName   = '';
    for (let i = 1; i < sRows.length; i++) {
      if (String(sRows[i][COL_ID]).trim() === sid) {
        studentRowIdx = i;
        studentName   = String(sRows[i][COL_NAME] || '');
        break;
      }
    }

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
    if (studentRowIdx < 0) return { ok: false };
    const i         = studentRowIdx;
    const currentHP = Number(sRows[i][COL_HP]) || 0;
    const streak    = Number(sRows[i][COL_STREAK]) || 1;  // 最低1
    const week      = Math.ceil(streak / 7);
    const hpGained  = 50 * week * week;
    const newHP     = currentHP + hpGained;

    // 4/26 修正: 連続日数バグ対策で STREAK 列を含む 5 列 setValues を廃止
    //   旧: setValues D-H（CLEARED, UPDATED, HP, STREAK=preservedStreak, LAST_TEST）
    //       → preservedStreak が cache 経由（stale な値の可能性）→ シートの STREAK を破壊するリスク
    //   新: setValues D-F（CLEARED, UPDATED, HP）+ setValue H（LAST_TEST）
    //       STREAK には絶対に触らない（loginStudent のみが書き込む列）
    const currentCleared = Number(sRows[i][COL_CLEARED]) || 0;
    const newCleared = (setNo > currentCleared) ? setNo : currentCleared;
    const sSheet = _ss().getSheetByName(SHEET_STUDENTS);
    sSheet.getRange(i + 1, COL_CLEARED + 1, 1, COL_HP - COL_CLEARED + 1)
          .setValues([[newCleared, now, newHP]]);
    sSheet.getRange(i + 1, COL_LAST_TEST + 1).setValue(today);
    const updates = {};
    updates[COL_CLEARED]   = newCleared;
    updates[COL_UPDATED]   = now;
    updates[COL_HP]        = newHP;
    updates[COL_LAST_TEST] = today;
    _updateStudentsCacheRow(i, updates);
    // 既存コンテンツは素点と倍率後HPが同値のため rawHP = hpGained
    _logHP(sid, hpGained, hpGained, 'test');
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
function _logHP(studentId, rawHP, hpGained, type) {
  try {
    const ss = _ss();
    let sh   = ss.getSheetByName(SHEET_HPLOG);
    if (!sh) {
      sh = ss.insertSheet(SHEET_HPLOG);
      sh.getRange(1, 1, 1, 5).setValues([['timestamp', 'studentId', 'rawHP', 'hpGained', 'type']]);
    }
    sh.appendRow([_nowJST(), String(studentId).trim(), rawHP, hpGained, type]);
  } catch(e) {
    console.error('[_logHP]', e);
  }
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
// 用途: HPLog の type='login' レコードから各生徒の正しい連続日数を再計算し、
//       Students.STREAK を上書きする。
// 引数: opts = { dryRun?: boolean, force?: boolean }
//   - dryRun=true: シートを更新せず、旧→新の対比だけを返す（必ず最初に dryRun で確認）
//   - force=true:  実行済みフラグ無視（このスクリプトでは未使用、apologyStreakBonus と
//                  シグネチャを揃えるため受け入れるだけ）
// 動作:
//   1. Students シートを直接読む（cache 経由禁止）
//   2. HPLog シートを直接読む（cache 経由禁止）
//   3. 各生徒について type='login' のユニーク日付を集めて昇順ソート
//   4. 各日付について「前日との差分が 1 日なら streak += 1、それ以外は streak = 1」
//      （loginStudent の挙動と同じロジック）
//   5. dryRun でなければシートに書き込み、Students キャッシュを invalidate
// 戻り値: { ok, dryRun, totalStudents, updateCount, updates: [...] }
//   - updates[i] = { rowIdx, sid, name, nickname, oldStreak, newStreak, loginDays, lastLoginDate }
function recoverAllStudentsStreak(opts) {
  try {
    opts = opts || {};
    const dryRun = !!opts.dryRun;

    const ss = _ss();
    const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
    const logSheet = ss.getSheetByName(SHEET_HPLOG);
    if (!stuSheet) return { ok: false, message: 'Students シートが見つかりません' };
    if (!logSheet) return { ok: false, message: 'HPLog シートが見つかりません' };

    // cache 経由禁止: 直接読み
    const stuValues = stuSheet.getDataRange().getValues();
    const logValues = logSheet.getDataRange().getValues();

    // HPLog ヘッダーを動的に検出（rawHP 追加前後の両方に対応）
    if (logValues.length < 2) return { ok: false, message: 'HPLog にデータがありません' };
    const logHeader = logValues[0];
    const cTimestamp = logHeader.indexOf('timestamp');
    const cSid       = logHeader.indexOf('studentId');
    const cType      = logHeader.indexOf('type');
    if (cTimestamp < 0 || cSid < 0 || cType < 0) {
      return { ok: false, message: 'HPLog ヘッダーが想定外: ' + JSON.stringify(logHeader) };
    }

    // 生徒ごとの login 日付（ユニーク）を集計
    const datesByStudent = {};
    for (let i = 1; i < logValues.length; i++) {
      const row = logValues[i];
      if (String(row[cType] || '').trim() !== 'login') continue;
      const sid = String(row[cSid] || '').trim();
      if (!sid) continue;
      // _toDateStr の修正前後どちらでも、HPLog 直接読みは Date オブジェクトが返るので
      // 既存の formatDate 経路で正しく JST 日付になる
      const dateStr = _toDateStr(row[cTimestamp]);
      if (!dateStr) continue;
      if (!datesByStudent[sid]) datesByStudent[sid] = {};
      datesByStudent[sid][dateStr] = true;
    }

    // 各生徒について連続日数を再計算
    const updates = [];
    for (let i = 1; i < stuValues.length; i++) {
      const sid = String(stuValues[i][COL_ID] || '').trim();
      if (!sid) continue;
      const oldStreak = Number(stuValues[i][COL_STREAK]) || 0;
      const dateMap = datesByStudent[sid];
      let newStreak = 0;
      let lastLoginDate = '';

      if (dateMap) {
        const sortedDates = Object.keys(dateMap).sort();
        let streak = 0;
        let prev = null;
        for (let j = 0; j < sortedDates.length; j++) {
          const d = sortedDates[j];
          if (prev === null) {
            streak = 1;
          } else {
            const diffMs = new Date(d) - new Date(prev);
            const diffDays = Math.round(diffMs / 86400000);
            if (diffDays === 1) streak += 1;
            else if (diffDays === 0) { /* 同日は維持 */ }
            else streak = 1;
          }
          prev = d;
        }
        newStreak = streak;
        lastLoginDate = prev || '';
      }

      if (oldStreak !== newStreak) {
        updates.push({
          rowIdx: i,
          sid: sid,
          name: String(stuValues[i][COL_NAME] || ''),
          nickname: String(stuValues[i][COL_NICKNAME] || ''),
          oldStreak: oldStreak,
          newStreak: newStreak,
          loginDays: dateMap ? Object.keys(dateMap).length : 0,
          lastLoginDate: lastLoginDate
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

    // 生徒マスタ（G1: キャッシュ経由）
    const stuRows = _getStudentsValues();
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

    const detected = json.responses[0].fullTextAnnotation
      ? json.responses[0].fullTextAnnotation.text.toLowerCase() : '';

    if (!detected) {
      return { ok: true, passed: false, message: '文字が読み取れませんでした。明るい場所でもう一度撮影してください。' };
    }

    const failedWords = [];
    for (const w of words) {
      const word  = w.toLowerCase();
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
    // G1: Students はキャッシュ経由
    const rows = _getStudentsValues();
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

    // G1: Students はキャッシュ経由
    let currentHP = 0;
    const stuRows = _getStudentsValues();
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

function _verifyAdmin(password) {
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  return !!stored && password === stored;
}

function adminLogin(params) {
  if (!_verifyAdmin(params.password)) return { ok: false, message: 'パスワードが違います' };
  return { ok: true };
}

function adminAddQuote(params) {
  try {
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
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
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
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
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
    // G1: Students はキャッシュ経由
    const values = _getStudentsValues();
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

    // G1: Students はキャッシュ経由
    const rows = _getStudentsValues();
    if (!rows || rows.length < 2) return { ok: false, message: 'Studentsシートが見つかりません' };
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][COL_ID]).trim() !== sid) continue;
      const nickname = (String(rows[i][COL_NICKNAME] || '').trim()) || '名無し';
      const totalHP  = Number(rows[i][COL_HP])     || 0;
      const streak   = Number(rows[i][COL_STREAK]) || 0;
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
    }
    return { ok: false, message: '生徒IDが見つかりません' };
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
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[iDate]) continue;
    const ds = Utilities.formatDate(new Date(r[iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
    if (ds !== dateStr) continue;
    out.push({
      level: String(r[iLevel] || '').trim(),
      words: [r[iW1], r[iW2], r[iW3]].map(function(w){ return String(w || '').trim(); }).filter(Boolean),
      teacher_work: String(r[iTW] || '').trim(),
      week_no: iWN >= 0 ? String(r[iWN] || '').trim() : '',
      date: ds
    });
  }
  return out;
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

function submitSango(params) {
  try {
    const sid    = String(params.studentId || '').trim();
    const level  = String(params.level     || '').trim();
    const words  = String(params.words     || '').trim();
    const work   = String(params.work      || '').trim();
    const method = String(params.method    || '').trim();
    if (!sid || !level || !work) return { ok: false, message: '必要な情報が不足しています' };

    const ss = _ss();
    // G1: Students はキャッシュ経由
    const stuRows = _getStudentsValues();
    if (!stuRows || stuRows.length < 2) return { ok: false, message: 'Studentsシートが見つかりません' };
    let studentName = '';
    let stuRowIdx = -1;
    for (let i = 1; i < stuRows.length; i++) {
      if (String(stuRows[i][COL_ID]).trim() === sid) {
        studentName = String(stuRows[i][COL_NICKNAME] || '').trim() || '名無し';
        stuRowIdx = i;
        break;
      }
    }

    const subSheet = ss.getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (!subSheet) return { ok: false, message: 'SangoSubmissionsシートが見つかりません' };
    const now = new Date();
    subSheet.appendRow([now, sid, studentName, level, words, work, method]);

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
      const streak = (stuRowIdx >= 0) ? (Number(stuRows[stuRowIdx][COL_STREAK]) || 1) : 1;
      const week = Math.ceil(streak / 7);
      hpGained = 200 * week * week;
      if (stuRowIdx >= 0) {
        const cur = Number(stuRows[stuRowIdx][COL_HP]) || 0;
        const newHP = cur + hpGained;
        const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
        stuSheet.getRange(stuRowIdx + 1, COL_HP + 1).setValue(newHP);
        const upd = {};
        upd[COL_HP] = newHP;
        _updateStudentsCacheRow(stuRowIdx, upd);
      }
      // _logHP に統一（5 列：timestamp/studentId/rawHP/hpGained/type）
      // 三語短文は素点と倍率後HPが同値のため rawHP = hpGained
      _logHP(sid, hpGained, hpGained, 'sango');
      _invalidateCache('cache_ranking_last_week');
    }
    return { ok: true, hpGained: hpGained };
  } catch(err) {
    console.error('[submitSango]', err);
    return { ok: false, message: String(err) };
  }
}

function adminAddSangoTopic(params) {
  try {
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
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
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
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
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
    const sh = _ss().getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, submissions: [] };

    // G1: Students はキャッシュ経由
    const nameMap = {};
    const stuRows = _getStudentsValues();
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
      submissions.push({
        timestamp:      Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
        studentId:      sid,
        studentName:    String(r[2] || ''),
        studentRealName: nameMap[sid] || '',
        level:          String(r[3] || ''),
        words:          String(r[4] || ''),
        work:           String(r[5] || ''),
        method:         String(r[6] || ''),
        teacher_comment: String(r[7] || '')
      });
    }
    submissions.sort(function(a, b){ return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0; });
    return { ok: true, submissions: submissions };
  } catch(err) {
    console.error('[adminListSangoSubmissions]', err);
    return { ok: false, message: String(err) };
  }
}

// 管理画面：先生の作品（個別登録）
// 既存の (date, level) 行を検索して teacher_work 列を上書きする
function adminSetSangoTeacherWork(params) {
  try {
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
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
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
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
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[iDate]) continue;
    const ds = Utilities.formatDate(new Date(r[iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
    if (ds < startStr || ds > endStr) continue;
    out.push({
      date:  ds,
      level: String(r[iLevel] || '').trim(),
      word1: String(r[iW1] || '').trim(),
      word2: String(r[iW2] || '').trim(),
      word3: String(r[iW3] || '').trim(),
      teacher_work: iTW >= 0 ? String(r[iTW] || '').trim() : '',
      week_no:      iWN >= 0 ? String(r[iWN] || '').trim() : ''
    });
  }
  return out;
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
// 保護者画面：お子様の学習履歴（直近7日 + ページング）
// params: { studentId, offset }
//   offset=0 → 昨日〜7日前 / offset=1 → 8〜14日前 ...
// =============================================
function getChildActivityRecent(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    const offset = Math.max(0, Number((params && params.offset) || 0) | 0);

    const endDaysAgo   = offset * 7 + 1;  // 新しい方（小さい値 = 直近）
    const startDaysAgo = offset * 7 + 7;  // 古い方（大きい値）
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
        wabun1:  { done: false, hpGained: 0 }
      };
    }

    const ss = _ss();
    let hasMore = false;

    // HPLog: login / test / sango フラグ + hasMore 判定
    // 末尾 2000 行のみ読む（追記専用シートなので末尾 = 最新、約 40 日分カバー想定）
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
        if      (type === 'login') byDate[ds].login = true;
        else if (type === 'test')  byDate[ds].eitango.done = true;
        else if (type === 'sango') byDate[ds].sango.done   = true;
        else if (type === 'wabun1') {
          byDate[ds].wabun1.done = true;
          byDate[ds].wabun1.hpGained = Number(r[3]) || 0;
        }
      }
    }

    // Attempts: 合格のみ details 補完（末尾 1000 行）
    const atSheet = ss.getSheetByName(SHEET_ATTEMPTS);
    if (atSheet && atSheet.getLastRow() >= 2) {
      const rows = _readLastNRows(atSheet, 1000);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (String(r[1] || '').trim() !== sid) continue;
        const ds = _toDateStr(r[0]);
        if (!ds || !byDate[ds]) continue;
        const pass = String(r[5] || '').trim();
        if (pass !== '合格') continue;
        byDate[ds].eitango.details.push({
          level: String(r[6] || '').trim(),
          set: Number(r[3]) || 0
        });
      }
    }

    // SangoSubmissions: level / timestamp 補完（末尾 500 行）
    const sgSheet = ss.getSheetByName(SHEET_SANGO_SUBMISSIONS);
    if (sgSheet && sgSheet.getLastRow() >= 2) {
      const rows = _readLastNRows(sgSheet, 500);
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

// 正誤判定用: 大文字小文字を無視 + 空白を 1 スペースに畳む（ピリオド・カンマは残す）
function _normalizeWabun1(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
}

// OCR テキストから番号区切りで各タスクの解答を抽出
// 対応マーカー: "1." "1．" "1," "1、" "1)" "1）" "1 " "1\n" "(1)" "（1）"
// （半角/全角数字・区切り記号を寛容に認識。フロント _wabun1CheckNumbers と regex を統一）
function _parseWabun1Work(text) {
  const out = { 1:'', 2:'', 3:'', 4:'' };
  if (!text) return out;
  const t = '\n' + String(text);
  const re = /\n\s*(?:[(（]\s*([1-4１-４])\s*[)）]|([1-4１-４])(?:[.．,、)）]|(?=\s)))\s*/g;
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
function _wabun1HeaderIndices(header) {
  const iSkipText = header.indexOf('skip_text');
  const iSkipLegacy = [1,2,3,4].map(function(n){ return header.indexOf('skip' + n); });
  return {
    iDate:     header.indexOf('date'),
    iWN:       header.indexOf('week_no'),
    iT:        [1,2,3,4].map(function(n){ return header.indexOf('task' + n); }),
    iJP:       header.indexOf('japanese_text'),
    iA:        [1,2,3,4].map(function(n){ return header.indexOf('answer' + n); }),
    iSkipText: iSkipText,
    iSkipLegacy: iSkipLegacy,
    iWL:       header.indexOf('word_list')
  };
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
  const ds = Utilities.formatDate(new Date(r[h.iDate]), 'Asia/Tokyo', 'yyyy-MM-dd');
  return {
    date: ds,
    week_no: h.iWN >= 0 ? String(r[h.iWN] || '').trim() : '',
    tasks: tasks,
    answers: answers,
    japanese_text: h.iJP >= 0 ? String(r[h.iJP] || '').trim() : '',
    skip_text: skipText,
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
      word_list: t.word_list
    } : null;
    const yesterdayOut = y ? {
      date: y.date,
      tasks: y.tasks.map(function(tk){ return { no: tk.no, text: tk.text }; }),
      japanese_text: y.japanese_text,
      skip_text: y.skip_text,
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
// params: { studentId, workText }
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

    const parsed = _parseWabun1Work(workText);
    const results = topic.tasks.map(function(t, idx){
      const studentNorm = _normalizeWabun1(parsed[t.no]);
      const correctNorm = _normalizeWabun1(topic.answers[idx]);
      const correct = correctNorm !== '' && studentNorm === correctNorm;
      return { no: t.no, correct: correct };
    });
    const allCorrect = results.length > 0 && results.every(function(r){ return r.correct; });

    const ss = _ss();
    // G1: Students はキャッシュ経由
    const stuRows = _getStudentsValues();
    if (!stuRows || stuRows.length < 2) return { ok: false, message: 'Studentsシートが見つかりません' };
    let studentName = '';
    let stuRowIdx = -1;
    for (let i = 1; i < stuRows.length; i++) {
      if (String(stuRows[i][COL_ID]).trim() === sid) {
        studentName = String(stuRows[i][COL_NICKNAME] || '').trim() || '名無し';
        stuRowIdx = i;
        break;
      }
    }

    // 提出は毎回記録（正誤問わず）
    const subSheet = ss.getSheetByName(SHEET_WABUN1_SUBMISSIONS);
    if (!subSheet) return { ok: false, message: 'Wabun1Submissionsシートが見つかりません' };
    const now = new Date();
    subSheet.appendRow([now, sid, studentName, workText, 'photo', '']);

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
      const streak = (stuRowIdx >= 0) ? (Number(stuRows[stuRowIdx][COL_STREAK]) || 1) : 1;
      const week = Math.ceil(streak / 7);
      hpGained = 100 * week * week;
      if (stuRowIdx >= 0) {
        const cur = Number(stuRows[stuRowIdx][COL_HP]) || 0;
        const newHP = cur + hpGained;
        const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
        stuSheet.getRange(stuRowIdx + 1, COL_HP + 1).setValue(newHP);
        const upd = {};
        upd[COL_HP] = newHP;
        _updateStudentsCacheRow(stuRowIdx, upd);
      }
      // _logHP に統一（5 列：timestamp/studentId/rawHP/hpGained/type）
      // 和文英訳①は素点と倍率後HPが同値のため rawHP = hpGained
      _logHP(sid, hpGained, hpGained, 'wabun1');
      _invalidateCache('cache_ranking_last_week');
    }

    return {
      ok: true,
      allCorrect: allCorrect,
      results: results,
      hpGained: hpGained,
      alreadyGranted: alreadyGranted
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
        teacher_comment: String(r[5] || '')
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
// この生徒が実際に提出した日のみ返す
// params: { studentId }
// =============================================
function getWabun1PastTopicsRecent(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    const endStr   = _sangoDateAgo(1);
    const startStr = _sangoDateAgo(7);
    const submittedSet = _wabun1SubmittedDatesBySid(sid);
    const rows = _readWabun1TopicsByDateRange(startStr, endStr).filter(function(r){
      return !!submittedSet[r.date];
    });
    return { ok: true, topics: _buildWabun1TopicsByDate(rows) };
  } catch(err) {
    console.error('[getWabun1PastTopicsRecent]', err);
    return { ok: false, message: String(err) };
  }
}

// =============================================
// 生徒用：過去の問題と正解（1週間単位のページング）
// weekOffset=1 → 14日前〜8日前 / weekOffset=2 → 21日前〜15日前 ...
// params: { studentId, weekOffset }
// =============================================
function getWabun1PastTopicsPaged(params) {
  try {
    const sid = String((params && params.studentId) || '').trim();
    if (!sid) return { ok: false, message: '生徒IDが指定されていません' };
    const weekOffset = Math.max(1, Number((params && params.weekOffset) || 1) | 0);
    const endStr   = _sangoDateAgo(weekOffset * 7 + 1);
    const startStr = _sangoDateAgo(weekOffset * 7 + 7);
    const submittedSet = _wabun1SubmittedDatesBySid(sid);
    const rows = _readWabun1TopicsByDateRange(startStr, endStr).filter(function(r){
      return !!submittedSet[r.date];
    });
    const nextEnd   = _sangoDateAgo((weekOffset + 1) * 7 + 1);
    const nextStart = _sangoDateAgo((weekOffset + 1) * 7 + 7);
    const nextRows = _readWabun1TopicsByDateRange(nextStart, nextEnd).filter(function(r){
      return !!submittedSet[r.date];
    });
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
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
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
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
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
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
    const filterDate = String((params && params.date) || '').trim();
    const filterSid  = String((params && params.studentId) || '').trim();

    const sh = _ss().getSheetByName(SHEET_WABUN1_SUBMISSIONS);
    if (!sh || sh.getLastRow() < 2) return { ok: true, submissions: [] };

    // G1: Students はキャッシュ経由
    const nameMap = {};
    const stuRows = _getStudentsValues();
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
        teacher_comment: String(r[5] || '')
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
    if (!_verifyAdmin(params.password)) return { ok: false, message: '認証エラー' };
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
