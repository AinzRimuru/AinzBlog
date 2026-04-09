/**
 * Google Indexing API 集成
 * Docs: https://developers.google.com/webmaster-tools/v3/api-reference/rest/v3/urlNotifications/publish
 *
 * 功能：
 * 1. 构建时自动向 Google Indexing API 推送最近更新的文章 URL
 * 2. 使用 Service Account JWT 认证（零依赖）
 */

const https = require('https');
const crypto = require('crypto');

function base64urlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const encodedHeader = base64urlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64urlEncode(Buffer.from(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(serviceAccount.private_key);

  return `${unsignedToken}.${base64urlEncode(signature)}`;
}

function getAccessToken(serviceAccount) {
  return new Promise((resolve, reject) => {
    const jwt = createJwt(serviceAccount);
    const postData = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(jwt)}`;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      hostname: 'oauth2.googleapis.com',
      path: '/token'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.access_token);
          } catch (e) {
            reject(new Error(`Failed to parse token response: ${e.message}`));
          }
        } else {
          reject(new Error(`Token request failed: HTTP ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

function publishUrl(accessToken, url) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      url: url,
      type: 'URL_UPDATED'
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      hostname: 'indexing.googleapis.com',
      path: '/v3/urlNotifications:publish'
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

hexo.extend.generator.register('google-indexing', async function(locals) {
  const log = hexo.log || console;
  const config = hexo.config.google_indexing;

  if (!config || !config.enable) {
    return [];
  }

  // 仅在 CI 环境中执行
  if (!process.env.CI) {
    log.info('[Google Indexing] Skipping (not in CI environment)');
    return [];
  }

  // 检查 Service Account 密钥
  const saKeyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!saKeyBase64) {
    log.warn('[Google Indexing] GOOGLE_SERVICE_ACCOUNT_KEY env var not set, skipping');
    return [];
  }

  let serviceAccount;
  try {
    const saKeyJson = Buffer.from(saKeyBase64, 'base64').toString('utf-8');
    serviceAccount = JSON.parse(saKeyJson);
  } catch (e) {
    log.error('[Google Indexing] Failed to parse service account key');
    return [];
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    log.error('[Google Indexing] Service account key is missing client_email or private_key');
    return [];
  }

  // 获取所有已发布文章的 URL
  const posts = locals.posts.sort('-updated').toArray();
  const allUrls = posts.map(post => post.permalink.replace(/\/index\.html$/, '/'));

  // Google Indexing API 每日配额 200 次
  const maxUrls = config.max_urls || 200;
  const urlsToIndex = allUrls.slice(0, maxUrls);

  log.info(`[Google Indexing] Processing ${urlsToIndex.length} URLs...`);

  try {
    const accessToken = await getAccessToken(serviceAccount);
    log.info('[Google Indexing] Obtained access token');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urlsToIndex.length; i++) {
      const result = await publishUrl(accessToken, urlsToIndex[i]);
      if (result.statusCode === 200) {
        successCount++;
      } else {
        failCount++;
        log.warn(`[Google Indexing] Failed for ${urlsToIndex[i]}: HTTP ${result.statusCode}`);
      }
      // 间隔 100ms 防止触发限流
      if (i < urlsToIndex.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    log.info(`[Google Indexing] Done: ${successCount} succeeded, ${failCount} failed`);
  } catch (e) {
    log.error('[Google Indexing] Error: check configuration and service account permissions');
  }

  return [];
});
