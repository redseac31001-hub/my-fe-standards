/**
 * Rule Validator (dependency-free)
 *
 * Validate rule markdown files for basic structural correctness.
 * - Supports repo mode: ./rules
 * - Supports project mode: ./.codebuddy/rules_cache (after codebuddy-loader)
 *
 * Notes:
 * - This is intentionally lightweight and non-blocking by default: it reports issues,
 *   but only exits non-zero when there are "error" issues (or when --strict is used).
 */

import * as fs from 'fs';
import * as path from 'path';

type IssueLevel = 'error' | 'warning';

type Issue = {
  level: IssueLevel;
  file: string; // project-relative, posix
  message: string;
};

type ValidationPayload = {
  ok: boolean;
  rootDir: string;
  checkedFileCount: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  issues: Issue[];
};

type ParsedCli = {
  command: string | null;
  positionals: string[];
  flags: Record<string, string | boolean>;
};

function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function parseCli(args: string[]): ParsedCli {
  const parsed: ParsedCli = { command: null, positionals: [], flags: {} };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    if (!a.startsWith('-') && !parsed.command) {
      parsed.command = a;
      continue;
    }

    if (!a.startsWith('-')) {
      parsed.positionals.push(a);
      continue;
    }

    if (a === '--json') {
      parsed.flags.json = true;
      continue;
    }
    if (a === '--help' || a === '-h') {
      parsed.flags.help = true;
      continue;
    }
    if (a === '--strict') {
      parsed.flags.strict = true;
      continue;
    }
    if ((a === '--dir' || a === '--root') && args[i + 1]) {
      parsed.flags.dir = args[++i];
      continue;
    }

    parsed.flags[a.replace(/^--?/, '')] = true;
  }

  if (!parsed.command) parsed.command = 'check';
  return parsed;
}

function showHelp(): void {
  console.log(`
Rule Validator - 规则 Markdown 基础校验

用法:
  node .codebuddy/scripts/rule-validator.js [command] [options]

命令:
  check                        校验规则（默认）

选项:
  --dir, --root <path>         规则目录（默认: ./rules 或 ./.codebuddy/rules_cache 自动探测）
  --json                       输出 JSON
  --strict                     存在 error 时 exit=1（默认也是如此；保留该开关便于对齐其它脚本）
  --help, -h                   显示帮助
`.trim());
}

function readText(filePath: string): { ok: true; data: string } | { ok: false; error: string } {
  try {
    return { ok: true, data: fs.readFileSync(filePath, 'utf-8') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function listMarkdownFiles(rootDir: string): string[] {
  const out: string[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === '_meta') continue;
        if (e.name === 'node_modules') continue;
        if (e.name === '.git') continue;
        walk(full);
        continue;
      }
      if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        out.push(full);
      }
    }
  }

  walk(rootDir);
  return out;
}

function parseFrontmatter(md: string): { ok: true; frontmatter: string | null } | { ok: false; error: string } {
  const normalized = md.replace(/^\uFEFF/, ''); // strip BOM if present

  if (!normalized.startsWith('---')) return { ok: true, frontmatter: null };

  const m = normalized.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  if (!m) return { ok: false, error: 'YAML frontmatter 未闭合（缺少结束 ---）' };
  return { ok: true, frontmatter: m[1] };
}

function parseSimpleYamlObject(yaml: string): Record<string, string> {
  const obj: Record<string, string> = {};
  const lines = yaml.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    obj[key] = val;
  }
  return obj;
}

function hasYamlKey(yaml: string, key: string): boolean {
  const pattern = new RegExp(`^${key}\\s*:`, 'm');
  return pattern.test(yaml);
}

function extractBlockquoteMetadata(raw: string, key: string): string {
  const pattern = new RegExp(`^>\\s*${key}:\\s*(.+)$`, 'im');
  const match = raw.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function validatePriorityValue(value: string, file: string): Issue | null {
  if (!value) return null;
  if (/\b(critical|high|medium|low)\b/i.test(value)) return null;
  return {
    level: 'warning',
    file,
    message: `priority 建议使用 Critical/High/Medium/Low 之一，当前为: ${value}`,
  };
}

function detectDefaultRulesDir(cwd: string): string | null {
  const candidates = [
    path.join(cwd, 'rules'),
    path.join(cwd, '.codebuddy', 'rules_cache'),
    path.join(cwd, '.codebuddy', 'rules'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch {
      // ignore
    }
  }
  return null;
}

function validateRuleFile(filePath: string, rootDir: string): Issue[] {
  const issues: Issue[] = [];
  const rel = toPosixPath(path.relative(process.cwd(), filePath));

  const read = readText(filePath);
  if (!read.ok) {
    issues.push({ level: 'error', file: rel, message: `读取失败: ${read.error}` });
    return issues;
  }

  const raw = read.data;

  const fm = parseFrontmatter(raw);
  if (!fm.ok) {
    issues.push({ level: 'error', file: rel, message: fm.error });
    return issues;
  }

  if (fm.frontmatter) {
    const meta = parseSimpleYamlObject(fm.frontmatter);
    const name = (meta.name ?? '').trim();
    const description = (meta.description ?? '').trim();
    if (!name) issues.push({ level: 'error', file: rel, message: 'frontmatter 缺少 name' });
    if (!description) issues.push({ level: 'error', file: rel, message: 'frontmatter 缺少 description' });

    const hasTags = hasYamlKey(fm.frontmatter, 'tags');
    const hasPriority = hasYamlKey(fm.frontmatter, 'priority');
    const hasAlwaysApply = hasYamlKey(fm.frontmatter, 'alwaysApply');
    if (!hasTags) {
      issues.push({ level: 'warning', file: rel, message: 'frontmatter 建议补充 tags，便于统一规则索引与路由' });
    }
    if (!hasPriority) {
      issues.push({ level: 'warning', file: rel, message: 'frontmatter 建议补充 priority，便于统一规则排序与治理' });
    }
    if (!hasAlwaysApply) {
      issues.push({ level: 'warning', file: rel, message: 'frontmatter 建议显式声明 alwaysApply，便于后续统一规则规范' });
    }

    const priorityIssue = validatePriorityValue((meta.priority ?? '').trim(), rel);
    if (priorityIssue) issues.push(priorityIssue);
  } else {
    const tags = extractBlockquoteMetadata(raw, 'Tags');
    const priority = extractBlockquoteMetadata(raw, 'Priority');
    if (!tags) {
      issues.push({ level: 'warning', file: rel, message: '建议补充 > Tags: 元数据，便于规则检索与分层治理' });
    }
    if (!priority) {
      issues.push({ level: 'warning', file: rel, message: '建议补充 > Priority: 元数据，便于规则排序与裁剪' });
    } else {
      const priorityIssue = validatePriorityValue(priority, rel);
      if (priorityIssue) issues.push(priorityIssue);
    }
  }

  // Code fences should be balanced.
  const fenceMatches = raw.match(/^```/gm) ?? [];
  if (fenceMatches.length % 2 !== 0) {
    issues.push({ level: 'error', file: rel, message: '存在未闭合的代码块（``` 数量为奇数）' });
  }

  const hasLeveled = /<!--\s*@level:/i.test(raw);
  if (hasLeveled) {
    const hasSummary = /<!--\s*@level:summary\s*-->/i.test(raw);
    const hasQuick = /<!--\s*@level:quick\s*-->/i.test(raw);
    const hasFull = /<!--\s*@level:full\s*-->/i.test(raw);
    if (!hasSummary) issues.push({ level: 'warning', file: rel, message: '缺少 @level:summary 分段标记' });
    if (!hasQuick) issues.push({ level: 'warning', file: rel, message: '缺少 @level:quick 分段标记' });
    if (!hasFull) issues.push({ level: 'warning', file: rel, message: '缺少 @level:full 分段标记' });
    return issues;
  }

  // Classic template checks (non-leveled files).
  const hasContext = /^##+\s+.*(Context|背景与适用范围|背景)/im.test(raw);
  const hasRule = /^##+\s+.*(The Rule|规则详情)/im.test(raw);
  const hasReasoning = /^##+\s+.*(Reasoning|核心原理|原理)/im.test(raw);
  const hasExamples = /^##+\s+.*(Examples|代码示例)/im.test(raw);

  if (!hasContext) issues.push({ level: 'warning', file: rel, message: '未检测到 Context/背景 段落标题（建议包含）' });
  if (!hasRule) issues.push({ level: 'warning', file: rel, message: '未检测到 The Rule/规则详情 段落标题（建议包含）' });
  if (!hasReasoning) issues.push({ level: 'warning', file: rel, message: '未检测到 Reasoning/原理 段落标题（建议包含）' });
  if (!hasExamples) issues.push({ level: 'warning', file: rel, message: '未检测到 Examples/代码示例 段落标题（建议包含）' });

  // Light sanity: ensure the file is under the chosen root (helps when users pass a wrong dir).
  const absRoot = path.resolve(rootDir);
  const absFile = path.resolve(filePath);
  if (!absFile.startsWith(absRoot)) {
    issues.push({ level: 'warning', file: rel, message: `文件不在 rootDir 范围内: root=${toPosixPath(absRoot)}` });
  }

  return issues;
}

export function validateRulesDir(rootDir: string): ValidationPayload {
  const files = listMarkdownFiles(rootDir);
  const issues: Issue[] = [];
  for (const f of files) {
    issues.push(...validateRuleFile(f, rootDir));
  }

  const errorCount = issues.filter(i => i.level === 'error').length;
  const warningCount = issues.filter(i => i.level === 'warning').length;

  return {
    ok: errorCount === 0,
    rootDir: toPosixPath(path.relative(process.cwd(), rootDir) || '.'),
    checkedFileCount: files.length,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues,
  };
}

function main(): void {
  const parsed = parseCli(process.argv.slice(2));

  if (parsed.flags.help || parsed.command === 'help') {
    showHelp();
    process.exit(0);
  }

  if (parsed.command !== 'check') {
    console.error(`错误: 未知命令: ${parsed.command}`);
    showHelp();
    process.exit(1);
  }

  const json = Boolean(parsed.flags.json);
  const strict = Boolean(parsed.flags.strict);
  const dirFlag = typeof parsed.flags.dir === 'string' ? parsed.flags.dir : null;
  const rootDir = dirFlag ? path.resolve(process.cwd(), dirFlag) : detectDefaultRulesDir(process.cwd());

  if (!rootDir) {
    const msg = '未找到规则目录（期望 ./rules 或 ./.codebuddy/rules_cache）。请使用 --dir 指定。';
    if (json) {
      console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
    } else {
      console.error(`错误: ${msg}`);
    }
    process.exit(1);
  }

  const payload = validateRulesDir(rootDir);

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[rule-validator] root: ${payload.rootDir}`);
    console.log(`[rule-validator] checked: ${payload.checkedFileCount}, errors: ${payload.errorCount}, warnings: ${payload.warningCount}`);
    for (const it of payload.issues) {
      const prefix = it.level === 'error' ? 'ERROR' : 'WARN';
      console.log(`- ${prefix} ${it.file}: ${it.message}`);
    }
  }

  if (strict && payload.errorCount > 0) process.exit(1);
  if (!strict && payload.errorCount > 0) process.exit(1);
}

if (require.main === module) {
  main();
}
