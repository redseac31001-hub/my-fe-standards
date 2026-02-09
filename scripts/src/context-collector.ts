/**
 * 上下文自动收集器
 *
 * 给定 TaskItem 的 scope.files，自动收集：
 * 1. 目标文件内容（截断到合理长度）
 * 2. 引用追踪（谁导入/使用了这些文件）
 * 3. 关联测试文件
 * 4. Git 最近变更历史
 *
 * 输出结构化 CollectedContext，供 agent-call prompt 注入。
 *
 * 零外部依赖，仅使用 Node.js 内置模块。
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  CollectedContext,
  GitChangeEntry,
  RelatedTestFile,
  ReferenceFindResult,
  TaskItem,
} from './types';
import { findReferences, findRelatedTests } from './reference-finder';

const MAX_FILE_CONTENT_LINES = 300;
const MAX_FILE_CONTENT_CHARS = 20_000;
const MAX_GIT_COMMITS = 10;
const MAX_REFERENCES_PER_FILE = 30;
const COLLECT_TIMEOUT_MS = 15_000;

interface CollectOptions {
  maxFileLines?: number;
  maxGitCommits?: number;
  maxRefsPerFile?: number;
  includeFileContent?: boolean;
  includeReferences?: boolean;
  includeTests?: boolean;
  includeGitHistory?: boolean;
}

/**
 * 从 TaskItem 中提取需要收集上下文的目标文件列表
 */
function extractTargetFiles(task: TaskItem): string[] {
  const files: string[] = [];

  // 从 scope.files 提取
  if (task.scope?.files) {
    for (const f of task.scope.files) {
      if (typeof f === 'string' && f.trim().length > 0) {
        files.push(f.trim());
      }
    }
  }

  // 从 title 和 acceptanceCriteria 中提取文件路径模式
  const pathPattern = /(?:^|\s)((?:src|lib|components|pages|utils|hooks|services|api|store|modules)\/[\w./-]+\.\w+)/g;
  const textSources = [task.title, ...(task.acceptanceCriteria ?? [])];

  for (const text of textSources) {
    if (!text) continue;
    let match: RegExpExecArray | null;
    pathPattern.lastIndex = 0;
    while ((match = pathPattern.exec(text)) !== null) {
      const candidate = match[1];
      if (!files.includes(candidate)) {
        files.push(candidate);
      }
    }
  }

  return files;
}

/**
 * 读取文件内容（截断到合理长度）
 */
function readFileContent(
  filePath: string,
  projectRoot: string,
  maxLines: number,
): { path: string; content: string; lines: number } | null {
  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(projectRoot, filePath);

  if (!fs.existsSync(absPath)) return null;

  let content: string;
  try {
    content = fs.readFileSync(absPath, 'utf-8');
  } catch {
    return null;
  }

  const allLines = content.split(/\r?\n/);
  const totalLines = allLines.length;

  // 截断
  if (allLines.length > maxLines) {
    content = allLines.slice(0, maxLines).join('\n')
      + `\n\n... (截断，共 ${totalLines} 行，仅显示前 ${maxLines} 行)`;
  }

  if (content.length > MAX_FILE_CONTENT_CHARS) {
    content = content.slice(0, MAX_FILE_CONTENT_CHARS)
      + `\n\n... (截断，超过 ${MAX_FILE_CONTENT_CHARS} 字符限制)`;
  }

  const relPath = path.relative(projectRoot, absPath).replace(/\\/g, '/');
  return { path: relPath, content, lines: totalLines };
}

/**
 * 获取 Git 最近变更历史
 */
function getGitHistory(
  targetFiles: string[],
  projectRoot: string,
  maxCommits: number,
): GitChangeEntry[] {
  if (targetFiles.length === 0) return [];

  // 先检查是否在 git 仓库中
  const gitCheck = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: 5000,
  });
  if (gitCheck.status !== 0) return [];

  const entries: GitChangeEntry[] = [];

  // 对每个目标文件获取最近提交
  const seenHashes = new Set<string>();
  for (const file of targetFiles) {
    const result = spawnSync('git', [
      'log',
      `--max-count=${maxCommits}`,
      '--format=%H|%an|%aI|%s',
      '--name-only',
      '--',
      file,
    ], {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 5000,
    });

    if (result.status !== 0 || !result.stdout) continue;

    const lines = result.stdout.trim().split(/\r?\n/);
    let current: GitChangeEntry | null = null;

    for (const line of lines) {
      if (!line.trim()) {
        if (current && !seenHashes.has(current.hash)) {
          seenHashes.add(current.hash);
          entries.push(current);
        }
        current = null;
        continue;
      }

      if (line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          if (current && !seenHashes.has(current.hash)) {
            seenHashes.add(current.hash);
            entries.push(current);
          }
          current = {
            hash: parts[0].slice(0, 8),
            author: parts[1],
            date: parts[2],
            message: parts.slice(3).join('|'),
            files: [],
          };
        }
      } else if (current) {
        current.files.push(line.trim());
      }
    }

    if (current && !seenHashes.has(current.hash)) {
      seenHashes.add(current.hash);
      entries.push(current);
    }
  }

  // 按日期降序排列，取前 maxCommits 条
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries.slice(0, maxCommits);
}

/**
 * 收集任务相关的完整上下文
 */
export function collectContext(
  task: TaskItem,
  projectRoot: string,
  options?: CollectOptions,
): CollectedContext {
  const start = Date.now();
  const maxFileLines = options?.maxFileLines ?? MAX_FILE_CONTENT_LINES;
  const maxGitCommits = options?.maxGitCommits ?? MAX_GIT_COMMITS;
  const maxRefsPerFile = options?.maxRefsPerFile ?? MAX_REFERENCES_PER_FILE;
  const includeFileContent = options?.includeFileContent !== false;
  const includeReferences = options?.includeReferences !== false;
  const includeTests = options?.includeTests !== false;
  const includeGitHistory = options?.includeGitHistory !== false;

  const targetFiles = extractTargetFiles(task);

  // 1. 读取目标文件内容
  const fileContents: CollectedContext['targetFiles'] = [];
  if (includeFileContent) {
    for (const file of targetFiles) {
      if (Date.now() - start > COLLECT_TIMEOUT_MS) break;
      const result = readFileContent(file, projectRoot, maxFileLines);
      if (result) fileContents.push(result);
    }
  }

  // 2. 引用追踪
  const references: ReferenceFindResult[] = [];
  if (includeReferences) {
    for (const file of targetFiles) {
      if (Date.now() - start > COLLECT_TIMEOUT_MS) break;
      const result = findReferences(file, projectRoot, { maxResults: maxRefsPerFile });
      if (result.references.length > 0) {
        references.push(result);
      }
    }
  }

  // 3. 关联测试文件
  const relatedTests: RelatedTestFile[] = [];
  if (includeTests) {
    const seen = new Set<string>();
    for (const file of targetFiles) {
      if (Date.now() - start > COLLECT_TIMEOUT_MS) break;
      const absPath = path.isAbsolute(file)
        ? file
        : path.resolve(projectRoot, file);
      if (!fs.existsSync(absPath)) continue;

      const tests = findRelatedTests(absPath, projectRoot);
      for (const t of tests) {
        if (!seen.has(t.testPath)) {
          seen.add(t.testPath);
          relatedTests.push(t);
        }
      }
    }
  }

  // 4. Git 历史
  const gitHistory: GitChangeEntry[] = includeGitHistory
    ? getGitHistory(targetFiles, projectRoot, maxGitCommits)
    : [];

  return {
    targetFiles: fileContents,
    references,
    relatedTests,
    gitHistory,
    collectedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

/**
 * 将 CollectedContext 格式化为 Markdown 文本（用于注入 prompt）
 */
export function formatContextAsMarkdown(ctx: CollectedContext): string {
  const sections: string[] = [];

  // 目标文件内容
  if (ctx.targetFiles.length > 0) {
    sections.push('## Context: 目标文件内容');
    for (const file of ctx.targetFiles) {
      const ext = path.extname(file.path).slice(1) || 'text';
      sections.push(`### ${file.path} (${file.lines} 行)`);
      sections.push('```' + ext);
      sections.push(file.content);
      sections.push('```');
      sections.push('');
    }
  }

  // 引用追踪
  if (ctx.references.length > 0) {
    sections.push('## Context: 引用追踪');
    for (const ref of ctx.references) {
      sections.push(`### ${ref.target} 的引用 (${ref.references.length} 处)`);
      for (const r of ref.references) {
        const relPath = r.filePath.replace(/\\/g, '/');
        sections.push(`- \`${relPath}:${r.line}\` [${r.kind}] ${r.matchText}`);
      }
      sections.push('');
    }
  }

  // 关联测试
  if (ctx.relatedTests.length > 0) {
    sections.push('## Context: 关联测试文件');
    for (const t of ctx.relatedTests) {
      sections.push(`- \`${t.testPath}\` [${t.confidence}] ← ${t.sourcePath}`);
    }
    sections.push('');
  }

  // Git 历史
  if (ctx.gitHistory.length > 0) {
    sections.push('## Context: Git 最近变更');
    for (const entry of ctx.gitHistory) {
      const filesStr = entry.files.length > 0 ? ` (${entry.files.join(', ')})` : '';
      sections.push(`- \`${entry.hash}\` ${entry.date.slice(0, 10)} ${entry.author}: ${entry.message}${filesStr}`);
    }
    sections.push('');
  }

  if (sections.length === 0) {
    return '';
  }

  return sections.join('\n');
}

// CLI 入口
function showHelp(): void {
  console.log(`
Context Collector - 上下文自动收集器

用法:
  node .codebuddy/scripts/context-collector.js --files <file1,file2> [options]

选项:
  --files <paths>       逗号分隔的目标文件列表
  --symbol <name>       额外搜索指定符号
  --max-lines <n>       文件内容最大行数（默认: 300）
  --max-commits <n>     Git 历史最大条数（默认: 10）
  --no-content          不读取文件内容
  --no-refs             不追踪引用
  --no-tests            不查找测试文件
  --no-git              不获取 Git 历史
  --json                以 JSON 格式输出
  --markdown            以 Markdown 格式输出（默认）
  -h, --help            显示帮助
`);
}

function main(): void {
  const args = process.argv.slice(2);

  let files: string[] = [];
  let maxLines = MAX_FILE_CONTENT_LINES;
  let maxCommits = MAX_GIT_COMMITS;
  let noContent = false;
  let noRefs = false;
  let noTests = false;
  let noGit = false;
  let jsonOutput = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') { help = true; continue; }
    if (arg === '--files' && args[i + 1]) { files = args[++i].split(',').map(f => f.trim()).filter(Boolean); continue; }
    if (arg === '--max-lines' && args[i + 1]) { maxLines = parseInt(args[++i], 10) || MAX_FILE_CONTENT_LINES; continue; }
    if (arg === '--max-commits' && args[i + 1]) { maxCommits = parseInt(args[++i], 10) || MAX_GIT_COMMITS; continue; }
    if (arg === '--no-content') { noContent = true; continue; }
    if (arg === '--no-refs') { noRefs = true; continue; }
    if (arg === '--no-tests') { noTests = true; continue; }
    if (arg === '--no-git') { noGit = true; continue; }
    if (arg === '--json') { jsonOutput = true; continue; }
  }

  if (help || files.length === 0) {
    showHelp();
    process.exit(files.length > 0 ? 0 : 1);
  }

  // 构造一个虚拟 TaskItem 用于收集
  const pseudoTask: TaskItem = {
    id: 'cli',
    title: 'CLI context collection',
    type: 'implement',
    status: 'pending',
    priority: 'medium',
    dependencies: [],
    acceptanceCriteria: [],
    scope: { files },
  };

  const ctx = collectContext(pseudoTask, process.cwd(), {
    maxFileLines: maxLines,
    maxGitCommits: maxCommits,
    includeFileContent: !noContent,
    includeReferences: !noRefs,
    includeTests: !noTests,
    includeGitHistory: !noGit,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(ctx, null, 2));
  } else {
    const md = formatContextAsMarkdown(ctx);
    if (md) {
      console.log(md);
    } else {
      console.log('未收集到任何上下文信息。');
    }
    console.log(`\n收集耗时: ${ctx.durationMs}ms`);
  }
}

if (require.main === module) {
  main();
}
