"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// scripts/src/task-executor.ts
var task_executor_exports = {};
__export(task_executor_exports, {
  TaskExecutor: () => TaskExecutor,
  createTaskExecutor: () => createTaskExecutor
});
module.exports = __toCommonJS(task_executor_exports);
var fs7 = __toESM(require("fs"));
var path8 = __toESM(require("path"));
var import_child_process3 = require("child_process");
var import_crypto = require("crypto");

// scripts/src/lib/cli-entry.ts
var path = __toESM(require("path"));
function isDirectCliEntry(expectedFileNames) {
  const argvPath = process.argv[1];
  if (!argvPath) return false;
  const actual = path.basename(argvPath).toLowerCase();
  const expected = Array.isArray(expectedFileNames) ? expectedFileNames : [expectedFileNames];
  return expected.some((name) => actual === name.toLowerCase());
}

// scripts/src/taskbook-manager.ts
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var TASKBOOK_BASE_DIR = ".codebuddy/taskbooks";
var ACTIVE_DIR = "active";
var HISTORY_DIR = "history";
var CONTEXT_SNAPSHOTS_DIR = ".codebuddy/context-snapshots";
var LOCKS_DIR = ".codebuddy/taskbooks/.locks";
var AGENT_CALLS_DIR = ".codebuddy/agent-calls";
var LOCK_STALE_MS = 2 * 60 * 1e3;
var LOCK_TIMEOUT_MS = 10 * 1e3;
var LOCK_RETRY_MS = 80;
var SLEEP_INT32 = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
  Atomics.wait(SLEEP_INT32, 0, 0, ms);
}
var TaskBookConflictError = class extends Error {
  constructor(taskBookId, expectedRevision, actualRevision) {
    super(`TaskBook revision conflict: ${taskBookId} (expected ${expectedRevision}, actual ${actualRevision})`);
    this.name = "TaskBookConflictError";
    this.taskBookId = taskBookId;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
};
function generateTaskBookId(title) {
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
  const slug = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
  return `tb-${date}-${slug}`;
}
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
var TaskBookManager = class {
  constructor(projectRoot = process.cwd()) {
    this.baseDir = projectRoot;
  }
  /**
   * 获取活跃任务书目录
   */
  getActiveDir() {
    return path2.join(this.baseDir, TASKBOOK_BASE_DIR, ACTIVE_DIR);
  }
  /**
   * 获取历史任务书目录
   */
  getHistoryDir() {
    return path2.join(this.baseDir, TASKBOOK_BASE_DIR, HISTORY_DIR);
  }
  /**
   * 获取上下文快照目录
   */
  getContextSnapshotsDir() {
    return path2.join(this.baseDir, CONTEXT_SNAPSHOTS_DIR);
  }
  /**
   * 创建新的 TaskBook
   */
  getLocksDir() {
    return path2.join(this.baseDir, LOCKS_DIR);
  }
  getLockPath(taskBookId) {
    return path2.join(this.getLocksDir(), `${taskBookId}.lock`);
  }
  normalize(taskBook) {
    if (typeof taskBook.revision !== "number") {
      taskBook.revision = 0;
    }
    if (!taskBook.updatedAt) {
      taskBook.updatedAt = taskBook.createdAt;
    }
    return taskBook;
  }
  touch(taskBook) {
    if (typeof taskBook.revision !== "number") {
      taskBook.revision = 0;
    }
    taskBook.revision += 1;
    taskBook.updatedAt = now();
  }
  assertRevision(taskBook, expectedRevision) {
    if (typeof expectedRevision !== "number") return;
    const actual = typeof taskBook.revision === "number" ? taskBook.revision : 0;
    if (actual !== expectedRevision) {
      throw new TaskBookConflictError(taskBook.id, expectedRevision, actual);
    }
  }
  withTaskBookLock(taskBookId, fn, opts) {
    const lockPath = this.getLockPath(taskBookId);
    ensureDir(path2.dirname(lockPath));
    const startedAt = Date.now();
    const timeoutMs = opts?.timeoutMs ?? LOCK_TIMEOUT_MS;
    while (true) {
      try {
        const fd = fs.openSync(lockPath, "wx");
        try {
          const payload = { pid: process.pid, createdAt: now(), taskBookId };
          fs.writeFileSync(fd, JSON.stringify(payload, null, 2), "utf-8");
        } catch {
        }
        try {
          return fn();
        } finally {
          try {
            fs.closeSync(fd);
          } catch {
          }
          try {
            fs.unlinkSync(lockPath);
          } catch {
          }
        }
      } catch (error) {
        const err = error;
        if (err?.code !== "EEXIST") {
          throw error;
        }
        try {
          const stat = fs.statSync(lockPath);
          const ageMs = Date.now() - stat.mtimeMs;
          if (ageMs > LOCK_STALE_MS) {
            try {
              fs.unlinkSync(lockPath);
              continue;
            } catch {
            }
          }
        } catch {
        }
        if (Date.now() - startedAt > timeoutMs) {
          let lockInfo = "";
          try {
            lockInfo = fs.readFileSync(lockPath, "utf-8").slice(0, 2e3);
          } catch {
          }
          const details = lockInfo ? `
lock info:
${lockInfo}` : "";
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
      status: "draft",
      context: {
        relatedFiles: [],
        dependencies: []
      },
      tasks: [],
      changelog: []
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
    const dir = taskBook.status === "completed" || taskBook.status === "aborted" ? this.getHistoryDir() : this.getActiveDir();
    ensureDir(dir);
    const filePath = path2.join(dir, `${taskBook.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(taskBook, null, 2), "utf-8");
  }
  /**
   * 读取 TaskBook
   */
  load(id) {
    let filePath = path2.join(this.getActiveDir(), `${id}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      return this.normalize(parsed);
    }
    filePath = path2.join(this.getHistoryDir(), `${id}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
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
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    return files.map((f) => {
      const content = fs.readFileSync(path2.join(dir, f), "utf-8");
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
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      const oldStatus = taskBook.status;
      taskBook.status = status;
      if (status === "confirmed") {
        taskBook.confirmedAt = now();
      } else if (status === "completed" || status === "aborted") {
        taskBook.completedAt = now();
      }
      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId: null,
        changeType: "modified",
        reason: `\u72B6\u6001\u53D8\u66F4: ${oldStatus} \u2192 ${status}`,
        before: { status: oldStatus },
        after: { status }
      });
      if (status === "completed" || status === "aborted") {
        const activeFilePath = path2.join(this.getActiveDir(), `${id}.json`);
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
      const taskBook = this.load(id);
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      const taskId = `task-${taskBook.tasks.length + 1}`;
      const newTask = {
        id: taskId,
        parentId: task.parentId,
        title: task.title,
        type: task.type,
        status: task.status ?? "pending",
        priority: task.priority ?? "medium",
        dependencies: task.dependencies ?? [],
        acceptanceCriteria: task.acceptanceCriteria ?? [],
        scope: task.scope,
        actualWork: task.actualWork,
        blockedReason: task.blockedReason,
        executedBy: task.executedBy,
        startedAt: task.startedAt,
        completedAt: task.completedAt
      };
      taskBook.tasks.push(newTask);
      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId,
        changeType: "added",
        reason: `\u6DFB\u52A0\u4EFB\u52A1: ${task.title}`,
        after: newTask
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
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;
      this.assertRevision(taskBook, opts?.expectedRevision);
      const taskIds = [];
      const reasonPrefix = opts?.reasonPrefix;
      for (const task of tasks) {
        const taskId = `task-${taskBook.tasks.length + 1}`;
        const newTask = {
          id: taskId,
          parentId: task.parentId,
          title: task.title,
          type: task.type,
          status: task.status ?? "pending",
          priority: task.priority ?? "medium",
          dependencies: task.dependencies ?? [],
          acceptanceCriteria: task.acceptanceCriteria ?? [],
          scope: task.scope,
          actualWork: task.actualWork,
          blockedReason: task.blockedReason,
          executedBy: task.executedBy,
          startedAt: task.startedAt,
          completedAt: task.completedAt
        };
        taskBook.tasks.push(newTask);
        taskIds.push(taskId);
        this.addChangelogEntry(taskBook, {
          timestamp: now(),
          taskId,
          changeType: "added",
          reason: `${reasonPrefix ? `${reasonPrefix}: ` : ""}\u6DFB\u52A0\u4EFB\u52A1: ${task.title}`,
          after: newTask
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
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      if (!Array.isArray(planTasks) || planTasks.length === 0) {
        throw new Error("\u9519\u8BEF: planner planTasks \u4E0D\u80FD\u4E3A\u7A7A");
      }
      const planIdToIndex = /* @__PURE__ */ new Map();
      const planIdToTaskId = {};
      const base = taskBook.tasks.length + 1;
      for (let i = 0; i < planTasks.length; i++) {
        const planId = planTasks[i]?.planId;
        if (typeof planId !== "string" || !planId) {
          throw new Error(`\u9519\u8BEF: planTasks[${i}].planId \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
        }
        if (planIdToIndex.has(planId)) {
          throw new Error(`\u9519\u8BEF: planId \u91CD\u590D: ${planId}`);
        }
        planIdToIndex.set(planId, i);
        planIdToTaskId[planId] = `task-${base + i}`;
      }
      const taskIds = [];
      for (let i = 0; i < planTasks.length; i++) {
        const t = planTasks[i];
        const taskId = planIdToTaskId[t.planId];
        const deps = t.dependencies ?? [];
        const mappedDeps = [];
        for (const dep of deps) {
          const depIndex = planIdToIndex.get(dep);
          if (typeof depIndex !== "number") {
            throw new Error(`\u9519\u8BEF: \u4F9D\u8D56 planId \u4E0D\u5B58\u5728: ${dep} (from ${t.planId})`);
          }
          if (depIndex >= i) {
            throw new Error(`\u9519\u8BEF: dependencies \u5FC5\u987B\u6307\u5411\u66F4\u65E9\u7684 planId\uFF08${t.planId} \u4F9D\u8D56 ${dep}\uFF09`);
          }
          mappedDeps.push(planIdToTaskId[dep]);
        }
        const newTask = {
          id: taskId,
          title: t.title,
          type: t.type,
          status: "pending",
          priority: t.priority ?? "medium",
          dependencies: mappedDeps,
          acceptanceCriteria: t.acceptanceCriteria ?? [],
          scope: t.scope
        };
        taskBook.tasks.push(newTask);
        taskIds.push(taskId);
        this.addChangelogEntry(taskBook, {
          timestamp: now(),
          taskId,
          changeType: "added",
          reason: `planner:${requestId}: \u6DFB\u52A0\u4EFB\u52A1: ${t.title}`,
          after: newTask
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
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      const task = taskBook.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      const before = { ...task };
      if (patch.status && patch.status !== task.status) {
        task.status = patch.status;
        if (patch.status === "in_progress") {
          task.startedAt = now();
        } else if (patch.status === "done") {
          task.completedAt = now();
          if (patch.actualWork) {
            task.actualWork = patch.actualWork;
          }
        } else if (patch.status === "blocked") {
          if (patch.blockedReason) {
            task.blockedReason = patch.blockedReason;
          }
        }
      }
      const updatable = [
        "parentId",
        "title",
        "type",
        "priority",
        "dependencies",
        "acceptanceCriteria",
        "scope",
        "actualWork",
        "blockedReason",
        "executedBy",
        "startedAt",
        "completedAt"
      ];
      for (const key of updatable) {
        const value = patch[key];
        if (typeof value !== "undefined") {
          task[key] = value;
        }
      }
      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId,
        changeType: "modified",
        reason: "\u66F4\u65B0\u4EFB\u52A1\u5B57\u6BB5",
        before,
        after: task
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
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      const task = taskBook.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      if (task.status !== "blocked") return taskBook;
      const before = { status: task.status, blockedReason: task.blockedReason };
      task.status = "pending";
      task.blockedReason = "";
      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId,
        changeType: "modified",
        reason: `\u89E3\u9664\u963B\u585E: ${resolution}`,
        before,
        after: { status: task.status, blockedReason: task.blockedReason }
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
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      const task = taskBook.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      const before = task.actualWork ?? "";
      const next = before ? `${before}
${text}` : text;
      task.actualWork = next;
      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId,
        changeType: "modified",
        reason: "\u8FFD\u52A0 actualWork",
        before: { actualWork: before },
        after: { actualWork: next }
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
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      const task = taskBook.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      const oldStatus = task.status;
      task.status = status;
      if (status === "in_progress") {
        task.startedAt = now();
      } else if (status === "done") {
        task.completedAt = now();
        if (actualWork) {
          task.actualWork = actualWork;
        }
      } else if (status === "blocked" && blockedReason) {
        task.blockedReason = blockedReason;
      }
      if (oldStatus !== status) {
        this.addChangelogEntry(taskBook, {
          timestamp: now(),
          taskId,
          changeType: "modified",
          reason: `\u4EFB\u52A1\u72B6\u6001\u53D8\u66F4: ${oldStatus} \u2192 ${status}`,
          before: { status: oldStatus },
          after: { status, actualWork, blockedReason }
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
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId,
        changeType,
        reason,
        before,
        after
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
    const taskBook = this.load(taskBookId);
    if (!taskBook) return null;
    const doneTasks = taskBook.tasks.filter((t) => t.status === "done").length;
    const skippedTasks = taskBook.tasks.filter((t) => t.status === "skipped").length;
    const blockedTasks = taskBook.tasks.filter((t) => t.status === "blocked").length;
    const totalTasks = taskBook.tasks.length;
    const createdAt = new Date(taskBook.createdAt);
    const completedAt = taskBook.completedAt ? new Date(taskBook.completedAt) : /* @__PURE__ */ new Date();
    const durationMs = completedAt.getTime() - createdAt.getTime();
    const durationMinutes = Math.round(durationMs / 6e4);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const duration = hours > 0 ? `${hours}\u5C0F\u65F6${minutes}\u5206\u949F` : `${minutes}\u5206\u949F`;
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
        completionRate: totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0,
        changelogCount: taskBook.changelog.length
      },
      recommendations: {
        mustDo: [],
        suggested: [],
        technicalDebt: []
      }
    };
    const isPlainObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    const gateEvents = [];
    for (const entry of taskBook.changelog) {
      const after = entry.after;
      if (!isPlainObject2(after)) continue;
      if (after.event !== "gate") continue;
      const gateId = after.gateId;
      if (typeof gateId !== "string" || gateId.length === 0) continue;
      const passed = after.passed === true;
      const skipped = after.skipped === true;
      const skipReason = typeof after.skipReason === "string" ? after.skipReason : void 0;
      const approved = after.approved === true;
      const evidencePath = typeof after.evidencePath === "string" ? after.evidencePath : void 0;
      const stepId = typeof after.stepId === "string" ? after.stepId : void 0;
      const eventContext = typeof after.eventContext === "string" ? after.eventContext : void 0;
      const batchIndex = typeof after.batchIndex === "number" && Number.isFinite(after.batchIndex) ? after.batchIndex : void 0;
      const riskTier = typeof after.riskTier === "string" ? after.riskTier : void 0;
      const budgetMinutes = typeof after.budgetMinutes === "number" && Number.isFinite(after.budgetMinutes) ? after.budgetMinutes : void 0;
      let commandRuns;
      const rawRuns = after.commandRuns;
      if (Array.isArray(rawRuns)) {
        const parsedRuns = [];
        for (const r of rawRuns) {
          if (!isPlainObject2(r)) continue;
          if (typeof r.command !== "string") continue;
          if (typeof r.ok !== "boolean") continue;
          const code = typeof r.code === "number" || r.code === null ? r.code : null;
          const durationMs2 = typeof r.durationMs === "number" && Number.isFinite(r.durationMs) ? r.durationMs : 0;
          parsedRuns.push({ command: r.command, ok: r.ok, code, durationMs: durationMs2 });
        }
        if (parsedRuns.length > 0) commandRuns = parsedRuns;
      }
      const totalDurationMs = commandRuns ? commandRuns.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) : void 0;
      let missingScripts;
      const rawMissing = after.missingScripts;
      if (Array.isArray(rawMissing)) {
        const parsedMissing = rawMissing.filter((v) => typeof v === "string" && v.length > 0);
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
        missingScripts
      });
    }
    if (gateEvents.length > 0) {
      report.gates = gateEvents;
      for (const g of report.gates) {
        if (typeof g.budgetMinutes === "number" && typeof g.totalDurationMs === "number") {
          const budgetMs = g.budgetMinutes * 6e4;
          if (g.totalDurationMs > budgetMs) {
            report.recommendations.suggested.push(
              `gate ${g.gateId} \u8017\u65F6 ${(g.totalDurationMs / 1e3).toFixed(1)}s\uFF0C\u8D85\u8FC7 budget ${g.budgetMinutes}min\uFF1B\u5EFA\u8BAE\u8C03\u6574 smoke/full \u547D\u4EE4\u6216\u7F29\u5C0F\u5355\u6279\u6539\u52A8\u8303\u56F4`
            );
          }
        }
      }
    }
    const batchMap = /* @__PURE__ */ new Map();
    for (const entry of taskBook.changelog) {
      const after = entry.after;
      if (!isPlainObject2(after)) continue;
      if (after.event !== "batch") continue;
      const stepId = after.stepId;
      const batchIndex = after.batchIndex;
      if (typeof stepId !== "string" || stepId.length === 0) continue;
      if (typeof batchIndex !== "number" || !Number.isFinite(batchIndex)) continue;
      const key = `${stepId}#${batchIndex}`;
      const existing = batchMap.get(key) ?? {
        stepId,
        batchIndex,
        taskIds: []
      };
      const rawTaskIds = after.taskIds;
      if (Array.isArray(rawTaskIds)) {
        const parsedTaskIds = rawTaskIds.filter((v) => typeof v === "string" && v.length > 0);
        if (parsedTaskIds.length > 0) existing.taskIds = parsedTaskIds;
      }
      if (typeof after.riskTier === "string") existing.riskTier = after.riskTier;
      if (typeof after.maxFiles === "number" && Number.isFinite(after.maxFiles)) existing.maxFiles = after.maxFiles;
      if (typeof after.status === "string" && after.status.length > 0) {
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
      const gateList = report.gates ?? [];
      for (const b of batches) {
        const match = [...gateList].reverse().find(
          (g) => g.gateId === "smoke_passed" && g.stepId === b.stepId && g.eventContext === "batch_gate" && typeof g.batchIndex === "number" && g.batchIndex === b.batchIndex
        );
        if (match) {
          b.smokeGate = {
            passed: match.passed,
            budgetMinutes: match.budgetMinutes,
            totalDurationMs: match.totalDurationMs
          };
        }
      }
      report.batches = batches;
    }
    const agentCallEvents = [];
    const lastActionByRequestId = /* @__PURE__ */ new Map();
    for (const entry of taskBook.changelog) {
      const after = entry.after;
      if (!isPlainObject2(after)) continue;
      if (after.event !== "agent-call") continue;
      const requestId = after.requestId;
      if (typeof requestId !== "string" || requestId.length === 0) continue;
      const action = after.action === "created" || after.action === "applied" ? after.action : void 0;
      if (action) lastActionByRequestId.set(requestId, action);
      const agentId = typeof after.agentId === "string" ? after.agentId : void 0;
      const kindRaw = after.kind;
      const kind = kindRaw === "planner" || kindRaw === "manual-task" ? kindRaw : void 0;
      const statusRaw = after.status;
      const status = statusRaw === "success" || statusRaw === "failed" || statusRaw === "blocked" ? statusRaw : void 0;
      const createdAt2 = typeof after.createdAt === "string" ? after.createdAt : void 0;
      const completedAt2 = typeof after.completedAt === "string" ? after.completedAt : void 0;
      const promptPath = typeof after.promptPath === "string" ? after.promptPath : void 0;
      const resultPath = typeof after.resultPath === "string" ? after.resultPath : void 0;
      let artifacts;
      const rawArtifacts = after.artifacts;
      if (Array.isArray(rawArtifacts)) {
        const parsed = [];
        for (const a of rawArtifacts) {
          if (!isPlainObject2(a)) continue;
          const type = typeof a.type === "string" ? a.type : "";
          const p = typeof a.path === "string" ? a.path : "";
          if (!type || !p) continue;
          const description = typeof a.description === "string" ? a.description : void 0;
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
        createdAt: createdAt2,
        completedAt: completedAt2,
        promptPath,
        resultPath,
        artifacts
      });
    }
    if (agentCallEvents.length > 0) {
      report.agentCalls = agentCallEvents;
      const pending = Array.from(lastActionByRequestId.values()).filter((a) => a === "created").length;
      if (pending > 0) {
        report.recommendations.mustDo.push(
          `\u8865\u9F50 ${pending} \u4E2A agent-call \u7684 result.json \u56DE\u586B\uFF08.codebuddy/agent-calls/*.result.json\uFF09\uFF0C\u4EE5\u6062\u590D\u95ED\u73AF\u6267\u884C`
        );
      }
    }
    const missingScope = taskBook.tasks.filter((t) => {
      if (t.status !== "pending") return false;
      if (t.type !== "analysis" && t.type !== "design" && t.type !== "implement") return false;
      const files = t.scope?.files ?? [];
      const modules = t.scope?.modules ?? [];
      return files.length === 0 && modules.length === 0;
    });
    if (missingScope.length > 0) {
      report.recommendations.suggested.push(
        `\u53D1\u73B0 ${missingScope.length} \u4E2A pending \u7684\u5B9E\u73B0\u76F8\u5173\u4EFB\u52A1\u7F3A\u5C11 scope.files/modules\uFF1B\u6279\u91CF\u9884\u7B97\u4E0E\u5E76\u884C\u51B2\u7A81\u68C0\u6D4B\u5C06\u9000\u5316\u4E3A\u4E32\u884C\u3002\u5EFA\u8BAE\u5728\u89C4\u5212\u9636\u6BB5\u4E3A\u4EFB\u52A1\u8865\u9F50 scope\u3002`
      );
    }
    const executorCounts = {};
    for (const task of taskBook.tasks) {
      if (task.status === "done" && task.executedBy) {
        executorCounts[task.executedBy] = (executorCounts[task.executedBy] || 0) + 1;
      }
    }
    if (Object.keys(executorCounts).length > 0) {
      report.summary["executorDistribution"] = executorCounts;
    }
    const batchCompleteEvents = [];
    for (const entry of taskBook.changelog) {
      const after = entry.after;
      if (!isPlainObject2(after)) continue;
      if (after.event !== "batch_complete") continue;
      batchCompleteEvents.push({
        succeeded: typeof after.succeeded === "number" ? after.succeeded : 0,
        failed: typeof after.failed === "number" ? after.failed : 0,
        duration: typeof after.duration === "number" ? after.duration : 0,
        executors: Array.isArray(after.executors) ? after.executors.filter((v) => typeof v === "string") : []
      });
    }
    if (batchCompleteEvents.length > 0) {
      report.summary["batchCompleteCount"] = batchCompleteEvents.length;
      report.summary["totalBatchDuration"] = batchCompleteEvents.reduce((s, b) => s + b.duration, 0);
    }
    if (blockedTasks > 0) {
      report.recommendations.mustDo.push(`\u89E3\u51B3 ${blockedTasks} \u4E2A\u963B\u585E\u7684\u4EFB\u52A1`);
    }
    if (skippedTasks > 0) {
      report.recommendations.suggested.push(`\u8BC4\u4F30 ${skippedTasks} \u4E2A\u8DF3\u8FC7\u7684\u4EFB\u52A1\u662F\u5426\u9700\u8981\u540E\u7EED\u5904\u7406`);
    }
    return report;
  }
  /**
   * 获取可并行执行的任务
   */
  getParallelizableTasks(taskBookId) {
    const taskBook = this.load(taskBookId);
    if (!taskBook) return [];
    const completedTaskIds = new Set(
      taskBook.tasks.filter((t) => t.status === "done" || t.status === "skipped").map((t) => t.id)
    );
    return taskBook.tasks.filter((task) => {
      if (task.status !== "pending") return false;
      return task.dependencies.every((depId) => completedTaskIds.has(depId));
    });
  }
  /**
   * 格式化 TaskBook 为用户可读的计划展示
   */
  formatForDisplay(taskBook) {
    const typeEmoji = {
      requirement: "\u{1F4CB}",
      prd: "\u{1F4C4}",
      analysis: "\u{1F50D}",
      design: "\u{1F4D0}",
      test: "\u{1F9EA}",
      implement: "\u{1F4BB}",
      refactor: "\u267B\uFE0F",
      review: "\u{1F440}",
      "build-fix": "\u{1F527}",
      acceptance: "\u2705"
    };
    const typeLabel = {
      requirement: "\u9700\u6C42",
      prd: "PRD",
      analysis: "\u5206\u6790",
      design: "\u8BBE\u8BA1",
      test: "\u6D4B\u8BD5",
      implement: "\u5B9E\u73B0",
      refactor: "\u91CD\u6784",
      review: "\u5BA1\u67E5",
      "build-fix": "\u6784\u5EFA\u4FEE\u590D",
      acceptance: "\u9A8C\u6536"
    };
    const lines = [
      "\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557",
      `\u2551 \u{1F4CB} \u4EFB\u52A1\u8BA1\u5212\u4E66 - ${taskBook.title.padEnd(40)}\u2551`,
      "\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563",
      `\u2551 \u{1F4DD} \u9700\u6C42\u6982\u8FF0: ${taskBook.description.slice(0, 44).padEnd(44)}\u2551`,
      `\u2551 \u{1F4C1} \u5F71\u54CD\u8303\u56F4: ${taskBook.context.relatedFiles.slice(0, 2).join(", ").slice(0, 44).padEnd(44)}\u2551`,
      `\u2551 \u{1F4CA} \u4EFB\u52A1\u603B\u6570: ${String(taskBook.tasks.length).padEnd(44)} \u4E2A\u2551`,
      "\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563",
      "\u2551 \u4EFB\u52A1\u6E05\u5355:                                                     \u2551"
    ];
    taskBook.tasks.forEach((task, index) => {
      const emoji = typeEmoji[task.type];
      const label = typeLabel[task.type];
      const taskLine = `${index + 1}. ${task.id} [${label}] [${task.status}] ${task.title}`;
      lines.push(`\u2551  ${emoji} ${taskLine.slice(0, 54).padEnd(54)}\u2551`);
    });
    lines.push("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    lines.push("\u2551 \u2753 \u8BF7\u786E\u8BA4\u662F\u5426\u5F00\u59CB\u6267\u884C\uFF1F                                        \u2551");
    lines.push("\u2551 [\u2705 \u786E\u8BA4\u6267\u884C] [\u270F\uFE0F \u4FEE\u6539\u8BA1\u5212] [\u274C \u53D6\u6D88]                          \u2551");
    lines.push("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
    return lines.join("\n");
  }
  /**
   * 持久化 FinalReport 到 TaskBook
   *
   * 将 Phase 7 汇总报告写入 TaskBook.finalReport 字段，
   * 同时将报告写入 .codebuddy/reports/final-{taskBookId}.json 方便外部工具读取。
   *
   * 使用文件锁保证 load → save 的原子性，防止并发写入导致数据丢失。
   */
  saveFinalReport(taskBookId, report) {
    this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) throw new Error(`TaskBook not found: ${taskBookId}`);
      const updated = { ...taskBook, finalReport: report };
      this.touch(updated);
      this.save(updated);
    });
    const reportsDir = path2.join(this.baseDir, ".codebuddy", "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const reportPath = path2.join(reportsDir, `final-${taskBookId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  }
};
var taskBookManager = new TaskBookManager();
var REQUIRE_IF_REV_ENV = "CODEBUDDY_TASKBOOK_REQUIRE_IF_REV";
var MUTATING_COMMANDS_REQUIRING_IF_REV = /* @__PURE__ */ new Set([
  "confirm",
  "complete",
  "abort",
  "add-task",
  "update-task",
  "unblock",
  "claim",
  "append-work",
  "apply-plan"
]);
function isTruthyEnv(name) {
  const raw = process.env[name];
  if (!raw) return false;
  switch (raw.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "y":
    case "on":
      return true;
    default:
      return false;
  }
}
function showHelp() {
  console.log(`
TaskBook Manager - TaskBook \u4EFB\u52A1\u4E8B\u5B9E\u6E90\u7BA1\u7406\u5DE5\u5177

\u7528\u6CD5:
  node .codebuddy/scripts/taskbook-manager.js <command> [args] [options]

common options:
  --json                       \u8F93\u51FA JSON
  --if-rev <number>            \u53EF\u9009\uFF1A\u5199\u5165\u524D\u68C0\u67E5 TaskBook.revision\uFF08\u907F\u514D\u591A Agent \u8986\u76D6\uFF09
  --require-if-rev             \u53EF\u9009\uFF1A\u5F3A\u5236\u5199\u64CD\u4F5C\u5FC5\u987B\u63D0\u4F9B --if-rev\uFF08\u6216\u8BBE\u7F6E env ${REQUIRE_IF_REV_ENV}=1\uFF09

\u547D\u4EE4:
  create                      \u521B\u5EFA TaskBook
  list                        \u5217\u51FA active TaskBooks
  show <taskBookId>            \u67E5\u770B TaskBook\uFF08\u9ED8\u8BA4\u683C\u5F0F\u5316\u8F93\u51FA\uFF09
  report <taskBookId>          \u751F\u6210\u9A8C\u6536/\u6279\u91CF/\u95F8\u95E8\u62A5\u544A\uFF08\u53EF\u9009\u843D\u76D8\uFF09
  plan <taskBookId>            \u751F\u6210 planner Agent prompt\uFF08\u5199\u5165 .codebuddy/agent-calls/\uFF09
  apply-plan <taskBookId> <requestId>  \u4ECE result.json \u8FFD\u52A0\u4EFB\u52A1\u5230 TaskBook
  confirm <taskBookId>         \u5C06 TaskBook \u72B6\u6001\u8BBE\u4E3A confirmed
  complete <taskBookId>        \u5C06 TaskBook \u72B6\u6001\u8BBE\u4E3A completed\uFF08\u4F1A\u5F52\u6863\u5230 history\uFF09
  abort <taskBookId>           \u5C06 TaskBook \u72B6\u6001\u8BBE\u4E3A aborted\uFF08\u4F1A\u5F52\u6863\u5230 history\uFF09
  add-task <taskBookId>        \u6DFB\u52A0\u4EFB\u52A1
  update-task <taskBookId> <taskId>   \u66F4\u65B0\u4EFB\u52A1\uFF08status/priority/deps/actualWork/blockedReason/...\uFF09
  unblock <taskBookId> <taskId>       \u89E3\u9664 blocked \u4EFB\u52A1\u5E76\u6062\u590D\u4E3A pending
  claim <taskBookId> <taskId>  \u8BA4\u9886\u4EFB\u52A1\uFF08\u8BBE\u7F6E executedBy\uFF09
  append-work <taskBookId> <taskId>   \u8FFD\u52A0 actualWork \u6587\u672C

create options:
  --title <text>               \u6807\u9898\uFF08\u5FC5\u586B\uFF09
  --description <text>         \u63CF\u8FF0\uFF08\u5FC5\u586B\uFF09
  --type <new-feature|refactoring|debugging|testing|code-review>  TaskBook \u7C7B\u578B\uFF08\u5FC5\u586B\uFF09
  --json                       \u8F93\u51FA JSON

add-task options:
  --files <p1,p2>              \uFF08\u53EF\u9009\uFF09\u4EFB\u52A1\u6D89\u53CA\u6587\u4EF6\u5217\u8868\uFF08\u9017\u53F7\u5206\u9694\uFF09
  --modules <m1,m2>            \uFF08\u53EF\u9009\uFF09\u4EFB\u52A1\u6D89\u53CA\u6A21\u5757\u5217\u8868\uFF08\u9017\u53F7\u5206\u9694\uFF09
  --tags <t1,t2>               \uFF08\u53EF\u9009\uFF09\u4EFB\u52A1\u6807\u7B7E\uFF08\u9017\u53F7\u5206\u9694\uFF09
  --title <text>               \u6807\u9898\uFF08\u5FC5\u586B\uFF09
  --type <analysis|design|test|implement|review>   \u4EFB\u52A1\u7C7B\u578B\uFF08\u5FC5\u586B\uFF09
  --priority <critical|high|medium|low>            \u4F18\u5148\u7EA7\uFF08\u9ED8\u8BA4 medium\uFF09
  --deps <id1,id2>             \u4F9D\u8D56\u4EFB\u52A1 ID\uFF08\u9017\u53F7\u5206\u9694\uFF09
  --ac <text>                  \u9A8C\u6536\u6807\u51C6\uFF08\u53EF\u91CD\u590D\uFF09
  --json                       \u8F93\u51FA JSON

update-task options:
  --files <p1,p2>              \uFF08\u53EF\u9009\uFF09\u4EFB\u52A1\u6D89\u53CA\u6587\u4EF6\u5217\u8868\uFF08\u9017\u53F7\u5206\u9694\uFF09
  --modules <m1,m2>            \uFF08\u53EF\u9009\uFF09\u4EFB\u52A1\u6D89\u53CA\u6A21\u5757\u5217\u8868\uFF08\u9017\u53F7\u5206\u9694\uFF09
  --tags <t1,t2>               \uFF08\u53EF\u9009\uFF09\u4EFB\u52A1\u6807\u7B7E\uFF08\u9017\u53F7\u5206\u9694\uFF09
  --status <pending|in_progress|done|blocked|skipped>
  --priority <critical|high|medium|low>
  --deps <id1,id2>
  --ac <text>                  \u9A8C\u6536\u6807\u51C6\uFF08\u53EF\u91CD\u590D\uFF1B\u4F1A\u8986\u76D6\uFF09
  --actual-work <text>
  --blocked-reason <text>
  --executed-by <name>
  --title <text>
  --json

claim options:
  --by <name>                  \u6267\u884C\u8005/\u8BA4\u9886\u8005\u6807\u8BC6\uFF08\u5FC5\u586B\uFF09
  --json

report options:
  --write                      \u5199\u5165\u5230 .codebuddy/reports/taskbooks/<id>.acceptance.json\uFF08\u6216\u7531 --out \u6307\u5B9A\uFF09
  --out <path>                 \u81EA\u5B9A\u4E49\u8F93\u51FA\u8DEF\u5F84\uFF08\u53EF\u9009\uFF09
  --json

plan options:
  --request-id <id>            \uFF08\u53EF\u9009\uFF09\u81EA\u5B9A\u4E49 requestId\uFF08\u9ED8\u8BA4\u81EA\u52A8\u751F\u6210\uFF09
  --json

apply-plan options:
  --dry-run                    \u53EA\u9884\u89C8\uFF0C\u4E0D\u5199\u5165 TaskBook
  --json

unblock options:
  --resolution <text>          \u89E3\u9664\u963B\u585E\u8BF4\u660E\uFF08\u5FC5\u586B\uFF09
  --json

\u8BF4\u660E:
  - TaskBook \u662F\u552F\u4E00\u4E8B\u5B9E\u6E90\uFF1Bworkflow/\u6267\u884C\u5668\u4F1A\u8BFB\u53D6\u5176\u72B6\u6001\u63A8\u8FDB\u95ED\u73AF\u3002
  - \u5F53\u4EFB\u52A1\u9700\u8981\u4EBA\u5DE5/Agent \u4ECB\u5165\u65F6\uFF0C\u53EF\u5148\u5C06\u4EFB\u52A1\u6807\u8BB0\u4E3A blocked\uFF0C\u5904\u7406\u540E\u518D\u6539\u4E3A done\uFF0C\u5E76\u8865\u5145 actualWork\u3002
`);
}
function parseCli(argv) {
  const args = argv.slice();
  const command = args.shift() ?? null;
  const positionals = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const eqIndex = arg.indexOf("=");
    const rawKey = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
    const key = rawKey.trim();
    let value = true;
    if (eqIndex >= 0) {
      value = arg.slice(eqIndex + 1);
    } else if (args[i + 1] && !args[i + 1].startsWith("--")) {
      value = args[++i];
    }
    const existing = flags[key];
    if (typeof existing === "undefined") {
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
function flagAsString(flags, key) {
  const v = flags[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return void 0;
}
function flagAsBool(flags, key) {
  return flags[key] === true;
}
function flagAsStringArray(flags, key) {
  const v = flags[key];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v;
  return [];
}
function parseCsv(value) {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
function buildScope(files, modules, tags) {
  const scope = {};
  if (files.length > 0) scope.files = files;
  if (modules.length > 0) scope.modules = modules;
  if (tags.length > 0) scope.tags = tags;
  return Object.keys(scope).length > 0 ? scope : void 0;
}
function expectedRevisionFromFlags(flags) {
  const raw = flagAsString(flags, "if-rev") ?? flagAsString(flags, "if-revision");
  if (typeof raw === "undefined") return void 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("\u9519\u8BEF: --if-rev \u5FC5\u987B\u662F\u975E\u8D1F\u6574\u6570");
  }
  return n;
}
function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}
function generateRequestId() {
  const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `req-${ts}-${rnd}`;
}
function readTextFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}
function loadPlannerAgentDefinition(projectRoot) {
  const candidates = [
    path2.join(projectRoot, ".codebuddy", "agents", "planner", "AGENT.md"),
    path2.join(projectRoot, "agents", "planner", "AGENT.md")
  ];
  for (const p of candidates) {
    const content = readTextFileIfExists(p);
    if (content) return { path: p, content };
  }
  return null;
}
function extractAgentVersion(agentMarkdown) {
  const fm = agentMarkdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  const frontmatter = fm ? fm[1] : null;
  if (frontmatter) {
    const m = frontmatter.match(/^version:\s*(.+)$/m);
    const v = m ? m[1].trim() : "";
    return v ? v : void 0;
  }
  const yaml = agentMarkdown.match(/```ya?ml\s*([\s\S]*?)\s*```/);
  if (yaml) {
    const m = yaml[1].match(/^version:\s*(.+)$/m);
    const v = m ? m[1].trim() : "";
    return v ? v : void 0;
  }
  return void 0;
}
function buildPlannerPrompt(args) {
  const agentVersion = args.agentDefinition ? extractAgentVersion(args.agentDefinition) : void 0;
  const header = {
    requestId: args.requestId,
    agentId: "planner",
    agentVersion,
    taskBookId: args.taskBook.id,
    timestamp: now(),
    taskBookRevision: typeof args.taskBook.revision === "number" ? args.taskBook.revision : 0,
    promptPath: args.promptPath,
    resultPath: args.resultPath
  };
  const references = [
    ".codebuddy/rules/project-rules.md",
    ".codebuddy/reports/architecture/latest.json",
    ".codebuddy/reports/modules/latest.json"
  ];
  const agentDefinition = args.agentDefinition ?? "(missing AGENT.md)";
  const agentDefinitionHint = args.agentDefinitionPath ? `source: ${args.agentDefinitionPath}` : "source: (not found)";
  const schemaExample = {
    requestId: args.requestId,
    kind: "planner",
    status: "success",
    output: {
      tasks: [
        {
          planId: "T1",
          title: "\u7406\u89E3\u9700\u6C42 & \u68B3\u7406\u5F71\u54CD\u8303\u56F4",
          type: "analysis",
          priority: "high",
          acceptanceCriteria: ["\u8F93\u51FA\u5F71\u54CD\u8303\u56F4\u6E05\u5355", "\u660E\u786E\u975E\u76EE\u6807/\u7EA6\u675F"]
        },
        {
          planId: "T2",
          title: "\u5236\u5B9A\u5B9E\u73B0\u65B9\u6848\uFF08\u542B\u63A5\u53E3/\u6570\u636E\u7ED3\u6784\uFF09",
          type: "design",
          dependencies: ["T1"],
          acceptanceCriteria: ["\u7ED9\u51FA\u65B9\u6848\u4E0E\u53D6\u820D", "\u660E\u786E\u4EFB\u52A1\u62C6\u5206\u4E0E\u5173\u952E\u8DEF\u5F84"]
        }
      ],
      notes: "tasks \u5FC5\u987B\u6309\u4F9D\u8D56\u987A\u5E8F\u6392\u5E8F\uFF08dependencies \u53EA\u80FD\u6307\u5411\u66F4\u65E9\u7684 planId\uFF09\u3002"
    },
    completedAt: now()
  };
  return [
    "# Agent Call: planner",
    "",
    "## Header (JSON)",
    "```json",
    JSON.stringify(header, null, 2),
    "```",
    "",
    `## Agent Definition (${agentDefinitionHint})`,
    "```md",
    agentDefinition.trimEnd(),
    "```",
    "",
    "## Context: TaskBook JSON",
    "```json",
    JSON.stringify(args.taskBook, null, 2),
    "```",
    "",
    "## Context: Optional References (paths)",
    ...references.map((p) => `- ${p}`),
    "",
    "## Instructions",
    "\u4F60\u662F planner Agent\u3002\u8BF7\u57FA\u4E8E\u4E0A\u9762\u7684 TaskBook\uFF08\u4EE5\u53CA\u53EF\u9009\u7684 rules/reports\uFF09\u751F\u6210\u53EF\u76F4\u63A5\u5199\u5165 TaskBook \u7684\u4EFB\u52A1\u5217\u8868\u3002",
    "",
    "\u8981\u6C42\uFF1A",
    "- \u8F93\u51FA\u5FC5\u987B\u53EF\u88AB\u811A\u672C\u81EA\u52A8\u6D88\u8D39\uFF1A\u4E0D\u8981\u8F93\u51FA Markdown\uFF0C\u4E0D\u8981\u8F93\u51FA\u89E3\u91CA\u6027\u6587\u672C\u3002",
    "- \u53EA\u751F\u6210 task \u7EA7\u522B\u7684\u539F\u5B50\u4EFB\u52A1\uFF08INVEST\uFF09\uFF0C\u786E\u4FDD\u6BCF\u4E2A\u4EFB\u52A1 1-3 \u5929\u5185\u53EF\u5B8C\u6210\u3002",
    "- \u4EFB\u52A1\u7C7B\u578B\u5FC5\u987B\u662F\u4EE5\u4E0B\u4E4B\u4E00\uFF1Aanalysis | design | test | implement | review\u3002",
    "- dependencies \u53EA\u80FD\u5F15\u7528\u672C\u6B21\u8BA1\u5212\u4E2D\u66F4\u65E9\u7684 planId\uFF08\u786E\u4FDD tasks \u5DF2\u6309\u4F9D\u8D56\u62D3\u6251\u987A\u5E8F\u6392\u5E8F\uFF09\u3002",
    "- acceptanceCriteria \u5EFA\u8BAE\u7ED9 2-5 \u6761\u53EF\u9A8C\u8BC1\u8981\u70B9\u3002",
    "- scope \u53EF\u9009\uFF1Afiles/modules/tags\uFF08\u6570\u7EC4\uFF09\u3002",
    "",
    `\u5199\u5165\u76EE\u6807\uFF1A\u8BF7\u628A\u7ED3\u679C\u5199\u5165 ${args.resultPath}`,
    "",
    "\u8F93\u51FA JSON Schema\uFF08\u7B80\u5316\u7248\uFF09\uFF1A",
    "- requestId: string\uFF08\u5FC5\u987B\u4E0E header.requestId \u4E00\u81F4\uFF09",
    "- kind?: 'planner' | 'manual-task'\uFF08\u63A8\u8350\uFF0C\u7528\u4E8E\u66F4\u5F3A\u6821\u9A8C/\u8BCA\u65AD\uFF09",
    "- status: 'success' | 'failed' | 'blocked'",
    "- output.tasks: PlannerPlanTask[]",
    "",
    "PlannerPlanTask:",
    "- planId: string\uFF08\u5982 T1/T2...\uFF0C\u672C\u6B21\u8BA1\u5212\u5185\u552F\u4E00\uFF09",
    "- title: string",
    "- type: 'analysis' | 'design' | 'test' | 'implement' | 'review'",
    "- priority?: 'critical' | 'high' | 'medium' | 'low'",
    "- dependencies?: string[]\uFF08planId \u5217\u8868\uFF09",
    "- acceptanceCriteria?: string[]",
    "- scope?: { files?: string[]; modules?: string[]; tags?: string[] }",
    "",
    "\u793A\u4F8B\uFF08\u5FC5\u987B\u662F JSON\uFF0C\u4E0D\u8981\u5305\u88F9 Markdown\uFF09\uFF1A",
    "```json",
    JSON.stringify(schemaExample, null, 2),
    "```",
    ""
  ].join("\n");
}
function parseAgentCallResult(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("\u9519\u8BEF: result.json \u5FC5\u987B\u662F JSON object");
  }
  const obj = parsed;
  const requestId = obj.requestId;
  const status = obj.status;
  if (typeof requestId !== "string" || !requestId) {
    throw new Error("\u9519\u8BEF: result.json \u7F3A\u5C11 requestId");
  }
  if (status !== "success" && status !== "failed" && status !== "blocked") {
    throw new Error("\u9519\u8BEF: result.json.status \u5FC5\u987B\u662F 'success' | 'failed' | 'blocked'");
  }
  const output = obj.output;
  const error = obj.error;
  const completedAt = obj.completedAt;
  return {
    requestId,
    status,
    output,
    error: typeof error === "object" && error ? error : void 0,
    completedAt: typeof completedAt === "string" ? completedAt : void 0
  };
}
function parsePlannerTasksFromAgentResult(result) {
  const output = result.output;
  if (!output || typeof output !== "object") {
    throw new Error("\u9519\u8BEF: result.output \u5FC5\u987B\u662F object\uFF0C\u4E14\u5305\u542B output.tasks[]");
  }
  const outObj = output;
  const tasks = outObj.tasks;
  if (!Array.isArray(tasks)) {
    throw new Error("\u9519\u8BEF: result.output.tasks \u5FC5\u987B\u662F\u6570\u7EC4");
  }
  const allowedTypes = /* @__PURE__ */ new Set(["analysis", "design", "test", "implement", "review"]);
  const allowedPriorities = /* @__PURE__ */ new Set(["critical", "high", "medium", "low"]);
  const seenPlanIds = /* @__PURE__ */ new Set();
  const parsedTasks = [];
  for (const [index, raw] of tasks.entries()) {
    if (!raw || typeof raw !== "object") {
      throw new Error(`\u9519\u8BEF: tasks[${index}] \u5FC5\u987B\u662F object`);
    }
    const t = raw;
    const planId = t.planId;
    const title = t.title;
    const type = t.type;
    const priority = t.priority;
    if (typeof planId !== "string" || !planId) {
      throw new Error(`\u9519\u8BEF: tasks[${index}].planId \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    }
    if (seenPlanIds.has(planId)) {
      throw new Error(`\u9519\u8BEF: planId \u91CD\u590D: ${planId}`);
    }
    seenPlanIds.add(planId);
    if (typeof title !== "string" || !title.trim()) {
      throw new Error(`\u9519\u8BEF: tasks[${index}].title \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    }
    if (typeof type !== "string" || !allowedTypes.has(type)) {
      throw new Error(`\u9519\u8BEF: tasks[${index}].type \u65E0\u6548: ${String(type)}`);
    }
    let parsedPriority;
    if (typeof priority !== "undefined") {
      if (typeof priority !== "string" || !allowedPriorities.has(priority)) {
        throw new Error(`\u9519\u8BEF: tasks[${index}].priority \u65E0\u6548: ${String(priority)}`);
      }
      parsedPriority = priority;
    }
    const dependencies = [];
    if (typeof t.dependencies !== "undefined") {
      if (!Array.isArray(t.dependencies)) {
        throw new Error(`\u9519\u8BEF: tasks[${index}].dependencies \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
      }
      for (const dep of t.dependencies) {
        if (typeof dep !== "string" || !dep) {
          throw new Error(`\u9519\u8BEF: tasks[${index}].dependencies \u5305\u542B\u65E0\u6548 planId`);
        }
        dependencies.push(dep);
      }
    }
    const acceptanceCriteria = [];
    if (typeof t.acceptanceCriteria !== "undefined") {
      if (!Array.isArray(t.acceptanceCriteria)) {
        throw new Error(`\u9519\u8BEF: tasks[${index}].acceptanceCriteria \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
      }
      for (const ac of t.acceptanceCriteria) {
        if (typeof ac !== "string" || !ac.trim()) {
          throw new Error(`\u9519\u8BEF: tasks[${index}].acceptanceCriteria \u5305\u542B\u65E0\u6548\u6761\u76EE`);
        }
        acceptanceCriteria.push(ac);
      }
    }
    let scope;
    if (typeof t.scope !== "undefined") {
      if (!t.scope || typeof t.scope !== "object") {
        throw new Error(`\u9519\u8BEF: tasks[${index}].scope \u5FC5\u987B\u662F object`);
      }
      const s = t.scope;
      const files = Array.isArray(s.files) ? s.files : void 0;
      const modules = Array.isArray(s.modules) ? s.modules : void 0;
      const tags = Array.isArray(s.tags) ? s.tags : void 0;
      const normalizeStringArray = (arr, key) => {
        if (!arr) return void 0;
        const out = [];
        for (const v of arr) {
          if (typeof v !== "string" || !v.trim()) {
            throw new Error(`\u9519\u8BEF: tasks[${index}].scope.${key} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
          }
          out.push(v);
        }
        return out.length > 0 ? out : void 0;
      };
      scope = {
        files: files ? normalizeStringArray(files, "files") : void 0,
        modules: modules ? normalizeStringArray(modules, "modules") : void 0,
        tags: tags ? normalizeStringArray(tags, "tags") : void 0
      };
      if (!scope.files && !scope.modules && !scope.tags) {
        scope = void 0;
      }
    }
    parsedTasks.push({
      planId,
      title: title.trim(),
      type,
      priority: parsedPriority,
      dependencies: dependencies.length > 0 ? dependencies : void 0,
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : void 0,
      scope
    });
  }
  return parsedTasks;
}
function main() {
  const args = process.argv.slice(2);
  const parsed = parseCli(args);
  if (!parsed.command || parsed.command === "help" || parsed.command === "--help" || parsed.command === "-h") {
    showHelp();
    process.exit(parsed.command ? 0 : 1);
  }
  const manager = new TaskBookManager(process.cwd());
  const json = flagAsBool(parsed.flags, "json");
  const requireIfRev = flagAsBool(parsed.flags, "require-if-rev") || isTruthyEnv(REQUIRE_IF_REV_ENV);
  let expectedRevision;
  try {
    expectedRevision = expectedRevisionFromFlags(parsed.flags);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  if (requireIfRev && MUTATING_COMMANDS_REQUIRING_IF_REV.has(parsed.command) && typeof expectedRevision !== "number") {
    console.error(`\u9519\u8BEF: ${parsed.command} \u9700\u8981 --if-rev <number>\uFF08\u5DF2\u5F00\u542F\u5E76\u53D1\u4FDD\u62A4\uFF09`);
    console.error("\u63D0\u793A: \u5148\u6267\u884C show <taskBookId> \u8BFB\u53D6 revision\uFF0C\u518D\u91CD\u8BD5\u5199\u64CD\u4F5C\u3002");
    process.exit(1);
  }
  try {
    switch (parsed.command) {
      case "create": {
        const title = flagAsString(parsed.flags, "title");
        const description = flagAsString(parsed.flags, "description");
        const type = flagAsString(parsed.flags, "type");
        if (!title || !description || !type) {
          console.error("\u9519\u8BEF: create \u9700\u8981 --title --description --type");
          showHelp();
          process.exit(1);
        }
        const taskBook = manager.create({ title, description, taskType: type });
        if (json) {
          printJson(taskBook);
        } else {
          console.log(`[TaskBook] \u5DF2\u521B\u5EFA: ${taskBook.id}`);
          console.log(manager.formatForDisplay(taskBook));
        }
        break;
      }
      case "list": {
        const list = manager.listActive();
        if (json) {
          printJson(list);
        } else {
          if (list.length === 0) {
            console.log("[TaskBook] \u6CA1\u6709 active TaskBook");
            break;
          }
          console.log("[TaskBook] Active TaskBooks:");
          for (const tb of list) {
            console.log(`- ${tb.id} | ${tb.taskType} | ${tb.status} | ${tb.title}`);
          }
        }
        break;
      }
      case "show": {
        const taskBookId = parsed.positionals[0];
        if (!taskBookId) {
          console.error("\u9519\u8BEF: show \u9700\u8981 <taskBookId>");
          process.exit(1);
        }
        const tb = manager.load(taskBookId);
        if (!tb) {
          console.error(`\u9519\u8BEF: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }
        if (json) {
          printJson(tb);
        } else {
          console.log(manager.formatForDisplay(tb));
          console.log(`
\u72B6\u6001: ${tb.status}`);
          console.log(`\u521B\u5EFA\u65F6\u95F4: ${tb.createdAt}`);
          console.log(`revision: ${tb.revision ?? 0}`);
          if (tb.updatedAt) console.log(`updatedAt: ${tb.updatedAt}`);
          if (tb.confirmedAt) console.log(`\u786E\u8BA4\u65F6\u95F4: ${tb.confirmedAt}`);
          if (tb.completedAt) console.log(`\u5B8C\u6210\u65F6\u95F4: ${tb.completedAt}`);
          console.log(`\u4EFB\u52A1\u6570: ${tb.tasks.length}`);
        }
        break;
      }
      case "report": {
        const taskBookId = parsed.positionals[0];
        const write = flagAsBool(parsed.flags, "write");
        const out = flagAsString(parsed.flags, "out");
        if (!taskBookId) {
          console.error("\u9519\u8BEF: report \u9700\u8981 <taskBookId>");
          process.exit(1);
        }
        const report = manager.generateAcceptanceReport(taskBookId);
        if (!report) {
          console.error(`\u9519\u8BEF: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }
        if (write) {
          const outDir = path2.join(process.cwd(), ".codebuddy", "reports", "taskbooks");
          ensureDir(outDir);
          const outPath = out ? path2.resolve(process.cwd(), out) : path2.join(outDir, `${taskBookId}.acceptance.json`);
          fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
          if (!json) console.log(`[TaskBook] \u5DF2\u751F\u6210\u9A8C\u6536\u62A5\u544A: ${outPath}`);
        }
        if (json || !write) {
          printJson(report);
        }
        break;
      }
      case "plan": {
        const taskBookId = parsed.positionals[0];
        if (!taskBookId) {
          console.error("\u9519\u8BEF: plan \u9700\u8981 <taskBookId>");
          process.exit(1);
        }
        const tb = manager.load(taskBookId);
        if (!tb) {
          console.error(`\u9519\u8BEF: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }
        const requestId = flagAsString(parsed.flags, "request-id") ?? generateRequestId();
        const agentCallsDir = path2.join(process.cwd(), AGENT_CALLS_DIR);
        ensureDir(agentCallsDir);
        const promptPath = path2.join(agentCallsDir, `${requestId}.prompt.md`);
        const resultPath = path2.join(agentCallsDir, `${requestId}.result.json`);
        const agentDef = loadPlannerAgentDefinition(process.cwd());
        if (!agentDef) {
          console.error("\u9519\u8BEF: planner AGENT.md \u672A\u627E\u5230\uFF08\u9700\u8981 .codebuddy/agents/planner/AGENT.md \u6216 agents/planner/AGENT.md\uFF09");
          console.error("\u63D0\u793A: \u5148\u5728\u76EE\u6807\u9879\u76EE\u6267\u884C codebuddy-loader \u751F\u6210 .codebuddy/agents/\uFF0C\u518D\u91CD\u8BD5\u3002");
          process.exit(1);
        }
        const prompt = buildPlannerPrompt({
          requestId,
          taskBook: tb,
          projectRoot: process.cwd(),
          agentDefinitionPath: agentDef.path,
          agentDefinition: agentDef.content,
          promptPath,
          resultPath
        });
        fs.writeFileSync(promptPath, prompt, "utf-8");
        const payload = {
          requestId,
          agentId: "planner",
          taskBookId,
          taskBookRevision: tb.revision ?? 0,
          promptPath,
          resultPath
        };
        if (json) {
          printJson(payload);
        } else {
          console.log(`[planner] \u5DF2\u751F\u6210 prompt: ${promptPath}`);
          console.log(`[planner] \u8BF7\u6267\u884C prompt \u5E76\u5199\u56DE: ${resultPath}`);
          console.log("[planner] \u5199\u56DE\u540E\u6267\u884C:");
          console.log(`  node .codebuddy/scripts/taskbook-manager.js apply-plan ${taskBookId} ${requestId}`);
          console.log(`  # \u82E5\u542F\u7528\u5E76\u53D1\u4FDD\u62A4\uFF1A\u52A0\u4E0A --if-rev ${tb.revision ?? 0}`);
        }
        break;
      }
      case "apply-plan": {
        const taskBookId = parsed.positionals[0];
        const requestId = parsed.positionals[1];
        const dryRun = flagAsBool(parsed.flags, "dry-run");
        if (!taskBookId || !requestId) {
          console.error("\u9519\u8BEF: apply-plan \u9700\u8981 <taskBookId> <requestId>");
          process.exit(1);
        }
        const agentCallsDir = path2.join(process.cwd(), AGENT_CALLS_DIR);
        const resultPath = path2.join(agentCallsDir, `${requestId}.result.json`);
        if (!fs.existsSync(resultPath)) {
          console.error(`\u9519\u8BEF: result.json \u4E0D\u5B58\u5728: ${resultPath}`);
          process.exit(1);
        }
        let result;
        try {
          result = parseAgentCallResult(fs.readFileSync(resultPath, "utf-8"));
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
        if (result.requestId !== requestId) {
          console.error(`\u9519\u8BEF: requestId \u4E0D\u5339\u914D\uFF08args=${requestId}, file=${result.requestId}\uFF09`);
          process.exit(1);
        }
        if (result.status !== "success") {
          const msg = result.error && result.error.message ? result.error.message : `status=${result.status}`;
          console.error(`\u9519\u8BEF: planner result \u4E0D\u662F success: ${msg}`);
          process.exit(1);
        }
        const planTasks = parsePlannerTasksFromAgentResult(result);
        if (dryRun) {
          const preview = {
            dryRun: true,
            requestId,
            taskBookId,
            tasks: planTasks
          };
          if (json) printJson(preview);
          else {
            console.log(`[planner] dry-run: ${taskBookId} <- ${requestId}`);
            for (const t of planTasks) {
              const deps = t.dependencies && t.dependencies.length > 0 ? ` deps=${t.dependencies.join(",")}` : "";
              console.log(`- ${t.planId} [${t.type}] ${t.title}${deps}`);
            }
          }
          break;
        }
        const planIdToIndex = /* @__PURE__ */ new Map();
        for (let i = 0; i < planTasks.length; i++) {
          planIdToIndex.set(planTasks[i].planId, i);
        }
        for (let i = 0; i < planTasks.length; i++) {
          const deps = planTasks[i].dependencies ?? [];
          for (const dep of deps) {
            const depIndex = planIdToIndex.get(dep);
            if (typeof depIndex !== "number") {
              console.error(`\u9519\u8BEF: \u4F9D\u8D56 planId \u4E0D\u5B58\u5728: ${dep} (from ${planTasks[i].planId})`);
              process.exit(1);
            }
            if (depIndex >= i) {
              console.error(`\u9519\u8BEF: dependencies \u5FC5\u987B\u6307\u5411\u66F4\u65E9\u7684 planId\uFF08${planTasks[i].planId} \u4F9D\u8D56 ${dep}\uFF09`);
              process.exit(1);
            }
          }
        }
        const applied = manager.applyPlannerPlan(taskBookId, requestId, planTasks, expectedRevision);
        if (!applied) {
          console.error(`\u9519\u8BEF: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }
        const payload = {
          requestId,
          taskBookId,
          addedTaskIds: applied.taskIds,
          planIdToTaskId: applied.planIdToTaskId,
          taskBook: applied.taskBook
        };
        if (json) printJson(payload);
        else {
          console.log(`[planner] \u5DF2\u8FFD\u52A0 ${applied.taskIds.length} \u4E2A\u4EFB\u52A1\u5230 ${taskBookId}`);
          console.log(`requestId: ${requestId}`);
          for (const id of applied.taskIds) {
            console.log(`- ${id}`);
          }
        }
        break;
      }
      case "confirm": {
        const taskBookId = parsed.positionals[0];
        if (!taskBookId) {
          console.error("\u9519\u8BEF: confirm \u9700\u8981 <taskBookId>");
          process.exit(1);
        }
        const tb = manager.updateStatus(taskBookId, "confirmed", expectedRevision);
        if (!tb) {
          console.error(`\u9519\u8BEF: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }
        if (json) printJson(tb);
        else console.log(`[TaskBook] \u5DF2\u786E\u8BA4: ${taskBookId}`);
        break;
      }
      case "complete": {
        const taskBookId = parsed.positionals[0];
        if (!taskBookId) {
          console.error("\u9519\u8BEF: complete \u9700\u8981 <taskBookId>");
          process.exit(1);
        }
        const tb = manager.updateStatus(taskBookId, "completed", expectedRevision);
        if (!tb) {
          console.error(`\u9519\u8BEF: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }
        if (json) printJson(tb);
        else console.log(`[TaskBook] \u5DF2\u5B8C\u6210\u5E76\u5F52\u6863: ${taskBookId}`);
        break;
      }
      case "abort": {
        const taskBookId = parsed.positionals[0];
        if (!taskBookId) {
          console.error("\u9519\u8BEF: abort \u9700\u8981 <taskBookId>");
          process.exit(1);
        }
        const tb = manager.updateStatus(taskBookId, "aborted", expectedRevision);
        if (!tb) {
          console.error(`\u9519\u8BEF: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }
        if (json) printJson(tb);
        else console.log(`[TaskBook] \u5DF2\u4E2D\u6B62\u5E76\u5F52\u6863: ${taskBookId}`);
        break;
      }
      case "add-task": {
        const taskBookId = parsed.positionals[0];
        if (!taskBookId) {
          console.error("\u9519\u8BEF: add-task \u9700\u8981 <taskBookId>");
          process.exit(1);
        }
        const title = flagAsString(parsed.flags, "title");
        const type = flagAsString(parsed.flags, "type");
        const priority = flagAsString(parsed.flags, "priority");
        const deps = parseCsv(flagAsString(parsed.flags, "deps"));
        const ac = flagAsStringArray(parsed.flags, "ac");
        const files = parseCsv(flagAsString(parsed.flags, "files"));
        const modules = parseCsv(flagAsString(parsed.flags, "modules"));
        const tags = parseCsv(flagAsString(parsed.flags, "tags"));
        if (!title || !type) {
          console.error("\u9519\u8BEF: add-task \u9700\u8981 --title --type");
          showHelp();
          process.exit(1);
        }
        const tb = manager.addTask(taskBookId, {
          title,
          type,
          priority,
          dependencies: deps,
          acceptanceCriteria: ac,
          scope: buildScope(files, modules, tags)
        }, expectedRevision);
        if (!tb) {
          console.error(`\u9519\u8BEF: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }
        if (json) printJson(tb);
        else console.log(`[TaskBook] \u5DF2\u6DFB\u52A0\u4EFB\u52A1: ${tb.tasks[tb.tasks.length - 1].id}`);
        break;
      }
      case "update-task": {
        const taskBookId = parsed.positionals[0];
        const taskId = parsed.positionals[1];
        if (!taskBookId || !taskId) {
          console.error("\u9519\u8BEF: update-task \u9700\u8981 <taskBookId> <taskId>");
          process.exit(1);
        }
        const patch = {};
        const title = flagAsString(parsed.flags, "title");
        if (title) patch.title = title;
        const executedBy = flagAsString(parsed.flags, "executed-by");
        if (executedBy) patch.executedBy = executedBy;
        const status = flagAsString(parsed.flags, "status");
        if (status) patch.status = status;
        const priority = flagAsString(parsed.flags, "priority");
        if (priority) patch.priority = priority;
        const deps = parseCsv(flagAsString(parsed.flags, "deps"));
        if (deps.length > 0) patch.dependencies = deps;
        const ac = flagAsStringArray(parsed.flags, "ac");
        if (ac.length > 0) patch.acceptanceCriteria = ac;
        const files = parseCsv(flagAsString(parsed.flags, "files"));
        const modules = parseCsv(flagAsString(parsed.flags, "modules"));
        const tags = parseCsv(flagAsString(parsed.flags, "tags"));
        const scope = buildScope(files, modules, tags);
        if (scope) patch.scope = scope;
        const actualWork = flagAsString(parsed.flags, "actual-work");
        if (actualWork) patch.actualWork = actualWork;
        const blockedReason = flagAsString(parsed.flags, "blocked-reason");
        if (blockedReason) patch.blockedReason = blockedReason;
        const tb = manager.updateTask(taskBookId, taskId, patch, expectedRevision);
        if (!tb) {
          console.error(`\u9519\u8BEF: TaskBook/task not found: ${taskBookId} ${taskId}`);
          process.exit(1);
        }
        if (json) printJson(tb);
        else console.log(`[TaskBook] \u5DF2\u66F4\u65B0\u4EFB\u52A1: ${taskId}`);
        break;
      }
      case "unblock": {
        const taskBookId = parsed.positionals[0];
        const taskId = parsed.positionals[1];
        const resolution = flagAsString(parsed.flags, "resolution");
        if (!taskBookId || !taskId || !resolution) {
          console.error("\u9519\u8BEF: unblock \u9700\u8981 <taskBookId> <taskId> --resolution <text>");
          process.exit(1);
        }
        const tb = manager.unblockTask(taskBookId, taskId, resolution, expectedRevision);
        if (!tb) {
          console.error(`\u9519\u8BEF: TaskBook/task not found: ${taskBookId} ${taskId}`);
          process.exit(1);
        }
        if (json) printJson(tb);
        else console.log(`[TaskBook] \u5DF2\u89E3\u9664\u963B\u585E: ${taskId}`);
        break;
      }
      case "claim": {
        const taskBookId = parsed.positionals[0];
        const taskId = parsed.positionals[1];
        const by = flagAsString(parsed.flags, "by");
        if (!taskBookId || !taskId || !by) {
          console.error("\u9519\u8BEF: claim \u9700\u8981 <taskBookId> <taskId> --by <name>");
          process.exit(1);
        }
        const tb = manager.updateTask(taskBookId, taskId, { executedBy: by }, expectedRevision);
        if (!tb) {
          console.error(`\u9519\u8BEF: TaskBook/task not found: ${taskBookId} ${taskId}`);
          process.exit(1);
        }
        if (json) printJson(tb);
        else console.log(`[TaskBook] \u5DF2\u8BA4\u9886 ${taskId} -> ${by}`);
        break;
      }
      case "append-work": {
        const taskBookId = parsed.positionals[0];
        const taskId = parsed.positionals[1];
        const text = flagAsString(parsed.flags, "text") ?? parsed.positionals.slice(2).join(" ");
        if (!taskBookId || !taskId || !text) {
          console.error("\u9519\u8BEF: append-work \u9700\u8981 <taskBookId> <taskId> --text <text>");
          process.exit(1);
        }
        const tb = manager.appendTaskActualWork(taskBookId, taskId, text, expectedRevision);
        if (!tb) {
          console.error(`\u9519\u8BEF: TaskBook/task not found: ${taskBookId} ${taskId}`);
          process.exit(1);
        }
        if (json) printJson(tb);
        else console.log(`[TaskBook] \u5DF2\u8FFD\u52A0 actualWork: ${taskId}`);
        break;
      }
      default: {
        console.error(`\u672A\u77E5\u547D\u4EE4: ${parsed.command}`);
        showHelp();
        process.exit(1);
      }
    }
  } catch (error) {
    if (error instanceof TaskBookConflictError) {
      console.error(`\u51B2\u7A81: ${error.message}`);
      process.exit(2);
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
if (isDirectCliEntry("taskbook-manager.js")) {
  main();
}

// scripts/src/context-collector.ts
var fs3 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var import_child_process = require("child_process");

// scripts/src/reference-finder.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var SOURCE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte"
]);
var IGNORE_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".codebuddy",
  ".next",
  ".nuxt",
  ".output"
]);
var MAX_FILE_SIZE = 512 * 1024;
var MAX_FILES_SCAN = 5e3;
function collectSourceFiles(dir, collected, depth = 0) {
  if (depth > 15 || collected.length >= MAX_FILES_SCAN) return;
  let entries;
  try {
    entries = fs2.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (collected.length >= MAX_FILES_SCAN) break;
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      collectSourceFiles(path3.join(dir, entry.name), collected, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path3.extname(entry.name).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    const fullPath = path3.join(dir, entry.name);
    try {
      const stat = fs2.statSync(fullPath);
      if (stat.size > MAX_FILE_SIZE) continue;
    } catch {
      continue;
    }
    collected.push(fullPath);
  }
}
function buildImportPatterns(targetPath, projectRoot) {
  const rel = path3.relative(projectRoot, targetPath).replace(/\\/g, "/");
  const withoutExt = rel.replace(/\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/, "");
  const withoutIndex = withoutExt.replace(/\/index$/, "");
  const patterns = /* @__PURE__ */ new Set();
  patterns.add(withoutExt);
  patterns.add(withoutIndex);
  if (withoutExt.startsWith("src/")) {
    patterns.add(withoutExt.slice(4));
    patterns.add(withoutIndex.slice(4));
  }
  const baseName = path3.basename(withoutExt);
  patterns.add(baseName);
  return Array.from(patterns).filter((p) => p.length > 0);
}
function buildSymbolPattern(symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "g");
}
function searchFileForReferences(filePath, importPatterns, symbolPattern, targetAbsPath) {
  if (targetAbsPath && path3.resolve(filePath) === path3.resolve(targetAbsPath)) {
    return [];
  }
  let content;
  try {
    content = fs2.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }
  const results = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of importPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        const kind = /\brequire\s*\(/.test(line) ? "require" : /\bfrom\s+['"]/.test(line) ? "from" : /\bimport\s/.test(line) ? "import" : "usage";
        results.push({
          filePath,
          line: i + 1,
          column: match.index + 1,
          matchText: line.trim(),
          kind
        });
        break;
      }
    }
    if (symbolPattern) {
      symbolPattern.lastIndex = 0;
      const match = symbolPattern.exec(line);
      if (match) {
        const alreadyMatched = results.some((r) => r.filePath === filePath && r.line === i + 1);
        if (!alreadyMatched) {
          results.push({
            filePath,
            line: i + 1,
            column: match.index + 1,
            matchText: line.trim(),
            kind: "usage"
          });
        }
      }
    }
  }
  return results;
}
function findReferences(target, projectRoot, options) {
  const start = Date.now();
  const maxResults = options?.maxResults ?? 100;
  const sourceFiles = [];
  collectSourceFiles(projectRoot, sourceFiles);
  const targetAbsPath = fs2.existsSync(path3.resolve(projectRoot, target)) ? path3.resolve(projectRoot, target) : null;
  const importPatterns = [];
  if (targetAbsPath) {
    const patterns = buildImportPatterns(targetAbsPath, projectRoot);
    for (const p of patterns) {
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      importPatterns.push(new RegExp(`['"\`](?:@/|~/|\\.{0,2}/)?(?:[^'"\`]*?/)?${escaped}(?:\\.[a-z]+)?['"\`]`, "g"));
    }
  }
  const symbolPattern = options?.symbol ? buildSymbolPattern(options.symbol) : null;
  if (!targetAbsPath && !symbolPattern) {
    const fallbackSymbol = buildSymbolPattern(target);
    const allRefs2 = [];
    for (const file of sourceFiles) {
      if (allRefs2.length >= maxResults) break;
      const refs = searchFileForReferences(file, [], fallbackSymbol, null);
      allRefs2.push(...refs);
    }
    return {
      target,
      references: allRefs2.slice(0, maxResults),
      searchedFiles: sourceFiles.length,
      durationMs: Date.now() - start
    };
  }
  const allRefs = [];
  for (const file of sourceFiles) {
    if (allRefs.length >= maxResults) break;
    const refs = searchFileForReferences(file, importPatterns, symbolPattern, targetAbsPath);
    allRefs.push(...refs);
  }
  return {
    target,
    references: allRefs.slice(0, maxResults),
    searchedFiles: sourceFiles.length,
    durationMs: Date.now() - start
  };
}
function findRelatedTests(targetPath, projectRoot) {
  const results = [];
  const rel = path3.relative(projectRoot, targetPath).replace(/\\/g, "/");
  const parsed = path3.parse(rel);
  const baseName = parsed.name;
  const exactPatterns = [
    `${baseName}.spec.ts`,
    `${baseName}.spec.tsx`,
    `${baseName}.test.ts`,
    `${baseName}.test.tsx`,
    `${baseName}.spec.js`,
    `${baseName}.spec.jsx`,
    `${baseName}.test.js`,
    `${baseName}.test.jsx`
  ];
  const testDirs = [
    path3.dirname(path3.join(projectRoot, rel)),
    // 同目录
    path3.join(projectRoot, "__tests__"),
    // 根 __tests__
    path3.join(projectRoot, "test"),
    // 根 test
    path3.join(projectRoot, "tests"),
    // 根 tests
    path3.join(projectRoot, "src", "__tests__"),
    // src/__tests__
    path3.join(path3.dirname(path3.join(projectRoot, rel)), "__tests__")
    // 同级 __tests__
  ];
  const seen = /* @__PURE__ */ new Set();
  for (const dir of testDirs) {
    if (!fs2.existsSync(dir)) continue;
    let entries;
    try {
      entries = fs2.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path3.join(dir, entry);
      const normalized = path3.resolve(fullPath);
      if (seen.has(normalized)) continue;
      if (exactPatterns.includes(entry)) {
        seen.add(normalized);
        results.push({
          testPath: path3.relative(projectRoot, fullPath).replace(/\\/g, "/"),
          sourcePath: rel,
          confidence: "exact"
        });
        continue;
      }
      if ((entry.includes(".spec.") || entry.includes(".test.")) && entry.includes(baseName)) {
        seen.add(normalized);
        results.push({
          testPath: path3.relative(projectRoot, fullPath).replace(/\\/g, "/"),
          sourcePath: rel,
          confidence: "pattern"
        });
      }
    }
  }
  if (results.length === 0) {
    const sourceDir = path3.dirname(path3.join(projectRoot, rel));
    if (fs2.existsSync(sourceDir)) {
      try {
        const entries = fs2.readdirSync(sourceDir);
        for (const entry of entries) {
          if (entry.includes(".spec.") || entry.includes(".test.")) {
            const fullPath = path3.join(sourceDir, entry);
            const normalized = path3.resolve(fullPath);
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            results.push({
              testPath: path3.relative(projectRoot, fullPath).replace(/\\/g, "/"),
              sourcePath: rel,
              confidence: "directory"
            });
          }
        }
      } catch {
      }
    }
  }
  return results;
}
function showHelp2() {
  console.log(`
Reference Finder - \u8F7B\u91CF\u7EA7\u5F15\u7528\u8FFD\u8E2A\u5668

\u7528\u6CD5:
  node .codebuddy/scripts/reference-finder.js <target> [options]

\u53C2\u6570:
  target                \u76EE\u6807\u6587\u4EF6\u8DEF\u5F84\u6216\u7B26\u53F7\u540D

\u9009\u9879:
  --symbol <name>       \u989D\u5916\u641C\u7D22\u6307\u5B9A\u7B26\u53F7\u7684\u5F15\u7528
  --max <n>             \u6700\u5927\u7ED3\u679C\u6570\uFF08\u9ED8\u8BA4: 100\uFF09
  --tests               \u540C\u65F6\u67E5\u627E\u5173\u8054\u6D4B\u8BD5\u6587\u4EF6
  --json                \u4EE5 JSON \u683C\u5F0F\u8F93\u51FA
  -h, --help            \u663E\u793A\u5E2E\u52A9
`);
}
function main2() {
  const args = process.argv.slice(2);
  let target = "";
  let symbol;
  let maxResults = 100;
  let findTests = false;
  let jsonOutput = false;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }
    if (arg === "--symbol" && args[i + 1]) {
      symbol = args[++i];
      continue;
    }
    if (arg === "--max" && args[i + 1]) {
      maxResults = parseInt(args[++i], 10) || 100;
      continue;
    }
    if (arg === "--tests") {
      findTests = true;
      continue;
    }
    if (arg === "--json") {
      jsonOutput = true;
      continue;
    }
    if (!arg.startsWith("-") && !target) {
      target = arg;
    }
  }
  if (help || !target) {
    showHelp2();
    process.exit(target ? 0 : 1);
  }
  const projectRoot = process.cwd();
  const result = findReferences(target, projectRoot, { symbol, maxResults });
  if (jsonOutput) {
    const output = { ...result };
    if (findTests) {
      const absTarget = fs2.existsSync(path3.resolve(projectRoot, target)) ? path3.resolve(projectRoot, target) : null;
      if (absTarget) {
        output.relatedTests = findRelatedTests(absTarget, projectRoot);
      }
    }
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`
\u5F15\u7528\u8FFD\u8E2A: ${result.target}`);
    console.log(`\u626B\u63CF\u6587\u4EF6: ${result.searchedFiles}\uFF0C\u8017\u65F6: ${result.durationMs}ms`);
    console.log(`\u627E\u5230 ${result.references.length} \u5904\u5F15\u7528:
`);
    for (const ref of result.references) {
      const relPath = path3.relative(projectRoot, ref.filePath).replace(/\\/g, "/");
      console.log(`  ${relPath}:${ref.line} [${ref.kind}]`);
      console.log(`    ${ref.matchText}`);
    }
    if (findTests) {
      const absTarget = fs2.existsSync(path3.resolve(projectRoot, target)) ? path3.resolve(projectRoot, target) : null;
      if (absTarget) {
        const tests = findRelatedTests(absTarget, projectRoot);
        if (tests.length > 0) {
          console.log(`
\u5173\u8054\u6D4B\u8BD5\u6587\u4EF6 (${tests.length}):
`);
          for (const t of tests) {
            console.log(`  ${t.testPath} [${t.confidence}]`);
          }
        }
      }
    }
  }
}
if (isDirectCliEntry("reference-finder.js")) {
  main2();
}

// scripts/src/context-collector.ts
var MAX_FILE_CONTENT_LINES = 300;
var MAX_FILE_CONTENT_CHARS = 2e4;
var MAX_GIT_COMMITS = 10;
var MAX_REFERENCES_PER_FILE = 30;
var COLLECT_TIMEOUT_MS = 15e3;
function extractTargetFiles(task) {
  const files = [];
  if (task.scope?.files) {
    for (const f of task.scope.files) {
      if (typeof f === "string" && f.trim().length > 0) {
        files.push(f.trim());
      }
    }
  }
  const pathPattern = /(?:^|\s)((?:src|lib|components|pages|utils|hooks|services|api|store|modules)\/[\w./-]+\.\w+)/g;
  const textSources = [task.title, ...task.acceptanceCriteria ?? []];
  for (const text of textSources) {
    if (!text) continue;
    let match;
    pathPattern.lastIndex = 0;
    while ((match = pathPattern.exec(text)) !== null) {
      const candidate = match[1];
      if (!files.includes(candidate)) {
        files.push(candidate);
      }
    }
  }
  return files;
}
function readFileContent(filePath, projectRoot, maxLines) {
  const absPath = path4.isAbsolute(filePath) ? filePath : path4.resolve(projectRoot, filePath);
  if (!fs3.existsSync(absPath)) return null;
  let content;
  try {
    content = fs3.readFileSync(absPath, "utf-8");
  } catch {
    return null;
  }
  const allLines = content.split(/\r?\n/);
  const totalLines = allLines.length;
  if (allLines.length > maxLines) {
    content = allLines.slice(0, maxLines).join("\n") + `

... (\u622A\u65AD\uFF0C\u5171 ${totalLines} \u884C\uFF0C\u4EC5\u663E\u793A\u524D ${maxLines} \u884C)`;
  }
  if (content.length > MAX_FILE_CONTENT_CHARS) {
    content = content.slice(0, MAX_FILE_CONTENT_CHARS) + `

... (\u622A\u65AD\uFF0C\u8D85\u8FC7 ${MAX_FILE_CONTENT_CHARS} \u5B57\u7B26\u9650\u5236)`;
  }
  const relPath = path4.relative(projectRoot, absPath).replace(/\\/g, "/");
  return { path: relPath, content, lines: totalLines };
}
function getGitHistory(targetFiles, projectRoot, maxCommits) {
  if (targetFiles.length === 0) return [];
  const gitCheck = (0, import_child_process.spawnSync)("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: projectRoot,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: 5e3
  });
  if (gitCheck.status !== 0) return [];
  const entries = [];
  const seenHashes = /* @__PURE__ */ new Set();
  for (const file of targetFiles) {
    const result = (0, import_child_process.spawnSync)("git", [
      "log",
      `--max-count=${maxCommits}`,
      "--format=%H|%an|%aI|%s",
      "--name-only",
      "--",
      file
    ], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 5e3
    });
    if (result.status !== 0 || !result.stdout) continue;
    const lines = result.stdout.trim().split(/\r?\n/);
    let current = null;
    for (const line of lines) {
      if (!line.trim()) {
        if (current && !seenHashes.has(current.hash)) {
          seenHashes.add(current.hash);
          entries.push(current);
        }
        current = null;
        continue;
      }
      if (line.includes("|")) {
        const parts = line.split("|");
        if (parts.length >= 4) {
          if (current && !seenHashes.has(current.hash)) {
            seenHashes.add(current.hash);
            entries.push(current);
          }
          current = {
            hash: parts[0].slice(0, 8),
            author: parts[1],
            date: parts[2],
            message: parts.slice(3).join("|"),
            files: []
          };
        }
      } else if (current) {
        current.files.push(line.trim());
      }
    }
    if (current && !seenHashes.has(current.hash)) {
      seenHashes.add(current.hash);
      entries.push(current);
    }
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries.slice(0, maxCommits);
}
function collectContext(task, projectRoot, options) {
  const start = Date.now();
  const maxFileLines = options?.maxFileLines ?? MAX_FILE_CONTENT_LINES;
  const maxGitCommits = options?.maxGitCommits ?? MAX_GIT_COMMITS;
  const maxRefsPerFile = options?.maxRefsPerFile ?? MAX_REFERENCES_PER_FILE;
  const includeFileContent = options?.includeFileContent !== false;
  const includeReferences = options?.includeReferences !== false;
  const includeTests = options?.includeTests !== false;
  const includeGitHistory = options?.includeGitHistory !== false;
  const targetFiles = extractTargetFiles(task);
  const fileContents = [];
  if (includeFileContent) {
    for (const file of targetFiles) {
      if (Date.now() - start > COLLECT_TIMEOUT_MS) break;
      const result = readFileContent(file, projectRoot, maxFileLines);
      if (result) fileContents.push(result);
    }
  }
  const references = [];
  if (includeReferences) {
    for (const file of targetFiles) {
      if (Date.now() - start > COLLECT_TIMEOUT_MS) break;
      const result = findReferences(file, projectRoot, { maxResults: maxRefsPerFile });
      if (result.references.length > 0) {
        references.push(result);
      }
    }
  }
  const relatedTests = [];
  if (includeTests) {
    const seen = /* @__PURE__ */ new Set();
    for (const file of targetFiles) {
      if (Date.now() - start > COLLECT_TIMEOUT_MS) break;
      const absPath = path4.isAbsolute(file) ? file : path4.resolve(projectRoot, file);
      if (!fs3.existsSync(absPath)) continue;
      const tests = findRelatedTests(absPath, projectRoot);
      for (const t of tests) {
        if (!seen.has(t.testPath)) {
          seen.add(t.testPath);
          relatedTests.push(t);
        }
      }
    }
  }
  const gitHistory = includeGitHistory ? getGitHistory(targetFiles, projectRoot, maxGitCommits) : [];
  return {
    targetFiles: fileContents,
    references,
    relatedTests,
    gitHistory,
    collectedAt: (/* @__PURE__ */ new Date()).toISOString(),
    durationMs: Date.now() - start
  };
}
function formatContextAsMarkdown(ctx) {
  const sections = [];
  if (ctx.targetFiles.length > 0) {
    sections.push("## Context: \u76EE\u6807\u6587\u4EF6\u5185\u5BB9");
    for (const file of ctx.targetFiles) {
      const ext = path4.extname(file.path).slice(1) || "text";
      sections.push(`### ${file.path} (${file.lines} \u884C)`);
      sections.push("```" + ext);
      sections.push(file.content);
      sections.push("```");
      sections.push("");
    }
  }
  if (ctx.references.length > 0) {
    sections.push("## Context: \u5F15\u7528\u8FFD\u8E2A");
    for (const ref of ctx.references) {
      sections.push(`### ${ref.target} \u7684\u5F15\u7528 (${ref.references.length} \u5904)`);
      for (const r of ref.references) {
        const relPath = r.filePath.replace(/\\/g, "/");
        sections.push(`- \`${relPath}:${r.line}\` [${r.kind}] ${r.matchText}`);
      }
      sections.push("");
    }
  }
  if (ctx.relatedTests.length > 0) {
    sections.push("## Context: \u5173\u8054\u6D4B\u8BD5\u6587\u4EF6");
    for (const t of ctx.relatedTests) {
      sections.push(`- \`${t.testPath}\` [${t.confidence}] \u2190 ${t.sourcePath}`);
    }
    sections.push("");
  }
  if (ctx.gitHistory.length > 0) {
    sections.push("## Context: Git \u6700\u8FD1\u53D8\u66F4");
    for (const entry of ctx.gitHistory) {
      const filesStr = entry.files.length > 0 ? ` (${entry.files.join(", ")})` : "";
      sections.push(`- \`${entry.hash}\` ${entry.date.slice(0, 10)} ${entry.author}: ${entry.message}${filesStr}`);
    }
    sections.push("");
  }
  if (sections.length === 0) {
    return "";
  }
  return sections.join("\n");
}
function showHelp3() {
  console.log(`
Context Collector - \u4E0A\u4E0B\u6587\u81EA\u52A8\u6536\u96C6\u5668

\u7528\u6CD5:
  node .codebuddy/scripts/context-collector.js --files <file1,file2> [options]

\u9009\u9879:
  --files <paths>       \u9017\u53F7\u5206\u9694\u7684\u76EE\u6807\u6587\u4EF6\u5217\u8868
  --symbol <name>       \u989D\u5916\u641C\u7D22\u6307\u5B9A\u7B26\u53F7
  --max-lines <n>       \u6587\u4EF6\u5185\u5BB9\u6700\u5927\u884C\u6570\uFF08\u9ED8\u8BA4: 300\uFF09
  --max-commits <n>     Git \u5386\u53F2\u6700\u5927\u6761\u6570\uFF08\u9ED8\u8BA4: 10\uFF09
  --no-content          \u4E0D\u8BFB\u53D6\u6587\u4EF6\u5185\u5BB9
  --no-refs             \u4E0D\u8FFD\u8E2A\u5F15\u7528
  --no-tests            \u4E0D\u67E5\u627E\u6D4B\u8BD5\u6587\u4EF6
  --no-git              \u4E0D\u83B7\u53D6 Git \u5386\u53F2
  --json                \u4EE5 JSON \u683C\u5F0F\u8F93\u51FA
  --markdown            \u4EE5 Markdown \u683C\u5F0F\u8F93\u51FA\uFF08\u9ED8\u8BA4\uFF09
  -h, --help            \u663E\u793A\u5E2E\u52A9
`);
}
function main3() {
  const args = process.argv.slice(2);
  let files = [];
  let maxLines = MAX_FILE_CONTENT_LINES;
  let maxCommits = MAX_GIT_COMMITS;
  let noContent = false;
  let noRefs = false;
  let noTests = false;
  let noGit = false;
  let jsonOutput = false;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }
    if (arg === "--files" && args[i + 1]) {
      files = args[++i].split(",").map((f) => f.trim()).filter(Boolean);
      continue;
    }
    if (arg === "--max-lines" && args[i + 1]) {
      maxLines = parseInt(args[++i], 10) || MAX_FILE_CONTENT_LINES;
      continue;
    }
    if (arg === "--max-commits" && args[i + 1]) {
      maxCommits = parseInt(args[++i], 10) || MAX_GIT_COMMITS;
      continue;
    }
    if (arg === "--no-content") {
      noContent = true;
      continue;
    }
    if (arg === "--no-refs") {
      noRefs = true;
      continue;
    }
    if (arg === "--no-tests") {
      noTests = true;
      continue;
    }
    if (arg === "--no-git") {
      noGit = true;
      continue;
    }
    if (arg === "--json") {
      jsonOutput = true;
      continue;
    }
  }
  if (help || files.length === 0) {
    showHelp3();
    process.exit(files.length > 0 ? 0 : 1);
  }
  const pseudoTask = {
    id: "cli",
    title: "CLI context collection",
    type: "implement",
    status: "pending",
    priority: "medium",
    dependencies: [],
    acceptanceCriteria: [],
    scope: { files }
  };
  const ctx = collectContext(pseudoTask, process.cwd(), {
    maxFileLines: maxLines,
    maxGitCommits: maxCommits,
    includeFileContent: !noContent,
    includeReferences: !noRefs,
    includeTests: !noTests,
    includeGitHistory: !noGit
  });
  if (jsonOutput) {
    console.log(JSON.stringify(ctx, null, 2));
  } else {
    const md = formatContextAsMarkdown(ctx);
    if (md) {
      console.log(md);
    } else {
      console.log("\u672A\u6536\u96C6\u5230\u4EFB\u4F55\u4E0A\u4E0B\u6587\u4FE1\u606F\u3002");
    }
    console.log(`
\u6536\u96C6\u8017\u65F6: ${ctx.durationMs}ms`);
  }
}
if (isDirectCliEntry("context-collector.js")) {
  main3();
}

// scripts/src/agent-runtime.ts
var fs4 = __toESM(require("fs"));
var path5 = __toESM(require("path"));

// scripts/src/lib/frontmatter-utils.ts
function normalizeNewlines(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}
function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if (first === '"' && last === '"' || first === "'" && last === "'") {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}
function countLeadingSpaces(line) {
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
}
function indentPrefix(indent) {
  return " ".repeat(Math.max(0, indent));
}
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function parseFrontmatterBlock(md) {
  const normalized = normalizeNewlines(md);
  if (!normalized.startsWith("---")) {
    return { ok: false, error: "missing YAML frontmatter (must start with ---)" };
  }
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { ok: false, error: "YAML frontmatter is not closed (missing ending ---)" };
  }
  return { ok: true, frontmatter: match[1], endIndex: match[0].length };
}
function splitFrontmatterDocument(md) {
  const normalized = normalizeNewlines(md);
  const parsed = parseFrontmatterBlock(normalized);
  if (!parsed.ok) {
    return parsed;
  }
  return {
    ok: true,
    frontmatter: parsed.frontmatter,
    body: normalized.slice(parsed.endIndex),
    endIndex: parsed.endIndex
  };
}
function extractYamlScalar(frontmatter, key) {
  const normalized = normalizeNewlines(frontmatter);
  const pattern = new RegExp(`^${escapeRegex(key)}:\\s*(.+)$`, "m");
  const match = normalized.match(pattern);
  if (!match) return void 0;
  return stripWrappingQuotes(match[1]);
}
function listYamlKeys(yaml, indent = 0) {
  const normalized = normalizeNewlines(yaml);
  const prefix = indentPrefix(indent);
  const keys = [];
  for (const line of normalized.split("\n")) {
    const match = line.match(new RegExp(`^${escapeRegex(prefix)}([A-Za-z0-9_-]+):(?:\\s+.*)?$`));
    if (match) keys.push(match[1]);
  }
  return keys;
}
function extractYamlSection(frontmatter, key, indent = 0) {
  const normalized = normalizeNewlines(frontmatter);
  const lines = normalized.split("\n");
  const prefix = indentPrefix(indent);
  const startPattern = new RegExp(`^${escapeRegex(prefix)}${escapeRegex(key)}:\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    if (!startPattern.test(lines[i])) continue;
    const collected = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) {
        collected.push(line);
        continue;
      }
      if (countLeadingSpaces(line) <= indent) break;
      collected.push(line);
    }
    return collected.join("\n");
  }
  return null;
}
function parseYamlList(frontmatter, key, indent = 0) {
  const normalized = normalizeNewlines(frontmatter);
  const lines = normalized.split("\n");
  const prefix = indentPrefix(indent);
  const itemPrefix = indentPrefix(indent + 2);
  const startPattern = new RegExp(`^${escapeRegex(prefix)}${escapeRegex(key)}:\\s*$`);
  const itemPattern = new RegExp(`^${escapeRegex(itemPrefix)}-\\s*(.+?)\\s*$`);
  const values = [];
  for (let i = 0; i < lines.length; i++) {
    if (!startPattern.test(lines[i])) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) continue;
      const currentIndent = countLeadingSpaces(line);
      if (currentIndent <= indent) break;
      const itemMatch = line.match(itemPattern);
      if (itemMatch) values.push(stripWrappingQuotes(itemMatch[1]));
    }
    break;
  }
  return values;
}

// scripts/src/agent-runtime.ts
var _verbose = false;
function rtLog(message) {
  console.log(`[AgentRuntime] ${message}`);
}
function rtDebug(message) {
  if (_verbose) console.log(`[AgentRuntime:DEBUG] ${message}`);
}
function rtWarn(message) {
  console.warn(`[AgentRuntime:WARN] ${message}`);
}
function normalizeAgentDocument(content) {
  return content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}
function extractFirstYamlCodeBlock(content) {
  const normalized = normalizeAgentDocument(content);
  const match = normalized.match(/```ya?ml\s*\n([\s\S]*?)\n```\n?/);
  if (!match) return null;
  const start = match.index ?? 0;
  const body = `${normalized.slice(0, start)}${normalized.slice(start + match[0].length)}`.trimStart();
  return { yaml: match[1], body };
}
function parseOptionalVersion(yaml) {
  const version = extractYamlScalar(yaml, "version");
  if (!version || version === "null") return void 0;
  return version;
}
function parseAgentFrontmatter(yaml) {
  const name = extractYamlScalar(yaml, "name");
  const description = extractYamlScalar(yaml, "description");
  if (!name || !description) return null;
  const triggersBlock = extractYamlSection(yaml, "triggers");
  const explicitTriggers = triggersBlock ? parseYamlList(triggersBlock, "explicit", 2) : [];
  const plainTriggers = parseYamlList(yaml, "triggers");
  const triggers = explicitTriggers.length > 0 ? explicitTriggers : plainTriggers;
  const permissionsBlock = extractYamlSection(yaml, "permissions");
  const tools = permissionsBlock ? parseYamlList(permissionsBlock, "tools", 2) : [];
  const skills = permissionsBlock ? parseYamlList(permissionsBlock, "skills", 2) : [];
  const flatPermissions = parseYamlList(yaml, "permissions");
  let permissions;
  if (tools.length > 0 || skills.length > 0) {
    permissions = {
      tools: tools.length > 0 ? tools : void 0,
      skills: skills.length > 0 ? skills : void 0
    };
  } else if (flatPermissions.length > 0) {
    permissions = flatPermissions;
  }
  const dependenciesBlock = extractYamlSection(yaml, "dependencies");
  let dependencies;
  if (dependenciesBlock) {
    const parsedDependencies = {};
    for (const key of listYamlKeys(dependenciesBlock, 2)) {
      const values = parseYamlList(dependenciesBlock, key, 2);
      if (values.length > 0) {
        parsedDependencies[key] = values;
      }
    }
    if (Object.keys(parsedDependencies).length > 0) {
      dependencies = parsedDependencies;
    }
  }
  return {
    name,
    description,
    version: parseOptionalVersion(yaml),
    triggers: triggers.length > 0 ? triggers : void 0,
    permissions,
    dependencies,
    model: extractYamlScalar(yaml, "model")
  };
}
var AgentRuntime = class {
  constructor(config) {
    this.registry = /* @__PURE__ */ new Map();
    this.loaded = false;
    this.config = {
      ...config,
      agentsDir: config.agentsDir || "agents",
      verbose: config.verbose || false
    };
    _verbose = this.config.verbose;
  }
  // ============ 加载 ============
  /**
   * 扫描并加载所有 Agent 定义
   */
  loadAll() {
    if (this.loaded) return;
    const searchDirs = [
      path5.join(this.config.projectRoot, this.config.agentsDir || "agents")
    ];
    if (this.config.fallbackAgentsDir) {
      searchDirs.push(path5.join(this.config.projectRoot, this.config.fallbackAgentsDir));
    }
    for (const dir of searchDirs) {
      if (!fs4.existsSync(dir)) {
        rtDebug(`Agent \u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u8DF3\u8FC7: ${dir}`);
        continue;
      }
      const entries = fs4.readdirSync(dir).filter((name) => {
        const fullPath = path5.join(dir, name);
        return fs4.existsSync(fullPath) && fs4.statSync(fullPath).isDirectory();
      });
      for (const agentId of entries) {
        if (this.registry.has(agentId)) {
          rtDebug(`Agent '${agentId}' \u5DF2\u6CE8\u518C\uFF0C\u8DF3\u8FC7\u91CD\u590D`);
          continue;
        }
        const agent = this.loadAgent(agentId, dir);
        if (agent) {
          this.registry.set(agentId, agent);
          rtDebug(`\u5DF2\u52A0\u8F7D Agent: ${agentId} (${agent.metadata.description})`);
        }
      }
    }
    this.loaded = true;
    rtLog(`\u5DF2\u52A0\u8F7D ${this.registry.size} \u4E2A Agent`);
  }
  /**
   * 加载单个 Agent 定义
   */
  loadAgent(agentId, baseDir) {
    const dirs = baseDir ? [baseDir] : [
      path5.join(this.config.projectRoot, this.config.agentsDir || "agents"),
      ...this.config.fallbackAgentsDir ? [path5.join(this.config.projectRoot, this.config.fallbackAgentsDir)] : []
    ];
    for (const dir of dirs) {
      const agentDir = path5.join(dir, agentId);
      const agentMdPath = path5.join(agentDir, "AGENT.md");
      if (!fs4.existsSync(agentMdPath)) continue;
      try {
        const content = fs4.readFileSync(agentMdPath, "utf-8");
        const parsedDocument = splitFrontmatterDocument(content);
        let metadata;
        let body;
        if (parsedDocument.ok) {
          metadata = parseAgentFrontmatter(parsedDocument.frontmatter);
          body = parsedDocument.body;
          if (!metadata) {
            rtWarn(`Agent '${agentId}': frontmatter \u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5 name/description`);
            continue;
          }
        } else {
          const normalized = normalizeAgentDocument(content);
          if (normalized.startsWith("---")) {
            rtWarn(`Agent '${agentId}': ${parsedDocument.error}`);
            continue;
          }
          const legacyDocument = extractFirstYamlCodeBlock(content);
          if (!legacyDocument) {
            rtWarn(`Agent '${agentId}': AGENT.md \u7F3A\u5C11 frontmatter \u6216 legacy YAML metadata`);
            continue;
          }
          metadata = parseAgentFrontmatter(legacyDocument.yaml);
          body = legacyDocument.body;
          if (!metadata) {
            rtWarn(`Agent '${agentId}': legacy YAML metadata \u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5 name/description`);
            continue;
          }
          rtDebug(`Agent '${agentId}' \u4F7F\u7528 legacy YAML metadata \u56DE\u9000\u8DEF\u5F84`);
        }
        const prompts = {};
        const promptsDir = path5.join(agentDir, "prompts");
        if (fs4.existsSync(promptsDir) && fs4.statSync(promptsDir).isDirectory()) {
          const promptFiles = fs4.readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
          for (const file of promptFiles) {
            const name = path5.basename(file, ".md");
            prompts[name] = fs4.readFileSync(path5.join(promptsDir, file), "utf-8");
          }
        }
        const skills = this.loadDeclaredSkills(metadata);
        const rules = this.loadDeclaredRules(metadata);
        return {
          id: agentId,
          definitionPath: agentMdPath,
          metadata,
          body,
          prompts,
          skills,
          rules
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        rtWarn(`Agent '${agentId}' \u52A0\u8F7D\u5931\u8D25: ${msg}`);
      }
    }
    return null;
  }
  /**
   * 获取已注册的 Agent
   */
  getAgent(agentId) {
    this.ensureLoaded();
    return this.registry.get(agentId) || null;
  }
  /**
   * 列出所有已注册 Agent 的元信息
   */
  listAgents() {
    this.ensureLoaded();
    const result = [];
    for (const [id, agent] of this.registry) {
      const triggers = [];
      if (agent.metadata.triggers) {
        triggers.push(...agent.metadata.triggers);
      }
      const permissions = [];
      let relatedSkills;
      if (agent.metadata.permissions) {
        if (Array.isArray(agent.metadata.permissions)) {
          permissions.push(...agent.metadata.permissions);
        } else {
          if (agent.metadata.permissions.tools) permissions.push(...agent.metadata.permissions.tools);
          if (agent.metadata.permissions.skills?.length) {
            relatedSkills = [...agent.metadata.permissions.skills];
          }
        }
      }
      const relatedRules = agent.metadata.dependencies ? Object.values(agent.metadata.dependencies).flat() : void 0;
      result.push({
        id,
        name: agent.metadata.name,
        description: agent.metadata.description,
        triggers,
        permissions,
        relatedSkills,
        relatedRules: relatedRules && relatedRules.length > 0 ? relatedRules : void 0
      });
    }
    return result;
  }
  // ============ Prompt 渲染 ============
  /**
   * 渲染 Agent prompt
   *
   * 将 Agent 定义 + prompts 模板 + 上下文合并为完整的可用 prompt
   */
  renderPrompt(agentId, context, promptKey) {
    this.ensureLoaded();
    const agent = this.registry.get(agentId);
    if (!agent) {
      throw new Error(`Agent '${agentId}' \u672A\u6CE8\u518C`);
    }
    let template;
    if (promptKey && agent.prompts[promptKey]) {
      template = agent.prompts[promptKey];
    } else if (Object.keys(agent.prompts).length > 0) {
      const taskType = context.task.type;
      const promptMapping = {
        "test": "red",
        "implement": "green",
        "refactor": "refactor",
        "review": "review",
        "build-fix": "diagnose-fix"
      };
      const autoKey = promptMapping[taskType];
      if (autoKey && agent.prompts[autoKey]) {
        template = agent.prompts[autoKey];
      } else {
        const firstKey = Object.keys(agent.prompts)[0];
        template = agent.prompts[firstKey];
      }
    } else {
      template = agent.body;
    }
    const vars = this.buildTemplateVariables(agent, context);
    let rendered = template;
    for (const [varName, varValue] of Object.entries(vars)) {
      const simplePattern = new RegExp(`\\{\\{\\s*${escapeRegex2(varName)}\\s*\\}\\}`, "g");
      rendered = rendered.replace(simplePattern, String(varValue));
    }
    rendered = rendered.replace(
      /\{\{#each\s+task\.acceptanceCriteria\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (_match, body) => {
        return context.task.acceptanceCriteria.map((criterion) => body.replace(/\{\{\s*this\s*\}\}/g, criterion)).join("");
      }
    );
    const header = [
      `## Agent: ${agent.metadata.name}`,
      "",
      `> ${agent.metadata.description}`,
      `> TaskBook: ${context.taskBookId}`,
      `> Task: ${context.task.title} (${context.task.type})`,
      ""
    ].join("\n");
    let skillSection = "";
    if (Object.keys(agent.skills).length > 0) {
      const skillParts = Object.entries(agent.skills).map(
        ([name, content]) => `### Skill: ${name}

${content.slice(0, 3e3)}`
      );
      skillSection = [
        "## \u53C2\u8003\u77E5\u8BC6: Skills (\u6280\u80FD\u5E93)",
        "",
        "> \u4EE5\u4E0B\u662F\u4E0E\u5F53\u524D\u4EFB\u52A1\u76F8\u5173\u7684 Skill \u77E5\u8BC6\uFF0C\u8BF7\u6309\u7167\u5176\u4E2D\u7684\u6700\u4F73\u5B9E\u8DF5\u548C\u6A21\u677F\u6267\u884C\u4EFB\u52A1\u3002",
        "",
        ...skillParts,
        ""
      ].join("\n");
    }
    let ruleSection = "";
    if (Object.keys(agent.rules).length > 0) {
      const ruleParts = Object.entries(agent.rules).map(
        ([name, content]) => `### Rule: ${name}

${content.slice(0, 2e3)}`
      );
      ruleSection = [
        "## \u53C2\u8003\u77E5\u8BC6: Rules (\u89C4\u8303\u5E93)",
        "",
        "> \u4EE5\u4E0B\u662F\u4E0E\u5F53\u524D\u4EFB\u52A1\u76F8\u5173\u7684\u7F16\u7801\u89C4\u8303\uFF0C\u8BF7\u4E25\u683C\u9075\u5B88\u3002",
        "",
        ...ruleParts,
        ""
      ].join("\n");
    }
    return header + skillSection + ruleSection + rendered;
  }
  /** 构建模板变量表 */
  buildTemplateVariables(agent, context) {
    const task = context.task;
    const vars = {
      "task.title": task.title,
      "task.type": task.type,
      "task.description": task.description || "",
      "task.id": task.id,
      "task.priority": task.priority || "medium",
      "task.acceptanceCriteria": task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n"),
      "task.scope.files": task.scope?.files?.join(", ") || "(\u672A\u6307\u5B9A)",
      "task.scope.modules": task.scope?.modules?.join(", ") || "(\u672A\u6307\u5B9A)",
      "taskBook.id": context.taskBookId,
      "agent.name": agent.metadata.name,
      "agent.id": agent.id,
      "project.root": context.projectRoot,
      "project.testFramework": "(auto-detect)"
    };
    if (context.relatedFiles && context.relatedFiles.length > 0) {
      vars["context.files"] = context.relatedFiles.map((f) => `### ${f.path}
\`\`\`
${f.content}
\`\`\``).join("\n\n");
    } else {
      vars["context.files"] = "(\u65E0\u9884\u52A0\u8F7D\u6587\u4EF6)";
    }
    return vars;
  }
  // ============ 调用 ============
  /**
   * 调用指定 Agent 并返回结果
   *
   * 当前实现为「渲染 prompt + 生成结构化 AgentResult」。
   * 在进程内模式下，prompt 由调用方（如 AI 工具）消费后自行执行。
   * 当 Agent 定义不可用或需要人工介入时，返回 needs_human 状态。
   */
  invoke(invocation) {
    const startTime = Date.now();
    const { agentId, context } = invocation;
    this.ensureLoaded();
    const agent = this.registry.get(agentId);
    if (!agent) {
      return {
        status: "needs_human",
        actualWork: "",
        executedBy: agentId,
        duration: Date.now() - startTime,
        humanReason: `Agent '${agentId}' \u672A\u6CE8\u518C\uFF0C\u9700\u8981\u4EBA\u5DE5\u6267\u884C`
      };
    }
    try {
      const prompt = this.renderPrompt(agentId, context);
      rtDebug(`\u4E3A Agent '${agentId}' \u6E32\u67D3\u4E86 ${prompt.length} \u5B57\u7B26\u7684 prompt`);
      return {
        status: "done",
        actualWork: `[AgentRuntime] \u5DF2\u4E3A ${agent.metadata.name} \u751F\u6210\u6267\u884C prompt\uFF08${prompt.length} \u5B57\u7B26\uFF09`,
        executedBy: agentId,
        duration: Date.now() - startTime,
        renderedPrompt: prompt
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        status: "error",
        actualWork: "",
        executedBy: agentId,
        duration: Date.now() - startTime,
        error: `Agent '${agentId}' \u8C03\u7528\u5931\u8D25: ${msg}`
      };
    }
  }
  /**
   * 并行调用多个 Agent
   */
  invokeParallel(invocations) {
    return invocations.map((inv) => this.invoke(inv));
  }
  // ============ 辅助 ============
  ensureLoaded() {
    if (!this.loaded) {
      this.loadAll();
    }
  }
  // ============ Skill / Rule 加载 ============
  /**
   * 加载 Agent 声明的 Skills 内容
   *
   * 从 permissions.skills 中解析 skill 名称，
   * 依次在 .codebuddy/custom-skills/ 和 custom-skills/ 中查找 SKILL.md
   */
  loadDeclaredSkills(metadata) {
    const skills = {};
    const perms = metadata.permissions;
    if (!perms || Array.isArray(perms) || !perms.skills) return skills;
    const root = this.config.projectRoot;
    for (const skillName of perms.skills) {
      const candidates = [
        path5.join(root, ".codebuddy", "custom-skills", skillName, "SKILL.md"),
        path5.join(root, "custom-skills", skillName, "SKILL.md")
      ];
      let found = false;
      for (const candidate of candidates) {
        if (fs4.existsSync(candidate)) {
          try {
            skills[skillName] = fs4.readFileSync(candidate, "utf-8");
            rtDebug(`\u5DF2\u52A0\u8F7D Skill: ${skillName} (${candidate})`);
            found = true;
            break;
          } catch {
          }
        }
      }
      if (!found) {
        rtDebug(`Skill '${skillName}' \u672A\u627E\u5230\uFF0C\u8DF3\u8FC7`);
      }
    }
    return skills;
  }
  /**
   * 加载 Agent 声明的 Rules 内容
   *
   * 从 dependencies 中解析 layer/rule-name，
   * 在 rules/<layer>/<rule-name>/ 目录或 rules/<layer>/<rule-name>.md 中查找
   */
  loadDeclaredRules(metadata) {
    const rules = {};
    if (!metadata.dependencies) return rules;
    const root = this.config.projectRoot;
    for (const [layer, ruleNames] of Object.entries(metadata.dependencies)) {
      if (!Array.isArray(ruleNames)) continue;
      for (const ruleName of ruleNames) {
        const key = `${layer}/${ruleName}`;
        const dirPath = path5.join(root, "rules", layer, ruleName);
        const filePath = path5.join(root, "rules", layer, `${ruleName}.md`);
        if (fs4.existsSync(dirPath) && fs4.statSync(dirPath).isDirectory()) {
          try {
            const mdFiles = fs4.readdirSync(dirPath).filter((f) => f.endsWith(".md")).sort();
            if (mdFiles.length > 0) {
              const combined = mdFiles.map((f) => {
                const content = fs4.readFileSync(path5.join(dirPath, f), "utf-8");
                return `<!-- ${f} -->
${content}`;
              }).join("\n\n");
              rules[key] = combined;
              rtDebug(`\u5DF2\u52A0\u8F7D Rule: ${key} (${mdFiles.length} \u4E2A\u6587\u4EF6)`);
            }
          } catch {
          }
        } else if (fs4.existsSync(filePath)) {
          try {
            rules[key] = fs4.readFileSync(filePath, "utf-8");
            rtDebug(`\u5DF2\u52A0\u8F7D Rule: ${key}`);
          } catch {
          }
        } else {
          rtDebug(`Rule '${key}' \u672A\u627E\u5230\uFF0C\u8DF3\u8FC7`);
        }
      }
    }
    return rules;
  }
};
function escapeRegex2(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function createAgentRuntime(config) {
  return new AgentRuntime(config);
}

// scripts/src/result-aggregator.ts
var fs5 = __toESM(require("fs"));
var path6 = __toESM(require("path"));
var AGENT_CALLS_DIR2 = ".codebuddy/agent-calls";
function extractAgentCallRequestIds(taskBook) {
  const seen = /* @__PURE__ */ new Set();
  const results = [];
  for (const entry of taskBook.changelog) {
    const after = entry.after;
    if (!after) continue;
    if (after["event"] !== "agent-call") continue;
    if (after["kind"] !== "manual-task") continue;
    const requestId = typeof after["requestId"] === "string" ? after["requestId"] : null;
    const taskId = typeof entry.taskId === "string" ? entry.taskId : null;
    const agentId = typeof after["agentId"] === "string" ? after["agentId"] : "unknown";
    if (!requestId || !taskId || seen.has(requestId)) continue;
    seen.add(requestId);
    results.push({ requestId, taskId, agentId });
  }
  return results;
}
function readAgentCallResult(projectRoot, requestId) {
  const resultPath = path6.join(projectRoot, AGENT_CALLS_DIR2, `${requestId}.result.json`);
  try {
    const raw = fs5.readFileSync(resultPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function findTask(taskBook, taskId) {
  return taskBook.tasks.find((t) => t.id === taskId);
}
function extractActualWork(output) {
  if (!output || typeof output !== "object") return void 0;
  const o = output;
  if (typeof o["actualWork"] === "string" && o["actualWork"].trim()) {
    return o["actualWork"];
  }
  if (typeof o["summary"] === "string" && o["summary"].trim()) {
    return o["summary"];
  }
  return void 0;
}
function buildExecutionSummary(taskBook, agentResults) {
  const done = taskBook.tasks.filter((t) => t.status === "done").length;
  const total = taskBook.tasks.length;
  const successAgents = agentResults.filter((r) => r.status === "success").length;
  const failedAgents = agentResults.filter((r) => r.status === "failed").length;
  const blockedAgents = agentResults.filter((r) => r.status === "blocked").length;
  const lines = [
    `TaskBook\u300C${taskBook.title}\u300D\u6267\u884C\u5B8C\u6210\u3002`,
    `\u5171 ${total} \u4E2A\u4EFB\u52A1\uFF0C\u5176\u4E2D ${done} \u4E2A\u5DF2\u5B8C\u6210\u3002`
  ];
  if (agentResults.length > 0) {
    lines.push(`\u5171\u8C03\u7528 ${agentResults.length} \u4E2A\u5B50 Agent\uFF1A${successAgents} \u6210\u529F\u3001${failedAgents} \u5931\u8D25\u3001${blockedAgents} \u963B\u585E\u3002`);
  }
  const blockedTasks = taskBook.tasks.filter((t) => t.status === "blocked");
  if (blockedTasks.length > 0) {
    lines.push(`\u5C1A\u6709 ${blockedTasks.length} \u4E2A\u963B\u585E\u4EFB\u52A1\u5F85\u5904\u7406\u3002`);
  }
  return lines.join(" ");
}
function buildIssueList(taskBook, agentResults) {
  const issues = [];
  const reportedTaskIds = /* @__PURE__ */ new Set();
  for (const result of agentResults) {
    if (result.status === "failed" && result.error) {
      issues.push(`[${result.agentId}] \u4EFB\u52A1\u300C${result.taskTitle}\u300D\u5931\u8D25\uFF1A${result.error}`);
      reportedTaskIds.add(result.taskId);
    }
    if (result.status === "blocked") {
      issues.push(`[${result.agentId}] \u4EFB\u52A1\u300C${result.taskTitle}\u300D\u963B\u585E\uFF0C\u7B49\u5F85\u4EBA\u5DE5\u4ECB\u5165`);
      reportedTaskIds.add(result.taskId);
    }
  }
  for (const task of taskBook.tasks) {
    if (task.status === "blocked" && task.blockedReason && !reportedTaskIds.has(task.id)) {
      issues.push(`\u4EFB\u52A1\u300C${task.title}\u300D\u963B\u585E\uFF1A${task.blockedReason.slice(0, 120)}`);
    }
  }
  return issues;
}
function buildNextSteps(taskBook, agentResults) {
  const steps = [];
  const blockedTasks = taskBook.tasks.filter((t) => t.status === "blocked");
  if (blockedTasks.length > 0) {
    steps.push(`\u5904\u7406 ${blockedTasks.length} \u4E2A\u963B\u585E\u4EFB\u52A1\uFF1A${blockedTasks.map((t) => t.title).join("\u3001")}`);
  }
  const failedAgents = agentResults.filter((r) => r.status === "failed");
  if (failedAgents.length > 0) {
    steps.push(`\u91CD\u65B0\u6267\u884C\u5931\u8D25\u7684 Agent \u4EFB\u52A1\uFF1A${failedAgents.map((r) => r.taskTitle).join("\u3001")}`);
  }
  const pendingReviews = taskBook.tasks.filter((t) => t.type === "review" && t.status === "pending");
  if (pendingReviews.length > 0) {
    steps.push("\u5B8C\u6210\u5F85\u5BA1\u67E5\u4EFB\u52A1\u540E\u8FDB\u884C\u4EBA\u5DE5\u9A8C\u6536");
  }
  if (steps.length === 0) {
    steps.push("\u6240\u6709\u4EFB\u52A1\u5DF2\u5B8C\u6210\uFF0C\u53EF\u8FDB\u884C\u6700\u7EC8\u4EBA\u5DE5\u9A8C\u6536");
    steps.push("\u5EFA\u8BAE\u8FD0\u884C\u5B8C\u6574\u6D4B\u8BD5\u5957\u4EF6\u786E\u8BA4\u529F\u80FD\u6B63\u5E38");
  }
  return steps;
}
function aggregateResults(taskBook, projectRoot = process.cwd()) {
  const callRefs = extractAgentCallRequestIds(taskBook);
  const agentResults = [];
  for (const ref of callRefs) {
    const task = findTask(taskBook, ref.taskId);
    const rawResult = readAgentCallResult(projectRoot, ref.requestId);
    const summary = {
      requestId: ref.requestId,
      agentId: ref.agentId,
      taskId: ref.taskId,
      taskTitle: task?.title ?? ref.taskId,
      taskType: task?.type ?? "implement",
      status: rawResult?.status ?? "blocked",
      completedAt: rawResult?.completedAt,
      artifacts: rawResult?.artifacts
    };
    if (rawResult?.output) {
      summary.actualWork = extractActualWork(rawResult.output);
    }
    if (rawResult?.status !== "success" && rawResult?.error) {
      summary.error = rawResult.error.message ?? String(rawResult.error);
    }
    agentResults.push(summary);
  }
  const successCount = agentResults.filter((r) => r.status === "success").length;
  const failedCount = agentResults.filter((r) => r.status === "failed").length;
  const blockedCount = agentResults.filter((r) => r.status === "blocked").length;
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    taskBookId: taskBook.id,
    executionSummary: buildExecutionSummary(taskBook, agentResults),
    agentResults,
    issueList: buildIssueList(taskBook, agentResults),
    nextSteps: buildNextSteps(taskBook, agentResults),
    stats: {
      totalAgentCalls: agentResults.length,
      successCount,
      failedCount,
      blockedCount
    }
  };
}
function aggregateAndPersist(manager, taskBookId, projectRoot = process.cwd()) {
  const taskBook = manager.load(taskBookId);
  if (!taskBook) {
    console.error(`[ResultAggregator] TaskBook not found: ${taskBookId}`);
    return null;
  }
  const report = aggregateResults(taskBook, projectRoot);
  try {
    manager.saveFinalReport(taskBookId, report);
    console.log(
      `[ResultAggregator] \u6C47\u603B\u5B8C\u6210\uFF1A${report.stats.totalAgentCalls} \u4E2A Agent \u8C03\u7528\uFF0C${report.stats.successCount} \u6210\u529F / ${report.stats.failedCount} \u5931\u8D25 / ${report.stats.blockedCount} \u963B\u585E`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ResultAggregator] \u6301\u4E45\u5316\u5931\u8D25\uFF0C\u62A5\u544A\u4EC5\u5728\u5185\u5B58\u4E2D\uFF1A${msg}`);
  }
  return report;
}

// scripts/src/lib/worker-executor.ts
var import_child_process2 = require("child_process");
var WORKER_COMMAND_ENV = "CODEBUDDY_WORKER_COMMAND";
var WORKER_TIMEOUT_ENV = "CODEBUDDY_WORKER_TIMEOUT_MS";
var DEFAULT_WORKER_TIMEOUT_MS = 10 * 60 * 1e3;
function createConfiguredWorkerExecutor(env = process.env) {
  const command = String(env[WORKER_COMMAND_ENV] ?? "").trim();
  if (!command) return null;
  const parsedTimeout = Number.parseInt(String(env[WORKER_TIMEOUT_ENV] ?? DEFAULT_WORKER_TIMEOUT_MS), 10);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_WORKER_TIMEOUT_MS;
  return new CommandWorkerExecutor(command, timeoutMs);
}
var CommandWorkerExecutor = class {
  constructor(command, timeoutMs) {
    this.command = command;
    this.timeoutMs = timeoutMs;
  }
  describe() {
    return `command:${this.command}`;
  }
  execute(payload) {
    const rawInput = JSON.stringify(payload, null, 2);
    const res = (0, import_child_process2.spawnSync)(this.command, [], {
      cwd: payload.projectRoot,
      shell: true,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      input: rawInput,
      timeout: this.timeoutMs
    });
    if (res.error) {
      const message = res.error.message || String(res.error);
      const status = /timeout/i.test(message) ? "blocked" : "unavailable";
      return { status, error: `worker spawn failed: ${message}` };
    }
    if (res.status !== 0) {
      const stderr = String(res.stderr ?? "").trim();
      const stdout2 = String(res.stdout ?? "").trim();
      const detail = truncateMessage(stderr || stdout2 || `exit=${String(res.status ?? "null")}`);
      return {
        status: "blocked",
        error: `worker exited with code ${String(res.status ?? "null")}: ${detail}`
      };
    }
    const stdout = String(res.stdout ?? "").trim();
    if (!stdout) {
      return { status: "failed", error: "worker returned empty stdout" };
    }
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "failed",
        error: `worker stdout is not valid JSON: ${message}`
      };
    }
    return normalizeWorkerResult(parsed, payload.requestId);
  }
};
function normalizeWorkerResult(parsed, expectedRequestId) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { status: "failed", error: "worker result must be a JSON object" };
  }
  const data = parsed;
  const rawRequestId = data.requestId;
  if (typeof rawRequestId === "string" && rawRequestId.trim() && rawRequestId !== expectedRequestId) {
    return {
      status: "failed",
      error: `worker result requestId mismatch: expected=${expectedRequestId} actual=${rawRequestId}`
    };
  }
  const normalizedStatus = normalizeStatus(data.status);
  if (!normalizedStatus) {
    return { status: "failed", error: "worker result.status must be success | blocked | failed" };
  }
  if (normalizedStatus === "success") {
    const actualWork = extractActualWork2(data);
    if (!actualWork) {
      return { status: "failed", error: "worker success result must include output.actualWork or actualWork" };
    }
    return {
      status: "success",
      actualWork,
      artifacts: parseArtifacts(data.artifacts),
      completedAt: typeof data.completedAt === "string" ? data.completedAt : void 0
    };
  }
  return {
    status: normalizedStatus,
    error: extractErrorMessage(data) || `worker reported status=${normalizedStatus}`,
    artifacts: parseArtifacts(data.artifacts),
    completedAt: typeof data.completedAt === "string" ? data.completedAt : void 0
  };
}
function normalizeStatus(status) {
  if (status === "success" || status === "blocked" || status === "failed") return status;
  if (status === "error") return "failed";
  return null;
}
function extractActualWork2(data) {
  if (typeof data.actualWork === "string" && data.actualWork.trim()) {
    return data.actualWork.trim();
  }
  const output = data.output;
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const actualWork = output.actualWork;
  if (typeof actualWork !== "string" || !actualWork.trim()) return null;
  return actualWork.trim();
}
function extractErrorMessage(data) {
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  const error = data.error;
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;
  const message = error.message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}
function parseArtifacts(raw) {
  if (!Array.isArray(raw)) return void 0;
  const parsed = raw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const record = item;
    const type = typeof record.type === "string" ? record.type.trim() : "";
    const filePath = typeof record.path === "string" ? record.path.trim() : "";
    if (!type || !filePath) return null;
    return { type, path: filePath };
  }).filter((item) => Boolean(item));
  return parsed.length > 0 ? parsed : void 0;
}
function truncateMessage(message, maxLength = 500) {
  const trimmed = message.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}

// scripts/src/lib/execution-metrics.ts
var fs6 = __toESM(require("fs"));
var path7 = __toESM(require("path"));
var METRICS_SCHEMA_VERSION = "1.0.0";
var METRICS_DIR = path7.join(process.cwd(), ".codebuddy", "reports", "metrics");
var EVENTS_FILE = path7.join(METRICS_DIR, "execution-events.jsonl");
var SUMMARY_FILE = path7.join(METRICS_DIR, "latest-summary.json");
function recordExecutionMetric(input) {
  ensureMetricsDir();
  const event = {
    ...input,
    schemaVersion: METRICS_SCHEMA_VERSION,
    recordedAt: input.recordedAt || (/* @__PURE__ */ new Date()).toISOString()
  };
  fs6.appendFileSync(EVENTS_FILE, `${JSON.stringify(event)}
`, "utf-8");
  const summary = loadExecutionMetricsSummary();
  applyEvent(summary, event);
  summary.generatedAt = event.recordedAt;
  summary.lastEventAt = event.recordedAt;
  fs6.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2), "utf-8");
  return event;
}
function loadExecutionMetricsSummary(projectRoot = process.cwd()) {
  const summaryPath = path7.join(projectRoot, ".codebuddy", "reports", "metrics", "latest-summary.json");
  if (!fs6.existsSync(summaryPath)) {
    return createEmptySummary(projectRoot);
  }
  try {
    const parsed = JSON.parse(fs6.readFileSync(summaryPath, "utf-8"));
    return normalizeSummary(parsed, projectRoot);
  } catch {
    return createEmptySummary(projectRoot);
  }
}
function classifyBlockedReason(reason) {
  const text = String(reason || "").trim().toLowerCase();
  if (!text) return "unknown";
  if (text.includes("workerexecutor(") || text.includes("worker spawn failed") || text.includes("worker exited")) {
    return "worker_execution";
  }
  if (text.includes("agentruntime")) return "agent_runtime";
  if (text.includes("manual_required")) return "manual_required";
  if (text.includes("acceptance") || text.includes("\u4EBA\u5DE5\u9A8C\u6536")) return "manual_acceptance";
  if (text.includes("module-mapper.js") || text.includes("structure-analyzer.js")) return "missing_analysis_script";
  return "other";
}
function inferPlannedExecutionMode(taskType, hasWorkerExecutor) {
  if (taskType === "analysis") return "script";
  if (taskType === "acceptance") return "manual";
  return hasWorkerExecutor ? "worker" : "agent-runtime";
}
function inferBlockedExecutionMode(taskType, errorMessage, hasWorkerExecutor) {
  const text = errorMessage.toLowerCase();
  if (text.includes("workerexecutor(") || text.includes("worker spawn failed") || text.includes("worker exited")) {
    return "worker";
  }
  if (text.includes("agentruntime")) return "agent-runtime";
  if (text.includes("[agent-call]") || text.includes("agent-call")) return "agent-call";
  if (taskType === "analysis") return "script";
  if (taskType === "acceptance") return "manual";
  return hasWorkerExecutor ? "worker" : "unknown";
}
function inferCompletedExecutionMode(taskType, executedBy) {
  if (executedBy?.startsWith("worker-executor:")) return "worker";
  if (taskType === "analysis") return "script";
  if (taskType === "acceptance") return "manual";
  return "unknown";
}
function computeDurationMs(startedAt, completedAt) {
  if (!startedAt || !completedAt) return void 0;
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return void 0;
  return end - start;
}
function ensureMetricsDir() {
  fs6.mkdirSync(METRICS_DIR, { recursive: true });
}
function createEmptySummary(projectRoot) {
  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
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
      totalDurationMs: 0,
      averageDurationMs: 0
    },
    byTaskType: {},
    byExecutionMode: {},
    blockedReasons: {}
  };
}
function normalizeSummary(raw, projectRoot) {
  const base = createEmptySummary(projectRoot);
  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : base.generatedAt,
    projectRoot,
    lastEventAt: typeof raw.lastEventAt === "string" ? raw.lastEventAt : null,
    totals: {
      ...base.totals,
      ...raw.totals ?? {}
    },
    byTaskType: normalizeAggregateMap(raw.byTaskType),
    byExecutionMode: normalizeAggregateMap(raw.byExecutionMode),
    blockedReasons: normalizeCounterMap(raw.blockedReasons)
  };
}
function normalizeAggregateMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result = {};
  for (const [key, value] of Object.entries(raw)) {
    result[key] = normalizeAggregate(value);
  }
  return result;
}
function normalizeCounterMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result = {};
  for (const [key, value] of Object.entries(raw)) {
    result[key] = typeof value === "number" && Number.isFinite(value) ? value : 0;
  }
  return result;
}
function normalizeAggregate(raw) {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    started: typeof record.started === "number" ? record.started : 0,
    completed: typeof record.completed === "number" ? record.completed : 0,
    blocked: typeof record.blocked === "number" ? record.blocked : 0,
    failed: typeof record.failed === "number" ? record.failed : 0,
    totalDurationMs: typeof record.totalDurationMs === "number" ? record.totalDurationMs : 0,
    averageDurationMs: typeof record.averageDurationMs === "number" ? record.averageDurationMs : 0
  };
}
function applyEvent(summary, event) {
  const taskTypeAggregate = ensureAggregate(summary.byTaskType, event.taskType);
  const modeAggregate = event.executionMode ? ensureAggregate(summary.byExecutionMode, event.executionMode) : null;
  switch (event.eventType) {
    case "task_started":
      summary.totals.started += 1;
      taskTypeAggregate.started += 1;
      if (modeAggregate) modeAggregate.started += 1;
      break;
    case "task_completed":
      summary.totals.completed += 1;
      taskTypeAggregate.completed += 1;
      if (modeAggregate) modeAggregate.completed += 1;
      if (event.executionMode === "worker") {
        summary.totals.workerExecutions += 1;
      }
      applyDuration(summary, taskTypeAggregate, modeAggregate, event.durationMs);
      break;
    case "task_blocked":
      summary.totals.blocked += 1;
      taskTypeAggregate.blocked += 1;
      if (modeAggregate) modeAggregate.blocked += 1;
      if (event.blockedReasonCode) {
        summary.blockedReasons[event.blockedReasonCode] = (summary.blockedReasons[event.blockedReasonCode] || 0) + 1;
      }
      break;
    case "task_failed":
      summary.totals.failed += 1;
      taskTypeAggregate.failed += 1;
      if (modeAggregate) modeAggregate.failed += 1;
      break;
    case "agent_call_created":
      summary.totals.agentCallsCreated += 1;
      break;
    case "agent_call_applied":
      summary.totals.agentCallsApplied += 1;
      summary.totals.resumed += 1;
      summary.totals.completed += 1;
      taskTypeAggregate.completed += 1;
      if (modeAggregate) modeAggregate.completed += 1;
      applyDuration(summary, taskTypeAggregate, modeAggregate, event.durationMs);
      break;
    default:
      return;
  }
}
function applyDuration(summary, taskTypeAggregate, modeAggregate, durationMs) {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) return;
  summary.totals.totalDurationMs += durationMs;
  summary.totals.averageDurationMs = summary.totals.completed > 0 ? Math.round(summary.totals.totalDurationMs / summary.totals.completed) : 0;
  taskTypeAggregate.totalDurationMs += durationMs;
  taskTypeAggregate.averageDurationMs = taskTypeAggregate.completed > 0 ? Math.round(taskTypeAggregate.totalDurationMs / taskTypeAggregate.completed) : 0;
  if (modeAggregate) {
    modeAggregate.totalDurationMs += durationMs;
    modeAggregate.averageDurationMs = modeAggregate.completed > 0 ? Math.round(modeAggregate.totalDurationMs / modeAggregate.completed) : 0;
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
      averageDurationMs: 0
    };
  }
  return map[key];
}

// scripts/src/task-executor.ts
var DEFAULT_CONFIG = {
  maxParallel: 3
};
var AGENT_CALLS_DIR3 = ".codebuddy/agent-calls";
var AGENT_CALL_MARKER = "[agent-call]";
var DEFAULT_MANUAL_AGENT_ID = "task-orchestrator";
var MANUAL_AGENT_ID_ENV = "CODEBUDDY_MANUAL_AGENT_ID";
function selectManualAgentId(task) {
  const env = (process.env[MANUAL_AGENT_ID_ENV] || "").trim();
  if (env) return env;
  if (/(性能|performance|lighthouse|web vitals|profil(e|ing))/i.test(task.title)) {
    return "performance-profiler";
  }
  if (/(安全|security|xss|csrf|owasp)/i.test(task.title)) {
    return "security-reviewer";
  }
  switch (task.type) {
    case "analysis":
      return "structure-analyzer";
    case "test":
    case "implement":
    case "refactor":
      return "tdd-driver";
    case "review":
      return "code-reviewer";
    case "build-fix":
      return "build-fix";
    case "prd":
    case "requirement":
      return "planner";
    case "design":
      return "planner";
    case "acceptance":
    default:
      return DEFAULT_MANUAL_AGENT_ID;
  }
}
function tryExtractAgentIdFromPrompt(promptMd) {
  const m = promptMd.match(/```json\s*([\s\S]*?)\s*```/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    if (!parsed || typeof parsed !== "object") return null;
    const agentId = parsed.agentId;
    if (typeof agentId !== "string") return null;
    const trimmed = agentId.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}
function priorityScore(priority) {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 2;
  }
}
function getConflictKeys(task) {
  const files = task.scope?.files ?? [];
  const modules = task.scope?.modules ?? [];
  const keys = [
    ...files.map((f) => `file:${f}`),
    ...modules.map((m) => `module:${m}`)
  ];
  return keys.length > 0 ? keys : null;
}
function selectRunnableTasks(runnable, maxParallel, strategy) {
  if (maxParallel <= 0) return [];
  if (strategy === "allow") return runnable.slice(0, maxParallel);
  const selected = [];
  const used = /* @__PURE__ */ new Set();
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
  return selected.length > 0 ? selected : runnable.slice(0, 1);
}
var TaskExecutor = class {
  constructor(manager, config = {}) {
    this.isRunning = false;
    this.isPaused = false;
    /** AgentRuntime 渲染的最后一个 prompt（用于注入 .prompt.md） */
    this.lastRenderedPrompt = null;
    this.manager = manager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.runtime = config.runtime || null;
    this.workerExecutor = config.workerExecutor ?? createConfiguredWorkerExecutor();
  }
  /**
   * 开始执行 TaskBook（兼容旧行为：任务完成后自动标记 TaskBook 为 completed）
   */
  async execute(taskBookId) {
    const result = await this.executeTasks(taskBookId);
    if (!result.taskBook) return null;
    if (result.status === "completed") {
      this.manager.updateStatus(taskBookId, "completed");
      try {
        aggregateAndPersist(this.manager, taskBookId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[TaskExecutor] FinalReport \u751F\u6210\u5931\u8D25\uFF08\u4E0D\u5F71\u54CD\u5B8C\u6210\u72B6\u6001\uFF09\uFF1A${msg}`);
      }
      this.config.onAllComplete?.(result.taskBook);
    }
    return this.manager.load(taskBookId);
  }
  /**
   * 执行 TaskBook 中指定类型的任务（用于 workflow 分阶段执行，不自动完成 TaskBook）
   */
  async executeTasks(taskBookId, options = {}) {
    const taskBook = this.manager.load(taskBookId);
    if (!taskBook) {
      return { status: "not_found", taskBook: null, message: `TaskBook not found: ${taskBookId}` };
    }
    if (taskBook.status !== "confirmed" && taskBook.status !== "executing") {
      return {
        status: "invalid_status",
        taskBook,
        message: `TaskBook must be confirmed/executing before execution. Current status: ${taskBook.status}`
      };
    }
    const allowedTypes = new Set(options.allowedTaskTypes ?? ["analysis", "design", "test", "implement", "review"]);
    const allowedTaskIds = options.allowedTaskIds ? new Set(options.allowedTaskIds) : null;
    const maxParallel = options.maxParallel ?? this.config.maxParallel;
    const conflictStrategy = options.conflictStrategy ?? "allow";
    this.isRunning = true;
    this.isPaused = false;
    console.log(`[TaskExecutor] \u6267\u884C\u4EFB\u52A1\u7C7B\u578B: ${Array.from(allowedTypes).join(", ")}`);
    while (this.isRunning && !this.isPaused) {
      const current = this.manager.load(taskBookId);
      if (!current) {
        return { status: "not_found", taskBook: null, message: `TaskBook not found: ${taskBookId}` };
      }
      const applied = this.tryAutoApplyAgentCallResults(taskBookId, current, allowedTypes, allowedTaskIds);
      if (applied > 0) {
        continue;
      }
      const pendingAllowed = current.tasks.filter(
        (t) => t.status === "pending" && allowedTypes.has(t.type) && (!allowedTaskIds || allowedTaskIds.has(t.id))
      );
      const blockedAllowed = current.tasks.filter(
        (t) => t.status === "blocked" && allowedTypes.has(t.type) && (!allowedTaskIds || allowedTaskIds.has(t.id))
      );
      if (pendingAllowed.length === 0) {
        if (blockedAllowed.length > 0) {
          return {
            status: "blocked",
            taskBook: current,
            message: `\u5B58\u5728\u963B\u585E\u4EFB\u52A1\uFF08${blockedAllowed.length} \u4E2A\uFF09`
          };
        }
        return { status: "completed", taskBook: current };
      }
      const completedTaskIds = new Set(
        current.tasks.filter((t) => t.status === "done" || t.status === "skipped").map((t) => t.id)
      );
      const runnable = pendingAllowed.filter((task) => task.dependencies.every((depId) => completedTaskIds.has(depId)));
      if (runnable.length === 0) {
        const waits = pendingAllowed.map((t) => {
          const unresolved = t.dependencies.filter((depId) => !completedTaskIds.has(depId));
          return { id: t.id, title: t.title, unresolved };
        });
        return {
          status: blockedAllowed.length > 0 ? "blocked" : "waiting",
          taskBook: current,
          message: `\u6CA1\u6709\u53EF\u6267\u884C\u7684\u4EFB\u52A1\uFF08\u7B49\u5F85\u4F9D\u8D56\u5B8C\u6210/\u53EF\u80FD\u5B58\u5728\u5FAA\u73AF\u4F9D\u8D56\uFF09\u3002\u672A\u6EE1\u8DB3\u4F9D\u8D56: ${JSON.stringify(waits.slice(0, 5))}`
        };
      }
      const indexById = /* @__PURE__ */ new Map();
      for (let i = 0; i < current.tasks.length; i++) {
        indexById.set(current.tasks[i].id, i);
      }
      const runnableSorted = [...runnable].sort((a, b) => {
        const delta = priorityScore(b.priority) - priorityScore(a.priority);
        if (delta !== 0) return delta;
        return (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0);
      });
      const tasksToExecute = selectRunnableTasks(runnableSorted, maxParallel, conflictStrategy);
      if (conflictStrategy !== "allow" && tasksToExecute.length < Math.min(maxParallel, runnable.length)) {
        console.log(`[TaskExecutor] conflictStrategy=${conflictStrategy}: runnable=${runnable.length} selected=${tasksToExecute.length}`);
      }
      console.log(`[TaskExecutor] \u5E76\u884C\u6267\u884C ${tasksToExecute.length} \u4E2A\u4EFB\u52A1`);
      const results = await Promise.all(tasksToExecute.map((task) => this.executeTask(taskBookId, task)));
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const batchDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
      const executors = results.map((r) => {
        const task = current.tasks.find((t) => t.id === r.taskId);
        return task ? selectManualAgentId(task) : "unknown";
      }).filter((v, i, a) => a.indexOf(v) === i);
      const latestTb = this.manager.load(taskBookId);
      if (latestTb) {
        const done = latestTb.tasks.filter((t) => t.status === "done" || t.status === "skipped").length;
        const inProgress = latestTb.tasks.filter((t) => t.status === "in_progress").length;
        const blocked = latestTb.tasks.filter((t) => t.status === "blocked").length;
        const pending = latestTb.tasks.filter((t) => t.status === "pending").length;
        console.log(`[\u8FDB\u5EA6] \u2705 ${done}/${latestTb.tasks.length} \u5B8C\u6210 | \u{1F504} ${inProgress} \u8FDB\u884C\u4E2D | \u{1F6AB} ${blocked} \u963B\u585E | \u23F3 ${pending} \u5F85\u6267\u884C`);
      }
      this.manager.logChange(
        taskBookId,
        null,
        "modified",
        `\u6279\u6B21\u5B8C\u6210: ${succeeded}/${results.length} \u6210\u529F, ${failed} \u5931\u8D25/\u963B\u585E, \u8017\u65F6 ${batchDuration}ms`,
        void 0,
        { event: "batch_complete", succeeded, failed, duration: batchDuration, executors }
      );
      for (const result of results) {
        if (!result.success && result.error) {
          console.log(`[TaskExecutor] \u4EFB\u52A1 ${result.taskId} \u6267\u884C\u5931\u8D25: ${result.error}`);
        }
      }
    }
    return { status: "blocked", taskBook: this.manager.load(taskBookId), message: "\u6267\u884C\u88AB\u6682\u505C/\u505C\u6B62" };
  }
  /**
   * 执行单个任务
   */
  async executeTask(taskBookId, task) {
    const startTime = Date.now();
    this.manager.updateTaskStatus(taskBookId, task.id, "in_progress");
    this.config.onTaskStart?.(task);
    this.lastRenderedPrompt = null;
    const plannedAgentId = task.type === "analysis" || task.type === "acceptance" ? void 0 : selectManualAgentId(task);
    recordExecutionMetric({
      eventType: "task_started",
      taskBookId,
      taskId: task.id,
      taskType: task.type,
      taskTitle: task.title,
      executionMode: inferPlannedExecutionMode(task.type, Boolean(this.workerExecutor)),
      agentId: plannedAgentId
    });
    console.log(`[TaskExecutor] \u5F00\u59CB\u6267\u884C\u4EFB\u52A1: ${task.title} (${task.type})`);
    try {
      const dispatchResult = await this.dispatchTask(taskBookId, task);
      const actualWork = dispatchResult.actualWork;
      const executedBy = dispatchResult.executedBy || selectManualAgentId(task);
      this.manager.updateTaskStatus(taskBookId, task.id, "done", actualWork);
      if (dispatchResult.workerExecution) {
        this.manager.logChange(taskBookId, task.id, "modified", "worker-executor applied: " + dispatchResult.workerExecution.requestId, void 0, {
          event: "worker-executor",
          action: "applied",
          requestId: dispatchResult.workerExecution.requestId,
          agentId: dispatchResult.workerExecution.agentId,
          worker: dispatchResult.workerExecution.worker,
          completedAt: dispatchResult.workerExecution.completedAt,
          artifacts: dispatchResult.artifacts
        });
      }
      try {
        this.manager.updateTask(taskBookId, task.id, { executedBy });
      } catch {
      }
      this.lastRenderedPrompt = null;
      const result = {
        taskId: task.id,
        success: true,
        actualWork,
        duration: Date.now() - startTime
      };
      recordExecutionMetric({
        eventType: "task_completed",
        taskBookId,
        taskId: task.id,
        taskType: task.type,
        taskTitle: task.title,
        executionMode: inferCompletedExecutionMode(task.type, executedBy),
        agentId: plannedAgentId,
        requestId: dispatchResult.workerExecution?.requestId,
        worker: dispatchResult.workerExecution?.worker,
        status: "success",
        durationMs: result.duration
      });
      this.config.onTaskComplete?.(task, result);
      console.log(`[TaskExecutor] \u4EFB\u52A1\u5B8C\u6210: ${task.title} (by ${executedBy})`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.isRecoverableError(error)) {
        let blockedReason = errorMessage;
        if (/MANUAL_REQUIRED/i.test(errorMessage)) {
          try {
            blockedReason = this.ensureManualTaskAgentCall(taskBookId, task, errorMessage);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            blockedReason = `${errorMessage}
(agent-call init failed: ${msg})`;
          }
          this.lastRenderedPrompt = null;
        }
        this.manager.updateTaskStatus(taskBookId, task.id, "blocked", void 0, blockedReason);
        this.config.onTaskBlocked?.(task, blockedReason);
        const agentCallMeta = extractAgentCallMeta(blockedReason);
        recordExecutionMetric({
          eventType: "task_blocked",
          taskBookId,
          taskId: task.id,
          taskType: task.type,
          taskTitle: task.title,
          executionMode: inferBlockedExecutionMode(task.type, blockedReason, Boolean(this.workerExecutor)),
          agentId: plannedAgentId,
          requestId: agentCallMeta?.requestId,
          status: "blocked",
          durationMs: Date.now() - startTime,
          blockedReasonCode: classifyBlockedReason(blockedReason),
          blockedReason: truncateMetricText(blockedReason)
        });
        return {
          taskId: task.id,
          success: false,
          error: blockedReason,
          duration: Date.now() - startTime
        };
      }
      console.error(`[TaskExecutor] \u4EFB\u52A1\u6267\u884C\u51FA\u9519: ${task.title}`, error);
      recordExecutionMetric({
        eventType: "task_failed",
        taskBookId,
        taskId: task.id,
        taskType: task.type,
        taskTitle: task.title,
        executionMode: inferBlockedExecutionMode(task.type, errorMessage, Boolean(this.workerExecutor)),
        agentId: plannedAgentId,
        status: "failed",
        durationMs: Date.now() - startTime,
        blockedReasonCode: classifyBlockedReason(errorMessage),
        blockedReason: truncateMetricText(errorMessage)
      });
      return {
        taskId: task.id,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime
      };
    }
  }
  ensureManualTaskAgentCall(taskBookId, task, manualReason) {
    const requestId = computeAgentCallRequestId(taskBookId, task.id);
    const promptPath = toPosixPath(`${AGENT_CALLS_DIR3}/${requestId}.prompt.md`);
    const resultPath = toPosixPath(`${AGENT_CALLS_DIR3}/${requestId}.result.json`);
    const promptAbsPath = path8.join(process.cwd(), promptPath);
    const resultAbsPath = path8.join(process.cwd(), resultPath);
    ensureDir2(path8.dirname(promptAbsPath));
    let agentId = selectManualAgentId(task);
    if (fs7.existsSync(promptAbsPath)) {
      try {
        const existing = fs7.readFileSync(promptAbsPath, "utf-8");
        const parsedAgentId = tryExtractAgentIdFromPrompt(existing);
        if (parsedAgentId) agentId = parsedAgentId;
      } catch {
      }
    }
    const meta = {
      requestId,
      agentId,
      kind: "manual-task",
      taskBookId,
      taskId: task.id,
      promptPath,
      resultPath,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const agentDef = loadAgentDefinition(process.cwd(), agentId);
    const agentDefMissingNote = !agentDef ? `

[agent-call] agent definition missing: expected .codebuddy/agents/${agentId}/AGENT.md (or agents/${agentId}/AGENT.md).` : "";
    const runtimePrompt = this.lastRenderedPrompt;
    if (!fs7.existsSync(promptAbsPath)) {
      const tb = this.manager.load(taskBookId);
      if (!tb) throw new Error(`TaskBook not found: ${taskBookId}`);
      const enrichedManualReason = `${manualReason}${agentDefMissingNote}`;
      const prompt = buildManualTaskPrompt({
        meta,
        taskBook: tb,
        task,
        manualReason: enrichedManualReason,
        agentDefinitionPath: agentDef?.path ?? null,
        agentDefinition: agentDef?.content ?? null,
        promptPath: meta.promptPath,
        resultPath: meta.resultPath,
        runtimePrompt: runtimePrompt ?? void 0
      });
      fs7.writeFileSync(promptAbsPath, prompt, "utf-8");
      this.manager.logChange(taskBookId, task.id, "modified", `agent-call created: ${requestId}`, void 0, {
        event: "agent-call",
        action: "created",
        requestId,
        agentId,
        kind: meta.kind,
        createdAt: meta.createdAt,
        promptPath: meta.promptPath,
        resultPath: meta.resultPath
      });
      recordExecutionMetric({
        eventType: "agent_call_created",
        taskBookId,
        taskId: task.id,
        taskType: task.type,
        taskTitle: task.title,
        executionMode: "agent-call",
        agentId,
        requestId,
        status: "blocked",
        blockedReasonCode: classifyBlockedReason(manualReason),
        blockedReason: truncateMetricText(manualReason)
      });
    }
    if (!fs7.existsSync(resultAbsPath)) {
    }
    return buildAgentCallBlockedReason(`${manualReason}${agentDefMissingNote}`, meta);
  }
  tryAutoApplyAgentCallResults(taskBookId, taskBook, allowedTypes, allowedTaskIds) {
    let applied = 0;
    for (const task of taskBook.tasks) {
      if (task.status !== "blocked") continue;
      if (!allowedTypes.has(task.type)) continue;
      if (allowedTaskIds && !allowedTaskIds.has(task.id)) continue;
      const meta = extractAgentCallMeta(task.blockedReason);
      if (!meta) continue;
      const resultAbsPath = path8.join(process.cwd(), meta.resultPath);
      if (!fs7.existsSync(resultAbsPath)) continue;
      let result;
      try {
        result = parseAgentCallResult2(fs7.readFileSync(resultAbsPath, "utf-8"));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`[AgentCall] \u89E3\u6790\u5931\u8D25: ${meta.requestId} ${msg}`);
        continue;
      }
      if (result.requestId !== meta.requestId) {
        console.log(`[AgentCall] requestId \u4E0D\u5339\u914D: expected ${meta.requestId}, got ${result.requestId}`);
        continue;
      }
      if (result.status !== "success") {
        const reason = result.error?.message ?? `status=${result.status}`;
        console.log(`[AgentCall] \u672A\u5C31\u7EEA: ${meta.requestId} ${reason}`);
        continue;
      }
      let output;
      try {
        output = parseAgentTaskOutput(result.output);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`[AgentCall] output \u65E0\u6548: ${meta.requestId} ${msg}`);
        continue;
      }
      this.manager.updateTask(taskBookId, task.id, {
        status: "done",
        actualWork: output.actualWork,
        blockedReason: ""
      });
      this.manager.logChange(taskBookId, task.id, "modified", `agent-call applied: ${meta.requestId}`, void 0, {
        event: "agent-call",
        action: "applied",
        requestId: meta.requestId,
        agentId: meta.agentId,
        kind: result.kind ?? meta.kind,
        status: "success",
        completedAt: result.completedAt,
        promptPath: meta.promptPath,
        resultPath: meta.resultPath,
        artifacts: result.artifacts
      });
      recordExecutionMetric({
        eventType: "agent_call_applied",
        taskBookId,
        taskId: task.id,
        taskType: task.type,
        taskTitle: task.title,
        executionMode: "agent-call",
        agentId: meta.agentId,
        requestId: meta.requestId,
        status: "success",
        durationMs: computeDurationMs(meta.createdAt, result.completedAt),
        resumed: true
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
    if (task.type === "analysis") {
      return { actualWork: await this.executeAnalysisTask(task) };
    }
    if (task.type === "acceptance") {
      return { actualWork: await this.executeAcceptanceTask(task) };
    }
    if (this.runtime) {
      const agentId = selectManualAgentId(task);
      const agent = this.runtime.getAgent(agentId);
      if (agent) {
        const context = this.buildAgentContext(taskBookId, task);
        const result = this.runtime.invoke({ agentId, context });
        if (result.status === "done" && result.renderedPrompt) {
          this.lastRenderedPrompt = result.renderedPrompt;
          const workerResult = this.tryDispatchWithWorker(taskBookId, task, agentId, context, result.renderedPrompt);
          if (workerResult) {
            return workerResult;
          }
          console.log("[TaskExecutor] AgentRuntime: " + agentId + " ?????prompt (" + result.renderedPrompt.length + " ???)???????????");
          throw new Error("MANUAL_REQUIRED: AgentRuntime ??? " + agentId + " ????????prompt????????AI ??????");
        }
        if (result.status === "needs_human") {
          console.log("[TaskExecutor] AgentRuntime: " + agentId + " ????????????????MANUAL_REQUIRED");
          throw new Error("MANUAL_REQUIRED: " + (result.humanReason || "??????????"));
        }
        if (result.status === "error") {
          console.log("[TaskExecutor] AgentRuntime: " + agentId + " ???????????? MANUAL_REQUIRED");
          throw new Error("MANUAL_REQUIRED: AgentRuntime ??? - " + result.error);
        }
      }
    }
    switch (task.type) {
      case "design":
        return { actualWork: await this.executeDesignTask(task) };
      case "test":
        return { actualWork: await this.executeTestTask(task) };
      case "implement":
        return { actualWork: await this.executeImplementTask(task) };
      case "refactor":
        return { actualWork: await this.executeImplementTask(task) };
      case "review":
        return { actualWork: await this.executeReviewTask(task) };
      case "build-fix":
        return { actualWork: await this.executeBuildFixTask(task) };
      case "requirement":
      case "prd":
        return { actualWork: await this.executePlanningTask(task) };
      default:
        throw new Error("??????????? " + task.type);
    }
  }
  tryDispatchWithWorker(taskBookId, task, agentId, context, renderedPrompt) {
    if (!this.workerExecutor) return null;
    const requestId = computeAgentCallRequestId(taskBookId, task.id);
    const workerResult = this.workerExecutor.execute({
      requestId,
      taskBookId,
      agentId,
      projectRoot: process.cwd(),
      prompt: renderedPrompt,
      task,
      context
    });
    if (workerResult.status === "success" && workerResult.actualWork) {
      console.log("[TaskExecutor] WorkerExecutor: " + agentId + " ????????? (" + this.workerExecutor.describe() + ")");
      this.lastRenderedPrompt = null;
      return {
        actualWork: workerResult.actualWork,
        executedBy: "worker-executor:" + agentId,
        artifacts: workerResult.artifacts,
        workerExecution: {
          requestId,
          agentId,
          worker: this.workerExecutor.describe(),
          completedAt: workerResult.completedAt
        }
      };
    }
    const reason = workerResult.error || "status=" + workerResult.status;
    console.log("[TaskExecutor] WorkerExecutor: " + agentId + " " + workerResult.status + "?????? MANUAL_REQUIRED (" + reason + ")");
    throw new Error("MANUAL_REQUIRED: WorkerExecutor(" + this.workerExecutor.describe() + ") " + workerResult.status + " - " + reason);
  }
  /**
   * 构建 Agent 执行上下文
   */
  buildAgentContext(taskBookId, task) {
    const taskSnapshot = {
      id: task.id,
      title: task.title,
      type: task.type,
      description: task.actualWork || "",
      priority: task.priority,
      acceptanceCriteria: task.acceptanceCriteria || [],
      scope: task.scope
    };
    const context = {
      taskBookId,
      task: taskSnapshot,
      projectRoot: process.cwd()
    };
    const archReport = path8.join(process.cwd(), ".codebuddy/reports/architecture/latest.json");
    const modulesReport = path8.join(process.cwd(), ".codebuddy/reports/modules/latest.json");
    if (fs7.existsSync(archReport) || fs7.existsSync(modulesReport)) {
      context.reports = {};
      try {
        if (fs7.existsSync(archReport)) {
          context.reports.architecture = JSON.parse(fs7.readFileSync(archReport, "utf-8"));
        }
        if (fs7.existsSync(modulesReport)) {
          context.reports.modules = JSON.parse(fs7.readFileSync(modulesReport, "utf-8"));
        }
      } catch {
      }
    }
    if (task.scope?.files && task.scope.files.length > 0) {
      context.relatedFiles = [];
      for (const filePath of task.scope.files.slice(0, 10)) {
        const absPath = path8.resolve(process.cwd(), filePath);
        if (fs7.existsSync(absPath)) {
          try {
            const content = fs7.readFileSync(absPath, "utf-8");
            if (content.length <= 5e4) {
              context.relatedFiles.push({ path: filePath, content });
            }
          } catch {
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
    console.log(`[TaskExecutor] \u6267\u884C\u5206\u6790\u4EFB\u52A1: ${task.title}`);
    const moduleMapper = path8.join(process.cwd(), ".codebuddy/scripts/module-mapper.js");
    const structureAnalyzer = path8.join(process.cwd(), ".codebuddy/scripts/structure-analyzer.js");
    const ran = [];
    if (fs7.existsSync(moduleMapper)) {
      const result = runNodeScript(moduleMapper, [".", "--mode", "summary", "--output", "json"]);
      if (!result.ok) {
        throw new Error(`\u5206\u6790\u5931\u8D25(module-mapper): ${result.stderr || result.stdout}`);
      }
      ran.push("module-mapper");
    }
    if (fs7.existsSync(structureAnalyzer)) {
      const result = runNodeScript(structureAnalyzer, [".", "--mode", "summary", "--output", "json"]);
      if (!result.ok) {
        throw new Error(`\u5206\u6790\u5931\u8D25(structure-analyzer): ${result.stderr || result.stdout}`);
      }
      ran.push("structure-analyzer");
    }
    if (ran.length === 0) {
      throw new Error("MANUAL_REQUIRED: \u672A\u627E\u5230 .codebuddy/scripts/module-mapper.js \u6216 structure-analyzer.js\uFF0C\u8BF7\u5148\u8FD0\u884C codebuddy-loader \u5B89\u88C5\u811A\u672C\u3002");
    }
    return `\u5DF2\u5B8C\u6210\u5206\u6790\uFF08${ran.join(", ")}\uFF09\uFF0C\u62A5\u544A\u5DF2\u5199\u5165 .codebuddy/reports/`;
  }
  /**
   * 执行设计任务
   */
  async executeDesignTask(task) {
    console.log(`[TaskExecutor] \u6267\u884C\u8BBE\u8BA1\u4EFB\u52A1: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: \u9700\u8981 planner Agent \u5B8C\u6210\u8BBE\u8BA1\u4EFB\u52A1\uFF1A${task.title}`);
  }
  /**
   * 执行测试任务
   */
  async executeTestTask(task) {
    console.log(`[TaskExecutor] \u6267\u884C\u6D4B\u8BD5\u4EFB\u52A1: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: \u9700\u8981 tdd-driver Agent \u7F16\u5199\u6D4B\u8BD5\u7528\u4F8B\uFF1A${task.title}`);
  }
  /**
   * 执行实现任务
   */
  async executeImplementTask(task) {
    console.log(`[TaskExecutor] \u6267\u884C\u5B9E\u73B0\u4EFB\u52A1: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: \u9700\u8981 tdd-driver Agent \u5B8C\u6210\u5B9E\u73B0\u4EFB\u52A1\uFF1A${task.title}`);
  }
  /**
   * 执行审查任务
   */
  async executeReviewTask(task) {
    console.log(`[TaskExecutor] \u6267\u884C\u5BA1\u67E5\u4EFB\u52A1: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: \u9700\u8981 code-reviewer Agent \u5B8C\u6210\u5BA1\u67E5\u4EFB\u52A1\uFF1A${task.title}`);
  }
  /**
   * 执行构建修复任务
   */
  async executeBuildFixTask(task) {
    console.log(`[TaskExecutor] \u6267\u884C\u6784\u5EFA\u4FEE\u590D\u4EFB\u52A1: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: \u9700\u8981 build-fix Agent \u8BCA\u65AD\u5E76\u4FEE\u590D\u6784\u5EFA\u9519\u8BEF\uFF1A${task.title}`);
  }
  /**
   * 执行需求/PRD 任务
   */
  async executePlanningTask(task) {
    console.log(`[TaskExecutor] \u6267\u884C\u9700\u6C42/PRD \u4EFB\u52A1: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: \u9700\u8981 planner Agent \u5B8C\u6210\u9700\u6C42\u6F84\u6E05\u6216 PRD \u751F\u6210\uFF1A${task.title}`);
  }
  /**
   * 执行验收任务
   */
  async executeAcceptanceTask(task) {
    console.log(`[TaskExecutor] \u6267\u884C\u9A8C\u6536\u4EFB\u52A1: ${task.title}`);
    throw new Error(`MANUAL_REQUIRED: \u9700\u8981\u4EBA\u5DE5\u9A8C\u6536\u786E\u8BA4\uFF1A${task.title}`);
  }
  /**
   * 判断是否为可恢复的错误
   */
  isRecoverableError(error) {
    if (error instanceof Error) {
      const recoverablePatterns = [
        /missing.*file/i,
        /permission denied/i,
        /not found/i,
        /authentication/i,
        /authorization/i,
        /MANUAL_REQUIRED/i,
        /需要.*确认/,
        /缺少.*配置/
      ];
      return recoverablePatterns.some((pattern) => pattern.test(error.message));
    }
    return false;
  }
  /**
   * 暂停执行
   */
  pause() {
    console.log("[TaskExecutor] \u6682\u505C\u6267\u884C");
    this.isPaused = true;
  }
  /**
   * 恢复执行
   */
  async resume(taskBookId) {
    console.log("[TaskExecutor] \u6062\u590D\u6267\u884C");
    this.isPaused = false;
    return this.execute(taskBookId);
  }
  /**
   * 停止执行
   */
  stop() {
    console.log("[TaskExecutor] \u505C\u6B62\u6267\u884C");
    this.isRunning = false;
    this.isPaused = false;
  }
  /**
   * 跳过阻塞的任务
   */
  skipBlockedTask(taskBookId, taskId, reason) {
    const taskBook = this.manager.load(taskBookId);
    if (!taskBook) return null;
    const task = taskBook.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "blocked") return null;
    this.manager.updateTaskStatus(taskBookId, taskId, "skipped");
    this.manager.logChange(
      taskBookId,
      taskId,
      "modified",
      `\u7528\u6237\u8DF3\u8FC7\u963B\u585E\u4EFB\u52A1: ${reason}`,
      { status: "blocked" },
      { status: "skipped" }
    );
    return this.manager.load(taskBookId);
  }
  /**
   * 解决阻塞并继续
   */
  async resolveBlockedTask(taskBookId, taskId, resolution) {
    const taskBook = this.manager.load(taskBookId);
    if (!taskBook) return null;
    const task = taskBook.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "blocked") return null;
    this.manager.updateTaskStatus(taskBookId, taskId, "pending");
    this.manager.logChange(
      taskBookId,
      taskId,
      "modified",
      `\u7528\u6237\u89E3\u51B3\u963B\u585E: ${resolution}`,
      { status: "blocked", blockedReason: task.blockedReason },
      { status: "pending" }
    );
    return this.resume(taskBookId);
  }
};
function createTaskExecutor(manager, config) {
  return new TaskExecutor(manager, config);
}
function showHelp4() {
  console.log(`
Task Executor - Workflow \u9A71\u52A8\u7684\u4EFB\u52A1\u6267\u884C\u5668

\u7528\u6CD5:
  node .codebuddy/scripts/task-executor.js <taskBookId> [options]

\u9009\u9879:
  --workflow <path>     \u6307\u5B9A workflow \u6587\u4EF6\uFF08\u9ED8\u8BA4: .codebuddy/workflows/default.workflow.json\uFF09
  --approve <gateId>    \u9884\u5148\u6279\u51C6\u67D0\u4E2A gate\uFF08\u53EF\u91CD\u590D\uFF09
  --max-parallel <n>    \u8986\u76D6\u5E76\u884C\u5EA6\uFF08\u9ED8\u8BA4\u53D6 workflow.policies \u6216\u5185\u7F6E\u9ED8\u8BA4\u503C\uFF09
  --tasks-only          \u4E0D\u8BFB\u53D6 workflow\uFF0C\u76F4\u63A5\u6267\u884C\u6240\u6709\u4EFB\u52A1\uFF08\u65E7\u6A21\u5F0F\uFF09
  -h, --help            \u663E\u793A\u5E2E\u52A9

\u8BF4\u660E:
  - workflow \u65E9\u671F\u4E3B\u8981\u7528\u4E8E\u7EA6\u675F/\u5F15\u5BFC\uFF08\u4EA7\u7269\u3001\u987A\u5E8F\u3001\u8D28\u91CF\u95F8\u95E8\uFF09\uFF0C\u540E\u671F\u53EF\u6269\u5C55\u4E3A\u5F3A\u5236\u7F16\u6392\u5F15\u64CE\u3002
  - \u82E5\u6267\u884C\u9047\u5230 MANUAL_REQUIRED\uFF1A\u5C06\u751F\u6210 .codebuddy/agent-calls/<requestId>.prompt.md\uFF0C\u5E76\u628A\u4EFB\u52A1\u7F6E\u4E3A blocked\uFF1B\u5F53\u5199\u56DE\u5BF9\u5E94 result.json \u540E\uFF0C\u91CD\u8BD5\u6267\u884C\u4F1A\u81EA\u52A8 apply \u5E76\u7EE7\u7EED\u3002
`);
}
function loadWorkflowSpec(workflowPath) {
  const raw = fs7.readFileSync(workflowPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("workflow \u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684 JSON \u5BF9\u8C61");
  }
  const spec = parsed;
  if (!spec.id || !spec.version || !Array.isArray(spec.steps)) {
    throw new Error("workflow \u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5: id / version / steps");
  }
  for (const step of spec.steps) {
    if (!step || typeof step !== "object") {
      throw new Error("workflow.steps \u5305\u542B\u65E0\u6548 step");
    }
    const s = step;
    if (!s.id || !s.type || !s.title) {
      throw new Error(`workflow step \u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5: id/type/title (${JSON.stringify(step)})`);
    }
  }
  return spec;
}
function topologicalSteps(spec) {
  if (!spec.edges || spec.edges.length === 0) return spec.steps;
  const stepMap = /* @__PURE__ */ new Map();
  for (const step of spec.steps) {
    stepMap.set(step.id, step);
  }
  const inDegree = /* @__PURE__ */ new Map();
  const adj = /* @__PURE__ */ new Map();
  for (const step of spec.steps) {
    inDegree.set(step.id, 0);
    adj.set(step.id, []);
  }
  for (const e of spec.edges) {
    if (!stepMap.has(e.from) || !stepMap.has(e.to)) {
      throw new Error(`workflow.edges \u5F15\u7528\u4E0D\u5B58\u5728\u7684 step: ${e.from} -> ${e.to}`);
    }
    adj.get(e.from).push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }
  const queue = [];
  for (const step of spec.steps) {
    if ((inDegree.get(step.id) ?? 0) === 0) {
      queue.push(step.id);
    }
  }
  const ordered = [];
  while (queue.length > 0) {
    const id = queue.shift();
    ordered.push(stepMap.get(id));
    for (const next of adj.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if ((inDegree.get(next) ?? 0) === 0) {
        queue.push(next);
      }
    }
  }
  if (ordered.length !== spec.steps.length) {
    throw new Error("workflow.edges \u5B58\u5728\u5FAA\u73AF\u4F9D\u8D56\uFF0C\u65E0\u6CD5\u62D3\u6251\u6392\u5E8F");
  }
  return ordered;
}
function evaluateSkipWhen(skipWhen, taskBook) {
  if (!skipWhen) return false;
  const noTasksMatch = /^no_tasks_of_type:(.+)$/.exec(skipWhen.trim());
  if (noTasksMatch) {
    const types = new Set(noTasksMatch[1].split(",").map((t) => t.trim()));
    const hasRelevantTasks = taskBook.tasks.some(
      (t) => types.has(t.type) && (t.status === "pending" || t.status === "in_progress")
    );
    return !hasRelevantTasks;
  }
  return false;
}
function getPolicyMaxParallel(spec) {
  const raw = spec.policies;
  const concurrency = raw?.concurrency;
  const maxParallel = concurrency?.maxParallelTasks;
  if (typeof maxParallel === "number" && Number.isFinite(maxParallel) && maxParallel > 0) {
    return Math.floor(maxParallel);
  }
  return void 0;
}
function getPolicyConflictStrategy(spec) {
  const raw = spec.policies;
  const concurrency = raw?.concurrency;
  const cs = concurrency?.conflictStrategy;
  if (cs === "allow" || cs === "deny_same_file_set") return cs;
  return void 0;
}
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function getPolicyBuildFix(spec) {
  const raw = spec.policies;
  const bf = raw?.buildFix;
  const defaults = { maxRounds: 3, retryFromStep: "tdd_implement", escalateToHuman: true };
  if (!isPlainObject(bf)) return defaults;
  const maxRounds = typeof bf.maxRounds === "number" && Number.isFinite(bf.maxRounds) && bf.maxRounds > 0 ? Math.floor(bf.maxRounds) : defaults.maxRounds;
  const retryFromStep = typeof bf.retryFromStep === "string" && bf.retryFromStep.length > 0 ? bf.retryFromStep : defaults.retryFromStep;
  const escalateToHuman = typeof bf.escalateToHuman === "boolean" ? bf.escalateToHuman : defaults.escalateToHuman;
  return { maxRounds, retryFromStep, escalateToHuman };
}
function getPolicyBatching(spec) {
  const raw = spec.policies;
  const testing = raw?.testing;
  if (!isPlainObject(testing)) return null;
  const batching = testing.batching;
  if (!isPlainObject(batching)) return null;
  if (batching.strategy !== "risk_tiered") return null;
  const defaults = {
    high: { maxFiles: 3, smokeEveryBatches: 1 },
    medium: { maxFiles: 10, smokeEveryBatches: 1 },
    low: { maxFiles: 25, smokeEveryBatches: 2 }
  };
  const riskTiersRaw = batching.riskTiers;
  if (!isPlainObject(riskTiersRaw)) {
    return { strategy: "risk_tiered", riskTiers: defaults };
  }
  const parseTier = (tier, fallback) => {
    if (!isPlainObject(tier)) return fallback;
    const maxFiles = typeof tier.maxFiles === "number" && Number.isFinite(tier.maxFiles) && tier.maxFiles > 0 ? Math.floor(tier.maxFiles) : fallback.maxFiles;
    const maxChangedLines = typeof tier.maxChangedLines === "number" && Number.isFinite(tier.maxChangedLines) && tier.maxChangedLines > 0 ? Math.floor(tier.maxChangedLines) : fallback.maxChangedLines;
    const smokeEveryBatches = typeof tier.smokeEveryBatches === "number" && Number.isFinite(tier.smokeEveryBatches) && tier.smokeEveryBatches > 0 ? Math.floor(tier.smokeEveryBatches) : fallback.smokeEveryBatches;
    return { maxFiles, maxChangedLines, smokeEveryBatches };
  };
  const parsed = {
    high: parseTier(riskTiersRaw.high, defaults.high),
    medium: parseTier(riskTiersRaw.medium, defaults.medium),
    low: parseTier(riskTiersRaw.low, defaults.low)
  };
  return { strategy: "risk_tiered", riskTiers: parsed };
}
function inferRiskTier(taskBook, allowedTaskTypes) {
  const hasHighPriority = taskBook.tasks.some(
    (t) => t.status === "pending" && allowedTaskTypes.has(t.type) && (t.priority === "critical" || t.priority === "high")
  );
  if (hasHighPriority) return "high";
  switch (taskBook.taskType) {
    case "refactoring":
    case "debugging":
      return "high";
    case "code-review":
      return "low";
    case "testing":
      return "medium";
    case "new-feature":
    default:
      return "medium";
  }
}
function priorityRank(priority) {
  switch (priority) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
    default:
      return 3;
  }
}
function getScopedFiles(task) {
  const files = task.scope?.files ?? [];
  return files.filter((f) => typeof f === "string" && f.length > 0);
}
function selectBatchTasks(runnable, maxFiles) {
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
  const selected = [];
  const usedFiles = /* @__PURE__ */ new Set();
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
    const newFiles = [];
    for (const f of files) {
      if (!usedFiles.has(f)) newFiles.push(f);
    }
    if (usedFiles.size + newFiles.length > maxFiles) continue;
    for (const f of newFiles) usedFiles.add(f);
    selected.push(task);
  }
  return selected.length > 0 ? selected : ordered.slice(0, 1);
}
function getGateById(spec, gateId) {
  if (!spec.gates) return null;
  const found = spec.gates.find((g) => g.id === gateId);
  return found ?? null;
}
function getStepGates(spec, step) {
  const gateIds = step.gates ?? [];
  const gates = [];
  for (const id of gateIds) {
    const gate = getGateById(spec, id);
    if (!gate) {
      throw new Error(`step.gates \u5F15\u7528\u4E0D\u5B58\u5728\u7684 gate: ${id}`);
    }
    gates.push(gate);
  }
  return gates;
}
var GATE_EVIDENCE_OUTPUT_LIMIT = 2e4;
function safeTimestampForFilename() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
function sanitizeForFilename(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}
function truncateMetricText(value, maxLength = 500) {
  const trimmed = String(value || "").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}
function computeAgentCallRequestId(taskBookId, taskId) {
  const hash = (0, import_crypto.createHash)("sha1").update(`${taskBookId}:${taskId}`).digest("hex").slice(0, 10);
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
    createdAt: meta.createdAt
  };
  return `${message}
${AGENT_CALL_MARKER} ${JSON.stringify(payload)}`;
}
function extractAgentCallMeta(blockedReason) {
  if (!blockedReason) return null;
  const lines = blockedReason.split(/\r?\n/);
  let metaLine = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith(AGENT_CALL_MARKER)) {
      metaLine = line;
      break;
    }
  }
  if (!metaLine) return null;
  const jsonText = metaLine.slice(AGENT_CALL_MARKER.length).trim();
  if (!jsonText) return null;
  let raw;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const obj = raw;
  const requestId = obj.requestId;
  const agentId = obj.agentId;
  const kind = obj.kind;
  const taskBookId = obj.taskBookId;
  const taskId = obj.taskId;
  const promptPath = obj.promptPath;
  const resultPath = obj.resultPath;
  const createdAt = obj.createdAt;
  if (typeof requestId !== "string" || !requestId) return null;
  if (typeof agentId !== "string" || !agentId) return null;
  if (typeof taskBookId !== "string") return null;
  if (typeof taskId !== "string") return null;
  if (typeof promptPath !== "string" || !promptPath) return null;
  if (typeof resultPath !== "string" || !resultPath) return null;
  return {
    requestId,
    agentId,
    kind: kind === "planner" || kind === "manual-task" ? kind : void 0,
    taskBookId,
    taskId,
    promptPath: toPosixPath(promptPath),
    resultPath: toPosixPath(resultPath),
    createdAt: typeof createdAt === "string" ? createdAt : ""
  };
}
function parseAgentCallResult2(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("result.json \u5FC5\u987B\u662F JSON object");
  }
  const obj = parsed;
  const requestId = obj.requestId;
  const kind = obj.kind;
  const status = obj.status;
  if (typeof requestId !== "string" || !requestId) {
    throw new Error("result.json \u7F3A\u5C11 requestId");
  }
  if (status !== "success" && status !== "failed" && status !== "blocked") {
    throw new Error("result.json.status \u5FC5\u987B\u662F 'success' | 'failed' | 'blocked'");
  }
  const output = obj.output;
  const artifacts = obj.artifacts;
  const error = obj.error;
  const completedAt = obj.completedAt;
  return {
    requestId,
    kind: kind === "planner" || kind === "manual-task" ? kind : void 0,
    status,
    output,
    artifacts: Array.isArray(artifacts) ? artifacts : void 0,
    error: typeof error === "object" && error ? error : void 0,
    completedAt: typeof completedAt === "string" ? completedAt : void 0
  };
}
function parseAgentTaskOutput(output) {
  if (!output || typeof output !== "object") {
    throw new Error("output \u5FC5\u987B\u662F object\uFF0C\u5E76\u5305\u542B actualWork");
  }
  const obj = output;
  const actualWork = obj.actualWork;
  if (typeof actualWork !== "string" || !actualWork.trim()) {
    throw new Error("output.actualWork \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
  }
  return { actualWork: actualWork.trim() };
}
function readTextFileIfExists2(filePath) {
  if (!fs7.existsSync(filePath)) return null;
  return fs7.readFileSync(filePath, "utf-8");
}
function extractAgentVersion2(agentMarkdown) {
  const fm = agentMarkdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  const frontmatter = fm ? fm[1] : null;
  if (frontmatter) {
    const m = frontmatter.match(/^version:\s*(.+)$/m);
    const v = m ? m[1].trim() : "";
    return v ? v : void 0;
  }
  const yaml = agentMarkdown.match(/```ya?ml\s*([\s\S]*?)\s*```/);
  if (yaml) {
    const m = yaml[1].match(/^version:\s*(.+)$/m);
    const v = m ? m[1].trim() : "";
    return v ? v : void 0;
  }
  return void 0;
}
function loadAgentDefinition(projectRoot, agentId) {
  const candidates = [
    path8.join(projectRoot, ".codebuddy", "agents", agentId, "AGENT.md"),
    path8.join(projectRoot, "agents", agentId, "AGENT.md")
  ];
  for (const p of candidates) {
    const content = readTextFileIfExists2(p);
    if (content) return { path: p, content };
  }
  return null;
}
function loadAgentPromptTemplate(projectRoot, agentId, taskType) {
  const promptFileMap = {
    "tdd-driver": {
      "test": "red.md",
      "implement": "green.md",
      "refactor": "refactor.md"
    },
    "code-reviewer": {
      "review": "review.md"
    },
    "build-fix": {
      "build-fix": "diagnose-fix.md"
    }
  };
  const agentPrompts = promptFileMap[agentId];
  if (!agentPrompts) return null;
  const fileName = agentPrompts[taskType];
  if (!fileName) return null;
  const candidates = [
    path8.join(projectRoot, ".codebuddy", "agents", agentId, "prompts", fileName),
    path8.join(projectRoot, "agents", agentId, "prompts", fileName)
  ];
  for (const p of candidates) {
    const content = readTextFileIfExists2(p);
    if (content) return content;
  }
  return null;
}
function buildManualTaskPrompt(args) {
  const agentVersion = args.agentDefinition ? extractAgentVersion2(args.agentDefinition) : void 0;
  const header = {
    requestId: args.meta.requestId,
    agentId: args.meta.agentId,
    agentVersion,
    taskBookId: args.taskBook.id,
    taskBookRevision: typeof args.taskBook.revision === "number" ? args.taskBook.revision : 0,
    taskId: args.task.id,
    taskType: args.task.type,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    promptPath: args.promptPath,
    resultPath: args.resultPath
  };
  const agentDefinition = args.agentDefinition ?? "(missing AGENT.md)";
  const agentDefinitionHint = args.agentDefinitionPath ? `source: ${args.agentDefinitionPath}` : "source: (not found)";
  const schemaExample = {
    requestId: args.meta.requestId,
    kind: "manual-task",
    status: "success",
    output: {
      actualWork: "\u7B80\u8981\u8BB0\u5F55\u4F60\u5B8C\u6210\u4E86\u4EC0\u4E48\u3001\u6539\u4E86\u54EA\u4E9B\u5173\u952E\u70B9\u3001\u5982\u4F55\u9A8C\u8BC1\uFF08\u547D\u4EE4/\u7ED3\u679C\uFF09\u3002"
    },
    completedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return [
    "# Agent Call: manual-task",
    "",
    "## Header (JSON)",
    "```json",
    JSON.stringify(header, null, 2),
    "```",
    "",
    `## Agent Definition (${agentDefinitionHint})`,
    "```md",
    agentDefinition.trimEnd(),
    "```",
    "",
    ...(() => {
      const promptTemplate = loadAgentPromptTemplate(process.cwd(), args.meta.agentId, args.task.type);
      if (!promptTemplate) return [];
      return [
        "## Prompt Template (\u5F31\u6A21\u578B\u5F15\u5BFC)",
        "```md",
        promptTemplate.trimEnd(),
        "```",
        ""
      ];
    })(),
    "## Context: TaskBook JSON",
    "```json",
    JSON.stringify(args.taskBook, null, 2),
    "```",
    "",
    "## Context: Task JSON",
    "```json",
    JSON.stringify(args.task, null, 2),
    "```",
    "",
    // 自动收集的上下文（文件内容、引用追踪、关联测试、Git 历史）
    ...(() => {
      try {
        const ctx = collectContext(args.task, process.cwd());
        const md = formatContextAsMarkdown(ctx);
        if (md) return [md];
      } catch {
      }
      return [];
    })(),
    // AgentRuntime 渲染的高质量 prompt（如果可用）
    ...(() => {
      if (!args.runtimePrompt) return [];
      return [
        "## AgentRuntime Rendered Prompt",
        "",
        "> \u4EE5\u4E0B\u662F AgentRuntime \u57FA\u4E8E Agent \u5B9A\u4E49\u548C\u4EFB\u52A1\u4E0A\u4E0B\u6587\u81EA\u52A8\u6E32\u67D3\u7684\u6267\u884C prompt\u3002",
        "> AI \u5DE5\u5177\u5E94\u4F18\u5148\u53C2\u8003\u6B64 prompt \u6267\u884C\u4EFB\u52A1\uFF0C\u5B83\u5305\u542B\u4E86\u5B8C\u6574\u7684\u4E0A\u4E0B\u6587\u548C\u6307\u4EE4\u3002",
        "",
        args.runtimePrompt.trimEnd(),
        ""
      ];
    })(),
    "## Reason (why this was blocked)",
    "```text",
    args.manualReason.trimEnd(),
    "```",
    "",
    "## Instructions",
    "\u8BF7\u5B8C\u6210\u4E0A\u8FF0 Task\uFF0C\u5E76\u628A\u6267\u884C\u7ED3\u679C\u5199\u56DE result.json\u3002",
    "",
    "\u7EA6\u675F\uFF1A",
    "- \u5141\u8BB8\u4FEE\u6539\u4EE3\u7801/\u8FD0\u884C\u547D\u4EE4/\u8865\u5145\u6D4B\u8BD5/\u8FDB\u884C\u5BA1\u67E5\u7B49\uFF08\u6309 Task.type \u51B3\u5B9A\uFF09\u3002",
    "- \u8F93\u51FA\u5FC5\u987B\u662F\u7EAF JSON\uFF08\u4E0D\u8981 Markdown/\u89E3\u91CA\u6027\u6587\u672C\uFF09\u3002",
    "- status=success \u65F6\u5FC5\u987B\u63D0\u4F9B output.actualWork\uFF08\u975E\u7A7A\u5B57\u7B26\u4E32\uFF09\u3002",
    "- kind \u5B57\u6BB5\u63A8\u8350\uFF1A'manual-task'\uFF08\u7528\u4E8E\u66F4\u5F3A\u6821\u9A8C/\u8BCA\u65AD\uFF09\u3002",
    "",
    `\u5199\u5165\u76EE\u6807\uFF1A${args.resultPath}`,
    "",
    "\u793A\u4F8B\uFF08\u5FC5\u987B\u662F JSON\uFF0C\u4E0D\u8981\u5305\u88F9 Markdown\uFF09\uFF1A",
    "```json",
    JSON.stringify(schemaExample, null, 2),
    "```",
    ""
  ].join("\n");
}
function readPackageJsonScripts() {
  const pkgPath = path8.join(process.cwd(), "package.json");
  if (!fs7.existsSync(pkgPath)) return null;
  try {
    const raw = fs7.readFileSync(pkgPath, "utf-8");
    const parsed = JSON.parse(raw);
    const scripts = parsed?.scripts;
    if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts)) return {};
    const out = {};
    for (const [k, v] of Object.entries(scripts)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}
function writeGateEvidence(taskBookId, stepId, gateId, payload) {
  try {
    const safeTaskBookId = sanitizeForFilename(taskBookId);
    const outDir = path8.join(process.cwd(), ".codebuddy", "reports", "gates", safeTaskBookId);
    ensureDir2(outDir);
    const fileName = `${safeTimestampForFilename()}.${sanitizeForFilename(stepId)}.${sanitizeForFilename(gateId)}.json`;
    const absPath = path8.join(outDir, fileName);
    fs7.writeFileSync(absPath, JSON.stringify(payload, null, 2), "utf-8");
    return toPosixPath(path8.relative(process.cwd(), absPath));
  } catch {
    return void 0;
  }
}
async function runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, context) {
  const results = [];
  const gates = getStepGates(spec, step);
  for (const gate of gates) {
    const required = gate.required !== false;
    const startedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (approved.has(gate.id)) {
      const evidencePath2 = writeGateEvidence(taskBookId, step.id, gate.id, {
        schemaVersion: 1,
        event: "gate",
        gateId: gate.id,
        gateType: gate.type,
        stepId: step.id,
        required,
        approved: true,
        passed: true,
        skipped: false,
        startedAt,
        endedAt: (/* @__PURE__ */ new Date()).toISOString(),
        commandRuns: [],
        ...context ?? {}
      });
      const r2 = { gateId: gate.id, passed: true, message: "approved by user", evidencePath: evidencePath2 };
      results.push(r2);
      gateResults.set(gate.id, r2);
      manager.logChange(taskBookId, null, "modified", `gate approved: ${gate.id}`, void 0, {
        event: "gate",
        gateId: gate.id,
        stepId: step.id,
        passed: true,
        approved: true,
        evidencePath: evidencePath2,
        ...context ?? {}
      });
      continue;
    }
    if (gate.type !== "checks") {
      if (required) {
        const evidencePath3 = writeGateEvidence(taskBookId, step.id, gate.id, {
          schemaVersion: 1,
          event: "gate",
          gateId: gate.id,
          gateType: gate.type,
          stepId: step.id,
          required,
          approved: false,
          passed: false,
          skipped: false,
          startedAt,
          endedAt: (/* @__PURE__ */ new Date()).toISOString(),
          failureReason: `unsupported gate.type: ${gate.type}`,
          ...context ?? {}
        });
        const r3 = { gateId: gate.id, passed: false, message: `unsupported gate.type: ${gate.type}`, evidencePath: evidencePath3 };
        results.push(r3);
        gateResults.set(gate.id, r3);
        manager.logChange(taskBookId, null, "modified", `gate failed: ${gate.id}`, void 0, {
          event: "gate",
          gateId: gate.id,
          stepId: step.id,
          passed: false,
          evidencePath: evidencePath3,
          ...context ?? {}
        });
        return { ok: false, gateResults: results };
      }
      const skipReason = `unsupported gate.type: ${gate.type}`;
      const evidencePath2 = writeGateEvidence(taskBookId, step.id, gate.id, {
        schemaVersion: 1,
        event: "gate",
        gateId: gate.id,
        gateType: gate.type,
        stepId: step.id,
        required,
        approved: false,
        passed: true,
        skipped: true,
        skipReason,
        startedAt,
        endedAt: (/* @__PURE__ */ new Date()).toISOString(),
        ...context ?? {}
      });
      const r2 = { gateId: gate.id, passed: true, skipped: true, message: `skipped: ${skipReason}`, evidencePath: evidencePath2 };
      results.push(r2);
      gateResults.set(gate.id, r2);
      manager.logChange(taskBookId, null, "modified", `gate skipped: ${gate.id}`, void 0, {
        event: "gate",
        gateId: gate.id,
        stepId: step.id,
        passed: true,
        skipped: true,
        skipReason,
        evidencePath: evidencePath2,
        ...context ?? {}
      });
      continue;
    }
    const params = gate.params ?? {};
    const rawCommands = Array.isArray(params.commands) ? params.commands.filter((c) => typeof c === "string" && c.trim().length > 0) : [];
    const npmScripts = Array.isArray(params.npmScripts) ? params.npmScripts.filter((s) => typeof s === "string" && s.trim().length > 0) : [];
    const failIfMissing = typeof params.failIfMissing === "boolean" ? Boolean(params.failIfMissing) : required;
    const writeEvidence = typeof params.writeEvidence === "boolean" ? Boolean(params.writeEvidence) : true;
    const budgetMinutes = typeof params?.budgetMinutes === "number" ? Number(params.budgetMinutes) : void 0;
    const scripts = npmScripts.length > 0 ? readPackageJsonScripts() : null;
    const missingScripts = [];
    const scriptCommands = [];
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
    const commandRuns = [];
    if (missingScripts.length > 0 && failIfMissing) {
      const message = `missing npm scripts: ${missingScripts.join(", ")}`;
      const evidencePath2 = writeEvidence ? writeGateEvidence(taskBookId, step.id, gate.id, {
        schemaVersion: 1,
        event: "gate",
        gateId: gate.id,
        gateType: gate.type,
        stepId: step.id,
        required,
        approved: false,
        passed: false,
        skipped: false,
        startedAt,
        endedAt: (/* @__PURE__ */ new Date()).toISOString(),
        budgetMinutes,
        commands,
        missingScripts,
        commandRuns: [],
        failureReason: message,
        ...context ?? {}
      }) : void 0;
      const r2 = { gateId: gate.id, passed: false, message, evidencePath: evidencePath2 };
      results.push(r2);
      gateResults.set(gate.id, r2);
      manager.logChange(taskBookId, null, "modified", `gate failed: ${gate.id}`, void 0, {
        event: "gate",
        gateId: gate.id,
        stepId: step.id,
        passed: false,
        budgetMinutes,
        missingScripts,
        evidencePath: evidencePath2,
        ...context ?? {}
      });
      console.log(`[Gate] ${required ? "\u274C" : "\u26A0\uFE0F"} ${gate.id} \u5931\u8D25: ${message}`);
      if (required) return { ok: false, gateResults: results };
      continue;
    }
    if (commands.length === 0) {
      if (required) {
        const message = `gate ${gate.id} \u7F3A\u5C11 commands / npmScripts`;
        const evidencePath3 = writeEvidence ? writeGateEvidence(taskBookId, step.id, gate.id, {
          schemaVersion: 1,
          event: "gate",
          gateId: gate.id,
          gateType: gate.type,
          stepId: step.id,
          required,
          approved: false,
          passed: false,
          skipped: false,
          startedAt,
          endedAt: (/* @__PURE__ */ new Date()).toISOString(),
          budgetMinutes,
          commands,
          missingScripts,
          commandRuns: [],
          failureReason: message,
          ...context ?? {}
        }) : void 0;
        const r3 = { gateId: gate.id, passed: false, message, evidencePath: evidencePath3 };
        results.push(r3);
        gateResults.set(gate.id, r3);
        manager.logChange(taskBookId, null, "modified", `gate failed: ${gate.id}`, void 0, {
          event: "gate",
          gateId: gate.id,
          stepId: step.id,
          passed: false,
          budgetMinutes,
          missingScripts,
          evidencePath: evidencePath3,
          ...context ?? {}
        });
        console.log(`[Gate] \u274C ${gate.id} \u5931\u8D25: ${message}`);
        return { ok: false, gateResults: results };
      }
      const skipReason = missingScripts.length > 0 ? `npm scripts not found: ${missingScripts.join(", ")}` : "empty commands";
      const evidencePath2 = writeEvidence ? writeGateEvidence(taskBookId, step.id, gate.id, {
        schemaVersion: 1,
        event: "gate",
        gateId: gate.id,
        gateType: gate.type,
        stepId: step.id,
        required,
        approved: false,
        passed: true,
        skipped: true,
        skipReason,
        startedAt,
        endedAt: (/* @__PURE__ */ new Date()).toISOString(),
        budgetMinutes,
        missingScripts,
        commandRuns: [],
        ...context ?? {}
      }) : void 0;
      const r2 = { gateId: gate.id, passed: true, skipped: true, message: `skipped: ${skipReason}`, evidencePath: evidencePath2 };
      results.push(r2);
      gateResults.set(gate.id, r2);
      manager.logChange(taskBookId, null, "modified", `gate skipped: ${gate.id}`, void 0, {
        event: "gate",
        gateId: gate.id,
        stepId: step.id,
        passed: true,
        skipped: true,
        skipReason,
        budgetMinutes,
        missingScripts,
        evidencePath: evidencePath2,
        ...context ?? {}
      });
      console.log(`[Gate] \u23ED ${gate.id} skipped: ${skipReason}`);
      continue;
    }
    let failedCommand = null;
    for (const cmd of commands) {
      console.log(`[Gate] \u25B6 ${gate.id}: ${cmd}`);
      const r2 = runShellCommand(cmd);
      commandRuns.push({ command: cmd, ok: r2.ok, code: r2.code, durationMs: r2.durationMs });
      if (!r2.ok) {
        failedCommand = {
          command: cmd,
          stdout: r2.stdout.slice(0, GATE_EVIDENCE_OUTPUT_LIMIT),
          stderr: r2.stderr.slice(0, GATE_EVIDENCE_OUTPUT_LIMIT)
        };
        break;
      }
    }
    const passed = failedCommand === null;
    const evidencePath = writeEvidence ? writeGateEvidence(taskBookId, step.id, gate.id, {
      schemaVersion: 1,
      event: "gate",
      gateId: gate.id,
      gateType: gate.type,
      stepId: step.id,
      required,
      approved: false,
      passed,
      skipped: false,
      startedAt,
      endedAt: (/* @__PURE__ */ new Date()).toISOString(),
      budgetMinutes,
      commands,
      missingScripts,
      commandRuns,
      failedCommand,
      ...context ?? {}
    }) : void 0;
    const r = passed ? { gateId: gate.id, passed: true, evidencePath } : { gateId: gate.id, passed: false, message: `command failed: ${failedCommand?.command ?? ""}`, evidencePath };
    results.push(r);
    gateResults.set(gate.id, r);
    manager.logChange(taskBookId, null, "modified", `gate ${passed ? "passed" : "failed"}: ${gate.id}`, void 0, {
      event: "gate",
      gateId: gate.id,
      stepId: step.id,
      passed,
      budgetMinutes,
      commandRuns,
      missingScripts,
      evidencePath,
      stderr: passed ? void 0 : failedCommand?.stderr?.slice(0, 2e3),
      ...context ?? {}
    });
    console.log(`[Gate] ${passed ? "\u2705" : required ? "\u274C" : "\u26A0\uFE0F"} ${gate.id} ${passed ? "\u901A\u8FC7" : "\u5931\u8D25"}${!required && !passed ? "\uFF08optional\uFF09" : ""}`);
    if (!passed && required) return { ok: false, gateResults: results };
  }
  return { ok: true, gateResults: results };
}
function ensureDir2(dirPath) {
  if (!fs7.existsSync(dirPath)) {
    fs7.mkdirSync(dirPath, { recursive: true });
  }
}
function runNodeScript(scriptPath, args) {
  const res = (0, import_child_process3.spawnSync)(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf-8",
    stdio: "pipe"
  });
  return {
    ok: res.status === 0,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    code: res.status
  };
}
function runShellCommand(command) {
  const start = Date.now();
  const res = (0, import_child_process3.spawnSync)(command, [], {
    cwd: process.cwd(),
    shell: true,
    encoding: "utf-8",
    stdio: "pipe"
  });
  const durationMs = Date.now() - start;
  return {
    ok: res.status === 0,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    code: res.status,
    durationMs
  };
}
async function runWorkflow(taskBookId, options) {
  const manager = new TaskBookManager(process.cwd());
  const taskBook = manager.load(taskBookId);
  if (!taskBook) {
    throw new Error(`TaskBook not found: ${taskBookId}`);
  }
  if (taskBook.status !== "confirmed" && taskBook.status !== "executing") {
    throw new Error(`TaskBook \u5FC5\u987B\u662F confirmed/executing \u624D\u80FD\u6267\u884C\u3002\u5F53\u524D\u72B6\u6001: ${taskBook.status}`);
  }
  const workflowPath = options.workflowPath ?? path8.join(process.cwd(), ".codebuddy/workflows/default.workflow.json");
  if (!fs7.existsSync(workflowPath)) {
    throw new Error(`workflow \u6587\u4EF6\u4E0D\u5B58\u5728: ${workflowPath}`);
  }
  const spec = loadWorkflowSpec(workflowPath);
  const orderedSteps = topologicalSteps(spec);
  const approved = options.approvedGates ?? /* @__PURE__ */ new Set();
  const gateResults = /* @__PURE__ */ new Map();
  const maxParallelFromPolicy = getPolicyMaxParallel(spec);
  const maxParallel = options.maxParallelTasks ?? maxParallelFromPolicy ?? 1;
  const conflictStrategy = getPolicyConflictStrategy(spec) ?? "allow";
  manager.updateStatus(taskBookId, "executing");
  manager.logChange(taskBookId, null, "modified", `\u5F00\u59CB\u6267\u884C workflow: ${spec.id}@${spec.version}`, { workflowPath }, { workflowId: spec.id });
  const executor = new TaskExecutor(manager, { maxParallel, runtime: createDefaultRuntime() });
  const buildFixPolicy = getPolicyBuildFix(spec);
  let buildFixRetryCount = 0;
  let stepIdx = 0;
  while (stepIdx < orderedSteps.length) {
    const step = orderedSteps[stepIdx];
    console.log(`
[Workflow] \u25B6 ${step.id}: ${step.title} (${step.type})`);
    const currentForSkip = manager.load(taskBookId);
    if (currentForSkip && evaluateSkipWhen(step.skipWhen, currentForSkip)) {
      console.log(`[Workflow] \u23ED ${step.id}: \u6761\u4EF6\u8DF3\u8FC7 (${step.skipWhen})`);
      manager.logChange(taskBookId, null, "modified", `workflow step skipped: ${step.id} (${step.skipWhen})`);
      stepIdx++;
      continue;
    }
    if (step.type === "analyze_project") {
      const moduleMapper = path8.join(process.cwd(), ".codebuddy/scripts/module-mapper.js");
      const structureAnalyzer = path8.join(process.cwd(), ".codebuddy/scripts/structure-analyzer.js");
      if (fs7.existsSync(moduleMapper)) {
        const r = runNodeScript(moduleMapper, [".", "--mode", "summary", "--output", "json"]);
        if (!r.ok) throw new Error(`module-mapper \u6267\u884C\u5931\u8D25: ${r.stderr || r.stdout}`);
      }
      if (fs7.existsSync(structureAnalyzer)) {
        const r = runNodeScript(structureAnalyzer, [".", "--mode", "summary", "--output", "json"]);
        if (!r.ok) throw new Error(`structure-analyzer \u6267\u884C\u5931\u8D25: ${r.stderr || r.stdout}`);
      }
      manager.logChange(taskBookId, null, "modified", "\u5DF2\u751F\u6210\u9879\u76EE\u7ED3\u6784/\u6A21\u5757\u56FE\u8C31 reports", void 0, {
        reports: [".codebuddy/reports/architecture/latest.json", ".codebuddy/reports/modules/latest.json"]
      });
      stepIdx++;
      continue;
    }
    if (step.type === "create_taskbook") {
      manager.logChange(taskBookId, null, "modified", "workflow step: create_taskbook (no-op, TaskBook \u5DF2\u5B58\u5728)");
      stepIdx++;
      continue;
    }
    if (step.type === "requirement_and_prd") {
      manager.logChange(taskBookId, null, "modified", "workflow step: requirement_and_prd (\u9700\u6C42\u6F84\u6E05\u4E0E PRD \u751F\u6210)");
      const prdTasks = (manager.load(taskBookId)?.tasks ?? []).filter((t) => t.status === "pending" && (t.type === "requirement" || t.type === "prd"));
      if (prdTasks.length > 0) {
        const result = await executor.executeTasks(taskBookId, {
          allowedTaskTypes: ["requirement", "prd"],
          maxParallel,
          conflictStrategy
        });
        if (result.status !== "completed") {
          console.log(`[Workflow] requirement_and_prd \u672A\u5B8C\u6210: ${result.status} ${result.message ?? ""}`);
          return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
        }
      }
      stepIdx++;
      continue;
    }
    if (step.type === "tdd_implement") {
      const allowedTaskTypes = /* @__PURE__ */ new Set(["test", "implement", "refactor", "analysis", "design"]);
      const batching = getPolicyBatching(spec);
      const hasStepGates = Array.isArray(step.gates) && step.gates.length > 0;
      if (!batching) {
        const result = await executor.executeTasks(taskBookId, {
          allowedTaskTypes: Array.from(allowedTaskTypes),
          maxParallel,
          conflictStrategy
        });
        if (result.status !== "completed") {
          console.log(`[Workflow] implement_tasks \u672A\u5B8C\u6210: ${result.status} ${result.message ?? ""}`);
          return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
        }
        if (hasStepGates) {
          const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults);
          if (!ok) {
            return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
          }
        }
        stepIdx++;
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
        const pendingAllowed = current.tasks.filter((t) => t.status === "pending" && allowedTaskTypes.has(t.type));
        const blockedAllowed = current.tasks.filter((t) => t.status === "blocked" && allowedTaskTypes.has(t.type));
        if (pendingAllowed.length === 0) {
          if (hasStepGates && batchIndex === 0) {
            const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
              eventContext: "no_tasks",
              riskTier
            });
            if (!ok) return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
          }
          if (blockedAllowed.length > 0) {
            console.log(`[Workflow] implement_tasks \u5B58\u5728\u963B\u585E\u4EFB\u52A1\uFF08${blockedAllowed.length}\uFF09`);
            return { taskBook: current, gateResults: Array.from(gateResults.values()) };
          }
          break;
        }
        const completedTaskIds = new Set(
          current.tasks.filter((t) => t.status === "done" || t.status === "skipped").map((t) => t.id)
        );
        const runnable = pendingAllowed.filter((t) => t.dependencies.every((depId) => completedTaskIds.has(depId)));
        if (runnable.length === 0) {
          console.log("[Workflow] implement_tasks \u6CA1\u6709\u53EF\u6267\u884C\u4EFB\u52A1\uFF08\u7B49\u5F85\u4F9D\u8D56\u5B8C\u6210\uFF09");
          return { taskBook: current, gateResults: Array.from(gateResults.values()) };
        }
        const batchTasks = selectBatchTasks(runnable, maxFiles);
        batchIndex += 1;
        manager.logChange(taskBookId, null, "modified", `batch start: ${step.id} #${batchIndex}`, void 0, {
          event: "batch",
          stepId: step.id,
          batchIndex,
          riskTier,
          maxFiles,
          taskIds: batchTasks.map((t) => t.id)
        });
        const result = await executor.executeTasks(taskBookId, {
          allowedTaskTypes: Array.from(allowedTaskTypes),
          maxParallel,
          conflictStrategy,
          allowedTaskIds: batchTasks.map((t) => t.id)
        });
        manager.logChange(taskBookId, null, "modified", `batch end: ${step.id} #${batchIndex} (${result.status})`, void 0, {
          event: "batch",
          stepId: step.id,
          batchIndex,
          status: result.status,
          taskIds: batchTasks.map((t) => t.id)
        });
        if (result.status !== "completed") {
          console.log(`[Workflow] implement_tasks batch \u672A\u5B8C\u6210: ${result.status} ${result.message ?? ""}`);
          return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
        }
        batchesSinceGate += 1;
        const pendingLeft = (manager.load(taskBookId)?.tasks ?? []).filter((t) => t.status === "pending" && allowedTaskTypes.has(t.type)).length;
        const shouldRunGates = hasStepGates && (batchesSinceGate >= smokeEveryBatches || pendingLeft === 0);
        if (shouldRunGates) {
          const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
            eventContext: "batch_gate",
            batchIndex,
            riskTier
          });
          if (!ok) return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
          batchesSinceGate = 0;
        }
      }
      stepIdx++;
      continue;
    }
    if (step.type === "build_and_fix") {
      const buildFixTasks = (manager.load(taskBookId)?.tasks ?? []).filter((t) => t.status === "pending" && t.type === "build-fix");
      if (buildFixTasks.length > 0) {
        const result = await executor.executeTasks(taskBookId, {
          allowedTaskTypes: ["build-fix"],
          maxParallel,
          conflictStrategy
        });
        if (result.status !== "completed") {
          console.log(`[Workflow] build_and_fix \u4EFB\u52A1\u672A\u5B8C\u6210: ${result.status} ${result.message ?? ""}`);
          return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
        }
      }
      const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
        eventContext: "build_and_fix_gate"
      });
      if (!ok) {
        buildFixRetryCount++;
        const retryTargetId = buildFixPolicy.retryFromStep;
        const retryTargetIdx = orderedSteps.findIndex((s) => s.id === retryTargetId);
        if (retryTargetIdx >= 0 && buildFixRetryCount < buildFixPolicy.maxRounds) {
          console.log(`[Workflow] \u27F2 \u6784\u5EFA\u5931\u8D25\uFF0C\u56DE\u6EDA\u5230 ${retryTargetId}\uFF08\u7B2C ${buildFixRetryCount}/${buildFixPolicy.maxRounds} \u6B21\u91CD\u8BD5\uFF09`);
          manager.logChange(
            taskBookId,
            null,
            "modified",
            `build_and_fix gate \u5931\u8D25\uFF0C\u56DE\u6EDA\u5230 ${retryTargetId}\uFF08\u91CD\u8BD5 ${buildFixRetryCount}/${buildFixPolicy.maxRounds}\uFF09`,
            void 0,
            { event: "build_fix_retry", retryCount: buildFixRetryCount, retryFromStep: retryTargetId }
          );
          stepIdx = retryTargetIdx;
          continue;
        }
        if (buildFixPolicy.escalateToHuman) {
          console.log(`[Workflow] \u26D4 \u6784\u5EFA\u4FEE\u590D\u5DF2\u8FBE\u6700\u5927\u91CD\u8BD5\u6B21\u6570\uFF08${buildFixPolicy.maxRounds}\uFF09\uFF0C\u9700\u8981\u4EBA\u5DE5\u4ECB\u5165`);
          manager.logChange(
            taskBookId,
            null,
            "modified",
            `build_and_fix \u8FBE\u5230\u6700\u5927\u91CD\u8BD5\u6B21\u6570 ${buildFixPolicy.maxRounds}\uFF0C\u5347\u7EA7\u4E3A\u4EBA\u5DE5\u5904\u7406`,
            void 0,
            { event: "build_fix_escalate", retryCount: buildFixRetryCount }
          );
        }
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
      }
      buildFixRetryCount = 0;
      stepIdx++;
      continue;
    }
    if (step.type === "run_tests") {
      const tasksResult = await executor.executeTasks(taskBookId, { allowedTaskTypes: ["test"], maxParallel, conflictStrategy });
      if (tasksResult.status !== "completed") {
        console.log(`[Workflow] test \u4EFB\u52A1\u672A\u5B8C\u6210: ${tasksResult.status} ${tasksResult.message ?? ""}`);
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
      }
      const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
        eventContext: "run_tests_gate"
      });
      if (!ok) return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
      stepIdx++;
      continue;
    }
    if (step.type === "code_review") {
      const tasksResult = await executor.executeTasks(taskBookId, { allowedTaskTypes: ["review"], maxParallel, conflictStrategy });
      if (tasksResult.status !== "completed") {
        console.log(`[Workflow] review \u4EFB\u52A1\u672A\u5B8C\u6210: ${tasksResult.status} ${tasksResult.message ?? ""}`);
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
      }
      const gates = getStepGates(spec, step);
      for (const gate of gates) {
        if (approved.has(gate.id)) {
          gateResults.set(gate.id, { gateId: gate.id, passed: true, message: "approved by user" });
          continue;
        }
        if (gate.required === false) {
          continue;
        }
        gateResults.set(gate.id, { gateId: gate.id, passed: false, message: "manual review required" });
        console.log(`[Gate] \u23F8 ${gate.id} \u9700\u8981\u4EBA\u5DE5\u5BA1\u67E5\u3002\u53EF\u4F7F\u7528 --approve ${gate.id} \u7EE7\u7EED\u3002`);
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
      }
      stepIdx++;
      continue;
    }
    if (step.type === "acceptance_and_archive") {
      const current = manager.load(taskBookId);
      if (!current) throw new Error(`TaskBook not found: ${taskBookId}`);
      const allDone = current.tasks.every((t) => t.status === "done" || t.status === "skipped");
      if (!allDone) {
        console.log("[Workflow] \u4ECD\u6709\u672A\u5B8C\u6210\u4EFB\u52A1\uFF0C\u65E0\u6CD5\u9A8C\u6536\u5F52\u6863\u3002");
        return { taskBook: current, gateResults: Array.from(gateResults.values()) };
      }
      const requiredGates = (spec.gates ?? []).filter((g) => g.required !== false);
      const failedRequired = requiredGates.filter((g) => !gateResults.get(g.id)?.passed && !approved.has(g.id));
      if (failedRequired.length > 0) {
        console.log(`[Workflow] \u4ECD\u6709\u672A\u901A\u8FC7\u7684\u8D28\u91CF\u95F8\u95E8: ${failedRequired.map((g) => g.id).join(", ")}`);
        return { taskBook: current, gateResults: Array.from(gateResults.values()) };
      }
      const report = manager.generateAcceptanceReport(taskBookId);
      if (report) {
        const outDir = path8.join(process.cwd(), ".codebuddy/reports/taskbooks");
        ensureDir2(outDir);
        const outPath = path8.join(outDir, `${taskBookId}.acceptance.json`);
        fs7.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
        console.log(`[Workflow] \u2705 \u5DF2\u751F\u6210\u9A8C\u6536\u62A5\u544A: .codebuddy/reports/taskbooks/${taskBookId}.acceptance.json`);
      }
      manager.updateStatus(taskBookId, "completed");
      console.log("[Workflow] \u2705 TaskBook \u5DF2\u5B8C\u6210\u5E76\u5F52\u6863\u5230 history");
      return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
    }
    console.log(`[Workflow] \u26A0 \u672A\u8BC6\u522B\u7684 step.type: ${step.type}\uFF08\u8DF3\u8FC7\uFF09`);
    stepIdx++;
  }
  return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()) };
}
function createDefaultRuntime() {
  const cwd = process.cwd();
  const localAgentsDir = path8.join(cwd, ".codebuddy/agents");
  const builtinAgentsDir = path8.join(cwd, "agents");
  const hasLocal = fs7.existsSync(localAgentsDir);
  const hasBuiltin = fs7.existsSync(builtinAgentsDir);
  if (!hasLocal && !hasBuiltin) {
    return void 0;
  }
  try {
    const runtime = createAgentRuntime({
      projectRoot: cwd,
      agentsDir: hasLocal ? ".codebuddy/agents" : "agents",
      fallbackAgentsDir: hasLocal && hasBuiltin ? "agents" : void 0,
      verbose: false
    });
    runtime.loadAll();
    return runtime;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[TaskExecutor] AgentRuntime \u521D\u59CB\u5316\u8DF3\u8FC7: ${msg}`);
    return void 0;
  }
}
function parseCliArgs(args) {
  const parsed = {
    help: false,
    taskBookId: null,
    workflowPath: void 0,
    approvedGates: /* @__PURE__ */ new Set(),
    maxParallel: void 0,
    tasksOnly: false
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--workflow" && args[i + 1]) {
      parsed.workflowPath = args[++i];
      continue;
    }
    if (arg === "--approve" && args[i + 1]) {
      parsed.approvedGates.add(args[++i]);
      continue;
    }
    if (arg === "--max-parallel" && args[i + 1]) {
      parsed.maxParallel = parseInt(args[++i], 10);
      continue;
    }
    if (arg === "--tasks-only") {
      parsed.tasksOnly = true;
      continue;
    }
    if (!arg.startsWith("-") && !parsed.taskBookId) {
      parsed.taskBookId = arg;
    }
  }
  return parsed;
}
async function main4() {
  const args = process.argv.slice(2);
  const parsed = parseCliArgs(args);
  if (parsed.help || !parsed.taskBookId) {
    showHelp4();
    process.exit(parsed.taskBookId ? 0 : 1);
  }
  if (parsed.tasksOnly) {
    const manager = new TaskBookManager(process.cwd());
    const executor = new TaskExecutor(manager, { maxParallel: parsed.maxParallel ?? DEFAULT_CONFIG.maxParallel, runtime: createDefaultRuntime() });
    const result = await executor.executeTasks(parsed.taskBookId, { maxParallel: parsed.maxParallel });
    if (result.status === "completed") {
      manager.updateStatus(parsed.taskBookId, "completed");
      process.exit(0);
    }
    console.error(`[TaskExecutor] \u672A\u5B8C\u6210: ${result.status} ${result.message ?? ""}`);
    process.exit(2);
  }
  try {
    const { taskBook } = await runWorkflow(parsed.taskBookId, {
      workflowPath: parsed.workflowPath,
      approvedGates: parsed.approvedGates,
      maxParallelTasks: parsed.maxParallel
    });
    if (taskBook?.status === "completed") {
      process.exit(0);
    }
    console.log("[Workflow] \u23F8 \u672A\u5B8C\u6210\uFF08\u53EF\u80FD\u5B58\u5728 blocked/\u5F85\u4EBA\u5DE5 gate\uFF09\uFF0C\u8BF7\u5904\u7406\u540E\u91CD\u8BD5\u3002");
    process.exit(2);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[Workflow] Fatal Error: ${message}`);
    process.exit(1);
  }
}
if (isDirectCliEntry("task-executor.js")) {
  main4().catch((e) => {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[Workflow] Fatal Error: ${message}`);
    process.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TaskExecutor,
  createTaskExecutor
});
