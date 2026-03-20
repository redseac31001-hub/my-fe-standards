/**
 * Repo State Validator (dependency-free)
 *
 * Validate repository fact sources for minimum handoff/review continuity.
 * - Designed for repository mode only (not business-project installs)
 * - By default stays warning-tolerant and exits non-zero only on "error" issues
 * - With --strict, warnings are promoted to a release gate
 */

import * as fs from 'fs';
import * as path from 'path';

type IssueLevel = 'error' | 'warning';

type Issue = {
  level: IssueLevel;
  file: string;
  message: string;
};

type ValidationPayload = {
  ok: boolean;
  rootDir: string;
  checkedFileCount: number;
  checkedRuleCount: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  issues: Issue[];
};

type ValidationReport = ValidationPayload & {
  strictMode: boolean;
  effectiveOk: boolean;
};

type ParsedCli = {
  command: string | null;
  positionals: string[];
  flags: Record<string, string | boolean>;
};

type ValidationOptions = {
  now?: Date;
};

type RequiredFileCheck = {
  file: string;
  purpose: string;
};

type RequiredTextCheck = {
  file: string;
  expectedText: string;
  message: string;
};

type RequiredPatternCheck = {
  file: string;
  pattern: RegExp;
  message: string;
};

type FreshnessCheck = {
  file: string;
  thresholdDays: number;
  extractor: (text: string) => string | null;
  missingDateMessage: string;
};

const REQUIRED_FILES: RequiredFileCheck[] = [
  { file: 'README.md', purpose: 'repo entrypoint' },
  { file: 'PROJECT.md', purpose: 'capability truth source' },
  { file: 'ROADMAP.md', purpose: 'execution status and priority' },
  { file: 'docs/README.md', purpose: 'documentation index' },
  { file: 'docs/guides/HANDOFF.md', purpose: 'handoff and next-step source' },
  { file: 'docs/guides/team-collaboration-protocol.md', purpose: 'team collaboration protocol' },
  { file: 'docs/reference/architecture-constraints.md', purpose: 'compatibility boundaries' },
];

const REQUIRED_TEXT_CHECKS: RequiredTextCheck[] = [
  {
    file: 'README.md',
    expectedText: '(./docs/README.md)',
    message: 'README 应链接 docs 索引，便于团队成员从仓库入口找到事实源',
  },
  {
    file: 'README.md',
    expectedText: '(./docs/guides/team-collaboration-protocol.md)',
    message: 'README 应链接团队协作协议，便于 AI 和团队成员读取标准接手规则',
  },
  {
    file: 'README.md',
    expectedText: '(./docs/guides/HANDOFF.md)',
    message: 'README 应链接 handoff 文档，便于快速读取当前进度',
  },
  {
    file: 'docs/README.md',
    expectedText: '(./guides/HANDOFF.md)',
    message: 'docs/README 应链接 Handoff',
  },
  {
    file: 'docs/README.md',
    expectedText: '(./guides/team-collaboration-protocol.md)',
    message: 'docs/README 应链接 Team Collaboration Protocol',
  },
  {
    file: 'docs/guides/HANDOFF.md',
    expectedText: 'docs/guides/team-collaboration-protocol.md',
    message: 'Handoff 应提示接手者先读 Team Collaboration Protocol',
  },
  {
    file: 'docs/guides/team-collaboration-protocol.md',
    expectedText: './HANDOFF.md',
    message: 'Team Collaboration Protocol 应引用 Handoff 作为事实源',
  },
  {
    file: 'docs/guides/team-collaboration-protocol.md',
    expectedText: '../../ROADMAP.md',
    message: 'Team Collaboration Protocol 应引用 Roadmap 作为事实源',
  },
  {
    file: 'docs/guides/team-collaboration-protocol.md',
    expectedText: '../../README.md',
    message: 'Team Collaboration Protocol 应引用 README 作为事实源',
  },
];

const REQUIRED_PATTERN_CHECKS: RequiredPatternCheck[] = [
  {
    file: 'ROADMAP.md',
    pattern: /^##\s+Current Snapshot\s*$/m,
    message: 'ROADMAP 应包含 Current Snapshot 段落',
  },
  {
    file: 'ROADMAP.md',
    pattern: /^\| Item \| Status \| Priority \| Estimate \| Goal \| Next Action \|$/m,
    message: 'ROADMAP 应包含 Current Snapshot 表头',
  },
  {
    file: 'docs/guides/HANDOFF.md',
    pattern: /^##\s+1\)\s+当前状态/m,
    message: 'HANDOFF 应包含 “当前状态” 段落',
  },
  {
    file: 'docs/guides/HANDOFF.md',
    pattern: /^##\s+5\)\s+下一步建议/m,
    message: 'HANDOFF 应包含 “下一步建议” 段落',
  },
  {
    file: 'docs/guides/team-collaboration-protocol.md',
    pattern: /^##\s+Canonical Sources\s*$/m,
    message: 'Team Collaboration Protocol 应包含 Canonical Sources 段落',
  },
  {
    file: 'docs/guides/team-collaboration-protocol.md',
    pattern: /^##\s+Standard AI Session Bootstrap\s*$/m,
    message: 'Team Collaboration Protocol 应包含 Standard AI Session Bootstrap 段落',
  },
];

const FRESHNESS_CHECKS: FreshnessCheck[] = [
  {
    file: 'ROADMAP.md',
    thresholdDays: 7,
    extractor: extractLastUpdatedDate,
    missingDateMessage: 'ROADMAP 缺少 > Last updated: 日期，无法判断路线图是否过期',
  },
  {
    file: 'docs/README.md',
    thresholdDays: 14,
    extractor: extractLastUpdatedDate,
    missingDateMessage: 'docs/README 缺少 > Last updated: 日期，无法判断文档索引是否过期',
  },
  {
    file: 'docs/guides/team-collaboration-protocol.md',
    thresholdDays: 14,
    extractor: extractLastUpdatedDate,
    missingDateMessage: 'Team Collaboration Protocol 缺少 > Last updated: 日期，无法判断团队协作规则是否过期',
  },
  {
    file: 'docs/guides/HANDOFF.md',
    thresholdDays: 14,
    extractor: extractLatestDateFromText,
    missingDateMessage: 'HANDOFF 未检测到任何日期，无法判断交接信息是否过期',
  },
];

const REPOSITORY_ROOT_SENTINELS = [
  'README.md',
  'ROADMAP.md',
  'PROJECT.md',
  'docs/guides/HANDOFF.md',
  'docs/guides/team-collaboration-protocol.md',
];

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
Repo State Validator - 仓库事实源一致性校验

用法:
  node scripts/dist/repo-state-validator.js [command] [options]

命令:
  check                        校验仓库事实源（默认）

选项:
  --dir, --root <path>         仓库根目录（默认: 当前目录）
  --json                       输出 JSON
  --strict                     存在 warning/error 时 exit=1；默认仅 error 才 exit=1
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

function resolveRepoFile(rootDir: string, relativePath: string): string {
  return path.join(rootDir, ...relativePath.split('/'));
}

function formatRelativeToCwd(filePath: string): string {
  return toPosixPath(path.relative(process.cwd(), filePath) || path.basename(filePath));
}

function extractLastUpdatedDate(text: string): string | null {
  const match = text.match(/^>\s*Last updated:\s*(\d{4}-\d{2}-\d{2})\s*$/im);
  return match?.[1] ?? null;
}

function extractLatestDateFromText(text: string): string | null {
  const matches = Array.from(text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g), (match) => match[0]);
  if (matches.length === 0) return null;
  return matches.sort().at(-1) ?? null;
}

function parseDateOnly(dateText: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const stamp = Date.parse(`${dateText}T00:00:00Z`);
  return Number.isFinite(stamp) ? stamp : null;
}

function calculateAgeDays(dateText: string, now: Date): number | null {
  const target = parseDateOnly(dateText);
  if (target === null) return null;
  const nowStamp = parseDateOnly(now.toISOString().slice(0, 10));
  if (nowStamp === null) return null;
  return Math.floor((nowStamp - target) / 86400000);
}

export function looksLikeRepositoryFactRoot(rootDir: string): boolean {
  return REPOSITORY_ROOT_SENTINELS.every((relativePath) => fs.existsSync(resolveRepoFile(rootDir, relativePath)));
}

export function validateRepoStateRoot(rootDir: string, options: ValidationOptions = {}): ValidationPayload {
  const issues: Issue[] = [];
  const now = options.now ?? new Date();
  const checkedTexts = new Map<string, string>();
  const requiredFiles = REQUIRED_FILES.map((item) => ({
    ...item,
    absolutePath: resolveRepoFile(rootDir, item.file),
  }));

  for (const item of requiredFiles) {
    if (!fs.existsSync(item.absolutePath)) {
      issues.push({
        level: 'error',
        file: toPosixPath(item.file),
        message: `缺少必需事实源文件: ${item.purpose}`,
      });
      continue;
    }

    const read = readText(item.absolutePath);
    if (!read.ok) {
      issues.push({
        level: 'error',
        file: formatRelativeToCwd(item.absolutePath),
        message: `读取失败: ${read.error}`,
      });
      continue;
    }

    checkedTexts.set(item.file, read.data);
  }

  for (const check of REQUIRED_TEXT_CHECKS) {
    const text = checkedTexts.get(check.file);
    if (!text) continue;
    if (!text.includes(check.expectedText)) {
      issues.push({
        level: 'warning',
        file: toPosixPath(check.file),
        message: check.message,
      });
    }
  }

  for (const check of REQUIRED_PATTERN_CHECKS) {
    const text = checkedTexts.get(check.file);
    if (!text) continue;
    if (!check.pattern.test(text)) {
      issues.push({
        level: 'warning',
        file: toPosixPath(check.file),
        message: check.message,
      });
    }
  }

  for (const check of FRESHNESS_CHECKS) {
    const text = checkedTexts.get(check.file);
    if (!text) continue;

    const dateText = check.extractor(text);
    if (!dateText) {
      issues.push({
        level: 'warning',
        file: toPosixPath(check.file),
        message: check.missingDateMessage,
      });
      continue;
    }

    const ageDays = calculateAgeDays(dateText, now);
    if (ageDays === null) {
      issues.push({
        level: 'warning',
        file: toPosixPath(check.file),
        message: `无法解析日期: ${dateText}`,
      });
      continue;
    }

    if (ageDays > check.thresholdDays) {
      issues.push({
        level: 'warning',
        file: toPosixPath(check.file),
        message: `事实源可能过期: 最近日期 ${dateText}，距今 ${ageDays} 天（阈值 ${check.thresholdDays} 天）`,
      });
    }
  }

  const errorCount = issues.filter((issue) => issue.level === 'error').length;
  const warningCount = issues.filter((issue) => issue.level === 'warning').length;
  const checkedFileCount = checkedTexts.size;
  const checkedRuleCount = REQUIRED_TEXT_CHECKS.length + REQUIRED_PATTERN_CHECKS.length + FRESHNESS_CHECKS.length;

  return {
    ok: errorCount === 0,
    rootDir: toPosixPath(path.relative(process.cwd(), rootDir) || '.'),
    checkedFileCount,
    checkedRuleCount,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues,
  };
}

export function finalizeRepoStateValidation(payload: ValidationPayload, strict: boolean): ValidationReport {
  return {
    ...payload,
    strictMode: strict,
    effectiveOk: strict ? payload.errorCount === 0 && payload.warningCount === 0 : payload.ok,
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
  const rootDir = dirFlag ? path.resolve(process.cwd(), dirFlag) : process.cwd();
  const payload = finalizeRepoStateValidation(validateRepoStateRoot(rootDir), strict);

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[repo-state-validator] root: ${payload.rootDir}`);
    console.log(
      `[repo-state-validator] checked files: ${payload.checkedFileCount}, checks: ${payload.checkedRuleCount}, errors: ${payload.errorCount}, warnings: ${payload.warningCount}`,
    );
    for (const issue of payload.issues) {
      const prefix = issue.level === 'error' ? 'ERROR' : 'WARN';
      console.log(`- ${prefix} ${issue.file}: ${issue.message}`);
    }
  }

  if (!payload.effectiveOk) process.exit(1);
}

if (require.main === module) {
  main();
}
