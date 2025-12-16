/**
 * @description 签到任务集合
 */
var Utils = require('./Utils.js');

var SignTask = {
    run: function() {
        Utils.log(">>> 开始执行签到任务");
        
        this.doCoin();       // 1. 淘金币
        this.doVip();        // 2. 88VIP
        this.doRedPacket();  // 3. 红包签到
        
        Utils.log(">>> 签到任务全部完成");
    },

    // 1. 淘金币签到
    doCoin: function() {
        Utils.goHome();
        let entry = Utils.findWidget("text", "领淘金币");
        
        if (Utils.clickNode(entry, "进入淘金币")) {
            sleep(5000);
            Utils.log("检查金币状态...");
            
            // 查找“点击签到”
            let signBtn = Utils.findWidget("text", "点击签到", 2000);
            if (signBtn) {
                Utils.clickNode(signBtn, "点击金币签到");
                sleep(3000);
            }
            
            // 检查结果: 是否变成 "赚更多金币"
            if (Utils.findWidget("text", "赚更多金币", 2000)) {
                Utils.log("淘金币: 已完成");
            } else if (textContains("今日已签").exists()) {
                Utils.log("淘金币: 今日已签");
            }
            
            back(); sleep(1000);
        }
    },

    // 2. 88VIP 签到
    doVip: function() {
        Utils.goHome();
        let entry = Utils.findWidget("text", "88VIP");
        
        if (Utils.clickNode(entry, "进入88VIP")) {
            Utils.log("等待88VIP加载...");
            sleep(4000);
            Utils.forceRefresh(); // 必做：强制刷新防卡
            
            // 查找“每日签到”模块下的“去签到”
            // 先找标题确保在正确区域
            let title = Utils.findWidget("text", "每日签到", 2000);
            if (title) {
                let btn = Utils.findWidget("text", "去签到", 1000);
                if (btn) {
                    Utils.clickNode(btn, "88VIP签到");
                    sleep(3000);
                }
            }

            // 检查结果: 是否变成 "每日领"
            if (Utils.findWidget("text", "每日领", 2000)) {
                Utils.log("88VIP: 已完成");
            } else if (Utils.findWidget("text", "明日领", 2000)) {
                Utils.log("88VIP: 今日已签");
            }

            back(); sleep(1000);
            if (!text("首页").exists()) back(); // 双重返回
            sleep(1500);
        }
    },

    // 3. 红包签到 (复杂逻辑)
    doRedPacket: function() {
        Utils.goHome();
        
        // 入口识别：【100元免费领】或【100元 连续打卡...】
        // 策略：模糊匹配 "100元" 且包含 "领" 的控件
        let entry = null;
        let candidates = textMatches(/.*100元.*/).find();
        if (candidates.nonEmpty()) {
            for (let i = 0; i < candidates.length; i++) {
                let w = candidates[i];
                // 过滤掉无关的，寻找首页那个卡片
                if (w.text().includes("领")) {
                    entry = w;
                    break;
                }
            }
        }
        // 备用入口文字
        if (!entry) entry = Utils.findWidget("text", "红包签到");

        if (Utils.clickNode(entry, "进入红包签到")) {
            sleep(5000);
            Utils.forceRefresh();

            // 目标页面：【连续打卡免费领奖】
            // 检查是否进入了打卡页
            if (textContains("连续打卡").exists() || textContains("打卡任务").exists()) {
                Utils.log("进入打卡页面");
                
                // 找 "每日签到" 旁边的 "点击签到"
                let signNode = Utils.findWidget("text", "点击签到", 2000);
                if (signNode) {
                    Utils.clickNode(signNode, "执行红包打卡");
                    sleep(3000);
                }

                // 检查 "已签到"
                if (textContains("已签到").exists()) {
                    Utils.log("红包: 已完成");
                }
            } else {
                Utils.log("未识别到打卡界面，可能已完成或弹窗阻挡");
                // 尝试处理通用的弹窗
                let close = Utils.findWidget("text", "关闭");
                if(close) Utils.clickNode(close);
            }

            back(); sleep(1000);
        }
    }
};

module.exports = SignTask;