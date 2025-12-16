/**
 * @name 淘宝全能助手_更新器 V6.0
 * @version 6.0.0
 * @description 自动拉取公益节点列表 + 自身热更新 + 美观UI + 自动退出
 */

// ================= 配置区 =================

const CONFIG = {
    user: "Yaoxizzz",
    repo: "Taobao-AutoJs6",
    branch: "main",
    // 你的脚本存放目录
    installDir: "/sdcard/脚本/淘宝全能助手/", 
    // 更新器自身文件名
    selfName: "淘宝任务_自动更新器.js" 
};

// 业务文件清单
const TASK_FILES = [
    ["淘宝_项目配置.json", "project.json"],
    ["淘宝全能助手_主程序.js", "main.js"]
];

// 种子节点 (用于拉取更大的代理池)
const SEED_MIRRORS = [
    "https://ghproxy.net/",
    "https://mirror.ghproxy.com/",
    "https://ghproxy.cn/",
    "https://github.moeyy.xyz/",
    "https://raw.githubusercontent.com/"
];

// 引用Java类
importClass(java.io.File);
importClass(java.io.FileOutputStream);
importClass(okhttp3.OkHttpClient);
importClass(okhttp3.Request);
importClass(java.util.concurrent.TimeUnit);

// ================= UI 界面 (美化版悬浮窗) =================

var win = floaty.rawWindow(
    <card cardCornerRadius="12dp" cardElevation="10dp" bg="#FEFEFE" w="280dp">
        <vertical padding="15">
            <text id="title" text="正在初始化..." textSize="16sp" textColor="#333333" textStyle="bold"/>
            <text id="msg" text="准备连接服务器..." textSize="12sp" textColor="#888888" marginTop="5"/>
            <progressbar id="progress" w="*" h="4dp" indeterminate="true" style="@style/Base.Widget.AppCompat.ProgressBar.Horizontal" marginTop="10"/>
        </vertical>
    </card>
);
win.setPosition(device.width/2 - 500, device.height/2 - 300); // 居中大概位置
win.setTouchable(false); // 穿透点击

function updateUI(title, msg) {
    ui.run(() => {
        win.title.setText(title);
        if(msg) win.msg.setText(msg);
    });
}

// ================= 核心网络层 =================

var Network = {
    client: null,
    bestMirror: null,
    pool: [],

    init: function() {
        this.client = new OkHttpClient.Builder()
            .connectTimeout(3, TimeUnit.SECONDS) // 3秒连接超时，快速测速
            .readTimeout(30, TimeUnit.SECONDS)
            .build();
        
        this.pool = [].concat(SEED_MIRRORS);
    },

    // 核心：拉取 wengzhenquan 仓库的公益节点
    fetchPublicLadder: function() {
        updateUI("正在获取节点...", "尝试拉取公益梯子列表");
        // 这是一个公开的节点列表文件地址
        let ladderPath = "wengzhenquan/autojs6/main/tmp/公益梯子[魔法].txt";
        
        for (let seed of SEED_MIRRORS) {
            let url = seed + "https://raw.githubusercontent.com/" + encodeURI(ladderPath);
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
                    console.log("成功拉取节点: " + count + "个");
                    // 去重
                    this.pool = Array.from(new Set(this.pool));
                    res.close();
                    return;
                }
                res.close();
            } catch (e) {}
        }
    },

    // 极速优选
    pickBest: function() {
        updateUI("节点测速中...", "当前可用节点: " + this.pool.length);
        
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
                    console.log("✅ 选中节点: " + mirror + " (" + cost + "ms)");
                    this.bestMirror = mirror;
                    return true;
                }
                res.close();
            } catch (e) {}
        }
        return false;
    },

    // 下载文件
    download: function(remoteName, localName) {
        updateUI("下载中...", remoteName);
        let url = this.bestMirror + "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/" + encodeURI(remoteName);
        let savePath = files.join(CONFIG.installDir, localName);
        
        try {
            let req = new Request.Builder().url(url).header("User-Agent", "Mozilla/5.0").build();
            let res = this.client.newCall(req).execute();
            if (!res.isSuccessful()) {
                res.close();
                return false;
            }

            let is = res.body().byteStream();
            let fs = new FileOutputStream(savePath);
            let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 8192);
            let len;
            while ((len = is.read(buffer)) != -1) {
                fs.write(buffer, 0, len);
            }
            fs.flush();
            fs.close();
            is.close();
            res.close();
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
};

// ================= 主流程 =================

function main() {
    files.createWithDirs(CONFIG.installDir);
    Network.init();
    
    // 1. 扩充代理池
    Network.fetchPublicLadder();
    
    // 2. 选线
    if (!Network.pickBest()) {
        updateUI("更新失败", "网络连接错误");
        sleep(2000);
        win.close();
        exit();
    }

    // 3. 自我更新检查 (修复路径报错问题)
    updateUI("自检中...", "检查更新器版本");
    let myPath = files.join(CONFIG.installDir, CONFIG.selfName);
    // 如果当前运行的不是标准路径下的脚本，也进行检查
    // 下载最新的更新器代码字符串
    try {
        let updateUrl = Network.bestMirror + "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/" + encodeURI(CONFIG.selfName);
        let req = new Request.Builder().url(updateUrl).get().build();
        let res = Network.client.newCall(req).execute();
        if (res.isSuccessful()) {
            let remoteCode = res.body().string();
            // 读取本地（如果存在）
            let localCode = files.exists(myPath) ? files.read(myPath) : "";
            
            if (localCode.length != remoteCode.length) {
                updateUI("更新自身...", "发现新版本更新器");
                files.write(myPath, remoteCode);
                sleep(1000);
                // 重新启动新的自己
                engines.execScriptFile(myPath);
                win.close();
                exit();
            }
            res.close();
        }
    } catch(e) {
        console.error("自检失败:" + e);
    }

    // 4. 业务文件更新
    let success = 0;
    for (let item of TASK_FILES) {
        if (Network.download(item[0], item[1])) success++;
        sleep(100);
    }

    // 5. 结束
    if (success == TASK_FILES.length) {
        updateUI("更新完成", "正在清理...");
        // 刷新系统文件索引
        media.scanFile(CONFIG.installDir);
    } else {
        updateUI("更新不完整", "请检查网络");
    }

    sleep(1500);
    win.close();
    exit();
}

try {
    main();
} catch (e) {
    console.error(e);
    if(win) win.close();
}
