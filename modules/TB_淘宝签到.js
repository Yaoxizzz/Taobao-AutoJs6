// modules/TB_淘宝签到.js
// =============================================================================
// 【TB】淘宝自动签到 - 主线模块（AutoJs6 / Rhino / ES5）
// =============================================================================
// 你这次报错：
//   未结束的字符串字面量 (TB_淘宝签到.js#112)
//
// 这类错误 99% 是因为：
//   复制粘贴过程中，某一行字符串的引号没闭合（少了 ' 或 ")
//   或者包含了特殊引号字符导致 Rhino 解析异常。
//
// 为了彻底避免：
//   1) 我把本文件里所有字符串都改成【纯 ASCII 引号】(只用 ' 和 ")
//   2) 删除可能引发复制异常的“花体引号/特殊符号”
//   3) 你只需要【整文件覆盖】(不要分段替换)
//
// 业务逻辑（按你最新说明修正）：
//   - 淘金币：看到「赚更多金币」= 已签到，绝对不点它（会弹任务列表，下阶段做）
//   - 88VIP：点「去签到」后会跳走，但不处理跳转页；回到会员中心看到「明日领」即可
//   - 红包签到：
//       第1次：看到「继续领钱/继续领取」= 已完成（不点它，避免弹列表遮挡）
//       第2次：进入「连续打卡」页再点「点击签到」
//
// 额外加固（不改其它文件，仅在本文件内做）：
//   - 防误跳转：如果被广告误触跳到其它 App，会尝试 back 拉回淘宝
//   - 防弹窗遮挡：每次等待/关键步骤都会先跑一次 弹窗.处理全部弹窗()
//   - 防“帕金森横跳”：连续打卡入口只做轻量滑动(最多 2 次)，不会疯狂滑
// =============================================================================

'use strict';

var 配置 = require('./TB_配置');
var 工具 = require('./TB_工具');
var 弹窗 = require('./TB_弹窗处理');

// =============================================================================
// 0) 触摸穿透悬浮日志（不挡点击）
// =============================================================================
// 说明：
// - 你要求“前台能看到日志，但不能遮挡点击”。
// - floaty.rawWindow + setTouchable(false) = 触摸穿透
// - 如果没开悬浮窗权限：脚本照跑，只是悬浮日志不显示
var 浮窗日志 = (function () {
  var win = null;
  var inited = false;
  var enabled = true; // 不想要悬浮日志：改成 false
  var lines = [];
  var maxLines = 12;

  function _safe(fn) { try { return fn(); } catch (e) { return null; } }

  function _timeStr() {
    var d = new Date();
    var hh = ('0' + d.getHours()).slice(-2);
    var mm = ('0' + d.getMinutes()).slice(-2);
    var ss = ('0' + d.getSeconds()).slice(-2);
    return hh + ':' + mm + ':' + ss;
  }

  function _hasPermission() {
    if (typeof floaty === 'undefined') return false;
    if (typeof floaty.hasPermission === 'function') return floaty.hasPermission();
    return true; // 老版本没有 hasPermission：交给创建时 try/catch
  }

  function _requestPermission() {
    if (typeof floaty === 'undefined') return;
    if (typeof floaty.requestPermission === 'function') {
      toast('请开启 AutoJs6 悬浮窗权限后重新运行');
      floaty.requestPermission();
    } else {
      toast('请到系统设置里手动开启 AutoJs6 悬浮窗权限');
    }
  }

  function _ensure() {
    if (inited) return !!win;
    inited = true;

    if (!enabled) return false;

    if (!_hasPermission()) {
      console.warn('[TB] floaty permission not granted, skip float log');
      _requestPermission();
      return false;
    }

    try {
      win = floaty.rawWindow(
        <frame bg="#00000000">
          <vertical padding="10" bg="#AA000000">
            <text text="TB LOG" textColor="#FFD700" textSize="12sp" textStyle="bold"/>
            <text id="txt" text="starting..." textColor="#FFFFFF" textSize="10sp" maxLines="20"/>
          </vertical>
        </frame>
      );

      // 放左上角，尽量不挡操作区域
      var x = parseInt(device.width * 0.03, 10);
      var y = parseInt(device.height * 0.12, 10);
      win.setPosition(x, y);

      // 关键：不挡点击
      if (typeof win.setTouchable === 'function') win.setTouchable(false);

      lines = [];
      _write('I', 'float log ready');
      return true;
    } catch (e) {
      console.warn('[TB] floaty create failed: ' + e);
      win = null;
      return false;
    }
  }

  function _write(level, msg) {
    if (!_ensure()) return;
    msg = String(msg);

    var line = _timeStr() + ' [' + level + '] ' + msg;
    lines.push(line);
    while (lines.length > maxLines) lines.shift();

    _safe(function () {
      ui.run(function () {
        _safe(function () { win.txt.setText(lines.join('
')); });
      });
    });
  }

  function i(msg) { _write('I', msg); }
  function w(msg) { _write('W', msg); }
  function e(msg) { _write('E', msg); }

  function close() {
    _safe(function () { if (win) win.close(); });
    win = null;
    lines = [];
    inited = false;
  }

  return { i: i, w: w, e: e, close: close };
})();

// =============================================================================
// 1) 日志：同时输出到 AutoJs6 日志面板 + 悬浮窗
// =============================================================================
function logI(msg) {
  console.log('[TB] ' + msg);
  浮窗日志.i(msg);
}

function logW(msg) {
  console.warn('[TB] ' + msg);
  浮窗日志.w(msg);
}

function logE(msg) {
  console.error('[TB] ' + msg);
  浮窗日志.e(msg);
}

// =============================================================================
// 2) 小工具
// =============================================================================
function now() { return new Date().getTime(); }
function safeSleep(ms) { try { sleep(ms); } catch (e) {} }

function safeBack(reason) {
  logI('back: ' + (reason || ''));
  try { back(); } catch (e) {}
  safeSleep(700);
}

function textHas(s) {
  try { return textContains(String(s)).exists(); } catch (e) { return false; }
}

function pkgIsTaobao() {
  try { return currentPackage() === 配置.包名; } catch (e) { return false; }
}

// 防误跳转：如果跳到其它 app，尽量 back 回淘宝
function ensureTaobaoPackage(tag) {
  tag = tag || '';
  try {
    var p = currentPackage();
    if (!p) return true;
    if (p === 配置.包名) return true;

    // 有时候淘宝内部打开的是 webview/系统授权页，允许短暂存在
    if (p.indexOf('permission') >= 0 || p.indexOf('packageinstaller') >= 0) return true;

    logW('not taobao pkg (' + p + '), try back: ' + tag);
    safeBack('return taobao');

    // 再检查一次
    return pkgIsTaobao();
  } catch (e) {
    return true;
  }
}

// 等待某个条件出现，同时持续处理弹窗，避免遮挡
function waitForCondition(checkFn, timeoutMs, reason) {
  var t0 = now();
  var to = timeoutMs || 15000;

  logI('wait: ' + (reason || '') + ', timeout=' + to + 'ms');

  while (now() - t0 < to) {
    // 防误跳转
    ensureTaobaoPackage('wait');

    // 先处理弹窗
    try {
      if (弹窗 && 弹窗.处理全部弹窗 && 弹窗.处理全部弹窗()) {
        safeSleep(350);
        continue;
      }
    } catch (e0) {}

    // 再检查条件
    try {
      if (checkFn()) {
        logI('wait ok: ' + (reason || '') + ', cost=' + (now() - t0) + 'ms');
        return true;
      }
    } catch (e1) {}

    safeSleep(250);
  }

  logW('wait timeout: ' + (reason || '') + ', cost=' + (now() - t0) + 'ms');
  return false;
}

// 找图点击：支持多张图路径按顺序尝试
function clickByAnyImage(imagePaths, threshold, reason) {
  threshold = threshold || 0.82;

  // 找图必须有截图权限
  try {
    if (工具 && 工具.requestScreenIfNeeded) {
      if (!工具.requestScreenIfNeeded()) {
        logW('no screen capture permission, skip image: ' + (reason || ''));
        return false;
      }
    }
  } catch (e0) {}

  if (!imagePaths || !imagePaths.length) return false;

  for (var i = 0; i < imagePaths.length; i++) {
    var pth = String(imagePaths[i]);

    // 路径不存在就跳过
    try { if (!files.exists(pth)) continue; } catch (e1) {}

    var p = null;
    try { p = 工具.findImageSafe(pth, threshold); } catch (e2) { p = null; }

    if (p) {
      logI('img hit: ' + (reason || '') + ' => ' + pth + ' @' + p.x + ',' + p.y);
      try { 工具.smartClick(p.x + 5, p.y + 5); }
      catch (e3) { try { press(p.x + 5, p.y + 5, 80); } catch (e4) {} }
      safeSleep(900);
      return true;
    }
  }

  logW('img miss: ' + (reason || '') + ', tried=' + imagePaths.length);
  return false;
}

// 轻量上滑一次（只用于把入口滑出来；最多调用 2 次）
function gentleSwipeUpOnce() {
  try {
    var x = parseInt(device.width * 0.5, 10);
    var y1 = parseInt(device.height * 0.72, 10);
    var y2 = parseInt(device.height * 0.52, 10);
    swipe(x, y1, x, y2, 380);
    safeSleep(700);
    return true;
  } catch (e) {
    return false;
  }
}

// 尝试收起底部任务面板/遮挡层（点空白 + back）
function dismissPossibleSheet(tag) {
  tag = tag || 'sheet';

  // 先走统一弹窗处理
  try {
    if (弹窗 && 弹窗.处理全部弹窗 && 弹窗.处理全部弹窗()) {
      logI(tag + ': popup handled');
      safeSleep(400);
      return true;
    }
  } catch (e0) {}

  // 点上方空白
  try {
    var x = parseInt(device.width * 0.5, 10);
    var y = parseInt(device.height * 0.18, 10);
    press(x, y, 60);
    safeSleep(500);
    logI(tag + ': tap blank');
  } catch (e1) {}

  // back 一次
  try {
    back();
    safeSleep(650);
    logI(tag + ': back once');
    return true;
  } catch (e2) {
    return false;
  }
}

// =============================================================================
// 3) 前置：无障碍、启动淘宝、回到首页
// =============================================================================
function ensureAccessibility() {
  try {
    auto.waitFor();
    logI('acc: enabled');
    return true;
  } catch (e) {
    logW('acc: maybe disabled');
    return false;
  }
}

function ensureTaobaoForeground() {
  var pkg = '';
  try { pkg = currentPackage(); } catch (e) {}

  if (pkg !== 配置.包名) {
    logI('launch taobao');
    try { 工具.launchTaobao(); }
    catch (e2) { try { app.launchPackage(配置.包名); } catch (e3) {} }
    safeSleep(1500);
  }
  return true;
}

function backToHome(maxBack) {
  maxBack = maxBack || 4;
  logI('back to home, max=' + maxBack);

  for (var i = 0; i < maxBack; i++) {
    ensureTaobaoPackage('home');

    try { if (弹窗.处理全部弹窗()) safeSleep(300); } catch (e0) {}

    // 识别到首页入口任意一个就算到首页
    try {
      if (desc(配置.首页入口.领淘金币.desc).exists()
        || desc(配置.首页入口['88VIP'].desc).exists()
        || desc(配置.首页入口.红包签到.desc).exists()) {
        logI('home ok');
        return true;
      }
    } catch (e1) {}

    safeBack('home(' + (i + 1) + '/' + maxBack + ')');
  }

  logW('home failed');
  return false;
}

function ensureHome() {
  ensureTaobaoForeground();
  if (backToHome(4)) return true;

  // 兜底：点底部首页 Tab
  logW('try click bottom home tab');
  try {
    if (工具.clickByDesc('首页', 800, 'tab-home') || 工具.clickByText('首页', 800, 'tab-home')) {
      safeSleep(1200);
    }
  } catch (e0) {}

  return backToHome(4);
}

// =============================================================================
// 4) 领淘金币签到
// =============================================================================
function flowCoinSign() {
  logI('FLOW: coin');

  if (!ensureHome()) {
    logW('coin: skip, not home');
    return false;
  }

  // 点击首页入口：领淘金币
  var ok = false;
  try {
    ok = 工具.clickByDescInArea(配置.首页入口.领淘金币.desc, 配置.首页入口.领淘金币.区域, 1200, 'home-coin');
    if (!ok) ok = 工具.clickByDesc(配置.首页入口.领淘金币.desc, 800, 'home-coin-all');
    if (!ok) ok = 工具.clickRatio(配置.首页入口.领淘金币.兜底点, 'home-coin-ratio');
  } catch (e1) { ok = false; }

  if (!ok) {
    logW('coin entry click failed');
    return false;
  }

  safeSleep(1200);

  // 你新增的素材路径（作为额外兜底）
  var imgEarnMore = '淘宝素材/淘宝_领淘金币页面_赚更多金币/crop.png';

  // [Fix] 如果出现“赚更多金币”= 已签到，绝对不点它
  if (textHas('赚更多金币')) {
    logI('coin signed: earn more (do not click)');
    safeBack('coin signed');
    return true;
  }

  // 等待“点击签到”出现，或直接出现“赚更多金币”
  var ready = waitForCondition(function () {
    if (textHas(配置.领淘金币页.点击签到.text)) return true;
    if (textHas('赚更多金币')) return true;

    // 额外：找图命中也算 ready
    try {
      if (工具.requestScreenIfNeeded()) {
        if (工具.findImageSafe(配置.领淘金币页.点击签到.找图, 0.82)) return true;
        if (工具.findImageSafe(imgEarnMore, 0.82)) return true;
      }
    } catch (e0) {}

    return false;
  }, 22000, 'coin page');

  if (!ready) {
    logW('coin page timeout');
    safeBack('coin timeout');
    return false;
  }

  if (textHas('赚更多金币')) {
    logI('coin signed after wait: earn more');
    safeBack('coin signed');
    return true;
  }

  // 点击“点击签到”
  var clicked = false;
  try {
    var btn = textContains(配置.领淘金币页.点击签到.text).findOne(1200);
    if (!btn) btn = descContains(配置.领淘金币页.点击签到.text).findOne(1200);
    if (btn) clicked = 工具.clickUiObject(btn, 'coin-sign-btn');
  } catch (e2) {}

  if (!clicked) clicked = clickByAnyImage([配置.领淘金币页.点击签到.找图], 0.82, 'coin-sign-img');
  if (!clicked) {
    try { clicked = 工具.clickRatio(配置.领淘金币页.点击签到.兜底点, 'coin-sign-ratio'); } catch (e3) {}
  }

  if (!clicked) {
    logW('coin sign click failed');
    safeBack('coin fail');
    return false;
  }

  logI('coin sign clicked, verify');

  // 等待变成“赚更多金币”或出现“已签到”
  waitForCondition(function () {
    if (textHas('赚更多金币')) return true;
    if (textHas('已签到')) return true;
    if (textHas('今日已签到')) return true;

    // 额外：图片验签
    try {
      if (工具.requestScreenIfNeeded()) {
        if (工具.findImageSafe(imgEarnMore, 0.82)) return true;
      }
    } catch (e0) {}

    return false;
  }, 12000, 'coin verify');

  safeBack('coin done');
  return true;
}

// =============================================================================
// 5) 88VIP 去签到
// =============================================================================
function flowVipSign() {
  logI('FLOW: 88vip');

  if (!ensureHome()) {
    logW('vip: skip, not home');
    return false;
  }

  // 点击首页入口：88VIP
  var ok = false;
  try {
    ok = 工具.clickByDescInArea(配置.首页入口['88VIP'].desc, 配置.首页入口['88VIP'].区域, 1200, 'home-vip');
    if (!ok) ok = 工具.clickByDesc(配置.首页入口['88VIP'].desc, 800, 'home-vip-all');
    if (!ok) ok = 工具.clickRatio(配置.首页入口['88VIP'].兜底点, 'home-vip-ratio');
  } catch (e1) { ok = false; }

  if (!ok) {
    logW('vip entry click failed');
    return false;
  }

  safeSleep(1400);

  // 你新增的“明日领”素材路径（验签兜底）
  var imgTomorrow = '淘宝素材/淘宝_88VIP_每日签到_明日领/crop.png';

  // 如果已经看到“明日领”，直接认为已签到
  if (textHas('明日领')) {
    logI('vip signed already: tomorrow');
    safeBack('vip signed');
    return true;
  }

  // 等待“去签到”出现（或直接出现明日领）
  var ready = waitForCondition(function () {
    if (textHas(配置.VIP页.去签到.text)) return true;
    if (textHas('明日领')) return true;

    // 图片兜底
    try {
      if (工具.requestScreenIfNeeded()) {
        if (工具.findImageSafe(imgTomorrow, 0.82)) return true;
      }
    } catch (e0) {}

    return false;
  }, 26000, 'vip center');

  if (!ready) {
    logW('vip center timeout');
    safeBack('vip timeout');
    return false;
  }

  if (textHas('明日领')) {
    logI('vip signed after wait: tomorrow');
    safeBack('vip signed');
    return true;
  }

  // 点击“去签到”
  var clicked = false;
  try {
    var btn = textContains(配置.VIP页.去签到.text).findOne(1200);
    if (!btn) btn = descContains(配置.VIP页.去签到.text).findOne(1200);
    if (btn) clicked = 工具.clickUiObject(btn, 'vip-go-sign');
  } catch (e2) {}

  if (!clicked) clicked = clickByAnyImage([配置.VIP页.去签到.找图], 0.82, 'vip-go-sign-img');
  if (!clicked) {
    try { clicked = 工具.clickRatio(配置.VIP页.去签到.兜底点, 'vip-go-sign-ratio'); } catch (e3) {}
  }

  if (!clicked) {
    logW('vip go-sign click failed');
    safeBack('vip fail');
    return false;
  }

  logI('vip go-sign clicked, now back to center to verify');
  safeSleep(1500);

  // 不处理跳转页：直接 back 回会员中心
  safeBack('vip back 1');
  safeSleep(1000);

  // 有些机型要 back 两次
  if (!textHas('去签到') && !textHas('明日领')) {
    safeBack('vip back 2');
    safeSleep(1000);
  }

  // 验签：明日领
  var okSigned = waitForCondition(function () {
    if (textHas('明日领')) return true;
    if (textHas('已签到')) return true;

    // 图片兜底
    try {
      if (工具.requestScreenIfNeeded()) {
        if (工具.findImageSafe(imgTomorrow, 0.82)) return true;
      }
    } catch (e0) {}

    return false;
  }, 14000, 'vip verify');

  if (okSigned) logI('vip verify ok');
  else logW('vip verify not found');

  safeBack('vip done');
  return true;
}

// =============================================================================
// 6) 红包签到
// =============================================================================
function flowHongbaoSign() {
  logI('FLOW: hongbao');

  if (!ensureHome()) {
    logW('hb: skip, not home');
    return false;
  }

  // 点击首页入口：红包签到
  var ok = false;
  try {
    ok = 工具.clickByDescInArea(配置.首页入口.红包签到.desc, 配置.首页入口.红包签到.区域, 1200, 'home-hb');
    if (!ok) ok = 工具.clickByDesc(配置.首页入口.红包签到.desc, 800, 'home-hb-all');
    if (!ok) ok = 工具.clickRatio(配置.首页入口.红包签到.兜底点, 'home-hb-ratio');
  } catch (e1) { ok = false; }

  if (!ok) {
    logW('hb entry click failed');
    return false;
  }

  safeSleep(1500);

  // 你新增的“继续领钱”素材（验签兜底）
  var imgContinueMoney = '淘宝素材/淘宝_红包签到_继续领钱/crop.png';

  // ------------------- A) 第1次签到：立即签到（或已是继续领钱） -------------------
  // 如果已出现继续领钱/继续领取 => 已完成第1次签到，坚决不点击
  if (textHas('继续领钱') || textHas('继续领取')) {
    logI('hb first signed: continue money (do not click)');
  } else {
    // 尝试点击立即签到
    var clicked = clickByAnyImage([配置.红包签到页.立即签到.找图], 0.82, 'hb sign now');
    if (!clicked) {
      try { clicked = 工具.clickRatio(配置.红包签到页.立即签到.兜底点, 'hb sign now ratio'); } catch (e2) {}
    }

    if (clicked) logI('hb sign now clicked, verify');
    else logW('hb sign now not found, maybe already signed');

    // 等待出现继续领钱/继续领取（不点）
    waitForCondition(function () {
      if (textHas('继续领钱') || textHas('继续领取') || textHas('已签到')) return true;

      // 图片兜底
      try {
        if (工具.requestScreenIfNeeded()) {
          if (工具.findImageSafe(imgContinueMoney, 0.82)) return true;
        }
      } catch (e0) {}

      return false;
    }, 14000, 'hb first verify');
  }

  // 如果误弹了任务列表/底部面板：先收起
  dismissPossibleSheet('hb');

  // ------------------- B) 第2次签到：连续打卡 -------------------
  // 你提供了 3 张入口图，进入同一页面，只是提高命中率
  var imgsContinueEntry = [
    配置.红包签到页.连续打卡入口.找图,
    '淘宝素材/淘宝_红包签到_连续打卡2/crop.png',
    '淘宝素材/淘宝_红包签到_连续打卡3/crop.png'
  ];

  var entered = false;

  for (var round = 1; round <= 2; round++) {
    logI('hb enter continue page round ' + round + '/2');

    // 再次收起遮挡（很多时候“继续领钱”面板会反复出现）
    dismissPossibleSheet('hb');

    var go = clickByAnyImage(imgsContinueEntry, 0.82, 'hb continue entry');
    if (!go) {
      try { go = 工具.clickRatio(配置.红包签到页.连续打卡入口.兜底点, 'hb continue entry ratio'); } catch (e3) { go = false; }
    }

    safeSleep(1200);

    entered = waitForCondition(function () {
      // 连续打卡页的特征：出现“点击签到”
      if (textHas(配置.红包签到页.连续打卡页_点击签到.text)) return true;

      // 找图兜底
      try {
        if (工具.requestScreenIfNeeded()) {
          if (工具.findImageSafe(配置.红包签到页.连续打卡页_点击签到.找图, 0.82)) return true;
        }
      } catch (e0) {}

      return false;
    }, 26000, 'hb continue page');

    if (entered) break;

    logW('hb continue page not entered, gentle swipe once then retry');
    gentleSwipeUpOnce();
  }

  if (!entered) {
    logW('hb: cannot enter continue page');
    safeBack('hb back1');
    safeBack('hb back2');
    return false;
  }

  // 在连续打卡页：点击“点击签到”
  var signClicked = false;
  try {
    var btn = textContains(配置.红包签到页.连续打卡页_点击签到.text).findOne(1200);
    if (!btn) btn = descContains(配置.红包签到页.连续打卡页_点击签到.text).findOne(1200);
    if (btn) signClicked = 工具.clickUiObject(btn, 'hb continue sign');
  } catch (e4) {}

  if (!signClicked) signClicked = clickByAnyImage([配置.红包签到页.连续打卡页_点击签到.找图], 0.82, 'hb continue sign img');
  if (!signClicked) {
    try { signClicked = 工具.clickRatio(配置.红包签到页.连续打卡页_点击签到.兜底点, 'hb continue sign ratio'); } catch (e5) { signClicked = false; }
  }

  if (signClicked) {
    logI('hb continue sign clicked, verify');

    waitForCondition(function () {
      // 常见验签：按钮消失 或 出现已签到/明日
      try {
        if (!textContains(配置.红包签到页.连续打卡页_点击签到.text).exists()) return true;
      } catch (e0) {}
      if (textHas('已签到') || textHas('明日') || textHas('明天')) return true;
      return false;
    }, 14000, 'hb continue verify');

  } else {
    logW('hb continue sign not found');
  }

  safeBack('hb continue back');
  safeBack('hb page back');
  return true;
}

// =============================================================================
// 7) 运行入口（被【TB】淘宝自动签到.js 调用）
// =============================================================================
function 运行() {
  var t0 = now();

  logI('start');
  logI('tip: float log is touch-through (no block)');

  ensureAccessibility();

  // 强杀淘宝（不重复打印成功/失败，避免你困惑）
  try { 工具.forceStopTaobao(); } catch (e0) { logW('force-stop error'); }

  safeSleep(1000);

  ensureTaobaoForeground();

  // 截图权限（找图必须）
  try {
    if (工具.requestScreenIfNeeded && 工具.requestScreenIfNeeded()) logI('capture ok');
    else logW('capture not ok, image match may fail');
  } catch (e1) {}

  try {
    flowCoinSign();
    try { 弹窗.处理全部弹窗(); } catch (e2) {}

    flowVipSign();
    try { 弹窗.处理全部弹窗(); } catch (e3) {}

    flowHongbaoSign();
    try { 弹窗.处理全部弹窗(); } catch (e4) {}

  } catch (e5) {
    logE('fatal: ' + e5);
  } finally {
    logI('done, ms=' + (now() - t0));
    safeSleep(1500);
    try { 浮窗日志.close(); } catch (e6) {}
  }
}

module.exports = {
  运行: 运行
};
