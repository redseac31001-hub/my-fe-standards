import * as fs from 'fs';
import * as path from 'path';
import {
  TaskBook,
  TaskType,
  WorkflowRoutingDecision,
} from '../types';

const METRICS_SCHEMA_VERSION = '1.0.0';

type ExecutionMetricEventType =
  | 'task_started'
  | 'task_completed'
  | 'task_blocked'
  | 'task_failed'
  | 'agent_call_created'
  | 'agent_call_applied'
  | 'workflow_route_selected'
  | 'workflow_route_reused'
  | 'workflow_route_fallback';

type ExecutionMetricMode =
  | 'script'
  | 'worker'
  | 'agent-call'
  | 'manual'
  | 'agent-runtime'
  | 'unknown';

interface ExecutionMetricEvent {
  schemaVersion: string;
  eventType: ExecutionMetricEventType;
  recordedAt: string;
  taskBookId: string;
  taskId?: string;
  taskType?: TaskType;
  taskTitle?: string;
  executionMode?: ExecutionMetricMode;
  agentId?: string;
  requestId?: string;
  status?: 'success' | 'blocked' | 'failed';
  durationMs?: number;
  blockedReasonCode?: string;
  blockedReason?: string;
  worker?: string;
  resumed?: boolean;
  workflowId?: string;
  workflowPath?: string;
  routeMode?: WorkflowRoutingDecision['mode'];
  routeConfidence?: WorkflowRoutingDecision['confidence'];
}

interface ExecutionMetricAggregate {
  started: number;
  completed: number;
  blocked: number;
  failed: number;
  totalDurationMs: number;
  averageDurationMs: number;
}

interface ExecutionMetricsSummary {
  schemaVersion: string;
  generatedAt: string;
  projectRoot: string;
  lastEventAt: string | null;
  totals: {
    started: number;
    completed: number;
    blocked: number;
    failed: number;
    resumed: number;
    agentCallsCreated: number;
    agentCallsApplied: number;
    workerExecutions: number;
    workflowRoutesSelected: number;
    workflowRoutesReused: number;
    workflowRoutesFallback: number;
    totalDurationMs: number;
    averageDurationMs: number;
  };
  byTaskType: Record<string, ExecutionMetricAggregate>;
  byExecutionMode: Record<string, ExecutionMetricAggregate>;
  blockedReasons: Record<string, number>;
  workflowRoutesById: Record<string, number>;
  workflowRoutesByMode: Record<string, number>;
}

export type RecordExecutionMetricInput = Omit<ExecutionMetricEvent, 'schemaVersion' | 'recordedAt'> & {
  recordedAt?: string;
  projectRoot?: string;
};

export function recordExecutionMetric(input: RecordExecutionMetricInput): ExecutionMetricEvent {
  const projectRoot = input.projectRoot || process.cwd();
  const metricsPaths = getExecutionMetricsPaths(projectRoot);
  ensureMetricsDir(metricsPaths.dir);

  const event: ExecutionMetricEvent = {
    ...input,
    schemaVersion: METRICS_SCHEMA_VERSION,
    recordedAt: input.recordedAt || new Date().toISOString(),
  };
  delete (event as Partial<RecordExecutionMetricInput>).projectRoot;

  fs.appendFileSync(metricsPaths.eventsFile, `${JSON.stringify(event)}\n`, 'utf-8');

  const summary = loadExecutionMetricsSummary(projectRoot);
  applyEvent(summary, event);
  summary.generatedAt = event.recordedAt;
  summary.lastEventAt = event.recordedAt;
  fs.writeFileSync(metricsPaths.summaryFile, JSON.stringify(summary, null, 2), 'utf-8');

  return event;
}

export function loadExecutionMetricsSummary(projectRoot: string = process.cwd()): ExecutionMetricsSummary {
  const summaryPath = path.join(projectRoot, '.codebuddy', 'reports', 'metrics', 'latest-summary.json');
  if (!fs.existsSync(summaryPath)) {
    return createEmptySummary(projectRoot);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(summaryPath, 'utf-8')) as Partial<ExecutionMetricsSummary>;
    return normalizeSummary(parsed, projectRoot);
  } catch {
    return createEmptySummary(projectRoot);
  }
}

export function getExecutionMetricsPaths(projectRoot: string = process.cwd()): {
  dir: string;
  eventsFile: string;
  summaryFile: string;
} {
  return {
    dir: path.join(projectRoot, '.codebuddy', 'reports', 'metrics'),
    eventsFile: path.join(projectRoot, '.codebuddy', 'reports', 'metrics', 'execution-events.jsonl'),
    summaryFile: path.join(projectRoot, '.codebuddy', 'reports', 'metrics', 'latest-summary.json'),
  };
}

export function recordWorkflowRoutingMetric(params: {
  projectRoot: string;
  taskBook: Pick<TaskBook, 'id'>;
  decision: WorkflowRoutingDecision;
  recordedAt?: string;
}): ExecutionMetricEvent {
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

export function classifyBlockedReason(reason: string | undefined): string {
  const text = String(reason || '').trim().toLowerCase();
  if (!text) return 'unknown';
  if (text.includes('workerexecutor(') || text.includes('worker spawn failed') || text.includes('worker exited')) {
    return 'worker_execution';
  }
  if (text.includes('agentruntime')) return 'agent_runtime';
  if (text.includes('manual_required')) return 'manual_required';
  if (text.includes('acceptance') || text.includes('人工验收')) return 'manual_acceptance';
  if (text.includes('module-mapper.js') || text.includes('structure-analyzer.js')) return 'missing_analysis_script';
  return 'other';
}

export function inferPlannedExecutionMode(taskType: TaskType, hasWorkerExecutor: boolean): ExecutionMetricMode {
  if (taskType === 'analysis') return 'script';
  if (taskType === 'acceptance') return 'manual';
  return hasWorkerExecutor ? 'worker' : 'agent-runtime';
}

export function inferBlockedExecutionMode(taskType: TaskType, errorMessage: string, hasWorkerExecutor: boolean): ExecutionMetricMode {
  const text = errorMessage.toLowerCase();
  if (text.includes('workerexecutor(') || text.includes('worker spawn failed') || text.includes('worker exited')) {
    return 'worker';
  }
  if (text.includes('agentruntime')) return 'agent-runtime';
  if (text.includes('[agent-call]') || text.includes('agent-call')) return 'agent-call';
  if (taskType === 'analysis') return 'script';
  if (taskType === 'acceptance') return 'manual';
  return hasWorkerExecutor ? 'worker' : 'unknown';
}

export function inferCompletedExecutionMode(taskType: TaskType, executedBy: string | undefined): ExecutionMetricMode {
  if (executedBy?.startsWith('worker-executor:')) return 'worker';
  if (taskType === 'analysis') return 'script';
  if (taskType === 'acceptance') return 'manual';
  return 'unknown';
}

export function computeDurationMs(startedAt: string | undefined, completedAt: string | undefined): number | undefined {
  if (!startedAt || !completedAt) return undefined;
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  return end - start;
}

function ensureMetricsDir(metricsDir: string): void {
  fs.mkdirSync(metricsDir, { recursive: true });
}

function createEmptySummary(projectRoot: string): ExecutionMetricsSummary {
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

function normalizeSummary(raw: Partial<ExecutionMetricsSummary>, projectRoot: string): ExecutionMetricsSummary {
  const base = createEmptySummary(projectRoot);
  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : base.generatedAt,
    projectRoot,
    lastEventAt: typeof raw.lastEventAt === 'string' ? raw.lastEventAt : null,
    totals: {
      ...base.totals,
      ...(raw.totals ?? {}),
    },
    byTaskType: normalizeAggregateMap(raw.byTaskType),
    byExecutionMode: normalizeAggregateMap(raw.byExecutionMode),
    blockedReasons: normalizeCounterMap(raw.blockedReasons),
    workflowRoutesById: normalizeCounterMap(raw.workflowRoutesById),
    workflowRoutesByMode: normalizeCounterMap(raw.workflowRoutesByMode),
  };
}

function normalizeAggregateMap(raw: unknown): Record<string, ExecutionMetricAggregate> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, ExecutionMetricAggregate> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    result[key] = normalizeAggregate(value);
  }
  return result;
}

function normalizeCounterMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    result[key] = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  return result;
}

function normalizeAggregate(raw: unknown): ExecutionMetricAggregate {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Partial<ExecutionMetricAggregate>
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

function applyEvent(summary: ExecutionMetricsSummary, event: ExecutionMetricEvent): void {
  const taskTypeAggregate = event.taskType ? ensureAggregate(summary.byTaskType, event.taskType) : null;
  const modeAggregate = event.executionMode ? ensureAggregate(summary.byExecutionMode, event.executionMode) : null;

  switch (event.eventType) {
    case 'task_started':
      if (!taskTypeAggregate) return;
      summary.totals.started += 1;
      taskTypeAggregate.started += 1;
      if (modeAggregate) modeAggregate.started += 1;
      break;
    case 'task_completed':
      if (!taskTypeAggregate) return;
      summary.totals.completed += 1;
      taskTypeAggregate.completed += 1;
      if (modeAggregate) modeAggregate.completed += 1;
      if (event.executionMode === 'worker') {
        summary.totals.workerExecutions += 1;
      }
      applyDuration(summary, taskTypeAggregate, modeAggregate, event.durationMs);
      break;
    case 'task_blocked':
      if (!taskTypeAggregate) return;
      summary.totals.blocked += 1;
      taskTypeAggregate.blocked += 1;
      if (modeAggregate) modeAggregate.blocked += 1;
      if (event.blockedReasonCode) {
        summary.blockedReasons[event.blockedReasonCode] = (summary.blockedReasons[event.blockedReasonCode] || 0) + 1;
      }
      break;
    case 'task_failed':
      if (!taskTypeAggregate) return;
      summary.totals.failed += 1;
      taskTypeAggregate.failed += 1;
      if (modeAggregate) modeAggregate.failed += 1;
      break;
    case 'agent_call_created':
      summary.totals.agentCallsCreated += 1;
      break;
    case 'agent_call_applied':
      if (!taskTypeAggregate) return;
      summary.totals.agentCallsApplied += 1;
      if (event.status === 'failed') {
        summary.totals.failed += 1;
        taskTypeAggregate.failed += 1;
        if (modeAggregate) modeAggregate.failed += 1;
        break;
      }

      if (event.status === 'blocked') {
        summary.totals.blocked += 1;
        taskTypeAggregate.blocked += 1;
        if (modeAggregate) modeAggregate.blocked += 1;
        if (event.blockedReasonCode) {
          summary.blockedReasons[event.blockedReasonCode] = (summary.blockedReasons[event.blockedReasonCode] || 0) + 1;
        }
        break;
      }

      summary.totals.resumed += 1;
      summary.totals.completed += 1;
      taskTypeAggregate.completed += 1;
      if (modeAggregate) modeAggregate.completed += 1;
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

function applyWorkflowRouteCounters(summary: ExecutionMetricsSummary, event: ExecutionMetricEvent): void {
  if (event.workflowId) {
    summary.workflowRoutesById[event.workflowId] = (summary.workflowRoutesById[event.workflowId] || 0) + 1;
  }
  if (event.routeMode) {
    summary.workflowRoutesByMode[event.routeMode] = (summary.workflowRoutesByMode[event.routeMode] || 0) + 1;
  }
}

function applyDuration(
  summary: ExecutionMetricsSummary,
  taskTypeAggregate: ExecutionMetricAggregate,
  modeAggregate: ExecutionMetricAggregate | null,
  durationMs: number | undefined,
): void {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) return;

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

function ensureAggregate(map: Record<string, ExecutionMetricAggregate>, key: string): ExecutionMetricAggregate {
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
