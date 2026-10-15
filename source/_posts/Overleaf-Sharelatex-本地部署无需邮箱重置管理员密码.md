---
title: Overleaf(Sharelatex)本地部署无需邮箱重置管理员密码
date: 2025-12-26T23:40:39.000Z
updated: 2026-03-30T23:04:29.000Z
tags:
  - 教程
  - 问题解决
  - Linux
  - Overleaf
  - Docker
  - ShareLaTeX
categories:
  - 自建服务
description: 本文介绍如何在Overleaf（ShareLaTeX）本地部署环境下，通过Docker日志直接获取重置链接来修改管理员密码。该方法解决了因未配置邮件服务（SMTP）而无法通过邮箱找回密码的问题，涵盖了日志提取、链接解析及域名替换等实操步骤。
cover: cover.png
keywords:
  - "Overleaf 重置管理员密码"
  - "ShareLaTeX 本地部署"
  - "Overleaf 忘记密码"
  - "Overleaf 邮箱不可用"
  - "LaTeX 自建 服务"
  - "Overleaf Docker 部署"
faqs:
  - q: "Overleaf本地部署忘记管理员密码怎么重置？"
    a: "在登录页点击“Forgot your password?”输入邮箱触发重置流程，然后从容器日志里提取重置链接。执行 docker exec <container_name> bash -c \"cd /var/log/overleaf/ && cat web.log\" 并用 grep 过滤 password，拿到链接后打开，输入新密码点击“Set new password”即可。"
  - q: "如何从Overleaf日志中获取密码重置链接？"
    a: "运行 docker exec <container_name> bash -c \"cd /var/log/overleaf/ && cat web.log\" 并配合 grep 过滤 password，输出中会得到类似 http://localhost/user/password/set?passwordResetToken=******&email=****** 的链接，这就是重置密码入口。"
  - q: "Overleaf重置密码链接里的localhost需要替换吗？"
    a: "如果部署时没有设置 Overleaf 的域名，日志里拿到的重置密码链接会包含 localhost，需要把它替换为实际访问的域名后再打开。"
---
## 概述
通过从Overleaf的日志中获取重置密码的链接并重置密码，实现无需邮箱重置管理员密码。
## 尝试发送重置密码邮件
在登录界面点击`Forgot your password?`，然后输入邮箱地址，点击`Reset password`。
## 获取重置密码链接
运行下面的语句从Overleaf的log中获取重置密码的链接：
```bash
docker exec <container_name> bash -c "cd /var/log/overleaf/ && cat web.log" | grep -oP 'https?://[^\\]+' | grep password
```
得到的重置密码链接形如：
```
http://localhost/user/password/set?passwordResetToken=******&email=******
```
## 替换域名（可选）
在没有设置Overleaf的域名时，重置密码的链接会包含`localhost`，需要替换为实际的域名。
## 重置密码
打开获取到的重置密码链接，然后输入新密码，点击`Set new password`。