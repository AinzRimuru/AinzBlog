/**
 * 一次性脚本：为高优先级文章插入 FAQ front-matter（配合主题 FAQ 区块 + FAQPage JSON-LD）。
 * 用法: node tools/add_faqs.js [--dry-run]
 * 问题来源：联网调研的真实搜索长尾词（知乎/CSDN/游民星空等平台的用户提问习惯）。
 * 答案均锚定对应文章正文内容，避免与内容不符。
 */
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'source', '_posts');
const DRY_RUN = process.argv.includes('--dry-run');

// 文件名(不含.md) -> [{q, a}]
const FAQ_MAP = {
  '基于Cloudflare的内网穿透解决方案（含安全认证及动态IP白名单）': [
    { q: 'Cloudflare Tunnel 内网穿透是免费的吗？', a: '是。Tunnel 属于 Cloudflare Zero Trust 免费计划的一部分，个人使用零成本，你只需要一个托管在 Cloudflare 的域名。相比按带宽收费的商业穿透服务，长期使用几乎没有成本压力。' },
    { q: '没有公网 IP 可以用 Cloudflare 内网穿透吗？', a: '可以。Cloudflare Tunnel 由内网侧的 cloudflared 客户端主动向 Cloudflare 建立出站连接，不需要公网 IP、不需要端口映射，也不用在路由器上开放任何入站端口，天然适合家宽无公网 IP 的场景。' },
    { q: '相比 frp 等传统内网穿透，这个方案安全在哪里？', a: '方案叠加了两层防护：Cloudflare Access 为服务加上安全认证，未授权用户根本碰不到后端服务；再配合基于 Worker 的动态 IP 白名单，适配不支持认证的客户端。传统 frp 直连通常把服务端口直接暴露在公网，风险高得多。' },
  ],
  'DockerProxyCF：基于-Cloudflare-Worker-的-Docker-Hub-镜像代理': [
    { q: '为什么 docker pull 总是拉取失败或 429 限流？', a: 'Docker Hub 存储节点在境外，国内高峰期丢包严重，公共镜像源又经常因被大量白嫖触发匿名请求限流返回 429。自建 Cloudflare Worker 反向代理走专属通道，并可配置账号池自动冷却规避限流。' },
    { q: 'DockerProxyCF 支持 Docker Hub 账号鉴权吗？', a: '支持。可把 Docker Hub 账号（建议用 Access Token 代替密码）写入 Worker 的 dh_creds secret 形成账号池，绕开匿名限流；公开部署时还能开启 token 保护，拉取者拿不到你的真实账号凭证。' },
    { q: '部署需要自己的服务器吗？', a: '不需要。项目完全运行在 Cloudflare Workers 上，支持 Wrangler CLI 一键部署或 GitHub Actions 自动部署，个人使用免费额度即可覆盖。' },
    { q: '客户端怎么使用自建镜像代理？', a: '把 Worker 域名配置进 Docker 的 registry-mirrors（daemon.json），或直接 docker pull 你的域名/镜像名 即可。项目做了透明代理，会自动补全官方镜像的 library/ 前缀，无需改变使用习惯。' },
  ],
  '使用-Cloudflare-Workers-搭建-Hugging-Face-镜像代理': [
    { q: 'Hugging Face 国内打不开怎么办？', a: '可以自建 Hugging Face 镜像代理：把开源项目部署到 Cloudflare Workers，利用 Cloudflare 全球边缘网络转发请求，无需科学上网即可访问模型页面、下载模型文件和调用 API。' },
    { q: 'Python 怎么通过镜像下载模型？', a: '项目提供专用 Python 下载器，支持并行下载与断点续传，适合大模型文件；huggingface_hub、transformers 等工具链也可以通过设置 HF_ENDPOINT 环境变量指向镜像地址来使用。' },
    { q: '部署要花钱吗？', a: '不用。Workers 免费额度对个人下载模型的流量完全够用，推荐 Fork 仓库后一键部署，也支持 Wrangler CLI 方式。' },
  ],
  '个人NAS全方位攻略-需求分析': [
    { q: '新手买成品 NAS 还是自己 DIY？', a: '看折腾意愿。成品 NAS（群晖、威联通等）系统省心、套件生态成熟；DIY 性价比高、配置灵活，但要自己解决系统和运维问题。文章 2.1 节对两条路线有详细对比。' },
    { q: 'NAS 硬盘 CMR 和 SMR 有什么区别？', a: 'CMR（传统磁记录）每条磁道独立，随机写入性能稳定；SMR（叠瓦式）磁道重叠换取容量，随机写入严重掉速。NAS 是高频写入场景，选购时务必避开 SMR 叠瓦盘。' },
    { q: 'NAS 一定要配固态硬盘吗？', a: '不一定。机械硬盘容量大、单位成本低，适合做主存储；固态更适合做缓存或存放热数据。是否需要取决于你的读写负载，文章 2.2 节有机械/固态的取舍建议。' },
  ],
  '个人NAS全方位攻略-安全配置': [
    { q: '远程访问 NAS 必须做端口映射吗？', a: '不建议。直接端口映射或 DMZ 会把 NAS 管理界面暴露在公网，被扫描爆破的风险极高。更安全的做法是先经 VPN 接入内网再访问服务，或使用带认证的内网穿透方案。' },
    { q: 'RAID 等于备份吗？', a: '不等于。RAID 只抵御单块硬盘物理故障，防不了误删除、勒索病毒和整机损毁。建议遵循 3-2-1 备份原则：3 份数据、2 种介质、1 份异地，文章数据安全部分有展开。' },
    { q: 'NAS 防火墙基础配置怎么做？', a: '用 iptables 做最小化开放：只放行必要端口，SSH 改用密钥登录并禁用密码认证，管理界面尽量限制在内网或 VPN 内可达，配合 HTTPS 加密管理流量。' },
  ],
  '个人NAS全方位攻略-常用软件': [
    { q: 'NAS 有哪些必装软件？', a: '按需选装：文件同步用 Nextcloud，媒体管理用 Jellyfin/Plex，版本控制用 Gogs，内网穿透用 Frp，再搭配下载工具、在线办公与 LaTeX 编辑等，几乎所有应用都能用 Docker 部署。' },
    { q: 'Jellyfin 和 Plex 怎么选？', a: 'Jellyfin 开源免费无功能墙；Plex 客户端体验和生态更好但高级功能收费。家庭自用、想零成本长期跑，Jellyfin 通常性价比更高。' },
    { q: '这些软件部署起来麻烦吗？', a: '文章推荐的应用基本都有官方 Docker 镜像，用 Docker Compose 统一管理即可，配合系列前一篇的容器化部署实践可以快速上线并方便地维护升级。' },
  ],
  '天际线2-常见BUG解决方法汇总': [
    { q: '天际线2 邮局不出车怎么办？', a: '在不出车的邮局所属区块附近建一个分拣中心，等待一段时间后邮局就会恢复出车处理信件。注意解决思路是补分拣设施，而不是拆掉重建邮局。' },
    { q: '天际线2 邮件堆积怎么解决？', a: '邮件堆积与邮局处理能力不足有关，通过在对应区块增设分拣中心分流处理量即可缓解；城市规模变大后建议按区块提前规划分拣中心。' },
    { q: '只有部分区块的邮局不出车，是 BUG 吗？', a: '是游戏物流系统的常见问题：其他区块的邮局正常、个别区块邮局不出车且站内信件未被处理，属于处理逻辑故障，用分拣中心就能解决。' },
  ],
  '天际线2-城市规划技巧指南': [
    { q: '天际线2 火车完全堵死怎么解决？', a: '在繁忙的火车站建立环形等待区，并延长对外连接的支线作为缓冲，让排队列车有地方等待，避免在站内和正线上互相卡死。' },
    { q: '天际线2 货运港口门口堵车怎么办？', a: '两个方向：增加港口或货运站数量分流车流；同时避免车辆跨越道路后再进入站点，把进出站的道路设计顺，货运拥堵会明显缓解。' },
    { q: '什么是环形等待区？', a: '在火车站外围修一圈环形轨道作为排队缓冲区，进站列车先在环线上等待，把排队压力挡在正线之外，是缓解火车堵塞最有效的规划技巧。' },
  ],
  '解决-Microsoft-Word：错误-文档中没有指定样式的文字': [
    { q: '为什么 Word 插入题注会提示「错误!文档中没有指定样式的文字」？', a: '根因是题注的章节编号域找不到标题样式：要么标题没有配置多级列表，要么多级列表绑定的样式不是内置标题样式、而正文用的是自建样式，StyleRef 域解析失败就会报这个错。' },
    { q: 'Word 题注怎么带上章节编号（如图1-1）？', a: '先用多级列表把标题 1/标题 2 与编号绑定，插入题注时包含章节编号；如果用了自定义标题样式，需要把样式链接到内置标题样式，并修改 StyleRef 域属性后更新域。' },
    { q: '按文章修改后题注还是报错怎么办？', a: 'Ctrl+A 全选后按 F9 更新全部域刷新显示；仍有报错就用 Alt+F9 切换显示域代码，检查 StyleRef 引用的样式名是否与实际使用的标题样式一致。' },
  ],
  'JetBrains学生许可证续订失败处理': [
    { q: 'JetBrains 学生许可证续订失败怎么办？', a: '打开 JetBrains Account 的 Manage Account 页面，进入 Linked emails 关联一个新的教育邮箱并完成验证，学生授权即可恢复，不必重新走完整申请流程。' },
    { q: '学生授权过期了还能续吗？', a: '在学期间每年都可以续订。续期失败大多卡在教育邮箱验证环节，按文中步骤在 Linked emails 里关联并验证可用的教育邮箱即可找回授权。' },
    { q: '必须用 .edu.cn 邮箱申请吗？', a: '不是唯一方式。JetBrains 认可大学教育邮箱、ISIC 国际学生证、GitHub Student Developer Pack 等多种学生身份证明，国内高校的 .edu.cn 邮箱是最常用的验证渠道。' },
  ],
  'Windows配置Claude-Code代理（无额外依赖）': [
    { q: 'Claude Code 在国内无法连接怎么办？', a: '多为网络环境限制所致。在 Windows 下为 Claude Code 配置代理即可解决：修改安装目录下的启动脚本注入代理环境变量，配合 TUN 模式接管流量。' },
    { q: '需要安装额外的代理软件吗？', a: '本方案无额外依赖，复用已有的代理端口即可：通过环境变量让 Claude Code 的流量走代理，不需要为它单独装任何工具。' },
    { q: '配置后怎么确认代理生效？', a: '按文章的测试步骤验证：配置完成后重新运行 Claude Code，观察此前失败的连接是否恢复正常，即可确认代理已生效。' },
  ],
  'Cloudflare代理网页导致页面跳转出现503的解决办法': [
    { q: '网站经 Cloudflare 代理后跳转出现 503 是什么原因？', a: '如果响应头里带 cf-speculation-refused，是 Cloudflare Speed Brain 智能加速发出的 prefetch 预加载请求被拒绝导致的，属于预加载与页面跳转行为的冲突，不是源站故障。' },
    { q: '怎么关闭 Cloudflare Speed Brain？', a: '在 Cloudflare 控制台的 Speed 相关设置中关闭 Speed Brain 功能，503 报错和 cf-speculation-refused 响应头即随之消失。' },
    { q: '关闭 Speed Brain 会影响网站速度吗？', a: '影响很小。Speed Brain 只是预测性预加载，正常访问不依赖它；关掉后页面加载基本无感知差异，还能消除预加载失败带来的报错。' },
  ],
  '解决Google-Search-Console无法抓取站点地图sitemap-xml': [
    { q: 'Google Search Console 提示无法抓取 sitemap.xml 怎么办？', a: '常见于插件渲染的 sitemap.xml 因格式或编码问题无法被 GSC 解析。可用 atom.xml 等替代格式提交，Search Console 能够正常抓取。' },
    { q: '为什么用 atom.xml 替代 sitemap.xml？', a: 'sitemap.xml 由插件动态生成，个别环境下会出现 GSC 解析失败；atom.xml 结构简单、生成稳定，Google 官方支持把 Feed 当作站点地图提交，是可靠的替代方案。' },
  ],
  '解决高延迟场景中OpenVPN速度缓慢的问题': [
    { q: 'OpenVPN 速度慢的常见原因是什么？', a: '高延迟链路上默认缓冲区太小是主因：带宽与延迟的乘积（BDP）远超默认窗口，吞吐量被卡死；其次是用了 TCP 封装，1% 的丢包会被放大成严重延迟。' },
    { q: 'OpenVPN 的 sndbuf/rcvbuf 缓冲区怎么计算？', a: '按带宽延迟积计算：缓冲区字节数 = 带宽(Mbps) × 延迟(ms) × 1000 / 8。例如延迟 100ms、带宽 100Mbps 时，应设置 sndbuf/rcvbuf 约 1250000 字节。' },
    { q: '为什么要强制 UDP 并开启 BBR？', a: 'UDP 没有 TCP 的重传风暴，丢包影响小；BBR 拥塞控制算法针对高带宽深管道优化。两者配合再调大内核缓冲区，高延迟环境下的吞吐量能显著提升。' },
  ],
};

let updated = 0, missing = 0;
for (const [name, faqs] of Object.entries(FAQ_MAP)) {
  const file = path.join(POSTS_DIR, name + '.md');
  if (!fs.existsSync(file)) { console.error('[MISSING]', name); missing++; continue; }
  const content = fs.readFileSync(file, 'utf8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(eol);
  let count = 0, closeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') { count++; if (count === 2) { closeIdx = i; break; } }
  }
  if (closeIdx === -1) { console.error('[NO-FM]', name); missing++; continue; }
  if (lines.slice(0, closeIdx).some(l => l.trim() === 'faqs:')) { console.log('[SKIP] 已有 faqs:', name); continue; }
  const block = ['faqs:'].concat(faqs.map(f => [
    '  - q: "' + f.q.replace(/"/g, '\\"') + '"',
    '    a: "' + f.a.replace(/"/g, '\\"') + '"',
  ]).flat());
  lines.splice(closeIdx, 0, ...block);
  if (!DRY_RUN) fs.writeFileSync(file, lines.join(eol), 'utf8');
  console.log((DRY_RUN ? '[DRY]    ' : '[UPDATE] ') + name + ' (' + faqs.length + ' 条)');
  updated++;
}
console.log(`\n完成: 更新 ${updated} 篇, 异常 ${missing} 篇`);
