/**
 * SEO 关键词管理脚本（v2，基于联网调研的长尾词版本）
 * 用法: node tools/add_seo_keywords.js [--dry-run]
 * 行为: 文章已有 keywords 时替换为 KEYWORD_MAP 中的调研版；没有则插入。
 * KEYWORD_MAP 来源：对各内容集群的中文搜索生态调研（知乎/CSDN/腾讯云/游民星空等
 * 高排名内容的标题与相关搜索），提炼真实查询词 + 长尾变体。
 */
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'source', '_posts');
const DRY_RUN = process.argv.includes('--dry-run');

const KEYWORD_MAP = {
  'Cloudflare-WAF规则的免费替代-域名安全规则': ['Cloudflare WAF 免费规则', 'Cloudflare 域名安全规则', 'Cloudflare 免费版 防CC', 'Cloudflare 速率限制规则', 'WAF 自定义规则', '防CC 攻击 设置'],
  'Cloudflare代理网页导致页面跳转出现503的解决办法': ['Cloudflare 503 错误', 'cf-speculation-refused', 'Cloudflare Speed Brain 关闭', 'Cloudflare 代理 503', '网页预加载 prefetch 失败', 'Cloudflare CDN 排错'],
  'DockerProxyCF：基于-Cloudflare-Worker-的-Docker-Hub-镜像代理': ['Docker 镜像加速', 'Docker Hub 国内镜像源', '自建 Docker 镜像代理', 'docker pull 429 限流', 'docker hub 拉取失败', 'Cloudflare Worker 反向代理'],
  'FriendFlow-让友链活起来的互助系统': ['友链系统', '博客友链优化', '友链文章聚合', 'Cloudflare Workers 开源项目', 'RSS 聚合', 'Friend Flow'],
  'Hexo博客接入FriendFlow友链插件教程': ['Hexo 友链插件', 'Friend Flow 接入', 'Hexo 标签插件', '友链页面卡片', '友链最新文章展示', 'hexo friend flow'],
  'Hexo博客智能推荐阅读功能：基于OpenAI-Embedding的实现': ['Hexo 相关文章推荐', 'OpenAI Embedding 推荐', '语义相似度 文章推荐', 'Hexo 博客优化', 'embedding 教程', '智能推荐 实现'],
  'HuggingfaceProxy-项目介绍与部署指南': ['Hugging Face 国内访问', 'huggingface 镜像站', 'HF_ENDPOINT 配置', 'huggingface 模型下载加速', '自建 huggingface 镜像', '大模型下载 慢'],
  'JetBrains学生许可证续订失败处理': ['JetBrains 学生认证', 'JetBrains 全家桶 免费', 'JetBrains 学生包 续期失败', '教育邮箱 认证', 'IDEA 学生授权', 'JetBrains 许可证过期'],
  'Linux-系统管理：高频运维场景的一键命令合集': ['Linux 运维命令', 'smartctl 硬盘健康检查', 'PID 查找容器', 'Kubernetes 排错命令', 'containerd 运维技巧', 'Docker 运维'],
  'Nextcloud使用WebDAV访问分享文件夹': ['Nextcloud WebDAV', 'WebDAV 映射网络驱动器', 'Nextcloud 分享文件夹 挂载', 'Windows 11 WebDAV 连接', 'Nextcloud 外部访问', 'public.php webdav'],
  'Overleaf-Sharelatex-本地部署无需邮箱重置管理员密码': ['Overleaf 重置管理员密码', 'ShareLaTeX 本地部署', 'Overleaf 忘记密码', 'Overleaf 邮箱不可用', 'LaTeX 自建 服务', 'Overleaf Docker 部署'],
  'Wallpaper-Engine搜索作者': ['Wallpaper Engine 搜索作者', 'Wallpaper Engine 找不到作者', '创意工坊 作者主页', 'Steam ID 查作者', '壁纸作者 搜索', '动态壁纸下载'],
  'Windows配置Claude-Code代理（无额外依赖）': ['Claude Code 代理设置', 'Claude Code 无法连接', 'Claude Code 403', 'Claude Code 环境变量 代理', 'TUN 模式 代理', 'Windows 代理配置'],
  '个人NAS全方位攻略-安全配置': ['NAS 安全配置', 'NAS 防火墙 iptables', 'SSH 密钥认证 配置', '3-2-1 备份原则', 'NAS RAID 方案选择', 'NAS 数据安全 防入侵'],
  '个人NAS全方位攻略-容器化部署': ['NAS Docker 部署', 'Docker Compose 容器管理', 'Docker 数据持久化', 'Docker 网络隔离', '容器资源限制', 'NAS 容器化 最佳实践'],
  '个人NAS全方位攻略-常用软件': ['NAS 必装软件', 'NAS Docker 软件推荐', 'Jellyfin 媒体服务器', 'Nextcloud 私有云盘', 'Frp 内网穿透', '家庭影音 NAS'],
  '个人NAS全方位攻略-需求分析': ['NAS 选购指南 新手', '家用 NAS 推荐', 'CMR SMR 区别', '叠瓦式硬盘 避坑', 'NAS 硬盘推荐', '成品 NAS 还是 DIY'],
  '使用-Cloudflare-Workers-搭建-Hugging-Face-镜像代理': ['Cloudflare Workers 搭建教程', 'Hugging Face 镜像代理', 'huggingface 访问不了', '自建 hf-mirror', 'Cloudflare Pages 反向代理', 'huggingface 下载失败'],
  '在Hexo博客中插入图片': ['Hexo 插入图片', 'Hexo 图片不显示', 'Hexo 图片路径 配置', 'post_asset_folder', 'Hexo 图片设置', 'Markdown 图片引用'],
  '基于Cloudflare的内网穿透解决方案（含安全认证及动态IP白名单）': ['Cloudflare Tunnel 免费内网穿透', 'Cloudflare Zero Trust 教程', '无公网IP 内网穿透', '免备案 内网穿透', 'cloudflared 部署', 'Cloudflare Access 访问控制'],
  '天际线2-城市规划技巧指南': ['天际线2 交通堵塞 解决', '城市天际线2 交通规划', '天际线2 火车堵塞', '天际线2 货运火车站 不出车', '都市天际线2 攻略', 'CS2 交通优化'],
  '天际线2-常见BUG解决方法汇总': ['都市天际线2 邮局bug', '天际线2 邮局不出车', '天际线2 邮件堆积', '天际线2 分拣中心', '城市天际线2 BUG 汇总', '天际线2 常见问题 解决'],
  '家用宽带上行被限速后的全方位取证方法': ['宽带上行限速', '宽带测速 取证', '工信部投诉 宽带', 'iperf3 测速', '上行带宽 被限速', '宽带维权 投诉'],
  '用cf-billing-guard避免Cloudflare-Worker账单爆炸': ['Cloudflare Worker 账单 异常', 'cf-billing-guard', 'Workers 请求 限流', 'Serverless 成本控制', 'Cloudflare 免费额度 超出', 'Worker 无限循环 防护'],
  '虚拟机硬盘VMDK扩容和缩容-硬盘空间、分区、文件系统': ['VMDK 扩容', '虚拟机硬盘扩容', 'parted 分区 扩容', 'resize2fs 扩容 EXT4', 'VMware 磁盘 缩容', 'GPT 分区 调整'],
  '解决Google-Search-Console无法抓取站点地图sitemap-xml': ['Google Search Console sitemap 无法抓取', 'sitemap.xml 抓取失败', 'GSC 站点地图 提交', 'sitemap 报错 解决', 'atom.xml 替代', '谷歌收录 网站地图'],
  '解决-Microsoft-Word：错误-文档中没有指定样式的文字': ['Word 错误!文档中没有指定样式的文字', 'Word 题注 报错', '毕业论文 题注 编号', 'Word 交叉引用 错误', 'StyleRef 域 修改', 'Word 多级列表 标题编号'],
  '解决OpenClaw自定义模型后出现-No-API-provider-registered-for-api-报错': ['OpenClaw 报错', 'No API provider registered for api', 'OpenClaw 自定义模型', '智谱 GLM 配置', 'OpenClaw Docker 升级', 'OpenClaw API 配置'],
  '解决高延迟场景中OpenVPN速度缓慢的问题': ['OpenVPN 速度慢 优化', 'OpenVPN 高延迟', 'OpenVPN sndbuf rcvbuf', 'OpenVPN MTU 调整', 'BBR 拥塞控制 开启', 'OpenVPN 带宽 上不去'],
  '记一次因Cloudflare域名安全规则配置错误导致的网站访问异常': ['Cloudflare 403 错误', 'Cloudflare 域名安全规则', 'Cloudflare 拦截规则 误伤', 'Cloudflare 网站打不开 排查', 'WAF 配置错误 403', 'Cloudflare 安全规则 教程'],
};

function buildBlock(kws, indent) {
  return ['keywords:'].concat(kws.map(k => '  - "' + k.replace(/"/g, '\\"') + '"'));
}

let updated = 0, missing = 0;
for (const [name, kws] of Object.entries(KEYWORD_MAP)) {
  const file = path.join(POSTS_DIR, name + '.md');
  if (!fs.existsSync(file)) { console.error('[MISSING]', name); missing++; continue; }
  const content = fs.readFileSync(file, 'utf8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(eol);
  // 定位 front-matter 范围
  let count = 0, closeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') { count++; if (count === 2) { closeIdx = i; break; } }
  }
  if (closeIdx === -1) { console.error('[NO-FM]', name); missing++; continue; }
  const fmLines = lines.slice(0, closeIdx);
  const kwIdx = fmLines.findIndex(l => l.trim() === 'keywords:');
  let block = buildBlock(kws);
  if (kwIdx >= 0) {
    // 已有 keywords：替换整块（keywords: 行 + 连续的缩进列表行）
    let end = kwIdx + 1;
    while (end < closeIdx && /^\s*-\s/.test(lines[end])) end++;
    lines.splice(kwIdx, end - kwIdx, ...block);
    console.log((DRY_RUN ? '[DRY-REP] ' : '[REPLACE] ') + name);
  } else {
    lines.splice(closeIdx, 0, ...block);
    console.log((DRY_RUN ? '[DRY-INS] ' : '[INSERT] ') + name);
  }
  if (!DRY_RUN) fs.writeFileSync(file, lines.join(eol), 'utf8');
  updated++;
}
console.log(`\n完成: 处理 ${updated} 篇, 异常 ${missing} 篇`);
