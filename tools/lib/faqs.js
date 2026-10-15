/**
 * 命令：faqs —— 用 LLM 为文章生成 FAQ 结构化数据（配合主题 FAQ 区块 + FAQPage JSON-LD）。
 *
 * 用法: node tools/generate_metadata.js faqs [--file <filename>] [--all] [--dry-run] [--force]
 * 逻辑与 metadata 一致：已有 faqs 的文章跳过，--force 才覆盖。
 * 答案由模型锚定文章正文生成，提示词中明确禁止编造文中没有的结论。
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./env');
const { detectEol, findFrontmatterEnd, findKeyIndex, replaceKeyBlock, parsePost } = require('./frontmatter');
const { chatJson, buildPostContext } = require('./llm');
const { parsePostArgs, resolvePostFiles } = require('./cli');

const SYSTEM = '你是一个专业的博客SEO专家，擅长基于文章内容提炼FAQ结构化数据。请只返回JSON格式的结果。';

function buildPrompt(context) {
  return `请基于以下博客文章内容，生成用于 FAQPage 结构化数据的常见问答。

${context.slice(0, 6000)}

要求：
1. 生成 2-4 条问答，问题采用真实搜索长尾词形（想象用户会怎么在搜索引擎提问）
2. 答案必须严格来自文章正文的信息，不得编造或引入文中没有的结论
3. 每条答案 50-120 字，直接给出结论和关键做法，口语化但准确
4. 优先覆盖文章能真正回答的问题，不要凑数

请以JSON格式返回：{"faqs": [{"q": "问题", "a": "答案"}, ...]}
不要输出任何其他内容，不要使用markdown代码块包裹。`;
}

// 转义为 YAML 双引号字符串安全的形态（反斜杠必须先转义，否则 \K 等会成为非法转义序列）
function yamlEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildBlock(faqs) {
  return ['faqs:'].concat(faqs.map(f => [
    '  - q: "' + yamlEscape(f.q) + '"',
    '    a: "' + yamlEscape(f.a) + '"',
  ]).flat());
}

async function run(args) {
  const options = parsePostArgs(args);
  const files = resolvePostFiles(options, [
    'Usage: node tools/generate_metadata.js faqs [--file <filename>] [--all] [--dry-run] [--force]',
    '',
    'Options:',
    '  --file <filename>  Process a specific post file',
    '  --all              Process all posts',
    '  --dry-run          Preview changes without writing to files',
    '  --force            Overwrite existing faqs',
  ]);

  console.log('=== FAQ Generator (LLM) ===');
  if (options.dryRun) console.log('Mode: DRY RUN (no files will be modified)');
  if (options.force) console.log('Mode: FORCE (will overwrite existing faqs)');

  const env = loadEnv();
  console.log(`Model: ${env.OPENAI_LLM_MODEL}`);
  console.log(`Files to process: ${files.length}`);

  let updated = 0, skipped = 0, errors = 0;
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = path.basename(filePath);
    console.log(`\nProcessing: ${fileName}`);

    const content = fs.readFileSync(filePath, 'utf8');
    const eol = detectEol(content);
    const lines = content.split(eol);
    const closeIdx = findFrontmatterEnd(lines);
    if (closeIdx === -1) { console.log('  Skipping: Invalid frontmatter'); skipped++; continue; }

    if (findKeyIndex(lines, closeIdx, 'faqs') >= 0 && !options.force) {
      console.log('  Skipping: Already has faqs');
      skipped++; continue;
    }

    try {
      const post = parsePost(filePath);
      const result = await chatJson(env, { system: SYSTEM, user: buildPrompt(buildPostContext(post, fileName)) });
      const faqs = (result.faqs || []).filter(f => f && f.q && f.a);
      if (faqs.length === 0) { console.log('  Error: no faqs returned'); errors++; continue; }

      console.log('  FAQs:');
      faqs.forEach(f => console.log(`    - ${f.q}`));

      replaceKeyBlock(lines, closeIdx, 'faqs', buildBlock(faqs));
      if (!options.dryRun) {
        fs.writeFileSync(filePath, lines.join(eol), 'utf8');
        console.log('  Saved!');
      } else {
        console.log('  (Dry run - not saved)');
      }
      updated++;
    } catch (error) {
      console.error(`  Error processing:`, error.message);
      errors++;
    }

    // 仅在真正触发了模型调用时才延时，避免限流
    if (i < files.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

module.exports = { run };
