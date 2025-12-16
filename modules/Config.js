/**
 * @description 全局配置模块
 */

var Config = {
    // APP信息
    appName: "淘宝",
    packageName: "com.taobao.taobao",
    
    // 任务开关 (true=开启, false=关闭)
    ENABLE_SIGN: true,      // 签到任务
    ENABLE_TASK: false,     // 浏览任务 (暂时关闭)

    // 运行参数
    browseTime: 22000,      // 浏览时长(毫秒)
    pageLoadWait: 5000,     // 页面加载等待时长
    
    // 搜索关键词
    searchKeywords: ["袜子", "手机壳", "抽纸", "洗衣液", "零食", "数据线"],

    // 防检测配置
    enableLayoutRefresh: true, // 开启防WebView卡死(强制刷新)
    
    // 开发配置
    debug: true // 显示调试日志
};

module.exports = Config;