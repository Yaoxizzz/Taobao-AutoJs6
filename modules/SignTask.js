var Utils = require('./Utils.js');

var SignTask = {
    run: function() {
        Utils.log(">>> 执行签到");
        this.doCoin();
        this.doVip();
        this.doRedPacket();
    },

    doCoin: function() {
        Utils.goHome();
        let entry = Utils.findWidget("text", "领淘金币");
        if (Utils.clickNode(entry, "进入淘金币")) {
            sleep(5000);
            let sign = Utils.findWidget("text", "点击签到") || Utils.findWidget("text", "签到领取");
            if (sign) {
                Utils.clickNode(sign, "签到");
                sleep(3000);
            }
            // 检查状态
            if (Utils.findWidget("text", "赚更多金币")) Utils.log("淘金币: 已完成");
            back(); sleep(1000);
        }
    },

    doVip: function() {
        Utils.goHome();
        let entry = Utils.findWidget("text", "88VIP");
        if (Utils.clickNode(entry, "进入VIP")) {
            Utils.log("加载VIP...");
            sleep(4000);
            Utils.forceRefresh();
            
            let btn = Utils.findWidget("text", "去签到", 1000);
            if (btn) {
                Utils.clickNode(btn, "签到");
                sleep(3000);
            }
            // 检查状态
            if (Utils.findWidget("text", "每日领") || Utils.findWidget("text", "明日领")) {
                Utils.log("VIP: 已完成");
            }
            back(); sleep(1000);
            if (!text("首页").exists()) back();
            sleep(2000);
        }
    },

    doRedPacket: function() {
        Utils.goHome();
        Utils.log("寻找红包入口...");
        
        // 难点：寻找包含“100元”且包含“领”的卡片
        // 这里尝试查找所有“100元”相关的文本，然后找它的父容器
        let entry = null;
        let candidates = textMatches(/.*100元.*/).find();
        
        if (candidates.nonEmpty()) {
            for (let i = 0; i < candidates.length; i++) {
                let txt = candidates[i].text();
                // 你的描述：【100元免费领】或【100元 连续打卡...】
                if (txt.includes("领") || txt.includes("打卡")) {
                    entry = candidates[i];
                    break;
                }
            }
        }
        // 兜底
        if (!entry) entry = Utils.findWidget("text", "红包签到");

        if (Utils.clickNode(entry, "进入红包签到")) {
            sleep(5000);
            Utils.forceRefresh();
            
            // 目标：点击【点击签到】
            let sign = Utils.findWidget("text", "点击签到", 2000);
            if (sign) {
                Utils.clickNode(sign, "签到");
                sleep(3000);
            }
            if (textContains("已签到").exists()) Utils.log("红包: 已完成");
            
            back(); sleep(1000);
        }
    }
};

module.exports = SignTask;
