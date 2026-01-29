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
    return writeReport(targetDir, 'modules/latest.json', snapshot, 'module-mapper');
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
// ============ CLI ============
function showHelp() {
    console.log(`
Report Manager - 报告管理器

用法: node report-manager.js <command> [options]

命令:
  status              查看报告状态
  cleanup             清理过期报告
    --cache-only      仅清理缓存
    --force           强制清理所有历史
  export              导出报告
    --format <type>   输出格式: markdown (默认)
  diff                对比快照
    --from <date>     起始日期 (YYYY-MM-DD)
    --to <date>       结束日期 (YYYY-MM-DD)

示例:
  node report-manager.js status
  node report-manager.js cleanup
  node report-manager.js export --format markdown
`);
}
function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const targetDir = process.cwd();
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
        case 'diff':
            console.log('Diff feature coming in Phase 3');
            break;
        default:
            console.error(`Unknown command: ${command}`);
            showHelp();
            process.exit(1);
    }
}
// CLI 入口
main();
