---
title: Hexo 博客一行代码接入 Friend Flow 友链联盟
date: 2026-04-27T12:00:00.000Z
description: 通过一个 Hexo 标签插件，在友链页面中嵌入 Friend Flow 友链联盟卡片，自动展示友链博客的最新文章。只需配置 API 地址，页面中写入 {% friendflow %} 即可完成接入。
tags:
  - Hexo
  - 博客优化
  - 教程
  - JavaScript
categories:
  - 建站手记
cover: cover.png
---

## 前言

在 [上一篇文章](/2026/04/24/FriendFlow-让友链活起来的互助系统/) 中介绍了 Friend Flow 友链互助系统，它通过 Cloudflare Workers 自动抓取友链博客的最新文章，并以 REST API 的形式提供数据。

文章末尾提供了一个手写 JS 的接入示例，但实际使用时还需要自己处理样式、加载状态、错误处理等细节。为了让接入更加开箱即用，我写了一个 **Hexo 标签插件**，只需一行代码即可完成集成。

插件基于Kratos-Rebirth 主题的设计风格，自动适配亮色/暗色模式，同时也兼容其他主题。

## 效果预览

插件会在友链页面渲染一组卡片，每个卡片包含：

- 友链博客的头像、名称和描述
- 该博客最新发布的文章列表（标题 + 日期）
- 每次加载时随机排列顺序

{% alertbar info 阅读本文前，建议先了解 [Friend Flow 项目](https://github.com/AinzRimuru/friend-flow) 的基本概念。 %}

## 接入步骤

### 第一步：添加插件文件

在博客中添加如下文件结构：

```
scripts/
└── friend-flow-tag.js            # 插件入口，注册 Hexo 标签
source/_data/
└── friend-flow/
    ├── style.css                  # 卡片样式
    └── template.js                # 数据拉取与渲染逻辑
```

- `scripts/` 是 Hexo 的约定目录，放在里面的 JS 文件会在 `hexo generate` / `hexo server` 时自动加载
- 样式和模板放在 `source/_data/friend-flow/` 下，避免被 Hexo 当作脚本执行

#### style.css — 卡片样式

样式使用 CSS 自定义属性实现双层变量映射，自动适配 Kratos-Rebirth 主题的亮色/暗色模式，同时为非该主题的博客提供合理的回退值：

```css
.ff-container {
  margin: 16px 0;

  /* 变量映射：优先使用 Kratos-Rebirth 主题变量，回退到内置默认值 */
  --ff-bg: var(--kr-theme-card-bg, #fff);
  --ff-text: var(--kr-theme-text, #000);
  --ff-text-alt: var(--kr-theme-text-alt, #666);
  --ff-link-hover: var(--kr-theme-link-hover, #6ec3f5);
  --ff-border: var(--kr-theme-border, #eaecef);
  --ff-muted: var(--kr-theme-text-alt, #999);
}

.ff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}

/* 卡片 */
.ff-card {
  background: var(--ff-bg);
  border-radius: 0;
  overflow: hidden;
  transition: all 0.3s ease-in-out;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.ff-card:hover {
  box-shadow: 0 8px 15px rgba(146, 146, 146, 0.39);
}

/* 卡片头部 - 头像 + 名称 */
.ff-card-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 10px;
}

.ff-card-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.ff-card-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.ff-card-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--ff-text);
  text-decoration: none;
}

.ff-card-name:hover {
  color: var(--ff-link-hover);
}

.ff-card-desc {
  font-size: 12px;
  color: var(--ff-text-alt);
  line-height: 1.3;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 文章列表 */
.ff-card-articles {
  border-top: 1px solid var(--ff-border);
  padding: 6px 12px 8px;
}

.ff-article-item {
  display: flex;
  align-items: baseline;
  padding: 2px 0;
  text-decoration: none;
  color: var(--ff-text-alt);
  font-size: 13px;
  line-height: 1.5;
}

.ff-article-item:hover {
  color: var(--ff-link-hover);
}

.ff-article-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.ff-article-time {
  font-size: 11px;
  color: var(--ff-muted);
  flex-shrink: 0;
  white-space: nowrap;
}

/* 加载状态 */
.ff-spinner {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 3px solid var(--ff-border);
  border-top-color: var(--ff-text-alt);
  border-radius: 50%;
  animation: ff-spin 0.8s linear infinite;
}

@keyframes ff-spin {
  to { transform: rotate(360deg); }
}

.ff-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;
}

.ff-error {
  text-align: center;
  padding: 40px 0;
  color: var(--ff-muted);
}
```

#### template.js — 数据拉取与渲染

一段自执行函数，接收运行时参数（容器 ID、API 地址、排除 URL、文章上限），负责 `fetch` → `render` 的完整流程：

```js
(function (id, api, self, max) {
  var c = document.getElementById(id);
  if (!c) return;

  function esc(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function resIcon(i) {
    if (!i) return "";
    if (i.indexOf("http") === 0) return i;
    return api + i;
  }

  function fmtDate(s) {
    try {
      return new Date(s).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch (e) {
      return s;
    }
  }

  function render(data) {
    var list = data.slice().sort(function () {
      return Math.random() - 0.5;
    });

    var h = '<div class="ff-grid">';

    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var ic = resIcon(f.icon);
      var arts = f.recentArticles || [];

      h += '<div class="ff-card"><div class="ff-card-header">';
      h +=
        '<a target="_blank" href="' +
        esc(f.url) +
        '" rel="noopener">' +
        '<img class="ff-card-avatar" src="' +
        esc(ic) +
        '" alt="' +
        esc(f.name) +
        '" loading="lazy"/></a>';
      h +=
        '<div class="ff-card-info">' +
        '<a class="ff-card-name" target="_blank" href="' +
        esc(f.url) +
        '" rel="noopener">' +
        esc(f.name) +
        "</a>";
      h +=
        '<div class="ff-card-desc">' + esc(f.description) + "</div></div></div>";

      if (arts.length > 0) {
        h += '<div class="ff-card-articles">';
        var n = Math.min(arts.length, max);
        for (var j = 0; j < n; j++) {
          var a = arts[j];
          var t = a.publishTime ? fmtDate(a.publishTime) : "";
          h +=
            '<a class="ff-article-item" target="_blank" href="' +
            esc(a.url) +
            '" rel="noopener">' +
            '<span class="ff-article-title">' +
            esc(a.title) +
            "</span>";
          if (t) h += '<span class="ff-article-time">' + t + "</span>";
          h += "</a>";
        }
        h += "</div>";
      }

      h += "</div>";
    }

    h += "</div>";
    c.innerHTML = h;
  }

  var url = api + "/api/friend-links";
  if (self) url += "?exclude=" + encodeURIComponent(self);

  fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(render)
    .catch(function (e) {
      console.error("Friend Flow:", e);
      c.innerHTML =
        '<div class="ff-error">' + (e.message || "Fetch failed") + "</div>";
    });
});
```

#### friend-flow-tag.js — 插件入口

插件入口非常精简——读取 CSS/JS 文件，注入运行时参数，输出内联 HTML：

```js
'use strict';

var fs = require('fs');
var path = require('path');

var DIR = path.join(hexo.base_dir, 'source', '_data', 'friend-flow');
var CSS = fs.readFileSync(path.join(DIR, 'style.css'), 'utf8').trim();
var JS_TEMPLATE = fs.readFileSync(path.join(DIR, 'template.js'), 'utf8').trim();

hexo.extend.tag.register('friendflow', function () {
  var config = hexo.config.friend_flow || {};
  var apiBase = (config.api_base || '').replace(/\/+$/, '');
  var selfUrl = (config.self_url || '').replace(/\/+$/, '');
  var maxArticles = config.articles_per_card || 5;

  if (!apiBase) {
    return '<div style="text-align:center;color:#999;padding:40px 0">' +
      'Friend Flow: please set friend_flow.api_base in _config.yml</div>';
  }

  var id = 'ff-' + Math.random().toString(36).substr(2, 8);

  // 将模板 IIFE 转为立即执行，注入运行时参数
  var js = JS_TEMPLATE
    .replace(/^\(function\s*/, '(function ')
    .replace(/\}\);$/, '})("' + id + '","' + apiBase + '","' + selfUrl + '",' + maxArticles + ');');

  return '<style>' + CSS + '</style>' +
    '<div id="' + id + '" class="ff-container">' +
    '<div class="ff-loading"><span class="ff-spinner"></span></div>' +
    '</div>' +
    '<script>' + js + '</script>';
});
```

### 第二步：配置 _config.yml

在博客根目录的 `_config.yml` 中添加：

```yaml
# Friend Flow 友链互助系统
# Docs: https://github.com/AinzRimuru/friend-flow
friend_flow:
  api_base: https://friend.rimuru.work   # Friend Flow API 地址
  self_url: https://blog.example.com      # 你的博客地址，用于排除自己
  articles_per_card: 5                    # 每张卡片最多显示的文章数
```

| 字段 | 说明 |
|------|------|
| `api_base` | Friend Flow 实例地址，必填 |
| `self_url` | 你自己的博客地址，API 调用时会通过 `exclude` 参数排除，避免展示自己的文章 |
| `articles_per_card` | 每个友链卡片最多展示的文章数量，默认 5 |

### 第三步：在页面中使用

在友链页面的 Markdown 中插入标签：

```markdown
---
title: 好伙伴们
---

## 友链联盟

{% friendflow %}
```

运行 `hexo generate` 或 `hexo server`，访问该页面即可看到效果。

## 设计细节

### 主题适配

样式通过 CSS 自定义属性的双层映射实现主题适配：

```
--kr-theme-card-bg (主题变量，亮色 #ffffffcc / 暗色 #282c34dd)
       ↓
--ff-bg (插件变量) → 回退值 #fff
       ↓
.ff-card { background: var(--ff-bg, #fff) }
```

这样做的好处：

- **独立性** — 不引入主题 SCSS 文件，不依赖主题 class，插件全部使用 `ff-` 命名空间
- **兼容性** — Kratos-Rebirth 主题下自动跟随亮色/暗色模式切换；其他主题下使用回退的默认值
- **可覆盖** — 其他主题的开发者可以通过覆盖 `--ff-*` 变量来自定义配色

### 构建时读取，运行时拉取

```
hexo generate / hexo server
  │
  ├─ 加载 scripts/friend-flow-tag.js
  │    └─ fs.readFileSync 读取 source/_data/friend-flow/ 下的 style.css + template.js
  │    └─ 注册 {% friendflow %} 标签
  │
  ├─ 渲染友链页面
  │    └─ {% friendflow %} → 输出 HTML 容器 + 内联 CSS + 内联 JS
  │
  └─ 浏览器加载页面
       └─ JS 执行 fetch(api_base/api/friend-links?exclude=self_url)
            └─ 渲染友链卡片（随机排列）
```

- CSS/JS 文件在 `hexo generate` 时通过 `fs.readFileSync` 读入并内联到 HTML 中，不产生额外的 HTTP 请求
- 友链数据在用户访问页面时实时拉取，保证内容始终最新

### 与主题自带友链共存

Kratos-Rebirth 主题自带 `{% linklist %}` 标签，通过本地 YAML 文件维护友链。两者可以同时使用：

```markdown
## 常驻友链

{% linklist friends random %}

---

## 友链联盟

{% friendflow %}
```

| | `{% linklist %}` | `{% friendflow %}` |
|---|---|---|
| 数据来源 | 本地 `source/_data/linklist.yml` | Friend Flow API |
| 展示内容 | 名称 + 描述 | 名称 + 描述 + 最新文章 |
| 维护方式 | 手动编辑 YAML | Friend Flow 自动抓取 |
| 适用场景 | 固定的核心友链 | 友链联盟，内容动态更新 |

## 加入友链联盟

如果你的博客也想加入友链联盟（让其他人的 Friend Flow 展示你的文章），需要在 Friend Flow 的配置仓库中添加你的博客信息。具体方式参考 [Friend Flow 项目文档](https://github.com/AinzRimuru/friend-flow)。

---

项目地址：[https://github.com/AinzRimuru/friend-flow](https://github.com/AinzRimuru/friend-flow)

在线体验：[https://friend.rimuru.work](https://friend.rimuru.work)
