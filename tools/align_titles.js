/**
 * 一次性脚本：标题对齐搜索意图（仅改 front-matter title，URL 由文件名决定，不受影响）。
 * 依据：调研中该主题的高频搜索词形（如「城市天际线2 邮局bug」「cloudflare tunnel 免费」）。
 * 用法: node tools/align_titles.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const POSTS_DIR = path.join(__dirname, '..', 'source', '_posts');
const DRY_RUN = process.argv.includes('--dry-run');

const TITLE_MAP = {
  '个人NAS全方位攻略-需求分析': '个人NAS全方位攻略（一）需求分析：新手选购指南与硬盘避坑',
  '个人NAS全方位攻略-安全配置': '个人NAS全方位攻略（二）安全配置：VPN、防火墙与数据备份',
  '个人NAS全方位攻略-容器化部署': '个人NAS全方位攻略（三）容器化部署：Docker Compose 实践',
  '个人NAS全方位攻略-常用软件': '个人NAS全方位攻略（四）常用软件：NAS必装Docker应用推荐',
  '天际线2-城市规划技巧指南': '城市天际线2交通规划指南：解决火车堵塞与货运拥堵',
  '天际线2-常见BUG解决方法汇总': '城市天际线2常见BUG解决：邮局不出车、邮件堆积',
  '基于Cloudflare的内网穿透解决方案（含安全认证及动态IP白名单）': 'Cloudflare Tunnel 免费内网穿透教程：安全认证与动态IP白名单',
  '解决-Microsoft-Word：错误-文档中没有指定样式的文字': 'Word题注报错解决：错误!文档中没有指定样式的文字',
  'JetBrains学生许可证续订失败处理': 'JetBrains学生许可证续订失败怎么办？关联教育邮箱解决',
};

let n = 0;
for (const [name, newTitle] of Object.entries(TITLE_MAP)) {
  const file = path.join(POSTS_DIR, name + '.md');
  if (!fs.existsSync(file)) { console.error('[MISSING]', name); continue; }
  const content = fs.readFileSync(file, 'utf8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(eol);
  const tIdx = lines.findIndex(l => l.startsWith('title:'));
  if (tIdx === -1) { console.error('[NO-TITLE]', name); continue; }
  const old = lines[tIdx];
  lines[tIdx] = 'title: ' + newTitle;
  if (!DRY_RUN) fs.writeFileSync(file, lines.join(eol), 'utf8');
  console.log((DRY_RUN ? '[DRY] ' : '[OK] ') + name);
  console.log('     ' + old);
  console.log('   → ' + lines[tIdx]);
  n++;
}
console.log('\n完成: ' + n + ' 篇');
