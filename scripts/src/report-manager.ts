#!/usr/bin/env node
/**
 * Report Manager - 报告管理器
 *
 * 管理 .codebuddy/reports/ 目录下的项目记忆文件
 *
 * 用法: node report-manager.js <command> [options]
 *   status              查看报告状态
 *   cleanup             清理过期报告
 *   export              导出报告
 *   diff                对比快照
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ReportsManifest,
  ReportMeta,
  ArchitectureSnapshot,
  ModuleMapSnapshot,
  HealthTimeline,
  HealthDataPoint,
  DEFAULT_MANIFEST,
  DEFAULT_RETENTION_POLICY,
} from './types/reports';

// ============ 常量 ============

const REPORTS_DIR = '.codebuddy/reports';
const MANIFEST_FILE = 'manifest.json';

// ============ 工具函数 ============

/**
 * 获取报告目录路径
 */
function getReportsPath(targetDir: string): string {
  return path.join(targetDir, REPORTS_DIR);
}

/**
 * 确保目录存在
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 计算内容哈希
 */
function computeHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 格式化时间差
 */
function formatAge(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'just now';
}

/**
 * 获取报告年龄（小时）
 */
function getReportAgeHours(isoString: string): number {
  const diff = Date.now() - new Date(isoString).getTime();
  return Math.floor(diff / (1000 * 60 * 60));
}

// ============ Manifest 管理 ============

/**
 * 读取 Manifest
 */
function readManifest(targetDir: string): ReportsManifest {
  const manifestPath = path.join(getReportsPath(targetDir), MANIFEST_FILE);

  if (!fs.existsSync(manifestPath)) {
    return {
      ...DEFAULT_MANIFEST,
      projectName: path.basename(targetDir),
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as ReportsManifest;
  } catch {
    return {
      ...DEFAULT_MANIFEST,
      projectName: path.basename(targetDir),
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * 写入 Manifest
 */
function writeManifest(targetDir: string, manifest: ReportsManifest): void {
  const reportsPath = getReportsPath(targetDir);
  ensureDir(reportsPath);

  manifest.lastUpdated = new Date().toISOString();
  const manifestPath = path.join(reportsPath, MANIFEST_FILE);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

// ============ 报告读写 ============

/**
 * 检查报告是否存在
 */
export function reportExists(targetDir: string, reportPath: string): boolean {
  const fullPath = path.join(getReportsPath(targetDir), reportPath);
  return fs.existsSync(fullPath);
}

/**
 * 读取报告
 */
export function readReport<T>(targetDir: string, reportPath: string): T | null {
  const fullPath = path.join(getReportsPath(targetDir), reportPath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * 写入报告
 */
export function writeReport<T>(
  targetDir: string,
  reportPath: string,
  data: T,
  generatedBy: ReportMeta['generatedBy']
): ReportMeta {
  const reportsPath = getReportsPath(targetDir);
  const fullPath = path.join(reportsPath, reportPath);
  const dirPath = path.dirname(fullPath);

  ensureDir(dirPath);

  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(fullPath, content, 'utf-8');

  const meta: ReportMeta = {
    type: getReportType(reportPath),
    path: reportPath,
    generatedAt: new Date().toISOString(),
    generatedBy,
    hash: computeHash(content),
    size: Buffer.byteLength(content, 'utf-8'),
  };

  // 更新 manifest
  const manifest = readManifest(targetDir);
  updateManifestReport(manifest, meta);
  writeManifest(targetDir, manifest);

  return meta;
}

/**
 * 根据路径推断报告类型
 */
function getReportType(reportPath: string): ReportMeta['type'] {
  if (reportPath.includes('architecture')) return 'architecture-snapshot';
  if (reportPath.includes('modules')) return 'module-map';
  if (reportPath.includes('health')) return 'health-timeline';
  if (reportPath.includes('tasks')) return 'task-context';
  return 'architecture-snapshot';
}

/**
 * 更新 manifest 中的报告引用
 */
function updateManifestReport(manifest: ReportsManifest, meta: ReportMeta): void {
  switch (meta.type) {
    case 'architecture-snapshot':
      manifest.reports.architecture = meta;
      break;
    case 'module-map':
      manifest.reports.modules = meta;
      break;
    case 'health-timeline':
      manifest.reports.health = meta;
      break;
    case 'task-context':
      manifest.reports.tasks = meta;
      break;
  }
}

// ============ 架构快照管理 ============

/**
 * 保存架构快照
 */
export function saveArchitectureSnapshot(
  targetDir: string,
  snapshot: ArchitectureSnapshot
): ReportMeta {
  // 保存最新快照
  const meta = writeReport(
    targetDir,
    'architecture/latest.json',
    snapshot,
    'structure-analyzer'
  );

  // 保存历史快照
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const historyPath = `architecture/${timestamp}.json`;
  const historyFullPath = path.join(getReportsPath(targetDir), historyPath);
  const historyDir = path.dirname(historyFullPath);
  ensureDir(historyDir);
  fs.writeFileSync(historyFullPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // 清理旧快照
  cleanupOldSnapshots(targetDir, 'architecture');

  return meta;
}

/**
 * 清理旧快照
 */
function cleanupOldSnapshots(targetDir: string, subDir: string): void {
  const dirPath = path.join(getReportsPath(targetDir), subDir);
  if (!fs.existsSync(dirPath)) return;

  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.json') && f !== 'latest.json')
    .map(f => ({
      name: f,
      path: path.join(dirPath, f),
      time: fs.statSync(path.join(dirPath, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  const { maxCount, maxAgeDays } = DEFAULT_RETENTION_POLICY.snapshots;
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (i >= maxCount || now - file.time > maxAge) {
      fs.unlinkSync(file.path);
    }
  }
}

// ============ 模块图谱管理 ============

/**
 * 保存模块图谱
 */
export function saveModuleMapSnapshot(
  targetDir: string,
  snapshot: ModuleMapSnapshot
): ReportMeta {
  return writeReport(
    targetDir,
    'modules/latest.json',
    snapshot,
    'module-mapper'
  );
}

// ============ 健康度时间线 ============

/**
 * 追加健康度数据点
 */
export function appendHealthDataPoint(
  targetDir: string,
  dataPoint: HealthDataPoint
): void {
  let timeline = readReport<HealthTimeline>(targetDir, 'health/timeline.json');

  if (!timeline) {
    timeline = {
      meta: {
        version: '1.0.0',
        projectName: path.basename(targetDir),
        lastUpdated: new Date().toISOString(),
      },
      dataPoints: [],
      trends: {
        direction: 'stable',
        changeRate: 0,
        prediction: dataPoint.healthScore,
      },
    };
  }

  // 检查是否已有今天的数据
  const today = dataPoint.date;
  const existingIndex = timeline.dataPoints.findIndex(dp => dp.date === today);

  if (existingIndex >= 0) {
    timeline.dataPoints[existingIndex] = dataPoint;
  } else {
    timeline.dataPoints.push(dataPoint);
  }

  // 按日期排序
  timeline.dataPoints.sort((a, b) => a.date.localeCompare(b.date));

  // 计算趋势
  timeline.trends = calculateTrends(timeline.dataPoints);
  timeline.meta.lastUpdated = new Date().toISOString();

  writeReport(targetDir, 'health/timeline.json', timeline, 'report-manager');
}

/**
 * 计算趋势
 */
function calculateTrends(dataPoints: HealthDataPoint[]): HealthTimeline['trends'] {
  if (dataPoints.length < 2) {
    return {
      direction: 'stable',
      changeRate: 0,
      prediction: dataPoints[0]?.healthScore || 0,
    };
  }

  const recent = dataPoints.slice(-7);
  const first = recent[0].healthScore;
  const last = recent[recent.length - 1].healthScore;
  const changeRate = ((last - first) / first) * 100;

  let direction: 'improving' | 'stable' | 'declining' = 'stable';
  if (changeRate > 5) direction = 'improving';
  else if (changeRate < -5) direction = 'declining';

  // 简单线性预测
  const prediction = Math.max(0, Math.min(100, last + (last - first) / recent.length));

  return {
    direction,
    changeRate: Math.round(changeRate * 10) / 10,
    prediction: Math.round(prediction),
  };
}

// ============ 状态查看 ============

/**
 * 显示报告状态
 */
function showStatus(targetDir: string): void {
  const manifest = readManifest(targetDir);

  console.log('');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│           CodeBuddy Reports Status                  │');
  console.log('├─────────────────────────────────────────────────────┤');

  const { architecture, modules, health, tasks } = manifest.reports;

  // Architecture
  if (architecture) {
    const age = formatAge(architecture.generatedAt);
    const fresh = getReportAgeHours(architecture.generatedAt) < 24 ? '✓ Fresh' : '○ Stale';
    console.log(`│ Architecture:  ${architecture.generatedAt.slice(0, 16)}  (${age})  ${fresh.padEnd(8)} │`);
  } else {
    console.log('│ Architecture:  Not generated                        │');
  }

  // Modules
  if (modules) {
    const age = formatAge(modules.generatedAt);
    const fresh = getReportAgeHours(modules.generatedAt) < 24 ? '✓ Fresh' : '○ Stale';
    console.log(`│ Modules:       ${modules.generatedAt.slice(0, 16)}  (${age})  ${fresh.padEnd(8)} │`);
  } else {
    console.log('│ Modules:       Not generated                        │');
  }

  // Health
  if (health) {
    const timeline = readReport<HealthTimeline>(targetDir, 'health/timeline.json');
    const points = timeline?.dataPoints.length || 0;
    console.log(`│ Health Points: ${points} days tracked`.padEnd(52) + '│');
  } else {
    console.log('│ Health Points: Not tracked                          │');
  }

  // Tasks
  if (tasks) {
    console.log('│ Active Task:   Yes                                  │');
  } else {
    console.log('│ Active Task:   None                                 │');
  }

  console.log('└─────────────────────────────────────────────────────┘');
  console.log('');
}

// ============ 清理 ============

/**
 * 清理过期报告
 */
function cleanup(targetDir: string, cacheOnly: boolean = false): void {
  const reportsPath = getReportsPath(targetDir);

  if (!fs.existsSync(reportsPath)) {
    console.log('No reports directory found.');
    return;
  }

  let cleanedCount = 0;

  // 清理缓存
  const cachePath = path.join(targetDir, '.codebuddy/cache');
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true });
    console.log('Cleaned: cache/');
    cleanedCount++;
  }

  if (cacheOnly) {
    console.log(`Cleanup complete. Removed ${cleanedCount} items.`);
    return;
  }

  // 清理旧快照
  cleanupOldSnapshots(targetDir, 'architecture');
  console.log('Cleaned: old architecture snapshots');
  cleanedCount++;

  console.log(`Cleanup complete. Removed ${cleanedCount} items.`);
}

// ============ 导出 ============

/**
 * 导出报告为 Markdown
 */
function exportMarkdown(targetDir: string): void {
  const manifest = readManifest(targetDir);
  const lines: string[] = [];

  lines.push('# CodeBuddy 项目报告');
  lines.push('');
  lines.push(`> 项目: ${manifest.projectName}`);
  lines.push(`> 生成时间: ${new Date().toISOString()}`);
  lines.push('');

  // 架构快照
  const arch = readReport<ArchitectureSnapshot>(targetDir, 'architecture/latest.json');
  if (arch) {
    lines.push('## 架构分析');
    lines.push('');
    lines.push(`- **健康度**: ${arch.summary.healthScore}/100`);
    lines.push(`- **文件数**: ${arch.summary.totalFiles}`);
    lines.push(`- **代码行数**: ${arch.summary.totalLines.toLocaleString()}`);
    lines.push(`- **问题数**: ${arch.summary.issueCount.error} 错误, ${arch.summary.issueCount.warning} 警告`);
    lines.push('');
  }

  // 模块图谱
  const modules = readReport<ModuleMapSnapshot>(targetDir, 'modules/latest.json');
  if (modules) {
    lines.push('## 模块图谱');
    lines.push('');
    lines.push(`- **模块数**: ${modules.summary.totalModules}`);
    lines.push(`- **平均健康度**: ${modules.summary.avgHealthScore}/100`);
    lines.push(`- **循环依赖**: ${modules.summary.circularDeps}`);
    lines.push('');

    lines.push('### 模块列表');
    lines.push('');
    lines.push('| 模块 | 中文名 | 分类 | 文件数 | 健康度 |');
    lines.push('|------|--------|------|--------|--------|');

    for (const mod of modules.modules.slice(0, 20)) {
      lines.push(`| ${mod.name} | ${mod.chineseName} | ${mod.category} | ${mod.stats.files} | ${mod.healthScore}/100 |`);
    }
    lines.push('');
  }

  // 健康度趋势
  const health = readReport<HealthTimeline>(targetDir, 'health/timeline.json');
  if (health && health.dataPoints.length > 0) {
    lines.push('## 健康度趋势');
    lines.push('');
    lines.push(`- **趋势**: ${health.trends.direction}`);
    lines.push(`- **变化率**: ${health.trends.changeRate}%/周`);
    lines.push(`- **数据点**: ${health.dataPoints.length} 天`);
    lines.push('');
  }

  const output = lines.join('\n');
  const outputPath = path.join(getReportsPath(targetDir), 'export.md');
  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`Exported to: ${outputPath}`);
}

// ============ Phase 3: 差异对比 ============

/**
 * 架构差异
 */
interface ArchitectureDiff {
  from: { date: string; healthScore: number };
  to: { date: string; healthScore: number };
  healthChange: number;
  newViolations: string[];
  resolvedViolations: string[];
  fileChanges: {
    added: number;
    removed: number;
    linesChanged: number;
  };
}

/**
 * 模块差异
 */
interface ModuleDiff {
  added: string[];
  removed: string[];
  changed: Array<{
    name: string;
    healthChange: number;
    filesChange: number;
    linesChange: number;
  }>;
}

/**
 * 获取历史快照列表
 */
function getHistorySnapshots(targetDir: string, subDir: string): Array<{ name: string; date: string; path: string }> {
  const dirPath = path.join(getReportsPath(targetDir), subDir);
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.json') && f !== 'latest.json')
    .map(f => {
      const datePart = f.replace('.json', '').replace(/T/g, ' ').slice(0, 16);
      return {
        name: f,
        date: datePart,
        path: path.join(dirPath, f),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * 对比两个架构快照
 */
function diffArchitectureSnapshots(
  older: ArchitectureSnapshot,
  newer: ArchitectureSnapshot
): ArchitectureDiff {
  const olderViolations = new Set(older.violations.map(v => `${v.rule}:${v.path}`));
  const newerViolations = new Set(newer.violations.map(v => `${v.rule}:${v.path}`));

  const newViolations: string[] = [];
  const resolvedViolations: string[] = [];

  for (const v of newer.violations) {
    const key = `${v.rule}:${v.path}`;
    if (!olderViolations.has(key)) {
      newViolations.push(`[${v.rule}] ${v.message}`);
    }
  }

  for (const v of older.violations) {
    const key = `${v.rule}:${v.path}`;
    if (!newerViolations.has(key)) {
      resolvedViolations.push(`[${v.rule}] ${v.message}`);
    }
  }

  return {
    from: { date: older.meta.analyzedAt, healthScore: older.summary.healthScore },
    to: { date: newer.meta.analyzedAt, healthScore: newer.summary.healthScore },
    healthChange: newer.summary.healthScore - older.summary.healthScore,
    newViolations,
    resolvedViolations,
    fileChanges: {
      added: Math.max(0, newer.summary.totalFiles - older.summary.totalFiles),
      removed: Math.max(0, older.summary.totalFiles - newer.summary.totalFiles),
      linesChanged: newer.summary.totalLines - older.summary.totalLines,
    },
  };
}

/**
 * 对比两个模块图谱
 */
function diffModuleSnapshots(
  older: ModuleMapSnapshot,
  newer: ModuleMapSnapshot
): ModuleDiff {
  const olderModules = new Map(older.modules.map(m => [m.name, m]));
  const newerModules = new Map(newer.modules.map(m => [m.name, m]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: ModuleDiff['changed'] = [];

  // 查找新增模块
  for (const [name] of newerModules) {
    if (!olderModules.has(name)) {
      added.push(name);
    }
  }

  // 查找删除模块
  for (const [name] of olderModules) {
    if (!newerModules.has(name)) {
      removed.push(name);
    }
  }

  // 查找变更模块
  for (const [name, newMod] of newerModules) {
    const oldMod = olderModules.get(name);
    if (oldMod) {
      const healthChange = newMod.healthScore - oldMod.healthScore;
      const filesChange = newMod.stats.files - oldMod.stats.files;
      const linesChange = newMod.stats.lines - oldMod.stats.lines;

      if (healthChange !== 0 || filesChange !== 0 || Math.abs(linesChange) > 50) {
        changed.push({ name, healthChange, filesChange, linesChange });
      }
    }
  }

  return { added, removed, changed };
}

/**
 * 显示差异报告
 */
function showDiff(targetDir: string, fromDate?: string, toDate?: string): void {
  const archLatest = readReport<ArchitectureSnapshot>(targetDir, 'architecture/latest.json');
  const modulesLatest = readReport<ModuleMapSnapshot>(targetDir, 'modules/latest.json');

  if (!archLatest && !modulesLatest) {
    console.log('No reports found. Run analysis first.');
    return;
  }

  // 获取历史快照
  const historySnapshots = getHistorySnapshots(targetDir, 'architecture');

  if (historySnapshots.length === 0) {
    console.log('No historical snapshots found. Need at least 2 analyses to compare.');
    return;
  }

  // 加载对比快照
  let olderArch: ArchitectureSnapshot | null = null;

  if (fromDate) {
    const matchingSnapshot = historySnapshots.find(s => s.date.startsWith(fromDate));
    if (matchingSnapshot) {
      try {
        olderArch = JSON.parse(fs.readFileSync(matchingSnapshot.path, 'utf-8'));
      } catch {
        console.log(`Failed to load snapshot: ${matchingSnapshot.path}`);
      }
    }
  } else {
    // 使用最近的历史快照
    try {
      olderArch = JSON.parse(fs.readFileSync(historySnapshots[0].path, 'utf-8'));
    } catch {
      console.log('Failed to load historical snapshot.');
    }
  }

  if (!olderArch || !archLatest) {
    console.log('Cannot compare: missing snapshots.');
    return;
  }

  const diff = diffArchitectureSnapshots(olderArch, archLatest);

  // 输出差异报告
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    Architecture Diff Report                       ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║ From: ${diff.from.date.slice(0, 16).padEnd(20)} Health: ${diff.from.healthScore.toString().padStart(3)}/100     ║`);
  console.log(`║ To:   ${diff.to.date.slice(0, 16).padEnd(20)} Health: ${diff.to.healthScore.toString().padStart(3)}/100     ║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');

  // 健康度变化
  const healthIcon = diff.healthChange > 0 ? '📈' : diff.healthChange < 0 ? '📉' : '➡️';
  const healthSign = diff.healthChange > 0 ? '+' : '';
  console.log(`║ Health Change: ${healthIcon} ${healthSign}${diff.healthChange} points`.padEnd(67) + '║');

  // 文件变化
  console.log(`║ Files: +${diff.fileChanges.added} / -${diff.fileChanges.removed}  Lines: ${diff.fileChanges.linesChanged > 0 ? '+' : ''}${diff.fileChanges.linesChanged}`.padEnd(67) + '║');

  // 新增违规
  if (diff.newViolations.length > 0) {
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log('║ 🔴 New Violations:'.padEnd(67) + '║');
    for (const v of diff.newViolations.slice(0, 5)) {
      console.log(`║   ${v.slice(0, 62).padEnd(62)}   ║`);
    }
    if (diff.newViolations.length > 5) {
      console.log(`║   ... and ${diff.newViolations.length - 5} more`.padEnd(67) + '║');
    }
  }

  // 已解决违规
  if (diff.resolvedViolations.length > 0) {
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log('║ 🟢 Resolved Violations:'.padEnd(67) + '║');
    for (const v of diff.resolvedViolations.slice(0, 5)) {
      console.log(`║   ${v.slice(0, 62).padEnd(62)}   ║`);
    }
    if (diff.resolvedViolations.length > 5) {
      console.log(`║   ... and ${diff.resolvedViolations.length - 5} more`.padEnd(67) + '║');
    }
  }

  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

// ============ Phase 4: 趋势分析 ============

/**
 * 显示健康度趋势
 */
function showTrend(targetDir: string, days: number = 30): void {
  const timeline = readReport<HealthTimeline>(targetDir, 'health/timeline.json');

  if (!timeline || timeline.dataPoints.length === 0) {
    console.log('No health data found. Run analysis to start tracking.');
    return;
  }

  const recentPoints = timeline.dataPoints.slice(-days);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    Health Trend Analysis                          ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');

  // 趋势摘要
  const trendIcon = timeline.trends.direction === 'improving' ? '📈' :
                    timeline.trends.direction === 'declining' ? '📉' : '➡️';
  const trendText = timeline.trends.direction === 'improving' ? 'Improving' :
                    timeline.trends.direction === 'declining' ? 'Declining' : 'Stable';

  console.log(`║ Trend: ${trendIcon} ${trendText}`.padEnd(67) + '║');
  console.log(`║ Change Rate: ${timeline.trends.changeRate > 0 ? '+' : ''}${timeline.trends.changeRate}% per week`.padEnd(67) + '║');
  console.log(`║ Predicted Next: ${timeline.trends.prediction}/100`.padEnd(67) + '║');
  console.log(`║ Data Points: ${recentPoints.length} days`.padEnd(67) + '║');

  // ASCII 图表
  if (recentPoints.length >= 2) {
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log('║ Health Score Chart (last ' + days + ' days):'.padEnd(67) + '║');
    console.log('║'.padEnd(68) + '║');

    // 计算图表
    const chartHeight = 8;
    const chartWidth = 50;
    const minScore = Math.min(...recentPoints.map(p => p.healthScore));
    const maxScore = Math.max(...recentPoints.map(p => p.healthScore));
    const range = Math.max(maxScore - minScore, 10);

    // 生成图表行
    for (let row = chartHeight - 1; row >= 0; row--) {
      const threshold = minScore + (range * row / (chartHeight - 1));
      let line = `║ ${threshold.toFixed(0).padStart(3)} │`;

      const step = Math.max(1, Math.floor(recentPoints.length / chartWidth));
      for (let i = 0; i < chartWidth && i * step < recentPoints.length; i++) {
        const point = recentPoints[i * step];
        const normalizedScore = (point.healthScore - minScore) / range;
        const pointRow = Math.round(normalizedScore * (chartHeight - 1));

        if (pointRow === row) {
          line += '●';
        } else if (pointRow > row) {
          line += '│';
        } else {
          line += ' ';
        }
      }

      console.log(line.padEnd(67) + '║');
    }

    // X 轴
    console.log('║     └' + '─'.repeat(chartWidth) + ''.padEnd(11) + '║');

    // 时间标签
    const firstDate = recentPoints[0].date.slice(5, 10);
    const lastDate = recentPoints[recentPoints.length - 1].date.slice(5, 10);
    console.log(`║      ${firstDate}${''.padEnd(chartWidth - 10)}${lastDate}`.padEnd(67) + '║');
  }

  // 最近数据点
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║ Recent Data Points:'.padEnd(67) + '║');

  const lastFive = recentPoints.slice(-5).reverse();
  for (const point of lastFive) {
    const bar = '█'.repeat(Math.round(point.healthScore / 5));
    const icon = point.healthScore >= 80 ? '🟢' : point.healthScore >= 60 ? '🟡' : '🔴';
    console.log(`║   ${point.date} │ ${icon} ${point.healthScore.toString().padStart(3)}/100 ${bar}`.padEnd(67) + '║');
  }

  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

/**
 * 显示历史快照列表
 */
function showHistory(targetDir: string): void {
  const archSnapshots = getHistorySnapshots(targetDir, 'architecture');

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    Historical Snapshots                           ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');

  if (archSnapshots.length === 0) {
    console.log('║ No historical snapshots found.'.padEnd(67) + '║');
  } else {
    console.log('║ Architecture Snapshots:'.padEnd(67) + '║');
    for (const snap of archSnapshots.slice(0, 10)) {
      console.log(`║   ${snap.date}  ${snap.name}`.padEnd(67) + '║');
    }
    if (archSnapshots.length > 10) {
      console.log(`║   ... and ${archSnapshots.length - 10} more`.padEnd(67) + '║');
    }
  }

  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

// ============ CLI ============

function showHelp(): void {
  console.log(`
Report Manager - 报告管理器

用法: node report-manager.js <command> [options]

命令:
  status              查看报告状态
  cleanup             清理过期报告
    --cache-only      仅清理缓存
  export              导出报告为 Markdown
  diff                对比架构快照
    --from <date>     起始日期 (YYYY-MM-DD，可选)
  trend               显示健康度趋势
    --days <n>        显示天数 (默认: 30)
  history             列出历史快照

示例:
  node report-manager.js status
  node report-manager.js cleanup
  node report-manager.js export
  node report-manager.js diff
  node report-manager.js diff --from 2025-01-15
  node report-manager.js trend --days 14
  node report-manager.js history
`);
}

function main(): void {
  const args = process.argv.slice(2);
  let command = args[0];
  let targetDir = process.cwd();

  // 处理第一个参数是路径的情况（如 `.` 或 `./`）
  if (command === '.' || command === './' || (command && command.startsWith('./') && !command.includes(' '))) {
    // 第一个参数是路径，第二个参数是命令
    targetDir = path.resolve(command);
    command = args[1];
  }

  if (!command || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  switch (command) {
    case 'status':
      showStatus(targetDir);
      break;

    case 'cleanup':
      const cacheOnly = args.includes('--cache-only');
      cleanup(targetDir, cacheOnly);
      break;

    case 'export':
      exportMarkdown(targetDir);
      break;

    case 'diff': {
      const fromIndex = args.indexOf('--from');
      const fromDate = fromIndex !== -1 ? args[fromIndex + 1] : undefined;
      showDiff(targetDir, fromDate);
      break;
    }

    case 'trend': {
      const daysIndex = args.indexOf('--days');
      const days = daysIndex !== -1 ? parseInt(args[daysIndex + 1], 10) : 30;
      showTrend(targetDir, days);
      break;
    }

    case 'history':
      showHistory(targetDir);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

// 导出供其他模块使用
export {
  readManifest,
  writeManifest,
  getReportsPath,
  getReportAgeHours,
};

// CLI 入口 - 仅当作为主模块运行时才执行
if (require.main === module) {
  main();
}
