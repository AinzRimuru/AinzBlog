/**
 * CWD 评论系统加载器
 * 负责：动态加载 cwd-widget、挂载/卸载评论组件、PJAX 导航重挂载、
 *       主题（亮/暗）同步、文章评论数填充。
 *
 * 与 Kratos-Rebirth 主题协同工作：
 *  - 主题通过 <html data-theme="dark|light"> 标记当前主题；
 *  - 主题使用 PJAX 局部刷新，会在 window 上派发 pjax:before / pjax:complete 事件；
 *  - 评论区宿主元素由主题 comments.core.template 渲染（#cwd-comments.kr-comments）。
 */
(function () {
  'use strict';

  // ====== 配置区 ======
  var CONFIG = {
    apiBaseUrl: 'https://cwd-api.rimuru.work', // CWD 后端 API 地址
    siteId: 'ainzblog', // 站点 ID，用于多站点数据隔离
    lang: 'zh-CN', // 评论组件语言
    customCssUrl: '/css/cwd-custom.css', // 主题适配样式（注入 Shadow DOM）
    containerId: 'cwd-comments', // 评论宿主元素 id
    countSelector: '.cwd-comment-count', // 评论数占位元素选择器
    // widget 脚本 CDN（锁版本，带备用源）
    widgetSources: [
      'https://cdn.jsdelivr.net/npm/cwd-widget@0.1.11/dist/cwd.js',
      'https://unpkg.com/cwd-widget@0.1.11/dist/cwd.js'
    ]
  };

  var currentInstance = null; // 当前挂载的评论组件实例
  var widgetReady = false; // widget 脚本是否已就绪
  var widgetLoading = false; // widget 脚本是否加载中
  var pendingQueue = []; // 脚本就绪前的待执行回调

  // ====== 工具函数 ======

  /** 读取当前生效的主题（亮/暗） */
  function getTheme() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    // 兜底：跟随系统偏好
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  /** 顺序尝试加载 widget 脚本（带备用源） */
  function loadWidget(cb) {
    if (widgetReady) { cb(); return; }
    pendingQueue.push(cb);
    if (widgetLoading) return;
    widgetLoading = true;

    var idx = 0;
    function tryNext() {
      if (idx >= CONFIG.widgetSources.length) {
        // 全部失败
        widgetLoading = false;
        var q = pendingQueue; pendingQueue = [];
        q.forEach(function (fn) { try { fn(); } catch (e) {} });
        return;
      }
      var src = CONFIG.widgetSources[idx++];
      var s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.onload = function () {
        if (typeof window.CWDComments === 'function') {
          widgetReady = true;
          widgetLoading = false;
          var q = pendingQueue; pendingQueue = [];
          q.forEach(function (fn) { try { fn(); } catch (e) {} });
        } else {
          // 脚本加载了但没有暴露全局对象，尝试下一个源
          tryNext();
        }
      };
      s.onerror = function () {
        // 当前源失败，尝试下一个
        if (s.parentNode) s.parentNode.removeChild(s);
        tryNext();
      };
      document.body.appendChild(s);
    }
    tryNext();
  }

  /** 卸载当前评论组件实例 */
  function destroyInstance() {
    if (currentInstance) {
      try { currentInstance.unmount(); } catch (e) {}
      currentInstance = null;
    }
  }

  /** 挂载（或重新挂载）评论组件 */
  function mountComments() {
    destroyInstance();
    var el = document.getElementById(CONFIG.containerId);
    if (!el) return; // 当前页没有评论区
    if (typeof window.CWDComments !== 'function') return; // 脚本尚未就绪

    try {
      currentInstance = new window.CWDComments({
        el: el,
        apiBaseUrl: CONFIG.apiBaseUrl,
        siteId: CONFIG.siteId,
        postSlug: el.getAttribute('data-post-slug') || window.location.pathname,
        theme: getTheme(),
        lang: CONFIG.lang,
        customCssUrl: CONFIG.customCssUrl
      });
      currentInstance.mount();
    } catch (e) {
      // 挂载失败时打印日志，便于排查
      if (window.console) console.error('[CWD] mount failed:', e);
    }
  }

  /** 初始化评论区（确保脚本就绪后挂载） */
  function initComments() {
    if (!document.getElementById(CONFIG.containerId)) return;
    loadWidget(function () { mountComments(); });
  }

  // ====== 评论数填充 ======

  /** 拉取并填充所有评论数占位元素 */
  function refreshCounts() {
    var nodes = document.querySelectorAll(CONFIG.countSelector);
    if (!nodes.length) return;

    // 按路径去重，避免同一页重复请求
    var tasks = {};
    Array.prototype.forEach.call(nodes, function (node) {
      var path = node.getAttribute('data-path');
      if (!path) return;
      if (!tasks[path]) tasks[path] = [];
      tasks[path].push(node);
    });

    Object.keys(tasks).forEach(function (path) {
      var url =
        CONFIG.apiBaseUrl.replace(/\/$/, '') +
        '/api/comments?post_slug=' + encodeURIComponent(path) +
        '&siteId=' + encodeURIComponent(CONFIG.siteId) +
        '&limit=1&nested=false';

      fetch(url)
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) {
          var total = data && data.pagination && typeof data.pagination.totalCount === 'number'
            ? data.pagination.totalCount
            : 0;
          tasks[path].forEach(function (node) { node.textContent = String(total); });
        })
        .catch(function () { /* 静默失败，保留占位值 */ });
    });
  }

  // ====== 主题同步 ======

  /** 把当前页面主题同步给已挂载的评论组件 */
  function syncTheme() {
    if (currentInstance && typeof currentInstance.updateConfig === 'function') {
      try { currentInstance.updateConfig({ theme: getTheme() }); } catch (e) {}
    }
  }

  // 监听 <html data-theme> 变化（用户点击主题切换按钮时触发）
  if (typeof MutationObserver !== 'undefined') {
    var themeObserver = new MutationObserver(function () { syncTheme(); });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  // ====== 生命周期 ======

  function refresh() {
    initComments();
    refreshCounts();
  }

  // 首次加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }

  // PJAX 导航：开始前卸载旧实例，完成后重新挂载并刷新计数
  window.addEventListener('pjax:before', destroyInstance);
  window.addEventListener('pjax:complete', refresh);

  // 暴露给调试 / 外部调用（可选）
  window.CWDLoader = { refresh: refresh, getTheme: getTheme };
})();
