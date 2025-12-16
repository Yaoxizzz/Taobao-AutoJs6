/**
 * @name 淘宝助手_启动器
 * @version 7.0.0
 * @description 开局即跑：加载模块 -> 启动APP -> 执行任务 -> 自动退出
 */

// 1. 导入模块
var Config = require('./modules/Config.js');
var Utils = require('./modules/Utils.js');
var SignTask = require('./modules/SignTask.js');

// 2. 主流程
function main() {
    try {
        // 初始化 (会显示 "淘宝助手运行中" 的小悬浮窗)
        Utils.init();
        
        // 启动应用
        Utils.startApp();

        // 任务分发
        if (Config.ENABLE_SIGN) {
            SignTask.run();
        }

        if (Config.ENABLE_TASK) {
            Utils.log("浏览任务暂未开启");
            // BrowseTask.run();
        }

        Utils.log("🎉 所有任务执行完毕");
        toast("脚本运行结束");

    } catch (e) {
        Utils.log("❌ 异常: " + e);
        console.error(e);
    } finally {
        sleep(2000);
        // 任务结束，自动彻底退出脚本，悬浮窗随之消失
        exit(); 
    }
}

main();
