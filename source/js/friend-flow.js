(function () {
  const API_BASE = 'https://friend.rimuru.work';
  const SELF_URL = 'https://blog.rimuru.work';

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function resolveIcon(icon) {
    if (!icon) return '';
    if (icon.startsWith('http')) return icon;
    return API_BASE + icon;
  }

  function formatDate(dateStr) {
    try {
      var d = new Date(dateStr);
      return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  }

  function renderFriendLinks(data) {
    var container = document.getElementById('friend-links');
    if (!container) return;

    var shuffled = data.slice().sort(function () { return Math.random() - 0.5; });

    var html = '';
    for (var i = 0; i < shuffled.length; i++) {
      var f = shuffled[i];
      html += '<li>' +
        '<a target="_blank" href="' + escapeHtml(f.url) + '" rel="noopener">' +
        '<img src="' + escapeHtml(resolveIcon(f.icon)) + '" alt="' + escapeHtml(f.name) + '" loading="lazy" />' +
        '<div>' +
        '<span>' + escapeHtml(f.name) + '</span>' +
        '<p>' + escapeHtml(f.description) + '</p>' +
        '</div>' +
        '</a>' +
        '</li>';
    }

    container.innerHTML = html || '<li style="width:100%;text-align:center;color:#999;">暂无友链</li>';
  }

  function renderRecentArticles(data) {
    var container = document.getElementById('friend-articles');
    if (!container) return;

    var articles = [];
    for (var i = 0; i < data.length; i++) {
      var friend = data[i];
      var list = friend.recentArticles || [];
      for (var j = 0; j < list.length; j++) {
        articles.push({
          title: list[j].title,
          url: list[j].url,
          publishTime: list[j].publishTime,
          friendName: friend.name,
          friendUrl: friend.url
        });
      }
    }

    articles.sort(function (a, b) {
      return new Date(b.publishTime) - new Date(a.publishTime);
    });

    if (articles.length === 0) {
      container.innerHTML = '<div class="ff-empty">暂无最新文章</div>';
      return;
    }

    var html = '<div class="ff-articles">';
    for (var k = 0; k < articles.length; k++) {
      var a = articles[k];
      var time = a.publishTime ? formatDate(a.publishTime) : '';
      html += '<a class="ff-article" target="_blank" href="' + escapeHtml(a.url) + '" rel="noopener">' +
        '<div class="ff-article-main">' +
        '<span class="ff-article-title">' + escapeHtml(a.title) + '</span>' +
        '<span class="ff-article-meta">' +
        '<span class="ff-article-author">' + escapeHtml(a.friendName) + '</span>' +
        (time ? '<span class="ff-article-time">' + time + '</span>' : '') +
        '</span>' +
        '</div>' +
        '</a>';
    }
    html += '</div>';

    container.innerHTML = html;
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.ff-articles{display:flex;flex-direction:column;gap:10px}' +
      '.ff-article{display:block;padding:12px 16px;border-radius:6px;text-decoration:none;transition:background .2s}' +
      '.ff-article:hover{background:rgba(0,0,0,.04)}' +
      '.ff-article-main{display:flex;flex-direction:column;gap:4px}' +
      '.ff-article-title{font-size:15px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.ff-article-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:#999}' +
      '.ff-article-author{color:#777}' +
      '.ff-article-time{color:#aaa}' +
      '.ff-empty{text-align:center;color:#999;padding:20px 0}';
    document.head.appendChild(style);
  }

  async function load() {
    injectStyles();

    var linksEl = document.getElementById('friend-links');
    var articlesEl = document.getElementById('friend-articles');

    try {
      var res = await fetch(API_BASE + '/api/friend-links?exclude=' + encodeURIComponent(SELF_URL));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      renderFriendLinks(data);
      renderRecentArticles(data);
    } catch (err) {
      console.error('Friend Flow: failed to load', err);
      if (linksEl) linksEl.innerHTML = '<li style="width:100%;text-align:center;color:#999;">加载友链失败，请稍后刷新重试</li>';
      if (articlesEl) articlesEl.innerHTML = '<div class="ff-empty">加载文章失败</div>';
    }
  }

  load();
})();
