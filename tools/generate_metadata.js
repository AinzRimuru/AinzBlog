/**
 * 博客维护工具集（统一入口）。
 *
 * 用法: node tools/generate_metadata.js <command> [options]
 *
 * 命令（除 gsc 外均由 LLM 驱动，支持 [--file <f>] [--all] [--dry-run] [--force]，
 *       跳过已有对应字段的文章，--force 覆盖）:
 *   metadata  AI 生成/补全文章 description 与 tags（默认命令，可省略命令名）
 *   keywords  AI 生成文章 SEO keywords
 *   faqs      AI 生成 FAQ 结构化数据（答案锤定文章内容）
 *   gsc       Google Search Console 报告/诊断（只读为主）
 *             [--list] [--days N] [--json <file>] [--site <url>]
 *             [--submit-sitemap [url]] [--inspect [url...]]
 *   all       一键依次执行 metadata → keywords → faqs（gsc 不含在内）
 *
 * 别名: meta=metadata, kw=keywords, faq=faqs
 *
 * 各命令实现位于 tools/lib/，公共工具见 tools/lib/{env,frontmatter,llm,cli}.js。
 * 兼容旧用法：node tools/generate_metadata.js --all 等价于 metadata --all。
 */
const COMMANDS = {
  all: require('./lib/all'),
  metadata: require('./lib/metadata'),
  keywords: require('./lib/keywords'),
  faqs: require('./lib/faqs'),
  gsc: require('./lib/gsc'),
};

const ALIASES = {
  meta: 'metadata',
  kw: 'keywords',
  faq: 'faqs',
};

function printHelp() {
  console.log('Usage: node tools/generate_metadata.js <command> [options]');
  console.log('');
  console.log('Commands:');
  Object.keys(COMMANDS).forEach(c => console.log('  ' + c));
  console.log('');
  console.log('Run a command without options for its own usage, e.g.:');
  console.log('  node tools/generate_metadata.js metadata');
}

(async () => {
  const argv = process.argv.slice(2);

  // 第一个非 `-` 开头的参数视为命令名（省略时默认 metadata，保持向后兼容）
  let name = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'metadata';
  let rest = argv;
  if (name !== 'metadata') {
    rest = argv.slice(1);
    if (ALIASES[name]) name = ALIASES[name];
  }

  const cmd = COMMANDS[name];
  if (!cmd) {
    console.error(`Unknown command: ${name}\n`);
    printHelp();
    process.exit(1);
  }

  await cmd.run(rest);
})().catch(e => { console.error(e); process.exit(1); });
