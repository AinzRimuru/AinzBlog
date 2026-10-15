---
title: Nextcloud使用WebDAV访问分享文件夹
date: 2025-12-21T21:22:27.000Z
updated: 2025-12-21T23:30:12.000Z
description: 本文详细介绍了如何在 Nextcloud 中通过 WebDAV 协议访问共享文件夹。通过创建分享链接并结合 public.php/webdav 接口，用户可以在 Windows 11 等文件管理器中将其映射为网络驱动器。教程涵盖了链接生成、密码保护设置及具体连接步骤，是解决 Nextcloud 外部协作与跨平台文件同步的高效方案。
tags:
  - Nextcloud
  - WebDAV
  - 教程
  - 问题解决
  - 网络驱动器
  - 文件共享
  - Windows 11
categories:
  - 自建服务
cover: cover.png
keywords:
  - "Nextcloud WebDAV"
  - "WebDAV 映射网络驱动器"
  - "Nextcloud 分享文件夹 挂载"
  - "Windows 11 WebDAV 连接"
  - "Nextcloud 外部访问"
  - "public.php webdav"
faqs:
  - q: "Nextcloud分享文件夹怎么通过WebDAV访问？"
    a: "首先在Nextcloud网页端为文件夹创建分享链接，得到类似https://*****/s/AaaAABbbBBCccCCC的链接。WebDAV访问地址是https://*****/public.php/webdav，用户名填分享链接唯一标识符AaaAABbbBBCccCCC，密码填你设置的访问密码，没设密码就不用填。"
  - q: "Nextcloud WebDAV访问分享文件夹的用户名和密码是什么？"
    a: "用户名是分享链接的唯一标识符，也就是链接中/s/后面的那串字符，例如AaaAABbbBBCccCCC。密码是你在分享链接自定义权限里设置的访问密码；如果创建分享时没有设置密码，则不需要填写密码。"
  - q: "Windows 11怎么映射Nextcloud WebDAV网络驱动器？"
    a: "在Windows 11的此电脑右键选择“映射网络驱动器”，在文件夹栏输入WebDAV地址https://*****/public.php/webdav，然后按提示输入分享链接唯一标识符作为用户名，以及访问密码（如果有设置）进行连接。"
  - q: "Nextcloud分享链接的WebDAV地址是什么？"
    a: "WebDAV地址是https://*****/public.php/webdav，其中*****替换成你的Nextcloud服务器地址。这个地址用于通过WebDAV协议访问你创建的分享文件夹，不是直接打开分享链接。"
---
## 1. 新建分享链接
在 Nextcloud 网页端，选择需要分享的文件夹，创建共享链接可以以生成一个形如`https://*****/s/AaaAABbbBBCccCCC`的链接。其中`*****`为你的 Nextcloud 服务器地址，`AaaAABbbBBCccCCC`为分享链接的唯一标识符。
## 2. 配置访问密码（可选）
在分享链接的设置中，可以选择在“自定义权限”中设置访问密码，以保护共享内容的安全。
## 3. 使用 WebDAV 访问分享文件夹
WebDAV 访问分享文件夹的URL为`https://*****/public.php/webdav`。用户名为1中生成的分享链接的唯一标识符`AaaAABbbBBCccCCC`，密码为2中设置的访问密码（如果有设置）。
### 4 在文件管理器中访问
以 Windows11 为例，可以在此电脑右键选择“映射网络驱动器”，在文件夹栏中输入 WebDAV URL，并使用上述的用户名和密码进行连接。