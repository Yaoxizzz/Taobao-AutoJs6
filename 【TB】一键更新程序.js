// 〖TB〗一键更新程序.js
// 作用：从 GitHub 拉取 Yaoxizzz/Taobao-AutoJs6 的最新代码，覆盖本地项目文件。
// 兼容：AutoJs6 (Rhino/ES5)
// 注意：脚本会覆盖文件，请确保项目目录正确（建议先备份一份整个 Taobao-AutoJs6 文件夹）。

(function () {
  'use strict';

  // ====== 你自己的仓库信息（按需改） ======
  var OWNER = 'Yaoxizzz';
  var REPO = 'Taobao-AutoJs6';
  var BRANCH = 'main';

  // ====== 更新源（直接 + 常用 GitHub 加速） ======
  // 这些是“前缀代理”，会拼成：prefix + "https://raw..." / "https://codeload..."
  // 直连失败时会自动换下一个。
  var PROXY_PREFIX_LIST = [
    '',
    'https://ghproxy.com/',
    'https://gh.llkk.cc/',
    'https://hub.gitmirror.com/',
    'https://ghproxy.net/'
  ];

  // ====== 目标目录（通常就是你当前项目根目录） ======
  var PROJECT_DIR = files.cwd();

  // ====== 远端资源 ======
  var VERSION_URL = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/version';
  var ZIP_URL = 'https://codeload.github.com/' + OWNER + '/' + REPO + '/zip/refs/heads/' + BRANCH;

  // ====== 本地临时目录 ======
  var TMP_DIR = files.join(PROJECT_DIR, 'tmp');
  var ZIP_PATH = files.join(TMP_DIR, REPO + '_update.zip');
  var UNZIP_DIR = files.join(TMP_DIR, REPO + '_unzip');

  // ====== 日志窗口（酷炫控制台） ======
  try {
    var 控制台 = require('./modules/TB_酷炫控制台');
    控制台.显示('TB 一键更新');
    控制台.展开();
  } catch (e) {
    // 没有模块也能运行
    console.show();
  }

  function logi(msg) { console.log('[更新] ' + msg); }
  function loge(msg) { console.error('[更新] ' + msg); }

  function ensureCleanDir(dir) {
    if (files.exists(dir)) {
      files.removeDir(dir);
    }
    files.ensureDir(dir);
  }

  function httpGetString(url, timeout) {
    var r = http.get(url, { timeout: timeout || 15000 });
    if (!r || r.statusCode < 200 || r.statusCode >= 300) {
      throw new Error('HTTP ' + (r ? r.statusCode : 'null') + ': ' + url);
    }
    return r.body.string();
  }

  function httpGetBytes(url, timeout) {
    var r = http.get(url, { timeout: timeout || 30000 });
    if (!r || r.statusCode < 200 || r.statusCode >= 300) {
      throw new Error('HTTP ' + (r ? r.statusCode : 'null') + ': ' + url);
    }
    return r.body.bytes();
  }

  function pickWorkingPrefix(testUrl) {
    for (var i = 0; i < PROXY_PREFIX_LIST.length; i++) {
      var p = PROXY_PREFIX_LIST[i];
      var u = p ? (p + testUrl) : testUrl;
      try {
        logi('测试源：' + (p || '直连'));
        var s = httpGetString(u, 8000);
        if (s && String(s).length >= 0) {
          logi('可用源：' + (p || '直连'));
          return p;
        }
      } catch (e) {
        // next
      }
    }
    return null;
  }

  function readLocalVersion() {
    var p = files.join(PROJECT_DIR, 'version');
    if (!files.exists(p)) return '0';
    try {
      return String(files.read(p)).trim() || '0';
    } catch (e) {
      return '0';
    }
  }

  function writeLocalVersion(v) {
    try {
      files.write(files.join(PROJECT_DIR, 'version'), String(v).trim() + '\n');
    } catch (e) {
      // ignore
    }
  }

  function unzip(zipPath, outDir) {
    // 使用 Java ZipInputStream 解压，避免依赖额外库
    var FileInputStream = java.io.FileInputStream;
    var FileOutputStream = java.io.FileOutputStream;
    var BufferedOutputStream = java.io.BufferedOutputStream;
    var ZipInputStream = java.util.zip.ZipInputStream;
    var File = java.io.File;

    ensureCleanDir(outDir);

    var zis = new ZipInputStream(new FileInputStream(zipPath));
    try {
      var entry;
      var buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 8192);
      while ((entry = zis.getNextEntry()) != null) {
        var name = String(entry.getName());
        // 安全：拒绝 zip-slip
        if (name.indexOf('..') >= 0) {
          zis.closeEntry();
          continue;
        }
        var outPath = files.join(outDir, name);
        if (entry.isDirectory()) {
          files.ensureDir(outPath);
          zis.closeEntry();
          continue;
        }
        files.ensureDir(files.getDir(outPath));
        var fos = new FileOutputStream(new File(outPath));
        var bos = new BufferedOutputStream(fos);
        try {
          var len;
          while ((len = zis.read(buffer)) > 0) {
            bos.write(buffer, 0, len);
          }
        } finally {
          try { bos.flush(); } catch (e1) {}
          try { bos.close(); } catch (e2) {}
        }
        zis.closeEntry();
      }
    } finally {
      try { zis.close(); } catch (e3) {}
    }
  }

  function copyTree(srcDir, dstDir, skipNamesMap) {
    var list = files.listDir(srcDir);
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var name = list[i];
      if (skipNamesMap && skipNamesMap[name]) continue;

      var src = files.join(srcDir, name);
      var dst = files.join(dstDir, name);

      if (files.isDir(src)) {
        files.ensureDir(dst);
        copyTree(src, dst, skipNamesMap);
      } else {
        // 覆盖写入
        try {
          files.copy(src, dst);
        } catch (e) {
          // files.copy 失败时，用 bytes 兜底
          try {
            files.writeBytes(dst, files.readBytes(src));
          } catch (e2) {
            loge('复制失败：' + src + ' -> ' + dst + '；' + e2);
          }
        }
      }
    }
  }

  function main() {
    files.ensureDir(TMP_DIR);

    logi('项目目录：' + PROJECT_DIR);

    var prefix = pickWorkingPrefix(VERSION_URL);
    if (prefix === null) {
      toastLog('无法连接 GitHub（直连/代理都失败）。\n请检查网络或稍后重试。');
      return;
    }

    var remoteVersion = '';
    try {
      remoteVersion = String(httpGetString(prefix ? (prefix + VERSION_URL) : VERSION_URL, 15000)).trim();
    } catch (e) {
      loge('获取远端 version 失败：' + e);
    }

    var localVersion = readLocalVersion();
    logi('本地版本：' + localVersion);
    logi('远端版本：' + (remoteVersion || '(无 version 文件或为空)'));

    // 不强制比较版本：即便 version 不存在也允许更新
    if (!confirm('确认更新？\n\n本操作会覆盖项目文件。\n\n本地：' + localVersion + '\n远端：' + (remoteVersion || '未知'))) {
      logi('已取消');
      return;
    }

    // 下载 zip
    logi('开始下载：' + ZIP_URL);
    var zipBytes = httpGetBytes(prefix ? (prefix + ZIP_URL) : ZIP_URL, 60000);
    files.writeBytes(ZIP_PATH, zipBytes);
    logi('下载完成：' + ZIP_PATH + '（' + zipBytes.length + ' bytes）');

    // 解压
    logi('开始解压到：' + UNZIP_DIR);
    unzip(ZIP_PATH, UNZIP_DIR);

    // GitHub zip 解压后通常有一个顶层目录
    var roots = files.listDir(UNZIP_DIR);
    if (!roots || roots.length <= 0) {
      throw new Error('解压后未找到根目录');
    }
    var rootDir = files.join(UNZIP_DIR, roots[0]);
    logi('解压根目录：' + rootDir);

    // 覆盖复制到项目根目录（保留 tmp；避免更新脚本正在运行时被覆盖）
    var skip = {};
    skip['tmp'] = true;

    // 跳过正在执行的脚本文件（避免运行中被覆盖）
    try {
      var cur = engines.myEngine().source;
      if (cur) {
        var curName = files.getName(cur);
        skip[curName] = true;
        logi('跳过当前脚本：' + curName);
      }
    } catch (e) {}

    logi('开始覆盖复制到项目目录...');
    copyTree(rootDir, PROJECT_DIR, skip);

    if (remoteVersion) {
      writeLocalVersion(remoteVersion);
    }

    toastLog('更新完成！\n建议：手动重新运行 〖TB〗淘宝自动签到.js');
    logi('更新完成');
  }

  try {
    main();
  } catch (e) {
    loge('更新失败：' + e);
    toastLog('更新失败：\n' + e);
  }
})();
