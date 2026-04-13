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

// scripts/src/taskbook-manager.ts
var taskbook_manager_exports = {};
__export(taskbook_manager_exports, {
  TaskBookManager: () => TaskBookManager,
  taskBookManager: () => taskBookManager
});
module.exports = __toCommonJS(taskbook_manager_exports);
var fs2 = __toESM(require("fs"));
var path4 = __toESM(require("path"));

// scripts/src/lib/cli-entry.ts
var path = __toESM(require("path"));
function isDirectCliEntry(expectedFileNames) {
  const argvPath = process.argv[1];
  if (!argvPath) return false;
  const actual = path.basename(argvPath).toLowerCase();
  const expected = Array.isArray(expectedFileNames) ? expectedFileNames : [expectedFileNames];
  return expected.some((name) => actual === name.toLowerCase());
}

// scripts/src/lib/install-roots.ts
var path3 = __toESM(require("path"));

// scripts/src/lib/install-sync.ts
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var INSTALL_LOCK_STALE_MS = 5 * 60 * 1e3;
function readInstallState(targetDir, logger) {
  const installStatePath = path2.join(targetDir, ".codebuddy", "install.json");
  if (!fs.existsSync(installStatePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(installStatePath, "utf-8"));
  } catch (error) {
    logger?.warn(`\u8BFB\u53D6 install.json \u5931\u8D25: ${error.message}`);
    return null;
  }
}

// scripts/src/lib/install-roots.ts
function normalizeRelativeRoot(relativeRoot) {
  if (typeof relativeRoot !== "string") return null;
  const normalized = relativeRoot.trim().replace(/\\/g, "/");
  return normalized ? normalized : null;
}
function dedupeRelativeRoots(relativeRoots) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const relativeRoot of relativeRoots) {
    const normalized = normalizeRelativeRoot(relativeRoot);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
function resolveInstalledAgentsRootDir(installState) {
  if (!installState) return null;
  return normalizeRelativeRoot(installState.outputs.agentsRootDir) || (installState.stats.agents > 0 ? ".codebuddy/agents" : null);
}
function getProjectInstallState(projectRoot) {
  return readInstallState(projectRoot);
}
function getProjectAgentRootCandidates(projectRoot, installState) {
  const resolvedInstallState = typeof installState === "undefined" ? getProjectInstallState(projectRoot) : installState;
  return dedupeRelativeRoots([
    resolveInstalledAgentsRootDir(resolvedInstallState),
    ".codebuddy/agents",
    "agents"
  ]);
}
function getProjectAgentRootCandidatePaths(projectRoot, installState) {
  return getProjectAgentRootCandidates(projectRoot, installState).map((relativeRoot) => path3.join(projectRoot, relativeRoot));
}
function listAgentDefinitionCandidatePaths(projectRoot, agentId, installState) {
  return getProjectAgentRootCandidatePaths(projectRoot, installState).map((rootDir) => path3.join(rootDir, agentId, "AGENT.md"));
}

// scripts/src/taskbook-manager.ts
var TASKBOOK_BASE_DIR = ".codebuddy/taskbooks";
var ACTIVE_DIR = "active";
var HISTORY_DIR = "history";
var CONTEXT_SNAPSHOTS_DIR = ".codebuddy/context-snapshots";
var LOCKS_DIR = ".codebuddy/taskbooks/.locks";
var AGENT_CALLS_DIR = ".codebuddy/agent-calls";
var LOCK_STALE_MS = 2 * 60 * 1e3;
var LOCK_TIMEOUT_MS = 10 * 1e3;
var LOCK_RETRY_MS = 80;
var TASKBOOK_FILE_DELETE_RETRY_MS = 80;
var TASKBOOK_FILE_DELETE_MAX_RETRIES = 6;
var TASKBOOK_FILE_DELETE_RETRY_CODES = /* @__PURE__ */ new Set(["EBUSY", "EMFILE", "ENFILE", "EPERM"]);
var IN_PROCESS_LOCK_DEPTHS = /* @__PURE__ */ new Map();
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
  if (!fs2.existsSync(dirPath)) {
    fs2.mkdirSync(dirPath, { recursive: true });
  }
}
function isTerminalTaskBookStatus(status) {
  return status === "completed" || status === "aborted";
}
var TaskBookManager = class {
  constructor(projectRoot = process.cwd(), options = {}) {
    this.baseDir = projectRoot;
    this.lockTimeoutMs = options.lockTimeoutMs ?? LOCK_TIMEOUT_MS;
    this.lockRetryMs = options.lockRetryMs ?? LOCK_RETRY_MS;
  }
  getProjectRoot() {
    return this.baseDir;
  }
  /**
   * 获取活跃任务书目录
   */
  getActiveDir() {
    return path4.join(this.baseDir, TASKBOOK_BASE_DIR, ACTIVE_DIR);
  }
  /**
   * 获取历史任务书目录
   */
  getHistoryDir() {
    return path4.join(this.baseDir, TASKBOOK_BASE_DIR, HISTORY_DIR);
  }
  getActiveFilePath(taskBookId) {
    return path4.join(this.getActiveDir(), `${taskBookId}.json`);
  }
  getHistoryFilePath(taskBookId) {
    return path4.join(this.getHistoryDir(), `${taskBookId}.json`);
  }
  /**
   * 获取上下文快照目录
   */
  getContextSnapshotsDir() {
    return path4.join(this.baseDir, CONTEXT_SNAPSHOTS_DIR);
  }
  /**
   * 创建新的 TaskBook
   */
  getLocksDir() {
    return path4.join(this.baseDir, LOCKS_DIR);
  }
  getLockPath(taskBookId) {
    return path4.join(this.getLocksDir(), `${taskBookId}.lock`);
  }
  cleanupLockFile(lockPath) {
    for (let attempt = 0; attempt < TASKBOOK_FILE_DELETE_MAX_RETRIES; attempt++) {
      try {
        if (fs2.existsSync(lockPath)) {
          fs2.unlinkSync(lockPath);
        }
        return;
      } catch (error) {
        const err = error;
        if (err?.code === "ENOENT") {
          return;
        }
        if (TASKBOOK_FILE_DELETE_RETRY_CODES.has(err?.code || "") && attempt < TASKBOOK_FILE_DELETE_MAX_RETRIES - 1) {
          try {
            fs2.rmSync(lockPath, { force: true });
            return;
          } catch (rmError) {
            const rmErr = rmError;
            if (rmErr?.code === "ENOENT") {
              return;
            }
          }
          sleepSync(TASKBOOK_FILE_DELETE_RETRY_MS);
          continue;
        }
        try {
          fs2.rmSync(lockPath, { force: true });
        } catch (rmError) {
          const rmErr = rmError;
          if (rmErr?.code === "ENOENT") {
            return;
          }
        }
        return;
      }
    }
  }
  cleanupArchivedActiveFile(filePath) {
    for (let attempt = 0; attempt < TASKBOOK_FILE_DELETE_MAX_RETRIES; attempt++) {
      try {
        if (!fs2.existsSync(filePath)) {
          return true;
        }
        fs2.unlinkSync(filePath);
        return true;
      } catch (error) {
        const err = error;
        if (err?.code === "ENOENT") {
          return true;
        }
        if (TASKBOOK_FILE_DELETE_RETRY_CODES.has(err?.code || "") && attempt < TASKBOOK_FILE_DELETE_MAX_RETRIES - 1) {
          try {
            fs2.rmSync(filePath, { force: true });
            return true;
          } catch (rmError) {
            const rmErr = rmError;
            if (rmErr?.code === "ENOENT") {
              return true;
            }
          }
          sleepSync(TASKBOOK_FILE_DELETE_RETRY_MS);
          continue;
        }
        try {
          fs2.rmSync(filePath, { force: true });
          return true;
        } catch (rmError) {
          const rmErr = rmError;
          if (rmErr?.code === "ENOENT") {
            return true;
          }
        }
        return false;
      }
    }
    return !fs2.existsSync(filePath);
  }
  readTaskBookFile(filePath) {
    if (!fs2.existsSync(filePath)) {
      return null;
    }
    try {
      const content = fs2.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      return this.normalize(parsed);
    } catch {
      return null;
    }
  }
  shouldPreferHistorySnapshot(activeTaskBook, historyTaskBook) {
    if (!historyTaskBook) {
      return false;
    }
    if (!activeTaskBook) {
      return true;
    }
    const activeRevision = typeof activeTaskBook.revision === "number" ? activeTaskBook.revision : 0;
    const historyRevision = typeof historyTaskBook.revision === "number" ? historyTaskBook.revision : 0;
    if (historyRevision !== activeRevision) {
      return historyRevision > activeRevision;
    }
    const activeUpdatedAt = Date.parse(activeTaskBook.updatedAt || activeTaskBook.createdAt || "");
    const historyUpdatedAt = Date.parse(historyTaskBook.updatedAt || historyTaskBook.createdAt || "");
    if (Number.isFinite(activeUpdatedAt) && Number.isFinite(historyUpdatedAt) && historyUpdatedAt !== activeUpdatedAt) {
      return historyUpdatedAt > activeUpdatedAt;
    }
    if (isTerminalTaskBookStatus(historyTaskBook.status) && !isTerminalTaskBookStatus(activeTaskBook.status)) {
      return true;
    }
    return false;
  }
  getInProcessLockDepth(taskBookId) {
    return IN_PROCESS_LOCK_DEPTHS.get(taskBookId) ?? 0;
  }
  enterInProcessLock(taskBookId) {
    IN_PROCESS_LOCK_DEPTHS.set(taskBookId, this.getInProcessLockDepth(taskBookId) + 1);
  }
  exitInProcessLock(taskBookId) {
    const nextDepth = this.getInProcessLockDepth(taskBookId) - 1;
    if (nextDepth > 0) {
      IN_PROCESS_LOCK_DEPTHS.set(taskBookId, nextDepth);
      return;
    }
    IN_PROCESS_LOCK_DEPTHS.delete(taskBookId);
  }
  readLockOwnerPid(lockPath) {
    try {
      const raw = fs2.readFileSync(lockPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.pid === "number") {
        return parsed.pid;
      }
      return typeof parsed.ownerPid === "number" ? parsed.ownerPid : null;
    } catch {
      return null;
    }
  }
  isProcessAlive(pid) {
    if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
      return false;
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      const err = error;
      if (err?.code === "EPERM") {
        return true;
      }
      return false;
    }
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
    ensureDir(path4.dirname(lockPath));
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
        const fd = fs2.openSync(lockPath, "wx");
        this.enterInProcessLock(taskBookId);
        try {
          const payload = { pid: process.pid, createdAt: now(), taskBookId };
          fs2.writeFileSync(fd, JSON.stringify(payload, null, 2), "utf-8");
        } catch {
        }
        try {
          return fn();
        } finally {
          try {
            fs2.closeSync(fd);
          } catch {
          }
          this.cleanupLockFile(lockPath);
          this.exitInProcessLock(taskBookId);
        }
      } catch (error) {
        const err = error;
        if (err?.code !== "EEXIST") {
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
        try {
          const stat = fs2.statSync(lockPath);
          const ageMs = Date.now() - stat.mtimeMs;
          if (ageMs > LOCK_STALE_MS) {
            this.cleanupLockFile(lockPath);
            continue;
          }
        } catch {
        }
        if (Date.now() - startedAt > timeoutMs) {
          let lockInfo = "";
          try {
            lockInfo = fs2.readFileSync(lockPath, "utf-8").slice(0, 2e3);
          } catch {
          }
          const details = lockInfo ? `
lock info:
${lockInfo}` : "";
          throw new Error(`TaskBook is locked: ${taskBookId} (waited ${timeoutMs}ms)${details}`);
        }
        sleepSync(this.lockRetryMs);
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
    const dir = isTerminalTaskBookStatus(taskBook.status) ? this.getHistoryDir() : this.getActiveDir();
    ensureDir(dir);
    const filePath = path4.join(dir, `${taskBook.id}.json`);
    fs2.writeFileSync(filePath, JSON.stringify(taskBook, null, 2), "utf-8");
  }
  /**
   * 读取 TaskBook
   */
  load(id) {
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
  listActive() {
    const dir = this.getActiveDir();
    if (!fs2.existsSync(dir)) {
      return [];
    }
    const files = fs2.readdirSync(dir).filter((f) => f.endsWith(".json"));
    const activeTaskBooks = [];
    for (const fileName of files) {
      const activeTaskBook = this.readTaskBookFile(path4.join(dir, fileName));
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
      this.touch(taskBook);
      this.save(taskBook);
      if (isTerminalTaskBookStatus(status)) {
        this.cleanupArchivedActiveFile(this.getActiveFilePath(id));
      }
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
        completedAt: task.completedAt,
        handoffs: task.handoffs
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
          completedAt: task.completedAt,
          handoffs: task.handoffs
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
          scope: t.scope,
          handoffs: t.handoffs
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
        "completedAt",
        "handoffs"
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
  appendTaskHandoffs(taskBookId, taskId, handoffs, expectedRevision) {
    return this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      const task = taskBook.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      if (!Array.isArray(handoffs) || handoffs.length === 0) return taskBook;
      const normalized = handoffs.map((handoff) => ({
        ...handoff,
        deliverables: handoff.deliverables && handoff.deliverables.length > 0 ? Array.from(new Set(handoff.deliverables)) : void 0
      }));
      const before = Array.isArray(task.handoffs) ? [...task.handoffs] : [];
      task.handoffs = [...before, ...normalized];
      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId,
        changeType: "modified",
        reason: `\u8FFD\u52A0 handoff \u8BB0\u5F55 (${normalized.length})`,
        before: { handoffs: before },
        after: { handoffs: task.handoffs }
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
    const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    const gateEvents = [];
    for (const entry of taskBook.changelog) {
      const after = entry.after;
      if (!isPlainObject(after)) continue;
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
          if (!isPlainObject(r)) continue;
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
      if (!isPlainObject(after)) continue;
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
      if (!isPlainObject(after)) continue;
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
          if (!isPlainObject(a)) continue;
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
      if (!isPlainObject(after)) continue;
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
    const reportsDir = path4.join(this.baseDir, ".codebuddy", "reports");
    if (!fs2.existsSync(reportsDir)) {
      fs2.mkdirSync(reportsDir, { recursive: true });
    }
    const reportPath = path4.join(reportsDir, `final-${taskBookId}.json`);
    fs2.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
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
  if (!fs2.existsSync(filePath)) return null;
  return fs2.readFileSync(filePath, "utf-8");
}
function loadPlannerAgentDefinition(projectRoot) {
  const candidates = listAgentDefinitionCandidatePaths(projectRoot, "planner");
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
          const outDir = path4.join(process.cwd(), ".codebuddy", "reports", "taskbooks");
          ensureDir(outDir);
          const outPath = out ? path4.resolve(process.cwd(), out) : path4.join(outDir, `${taskBookId}.acceptance.json`);
          fs2.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
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
        const agentCallsDir = path4.join(process.cwd(), AGENT_CALLS_DIR);
        ensureDir(agentCallsDir);
        const promptPath = path4.join(agentCallsDir, `${requestId}.prompt.md`);
        const resultPath = path4.join(agentCallsDir, `${requestId}.result.json`);
        const agentDef = loadPlannerAgentDefinition(process.cwd());
        if (!agentDef) {
          const candidates = listAgentDefinitionCandidatePaths(process.cwd(), "planner").map((filePath) => path4.relative(process.cwd(), filePath).replace(/\\/g, "/"));
          console.error(`\u9519\u8BEF: planner AGENT.md \u672A\u627E\u5230\uFF08\u671F\u671B ${candidates.join(" \u6216 ")}\uFF09`);
          console.error("\u63D0\u793A: \u5148\u5728\u76EE\u6807\u9879\u76EE\u6267\u884C codebuddy-loader\uFF0C\u786E\u4FDD install.json \u6307\u5411\u7684 active agents root \u5DF2\u751F\u6210\u3002");
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
        fs2.writeFileSync(promptPath, prompt, "utf-8");
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
        const agentCallsDir = path4.join(process.cwd(), AGENT_CALLS_DIR);
        const resultPath = path4.join(agentCallsDir, `${requestId}.result.json`);
        if (!fs2.existsSync(resultPath)) {
          console.error(`\u9519\u8BEF: result.json \u4E0D\u5B58\u5728: ${resultPath}`);
          process.exit(1);
        }
        let result;
        try {
          result = parseAgentCallResult(fs2.readFileSync(resultPath, "utf-8"));
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TaskBookManager,
  taskBookManager
});
