/**
 * 轻量级引用追踪器
 *
 * 基于 Node.js 内置模块，通过递归扫描项目文件，
 * 用正则匹配 import/require/from 语句来查找对目标文件/符号的引用。
 *
 * 零外部依赖，可直接在用户项目中运行。
 */

import * as fs from 'fs';
import * as path from 'path';
import { ReferenceEntry, ReferenceFindResult } from './types';

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.svelte',
]);

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.codebuddy', '.next', '.nuxt', '.output',
]);

const MAX_FILE_SIZE = 512 * 1024; // 512KB
const MAX_FILES_SCAN = 5000;

/**
 * 递归收集可扫描的源文件
 */
function collectSourceFiles(dir: string, collected: string[], depth: number = 0): void {
  if (depth > 15 || collected.length >= MAX_FILES_SCAN) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (collected.length >= MAX_FILES_SCAN) break;

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      collectSourceFiles(path.join(dir, entry.name), collected, depth + 1);
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;

    const fullPath = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_FILE_SIZE) continue;
    } catch {
      continue;
    }

    collected.push(fullPath);
  }
}

/**
 * 将目标文件路径转换为可能的导入路径模式
 *
 * 例如 src/utils/helper.ts → ['utils/helper', 'src/utils/helper', './utils/helper']
 */
function buildImportPatterns(targetPath: string, projectRoot: string): string[] {
  const rel = path.relative(projectRoot, targetPath).replace(/\\/g, '/');
  const withoutExt = rel.replace(/\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/, '');
  const withoutIndex = withoutExt.replace(/\/index$/, '');

  const patterns = new Set<string>();
  patterns.add(withoutExt);
  patterns.add(withoutIndex);

  // 去掉 src/ 前缀（常见别名 @/ 映射到 src/）
  if (withoutExt.startsWith('src/')) {
    patterns.add(withoutExt.slice(4));
    patterns.add(withoutIndex.slice(4));
  }

  // 文件名本身（用于相对路径匹配）
  const baseName = path.basename(withoutExt);
  patterns.add(baseName);

  return Array.from(patterns).filter(p => p.length > 0);
}

/**
 * 构建符号搜索的正则（用于函数名/类名/变量名搜索）
 */
function buildSymbolPattern(symbol: string): RegExp {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'g');
}

/**
 * 在单个文件中搜索引用
 */
function searchFileForReferences(
  filePath: string,
  importPatterns: RegExp[],
  symbolPattern: RegExp | null,
  targetAbsPath: string | null,
): ReferenceEntry[] {
  // 不搜索自身
  if (targetAbsPath && path.resolve(filePath) === path.resolve(targetAbsPath)) {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const results: ReferenceEntry[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查 import/require 模式
    for (const pattern of importPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        const kind = /\brequire\s*\(/.test(line) ? 'require' as const
          : /\bfrom\s+['"]/.test(line) ? 'from' as const
          : /\bimport\s/.test(line) ? 'import' as const
          : 'usage' as const;

        results.push({
          filePath,
          line: i + 1,
          column: match.index + 1,
          matchText: line.trim(),
          kind,
        });
        break; // 每行只记录一次 import 匹配
      }
    }

    // 检查符号引用
    if (symbolPattern) {
      symbolPattern.lastIndex = 0;
      const match = symbolPattern.exec(line);
      if (match) {
        // 跳过已被 import 匹配的行
        const alreadyMatched = results.some(r => r.filePath === filePath && r.line === i + 1);
        if (!alreadyMatched) {
          results.push({
            filePath,
            line: i + 1,
            column: match.index + 1,
            matchText: line.trim(),
            kind: 'usage',
          });
        }
      }
    }
  }

  return results;
}

/**
 * 查找目标文件的所有引用
 */
export function findReferences(
  target: string,
  projectRoot: string,
  options?: { symbol?: string; maxResults?: number },
): ReferenceFindResult {
  const start = Date.now();
  const maxResults = options?.maxResults ?? 100;

  // 收集源文件
  const sourceFiles: string[] = [];
  collectSourceFiles(projectRoot, sourceFiles);

  // 判断 target 是文件路径还是符号名
  const targetAbsPath = fs.existsSync(path.resolve(projectRoot, target))
    ? path.resolve(projectRoot, target)
    : null;

  // 构建搜索模式
  const importPatterns: RegExp[] = [];
  if (targetAbsPath) {
    const patterns = buildImportPatterns(targetAbsPath, projectRoot);
    for (const p of patterns) {
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      importPatterns.push(new RegExp(`['"\`](?:@/|~/|\\.{0,2}/)?(?:[^'"\`]*?/)?${escaped}(?:\\.[a-z]+)?['"\`]`, 'g'));
    }
  }

  const symbolPattern = options?.symbol ? buildSymbolPattern(options.symbol) : null;

  // 如果 target 不是文件路径，当作符号搜索
  if (!targetAbsPath && !symbolPattern) {
    const fallbackSymbol = buildSymbolPattern(target);
    const allRefs: ReferenceEntry[] = [];

    for (const file of sourceFiles) {
      if (allRefs.length >= maxResults) break;
      const refs = searchFileForReferences(file, [], fallbackSymbol, null);
      allRefs.push(...refs);
    }

    return {
      target,
      references: allRefs.slice(0, maxResults),
      searchedFiles: sourceFiles.length,
      durationMs: Date.now() - start,
    };
  }

  // 搜索所有文件
  const allRefs: ReferenceEntry[] = [];
  for (const file of sourceFiles) {
    if (allRefs.length >= maxResults) break;
    const refs = searchFileForReferences(file, importPatterns, symbolPattern, targetAbsPath);
    allRefs.push(...refs);
  }

  return {
    target,
    references: allRefs.slice(0, maxResults),
    searchedFiles: sourceFiles.length,
    durationMs: Date.now() - start,
  };
}

/**
 * 查找与目标文件关联的测试文件
 */
export function findRelatedTests(
  targetPath: string,
  projectRoot: string,
): Array<{ testPath: string; sourcePath: string; confidence: 'exact' | 'pattern' | 'directory' }> {
  const results: Array<{ testPath: string; sourcePath: string; confidence: 'exact' | 'pattern' | 'directory' }> = [];
  const rel = path.relative(projectRoot, targetPath).replace(/\\/g, '/');
  const parsed = path.parse(rel);
  const baseName = parsed.name;

  // 精确匹配：同名 .spec / .test 文件
  const exactPatterns = [
    `${baseName}.spec.ts`, `${baseName}.spec.tsx`,
    `${baseName}.test.ts`, `${baseName}.test.tsx`,
    `${baseName}.spec.js`, `${baseName}.spec.jsx`,
    `${baseName}.test.js`, `${baseName}.test.jsx`,
  ];

  // 搜索常见测试目录
  const testDirs = [
    path.dirname(path.join(projectRoot, rel)),                    // 同目录
    path.join(projectRoot, '__tests__'),                          // 根 __tests__
    path.join(projectRoot, 'test'),                               // 根 test
    path.join(projectRoot, 'tests'),                              // 根 tests
    path.join(projectRoot, 'src', '__tests__'),                   // src/__tests__
    path.join(path.dirname(path.join(projectRoot, rel)), '__tests__'), // 同级 __tests__
  ];

  const seen = new Set<string>();

  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) continue;

    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const normalized = path.resolve(fullPath);
      if (seen.has(normalized)) continue;

      // 精确匹配
      if (exactPatterns.includes(entry)) {
        seen.add(normalized);
        results.push({
          testPath: path.relative(projectRoot, fullPath).replace(/\\/g, '/'),
          sourcePath: rel,
          confidence: 'exact',
        });
        continue;
      }

      // 模式匹配：文件名包含目标基础名
      if (
        (entry.includes('.spec.') || entry.includes('.test.'))
        && entry.includes(baseName)
      ) {
        seen.add(normalized);
        results.push({
          testPath: path.relative(projectRoot, fullPath).replace(/\\/g, '/'),
          sourcePath: rel,
          confidence: 'pattern',
        });
      }
    }
  }

  // 目录级匹配：同目录下所有测试文件
  if (results.length === 0) {
    const sourceDir = path.dirname(path.join(projectRoot, rel));
    if (fs.existsSync(sourceDir)) {
      try {
        const entries = fs.readdirSync(sourceDir);
        for (const entry of entries) {
          if (entry.includes('.spec.') || entry.includes('.test.')) {
            const fullPath = path.join(sourceDir, entry);
            const normalized = path.resolve(fullPath);
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            results.push({
              testPath: path.relative(projectRoot, fullPath).replace(/\\/g, '/'),
              sourcePath: rel,
              confidence: 'directory',
            });
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return results;
}

// CLI 入口
function showHelp(): void {
  console.log(`
Reference Finder - 轻量级引用追踪器

用法:
  node .codebuddy/scripts/reference-finder.js <target> [options]

参数:
  target                目标文件路径或符号名

选项:
  --symbol <name>       额外搜索指定符号的引用
  --max <n>             最大结果数（默认: 100）
  --tests               同时查找关联测试文件
  --json                以 JSON 格式输出
  -h, --help            显示帮助
`);
}

function main(): void {
  const args = process.argv.slice(2);

  let target = '';
  let symbol: string | undefined;
  let maxResults = 100;
  let findTests = false;
  let jsonOutput = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') { help = true; continue; }
    if (arg === '--symbol' && args[i + 1]) { symbol = args[++i]; continue; }
    if (arg === '--max' && args[i + 1]) { maxResults = parseInt(args[++i], 10) || 100; continue; }
    if (arg === '--tests') { findTests = true; continue; }
    if (arg === '--json') { jsonOutput = true; continue; }
    if (!arg.startsWith('-') && !target) { target = arg; }
  }

  if (help || !target) {
    showHelp();
    process.exit(target ? 0 : 1);
  }

  const projectRoot = process.cwd();
  const result = findReferences(target, projectRoot, { symbol, maxResults });

  if (jsonOutput) {
    const output: Record<string, unknown> = { ...result };
    if (findTests) {
      const absTarget = fs.existsSync(path.resolve(projectRoot, target))
        ? path.resolve(projectRoot, target)
        : null;
      if (absTarget) {
        output.relatedTests = findRelatedTests(absTarget, projectRoot);
      }
    }
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`\n引用追踪: ${result.target}`);
    console.log(`扫描文件: ${result.searchedFiles}，耗时: ${result.durationMs}ms`);
    console.log(`找到 ${result.references.length} 处引用:\n`);

    for (const ref of result.references) {
      const relPath = path.relative(projectRoot, ref.filePath).replace(/\\/g, '/');
      console.log(`  ${relPath}:${ref.line} [${ref.kind}]`);
      console.log(`    ${ref.matchText}`);
    }

    if (findTests) {
      const absTarget = fs.existsSync(path.resolve(projectRoot, target))
        ? path.resolve(projectRoot, target)
        : null;
      if (absTarget) {
        const tests = findRelatedTests(absTarget, projectRoot);
        if (tests.length > 0) {
          console.log(`\n关联测试文件 (${tests.length}):\n`);
          for (const t of tests) {
            console.log(`  ${t.testPath} [${t.confidence}]`);
          }
        }
      }
    }
  }
}

if (require.main === module) {
  main();
}
