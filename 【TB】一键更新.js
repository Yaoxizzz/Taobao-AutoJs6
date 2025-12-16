/**
 * 淘宝任务 - 自动更新器 (修复版)
 * Fix: 修复 ScriptEngine.getSourceFile() 报错问题
 * Author: Yaoxizzz (Original), Auto.js Architect (Fix)
 */

"ui";

// [Fix] 定义当前脚本所在目录，替代 getSourceFile()
// 在 AutoJs6/Pro 中，files.cwd() 通常就是项目根目录
const CURRENT_DIR = files.cwd();

var color = "#009688";
var frameColor = "#711111";

ui.layout(
    <frame>
        <vertical>
            <appbar background="{{color}}">
                <toolbar id="toolbar" title="脚本自动更新 (修复版)" />
            </appbar>
            <card w="*" h="auto" margin="10 5" cardCornerRadius="2dp" cardElevation="1dp">
                <vertical padding="15">
                    <text text="当前版本信息" textSize="18sp" textColor="{{color}}" textStyle="bold" />
                    <linear>
                        <text text="本地版本：" textColor="black" />
                        <text id="localVer" text="读取中..." textColor="#757575" />
                    </linear>
                    <linear>
                        <text text="最新版本：" textColor="black" />
                        <text id="remoteVer" text="等待检测..." textColor="#757575" />
                    </linear>
                    <text id="verDesc" text="" marginTop="5" textColor="#9e9e9e" size="12" />
                </vertical>
            </card>

            <card w="*" h="auto" margin="10 5" cardCornerRadius="2dp" cardElevation="1dp">
                <vertical padding="15">
                    <text text="更新源设置" textSize="18sp" textColor="{{color}}" textStyle="bold" />
                    <radiogroup id="sourceGroup" orientation="vertical">
                        <radio id="src_github" text="GitHub (GhProxy代理)" checked="true" />
                        <radio id="src_gitee" text="Gitee (国内极速)" />
                    </radiogroup>
                </vertical>
            </card>

            <button id="checkBtn" text="检测更新" style="Widget.AppCompat.Button.Colored" margin="10 0" />
            <button id="updateBtn" text="开始更新 (覆盖安装)" style="Widget.AppCompat.Button.Colored" margin="10 0" enabled="false" />
            
            <text id="log" margin="10" color="#757575" />
        </vertical>
    </frame>
);

// 全局配置
var ProjectConfig = {
    // 仓库地址
    github_url: "https://github.com/Yaoxizzz/Taobao-AutoJs6",
    gitee_url: "https://gitee.com/Yaoxizzz/Taobao-AutoJs6", // 假设存在，实际以你提供的为准
    // 加速代理
    proxy_url: "https://ghproxy.net/",
    // 项目配置文件路径
    config_path: files.join(CURRENT_DIR, "project.json"),
    version_path: files.join(CURRENT_DIR, "version"),
    // 下载暂存路径
    download_path: files.join(CURRENT_DIR, "update_temp.zip")
};

// 绑定事件
ui.checkBtn.click(() => threads.start(checkUpdate));
ui.updateBtn.click(() => threads.start(doUpdate));

// 初始化
init();

function init() {
    // 读取本地版本
    let localVer = "0.0.0";
    if (files.exists(ProjectConfig.version_path)) {
        localVer = files.read(ProjectConfig.version_path).trim();
    } else if (files.exists(ProjectConfig.config_path)) {
        try {
            let json = JSON.parse(files.read(ProjectConfig.config_path));
            localVer = json.versionName || json.version || "0.0.0";
        } catch (e) {}
    }
    ui.run(() => {
        ui.localVer.setText(localVer);
        logUi("当前目录: " + CURRENT_DIR);
    });
}

function getBaseUrl() {
    if (ui.src_github.isChecked()) {
        return ProjectConfig.proxy_url + ProjectConfig.github_url + "/archive/refs/heads/main.zip";
    } else {
        // Gitee 逻辑暂略，通常 Gitee 不需要代理
        return ProjectConfig.gitee_url + "/repository/archive/main.zip";
    }
}

function getVersionUrl() {
    if (ui.src_github.isChecked()) {
        return ProjectConfig.proxy_url + "https://raw.githubusercontent.com/Yaoxizzz/Taobao-AutoJs6/main/version";
    } else {
        return ProjectConfig.gitee_url + "/raw/main/version";
    }
}

function checkUpdate() {
    logUi("正在检测更新...");
    let url = getVersionUrl();
    try {
        let res = http.get(url);
        if (res.statusCode == 200) {
            let remoteVer = res.body.string().trim();
            ui.run(() => {
                ui.remoteVer.setText(remoteVer);
                let current = ui.localVer.getText().toString();
                if (compareVersion(remoteVer, current) > 0) {
                    logUi("发现新版本！");
                    ui.updateBtn.setEnabled(true);
                    ui.verDesc.setText("建议立即更新");
                } else {
                    logUi("已是最新版本");
                    ui.verDesc.setText("无需更新");
                }
            });
        } else {
            logUi("检测失败: " + res.statusMessage);
        }
    } catch (e) {
        logUi("检测出错: " + e.message);
    }
}

function doUpdate() {
    let downloadUrl = getBaseUrl();
    logUi("开始下载: " + downloadUrl);
    
    try {
        // 1. 下载 ZIP
        let res = http.get(downloadUrl);
        if (res.statusCode != 200) {
            logUi("下载失败: HTTP " + res.statusCode);
            return;
        }
        files.writeBytes(ProjectConfig.download_path, res.body.bytes());
        logUi("下载完成，准备解压...");

        // 2. 解压
        // [Fix] 使用 $zip 模块或标准解压
        // 注意：files.join(CURRENT_DIR) 确保解压到当前目录
        $zip.unzip(ProjectConfig.download_path, CURRENT_DIR);
        
        logUi("解压完成！");

        // 3. 处理文件夹嵌套问题
        // GitHub 下载的 zip 通常会多一层 "RepoName-main" 的文件夹
        // 我们需要把里面的内容移动出来
        let unzipDirName = "Taobao-AutoJs6-main"; // 根据仓库名推测
        let unzipDirPath = files.join(CURRENT_DIR, unzipDirName);
        
        if (files.exists(unzipDirPath)) {
            logUi("正在整理文件结构...");
            let list = files.listDir(unzipDirPath);
            for (let i = 0; i < list.length; i++) {
                let fileName = list[i];
                let src = files.join(unzipDirPath, fileName);
                let dest = files.join(CURRENT_DIR, fileName);
                files.move(src, dest);
            }
            files.removeDir(unzipDirPath);
        }

        // 4. 清理
        files.remove(ProjectConfig.download_path);
        
        logUi("更新成功！请重启脚本。");
        toast("更新成功！");
        
    } catch (e) {
        logUi("更新失败: " + e);
        console.error(e);
    }
}

function compareVersion(v1, v2) {
    if (!v1 || !v2) return 0;
    let v1arr = v1.split(".");
    let v2arr = v2.split(".");
    for (let i = 0; i < Math.max(v1arr.length, v2arr.length); i++) {
        let n1 = parseInt(v1arr[i] || 0);
        let n2 = parseInt(v2arr[i] || 0);
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

function logUi(msg) {
    ui.run(() => {
        ui.log.setText(ui.log.getText() + "\n" + msg);
        // console.log(msg);
    });
}
