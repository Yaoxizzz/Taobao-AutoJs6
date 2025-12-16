/**
 * @name 淘宝全能助手_启动器 V7.0
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
        // 初始化 (会显示悬浮窗)
        Utils.init();
        
        // 启动应用
        Utils.startApp();

        // 执行签到
        if (Config.ENABLE_SIGN) {
            SignTask.run();
        }

        // 执行浏览
        if (Config.ENABLE_TASK) {
            Utils.log("浏览任务未开启");
        }

        Utils.log("所有流程结束");
        toast("脚本运行完毕");

    } catch (e) {
        Utils.log("主程序异常: " + e);
        console.error(e);
    } finally {
        sleep(2000);
        exit(); // 自动退出并关闭悬浮窗
    }
}

main();
