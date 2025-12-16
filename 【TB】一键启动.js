/**
 * @name 淘宝全能助手_启动器 V7.0
 * @version 7.0.0
 * @description 手动模式：加载模块 -> 显示悬浮窗 -> 等待指令
 */

// 导入模块
var Config = require('./modules/Config.js');
var Utils = require('./modules/Utils.js');
var SignTask = require('./modules/SignTask.js');

var Runtime = {
    isRunning: false
};

// 悬浮窗 UI
var floatWin = null;

function showFloat() {
    if (floatWin) return;
    floatWin = floaty.window(
        <card cardCornerRadius="10dp" cardElevation="5dp" bg="#CC000000" w="200dp">
            <vertical padding="10">
                <text text="淘宝助手 V7.0" textColor="#FFD700" textSize="14sp" textStyle="bold" gravity="center"/>
                <text id="status" text="等待指令..." textColor="#FFFFFF" textSize="12sp" marginTop="5" gravity="center"/>
                <horizontal gravity="center" marginTop="8">
                    <button id="btn_start" text="开始运行" w="auto" h="35dp" style="Widget.AppCompat.Button.Colored"/>
                    <button id="btn_stop" text="退出" w="auto" h="35dp" marginLeft="10"/>
                </horizontal>
            </vertical>
        </card>
    );
    floatWin.setPosition(100, 400);

    // 按钮事件：开始
    floatWin.btn_start.click(() => {
        if (Runtime.isRunning) {
            toast("任务正在运行中...");
            return;
        }
        Runtime.isRunning = true;
        // 隐藏开始按钮，防止误触
        ui.run(()=> floatWin.btn_start.setVisibility(8)); 
        
        threads.start(function() {
            try {
                runTasks();
            } catch(e) {
                updateStatus("出错: " + e);
                console.error(e);
            } finally {
                Runtime.isRunning = false;
                updateStatus("任务结束");
                // 恢复按钮显示
                ui.run(()=> floatWin.btn_start.setVisibility(0));
            }
        });
    });

    // 按钮事件：退出
    floatWin.btn_stop.click(() => {
        exit();
    });
}

function updateStatus(msg) {
    ui.run(() => {
        if (floatWin) floatWin.status.setText(msg);
    });
    console.log(msg);
}

// 核心任务流
function runTasks() {
    updateStatus("正在初始化...");
    Utils.init(floatWin); // 传递悬浮窗引用给工具类
    
    Utils.startApp();
    
    if (Config.ENABLE_SIGN) {
        SignTask.run();
    }
    
    if (Config.ENABLE_TASK) {
        updateStatus("浏览任务未开启");
    }
    
    updateStatus("所有任务完成");
    toast("完成");
}

// 入口
auto.waitFor();
showFloat();

// 保持脚本运行，等待悬浮窗事件
setInterval(() => {}, 1000);

// 退出清理
events.on("exit", () => {
    if(floatWin) floatWin.close();
});
