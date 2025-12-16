/**
 * @name 淘宝全能助手 V2.0.5 (全自动版)
 * @version 2.0.5
 * @description 启动即运行，无需点击，任务结束后自动退出
 */

const CONFIG = {
    packageName: "com.taobao.taobao",
    enableLayoutRefresh: true, // 88VIP防卡死开关
    
    // === 任务开关 ===
    ENABLE_SIGN: true,      
    ENABLE_TASK: false      
};

var Runtime = {
    w: device.width,
    h: device.height,
    floatWindow: null
};

var Utils = {
    init: function() {
        auto.waitFor();
        if (CONFIG.enableLayoutRefresh) {
            requestScreenCapture(false);
        }
        this.showWindow();
    },

    log: function(msg) {
        let d = new Date();
        let time = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
        console.log("[" + time + "] " + msg);
        if (Runtime.floatWindow) {
            ui.run(() => {
                try { Runtime.floatWindow.status.setText(msg); } catch(e){}
            });
        }
    },

    // 启动淘宝
    startApp: function() {
        this.log("正在启动淘宝...");
        if (!app.launchPackage(CONFIG.packageName)) {
            app.launch(CONFIG.packageName);
        }
        waitForPackage(CONFIG.packageName);
        this.log("等待应用加载...");
        sleep(6000);
    },

    forceRefresh: function() {
        if (!CONFIG.enableLayoutRefresh) return;
        gestures([0, 50, [Runtime.w/2, Runtime.h/2], [Runtime.w/2, Runtime.h/2+2]]);
        sleep(200);
    },

    findWidget: function(prop, value, timeout) {
        timeout = timeout || 1500;
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
                if (b.centerX()>0) res = click(b.centerX(), b.centerY());
                else {
                    let p = node.parent();
                    if (p && p.clickable()) res = p.click();
                }
            }
        } catch(e){}
        if (res && desc) this.log("点击: " + desc);
        return res;
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
            let close = textMatches(/(关闭|close|以后再说)/).findOnce();
            if (close) this.clickNode(close);
        }
        this.startApp();
        return true;
    },

    // 极简悬浮窗 (纯展示)
    showWindow: function() {
        if (Runtime.floatWindow) return;
        Runtime.floatWindow = floaty.window(
            <card cardCornerRadius="8dp" cardElevation="5dp" bg="#CC000000" w="180dp">
                <vertical padding="8">
                    <text text="淘宝助手运行中" textColor="#FFD700" textSize="13sp" textStyle="bold" gravity="center"/>
                    <text id="status" text="初始化..." textColor="#FFFFFF" textSize="11sp" marginTop="4" gravity="center"/>
                </vertical>
            </card>
        );
        Runtime.floatWindow.setPosition(100, 300);
        events.on("exit", () => {
            if(Runtime.floatWindow) Runtime.floatWindow.close();
        });
    }
};

// ================= 业务层 =================

var Tasks = {
    runAll: function() {
        if (CONFIG.ENABLE_SIGN) {
            this.doCoin();
            this.doVip();
        }
        // 浏览任务逻辑占位
        if (CONFIG.ENABLE_TASK) {
             Utils.log("浏览任务未开启");
        }
    },

    doCoin: function() {
        Utils.goHome();
        if (Utils.clickNode(Utils.findWidget("text", "领淘金币"), "进金币")) {
            sleep(5000);
            Utils.log(">>> 金币签到");
            let sign = Utils.findWidget("text", "签到领取") || Utils.findWidget("text", "点击签到");
            if (sign) {
                Utils.clickNode(sign, "签到");
                sleep(3000);
            } else {
                Utils.log("可能已签到");
            }
            back(); sleep(1000);
        }
    },

    doVip: function() {
        Utils.goHome();
        if (Utils.clickNode(Utils.findWidget("text", "88VIP"), "进VIP")) {
            Utils.log("进入VIP...");
            sleep(4000);
            Utils.forceRefresh();
            sleep(1000);
            
            if (Utils.findWidget("text", "明日领", 2000)) {
                Utils.log("VIP今日已签");
            } else {
                let targets = ["去签到", "立即签到", "领取积分"];
                let clicked = false;
                for (let t of targets) {
                    let n = Utils.findWidget("text", t, 1000);
                    if (n) {
                        Utils.clickNode(n, "签到");
                        clicked = true;
                        sleep(3000);
                        break;
                    }
                }
                if (!clicked) Utils.log("未找到VIP按钮");
            }
            back(); sleep(1000);
            if (!text("首页").exists()) back();
            sleep(2000);
        }
    }
};

// ================= 直接运行 =================

function main() {
    Utils.init();
    
    // 直接开始业务，不等待点击
    try {
        Utils.startApp();
        Tasks.runAll();
        Utils.log("任务全部完成");
        toast("脚本结束");
    } catch (e) {
        Utils.log("出错: " + e);
        console.error(e);
    } finally {
        sleep(2000);
        // 任务结束，彻底退出脚本，悬浮窗也会随之关闭
        exit();
    }
}

main();
