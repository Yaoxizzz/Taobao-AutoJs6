// 【TB】一键更新程序.js
// 目标：像你上传的《【TB】一键更新.js》那样：拉取公益梯子 + 优选代理 + version(JSON)差分更新 + 自我热更新 + 悬浮窗日志
// 兼容：AutoJs6（Rhino/ES5）

/**
 * @name 【TB】一键更新程序
 * @version 1.2.0
 * @description 拉取公益节点 + 节点优选 + version.json 差分更新 + 自我热更新
 */

(function () {
  'use strict';

  // ================= 用户配置（你只需要改这里） =================
  var CONFIG = {
    user: 'Yaoxizzz',
    repo: 'Taobao-AutoJs6',
    branch: 'main',

    // 安装目录：你现在运行的项目目录就是 /storage/emulated/0/脚本/Taobao-AutoJs6
    // 如果你想把“拉取后的完整项目”放到别的目录，就改成那个目录。
    installDir: files.cwd(),

    // 远端更新器脚本文件名（必须和仓库里同名）
    selfName: '【TB】一键更新程序.js',

    // 强制更新：true=不管版本/日期，全部覆盖下载
    forceUpdate: false
  };

  // 如果你的仓库暂时还没做 version(JSON) 文件清单，先用这个“兜底文件列表”也能更新
  // [远程路径, 本地路径]
  var FALLBACK_FILES = [
    ['project.json', 'project.json'],
    ['main.js', 'main.js'],
    ['【TB】淘宝自动签到.js', '【TB】淘宝自动签到.js'],
    ['modules/TB_配置.js', 'modules/TB_配置.js'],
    ['modules/TB_工具.js', 'modules/TB_工具.js'],
    ['modules/TB_弹窗处理.js', 'modules/TB_弹窗处理.js'],
    ['modules/TB_淘宝签到.js', 'modules/TB_淘宝签到.js']
  ];

  // ================= 网络节点（参考你上传的更新器 + 生成代理2.js） =================
  // 这里的“镜像/代理”都按【proxy + originUrl】拼接（例如：gh.927223.xyz/https://raw...）
  var SEED_MIRRORS = [
    '', // 直连（很多环境会被墙/被阻断，但保留）

    // 你提到的示例：可用则非常关键
    'http://gh.927223.xyz/',

    // 常见 GitHub RAW 加速
    'https://ghproxy.net/',
    'https://mirror.ghproxy.com/',
    'https://github.moeyy.xyz/',
    'https://ghproxy.com/',
    'https://gh.llkk.cc/',
    'https://hub.gitmirror.com/'
  ];

  // （可选）额外代理源：来自你上传的 生成代理2.js 的思路
  var PROXY_SOURCES = [
    'https://api.akams.cn/github',
    'https://xiake.pro/static/node.json',
    'https://git.mxg.pub/api/github/list',
    'https://yishijie.gitlab.io/ziyuan/gh.txt'
  ];

  // 公益梯子列表（来自你上传的【TB】一键更新.js：wengzhenquan/autojs6）
  var LADDER_PATH = 'wengzhenquan/autojs6/main/tmp/公益梯子[魔法].txt';

  // ================= OkHttp（与【TB】一键更新.js一致的风格） =================
  importClass(java.io.File);
  importClass(java.io.FileOutputStream);
  importClass(okhttp3.OkHttpClient);
  importClass(okhttp3.Request);
  importClass(java.util.concurrent.TimeUnit);

  function buildClient(timeoutSec) {
    timeoutSec = timeoutSec || 10;
    // 简化：不强开忽略 SSL（有些代理是 http），遇到 SSL 问题再按需加。
    return new OkHttpClient.Builder()
      .connectTimeout(timeoutSec, TimeUnit.SECONDS)
      .readTimeout(timeoutSec, TimeUnit.SECONDS)
      .followRedirects(true)
      .followSslRedirects(true)
      .build();
  }

  var UA = 'Mozilla/5.0 (Linux; Android) AutoJs6-Updater';
  var clientFast = buildClient(6);
  var clientSlow = buildClient(15);

  // ================= 悬浮窗 UI（日记式输出，自动滚动/截断） =================
  var win = null;
  try {
    win = floaty.rawWindow(
      <card cardCornerRadius="10dp" cardElevation="8dp" bg="#1A1A1A" w="320dp">
        <vertical padding="12">
          <text id="title" text="★ TB 一键更新 ★" textSize="14sp" textColor="#FFD700" textStyle="bold" gravity="center"/>
          <text id="status" text="初始化..." textSize="11sp" textColor="#00FF00" marginTop="8" maxLines="10"/>
          <progressbar id="progress" w="*" h="2dp" indeterminate="true" style="@style/Base.Widget.AppCompat.ProgressBar.Horizontal" marginTop="8"/>
          <horizontal marginTop="10" gravity="center">
            <button id="btnMini" text="收起" w="90dp"/>
            <button id="btnClose" text="关闭" w="90dp" marginLeft="10dp"/>
          </horizontal>
        </vertical>
      </card>
    );
    win.setPosition(device.width / 2 - 160, device.height / 5);
    win.setTouchable(true);

    win.btnMini.on('click', function () {
      ui.run(function () {
        try {
          var t = String(win.btnMini.getText());
          if (t === '收起') {
            win.setSize(-2, -2);
            win.status.setVisibility(8); // GONE
            win.progress.setVisibility(8);
            win.btnMini.setText('展开');
          } else {
            win.setSize(-2, -2);
            win.status.setVisibility(0);
            win.progress.setVisibility(0);
            win.btnMini.setText('收起');
          }
        } catch (e) {}
      });
    });

    win.btnClose.on('click', function () {
      try { win.close(); } catch (e) {}
      try { console.hide(); } catch (e2) {}
      exit();
    });
  } catch (eWin) {
    // 没权限/不能创建悬浮窗也能继续跑
    console.show();
  }

  function log(msg) {
    console.log(msg);
    if (!win) return;
    ui.run(function () {
      try {
        var old = String(win.status.getText());
        var next = old ? (old + '\n' + msg) : msg;
        win.status.setText(next);
        // 超过 8 行就只保留最后一段（和你上传的更新器一致）
        if (win.status.getLineCount() > 8) {
          win.status.setText(msg);
        }
      } catch (e) {}
    });
  }

  function toastLogX(msg) {
    try { toast(msg); } catch (e) {}
    log(msg);
  }

  // ================= 工具函数 =================
  function normalizePrefix(p) {
    p = String(p || '').trim();
    // 如果有人把 raw.githubusercontent.com 当“代理前缀”塞进来，会导致拼接成 raw/https://raw...，直接废。
    if (/^https?:\/\/raw\.githubusercontent\.com\/?$/i.test(p)) return '';
    if (!p) return '';
    // 统一：去掉尾部多余 /，再补一个 /
    p = p.replace(/\/+$/, '') + '/';
    return p;
  }

  function unique(arr) {
    var map = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = String(arr[i]);
      if (!map[k]) { map[k] = true; out.push(arr[i]); }
    }
    return out;
  }

  function ensureDir(dir) {
    try {
      if (files.exists(dir)) return;
      // 利用 createWithDirs 创建一个临时文件以确保目录存在
      var tmp = files.join(dir, '.keep');
      files.createWithDirs(tmp);
      files.remove(tmp);
    } catch (e) {}
  }

  function httpGetString(url, fast) {
    var c = fast ? clientFast : clientSlow;
    var req = new Request.Builder().url(url).header('User-Agent', UA).get().build();
    var res = null;
    try {
      res = c.newCall(req).execute();
      if (!res || !res.isSuccessful()) {
        var code = res ? res.code() : -1;
        return { ok: false, code: code, body: null };
      }
      var s = res.body().string();
      return { ok: true, code: 200, body: s };
    } catch (e) {
      return { ok: false, code: -2, body: null };
    } finally {
      try { if (res) res.close(); } catch (e2) {}
    }
  }

  function httpDownloadTo(url, saveFile) {
    var req = new Request.Builder().url(url).header('User-Agent', UA).get().build();
    var res = null;
    try {
      res = clientSlow.newCall(req).execute();
      if (!res || !res.isSuccessful()) { try { if (res) res.close(); } catch (e0) {} return false; }

      files.createWithDirs(saveFile);

      var is = res.body().byteStream();
      var fos = new FileOutputStream(saveFile);
      var buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 8192);
      var len;
      while ((len = is.read(buffer)) != -1) {
        fos.write(buffer, 0, len);
      }
      fos.flush();
      fos.close();
      is.close();
      res.close();

      // 基础校验
      return files.exists(saveFile) && (new File(saveFile).length() > 0);
    } catch (e) {
      try { if (res) res.close(); } catch (e2) {}
      return false;
    }
  }

  function buildOriginRaw(path) {
    // 关键：用你提到的 refs/heads 形式（很多代理对这个更友好）
    return 'https://raw.githubusercontent.com/' + CONFIG.user + '/' + CONFIG.repo + '/refs/heads/' + CONFIG.branch + '/' + encodeURI(path);
  }

  function buildProxyUrl(prefix, originUrl) {
    prefix = normalizePrefix(prefix);
    if (!prefix) return originUrl;
    return prefix + originUrl;
  }

  function tryParseJson(s) {
    try {
      return JSON.parse(String(s));
    } catch (e) {
      return null;
    }
  }

  function parseDateToMs(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    var s = String(v).trim();
    if (!s) return 0;
    // 纯数字
    if (/^\d{10,13}$/.test(s)) return parseInt(s, 10);
    // 兼容 YYYY-MM-DD HH:mm:ss
    s = s.replace(/-/g, '/').replace('T', ' ').replace('Z', '');
    var t = Date.parse(s);
    if (!isNaN(t)) return t;
    return 0;
  }

  function simpleHash(str) {
    str = String(str || '');
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    // unsigned 32
    return (h >>> 0);
  }

  // ================= Network（对齐你上传的【TB】一键更新.js思路） =================
  var Network = {
    pool: unique(SEED_MIRRORS.map(normalizePrefix)),
    bestMirror: null,

    fetchLadder: function () {
      log('>>>>>→ 代理池初始化 ←<<<<<');
      log('--→ 内置种子节点: ' + this.pool.length);

      var origin = 'https://raw.githubusercontent.com/' + encodeURI(LADDER_PATH);
      var fetched = false;

      for (var i = 0; i < this.pool.length; i++) {
        var seed = this.pool[i];
        var url = buildProxyUrl(seed, origin) + '?t=' + new Date().getTime();
        var r = httpGetString(url, true);
        if (r.ok && r.body) {
          var lines = String(r.body).split(/\r?\n/);
          var count = 0;
          for (var j = 0; j < lines.length; j++) {
            var line = String(lines[j]).trim();
            if (/^https?:\/\//i.test(line)) {
              this.pool.push(normalizePrefix(line));
              count++;
            }
          }
          this.pool = unique(this.pool.map(normalizePrefix));
          log('--→ 拉取公益节点: ' + count);
          fetched = true;
          break;
        }
      }

      if (!fetched) log('⚠️ 拉取公益节点失败，继续使用内置节点');
      log('--→ 当前可用总数: ' + this.pool.length);
    },

    // 可选：从第三方代理源补充（参考你上传的 生成代理2.js）
    fetchFromProxySources: function () {
      var added = 0;
      for (var i = 0; i < PROXY_SOURCES.length; i++) {
        var src = PROXY_SOURCES[i];
        var r = httpGetString(src + '?t=' + new Date().getTime(), true);
        if (!r.ok || !r.body) continue;

        var body = String(r.body);
        var json = tryParseJson(body);

        // json 格式：{data:[{url:"..."}, ...]} 或直接是数组
        var arr = null;
        if (json && json.data && json.data.length) arr = json.data;
        else if (json && json.length) arr = json;

        if (arr && arr.length) {
          for (var k = 0; k < arr.length; k++) {
            var u = arr[k];
            if (u && u.url) u = u.url;
            if (typeof u === 'string' && /^https?:\/\//i.test(u)) {
              this.pool.push(normalizePrefix(u));
              added++;
            }
          }
        } else {
          // txt 格式：一行一个
          var lines = body.split(/\r?\n/);
          for (var j = 0; j < lines.length; j++) {
            var line = String(lines[j]).trim();
            if (/^https?:\/\//i.test(line)) {
              this.pool.push(normalizePrefix(line));
              added++;
            }
          }
        }
      }
      if (added > 0) {
        this.pool = unique(this.pool.map(normalizePrefix));
        log('--→ 额外代理源补充: ' + added);
        log('--→ 当前可用总数: ' + this.pool.length);
      }
    },

    pickBest: function () {
      log('---→> ★节点极速筛选★ <←---');

      // 用 version 文件测速（加时间戳避免缓存）
      var testOrigin = buildOriginRaw('version');

      for (var i = 0; i < this.pool.length; i++) {
        var mirror = this.pool[i];
        var start = new Date().getTime();
        var url = buildProxyUrl(mirror, testOrigin) + '?t=' + start;

        var r = httpGetString(url, true);
        if (r.ok) {
          var cost = new Date().getTime() - start;
          this.bestMirror = mirror;
          log('✅ 选中加速器: ' + (mirror || '直连'));
          log('⚡ 响应时间: ' + cost + ' ms');
          return true;
        } else {
          // 这里保留轻量日志，方便你排查到底哪个节点挂了
          // log('❌ 淘汰: ' + (mirror || '直连') + ' code=' + r.code);
        }
      }
      return false;
    },

    getStringByPath: function (remotePath) {
      var origin = buildOriginRaw(remotePath);
      var url = buildProxyUrl(this.bestMirror, origin) + '?t=' + new Date().getTime();
      return httpGetString(url, false);
    },

    downloadByPath: function (remotePath, localPath) {
      var origin = buildOriginRaw(remotePath);
      var url = buildProxyUrl(this.bestMirror, origin) + '?t=' + new Date().getTime();
      var saveFile = files.join(CONFIG.installDir, localPath);
      return httpDownloadTo(url, saveFile);
    }
  };

  // ================= version(JSON) 差分更新实现 =================
  function readLocalVersionText() {
    var p = files.join(CONFIG.installDir, 'version');
    if (!files.exists(p)) return '';
    try { return String(files.read(p)); } catch (e) { return ''; }
  }

  function writeLocalVersionText(txt) {
    try {
      files.write(files.join(CONFIG.installDir, 'version'), String(txt || '').trim() + '\n');
    } catch (e) {}
  }

  function buildLocalFileTimeMap(versionJson) {
    var map = {};
    if (!versionJson || !versionJson.updateFile || !versionJson.updateFile.length) return map;
    for (var i = 0; i < versionJson.updateFile.length; i++) {
      var it = versionJson.updateFile[i];
      if (!it) continue;
      var r = null;
      if (typeof it === 'string') r = it;
      else r = it.remote || it.path || it.name || it.file;
      if (!r) continue;
      var t = it.time || it.date || it.updateTime || it.mtime || it.ts;
      map[String(r)] = parseDateToMs(t);
    }
    return map;
  }

  function buildUpdatePlan(remoteText) {
    // 返回：{remoteVersionJson, list:[{remote, local, need}]}
    var s = String(remoteText || '').trim();
    var remoteJson = null;

    // 允许 version 为纯文本（那就全量更新 FALLBACK_FILES）
    if (s && (s[0] === '{' || s[0] === '[')) remoteJson = tryParseJson(s);

    // 期望结构：{version:"x", updateFile:[{remote, local, time}, ...]}
    // 兼容 updateFile 为 string[]
    var list = [];

    if (remoteJson && remoteJson.updateFile && remoteJson.updateFile.length) {
      var localText = readLocalVersionText();
      var localJson = null;
      var lt = String(localText || '').trim();
      if (lt && (lt[0] === '{' || lt[0] === '[')) localJson = tryParseJson(lt);

      var localMap = buildLocalFileTimeMap(localJson);

      for (var i = 0; i < remoteJson.updateFile.length; i++) {
        var it = remoteJson.updateFile[i];
        var remoteName = null;
        var localName = null;
        var rt = 0;

        if (typeof it === 'string') {
          remoteName = it;
          localName = it;
        } else if (it) {
          remoteName = it.remote || it.path || it.name || it.file;
          localName = it.local || it.localPath || remoteName;
          rt = parseDateToMs(it.time || it.date || it.updateTime || it.mtime || it.ts);
        }

        if (!remoteName) continue;

        var ltMs = localMap[String(remoteName)] || 0;
        var need = CONFIG.forceUpdate || (!rt ? true : (rt > ltMs));

        list.push({ remote: String(remoteName), local: String(localName), need: need, remoteTime: rt, localTime: ltMs });
      }

      return { remoteVersionJson: remoteJson, remoteVersionText: s, list: list, mode: 'json' };
    }

    // 没有 JSON 版 version：走兜底文件列表（全量/按 forceUpdate）
    for (var j = 0; j < FALLBACK_FILES.length; j++) {
      list.push({ remote: FALLBACK_FILES[j][0], local: FALLBACK_FILES[j][1], need: true, remoteTime: 0, localTime: 0 });
    }

    return { remoteVersionJson: null, remoteVersionText: s, list: list, mode: 'fallback' };
  }

  // ================= 主流程（对齐你上传的更新器：先自我更新，再更新业务文件） =================
  function selfUpdateIfNeeded() {
    log('>>>>→ 检查更新器版本 ←<<<<');

    var myPath = files.join(CONFIG.installDir, CONFIG.selfName);
    var curPath = '';
    try { curPath = engines.myEngine().getSourceFile().getPath(); } catch (e) {}

    var rr = Network.getStringByPath(CONFIG.selfName);
    if (!rr.ok || !rr.body) {
      log('⚠️ 获取远端更新器失败（跳过自我更新）');
      return false;
    }

    var remoteCode = String(rr.body);
    if (remoteCode.length < 200) {
      log('⚠️ 远端更新器内容异常（长度过短），跳过');
      return false;
    }

    var localCode = '';
    try { localCode = files.exists(curPath) ? String(files.read(curPath)) : ''; } catch (e2) {}

    // 比 “长度” 更稳一点：hash
    var remoteH = simpleHash(remoteCode);
    var localH = simpleHash(localCode);

    if (remoteH !== localH) {
      log('✨ 发现更新器新版本，正在更新自己...');

      try {
        files.write(myPath, remoteCode);
        if (curPath && curPath !== myPath) files.write(curPath, remoteCode);
      } catch (e3) {
        log('❌ 写入更新器失败：' + e3);
        return false;
      }

      log('🔄 重启更新器...');
      sleep(800);
      try {
        engines.execScriptFile(myPath);
      } catch (e4) {
        log('❌ 重启失败：' + e4);
      }
      try { if (win) win.close(); } catch (e5) {}
      exit();
    }

    log('✅ 更新器已是最新');
    return false;
  }

  function updateBusinessFiles() {
    log('>>>>→ 开始同步业务文件 ←<<<<');

    var vr = Network.getStringByPath('version');
    var plan = null;

    if (vr.ok && vr.body) {
      plan = buildUpdatePlan(vr.body);
    } else {
      log('⚠️ 远端 version 文件获取失败：将使用兜底文件列表全量更新');
      plan = buildUpdatePlan('');
    }

    var list = plan.list;
    var totalNeed = 0;
    for (var i = 0; i < list.length; i++) if (list[i].need) totalNeed++;

    log('更新模式：' + plan.mode + '；需要更新：' + totalNeed + '/' + list.length);

    var success = 0;
    for (var j = 0; j < list.length; j++) {
      var item = list[j];
      if (!item.need) continue;

      log('同步: ' + item.remote);
      var ok = Network.downloadByPath(item.remote, item.local);
      if (ok) {
        success++;
      } else {
        log('❌ 失败: ' + item.remote);
      }
      sleep(120);
    }

    // 如果拿到了远端 version，则写入本地 version（让下次差分对比生效）
    if (plan.mode === 'json' && plan.remoteVersionText) {
      writeLocalVersionText(plan.remoteVersionText);
    } else if (vr.ok && vr.body) {
      // 纯文本 version 也写进去
      writeLocalVersionText(String(vr.body));
    }

    if (success === totalNeed) {
      log('------→> ★更新完成★ <←------');
      try { media.scanFile(CONFIG.installDir); } catch (e1) {}
      toastLogX('更新完成！');
    } else {
      log('⚠️ 更新不完整 (' + success + '/' + totalNeed + ')');
      toastLogX('更新不完整：' + success + '/' + totalNeed);
    }
  }

  function main() {
    console.show();
    console.clear();

    ensureDir(CONFIG.installDir);

    // 1) 代理池准备
    Network.fetchLadder();
    Network.fetchFromProxySources();

    // 2) 优选
    if (!Network.pickBest()) {
      toastLogX('无法连接 GitHub（直连/代理都失败）。\n\n你可以：\n1) 打开代理/VPN 后再试\n2) 把可用代理前缀填进 SEED_MIRRORS（例如 gh.927223.xyz）');
      sleep(1200);
      if (win) win.close();
      exit();
    }

    // 3) 先自我更新（对齐你上传的更新器）
    selfUpdateIfNeeded();

    // 4) 更新业务文件
    updateBusinessFiles();

    sleep(1800);
    try { if (win) win.close(); } catch (e2) {}
    try { console.hide(); } catch (e3) {}
    exit();
  }

  try {
    main();
  } catch (e) {
    console.error(e);
    try { if (win) win.close(); } catch (e4) {}
  }
})();
