/**
 * 命令：metadata —— AI 生成/补全文章的 description 与 tags。
 *
 * 用法（可省略命令名，保持向后兼容）:
 *   node tools/generate_metadata.js [--file <filename>] [--all] [--dry-run] [--force]
 *
 * 环境变量（.env）:
 *   OPENAI_API_ENDPOINT / OPENAI_API_KEY / OPENAI_LLM_MODEL
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { ROOT, loadEnv } = require('./env');
const { parsePost, savePost } = require('./frontmatter');
const { chatJson, buildPostContext } = require('./llm');
const { parsePostArgs, resolvePostFiles } = require('./cli');

// 读取现有标签池（优先 tag_map 独立配置文件）
function getExistingTags() {
  const candidates = ['_config.tag_map.yml', '_config.yml'];
  for (const name of candidates) {
    const configPath = path.join(ROOT, name);
    if (!fs.existsSync(configPath)) continue;
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    const tagMap = (config && config.tag_map) || {};
    const keys = Object.keys(tagMap);
    if (keys.length > 0) return keys;
  }
  return [];
}

// 构造提示词并调用 LLM
async function generateMetadata(env, postContent, existingTags, needDescription, needTags) {
  const existingTagsList = existingTags.join(', ');

  let prompt = `你是一个专业的博客SEO专家。请分析以下博客文章内容，并提供元数据。

现有的可用标签列表：
${existingTagsList}

博客文章内容：
${postContent.slice(0, 6000)}  <!-- 截断以避免token过多 -->

请以JSON格式返回结果，包含以下字段：
`;

  if (needDescription) {
    prompt += `
- "description": 一个简洁的SEO友好描述（50-150字），准确概括文章主题和核心内容，吸引用户点击。`;
  }

  if (needTags) {
    prompt += `
- "matchedTags": 从现有标签列表中选择最相关的标签（数组形式）
- "suggestedNewTags": 如果现有标签不够描述文章内容，建议的新标签（数组形式，仅在必要时添加，尽量控制在1-3个）`;
  }

  prompt += `

注意事项：
1. 标签应该精确反映文章的技术栈、主题和关键概念
2. 优先使用现有标签，只有在现有标签明显不够时才建议新标签
3. 新建议的标签应该是有价值的、可复用的，避免过于具体或一次性的标签
4. description 应该包含文章的关键词，便于搜索引擎优化

请直接输出JSON，不要输出任何其他内容，不要使用markdown代码块包裹。`;

  return chatJson(env, {
    system: '你是一个专业的博客SEO专家，专注于技术博客的元数据优化。请只返回JSON格式的结果。',
    user: prompt,
    temperature: 0.7
  });
}

// 处理单篇文章
async function processPost(filePath, env, existingTags, options) {
  const fileName = path.basename(filePath);
  console.log(`\nProcessing: ${fileName}`);

  const post = parsePost(filePath);
  if (!post) {
    console.log(`  Skipping: Invalid frontmatter`);
    return { status: 'skipped', reason: 'invalid frontmatter' };
  }

  const needDescription = !post.frontmatter.description || options.force;
  const needTags = !post.frontmatter.tags || post.frontmatter.tags.length === 0 || options.force;

  if (!needDescription && !needTags) {
    console.log(`  Skipping: Already has description and tags`);
    return { status: 'skipped', reason: 'already complete' };
  }

  console.log(`  Need description: ${needDescription}, Need tags: ${needTags}`);

  // Build content for analysis
  const contentForAnalysis = buildPostContext(post, fileName);

  try {
    const result = await generateMetadata(env, contentForAnalysis, existingTags, needDescription, needTags);
    console.log(`  AI Response:`, JSON.stringify(result, null, 2));

    // Apply changes
    const newFrontmatter = { ...post.frontmatter };
    const changes = [];

    if (needDescription && result.description) {
      newFrontmatter.description = result.description;
      changes.push(`description: "${result.description}"`);
    }

    if (needTags) {
      const allTags = [
        ...(result.matchedTags || []),
        ...(result.suggestedNewTags || [])
      ];

      if (allTags.length > 0) {
        // Merge with existing tags if not forcing
        if (!options.force && post.frontmatter.tags) {
          const existingPostTags = Array.isArray(post.frontmatter.tags)
            ? post.frontmatter.tags
            : [post.frontmatter.tags];
          const mergedTags = [...new Set([...existingPostTags, ...allTags])];
          newFrontmatter.tags = mergedTags;
        } else {
          newFrontmatter.tags = allTags;
        }
        changes.push(`tags: [${newFrontmatter.tags.join(', ')}]`);

        if (result.suggestedNewTags && result.suggestedNewTags.length > 0) {
          console.log(`  New tags suggested: ${result.suggestedNewTags.join(', ')}`);
          console.log(`  (These will be added to tag_map when sync_tags runs)`);
        }
      }
    }

    if (changes.length === 0) {
      console.log(`  No changes needed`);
      return { status: 'unchanged' };
    }

    console.log(`  Changes:`);
    changes.forEach(c => console.log(`    - ${c}`));

    if (!options.dryRun) {
      savePost(filePath, newFrontmatter, post.body, post.rawContent);
      console.log(`  Saved!`);
    } else {
      console.log(`  (Dry run - not saved)`);
    }

    return {
      status: 'updated',
      changes,
      newTags: result.suggestedNewTags || []
    };

  } catch (error) {
    console.error(`  Error processing:`, error.message);
    return { status: 'error', error: error.message };
  }
}

async function run(args) {
  const options = parsePostArgs(args);
  const filesToProcess = resolvePostFiles(options, [
    'Usage: node tools/generate_metadata.js metadata [--file <filename>] [--all] [--dry-run] [--force]',
    '',
    'Options:',
    '  --file <filename>  Process a specific post file',
    '  --all              Process all posts',
    '  --dry-run          Preview changes without writing to files',
    '  --force            Overwrite existing description/tags',
  ]);

  console.log('=== AI Blog Metadata Generator ===');
  if (options.dryRun) {
    console.log('Mode: DRY RUN (no files will be modified)');
  }
  if (options.force) {
    console.log('Mode: FORCE (will overwrite existing metadata)');
  }

  // Load environment
  const env = loadEnv();
  console.log(`API Endpoint: ${env.OPENAI_API_ENDPOINT}`);
  console.log(`Model: ${env.OPENAI_LLM_MODEL}`);

  // Load existing tags from config
  const existingTags = getExistingTags();
  console.log(`Existing tags: ${existingTags.length} tags found`);

  // Determine which files to process
  console.log(`Files to process: ${filesToProcess.length}`);

  // Process files
  const results = {
    updated: 0,
    skipped: 0,
    errors: 0,
    newTags: new Set()
  };

  for (const filePath of filesToProcess) {
    const result = await processPost(filePath, env, existingTags, options);

    if (result.status === 'updated') {
      results.updated++;
      if (result.newTags) {
        result.newTags.forEach(t => {
          results.newTags.add(t);
          // Dynamically add new tags to existingTags so subsequent posts can reference them
          if (!existingTags.includes(t)) {
            existingTags.push(t);
          }
        });
      }
    } else if (result.status === 'error') {
      results.errors++;
    } else {
      results.skipped++;
    }

    // Add a small delay between API calls to avoid rate limiting.
    // 仅在本次真正触发了模型调用时才延时：被 skip 的文章没有产生 API 请求，无需等待。
    if (result.status !== 'skipped' && filesToProcess.indexOf(filePath) < filesToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Updated: ${results.updated}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Errors: ${results.errors}`);

  if (results.newTags.size > 0) {
    console.log(`\nNew tags added: ${[...results.newTags].join(', ')}`);
    console.log('\nDon\'t forget to run sync_tags to add new tags to tag_map:');
    console.log('  npx hexo sync-tags');
  }
}

module.exports = { run };
