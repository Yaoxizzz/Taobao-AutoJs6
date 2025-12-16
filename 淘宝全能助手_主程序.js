/**
 * @name 淘宝全能助手 V20 (完整重构版)
 * @version 2.0.0
 * @description 融合V18业务逻辑与V19防卡死架构，支持通过开关控制测试阶段
 */

// ==================== 1. 全局配置 (CONFIG) ====================
const CONFIG = {
    appName: "淘宝",
    packageName: "com.taobao.taobao",
    
    // === 核心开关 (修改此处来控制流程) ===
    ENABLE_SIGN: true,      // [阶段一] 开启签到 (当前测试重点)
    ENABLE_TASK: false,     // [阶段二] 开启浏览任务 (暂时关闭)

    // === 策略配置 ===
    // 布局刷新策略：在88VIP等WebView页面找不到控件时，是否尝试微动屏幕
    // 这解决了页面加载完但脚本看不到控件的问题
    enableLayoutRefresh: true,
    
    // 浏览任务配置
    browseTime: 22000, 
    searchKeywords: ["袜子", "手机壳", "抽纸", "洗衣液", "零食", "数据线"],
    
    // 调试模式
    debug: true
};

// 运行时状态
const Runtime = {
    w: device.width,
    h: device.height,
    floatWindow: null
};

// ==================== 2. 基础设施层 (Infrastructure) ====================

var Utils = {
    init: function() {
        auto.waitFor();
        // 建议开启截图权限，这对解决WebView卡顿非常有效
        if (CONFIG.enableLayoutRefresh) {
            if (!requestScreenCapture()) {
                toastLog("提示: 开启截图权限可极大提高88VIP页面的稳定性");
            }
        }
        console.show();
        this.log("架构初始化完成");
    },

    log: function(msg, subMsg) {
        let date = new Date();
        let time = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
        let logStr = "[" + time + "] " + msg + (subMsg ? " - " + subMsg : "");
        if (CONFIG.debug) console.log(logStr);
        if (Runtime.floatWindow) {
            ui.run(() => {
                Runtime.floatWindow.status.setText(msg);
                if (subMsg) Runtime.floatWindow.subStatus.setText(subMsg);
            });
        }
    },

    // [核心技术] 强制刷新布局 (防卡死)
    forceLayoutRefresh: function() {
        if (!CONFIG.enableLayoutRefresh) return;
        // 模拟极微小的滑动，强制触发界面重绘，唤醒Accessibility节点
        gestures([0, 50, [Runtime.w / 2, Runtime.h / 2], [Runtime.w / 2, Runtime.h / 2 + 2]]);
        sleep(300); 
    },

    // 智能查找控件 (带刷新机制)
    findWidget: function(prop, value, timeout) {
        timeout = timeout || 1500;
        let deadLine = new Date().getTime() + timeout;
        
        while (new Date().getTime() < deadLine) {
            let uiObj = null;
            if (prop === "text") uiObj = textContains(value).findOnce() || descContains(value).findOnce();
            else if (prop === "match") uiObj = textMatches(value).findOnce() || descMatches(value).findOnce();
            else if (prop === "desc") uiObj = descContains(value).findOnce();
            
            if (uiObj) return uiObj;
            
            // 时间过半仍未找到，尝试刷新布局
            if (new Date().getTime() > deadLine - (timeout / 3)) {
                this.forceLayoutRefresh();
            }
            sleep(200);
        }
        return null;
    },

    // 智能点击
    clickNode: function(node, descStr) {
        if (!node) return false;
        let res = false;
        try {
            if (node.clickable()) {
                res = node.click();
            } else {
                let bounds = node.bounds();
                if (bounds.centerX() > 0 && bounds.centerY() > 0 && bounds.height() > 0) {
                    res = click(bounds.centerX(), bounds.centerY());
                } else {
                    let p = node.parent();
                    if (p && p.clickable()) res = p.click();
                }
            }
        } catch(e) { }
        if (res && descStr) this.log("点击: " + descStr);
        return res;
    },

    // 递归获取文本 (保留自V18)
    getAllText: function(view) {
        if (!view) return "";
        let str = "";
        try {
            let t = view.text();
            let d = view.desc();
            if (t && !t.startsWith("O1CN") && t.length > 1) str += t + " ";
            if (d && !d.startsWith("O1CN") && d.length > 1) str += d + " ";
            let children = view.children();
            if (children && children.length > 0) {
                for (let i = 0; i < children.length; i++) {
                    str += this.getAllText(children[i]);
                }
            }
        } catch (e) {}
        return str;
    },

    // 确保在首页
    ensureHomePage: function() {
        this.log("检查首页状态...");
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

    restartApp: function() {
        this.log("重启淘宝...");
        app.startActivity({
            action: "android.intent.action.MAIN",
            packageName: CONFIG.packageName,
            className: "com.taobao.taobao.Welcome"
        });
        waitForPackage(CONFIG.packageName);
        sleep(6000);
    },

    // 模拟浏览滑动
    simulateScroll: function(duration) {
        let startTime = new Date().getTime();
        while (new Date().getTime() - startTime < duration) {
            swipe(Runtime.w / 2, Runtime.h * 0.8, Runtime.w / 2, Runtime.h * 0.3, 1200);
            sleep(random(2000, 4000));
            // 偶尔回滑
            if (random(0, 10) > 8) {
                swipe(Runtime.w / 2, Runtime.h * 0.3, Runtime.w / 2, Runtime.h * 0.6, 1000);
                sleep(1000);
            }
        }
    },

    showWindow: function() {
        Runtime.floatWindow = floaty.window(
            <card cardCornerRadius="10dp" bg="#CC000000" w="220dp">
                <vertical padding="10">
                    <text text="淘宝全能助手 V20" textColor="#FFD700" textSize="14sp" textStyle="bold"/>
                    <text id="status" text="初始化..." textColor="#FFFFFF" textSize="13sp" marginTop="5"/>
                    <text id="subStatus" text="等待运行" textColor="#CCCCCC" textSize="10sp" marginTop="2"/>
                </vertical>
            </card>
        );
        Runtime.floatWindow.setPosition(50, 200);
    }
};

// ==================== 3. 核心业务: 通用任务循环 (复活 V18) ====================

var TaskRunner = {
    // 浏览任务通用循环
    // listName: 列表名称(日志用)
    // entryKeyword: 列表如果消失，用于复活的入口文字
    runLoop: function(listName, entryKeyword) {
        let count = 0;
        let failCount = 0;

        while (count < 30) {
            // 1. 复活列表检查
            if (entryKeyword && failCount > 1) {
                let entry = text(entryKeyword).findOnce();
                if (entry) {
                    Utils.clickNode(entry, "重新打开任务列表");
                    sleep(2500);
                }
            }

            // 2. 查找任务按钮 (去完成/去浏览)
            // 增加刷新机制，防止列表卡死
            let allBtns = textMatches(/(去完成|去浏览|去观看|浏览.*s)/).find();
            if (allBtns.empty()) {
                Utils.forceLayoutRefresh(); // [V19技术] 没找到任务时刷新一下
                allBtns = textMatches(/(去完成|去浏览|去观看|浏览.*s)/).find();
            }

            let targetBtn = null;
            let isSearch = false;

            if (allBtns.nonEmpty()) {
                for (let i = 0; i < allBtns.length; i++) {
                    let btn = allBtns[i];
                    // V18 修复逻辑：只获取父级行文本
                    let rowText = "";
                    let p = btn.parent();
                    if (p) rowText = Utils.getAllText(p);

                    // 黑名单
                    if (rowText.match(/(快手|直播|游戏|斗地主|消消乐|农场|连连看|魔法|点淘|开通|办卡|充值|礼包)/)) {
                        continue;
                    }
                    // 白名单
                    if (rowText.match(/(浏览|搜|逛|看|View|Browse|搜索|查询|视频)/) || 
                        rowText.match(/\d+秒/) || 
                        rowText.match(/\d+\/\d+/)) {
                        
                        if (rowText.match(/(搜一搜|搜索|查询)/)) isSearch = true;
                        targetBtn = btn;
                        Utils.log(listName, "任务: " + rowText.substr(0, 10));
                        break;
                    }
                }
            }

            // 3. 执行动作
            if (targetBtn) {
                Utils.clickNode(targetBtn, "去完成");
                failCount = 0;
                sleep(4000);

                // 处理搜索任务
                let input = className("android.widget.EditText").findOnce();
                let searchBtn = text("搜索").findOnce() || desc("搜索").findOnce();
                if ((isSearch || input) && searchBtn) {
                    if (input) {
                        let key = CONFIG.searchKeywords[random(0, CONFIG.searchKeywords.length-1)];
                        Utils.log("执行搜索", key);
                        input.setText(key);
                        sleep(500);
                        Utils.clickNode(searchBtn, "搜索按钮");
                        sleep(3000);
                    }
                }

                // 浏览
                Utils.log("浏览中...", CONFIG.browseTime / 1000 + "秒");
                Utils.simulateScroll(CONFIG.browseTime);

                // 返回
                Utils.log("任务结束", "返回");
                back();
                sleep(2000);
                
                // 有时候搜索需要返回两次
                if (text("搜索").exists() || className("android.widget.EditText").exists()) {
                    back(); sleep(1500);
                }
                
                // 处理“确认离开”
                if (text("确认离开").exists()) click("确认离开");

                count++;
            } else {
                // 没找到任务，滑动列表找找
                failCount++;
                Utils.log(listName, "滑动查找任务..." + failCount);
                swipe(Runtime.w / 2, Runtime.h * 0.8, Runtime.w / 2, Runtime.h * 0.3, 1000);
                sleep(2000);
                Utils.forceLayoutRefresh(); // 滑动后刷新

                if (failCount >= 4) {
                    Utils.log(listName, "无可做任务，退出");
                    break;
                }
            }
        }
    }
};

// ==================== 4. 业务模块 (Services) ====================

// --- A. 淘金币模块 ---
var CoinService = {
    // 进场
    enter: function() {
        Utils.ensureHomePage();
        let entry = Utils.findWidget("text", "领淘金币");
        if (Utils.clickNode(entry, "首页->淘金币")) {
            Utils.log("等待淘金币加载...");
            sleep(5000);
            return true;
        }
        return false;
    },

    // 签到逻辑
    doSign: function() {
        if (!CONFIG.ENABLE_SIGN) return;
        Utils.log(">>> 淘金币: 签到");
        
        let signBtn = Utils.findWidget("text", "签到领取") || Utils.findWidget("text", "点击签到");
        if (signBtn) {
            Utils.clickNode(signBtn, "点击签到");
            sleep(3000);
        } else if (textContains("今日已签").exists()) {
            Utils.log("淘金币已签到");
        } else {
            // 盲点
            click(Runtime.w / 2, Runtime.h * 0.28);
        }
    },

    // 任务逻辑
    doTask: function() {
        if (!CONFIG.ENABLE_TASK) return;
        Utils.log(">>> 淘金币: 浏览任务");
        
        let taskEntry = text("赚更多金币").findOnce() || text("做任务赚金币").findOnce();
        if (!taskEntry) {
            // 尝试点击一下签到按钮位置刷新
            let signBtn = text("点击签到").findOnce();
            if (signBtn) Utils.clickNode(signBtn, "刷新入口");
            taskEntry = text("赚更多金币").findOnce();
        }

        if (Utils.clickNode(taskEntry, "打开任务列表")) {
            sleep(3000);
            TaskRunner.runLoop("淘金币", "赚更多金币");
        }
    }
};

// --- B. 88VIP 模块 (重灾区修复) ---
var VipService = {
    enter: function() {
        Utils.ensureHomePage();
        let entry = Utils.findWidget("text", "88VIP");
        if (Utils.clickNode(entry, "首页->88VIP")) {
            Utils.log("进入88VIP，强制刷新布局...");
            // [Fix] 进场强制刷新，解决UC内核不更新节点问题
            sleep(3000);
            Utils.forceLayoutRefresh();
            sleep(2000);
            Utils.forceLayoutRefresh();
            return true;
        }
        return false;
    },

    doSign: function() {
        if (!CONFIG.ENABLE_SIGN) return;
        Utils.log(">>> 88VIP: 签到");

        // 1. 检查已完成状态
        if (Utils.findWidget("text", "明日领", 2000)) {
            Utils.log("检测到'明日领'，跳过");
            return;
        }

        // 2. 查找签到按钮
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
        
        if (!clicked) {
            Utils.log("未找到文字按钮，尝试积分球区域");
            // 尝试找数字积分区域点击
            let score = textMatches(/\d+/).depth(12).findOnce(); 
            if(score) Utils.clickNode(score, "尝试点击积分");
        }
    },

    doTask: function() {
        if (!CONFIG.ENABLE_TASK) return;
        Utils.log(">>> 88VIP: 浏览任务");
        
        let taskEntry = Utils.findWidget("text", "每日领") || Utils.findWidget("text", "做任务");
        if (Utils.clickNode(taskEntry, "打开任务列表")) {
            sleep(3000);
            TaskRunner.runLoop("88VIP", null);
        }
    }
};

// --- C. 红包签到模块 ---
var RedPacketService = {
    enter: function() {
        Utils.ensureHomePage();
        sleep(2000); // 等待首页完全恢复
        
        let entry = Utils.findWidget("text", "红包签到") || Utils.findWidget("desc", "红包签到");
        if (Utils.clickNode(entry, "首页->红包签到")) {
            sleep(5000);
            Utils.forceLayoutRefresh();
            return true;
        }
        return false;
    },

    doSign: function() {
        if (!CONFIG.ENABLE_SIGN) return;
        Utils.log(">>> 红包: 签到");

        let close = Utils.findWidget("match", "(关闭|close)");
        if (close) Utils.clickNode(close, "关闭弹窗");

        let signBtn = Utils.findWidget("text", "立即签到") || Utils.findWidget("text", "点击签到");
        if (signBtn) {
            Utils.clickNode(signBtn, "点击签到");
            sleep(3000);
        }
        
        // 连续打卡检测
        if (textContains("赚元宝").exists()) {
            Utils.log("可能已签到");
        }
    },

    doTask: function() {
        if (!CONFIG.ENABLE_TASK) return;
        Utils.log(">>> 红包: 任务");
        
        let taskEntry = text("赚元宝").findOnce() || textContains("做任务").findOnce();
        if (Utils.clickNode(taskEntry, "打开任务列表")) {
            sleep(3000);
            TaskRunner.runLoop("红包", "赚元宝");
            
            let close = desc("关闭").findOnce();
            if (close) close.click();
        }
    }
};

// ==================== 5. 主程序 (Main) ====================

function main() {
    Utils.init();
    Utils.showWindow();
    Utils.restartApp();

    try {
        // --- 模块1: 淘金币 ---
        if (CoinService.enter()) {
            CoinService.doSign();
            CoinService.doTask();
            back(); sleep(1000);
        }

        // --- 模块2: 88VIP ---
        if (VipService.enter()) {
            VipService.doSign();
            VipService.doTask();
            
            // 安全退出88VIP (可能需要按多次)
            Utils.log("退出88VIP...");
            if (!text("首页").exists()) {
                back(); sleep(1000);
                if (!text("首页").exists()) back();
            }
            sleep(2000);
        }

        // --- 模块3: 红包签到 ---
        if (RedPacketService.enter()) {
            RedPacketService.doSign();
            RedPacketService.doTask();
            back();
        }

        Utils.log("所有流程结束");

    } catch (e) {
        console.error(e);
        Utils.log("异常终止: " + e);
    } finally {
        // exit(); // 调试时不强制退出，方便看日志
    }
}

main();