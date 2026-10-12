---
title: 用cf-billing-guard避免Cloudflare Worker账单爆炸
date: 2026-10-12T18:58:02.000Z
cover: cover.jpg
category:
  - 技术随笔
tags:
  - Cloudflare
  - Cloudflare Workers
  - 成本控制
description: 介绍 cf-billing-guard 开源工具，旨在防止 Cloudflare Worker 因代码无限循环等问题导致账单异常飙升。通过对请求进行限流以及对 D1、KV、R2 等服务调用设置上限，有效控制 Serverless 架构的运行成本，保护开发者免受天价账单困扰。
---
## 介绍
Cloudflare Worker 虽然提供了大量的免费调用额度还还配套了非常多的持久化数据库服务，的这些服务在免费额度用完之后就会产生费用。最重要的是如果服务代码中出现**无限循环**，那么可能会导致账单迅速飙升，产生高额费用。已经有了非常多的先例：
[Cloudflare Worker 无限循环导致高额账单的案例](https://blog.cloudflare.com/worker-billing-guard/)
[收到 Cloudflare Durable Object 的天价账单，如何应对](https://linux.do/t/topic/2171380)
[I accidentally generated 16 billion Durable Object writes in one month and got slapped with a $36k bill . Here's exactly how.](https://www.reddit.com/r/CloudFlare/comments/1t1e8nh/i_accidentally_generated_16_billion_durable/)
[Durable Object alarm loop: $34k in 8 days, zero users, no platform warning](https://news.ycombinator.com/item?id=47787042)
相关案例在国内比比皆是，为此本站推出了 [cf-billing-guard](https://github.com/AinzRimuru/cf-billing-guard) 工具，用于防止 Cloudflare Worker 账单爆炸。cf-billing-guard 会覆盖项目的 Worker 入口文件，对所有的调用请求进行计数和限流，对单次请求的数据库等服务调用设置上限，从而有效防止账单异常增长。项目采用 Trusted Publisher 方式发布，确保npmjs包的安全性，有效保护用户的数据安全。

## 使用方法

### 安装

```bash
npm install -D cf-billing-guard
```

### 快速开始

```bash
npx cf-billing-guard enable          # 一键接线
npx cf-billing-guard disable         # 完全回滚
```
### 支持的服务

内建适配器——默认生效。限额配置在生成的 `billing-guard.main.js` 里：在 `d1`/`kv` 旁按类型各加一行。

```js
// billing-guard.main.js（自动生成，可直接编辑）
export default withBillingGuard(worker, {
  defaults: { maxCalls: 100, onExceed: 'throw' },
  d1: { maxCalls: 100 },  // 单请求 D1 调用上限
  kv: { maxCalls: 100 },  // 单请求 KV 调用上限
  r2: { maxCalls: 50 },   // ← 按需加类型
  queue: { maxCalls: 100 },
  bindings: { DB: {}, BUCKET: { maxCalls: 10 } }, // 按绑定名覆盖（优先级最高）
});
```

未单列的类型回落到 `defaults`。

| kind | 计数 | `'empty'` 中立结果 |
|---|---|---|
| `d1` | 终结方法 1 次；`batch` N 次；`exec` 1 次 | 同构空结果 |
| `kv` | `get / getWithMetadata / put / delete / list` | `null` / 空列表 |
| `r2` | `get / head / put / delete / list` | `null` / `{objects:[]}` |
| `queue` | `send` 1 条；`sendBatch` N 条（整批原子） | 丢弃（`undefined`） |
| `vectorize` | `query / getByIds / deleteByIds / describe` 1 次；`insert / upsert` 按向量数 | 空查询结果 |
| `analytics` | `writeDataPoint` | `undefined` |
| `ai` | `run` | `null` |
| `do` | stub 的 `fetch` / RPC 各 1 次（经 `env.<name>.get(...)`） | `undefined` |

## 免责声明

- 仅 `d1` 与 `kv` 经真实 Cloudflare 平台验证，其余服务适配器仅通过 mock 测试，在真实运行时上的表现可能与预期不同。
- 本库是尽力而为（best-effort）的账单防护，而非保证：无法探测的绑定类型不被计数；拦截调用可阻止后续用量，但不追回、也不封顶已产生的费用。
- 本库与 Cloudflare 无隶属、赞助或背书关系。"Cloudflare"、"Workers"、"D1"、"R2"、"Durable Objects" 等名称及商标归其各自所有者。
- 本库按 MIT 许可证原样提供，作者不对因使用本库产生的任何超额费用、服务中断、数据丢失或其他损失承担责任。