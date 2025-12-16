/**
 * 淘宝全能助手 - 自动更新器 (修复版)
 * Fix: 修复 ScriptEngine.getSourceFile() 报错
 * Ref: 参考小社脚本更新逻辑
 */

var projectConfig = {
    // 你的 GitHub 用户名
    user: "Yaoxizzz",
    // 你的仓库名称
    repo: "Taobao-AutoJs6",
    // 当前分支
    branch: "main", 
    // 版本文件路径
    versionFile: "version",
    // 项目配置文件
    projectFile: "【TB】项目配置.json"
};

// [Fix] 获取当前脚本所在目录的兼容写法
var currentEngine = engines.myEngine();
var currentPath = currentEngine.source ? files.cwd() : files.getSdcardPath() + "/脚本/淘宝全能助手";
// 确保路径以 / 结尾
if (!currentPath.endsWith("/")) currentPath += "/";

// 代理地址（参考日志中选中的加速器）
var proxyUrl = "https://ghproxy.net/";
var baseUrl = "https://github.com/" + projectConfig.user + "/" + projectConfig.repo + "/raw/" + projectConfig.branch + "/";

console.show();
log(">>>>>→ 更新器启动 ←<<<<<");
log("工作目录: " + currentPath);

// 主入口
main();

function main() {
    // 1. 检查网络
    if (!checkNetwork()) {
        toastLog("网络不可用，请检查网络连接");
        return;
    }

    // 2. 获取云端版本号
    log("--→ 正在检查云端版本...");
    var remoteVersion = getRemoteVersion();
    if (!remoteVersion) {
        log("❌ 无法获取云端版本，请检查网络或代理");
        return;
    }

    // 3. 获取本地版本号
    var localVersion = getLocalVersion();
    
    log("本地版本: " + localVersion);
    log("云端版本: " + remoteVersion);

    if (versionCompare(remoteVersion, localVersion) > 0) {
        log("💡 发现新版本，准备更新...");
        // 4. 开始更新流程
        updateProject();
    } else {
        log("✅ 当前已是最新版本");
        toast("当前已是最新版本");
    }
    
    // 延迟关闭控制台
    sleep(3000);
    console.hide();
}

/**
 * 检查网络连接
 */
function checkNetwork() {
    try {
        http.get("www.baidu.com", { timeout: 3000 });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * 获取云端版本号
 */
function getRemoteVersion() {
    var url = proxyUrl + baseUrl + projectConfig.versionFile;
    try {
        var res = http.get(url, { timeout: 5000 });
        if (res.statusCode == 200) {
            return res.body.string().trim();
        }
    } catch (e) {
        log("获取版本号失败: " + e.message);
    }
    return null;
}

/**
 * 获取本地版本号
 */
function getLocalVersion() {
    var vFile = files.join(currentPath, projectConfig.versionFile);
    if (files.exists(vFile)) {
        return files.read(vFile).trim();
    }
    return "0.0.0"; // 如果没有文件，视为最旧版本
}

/**
 * 版本号比较
 * return 1: v1 > v2
 * return -1: v1 < v2
 * return 0: v1 == v2
 */
function versionCompare(v1, v2) {
    var a = v1.split('.'), b = v2.split('.');
    var len = Math.max(a.length, b.length);
    for (var i = 0; i < len; i++) {
        var num1 = parseInt(a[i]) || 0;
        var num2 = parseInt(b[i]) || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

/**
 * 执行项目更新
 */
function updateProject() {
    // 需要更新的文件列表，这里简化处理，更新核心文件
    // 实际项目中可以通过读取 project.json 或 recursive list 来获取
    // 暂时硬编码几个核心文件，参考你的文件列表
    var fileList = [
        "version",
        "README.md",
        "【TB】一键启动.js",
        "【TB】一键更新.js",
        "【TB】项目配置.json",
        "modules/Config.js",
        "modules/SignTask.js",
        "modules/Utils.js"
    ];

    var successCount = 0;
    
    for (var i = 0; i < fileList.length; i++) {
        var filePath = fileList[i];
        var downloadUrl = proxyUrl + baseUrl + filePath;
        var localPath = files.join(currentPath, filePath);

        log("⬇️ 正在更新: " + filePath);
        
        var content = downloadFile(downloadUrl);
        if (content) {
            files.ensureDir(localPath);
            files.write(localPath, content);
            log("✅ 更新成功: " + filePath);
            successCount++;
        } else {
            log("❌ 更新失败: " + filePath);
        }
        sleep(200); // 避免请求过快
    }

    log("----------------------------");
    log("更新完成! 成功: " + successCount + "/" + fileList.length);
    
    if (successCount == fileList.length) {
        toastLog("全部文件更新完毕！请重新启动脚本。");
    } else {
        toastLog("部分文件更新失败，请重试。");
    }
}

/**
 * 下载文件内容
 */
function downloadFile(url) {
    for (var i = 0; i < 3; i++) { // 重试3次
        try {
            var res = http.get(url, { timeout: 10000 });
            if (res.statusCode == 200) {
                return res.body.string();
            }
        } catch (e) {
            log("下载尝试 " + (i + 1) + " 失败: " + e.message);
        }
        sleep(1000);
    }
    return null;
}
