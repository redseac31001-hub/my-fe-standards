#!/usr/bin/env node
/**
 * Structure Analyzer - 项目结构分析器
 *
 * 扫描目标项目目录结构，检测反模式并生成健康度报告。
 *
 * 用法: node structure-analyzer.js <path> [options]
 *   --mode <mode>       输出模式: problems_only | summary | full (默认: problems_only)
 *   --output <format>   输出格式: json | markdown | both (默认: markdown)
 *   --config <path>     自定义配置文件路径
 *   --max-depth <n>     最大扫描深度 (默认: 10)
 *   --limit <n>         TopN 文件数量 (默认: 20)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  AnalyzeOptions,
  AnalysisResult,
  AnalysisSummary,
  AnalysisScores,
  ScoreBreakdown,
  Violation,
  ViolationCode,
  DirectoryNode,
  FileInfo,
  StructureAnalyzerConfig,
  SA001Context,
  ScanContext,
  EngineeringScorecard,
  DEFAULT_CONFIG,
  HealthDimensionCriterion,
  HealthDimensionId,
  HealthDimensionScore,
  HealthDimensionStatus,
} from './types/structure-analyzer';
import {
  ArchitectureSnapshot,
  HealthDataPoint,
} from './types/reports';
import {
  saveArchitectureSnapshot,
  appendHealthDataPoint,
  readManifest,
  getReportAgeHours,
  getReportsPath,
} from './report-manager';
import { isDirectCliEntry } from './lib/cli-entry';

// ============ 配置加载 ============

/**
 * 加载配置（双层：project > global > default）
 */
function loadConfig(targetPath: string, customConfigPath?: string): { config: StructureAnalyzerConfig; source: 'project' | 'global' | 'default' } {
  // 1. 尝试加载自定义配置
  if (customConfigPath) {
    const customConfig = tryLoadJsonFile(customConfigPath);
    if (customConfig) {
      return { config: mergeConfig(DEFAULT_CONFIG, customConfig), source: 'project' };
    }
  }

  // 2. 尝试加载项目级配置
  const projectConfigPath = path.join(targetPath, '.structure-analyzer.json');
  const projectConfig = tryLoadJsonFile(projectConfigPath);
  if (projectConfig) {
    return { config: mergeConfig(DEFAULT_CONFIG, projectConfig), source: 'project' };
  }

  // 3. 尝试加载全局配置
  const globalConfigPath = path.resolve(__dirname, '../../config/loader-config.json');
  const globalConfig = tryLoadJsonFile(globalConfigPath);
  if (globalConfig?.structureAnalyzer && typeof globalConfig.structureAnalyzer === 'object') {
    return { config: mergeConfig(DEFAULT_CONFIG, globalConfig.structureAnalyzer as Record<string, unknown>), source: 'global' };
  }

  // 4. 使用默认配置
  return { config: DEFAULT_CONFIG, source: 'default' };
}

/**
 * 尝试加载 JSON 文件
 */
function tryLoadJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // 忽略解析错误
  }
  return null;
}

/**
 * 合并配置
 */
function mergeConfig(base: StructureAnalyzerConfig, override: Record<string, unknown>): StructureAnalyzerConfig {
  const result = { ...base };

  if (override.thresholds && typeof override.thresholds === 'object') {
    result.thresholds = { ...base.thresholds, ...(override.thresholds as Record<string, unknown>) } as typeof base.thresholds;
  }
  if (override.enabledRules && Array.isArray(override.enabledRules)) {
    result.enabledRules = override.enabledRules as ViolationCode[];
  }
  if (override.ignorePatterns && Array.isArray(override.ignorePatterns)) {
    result.ignorePatterns = [...base.ignorePatterns, ...(override.ignorePatterns as string[])];
  }
  if (override.typeGroupedPatterns && Array.isArray(override.typeGroupedPatterns)) {
    result.typeGroupedPatterns = override.typeGroupedPatterns as string[];
  }
  if (override.sa001Whitelist && Array.isArray(override.sa001Whitelist)) {
    result.sa001Whitelist = override.sa001Whitelist as string[];
  }
  if (typeof override.sa001MinFiles === 'number') {
    result.sa001MinFiles = override.sa001MinFiles;
  }
  if (override.sa004 && typeof override.sa004 === 'object') {
    result.sa004 = { ...base.sa004, ...(override.sa004 as Record<string, unknown>) } as typeof base.sa004;
  }

  return result;
}

// ============ 目录扫描 ============

/**
 * 扫描目录结构
 */
function scanDirectory(
  dirPath: string,
  config: StructureAnalyzerConfig,
  context: ScanContext,
  maxDepth: number
): DirectoryNode | null {
  if (context.currentDepth > maxDepth) {
    return null;
  }

  const name = path.basename(dirPath);

  // 检查忽略模式
  if (shouldIgnore(name, config.ignorePatterns)) {
    return null;
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(dirPath);
  } catch {
    return null;
  }

  if (stat.isFile()) {
    const ext = path.extname(name).toLowerCase();
    const sizeKB = Math.round(stat.size / 1024 * 100) / 100;
    const lines = countFileLines(dirPath);

    // 更新统计
    context.allFiles.push({ path: dirPath, lines, sizeKB });
    context.extensionStats[ext] = (context.extensionStats[ext] || 0) + 1;

    return {
      name,
      type: 'file',
      path: dirPath,
      stats: { lines, sizeKB },
    };
  }

  if (stat.isDirectory()) {
    // 检测 features 目录
    if (name === 'features') {
      context.hasFeatureDir = true;
    }

    let entries: string[];
    try {
      entries = fs.readdirSync(dirPath);
    } catch {
      return null;
    }

    const children: DirectoryNode[] = [];
    for (const entry of entries) {
      const childPath = path.join(dirPath, entry);
      const childNode = scanDirectory(childPath, config, { ...context, currentDepth: context.currentDepth + 1 }, maxDepth);
      if (childNode) {
        children.push(childNode);
      }
    }

    return {
      name,
      type: 'directory',
      path: dirPath,
      children: children.length > 0 ? children : undefined,
    };
  }

  return null;
}

/**
 * 检查是否应该忽略
 */
function shouldIgnore(name: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.startsWith('*.')) {
      // 扩展名匹配
      const ext = pattern.slice(1);
      if (name.endsWith(ext)) {
        return true;
      }
    } else if (name === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * 计算文件行数
 */
function countFileLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

// ============ 规则检测 ============

/**
 * 运行所有检测规则
 */
function runRules(
  root: DirectoryNode,
  config: StructureAnalyzerConfig,
  context: ScanContext
): Violation[] {
  const violations: Violation[] = [];

  // 遍历目录树
  traverseTree(root, (node, depth, parentPath) => {
    if (config.enabledRules.includes('SA001') && node.type === 'directory') {
      const v = checkSA001(node, config, context);
      if (v) violations.push(v);
    }

    if (config.enabledRules.includes('SA002') && node.type === 'directory') {
      const v = checkSA002(node, depth, config);
      if (v) violations.push(v);
    }

    if (config.enabledRules.includes('SA003') && node.type === 'file') {
      const v = checkSA003(node, config);
      if (v) violations.push(v);
    }

    if (config.enabledRules.includes('SA004') && node.type === 'directory' && node.children) {
      const vs = checkSA004(node, config, context);
      violations.push(...vs);
    }

    if (config.enabledRules.includes('SA005') && node.type === 'directory') {
      const v = checkSA005(node, config);
      if (v) violations.push(v);
    }
  });

  return violations;
}

/**
 * 遍历目录树
 */
function traverseTree(
  node: DirectoryNode,
  callback: (node: DirectoryNode, depth: number, parentPath: string) => void,
  depth: number = 0,
  parentPath: string = ''
): void {
  callback(node, depth, parentPath);

  if (node.children) {
    for (const child of node.children) {
      traverseTree(child, callback, depth + 1, node.path);
    }
  }
}

/**
 * SA001: 检测按类型分组的目录
 */
function checkSA001(node: DirectoryNode, config: StructureAnalyzerConfig, context: ScanContext): Violation | null {
  const dirName = node.name.toLowerCase();

  // 检查是否匹配类型分组模式
  if (!config.typeGroupedPatterns.includes(dirName)) {
    return null;
  }

  // 智能豁免判断
  const sa001Context: SA001Context = {
    hasFeatureDir: context.hasFeatureDir,
    fileCount: countDirectoryFiles(node),
  };

  if (!shouldReportSA001(dirName, sa001Context, config)) {
    return null;
  }

  return {
    code: 'SA001',
    severity: 'warning',
    message: `目录 "${node.name}" 按类型分组，建议改用 Feature-Based 结构`,
    path: node.path,
    evidence: `包含 ${sa001Context.fileCount} 个文件`,
    suggestion: '将相关功能聚合到 features/ 目录下，按业务领域组织代码',
  };
}

/**
 * SA001 智能豁免判断
 */
function shouldReportSA001(dirName: string, context: SA001Context, config: StructureAnalyzerConfig): boolean {
  // 1. 白名单豁免
  if (config.sa001Whitelist.includes(dirName)) {
    return false;
  }

  // 2. 仅当项目存在 features/ 目录时才报警
  if (!context.hasFeatureDir) {
    return false;
  }

  // 3. 规模阈值
  if (context.fileCount < config.sa001MinFiles) {
    return false;
  }

  return true;
}

/**
 * 统计目录内文件数
 */
function countDirectoryFiles(node: DirectoryNode): number {
  let count = 0;
  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'file') {
        count++;
      } else {
        count += countDirectoryFiles(child);
      }
    }
  }
  return count;
}

/**
 * SA002: 检测过深嵌套
 */
function checkSA002(node: DirectoryNode, depth: number, config: StructureAnalyzerConfig): Violation | null {
  if (depth > config.thresholds.maxDirectoryDepth) {
    return {
      code: 'SA002',
      severity: 'warning',
      message: `目录嵌套深度 ${depth} 超过阈值 ${config.thresholds.maxDirectoryDepth}`,
      path: node.path,
      evidence: `当前深度: ${depth}`,
      suggestion: '考虑扁平化目录结构，或将深层模块提取为独立功能',
    };
  }
  return null;
}

/**
 * SA003: 检测巨型文件
 */
function checkSA003(node: DirectoryNode, config: StructureAnalyzerConfig): Violation | null {
  if (!node.stats) return null;

  const { lines, sizeKB } = node.stats;
  const { maxFileLines, maxFileSizeKB } = config.thresholds;

  if (lines && lines > maxFileLines) {
    return {
      code: 'SA003',
      severity: 'error',
      message: `文件行数 ${lines} 超过阈值 ${maxFileLines}`,
      path: node.path,
      evidence: `${lines} 行, ${sizeKB} KB`,
      suggestion: '将大文件拆分为多个小模块，每个模块职责单一',
    };
  }

  if (sizeKB && sizeKB > maxFileSizeKB) {
    return {
      code: 'SA003',
      severity: 'error',
      message: `文件大小 ${sizeKB}KB 超过阈值 ${maxFileSizeKB}KB`,
      path: node.path,
      evidence: `${lines} 行, ${sizeKB} KB`,
      suggestion: '检查是否包含不必要的资源或重复代码，考虑拆分',
    };
  }

  return null;
}

/**
 * SA004: 检测命名相似度
 */
function checkSA004(
  node: DirectoryNode,
  config: StructureAnalyzerConfig,
  context: ScanContext
): Violation[] {
  const violations: Violation[] = [];
  const { sa004 } = config;

  if (!sa004.enabled || !node.children) {
    return violations;
  }

  // 获取符合条件的子项名称
  const names = node.children
    .map(c => c.name)
    .filter(n => n.length >= sa004.minNameLength);

  // 限制比较对数
  let pairsChecked = 0;
  const maxPairs = sa004.maxPairsPerDirectory;

  for (let i = 0; i < names.length && pairsChecked < maxPairs; i++) {
    for (let j = i + 1; j < names.length && pairsChecked < maxPairs; j++) {
      // 检查全局限制
      if (context.sa004CheckCount >= sa004.maxTotalChecks) {
        return violations;
      }

      const similarity = calculateSimilarity(names[i], names[j]);
      context.sa004CheckCount++;
      pairsChecked++;

      if (similarity >= sa004.similarityThreshold) {
        violations.push({
          code: 'SA004',
          severity: 'warning',
          message: `命名相似度过高: "${names[i]}" 与 "${names[j]}" (${Math.round(similarity * 100)}%)`,
          path: node.path,
          evidence: `相似度: ${Math.round(similarity * 100)}%`,
          suggestion: '使用更具区分度的命名，或考虑合并相似模块',
        });
      }
    }
  }

  return violations;
}

/**
 * 计算 Levenshtein 相似度
 */
function calculateSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0) return lenB === 0 ? 1 : 0;
  if (lenB === 0) return 0;

  // Levenshtein 距离
  const matrix: number[][] = [];

  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[lenA][lenB];
  const maxLen = Math.max(lenA, lenB);
  return 1 - distance / maxLen;
}

/**
 * SA005: 检测 feature 模块越权（简化版）
 */
function checkSA005(node: DirectoryNode, config: StructureAnalyzerConfig): Violation | null {
  // 检测 features/*/internal/ 目录
  if (!node.path.includes('features')) {
    return null;
  }

  const pathParts = node.path.split(path.sep);
  const featuresIndex = pathParts.indexOf('features');

  if (featuresIndex === -1) {
    return null;
  }

  // 检查是否是 internal 目录
  if (node.name === 'internal') {
    // 这是一个 internal 目录，记录但不报警
    // 实际的越权检测需要分析 import 语句，这里简化为只提示
    return {
      code: 'SA005',
      severity: 'info',
      message: `发现内部模块目录，请确保其他 feature 不直接引用此目录`,
      path: node.path,
      suggestion: '使用公共导出接口（index.ts）暴露必要的 API',
    };
  }

  return null;
}

// ============ 评分算法 ============

type FileNamingStyle = 'kebab' | 'camel' | 'pascal' | 'snake' | 'other';

interface PackageJsonLike {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  eslintConfig?: Record<string, unknown>;
  prettier?: unknown;
  packageManager?: string;
  'lint-staged'?: unknown;
  'simple-git-hooks'?: unknown;
}

interface ProjectSignals {
  sourceFiles: FileInfo[];
  tsSourceFiles: FileInfo[];
  vueTsSourceFiles: FileInfo[];
  sourceFileContents: Map<string, string>;
  sourceFileCount: number;
  testFilesCount: number;
  readmeExists: boolean;
  docsDirExists: boolean;
  projectDocsExists: boolean;
  eslintConfigured: boolean;
  eslintRulesCount: number | null;
  prettierConfigured: boolean;
  preCommitConfigured: boolean;
  buildConfigured: boolean;
  testFrameworkConfigured: boolean;
  coverageConfigured: boolean;
  coverageReportExists: boolean;
  lintViolationCount: number | null;
  lockfileExists: boolean;
  packageManagerPinned: boolean;
  dependencyCount: number;
  wildcardDependencyCount: number;
  dynamicImportCount: number;
  splitConfigHints: boolean;
  anyCount: number;
  docCommentFileCount: number;
  lineBelow300Ratio: number;
  namingDominantStyle: FileNamingStyle | null;
  namingDominantRatio: number;
  namingSampleCount: number;
  namingStyleCounts: Record<FileNamingStyle, number>;
  hasTsConfig: boolean;
  tsconfigStrict: boolean;
  hasJsOrTsSource: boolean;
  effectiveTsSourceCount: number;
  hasTypeScriptSignal: boolean;
}

const SOURCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue']);
const TYPESCRIPT_EXTENSIONS = new Set(['.ts', '.tsx']);
const ESLINT_CONFIG_FILES = [
  'eslint.config.js',
  'eslint.config.cjs',
  'eslint.config.mjs',
  'eslint.config.ts',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
];
const PRETTIER_CONFIG_FILES = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
];
const BUILD_CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.js',
  'webpack.config.js',
  'webpack.config.ts',
  'rollup.config.js',
  'rollup.config.ts',
  'rspack.config.js',
  'rspack.config.ts',
  'next.config.js',
  'next.config.mjs',
];
const TEST_CONFIG_FILES = [
  'vitest.config.ts',
  'vitest.config.js',
  'jest.config.js',
  'jest.config.ts',
  'playwright.config.ts',
  'playwright.config.js',
  'cypress.config.ts',
  'cypress.config.js',
];
const COVERAGE_REPORT_FILES = [
  path.join('coverage', 'coverage-summary.json'),
  path.join('coverage', 'lcov.info'),
];
const LINT_REPORT_FILES = [
  'eslint-report.json',
  path.join('reports', 'eslint-report.json'),
  path.join('.codebuddy', 'reports', 'eslint-report.json'),
];

function isSourceCodeFile(filePath: string): boolean {
  return SOURCE_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isTypeScriptFile(filePath: string): boolean {
  return TYPESCRIPT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isLikelyTestFile(filePath: string): boolean {
  return /(?:^|[\\/])(?:test|tests|__tests__)(?:[\\/]|$)|\.(?:spec|test)\.[^.]+$/i.test(filePath);
}

function safeReadJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function safeReadTextFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function findFirstExistingFile(targetPath: string, candidates: string[]): string | null {
  for (const relativePath of candidates) {
    const fullPath = path.join(targetPath, relativePath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

function hasAnyScriptMatch(scripts: Record<string, string> | undefined, pattern: RegExp): boolean {
  if (!scripts) {
    return false;
  }
  return Object.values(scripts).some(script => pattern.test(script));
}

function collectFilesRecursively(dirPath: string, depth: number = 0, maxDepth: number = 4): string[] {
  if (!fs.existsSync(dirPath) || depth > maxDepth) {
    return [];
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(dirPath);
  } catch {
    return [];
  }

  if (stat.isFile()) {
    return [dirPath];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  const ignored = new Set(['node_modules', 'dist', '.git', '.codebuddy', 'coverage']);
  const files: string[] = [];
  for (const entry of fs.readdirSync(dirPath)) {
    if (ignored.has(entry)) {
      continue;
    }
    files.push(...collectFilesRecursively(path.join(dirPath, entry), depth + 1, maxDepth));
  }
  return files;
}

function countMatches(text: string, pattern: RegExp): number {
  const regex = new RegExp(pattern.source, pattern.flags);
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function isVueTypeScriptSfc(filePath: string, content: string): boolean {
  return path.extname(filePath).toLowerCase() === '.vue'
    && /<script\b[^>]*\blang\s*=\s*["']ts["'][^>]*>/i.test(content);
}

function detectFileNamingStyle(filePath: string): FileNamingStyle | null {
  const name = path.basename(filePath, path.extname(filePath));
  if (name === 'index') {
    return null;
  }
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    return 'kebab';
  }
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) {
    return 'camel';
  }
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    return 'pascal';
  }
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(name)) {
    return 'snake';
  }
  return 'other';
}

function formatNamingStyle(style: FileNamingStyle | null): string {
  switch (style) {
    case 'kebab':
      return 'kebab-case';
    case 'camel':
      return 'camelCase';
    case 'pascal':
      return 'PascalCase';
    case 'snake':
      return 'snake_case';
    case 'other':
      return 'other';
    default:
      return 'unknown';
  }
}

function formatNamingDistribution(counts: Record<FileNamingStyle, number>, sampleCount: number): string {
  if (sampleCount <= 0) {
    return '无可统计样本';
  }

  return (Object.entries(counts) as Array<[FileNamingStyle, number]>)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([style, count]) => `${formatNamingStyle(style)} ${Math.round((count / sampleCount) * 100)}% (${count})`)
    .join(', ');
}

function calculateLargeFileDisciplineScore(largeFileCount: number): number {
  if (largeFileCount <= 0) {
    return 25;
  }

  const penalty = Math.min(25, Math.ceil(6 * Math.log2(largeFileCount + 1)));
  return Math.max(0, 25 - penalty);
}

function extractRulesCountFromEslintConfig(packageJson: PackageJsonLike | null, targetPath: string): number | null {
  if (packageJson?.eslintConfig && typeof packageJson.eslintConfig === 'object') {
    const rules = packageJson.eslintConfig.rules;
    if (rules && typeof rules === 'object') {
      return Object.keys(rules).length;
    }
  }

  const eslintConfigPath = findFirstExistingFile(targetPath, ESLINT_CONFIG_FILES);
  if (!eslintConfigPath) {
    return null;
  }

  if (eslintConfigPath.endsWith('.json') || eslintConfigPath.endsWith('.eslintrc')) {
    const parsed = safeReadJsonFile<Record<string, unknown>>(eslintConfigPath);
    const rules = parsed?.rules;
    if (rules && typeof rules === 'object') {
      return Object.keys(rules as Record<string, unknown>).length;
    }
  }

  const content = safeReadTextFile(eslintConfigPath);
  if (!content) {
    return null;
  }

  const match = content.match(/rules\s*:\s*{([\s\S]*?)}/m);
  if (!match) {
    return null;
  }

  const ruleMatches = match[1].match(/(?:['"])?[@\w/-]+(?:['"])?\s*:/g);
  return ruleMatches ? ruleMatches.length : null;
}

function readLintViolationCount(targetPath: string): number | null {
  for (const relativePath of LINT_REPORT_FILES) {
    const fullPath = path.join(targetPath, relativePath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const parsed = safeReadJsonFile<unknown>(fullPath);
    if (!parsed) {
      continue;
    }

    if (Array.isArray(parsed)) {
      return parsed.length;
    }

    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      if (typeof record.errorCount === 'number' && typeof record.warningCount === 'number') {
        return record.errorCount + record.warningCount;
      }
      if (Array.isArray(record.results)) {
        return record.results.reduce((sum, result) => {
          if (typeof result !== 'object' || result === null) {
            return sum;
          }
          const resultRecord = result as Record<string, unknown>;
          if (Array.isArray(resultRecord.messages)) {
            return sum + resultRecord.messages.length;
          }
          return sum;
        }, 0);
      }
    }
  }
  return null;
}

function collectProjectSignals(targetPath: string, allFiles: FileInfo[]): ProjectSignals {
  const packageJson = safeReadJsonFile<PackageJsonLike>(path.join(targetPath, 'package.json'));
  const sourceFiles = allFiles.filter(file => isSourceCodeFile(file.path));
  const tsSourceFiles = sourceFiles.filter(file => isTypeScriptFile(file.path));
  const vueTsSourceFiles: FileInfo[] = [];
  const sourceFileContents = new Map<string, string>();
  let dynamicImportCount = 0;
  let anyCount = 0;
  let docCommentFileCount = 0;

  for (const file of sourceFiles) {
    const content = safeReadTextFile(file.path);
    if (!content) {
      continue;
    }
    sourceFileContents.set(file.path, content);
    if (isVueTypeScriptSfc(file.path, content)) {
      vueTsSourceFiles.push(file);
    }
    dynamicImportCount += countMatches(content, /\bimport\s*\(/g);
    anyCount += countMatches(content, /\bas\s+any\b|:\s*any\b|<any>/g);
    if (content.includes('/**')) {
      docCommentFileCount++;
    }
  }

  const additionalTestFiles = [
    ...collectFilesRecursively(path.join(targetPath, 'test')),
    ...collectFilesRecursively(path.join(targetPath, 'tests')),
    ...collectFilesRecursively(path.join(targetPath, '__tests__')),
    ...collectFilesRecursively(path.join(targetPath, 'cypress')),
    ...collectFilesRecursively(path.join(targetPath, 'playwright')),
  ];
  const testFiles = new Set<string>([
    ...sourceFiles.filter(file => isLikelyTestFile(file.path)).map(file => file.path),
    ...additionalTestFiles.filter(filePath => isLikelyTestFile(filePath) || /\.(?:js|ts|tsx|jsx)$/.test(filePath)),
  ]);

  const namingStyles = sourceFiles
    .map(file => detectFileNamingStyle(file.path))
    .filter((style): style is FileNamingStyle => style !== null);
  const namingCounts = namingStyles.reduce<Record<FileNamingStyle, number>>((acc, style) => {
    acc[style] = (acc[style] || 0) + 1;
    return acc;
  }, { kebab: 0, camel: 0, pascal: 0, snake: 0, other: 0 });
  const namingEntries = Object.entries(namingCounts) as Array<[FileNamingStyle, number]>;
  const [namingDominantStyle, namingDominantCount] = namingEntries.sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const tsconfig = safeReadJsonFile<Record<string, unknown>>(path.join(targetPath, 'tsconfig.json'));
  const compilerOptions = (tsconfig?.compilerOptions && typeof tsconfig.compilerOptions === 'object')
    ? tsconfig.compilerOptions as Record<string, unknown>
    : null;
  const effectiveTsSourceCount = tsSourceFiles.length + vueTsSourceFiles.length;

  const configFiles = [
    ...BUILD_CONFIG_FILES,
    ...TEST_CONFIG_FILES,
    ...ESLINT_CONFIG_FILES,
    ...PRETTIER_CONFIG_FILES,
  ]
    .map(relativePath => path.join(targetPath, relativePath))
    .filter(fullPath => fs.existsSync(fullPath));
  const configTexts = configFiles
    .map(fullPath => safeReadTextFile(fullPath))
    .filter((content): content is string => Boolean(content));

  const dependencyVersions = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };
  const dependencyVersionValues = Object.values(dependencyVersions);

  const sourceFileCount = sourceFiles.length;
  const lineBelow300Ratio = sourceFileCount === 0
    ? 0
    : sourceFiles.filter(file => file.lines < 300).length / sourceFileCount;

  const readmeExists = ['README.md', 'README.MD'].some(fileName => fs.existsSync(path.join(targetPath, fileName)));
  const docsDirExists = fs.existsSync(path.join(targetPath, 'docs'));
  const projectDocsExists = docsDirExists
    || fs.existsSync(path.join(targetPath, 'PROJECT.md'))
    || fs.existsSync(path.join(targetPath, 'ROADMAP.md'));

  const eslintRulesCount = extractRulesCountFromEslintConfig(packageJson, targetPath);

  return {
    sourceFiles,
    tsSourceFiles,
    vueTsSourceFiles,
    sourceFileContents,
    sourceFileCount,
    testFilesCount: testFiles.size,
    readmeExists,
    docsDirExists,
    projectDocsExists,
    eslintConfigured: Boolean(packageJson?.eslintConfig) || Boolean(findFirstExistingFile(targetPath, ESLINT_CONFIG_FILES)),
    eslintRulesCount,
    prettierConfigured: packageJson?.prettier !== undefined || Boolean(findFirstExistingFile(targetPath, PRETTIER_CONFIG_FILES)),
    preCommitConfigured:
      fs.existsSync(path.join(targetPath, '.husky', 'pre-commit'))
      || packageJson?.['lint-staged'] !== undefined
      || packageJson?.['simple-git-hooks'] !== undefined,
    buildConfigured:
      Boolean(packageJson?.scripts?.build)
      || Boolean(findFirstExistingFile(targetPath, BUILD_CONFIG_FILES)),
    testFrameworkConfigured:
      Boolean(packageJson?.scripts?.test)
      || Boolean(findFirstExistingFile(targetPath, TEST_CONFIG_FILES))
      || testFiles.size > 0,
    coverageConfigured:
      hasAnyScriptMatch(packageJson?.scripts, /coverage/i)
      || COVERAGE_REPORT_FILES.some(relativePath => fs.existsSync(path.join(targetPath, relativePath))),
    coverageReportExists: COVERAGE_REPORT_FILES.some(relativePath => fs.existsSync(path.join(targetPath, relativePath))),
    lintViolationCount: readLintViolationCount(targetPath),
    lockfileExists: [
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'bun.lock',
      'bun.lockb',
    ].some(fileName => fs.existsSync(path.join(targetPath, fileName))),
    packageManagerPinned: typeof packageJson?.packageManager === 'string' && packageJson.packageManager.length > 0,
    dependencyCount: dependencyVersionValues.length,
    wildcardDependencyCount: dependencyVersionValues.filter(version => /^(\*|latest|next)$/i.test(version.trim()) || /\bx\b/i.test(version)).length,
    dynamicImportCount,
    splitConfigHints: configTexts.some(content => /manualChunks|splitChunks|dynamicImportVars|lazy/i.test(content)),
    anyCount,
    docCommentFileCount,
    lineBelow300Ratio,
    namingDominantStyle,
    namingDominantRatio: namingStyles.length > 0 ? namingDominantCount / namingStyles.length : 0,
    namingSampleCount: namingStyles.length,
    namingStyleCounts: namingCounts,
    hasTsConfig: Boolean(tsconfig),
    tsconfigStrict: Boolean(compilerOptions && typeof compilerOptions.strict === 'boolean' && compilerOptions.strict),
    hasJsOrTsSource: sourceFileCount > 0,
    effectiveTsSourceCount,
    hasTypeScriptSignal: effectiveTsSourceCount > 0 || Boolean(tsconfig),
  };
}

function createCriterion(
  label: string,
  maxScore: number,
  score: number,
  measured: boolean,
  met: boolean | null,
  note?: string
): HealthDimensionCriterion {
  return {
    label,
    score: Math.max(0, Math.min(maxScore, score)),
    maxScore,
    measured,
    met,
    note,
  };
}

function getDimensionStatus(score: number, weight: number): HealthDimensionStatus {
  if (score >= Math.ceil(weight * 0.8)) {
    return 'excellent';
  }
  if (score >= Math.ceil(weight * 0.6)) {
    return 'good';
  }
  return 'needs-improvement';
}

function createDimension(
  id: HealthDimensionId,
  label: string,
  weight: number,
  criteria: HealthDimensionCriterion[],
  measuredSummary: string,
  unmeasuredSummary: string
): HealthDimensionScore {
  const measuredCriteria = criteria.filter(item => item.measured);
  if (measuredCriteria.length === 0) {
    return {
      id,
      label,
      weight,
      score: null,
      maxScore: weight,
      measured: false,
      status: 'unmeasured',
      summary: unmeasuredSummary,
      criteria,
    };
  }

  const rawScore = measuredCriteria.reduce((sum, item) => sum + item.score, 0);
  const rawMaxScore = measuredCriteria.reduce((sum, item) => sum + item.maxScore, 0);
  const normalizedScore = rawMaxScore === 0
    ? 0
    : Math.max(0, Math.min(weight, Math.round((rawScore / rawMaxScore) * weight)));

  return {
    id,
    label,
    weight,
    score: normalizedScore,
    maxScore: weight,
    measured: true,
    status: getDimensionStatus(normalizedScore, weight),
    summary: measuredSummary,
    criteria,
  };
}

function buildEngineeringScorecard(
  counts: Record<ViolationCode, number>,
  breakdown: ScoreBreakdown,
  signals: ProjectSignals,
  hasFeatureDir: boolean
): EngineeringScorecard {
  const namingDistribution = formatNamingDistribution(signals.namingStyleCounts, signals.namingSampleCount);
  const architecture = createDimension(
    'architecture-structure',
    '架构与目录结构',
    15,
    [
      createCriterion('目录结构规则', 8, Math.round((breakdown.featureStructure / 25) * 8), true, breakdown.featureStructure >= 20, `当前 ${breakdown.featureStructure}/25`),
      createCriterion('目录深度控制', 4, Math.round((breakdown.depth / 25) * 4), true, breakdown.depth >= 20, `当前 ${breakdown.depth}/25`),
      createCriterion(
        'Feature 分层信号',
        3,
        hasFeatureDir ? 3 : (counts.SA001 === 0 ? 2 : 0),
        true,
        hasFeatureDir || counts.SA001 === 0,
        hasFeatureDir ? '检测到 features 目录' : '未检测到明确的 feature 目录'
      ),
    ],
    counts.SA001 > 0
      ? '存在类型分组/结构混用信号，目录仍需收敛。'
      : '结构规则整体稳定，目录深度保持在可控范围内。',
    '未检测到可用于判断架构结构的源码。'
  );

  const lintCriterion = signals.lintViolationCount === null
    ? createCriterion('Lint 违规数量', 7, 0, false, null, '未发现 lint 结果报告，未纳入扣分')
    : createCriterion(
      'Lint 违规数量',
      7,
      signals.lintViolationCount === 0 ? 7 : (signals.lintViolationCount <= 20 ? 4 : 0),
      true,
      signals.lintViolationCount <= 20,
      `当前 ${signals.lintViolationCount} 条`
    );
  const codeQuality = createDimension(
    'code-quality',
    '代码质量',
    20,
    [
      createCriterion(
        'ESLint 配置质量',
        5,
        !signals.eslintConfigured ? 0 : (signals.eslintRulesCount !== null && signals.eslintRulesCount > 10 ? 5 : 3),
        true,
        signals.eslintConfigured,
        signals.eslintConfigured
          ? `规则数 ${signals.eslintRulesCount ?? '未解析'}`
          : '未检测到 ESLint 配置'
      ),
      createCriterion('Prettier 配置', 3, signals.prettierConfigured ? 3 : 0, true, signals.prettierConfigured, signals.prettierConfigured ? '已配置格式化' : '未检测到 Prettier 配置'),
      lintCriterion,
      createCriterion(
        '单文件规模控制',
        3,
        signals.lineBelow300Ratio >= 0.9 ? 3 : signals.lineBelow300Ratio >= 0.75 ? 2 : signals.lineBelow300Ratio >= 0.5 ? 1 : 0,
        signals.sourceFileCount > 0,
        signals.lineBelow300Ratio >= 0.75,
        `小于 300 行占比 ${(signals.lineBelow300Ratio * 100).toFixed(0)}%`
      ),
      createCriterion('pre-commit 钩子', 2, signals.preCommitConfigured ? 2 : 0, true, signals.preCommitConfigured, signals.preCommitConfigured ? '已检测到提交前校验' : '未检测到提交前校验'),
    ],
    signals.lintViolationCount === null
      ? '基于静态配置与文件规模估算，lint 违规数尚未接入。'
      : '结合配置与 lint 结果评估代码质量。',
    '未检测到可用于判断代码质量的源码与工程配置。'
  );

  const tsCoverageRatio = signals.sourceFileCount === 0 ? 0 : signals.effectiveTsSourceCount / signals.sourceFileCount;
  const typeSafety = createDimension(
    'type-safety',
    '类型安全',
    15,
    [
      createCriterion(
        'strict 模式',
        6,
        signals.tsconfigStrict ? 6 : (signals.hasTsConfig ? 2 : (signals.effectiveTsSourceCount > 0 ? 1 : 0)),
        signals.hasTypeScriptSignal,
        signals.tsconfigStrict,
        signals.hasTsConfig
          ? (signals.tsconfigStrict ? 'tsconfig 已开启 strict' : 'tsconfig 存在但 strict 未开启')
          : (signals.vueTsSourceFiles.length > 0 ? '检测到 .vue 中的 lang="ts"，但未发现 tsconfig' : '未检测到 tsconfig')
      ),
      createCriterion(
        'TypeScript 覆盖率',
        5,
        tsCoverageRatio >= 0.8 ? 5 : tsCoverageRatio >= 0.5 ? 3 : tsCoverageRatio > 0 ? 1 : 0,
        signals.hasJsOrTsSource,
        tsCoverageRatio >= 0.5,
        `TS 信号占比 ${(tsCoverageRatio * 100).toFixed(0)}%（.ts/.tsx ${signals.tsSourceFiles.length}，.vue lang="ts" ${signals.vueTsSourceFiles.length}）`
      ),
      createCriterion(
        'any 使用控制',
        4,
        signals.effectiveTsSourceCount === 0 ? 0 : (signals.anyCount === 0 ? 4 : (signals.anyCount <= Math.max(2, signals.effectiveTsSourceCount) ? 2 : 0)),
        signals.effectiveTsSourceCount > 0,
        signals.anyCount <= Math.max(2, signals.effectiveTsSourceCount),
        signals.effectiveTsSourceCount > 0 ? `检测到 ${signals.anyCount} 处 any` : '无 TypeScript 信号'
      ),
    ],
    signals.effectiveTsSourceCount === 0
      ? '未发现明显的 TypeScript 覆盖，类型安全能力较弱。'
      : `已按 strict、TS 覆盖率与 any 使用情况评估类型安全（.ts/.tsx ${signals.tsSourceFiles.length}，.vue lang="ts" ${signals.vueTsSourceFiles.length}）。`,
    '未检测到 JS/TS 源码，暂无法判断类型安全。'
  );

  const testCoverage = createDimension(
    'test-coverage',
    '测试覆盖',
    15,
    [
      createCriterion(
        '测试文件存在性',
        6,
        signals.testFilesCount === 0 ? 0 : (signals.testFilesCount >= Math.max(3, Math.ceil(signals.sourceFileCount * 0.1)) ? 6 : 4),
        signals.hasJsOrTsSource,
        signals.testFilesCount > 0,
        `检测到 ${signals.testFilesCount} 个测试文件`
      ),
      createCriterion(
        '测试工具链',
        4,
        signals.testFrameworkConfigured ? 4 : 0,
        true,
        signals.testFrameworkConfigured,
        signals.testFrameworkConfigured ? '已检测到 test 脚本或测试配置' : '未检测到测试脚本/配置'
      ),
      createCriterion(
        '覆盖率信号',
        5,
        signals.coverageReportExists ? 5 : (signals.coverageConfigured ? 3 : 0),
        true,
        signals.coverageConfigured,
        signals.coverageReportExists ? '存在 coverage 报告' : (signals.coverageConfigured ? '存在 coverage 配置/脚本' : '未检测到 coverage 信号')
      ),
    ],
    signals.testFilesCount > 0
      ? '已检测到测试文件与工具链信号，可继续接入真实覆盖率数据。'
      : '测试资产较弱，当前主要依赖配置级信号。',
    '未检测到源码或测试资产，暂无法判断测试覆盖。'
  );

  const dependencyHealth = createDimension(
    'dependency-health',
    '依赖健康度',
    10,
    [
      createCriterion('锁文件', 3, signals.lockfileExists ? 3 : 0, signals.dependencyCount > 0 || signals.lockfileExists, signals.lockfileExists, signals.lockfileExists ? '已锁定依赖版本' : '未检测到锁文件'),
      createCriterion('包管理器声明', 2, signals.packageManagerPinned ? 2 : 0, signals.dependencyCount > 0 || signals.packageManagerPinned, signals.packageManagerPinned, signals.packageManagerPinned ? 'packageManager 已声明' : '未声明 packageManager'),
      createCriterion(
        '版本声明健康度',
        5,
        signals.dependencyCount === 0
          ? 0
          : (signals.wildcardDependencyCount === 0 ? 5 : (signals.wildcardDependencyCount / signals.dependencyCount <= 0.1 ? 3 : 0)),
        signals.dependencyCount > 0,
        signals.dependencyCount > 0 && signals.wildcardDependencyCount === 0,
        signals.dependencyCount > 0
          ? `宽松版本声明 ${signals.wildcardDependencyCount}/${signals.dependencyCount}`
          : '未检测到依赖声明'
      ),
    ],
    '当前基于锁文件、包管理器声明与版本约束做本地健康评估，未包含线上漏洞/过期检查。',
    '未检测到依赖清单，暂无法判断依赖健康度。'
  );

  const buildPerformance = createDimension(
    'build-performance',
    '构建与性能',
    10,
    [
      createCriterion('构建流水线', 3, signals.buildConfigured ? 3 : 0, signals.hasJsOrTsSource || signals.buildConfigured, signals.buildConfigured, signals.buildConfigured ? '已检测到构建脚本或配置' : '未检测到构建脚本/配置'),
      createCriterion(
        '懒加载/分包信号',
        4,
        signals.dynamicImportCount > 0 && signals.splitConfigHints ? 4 : (signals.dynamicImportCount > 0 || signals.splitConfigHints ? 2 : 0),
        signals.hasJsOrTsSource || signals.buildConfigured,
        signals.dynamicImportCount > 0 || signals.splitConfigHints,
        `dynamic import ${signals.dynamicImportCount} 次`
      ),
      createCriterion(
        '文件体积纪律',
        3,
        signals.lineBelow300Ratio >= 0.9 ? 3 : signals.lineBelow300Ratio >= 0.75 ? 2 : signals.lineBelow300Ratio >= 0.5 ? 1 : 0,
        signals.sourceFileCount > 0,
        signals.lineBelow300Ratio >= 0.75,
        `小于 300 行占比 ${(signals.lineBelow300Ratio * 100).toFixed(0)}%`
      ),
    ],
    '结合构建配置、懒加载信号与文件规模评估构建与性能基础。',
    '未检测到构建配置或源码，暂无法判断构建与性能。'
  );

  const namingConvention = createDimension(
    'naming-convention',
    '命名规范',
    10,
    [
      createCriterion(
        '文件命名一致性',
        6,
        signals.namingDominantRatio >= 0.8 ? 6 : (signals.namingDominantRatio >= 0.65 ? 5 : (signals.namingDominantRatio >= 0.5 ? 3 : (signals.namingDominantRatio >= 0.35 ? 1 : 0))),
        signals.namingSampleCount > 0,
        signals.namingDominantRatio >= 0.5,
        signals.namingSampleCount > 0
          ? `主流风格 ${formatNamingStyle(signals.namingDominantStyle)}，占比 ${(signals.namingDominantRatio * 100).toFixed(0)}%；分布：${namingDistribution}`
          : '无可统计文件名样本'
      ),
      createCriterion(
        '相似命名违规',
        4,
        counts.SA004 === 0 ? 4 : (counts.SA004 <= 2 ? 2 : 0),
        true,
        counts.SA004 === 0,
        `SA004 命中 ${counts.SA004} 次`
      ),
    ],
    counts.SA004 > 0
      ? `存在 ${counts.SA004} 处相似命名信号；当前文件命名分布为 ${namingDistribution}。`
      : `命名风格基本一致，当前文件命名分布为 ${namingDistribution}。`,
    '未检测到足够的源码文件名样本。'
  );

  const documentation = createDimension(
    'documentation',
    '文档完整性',
    5,
    [
      createCriterion('README', 2, signals.readmeExists ? 2 : 0, true, signals.readmeExists, signals.readmeExists ? 'README 已存在' : 'README 缺失'),
      createCriterion('项目文档', 2, signals.projectDocsExists ? 2 : 0, true, signals.projectDocsExists, signals.projectDocsExists ? '检测到 docs/ 或项目说明文档' : '未检测到项目文档目录'),
      createCriterion(
        '内联说明',
        1,
        signals.sourceFileCount > 0 && (signals.docCommentFileCount / signals.sourceFileCount >= 0.2) ? 1 : 0,
        signals.sourceFileCount > 0,
        signals.sourceFileCount > 0 && (signals.docCommentFileCount / signals.sourceFileCount >= 0.2),
        signals.sourceFileCount > 0
          ? `含注释块文件 ${signals.docCommentFileCount}/${signals.sourceFileCount}`
          : '无源码文件'
      ),
    ],
    '文档完整性基于 README、项目文档和源码注释信号估算。',
    '未检测到文档与源码，暂无法判断文档完整性。'
  );

  const dimensions = [
    architecture,
    codeQuality,
    typeSafety,
    testCoverage,
    dependencyHealth,
    buildPerformance,
    namingConvention,
    documentation,
  ];

  const measuredDimensions = dimensions.filter(dimension => dimension.measured);
  const measuredScore = measuredDimensions.reduce((sum, dimension) => sum + (dimension.score ?? 0), 0);
  const measuredWeight = measuredDimensions.reduce((sum, dimension) => sum + dimension.weight, 0);

  return {
    version: '2.0.0',
    measuredScore,
    measuredWeight,
    totalWeight: 100,
    normalizedScore: measuredWeight > 0 ? Math.round((measuredScore / measuredWeight) * 100) : null,
    measuredDimensions: measuredDimensions.length,
    unmeasuredDimensions: dimensions.length - measuredDimensions.length,
    dimensions,
  };
}

/**
 * 计算评分
 */
function calculateScores(
  violations: Violation[],
  context: ScanContext,
  targetPath: string
): AnalysisScores {
  // 按规则统计违规数量
  const counts: Record<ViolationCode, number> = {
    SA001: 0,
    SA002: 0,
    SA003: 0,
    SA004: 0,
    SA005: 0,
  };

  for (const v of violations) {
    counts[v.code]++;
  }

  // 计算各项得分
  const featureStructure = Math.max(0, 25 - counts.SA001 * 5);
  const depth = Math.max(0, 25 - counts.SA002 * 5);
  const fileSize = calculateLargeFileDisciplineScore(counts.SA003);
  const naming = Math.max(0, 25 - counts.SA004 * 5 - counts.SA005 * 1);

  const structureTotal = featureStructure + depth + fileSize + naming;
  const scorecard = buildEngineeringScorecard(
    counts,
    {
      featureStructure,
      depth,
      fileSize,
      naming,
    },
    collectProjectSignals(targetPath, context.allFiles),
    context.hasFeatureDir
  );

  return {
    total: scorecard.normalizedScore ?? structureTotal,
    structureTotal,
    breakdown: {
      featureStructure,
      depth,
      fileSize,
      naming,
    },
    scorecard,
  };
}

function formatDimensionStatus(status: HealthDimensionStatus): string {
  switch (status) {
    case 'excellent':
      return '✅ 优秀';
    case 'good':
      return '🟢 良好';
    case 'needs-improvement':
      return '⚠️ 需改进';
    case 'unmeasured':
    default:
      return '➖ 待检测';
  }
}

function formatDimensionScore(score: number | null, maxScore: number): string {
  return score === null ? 'N/A' : `${score}/${maxScore}`;
}

function formatCriterionStatus(criterion: HealthDimensionCriterion): string {
  if (!criterion.measured) {
    return '➖';
  }
  return criterion.met ? '✅' : '⚠️';
}

function collectQuickWins(scorecard: EngineeringScorecard): Array<{ dimension: HealthDimensionScore; criterion: HealthDimensionCriterion }> {
  return scorecard.dimensions
    .flatMap(dimension => dimension.criteria
      .filter(criterion => criterion.measured && criterion.met === false)
      .map(criterion => ({ dimension, criterion })))
    .sort((a, b) => {
      const deficitA = a.criterion.maxScore - a.criterion.score;
      const deficitB = b.criterion.maxScore - b.criterion.score;
      return deficitB - deficitA;
    })
    .slice(0, 3);
}

function describeQuickWin(dimension: HealthDimensionScore, criterion: HealthDimensionCriterion): string {
  const prefix = `${dimension.label} / ${criterion.label}`;
  switch (dimension.id) {
    case 'code-quality':
      if (criterion.label === 'Lint 违规数量') {
        return `${prefix}: 先清零高频 lint 违规，再重跑 lint 报告。`;
      }
      if (criterion.label === 'pre-commit 钩子') {
        return `${prefix}: 接入 pre-commit，至少阻断 lint/test 明显回退。`;
      }
      break;
    case 'type-safety':
      if (criterion.label === 'strict 模式') {
        return `${prefix}: 补齐 tsconfig 并评估开启 strict。`;
      }
      break;
    case 'test-coverage':
      if (criterion.label === '测试文件存在性') {
        return `${prefix}: 先为核心业务流补 1-3 个测试入口。`;
      }
      if (criterion.label === '覆盖率信号') {
        return `${prefix}: 输出 coverage 报告，避免测试维度长期只靠静态信号。`;
      }
      break;
    case 'build-performance':
      if (criterion.label === '文件体积纪律') {
        return `${prefix}: 优先拆分超大文件，先处理 Top 3 大文件。`;
      }
      break;
    case 'naming-convention':
      return `${prefix}: 统一主流命名风格，并清理相似命名目录。`;
    default:
      break;
  }

  return `${prefix}: ${criterion.note || '建议优先收敛该项'}。`;
}

// ============ 输出格式化 ============

/**
 * 生成 JSON 输出
 */
function formatJson(result: AnalysisResult, mode: 'problems_only' | 'summary' | 'full'): string {
  const output: Record<string, unknown> = {
    projectName: result.projectName,
    analyzedAt: result.analyzedAt,
    configSource: result.configSource,
    violations: result.violations,
    scores: result.scores,
  };

  if (mode === 'summary' || mode === 'full') {
    output.summary = result.summary;
  }

  if (mode === 'full' && result.structure) {
    output.structure = result.structure;
  }

  return JSON.stringify(output, null, 2);
}

/**
 * 生成 Markdown 输出
 */
function formatMarkdown(result: AnalysisResult): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# 项目结构分析报告`);
  lines.push('');
  lines.push(`> 项目: ${result.projectName}`);
  lines.push(`> 分析时间: ${result.analyzedAt}`);
  lines.push(`> 配置来源: ${result.configSource}`);
  lines.push(`> 评分说明: 工程健康度为 8 维评分卡；结构健康度单独展示`);
  lines.push('');

  // 工程健康度评分
  lines.push('## 📊 工程健康度评分卡');
  lines.push('');
  lines.push(`**总分: ${result.scores.total}/100**`);
  if (result.scores.scorecard.measuredWeight < result.scores.scorecard.totalWeight) {
    lines.push(`> 已测权重: ${result.scores.scorecard.measuredWeight}/${result.scores.scorecard.totalWeight}，总分按已测维度归一化`);
    lines.push('');
  }
  lines.push('');
  lines.push('| 维度 | 得分 | 状态 | 说明 |');
  lines.push('|------|------|------|------|');
  for (const dimension of result.scores.scorecard.dimensions) {
    lines.push(`| ${dimension.label} | ${formatDimensionScore(dimension.score, dimension.maxScore)} | ${formatDimensionStatus(dimension.status)} | ${dimension.summary} |`);
  }
  lines.push('');

  lines.push('### 维度细项');
  lines.push('');
  for (const dimension of result.scores.scorecard.dimensions) {
    lines.push(`#### ${dimension.label}`);
    lines.push('');
    lines.push(`- 得分: ${formatDimensionScore(dimension.score, dimension.maxScore)} (${formatDimensionStatus(dimension.status)})`);
    for (const criterion of dimension.criteria) {
      const note = criterion.note ? ` - ${criterion.note}` : '';
      lines.push(`- ${formatCriterionStatus(criterion)} ${criterion.label}: ${criterion.measured ? `${criterion.score}/${criterion.maxScore}` : 'N/A'}${note}`);
    }
    lines.push('');
  }

  // 结构健康度
  lines.push('## 🧱 结构健康度');
  lines.push('');
  lines.push(`**结构得分: ${result.scores.structureTotal}/100**`);
  lines.push(`> SA003 大文件扣分采用对数衰减，避免少量大文件与大量大文件被压成同一分数`);
  lines.push('');
  lines.push('| 维度 | 得分 |');
  lines.push('|------|------|');
  lines.push(`| 特性结构 | ${result.scores.breakdown.featureStructure}/25 |`);
  lines.push(`| 目录深度 | ${result.scores.breakdown.depth}/25 |`);
  lines.push(`| 文件大小 | ${result.scores.breakdown.fileSize}/25 |`);
  lines.push(`| 命名规范 | ${result.scores.breakdown.naming}/25 |`);
  lines.push('');

  // 摘要统计
  lines.push('## 📈 摘要统计');
  lines.push('');
  lines.push(`- 总文件数: ${result.summary.totalFiles}`);
  lines.push(`- 总目录数: ${result.summary.totalDirectories}`);
  lines.push(`- 最大深度: ${result.summary.maxDepth}`);
  lines.push('');

  // 扩展名统计
  if (Object.keys(result.summary.extensionStats).length > 0) {
    lines.push('### 文件类型分布');
    lines.push('');
    const sorted = Object.entries(result.summary.extensionStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [ext, count] of sorted) {
      lines.push(`- ${ext || '(无扩展名)'}: ${count}`);
    }
    lines.push('');
  }

  // 最大文件
  if (result.summary.topLargestFiles.length > 0) {
    lines.push('### 最大文件 Top 10');
    lines.push('');
    lines.push('| 文件 | 行数 | 大小 |');
    lines.push('|------|------|------|');
    for (const file of result.summary.topLargestFiles.slice(0, 10)) {
      const relativePath = file.path.length > 50 ? '...' + file.path.slice(-47) : file.path;
      lines.push(`| ${relativePath} | ${file.lines} | ${file.sizeKB}KB |`);
    }
    lines.push('');
  }

  // 违规项
  lines.push('## ⚠️ 违规项');
  lines.push('');

  if (result.violations.length === 0) {
    lines.push('✅ 未发现违规项');
  } else {
    // 按严重度分组
    const errors = result.violations.filter(v => v.severity === 'error');
    const warnings = result.violations.filter(v => v.severity === 'warning');
    const infos = result.violations.filter(v => v.severity === 'info');

    lines.push(`发现 ${result.violations.length} 个问题: ${errors.length} 个错误, ${warnings.length} 个警告, ${infos.length} 个提示`);
    lines.push('');

    lines.push('| 严重度 | 规则 | 位置 | 问题 | 建议 |');
    lines.push('|--------|------|------|------|------|');

    for (const v of result.violations) {
      const severity = v.severity === 'error' ? '🔴' : v.severity === 'warning' ? '🟡' : '🔵';
      const shortPath = v.path.length > 30 ? '...' + v.path.slice(-27) : v.path;
      lines.push(`| ${severity} ${v.severity} | ${v.code} | ${shortPath} | ${v.message} | ${v.suggestion} |`);
    }
  }
  lines.push('');

  // 下一步建议
  lines.push('## 🚀 下一步建议');
  lines.push('');

  const needsAttention = result.scores.scorecard.dimensions.filter(dimension => dimension.status === 'needs-improvement');
  const unmeasured = result.scores.scorecard.dimensions.filter(dimension => !dimension.measured);
  const quickWins = collectQuickWins(result.scores.scorecard);

  if (quickWins.length > 0) {
    lines.push('### 快速收益项');
    lines.push('');
    quickWins.forEach((item, index) => {
      lines.push(`${index + 1}. ${describeQuickWin(item.dimension, item.criterion)}`);
    });
    lines.push('');
  }

  if (result.scores.total >= 90) {
    lines.push('✅ 工程健康度良好，继续保持。');
  } else if (result.scores.total >= 70) {
    lines.push('⚠️ 工程健康度存在短板，建议优先收敛以下事项：');
    if (result.scores.breakdown.featureStructure < 20) {
      lines.push('1. 考虑将按类型分组的目录重构为 Feature-Based 结构');
    }
    if (result.scores.breakdown.fileSize < 20) {
      lines.push('2. 优先拆分超大文件，每个模块保持单一职责');
    }
    if (result.scores.breakdown.depth < 20) {
      lines.push('3. 扁平化过深的目录结构');
    }
    if (needsAttention.some(dimension => dimension.id === 'type-safety')) {
      lines.push('4. 补齐 TypeScript strict 与 any 收敛策略');
    }
    if (needsAttention.some(dimension => dimension.id === 'test-coverage')) {
      lines.push('5. 补充测试文件与 coverage 采集');
    }
  } else {
    lines.push('🔴 工程健康度需要较大改进：');
    lines.push('1. 建议制定重构计划，分阶段改进');
    lines.push('2. 优先处理 error 级别的问题');
    lines.push('3. 补齐 lint / test / build / docs 的基础工程能力');
  }

  if (unmeasured.length > 0) {
    lines.push('');
    lines.push('补充检测建议:');
    lines.push('1. 接入 lint、coverage、dependency audit 等结果文件，避免评分只依赖静态信号');
  }
  lines.push('');

  return lines.join('\n');
}

// ============ 主函数 ============

/**
 * 分析项目结构
 */
export function analyze(options: AnalyzeOptions): AnalysisResult {
  const {
    targetPath,
    srcDir = 'src',
    maxDepth = 10,
    mode = 'problems_only',
    limitTopFiles = 20,
  } = options;

  // 验证路径
  const fullPath = path.resolve(targetPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`目标路径不存在: ${fullPath}`);
  }

  // 确定扫描起点
  const srcPath = path.join(fullPath, srcDir);
  const scanPath = fs.existsSync(srcPath) ? srcPath : fullPath;

  // 加载配置
  const { config, source: configSource } = loadConfig(targetPath, options.configPath);

  // 初始化上下文
  const context: ScanContext = {
    currentDepth: 0,
    hasFeatureDir: false,
    sa004CheckCount: 0,
    allFiles: [],
    extensionStats: {},
  };

  // 扫描目录
  const structure = scanDirectory(scanPath, config, context, maxDepth);
  if (!structure) {
    throw new Error(`无法扫描目录: ${scanPath}`);
  }

  // 运行规则检测
  const violations = runRules(structure, config, context);

  // 计算评分
  const scores = calculateScores(violations, context, fullPath);

  // 生成摘要
  const topLargestFiles = [...context.allFiles]
    .sort((a, b) => b.lines - a.lines)
    .slice(0, limitTopFiles);

  let maxDepthFound = 0;
  traverseTree(structure, (_, depth) => {
    if (depth > maxDepthFound) maxDepthFound = depth;
  });

  const summary: AnalysisSummary = {
    totalFiles: context.allFiles.length,
    totalDirectories: countDirectories(structure),
    maxDepth: maxDepthFound,
    topLargestFiles,
    extensionStats: context.extensionStats,
  };

  // 构建结果
  const result: AnalysisResult = {
    projectName: path.basename(fullPath),
    analyzedAt: new Date().toISOString(),
    configSource,
    summary,
    violations,
    scores,
  };

  if (mode === 'full') {
    result.structure = structure;
  }

  return result;
}

/**
 * 统计目录数
 */
function countDirectories(node: DirectoryNode): number {
  let count = node.type === 'directory' ? 1 : 0;
  if (node.children) {
    for (const child of node.children) {
      count += countDirectories(child);
    }
  }
  return count;
}

// ============ 报告持久化 ============

/**
 * 将分析结果转换为架构快照
 */
function toArchitectureSnapshot(result: AnalysisResult): ArchitectureSnapshot {
  const issueCount = {
    error: result.violations.filter(v => v.severity === 'error').length,
    warning: result.violations.filter(v => v.severity === 'warning').length,
    info: result.violations.filter(v => v.severity === 'info').length,
  };

  // 判断结构类型
  let structureType: 'feature-based' | 'type-based' | 'hybrid' | 'unknown' = 'unknown';
  const hasFeatureViolations = result.violations.some(v => v.code === 'SA001');
  if (!hasFeatureViolations && result.scores.breakdown.featureStructure >= 20) {
    structureType = 'feature-based';
  } else if (hasFeatureViolations && result.scores.breakdown.featureStructure < 15) {
    structureType = 'type-based';
  } else if (hasFeatureViolations) {
    structureType = 'hybrid';
  }

  return {
    meta: {
      version: '1.0.0',
      projectName: result.projectName,
      analyzedAt: result.analyzedAt,
      analyzedBy: 'structure-analyzer',
    },
    summary: {
      healthScore: result.scores.total,
      structureHealthScore: result.scores.structureTotal,
      totalFiles: result.summary.totalFiles,
      totalLines: result.summary.topLargestFiles.reduce((sum, f) => sum + f.lines, 0),
      issueCount,
    },
    structure: {
      type: structureType,
      depth: result.summary.maxDepth,
      directories: result.summary.totalDirectories,
    },
    violations: result.violations.map(v => ({
      rule: v.code,
      severity: v.severity,
      path: v.path,
      message: v.message,
      suggestion: v.suggestion,
    })),
    scores: {
      featureStructure: result.scores.breakdown.featureStructure,
      directoryDepth: result.scores.breakdown.depth,
      fileSize: result.scores.breakdown.fileSize,
      namingConvention: result.scores.breakdown.naming,
    },
    scorecard: result.scores.scorecard,
  };
}

/**
 * 保存分析报告
 */
function saveReports(targetPath: string, result: AnalysisResult): void {
  try {
    // 保存 JSON 格式（机器可读）
    const snapshot = toArchitectureSnapshot(result);
    saveArchitectureSnapshot(targetPath, snapshot);

    // 保存 Markdown 格式（人类可读）
    const reportsPath = getReportsPath(targetPath);
    const archDir = path.join(reportsPath, 'architecture');
    if (!fs.existsSync(archDir)) {
      fs.mkdirSync(archDir, { recursive: true });
    }
    const markdownContent = formatMarkdown(result);
    fs.writeFileSync(path.join(archDir, 'latest.md'), markdownContent, 'utf-8');

    // 追加健康度数据点
    const today = new Date().toISOString().slice(0, 10);
    const dataPoint: HealthDataPoint = {
      date: today,
      healthScore: result.scores.total,
      breakdown: {
        architecture: result.scores.breakdown.featureStructure + result.scores.breakdown.depth,
        modules: 0, // 由 module-mapper 填充
        codeQuality: result.scores.breakdown.fileSize + result.scores.breakdown.naming,
      },
      snapshot: 'architecture/latest.json',
    };
    appendHealthDataPoint(targetPath, dataPoint);

    console.log(`[Reports] 已保存架构快照到 .codebuddy/reports/architecture/ (json + md)`);
  } catch (error) {
    console.warn(`[Reports] 保存报告失败: ${(error as Error).message}`);
  }
}

/**
 * 检查是否有可复用的报告
 */
function checkExistingReport(targetPath: string): { exists: boolean; ageHours: number } {
  try {
    const manifest = readManifest(targetPath);
    if (manifest.reports.architecture) {
      const ageHours = getReportAgeHours(manifest.reports.architecture.generatedAt);
      return { exists: true, ageHours };
    }
  } catch {
    // 忽略
  }
  return { exists: false, ageHours: -1 };
}

// ============ CLI 入口 ============

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]): AnalyzeOptions & { help?: boolean; noSave?: boolean } {
  const options: AnalyzeOptions & { help?: boolean; noSave?: boolean } = {
    targetPath: '',
    noSave: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--mode' && args[i + 1]) {
      options.mode = args[++i] as 'problems_only' | 'summary' | 'full';
    } else if (arg === '--output' && args[i + 1]) {
      options.outputFormat = args[++i] as 'json' | 'markdown' | 'both';
    } else if (arg === '--config' && args[i + 1]) {
      options.configPath = args[++i];
    } else if (arg === '--max-depth' && args[i + 1]) {
      options.maxDepth = parseInt(args[++i], 10);
    } else if (arg === '--limit' && args[i + 1]) {
      options.limitTopFiles = parseInt(args[++i], 10);
    } else if (arg === '--no-save') {
      options.noSave = true;
    } else if (!arg.startsWith('-') && !options.targetPath) {
      options.targetPath = arg;
    }
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(`
Structure Analyzer - 项目结构分析器

用法: node structure-analyzer.js <path> [options]

参数:
  <path>              目标项目路径

选项:
  --mode <mode>       输出模式: problems_only | summary | full (默认: problems_only)
  --output <format>   输出格式: json | markdown | both (默认: markdown)
  --config <path>     自定义配置文件路径
  --max-depth <n>     最大扫描深度 (默认: 10)
  --limit <n>         TopN 文件数量 (默认: 20)
  --no-save           不保存报告到 .codebuddy/reports/
  -h, --help          显示帮助信息

示例:
  node structure-analyzer.js ./my-project
  node structure-analyzer.js ./my-project --mode summary --output json
  node structure-analyzer.js ./my-project --config ./.structure-analyzer.json
`);
}

/**
 * 主入口
 */
function main(): void {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.targetPath) {
    console.error('错误: 请指定目标项目路径');
    showHelp();
    process.exit(1);
  }

  try {
    // 检查是否有可复用的报告
    const existing = checkExistingReport(options.targetPath);
    if (existing.exists && existing.ageHours < 24 && existing.ageHours >= 0) {
      console.log(`[Reports] 发现 ${existing.ageHours} 小时前的报告，可通过 --no-save 跳过保存`);
    }

    const result = analyze(options);
    const outputFormat = options.outputFormat || 'markdown';

    if (outputFormat === 'json' || outputFormat === 'both') {
      console.log(formatJson(result, options.mode || 'problems_only'));
    }

    if (outputFormat === 'markdown' || outputFormat === 'both') {
      if (outputFormat === 'both') {
        console.log('\n---\n');
      }
      console.log(formatMarkdown(result));
    }

    // 保存报告
    if (!options.noSave) {
      saveReports(path.resolve(options.targetPath), result);
    }
  } catch (error) {
    console.error('分析失败:', (error as Error).message);
    process.exit(1);
  }
}

// CLI 入口 - 仅当作为主模块运行时才执行
if (isDirectCliEntry('structure-analyzer.js')) {
  main();
}
