// modules/TB_淘宝签到.js
// =============================================================================
// 【TB】淘宝自动签到 - 主线模块（AutoJs6 / Rhino / ES5）
// =============================================================================
// 你最新日志暴露的真实问题：
// 1) 日志是英文，看不懂 -> 本版全部改为【中文日志】
// 2) 红包签到：容易误点「继续领钱」弹任务列表，遮挡「连续打卡」入口
// 3) 我之前的“收起面板”里带了 back，一旦 back 过头就会回到首页/其它页，导致你感觉脚本乱点
//
// 本次修复（只改本文件）：
// [Fix] 全部日志中文化
// [Fix] 红包签到：
//    - 用 文本(text/desc) + 图片(你新增素材) 双重判断「继续领钱/继续领取」= 第一次签到已完成
//    - 第一次签到完成后：只做“点空白/弹窗处理”收起遮挡，不再默认 back（避免退出页面）
//    - 「连续打卡」入口：优先按控件文本(连续打卡)点击，其次找图，最后才比例点
//    - 进入连续打卡页失败：会先确认自己还在“红包签到主页面”，否则会自动回到首页重新进入红包签到
// [Enhance] 轻量滑动：只轻滑 0~2 次，不会疯狂上下乱滑
// [Enhance] 防误跳转：如果误触广告跳到其它 App，会尝试 back 拉回淘宝
// =============================================================================

'use strict';

var 配置 = require('./TB_配置');
var 工具 = require('./TB_工具');
var 弹窗 = require('./TB_弹窗处理');

// =============================================================================
// 0) 触摸穿透悬浮日志（不挡点击）
// =============================================================================
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
      console.warn('[TB] 悬浮窗权限未开启：悬浮日志不显示（不影响脚本运行）');
      _requestPermission();
      return false;
    }

    try {
      win = floaty.rawWindow(
        <frame bg="#00000000">
          <vertical padding="10" bg="#AA000000">
            <text text="TB 运行日志" textColor="#FFD700" textSize="12sp" textStyle="bold"/>
            <text id="txt" text="启动中..." textColor="#FFFFFF" textSize="10sp" maxLines="20"/>
          </vertical>
        </frame>
      );

      // 放左上角，尽量不挡操作区域
      var x = parseInt(device.width * 0.03, 10);
      var y = parseInt(device.height * 0.12, 10);
      win.setPosition(x, y);

      // ✅ 关键：不挡点击（触摸穿透）
      if (typeof win.setTouchable === 'function') win.setTouchable(false);

      lines = [];
      _write('I', '悬浮日志已启动（不挡点击）');
      return true;
    } catch (e) {
      console.warn('[TB] 悬浮日志创建失败：' + e);
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
        _safe(function () { win.txt.setText(lines.join('')); });
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
// 1) 日志：AutoJs6 日志面板 + 悬浮日志
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
  logI('返回：' + (reason || ''));
  try { back(); } catch (e) {}
  safeSleep(700);
}

function textHasContains(s) {
  try { return textContains(String(s)).exists(); } catch (e) { return false; }
}

function descHasContains(s) {
  try { return descContains(String(s)).exists(); } catch (e) { return false; }
}

function anyHasContains(s) {
  return textHasContains(s) || descHasContains(s);
}

function pkgIsTaobao() {
  try { return currentPackage() === 配置.包名; } catch (e) { return false; }
}

// 防误跳转：如果误触广告跳到其它 App，会尝试 back 拉回淘宝
function ensureTaobaoPackage(tag) {
  tag = tag || '';
  try {
    var p = currentPackage();
    if (!p) return true;
    if (p === 配置.包名) return true;

    // 系统授权页允许短暂存在
    if (p.indexOf('permission') >= 0 || p.indexOf('packageinstaller') >= 0) return true;

    logW('检测到不在淘宝（' + p + '），尝试返回：' + tag);
    safeBack('拉回淘宝');

    return pkgIsTaobao();
  } catch (e) {
    return true;
  }
}

// 等待某个条件出现，同时持续处理弹窗，避免遮挡
function waitForCondition(checkFn, timeoutMs, reason) {
  var t0 = now();
  var to = timeoutMs || 15000;

  logI('等待：' + (reason || '') + '，超时=' + to + 'ms');

  while (now() - t0 < to) {
    ensureTaobaoPackage('等待中');

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
        logI('✅ 等待完成：' + (reason || '') + '，耗时=' + (now() - t0) + 'ms');
        return true;
      }
    } catch (e1) {}

    safeSleep(250);
  }

  logW('⏰ 等待超时：' + (reason || '') + '，耗时=' + (now() - t0) + 'ms');
  return false;
}

// 找图点击：支持多张图路径按顺序尝试
function clickByAnyImage(imagePaths, threshold, reason) {
  threshold = threshold || 0.82;

  // 找图必须截图权限
  try {
    if (工具 && 工具.requestScreenIfNeeded) {
      if (!工具.requestScreenIfNeeded()) {
        logW('截图权限不可用，跳过找图：' + (reason || ''));
        return false;
      }
    }
  } catch (e0) {}

  if (!imagePaths || !imagePaths.length) return false;

  for (var i = 0; i < imagePaths.length; i++) {
    var pth = String(imagePaths[i]);

    try { if (!files.exists(pth)) continue; } catch (e1) {}

    var p = null;
    try { p = 工具.findImageSafe(pth, threshold); } catch (e2) { p = null; }

    if (p) {
      logI('✅ 找图命中：' + (reason || '') + ' -> ' + pth + ' @(' + p.x + ',' + p.y + ')');
      try { 工具.smartClick(p.x + 5, p.y + 5); }
      catch (e3) { try { press(p.x + 5, p.y + 5, 80); } catch (e4) {} }
      safeSleep(900);
      return true;
    }
  }

  logW('❌ 找图未命中：' + (reason || '') + '（已尝试 ' + imagePaths.length + ' 张）');
  return false;
}

// 找图“只判断存在”不点击（用于验签/判定）
function hasAnyImage(imagePaths, threshold) {
  threshold = threshold || 0.82;
  try {
    if (工具 && 工具.requestScreenIfNeeded) {
      if (!工具.requestScreenIfNeeded()) return false;
    }
  } catch (e0) {
    return false;
  }

  if (!imagePaths || !imagePaths.length) return false;

  for (var i = 0; i < imagePaths.length; i++) {
    var pth = String(imagePaths[i]);
    try { if (!files.exists(pth)) continue; } catch (e1) {}
    try {
      var p = 工具.findImageSafe(pth, threshold);
      if (p) return true;
    } catch (e2) {}
  }
  return false;
}

// 轻量上滑一次（最多调用 2 次，防止疯狂滑动）
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

// 收起任务列表/遮挡层（安全版：不默认 back，避免退出红包页）
function dismissPossibleSheetSoft(tag) {
  tag = tag || '面板';

  // 1) 先走统一弹窗处理
  try {
    if (弹窗 && 弹窗.处理全部弹窗 && 弹窗.处理全部弹窗()) {
      logI(tag + '：已处理通用弹窗');
      safeSleep(350);
      return true;
    }
  } catch (e0) {}

  // 2) 点上方空白（很多底部面板会被点空白收起）
  try {
    var x = parseInt(device.width * 0.5, 10);
    var y = parseInt(device.height * 0.18, 10);
    press(x, y, 60);
    safeSleep(450);
    logI(tag + '：点击空白尝试收起');
    return true;
  } catch (e1) {
    return false;
  }
}

// =============================================================================
// 3) 前置：无障碍、启动淘宝、回到首页
// =============================================================================
function ensureAccessibility() {
  try {
    auto.waitFor();
    logI('无障碍：✅ 已开启');
    return true;
  } catch (e) {
    logW('无障碍：❌ 可能未开启（系统设置->无障碍->AutoJs6 开启）');
    return false;
  }
}

function ensureTaobaoForeground() {
  var pkg = '';
  try { pkg = currentPackage(); } catch (e) {}

  if (pkg !== 配置.包名) {
    logI('启动淘宝...');
    try { 工具.launchTaobao(); }
    catch (e2) { try { app.launchPackage(配置.包名); } catch (e3) {} }
    safeSleep(1500);
  }
  return true;
}

function backToHome(maxBack) {
  maxBack = maxBack || 4;
  logI('回到首页：最多 back ' + maxBack + ' 次');

  for (var i = 0; i < maxBack; i++) {
    ensureTaobaoPackage('回首页');

    try { if (弹窗.处理全部弹窗()) safeSleep(300); } catch (e0) {}

    // 识别到首页入口任意一个就算到首页
    try {
      if (desc(配置.首页入口.领淘金币.desc).exists()
        || desc(配置.首页入口['88VIP'].desc).exists()
        || desc(配置.首页入口.红包签到.desc).exists()) {
        logI('✅ 已识别到淘宝首页');
        return true;
      }
    } catch (e1) {}

    safeBack('回首页(' + (i + 1) + '/' + maxBack + ')');
  }

  logW('❌ 回首页失败');
  return false;
}

function ensureHome() {
  ensureTaobaoForeground();
  if (backToHome(4)) return true;

  // 兜底：点底部首页 Tab
  logW('尝试点击底部「首页」Tab 兜底');
  try {
    if (工具.clickByDesc('首页', 800, '底部tab-首页') || 工具.clickByText('首页', 800, '底部tab-首页')) {
      safeSleep(1200);
    }
  } catch (e0) {}

  return backToHome(4);
}

// =============================================================================
// 4) 领淘金币签到
// =============================================================================
function flowCoinSign() {
  logI('=== 流程：领淘金币签到 ===');

  if (!ensureHome()) {
    logW('淘金币：回首页失败 -> 跳过');
    return false;
  }

  // 点击首页入口：领淘金币
  var ok = false;
  try {
    ok = 工具.clickByDescInArea(配置.首页入口.领淘金币.desc, 配置.首页入口.领淘金币.区域, 1200, '首页-领淘金币');
    if (!ok) ok = 工具.clickByDesc(配置.首页入口.领淘金币.desc, 800, '首页-领淘金币(全局)');
    if (!ok) ok = 工具.clickRatio(配置.首页入口.领淘金币.兜底点, '首页-领淘金币(兜底比例点)');
  } catch (e1) { ok = false; }

  if (!ok) {
    logW('淘金币：入口点击失败');
    return false;
  }

  safeSleep(1200);

  // 你新增的素材路径（验签兜底）
  var imgEarnMore = '淘宝素材/淘宝_领淘金币页面_赚更多金币/crop.png';

  // [Fix] 出现“赚更多金币”= 已签到，绝对不点它
  if (anyHasContains('赚更多金币') || hasAnyImage([imgEarnMore], 0.82)) {
    logI('淘金币：检测到【赚更多金币】= 已签到（不点击，避免弹任务列表）');
    safeBack('淘金币已签到');
    return true;
  }

  // 等待“点击签到”出现，或直接出现“赚更多金币”
  var ready = waitForCondition(function () {
    if (anyHasContains(配置.领淘金币页.点击签到.text)) return true;
    if (anyHasContains('赚更多金币')) return true;

    try {
      if (工具.requestScreenIfNeeded()) {
        if (工具.findImageSafe(配置.领淘金币页.点击签到.找图, 0.82)) return true;
        if (工具.findImageSafe(imgEarnMore, 0.82)) return true;
      }
    } catch (e0) {}

    return false;
  }, 22000, '领淘金币页面加载');

  if (!ready) {
    logW('淘金币：页面加载超时');
    safeBack('淘金币超时回退');
    return false;
  }

  if (anyHasContains('赚更多金币') || hasAnyImage([imgEarnMore], 0.82)) {
    logI('淘金币：验签通过（赚更多金币/已签到），不点击');
    safeBack('淘金币完成');
    return true;
  }

  // 点击“点击签到”（控件优先，找图兜底，再比例点）
  var clicked = false;
  try {
    var btn = textContains(配置.领淘金币页.点击签到.text).findOne(1200);
    if (!btn) btn = descContains(配置.领淘金币页.点击签到.text).findOne(1200);
    if (btn) clicked = 工具.clickUiObject(btn, '淘金币-点击签到(控件)');
  } catch (e2) {}

  if (!clicked) clicked = clickByAnyImage([配置.领淘金币页.点击签到.找图], 0.82, '淘金币-点击签到(找图)');
  if (!clicked) {
    try { clicked = 工具.clickRatio(配置.领淘金币页.点击签到.兜底点, '淘金币-点击签到(兜底比例点)'); } catch (e3) {}
  }

  if (!clicked) {
    logW('淘金币：未找到“点击签到”（可能已签到/文案变化）');
    safeBack('淘金币失败回退');
    return false;
  }

  logI('淘金币：已点击签到，等待变成“赚更多金币/已签到”');

  waitForCondition(function () {
    if (anyHasContains('赚更多金币')) return true;
    if (anyHasContains('已签到')) return true;
    if (anyHasContains('今日已签到')) return true;
    if (hasAnyImage([imgEarnMore], 0.82)) return true;
    return false;
  }, 12000, '淘金币验签');

  safeBack('淘金币流程结束');
  return true;
}

// =============================================================================
// 5) 88VIP 去签到
// =============================================================================
function flowVipSign() {
  logI('=== 流程：88VIP 去签到 ===');

  if (!ensureHome()) {
    logW('88VIP：回首页失败 -> 跳过');
    return false;
  }

  // 点击首页入口：88VIP
  var ok = false;
  try {
    ok = 工具.clickByDescInArea(配置.首页入口['88VIP'].desc, 配置.首页入口['88VIP'].区域, 1200, '首页-88VIP');
    if (!ok) ok = 工具.clickByDesc(配置.首页入口['88VIP'].desc, 800, '首页-88VIP(全局)');
    if (!ok) ok = 工具.clickRatio(配置.首页入口['88VIP'].兜底点, '首页-88VIP(兜底比例点)');
  } catch (e1) { ok = false; }

  if (!ok) {
    logW('88VIP：入口点击失败');
    return false;
  }

  safeSleep(1400);

  // 你新增的“明日领”素材路径（验签兜底）
  var imgTomorrow = '淘宝素材/淘宝_88VIP_每日签到_明日领/crop.png';

  // 已看到明日领 => 已签到
  if (anyHasContains('明日领') || hasAnyImage([imgTomorrow], 0.82)) {
    logI('88VIP：已是【明日领】= 已签到');
    safeBack('88VIP已签到');
    return true;
  }

  // 等待“去签到”出现（或直接出现明日领）
  var ready = waitForCondition(function () {
    if (anyHasContains(配置.VIP页.去签到.text)) return true;
    if (anyHasContains('明日领')) return true;
    if (hasAnyImage([imgTomorrow], 0.82)) return true;
    return false;
  }, 26000, '88VIP会员中心加载');

  if (!ready) {
    logW('88VIP：加载超时');
    safeBack('88VIP超时回退');
    return false;
  }

  if (anyHasContains('明日领') || hasAnyImage([imgTomorrow], 0.82)) {
    logI('88VIP：验签通过（明日领/已签到）');
    safeBack('88VIP完成');
    return true;
  }

  // 点击“去签到”
  var clicked = false;
  try {
    var btn = textContains(配置.VIP页.去签到.text).findOne(1200);
    if (!btn) btn = descContains(配置.VIP页.去签到.text).findOne(1200);
    if (btn) clicked = 工具.clickUiObject(btn, '88VIP-去签到(控件)');
  } catch (e2) {}

  if (!clicked) clicked = clickByAnyImage([配置.VIP页.去签到.找图], 0.82, '88VIP-去签到(找图)');
  if (!clicked) {
    try { clicked = 工具.clickRatio(配置.VIP页.去签到.兜底点, '88VIP-去签到(兜底比例点)'); } catch (e3) {}
  }

  if (!clicked) {
    logW('88VIP：未找到“去签到”（可能已签到/布局变化）');
    safeBack('88VIP失败回退');
    return false;
  }

  logI('88VIP：已点击去签到（不处理跳转页，直接返回会员中心验签）');
  safeSleep(1500);

  // 回到会员中心（最多 back 2 次）
  safeBack('88VIP跳转页回退(1)');
  safeSleep(1000);
  if (!anyHasContains('去签到') && !anyHasContains('明日领')) {
    safeBack('88VIP跳转页回退(2)');
    safeSleep(1000);
  }

  // 验签
  var okSigned = waitForCondition(function () {
    if (anyHasContains('明日领')) return true;
    if (anyHasContains('已签到')) return true;
    if (hasAnyImage([imgTomorrow], 0.82)) return true;
    return false;
  }, 14000, '88VIP验签（明日领）');

  if (okSigned) logI('88VIP：✅ 验签通过');
  else logW('88VIP：⚠️ 未看到明日领（可能没回到会员中心/网络慢）');

  safeBack('88VIP流程结束');
  return true;
}

// =============================================================================
// 6) 红包签到
// =============================================================================
// 红包签到流程你的“硬规则”是：
// - 第1次：立即签到；成功后变成“继续领钱/继续领取”（这就算成功），但绝对不点它（会弹任务列表）
// - 第2次：在红包签到主页面，入口就在“立即签到/继续领钱”下面 -> 点击“连续打卡”进入再点“点击签到”

var IMG_HB_CONTINUE_MONEY = '淘宝素材/淘宝_红包签到_继续领钱/crop.png';

var IMG_HB_CONTINUE_ENTRY = [
  '淘宝素材/淘宝_红包签到_连续打卡/crop.png',
  '淘宝素材/淘宝_红包签到_连续打卡2/crop.png',
  '淘宝素材/淘宝_红包签到_连续打卡3/crop.png'
];

function isHongbaoMainPage() {
  // 红包签到主页面“特征”判断：
  // 1) 文本/描述出现：立即签到 / 继续领钱 / 继续领取 / 连续打卡
  // 2) 或者 图片命中：继续领钱 / 连续打卡入口
  if (anyHasContains('立即签到')) return true;
  if (anyHasContains('继续领钱')) return true;
  if (anyHasContains('继续领取')) return true;
  if (anyHasContains('连续打卡')) return true;

  if (hasAnyImage([IMG_HB_CONTINUE_MONEY], 0.82)) return true;
  if (hasAnyImage(IMG_HB_CONTINUE_ENTRY, 0.82)) return true;

  return false;
}

function openHongbaoFromHome() {
  if (!ensureHome()) return false;

  logI('红包：从首页进入红包签到页');

  var ok = false;
  try {
    ok = 工具.clickByDescInArea(配置.首页入口.红包签到.desc, 配置.首页入口.红包签到.区域, 1200, '首页-红包签到');
    if (!ok) ok = 工具.clickByDesc(配置.首页入口.红包签到.desc, 800, '首页-红包签到(全局)');
    if (!ok) ok = 工具.clickRatio(配置.首页入口.红包签到.兜底点, '首页-红包签到(兜底比例点)');
  } catch (e1) { ok = false; }

  if (!ok) {
    logW('红包：入口点击失败');
    return false;
  }

  safeSleep(1500);

  // 等待红包签到主页面出现
  var ready = waitForCondition(function () {
    return isHongbaoMainPage();
  }, 22000, '进入红包签到主页面');

  if (!ready) {
    logW('红包：进入主页面超时（可能被弹窗/广告遮挡）');
    return false;
  }

  logI('红包：✅ 已进入红包签到主页面');
  return true;
}

function ensureInHongbaoMainPage(maxBack) {
  maxBack = maxBack || 3;

  if (isHongbaoMainPage()) return true;

  // 先尝试 back 回到红包主页面
  for (var i = 0; i < maxBack; i++) {
    safeBack('尝试回到红包主页面(' + (i + 1) + '/' + maxBack + ')');
    safeSleep(700);
    if (isHongbaoMainPage()) return true;
  }

  // 还不行：说明可能回到了首页/其它页，直接从首页重新进入
  logW('红包：不在主页面，准备从首页重新进入');
  return openHongbaoFromHome();
}

function isHongbaoFirstSigned() {
  // 第1次签到成功的判定：出现“继续领钱/继续领取” 或 继续领钱图片
  if (anyHasContains('继续领钱') || anyHasContains('继续领取')) return true;
  if (hasAnyImage([IMG_HB_CONTINUE_MONEY], 0.82)) return true;
  return false;
}

function clickHongbaoSignNow() {
  // 点击“立即签到”：控件优先，找图其次，最后才比例点
  var clicked = false;

  // 1) 控件文本/描述
  try {
    var btn = textContains('立即签到').findOne(800);
    if (!btn) btn = descContains('立即签到').findOne(800);
    if (btn) clicked = 工具.clickUiObject(btn, '红包-立即签到(控件)');
  } catch (e1) {}

  // 2) 找图
  if (!clicked) {
    clicked = clickByAnyImage([配置.红包签到页.立即签到.找图], 0.82, '红包-立即签到(找图)');
  }

  // 3) 比例点兜底（注意：这个点可能和“继续领钱”重叠，所以只有在确认不是继续领钱时才用）
  if (!clicked) {
    try { clicked = 工具.clickRatio(配置.红包签到页.立即签到.兜底点, '红包-立即签到(兜底比例点)'); }
    catch (e2) { clicked = false; }
  }

  return clicked;
}

function clickHongbaoContinueEntry() {
  // 点击“连续打卡入口”：控件文本优先，找图其次，最后比例点
  var clicked = false;

  // 1) 先按控件“连续打卡”点击（你说入口就在立即签到下面，控件文本一般存在）
  try {
    var btn = textContains('连续打卡').findOne(800);
    if (!btn) btn = descContains('连续打卡').findOne(800);
    if (btn) clicked = 工具.clickUiObject(btn, '红包-连续打卡入口(控件)');
  } catch (e1) {}

  // 2) 找图（三张素材）
  if (!clicked) {
    clicked = clickByAnyImage(IMG_HB_CONTINUE_ENTRY, 0.82, '红包-连续打卡入口(找图-多素材)');
  }

  // 3) 比例点兜底
  if (!clicked) {
    try { clicked = 工具.clickRatio(配置.红包签到页.连续打卡入口.兜底点, '红包-连续打卡入口(兜底比例点)'); }
    catch (e2) { clicked = false; }
  }

  return clicked;
}

function isContinuePage() {
  // 连续打卡页特征：出现“点击签到”
  if (anyHasContains(配置.红包签到页.连续打卡页_点击签到.text)) return true;
  try {
    if (工具.requestScreenIfNeeded()) {
      if (工具.findImageSafe(配置.红包签到页.连续打卡页_点击签到.找图, 0.82)) return true;
    }
  } catch (e0) {}
  return false;
}

function flowHongbaoSign() {
  logI('=== 流程：红包签到 ===');

  // 进入红包签到主页面
  if (!openHongbaoFromHome()) {
    logW('红包：无法进入红包签到页 -> 跳过');
    return false;
  }

  // ------------------- A) 第1次签到：立即签到 -------------------
  // 关键：如果已是“继续领钱/继续领取”，绝对不点它
  if (isHongbaoFirstSigned()) {
    logI('红包：检测到【继续领钱/继续领取】= 第1次已签到（不点击，避免弹任务列表）');
  } else {
    // 再确认一次（避免你说的“进来就立马点到了继续领钱”）
    // 如果你这时候其实已经是继续领钱，只是控件不是 text 而是 desc/图片，本判断也会兜底识别
    if (isHongbaoFirstSigned()) {
      logI('红包：识别到继续领钱（desc/图片命中）= 第1次已签到（不点击）');
    } else {
      var clicked = clickHongbaoSignNow();
      if (clicked) logI('红包：已点击「立即签到」（等待变成继续领钱/继续领取）');
      else logW('红包：未找到「立即签到」（可能已签到/布局变化）');

      waitForCondition(function () {
        return isHongbaoFirstSigned() || anyHasContains('已签到');
      }, 16000, '红包第1次验签（继续领钱/继续领取）');

      if (isHongbaoFirstSigned()) {
        logI('红包：✅ 第1次验签通过（继续领钱/继续领取出现）');
      } else {
        logW('红包：⚠️ 未看到继续领钱（可能网络慢/被弹窗遮挡）');
      }
    }
  }

  // 第1次完成后：收起可能弹出的任务列表/遮挡（安全版：不默认 back）
  dismissPossibleSheetSoft('红包');

  // 保险：确保还在红包签到主页面（如果不在，会自动从首页重新进入）
  if (!ensureInHongbaoMainPage(2)) {
    logW('红包：无法回到红包主页面 -> 跳过连续打卡');
    return false;
  }

  // ------------------- B) 第2次签到：连续打卡 -------------------
  // 策略：最多 2 轮尝试（每轮：收起遮挡 -> 点入口 -> 等进入）
  var entered = false;

  for (var round = 1; round <= 2; round++) {
    logI('红包：尝试进入「连续打卡」页（第 ' + round + '/2 轮）');

    // 每轮开始先收起遮挡
    dismissPossibleSheetSoft('红包');

    // 确保在红包主页面
    if (!ensureInHongbaoMainPage(1)) {
      logW('红包：不在主页面，已重新进入（继续尝试连续打卡）');
    }

    // 轻量上滑一次，把“连续打卡”入口滑出来（入口在下方）
    if (!anyHasContains('连续打卡') && !hasAnyImage(IMG_HB_CONTINUE_ENTRY, 0.82)) {
      logI('红包：未看到连续打卡入口，轻量上滑一次尝试露出');
      gentleSwipeUpOnce();
    }

    var go = clickHongbaoContinueEntry();
    if (!go) {
      logW('红包：连续打卡入口点击失败（将再试一轮）');
      continue;
    }

    // 等待进入连续打卡页
    entered = waitForCondition(function () {
      return isContinuePage();
    }, 22000, '进入连续打卡页');

    if (entered) break;

    logW('红包：未进入连续打卡页（可能被遮挡/误触/网络慢），准备下一轮');
  }

  if (!entered) {
    logW('红包：❌ 仍未进入连续打卡页（本轮结束）');
    // 尝试回退一下，避免停留在未知页面
    safeBack('红包结束回退(1)');
    safeBack('红包结束回退(2)');
    return false;
  }

  logI('红包：✅ 已进入连续打卡页');

  // 在连续打卡页：点击“点击签到”
  var signClicked = false;
  try {
    var btn2 = textContains(配置.红包签到页.连续打卡页_点击签到.text).findOne(1200);
    if (!btn2) btn2 = descContains(配置.红包签到页.连续打卡页_点击签到.text).findOne(1200);
    if (btn2) signClicked = 工具.clickUiObject(btn2, '连续打卡-点击签到(控件)');
  } catch (e4) {}

  if (!signClicked) signClicked = clickByAnyImage([配置.红包签到页.连续打卡页_点击签到.找图], 0.82, '连续打卡-点击签到(找图)');
  if (!signClicked) {
    try { signClicked = 工具.clickRatio(配置.红包签到页.连续打卡页_点击签到.兜底点, '连续打卡-点击签到(兜底比例点)'); }
    catch (e5) { signClicked = false; }
  }

  if (!signClicked) {
    logW('连续打卡：❌ 未找到“点击签到”（可能已签到/布局变化）');
  } else {
    logI('连续打卡：已点击签到，等待验签');

    waitForCondition(function () {
      // 常见验签：按钮消失 或 出现已签到/明日
      try {
        if (!textContains(配置.红包签到页.连续打卡页_点击签到.text).exists()) return true;
      } catch (e0) {}
      if (anyHasContains('已签到') || anyHasContains('明日') || anyHasContains('明天')) return true;
      return false;
    }, 16000, '连续打卡验签');
  }

  safeBack('连续打卡页回退');
  safeBack('红包签到页回退');
  return true;
}

// =============================================================================
// 7) 运行入口（被【TB】淘宝自动签到.js 调用）
// =============================================================================
function 运行() {
  var t0 = now();

  logI('脚本启动：淘宝自动签到');
  logI('提示：悬浮日志触摸穿透，不挡点击');

  ensureAccessibility();

  // 强杀淘宝（工具模块可能自己会打印“Root shell force-stop 成功”，这是正常的）
  try { 工具.forceStopTaobao(); } catch (e0) { logW('force-stop 异常'); }

  safeSleep(1000);

  ensureTaobaoForeground();

  // 截图权限（找图必须）
  try {
    if (工具.requestScreenIfNeeded && 工具.requestScreenIfNeeded()) logI('截图权限：✅ 可用（找图已启用）');
    else logW('截图权限：❌ 不可用（找图会失败，只能靠控件/比例点）');
  } catch (e1) {}

  try {
    flowCoinSign();
    try { 弹窗.处理全部弹窗(); } catch (e2) {}

    flowVipSign();
    try { 弹窗.处理全部弹窗(); } catch (e3) {}

    flowHongbaoSign();
    try { 弹窗.处理全部弹窗(); } catch (e4) {}

  } catch (e5) {
    logE('运行异常：' + e5);
  } finally {
    logI('全部流程结束，用时(ms)=' + (now() - t0));
    safeSleep(1500);
    try { 浮窗日志.close(); } catch (e6) {}
  }
}

module.exports = {
  运行: 运行
};
