"use strict";
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
exports.recordExecutionMetric = recordExecutionMetric;
exports.loadExecutionMetricsSummary = loadExecutionMetricsSummary;
exports.getExecutionMetricsPaths = getExecutionMetricsPaths;
exports.recordWorkflowRoutingMetric = recordWorkflowRoutingMetric;
exports.classifyBlockedReason = classifyBlockedReason;
exports.inferPlannedExecutionMode = inferPlannedExecutionMode;
exports.inferBlockedExecutionMode = inferBlockedExecutionMode;
exports.inferCompletedExecutionMode = inferCompletedExecutionMode;
exports.computeDurationMs = computeDurationMs;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const METRICS_SCHEMA_VERSION = '1.0.0';
function recordExecutionMetric(input) {
    const projectRoot = input.projectRoot || process.cwd();
    const metricsPaths = getExecutionMetricsPaths(projectRoot);
    ensureMetricsDir(metricsPaths.dir);
    const event = {
        ...input,
        schemaVersion: METRICS_SCHEMA_VERSION,
        recordedAt: input.recordedAt || new Date().toISOString(),
    };
    delete event.projectRoot;
    fs.appendFileSync(metricsPaths.eventsFile, `${JSON.stringify(event)}\n`, 'utf-8');
    const summary = loadExecutionMetricsSummary(projectRoot);
    applyEvent(summary, event);
    summary.generatedAt = event.recordedAt;
    summary.lastEventAt = event.recordedAt;
    fs.writeFileSync(metricsPaths.summaryFile, JSON.stringify(summary, null, 2), 'utf-8');
    return event;
}
function loadExecutionMetricsSummary(projectRoot = process.cwd()) {
    const summaryPath = path.join(projectRoot, '.codebuddy', 'reports', 'metrics', 'latest-summary.json');
    if (!fs.existsSync(summaryPath)) {
        return createEmptySummary(projectRoot);
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        return normalizeSummary(parsed, projectRoot);
    }
    catch (_a) {
        return createEmptySummary(projectRoot);
    }
}
function getExecutionMetricsPaths(projectRoot = process.cwd()) {
    return {
        dir: path.join(projectRoot, '.codebuddy', 'reports', 'metrics'),
        eventsFile: path.join(projectRoot, '.codebuddy', 'reports', 'metrics', 'execution-events.jsonl'),
        summaryFile: path.join(projectRoot, '.codebuddy', 'reports', 'metrics', 'latest-summary.json'),
    };
}
function recordWorkflowRoutingMetric(params) {
    const eventType = params.decision.mode === 'reused'
        ? 'workflow_route_reused'
        : (params.decision.mode === 'fallback'
            ? 'workflow_route_fallback'
            : 'workflow_route_selected');
    return recordExecutionMetric({
        projectRoot: params.projectRoot,
        eventType,
        recordedAt: params.recordedAt,
        taskBookId: params.taskBook.id,
        workflowId: params.decision.selectedWorkflowId,
        workflowPath: params.decision.selectedWorkflowPath,
        routeMode: params.decision.mode,
        routeConfidence: params.decision.confidence,
    });
}
function classifyBlockedReason(reason) {
    const text = String(reason || '').trim().toLowerCase();
    if (!text)
        return 'unknown';
    if (text.includes('workerexecutor(') || text.includes('worker spawn failed') || text.includes('worker exited')) {
        return 'worker_execution';
    }
    if (text.includes('agentruntime'))
        return 'agent_runtime';
    if (text.includes('manual_required'))
        return 'manual_required';
    if (text.includes('acceptance') || text.includes('人工验收'))
        return 'manual_acceptance';
    if (text.includes('module-mapper.js') || text.includes('structure-analyzer.js'))
        return 'missing_analysis_script';
    return 'other';
}
function inferPlannedExecutionMode(taskType, hasWorkerExecutor) {
    if (taskType === 'analysis')
        return 'script';
    if (taskType === 'acceptance')
        return 'manual';
    return hasWorkerExecutor ? 'worker' : 'agent-runtime';
}
function inferBlockedExecutionMode(taskType, errorMessage, hasWorkerExecutor) {
    const text = errorMessage.toLowerCase();
    if (text.includes('workerexecutor(') || text.includes('worker spawn failed') || text.includes('worker exited')) {
        return 'worker';
    }
    if (text.includes('agentruntime'))
        return 'agent-runtime';
    if (text.includes('[agent-call]') || text.includes('agent-call'))
        return 'agent-call';
    if (taskType === 'analysis')
        return 'script';
    if (taskType === 'acceptance')
        return 'manual';
    return hasWorkerExecutor ? 'worker' : 'unknown';
}
function inferCompletedExecutionMode(taskType, executedBy) {
    if (executedBy === null || executedBy === void 0 ? void 0 : executedBy.startsWith('worker-executor:'))
        return 'worker';
    if (taskType === 'analysis')
        return 'script';
    if (taskType === 'acceptance')
        return 'manual';
    return 'unknown';
}
function computeDurationMs(startedAt, completedAt) {
    if (!startedAt || !completedAt)
        return undefined;
    const start = Date.parse(startedAt);
    const end = Date.parse(completedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
        return undefined;
    return end - start;
}
function ensureMetricsDir(metricsDir) {
    fs.mkdirSync(metricsDir, { recursive: true });
}
function createEmptySummary(projectRoot) {
    return {
        schemaVersion: METRICS_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        projectRoot,
        lastEventAt: null,
        totals: {
            started: 0,
            completed: 0,
            blocked: 0,
            failed: 0,
            resumed: 0,
            agentCallsCreated: 0,
            agentCallsApplied: 0,
            workerExecutions: 0,
            workflowRoutesSelected: 0,
            workflowRoutesReused: 0,
            workflowRoutesFallback: 0,
            totalDurationMs: 0,
            averageDurationMs: 0,
        },
        byTaskType: {},
        byExecutionMode: {},
        blockedReasons: {},
        workflowRoutesById: {},
        workflowRoutesByMode: {},
    };
}
function normalizeSummary(raw, projectRoot) {
    var _a;
    const base = createEmptySummary(projectRoot);
    return {
        schemaVersion: METRICS_SCHEMA_VERSION,
        generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : base.generatedAt,
        projectRoot,
        lastEventAt: typeof raw.lastEventAt === 'string' ? raw.lastEventAt : null,
        totals: {
            ...base.totals,
            ...((_a = raw.totals) !== null && _a !== void 0 ? _a : {}),
        },
        byTaskType: normalizeAggregateMap(raw.byTaskType),
        byExecutionMode: normalizeAggregateMap(raw.byExecutionMode),
        blockedReasons: normalizeCounterMap(raw.blockedReasons),
        workflowRoutesById: normalizeCounterMap(raw.workflowRoutesById),
        workflowRoutesByMode: normalizeCounterMap(raw.workflowRoutesByMode),
    };
}
function normalizeAggregateMap(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return {};
    const result = {};
    for (const [key, value] of Object.entries(raw)) {
        result[key] = normalizeAggregate(value);
    }
    return result;
}
function normalizeCounterMap(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return {};
    const result = {};
    for (const [key, value] of Object.entries(raw)) {
        result[key] = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }
    return result;
}
function normalizeAggregate(raw) {
    const record = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw
        : {};
    return {
        started: typeof record.started === 'number' ? record.started : 0,
        completed: typeof record.completed === 'number' ? record.completed : 0,
        blocked: typeof record.blocked === 'number' ? record.blocked : 0,
        failed: typeof record.failed === 'number' ? record.failed : 0,
        totalDurationMs: typeof record.totalDurationMs === 'number' ? record.totalDurationMs : 0,
        averageDurationMs: typeof record.averageDurationMs === 'number' ? record.averageDurationMs : 0,
    };
}
function applyEvent(summary, event) {
    const taskTypeAggregate = event.taskType ? ensureAggregate(summary.byTaskType, event.taskType) : null;
    const modeAggregate = event.executionMode ? ensureAggregate(summary.byExecutionMode, event.executionMode) : null;
    switch (event.eventType) {
        case 'task_started':
            if (!taskTypeAggregate)
                return;
            summary.totals.started += 1;
            taskTypeAggregate.started += 1;
            if (modeAggregate)
                modeAggregate.started += 1;
            break;
        case 'task_completed':
            if (!taskTypeAggregate)
                return;
            summary.totals.completed += 1;
            taskTypeAggregate.completed += 1;
            if (modeAggregate)
                modeAggregate.completed += 1;
            if (event.executionMode === 'worker') {
                summary.totals.workerExecutions += 1;
            }
            applyDuration(summary, taskTypeAggregate, modeAggregate, event.durationMs);
            break;
        case 'task_blocked':
            if (!taskTypeAggregate)
                return;
            summary.totals.blocked += 1;
            taskTypeAggregate.blocked += 1;
            if (modeAggregate)
                modeAggregate.blocked += 1;
            if (event.blockedReasonCode) {
                summary.blockedReasons[event.blockedReasonCode] = (summary.blockedReasons[event.blockedReasonCode] || 0) + 1;
            }
            break;
        case 'task_failed':
            if (!taskTypeAggregate)
                return;
            summary.totals.failed += 1;
            taskTypeAggregate.failed += 1;
            if (modeAggregate)
                modeAggregate.failed += 1;
            break;
        case 'agent_call_created':
            summary.totals.agentCallsCreated += 1;
            break;
        case 'agent_call_applied':
            if (!taskTypeAggregate)
                return;
            summary.totals.agentCallsApplied += 1;
            if (event.status === 'failed') {
                summary.totals.failed += 1;
                taskTypeAggregate.failed += 1;
                if (modeAggregate)
                    modeAggregate.failed += 1;
                break;
            }
            if (event.status === 'blocked') {
                summary.totals.blocked += 1;
                taskTypeAggregate.blocked += 1;
                if (modeAggregate)
                    modeAggregate.blocked += 1;
                if (event.blockedReasonCode) {
                    summary.blockedReasons[event.blockedReasonCode] = (summary.blockedReasons[event.blockedReasonCode] || 0) + 1;
                }
                break;
            }
            summary.totals.resumed += 1;
            summary.totals.completed += 1;
            taskTypeAggregate.completed += 1;
            if (modeAggregate)
                modeAggregate.completed += 1;
            applyDuration(summary, taskTypeAggregate, modeAggregate, event.durationMs);
            break;
        case 'workflow_route_selected':
            summary.totals.workflowRoutesSelected += 1;
            applyWorkflowRouteCounters(summary, event);
            break;
        case 'workflow_route_reused':
            summary.totals.workflowRoutesReused += 1;
            applyWorkflowRouteCounters(summary, event);
            break;
        case 'workflow_route_fallback':
            summary.totals.workflowRoutesFallback += 1;
            applyWorkflowRouteCounters(summary, event);
            break;
        default:
            return;
    }
}
function applyWorkflowRouteCounters(summary, event) {
    if (event.workflowId) {
        summary.workflowRoutesById[event.workflowId] = (summary.workflowRoutesById[event.workflowId] || 0) + 1;
    }
    if (event.routeMode) {
        summary.workflowRoutesByMode[event.routeMode] = (summary.workflowRoutesByMode[event.routeMode] || 0) + 1;
    }
}
function applyDuration(summary, taskTypeAggregate, modeAggregate, durationMs) {
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0)
        return;
    summary.totals.totalDurationMs += durationMs;
    summary.totals.averageDurationMs = summary.totals.completed > 0
        ? Math.round(summary.totals.totalDurationMs / summary.totals.completed)
        : 0;
    taskTypeAggregate.totalDurationMs += durationMs;
    taskTypeAggregate.averageDurationMs = taskTypeAggregate.completed > 0
        ? Math.round(taskTypeAggregate.totalDurationMs / taskTypeAggregate.completed)
        : 0;
    if (modeAggregate) {
        modeAggregate.totalDurationMs += durationMs;
        modeAggregate.averageDurationMs = modeAggregate.completed > 0
            ? Math.round(modeAggregate.totalDurationMs / modeAggregate.completed)
            : 0;
    }
}
function ensureAggregate(map, key) {
    if (!map[key]) {
        map[key] = {
            started: 0,
            completed: 0,
            blocked: 0,
            failed: 0,
            totalDurationMs: 0,
            averageDurationMs: 0,
        };
    }
    return map[key];
}
