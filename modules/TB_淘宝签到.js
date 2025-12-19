// modules/TB_淘宝签到.js
// 这是“车间主任”，负责指挥整个签到工作的流程。
// 它会按顺序调用：领金币 -> 88VIP -> 红包签到

'use strict'; // 开启严格模式，让代码更规范

// 引入助手模块
var 配置 = require('./TB_配置');     // 拿配置数据
var 工具 = require('./TB_工具');     // 拿工具（如点击、截图）
var 弹窗 = require('./TB_弹窗处理'); // 拿保镖（关弹窗）

// 悬浮窗日志工具（为了方便你看，这里直接引用了一个更简单的版本）
var 浮窗日志 = require('./TB_悬浮日志');


// ========================= 基础函数区 =========================

function logI(msg) {
  console.log('[TB] ' + msg); // 在电脑/手机控制台打印
  浮窗日志.写('I', msg);      // 在屏幕左上角小窗写
}

function logW(msg) {
  console.warn('[TB] ' + msg);
  浮窗日志.写('W', msg);      // W 代表 Warning (警告)
}

function safeSleep(ms) {
  try { sleep(ms); } catch (e) {}
}

// 返回上一页（带日志）
function safeBack(reason) {
  logI('准备返回：' + reason);
  try { back(); } catch (e) {}
  safeSleep(800); // 返回后要等一下，因为界面切换需要时间
}

// 智能等待函数：一边等条件满足，一边处理弹窗
// checkFn: 一个函数，返回 true 表示条件满足（比如找到了“点击签到”按钮）
// timeoutMs: 最多等多少毫秒
// reason: 这一步是在干嘛（用于写日志）
function smartWait(checkFn, timeoutMs, reason) {
  var t0 = new Date().getTime(); // 记录开始时间
  logI('正在等待：' + reason + ' (最多' + (timeoutMs/1000) + '秒)');

  while (new Date().getTime() - t0 < timeoutMs) {
    // 1. 先看看有没有满足条件
    try {
      if (checkFn()) {
        logI('✅ 等到了：' + reason);
        return true;
      }
    } catch (e) {}

    // 2. 如果没满足，看看是不是有弹窗挡住了？
    try {
      if (弹窗.处理全部弹窗()) {
        logI('监测到弹窗并已关闭，继续等待...');
        safeSleep(500); // 关掉弹窗后多等一会
        continue;       // 跳过本次循环，重新检查条件
      }
    } catch (e) {}

    // 3. 还没等到，休息 0.5 秒再看
    safeSleep(500);
  }

  // 时间到了还没等到
  logW('❌ 等待超时：' + reason);
  return false;
}

// 确保淘宝在前台（如果跳到广告页了，就拉回来）
function ensureTaobao() {
  var pkg = currentPackage();
  if (pkg !== 配置.包名) {
    logI('当前不在淘宝，正在启动淘宝...');
    app.launchPackage(配置.包名);
    safeSleep(2000); // 启动APP需要时间
  }
}

// 回到淘宝首页（死命按返回键，直到看到首页特征）
function backToHome() {
  logI('准备回到首页...');
  for (var i = 0; i < 5; i++) { // 最多试 5 次
    ensureTaobao(); // 确保在淘宝里
    
    // 检查：如果看到了“领淘金币”或者“88VIP”，说明已经在首页了
    if (desc(配置.首页入口.领淘金币.desc).exists() || desc(配置.首页入口['88VIP'].desc).exists()) {
      logI('✅ 已识别到首页');
      return true;
    }

    // 没到首页？处理一下弹窗，然后按返回
    弹窗.处理全部弹窗();
    safeBack('回首页第' + (i+1) + '次');
  }
  logW('回首页失败（可能卡住了），强行重启淘宝');
  工具.forceStopTaobao(); // 强行停止
  工具.launchTaobao();    // 重新启动
  return true;
}


// ========================= 任务一：领淘金币 =========================

function flowCoinSign() {
  logI('>>> 任务开始：领淘金币');

  if (!backToHome()) return false; // 先回首页

  // 1. 点击首页上的“领淘金币”图标
  // 我们尝试 3 种方法点它，只要一种成功就行
  var ok = 工具.clickByDescInArea(配置.首页入口.领淘金币.desc, 配置.首页入口.领淘金币.区域, 1000) // 方法A：区域+文字
        || 工具.clickByDesc(配置.首页入口.领淘金币.desc, 1000) // 方法B：全局找文字
        || 工具.clickRatio(配置.首页入口.领淘金币.兜底点);     // 方法C：点固定坐标

  if (!ok) {
    logW('没找到“领淘金币”入口，跳过此任务');
    return false;
  }

  // 2. 等待进入金币页面
  // 条件：看到“点击签到”文字，或者“赚更多金币”(说明已签到)
  var ready = smartWait(function() {
    return textContains('点击签到').exists() 
        || descContains('点击签到').exists()
        || textContains('赚更多金币').exists()
        || 工具.findImageSafe(配置.领淘金币页.点击签到.找图); // 也可以找图
  }, 15000, '金币页面加载');

  if (!ready) {
    safeBack('加载超时退出');
    return false;
  }

  // 3. 判断是不是已经签到过了
  if (textContains('赚更多金币').exists() || textContains('已签到').exists()) {
    logI('检测到已签到，任务完成');
    safeBack('退出金币页');
    return true;
  }

  // 4. 点击签到按钮
  logI('点击签到按钮...');
  // 同样尝试多种点击方式
  var signed = 工具.clickByText('点击签到', 1000)
            || 工具.clickByDesc('点击签到', 1000)
            || 工具.smartClickImage(配置.领淘金币页.点击签到.找图);

  if (signed) {
    logI('已点击，等待结果...');
    safeSleep(2000);
  } else {
    logW('没点到签到按钮（可能图标变了）');
  }

  safeBack('任务结束返回');
  return true;
}


// ========================= 任务二：88VIP 签到 =========================

function flowVipSign() {
  logI('>>> 任务开始：88VIP');
  
  if (!backToHome()) return false;

  // 1. 点击首页入口
  var ok = 工具.clickByDescInArea(配置.首页入口['88VIP'].desc, 配置.首页入口['88VIP'].区域, 1000)
        || 工具.clickRatio(配置.首页入口['88VIP'].兜底点);

  if (!ok) {
    logW('没找到 88VIP 入口，跳过');
    return false;
  }

  // 2. 等待页面加载
  var ready = smartWait(function() {
    return textContains('去签到').exists() || textContains('明日领').exists();
  }, 15000, '88VIP页面');

  if (!ready) {
    safeBack('超时退出');
    return false;
  }

  // 3. 判断是否已签到
  if (textContains('明日领').exists()) {
    logI('今日已签到（看到明日领）');
    safeBack('退出');
    return true;
  }

  // 4. 点击签到
  if (工具.clickByText('去签到', 1000) || 工具.smartClickImage(配置.VIP页.去签到.找图)) {
    logI('点击去签到成功');
    safeSleep(3000); // 88VIP签到后通常会跳个广告页，等一下
    safeBack('从广告页返回'); 
  }

  safeBack('任务结束返回');
  return true;
}


// ========================= 总入口 =========================

function 运行() {
  logI('=== 脚本启动 ===');
  logI('作者提醒：请确保已开启无障碍和悬浮窗权限');

  // 1. 申请截图权限（为了找图）
  // 注意：安卓会弹个框问你“是否允许”，脚本会自动点允许（如果版本支持），或者你需要手动点一下
  if (工具.requestScreenIfNeeded()) {
    logI('截图权限：✅ 已获取');
  } else {
    logW('截图权限：❌ 获取失败 (找图功能将失效)');
  }

  // 2. 按顺序执行任务
  try {
    flowCoinSign(); // 跑金币
  } catch (e) {
    logW('金币任务出错：' + e);
  }

  try {
    flowVipSign();  // 跑88VIP
  } catch (e) {
    logW('88VIP任务出错：' + e);
  }

  // 3. 结束
  logI('=== 全部任务完成 ===');
  safeSleep(2000);
  
  // 关闭悬浮窗
  try { 浮窗日志.关闭(); } catch (e) {}
}

module.exports = {
  运行: 运行
};
