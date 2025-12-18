// 【TB】一键更新程序.js
// ========================= 小白必看（一定要看） =========================
// 你要的目标：
//   ✅ 一键把 GitHub 仓库【所有文件】同步到手机项目目录（不只 3 个 updateFile）
//   ✅ AutoJs6“运行日志面板”里能看到完整过程（每一步都能定位问题）
//   ✅ 不再出现“反复更新自己/不停重启”的死循环
//
// 这份更新器有两种工作模式：
//   【A. 全仓库模式（优先）】GitHub API Tree -> 得到仓库全部文件列表 -> RAW 逐文件下载
//       你运行日志里会看到："✅ API Tree 获取成功：xxx 个文件"  （这就是全量）
//
//   【B. 兜底模式（备用）】如果 api.github.com 访问不到 -> 退回读取仓库根目录的 version 文件
//       只更新 version.updateFile 里列出的文件
//       你运行日志里会看到："⚠️ API Tree 获取失败：使用 version.updateFile" 
//
// 【version 文件到底怎么用？】
//   - 如果你能稳定访问 GitHub API：version 可有可无（只是备用）
//   - 如果你经常访问不到 API：强烈建议保留 version（用我给你的“生成version清单脚本”自动生成全文件列表）
//
// 【版本号要怎么改？】
//   - 你只改 "version": "1.0.3" -> "1.0.4" 就算“发布新版本”。
//   - 本更新器在“兜底模式”下会比较版本号：版本号变了 => 会强制更新 updateFile 列表里的文件。
//   - 不需要你手动写每个文件的时间（小白就别折腾时间了）。
// ===============================================================

(function () {
  'use strict';

  // ========================= ① 用户配置（你一般只改这里） =========================
  var CONFIG = {
    // 你的 GitHub 用户名（owner）
    owner: 'Yaoxizzz',

    // 你的仓库名（repo）
    repo: 'Taobao-AutoJs6',

    // 分支名：一般 main / master
    branch: 'main',

    // 安装目录：下载到手机哪里（默认当前项目目录）
    installDir: files.cwd(),

    // 更新器脚本名（建议你本地和 GitHub 仓库都保持同名同大小写）
    canonicalSelfName: '【TB】一键更新程序.js',

    // 强制全量更新（true=全部覆盖下载；false=只更新变更文件）
    forceUpdate: false,

    // 并发下载数：3~6 比较合适
    maxParallel: 4,

    // 排除规则（默认跳过 tmp/）
    // 如果你以后不想同步大素材目录，可加：/^淘宝素材\//
    exclude: [
      /^\.git\//,
      /^tmp\//
    ],

    // 是否同时打开控制台窗口（会多一个窗口；一般不用）
    showConsoleWindow: false
  };

  // ========================= ② 网络配置（代理前缀池） =========================
  // 这里每一项都是“前缀”，会拼接成：prefix + originUrl
  // 例如： http://gh.927223.xyz/ + https://raw.githubusercontent.com/.../project.json
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

  // 公益梯子列表（只在“快筛失败”时才会去拉，避免慢）
  var LADDER_RAW_PATH = 'wengzhenquan/autojs6/main/tmp/公益梯子[魔法].txt';

  // 额外代理源（只在必要时执行，并有上限，避免慢）
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
  var clientText = buildClient(12);
  var clientBin = buildClient(25);

  var UA = 'Mozilla/5.0 (Linux; Android) AutoJs6-Updater';
  var LOG_PREFIX = '[TB更新] ';

  // ========================= ④ 日志：一定输出到“运行日志面板” =========================
  // 你抱怨“看不到日志”，就是因为之前日志只写到悬浮窗。
  // 现在：每一条都 console.log 一份（AutoJs6 面板可见），悬浮窗再显示一份。

  // 可选：控制台窗口（一般不需要）
  if (CONFIG.showConsoleWindow) {
    try { console.show(); } catch (e0) {}
  }

  // 悬浮窗（只有一个）
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

  function normalizePrefix(p) {
    p = String(p || '').trim();
    if (!p) return '';
    if (/^https?:\/\/raw\.githubusercontent\.com\/?$/i.test(p)) return '';
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
    try { return files.exists(p) && (new File(p).length() > 0); } catch (e) { return false; }
  }

  function createDirsForFile(p) {
    try { files.createWithDirs(p); } catch (e) {}
  }

  // ========================= ⑤ HTTP =========================
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

  // ========================= ⑥ URL =========================
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

  // ========================= ⑦ 缓存（用于 sha 差分 + 兜底版本号） =========================
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

  // ========================= ⑧ 代理池（快筛优先） =========================
  var Net = {
    rawPrefixPool: uniq(SEED_PREFIX.map(normalizePrefix)),
    apiPrefixPool: uniq(SEED_PREFIX.map(normalizePrefix)),
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
              } finally {
                lock.unlock();
              }
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
      LOG('>>>>>→ 拉取公益节点（只有必要时才会做） ←<<<<<');
      var ladderOrigin = 'https://raw.githubusercontent.com/' + encodeURI(LADDER_RAW_PATH);

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
              if (add >= 80) break;
            }
          }
          this.rawPrefixPool = uniq(this.rawPrefixPool);
          this.apiPrefixPool = uniq(this.apiPrefixPool);
          LOG('--→ 公益节点追加: ' + add + '；总数=' + this.rawPrefixPool.length);
          return;
        }
      }
      LOG('⚠️ 公益节点拉取失败（继续用种子节点）');
    },

    fetchProxySources: function () {
      LOG('>>>>>→ 代理源补充（只有必要时才会做） ←<<<<<');
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
        LOG('--→ 代理源追加: ' + add + '；总数=' + this.rawPrefixPool.length);
      }
    },

    prepare: function () {
      UI.indeterminate(true);

      // 注意：version 不是必需文件，所以测试用 project.json（你仓库必有）
      var testRaw = originRaw('project.json');

      // API 测试用仓库信息接口（不依赖 version 文件）
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
        // 尝试复用 RAW 的前缀做 API
        this.bestApi = this.fastPick([this.bestRaw].concat(this.apiPrefixPool), testApi, 'API');
      }

      if (this.bestRaw === null) return false;

      LOG('RAW 加速器最终选择：' + (this.bestRaw || '直连'));
      LOG('API 加速器最终选择：' + (this.bestApi === null ? '不可用（将走兜底模式）' : (this.bestApi || '直连')));
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

  // ========================= ⑨ 仓库全文件清单（API Tree） =========================
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

  // ========================= ⑩ 兜底：version.updateFile =========================
  function parseVersionFile(remoteVersionText) {
    var s = String(remoteVersionText || '').trim();
    var j = null;
    if (s && (s[0] === '{' || s[0] === '[')) j = safeJsonParse(s);
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

  // ========================= ⑪ 自身热更新（防死循环） =========================
  function looksLikeJs(code) {
    code = String(code || '');
    if (code.length < 800) return false;
    if (/<html/i.test(code) || /<!doctype/i.test(code)) return false;
    // 必须包含本脚本标识，避免代理返回“别的东西”导致误覆盖
    if (code.indexOf('【TB】一键更新程序.js') < 0) return false;
    if (code.indexOf('GitHub API Tree') < 0 && code.indexOf('API Tree') < 0) return false;
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
    var p = files.join(CONFIG.installDir, 'tmp', '自更新标记.json');
    try {
      if (!files.exists(p)) return null;
      return safeJsonParse(String(files.read(p)));
    } catch (e) {
      return null;
    }
  }

  function writeSelfMarker(obj) {
    var p = files.join(CONFIG.installDir, 'tmp', '自更新标记.json');
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

    // 用当前运行文件名去拉远端（避免【tb】/【TB】错配）
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

    // 防死循环：如果 2 分钟内已经更新到同一个 remoteH，还在变，那就跳过
    var mk = readSelfMarker();
    if (mk && mk.remoteHash === remoteH && mk.time && (new Date().getTime() - mk.time) < 120000) {
      LOG('⚠️ 检测到可能的循环自更新，已跳过（避免反复重启）');
      return;
    }

    LOG('✨ 发现更新器新版本，开始自我更新...');

    var targetPath = files.join(CONFIG.installDir, CONFIG.canonicalSelfName);
    try {
      files.write(targetPath, remoteCode);
      if (curPath && curPath !== targetPath) {
        files.write(curPath, remoteCode);
      }
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

  // ========================= ⑫ 下载执行（并发 + 差分） =========================
  // forceAll：仅在“兜底模式且版本号变了”时为 true
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

      // 需要更新的判定：
      // 1) 强制更新（forceUpdate） => 一定下
      // 2) 兜底模式版本变了（forceAll） => 一定下
      // 3) 本地不存在 => 一定下
      // 4) 有 sha => sha 变了才下
      var need = CONFIG.forceUpdate || forceAll || (!files.exists(localAbs));
      if (!need && sha) {
        need = (Cache.map[rp] !== sha);
      }

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

  // ========================= ⑬ 主流程 =========================
  function main() {
    LOG('启动更新器');
    LOG('项目目录：' + CONFIG.installDir);

    // 确保 tmp 目录存在
    try {
      files.createWithDirs(files.join(CONFIG.installDir, 'tmp', 'x'));
      files.remove(files.join(CONFIG.installDir, 'tmp', 'x'));
    } catch (e0) {}

    Cache.load();

    LOG('--- 网络准备 ---');
    if (!Net.prepare()) {
      LOG('❌ 无法连通 RAW（直连/代理都失败）。建议：开代理/VPN 或更换网络');
      sleepSafe(1200);
      UI.close();
      exit();
    }

    // 自身热更新（修复：防死循环）
    selfHotUpdateIfNeeded();

    // 获取远端 version（备用 + 兜底版本号判断）
    var vr = Net.rawGetString('version');
    var verInfo = null;
    if (vr.ok && vr.body) {
      verInfo = parseVersionFile(vr.body);
      if (verInfo.ok) {
        LOG('远端 version 读取成功，version=' + (verInfo.version || '(空)') + '，updateFile=' + verInfo.list.length);
      } else {
        LOG('远端 version 存在但不是 JSON（将仅用于“存在性”判断）');
      }
    } else {
      LOG('远端 version 不存在或读取失败（不影响全仓库模式）');
    }

    // 优先：API Tree 拉全仓库
    LOG('>>>>→ 获取仓库文件清单 ←<<<<');
    var list = null;
    var mode = '';

    if (Net.bestApi !== null) {
      list = getRepoFileListViaApiTree();
      if (list && list.length) {
        mode = 'apiTree';
        LOG('✅ API Tree 获取成功：' + list.length + ' 个文件（全仓库模式）');
      }
    }

    // 兜底：version.updateFile
    var forceAllFallback = false;
    if (!list || !list.length) {
      mode = 'versionFallback';
      if (verInfo && verInfo.ok && verInfo.list.length) {
        list = verInfo.list;

        // 兜底模式：如果远端 version 号变了 => 强制更新列表文件
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
      for (var i = 0; i < list.length; i++) {
        tmp2.push({ path: list[i].path, local: list[i].path, sha: list[i].sha });
      }
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

    sleepSafe(1200);
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
