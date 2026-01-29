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
  Violation,
  ViolationCode,
  DirectoryNode,
  FileInfo,
  StructureAnalyzerConfig,
  SA001Context,
  ScanContext,
  DEFAULT_CONFIG,
} from './types/structure-analyzer';

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

/**
 * 计算评分
 */
function calculateScores(violations: Violation[]): AnalysisScores {
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
  const fileSize = Math.max(0, 25 - counts.SA003 * 10);
  const naming = Math.max(0, 25 - counts.SA004 * 5 - counts.SA005 * 1);

  const total = featureStructure + depth + fileSize + naming;

  return {
    total,
    breakdown: {
      featureStructure,
      depth,
      fileSize,
      naming,
    },
  };
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
  lines.push('');

  // 健康度评分
  lines.push('## 📊 健康度评分');
  lines.push('');
  lines.push(`**总分: ${result.scores.total}/100**`);
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

  if (result.scores.total >= 90) {
    lines.push('✅ 项目结构健康度良好，继续保持！');
  } else if (result.scores.total >= 70) {
    lines.push('⚠️ 项目结构存在一些问题，建议逐步改进：');
    if (result.scores.breakdown.featureStructure < 20) {
      lines.push('1. 考虑将按类型分组的目录重构为 Feature-Based 结构');
    }
    if (result.scores.breakdown.fileSize < 20) {
      lines.push('2. 优先拆分超大文件，每个模块保持单一职责');
    }
    if (result.scores.breakdown.depth < 20) {
      lines.push('3. 扁平化过深的目录结构');
    }
  } else {
    lines.push('🔴 项目结构需要较大改进：');
    lines.push('1. 建议制定重构计划，分阶段改进');
    lines.push('2. 优先处理 error 级别的问题');
    lines.push('3. 考虑引入架构规范和代码审查流程');
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
  const scores = calculateScores(violations);

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

// ============ CLI 入口 ============

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]): AnalyzeOptions & { help?: boolean } {
  const options: AnalyzeOptions & { help?: boolean } = {
    targetPath: '',
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
  } catch (error) {
    console.error('分析失败:', (error as Error).message);
    process.exit(1);
  }
}

// 运行
main();
