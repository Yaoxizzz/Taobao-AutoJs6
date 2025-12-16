/**
 * @name 淘宝全能助手 V2.0.3 (正式版)
 * @version 2.0.3
 * @description 集成防卡死、自动启动、状态机管理的完整版本
 */

// ================= 配置区 =================
const CONFIG = {
    appName: "淘宝",
    packageName: "com.taobao.taobao",
    
    // === 任务开关 ===
    ENABLE_SIGN: true,      // 签到任务
    ENABLE_TASK: false,     // 浏览任务 (测试稳定后请改为 true)

    // === 运行参数 ===
    enableLayoutRefresh: true, // 开启防WebView卡死
    browseTime: 22000, 
    searchKeywords: ["袜子", "手机壳", "抽纸", "洗衣液", "零食", "数据线"]
};

// 全局状态
const Runtime = {
    w: device.width,
    h: device.height,
    floatWindow: null
};

// ================= 工具层 =================

var Utils = {
    init: function() {
        auto.waitFor();
        // 尝试请求截图(辅助刷新)，失败也不阻塞
        if (CONFIG.enableLayoutRefresh) {
            requestScreenCapture(false); 
        }
        this.showWindow();
        this.log("脚本启动中...");
    },

    log: function(msg) {
        let date = new Date();
        let time = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
        console.log("[" + time + "] " + msg);
        if (Runtime.floatWindow) {
            ui.run(() => {
                try {
                    Runtime.floatWindow.status.setText(msg);
                } catch(e){}
            });
        }
    },

    // 强制刷新页面布局 (核心防卡死)
    forceLayoutRefresh: function() {
        if (!CONFIG.enableLayoutRefresh) return;
        // 极微小滑动，欺骗系统重绘
        gestures([0, 50, [Runtime.w/2, Runtime.h/2], [Runtime.w/2, Runtime.h/2+2]]);
        sleep(200);
    },

    // 智能找控件
    findWidget: function(prop, value, timeout) {
        timeout = timeout || 1500;
        let deadLine = new Date().getTime() + timeout;
        while (new Date().getTime() < deadLine) {
            let uiObj = null;
            if (prop === "text") uiObj = textContains(value).findOnce() || descContains(value).findOnce();
            else if (prop === "match") uiObj = textMatches(value).findOnce() || descMatches(value).findOnce();
            
            if (uiObj) return uiObj;
            
            // 超时刷新
            if (new Date().getTime() > deadLine - (timeout/2)) {
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
                let b = node.bounds();
                if (b.centerX()>0 && b.centerY()>0) res = click(b.centerX(), b.centerY());
                else {
                    let p = node.parent();
                    if (p && p.clickable()) res = p.click();
                }
            }
        } catch(e) {}
        if (res && descStr) this.log("点击: " + descStr);
        return res;
    },

    // 启动淘宝 (兼容所有安卓版本)
    startApp: function() {
        this.log("启动淘宝...");
        // 优先使用 launchPackage，这是最稳的方法
        if (!app.launchPackage(CONFIG.packageName)) {
            // 备用方案
            app.launch(CONFIG.packageName);
        }
        waitForPackage(CONFIG.packageName);
        sleep(6000); // 等待开屏
    },

    // 回到首页
    goHome: function() {
        this.log("返回首页...");
        let max = 6;
        while (max--) {
            if (this.findWidget("text", "首页") && this.findWidget("text", "我的淘宝")) {
                if (!text("立即领取").exists()) return true;
            }
            back();
            sleep(1000);
            // 弹窗关闭
            let close = textMatches(/(关闭|close|以后再说|取消)/).findOnce();
            if (close) this.clickNode(close);
        }
        this.startApp();
        return true;
    },

    showWindow: function() {
        if (Runtime.floatWindow) return;
        Runtime.floatWindow = floaty.window(
            <card cardCornerRadius="10dp" bg="#CC000000" w="200dp">
                <vertical padding="10">
                    <text text="淘宝助手 V2.0.3" textColor="#FFD700" textSize="14sp" textStyle="bold"/>
                    <text id="status" text="准备就绪" textColor="#FFFFFF" textSize="12sp" marginTop="5"/>
                </vertical>
            </card>
        );
        Runtime.floatWindow.setPosition(50, 200);
        // 脚本结束自动关闭悬浮窗
        events.on("exit", function(){
            if(Runtime.floatWindow) Runtime.floatWindow.close();
        });
    }
};

// ================= 业务层 =================

var Tasks = {
    // 淘金币
    coin: function() {
        if (!CONFIG.ENABLE_SIGN) return;
        Utils.goHome();
        if (Utils.clickNode(Utils.findWidget("text", "领淘金币"), "进入金币")) {
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

    // 88VIP (重点防护)
    vip: function() {
        if (!CONFIG.ENABLE_SIGN) return;
        Utils.goHome();
        if (Utils.clickNode(Utils.findWidget("text", "88VIP"), "进入VIP")) {
            Utils.log("加载VIP页面...");
            sleep(4000);
            Utils.forceLayoutRefresh(); // 强制刷新防止卡死
            sleep(1000);

            if (Utils.findWidget("text", "明日领", 2000)) {
                Utils.log("VIP: 今日已签");
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
                if (!clicked) Utils.log("未找到VIP签到按钮");
            }
            back(); sleep(1000);
            if (!text("首页").exists()) back();
            sleep(2000);
        }
    }
};

// ================= 入口 =================

function main() {
    Utils.init();
    Utils.startApp();

    try {
        Tasks.coin();
        Tasks.vip();
        
        Utils.log("所有任务完成");
        toast("脚本运行结束");
    } catch (e) {
        Utils.log("异常: " + e);
        console.error(e);
    } finally {
        sleep(3000);
        exit(); // 自动退出，关闭悬浮窗
    }
}

main();
