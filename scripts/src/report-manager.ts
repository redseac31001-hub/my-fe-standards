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
import { isDirectCliEntry } from './lib/cli-entry';
import {
  buildValidatorGateDelta,
  cleanupValidatorGateHistory,
  getPreviousValidatorGateEntry,
  readLatestValidatorGateReport,
  readValidatorGateHistory,
} from './lib/validator-gate-report';
import { readLatestWorkflowRoutingReport } from './lib/workflow-routing-selection';
import {
  ReportsManifest,
  ReportMeta,
  ArchitectureSnapshot,
  ModuleMapSnapshot,
  HealthTimeline,
  HealthDataPoint,
  ReportManagerHistorySnapshot,
  ReportManagerTrendSnapshot,
  ValidatorGateSummary,
  ReportManagerStatusSnapshot,
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

function buildReportStatusSection(meta: ReportMeta | null): ReportManagerStatusSnapshot['sections']['architecture'] {
  if (!meta) {
    return {
      present: false,
      generatedAt: null,
      ageHours: null,
      ageLabel: null,
      freshness: 'missing',
    };
  }

  const ageHours = getReportAgeHours(meta.generatedAt);
  return {
    present: true,
    generatedAt: meta.generatedAt,
    ageHours,
    ageLabel: formatAge(meta.generatedAt),
    freshness: ageHours < 24 ? 'fresh' : 'stale',
  };
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
  const meta = writeReport(
    targetDir,
    'modules/latest.json',
    snapshot,
    'module-mapper'
  );

  // 保存历史快照（用于趋势/变更查询）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const historyPath = `modules/${timestamp}.json`;
  const historyFullPath = path.join(getReportsPath(targetDir), historyPath);
  const historyDir = path.dirname(historyFullPath);
  ensureDir(historyDir);
  fs.writeFileSync(historyFullPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // 清理旧快照
  cleanupOldSnapshots(targetDir, 'modules');

  return meta;
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
export function buildStatusSnapshot(targetDir: string): ReportManagerStatusSnapshot {
  const manifest = readManifest(targetDir);
  const workflowRouting = readLatestWorkflowRoutingReport(targetDir);
  const validatorGate = readLatestValidatorGateReport(targetDir);
  const validatorGateHistory = readValidatorGateHistory(targetDir, Number.POSITIVE_INFINITY);
  const recentValidatorGateHistory = validatorGateHistory.slice(0, 5);
  const previousValidatorGate = getPreviousValidatorGateEntry(validatorGate, validatorGateHistory);
  const validatorGateDelta = buildValidatorGateDelta(validatorGate, previousValidatorGate);
  const healthTimeline = readReport<HealthTimeline>(targetDir, 'health/timeline.json');
  const { architecture, modules, health, tasks } = manifest.reports;

  const workflowRoutingAgeHours = workflowRouting ? getReportAgeHours(workflowRouting.generatedAt) : null;
  const validatorGateAgeHours = validatorGate ? getReportAgeHours(validatorGate.generatedAt) : null;

  return {
    generatedAt: new Date().toISOString(),
    targetDir,
    reportsPath: getReportsPath(targetDir),
    manifest: {
      projectName: manifest.projectName,
      lastUpdated: manifest.lastUpdated,
    },
    sections: {
      architecture: buildReportStatusSection(architecture),
      modules: buildReportStatusSection(modules),
      health: {
        ...buildReportStatusSection(health),
        trackedDays: healthTimeline?.dataPoints.length || 0,
      },
      tasks: {
        present: Boolean(tasks),
      },
      workflowRouting: {
        present: Boolean(workflowRouting),
        generatedAt: workflowRouting?.generatedAt ?? null,
        ageHours: workflowRoutingAgeHours,
        ageLabel: workflowRouting ? formatAge(workflowRouting.generatedAt) : null,
        workflowId: workflowRouting?.decision.selectedWorkflowId ?? null,
        mode: workflowRouting?.decision.mode ?? null,
        confidence: workflowRouting?.decision.confidence ?? null,
        taskBookId: workflowRouting?.taskBookId ?? null,
      },
      validatorGate: {
        present: Boolean(validatorGate),
        generatedAt: validatorGate?.generatedAt ?? null,
        ageHours: validatorGateAgeHours,
        ageLabel: validatorGate ? formatAge(validatorGate.generatedAt) : null,
        freshness: validatorGate
          ? (validatorGateAgeHours !== null && validatorGateAgeHours < 24 ? 'fresh' : 'stale')
          : 'missing',
        scope: validatorGate?.scope ?? null,
        strictMode: typeof validatorGate?.strictMode === 'boolean' ? validatorGate.strictMode : null,
        effectiveOk: typeof validatorGate?.effectiveOk === 'boolean' ? validatorGate.effectiveOk : null,
        errorCount: validatorGate?.errorCount ?? null,
        warningCount: validatorGate?.warningCount ?? null,
        issueCount: validatorGate?.issueCount ?? null,
        outputDir: validatorGate?.outputDir ?? null,
        historyDir: validatorGate?.historyDir ?? null,
        historyCount: validatorGateHistory.length,
        reportFiles: validatorGate?.reportFiles ?? [],
        previousRun: previousValidatorGate ? {
          generatedAt: previousValidatorGate.generatedAt,
          scope: previousValidatorGate.scope,
          strictMode: previousValidatorGate.strictMode,
          effectiveOk: previousValidatorGate.effectiveOk,
          errorCount: previousValidatorGate.errorCount,
          warningCount: previousValidatorGate.warningCount,
          issueCount: previousValidatorGate.issueCount,
        } : null,
        delta: validatorGateDelta,
        recentHistory: recentValidatorGateHistory,
      },
    },
  };
}

function showStatus(targetDir: string, json: boolean = false): void {
  const snapshot = buildStatusSnapshot(targetDir);

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│           CodeBuddy Reports Status                  │');
  console.log('├─────────────────────────────────────────────────────┤');

  // Architecture
  if (snapshot.sections.architecture.present && snapshot.sections.architecture.generatedAt) {
    const fresh = snapshot.sections.architecture.freshness === 'fresh' ? '✓ Fresh' : '○ Stale';
    console.log(`│ Architecture:  ${snapshot.sections.architecture.generatedAt.slice(0, 16)}  (${snapshot.sections.architecture.ageLabel})  ${fresh.padEnd(8)} │`);
  } else {
    console.log('│ Architecture:  Not generated                        │');
  }

  // Modules
  if (snapshot.sections.modules.present && snapshot.sections.modules.generatedAt) {
    const fresh = snapshot.sections.modules.freshness === 'fresh' ? '✓ Fresh' : '○ Stale';
    console.log(`│ Modules:       ${snapshot.sections.modules.generatedAt.slice(0, 16)}  (${snapshot.sections.modules.ageLabel})  ${fresh.padEnd(8)} │`);
  } else {
    console.log('│ Modules:       Not generated                        │');
  }

  // Health
  if (snapshot.sections.health.present) {
    console.log(`│ Health Points: ${snapshot.sections.health.trackedDays} days tracked`.padEnd(52) + '│');
  } else {
    console.log('│ Health Points: Not tracked                          │');
  }

  // Tasks
  if (snapshot.sections.tasks.present) {
    console.log('│ Active Task:   Yes                                  │');
  } else {
    console.log('│ Active Task:   None                                 │');
  }

  if (snapshot.sections.workflowRouting.present) {
    const routeText = `Route: ${snapshot.sections.workflowRouting.workflowId} (${snapshot.sections.workflowRouting.mode}, ${snapshot.sections.workflowRouting.ageLabel})`;
    console.log(`│ ${routeText}`.padEnd(52) + '│');
  } else {
    console.log('│ Route:         No workflow routing report           │');
  }

  if (snapshot.sections.validatorGate.present && snapshot.sections.validatorGate.scope) {
    const scope = snapshot.sections.validatorGate.scope.padEnd(6);
    const status = snapshot.sections.validatorGate.effectiveOk ? 'pass' : 'fail';
    const historySuffix = snapshot.sections.validatorGate.historyCount > 0
      ? `, runs=${snapshot.sections.validatorGate.historyCount}`
      : '';
    const trendSuffix = snapshot.sections.validatorGate.delta
      ? `, trend=${snapshot.sections.validatorGate.delta.direction}`
      : '';
    const validatorText = `Validators: ${status} (${scope.trim()}, ${snapshot.sections.validatorGate.ageLabel}${historySuffix}${trendSuffix})`;
    console.log(`│ ${validatorText}`.padEnd(52) + '│');
  } else {
    console.log('│ Validators:    No validator gate summary            │');
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

  const cleanedValidatorHistory = cleanupValidatorGateHistory(targetDir);
  console.log(`Cleaned: validator gate history (${cleanedValidatorHistory} removed)`);
  cleanedCount++;

  console.log(`Cleanup complete. Removed ${cleanedCount} items.`);
}

// ============ 导出 ============

/**
 * 导出报告为 Markdown
 */
function exportMarkdown(targetDir: string): void {
  const manifest = readManifest(targetDir);
  const workflowRouting = readLatestWorkflowRoutingReport(targetDir);
  const validatorGate = readLatestValidatorGateReport(targetDir);
  const validatorGateHistory = readValidatorGateHistory(targetDir, 5);
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

  if (workflowRouting) {
    lines.push('## 最近一次 Workflow 路由');
    lines.push('');
    lines.push(`- **TaskBook**: ${workflowRouting.taskBookId}`);
    lines.push(`- **Workflow**: ${workflowRouting.decision.selectedWorkflowId}`);
    lines.push(`- **Mode**: ${workflowRouting.decision.mode}`);
    lines.push(`- **Confidence**: ${workflowRouting.decision.confidence}`);
    if (workflowRouting.decision.fallbackReason) {
      lines.push(`- **Fallback Reason**: ${workflowRouting.decision.fallbackReason}`);
    }
    if (workflowRouting.decision.reasons.length > 0) {
      lines.push('- **Reasons**:');
      for (const reason of workflowRouting.decision.reasons.slice(0, 6)) {
        lines.push(`  - ${reason}`);
      }
    }
    lines.push('');
  }

  if (validatorGate) {
    lines.push('## 最近一次 Validator Gate');
    lines.push('');
    lines.push(`- **Scope**: ${validatorGate.scope}`);
    lines.push(`- **Strict Mode**: ${validatorGate.strictMode ? 'on' : 'off'}`);
    lines.push(`- **Effective Result**: ${validatorGate.effectiveOk ? 'pass' : 'fail'}`);
    lines.push(`- **Errors / Warnings**: ${validatorGate.errorCount} / ${validatorGate.warningCount}`);
    if (validatorGate.historyDir) {
      lines.push(`- **History Dir**: ${validatorGate.historyDir}`);
    }
    const previousValidatorGate = getPreviousValidatorGateEntry(validatorGate, validatorGateHistory);
    const validatorGateDelta = buildValidatorGateDelta(validatorGate, previousValidatorGate);
    if (previousValidatorGate && validatorGateDelta) {
      lines.push(`- **Compared To**: ${previousValidatorGate.generatedAt}`);
      lines.push(`- **Trend**: ${validatorGateDelta.direction}`);
      lines.push(`- **Delta**: errors ${validatorGateDelta.errorDelta >= 0 ? '+' : ''}${validatorGateDelta.errorDelta}, warnings ${validatorGateDelta.warningDelta >= 0 ? '+' : ''}${validatorGateDelta.warningDelta}, issues ${validatorGateDelta.issueDelta >= 0 ? '+' : ''}${validatorGateDelta.issueDelta}`);
    }
    if (validatorGate.reportFiles.length > 0) {
      lines.push(`- **Artifacts**: ${validatorGate.reportFiles.join(', ')}`);
    }
    lines.push('');
  }

  if (validatorGateHistory.length > 0) {
    lines.push('## Validator Gate 最近记录');
    lines.push('');
    lines.push('| 时间 | Scope | Strict | Result | Errors | Warnings |');
    lines.push('|------|-------|--------|--------|--------|----------|');
    for (const entry of validatorGateHistory) {
      lines.push(
        `| ${entry.generatedAt} | ${entry.scope} | ${entry.strictMode ? 'on' : 'off'} | ${entry.effectiveOk ? 'pass' : 'fail'} | ${entry.errorCount} | ${entry.warningCount} |`,
      );
    }
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
export function buildTrendSnapshot(targetDir: string, days: number = 30): ReportManagerTrendSnapshot {
  const timeline = readReport<HealthTimeline>(targetDir, 'health/timeline.json');
  const normalizedDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;
  const recentPoints = timeline?.dataPoints.slice(-normalizedDays) || [];
  const validatorGateHistory = readValidatorGateHistory(targetDir, 5);
  const latestValidatorGate = validatorGateHistory[0] || null;
  const previousValidatorGate = validatorGateHistory[1] || null;
  const validatorGateDelta = latestValidatorGate
    ? buildValidatorGateDelta(
        {
          ok: latestValidatorGate.effectiveOk,
          effectiveOk: latestValidatorGate.effectiveOk,
          strictMode: latestValidatorGate.strictMode,
          scope: latestValidatorGate.scope,
          generatedAt: latestValidatorGate.generatedAt,
          errorCount: latestValidatorGate.errorCount,
          warningCount: latestValidatorGate.warningCount,
          issueCount: latestValidatorGate.issueCount,
          outputDir: null,
          historyDir: null,
          reportFiles: [],
          reports: {},
        },
        previousValidatorGate,
      )
    : null;

  return {
    generatedAt: new Date().toISOString(),
    targetDir,
    reportsPath: getReportsPath(targetDir),
    sections: {
      health: {
        present: Boolean(timeline && timeline.dataPoints.length > 0),
        days: normalizedDays,
        direction: timeline?.trends.direction ?? null,
        changeRate: typeof timeline?.trends.changeRate === 'number' ? timeline.trends.changeRate : null,
        prediction: typeof timeline?.trends.prediction === 'number' ? timeline.trends.prediction : null,
        recentPoints,
      },
      validatorGate: {
        present: validatorGateHistory.length > 0,
        latest: latestValidatorGate ? {
          generatedAt: latestValidatorGate.generatedAt,
          scope: latestValidatorGate.scope,
          strictMode: latestValidatorGate.strictMode,
          effectiveOk: latestValidatorGate.effectiveOk,
          errorCount: latestValidatorGate.errorCount,
          warningCount: latestValidatorGate.warningCount,
          issueCount: latestValidatorGate.issueCount,
        } : null,
        previousRun: previousValidatorGate ? {
          generatedAt: previousValidatorGate.generatedAt,
          scope: previousValidatorGate.scope,
          strictMode: previousValidatorGate.strictMode,
          effectiveOk: previousValidatorGate.effectiveOk,
          errorCount: previousValidatorGate.errorCount,
          warningCount: previousValidatorGate.warningCount,
          issueCount: previousValidatorGate.issueCount,
        } : null,
        delta: validatorGateDelta,
        recentRuns: validatorGateHistory,
        passCount: validatorGateHistory.filter((entry) => entry.effectiveOk).length,
        failCount: validatorGateHistory.filter((entry) => !entry.effectiveOk).length,
      },
    },
  };
}

function showTrend(targetDir: string, days: number = 30, json: boolean = false): void {
  const snapshot = buildTrendSnapshot(targetDir, days);
  const recentPoints = snapshot.sections.health.recentPoints;

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  if (!snapshot.sections.health.present && !snapshot.sections.validatorGate.present) {
    console.log('No health or validator trend data found. Run analysis or validator gate first.');
    return;
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    Health Trend Analysis                          ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');

  if (snapshot.sections.health.present) {
    const trendDirection = snapshot.sections.health.direction || 'stable';
    const trendIcon = trendDirection === 'improving' ? '📈' :
                      trendDirection === 'declining' ? '📉' : '➡️';
    const trendText = trendDirection === 'improving' ? 'Improving' :
                      trendDirection === 'declining' ? 'Declining' : 'Stable';

    console.log(`║ Trend: ${trendIcon} ${trendText}`.padEnd(67) + '║');
    console.log(`║ Change Rate: ${(snapshot.sections.health.changeRate || 0) > 0 ? '+' : ''}${snapshot.sections.health.changeRate}% per week`.padEnd(67) + '║');
    console.log(`║ Predicted Next: ${snapshot.sections.health.prediction}/100`.padEnd(67) + '║');
    console.log(`║ Data Points: ${recentPoints.length} days`.padEnd(67) + '║');
  } else {
    console.log('║ Health: no timeline data available'.padEnd(67) + '║');
  }

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
  if (recentPoints.length > 0) {
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log('║ Recent Data Points:'.padEnd(67) + '║');

    const lastFive = recentPoints.slice(-5).reverse();
    for (const point of lastFive) {
      const bar = '█'.repeat(Math.round(point.healthScore / 5));
      const icon = point.healthScore >= 80 ? '🟢' : point.healthScore >= 60 ? '🟡' : '🔴';
      console.log(`║   ${point.date} │ ${icon} ${point.healthScore.toString().padStart(3)}/100 ${bar}`.padEnd(67) + '║');
    }
  }

  if (snapshot.sections.validatorGate.present) {
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log('║ Validator Gate Trend:'.padEnd(67) + '║');
    const latest = snapshot.sections.validatorGate.latest;
    const delta = snapshot.sections.validatorGate.delta;
    if (latest) {
      const trendText = delta ? delta.direction : 'unknown';
      console.log(`║ Latest: ${latest.generatedAt.slice(0, 16)}  ${latest.scope}  ${latest.strictMode ? 'strict' : 'default'}  ${latest.effectiveOk ? 'pass' : 'fail'}`.padEnd(67) + '║');
      console.log(`║ Recent Runs: pass=${snapshot.sections.validatorGate.passCount} fail=${snapshot.sections.validatorGate.failCount}  trend=${trendText}`.padEnd(67) + '║');
      if (delta) {
        const deltaLine = `Δ errors=${delta.errorDelta >= 0 ? '+' : ''}${delta.errorDelta} warnings=${delta.warningDelta >= 0 ? '+' : ''}${delta.warningDelta} issues=${delta.issueDelta >= 0 ? '+' : ''}${delta.issueDelta}`;
        console.log(`║ ${deltaLine}`.padEnd(67) + '║');
      }
    }
  }

  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

/**
 * 显示历史快照列表
 */
export function buildHistorySnapshot(targetDir: string): ReportManagerHistorySnapshot {
  return {
    generatedAt: new Date().toISOString(),
    targetDir,
    reportsPath: getReportsPath(targetDir),
    sections: {
      architecture: getHistorySnapshots(targetDir, 'architecture').map((item) => ({
        kind: 'architecture',
        name: item.name,
        date: item.date,
        path: item.path,
      })),
      modules: getHistorySnapshots(targetDir, 'modules').map((item) => ({
        kind: 'modules',
        name: item.name,
        date: item.date,
        path: item.path,
      })),
      validatorGate: readValidatorGateHistory(targetDir, Number.POSITIVE_INFINITY),
    },
  };
}

function showHistory(targetDir: string, json: boolean = false): void {
  const snapshot = buildHistorySnapshot(targetDir);
  const archSnapshots = snapshot.sections.architecture;
  const moduleSnapshots = snapshot.sections.modules;
  const validatorGateHistory = snapshot.sections.validatorGate;

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

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

  console.log('╠══════════════════════════════════════════════════════════════════╣');

  if (moduleSnapshots.length === 0) {
    console.log('║ No module snapshots found.'.padEnd(67) + '║');
  } else {
    console.log('║ Module Snapshots:'.padEnd(67) + '║');
    for (const snap of moduleSnapshots.slice(0, 10)) {
      console.log(`║   ${snap.date}  ${snap.name}`.padEnd(67) + '║');
    }
    if (moduleSnapshots.length > 10) {
      console.log(`║   ... and ${moduleSnapshots.length - 10} more`.padEnd(67) + '║');
    }
  }

  console.log('╠══════════════════════════════════════════════════════════════════╣');

  if (validatorGateHistory.length === 0) {
    console.log('║ No validator gate history found.'.padEnd(67) + '║');
  } else {
    console.log('║ Validator Gate Runs:'.padEnd(67) + '║');
    for (const entry of validatorGateHistory.slice(0, 10)) {
      const line = `${entry.generatedAt.slice(0, 16)}  ${entry.scope}  ${entry.strictMode ? 'strict' : 'default'}  ${entry.effectiveOk ? 'pass' : 'fail'}  e=${entry.errorCount} w=${entry.warningCount}`;
      console.log(`║   ${line.slice(0, 62).padEnd(62)}   ║`);
    }
    if (validatorGateHistory.length > 10) {
      console.log(`║   ... and ${validatorGateHistory.length - 10} more`.padEnd(67) + '║');
    }
  }

  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

// ============ Phase 6: 报告查询入口 ============

type ModuleSummaryItem = ModuleMapSnapshot['modules'][number];

type GraphIndex = {
  out: Map<string, Set<string>>;
  in: Map<string, Set<string>>;
};

function normalizeFsPath(p: string): string {
  const normalized = path.normalize(p);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function toAbsolutePath(targetDir: string, p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(targetDir, p);
}

function isSameOrSubPath(childPath: string, parentPath: string): boolean {
  const child = normalizeFsPath(childPath);
  let parent = normalizeFsPath(parentPath);

  if (child === parent) return true;
  if (!parent.endsWith(path.sep)) parent += path.sep;
  return child.startsWith(parent);
}

function buildGraphIndex(snapshot: ModuleMapSnapshot): GraphIndex {
  const out = new Map<string, Set<string>>();
  const inn = new Map<string, Set<string>>();

  for (const node of snapshot.graph.nodes) {
    out.set(node, new Set());
    inn.set(node, new Set());
  }

  for (const edge of snapshot.graph.edges) {
    if (!out.has(edge.from)) out.set(edge.from, new Set());
    if (!inn.has(edge.to)) inn.set(edge.to, new Set());
    out.get(edge.from)!.add(edge.to);
    inn.get(edge.to)!.add(edge.from);
  }

  return { out, in: inn };
}

function bfsTraverse(start: string, adjacency: Map<string, Set<string>>, depth: number): Array<{ name: string; depth: number }> {
  const result: Array<{ name: string; depth: number }> = [];
  if (depth <= 0) return result;

  const visited = new Set<string>([start]);
  let frontier = new Set<string>([start]);

  for (let d = 1; d <= depth; d++) {
    const next = new Set<string>();

    for (const node of frontier) {
      const neighbors = adjacency.get(node);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (visited.has(n)) continue;
        visited.add(n);
        next.add(n);
        result.push({ name: n, depth: d });
      }
    }

    if (next.size === 0) break;
    frontier = next;
  }

  return result;
}

function findModuleByQuery(snapshot: ModuleMapSnapshot, query: string): { match: ModuleSummaryItem | null; candidates: ModuleSummaryItem[] } {
  const q = query.trim();
  if (!q) return { match: null, candidates: [] };

  const qLower = q.toLowerCase();
  const modules = snapshot.modules;

  const exact = modules.find((m) => m.name === q || m.chineseName === q || m.routePath === q || m.path === q);
  if (exact) return { match: exact, candidates: [exact] };

  const candidates = modules.filter((m) => {
    const fields = [m.name, m.chineseName, m.routePath ?? '', m.path];
    return fields.some((f) => f.toLowerCase().includes(qLower));
  });

  if (candidates.length === 1) return { match: candidates[0], candidates };
  return { match: null, candidates };
}

function findBestModuleForFile(targetDir: string, snapshot: ModuleMapSnapshot, filePathInput: string): { fileAbs: string; module: ModuleSummaryItem | null; candidates: ModuleSummaryItem[] } {
  const fileAbs = toAbsolutePath(targetDir, filePathInput);
  const candidates = snapshot.modules.filter((m) => isSameOrSubPath(fileAbs, m.path));
  if (candidates.length === 0) return { fileAbs, module: null, candidates: [] };

  // 选最具体（路径最长）的模块
  const sorted = [...candidates].sort((a, b) => normalizeFsPath(b.path).length - normalizeFsPath(a.path).length);
  return { fileAbs, module: sorted[0], candidates: sorted };
}

function summarizeViolationsForPath(
  targetDir: string,
  snapshot: ArchitectureSnapshot | null,
  pathPrefixAbs: string,
  limit: number
): {
  counts: { error: number; warning: number; info: number };
  total: number;
  top: Array<{ rule: string; severity: string; path: string; message: string }>;
} {
  const counts = { error: 0, warning: 0, info: 0 };
  if (!snapshot) return { counts, total: 0, top: [] };

  const prefix = toAbsolutePath(targetDir, pathPrefixAbs);

  const matched = snapshot.violations.filter((v) => {
    const vPath = toAbsolutePath(targetDir, v.path);
    return isSameOrSubPath(vPath, prefix);
  });

  for (const v of matched) {
    if (v.severity === 'error') counts.error += 1;
    else if (v.severity === 'warning') counts.warning += 1;
    else counts.info += 1;
  }

  const top = matched
    .slice(0, limit)
    .map((v) => ({ rule: v.rule, severity: v.severity, path: v.path, message: v.message }));

  return { counts, total: matched.length, top };
}

function buildViolationsTrend(
  targetDir: string,
  pathPrefixAbs: string,
  points: number
): Array<{ date: string; total: number; error: number; warning: number; info: number }> {
  const history = getHistorySnapshots(targetDir, 'architecture').slice(0, Math.max(1, points)).reverse();
  const result: Array<{ date: string; total: number; error: number; warning: number; info: number }> = [];

  for (const h of history) {
    try {
      const snap = JSON.parse(fs.readFileSync(h.path, 'utf-8')) as ArchitectureSnapshot;
      const summary = summarizeViolationsForPath(targetDir, snap, pathPrefixAbs, 0);
      result.push({
        date: snap.meta.analyzedAt,
        total: summary.total,
        error: summary.counts.error,
        warning: summary.counts.warning,
        info: summary.counts.info,
      });
    } catch {
      // ignore bad snapshot
    }
  }

  return result;
}

function buildModuleHealthTrend(
  targetDir: string,
  moduleName: string,
  points: number
): Array<{ date: string; healthScore: number; files: number; lines: number }> {
  const history = getHistorySnapshots(targetDir, 'modules').slice(0, Math.max(1, points)).reverse();
  const result: Array<{ date: string; healthScore: number; files: number; lines: number }> = [];

  for (const h of history) {
    try {
      const snap = JSON.parse(fs.readFileSync(h.path, 'utf-8')) as ModuleMapSnapshot;
      const mod = snap.modules.find((m) => m.name === moduleName);
      if (!mod) continue;
      result.push({
        date: snap.meta.analyzedAt,
        healthScore: mod.healthScore,
        files: mod.stats.files,
        lines: mod.stats.lines,
      });
    } catch {
      // ignore bad snapshot
    }
  }

  // 兼容旧项目：没有历史时，至少返回 latest
  if (result.length === 0) {
    const latest = readReport<ModuleMapSnapshot>(targetDir, 'modules/latest.json');
    const mod = latest?.modules.find((m) => m.name === moduleName);
    if (latest && mod) {
      result.push({
        date: latest.meta.analyzedAt,
        healthScore: mod.healthScore,
        files: mod.stats.files,
        lines: mod.stats.lines,
      });
    }
  }

  return result;
}

function inspectReport(
  targetDir: string,
  opts: { module?: string; file?: string; depth: number; trendPoints: number; json: boolean }
): void {
  const modulesLatest = readReport<ModuleMapSnapshot>(targetDir, 'modules/latest.json');
  const archLatest = readReport<ArchitectureSnapshot>(targetDir, 'architecture/latest.json');

  if (!modulesLatest) {
    const message = 'No module report found. Run module-mapper / analysis first.';
    if (opts.json) {
      console.log(JSON.stringify({ error: { code: 'NO_MODULE_REPORT', message }, source: { targetDir } }, null, 2));
      return;
    }
    console.log(message);
    return;
  }

  if (modulesLatest.modules.length === 0) {
    const message = 'Module report exists, but no modules were detected.';
    if (opts.json) {
      console.log(JSON.stringify({ error: { code: 'NO_MODULES', message }, source: { targetDir } }, null, 2));
      return;
    }
    console.log(message);
    return;
  }

  let module: ModuleSummaryItem | null = null;
  let fileAbs: string | null = null;
  let candidates: ModuleSummaryItem[] = [];

  if (opts.file) {
    const match = findBestModuleForFile(targetDir, modulesLatest, opts.file);
    fileAbs = match.fileAbs;
    module = match.module;
    candidates = match.candidates;
  } else if (opts.module) {
    const match = findModuleByQuery(modulesLatest, opts.module);
    module = match.match;
    candidates = match.candidates;
  } else {
    const message = 'inspect 需要 --module <name> 或 --file <path>';
    if (opts.json) {
      console.log(JSON.stringify({ error: { code: 'MISSING_ARGUMENT', message }, source: { targetDir } }, null, 2));
      return;
    }
    console.error(message);
    return;
  }

  if (!module) {
    if (candidates.length > 1) {
      if (opts.json) {
        console.log(JSON.stringify({
          error: { code: 'MULTIPLE_MATCHES', message: 'Found multiple modules, please be more specific.' },
          source: { targetDir },
          input: { module: opts.module ?? null, file: opts.file ?? null, resolvedFile: fileAbs },
          candidates: candidates.slice(0, 50).map((c) => ({
            name: c.name,
            chineseName: c.chineseName,
            routePath: c.routePath ?? null,
            path: c.path,
          })),
        }, null, 2));
        return;
      }

      console.log('Found multiple modules, please be more specific:');
      for (const c of candidates.slice(0, 20)) {
        console.log(`- ${c.name} (${c.chineseName})  ${c.routePath ?? ''}`.trim());
      }
      if (candidates.length > 20) console.log(`... and ${candidates.length - 20} more`);
      return;
    }

    const message = 'No matching module found.';
    if (opts.json) {
      console.log(JSON.stringify({
        error: { code: 'NO_MATCH', message },
        source: { targetDir },
        input: { module: opts.module ?? null, file: opts.file ?? null, resolvedFile: fileAbs },
      }, null, 2));
      return;
    }

    console.log(message);
    if (fileAbs) console.log(`file: ${fileAbs}`);
    return;
  }

  const graph = buildGraphIndex(modulesLatest);
  const upstream = bfsTraverse(module.name, graph.out, opts.depth);
  const downstream = bfsTraverse(module.name, graph.in, opts.depth);

  const violations = summarizeViolationsForPath(targetDir, archLatest, module.path, 8);
  const violationsTrend = buildViolationsTrend(targetDir, module.path, opts.trendPoints);
  const moduleHealthTrend = buildModuleHealthTrend(targetDir, module.name, opts.trendPoints);

  const moduleRelPath = isSameOrSubPath(module.path, targetDir) ? path.relative(targetDir, module.path) : module.path;

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      targetDir,
      reports: {
        modules: 'modules/latest.json',
        architecture: archLatest ? 'architecture/latest.json' : null,
      },
    },
    input: {
      module: opts.module ?? null,
      file: opts.file ?? null,
      resolvedFile: fileAbs,
      depth: opts.depth,
      trendPoints: opts.trendPoints,
    },
    module: {
      name: module.name,
      chineseName: module.chineseName,
      category: module.category,
      type: module.type,
      routePath: module.routePath ?? null,
      path: module.path,
      pathRelative: moduleRelPath,
      stats: module.stats,
      healthScore: module.healthScore,
    },
    graph: {
      upstream,
      downstream,
      inDegree: graph.in.get(module.name)?.size ?? 0,
      outDegree: graph.out.get(module.name)?.size ?? 0,
    },
    violations: {
      total: violations.total,
      counts: violations.counts,
      top: violations.top,
    },
    trends: {
      moduleHealth: moduleHealthTrend,
      violations: violationsTrend,
    },
  };

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                         Report Inspect                            ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  if (fileAbs) {
    console.log(`║ File: ${fileAbs}`.padEnd(67) + '║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');
  }
  console.log(`║ Module: ${module.chineseName} (${module.name})`.padEnd(67) + '║');
  console.log(`║ Path: ${moduleRelPath}`.padEnd(67) + '║');
  console.log(`║ Type: ${module.type}  Category: ${module.category}`.padEnd(67) + '║');
  console.log(`║ Health: ${module.healthScore}/100  Files: ${module.stats.files}  Lines: ${module.stats.lines.toLocaleString()}`.padEnd(67) + '║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');

  const inDegree = graph.in.get(module.name)?.size ?? 0;
  const outDegree = graph.out.get(module.name)?.size ?? 0;
  console.log(`║ Graph: dependents(in)=${inDegree}  dependencies(out)=${outDegree}`.padEnd(67) + '║');

  const upList = upstream.filter((x) => x.depth === 1).map((x) => x.name);
  const downList = downstream.filter((x) => x.depth === 1).map((x) => x.name);
  console.log(`║ Upstream (depth=1): ${upList.slice(0, 8).join(', ') || '-'}`.padEnd(67) + '║');
  console.log(`║ Downstream (depth=1): ${downList.slice(0, 8).join(', ') || '-'}`.padEnd(67) + '║');

  if (opts.depth > 1) {
    const upAll = upstream.map((x) => x.name);
    const downAll = downstream.map((x) => x.name);
    console.log(`║ Upstream (depth=${opts.depth}): ${upAll.slice(0, 12).join(', ') || '-'}`.padEnd(67) + '║');
    console.log(`║ Downstream (depth=${opts.depth}): ${downAll.slice(0, 12).join(', ') || '-'}`.padEnd(67) + '║');
  }

  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║ Violations (latest): total=${violations.total}  e=${violations.counts.error}  w=${violations.counts.warning}  i=${violations.counts.info}`.padEnd(67) + '║');
  for (const v of violations.top) {
    const line = `[${v.rule}] ${v.message}`;
    console.log(`║   ${line.slice(0, 62).padEnd(62)}   ║`);
  }

  if (moduleHealthTrend.length >= 2) {
    const first = moduleHealthTrend[0];
    const last = moduleHealthTrend[moduleHealthTrend.length - 1];
    const delta = last.healthScore - first.healthScore;
    const sign = delta > 0 ? '+' : '';
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log(`║ Trend (health): ${first.healthScore} -> ${last.healthScore} (${sign}${delta})`.padEnd(67) + '║');
  }

  if (violationsTrend.length >= 2) {
    const first = violationsTrend[0];
    const last = violationsTrend[violationsTrend.length - 1];
    const delta = last.total - first.total;
    const sign = delta > 0 ? '+' : '';
    console.log(`║ Trend (violations): ${first.total} -> ${last.total} (${sign}${delta})`.padEnd(67) + '║');
  }

  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

function hotspotsReport(targetDir: string, opts: { top: number; json: boolean }): void {
  const modulesLatest = readReport<ModuleMapSnapshot>(targetDir, 'modules/latest.json');
  const archLatest = readReport<ArchitectureSnapshot>(targetDir, 'architecture/latest.json');

  if (!modulesLatest) {
    const message = 'No module report found. Run module-mapper / analysis first.';
    if (opts.json) {
      console.log(JSON.stringify({ error: { code: 'NO_MODULE_REPORT', message }, source: { targetDir } }, null, 2));
      return;
    }
    console.log(message);
    return;
  }

  if (modulesLatest.modules.length === 0) {
    const message = 'Module report exists, but no modules were detected.';
    if (opts.json) {
      console.log(JSON.stringify({ error: { code: 'NO_MODULES', message }, source: { targetDir } }, null, 2));
      return;
    }
    console.log(message);
    return;
  }

  const graph = buildGraphIndex(modulesLatest);

  const rows = modulesLatest.modules.map((m) => {
    const inDegree = graph.in.get(m.name)?.size ?? 0;
    const outDegree = graph.out.get(m.name)?.size ?? 0;
    const vSummary = summarizeViolationsForPath(targetDir, archLatest, m.path, 0);
    return {
      name: m.name,
      chineseName: m.chineseName,
      routePath: m.routePath ?? null,
      type: m.type,
      category: m.category,
      healthScore: m.healthScore,
      files: m.stats.files,
      lines: m.stats.lines,
      inDegree,
      outDegree,
      violations: vSummary.total,
      violationsError: vSummary.counts.error,
      violationsWarning: vSummary.counts.warning,
    };
  });

  const top = Math.max(1, Math.min(50, opts.top));

  const mostDependedOn = [...rows].sort((a, b) => b.inDegree - a.inDegree).slice(0, top);
  const largestByLines = [...rows].sort((a, b) => b.lines - a.lines).slice(0, top);
  const lowestHealth = [...rows].sort((a, b) => a.healthScore - b.healthScore).slice(0, top);
  const mostViolations = [...rows].sort((a, b) => b.violations - a.violations).slice(0, top);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: { targetDir },
    top,
    lists: {
      mostDependedOn,
      largestByLines,
      lowestHealth,
      mostViolations,
    },
  };

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                         Report Hotspots                           ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');

  const printList = (title: string, items: Array<{ name: string; chineseName: string; inDegree: number; lines: number; healthScore: number; violations: number }>) => {
    console.log(`║ ${title}`.padEnd(67) + '║');
    for (const it of items) {
      const line = `${it.name}  in=${it.inDegree}  lines=${it.lines}  health=${it.healthScore}  vio=${it.violations}`;
      console.log(`║   ${line.slice(0, 62).padEnd(62)}   ║`);
    }
    console.log('╠══════════════════════════════════════════════════════════════════╣');
  };

  printList(`Top ${top}: Most Depended-On (downstream impact)`, mostDependedOn);
  printList(`Top ${top}: Largest By Lines`, largestByLines);
  printList(`Top ${top}: Lowest Health`, lowestHealth);
  printList(`Top ${top}: Most Violations (architecture latest)`, mostViolations);

  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

// ============ CLI ============

function showHelp(): void {
  console.log(`
Report Manager - 报告管理器

用法: node report-manager.js <command> [options]

产品路径:
  1. 观察 / 当前状态     node report-manager.js status
  2. 观察 / 导出汇报     node report-manager.js export
  3. 观察 / 热点定位     node report-manager.js hotspots --top 10
  4. 观察 / 深入分析     node report-manager.js inspect --module "src/features/user"

命令:
  status              查看报告状态
    --json            输出机器可读的当前报告摘要
  cleanup             清理过期报告
    --cache-only      仅清理缓存
  export              导出报告为 Markdown
  diff                对比架构快照
    --from <date>     起始日期 (YYYY-MM-DD，可选)
  trend               显示健康度趋势
    --days <n>        显示天数 (默认: 30)
    --json            输出 health / validator trend JSON
  history             列出历史快照
    --json            输出 architecture / modules / validator gate 历史 JSON
  inspect             查询模块/文件的上下游、热点与趋势
    --module <q>      按模块（name/chineseName/routePath/path）查询
    --file <path>     按文件路径查询（会自动定位所属模块）
    --depth <n>       依赖图遍历深度 (默认: 1)
    --trend <n>       趋势点数 (默认: 7)
    --json            输出 JSON
  hotspots            列出热点模块（依赖影响/规模/健康度/违规）
    --top <n>         列表长度 (默认: 10)
    --json            输出 JSON

示例:
  node report-manager.js status
  node report-manager.js status --json
  node report-manager.js cleanup
  node report-manager.js export
  node report-manager.js diff
  node report-manager.js diff --from 2025-01-15
  node report-manager.js trend --days 14
  node report-manager.js trend --json
  node report-manager.js history
  node report-manager.js history --json
  node report-manager.js inspect --module "src/features/user"
  node report-manager.js inspect --file "src/features/user/index.ts"
  node report-manager.js hotspots --top 15

说明:
  - 这是“观察 / 汇报”入口，不负责安装或执行闭环。
  - 安装 / 诊断优先走 codebuddy-loader；启动闭环优先走 task-orchestrator。
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
      showStatus(targetDir, args.includes('--json'));
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
      showTrend(targetDir, days, args.includes('--json'));
      break;
    }

    case 'history':
      showHistory(targetDir, args.includes('--json'));
      break;

    case 'inspect': {
      const moduleIndex = args.indexOf('--module');
      const fileIndex = args.indexOf('--file');
      const depthIndex = args.indexOf('--depth');
      const trendIndex = args.indexOf('--trend');
      const json = args.includes('--json');

      const module = moduleIndex !== -1 ? args[moduleIndex + 1] : undefined;
      const file = fileIndex !== -1 ? args[fileIndex + 1] : undefined;
      const depth = depthIndex !== -1 ? parseInt(args[depthIndex + 1], 10) : 1;
      const trendPoints = trendIndex !== -1 ? parseInt(args[trendIndex + 1], 10) : 7;

      inspectReport(targetDir, {
        module,
        file,
        depth: Number.isFinite(depth) && depth > 0 ? depth : 1,
        trendPoints: Number.isFinite(trendPoints) && trendPoints > 0 ? trendPoints : 7,
        json,
      });
      break;
    }

    case 'hotspots': {
      const topIndex = args.indexOf('--top');
      const json = args.includes('--json');
      const top = topIndex !== -1 ? parseInt(args[topIndex + 1], 10) : 10;
      hotspotsReport(targetDir, { top: Number.isFinite(top) && top > 0 ? top : 10, json });
      break;
    }

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
  cleanup as cleanupReports,
  readLatestValidatorGateReport,
  readValidatorGateHistory,
};

// CLI 入口 - 仅当作为主模块运行时才执行
if (isDirectCliEntry('report-manager.js')) {
  main();
}
