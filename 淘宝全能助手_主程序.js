/**
 * @name 淘宝全能助手 V20 (修复版)
 * @version 2.0.1
 * @description 修复Activity启动报错，集成V19防卡死架构
 */

// ==================== 1. 全局配置 (CONFIG) ====================
const CONFIG = {
    appName: "淘宝",
    packageName: "com.taobao.taobao",
    
    // === 功能开关 ===
    ENABLE_SIGN: true,      // 签到模块
    ENABLE_TASK: false,     // 浏览任务模块 (测试时建议先关掉)

    // === 策略配置 ===
    enableLayoutRefresh: true, // 开启防卡死刷新
    browseTime: 22000, 
    searchKeywords: ["袜子", "手机壳", "抽纸", "洗衣液", "零食", "数据线"],
    debug: true
};

// 运行时状态
const Runtime = {
    w: device.width,
    h: device.height,
    floatWindow: null
};

// ==================== 2. 基础设施层 ====================

var Utils = {
    init: function() {
        auto.waitFor();
        if (CONFIG.enableLayoutRefresh) {
            // 尝试请求截图权限，失败也不强制退出
            if (!requestScreenCapture()) {
                toast("建议开启截图权限以稳定运行");
            }
        }
        console.show();
        this.log("脚本初始化...");
    },

    log: function(msg) {
        let date = new Date();
        let time = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
        console.log("[" + time + "] " + msg);
        if (Runtime.floatWindow) {
            ui.run(() => {
                Runtime.floatWindow.status.setText(msg);
            });
        }
    },

    // [核心] 强制刷新布局
    forceLayoutRefresh: function() {
        if (!CONFIG.enableLayoutRefresh) return;
        // 微动屏幕，唤醒Accessibility
        gestures([0, 50, [Runtime.w / 2, Runtime.h / 2], [Runtime.w / 2, Runtime.h / 2 + 2]]);
        sleep(300); 
    },

    findWidget: function(prop, value, timeout) {
        timeout = timeout || 1500;
        let deadLine = new Date().getTime() + timeout;
        while (new Date().getTime() < deadLine) {
            let uiObj = null;
            if (prop === "text") uiObj = textContains(value).findOnce() || descContains(value).findOnce();
            else if (prop === "match") uiObj = textMatches(value).findOnce() || descMatches(value).findOnce();
            
            if (uiObj) return uiObj;
            
            if (new Date().getTime() > deadLine - (timeout / 3)) {
                this.forceLayoutRefresh();
            }
            sleep(200);
        }
        return null;
    },

    clickNode: function(node, descStr) {
        if (!node) return false;
        let res = false;
        try {
            if (node.clickable()) res = node.click();
            else {
                let bounds = node.bounds();
                if (bounds.centerX() > 0 && bounds.centerY() > 0) res = click(bounds.centerX(), bounds.centerY());
                else {
                    let p = node.parent();
                    if (p && p.clickable()) res = p.click();
                }
            }
        } catch(e) { }
        if (res && descStr) this.log("点击: " + descStr);
        return res;
    },

    ensureHomePage: function() {
        this.log("返回首页...");
        let maxTry = 5;
        while (maxTry--) {
            if (this.findWidget("text", "首页") && this.findWidget("text", "我的淘宝")) {
                if (!text("立即领取").exists()) return true;
            }
            back();
            sleep(1000);
            let closeBtn = textMatches(/(关闭|close|以后再说|取消)/).findOnce();
            if (closeBtn) this.clickNode(closeBtn, "关闭弹窗");
        }
        this.restartApp();
        return true;
    },

    // [修复] 使用兼容性更好的启动方式
    restartApp: function() {
        this.log("正在启动淘宝...");
        // 使用 launchPackage 而不是 startActivity，避免 ActivityNotFound 错误
        app.launchPackage(CONFIG.packageName);
        waitForPackage(CONFIG.packageName);
        sleep(6000); // 等待启动广告
    },

    showWindow: function() {
        Runtime.floatWindow = floaty.window(
            <card cardCornerRadius="10dp" bg="#CC000000" w="200dp">
                <vertical padding="10">
                    <text text="淘宝助手 V2.0.1" textColor="#FFD700" textSize="14sp" textStyle="bold"/>
                    <text id="status" text="准备运行..." textColor="#FFFFFF" textSize="12sp" marginTop="5"/>
                </vertical>
            </card>
        );
        Runtime.floatWindow.setPosition(50, 200);
    }
};

// ==================== 3. 业务逻辑层 ====================

var CoinService = {
    run: function() {
        if (!CONFIG.ENABLE_SIGN) return;
        Utils.ensureHomePage();
        let entry = Utils.findWidget("text", "领淘金币");
        if (Utils.clickNode(entry, "进入淘金币")) {
            sleep(5000);
            Utils.log(">>> 淘金币签到");
            let signBtn = Utils.findWidget("text", "签到领取") || Utils.findWidget("text", "点击签到");
            if (signBtn) {
                Utils.clickNode(signBtn, "点击签到");
                sleep(3000);
            } else {
                Utils.log("可能已签到");
            }
            back(); sleep(1000);
        }
    }
};

var VipService = {
    run: function() {
        if (!CONFIG.ENABLE_SIGN) return;
        Utils.ensureHomePage();
        let entry = Utils.findWidget("text", "88VIP");
        if (Utils.clickNode(entry, "进入88VIP")) {
            Utils.log("进入88VIP (WebView)...");
            sleep(4000);
            // 强制刷新两次，唤醒WebView
            Utils.forceLayoutRefresh();
            sleep(2000);
            Utils.forceLayoutRefresh();

            if (Utils.findWidget("text", "明日领", 2000)) {
                Utils.log("88VIP: 今日已签");
            } else {
                let targets = ["去签到", "立即签到", "领取积分"];
                let clicked = false;
                for (let t of targets) {
                    let node = Utils.findWidget("text", t, 1000);
                    if (node) {
                        Utils.clickNode(node, "88VIP-" + t);
                        clicked = true;
                        sleep(3000);
                        break;
                    }
                }
                if (!clicked) Utils.log("未找到88VIP签到按钮");
            }
            
            Utils.log("退出88VIP");
            back(); sleep(1000);
            if (!text("首页").exists()) back(); 
            sleep(2000);
        }
    }
};

// ==================== 4. 主入口 ====================

function main() {
    Utils.init();
    Utils.showWindow();
    Utils.restartApp();

    try {
        CoinService.run();
        VipService.run();
        Utils.log("所有任务完成");
    } catch (e) {
        Utils.log("运行异常: " + e);
        console.error(e);
    } finally {
        sleep(5000);
        // exit(); // 调试时不退出
    }
}

main();
