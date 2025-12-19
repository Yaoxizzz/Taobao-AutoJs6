// modules/TB_弹窗处理.js

var 配置 = require('./TB_配置');
var 工具 = require('./TB_工具');

// [Enhance] 判定规则优化：
// 1. 右上角小按钮 (常见广告)
// 2. 底部中间关闭按钮 (你遇到的那种)
function _isValidCloseBtn(obj) {
  try {
    var b = obj.bounds();
    var w = b.width();
    var h = b.height();
    var cx = b.centerX();
    var cy = b.centerY();

    // 排除过大的区域（防止误点整个背景）
    if (w > device.width * 0.4) return false;
    if (h > device.height * 0.3) return false;

    // 规则A：右上角 (Top-Right)
    // 位于屏幕右侧 55% 之后，且在上半屏
    if (cx > device.width * 0.55 && cy < device.height * 0.5) {
      return true;
    }

    // 规则B：底部中央 (Bottom-Center) - [Fix] 针对你素材里的“关闭按钮”
    // 位于屏幕下方 70% 之后，且横向居中
    if (cy > device.height * 0.7) {
      // 横向不要太偏
      if (cx > device.width * 0.3 && cx < device.width * 0.7) {
        return true;
      }
    }

    return false;
  } catch (e) {
    return false;
  }
}

function 处理系统权限框() {
  var pkg = currentPackage();
  if (!pkg) return false;

  // 常见权限控制器包名（弱判断）
  if (pkg.indexOf('permission') >= 0 || pkg.indexOf('packageinstaller') >= 0) {
    工具.logi('检测到系统权限框：' + pkg);
    if (工具.clickByText('仅在使用中允许', 600, '权限框-仅在使用中允许')) return true;
    if (工具.clickByText('允许', 600, '权限框-允许')) return true;
    if (工具.clickByText('始终允许', 600, '权限框-始终允许')) return true;
    if (工具.clickByText('确定', 600, '权限框-确定')) return true;
    return false;
  }
  return false;
}

function 处理淘宝常见弹窗() {
  // 1) 文案类关闭 (Text)
  var closeTexts = ['关闭', '我知道了', '知道了', '取消', '以后再说', '稍后', '跳过', '暂不', '暂不更新', '不升级'];
  for (var i = 0; i < closeTexts.length; i++) {
    if (工具.clickByText(closeTexts[i], 300, '弹窗-' + closeTexts[i])) return true;
  }

  // 2) 精准描述类 (Desc) - [Fix] 优先处理你素材里的“关闭按钮”
  // 这类按钮通常非常明确，不需要判断位置，或者只需简单判断
  try {
    var exactDesc = ['关闭按钮', '关闭'];
    for (var k = 0; k < exactDesc.length; k++) {
      var dBtn = desc(exactDesc[k]).findOne(200);
      if (dBtn && 工具.clickUiObject(dBtn, '弹窗-精准desc(' + exactDesc[k] + ')')) {
        return true;
      }
    }
  } catch (e0) {}

  // 3) 模糊正则类 (Desc Regex)
  try {
    var c1 = descMatches(/关闭|close|取消|x|X|×/).find();
    if (c1 && c1.length) {
      for (var j = 0; j < c1.length; j++) {
        var o = c1[j];
        // 使用新的判断逻辑（支持底部按钮）
        if (_isValidCloseBtn(o)) {
          if (工具.clickUiObject(o, '弹窗-模糊desc')) return true;
        }
      }
    }
  } catch (e1) {}

  // 4) 特殊 ID 处理 - [Fix] 针对淘宝全屏弹窗层
  // com.taobao.taobao:id/poplayer_native_state_id 往往是弹窗容器，点它有时能关，但最好点里面的关闭
  // 这里作为兜底：如果前面都没关掉，尝试点这个 ID 的中心（如果存在）
  try {
    var popLayer = id("com.taobao.taobao:id/poplayer_native_state_id").clickable(true).findOne(200);
    if (popLayer) {
        // 只有当它比较小的时候才点，太大了可能是整个界面
        // 或者配合找图
        // 这里暂时不盲目点大层级，防止误触内容
    }
  } catch (e2) {}

  // 5) 找图关闭（需要截图权限）
  // 你的配置里有 '淘宝素材/淘宝_弹窗/crop.png'
  if (工具.requestScreenIfNeeded()) {
    // 尝试配置里的图
    var p = 工具.findImageSafe(配置.弹窗.关闭找图, 0.82);
    if (p) {
      工具.smartClick(p.x + 5, p.y + 5);
      工具.logi('弹窗关闭：找图命中(配置)');
      工具.sleepRand(400, 300);
      return true;
    }
    // 尝试你新增的图（如果有代码引用，或者你可以在这里加素材路径）
    // var p2 = 工具.findImageSafe('淘宝素材/淘宝_X按钮/crop.png', 0.82); ...
  }

  return false;
}

function 处理全部弹窗() {
  if (处理系统权限框()) return true;
  if (处理淘宝常见弹窗()) return true;
  return false;
}

module.exports = {
  处理全部弹窗: 处理全部弹窗
};
