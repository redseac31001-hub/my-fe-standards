/**
 * 任务执行引擎
 *
 * 负责 TaskBook 中任务的调度和执行，支持并行执行无依赖任务
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  TaskBook,
  TaskItem,
  TaskExecutionResult,
  WorkflowSpec,
  WorkflowStep,
  WorkflowGate,
} from './types';
import { TaskBookManager } from './taskbook-manager';

interface ExecuteTasksOptions {
  allowedTaskTypes?: Array<TaskItem['type']>;
  maxParallel?: number;
  conflictStrategy?: 'allow' | 'deny_same_file_set';
  allowedTaskIds?: string[];
}

type ExecuteTasksResultStatus = 'completed' | 'blocked' | 'waiting' | 'not_found' | 'invalid_status';

interface ExecuteTasksResult {
  status: ExecuteTasksResultStatus;
  taskBook: TaskBook | null;
  message?: string;
}

interface WorkflowRunnerOptions {
  workflowPath?: string;
  approvedGates?: Set<string>;
  maxParallelTasks?: number;
}

type GateResult = {
  gateId: string;
  passed: boolean;
  skipped?: boolean;
  message?: string;
  evidencePath?: string;
};

/**
 * 任务执行器配置
 */
export interface TaskExecutorConfig {
  maxParallel: number;           // 最大并行数
  onTaskStart?: (task: TaskItem) => void;
  onTaskComplete?: (task: TaskItem, result: TaskExecutionResult) => void;
  onTaskBlocked?: (task: TaskItem, reason: string) => void;
  onAllComplete?: (taskBook: TaskBook) => void;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TaskExecutorConfig = {
  maxParallel: 3,
};

type ConflictStrategy = 'allow' | 'deny_same_file_set';

function getConflictKeys(task: TaskItem): string[] | null {
  const files = task.scope?.files ?? [];
  const modules = task.scope?.modules ?? [];
  const keys = [
    ...files.map(f => `file:${f}`),
    ...modules.map(m => `module:${m}`),
  ];

  return keys.length > 0 ? keys : null;
}

function selectRunnableTasks(runnable: TaskItem[], maxParallel: number, strategy: ConflictStrategy): TaskItem[] {
  if (maxParallel <= 0) return [];
  if (strategy === 'allow') return runnable.slice(0, maxParallel);

  // deny_same_file_set: tasks without explicit scope are treated as global (conflict with all)
  const selected: TaskItem[] = [];
  const used = new Set<string>();
  let hasGlobal = false;

  for (const task of runnable) {
    if (selected.length >= maxParallel) break;

    const keys = getConflictKeys(task);
    if (!keys) {
      if (selected.length === 0) {
        selected.push(task);
        hasGlobal = true;
      }
      continue;
    }

    if (hasGlobal) continue;

    let overlap = false;
    for (const k of keys) {
      if (used.has(k)) {
        overlap = true;
        break;
      }
    }

    if (overlap) continue;

    for (const k of keys) used.add(k);
    selected.push(task);
  }

  // fallback: if everything got filtered out, at least make progress
  return selected.length > 0 ? selected : runnable.slice(0, 1);
}

/**
 * 任务执行引擎
 */
export class TaskExecutor {
  private manager: TaskBookManager;
  private config: TaskExecutorConfig;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  constructor(manager: TaskBookManager, config: Partial<TaskExecutorConfig> = {}) {
    this.manager = manager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 开始执行 TaskBook（兼容旧行为：任务完成后自动标记 TaskBook 为 completed）
   */
  async execute(taskBookId: string): Promise<TaskBook | null> {
    const result = await this.executeTasks(taskBookId);
    if (!result.taskBook) return null;

    if (result.status === 'completed') {
      this.manager.updateStatus(taskBookId, 'completed');
      this.config.onAllComplete?.(result.taskBook);
    }

    return this.manager.load(taskBookId);
  }

  /**
   * 执行 TaskBook 中指定类型的任务（用于 workflow 分阶段执行，不自动完成 TaskBook）
   */
  async executeTasks(taskBookId: string, options: ExecuteTasksOptions = {}): Promise<ExecuteTasksResult> {
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

    const allowedTypes = new Set(options.allowedTaskTypes ?? ['analysis', 'design', 'test', 'implement', 'review']);
    const allowedTaskIds = options.allowedTaskIds ? new Set(options.allowedTaskIds) : null;
    const maxParallel = options.maxParallel ?? this.config.maxParallel;
    const conflictStrategy = options.conflictStrategy ?? 'allow';

    this.isRunning = true;
    this.isPaused = false;

    console.log(`[TaskExecutor] 执行任务类型: ${Array.from(allowedTypes).join(', ')}`);

    while (this.isRunning && !this.isPaused) {
      const current = this.manager.load(taskBookId);
      if (!current) {
        return { status: 'not_found', taskBook: null, message: `TaskBook not found: ${taskBookId}` };
      }

      const pendingAllowed = current.tasks.filter(t =>
        t.status === 'pending'
        && allowedTypes.has(t.type)
        && (!allowedTaskIds || allowedTaskIds.has(t.id))
      );
      const blockedAllowed = current.tasks.filter(t =>
        t.status === 'blocked'
        && allowedTypes.has(t.type)
        && (!allowedTaskIds || allowedTaskIds.has(t.id))
      );

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

      const completedTaskIds = new Set(
        current.tasks
          .filter(t => t.status === 'done' || t.status === 'skipped')
          .map(t => t.id)
      );

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

      const tasksToExecute = selectRunnableTasks(runnable, maxParallel, conflictStrategy);
      if (conflictStrategy !== 'allow' && tasksToExecute.length < Math.min(maxParallel, runnable.length)) {
        console.log(`[TaskExecutor] conflictStrategy=${conflictStrategy}: runnable=${runnable.length} selected=${tasksToExecute.length}`);
      }
      console.log(`[TaskExecutor] 并行执行 ${tasksToExecute.length} 个任务`);

      const results = await Promise.all(tasksToExecute.map(task => this.executeTask(taskBookId, task)));
      for (const result of results) {
        if (!result.success && result.error) {
          console.log(`[TaskExecutor] 任务 ${result.taskId} 执行失败: ${result.error}`);
        }
      }
    }

    return { status: 'blocked', taskBook: this.manager.load(taskBookId), message: '执行被暂停/停止' };
  }

  /**
   * 执行单个任务
   */
  private async executeTask(taskBookId: string, task: TaskItem): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    // 更新任务状态为进行中
    this.manager.updateTaskStatus(taskBookId, task.id, 'in_progress');
    this.config.onTaskStart?.(task);

    console.log(`[TaskExecutor] 开始执行任务: ${task.title} (${task.type})`);

    try {
      // 根据任务类型调用不同的执行逻辑
      const actualWork = await this.dispatchTask(task);

      // 更新任务状态为完成
      this.manager.updateTaskStatus(taskBookId, task.id, 'done', actualWork);

      const result: TaskExecutionResult = {
        taskId: task.id,
        success: true,
        actualWork,
        duration: Date.now() - startTime,
      };

      this.config.onTaskComplete?.(task, result);
      console.log(`[TaskExecutor] 任务完成: ${task.title}`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 判断是否为可恢复的错误
      if (this.isRecoverableError(error)) {
        // 标记为阻塞，等待用户介入
        this.manager.updateTaskStatus(taskBookId, task.id, 'blocked', undefined, errorMessage);
        this.config.onTaskBlocked?.(task, errorMessage);

        return {
          taskId: task.id,
          success: false,
          error: errorMessage,
          duration: Date.now() - startTime,
        };
      }

      // 不可恢复的错误，保留为 pending 状态等待重试
      console.error(`[TaskExecutor] 任务执行出错: ${task.title}`, error);

      return {
        taskId: task.id,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 分发任务到对应的 Agent
   */
  private async dispatchTask(task: TaskItem): Promise<string> {
    // 根据任务类型分发到不同的处理逻辑
    // 实际实现中，这里会调用对应的 Agent
    switch (task.type) {
      case 'analysis':
        return this.executeAnalysisTask(task);
      case 'design':
        return this.executeDesignTask(task);
      case 'test':
        return this.executeTestTask(task);
      case 'implement':
        return this.executeImplementTask(task);
      case 'review':
        return this.executeReviewTask(task);
      default:
        throw new Error(`未知的任务类型: ${task.type}`);
    }
  }

  /**
   * 执行分析任务
   */
  private async executeAnalysisTask(task: TaskItem): Promise<string> {
    console.log(`[TaskExecutor] 执行分析任务: ${task.title}`);

    const moduleMapper = path.join(process.cwd(), '.codebuddy/scripts/module-mapper.js');
    const structureAnalyzer = path.join(process.cwd(), '.codebuddy/scripts/structure-analyzer.js');

    const ran: string[] = [];

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
  private async executeDesignTask(task: TaskItem): Promise<string> {
    console.log(`[TaskExecutor] 执行设计任务: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: 需要人工/Agent 完成设计任务：${task.title}`);
  }

  /**
   * 执行测试任务
   */
  private async executeTestTask(task: TaskItem): Promise<string> {
    console.log(`[TaskExecutor] 执行测试任务: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: 需要补充/修改测试用例：${task.title}`);
  }

  /**
   * 执行实现任务
   */
  private async executeImplementTask(task: TaskItem): Promise<string> {
    console.log(`[TaskExecutor] 执行实现任务: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: 需要人工/Agent 完成实现任务：${task.title}`);
  }

  /**
   * 执行审查任务
   */
  private async executeReviewTask(task: TaskItem): Promise<string> {
    console.log(`[TaskExecutor] 执行审查任务: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: 需要人工/Agent 完成审查任务：${task.title}`);
  }

  /**
   * 判断是否为可恢复的错误
   */
  private isRecoverableError(error: unknown): boolean {
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
  pause(): void {
    console.log('[TaskExecutor] 暂停执行');
    this.isPaused = true;
  }

  /**
   * 恢复执行
   */
  async resume(taskBookId: string): Promise<TaskBook | null> {
    console.log('[TaskExecutor] 恢复执行');
    this.isPaused = false;
    return this.execute(taskBookId);
  }

  /**
   * 停止执行
   */
  stop(): void {
    console.log('[TaskExecutor] 停止执行');
    this.isRunning = false;
    this.isPaused = false;
  }

  /**
   * 跳过阻塞的任务
   */
  skipBlockedTask(taskBookId: string, taskId: string, reason: string): TaskBook | null {
    const taskBook = this.manager.load(taskBookId);
    if (!taskBook) return null;

    const task = taskBook.tasks.find(t => t.id === taskId);
    if (!task || task.status !== 'blocked') return null;

    this.manager.updateTaskStatus(taskBookId, taskId, 'skipped');
    this.manager.logChange(
      taskBookId,
      taskId,
      'modified',
      `用户跳过阻塞任务: ${reason}`,
      { status: 'blocked' },
      { status: 'skipped' }
    );

    return this.manager.load(taskBookId);
  }

  /**
   * 解决阻塞并继续
   */
  async resolveBlockedTask(
    taskBookId: string,
    taskId: string,
    resolution: string
  ): Promise<TaskBook | null> {
    const taskBook = this.manager.load(taskBookId);
    if (!taskBook) return null;

    const task = taskBook.tasks.find(t => t.id === taskId);
    if (!task || task.status !== 'blocked') return null;

    // 重置为 pending 状态
    this.manager.updateTaskStatus(taskBookId, taskId, 'pending');
    this.manager.logChange(
      taskBookId,
      taskId,
      'modified',
      `用户解决阻塞: ${resolution}`,
      { status: 'blocked', blockedReason: task.blockedReason },
      { status: 'pending' }
    );

    // 继续执行
    return this.resume(taskBookId);
  }
}

/**
 * 创建任务执行器
 */
export function createTaskExecutor(
  manager: TaskBookManager,
  config?: Partial<TaskExecutorConfig>
): TaskExecutor {
  return new TaskExecutor(manager, config);
}

function showHelp(): void {
  console.log(`
Task Executor - Workflow 驱动的任务执行器

用法:
  node .codebuddy/scripts/task-executor.js <taskBookId> [options]

选项:
  --workflow <path>     指定 workflow 文件（默认: .codebuddy/workflows/default.workflow.json）
  --approve <gateId>    预先批准某个 gate（可重复）
  --max-parallel <n>    覆盖并行度（默认取 workflow.policies 或内置默认值）
  --tasks-only          不读取 workflow，直接执行所有任务（旧模式）
  -h, --help            显示帮助

说明:
  - workflow 早期主要用于约束/引导（产物、顺序、质量闸门），后期可扩展为强制编排引擎。
  - 若执行遇到 MANUAL_REQUIRED，将把对应任务标记为 blocked，等待人工/Agent 介入。
`);
}

function loadWorkflowSpec(workflowPath: string): WorkflowSpec {
  const raw = fs.readFileSync(workflowPath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('workflow 文件不是有效的 JSON 对象');
  }

  const spec = parsed as Partial<WorkflowSpec>;
  if (!spec.id || !spec.version || !Array.isArray(spec.steps)) {
    throw new Error('workflow 缺少必填字段: id / version / steps');
  }

  for (const step of spec.steps) {
    if (!step || typeof step !== 'object') {
      throw new Error('workflow.steps 包含无效 step');
    }
    const s = step as Partial<WorkflowStep>;
    if (!s.id || !s.type || !s.title) {
      throw new Error(`workflow step 缺少必填字段: id/type/title (${JSON.stringify(step)})`);
    }
  }

  return spec as WorkflowSpec;
}

function topologicalSteps(spec: WorkflowSpec): WorkflowStep[] {
  if (!spec.edges || spec.edges.length === 0) return spec.steps;

  const stepMap = new Map<string, WorkflowStep>();
  for (const step of spec.steps) {
    stepMap.set(step.id, step);
  }

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const step of spec.steps) {
    inDegree.set(step.id, 0);
    adj.set(step.id, []);
  }

  for (const e of spec.edges) {
    if (!stepMap.has(e.from) || !stepMap.has(e.to)) {
      throw new Error(`workflow.edges 引用不存在的 step: ${e.from} -> ${e.to}`);
    }
    adj.get(e.from)!.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const step of spec.steps) {
    if ((inDegree.get(step.id) ?? 0) === 0) {
      queue.push(step.id);
    }
  }

  const ordered: WorkflowStep[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ordered.push(stepMap.get(id)!);
    for (const next of adj.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if ((inDegree.get(next) ?? 0) === 0) {
        queue.push(next);
      }
    }
  }

  if (ordered.length !== spec.steps.length) {
    throw new Error('workflow.edges 存在循环依赖，无法拓扑排序');
  }

  return ordered;
}

function getPolicyMaxParallel(spec: WorkflowSpec): number | undefined {
  const raw = spec.policies as Record<string, unknown> | undefined;
  const concurrency = raw?.concurrency as Record<string, unknown> | undefined;
  const maxParallel = concurrency?.maxParallelTasks;
  if (typeof maxParallel === 'number' && Number.isFinite(maxParallel) && maxParallel > 0) {
    return Math.floor(maxParallel);
  }
  return undefined;
}

function getPolicyConflictStrategy(spec: WorkflowSpec): ConflictStrategy | undefined {
  const raw = spec.policies as Record<string, unknown> | undefined;
  const concurrency = raw?.concurrency as Record<string, unknown> | undefined;
  const cs = concurrency?.conflictStrategy;
  if (cs === 'allow' || cs === 'deny_same_file_set') return cs;
  return undefined;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

type RiskTier = 'high' | 'medium' | 'low';

type RiskTierPolicy = {
  maxFiles: number;
  maxChangedLines?: number;
  smokeEveryBatches: number;
};

type BatchingPolicy = {
  strategy: 'risk_tiered';
  riskTiers: Record<RiskTier, RiskTierPolicy>;
};

function getPolicyBatching(spec: WorkflowSpec): BatchingPolicy | null {
  const raw = spec.policies as Record<string, unknown> | undefined;
  const testing = raw?.testing;
  if (!isPlainObject(testing)) return null;
  const batching = testing.batching;
  if (!isPlainObject(batching)) return null;
  if (batching.strategy !== 'risk_tiered') return null;

  const defaults: Record<RiskTier, RiskTierPolicy> = {
    high: { maxFiles: 3, smokeEveryBatches: 1 },
    medium: { maxFiles: 10, smokeEveryBatches: 1 },
    low: { maxFiles: 25, smokeEveryBatches: 2 },
  };

  const riskTiersRaw = batching.riskTiers;
  if (!isPlainObject(riskTiersRaw)) {
    return { strategy: 'risk_tiered', riskTiers: defaults };
  }

  const parseTier = (tier: unknown, fallback: RiskTierPolicy): RiskTierPolicy => {
    if (!isPlainObject(tier)) return fallback;

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

  const parsed: Record<RiskTier, RiskTierPolicy> = {
    high: parseTier(riskTiersRaw.high, defaults.high),
    medium: parseTier(riskTiersRaw.medium, defaults.medium),
    low: parseTier(riskTiersRaw.low, defaults.low),
  };

  return { strategy: 'risk_tiered', riskTiers: parsed };
}

function inferRiskTier(taskBook: TaskBook, allowedTaskTypes: Set<TaskItem['type']>): RiskTier {
  const hasHighPriority = taskBook.tasks.some(t =>
    t.status === 'pending'
    && allowedTaskTypes.has(t.type)
    && (t.priority === 'critical' || t.priority === 'high')
  );
  if (hasHighPriority) return 'high';

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

function priorityRank(priority: TaskItem['priority']): number {
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

function getScopedFiles(task: TaskItem): string[] {
  const files = task.scope?.files ?? [];
  return files.filter(f => typeof f === 'string' && f.length > 0);
}

function selectBatchTasks(runnable: TaskItem[], maxFiles: number): TaskItem[] {
  if (runnable.length === 0) return [];
  if (maxFiles <= 0) return runnable.slice(0, 1);
  if (runnable.length <= 1) return runnable.slice(0, 1);

  const ordered = [...runnable].sort((a, b) => {
    const p = priorityRank(a.priority) - priorityRank(b.priority);
    if (p !== 0) return p;
    const fa = getScopedFiles(a).length;
    const fb = getScopedFiles(b).length;
    if (fa !== fb) return fa - fb;
    return a.id.localeCompare(b.id);
  });

  const selected: TaskItem[] = [];
  const usedFiles = new Set<string>();
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

    if (hasGlobal) continue;

    const newFiles: string[] = [];
    for (const f of files) {
      if (!usedFiles.has(f)) newFiles.push(f);
    }

    if (usedFiles.size + newFiles.length > maxFiles) continue;
    for (const f of newFiles) usedFiles.add(f);
    selected.push(task);
  }

  return selected.length > 0 ? selected : ordered.slice(0, 1);
}

function getGateById(spec: WorkflowSpec, gateId: string): WorkflowGate | null {
  if (!spec.gates) return null;
  const found = spec.gates.find(g => g.id === gateId);
  return found ?? null;
}

function getStepGates(spec: WorkflowSpec, step: WorkflowStep): WorkflowGate[] {
  const gateIds = step.gates ?? [];
  const gates: WorkflowGate[] = [];
  for (const id of gateIds) {
    const gate = getGateById(spec, id);
    if (!gate) {
      throw new Error(`step.gates 引用不存在的 gate: ${id}`);
    }
    gates.push(gate);
  }
  return gates;
}

const GATE_EVIDENCE_OUTPUT_LIMIT = 20_000;

function safeTimestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}

function readPackageJsonScripts(): Record<string, string> | null {
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const parsed = JSON.parse(raw) as { scripts?: unknown };
    const scripts = parsed?.scripts;
    if (typeof scripts !== 'object' || scripts === null || Array.isArray(scripts)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(scripts as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

function writeGateEvidence(taskBookId: string, stepId: string, gateId: string, payload: unknown): string | undefined {
  try {
    const safeTaskBookId = sanitizeForFilename(taskBookId);
    const outDir = path.join(process.cwd(), '.codebuddy', 'reports', 'gates', safeTaskBookId);
    ensureDir(outDir);

    const fileName = `${safeTimestampForFilename()}.${sanitizeForFilename(stepId)}.${sanitizeForFilename(gateId)}.json`;
    const absPath = path.join(outDir, fileName);
    fs.writeFileSync(absPath, JSON.stringify(payload, null, 2), 'utf-8');
    return toPosixPath(path.relative(process.cwd(), absPath));
  } catch {
    return undefined;
  }
}

async function runCheckGatesForStep(
  spec: WorkflowSpec,
  step: WorkflowStep,
  taskBookId: string,
  manager: TaskBookManager,
  approved: Set<string>,
  gateResults: Map<string, GateResult>,
  context?: Record<string, unknown>
): Promise<{ ok: boolean; gateResults: GateResult[] }> {
  const results: GateResult[] = [];
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
        ...(context ?? {}),
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
        ...(context ?? {}),
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
          ...(context ?? {}),
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
          ...(context ?? {}),
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
        ...(context ?? {}),
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
        ...(context ?? {}),
      });
      continue;
    }

    const params = gate.params ?? {};
    const rawCommands = Array.isArray((params as any).commands)
      ? ((params as any).commands as unknown[]).filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : [];
    const npmScripts = Array.isArray((params as any).npmScripts)
      ? ((params as any).npmScripts as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [];
    const failIfMissing = typeof (params as any).failIfMissing === 'boolean' ? Boolean((params as any).failIfMissing) : required;
    const writeEvidence = typeof (params as any).writeEvidence === 'boolean' ? Boolean((params as any).writeEvidence) : true;

    const budgetMinutes = typeof (params as any)?.budgetMinutes === 'number'
      ? Number((params as any).budgetMinutes)
      : undefined;

    const scripts = npmScripts.length > 0 ? readPackageJsonScripts() : null;
    const missingScripts: string[] = [];
    const scriptCommands: string[] = [];
    if (npmScripts.length > 0) {
      if (scripts === null) {
        missingScripts.push(...npmScripts);
      } else {
        for (const script of npmScripts) {
          if (scripts[script]) scriptCommands.push(`npm run ${script}`);
          else missingScripts.push(script);
        }
      }
    }

    const commands = [...rawCommands, ...scriptCommands];
    const commandRuns: Array<{ command: string; ok: boolean; code: number | null; durationMs: number }> = [];

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
        ...(context ?? {}),
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
        ...(context ?? {}),
      });
      console.log(`[Gate] ${required ? '❌' : '⚠️'} ${gate.id} 失败: ${message}`);
      if (required) return { ok: false, gateResults: results };
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
          ...(context ?? {}),
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
          ...(context ?? {}),
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
        ...(context ?? {}),
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
        ...(context ?? {}),
      });
      console.log(`[Gate] ⏭ ${gate.id} skipped: ${skipReason}`);
      continue;
    }

    let failedCommand: { command: string; stdout: string; stderr: string } | null = null;
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
      ...(context ?? {}),
    }) : undefined;

    const r = passed
      ? ({ gateId: gate.id, passed: true, evidencePath } satisfies GateResult)
      : ({ gateId: gate.id, passed: false, message: `command failed: ${failedCommand?.command ?? ''}`, evidencePath } satisfies GateResult);

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
      stderr: passed ? undefined : failedCommand?.stderr?.slice(0, 2000),
      ...(context ?? {}),
    });
    console.log(`[Gate] ${passed ? '✅' : required ? '❌' : '⚠️'} ${gate.id} ${passed ? '通过' : '失败'}${!required && !passed ? '（optional）' : ''}`);
    if (!passed && required) return { ok: false, gateResults: results };
  }

  return { ok: true, gateResults: results };
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

type NodeScriptRunResult = { ok: boolean; stdout: string; stderr: string; code: number | null };

function runNodeScript(scriptPath: string, args: string[]): NodeScriptRunResult {
  const res = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  return {
    ok: res.status === 0,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    code: res.status,
  };
}

type ShellRunResult = { ok: boolean; stdout: string; stderr: string; code: number | null; durationMs: number };

function runShellCommand(command: string): ShellRunResult {
  const start = Date.now();
  const res = spawnSync(command, [], {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  const durationMs = Date.now() - start;

  return {
    ok: res.status === 0,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    code: res.status,
    durationMs,
  };
}

async function runWorkflow(taskBookId: string, options: WorkflowRunnerOptions): Promise<{ taskBook: TaskBook | null; gateResults: GateResult[] }> {
  const manager = new TaskBookManager(process.cwd());
  const taskBook = manager.load(taskBookId);
  if (!taskBook) {
    throw new Error(`TaskBook not found: ${taskBookId}`);
  }

  if (taskBook.status !== 'confirmed' && taskBook.status !== 'executing') {
    throw new Error(`TaskBook 必须是 confirmed/executing 才能执行。当前状态: ${taskBook.status}`);
  }

  const workflowPath = options.workflowPath ?? path.join(process.cwd(), '.codebuddy/workflows/default.workflow.json');
  if (!fs.existsSync(workflowPath)) {
    throw new Error(`workflow 文件不存在: ${workflowPath}`);
  }

  const spec = loadWorkflowSpec(workflowPath);
  const orderedSteps = topologicalSteps(spec);
  const approved = options.approvedGates ?? new Set<string>();
  const gateResults = new Map<string, GateResult>();

  const maxParallelFromPolicy = getPolicyMaxParallel(spec);
  const maxParallel = options.maxParallelTasks ?? maxParallelFromPolicy ?? 1;
  const conflictStrategy = getPolicyConflictStrategy(spec) ?? 'allow';

  // 开始执行
  manager.updateStatus(taskBookId, 'executing');
  manager.logChange(taskBookId, null, 'modified', `开始执行 workflow: ${spec.id}@${spec.version}`, { workflowPath }, { workflowId: spec.id });

  const executor = new TaskExecutor(manager, { maxParallel });

  for (const step of orderedSteps) {
    console.log(`\n[Workflow] ▶ ${step.id}: ${step.title} (${step.type})`);

    if (step.type === 'analyze_project') {
      // 使用 analyzer 生成 reports
      const moduleMapper = path.join(process.cwd(), '.codebuddy/scripts/module-mapper.js');
      const structureAnalyzer = path.join(process.cwd(), '.codebuddy/scripts/structure-analyzer.js');

      if (fs.existsSync(moduleMapper)) {
        const r = runNodeScript(moduleMapper, ['.', '--mode', 'summary', '--output', 'json']);
        if (!r.ok) throw new Error(`module-mapper 执行失败: ${r.stderr || r.stdout}`);
      }

      if (fs.existsSync(structureAnalyzer)) {
        const r = runNodeScript(structureAnalyzer, ['.', '--mode', 'summary', '--output', 'json']);
        if (!r.ok) throw new Error(`structure-analyzer 执行失败: ${r.stderr || r.stdout}`);
      }

      manager.logChange(taskBookId, null, 'modified', '已生成项目结构/模块图谱 reports', undefined, {
        reports: ['.codebuddy/reports/architecture/latest.json', '.codebuddy/reports/modules/latest.json'],
      });
      continue;
    }

    if (step.type === 'create_taskbook') {
      // workflow 允许作为规范存在；此处不自动生成/修改 TaskBook
      manager.logChange(taskBookId, null, 'modified', 'workflow step: create_taskbook (no-op, TaskBook 已存在)');
      continue;
    }

    if (step.type === 'implement_tasks') {
      const allowedTaskTypes = new Set<TaskItem['type']>(['analysis', 'design', 'implement']);
      const batching = getPolicyBatching(spec);
      const hasStepGates = Array.isArray(step.gates) && step.gates.length > 0;

      if (!batching) {
        const result = await executor.executeTasks(taskBookId, {
          allowedTaskTypes: Array.from(allowedTaskTypes),
          maxParallel,
          conflictStrategy,
        });
        if (result.status !== 'completed') {
          console.log(`[Workflow] implement_tasks 未完成: ${result.status} ${result.message ?? ''}`);
          return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
        }

        if (hasStepGates) {
          const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults);
          if (!ok) {
            return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
          }
        }

        continue;
      }

      const riskTier = inferRiskTier(manager.load(taskBookId) ?? taskBook, allowedTaskTypes);
      const tier = batching.riskTiers[riskTier];
      const maxFiles = tier.maxFiles;
      const smokeEveryBatches = tier.smokeEveryBatches;

      let batchesSinceGate = 0;
      let batchIndex = 0;

      while (true) {
        const current = manager.load(taskBookId);
        if (!current) {
          return { taskBook: null, gateResults: Array.from(gateResults.values()) };
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
            if (!ok) return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
          }

          if (blockedAllowed.length > 0) {
            console.log(`[Workflow] implement_tasks 存在阻塞任务（${blockedAllowed.length}）`);
            return { taskBook: current, gateResults: Array.from(gateResults.values()) };
          }
          break;
        }

        const completedTaskIds = new Set(
          current.tasks
            .filter(t => t.status === 'done' || t.status === 'skipped')
            .map(t => t.id)
        );
        const runnable = pendingAllowed.filter(t => t.dependencies.every(depId => completedTaskIds.has(depId)));
        if (runnable.length === 0) {
          console.log('[Workflow] implement_tasks 没有可执行任务（等待依赖完成）');
          return { taskBook: current, gateResults: Array.from(gateResults.values()) };
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
          console.log(`[Workflow] implement_tasks batch 未完成: ${result.status} ${result.message ?? ''}`);
          return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
        }

        batchesSinceGate += 1;
        const pendingLeft = (manager.load(taskBookId)?.tasks ?? []).filter(t => t.status === 'pending' && allowedTaskTypes.has(t.type)).length;
        const shouldRunGates = hasStepGates && (batchesSinceGate >= smokeEveryBatches || pendingLeft === 0);
        if (shouldRunGates) {
          const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
            eventContext: 'batch_gate',
            batchIndex,
            riskTier,
          });
          if (!ok) return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
          batchesSinceGate = 0;
        }
      }

      continue;
    }

    if (step.type === 'run_tests') {
      const tasksResult = await executor.executeTasks(taskBookId, { allowedTaskTypes: ['test'], maxParallel, conflictStrategy });
      if (tasksResult.status !== 'completed') {
        console.log(`[Workflow] test 任务未完成: ${tasksResult.status} ${tasksResult.message ?? ''}`);
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
      }

      const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
        eventContext: 'run_tests_gate',
      });
      if (!ok) return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };

      continue;
    }

    if (step.type === 'code_review') {
      const tasksResult = await executor.executeTasks(taskBookId, { allowedTaskTypes: ['review'], maxParallel, conflictStrategy });
      if (tasksResult.status !== 'completed') {
        console.log(`[Workflow] review 任务未完成: ${tasksResult.status} ${tasksResult.message ?? ''}`);
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
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
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
      }

      continue;
    }

    if (step.type === 'acceptance_and_archive') {
      const current = manager.load(taskBookId);
      if (!current) throw new Error(`TaskBook not found: ${taskBookId}`);

      const allDone = current.tasks.every(t => t.status === 'done' || t.status === 'skipped');
      if (!allDone) {
        console.log('[Workflow] 仍有未完成任务，无法验收归档。');
        return { taskBook: current, gateResults: Array.from(gateResults.values()) };
      }

      // required gates must be passed
      const requiredGates = (spec.gates ?? []).filter(g => g.required !== false);
      const failedRequired = requiredGates.filter(g => !gateResults.get(g.id)?.passed && !approved.has(g.id));
      if (failedRequired.length > 0) {
        console.log(`[Workflow] 仍有未通过的质量闸门: ${failedRequired.map(g => g.id).join(', ')}`);
        return { taskBook: current, gateResults: Array.from(gateResults.values()) };
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
      return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
    }

    console.log(`[Workflow] ⚠ 未识别的 step.type: ${step.type}（跳过）`);
  }

  return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
}

function parseCliArgs(args: string[]): { help: boolean; taskBookId: string | null; workflowPath?: string; approvedGates: Set<string>; maxParallel?: number; tasksOnly: boolean } {
  const parsed = {
    help: false,
    taskBookId: null as string | null,
    workflowPath: undefined as string | undefined,
    approvedGates: new Set<string>(),
    maxParallel: undefined as number | undefined,
    tasksOnly: false,
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

    if (!arg.startsWith('-') && !parsed.taskBookId) {
      parsed.taskBookId = arg;
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseCliArgs(args);

  if (parsed.help || !parsed.taskBookId) {
    showHelp();
    process.exit(parsed.taskBookId ? 0 : 1);
  }

  if (parsed.tasksOnly) {
    const manager = new TaskBookManager(process.cwd());
    const executor = new TaskExecutor(manager, { maxParallel: parsed.maxParallel ?? DEFAULT_CONFIG.maxParallel });
    const result = await executor.executeTasks(parsed.taskBookId, { maxParallel: parsed.maxParallel });
    if (result.status === 'completed') {
      manager.updateStatus(parsed.taskBookId, 'completed');
      process.exit(0);
    }

    console.error(`[TaskExecutor] 未完成: ${result.status} ${result.message ?? ''}`);
    process.exit(2);
  }

  try {
    const { taskBook } = await runWorkflow(parsed.taskBookId, {
      workflowPath: parsed.workflowPath,
      approvedGates: parsed.approvedGates,
      maxParallelTasks: parsed.maxParallel,
    });

    if (taskBook?.status === 'completed') {
      process.exit(0);
    }

    console.log('[Workflow] ⏸ 未完成（可能存在 blocked/待人工 gate），请处理后重试。');
    process.exit(2);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[Workflow] Fatal Error: ${message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[Workflow] Fatal Error: ${message}`);
    process.exit(1);
  });
}
