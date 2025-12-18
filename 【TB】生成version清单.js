// 【TB】生成version清单.js
// ========================= 小白必看 =========================
// 作用：自动扫描你手机项目目录（Taobao-AutoJs6）下的所有文件，生成一个 version 文件。
// 这样：
//   1) 你不用手动把“仓库所有文件”一个个写进 updateFile
//   2) 当更新器访问不到 GitHub API（api.github.com）时，也可以用 version.updateFile 做兜底全量更新
//
// 使用步骤：
//   ① 把本脚本放到项目根目录（和 project.json 同级）
//   ② 运行一次
//   ③ 会在项目根目录生成/覆盖一个名为：version 的文件（JSON 格式）
//   ④ 你再把这个 version 文件上传/提交到 GitHub 仓库根目录
//
// 注意：这个 version 的 updateFile 会把“本地项目里存在的所有文件”都列出来
//       如果你本地有一些不想上传的文件（比如 tmp/），会自动排除。
// ===========================================================

(function () {
  'use strict';

  var ROOT = files.cwd();

  // 你要发布的新版本号：
  // 小白规则：每次你想让“兜底模式”强制更新，把版本号改大一点就行。
  // 例：1.0.3 -> 1.0.4
  var NEW_VERSION = '1.0.4';

  // 排除目录/文件（和更新器保持一致）
  var EXCLUDE = [
    /^\.git\//,
    /^tmp\//
  ];

  function matchExclude(p) {
    for (var i = 0; i < EXCLUDE.length; i++) {
      if (EXCLUDE[i].test(p)) return true;
    }
    return false;
  }

  function walk(dirAbs, relBase, out) {
    var list = files.listDir(dirAbs);
    for (var i = 0; i < list.length; i++) {
      var name = list[i];
      var abs = files.join(dirAbs, name);
      var rel = relBase ? (relBase + '/' + name) : name;
      rel = rel.replace(/\\/g, '/');

      if (matchExclude(rel + (files.isDir(abs) ? '/' : ''))) continue;

      if (files.isDir(abs)) {
        walk(abs, rel, out);
      } else {
        out.push(rel);
      }
    }
  }

  function sortPaths(arr) {
    arr.sort(function (a, b) {
      a = String(a); b = String(b);
      return a < b ? -1 : (a > b ? 1 : 0);
    });
    return arr;
  }

  console.log('[TB-version] 扫描目录：' + ROOT);

  var paths = [];
  walk(ROOT, '', paths);
  sortPaths(paths);

  console.log('[TB-version] 文件数量：' + paths.length);

  var obj = {
    version: NEW_VERSION,
    updateFile: paths
  };

  var versionPath = files.join(ROOT, 'version');
  files.write(versionPath, JSON.stringify(obj, null, 2));

  console.log('[TB-version] 已生成 version 文件：' + versionPath);
  toast('version 已生成：' + NEW_VERSION);
})();
