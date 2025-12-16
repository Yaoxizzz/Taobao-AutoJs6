/**
 * @name 【TB】一键更新
 * @version 7.0.0
 * @description 核心更新器：拉取公益节点 + 自身热更新 + 纯净退出
 */

// ================= 用户配置 =================
const CONFIG = {
    user: "Yaoxizzz",
    repo: "Taobao-AutoJs6",
    branch: "main",
    installDir: "/sdcard/脚本/淘宝全能助手/", 
    selfName: "【TB】一键更新.js" 
};

// 业务文件清单 [远程文件名, 本地文件名]
// 本地文件名我做了规范化处理，方便 modules 调用
const TASK_FILES = [
    ["【TB】项目配置.json", "project.json"],
    ["【TB】一键启动.js", "main.js"],
    ["modules/Config.js", "modules/Config.js"],
    ["modules/Utils.js", "modules/Utils.js"],
    ["modules/SignTask.js", "modules/SignTask.js"]
];

// 种子节点 (用于拉取更大的梯子)
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

// 悬浮窗 UI
var win = floaty.rawWindow(
    <card cardCornerRadius="8dp" cardElevation="6dp" bg="#1A1A1A" w="300dp">
        <vertical padding="12">
            <text text="★ 脚本检查更新 ★" textSize="14sp" textColor="#FFD700" textStyle="bold" gravity="center"/>
            <text id="status" text="正在初始化..." textSize="11sp" textColor="#00FF00" marginTop="8" maxLines="10"/>
            <progressbar id="progress" w="*" h="2dp" indeterminate="true" style="@style/Base.Widget.AppCompat.ProgressBar.Horizontal" marginTop="8"/>
        </vertical>
    </card>
);
win.setPosition(device.width/2 - 150, device.height/4);
win.setTouchable(false);

function log(msg) {
    let t = new Date();
    let time = t.getHours() + ":" + t.getMinutes() + ":" + t.getSeconds();
    console.log(msg);
    ui.run(() => {
        if (win && win.status) {
            let old = win.status.getText();
            win.status.setText(old + "\n" + msg);
            if(win.status.getLineCount() > 8) {
                win.status.setText(msg); 
            }
        }
    });
}

var Network = {
    client: new OkHttpClient.Builder().connectTimeout(5, TimeUnit.SECONDS).readTimeout(10, TimeUnit.SECONDS).build(),
    pool: [].concat(SEED_MIRRORS),
    bestMirror: null,

    // 1. 获取公益梯子 (模仿小社脚本逻辑)
    fetchLadder: function() {
        log(">>>>>→ 代理池初始化 ←<<<<<");
        log("--→ 内置种子节点: " + SEED_MIRRORS.length);
        
        // 这是一个长期维护的公益节点列表
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
                        // 简单的URL校验
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
            } catch (e) {
                // log("❌ 淘汰: " + mirror);
            }
        }
        return false;
    },

    // 3. 下载文件
    download: function(remoteName, localPath) {
        let url = this.bestMirror + "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/" + encodeURI(remoteName);
        let saveFile = files.join(CONFIG.installDir, localPath);
        
        // 确保文件夹存在 (特别是 modules)
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
    
    // 获取文本内容 (用于自我更新检查)
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
    console.show();
    console.clear();
    
    // 1. 初始化目录
    files.createWithDirs(CONFIG.installDir);
    
    // 2. 准备网络
    Network.fetchLadder();
    if (!Network.pickBest()) {
        log("⚠️ 网络连接失败，请检查网络！");
        sleep(2000); win.close(); exit();
    }

    // 3. 自我更新检查 (核心：先更新更新器自己)
    log(">>>>→ 检查更新器版本 ←<<<<");
    let myPath = files.join(CONFIG.installDir, CONFIG.selfName); // 目标路径
    let currentPath = engines.myEngine().getSourceFile().getPath(); // 当前运行路径
    
    let remoteCode = Network.getString(CONFIG.selfName);
    if (remoteCode && remoteCode.length > 500) {
        let localCode = files.exists(currentPath) ? files.read(currentPath) : "";
        if (localCode.length != remoteCode.length) {
            log("✨ 发现更新器新版本，正在更新自己...");
            // 更新标准安装目录下的文件
            files.write(myPath, remoteCode);
            // 如果当前运行的不是安装目录下的，也更新当前运行的，防止下次还开旧的
            if (currentPath != myPath) files.write(currentPath, remoteCode);
            
            log("🔄 重启更新器...");
            sleep(1000);
            engines.execScriptFile(myPath); // 重启新的自己
            win.close();
            exit();
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
        sleep(100);
    }

    // 5. 结束 (不启动主程序，只刷新文件)
    if (success == TASK_FILES.length) {
        log("------→> ★更新完成★ <←------");
        // 刷新图库，让文件管理器能看到新文件
        media.scanFile(CONFIG.installDir);
    } else {
        log("⚠️ 更新不完整 (" + success + "/" + TASK_FILES.length + ")");
    }

    sleep(3000);
    win.close();
    console.hide();
    exit();
}

try {
    main();
} catch (e) {
    console.error(e);
    if(win) win.close();
}
