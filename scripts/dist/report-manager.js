#!/usr/bin/env node
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

// scripts/src/report-manager.ts
var report_manager_exports = {};
__export(report_manager_exports, {
  appendHealthDataPoint: () => appendHealthDataPoint,
  buildAndPersistAuditSnapshot: () => buildAndPersistAuditSnapshot,
  buildAuditSnapshot: () => buildAuditSnapshot,
  buildDiffSnapshot: () => buildDiffSnapshot,
  buildExportSnapshot: () => buildExportSnapshot,
  buildHistorySnapshot: () => buildHistorySnapshot,
  buildStatusSnapshot: () => buildStatusSnapshot,
  buildTrendSnapshot: () => buildTrendSnapshot,
  cleanupReports: () => cleanup,
  getReportAgeHours: () => getReportAgeHours,
  getReportsPath: () => getReportsPath,
  readAuditHistory: () => readAuditHistory,
  readLatestAuditReport: () => readLatestAuditReport,
  readLatestValidatorGateReport: () => readLatestValidatorGateReport,
  readManifest: () => readManifest,
  readReport: () => readReport,
  readValidatorGateHistory: () => readValidatorGateHistory,
  reportExists: () => reportExists,
  saveArchitectureSnapshot: () => saveArchitectureSnapshot,
  saveModuleMapSnapshot: () => saveModuleMapSnapshot,
  writeManifest: () => writeManifest,
  writeReport: () => writeReport
});
module.exports = __toCommonJS(report_manager_exports);
var fs4 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
var crypto = __toESM(require("crypto"));

// scripts/src/lib/cli-entry.ts
var path = __toESM(require("path"));
function isDirectCliEntry(expectedFileNames) {
  const argvPath = process.argv[1];
  if (!argvPath) return false;
  const actual = path.basename(argvPath).toLowerCase();
  const expected = Array.isArray(expectedFileNames) ? expectedFileNames : [expectedFileNames];
  return expected.some((name) => actual === name.toLowerCase());
}

// scripts/src/lib/audit-report.ts
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// scripts/src/types/reports.ts
var DEFAULT_RETENTION_POLICY = {
  snapshots: {
    maxCount: 10,
    maxAgeDays: 30
  },
  validators: {
    maxCount: 20,
    maxAgeDays: 30
  },
  audits: {
    maxCount: 20,
    maxAgeDays: 30
  },
  health: {
    dailyRetentionDays: 90,
    weeklyRetentionDays: 365
  },
  tasks: {
    maxCount: 50,
    maxAgeDays: 180
  },
  cache: {
    maxAgeDays: 7
  }
};
var DEFAULT_MANIFEST = {
  version: "1.0.0",
  projectName: "",
  lastUpdated: "",
  reports: {
    architecture: null,
    modules: null,
    health: null,
    tasks: null
  },
  settings: {
    retentionDays: 30,
    maxSnapshots: 10,
    autoCleanup: true
  }
};

// scripts/src/lib/audit-report.ts
var AUDIT_CANDIDATE_PATHS = [
  "audit/latest/audit-summary.json",
  "audit/audit-summary.json"
];
var AUDIT_STANDARD_LATEST_DIR = ".codebuddy/reports/audit/latest";
var AUDIT_HISTORY_ROOT = ".codebuddy/reports/audit/history";
function readAuditSummaryFile(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (parsed && typeof parsed.generatedAt === "string" && parsed.overview && Array.isArray(parsed.findings)) {
      return parsed;
    }
  } catch {
  }
  return null;
}
function readLatestAuditReport(targetDir) {
  for (const relativePath of AUDIT_CANDIDATE_PATHS) {
    const absolutePath = path2.join(targetDir, ".codebuddy", "reports", relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    const parsed = readAuditSummaryFile(absolutePath);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}
function readAuditHistory(targetDir, limit = 10) {
  const historyRoot = path2.join(targetDir, AUDIT_HISTORY_ROOT);
  if (!fs.existsSync(historyRoot)) {
    return [];
  }
  const entries = [];
  for (const dirent of fs.readdirSync(historyRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const summaryPath = path2.join(historyRoot, dirent.name, "audit-summary.json");
    if (!fs.existsSync(summaryPath)) {
      continue;
    }
    const summary = readAuditSummaryFile(summaryPath);
    if (!summary) {
      continue;
    }
    entries.push({
      relativePath: path2.posix.join("audit/history", dirent.name, "audit-summary.json"),
      generatedAt: summary.generatedAt,
      overallStatus: summary.overview.overallStatus,
      findingsCount: summary.overview.findingsCount,
      validatorStatus: summary.overview.validatorStatus,
      validatorDirection: summary.overview.validatorDirection
    });
  }
  entries.sort((left, right) => {
    const leftTime = new Date(left.generatedAt).getTime();
    const rightTime = new Date(right.generatedAt).getTime();
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return rightTime - leftTime;
  });
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : entries.length;
  return entries.slice(0, normalizedLimit);
}
function cleanupAuditHistory(targetDir, retention = DEFAULT_RETENTION_POLICY.audits) {
  const historyRoot = path2.join(targetDir, AUDIT_HISTORY_ROOT);
  if (!fs.existsSync(historyRoot)) {
    return 0;
  }
  const entries = fs.readdirSync(historyRoot, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => {
    const directoryPath = path2.join(historyRoot, dirent.name);
    const summaryPath = path2.join(directoryPath, "audit-summary.json");
    const summary = fs.existsSync(summaryPath) ? readAuditSummaryFile(summaryPath) : null;
    const generatedAt = summary?.generatedAt ?? null;
    const time = generatedAt ? new Date(generatedAt).getTime() : fs.statSync(directoryPath).mtime.getTime();
    return {
      directoryPath,
      time
    };
  }).sort((left, right) => right.time - left.time);
  const maxAgeMs = retention.maxAgeDays * 24 * 60 * 60 * 1e3;
  const now = Date.now();
  let removed = 0;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const tooMany = index >= retention.maxCount;
    const tooOld = Number.isFinite(entry.time) ? now - entry.time > maxAgeMs : false;
    if (!tooMany && !tooOld) {
      continue;
    }
    fs.rmSync(entry.directoryPath, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

// scripts/src/lib/validator-gate-report.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var VALIDATOR_GATE_CANDIDATE_PATHS = [
  "validators/latest/validator-gate-summary.json",
  "validators/validator-gate-summary.json"
];
var VALIDATOR_GATE_HISTORY_ROOT = ".codebuddy/reports/validators/history";
function readValidatorGateSummaryFile(filePath) {
  try {
    const parsed = JSON.parse(fs2.readFileSync(filePath, "utf-8"));
    if (parsed && typeof parsed.generatedAt === "string") {
      return parsed;
    }
  } catch {
  }
  return null;
}
function readLatestValidatorGateReport(targetDir) {
  for (const relativePath of VALIDATOR_GATE_CANDIDATE_PATHS) {
    const absolutePath = path3.join(targetDir, ".codebuddy", "reports", relativePath);
    if (!fs2.existsSync(absolutePath)) {
      continue;
    }
    const parsed = readValidatorGateSummaryFile(absolutePath);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}
function readValidatorGateHistory(targetDir, limit = 10) {
  const historyRoot = path3.join(targetDir, VALIDATOR_GATE_HISTORY_ROOT);
  if (!fs2.existsSync(historyRoot)) {
    return [];
  }
  const entries = [];
  for (const dirent of fs2.readdirSync(historyRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const summaryPath = path3.join(historyRoot, dirent.name, "validator-gate-summary.json");
    if (!fs2.existsSync(summaryPath)) {
      continue;
    }
    const summary = readValidatorGateSummaryFile(summaryPath);
    if (!summary) {
      continue;
    }
    entries.push({
      relativePath: path3.posix.join("validators/history", dirent.name, "validator-gate-summary.json"),
      generatedAt: summary.generatedAt,
      scope: summary.scope,
      strictMode: summary.strictMode,
      effectiveOk: summary.effectiveOk,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      issueCount: summary.issueCount
    });
  }
  entries.sort((left, right) => {
    const leftTime = new Date(left.generatedAt).getTime();
    const rightTime = new Date(right.generatedAt).getTime();
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return rightTime - leftTime;
  });
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : entries.length;
  return entries.slice(0, normalizedLimit);
}
function getPreviousValidatorGateEntry(latest, history) {
  if (!latest || history.length === 0) {
    return null;
  }
  return history.find((entry) => entry.generatedAt !== latest.generatedAt) || null;
}
function computeValidatorGateSeverityScore(entry) {
  const failPenalty = entry.effectiveOk ? 0 : 1e6;
  return failPenalty + entry.errorCount * 1e4 + entry.warningCount * 100 + entry.issueCount;
}
function buildValidatorGateDelta(latest, previous) {
  if (!latest || !previous) {
    return null;
  }
  const errorDelta = latest.errorCount - previous.errorCount;
  const warningDelta = latest.warningCount - previous.warningCount;
  const issueDelta = latest.issueCount - previous.issueCount;
  const effectiveOkChanged = latest.effectiveOk !== previous.effectiveOk;
  const latestScore = computeValidatorGateSeverityScore(latest);
  const previousScore = computeValidatorGateSeverityScore(previous);
  let direction = "stable";
  if (latestScore > previousScore) {
    direction = "regressed";
  } else if (latestScore < previousScore) {
    direction = "improved";
  }
  return {
    previousGeneratedAt: previous.generatedAt,
    errorDelta,
    warningDelta,
    issueDelta,
    effectiveOkChanged,
    direction
  };
}
function cleanupValidatorGateHistory(targetDir, retention = DEFAULT_RETENTION_POLICY.validators) {
  const historyRoot = path3.join(targetDir, VALIDATOR_GATE_HISTORY_ROOT);
  if (!fs2.existsSync(historyRoot)) {
    return 0;
  }
  const entries = fs2.readdirSync(historyRoot, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => {
    const directoryPath = path3.join(historyRoot, dirent.name);
    const summaryPath = path3.join(directoryPath, "validator-gate-summary.json");
    const summary = fs2.existsSync(summaryPath) ? readValidatorGateSummaryFile(summaryPath) : null;
    const generatedAt = summary?.generatedAt ?? null;
    const time = generatedAt ? new Date(generatedAt).getTime() : fs2.statSync(directoryPath).mtime.getTime();
    return {
      directoryPath,
      time
    };
  }).sort((left, right) => right.time - left.time);
  const maxAgeMs = retention.maxAgeDays * 24 * 60 * 60 * 1e3;
  const now = Date.now();
  let removed = 0;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const tooMany = index >= retention.maxCount;
    const tooOld = Number.isFinite(entry.time) ? now - entry.time > maxAgeMs : false;
    if (!tooMany && !tooOld) {
      continue;
    }
    fs2.rmSync(entry.directoryPath, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

// scripts/src/lib/workflow-routing-selection.ts
var fs3 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
function readJsonFile(filePath) {
  if (!fs3.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs3.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function listWorkflowRoutingReportPaths(projectRoot) {
  const reportsDir = path4.join(projectRoot, ".codebuddy", "reports", "workflow-routing");
  if (!fs3.existsSync(reportsDir)) return [];
  return fs3.readdirSync(reportsDir).filter((fileName) => fileName.endsWith(".routing.json")).map((fileName) => path4.join(reportsDir, fileName)).sort((left, right) => {
    try {
      return fs3.statSync(right).mtimeMs - fs3.statSync(left).mtimeMs;
    } catch {
      return 0;
    }
  });
}
function readLatestWorkflowRoutingReport(projectRoot) {
  for (const reportPath of listWorkflowRoutingReportPaths(projectRoot)) {
    const parsed = readJsonFile(reportPath);
    if (parsed && parsed.taskBookId && parsed.decision) {
      return parsed;
    }
  }
  return null;
}

// scripts/src/report-manager.ts
var REPORTS_DIR = ".codebuddy/reports";
var MANIFEST_FILE = "manifest.json";
function getReportsPath(targetDir) {
  return path5.join(targetDir, REPORTS_DIR);
}
function ensureDir(dirPath) {
  if (!fs4.existsSync(dirPath)) {
    fs4.mkdirSync(dirPath, { recursive: true });
  }
}
function writeJsonReport(filePath, payload) {
  ensureDir(path5.dirname(filePath));
  fs4.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
}
function buildHistoryStamp(isoTimestamp) {
  return isoTimestamp.replace(/[:.]/g, "-");
}
function computeHash(content) {
  return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
}
function formatAge(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1e3 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return "just now";
}
function getReportAgeHours(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  return Math.floor(diff / (1e3 * 60 * 60));
}
function buildReportStatusSection(meta) {
  if (!meta) {
    return {
      present: false,
      generatedAt: null,
      ageHours: null,
      ageLabel: null,
      freshness: "missing"
    };
  }
  const ageHours = getReportAgeHours(meta.generatedAt);
  return {
    present: true,
    generatedAt: meta.generatedAt,
    ageHours,
    ageLabel: formatAge(meta.generatedAt),
    freshness: ageHours < 24 ? "fresh" : "stale"
  };
}
function readManifest(targetDir) {
  const manifestPath = path5.join(getReportsPath(targetDir), MANIFEST_FILE);
  if (!fs4.existsSync(manifestPath)) {
    return {
      ...DEFAULT_MANIFEST,
      projectName: path5.basename(targetDir),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  try {
    const content = fs4.readFileSync(manifestPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      ...DEFAULT_MANIFEST,
      projectName: path5.basename(targetDir),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function writeManifest(targetDir, manifest) {
  const reportsPath = getReportsPath(targetDir);
  ensureDir(reportsPath);
  manifest.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  const manifestPath = path5.join(reportsPath, MANIFEST_FILE);
  fs4.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}
function reportExists(targetDir, reportPath) {
  const fullPath = path5.join(getReportsPath(targetDir), reportPath);
  return fs4.existsSync(fullPath);
}
function readReport(targetDir, reportPath) {
  const fullPath = path5.join(getReportsPath(targetDir), reportPath);
  if (!fs4.existsSync(fullPath)) {
    return null;
  }
  try {
    const content = fs4.readFileSync(fullPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function writeReport(targetDir, reportPath, data, generatedBy) {
  const reportsPath = getReportsPath(targetDir);
  const fullPath = path5.join(reportsPath, reportPath);
  const dirPath = path5.dirname(fullPath);
  ensureDir(dirPath);
  const content = JSON.stringify(data, null, 2);
  fs4.writeFileSync(fullPath, content, "utf-8");
  const meta = {
    type: getReportType(reportPath),
    path: reportPath,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    generatedBy,
    hash: computeHash(content),
    size: Buffer.byteLength(content, "utf-8")
  };
  const manifest = readManifest(targetDir);
  updateManifestReport(manifest, meta);
  writeManifest(targetDir, manifest);
  return meta;
}
function getReportType(reportPath) {
  if (reportPath.includes("architecture")) return "architecture-snapshot";
  if (reportPath.includes("modules")) return "module-map";
  if (reportPath.includes("health")) return "health-timeline";
  if (reportPath.includes("tasks")) return "task-context";
  return "architecture-snapshot";
}
function updateManifestReport(manifest, meta) {
  switch (meta.type) {
    case "architecture-snapshot":
      manifest.reports.architecture = meta;
      break;
    case "module-map":
      manifest.reports.modules = meta;
      break;
    case "health-timeline":
      manifest.reports.health = meta;
      break;
    case "task-context":
      manifest.reports.tasks = meta;
      break;
  }
}
function saveArchitectureSnapshot(targetDir, snapshot) {
  const meta = writeReport(
    targetDir,
    "architecture/latest.json",
    snapshot,
    "structure-analyzer"
  );
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const historyPath = `architecture/${timestamp}.json`;
  const historyFullPath = path5.join(getReportsPath(targetDir), historyPath);
  const historyDir = path5.dirname(historyFullPath);
  ensureDir(historyDir);
  fs4.writeFileSync(historyFullPath, JSON.stringify(snapshot, null, 2), "utf-8");
  cleanupOldSnapshots(targetDir, "architecture");
  return meta;
}
function cleanupOldSnapshots(targetDir, subDir) {
  const dirPath = path5.join(getReportsPath(targetDir), subDir);
  if (!fs4.existsSync(dirPath)) return;
  const files = fs4.readdirSync(dirPath).filter((f) => f.endsWith(".json") && f !== "latest.json").map((f) => ({
    name: f,
    path: path5.join(dirPath, f),
    time: fs4.statSync(path5.join(dirPath, f)).mtime.getTime()
  })).sort((a, b) => b.time - a.time);
  const { maxCount, maxAgeDays } = DEFAULT_RETENTION_POLICY.snapshots;
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1e3;
  const now = Date.now();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (i >= maxCount || now - file.time > maxAge) {
      fs4.unlinkSync(file.path);
    }
  }
}
function saveModuleMapSnapshot(targetDir, snapshot) {
  const meta = writeReport(
    targetDir,
    "modules/latest.json",
    snapshot,
    "module-mapper"
  );
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const historyPath = `modules/${timestamp}.json`;
  const historyFullPath = path5.join(getReportsPath(targetDir), historyPath);
  const historyDir = path5.dirname(historyFullPath);
  ensureDir(historyDir);
  fs4.writeFileSync(historyFullPath, JSON.stringify(snapshot, null, 2), "utf-8");
  cleanupOldSnapshots(targetDir, "modules");
  return meta;
}
function appendHealthDataPoint(targetDir, dataPoint) {
  let timeline = readReport(targetDir, "health/timeline.json");
  if (!timeline) {
    timeline = {
      meta: {
        version: "1.0.0",
        projectName: path5.basename(targetDir),
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      },
      dataPoints: [],
      trends: {
        direction: "stable",
        changeRate: 0,
        prediction: dataPoint.healthScore
      }
    };
  }
  const today = dataPoint.date;
  const existingIndex = timeline.dataPoints.findIndex((dp) => dp.date === today);
  if (existingIndex >= 0) {
    timeline.dataPoints[existingIndex] = dataPoint;
  } else {
    timeline.dataPoints.push(dataPoint);
  }
  timeline.dataPoints.sort((a, b) => a.date.localeCompare(b.date));
  timeline.trends = calculateTrends(timeline.dataPoints);
  timeline.meta.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  writeReport(targetDir, "health/timeline.json", timeline, "report-manager");
}
function calculateTrends(dataPoints) {
  if (dataPoints.length < 2) {
    return {
      direction: "stable",
      changeRate: 0,
      prediction: dataPoints[0]?.healthScore || 0
    };
  }
  const recent = dataPoints.slice(-7);
  const first = recent[0].healthScore;
  const last = recent[recent.length - 1].healthScore;
  const changeRate = (last - first) / first * 100;
  let direction = "stable";
  if (changeRate > 5) direction = "improving";
  else if (changeRate < -5) direction = "declining";
  const prediction = Math.max(0, Math.min(100, last + (last - first) / recent.length));
  return {
    direction,
    changeRate: Math.round(changeRate * 10) / 10,
    prediction: Math.round(prediction)
  };
}
function buildStatusSnapshot(targetDir) {
  const manifest = readManifest(targetDir);
  const workflowRouting = readLatestWorkflowRoutingReport(targetDir);
  const validatorGate = readLatestValidatorGateReport(targetDir);
  const validatorGateHistory = readValidatorGateHistory(targetDir, Number.POSITIVE_INFINITY);
  const auditReport = readLatestAuditReport(targetDir);
  const auditHistory = readAuditHistory(targetDir, Number.POSITIVE_INFINITY);
  const recentAuditHistory = auditHistory.slice(0, 5);
  const recentValidatorGateHistory = validatorGateHistory.slice(0, 5);
  const previousValidatorGate = getPreviousValidatorGateEntry(validatorGate, validatorGateHistory);
  const validatorGateDelta = buildValidatorGateDelta(validatorGate, previousValidatorGate);
  const healthTimeline = readReport(targetDir, "health/timeline.json");
  const { architecture, modules, health, tasks } = manifest.reports;
  const workflowRoutingAgeHours = workflowRouting ? getReportAgeHours(workflowRouting.generatedAt) : null;
  const validatorGateAgeHours = validatorGate ? getReportAgeHours(validatorGate.generatedAt) : null;
  const auditAgeHours = auditReport ? getReportAgeHours(auditReport.generatedAt) : null;
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    targetDir,
    reportsPath: getReportsPath(targetDir),
    manifest: {
      projectName: manifest.projectName,
      lastUpdated: manifest.lastUpdated
    },
    sections: {
      architecture: buildReportStatusSection(architecture),
      modules: buildReportStatusSection(modules),
      health: {
        ...buildReportStatusSection(health),
        trackedDays: healthTimeline?.dataPoints.length || 0
      },
      tasks: {
        present: Boolean(tasks)
      },
      workflowRouting: {
        present: Boolean(workflowRouting),
        generatedAt: workflowRouting?.generatedAt ?? null,
        ageHours: workflowRoutingAgeHours,
        ageLabel: workflowRouting ? formatAge(workflowRouting.generatedAt) : null,
        workflowId: workflowRouting?.decision.selectedWorkflowId ?? null,
        mode: workflowRouting?.decision.mode ?? null,
        confidence: workflowRouting?.decision.confidence ?? null,
        taskBookId: workflowRouting?.taskBookId ?? null
      },
      validatorGate: {
        present: Boolean(validatorGate),
        generatedAt: validatorGate?.generatedAt ?? null,
        ageHours: validatorGateAgeHours,
        ageLabel: validatorGate ? formatAge(validatorGate.generatedAt) : null,
        freshness: validatorGate ? validatorGateAgeHours !== null && validatorGateAgeHours < 24 ? "fresh" : "stale" : "missing",
        scope: validatorGate?.scope ?? null,
        strictMode: typeof validatorGate?.strictMode === "boolean" ? validatorGate.strictMode : null,
        effectiveOk: typeof validatorGate?.effectiveOk === "boolean" ? validatorGate.effectiveOk : null,
        errorCount: validatorGate?.errorCount ?? null,
        warningCount: validatorGate?.warningCount ?? null,
        issueCount: validatorGate?.issueCount ?? null,
        outputDir: validatorGate?.outputDir ?? null,
        historyDir: validatorGate?.historyDir ?? null,
        historyCount: validatorGateHistory.length,
        reportFiles: validatorGate?.reportFiles ?? [],
        previousRun: previousValidatorGate ? {
          generatedAt: previousValidatorGate.generatedAt,
          scope: previousValidatorGate.scope,
          strictMode: previousValidatorGate.strictMode,
          effectiveOk: previousValidatorGate.effectiveOk,
          errorCount: previousValidatorGate.errorCount,
          warningCount: previousValidatorGate.warningCount,
          issueCount: previousValidatorGate.issueCount
        } : null,
        delta: validatorGateDelta,
        recentHistory: recentValidatorGateHistory
      },
      audit: {
        present: Boolean(auditReport),
        generatedAt: auditReport?.generatedAt ?? null,
        ageHours: auditAgeHours,
        ageLabel: auditReport ? formatAge(auditReport.generatedAt) : null,
        freshness: auditReport ? auditAgeHours !== null && auditAgeHours < 24 ? "fresh" : "stale" : "missing",
        overallStatus: auditReport?.overview?.overallStatus ?? null,
        findingsCount: auditReport?.overview?.findingsCount ?? 0,
        outputDir: auditReport?.outputDir ?? null,
        historyDir: auditReport?.historyDir ?? null,
        historyCount: auditHistory.length,
        recentHistory: recentAuditHistory
      }
    }
  };
}
function showStatus(targetDir, json = false) {
  const snapshot = buildStatusSnapshot(targetDir);
  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  console.log("");
  console.log("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  console.log("\u2502           CodeBuddy Reports Status                  \u2502");
  console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
  if (snapshot.sections.architecture.present && snapshot.sections.architecture.generatedAt) {
    const fresh = snapshot.sections.architecture.freshness === "fresh" ? "\u2713 Fresh" : "\u25CB Stale";
    console.log(`\u2502 Architecture:  ${snapshot.sections.architecture.generatedAt.slice(0, 16)}  (${snapshot.sections.architecture.ageLabel})  ${fresh.padEnd(8)} \u2502`);
  } else {
    console.log("\u2502 Architecture:  Not generated                        \u2502");
  }
  if (snapshot.sections.modules.present && snapshot.sections.modules.generatedAt) {
    const fresh = snapshot.sections.modules.freshness === "fresh" ? "\u2713 Fresh" : "\u25CB Stale";
    console.log(`\u2502 Modules:       ${snapshot.sections.modules.generatedAt.slice(0, 16)}  (${snapshot.sections.modules.ageLabel})  ${fresh.padEnd(8)} \u2502`);
  } else {
    console.log("\u2502 Modules:       Not generated                        \u2502");
  }
  if (snapshot.sections.health.present) {
    console.log(`\u2502 Health Points: ${snapshot.sections.health.trackedDays} days tracked`.padEnd(52) + "\u2502");
  } else {
    console.log("\u2502 Health Points: Not tracked                          \u2502");
  }
  if (snapshot.sections.tasks.present) {
    console.log("\u2502 Active Task:   Yes                                  \u2502");
  } else {
    console.log("\u2502 Active Task:   None                                 \u2502");
  }
  if (snapshot.sections.workflowRouting.present) {
    const routeText = `Route: ${snapshot.sections.workflowRouting.workflowId} (${snapshot.sections.workflowRouting.mode}, ${snapshot.sections.workflowRouting.ageLabel})`;
    console.log(`\u2502 ${routeText}`.padEnd(52) + "\u2502");
  } else {
    console.log("\u2502 Route:         No workflow routing report           \u2502");
  }
  if (snapshot.sections.validatorGate.present && snapshot.sections.validatorGate.scope) {
    const scope = snapshot.sections.validatorGate.scope.padEnd(6);
    const status = snapshot.sections.validatorGate.effectiveOk ? "pass" : "fail";
    const historySuffix = snapshot.sections.validatorGate.historyCount > 0 ? `, runs=${snapshot.sections.validatorGate.historyCount}` : "";
    const trendSuffix = snapshot.sections.validatorGate.delta ? `, trend=${snapshot.sections.validatorGate.delta.direction}` : "";
    const validatorText = `Validators: ${status} (${scope.trim()}, ${snapshot.sections.validatorGate.ageLabel}${historySuffix}${trendSuffix})`;
    console.log(`\u2502 ${validatorText}`.padEnd(52) + "\u2502");
  } else {
    console.log("\u2502 Validators:    No validator gate summary            \u2502");
  }
  if (snapshot.sections.audit.present && snapshot.sections.audit.overallStatus) {
    const historySuffix = snapshot.sections.audit.historyCount > 0 ? `, runs=${snapshot.sections.audit.historyCount}` : "";
    const auditText = `Audit:         ${snapshot.sections.audit.overallStatus} (${snapshot.sections.audit.ageLabel}${historySuffix})`;
    console.log(`\u2502 ${auditText}`.padEnd(52) + "\u2502");
  } else {
    console.log("\u2502 Audit:         No audit summary                     \u2502");
  }
  console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
  console.log("");
}
function cleanup(targetDir, cacheOnly = false) {
  const reportsPath = getReportsPath(targetDir);
  if (!fs4.existsSync(reportsPath)) {
    console.log("No reports directory found.");
    return;
  }
  let cleanedCount = 0;
  const cachePath = path5.join(targetDir, ".codebuddy/cache");
  if (fs4.existsSync(cachePath)) {
    fs4.rmSync(cachePath, { recursive: true });
    console.log("Cleaned: cache/");
    cleanedCount++;
  }
  if (cacheOnly) {
    console.log(`Cleanup complete. Removed ${cleanedCount} items.`);
    return;
  }
  cleanupOldSnapshots(targetDir, "architecture");
  console.log("Cleaned: old architecture snapshots");
  cleanedCount++;
  const cleanedValidatorHistory = cleanupValidatorGateHistory(targetDir);
  console.log(`Cleaned: validator gate history (${cleanedValidatorHistory} removed)`);
  cleanedCount++;
  const cleanedAuditHistory = cleanupAuditHistory(targetDir);
  console.log(`Cleaned: audit history (${cleanedAuditHistory} removed)`);
  cleanedCount++;
  console.log(`Cleanup complete. Removed ${cleanedCount} items.`);
}
function exportMarkdown(targetDir) {
  const manifest = readManifest(targetDir);
  const workflowRouting = readLatestWorkflowRoutingReport(targetDir);
  const validatorGate = readLatestValidatorGateReport(targetDir);
  const validatorGateHistory = readValidatorGateHistory(targetDir, 5);
  const lines = [];
  lines.push("# CodeBuddy \u9879\u76EE\u62A5\u544A");
  lines.push("");
  lines.push(`> \u9879\u76EE: ${manifest.projectName}`);
  lines.push(`> \u751F\u6210\u65F6\u95F4: ${(/* @__PURE__ */ new Date()).toISOString()}`);
  lines.push("");
  const arch = readReport(targetDir, "architecture/latest.json");
  if (arch) {
    lines.push("## \u67B6\u6784\u5206\u6790");
    lines.push("");
    lines.push(`- **\u5DE5\u7A0B\u5065\u5EB7\u5EA6**: ${arch.summary.healthScore}/100`);
    if (typeof arch.summary.structureHealthScore === "number") {
      lines.push(`- **\u7ED3\u6784\u5065\u5EB7\u5EA6**: ${arch.summary.structureHealthScore}/100`);
    }
    if (arch.scorecard) {
      lines.push(`- **\u8BC4\u5206\u5361**: \u5DF2\u6D4B ${arch.scorecard.measuredDimensions} / ${arch.scorecard.dimensions.length} \u4E2A\u7EF4\u5EA6`);
      if (arch.scorecard.measuredWeight < arch.scorecard.totalWeight) {
        lines.push(`- **\u8BC4\u5206\u8303\u56F4**: \u5DF2\u6D4B\u6743\u91CD ${arch.scorecard.measuredWeight}/${arch.scorecard.totalWeight}\uFF0C\u603B\u5206\u6309\u5DF2\u6D4B\u7EF4\u5EA6\u5F52\u4E00\u5316`);
      }
    }
    lines.push(`- **\u6587\u4EF6\u6570**: ${arch.summary.totalFiles}`);
    lines.push(`- **\u4EE3\u7801\u884C\u6570**: ${arch.summary.totalLines.toLocaleString()}`);
    lines.push(`- **\u95EE\u9898\u6570**: ${arch.summary.issueCount.error} \u9519\u8BEF, ${arch.summary.issueCount.warning} \u8B66\u544A`);
    lines.push("");
  }
  const modules = readReport(targetDir, "modules/latest.json");
  if (modules) {
    lines.push("## \u6A21\u5757\u56FE\u8C31");
    lines.push("");
    lines.push(`- **\u6A21\u5757\u6570**: ${modules.summary.totalModules}`);
    lines.push(`- **\u5E73\u5747\u5065\u5EB7\u5EA6**: ${modules.summary.avgHealthScore}/100`);
    lines.push(`- **\u5FAA\u73AF\u4F9D\u8D56**: ${modules.summary.circularDeps}`);
    if ((modules.summary.isolatedModuleNames?.length || 0) > 0) {
      lines.push(`- **\u5B64\u7ACB\u6A21\u5757**: ${modules.summary.isolatedModules} \u4E2A\uFF08${modules.summary.isolatedModuleNames.slice(0, 8).join(", ")}${modules.summary.isolatedModuleNames.length > 8 ? " ..." : ""}\uFF09`);
    }
    lines.push("");
    lines.push("### \u6A21\u5757\u5217\u8868");
    lines.push("");
    lines.push("| \u6A21\u5757 | \u4E2D\u6587\u540D | \u5206\u7C7B | \u6587\u4EF6\u6570 | \u5065\u5EB7\u5EA6 |");
    lines.push("|------|--------|------|--------|--------|");
    for (const mod of modules.modules.slice(0, 20)) {
      lines.push(`| ${mod.name} | ${mod.chineseName} | ${mod.category} | ${mod.stats.files} | ${mod.healthScore}/100 |`);
    }
    lines.push("");
  }
  const health = readReport(targetDir, "health/timeline.json");
  if (health && health.dataPoints.length > 0) {
    lines.push("## \u5065\u5EB7\u5EA6\u8D8B\u52BF");
    lines.push("");
    lines.push(`- **\u8D8B\u52BF**: ${health.trends.direction}`);
    lines.push(`- **\u53D8\u5316\u7387**: ${health.trends.changeRate}%/\u5468`);
    lines.push(`- **\u6570\u636E\u70B9**: ${health.dataPoints.length} \u5929`);
    lines.push("");
  }
  if (workflowRouting) {
    lines.push("## \u6700\u8FD1\u4E00\u6B21 Workflow \u8DEF\u7531");
    lines.push("");
    lines.push(`- **TaskBook**: ${workflowRouting.taskBookId}`);
    lines.push(`- **Workflow**: ${workflowRouting.decision.selectedWorkflowId}`);
    lines.push(`- **Mode**: ${workflowRouting.decision.mode}`);
    lines.push(`- **Confidence**: ${workflowRouting.decision.confidence}`);
    if (workflowRouting.decision.fallbackReason) {
      lines.push(`- **Fallback Reason**: ${workflowRouting.decision.fallbackReason}`);
    }
    if (workflowRouting.decision.reasons.length > 0) {
      lines.push("- **Reasons**:");
      for (const reason of workflowRouting.decision.reasons.slice(0, 6)) {
        lines.push(`  - ${reason}`);
      }
    }
    lines.push("");
  }
  if (validatorGate) {
    lines.push("## \u6700\u8FD1\u4E00\u6B21 Validator Gate");
    lines.push("");
    lines.push(`- **Scope**: ${validatorGate.scope}`);
    lines.push(`- **Strict Mode**: ${validatorGate.strictMode ? "on" : "off"}`);
    lines.push(`- **Effective Result**: ${validatorGate.effectiveOk ? "pass" : "fail"}`);
    lines.push(`- **Errors / Warnings**: ${validatorGate.errorCount} / ${validatorGate.warningCount}`);
    if (validatorGate.historyDir) {
      lines.push(`- **History Dir**: ${validatorGate.historyDir}`);
    }
    const previousValidatorGate = getPreviousValidatorGateEntry(validatorGate, validatorGateHistory);
    const validatorGateDelta = buildValidatorGateDelta(validatorGate, previousValidatorGate);
    if (previousValidatorGate && validatorGateDelta) {
      lines.push(`- **Compared To**: ${previousValidatorGate.generatedAt}`);
      lines.push(`- **Trend**: ${validatorGateDelta.direction}`);
      lines.push(`- **Delta**: errors ${validatorGateDelta.errorDelta >= 0 ? "+" : ""}${validatorGateDelta.errorDelta}, warnings ${validatorGateDelta.warningDelta >= 0 ? "+" : ""}${validatorGateDelta.warningDelta}, issues ${validatorGateDelta.issueDelta >= 0 ? "+" : ""}${validatorGateDelta.issueDelta}`);
    }
    if (validatorGate.reportFiles.length > 0) {
      lines.push(`- **Artifacts**: ${validatorGate.reportFiles.join(", ")}`);
    }
    lines.push("");
  }
  if (validatorGateHistory.length > 0) {
    lines.push("## Validator Gate \u6700\u8FD1\u8BB0\u5F55");
    lines.push("");
    lines.push("| \u65F6\u95F4 | Scope | Strict | Result | Errors | Warnings |");
    lines.push("|------|-------|--------|--------|--------|----------|");
    for (const entry of validatorGateHistory) {
      lines.push(
        `| ${entry.generatedAt} | ${entry.scope} | ${entry.strictMode ? "on" : "off"} | ${entry.effectiveOk ? "pass" : "fail"} | ${entry.errorCount} | ${entry.warningCount} |`
      );
    }
    lines.push("");
  }
  const output = lines.join("\n");
  const outputPath = path5.join(getReportsPath(targetDir), "export.md");
  fs4.writeFileSync(outputPath, output, "utf-8");
  return outputPath;
}
function buildExportSnapshot(targetDir, options = {}) {
  const days = Number.isFinite(options.days) && options.days > 0 ? Math.floor(options.days) : 30;
  const fromDate = options.fromDate?.trim() || null;
  const markdownPath = exportMarkdown(targetDir);
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    targetDir,
    reportsPath: getReportsPath(targetDir),
    input: {
      days,
      fromDate
    },
    markdown: {
      path: markdownPath,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    sections: {
      status: buildStatusSnapshot(targetDir),
      history: buildHistorySnapshot(targetDir),
      trend: buildTrendSnapshot(targetDir, days),
      diff: buildDiffSnapshot(targetDir, fromDate ?? void 0)
    }
  };
}
function buildAuditFinding(id, status, message) {
  return { id, status, message };
}
function summarizeAuditStatus(findings) {
  if (findings.some((finding) => finding.status === "missing")) {
    return "attention";
  }
  if (findings.some((finding) => finding.status === "warn")) {
    return "warn";
  }
  return "pass";
}
function buildAuditSnapshot(targetDir, options = {}) {
  const bundle = buildExportSnapshot(targetDir, options);
  const statusSections = bundle.sections.status.sections;
  const trendSections = bundle.sections.trend.sections;
  const diffSections = bundle.sections.diff.sections;
  const findings = [];
  findings.push(
    buildAuditFinding(
      "architecture-report",
      !statusSections.architecture.present ? "missing" : statusSections.architecture.freshness === "stale" ? "warn" : "pass",
      !statusSections.architecture.present ? "Architecture report is missing." : statusSections.architecture.freshness === "stale" ? `Architecture report is stale (${statusSections.architecture.ageLabel}).` : `Architecture report is fresh (${statusSections.architecture.ageLabel}).`
    )
  );
  findings.push(
    buildAuditFinding(
      "module-report",
      !statusSections.modules.present ? "missing" : statusSections.modules.freshness === "stale" ? "warn" : "pass",
      !statusSections.modules.present ? "Module report is missing." : statusSections.modules.freshness === "stale" ? `Module report is stale (${statusSections.modules.ageLabel}).` : `Module report is fresh (${statusSections.modules.ageLabel}).`
    )
  );
  findings.push(
    buildAuditFinding(
      "workflow-routing",
      statusSections.workflowRouting.present ? "pass" : "warn",
      statusSections.workflowRouting.present ? `Workflow route is ${statusSections.workflowRouting.workflowId || "unknown"} (${statusSections.workflowRouting.mode || "n/a"}).` : "Workflow routing report is missing."
    )
  );
  const validatorStatus = !statusSections.validatorGate.present ? "warn" : statusSections.validatorGate.effectiveOk !== true ? "warn" : statusSections.validatorGate.freshness === "stale" ? "warn" : statusSections.validatorGate.delta?.direction === "regressed" || (statusSections.validatorGate.warningCount || 0) > 0 ? "warn" : "pass";
  findings.push(
    buildAuditFinding(
      "validator-gate",
      validatorStatus,
      !statusSections.validatorGate.present ? "Validator gate summary is missing." : validatorStatus === "pass" ? `Validator gate passed with no active warnings (${statusSections.validatorGate.scope}, ${statusSections.validatorGate.strictMode ? "strict" : "default"}).` : `Validator gate needs attention: ok=${statusSections.validatorGate.effectiveOk}, warnings=${statusSections.validatorGate.warningCount ?? 0}, errors=${statusSections.validatorGate.errorCount ?? 0}, trend=${statusSections.validatorGate.delta?.direction ?? "unknown"}.`
    )
  );
  findings.push(
    buildAuditFinding(
      "health-trend",
      trendSections.health.present ? "pass" : "warn",
      trendSections.health.present ? `Health trend is ${trendSections.health.direction || "unknown"} across ${trendSections.health.recentPoints.length} points.` : "Health trend data is missing."
    )
  );
  const diffAvailable = diffSections.architecture.present || diffSections.modules.present;
  findings.push(
    buildAuditFinding(
      "diff-coverage",
      diffAvailable ? "pass" : "warn",
      diffAvailable ? "Historical diff data is available for review." : "Historical diff data is not available yet."
    )
  );
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    targetDir,
    reportsPath: getReportsPath(targetDir),
    input: {
      days: bundle.input.days,
      fromDate: bundle.input.fromDate
    },
    overview: {
      overallStatus: summarizeAuditStatus(findings),
      architectureFreshness: statusSections.architecture.freshness,
      modulesFreshness: statusSections.modules.freshness,
      workflowId: statusSections.workflowRouting.workflowId,
      workflowMode: statusSections.workflowRouting.mode,
      validatorStatus,
      validatorDirection: trendSections.validatorGate.delta?.direction ?? null,
      healthDirection: trendSections.health.direction ?? null,
      diffAvailable,
      findingsCount: findings.filter((finding) => finding.status !== "pass").length
    },
    outputDir: null,
    historyDir: null,
    reportFiles: [],
    findings,
    markdown: bundle.markdown,
    sections: bundle.sections
  };
}
function buildAndPersistAuditSnapshot(targetDir, options = {}) {
  const snapshot = buildAuditSnapshot(targetDir, options);
  const latestDir = path5.join(targetDir, AUDIT_STANDARD_LATEST_DIR);
  const historyDir = path5.join(targetDir, AUDIT_HISTORY_ROOT, buildHistoryStamp(snapshot.generatedAt));
  snapshot.outputDir = path5.relative(targetDir, latestDir).replace(/\\/g, "/");
  snapshot.historyDir = path5.relative(targetDir, historyDir).replace(/\\/g, "/");
  snapshot.reportFiles = ["audit-summary.json"];
  writeJsonReport(path5.join(latestDir, "audit-summary.json"), snapshot);
  writeJsonReport(path5.join(historyDir, "audit-summary.json"), snapshot);
  return snapshot;
}
function showAudit(targetDir, options) {
  const snapshot = buildAndPersistAuditSnapshot(targetDir, {
    days: options.days,
    fromDate: options.fromDate
  });
  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  const overallText = snapshot.overview.overallStatus.toUpperCase();
  const routeText = snapshot.overview.workflowId ? `${snapshot.overview.workflowId} (${snapshot.overview.workflowMode || "n/a"})` : "missing";
  const validatorText = snapshot.sections.status.sections.validatorGate.present ? `warnings=${snapshot.sections.status.sections.validatorGate.warningCount ?? 0}, errors=${snapshot.sections.status.sections.validatorGate.errorCount ?? 0}` : "missing";
  console.log("");
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551                      CodeBuddy Audit Summary                     \u2551");
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  console.log(`\u2551 Overall: ${overallText}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Architecture: ${snapshot.overview.architectureFreshness}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Modules: ${snapshot.overview.modulesFreshness}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Workflow: ${routeText}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Validators: ${validatorText}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Trends: health=${snapshot.overview.healthDirection || "unknown"} validator=${snapshot.overview.validatorDirection || "unknown"}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Diff: ${snapshot.overview.diffAvailable ? "available" : "missing"}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Export: ${snapshot.markdown.path}`.slice(0, 67).padEnd(67) + "\u2551");
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  for (const finding of snapshot.findings) {
    const line = `\u2551 [${finding.status.toUpperCase()}] ${finding.message}`.slice(0, 67);
    console.log(line.padEnd(67) + "\u2551");
  }
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");
}
function exportReportBundle(targetDir, options) {
  if (options.json) {
    const snapshot = buildExportSnapshot(targetDir, {
      days: options.days,
      fromDate: options.fromDate
    });
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  const outputPath = exportMarkdown(targetDir);
  console.log(`Exported to: ${outputPath}`);
}
function getHistorySnapshots(targetDir, subDir) {
  const dirPath = path5.join(getReportsPath(targetDir), subDir);
  if (!fs4.existsSync(dirPath)) return [];
  return fs4.readdirSync(dirPath).filter((f) => f.endsWith(".json") && f !== "latest.json").map((f) => {
    const datePart = f.replace(".json", "").replace(/T/g, " ").slice(0, 16);
    return {
      name: f,
      date: datePart,
      path: path5.join(dirPath, f)
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}
function readHistoricalSnapshot(targetDir, subDir, fromDate) {
  const historySnapshots = getHistorySnapshots(targetDir, subDir);
  if (historySnapshots.length === 0) {
    return { snapshot: null, path: null };
  }
  const matchingSnapshot = fromDate ? historySnapshots.find((snapshot) => snapshot.date.startsWith(fromDate)) : historySnapshots[0];
  if (!matchingSnapshot) {
    return { snapshot: null, path: null };
  }
  try {
    return {
      snapshot: JSON.parse(fs4.readFileSync(matchingSnapshot.path, "utf-8")),
      path: matchingSnapshot.path
    };
  } catch {
    return { snapshot: null, path: matchingSnapshot.path };
  }
}
function diffArchitectureSnapshots(older, newer) {
  const olderViolations = new Set(older.violations.map((v) => `${v.rule}:${v.path}`));
  const newerViolations = new Set(newer.violations.map((v) => `${v.rule}:${v.path}`));
  const newViolations = [];
  const resolvedViolations = [];
  for (const v of newer.violations) {
    const key = `${v.rule}:${v.path}`;
    if (!olderViolations.has(key)) {
      newViolations.push(`[${v.rule}] ${v.message}`);
    }
  }
  for (const v of older.violations) {
    const key = `${v.rule}:${v.path}`;
    if (!newerViolations.has(key)) {
      resolvedViolations.push(`[${v.rule}] ${v.message}`);
    }
  }
  return {
    from: { date: older.meta.analyzedAt, healthScore: older.summary.healthScore },
    to: { date: newer.meta.analyzedAt, healthScore: newer.summary.healthScore },
    healthChange: newer.summary.healthScore - older.summary.healthScore,
    newViolations,
    resolvedViolations,
    fileChanges: {
      added: Math.max(0, newer.summary.totalFiles - older.summary.totalFiles),
      removed: Math.max(0, older.summary.totalFiles - newer.summary.totalFiles),
      linesChanged: newer.summary.totalLines - older.summary.totalLines
    }
  };
}
function diffModuleSnapshots(older, newer) {
  const olderModules = new Map(older.modules.map((m) => [m.name, m]));
  const newerModules = new Map(newer.modules.map((m) => [m.name, m]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const [name] of newerModules) {
    if (!olderModules.has(name)) {
      added.push(name);
    }
  }
  for (const [name] of olderModules) {
    if (!newerModules.has(name)) {
      removed.push(name);
    }
  }
  for (const [name, newMod] of newerModules) {
    const oldMod = olderModules.get(name);
    if (oldMod) {
      const healthChange = newMod.healthScore - oldMod.healthScore;
      const filesChange = newMod.stats.files - oldMod.stats.files;
      const linesChange = newMod.stats.lines - oldMod.stats.lines;
      if (healthChange !== 0 || filesChange !== 0 || Math.abs(linesChange) > 50) {
        changed.push({ name, healthChange, filesChange, linesChange });
      }
    }
  }
  return { added, removed, changed };
}
function buildDiffSnapshot(targetDir, fromDate) {
  const archLatest = readReport(targetDir, "architecture/latest.json");
  const modulesLatest = readReport(targetDir, "modules/latest.json");
  const olderArch = readHistoricalSnapshot(targetDir, "architecture", fromDate);
  const olderModules = readHistoricalSnapshot(targetDir, "modules", fromDate);
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    targetDir,
    reportsPath: getReportsPath(targetDir),
    input: {
      fromDate: fromDate || null
    },
    sections: {
      architecture: {
        present: Boolean(archLatest && olderArch.snapshot),
        olderPath: olderArch.path,
        latestPath: archLatest ? path5.join(getReportsPath(targetDir), "architecture", "latest.json") : null,
        diff: archLatest && olderArch.snapshot ? diffArchitectureSnapshots(olderArch.snapshot, archLatest) : null
      },
      modules: {
        present: Boolean(modulesLatest && olderModules.snapshot),
        olderPath: olderModules.path,
        latestPath: modulesLatest ? path5.join(getReportsPath(targetDir), "modules", "latest.json") : null,
        diff: modulesLatest && olderModules.snapshot ? diffModuleSnapshots(olderModules.snapshot, modulesLatest) : null
      }
    }
  };
}
function showDiff(targetDir, fromDate, json = false) {
  const snapshot = buildDiffSnapshot(targetDir, fromDate);
  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  if (!snapshot.sections.architecture.present && !snapshot.sections.modules.present) {
    console.log("Cannot compare: missing reports or historical snapshots.");
    return;
  }
  const diff = snapshot.sections.architecture.diff;
  const moduleDiff = snapshot.sections.modules.diff;
  console.log("");
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551                    Architecture Diff Report                       \u2551");
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  if (!diff) {
    console.log("\u2551 No architecture diff available.".padEnd(67) + "\u2551");
    console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
    console.log("");
    return;
  }
  console.log(`\u2551 From: ${diff.from.date.slice(0, 16).padEnd(20)} Health: ${diff.from.healthScore.toString().padStart(3)}/100     \u2551`);
  console.log(`\u2551 To:   ${diff.to.date.slice(0, 16).padEnd(20)} Health: ${diff.to.healthScore.toString().padStart(3)}/100     \u2551`);
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  const healthIcon = diff.healthChange > 0 ? "\u{1F4C8}" : diff.healthChange < 0 ? "\u{1F4C9}" : "\u27A1\uFE0F";
  const healthSign = diff.healthChange > 0 ? "+" : "";
  console.log(`\u2551 Health Change: ${healthIcon} ${healthSign}${diff.healthChange} points`.padEnd(67) + "\u2551");
  console.log(`\u2551 Files: +${diff.fileChanges.added} / -${diff.fileChanges.removed}  Lines: ${diff.fileChanges.linesChanged > 0 ? "+" : ""}${diff.fileChanges.linesChanged}`.padEnd(67) + "\u2551");
  if (diff.newViolations.length > 0) {
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    console.log("\u2551 \u{1F534} New Violations:".padEnd(67) + "\u2551");
    for (const v of diff.newViolations.slice(0, 5)) {
      console.log(`\u2551   ${v.slice(0, 62).padEnd(62)}   \u2551`);
    }
    if (diff.newViolations.length > 5) {
      console.log(`\u2551   ... and ${diff.newViolations.length - 5} more`.padEnd(67) + "\u2551");
    }
  }
  if (diff.resolvedViolations.length > 0) {
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    console.log("\u2551 \u{1F7E2} Resolved Violations:".padEnd(67) + "\u2551");
    for (const v of diff.resolvedViolations.slice(0, 5)) {
      console.log(`\u2551   ${v.slice(0, 62).padEnd(62)}   \u2551`);
    }
    if (diff.resolvedViolations.length > 5) {
      console.log(`\u2551   ... and ${diff.resolvedViolations.length - 5} more`.padEnd(67) + "\u2551");
    }
  }
  if (moduleDiff) {
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    console.log("\u2551 Module Diff:".padEnd(67) + "\u2551");
    console.log(`\u2551 Added: ${moduleDiff.added.length}  Removed: ${moduleDiff.removed.length}  Changed: ${moduleDiff.changed.length}`.padEnd(67) + "\u2551");
    for (const entry of moduleDiff.changed.slice(0, 5)) {
      const line = `${entry.name}  health=${entry.healthChange >= 0 ? "+" : ""}${entry.healthChange}  files=${entry.filesChange >= 0 ? "+" : ""}${entry.filesChange}  lines=${entry.linesChange >= 0 ? "+" : ""}${entry.linesChange}`;
      console.log(`\u2551   ${line.slice(0, 62).padEnd(62)}   \u2551`);
    }
    if (moduleDiff.changed.length > 5) {
      console.log(`\u2551   ... and ${moduleDiff.changed.length - 5} more`.padEnd(67) + "\u2551");
    }
  }
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");
}
function buildTrendSnapshot(targetDir, days = 30) {
  const timeline = readReport(targetDir, "health/timeline.json");
  const normalizedDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;
  const recentPoints = timeline?.dataPoints.slice(-normalizedDays) || [];
  const validatorGateHistory = readValidatorGateHistory(targetDir, 5);
  const latestValidatorGate = validatorGateHistory[0] || null;
  const previousValidatorGate = validatorGateHistory[1] || null;
  const validatorGateDelta = latestValidatorGate ? buildValidatorGateDelta(
    {
      ok: latestValidatorGate.effectiveOk,
      effectiveOk: latestValidatorGate.effectiveOk,
      strictMode: latestValidatorGate.strictMode,
      scope: latestValidatorGate.scope,
      generatedAt: latestValidatorGate.generatedAt,
      errorCount: latestValidatorGate.errorCount,
      warningCount: latestValidatorGate.warningCount,
      issueCount: latestValidatorGate.issueCount,
      outputDir: null,
      historyDir: null,
      reportFiles: [],
      reports: {}
    },
    previousValidatorGate
  ) : null;
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    targetDir,
    reportsPath: getReportsPath(targetDir),
    sections: {
      health: {
        present: Boolean(timeline && timeline.dataPoints.length > 0),
        days: normalizedDays,
        direction: timeline?.trends.direction ?? null,
        changeRate: typeof timeline?.trends.changeRate === "number" ? timeline.trends.changeRate : null,
        prediction: typeof timeline?.trends.prediction === "number" ? timeline.trends.prediction : null,
        recentPoints
      },
      validatorGate: {
        present: validatorGateHistory.length > 0,
        latest: latestValidatorGate ? {
          generatedAt: latestValidatorGate.generatedAt,
          scope: latestValidatorGate.scope,
          strictMode: latestValidatorGate.strictMode,
          effectiveOk: latestValidatorGate.effectiveOk,
          errorCount: latestValidatorGate.errorCount,
          warningCount: latestValidatorGate.warningCount,
          issueCount: latestValidatorGate.issueCount
        } : null,
        previousRun: previousValidatorGate ? {
          generatedAt: previousValidatorGate.generatedAt,
          scope: previousValidatorGate.scope,
          strictMode: previousValidatorGate.strictMode,
          effectiveOk: previousValidatorGate.effectiveOk,
          errorCount: previousValidatorGate.errorCount,
          warningCount: previousValidatorGate.warningCount,
          issueCount: previousValidatorGate.issueCount
        } : null,
        delta: validatorGateDelta,
        recentRuns: validatorGateHistory,
        passCount: validatorGateHistory.filter((entry) => entry.effectiveOk).length,
        failCount: validatorGateHistory.filter((entry) => !entry.effectiveOk).length
      }
    }
  };
}
function showTrend(targetDir, days = 30, json = false) {
  const snapshot = buildTrendSnapshot(targetDir, days);
  const recentPoints = snapshot.sections.health.recentPoints;
  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  if (!snapshot.sections.health.present && !snapshot.sections.validatorGate.present) {
    console.log("No health or validator trend data found. Run analysis or validator gate first.");
    return;
  }
  console.log("");
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551                    Health Trend Analysis                          \u2551");
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  if (snapshot.sections.health.present) {
    const trendDirection = snapshot.sections.health.direction || "stable";
    const trendIcon = trendDirection === "improving" ? "\u{1F4C8}" : trendDirection === "declining" ? "\u{1F4C9}" : "\u27A1\uFE0F";
    const trendText = trendDirection === "improving" ? "Improving" : trendDirection === "declining" ? "Declining" : "Stable";
    console.log(`\u2551 Trend: ${trendIcon} ${trendText}`.padEnd(67) + "\u2551");
    console.log(`\u2551 Change Rate: ${(snapshot.sections.health.changeRate || 0) > 0 ? "+" : ""}${snapshot.sections.health.changeRate}% per week`.padEnd(67) + "\u2551");
    console.log(`\u2551 Predicted Next: ${snapshot.sections.health.prediction}/100`.padEnd(67) + "\u2551");
    console.log(`\u2551 Data Points: ${recentPoints.length} days`.padEnd(67) + "\u2551");
  } else {
    console.log("\u2551 Health: no timeline data available".padEnd(67) + "\u2551");
  }
  if (recentPoints.length >= 2) {
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    console.log("\u2551 Health Score Chart (last " + days + " days):".padEnd(67) + "\u2551");
    console.log("\u2551".padEnd(68) + "\u2551");
    const chartHeight = 8;
    const chartWidth = 50;
    const minScore = Math.min(...recentPoints.map((p) => p.healthScore));
    const maxScore = Math.max(...recentPoints.map((p) => p.healthScore));
    const range = Math.max(maxScore - minScore, 10);
    for (let row = chartHeight - 1; row >= 0; row--) {
      const threshold = minScore + range * row / (chartHeight - 1);
      let line = `\u2551 ${threshold.toFixed(0).padStart(3)} \u2502`;
      const step = Math.max(1, Math.floor(recentPoints.length / chartWidth));
      for (let i = 0; i < chartWidth && i * step < recentPoints.length; i++) {
        const point = recentPoints[i * step];
        const normalizedScore = (point.healthScore - minScore) / range;
        const pointRow = Math.round(normalizedScore * (chartHeight - 1));
        if (pointRow === row) {
          line += "\u25CF";
        } else if (pointRow > row) {
          line += "\u2502";
        } else {
          line += " ";
        }
      }
      console.log(line.padEnd(67) + "\u2551");
    }
    console.log("\u2551     \u2514" + "\u2500".repeat(chartWidth) + "".padEnd(11) + "\u2551");
    const firstDate = recentPoints[0].date.slice(5, 10);
    const lastDate = recentPoints[recentPoints.length - 1].date.slice(5, 10);
    console.log(`\u2551      ${firstDate}${"".padEnd(chartWidth - 10)}${lastDate}`.padEnd(67) + "\u2551");
  }
  if (recentPoints.length > 0) {
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    console.log("\u2551 Recent Data Points:".padEnd(67) + "\u2551");
    const lastFive = recentPoints.slice(-5).reverse();
    for (const point of lastFive) {
      const bar = "\u2588".repeat(Math.round(point.healthScore / 5));
      const icon = point.healthScore >= 80 ? "\u{1F7E2}" : point.healthScore >= 60 ? "\u{1F7E1}" : "\u{1F534}";
      console.log(`\u2551   ${point.date} \u2502 ${icon} ${point.healthScore.toString().padStart(3)}/100 ${bar}`.padEnd(67) + "\u2551");
    }
  }
  if (snapshot.sections.validatorGate.present) {
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    console.log("\u2551 Validator Gate Trend:".padEnd(67) + "\u2551");
    const latest = snapshot.sections.validatorGate.latest;
    const delta = snapshot.sections.validatorGate.delta;
    if (latest) {
      const trendText = delta ? delta.direction : "unknown";
      console.log(`\u2551 Latest: ${latest.generatedAt.slice(0, 16)}  ${latest.scope}  ${latest.strictMode ? "strict" : "default"}  ${latest.effectiveOk ? "pass" : "fail"}`.padEnd(67) + "\u2551");
      console.log(`\u2551 Recent Runs: pass=${snapshot.sections.validatorGate.passCount} fail=${snapshot.sections.validatorGate.failCount}  trend=${trendText}`.padEnd(67) + "\u2551");
      if (delta) {
        const deltaLine = `\u0394 errors=${delta.errorDelta >= 0 ? "+" : ""}${delta.errorDelta} warnings=${delta.warningDelta >= 0 ? "+" : ""}${delta.warningDelta} issues=${delta.issueDelta >= 0 ? "+" : ""}${delta.issueDelta}`;
        console.log(`\u2551 ${deltaLine}`.padEnd(67) + "\u2551");
      }
    }
  }
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");
}
function buildHistorySnapshot(targetDir) {
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    targetDir,
    reportsPath: getReportsPath(targetDir),
    sections: {
      architecture: getHistorySnapshots(targetDir, "architecture").map((item) => ({
        kind: "architecture",
        name: item.name,
        date: item.date,
        path: item.path
      })),
      modules: getHistorySnapshots(targetDir, "modules").map((item) => ({
        kind: "modules",
        name: item.name,
        date: item.date,
        path: item.path
      })),
      validatorGate: readValidatorGateHistory(targetDir, Number.POSITIVE_INFINITY),
      audit: readAuditHistory(targetDir, Number.POSITIVE_INFINITY)
    }
  };
}
function showHistory(targetDir, json = false) {
  const snapshot = buildHistorySnapshot(targetDir);
  const archSnapshots = snapshot.sections.architecture;
  const moduleSnapshots = snapshot.sections.modules;
  const validatorGateHistory = snapshot.sections.validatorGate;
  const auditHistory = snapshot.sections.audit;
  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  console.log("");
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551                    Historical Snapshots                           \u2551");
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  if (archSnapshots.length === 0) {
    console.log("\u2551 No historical snapshots found.".padEnd(67) + "\u2551");
  } else {
    console.log("\u2551 Architecture Snapshots:".padEnd(67) + "\u2551");
    for (const snap of archSnapshots.slice(0, 10)) {
      console.log(`\u2551   ${snap.date}  ${snap.name}`.padEnd(67) + "\u2551");
    }
    if (archSnapshots.length > 10) {
      console.log(`\u2551   ... and ${archSnapshots.length - 10} more`.padEnd(67) + "\u2551");
    }
  }
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  if (moduleSnapshots.length === 0) {
    console.log("\u2551 No module snapshots found.".padEnd(67) + "\u2551");
  } else {
    console.log("\u2551 Module Snapshots:".padEnd(67) + "\u2551");
    for (const snap of moduleSnapshots.slice(0, 10)) {
      console.log(`\u2551   ${snap.date}  ${snap.name}`.padEnd(67) + "\u2551");
    }
    if (moduleSnapshots.length > 10) {
      console.log(`\u2551   ... and ${moduleSnapshots.length - 10} more`.padEnd(67) + "\u2551");
    }
  }
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  if (validatorGateHistory.length === 0) {
    console.log("\u2551 No validator gate history found.".padEnd(67) + "\u2551");
  } else {
    console.log("\u2551 Validator Gate Runs:".padEnd(67) + "\u2551");
    for (const entry of validatorGateHistory.slice(0, 10)) {
      const line = `${entry.generatedAt.slice(0, 16)}  ${entry.scope}  ${entry.strictMode ? "strict" : "default"}  ${entry.effectiveOk ? "pass" : "fail"}  e=${entry.errorCount} w=${entry.warningCount}`;
      console.log(`\u2551   ${line.slice(0, 62).padEnd(62)}   \u2551`);
    }
    if (validatorGateHistory.length > 10) {
      console.log(`\u2551   ... and ${validatorGateHistory.length - 10} more`.padEnd(67) + "\u2551");
    }
  }
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  if (auditHistory.length === 0) {
    console.log("\u2551 No audit history found.".padEnd(67) + "\u2551");
  } else {
    console.log("\u2551 Audit Runs:".padEnd(67) + "\u2551");
    for (const entry of auditHistory.slice(0, 10)) {
      const line = `${entry.generatedAt.slice(0, 16)}  ${entry.overallStatus}  findings=${entry.findingsCount}  validator=${entry.validatorStatus || "n/a"}`;
      console.log(`\u2551   ${line.slice(0, 62).padEnd(62)}   \u2551`);
    }
    if (auditHistory.length > 10) {
      console.log(`\u2551   ... and ${auditHistory.length - 10} more`.padEnd(67) + "\u2551");
    }
  }
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");
}
function normalizeFsPath(p) {
  const normalized = path5.normalize(p);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
function toAbsolutePath(targetDir, p) {
  return path5.isAbsolute(p) ? p : path5.resolve(targetDir, p);
}
function isSameOrSubPath(childPath, parentPath) {
  const child = normalizeFsPath(childPath);
  let parent = normalizeFsPath(parentPath);
  if (child === parent) return true;
  if (!parent.endsWith(path5.sep)) parent += path5.sep;
  return child.startsWith(parent);
}
function buildGraphIndex(snapshot) {
  const out = /* @__PURE__ */ new Map();
  const inn = /* @__PURE__ */ new Map();
  for (const node of snapshot.graph.nodes) {
    out.set(node, /* @__PURE__ */ new Set());
    inn.set(node, /* @__PURE__ */ new Set());
  }
  for (const edge of snapshot.graph.edges) {
    if (!out.has(edge.from)) out.set(edge.from, /* @__PURE__ */ new Set());
    if (!inn.has(edge.to)) inn.set(edge.to, /* @__PURE__ */ new Set());
    out.get(edge.from).add(edge.to);
    inn.get(edge.to).add(edge.from);
  }
  return { out, in: inn };
}
function bfsTraverse(start, adjacency, depth) {
  const result = [];
  if (depth <= 0) return result;
  const visited = /* @__PURE__ */ new Set([start]);
  let frontier = /* @__PURE__ */ new Set([start]);
  for (let d = 1; d <= depth; d++) {
    const next = /* @__PURE__ */ new Set();
    for (const node of frontier) {
      const neighbors = adjacency.get(node);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (visited.has(n)) continue;
        visited.add(n);
        next.add(n);
        result.push({ name: n, depth: d });
      }
    }
    if (next.size === 0) break;
    frontier = next;
  }
  return result;
}
function findModuleByQuery(snapshot, query) {
  const q = query.trim();
  if (!q) return { match: null, candidates: [] };
  const qLower = q.toLowerCase();
  const modules = snapshot.modules;
  const exact = modules.find((m) => m.name === q || m.chineseName === q || m.routePath === q || m.path === q);
  if (exact) return { match: exact, candidates: [exact] };
  const candidates = modules.filter((m) => {
    const fields = [m.name, m.chineseName, m.routePath ?? "", m.path];
    return fields.some((f) => f.toLowerCase().includes(qLower));
  });
  if (candidates.length === 1) return { match: candidates[0], candidates };
  return { match: null, candidates };
}
function findBestModuleForFile(targetDir, snapshot, filePathInput) {
  const fileAbs = toAbsolutePath(targetDir, filePathInput);
  const candidates = snapshot.modules.filter((m) => isSameOrSubPath(fileAbs, m.path));
  if (candidates.length === 0) return { fileAbs, module: null, candidates: [] };
  const sorted = [...candidates].sort((a, b) => normalizeFsPath(b.path).length - normalizeFsPath(a.path).length);
  return { fileAbs, module: sorted[0], candidates: sorted };
}
function summarizeViolationsForPath(targetDir, snapshot, pathPrefixAbs, limit) {
  const counts = { error: 0, warning: 0, info: 0 };
  if (!snapshot) return { counts, total: 0, top: [] };
  const prefix = toAbsolutePath(targetDir, pathPrefixAbs);
  const matched = snapshot.violations.filter((v) => {
    const vPath = toAbsolutePath(targetDir, v.path);
    return isSameOrSubPath(vPath, prefix);
  });
  for (const v of matched) {
    if (v.severity === "error") counts.error += 1;
    else if (v.severity === "warning") counts.warning += 1;
    else counts.info += 1;
  }
  const top = matched.slice(0, limit).map((v) => ({ rule: v.rule, severity: v.severity, path: v.path, message: v.message }));
  return { counts, total: matched.length, top };
}
function buildViolationsTrend(targetDir, pathPrefixAbs, points) {
  const history = getHistorySnapshots(targetDir, "architecture").slice(0, Math.max(1, points)).reverse();
  const result = [];
  for (const h of history) {
    try {
      const snap = JSON.parse(fs4.readFileSync(h.path, "utf-8"));
      const summary = summarizeViolationsForPath(targetDir, snap, pathPrefixAbs, 0);
      result.push({
        date: snap.meta.analyzedAt,
        total: summary.total,
        error: summary.counts.error,
        warning: summary.counts.warning,
        info: summary.counts.info
      });
    } catch {
    }
  }
  return result;
}
function buildModuleHealthTrend(targetDir, moduleName, points) {
  const history = getHistorySnapshots(targetDir, "modules").slice(0, Math.max(1, points)).reverse();
  const result = [];
  for (const h of history) {
    try {
      const snap = JSON.parse(fs4.readFileSync(h.path, "utf-8"));
      const mod = snap.modules.find((m) => m.name === moduleName);
      if (!mod) continue;
      result.push({
        date: snap.meta.analyzedAt,
        healthScore: mod.healthScore,
        files: mod.stats.files,
        lines: mod.stats.lines
      });
    } catch {
    }
  }
  if (result.length === 0) {
    const latest = readReport(targetDir, "modules/latest.json");
    const mod = latest?.modules.find((m) => m.name === moduleName);
    if (latest && mod) {
      result.push({
        date: latest.meta.analyzedAt,
        healthScore: mod.healthScore,
        files: mod.stats.files,
        lines: mod.stats.lines
      });
    }
  }
  return result;
}
function inspectReport(targetDir, opts) {
  const modulesLatest = readReport(targetDir, "modules/latest.json");
  const archLatest = readReport(targetDir, "architecture/latest.json");
  if (!modulesLatest) {
    const message = "No module report found. Run module-mapper / analysis first.";
    if (opts.json) {
      console.log(JSON.stringify({ error: { code: "NO_MODULE_REPORT", message }, source: { targetDir } }, null, 2));
      return;
    }
    console.log(message);
    return;
  }
  if (modulesLatest.modules.length === 0) {
    const message = "Module report exists, but no modules were detected.";
    if (opts.json) {
      console.log(JSON.stringify({ error: { code: "NO_MODULES", message }, source: { targetDir } }, null, 2));
      return;
    }
    console.log(message);
    return;
  }
  let module2 = null;
  let fileAbs = null;
  let candidates = [];
  if (opts.file) {
    const match = findBestModuleForFile(targetDir, modulesLatest, opts.file);
    fileAbs = match.fileAbs;
    module2 = match.module;
    candidates = match.candidates;
  } else if (opts.module) {
    const match = findModuleByQuery(modulesLatest, opts.module);
    module2 = match.match;
    candidates = match.candidates;
  } else {
    const message = "inspect \u9700\u8981 --module <name> \u6216 --file <path>";
    if (opts.json) {
      console.log(JSON.stringify({ error: { code: "MISSING_ARGUMENT", message }, source: { targetDir } }, null, 2));
      return;
    }
    console.error(message);
    return;
  }
  if (!module2) {
    if (candidates.length > 1) {
      if (opts.json) {
        console.log(JSON.stringify({
          error: { code: "MULTIPLE_MATCHES", message: "Found multiple modules, please be more specific." },
          source: { targetDir },
          input: { module: opts.module ?? null, file: opts.file ?? null, resolvedFile: fileAbs },
          candidates: candidates.slice(0, 50).map((c) => ({
            name: c.name,
            chineseName: c.chineseName,
            routePath: c.routePath ?? null,
            path: c.path
          }))
        }, null, 2));
        return;
      }
      console.log("Found multiple modules, please be more specific:");
      for (const c of candidates.slice(0, 20)) {
        console.log(`- ${c.name} (${c.chineseName})  ${c.routePath ?? ""}`.trim());
      }
      if (candidates.length > 20) console.log(`... and ${candidates.length - 20} more`);
      return;
    }
    const message = "No matching module found.";
    if (opts.json) {
      console.log(JSON.stringify({
        error: { code: "NO_MATCH", message },
        source: { targetDir },
        input: { module: opts.module ?? null, file: opts.file ?? null, resolvedFile: fileAbs }
      }, null, 2));
      return;
    }
    console.log(message);
    if (fileAbs) console.log(`file: ${fileAbs}`);
    return;
  }
  const graph = buildGraphIndex(modulesLatest);
  const upstream = bfsTraverse(module2.name, graph.out, opts.depth);
  const downstream = bfsTraverse(module2.name, graph.in, opts.depth);
  const violations = summarizeViolationsForPath(targetDir, archLatest, module2.path, 8);
  const violationsTrend = buildViolationsTrend(targetDir, module2.path, opts.trendPoints);
  const moduleHealthTrend = buildModuleHealthTrend(targetDir, module2.name, opts.trendPoints);
  const moduleRelPath = isSameOrSubPath(module2.path, targetDir) ? path5.relative(targetDir, module2.path) : module2.path;
  const payload = {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source: {
      targetDir,
      reports: {
        modules: "modules/latest.json",
        architecture: archLatest ? "architecture/latest.json" : null
      }
    },
    input: {
      module: opts.module ?? null,
      file: opts.file ?? null,
      resolvedFile: fileAbs,
      depth: opts.depth,
      trendPoints: opts.trendPoints
    },
    module: {
      name: module2.name,
      chineseName: module2.chineseName,
      category: module2.category,
      type: module2.type,
      routePath: module2.routePath ?? null,
      path: module2.path,
      pathRelative: moduleRelPath,
      stats: module2.stats,
      healthScore: module2.healthScore
    },
    graph: {
      upstream,
      downstream,
      inDegree: graph.in.get(module2.name)?.size ?? 0,
      outDegree: graph.out.get(module2.name)?.size ?? 0
    },
    violations: {
      total: violations.total,
      counts: violations.counts,
      top: violations.top
    },
    trends: {
      moduleHealth: moduleHealthTrend,
      violations: violationsTrend
    }
  };
  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log("");
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551                         Report Inspect                            \u2551");
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  if (fileAbs) {
    console.log(`\u2551 File: ${fileAbs}`.padEnd(67) + "\u2551");
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  }
  console.log(`\u2551 Module: ${module2.chineseName} (${module2.name})`.padEnd(67) + "\u2551");
  console.log(`\u2551 Path: ${moduleRelPath}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Type: ${module2.type}  Category: ${module2.category}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Health: ${module2.healthScore}/100  Files: ${module2.stats.files}  Lines: ${module2.stats.lines.toLocaleString()}`.padEnd(67) + "\u2551");
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  const inDegree = graph.in.get(module2.name)?.size ?? 0;
  const outDegree = graph.out.get(module2.name)?.size ?? 0;
  console.log(`\u2551 Graph: dependents(in)=${inDegree}  dependencies(out)=${outDegree}`.padEnd(67) + "\u2551");
  const upList = upstream.filter((x) => x.depth === 1).map((x) => x.name);
  const downList = downstream.filter((x) => x.depth === 1).map((x) => x.name);
  console.log(`\u2551 Upstream (depth=1): ${upList.slice(0, 8).join(", ") || "-"}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Downstream (depth=1): ${downList.slice(0, 8).join(", ") || "-"}`.padEnd(67) + "\u2551");
  if (opts.depth > 1) {
    const upAll = upstream.map((x) => x.name);
    const downAll = downstream.map((x) => x.name);
    console.log(`\u2551 Upstream (depth=${opts.depth}): ${upAll.slice(0, 12).join(", ") || "-"}`.padEnd(67) + "\u2551");
    console.log(`\u2551 Downstream (depth=${opts.depth}): ${downAll.slice(0, 12).join(", ") || "-"}`.padEnd(67) + "\u2551");
  }
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  console.log(`\u2551 Violations (latest): total=${violations.total}  e=${violations.counts.error}  w=${violations.counts.warning}  i=${violations.counts.info}`.padEnd(67) + "\u2551");
  for (const v of violations.top) {
    const line = `[${v.rule}] ${v.message}`;
    console.log(`\u2551   ${line.slice(0, 62).padEnd(62)}   \u2551`);
  }
  if (moduleHealthTrend.length >= 2) {
    const first = moduleHealthTrend[0];
    const last = moduleHealthTrend[moduleHealthTrend.length - 1];
    const delta = last.healthScore - first.healthScore;
    const sign = delta > 0 ? "+" : "";
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    console.log(`\u2551 Trend (health): ${first.healthScore} -> ${last.healthScore} (${sign}${delta})`.padEnd(67) + "\u2551");
  }
  if (violationsTrend.length >= 2) {
    const first = violationsTrend[0];
    const last = violationsTrend[violationsTrend.length - 1];
    const delta = last.total - first.total;
    const sign = delta > 0 ? "+" : "";
    console.log(`\u2551 Trend (violations): ${first.total} -> ${last.total} (${sign}${delta})`.padEnd(67) + "\u2551");
  }
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");
}
function hotspotsReport(targetDir, opts) {
  const modulesLatest = readReport(targetDir, "modules/latest.json");
  const archLatest = readReport(targetDir, "architecture/latest.json");
  if (!modulesLatest) {
    const message = "No module report found. Run module-mapper / analysis first.";
    if (opts.json) {
      console.log(JSON.stringify({ error: { code: "NO_MODULE_REPORT", message }, source: { targetDir } }, null, 2));
      return;
    }
    console.log(message);
    return;
  }
  if (modulesLatest.modules.length === 0) {
    const message = "Module report exists, but no modules were detected.";
    if (opts.json) {
      console.log(JSON.stringify({ error: { code: "NO_MODULES", message }, source: { targetDir } }, null, 2));
      return;
    }
    console.log(message);
    return;
  }
  const graph = buildGraphIndex(modulesLatest);
  const rows = modulesLatest.modules.map((m) => {
    const inDegree = graph.in.get(m.name)?.size ?? 0;
    const outDegree = graph.out.get(m.name)?.size ?? 0;
    const vSummary = summarizeViolationsForPath(targetDir, archLatest, m.path, 0);
    return {
      name: m.name,
      chineseName: m.chineseName,
      routePath: m.routePath ?? null,
      type: m.type,
      category: m.category,
      healthScore: m.healthScore,
      files: m.stats.files,
      lines: m.stats.lines,
      inDegree,
      outDegree,
      violations: vSummary.total,
      violationsError: vSummary.counts.error,
      violationsWarning: vSummary.counts.warning
    };
  });
  const top = Math.max(1, Math.min(50, opts.top));
  const mostDependedOn = [...rows].sort((a, b) => b.inDegree - a.inDegree).slice(0, top);
  const largestByLines = [...rows].sort((a, b) => b.lines - a.lines).slice(0, top);
  const lowestHealth = [...rows].sort((a, b) => a.healthScore - b.healthScore).slice(0, top);
  const mostViolations = [...rows].sort((a, b) => b.violations - a.violations).slice(0, top);
  const payload = {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source: { targetDir },
    top,
    lists: {
      mostDependedOn,
      largestByLines,
      lowestHealth,
      mostViolations
    }
  };
  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log("");
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551                         Report Hotspots                           \u2551");
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  const printList = (title, items) => {
    console.log(`\u2551 ${title}`.padEnd(67) + "\u2551");
    for (const it of items) {
      const line = `${it.name}  in=${it.inDegree}  lines=${it.lines}  health=${it.healthScore}  vio=${it.violations}`;
      console.log(`\u2551   ${line.slice(0, 62).padEnd(62)}   \u2551`);
    }
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  };
  printList(`Top ${top}: Most Depended-On (downstream impact)`, mostDependedOn);
  printList(`Top ${top}: Largest By Lines`, largestByLines);
  printList(`Top ${top}: Lowest Health`, lowestHealth);
  printList(`Top ${top}: Most Violations (architecture latest)`, mostViolations);
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");
}
function showHelp() {
  console.log(`
Report Manager - \u62A5\u544A\u7BA1\u7406\u5668

\u7528\u6CD5: node report-manager.js <command> [options]

\u4EA7\u54C1\u8DEF\u5F84:
  1. \u89C2\u5BDF / \u5F53\u524D\u72B6\u6001     node report-manager.js status
  2. \u89C2\u5BDF / \u5BFC\u51FA\u6C47\u62A5     node report-manager.js export
  3. \u89C2\u5BDF / \u70ED\u70B9\u5B9A\u4F4D     node report-manager.js hotspots --top 10
  4. \u89C2\u5BDF / \u6DF1\u5165\u5206\u6790     node report-manager.js inspect --module "src/features/user"

\u547D\u4EE4:
  status              \u67E5\u770B\u62A5\u544A\u72B6\u6001
    --json            \u8F93\u51FA\u673A\u5668\u53EF\u8BFB\u7684\u5F53\u524D\u62A5\u544A\u6458\u8981
  cleanup             \u6E05\u7406\u8FC7\u671F\u62A5\u544A
    --cache-only      \u4EC5\u6E05\u7406\u7F13\u5B58
  export              \u5BFC\u51FA\u62A5\u544A\u4E3A Markdown
    --json            \u8F93\u51FA\u7EDF\u4E00\u7684 status/history/trend/diff/export JSON
    --days <n>        trend/export \u4E2D\u5305\u542B\u7684\u8D8B\u52BF\u5929\u6570 (\u9ED8\u8BA4: 30)
    --from <date>     diff/export \u7684\u8D77\u59CB\u65E5\u671F (YYYY-MM-DD\uFF0C\u53EF\u9009)
  diff                \u5BF9\u6BD4\u67B6\u6784\u5FEB\u7167
    --from <date>     \u8D77\u59CB\u65E5\u671F (YYYY-MM-DD\uFF0C\u53EF\u9009)
    --json            \u8F93\u51FA architecture / modules diff JSON
  trend               \u663E\u793A\u5065\u5EB7\u5EA6\u8D8B\u52BF
    --days <n>        \u663E\u793A\u5929\u6570 (\u9ED8\u8BA4: 30)
    --json            \u8F93\u51FA health / validator trend JSON
  history             \u5217\u51FA\u5386\u53F2\u5FEB\u7167
    --json            \u8F93\u51FA architecture / modules / validator gate \u5386\u53F2 JSON
  inspect             \u67E5\u8BE2\u6A21\u5757/\u6587\u4EF6\u7684\u4E0A\u4E0B\u6E38\u3001\u70ED\u70B9\u4E0E\u8D8B\u52BF
    --module <q>      \u6309\u6A21\u5757\uFF08name/chineseName/routePath/path\uFF09\u67E5\u8BE2
    --file <path>     \u6309\u6587\u4EF6\u8DEF\u5F84\u67E5\u8BE2\uFF08\u4F1A\u81EA\u52A8\u5B9A\u4F4D\u6240\u5C5E\u6A21\u5757\uFF09
    --depth <n>       \u4F9D\u8D56\u56FE\u904D\u5386\u6DF1\u5EA6 (\u9ED8\u8BA4: 1)
    --trend <n>       \u8D8B\u52BF\u70B9\u6570 (\u9ED8\u8BA4: 7)
    --json            \u8F93\u51FA JSON
  hotspots            \u5217\u51FA\u70ED\u70B9\u6A21\u5757\uFF08\u4F9D\u8D56\u5F71\u54CD/\u89C4\u6A21/\u5065\u5EB7\u5EA6/\u8FDD\u89C4\uFF09
    --top <n>         \u5217\u8868\u957F\u5EA6 (\u9ED8\u8BA4: 10)
    --json            \u8F93\u51FA JSON

\u793A\u4F8B:
  node report-manager.js status
  node report-manager.js status --json
  node report-manager.js cleanup
  node report-manager.js audit
  node report-manager.js audit --json
  node report-manager.js export
  node report-manager.js export --json
  node report-manager.js diff
  node report-manager.js diff --from 2025-01-15
  node report-manager.js diff --json
  node report-manager.js trend --days 14
  node report-manager.js trend --json
  node report-manager.js history
  node report-manager.js history --json
  node report-manager.js inspect --module "src/features/user"
  node report-manager.js inspect --file "src/features/user/index.ts"
  node report-manager.js hotspots --top 15

\u8BF4\u660E:
  - \u8FD9\u662F\u201C\u89C2\u5BDF / \u6C47\u62A5\u201D\u5165\u53E3\uFF0C\u4E0D\u8D1F\u8D23\u5B89\u88C5\u6216\u6267\u884C\u95ED\u73AF\u3002
  - \u5B89\u88C5 / \u8BCA\u65AD\u4F18\u5148\u8D70 codebuddy-loader\uFF1B\u542F\u52A8\u95ED\u73AF\u4F18\u5148\u8D70 task-orchestrator\u3002
`);
}
function main() {
  const args = process.argv.slice(2);
  let command = args[0];
  let targetDir = process.cwd();
  if (command === "." || command === "./" || command && command.startsWith("./") && !command.includes(" ")) {
    targetDir = path5.resolve(command);
    command = args[1];
  }
  if (!command || command === "--help" || command === "-h") {
    showHelp();
    process.exit(0);
  }
  switch (command) {
    case "status":
      showStatus(targetDir, args.includes("--json"));
      break;
    case "cleanup":
      const cacheOnly = args.includes("--cache-only");
      cleanup(targetDir, cacheOnly);
      break;
    case "export":
      exportReportBundle(targetDir, {
        json: args.includes("--json"),
        days: (() => {
          const daysIndex = args.indexOf("--days");
          return daysIndex !== -1 ? parseInt(args[daysIndex + 1], 10) : 30;
        })(),
        fromDate: (() => {
          const fromIndex = args.indexOf("--from");
          return fromIndex !== -1 ? args[fromIndex + 1] : void 0;
        })()
      });
      break;
    case "audit":
      showAudit(targetDir, {
        json: args.includes("--json"),
        days: (() => {
          const daysIndex = args.indexOf("--days");
          return daysIndex !== -1 ? parseInt(args[daysIndex + 1], 10) : 30;
        })(),
        fromDate: (() => {
          const fromIndex = args.indexOf("--from");
          return fromIndex !== -1 ? args[fromIndex + 1] : void 0;
        })()
      });
      break;
    case "diff": {
      const fromIndex = args.indexOf("--from");
      const fromDate = fromIndex !== -1 ? args[fromIndex + 1] : void 0;
      showDiff(targetDir, fromDate, args.includes("--json"));
      break;
    }
    case "trend": {
      const daysIndex = args.indexOf("--days");
      const days = daysIndex !== -1 ? parseInt(args[daysIndex + 1], 10) : 30;
      showTrend(targetDir, days, args.includes("--json"));
      break;
    }
    case "history":
      showHistory(targetDir, args.includes("--json"));
      break;
    case "inspect": {
      const moduleIndex = args.indexOf("--module");
      const fileIndex = args.indexOf("--file");
      const depthIndex = args.indexOf("--depth");
      const trendIndex = args.indexOf("--trend");
      const json = args.includes("--json");
      const module2 = moduleIndex !== -1 ? args[moduleIndex + 1] : void 0;
      const file = fileIndex !== -1 ? args[fileIndex + 1] : void 0;
      const depth = depthIndex !== -1 ? parseInt(args[depthIndex + 1], 10) : 1;
      const trendPoints = trendIndex !== -1 ? parseInt(args[trendIndex + 1], 10) : 7;
      inspectReport(targetDir, {
        module: module2,
        file,
        depth: Number.isFinite(depth) && depth > 0 ? depth : 1,
        trendPoints: Number.isFinite(trendPoints) && trendPoints > 0 ? trendPoints : 7,
        json
      });
      break;
    }
    case "hotspots": {
      const topIndex = args.indexOf("--top");
      const json = args.includes("--json");
      const top = topIndex !== -1 ? parseInt(args[topIndex + 1], 10) : 10;
      hotspotsReport(targetDir, { top: Number.isFinite(top) && top > 0 ? top : 10, json });
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}
if (isDirectCliEntry("report-manager.js")) {
  main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  appendHealthDataPoint,
  buildAndPersistAuditSnapshot,
  buildAuditSnapshot,
  buildDiffSnapshot,
  buildExportSnapshot,
  buildHistorySnapshot,
  buildStatusSnapshot,
  buildTrendSnapshot,
  cleanupReports,
  getReportAgeHours,
  getReportsPath,
  readAuditHistory,
  readLatestAuditReport,
  readLatestValidatorGateReport,
  readManifest,
  readReport,
  readValidatorGateHistory,
  reportExists,
  saveArchitectureSnapshot,
  saveModuleMapSnapshot,
  writeManifest,
  writeReport
});
