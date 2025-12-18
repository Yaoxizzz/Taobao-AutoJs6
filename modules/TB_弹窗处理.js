// modules/TB_弹窗处理.js

var 配置 = require('./TB_配置');
var 工具 = require('./TB_工具');

function _smallTopRight(obj) {
  try {
    var b = obj.bounds();
    var w = b.width();
    var h = b.height();
    // 小、靠右、靠上（避免误触大广告区域）
    if (w > device.width * 0.35) return false;
    if (h > device.height * 0.25) return false;
    if (b.top > device.height * 0.55) return false;
    if (b.left < device.width * 0.55) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function 处理系统权限框() {
  var pkg = currentPackage();
  if (!pkg) return false;

  // 常见权限控制器包名（不同 ROM 可能不同），这里只做“弱判断”。
  if (pkg.indexOf('permission') >= 0 || pkg.indexOf('packageinstaller') >= 0) {
    // 优先“允许/仅在使用中允许”
    工具.logi('检测到系统权限框：' + pkg);
    if (工具.clickByText('仅在使用中允许', 600, '权限框-仅在使用中允许')) return true;
    if (工具.clickByText('允许', 600, '权限框-允许')) return true;
    if (工具.clickByText('始终允许', 600, '权限框-始终允许')) return true;
    if (工具.clickByText('确定', 600, '权限框-确定')) return true;
    // 避免误点“拒绝且不再询问”，默认不点
    return false;
  }
  return false;
}

function 处理淘宝常见弹窗() {
  // 1) 文案类关闭
  var closeTexts = ['关闭', '我知道了', '知道了', '取消', '以后再说', '稍后', '跳过', '暂不', '暂不更新', '不升级'];
  for (var i = 0; i < closeTexts.length; i++) {
    if (工具.clickByText(closeTexts[i], 300, '弹窗-' + closeTexts[i])) return true;
  }

  // 2) 无障碍采到的“关闭按钮”(desc)
  try {
    var c1 = descMatches(/关闭|close|取消|x|X|×/).find();
    if (c1 && c1.length) {
      for (var j = 0; j < c1.length; j++) {
        var o = c1[j];
        if (_smallTopRight(o)) {
          if (工具.clickUiObject(o, '弹窗-右上角关闭')) return true;
        }
      }
    }
  } catch (e1) {}

  // 3) 找图关闭（需要截图权限）
  if (工具.requestScreenIfNeeded()) {
    var p = 工具.findImageSafe(配置.弹窗.关闭找图, 0.82);
    if (p) {
      工具.smartClick(p.x + 5, p.y + 5);
      工具.logi('弹窗关闭：找图命中并点击');
      工具.sleepRand(400, 300);
      return true;
    }
  }

  return false;
}

function 处理全部弹窗() {
  // 先系统权限，再淘宝弹窗
  if (处理系统权限框()) return true;
  if (处理淘宝常见弹窗()) return true;
  return false;
}

module.exports = {
  处理全部弹窗: 处理全部弹窗

};
