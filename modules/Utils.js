/**
 * @description 基础工具库
 */
var Config = require('./Config.js');

var Utils = {
    floatWin: null,

    init: function(win) {
        auto.waitFor();
        if (Config.enableLayoutRefresh) {
            requestScreenCapture(false);
        }
        this.showFloat();
        this.log("系统初始化...");
    },

    showFloat: function() {
        if (this.floatWin) return;
        this.floatWin = floaty.window(
            <card cardCornerRadius="10dp" bg="#CC000000" w="180dp">
                <vertical padding="10">
                    <text text="淘宝助手运行中" textColor="#FFD700" textSize="13sp" textStyle="bold" gravity="center"/>
                    <text id="status" text="准备就绪" textColor="#FFFFFF" textSize="11sp" marginTop="4" gravity="center"/>
                </vertical>
            </card>
        );
        this.floatWin.setPosition(50, 200);
        // 退出时自动关闭
        events.on("exit", () => {
            if (this.floatWin) this.floatWin.close();
        });
    },

    log: function(msg) {
        console.log(msg);
        if (this.floatWin) {
            ui.run(() => {
                try { this.floatWin.status.setText(msg); } catch(e){}
            });
        }
    },

    // 强制刷新 (防卡死)
    forceRefresh: function() {
        if (!Config.enableLayoutRefresh) return;
        gestures([0, 50, [device.width/2, device.height/2], [device.width/2, device.height/2+2]]);
        sleep(200);
    },

    findWidget: function(prop, value, timeout) {
        timeout = timeout || 2000;
        let deadLine = new Date().getTime() + timeout;
        while (new Date().getTime() < deadLine) {
            let obj = null;
            if (prop === "text") obj = textContains(value).findOnce() || descContains(value).findOnce();
            else if (prop === "match") obj = textMatches(value).findOnce() || descMatches(value).findOnce();
            
            if (obj) return obj;
            
            if (new Date().getTime() > deadLine - (timeout/2)) this.forceRefresh();
            sleep(200);
        }
        return null;
    },

    clickNode: function(node, desc) {
        if (!node) return false;
        let res = false;
        try {
            if (node.clickable()) res = node.click();
            else {
                let b = node.bounds();
                if (b.centerX() > 0) res = click(b.centerX(), b.centerY());
                else {
                    let p = node.parent();
                    if (p && p.clickable()) res = p.click();
                }
            }
        } catch(e) {}
        if (res && desc) this.log("点击: " + desc);
        return res;
    },

    startApp: function() {
        this.log("启动淘宝...");
        if (!app.launchPackage(Config.packageName)) {
            app.launch(Config.packageName);
        }
        waitForPackage(Config.packageName);
        sleep(6000);
    },

    goHome: function() {
        this.log("返回首页...");
        let max = 6;
        while (max--) {
            if (this.findWidget("text", "首页") && this.findWidget("text", "我的淘宝")) {
                if (!text("立即领取").exists()) return true;
            }
            back();
            sleep(1000);
            let close = textMatches(/(关闭|close|以后再说|取消)/).findOnce();
            if (close) this.clickNode(close, "关闭弹窗");
        }
        this.startApp();
        return true;
    }
};

module.exports = Utils;
