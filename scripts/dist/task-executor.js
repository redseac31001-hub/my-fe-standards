"use strict";
/**
 * 任务执行引擎
 *
 * 负责 TaskBook 中任务的调度和执行，支持并行执行无依赖任务
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
exports.TaskExecutor = void 0;
exports.createTaskExecutor = createTaskExecutor;
exports.runWorkflow = runWorkflow;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const cli_entry_1 = require("./lib/cli-entry");
const taskbook_manager_1 = require("./taskbook-manager");
const context_collector_1 = require("./context-collector");
const agent_runtime_1 = require("./agent-runtime");
const result_aggregator_1 = require("./result-aggregator");
const install_roots_1 = require("./lib/install-roots");
const worker_executor_1 = require("./lib/worker-executor");
const execution_metrics_1 = require("./lib/execution-metrics");
const workflow_routing_selection_1 = require("./lib/workflow-routing-selection");
/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
    maxParallel: 3,
};
const AGENT_CALLS_DIR = '.codebuddy/agent-calls';
const AGENT_CALL_MARKER = '[agent-call]';
const AGENT_CALL_RESULT_MARKER = '[agent-call-result]';
const DEFAULT_MANUAL_AGENT_ID = 'task-orchestrator';
const MANUAL_AGENT_ID_ENV = 'CODEBUDDY_MANUAL_AGENT_ID';
const REVIEW_REFLOW_TASK_TYPES = new Set(['test', 'implement', 'refactor', 'build-fix']);
const FILE_DELETE_RETRY_CODES = new Set(['EBUSY', 'EMFILE', 'ENFILE', 'EPERM']);
const FILE_DELETE_MAX_RETRIES = 6;
const FILE_DELETE_RETRY_MS = 40;
const SLEEP_INT32 = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
    Atomics.wait(SLEEP_INT32, 0, 0, ms);
}
function buildTaskRoutingText(task) {
    var _a, _b, _c;
    return [
        task.title,
        ...((_a = task.acceptanceCriteria) !== null && _a !== void 0 ? _a : []),
        ...((_c = (_b = task.scope) === null || _b === void 0 ? void 0 : _b.tags) !== null && _c !== void 0 ? _c : []),
    ]
        .filter(value => typeof value === 'string' && value.trim().length > 0)
        .join(' ');
}
function isSystemOverviewDesignTask(task) {
    const text = buildTaskRoutingText(task);
    const hasOverviewSignal = /(系统概要设计|概要设计文档|概要设计|概设|系统设计文档)/i.test(text);
    if (hasOverviewSignal)
        return true;
    const hasOverviewContext = /(系统|概要)/i.test(text);
    const hasPlanSignal = /(设计方案)/i.test(text);
    const hasOutputSignal = /(生成|输出|编写|整理|撰写|导出)/i.test(text);
    const hasWordTemplateSignal = /(word|docx|模板)/i.test(text);
    return hasOverviewContext && hasPlanSignal && (hasOutputSignal || hasWordTemplateSignal);
}
function isRuntimeBugInvestigationTask(task) {
    const text = buildTaskRoutingText(task);
    const hasRuntimeBugSignal = /(修复bug|debug|排查|报错|异常|不生效|白屏|没反应|数据不对|控制台错误)/i.test(text);
    const hasBuildSignal = /(构建|编译|打包|lint|typecheck|类型错误|npm run build|vite build|webpack|esbuild)/i.test(text);
    return hasRuntimeBugSignal && !hasBuildSignal;
}
function selectManualAgentId(task) {
    const env = (process.env[MANUAL_AGENT_ID_ENV] || '').trim();
    if (env)
        return env;
    // Lightweight heuristics (low-intrusion): choose a more specialized Agent when it is clearly relevant.
    if (/(性能|performance|lighthouse|web vitals|profil(e|ing))/i.test(task.title)) {
        return 'performance-profiler';
    }
    if (/(安全|security|xss|csrf|owasp)/i.test(task.title)) {
        return 'security-reviewer';
    }
    if (isRuntimeBugInvestigationTask(task)) {
        return 'bug-investigator';
    }
    if (task.type === 'design' && isSystemOverviewDesignTask(task)) {
        return 'system-overview-writer';
    }
    switch (task.type) {
        case 'analysis':
            return 'structure-analyzer';
        case 'test':
        case 'implement':
        case 'refactor':
            return 'tdd-driver';
        case 'review':
            return 'code-reviewer';
        case 'build-fix':
            return 'build-fix';
        case 'prd':
        case 'requirement':
            return 'planner';
        case 'design':
            return 'planner';
        case 'acceptance':
        default:
            return DEFAULT_MANUAL_AGENT_ID;
    }
}
function normalizeAgentIdentity(agentId, fallbackTask) {
    const trimmed = (agentId || '').trim();
    if (trimmed.startsWith('worker-executor:')) {
        const normalized = trimmed.slice('worker-executor:'.length).trim();
        if (normalized)
            return normalized;
    }
    if (trimmed)
        return trimmed;
    return fallbackTask ? selectManualAgentId(fallbackTask) : '';
}
function tryExtractAgentIdFromPrompt(promptMd) {
    const m = promptMd.match(/```json\s*([\s\S]*?)\s*```/);
    if (!m)
        return null;
    try {
        const parsed = JSON.parse(m[1]);
        if (!parsed || typeof parsed !== 'object')
            return null;
        const agentId = parsed.agentId;
        if (typeof agentId !== 'string')
            return null;
        const trimmed = agentId.trim();
        return trimmed ? trimmed : null;
    }
    catch (_a) {
        return null;
    }
}
function collectTaskDeliverables(task, artifacts) {
    var _a, _b;
    const values = new Set();
    for (const filePath of (_b = (_a = task.scope) === null || _a === void 0 ? void 0 : _a.files) !== null && _b !== void 0 ? _b : []) {
        if (typeof filePath === 'string' && filePath.trim()) {
            values.add(filePath.trim());
        }
    }
    for (const artifact of artifacts !== null && artifacts !== void 0 ? artifacts : []) {
        if (artifact && typeof artifact.path === 'string' && artifact.path.trim()) {
            values.add(artifact.path.trim());
        }
    }
    return values.size > 0 ? Array.from(values) : undefined;
}
function summarizeActualWork(actualWork) {
    const singleLine = actualWork.replace(/\s+/g, ' ').trim();
    if (!singleLine)
        return '';
    return singleLine.length > 180 ? `${singleLine.slice(0, 177)}...` : singleLine;
}
function selectBuildFixHandoffAnchorTasks(taskBook) {
    return taskBook.tasks.filter(task => task.type === 'build-fix' && task.status !== 'skipped');
}
function buildBuildFixFailureContext(gateResult, retryCount, maxRounds, escalated) {
    const parts = [
        (gateResult === null || gateResult === void 0 ? void 0 : gateResult.gateId) ? `Quality gate ${gateResult.gateId} failed during build_and_fix.` : 'Quality gate failed during build_and_fix.',
        (gateResult === null || gateResult === void 0 ? void 0 : gateResult.message) ? `Reason: ${gateResult.message}` : '',
        (gateResult === null || gateResult === void 0 ? void 0 : gateResult.evidencePath) ? `Evidence: ${gateResult.evidencePath}` : '',
        `Attempt: ${retryCount}/${maxRounds}.`,
        escalated ? 'Retries exhausted; escalate to orchestrator/human review.' : 'Build-fix retry required.',
    ];
    return parts.filter(Boolean).join(' ');
}
function appendBuildFixFailureHandoffs(manager, taskBookId, type, gateResult, retryCount, maxRounds) {
    const taskBook = manager.load(taskBookId);
    if (!taskBook)
        return;
    const anchors = selectBuildFixHandoffAnchorTasks(taskBook);
    if (anchors.length === 0)
        return;
    const timestamp = new Date().toISOString();
    const context = buildBuildFixFailureContext(gateResult, retryCount, maxRounds, type === 'escalation');
    for (const task of anchors) {
        const deliverables = collectTaskDeliverables(task);
        const handoff = type === 'qa_fail'
            ? {
                from: 'quality-gate',
                to: selectManualAgentId(task),
                type,
                timestamp,
                context,
                deliverables,
            }
            : {
                from: selectManualAgentId(task),
                to: DEFAULT_MANUAL_AGENT_ID,
                type,
                timestamp,
                context,
                deliverables,
            };
        manager.appendTaskHandoffs(taskBookId, task.id, [handoff]);
    }
}
function priorityScore(priority) {
    switch (priority) {
        case 'critical':
            return 4;
        case 'high':
            return 3;
        case 'medium':
            return 2;
        case 'low':
            return 1;
        default:
            return 2;
    }
}
function getConflictKeys(task) {
    var _a, _b, _c, _d;
    const files = (_b = (_a = task.scope) === null || _a === void 0 ? void 0 : _a.files) !== null && _b !== void 0 ? _b : [];
    const modules = (_d = (_c = task.scope) === null || _c === void 0 ? void 0 : _c.modules) !== null && _d !== void 0 ? _d : [];
    const keys = [
        ...files.map(f => `file:${f}`),
        ...modules.map(m => `module:${m}`),
    ];
    return keys.length > 0 ? keys : null;
}
function selectRunnableTasks(runnable, maxParallel, strategy) {
    if (maxParallel <= 0)
        return [];
    if (strategy === 'allow')
        return runnable.slice(0, maxParallel);
    // deny_same_file_set: tasks without explicit scope are treated as global (conflict with all)
    const selected = [];
    const used = new Set();
    let hasGlobal = false;
    for (const task of runnable) {
        if (selected.length >= maxParallel)
            break;
        const keys = getConflictKeys(task);
        if (!keys) {
            if (selected.length === 0) {
                selected.push(task);
                hasGlobal = true;
            }
            continue;
        }
        if (hasGlobal)
            continue;
        let overlap = false;
        for (const k of keys) {
            if (used.has(k)) {
                overlap = true;
                break;
            }
        }
        if (overlap)
            continue;
        for (const k of keys)
            used.add(k);
        selected.push(task);
    }
    // fallback: if everything got filtered out, at least make progress
    return selected.length > 0 ? selected : runnable.slice(0, 1);
}
/**
 * 任务执行引擎
 */
class TaskExecutor {
    constructor(manager, config = {}) {
        var _a;
        this.isRunning = false;
        this.isPaused = false;
        /** AgentRuntime 渲染的最后一个 prompt（用于注入 .prompt.md） */
        this.lastRenderedPrompt = null;
        this.manager = manager;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.runtime = config.runtime || null;
        this.workerExecutor = (_a = config.workerExecutor) !== null && _a !== void 0 ? _a : (0, worker_executor_1.createConfiguredWorkerExecutor)();
    }
    getProjectRoot() {
        return this.manager.getProjectRoot();
    }
    resolveProjectPath(filePath) {
        return path.resolve(this.getProjectRoot(), filePath);
    }
    getCurrentTaskAttemptKey(taskBookId, task) {
        var _a;
        const taskBook = this.manager.load(taskBookId);
        const currentTask = taskBook === null || taskBook === void 0 ? void 0 : taskBook.tasks.find(candidate => candidate.id === task.id);
        return (_a = currentTask === null || currentTask === void 0 ? void 0 : currentTask.startedAt) !== null && _a !== void 0 ? _a : task.startedAt;
    }
    /**
     * 开始执行 TaskBook（兼容旧行为：任务完成后自动标记 TaskBook 为 completed）
     */
    async execute(taskBookId) {
        var _a, _b;
        const result = await this.executeTasks(taskBookId);
        if (!result.taskBook)
            return null;
        if (result.status === 'completed') {
            // 先归档到 history/，再汇总——确保 saveFinalReport 读写同一目录（history/）
            this.manager.updateStatus(taskBookId, 'completed');
            // Phase 7：汇总所有子 Agent 结果，生成 FinalReport（在归档后执行）
            try {
                (0, result_aggregator_1.aggregateAndPersist)(this.manager, taskBookId);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[TaskExecutor] FinalReport 生成失败（不影响完成状态）：${msg}`);
            }
            (_b = (_a = this.config).onAllComplete) === null || _b === void 0 ? void 0 : _b.call(_a, result.taskBook);
        }
        return this.manager.load(taskBookId);
    }
    /**
     * 执行 TaskBook 中指定类型的任务（用于 workflow 分阶段执行，不自动完成 TaskBook）
     */
    async executeTasks(taskBookId, options = {}) {
        var _a, _b, _c;
        const taskBook = this.manager.load(taskBookId);
        if (!taskBook) {
            return { status: 'not_found', taskBook: null, message: `TaskBook not found: ${taskBookId}` };
        }
        if (taskBook.status !== 'confirmed' && taskBook.status !== 'executing') {
            return {
                status: 'invalid_status',
                taskBook,
                message: `TaskBook must be confirmed/executing before execution. Current status: ${taskBook.status}`,
            };
        }
        const allowedTypes = new Set((_a = options.allowedTaskTypes) !== null && _a !== void 0 ? _a : ['analysis', 'design', 'test', 'implement', 'review']);
        const allowedTaskIds = options.allowedTaskIds ? new Set(options.allowedTaskIds) : null;
        const maxParallel = (_b = options.maxParallel) !== null && _b !== void 0 ? _b : this.config.maxParallel;
        const conflictStrategy = (_c = options.conflictStrategy) !== null && _c !== void 0 ? _c : 'allow';
        this.isRunning = true;
        this.isPaused = false;
        console.log(`[TaskExecutor] 执行任务类型: ${Array.from(allowedTypes).join(', ')}`);
        while (this.isRunning && !this.isPaused) {
            const current = this.manager.load(taskBookId);
            if (!current) {
                return { status: 'not_found', taskBook: null, message: `TaskBook not found: ${taskBookId}` };
            }
            // Auto-apply AgentCall results for blocked tasks (so rerun can resume automatically).
            const applied = this.tryAutoApplyAgentCallResults(taskBookId, current, allowedTypes, allowedTaskIds);
            if (applied > 0) {
                continue;
            }
            const pendingAllowed = current.tasks.filter(t => t.status === 'pending'
                && allowedTypes.has(t.type)
                && (!allowedTaskIds || allowedTaskIds.has(t.id)));
            const blockedAllowed = current.tasks.filter(t => t.status === 'blocked'
                && allowedTypes.has(t.type)
                && (!allowedTaskIds || allowedTaskIds.has(t.id)));
            if (pendingAllowed.length === 0) {
                if (blockedAllowed.length > 0) {
                    return {
                        status: 'blocked',
                        taskBook: current,
                        message: `存在阻塞任务（${blockedAllowed.length} 个）`,
                    };
                }
                return { status: 'completed', taskBook: current };
            }
            const completedTaskIds = new Set(current.tasks
                .filter(t => t.status === 'done' || t.status === 'skipped')
                .map(t => t.id));
            const runnable = pendingAllowed.filter(task => task.dependencies.every(depId => completedTaskIds.has(depId)));
            if (runnable.length === 0) {
                // 可能是等待其他类型任务完成，也可能是循环依赖
                const waits = pendingAllowed.map(t => {
                    const unresolved = t.dependencies.filter(depId => !completedTaskIds.has(depId));
                    return { id: t.id, title: t.title, unresolved };
                });
                return {
                    status: blockedAllowed.length > 0 ? 'blocked' : 'waiting',
                    taskBook: current,
                    message: `没有可执行的任务（等待依赖完成/可能存在循环依赖）。未满足依赖: ${JSON.stringify(waits.slice(0, 5))}`,
                };
            }
            const indexById = new Map();
            for (let i = 0; i < current.tasks.length; i++) {
                indexById.set(current.tasks[i].id, i);
            }
            const runnableSorted = [...runnable].sort((a, b) => {
                var _a, _b;
                const delta = priorityScore(b.priority) - priorityScore(a.priority);
                if (delta !== 0)
                    return delta;
                return ((_a = indexById.get(a.id)) !== null && _a !== void 0 ? _a : 0) - ((_b = indexById.get(b.id)) !== null && _b !== void 0 ? _b : 0);
            });
            const tasksToExecute = selectRunnableTasks(runnableSorted, maxParallel, conflictStrategy);
            if (conflictStrategy !== 'allow' && tasksToExecute.length < Math.min(maxParallel, runnable.length)) {
                console.log(`[TaskExecutor] conflictStrategy=${conflictStrategy}: runnable=${runnable.length} selected=${tasksToExecute.length}`);
            }
            console.log(`[TaskExecutor] 并行执行 ${tasksToExecute.length} 个任务`);
            const results = await Promise.all(tasksToExecute.map(task => this.executeTask(taskBookId, task)));
            // T3.1: 批次完成汇报
            const succeeded = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            const batchDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
            const executors = results
                .map(r => {
                const task = current.tasks.find(t => t.id === r.taskId);
                return task ? selectManualAgentId(task) : 'unknown';
            })
                .filter((v, i, a) => a.indexOf(v) === i); // 去重
            // T3.3: 进度视图
            const latestTb = this.manager.load(taskBookId);
            if (latestTb) {
                const done = latestTb.tasks.filter(t => t.status === 'done' || t.status === 'skipped').length;
                const inProgress = latestTb.tasks.filter(t => t.status === 'in_progress').length;
                const blocked = latestTb.tasks.filter(t => t.status === 'blocked').length;
                const pending = latestTb.tasks.filter(t => t.status === 'pending').length;
                console.log(`[进度] ✅ ${done}/${latestTb.tasks.length} 完成 | 🔄 ${inProgress} 进行中 | 🚫 ${blocked} 阻塞 | ⏳ ${pending} 待执行`);
            }
            // 写入 changelog
            this.manager.logChange(taskBookId, null, 'modified', `批次完成: ${succeeded}/${results.length} 成功, ${failed} 失败/阻塞, 耗时 ${batchDuration}ms`, undefined, { event: 'batch_complete', succeeded, failed, duration: batchDuration, executors });
            for (const result of results) {
                if (!result.success && result.error) {
                    console.log(`[TaskExecutor] 任务 ${result.taskId} 执行失败: ${result.error}`);
                }
            }
        }
        return { status: 'blocked', taskBook: this.manager.load(taskBookId), message: '执行被暂停/停止' };
    }
    buildCompletionHandoffs(taskBookId, task, executedBy, actualWork, artifacts) {
        const taskBook = this.manager.load(taskBookId);
        if (!taskBook)
            return [];
        const deliverables = collectTaskDeliverables(task, artifacts);
        const handoffType = task.type === 'review' ? 'qa_pass' : 'standard';
        const actualWorkSummary = summarizeActualWork(actualWork);
        const handoffs = [];
        for (const candidate of taskBook.tasks) {
            if (candidate.id === task.id || !candidate.dependencies.includes(task.id)) {
                continue;
            }
            const targetAgentId = selectManualAgentId(candidate);
            if (!targetAgentId || targetAgentId === executedBy) {
                continue;
            }
            const context = [
                `${task.title} completed; ready for ${candidate.id} (${candidate.title}).`,
                actualWorkSummary ? `Summary: ${actualWorkSummary}` : '',
            ].filter(Boolean).join(' ');
            handoffs.push({
                from: executedBy,
                to: targetAgentId,
                type: handoffType,
                timestamp: new Date().toISOString(),
                context,
                deliverables,
            });
        }
        return handoffs;
    }
    recordCompletionHandoffs(taskBookId, task, executedBy, actualWork, artifacts) {
        const handoffs = this.buildCompletionHandoffs(taskBookId, task, executedBy, actualWork, artifacts);
        if (handoffs.length === 0)
            return;
        this.manager.appendTaskHandoffs(taskBookId, task.id, handoffs);
    }
    buildAgentCallFailureHandoffs(taskBookId, task, agentId, status, reason, artifacts) {
        const timestamp = new Date().toISOString();
        const deliverables = collectTaskDeliverables(task, artifacts);
        const normalizedAgentId = normalizeAgentIdentity(agentId, task);
        const reasonSummary = summarizeActualWork(reason) || reason;
        if (task.type === 'review' && status === 'failed') {
            const taskBook = this.manager.load(taskBookId);
            if (!taskBook)
                return [];
            const handoffs = [];
            for (const dependencyId of task.dependencies) {
                const dependencyTask = taskBook.tasks.find(candidate => candidate.id === dependencyId);
                if (!dependencyTask)
                    continue;
                const targetAgentId = normalizeAgentIdentity(dependencyTask.executedBy, dependencyTask);
                if (!targetAgentId || targetAgentId === normalizedAgentId) {
                    continue;
                }
                handoffs.push({
                    from: normalizedAgentId,
                    to: targetAgentId,
                    type: 'qa_fail',
                    timestamp,
                    context: `Review task ${task.id} (${task.title}) failed. Reason: ${reasonSummary}`,
                    deliverables,
                });
            }
            if (handoffs.length > 0) {
                return handoffs;
            }
        }
        return [{
                from: normalizedAgentId || selectManualAgentId(task),
                to: DEFAULT_MANUAL_AGENT_ID,
                type: 'escalation',
                timestamp,
                context: `Agent call for ${task.id} (${task.title}) reported ${status}. Reason: ${reasonSummary}`,
                deliverables,
            }];
    }
    recordAgentCallFailure(taskBookId, task, meta, result, reason) {
        var _a;
        const status = result.status === 'blocked' ? 'blocked' : 'failed';
        const handoffs = this.buildAgentCallFailureHandoffs(taskBookId, task, meta.agentId, status, reason, result.artifacts);
        if (handoffs.length > 0) {
            this.manager.appendTaskHandoffs(taskBookId, task.id, handoffs);
        }
        const nextBlockedReason = appendAgentCallResultState(task.blockedReason, {
            requestId: meta.requestId,
            status,
            completedAt: result.completedAt,
            message: reason,
        });
        this.manager.updateTask(taskBookId, task.id, {
            blockedReason: nextBlockedReason,
        });
        this.manager.logChange(taskBookId, task.id, 'modified', `agent-call reported ${status}: ${meta.requestId}`, undefined, {
            event: 'agent-call',
            action: 'reported_failure',
            requestId: meta.requestId,
            agentId: meta.agentId,
            kind: (_a = result.kind) !== null && _a !== void 0 ? _a : meta.kind,
            status,
            completedAt: result.completedAt,
            promptPath: meta.promptPath,
            resultPath: meta.resultPath,
            artifacts: result.artifacts,
            reason,
            handoffTypes: handoffs.map(handoff => handoff.type),
        });
        (0, execution_metrics_1.recordExecutionMetric)({
            projectRoot: this.getProjectRoot(),
            eventType: 'agent_call_applied',
            taskBookId,
            taskId: task.id,
            taskType: task.type,
            taskTitle: task.title,
            executionMode: 'agent-call',
            agentId: meta.agentId,
            requestId: meta.requestId,
            status,
            durationMs: (0, execution_metrics_1.computeDurationMs)(meta.createdAt, result.completedAt),
            blockedReasonCode: (0, execution_metrics_1.classifyBlockedReason)(reason),
            blockedReason: truncateMetricText(reason),
        });
        this.tryAutoReflowFromQaFailure(taskBookId, task, meta, status, reason);
    }
    removeAgentCallFiles(paths) {
        var _a;
        const uniquePaths = [...new Set(paths.filter(Boolean).map(filePath => this.resolveProjectPath(filePath)))];
        for (const filePath of uniquePaths) {
            for (let attempt = 0; attempt <= FILE_DELETE_MAX_RETRIES; attempt++) {
                try {
                    fs.unlinkSync(filePath);
                    break;
                }
                catch (error) {
                    const code = error && typeof error === 'object' && 'code' in error
                        ? String((_a = error.code) !== null && _a !== void 0 ? _a : '')
                        : '';
                    if (code === 'ENOENT') {
                        break;
                    }
                    if (attempt >= FILE_DELETE_MAX_RETRIES || !FILE_DELETE_RETRY_CODES.has(code)) {
                        try {
                            fs.rmSync(filePath, { force: true });
                        }
                        catch (_b) {
                            // ignore cleanup failures; next run should rotate request IDs instead of reusing stale files
                        }
                        break;
                    }
                    sleepSync(FILE_DELETE_RETRY_MS * (attempt + 1));
                }
            }
        }
    }
    clearAgentCallArtifacts(taskBookId, task) {
        const requestId = computeAgentCallRequestId(taskBookId, task.id, this.getCurrentTaskAttemptKey(taskBookId, task));
        this.removeAgentCallFiles([
            toPosixPath(`${AGENT_CALLS_DIR}/${requestId}.prompt.md`),
            toPosixPath(`${AGENT_CALLS_DIR}/${requestId}.result.json`),
        ]);
    }
    tryAutoReflowFromQaFailure(taskBookId, task, meta, status, reason) {
        if (task.type !== 'review' || status !== 'failed') {
            return false;
        }
        const taskBook = this.manager.load(taskBookId);
        if (!taskBook)
            return false;
        const reopenedTasks = task.dependencies
            .map(dependencyId => taskBook.tasks.find(candidate => candidate.id === dependencyId))
            .filter((candidate) => {
            if (!candidate)
                return false;
            return candidate.status === 'done' && REVIEW_REFLOW_TASK_TYPES.has(candidate.type);
        });
        if (reopenedTasks.length === 0) {
            return false;
        }
        for (const reopenedTask of reopenedTasks) {
            this.clearAgentCallArtifacts(taskBookId, reopenedTask);
            this.manager.updateTask(taskBookId, reopenedTask.id, {
                status: 'pending',
            });
        }
        this.removeAgentCallFiles([
            meta.promptPath,
            meta.resultPath,
        ]);
        this.manager.updateTask(taskBookId, task.id, {
            status: 'pending',
            blockedReason: '',
        });
        this.manager.logChange(taskBookId, task.id, 'modified', `qa_fail auto reflow: reopened ${reopenedTasks.map(item => item.id).join(', ')}`, undefined, {
            event: 'qa_fail_reflow',
            reviewTaskId: task.id,
            reopenedTaskIds: reopenedTasks.map(item => item.id),
            reopenedTaskTypes: reopenedTasks.map(item => item.type),
            reason,
        });
        return true;
    }
    collectIncomingHandoffs(taskBook, task, targetAgentId) {
        if (!targetAgentId) {
            return [];
        }
        const dependencyIds = new Set(task.dependencies);
        const incoming = [];
        for (const candidate of taskBook.tasks) {
            if (!dependencyIds.has(candidate.id) || !Array.isArray(candidate.handoffs)) {
                continue;
            }
            for (const handoff of candidate.handoffs) {
                if (handoff.to !== targetAgentId) {
                    continue;
                }
                incoming.push({
                    ...handoff,
                    sourceTaskId: candidate.id,
                    sourceTaskTitle: candidate.title,
                    sourceTaskType: candidate.type,
                    sourceTaskStatus: candidate.status,
                    sourceTaskExecutedBy: candidate.executedBy,
                });
            }
        }
        for (const candidate of taskBook.tasks) {
            if (!candidate.dependencies.includes(task.id) || !Array.isArray(candidate.handoffs)) {
                continue;
            }
            for (const handoff of candidate.handoffs) {
                if (handoff.to !== targetAgentId) {
                    continue;
                }
                incoming.push({
                    ...handoff,
                    sourceTaskId: candidate.id,
                    sourceTaskTitle: candidate.title,
                    sourceTaskType: candidate.type,
                    sourceTaskStatus: candidate.status,
                    sourceTaskExecutedBy: candidate.executedBy,
                });
            }
        }
        return incoming.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    }
    /**
     * 执行单个任务
     */
    async executeTask(taskBookId, task) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const startTime = Date.now();
        // 更新任务状态为进行中
        this.manager.updateTaskStatus(taskBookId, task.id, 'in_progress');
        (_b = (_a = this.config).onTaskStart) === null || _b === void 0 ? void 0 : _b.call(_a, task);
        this.lastRenderedPrompt = null;
        const plannedAgentId = task.type === 'analysis' || task.type === 'acceptance'
            ? undefined
            : selectManualAgentId(task);
        (0, execution_metrics_1.recordExecutionMetric)({
            projectRoot: this.getProjectRoot(),
            eventType: 'task_started',
            taskBookId,
            taskId: task.id,
            taskType: task.type,
            taskTitle: task.title,
            executionMode: (0, execution_metrics_1.inferPlannedExecutionMode)(task.type, Boolean(this.workerExecutor)),
            agentId: plannedAgentId,
        });
        console.log(`[TaskExecutor] 开始执行任务: ${task.title} (${task.type})`);
        try {
            // 根据任务类型调用不同的执行逻辑
            const dispatchResult = await this.dispatchTask(taskBookId, task);
            const actualWork = dispatchResult.actualWork;
            const executedBy = dispatchResult.executedBy || selectManualAgentId(task);
            this.manager.updateTaskStatus(taskBookId, task.id, 'done', actualWork);
            if (dispatchResult.workerExecution) {
                this.manager.logChange(taskBookId, task.id, 'modified', 'worker-executor applied: ' + dispatchResult.workerExecution.requestId, undefined, {
                    event: 'worker-executor',
                    action: 'applied',
                    requestId: dispatchResult.workerExecution.requestId,
                    agentId: dispatchResult.workerExecution.agentId,
                    worker: dispatchResult.workerExecution.worker,
                    completedAt: dispatchResult.workerExecution.completedAt,
                    artifacts: dispatchResult.artifacts,
                });
            }
            try {
                this.manager.updateTask(taskBookId, task.id, { executedBy });
            }
            catch (_j) {
                // updateTask ????????executedBy?????
            }
            this.recordCompletionHandoffs(taskBookId, task, executedBy, actualWork, dispatchResult.artifacts);
            this.lastRenderedPrompt = null;
            const result = {
                taskId: task.id,
                success: true,
                actualWork,
                duration: Date.now() - startTime,
            };
            (0, execution_metrics_1.recordExecutionMetric)({
                projectRoot: this.getProjectRoot(),
                eventType: 'task_completed',
                taskBookId,
                taskId: task.id,
                taskType: task.type,
                taskTitle: task.title,
                executionMode: (0, execution_metrics_1.inferCompletedExecutionMode)(task.type, executedBy),
                agentId: plannedAgentId,
                requestId: (_c = dispatchResult.workerExecution) === null || _c === void 0 ? void 0 : _c.requestId,
                worker: (_d = dispatchResult.workerExecution) === null || _d === void 0 ? void 0 : _d.worker,
                status: 'success',
                durationMs: result.duration,
            });
            (_f = (_e = this.config).onTaskComplete) === null || _f === void 0 ? void 0 : _f.call(_e, task, result);
            console.log(`[TaskExecutor] 任务完成: ${task.title} (by ${executedBy})`);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // 判断是否为可恢复的错误
            if (this.isRecoverableError(error)) {
                let blockedReason = errorMessage;
                if (/MANUAL_REQUIRED/i.test(errorMessage)) {
                    try {
                        blockedReason = this.ensureManualTaskAgentCall(taskBookId, task, errorMessage);
                    }
                    catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        blockedReason = `${errorMessage}\n(agent-call init failed: ${msg})`;
                    }
                    // 清除缓存的 renderedPrompt
                    this.lastRenderedPrompt = null;
                }
                // 标记为阻塞，等待用户介入
                this.manager.updateTaskStatus(taskBookId, task.id, 'blocked', undefined, blockedReason);
                (_h = (_g = this.config).onTaskBlocked) === null || _h === void 0 ? void 0 : _h.call(_g, task, blockedReason);
                const agentCallMeta = extractAgentCallMeta(blockedReason);
                (0, execution_metrics_1.recordExecutionMetric)({
                    projectRoot: this.getProjectRoot(),
                    eventType: 'task_blocked',
                    taskBookId,
                    taskId: task.id,
                    taskType: task.type,
                    taskTitle: task.title,
                    executionMode: (0, execution_metrics_1.inferBlockedExecutionMode)(task.type, blockedReason, Boolean(this.workerExecutor)),
                    agentId: plannedAgentId,
                    requestId: agentCallMeta === null || agentCallMeta === void 0 ? void 0 : agentCallMeta.requestId,
                    status: 'blocked',
                    durationMs: Date.now() - startTime,
                    blockedReasonCode: (0, execution_metrics_1.classifyBlockedReason)(blockedReason),
                    blockedReason: truncateMetricText(blockedReason),
                });
                return {
                    taskId: task.id,
                    success: false,
                    error: blockedReason,
                    duration: Date.now() - startTime,
                };
            }
            // 不可恢复的错误，保留为 pending 状态等待重试
            console.error(`[TaskExecutor] 任务执行出错: ${task.title}`, error);
            (0, execution_metrics_1.recordExecutionMetric)({
                projectRoot: this.getProjectRoot(),
                eventType: 'task_failed',
                taskBookId,
                taskId: task.id,
                taskType: task.type,
                taskTitle: task.title,
                executionMode: (0, execution_metrics_1.inferBlockedExecutionMode)(task.type, errorMessage, Boolean(this.workerExecutor)),
                agentId: plannedAgentId,
                status: 'failed',
                durationMs: Date.now() - startTime,
                blockedReasonCode: (0, execution_metrics_1.classifyBlockedReason)(errorMessage),
                blockedReason: truncateMetricText(errorMessage),
            });
            return {
                taskId: task.id,
                success: false,
                error: errorMessage,
                duration: Date.now() - startTime,
            };
        }
    }
    ensureManualTaskAgentCall(taskBookId, task, manualReason) {
        var _a, _b;
        const requestId = computeAgentCallRequestId(taskBookId, task.id, this.getCurrentTaskAttemptKey(taskBookId, task));
        const projectRoot = this.getProjectRoot();
        const promptPath = toPosixPath(`${AGENT_CALLS_DIR}/${requestId}.prompt.md`);
        const resultPath = toPosixPath(`${AGENT_CALLS_DIR}/${requestId}.result.json`);
        const promptAbsPath = this.resolveProjectPath(promptPath);
        const resultAbsPath = this.resolveProjectPath(resultPath);
        ensureDir(path.dirname(promptAbsPath));
        let agentId = selectManualAgentId(task);
        if (fs.existsSync(promptAbsPath)) {
            try {
                const existing = fs.readFileSync(promptAbsPath, 'utf-8');
                const parsedAgentId = tryExtractAgentIdFromPrompt(existing);
                if (parsedAgentId)
                    agentId = parsedAgentId;
            }
            catch (_c) {
                // ignore, fallback to selected agentId
            }
        }
        const meta = {
            requestId,
            agentId,
            kind: 'manual-task',
            taskBookId,
            taskId: task.id,
            promptPath,
            resultPath,
            createdAt: new Date().toISOString(),
        };
        const agentDef = loadAgentDefinition(projectRoot, agentId);
        const agentDefMissingNote = !agentDef
            ? `\n\n[agent-call] agent definition missing: expected ${(0, install_roots_1.listAgentDefinitionCandidatePaths)(projectRoot, agentId).map(filePath => path.relative(projectRoot, filePath).replace(/\\/g, '/')).join(' or ')}.`
            : '';
        // 获取 AgentRuntime 渲染的 prompt（如果可用）
        const runtimePrompt = this.lastRenderedPrompt;
        if (!fs.existsSync(promptAbsPath)) {
            const tb = this.manager.load(taskBookId);
            if (!tb)
                throw new Error(`TaskBook not found: ${taskBookId}`);
            const enrichedManualReason = `${manualReason}${agentDefMissingNote}`;
            const prompt = buildManualTaskPrompt({
                meta,
                taskBook: tb,
                task,
                manualReason: enrichedManualReason,
                agentDefinitionPath: (_a = agentDef === null || agentDef === void 0 ? void 0 : agentDef.path) !== null && _a !== void 0 ? _a : null,
                agentDefinition: (_b = agentDef === null || agentDef === void 0 ? void 0 : agentDef.content) !== null && _b !== void 0 ? _b : null,
                promptPath: meta.promptPath,
                resultPath: meta.resultPath,
                projectRoot,
                runtimePrompt: runtimePrompt !== null && runtimePrompt !== void 0 ? runtimePrompt : undefined,
            });
            fs.writeFileSync(promptAbsPath, prompt, 'utf-8');
            // Record creation in TaskBook changelog for auditability.
            this.manager.logChange(taskBookId, task.id, 'modified', `agent-call created: ${requestId}`, undefined, {
                event: 'agent-call',
                action: 'created',
                requestId,
                agentId,
                kind: meta.kind,
                createdAt: meta.createdAt,
                promptPath: meta.promptPath,
                resultPath: meta.resultPath,
            });
            (0, execution_metrics_1.recordExecutionMetric)({
                projectRoot: this.getProjectRoot(),
                eventType: 'agent_call_created',
                taskBookId,
                taskId: task.id,
                taskType: task.type,
                taskTitle: task.title,
                executionMode: 'agent-call',
                agentId,
                requestId,
                status: 'blocked',
                blockedReasonCode: (0, execution_metrics_1.classifyBlockedReason)(manualReason),
                blockedReason: truncateMetricText(manualReason),
            });
        }
        if (!fs.existsSync(resultAbsPath)) {
            // Pre-create empty placeholder? No: keep absent until external tool writes it.
        }
        return buildAgentCallBlockedReason(`${manualReason}${agentDefMissingNote}`, meta);
    }
    tryAutoApplyAgentCallResults(taskBookId, taskBook, allowedTypes, allowedTaskIds) {
        var _a, _b, _c;
        let applied = 0;
        for (const task of taskBook.tasks) {
            if (task.status !== 'blocked')
                continue;
            if (!allowedTypes.has(task.type))
                continue;
            if (allowedTaskIds && !allowedTaskIds.has(task.id))
                continue;
            const meta = extractAgentCallMeta(task.blockedReason);
            if (!meta)
                continue;
            const resultAbsPath = this.resolveProjectPath(meta.resultPath);
            if (!fs.existsSync(resultAbsPath))
                continue;
            let result;
            try {
                result = parseAgentCallResult(fs.readFileSync(resultAbsPath, 'utf-8'));
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.log(`[AgentCall] 解析失败: ${meta.requestId} ${msg}`);
                continue;
            }
            if (result.requestId !== meta.requestId) {
                console.log(`[AgentCall] requestId 不匹配: expected ${meta.requestId}, got ${result.requestId}`);
                continue;
            }
            if (result.status !== 'success') {
                const reason = (_b = (_a = result.error) === null || _a === void 0 ? void 0 : _a.message) !== null && _b !== void 0 ? _b : `status=${result.status}`;
                const status = result.status === 'blocked' ? 'blocked' : 'failed';
                const nextState = {
                    requestId: meta.requestId,
                    status,
                    completedAt: result.completedAt,
                    message: reason,
                };
                if (isSameAgentCallResultState(extractAgentCallResultState(task.blockedReason), nextState)) {
                    console.log(`[AgentCall] 已记录失败结果: ${meta.requestId} ${reason}`);
                    continue;
                }
                console.log(`[AgentCall] 记录失败结果: ${meta.requestId} ${reason}`);
                this.recordAgentCallFailure(taskBookId, task, meta, result, reason);
                applied += 1;
                continue;
            }
            let output;
            try {
                output = parseAgentTaskOutput(result.output);
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.log(`[AgentCall] output 无效: ${meta.requestId} ${msg}`);
                continue;
            }
            this.manager.updateTask(taskBookId, task.id, {
                status: 'done',
                actualWork: output.actualWork,
                blockedReason: '',
                executedBy: meta.agentId,
            });
            this.recordCompletionHandoffs(taskBookId, task, meta.agentId, output.actualWork, result.artifacts);
            this.manager.logChange(taskBookId, task.id, 'modified', `agent-call applied: ${meta.requestId}`, undefined, {
                event: 'agent-call',
                action: 'applied',
                requestId: meta.requestId,
                agentId: meta.agentId,
                kind: (_c = result.kind) !== null && _c !== void 0 ? _c : meta.kind,
                status: 'success',
                completedAt: result.completedAt,
                promptPath: meta.promptPath,
                resultPath: meta.resultPath,
                artifacts: result.artifacts,
            });
            (0, execution_metrics_1.recordExecutionMetric)({
                projectRoot: this.getProjectRoot(),
                eventType: 'agent_call_applied',
                taskBookId,
                taskId: task.id,
                taskType: task.type,
                taskTitle: task.title,
                executionMode: 'agent-call',
                agentId: meta.agentId,
                requestId: meta.requestId,
                status: 'success',
                durationMs: (0, execution_metrics_1.computeDurationMs)(meta.createdAt, result.completedAt),
                resumed: true,
            });
            applied += 1;
        }
        return applied;
    }
    /**
     * 分发任务到对应的 Agent
     *
     * 优先级：
     * 1. analysis 类型 → 直接执行脚本（structure-analyzer / module-mapper）
     * 2. 其他类型且 AgentRuntime 可用 → 通过 AgentRuntime 渲染 prompt
     * 3. AgentRuntime 不可用或返回 needs_human → 降级到 MANUAL_REQUIRED 文件协议
     */
    async dispatchTask(taskBookId, task) {
        if (task.type === 'analysis') {
            return { actualWork: await this.executeAnalysisTask(task) };
        }
        if (task.type === 'acceptance') {
            return { actualWork: await this.executeAcceptanceTask(task) };
        }
        if (this.runtime) {
            const agentId = selectManualAgentId(task);
            const agent = this.runtime.getAgent(agentId);
            if (agent) {
                const context = this.buildAgentContext(taskBookId, task);
                const result = this.runtime.invoke({ agentId, context });
                if (result.status === 'done' && result.renderedPrompt) {
                    this.lastRenderedPrompt = result.renderedPrompt;
                    const workerResult = this.tryDispatchWithWorker(taskBookId, task, agentId, context, result.renderedPrompt);
                    if (workerResult) {
                        return workerResult;
                    }
                    console.log('[TaskExecutor] AgentRuntime: ' + agentId + ' ?????prompt (' + result.renderedPrompt.length + ' ???)???????????');
                    throw new Error('MANUAL_REQUIRED: AgentRuntime ??? ' + agentId + ' ????????prompt????????AI ??????');
                }
                if (result.status === 'needs_human') {
                    console.log('[TaskExecutor] AgentRuntime: ' + agentId + ' ????????????????MANUAL_REQUIRED');
                    throw new Error('MANUAL_REQUIRED: ' + (result.humanReason || '??????????'));
                }
                if (result.status === 'error') {
                    console.log('[TaskExecutor] AgentRuntime: ' + agentId + ' ???????????? MANUAL_REQUIRED');
                    throw new Error('MANUAL_REQUIRED: AgentRuntime ??? - ' + result.error);
                }
            }
        }
        switch (task.type) {
            case 'design':
                return { actualWork: await this.executeDesignTask(task) };
            case 'test':
                return { actualWork: await this.executeTestTask(task) };
            case 'implement':
                return { actualWork: await this.executeImplementTask(task) };
            case 'refactor':
                return { actualWork: await this.executeImplementTask(task) };
            case 'review':
                return { actualWork: await this.executeReviewTask(task) };
            case 'build-fix':
                return { actualWork: await this.executeBuildFixTask(task) };
            case 'requirement':
            case 'prd':
                return { actualWork: await this.executePlanningTask(task) };
            default:
                throw new Error('??????????? ' + task.type);
        }
    }
    tryDispatchWithWorker(taskBookId, task, agentId, context, renderedPrompt) {
        if (!this.workerExecutor)
            return null;
        const requestId = computeAgentCallRequestId(taskBookId, task.id, task.startedAt);
        const workerResult = this.workerExecutor.execute({
            requestId,
            taskBookId,
            agentId,
            projectRoot: this.getProjectRoot(),
            prompt: renderedPrompt,
            task,
            context,
        });
        if (workerResult.status === 'success' && workerResult.actualWork) {
            console.log('[TaskExecutor] WorkerExecutor: ' + agentId + ' ????????? (' + this.workerExecutor.describe() + ')');
            this.lastRenderedPrompt = null;
            return {
                actualWork: workerResult.actualWork,
                executedBy: 'worker-executor:' + agentId,
                artifacts: workerResult.artifacts,
                workerExecution: {
                    requestId,
                    agentId,
                    worker: this.workerExecutor.describe(),
                    completedAt: workerResult.completedAt,
                },
            };
        }
        const reason = workerResult.error || ('status=' + workerResult.status);
        console.log('[TaskExecutor] WorkerExecutor: ' + agentId + ' ' + workerResult.status + '?????? MANUAL_REQUIRED (' + reason + ')');
        throw new Error('MANUAL_REQUIRED: WorkerExecutor(' + this.workerExecutor.describe() + ') ' + workerResult.status + ' - ' + reason);
    }
    /**
     * 构建 Agent 执行上下文
     */
    buildAgentContext(taskBookId, task) {
        var _a;
        const taskBook = this.manager.load(taskBookId);
        const projectRoot = this.getProjectRoot();
        const currentAgentId = selectManualAgentId(task);
        const incomingHandoffs = taskBook
            ? this.collectIncomingHandoffs(taskBook, task, currentAgentId)
            : [];
        const taskSnapshot = {
            id: task.id,
            title: task.title,
            type: task.type,
            description: task.actualWork || '',
            priority: task.priority,
            acceptanceCriteria: task.acceptanceCriteria || [],
            scope: task.scope,
            incomingHandoffs: incomingHandoffs.length > 0 ? incomingHandoffs : undefined,
        };
        const context = {
            taskBookId,
            task: taskSnapshot,
            projectRoot,
        };
        // 读取项目报告（如存在）
        const archReport = path.join(projectRoot, '.codebuddy/reports/architecture/latest.json');
        const modulesReport = path.join(projectRoot, '.codebuddy/reports/modules/latest.json');
        if (fs.existsSync(archReport) || fs.existsSync(modulesReport)) {
            context.reports = {};
            try {
                if (fs.existsSync(archReport)) {
                    context.reports.architecture = JSON.parse(fs.readFileSync(archReport, 'utf-8'));
                }
                if (fs.existsSync(modulesReport)) {
                    context.reports.modules = JSON.parse(fs.readFileSync(modulesReport, 'utf-8'));
                }
            }
            catch (_b) {
                // 报告解析失败不阻塞任务
            }
        }
        // 读取 scope 中指定的文件内容
        if (((_a = task.scope) === null || _a === void 0 ? void 0 : _a.files) && task.scope.files.length > 0) {
            context.relatedFiles = [];
            for (const filePath of task.scope.files.slice(0, 10)) { // 最多 10 个文件，避免上下文过大
                const absPath = path.resolve(projectRoot, filePath);
                if (fs.existsSync(absPath)) {
                    try {
                        const content = fs.readFileSync(absPath, 'utf-8');
                        if (content.length <= 50000) { // 单文件不超过 50KB
                            context.relatedFiles.push({ path: filePath, content });
                        }
                    }
                    catch (_c) {
                        // 读取失败不阻塞
                    }
                }
            }
        }
        return context;
    }
    /**
     * 执行分析任务
     */
    async executeAnalysisTask(task) {
        console.log(`[TaskExecutor] 执行分析任务: ${task.title}`);
        const moduleMapper = path.join(process.cwd(), '.codebuddy/scripts/module-mapper.js');
        const structureAnalyzer = path.join(process.cwd(), '.codebuddy/scripts/structure-analyzer.js');
        const ran = [];
        if (fs.existsSync(moduleMapper)) {
            const result = runNodeScript(moduleMapper, ['.', '--mode', 'summary', '--output', 'json']);
            if (!result.ok) {
                throw new Error(`分析失败(module-mapper): ${result.stderr || result.stdout}`);
            }
            ran.push('module-mapper');
        }
        if (fs.existsSync(structureAnalyzer)) {
            const result = runNodeScript(structureAnalyzer, ['.', '--mode', 'summary', '--output', 'json']);
            if (!result.ok) {
                throw new Error(`分析失败(structure-analyzer): ${result.stderr || result.stdout}`);
            }
            ran.push('structure-analyzer');
        }
        if (ran.length === 0) {
            throw new Error('MANUAL_REQUIRED: 未找到 .codebuddy/scripts/module-mapper.js 或 structure-analyzer.js，请先运行 codebuddy-loader 安装脚本。');
        }
        return `已完成分析（${ran.join(', ')}），报告已写入 .codebuddy/reports/`;
    }
    /**
     * 执行设计任务
     */
    async executeDesignTask(task) {
        console.log(`[TaskExecutor] 执行设计任务: ${task.title}`);
        const designAgentId = selectManualAgentId(task);
        if (designAgentId === 'system-overview-writer') {
            throw new Error(`MANUAL_REQUIRED: 需要 system-overview-writer Agent 生成系统概要设计文档：${task.title}`);
        }
        if (designAgentId === 'planner') {
            throw new Error(`MANUAL_REQUIRED: 需要 planner Agent 完成设计规划任务：${task.title}`);
        }
        throw new Error(`MANUAL_REQUIRED: 需要 ${designAgentId} Agent 完成设计任务：${task.title}`);
    }
    /**
     * 执行测试任务
     */
    async executeTestTask(task) {
        console.log(`[TaskExecutor] 执行测试任务: ${task.title}`);
        throw new Error(`MANUAL_REQUIRED: 需要 tdd-driver Agent 编写测试用例：${task.title}`);
    }
    /**
     * 执行实现任务
     */
    async executeImplementTask(task) {
        console.log(`[TaskExecutor] 执行实现任务: ${task.title}`);
        throw new Error(`MANUAL_REQUIRED: 需要 tdd-driver Agent 完成实现任务：${task.title}`);
    }
    /**
     * 执行审查任务
     */
    async executeReviewTask(task) {
        console.log(`[TaskExecutor] 执行审查任务: ${task.title}`);
        throw new Error(`MANUAL_REQUIRED: 需要 code-reviewer Agent 完成审查任务：${task.title}`);
    }
    /**
     * 执行构建修复任务
     */
    async executeBuildFixTask(task) {
        console.log(`[TaskExecutor] 执行构建修复任务: ${task.title}`);
        throw new Error(`MANUAL_REQUIRED: 需要 build-fix Agent 诊断并修复构建错误：${task.title}`);
    }
    /**
     * 执行需求/PRD 任务
     */
    async executePlanningTask(task) {
        console.log(`[TaskExecutor] 执行需求/PRD 任务: ${task.title}`);
        throw new Error(`MANUAL_REQUIRED: 需要 planner Agent 完成需求澄清或 PRD 生成：${task.title}`);
    }
    /**
     * 执行验收任务
     */
    async executeAcceptanceTask(task) {
        console.log(`[TaskExecutor] 执行验收任务: ${task.title}`);
        throw new Error(`MANUAL_REQUIRED: 需要人工验收确认：${task.title}`);
    }
    /**
     * 判断是否为可恢复的错误
     */
    isRecoverableError(error) {
        if (error instanceof Error) {
            // 这些错误类型需要用户介入
            const recoverablePatterns = [
                /missing.*file/i,
                /permission denied/i,
                /not found/i,
                /authentication/i,
                /authorization/i,
                /MANUAL_REQUIRED/i,
                /需要.*确认/,
                /缺少.*配置/,
            ];
            return recoverablePatterns.some(pattern => pattern.test(error.message));
        }
        return false;
    }
    /**
     * 暂停执行
     */
    pause() {
        console.log('[TaskExecutor] 暂停执行');
        this.isPaused = true;
    }
    /**
     * 恢复执行
     */
    async resume(taskBookId) {
        console.log('[TaskExecutor] 恢复执行');
        this.isPaused = false;
        return this.execute(taskBookId);
    }
    /**
     * 停止执行
     */
    stop() {
        console.log('[TaskExecutor] 停止执行');
        this.isRunning = false;
        this.isPaused = false;
    }
    /**
     * 跳过阻塞的任务
     */
    skipBlockedTask(taskBookId, taskId, reason) {
        const taskBook = this.manager.load(taskBookId);
        if (!taskBook)
            return null;
        const task = taskBook.tasks.find(t => t.id === taskId);
        if (!task || task.status !== 'blocked')
            return null;
        this.manager.updateTaskStatus(taskBookId, taskId, 'skipped');
        this.manager.logChange(taskBookId, taskId, 'modified', `用户跳过阻塞任务: ${reason}`, { status: 'blocked' }, { status: 'skipped' });
        return this.manager.load(taskBookId);
    }
    /**
     * 解决阻塞并继续
     */
    async resolveBlockedTask(taskBookId, taskId, resolution) {
        const taskBook = this.manager.load(taskBookId);
        if (!taskBook)
            return null;
        const task = taskBook.tasks.find(t => t.id === taskId);
        if (!task || task.status !== 'blocked')
            return null;
        // 重置为 pending 状态
        this.manager.updateTaskStatus(taskBookId, taskId, 'pending');
        this.manager.logChange(taskBookId, taskId, 'modified', `用户解决阻塞: ${resolution}`, { status: 'blocked', blockedReason: task.blockedReason }, { status: 'pending' });
        // 继续执行
        return this.resume(taskBookId);
    }
}
exports.TaskExecutor = TaskExecutor;
/**
 * 创建任务执行器
 */
function createTaskExecutor(manager, config) {
    return new TaskExecutor(manager, config);
}
function showHelp() {
    console.log(`
Task Executor - Workflow 驱动的任务执行器

用法:
  node .codebuddy/scripts/task-executor.js <taskBookId> [options]

选项:
  --workflow <path|auto> 指定 workflow 文件；auto 时启用自动选路
  --show-workflow-route 输出 workflow 路由理由
  --approve <gateId>    预先批准某个 gate（可重复）
  --max-parallel <n>    覆盖并行度（默认取 workflow.policies 或内置默认值）
  --tasks-only          不读取 workflow，直接执行所有任务（旧模式）
  -h, --help            显示帮助

说明:
  - workflow 早期主要用于约束/引导（产物、顺序、质量闸门），后期可扩展为强制编排引擎。
  - 若执行遇到 MANUAL_REQUIRED：将生成 .codebuddy/agent-calls/<requestId>.prompt.md，并把任务置为 blocked；当写回对应 result.json 后，重试执行会自动 apply 并继续。
`);
}
function printWorkflowRoute(details, showReasons) {
    console.log(`[Workflow] route: ${details.workflowId} (${details.mode}, confidence=${details.confidence}) -> ${details.workflowPath}`);
    console.log(`[Workflow] route report: ${details.reportPath}`);
    if (!showReasons)
        return;
    for (const reason of details.reasons) {
        console.log(`  - ${reason}`);
    }
    if (details.fallbackReason) {
        console.log(`  fallback: ${details.fallbackReason}`);
    }
}
function loadWorkflowSpec(workflowPath) {
    const raw = fs.readFileSync(workflowPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('workflow 文件不是有效的 JSON 对象');
    }
    const spec = parsed;
    if (!spec.id || !spec.version || !Array.isArray(spec.steps)) {
        throw new Error('workflow 缺少必填字段: id / version / steps');
    }
    for (const step of spec.steps) {
        if (!step || typeof step !== 'object') {
            throw new Error('workflow.steps 包含无效 step');
        }
        const s = step;
        if (!s.id || !s.type || !s.title) {
            throw new Error(`workflow step 缺少必填字段: id/type/title (${JSON.stringify(step)})`);
        }
    }
    return spec;
}
function topologicalSteps(spec) {
    var _a, _b, _c, _d, _e;
    if (!spec.edges || spec.edges.length === 0)
        return spec.steps;
    const stepMap = new Map();
    for (const step of spec.steps) {
        stepMap.set(step.id, step);
    }
    const inDegree = new Map();
    const adj = new Map();
    for (const step of spec.steps) {
        inDegree.set(step.id, 0);
        adj.set(step.id, []);
    }
    for (const e of spec.edges) {
        if (!stepMap.has(e.from) || !stepMap.has(e.to)) {
            throw new Error(`workflow.edges 引用不存在的 step: ${e.from} -> ${e.to}`);
        }
        adj.get(e.from).push(e.to);
        inDegree.set(e.to, ((_a = inDegree.get(e.to)) !== null && _a !== void 0 ? _a : 0) + 1);
    }
    const queue = [];
    for (const step of spec.steps) {
        if (((_b = inDegree.get(step.id)) !== null && _b !== void 0 ? _b : 0) === 0) {
            queue.push(step.id);
        }
    }
    const ordered = [];
    while (queue.length > 0) {
        const id = queue.shift();
        ordered.push(stepMap.get(id));
        for (const next of (_c = adj.get(id)) !== null && _c !== void 0 ? _c : []) {
            inDegree.set(next, ((_d = inDegree.get(next)) !== null && _d !== void 0 ? _d : 0) - 1);
            if (((_e = inDegree.get(next)) !== null && _e !== void 0 ? _e : 0) === 0) {
                queue.push(next);
            }
        }
    }
    if (ordered.length !== spec.steps.length) {
        throw new Error('workflow.edges 存在循环依赖，无法拓扑排序');
    }
    return ordered;
}
/**
 * 评估 WorkflowStep.skipWhen 条件。
 *
 * 支持格式：
 * - `no_tasks_of_type:<type1>,<type2>` — TaskBook 中无指定类型的 pending/in_progress 任务时返回 true
 *
 * 未识别的条件一律返回 false（不跳过）。
 */
function evaluateSkipWhen(skipWhen, taskBook) {
    if (!skipWhen)
        return false;
    const noTasksMatch = /^no_tasks_of_type:(.+)$/.exec(skipWhen.trim());
    if (noTasksMatch) {
        const types = new Set(noTasksMatch[1].split(',').map(t => t.trim()));
        const hasRelevantTasks = taskBook.tasks.some(t => types.has(t.type) && (t.status === 'pending' || t.status === 'in_progress'));
        return !hasRelevantTasks;
    }
    // 未识别的条件不跳过
    return false;
}
function getPolicyMaxParallel(spec) {
    const raw = spec.policies;
    const concurrency = raw === null || raw === void 0 ? void 0 : raw.concurrency;
    const maxParallel = concurrency === null || concurrency === void 0 ? void 0 : concurrency.maxParallelTasks;
    if (typeof maxParallel === 'number' && Number.isFinite(maxParallel) && maxParallel > 0) {
        return Math.floor(maxParallel);
    }
    return undefined;
}
function getPolicyConflictStrategy(spec) {
    const raw = spec.policies;
    const concurrency = raw === null || raw === void 0 ? void 0 : raw.concurrency;
    const cs = concurrency === null || concurrency === void 0 ? void 0 : concurrency.conflictStrategy;
    if (cs === 'allow' || cs === 'deny_same_file_set')
        return cs;
    return undefined;
}
function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function getPolicyBuildFix(spec) {
    const raw = spec.policies;
    const bf = raw === null || raw === void 0 ? void 0 : raw.buildFix;
    const defaults = { maxRounds: 3, retryFromStep: 'tdd_implement', escalateToHuman: true };
    if (!isPlainObject(bf))
        return defaults;
    const maxRounds = typeof bf.maxRounds === 'number' && Number.isFinite(bf.maxRounds) && bf.maxRounds > 0
        ? Math.floor(bf.maxRounds)
        : defaults.maxRounds;
    const retryFromStep = typeof bf.retryFromStep === 'string' && bf.retryFromStep.length > 0
        ? bf.retryFromStep
        : defaults.retryFromStep;
    const escalateToHuman = typeof bf.escalateToHuman === 'boolean'
        ? bf.escalateToHuman
        : defaults.escalateToHuman;
    return { maxRounds, retryFromStep, escalateToHuman };
}
function getPolicyBatching(spec) {
    const raw = spec.policies;
    const testing = raw === null || raw === void 0 ? void 0 : raw.testing;
    if (!isPlainObject(testing))
        return null;
    const batching = testing.batching;
    if (!isPlainObject(batching))
        return null;
    if (batching.strategy !== 'risk_tiered')
        return null;
    const defaults = {
        high: { maxFiles: 3, smokeEveryBatches: 1 },
        medium: { maxFiles: 10, smokeEveryBatches: 1 },
        low: { maxFiles: 25, smokeEveryBatches: 2 },
    };
    const riskTiersRaw = batching.riskTiers;
    if (!isPlainObject(riskTiersRaw)) {
        return { strategy: 'risk_tiered', riskTiers: defaults };
    }
    const parseTier = (tier, fallback) => {
        if (!isPlainObject(tier))
            return fallback;
        const maxFiles = typeof tier.maxFiles === 'number' && Number.isFinite(tier.maxFiles) && tier.maxFiles > 0
            ? Math.floor(tier.maxFiles)
            : fallback.maxFiles;
        const maxChangedLines = typeof tier.maxChangedLines === 'number' && Number.isFinite(tier.maxChangedLines) && tier.maxChangedLines > 0
            ? Math.floor(tier.maxChangedLines)
            : fallback.maxChangedLines;
        const smokeEveryBatches = typeof tier.smokeEveryBatches === 'number' && Number.isFinite(tier.smokeEveryBatches) && tier.smokeEveryBatches > 0
            ? Math.floor(tier.smokeEveryBatches)
            : fallback.smokeEveryBatches;
        return { maxFiles, maxChangedLines, smokeEveryBatches };
    };
    const parsed = {
        high: parseTier(riskTiersRaw.high, defaults.high),
        medium: parseTier(riskTiersRaw.medium, defaults.medium),
        low: parseTier(riskTiersRaw.low, defaults.low),
    };
    return { strategy: 'risk_tiered', riskTiers: parsed };
}
function inferRiskTier(taskBook, allowedTaskTypes) {
    const hasHighPriority = taskBook.tasks.some(t => t.status === 'pending'
        && allowedTaskTypes.has(t.type)
        && (t.priority === 'critical' || t.priority === 'high'));
    if (hasHighPriority)
        return 'high';
    switch (taskBook.taskType) {
        case 'refactoring':
        case 'debugging':
            return 'high';
        case 'code-review':
            return 'low';
        case 'testing':
            return 'medium';
        case 'new-feature':
        default:
            return 'medium';
    }
}
function priorityRank(priority) {
    switch (priority) {
        case 'critical':
            return 0;
        case 'high':
            return 1;
        case 'medium':
            return 2;
        case 'low':
        default:
            return 3;
    }
}
function getScopedFiles(task) {
    var _a, _b;
    const files = (_b = (_a = task.scope) === null || _a === void 0 ? void 0 : _a.files) !== null && _b !== void 0 ? _b : [];
    return files.filter(f => typeof f === 'string' && f.length > 0);
}
function selectBatchTasks(runnable, maxFiles) {
    if (runnable.length === 0)
        return [];
    if (maxFiles <= 0)
        return runnable.slice(0, 1);
    if (runnable.length <= 1)
        return runnable.slice(0, 1);
    const ordered = [...runnable].sort((a, b) => {
        const p = priorityRank(a.priority) - priorityRank(b.priority);
        if (p !== 0)
            return p;
        const fa = getScopedFiles(a).length;
        const fb = getScopedFiles(b).length;
        if (fa !== fb)
            return fa - fb;
        return a.id.localeCompare(b.id);
    });
    const selected = [];
    const usedFiles = new Set();
    let hasGlobal = false;
    for (const task of ordered) {
        const files = getScopedFiles(task);
        if (files.length === 0) {
            if (selected.length === 0) {
                selected.push(task);
                hasGlobal = true;
            }
            continue;
        }
        if (hasGlobal)
            continue;
        const newFiles = [];
        for (const f of files) {
            if (!usedFiles.has(f))
                newFiles.push(f);
        }
        if (usedFiles.size + newFiles.length > maxFiles)
            continue;
        for (const f of newFiles)
            usedFiles.add(f);
        selected.push(task);
    }
    return selected.length > 0 ? selected : ordered.slice(0, 1);
}
function getGateById(spec, gateId) {
    if (!spec.gates)
        return null;
    const found = spec.gates.find(g => g.id === gateId);
    return found !== null && found !== void 0 ? found : null;
}
function getStepGates(spec, step) {
    var _a;
    const gateIds = (_a = step.gates) !== null && _a !== void 0 ? _a : [];
    const gates = [];
    for (const id of gateIds) {
        const gate = getGateById(spec, id);
        if (!gate) {
            throw new Error(`step.gates 引用不存在的 gate: ${id}`);
        }
        gates.push(gate);
    }
    return gates;
}
const GATE_EVIDENCE_OUTPUT_LIMIT = 20000;
function safeTimestampForFilename() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
function sanitizeForFilename(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}
function toPosixPath(value) {
    return value.replace(/\\/g, '/');
}
function truncateMetricText(value, maxLength = 500) {
    const trimmed = String(value || '').trim();
    if (trimmed.length <= maxLength)
        return trimmed;
    return `${trimmed.slice(0, maxLength)}...`;
}
function computeAgentCallRequestId(taskBookId, taskId, attemptKey) {
    const normalizedAttemptKey = (attemptKey || 'initial').trim() || 'initial';
    const hash = (0, crypto_1.createHash)('sha1').update(`${taskBookId}:${taskId}:${normalizedAttemptKey}`).digest('hex').slice(0, 10);
    return `req-${sanitizeForFilename(taskId)}-${hash}`;
}
function buildAgentCallBlockedReason(message, meta) {
    const payload = {
        requestId: meta.requestId,
        agentId: meta.agentId,
        kind: meta.kind,
        taskBookId: meta.taskBookId,
        taskId: meta.taskId,
        promptPath: meta.promptPath,
        resultPath: meta.resultPath,
        createdAt: meta.createdAt,
    };
    return `${message}\n${AGENT_CALL_MARKER} ${JSON.stringify(payload)}`;
}
function appendAgentCallResultState(blockedReason, state) {
    const base = stripAgentCallResultState(blockedReason);
    const lines = base ? base.split(/\r?\n/) : [];
    const summary = `Agent result (${state.status}): ${state.message}`;
    if (summary && !lines.some(line => line.trim() === summary)) {
        lines.push(summary);
    }
    lines.push(`${AGENT_CALL_RESULT_MARKER} ${JSON.stringify(state)}`);
    return lines.join('\n').trim();
}
function stripAgentCallResultState(blockedReason) {
    if (!blockedReason)
        return '';
    return blockedReason
        .split(/\r?\n/)
        .filter(line => !line.trim().startsWith(AGENT_CALL_RESULT_MARKER))
        .join('\n')
        .trim();
}
function extractAgentCallResultState(blockedReason) {
    if (!blockedReason)
        return null;
    const lines = blockedReason.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line || !line.startsWith(AGENT_CALL_RESULT_MARKER)) {
            continue;
        }
        const jsonText = line.slice(AGENT_CALL_RESULT_MARKER.length).trim();
        if (!jsonText)
            return null;
        try {
            const parsed = JSON.parse(jsonText);
            if (!parsed || typeof parsed !== 'object')
                return null;
            if (typeof parsed.requestId !== 'string' || !parsed.requestId.trim())
                return null;
            if (parsed.status !== 'failed' && parsed.status !== 'blocked')
                return null;
            if (typeof parsed.message !== 'string' || !parsed.message.trim())
                return null;
            return {
                requestId: parsed.requestId,
                status: parsed.status,
                completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : undefined,
                message: parsed.message,
            };
        }
        catch (_a) {
            return null;
        }
    }
    return null;
}
function isSameAgentCallResultState(left, right) {
    if (!left)
        return false;
    return left.requestId === right.requestId
        && left.status === right.status
        && (left.completedAt || '') === (right.completedAt || '')
        && left.message === right.message;
}
function extractAgentCallMeta(blockedReason) {
    if (!blockedReason)
        return null;
    const lines = blockedReason.split(/\r?\n/);
    let metaLine = null;
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line)
            continue;
        if (line.startsWith(AGENT_CALL_MARKER)) {
            metaLine = line;
            break;
        }
    }
    if (!metaLine)
        return null;
    const jsonText = metaLine.slice(AGENT_CALL_MARKER.length).trim();
    if (!jsonText)
        return null;
    let raw;
    try {
        raw = JSON.parse(jsonText);
    }
    catch (_a) {
        return null;
    }
    if (!raw || typeof raw !== 'object')
        return null;
    const obj = raw;
    const requestId = obj.requestId;
    const agentId = obj.agentId;
    const kind = obj.kind;
    const taskBookId = obj.taskBookId;
    const taskId = obj.taskId;
    const promptPath = obj.promptPath;
    const resultPath = obj.resultPath;
    const createdAt = obj.createdAt;
    if (typeof requestId !== 'string' || !requestId)
        return null;
    if (typeof agentId !== 'string' || !agentId)
        return null;
    if (typeof taskBookId !== 'string')
        return null;
    if (typeof taskId !== 'string')
        return null;
    if (typeof promptPath !== 'string' || !promptPath)
        return null;
    if (typeof resultPath !== 'string' || !resultPath)
        return null;
    return {
        requestId,
        agentId,
        kind: kind === 'planner' || kind === 'manual-task' ? kind : undefined,
        taskBookId,
        taskId,
        promptPath: toPosixPath(promptPath),
        resultPath: toPosixPath(resultPath),
        createdAt: typeof createdAt === 'string' ? createdAt : '',
    };
}
function parseAgentCallResult(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('result.json 必须是 JSON object');
    }
    const obj = parsed;
    const requestId = obj.requestId;
    const kind = obj.kind;
    const status = obj.status;
    if (typeof requestId !== 'string' || !requestId) {
        throw new Error('result.json 缺少 requestId');
    }
    if (status !== 'success' && status !== 'failed' && status !== 'blocked') {
        throw new Error("result.json.status 必须是 'success' | 'failed' | 'blocked'");
    }
    const output = obj.output;
    const artifacts = obj.artifacts;
    const error = obj.error;
    const completedAt = obj.completedAt;
    return {
        requestId,
        kind: kind === 'planner' || kind === 'manual-task' ? kind : undefined,
        status,
        output,
        artifacts: Array.isArray(artifacts) ? artifacts : undefined,
        error: (typeof error === 'object' && error ? error : undefined),
        completedAt: typeof completedAt === 'string' ? completedAt : undefined,
    };
}
function parseAgentTaskOutput(output) {
    if (!output || typeof output !== 'object') {
        throw new Error('output 必须是 object，并包含 actualWork');
    }
    const obj = output;
    const actualWork = obj.actualWork;
    if (typeof actualWork !== 'string' || !actualWork.trim()) {
        throw new Error('output.actualWork 必须是非空字符串');
    }
    return { actualWork: actualWork.trim() };
}
function readTextFileIfExists(filePath) {
    if (!fs.existsSync(filePath))
        return null;
    return fs.readFileSync(filePath, 'utf-8');
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
function loadAgentDefinition(projectRoot, agentId) {
    const candidates = (0, install_roots_1.listAgentDefinitionCandidatePaths)(projectRoot, agentId);
    for (const p of candidates) {
        const content = readTextFileIfExists(p);
        if (content)
            return { path: p, content };
    }
    return null;
}
/**
 * 加载 Agent 的 prompt 模板（用于弱模型引导）
 *
 * 根据任务类型选择对应的 prompt 模板文件：
 * - test → tdd-driver/prompts/red.md
 * - implement → tdd-driver/prompts/green.md
 * - refactor → tdd-driver/prompts/refactor.md
 * - review → code-reviewer/prompts/review.md
 * - build-fix → build-fix/prompts/diagnose-fix.md
 */
function loadAgentPromptTemplate(projectRoot, agentId, taskType) {
    const promptFileMap = {
        'tdd-driver': {
            'test': 'red.md',
            'implement': 'green.md',
            'refactor': 'refactor.md',
        },
        'code-reviewer': {
            'review': 'review.md',
        },
        'build-fix': {
            'build-fix': 'diagnose-fix.md',
        },
        'bug-investigator': {
            'analysis': 'investigate.md',
        },
        'system-overview-writer': {
            'design': 'execute.md',
        },
    };
    const agentPrompts = promptFileMap[agentId];
    if (!agentPrompts)
        return null;
    const fileName = agentPrompts[taskType];
    if (!fileName)
        return null;
    const candidates = (0, install_roots_1.listAgentPromptCandidatePaths)(projectRoot, agentId, fileName);
    for (const p of candidates) {
        const content = readTextFileIfExists(p);
        if (content)
            return content;
    }
    return null;
}
function buildManualTaskPrompt(args) {
    var _a;
    const agentVersion = args.agentDefinition ? extractAgentVersion(args.agentDefinition) : undefined;
    const header = {
        requestId: args.meta.requestId,
        agentId: args.meta.agentId,
        agentVersion,
        taskBookId: args.taskBook.id,
        taskBookRevision: typeof args.taskBook.revision === 'number' ? args.taskBook.revision : 0,
        taskId: args.task.id,
        taskType: args.task.type,
        timestamp: new Date().toISOString(),
        promptPath: args.promptPath,
        resultPath: args.resultPath,
    };
    const agentDefinition = (_a = args.agentDefinition) !== null && _a !== void 0 ? _a : '(missing AGENT.md)';
    const agentDefinitionHint = args.agentDefinitionPath ? `source: ${args.agentDefinitionPath}` : 'source: (not found)';
    const schemaExample = {
        requestId: args.meta.requestId,
        kind: 'manual-task',
        status: 'success',
        output: {
            actualWork: '简要记录你完成了什么、改了哪些关键点、如何验证（命令/结果）。',
        },
        completedAt: new Date().toISOString(),
    };
    return [
        '# Agent Call: manual-task',
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
        ...(() => {
            const promptTemplate = loadAgentPromptTemplate(args.projectRoot, args.meta.agentId, args.task.type);
            if (!promptTemplate)
                return [];
            return [
                '## Prompt Template (弱模型引导)',
                '```md',
                promptTemplate.trimEnd(),
                '```',
                '',
            ];
        })(),
        '## Context: TaskBook JSON',
        '```json',
        JSON.stringify(args.taskBook, null, 2),
        '```',
        '',
        '## Context: Task JSON',
        '```json',
        JSON.stringify(args.task, null, 2),
        '```',
        '',
        // 自动收集的上下文（文件内容、引用追踪、关联测试、Git 历史）
        ...(() => {
            try {
                const ctx = (0, context_collector_1.collectContext)(args.task, args.projectRoot);
                const md = (0, context_collector_1.formatContextAsMarkdown)(ctx);
                if (md)
                    return [md];
            }
            catch (_a) {
                // 上下文收集失败不阻塞 prompt 生成
            }
            return [];
        })(),
        // AgentRuntime 渲染的高质量 prompt（如果可用）
        ...(() => {
            if (!args.runtimePrompt)
                return [];
            return [
                '## AgentRuntime Rendered Prompt',
                '',
                '> 以下是 AgentRuntime 基于 Agent 定义和任务上下文自动渲染的执行 prompt。',
                '> AI 工具应优先参考此 prompt 执行任务，它包含了完整的上下文和指令。',
                '',
                args.runtimePrompt.trimEnd(),
                '',
            ];
        })(),
        '## Reason (why this was blocked)',
        '```text',
        args.manualReason.trimEnd(),
        '```',
        '',
        '## Instructions',
        '请完成上述 Task，并把执行结果写回 result.json。',
        '',
        '约束：',
        '- 允许修改代码/运行命令/补充测试/进行审查等（按 Task.type 决定）。',
        '- 输出必须是纯 JSON（不要 Markdown/解释性文本）。',
        '- status=success 时必须提供 output.actualWork（非空字符串）。',
        "- kind 字段推荐：'manual-task'（用于更强校验/诊断）。",
        '',
        `写入目标：${args.resultPath}`,
        '',
        '示例（必须是 JSON，不要包裹 Markdown）：',
        '```json',
        JSON.stringify(schemaExample, null, 2),
        '```',
        '',
    ].join('\n');
}
function readPackageJsonScripts() {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath))
        return null;
    try {
        const raw = fs.readFileSync(pkgPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const scripts = parsed === null || parsed === void 0 ? void 0 : parsed.scripts;
        if (typeof scripts !== 'object' || scripts === null || Array.isArray(scripts))
            return {};
        const out = {};
        for (const [k, v] of Object.entries(scripts)) {
            if (typeof v === 'string')
                out[k] = v;
        }
        return out;
    }
    catch (_a) {
        return null;
    }
}
function writeGateEvidence(taskBookId, stepId, gateId, payload) {
    try {
        const safeTaskBookId = sanitizeForFilename(taskBookId);
        const outDir = path.join(process.cwd(), '.codebuddy', 'reports', 'gates', safeTaskBookId);
        ensureDir(outDir);
        const fileName = `${safeTimestampForFilename()}.${sanitizeForFilename(stepId)}.${sanitizeForFilename(gateId)}.json`;
        const absPath = path.join(outDir, fileName);
        fs.writeFileSync(absPath, JSON.stringify(payload, null, 2), 'utf-8');
        return toPosixPath(path.relative(process.cwd(), absPath));
    }
    catch (_a) {
        return undefined;
    }
}
async function runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, context) {
    var _a, _b, _c;
    const results = [];
    const gates = getStepGates(spec, step);
    for (const gate of gates) {
        const required = gate.required !== false;
        const startedAt = new Date().toISOString();
        if (approved.has(gate.id)) {
            const evidencePath = writeGateEvidence(taskBookId, step.id, gate.id, {
                schemaVersion: 1,
                event: 'gate',
                gateId: gate.id,
                gateType: gate.type,
                stepId: step.id,
                required,
                approved: true,
                passed: true,
                skipped: false,
                startedAt,
                endedAt: new Date().toISOString(),
                commandRuns: [],
                ...(context !== null && context !== void 0 ? context : {}),
            });
            const r = { gateId: gate.id, passed: true, message: 'approved by user', evidencePath };
            results.push(r);
            gateResults.set(gate.id, r);
            manager.logChange(taskBookId, null, 'modified', `gate approved: ${gate.id}`, undefined, {
                event: 'gate',
                gateId: gate.id,
                stepId: step.id,
                passed: true,
                approved: true,
                evidencePath,
                ...(context !== null && context !== void 0 ? context : {}),
            });
            continue;
        }
        if (gate.type !== 'checks') {
            if (required) {
                const evidencePath = writeGateEvidence(taskBookId, step.id, gate.id, {
                    schemaVersion: 1,
                    event: 'gate',
                    gateId: gate.id,
                    gateType: gate.type,
                    stepId: step.id,
                    required,
                    approved: false,
                    passed: false,
                    skipped: false,
                    startedAt,
                    endedAt: new Date().toISOString(),
                    failureReason: `unsupported gate.type: ${gate.type}`,
                    ...(context !== null && context !== void 0 ? context : {}),
                });
                const r = { gateId: gate.id, passed: false, message: `unsupported gate.type: ${gate.type}`, evidencePath };
                results.push(r);
                gateResults.set(gate.id, r);
                manager.logChange(taskBookId, null, 'modified', `gate failed: ${gate.id}`, undefined, {
                    event: 'gate',
                    gateId: gate.id,
                    stepId: step.id,
                    passed: false,
                    evidencePath,
                    ...(context !== null && context !== void 0 ? context : {}),
                });
                return { ok: false, gateResults: results };
            }
            const skipReason = `unsupported gate.type: ${gate.type}`;
            const evidencePath = writeGateEvidence(taskBookId, step.id, gate.id, {
                schemaVersion: 1,
                event: 'gate',
                gateId: gate.id,
                gateType: gate.type,
                stepId: step.id,
                required,
                approved: false,
                passed: true,
                skipped: true,
                skipReason,
                startedAt,
                endedAt: new Date().toISOString(),
                ...(context !== null && context !== void 0 ? context : {}),
            });
            const r = { gateId: gate.id, passed: true, skipped: true, message: `skipped: ${skipReason}`, evidencePath };
            results.push(r);
            gateResults.set(gate.id, r);
            manager.logChange(taskBookId, null, 'modified', `gate skipped: ${gate.id}`, undefined, {
                event: 'gate',
                gateId: gate.id,
                stepId: step.id,
                passed: true,
                skipped: true,
                skipReason,
                evidencePath,
                ...(context !== null && context !== void 0 ? context : {}),
            });
            continue;
        }
        const params = (_a = gate.params) !== null && _a !== void 0 ? _a : {};
        const rawCommands = Array.isArray(params.commands)
            ? params.commands.filter((c) => typeof c === 'string' && c.trim().length > 0)
            : [];
        const npmScripts = Array.isArray(params.npmScripts)
            ? params.npmScripts.filter((s) => typeof s === 'string' && s.trim().length > 0)
            : [];
        const failIfMissing = typeof params.failIfMissing === 'boolean' ? Boolean(params.failIfMissing) : required;
        const writeEvidence = typeof params.writeEvidence === 'boolean' ? Boolean(params.writeEvidence) : true;
        const budgetMinutes = typeof (params === null || params === void 0 ? void 0 : params.budgetMinutes) === 'number'
            ? Number(params.budgetMinutes)
            : undefined;
        const scripts = npmScripts.length > 0 ? readPackageJsonScripts() : null;
        const missingScripts = [];
        const scriptCommands = [];
        if (npmScripts.length > 0) {
            if (scripts === null) {
                missingScripts.push(...npmScripts);
            }
            else {
                for (const script of npmScripts) {
                    if (scripts[script])
                        scriptCommands.push(`npm run ${script}`);
                    else
                        missingScripts.push(script);
                }
            }
        }
        const commands = [...rawCommands, ...scriptCommands];
        const commandRuns = [];
        if (missingScripts.length > 0 && failIfMissing) {
            const message = `missing npm scripts: ${missingScripts.join(', ')}`;
            const evidencePath = writeEvidence ? writeGateEvidence(taskBookId, step.id, gate.id, {
                schemaVersion: 1,
                event: 'gate',
                gateId: gate.id,
                gateType: gate.type,
                stepId: step.id,
                required,
                approved: false,
                passed: false,
                skipped: false,
                startedAt,
                endedAt: new Date().toISOString(),
                budgetMinutes,
                commands,
                missingScripts,
                commandRuns: [],
                failureReason: message,
                ...(context !== null && context !== void 0 ? context : {}),
            }) : undefined;
            const r = { gateId: gate.id, passed: false, message, evidencePath };
            results.push(r);
            gateResults.set(gate.id, r);
            manager.logChange(taskBookId, null, 'modified', `gate failed: ${gate.id}`, undefined, {
                event: 'gate',
                gateId: gate.id,
                stepId: step.id,
                passed: false,
                budgetMinutes,
                missingScripts,
                evidencePath,
                ...(context !== null && context !== void 0 ? context : {}),
            });
            console.log(`[Gate] ${required ? '❌' : '⚠️'} ${gate.id} 失败: ${message}`);
            if (required)
                return { ok: false, gateResults: results };
            continue;
        }
        if (commands.length === 0) {
            if (required) {
                const message = `gate ${gate.id} 缺少 commands / npmScripts`;
                const evidencePath = writeEvidence ? writeGateEvidence(taskBookId, step.id, gate.id, {
                    schemaVersion: 1,
                    event: 'gate',
                    gateId: gate.id,
                    gateType: gate.type,
                    stepId: step.id,
                    required,
                    approved: false,
                    passed: false,
                    skipped: false,
                    startedAt,
                    endedAt: new Date().toISOString(),
                    budgetMinutes,
                    commands,
                    missingScripts,
                    commandRuns: [],
                    failureReason: message,
                    ...(context !== null && context !== void 0 ? context : {}),
                }) : undefined;
                const r = { gateId: gate.id, passed: false, message, evidencePath };
                results.push(r);
                gateResults.set(gate.id, r);
                manager.logChange(taskBookId, null, 'modified', `gate failed: ${gate.id}`, undefined, {
                    event: 'gate',
                    gateId: gate.id,
                    stepId: step.id,
                    passed: false,
                    budgetMinutes,
                    missingScripts,
                    evidencePath,
                    ...(context !== null && context !== void 0 ? context : {}),
                });
                console.log(`[Gate] ❌ ${gate.id} 失败: ${message}`);
                return { ok: false, gateResults: results };
            }
            const skipReason = missingScripts.length > 0
                ? `npm scripts not found: ${missingScripts.join(', ')}`
                : 'empty commands';
            const evidencePath = writeEvidence ? writeGateEvidence(taskBookId, step.id, gate.id, {
                schemaVersion: 1,
                event: 'gate',
                gateId: gate.id,
                gateType: gate.type,
                stepId: step.id,
                required,
                approved: false,
                passed: true,
                skipped: true,
                skipReason,
                startedAt,
                endedAt: new Date().toISOString(),
                budgetMinutes,
                missingScripts,
                commandRuns: [],
                ...(context !== null && context !== void 0 ? context : {}),
            }) : undefined;
            const r = { gateId: gate.id, passed: true, skipped: true, message: `skipped: ${skipReason}`, evidencePath };
            results.push(r);
            gateResults.set(gate.id, r);
            manager.logChange(taskBookId, null, 'modified', `gate skipped: ${gate.id}`, undefined, {
                event: 'gate',
                gateId: gate.id,
                stepId: step.id,
                passed: true,
                skipped: true,
                skipReason,
                budgetMinutes,
                missingScripts,
                evidencePath,
                ...(context !== null && context !== void 0 ? context : {}),
            });
            console.log(`[Gate] ⏭ ${gate.id} skipped: ${skipReason}`);
            continue;
        }
        let failedCommand = null;
        for (const cmd of commands) {
            console.log(`[Gate] ▶ ${gate.id}: ${cmd}`);
            const r = runShellCommand(cmd);
            commandRuns.push({ command: cmd, ok: r.ok, code: r.code, durationMs: r.durationMs });
            if (!r.ok) {
                failedCommand = {
                    command: cmd,
                    stdout: r.stdout.slice(0, GATE_EVIDENCE_OUTPUT_LIMIT),
                    stderr: r.stderr.slice(0, GATE_EVIDENCE_OUTPUT_LIMIT),
                };
                break;
            }
        }
        const passed = failedCommand === null;
        const evidencePath = writeEvidence ? writeGateEvidence(taskBookId, step.id, gate.id, {
            schemaVersion: 1,
            event: 'gate',
            gateId: gate.id,
            gateType: gate.type,
            stepId: step.id,
            required,
            approved: false,
            passed,
            skipped: false,
            startedAt,
            endedAt: new Date().toISOString(),
            budgetMinutes,
            commands,
            missingScripts,
            commandRuns,
            failedCommand,
            ...(context !== null && context !== void 0 ? context : {}),
        }) : undefined;
        const r = passed
            ? { gateId: gate.id, passed: true, evidencePath }
            : { gateId: gate.id, passed: false, message: `command failed: ${(_b = failedCommand === null || failedCommand === void 0 ? void 0 : failedCommand.command) !== null && _b !== void 0 ? _b : ''}`, evidencePath };
        results.push(r);
        gateResults.set(gate.id, r);
        manager.logChange(taskBookId, null, 'modified', `gate ${passed ? 'passed' : 'failed'}: ${gate.id}`, undefined, {
            event: 'gate',
            gateId: gate.id,
            stepId: step.id,
            passed,
            budgetMinutes,
            commandRuns,
            missingScripts,
            evidencePath,
            stderr: passed ? undefined : (_c = failedCommand === null || failedCommand === void 0 ? void 0 : failedCommand.stderr) === null || _c === void 0 ? void 0 : _c.slice(0, 2000),
            ...(context !== null && context !== void 0 ? context : {}),
        });
        console.log(`[Gate] ${passed ? '✅' : required ? '❌' : '⚠️'} ${gate.id} ${passed ? '通过' : '失败'}${!required && !passed ? '（optional）' : ''}`);
        if (!passed && required)
            return { ok: false, gateResults: results };
    }
    return { ok: true, gateResults: results };
}
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
function runNodeScript(scriptPath, args) {
    var _a, _b;
    const res = (0, child_process_1.spawnSync)(process.execPath, [scriptPath, ...args], {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
    });
    return {
        ok: res.status === 0,
        stdout: (_a = res.stdout) !== null && _a !== void 0 ? _a : '',
        stderr: (_b = res.stderr) !== null && _b !== void 0 ? _b : '',
        code: res.status,
    };
}
function runShellCommand(command) {
    var _a, _b;
    const start = Date.now();
    const res = (0, child_process_1.spawnSync)(command, [], {
        cwd: process.cwd(),
        shell: true,
        encoding: 'utf-8',
        stdio: 'pipe',
    });
    const durationMs = Date.now() - start;
    return {
        ok: res.status === 0,
        stdout: (_a = res.stdout) !== null && _a !== void 0 ? _a : '',
        stderr: (_b = res.stderr) !== null && _b !== void 0 ? _b : '',
        code: res.status,
        durationMs,
    };
}
function findStepIndexByType(steps, type) {
    return steps.findIndex(step => step.type === type);
}
function findReviewReflowStepIndex(steps, taskBook, currentIndex) {
    const hasPendingBuildFix = taskBook.tasks.some(task => task.status === 'pending' && task.type === 'build-fix');
    if (hasPendingBuildFix) {
        const buildFixIndex = findStepIndexByType(steps, 'build_and_fix');
        if (buildFixIndex >= 0 && buildFixIndex < currentIndex) {
            return buildFixIndex;
        }
    }
    const hasPendingImplementLike = taskBook.tasks.some(task => task.status === 'pending'
        && (task.type === 'test' || task.type === 'implement' || task.type === 'refactor'));
    if (hasPendingImplementLike) {
        const implementIndex = findStepIndexByType(steps, 'tdd_implement');
        if (implementIndex >= 0 && implementIndex < currentIndex) {
            return implementIndex;
        }
    }
    return -1;
}
function logWorkflowRoutingDecision(manager, taskBookId, details) {
    const reason = details.mode === 'reused'
        ? `workflow routing reused: ${details.workflowId}`
        : (details.mode === 'fallback'
            ? `workflow routing fallback: ${details.workflowId}`
            : `workflow routing selected: ${details.workflowId}`);
    manager.logChange(taskBookId, null, 'modified', reason, undefined, {
        event: 'workflow-routing',
        workflowId: details.workflowId,
        workflowPath: details.workflowPath,
        mode: details.mode,
        confidence: details.confidence,
        reportPath: details.reportPath,
        fallbackReason: details.fallbackReason,
        reusedFromTaskBook: details.reusedFromTaskBook,
        reasons: details.reasons,
    });
}
async function runWorkflow(taskBookId, options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    const manager = new taskbook_manager_1.TaskBookManager(process.cwd());
    const taskBook = manager.load(taskBookId);
    if (!taskBook) {
        throw new Error(`TaskBook not found: ${taskBookId}`);
    }
    if (taskBook.status !== 'confirmed' && taskBook.status !== 'executing') {
        throw new Error(`TaskBook 必须是 confirmed/executing 才能执行。当前状态: ${taskBook.status}`);
    }
    let workflowRouteDetails;
    const shouldAutoRoute = typeof options.workflowPath === 'string' && options.workflowPath.trim().toLowerCase() === 'auto';
    const workflowPath = shouldAutoRoute
        ? (() => {
            const selection = (0, workflow_routing_selection_1.selectWorkflowForTaskBook)({
                projectRoot: process.cwd(),
                taskBook,
                explicitWorkflowPath: 'auto',
            });
            workflowRouteDetails = selection.details;
            logWorkflowRoutingDecision(manager, taskBookId, selection.details);
            (0, execution_metrics_1.recordWorkflowRoutingMetric)({
                projectRoot: process.cwd(),
                taskBook,
                decision: selection.decision,
            });
            printWorkflowRoute(selection.details, Boolean(options.showWorkflowRoute));
            return selection.workflowPath;
        })()
        : ((_a = options.workflowPath) !== null && _a !== void 0 ? _a : path.join(process.cwd(), '.codebuddy/workflows/default.workflow.json'));
    if (!fs.existsSync(workflowPath)) {
        throw new Error(`workflow 文件不存在: ${workflowPath}`);
    }
    const spec = loadWorkflowSpec(workflowPath);
    const orderedSteps = topologicalSteps(spec);
    const approved = (_b = options.approvedGates) !== null && _b !== void 0 ? _b : new Set();
    const gateResults = new Map();
    const maxParallelFromPolicy = getPolicyMaxParallel(spec);
    const maxParallel = (_d = (_c = options.maxParallelTasks) !== null && _c !== void 0 ? _c : maxParallelFromPolicy) !== null && _d !== void 0 ? _d : 1;
    const conflictStrategy = (_e = getPolicyConflictStrategy(spec)) !== null && _e !== void 0 ? _e : 'allow';
    // 开始执行
    manager.updateStatus(taskBookId, 'executing');
    manager.logChange(taskBookId, null, 'modified', `开始执行 workflow: ${spec.id}@${spec.version}`, { workflowPath }, { workflowId: spec.id });
    const executor = new TaskExecutor(manager, { maxParallel, runtime: createDefaultRuntime() });
    const buildFixPolicy = getPolicyBuildFix(spec);
    let buildFixRetryCount = 0;
    let stepIdx = 0;
    while (stepIdx < orderedSteps.length) {
        const step = orderedSteps[stepIdx];
        console.log(`\n[Workflow] ▶ ${step.id}: ${step.title} (${step.type})`);
        // 条件跳过：评估 skipWhen
        const currentForSkip = manager.load(taskBookId);
        if (currentForSkip && evaluateSkipWhen(step.skipWhen, currentForSkip)) {
            console.log(`[Workflow] ⏭ ${step.id}: 条件跳过 (${step.skipWhen})`);
            manager.logChange(taskBookId, null, 'modified', `workflow step skipped: ${step.id} (${step.skipWhen})`);
            stepIdx++;
            continue;
        }
        if (step.type === 'analyze_project') {
            // 使用 analyzer 生成 reports
            const moduleMapper = path.join(process.cwd(), '.codebuddy/scripts/module-mapper.js');
            const structureAnalyzer = path.join(process.cwd(), '.codebuddy/scripts/structure-analyzer.js');
            if (fs.existsSync(moduleMapper)) {
                const r = runNodeScript(moduleMapper, ['.', '--mode', 'summary', '--output', 'json']);
                if (!r.ok)
                    throw new Error(`module-mapper 执行失败: ${r.stderr || r.stdout}`);
            }
            if (fs.existsSync(structureAnalyzer)) {
                const r = runNodeScript(structureAnalyzer, ['.', '--mode', 'summary', '--output', 'json']);
                if (!r.ok)
                    throw new Error(`structure-analyzer 执行失败: ${r.stderr || r.stdout}`);
            }
            manager.logChange(taskBookId, null, 'modified', '已生成项目结构/模块图谱 reports', undefined, {
                reports: ['.codebuddy/reports/architecture/latest.json', '.codebuddy/reports/modules/latest.json'],
            });
            stepIdx++;
            continue;
        }
        if (step.type === 'create_taskbook') {
            // workflow 允许作为规范存在；此处不自动生成/修改 TaskBook
            manager.logChange(taskBookId, null, 'modified', 'workflow step: create_taskbook (no-op, TaskBook 已存在)');
            stepIdx++;
            continue;
        }
        if (step.type === 'requirement_and_prd') {
            // 需求澄清与 PRD 生成：记录步骤，实际由 prd Skill 或人工完成
            manager.logChange(taskBookId, null, 'modified', 'workflow step: requirement_and_prd (需求澄清与 PRD 生成)');
            const prdTasks = ((_g = (_f = manager.load(taskBookId)) === null || _f === void 0 ? void 0 : _f.tasks) !== null && _g !== void 0 ? _g : []).filter(t => t.status === 'pending' && (t.type === 'requirement' || t.type === 'prd'));
            if (prdTasks.length > 0) {
                const result = await executor.executeTasks(taskBookId, {
                    allowedTaskTypes: ['requirement', 'prd'],
                    maxParallel,
                    conflictStrategy,
                });
                if (result.status !== 'completed') {
                    console.log(`[Workflow] requirement_and_prd 未完成: ${result.status} ${(_h = result.message) !== null && _h !== void 0 ? _h : ''}`);
                    return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
                }
            }
            stepIdx++;
            continue;
        }
        if (step.type === 'tdd_implement') {
            const allowedTaskTypes = new Set(['test', 'implement', 'refactor', 'analysis', 'design']);
            const batching = getPolicyBatching(spec);
            const hasStepGates = Array.isArray(step.gates) && step.gates.length > 0;
            if (!batching) {
                const result = await executor.executeTasks(taskBookId, {
                    allowedTaskTypes: Array.from(allowedTaskTypes),
                    maxParallel,
                    conflictStrategy,
                });
                if (result.status !== 'completed') {
                    console.log(`[Workflow] implement_tasks 未完成: ${result.status} ${(_j = result.message) !== null && _j !== void 0 ? _j : ''}`);
                    return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
                }
                if (hasStepGates) {
                    const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults);
                    if (!ok) {
                        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
                    }
                }
                stepIdx++;
                continue;
            }
            const riskTier = inferRiskTier((_k = manager.load(taskBookId)) !== null && _k !== void 0 ? _k : taskBook, allowedTaskTypes);
            const tier = batching.riskTiers[riskTier];
            const maxFiles = tier.maxFiles;
            const smokeEveryBatches = tier.smokeEveryBatches;
            let batchesSinceGate = 0;
            let batchIndex = 0;
            while (true) {
                const current = manager.load(taskBookId);
                if (!current) {
                    return { taskBook: null, gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
                }
                const pendingAllowed = current.tasks.filter(t => t.status === 'pending' && allowedTaskTypes.has(t.type));
                const blockedAllowed = current.tasks.filter(t => t.status === 'blocked' && allowedTaskTypes.has(t.type));
                if (pendingAllowed.length === 0) {
                    // If there are no tasks, still run step gates once (keeps compatibility with old test_smoke step).
                    if (hasStepGates && batchIndex === 0) {
                        const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
                            eventContext: 'no_tasks',
                            riskTier,
                        });
                        if (!ok)
                            return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
                    }
                    if (blockedAllowed.length > 0) {
                        console.log(`[Workflow] implement_tasks 存在阻塞任务（${blockedAllowed.length}）`);
                        return { taskBook: current, gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
                    }
                    break;
                }
                const completedTaskIds = new Set(current.tasks
                    .filter(t => t.status === 'done' || t.status === 'skipped')
                    .map(t => t.id));
                const runnable = pendingAllowed.filter(t => t.dependencies.every(depId => completedTaskIds.has(depId)));
                if (runnable.length === 0) {
                    console.log('[Workflow] implement_tasks 没有可执行任务（等待依赖完成）');
                    return { taskBook: current, gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
                }
                const batchTasks = selectBatchTasks(runnable, maxFiles);
                batchIndex += 1;
                manager.logChange(taskBookId, null, 'modified', `batch start: ${step.id} #${batchIndex}`, undefined, {
                    event: 'batch',
                    stepId: step.id,
                    batchIndex,
                    riskTier,
                    maxFiles,
                    taskIds: batchTasks.map(t => t.id),
                });
                const result = await executor.executeTasks(taskBookId, {
                    allowedTaskTypes: Array.from(allowedTaskTypes),
                    maxParallel,
                    conflictStrategy,
                    allowedTaskIds: batchTasks.map(t => t.id),
                });
                manager.logChange(taskBookId, null, 'modified', `batch end: ${step.id} #${batchIndex} (${result.status})`, undefined, {
                    event: 'batch',
                    stepId: step.id,
                    batchIndex,
                    status: result.status,
                    taskIds: batchTasks.map(t => t.id),
                });
                if (result.status !== 'completed') {
                    console.log(`[Workflow] implement_tasks batch 未完成: ${result.status} ${(_l = result.message) !== null && _l !== void 0 ? _l : ''}`);
                    return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
                }
                batchesSinceGate += 1;
                const pendingLeft = ((_o = (_m = manager.load(taskBookId)) === null || _m === void 0 ? void 0 : _m.tasks) !== null && _o !== void 0 ? _o : []).filter(t => t.status === 'pending' && allowedTaskTypes.has(t.type)).length;
                const shouldRunGates = hasStepGates && (batchesSinceGate >= smokeEveryBatches || pendingLeft === 0);
                if (shouldRunGates) {
                    const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
                        eventContext: 'batch_gate',
                        batchIndex,
                        riskTier,
                    });
                    if (!ok)
                        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
                    batchesSinceGate = 0;
                }
            }
            stepIdx++;
            continue;
        }
        if (step.type === 'build_and_fix') {
            // 构建验证与修复：先执行 build-fix 类型任务，再运行 gates
            const buildFixTasks = ((_q = (_p = manager.load(taskBookId)) === null || _p === void 0 ? void 0 : _p.tasks) !== null && _q !== void 0 ? _q : []).filter(t => t.status === 'pending' && t.type === 'build-fix');
            if (buildFixTasks.length > 0) {
                const result = await executor.executeTasks(taskBookId, {
                    allowedTaskTypes: ['build-fix'],
                    maxParallel,
                    conflictStrategy,
                });
                if (result.status !== 'completed') {
                    console.log(`[Workflow] build_and_fix 任务未完成: ${result.status} ${(_r = result.message) !== null && _r !== void 0 ? _r : ''}`);
                    return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
                }
            }
            const gateRun = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
                eventContext: 'build_and_fix_gate',
            });
            const failedGate = [...gateRun.gateResults].reverse().find(result => !result.passed);
            if (!gateRun.ok) {
                const nextRetryCount = buildFixRetryCount + 1;
                appendBuildFixFailureHandoffs(manager, taskBookId, 'qa_fail', failedGate, nextRetryCount, buildFixPolicy.maxRounds);
                buildFixRetryCount = nextRetryCount;
                const retryTargetId = buildFixPolicy.retryFromStep;
                const retryTargetIdx = orderedSteps.findIndex(s => s.id === retryTargetId);
                if (retryTargetIdx >= 0 && buildFixRetryCount < buildFixPolicy.maxRounds) {
                    console.log(`[Workflow] ⟲ 构建失败，回滚到 ${retryTargetId}（第 ${buildFixRetryCount}/${buildFixPolicy.maxRounds} 次重试）`);
                    manager.logChange(taskBookId, null, 'modified', `build_and_fix gate 失败，回滚到 ${retryTargetId}（重试 ${buildFixRetryCount}/${buildFixPolicy.maxRounds}）`, undefined, { event: 'build_fix_retry', retryCount: buildFixRetryCount, retryFromStep: retryTargetId });
                    stepIdx = retryTargetIdx;
                    continue;
                }
                if (buildFixPolicy.escalateToHuman) {
                    appendBuildFixFailureHandoffs(manager, taskBookId, 'escalation', failedGate, buildFixRetryCount, buildFixPolicy.maxRounds);
                    console.log(`[Workflow] ⛔ 构建修复已达最大重试次数（${buildFixPolicy.maxRounds}），需要人工介入`);
                    manager.logChange(taskBookId, null, 'modified', `build_and_fix 达到最大重试次数 ${buildFixPolicy.maxRounds}，升级为人工处理`, undefined, { event: 'build_fix_escalate', retryCount: buildFixRetryCount });
                }
                return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
            }
            // gate 通过，重置重试计数
            buildFixRetryCount = 0;
            stepIdx++;
            continue;
        }
        if (step.type === 'run_tests') {
            const tasksResult = await executor.executeTasks(taskBookId, { allowedTaskTypes: ['test'], maxParallel, conflictStrategy });
            if (tasksResult.status !== 'completed') {
                console.log(`[Workflow] test 任务未完成: ${tasksResult.status} ${(_s = tasksResult.message) !== null && _s !== void 0 ? _s : ''}`);
                return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
            }
            const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
                eventContext: 'run_tests_gate',
            });
            if (!ok)
                return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
            stepIdx++;
            continue;
        }
        if (step.type === 'code_review') {
            const tasksResult = await executor.executeTasks(taskBookId, { allowedTaskTypes: ['review'], maxParallel, conflictStrategy });
            if (tasksResult.status !== 'completed') {
                const current = manager.load(taskBookId);
                const reflowIdx = current ? findReviewReflowStepIndex(orderedSteps, current, stepIdx) : -1;
                if ((tasksResult.status === 'waiting' || tasksResult.status === 'blocked') && reflowIdx >= 0) {
                    const reflowStep = orderedSteps[reflowIdx];
                    console.log(`[Workflow] ↩ review 阶段检测到返工任务，回流到 ${reflowStep.id}`);
                    manager.logChange(taskBookId, null, 'modified', `review reflow -> ${reflowStep.id}`, undefined, {
                        event: 'review_reflow',
                        fromStepId: step.id,
                        toStepId: reflowStep.id,
                        resultStatus: tasksResult.status,
                        message: tasksResult.message,
                    });
                    stepIdx = reflowIdx;
                    continue;
                }
                console.log(`[Workflow] review 任务未完成: ${tasksResult.status} ${(_t = tasksResult.message) !== null && _t !== void 0 ? _t : ''}`);
                return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
            }
            const gates = getStepGates(spec, step);
            for (const gate of gates) {
                if (approved.has(gate.id)) {
                    gateResults.set(gate.id, { gateId: gate.id, passed: true, message: 'approved by user' });
                    continue;
                }
                if (gate.required === false) {
                    continue;
                }
                // review gate 先保持人工批准，后续可接入 lint/typecheck 等自动化
                gateResults.set(gate.id, { gateId: gate.id, passed: false, message: 'manual review required' });
                console.log(`[Gate] ⏸ ${gate.id} 需要人工审查。可使用 --approve ${gate.id} 继续。`);
                return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
            }
            stepIdx++;
            continue;
        }
        if (step.type === 'acceptance_and_archive') {
            const current = manager.load(taskBookId);
            if (!current)
                throw new Error(`TaskBook not found: ${taskBookId}`);
            const allDone = current.tasks.every(t => t.status === 'done' || t.status === 'skipped');
            if (!allDone) {
                console.log('[Workflow] 仍有未完成任务，无法验收归档。');
                return { taskBook: current, gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
            }
            const acceptanceGateRun = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
                eventContext: 'acceptance_gate',
            });
            if (!acceptanceGateRun.ok) {
                return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
            }
            // required gates must be passed
            const requiredGates = ((_u = spec.gates) !== null && _u !== void 0 ? _u : []).filter(g => g.required !== false);
            const failedRequired = requiredGates.filter(g => { var _a; return !((_a = gateResults.get(g.id)) === null || _a === void 0 ? void 0 : _a.passed) && !approved.has(g.id); });
            if (failedRequired.length > 0) {
                console.log(`[Workflow] 仍有未通过的质量闸门: ${failedRequired.map(g => g.id).join(', ')}`);
                return { taskBook: current, gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
            }
            // 生成验收报告并归档
            const report = manager.generateAcceptanceReport(taskBookId);
            if (report) {
                const outDir = path.join(process.cwd(), '.codebuddy/reports/taskbooks');
                ensureDir(outDir);
                const outPath = path.join(outDir, `${taskBookId}.acceptance.json`);
                fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
                console.log(`[Workflow] ✅ 已生成验收报告: .codebuddy/reports/taskbooks/${taskBookId}.acceptance.json`);
            }
            manager.updateStatus(taskBookId, 'completed');
            console.log('[Workflow] ✅ TaskBook 已完成并归档到 history');
            return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
        }
        console.log(`[Workflow] ⚠ 未识别的 step.type: ${step.type}（跳过）`);
        stepIdx++;
    }
    return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
}
/**
 * 创建默认的 AgentRuntime 实例
 * 优先使用 install.json 记录的 active agents root，其次回退到 legacy `.codebuddy/agents/` 和内置 `agents/`
 */
function createDefaultRuntime() {
    const cwd = process.cwd();
    const existingCandidateRoots = (0, install_roots_1.getProjectAgentRootCandidates)(cwd)
        .map(relativeRoot => ({
        relativeRoot,
        absoluteRoot: path.join(cwd, relativeRoot),
    }))
        .filter(candidate => fs.existsSync(candidate.absoluteRoot) && fs.statSync(candidate.absoluteRoot).isDirectory());
    if (existingCandidateRoots.length === 0) {
        return undefined;
    }
    try {
        const [primaryRoot, fallbackRoot] = existingCandidateRoots;
        const runtime = (0, agent_runtime_1.createAgentRuntime)({
            projectRoot: cwd,
            agentsDir: primaryRoot.relativeRoot,
            fallbackAgentsDir: fallbackRoot === null || fallbackRoot === void 0 ? void 0 : fallbackRoot.relativeRoot,
            verbose: false,
        });
        runtime.loadAll();
        return runtime;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`[TaskExecutor] AgentRuntime 初始化跳过: ${msg}`);
        return undefined;
    }
}
function parseCliArgs(args) {
    const parsed = {
        help: false,
        taskBookId: null,
        workflowPath: undefined,
        approvedGates: new Set(),
        maxParallel: undefined,
        tasksOnly: false,
        showWorkflowRoute: false,
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            parsed.help = true;
            continue;
        }
        if (arg === '--workflow' && args[i + 1]) {
            parsed.workflowPath = args[++i];
            continue;
        }
        if (arg === '--approve' && args[i + 1]) {
            parsed.approvedGates.add(args[++i]);
            continue;
        }
        if (arg === '--max-parallel' && args[i + 1]) {
            parsed.maxParallel = parseInt(args[++i], 10);
            continue;
        }
        if (arg === '--tasks-only') {
            parsed.tasksOnly = true;
            continue;
        }
        if (arg === '--show-workflow-route') {
            parsed.showWorkflowRoute = true;
            continue;
        }
        if (!arg.startsWith('-') && !parsed.taskBookId) {
            parsed.taskBookId = arg;
        }
    }
    return parsed;
}
async function main() {
    var _a, _b;
    const args = process.argv.slice(2);
    const parsed = parseCliArgs(args);
    if (parsed.help || !parsed.taskBookId) {
        showHelp();
        process.exit(parsed.taskBookId ? 0 : 1);
    }
    if (parsed.tasksOnly) {
        const manager = new taskbook_manager_1.TaskBookManager(process.cwd());
        const executor = new TaskExecutor(manager, { maxParallel: (_a = parsed.maxParallel) !== null && _a !== void 0 ? _a : DEFAULT_CONFIG.maxParallel, runtime: createDefaultRuntime() });
        const result = await executor.executeTasks(parsed.taskBookId, { maxParallel: parsed.maxParallel });
        if (result.status === 'completed') {
            manager.updateStatus(parsed.taskBookId, 'completed');
            process.exit(0);
        }
        console.error(`[TaskExecutor] 未完成: ${result.status} ${(_b = result.message) !== null && _b !== void 0 ? _b : ''}`);
        process.exit(2);
    }
    try {
        const { taskBook } = await runWorkflow(parsed.taskBookId, {
            workflowPath: parsed.workflowPath,
            approvedGates: parsed.approvedGates,
            maxParallelTasks: parsed.maxParallel,
            showWorkflowRoute: parsed.showWorkflowRoute,
        });
        if ((taskBook === null || taskBook === void 0 ? void 0 : taskBook.status) === 'completed') {
            process.exit(0);
        }
        console.log('[Workflow] ⏸ 未完成（可能存在 blocked/待人工 gate），请处理后重试。');
        process.exit(2);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[Workflow] Fatal Error: ${message}`);
        process.exit(1);
    }
}
if ((0, cli_entry_1.isDirectCliEntry)('task-executor.js')) {
    main().catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[Workflow] Fatal Error: ${message}`);
        process.exit(1);
    });
}
