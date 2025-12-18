'use strict';


var 配置 = require('./TB_配置');


var _win = null;
var _lines = [];
var _inited = false;
var _enabled = false;


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


// 1) 权限检查：没权限就不创建（避免你误以为“脚本没输出日志”）
if (!_hasFloatyPermission()) {
console.warn('[TB] 悬浮窗权限未开启：悬浮日志不会显示（日志仍会出现在 AutoJs6 日志面板）');
if (配置.调试.悬浮日志自动申请权限) _requestFloatyPermission();
_enabled = false;
return false;
}


// 2) 创建悬浮窗
try {
_win = floaty.rawWindow(
<frame bg="#00000000">
<vertical padding="10" bg="#AA000000">
<text text="TB 运行日志" textColor="#FFD700" textSize="12sp" textStyle="bold"/>
<text id="txt" text="初始化..." textColor="#FFFFFF" textSize="10sp" maxLines="20"/>
</vertical>
</frame>
);


};
