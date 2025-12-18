// modules/TB_淘宝签到.js

var 配置 = require('./TB_配置');
var 工具 = require('./TB_工具');
var 弹窗 = require('./TB_弹窗处理');

function _确保无障碍() {
try {
auto.waitFor();
return true;
} catch (e) {
工具.logw('无障碍可能未开启（auto.waitFor 异常）：' + e);
return false;
}
}

function _回退到淘宝首页(maxBack) {
maxBack = maxBack || 配置.重试.回退;
工具.logi('回退到首页：最多 back ' + maxBack + ' 次');


for (var i = 0; i < maxBack; i++) {
if (弹窗.处理全部弹窗()) {
工具.logi('回退到首页：已处理弹窗（继续检查是否到首页）');
工具.sleepRand(350, 200);
}


if (desc(配置.首页入口.领淘金币.desc).exists()
|| desc(配置.首页入口['88VIP'].desc).exists()
|| desc(配置.首页入口.红包签到.desc).exists()) {
工具.logi('✅ 已识别到淘宝首页');
return true;
}


工具.logi('回退一次(' + (i + 1) + '/' + maxBack + ')');
back();
工具.sleepRand(700, 300);
}


工具.logw('❌ 回退到首页失败：可能被活动页/广告页卡住，或首页入口文案/desc 已变化');
return false;
}

    back();
    工具.sleepRand(700, 300);
  }
  return false;
}

function _确保在首页() {
var pkg = currentPackage();
工具.logi('确保在首页：当前包名=' + pkg);


if (pkg !== 配置.包名) {
工具.logw('当前不在淘宝（将尝试启动淘宝）');
工具.launchTaobao();
工具.sleepRand(900, 400);
}


if (_回退到淘宝首页(3)) return true;


工具.logw('回退失败：尝试点击底部「首页」Tab');
if (工具.clickByDesc('首页', 800, '底部tab-首页') || 工具.clickByText('首页', 800, '底部tab-首页')) {
工具.sleepRand(900, 400);
}


return _回退到淘宝首页(3);
}

  return _回退到淘宝首页(3);
}

function _稳态等待(checkFn, timeoutMs, reason) {
var t0 = 工具.now();
var to = timeoutMs || 配置.超时.找控件;


工具.logi('等待：' + (reason || '') + '（超时=' + to + 'ms）');


while (工具.now() - t0 < to) {
if (弹窗.处理全部弹窗()) {
工具.sleepRand(400, 200);
continue;
}
try {
if (checkFn()) {
工具.logi('✅ 等待完成：' + (reason || '') + '（用时=' + (工具.now() - t0) + 'ms）');
return true;
}
} catch (e) {}
sleep(250);
}


工具.logw('等待超时: ' + (reason || '') + '（用时=' + (工具.now() - t0) + 'ms）');
return false;
}

function 签到_领淘金币() {
  工具.logi('=== 流程：领淘金币签到 ===');
  if (!_确保在首页()) return false;

  // 首页入口：优先 desc+区域，其次全局 desc，最后比例点
  var ok = 工具.clickByDescInArea(配置.首页入口.领淘金币.desc, 配置.首页入口.领淘金币.区域, 1200, '首页-领淘金币');
  if (!ok) ok = 工具.clickByDesc(配置.首页入口.领淘金币.desc, 800, '首页-领淘金币(全局)');
  if (!ok) ok = 工具.clickRatio(配置.首页入口.领淘金币.兜底点, '首页-领淘金币(兜底坐标)');
  if (!ok) return false;

  工具.sleepRand(1200, 500);

  // 等待页面出现“点击签到/已签到”等
  _稳态等待(function () {
    return textMatches(/点击签到|已签到|签到成功|今日已签/).exists();
  }, 10000, '领淘金币页加载');

  // 点击“点击签到”（如果没有说明可能已签到）
  if (工具.clickByTextInArea(配置.领淘金币页.点击签到.text, 配置.领淘金币页.点击签到.区域, 1000, '领淘金币-点击签到')) {
    工具.sleepRand(900, 400);
  } else if (工具.requestScreenIfNeeded()) {
    var p = 工具.findImageSafe(配置.领淘金币页.点击签到.找图, 0.82);
    if (p) {
      工具.smartClick(p.x + 10, p.y + 10);
      工具.sleepRand(900, 400);
    }
  } else {
    // 最后兜底点
    工具.clickRatio(配置.领淘金币页.点击签到.兜底点, '领淘金币-点击签到(兜底)');
    工具.sleepRand(900, 400);
  }

  // 回到首页
  _回退到淘宝首页(3);
  return true;
}

function 签到_88VIP() {
  工具.logi('=== 流程：88VIP 去签到 ===');
  if (!_确保在首页()) return false;

  var ok = 工具.clickByDescInArea(配置.首页入口['88VIP'].desc, 配置.首页入口['88VIP'].区域, 1200, '首页-88VIP');
  if (!ok) ok = 工具.clickByDesc(配置.首页入口['88VIP'].desc, 800, '首页-88VIP(全局)');
  if (!ok) ok = 工具.clickRatio(配置.首页入口['88VIP'].兜底点, '首页-88VIP(兜底)');
  if (!ok) return false;

  工具.sleepRand(1200, 500);

  _稳态等待(function () {
    return textMatches(/去签到|签到|88VIP/).exists();
  }, 12000, '88VIP页加载');

  // 去签到按钮
  ok = 工具.clickByTextInArea(配置.VIP页.去签到.text, 配置.VIP页.去签到.区域, 1500, '88VIP-去签到');
  if (!ok) ok = 工具.clickByText(配置.VIP页.去签到.text, 800, '88VIP-去签到(全局)');
  if (!ok && 工具.requestScreenIfNeeded()) {
    var p = 工具.findImageSafe(配置.VIP页.去签到.找图, 0.82);
    if (p) {
      工具.smartClick(p.x + 10, p.y + 10);
      ok = true;
    }
  }
  if (!ok) ok = 工具.clickRatio(配置.VIP页.去签到.兜底点, '88VIP-去签到(兜底)');

  工具.sleepRand(1200, 500);

  // 每日签到页：你的采集点是“+1”，说明这个页面文案经常变化，这里用“多策略一次点击 + 防抖”。
  // 1) 先找“立即签到/签到/领取”
  if (textMatches(/立即签到|签到|签到领取|去签到/).exists()) {
    工具.clickByText('立即签到', 600, '88VIP-立即签到');
    工具.clickByText('签到', 600, '88VIP-签到');
  } else {
    // 2) 找图兜底
    if (工具.requestScreenIfNeeded()) {
      var p2 = 工具.findImageSafe(配置.VIP页.每日签到找图, 0.80);
      if (p2) {
        工具.smartClick(p2.x + 10, p2.y + 10);
      } else {
        // 3) 坐标兜底
        工具.clickRatio(配置.VIP页.每日签到兜底点, '88VIP-每日签到(兜底)');
      }
    } else {
      工具.clickRatio(配置.VIP页.每日签到兜底点, '88VIP-每日签到(兜底)');
    }
  }

  工具.sleepRand(900, 400);
  _回退到淘宝首页(4);
  return true;
}

function 签到_红包签到() {
  工具.logi('=== 流程：红包签到 ===');
  if (!_确保在首页()) return false;

  var ok = 工具.clickByDescInArea(配置.首页入口.红包签到.desc, 配置.首页入口.红包签到.区域, 1200, '首页-红包签到');
  if (!ok) ok = 工具.clickByDesc(配置.首页入口.红包签到.desc, 800, '首页-红包签到(全局)');
  if (!ok) ok = 工具.clickRatio(配置.首页入口.红包签到.兜底点, '首页-红包签到(兜底)');
  if (!ok) return false;

  工具.sleepRand(1200, 600);

  // 立即签到
  _稳态等待(function () {
    return textMatches(/立即签到|红包签到|连续打卡|点击签到/).exists();
  }, 12000, '红包签到页加载');

  ok = 工具.clickByText('立即签到', 900, '红包-立即签到');
  if (!ok && 工具.requestScreenIfNeeded()) {
    var p = 工具.findImageSafe(配置.红包签到页.立即签到.找图, 0.82);
    if (p) {
      工具.smartClick(p.x + 10, p.y + 10);
      ok = true;
    }
  }
  if (!ok) ok = 工具.clickRatio(配置.红包签到页.立即签到.兜底点, '红包-立即签到(兜底)');

  工具.sleepRand(1200, 600);

  // 连续打卡入口（你的采集里这一步最容易“控件采不到”，优先找图）
  ok = false;
  if (工具.requestScreenIfNeeded()) {
    var p2 = 工具.findImageSafe(配置.红包签到页.连续打卡入口.找图, 0.80);
    if (p2) {
      工具.smartClick(p2.x + 10, p2.y + 10);
      ok = true;
    }
  }
  if (!ok) ok = 工具.clickRatio(配置.红包签到页.连续打卡入口.兜底点, '红包-连续打卡入口(兜底)');

  工具.sleepRand(1200, 600);

  // 连续打卡页-点击签到
  _稳态等待(function () {
    return textMatches(/点击签到|连续打卡|已签到|签到成功/).exists();
  }, 12000, '连续打卡页加载');

  ok = 工具.clickByTextInArea(配置.红包签到页.连续打卡页_点击签到.text, 配置.红包签到页.连续打卡页_点击签到.区域, 1500, '连续打卡-点击签到');
  if (!ok) ok = 工具.clickByText('点击签到', 800, '连续打卡-点击签到(全局)');
  if (!ok && 工具.requestScreenIfNeeded()) {
    var p3 = 工具.findImageSafe(配置.红包签到页.连续打卡页_点击签到.找图, 0.82);
    if (p3) {
      工具.smartClick(p3.x + 10, p3.y + 10);
      ok = true;
    }
  }
  if (!ok) ok = 工具.clickRatio(配置.红包签到页.连续打卡页_点击签到.兜底点, '连续打卡-点击签到(兜底)');

  工具.sleepRand(900, 400);
  _回退到淘宝首页(5);
  return true;
}

function 运行() {
  _确保无障碍();

  // 你提到“防止淘宝后台会先把淘宝结束应用”
  工具.forceStopTaobao();
  工具.sleepRand(800, 300);
  工具.launchTaobao();

  // 找图/OCR 会用到截图权限：先申请一次（失败也不影响纯控件流程）
  工具.requestScreenIfNeeded();

  var t0 = 工具.now();

  try {
    签到_领淘金币();
    弹窗.处理全部弹窗();

    签到_88VIP();
    弹窗.处理全部弹窗();

    签到_红包签到();
    弹窗.处理全部弹窗();
  } finally {
    var cost = 工具.now() - t0;
    工具.logi('全部流程结束，用时(ms)=' + cost);
  }
}

module.exports = {
  运行: 运行,
  签到_领淘金币: 签到_领淘金币,
  签到_88VIP: 签到_88VIP,
  签到_红包签到: 签到_红包签到

};
