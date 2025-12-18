// 【TB】一键更新程序.js  （AutoJs6 / Rhino / ES5）
// ========================= 小白必看（你关心的 3 个问题） =========================
// 1) 为什么会出现 tmp 文件夹？
//    - 这是更新器自己创建的“工作目录”，用来存：下载缓存、sha 差分缓存、代理源缓存、自更新标记。
//    - 这个 tmp 不需要上传到 GitHub！也不需要你手动删除！
//    - 你就当它是“更新器的缓存目录”。删除也行，但删除后下次运行会重新生成。
//
// 2) 你想要：在 /sdcard/脚本/ 里运行，不要把文件散落一地，而是自动创建 /sdcard/脚本/<仓库名>/
//    - 已实现：默认开启自动建仓库目录。
//    - 举例：你在 /sdcard/脚本/ 直接运行本脚本，它会自动创建：/sdcard/脚本/Taobao-AutoJs6/
//      然后把所有文件同步到那个目录里（目录干净不混乱）。
//
// 3) 种子节点/代理源都失效怎么办？
//    - 已实现：支持“远端代理配置文件”自动更新（你只要在仓库根目录放一个 代理源.json）。
//    - 更新器每次跑通网络后，会拉取 代理源.json 覆盖本地缓存，下一次自动用最新代理列表。
//    - 我还根据联网检索，补充了几个常见可用的 GitHub 加速前缀（见 SEED_PREFIX）。
// ============================================================================

(function () {
  'use strict';

  // ========================= ① 你只需要改这里（新手配置区） =========================
  var CONFIG = {
    owner: 'Yaoxizzz',
    repo: 'Taobao-AutoJs6',
    branch: 'main',

    // 是否自动创建“仓库目录”避免脚本散落
    // true：如果你在 /sdcard/脚本/ 运行，它会改为 /sdcard/脚本/Taobao-AutoJs6/ 作为安装目录
    // false：就下载到当前目录（不推荐，会杂乱）
    autoCreateRepoDir: true,

    // 安装目录：默认当前目录（但如果 autoCreateRepoDir=true，会自动变成 当前目录/仓库名 ）
    installDir: files.cwd(),

    // 更新器脚本名（建议本地 & GitHub 同名同大小写）
    canonicalSelfName: '【TB】一键更新程序.js',

    // 强制更新：true=每次都全量覆盖；false=只更新变化文件（推荐）
    forceUpdate: false,

    // 并发下载数：3~6 比较合理
    maxParallel: 4,

    // 排除规则：tmp/ 默认排除（因为它是缓存目录，不应该从 GitHub 同步）
    // 如果你以后不想同步大素材目录，可加：/^淘宝素材\//
    exclude: [
      /^\.git\//,
      /^tmp\//
    ],

    // 是否弹出 console.show（会多一个窗口；一般不需要）
    showConsoleWindow: false
  };

  // ========================= ② 常量（你一般不用动） =========================
  var UA = 'Mozilla/5.0 (Linux; Android) AutoJs6-Updater';
  var LOG_PREFIX = '[TB更新] ';

  // 更新器工作目录（tmp 目录里再分一个子目录，避免你自己也用 tmp 时冲突）
  var WORK_SUBDIR = 'TB更新';

  // 远端“代理配置文件”（可选）：放在你仓库根目录
  // 文件名建议就叫：代理源.json
  // 内容示例见本文末尾注释。
  var REMOTE_PROXY_CONFIG = '代理源.json';

  // ========================= ③ 自动创建仓库目录（解决“文件散落很乱”） =========================
  // 逻辑：
  // - 如果你当前目录名不是 repo（例如你在 /sdcard/脚本/ 运行）
  //   就把 installDir 改成：当前目录/repo
  //   并把脚本复制过去后从新位置启动（让 files.cwd 也变成新目录）
  function ensureRepoDirBootstrap() {
    if (!CONFIG.autoCreateRepoDir) return;

    var cwd = files.cwd();
    var cwdName = '';
    try { cwdName = new java.io.File(cwd).getName(); } catch (e) {}

    // 如果已经在仓库目录（例如 .../Taobao-AutoJs6），就不动
    if (cwdName === CONFIG.repo) {
      CONFIG.installDir = cwd;
      return;
    }

    // 否则，目标目录 = 当前目录/仓库名
    var targetDir = files.join(cwd, CONFIG.repo);
    try {
      files.createWithDirs(files.join(targetDir, 'tmp', 'x'));
      files.remove(files.join(targetDir, 'tmp', 'x'));
    } catch (e2) {}

    CONFIG.installDir = targetDir;

    // 如果当前脚本不在 targetDir，就复制过去并从那里启动一次（只会发生 1 次）
    var srcPath = '';
    try { srcPath = engines.myEngine().getSourceFile().getPath(); } catch (e3) {}

    if (srcPath && srcPath.indexOf(targetDir) !== 0) {
      var dstPath = files.join(targetDir, CONFIG.canonicalSelfName);
      try {
        var code = files.read(srcPath);
        files.write(dstPath, code);
      } catch (e4) {
        // 如果复制失败，就继续在当前目录运行（只是文件会下载到 targetDir）
        console.log(LOG_PREFIX + '⚠️ 无法复制脚本到仓库目录：' + e4);
        return;
      }

      // 从新目录启动并退出本次
      console.log(LOG_PREFIX + '✅ 已创建仓库目录并迁移更新器：' + targetDir);
      try { engines.execScriptFile(dstPath); } catch (e5) {
        console.log(LOG_PREFIX + '❌ 迁移后启动失败：' + e5);
      }
      exit();
    }
  }

  ensureRepoDirBootstrap();

  // ========================= ④ 依赖导入 =========================
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
  var clientText = buildClient(12);
  var clientBin = buildClient(25);

  // ========================= ⑤ 日志：必须在 AutoJs6“运行日志面板”可见 =========================
  if (CONFIG.showConsoleWindow) {
    try { console.show(); } catch (e0) {}
  }

  var UI = (function () {
    var win = null;
    var lines = [];
    var keep = 12;

    function tryCreate() {
      try {
        win = floaty.rawWindow(
          <card cardCornerRadius="10dp" cardElevation="8dp" bg="#151515" w="340dp">
            <vertical padding="12">
              <horizontal>
                <text id="title" text="★ TB 一键更新 ★" textSize="14sp" textColor="#FFD700" textStyle="bold" w="*"/>
                <text id="drag" text="≡" textSize="16sp" textColor="#AAAAAA" padding="6 0"/>
              </horizontal>
              <text id="status" text="准备中..." textSize="11sp" textColor="#00FF00" marginTop="8" maxLines="12"/>
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

        var mini = false;
        win.btnMini.on('click', function () {
          ui.run(function () {
            mini = !mini;
            try {
              if (mini) {
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
          try { win.close(); } catch (e3) {}
          exit();
        });

        return true;
      } catch (e) {
        win = null;
        return false;
      }
    }

    function append(msg) {
      if (!win) return;
      lines.push(String(msg));
      if (lines.length > keep) lines.shift();
      ui.run(function () {
        try { win.status.setText(lines.join('\n')); } catch (e) {}
      });
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

    function indeterminate(b) {
      if (!win) return;
      ui.run(function () {
        try { win.bar.setIndeterminate(!!b); } catch (e) {}
      });
    }

    function close() {
      try { if (win) win.close(); } catch (e) {}
      win = null;
    }

    tryCreate();

    return {
      append: append,
      setProgress: setProgress,
      indeterminate: indeterminate,
      close: close
    };
  })();

  function LOG(msg) {
    msg = String(msg);
    console.log(LOG_PREFIX + msg);
    UI.append(msg);
  }

  function sleepSafe(ms) { try { sleep(ms); } catch (e) {} }

  function uniq(arr) {
    var map = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = String(arr[i]);
      if (!map[k]) { map[k] = true; out.push(arr[i]); }
    }
    return out;
  }

  function normalizePrefix(p) {
    p = String(p || '').trim();
    if (!p) return '';
    // 防呆：有人会把 raw.githubusercontent.com 当“前缀”，会拼坏
    if (/^https?:\/\/raw\.githubusercontent\.com\/?$/i.test(p)) return '';
    p = p.replace(/\/+$/, '') + '/';
    return p;
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
    try { return files.exists(p) && (new File(p).length() > 0); } catch (e) { return false; }
  }

  function createDirsForFile(p) {
    try { files.createWithDirs(p); } catch (e) {}
  }

  // ========================= ⑥ 工作目录 / 缓存说明（回答你“tmp 哪来的”） =========================
  // tmp 目录是更新器自己创建的缓存目录：
  //   tmp/TB更新/更新缓存.json       -> sha 差分缓存（决定哪些文件需要更新）
  //   tmp/TB更新/代理源缓存.json     -> 代理/种子节点缓存（下次启动更快）
  //   tmp/TB更新/自更新标记.json     -> 防止更新器死循环自更新
  // 不要上传 GitHub；也不用删；删了也没事。
  var WORK_DIR = files.join(CONFIG.installDir, 'tmp', WORK_SUBDIR);
  try {
    files.createWithDirs(files.join(WORK_DIR, 'x'));
    files.remove(files.join(WORK_DIR, 'x'));
  } catch (eWD) {}

  // ========================= ⑦ 代理/种子节点（内置 + 自动更新） =========================
  // 内置种子节点（越稳定越好；脚本会自动测速选最快）
  // 我根据联网检索补充了：gh-proxy.com / ghproxy.vip / ghproxy.site
  // 说明：这些服务不保证长期可用，所以我们还做了“远端代理配置”自动更新。
  var SEED_PREFIX = [
    '',
    'http://gh.927223.xyz/',
    'https://ghproxy.net/',
    'https://mirror.ghproxy.com/',
    'https://github.moeyy.xyz/',
    'https://ghproxy.com/',
    'https://gh.llkk.cc/',
    'https://hub.gitmirror.com/',
    'https://gh-proxy.com/',
    'https://ghproxy.vip/',
    'https://ghproxy.site/'
  ];

  // 公益梯子（只在“快筛失败”时才去拉，避免慢）
  var LADDER_RAW_PATH = 'wengzhenquan/autojs6/main/tmp/公益梯子[魔法].txt';

  // 额外代理源（用于补充更多前缀；同样只在必要时执行，并限制数量）
  var PROXY_SOURCES = [
    'https://api.akams.cn/github',
    'https://xiake.pro/static/node.json',
    'https://git.mxg.pub/api/github/list',
    'https://yishijie.gitlab.io/ziyuan/gh.txt',
    'https://ghproxy.net/'
  ];

  // 本地代理缓存（下一次启动会优先用上次最快节点，更快）
  var ProxyCache = {
    path: files.join(WORK_DIR, '代理源缓存.json'),
    data: null,
    load: function () {
      try {
        if (files.exists(this.path)) {
          var j = safeJsonParse(String(files.read(this.path)));
          if (j && typeof j === 'object') this.data = j;
        }
      } catch (e) {}
    },
    save: function () {
      try {
        createDirsForFile(this.path);
        files.write(this.path, JSON.stringify(this.data || {}, null, 2));
      } catch (e) {}
    }
  };

  ProxyCache.load();
  if (ProxyCache.data) {
    // 把上次成功/最快的放到最前面（启动更快）
    if (ProxyCache.data.bestRaw) SEED_PREFIX.unshift(ProxyCache.data.bestRaw);
    if (ProxyCache.data.seed_prefix && ProxyCache.data.seed_prefix.length) {
      for (var iSP = 0; iSP < ProxyCache.data.seed_prefix.length; iSP++) {
        SEED_PREFIX.push(ProxyCache.data.seed_prefix[iSP]);
      }
    }
    if (ProxyCache.data.proxy_sources && ProxyCache.data.proxy_sources.length) {
      for (var iPS = 0; iPS < ProxyCache.data.proxy_sources.length; iPS++) {
        PROXY_SOURCES.push(ProxyCache.data.proxy_sources[iPS]);
      }
    }
  }

  SEED_PREFIX = uniq(SEED_PREFIX.map(normalizePrefix));
  PROXY_SOURCES = uniq(PROXY_SOURCES);

  // ========================= ⑧ HTTP =========================
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
      while ((len = is.read(buffer)) != -1) fos.write(buffer, 0, len);
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

  // ========================= ⑨ URL =========================
  function originRaw(path) {
    return 'https://raw.githubusercontent.com/' + CONFIG.owner + '/' + CONFIG.repo + '/refs/heads/' + CONFIG.branch + '/' + encodeURI(path);
  }

  function originApi(path) {
    return 'https://api.github.com' + path;
  }

  function wrap(prefix, origin) {
    prefix = normalizePrefix(prefix);
    if (!prefix) return origin;
    return prefix + origin;
  }

  // ========================= ⑩ 缓存（sha 差分 + 兜底版本号） =========================
  var Cache = {
    path: files.join(WORK_DIR, '更新缓存.json'),
    map: {},
    load: function () {
      try {
        if (files.exists(this.path)) {
          var j = safeJsonParse(String(files.read(this.path)));
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

  // ========================= ⑪ 代理池（快筛优先） =========================
  var Net = {
    rawPrefixPool: SEED_PREFIX.slice(),
    apiPrefixPool: SEED_PREFIX.slice(),
    bestRaw: null,
    bestApi: null,

    fastPick: function (prefixPool, testOriginUrl, tag) {
      var N = Math.min(prefixPool.length, 6);
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
              } finally { lock.unlock(); }
            }
            latch.countDown();
          });
        })(prefixPool[i]);
      }

      latch.await(2, TimeUnit.SECONDS);
      if (best.prefix !== null) {
        LOG('✅ ' + tag + ' 选中加速器: ' + (best.prefix || '直连') + ' (' + best.cost + 'ms)');
        return best.prefix;
      }
      return null;
    },

    fetchLadder: function () {
      LOG('>>>>>→ 拉取公益节点（必要时才会做） ←<<<<<');
      var ladderOrigin = 'https://raw.githubusercontent.com/' + encodeURI(LADDER_RAW_PATH);
      var seeds = ['http://gh.927223.xyz/', 'https://ghproxy.net/', 'https://mirror.ghproxy.com/', ''];

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
              if (add >= 80) break;
            }
          }
          this.rawPrefixPool = uniq(this.rawPrefixPool.map(normalizePrefix));
          this.apiPrefixPool = uniq(this.apiPrefixPool.map(normalizePrefix));
          LOG('--→ 公益节点追加: ' + add + '；总数=' + this.rawPrefixPool.length);
          return;
        }
      }
      LOG('⚠️ 公益节点拉取失败');
    },

    fetchProxySources: function () {
      LOG('>>>>>→ 代理源补充（必要时才会做） ←<<<<<');
      var add = 0;
      for (var i = 0; i < PROXY_SOURCES.length; i++) {
        var src = PROXY_SOURCES[i] + '?t=' + new Date().getTime();
        var r = httpGetString(src, clientText);
        if (!r.ok || !r.body) continue;

        var body = String(r.body);
        var json = safeJsonParse(body);

        // 兼容多种格式：
        // - { data:[{url:"https://..."}, ...] }
        // - 多行文本，每行一个 https://...
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
        this.rawPrefixPool = uniq(this.rawPrefixPool.map(normalizePrefix));
        this.apiPrefixPool = uniq(this.apiPrefixPool.map(normalizePrefix));
        LOG('--→ 代理源追加: ' + add + '；总数=' + this.rawPrefixPool.length);
      }
    },

    prepare: function () {
      UI.indeterminate(true);

      // 测试用 project.json（你仓库一定有；version 不一定有）
      var testRaw = originRaw('project.json');

      // API 测试用仓库信息接口（不依赖 version）
      var testApi = originApi('/repos/' + CONFIG.owner + '/' + CONFIG.repo);

      LOG('---→ 节点快筛（不拉梯子）');
      this.bestRaw = this.fastPick(this.rawPrefixPool, testRaw, 'RAW');
      this.bestApi = this.fastPick(this.apiPrefixPool, testApi, 'API');

      if (this.bestRaw === null) {
        this.fetchLadder();
        this.bestRaw = this.fastPick(this.rawPrefixPool, testRaw, 'RAW');
      }
      if (this.bestRaw === null) {
        this.fetchProxySources();
        this.bestRaw = this.fastPick(this.rawPrefixPool, testRaw, 'RAW');
      }

      if (this.bestApi === null) {
        // 尝试复用 RAW 前缀
        this.bestApi = this.fastPick([this.bestRaw].concat(this.apiPrefixPool), testApi, 'API');
      }

      if (this.bestRaw === null) return false;

      LOG('RAW 加速器最终选择：' + (this.bestRaw || '直连'));
      LOG('API 加速器最终选择：' + (this.bestApi === null ? '不可用（将走兜底模式）' : (this.bestApi || '直连')));

      // 记住本次最快节点（下次放最前面）
      ProxyCache.data = ProxyCache.data || {};
      ProxyCache.data.bestRaw = this.bestRaw || '';
      ProxyCache.data.bestApi = (this.bestApi === null ? '' : (this.bestApi || ''));
      ProxyCache.save();

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

  // ========================= ⑫ 远端代理配置自动更新（解决“代理全失效怎么办”） =========================
  function refreshProxyConfigFromRemote() {
    // 只有当网络已经跑通（bestRaw 有值）才可能拿到远端配置
    // 远端配置放在：仓库根目录/代理源.json
    // 你可以随时在 GitHub 更新这个文件，手机下次运行会自动替换本地代理缓存。

    LOG('>>>>→ 尝试拉取远端代理配置：' + REMOTE_PROXY_CONFIG + ' ←<<<<');

    var rr = Net.rawGetString(REMOTE_PROXY_CONFIG);
    if (!rr.ok || !rr.body) {
      LOG('（跳过）远端代理配置不存在或读取失败');
      return;
    }

    var j = safeJsonParse(rr.body);
    if (!j || typeof j !== 'object') {
      LOG('（跳过）远端代理配置不是 JSON');
      return;
    }

    // 支持字段：seed_prefix / proxy_sources
    var sp = j.seed_prefix || j.seedPrefix;
    var ps = j.proxy_sources || j.proxySources;

    if (sp && sp.length) {
      ProxyCache.data = ProxyCache.data || {};
      ProxyCache.data.seed_prefix = sp;
    }
    if (ps && ps.length) {
      ProxyCache.data = ProxyCache.data || {};
      ProxyCache.data.proxy_sources = ps;
    }

    ProxyCache.save();
    LOG('✅ 已更新本地代理缓存（下次启动会自动使用最新列表）');
  }

  // ========================= ⑬ 仓库全文件清单（API Tree） =========================
  function getRepoFileListViaApiTree() {
    var ref = Net.apiGetJson('/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/git/refs/heads/' + CONFIG.branch);
    if (!ref || !ref.object || !ref.object.sha) return null;
    var commitSha = ref.object.sha;

    var commit = Net.apiGetJson('/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/git/commits/' + commitSha);
    if (!commit || !commit.tree || !commit.tree.sha) return null;
    var treeSha = commit.tree.sha;

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

  // ========================= ⑭ 兜底：version.updateFile（可有可无） =========================
  function parseVersion(remoteVersionText) {
    var j = safeJsonParse(String(remoteVersionText || '').trim());
    if (!j) return { ok: false };
    var ver = j.version ? String(j.version) : '';
    var list = [];
    if (j.updateFile && j.updateFile.length) {
      for (var i = 0; i < j.updateFile.length; i++) {
        var it = j.updateFile[i];
        var rp = (typeof it === 'string') ? it : (it.remote || it.path || it.name || it.file);
        var lp = (typeof it === 'string') ? it : (it.local || it.localPath || rp);
        if (!rp) continue;
        rp = String(rp);
        lp = String(lp);
        if (matchExclude(rp)) continue;
        list.push({ path: rp, local: lp, sha: '' });
      }
    }
    return { ok: true, version: ver, list: list };
  }

  // ========================= ⑮ 自我更新（带“HTML拦截页识别”+ 防死循环） =========================
  function looksLikeJs(code) {
    code = String(code || '');
    if (code.length < 800) return false;
    if (/<html/i.test(code) || /<!doctype/i.test(code)) return false;
    if (code.indexOf('【TB】一键更新程序.js') < 0) return false;
    return true;
  }

  function simpleHash(str) {
    str = String(str || '');
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0);
  }

  function readSelfMarker() {
    var p = files.join(WORK_DIR, '自更新标记.json');
    try {
      if (!files.exists(p)) return null;
      return safeJsonParse(String(files.read(p)));
    } catch (e) {
      return null;
    }
  }

  function writeSelfMarker(obj) {
    var p = files.join(WORK_DIR, '自更新标记.json');
    try {
      createDirsForFile(p);
      files.write(p, JSON.stringify(obj, null, 2));
    } catch (e) {}
  }

  function selfHotUpdateIfNeeded() {
    LOG('>>>>→ 检查更新器版本 ←<<<<');

    var curPath = '';
    var curName = '';
    try {
      curPath = engines.myEngine().getSourceFile().getPath();
      curName = engines.myEngine().getSourceFile().getName();
    } catch (e) {}

    var selfName = curName || CONFIG.canonicalSelfName;

    var rr = Net.rawGetString(selfName);
    if (!rr.ok || !rr.body) {
      LOG('⚠️ 获取远端更新器失败（跳过自我更新）');
      return;
    }

    var remoteCode = String(rr.body);
    if (!looksLikeJs(remoteCode)) {
      LOG('⚠️ 远端更新器内容不像 JS（可能是代理返回 HTML/拦截页），跳过自我更新');
      return;
    }

    var localCode = '';
    try { localCode = curPath && files.exists(curPath) ? String(files.read(curPath)) : ''; } catch (e2) {}

    var remoteH = simpleHash(remoteCode);
    var localH = simpleHash(localCode);

    if (remoteH === localH) {
      LOG('✅ 更新器已是最新');
      return;
    }

    // 防死循环：2 分钟内如果已经更新到同一个 remoteH，就别再重启
    var mk = readSelfMarker();
    if (mk && mk.remoteHash === remoteH && mk.time && (new Date().getTime() - mk.time) < 120000) {
      LOG('⚠️ 检测到可能的循环自更新，已跳过（避免反复重启）');
      return;
    }

    LOG('✨ 发现更新器新版本，开始自我更新...');

    var targetPath = files.join(CONFIG.installDir, CONFIG.canonicalSelfName);
    try {
      files.write(targetPath, remoteCode);
      if (curPath && curPath !== targetPath) files.write(curPath, remoteCode);
      writeSelfMarker({ remoteHash: remoteH, time: new Date().getTime() });
    } catch (e3) {
      LOG('❌ 写入更新器失败：' + e3);
      return;
    }

    LOG('🔄 重启更新器...');
    sleepSafe(800);
    try { engines.execScriptFile(targetPath); } catch (e4) { LOG('❌ 重启失败：' + e4); }
    UI.close();
    exit();
  }

  // ========================= ⑯ 下载（并发 + sha 差分） =========================
  function downloadAll(filesList, forceAll) {
    forceAll = !!forceAll;
    var total = filesList.length;
    var needList = [];

    for (var i = 0; i < total; i++) {
      var item = filesList[i];
      var rp = item.path;
      var lp = item.local || rp;
      var sha = item.sha || '';
      var localAbs = files.join(CONFIG.installDir, lp);

      var need = CONFIG.forceUpdate || forceAll || (!files.exists(localAbs));
      if (!need && sha) need = (Cache.map[rp] !== sha);

      if (need) needList.push({ remote: rp, local: lp, sha: sha });
    }

    LOG('需要更新：' + needList.length + ' / ' + total);

    UI.indeterminate(false);
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
              LOG((ok ? '✅ ' : '❌ ') + task.remote);
            } catch (e) {
              var cur2 = done.incrementAndGet();
              UI.setProgress(cur2, needList.length);
              LOG('❌ ' + task.remote + '（异常）');
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
    LOG('完成：' + success + ' / ' + needList.length);
    return (success === needList.length);
  }

  // ========================= ⑰ 主流程 =========================
  function main() {
    LOG('启动更新器');
    LOG('项目目录：' + CONFIG.installDir);

    Cache.load();

    LOG('--- 网络准备 ---');
    if (!Net.prepare()) {
      LOG('❌ 无法连通 RAW（直连/代理都失败）。建议：开代理/VPN 或更换网络');
      sleepSafe(1200);
      UI.close();
      exit();
    }

    // 网络已通：尝试更新“远端代理配置”（用于未来运行更稳）
    refreshProxyConfigFromRemote();

    // 自身热更新
    selfHotUpdateIfNeeded();

    // 读取远端 version（仅用于兜底）
    var verInfo = null;
    var vr = Net.rawGetString('version');
    if (vr.ok && vr.body) {
      verInfo = parseVersion(vr.body);
      if (verInfo.ok) LOG('远端 version 读取成功，version=' + (verInfo.version || '(空)') + '，updateFile=' + verInfo.list.length);
    }

    // 1) 优先：API Tree 全仓库
    LOG('>>>>→ 获取仓库文件清单 ←<<<<');

    var mode = '';
    var list = null;

    if (Net.bestApi !== null) {
      list = getRepoFileListViaApiTree();
      if (list && list.length) {
        mode = 'apiTree';
        LOG('✅ API Tree 获取成功：' + list.length + ' 个文件（全仓库模式）');
      }
    }

    // 2) 兜底：version.updateFile
    var forceAllFallback = false;
    if (!list || !list.length) {
      mode = 'versionFallback';
      if (verInfo && verInfo.ok && verInfo.list.length) {
        list = verInfo.list;

        // 小白友好规则：兜底模式只看 version 字符串是否变化。
        var remoteVer = verInfo.version || '';
        var localVer = Cache.map._fallbackVersion || '';
        if (remoteVer && remoteVer !== localVer) {
          forceAllFallback = true;
          LOG('⚡ 检测到新版本：' + localVer + ' -> ' + remoteVer + '（兜底模式将强制更新 updateFile 列表）');
          Cache.map._fallbackVersion = remoteVer;
        } else {
          LOG('兜底模式：版本号未变化（只补缺失文件；如需强制可把 CONFIG.forceUpdate=true）');
        }

        LOG('⚠️ API Tree 获取失败：使用 version.updateFile：' + list.length + ' 个文件');
      } else {
        LOG('❌ API Tree 不可用且 version.updateFile 也不可用：无法更新');
        sleepSafe(1500);
        UI.close();
        exit();
      }
    } else {
      // 统一结构
      var tmp2 = [];
      for (var i = 0; i < list.length; i++) tmp2.push({ path: list[i].path, local: list[i].path, sha: list[i].sha });
      list = tmp2;
    }

    LOG('>>>>→ 开始同步文件 ←<<<<（模式=' + mode + '）');
    var okAll = downloadAll(list, forceAllFallback);

    Cache.save();

    try { media.scanFile(CONFIG.installDir); } catch (e3) {}

    if (okAll) {
      LOG('------→> ★更新完成★ <←------');
      try { toast('更新完成！'); } catch (e4) {}
    } else {
      LOG('⚠️ 更新完成但有失败项（再运行一次通常可补齐）');
      try { toast('更新完成（有失败项）'); } catch (e5) {}
    }

    sleepSafe(1000);
    UI.close();
    exit();
  }

  try {
    main();
  } catch (e) {
    console.error(LOG_PREFIX + '异常：' + e);
    LOG('❌ 异常：' + e);
    sleepSafe(1200);
    UI.close();
  }
})();

// ========================= 远端代理配置文件：代理源.json（可选） =========================
// 你把下面内容存成一个文件，放到 GitHub 仓库根目录，文件名：代理源.json
// 以后如果你发现某些代理挂了，只要改这个文件并提交到 GitHub，手机端下次更新会自动拉取并替换。
//
// {
//   "seed_prefix": [
//     "",
//     "http://gh.927223.xyz/",
//     "https://ghproxy.net/",
//     "https://mirror.ghproxy.com/",
//     "https://gh-proxy.com/",
//     "https://ghproxy.vip/",
//     "https://ghproxy.site/"
//   ],
//   "proxy_sources": [
//     "https://api.akams.cn/github",
//     "https://git.mxg.pub/api/github/list",
//     "https://yishijie.gitlab.io/ziyuan/gh.txt"
//   ]
// }
