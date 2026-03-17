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

// scripts/src/module-mapper.ts
var module_mapper_exports = {};
__export(module_mapper_exports, {
  analyzeModules: () => analyzeModules
});
module.exports = __toCommonJS(module_mapper_exports);
var fs3 = __toESM(require("fs"));
var path4 = __toESM(require("path"));

// scripts/src/types/module-mapper.ts
var BUSINESS_KEYWORDS = [
  // 用户认证
  { keyword: "login", name: "\u767B\u5F55", category: "\u7528\u6237\u8BA4\u8BC1", aliases: ["signin", "auth"] },
  { keyword: "register", name: "\u6CE8\u518C", category: "\u7528\u6237\u8BA4\u8BC1", aliases: ["signup"] },
  { keyword: "verification", name: "\u8EAB\u4EFD\u9A8C\u8BC1", category: "\u7528\u6237\u8BA4\u8BC1", aliases: ["verify", "validate"] },
  { keyword: "password", name: "\u5BC6\u7801\u7BA1\u7406", category: "\u7528\u6237\u8BA4\u8BC1", aliases: ["pwd", "forgot"] },
  { keyword: "captcha", name: "\u9A8C\u8BC1\u7801", category: "\u7528\u6237\u8BA4\u8BC1" },
  { keyword: "sso", name: "\u5355\u70B9\u767B\u5F55", category: "\u7528\u6237\u8BA4\u8BC1" },
  // 用户管理
  { keyword: "account", name: "\u8D26\u6237", category: "\u7528\u6237\u7BA1\u7406", aliases: ["user", "profile"] },
  { keyword: "personal", name: "\u4E2A\u4EBA\u4E2D\u5FC3", category: "\u7528\u6237\u7BA1\u7406", aliases: ["mine", "my"] },
  { keyword: "settings", name: "\u8BBE\u7F6E", category: "\u7528\u6237\u7BA1\u7406", aliases: ["setting", "config"] },
  { keyword: "enterprise", name: "\u4F01\u4E1A\u4FE1\u606F", category: "\u7528\u6237\u7BA1\u7406", aliases: ["company", "corp"] },
  // 业务办理
  { keyword: "registry", name: "\u6CE8\u518C\u5F00\u6237", category: "\u4E1A\u52A1\u529E\u7406", aliases: ["reg"] },
  { keyword: "selfSign", name: "\u81EA\u52A9\u7B7E\u7EA6", category: "\u4E1A\u52A1\u529E\u7406", aliases: ["self-sign", "selfsign"] },
  { keyword: "fillInfo", name: "\u4FE1\u606F\u586B\u5199", category: "\u4E1A\u52A1\u529E\u7406", aliases: ["fill-info", "fillinfo"] },
  { keyword: "openAccount", name: "\u5F00\u6237", category: "\u4E1A\u52A1\u529E\u7406", aliases: ["open-account", "openaccount"] },
  { keyword: "apply", name: "\u7533\u8BF7", category: "\u4E1A\u52A1\u529E\u7406", aliases: ["application"] },
  { keyword: "order", name: "\u8BA2\u5355", category: "\u4E1A\u52A1\u529E\u7406", aliases: ["orders"] },
  { keyword: "payment", name: "\u652F\u4ED8", category: "\u4E1A\u52A1\u529E\u7406", aliases: ["pay"] },
  { keyword: "transaction", name: "\u4EA4\u6613", category: "\u4E1A\u52A1\u529E\u7406", aliases: ["trans"] },
  // 数据管理
  { keyword: "dashboard", name: "\u4EEA\u8868\u76D8", category: "\u6570\u636E\u7BA1\u7406", aliases: ["home", "index"] },
  { keyword: "report", name: "\u62A5\u8868", category: "\u6570\u636E\u7BA1\u7406", aliases: ["reports", "statistics"] },
  { keyword: "list", name: "\u5217\u8868", category: "\u6570\u636E\u7BA1\u7406", aliases: ["table"] },
  { keyword: "detail", name: "\u8BE6\u60C5", category: "\u6570\u636E\u7BA1\u7406", aliases: ["details", "info"] },
  // 系统设置
  { keyword: "admin", name: "\u7BA1\u7406\u540E\u53F0", category: "\u7CFB\u7EDF\u8BBE\u7F6E", aliases: ["management"] },
  { keyword: "permission", name: "\u6743\u9650\u7BA1\u7406", category: "\u7CFB\u7EDF\u8BBE\u7F6E", aliases: ["role", "auth"] },
  { keyword: "system", name: "\u7CFB\u7EDF\u7BA1\u7406", category: "\u7CFB\u7EDF\u8BBE\u7F6E", aliases: ["sys"] },
  // 通用组件
  { keyword: "components", name: "\u516C\u5171\u7EC4\u4EF6", category: "\u901A\u7528\u7EC4\u4EF6", aliases: ["component", "common"] },
  { keyword: "layouts", name: "\u5E03\u5C40\u7EC4\u4EF6", category: "\u901A\u7528\u7EC4\u4EF6", aliases: ["layout"] },
  // 工具函数
  { keyword: "utils", name: "\u5DE5\u5177\u51FD\u6570", category: "\u5DE5\u5177\u51FD\u6570", aliases: ["util", "helpers", "helper"] },
  { keyword: "hooks", name: "Hooks", category: "\u5DE5\u5177\u51FD\u6570", aliases: ["composables", "composable"] },
  { keyword: "api", name: "API\u63A5\u53E3", category: "\u5DE5\u5177\u51FD\u6570", aliases: ["apis", "services", "service"] },
  { keyword: "store", name: "\u72B6\u6001\u7BA1\u7406", category: "\u5DE5\u5177\u51FD\u6570", aliases: ["stores", "vuex", "pinia"] }
];
var DEFAULT_MAPPER_CONFIG = {
  modulePatterns: [
    { pattern: "views", type: "page", recursive: true },
    { pattern: "pages", type: "page", recursive: true },
    { pattern: "features", type: "feature", recursive: true },
    { pattern: "modules", type: "feature", recursive: true },
    { pattern: "components", type: "shared", recursive: false },
    { pattern: "composables", type: "util", recursive: false },
    { pattern: "hooks", type: "util", recursive: false },
    { pattern: "utils", type: "util", recursive: false },
    { pattern: "api", type: "api", recursive: true },
    { pattern: "services", type: "api", recursive: true },
    { pattern: "store", type: "store", recursive: true },
    { pattern: "stores", type: "store", recursive: true },
    { pattern: "layouts", type: "layout", recursive: false }
  ],
  entryPatterns: [
    "index.vue",
    "index.tsx",
    "index.ts",
    "App.vue",
    "*.page.vue",
    "*.view.vue"
  ],
  ignorePatterns: [
    "node_modules",
    "dist",
    ".git",
    ".vscode",
    "__tests__",
    "*.test.*",
    "*.spec.*"
  ],
  thresholds: {
    maxFilesPerModule: 50,
    maxLinesPerModule: 5e3,
    maxDependencies: 10,
    maxDependents: 20
  }
};

// scripts/src/report-manager.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
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

// scripts/src/lib/workflow-routing-selection.ts
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function listWorkflowRoutingReportPaths(projectRoot) {
  const reportsDir = path2.join(projectRoot, ".codebuddy", "reports", "workflow-routing");
  if (!fs.existsSync(reportsDir)) return [];
  return fs.readdirSync(reportsDir).filter((fileName) => fileName.endsWith(".routing.json")).map((fileName) => path2.join(reportsDir, fileName)).sort((left, right) => {
    try {
      return fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs;
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

// scripts/src/types/reports.ts
var DEFAULT_RETENTION_POLICY = {
  snapshots: {
    maxCount: 10,
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

// scripts/src/report-manager.ts
var REPORTS_DIR = ".codebuddy/reports";
var MANIFEST_FILE = "manifest.json";
var VALIDATOR_GATE_CANDIDATE_PATHS = [
  "validators/latest/validator-gate-summary.json",
  "validators/validator-gate-summary.json"
];
function getReportsPath(targetDir) {
  return path3.join(targetDir, REPORTS_DIR);
}
function ensureDir(dirPath) {
  if (!fs2.existsSync(dirPath)) {
    fs2.mkdirSync(dirPath, { recursive: true });
  }
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
function readLatestValidatorGateReport(targetDir) {
  for (const reportPath of VALIDATOR_GATE_CANDIDATE_PATHS) {
    const report = readReport(targetDir, reportPath);
    if (report && typeof report.generatedAt === "string") {
      return report;
    }
  }
  return null;
}
function readManifest(targetDir) {
  const manifestPath = path3.join(getReportsPath(targetDir), MANIFEST_FILE);
  if (!fs2.existsSync(manifestPath)) {
    return {
      ...DEFAULT_MANIFEST,
      projectName: path3.basename(targetDir),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  try {
    const content = fs2.readFileSync(manifestPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      ...DEFAULT_MANIFEST,
      projectName: path3.basename(targetDir),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function writeManifest(targetDir, manifest) {
  const reportsPath = getReportsPath(targetDir);
  ensureDir(reportsPath);
  manifest.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  const manifestPath = path3.join(reportsPath, MANIFEST_FILE);
  fs2.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}
function readReport(targetDir, reportPath) {
  const fullPath = path3.join(getReportsPath(targetDir), reportPath);
  if (!fs2.existsSync(fullPath)) {
    return null;
  }
  try {
    const content = fs2.readFileSync(fullPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function writeReport(targetDir, reportPath, data, generatedBy) {
  const reportsPath = getReportsPath(targetDir);
  const fullPath = path3.join(reportsPath, reportPath);
  const dirPath = path3.dirname(fullPath);
  ensureDir(dirPath);
  const content = JSON.stringify(data, null, 2);
  fs2.writeFileSync(fullPath, content, "utf-8");
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
function cleanupOldSnapshots(targetDir, subDir) {
  const dirPath = path3.join(getReportsPath(targetDir), subDir);
  if (!fs2.existsSync(dirPath)) return;
  const files = fs2.readdirSync(dirPath).filter((f) => f.endsWith(".json") && f !== "latest.json").map((f) => ({
    name: f,
    path: path3.join(dirPath, f),
    time: fs2.statSync(path3.join(dirPath, f)).mtime.getTime()
  })).sort((a, b) => b.time - a.time);
  const { maxCount, maxAgeDays } = DEFAULT_RETENTION_POLICY.snapshots;
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1e3;
  const now = Date.now();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (i >= maxCount || now - file.time > maxAge) {
      fs2.unlinkSync(file.path);
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
  const historyFullPath = path3.join(getReportsPath(targetDir), historyPath);
  const historyDir = path3.dirname(historyFullPath);
  ensureDir(historyDir);
  fs2.writeFileSync(historyFullPath, JSON.stringify(snapshot, null, 2), "utf-8");
  cleanupOldSnapshots(targetDir, "modules");
  return meta;
}
function showStatus(targetDir) {
  const manifest = readManifest(targetDir);
  const workflowRouting = readLatestWorkflowRoutingReport(targetDir);
  const validatorGate = readLatestValidatorGateReport(targetDir);
  console.log("");
  console.log("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  console.log("\u2502           CodeBuddy Reports Status                  \u2502");
  console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
  const { architecture, modules, health, tasks } = manifest.reports;
  if (architecture) {
    const age = formatAge(architecture.generatedAt);
    const fresh = getReportAgeHours(architecture.generatedAt) < 24 ? "\u2713 Fresh" : "\u25CB Stale";
    console.log(`\u2502 Architecture:  ${architecture.generatedAt.slice(0, 16)}  (${age})  ${fresh.padEnd(8)} \u2502`);
  } else {
    console.log("\u2502 Architecture:  Not generated                        \u2502");
  }
  if (modules) {
    const age = formatAge(modules.generatedAt);
    const fresh = getReportAgeHours(modules.generatedAt) < 24 ? "\u2713 Fresh" : "\u25CB Stale";
    console.log(`\u2502 Modules:       ${modules.generatedAt.slice(0, 16)}  (${age})  ${fresh.padEnd(8)} \u2502`);
  } else {
    console.log("\u2502 Modules:       Not generated                        \u2502");
  }
  if (health) {
    const timeline = readReport(targetDir, "health/timeline.json");
    const points = timeline?.dataPoints.length || 0;
    console.log(`\u2502 Health Points: ${points} days tracked`.padEnd(52) + "\u2502");
  } else {
    console.log("\u2502 Health Points: Not tracked                          \u2502");
  }
  if (tasks) {
    console.log("\u2502 Active Task:   Yes                                  \u2502");
  } else {
    console.log("\u2502 Active Task:   None                                 \u2502");
  }
  if (workflowRouting) {
    const routeAge = formatAge(workflowRouting.generatedAt);
    const routeText = `Route: ${workflowRouting.decision.selectedWorkflowId} (${workflowRouting.decision.mode}, ${routeAge})`;
    console.log(`\u2502 ${routeText}`.padEnd(52) + "\u2502");
  } else {
    console.log("\u2502 Route:         No workflow routing report           \u2502");
  }
  if (validatorGate) {
    const validatorAge = formatAge(validatorGate.generatedAt);
    const scope = validatorGate.scope.padEnd(6);
    const status = validatorGate.effectiveOk ? "pass" : "fail";
    const validatorText = `Validators: ${status} (${scope.trim()}, ${validatorAge})`;
    console.log(`\u2502 ${validatorText}`.padEnd(52) + "\u2502");
  } else {
    console.log("\u2502 Validators:    No validator gate summary            \u2502");
  }
  console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
  console.log("");
}
function cleanup(targetDir, cacheOnly = false) {
  const reportsPath = getReportsPath(targetDir);
  if (!fs2.existsSync(reportsPath)) {
    console.log("No reports directory found.");
    return;
  }
  let cleanedCount = 0;
  const cachePath = path3.join(targetDir, ".codebuddy/cache");
  if (fs2.existsSync(cachePath)) {
    fs2.rmSync(cachePath, { recursive: true });
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
  console.log(`Cleanup complete. Removed ${cleanedCount} items.`);
}
function exportMarkdown(targetDir) {
  const manifest = readManifest(targetDir);
  const workflowRouting = readLatestWorkflowRoutingReport(targetDir);
  const validatorGate = readLatestValidatorGateReport(targetDir);
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
    lines.push(`- **\u5065\u5EB7\u5EA6**: ${arch.summary.healthScore}/100`);
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
    if (validatorGate.reportFiles.length > 0) {
      lines.push(`- **Artifacts**: ${validatorGate.reportFiles.join(", ")}`);
    }
    lines.push("");
  }
  const output = lines.join("\n");
  const outputPath = path3.join(getReportsPath(targetDir), "export.md");
  fs2.writeFileSync(outputPath, output, "utf-8");
  console.log(`Exported to: ${outputPath}`);
}
function getHistorySnapshots(targetDir, subDir) {
  const dirPath = path3.join(getReportsPath(targetDir), subDir);
  if (!fs2.existsSync(dirPath)) return [];
  return fs2.readdirSync(dirPath).filter((f) => f.endsWith(".json") && f !== "latest.json").map((f) => {
    const datePart = f.replace(".json", "").replace(/T/g, " ").slice(0, 16);
    return {
      name: f,
      date: datePart,
      path: path3.join(dirPath, f)
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
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
function showDiff(targetDir, fromDate, toDate) {
  const archLatest = readReport(targetDir, "architecture/latest.json");
  const modulesLatest = readReport(targetDir, "modules/latest.json");
  if (!archLatest && !modulesLatest) {
    console.log("No reports found. Run analysis first.");
    return;
  }
  const historySnapshots = getHistorySnapshots(targetDir, "architecture");
  if (historySnapshots.length === 0) {
    console.log("No historical snapshots found. Need at least 2 analyses to compare.");
    return;
  }
  let olderArch = null;
  if (fromDate) {
    const matchingSnapshot = historySnapshots.find((s) => s.date.startsWith(fromDate));
    if (matchingSnapshot) {
      try {
        olderArch = JSON.parse(fs2.readFileSync(matchingSnapshot.path, "utf-8"));
      } catch {
        console.log(`Failed to load snapshot: ${matchingSnapshot.path}`);
      }
    }
  } else {
    try {
      olderArch = JSON.parse(fs2.readFileSync(historySnapshots[0].path, "utf-8"));
    } catch {
      console.log("Failed to load historical snapshot.");
    }
  }
  if (!olderArch || !archLatest) {
    console.log("Cannot compare: missing snapshots.");
    return;
  }
  const diff = diffArchitectureSnapshots(olderArch, archLatest);
  console.log("");
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551                    Architecture Diff Report                       \u2551");
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
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
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");
}
function showTrend(targetDir, days = 30) {
  const timeline = readReport(targetDir, "health/timeline.json");
  if (!timeline || timeline.dataPoints.length === 0) {
    console.log("No health data found. Run analysis to start tracking.");
    return;
  }
  const recentPoints = timeline.dataPoints.slice(-days);
  console.log("");
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551                    Health Trend Analysis                          \u2551");
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  const trendIcon = timeline.trends.direction === "improving" ? "\u{1F4C8}" : timeline.trends.direction === "declining" ? "\u{1F4C9}" : "\u27A1\uFE0F";
  const trendText = timeline.trends.direction === "improving" ? "Improving" : timeline.trends.direction === "declining" ? "Declining" : "Stable";
  console.log(`\u2551 Trend: ${trendIcon} ${trendText}`.padEnd(67) + "\u2551");
  console.log(`\u2551 Change Rate: ${timeline.trends.changeRate > 0 ? "+" : ""}${timeline.trends.changeRate}% per week`.padEnd(67) + "\u2551");
  console.log(`\u2551 Predicted Next: ${timeline.trends.prediction}/100`.padEnd(67) + "\u2551");
  console.log(`\u2551 Data Points: ${recentPoints.length} days`.padEnd(67) + "\u2551");
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
  console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
  console.log("\u2551 Recent Data Points:".padEnd(67) + "\u2551");
  const lastFive = recentPoints.slice(-5).reverse();
  for (const point of lastFive) {
    const bar = "\u2588".repeat(Math.round(point.healthScore / 5));
    const icon = point.healthScore >= 80 ? "\u{1F7E2}" : point.healthScore >= 60 ? "\u{1F7E1}" : "\u{1F534}";
    console.log(`\u2551   ${point.date} \u2502 ${icon} ${point.healthScore.toString().padStart(3)}/100 ${bar}`.padEnd(67) + "\u2551");
  }
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");
}
function showHistory(targetDir) {
  const archSnapshots = getHistorySnapshots(targetDir, "architecture");
  const moduleSnapshots = getHistorySnapshots(targetDir, "modules");
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
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");
}
function normalizeFsPath(p) {
  const normalized = path3.normalize(p);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
function toAbsolutePath(targetDir, p) {
  return path3.isAbsolute(p) ? p : path3.resolve(targetDir, p);
}
function isSameOrSubPath(childPath, parentPath) {
  const child = normalizeFsPath(childPath);
  let parent = normalizeFsPath(parentPath);
  if (child === parent) return true;
  if (!parent.endsWith(path3.sep)) parent += path3.sep;
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
      const snap = JSON.parse(fs2.readFileSync(h.path, "utf-8"));
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
      const snap = JSON.parse(fs2.readFileSync(h.path, "utf-8"));
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
  const moduleRelPath = isSameOrSubPath(module2.path, targetDir) ? path3.relative(targetDir, module2.path) : module2.path;
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
  cleanup             \u6E05\u7406\u8FC7\u671F\u62A5\u544A
    --cache-only      \u4EC5\u6E05\u7406\u7F13\u5B58
  export              \u5BFC\u51FA\u62A5\u544A\u4E3A Markdown
  diff                \u5BF9\u6BD4\u67B6\u6784\u5FEB\u7167
    --from <date>     \u8D77\u59CB\u65E5\u671F (YYYY-MM-DD\uFF0C\u53EF\u9009)
  trend               \u663E\u793A\u5065\u5EB7\u5EA6\u8D8B\u52BF
    --days <n>        \u663E\u793A\u5929\u6570 (\u9ED8\u8BA4: 30)
  history             \u5217\u51FA\u5386\u53F2\u5FEB\u7167
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
  node report-manager.js cleanup
  node report-manager.js export
  node report-manager.js diff
  node report-manager.js diff --from 2025-01-15
  node report-manager.js trend --days 14
  node report-manager.js history
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
    targetDir = path3.resolve(command);
    command = args[1];
  }
  if (!command || command === "--help" || command === "-h") {
    showHelp();
    process.exit(0);
  }
  switch (command) {
    case "status":
      showStatus(targetDir);
      break;
    case "cleanup":
      const cacheOnly = args.includes("--cache-only");
      cleanup(targetDir, cacheOnly);
      break;
    case "export":
      exportMarkdown(targetDir);
      break;
    case "diff": {
      const fromIndex = args.indexOf("--from");
      const fromDate = fromIndex !== -1 ? args[fromIndex + 1] : void 0;
      showDiff(targetDir, fromDate);
      break;
    }
    case "trend": {
      const daysIndex = args.indexOf("--days");
      const days = daysIndex !== -1 ? parseInt(args[daysIndex + 1], 10) : 30;
      showTrend(targetDir, days);
      break;
    }
    case "history":
      showHistory(targetDir);
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

// scripts/src/module-mapper.ts
function identifyBusiness(dirName) {
  const lowerName = dirName.toLowerCase();
  for (const mapping of BUSINESS_KEYWORDS) {
    if (lowerName === mapping.keyword.toLowerCase()) {
      return { chineseName: mapping.name, category: mapping.category };
    }
    if (mapping.aliases) {
      for (const alias of mapping.aliases) {
        if (lowerName === alias.toLowerCase()) {
          return { chineseName: mapping.name, category: mapping.category };
        }
      }
    }
    if (lowerName.includes(mapping.keyword.toLowerCase())) {
      return { chineseName: mapping.name, category: mapping.category };
    }
  }
  return { chineseName: dirName, category: "\u5176\u4ED6" };
}
function parseRouterConfig(srcPath) {
  const routeMap = /* @__PURE__ */ new Map();
  const routerPaths = [
    path4.join(srcPath, "router/index.ts"),
    path4.join(srcPath, "router/index.js"),
    path4.join(srcPath, "router/routes.ts"),
    path4.join(srcPath, "router/routes.js"),
    path4.join(srcPath, "routes/index.ts"),
    path4.join(srcPath, "routes/index.js")
  ];
  for (const routerPath of routerPaths) {
    if (fs3.existsSync(routerPath)) {
      try {
        const content = fs3.readFileSync(routerPath, "utf-8");
        const routeRegex = /path:\s*['"]([^'"]+)['"][^}]*component:\s*\([^)]*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        let match;
        while ((match = routeRegex.exec(content)) !== null) {
          const routePath = match[1];
          const componentPath = match[2];
          const viewMatch = componentPath.match(/@\/views\/([^'"]+)/);
          if (viewMatch) {
            const viewName = viewMatch[1].replace(/\/index(\.vue)?$/, "").replace(/\.vue$/, "");
            routeMap.set(viewName, { path: routePath });
          }
        }
        const metaRegex = /path:\s*['"]([^'"]+)['"][^}]*meta:\s*\{[^}]*title:\s*['"]([^'"]+)['"]/g;
        while ((match = metaRegex.exec(content)) !== null) {
          const routePath = match[1];
          const title = match[2];
          for (const [viewName, info] of routeMap.entries()) {
            if (info.path === routePath) {
              routeMap.set(viewName, { ...info, title });
            }
          }
        }
      } catch {
      }
      break;
    }
  }
  return routeMap;
}
function shouldIgnore(name, patterns) {
  for (const pattern of patterns) {
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1);
      if (name.endsWith(ext)) return true;
    } else if (name === pattern || name.includes(pattern)) {
      return true;
    }
  }
  return false;
}
function countFileLines(filePath) {
  try {
    const content = fs3.readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}
function parseImports(filePath) {
  const internal = [];
  const external = [];
  try {
    const content = fs3.readFileSync(filePath, "utf-8");
    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith(".") || importPath.startsWith("@/") || importPath.startsWith("~/")) {
        internal.push(importPath);
      } else if (!importPath.startsWith("vue") && !importPath.startsWith("@vue")) {
        external.push(importPath);
      }
    }
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const requirePath = match[1];
      if (requirePath.startsWith(".") || requirePath.startsWith("@/")) {
        internal.push(requirePath);
      } else {
        external.push(requirePath);
      }
    }
  } catch {
  }
  return {
    internal: [...new Set(internal)],
    external: [...new Set(external)]
  };
}
function scanModules(srcPath, config, maxDepth, routeMap) {
  const modules = [];
  for (const pattern of config.modulePatterns) {
    const moduleDirPath = path4.join(srcPath, pattern.pattern);
    if (!fs3.existsSync(moduleDirPath)) continue;
    const stat = fs3.statSync(moduleDirPath);
    if (!stat.isDirectory()) continue;
    if (pattern.recursive) {
      const subDirs = fs3.readdirSync(moduleDirPath);
      for (const subDir of subDirs) {
        if (shouldIgnore(subDir, config.ignorePatterns)) continue;
        const subDirPath = path4.join(moduleDirPath, subDir);
        const subStat = fs3.statSync(subDirPath);
        if (subStat.isDirectory()) {
          const moduleInfo = analyzeModule(
            subDirPath,
            `${pattern.pattern}/${subDir}`,
            pattern.type,
            config,
            maxDepth,
            routeMap
          );
          modules.push(moduleInfo);
        }
      }
    } else {
      const moduleInfo = analyzeModule(
        moduleDirPath,
        pattern.pattern,
        pattern.type,
        config,
        maxDepth,
        routeMap
      );
      modules.push(moduleInfo);
    }
  }
  return modules;
}
function analyzeModule(modulePath, moduleName, moduleType, config, maxDepth, routeMap) {
  const stats = collectModuleStats(modulePath, config, maxDepth, 0);
  const entries = findEntries(modulePath, config);
  const subModules = findSubModulesDetailed(modulePath, moduleName, config, maxDepth);
  const { internalDeps, externalDeps } = collectDependencies(modulePath, config, maxDepth, 0);
  const issues = detectIssues(stats, internalDeps.length, config);
  const healthScore = calculateHealthScore(stats, issues, internalDeps.length, config);
  const dirName = path4.basename(modulePath);
  const businessInfo = identifyBusiness(dirName);
  let routePath;
  if (routeMap) {
    const routeInfo = routeMap.get(moduleName) || routeMap.get(dirName);
    if (routeInfo) {
      routePath = routeInfo.path;
      if (routeInfo.title) {
        businessInfo.chineseName = routeInfo.title;
      }
    }
  }
  return {
    name: moduleName,
    path: modulePath,
    type: moduleType,
    business: {
      chineseName: businessInfo.chineseName,
      category: businessInfo.category,
      routePath
    },
    entries,
    subModules,
    internalDeps,
    externalDeps,
    relatedModules: [],
    // 后续通过依赖图填充
    stats,
    healthScore,
    issues
  };
}
function collectModuleStats(dirPath, config, maxDepth, currentDepth) {
  const stats = {
    files: 0,
    lines: 0,
    components: 0,
    tsFiles: 0,
    maxFileLines: 0,
    avgFileLines: 0
  };
  if (currentDepth > maxDepth) return stats;
  let entries;
  try {
    entries = fs3.readdirSync(dirPath);
  } catch {
    return stats;
  }
  for (const entry of entries) {
    if (shouldIgnore(entry, config.ignorePatterns)) continue;
    const entryPath = path4.join(dirPath, entry);
    let entryStat;
    try {
      entryStat = fs3.statSync(entryPath);
    } catch {
      continue;
    }
    if (entryStat.isFile()) {
      const ext = path4.extname(entry).toLowerCase();
      if ([".vue", ".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
        stats.files++;
        const lines = countFileLines(entryPath);
        stats.lines += lines;
        stats.maxFileLines = Math.max(stats.maxFileLines, lines);
        if (ext === ".vue") stats.components++;
        if (ext === ".ts" || ext === ".tsx") stats.tsFiles++;
      }
    } else if (entryStat.isDirectory()) {
      const subStats = collectModuleStats(entryPath, config, maxDepth, currentDepth + 1);
      stats.files += subStats.files;
      stats.lines += subStats.lines;
      stats.components += subStats.components;
      stats.tsFiles += subStats.tsFiles;
      stats.maxFileLines = Math.max(stats.maxFileLines, subStats.maxFileLines);
    }
  }
  stats.avgFileLines = stats.files > 0 ? Math.round(stats.lines / stats.files) : 0;
  return stats;
}
function findEntries(modulePath, config) {
  const entries = [];
  try {
    const files = fs3.readdirSync(modulePath);
    for (const file of files) {
      const filePath = path4.join(modulePath, file);
      const stat = fs3.statSync(filePath);
      if (stat.isFile()) {
        for (const pattern of config.entryPatterns) {
          if (pattern.startsWith("*")) {
            if (file.endsWith(pattern.slice(1))) {
              entries.push(file);
              break;
            }
          } else if (file === pattern) {
            entries.push(file);
            break;
          }
        }
      }
    }
  } catch {
  }
  return entries;
}
function findSubModulesDetailed(modulePath, parentModuleName, config, maxDepth) {
  const subModules = [];
  try {
    const entries = fs3.readdirSync(modulePath);
    for (const entry of entries) {
      if (shouldIgnore(entry, config.ignorePatterns)) continue;
      const entryPath = path4.join(modulePath, entry);
      const stat = fs3.statSync(entryPath);
      if (stat.isDirectory()) {
        const subStats = collectModuleStats(entryPath, config, maxDepth, 0);
        if (subStats.files > 0) {
          const businessInfo = identifyBusiness(entry);
          const healthScore = Math.max(0, 100 - (subStats.maxFileLines > 500 ? 30 : 0) - (subStats.files > 20 ? 20 : 0));
          subModules.push({
            name: entry,
            chineseName: businessInfo.chineseName,
            category: businessInfo.category,
            path: entryPath,
            files: subStats.files,
            lines: subStats.lines,
            healthScore
          });
        }
      }
    }
  } catch {
  }
  return subModules;
}
function collectDependencies(dirPath, config, maxDepth, currentDepth) {
  const internalDeps = /* @__PURE__ */ new Set();
  const externalDeps = /* @__PURE__ */ new Set();
  if (currentDepth > maxDepth) return { internalDeps: [], externalDeps: [] };
  let entries;
  try {
    entries = fs3.readdirSync(dirPath);
  } catch {
    return { internalDeps: [], externalDeps: [] };
  }
  for (const entry of entries) {
    if (shouldIgnore(entry, config.ignorePatterns)) continue;
    const entryPath = path4.join(dirPath, entry);
    let entryStat;
    try {
      entryStat = fs3.statSync(entryPath);
    } catch {
      continue;
    }
    if (entryStat.isFile()) {
      const ext = path4.extname(entry).toLowerCase();
      if ([".vue", ".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
        const imports = parseImports(entryPath);
        imports.internal.forEach((i) => internalDeps.add(i));
        imports.external.forEach((e) => externalDeps.add(e.split("/")[0]));
      }
    } else if (entryStat.isDirectory()) {
      const subDeps = collectDependencies(entryPath, config, maxDepth, currentDepth + 1);
      subDeps.internalDeps.forEach((i) => internalDeps.add(i));
      subDeps.externalDeps.forEach((e) => externalDeps.add(e));
    }
  }
  return {
    internalDeps: [...internalDeps],
    externalDeps: [...externalDeps]
  };
}
function detectIssues(stats, depsCount, config) {
  const issues = [];
  const { thresholds } = config;
  if (stats.files > thresholds.maxFilesPerModule) {
    issues.push({
      type: "size",
      severity: "warning",
      message: `\u6A21\u5757\u6587\u4EF6\u6570 ${stats.files} \u8D85\u8FC7\u9608\u503C ${thresholds.maxFilesPerModule}`
    });
  }
  if (stats.lines > thresholds.maxLinesPerModule) {
    issues.push({
      type: "size",
      severity: "error",
      message: `\u6A21\u5757\u4EE3\u7801\u884C\u6570 ${stats.lines} \u8D85\u8FC7\u9608\u503C ${thresholds.maxLinesPerModule}`
    });
  }
  if (stats.maxFileLines > 500) {
    issues.push({
      type: "complexity",
      severity: "error",
      message: `\u5B58\u5728\u8D85\u5927\u6587\u4EF6\uFF08${stats.maxFileLines} \u884C\uFF09`
    });
  }
  if (depsCount > thresholds.maxDependencies) {
    issues.push({
      type: "coupling",
      severity: "warning",
      message: `\u6A21\u5757\u4F9D\u8D56\u6570 ${depsCount} \u8D85\u8FC7\u9608\u503C ${thresholds.maxDependencies}`
    });
  }
  return issues;
}
function calculateHealthScore(stats, issues, depsCount, config) {
  let score = 100;
  const { thresholds } = config;
  if (stats.files > thresholds.maxFilesPerModule) {
    score -= Math.min(20, (stats.files - thresholds.maxFilesPerModule) * 2);
  }
  if (stats.lines > thresholds.maxLinesPerModule) {
    score -= Math.min(25, Math.floor((stats.lines - thresholds.maxLinesPerModule) / 500) * 5);
  }
  if (stats.maxFileLines > 500) {
    score -= Math.min(20, Math.floor((stats.maxFileLines - 500) / 100) * 5);
  }
  if (depsCount > thresholds.maxDependencies) {
    score -= Math.min(15, (depsCount - thresholds.maxDependencies) * 3);
  }
  for (const issue of issues) {
    if (issue.severity === "error") score -= 5;
    if (issue.severity === "warning") score -= 2;
  }
  return Math.max(0, score);
}
function buildDependencyGraph(modules, srcPath) {
  const nodes = modules.map((m) => m.name);
  const edges = [];
  const edgeMap = /* @__PURE__ */ new Map();
  for (const module2 of modules) {
    for (const dep of module2.internalDeps) {
      let targetModule = null;
      if (dep.startsWith("@/") || dep.startsWith("~/")) {
        const relativePath = dep.slice(2);
        const parts = relativePath.split("/");
        for (const m of modules) {
          if (relativePath.startsWith(m.name) || m.name.endsWith(parts[0])) {
            targetModule = m.name;
            break;
          }
        }
      }
      if (targetModule && targetModule !== module2.name) {
        const key = `${module2.name}->${targetModule}`;
        if (edgeMap.has(key)) {
          edgeMap.get(key).count++;
        } else {
          const edge = {
            from: module2.name,
            to: targetModule,
            type: "import",
            count: 1
          };
          edgeMap.set(key, edge);
          edges.push(edge);
        }
        if (!module2.relatedModules.includes(targetModule)) {
          module2.relatedModules.push(targetModule);
        }
      }
    }
  }
  return { nodes, edges };
}
function detectCircularDeps(graph) {
  const cycles = [];
  const visited = /* @__PURE__ */ new Set();
  const recursionStack = /* @__PURE__ */ new Set();
  const path5 = [];
  function dfs(node) {
    visited.add(node);
    recursionStack.add(node);
    path5.push(node);
    const outEdges = graph.edges.filter((e) => e.from === node);
    for (const edge of outEdges) {
      if (!visited.has(edge.to)) {
        dfs(edge.to);
      } else if (recursionStack.has(edge.to)) {
        const cycleStart = path5.indexOf(edge.to);
        if (cycleStart !== -1) {
          cycles.push([...path5.slice(cycleStart), edge.to]);
        }
      }
    }
    path5.pop();
    recursionStack.delete(node);
  }
  for (const node of graph.nodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  return cycles;
}
function generateMermaidGraph(graph, modules) {
  const lines = ["graph LR"];
  const typeStyles = {
    page: ":::page",
    feature: ":::feature",
    shared: ":::shared",
    util: ":::util",
    api: ":::api",
    store: ":::store",
    layout: ":::layout"
  };
  for (const edge of graph.edges) {
    const fromNode = edge.from.replace(/[\/\-]/g, "_");
    const toNode = edge.to.replace(/[\/\-]/g, "_");
    if (edge.count > 3) {
      lines.push(`    ${fromNode} ==> ${toNode}`);
    } else {
      lines.push(`    ${fromNode} --> ${toNode}`);
    }
  }
  lines.push("");
  lines.push("    classDef page fill:#e1f5fe,stroke:#01579b");
  lines.push("    classDef feature fill:#f3e5f5,stroke:#4a148c");
  lines.push("    classDef shared fill:#e8f5e9,stroke:#1b5e20");
  lines.push("    classDef util fill:#fff3e0,stroke:#e65100");
  lines.push("    classDef api fill:#fce4ec,stroke:#880e4f");
  lines.push("    classDef store fill:#e0f2f1,stroke:#004d40");
  for (const module2 of modules) {
    const nodeId = module2.name.replace(/[\/\-]/g, "_");
    const style = typeStyles[module2.type] || "";
    if (style) {
      lines.push(`    class ${nodeId} ${module2.type}`);
    }
  }
  return lines.join("\n");
}
function formatMarkdown(result) {
  const lines = [];
  lines.push("# \u9879\u76EE\u529F\u80FD\u6A21\u5757\u56FE\u8C31");
  lines.push("");
  lines.push(`> \u9879\u76EE: ${result.projectName}`);
  lines.push(`> \u5206\u6790\u65F6\u95F4: ${result.analyzedAt}`);
  lines.push("");
  lines.push("## \u{1F4CA} \u6458\u8981\u7EDF\u8BA1");
  lines.push("");
  lines.push(`- **\u603B\u6A21\u5757\u6570**: ${result.summary.totalModules}`);
  lines.push(`- **\u603B\u6587\u4EF6\u6570**: ${result.summary.totalFiles}`);
  lines.push(`- **\u603B\u4EE3\u7801\u884C\u6570**: ${result.summary.totalLines.toLocaleString()}`);
  lines.push(`- **\u5E73\u5747\u5065\u5EB7\u5EA6**: ${result.summary.avgHealthScore}/100`);
  if (result.summary.circularDeps > 0) {
    lines.push(`- **\u26A0\uFE0F \u5FAA\u73AF\u4F9D\u8D56**: ${result.summary.circularDeps} \u5904`);
  }
  lines.push("");
  lines.push("## \u{1F4E6} \u4E1A\u52A1\u6A21\u5757\u56FE\u8C31");
  lines.push("");
  const categoryMap = /* @__PURE__ */ new Map();
  for (const module2 of result.modules) {
    const category = module2.business?.category || "\u5176\u4ED6";
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category).push(module2);
  }
  const categoryOrder = ["\u7528\u6237\u8BA4\u8BC1", "\u7528\u6237\u7BA1\u7406", "\u4E1A\u52A1\u529E\u7406", "\u6570\u636E\u7BA1\u7406", "\u7CFB\u7EDF\u8BBE\u7F6E", "\u901A\u7528\u7EC4\u4EF6", "\u5DE5\u5177\u51FD\u6570", "\u5176\u4ED6"];
  for (const category of categoryOrder) {
    const modules = categoryMap.get(category);
    if (!modules || modules.length === 0) continue;
    lines.push(`### ${category}`);
    lines.push("");
    lines.push("| \u6A21\u5757 | \u4E2D\u6587\u540D | \u8DEF\u7531 | \u6587\u4EF6\u6570 | \u884C\u6570 | \u5065\u5EB7\u5EA6 |");
    lines.push("|------|--------|------|--------|------|--------|");
    const sortedModules = [...modules].sort((a, b) => b.stats.lines - a.stats.lines);
    for (const module2 of sortedModules) {
      const healthIcon = module2.healthScore >= 80 ? "\u{1F7E2}" : module2.healthScore >= 60 ? "\u{1F7E1}" : "\u{1F534}";
      const chineseName = module2.business?.chineseName || module2.name;
      const routePath = module2.business?.routePath || "-";
      lines.push(`| ${module2.name} | ${chineseName} | ${routePath} | ${module2.stats.files} | ${module2.stats.lines.toLocaleString()} | ${healthIcon} ${module2.healthScore}/100 |`);
      if (module2.subModules && module2.subModules.length > 0) {
        for (const sub of module2.subModules) {
          const subHealthIcon = sub.healthScore >= 80 ? "\u{1F7E2}" : sub.healthScore >= 60 ? "\u{1F7E1}" : "\u{1F534}";
          lines.push(`| \u251C\u2500 ${sub.name} | ${sub.chineseName} | - | ${sub.files} | ${sub.lines.toLocaleString()} | ${subHealthIcon} ${sub.healthScore}/100 |`);
        }
      }
    }
    lines.push("");
  }
  if (result.mermaidGraph) {
    lines.push("## \u{1F517} \u6A21\u5757\u4F9D\u8D56\u56FE");
    lines.push("");
    lines.push("```mermaid");
    lines.push(result.mermaidGraph);
    lines.push("```");
    lines.push("");
  }
  const problemModules = result.modules.filter((m) => m.healthScore < 60 || m.issues.length > 0);
  if (problemModules.length > 0) {
    lines.push("## \u26A0\uFE0F \u9700\u5173\u6CE8\u7684\u6A21\u5757");
    lines.push("");
    for (const module2 of problemModules.slice(0, 10)) {
      const healthIcon = module2.healthScore >= 80 ? "\u{1F7E2}" : module2.healthScore >= 60 ? "\u{1F7E1}" : "\u{1F534}";
      const chineseName = module2.business?.chineseName || module2.name;
      lines.push(`### ${healthIcon} ${chineseName} (${module2.name})`);
      lines.push("");
      lines.push(`- **\u8DEF\u5F84**: \`${module2.path}\``);
      lines.push(`- **\u5065\u5EB7\u5EA6**: ${module2.healthScore}/100`);
      lines.push(`- **\u7EDF\u8BA1**: ${module2.stats.files} \u6587\u4EF6, ${module2.stats.lines.toLocaleString()} \u884C`);
      if (module2.subModules && module2.subModules.length > 0) {
        lines.push(`- **\u5B50\u6A21\u5757**: ${module2.subModules.map((s) => `${s.chineseName}(${s.name})`).join(", ")}`);
      }
      if (module2.issues.length > 0) {
        lines.push(`- **\u95EE\u9898**:`);
        for (const issue of module2.issues) {
          const icon = issue.severity === "error" ? "\u{1F534}" : issue.severity === "warning" ? "\u{1F7E1}" : "\u{1F535}";
          lines.push(`  - ${icon} ${issue.message}`);
        }
      }
      lines.push("");
    }
  }
  lines.push("---");
  lines.push("");
  lines.push("\u{1F4A1} **\u76F8\u5173\u64CD\u4F5C**:");
  lines.push('- \u67E5\u770B\u7ED3\u6784\u5065\u5EB7\u5EA6 \u2192 \u8F93\u5165 "\u7ED3\u6784\u5206\u6790"');
  lines.push('- \u91CD\u6784\u67D0\u4E2A\u6A21\u5757 \u2192 \u8F93\u5165 "\u91CD\u6784 [\u6A21\u5757\u540D] \u6A21\u5757"');
  lines.push('- \u5206\u6790\u5177\u4F53\u6587\u4EF6 \u2192 \u8F93\u5165 "\u5206\u6790 xxx.vue"');
  lines.push("");
  return lines.join("\n");
}
function formatJson(result) {
  return JSON.stringify(result, null, 2);
}
function analyzeModules(options) {
  const {
    targetPath,
    srcDir = "src",
    maxDepth = 5,
    mode = "summary",
    analyzeDeps = true
  } = options;
  const fullPath = path4.resolve(targetPath);
  if (!fs3.existsSync(fullPath)) {
    throw new Error(`\u76EE\u6807\u8DEF\u5F84\u4E0D\u5B58\u5728: ${fullPath}`);
  }
  let scanPath = fullPath;
  const possibleSrcDirs = [srcDir, "src", "packages", "apps", "libs"];
  for (const dir of possibleSrcDirs) {
    const candidatePath = path4.join(fullPath, dir);
    if (fs3.existsSync(candidatePath) && fs3.statSync(candidatePath).isDirectory()) {
      scanPath = candidatePath;
      break;
    }
  }
  const config = DEFAULT_MAPPER_CONFIG;
  const routeMap = parseRouterConfig(scanPath);
  const modules = scanModules(scanPath, config, maxDepth, routeMap);
  const dependencyGraph = analyzeDeps ? buildDependencyGraph(modules, scanPath) : { nodes: [], edges: [] };
  const circularDeps = analyzeDeps ? detectCircularDeps(dependencyGraph) : [];
  const mermaidGraph = mode !== "summary" ? generateMermaidGraph(dependencyGraph, modules) : void 0;
  const modulesByType = {
    page: 0,
    feature: 0,
    shared: 0,
    util: 0,
    api: 0,
    store: 0,
    layout: 0
  };
  let totalFiles = 0;
  let totalLines = 0;
  let totalHealth = 0;
  for (const module2 of modules) {
    modulesByType[module2.type]++;
    totalFiles += module2.stats.files;
    totalLines += module2.stats.lines;
    totalHealth += module2.healthScore;
  }
  const isolatedModules = modules.filter(
    (m) => m.relatedModules.length === 0 && !dependencyGraph.edges.some((e) => e.to === m.name)
  ).length;
  const summary = {
    totalModules: modules.length,
    modulesByType,
    totalFiles,
    totalLines,
    avgHealthScore: modules.length > 0 ? Math.round(totalHealth / modules.length) : 0,
    circularDeps: circularDeps.length,
    isolatedModules
  };
  return {
    projectName: path4.basename(fullPath),
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
    modules,
    dependencyGraph,
    summary,
    mermaidGraph
  };
}
function parseArgs(args) {
  const options = {
    targetPath: "",
    noSave: false
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--mode" && args[i + 1]) {
      options.mode = args[++i];
    } else if (arg === "--output" && args[i + 1]) {
      options.outputFormat = args[++i];
    } else if (arg === "--no-deps") {
      options.analyzeDeps = false;
    } else if (arg === "--max-depth" && args[i + 1]) {
      options.maxDepth = parseInt(args[++i], 10);
    } else if (arg === "--no-save") {
      options.noSave = true;
    } else if (!arg.startsWith("-") && !options.targetPath) {
      options.targetPath = arg;
    }
  }
  return options;
}
function showHelp2() {
  console.log(`
Module Mapper - \u529F\u80FD\u6A21\u5757\u56FE\u8C31\u5206\u6790\u5668

\u7528\u6CD5: node module-mapper.js <path> [options]

\u53C2\u6570:
  <path>              \u76EE\u6807\u9879\u76EE\u8DEF\u5F84

\u9009\u9879:
  --mode <mode>       \u8F93\u51FA\u6A21\u5F0F: summary | full | graph (\u9ED8\u8BA4: summary)
  --output <format>   \u8F93\u51FA\u683C\u5F0F: json | markdown | mermaid (\u9ED8\u8BA4: markdown)
  --no-deps           \u8DF3\u8FC7\u4F9D\u8D56\u5206\u6790\uFF08\u52A0\u5FEB\u901F\u5EA6\uFF09
  --max-depth <n>     \u6700\u5927\u626B\u63CF\u6DF1\u5EA6 (\u9ED8\u8BA4: 5)
  --no-save           \u4E0D\u4FDD\u5B58\u62A5\u544A\u5230 .codebuddy/reports/
  -h, --help          \u663E\u793A\u5E2E\u52A9\u4FE1\u606F

\u793A\u4F8B:
  node module-mapper.js ./my-project
  node module-mapper.js ./my-project --mode full --output json
  node module-mapper.js ./my-project --mode graph --output mermaid
`);
}
function toModuleMapSnapshot(result) {
  const categories = {};
  for (const module2 of result.modules) {
    const cat = module2.business?.category || "\u5176\u4ED6";
    if (!categories[cat]) {
      categories[cat] = { modules: [], totalFiles: 0, totalLines: 0 };
    }
    categories[cat].modules.push(module2.name);
    categories[cat].totalFiles += module2.stats.files;
    categories[cat].totalLines += module2.stats.lines;
  }
  const modules = result.modules.map((m) => ({
    name: m.name,
    chineseName: m.business?.chineseName || m.name,
    category: m.business?.category || "\u5176\u4ED6",
    type: m.type,
    path: m.path,
    routePath: m.business?.routePath,
    stats: {
      files: m.stats.files,
      lines: m.stats.lines,
      components: m.stats.components
    },
    healthScore: m.healthScore,
    subModules: m.subModules.map((s) => ({
      name: s.name,
      chineseName: s.chineseName,
      files: s.files,
      lines: s.lines
    })),
    dependencies: m.internalDeps.slice(0, 10),
    dependents: m.relatedModules
  }));
  return {
    meta: {
      version: "1.0.0",
      projectName: result.projectName,
      analyzedAt: result.analyzedAt,
      analyzedBy: "module-mapper"
    },
    summary: {
      totalModules: result.summary.totalModules,
      avgHealthScore: result.summary.avgHealthScore,
      circularDeps: result.summary.circularDeps,
      isolatedModules: result.summary.isolatedModules
    },
    categories,
    modules,
    graph: {
      nodes: result.dependencyGraph.nodes,
      edges: result.dependencyGraph.edges.map((e) => ({
        from: e.from,
        to: e.to,
        weight: e.count
      }))
    }
  };
}
function saveReports(targetPath, result) {
  try {
    const snapshot = toModuleMapSnapshot(result);
    saveModuleMapSnapshot(targetPath, snapshot);
    const reportsPath = getReportsPath(targetPath);
    const modulesDir = path4.join(reportsPath, "modules");
    if (!fs3.existsSync(modulesDir)) {
      fs3.mkdirSync(modulesDir, { recursive: true });
    }
    const markdownContent = formatMarkdown(result);
    fs3.writeFileSync(path4.join(modulesDir, "latest.md"), markdownContent, "utf-8");
    if (result.mermaidGraph) {
      fs3.writeFileSync(path4.join(modulesDir, "dependency-graph.mmd"), result.mermaidGraph, "utf-8");
    }
    console.log(`[Reports] \u5DF2\u4FDD\u5B58\u6A21\u5757\u56FE\u8C31\u5230 .codebuddy/reports/modules/ (json + md)`);
  } catch (error) {
    console.warn(`[Reports] \u4FDD\u5B58\u62A5\u544A\u5931\u8D25: ${error.message}`);
  }
}
function checkExistingReport(targetPath) {
  try {
    const manifest = readManifest(targetPath);
    if (manifest.reports.modules) {
      const ageHours = getReportAgeHours(manifest.reports.modules.generatedAt);
      return { exists: true, ageHours };
    }
  } catch {
  }
  return { exists: false, ageHours: -1 };
}
function main2() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  if (options.help) {
    showHelp2();
    process.exit(0);
  }
  if (!options.targetPath) {
    console.error("\u9519\u8BEF: \u8BF7\u6307\u5B9A\u76EE\u6807\u9879\u76EE\u8DEF\u5F84");
    showHelp2();
    process.exit(1);
  }
  try {
    const existing = checkExistingReport(options.targetPath);
    if (existing.exists && existing.ageHours < 24 && existing.ageHours >= 0) {
      console.log(`[Reports] \u53D1\u73B0 ${existing.ageHours} \u5C0F\u65F6\u524D\u7684\u62A5\u544A\uFF0C\u53EF\u901A\u8FC7 --no-save \u8DF3\u8FC7\u4FDD\u5B58`);
    }
    const result = analyzeModules(options);
    const outputFormat = options.outputFormat || "markdown";
    if (outputFormat === "json") {
      console.log(formatJson(result));
    } else if (outputFormat === "mermaid" && result.mermaidGraph) {
      console.log(result.mermaidGraph);
    } else {
      console.log(formatMarkdown(result));
    }
    if (!options.noSave) {
      saveReports(path4.resolve(options.targetPath), result);
    }
  } catch (error) {
    console.error("\u5206\u6790\u5931\u8D25:", error.message);
    process.exit(1);
  }
}
if (isDirectCliEntry("module-mapper.js")) {
  main2();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  analyzeModules
});
