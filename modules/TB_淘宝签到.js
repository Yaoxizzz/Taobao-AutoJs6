// modules/TB_淘宝签到.js
// =============================================================================
// 【TB】淘宝自动签到 - 主线模块（AutoJs6 / Rhino / ES5）
//
// 你这次报错：
//   语法错误(file: .../modules/TB_淘宝签到.js#49)
//
// 造成原因（小白版解释）：
//   你之前是“分段复制替换”，很容易漏掉大括号/括号/引号，
//   AutoJs6 的 Rhino 引擎一旦少一个符号，就会直接报“语法错误”。
//
// 这份文件是【完整可复制版】——你只需要：
//   1) 打开手机里：/脚本/Taobao-AutoJs6/modules/TB_淘宝签到.js
//   2) 全选覆盖成下面整份代码
//   3) 再运行：/脚本/Taobao-AutoJs6/【TB】淘宝自动签到.js
//
// 同时我把你要的“详细日志 + 悬浮日志”也做到这一份文件里（不依赖你改其它模块）。
//   ✅ AutoJs6 自带日志面板：会看到每一步成功/失败
//   ✅ 悬浮日志：前台显示、触摸穿透、不挡点击
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

  function _safe(fn) {
    try { return fn(); } catch (e) { return null; }
  }

  function _hasFloatyPermission() {
    if (typeof floaty === 'undefined') return false;
    if (typeof floaty.hasPermission === 'function') return floaty.hasPermission();
    // 老版本没有 hasPermission：交给创建时 try/catch
    return true;
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

    // 1) 权限检查
    if (!_hasFloatyPermission()) {
      console.warn('[TB] 悬浮窗权限未开启：悬浮日志不显示（不影响脚本运行）');
      _requestFloatyPermission();
      return false;
    }

    // 2) 创建触摸穿透悬浮窗
    try {
      win = floaty.rawWindow(
        <frame bg="#00000000">
          <vertical padding="10" bg="#AA000000">
            <text id="title" text="TB 运行日志" textColor="#FFD700" textSize="12sp" textStyle="bold"/>
            <text id="txt" text="启动..." textColor="#FFFFFF" textSize="10sp" maxLines="20"/>
          </vertical>
        </frame>
      );

      // 放左上角，尽量不挡主操作区（你想换位置就改下面两个比例）
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
        _safe(function () { win.txt.setText(lines.join('\n')); });
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
// - 你不要额外 log 文件：只输出到 AutoJs6 日志面板 + 悬浮日志
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

function safeSleep(ms) {
  try { sleep(ms); } catch (e) {}
}

function safeBack(reason) {
  logI('返回: ' + (reason || '')); 
  try { back(); } catch (e) {}
  safeSleep(700);
}

// “稳态等待”：等待某个条件出现，同时不断处理弹窗
function waitForCondition(checkFn, timeoutMs, reason) {
  var t0 = now();
  var to = timeoutMs || (配置.超时 && 配置.超时.找控件) || 15000;

  logI('等待: ' + (reason || '') + ' (超时=' + to + 'ms)');

  while (now() - t0 < to) {
    // 先处理弹窗（防遮挡/防误触）
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

  // 1) 先申请截图权限（找图必须）
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
    try {
      if (!files.exists(pth)) continue; // 路径不存在就跳过
    } catch (e0) {}

    var p = null;
    try {
      p = 工具.findImageSafe(pth, threshold);
    } catch (e1) {
      p = null;
    }

    if (p) {
      logI('✅ 找图命中: ' + (reason || '') + ' -> ' + pth + ' @(' + p.x + ',' + p.y + ')');
      try {
        工具.smartClick(p.x + 5, p.y + 5);
      } catch (e2) {
        try { press(p.x + 5, p.y + 5, 80); } catch (e3) {}
      }
      safeSleep(900);
      return true;
    }
  }

  logW('❌ 找图未命中: ' + (reason || '') + '（已尝试 ' + imagePaths.length + ' 张图）');
  return false;
}

// ========================= 3) 前置：无障碍、启动淘宝、回到首页 =========================
function ensureAccessibility() {
  try {
    auto.waitFor();
    logI('无障碍: ✅ 已开启');
    return true;
  } catch (e) {
    logW('无障碍: ❌ 可能未开启（请到 系统设置->无障碍->AutoJs6 开启）');
    return false;
  }
}

function ensureTaobaoForeground() {
  var pkg = '';
  try { pkg = currentPackage(); } catch (e) {}

  if (pkg !== 配置.包名) {
    logI('启动淘宝...');
    try {
      工具.launchTaobao();
    } catch (e2) {
      app.launchPackage(配置.包名);
    }
    safeSleep(1500);
  }
  return true;
}

function backToHome(maxBack) {
  maxBack = maxBack || 4;
  logI('回到淘宝首页：最多 back ' + maxBack + ' 次');

  for (var i = 0; i < maxBack; i++) {
    // 处理弹窗
    try { if (弹窗.处理全部弹窗()) safeSleep(300); } catch (e0) {}

    // 识别到首页入口任意一个，就认为到了首页
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

  // 先用 back 回首页
  if (backToHome(4)) return true;

  // 再尝试点底部「首页」tab（不同版本可能是 desc 或 text）
  logW('尝试点击底部「首页」Tab 兜底');
  try {
    if (工具.clickByDesc('首页', 800, '底部tab-首页') || 工具.clickByText('首页', 800, '底部tab-首页')) {
      safeSleep(1200);
    }
  } catch (e0) {}

  return backToHome(4);
}

// ========================= 4) 三个签到流程（详细日志 + 降级策略） =========================

// 4.1 领淘金币签到
function flowCoinSign() {
  logI('=== 流程：领淘金币签到 ===');

  if (!ensureHome()) {
    logW('领淘金币：回首页失败 -> 跳过');
    return false;
  }

  // 1) 点击首页入口：领淘金币
  var ok = false;
  try {
    ok = 工具.clickByDescInArea(配置.首页入口.领淘金币.desc, 配置.首页入口.领淘金币.区域, 1200, '首页-领淘金币');
    if (!ok) ok = 工具.clickByDesc(配置.首页入口.领淘金币.desc, 800, '首页-领淘金币(全局)');
    if (!ok) ok = 工具.clickRatio(配置.首页入口.领淘金币.兜底点, '首页-领淘金币(兜底比例点)');
  } catch (e1) {
    ok = false;
  }

  if (!ok) {
    logW('领淘金币入口：点击失败（可能入口文案/desc 变了，或首页没加载完）');
    return false;
  }

  safeSleep(1200);

  // 2) 等待并点击“点击签到”（优先控件，兜底找图）
  var stepReady = waitForCondition(function () {
    // 你配置里是 text: '点击签到'
    try {
      if (textContains(配置.领淘金币页.点击签到.text).exists()) return true;
      if (descContains(配置.领淘金币页.点击签到.text).exists()) return true;
    } catch (e0) {}

    // 找图也算准备好
    try {
      if (工具.requestScreenIfNeeded() && 工具.findImageSafe(配置.领淘金币页.点击签到.找图, 0.82)) return true;
    } catch (e1) {}

    return false;
  }, 15000, '领淘金币页加载');

  if (!stepReady) {
    logW('领淘金币页：加载超时 -> 回退');
    safeBack('领淘金币页超时回退');
    return false;
  }

  // 点击
  var clicked = false;
  try {
    var btn = textContains(配置.领淘金币页.点击签到.text).findOne(1000);
    if (!btn) btn = descContains(配置.领淘金币页.点击签到.text).findOne(1000);
    if (btn) {
      clicked = 工具.clickUiObject(btn, '领淘金币-点击签到(控件)');
    }
  } catch (e2) {}

  if (!clicked) {
    // 兜底：找图点击
    clicked = clickByAnyImage([配置.领淘金币页.点击签到.找图], 0.82, '领淘金币-点击签到(找图)');
  }

  if (!clicked) {
    // 兜底：比例点点击
    try {
      clicked = 工具.clickRatio(配置.领淘金币页.点击签到.兜底点, '领淘金币-点击签到(兜底比例点)');
    } catch (e3) {}
  }

  if (clicked) {
    logI('领淘金币：✅ 已执行点击签到（是否已签到以页面实际为准）');
  } else {
    logW('领淘金币：❌ 没找到“点击签到”按钮（可能已签到/文案变化/布局变化）');
  }

  safeSleep(1200);
  safeBack('领淘金币流程结束回首页');
  return true;
}

// 4.2 88VIP 去签到
function flowVipSign() {
  logI('=== 流程：88VIP 去签到 ===');

  if (!ensureHome()) {
    logW('88VIP：回首页失败 -> 跳过');
    return false;
  }

  // 1) 点击首页入口：88VIP
  var ok = false;
  try {
    ok = 工具.clickByDescInArea(配置.首页入口['88VIP'].desc, 配置.首页入口['88VIP'].区域, 1200, '首页-88VIP');
    if (!ok) ok = 工具.clickByDesc(配置.首页入口['88VIP'].desc, 800, '首页-88VIP(全局)');
    if (!ok) ok = 工具.clickRatio(配置.首页入口['88VIP'].兜底点, '首页-88VIP(兜底比例点)');
  } catch (e1) {
    ok = false;
  }

  if (!ok) {
    logW('88VIP入口：点击失败（可能入口文案/desc 变了，或首页没加载完）');
    return false;
  }

  safeSleep(1400);

  // 2) 等待并点击“去签到”（控件优先，找图兜底）
  var ready = waitForCondition(function () {
    try {
      if (textContains(配置.VIP页.去签到.text).exists()) return true;
      if (descContains(配置.VIP页.去签到.text).exists()) return true;
    } catch (e0) {}

    // 找图：你采集的 crop.png
    try {
      if (工具.requestScreenIfNeeded() && 工具.findImageSafe(配置.VIP页.去签到.找图, 0.82)) return true;
    } catch (e1) {}

    return false;
  }, 15000, '88VIP 页面加载');

  if (!ready) {
    logW('88VIP页：加载超时 -> 回退');
    safeBack('88VIP页超时回退');
    return false;
  }

  var clicked = false;
  try {
    var btn = textContains(配置.VIP页.去签到.text).findOne(1000);
    if (!btn) btn = descContains(配置.VIP页.去签到.text).findOne(1000);
    if (btn) clicked = 工具.clickUiObject(btn, '88VIP-去签到(控件)');
  } catch (e2) {}

  if (!clicked) {
    clicked = clickByAnyImage([配置.VIP页.去签到.找图], 0.82, '88VIP-去签到(找图)');
  }

  if (!clicked) {
    try {
      clicked = 工具.clickRatio(配置.VIP页.去签到.兜底点, '88VIP-去签到(兜底比例点)');
    } catch (e3) {}
  }

  if (clicked) {
    logI('88VIP：✅ 已执行去签到');
    safeSleep(1200);

    // 你提供了“每日签到”素材：这里做一次找图点击（如果出现）
    var dailyClicked = clickByAnyImage([配置.VIP页.每日签到找图], 0.82, '88VIP-每日签到(找图)');
    if (!dailyClicked) {
      // 兜底点点击
      try {
        工具.clickRatio(配置.VIP页.每日签到兜底点, '88VIP-每日签到(兜底比例点)');
      } catch (e4) {}
    }
  } else {
    logW('88VIP：❌ 没找到“去签到”按钮（可能已签到/文案变化/布局变化）');
  }

  safeSleep(1200);
  safeBack('88VIP流程结束回首页');
  return true;
}

// 4.3 红包签到（立即签到 -> 连续打卡 -> 点击签到）
function flowHongbaoSign() {
  logI('=== 流程：红包签到 ===');

  if (!ensureHome()) {
    logW('红包签到：回首页失败 -> 跳过');
    return false;
  }

  // 1) 点击首页入口：红包签到
  var ok = false;
  try {
    ok = 工具.clickByDescInArea(配置.首页入口.红包签到.desc, 配置.首页入口.红包签到.区域, 1200, '首页-红包签到');
    if (!ok) ok = 工具.clickByDesc(配置.首页入口.红包签到.desc, 800, '首页-红包签到(全局)');
    if (!ok) ok = 工具.clickRatio(配置.首页入口.红包签到.兜底点, '首页-红包签到(兜底比例点)');
  } catch (e1) {
    ok = false;
  }

  if (!ok) {
    logW('红包签到入口：点击失败（可能入口文案/desc 变了，或首页没加载完）');
    return false;
  }

  safeSleep(1500);

  // 2) 点击“立即签到”（你提供了找图）
  var clicked = clickByAnyImage([配置.红包签到页.立即签到.找图], 0.82, '红包签到-立即签到');
  if (!clicked) {
    // 兜底比例点
    try {
      clicked = 工具.clickRatio(配置.红包签到页.立即签到.兜底点, '红包签到-立即签到(兜底比例点)');
    } catch (e2) {}
  }

  if (clicked) logI('红包签到：✅ 已执行立即签到');
  else logW('红包签到：⚠️ 未命中“立即签到”（可能已签到或按钮样式变化）');

  safeSleep(1200);

  // 3) 进入“连续打卡”页面
  // 你补充说明：连续打卡有 3 张素材，但进入的是同一个页面，只是为了提高命中率。
  var 连续打卡素材 = [
    配置.红包签到页.连续打卡入口.找图,
    '淘宝素材/淘宝_红包签到_连续打卡2/crop.png',
    '淘宝素材/淘宝_红包签到_连续打卡3/crop.png'
  ];

  var goContinue = clickByAnyImage(连续打卡素材, 0.82, '红包签到-连续打卡入口(多素材兜底)');
  if (!goContinue) {
    // 兜底比例点
    try {
      goContinue = 工具.clickRatio(配置.红包签到页.连续打卡入口.兜底点, '红包签到-连续打卡入口(兜底比例点)');
    } catch (e3) {}
  }

  if (!goContinue) {
    logW('红包签到：❌ 未进入连续打卡页（可能入口不在当前屏或被广告遮挡）');
    safeBack('红包签到流程回退');
    return false;
  }

  safeSleep(1500);

  // 4) 连续打卡页：点击签到（控件优先，找图兜底）
  var ready = waitForCondition(function () {
    try {
      if (textContains(配置.红包签到页.连续打卡页_点击签到.text).exists()) return true;
      if (descContains(配置.红包签到页.连续打卡页_点击签到.text).exists()) return true;
    } catch (e0) {}

    try {
      if (工具.requestScreenIfNeeded() && 工具.findImageSafe(配置.红包签到页.连续打卡页_点击签到.找图, 0.82)) return true;
    } catch (e1) {}

    return false;
  }, 15000, '连续打卡页加载');

  if (!ready) {
    logW('连续打卡页：加载超时 -> 回退');
    safeBack('连续打卡页超时回退');
    safeBack('返回红包签到页');
    return false;
  }

  var signClicked = false;
  try {
    var btn = textContains(配置.红包签到页.连续打卡页_点击签到.text).findOne(1000);
    if (!btn) btn = descContains(配置.红包签到页.连续打卡页_点击签到.text).findOne(1000);
    if (btn) signClicked = 工具.clickUiObject(btn, '连续打卡-点击签到(控件)');
  } catch (e4) {}

  if (!signClicked) {
    signClicked = clickByAnyImage([配置.红包签到页.连续打卡页_点击签到.找图], 0.82, '连续打卡-点击签到(找图)');
  }

  if (!signClicked) {
    try {
      signClicked = 工具.clickRatio(配置.红包签到页.连续打卡页_点击签到.兜底点, '连续打卡-点击签到(兜底比例点)');
    } catch (e5) {}
  }

  if (signClicked) logI('连续打卡：✅ 已执行点击签到');
  else logW('连续打卡：❌ 没找到“点击签到”（可能已签到/文案变化/布局变化）');

  safeSleep(1200);
  safeBack('连续打卡页回退');
  safeBack('红包签到页回退');
  return true;
}

// ========================= 5) 运行入口（被【TB】淘宝自动签到.js 调用） =========================
function 运行() {
  var t0 = now();

  logI('脚本启动：淘宝自动签到');
  logI('提示：悬浮日志不挡点击；如果没显示，请先开 AutoJs6 悬浮窗权限');

  ensureAccessibility();

  // 你之前日志里有 Root 强杀，这里继续保留
  try {
    var killed = 工具.forceStopTaobao();
    if (killed) logI('Root shell force-stop 成功');
    else logW('force-stop 可能失败（没 root / shizuku）');
  } catch (e0) {
    logW('force-stop 异常：' + e0);
  }

  safeSleep(1000);

  ensureTaobaoForeground();

  // 找图需要截图权限：先申请一次（失败也不影响纯控件点击）
  try {
    if (工具.requestScreenIfNeeded()) logI('截图权限：✅ 可用（找图功能已启用）');
    else logW('截图权限：❌ 不可用（找图将跳过，仅用控件/坐标兜底）');
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
