import * as fs from 'fs';
import * as path from 'path';
import { finalizeRuleValidation, validateRulesDir } from './rule-validator';
import { finalizeSkillValidation, validateSkillsDir } from './skill-validator';

type GateScope = 'all' | 'rules' | 'skills';

type ParsedCli = {
  command: string | null;
  positionals: string[];
  flags: Record<string, string | boolean>;
};

type ValidatorGateOptions = {
  scope: GateScope;
  strict: boolean;
  json: boolean;
  outDir: string | null;
  rulesDir: string | null;
  skillsDir: string | null;
};

type RuleValidationReport = ReturnType<typeof finalizeRuleValidation>;
type SkillValidationReport = ReturnType<typeof finalizeSkillValidation>;

type ValidatorGateReport = {
  ok: boolean;
  effectiveOk: boolean;
  strictMode: boolean;
  scope: GateScope;
  generatedAt: string;
  errorCount: number;
  warningCount: number;
  issueCount: number;
  outputDir: string | null;
  reportFiles: string[];
  reports: {
    rules?: RuleValidationReport;
    skills?: SkillValidationReport;
  };
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
    if (a === '--strict') {
      parsed.flags.strict = true;
      continue;
    }
    if (a === '--help' || a === '-h') {
      parsed.flags.help = true;
      continue;
    }
    if ((a === '--scope') && args[i + 1]) {
      parsed.flags.scope = args[++i];
      continue;
    }
    if ((a === '--out-dir' || a === '--out') && args[i + 1]) {
      parsed.flags.outDir = args[++i];
      continue;
    }
    if (a === '--rules-dir' && args[i + 1]) {
      parsed.flags.rulesDir = args[++i];
      continue;
    }
    if (a === '--skills-dir' && args[i + 1]) {
      parsed.flags.skillsDir = args[++i];
      continue;
    }

    parsed.flags[a.replace(/^--?/, '')] = true;
  }

  if (!parsed.command) parsed.command = 'run';
  return parsed;
}

function showHelp(): void {
  console.log(`
Validator Gate - 聚合 rules/skills validator 并输出可审计结果

用法:
  node scripts/dist/validator-gate.js [command] [options]

命令:
  run                          运行 validator gate（默认）

选项:
  --scope <all|rules|skills>   选择执行范围（默认: all）
  --strict                     warning 和 error 都作为 gate
  --json                       输出聚合 JSON 报告
  --out-dir <path>             额外把 summary 和子报告写入目录
  --rules-dir <path>           指定 rules 根目录
  --skills-dir <path>          指定 skills 根目录
  --help, -h                   显示帮助
`.trim());
}

function detectRulesDir(cwd: string): string | null {
  const candidates = [
    path.join(cwd, 'rules'),
    path.join(cwd, '.codebuddy', 'rules_cache'),
    path.join(cwd, '.codebuddy', 'rules'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

function detectInstalledSkillsDir(cwd: string): string | null {
  const installStatePath = path.join(cwd, '.codebuddy', 'install.json');
  if (!fs.existsSync(installStatePath)) return null;

  try {
    const installState = JSON.parse(fs.readFileSync(installStatePath, 'utf-8')) as {
      outputs?: { skillsRootDir?: string | null };
      stats?: { skills?: number };
    };
    const skillsRootDir = installState.outputs?.skillsRootDir
      || ((installState.stats?.skills || 0) > 0 ? '.codebuddy/skills' : null);
    if (!skillsRootDir) return null;
    const absolutePath = path.resolve(cwd, skillsRootDir);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
      return absolutePath;
    }
  } catch {
    // ignore invalid install state
  }

  return null;
}

function detectSkillsDir(cwd: string): string | null {
  const candidates = [
    path.join(cwd, 'custom-skills'),
    detectInstalledSkillsDir(cwd),
    path.join(cwd, '.codebuddy', 'skills'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, payload: unknown): string {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return toPosixPath(path.relative(process.cwd(), filePath) || path.basename(filePath));
}

function parseScope(value: string | boolean | undefined): GateScope {
  if (value === 'rules' || value === 'skills' || value === 'all') return value;
  return 'all';
}

export function buildValidatorGateReport(options: ValidatorGateOptions): ValidatorGateReport {
  const scope = options.scope;
  const reports: ValidatorGateReport['reports'] = {};

  if (scope === 'all' || scope === 'rules') {
    const rootDir = options.rulesDir ? path.resolve(process.cwd(), options.rulesDir) : detectRulesDir(process.cwd());
    if (!rootDir) {
      throw new Error('未找到 rules 目录（期望 ./rules 或 ./.codebuddy/rules_cache）。请使用 --rules-dir 指定。');
    }
    reports.rules = finalizeRuleValidation(validateRulesDir(rootDir), options.strict);
  }

  if (scope === 'all' || scope === 'skills') {
    const skillsDir = options.skillsDir ? path.resolve(process.cwd(), options.skillsDir) : detectSkillsDir(process.cwd());
    if (!skillsDir) {
      throw new Error('未找到 skills 目录（期望 ./custom-skills 或 install.json 记录的 active skills root）。请使用 --skills-dir 指定。');
    }
    reports.skills = finalizeSkillValidation(validateSkillsDir(skillsDir), options.strict);
  }

  const includedReports = [reports.rules, reports.skills].filter(
    (value): value is RuleValidationReport | SkillValidationReport => Boolean(value),
  );

  return {
    ok: includedReports.every(report => report.ok),
    effectiveOk: includedReports.every(report => report.effectiveOk),
    strictMode: options.strict,
    scope,
    generatedAt: new Date().toISOString(),
    errorCount: includedReports.reduce((sum, report) => sum + report.errorCount, 0),
    warningCount: includedReports.reduce((sum, report) => sum + report.warningCount, 0),
    issueCount: includedReports.reduce((sum, report) => sum + report.issueCount, 0),
    outputDir: null,
    reportFiles: [],
    reports,
  };
}

export function runValidatorGate(options: ValidatorGateOptions): ValidatorGateReport {
  const report = buildValidatorGateReport(options);

  if (options.outDir) {
    const outDir = path.resolve(process.cwd(), options.outDir);
    report.outputDir = toPosixPath(path.relative(process.cwd(), outDir) || '.');
    if (report.reports.rules) {
      writeJson(path.join(outDir, 'rule-validator-report.json'), report.reports.rules);
      report.reportFiles.push('rule-validator-report.json');
    }
    if (report.reports.skills) {
      writeJson(path.join(outDir, 'skill-validator-report.json'), report.reports.skills);
      report.reportFiles.push('skill-validator-report.json');
    }
    writeJson(path.join(outDir, 'validator-gate-summary.json'), report);
    report.reportFiles.push('validator-gate-summary.json');
  }

  return report;
}

function main(): void {
  const parsed = parseCli(process.argv.slice(2));

  if (parsed.flags.help || parsed.command === 'help') {
    showHelp();
    process.exit(0);
  }

  if (parsed.command !== 'run') {
    console.error(`错误: 未知命令: ${parsed.command}`);
    showHelp();
    process.exit(1);
  }

  const options: ValidatorGateOptions = {
    scope: parseScope(parsed.flags.scope),
    strict: Boolean(parsed.flags.strict),
    json: Boolean(parsed.flags.json),
    outDir: typeof parsed.flags.outDir === 'string' ? parsed.flags.outDir : null,
    rulesDir: typeof parsed.flags.rulesDir === 'string' ? parsed.flags.rulesDir : null,
    skillsDir: typeof parsed.flags.skillsDir === 'string' ? parsed.flags.skillsDir : null,
  };

  let report: ValidatorGateReport;
  try {
    report = runValidatorGate(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(JSON.stringify({ ok: false, effectiveOk: false, error: message }, null, 2));
    } else {
      console.error(`错误: ${message}`);
    }
    process.exit(1);
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[validator-gate] scope: ${report.scope}, strict: ${report.strictMode ? 'on' : 'off'}`);
    console.log(
      `[validator-gate] issues: ${report.issueCount}, errors: ${report.errorCount}, warnings: ${report.warningCount}, effectiveOk: ${report.effectiveOk}`,
    );
    for (const file of report.reportFiles) {
      console.log(`- report ${file}`);
    }
  }

  if (!report.effectiveOk) process.exit(1);
}

if (require.main === module) {
  main();
}
