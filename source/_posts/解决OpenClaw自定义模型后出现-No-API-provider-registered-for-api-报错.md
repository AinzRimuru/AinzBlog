---
title: 解决OpenClaw自定义模型后出现"No API provider registered for api"报错
date: 2026-03-19T22:05:44.000Z
tags:
  - OpenClaw
  - 智谱AI
  - Docker
cover: cover.png
categories:
  - 疑难排查
description: 本文详解OpenClaw自定义模型时报错'No API provider registered for api'的解决办法。通过升级Docker镜像至最新版本修复此问题，并补充了智谱AI GLM-5-turbo模型中baseUrl的配置要点，确保编码套餐额度正常使用，帮助开发者快速排除故障。
---
## TL;DR
OpenClaw版本过旧，升级到最新版本即可解决"No API provider registered for api"报错。

## 报错经过
参考智谱的[官方文档](https://docs.bigmodel.cn/cn/coding-plan/tool/openclaw#切换使用-glm-5-turbo-模型),在OpenClaw中切换使用glm-5-turbo模型后，出现了"No API provider registered for api"的报错。

## 解决办法
我个人使用docker compose进行部署的，所以直接执行`docker compose pull && docker compose down && docker compose up -d`升级到最新版本的OpenClaw就解决了这个问题。

## 另一个报错
直接参考官方文档切换模型后，还可能遇到`models.providers.zai.baseUrl: Invalid input: expected string, received undefined`的报错。官网文档并未提示需要配置`baseUrl`。注意，`baseUrl`必须配置为`https://open.bigmodel.cn/api/coding/paas/v4`，不要配置成通用的`https://open.bigmodel.cn/api/paas/v4`,否则购买的编码套餐不会生效，提示没有额度或消耗余额。
配置后的内容如下：
```json
  "models": {
    "providers": {
      "zai": {
        "baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4",
        "models": [
            ...
        ]
      }
    }
  },
```