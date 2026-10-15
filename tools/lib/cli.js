/**
 * 内容类命令（metadata/keywords/faqs/titles）共用的参数解析与文章定位。
 */
const fs = require('fs');
const path = require('path');
const { POSTS_DIR, getAllPosts } = require('./frontmatter');

// 解析通用选项：--file <f> / --all / --dry-run / --force
function parsePostArgs(args) {
  const options = { file: null, all: false, dryRun: false, force: false, valid: true };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file':
        options.file = args[++i];
        if (!options.file) options.valid = false;
        break;
      case '--all':
        options.all = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      default:
        options.valid = false;
    }
  }
  return options;
}

// 定位要处理的文章列表；参数非法时打印 usage 并退出
function resolvePostFiles(options, usageLines) {
  if (!options.valid || (!options.file && !options.all)) {
    (usageLines || []).forEach(l => console.log(l));
    process.exit(1);
  }

  if (options.file) {
    const filePath = path.isAbsolute(options.file)
      ? options.file
      : path.join(POSTS_DIR, options.file);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    return [filePath];
  }
  return getAllPosts();
}

module.exports = { parsePostArgs, resolvePostFiles };
