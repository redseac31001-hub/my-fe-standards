/**
 * TaskBook 管理器
 *
 * 负责 TaskBook 的创建、读取、更新、归档等操作
 */

import * as fs from 'fs';
import * as path from 'path';
import { isDirectCliEntry } from './lib/cli-entry';
import { listAgentDefinitionCandidatePaths } from './lib/install-roots';
import {
  TaskBook,
  TaskBookStatus,
  TaskBookType,
  TaskItem,
  TaskBookPlan,
  TaskBookPlanEpic,
  TaskBookPlanRisk,
  TaskScope,
  TaskExecutionSpec,
  TaskAgentHint,
  TaskSpecMode,
  BuiltinWorkflowId,
  ChangeEntry,
  HandoffEntry,
  CreateTaskBookParams,
  AcceptanceReport,
  FinalReport,
} from './types';

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
const TASKBOOK_FILE_DELETE_RETRY_MS = 80;
const TASKBOOK_FILE_DELETE_MAX_RETRIES = 6;
const TASKBOOK_FILE_DELETE_RETRY_CODES = new Set(['EBUSY', 'EMFILE', 'ENFILE', 'EPERM']);
const IN_PROCESS_LOCK_DEPTHS = new Map<string, number>();
const ALLOWED_TASK_AGENT_HINTS = new Set<TaskAgentHint>(['coder', 'tester', 'reviewer', 'refactor', 'doc-writer', 'planner']);
const ALLOWED_SPEC_MODES = new Set<TaskSpecMode>(['inline-open-spec', 'linked-spec-kit']);
const ALLOWED_WORKFLOW_IDS = new Set<BuiltinWorkflowId>(['micro', 'sprint', 'default']);

type TaskBookManagerOptions = {
  lockTimeoutMs?: number;
  lockRetryMs?: number;
};

const SLEEP_INT32 = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms: number): void {
  Atomics.wait(SLEEP_INT32, 0, 0, ms);
}

class TaskBookConflictError extends Error {
  taskBookId: string;
  expectedRevision: number;
  actualRevision: number;

  constructor(taskBookId: string, expectedRevision: number, actualRevision: number) {
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
function generateTaskBookId(title: string): string {
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
function now(): string {
  return new Date().toISOString();
}

function uniqStrings(values: string[] | undefined): string[] | undefined {
  if (!values || values.length === 0) return undefined;
  const normalized = values.map(value => value.trim()).filter(Boolean);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

function normalizeExecutionSpec(spec: TaskExecutionSpec | undefined): TaskExecutionSpec | undefined {
  if (!spec) return undefined;

  const normalized: TaskExecutionSpec = {};
  if (typeof spec.summary === 'string' && spec.summary.trim()) normalized.summary = spec.summary.trim();
  if (typeof spec.agentHint === 'string' && ALLOWED_TASK_AGENT_HINTS.has(spec.agentHint)) normalized.agentHint = spec.agentHint;
  if (typeof spec.specRef === 'string' && spec.specRef.trim()) normalized.specRef = spec.specRef.trim();
  if (typeof spec.dependenciesNote === 'string' && spec.dependenciesNote.trim()) normalized.dependenciesNote = spec.dependenciesNote.trim();

  const deliverables = uniqStrings(spec.deliverables);
  if (deliverables) normalized.deliverables = deliverables;
  const verification = uniqStrings(spec.verification);
  if (verification) normalized.verification = verification;
  const constraints = uniqStrings(spec.constraints);
  if (constraints) normalized.constraints = constraints;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizePlanRisk(risk: TaskBookPlanRisk | undefined): TaskBookPlanRisk | undefined {
  if (!risk || typeof risk.summary !== 'string' || !risk.summary.trim()) return undefined;
  return {
    level: risk.level === 'low' || risk.level === 'medium' || risk.level === 'high' ? risk.level : 'medium',
    summary: risk.summary.trim(),
    mitigation: typeof risk.mitigation === 'string' && risk.mitigation.trim() ? risk.mitigation.trim() : undefined,
  };
}

function normalizePlanEpic(epic: TaskBookPlanEpic | undefined): TaskBookPlanEpic | undefined {
  if (!epic || typeof epic.id !== 'string' || !epic.id.trim() || typeof epic.title !== 'string' || !epic.title.trim()) {
    return undefined;
  }
  return {
    id: epic.id.trim(),
    title: epic.title.trim(),
    summary: typeof epic.summary === 'string' && epic.summary.trim() ? epic.summary.trim() : undefined,
  };
}

function normalizeTaskBookPlan(taskBookId: string, plan: Partial<TaskBookPlan> | undefined, revision: number): TaskBookPlan | undefined {
  if (!plan) return undefined;

  const normalized: TaskBookPlan = {
    planId: taskBookId,
    version: typeof plan.version === 'number' && Number.isInteger(plan.version) && plan.version > 0 ? plan.version : 1,
    linkedTaskBookRevision: revision,
  };

  if (typeof plan.specMode === 'string' && ALLOWED_SPEC_MODES.has(plan.specMode)) normalized.specMode = plan.specMode;
  if (typeof plan.recommendedWorkflowId === 'string' && ALLOWED_WORKFLOW_IDS.has(plan.recommendedWorkflowId)) {
    normalized.recommendedWorkflowId = plan.recommendedWorkflowId;
  }
  if (typeof plan.documentationTier === 'string' && ['minimal', 'standard', 'full'].includes(plan.documentationTier)) {
    normalized.documentationTier = plan.documentationTier as TaskBookPlan['documentationTier'];
  }
  if (typeof plan.summary === 'string' && plan.summary.trim()) normalized.summary = plan.summary.trim();
  if (typeof plan.specRef === 'string' && plan.specRef.trim()) normalized.specRef = plan.specRef.trim();
  if (typeof plan.source === 'string' && ['planner', 'manual', 'task-intake-routing'].includes(plan.source)) {
    normalized.source = plan.source as TaskBookPlan['source'];
  }

  const goals = uniqStrings(plan.goals);
  if (goals) normalized.goals = goals;
  const outOfScope = uniqStrings(plan.outOfScope);
  if (outOfScope) normalized.outOfScope = outOfScope;
  const assumptions = uniqStrings(plan.assumptions);
  if (assumptions) normalized.assumptions = assumptions;
  const constraints = uniqStrings(plan.constraints);
  if (constraints) normalized.constraints = constraints;
  const clarifications = uniqStrings(plan.clarifications);
  if (clarifications) normalized.clarifications = clarifications;
  const documentationArtifacts = uniqStrings(plan.documentationArtifacts);
  if (documentationArtifacts) normalized.documentationArtifacts = documentationArtifacts;

  if (Array.isArray(plan.risks)) {
    const risks = plan.risks.map(normalizePlanRisk).filter((risk): risk is TaskBookPlanRisk => Boolean(risk));
    if (risks.length > 0) normalized.risks = risks;
  }

  if (Array.isArray(plan.epics)) {
    const epics = plan.epics.map(normalizePlanEpic).filter((epic): epic is TaskBookPlanEpic => Boolean(epic));
    if (epics.length > 0) normalized.epics = epics;
  }

  return normalized;
}

/**
 * 确保目录存在
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isTerminalTaskBookStatus(status: TaskBookStatus | undefined): boolean {
  return status === 'completed' || status === 'aborted';
}

/**
 * TaskBook 管理器类
 */
export class TaskBookManager {
  private baseDir: string;
  private lockTimeoutMs: number;
  private lockRetryMs: number;

  constructor(projectRoot: string = process.cwd(), options: TaskBookManagerOptions = {}) {
    this.baseDir = projectRoot;
    this.lockTimeoutMs = options.lockTimeoutMs ?? LOCK_TIMEOUT_MS;
    this.lockRetryMs = options.lockRetryMs ?? LOCK_RETRY_MS;
  }

  getProjectRoot(): string {
    return this.baseDir;
  }

  /**
   * 获取活跃任务书目录
   */
  private getActiveDir(): string {
    return path.join(this.baseDir, TASKBOOK_BASE_DIR, ACTIVE_DIR);
  }

  /**
   * 获取历史任务书目录
   */
  private getHistoryDir(): string {
    return path.join(this.baseDir, TASKBOOK_BASE_DIR, HISTORY_DIR);
  }

  private getActiveFilePath(taskBookId: string): string {
    return path.join(this.getActiveDir(), `${taskBookId}.json`);
  }

  private getHistoryFilePath(taskBookId: string): string {
    return path.join(this.getHistoryDir(), `${taskBookId}.json`);
  }

  /**
   * 获取上下文快照目录
   */
  private getContextSnapshotsDir(): string {
    return path.join(this.baseDir, CONTEXT_SNAPSHOTS_DIR);
  }

  /**
   * 创建新的 TaskBook
   */
  private getLocksDir(): string {
    return path.join(this.baseDir, LOCKS_DIR);
  }

  private getLockPath(taskBookId: string): string {
    return path.join(this.getLocksDir(), `${taskBookId}.lock`);
  }

  private cleanupLockFile(lockPath: string): void {
    for (let attempt = 0; attempt < TASKBOOK_FILE_DELETE_MAX_RETRIES; attempt++) {
      try {
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath);
        }
        return;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code === 'ENOENT') {
          return;
        }

        if (TASKBOOK_FILE_DELETE_RETRY_CODES.has(err?.code || '') && attempt < TASKBOOK_FILE_DELETE_MAX_RETRIES - 1) {
          try {
            fs.rmSync(lockPath, { force: true });
            return;
          } catch (rmError) {
            const rmErr = rmError as NodeJS.ErrnoException;
            if (rmErr?.code === 'ENOENT') {
              return;
            }
          }
          sleepSync(TASKBOOK_FILE_DELETE_RETRY_MS);
          continue;
        }

        try {
          fs.rmSync(lockPath, { force: true });
        } catch (rmError) {
          const rmErr = rmError as NodeJS.ErrnoException;
          if (rmErr?.code === 'ENOENT') {
            return;
          }
        }
        return;
      }
    }
  }

  private cleanupArchivedActiveFile(filePath: string): boolean {
    for (let attempt = 0; attempt < TASKBOOK_FILE_DELETE_MAX_RETRIES; attempt++) {
      try {
        if (!fs.existsSync(filePath)) {
          return true;
        }
        fs.unlinkSync(filePath);
        return true;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code === 'ENOENT') {
          return true;
        }

        if (TASKBOOK_FILE_DELETE_RETRY_CODES.has(err?.code || '') && attempt < TASKBOOK_FILE_DELETE_MAX_RETRIES - 1) {
          try {
            fs.rmSync(filePath, { force: true });
            return true;
          } catch (rmError) {
            const rmErr = rmError as NodeJS.ErrnoException;
            if (rmErr?.code === 'ENOENT') {
              return true;
            }
          }
          sleepSync(TASKBOOK_FILE_DELETE_RETRY_MS);
          continue;
        }

        try {
          fs.rmSync(filePath, { force: true });
          return true;
        } catch (rmError) {
          const rmErr = rmError as NodeJS.ErrnoException;
          if (rmErr?.code === 'ENOENT') {
            return true;
          }
        }

        return false;
      }
    }

    return !fs.existsSync(filePath);
  }

  private readTaskBookFile(filePath: string): TaskBook | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as TaskBook;
      return this.normalize(parsed);
    } catch {
      return null;
    }
  }

  private shouldPreferHistorySnapshot(activeTaskBook: TaskBook | null, historyTaskBook: TaskBook | null): boolean {
    if (!historyTaskBook) {
      return false;
    }
    if (!activeTaskBook) {
      return true;
    }

    const activeRevision = typeof activeTaskBook.revision === 'number' ? activeTaskBook.revision : 0;
    const historyRevision = typeof historyTaskBook.revision === 'number' ? historyTaskBook.revision : 0;
    if (historyRevision !== activeRevision) {
      return historyRevision > activeRevision;
    }

    const activeUpdatedAt = Date.parse(activeTaskBook.updatedAt || activeTaskBook.createdAt || '');
    const historyUpdatedAt = Date.parse(historyTaskBook.updatedAt || historyTaskBook.createdAt || '');
    if (Number.isFinite(activeUpdatedAt) && Number.isFinite(historyUpdatedAt) && historyUpdatedAt !== activeUpdatedAt) {
      return historyUpdatedAt > activeUpdatedAt;
    }

    if (isTerminalTaskBookStatus(historyTaskBook.status) && !isTerminalTaskBookStatus(activeTaskBook.status)) {
      return true;
    }

    return false;
  }

  private getInProcessLockDepth(taskBookId: string): number {
    return IN_PROCESS_LOCK_DEPTHS.get(taskBookId) ?? 0;
  }

  private enterInProcessLock(taskBookId: string): void {
    IN_PROCESS_LOCK_DEPTHS.set(taskBookId, this.getInProcessLockDepth(taskBookId) + 1);
  }

  private exitInProcessLock(taskBookId: string): void {
    const nextDepth = this.getInProcessLockDepth(taskBookId) - 1;
    if (nextDepth > 0) {
      IN_PROCESS_LOCK_DEPTHS.set(taskBookId, nextDepth);
      return;
    }
    IN_PROCESS_LOCK_DEPTHS.delete(taskBookId);
  }

  private readLockOwnerPid(lockPath: string): number | null {
    try {
      const raw = fs.readFileSync(lockPath, 'utf-8');
      const parsed = JSON.parse(raw) as { pid?: unknown; ownerPid?: unknown };
      if (typeof parsed.pid === 'number') {
        return parsed.pid;
      }
      return typeof parsed.ownerPid === 'number' ? parsed.ownerPid : null;
    } catch {
      return null;
    }
  }

  private isProcessAlive(pid: number | null): boolean {
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
      return false;
    }

    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'EPERM') {
        return true;
      }
      return false;
    }
  }

  private normalize(taskBook: TaskBook): TaskBook {
    if (typeof taskBook.revision !== 'number') {
      taskBook.revision = 0;
    }
    if (!taskBook.updatedAt) {
      taskBook.updatedAt = taskBook.createdAt;
    }
    taskBook.plan = normalizeTaskBookPlan(taskBook.id, taskBook.plan, taskBook.revision) ?? taskBook.plan;
    taskBook.tasks = (taskBook.tasks ?? []).map(task => ({
      ...task,
      executionSpec: normalizeExecutionSpec(task.executionSpec),
    }));
    return taskBook;
  }

  private touch(taskBook: TaskBook): void {
    if (typeof taskBook.revision !== 'number') {
      taskBook.revision = 0;
    }
    taskBook.revision += 1;
    taskBook.updatedAt = now();
    if (taskBook.plan) {
      taskBook.plan = normalizeTaskBookPlan(taskBook.id, taskBook.plan, taskBook.revision);
    }
  }

  private assertRevision(taskBook: TaskBook, expectedRevision: number | undefined): void {
    if (typeof expectedRevision !== 'number') return;
    const actual = typeof taskBook.revision === 'number' ? taskBook.revision : 0;
    if (actual !== expectedRevision) {
      throw new TaskBookConflictError(taskBook.id, expectedRevision, actual);
    }
  }

  private withTaskBookLock<T>(taskBookId: string, fn: () => T, opts?: { timeoutMs?: number }): T {
    const lockPath = this.getLockPath(taskBookId);
    ensureDir(path.dirname(lockPath));

    if (this.getInProcessLockDepth(taskBookId) > 0) {
      this.enterInProcessLock(taskBookId);
      try {
        return fn();
      } finally {
        this.exitInProcessLock(taskBookId);
      }
    }

    const startedAt = Date.now();
    const timeoutMs = opts?.timeoutMs ?? this.lockTimeoutMs;

    while (true) {
      try {
        const fd = fs.openSync(lockPath, 'wx');
        this.enterInProcessLock(taskBookId);
        try {
          const payload = { pid: process.pid, createdAt: now(), taskBookId };
          fs.writeFileSync(fd, JSON.stringify(payload, null, 2), 'utf-8');
        } catch {
          // ignore
        }

        try {
          return fn();
        } finally {
          try {
            fs.closeSync(fd);
          } catch {
            // ignore
          }
          this.cleanupLockFile(lockPath);
          this.exitInProcessLock(taskBookId);
        }
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code !== 'EEXIST') {
          throw error;
        }

        const ownerPid = this.readLockOwnerPid(lockPath);
        if (ownerPid === process.pid) {
          this.enterInProcessLock(taskBookId);
          try {
            return fn();
          } finally {
            this.exitInProcessLock(taskBookId);
            this.cleanupLockFile(lockPath);
          }
        }

        if (ownerPid && !this.isProcessAlive(ownerPid)) {
          this.cleanupLockFile(lockPath);
          continue;
        }

        // lock exists: check staleness
        try {
          const stat = fs.statSync(lockPath);
          const ageMs = Date.now() - stat.mtimeMs;
          if (ageMs > LOCK_STALE_MS) {
            this.cleanupLockFile(lockPath);
            continue;
          }
        } catch {
          // ignore
        }

        if (Date.now() - startedAt > timeoutMs) {
          let lockInfo = '';
          try {
            lockInfo = fs.readFileSync(lockPath, 'utf-8').slice(0, 2000);
          } catch {
            // ignore
          }
          const details = lockInfo ? `\nlock info:\n${lockInfo}` : '';
          throw new Error(`TaskBook is locked: ${taskBookId} (waited ${timeoutMs}ms)${details}`);
        }

        sleepSync(this.lockRetryMs);
      }
    }
  }

  create(params: CreateTaskBookParams): TaskBook {
    const id = generateTaskBookId(params.title);

    const taskBook: TaskBook = {
      id,
      title: params.title,
      description: params.description,
      taskType: params.taskType,
      createdAt: now(),
      status: 'draft',
      plan: normalizeTaskBookPlan(id, params.plan, 0) ?? {
        planId: id,
        version: 1,
        linkedTaskBookRevision: 0,
        source: 'manual',
      },
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
  save(taskBook: TaskBook): void {
    const dir = isTerminalTaskBookStatus(taskBook.status)
      ? this.getHistoryDir()
      : this.getActiveDir();

    ensureDir(dir);
    const filePath = path.join(dir, `${taskBook.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(taskBook, null, 2), 'utf-8');
  }

  /**
   * 读取 TaskBook
   */
  load(id: string): TaskBook | null {
    const activeTaskBook = this.readTaskBookFile(this.getActiveFilePath(id));
    const historyTaskBook = this.readTaskBookFile(this.getHistoryFilePath(id));

    if (this.shouldPreferHistorySnapshot(activeTaskBook, historyTaskBook)) {
      return historyTaskBook;
    }

    return activeTaskBook ?? historyTaskBook;
  }

  /**
   * 列出所有活跃的 TaskBook
   */
  listActive(): TaskBook[] {
    const dir = this.getActiveDir();
    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const activeTaskBooks: TaskBook[] = [];

    for (const fileName of files) {
      const activeTaskBook = this.readTaskBookFile(path.join(dir, fileName));
      if (!activeTaskBook) continue;
      if (isTerminalTaskBookStatus(activeTaskBook.status)) continue;

      const historyTaskBook = this.readTaskBookFile(this.getHistoryFilePath(activeTaskBook.id));
      if (this.shouldPreferHistorySnapshot(activeTaskBook, historyTaskBook)) {
        continue;
      }

      activeTaskBooks.push(activeTaskBook);
    }

    return activeTaskBooks;
  }

  /**
   * 更新 TaskBook 状态
   */
  updateStatus(id: string, status: TaskBookStatus, expectedRevision?: number): TaskBook | null {
    return this.withTaskBookLock(id, () => {
      const taskBook = this.load(id);
      if (!taskBook) return null;

      this.assertRevision(taskBook, expectedRevision);

      const oldStatus = taskBook.status;
      taskBook.status = status;

      // 记录状态变更
      if (status === 'confirmed') {
        taskBook.confirmedAt = now();
      } else if (status === 'completed' || status === 'aborted') {
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

      this.touch(taskBook);
      this.save(taskBook);

      // Terminal TaskBooks are persisted to history first. Cleaning active/ is best-effort
      // because Windows file locks can transiently block unlink during archival.
      if (isTerminalTaskBookStatus(status)) {
        this.cleanupArchivedActiveFile(this.getActiveFilePath(id));
      }

      return taskBook;
    });
  }

  updatePlan(id: string, patch: Partial<TaskBookPlan>, expectedRevision?: number): TaskBook | null {
    return this.withTaskBookLock(id, () => {
      const taskBook = this.load(id);
      if (!taskBook) return null;

      this.assertRevision(taskBook, expectedRevision);

      const before = taskBook.plan ? { ...taskBook.plan } : null;
      taskBook.plan = normalizeTaskBookPlan(taskBook.id, {
        ...(taskBook.plan ?? { planId: taskBook.id, version: 1 }),
        ...patch,
      }, taskBook.revision ?? 0) ?? taskBook.plan;

      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId: null,
        changeType: 'modified',
        reason: '更新 TaskBook 计划契约',
        before: before ?? undefined,
        after: taskBook.plan as unknown as Record<string, unknown>,
      });

      this.touch(taskBook);
      this.save(taskBook);
      return taskBook;
    });
  }

  /**
   * 添加任务
   */
  addTask(
    id: string,
    task: Pick<TaskItem, 'title' | 'type'> & Partial<Omit<TaskItem, 'id' | 'title' | 'type'>>,
    expectedRevision?: number
  ): TaskBook | null {
    return this.withTaskBookLock(id, () => {
      const taskBook = this.load(id);
      if (!taskBook) return null;

      this.assertRevision(taskBook, expectedRevision);

      const taskId = `task-${taskBook.tasks.length + 1}`;
      const newTask: TaskItem = {
        id: taskId,
        parentId: task.parentId,
        title: task.title,
        type: task.type,
        status: task.status ?? 'pending',
        priority: task.priority ?? 'medium',
        dependencies: task.dependencies ?? [],
        acceptanceCriteria: task.acceptanceCriteria ?? [],
        scope: task.scope,
        executionSpec: normalizeExecutionSpec(task.executionSpec),
        actualWork: task.actualWork,
        blockedReason: task.blockedReason,
        executedBy: task.executedBy,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        handoffs: task.handoffs,
      };

      taskBook.tasks.push(newTask);

      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId,
        changeType: 'added',
        reason: `添加任务: ${task.title}`,
        after: newTask as unknown as Record<string, unknown>,
      });

      this.touch(taskBook);
      this.save(taskBook);
      return taskBook;
    });
  }

  /**
   * 批量添加任务（单次 touch/save，适合 planner apply-plan 等批处理场景）
   */
  addTasksBatch(
    taskBookId: string,
    tasks: Array<Pick<TaskItem, 'title' | 'type'> & Partial<Omit<TaskItem, 'id' | 'title' | 'type'>>>,
    opts?: { expectedRevision?: number; reasonPrefix?: string }
  ): { taskBook: TaskBook; taskIds: string[] } | null {
    return this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;

      this.assertRevision(taskBook, opts?.expectedRevision);

      const taskIds: string[] = [];
      const reasonPrefix = opts?.reasonPrefix;

      for (const task of tasks) {
        const taskId = `task-${taskBook.tasks.length + 1}`;
        const newTask: TaskItem = {
          id: taskId,
          parentId: task.parentId,
          title: task.title,
          type: task.type,
          status: task.status ?? 'pending',
          priority: task.priority ?? 'medium',
          dependencies: task.dependencies ?? [],
          acceptanceCriteria: task.acceptanceCriteria ?? [],
          scope: task.scope,
          executionSpec: normalizeExecutionSpec(task.executionSpec),
          actualWork: task.actualWork,
          blockedReason: task.blockedReason,
          executedBy: task.executedBy,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          handoffs: task.handoffs,
        };

        taskBook.tasks.push(newTask);
        taskIds.push(taskId);

        this.addChangelogEntry(taskBook, {
          timestamp: now(),
          taskId,
          changeType: 'added',
          reason: `${reasonPrefix ? `${reasonPrefix}: ` : ''}添加任务: ${task.title}`,
          after: newTask as unknown as Record<string, unknown>,
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
  applyPlannerPlan(
    taskBookId: string,
    requestId: string,
    parsedPlan: ParsedPlannerPlan,
    expectedRevision?: number
  ): { taskBook: TaskBook; taskIds: string[]; planIdToTaskId: Record<string, string> } | null {
    return this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;

      this.assertRevision(taskBook, expectedRevision);

      const planTasks = parsedPlan.tasks;

      if (!Array.isArray(planTasks) || planTasks.length === 0) {
        throw new Error('错误: planner planTasks 不能为空');
      }

      const planIdToIndex = new Map<string, number>();
      const planIdToTaskId: Record<string, string> = {};

      const base = taskBook.tasks.length + 1;
      for (let i = 0; i < planTasks.length; i++) {
        const planId = planTasks[i]?.planId;
        if (typeof planId !== 'string' || !planId) {
          throw new Error(`错误: planTasks[${i}].planId 必须是非空字符串`);
        }
        if (planIdToIndex.has(planId)) {
          throw new Error(`错误: planId 重复: ${planId}`);
        }
        planIdToIndex.set(planId, i);
        planIdToTaskId[planId] = `task-${base + i}`;
      }

      const taskIds: string[] = [];

      for (let i = 0; i < planTasks.length; i++) {
        const t = planTasks[i];
        const taskId = planIdToTaskId[t.planId];
        const deps = t.dependencies ?? [];

        const mappedDeps: string[] = [];
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

        const newTask: TaskItem = {
          id: taskId,
          title: t.title,
          type: t.type,
          status: 'pending',
          priority: t.priority ?? 'medium',
          dependencies: mappedDeps,
          acceptanceCriteria: t.acceptanceCriteria ?? [],
          scope: t.scope,
          executionSpec: normalizeExecutionSpec(t.executionSpec),
          handoffs: t.handoffs,
        };

        taskBook.tasks.push(newTask);
        taskIds.push(taskId);

        this.addChangelogEntry(taskBook, {
          timestamp: now(),
          taskId,
          changeType: 'added',
          reason: `planner:${requestId}: 添加任务: ${t.title}`,
          after: newTask as unknown as Record<string, unknown>,
        });
      }

      taskBook.plan = normalizeTaskBookPlan(taskBook.id, {
        ...taskBook.plan,
        ...parsedPlan.plan,
        source: parsedPlan.plan.source ?? 'planner',
      }, taskBook.revision ?? 0) ?? taskBook.plan;

      this.touch(taskBook);
      this.save(taskBook);
      return { taskBook, taskIds, planIdToTaskId };
    });
  }

  /**
   * 更新任务字段（不改变 id）
   */
  updateTask(
    taskBookId: string,
    taskId: string,
    patch: Partial<Omit<TaskItem, 'id'>>,
    expectedRevision?: number
  ): TaskBook | null {
    return this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;

      this.assertRevision(taskBook, expectedRevision);

      const task = taskBook.tasks.find(t => t.id === taskId);
      if (!task) return null;

      const before = { ...task };

      // status 统一处理 startedAt/completedAt/blockedReason/actualWork
      if (patch.status && patch.status !== task.status) {
        task.status = patch.status;

        if (patch.status === 'in_progress') {
          task.startedAt = now();
        } else if (patch.status === 'done') {
          task.completedAt = now();
          if (patch.actualWork) {
            task.actualWork = patch.actualWork;
          }
        } else if (patch.status === 'blocked') {
          if (patch.blockedReason) {
            task.blockedReason = patch.blockedReason;
          }
        }
      }

      // 其余字段直接更新（避免覆盖 undefined）
      const updatable: Array<keyof Omit<TaskItem, 'id'>> = [
        'parentId',
        'title',
        'type',
        'priority',
        'dependencies',
        'acceptanceCriteria',
        'scope',
        'executionSpec',
        'actualWork',
        'blockedReason',
        'executedBy',
        'startedAt',
        'completedAt',
        'handoffs',
      ];

      for (const key of updatable) {
        const value = patch[key];
        if (typeof value !== 'undefined') {
          // @ts-expect-error - dynamic update
          task[key] = key === 'executionSpec' ? normalizeExecutionSpec(value as TaskExecutionSpec | undefined) : value;
        }
      }

      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId,
        changeType: 'modified',
        reason: '更新任务字段',
        before: before as unknown as Record<string, unknown>,
        after: task as unknown as Record<string, unknown>,
      });

      this.touch(taskBook);
      this.save(taskBook);
      return taskBook;
    });
  }

  /**
   * 解除 blocked 任务，恢复为 pending，并记录 resolution
   */
  unblockTask(taskBookId: string, taskId: string, resolution: string, expectedRevision?: number): TaskBook | null {
    return this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;

      this.assertRevision(taskBook, expectedRevision);

      const task = taskBook.tasks.find(t => t.id === taskId);
      if (!task) return null;
      if (task.status !== 'blocked') return taskBook;

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
  appendTaskActualWork(taskBookId: string, taskId: string, text: string, expectedRevision?: number): TaskBook | null {
    return this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;

      this.assertRevision(taskBook, expectedRevision);

      const task = taskBook.tasks.find(t => t.id === taskId);
      if (!task) return null;

      const before = task.actualWork ?? '';
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

  appendTaskHandoffs(
    taskBookId: string,
    taskId: string,
    handoffs: HandoffEntry[],
    expectedRevision?: number
  ): TaskBook | null {
    return this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;

      this.assertRevision(taskBook, expectedRevision);

      const task = taskBook.tasks.find(t => t.id === taskId);
      if (!task) return null;
      if (!Array.isArray(handoffs) || handoffs.length === 0) return taskBook;

      const normalized = handoffs.map(handoff => ({
        ...handoff,
        deliverables: handoff.deliverables && handoff.deliverables.length > 0
          ? Array.from(new Set(handoff.deliverables))
          : undefined,
      }));

      const before = Array.isArray(task.handoffs) ? [...task.handoffs] : [];
      task.handoffs = [...before, ...normalized];

      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId,
        changeType: 'modified',
        reason: `追加 handoff 记录 (${normalized.length})`,
        before: { handoffs: before },
        after: { handoffs: task.handoffs },
      });

      this.touch(taskBook);
      this.save(taskBook);
      return taskBook;
    });
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(
    taskBookId: string,
    taskId: string,
    status: TaskItem['status'],
    actualWork?: string,
    blockedReason?: string,
    expectedRevision?: number
  ): TaskBook | null {
    return this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;

      this.assertRevision(taskBook, expectedRevision);

      const task = taskBook.tasks.find(t => t.id === taskId);
      if (!task) return null;

      const oldStatus = task.status;
      task.status = status;

      if (status === 'in_progress') {
        task.startedAt = now();
      } else if (status === 'done') {
        task.completedAt = now();
        if (actualWork) {
          task.actualWork = actualWork;
        }
      } else if (status === 'blocked' && blockedReason) {
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
  private addChangelogEntry(taskBook: TaskBook, entry: ChangeEntry): void {
    taskBook.changelog.push(entry);
  }

  /**
   * 记录变更
   */
  logChange(
    taskBookId: string,
    taskId: string | null,
    changeType: ChangeEntry['changeType'],
    reason: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
    expectedRevision?: number
  ): TaskBook | null {
    return this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;

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
  generateAcceptanceReport(taskBookId: string): AcceptanceReport | null {
    const taskBook = this.load(taskBookId);
    if (!taskBook) return null;

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

    const report: AcceptanceReport = {
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
    const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
    const gateEvents: NonNullable<AcceptanceReport['gates']> = [];

    for (const entry of taskBook.changelog) {
      const after = entry.after;
      if (!isPlainObject(after)) continue;
      if (after.event !== 'gate') continue;

      const gateId = after.gateId;
      if (typeof gateId !== 'string' || gateId.length === 0) continue;

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

      let commandRuns: NonNullable<AcceptanceReport['gates']>[number]['commandRuns'] | undefined;
      const rawRuns = after.commandRuns;
      if (Array.isArray(rawRuns)) {
        const parsedRuns: NonNullable<AcceptanceReport['gates']>[number]['commandRuns'] = [];
        for (const r of rawRuns) {
          if (!isPlainObject(r)) continue;
          if (typeof r.command !== 'string') continue;
          if (typeof r.ok !== 'boolean') continue;
          const code = (typeof r.code === 'number' || r.code === null) ? (r.code as number | null) : null;
          const durationMs = typeof r.durationMs === 'number' && Number.isFinite(r.durationMs) ? r.durationMs : 0;
          parsedRuns.push({ command: r.command, ok: r.ok, code, durationMs });
        }
        if (parsedRuns.length > 0) commandRuns = parsedRuns;
      }

      const totalDurationMs = commandRuns ? commandRuns.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) : undefined;

      let missingScripts: NonNullable<AcceptanceReport['gates']>[number]['missingScripts'] | undefined;
      const rawMissing = after.missingScripts;
      if (Array.isArray(rawMissing)) {
        const parsedMissing = rawMissing.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0);
        if (parsedMissing.length > 0) missingScripts = parsedMissing;
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
          const budgetMs = g.budgetMinutes * 60_000;
          if (g.totalDurationMs > budgetMs) {
            report.recommendations.suggested.push(
              `gate ${g.gateId} 耗时 ${(g.totalDurationMs / 1000).toFixed(1)}s，超过 budget ${g.budgetMinutes}min；建议调整 smoke/full 命令或缩小单批改动范围`
            );
          }
        }
      }
    }

    // 汇总 batches（从 changelog 里提取 event=batch 的记录）
    const batchMap = new Map<string, NonNullable<AcceptanceReport['batches']>[number]>();

    for (const entry of taskBook.changelog) {
      const after = entry.after;
      if (!isPlainObject(after)) continue;
      if (after.event !== 'batch') continue;

      const stepId = after.stepId;
      const batchIndex = after.batchIndex;
      if (typeof stepId !== 'string' || stepId.length === 0) continue;
      if (typeof batchIndex !== 'number' || !Number.isFinite(batchIndex)) continue;

      const key = `${stepId}#${batchIndex}`;
      const existing = batchMap.get(key) ?? {
        stepId,
        batchIndex,
        taskIds: [] as string[],
      };

      const rawTaskIds = after.taskIds;
      if (Array.isArray(rawTaskIds)) {
        const parsedTaskIds = rawTaskIds.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0);
        if (parsedTaskIds.length > 0) existing.taskIds = parsedTaskIds;
      }

      if (typeof after.riskTier === 'string') existing.riskTier = after.riskTier;
      if (typeof after.maxFiles === 'number' && Number.isFinite(after.maxFiles)) existing.maxFiles = after.maxFiles;

      if (typeof after.status === 'string' && after.status.length > 0) {
        existing.status = after.status;
        existing.endedAt = entry.timestamp;
      } else {
        existing.startedAt = entry.timestamp;
      }

      batchMap.set(key, existing);
    }

    if (batchMap.size > 0) {
      const batches = Array.from(batchMap.values()).sort((a, b) => {
        const s = a.stepId.localeCompare(b.stepId);
        if (s !== 0) return s;
        return a.batchIndex - b.batchIndex;
      });

      // attach smoke gate status if available (batched implement flow)
      const gateList = report.gates ?? [];
      for (const b of batches) {
        const match = [...gateList].reverse().find(g =>
          g.gateId === 'smoke_passed'
          && g.stepId === b.stepId
          && g.eventContext === 'batch_gate'
          && typeof g.batchIndex === 'number'
          && g.batchIndex === b.batchIndex
        );
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
    const agentCallEvents: NonNullable<AcceptanceReport['agentCalls']> = [];
    const lastActionByRequestId = new Map<string, 'created' | 'applied'>();

    for (const entry of taskBook.changelog) {
      const after = entry.after;
      if (!isPlainObject(after)) continue;
      if (after.event !== 'agent-call') continue;

      const requestId = after.requestId;
      if (typeof requestId !== 'string' || requestId.length === 0) continue;

      const action = after.action === 'created' || after.action === 'applied' ? (after.action as 'created' | 'applied') : undefined;
      if (action) lastActionByRequestId.set(requestId, action);

      const agentId = typeof after.agentId === 'string' ? after.agentId : undefined;

      const kindRaw = after.kind;
      const kind = kindRaw === 'planner' || kindRaw === 'manual-task' ? (kindRaw as 'planner' | 'manual-task') : undefined;

      const statusRaw = after.status;
      const status = statusRaw === 'success' || statusRaw === 'failed' || statusRaw === 'blocked'
        ? (statusRaw as 'success' | 'failed' | 'blocked')
        : undefined;

      const createdAt = typeof after.createdAt === 'string' ? after.createdAt : undefined;
      const completedAt = typeof after.completedAt === 'string' ? after.completedAt : undefined;
      const promptPath = typeof after.promptPath === 'string' ? after.promptPath : undefined;
      const resultPath = typeof after.resultPath === 'string' ? after.resultPath : undefined;

      let artifacts: NonNullable<AcceptanceReport['agentCalls']>[number]['artifacts'] | undefined;
      const rawArtifacts = after.artifacts;
      if (Array.isArray(rawArtifacts)) {
        const parsed: NonNullable<AcceptanceReport['agentCalls']>[number]['artifacts'] = [];
        for (const a of rawArtifacts) {
          if (!isPlainObject(a)) continue;
          const type = typeof a.type === 'string' ? a.type : '';
          const p = typeof a.path === 'string' ? a.path : '';
          if (!type || !p) continue;
          const description = typeof a.description === 'string' ? a.description : undefined;
          parsed.push({ type, path: p, description });
        }
        if (parsed.length > 0) artifacts = parsed;
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
        report.recommendations.mustDo.push(
          `补齐 ${pending} 个 agent-call 的 result.json 回填（.codebuddy/agent-calls/*.result.json），以恢复闭环执行`
        );
      }
    }

    // Scope 纪律建议：缺少 scope 会导致 batching / 并发冲突检测退化
    const missingScope = taskBook.tasks.filter(t => {
      if (t.status !== 'pending') return false;
      if (t.type !== 'analysis' && t.type !== 'design' && t.type !== 'implement') return false;
      const files = t.scope?.files ?? [];
      const modules = t.scope?.modules ?? [];
      return files.length === 0 && modules.length === 0;
    });
    if (missingScope.length > 0) {
      report.recommendations.suggested.push(
        `发现 ${missingScope.length} 个 pending 的实现相关任务缺少 scope.files/modules；批量预算与并行冲突检测将退化为串行。建议在规划阶段为任务补齐 scope。`
      );
    }

    const missingExecutionSpec = taskBook.tasks.filter(task =>
      (task.type === 'design' || task.type === 'test' || task.type === 'implement' || task.type === 'review')
      && (!task.executionSpec || (!task.executionSpec.deliverables?.length && !task.executionSpec.verification?.length))
    );
    if (missingExecutionSpec.length > 0) {
      report.recommendations.suggested.push(
        `发现 ${missingExecutionSpec.length} 个任务缺少 executionSpec deliverables/verification；执行器将只能依赖 acceptanceCriteria 和自由文本，建议补齐最小执行契约。`
      );
    }

    const missingBusinessAc = taskBook.tasks.filter(task => task.acceptanceCriteria.length === 0);
    if (missingBusinessAc.length > 0) {
      report.recommendations.mustDo.push(
        `发现 ${missingBusinessAc.length} 个任务缺少 acceptanceCriteria；这些任务当前没有明确的业务验收标准。`
      );
    }

    // T3.4: 汇总执行者分布（从任务的 executedBy 字段）
    const executorCounts: Record<string, number> = {};
    for (const task of taskBook.tasks) {
      if (task.status === 'done' && task.executedBy) {
        executorCounts[task.executedBy] = (executorCounts[task.executedBy] || 0) + 1;
      }
    }
    if (Object.keys(executorCounts).length > 0) {
      (report.summary as Record<string, unknown>)['executorDistribution'] = executorCounts;
    }

    // T3.4: 汇总批次完成信息（从 changelog 中提取 batch_complete 事件）
    const batchCompleteEvents: Array<{ succeeded: number; failed: number; duration: number; executors: string[] }> = [];
    for (const entry of taskBook.changelog) {
      const after = entry.after;
      if (!isPlainObject(after)) continue;
      if (after.event !== 'batch_complete') continue;
      batchCompleteEvents.push({
        succeeded: typeof after.succeeded === 'number' ? after.succeeded : 0,
        failed: typeof after.failed === 'number' ? after.failed : 0,
        duration: typeof after.duration === 'number' ? after.duration : 0,
        executors: Array.isArray(after.executors) ? after.executors.filter((v: unknown): v is string => typeof v === 'string') : [],
      });
    }
    if (batchCompleteEvents.length > 0) {
      (report.summary as Record<string, unknown>)['batchCompleteCount'] = batchCompleteEvents.length;
      (report.summary as Record<string, unknown>)['totalBatchDuration'] = batchCompleteEvents.reduce((s, b) => s + b.duration, 0);
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
  getParallelizableTasks(taskBookId: string): TaskItem[] {
    const taskBook = this.load(taskBookId);
    if (!taskBook) return [];

    const completedTaskIds = new Set(
      taskBook.tasks
        .filter(t => t.status === 'done' || t.status === 'skipped')
        .map(t => t.id)
    );

    return taskBook.tasks.filter(task => {
      // 只考虑 pending 状态的任务
      if (task.status !== 'pending') return false;

      // 检查所有依赖是否已完成
      return task.dependencies.every(depId => completedTaskIds.has(depId));
    });
  }

  /**
   * 格式化 TaskBook 为用户可读的计划展示
   */
  formatForDisplay(taskBook: TaskBook): string {
    const typeEmoji: Record<TaskItem['type'], string> = {
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

    const typeLabel: Record<TaskItem['type'], string> = {
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

    const lines: string[] = [
      '╔══════════════════════════════════════════════════════════════╗',
      `║ 📋 任务计划书 - ${taskBook.title.padEnd(40)}║`,
      '╠══════════════════════════════════════════════════════════════╣',
      `║ 📝 需求概述: ${taskBook.description.slice(0, 44).padEnd(44)}║`,
      `║ 🧭 Workflow/Spec: ${`${taskBook.plan?.recommendedWorkflowId ?? '-'} / ${taskBook.plan?.specMode ?? '-'}`.slice(0, 40).padEnd(40)}║`,
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
      if (task.executionSpec?.agentHint) {
        lines.push(`║     ↳ agent=${task.executionSpec.agentHint}`.slice(0, 62).padEnd(61) + '║');
      }
      if (task.executionSpec?.summary) {
        lines.push(`║     ↳ spec=${task.executionSpec.summary}`.slice(0, 62).padEnd(61) + '║');
      }
    });

    lines.push('╠══════════════════════════════════════════════════════════════╣');
    lines.push('║ ❓ 请确认是否开始执行？                                        ║');
    lines.push('║ [✅ 确认执行] [✏️ 修改计划] [❌ 取消]                          ║');
    lines.push('╚══════════════════════════════════════════════════════════════╝');

    return lines.join('\n');
  }

  /**
   * 持久化 FinalReport 到 TaskBook
   *
   * 将 Phase 7 汇总报告写入 TaskBook.finalReport 字段，
   * 同时将报告写入 .codebuddy/reports/final-{taskBookId}.json 方便外部工具读取。
   *
   * 使用文件锁保证 load → save 的原子性，防止并发写入导致数据丢失。
   */
  saveFinalReport(taskBookId: string, report: FinalReport): void {
    this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) throw new Error(`TaskBook not found: ${taskBookId}`);

      const updated: TaskBook = { ...taskBook, finalReport: report };
      this.touch(updated);
      this.save(updated);
    });

    // 独立报告文件写入在锁外执行：不涉及 TaskBook 状态，失败不影响主流程
    const reportsDir = path.join(this.baseDir, '.codebuddy', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const reportPath = path.join(reportsDir, `final-${taskBookId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  }
}

// 导出单例
export const taskBookManager = new TaskBookManager();

type ParsedCli = {
  command: string | null;
  positionals: string[];
  flags: Record<string, string | boolean | string[]>;
};

type PlannerPlanTask = {
  planId: string;
  title: string;
  type: TaskItem['type'];
  priority?: TaskItem['priority'];
  dependencies?: string[];
  acceptanceCriteria?: string[];
  scope?: TaskScope;
  executionSpec?: TaskExecutionSpec;
  handoffs?: HandoffEntry[];
};

type ParsedPlannerPlan = {
  plan: Partial<TaskBookPlan>;
  tasks: PlannerPlanTask[];
};

type AgentCallStatus = 'success' | 'failed' | 'blocked';
type AgentCallResult = {
  requestId: string;
  kind?: 'planner' | 'manual-task';
  status: AgentCallStatus;
  output?: unknown;
  error?: { code?: string; message?: string };
  completedAt?: string;
};

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
  'plan',
  'apply-plan',
]);

function isTruthyEnv(name: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
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

function showHelp(): void {
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
  --workflow-hint <micro|sprint|default>   （可选）路由先决策的 workflow 约束
  --spec-mode <inline-open-spec|linked-spec-kit>  （可选）路由先决策的 spec 粒度
  --doc-tier <minimal|standard|full>       （可选）文档留存级别
  --doc-artifact <name>                    （可重复）建议留存的文档/报告名称
  --plan-summary <text>        （可选）顶层计划摘要
  --goal <text>                （可重复）目标
  --assumption <text>          （可重复）前提假设
  --plan-constraint <text>     （可重复）顶层约束
  --clarification <text>       （可重复）待澄清项
  --out-of-scope <text>        （可重复）非目标范围
  --risk <summary|level:summary> （可重复）顶层风险
  --plan-spec-ref <path>       （可选）Spec / Spec Kit 路径
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
  --agent-hint <coder|tester|reviewer|refactor|doc-writer|planner>
  --spec-summary <text>        （可选）任务执行摘要
  --deliverable <text>         （可重复）交付物
  --verify <text>              （可重复）技术校验动作
  --constraint <text>          （可重复）任务执行约束
  --deps-note <text>           （可选）依赖说明
  --spec-ref <path>            （可选）Spec / Spec Kit 引用
  --json                       输出 JSON

update-task options:
  --files <p1,p2>              （可选）任务涉及文件列表（逗号分隔）
  --modules <m1,m2>            （可选）任务涉及模块列表（逗号分隔）
  --tags <t1,t2>               （可选）任务标签（逗号分隔）
  --status <pending|in_progress|done|blocked|skipped>
  --priority <critical|high|medium|low>
  --deps <id1,id2>
  --ac <text>                  验收标准（可重复；会覆盖）
  --agent-hint <coder|tester|reviewer|refactor|doc-writer|planner>
  --spec-summary <text>
  --deliverable <text>         （可重复；会覆盖）
  --verify <text>              （可重复；会覆盖）
  --constraint <text>          （可重复；会覆盖）
  --deps-note <text>
  --spec-ref <path>
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
  --workflow-hint <micro|sprint|default>   （可选）强制传给 planner 的 workflow 约束
  --spec-mode <inline-open-spec|linked-spec-kit>  （可选）强制传给 planner 的 spec 粒度
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

function parseCli(argv: string[]): ParsedCli {
  const args = argv.slice();
  const command = args.shift() ?? null;

  const positionals: string[] = [];
  const flags: Record<string, string | boolean | string[]> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const eqIndex = arg.indexOf('=');
    const rawKey = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
    const key = rawKey.trim();

    let value: string | boolean = true;
    if (eqIndex >= 0) {
      value = arg.slice(eqIndex + 1);
    } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
      value = args[++i];
    }

    const existing = flags[key];
    if (typeof existing === 'undefined') {
      flags[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(String(value));
      flags[key] = existing;
    } else {
      flags[key] = [String(existing), String(value)];
    }
  }

  return { command, positionals, flags };
}

function flagAsString(flags: ParsedCli['flags'], key: string): string | undefined {
  const v = flags[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function flagAsBool(flags: ParsedCli['flags'], key: string): boolean {
  return flags[key] === true;
}

function flagAsStringArray(flags: ParsedCli['flags'], key: string): string[] {
  const v = flags[key];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v;
  return [];
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function buildScope(files: string[], modules: string[], tags: string[]): TaskScope | undefined {
  const scope: TaskScope = {};
  if (files.length > 0) scope.files = files;
  if (modules.length > 0) scope.modules = modules;
  if (tags.length > 0) scope.tags = tags;
  return Object.keys(scope).length > 0 ? scope : undefined;
}

function buildExecutionSpecFromFlags(flags: ParsedCli['flags']): TaskExecutionSpec | undefined {
  const agentHintRaw = flagAsString(flags, 'agent-hint');
  const agentHint = agentHintRaw && ALLOWED_TASK_AGENT_HINTS.has(agentHintRaw as TaskAgentHint)
    ? agentHintRaw as TaskAgentHint
    : undefined;

  return normalizeExecutionSpec({
    summary: flagAsString(flags, 'spec-summary'),
    agentHint,
    deliverables: flagAsStringArray(flags, 'deliverable'),
    verification: flagAsStringArray(flags, 'verify'),
    constraints: flagAsStringArray(flags, 'constraint'),
    dependenciesNote: flagAsString(flags, 'deps-note'),
    specRef: flagAsString(flags, 'spec-ref'),
  });
}

function buildTaskBookPlanFromFlags(flags: ParsedCli['flags']): Partial<TaskBookPlan> | undefined {
  const specModeRaw = flagAsString(flags, 'spec-mode');
  const recommendedWorkflowIdRaw = flagAsString(flags, 'workflow-hint');
  const planSummary = flagAsString(flags, 'plan-summary');
  const documentationTierRaw = flagAsString(flags, 'doc-tier');
  const documentationArtifacts = flagAsStringArray(flags, 'doc-artifact');
  const goals = flagAsStringArray(flags, 'goal');
  const outOfScope = flagAsStringArray(flags, 'out-of-scope');
  const assumptions = flagAsStringArray(flags, 'assumption');
  const constraints = flagAsStringArray(flags, 'plan-constraint');
  const clarifications = flagAsStringArray(flags, 'clarification');
  const specRef = flagAsString(flags, 'plan-spec-ref');

  const plan: Partial<TaskBookPlan> = {
    summary: planSummary,
    documentationArtifacts,
    goals,
    outOfScope,
    assumptions,
    constraints,
    clarifications,
    specRef,
  };

  if (specModeRaw && ALLOWED_SPEC_MODES.has(specModeRaw as TaskSpecMode)) {
    plan.specMode = specModeRaw as TaskSpecMode;
  }
  if (recommendedWorkflowIdRaw && ALLOWED_WORKFLOW_IDS.has(recommendedWorkflowIdRaw as BuiltinWorkflowId)) {
    plan.recommendedWorkflowId = recommendedWorkflowIdRaw as BuiltinWorkflowId;
  }
  if (documentationTierRaw && ['minimal', 'standard', 'full'].includes(documentationTierRaw)) {
    plan.documentationTier = documentationTierRaw as TaskBookPlan['documentationTier'];
  }

  if (typeof flagAsString(flags, 'risk') !== 'undefined' || Array.isArray(flags.risk)) {
    const risks = flagAsStringArray(flags, 'risk').map((entry) => {
      const [levelRaw, ...rest] = entry.split(':');
      const summary = rest.length > 0 ? rest.join(':').trim() : levelRaw.trim();
      const level = rest.length > 0 && (levelRaw === 'low' || levelRaw === 'medium' || levelRaw === 'high')
        ? levelRaw
        : 'medium';
      return normalizePlanRisk({ level, summary });
    }).filter((risk): risk is TaskBookPlanRisk => Boolean(risk));
    if (risks.length > 0) plan.risks = risks;
  }

  const hasExplicitPlanFields =
    Boolean(planSummary)
    || goals.length > 0
    || outOfScope.length > 0
    || assumptions.length > 0
    || constraints.length > 0
    || clarifications.length > 0
    || Boolean(specRef)
    || Boolean(specModeRaw)
    || Boolean(recommendedWorkflowIdRaw)
    || (Array.isArray(plan.risks) && plan.risks.length > 0);

  if (!hasExplicitPlanFields) {
    return undefined;
  }

  plan.source = 'manual';
  return plan;
}

function expectedRevisionFromFlags(flags: ParsedCli['flags']): number | undefined {
  const raw = flagAsString(flags, 'if-rev') ?? flagAsString(flags, 'if-revision');
  if (typeof raw === 'undefined') return undefined;

  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('错误: --if-rev 必须是非负整数');
  }
  return n;
}

function printJson(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

function generateRequestId(): string {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `req-${ts}-${rnd}`;
}

function readTextFileIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

function loadPlannerAgentDefinition(projectRoot: string): { path: string; content: string } | null {
  const candidates = listAgentDefinitionCandidatePaths(projectRoot, 'planner');
  for (const p of candidates) {
    const content = readTextFileIfExists(p);
    if (content) return { path: p, content };
  }
  return null;
}

function extractAgentVersion(agentMarkdown: string): string | undefined {
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

function buildPlannerPrompt(args: {
  requestId: string;
  taskBook: TaskBook;
  projectRoot: string;
  agentDefinitionPath: string | null;
  agentDefinition: string | null;
  promptPath: string;
  resultPath: string;
}): string {
  const agentVersion = args.agentDefinition ? extractAgentVersion(args.agentDefinition) : undefined;
  const header = {
    requestId: args.requestId,
    agentId: 'planner',
    agentVersion,
    taskBookId: args.taskBook.id,
    timestamp: now(),
    taskBookRevision: typeof args.taskBook.revision === 'number' ? args.taskBook.revision : 0,
    recommendedWorkflowId: args.taskBook.plan?.recommendedWorkflowId,
    recommendedSpecMode: args.taskBook.plan?.specMode,
    documentationTier: args.taskBook.plan?.documentationTier,
    documentationArtifacts: args.taskBook.plan?.documentationArtifacts,
    promptPath: args.promptPath,
    resultPath: args.resultPath,
  };

  const references: string[] = [
    '.codebuddy/rules/project-rules.md',
    '.codebuddy/reports/architecture/latest.json',
    '.codebuddy/reports/modules/latest.json',
  ];

  const agentDefinition = args.agentDefinition ?? '(missing AGENT.md)';
  const agentDefinitionHint = args.agentDefinitionPath ? `source: ${args.agentDefinitionPath}` : 'source: (not found)';

  const schemaExample: AgentCallResult = {
    requestId: args.requestId,
    kind: 'planner',
    status: 'success',
    output: {
      planId: args.taskBook.id,
      summary: '将需求拆成可执行任务，并补齐实现约束与验收边界。',
      recommendedWorkflowId: args.taskBook.plan?.recommendedWorkflowId ?? 'default',
      specMode: args.taskBook.plan?.specMode ?? 'inline-open-spec',
      goals: ['拆成可执行任务', '明确交付物与验证方式'],
      outOfScope: ['不处理无关模块'],
      assumptions: ['现有接口契约可复用'],
      constraints: ['不引入新依赖', '沿用现有模块边界'],
      risks: [
        { level: 'medium', summary: '历史模块耦合可能扩大影响面', mitigation: '先做分析任务明确边界' },
      ],
      epics: [
        { id: 'EPIC-1', title: '范围澄清与实现方案' },
      ],
      tasks: [
        {
          planId: 'T1',
          title: '理解需求 & 梳理影响范围',
          type: 'analysis',
          priority: 'high',
          acceptanceCriteria: ['输出影响范围清单', '明确非目标/约束'],
          executionSpec: {
            agentHint: 'planner',
            deliverables: ['影响范围说明'],
            verification: ['确认涉及文件与模块列表完整'],
          },
        },
        {
          planId: 'T2',
          title: '制定实现方案（含接口/数据结构）',
          type: 'design',
          dependencies: ['T1'],
          acceptanceCriteria: ['给出方案与取舍', '明确任务拆分与关键路径'],
          executionSpec: {
            agentHint: 'reviewer',
            deliverables: ['设计说明', '任务拆分清单'],
            verification: ['评审设计是否满足约束条件'],
          },
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
    '- 不要输出过程性推理、自我提醒或“我应该/根据规则”之类的句子。',
    '- 只生成 task 级别的原子任务（INVEST），确保每个任务 1-3 天内可完成。',
    '- 顶层 output.planId 必须等于当前 TaskBook.id。',
    '- 任务类型必须是以下之一：analysis | design | test | implement | review。',
    '- dependencies 只能引用本次计划中更早的 planId（确保 tasks 已按依赖拓扑顺序排序）。',
    '- acceptanceCriteria 必填，表示业务/结果层验收标准。',
    '- executionSpec.verification 表示技术/工程层校验动作；不要与 acceptanceCriteria 混淆。',
    `- 如 prompt header 已给出 recommendedWorkflowId/specMode，必须严格遵守：workflow=${args.taskBook.plan?.recommendedWorkflowId ?? '未指定'}，specMode=${args.taskBook.plan?.specMode ?? '未指定'}。`,
    `- 当前文档留存级别：${args.taskBook.plan?.documentationTier ?? '未指定'}；建议文档：${(args.taskBook.plan?.documentationArtifacts ?? []).join(', ') || '未指定'}。`,
    '- scope 可选：files/modules/tags（数组）。',
    '- executionSpec 推荐包含 agentHint、deliverables、verification、constraints、specRef。',
    '- 如需引用外部 Spec Kit，specRef 请使用版本化路径（例如 .codebuddy/specs/<taskBookId>-v1/00-overview.md）。',
    '',
    `写入目标：请把结果写入 ${args.resultPath}`,
    '',
    '输出 JSON Schema（简化版）：',
    '- requestId: string（必须与 header.requestId 一致）',
    "- kind?: 'planner' | 'manual-task'（推荐，用于更强校验/诊断）",
    "- status: 'success' | 'failed' | 'blocked'",
    '- output.planId: string（必须等于 TaskBook.id）',
    "- output.recommendedWorkflowId?: 'micro' | 'sprint' | 'default'",
    "- output.specMode?: 'inline-open-spec' | 'linked-spec-kit'",
    '- output.summary?: string',
    '- output.assumptions?: string[]',
    '- output.constraints?: string[]',
    '- output.risks?: { level?: low|medium|high; summary: string; mitigation?: string }[]',
    '- output.tasks: PlannerPlanTask[]',
    '',
    'PlannerPlanTask:',
    '- planId: string（如 T1/T2...，本次计划内唯一）',
    '- title: string',
    "- type: 'analysis' | 'design' | 'test' | 'implement' | 'review'",
    "- priority?: 'critical' | 'high' | 'medium' | 'low'",
    '- dependencies?: string[]（planId 列表）',
    '- acceptanceCriteria: string[]（必填，业务验收）',
    '- scope?: { files?: string[]; modules?: string[]; tags?: string[] }',
    "- executionSpec?: { agentHint?: 'coder'|'tester'|'reviewer'|'refactor'|'doc-writer'|'planner'; deliverables?: string[]; verification?: string[]; constraints?: string[]; dependenciesNote?: string; specRef?: string }",
    '',
    '示例（必须是 JSON，不要包裹 Markdown）：',
    '```json',
    JSON.stringify(schemaExample, null, 2),
    '```',
    '',
  ].join('\n');
}

function parseAgentCallResult(jsonText: string): AgentCallResult {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('错误: result.json 必须是 JSON object');
  }
  const obj = parsed as Record<string, unknown>;
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
    error: (typeof error === 'object' && error ? (error as AgentCallResult['error']) : undefined),
    completedAt: typeof completedAt === 'string' ? completedAt : undefined,
  };
}

function parsePlannerPlanFromAgentResult(result: AgentCallResult, taskBookId?: string): ParsedPlannerPlan {
  const output = result.output;
  if (!output || typeof output !== 'object') {
    throw new Error('错误: result.output 必须是 object，且包含 output.tasks[]');
  }
  const outObj = output as Record<string, unknown>;
  const tasks = outObj.tasks;
  if (!Array.isArray(tasks)) {
    throw new Error('错误: result.output.tasks 必须是数组');
  }

  const allowedTypes = new Set(['analysis', 'design', 'test', 'implement', 'review']);
  const allowedPriorities = new Set(['critical', 'high', 'medium', 'low']);
  const allowedWorkflowIds = new Set<BuiltinWorkflowId>(['micro', 'sprint', 'default']);
  const allowedSpecModes = new Set<TaskSpecMode>(['inline-open-spec', 'linked-spec-kit']);
  const allowedAgentHints = new Set<TaskAgentHint>(['coder', 'tester', 'reviewer', 'refactor', 'doc-writer', 'planner']);

  const plannerPlan: Partial<TaskBookPlan> = {
    planId: taskBookId || (typeof outObj.planId === 'string' ? outObj.planId : ''),
    version: 1,
    source: 'planner',
  };

  if (typeof outObj.planId !== 'undefined') {
    if (typeof outObj.planId !== 'string' || !outObj.planId.trim()) {
      throw new Error('错误: result.output.planId 必须是非空字符串');
    }
    if (taskBookId && outObj.planId !== taskBookId) {
      throw new Error(`错误: result.output.planId 必须等于 TaskBook.id (${taskBookId})`);
    }
    plannerPlan.planId = outObj.planId.trim();
  } else if (taskBookId) {
    plannerPlan.planId = taskBookId;
  }

  const topLevelStringArrayKeys: Array<keyof Pick<TaskBookPlan, 'goals' | 'outOfScope' | 'assumptions' | 'constraints' | 'clarifications'>> = [
    'goals',
    'outOfScope',
    'assumptions',
    'constraints',
    'clarifications',
  ];
  for (const key of topLevelStringArrayKeys) {
    const value = outObj[key];
    if (typeof value === 'undefined') continue;
    if (!Array.isArray(value)) {
      throw new Error(`错误: result.output.${key} 必须是字符串数组`);
    }
    const normalized = value.map((item, itemIndex) => {
      if (typeof item !== 'string' || !item.trim()) {
        throw new Error(`错误: result.output.${key}[${itemIndex}] 必须是非空字符串`);
      }
      return item.trim();
    });
    plannerPlan[key] = normalized;
  }

  if (typeof outObj.summary !== 'undefined') {
    if (typeof outObj.summary !== 'string' || !outObj.summary.trim()) {
      throw new Error('错误: result.output.summary 必须是非空字符串');
    }
    plannerPlan.summary = outObj.summary.trim();
  }
  if (typeof outObj.specRef !== 'undefined') {
    if (typeof outObj.specRef !== 'string' || !outObj.specRef.trim()) {
      throw new Error('错误: result.output.specRef 必须是非空字符串');
    }
    plannerPlan.specRef = outObj.specRef.trim();
  }
  if (typeof outObj.specMode !== 'undefined') {
    if (typeof outObj.specMode !== 'string' || !allowedSpecModes.has(outObj.specMode as TaskSpecMode)) {
      throw new Error('错误: result.output.specMode 无效');
    }
    plannerPlan.specMode = outObj.specMode as TaskSpecMode;
  }
  if (typeof outObj.recommendedWorkflowId !== 'undefined') {
    if (typeof outObj.recommendedWorkflowId !== 'string' || !allowedWorkflowIds.has(outObj.recommendedWorkflowId as BuiltinWorkflowId)) {
      throw new Error('错误: result.output.recommendedWorkflowId 无效');
    }
    plannerPlan.recommendedWorkflowId = outObj.recommendedWorkflowId as BuiltinWorkflowId;
  }
  if (typeof outObj.risks !== 'undefined') {
    if (!Array.isArray(outObj.risks)) {
      throw new Error('错误: result.output.risks 必须是数组');
    }
    plannerPlan.risks = outObj.risks.map((rawRisk, index) => {
      if (!rawRisk || typeof rawRisk !== 'object') {
        throw new Error(`错误: result.output.risks[${index}] 必须是 object`);
      }
      const risk = rawRisk as Record<string, unknown>;
      if (typeof risk.summary !== 'string' || !risk.summary.trim()) {
        throw new Error(`错误: result.output.risks[${index}].summary 必须是非空字符串`);
      }
      if (typeof risk.level !== 'undefined' && risk.level !== 'low' && risk.level !== 'medium' && risk.level !== 'high') {
        throw new Error(`错误: result.output.risks[${index}].level 无效`);
      }
      return {
        level: (risk.level === 'low' || risk.level === 'medium' || risk.level === 'high') ? risk.level : 'medium',
        summary: risk.summary.trim(),
        mitigation: typeof risk.mitigation === 'string' && risk.mitigation.trim() ? risk.mitigation.trim() : undefined,
      } as TaskBookPlanRisk;
    });
  }
  if (typeof outObj.epics !== 'undefined') {
    if (!Array.isArray(outObj.epics)) {
      throw new Error('错误: result.output.epics 必须是数组');
    }
    plannerPlan.epics = outObj.epics.map((rawEpic, index) => {
      if (!rawEpic || typeof rawEpic !== 'object') {
        throw new Error(`错误: result.output.epics[${index}] 必须是 object`);
      }
      const epic = rawEpic as Record<string, unknown>;
      if (typeof epic.id !== 'string' || !epic.id.trim()) {
        throw new Error(`错误: result.output.epics[${index}].id 必须是非空字符串`);
      }
      if (typeof epic.title !== 'string' || !epic.title.trim()) {
        throw new Error(`错误: result.output.epics[${index}].title 必须是非空字符串`);
      }
      return {
        id: epic.id.trim(),
        title: epic.title.trim(),
        summary: typeof epic.summary === 'string' && epic.summary.trim() ? epic.summary.trim() : undefined,
      } as TaskBookPlanEpic;
    });
  }

  const seenPlanIds = new Set<string>();
  const parsedTasks: PlannerPlanTask[] = [];

  for (const [index, raw] of tasks.entries()) {
    if (!raw || typeof raw !== 'object') {
      throw new Error(`错误: tasks[${index}] 必须是 object`);
    }
    const t = raw as Record<string, unknown>;

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

    let parsedPriority: TaskItem['priority'] | undefined;
    if (typeof priority !== 'undefined') {
      if (typeof priority !== 'string' || !allowedPriorities.has(priority)) {
        throw new Error(`错误: tasks[${index}].priority 无效: ${String(priority)}`);
      }
      parsedPriority = priority as TaskItem['priority'];
    }

    const dependencies: string[] = [];
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

    const acceptanceCriteria: string[] = [];
    if (!Array.isArray(t.acceptanceCriteria) || t.acceptanceCriteria.length === 0) {
      throw new Error(`错误: tasks[${index}].acceptanceCriteria 必须是非空字符串数组`);
    }
    for (const ac of t.acceptanceCriteria) {
      if (typeof ac !== 'string' || !ac.trim()) {
        throw new Error(`错误: tasks[${index}].acceptanceCriteria 包含无效条目`);
      }
      acceptanceCriteria.push(ac.trim());
    }

    let scope: TaskScope | undefined;
    if (typeof t.scope !== 'undefined') {
      if (!t.scope || typeof t.scope !== 'object') {
        throw new Error(`错误: tasks[${index}].scope 必须是 object`);
      }
      const s = t.scope as Record<string, unknown>;
      const files = Array.isArray(s.files) ? s.files : undefined;
      const modules = Array.isArray(s.modules) ? s.modules : undefined;
      const tags = Array.isArray(s.tags) ? s.tags : undefined;

      const normalizeStringArray = (arr: unknown[] | undefined, key: string): string[] | undefined => {
        if (!arr) return undefined;
        const out: string[] = [];
        for (const v of arr) {
          if (typeof v !== 'string' || !v.trim()) {
            throw new Error(`错误: tasks[${index}].scope.${key} 必须是字符串数组`);
          }
          out.push(v);
        }
        return out.length > 0 ? out : undefined;
      };

      scope = {
        files: files ? normalizeStringArray(files as unknown[], 'files') : undefined,
        modules: modules ? normalizeStringArray(modules as unknown[], 'modules') : undefined,
        tags: tags ? normalizeStringArray(tags as unknown[], 'tags') : undefined,
      };

      if (!scope.files && !scope.modules && !scope.tags) {
        scope = undefined;
      }
    }

    let executionSpec: TaskExecutionSpec | undefined;
    if (typeof t.executionSpec !== 'undefined') {
      if (!t.executionSpec || typeof t.executionSpec !== 'object') {
        throw new Error(`错误: tasks[${index}].executionSpec 必须是 object`);
      }
      const spec = t.executionSpec as Record<string, unknown>;

      const parseOptionalStringList = (key: 'deliverables' | 'verification' | 'constraints'): string[] | undefined => {
        if (typeof spec[key] === 'undefined') return undefined;
        if (!Array.isArray(spec[key])) {
          throw new Error(`错误: tasks[${index}].executionSpec.${key} 必须是字符串数组`);
        }
        const values = spec[key] as unknown[];
        const normalized = values.map((item, itemIndex) => {
          if (typeof item !== 'string' || !item.trim()) {
            throw new Error(`错误: tasks[${index}].executionSpec.${key}[${itemIndex}] 必须是非空字符串`);
          }
          return item.trim();
        });
        return normalized.length > 0 ? normalized : undefined;
      };

      if (typeof spec.summary !== 'undefined' && (typeof spec.summary !== 'string' || !spec.summary.trim())) {
        throw new Error(`错误: tasks[${index}].executionSpec.summary 必须是非空字符串`);
      }
      if (typeof spec.agentHint !== 'undefined' && (typeof spec.agentHint !== 'string' || !allowedAgentHints.has(spec.agentHint as TaskAgentHint))) {
        throw new Error(`错误: tasks[${index}].executionSpec.agentHint 无效`);
      }
      if (typeof spec.dependenciesNote !== 'undefined' && (typeof spec.dependenciesNote !== 'string' || !spec.dependenciesNote.trim())) {
        throw new Error(`错误: tasks[${index}].executionSpec.dependenciesNote 必须是非空字符串`);
      }
      if (typeof spec.specRef !== 'undefined' && (typeof spec.specRef !== 'string' || !spec.specRef.trim())) {
        throw new Error(`错误: tasks[${index}].executionSpec.specRef 必须是非空字符串`);
      }

      executionSpec = normalizeExecutionSpec({
        summary: typeof spec.summary === 'string' ? spec.summary.trim() : undefined,
        agentHint: typeof spec.agentHint === 'string' ? spec.agentHint as TaskAgentHint : undefined,
        deliverables: parseOptionalStringList('deliverables'),
        verification: parseOptionalStringList('verification'),
        constraints: parseOptionalStringList('constraints'),
        dependenciesNote: typeof spec.dependenciesNote === 'string' ? spec.dependenciesNote.trim() : undefined,
        specRef: typeof spec.specRef === 'string' ? spec.specRef.trim() : undefined,
      });
    }

    parsedTasks.push({
      planId,
      title: title.trim(),
      type: type as TaskItem['type'],
      priority: parsedPriority,
      dependencies: dependencies.length > 0 ? dependencies : undefined,
      acceptanceCriteria,
      scope,
      executionSpec,
    });
  }

  return { plan: plannerPlan, tasks: parsedTasks };
}

function main(): void {
  const args = process.argv.slice(2);
  const parsed = parseCli(args);

  if (!parsed.command || parsed.command === 'help' || parsed.command === '--help' || parsed.command === '-h') {
    showHelp();
    process.exit(parsed.command ? 0 : 1);
  }

  const manager = new TaskBookManager(process.cwd());
  const json = flagAsBool(parsed.flags, 'json');
  const requireIfRev = flagAsBool(parsed.flags, 'require-if-rev') || isTruthyEnv(REQUIRE_IF_REV_ENV);

  let expectedRevision: number | undefined;
  try {
    expectedRevision = expectedRevisionFromFlags(parsed.flags);
  } catch (error) {
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
        const type = flagAsString(parsed.flags, 'type') as TaskBookType | undefined;

        if (!title || !description || !type) {
          console.error('错误: create 需要 --title --description --type');
          showHelp();
          process.exit(1);
        }

        const taskBook = manager.create({
          title,
          description,
          taskType: type,
          plan: buildTaskBookPlanFromFlags(parsed.flags),
        });
        if (json) {
          printJson(taskBook);
        } else {
          console.log(`[TaskBook] 已创建: ${taskBook.id}`);
          console.log(manager.formatForDisplay(taskBook));
        }
        break;
      }

      case 'list': {
        const list = manager.listActive();
        if (json) {
          printJson(list);
        } else {
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
        } else {
          console.log(manager.formatForDisplay(tb));
          console.log(`\n状态: ${tb.status}`);
          console.log(`创建时间: ${tb.createdAt}`);
          console.log(`revision: ${tb.revision ?? 0}`);
          if (tb.updatedAt) console.log(`updatedAt: ${tb.updatedAt}`);
          if (tb.confirmedAt) console.log(`确认时间: ${tb.confirmedAt}`);
          if (tb.completedAt) console.log(`完成时间: ${tb.completedAt}`);
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
          if (!json) console.log(`[TaskBook] 已生成验收报告: ${outPath}`);
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

        const requestId = flagAsString(parsed.flags, 'request-id') ?? generateRequestId();
        const agentCallsDir = path.join(process.cwd(), AGENT_CALLS_DIR);
        ensureDir(agentCallsDir);

        const promptPath = path.join(agentCallsDir, `${requestId}.prompt.md`);
        const resultPath = path.join(agentCallsDir, `${requestId}.result.json`);

        const agentDef = loadPlannerAgentDefinition(process.cwd());
        if (!agentDef) {
          const candidates = listAgentDefinitionCandidatePaths(process.cwd(), 'planner')
            .map(filePath => path.relative(process.cwd(), filePath).replace(/\\/g, '/'));
          console.error(`错误: planner AGENT.md 未找到（期望 ${candidates.join(' 或 ')}）`);
          console.error('提示: 先在目标项目执行 codebuddy-loader，确保 install.json 指向的 active agents root 已生成。');
          process.exit(1);
        }
        const planPatch = buildTaskBookPlanFromFlags(parsed.flags);
        const planAwareTaskBook = planPatch
          ? manager.updatePlan(taskBookId, { ...planPatch, source: 'task-intake-routing' }, tb.revision)
          : tb;
        if (!planAwareTaskBook) {
          console.error(`错误: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }

        const prompt = buildPlannerPrompt({
          requestId,
          taskBook: planAwareTaskBook,
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
          taskBookRevision: planAwareTaskBook.revision ?? 0,
          promptPath,
          resultPath,
        };

        if (json) {
          printJson(payload);
        } else {
          console.log(`[planner] 已生成 prompt: ${promptPath}`);
          console.log(`[planner] 请执行 prompt 并写回: ${resultPath}`);
          console.log('[planner] 写回后执行:');
          console.log(`  node .codebuddy/scripts/taskbook-manager.js apply-plan ${taskBookId} ${requestId}`);
          console.log(`  # 若启用并发保护：加上 --if-rev ${planAwareTaskBook.revision ?? 0}`);
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

        let result: AgentCallResult;
        try {
          result = parseAgentCallResult(fs.readFileSync(resultPath, 'utf-8'));
        } catch (error) {
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

        const parsedPlan = parsePlannerPlanFromAgentResult(result, taskBookId);

        if (dryRun) {
          const preview = {
            dryRun: true,
            requestId,
            taskBookId,
            plan: parsedPlan.plan,
            tasks: parsedPlan.tasks,
          };
          if (json) printJson(preview);
          else {
            console.log(`[planner] dry-run: ${taskBookId} <- ${requestId}`);
            for (const t of parsedPlan.tasks) {
              const deps = t.dependencies && t.dependencies.length > 0 ? ` deps=${t.dependencies.join(',')}` : '';
              console.log(`- ${t.planId} [${t.type}] ${t.title}${deps}`);
            }
          }
          break;
        }

        const planIdToIndex = new Map<string, number>();
        for (let i = 0; i < parsedPlan.tasks.length; i++) {
          planIdToIndex.set(parsedPlan.tasks[i].planId, i);
        }

        for (let i = 0; i < parsedPlan.tasks.length; i++) {
          const deps = parsedPlan.tasks[i].dependencies ?? [];
          for (const dep of deps) {
            const depIndex = planIdToIndex.get(dep);
            if (typeof depIndex !== 'number') {
              console.error(`错误: 依赖 planId 不存在: ${dep} (from ${parsedPlan.tasks[i].planId})`);
              process.exit(1);
            }
            if (depIndex >= i) {
              console.error(`错误: dependencies 必须指向更早的 planId（${parsedPlan.tasks[i].planId} 依赖 ${dep}）`);
              process.exit(1);
            }
          }
        }

        const applied = manager.applyPlannerPlan(taskBookId, requestId, parsedPlan, expectedRevision);

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

        if (json) printJson(payload);
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
        if (json) printJson(tb);
        else console.log(`[TaskBook] 已确认: ${taskBookId}`);
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
        if (json) printJson(tb);
        else console.log(`[TaskBook] 已完成并归档: ${taskBookId}`);
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
        if (json) printJson(tb);
        else console.log(`[TaskBook] 已中止并归档: ${taskBookId}`);
        break;
      }

      case 'add-task': {
        const taskBookId = parsed.positionals[0];
        if (!taskBookId) {
          console.error('错误: add-task 需要 <taskBookId>');
          process.exit(1);
        }

        const title = flagAsString(parsed.flags, 'title');
        const type = flagAsString(parsed.flags, 'type') as TaskItem['type'] | undefined;
        const priority = flagAsString(parsed.flags, 'priority') as TaskItem['priority'] | undefined;
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
          executionSpec: buildExecutionSpecFromFlags(parsed.flags),
        }, expectedRevision);

        if (!tb) {
          console.error(`错误: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }

        if (json) printJson(tb);
        else console.log(`[TaskBook] 已添加任务: ${tb.tasks[tb.tasks.length - 1].id}`);
        break;
      }

      case 'update-task': {
        const taskBookId = parsed.positionals[0];
        const taskId = parsed.positionals[1];
        if (!taskBookId || !taskId) {
          console.error('错误: update-task 需要 <taskBookId> <taskId>');
          process.exit(1);
        }

        const patch: Partial<Omit<TaskItem, 'id'>> = {};

        const title = flagAsString(parsed.flags, 'title');
        if (title) patch.title = title;

        const executedBy = flagAsString(parsed.flags, 'executed-by');
        if (executedBy) patch.executedBy = executedBy;

        const status = flagAsString(parsed.flags, 'status') as TaskItem['status'] | undefined;
        if (status) patch.status = status;

        const priority = flagAsString(parsed.flags, 'priority') as TaskItem['priority'] | undefined;
        if (priority) patch.priority = priority;

        const deps = parseCsv(flagAsString(parsed.flags, 'deps'));
        if (deps.length > 0) patch.dependencies = deps;

        const ac = flagAsStringArray(parsed.flags, 'ac');
        if (ac.length > 0) patch.acceptanceCriteria = ac;

        const files = parseCsv(flagAsString(parsed.flags, 'files'));
        const modules = parseCsv(flagAsString(parsed.flags, 'modules'));
        const tags = parseCsv(flagAsString(parsed.flags, 'tags'));
        const scope = buildScope(files, modules, tags);
        if (scope) patch.scope = scope;
        const executionSpec = buildExecutionSpecFromFlags(parsed.flags);
        if (executionSpec) patch.executionSpec = executionSpec;

        const actualWork = flagAsString(parsed.flags, 'actual-work');
        if (actualWork) patch.actualWork = actualWork;

        const blockedReason = flagAsString(parsed.flags, 'blocked-reason');
        if (blockedReason) patch.blockedReason = blockedReason;

        const tb = manager.updateTask(taskBookId, taskId, patch, expectedRevision);
        if (!tb) {
          console.error(`错误: TaskBook/task not found: ${taskBookId} ${taskId}`);
          process.exit(1);
        }

        if (json) printJson(tb);
        else console.log(`[TaskBook] 已更新任务: ${taskId}`);
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

        if (json) printJson(tb);
        else console.log(`[TaskBook] 已解除阻塞: ${taskId}`);
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
        if (json) printJson(tb);
        else console.log(`[TaskBook] 已认领 ${taskId} -> ${by}`);
        break;
      }

      case 'append-work': {
        const taskBookId = parsed.positionals[0];
        const taskId = parsed.positionals[1];
        const text = flagAsString(parsed.flags, 'text') ?? parsed.positionals.slice(2).join(' ');
        if (!taskBookId || !taskId || !text) {
          console.error('错误: append-work 需要 <taskBookId> <taskId> --text <text>');
          process.exit(1);
        }

        const tb = manager.appendTaskActualWork(taskBookId, taskId, text, expectedRevision);
        if (!tb) {
          console.error(`错误: TaskBook/task not found: ${taskBookId} ${taskId}`);
          process.exit(1);
        }

        if (json) printJson(tb);
        else console.log(`[TaskBook] 已追加 actualWork: ${taskId}`);
        break;
      }

      default: {
        console.error(`未知命令: ${parsed.command}`);
        showHelp();
        process.exit(1);
      }
    }
  } catch (error) {
    if (error instanceof TaskBookConflictError) {
      console.error(`冲突: ${error.message}`);
      process.exit(2);
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (isDirectCliEntry('taskbook-manager.js')) {
  main();
}
