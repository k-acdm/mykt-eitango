#!/usr/bin/env node
/**
 * stamp-version.js — マイ活アプリ index.html キャッシュバスティング自動化
 *
 * 概要:
 *   実行ごとに現在時刻（JST）から YYYYMMDD-HHMM 形式のバージョン文字列を生成し、
 *   index.html の以下 2 ヶ所を一括更新する：
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

// --- index.html を読込 → 置換 → 書戻し ---
function stampIndexHtml() {
  const repoRoot = path.resolve(__dirname, '..');
  const indexPath = path.join(repoRoot, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.error('[stamp-version] ❌ index.html not found at', indexPath);
    process.exit(1);
  }

  const version = makeVersionString();
  let html = fs.readFileSync(indexPath, 'utf8');
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
  const badgeRegex = /(<span\s+id="app-version"[^>]*>)([^<]*)(<\/span>)/;
  if (badgeRegex.test(html)) {
    html = html.replace(badgeRegex, `$1${version}$3`);
    badgeReplaced = true;
  } else {
    console.warn('[stamp-version] ⚠️ <span id="app-version"> not found, badge unchanged');
  }

  fs.writeFileSync(indexPath, html, 'utf8');

  console.log('--- stamp-version.js ---');
  console.log('✅ stamped: ' + version);
  console.log('   <script src>  replacements: ' + scriptReplacements);
  console.log('   <link href>   replacements: ' + linkReplacements);
  console.log('   <span id="app-version"> updated: ' + (badgeReplaced ? 'yes' : 'no'));
}

stampIndexHtml();
