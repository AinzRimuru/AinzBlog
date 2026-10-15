/**
 * .env 文件加载（零第三方依赖）与公共路径常量。
 */
const fs = require('fs');
const path = require('path');

// tools/lib/ → 仓库根目录
const ROOT = path.join(__dirname, '..', '..');
const ENV_PATH = path.join(ROOT, '.env');

function loadEnv() {
  // CI 环境直接使用进程环境变量（GitHub Actions secrets/vars 注入）
  if (process.env.OPENAI_API_ENDPOINT && process.env.OPENAI_API_KEY && process.env.OPENAI_LLM_MODEL) {
    return {
      OPENAI_API_ENDPOINT: process.env.OPENAI_API_ENDPOINT,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_LLM_MODEL: process.env.OPENAI_LLM_MODEL,
    };
  }

  if (!fs.existsSync(ENV_PATH)) {
    console.error('Error: .env file not found at', ENV_PATH);
    console.error('Please create a .env file with the following variables:');
    console.error('  OPENAI_API_ENDPOINT=<your-api-endpoint>');
    console.error('  OPENAI_API_KEY=<your-api-key>');
    console.error('  OPENAI_LLM_MODEL=<model-id>');
    process.exit(1);
  }

  const envContent = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });

  return env;
}

module.exports = { ROOT, ENV_PATH, loadEnv };
