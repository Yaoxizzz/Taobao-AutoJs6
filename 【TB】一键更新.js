/**
 * @name 【TB】一键更新
 * @version 8.0.0
 * @description 修复路径报错 | 详细日志UI | 自身热修复 | 纯净退出
 */

// ================= 用户配置 =================
const CONFIG = {
    user: "Yaoxizzz",
    repo: "Taobao-AutoJs6",
    branch: "main",
    // 强制安装路径 (所有文件都会被下载到这里)
    installDir: "/sdcard/脚本/淘宝全能助手/", 
    // 更新器自身的文件名
    selfName: "【TB】一键更新.js" 
};

// 业务文件清单 [远程文件名, 本地文件名]
// 远程路径要和GitHub保持一致
const TASK_FILES = [
    ["【TB】项目配置.json", "project.json"],
    ["【TB】一键启动.js", "main.js"],
    ["modules/Config.js", "modules/Config.js"],
    ["modules/Utils.js", "modules/Utils.js"],
    ["modules/SignTask.js", "modules/SignTask.js"]
];

// 种子节点
const SEED_MIRRORS = [
    "https://ghproxy.net/",
    "https://mirror.ghproxy.com/",
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
        <card cardCornerRadius="8dp" cardElevation="6dp" bg="#1A1A1A" w="300dp">
            <vertical padding="12">
                <text text="★ 脚本智能更新 ★" textSize="15sp" textColor="#FFD700" textStyle="bold" gravity="center"/>
                <text id="status" text="初始化..." textSize="11sp" textColor="#00FF00" marginTop="8" maxLines="12" ellipsize="end"/>
                <progressbar id="progress" w="*" h="3dp" indeterminate="true" style="@style/Base.Widget.AppCompat.ProgressBar.Horizontal" marginTop="8"/>
                <text id="footer" text="Auto.js Pro" textSize="9sp" textColor="#666666" gravity="right" marginTop="4"/>
            </vertical>
        </card>
    );
    win.setPosition(device.width/2 - 150, device.height/4);
    win.setTouchable(false);
}

function log(msg) {
    let t = new Date();
    let time = t.getHours() + ":" + t.getMinutes() + ":" + t.getSeconds();
    console.log(msg); // 打印到控制台
    ui.run(() => {
        if (win && win.status) {
            let old = win.status.getText();
            win.status.setText(old + "\n" + msg);
            // 保持显示最新的几行
            if(win.status.getLineCount() > 12) {
                win.status.setText(msg); 
            }
        }
    });
}

function closeUI() {
    if(win) {
        win.close();
        win = null;
    }
}

var Network = {
    client: new OkHttpClient.Builder().connectTimeout(5, TimeUnit.SECONDS).readTimeout(10, TimeUnit.SECONDS).build(),
    pool: [].concat(SEED_MIRRORS),
    bestMirror: null,

    // 1. 获取公益梯子
    fetchLadder: function() {
        log(">>>>>→ 代理池初始化 ←<<<<<");
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
                            this.pool.push(line.endsWith("/") ? line : line + "/");
                            count++;
                        }
                    }
                    log("--→ 拉取公益节点: " + count);
                    fetched = true;
                    // 去重
                    this.pool = Array.from(new Set(this.pool));
                    res.close();
                    break;
                }
                res.close();
            } catch (e) {}
        }
        
        if(!fetched) log("⚠️ 拉取公益节点失败，使用内置节点");
        log("--→ 当前可用总数: " + this.pool.length);
    },

    // 2. 优选节点
    pickBest: function() {
        log("---→> ★节点极速筛选★ <←---");
        // 用 version 文件测速
        let testPath = "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/version";
        
        for (let mirror of this.pool) {
            try {
                let start = new Date().getTime();
                let req = new Request.Builder().url(mirror + testPath).get().build();
                let res = this.client.newCall(req).execute();
                if (res.isSuccessful()) {
                    let cost = new Date().getTime() - start;
                    res.close();
                    log("✅ 选中加速器: " + mirror);
                    log("⚡ 响应时间: " + cost + " ms");
                    this.bestMirror = mirror;
                    return true;
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
        
        // 确保父目录存在
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
            
            // 校验
            if (files.exists(saveFile) && new File(saveFile).length() > 0) return true;
            return false;
        } catch (e) {
            return false;
        }
    },
    
    // 获取文本内容
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
    
    // 2. 准备网络
    Network.fetchLadder();
    if (!Network.pickBest()) {
        log("⚠️ 网络连接失败，请检查网络！");
        sleep(2000); closeUI(); exit();
    }

    // 3. 自我更新检查 (核心修复：不使用 getSourceFile)
    log(">>>>→ 检查更新器版本 ←<<<<");
    
    // 目标路径：永远是标准安装路径
    let targetSelfPath = files.join(CONFIG.installDir, CONFIG.selfName);
    
    // 下载远程代码
    let remoteCode = Network.getString(CONFIG.selfName);
    
    if (remoteCode && remoteCode.length > 500) {
        let localCode = "";
        if(files.exists(targetSelfPath)) {
            localCode = files.read(targetSelfPath);
        }
        
        // 简单粗暴对比长度，不同就更新
        if (localCode.length != remoteCode.length) {
            log("✨ 发现更新器新版本，正在自我修复...");
            files.write(targetSelfPath, remoteCode);
            
            log("🔄 正在重启新版更新器...");
            sleep(1000);
            closeUI();
            console.hide();
            
            // 启动新的自己
            engines.execScriptFile(targetSelfPath); 
            exit(); // 结束当前旧进程
        } else {
            log("✅ 更新器已是最新");
        }
    }

    // 4. 更新业务文件
    log(">>>>→ 开始同步业务文件 ←<<<<");
    let success = 0;
    for (let item of TASK_FILES) {
        log("同步: " + item[0]);
        if (Network.download(item[0], item[1])) {
            success++;
        } else {
            log("❌ 失败: " + item[0]);
        }
        sleep(50);
    }

    // 5. 结束 (纯净退出)
    if (success == TASK_FILES.length) {
        log("------→> ★更新完成★ <←------");
        log("💡 请手动运行 【TB】一键启动.js");
        media.scanFile(CONFIG.installDir);
    } else {
        log("⚠️ 更新不完整 (" + success + "/" + TASK_FILES.length + ")");
    }

    sleep(3000); // 展示3秒结果
    closeUI(); // 关闭悬浮窗
    console.hide(); // 关闭控制台
    exit(); // 退出脚本
}

try {
    main();
} catch (e) {
    console.error(e);
    closeUI();
}
