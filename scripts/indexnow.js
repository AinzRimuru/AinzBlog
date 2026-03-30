/**
 * IndexNow 集成
 * Docs: https://www.indexnow.org/documentation
 *
 * 功能：
 * 1. 生成 indexnow.xml 到 public/ 根目录
 * 2. 构建时自动向 IndexNow API 推送最近更新的文章 URL
 */

const https = require('https');

function pingIndexNow(url, key, urlList) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      host: new URL(url).hostname,
      key: key,
      urlList: urlList
    });

    const parsedUrl = new URL(url);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      },
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 0, error: e.message });
    });

    req.write(postData);
    req.end();
  });
}

hexo.extend.generator.register('indexnow', async function(locals) {
  const log = hexo.log || console;
  const config = hexo.config.indexnow;

  if (!config || !config.enable) {
    return [];
  }

  const siteUrl = hexo.config.url.replace(/\/+$/, '');
  const key = config.key;
  const pingUrls = config.ping_urls || ['https://api.indexnow.org/indexnow'];

  // 获取所有已发布文章的 URL
  const posts = locals.posts.sort('-updated').toArray();
  const allUrls = posts.map(post => {
    const permalink = post.permalink.replace(/\/index\.html$/, '/');
    return permalink;
  });

  // 生成 indexnow.xml
  const xmlItems = allUrls.map(u => `  <url>${u}</url>`).join('\n');
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${xmlItems}
</urlset>`;

  log.info(`[IndexNow] Generated indexnow.xml with ${allUrls.length} URLs`);

  // 仅在 CI 环境中触发 ping
  if (!process.env.CI) {
    log.info('[IndexNow] Skipping ping (not in CI environment)');
    return [{ path: 'indexnow.xml', data: xmlContent }];
  }

  // 推送最近更新的文章（最多 10,000 条，IndexNow 限制）
  const urlsToPing = allUrls.slice(0, 10000);

  for (const pingUrl of pingUrls) {
    try {
      const result = await pingIndexNow(pingUrl, key, urlsToPing);
      if (result.statusCode === 200 || result.statusCode === 202) {
        log.info(`[IndexNow] Ping sent to ${pingUrl}: HTTP ${result.statusCode}`);
      } else {
        log.warn(`[IndexNow] Ping failed for ${pingUrl}: HTTP ${result.statusCode}`);
        if (result.body) {
          log.warn(`[IndexNow] Response: ${result.body}`);
        }
      }
    } catch (e) {
      log.warn(`[IndexNow] Ping error for ${pingUrl}: ${e.message}`);
    }
  }

  return [{ path: 'indexnow.xml', data: xmlContent }];
});
