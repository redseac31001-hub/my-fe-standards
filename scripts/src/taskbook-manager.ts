/**
 * TaskBook 管理器
 *
 * 负责 TaskBook 的创建、读取、更新、归档等操作
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  TaskBook,
  TaskBookStatus,
  TaskBookType,
  TaskItem,
  TaskScope,
  ChangeEntry,
  CreateTaskBookParams,
  AcceptanceReport,
} from './types';

// TaskBook 存储目录
const TASKBOOK_BASE_DIR = '.codebuddy/taskbooks';
const ACTIVE_DIR = 'active';
const HISTORY_DIR = 'history';
const CONTEXT_SNAPSHOTS_DIR = '.codebuddy/context-snapshots';
const LOCKS_DIR = '.codebuddy/taskbooks/.locks';
const LOCK_STALE_MS = 2 * 60 * 1000;
const LOCK_TIMEOUT_MS = 10 * 1000;
const LOCK_RETRY_MS = 80;

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

/**
 * 确保目录存在
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * TaskBook 管理器类
 */
export class TaskBookManager {
  private baseDir: string;

  constructor(projectRoot: string = process.cwd()) {
    this.baseDir = projectRoot;
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

  private normalize(taskBook: TaskBook): TaskBook {
    if (typeof taskBook.revision !== 'number') {
      taskBook.revision = 0;
    }
    if (!taskBook.updatedAt) {
      taskBook.updatedAt = taskBook.createdAt;
    }
    return taskBook;
  }

  private touch(taskBook: TaskBook): void {
    if (typeof taskBook.revision !== 'number') {
      taskBook.revision = 0;
    }
    taskBook.revision += 1;
    taskBook.updatedAt = now();
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

    const startedAt = Date.now();
    const timeoutMs = opts?.timeoutMs ?? LOCK_TIMEOUT_MS;

    while (true) {
      try {
        const fd = fs.openSync(lockPath, 'wx');
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
          try {
            fs.unlinkSync(lockPath);
          } catch {
            // ignore
          }
        }
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code !== 'EEXIST') {
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
            } catch {
              // ignore
            }
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

        sleepSync(LOCK_RETRY_MS);
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
  load(id: string): TaskBook | null {
    // 先尝试从活跃目录读取
    let filePath = path.join(this.getActiveDir(), `${id}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as TaskBook;
      return this.normalize(parsed);
    }

    // 再尝试从历史目录读取
    filePath = path.join(this.getHistoryDir(), `${id}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as TaskBook;
      return this.normalize(parsed);
    }

    return null;
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
    return files.map(f => {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8');
      const parsed = JSON.parse(content) as TaskBook;
      return this.normalize(parsed);
    });
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
      after: newTask as unknown as Record<string, unknown>,
    });

    this.touch(taskBook);
    this.save(taskBook);
    return taskBook;
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
      const approved = after.approved === true;
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

      gateEvents.push({
        gateId,
        stepId,
        timestamp: entry.timestamp,
        passed,
        approved,
        eventContext,
        batchIndex,
        riskTier,
        budgetMinutes,
        totalDurationMs,
        commandRuns,
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
      analysis: '🔍',
      design: '📐',
      test: '🧪',
      implement: '💻',
      review: '👀',
    };

    const typeLabel: Record<TaskItem['type'], string> = {
      analysis: '分析',
      design: '设计',
      test: '测试',
      implement: '实现',
      review: '审查',
    };

    const lines: string[] = [
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

// 导出单例
export const taskBookManager = new TaskBookManager();

type ParsedCli = {
  command: string | null;
  positionals: string[];
  flags: Record<string, string | boolean | string[]>;
};

function showHelp(): void {
  console.log(`
TaskBook Manager - TaskBook 任务事实源管理工具

用法:
  node .codebuddy/scripts/taskbook-manager.js <command> [args] [options]

common options:
  --json                       输出 JSON
  --if-rev <number>            可选：写入前检查 TaskBook.revision（避免多 Agent 覆盖）

命令:
  create                      创建 TaskBook
  list                        列出 active TaskBooks
  show <taskBookId>            查看 TaskBook（默认格式化输出）
  report <taskBookId>          生成验收/批量/闸门报告（可选落盘）
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

function main(): void {
  const args = process.argv.slice(2);
  const parsed = parseCli(args);

  if (!parsed.command || parsed.command === 'help' || parsed.command === '--help' || parsed.command === '-h') {
    showHelp();
    process.exit(parsed.command ? 0 : 1);
  }

  const manager = new TaskBookManager(process.cwd());
  const json = flagAsBool(parsed.flags, 'json');

  let expectedRevision: number | undefined;
  try {
    expectedRevision = expectedRevisionFromFlags(parsed.flags);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
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

      const taskBook = manager.create({ title, description, taskType: type });
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

if (require.main === module) {
  main();
}
