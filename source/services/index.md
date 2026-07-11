---
title: 服务
date: 2026-07-11 12:00:00
type: "page"
comments: false
description: "Rimuru 自建并维护的在线服务合集，包括 Hugging Face 镜像代理、Docker Hub 镜像代理和友链互助系统 Friend Flow，所有服务基于 Cloudflare 生态部署。"
---

<link rel="stylesheet" href="/css/services.css">

<div class="svc-container">
<p class="svc-intro">这里收录了本站自建并持续维护的在线服务，均基于 Cloudflare 生态部署，免费开放使用。</p>
<span class="svc-count"><i class="fa fa-server"></i> 共 3 项服务</span>
<div class="svc-grid">

<div class="svc-card">
<div class="svc-head">
<div class="svc-badge">🤗</div>
<div class="svc-titles">
<h3 class="svc-name"><a href="https://hf.rimuru.work" target="_blank" rel="noopener">HuggingfaceProxy</a></h3>
<div class="svc-domain">hf.rimuru.work</div>
</div>
<span class="svc-status is-checking" data-check-url="https://hf.rimuru.work">
<span class="svc-dot"></span><span class="svc-status-text">检测中</span>
</span>
</div>
<p class="svc-desc">基于 Cloudflare Workers 的轻量级 Hugging Face 反向代理。</p>
<div class="svc-actions">
<a class="svc-btn svc-btn-primary" href="https://hf.rimuru.work" target="_blank" rel="noopener"><i class="fa fa-external-link"></i> 访问服务</a>
<a class="svc-btn svc-btn-ghost" href="https://github.com/AinzRimuru/HuggingfaceProxy" target="_blank" rel="noopener"><i class="fa fa-github"></i> GitHub</a>
</div>
</div>

<div class="svc-card">
<div class="svc-head">
<div class="svc-badge">🐳</div>
<div class="svc-titles">
<h3 class="svc-name"><a href="https://docker.rimuru.cc" target="_blank" rel="noopener">DockerProxyCF</a></h3>
<div class="svc-domain">docker.rimuru.cc</div>
</div>
<span class="svc-status is-checking" data-check-url="https://docker.rimuru.cc">
<span class="svc-dot"></span><span class="svc-status-text">检测中</span>
</span>
</div>
<p class="svc-desc">基于 Cloudflare Worker 的 Docker Hub 公共镜像代理。</p>
<div class="svc-actions">
<a class="svc-btn svc-btn-primary" href="https://docker.rimuru.cc" target="_blank" rel="noopener"><i class="fa fa-external-link"></i> 访问服务</a>
<a class="svc-btn svc-btn-ghost" href="https://github.com/AinzRimuru/DockerProxyCF" target="_blank" rel="noopener"><i class="fa fa-github"></i> GitHub</a>
</div>
</div>

<div class="svc-card">
<div class="svc-head">
<div class="svc-badge">🔗</div>
<div class="svc-titles">
<h3 class="svc-name"><a href="https://friend.rimuru.work" target="_blank" rel="noopener">Friend Flow</a></h3>
<div class="svc-domain">friend.rimuru.work</div>
</div>
<span class="svc-status is-checking" data-check-url="https://friend.rimuru.work">
<span class="svc-dot"></span><span class="svc-status-text">检测中</span>
</span>
</div>
<p class="svc-desc">友链互助系统，自动抓取并分发友链博客的 Atom/RSS Feed 最新文章。</p>
<div class="svc-actions">
<a class="svc-btn svc-btn-primary" href="https://friend.rimuru.work" target="_blank" rel="noopener"><i class="fa fa-external-link"></i> 访问服务</a>
<a class="svc-btn svc-btn-ghost" href="https://github.com/AinzRimuru/friend-flow" target="_blank" rel="noopener"><i class="fa fa-github"></i> GitHub</a>
</div>
</div>

</div>
<p class="svc-note"><i class="fa fa-info-circle"></i> 状态指示通过浏览器实时探测可得性，仅代表「端点是否可达」。如遇服务异常或想接入友链联盟，欢迎通过 <a href="/contact/">联系页面</a> 或 GitHub Issues 反馈。</p>
</div>
