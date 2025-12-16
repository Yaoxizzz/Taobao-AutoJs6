/**
 * @name 淘宝全能助手_终极更新器 V6.0
 * @version 6.0.0
 * @description 自身热更新 + 海量动态代理 + 严格手动启动模式
 */

// ================= 1. 配置中心 (User Config) =================

const CONFIG = {
    user: "Yaoxizzz",
    repo: "Taobao-AutoJs6",
    branch: "main",
    
    // 强制安装路径
    installDir: "/sdcard/脚本/淘宝全能助手/",
    
    // 更新器在服务器上的文件名 (用于自我更新)
    // 请确保你GitHub仓库里上传了这个文件，名字必须一致
    selfName: "淘宝任务_自动更新器.js",
    
    // 是否显示详细调试日志
    debug: true
};

// 业务文件清单 [ "远程文件名", "本地保存名" ]
const TASK_FILES = [
    ["淘宝_项目配置.json", "project.json"],
    ["淘宝全能助手_主程序.js", "main.js"]
];

// 初始备用种子节点 (用于拉取更大的代理列表)
const SEED_MIRRORS = [
    "https://ghproxy.net/",
    "https://mirror.ghproxy.com/",
    "https://ghproxy.cn/",
    "https://github.moeyy.xyz/",
    "https://raw.githubusercontent.com/"
];

// ================= 2. 核心网络层 (OkHttp) =================

importClass(java.io.File);
importClass(java.io.FileOutputStream);
importClass(java.util.concurrent.TimeUnit);
importClass(okhttp3.OkHttpClient);
importClass(okhttp3.Request);

var Network = {
    client: null,
    bestMirror: null,

    init: function() {
        this.client = new OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS) // 连接超时缩短，加快测速
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build();
    },

    // 下载内容为字符串
    getString: function(url) {
        try {
            let req = new Request.Builder().url(url).header("User-Agent", "Mozilla/5.0").build();
            let res = this.client.newCall(req).execute();
            if (res.isSuccessful()) {
                let str = res.body().string();
                res.close();
                return str;
            }
            res.close();
        } catch (e) {}
        return null;
    },

    // 下载文件到本地
    downloadFile: function(url, savePath) {
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
            
            // 校验
            if (files.exists(savePath) && new File(savePath).length() > 0) return true;
        } catch (e) {
            console.error(e);
        }
        return false;
    }
};

// ================= 3. 代理池管理器 (Proxy Manager) =================

var ProxyMgr = {
    pool: [],

    // 第一步：构建海量代理池
    buildPool: function() {
        console.log("📡 正在初始化网络矩阵...");
        // 1. 加入种子节点
        this.pool = this.pool.concat(SEED_MIRRORS);

        // 2. 尝试从仓库拉取 "公益梯子[魔法].txt"
        // 这里的逻辑是：先用种子节点去尝试下载梯子文件，如果下载到了，就解析出更多的节点
        // 这里我用了 wengzhenquan 的源仓库地址，保证源头活水
        let ladderUrlPath = "wengzhenquan/autojs6/main/tmp/公益梯子[魔法].txt";
        
        for (let seed of SEED_MIRRORS) {
            let listUrl = seed + "https://raw.githubusercontent.com/" + encodeURI(ladderUrlPath);
            let content = Network.getString(listUrl);
            
            if (content && content.length > 100) {
                console.log("✅ 成功获取云端动态代理列表");
                let lines = content.split("\n");
                let count = 0;
                for (let line of lines) {
                    line = line.trim();
                    // 简单的正则匹配URL
                    if (line.startsWith("http") && !line.includes(" ")) {
                        this.pool.push(line.endsWith("/") ? line : line + "/");
                        count++;
                    }
                }
                console.log("➕ 追加了 " + count + " 个公益节点");
                break; // 只要拉取成功一次即可
            }
        }
        
        // 去重
        this.pool = Array.from(new Set(this.pool));
        console.log("🔋 当前可用检测节点: " + this.pool.length + " 个");
    },

    // 第二步：极速优选
    pickBest: function() {
        console.log("🚀 正在全网测速优选...");
        let minCost = 99999;
        
        // 用 version 文件作为测速标的
        let testPath = "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/version";

        // 遍历代理池
        for (let mirror of this.pool) {
            let target = mirror + testPath;
            let t1 = new Date().getTime();
            // 尝试读取version，能读到说明通
            let res = Network.getString(target);
            let t2 = new Date().getTime();
            
            if (res) {
                let cost = t2 - t1;
                console.log("✅ 节点响应: " + cost + "ms -> " + mirror.substring(0, 25) + "...");
                
                // 只要找到一个延迟低于 1500ms 的，直接选用，不再浪费时间
                if (cost < 1500) {
                    Network.bestMirror = mirror;
                    console.log("⚡ 选中极速节点！");
                    return true;
                }
                // 否则记录最小值
                if (cost < minCost) {
                    minCost = cost;
                    Network.bestMirror = mirror;
                }
            }
        }
        
        if (Network.bestMirror) {
            console.log("🏆 最终优选: " + Network.bestMirror);
            return true;
        }
        return false;
    }
};

// ================= 4. 核心逻辑 (Core Logic) =================

var Core = {
    init: function() {
        console.show();
        console.clear();
        console.setTitle("Auto.js 智能更新 V6.0");
        
        // 强制铺路
        files.createWithDirs(CONFIG.installDir);
        Network.init();
    },

    // 自我更新逻辑 (Bootstrap)
    checkSelfUpdate: function() {
        console.log("\n🔍 检查更新器自身版本...");
        let myPath = engines.myEngine().getSourceFile().getPath();
        
        // 构建云端下载链接
        let remoteUrl = Network.bestMirror + "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/" + encodeURI(CONFIG.selfName);
        
        // 下载云端更新器代码到内存
        let remoteCode = Network.getString(remoteUrl);
        
        if (remoteCode && remoteCode.length > 500) { // 代码长度肯定大于500
            let localCode = files.read(myPath);
            
            // 简单对比内容长度，不一样就认为是新版 (简单粗暴有效)
            if (remoteCode.length != localCode.length) {
                console.log("✨ 发现更新器新版本，正在覆盖...");
                files.write(myPath, remoteCode);
                console.log("🔄 更新器已更新，正在重启自身...");
                sleep(1000);
                engines.execScriptFile(myPath); // 重启自己
                exit(); // 退出当前旧进程
            } else {
                console.log("✅ 更新器已是最新");
            }
        } else {
            console.log("⚠️ 无法获取远程更新器代码，跳过自检");
        }
    },

    // 业务更新逻辑
    updateProject: function() {
        console.log("\n⬇️ 开始同步业务脚本...");
        let baseUrl = Network.bestMirror + "https://raw.githubusercontent.com/" + CONFIG.user + "/" + CONFIG.repo + "/" + CONFIG.branch + "/";
        
        let success = 0;
        for (let item of TASK_FILES) {
            let remoteName = item[0];
            let localName = item[1];
            console.log("同步: " + remoteName);
            
            if (Network.downloadFile(baseUrl + encodeURI(remoteName), CONFIG.installDir + localName)) {
                success++;
                console.log("✅ 成功");
            } else {
                console.error("❌ 失败");
            }
            sleep(200);
        }
        
        return success === TASK_FILES.length;
    },

    // 收尾
    finish: function() {
        console.log("\n=================");
        console.log("🎉 更新流程结束");
        console.log("📂 文件路径: " + CONFIG.installDir);
        console.log("💡 请手动运行目录下的 main.js");
        
        // 刷新图库，通知系统文件变动
        media.scanFile(CONFIG.installDir);
        
        // 倒计时关闭控制台
        for (let i = 3; i > 0; i--) {
            console.log("⏳ " + i + "秒后关闭窗口...");
            sleep(1000);
        }
        console.hide();
        exit();
    }
};

// ================= 入口 =================

try {
    Core.init();
    
    // 1. 准备网络
    ProxyMgr.buildPool();
    if (!ProxyMgr.pickBest()) {
        console.error("❌ 无法连接到GitHub，请检查网络！");
        exit();
    }
    
    // 2. 自我更新
    Core.checkSelfUpdate();
    
    // 3. 业务更新
    // 这里不再对比version文件，直接强制全量拉取，保证最新
    // 因为你有时候可能忘记改version号，强制更新更稳妥
    Core.updateProject();
    
    // 4. 结束
    Core.finish();

} catch (e) {
    console.error("致命错误: " + e);
}
