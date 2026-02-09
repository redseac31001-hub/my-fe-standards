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
const LOCKS_DIR = '.codebuddy/taskbooks/.locks';
const AGENT_CALLS_DIR = '.codebuddy/agent-calls';
const LOCK_STALE_MS = 2 * 60 * 1000;
const LOCK_TIMEOUT_MS = 10 * 1000;
const LOCK_RETRY_MS = 80;
const SLEEP_INT32 = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
    Atomics.wait(SLEEP_INT32, 0, 0, ms);
}
class TaskBookConflictError extends Error {
    constructor(taskBookId, expectedRevision, actualRevision) {
        super(`TaskBook revision conflict: ${taskBookId} (expected ${expectedRevision}, actual ${actualRevision})`);
        this.name = 'TaskBookConflictError';
        this.taskBookId = taskBookId;
        this.expectedRevision = expectedRevision;
        this.actualRevision = actualRevision;
    }
}
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
    getLocksDir() {
        return path.join(this.baseDir, LOCKS_DIR);
    }
    getLockPath(taskBookId) {
        return path.join(this.getLocksDir(), `${taskBookId}.lock`);
    }
    normalize(taskBook) {
        if (typeof taskBook.revision !== 'number') {
            taskBook.revision = 0;
        }
        if (!taskBook.updatedAt) {
            taskBook.updatedAt = taskBook.createdAt;
        }
        return taskBook;
    }
    touch(taskBook) {
        if (typeof taskBook.revision !== 'number') {
            taskBook.revision = 0;
        }
        taskBook.revision += 1;
        taskBook.updatedAt = now();
    }
    assertRevision(taskBook, expectedRevision) {
        if (typeof expectedRevision !== 'number')
            return;
        const actual = typeof taskBook.revision === 'number' ? taskBook.revision : 0;
        if (actual !== expectedRevision) {
            throw new TaskBookConflictError(taskBook.id, expectedRevision, actual);
        }
    }
    withTaskBookLock(taskBookId, fn, opts) {
        var _a;
        const lockPath = this.getLockPath(taskBookId);
        ensureDir(path.dirname(lockPath));
        const startedAt = Date.now();
        const timeoutMs = (_a = opts === null || opts === void 0 ? void 0 : opts.timeoutMs) !== null && _a !== void 0 ? _a : LOCK_TIMEOUT_MS;
        while (true) {
            try {
                const fd = fs.openSync(lockPath, 'wx');
                try {
                    const payload = { pid: process.pid, createdAt: now(), taskBookId };
                    fs.writeFileSync(fd, JSON.stringify(payload, null, 2), 'utf-8');
                }
                catch (_b) {
                    // ignore
                }
                try {
                    return fn();
                }
                finally {
                    try {
                        fs.closeSync(fd);
                    }
                    catch (_c) {
                        // ignore
                    }
                    try {
                        fs.unlinkSync(lockPath);
                    }
                    catch (_d) {
                        // ignore
                    }
                }
            }
            catch (error) {
                const err = error;
                if ((err === null || err === void 0 ? void 0 : err.code) !== 'EEXIST') {
                    throw error;
                }
                // lock exists: check staleness
                try {
                    const stat = fs.statSync(lockPath);
                    const ageMs = Date.now() - stat.mtimeMs;
                    if (ageMs > LOCK_STALE_MS) {
                        try {
                            fs.unlinkSync(lockPath);
                            continue;
                        }
                        catch (_e) {
                            // ignore
                        }
                    }
                }
                catch (_f) {
                    // ignore
                }
                if (Date.now() - startedAt > timeoutMs) {
                    let lockInfo = '';
                    try {
                        lockInfo = fs.readFileSync(lockPath, 'utf-8').slice(0, 2000);
                    }
                    catch (_g) {
                        // ignore
                    }
                    const details = lockInfo ? `\nlock info:\n${lockInfo}` : '';
                    throw new Error(`TaskBook is locked: ${taskBookId} (waited ${timeoutMs}ms)${details}`);
                }
                sleepSync(LOCK_RETRY_MS);
            }
        }
    }
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
        return this.withTaskBookLock(id, () => {
            this.touch(taskBook);
            this.save(taskBook);
            return taskBook;
        });
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
            const parsed = JSON.parse(content);
            return this.normalize(parsed);
        }
        // 再尝试从历史目录读取
        filePath = path.join(this.getHistoryDir(), `${id}.json`);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            return this.normalize(parsed);
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
            const parsed = JSON.parse(content);
            return this.normalize(parsed);
        });
    }
    /**
     * 更新 TaskBook 状态
     */
    updateStatus(id, status, expectedRevision) {
        return this.withTaskBookLock(id, () => {
            const taskBook = this.load(id);
            if (!taskBook)
                return null;
            this.assertRevision(taskBook, expectedRevision);
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
            this.touch(taskBook);
            this.save(taskBook);
            return taskBook;
        });
    }
    /**
     * 添加任务
     */
    addTask(id, task, expectedRevision) {
        return this.withTaskBookLock(id, () => {
            var _a, _b, _c, _d;
            const taskBook = this.load(id);
            if (!taskBook)
                return null;
            this.assertRevision(taskBook, expectedRevision);
            const taskId = `task-${taskBook.tasks.length + 1}`;
            const newTask = {
                id: taskId,
                parentId: task.parentId,
                title: task.title,
                type: task.type,
                status: (_a = task.status) !== null && _a !== void 0 ? _a : 'pending',
                priority: (_b = task.priority) !== null && _b !== void 0 ? _b : 'medium',
                dependencies: (_c = task.dependencies) !== null && _c !== void 0 ? _c : [],
                acceptanceCriteria: (_d = task.acceptanceCriteria) !== null && _d !== void 0 ? _d : [],
                scope: task.scope,
                actualWork: task.actualWork,
                blockedReason: task.blockedReason,
                executedBy: task.executedBy,
                startedAt: task.startedAt,
                completedAt: task.completedAt,
            };
            taskBook.tasks.push(newTask);
            this.addChangelogEntry(taskBook, {
                timestamp: now(),
                taskId,
                changeType: 'added',
                reason: `添加任务: ${task.title}`,
                after: newTask,
            });
            this.touch(taskBook);
            this.save(taskBook);
            return taskBook;
        });
    }
    /**
     * 批量添加任务（单次 touch/save，适合 planner apply-plan 等批处理场景）
     */
    addTasksBatch(taskBookId, tasks, opts) {
        return this.withTaskBookLock(taskBookId, () => {
            var _a, _b, _c, _d;
            const taskBook = this.load(taskBookId);
            if (!taskBook)
                return null;
            this.assertRevision(taskBook, opts === null || opts === void 0 ? void 0 : opts.expectedRevision);
            const taskIds = [];
            const reasonPrefix = opts === null || opts === void 0 ? void 0 : opts.reasonPrefix;
            for (const task of tasks) {
                const taskId = `task-${taskBook.tasks.length + 1}`;
                const newTask = {
                    id: taskId,
                    parentId: task.parentId,
                    title: task.title,
                    type: task.type,
                    status: (_a = task.status) !== null && _a !== void 0 ? _a : 'pending',
                    priority: (_b = task.priority) !== null && _b !== void 0 ? _b : 'medium',
                    dependencies: (_c = task.dependencies) !== null && _c !== void 0 ? _c : [],
                    acceptanceCriteria: (_d = task.acceptanceCriteria) !== null && _d !== void 0 ? _d : [],
                    scope: task.scope,
                    actualWork: task.actualWork,
                    blockedReason: task.blockedReason,
                    executedBy: task.executedBy,
                    startedAt: task.startedAt,
                    completedAt: task.completedAt,
                };
                taskBook.tasks.push(newTask);
                taskIds.push(taskId);
                this.addChangelogEntry(taskBook, {
                    timestamp: now(),
                    taskId,
                    changeType: 'added',
                    reason: `${reasonPrefix ? `${reasonPrefix}: ` : ''}添加任务: ${task.title}`,
                    after: newTask,
                });
            }
            this.touch(taskBook);
            this.save(taskBook);
            return { taskBook, taskIds };
        });
    }
    /**
     * 应用 planner 输出（planId/dependencies 基于 planId），并一次性写入 TaskBook
     */
    applyPlannerPlan(taskBookId, requestId, planTasks, expectedRevision) {
        return this.withTaskBookLock(taskBookId, () => {
            var _a, _b, _c, _d;
            const taskBook = this.load(taskBookId);
            if (!taskBook)
                return null;
            this.assertRevision(taskBook, expectedRevision);
            if (!Array.isArray(planTasks) || planTasks.length === 0) {
                throw new Error('错误: planner planTasks 不能为空');
            }
            const planIdToIndex = new Map();
            const planIdToTaskId = {};
            const base = taskBook.tasks.length + 1;
            for (let i = 0; i < planTasks.length; i++) {
                const planId = (_a = planTasks[i]) === null || _a === void 0 ? void 0 : _a.planId;
                if (typeof planId !== 'string' || !planId) {
                    throw new Error(`错误: planTasks[${i}].planId 必须是非空字符串`);
                }
                if (planIdToIndex.has(planId)) {
                    throw new Error(`错误: planId 重复: ${planId}`);
                }
                planIdToIndex.set(planId, i);
                planIdToTaskId[planId] = `task-${base + i}`;
            }
            const taskIds = [];
            for (let i = 0; i < planTasks.length; i++) {
                const t = planTasks[i];
                const taskId = planIdToTaskId[t.planId];
                const deps = (_b = t.dependencies) !== null && _b !== void 0 ? _b : [];
                const mappedDeps = [];
                for (const dep of deps) {
                    const depIndex = planIdToIndex.get(dep);
                    if (typeof depIndex !== 'number') {
                        throw new Error(`错误: 依赖 planId 不存在: ${dep} (from ${t.planId})`);
                    }
                    if (depIndex >= i) {
                        throw new Error(`错误: dependencies 必须指向更早的 planId（${t.planId} 依赖 ${dep}）`);
                    }
                    mappedDeps.push(planIdToTaskId[dep]);
                }
                const newTask = {
                    id: taskId,
                    title: t.title,
                    type: t.type,
                    status: 'pending',
                    priority: (_c = t.priority) !== null && _c !== void 0 ? _c : 'medium',
                    dependencies: mappedDeps,
                    acceptanceCriteria: (_d = t.acceptanceCriteria) !== null && _d !== void 0 ? _d : [],
                    scope: t.scope,
                };
                taskBook.tasks.push(newTask);
                taskIds.push(taskId);
                this.addChangelogEntry(taskBook, {
                    timestamp: now(),
                    taskId,
                    changeType: 'added',
                    reason: `planner:${requestId}: 添加任务: ${t.title}`,
                    after: newTask,
                });
            }
            this.touch(taskBook);
            this.save(taskBook);
            return { taskBook, taskIds, planIdToTaskId };
        });
    }
    /**
     * 更新任务字段（不改变 id）
     */
    updateTask(taskBookId, taskId, patch, expectedRevision) {
        return this.withTaskBookLock(taskBookId, () => {
            const taskBook = this.load(taskBookId);
            if (!taskBook)
                return null;
            this.assertRevision(taskBook, expectedRevision);
            const task = taskBook.tasks.find(t => t.id === taskId);
            if (!task)
                return null;
            const before = { ...task };
            // status 统一处理 startedAt/completedAt/blockedReason/actualWork
            if (patch.status && patch.status !== task.status) {
                task.status = patch.status;
                if (patch.status === 'in_progress') {
                    task.startedAt = now();
                }
                else if (patch.status === 'done') {
                    task.completedAt = now();
                    if (patch.actualWork) {
                        task.actualWork = patch.actualWork;
                    }
                }
                else if (patch.status === 'blocked') {
                    if (patch.blockedReason) {
                        task.blockedReason = patch.blockedReason;
                    }
                }
            }
            // 其余字段直接更新（避免覆盖 undefined）
            const updatable = [
                'parentId',
                'title',
                'type',
                'priority',
                'dependencies',
                'acceptanceCriteria',
                'scope',
                'actualWork',
                'blockedReason',
                'executedBy',
                'startedAt',
                'completedAt',
            ];
            for (const key of updatable) {
                const value = patch[key];
                if (typeof value !== 'undefined') {
                    // @ts-expect-error - dynamic update
                    task[key] = value;
                }
            }
            this.addChangelogEntry(taskBook, {
                timestamp: now(),
                taskId,
                changeType: 'modified',
                reason: '更新任务字段',
                before: before,
                after: task,
            });
            this.touch(taskBook);
            this.save(taskBook);
            return taskBook;
        });
    }
    /**
     * 解除 blocked 任务，恢复为 pending，并记录 resolution
     */
    unblockTask(taskBookId, taskId, resolution, expectedRevision) {
        return this.withTaskBookLock(taskBookId, () => {
            const taskBook = this.load(taskBookId);
            if (!taskBook)
                return null;
            this.assertRevision(taskBook, expectedRevision);
            const task = taskBook.tasks.find(t => t.id === taskId);
            if (!task)
                return null;
            if (task.status !== 'blocked')
                return taskBook;
            const before = { status: task.status, blockedReason: task.blockedReason };
            task.status = 'pending';
            task.blockedReason = '';
            this.addChangelogEntry(taskBook, {
                timestamp: now(),
                taskId,
                changeType: 'modified',
                reason: `解除阻塞: ${resolution}`,
                before,
                after: { status: task.status, blockedReason: task.blockedReason },
            });
            this.touch(taskBook);
            this.save(taskBook);
            return taskBook;
        });
    }
    /**
     * 追加任务实际工作说明
     */
    appendTaskActualWork(taskBookId, taskId, text, expectedRevision) {
        return this.withTaskBookLock(taskBookId, () => {
            var _a;
            const taskBook = this.load(taskBookId);
            if (!taskBook)
                return null;
            this.assertRevision(taskBook, expectedRevision);
            const task = taskBook.tasks.find(t => t.id === taskId);
            if (!task)
                return null;
            const before = (_a = task.actualWork) !== null && _a !== void 0 ? _a : '';
            const next = before ? `${before}\n${text}` : text;
            task.actualWork = next;
            this.addChangelogEntry(taskBook, {
                timestamp: now(),
                taskId,
                changeType: 'modified',
                reason: '追加 actualWork',
                before: { actualWork: before },
                after: { actualWork: next },
            });
            this.touch(taskBook);
            this.save(taskBook);
            return taskBook;
        });
    }
    /**
     * 更新任务状态
     */
    updateTaskStatus(taskBookId, taskId, status, actualWork, blockedReason, expectedRevision) {
        return this.withTaskBookLock(taskBookId, () => {
            const taskBook = this.load(taskBookId);
            if (!taskBook)
                return null;
            this.assertRevision(taskBook, expectedRevision);
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
            this.touch(taskBook);
            this.save(taskBook);
            return taskBook;
        });
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
    logChange(taskBookId, taskId, changeType, reason, before, after, expectedRevision) {
        return this.withTaskBookLock(taskBookId, () => {
            const taskBook = this.load(taskBookId);
            if (!taskBook)
                return null;
            this.assertRevision(taskBook, expectedRevision);
            this.addChangelogEntry(taskBook, {
                timestamp: now(),
                taskId,
                changeType,
                reason,
                before,
                after,
            });
            this.touch(taskBook);
            this.save(taskBook);
            return taskBook;
        });
    }
    /**
     * 生成验收报告
     */
    generateAcceptanceReport(taskBookId) {
        var _a, _b;
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
        // 汇总 gates 执行信息（从 changelog 里提取 event=gate 的记录）
        const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
        const gateEvents = [];
        for (const entry of taskBook.changelog) {
            const after = entry.after;
            if (!isPlainObject(after))
                continue;
            if (after.event !== 'gate')
                continue;
            const gateId = after.gateId;
            if (typeof gateId !== 'string' || gateId.length === 0)
                continue;
            const passed = after.passed === true;
            const skipped = after.skipped === true;
            const skipReason = typeof after.skipReason === 'string' ? after.skipReason : undefined;
            const approved = after.approved === true;
            const evidencePath = typeof after.evidencePath === 'string' ? after.evidencePath : undefined;
            const stepId = typeof after.stepId === 'string' ? after.stepId : undefined;
            const eventContext = typeof after.eventContext === 'string' ? after.eventContext : undefined;
            const batchIndex = typeof after.batchIndex === 'number' && Number.isFinite(after.batchIndex) ? after.batchIndex : undefined;
            const riskTier = typeof after.riskTier === 'string' ? after.riskTier : undefined;
            const budgetMinutes = typeof after.budgetMinutes === 'number' && Number.isFinite(after.budgetMinutes) ? after.budgetMinutes : undefined;
            let commandRuns;
            const rawRuns = after.commandRuns;
            if (Array.isArray(rawRuns)) {
                const parsedRuns = [];
                for (const r of rawRuns) {
                    if (!isPlainObject(r))
                        continue;
                    if (typeof r.command !== 'string')
                        continue;
                    if (typeof r.ok !== 'boolean')
                        continue;
                    const code = (typeof r.code === 'number' || r.code === null) ? r.code : null;
                    const durationMs = typeof r.durationMs === 'number' && Number.isFinite(r.durationMs) ? r.durationMs : 0;
                    parsedRuns.push({ command: r.command, ok: r.ok, code, durationMs });
                }
                if (parsedRuns.length > 0)
                    commandRuns = parsedRuns;
            }
            const totalDurationMs = commandRuns ? commandRuns.reduce((sum, r) => { var _a; return sum + ((_a = r.durationMs) !== null && _a !== void 0 ? _a : 0); }, 0) : undefined;
            let missingScripts;
            const rawMissing = after.missingScripts;
            if (Array.isArray(rawMissing)) {
                const parsedMissing = rawMissing.filter((v) => typeof v === 'string' && v.length > 0);
                if (parsedMissing.length > 0)
                    missingScripts = parsedMissing;
            }
            gateEvents.push({
                gateId,
                stepId,
                timestamp: entry.timestamp,
                passed,
                skipped,
                skipReason,
                approved,
                evidencePath,
                eventContext,
                batchIndex,
                riskTier,
                budgetMinutes,
                totalDurationMs,
                commandRuns,
                missingScripts,
            });
        }
        if (gateEvents.length > 0) {
            report.gates = gateEvents;
            for (const g of report.gates) {
                if (typeof g.budgetMinutes === 'number' && typeof g.totalDurationMs === 'number') {
                    const budgetMs = g.budgetMinutes * 60000;
                    if (g.totalDurationMs > budgetMs) {
                        report.recommendations.suggested.push(`gate ${g.gateId} 耗时 ${(g.totalDurationMs / 1000).toFixed(1)}s，超过 budget ${g.budgetMinutes}min；建议调整 smoke/full 命令或缩小单批改动范围`);
                    }
                }
            }
        }
        // 汇总 batches（从 changelog 里提取 event=batch 的记录）
        const batchMap = new Map();
        for (const entry of taskBook.changelog) {
            const after = entry.after;
            if (!isPlainObject(after))
                continue;
            if (after.event !== 'batch')
                continue;
            const stepId = after.stepId;
            const batchIndex = after.batchIndex;
            if (typeof stepId !== 'string' || stepId.length === 0)
                continue;
            if (typeof batchIndex !== 'number' || !Number.isFinite(batchIndex))
                continue;
            const key = `${stepId}#${batchIndex}`;
            const existing = (_a = batchMap.get(key)) !== null && _a !== void 0 ? _a : {
                stepId,
                batchIndex,
                taskIds: [],
            };
            const rawTaskIds = after.taskIds;
            if (Array.isArray(rawTaskIds)) {
                const parsedTaskIds = rawTaskIds.filter((v) => typeof v === 'string' && v.length > 0);
                if (parsedTaskIds.length > 0)
                    existing.taskIds = parsedTaskIds;
            }
            if (typeof after.riskTier === 'string')
                existing.riskTier = after.riskTier;
            if (typeof after.maxFiles === 'number' && Number.isFinite(after.maxFiles))
                existing.maxFiles = after.maxFiles;
            if (typeof after.status === 'string' && after.status.length > 0) {
                existing.status = after.status;
                existing.endedAt = entry.timestamp;
            }
            else {
                existing.startedAt = entry.timestamp;
            }
            batchMap.set(key, existing);
        }
        if (batchMap.size > 0) {
            const batches = Array.from(batchMap.values()).sort((a, b) => {
                const s = a.stepId.localeCompare(b.stepId);
                if (s !== 0)
                    return s;
                return a.batchIndex - b.batchIndex;
            });
            // attach smoke gate status if available (batched implement flow)
            const gateList = (_b = report.gates) !== null && _b !== void 0 ? _b : [];
            for (const b of batches) {
                const match = [...gateList].reverse().find(g => g.gateId === 'smoke_passed'
                    && g.stepId === b.stepId
                    && g.eventContext === 'batch_gate'
                    && typeof g.batchIndex === 'number'
                    && g.batchIndex === b.batchIndex);
                if (match) {
                    b.smokeGate = {
                        passed: match.passed,
                        budgetMinutes: match.budgetMinutes,
                        totalDurationMs: match.totalDurationMs,
                    };
                }
            }
            report.batches = batches;
        }
        // 汇总 agent-calls（从 changelog 里提取 event=agent-call 的记录）
        const agentCallEvents = [];
        const lastActionByRequestId = new Map();
        for (const entry of taskBook.changelog) {
            const after = entry.after;
            if (!isPlainObject(after))
                continue;
            if (after.event !== 'agent-call')
                continue;
            const requestId = after.requestId;
            if (typeof requestId !== 'string' || requestId.length === 0)
                continue;
            const action = after.action === 'created' || after.action === 'applied' ? after.action : undefined;
            if (action)
                lastActionByRequestId.set(requestId, action);
            const agentId = typeof after.agentId === 'string' ? after.agentId : undefined;
            const kindRaw = after.kind;
            const kind = kindRaw === 'planner' || kindRaw === 'manual-task' ? kindRaw : undefined;
            const statusRaw = after.status;
            const status = statusRaw === 'success' || statusRaw === 'failed' || statusRaw === 'blocked'
                ? statusRaw
                : undefined;
            const createdAt = typeof after.createdAt === 'string' ? after.createdAt : undefined;
            const completedAt = typeof after.completedAt === 'string' ? after.completedAt : undefined;
            const promptPath = typeof after.promptPath === 'string' ? after.promptPath : undefined;
            const resultPath = typeof after.resultPath === 'string' ? after.resultPath : undefined;
            let artifacts;
            const rawArtifacts = after.artifacts;
            if (Array.isArray(rawArtifacts)) {
                const parsed = [];
                for (const a of rawArtifacts) {
                    if (!isPlainObject(a))
                        continue;
                    const type = typeof a.type === 'string' ? a.type : '';
                    const p = typeof a.path === 'string' ? a.path : '';
                    if (!type || !p)
                        continue;
                    const description = typeof a.description === 'string' ? a.description : undefined;
                    parsed.push({ type, path: p, description });
                }
                if (parsed.length > 0)
                    artifacts = parsed;
            }
            agentCallEvents.push({
                requestId,
                action,
                timestamp: entry.timestamp,
                taskId: entry.taskId,
                agentId,
                kind,
                status,
                createdAt,
                completedAt,
                promptPath,
                resultPath,
                artifacts,
            });
        }
        if (agentCallEvents.length > 0) {
            report.agentCalls = agentCallEvents;
            const pending = Array.from(lastActionByRequestId.values()).filter(a => a === 'created').length;
            if (pending > 0) {
                report.recommendations.mustDo.push(`补齐 ${pending} 个 agent-call 的 result.json 回填（.codebuddy/agent-calls/*.result.json），以恢复闭环执行`);
            }
        }
        // Scope 纪律建议：缺少 scope 会导致 batching / 并发冲突检测退化
        const missingScope = taskBook.tasks.filter(t => {
            var _a, _b, _c, _d;
            if (t.status !== 'pending')
                return false;
            if (t.type !== 'analysis' && t.type !== 'design' && t.type !== 'implement')
                return false;
            const files = (_b = (_a = t.scope) === null || _a === void 0 ? void 0 : _a.files) !== null && _b !== void 0 ? _b : [];
            const modules = (_d = (_c = t.scope) === null || _c === void 0 ? void 0 : _c.modules) !== null && _d !== void 0 ? _d : [];
            return files.length === 0 && modules.length === 0;
        });
        if (missingScope.length > 0) {
            report.recommendations.suggested.push(`发现 ${missingScope.length} 个 pending 的实现相关任务缺少 scope.files/modules；批量预算与并行冲突检测将退化为串行。建议在规划阶段为任务补齐 scope。`);
        }
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
        const completedTaskIds = new Set(taskBook.tasks
            .filter(t => t.status === 'done' || t.status === 'skipped')
            .map(t => t.id));
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
            requirement: '📋',
            prd: '📄',
            analysis: '🔍',
            design: '📐',
            test: '🧪',
            implement: '💻',
            refactor: '♻️',
            review: '👀',
            'build-fix': '🔧',
            acceptance: '✅',
        };
        const typeLabel = {
            requirement: '需求',
            prd: 'PRD',
            analysis: '分析',
            design: '设计',
            test: '测试',
            implement: '实现',
            refactor: '重构',
            review: '审查',
            'build-fix': '构建修复',
            acceptance: '验收',
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
            const taskLine = `${index + 1}. ${task.id} [${label}] [${task.status}] ${task.title}`;
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
const REQUIRE_IF_REV_ENV = 'CODEBUDDY_TASKBOOK_REQUIRE_IF_REV';
const MUTATING_COMMANDS_REQUIRING_IF_REV = new Set([
    'confirm',
    'complete',
    'abort',
    'add-task',
    'update-task',
    'unblock',
    'claim',
    'append-work',
    'apply-plan',
]);
function isTruthyEnv(name) {
    const raw = process.env[name];
    if (!raw)
        return false;
    switch (raw.trim().toLowerCase()) {
        case '1':
        case 'true':
        case 'yes':
        case 'y':
        case 'on':
            return true;
        default:
            return false;
    }
}
function showHelp() {
    console.log(`
TaskBook Manager - TaskBook 任务事实源管理工具

用法:
  node .codebuddy/scripts/taskbook-manager.js <command> [args] [options]

common options:
  --json                       输出 JSON
  --if-rev <number>            可选：写入前检查 TaskBook.revision（避免多 Agent 覆盖）
  --require-if-rev             可选：强制写操作必须提供 --if-rev（或设置 env ${REQUIRE_IF_REV_ENV}=1）

命令:
  create                      创建 TaskBook
  list                        列出 active TaskBooks
  show <taskBookId>            查看 TaskBook（默认格式化输出）
  report <taskBookId>          生成验收/批量/闸门报告（可选落盘）
  plan <taskBookId>            生成 planner Agent prompt（写入 .codebuddy/agent-calls/）
  apply-plan <taskBookId> <requestId>  从 result.json 追加任务到 TaskBook
  confirm <taskBookId>         将 TaskBook 状态设为 confirmed
  complete <taskBookId>        将 TaskBook 状态设为 completed（会归档到 history）
  abort <taskBookId>           将 TaskBook 状态设为 aborted（会归档到 history）
  add-task <taskBookId>        添加任务
  update-task <taskBookId> <taskId>   更新任务（status/priority/deps/actualWork/blockedReason/...）
  unblock <taskBookId> <taskId>       解除 blocked 任务并恢复为 pending
  claim <taskBookId> <taskId>  认领任务（设置 executedBy）
  append-work <taskBookId> <taskId>   追加 actualWork 文本

create options:
  --title <text>               标题（必填）
  --description <text>         描述（必填）
  --type <new-feature|refactoring|debugging|testing|code-review>  TaskBook 类型（必填）
  --json                       输出 JSON

add-task options:
  --files <p1,p2>              （可选）任务涉及文件列表（逗号分隔）
  --modules <m1,m2>            （可选）任务涉及模块列表（逗号分隔）
  --tags <t1,t2>               （可选）任务标签（逗号分隔）
  --title <text>               标题（必填）
  --type <analysis|design|test|implement|review>   任务类型（必填）
  --priority <critical|high|medium|low>            优先级（默认 medium）
  --deps <id1,id2>             依赖任务 ID（逗号分隔）
  --ac <text>                  验收标准（可重复）
  --json                       输出 JSON

update-task options:
  --files <p1,p2>              （可选）任务涉及文件列表（逗号分隔）
  --modules <m1,m2>            （可选）任务涉及模块列表（逗号分隔）
  --tags <t1,t2>               （可选）任务标签（逗号分隔）
  --status <pending|in_progress|done|blocked|skipped>
  --priority <critical|high|medium|low>
  --deps <id1,id2>
  --ac <text>                  验收标准（可重复；会覆盖）
  --actual-work <text>
  --blocked-reason <text>
  --executed-by <name>
  --title <text>
  --json

claim options:
  --by <name>                  执行者/认领者标识（必填）
  --json

report options:
  --write                      写入到 .codebuddy/reports/taskbooks/<id>.acceptance.json（或由 --out 指定）
  --out <path>                 自定义输出路径（可选）
  --json

plan options:
  --request-id <id>            （可选）自定义 requestId（默认自动生成）
  --json

apply-plan options:
  --dry-run                    只预览，不写入 TaskBook
  --json

unblock options:
  --resolution <text>          解除阻塞说明（必填）
  --json

说明:
  - TaskBook 是唯一事实源；workflow/执行器会读取其状态推进闭环。
  - 当任务需要人工/Agent 介入时，可先将任务标记为 blocked，处理后再改为 done，并补充 actualWork。
`);
}
function parseCli(argv) {
    var _a;
    const args = argv.slice();
    const command = (_a = args.shift()) !== null && _a !== void 0 ? _a : null;
    const positionals = [];
    const flags = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith('--')) {
            positionals.push(arg);
            continue;
        }
        const eqIndex = arg.indexOf('=');
        const rawKey = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
        const key = rawKey.trim();
        let value = true;
        if (eqIndex >= 0) {
            value = arg.slice(eqIndex + 1);
        }
        else if (args[i + 1] && !args[i + 1].startsWith('--')) {
            value = args[++i];
        }
        const existing = flags[key];
        if (typeof existing === 'undefined') {
            flags[key] = value;
        }
        else if (Array.isArray(existing)) {
            existing.push(String(value));
            flags[key] = existing;
        }
        else {
            flags[key] = [String(existing), String(value)];
        }
    }
    return { command, positionals, flags };
}
function flagAsString(flags, key) {
    const v = flags[key];
    if (typeof v === 'string')
        return v;
    if (Array.isArray(v))
        return v[0];
    return undefined;
}
function flagAsBool(flags, key) {
    return flags[key] === true;
}
function flagAsStringArray(flags, key) {
    const v = flags[key];
    if (typeof v === 'string')
        return [v];
    if (Array.isArray(v))
        return v;
    return [];
}
function parseCsv(value) {
    if (!value)
        return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
}
function buildScope(files, modules, tags) {
    const scope = {};
    if (files.length > 0)
        scope.files = files;
    if (modules.length > 0)
        scope.modules = modules;
    if (tags.length > 0)
        scope.tags = tags;
    return Object.keys(scope).length > 0 ? scope : undefined;
}
function expectedRevisionFromFlags(flags) {
    var _a;
    const raw = (_a = flagAsString(flags, 'if-rev')) !== null && _a !== void 0 ? _a : flagAsString(flags, 'if-revision');
    if (typeof raw === 'undefined')
        return undefined;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
        throw new Error('错误: --if-rev 必须是非负整数');
    }
    return n;
}
function printJson(obj) {
    console.log(JSON.stringify(obj, null, 2));
}
function generateRequestId() {
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const rnd = Math.random().toString(36).slice(2, 8);
    return `req-${ts}-${rnd}`;
}
function readTextFileIfExists(filePath) {
    if (!fs.existsSync(filePath))
        return null;
    return fs.readFileSync(filePath, 'utf-8');
}
function loadPlannerAgentDefinition(projectRoot) {
    const candidates = [
        path.join(projectRoot, '.codebuddy', 'agents', 'planner', 'AGENT.md'),
        path.join(projectRoot, 'agents', 'planner', 'AGENT.md'),
    ];
    for (const p of candidates) {
        const content = readTextFileIfExists(p);
        if (content)
            return { path: p, content };
    }
    return null;
}
function extractAgentVersion(agentMarkdown) {
    const fm = agentMarkdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    const frontmatter = fm ? fm[1] : null;
    if (frontmatter) {
        const m = frontmatter.match(/^version:\s*(.+)$/m);
        const v = m ? m[1].trim() : '';
        return v ? v : undefined;
    }
    const yaml = agentMarkdown.match(/```ya?ml\s*([\s\S]*?)\s*```/);
    if (yaml) {
        const m = yaml[1].match(/^version:\s*(.+)$/m);
        const v = m ? m[1].trim() : '';
        return v ? v : undefined;
    }
    return undefined;
}
function buildPlannerPrompt(args) {
    var _a;
    const agentVersion = args.agentDefinition ? extractAgentVersion(args.agentDefinition) : undefined;
    const header = {
        requestId: args.requestId,
        agentId: 'planner',
        agentVersion,
        taskBookId: args.taskBook.id,
        timestamp: now(),
        taskBookRevision: typeof args.taskBook.revision === 'number' ? args.taskBook.revision : 0,
        promptPath: args.promptPath,
        resultPath: args.resultPath,
    };
    const references = [
        '.codebuddy/rules/project-rules.md',
        '.codebuddy/reports/architecture/latest.json',
        '.codebuddy/reports/modules/latest.json',
    ];
    const agentDefinition = (_a = args.agentDefinition) !== null && _a !== void 0 ? _a : '(missing AGENT.md)';
    const agentDefinitionHint = args.agentDefinitionPath ? `source: ${args.agentDefinitionPath}` : 'source: (not found)';
    const schemaExample = {
        requestId: args.requestId,
        kind: 'planner',
        status: 'success',
        output: {
            tasks: [
                {
                    planId: 'T1',
                    title: '理解需求 & 梳理影响范围',
                    type: 'analysis',
                    priority: 'high',
                    acceptanceCriteria: ['输出影响范围清单', '明确非目标/约束'],
                },
                {
                    planId: 'T2',
                    title: '制定实现方案（含接口/数据结构）',
                    type: 'design',
                    dependencies: ['T1'],
                    acceptanceCriteria: ['给出方案与取舍', '明确任务拆分与关键路径'],
                },
            ],
            notes: 'tasks 必须按依赖顺序排序（dependencies 只能指向更早的 planId）。',
        },
        completedAt: now(),
    };
    return [
        '# Agent Call: planner',
        '',
        '## Header (JSON)',
        '```json',
        JSON.stringify(header, null, 2),
        '```',
        '',
        `## Agent Definition (${agentDefinitionHint})`,
        '```md',
        agentDefinition.trimEnd(),
        '```',
        '',
        '## Context: TaskBook JSON',
        '```json',
        JSON.stringify(args.taskBook, null, 2),
        '```',
        '',
        '## Context: Optional References (paths)',
        ...references.map(p => `- ${p}`),
        '',
        '## Instructions',
        '你是 planner Agent。请基于上面的 TaskBook（以及可选的 rules/reports）生成可直接写入 TaskBook 的任务列表。',
        '',
        '要求：',
        '- 输出必须可被脚本自动消费：不要输出 Markdown，不要输出解释性文本。',
        '- 只生成 task 级别的原子任务（INVEST），确保每个任务 1-3 天内可完成。',
        '- 任务类型必须是以下之一：analysis | design | test | implement | review。',
        '- dependencies 只能引用本次计划中更早的 planId（确保 tasks 已按依赖拓扑顺序排序）。',
        '- acceptanceCriteria 建议给 2-5 条可验证要点。',
        '- scope 可选：files/modules/tags（数组）。',
        '',
        `写入目标：请把结果写入 ${args.resultPath}`,
        '',
        '输出 JSON Schema（简化版）：',
        '- requestId: string（必须与 header.requestId 一致）',
        "- kind?: 'planner' | 'manual-task'（推荐，用于更强校验/诊断）",
        "- status: 'success' | 'failed' | 'blocked'",
        '- output.tasks: PlannerPlanTask[]',
        '',
        'PlannerPlanTask:',
        '- planId: string（如 T1/T2...，本次计划内唯一）',
        '- title: string',
        "- type: 'analysis' | 'design' | 'test' | 'implement' | 'review'",
        "- priority?: 'critical' | 'high' | 'medium' | 'low'",
        '- dependencies?: string[]（planId 列表）',
        '- acceptanceCriteria?: string[]',
        '- scope?: { files?: string[]; modules?: string[]; tags?: string[] }',
        '',
        '示例（必须是 JSON，不要包裹 Markdown）：',
        '```json',
        JSON.stringify(schemaExample, null, 2),
        '```',
        '',
    ].join('\n');
}
function parseAgentCallResult(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('错误: result.json 必须是 JSON object');
    }
    const obj = parsed;
    const requestId = obj.requestId;
    const status = obj.status;
    if (typeof requestId !== 'string' || !requestId) {
        throw new Error('错误: result.json 缺少 requestId');
    }
    if (status !== 'success' && status !== 'failed' && status !== 'blocked') {
        throw new Error("错误: result.json.status 必须是 'success' | 'failed' | 'blocked'");
    }
    const output = obj.output;
    const error = obj.error;
    const completedAt = obj.completedAt;
    return {
        requestId,
        status,
        output,
        error: (typeof error === 'object' && error ? error : undefined),
        completedAt: typeof completedAt === 'string' ? completedAt : undefined,
    };
}
function parsePlannerTasksFromAgentResult(result) {
    const output = result.output;
    if (!output || typeof output !== 'object') {
        throw new Error('错误: result.output 必须是 object，且包含 output.tasks[]');
    }
    const outObj = output;
    const tasks = outObj.tasks;
    if (!Array.isArray(tasks)) {
        throw new Error('错误: result.output.tasks 必须是数组');
    }
    const allowedTypes = new Set(['analysis', 'design', 'test', 'implement', 'review']);
    const allowedPriorities = new Set(['critical', 'high', 'medium', 'low']);
    const seenPlanIds = new Set();
    const parsedTasks = [];
    for (const [index, raw] of tasks.entries()) {
        if (!raw || typeof raw !== 'object') {
            throw new Error(`错误: tasks[${index}] 必须是 object`);
        }
        const t = raw;
        const planId = t.planId;
        const title = t.title;
        const type = t.type;
        const priority = t.priority;
        if (typeof planId !== 'string' || !planId) {
            throw new Error(`错误: tasks[${index}].planId 必须是非空字符串`);
        }
        if (seenPlanIds.has(planId)) {
            throw new Error(`错误: planId 重复: ${planId}`);
        }
        seenPlanIds.add(planId);
        if (typeof title !== 'string' || !title.trim()) {
            throw new Error(`错误: tasks[${index}].title 必须是非空字符串`);
        }
        if (typeof type !== 'string' || !allowedTypes.has(type)) {
            throw new Error(`错误: tasks[${index}].type 无效: ${String(type)}`);
        }
        let parsedPriority;
        if (typeof priority !== 'undefined') {
            if (typeof priority !== 'string' || !allowedPriorities.has(priority)) {
                throw new Error(`错误: tasks[${index}].priority 无效: ${String(priority)}`);
            }
            parsedPriority = priority;
        }
        const dependencies = [];
        if (typeof t.dependencies !== 'undefined') {
            if (!Array.isArray(t.dependencies)) {
                throw new Error(`错误: tasks[${index}].dependencies 必须是字符串数组`);
            }
            for (const dep of t.dependencies) {
                if (typeof dep !== 'string' || !dep) {
                    throw new Error(`错误: tasks[${index}].dependencies 包含无效 planId`);
                }
                dependencies.push(dep);
            }
        }
        const acceptanceCriteria = [];
        if (typeof t.acceptanceCriteria !== 'undefined') {
            if (!Array.isArray(t.acceptanceCriteria)) {
                throw new Error(`错误: tasks[${index}].acceptanceCriteria 必须是字符串数组`);
            }
            for (const ac of t.acceptanceCriteria) {
                if (typeof ac !== 'string' || !ac.trim()) {
                    throw new Error(`错误: tasks[${index}].acceptanceCriteria 包含无效条目`);
                }
                acceptanceCriteria.push(ac);
            }
        }
        let scope;
        if (typeof t.scope !== 'undefined') {
            if (!t.scope || typeof t.scope !== 'object') {
                throw new Error(`错误: tasks[${index}].scope 必须是 object`);
            }
            const s = t.scope;
            const files = Array.isArray(s.files) ? s.files : undefined;
            const modules = Array.isArray(s.modules) ? s.modules : undefined;
            const tags = Array.isArray(s.tags) ? s.tags : undefined;
            const normalizeStringArray = (arr, key) => {
                if (!arr)
                    return undefined;
                const out = [];
                for (const v of arr) {
                    if (typeof v !== 'string' || !v.trim()) {
                        throw new Error(`错误: tasks[${index}].scope.${key} 必须是字符串数组`);
                    }
                    out.push(v);
                }
                return out.length > 0 ? out : undefined;
            };
            scope = {
                files: files ? normalizeStringArray(files, 'files') : undefined,
                modules: modules ? normalizeStringArray(modules, 'modules') : undefined,
                tags: tags ? normalizeStringArray(tags, 'tags') : undefined,
            };
            if (!scope.files && !scope.modules && !scope.tags) {
                scope = undefined;
            }
        }
        parsedTasks.push({
            planId,
            title: title.trim(),
            type: type,
            priority: parsedPriority,
            dependencies: dependencies.length > 0 ? dependencies : undefined,
            acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
            scope,
        });
    }
    return parsedTasks;
}
function main() {
    var _a, _b, _c, _d, _e, _f;
    const args = process.argv.slice(2);
    const parsed = parseCli(args);
    if (!parsed.command || parsed.command === 'help' || parsed.command === '--help' || parsed.command === '-h') {
        showHelp();
        process.exit(parsed.command ? 0 : 1);
    }
    const manager = new TaskBookManager(process.cwd());
    const json = flagAsBool(parsed.flags, 'json');
    const requireIfRev = flagAsBool(parsed.flags, 'require-if-rev') || isTruthyEnv(REQUIRE_IF_REV_ENV);
    let expectedRevision;
    try {
        expectedRevision = expectedRevisionFromFlags(parsed.flags);
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
    if (requireIfRev && MUTATING_COMMANDS_REQUIRING_IF_REV.has(parsed.command) && typeof expectedRevision !== 'number') {
        console.error(`错误: ${parsed.command} 需要 --if-rev <number>（已开启并发保护）`);
        console.error('提示: 先执行 show <taskBookId> 读取 revision，再重试写操作。');
        process.exit(1);
    }
    try {
        switch (parsed.command) {
            case 'create': {
                const title = flagAsString(parsed.flags, 'title');
                const description = flagAsString(parsed.flags, 'description');
                const type = flagAsString(parsed.flags, 'type');
                if (!title || !description || !type) {
                    console.error('错误: create 需要 --title --description --type');
                    showHelp();
                    process.exit(1);
                }
                const taskBook = manager.create({ title, description, taskType: type });
                if (json) {
                    printJson(taskBook);
                }
                else {
                    console.log(`[TaskBook] 已创建: ${taskBook.id}`);
                    console.log(manager.formatForDisplay(taskBook));
                }
                break;
            }
            case 'list': {
                const list = manager.listActive();
                if (json) {
                    printJson(list);
                }
                else {
                    if (list.length === 0) {
                        console.log('[TaskBook] 没有 active TaskBook');
                        break;
                    }
                    console.log('[TaskBook] Active TaskBooks:');
                    for (const tb of list) {
                        console.log(`- ${tb.id} | ${tb.taskType} | ${tb.status} | ${tb.title}`);
                    }
                }
                break;
            }
            case 'show': {
                const taskBookId = parsed.positionals[0];
                if (!taskBookId) {
                    console.error('错误: show 需要 <taskBookId>');
                    process.exit(1);
                }
                const tb = manager.load(taskBookId);
                if (!tb) {
                    console.error(`错误: TaskBook not found: ${taskBookId}`);
                    process.exit(1);
                }
                if (json) {
                    printJson(tb);
                }
                else {
                    console.log(manager.formatForDisplay(tb));
                    console.log(`\n状态: ${tb.status}`);
                    console.log(`创建时间: ${tb.createdAt}`);
                    console.log(`revision: ${(_a = tb.revision) !== null && _a !== void 0 ? _a : 0}`);
                    if (tb.updatedAt)
                        console.log(`updatedAt: ${tb.updatedAt}`);
                    if (tb.confirmedAt)
                        console.log(`确认时间: ${tb.confirmedAt}`);
                    if (tb.completedAt)
                        console.log(`完成时间: ${tb.completedAt}`);
                    console.log(`任务数: ${tb.tasks.length}`);
                }
                break;
            }
            case 'report': {
                const taskBookId = parsed.positionals[0];
                const write = flagAsBool(parsed.flags, 'write');
                const out = flagAsString(parsed.flags, 'out');
                if (!taskBookId) {
                    console.error('错误: report 需要 <taskBookId>');
                    process.exit(1);
                }
                const report = manager.generateAcceptanceReport(taskBookId);
                if (!report) {
                    console.error(`错误: TaskBook not found: ${taskBookId}`);
                    process.exit(1);
                }
                if (write) {
                    const outDir = path.join(process.cwd(), '.codebuddy', 'reports', 'taskbooks');
                    ensureDir(outDir);
                    const outPath = out ? path.resolve(process.cwd(), out) : path.join(outDir, `${taskBookId}.acceptance.json`);
                    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
                    if (!json)
                        console.log(`[TaskBook] 已生成验收报告: ${outPath}`);
                }
                if (json || !write) {
                    printJson(report);
                }
                break;
            }
            case 'plan': {
                const taskBookId = parsed.positionals[0];
                if (!taskBookId) {
                    console.error('错误: plan 需要 <taskBookId>');
                    process.exit(1);
                }
                const tb = manager.load(taskBookId);
                if (!tb) {
                    console.error(`错误: TaskBook not found: ${taskBookId}`);
                    process.exit(1);
                }
                const requestId = (_b = flagAsString(parsed.flags, 'request-id')) !== null && _b !== void 0 ? _b : generateRequestId();
                const agentCallsDir = path.join(process.cwd(), AGENT_CALLS_DIR);
                ensureDir(agentCallsDir);
                const promptPath = path.join(agentCallsDir, `${requestId}.prompt.md`);
                const resultPath = path.join(agentCallsDir, `${requestId}.result.json`);
                const agentDef = loadPlannerAgentDefinition(process.cwd());
                if (!agentDef) {
                    console.error('错误: planner AGENT.md 未找到（需要 .codebuddy/agents/planner/AGENT.md 或 agents/planner/AGENT.md）');
                    console.error('提示: 先在目标项目执行 codebuddy-loader 生成 .codebuddy/agents/，再重试。');
                    process.exit(1);
                }
                const prompt = buildPlannerPrompt({
                    requestId,
                    taskBook: tb,
                    projectRoot: process.cwd(),
                    agentDefinitionPath: agentDef.path,
                    agentDefinition: agentDef.content,
                    promptPath,
                    resultPath,
                });
                fs.writeFileSync(promptPath, prompt, 'utf-8');
                const payload = {
                    requestId,
                    agentId: 'planner',
                    taskBookId,
                    taskBookRevision: (_c = tb.revision) !== null && _c !== void 0 ? _c : 0,
                    promptPath,
                    resultPath,
                };
                if (json) {
                    printJson(payload);
                }
                else {
                    console.log(`[planner] 已生成 prompt: ${promptPath}`);
                    console.log(`[planner] 请执行 prompt 并写回: ${resultPath}`);
                    console.log('[planner] 写回后执行:');
                    console.log(`  node .codebuddy/scripts/taskbook-manager.js apply-plan ${taskBookId} ${requestId}`);
                    console.log(`  # 若启用并发保护：加上 --if-rev ${(_d = tb.revision) !== null && _d !== void 0 ? _d : 0}`);
                }
                break;
            }
            case 'apply-plan': {
                const taskBookId = parsed.positionals[0];
                const requestId = parsed.positionals[1];
                const dryRun = flagAsBool(parsed.flags, 'dry-run');
                if (!taskBookId || !requestId) {
                    console.error('错误: apply-plan 需要 <taskBookId> <requestId>');
                    process.exit(1);
                }
                const agentCallsDir = path.join(process.cwd(), AGENT_CALLS_DIR);
                const resultPath = path.join(agentCallsDir, `${requestId}.result.json`);
                if (!fs.existsSync(resultPath)) {
                    console.error(`错误: result.json 不存在: ${resultPath}`);
                    process.exit(1);
                }
                let result;
                try {
                    result = parseAgentCallResult(fs.readFileSync(resultPath, 'utf-8'));
                }
                catch (error) {
                    console.error(error instanceof Error ? error.message : String(error));
                    process.exit(1);
                }
                if (result.requestId !== requestId) {
                    console.error(`错误: requestId 不匹配（args=${requestId}, file=${result.requestId}）`);
                    process.exit(1);
                }
                if (result.status !== 'success') {
                    const msg = (result.error && result.error.message) ? result.error.message : `status=${result.status}`;
                    console.error(`错误: planner result 不是 success: ${msg}`);
                    process.exit(1);
                }
                const planTasks = parsePlannerTasksFromAgentResult(result);
                if (dryRun) {
                    const preview = {
                        dryRun: true,
                        requestId,
                        taskBookId,
                        tasks: planTasks,
                    };
                    if (json)
                        printJson(preview);
                    else {
                        console.log(`[planner] dry-run: ${taskBookId} <- ${requestId}`);
                        for (const t of planTasks) {
                            const deps = t.dependencies && t.dependencies.length > 0 ? ` deps=${t.dependencies.join(',')}` : '';
                            console.log(`- ${t.planId} [${t.type}] ${t.title}${deps}`);
                        }
                    }
                    break;
                }
                const planIdToIndex = new Map();
                for (let i = 0; i < planTasks.length; i++) {
                    planIdToIndex.set(planTasks[i].planId, i);
                }
                for (let i = 0; i < planTasks.length; i++) {
                    const deps = (_e = planTasks[i].dependencies) !== null && _e !== void 0 ? _e : [];
                    for (const dep of deps) {
                        const depIndex = planIdToIndex.get(dep);
                        if (typeof depIndex !== 'number') {
                            console.error(`错误: 依赖 planId 不存在: ${dep} (from ${planTasks[i].planId})`);
                            process.exit(1);
                        }
                        if (depIndex >= i) {
                            console.error(`错误: dependencies 必须指向更早的 planId（${planTasks[i].planId} 依赖 ${dep}）`);
                            process.exit(1);
                        }
                    }
                }
                const applied = manager.applyPlannerPlan(taskBookId, requestId, planTasks, expectedRevision);
                if (!applied) {
                    console.error(`错误: TaskBook not found: ${taskBookId}`);
                    process.exit(1);
                }
                const payload = {
                    requestId,
                    taskBookId,
                    addedTaskIds: applied.taskIds,
                    planIdToTaskId: applied.planIdToTaskId,
                    taskBook: applied.taskBook,
                };
                if (json)
                    printJson(payload);
                else {
                    console.log(`[planner] 已追加 ${applied.taskIds.length} 个任务到 ${taskBookId}`);
                    console.log(`requestId: ${requestId}`);
                    for (const id of applied.taskIds) {
                        console.log(`- ${id}`);
                    }
                }
                break;
            }
            case 'confirm': {
                const taskBookId = parsed.positionals[0];
                if (!taskBookId) {
                    console.error('错误: confirm 需要 <taskBookId>');
                    process.exit(1);
                }
                const tb = manager.updateStatus(taskBookId, 'confirmed', expectedRevision);
                if (!tb) {
                    console.error(`错误: TaskBook not found: ${taskBookId}`);
                    process.exit(1);
                }
                if (json)
                    printJson(tb);
                else
                    console.log(`[TaskBook] 已确认: ${taskBookId}`);
                break;
            }
            case 'complete': {
                const taskBookId = parsed.positionals[0];
                if (!taskBookId) {
                    console.error('错误: complete 需要 <taskBookId>');
                    process.exit(1);
                }
                const tb = manager.updateStatus(taskBookId, 'completed', expectedRevision);
                if (!tb) {
                    console.error(`错误: TaskBook not found: ${taskBookId}`);
                    process.exit(1);
                }
                if (json)
                    printJson(tb);
                else
                    console.log(`[TaskBook] 已完成并归档: ${taskBookId}`);
                break;
            }
            case 'abort': {
                const taskBookId = parsed.positionals[0];
                if (!taskBookId) {
                    console.error('错误: abort 需要 <taskBookId>');
                    process.exit(1);
                }
                const tb = manager.updateStatus(taskBookId, 'aborted', expectedRevision);
                if (!tb) {
                    console.error(`错误: TaskBook not found: ${taskBookId}`);
                    process.exit(1);
                }
                if (json)
                    printJson(tb);
                else
                    console.log(`[TaskBook] 已中止并归档: ${taskBookId}`);
                break;
            }
            case 'add-task': {
                const taskBookId = parsed.positionals[0];
                if (!taskBookId) {
                    console.error('错误: add-task 需要 <taskBookId>');
                    process.exit(1);
                }
                const title = flagAsString(parsed.flags, 'title');
                const type = flagAsString(parsed.flags, 'type');
                const priority = flagAsString(parsed.flags, 'priority');
                const deps = parseCsv(flagAsString(parsed.flags, 'deps'));
                const ac = flagAsStringArray(parsed.flags, 'ac');
                const files = parseCsv(flagAsString(parsed.flags, 'files'));
                const modules = parseCsv(flagAsString(parsed.flags, 'modules'));
                const tags = parseCsv(flagAsString(parsed.flags, 'tags'));
                if (!title || !type) {
                    console.error('错误: add-task 需要 --title --type');
                    showHelp();
                    process.exit(1);
                }
                const tb = manager.addTask(taskBookId, {
                    title,
                    type,
                    priority,
                    dependencies: deps,
                    acceptanceCriteria: ac,
                    scope: buildScope(files, modules, tags),
                }, expectedRevision);
                if (!tb) {
                    console.error(`错误: TaskBook not found: ${taskBookId}`);
                    process.exit(1);
                }
                if (json)
                    printJson(tb);
                else
                    console.log(`[TaskBook] 已添加任务: ${tb.tasks[tb.tasks.length - 1].id}`);
                break;
            }
            case 'update-task': {
                const taskBookId = parsed.positionals[0];
                const taskId = parsed.positionals[1];
                if (!taskBookId || !taskId) {
                    console.error('错误: update-task 需要 <taskBookId> <taskId>');
                    process.exit(1);
                }
                const patch = {};
                const title = flagAsString(parsed.flags, 'title');
                if (title)
                    patch.title = title;
                const executedBy = flagAsString(parsed.flags, 'executed-by');
                if (executedBy)
                    patch.executedBy = executedBy;
                const status = flagAsString(parsed.flags, 'status');
                if (status)
                    patch.status = status;
                const priority = flagAsString(parsed.flags, 'priority');
                if (priority)
                    patch.priority = priority;
                const deps = parseCsv(flagAsString(parsed.flags, 'deps'));
                if (deps.length > 0)
                    patch.dependencies = deps;
                const ac = flagAsStringArray(parsed.flags, 'ac');
                if (ac.length > 0)
                    patch.acceptanceCriteria = ac;
                const files = parseCsv(flagAsString(parsed.flags, 'files'));
                const modules = parseCsv(flagAsString(parsed.flags, 'modules'));
                const tags = parseCsv(flagAsString(parsed.flags, 'tags'));
                const scope = buildScope(files, modules, tags);
                if (scope)
                    patch.scope = scope;
                const actualWork = flagAsString(parsed.flags, 'actual-work');
                if (actualWork)
                    patch.actualWork = actualWork;
                const blockedReason = flagAsString(parsed.flags, 'blocked-reason');
                if (blockedReason)
                    patch.blockedReason = blockedReason;
                const tb = manager.updateTask(taskBookId, taskId, patch, expectedRevision);
                if (!tb) {
                    console.error(`错误: TaskBook/task not found: ${taskBookId} ${taskId}`);
                    process.exit(1);
                }
                if (json)
                    printJson(tb);
                else
                    console.log(`[TaskBook] 已更新任务: ${taskId}`);
                break;
            }
            case 'unblock': {
                const taskBookId = parsed.positionals[0];
                const taskId = parsed.positionals[1];
                const resolution = flagAsString(parsed.flags, 'resolution');
                if (!taskBookId || !taskId || !resolution) {
                    console.error('错误: unblock 需要 <taskBookId> <taskId> --resolution <text>');
                    process.exit(1);
                }
                const tb = manager.unblockTask(taskBookId, taskId, resolution, expectedRevision);
                if (!tb) {
                    console.error(`错误: TaskBook/task not found: ${taskBookId} ${taskId}`);
                    process.exit(1);
                }
                if (json)
                    printJson(tb);
                else
                    console.log(`[TaskBook] 已解除阻塞: ${taskId}`);
                break;
            }
            case 'claim': {
                const taskBookId = parsed.positionals[0];
                const taskId = parsed.positionals[1];
                const by = flagAsString(parsed.flags, 'by');
                if (!taskBookId || !taskId || !by) {
                    console.error('错误: claim 需要 <taskBookId> <taskId> --by <name>');
                    process.exit(1);
                }
                const tb = manager.updateTask(taskBookId, taskId, { executedBy: by }, expectedRevision);
                if (!tb) {
                    console.error(`错误: TaskBook/task not found: ${taskBookId} ${taskId}`);
                    process.exit(1);
                }
                if (json)
                    printJson(tb);
                else
                    console.log(`[TaskBook] 已认领 ${taskId} -> ${by}`);
                break;
            }
            case 'append-work': {
                const taskBookId = parsed.positionals[0];
                const taskId = parsed.positionals[1];
                const text = (_f = flagAsString(parsed.flags, 'text')) !== null && _f !== void 0 ? _f : parsed.positionals.slice(2).join(' ');
                if (!taskBookId || !taskId || !text) {
                    console.error('错误: append-work 需要 <taskBookId> <taskId> --text <text>');
                    process.exit(1);
                }
                const tb = manager.appendTaskActualWork(taskBookId, taskId, text, expectedRevision);
                if (!tb) {
                    console.error(`错误: TaskBook/task not found: ${taskBookId} ${taskId}`);
                    process.exit(1);
                }
                if (json)
                    printJson(tb);
                else
                    console.log(`[TaskBook] 已追加 actualWork: ${taskId}`);
                break;
            }
            default: {
                console.error(`未知命令: ${parsed.command}`);
                showHelp();
                process.exit(1);
            }
        }
    }
    catch (error) {
        if (error instanceof TaskBookConflictError) {
            console.error(`冲突: ${error.message}`);
            process.exit(2);
        }
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
