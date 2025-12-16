/**
 * @name 淘宝全能助手 V2.0.4 (等待指令版)
 * @version 2.0.4
 * @description 启动后仅显示悬浮窗，等待用户手动点击开始
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
    floatWindow: null,
    isRunning: false
};

// ================= 工具类 =================

var Utils = {
    init: function() {
        auto.waitFor();
        if (CONFIG.enableLayoutRefresh) {
            requestScreenCapture(false);
        }
        FloatWin.init();
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

    startApp: function() {
        this.log("启动淘宝...");
        if (!app.launchPackage(CONFIG.packageName)) {
            app.launch(CONFIG.packageName);
        }
        waitForPackage(CONFIG.packageName);
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
        this.log("回首页...");
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
    }
};

// ================= 悬浮窗 UI =================

var FloatWin = {
    init: function() {
        if (Runtime.floatWindow) return;
        
        Runtime.floatWindow = floaty.window(
            <card cardCornerRadius="10dp" cardElevation="5dp" bg="#CC000000" w="200dp">
                <vertical padding="10">
                    <text text="淘宝助手 V2.0.4" textColor="#FFD700" textSize="14sp" textStyle="bold" gravity="center"/>
                    <text id="status" text="等待开始..." textColor="#FFFFFF" textSize="12sp" marginTop="5" gravity="center"/>
                    <horizontal gravity="center" marginTop="8">
                        <button id="btn_start" text="开始运行" w="auto" h="40dp" style="Widget.AppCompat.Button.Colored"/>
                        <button id="btn_stop" text="退出脚本" w="auto" h="40dp" marginLeft="10"/>
                    </horizontal>
                </vertical>
            </card>
        );

        Runtime.floatWindow.setPosition(100, 300);

        // 点击开始：执行任务
        Runtime.floatWindow.btn_start.click(() => {
            if (Runtime.isRunning) return;
            Runtime.isRunning = true;
            // 隐藏开始按钮，防止重复点击
            Runtime.floatWindow.btn_start.setVisibility(8); // 8=GONE
            
            threads.start(function() {
                try {
                    MainLogic.run();
                } catch(e) {
                    Utils.log("出错: " + e);
                } finally {
                    Runtime.isRunning = false;
                    ui.run(() => { 
                        try{ 
                            Runtime.floatWindow.status.setText("任务结束"); 
                            Runtime.floatWindow.btn_start.setVisibility(0); // 恢复显示
                        }catch(e){}
                    });
                }
            });
        });

        // 点击退出：直接关闭
        Runtime.floatWindow.btn_stop.click(() => {
            exit();
        });
        
        events.on("exit", () => {
            if(Runtime.floatWindow) Runtime.floatWindow.close();
        });
    }
};

// ================= 任务逻辑 =================

var MainLogic = {
    run: function() {
        Utils.log("开始执行...");
        Utils.startApp();

        if (CONFIG.ENABLE_SIGN) {
            this.doCoin();
            this.doVip();
        }
        
        if (CONFIG.ENABLE_TASK) {
            Utils.log("浏览任务暂未开启");
        }
        
        Utils.log("所有流程完毕");
        toast("结束");
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

// 保持脚本运行，等待悬浮窗操作
Utils.init();
setInterval(() => {}, 1000);
