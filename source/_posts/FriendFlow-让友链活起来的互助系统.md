---
title: Friend Flow：让友链活起来的互助系统
date: 2026-04-24T15:00:00.000Z
description: 一个基于 Cloudflare Workers 的友链互助系统，自动抓取友链博客的最新文章并提供 API 和展示页面。让你的友链不再是一成不变的静态列表，而是充满活力的内容聚合站。
tags:
  - Cloudflare
  - 博客优化
  - 教程
  - JavaScript
categories:
  - 技术分享
cover: cover.png
---

## 项目简介

友链（友情链接）是博客之间互相推荐的重要方式。但传统的友链只是一个静态的链接列表，访客需要逐个点击才能了解朋友的最新动态。

**Friend Flow** 是一个友链互助系统，自动抓取友链博客的最新文章，提供 API 和展示页面。让你的友链页面从一成不变的链接列表，变成一个充满活力的内容聚合站。

在线体验：[https://friend.rimuru.work](https://friend.rimuru.work)

项目地址：[https://github.com/AinzRimuru/friend-flow](https://github.com/AinzRimuru/friend-flow)

## 功能特色

- **自动抓取** - 自动从友链博客的 Atom/RSS Feed 获取最近 10 篇文章，无需手动维护
- **智能缓存** - 5 分钟 TTL 缓存，10 秒抓取超时，在实时性和性能之间取得平衡
- **容错机制** - 连续失败 3 次冷却 1 小时，30 次停止刷新，每天凌晨自动重试已停止的站点
- **图片代理** - 通过 Worker 重定向透传图片资源，跨域展示零障碍
- **灵活 API** - 支持排除指定站点、随机选取数量等参数，满足不同场景需求
- **现代前端** - 基于 React + TailwindCSS 的卡片式 SPA 展示页面

## 在线体验

访问 [friend.rimuru.work](https://friend.rimuru.work) 即可直接查看所有友链博客及其最新文章。页面会展示每个友链的基本信息、抓取状态和最近发布的文章列表。

## API 使用

Friend Flow 提供了简洁的 REST API，方便你将友链数据集成到自己的博客或任何平台。

### 获取全部友链

```http
GET https://friend.rimuru.work/api/friend-links
```

返回所有友链及其最近 10 篇文章。

### 排除自己的博客

```http
GET https://friend.rimuru.work/api/friend-links?exclude=https://blog.example.com
```

使用 `exclude` 参数排除指定 URL，支持多次传参：

```http
GET https://friend.rimuru.work/api/friend-links?exclude=https://a.com&exclude=https://b.com
```

### 随机选取友链

```http
GET https://friend.rimuru.work/api/friend-links?limit=5&exclude=https://blog.example.com
```

使用 `limit` 参数控制返回数量，超出时随机选取。

### 返回数据格式

```json
[
  {
    "name": "博客名称",
    "url": "https://example.com",
    "description": "博客描述",
    "icon": "/images/icons/blog.png",
    "lastFetchTime": "2026-04-24T12:00:00Z",
    "fetchStatus": "ok",
    "recentArticles": [
      {
        "title": "文章标题",
        "url": "https://example.com/post-1",
        "publishTime": "2026-04-20"
      }
    ]
  }
]
```

### 图片代理

友链头像等图片资源通过 Worker 自动代理：

```http
GET https://friend.rimuru.work/images/icons/blog.png
```

返回 302 重定向到图片的实际地址，无需额外配置。

## 如何接入你的博客

以 Hexo 博客为例，只需在友链页面添加一段 JavaScript 即可从 Friend Flow API 获取数据并展示。

```html
<div id="friend-links-container"></div>

<script>
(async () => {
  const API = 'https://friend.rimuru.work';
  const SELF = 'https://your-blog.com'; // 替换为你的博客地址

  const res = await fetch(
    `${API}/api/friend-links?exclude=${encodeURIComponent(SELF)}`
  );
  const data = await res.json();

  // 随机排列
  const shuffled = data.sort(() => Math.random() - 0.5);

  const container = document.getElementById('friend-links-container');
  container.innerHTML = shuffled.map(f => {
    const icon = f.icon.startsWith('http') ? f.icon : API + f.icon;
    return `
      <a target="_blank" href="${f.url}">
        <img src="${icon}" alt="${f.name}" />
        <span>${f.name}</span>
        <p>${f.description}</p>
      </a>
    `;
  }).join('');
})();
</script>
```

> **提示**: 完整的集成示例（包含最新文章展示、加载状态和错误处理）可以参考项目的 [GitHub 仓库](https://github.com/AinzRimuru/friend-flow)。

## 工作原理

```
┌─────────────┐     抓取 Atom/RSS     ┌──────────────────┐
│  友链博客 A  │ ◄────────────────── │                  │
│  友链博客 B  │ ◄────────────────── │  Friend Flow     │
│  友链博客 C  │ ◄────────────────── │  (CF Workers+D1) │
└─────────────┘                      │                  │
                                     └────────┬─────────┘
                                              │
                              ┌────────────────┼────────────────┐
                              ▼                ▼                ▼
                        友链展示页面      REST API          图片代理
                     friend.rimuru.work  /api/...         /images/...
```

Friend Flow 后端基于 **Cloudflare Workers + Hono**，数据存储在 **Cloudflare D1**。配置文件和图标资源托管在 GitHub Pages 上，Worker 启动时自动拉取。

每当有请求到达时，Worker 会检查缓存是否过期（TTL 5 分钟），如果过期则并发刷新最多 10 个站点的 Feed 数据。对于持续抓取失败的站点，系统会逐步降级：3 次失败冷却 1 小时，30 次失败停止请求时刷新，等待每天凌晨的定时任务重试。

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Cloudflare Workers + Hono |
| 数据库 | Cloudflare D1 |
| 前端 | React + Vite + TailwindCSS |
| 配置托管 | GitHub Pages（YAML + 图标） |

---

项目地址：[https://github.com/AinzRimuru/friend-flow](https://github.com/AinzRimuru/friend-flow)

在线体验：[https://friend.rimuru.work](https://friend.rimuru.work)
