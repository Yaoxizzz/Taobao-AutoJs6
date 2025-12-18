// 【TB】一键更新程序.js
// AutoJs6 (Rhino/ES5) 版本：
// ✅ 只保留 1 个悬浮窗（避免你现在看到的“两个悬浮窗”）
// ✅ 不再下载 GitHub Zip（codeload 很多代理 403），改为 RAW 逐文件下载
// ✅ 先快筛（直连/少量种子）→ 失败再扩容代理池（公益梯子/代理源），启动速度更快
// ✅ 自动列出仓库“全部文件”并同步（优先 GitHub API Tree；不依赖你手写 updateFile 清单）
// ✅ 差分更新：用远端 sha + 本地缓存对比，只下载变更文件
// ✅ 自身热更新：更新器脚本变了就自我覆盖并重启
//
// 参考了你上传的：
// - 《【TB】一键更新.js》里的：公益梯子 + 热更新 + 悬浮窗日志思路  fileciteturn4file0
// - 《生成代理2.js》里的：raw/api 分别测速与代理池补充思路          fileciteturn4file1

(function () {
  'use strict';

  // ========================= ① 用户配置（你一般只改这里） =========================
  var CONFIG = {
    owner: 'Yaoxizzz',
    repo: 'Taobao-AutoJs6',
    branch: 'main',

    // 安装目录：默认当前项目目录（你现在就是 /storage/emulated/0/脚本/Taobao-AutoJs6 ）
    installDir: files.cwd(),

    // 统一脚本名（建议你仓库/本地都保持一致）
    canonicalSelfName: '【TB】一键更新程序.js',

    // 更新策略
    forceUpdate: false,          // true=全部覆盖下载
    maxParallel: 4,              // 并发下载线程数

    // 文件过滤：默认不排除任何目录（你要“全部文件”）
    // 如果以后你发现素材太大想跳过，可加：/^淘宝素材\//
    exclude: [
      /^\.git\//,
      /^tmp\//
    ],

    // UI
    showConsole: false           // true=同时输出到 AutoJs 控制台（会多一个窗口）
  };

  // ========================= ② 网络配置（代理前缀池） =========================
  // 说明：这里每一项都是“前缀”，会拼接成：prefix + originUrl
  // 例如： http://gh.927223.xyz/ + https://raw.githubusercontent.com/.../version
  var SEED_PREFIX = [
    '',
    'http://gh.927223.xyz/',
    'https://ghproxy.net/',
    'https://mirror.ghproxy.com/',
    'https://github.moeyy.xyz/',
    'https://ghproxy.com/',
    'https://gh.llkk.cc/',
    'https://hub.gitmirror.com/'
  ];

  // 公益梯子（来自你给的参考脚本路径） fileciteturn4file2
  var LADDER_RAW_PATH = 'wengzhenquan/autojs6/main/tmp/公益梯子[魔法].txt';

  // 额外代理源（来自 生成代理2.js 的思路） fileciteturn4file1
  var PROXY_SOURCES = [
    'https://api.akams.cn/github',
    'https://xiake.pro/static/node.json',
    'https://git.mxg.pub/api/github/list',
    'https://yishijie.gitlab.io/ziyuan/gh.txt'
  ];

  // ========================= ③ Java/OkHttp 导入 =========================
  importClass(java.io.File);
  importClass(java.io.FileOutputStream);
  importClass(java.util.concurrent.TimeUnit);
  importClass(java.util.concurrent.Executors);
  importClass(java.util.concurrent.CountDownLatch);
  importClass(java.util.concurrent.atomic.AtomicInteger);
  importClass(okhttp3.OkHttpClient);
  importClass(okhttp3.Request);

  function buildClient(timeoutSec) {
    timeoutSec = timeoutSec || 10;
    return new OkHttpClient.Builder()
      .connectTimeout(timeoutSec, TimeUnit.SECONDS)
      .readTimeout(timeoutSec, TimeUnit.SECONDS)
      .followRedirects(true)
      .followSslRedirects(true)
      .build();
  }

  var clientPing = buildClient(3);
  var clientText = buildClient(10);
  var clientBin = buildClient(20);

  var UA = 'Mozilla/5.0 (Linux; Android) AutoJs6-Updater';

  // ========================= ④ 单悬浮窗 UI（避免两个窗口） =========================
  var UI = (function () {
    var win = null;
    var lineKeep = 10;
    var lines = [];
    var minimized = false;

    function tryCreate() {
      try {
        win = floaty.rawWindow(
          <card cardCornerRadius="10dp" cardElevation="8dp" bg="#151515" w="330dp">
            <vertical padding="12">
              <horizontal>
                <text id="title" text="★ TB 一键更新 ★" textSize="14sp" textColor="#FFD700" textStyle="bold" w="*"/>
                <text id="drag" text="≡" textSize="16sp" textColor="#AAAAAA" padding="6 0"/>
              </horizontal>
              <text id="status" text="初始化..." textSize="11sp" textColor="#00FF00" marginTop="8" maxLines="10"/>
              <progressbar id="bar" w="*" h="3dp" indeterminate="true" style="@style/Base.Widget.AppCompat.ProgressBar.Horizontal" marginTop="8"/>
              <horizontal marginTop="10" gravity="right">
                <button id="btnMini" text="收起" w="90dp"/>
                <button id="btnClose" text="关闭" w="90dp" marginLeft="10dp"/>
              </horizontal>
            </vertical>
          </card>
        );
        win.setPosition(parseInt(device.width * 0.06, 10), parseInt(device.height * 0.10, 10));
        win.setTouchable(true);

        // 拖动
        var x = 0, y = 0, wx = 0, wy = 0;
        win.drag.setOnTouchListener(function (v, e) {
          try {
            switch (e.getAction()) {
              case e.ACTION_DOWN:
                x = e.getRawX();
                y = e.getRawY();
                wx = win.getX();
                wy = win.getY();
                return true;
              case e.ACTION_MOVE:
                var nx = wx + (e.getRawX() - x);
                var ny = wy + (e.getRawY() - y);
                win.setPosition(parseInt(nx, 10), parseInt(ny, 10));
                return true;
            }
          } catch (err) {}
          return false;
        });

        win.btnMini.on('click', function () {
          ui.run(function () {
            minimized = !minimized;
            try {
              if (minimized) {
                win.status.setVisibility(8);
                win.bar.setVisibility(8);
                win.btnMini.setText('展开');
              } else {
                win.status.setVisibility(0);
                win.bar.setVisibility(0);
                win.btnMini.setText('收起');
              }
            } catch (e2) {}
          });
        });

        win.btnClose.on('click', function () {
          try { if (win) win.close(); } catch (e3) {}
          exit();
        });

        return true;
      } catch (e) {
        win = null;
        return false;
      }
    }

    function setTitle(t) {
      if (!win) return;
      ui.run(function () { try { win.title.setText(String(t)); } catch (e) {} });
    }

    function setIndeterminate(b) {
      if (!win) return;
      ui.run(function () { try { win.bar.setIndeterminate(!!b); } catch (e) {} });
    }

    function setProgress(cur, total) {
      if (!win) return;
      ui.run(function () {
        try {
          win.bar.setIndeterminate(false);
          win.bar.setMax(total);
          win.bar.setProgress(cur);
        } catch (e) {}
      });
    }

    function log(msg) {
      msg = String(msg);
      if (CONFIG.showConsole) console.log(msg);
      if (!win) return;
      lines.push(msg);
      if (lines.length > lineKeep) lines.shift();
      ui.run(function () {
        try { win.status.setText(lines.join('\n')); } catch (e) {}
      });
    }

    function close() {
      try { if (win) win.close(); } catch (e) {}
      win = null;
    }

    // 初始化
    var ok = tryCreate();
    if (!ok) {
      // 没有悬浮窗权限就退回控制台（只开一个）
      CONFIG.showConsole = true;
      console.show();
      console.clear();
    } else {
      // 有悬浮窗时，避免你看到第二个“控制台窗口”
      try { console.hide(); } catch (eHide) {}
    }

    return {
      setTitle: setTitle,
      setIndeterminate: setIndeterminate,
      setProgress: setProgress,
      log: log,
      close: close
    };
  })();

  function sleepSafe(ms) { try { sleep(ms); } catch (e) {} }

  function normalizePrefix(p) {
    p = String(p || '').trim();
    if (!p) return '';
    // 如果有人把 raw.githubusercontent.com 当“前缀”，会拼错，直接废掉
    if (/^https?:\/\/raw\.githubusercontent\.com\/?$/i.test(p)) return '';
    // 统一尾部 /
    p = p.replace(/\/+$/, '') + '/';
    return p;
  }

  function uniq(arr) {
    var map = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = String(arr[i]);
      if (!map[k]) { map[k] = true; out.push(arr[i]); }
    }
    return out;
  }

  function matchExclude(path) {
    for (var i = 0; i < CONFIG.exclude.length; i++) {
      if (CONFIG.exclude[i].test(path)) return true;
    }
    return false;
  }

  function safeJsonParse(s) {
    try { return JSON.parse(String(s)); } catch (e) { return null; }
  }

  function fileExistsAndNonEmpty(p) {
    try {
      return files.exists(p) && (new File(p).length() > 0);
    } catch (e) {
      return false;
    }
  }

  function createDirsForFile(p) {
    try { files.createWithDirs(p); } catch (e) {}
  }

  // ========================= ⑤ HTTP 层 =========================
  function httpGetString(url, client) {
    client = client || clientText;
    var req = new Request.Builder().url(url).header('User-Agent', UA).get().build();
    var res = null;
    try {
      res = client.newCall(req).execute();
      if (!res || !res.isSuccessful()) {
        var code = res ? res.code() : -1;
        try { if (res) res.close(); } catch (e0) {}
        return { ok: false, code: code, body: null };
      }
      var s = res.body().string();
      res.close();
      return { ok: true, code: 200, body: s };
    } catch (e) {
      try { if (res) res.close(); } catch (e1) {}
      return { ok: false, code: -2, body: null };
    }
  }

  function httpDownload(url, saveFile) {
    var req = new Request.Builder().url(url).header('User-Agent', UA).get().build();
    var res = null;
    try {
      res = clientBin.newCall(req).execute();
      if (!res || !res.isSuccessful()) {
        try { if (res) res.close(); } catch (e0) {}
        return false;
      }

      createDirsForFile(saveFile);

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

      return fileExistsAndNonEmpty(saveFile);
    } catch (e) {
      try { if (res) res.close(); } catch (e1) {}
      return false;
    }
  }

  // ========================= ⑥ URL 构造 =========================
  function originRaw(path) {
    // 用 refs/heads（你提到的形式）
    return 'https://raw.githubusercontent.com/' + CONFIG.owner + '/' + CONFIG.repo + '/refs/heads/' + CONFIG.branch + '/' + encodeURI(path);
  }

  function originApi(path) {
    // path: /repos/... or full endpoint
    return 'https://api.github.com' + path;
  }

  function wrap(prefix, origin) {
    prefix = normalizePrefix(prefix);
    if (!prefix) return origin;
    return prefix + origin;
  }

  // ========================= ⑦ 代理池管理（快筛优先） =========================
  var Net = {
    rawPrefixPool: uniq(SEED_PREFIX.map(normalizePrefix)),
    apiPrefixPool: uniq(SEED_PREFIX.map(normalizePrefix)),
    bestRaw: null,
    bestApi: null,

    // 快速测试：并发测试前 N 个前缀，返回最快一个
    fastPick: function (prefixPool, testOriginUrl, tag) {
      var N = Math.min(prefixPool.length, 10);
      var latch = new CountDownLatch(N);
      var best = { prefix: null, cost: 999999 };
      var lock = threads.lock();

      for (var i = 0; i < N; i++) {
        (function (p) {
          threads.start(function () {
            var t0 = new Date().getTime();
            var url = wrap(p, testOriginUrl) + '?t=' + t0;
            var r = httpGetString(url, clientPing);
            var cost = new Date().getTime() - t0;
            if (r.ok) {
              lock.lock();
              try {
                if (cost < best.cost) {
                  best.cost = cost;
                  best.prefix = p;
                }
              } finally {
                lock.unlock();
              }
            }
            latch.countDown();
          });
        })(prefixPool[i]);
      }

      // 等待（最多 4s）
      latch.await(4, TimeUnit.SECONDS);
      if (best.prefix !== null) {
        UI.log('✅ ' + tag + ' 选中加速器: ' + (best.prefix || '直连') + ' (' + best.cost + 'ms)');
        return best.prefix;
      }
      return null;
    },

    // 拉公益梯子（只在必要时执行）
    fetchLadderIfNeeded: function () {
      UI.log('>>>>>→ 代理池初始化 ←<<<<<');
      UI.log('--→ 内置种子节点: ' + this.rawPrefixPool.length);

      var ladderOrigin = 'https://raw.githubusercontent.com/' + encodeURI(LADDER_RAW_PATH);
      var fetched = false;

      // 只用少量种子去拉，避免你说的“慢”
      var seeds = [
        'http://gh.927223.xyz/',
        'https://ghproxy.net/',
        'https://mirror.ghproxy.com/',
        ''
      ];

      for (var i = 0; i < seeds.length; i++) {
        var p = normalizePrefix(seeds[i]);
        var url = wrap(p, ladderOrigin) + '?t=' + new Date().getTime();
        var r = httpGetString(url, clientText);
        if (r.ok && r.body) {
          var lines = String(r.body).split(/\r?\n/);
          var add = 0;
          for (var j = 0; j < lines.length; j++) {
            var line = String(lines[j]).trim();
            if (/^https?:\/\//i.test(line)) {
              this.rawPrefixPool.push(normalizePrefix(line));
              this.apiPrefixPool.push(normalizePrefix(line));
              add++;
            }
          }
          this.rawPrefixPool = uniq(this.rawPrefixPool);
          this.apiPrefixPool = uniq(this.apiPrefixPool);
          UI.log('--→ 拉取公益节点: ' + add);
          UI.log('--→ 当前可用总数: ' + this.rawPrefixPool.length);
          fetched = true;
          break;
        }
      }

      if (!fetched) UI.log('⚠️ 拉取公益节点失败（继续用种子节点）');
    },

    // 补充代理源（只在必要时执行，且有上限，避免慢）
    fetchProxySourcesIfNeeded: function () {
      var add = 0;
      for (var i = 0; i < PROXY_SOURCES.length; i++) {
        var src = PROXY_SOURCES[i] + '?t=' + new Date().getTime();
        var r = httpGetString(src, clientText);
        if (!r.ok || !r.body) continue;

        var body = String(r.body);
        var json = safeJsonParse(body);

        if (json && json.data && json.data.length) {
          for (var k = 0; k < json.data.length; k++) {
            var u = json.data[k] && json.data[k].url;
            if (u && /^https?:\/\//i.test(u)) {
              this.rawPrefixPool.push(normalizePrefix(u));
              this.apiPrefixPool.push(normalizePrefix(u));
              add++;
              if (add >= 120) break;
            }
          }
        } else {
          var lines = body.split(/\r?\n/);
          for (var j = 0; j < lines.length; j++) {
            var line = String(lines[j]).trim();
            if (/^https?:\/\//i.test(line)) {
              this.rawPrefixPool.push(normalizePrefix(line));
              this.apiPrefixPool.push(normalizePrefix(line));
              add++;
              if (add >= 120) break;
            }
          }
        }
        if (add >= 120) break;
      }

      if (add > 0) {
        this.rawPrefixPool = uniq(this.rawPrefixPool);
        this.apiPrefixPool = uniq(this.apiPrefixPool);
        UI.log('--→ 额外代理源补充: ' + add);
        UI.log('--→ 当前可用总数: ' + this.rawPrefixPool.length);
      }
    },

    // 选 bestRaw/bestApi（先快筛，失败再扩容）
    prepare: function () {
      UI.setIndeterminate(true);

      // 0) 快筛：不拉梯子，先试种子（最省时间）
      var testRaw = originRaw('version');
      var testApi = originApi('/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/version?ref=' + CONFIG.branch);

      this.bestRaw = this.fastPick(this.rawPrefixPool, testRaw, 'RAW');
      this.bestApi = this.fastPick(this.apiPrefixPool, testApi, 'API');

      // 1) RAW 失败才拉公益梯子
      if (this.bestRaw === null) {
        this.fetchLadderIfNeeded();
        this.bestRaw = this.fastPick(this.rawPrefixPool, testRaw, 'RAW');
      }

      // 2) 还失败才拉第三方代理源
      if (this.bestRaw === null) {
        this.fetchProxySourcesIfNeeded();
        this.bestRaw = this.fastPick(this.rawPrefixPool, testRaw, 'RAW');
      }

      // 3) API 同理（但 API 不是硬要求：如果拿不到 API，就退回 version 清单模式）
      if (this.bestApi === null) {
        // 先尝试用 bestRaw 当 API 前缀（很多代理 RAW/API 都能用）
        this.bestApi = this.fastPick([this.bestRaw].concat(this.apiPrefixPool), testApi, 'API');
      }

      if (this.bestRaw === null) return false;
      return true;
    },

    rawGetString: function (path) {
      var url = wrap(this.bestRaw, originRaw(path)) + '?t=' + new Date().getTime();
      return httpGetString(url, clientText);
    },

    rawDownload: function (path, localRel) {
      var url = wrap(this.bestRaw, originRaw(path)) + '?t=' + new Date().getTime();
      var save = files.join(CONFIG.installDir, localRel);
      return httpDownload(url, save);
    },

    apiGetJson: function (apiPath) {
      if (this.bestApi === null) return null;
      var url = wrap(this.bestApi, originApi(apiPath)) + '?t=' + new Date().getTime();
      var r = httpGetString(url, clientText);
      if (!r.ok || !r.body) return null;
      return safeJsonParse(r.body);
    }
  };

  // ========================= ⑧ 本地缓存（sha 差分） =========================
  var Cache = {
    path: null,
    map: {},

    load: function () {
      this.path = files.join(CONFIG.installDir, 'tmp', '更新缓存.json');
      try {
        if (files.exists(this.path)) {
          var txt = String(files.read(this.path));
          var j = safeJsonParse(txt);
          if (j && typeof j === 'object') this.map = j;
        }
      } catch (e) {
        this.map = {};
      }
    },

    save: function () {
      try {
        createDirsForFile(this.path);
        files.write(this.path, JSON.stringify(this.map, null, 2));
      } catch (e) {}
    }
  };

  // ========================= ⑨ 获取“仓库全文件清单” =========================
  function getRepoFileListViaApiTree() {
    // 1) refs -> commit sha
    var ref = Net.apiGetJson('/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/git/refs/heads/' + CONFIG.branch);
    if (!ref || !ref.object || !ref.object.sha) return null;
    var commitSha = ref.object.sha;

    // 2) commit -> tree sha
    var commit = Net.apiGetJson('/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/git/commits/' + commitSha);
    if (!commit || !commit.tree || !commit.tree.sha) return null;
    var treeSha = commit.tree.sha;

    // 3) tree recursive
    var tree = Net.apiGetJson('/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/git/trees/' + treeSha + '?recursive=1');
    if (!tree || !tree.tree || !tree.tree.length) return null;

    var out = [];
    for (var i = 0; i < tree.tree.length; i++) {
      var it = tree.tree[i];
      if (!it || it.type !== 'blob' || !it.path) continue;
      var p = String(it.path);
      if (matchExclude(p)) continue;
      out.push({ path: p, sha: it.sha || '' });
    }
    return out;
  }

  function getFileListViaVersionFallback(remoteVersionText) {
    // 兼容你现在 version 里只有 3 个 updateFile 的情况：仍能更新，但只会下载那 3 个
    var s = String(remoteVersionText || '').trim();
    var j = null;
    if (s && (s[0] === '{' || s[0] === '[')) j = safeJsonParse(s);
    if (!j || !j.updateFile || !j.updateFile.length) return null;

    var out = [];
    for (var i = 0; i < j.updateFile.length; i++) {
      var it = j.updateFile[i];
      if (!it) continue;
      var rp = (typeof it === 'string') ? it : (it.remote || it.path || it.name || it.file);
      var lp = (typeof it === 'string') ? it : (it.local || it.localPath || rp);
      if (!rp) continue;
      if (matchExclude(rp)) continue;
      out.push({ path: String(rp), local: String(lp), sha: '' });
    }
    return out;
  }

  // ========================= ⑩ 自身热更新 =========================
  function selfHotUpdateIfNeeded() {
    UI.log('>>>>→ 检查更新器版本 ←<<<<');

    var curPath = '';
    var curName = '';
    try {
      curPath = engines.myEngine().getSourceFile().getPath();
      curName = engines.myEngine().getSourceFile().getName();
    } catch (e) {}

    // 以“当前正在运行的文件名”为准，避免你出现【tb】/【TB】两份脚本互相覆盖导致混乱
    var selfName = curName || CONFIG.canonicalSelfName;

    // 远端脚本内容
    var rr = Net.rawGetString(selfName);
    if (!rr.ok || !rr.body || String(rr.body).length < 500) {
      UI.log('⚠️ 获取远端更新器失败（跳过自我更新）');
      return;
    }

    var remoteCode = String(rr.body);
    var localCode = '';
    try { localCode = curPath && files.exists(curPath) ? String(files.read(curPath)) : ''; } catch (e2) {}

    // 用长度+简单 hash，避免误判
    var need = (localCode.length !== remoteCode.length);
    if (!need) {
      // 再做一次 hash（长度相同也可能改了）
      var h1 = 0, h2 = 0, i;
      for (i = 0; i < localCode.length; i++) { h1 = (h1 * 131 + localCode.charCodeAt(i)) >>> 0; }
      for (i = 0; i < remoteCode.length; i++) { h2 = (h2 * 131 + remoteCode.charCodeAt(i)) >>> 0; }
      need = (h1 !== h2);
    }

    if (need) {
      UI.log('✨ 发现更新器新版本，正在更新自己...');

      var targetPath = files.join(CONFIG.installDir, CONFIG.canonicalSelfName);
      try {
        files.write(targetPath, remoteCode);
        if (curPath && curPath !== targetPath) {
          // 同时覆盖当前运行路径，防止你“下一次还在跑旧文件”
          files.write(curPath, remoteCode);
        }
      } catch (e3) {
        UI.log('❌ 写入更新器失败：' + e3);
        return;
      }

      UI.log('🔄 重启更新器...');
      sleepSafe(800);
      try {
        engines.execScriptFile(targetPath);
      } catch (e4) {
        UI.log('❌ 重启失败：' + e4);
      }
      UI.close();
      exit();
    }

    UI.log('✅ 更新器已是最新');
  }

  // ========================= ⑪ 下载执行（并发 + 差分） =========================
  function downloadAll(filesList) {
    var total = filesList.length;
    var needList = [];

    for (var i = 0; i < total; i++) {
      var item = filesList[i];
      var rp = item.path;
      var lp = item.local || rp;
      var sha = item.sha || '';

      // 差分判断
      var localAbs = files.join(CONFIG.installDir, lp);
      var need = CONFIG.forceUpdate || (!files.exists(localAbs));
      if (!need && sha) {
        need = (Cache.map[rp] !== sha);
      }
      if (need) needList.push({ remote: rp, local: lp, sha: sha });
    }

    UI.log('需要更新：' + needList.length + ' / ' + total);
    UI.setIndeterminate(false);
    UI.setProgress(0, Math.max(1, needList.length));

    if (needList.length === 0) return true;

    var done = new AtomicInteger(0);
    var okCount = new AtomicInteger(0);
    var latch = new CountDownLatch(needList.length);

    var pool = Executors.newFixedThreadPool(CONFIG.maxParallel);

    for (var j = 0; j < needList.length; j++) {
      (function (task) {
        pool.submit(new java.lang.Runnable({
          run: function () {
            try {
              var ok = Net.rawDownload(task.remote, task.local);
              if (ok) {
                okCount.incrementAndGet();
                if (task.sha) Cache.map[task.remote] = task.sha;
              }

              var cur = done.incrementAndGet();
              UI.setProgress(cur, needList.length);
              UI.log((ok ? '✅ ' : '❌ ') + task.remote);
            } catch (e) {
              var cur2 = done.incrementAndGet();
              UI.setProgress(cur2, needList.length);
              UI.log('❌ ' + task.remote + '（异常）');
            } finally {
              latch.countDown();
            }
          }
        }));
      })(needList[j]);
    }

    latch.await();
    try { pool.shutdownNow(); } catch (e2) {}

    var success = okCount.get();
    UI.log('完成：' + success + ' / ' + needList.length);
    return (success === needList.length);
  }

  // ========================= ⑫ 主流程 =========================
  function main() {
    UI.setTitle('★ TB 一键更新 ★');
    UI.log('项目目录：' + CONFIG.installDir);

    // 目录准备
    try { files.createWithDirs(files.join(CONFIG.installDir, 'tmp', 'x')); files.remove(files.join(CONFIG.installDir, 'tmp', 'x')); } catch (e0) {}

    Cache.load();

    // 网络准备
    UI.log('--- 网络准备 ---');
    if (!Net.prepare()) {
      UI.log('❌ 无法连通 RAW（直连/代理都失败）。\n建议：开代理/VPN 或更换网络。');
      sleepSafe(1500);
      UI.close();
      exit();
    }

    // 自身热更新
    selfHotUpdateIfNeeded();

    // 读远端 version（仅用于展示/兜底）
    var vr = Net.rawGetString('version');
    if (vr.ok && vr.body) {
      UI.log('远端 version 获取成功');
    } else {
      UI.log('⚠️ 远端 version 获取失败（不影响 API Tree 模式）');
    }

    // 获取仓库全文件清单
    UI.log('>>>>→ 获取仓库文件清单 ←<<<<');

    var list = null;
    if (Net.bestApi !== null) {
      list = getRepoFileListViaApiTree();
      if (list && list.length) {
        UI.log('✅ API Tree 获取成功：' + list.length + ' 个文件');
      } else {
        UI.log('⚠️ API Tree 获取失败：将退回 version 清单模式');
      }
    } else {
      UI.log('⚠️ API 不可用：将退回 version 清单模式');
    }

    // 退回：version updateFile
    if (!list || !list.length) {
      var vf = (vr.ok && vr.body) ? getFileListViaVersionFallback(vr.body) : null;
      if (vf && vf.length) {
        // 将 vf 结构统一到 downloadAll 需要的格式
        var tmp = [];
        for (var i = 0; i < vf.length; i++) {
          tmp.push({ path: vf[i].path, local: vf[i].local, sha: '' });
        }
        list = tmp;
        UI.log('✅ 使用 version.updateFile：' + list.length + ' 个文件');
      } else {
        UI.log('❌ 既拿不到 API Tree，也没有可用的 version.updateFile。\n请检查仓库是否存在 version 文件或网络是否可用。');
        sleepSafe(1500);
        UI.close();
        exit();
      }
    } else {
      // 统一结构
      var tmp2 = [];
      for (var j = 0; j < list.length; j++) {
        tmp2.push({ path: list[j].path, local: list[j].path, sha: list[j].sha });
      }
      list = tmp2;
    }

    // 开始下载
    UI.log('>>>>→ 开始同步文件 ←<<<<');
    var okAll = downloadAll(list);

    // 保存缓存
    Cache.save();

    // 刷新媒体库（让文件管理器更快看到新文件）
    try { media.scanFile(CONFIG.installDir); } catch (e3) {}

    if (okAll) {
      UI.log('------→> ★更新完成★ <←------');
      try { toast('更新完成！'); } catch (e4) {}
    } else {
      UI.log('⚠️ 更新完成但有失败项（可再运行一次补齐）');
      try { toast('更新完成（有失败项，可再运行一次）'); } catch (e5) {}
    }

    sleepSafe(1200);
    UI.close();
    exit();
  }

  try {
    main();
  } catch (e) {
    if (CONFIG.showConsole) console.error(e);
    UI.log('❌ 异常：' + e);
    sleepSafe(1500);
    UI.close();
  }
})();
