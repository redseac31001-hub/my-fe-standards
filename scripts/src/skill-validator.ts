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

type ValidationPayload = {
  ok: boolean;
  skillsDir: string;
  checkedSkillCount: number;
  checkedFileCount: number;
  checkedLinkCount: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  issues: Issue[];
};

type ValidationReport = ValidationPayload & {
  strictMode: boolean;
  effectiveOk: boolean;
};

type MarkdownLink = {
  text: string;
  target: string;
  title: string | null;
  line: number;
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
  --strict                     存在 warning/error 时 exit=1；默认仅 error 才 exit=1
  --help, -h                   显示帮助

说明:
  - 默认递归校验 skill 目录下全部 Markdown 文件的相对链接
  - 指向 skill 根目录外部的相对路径，需用 metadata.link_whitelist 显式放行
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

function isSubPath(parentDir: string, childPath: string): boolean {
  const rel = path.relative(parentDir, childPath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function listMarkdownFiles(rootDir: string): string[] {
  const files: string[] = [];
  const queue = [rootDir];
  const ignoredDirNames = new Set(['.git', 'node_modules', '__pycache__']);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (ignoredDirNames.has(entry.name)) continue;
        queue.push(path.join(current, entry.name));
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(path.join(current, entry.name));
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function listBundledFiles(skillDir: string): string[] {
  const files: string[] = [];
  const ignoredDirNames = new Set(['.git', 'node_modules', '__pycache__']);
  const bundledDirNames = ['references', 'scripts', 'assets'];

  for (const bundledDirName of bundledDirNames) {
    const bundledDir = path.join(skillDir, bundledDirName);
    if (!fs.existsSync(bundledDir)) continue;

    const queue = [bundledDir];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (ignoredDirNames.has(entry.name)) continue;
          queue.push(fullPath);
          continue;
        }
        if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function stripMarkdownCode(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, block => block.replace(/[^\n]/g, ' '))
    .replace(/~~~[\s\S]*?~~~/g, block => block.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, code => code.replace(/[^\n]/g, ' '));
}

function countLineAtOffset(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

function parseMarkdownLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const sanitized = stripMarkdownCode(markdown);
  const re = /!?\[([^\]\n]*?)\]\(([^)\n]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sanitized))) {
    if (m[0].startsWith('!')) continue;
    const destination = splitMarkdownLinkDestination(m[2]);
    if (!destination.target) continue;
    links.push({
      text: m[1].trim(),
      target: destination.target,
      title: destination.title,
      line: countLineAtOffset(sanitized, m.index),
    });
  }
  return links;
}

function splitMarkdownLinkDestination(raw: string): { target: string; title: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { target: '', title: null };

  if (trimmed.startsWith('<')) {
    const closing = trimmed.indexOf('>');
    if (closing > 0) {
      const target = trimmed.slice(1, closing).trim();
      const title = trimmed.slice(closing + 1).trim();
      return { target, title: title || null };
    }
  }

  const match = trimmed.match(/^(\S+)(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?$/);
  if (!match) {
    return { target: trimmed, title: null };
  }

  return {
    target: match[1].trim(),
    title: (match[2] ?? match[3] ?? match[4] ?? '').trim() || null,
  };
}

function normalizeLocalMarkdownTarget(target: string): string {
  let normalized = target.trim();
  const hashIndex = normalized.indexOf('#');
  if (hashIndex >= 0) normalized = normalized.slice(0, hashIndex);
  const queryIndex = normalized.indexOf('?');
  if (queryIndex >= 0) normalized = normalized.slice(0, queryIndex);
  return normalized.trim();
}

function normalizeWhitelistEntry(value: string): string {
  return toPosixPath(value.trim()).replace(/^\.\//, '');
}

function parseLinkWhitelist(frontmatter: string): string[] {
  const metadataBlock = extractYamlSection(frontmatter, 'metadata');
  if (!metadataBlock) return [];
  return parseYamlList(metadataBlock, 'link_whitelist', 2)
    .map(normalizeWhitelistEntry)
    .filter(Boolean);
}

function isWhitelistedRelativePath(relativeTarget: string, whitelist: string[]): boolean {
  const normalizedTarget = normalizeWhitelistEntry(relativeTarget);
  return whitelist.some(rule => {
    const normalizedRule = normalizeWhitelistEntry(rule);
    if (!normalizedRule) return false;
    if (normalizedRule.endsWith('/')) {
      const prefix = normalizedRule.slice(0, -1);
      return normalizedTarget === prefix || normalizedTarget.startsWith(normalizedRule);
    }
    return normalizedTarget === normalizedRule;
  });
}

function formatLinkLabel(link: MarkdownLink): string {
  if (link.text) return `"${link.text}"`;
  if (link.title) return `"${link.title}"`;
  return link.target;
}

function validateMarkdownFile(
  skillId: string,
  skillDir: string,
  filePath: string,
  whitelist: string[]
): { issues: Issue[]; checkedLinkCount: number } {
  const issues: Issue[] = [];
  const relativeFile = toPosixPath(path.relative(process.cwd(), filePath));
  const read = readText(filePath);

  if (!read.ok) {
    issues.push({ level: 'error', skillId, file: relativeFile, message: `读取失败: ${read.error}` });
    return { issues, checkedLinkCount: 0 };
  }

  const raw = read.data;
  const backtickFenceCount = raw.match(/^```/gm)?.length ?? 0;
  if (backtickFenceCount % 2 !== 0) {
    issues.push({ level: 'error', skillId, file: relativeFile, message: '存在未闭合的代码块（``` 数量为奇数）' });
  }
  const tildeFenceCount = raw.match(/^~~~/gm)?.length ?? 0;
  if (tildeFenceCount % 2 !== 0) {
    issues.push({ level: 'error', skillId, file: relativeFile, message: '存在未闭合的代码块（~~~ 数量为奇数）' });
  }

  const links = parseMarkdownLinks(raw);
  for (const link of links) {
    const localTarget = normalizeLocalMarkdownTarget(link.target);
    if (!localTarget || isSkippableLink(localTarget)) continue;
    if (localTarget.startsWith('/')) continue; // treat absolute path as external to the skill package
    if (path.isAbsolute(localTarget)) continue;

    const resolved = path.resolve(path.dirname(filePath), localTarget);
    if (!fs.existsSync(resolved)) {
      issues.push({
        level: 'error',
        skillId,
        file: relativeFile,
        message: `第 ${link.line} 行链接 ${formatLinkLabel(link)} 目标不存在: ${localTarget}`,
      });
      continue;
    }

    if (!isSubPath(skillDir, resolved)) {
      const escapedRelativePath = normalizeWhitelistEntry(toPosixPath(path.relative(skillDir, resolved)));
      if (!isWhitelistedRelativePath(escapedRelativePath, whitelist)) {
        issues.push({
          level: 'error',
          skillId,
          file: relativeFile,
          message: `第 ${link.line} 行链接 ${formatLinkLabel(link)} 指向 skill 目录外部: ${escapedRelativePath}（可用 metadata.link_whitelist 显式放行）`,
        });
      }
    }
  }

  return { issues, checkedLinkCount: links.length };
}

function collectReferencedSkillFiles(skillDir: string, markdownFiles: string[]): Set<string> {
  const referenced = new Set<string>();

  for (const markdownFile of markdownFiles) {
    const read = readText(markdownFile);
    if (!read.ok) continue;

    const links = parseMarkdownLinks(read.data);
    for (const link of links) {
      const localTarget = normalizeLocalMarkdownTarget(link.target);
      if (!localTarget || isSkippableLink(localTarget)) continue;
      if (localTarget.startsWith('/')) continue;
      if (path.isAbsolute(localTarget)) continue;

      const resolved = path.resolve(path.dirname(markdownFile), localTarget);
      if (!fs.existsSync(resolved)) continue;
      if (!isSubPath(skillDir, resolved)) continue;

      let stats: fs.Stats;
      try {
        stats = fs.statSync(resolved);
      } catch {
        continue;
      }

      if (stats.isFile()) {
        referenced.add(path.resolve(resolved));
      }
    }
  }

  return referenced;
}

function validateBundledFileReferences(skillId: string, skillDir: string, markdownFiles: string[]): Issue[] {
  const issues: Issue[] = [];
  const bundledFiles = listBundledFiles(skillDir);
  if (bundledFiles.length === 0) return issues;

  const referencedFiles = collectReferencedSkillFiles(skillDir, markdownFiles);
  for (const bundledFile of bundledFiles) {
    const resolvedBundledFile = path.resolve(bundledFile);
    if (referencedFiles.has(resolvedBundledFile)) continue;

    issues.push({
      level: 'warning',
      skillId,
      file: toPosixPath(path.relative(process.cwd(), bundledFile)),
      message: `bundled file 未被任何 Markdown 链接引用: ${toPosixPath(path.relative(skillDir, bundledFile))}`,
    });
  }

  return issues;
}

function isSkippableLink(url: string): boolean {
  if (url.startsWith('#')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) return true;
  if (url.startsWith('mailto:')) return true;
  if (/^[a-zA-Z]+:\/\//.test(url)) return true;
  return false;
}

function validateSkillDir(skillId: string, skillDir: string): { issues: Issue[]; checkedFileCount: number; checkedLinkCount: number } {
  const issues: Issue[] = [];
  const skillFile = path.join(skillDir, 'SKILL.md');
  const relSkillFile = toPosixPath(path.relative(process.cwd(), skillFile));

  if (!fs.existsSync(skillFile)) {
    issues.push({ level: 'error', skillId, file: toPosixPath(path.relative(process.cwd(), skillDir)), message: '缺少 SKILL.md' });
    return { issues, checkedFileCount: 0, checkedLinkCount: 0 };
  }

  const read = readText(skillFile);
  if (!read.ok) {
    issues.push({ level: 'error', skillId, file: relSkillFile, message: `读取失败: ${read.error}` });
    return { issues, checkedFileCount: 1, checkedLinkCount: 0 };
  }

  const raw = read.data;
  const fm = parseFrontmatter(raw);
  if (!fm.ok) {
    issues.push({ level: 'error', skillId, file: relSkillFile, message: fm.error });
    return { issues, checkedFileCount: 1, checkedLinkCount: 0 };
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
    const allowedMetadataKeys = new Set([
      'triggers',
      'tools',
      'related',
      'languages',
      'frameworks',
      'roles',
      'scenarios',
      'workspace_scope',
      'link_whitelist',
    ]);
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

  const whitelist = parseLinkWhitelist(frontmatter);
  const markdownFiles = listMarkdownFiles(skillDir);
  let checkedLinkCount = 0;
  for (const markdownFile of markdownFiles) {
    const result = validateMarkdownFile(skillId, skillDir, markdownFile, whitelist);
    checkedLinkCount += result.checkedLinkCount;
    issues.push(...result.issues);
  }

  issues.push(...validateBundledFileReferences(skillId, skillDir, markdownFiles));

  return { issues, checkedFileCount: markdownFiles.length, checkedLinkCount };
}

export function validateSkillsDir(skillsDir: string): ValidationPayload {
  const skillDirs = listSkillDirs(skillsDir);
  const issues: Issue[] = [];
  let checkedFileCount = 0;
  let checkedLinkCount = 0;

  for (const skillId of skillDirs) {
    const abs = path.join(skillsDir, skillId);
    const res = validateSkillDir(skillId, abs);
    checkedFileCount += res.checkedFileCount;
    checkedLinkCount += res.checkedLinkCount;
    issues.push(...res.issues);
  }

  const errorCount = issues.filter(i => i.level === 'error').length;
  const warningCount = issues.filter(i => i.level === 'warning').length;

  return {
    ok: errorCount === 0,
    skillsDir: toPosixPath(path.relative(process.cwd(), skillsDir) || '.'),
    checkedSkillCount: skillDirs.length,
    checkedFileCount,
    checkedLinkCount,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues,
  };
}

export function finalizeSkillValidation(payload: ValidationPayload, strict: boolean): ValidationReport {
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

  const payload = finalizeSkillValidation(validateSkillsDir(skillsDir), strict);

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[skill-validator] root: ${payload.skillsDir}`);
    console.log(
      `[skill-validator] checked skills: ${payload.checkedSkillCount}, files: ${payload.checkedFileCount}, links: ${payload.checkedLinkCount}, errors: ${payload.errorCount}, warnings: ${payload.warningCount}`
    );
    for (const it of payload.issues) {
      const prefix = it.level === 'error' ? 'ERROR' : 'WARN';
      const s = it.skillId ? `(${it.skillId}) ` : '';
      console.log(`- ${prefix} ${s}${it.file}: ${it.message}`);
    }
  }

  if (!payload.effectiveOk) process.exit(1);
}

if (require.main === module) {
  main();
}
