#!/usr/bin/env node
/**
 * stamp-version.js — マイ活アプリ HTML キャッシュバスティング自動化
 *   対象：index.html / view.html / admin.html（2026-07-01 に view/admin を追加）
 *
 * 概要:
 *   実行ごとに現在時刻（JST）から YYYYMMDD-HHMM 形式のバージョン文字列を生成し、
 *   各対象 HTML の以下 2 ヶ所を一括更新する（3 ファイルとも同一 version）：
 *     ① 外部 JS/CSS の src/href に ?v=<バージョン> を付与（既存 ?v=... は置換）
 *        - CDN 上のサードパーティライブラリ（MathJax / Cropper 等）が対象
 *        - CDN 側は不明クエリを通常無視するが、ブラウザのローカルキャッシュ識別子としては有効
 *     ② 左下バージョンバッジ <span id="app-version"> の中身を <バージョン> に置換
 *
 * 使い方:
 *   $ node scripts/stamp-version.js
 *
 * 運用:
 *   - Claude Code が index.html を変更した後、commit/push する前に必ず実行する
 *   - ふくちさんの手動運用 4 ステップは変更不要（Claude Code 側の責務として
 *     CLAUDE.md に明記し、Claude Code が dev に push する直前に必ず実行する）
 *   - 手動実行も可（PowerShell / Bash どちらでも cross-platform に動作）
 *
 * 注意:
 *   - 外部参照のない inline JS/CSS（index.html 内に大量にある）は対象外
 *   - 重要なのは「index.html 本体が新しい場合、ブラウザに必ず最新版を取得させる」こと。
 *     これは index.html 内の <meta http-equiv="Cache-Control" ...> 3 行（既設）で対応済み。
 *     本スクリプトは「外部ライブラリのキャッシュ識別子」と「バージョンバッジ表示」の
 *     2 つを補強する役割。
 */

const fs = require('fs');
const path = require('path');

// --- バージョン文字列生成（JST、YYYYMMDD-HHMM 形式）---
function makeVersionString() {
  const now = new Date();
  // JST = UTC+9。Date オブジェクトに 9 時間オフセットを加えて getUTCXxx() で読む
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const Y = jst.getUTCFullYear();
  const M = pad(jst.getUTCMonth() + 1);
  const D = pad(jst.getUTCDate());
  const h = pad(jst.getUTCHours());
  const m = pad(jst.getUTCMinutes());
  return `${Y}${M}${D}-${h}${m}`;
}

// --- URL に ?v=<version> を付与（既存の v=xxx パラメータは置換） ---
function appendVersionQuery(url, version) {
  // 既存の v= パラメータを除去
  //   ?v=xxx                → ''
  //   ?v=xxx&other=1        → ?other=1
  //   ?other=1&v=xxx        → ?other=1
  //   ?other=1&v=xxx&z=2    → ?other=1&z=2
  let cleaned = url;
  // & 区切りの v= を除去
  cleaned = cleaned.replace(/&v=[^&]*/g, '');
  // 先頭 ? 区切りの v= を除去（後続が無い場合）
  cleaned = cleaned.replace(/\?v=[^&]*$/, '');
  // 先頭 ? 区切りの v= を除去（後続あり、& を ? に格上げ）
  cleaned = cleaned.replace(/\?v=[^&]*&/, '?');
  // 末尾余分な & や ? を整える
  cleaned = cleaned.replace(/[?&]$/, '');
  // 新しい v= を末尾に付与
  const sep = cleaned.includes('?') ? '&' : '?';
  return cleaned + sep + 'v=' + version;
}

// --- 1 つの HTML ファイルを stamp（読込 → 置換 → 書戻し）---
//   変換内容は従来 index.html に対して行っていたものと完全に同一（①外部JS ?v / ②外部CSS ?v /
//   ③バッジ）。ファイルパスと version を引数化しただけ。存在しないファイルは skip。
function stampHtmlFile(relPath, version) {
  const repoRoot = path.resolve(__dirname, '..');
  const filePath = path.join(repoRoot, relPath);

  if (!fs.existsSync(filePath)) {
    console.warn('[stamp-version] ⚠️ ' + relPath + ' not found, skip');
    return;
  }

  let html = fs.readFileSync(filePath, 'utf8');
  let scriptReplacements = 0;
  let linkReplacements = 0;
  let badgeReplaced = false;

  // ① 外部 JS の src に ?v= を付与
  //    <script ... src="URL" ...>
  html = html.replace(/<script\b([^>]*?)\bsrc="([^"]+)"/g, (full, attrs, url) => {
    // data:/blob:/# で始まる URL はスキップ（外部リソースではない）
    if (/^(data:|blob:|#)/.test(url)) return full;
    const newUrl = appendVersionQuery(url, version);
    if (newUrl !== url) scriptReplacements++;
    return `<script${attrs}src="${newUrl}"`;
  });

  // ② 外部 CSS の href に ?v= を付与
  //    <link ... rel="stylesheet" ... href="URL" ...> （rel="stylesheet" 必須、icon 等は除外）
  html = html.replace(/<link\b([^>]*?)>/g, (full, attrs) => {
    // rel="stylesheet" を含むものだけ対象
    if (!/\brel\s*=\s*"[^"]*stylesheet[^"]*"/i.test(attrs)) return full;
    // href="..." を抽出
    const hrefMatch = attrs.match(/\bhref="([^"]+)"/);
    if (!hrefMatch) return full;
    const url = hrefMatch[1];
    if (/^(data:|blob:|#)/.test(url)) return full;
    const newUrl = appendVersionQuery(url, version);
    if (newUrl === url) return full;
    linkReplacements++;
    const newAttrs = attrs.replace(/\bhref="[^"]+"/, `href="${newUrl}"`);
    return `<link${newAttrs}>`;
  });

  // ③ 左下バージョンバッジ <span id="app-version" ...>...</span> の中身を置換
  //    マーカーは中身の文字列に依存せず、id="app-version" だけで特定する
  //    ※ view.html / admin.html はバッジ表示を実行時 document.lastModified で上書きするため、
  //      ここでの静的テキスト置換は「見た目」を変えない（ソース上のバージョン刻印のみ）。
  const badgeRegex = /(<span\s+id="app-version"[^>]*>)([^<]*)(<\/span>)/;
  if (badgeRegex.test(html)) {
    html = html.replace(badgeRegex, `$1${version}$3`);
    badgeReplaced = true;
  } else {
    console.warn('[stamp-version] ⚠️ [' + relPath + '] <span id="app-version"> not found, badge unchanged');
  }

  fs.writeFileSync(filePath, html, 'utf8');

  console.log('   [' + relPath + '] <script src>:' + scriptReplacements +
              ' / <link href>:' + linkReplacements +
              ' / badge:' + (badgeReplaced ? 'yes' : 'no'));
}

// --- stamp 対象 HTML 一覧 ---
//   index.html：従来どおり（外部 MathJax / Cropper の ?v ＋ バッジ）。処理内容は不変。
//   admin.html：2026-07-01 追加。外部 html2canvas(CDN) に ?v が付く ＋ バッジ。
//   view.html ：2026-07-01 追加。外部リソースを持たないためバッジのみ（表示は実行時 lastModified）。
//   ※ 1 回の実行で 3 ファイルとも同一 version に更新する。
const TARGET_HTML_FILES = ['index.html', 'view.html', 'admin.html'];

function stampAll() {
  const version = makeVersionString();
  console.log('--- stamp-version.js ---');
  console.log('✅ stamped: ' + version);
  TARGET_HTML_FILES.forEach(function(f) { stampHtmlFile(f, version); });
}

stampAll();
