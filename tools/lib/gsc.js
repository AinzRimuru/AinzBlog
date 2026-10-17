/**
 * 命令：gsc —— GSC Search Analytics 直连工具（零第三方依赖，实现 open-seo-mcp-skills 的
 * seo-audit / rank-tracking 核心：真实点击/曝光/CTR/排名，不是估算值）。
 *
 * 认证：Google 服务账号（与 Indexing API 同一套，scope 换成 webmasters.readonly）。
 * key 文件：项目根目录下匹配 *_sa_key.json 的文件（.gitignore 已覆盖），或
 *          环境变量 GSC_SA_KEY 指定路径。
 * 前提：该服务账号已在 Google Search Console 中被添加为站点用户（完整或受限均可）。
 *
 * 用法（经统一入口）:
 *   node tools/generate_metadata.js gsc --list                 # 列出可访问的站点
 *   node tools/generate_metadata.js gsc --days 90              # 近90天 查询词+页面 两维度报告
 *   node tools/generate_metadata.js gsc --days 90 --json out   # 输出 JSON 文件
 *   node tools/generate_metadata.js gsc --submit-sitemap [url] # 重新提交 sitemap
 *   node tools/generate_metadata.js gsc --inspect [url...]     # URL 检查（索引诊断）
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT } = require('./env');

function findSaKey() {
  const fromEnv = process.env.GSC_SA_KEY;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const hit = fs.readdirSync(ROOT).find(f => /_sa_key\.json$/.test(f));
  return hit ? path.join(ROOT, hit) : null;
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(sa, args) {
  const now = Math.floor(Date.now() / 1000);
  const h = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const p = base64url(Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: args.includes('--submit-sitemap') ? 'https://www.googleapis.com/auth/webmasters' : 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })));
  const unsigned = `${h}.${p}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
  const jwt = `${unsigned}.${base64url(sig)}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('token 获取失败: ' + JSON.stringify(d).slice(0, 300));
  return d.access_token;
}

async function gscApi(token, apiPath, body) {
  const r = await fetch('https://searchconsole.googleapis.com/' + apiPath, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`GSC API ${r.status}: ${JSON.stringify(d).slice(0, 300)}`);
  return d;
}

function isoDaysAgo(n) { const d = new Date(Date.now() - n * 864e5); return d.toISOString().slice(0, 10); }

async function query(token, site, startDate, endDate, dimension) {
  const d = await gscApi(token, `webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    startDate, endDate, dimensions: [dimension], rowLimit: 1000,
  });
  return (d.rows || []).map(r => ({
    key: r.keys[0], clicks: r.clicks, impressions: r.impressions,
    ctr: r.ctr, position: r.position,
  }));
}

async function run(args) {
  const flag = (n) => args.includes(n);
  const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

  const keyFile = findSaKey();
  if (!keyFile) {
    console.error('未找到服务账号 key（*_sa_key.json）。请从 Google Cloud Console 导出并放到项目根目录。');
    process.exit(1);
  }
  const sa = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  console.error(`[auth] 服务账号: ${sa.client_email}`);
  const token = await getAccessToken(sa, args);

  if (flag('--list')) {
    const sites = await gscApi(token, 'webmasters/v3/sites');
    (sites.siteEntry || []).forEach(s => console.log(s.permissionLevel, s.siteUrl));
    return;
  }

  // 重新提交 sitemap（未收录阶段唤醒 Google 的第一步）
  if (flag('--submit-sitemap')) {
    const site3 = opt('--site', 'https://blog.rimuru.work/');
    const feed = opt('--submit-sitemap', site3 + 'sitemap.xml');
    const api = `webmasters/v3/sites/${encodeURIComponent(site3)}/sitemaps/${encodeURIComponent(feed)}`;
    const r = await fetch('https://searchconsole.googleapis.com/' + api, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Length': '0' },
    });
    if (r.status !== 204) throw new Error('提交失败: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    console.log(`[submit] ✓ 已提交 ${feed}（HTTP 204）`);
    return;
  }

  // URL 检查（未收录阶段的诊断主力）：逐页查抓取/索引状态
  if (flag('--inspect')) {
    const site2 = opt('--site', 'https://blog.rimuru.work/');
    const args2 = args.filter(a => a.startsWith('http'));
    const targets = args2.length ? [...args2] : [];
    if (!args2.length) {
      // 抽查：首页 + sitemap 中近期几页
      const sm = await fetch(site2 + '/sitemap.xml').then(r => r.text()).catch(() => '');
      const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
      targets.push(site2.replace(/\/+$/, '/') , ...(locs.filter(u => /2026\/10/.test(u)).slice(0, 2)), ...(locs.filter(u => /2026\/03/.test(u)).slice(0, 1)));
    }
    console.error(`[inspect] 检查 ${targets.length} 个 URL`);
    for (const u of targets) {
      const d = await gscApi(token, 'v1/urlInspection/index:inspect', { inspectionUrl: u, siteUrl: site2, languageCode: 'zh-CN' });
      const r = d.inspectionResult || {};
      const idx = r.indexStatusResult || {};
      console.log(`\n● ${decodeURIComponent(u)}`);
      console.log(`  结论: ${idx.verdict || 'n/a'} | 索引: ${idx.coverageState || 'n/a'} | robotsTxt: ${idx.robotsTxtState || 'n/a'} | 抓取: ${idx.pageFetchState || 'n/a'} | canonical: ${idx.googleCanonical || 'n/a'}`);
      console.log(`  最后抓取: ${idx.lastCrawlTime || '从未'} | 上次出现: ${idx.lastSeen || 'n/a'}`);
      await new Promise(r2 => setTimeout(r2, 600)); // 配额友好
    }
    return;
  }

  const site = opt('--site', 'https://blog.rimuru.work/');
  const days = parseInt(opt('--days', '90'), 10);
  const end = isoDaysAgo(2), start = isoDaysAgo(days + 2);
  const prevEnd = isoDaysAgo(days + 3), prevStart = isoDaysAgo(2 * days + 3);

  console.error(`[range] 本期 ${start}~${end} vs 上期 ${prevStart}~${prevEnd} @ ${site}`);

  const [qNow, qPrev, pNow, pPrev] = await Promise.all([
    query(token, site, start, end, 'query'),
    query(token, site, prevStart, prevEnd, 'query'),
    query(token, site, start, end, 'page'),
    query(token, site, prevStart, prevEnd, 'page'),
  ]);
  const prevMapQ = new Map(qPrev.map(r => [r.key, r]));
  const prevMapP = new Map(pPrev.map(r => [r.key, r]));

  const total = qNow.reduce((a, r) => a + r.clicks, 0);
  const totalPrev = qPrev.reduce((a, r) => a + r.clicks, 0);
  console.error(`[totals] 本期点击 ${total} | 上期 ${totalPrev} | 环比 ${(100 * (total - totalPrev) / (totalPrev || 1)).toFixed(1)}%`);

  // seo-audit 四类发现
  const striking = qNow.filter(r => r.position >= 8 && r.position <= 20 && r.impressions >= 10)
    .sort((a, b) => b.impressions - a.impressions);
  const ctrAnomaly = qNow.filter(r => r.position <= 5 && r.impressions >= 20 && r.ctr < 0.02);
  const decay = pNow.map(r => {
    const p = prevMapP.get(r.key);
    return p && p.clicks > 5 ? { ...r, prevClicks: p.clicks, delta: r.clicks - p.clicks, deltaPct: (r.clicks - p.clicks) / p.clicks } : null;
  }).filter(r => r && r.deltaPct < -0.3).sort((a, b) => a.delta - b.delta);
  const rising = qNow.map(r => {
    const p = prevMapQ.get(r.key);
    return p ? { ...r, prevPos: p.position, change: p.position - r.position } : { ...r, prevPos: null, change: null, isNew: !p };
  }).filter(r => r.isNew && r.impressions >= 10).sort((a, b) => b.impressions - a.impressions);

  const report = {
    generatedAt: new Date().toISOString(), site, windowDays: days,
    totals: { clicks: total, prevClicks: totalPrev },
    strikingDistance: striking.slice(0, 30),
    ctrAnomalies: ctrAnomaly.slice(0, 20),
    decayingPages: decay.slice(0, 20),
    newQueriesWithImpressions: rising.slice(0, 30),
    topQueries: qNow.slice(0, 50),
    topPages: pNow.slice(0, 50),
  };

  if (opt('--json', null)) {
    fs.writeFileSync(opt('--json', 'gsc-report.json'), JSON.stringify(report, null, 2));
    console.error(`[out] JSON 已写入 ${opt('--json', 'gsc-report.json')}`);
  }
  const pct = x => (100 * x).toFixed(1) + '%';
  const sec = (t, rows, f) => { console.log('\n## ' + t); rows.forEach(f); };
  console.log(`# GSC 报告 ${site}（${days}天）`);
  sec(`临门一脚（排名8-20，曝光≥10）TOP15`, striking.slice(0, 15), r =>
    console.log(`  pos=${r.position.toFixed(1)} imp=${r.impressions} clicks=${r.clicks} | ${r.key}`));
  sec('CTR 异常（排名≤5 但 CTR<2%）', ctrAnomaly, r =>
    console.log(`  pos=${r.position.toFixed(1)} ctr=${pct(r.ctr)} imp=${r.impressions} | ${r.key}`));
  sec('衰退页面（点击环比↓30%+）', decay, r =>
    console.log(`  ${r.prevClicks}→${r.clicks}（${pct(r.deltaPct)}）| ${decodeURIComponent(r.key)}`));
  sec('新获得曝光的查询词 TOP15', rising.slice(0, 15), r =>
    console.log(`  imp=${r.impressions} clicks=${r.clicks} pos=${r.position.toFixed(1)} | ${r.key}`));
}

module.exports = { run };
