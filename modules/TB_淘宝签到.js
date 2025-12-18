// modules/TB_淘宝签到.js
// =============================================================================
// 【TB】淘宝自动签到 - 主线模块（AutoJs6 / Rhino / ES5）
//
// 你提供的最新日志里：
// ✅ 领淘金币：已能点到“点击签到”
// ✅ 88VIP：已能点到“去签到”，但你强调“不需要处理每日签到页”，只要回到会员中心确认变成“明日领”即可
// ❌ 红包签到：被“继续领钱”弹出的列表影响，导致无法进入“连续打卡”页面
//
// 本次修改点（只改这个文件）：
// [Fix] 淘金币：识别“赚更多金币”=已签到，不再误触任务列表
// [Fix] 88VIP：点击“去签到”后只做“回退+验签(明日领)”，不再找“每日签到”图片
// [Fix] 红包签到：识别“继续领钱/继续领取”=已签到，不再点击它；先关掉可能遮挡的任务列表，再进连续打卡
// [Enhance] 红包连续打卡：加入“多次尝试 + 轻量滑动 + 更长等待 + 失败回退”防抖
// [Enhance] 去重日志：避免你看到 force-stop/启动淘宝重复两次的困惑
// =============================================================================

'use strict';

var 配置 = require('./TB_配置');
var 工具 = require('./TB_工具');
var 弹窗 = require('./TB_弹窗处理');

// ========================= 0) 悬浮日志（不挡点击） =========================
// 说明：
// - 你要求“悬浮窗在前台显示，但不能遮挡点击”
// - 这里用 floaty.rawWindow + setTouchable(false) 实现【触摸穿透】
// - 即使悬浮窗没权限/创建失败，也不会影响脚本运行（只是不显示悬浮日志）
var 浮窗日志 = (function () {
  var win = null;
  var inited = false;
  var enabled = true; // 你不想要悬浮窗的话：这里改成 false
  var lines = [];
  var maxLines = 12;

  function _timeStr() {
    var d = new Date();
    var hh = ('0' + d.getHours()).slice(-2);
    var mm = ('0' + d.getMinutes()).slice(-2);
    var ss = ('0' + d.getSeconds()).slice(-2);
    return hh + ':' + mm + ':' + ss;
  }

  function _safe(fn) { try { return fn(); } catch (e) { return null; } }

  function _hasFloatyPermission() {
    if (typeof floaty === 'undefined') return false;
    if (typeof floaty.hasPermission === 'function') return floaty.hasPermission();
    return true; // 老版本交给创建时 try/catch
  }

  function _requestFloatyPermission() {
    if (typeof floaty === 'undefined') return;
    if (typeof floaty.requestPermission === 'function') {
      toast('请先开启 AutoJs6 悬浮窗权限，然后重新运行脚本');
      floaty.requestPermission();
    } else {
      toast('请在系统设置中手动开启 AutoJs6 悬浮窗权限');
    }
  }

  function _ensure() {
    if (inited) return !!win;
    inited = true;

    if (!enabled) return false;

    if (!_hasFloatyPermission()) {
      console.warn('[TB] 悬浮窗权限未开启：悬浮日志不显示（不影响脚本运行）');
      _requestFloatyPermission();
      return false;
    }

    try {
      win = floaty.rawWindow(
        <frame bg="#00000000">
          <vertical padding="10" bg="#AA000000">
            <text text="TB 运行日志" textColor="#FFD700" textSize="12sp" textStyle="bold"/>
            <text id="txt" text="启动..." textColor="#FFFFFF" textSize="10sp" maxLines="20"/>
          </vertical>
        </frame>
      );

      // 放左上角，尽量不挡操作区
      var x = parseInt(device.width * 0.03, 10);
      var y = parseInt(device.height * 0.12, 10);
      win.setPosition(x, y);

      // ✅ 关键：不挡点击（触摸穿透）
      if (typeof win.setTouchable === 'function') win.setTouchable(false);

      lines = [];
      _write('I', '悬浮日志启动（不挡点击）');
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

// ========================= 1) 统一日志输出 =========================
// 说明：
// - 不写 log 文件：只输出到 AutoJs6 日志面板 + 悬浮日志
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

// ========================= 2) 通用小工具 =========================
function now() { return new Date().getTime(); }

function safeSleep(ms) { try { sleep(ms); } catch (e) {} }

function safeBack(reason) {
  logI('返回: ' + (reason || ''));
  try { back(); } catch (e) {}
  safeSleep(700);
}

function textExistsExact(t) {
  try { return text(String(t)).exists(); } catch (e) { return false; }
}

function textExistsContains(t) {
  try { return textContains(String(t)).exists(); } catch (e) { return false; }
}

function waitForCondition(checkFn, timeoutMs, reason) {
  var t0 = now();
  var to = timeoutMs || (配置.超时 && 配置.超时.找控件) || 15000;

  logI('等待: ' + (reason || '') + ' (超时=' + to + 'ms)');

  while (now() - t0 < to) {
    // 先处理弹窗（防遮挡）
    try {
      if (弹窗 && 弹窗.处理全部弹窗 && 弹窗.处理全部弹窗()) {
        safeSleep(350);
        continue;
      }
    } catch (e0) {}

    // 再检查条件
    try {
      if (checkFn()) {
        logI('✅ 等待完成: ' + (reason || '') + ' (用时=' + (now() - t0) + 'ms)');
        return true;
      }
    } catch (e1) {}

    safeSleep(250);
  }

  logW('⏰ 等待超时: ' + (reason || '') + ' (用时=' + (now() - t0) + 'ms)');
  return false;
}

// 找图点击：支持给多个图片路径（会按顺序尝试）
function clickByAnyImage(imagePaths, threshold, reason) {
  threshold = threshold || 0.82;

  // 找图必须截图权限
  if (工具 && 工具.requestScreenIfNeeded) {
    var okCap = 工具.requestScreenIfNeeded();
    if (!okCap) {
      logW('截图权限申请失败：找图不可用 -> ' + (reason || ''));
      return false;
    }
  }

  if (!imagePaths || !imagePaths.length) return false;

  for (var i = 0; i < imagePaths.length; i++) {
    var pth = String(imagePaths[i]);
    try { if (!files.exists(pth)) continue; } catch (e0) {}

    var p = null;
    try { p = 工具.findImageSafe(pth, threshold); } catch (e1) { p = null; }

    if (p) {
      logI('✅ 找图命中: ' + (reason || '') + ' -> ' + pth + ' @(' + p.x + ',' + p.y + ')');
      try { 工具.smartClick(p.x + 5, p.y + 5); }
      catch (e2) { try { press(p.x + 5, p.y + 5, 80); } catch (e3) {} }
      safeSleep(900);
      return true;
    }
  }

  logW('❌ 找图未命中: ' + (reason || '') + '（已尝试 ' + imagePaths.length + ' 张图）');
  return false;
}

// 轻量滑动：用于把“连续打卡”入口滑出来（避免你说的“控件识别不到就疯狂滑动”）
function gentleSwipeUpOnce() {
  try {
    var x = parseInt(device.width * 0.5, 10);
    var y1 = parseInt(device.height * 0.72, 10);
    var y2 = parseInt(device.height * 0.50, 10);
    swipe(x, y1, x, y2, 380);
    safeSleep(700);
    return true;
  } catch (e) {
    return false;
  }
}

// ========================= 3) 前置：无障碍、启动淘宝、回到首页 =========================
function ensureAccessibility() {
  try {
    auto.waitFor();
    logI('无障碍: ✅ 已开启');
    return true;
  } catch (e) {
    logW('无障碍: ❌ 可能未开启（系统设置->无障碍->AutoJs6 开启）');
    return false;
  }
}

function ensureTaobaoForeground() {
  var pkg = '';
  try { pkg = currentPackage(); } catch (e) {}

  if (pkg !== 配置.包名) {
    logI('准备启动淘宝（如果你看到两条“启动淘宝”，说明工具模块也在打日志，这是正常的）');
    try { 工具.launchTaobao(); }
    catch (e2) { try { app.launchPackage(配置.包名); } catch (e3) {} }
    safeSleep(1500);
  }
  return true;
}

function backToHome(maxBack) {
  maxBack = maxBack || 4;
  logI('回到淘宝首页：最多 back ' + maxBack + ' 次');

  for (var i = 0; i < maxBack; i++) {
    try { if (弹窗.处理全部弹窗()) safeSleep(300); } catch (e0) {}

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

  logW('❌ 回到首页失败：可能在活动页/广告页/直播页');
  return false;
}

function ensureHome() {
  ensureTaobaoForeground();
  if (backToHome(4)) return true;

  logW('尝试点击底部「首页」Tab 兜底');
  try {
    if (工具.clickByDesc('首页', 800, '底部tab-首页') || 工具.clickByText('首页', 800, '底部tab-首页')) {
      safeSleep(1200);
    }
  } catch (e0) {}

  return backToHome(4);
}

// ========================= 4) 领淘金币签到 =========================
function flowCoinSign() {
  logI('=== 流程：领淘金币签到 ===');

  if (!ensureHome()) {
    logW('领淘金币：回首页失败 -> 跳过');
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
    logW('领淘金币入口：点击失败（可能入口文案/desc 变了，或首页没加载完）');
    return false;
  }

  safeSleep(1200);

  // [Fix] 你强调：签到后“点击签到”会变成“赚更多金币”，点击它会弹任务列表（下一阶段再做）
  // 所以：
  // - 如果页面已经出现“赚更多金币”，我们认为“当前已签到”，直接回退，不点它。
  if (textExistsExact('赚更多金币') || textExistsContains('赚更多金币')) {
    logI('淘金币：检测到【赚更多金币】= 已签到（不点击，避免弹出任务列表）');
    safeBack('淘金币已签到回首页');
    return true;
  }

  // 等待并点击“点击签到”（控件优先，找图兜底）
  var stepReady = waitForCondition(function () {
    try {
      if (textContains(配置.领淘金币页.点击签到.text).exists()) return true;
      if (descContains(配置.领淘金币页.点击签到.text).exists()) return true;
    } catch (e0) {}

    // 找图也算准备好
    try {
      if (工具.requestScreenIfNeeded() && 工具.findImageSafe(配置.领淘金币页.点击签到.找图, 0.82)) return true;
    } catch (e1) {}

    // 兜底：如果突然变成“赚更多金币”，也算已完成
    if (textExistsContains('赚更多金币')) return true;

    return false;
  }, 20000, '领淘金币页加载');

  if (!stepReady) {
    logW('领淘金币页：加载超时 -> 回退');
    safeBack('领淘金币页超时回退');
    return false;
  }

  // 如果等到的是“赚更多金币”，直接认为已签到
  if (textExistsContains('赚更多金币')) {
    logI('淘金币：页面出现【赚更多金币】= 已签到（不点击）');
    safeBack('淘金币已签到回首页');
    return true;
  }

  // 点击“点击签到”
  var clicked = false;
  try {
    var btn = textContains(配置.领淘金币页.点击签到.text).findOne(1200);
    if (!btn) btn = descContains(配置.领淘金币页.点击签到.text).findOne(1200);
    if (btn) clicked = 工具.clickUiObject(btn, '淘金币-点击签到(控件)');
  } catch (e2) {}

  if (!clicked) clicked = clickByAnyImage([配置.领淘金币页.点击签到.找图], 0.82, '淘金币-点击签到(找图)');

  if (!clicked) {
    try { clicked = 工具.clickRatio(配置.领淘金币页.点击签到.兜底点, '淘金币-点击签到(兜底比例点)'); }
    catch (e3) {}
  }

  if (!clicked) {
    logW('淘金币：❌ 没找到“点击签到”（可能已签到/文案变化/布局变化）');
    safeBack('淘金币失败回退');
    return false;
  }

  logI('淘金币：✅ 已点击签到（等待按钮变化确认）');

  // [Enhance] 等待它变成“赚更多金币”（不点它）
  waitForCondition(function () {
    return textExistsContains('赚更多金币') || textExistsContains('今日已签到') || textExistsContains('已签到');
  }, 10000, '淘金币验签（赚更多金币/已签到）');

  safeBack('淘金币流程结束回首页');
  return true;
}

// ========================= 5) 88VIP 去签到 =========================
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
    logW('88VIP入口：点击失败（可能入口文案/desc 变了，或首页没加载完）');
    return false;
  }

  safeSleep(1400);

  // [Fix] 你强调：在 88VIP 会员中心，签完“去签到”会变成“明日领”。
  //       点击“去签到”会跳到另一个页面，但那个页面“不需要管”。
  //       所以：我们只做“回到会员中心 -> 看有没有明日领”。

  // 如果已经存在“明日领”，直接认为已签到
  if (textExistsExact('明日领') || textExistsContains('明日领')) {
    logI('88VIP：检测到【明日领】= 已签到（不再点去签到）');
    safeBack('88VIP已签到回首页');
    return true;
  }

  // 等待“去签到”出现
  var ready = waitForCondition(function () {
    try {
      if (textContains(配置.VIP页.去签到.text).exists()) return true;
      if (descContains(配置.VIP页.去签到.text).exists()) return true;
    } catch (e0) {}

    // 兜底：如果直接出现“明日领”，也算完成
    if (textExistsContains('明日领')) return true;

    return false;
  }, 25000, '88VIP 会员中心加载');

  if (!ready) {
    logW('88VIP会员中心：加载超时 -> 回退');
    safeBack('88VIP超时回退');
    return false;
  }

  if (textExistsContains('明日领')) {
    logI('88VIP：会员中心已是【明日领】= 已签到');
    safeBack('88VIP已签到回首页');
    return true;
  }

  // 点击“去签到”
  var clicked = false;
  try {
    var btn = textContains(配置.VIP页.去签到.text).findOne(1200);
    if (!btn) btn = descContains(配置.VIP页.去签到.text).findOne(1200);
    if (btn) clicked = 工具.clickUiObject(btn, '88VIP-去签到(控件)');
  } catch (e2) {}

  if (!clicked) {
    clicked = clickByAnyImage([配置.VIP页.去签到.找图], 0.82, '88VIP-去签到(找图)');
  }

  if (!clicked) {
    try { clicked = 工具.clickRatio(配置.VIP页.去签到.兜底点, '88VIP-去签到(兜底比例点)'); }
    catch (e3) {}
  }

  if (!clicked) {
    logW('88VIP：❌ 没找到“去签到”（可能已签到/文案变化/布局变化）');
    safeBack('88VIP失败回退');
    return false;
  }

  logI('88VIP：✅ 已点击去签到（不处理跳转页，直接回退验签）');
  safeSleep(1500);

  // 回退到会员中心（通常 1 次就够；不够再来 1 次）
  safeBack('88VIP跳转页回退(1)');
  safeSleep(1200);

  if (!(textExistsContains('去签到') || textExistsContains('明日领'))) {
    safeBack('88VIP跳转页回退(2)');
    safeSleep(1200);
  }

  // 验签：明日领
  var okSigned = waitForCondition(function () {
    return textExistsContains('明日领') || textExistsContains('已签到') || textExistsContains('明天再来');
  }, 12000, '88VIP验签（明日领）');

  if (okSigned) {
    logI('88VIP：✅ 验签通过（明日领/已签到）');
  } else {
    logW('88VIP：⚠️ 未看到【明日领】（可能页面结构变了/网络慢/回退没回到会员中心）');
  }

  safeBack('88VIP流程结束回首页');
  return true;
}

// ========================= 6) 红包签到 =========================
// 关键点：
// - 第一个签到：立即签到；成功后可能变成“继续领钱/继续领取”
// - 第二个签到：进入“连续打卡”页面，点“点击签到”
// - 你说失败原因：误点/弹出“继续领钱”的任务列表遮挡了连续打卡入口
// 解决策略：
// [Fix] 先识别“继续领钱/继续领取”= 已完成第一个签到，坚决不点击它
// [Fix] 如果任务列表/底部面板弹出，先尝试“点空白/处理弹窗/back 一次”关闭遮挡
function dismissPossibleTaskSheet(tag) {
  // 这个函数不求100%准确，只做“轻量尝试”，避免你说的“疯狂横跳/疯狂滑动”
  // 尝试顺序：
  //  1) 通用弹窗处理
  //  2) 点屏幕上方空白（很多底部面板会被点空白收起）
  //  3) back 一次（如果只是面板，back 会收起；如果直接退出页面，后面还有 ensureHome 兜底）
  try { if (弹窗.处理全部弹窗()) { logI(tag + ': 已处理通用弹窗'); return true; } } catch (e0) {}

  try {
    var x = parseInt(device.width * 0.50, 10);
    var y = parseInt(device.height * 0.18, 10);
    press(x, y, 60);
    safeSleep(600);
    logI(tag + ': 尝试点击空白收起面板');
  } catch (e1) {}

  try {
    back();
    safeSleep(700);
    logI(tag + ': 尝试 back 收起面板');
    return true;
  } catch (e2) {
    return false;
  }
}

function flowHongbaoSign() {
  logI('=== 流程：红包签到 ===');

  if (!ensureHome()) {
    logW('红包签到：回首页失败 -> 跳过');
    return false;
  }

  // 点击首页入口：红包签到
  var ok = false;
  try {
    ok = 工具.clickByDescInArea(配置.首页入口.红包签到.desc, 配置.首页入口.红包签到.区域, 1200, '首页-红包签到');
    if (!ok) ok = 工具.clickByDesc(配置.首页入口.红包签到.desc, 800, '首页-红包签到(全局)');
    if (!ok) ok = 工具.clickRatio(配置.首页入口.红包签到.兜底点, '首页-红包签到(兜底比例点)');
  } catch (e1) { ok = false; }

  if (!ok) {
    logW('红包签到入口：点击失败（可能入口文案/desc 变了，或首页没加载完）');
    return false;
  }

  safeSleep(1500);

  // ------------------- A) 第一个签到：立即签到 -------------------
  // [Fix] 如果已经出现“继续领钱/继续领取”，说明第一个签到已完成，不要点击它（会弹任务列表）
  if (textExistsContains('继续领钱') || textExistsContains('继续领取')) {
    logI('红包签到：检测到【继续领钱/继续领取】= 已完成第1次签到（不点击，避免任务列表）');
  } else {
    // 正常情况下点击“立即签到”
    var clicked = clickByAnyImage([配置.红包签到页.立即签到.找图], 0.82, '红包签到-立即签到(找图)');
    if (!clicked) {
      try { clicked = 工具.clickRatio(配置.红包签到页.立即签到.兜底点, '红包签到-立即签到(兜底比例点)'); }
      catch (e2) {}
    }

    if (clicked) logI('红包签到：✅ 已尝试点击立即签到（等待按钮变化确认）');
    else logW('红包签到：⚠️ 未命中“立即签到”（可能已签到或按钮样式变化）');

    // 等待它变成“继续领钱/继续领取”（不点）
    waitForCondition(function () {
      return textExistsContains('继续领钱') || textExistsContains('继续领取') || textExistsContains('已签到');
    }, 12000, '红包第1次验签（继续领钱/继续领取）');
  }

  // 如果误点导致面板弹出，先尝试关闭遮挡
  dismissPossibleTaskSheet('红包签到');

  // ------------------- B) 第二个签到：连续打卡 -------------------
  // 你提供了 3 张“连续打卡入口”素材，进入同一页面，只是提高命中率。
  var 连续打卡素材 = [
    配置.红包签到页.连续打卡入口.找图,
    '淘宝素材/淘宝_红包签到_连续打卡2/crop.png',
    '淘宝素材/淘宝_红包签到_连续打卡3/crop.png'
  ];

  // 尝试进入连续打卡：最多 2 轮（每轮：找图/兜底点/滑动一次）
  var entered = false;
  for (var round = 1; round <= 2; round++) {
    logI('红包签到：尝试进入连续打卡（第 ' + round + '/2 轮）');

    // 1) 优先找图
    var goContinue = clickByAnyImage(连续打卡素材, 0.82, '红包-连续打卡入口(多素材)');

    // 2) 兜底比例点
    if (!goContinue) {
      try { goContinue = 工具.clickRatio(配置.红包签到页.连续打卡入口.兜底点, '红包-连续打卡入口(兜底比例点)'); }
      catch (e3) { goContinue = false; }
    }

    safeSleep(1300);

    // 3) 验证是否进入连续打卡页：出现“点击签到”或对应找图
    entered = waitForCondition(function () {
      try {
        if (textContains(配置.红包签到页.连续打卡页_点击签到.text).exists()) return true;
        if (descContains(配置.红包签到页.连续打卡页_点击签到.text).exists()) return true;
      } catch (e0) {}

      try {
        if (工具.requestScreenIfNeeded() && 工具.findImageSafe(配置.红包签到页.连续打卡页_点击签到.找图, 0.82)) return true;
      } catch (e1) {}

      return false;
    }, 22000, '连续打卡页加载');

    if (entered) break;

    // 还没进：说明可能入口在屏外/被遮挡 -> 轻量滑动一次再试
    logW('连续打卡：未进入（可能入口被遮挡/在屏外），将轻量上滑一次再试');
    gentleSwipeUpOnce();

    // 关闭可能弹出的面板
    dismissPossibleTaskSheet('红包签到');
  }

  if (!entered) {
    logW('红包签到：❌ 仍未进入连续打卡页（本轮结束，回退）');
    safeBack('红包签到回退(1)');
    safeBack('红包签到回退(2)');
    return false;
  }

  // 在连续打卡页：点击“点击签到”（控件优先，找图兜底）
  var signClicked = false;
  try {
    var btn = textContains(配置.红包签到页.连续打卡页_点击签到.text).findOne(1200);
    if (!btn) btn = descContains(配置.红包签到页.连续打卡页_点击签到.text).findOne(1200);
    if (btn) signClicked = 工具.clickUiObject(btn, '连续打卡-点击签到(控件)');
  } catch (e4) {}

  if (!signClicked) {
    signClicked = clickByAnyImage([配置.红包签到页.连续打卡页_点击签到.找图], 0.82, '连续打卡-点击签到(找图)');
  }

  if (!signClicked) {
    try { signClicked = 工具.clickRatio(配置.红包签到页.连续打卡页_点击签到.兜底点, '连续打卡-点击签到(兜底比例点)'); }
    catch (e5) { signClicked = false; }
  }

  if (signClicked) {
    logI('连续打卡：✅ 已执行点击签到（等待状态变化确认）');

    // 验签：常见变化（你后续如果提供“已签到/明日再来”等控件，我再加更准的判断）
    waitForCondition(function () {
      // 1) 按钮消失/不可点
      try {
        if (!textContains(配置.红包签到页.连续打卡页_点击签到.text).exists()) return true;
      } catch (e0) {}
      // 2) 出现“已签到/明天再来”等
      return textExistsContains('已签到') || textExistsContains('明天') || textExistsContains('明日');
    }, 12000, '连续打卡验签（按钮消失/已签到）');

  } else {
    logW('连续打卡：❌ 没找到“点击签到”（可能已签到/文案变化/布局变化）');
  }

  safeSleep(1200);
  safeBack('连续打卡页回退');
  safeBack('红包签到页回退');
  return true;
}

// ========================= 7) 运行入口（被【TB】淘宝自动签到.js 调用） =========================
function 运行() {
  var t0 = now();

  logI('脚本启动：淘宝自动签到');
  logI('提示：悬浮日志不挡点击；如果没显示，请先开 AutoJs6 悬浮窗权限');

  ensureAccessibility();

  // 强杀淘宝（如果工具模块也会输出日志，属于正常）
  try { 工具.forceStopTaobao(); } catch (e0) { logW('force-stop 异常：' + e0); }

  safeSleep(1000);

  ensureTaobaoForeground();

  // 找图需要截图权限：先申请一次（失败也不影响纯控件点击）
  try {
    if (工具.requestScreenIfNeeded()) logI('截图权限：✅ 可用（找图功能已启用）');
    else logW('截图权限：❌ 不可用（找图将跳过，仅用控件/比例点兜底）');
  } catch (e1) {}

  // 主线三流程
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
    var cost = now() - t0;
    logI('全部流程结束，用时(ms)=' + cost);

    // 给你留一点时间看悬浮日志（避免你以为没动就手动关）
    safeSleep(1500);

    try { 浮窗日志.close(); } catch (e6) {}
  }
}

module.exports = {
  运行: 运行
};
