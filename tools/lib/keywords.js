/**
 * 命令：keywords —— 用 LLM 为文章生成 SEO keywords（front-matter 的 keywords 字段）。
 *
 * 用法: node tools/generate_metadata.js keywords [--file <filename>] [--all] [--dry-run] [--force]
 * 逻辑与 metadata 一致：已有 keywords 的文章跳过，--force 才覆盖。
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./env');
const { detectEol, findFrontmatterEnd, findKeyIndex, replaceKeyBlock, parsePost } = require('./frontmatter');
const { chatJson, buildPostContext } = require('./llm');
const { parsePostArgs, resolvePostFiles } = require('./cli');

const SYSTEM = '你是一个专业的博客SEO专家，专注于中文技术博客的搜索关键词优化。请只返回JSON格式的结果。';

function buildPrompt(context) {
  return `请分析以下博客文章，结合中文搜索生态（知乎/CSDN/搜索引擎的相关搜索与用户提问习惯）生成 SEO keywords。

${context.slice(0, 6000)}

要求：
1. 生成 6-10 个关键词：核心关键词 + 真实长尾搜索变体（中英文按主题自然混合）
2. 使用真实用户会输入的搜索词形，避免生造词和泛词堆砌
3. 与文章内容强相关，能准确概括文章解决的问题

请以JSON格式返回：{"keywords": ["关键词1", "关键词2", ...]}
不要输出任何其他内容，不要使用markdown代码块包裹。`;
}

function buildBlock(kws) {
  return ['keywords:'].concat(kws.map(k => '  - "' + String(k).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'));
}

async function run(args) {
  const options = parsePostArgs(args);
  const files = resolvePostFiles(options, [
    'Usage: node tools/generate_metadata.js keywords [--file <filename>] [--all] [--dry-run] [--force]',
    '',
    'Options:',
    '  --file <filename>  Process a specific post file',
    '  --all              Process all posts',
    '  --dry-run          Preview changes without writing to files',
    '  --force            Overwrite existing keywords',
  ]);

  console.log('=== SEO Keywords Generator (LLM) ===');
  if (options.dryRun) console.log('Mode: DRY RUN (no files will be modified)');
  if (options.force) console.log('Mode: FORCE (will overwrite existing keywords)');

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

    if (findKeyIndex(lines, closeIdx, 'keywords') >= 0 && !options.force) {
      console.log('  Skipping: Already has keywords');
      skipped++; continue;
    }

    try {
      const post = parsePost(filePath);
      const result = await chatJson(env, { system: SYSTEM, user: buildPrompt(buildPostContext(post, fileName)) });
      const kws = (result.keywords || []).map(k => String(k).trim()).filter(Boolean);
      if (kws.length === 0) { console.log('  Error: no keywords returned'); errors++; continue; }

      replaceKeyBlock(lines, closeIdx, 'keywords', buildBlock(kws));
      console.log('  Keywords: ' + kws.join(', '));

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
