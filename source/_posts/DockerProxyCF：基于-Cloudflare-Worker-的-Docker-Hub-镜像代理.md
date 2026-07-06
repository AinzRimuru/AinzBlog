---
title: DockerProxyCF：基于 Cloudflare Worker 的 Docker Hub 镜像代理
date: 2026-07-06T18:14:38.000Z
cover: cover.png
description: Docker拉取镜像经常卡住或遇到429限流？本文介绍基于Cloudflare Worker的Docker Hub镜像反向代理项目docker_proxy_cf。它支持透明代理、自动补全library/、账号池与429自动冷却、Token保护及访问控制，帮你轻松解决受限网络环境下的镜像拉取难题，提升Docker使用体验。
tags:
  - Docker
  - Cloudflare Worker
  - Docker Hub
  - 镜像加速
  - 反向代理
  - Cloudflare D1
---
## 项目简介

`docker pull` 经常卡住、超时？匿名拉取动不动就 `429 TOOMANYREQUESTS`？国内/受限网络环境下，直接从 Docker Hub 拉镜像体验很差。这个项目帮你解决。

**docker_proxy_cf** 是一个基于 Cloudflare Worker 的 Docker Hub **pull-only** 反向代理。部署到自己的域名后，无论是直接 `docker pull <你的域名>/nginx`，还是把它配成 registry mirror，都能让镜像拉取走你自己的 Cloudflare 边缘网络。

项目地址：[https://github.com/AinzRimuru/docker_proxy_cf](https://github.com/AinzRimuru/docker_proxy_cf)

> 仅支持 `docker pull`（GET/HEAD/OPTIONS），不支持 push 等写操作。

## 特性

- **零侵入透明代理** - 直接 `docker pull` 或配成 registry mirror，客户端无需改造
- **透明转发 + 仅改写 auth realm** - 把 401 中的 `realm` 指回 Worker 的 `/token`，鉴权流程自然走代理
- **blob 走代理回源** - registry 对 blob 的 307 跳转被改写回本代理，由代理统一回源 CDN，无需多域名
- **自动补 `library/`** - `docker pull <域名>/nginx` 自动等价于 `library/nginx`
- **账号鉴权绕开限流** - 配置 Docker Hub 账号后走账号额度（200/h），客户端无需 `docker login`
- **账号池 + 429 自动冷却** - 绑定 Cloudflare D1 存多账号，按使用时间轮询，某号 429 自动冷却 6 小时并换号
- **token 保护与访问控制** - 真实账号 token 绝不外发，仅签发 HMAC 签名的 proxy token；可加访问密码
- **安全收敛** - 剥离所有泄露账号身份/额度的响应头，仅允许 Docker 自有域名回源（防 SSRF）

## 工作原理

```
docker client ──► 你的 Worker 域名
                     │
                     ├─ /v2/...manifests/tags ──►  registry-1.docker.io  （小文件，Worker 转发）
                     ├─ /token?...              ──►  auth.docker.io       （获取拉取 token）
                     └─ /v2/...blobs/<digest>   ──►  registry-1.docker.io 返回 307
                                                       ↓
                                          改写 Location 为 /redirect_to_<cdn>/...
                                          由 Worker 统一回源 CDN 下载大层
```

几个关键设计点：

**1. 透明转发 + 仅改写 auth realm。** 客户端首次请求 `/v2/...` 时，registry 返回 `401` 并在 `WWW-Authenticate` 里告诉客户端去哪拿 token。Worker 把其中的 `realm` 改写回自己的 `/token`，于是客户端的取 token 流程自然走代理。客户端最终拿到的是 `auth.docker.io` 签发的**真 token**，对 `registry-1.docker.io` 直接有效——Worker 内部无需自己签发/缓存 token，匿名与带认证拉取都兼容。

**2. blob 下载改写回源。** registry 会把 blob（镜像大层）请求 307 到 CDN（`production.cloudfront.docker.com`）。Worker 不直接透传这个 307 让客户端直连 CDN，而是把 `Location` 改写成 `/redirect_to_<cdn-host>/...`，由 Worker 自己回源 CDN 并流式返回。这样所有流量只经过单一代理域名，无需为 CDN 域名单独配置。

**3. 自动补 `library/`。** 官方镜像（如 `nginx`、`alpine`）实际存放在 `library/` 命名空间下，但客户端 `docker pull <域名>/nginx` 不会自动补全。Worker 会把单段镜像名改写为 `/v2/library/<name>/...`，与官方行为一致。

**4. 仅 pull。** 只放行 `GET/HEAD/OPTIONS`，其它方法一律返回 `405`。

## 部署

### 方式一：Wrangler CLI（推荐）

```bash
git clone https://github.com/AinzRimuru/docker_proxy_cf.git
cd docker_proxy_cf
npm install

npx wrangler login        # 首次需要登录
npx wrangler deploy
```

部署成功后会得到一个 `https://docker-hub-proxy.<你的子域>.workers.dev` 地址，也可在 Workers → Triggers → Custom Domains 绑定自定义域名。

> 本地调试：`npm run dev`，然后 `curl -i http://127.0.0.1:8787/v2/`。

### 方式二：Cloudflare Pages（单文件）

`src/index.js` 已是 ES module 默认导出，把它重命名为 `_worker.js` 直接上传到 Pages 项目即可使用，内容无需改动。

### 方式三：GitHub Actions 自动部署

仓库自带 `.github/workflows/deploy.yml`。在仓库 **Settings → Secrets and variables → Actions** 添加 `CLOUDFLARE_API_TOKEN`（需 Workers Scripts:Edit + D1:Edit 权限）后，push 到 `deploy` 分支即自动部署。

> Worker secrets（`DH_*` / `PROXY_TOKEN_KEY` / `ACCESS_KEY`）与 D1 绑定持久存在 Cloudflare，CI 只部署代码，无需在流水线里重设密钥。

## 进阶一：启用账号鉴权（绕开匿名限流，推荐）

匿名拉取受 Docker Hub 限流（100/h），而 Cloudflare Worker 的出口 IP 是全网共享的，匿名额度极易被耗尽导致 `429`。配置一个 Docker Hub 账号后，Worker 会用该账号统一换发 token 并在转发 registry 时覆盖鉴权——所有拉取计入**账号额度（200/h，不受共享 IP 影响）**，且客户端**无需 `docker login`**。

代码只引用变量名（`env.DH_USERNAME` / `env.DH_PASSWORD`），账号信息以 **Worker 加密 secret** 存储，不进源码。

```bash
# 1) 写入 Docker Hub 账号（格式 用户名:密码，按首个冒号拆分；密码可含特殊字符）
#    强烈建议用 Docker Hub Access Token 代替账号密码
printf '%s' '你的用户名:你的密码或PAT' > dh_creds

# 2) Cloudflare 鉴权（脚本优先用环境变量，也可在项目目录放 token 文件，已 gitignore）
export CLOUDFLARE_API_TOKEN='你的CF令牌'

# 3) 把账号写入 Worker secret（读取 dh_creds）
./set-secrets.sh

# 4) 部署 / 更新代码
./deploy.sh
```

完成后 `docker pull <你的域名>/alpine` 直接可用，无需 login。响应头里 `docker-ratelimit-source` 会显示你的账号名、`ratelimit-limit: 200;w=3600`，即代表已走账号额度。**未配置 secret 时自动回退为匿名透传模式。**

> 该账号额度被所有使用本代理的人共享；凭据建议用专用 Access Token 并在泄露后及时轮换。`dh_creds`、`token` 均已在 `.gitignore` 中。

## 进阶二：token 保护（防真实账号 token 泄露，公开服务推荐）

上一节的账号鉴权模式下，`/token` 会把**真实的 Docker Hub 账号 token** 直接返回给客户端——服务一旦公开，任何人都能从 `/token` 刮走真 token 直连 Docker Hub 消耗你的账号额度。启用 token 保护（设置 `PROXY_TOKEN_KEY`）后：

- `/token` 只签发 **proxy token**（HMAC-SHA256 签名的 JWT），**真实账号 token 仅在 Worker 内部使用、绝不外发**；
- registry 要求客户端持有有效 proxy token（标准 Bearer 流程，docker 客户端自动完成 401→取 token→重试）；
- proxy token 对 Docker Hub 无效、签名不可伪造，被刮走也无用。

```bash
# A) 仅 token 保护：任何人可拉取，但拿不到真实账号 token
! ~/docker_proxy_cf/set-proxy-key.sh

# B) token 保护 + 访问控制：未知密码者无法拉取
! ACCESS_KEY=你的访问密码 ~/docker_proxy_cf/set-proxy-key.sh
! ~/docker_proxy_cf/deploy.sh
```

`set-proxy-key.sh` 会用 `openssl` 自动生成 32 字节随机密钥。启用后 `docker pull <你的域名>/alpine` 仍无需手动 login（客户端自动完成鉴权流程）。若设了 `ACCESS_KEY`，则需先：

```bash
docker login <你的域名> -u任意用户名 -p<ACCESS_KEY>
```

> `PROXY_TOKEN_KEY` 仅 Worker 内部使用、无需记忆；更换它会使已签发 token 失效（proxy token 默认 1 小时过期，影响很小）。

## 进阶三：账号池与 429 自动冷却（D1）

单账号额度耗尽即 429。绑定 Cloudflare D1 后可存**多个账号**，Worker 按 `last_used` 轮询选号；某账号触发 429 自动**冷却 6 小时**（写 `rate_limited_until=now+6h`），期间跳过、自动换下一个；D1 账号全部冷却时回退单账号（若有）或返回 429。

**1）创建 D1 + 建表（一次性）：**

```bash
! ~/docker_proxy_cf/d1-setup.sh   # 创建库 docker-hub-accounts + accounts 表，输出 database_id
```

需把返回的 `database_id` 填入 `wrangler.jsonc` 的 `d1_databases` 绑定（binding 名为 `DB`）：

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "docker-hub-accounts",
      "database_id": "<你的 database_id>"
    }
  ]
}
```

**2）录入账号**（`accounts.txt` 每行 `用户名:密码`，`#` 为注释；密码建议用 Docker Hub Access Token）：

```bash
! ~/docker_proxy_cf/insert-accounts.sh
```

**accounts 表结构：** `username`、`password`、`enabled`(0/1)、`rate_limited_until`(ms 时间戳，0=可用)、`last_used`、`limited_count`(被 429 次数)。

> D1 有账号则用账号池；D1 为空或查询失败时自动回退单账号。冷却逻辑可隔离验证：`! ~/docker_proxy_cf/verify-cooldown.sh`。

## 客户端使用

### 直接拉取

```bash
# 官方镜像（library/ 可省略）
docker pull <你的域名>/nginx
docker pull <你的域名>/library/nginx:1.27

# 用户仓库
docker pull <你的域名>/user/repo:tag
```

### 作为 registry mirror（推荐，无需改镜像名）

编辑 `/etc/docker/daemon.json`（Docker Desktop 在 设置 → Docker Engine）：

```json
{
  "registry-mirrors": ["https://<你的域名>"]
}
```

重启 Docker：

```bash
sudo systemctl restart docker
# 或 macOS / Windows 重启 Docker Desktop
```

之后 `docker pull nginx` 会自动走镜像，无需在镜像名前加域名。

## 安全设计

这个项目在安全上做了几处针对性收敛，适合作为公开/半公开服务运行：

- **真实 token 不外发** - 启用 token 保护后，Docker Hub 账号 token 仅在 Worker 内部使用，客户端只能拿到对 Docker Hub 无效的 proxy token。
- **剥离泄露头** - 响应中 `docker-ratelimit-source`（会带出 token 所属账号用户名）、`ratelimit-*` 等头一律剥离，账号身份绝不外泄。
- **回源域名白名单** - `/redirect_to_` 回源路径只允许 `*.docker.com` / `*.docker.io`，防止被当成开放代理或 SSRF 跳板。
- **凭据加密存储** - 所有账号、密钥以 Worker secret 形式加密存储，不入源码、不进仓库（`dh_creds` / `token` / `accounts.txt` 均已 gitignore）。

## 验证

```bash
# 1. 探活：匿名模式返回 401（realm 指向你的域名）；配置账号后返回 200
curl -i https://<你的域名>/v2/

# 2. 完整拉取一个镜像
docker pull <你的域名>/alpine
```

## 限制与说明

- **仅 pull**：所有写操作（push / delete 等）返回 `405`。
- **匿名限流**：匿名拉取受 Docker Hub 速率限制（100/h），且 Worker 出口 IP 共享，极易 `429`。**已配置账号鉴权即不受此限**（见「进阶一」），客户端也无需 `docker login`。
- **上游固定为 `registry-1.docker.io`**，仅代理 Docker Hub，不代理其它 registry。
- blob 改写回源经 Worker 转发，manifest/token 走 Worker；Worker Free 计划每次请求子请求上限（50）对单次 pull 足够。

## License

MIT License

---

项目地址：[https://github.com/AinzRimuru/docker_proxy_cf](https://github.com/AinzRimuru/docker_proxy_cf)