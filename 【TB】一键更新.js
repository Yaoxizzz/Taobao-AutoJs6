/**
 * @name 【TB】一键更新
 * @version 8.0.0
 * @description 修复报错 | 自动拉取公益节点 | 自身热修复 | 纯净退出
 */

// ================= 用户配置 =================
const CONFIG = {
    user: "Yaoxizzz",
    repo: "Taobao-AutoJs6",
    branch: "main",
    // 强制安装路径 (所有文件都会被下载到这里)
    installDir: "/sdcard/脚本/淘宝全能助手/", 
    // 更新器自身的文件名 (必须与本地一致)
    selfName: "【TB】一键更新.js" 
};

// 业务文件清单 [远程路径, 本地路径]
// 远程路径要和GitHub仓库结构保持一致
const TASK_FILES = [
    ["【TB】项目配置.json", "project.json"],
    ["【TB】一键启动.js", "main.js"],
    ["modules/Config.js", "modules/Config.js"],
    ["modules/Utils.js", "modules/Utils.js"],
    ["modules/SignTask.js", "modules/SignTask.js"]
];

// 种子节点 (用于拉取更大的梯子列表)
const SEED_MIRRORS = [
    "https://mirror.ghproxy.com/",
    "https://ghproxy.net/",
    "https://github.moeyy.xyz/",
    "https://raw.githubusercontent.com/"
];

// ================= 核心层 =================

importClass(java.io.File);
importClass(java.io.FileOutputStream);
importClass(okhttp3.OkHttpClient);
importClass(okhttp3.Request);
importClass(java.util.concurrent.TimeUnit);

// 1. 悬浮窗 UI (单例模式)
var win = null;

function showUI() {
    if(win) return;
    win = floaty.rawWindow(
        <card cardCornerRadius="8dp" cardElevation="6dp" bg="#222222" w="280dp">
            <vertical padding="15">
                <text text="★ 脚本智能更新 V8.0 ★" textSize="14sp" textColor="#FFD700" textStyle="bold" gravity="center"/>
                <text id="status" text="正在初始化..." textSize="11sp" textColor="#00FF00" marginTop="10" maxLines="8" ellipsize="end"/>
                <progressbar id="progress" w="*" h="3dp" indeterminate="true" style="@style/Base.Widget.AppCompat.ProgressBar.Horizontal" marginTop="10"/>
            </vertical>
        </card>
    );
    win.setPosition(device.width/2 - 140, device.height/3);
    win.setTouchable(false);
}

function updateLog(msg) {
    let t = new Date();
    let time = t.getHours() + ":" + t.getMinutes() + ":" + t.getSeconds();
    console.log(msg); 
    ui.run(() => {
        if (win && win.status) {
            let old = win.status.getText();
            win.status.setText(old + "\n" + msg);
            // 保持显示最新的几行
            if(win.status.getLineCount() > 8) {
                win.status.setText(msg); 
            }
        }
    });
}

// 强制关闭UI (防止双窗口)
function closeUI() {
    if(win) {
        win.close();
        win = null;
    }
    console.hide();
}

var Network = {
    client: new OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build(),
    pool: [].concat(SEED_MIRRORS), // 初始只有种子
    bestMirror: null,

    // 1. 获取公益梯子 (从 wengzhenquan 仓库拉取)
    fetchLadder: function() {
        updateLog(">>>>>→ 代理池初始化 ←<<<<<");
        
        // 这是参考代码中的路径
        let ladderUrl = "wengzhenquan/autojs6/main/tmp/公益梯子[魔法].txt";
        let fetched = false;

        for (let seed of SEED_MIRRORS) {
            let url = seed + "https://raw.githubusercontent.com/" + encodeURI(ladderUrl);
            try {
                let req = new Request.Builder().url(url).get().build();
                let res = this.client.newCall(req).execute();
                if (res.isSuccessful()) {
                    let content = res.body().string();
                    let lines = content.split("\n");
                    let count = 0;
                    for (let line of lines) {
                        line = line.trim();
                        if (line.startsWith("http")) {
                            // 确保以 / 结尾
                            this.pool.push(line.endsWith("/") ? line : line + "/");
                            count++;
                        }
                    }
                    updateLog("✅ 拉取公益节点: " + count + "个");
                    fetched = true;
                    // 去重
                    this.pool = Array.from(new Set(this.pool));
                    res.close();
                    break;
                }
                res.close();
            } catch (e) {}
        }
        
        if(!fetched) updateLog("⚠️ 拉取失败，使用内置种子");
        updateLog("🔋 当前节点总数: " + this.pool.length);
    },

    // 2. 优选节点 (并发测速)
    pickBest: function() {
        updateLog("---→> 节点极速筛选 <←---");
        
        // 用 version 文件测速
        let testPath = "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/version";
        let found = false;

        // 简单的顺序测速，找到能用的就停，避免全部测速耗时太久
        for (let mirror of this.pool) {
            try {
                let start = new Date().getTime();
                let req = new Request.Builder().url(mirror + testPath).get().build();
                let res = this.client.newCall(req).execute();
                
                if (res.isSuccessful()) {
                    let cost = new Date().getTime() - start;
                    res.close();
                    
                    // 只有小于 3秒 的才算合格
                    if (cost < 3000) {
                        updateLog("✅ 选中: " + mirror);
                        updateLog("⚡ 延迟: " + cost + " ms");
                        this.bestMirror = mirror;
                        return true;
                    }
                }
                res.close();
            } catch (e) {}
        }
        return false;
    },

    // 3. 下载文件
    download: function(remoteName, localPath) {
        let url = this.bestMirror + "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/" + encodeURI(remoteName);
        let saveFile = files.join(CONFIG.installDir, localPath);
        
        // 确保父目录存在 (特别是 modules 文件夹)
        files.createWithDirs(saveFile);

        try {
            let req = new Request.Builder().url(url).header("User-Agent", "Mozilla/5.0").build();
            let res = this.client.newCall(req).execute();
            if (!res.isSuccessful()) { res.close(); return false; }

            let is = res.body().byteStream();
            let fs = new FileOutputStream(saveFile);
            let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 8192);
            let len;
            while ((len = is.read(buffer)) != -1) fs.write(buffer, 0, len);
            fs.flush(); fs.close(); is.close(); res.close();
            
            // 校验文件大小
            if (files.exists(saveFile) && new File(saveFile).length() > 0) return true;
            return false;
        } catch (e) {
            return false;
        }
    },
    
    // 获取文本内容 (用于版本对比)
    getString: function(remoteName) {
        let url = this.bestMirror + "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/" + encodeURI(remoteName);
        try {
            let req = new Request.Builder().url(url).get().build();
            let res = this.client.newCall(req).execute();
            if (res.isSuccessful()) {
                let s = res.body().string();
                res.close();
                return s;
            }
            res.close();
        } catch(e){}
        return null;
    }
};

// ================= 主程序 =================

function main() {
    showUI();
    console.show();
    console.clear();
    
    // 1. 初始化目录
    files.createWithDirs(CONFIG.installDir);
    
    // 2. 准备网络 (先拉取，后优选)
    Network.fetchLadder();
    if (!Network.pickBest()) {
        updateLog("⚠️ 网络连接失败，请检查网络！");
        sleep(2000); closeUI(); exit();
    }

    // 3. 自我更新检查 (核心修复：直接使用固定路径)
    updateLog(">>>>→ 检查更新器版本 ←<<<<");
    
    // 目标路径：/sdcard/脚本/淘宝全能助手/【TB】一键更新.js
    let targetSelfPath = files.join(CONFIG.installDir, CONFIG.selfName);
    
    // 下载远程代码字符串
    let remoteCode = Network.getString(CONFIG.selfName);
    
    if (remoteCode && remoteCode.length > 500) {
        let localCode = "";
        // 读取本地文件内容（如果存在）
        if(files.exists(targetSelfPath)) {
            localCode = files.read(targetSelfPath);
        }
        
        // 对比长度和内容前100字符
        if (localCode.length != remoteCode.length) {
            updateLog("✨ 发现更新器新版本，正在自我修复...");
            // 写入新代码
            files.write(targetSelfPath, remoteCode);
            
            updateLog("🔄 正在重启新版更新器...");
            sleep(1500);
            
            // 【关键步骤】关闭当前UI，防止双窗口
            closeUI();
            
            // 启动新的自己
            engines.execScriptFile(targetSelfPath); 
            exit(); // 结束当前旧进程
        } else {
            updateLog("✅ 更新器已是最新");
        }
    }

    // 4. 更新业务文件
    updateLog(">>>>→ 开始同步组件 ←<<<<");
    let success = 0;
    for (let item of TASK_FILES) {
        updateLog("同步: " + item[0]);
        if (Network.download(item[0], item[1])) {
            success++;
        } else {
            updateLog("❌ 失败: " + item[0]);
        }
        sleep(50);
    }

    // 5. 结束 (纯净退出)
    if (success == TASK_FILES.length) {
        updateLog("------→> ★更新完成★ <←------");
        updateLog("💡 请手动运行 【TB】一键启动.js");
        // 刷新图库
        media.scanFile(CONFIG.installDir);
    } else {
        updateLog("⚠️ 更新不完整 (" + success + "/" + TASK_FILES.length + ")");
    }

    sleep(3000); // 展示3秒结果
    closeUI(); // 关闭悬浮窗
    exit(); // 退出脚本
}

try {
    main();
} catch (e) {
    console.error(e);
    // 报错也要尝试关闭UI
    closeUI();
}
