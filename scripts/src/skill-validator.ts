/**
 * Skill Validator (dependency-free)
 *
 * Validate Skill folders for basic correctness:
 * - Supports repo mode: ./custom-skills
 * - Supports project mode: active skills root from ./.codebuddy/install.json (after codebuddy-loader)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parseFrontmatterBlock as parseFrontmatter,
  extractYamlScalar,
  extractYamlSection,
  listYamlKeys,
  parseYamlList,
} from './lib/frontmatter-utils';

type IssueLevel = 'error' | 'warning';

type Issue = {
  level: IssueLevel;
  skillId?: string;
  file: string; // project-relative, posix
  message: string;
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
Skill Validator - Skills 基础校验

用法:
  node .codebuddy/scripts/skill-validator.js [command] [options]

命令:
  check                        校验 skills（默认）

选项:
  --dir, --root <path>         skills 目录（默认: ./custom-skills 或 install.json 记录的 active skills root 自动探测）
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

function detectInstalledSkillsDir(cwd: string): string | null {
  const installStatePath = path.join(cwd, '.codebuddy', 'install.json');
  if (!fs.existsSync(installStatePath)) {
    return null;
  }

  try {
    const installState = JSON.parse(fs.readFileSync(installStatePath, 'utf-8')) as {
      outputs?: { skillsRootDir?: string | null };
      stats?: { skills?: number };
    };
    const skillsRootDir = installState.outputs?.skillsRootDir
      || ((installState.stats?.skills || 0) > 0 ? '.codebuddy/skills' : null);
    if (!skillsRootDir) {
      return null;
    }
    const absolutePath = path.resolve(cwd, skillsRootDir);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
      return absolutePath;
    }
  } catch {
    // ignore invalid install state
  }

  return null;
}

function detectDefaultSkillsDir(cwd: string): string | null {
  const installedSkillsDir = detectInstalledSkillsDir(cwd);
  const candidates = [
    path.join(cwd, 'custom-skills'),
    installedSkillsDir,
    path.join(cwd, '.codebuddy', 'skills'),
  ].filter((value): value is string => Boolean(value));
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch {
      // ignore
    }
  }
  return null;
}

function listSkillDirs(skillsDir: string): string[] {
  try {
    return fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(name => !name.startsWith('.'));
  } catch {
    return [];
  }
}

function parseMarkdownLinks(markdown: string): string[] {
  const urls: string[] = [];
  const re = /\[[^\]]*?\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    const raw = m[1].trim();
    if (!raw) continue;
    const url = raw.split(/\s+/)[0]; // strip optional title
    urls.push(url);
  }
  return urls;
}

function isSkippableLink(url: string): boolean {
  if (url.startsWith('#')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) return true;
  if (url.startsWith('mailto:')) return true;
  if (/^[a-zA-Z]+:\/\//.test(url)) return true;
  return false;
}

function validateSkillDir(skillId: string, skillDir: string): { issues: Issue[]; checkedFileCount: number } {
  const issues: Issue[] = [];
  const skillFile = path.join(skillDir, 'SKILL.md');
  const relSkillFile = toPosixPath(path.relative(process.cwd(), skillFile));

  if (!fs.existsSync(skillFile)) {
    issues.push({ level: 'error', skillId, file: toPosixPath(path.relative(process.cwd(), skillDir)), message: '缺少 SKILL.md' });
    return { issues, checkedFileCount: 0 };
  }

  const read = readText(skillFile);
  if (!read.ok) {
    issues.push({ level: 'error', skillId, file: relSkillFile, message: `读取失败: ${read.error}` });
    return { issues, checkedFileCount: 1 };
  }

  const raw = read.data;
  const fm = parseFrontmatter(raw);
  if (!fm.ok) {
    issues.push({ level: 'error', skillId, file: relSkillFile, message: fm.error });
    return { issues, checkedFileCount: 1 };
  }

  const frontmatter = fm.frontmatter;
  const name = (extractYamlScalar(frontmatter, 'name') ?? '').trim();
  const description = (extractYamlScalar(frontmatter, 'description') ?? '').trim();
  if (!name) issues.push({ level: 'error', skillId, file: relSkillFile, message: 'frontmatter 缺少 name' });
  if (!description) issues.push({ level: 'error', skillId, file: relSkillFile, message: 'frontmatter 缺少 description' });
  if (name && name !== skillId) {
    issues.push({ level: 'warning', skillId, file: relSkillFile, message: `skillId 与 frontmatter.name 不一致（dir=${skillId}, name=${name}）` });
  }

  const topLevelKeys = listYamlKeys(frontmatter);
  const allowedKeys = new Set(['name', 'description', 'metadata', 'triggers', 'tools', 'related']);
  for (const k of topLevelKeys) {
    if (!allowedKeys.has(k)) {
      issues.push({ level: 'warning', skillId, file: relSkillFile, message: `frontmatter 包含非推荐字段: ${k}（建议仅保留 name/description/metadata）` });
    }
  }

  for (const legacyKey of ['triggers', 'tools', 'related']) {
    if (topLevelKeys.includes(legacyKey)) {
      issues.push({
        level: 'warning',
        skillId,
        file: relSkillFile,
        message: `top-level ${legacyKey} 已废弃，建议迁移到 metadata.${legacyKey}`,
      });
    }
  }

  const metadataBlock = extractYamlSection(frontmatter, 'metadata');
  if (metadataBlock) {
    const metadataKeys = listYamlKeys(metadataBlock, 2);
    const allowedMetadataKeys = new Set(['triggers', 'tools', 'related', 'languages', 'frameworks', 'roles', 'scenarios', 'workspace_scope']);
    for (const key of metadataKeys) {
      if (!allowedMetadataKeys.has(key)) {
        issues.push({
          level: 'warning',
          skillId,
          file: relSkillFile,
          message: `metadata 包含未知字段: ${key}（推荐仅使用 triggers/tools/related）`,
        });
      }
    }

    for (const key of ['triggers', 'tools', 'related']) {
      if (topLevelKeys.includes(key) && parseYamlList(metadataBlock, key, 2).length > 0) {
        issues.push({
          level: 'warning',
          skillId,
          file: relSkillFile,
          message: `同时存在 legacy ${key} 与 metadata.${key}，建议只保留 metadata.${key}`,
        });
      }
    }
  }

  // Code fences balanced.
  const fenceMatches = raw.match(/^```/gm) ?? [];
  if (fenceMatches.length % 2 !== 0) {
    issues.push({ level: 'error', skillId, file: relSkillFile, message: '存在未闭合的代码块（``` 数量为奇数）' });
  }

  // Validate relative links (references/assets/scripts).
  const urls = parseMarkdownLinks(raw);
  for (const url of urls) {
    if (isSkippableLink(url)) continue;
    if (url.startsWith('/')) continue; // treat absolute path as external to the skill package

    const resolved = path.resolve(skillDir, url);
    if (!fs.existsSync(resolved)) {
      issues.push({ level: 'warning', skillId, file: relSkillFile, message: `链接目标不存在: ${url}` });
    }
  }

  return { issues, checkedFileCount: 1 };
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
  const skillsDir = dirFlag ? path.resolve(process.cwd(), dirFlag) : detectDefaultSkillsDir(process.cwd());

  if (!skillsDir) {
    const msg = '未找到 skills 目录（期望 ./custom-skills 或 install.json 记录的 active skills root）。请使用 --dir 指定。';
    if (json) {
      console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
    } else {
      console.error(`错误: ${msg}`);
    }
    process.exit(1);
  }

  const skillDirs = listSkillDirs(skillsDir);
  const issues: Issue[] = [];
  let checkedFileCount = 0;

  for (const skillId of skillDirs) {
    const abs = path.join(skillsDir, skillId);
    const res = validateSkillDir(skillId, abs);
    checkedFileCount += res.checkedFileCount;
    issues.push(...res.issues);
  }

  const errorCount = issues.filter(i => i.level === 'error').length;
  const warningCount = issues.filter(i => i.level === 'warning').length;

  const payload = {
    ok: errorCount === 0,
    skillsDir: toPosixPath(path.relative(process.cwd(), skillsDir) || '.'),
    checkedSkillCount: skillDirs.length,
    checkedFileCount,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues,
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[skill-validator] root: ${payload.skillsDir}`);
    console.log(
      `[skill-validator] checked skills: ${payload.checkedSkillCount}, files: ${payload.checkedFileCount}, errors: ${payload.errorCount}, warnings: ${payload.warningCount}`
    );
    for (const it of issues) {
      const prefix = it.level === 'error' ? 'ERROR' : 'WARN';
      const s = it.skillId ? `(${it.skillId}) ` : '';
      console.log(`- ${prefix} ${s}${it.file}: ${it.message}`);
    }
  }

  if (strict && errorCount > 0) process.exit(1);
  if (!strict && errorCount > 0) process.exit(1);
}

main();
