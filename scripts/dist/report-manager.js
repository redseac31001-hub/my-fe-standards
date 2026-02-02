#!/usr/bin/env node
"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportExists = reportExists;
exports.readReport = readReport;
exports.writeReport = writeReport;
exports.saveArchitectureSnapshot = saveArchitectureSnapshot;
exports.saveModuleMapSnapshot = saveModuleMapSnapshot;
exports.appendHealthDataPoint = appendHealthDataPoint;
exports.readManifest = readManifest;
exports.writeManifest = writeManifest;
exports.getReportsPath = getReportsPath;
exports.getReportAgeHours = getReportAgeHours;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const reports_1 = require("./types/reports");
// ============ 常量 ============
const REPORTS_DIR = '.codebuddy/reports';
const MANIFEST_FILE = 'manifest.json';
// ============ 工具函数 ============
/**
 * 获取报告目录路径
 */
function getReportsPath(targetDir) {
    return path.join(targetDir, REPORTS_DIR);
}
/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
/**
 * 计算内容哈希
 */
function computeHash(content) {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}
/**
 * 格式化文件大小
 */
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
/**
 * 格式化时间差
 */
function formatAge(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0)
        return `${days}d ago`;
    if (hours > 0)
        return `${hours}h ago`;
    return 'just now';
}
/**
 * 获取报告年龄（小时）
 */
function getReportAgeHours(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    return Math.floor(diff / (1000 * 60 * 60));
}
// ============ Manifest 管理 ============
/**
 * 读取 Manifest
 */
function readManifest(targetDir) {
    const manifestPath = path.join(getReportsPath(targetDir), MANIFEST_FILE);
    if (!fs.existsSync(manifestPath)) {
        return {
            ...reports_1.DEFAULT_MANIFEST,
            projectName: path.basename(targetDir),
            lastUpdated: new Date().toISOString(),
        };
    }
    try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        return JSON.parse(content);
    }
    catch (_a) {
        return {
            ...reports_1.DEFAULT_MANIFEST,
            projectName: path.basename(targetDir),
            lastUpdated: new Date().toISOString(),
        };
    }
}
/**
 * 写入 Manifest
 */
function writeManifest(targetDir, manifest) {
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
function reportExists(targetDir, reportPath) {
    const fullPath = path.join(getReportsPath(targetDir), reportPath);
    return fs.existsSync(fullPath);
}
/**
 * 读取报告
 */
function readReport(targetDir, reportPath) {
    const fullPath = path.join(getReportsPath(targetDir), reportPath);
    if (!fs.existsSync(fullPath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return JSON.parse(content);
    }
    catch (_a) {
        return null;
    }
}
/**
 * 写入报告
 */
function writeReport(targetDir, reportPath, data, generatedBy) {
    const reportsPath = getReportsPath(targetDir);
    const fullPath = path.join(reportsPath, reportPath);
    const dirPath = path.dirname(fullPath);
    ensureDir(dirPath);
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(fullPath, content, 'utf-8');
    const meta = {
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
function getReportType(reportPath) {
    if (reportPath.includes('architecture'))
        return 'architecture-snapshot';
    if (reportPath.includes('modules'))
        return 'module-map';
    if (reportPath.includes('health'))
        return 'health-timeline';
    if (reportPath.includes('tasks'))
        return 'task-context';
    return 'architecture-snapshot';
}
/**
 * 更新 manifest 中的报告引用
 */
function updateManifestReport(manifest, meta) {
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
function saveArchitectureSnapshot(targetDir, snapshot) {
    // 保存最新快照
    const meta = writeReport(targetDir, 'architecture/latest.json', snapshot, 'structure-analyzer');
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
function cleanupOldSnapshots(targetDir, subDir) {
    const dirPath = path.join(getReportsPath(targetDir), subDir);
    if (!fs.existsSync(dirPath))
        return;
    const files = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.json') && f !== 'latest.json')
        .map(f => ({
        name: f,
        path: path.join(dirPath, f),
        time: fs.statSync(path.join(dirPath, f)).mtime.getTime(),
    }))
        .sort((a, b) => b.time - a.time);
    const { maxCount, maxAgeDays } = reports_1.DEFAULT_RETENTION_POLICY.snapshots;
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
function saveModuleMapSnapshot(targetDir, snapshot) {
    const meta = writeReport(targetDir, 'modules/latest.json', snapshot, 'module-mapper');
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
function appendHealthDataPoint(targetDir, dataPoint) {
    let timeline = readReport(targetDir, 'health/timeline.json');
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
    }
    else {
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
function calculateTrends(dataPoints) {
    var _a;
    if (dataPoints.length < 2) {
        return {
            direction: 'stable',
            changeRate: 0,
            prediction: ((_a = dataPoints[0]) === null || _a === void 0 ? void 0 : _a.healthScore) || 0,
        };
    }
    const recent = dataPoints.slice(-7);
    const first = recent[0].healthScore;
    const last = recent[recent.length - 1].healthScore;
    const changeRate = ((last - first) / first) * 100;
    let direction = 'stable';
    if (changeRate > 5)
        direction = 'improving';
    else if (changeRate < -5)
        direction = 'declining';
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
function showStatus(targetDir) {
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
    }
    else {
        console.log('│ Architecture:  Not generated                        │');
    }
    // Modules
    if (modules) {
        const age = formatAge(modules.generatedAt);
        const fresh = getReportAgeHours(modules.generatedAt) < 24 ? '✓ Fresh' : '○ Stale';
        console.log(`│ Modules:       ${modules.generatedAt.slice(0, 16)}  (${age})  ${fresh.padEnd(8)} │`);
    }
    else {
        console.log('│ Modules:       Not generated                        │');
    }
    // Health
    if (health) {
        const timeline = readReport(targetDir, 'health/timeline.json');
        const points = (timeline === null || timeline === void 0 ? void 0 : timeline.dataPoints.length) || 0;
        console.log(`│ Health Points: ${points} days tracked`.padEnd(52) + '│');
    }
    else {
        console.log('│ Health Points: Not tracked                          │');
    }
    // Tasks
    if (tasks) {
        console.log('│ Active Task:   Yes                                  │');
    }
    else {
        console.log('│ Active Task:   None                                 │');
    }
    console.log('└─────────────────────────────────────────────────────┘');
    console.log('');
}
// ============ 清理 ============
/**
 * 清理过期报告
 */
function cleanup(targetDir, cacheOnly = false) {
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
function exportMarkdown(targetDir) {
    const manifest = readManifest(targetDir);
    const lines = [];
    lines.push('# CodeBuddy 项目报告');
    lines.push('');
    lines.push(`> 项目: ${manifest.projectName}`);
    lines.push(`> 生成时间: ${new Date().toISOString()}`);
    lines.push('');
    // 架构快照
    const arch = readReport(targetDir, 'architecture/latest.json');
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
    const modules = readReport(targetDir, 'modules/latest.json');
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
    const health = readReport(targetDir, 'health/timeline.json');
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
/**
 * 获取历史快照列表
 */
function getHistorySnapshots(targetDir, subDir) {
    const dirPath = path.join(getReportsPath(targetDir), subDir);
    if (!fs.existsSync(dirPath))
        return [];
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
function diffArchitectureSnapshots(older, newer) {
    const olderViolations = new Set(older.violations.map(v => `${v.rule}:${v.path}`));
    const newerViolations = new Set(newer.violations.map(v => `${v.rule}:${v.path}`));
    const newViolations = [];
    const resolvedViolations = [];
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
function diffModuleSnapshots(older, newer) {
    const olderModules = new Map(older.modules.map(m => [m.name, m]));
    const newerModules = new Map(newer.modules.map(m => [m.name, m]));
    const added = [];
    const removed = [];
    const changed = [];
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
function showDiff(targetDir, fromDate, toDate) {
    const archLatest = readReport(targetDir, 'architecture/latest.json');
    const modulesLatest = readReport(targetDir, 'modules/latest.json');
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
    let olderArch = null;
    if (fromDate) {
        const matchingSnapshot = historySnapshots.find(s => s.date.startsWith(fromDate));
        if (matchingSnapshot) {
            try {
                olderArch = JSON.parse(fs.readFileSync(matchingSnapshot.path, 'utf-8'));
            }
            catch (_a) {
                console.log(`Failed to load snapshot: ${matchingSnapshot.path}`);
            }
        }
    }
    else {
        // 使用最近的历史快照
        try {
            olderArch = JSON.parse(fs.readFileSync(historySnapshots[0].path, 'utf-8'));
        }
        catch (_b) {
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
function showTrend(targetDir, days = 30) {
    const timeline = readReport(targetDir, 'health/timeline.json');
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
                }
                else if (pointRow > row) {
                    line += '│';
                }
                else {
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
function showHistory(targetDir) {
    const archSnapshots = getHistorySnapshots(targetDir, 'architecture');
    const moduleSnapshots = getHistorySnapshots(targetDir, 'modules');
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                    Historical Snapshots                           ║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    if (archSnapshots.length === 0) {
        console.log('║ No historical snapshots found.'.padEnd(67) + '║');
    }
    else {
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
    }
    else {
        console.log('║ Module Snapshots:'.padEnd(67) + '║');
        for (const snap of moduleSnapshots.slice(0, 10)) {
            console.log(`║   ${snap.date}  ${snap.name}`.padEnd(67) + '║');
        }
        if (moduleSnapshots.length > 10) {
            console.log(`║   ... and ${moduleSnapshots.length - 10} more`.padEnd(67) + '║');
        }
    }
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
}
function normalizeFsPath(p) {
    const normalized = path.normalize(p);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
function toAbsolutePath(targetDir, p) {
    return path.isAbsolute(p) ? p : path.resolve(targetDir, p);
}
function isSameOrSubPath(childPath, parentPath) {
    const child = normalizeFsPath(childPath);
    let parent = normalizeFsPath(parentPath);
    if (child === parent)
        return true;
    if (!parent.endsWith(path.sep))
        parent += path.sep;
    return child.startsWith(parent);
}
function buildGraphIndex(snapshot) {
    const out = new Map();
    const inn = new Map();
    for (const node of snapshot.graph.nodes) {
        out.set(node, new Set());
        inn.set(node, new Set());
    }
    for (const edge of snapshot.graph.edges) {
        if (!out.has(edge.from))
            out.set(edge.from, new Set());
        if (!inn.has(edge.to))
            inn.set(edge.to, new Set());
        out.get(edge.from).add(edge.to);
        inn.get(edge.to).add(edge.from);
    }
    return { out, in: inn };
}
function bfsTraverse(start, adjacency, depth) {
    const result = [];
    if (depth <= 0)
        return result;
    const visited = new Set([start]);
    let frontier = new Set([start]);
    for (let d = 1; d <= depth; d++) {
        const next = new Set();
        for (const node of frontier) {
            const neighbors = adjacency.get(node);
            if (!neighbors)
                continue;
            for (const n of neighbors) {
                if (visited.has(n))
                    continue;
                visited.add(n);
                next.add(n);
                result.push({ name: n, depth: d });
            }
        }
        if (next.size === 0)
            break;
        frontier = next;
    }
    return result;
}
function findModuleByQuery(snapshot, query) {
    const q = query.trim();
    if (!q)
        return { match: null, candidates: [] };
    const qLower = q.toLowerCase();
    const modules = snapshot.modules;
    const exact = modules.find((m) => m.name === q || m.chineseName === q || m.routePath === q || m.path === q);
    if (exact)
        return { match: exact, candidates: [exact] };
    const candidates = modules.filter((m) => {
        var _a;
        const fields = [m.name, m.chineseName, (_a = m.routePath) !== null && _a !== void 0 ? _a : '', m.path];
        return fields.some((f) => f.toLowerCase().includes(qLower));
    });
    if (candidates.length === 1)
        return { match: candidates[0], candidates };
    return { match: null, candidates };
}
function findBestModuleForFile(targetDir, snapshot, filePathInput) {
    const fileAbs = toAbsolutePath(targetDir, filePathInput);
    const candidates = snapshot.modules.filter((m) => isSameOrSubPath(fileAbs, m.path));
    if (candidates.length === 0)
        return { fileAbs, module: null, candidates: [] };
    // 选最具体（路径最长）的模块
    const sorted = [...candidates].sort((a, b) => normalizeFsPath(b.path).length - normalizeFsPath(a.path).length);
    return { fileAbs, module: sorted[0], candidates: sorted };
}
function summarizeViolationsForPath(targetDir, snapshot, pathPrefixAbs, limit) {
    const counts = { error: 0, warning: 0, info: 0 };
    if (!snapshot)
        return { counts, total: 0, top: [] };
    const prefix = toAbsolutePath(targetDir, pathPrefixAbs);
    const matched = snapshot.violations.filter((v) => {
        const vPath = toAbsolutePath(targetDir, v.path);
        return isSameOrSubPath(vPath, prefix);
    });
    for (const v of matched) {
        if (v.severity === 'error')
            counts.error += 1;
        else if (v.severity === 'warning')
            counts.warning += 1;
        else
            counts.info += 1;
    }
    const top = matched
        .slice(0, limit)
        .map((v) => ({ rule: v.rule, severity: v.severity, path: v.path, message: v.message }));
    return { counts, total: matched.length, top };
}
function buildViolationsTrend(targetDir, pathPrefixAbs, points) {
    const history = getHistorySnapshots(targetDir, 'architecture').slice(0, Math.max(1, points)).reverse();
    const result = [];
    for (const h of history) {
        try {
            const snap = JSON.parse(fs.readFileSync(h.path, 'utf-8'));
            const summary = summarizeViolationsForPath(targetDir, snap, pathPrefixAbs, 0);
            result.push({
                date: snap.meta.analyzedAt,
                total: summary.total,
                error: summary.counts.error,
                warning: summary.counts.warning,
                info: summary.counts.info,
            });
        }
        catch (_a) {
            // ignore bad snapshot
        }
    }
    return result;
}
function buildModuleHealthTrend(targetDir, moduleName, points) {
    const history = getHistorySnapshots(targetDir, 'modules').slice(0, Math.max(1, points)).reverse();
    const result = [];
    for (const h of history) {
        try {
            const snap = JSON.parse(fs.readFileSync(h.path, 'utf-8'));
            const mod = snap.modules.find((m) => m.name === moduleName);
            if (!mod)
                continue;
            result.push({
                date: snap.meta.analyzedAt,
                healthScore: mod.healthScore,
                files: mod.stats.files,
                lines: mod.stats.lines,
            });
        }
        catch (_a) {
            // ignore bad snapshot
        }
    }
    // 兼容旧项目：没有历史时，至少返回 latest
    if (result.length === 0) {
        const latest = readReport(targetDir, 'modules/latest.json');
        const mod = latest === null || latest === void 0 ? void 0 : latest.modules.find((m) => m.name === moduleName);
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
function inspectReport(targetDir, opts) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    const modulesLatest = readReport(targetDir, 'modules/latest.json');
    const archLatest = readReport(targetDir, 'architecture/latest.json');
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
    let module = null;
    let fileAbs = null;
    let candidates = [];
    if (opts.file) {
        const match = findBestModuleForFile(targetDir, modulesLatest, opts.file);
        fileAbs = match.fileAbs;
        module = match.module;
        candidates = match.candidates;
    }
    else if (opts.module) {
        const match = findModuleByQuery(modulesLatest, opts.module);
        module = match.match;
        candidates = match.candidates;
    }
    else {
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
                    input: { module: (_a = opts.module) !== null && _a !== void 0 ? _a : null, file: (_b = opts.file) !== null && _b !== void 0 ? _b : null, resolvedFile: fileAbs },
                    candidates: candidates.slice(0, 50).map((c) => {
                        var _a;
                        return ({
                            name: c.name,
                            chineseName: c.chineseName,
                            routePath: (_a = c.routePath) !== null && _a !== void 0 ? _a : null,
                            path: c.path,
                        });
                    }),
                }, null, 2));
                return;
            }
            console.log('Found multiple modules, please be more specific:');
            for (const c of candidates.slice(0, 20)) {
                console.log(`- ${c.name} (${c.chineseName})  ${(_c = c.routePath) !== null && _c !== void 0 ? _c : ''}`.trim());
            }
            if (candidates.length > 20)
                console.log(`... and ${candidates.length - 20} more`);
            return;
        }
        const message = 'No matching module found.';
        if (opts.json) {
            console.log(JSON.stringify({
                error: { code: 'NO_MATCH', message },
                source: { targetDir },
                input: { module: (_d = opts.module) !== null && _d !== void 0 ? _d : null, file: (_e = opts.file) !== null && _e !== void 0 ? _e : null, resolvedFile: fileAbs },
            }, null, 2));
            return;
        }
        console.log(message);
        if (fileAbs)
            console.log(`file: ${fileAbs}`);
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
            module: (_f = opts.module) !== null && _f !== void 0 ? _f : null,
            file: (_g = opts.file) !== null && _g !== void 0 ? _g : null,
            resolvedFile: fileAbs,
            depth: opts.depth,
            trendPoints: opts.trendPoints,
        },
        module: {
            name: module.name,
            chineseName: module.chineseName,
            category: module.category,
            type: module.type,
            routePath: (_h = module.routePath) !== null && _h !== void 0 ? _h : null,
            path: module.path,
            pathRelative: moduleRelPath,
            stats: module.stats,
            healthScore: module.healthScore,
        },
        graph: {
            upstream,
            downstream,
            inDegree: (_k = (_j = graph.in.get(module.name)) === null || _j === void 0 ? void 0 : _j.size) !== null && _k !== void 0 ? _k : 0,
            outDegree: (_m = (_l = graph.out.get(module.name)) === null || _l === void 0 ? void 0 : _l.size) !== null && _m !== void 0 ? _m : 0,
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
    const inDegree = (_p = (_o = graph.in.get(module.name)) === null || _o === void 0 ? void 0 : _o.size) !== null && _p !== void 0 ? _p : 0;
    const outDegree = (_r = (_q = graph.out.get(module.name)) === null || _q === void 0 ? void 0 : _q.size) !== null && _r !== void 0 ? _r : 0;
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
function hotspotsReport(targetDir, opts) {
    const modulesLatest = readReport(targetDir, 'modules/latest.json');
    const archLatest = readReport(targetDir, 'architecture/latest.json');
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
        var _a, _b, _c, _d, _e;
        const inDegree = (_b = (_a = graph.in.get(m.name)) === null || _a === void 0 ? void 0 : _a.size) !== null && _b !== void 0 ? _b : 0;
        const outDegree = (_d = (_c = graph.out.get(m.name)) === null || _c === void 0 ? void 0 : _c.size) !== null && _d !== void 0 ? _d : 0;
        const vSummary = summarizeViolationsForPath(targetDir, archLatest, m.path, 0);
        return {
            name: m.name,
            chineseName: m.chineseName,
            routePath: (_e = m.routePath) !== null && _e !== void 0 ? _e : null,
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
    const printList = (title, items) => {
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
function showHelp() {
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
  node report-manager.js cleanup
  node report-manager.js export
  node report-manager.js diff
  node report-manager.js diff --from 2025-01-15
  node report-manager.js trend --days 14
  node report-manager.js history
  node report-manager.js inspect --module "src/features/user"
  node report-manager.js inspect --file "src/features/user/index.ts"
  node report-manager.js hotspots --top 15
`);
}
function main() {
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
// CLI 入口 - 仅当作为主模块运行时才执行
if (require.main === module) {
    main();
}
