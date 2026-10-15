/**
 * Front-matter 读写公共工具。
 *
 * 两套互补的操作方式：
 *  - 行级手术（detectEol/findFrontmatterEnd/replaceKeyBlock）：原样保留文件其余部分与
 *    换行风格，适合 keywords/faqs/titles 这类按映射表批量写入的场景；
 *  - YAML 往返（parsePost/savePost）：结构化读取与整体重写，适合 metadata 这类
 *    需要 AI 生成字段再合并回写的场景。
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { ROOT } = require('./env');

const POSTS_DIR = path.join(ROOT, 'source', '_posts');

// ---------- 行级手术 ----------

function detectEol(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

// 定位 front-matter 结束的 `---` 行号（0-based），找不到返回 -1
function findFrontmatterEnd(lines) {
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      count++;
      if (count === 2) return i;
    }
  }
  return -1;
}

// 在 front-matter 内查找顶层的 `key:` 行（trim 后全等），找不到返回 -1
function findKeyIndex(lines, endIdx, key) {
  const target = key + ':';
  for (let i = 0; i < endIdx; i++) {
    if (lines[i].trim() === target) return i;
  }
  return -1;
}

// 查找以 prefix 开头的行（限 front-matter 内），用于 title: 这类行首匹配
function findLineStartsWith(lines, endIdx, prefix) {
  for (let i = 0; i < endIdx; i++) {
    if (lines[i].startsWith(prefix)) return i;
  }
  return -1;
}

/**
 * 替换或插入一个 front-matter 键的块。
 * 已有 key: 行时，替换该行连同其后连续的缩进列表行（- xxx）；没有则插入到 FM 末尾。
 * 返回 'replaced' | 'inserted'。
 */
function replaceKeyBlock(lines, endIdx, key, blockLines) {
  const keyIdx = findKeyIndex(lines, endIdx, key);
  if (keyIdx >= 0) {
    let end = keyIdx + 1;
    while (end < endIdx && /^\s*-\s/.test(lines[end])) end++;
    lines.splice(keyIdx, end - keyIdx, ...blockLines);
    return 'replaced';
  }
  lines.splice(endIdx, 0, ...blockLines);
  return 'inserted';
}

// ---------- YAML 往返 ----------

// 解析文章 front-matter 与正文
function parsePost(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = yaml.load(frontmatterMatch[1]);
  const bodyStart = frontmatterMatch[0].length;
  const body = content.slice(bodyStart).trim();

  return {
    frontmatter,
    body,
    rawContent: content,
    frontmatterStart: 0,
    frontmatterEnd: bodyStart
  };
}

// 保存更新后的文章（保留原换行风格）
function savePost(filePath, frontmatter, body, originalContent) {
  const lineEnding = detectEol(originalContent);

  const newFrontmatter = yaml.dump(frontmatter, {
    lineWidth: -1,
    quotingType: "'",
    forceQuotes: false,
    noRefs: true
  }).trim();

  const newContent = `---${lineEnding}${newFrontmatter.replace(/\n/g, lineEnding)}${lineEnding}---${lineEnding}${body.replace(/\n/g, lineEnding)}`;

  fs.writeFileSync(filePath, newContent, 'utf8');
}

// ---------- 其他公共 ----------

function getAllPosts(postsDir = POSTS_DIR) {
  return fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(postsDir, f));
}

module.exports = {
  ROOT,
  POSTS_DIR,
  detectEol,
  findFrontmatterEnd,
  findKeyIndex,
  findLineStartsWith,
  replaceKeyBlock,
  parsePost,
  savePost,
  getAllPosts,
};
