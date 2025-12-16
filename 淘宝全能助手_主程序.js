/**
 * @name 淘宝全能助手 V2.0.2 (稳定启动版)
 * @version 2.0.2
 * @description 修复启动报错，移除自动跳转 Activity 的硬编码，采用通用启动方式
 */

// ==================== 1. 全局配置 (CONFIG) ====================
const CONFIG = {
    appName: "淘宝",
    packageName: "com.taobao.taobao",
    
    // === 功能开关 (修改此处控制流程) ===
    ENABLE_SIGN: true,      // 开启签到
    ENABLE_TASK: false,     // 开启浏览任务 (默认关闭，测试签到无误后再开启)

    // === 策略配置 ===
    enableLayoutRefresh: true, // 开启防卡死刷新(针对88VIP等WebView)
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
        // 尝试请求截图权限，用于辅助刷新界面（非强制）
        if (CONFIG.enableLayoutRefresh) {
            if (!requestScreenCapture()) {
                toast("提示: 建议开启截图权限以提高脚本稳定性");
            }
        }
        console.show();
        this.log("脚本初始化完成");
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

    // [核心] 强制刷新布局 (解决WebView节点不更新问题)
    forceLayoutRefresh: function() {
        if (!CONFIG.enableLayoutRefresh) return;
        // 微动屏幕，唤醒Accessibility
        gestures([0, 50, [Runtime.w / 2, Runtime.h / 2], [Runtime.w / 2, Runtime.h / 2 + 2]]);
        sleep(300); 
    },

    // 智能查找控件
    findWidget: function(prop, value, timeout) {
        timeout = timeout || 1500;
        let deadLine = new Date().getTime() + timeout;
        
        while (new Date().getTime() < deadLine) {
            let uiObj = null;
            if (prop === "text") uiObj = textContains(value).findOnce() || descContains(value).findOnce();
            else if (prop === "match") uiObj = textMatches(value).findOnce() || descMatches(value).findOnce();
            
            if (uiObj) return uiObj;
            
            // 时间过半仍未找到，尝试刷新布局
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

    // 确保在首页
    ensureHomePage: function() {
        this.log("正在返回首页...");
        let maxTry = 6;
        while (maxTry--) {
            if (this.findWidget("text", "首页") && this.findWidget("text", "我的淘宝")) {
                if (!text("立即领取").exists()) return true;
            }
            back();
            sleep(1000);
            // 弹窗处理
            let closeBtn = textMatches(/(关闭|close|以后再说|取消|开心收下)/).findOnce();
            if (closeBtn) this.clickNode(closeBtn, "关闭弹窗");
        }
        this.restartApp();
        return true;
    },

    // [重点修复] 启动应用
    restartApp: function() {
        this.log("正在启动淘宝...");
        try {
            // 使用 launchPackage 替代 startActivity
            // 它可以自动寻找 App 的入口 Activity，避免报错
            let launched = app.launchPackage(CONFIG.packageName);
            if (!launched) {
                // 如果启动失败，尝试使用 launch (针对部分机型)
                app.launch(CONFIG.packageName);
            }
            
            waitForPackage(CONFIG.packageName);
            this.log("等待应用启动...");
            sleep(6000); // 给足启动时间
            
        } catch (e) {
            this.log("启动失败: " + e);
            console.error("启动异常详情: " + e);
            toast("启动淘宝失败，请手动打开");
        }
    },

    showWindow: function() {
        Runtime.floatWindow = floaty.window(
            <card cardCornerRadius="10dp" bg="#CC000000" w="200dp">
                <vertical padding="10">
                    <text text="淘宝助手 V2.0.2" textColor="#FFD700" textSize="14sp" textStyle="bold"/>
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
            sleep(5000); // 等待页面加载
            Utils.log(">>> 淘金币签到");
            
            // 尝试查找签到按钮
            let signBtn = Utils.findWidget("text", "签到领取") || Utils.findWidget("text", "点击签到");
            if (signBtn) {
                Utils.clickNode(signBtn, "点击签到");
                sleep(3000);
            } else if (textContains("今日已签").exists()) {
                Utils.log("检测到: 今日已签");
            } else {
                // 盲点策略：如果找不到按钮但也没显示已签，尝试点击屏幕中央偏上位置
                Utils.log("未找到按钮，尝试盲点");
                click(Runtime.w / 2, Runtime.h * 0.28);
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
            // 88VIP 经常卡顿，强制刷新两次布局
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
            // 双重保险退出
            if (!text("首页").exists()) back(); 
            sleep(2000);
        }
    }
};

// ==================== 4. 主入口 ====================

function main() {
    // 1. 初始化环境
    Utils.init();
    Utils.showWindow();
    
    // 2. 启动淘宝
    Utils.restartApp();

    try {
        // 3. 执行任务模块
        CoinService.run();
        VipService.run();
        // 如果开启了浏览任务，后续会执行 TaskService (此处略，保持代码简洁，专注修复)
        
        Utils.log("所有已开启任务完成");
    } catch (e) {
        Utils.log("运行异常: " + e);
        console.error(e);
    } finally {
        sleep(5000);
        // exit(); // 调试阶段建议注释掉 exit，方便看日志
    }
}

main();
