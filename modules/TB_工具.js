// modules/TB_工具.js

var 配置 = require('./TB_配置');

function now() { return new Date().getTime(); }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function sleepRand(base, jitter) { sleep(base + randInt(0, jitter || 200)); }
// 悬浮日志模块（懒加载，避免循环依赖）
var 悬浮日志 = null;


function _获取悬浮日志模块() {
if (悬浮日志 === null) {
try { 悬浮日志 = require('./TB_悬浮日志'); }
catch (e) { 悬浮日志 = false; }
}
return 悬浮日志;
}


function _写悬浮日志(level, msg) {
var L = _获取悬浮日志模块();
if (L && typeof L.写 === 'function') {
try { L.写(level, msg); } catch (e) {}
}
}


function logi(msg) {
var s = '[TB] ' + msg;
if (配置.调试 && 配置.调试.日志) console.log(s);
if (配置.调试 && 配置.调试.悬浮日志) _写悬浮日志('I', s);
}


function logw(msg) {
var s = '[TB] ' + msg;
console.warn(s);
if (配置.调试 && 配置.调试.悬浮日志) _写悬浮日志('W', s);
}


// 脚本结束时可主动关闭悬浮日志（不调用也没事，脚本结束会自动消失）
function 关闭悬浮日志() {
var L = _获取悬浮日志模块();
if (L && typeof L.关闭 === 'function') {
try { L.关闭(); } catch (e) {}
}
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function ratioToXY(r) {
  var x = Math.floor(r[0] * device.width);
  var y = Math.floor(r[1] * device.height);
  return [x, y];
}

function ratioRectToAbs(rectRatio) {
  var l = Math.floor(rectRatio[0] * device.width);
  var t = Math.floor(rectRatio[1] * device.height);
  var r = Math.floor(rectRatio[2] * device.width);
  var b = Math.floor(rectRatio[3] * device.height);
  return [l, t, r, b];
}

// [Snippet 3.1] 结合你的知识库：随机偏移 + press 优先，失败再降级 shell / shizuku。
function smartClick(x, y) {
  var rx = x + randInt(-3, 3);
  var ry = y + randInt(-3, 3);
  var success = false;

  try {
    success = press(rx, ry, randInt(60, 140));
  } catch (e1) {
    success = false;
  }

  if (!success) {
    // 优先 Shizuku（如果用户开了），否则尝试 root shell。
    if (typeof shizuku === 'function') {
      try {
        var r1 = shizuku('input tap ' + rx + ' ' + ry);
        if (r1 && r1.code === 0) return true;
      } catch (e2) {}
    }
    try {
      var r2 = shell('input tap ' + rx + ' ' + ry, true);
      if (r2 && r2.code === 0) return true;
    } catch (e3) {}
  }

  return !!success;
}

function clickRatio(ratioPoint, reason) {
  var xy = ratioToXY(ratioPoint);
  logi('点击(比例) ' + (reason || '') + ' -> ' + xy[0] + ',' + xy[1]);
  return smartClick(xy[0], xy[1]);
}

function clickUiObject(obj, reason) {
  if (!obj) return false;
  try {
    if (typeof obj.click === 'function' && obj.click()) {
      logi('click() 成功: ' + (reason || ''));
      return true;
    }
  } catch (e1) {}
  try {
    // AutoJs6 UiObject 新增 clickBounds（文档有列出）
    if (typeof obj.clickBounds === 'function' && obj.clickBounds()) {
      logi('clickBounds() 成功: ' + (reason || ''));
      return true;
    }
  } catch (e2) {}

  try {
    var b = obj.bounds();
    return smartClick(b.centerX(), b.centerY());
  } catch (e3) {}

  return false;
}

function findOneSafe(selector, timeout) {
  try {
    return selector.findOne(timeout || 配置.超时.找控件);
  } catch (e) {
    return null;
  }
}

function clickByTextInArea(txt, rectRatio, timeout, reason) {
  var abs = ratioRectToAbs(rectRatio);
  var sel = text(txt).boundsInside(abs[0], abs[1], abs[2], abs[3]);
  var obj = findOneSafe(sel, timeout);
  if (obj) return clickUiObject(obj, reason || ('text=' + txt));
  return false;
}

function clickByDescInArea(descTxt, rectRatio, timeout, reason) {
  var abs = ratioRectToAbs(rectRatio);
  var sel = desc(descTxt).boundsInside(abs[0], abs[1], abs[2], abs[3]);
  var obj = findOneSafe(sel, timeout);
  if (obj) return clickUiObject(obj, reason || ('desc=' + descTxt));
  return false;
}

function clickByText(txt, timeout, reason) {
  var obj = findOneSafe(text(txt), timeout);
  if (obj) return clickUiObject(obj, reason || ('text=' + txt));
  return false;
}

function clickByDesc(descTxt, timeout, reason) {
  var obj = findOneSafe(desc(descTxt), timeout);
  if (obj) return clickUiObject(obj, reason || ('desc=' + descTxt));
  return false;
}

function waitAny(checkFn, timeout, interval) {
  var t0 = now();
  var to = timeout || 8000;
  var step = interval || 300;
  while (now() - t0 < to) {
    var r = false;
    try { r = checkFn(); } catch (e) { r = false; }
    if (r) return true;
    sleep(step);
  }
  return false;
}

function ensureInPackage(pkg, timeout) {
  var to = timeout || 10000;
  return waitAny(function () { return currentPackage() === pkg; }, to, 200);
}

function launchTaobao() {
  logi('启动淘宝...');
  app.launchPackage(配置.包名);
  ensureInPackage(配置.包名, 15000);
  sleepRand(900, 400);
}

function forceStopTaobao() {
  var pkg = 配置.包名;

  // 优先 shizuku（更稳），否则尝试 root shell。
  if (typeof shizuku === 'function') {
    try {
      var r = shizuku('am force-stop ' + pkg);
      if (r && r.code === 0) {
        logi('Shizuku force-stop 成功');
        return true;
      }
    } catch (e1) {}
  }
  try {
    var r2 = shell('am force-stop ' + pkg, true);
    if (r2 && r2.code === 0) {
      logi('Root shell force-stop 成功');
      return true;
    }
  } catch (e2) {}

  logw('force-stop 失败（无 Shizuku/Root）-> 将改为“尽量回退到首页并继续”');
  return false;
}

// 安全找图（基于你的知识库 Snippet 5.1，按 AutoJs6 文档：captureScreen 返回图像一般不必 recycle）
function findImageSafe(targetPath, threshold) {
  threshold = threshold || 0.8;
  var templ = null;
  var screen = null;
  try {
    templ = images.read(targetPath);
    if (!templ) return null;

    // AutoJs6：建议先 requestScreenCapture 再 captureScreen
    screen = images.captureScreen();
    if (!screen) return null;

    var finder = null;
    if (typeof images.findImage === 'function') finder = images.findImage;
    else if (typeof findImage === 'function') finder = findImage;

    if (!finder) return null;

    var p = finder(screen, templ, { threshold: threshold });
    return p;
  } catch (e) {
    return null;
  } finally {
    if (templ) templ.recycle();
    // [Fix] AutoJs6 文档提示 captureScreen 返回值通常不必回收，这里不强制 recycle，避免兼容问题。
  }
}

function requestScreenIfNeeded() {
  // 只申请一次，避免频繁申请导致不稳定。
  if (requestScreenIfNeeded._done) return true;
  requestScreenIfNeeded._done = true;

  try {
    var ok = images.requestScreenCapture(false);
    if (!ok) {
      logw('requestScreenCapture 失败（找图/OCR 将不可用）');
      return false;
    }
    sleep(600);
    return true;
  } catch (e) {
    logw('requestScreenCapture 异常：' + e);
    return false;
  }
}

module.exports = {
  now: now,
  logi: logi,
  logw: logw,
  sleepRand: sleepRand,
  ratioToXY: ratioToXY,
  ratioRectToAbs: ratioRectToAbs,
  smartClick: smartClick,
  clickRatio: clickRatio,
  clickUiObject: clickUiObject,
  findOneSafe: findOneSafe,
  clickByTextInArea: clickByTextInArea,
  clickByDescInArea: clickByDescInArea,
  clickByText: clickByText,
  clickByDesc: clickByDesc,
  waitAny: waitAny,
  ensureInPackage: ensureInPackage,
  launchTaobao: launchTaobao,
  forceStopTaobao: forceStopTaobao,
  requestScreenIfNeeded: requestScreenIfNeeded,
  findImageSafe: findImageSafe

};
