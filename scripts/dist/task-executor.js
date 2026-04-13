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
  createTaskExecutor: () => createTaskExecutor,
  runWorkflow: () => runWorkflow
});
module.exports = __toCommonJS(task_executor_exports);
var fs10 = __toESM(require("fs"));
var path13 = __toESM(require("path"));
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
var fs2 = __toESM(require("fs"));
var path4 = __toESM(require("path"));

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
function resolveInstalledSkillsRootDir(installState) {
  if (!installState) return null;
  return normalizeRelativeRoot(installState.outputs.skillsRootDir) || (installState.stats.skills > 0 ? ".codebuddy/skills" : null);
}
function resolveInstalledAgentsRootDir(installState) {
  if (!installState) return null;
  return normalizeRelativeRoot(installState.outputs.agentsRootDir) || (installState.stats.agents > 0 ? ".codebuddy/agents" : null);
}
function resolveInstalledRulesCacheRootDir(installState) {
  if (!installState) return null;
  const hasInstalledRuleCache = installState.stats.layer1Rules > 0 || installState.stats.layer2Indexes > 0 || installState.stats.layer3Indexes > 0;
  return hasInstalledRuleCache ? ".codebuddy/rules_cache" : null;
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
function getProjectSkillRootCandidates(projectRoot, installState) {
  const resolvedInstallState = typeof installState === "undefined" ? getProjectInstallState(projectRoot) : installState;
  return dedupeRelativeRoots([
    resolveInstalledSkillsRootDir(resolvedInstallState),
    ".codebuddy/skills",
    ".codebuddy/custom-skills",
    "custom-skills"
  ]);
}
function getProjectRuleRootCandidates(projectRoot, installState) {
  const resolvedInstallState = typeof installState === "undefined" ? getProjectInstallState(projectRoot) : installState;
  return dedupeRelativeRoots([
    resolveInstalledRulesCacheRootDir(resolvedInstallState),
    ".codebuddy/rules_cache",
    "rules"
  ]);
}
function getProjectAgentRootCandidatePaths(projectRoot, installState) {
  return getProjectAgentRootCandidates(projectRoot, installState).map((relativeRoot) => path3.join(projectRoot, relativeRoot));
}
function getProjectSkillRootCandidatePaths(projectRoot, installState) {
  return getProjectSkillRootCandidates(projectRoot, installState).map((relativeRoot) => path3.join(projectRoot, relativeRoot));
}
function getProjectRuleRootCandidatePaths(projectRoot, installState) {
  return getProjectRuleRootCandidates(projectRoot, installState).map((relativeRoot) => path3.join(projectRoot, relativeRoot));
}
function listAgentDefinitionCandidatePaths(projectRoot, agentId, installState) {
  return getProjectAgentRootCandidatePaths(projectRoot, installState).map((rootDir) => path3.join(rootDir, agentId, "AGENT.md"));
}
function listAgentPromptCandidatePaths(projectRoot, agentId, promptFileName, installState) {
  return getProjectAgentRootCandidatePaths(projectRoot, installState).map((rootDir) => path3.join(rootDir, agentId, "prompts", promptFileName));
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
var ALLOWED_TASK_AGENT_HINTS = /* @__PURE__ */ new Set(["coder", "tester", "reviewer", "refactor", "doc-writer", "planner"]);
var ALLOWED_SPEC_MODES = /* @__PURE__ */ new Set(["inline-open-spec", "linked-spec-kit"]);
var ALLOWED_WORKFLOW_IDS = /* @__PURE__ */ new Set(["micro", "sprint", "default"]);
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
function uniqStrings(values) {
  if (!values || values.length === 0) return void 0;
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : void 0;
}
function normalizeExecutionSpec(spec) {
  if (!spec) return void 0;
  const normalized = {};
  if (typeof spec.summary === "string" && spec.summary.trim()) normalized.summary = spec.summary.trim();
  if (typeof spec.agentHint === "string" && ALLOWED_TASK_AGENT_HINTS.has(spec.agentHint)) normalized.agentHint = spec.agentHint;
  if (typeof spec.specRef === "string" && spec.specRef.trim()) normalized.specRef = spec.specRef.trim();
  if (typeof spec.dependenciesNote === "string" && spec.dependenciesNote.trim()) normalized.dependenciesNote = spec.dependenciesNote.trim();
  const deliverables = uniqStrings(spec.deliverables);
  if (deliverables) normalized.deliverables = deliverables;
  const verification = uniqStrings(spec.verification);
  if (verification) normalized.verification = verification;
  const constraints = uniqStrings(spec.constraints);
  if (constraints) normalized.constraints = constraints;
  return Object.keys(normalized).length > 0 ? normalized : void 0;
}
function normalizePlanRisk(risk) {
  if (!risk || typeof risk.summary !== "string" || !risk.summary.trim()) return void 0;
  return {
    level: risk.level === "low" || risk.level === "medium" || risk.level === "high" ? risk.level : "medium",
    summary: risk.summary.trim(),
    mitigation: typeof risk.mitigation === "string" && risk.mitigation.trim() ? risk.mitigation.trim() : void 0
  };
}
function normalizePlanEpic(epic) {
  if (!epic || typeof epic.id !== "string" || !epic.id.trim() || typeof epic.title !== "string" || !epic.title.trim()) {
    return void 0;
  }
  return {
    id: epic.id.trim(),
    title: epic.title.trim(),
    summary: typeof epic.summary === "string" && epic.summary.trim() ? epic.summary.trim() : void 0
  };
}
function normalizeTaskBookPlan(taskBookId, plan, revision) {
  if (!plan) return void 0;
  const normalized = {
    planId: taskBookId,
    version: typeof plan.version === "number" && Number.isInteger(plan.version) && plan.version > 0 ? plan.version : 1,
    linkedTaskBookRevision: revision
  };
  if (typeof plan.specMode === "string" && ALLOWED_SPEC_MODES.has(plan.specMode)) normalized.specMode = plan.specMode;
  if (typeof plan.recommendedWorkflowId === "string" && ALLOWED_WORKFLOW_IDS.has(plan.recommendedWorkflowId)) {
    normalized.recommendedWorkflowId = plan.recommendedWorkflowId;
  }
  if (typeof plan.summary === "string" && plan.summary.trim()) normalized.summary = plan.summary.trim();
  if (typeof plan.specRef === "string" && plan.specRef.trim()) normalized.specRef = plan.specRef.trim();
  if (typeof plan.source === "string" && ["planner", "manual", "task-intake-routing"].includes(plan.source)) {
    normalized.source = plan.source;
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
  if (Array.isArray(plan.risks)) {
    const risks = plan.risks.map(normalizePlanRisk).filter((risk) => Boolean(risk));
    if (risks.length > 0) normalized.risks = risks;
  }
  if (Array.isArray(plan.epics)) {
    const epics = plan.epics.map(normalizePlanEpic).filter((epic) => Boolean(epic));
    if (epics.length > 0) normalized.epics = epics;
  }
  return normalized;
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
    taskBook.plan = normalizeTaskBookPlan(taskBook.id, taskBook.plan, taskBook.revision) ?? taskBook.plan;
    taskBook.tasks = (taskBook.tasks ?? []).map((task) => ({
      ...task,
      executionSpec: normalizeExecutionSpec(task.executionSpec)
    }));
    return taskBook;
  }
  touch(taskBook) {
    if (typeof taskBook.revision !== "number") {
      taskBook.revision = 0;
    }
    taskBook.revision += 1;
    taskBook.updatedAt = now();
    if (taskBook.plan) {
      taskBook.plan = normalizeTaskBookPlan(taskBook.id, taskBook.plan, taskBook.revision);
    }
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
      plan: normalizeTaskBookPlan(id, params.plan, 0) ?? {
        planId: id,
        version: 1,
        linkedTaskBookRevision: 0,
        source: "manual"
      },
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
  updatePlan(id, patch, expectedRevision) {
    return this.withTaskBookLock(id, () => {
      const taskBook = this.load(id);
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      const before = taskBook.plan ? { ...taskBook.plan } : null;
      taskBook.plan = normalizeTaskBookPlan(taskBook.id, {
        ...taskBook.plan ?? { planId: taskBook.id, version: 1 },
        ...patch
      }, taskBook.revision ?? 0) ?? taskBook.plan;
      this.addChangelogEntry(taskBook, {
        timestamp: now(),
        taskId: null,
        changeType: "modified",
        reason: "\u66F4\u65B0 TaskBook \u8BA1\u5212\u5951\u7EA6",
        before: before ?? void 0,
        after: taskBook.plan
      });
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
        executionSpec: normalizeExecutionSpec(task.executionSpec),
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
          executionSpec: normalizeExecutionSpec(task.executionSpec),
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
  applyPlannerPlan(taskBookId, requestId, parsedPlan, expectedRevision) {
    return this.withTaskBookLock(taskBookId, () => {
      const taskBook = this.load(taskBookId);
      if (!taskBook) return null;
      this.assertRevision(taskBook, expectedRevision);
      const planTasks = parsedPlan.tasks;
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
          executionSpec: normalizeExecutionSpec(t.executionSpec),
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
      taskBook.plan = normalizeTaskBookPlan(taskBook.id, {
        ...taskBook.plan,
        ...parsedPlan.plan,
        source: parsedPlan.plan.source ?? "planner"
      }, taskBook.revision ?? 0) ?? taskBook.plan;
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
        "executionSpec",
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
          task[key] = key === "executionSpec" ? normalizeExecutionSpec(value) : value;
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
    const missingExecutionSpec = taskBook.tasks.filter(
      (task) => (task.type === "design" || task.type === "test" || task.type === "implement" || task.type === "review") && (!task.executionSpec || !task.executionSpec.deliverables?.length && !task.executionSpec.verification?.length)
    );
    if (missingExecutionSpec.length > 0) {
      report.recommendations.suggested.push(
        `\u53D1\u73B0 ${missingExecutionSpec.length} \u4E2A\u4EFB\u52A1\u7F3A\u5C11 executionSpec deliverables/verification\uFF1B\u6267\u884C\u5668\u5C06\u53EA\u80FD\u4F9D\u8D56 acceptanceCriteria \u548C\u81EA\u7531\u6587\u672C\uFF0C\u5EFA\u8BAE\u8865\u9F50\u6700\u5C0F\u6267\u884C\u5951\u7EA6\u3002`
      );
    }
    const missingBusinessAc = taskBook.tasks.filter((task) => task.acceptanceCriteria.length === 0);
    if (missingBusinessAc.length > 0) {
      report.recommendations.mustDo.push(
        `\u53D1\u73B0 ${missingBusinessAc.length} \u4E2A\u4EFB\u52A1\u7F3A\u5C11 acceptanceCriteria\uFF1B\u8FD9\u4E9B\u4EFB\u52A1\u5F53\u524D\u6CA1\u6709\u660E\u786E\u7684\u4E1A\u52A1\u9A8C\u6536\u6807\u51C6\u3002`
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
      `\u2551 \u{1F9ED} Workflow/Spec: ${`${taskBook.plan?.recommendedWorkflowId ?? "-"} / ${taskBook.plan?.specMode ?? "-"}`.slice(0, 40).padEnd(40)}\u2551`,
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
      if (task.executionSpec?.agentHint) {
        lines.push(`\u2551     \u21B3 agent=${task.executionSpec.agentHint}`.slice(0, 62).padEnd(61) + "\u2551");
      }
      if (task.executionSpec?.summary) {
        lines.push(`\u2551     \u21B3 spec=${task.executionSpec.summary}`.slice(0, 62).padEnd(61) + "\u2551");
      }
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
  "plan",
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
  --workflow-hint <micro|sprint|default>   \uFF08\u53EF\u9009\uFF09\u8DEF\u7531\u5148\u51B3\u7B56\u7684 workflow \u7EA6\u675F
  --spec-mode <inline-open-spec|linked-spec-kit>  \uFF08\u53EF\u9009\uFF09\u8DEF\u7531\u5148\u51B3\u7B56\u7684 spec \u7C92\u5EA6
  --plan-summary <text>        \uFF08\u53EF\u9009\uFF09\u9876\u5C42\u8BA1\u5212\u6458\u8981
  --goal <text>                \uFF08\u53EF\u91CD\u590D\uFF09\u76EE\u6807
  --assumption <text>          \uFF08\u53EF\u91CD\u590D\uFF09\u524D\u63D0\u5047\u8BBE
  --plan-constraint <text>     \uFF08\u53EF\u91CD\u590D\uFF09\u9876\u5C42\u7EA6\u675F
  --clarification <text>       \uFF08\u53EF\u91CD\u590D\uFF09\u5F85\u6F84\u6E05\u9879
  --out-of-scope <text>        \uFF08\u53EF\u91CD\u590D\uFF09\u975E\u76EE\u6807\u8303\u56F4
  --risk <summary|level:summary> \uFF08\u53EF\u91CD\u590D\uFF09\u9876\u5C42\u98CE\u9669
  --plan-spec-ref <path>       \uFF08\u53EF\u9009\uFF09Spec / Spec Kit \u8DEF\u5F84
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
  --agent-hint <coder|tester|reviewer|refactor|doc-writer|planner>
  --spec-summary <text>        \uFF08\u53EF\u9009\uFF09\u4EFB\u52A1\u6267\u884C\u6458\u8981
  --deliverable <text>         \uFF08\u53EF\u91CD\u590D\uFF09\u4EA4\u4ED8\u7269
  --verify <text>              \uFF08\u53EF\u91CD\u590D\uFF09\u6280\u672F\u6821\u9A8C\u52A8\u4F5C
  --constraint <text>          \uFF08\u53EF\u91CD\u590D\uFF09\u4EFB\u52A1\u6267\u884C\u7EA6\u675F
  --deps-note <text>           \uFF08\u53EF\u9009\uFF09\u4F9D\u8D56\u8BF4\u660E
  --spec-ref <path>            \uFF08\u53EF\u9009\uFF09Spec / Spec Kit \u5F15\u7528
  --json                       \u8F93\u51FA JSON

update-task options:
  --files <p1,p2>              \uFF08\u53EF\u9009\uFF09\u4EFB\u52A1\u6D89\u53CA\u6587\u4EF6\u5217\u8868\uFF08\u9017\u53F7\u5206\u9694\uFF09
  --modules <m1,m2>            \uFF08\u53EF\u9009\uFF09\u4EFB\u52A1\u6D89\u53CA\u6A21\u5757\u5217\u8868\uFF08\u9017\u53F7\u5206\u9694\uFF09
  --tags <t1,t2>               \uFF08\u53EF\u9009\uFF09\u4EFB\u52A1\u6807\u7B7E\uFF08\u9017\u53F7\u5206\u9694\uFF09
  --status <pending|in_progress|done|blocked|skipped>
  --priority <critical|high|medium|low>
  --deps <id1,id2>
  --ac <text>                  \u9A8C\u6536\u6807\u51C6\uFF08\u53EF\u91CD\u590D\uFF1B\u4F1A\u8986\u76D6\uFF09
  --agent-hint <coder|tester|reviewer|refactor|doc-writer|planner>
  --spec-summary <text>
  --deliverable <text>         \uFF08\u53EF\u91CD\u590D\uFF1B\u4F1A\u8986\u76D6\uFF09
  --verify <text>              \uFF08\u53EF\u91CD\u590D\uFF1B\u4F1A\u8986\u76D6\uFF09
  --constraint <text>          \uFF08\u53EF\u91CD\u590D\uFF1B\u4F1A\u8986\u76D6\uFF09
  --deps-note <text>
  --spec-ref <path>
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
  --workflow-hint <micro|sprint|default>   \uFF08\u53EF\u9009\uFF09\u5F3A\u5236\u4F20\u7ED9 planner \u7684 workflow \u7EA6\u675F
  --spec-mode <inline-open-spec|linked-spec-kit>  \uFF08\u53EF\u9009\uFF09\u5F3A\u5236\u4F20\u7ED9 planner \u7684 spec \u7C92\u5EA6
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
function buildExecutionSpecFromFlags(flags) {
  const agentHintRaw = flagAsString(flags, "agent-hint");
  const agentHint = agentHintRaw && ALLOWED_TASK_AGENT_HINTS.has(agentHintRaw) ? agentHintRaw : void 0;
  return normalizeExecutionSpec({
    summary: flagAsString(flags, "spec-summary"),
    agentHint,
    deliverables: flagAsStringArray(flags, "deliverable"),
    verification: flagAsStringArray(flags, "verify"),
    constraints: flagAsStringArray(flags, "constraint"),
    dependenciesNote: flagAsString(flags, "deps-note"),
    specRef: flagAsString(flags, "spec-ref")
  });
}
function buildTaskBookPlanFromFlags(flags) {
  const specModeRaw = flagAsString(flags, "spec-mode");
  const recommendedWorkflowIdRaw = flagAsString(flags, "workflow-hint");
  const planSummary = flagAsString(flags, "plan-summary");
  const goals = flagAsStringArray(flags, "goal");
  const outOfScope = flagAsStringArray(flags, "out-of-scope");
  const assumptions = flagAsStringArray(flags, "assumption");
  const constraints = flagAsStringArray(flags, "plan-constraint");
  const clarifications = flagAsStringArray(flags, "clarification");
  const specRef = flagAsString(flags, "plan-spec-ref");
  const plan = {
    summary: planSummary,
    goals,
    outOfScope,
    assumptions,
    constraints,
    clarifications,
    specRef
  };
  if (specModeRaw && ALLOWED_SPEC_MODES.has(specModeRaw)) {
    plan.specMode = specModeRaw;
  }
  if (recommendedWorkflowIdRaw && ALLOWED_WORKFLOW_IDS.has(recommendedWorkflowIdRaw)) {
    plan.recommendedWorkflowId = recommendedWorkflowIdRaw;
  }
  if (typeof flagAsString(flags, "risk") !== "undefined" || Array.isArray(flags.risk)) {
    const risks = flagAsStringArray(flags, "risk").map((entry) => {
      const [levelRaw, ...rest] = entry.split(":");
      const summary = rest.length > 0 ? rest.join(":").trim() : levelRaw.trim();
      const level = rest.length > 0 && (levelRaw === "low" || levelRaw === "medium" || levelRaw === "high") ? levelRaw : "medium";
      return normalizePlanRisk({ level, summary });
    }).filter((risk) => Boolean(risk));
    if (risks.length > 0) plan.risks = risks;
  }
  const hasExplicitPlanFields = Boolean(planSummary) || goals.length > 0 || outOfScope.length > 0 || assumptions.length > 0 || constraints.length > 0 || clarifications.length > 0 || Boolean(specRef) || Boolean(specModeRaw) || Boolean(recommendedWorkflowIdRaw) || Array.isArray(plan.risks) && plan.risks.length > 0;
  if (!hasExplicitPlanFields) {
    return void 0;
  }
  plan.source = "manual";
  return plan;
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
    recommendedWorkflowId: args.taskBook.plan?.recommendedWorkflowId,
    recommendedSpecMode: args.taskBook.plan?.specMode,
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
      planId: args.taskBook.id,
      summary: "\u5C06\u9700\u6C42\u62C6\u6210\u53EF\u6267\u884C\u4EFB\u52A1\uFF0C\u5E76\u8865\u9F50\u5B9E\u73B0\u7EA6\u675F\u4E0E\u9A8C\u6536\u8FB9\u754C\u3002",
      recommendedWorkflowId: args.taskBook.plan?.recommendedWorkflowId ?? "default",
      specMode: args.taskBook.plan?.specMode ?? "inline-open-spec",
      goals: ["\u62C6\u6210\u53EF\u6267\u884C\u4EFB\u52A1", "\u660E\u786E\u4EA4\u4ED8\u7269\u4E0E\u9A8C\u8BC1\u65B9\u5F0F"],
      outOfScope: ["\u4E0D\u5904\u7406\u65E0\u5173\u6A21\u5757"],
      assumptions: ["\u73B0\u6709\u63A5\u53E3\u5951\u7EA6\u53EF\u590D\u7528"],
      constraints: ["\u4E0D\u5F15\u5165\u65B0\u4F9D\u8D56", "\u6CBF\u7528\u73B0\u6709\u6A21\u5757\u8FB9\u754C"],
      risks: [
        { level: "medium", summary: "\u5386\u53F2\u6A21\u5757\u8026\u5408\u53EF\u80FD\u6269\u5927\u5F71\u54CD\u9762", mitigation: "\u5148\u505A\u5206\u6790\u4EFB\u52A1\u660E\u786E\u8FB9\u754C" }
      ],
      epics: [
        { id: "EPIC-1", title: "\u8303\u56F4\u6F84\u6E05\u4E0E\u5B9E\u73B0\u65B9\u6848" }
      ],
      tasks: [
        {
          planId: "T1",
          title: "\u7406\u89E3\u9700\u6C42 & \u68B3\u7406\u5F71\u54CD\u8303\u56F4",
          type: "analysis",
          priority: "high",
          acceptanceCriteria: ["\u8F93\u51FA\u5F71\u54CD\u8303\u56F4\u6E05\u5355", "\u660E\u786E\u975E\u76EE\u6807/\u7EA6\u675F"],
          executionSpec: {
            agentHint: "planner",
            deliverables: ["\u5F71\u54CD\u8303\u56F4\u8BF4\u660E"],
            verification: ["\u786E\u8BA4\u6D89\u53CA\u6587\u4EF6\u4E0E\u6A21\u5757\u5217\u8868\u5B8C\u6574"]
          }
        },
        {
          planId: "T2",
          title: "\u5236\u5B9A\u5B9E\u73B0\u65B9\u6848\uFF08\u542B\u63A5\u53E3/\u6570\u636E\u7ED3\u6784\uFF09",
          type: "design",
          dependencies: ["T1"],
          acceptanceCriteria: ["\u7ED9\u51FA\u65B9\u6848\u4E0E\u53D6\u820D", "\u660E\u786E\u4EFB\u52A1\u62C6\u5206\u4E0E\u5173\u952E\u8DEF\u5F84"],
          executionSpec: {
            agentHint: "reviewer",
            deliverables: ["\u8BBE\u8BA1\u8BF4\u660E", "\u4EFB\u52A1\u62C6\u5206\u6E05\u5355"],
            verification: ["\u8BC4\u5BA1\u8BBE\u8BA1\u662F\u5426\u6EE1\u8DB3\u7EA6\u675F\u6761\u4EF6"]
          }
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
    "- \u4E0D\u8981\u8F93\u51FA\u8FC7\u7A0B\u6027\u63A8\u7406\u3001\u81EA\u6211\u63D0\u9192\u6216\u201C\u6211\u5E94\u8BE5/\u6839\u636E\u89C4\u5219\u201D\u4E4B\u7C7B\u7684\u53E5\u5B50\u3002",
    "- \u53EA\u751F\u6210 task \u7EA7\u522B\u7684\u539F\u5B50\u4EFB\u52A1\uFF08INVEST\uFF09\uFF0C\u786E\u4FDD\u6BCF\u4E2A\u4EFB\u52A1 1-3 \u5929\u5185\u53EF\u5B8C\u6210\u3002",
    "- \u9876\u5C42 output.planId \u5FC5\u987B\u7B49\u4E8E\u5F53\u524D TaskBook.id\u3002",
    "- \u4EFB\u52A1\u7C7B\u578B\u5FC5\u987B\u662F\u4EE5\u4E0B\u4E4B\u4E00\uFF1Aanalysis | design | test | implement | review\u3002",
    "- dependencies \u53EA\u80FD\u5F15\u7528\u672C\u6B21\u8BA1\u5212\u4E2D\u66F4\u65E9\u7684 planId\uFF08\u786E\u4FDD tasks \u5DF2\u6309\u4F9D\u8D56\u62D3\u6251\u987A\u5E8F\u6392\u5E8F\uFF09\u3002",
    "- acceptanceCriteria \u5FC5\u586B\uFF0C\u8868\u793A\u4E1A\u52A1/\u7ED3\u679C\u5C42\u9A8C\u6536\u6807\u51C6\u3002",
    "- executionSpec.verification \u8868\u793A\u6280\u672F/\u5DE5\u7A0B\u5C42\u6821\u9A8C\u52A8\u4F5C\uFF1B\u4E0D\u8981\u4E0E acceptanceCriteria \u6DF7\u6DC6\u3002",
    `- \u5982 prompt header \u5DF2\u7ED9\u51FA recommendedWorkflowId/specMode\uFF0C\u5FC5\u987B\u4E25\u683C\u9075\u5B88\uFF1Aworkflow=${args.taskBook.plan?.recommendedWorkflowId ?? "\u672A\u6307\u5B9A"}\uFF0CspecMode=${args.taskBook.plan?.specMode ?? "\u672A\u6307\u5B9A"}\u3002`,
    "- scope \u53EF\u9009\uFF1Afiles/modules/tags\uFF08\u6570\u7EC4\uFF09\u3002",
    "- executionSpec \u63A8\u8350\u5305\u542B agentHint\u3001deliverables\u3001verification\u3001constraints\u3001specRef\u3002",
    "- \u5982\u9700\u5F15\u7528\u5916\u90E8 Spec Kit\uFF0CspecRef \u8BF7\u4F7F\u7528\u7248\u672C\u5316\u8DEF\u5F84\uFF08\u4F8B\u5982 .codebuddy/specs/<taskBookId>-v1/00-overview.md\uFF09\u3002",
    "",
    `\u5199\u5165\u76EE\u6807\uFF1A\u8BF7\u628A\u7ED3\u679C\u5199\u5165 ${args.resultPath}`,
    "",
    "\u8F93\u51FA JSON Schema\uFF08\u7B80\u5316\u7248\uFF09\uFF1A",
    "- requestId: string\uFF08\u5FC5\u987B\u4E0E header.requestId \u4E00\u81F4\uFF09",
    "- kind?: 'planner' | 'manual-task'\uFF08\u63A8\u8350\uFF0C\u7528\u4E8E\u66F4\u5F3A\u6821\u9A8C/\u8BCA\u65AD\uFF09",
    "- status: 'success' | 'failed' | 'blocked'",
    "- output.planId: string\uFF08\u5FC5\u987B\u7B49\u4E8E TaskBook.id\uFF09",
    "- output.recommendedWorkflowId?: 'micro' | 'sprint' | 'default'",
    "- output.specMode?: 'inline-open-spec' | 'linked-spec-kit'",
    "- output.summary?: string",
    "- output.assumptions?: string[]",
    "- output.constraints?: string[]",
    "- output.risks?: { level?: low|medium|high; summary: string; mitigation?: string }[]",
    "- output.tasks: PlannerPlanTask[]",
    "",
    "PlannerPlanTask:",
    "- planId: string\uFF08\u5982 T1/T2...\uFF0C\u672C\u6B21\u8BA1\u5212\u5185\u552F\u4E00\uFF09",
    "- title: string",
    "- type: 'analysis' | 'design' | 'test' | 'implement' | 'review'",
    "- priority?: 'critical' | 'high' | 'medium' | 'low'",
    "- dependencies?: string[]\uFF08planId \u5217\u8868\uFF09",
    "- acceptanceCriteria: string[]\uFF08\u5FC5\u586B\uFF0C\u4E1A\u52A1\u9A8C\u6536\uFF09",
    "- scope?: { files?: string[]; modules?: string[]; tags?: string[] }",
    "- executionSpec?: { agentHint?: 'coder'|'tester'|'reviewer'|'refactor'|'doc-writer'|'planner'; deliverables?: string[]; verification?: string[]; constraints?: string[]; dependenciesNote?: string; specRef?: string }",
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
function parsePlannerPlanFromAgentResult(result, taskBookId) {
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
  const allowedWorkflowIds = /* @__PURE__ */ new Set(["micro", "sprint", "default"]);
  const allowedSpecModes = /* @__PURE__ */ new Set(["inline-open-spec", "linked-spec-kit"]);
  const allowedAgentHints = /* @__PURE__ */ new Set(["coder", "tester", "reviewer", "refactor", "doc-writer", "planner"]);
  const plannerPlan = {
    planId: taskBookId || (typeof outObj.planId === "string" ? outObj.planId : ""),
    version: 1,
    source: "planner"
  };
  if (typeof outObj.planId !== "undefined") {
    if (typeof outObj.planId !== "string" || !outObj.planId.trim()) {
      throw new Error("\u9519\u8BEF: result.output.planId \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
    }
    if (taskBookId && outObj.planId !== taskBookId) {
      throw new Error(`\u9519\u8BEF: result.output.planId \u5FC5\u987B\u7B49\u4E8E TaskBook.id (${taskBookId})`);
    }
    plannerPlan.planId = outObj.planId.trim();
  } else if (taskBookId) {
    plannerPlan.planId = taskBookId;
  }
  const topLevelStringArrayKeys = [
    "goals",
    "outOfScope",
    "assumptions",
    "constraints",
    "clarifications"
  ];
  for (const key of topLevelStringArrayKeys) {
    const value = outObj[key];
    if (typeof value === "undefined") continue;
    if (!Array.isArray(value)) {
      throw new Error(`\u9519\u8BEF: result.output.${key} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
    }
    const normalized = value.map((item, itemIndex) => {
      if (typeof item !== "string" || !item.trim()) {
        throw new Error(`\u9519\u8BEF: result.output.${key}[${itemIndex}] \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
      }
      return item.trim();
    });
    plannerPlan[key] = normalized;
  }
  if (typeof outObj.summary !== "undefined") {
    if (typeof outObj.summary !== "string" || !outObj.summary.trim()) {
      throw new Error("\u9519\u8BEF: result.output.summary \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
    }
    plannerPlan.summary = outObj.summary.trim();
  }
  if (typeof outObj.specRef !== "undefined") {
    if (typeof outObj.specRef !== "string" || !outObj.specRef.trim()) {
      throw new Error("\u9519\u8BEF: result.output.specRef \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
    }
    plannerPlan.specRef = outObj.specRef.trim();
  }
  if (typeof outObj.specMode !== "undefined") {
    if (typeof outObj.specMode !== "string" || !allowedSpecModes.has(outObj.specMode)) {
      throw new Error("\u9519\u8BEF: result.output.specMode \u65E0\u6548");
    }
    plannerPlan.specMode = outObj.specMode;
  }
  if (typeof outObj.recommendedWorkflowId !== "undefined") {
    if (typeof outObj.recommendedWorkflowId !== "string" || !allowedWorkflowIds.has(outObj.recommendedWorkflowId)) {
      throw new Error("\u9519\u8BEF: result.output.recommendedWorkflowId \u65E0\u6548");
    }
    plannerPlan.recommendedWorkflowId = outObj.recommendedWorkflowId;
  }
  if (typeof outObj.risks !== "undefined") {
    if (!Array.isArray(outObj.risks)) {
      throw new Error("\u9519\u8BEF: result.output.risks \u5FC5\u987B\u662F\u6570\u7EC4");
    }
    plannerPlan.risks = outObj.risks.map((rawRisk, index) => {
      if (!rawRisk || typeof rawRisk !== "object") {
        throw new Error(`\u9519\u8BEF: result.output.risks[${index}] \u5FC5\u987B\u662F object`);
      }
      const risk = rawRisk;
      if (typeof risk.summary !== "string" || !risk.summary.trim()) {
        throw new Error(`\u9519\u8BEF: result.output.risks[${index}].summary \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
      }
      if (typeof risk.level !== "undefined" && risk.level !== "low" && risk.level !== "medium" && risk.level !== "high") {
        throw new Error(`\u9519\u8BEF: result.output.risks[${index}].level \u65E0\u6548`);
      }
      return {
        level: risk.level === "low" || risk.level === "medium" || risk.level === "high" ? risk.level : "medium",
        summary: risk.summary.trim(),
        mitigation: typeof risk.mitigation === "string" && risk.mitigation.trim() ? risk.mitigation.trim() : void 0
      };
    });
  }
  if (typeof outObj.epics !== "undefined") {
    if (!Array.isArray(outObj.epics)) {
      throw new Error("\u9519\u8BEF: result.output.epics \u5FC5\u987B\u662F\u6570\u7EC4");
    }
    plannerPlan.epics = outObj.epics.map((rawEpic, index) => {
      if (!rawEpic || typeof rawEpic !== "object") {
        throw new Error(`\u9519\u8BEF: result.output.epics[${index}] \u5FC5\u987B\u662F object`);
      }
      const epic = rawEpic;
      if (typeof epic.id !== "string" || !epic.id.trim()) {
        throw new Error(`\u9519\u8BEF: result.output.epics[${index}].id \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
      }
      if (typeof epic.title !== "string" || !epic.title.trim()) {
        throw new Error(`\u9519\u8BEF: result.output.epics[${index}].title \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
      }
      return {
        id: epic.id.trim(),
        title: epic.title.trim(),
        summary: typeof epic.summary === "string" && epic.summary.trim() ? epic.summary.trim() : void 0
      };
    });
  }
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
    if (!Array.isArray(t.acceptanceCriteria) || t.acceptanceCriteria.length === 0) {
      throw new Error(`\u9519\u8BEF: tasks[${index}].acceptanceCriteria \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32\u6570\u7EC4`);
    }
    for (const ac of t.acceptanceCriteria) {
      if (typeof ac !== "string" || !ac.trim()) {
        throw new Error(`\u9519\u8BEF: tasks[${index}].acceptanceCriteria \u5305\u542B\u65E0\u6548\u6761\u76EE`);
      }
      acceptanceCriteria.push(ac.trim());
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
    let executionSpec;
    if (typeof t.executionSpec !== "undefined") {
      if (!t.executionSpec || typeof t.executionSpec !== "object") {
        throw new Error(`\u9519\u8BEF: tasks[${index}].executionSpec \u5FC5\u987B\u662F object`);
      }
      const spec = t.executionSpec;
      const parseOptionalStringList = (key) => {
        if (typeof spec[key] === "undefined") return void 0;
        if (!Array.isArray(spec[key])) {
          throw new Error(`\u9519\u8BEF: tasks[${index}].executionSpec.${key} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
        }
        const values = spec[key];
        const normalized = values.map((item, itemIndex) => {
          if (typeof item !== "string" || !item.trim()) {
            throw new Error(`\u9519\u8BEF: tasks[${index}].executionSpec.${key}[${itemIndex}] \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
          }
          return item.trim();
        });
        return normalized.length > 0 ? normalized : void 0;
      };
      if (typeof spec.summary !== "undefined" && (typeof spec.summary !== "string" || !spec.summary.trim())) {
        throw new Error(`\u9519\u8BEF: tasks[${index}].executionSpec.summary \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
      }
      if (typeof spec.agentHint !== "undefined" && (typeof spec.agentHint !== "string" || !allowedAgentHints.has(spec.agentHint))) {
        throw new Error(`\u9519\u8BEF: tasks[${index}].executionSpec.agentHint \u65E0\u6548`);
      }
      if (typeof spec.dependenciesNote !== "undefined" && (typeof spec.dependenciesNote !== "string" || !spec.dependenciesNote.trim())) {
        throw new Error(`\u9519\u8BEF: tasks[${index}].executionSpec.dependenciesNote \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
      }
      if (typeof spec.specRef !== "undefined" && (typeof spec.specRef !== "string" || !spec.specRef.trim())) {
        throw new Error(`\u9519\u8BEF: tasks[${index}].executionSpec.specRef \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
      }
      executionSpec = normalizeExecutionSpec({
        summary: typeof spec.summary === "string" ? spec.summary.trim() : void 0,
        agentHint: typeof spec.agentHint === "string" ? spec.agentHint : void 0,
        deliverables: parseOptionalStringList("deliverables"),
        verification: parseOptionalStringList("verification"),
        constraints: parseOptionalStringList("constraints"),
        dependenciesNote: typeof spec.dependenciesNote === "string" ? spec.dependenciesNote.trim() : void 0,
        specRef: typeof spec.specRef === "string" ? spec.specRef.trim() : void 0
      });
    }
    parsedTasks.push({
      planId,
      title: title.trim(),
      type,
      priority: parsedPriority,
      dependencies: dependencies.length > 0 ? dependencies : void 0,
      acceptanceCriteria,
      scope,
      executionSpec
    });
  }
  return { plan: plannerPlan, tasks: parsedTasks };
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
        const taskBook = manager.create({
          title,
          description,
          taskType: type,
          plan: buildTaskBookPlanFromFlags(parsed.flags)
        });
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
        const planPatch = buildTaskBookPlanFromFlags(parsed.flags);
        const planAwareTaskBook = planPatch ? manager.updatePlan(taskBookId, { ...planPatch, source: "task-intake-routing" }, tb.revision) : tb;
        if (!planAwareTaskBook) {
          console.error(`\u9519\u8BEF: TaskBook not found: ${taskBookId}`);
          process.exit(1);
        }
        const prompt = buildPlannerPrompt({
          requestId,
          taskBook: planAwareTaskBook,
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
          taskBookRevision: planAwareTaskBook.revision ?? 0,
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
          console.log(`  # \u82E5\u542F\u7528\u5E76\u53D1\u4FDD\u62A4\uFF1A\u52A0\u4E0A --if-rev ${planAwareTaskBook.revision ?? 0}`);
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
        const parsedPlan = parsePlannerPlanFromAgentResult(result, taskBookId);
        if (dryRun) {
          const preview = {
            dryRun: true,
            requestId,
            taskBookId,
            plan: parsedPlan.plan,
            tasks: parsedPlan.tasks
          };
          if (json) printJson(preview);
          else {
            console.log(`[planner] dry-run: ${taskBookId} <- ${requestId}`);
            for (const t of parsedPlan.tasks) {
              const deps = t.dependencies && t.dependencies.length > 0 ? ` deps=${t.dependencies.join(",")}` : "";
              console.log(`- ${t.planId} [${t.type}] ${t.title}${deps}`);
            }
          }
          break;
        }
        const planIdToIndex = /* @__PURE__ */ new Map();
        for (let i = 0; i < parsedPlan.tasks.length; i++) {
          planIdToIndex.set(parsedPlan.tasks[i].planId, i);
        }
        for (let i = 0; i < parsedPlan.tasks.length; i++) {
          const deps = parsedPlan.tasks[i].dependencies ?? [];
          for (const dep of deps) {
            const depIndex = planIdToIndex.get(dep);
            if (typeof depIndex !== "number") {
              console.error(`\u9519\u8BEF: \u4F9D\u8D56 planId \u4E0D\u5B58\u5728: ${dep} (from ${parsedPlan.tasks[i].planId})`);
              process.exit(1);
            }
            if (depIndex >= i) {
              console.error(`\u9519\u8BEF: dependencies \u5FC5\u987B\u6307\u5411\u66F4\u65E9\u7684 planId\uFF08${parsedPlan.tasks[i].planId} \u4F9D\u8D56 ${dep}\uFF09`);
              process.exit(1);
            }
          }
        }
        const applied = manager.applyPlannerPlan(taskBookId, requestId, parsedPlan, expectedRevision);
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
          scope: buildScope(files, modules, tags),
          executionSpec: buildExecutionSpecFromFlags(parsed.flags)
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
        const executionSpec = buildExecutionSpecFromFlags(parsed.flags);
        if (executionSpec) patch.executionSpec = executionSpec;
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
var fs4 = __toESM(require("fs"));
var path6 = __toESM(require("path"));
var import_child_process = require("child_process");

// scripts/src/reference-finder.ts
var fs3 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
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
    entries = fs3.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (collected.length >= MAX_FILES_SCAN) break;
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      collectSourceFiles(path5.join(dir, entry.name), collected, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path5.extname(entry.name).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    const fullPath = path5.join(dir, entry.name);
    try {
      const stat = fs3.statSync(fullPath);
      if (stat.size > MAX_FILE_SIZE) continue;
    } catch {
      continue;
    }
    collected.push(fullPath);
  }
}
function buildImportPatterns(targetPath, projectRoot) {
  const rel = path5.relative(projectRoot, targetPath).replace(/\\/g, "/");
  const withoutExt = rel.replace(/\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/, "");
  const withoutIndex = withoutExt.replace(/\/index$/, "");
  const patterns = /* @__PURE__ */ new Set();
  patterns.add(withoutExt);
  patterns.add(withoutIndex);
  if (withoutExt.startsWith("src/")) {
    patterns.add(withoutExt.slice(4));
    patterns.add(withoutIndex.slice(4));
  }
  const baseName = path5.basename(withoutExt);
  patterns.add(baseName);
  return Array.from(patterns).filter((p) => p.length > 0);
}
function buildSymbolPattern(symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "g");
}
function searchFileForReferences(filePath, importPatterns, symbolPattern, targetAbsPath) {
  if (targetAbsPath && path5.resolve(filePath) === path5.resolve(targetAbsPath)) {
    return [];
  }
  let content;
  try {
    content = fs3.readFileSync(filePath, "utf-8");
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
  const targetAbsPath = fs3.existsSync(path5.resolve(projectRoot, target)) ? path5.resolve(projectRoot, target) : null;
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
  const rel = path5.relative(projectRoot, targetPath).replace(/\\/g, "/");
  const parsed = path5.parse(rel);
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
    path5.dirname(path5.join(projectRoot, rel)),
    // 同目录
    path5.join(projectRoot, "__tests__"),
    // 根 __tests__
    path5.join(projectRoot, "test"),
    // 根 test
    path5.join(projectRoot, "tests"),
    // 根 tests
    path5.join(projectRoot, "src", "__tests__"),
    // src/__tests__
    path5.join(path5.dirname(path5.join(projectRoot, rel)), "__tests__")
    // 同级 __tests__
  ];
  const seen = /* @__PURE__ */ new Set();
  for (const dir of testDirs) {
    if (!fs3.existsSync(dir)) continue;
    let entries;
    try {
      entries = fs3.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path5.join(dir, entry);
      const normalized = path5.resolve(fullPath);
      if (seen.has(normalized)) continue;
      if (exactPatterns.includes(entry)) {
        seen.add(normalized);
        results.push({
          testPath: path5.relative(projectRoot, fullPath).replace(/\\/g, "/"),
          sourcePath: rel,
          confidence: "exact"
        });
        continue;
      }
      if ((entry.includes(".spec.") || entry.includes(".test.")) && entry.includes(baseName)) {
        seen.add(normalized);
        results.push({
          testPath: path5.relative(projectRoot, fullPath).replace(/\\/g, "/"),
          sourcePath: rel,
          confidence: "pattern"
        });
      }
    }
  }
  if (results.length === 0) {
    const sourceDir = path5.dirname(path5.join(projectRoot, rel));
    if (fs3.existsSync(sourceDir)) {
      try {
        const entries = fs3.readdirSync(sourceDir);
        for (const entry of entries) {
          if (entry.includes(".spec.") || entry.includes(".test.")) {
            const fullPath = path5.join(sourceDir, entry);
            const normalized = path5.resolve(fullPath);
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            results.push({
              testPath: path5.relative(projectRoot, fullPath).replace(/\\/g, "/"),
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
      const absTarget = fs3.existsSync(path5.resolve(projectRoot, target)) ? path5.resolve(projectRoot, target) : null;
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
      const relPath = path5.relative(projectRoot, ref.filePath).replace(/\\/g, "/");
      console.log(`  ${relPath}:${ref.line} [${ref.kind}]`);
      console.log(`    ${ref.matchText}`);
    }
    if (findTests) {
      const absTarget = fs3.existsSync(path5.resolve(projectRoot, target)) ? path5.resolve(projectRoot, target) : null;
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
  const absPath = path6.isAbsolute(filePath) ? filePath : path6.resolve(projectRoot, filePath);
  if (!fs4.existsSync(absPath)) return null;
  let content;
  try {
    content = fs4.readFileSync(absPath, "utf-8");
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
  const relPath = path6.relative(projectRoot, absPath).replace(/\\/g, "/");
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
      const absPath = path6.isAbsolute(file) ? file : path6.resolve(projectRoot, file);
      if (!fs4.existsSync(absPath)) continue;
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
      const ext = path6.extname(file.path).slice(1) || "text";
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
var fs5 = __toESM(require("fs"));
var path7 = __toESM(require("path"));

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
function extractYamlScalar(frontmatter, key, indent = 0) {
  const normalized = normalizeNewlines(frontmatter);
  const pattern = new RegExp(`^${escapeRegex(indentPrefix(indent))}${escapeRegex(key)}:\\s*(.+)$`, "m");
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
var RULE_CACHE_LAYER_ROOTS = {
  layer1_base: "layer1_reference",
  layer2_business: "layer2_business",
  layer3_action: "layer3_action"
};
function dedupeRuleCandidates(candidates) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const candidate of candidates) {
    const normalizedPath = path7.normalize(candidate.path);
    if (seen.has(normalizedPath)) continue;
    seen.add(normalizedPath);
    result.push(candidate);
  }
  return result;
}
function normalizeRuleName(ruleName) {
  return ruleName.replace(/\\/g, "/").replace(/\.md$/i, "").replace(/^\/+|\/+$/g, "");
}
function findRuleFileByBasename(rootDir, fileName) {
  if (!fs5.existsSync(rootDir) || !fs5.statSync(rootDir).isDirectory()) {
    return null;
  }
  const matches = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    let entries;
    try {
      entries = fs5.readdirSync(currentDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path7.join(currentDir, entry);
      let stat;
      try {
        stat = fs5.statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (stat.isFile() && entry === fileName) {
        matches.push(fullPath);
      }
    }
  }
  if (matches.length === 0) {
    return null;
  }
  matches.sort((left, right) => {
    const leftSegments = left.split(path7.sep).length;
    const rightSegments = right.split(path7.sep).length;
    if (leftSegments !== rightSegments) return leftSegments - rightSegments;
    return left.localeCompare(right);
  });
  return matches[0];
}
function buildRuleCandidates(ruleRoot, layer, ruleName) {
  const normalizedRuleName = normalizeRuleName(ruleName);
  const basename6 = path7.posix.basename(normalizedRuleName);
  const fileName = `${basename6}.md`;
  const isCacheRoot = path7.basename(ruleRoot) === "rules_cache";
  const baseRoot = isCacheRoot ? path7.join(ruleRoot, RULE_CACHE_LAYER_ROOTS[layer] || layer) : path7.join(ruleRoot, layer);
  const candidates = [
    {
      kind: "directory",
      path: path7.join(baseRoot, normalizedRuleName)
    },
    {
      kind: "file",
      path: path7.join(baseRoot, `${normalizedRuleName}.md`)
    }
  ];
  if (!normalizedRuleName.includes("/")) {
    const recursiveMatch = findRuleFileByBasename(baseRoot, fileName);
    if (recursiveMatch) {
      candidates.push({
        kind: "file",
        path: recursiveMatch
      });
    }
  }
  return dedupeRuleCandidates(candidates);
}
function formatIncomingHandoffs(context) {
  const handoffs = context.task.incomingHandoffs ?? [];
  if (handoffs.length === 0) {
    return "(\u65E0\u4E0A\u6E38 handoff)";
  }
  return handoffs.map((handoff, index) => {
    const lines = [
      `${index + 1}. ${handoff.sourceTaskId} ${handoff.sourceTaskTitle} [${handoff.sourceTaskType}] -> ${handoff.to} (${handoff.type})`,
      `   from: ${handoff.from}${handoff.sourceTaskExecutedBy ? ` / executedBy: ${handoff.sourceTaskExecutedBy}` : ""}`,
      `   status: ${handoff.sourceTaskStatus ?? "unknown"} / at: ${handoff.timestamp}`
    ];
    if (handoff.context) {
      lines.push(`   context: ${handoff.context}`);
    }
    if (handoff.deliverables && handoff.deliverables.length > 0) {
      lines.push(`   deliverables: ${handoff.deliverables.join(", ")}`);
    }
    return lines.join("\n");
  }).join("\n");
}
function buildIncomingHandoffSection(context) {
  const handoffs = context.task.incomingHandoffs ?? [];
  if (handoffs.length === 0) {
    return "";
  }
  const handoffParts = handoffs.map((handoff, index) => {
    const lines = [
      `### Handoff ${index + 1}: ${handoff.sourceTaskTitle}`,
      "",
      `- Source Task: ${handoff.sourceTaskId} (${handoff.sourceTaskType})`,
      `- From: ${handoff.from}${handoff.sourceTaskExecutedBy ? ` / executedBy: ${handoff.sourceTaskExecutedBy}` : ""}`,
      `- Status: ${handoff.sourceTaskStatus ?? "unknown"}`,
      `- Type: ${handoff.type}`,
      `- Timestamp: ${handoff.timestamp}`
    ];
    if (handoff.context) {
      lines.push(`- Context: ${handoff.context}`);
    }
    if (handoff.deliverables && handoff.deliverables.length > 0) {
      lines.push(`- Deliverables: ${handoff.deliverables.join(", ")}`);
    }
    return lines.join("\n");
  });
  return [
    "## Incoming Handoffs",
    "",
    "> \u4EE5\u4E0B\u662F\u4E0A\u6E38\u4EFB\u52A1\u4EA4\u63A5\u7ED9\u5F53\u524D Agent \u7684\u6700\u65B0\u4E0A\u4E0B\u6587\uFF0C\u8BF7\u4F18\u5148\u5438\u6536\u8FD9\u4E9B\u4FE1\u606F\u3002",
    "",
    ...handoffParts,
    ""
  ].join("\n");
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
      path7.join(this.config.projectRoot, this.config.agentsDir || "agents")
    ];
    if (this.config.fallbackAgentsDir) {
      searchDirs.push(path7.join(this.config.projectRoot, this.config.fallbackAgentsDir));
    }
    for (const dir of searchDirs) {
      if (!fs5.existsSync(dir)) {
        rtDebug(`Agent \u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u8DF3\u8FC7: ${dir}`);
        continue;
      }
      const entries = fs5.readdirSync(dir).filter((name) => {
        const fullPath = path7.join(dir, name);
        return fs5.existsSync(fullPath) && fs5.statSync(fullPath).isDirectory();
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
      path7.join(this.config.projectRoot, this.config.agentsDir || "agents"),
      ...this.config.fallbackAgentsDir ? [path7.join(this.config.projectRoot, this.config.fallbackAgentsDir)] : []
    ];
    for (const dir of dirs) {
      const agentDir = path7.join(dir, agentId);
      const agentMdPath = path7.join(agentDir, "AGENT.md");
      if (!fs5.existsSync(agentMdPath)) continue;
      try {
        const content = fs5.readFileSync(agentMdPath, "utf-8");
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
        const promptsDir = path7.join(agentDir, "prompts");
        if (fs5.existsSync(promptsDir) && fs5.statSync(promptsDir).isDirectory()) {
          const promptFiles = fs5.readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
          for (const file of promptFiles) {
            const name = path7.basename(file, ".md");
            prompts[name] = fs5.readFileSync(path7.join(promptsDir, file), "utf-8");
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
    const handoffSection = buildIncomingHandoffSection(context);
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
    return header + handoffSection + skillSection + ruleSection + rendered;
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
      "task.incomingHandoffs": formatIncomingHandoffs(context),
      "task.incomingHandoffCount": String(task.incomingHandoffs?.length ?? 0),
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
    vars["context.handoffs"] = formatIncomingHandoffs(context);
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
   * 优先读取 install.json 记录的 active skills root，其次回退到 legacy/custom-skills 目录
   */
  loadDeclaredSkills(metadata) {
    const skills = {};
    const perms = metadata.permissions;
    if (!perms || Array.isArray(perms) || !perms.skills) return skills;
    const root = this.config.projectRoot;
    for (const skillName of perms.skills) {
      const candidates = getProjectSkillRootCandidatePaths(root).map((skillRoot) => path7.join(skillRoot, skillName, "SKILL.md"));
      let found = false;
      for (const candidate of candidates) {
        if (fs5.existsSync(candidate)) {
          try {
            skills[skillName] = fs5.readFileSync(candidate, "utf-8");
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
   * 优先读取 .codebuddy/rules_cache 中的已安装规则，再回退到源码 rules/ 目录
   */
  loadDeclaredRules(metadata) {
    const rules = {};
    if (!metadata.dependencies) return rules;
    const root = this.config.projectRoot;
    const ruleRoots = getProjectRuleRootCandidatePaths(root);
    for (const [layer, ruleNames] of Object.entries(metadata.dependencies)) {
      if (!Array.isArray(ruleNames)) continue;
      for (const ruleName of ruleNames) {
        const key = `${layer}/${ruleName}`;
        let found = false;
        for (const ruleRoot of ruleRoots) {
          for (const candidate of buildRuleCandidates(ruleRoot, layer, ruleName)) {
            if (!fs5.existsSync(candidate.path)) {
              continue;
            }
            if (candidate.kind === "directory" && fs5.statSync(candidate.path).isDirectory()) {
              try {
                const mdFiles = fs5.readdirSync(candidate.path).filter((f) => f.endsWith(".md")).sort();
                if (mdFiles.length === 0) {
                  continue;
                }
                rules[key] = mdFiles.map((f) => {
                  const content = fs5.readFileSync(path7.join(candidate.path, f), "utf-8");
                  return `<!-- ${f} -->
${content}`;
                }).join("\n\n");
                rtDebug(`\u5DF2\u52A0\u8F7D Rule: ${key} (${candidate.path}, ${mdFiles.length} \u4E2A\u6587\u4EF6)`);
                found = true;
                break;
              } catch {
              }
            }
            if (candidate.kind === "file" && fs5.statSync(candidate.path).isFile()) {
              try {
                rules[key] = fs5.readFileSync(candidate.path, "utf-8");
                rtDebug(`\u5DF2\u52A0\u8F7D Rule: ${key} (${candidate.path})`);
                found = true;
                break;
              } catch {
              }
            }
          }
          if (found) {
            break;
          }
        }
        if (!found) {
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
var fs6 = __toESM(require("fs"));
var path8 = __toESM(require("path"));
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
  const resultPath = path8.join(projectRoot, AGENT_CALLS_DIR2, `${requestId}.result.json`);
  try {
    const raw = fs6.readFileSync(resultPath, "utf-8");
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
var fs7 = __toESM(require("fs"));
var path9 = __toESM(require("path"));
var METRICS_SCHEMA_VERSION = "1.0.0";
function recordExecutionMetric(input) {
  const projectRoot = input.projectRoot || process.cwd();
  const metricsPaths = getExecutionMetricsPaths(projectRoot);
  ensureMetricsDir(metricsPaths.dir);
  const event = {
    ...input,
    schemaVersion: METRICS_SCHEMA_VERSION,
    recordedAt: input.recordedAt || (/* @__PURE__ */ new Date()).toISOString()
  };
  delete event.projectRoot;
  fs7.appendFileSync(metricsPaths.eventsFile, `${JSON.stringify(event)}
`, "utf-8");
  const summary = loadExecutionMetricsSummary(projectRoot);
  applyEvent(summary, event);
  summary.generatedAt = event.recordedAt;
  summary.lastEventAt = event.recordedAt;
  fs7.writeFileSync(metricsPaths.summaryFile, JSON.stringify(summary, null, 2), "utf-8");
  return event;
}
function loadExecutionMetricsSummary(projectRoot = process.cwd()) {
  const summaryPath = path9.join(projectRoot, ".codebuddy", "reports", "metrics", "latest-summary.json");
  if (!fs7.existsSync(summaryPath)) {
    return createEmptySummary(projectRoot);
  }
  try {
    const parsed = JSON.parse(fs7.readFileSync(summaryPath, "utf-8"));
    return normalizeSummary(parsed, projectRoot);
  } catch {
    return createEmptySummary(projectRoot);
  }
}
function getExecutionMetricsPaths(projectRoot = process.cwd()) {
  return {
    dir: path9.join(projectRoot, ".codebuddy", "reports", "metrics"),
    eventsFile: path9.join(projectRoot, ".codebuddy", "reports", "metrics", "execution-events.jsonl"),
    summaryFile: path9.join(projectRoot, ".codebuddy", "reports", "metrics", "latest-summary.json")
  };
}
function recordWorkflowRoutingMetric(params) {
  const eventType = params.decision.mode === "reused" ? "workflow_route_reused" : params.decision.mode === "fallback" ? "workflow_route_fallback" : "workflow_route_selected";
  return recordExecutionMetric({
    projectRoot: params.projectRoot,
    eventType,
    recordedAt: params.recordedAt,
    taskBookId: params.taskBook.id,
    workflowId: params.decision.selectedWorkflowId,
    workflowPath: params.decision.selectedWorkflowPath,
    routeMode: params.decision.mode,
    routeConfidence: params.decision.confidence
  });
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
function ensureMetricsDir(metricsDir) {
  fs7.mkdirSync(metricsDir, { recursive: true });
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
      workflowRoutesSelected: 0,
      workflowRoutesReused: 0,
      workflowRoutesFallback: 0,
      totalDurationMs: 0,
      averageDurationMs: 0
    },
    byTaskType: {},
    byExecutionMode: {},
    blockedReasons: {},
    workflowRoutesById: {},
    workflowRoutesByMode: {}
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
    blockedReasons: normalizeCounterMap(raw.blockedReasons),
    workflowRoutesById: normalizeCounterMap(raw.workflowRoutesById),
    workflowRoutesByMode: normalizeCounterMap(raw.workflowRoutesByMode)
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
  const taskTypeAggregate = event.taskType ? ensureAggregate(summary.byTaskType, event.taskType) : null;
  const modeAggregate = event.executionMode ? ensureAggregate(summary.byExecutionMode, event.executionMode) : null;
  switch (event.eventType) {
    case "task_started":
      if (!taskTypeAggregate) return;
      summary.totals.started += 1;
      taskTypeAggregate.started += 1;
      if (modeAggregate) modeAggregate.started += 1;
      break;
    case "task_completed":
      if (!taskTypeAggregate) return;
      summary.totals.completed += 1;
      taskTypeAggregate.completed += 1;
      if (modeAggregate) modeAggregate.completed += 1;
      if (event.executionMode === "worker") {
        summary.totals.workerExecutions += 1;
      }
      applyDuration(summary, taskTypeAggregate, modeAggregate, event.durationMs);
      break;
    case "task_blocked":
      if (!taskTypeAggregate) return;
      summary.totals.blocked += 1;
      taskTypeAggregate.blocked += 1;
      if (modeAggregate) modeAggregate.blocked += 1;
      if (event.blockedReasonCode) {
        summary.blockedReasons[event.blockedReasonCode] = (summary.blockedReasons[event.blockedReasonCode] || 0) + 1;
      }
      break;
    case "task_failed":
      if (!taskTypeAggregate) return;
      summary.totals.failed += 1;
      taskTypeAggregate.failed += 1;
      if (modeAggregate) modeAggregate.failed += 1;
      break;
    case "agent_call_created":
      summary.totals.agentCallsCreated += 1;
      break;
    case "agent_call_applied":
      if (!taskTypeAggregate) return;
      summary.totals.agentCallsApplied += 1;
      if (event.status === "failed") {
        summary.totals.failed += 1;
        taskTypeAggregate.failed += 1;
        if (modeAggregate) modeAggregate.failed += 1;
        break;
      }
      if (event.status === "blocked") {
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
    case "workflow_route_selected":
      summary.totals.workflowRoutesSelected += 1;
      applyWorkflowRouteCounters(summary, event);
      break;
    case "workflow_route_reused":
      summary.totals.workflowRoutesReused += 1;
      applyWorkflowRouteCounters(summary, event);
      break;
    case "workflow_route_fallback":
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

// scripts/src/lib/workflow-routing-selection.ts
var fs9 = __toESM(require("fs"));
var path12 = __toESM(require("path"));

// scripts/src/lib/project-detection.ts
var fs8 = __toESM(require("fs"));
var path10 = __toESM(require("path"));
var WORKSPACE_EXCLUDE_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  "dist",
  "build",
  ".codebuddy",
  ".git",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  ".cache"
]);
var MAX_SUB_PROJECTS = 20;
var PROJECT_MARKERS = [
  {
    files: ["package.json"],
    lang: "javascript",
    refinements: [
      { files: ["tsconfig.json"], lang: "typescript" }
    ]
  },
  { files: ["pom.xml"], lang: "java" },
  { files: ["build.gradle", "build.gradle.kts"], lang: "java" },
  { files: ["go.mod"], lang: "go" },
  { files: ["pyproject.toml", "setup.py"], lang: "python" },
  { files: ["Cargo.toml"], lang: "rust" }
];
var KNOWN_UI_LIBS = {
  "ant-design-vue": "Ant Design Vue",
  "vant": "Vant",
  "element-plus": "Element Plus",
  "element-ui": "Element UI",
  "naive-ui": "Naive UI",
  "vuetify": "Vuetify",
  "@arco-design/web-vue": "Arco Design Vue",
  "antd": "Ant Design",
  "@mui/material": "MUI"
};
var NODE_BACKEND_STRONG_ENTRY_FILES = [
  "src/server.ts",
  "src/server.js",
  "src/server.mjs",
  "src/server.cjs",
  "server.ts",
  "server.js",
  "server.mjs",
  "server.cjs"
];
var NODE_BACKEND_WEAK_ENTRY_FILES = [
  "src/main.ts",
  "src/main.js",
  "src/app.ts",
  "src/app.js",
  "main.ts",
  "main.js",
  "app.ts",
  "app.js",
  "index.ts",
  "index.js"
];
var NODE_BACKEND_LAYOUT_DIRS = [
  "src/routes",
  "src/controllers",
  "src/middleware",
  "src/handlers",
  "src/api",
  "routes",
  "controllers",
  "middleware",
  "handlers",
  "api"
];
function checkVueProfile(dependencies) {
  const vueVersion = dependencies.vue;
  if (!vueVersion) return null;
  if (vueVersion.startsWith("3") || vueVersion.startsWith("^3") || vueVersion.startsWith("~3")) {
    return { version: 3, type: "standard" };
  }
  if (vueVersion.startsWith("2") || vueVersion.startsWith("^2") || vueVersion.startsWith("~2")) {
    if (dependencies["@vue/composition-api"]) {
      return { version: 2, type: "composition" };
    }
    return { version: 2, type: "options" };
  }
  return null;
}
function normalizeStackTag(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function finalizeStackTags(values) {
  return [...new Set([...values].map(normalizeStackTag).filter(Boolean))].sort();
}
function readProjectFileIfExists(filePath) {
  try {
    return fs8.existsSync(filePath) ? fs8.readFileSync(filePath, "utf-8") : "";
  } catch {
    return "";
  }
}
function detectUILibs(deps) {
  const result = [];
  for (const [pkg, label] of Object.entries(KNOWN_UI_LIBS)) {
    if (deps[pkg]) {
      result.push(label);
    }
  }
  return result;
}
function detectNodePackageManagers(projectDir) {
  const markers = [
    { file: "pnpm-lock.yaml", tag: "pnpm" },
    { file: "yarn.lock", tag: "yarn" },
    { file: "package-lock.json", tag: "npm" },
    { file: "bun.lockb", tag: "bun" },
    { file: "bun.lock", tag: "bun" }
  ];
  return markers.filter((marker) => fs8.existsSync(path10.join(projectDir, marker.file))).map((marker) => marker.tag);
}
function detectGenericNodeBackendProject(projectDir, packageJson) {
  const scripts = packageJson.scripts || {};
  const scriptValues = Object.values(scripts).filter((value) => typeof value === "string");
  const hasBackendScript = scriptValues.some(
    (command) => /(node|nodemon|tsx|ts-node|ts-node-dev|bun|pm2)/i.test(command) && /(server|api|listen|http)/i.test(command)
  );
  for (const relativePath of NODE_BACKEND_STRONG_ENTRY_FILES) {
    if (fs8.existsSync(path10.join(projectDir, relativePath))) {
      return true;
    }
  }
  for (const relativePath of NODE_BACKEND_WEAK_ENTRY_FILES) {
    const absolutePath = path10.join(projectDir, relativePath);
    if (!fs8.existsSync(absolutePath)) {
      continue;
    }
    const content = readProjectFileIfExists(absolutePath);
    if (/(createServer|listen\s*\(|process\.env\.PORT|IncomingMessage|ServerResponse)/.test(content)) {
      return true;
    }
  }
  const layoutClues = NODE_BACKEND_LAYOUT_DIRS.filter(
    (relativePath) => fs8.existsSync(path10.join(projectDir, relativePath))
  ).length;
  if (layoutClues >= 2) {
    return true;
  }
  return hasBackendScript && layoutClues >= 1;
}
function detectJavaProjectMetadata(projectDir) {
  const pomContent = readProjectFileIfExists(path10.join(projectDir, "pom.xml"));
  const gradleContent = readProjectFileIfExists(path10.join(projectDir, "build.gradle")) || readProjectFileIfExists(path10.join(projectDir, "build.gradle.kts"));
  const combinedContent = `${pomContent}
${gradleContent}`.toLowerCase();
  const stackTags = /* @__PURE__ */ new Set(["java"]);
  if (pomContent) stackTags.add("maven");
  if (gradleContent) stackTags.add("gradle");
  let frameworkLabel = "";
  let projectKind = "library";
  if (/org\.springframework\.boot|spring-boot/.test(combinedContent)) {
    frameworkLabel = "Spring Boot";
    projectKind = "backend";
    stackTags.add("springboot");
    stackTags.add("spring");
  } else if (/io\.quarkus|quarkus/.test(combinedContent)) {
    frameworkLabel = "Quarkus";
    projectKind = "backend";
    stackTags.add("quarkus");
  } else if (/io\.micronaut|micronaut/.test(combinedContent)) {
    frameworkLabel = "Micronaut";
    projectKind = "backend";
    stackTags.add("micronaut");
  } else if (/jakarta\.ws\.rs|javax\.ws\.rs/.test(combinedContent)) {
    frameworkLabel = "Jakarta REST";
    projectKind = "backend";
    stackTags.add("jakartarest");
  }
  if (/spring-data-jpa|starter-data-jpa|hibernate-core|jakarta\.persistence|javax\.persistence/.test(combinedContent)) {
    stackTags.add("jpa");
  }
  if (/mybatis/.test(combinedContent)) {
    stackTags.add("mybatis");
  }
  return {
    frameworkLabel,
    uiLibLabels: [],
    projectKind,
    stackTags: finalizeStackTags(stackTags)
  };
}
function detectRustProjectMetadata(projectDir) {
  const cargoContent = readProjectFileIfExists(path10.join(projectDir, "Cargo.toml"));
  const normalizedContent = cargoContent.toLowerCase();
  const stackTags = /* @__PURE__ */ new Set(["rust", "cargo"]);
  let frameworkLabel = "";
  let projectKind = "library";
  if (/\baxum\b/.test(normalizedContent)) {
    frameworkLabel = "Axum";
    projectKind = "backend";
    stackTags.add("axum");
  } else if (/actix-web/.test(normalizedContent)) {
    frameworkLabel = "Actix Web";
    projectKind = "backend";
    stackTags.add("actixweb");
  } else if (/\brocket\b/.test(normalizedContent)) {
    frameworkLabel = "Rocket";
    projectKind = "backend";
    stackTags.add("rocket");
  } else if (/\btonic\b/.test(normalizedContent)) {
    frameworkLabel = "Tonic";
    projectKind = "backend";
    stackTags.add("tonic");
  }
  if (/\btokio\b/.test(normalizedContent)) stackTags.add("tokio");
  if (/\bserde\b/.test(normalizedContent)) stackTags.add("serde");
  if (/^\s*\[workspace\]/m.test(cargoContent)) stackTags.add("cargoworkspace");
  return {
    frameworkLabel,
    uiLibLabels: [],
    projectKind,
    stackTags: finalizeStackTags(stackTags)
  };
}
function detectDotnetProjectMetadata(projectDir) {
  const projectFiles = fs8.readdirSync(projectDir).filter((entry) => entry.endsWith(".csproj") || entry.endsWith(".fsproj"));
  const combinedContent = projectFiles.map((file) => readProjectFileIfExists(path10.join(projectDir, file))).join("\n").toLowerCase();
  const stackTags = /* @__PURE__ */ new Set(["dotnet"]);
  let frameworkLabel = "";
  let projectKind = "library";
  if (/microsoft\.aspnetcore|aspnetcore/.test(combinedContent)) {
    frameworkLabel = "ASP.NET Core";
    projectKind = "backend";
    stackTags.add("aspnetcore");
  } else if (/microsoft\.aspnetcore\.components|blazor/.test(combinedContent)) {
    frameworkLabel = "Blazor";
    projectKind = "frontend";
    stackTags.add("blazor");
  }
  return {
    frameworkLabel,
    uiLibLabels: [],
    projectKind,
    stackTags: finalizeStackTags(stackTags)
  };
}
function detectGenericProjectMetadata(lang) {
  return {
    frameworkLabel: "",
    uiLibLabels: [],
    projectKind: "unknown",
    stackTags: finalizeStackTags([lang])
  };
}
function detectNodeProjectMetadata(projectDir, packageJson, lang) {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const vueProfile = checkVueProfile(dependencies);
  const uiLibLabels = detectUILibs(dependencies);
  const stackTags = /* @__PURE__ */ new Set([lang, "nodejs", ...detectNodePackageManagers(projectDir)]);
  const detectedKinds = /* @__PURE__ */ new Set();
  let frameworkLabel = "";
  const markFramework = (label, kind, ...tags) => {
    if (!frameworkLabel) frameworkLabel = label;
    detectedKinds.add(kind);
    for (const tag of tags) stackTags.add(tag);
  };
  if (packageJson.type === "module") stackTags.add("esm");
  if (packageJson.workspaces) stackTags.add("monorepo");
  if (dependencies.vite) stackTags.add("vite");
  if (dependencies.webpack) stackTags.add("webpack");
  if (dependencies.next) markFramework("Next.js", "fullstack", "nextjs");
  if (dependencies.nuxt || dependencies.nuxt3) markFramework(frameworkLabel || "Nuxt", "fullstack", "nuxt");
  if (dependencies["@remix-run/node"] || dependencies["@remix-run/react"]) {
    markFramework(frameworkLabel || "Remix", "fullstack", "remix");
  }
  if (dependencies["@nestjs/core"]) markFramework(frameworkLabel || "NestJS", "backend", "nestjs");
  if (dependencies.express) markFramework(frameworkLabel || "Express", "backend", "express");
  if (dependencies.fastify) markFramework(frameworkLabel || "Fastify", "backend", "fastify");
  if (dependencies.koa) markFramework(frameworkLabel || "Koa", "backend", "koa");
  if (dependencies.hono) markFramework(frameworkLabel || "Hono", "backend", "hono");
  if (dependencies.vue) {
    const vueTags = vueProfile?.version === 3 ? ["vue", "vue3"] : vueProfile?.version === 2 ? ["vue", "vue2"] : ["vue"];
    markFramework(frameworkLabel || (vueProfile?.version === 3 ? "Vue 3" : vueProfile?.version === 2 ? "Vue 2" : "Vue"), "frontend", ...vueTags);
  }
  if (dependencies.react) markFramework(frameworkLabel || "React", "frontend", "react");
  if (dependencies["@angular/core"]) markFramework(frameworkLabel || "Angular", "frontend", "angular");
  if (dependencies.svelte) markFramework(frameworkLabel || "Svelte", "frontend", "svelte");
  if (!detectedKinds.has("backend") && !detectedKinds.has("frontend") && detectGenericNodeBackendProject(projectDir, packageJson)) {
    markFramework(frameworkLabel || "Node Service", "backend", "nodeservice");
  }
  for (const uiLibLabel of uiLibLabels) {
    stackTags.add(uiLibLabel);
  }
  let projectKind = "library";
  if (detectedKinds.has("fullstack") || detectedKinds.has("frontend") && detectedKinds.has("backend")) {
    projectKind = "fullstack";
  } else if (detectedKinds.has("backend")) {
    projectKind = "backend";
  } else if (detectedKinds.has("frontend")) {
    projectKind = "frontend";
  }
  return {
    dependencies,
    vueProfile,
    frameworkLabel,
    uiLibLabels,
    projectKind,
    stackTags: finalizeStackTags(stackTags)
  };
}
function detectProjectMetadata(projectDir, lang, packageJson) {
  if (packageJson) {
    return detectNodeProjectMetadata(projectDir, packageJson, lang);
  }
  const metadata = (() => {
    switch (lang) {
      case "java":
        return detectJavaProjectMetadata(projectDir);
      case "rust":
        return detectRustProjectMetadata(projectDir);
      case "dotnet":
        return detectDotnetProjectMetadata(projectDir);
      default:
        return detectGenericProjectMetadata(lang);
    }
  })();
  return {
    dependencies: {},
    vueProfile: null,
    ...metadata
  };
}
function discoverWorkspace(logger, targetDir) {
  const projects = [];
  const visited = /* @__PURE__ */ new Set();
  function scan(dir, depth) {
    if (depth > 2) return;
    if (projects.length >= MAX_SUB_PROJECTS) return;
    let realDir;
    try {
      realDir = fs8.realpathSync(dir);
    } catch {
      return;
    }
    if (visited.has(realDir)) return;
    visited.add(realDir);
    const relativePath = path10.relative(targetDir, dir).replace(/\\/g, "/") || ".";
    let detected = false;
    for (const marker of PROJECT_MARKERS) {
      const markerFile = marker.files.find((file) => fs8.existsSync(path10.join(dir, file)));
      if (!markerFile) continue;
      let lang = marker.lang;
      if (marker.refinements) {
        for (const refinement of marker.refinements) {
          if (refinement.files.some((file) => fs8.existsSync(path10.join(dir, file)))) {
            lang = refinement.lang;
            break;
          }
        }
      }
      if (markerFile === "package.json") {
        try {
          const pkgContent = JSON.parse(fs8.readFileSync(path10.join(dir, "package.json"), "utf-8"));
          const metadata = detectProjectMetadata(dir, lang, pkgContent);
          projects.push({
            name: pkgContent.name || path10.basename(dir),
            relativePath,
            absolutePath: dir,
            lang,
            packageJson: pkgContent,
            vueProfile: metadata.vueProfile,
            dependencies: metadata.dependencies,
            matchedLayer2Rules: [],
            frameworkLabel: metadata.frameworkLabel,
            uiLibLabels: metadata.uiLibLabels,
            projectKind: metadata.projectKind,
            stackTags: metadata.stackTags
          });
        } catch {
          logger.warn(`\u89E3\u6790 package.json \u5931\u8D25: ${path10.join(dir, "package.json")}`);
        }
      } else {
        const metadata = detectProjectMetadata(dir, lang);
        projects.push({
          name: path10.basename(dir),
          relativePath,
          absolutePath: dir,
          lang,
          vueProfile: metadata.vueProfile,
          dependencies: metadata.dependencies,
          matchedLayer2Rules: [],
          frameworkLabel: metadata.frameworkLabel,
          uiLibLabels: metadata.uiLibLabels,
          projectKind: metadata.projectKind,
          stackTags: metadata.stackTags
        });
      }
      detected = true;
      break;
    }
    if (!detected) {
      try {
        const entries = fs8.readdirSync(dir);
        const hasCsproj = entries.some((entry) => entry.endsWith(".csproj") || entry.endsWith(".sln"));
        if (hasCsproj) {
          const metadata = detectProjectMetadata(dir, "dotnet");
          projects.push({
            name: path10.basename(dir),
            relativePath,
            absolutePath: dir,
            lang: "dotnet",
            vueProfile: metadata.vueProfile,
            dependencies: metadata.dependencies,
            matchedLayer2Rules: [],
            frameworkLabel: metadata.frameworkLabel,
            uiLibLabels: metadata.uiLibLabels,
            projectKind: metadata.projectKind,
            stackTags: metadata.stackTags
          });
          detected = true;
        }
      } catch {
        return;
      }
    }
    if (depth < 2) {
      let entries;
      try {
        entries = fs8.readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.startsWith(".") || WORKSPACE_EXCLUDE_DIRS.has(entry)) continue;
        const childPath = path10.join(dir, entry);
        try {
          if (fs8.statSync(childPath).isDirectory()) {
            scan(childPath, depth + 1);
          }
        } catch {
        }
      }
    }
  }
  scan(targetDir, 0);
  if (projects.length >= MAX_SUB_PROJECTS) {
    logger.warn(`\u5B50\u9879\u76EE\u6570\u91CF\u5DF2\u8FBE\u4E0A\u9650 ${MAX_SUB_PROJECTS}\uFF0C\u540E\u7EED\u5B50\u9879\u76EE\u88AB\u622A\u65AD`);
  }
  const isWorkspace = projects.length > 1;
  if (isWorkspace) {
    logger.log(`\u53D1\u73B0 Workspace \u6A21\u5F0F\uFF1A${projects.length} \u4E2A\u5B50\u9879\u76EE`);
    for (const project of projects) {
      const label = [project.lang, project.frameworkLabel, ...project.uiLibLabels].filter(Boolean).join(" + ");
      logger.verbose(`  - ${project.relativePath} (${label || "\u65E0\u6846\u67B6\u68C0\u6D4B"})`);
    }
  }
  return {
    isWorkspace,
    rootDir: targetDir,
    projects,
    discoveredAt: (/* @__PURE__ */ new Date()).toISOString(),
    scope: "workspace-union",
    selectedProject: null,
    totalProjectCount: projects.length
  };
}

// scripts/src/lib/workflow-routing.ts
var path11 = __toESM(require("path"));
var BUILTIN_WORKFLOW_RANK = {
  micro: 1,
  sprint: 2,
  default: 3
};
var HOTFIX_SIGNAL = /(hotfix|quick fix|single[-\s]?file|单文件|快速修复|小\s*bug|小问题|补丁|patch)/i;
var LARGE_SCOPE_SIGNAL = /(新功能|feature|需求|prd|架构|跨模块|跨项目|大规模|major|multi[-\s]?module|multi[-\s]?project)/i;
function uniqStrings2(values) {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0)));
}
function inferWorkflowIdFromPath(workflowPath) {
  const baseName = path11.basename(workflowPath).replace(/\.workflow\.json$/i, "").replace(/\.json$/i, "");
  return baseName || "custom";
}
function asBuiltinWorkflowId(value) {
  if (value === "micro" || value === "sprint" || value === "default") {
    return value;
  }
  return null;
}
function getGeneratedAt(value) {
  return value || (/* @__PURE__ */ new Date()).toISOString();
}
function getWorkflowRank(workflowId) {
  return workflowId ? BUILTIN_WORKFLOW_RANK[workflowId] : Number.POSITIVE_INFINITY;
}
function getWorkflowBaseDir(options) {
  return options?.workflowBaseDir || path11.join(".codebuddy", "workflows");
}
function normalizeWorkflowCatalog(options) {
  const baseDir = getWorkflowBaseDir(options);
  return {
    default: options?.catalog?.default || path11.join(baseDir, "default.workflow.json"),
    sprint: options?.catalog?.sprint || path11.join(baseDir, "sprint.workflow.json"),
    micro: options?.catalog?.micro || path11.join(baseDir, "micro.workflow.json")
  };
}
function normalizeAvailableWorkflowIds(options) {
  const ids = options?.availableWorkflowIds ? Array.from(options.availableWorkflowIds) : ["default", "sprint", "micro"];
  return new Set(ids.map((value) => value.trim()).filter(Boolean));
}
function createDecision(params) {
  return {
    mode: params.mode,
    selectedWorkflowId: params.workflowId,
    canonicalWorkflowId: params.canonicalWorkflowId,
    selectedWorkflowPath: params.workflowPath,
    confidence: params.confidence,
    reasons: uniqStrings2(params.reasons),
    signals: params.signals ?? [],
    reusedFromTaskBook: params.reusedFromTaskBook,
    fallbackReason: params.fallbackReason,
    generatedAt: getGeneratedAt(params.generatedAt)
  };
}
function computeTaskDepth(taskId, tasksById, visiting, memo) {
  const cached = memo.get(taskId);
  if (typeof cached === "number") return cached;
  if (visiting.has(taskId)) {
    return 1;
  }
  visiting.add(taskId);
  const task = tasksById.get(taskId);
  const dependencies = task?.dependencies ?? [];
  let depth = 1;
  for (const dependencyId of dependencies) {
    if (!tasksById.has(dependencyId)) continue;
    depth = Math.max(depth, 1 + computeTaskDepth(dependencyId, tasksById, visiting, memo));
  }
  visiting.delete(taskId);
  memo.set(taskId, depth);
  return depth;
}
function computeMaxDependencyDepth(tasks) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const memo = /* @__PURE__ */ new Map();
  let maxDepth = 0;
  for (const task of tasks) {
    maxDepth = Math.max(maxDepth, computeTaskDepth(task.id, tasksById, /* @__PURE__ */ new Set(), memo));
  }
  return maxDepth;
}
function collectScopeCount(tasks, key) {
  const values = /* @__PURE__ */ new Set();
  for (const task of tasks) {
    const items = task.scope?.[key] ?? [];
    for (const item of items) {
      if (typeof item === "string" && item.trim()) {
        values.add(item.trim());
      }
    }
  }
  return values.size;
}
function collectRouteHints(taskBook) {
  const values = [taskBook.title, taskBook.description];
  for (const task of taskBook.tasks) {
    values.push(task.title);
    values.push(...task.acceptanceCriteria);
    values.push(...task.scope?.tags ?? []);
  }
  return uniqStrings2(values);
}
function buildSignal(id, matched, detail, weight) {
  return { id, matched, detail, weight };
}
function decideAutomaticWorkflow(input, options) {
  const catalog = normalizeWorkflowCatalog(options);
  const availableWorkflowIds = normalizeAvailableWorkflowIds(options);
  const routeText = input.routeHints.join(" ");
  const hasHotfixSignal = HOTFIX_SIGNAL.test(routeText);
  const hasLargeScopeSignal = LARGE_SCOPE_SIGNAL.test(routeText);
  const hasCrossProjectScope = input.selectedProjectCount > 1;
  const smallScope = input.scopedModuleCount <= 1 && (input.scopedFileCount === 0 || input.scopedFileCount <= 5);
  const tinyScope = input.scopedModuleCount <= 1 && (input.scopedFileCount === 0 || input.scopedFileCount <= 2);
  const signals = [
    buildSignal("has_requirement_or_prd", input.hasRequirementOrPrdTasks, input.hasRequirementOrPrdTasks ? "TaskBook \u5305\u542B requirement/prd \u4EFB\u52A1" : void 0, 5),
    buildSignal("has_design_tasks", input.hasDesignTasks, input.hasDesignTasks ? "TaskBook \u5305\u542B design \u4EFB\u52A1" : void 0, 4),
    buildSignal("has_build_fix_tasks", input.hasBuildFixTasks, input.hasBuildFixTasks ? "TaskBook \u5305\u542B\u72EC\u7ACB build-fix \u4EFB\u52A1" : void 0, 4),
    buildSignal("large_task_count", input.taskCount > 8, `taskCount=${input.taskCount}`, 4),
    buildSignal("deep_dependency_graph", input.maxDependencyDepth > 4, `maxDependencyDepth=${input.maxDependencyDepth}`, 3),
    buildSignal("cross_project_scope", hasCrossProjectScope, `selectedProjectCount=${input.selectedProjectCount}`, 5),
    buildSignal("wide_module_scope", input.scopedModuleCount > 2, `scopedModuleCount=${input.scopedModuleCount}`, 3),
    buildSignal("hotfix_signal", hasHotfixSignal, hasHotfixSignal ? "routeHints \u547D\u4E2D hotfix/quick-fix \u4FE1\u53F7" : void 0, 2),
    buildSignal("small_scope", smallScope, `scopedFileCount=${input.scopedFileCount}, scopedModuleCount=${input.scopedModuleCount}`, 2),
    buildSignal("has_review_tasks", input.hasReviewTasks, input.hasReviewTasks ? "TaskBook \u5305\u542B review \u4EFB\u52A1" : void 0, 2),
    buildSignal("has_high_priority_tasks", input.hasHighPriorityTasks, input.hasHighPriorityTasks ? "\u5B58\u5728 critical/high \u4EFB\u52A1" : void 0, 2),
    buildSignal("large_scope_signal", hasLargeScopeSignal, hasLargeScopeSignal ? "routeHints \u547D\u4E2D feature/refactor/architecture \u4FE1\u53F7" : void 0, 2)
  ];
  const defaultReasons = signals.filter((signal) => signal.matched && (signal.id === "has_requirement_or_prd" || signal.id === "has_design_tasks" || signal.id === "has_build_fix_tasks" || signal.id === "large_task_count" || signal.id === "deep_dependency_graph" || signal.id === "cross_project_scope" || signal.id === "wide_module_scope")).map((signal) => signal.detail || signal.id);
  if (defaultReasons.length > 0) {
    const selectedWorkflowId = "default";
    return resolveAutomaticDecision(selectedWorkflowId, {
      confidence: "high",
      reasons: [
        "\u68C0\u6D4B\u5230\u9AD8\u590D\u6742\u5EA6\u6216\u9AD8\u98CE\u9669\u4FE1\u53F7\uFF0C\u9009\u62E9 default.workflow.json \u4FDD\u6301\u5B8C\u6574\u95ED\u73AF\u3002",
        ...defaultReasons
      ],
      signals,
      catalog,
      availableWorkflowIds,
      generatedAt: options?.generatedAt
    });
  }
  const microEligible = input.taskCount <= 3 && !input.hasRequirementOrPrdTasks && !input.hasDesignTasks && !input.hasReviewTasks && !input.hasBuildFixTasks && input.maxDependencyDepth <= 2 && smallScope;
  if (microEligible && (hasHotfixSignal || tinyScope || input.taskType === "debugging" || input.taskType === "testing" || input.taskType === "code-review")) {
    const selectedWorkflowId = "micro";
    return resolveAutomaticDecision(selectedWorkflowId, {
      confidence: hasHotfixSignal || tinyScope ? "high" : "medium",
      reasons: [
        "\u4EFB\u52A1\u89C4\u6A21\u8F83\u5C0F\u4E14\u4E0D\u9700\u8981 requirement/review/build-fix \u5168\u95ED\u73AF\uFF0C\u4F18\u5148\u9009\u62E9 micro.workflow.json\u3002",
        `taskCount=${input.taskCount}`,
        `maxDependencyDepth=${input.maxDependencyDepth}`,
        `scopedFileCount=${input.scopedFileCount}`
      ],
      signals,
      catalog,
      availableWorkflowIds,
      generatedAt: options?.generatedAt
    });
  }
  const sprintEligible = input.taskCount <= 8 && input.maxDependencyDepth <= 4 && input.selectedProjectCount <= 1 && input.scopedModuleCount <= 2;
  if (sprintEligible) {
    const selectedWorkflowId = "sprint";
    return resolveAutomaticDecision(selectedWorkflowId, {
      confidence: input.hasReviewTasks || hasLargeScopeSignal ? "high" : "medium",
      reasons: [
        "\u4EFB\u52A1\u5C5E\u4E8E\u4E2D\u7B49\u89C4\u6A21\u8FED\u4EE3\uFF0C\u9002\u5408\u5206\u6790\u2192\u8BA1\u5212\u2192\u5B9E\u73B0\u2192\u5BA1\u67E5\u2192\u9A8C\u6536\u7684 sprint.workflow.json\u3002",
        `taskCount=${input.taskCount}`,
        `maxDependencyDepth=${input.maxDependencyDepth}`,
        input.hasReviewTasks ? "TaskBook \u5DF2\u5305\u542B review \u4EFB\u52A1\u3002" : "\u65E0\u9700 requirement/prd/design \u7684\u6700\u91CD\u95ED\u73AF\u3002"
      ],
      signals,
      catalog,
      availableWorkflowIds,
      generatedAt: options?.generatedAt
    });
  }
  return resolveAutomaticDecision("default", {
    confidence: "medium",
    reasons: [
      "\u8DEF\u7531\u4FE1\u53F7\u4E0D\u591F\u660E\u786E\uFF0C\u6309\u4FDD\u5B88\u7B56\u7565\u56DE\u9000\u5230 default.workflow.json\u3002"
    ],
    signals,
    catalog,
    availableWorkflowIds,
    generatedAt: options?.generatedAt
  });
}
function resolveAutomaticDecision(selectedWorkflowId, params) {
  if (params.availableWorkflowIds.has(selectedWorkflowId)) {
    return createDecision({
      mode: "auto",
      workflowId: selectedWorkflowId,
      workflowPath: params.catalog[selectedWorkflowId],
      canonicalWorkflowId: selectedWorkflowId,
      confidence: params.confidence,
      reasons: params.reasons,
      signals: params.signals,
      generatedAt: params.generatedAt
    });
  }
  return createDecision({
    mode: "fallback",
    workflowId: "default",
    workflowPath: params.catalog.default,
    canonicalWorkflowId: "default",
    confidence: "low",
    reasons: [
      ...params.reasons,
      `\u76EE\u6807 workflow(${selectedWorkflowId}) \u5F53\u524D\u4E0D\u53EF\u7528\uFF0C\u56DE\u9000\u5230 default.workflow.json\u3002`
    ],
    signals: params.signals,
    fallbackReason: `workflow_unavailable:${selectedWorkflowId}`,
    generatedAt: params.generatedAt
  });
}
function shouldReuseExistingDecision(automaticDecision, existingDecision) {
  if (!existingDecision || !existingDecision.selectedWorkflowPath) {
    return false;
  }
  const existingCanonical = existingDecision.canonicalWorkflowId;
  if (!existingCanonical) {
    return false;
  }
  return getWorkflowRank(existingCanonical) >= getWorkflowRank(automaticDecision.canonicalWorkflowId);
}
function toExplicitDecision(explicitWorkflowPath, options) {
  const workflowId = inferWorkflowIdFromPath(explicitWorkflowPath);
  const canonicalWorkflowId = asBuiltinWorkflowId(workflowId);
  return createDecision({
    mode: "explicit",
    workflowId,
    workflowPath: explicitWorkflowPath,
    canonicalWorkflowId,
    confidence: "high",
    reasons: ["\u663E\u5F0F\u6307\u5B9A\u4E86 workflow\uFF0C\u8DF3\u8FC7\u81EA\u52A8\u8DEF\u7531\u3002"],
    signals: [],
    generatedAt: options?.generatedAt
  });
}
function buildWorkflowRoutingInput(taskBook, workspaceInfo) {
  const tasks = taskBook.tasks ?? [];
  const selectedProjectCount = workspaceInfo?.scope === "project-targeted" ? 1 : workspaceInfo?.projects?.length || 1;
  return {
    taskBookId: taskBook.id,
    taskType: taskBook.taskType ?? null,
    taskCount: tasks.length,
    maxDependencyDepth: computeMaxDependencyDepth(tasks),
    hasRequirementOrPrdTasks: tasks.some((task) => task.type === "requirement" || task.type === "prd"),
    hasDesignTasks: tasks.some((task) => task.type === "design"),
    hasReviewTasks: tasks.some((task) => task.type === "review"),
    hasBuildFixTasks: tasks.some((task) => task.type === "build-fix"),
    hasHighPriorityTasks: tasks.some((task) => task.priority === "critical" || task.priority === "high"),
    scopedFileCount: collectScopeCount(tasks, "files"),
    scopedModuleCount: collectScopeCount(tasks, "modules"),
    workspaceProjectCount: workspaceInfo?.totalProjectCount || workspaceInfo?.projects?.length || 1,
    selectedProjectCount,
    projectKinds: uniqStrings2((workspaceInfo?.projects ?? []).map((project) => project.projectKind)),
    routeHints: collectRouteHints(taskBook)
  };
}
function buildWorkflowCatalog(workflowBaseDir = path11.join(".codebuddy", "workflows")) {
  return {
    default: path11.join(workflowBaseDir, "default.workflow.json"),
    sprint: path11.join(workflowBaseDir, "sprint.workflow.json"),
    micro: path11.join(workflowBaseDir, "micro.workflow.json")
  };
}
function selectWorkflowRoutingDecision(input, options) {
  const explicitWorkflowPath = options?.explicitWorkflowPath?.trim();
  if (explicitWorkflowPath && explicitWorkflowPath.toLowerCase() !== "auto") {
    return toExplicitDecision(explicitWorkflowPath, options);
  }
  const automaticDecision = decideAutomaticWorkflow(input, options);
  const existingDecision = options?.existingDecision ?? null;
  if (shouldReuseExistingDecision(automaticDecision, existingDecision)) {
    const workflowPath = existingDecision?.selectedWorkflowPath || (existingDecision?.canonicalWorkflowId ? normalizeWorkflowCatalog(options)[existingDecision.canonicalWorkflowId] : automaticDecision.selectedWorkflowPath);
    return createDecision({
      mode: "reused",
      workflowId: existingDecision?.selectedWorkflowId || automaticDecision.selectedWorkflowId,
      workflowPath,
      canonicalWorkflowId: existingDecision?.canonicalWorkflowId ?? automaticDecision.canonicalWorkflowId,
      confidence: existingDecision?.confidence || automaticDecision.confidence,
      reasons: [
        "\u590D\u7528\u65E2\u6709 workflow \u51B3\u7B56\u4EE5\u4FDD\u6301 rerun/reflow \u7A33\u5B9A\u6027\u3002",
        ...existingDecision?.reasons ?? automaticDecision.reasons
      ],
      signals: automaticDecision.signals,
      reusedFromTaskBook: true,
      generatedAt: options?.generatedAt
    });
  }
  return automaticDecision;
}

// scripts/src/lib/workflow-routing-selection.ts
function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}
function sanitizeForFilename(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
function ensureDir2(dirPath) {
  if (!fs9.existsSync(dirPath)) {
    fs9.mkdirSync(dirPath, { recursive: true });
  }
}
function createNoopLogger() {
  const noop = () => {
  };
  return {
    log: noop,
    verbose: noop,
    error: noop,
    warn: noop
  };
}
function readJsonFile(filePath) {
  if (!fs9.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs9.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function normalizeWorkflowRoutingDecision(decision) {
  return {
    ...decision,
    selectedWorkflowPath: toPosixPath(decision.selectedWorkflowPath)
  };
}
function workflowRoutingReportPath(projectRoot, taskBookId) {
  return path12.join(
    projectRoot,
    ".codebuddy",
    "reports",
    "workflow-routing",
    `${sanitizeForFilename(taskBookId)}.routing.json`
  );
}
function readWorkflowRoutingReport(projectRoot, taskBookId) {
  const parsed = readJsonFile(workflowRoutingReportPath(projectRoot, taskBookId));
  if (!parsed || parsed.taskBookId !== taskBookId || !parsed.decision) return null;
  return parsed;
}
function writeWorkflowRoutingReport(projectRoot, report) {
  const reportPath = workflowRoutingReportPath(projectRoot, report.taskBookId);
  try {
    ensureDir2(path12.dirname(reportPath));
    fs9.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}
`, "utf-8");
    return reportPath;
  } catch {
    return null;
  }
}
function buildWorkflowRouteDetails(decision, reportPath) {
  return {
    mode: decision.mode,
    workflowId: decision.selectedWorkflowId,
    workflowPath: toPosixPath(decision.selectedWorkflowPath),
    canonicalWorkflowId: decision.canonicalWorkflowId,
    confidence: decision.confidence,
    reasons: [...decision.reasons],
    fallbackReason: decision.fallbackReason,
    reusedFromTaskBook: decision.reusedFromTaskBook,
    reportPath: toPosixPath(reportPath)
  };
}
function buildWorkflowRoutingReport(params) {
  return {
    version: "1.0.0",
    taskBookId: params.taskBook.id,
    generatedAt: params.decision.generatedAt,
    workspace: params.workspaceInfo,
    input: params.input,
    decision: normalizeWorkflowRoutingDecision(params.decision)
  };
}
function selectWorkflowForTaskBook(params) {
  const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const catalog = buildWorkflowCatalog();
  const reportPath = workflowRoutingReportPath(params.projectRoot, params.taskBook.id);
  const explicitWorkflowPath = params.explicitWorkflowPath?.trim();
  const existingReport = readWorkflowRoutingReport(params.projectRoot, params.taskBook.id);
  const existingDecision = !explicitWorkflowPath || explicitWorkflowPath.toLowerCase() === "auto" ? existingReport?.decision?.mode === "explicit" ? null : existingReport?.decision ?? null : null;
  let input;
  let decision;
  let workspaceInfo = {
    scope: "workspace-union",
    selectedProject: null,
    totalProjectCount: 1
  };
  try {
    const workspace = discoverWorkspace(createNoopLogger(), params.projectRoot);
    workspaceInfo = {
      scope: workspace.scope,
      selectedProject: workspace.selectedProject,
      totalProjectCount: workspace.totalProjectCount || workspace.projects.length || 1
    };
    input = buildWorkflowRoutingInput(params.taskBook, workspace);
    const availableWorkflowIds = Object.entries(catalog).filter(([, workflowRelativePath]) => fs9.existsSync(path12.join(params.projectRoot, workflowRelativePath))).map(([workflowId]) => workflowId);
    decision = selectWorkflowRoutingDecision(input, {
      explicitWorkflowPath,
      existingDecision,
      availableWorkflowIds,
      generatedAt
    });
  } catch (error) {
    input = buildWorkflowRoutingInput(params.taskBook, null);
    if (explicitWorkflowPath && explicitWorkflowPath.toLowerCase() !== "auto") {
      decision = selectWorkflowRoutingDecision(input, {
        explicitWorkflowPath,
        generatedAt
      });
    } else {
      const message = error instanceof Error ? error.message : String(error);
      decision = {
        mode: "fallback",
        selectedWorkflowId: "default",
        canonicalWorkflowId: "default",
        selectedWorkflowPath: catalog.default,
        confidence: "low",
        reasons: [
          "\u81EA\u52A8 workflow \u8DEF\u7531\u5931\u8D25\uFF0C\u56DE\u9000\u5230 default.workflow.json\u3002",
          message
        ],
        signals: [],
        fallbackReason: "route_resolution_error",
        generatedAt
      };
    }
  }
  const report = buildWorkflowRoutingReport({
    taskBook: params.taskBook,
    input,
    decision,
    workspaceInfo
  });
  const writtenReportPath = writeWorkflowRoutingReport(params.projectRoot, report) ?? reportPath;
  return {
    workflowPath: decision.selectedWorkflowPath,
    reportPath: writtenReportPath,
    report,
    decision,
    details: buildWorkflowRouteDetails(decision, writtenReportPath)
  };
}

// scripts/src/task-executor.ts
var DEFAULT_CONFIG = {
  maxParallel: 3
};
var AGENT_CALLS_DIR3 = ".codebuddy/agent-calls";
var AGENT_CALL_MARKER = "[agent-call]";
var AGENT_CALL_RESULT_MARKER = "[agent-call-result]";
var DEFAULT_MANUAL_AGENT_ID = "task-orchestrator";
var MANUAL_AGENT_ID_ENV = "CODEBUDDY_MANUAL_AGENT_ID";
var REVIEW_REFLOW_TASK_TYPES = /* @__PURE__ */ new Set(["test", "implement", "refactor", "build-fix"]);
var FILE_DELETE_RETRY_CODES = /* @__PURE__ */ new Set(["EBUSY", "EMFILE", "ENFILE", "EPERM"]);
var FILE_DELETE_MAX_RETRIES = 6;
var FILE_DELETE_RETRY_MS = 40;
var SLEEP_INT322 = new Int32Array(new SharedArrayBuffer(4));
function sleepSync2(ms) {
  Atomics.wait(SLEEP_INT322, 0, 0, ms);
}
function buildTaskRoutingText(task) {
  return [
    task.title,
    ...task.acceptanceCriteria ?? [],
    ...task.scope?.tags ?? []
  ].filter((value) => typeof value === "string" && value.trim().length > 0).join(" ");
}
function isSystemOverviewDesignTask(task) {
  const text = buildTaskRoutingText(task);
  const hasOverviewSignal = /(系统概要设计|概要设计文档|概要设计|概设|系统设计文档)/i.test(text);
  if (hasOverviewSignal) return true;
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
  const env = (process.env[MANUAL_AGENT_ID_ENV] || "").trim();
  if (env) return env;
  if (/(性能|performance|lighthouse|web vitals|profil(e|ing))/i.test(task.title)) {
    return "performance-profiler";
  }
  if (/(安全|security|xss|csrf|owasp)/i.test(task.title)) {
    return "security-reviewer";
  }
  if (isRuntimeBugInvestigationTask(task)) {
    return "bug-investigator";
  }
  if (task.type === "design" && isSystemOverviewDesignTask(task)) {
    return "system-overview-writer";
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
function normalizeAgentIdentity(agentId, fallbackTask) {
  const trimmed = (agentId || "").trim();
  if (trimmed.startsWith("worker-executor:")) {
    const normalized = trimmed.slice("worker-executor:".length).trim();
    if (normalized) return normalized;
  }
  if (trimmed) return trimmed;
  return fallbackTask ? selectManualAgentId(fallbackTask) : "";
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
function collectTaskDeliverables(task, artifacts) {
  const values = /* @__PURE__ */ new Set();
  for (const filePath of task.scope?.files ?? []) {
    if (typeof filePath === "string" && filePath.trim()) {
      values.add(filePath.trim());
    }
  }
  for (const artifact of artifacts ?? []) {
    if (artifact && typeof artifact.path === "string" && artifact.path.trim()) {
      values.add(artifact.path.trim());
    }
  }
  return values.size > 0 ? Array.from(values) : void 0;
}
function summarizeActualWork(actualWork) {
  const singleLine = actualWork.replace(/\s+/g, " ").trim();
  if (!singleLine) return "";
  return singleLine.length > 180 ? `${singleLine.slice(0, 177)}...` : singleLine;
}
function selectBuildFixHandoffAnchorTasks(taskBook) {
  return taskBook.tasks.filter((task) => task.type === "build-fix" && task.status !== "skipped");
}
function buildBuildFixFailureContext(gateResult, retryCount, maxRounds, escalated) {
  const parts = [
    gateResult?.gateId ? `Quality gate ${gateResult.gateId} failed during build_and_fix.` : "Quality gate failed during build_and_fix.",
    gateResult?.message ? `Reason: ${gateResult.message}` : "",
    gateResult?.evidencePath ? `Evidence: ${gateResult.evidencePath}` : "",
    `Attempt: ${retryCount}/${maxRounds}.`,
    escalated ? "Retries exhausted; escalate to orchestrator/human review." : "Build-fix retry required."
  ];
  return parts.filter(Boolean).join(" ");
}
function appendBuildFixFailureHandoffs(manager, taskBookId, type, gateResult, retryCount, maxRounds) {
  const taskBook = manager.load(taskBookId);
  if (!taskBook) return;
  const anchors = selectBuildFixHandoffAnchorTasks(taskBook);
  if (anchors.length === 0) return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const context = buildBuildFixFailureContext(gateResult, retryCount, maxRounds, type === "escalation");
  for (const task of anchors) {
    const deliverables = collectTaskDeliverables(task);
    const handoff = type === "qa_fail" ? {
      from: "quality-gate",
      to: selectManualAgentId(task),
      type,
      timestamp,
      context,
      deliverables
    } : {
      from: selectManualAgentId(task),
      to: DEFAULT_MANUAL_AGENT_ID,
      type,
      timestamp,
      context,
      deliverables
    };
    manager.appendTaskHandoffs(taskBookId, task.id, [handoff]);
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
  getProjectRoot() {
    return this.manager.getProjectRoot();
  }
  resolveProjectPath(filePath) {
    return path13.resolve(this.getProjectRoot(), filePath);
  }
  getCurrentTaskAttemptKey(taskBookId, task) {
    const taskBook = this.manager.load(taskBookId);
    const currentTask = taskBook?.tasks.find((candidate) => candidate.id === task.id);
    return currentTask?.startedAt ?? task.startedAt;
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
  buildCompletionHandoffs(taskBookId, task, executedBy, actualWork, artifacts) {
    const taskBook = this.manager.load(taskBookId);
    if (!taskBook) return [];
    const deliverables = collectTaskDeliverables(task, artifacts);
    const handoffType = task.type === "review" ? "qa_pass" : "standard";
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
        actualWorkSummary ? `Summary: ${actualWorkSummary}` : ""
      ].filter(Boolean).join(" ");
      handoffs.push({
        from: executedBy,
        to: targetAgentId,
        type: handoffType,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        context,
        deliverables
      });
    }
    return handoffs;
  }
  recordCompletionHandoffs(taskBookId, task, executedBy, actualWork, artifacts) {
    const handoffs = this.buildCompletionHandoffs(taskBookId, task, executedBy, actualWork, artifacts);
    if (handoffs.length === 0) return;
    this.manager.appendTaskHandoffs(taskBookId, task.id, handoffs);
  }
  buildAgentCallFailureHandoffs(taskBookId, task, agentId, status, reason, artifacts) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const deliverables = collectTaskDeliverables(task, artifacts);
    const normalizedAgentId = normalizeAgentIdentity(agentId, task);
    const reasonSummary = summarizeActualWork(reason) || reason;
    if (task.type === "review" && status === "failed") {
      const taskBook = this.manager.load(taskBookId);
      if (!taskBook) return [];
      const handoffs = [];
      for (const dependencyId of task.dependencies) {
        const dependencyTask = taskBook.tasks.find((candidate) => candidate.id === dependencyId);
        if (!dependencyTask) continue;
        const targetAgentId = normalizeAgentIdentity(dependencyTask.executedBy, dependencyTask);
        if (!targetAgentId || targetAgentId === normalizedAgentId) {
          continue;
        }
        handoffs.push({
          from: normalizedAgentId,
          to: targetAgentId,
          type: "qa_fail",
          timestamp,
          context: `Review task ${task.id} (${task.title}) failed. Reason: ${reasonSummary}`,
          deliverables
        });
      }
      if (handoffs.length > 0) {
        return handoffs;
      }
    }
    return [{
      from: normalizedAgentId || selectManualAgentId(task),
      to: DEFAULT_MANUAL_AGENT_ID,
      type: "escalation",
      timestamp,
      context: `Agent call for ${task.id} (${task.title}) reported ${status}. Reason: ${reasonSummary}`,
      deliverables
    }];
  }
  recordAgentCallFailure(taskBookId, task, meta, result, reason) {
    const status = result.status === "blocked" ? "blocked" : "failed";
    const handoffs = this.buildAgentCallFailureHandoffs(taskBookId, task, meta.agentId, status, reason, result.artifacts);
    if (handoffs.length > 0) {
      this.manager.appendTaskHandoffs(taskBookId, task.id, handoffs);
    }
    const nextBlockedReason = appendAgentCallResultState(task.blockedReason, {
      requestId: meta.requestId,
      status,
      completedAt: result.completedAt,
      message: reason
    });
    this.manager.updateTask(taskBookId, task.id, {
      blockedReason: nextBlockedReason
    });
    this.manager.logChange(taskBookId, task.id, "modified", `agent-call reported ${status}: ${meta.requestId}`, void 0, {
      event: "agent-call",
      action: "reported_failure",
      requestId: meta.requestId,
      agentId: meta.agentId,
      kind: result.kind ?? meta.kind,
      status,
      completedAt: result.completedAt,
      promptPath: meta.promptPath,
      resultPath: meta.resultPath,
      artifacts: result.artifacts,
      reason,
      handoffTypes: handoffs.map((handoff) => handoff.type)
    });
    recordExecutionMetric({
      projectRoot: this.getProjectRoot(),
      eventType: "agent_call_applied",
      taskBookId,
      taskId: task.id,
      taskType: task.type,
      taskTitle: task.title,
      executionMode: "agent-call",
      agentId: meta.agentId,
      requestId: meta.requestId,
      status,
      durationMs: computeDurationMs(meta.createdAt, result.completedAt),
      blockedReasonCode: classifyBlockedReason(reason),
      blockedReason: truncateMetricText(reason)
    });
    this.tryAutoReflowFromQaFailure(taskBookId, task, meta, status, reason);
  }
  removeAgentCallFiles(paths) {
    const uniquePaths = [...new Set(paths.filter(Boolean).map((filePath) => this.resolveProjectPath(filePath)))];
    for (const filePath of uniquePaths) {
      for (let attempt = 0; attempt <= FILE_DELETE_MAX_RETRIES; attempt++) {
        try {
          fs10.unlinkSync(filePath);
          break;
        } catch (error) {
          const code = error && typeof error === "object" && "code" in error ? String(error.code ?? "") : "";
          if (code === "ENOENT") {
            break;
          }
          if (attempt >= FILE_DELETE_MAX_RETRIES || !FILE_DELETE_RETRY_CODES.has(code)) {
            try {
              fs10.rmSync(filePath, { force: true });
            } catch {
            }
            break;
          }
          sleepSync2(FILE_DELETE_RETRY_MS * (attempt + 1));
        }
      }
    }
  }
  clearAgentCallArtifacts(taskBookId, task) {
    const requestId = computeAgentCallRequestId(taskBookId, task.id, this.getCurrentTaskAttemptKey(taskBookId, task));
    this.removeAgentCallFiles([
      toPosixPath2(`${AGENT_CALLS_DIR3}/${requestId}.prompt.md`),
      toPosixPath2(`${AGENT_CALLS_DIR3}/${requestId}.result.json`)
    ]);
  }
  tryAutoReflowFromQaFailure(taskBookId, task, meta, status, reason) {
    if (task.type !== "review" || status !== "failed") {
      return false;
    }
    const taskBook = this.manager.load(taskBookId);
    if (!taskBook) return false;
    const reopenedTasks = task.dependencies.map((dependencyId) => taskBook.tasks.find((candidate) => candidate.id === dependencyId)).filter((candidate) => {
      if (!candidate) return false;
      return candidate.status === "done" && REVIEW_REFLOW_TASK_TYPES.has(candidate.type);
    });
    if (reopenedTasks.length === 0) {
      return false;
    }
    for (const reopenedTask of reopenedTasks) {
      this.clearAgentCallArtifacts(taskBookId, reopenedTask);
      this.manager.updateTask(taskBookId, reopenedTask.id, {
        status: "pending"
      });
    }
    this.removeAgentCallFiles([
      meta.promptPath,
      meta.resultPath
    ]);
    this.manager.updateTask(taskBookId, task.id, {
      status: "pending",
      blockedReason: ""
    });
    this.manager.logChange(taskBookId, task.id, "modified", `qa_fail auto reflow: reopened ${reopenedTasks.map((item) => item.id).join(", ")}`, void 0, {
      event: "qa_fail_reflow",
      reviewTaskId: task.id,
      reopenedTaskIds: reopenedTasks.map((item) => item.id),
      reopenedTaskTypes: reopenedTasks.map((item) => item.type),
      reason
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
          sourceTaskExecutedBy: candidate.executedBy
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
          sourceTaskExecutedBy: candidate.executedBy
        });
      }
    }
    return incoming.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
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
      projectRoot: this.getProjectRoot(),
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
      this.recordCompletionHandoffs(taskBookId, task, executedBy, actualWork, dispatchResult.artifacts);
      this.lastRenderedPrompt = null;
      const result = {
        taskId: task.id,
        success: true,
        actualWork,
        duration: Date.now() - startTime
      };
      recordExecutionMetric({
        projectRoot: this.getProjectRoot(),
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
          projectRoot: this.getProjectRoot(),
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
        projectRoot: this.getProjectRoot(),
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
    const requestId = computeAgentCallRequestId(taskBookId, task.id, this.getCurrentTaskAttemptKey(taskBookId, task));
    const projectRoot = this.getProjectRoot();
    const promptPath = toPosixPath2(`${AGENT_CALLS_DIR3}/${requestId}.prompt.md`);
    const resultPath = toPosixPath2(`${AGENT_CALLS_DIR3}/${requestId}.result.json`);
    const promptAbsPath = this.resolveProjectPath(promptPath);
    const resultAbsPath = this.resolveProjectPath(resultPath);
    ensureDir3(path13.dirname(promptAbsPath));
    let agentId = selectManualAgentId(task);
    if (fs10.existsSync(promptAbsPath)) {
      try {
        const existing = fs10.readFileSync(promptAbsPath, "utf-8");
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
    const agentDef = loadAgentDefinition(projectRoot, agentId);
    const agentDefMissingNote = !agentDef ? `

[agent-call] agent definition missing: expected ${listAgentDefinitionCandidatePaths(projectRoot, agentId).map((filePath) => path13.relative(projectRoot, filePath).replace(/\\/g, "/")).join(" or ")}.` : "";
    const runtimePrompt = this.lastRenderedPrompt;
    if (!fs10.existsSync(promptAbsPath)) {
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
        projectRoot,
        runtimePrompt: runtimePrompt ?? void 0
      });
      fs10.writeFileSync(promptAbsPath, prompt, "utf-8");
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
        projectRoot: this.getProjectRoot(),
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
    if (!fs10.existsSync(resultAbsPath)) {
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
      const resultAbsPath = this.resolveProjectPath(meta.resultPath);
      if (!fs10.existsSync(resultAbsPath)) continue;
      let result;
      try {
        result = parseAgentCallResult2(fs10.readFileSync(resultAbsPath, "utf-8"));
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
        const status = result.status === "blocked" ? "blocked" : "failed";
        const nextState = {
          requestId: meta.requestId,
          status,
          completedAt: result.completedAt,
          message: reason
        };
        if (isSameAgentCallResultState(extractAgentCallResultState(task.blockedReason), nextState)) {
          console.log(`[AgentCall] \u5DF2\u8BB0\u5F55\u5931\u8D25\u7ED3\u679C: ${meta.requestId} ${reason}`);
          continue;
        }
        console.log(`[AgentCall] \u8BB0\u5F55\u5931\u8D25\u7ED3\u679C: ${meta.requestId} ${reason}`);
        this.recordAgentCallFailure(taskBookId, task, meta, result, reason);
        applied += 1;
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
        blockedReason: "",
        executedBy: meta.agentId
      });
      this.recordCompletionHandoffs(taskBookId, task, meta.agentId, output.actualWork, result.artifacts);
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
        projectRoot: this.getProjectRoot(),
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
    const requestId = computeAgentCallRequestId(taskBookId, task.id, task.startedAt);
    const workerResult = this.workerExecutor.execute({
      requestId,
      taskBookId,
      agentId,
      projectRoot: this.getProjectRoot(),
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
    const taskBook = this.manager.load(taskBookId);
    const projectRoot = this.getProjectRoot();
    const currentAgentId = selectManualAgentId(task);
    const incomingHandoffs = taskBook ? this.collectIncomingHandoffs(taskBook, task, currentAgentId) : [];
    const taskSnapshot = {
      id: task.id,
      title: task.title,
      type: task.type,
      description: task.actualWork || "",
      priority: task.priority,
      acceptanceCriteria: task.acceptanceCriteria || [],
      scope: task.scope,
      incomingHandoffs: incomingHandoffs.length > 0 ? incomingHandoffs : void 0
    };
    const context = {
      taskBookId,
      task: taskSnapshot,
      projectRoot
    };
    const archReport = path13.join(projectRoot, ".codebuddy/reports/architecture/latest.json");
    const modulesReport = path13.join(projectRoot, ".codebuddy/reports/modules/latest.json");
    if (fs10.existsSync(archReport) || fs10.existsSync(modulesReport)) {
      context.reports = {};
      try {
        if (fs10.existsSync(archReport)) {
          context.reports.architecture = JSON.parse(fs10.readFileSync(archReport, "utf-8"));
        }
        if (fs10.existsSync(modulesReport)) {
          context.reports.modules = JSON.parse(fs10.readFileSync(modulesReport, "utf-8"));
        }
      } catch {
      }
    }
    if (task.scope?.files && task.scope.files.length > 0) {
      context.relatedFiles = [];
      for (const filePath of task.scope.files.slice(0, 10)) {
        const absPath = path13.resolve(projectRoot, filePath);
        if (fs10.existsSync(absPath)) {
          try {
            const content = fs10.readFileSync(absPath, "utf-8");
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
    const moduleMapper = path13.join(process.cwd(), ".codebuddy/scripts/module-mapper.js");
    const structureAnalyzer = path13.join(process.cwd(), ".codebuddy/scripts/structure-analyzer.js");
    const ran = [];
    if (fs10.existsSync(moduleMapper)) {
      const result = runNodeScript(moduleMapper, [".", "--mode", "summary", "--output", "json"]);
      if (!result.ok) {
        throw new Error(`\u5206\u6790\u5931\u8D25(module-mapper): ${result.stderr || result.stdout}`);
      }
      ran.push("module-mapper");
    }
    if (fs10.existsSync(structureAnalyzer)) {
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
    const designAgentId = selectManualAgentId(task);
    if (designAgentId === "system-overview-writer") {
      throw new Error(`MANUAL_REQUIRED: \u9700\u8981 system-overview-writer Agent \u751F\u6210\u7CFB\u7EDF\u6982\u8981\u8BBE\u8BA1\u6587\u6863\uFF1A${task.title}`);
    }
    if (designAgentId === "planner") {
      throw new Error(`MANUAL_REQUIRED: \u9700\u8981 planner Agent \u5B8C\u6210\u8BBE\u8BA1\u89C4\u5212\u4EFB\u52A1\uFF1A${task.title}`);
    }
    throw new Error(`MANUAL_REQUIRED: \u9700\u8981 ${designAgentId} Agent \u5B8C\u6210\u8BBE\u8BA1\u4EFB\u52A1\uFF1A${task.title}`);
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
  --workflow <path|auto> \u6307\u5B9A workflow \u6587\u4EF6\uFF1Bauto \u65F6\u542F\u7528\u81EA\u52A8\u9009\u8DEF
  --show-workflow-route \u8F93\u51FA workflow \u8DEF\u7531\u7406\u7531
  --approve <gateId>    \u9884\u5148\u6279\u51C6\u67D0\u4E2A gate\uFF08\u53EF\u91CD\u590D\uFF09
  --max-parallel <n>    \u8986\u76D6\u5E76\u884C\u5EA6\uFF08\u9ED8\u8BA4\u53D6 workflow.policies \u6216\u5185\u7F6E\u9ED8\u8BA4\u503C\uFF09
  --tasks-only          \u4E0D\u8BFB\u53D6 workflow\uFF0C\u76F4\u63A5\u6267\u884C\u6240\u6709\u4EFB\u52A1\uFF08\u65E7\u6A21\u5F0F\uFF09
  -h, --help            \u663E\u793A\u5E2E\u52A9

\u8BF4\u660E:
  - workflow \u65E9\u671F\u4E3B\u8981\u7528\u4E8E\u7EA6\u675F/\u5F15\u5BFC\uFF08\u4EA7\u7269\u3001\u987A\u5E8F\u3001\u8D28\u91CF\u95F8\u95E8\uFF09\uFF0C\u540E\u671F\u53EF\u6269\u5C55\u4E3A\u5F3A\u5236\u7F16\u6392\u5F15\u64CE\u3002
  - \u82E5\u6267\u884C\u9047\u5230 MANUAL_REQUIRED\uFF1A\u5C06\u751F\u6210 .codebuddy/agent-calls/<requestId>.prompt.md\uFF0C\u5E76\u628A\u4EFB\u52A1\u7F6E\u4E3A blocked\uFF1B\u5F53\u5199\u56DE\u5BF9\u5E94 result.json \u540E\uFF0C\u91CD\u8BD5\u6267\u884C\u4F1A\u81EA\u52A8 apply \u5E76\u7EE7\u7EED\u3002
`);
}
function printWorkflowRoute(details, showReasons) {
  console.log(
    `[Workflow] route: ${details.workflowId} (${details.mode}, confidence=${details.confidence}) -> ${details.workflowPath}`
  );
  console.log(`[Workflow] route report: ${details.reportPath}`);
  if (!showReasons) return;
  for (const reason of details.reasons) {
    console.log(`  - ${reason}`);
  }
  if (details.fallbackReason) {
    console.log(`  fallback: ${details.fallbackReason}`);
  }
}
function loadWorkflowSpec(workflowPath) {
  const raw = fs10.readFileSync(workflowPath, "utf-8");
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
function sanitizeForFilename2(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
function toPosixPath2(value) {
  return value.replace(/\\/g, "/");
}
function truncateMetricText(value, maxLength = 500) {
  const trimmed = String(value || "").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}
function computeAgentCallRequestId(taskBookId, taskId, attemptKey) {
  const normalizedAttemptKey = (attemptKey || "initial").trim() || "initial";
  const hash = (0, import_crypto.createHash)("sha1").update(`${taskBookId}:${taskId}:${normalizedAttemptKey}`).digest("hex").slice(0, 10);
  return `req-${sanitizeForFilename2(taskId)}-${hash}`;
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
function appendAgentCallResultState(blockedReason, state) {
  const base = stripAgentCallResultState(blockedReason);
  const lines = base ? base.split(/\r?\n/) : [];
  const summary = `Agent result (${state.status}): ${state.message}`;
  if (summary && !lines.some((line) => line.trim() === summary)) {
    lines.push(summary);
  }
  lines.push(`${AGENT_CALL_RESULT_MARKER} ${JSON.stringify(state)}`);
  return lines.join("\n").trim();
}
function stripAgentCallResultState(blockedReason) {
  if (!blockedReason) return "";
  return blockedReason.split(/\r?\n/).filter((line) => !line.trim().startsWith(AGENT_CALL_RESULT_MARKER)).join("\n").trim();
}
function extractAgentCallResultState(blockedReason) {
  if (!blockedReason) return null;
  const lines = blockedReason.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || !line.startsWith(AGENT_CALL_RESULT_MARKER)) {
      continue;
    }
    const jsonText = line.slice(AGENT_CALL_RESULT_MARKER.length).trim();
    if (!jsonText) return null;
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== "object") return null;
      if (typeof parsed.requestId !== "string" || !parsed.requestId.trim()) return null;
      if (parsed.status !== "failed" && parsed.status !== "blocked") return null;
      if (typeof parsed.message !== "string" || !parsed.message.trim()) return null;
      return {
        requestId: parsed.requestId,
        status: parsed.status,
        completedAt: typeof parsed.completedAt === "string" ? parsed.completedAt : void 0,
        message: parsed.message
      };
    } catch {
      return null;
    }
  }
  return null;
}
function isSameAgentCallResultState(left, right) {
  if (!left) return false;
  return left.requestId === right.requestId && left.status === right.status && (left.completedAt || "") === (right.completedAt || "") && left.message === right.message;
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
    promptPath: toPosixPath2(promptPath),
    resultPath: toPosixPath2(resultPath),
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
  if (!fs10.existsSync(filePath)) return null;
  return fs10.readFileSync(filePath, "utf-8");
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
  const candidates = listAgentDefinitionCandidatePaths(projectRoot, agentId);
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
    },
    "bug-investigator": {
      "analysis": "investigate.md"
    },
    "system-overview-writer": {
      "design": "execute.md"
    }
  };
  const agentPrompts = promptFileMap[agentId];
  if (!agentPrompts) return null;
  const fileName = agentPrompts[taskType];
  if (!fileName) return null;
  const candidates = listAgentPromptCandidatePaths(projectRoot, agentId, fileName);
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
      const promptTemplate = loadAgentPromptTemplate(args.projectRoot, args.meta.agentId, args.task.type);
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
        const ctx = collectContext(args.task, args.projectRoot);
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
  const pkgPath = path13.join(process.cwd(), "package.json");
  if (!fs10.existsSync(pkgPath)) return null;
  try {
    const raw = fs10.readFileSync(pkgPath, "utf-8");
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
    const safeTaskBookId = sanitizeForFilename2(taskBookId);
    const outDir = path13.join(process.cwd(), ".codebuddy", "reports", "gates", safeTaskBookId);
    ensureDir3(outDir);
    const fileName = `${safeTimestampForFilename()}.${sanitizeForFilename2(stepId)}.${sanitizeForFilename2(gateId)}.json`;
    const absPath = path13.join(outDir, fileName);
    fs10.writeFileSync(absPath, JSON.stringify(payload, null, 2), "utf-8");
    return toPosixPath2(path13.relative(process.cwd(), absPath));
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
function ensureDir3(dirPath) {
  if (!fs10.existsSync(dirPath)) {
    fs10.mkdirSync(dirPath, { recursive: true });
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
function findStepIndexByType(steps, type) {
  return steps.findIndex((step) => step.type === type);
}
function findReviewReflowStepIndex(steps, taskBook, currentIndex) {
  const hasPendingBuildFix = taskBook.tasks.some((task) => task.status === "pending" && task.type === "build-fix");
  if (hasPendingBuildFix) {
    const buildFixIndex = findStepIndexByType(steps, "build_and_fix");
    if (buildFixIndex >= 0 && buildFixIndex < currentIndex) {
      return buildFixIndex;
    }
  }
  const hasPendingImplementLike = taskBook.tasks.some(
    (task) => task.status === "pending" && (task.type === "test" || task.type === "implement" || task.type === "refactor")
  );
  if (hasPendingImplementLike) {
    const implementIndex = findStepIndexByType(steps, "tdd_implement");
    if (implementIndex >= 0 && implementIndex < currentIndex) {
      return implementIndex;
    }
  }
  return -1;
}
function logWorkflowRoutingDecision(manager, taskBookId, details) {
  const reason = details.mode === "reused" ? `workflow routing reused: ${details.workflowId}` : details.mode === "fallback" ? `workflow routing fallback: ${details.workflowId}` : `workflow routing selected: ${details.workflowId}`;
  manager.logChange(taskBookId, null, "modified", reason, void 0, {
    event: "workflow-routing",
    workflowId: details.workflowId,
    workflowPath: details.workflowPath,
    mode: details.mode,
    confidence: details.confidence,
    reportPath: details.reportPath,
    fallbackReason: details.fallbackReason,
    reusedFromTaskBook: details.reusedFromTaskBook,
    reasons: details.reasons
  });
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
  let workflowRouteDetails;
  const shouldAutoRoute = typeof options.workflowPath === "string" && options.workflowPath.trim().toLowerCase() === "auto";
  const workflowPath = shouldAutoRoute ? (() => {
    const selection = selectWorkflowForTaskBook({
      projectRoot: process.cwd(),
      taskBook,
      explicitWorkflowPath: "auto"
    });
    workflowRouteDetails = selection.details;
    logWorkflowRoutingDecision(manager, taskBookId, selection.details);
    recordWorkflowRoutingMetric({
      projectRoot: process.cwd(),
      taskBook,
      decision: selection.decision
    });
    printWorkflowRoute(selection.details, Boolean(options.showWorkflowRoute));
    return selection.workflowPath;
  })() : options.workflowPath ?? path13.join(process.cwd(), ".codebuddy/workflows/default.workflow.json");
  if (!fs10.existsSync(workflowPath)) {
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
      const moduleMapper = path13.join(process.cwd(), ".codebuddy/scripts/module-mapper.js");
      const structureAnalyzer = path13.join(process.cwd(), ".codebuddy/scripts/structure-analyzer.js");
      if (fs10.existsSync(moduleMapper)) {
        const r = runNodeScript(moduleMapper, [".", "--mode", "summary", "--output", "json"]);
        if (!r.ok) throw new Error(`module-mapper \u6267\u884C\u5931\u8D25: ${r.stderr || r.stdout}`);
      }
      if (fs10.existsSync(structureAnalyzer)) {
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
          return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
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
      const riskTier = inferRiskTier(manager.load(taskBookId) ?? taskBook, allowedTaskTypes);
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
        const pendingAllowed = current.tasks.filter((t) => t.status === "pending" && allowedTaskTypes.has(t.type));
        const blockedAllowed = current.tasks.filter((t) => t.status === "blocked" && allowedTaskTypes.has(t.type));
        if (pendingAllowed.length === 0) {
          if (hasStepGates && batchIndex === 0) {
            const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
              eventContext: "no_tasks",
              riskTier
            });
            if (!ok) return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
          }
          if (blockedAllowed.length > 0) {
            console.log(`[Workflow] implement_tasks \u5B58\u5728\u963B\u585E\u4EFB\u52A1\uFF08${blockedAllowed.length}\uFF09`);
            return { taskBook: current, gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
          }
          break;
        }
        const completedTaskIds = new Set(
          current.tasks.filter((t) => t.status === "done" || t.status === "skipped").map((t) => t.id)
        );
        const runnable = pendingAllowed.filter((t) => t.dependencies.every((depId) => completedTaskIds.has(depId)));
        if (runnable.length === 0) {
          console.log("[Workflow] implement_tasks \u6CA1\u6709\u53EF\u6267\u884C\u4EFB\u52A1\uFF08\u7B49\u5F85\u4F9D\u8D56\u5B8C\u6210\uFF09");
          return { taskBook: current, gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
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
          return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
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
          if (!ok) return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
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
          return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
        }
      }
      const gateRun = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
        eventContext: "build_and_fix_gate"
      });
      const failedGate = [...gateRun.gateResults].reverse().find((result) => !result.passed);
      if (!gateRun.ok) {
        const nextRetryCount = buildFixRetryCount + 1;
        appendBuildFixFailureHandoffs(manager, taskBookId, "qa_fail", failedGate, nextRetryCount, buildFixPolicy.maxRounds);
        buildFixRetryCount = nextRetryCount;
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
          appendBuildFixFailureHandoffs(manager, taskBookId, "escalation", failedGate, buildFixRetryCount, buildFixPolicy.maxRounds);
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
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
      }
      buildFixRetryCount = 0;
      stepIdx++;
      continue;
    }
    if (step.type === "run_tests") {
      const tasksResult = await executor.executeTasks(taskBookId, { allowedTaskTypes: ["test"], maxParallel, conflictStrategy });
      if (tasksResult.status !== "completed") {
        console.log(`[Workflow] test \u4EFB\u52A1\u672A\u5B8C\u6210: ${tasksResult.status} ${tasksResult.message ?? ""}`);
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
      }
      const { ok } = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
        eventContext: "run_tests_gate"
      });
      if (!ok) return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
      stepIdx++;
      continue;
    }
    if (step.type === "code_review") {
      const tasksResult = await executor.executeTasks(taskBookId, { allowedTaskTypes: ["review"], maxParallel, conflictStrategy });
      if (tasksResult.status !== "completed") {
        const current = manager.load(taskBookId);
        const reflowIdx = current ? findReviewReflowStepIndex(orderedSteps, current, stepIdx) : -1;
        if ((tasksResult.status === "waiting" || tasksResult.status === "blocked") && reflowIdx >= 0) {
          const reflowStep = orderedSteps[reflowIdx];
          console.log(`[Workflow] \u21A9 review \u9636\u6BB5\u68C0\u6D4B\u5230\u8FD4\u5DE5\u4EFB\u52A1\uFF0C\u56DE\u6D41\u5230 ${reflowStep.id}`);
          manager.logChange(taskBookId, null, "modified", `review reflow -> ${reflowStep.id}`, void 0, {
            event: "review_reflow",
            fromStepId: step.id,
            toStepId: reflowStep.id,
            resultStatus: tasksResult.status,
            message: tasksResult.message
          });
          stepIdx = reflowIdx;
          continue;
        }
        console.log(`[Workflow] review \u4EFB\u52A1\u672A\u5B8C\u6210: ${tasksResult.status} ${tasksResult.message ?? ""}`);
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
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
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
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
        return { taskBook: current, gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
      }
      const acceptanceGateRun = await runCheckGatesForStep(spec, step, taskBookId, manager, approved, gateResults, {
        eventContext: "acceptance_gate"
      });
      if (!acceptanceGateRun.ok) {
        return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
      }
      const requiredGates = (spec.gates ?? []).filter((g) => g.required !== false);
      const failedRequired = requiredGates.filter((g) => !gateResults.get(g.id)?.passed && !approved.has(g.id));
      if (failedRequired.length > 0) {
        console.log(`[Workflow] \u4ECD\u6709\u672A\u901A\u8FC7\u7684\u8D28\u91CF\u95F8\u95E8: ${failedRequired.map((g) => g.id).join(", ")}`);
        return { taskBook: current, gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
      }
      const report = manager.generateAcceptanceReport(taskBookId);
      if (report) {
        const outDir = path13.join(process.cwd(), ".codebuddy/reports/taskbooks");
        ensureDir3(outDir);
        const outPath = path13.join(outDir, `${taskBookId}.acceptance.json`);
        fs10.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
        console.log(`[Workflow] \u2705 \u5DF2\u751F\u6210\u9A8C\u6536\u62A5\u544A: .codebuddy/reports/taskbooks/${taskBookId}.acceptance.json`);
      }
      manager.updateStatus(taskBookId, "completed");
      console.log("[Workflow] \u2705 TaskBook \u5DF2\u5B8C\u6210\u5E76\u5F52\u6863\u5230 history");
      return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
    }
    console.log(`[Workflow] \u26A0 \u672A\u8BC6\u522B\u7684 step.type: ${step.type}\uFF08\u8DF3\u8FC7\uFF09`);
    stepIdx++;
  }
  return { taskBook: manager.load(taskBookId), gateResults: Array.from(gateResults.values()), workflowRoute: workflowRouteDetails };
}
function createDefaultRuntime() {
  const cwd = process.cwd();
  const existingCandidateRoots = getProjectAgentRootCandidates(cwd).map((relativeRoot) => ({
    relativeRoot,
    absoluteRoot: path13.join(cwd, relativeRoot)
  })).filter((candidate) => fs10.existsSync(candidate.absoluteRoot) && fs10.statSync(candidate.absoluteRoot).isDirectory());
  if (existingCandidateRoots.length === 0) {
    return void 0;
  }
  try {
    const [primaryRoot, fallbackRoot] = existingCandidateRoots;
    const runtime = createAgentRuntime({
      projectRoot: cwd,
      agentsDir: primaryRoot.relativeRoot,
      fallbackAgentsDir: fallbackRoot?.relativeRoot,
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
    tasksOnly: false,
    showWorkflowRoute: false
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
    if (arg === "--show-workflow-route") {
      parsed.showWorkflowRoute = true;
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
      maxParallelTasks: parsed.maxParallel,
      showWorkflowRoute: parsed.showWorkflowRoute
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
  createTaskExecutor,
  runWorkflow
});
