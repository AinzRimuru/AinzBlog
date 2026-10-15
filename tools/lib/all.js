/**
 * 命令：all —— 一键依次执行全部内容生成命令（metadata → keywords → faqs）。
 *
 * 用法: node tools/generate_metadata.js all [--file <filename>] [--all] [--dry-run] [--force]
 * 选项透传给各子命令；每个子命令独立遵循"已有字段跳过、--force 覆盖"逻辑。
 * gsc 为只读分析工具，不属于内容生成，不包含在内。
 */
const metadata = require('./metadata');
const keywords = require('./keywords');
const faqs = require('./faqs');

async function run(args) {
  console.log('===== 1/3 metadata (description + tags) =====');
  await metadata.run(args);
  console.log('\n===== 2/3 keywords =====');
  await keywords.run(args);
  console.log('\n===== 3/3 faqs =====');
  await faqs.run(args);
  console.log('\n===== all 完成 =====');
}

module.exports = { run };
