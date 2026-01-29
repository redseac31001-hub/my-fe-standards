#!/usr/bin/env node
/**
 * Module Mapper - 功能模块图谱分析器
 *
 * 扫描项目目录结构，识别功能模块划分，分析模块依赖关系，生成模块图谱。
 *
 * 用法: node module-mapper.js <path> [options]
 *   --mode <mode>       输出模式: summary | full | graph (默认: summary)
 *   --output <format>   输出格式: json | markdown | mermaid (默认: markdown)
 *   --no-deps           跳过依赖分析（加快速度）
 *   --max-depth <n>     最大扫描深度 (默认: 5)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ModuleInfo,
  ModuleType,
  ModuleStats,
  ModuleIssue,
  SubModuleInfo,
  DependencyEdge,
  DependencyGraph,
  MapperOptions,
  MapperResult,
  MapperSummary,
  ModuleMapperConfig,
  DEFAULT_MAPPER_CONFIG,
  BusinessCategory,
  BUSINESS_KEYWORDS,
} from './types/module-mapper';
import {
  ModuleMapSnapshot,
  ModuleSummary,
} from './types/reports';
import {
  saveModuleMapSnapshot,
  readManifest,
  getReportAgeHours,
} from './report-manager';

// ============ 业务识别函数 ============

/**
 * 根据目录名识别业务信息
 */
function identifyBusiness(dirName: string): { chineseName: string; category: BusinessCategory } {
  const lowerName = dirName.toLowerCase();

  for (const mapping of BUSINESS_KEYWORDS) {
    if (lowerName === mapping.keyword.toLowerCase()) {
      return { chineseName: mapping.name, category: mapping.category };
    }
    if (mapping.aliases) {
      for (const alias of mapping.aliases) {
        if (lowerName === alias.toLowerCase()) {
          return { chineseName: mapping.name, category: mapping.category };
        }
      }
    }
    // 部分匹配（包含关键词）
    if (lowerName.includes(mapping.keyword.toLowerCase())) {
      return { chineseName: mapping.name, category: mapping.category };
    }
  }

  // 未匹配到，返回默认值
  return { chineseName: dirName, category: '其他' };
}

/**
 * 解析路由配置文件
 */
function parseRouterConfig(srcPath: string): Map<string, { path: string; title?: string }> {
  const routeMap = new Map<string, { path: string; title?: string }>();

  // 常见路由文件路径
  const routerPaths = [
    path.join(srcPath, 'router/index.ts'),
    path.join(srcPath, 'router/index.js'),
    path.join(srcPath, 'router/routes.ts'),
    path.join(srcPath, 'router/routes.js'),
    path.join(srcPath, 'routes/index.ts'),
    path.join(srcPath, 'routes/index.js'),
  ];

  for (const routerPath of routerPaths) {
    if (fs.existsSync(routerPath)) {
      try {
        const content = fs.readFileSync(routerPath, 'utf-8');

        // 匹配路由定义: path: '/xxx', component: () => import('@/views/xxx')
        const routeRegex = /path:\s*['"]([^'"]+)['"][^}]*component:\s*\([^)]*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        let match;

        while ((match = routeRegex.exec(content)) !== null) {
          const routePath = match[1];
          const componentPath = match[2];

          // 提取视图名称
          const viewMatch = componentPath.match(/@\/views\/([^'"]+)/);
          if (viewMatch) {
            const viewName = viewMatch[1].replace(/\/index(\.vue)?$/, '').replace(/\.vue$/, '');
            routeMap.set(viewName, { path: routePath });
          }
        }

        // 匹配 meta.title
        const metaRegex = /path:\s*['"]([^'"]+)['"][^}]*meta:\s*\{[^}]*title:\s*['"]([^'"]+)['"]/g;
        while ((match = metaRegex.exec(content)) !== null) {
          const routePath = match[1];
          const title = match[2];

          // 更新已存在的路由信息
          for (const [viewName, info] of routeMap.entries()) {
            if (info.path === routePath) {
              routeMap.set(viewName, { ...info, title });
            }
          }
        }
      } catch {
        // 忽略解析错误
      }
      break; // 找到一个就停止
    }
  }

  return routeMap;
}

// ============ 工具函数 ============

/**
 * 检查是否应该忽略
 */
function shouldIgnore(name: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      if (name.endsWith(ext)) return true;
    } else if (name === pattern || name.includes(pattern)) {
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

/**
 * 解析文件中的 import 语句
 */
function parseImports(filePath: string): { internal: string[]; external: string[] } {
  const internal: string[] = [];
  const external: string[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 匹配 import 语句
    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      if (importPath.startsWith('.') || importPath.startsWith('@/') || importPath.startsWith('~/')) {
        internal.push(importPath);
      } else if (!importPath.startsWith('vue') && !importPath.startsWith('@vue')) {
        external.push(importPath);
      }
    }

    // 匹配 require 语句
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const requirePath = match[1];
      if (requirePath.startsWith('.') || requirePath.startsWith('@/')) {
        internal.push(requirePath);
      } else {
        external.push(requirePath);
      }
    }
  } catch {
    // 忽略读取错误
  }

  return {
    internal: [...new Set(internal)],
    external: [...new Set(external)],
  };
}

/**
 * 解析模块路径为模块名
 */
function resolveModuleName(importPath: string, currentModule: string, srcPath: string): string | null {
  // @/ 或 ~/ 开头的绝对引用
  if (importPath.startsWith('@/') || importPath.startsWith('~/')) {
    const relativePath = importPath.slice(2);
    const parts = relativePath.split('/');

    // 返回第一级或第二级目录作为模块名
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return parts[0];
  }

  // 相对路径引用
  if (importPath.startsWith('.')) {
    // 简化处理：检查是否跨模块引用
    if (importPath.startsWith('..')) {
      // 可能是跨模块引用
      return null; // 需要更复杂的路径解析
    }
  }

  return null;
}

// ============ 模块扫描 ============

/**
 * 扫描目录获取模块列表
 */
function scanModules(
  srcPath: string,
  config: ModuleMapperConfig,
  maxDepth: number,
  routeMap?: Map<string, { path: string; title?: string }>
): ModuleInfo[] {
  const modules: ModuleInfo[] = [];

  for (const pattern of config.modulePatterns) {
    const moduleDirPath = path.join(srcPath, pattern.pattern);

    if (!fs.existsSync(moduleDirPath)) continue;

    const stat = fs.statSync(moduleDirPath);
    if (!stat.isDirectory()) continue;

    if (pattern.recursive) {
      // 递归扫描子目录作为独立模块
      const subDirs = fs.readdirSync(moduleDirPath);
      for (const subDir of subDirs) {
        if (shouldIgnore(subDir, config.ignorePatterns)) continue;

        const subDirPath = path.join(moduleDirPath, subDir);
        const subStat = fs.statSync(subDirPath);

        if (subStat.isDirectory()) {
          const moduleInfo = analyzeModule(
            subDirPath,
            `${pattern.pattern}/${subDir}`,
            pattern.type,
            config,
            maxDepth,
            routeMap
          );
          modules.push(moduleInfo);
        }
      }
    } else {
      // 整个目录作为一个模块
      const moduleInfo = analyzeModule(
        moduleDirPath,
        pattern.pattern,
        pattern.type,
        config,
        maxDepth,
        routeMap
      );
      modules.push(moduleInfo);
    }
  }

  return modules;
}

/**
 * 分析单个模块
 */
function analyzeModule(
  modulePath: string,
  moduleName: string,
  moduleType: ModuleType,
  config: ModuleMapperConfig,
  maxDepth: number,
  routeMap?: Map<string, { path: string; title?: string }>
): ModuleInfo {
  const stats = collectModuleStats(modulePath, config, maxDepth, 0);
  const entries = findEntries(modulePath, config);
  const subModules = findSubModulesDetailed(modulePath, moduleName, config, maxDepth);
  const { internalDeps, externalDeps } = collectDependencies(modulePath, config, maxDepth, 0);
  const issues = detectIssues(stats, internalDeps.length, config);
  const healthScore = calculateHealthScore(stats, issues, internalDeps.length, config);

  // 识别业务信息
  const dirName = path.basename(modulePath);
  const businessInfo = identifyBusiness(dirName);

  // 尝试从路由配置获取路由路径
  let routePath: string | undefined;
  if (routeMap) {
    const routeInfo = routeMap.get(moduleName) || routeMap.get(dirName);
    if (routeInfo) {
      routePath = routeInfo.path;
      // 如果路由有 title，优先使用
      if (routeInfo.title) {
        businessInfo.chineseName = routeInfo.title;
      }
    }
  }

  return {
    name: moduleName,
    path: modulePath,
    type: moduleType,
    business: {
      chineseName: businessInfo.chineseName,
      category: businessInfo.category,
      routePath,
    },
    entries,
    subModules,
    internalDeps,
    externalDeps,
    relatedModules: [], // 后续通过依赖图填充
    stats,
    healthScore,
    issues,
  };
}

/**
 * 收集模块统计信息
 */
function collectModuleStats(
  dirPath: string,
  config: ModuleMapperConfig,
  maxDepth: number,
  currentDepth: number
): ModuleStats {
  const stats: ModuleStats = {
    files: 0,
    lines: 0,
    components: 0,
    tsFiles: 0,
    maxFileLines: 0,
    avgFileLines: 0,
  };

  if (currentDepth > maxDepth) return stats;

  let entries: string[];
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return stats;
  }

  for (const entry of entries) {
    if (shouldIgnore(entry, config.ignorePatterns)) continue;

    const entryPath = path.join(dirPath, entry);
    let entryStat: fs.Stats;

    try {
      entryStat = fs.statSync(entryPath);
    } catch {
      continue;
    }

    if (entryStat.isFile()) {
      const ext = path.extname(entry).toLowerCase();

      if (['.vue', '.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        stats.files++;
        const lines = countFileLines(entryPath);
        stats.lines += lines;
        stats.maxFileLines = Math.max(stats.maxFileLines, lines);

        if (ext === '.vue') stats.components++;
        if (ext === '.ts' || ext === '.tsx') stats.tsFiles++;
      }
    } else if (entryStat.isDirectory()) {
      const subStats = collectModuleStats(entryPath, config, maxDepth, currentDepth + 1);
      stats.files += subStats.files;
      stats.lines += subStats.lines;
      stats.components += subStats.components;
      stats.tsFiles += subStats.tsFiles;
      stats.maxFileLines = Math.max(stats.maxFileLines, subStats.maxFileLines);
    }
  }

  stats.avgFileLines = stats.files > 0 ? Math.round(stats.lines / stats.files) : 0;
  return stats;
}

/**
 * 查找入口文件
 */
function findEntries(modulePath: string, config: ModuleMapperConfig): string[] {
  const entries: string[] = [];

  try {
    const files = fs.readdirSync(modulePath);

    for (const file of files) {
      const filePath = path.join(modulePath, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        for (const pattern of config.entryPatterns) {
          if (pattern.startsWith('*')) {
            if (file.endsWith(pattern.slice(1))) {
              entries.push(file);
              break;
            }
          } else if (file === pattern) {
            entries.push(file);
            break;
          }
        }
      }
    }
  } catch {
    // 忽略错误
  }

  return entries;
}

/**
 * 查找子模块（详细版）
 */
function findSubModulesDetailed(
  modulePath: string,
  parentModuleName: string,
  config: ModuleMapperConfig,
  maxDepth: number
): SubModuleInfo[] {
  const subModules: SubModuleInfo[] = [];

  try {
    const entries = fs.readdirSync(modulePath);

    for (const entry of entries) {
      if (shouldIgnore(entry, config.ignorePatterns)) continue;

      const entryPath = path.join(modulePath, entry);
      const stat = fs.statSync(entryPath);

      if (stat.isDirectory()) {
        // 检查子目录是否包含代码文件
        const subStats = collectModuleStats(entryPath, config, maxDepth, 0);

        if (subStats.files > 0) {
          // 识别子模块业务信息
          const businessInfo = identifyBusiness(entry);

          // 计算子模块健康度
          const healthScore = Math.max(0, 100 - (subStats.maxFileLines > 500 ? 30 : 0) - (subStats.files > 20 ? 20 : 0));

          subModules.push({
            name: entry,
            chineseName: businessInfo.chineseName,
            category: businessInfo.category,
            path: entryPath,
            files: subStats.files,
            lines: subStats.lines,
            healthScore,
          });
        }
      }
    }
  } catch {
    // 忽略错误
  }

  return subModules;
}

/**
 * 查找子模块（简化版，保留兼容）
 */
function findSubModules(modulePath: string, config: ModuleMapperConfig): string[] {
  const subModules: string[] = [];

  try {
    const entries = fs.readdirSync(modulePath);

    for (const entry of entries) {
      if (shouldIgnore(entry, config.ignorePatterns)) continue;

      const entryPath = path.join(modulePath, entry);
      const stat = fs.statSync(entryPath);

      if (stat.isDirectory()) {
        // 检查子目录是否包含代码文件
        const hasCode = fs.readdirSync(entryPath).some(f =>
          ['.vue', '.ts', '.tsx', '.js', '.jsx'].includes(path.extname(f).toLowerCase())
        );

        if (hasCode) {
          subModules.push(entry);
        }
      }
    }
  } catch {
    // 忽略错误
  }

  return subModules;
}

/**
 * 收集模块依赖
 */
function collectDependencies(
  dirPath: string,
  config: ModuleMapperConfig,
  maxDepth: number,
  currentDepth: number
): { internalDeps: string[]; externalDeps: string[] } {
  const internalDeps: Set<string> = new Set();
  const externalDeps: Set<string> = new Set();

  if (currentDepth > maxDepth) return { internalDeps: [], externalDeps: [] };

  let entries: string[];
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return { internalDeps: [], externalDeps: [] };
  }

  for (const entry of entries) {
    if (shouldIgnore(entry, config.ignorePatterns)) continue;

    const entryPath = path.join(dirPath, entry);
    let entryStat: fs.Stats;

    try {
      entryStat = fs.statSync(entryPath);
    } catch {
      continue;
    }

    if (entryStat.isFile()) {
      const ext = path.extname(entry).toLowerCase();

      if (['.vue', '.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        const imports = parseImports(entryPath);
        imports.internal.forEach(i => internalDeps.add(i));
        imports.external.forEach(e => externalDeps.add(e.split('/')[0])); // 取包名
      }
    } else if (entryStat.isDirectory()) {
      const subDeps = collectDependencies(entryPath, config, maxDepth, currentDepth + 1);
      subDeps.internalDeps.forEach(i => internalDeps.add(i));
      subDeps.externalDeps.forEach(e => externalDeps.add(e));
    }
  }

  return {
    internalDeps: [...internalDeps],
    externalDeps: [...externalDeps],
  };
}

/**
 * 检测模块问题
 */
function detectIssues(
  stats: ModuleStats,
  depsCount: number,
  config: ModuleMapperConfig
): ModuleIssue[] {
  const issues: ModuleIssue[] = [];
  const { thresholds } = config;

  if (stats.files > thresholds.maxFilesPerModule) {
    issues.push({
      type: 'size',
      severity: 'warning',
      message: `模块文件数 ${stats.files} 超过阈值 ${thresholds.maxFilesPerModule}`,
    });
  }

  if (stats.lines > thresholds.maxLinesPerModule) {
    issues.push({
      type: 'size',
      severity: 'error',
      message: `模块代码行数 ${stats.lines} 超过阈值 ${thresholds.maxLinesPerModule}`,
    });
  }

  if (stats.maxFileLines > 500) {
    issues.push({
      type: 'complexity',
      severity: 'error',
      message: `存在超大文件（${stats.maxFileLines} 行）`,
    });
  }

  if (depsCount > thresholds.maxDependencies) {
    issues.push({
      type: 'coupling',
      severity: 'warning',
      message: `模块依赖数 ${depsCount} 超过阈值 ${thresholds.maxDependencies}`,
    });
  }

  return issues;
}

/**
 * 计算模块健康度评分
 */
function calculateHealthScore(
  stats: ModuleStats,
  issues: ModuleIssue[],
  depsCount: number,
  config: ModuleMapperConfig
): number {
  let score = 100;
  const { thresholds } = config;

  // 文件数扣分
  if (stats.files > thresholds.maxFilesPerModule) {
    score -= Math.min(20, (stats.files - thresholds.maxFilesPerModule) * 2);
  }

  // 代码行数扣分
  if (stats.lines > thresholds.maxLinesPerModule) {
    score -= Math.min(25, Math.floor((stats.lines - thresholds.maxLinesPerModule) / 500) * 5);
  }

  // 大文件扣分
  if (stats.maxFileLines > 500) {
    score -= Math.min(20, Math.floor((stats.maxFileLines - 500) / 100) * 5);
  }

  // 依赖数扣分
  if (depsCount > thresholds.maxDependencies) {
    score -= Math.min(15, (depsCount - thresholds.maxDependencies) * 3);
  }

  // 问题扣分
  for (const issue of issues) {
    if (issue.severity === 'error') score -= 5;
    if (issue.severity === 'warning') score -= 2;
  }

  return Math.max(0, score);
}

// ============ 依赖图构建 ============

/**
 * 构建依赖图
 */
function buildDependencyGraph(modules: ModuleInfo[], srcPath: string): DependencyGraph {
  const nodes = modules.map(m => m.name);
  const edges: DependencyEdge[] = [];
  const edgeMap = new Map<string, DependencyEdge>();

  for (const module of modules) {
    for (const dep of module.internalDeps) {
      // 解析依赖路径为模块名
      let targetModule: string | null = null;

      if (dep.startsWith('@/') || dep.startsWith('~/')) {
        const relativePath = dep.slice(2);
        const parts = relativePath.split('/');

        // 匹配模块名
        for (const m of modules) {
          if (relativePath.startsWith(m.name) || m.name.endsWith(parts[0])) {
            targetModule = m.name;
            break;
          }
        }
      }

      if (targetModule && targetModule !== module.name) {
        const key = `${module.name}->${targetModule}`;

        if (edgeMap.has(key)) {
          edgeMap.get(key)!.count++;
        } else {
          const edge: DependencyEdge = {
            from: module.name,
            to: targetModule,
            type: 'import',
            count: 1,
          };
          edgeMap.set(key, edge);
          edges.push(edge);
        }

        // 更新关联模块
        if (!module.relatedModules.includes(targetModule)) {
          module.relatedModules.push(targetModule);
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * 检测循环依赖
 */
function detectCircularDeps(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const outEdges = graph.edges.filter(e => e.from === node);

    for (const edge of outEdges) {
      if (!visited.has(edge.to)) {
        dfs(edge.to);
      } else if (recursionStack.has(edge.to)) {
        // 发现循环
        const cycleStart = path.indexOf(edge.to);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), edge.to]);
        }
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  for (const node of graph.nodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

// ============ 输出格式化 ============

/**
 * 生成 Mermaid 图表
 */
function generateMermaidGraph(graph: DependencyGraph, modules: ModuleInfo[]): string {
  const lines: string[] = ['graph LR'];

  // 添加节点样式
  const typeStyles: Record<ModuleType, string> = {
    page: ':::page',
    feature: ':::feature',
    shared: ':::shared',
    util: ':::util',
    api: ':::api',
    store: ':::store',
    layout: ':::layout',
  };

  // 添加边
  for (const edge of graph.edges) {
    const fromNode = edge.from.replace(/[\/\-]/g, '_');
    const toNode = edge.to.replace(/[\/\-]/g, '_');

    if (edge.count > 3) {
      lines.push(`    ${fromNode} ==> ${toNode}`);
    } else {
      lines.push(`    ${fromNode} --> ${toNode}`);
    }
  }

  // 添加样式定义
  lines.push('');
  lines.push('    classDef page fill:#e1f5fe,stroke:#01579b');
  lines.push('    classDef feature fill:#f3e5f5,stroke:#4a148c');
  lines.push('    classDef shared fill:#e8f5e9,stroke:#1b5e20');
  lines.push('    classDef util fill:#fff3e0,stroke:#e65100');
  lines.push('    classDef api fill:#fce4ec,stroke:#880e4f');
  lines.push('    classDef store fill:#e0f2f1,stroke:#004d40');

  // 应用样式
  for (const module of modules) {
    const nodeId = module.name.replace(/[\/\-]/g, '_');
    const style = typeStyles[module.type] || '';
    if (style) {
      lines.push(`    class ${nodeId} ${module.type}`);
    }
  }

  return lines.join('\n');
}

/**
 * 生成 Markdown 输出
 */
function formatMarkdown(result: MapperResult): string {
  const lines: string[] = [];

  // 标题
  lines.push('# 项目功能模块图谱');
  lines.push('');
  lines.push(`> 项目: ${result.projectName}`);
  lines.push(`> 分析时间: ${result.analyzedAt}`);
  lines.push('');

  // 摘要统计
  lines.push('## 📊 摘要统计');
  lines.push('');
  lines.push(`- **总模块数**: ${result.summary.totalModules}`);
  lines.push(`- **总文件数**: ${result.summary.totalFiles}`);
  lines.push(`- **总代码行数**: ${result.summary.totalLines.toLocaleString()}`);
  lines.push(`- **平均健康度**: ${result.summary.avgHealthScore}/100`);
  if (result.summary.circularDeps > 0) {
    lines.push(`- **⚠️ 循环依赖**: ${result.summary.circularDeps} 处`);
  }
  lines.push('');

  // 按业务分类展示模块
  lines.push('## 📦 业务模块图谱');
  lines.push('');

  // 按业务分类分组
  const categoryMap = new Map<string, ModuleInfo[]>();
  for (const module of result.modules) {
    const category = module.business?.category || '其他';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(module);
  }

  // 按分类输出
  const categoryOrder = ['用户认证', '用户管理', '业务办理', '数据管理', '系统设置', '通用组件', '工具函数', '其他'];
  for (const category of categoryOrder) {
    const modules = categoryMap.get(category);
    if (!modules || modules.length === 0) continue;

    lines.push(`### ${category}`);
    lines.push('');
    lines.push('| 模块 | 中文名 | 路由 | 文件数 | 行数 | 健康度 |');
    lines.push('|------|--------|------|--------|------|--------|');

    const sortedModules = [...modules].sort((a, b) => b.stats.lines - a.stats.lines);
    for (const module of sortedModules) {
      const healthIcon = module.healthScore >= 80 ? '🟢' : module.healthScore >= 60 ? '🟡' : '🔴';
      const chineseName = module.business?.chineseName || module.name;
      const routePath = module.business?.routePath || '-';
      lines.push(`| ${module.name} | ${chineseName} | ${routePath} | ${module.stats.files} | ${module.stats.lines.toLocaleString()} | ${healthIcon} ${module.healthScore}/100 |`);

      // 输出子模块
      if (module.subModules && module.subModules.length > 0) {
        for (const sub of module.subModules) {
          const subHealthIcon = sub.healthScore >= 80 ? '🟢' : sub.healthScore >= 60 ? '🟡' : '🔴';
          lines.push(`| ├─ ${sub.name} | ${sub.chineseName} | - | ${sub.files} | ${sub.lines.toLocaleString()} | ${subHealthIcon} ${sub.healthScore}/100 |`);
        }
      }
    }
    lines.push('');
  }

  // 依赖关系图
  if (result.mermaidGraph) {
    lines.push('## 🔗 模块依赖图');
    lines.push('');
    lines.push('```mermaid');
    lines.push(result.mermaidGraph);
    lines.push('```');
    lines.push('');
  }

  // 模块详情（仅显示问题模块）
  const problemModules = result.modules.filter(m => m.healthScore < 60 || m.issues.length > 0);
  if (problemModules.length > 0) {
    lines.push('## ⚠️ 需关注的模块');
    lines.push('');

    for (const module of problemModules.slice(0, 10)) {
      const healthIcon = module.healthScore >= 80 ? '🟢' : module.healthScore >= 60 ? '🟡' : '🔴';
      const chineseName = module.business?.chineseName || module.name;
      lines.push(`### ${healthIcon} ${chineseName} (${module.name})`);
      lines.push('');
      lines.push(`- **路径**: \`${module.path}\``);
      lines.push(`- **健康度**: ${module.healthScore}/100`);
      lines.push(`- **统计**: ${module.stats.files} 文件, ${module.stats.lines.toLocaleString()} 行`);

      if (module.subModules && module.subModules.length > 0) {
        lines.push(`- **子模块**: ${module.subModules.map(s => `${s.chineseName}(${s.name})`).join(', ')}`);
      }
      if (module.issues.length > 0) {
        lines.push(`- **问题**:`);
        for (const issue of module.issues) {
          const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
          lines.push(`  - ${icon} ${issue.message}`);
        }
      }
      lines.push('');
    }
  }

  // 关联提示
  lines.push('---');
  lines.push('');
  lines.push('💡 **相关操作**:');
  lines.push('- 查看结构健康度 → 输入 "结构分析"');
  lines.push('- 重构某个模块 → 输入 "重构 [模块名] 模块"');
  lines.push('- 分析具体文件 → 输入 "分析 xxx.vue"');
  lines.push('');

  return lines.join('\n');
}

/**
 * 生成 JSON 输出
 */
function formatJson(result: MapperResult): string {
  return JSON.stringify(result, null, 2);
}

// ============ 主函数 ============

/**
 * 分析项目模块
 */
export function analyzeModules(options: MapperOptions): MapperResult {
  const {
    targetPath,
    srcDir = 'src',
    maxDepth = 5,
    mode = 'summary',
    analyzeDeps = true,
  } = options;

  // 验证路径
  const fullPath = path.resolve(targetPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`目标路径不存在: ${fullPath}`);
  }

  // 确定扫描起点（支持多种项目结构）
  let scanPath = fullPath;
  const possibleSrcDirs = [srcDir, 'src', 'packages', 'apps', 'libs'];

  for (const dir of possibleSrcDirs) {
    const candidatePath = path.join(fullPath, dir);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
      scanPath = candidatePath;
      break;
    }
  }

  // 使用默认配置
  const config = DEFAULT_MAPPER_CONFIG;

  // 解析路由配置
  const routeMap = parseRouterConfig(scanPath);

  // 扫描模块
  const modules = scanModules(scanPath, config, maxDepth, routeMap);

  // 构建依赖图
  const dependencyGraph = analyzeDeps ? buildDependencyGraph(modules, scanPath) : { nodes: [], edges: [] };

  // 检测循环依赖
  const circularDeps = analyzeDeps ? detectCircularDeps(dependencyGraph) : [];

  // 生成 Mermaid 图表
  const mermaidGraph = mode !== 'summary' ? generateMermaidGraph(dependencyGraph, modules) : undefined;

  // 计算摘要
  const modulesByType: Record<ModuleType, number> = {
    page: 0,
    feature: 0,
    shared: 0,
    util: 0,
    api: 0,
    store: 0,
    layout: 0,
  };

  let totalFiles = 0;
  let totalLines = 0;
  let totalHealth = 0;

  for (const module of modules) {
    modulesByType[module.type]++;
    totalFiles += module.stats.files;
    totalLines += module.stats.lines;
    totalHealth += module.healthScore;
  }

  const isolatedModules = modules.filter(m =>
    m.relatedModules.length === 0 &&
    !dependencyGraph.edges.some(e => e.to === m.name)
  ).length;

  const summary: MapperSummary = {
    totalModules: modules.length,
    modulesByType,
    totalFiles,
    totalLines,
    avgHealthScore: modules.length > 0 ? Math.round(totalHealth / modules.length) : 0,
    circularDeps: circularDeps.length,
    isolatedModules,
  };

  return {
    projectName: path.basename(fullPath),
    analyzedAt: new Date().toISOString(),
    modules,
    dependencyGraph,
    summary,
    mermaidGraph,
  };
}

// ============ CLI 入口 ============

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]): MapperOptions & { help?: boolean; noSave?: boolean } {
  const options: MapperOptions & { help?: boolean; noSave?: boolean } = {
    targetPath: '',
    noSave: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--mode' && args[i + 1]) {
      options.mode = args[++i] as 'summary' | 'full' | 'graph';
    } else if (arg === '--output' && args[i + 1]) {
      options.outputFormat = args[++i] as 'json' | 'markdown' | 'mermaid';
    } else if (arg === '--no-deps') {
      options.analyzeDeps = false;
    } else if (arg === '--max-depth' && args[i + 1]) {
      options.maxDepth = parseInt(args[++i], 10);
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
Module Mapper - 功能模块图谱分析器

用法: node module-mapper.js <path> [options]

参数:
  <path>              目标项目路径

选项:
  --mode <mode>       输出模式: summary | full | graph (默认: summary)
  --output <format>   输出格式: json | markdown | mermaid (默认: markdown)
  --no-deps           跳过依赖分析（加快速度）
  --max-depth <n>     最大扫描深度 (默认: 5)
  --no-save           不保存报告到 .codebuddy/reports/
  -h, --help          显示帮助信息

示例:
  node module-mapper.js ./my-project
  node module-mapper.js ./my-project --mode full --output json
  node module-mapper.js ./my-project --mode graph --output mermaid
`);
}

/**
 * 将分析结果转换为模块图谱快照
 */
function toModuleMapSnapshot(result: MapperResult): ModuleMapSnapshot {
  // 按分类统计
  const categories: ModuleMapSnapshot['categories'] = {};
  for (const module of result.modules) {
    const cat = module.business?.category || '其他';
    if (!categories[cat]) {
      categories[cat] = { modules: [], totalFiles: 0, totalLines: 0 };
    }
    categories[cat].modules.push(module.name);
    categories[cat].totalFiles += module.stats.files;
    categories[cat].totalLines += module.stats.lines;
  }

  // 转换模块列表
  const modules: ModuleSummary[] = result.modules.map(m => ({
    name: m.name,
    chineseName: m.business?.chineseName || m.name,
    category: m.business?.category || '其他',
    type: m.type,
    path: m.path,
    routePath: m.business?.routePath,
    stats: {
      files: m.stats.files,
      lines: m.stats.lines,
      components: m.stats.components,
    },
    healthScore: m.healthScore,
    subModules: m.subModules.map(s => ({
      name: s.name,
      chineseName: s.chineseName,
      files: s.files,
      lines: s.lines,
    })),
    dependencies: m.internalDeps.slice(0, 10),
    dependents: m.relatedModules,
  }));

  return {
    meta: {
      version: '1.0.0',
      projectName: result.projectName,
      analyzedAt: result.analyzedAt,
      analyzedBy: 'module-mapper',
    },
    summary: {
      totalModules: result.summary.totalModules,
      avgHealthScore: result.summary.avgHealthScore,
      circularDeps: result.summary.circularDeps,
      isolatedModules: result.summary.isolatedModules,
    },
    categories,
    modules,
    graph: {
      nodes: result.dependencyGraph.nodes,
      edges: result.dependencyGraph.edges.map(e => ({
        from: e.from,
        to: e.to,
        weight: e.count,
      })),
    },
  };
}

/**
 * 保存模块图谱报告
 */
function saveReports(targetPath: string, result: MapperResult): void {
  try {
    const snapshot = toModuleMapSnapshot(result);
    saveModuleMapSnapshot(targetPath, snapshot);
    console.log(`[Reports] 已保存模块图谱到 .codebuddy/reports/modules/`);
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
    if (manifest.reports.modules) {
      const ageHours = getReportAgeHours(manifest.reports.modules.generatedAt);
      return { exists: true, ageHours };
    }
  } catch {
    // 忽略
  }
  return { exists: false, ageHours: -1 };
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

    const result = analyzeModules(options);
    const outputFormat = options.outputFormat || 'markdown';

    if (outputFormat === 'json') {
      console.log(formatJson(result));
    } else if (outputFormat === 'mermaid' && result.mermaidGraph) {
      console.log(result.mermaidGraph);
    } else {
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

// 运行
main();
