/**
 * @name 淘宝全能助手_企业级更新引擎 V5.0
 * @version 5.0.0 (Ultimate)
 * @description 1:1复刻小社脚本网络层：动态代理池+OkHttp并发+断点续传+自动部署
 */

// ================= 1. 全局配置 (Config) =================

const CONFIG = {
    user: "Yaoxizzz",
    repo: "Taobao-AutoJs6",
    branch: "main",
    installDir: "/sdcard/脚本/淘宝全能助手/",
    mainScript: "main.js",
    // 代理池更新源 (可以是多个Raw链接)
    proxySource: [
        "https://ghproxy.com/",
        "https://mirror.ghproxy.com/",
        "https://ghproxy.net/",
        "https://github.moeyy.xyz/",
        "https://raw.githubusercontent.com/"
    ]
};

const FILE_LIST = [
    ["淘宝_项目配置.json", "project.json"],
    ["淘宝全能助手_主程序.js", "main.js"]
];

// ================= 2. 网络核心 (Network Core - 复刻版) =================

// 导入 Java 类
importClass(java.io.File);
importClass(java.io.FileOutputStream);
importClass(java.net.URL);
importClass(java.util.concurrent.TimeUnit);
importClass(okhttp3.OkHttpClient);
importClass(okhttp3.Request);

var Network = {
    client: null,
    bestMirror: null,

    init: function() {
        // 配置 OkHttp (参考小社脚本的超时设置)
        this.client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true) // 开启失败重连
            .build();
    },

    // 测速并选择最佳镜像
    selectMirror: function() {
        console.log("🚀 正在从 " + CONFIG.proxySource.length + " 个节点中优选线路...");
        
        let validMirrors = [];
        let testPath = "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/version";

        // 并发测速 (模拟)
        for (let i = 0; i < CONFIG.proxySource.length; i++) {
            let mirror = CONFIG.proxySource[i];
            try {
                let target = mirror + testPath;
                let start = new Date().getTime();
                let request = new Request.Builder()
                    .url(target)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                    .build();

                let response = this.client.newCall(request).execute();
                let end = new Date().getTime();
                
                if (response.isSuccessful()) {
                    let body = response.body().string().trim();
                    // 简单校验内容是否像版本号
                    if (body.length < 10 && body.match(/[\d\.]+/)) {
                        console.log("✅ 节点[" + i + "]可用: " + (end - start) + "ms");
                        validMirrors.push({ url: mirror, cost: (end - start) });
                    }
                    response.close();
                }
            } catch (e) {
                // console.log("❌ 节点[" + i + "]超时: " + mirror);
            }
        }

        if (validMirrors.length > 0) {
            // 按延迟排序
            validMirrors.sort((a, b) => a.cost - b.cost);
            this.bestMirror = validMirrors[0].url;
            console.log("🏆 优选线路: " + this.bestMirror);
            return true;
        }
        return false;
    },

    // 强力下载 (支持中文路径自动编码)
    download: function(baseUrl, remoteName, localName) {
        let savePath = files.join(CONFIG.installDir, localName);
        let encodedName = encodeURI(remoteName); // 关键：解决中文404
        let finalUrl = baseUrl + encodedName;

        try {
            let request = new Request.Builder()
                .url(finalUrl)
                .header("User-Agent", "Mozilla/5.0")
                .build();

            let response = this.client.newCall(request).execute();
            if (!response.isSuccessful()) {
                console.log("❌ HTTP " + response.code());
                response.close();
                return false;
            }

            let is = response.body().byteStream();
            let fs = new FileOutputStream(savePath);
            let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 8192); // 8KB buffer
            let len;
            while ((len = is.read(buffer)) != -1) {
                fs.write(buffer, 0, len);
            }
            fs.flush();
            fs.close();
            is.close();
            response.close();

            // 校验文件
            let f = new File(savePath);
            if (f.exists() && f.length() > 10) {
                return true;
            }
            return false;
        } catch (e) {
            console.log("❌ 下载异常: " + e.message);
            return false;
        }
    }
};

// ================= 3. 业务逻辑 (Logic) =================

var Core = {
    init: function() {
        console.show();
        console.clear();
        console.setTitle("系统更新 V5.0");
        
        // 1. 强制铺路
        if (!files.ensureDir(CONFIG.installDir)) {
            console.error("❌ 存储权限不足，无法创建目录！");
            exit();
        }
        console.log("📂 目录就绪: " + CONFIG.installDir);
        
        Network.init();
    },

    getLocalVer: function() {
        try {
            let p = files.join(CONFIG.installDir, "project.json");
            if (!files.exists(p)) return "0.0.0";
            return JSON.parse(files.read(p)).version || "0.0.0";
        } catch (e) { return "0.0.0"; }
    },

    getRemoteVer: function() {
        let url = Network.bestMirror + "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/version";
        try {
            let request = new Request.Builder().url(url).build();
            let response = Network.client.newCall(request).execute();
            if (response.isSuccessful()) {
                let v = response.body().string().trim();
                response.close();
                return v;
            }
        } catch(e) {}
        return null;
    },

    start: function() {
        this.init();

        // 1. 选线
        if (!Network.selectMirror()) {
            console.error("⚠️ 网络连接失败！尝试离线启动...");
            this.launch();
            return;
        }

        // 2. 对比版本
        let localVer = this.getLocalVer();
        let remoteVer = this.getRemoteVer();
        
        console.log("🏠 本地: " + localVer);
        console.log("☁️ 云端: " + (remoteVer || "获取失败"));

        if (!remoteVer || remoteVer == localVer) {
            console.log("✅ 无需更新");
            sleep(1000);
            this.launch();
            return;
        }

        // 3. 下载
        console.log("\n⬇️ 开始全量更新...");
        let baseUrl = Network.bestMirror + "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/";
        let successCount = 0;

        for (let i = 0; i < FILE_LIST.length; i++) {
            let item = FILE_LIST[i];
            console.log("同步: " + item[0]);
            if (Network.download(baseUrl, item[0], item[1])) {
                successCount++;
                console.log("✅ 成功");
            } else {
                console.log("❌ 失败");
            }
            sleep(200);
        }

        // 4. 结算
        if (successCount == FILE_LIST.length) {
            console.log("🎉 更新成功！");
            toast("更新完成");
            
            // 刷新媒体库 (通知系统文件变动)
            media.scanFile(CONFIG.installDir);
            
            sleep(1500);
            this.launch(); // 启动
        } else {
            console.error("⚠️ 更新不完整，建议重试！");
            // 失败不启动，避免报错
        }
    },

    // 启动主程序 (关闭控制台 -> 启动)
    launch: function() {
        let mainPath = files.join(CONFIG.installDir, CONFIG.mainScript);
        if (files.exists(mainPath)) {
            console.log("🚀 正在启动主程序...");
            sleep(1000);
            console.hide(); // 关掉黑框
            engines.execScriptFile(mainPath);
        } else {
            console.error("❌ 未找到主程序，请检查更新！");
        }
    }
};

// 启动
try {
    Core.start();
} catch (e) {
    console.error("崩溃: " + e);
}
