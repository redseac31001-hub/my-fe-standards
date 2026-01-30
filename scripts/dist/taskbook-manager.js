"use strict";
/**
 * TaskBook 管理器
 *
 * 负责 TaskBook 的创建、读取、更新、归档等操作
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
exports.taskBookManager = exports.TaskBookManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// TaskBook 存储目录
const TASKBOOK_BASE_DIR = '.codebuddy/taskbooks';
const ACTIVE_DIR = 'active';
const HISTORY_DIR = 'history';
const CONTEXT_SNAPSHOTS_DIR = '.codebuddy/context-snapshots';
/**
 * 生成 TaskBook ID
 */
function generateTaskBookId(title) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 20);
    return `tb-${date}-${slug}`;
}
/**
 * 获取当前时间戳 (ISO 8601)
 */
function now() {
    return new Date().toISOString();
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
 * TaskBook 管理器类
 */
class TaskBookManager {
    constructor(projectRoot = process.cwd()) {
        this.baseDir = projectRoot;
    }
    /**
     * 获取活跃任务书目录
     */
    getActiveDir() {
        return path.join(this.baseDir, TASKBOOK_BASE_DIR, ACTIVE_DIR);
    }
    /**
     * 获取历史任务书目录
     */
    getHistoryDir() {
        return path.join(this.baseDir, TASKBOOK_BASE_DIR, HISTORY_DIR);
    }
    /**
     * 获取上下文快照目录
     */
    getContextSnapshotsDir() {
        return path.join(this.baseDir, CONTEXT_SNAPSHOTS_DIR);
    }
    /**
     * 创建新的 TaskBook
     */
    create(params) {
        const id = generateTaskBookId(params.title);
        const taskBook = {
            id,
            title: params.title,
            description: params.description,
            taskType: params.taskType,
            createdAt: now(),
            status: 'draft',
            context: {
                relatedFiles: [],
                dependencies: [],
            },
            tasks: [],
            changelog: [],
        };
        this.save(taskBook);
        return taskBook;
    }
    /**
     * 保存 TaskBook
     */
    save(taskBook) {
        const dir = taskBook.status === 'completed' || taskBook.status === 'aborted'
            ? this.getHistoryDir()
            : this.getActiveDir();
        ensureDir(dir);
        const filePath = path.join(dir, `${taskBook.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(taskBook, null, 2), 'utf-8');
    }
    /**
     * 读取 TaskBook
     */
    load(id) {
        // 先尝试从活跃目录读取
        let filePath = path.join(this.getActiveDir(), `${id}.json`);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
        // 再尝试从历史目录读取
        filePath = path.join(this.getHistoryDir(), `${id}.json`);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
        return null;
    }
    /**
     * 列出所有活跃的 TaskBook
     */
    listActive() {
        const dir = this.getActiveDir();
        if (!fs.existsSync(dir)) {
            return [];
        }
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        return files.map(f => {
            const content = fs.readFileSync(path.join(dir, f), 'utf-8');
            return JSON.parse(content);
        });
    }
    /**
     * 更新 TaskBook 状态
     */
    updateStatus(id, status) {
        const taskBook = this.load(id);
        if (!taskBook)
            return null;
        const oldStatus = taskBook.status;
        taskBook.status = status;
        // 记录状态变更
        if (status === 'confirmed') {
            taskBook.confirmedAt = now();
        }
        else if (status === 'completed' || status === 'aborted') {
            taskBook.completedAt = now();
        }
        // 添加变更日志
        this.addChangelogEntry(taskBook, {
            timestamp: now(),
            taskId: null,
            changeType: 'modified',
            reason: `状态变更: ${oldStatus} → ${status}`,
            before: { status: oldStatus },
            after: { status },
        });
        // 如果完成或中止，需要移动到历史目录
        if (status === 'completed' || status === 'aborted') {
            // 删除活跃目录中的文件
            const activeFilePath = path.join(this.getActiveDir(), `${id}.json`);
            if (fs.existsSync(activeFilePath)) {
                fs.unlinkSync(activeFilePath);
            }
        }
        this.save(taskBook);
        return taskBook;
    }
    /**
     * 添加任务
     */
    addTask(id, task) {
        const taskBook = this.load(id);
        if (!taskBook)
            return null;
        const taskId = `task-${taskBook.tasks.length + 1}`;
        const newTask = {
            ...task,
            id: taskId,
        };
        taskBook.tasks.push(newTask);
        this.addChangelogEntry(taskBook, {
            timestamp: now(),
            taskId,
            changeType: 'added',
            reason: `添加任务: ${task.title}`,
            after: newTask,
        });
        this.save(taskBook);
        return taskBook;
    }
    /**
     * 更新任务状态
     */
    updateTaskStatus(taskBookId, taskId, status, actualWork, blockedReason) {
        const taskBook = this.load(taskBookId);
        if (!taskBook)
            return null;
        const task = taskBook.tasks.find(t => t.id === taskId);
        if (!task)
            return null;
        const oldStatus = task.status;
        task.status = status;
        if (status === 'in_progress') {
            task.startedAt = now();
        }
        else if (status === 'done') {
            task.completedAt = now();
            if (actualWork) {
                task.actualWork = actualWork;
            }
        }
        else if (status === 'blocked' && blockedReason) {
            task.blockedReason = blockedReason;
        }
        if (oldStatus !== status) {
            this.addChangelogEntry(taskBook, {
                timestamp: now(),
                taskId,
                changeType: 'modified',
                reason: `任务状态变更: ${oldStatus} → ${status}`,
                before: { status: oldStatus },
                after: { status, actualWork, blockedReason },
            });
        }
        this.save(taskBook);
        return taskBook;
    }
    /**
     * 添加变更日志
     */
    addChangelogEntry(taskBook, entry) {
        taskBook.changelog.push(entry);
    }
    /**
     * 记录变更
     */
    logChange(taskBookId, taskId, changeType, reason, before, after) {
        const taskBook = this.load(taskBookId);
        if (!taskBook)
            return null;
        this.addChangelogEntry(taskBook, {
            timestamp: now(),
            taskId,
            changeType,
            reason,
            before,
            after,
        });
        this.save(taskBook);
        return taskBook;
    }
    /**
     * 生成验收报告
     */
    generateAcceptanceReport(taskBookId) {
        const taskBook = this.load(taskBookId);
        if (!taskBook)
            return null;
        const doneTasks = taskBook.tasks.filter(t => t.status === 'done').length;
        const skippedTasks = taskBook.tasks.filter(t => t.status === 'skipped').length;
        const blockedTasks = taskBook.tasks.filter(t => t.status === 'blocked').length;
        const totalTasks = taskBook.tasks.length;
        // 计算耗时
        const createdAt = new Date(taskBook.createdAt);
        const completedAt = taskBook.completedAt ? new Date(taskBook.completedAt) : new Date();
        const durationMs = completedAt.getTime() - createdAt.getTime();
        const durationMinutes = Math.round(durationMs / 60000);
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        const duration = hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
        const report = {
            taskBookId: taskBook.id,
            title: taskBook.title,
            createdAt: taskBook.createdAt,
            completedAt: taskBook.completedAt || now(),
            duration,
            summary: {
                totalTasks,
                doneTasks,
                skippedTasks,
                blockedTasks,
                completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
                changelogCount: taskBook.changelog.length,
            },
            recommendations: {
                mustDo: [],
                suggested: [],
                technicalDebt: [],
            },
        };
        // 添加建议
        if (blockedTasks > 0) {
            report.recommendations.mustDo.push(`解决 ${blockedTasks} 个阻塞的任务`);
        }
        if (skippedTasks > 0) {
            report.recommendations.suggested.push(`评估 ${skippedTasks} 个跳过的任务是否需要后续处理`);
        }
        return report;
    }
    /**
     * 获取可并行执行的任务
     */
    getParallelizableTasks(taskBookId) {
        const taskBook = this.load(taskBookId);
        if (!taskBook)
            return [];
        const completedTaskIds = new Set(taskBook.tasks.filter(t => t.status === 'done').map(t => t.id));
        return taskBook.tasks.filter(task => {
            // 只考虑 pending 状态的任务
            if (task.status !== 'pending')
                return false;
            // 检查所有依赖是否已完成
            return task.dependencies.every(depId => completedTaskIds.has(depId));
        });
    }
    /**
     * 格式化 TaskBook 为用户可读的计划展示
     */
    formatForDisplay(taskBook) {
        const typeEmoji = {
            analysis: '🔍',
            design: '📐',
            test: '🧪',
            implement: '💻',
            review: '👀',
        };
        const typeLabel = {
            analysis: '分析',
            design: '设计',
            test: '测试',
            implement: '实现',
            review: '审查',
        };
        const lines = [
            '╔══════════════════════════════════════════════════════════════╗',
            `║ 📋 任务计划书 - ${taskBook.title.padEnd(40)}║`,
            '╠══════════════════════════════════════════════════════════════╣',
            `║ 📝 需求概述: ${taskBook.description.slice(0, 44).padEnd(44)}║`,
            `║ 📁 影响范围: ${taskBook.context.relatedFiles.slice(0, 2).join(', ').slice(0, 44).padEnd(44)}║`,
            `║ 📊 任务总数: ${String(taskBook.tasks.length).padEnd(44)} 个║`,
            '╠══════════════════════════════════════════════════════════════╣',
            '║ 任务清单:                                                     ║',
        ];
        taskBook.tasks.forEach((task, index) => {
            const emoji = typeEmoji[task.type];
            const label = typeLabel[task.type];
            const taskLine = `${index + 1}. [${label}] ${task.title}`;
            lines.push(`║  ${emoji} ${taskLine.slice(0, 54).padEnd(54)}║`);
        });
        lines.push('╠══════════════════════════════════════════════════════════════╣');
        lines.push('║ ❓ 请确认是否开始执行？                                        ║');
        lines.push('║ [✅ 确认执行] [✏️ 修改计划] [❌ 取消]                          ║');
        lines.push('╚══════════════════════════════════════════════════════════════╝');
        return lines.join('\n');
    }
}
exports.TaskBookManager = TaskBookManager;
// 导出单例
exports.taskBookManager = new TaskBookManager();
