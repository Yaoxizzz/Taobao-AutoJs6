/**
 * @description 签到任务业务逻辑
 */
var Utils = require('./Utils.js');

var SignTask = {
    run: function() {
        Utils.log(">>> 开始执行签到");
        this.doCoin();
        this.doVip();
        this.doRedPacket();
    },

    // 1. 淘金币
    doCoin: function() {
        Utils.goHome();
        let entry = Utils.findWidget("text", "领淘金币");
        if (Utils.clickNode(entry, "进入淘金币")) {
            sleep(5000);
            Utils.log("检查金币...");
            let sign = Utils.findWidget("text", "点击签到") || Utils.findWidget("text", "签到领取");
            if (sign) {
                Utils.clickNode(sign, "签到");
                sleep(3000);
            }
            if (Utils.findWidget("text", "赚更多金币")) Utils.log("金币: 已完成");
            back(); sleep(1000);
        }
    },

    // 2. 88VIP
    doVip: function() {
        Utils.goHome();
        let entry = Utils.findWidget("text", "88VIP");
        if (Utils.clickNode(entry, "进入VIP")) {
            Utils.log("加载VIP...");
            sleep(4000);
            Utils.forceRefresh(); // 强制刷新
            
            let btn = Utils.findWidget("text", "去签到", 1500);
            if (btn) {
                Utils.clickNode(btn, "签到");
                sleep(3000);
            }
            if (Utils.findWidget("text", "每日领") || Utils.findWidget("text", "明日领")) {
                Utils.log("VIP: 已完成");
            }
            back(); sleep(1000);
            if (!text("首页").exists()) back();
            sleep(2000);
        }
    },

    // 3. 红包签到 (修正匹配逻辑)
    doRedPacket: function() {
        Utils.goHome();
        Utils.log("找红包入口...");
        
        // 匹配 "100元" 且包含 "领" 的入口
        let entry = null;
        let candidates = textMatches(/.*100元.*/).find();
        if (candidates.nonEmpty()) {
            for (let i = 0; i < candidates.length; i++) {
                let txt = candidates[i].text();
                if (txt.includes("领") || txt.includes("打卡")) {
                    entry = candidates[i];
                    break;
                }
            }
        }
        if (!entry) entry = Utils.findWidget("text", "红包签到");

        if (Utils.clickNode(entry, "进入红包签到")) {
            sleep(5000);
            Utils.forceRefresh();
            
            if (textContains("连续打卡").exists() || textContains("打卡任务").exists()) {
                let sign = Utils.findWidget("text", "点击签到", 2000);
                if (sign) {
                    Utils.clickNode(sign, "签到");
                    sleep(3000);
                }
                if (textContains("已签到").exists()) Utils.log("红包: 已完成");
            }
            
            back(); sleep(1000);
        }
    }
};

module.exports = SignTask;
