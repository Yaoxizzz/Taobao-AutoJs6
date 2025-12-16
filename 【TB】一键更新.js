/**
 * @name 淘宝助手_更新工具 V7.0
 * @version 7.0.0
 * @description 纯净更新：多线路下载 -> 覆盖文件 -> 自动退出 (不启动主程序)
 */

// ================= 配置区 =================
const CONFIG = {
    user: "Yaoxizzz",
    repo: "Taobao-AutoJs6",
    branch: "main",
    installDir: "/sdcard/脚本/淘宝全能助手/", 
    selfName: "淘宝任务_自动更新器.js"
};

// 文件清单：[远程路径, 本地路径]
// 注意：modules 下的文件需要指定子目录
const FILE_LIST = [
    ["淘宝_项目配置.json", "project.json"],
    ["淘宝全能助手_主程序.js", "main.js"],
    ["modules/Config.js", "modules/Config.js"],
    ["modules/Utils.js", "modules/Utils.js"],
    ["modules/SignTask.js", "modules/SignTask.js"]
];

const SEED_MIRRORS = [
    "https://mirror.ghproxy.com/",
    "https://ghproxy.net/",
    "https://github.moeyy.xyz/",
    "https://raw.githubusercontent.com/"
];

// ================= UI与网络层 =================

importClass(java.io.File);
importClass(java.io.FileOutputStream);
importClass(okhttp3.OkHttpClient);
importClass(okhttp3.Request);
importClass(java.util.concurrent.TimeUnit);

var UI = {
    win: null,
    init: function() {
        this.win = floaty.rawWindow(
            <card cardCornerRadius="12dp" cardElevation="8dp" bg="#FFFFFF" w="260dp">
                <vertical padding="16">
                    <text text="脚本更新器 V7.0" textSize="16sp" textColor="#000000" textStyle="bold"/>
                    <text id="status" text="正在初始化..." textSize="12sp" textColor="#666666" marginTop="8"/>
                    <progressbar id="bar" w="*" h="4dp" indeterminate="true" style="@style/Base.Widget.AppCompat.ProgressBar.Horizontal" marginTop="12"/>
                    <text id="detail" text="0/0" textSize="10sp" textColor="#999999" gravity="right" marginTop="4"/>
                </vertical>
            </card>
        );
        this.win.setPosition(device.width/2 - 500, device.height/2 - 400);
    },
    update: function(msg, detail) {
        ui.run(() => {
            if(this.win) {
                this.win.status.setText(msg);
                if(detail) this.win.detail.setText(detail);
            }
        });
    },
    close: function() {
        if(this.win) this.win.close();
    }
};

var Network = {
    client: new OkHttpClient.Builder().connectTimeout(5, TimeUnit.SECONDS).build(),
    bestMirror: null,

    // 1. 测速
    pickMirror: function() {
        UI.update("正在优选线路...");
        // 尝试拉取公益节点列表 (模拟) - 这里简化为直接测速种子节点
        // 如果需要拉取 wengzhenquan 的列表，逻辑同 V6.0
        let min = 99999;
        
        for(let m of SEED_MIRRORS) {
            try {
                let start = new Date().getTime();
                let req = new Request.Builder().url(m + CONFIG.user).head().build(); // 简单Head请求测速
                let res = this.client.newCall(req).execute();
                res.close();
                let cost = new Date().getTime() - start;
                if(cost < min) {
                    min = cost;
                    this.bestMirror = m;
                    console.log("✅ 优选: " + m + " (" + cost + "ms)");
                }
            } catch(e) {}
        }
        return this.bestMirror;
    },

    // 2. 下载
    download: function(remotePath, localPath) {
        let url = this.bestMirror + "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/" + encodeURI(remotePath);
        let saveFile = files.join(CONFIG.installDir, localPath);
        
        // 确保目录存在
        files.createWithDirs(saveFile);
        
        try {
            let req = new Request.Builder().url(url).header("User-Agent", "Mozilla/5.0").build();
            let res = this.client.newCall(req).execute();
            if(!res.isSuccessful()) { res.close(); return false; }
            
            let is = res.body().byteStream();
            let fs = new FileOutputStream(saveFile);
            let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 4096);
            let len;
            while ((len = is.read(buffer)) != -1) fs.write(buffer, 0, len);
            fs.flush(); fs.close(); is.close(); res.close();
            return true;
        } catch(e) {
            console.error(e);
            return false;
        }
    }
};

// ================= 主流程 =================

function main() {
    UI.init();
    
    // 1. 线路
    if(!Network.pickMirror()) {
        UI.update("网络连接失败", "请检查网络");
        sleep(2000); UI.close(); exit();
    }

    // 2. 更新自身 (跳过，假设当前是最新的，为了简化逻辑)

    // 3. 更新业务文件
    let total = FILE_LIST.length;
    let success = 0;
    
    for(let i=0; i<total; i++) {
        let remote = FILE_LIST[i][0];
        let local = FILE_LIST[i][1];
        UI.update("下载: " + local.split("/").pop(), (i+1) + "/" + total);
        
        if(Network.download(remote, local)) {
            success++;
        }
        sleep(100);
    }

    // 4. 结束 (严格执行：不启动主脚本)
    if(success === total) {
        UI.update("✅ 更新完成", "即将退出...");
        media.scanFile(CONFIG.installDir); // 刷新文件系统
        sleep(2000);
        UI.close();
        exit();
    } else {
        UI.update("⚠️ 更新不完整", "成功: " + success + "/" + total);
        sleep(3000);
        UI.close();
        exit();
    }
}

main();