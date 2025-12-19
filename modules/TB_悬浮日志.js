'use strict';

var 配置 = require('./TB_配置');

var _win = null;
var _lines = [];
var _inited = false;
var _enabled = false;
var _maxLines = 12; // 默认最大行数

// 这里不要引用 TB_工具（避免循环依赖），只用 console 兜底
function _safe(fn) {
  try { return fn(); } catch (e) { return null; }
}

function _timeStr() {
  var d = new Date();
  var hh = ('0' + d.getHours()).slice(-2);
  var mm = ('0' + d.getMinutes()).slice(-2);
  var ss = ('0' + d.getSeconds()).slice(-2);
  return hh + ':' + mm + ':' + ss;
}

function _hasFloatyPermission() {
  if (typeof floaty === 'undefined') return false;
  if (typeof floaty.hasPermission === 'function') return floaty.hasPermission();
  // 兜底：老版本没有 hasPermission 时，直接让创建时 try/catch
  return true;
}

function _requestFloatyPermission() {
  if (typeof floaty === 'undefined') return;
  if (typeof floaty.requestPermission === 'function') {
    toast('请开启 AutoJs6 悬浮窗权限后，重新运行脚本');
    floaty.requestPermission();
  } else {
    toast('当前 AutoJs6 版本没有 requestPermission()，请手动开启悬浮窗权限');
  }
}

function _ensure() {
  if (_inited) return _enabled;
  _inited = true;

  _enabled = !!(配置 && 配置.调试 && 配置.调试.悬浮日志);
  if (!_enabled) return false;

  // 1) 权限检查
  if (!_hasFloatyPermission()) {
    console.warn('[TB] 悬浮窗权限未开启：悬浮日志不会显示');
    if (配置.调试 && 配置.调试.悬浮日志自动申请权限) _requestFloatyPermission();
    _enabled = false;
    return false;
  }

  if (配置.调试 && 配置.调试.悬浮日志最大行) {
    _maxLines = 配置.调试.悬浮日志最大行;
  }

  // 2) 创建悬浮窗
  try {
    // 颜色优化：增加行间距 lineSpacingMultiplier，背景色微调
    _win = floaty.rawWindow(
      <frame bg="#00000000">
        <vertical padding="10" bg="#CC202020">
          <text text="TB 运行日志" textColor="#FFD700" textSize="13sp" textStyle="bold" />
          <text id="txt" text="初始化..." textColor="#FFFFFF" textSize="11sp" lineSpacingMultiplier="1.2" maxLines="20" />
        </vertical>
      </frame>
    );

    // 位置：读取配置或默认
    var ratio = [0.03, 0.12];
    if (配置.调试 && 配置.调试.悬浮日志位置比例) ratio = 配置.调试.悬浮日志位置比例;
    
    var x = parseInt(device.width * ratio[0], 10);
    var y = parseInt(device.height * ratio[1], 10);
    _win.setPosition(x, y);

    // 触摸穿透：根据配置决定是否挡点击
    var touchable = false;
    if (配置.调试 && typeof 配置.调试.悬浮日志不挡点击 === 'boolean') {
      touchable = !配置.调试.悬浮日志不挡点击;
    }
    if (typeof _win.setTouchable === 'function') {
      _win.setTouchable(touchable);
    }

    _lines = [];
    return true;

  } catch (e) {
    console.warn('[TB] 悬浮日志创建异常：' + e);
    _enabled = false;
    _win = null;
    return false;
  }
}

function 写(level, msg) {
  if (!_ensure()) return;
  
  msg = String(msg);
  // [Fix] 简单过滤掉太长的日志，避免刷屏
  if (msg.length > 30) msg = msg.substring(0, 30) + '..';

  var line = _timeStr() + ' [' + level + '] ' + msg;
  _lines.push(line);
  
  // 限制行数
  while (_lines.length > _maxLines) _lines.shift();

  // 更新 UI
  _safe(function () {
    ui.run(function () {
      _safe(function () {
        // [Fix] 关键修复：使用 join('\n') 换行，而不是 join('')
        if (_win && _win.txt) _win.txt.setText(_lines.join('\n'));
      });
    });
  });
}

function 关闭() {
  _safe(function () { if (_win) _win.close(); });
  _win = null;
  _lines = [];
  _inited = false;
}

module.exports = {
  写: 写,
  关闭: 关闭
};
