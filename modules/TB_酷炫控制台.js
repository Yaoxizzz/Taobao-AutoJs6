// modules/TB_酷炫控制台.js
// 作用：给 AutoJs6 的浮动控制台做一层“工程化封装”，并提供展开/收起（伸缩）能力。
// 兼容：AutoJs6 (Rhino/ES5)

(function () {
  'use strict';

  var 已初始化 = false;

  function safe(fn) {
    try { return fn(); } catch (e) { return null; }
  }

  function 显示(title) {
    if (!已初始化) {
      // console.build / show / collapse / expand 等能力来自 AutoJs6 控制台模块
      // 文档：console.show() 显示浮动窗口；console.build(options) 可定制外观。
      safe(function () {
        console.build({
          size: [0.92, 0.42],
          position: [0.04, 0.06],
          title: title || 'TB 控制台',
          titleTextSize: 16,
          contentTextSize: 12,
          // 颜色使用 AutoJs6 文档中的色名映射（若不支持会自动忽略）
          backgroundColor: 'blue-grey-900',
          titleBackgroundAlpha: 0.85,
          contentBackgroundAlpha: 0.55,
          exitOnClose: false,
          touchable: true
        });
      });
      已初始化 = true;
    }

    safe(function () { console.setTitle(title || 'TB 控制台'); });
    safe(function () { console.setTouchable(true); });
    safe(function () { console.setExitOnClose(false); });
    safe(function () { console.show(); });
  }

  function 隐藏() {
    safe(function () { console.hide(); });
  }

  function 收起() {
    // AutoJs6 控制台浮动窗口自带最小化按钮；这里提供代码方式。
    safe(function () { console.collapse(); });
  }

  function 展开() {
    safe(function () { console.expand(); });
  }

  module.exports = {
    显示: 显示,
    隐藏: 隐藏,
    收起: 收起,
    展开: 展开
  };
})();
