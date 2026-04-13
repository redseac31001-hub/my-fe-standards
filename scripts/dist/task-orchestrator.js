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

// scripts/src/task-orchestrator.ts
var task_orchestrator_exports = {};
__export(task_orchestrator_exports, {
  resolveWorkflowSelection: () => resolveWorkflowSelection,
  runOrchestratorOnce: () => runOnce,
  workflowRoutingReportPath: () => workflowRoutingReportPath
});
module.exports = __toCommonJS(task_orchestrator_exports);
var fs4 = __toESM(require("fs"));
var path6 = __toESM(require("path"));
var import_child_process = require("child_process");
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

// scripts/src/lib/execution-metrics.ts
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));
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
  fs.appendFileSync(metricsPaths.eventsFile, `${JSON.stringify(event)}
`, "utf-8");
  const summary = loadExecutionMetricsSummary(projectRoot);
  applyEvent(summary, event);
  summary.generatedAt = event.recordedAt;
  summary.lastEventAt = event.recordedAt;
  fs.writeFileSync(metricsPaths.summaryFile, JSON.stringify(summary, null, 2), "utf-8");
  return event;
}
function loadExecutionMetricsSummary(projectRoot = process.cwd()) {
  const summaryPath = path2.join(projectRoot, ".codebuddy", "reports", "metrics", "latest-summary.json");
  if (!fs.existsSync(summaryPath)) {
    return createEmptySummary(projectRoot);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    return normalizeSummary(parsed, projectRoot);
  } catch {
    return createEmptySummary(projectRoot);
  }
}
function getExecutionMetricsPaths(projectRoot = process.cwd()) {
  return {
    dir: path2.join(projectRoot, ".codebuddy", "reports", "metrics"),
    eventsFile: path2.join(projectRoot, ".codebuddy", "reports", "metrics", "execution-events.jsonl"),
    summaryFile: path2.join(projectRoot, ".codebuddy", "reports", "metrics", "latest-summary.json")
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
function ensureMetricsDir(metricsDir) {
  fs.mkdirSync(metricsDir, { recursive: true });
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

// scripts/src/lib/task-intake-routing.ts
var API_ADAPTATION_SIGNAL = /(api|mock|request|response|field mapping|parameter mapping|adapter|adapt|replace mock|switch api|wire up|integration|联调|对接|接入接口|切接口|接口|参数映射|返回映射|真实接口)/i;
var BUGFIX_SIGNAL = /(bug|fix|hotfix|repair|debug|修复|报错|错误|异常|故障|白屏)/i;
var REFACTOR_SIGNAL = /(refactor|cleanup|extract|split|migration|upgrade|modernize|revamp|重构|改造|升级|迁移|治理|整理|提取|拆分)/i;
var REVIEW_SIGNAL = /(review|audit|审查|审阅|检查)/i;
var FEATURE_SIGNAL = /(feature|需求|新功能|新增|prd|方案|落地|推进|交付|接入|集成)/i;
var CROSS_MODULE_SIGNAL = /(cross[- ]module|cross[- ]domain|multi[- ]module|across .* (module|page|flow)|跨模块|多模块|多个模块|跨页面|跨流程|联动改造)/i;
var HANDOFF_SIGNAL = /(handoff|staged review|交接|多人协作|多 agent|multi[- ]agent|分阶段|阶段性交付)/i;
var PARALLEL_WORK_SIGNAL = /(parallel|并行|多人协作|多 agent|协同开发)/i;
var DURABLE_TRACKING_SIGNAL = /(closed loop|durable tracking|trackable|milestone|验收闭环|测试闭环|review 闭环|测试和 review|review 和测试|里程碑|可追踪|可审计|阶段性验收)/i;
var ARCHITECTURE_CHANGE_SIGNAL = /(architecture|module boundary|layering|架构调整|架构边界|模块边界|分层调整|目录结构调整)/i;
var STATE_MODEL_CHANGE_SIGNAL = /(state model|state management|shared state|store|vuex|pinia|状态模型|状态管理|统一状态|共享状态)/i;
var ROUTING_CHANGE_SIGNAL = /(route change|router|navigation|redirect|路由|跳转|导航)/i;
var WORKFLOW_CHANGE_SIGNAL = /(workflow|execution flow|提交流程|审批流程|业务流程|执行流|编排|闭环)/i;
var PLANNING_ONLY_SIGNAL = /(先(别|不要)写代码|只做规划|只做方案|先给(我)?(实施计划|计划|方案|技术方案)|先做任务分解|先做需求拆解|先评估(一下)?|先分析方案|先梳理任务|先拆分任务)/i;
var EXECUTION_INTENT_SIGNAL = /((帮我|请).*(实现|做|改|改造|接入|落地|推进|完成|修复)|开始(做|推进)|执行这个需求|直接(实现|改|落地)|补上(测试|review|审查)|把.*(切到|改成|迁移到).*(真实接口|新接口))/i;
function uniqStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0)));
}
function buildSignal(id, matched, detail, weight, hardEscalation = false) {
  return { id, matched, detail, weight, hardEscalation };
}
function normalizeNullableCount(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.max(0, Math.floor(value));
  return Number.isFinite(normalized) ? normalized : null;
}
function getGeneratedAt(value) {
  return value || (/* @__PURE__ */ new Date()).toISOString();
}
function collectRouteText(input) {
  return uniqStrings([
    input.title ?? "",
    input.description ?? "",
    ...input.routeHints
  ]).join(" ");
}
function inferKindFromText(routeText) {
  if (!routeText.trim()) return "unknown";
  if (API_ADAPTATION_SIGNAL.test(routeText)) return "api-adaptation";
  if (BUGFIX_SIGNAL.test(routeText)) return "bugfix";
  if (REFACTOR_SIGNAL.test(routeText)) return "refactor";
  if (REVIEW_SIGNAL.test(routeText)) return "review";
  if (FEATURE_SIGNAL.test(routeText)) return "feature";
  return "unknown";
}
function resolveKind(input) {
  if (input.kind && input.kind !== "unknown") return input.kind;
  return inferKindFromText(collectRouteText(input));
}
function normalizeReason(detail, fallback) {
  return detail?.trim() || fallback;
}
function resolveDirectValidation(kind) {
  const steps = ["npm run build", "npm test"];
  if (kind === "api-adaptation") {
    steps.push("Run one narrow API/request smoke for the affected module");
  } else if (kind === "bugfix") {
    steps.push("Run one focused smoke or regression for the affected interaction");
  } else if (kind === "refactor") {
    steps.push("Run one focused before/after behavior check for the touched module");
  } else {
    steps.push("Add the narrowest domain-specific verification that proves the change");
  }
  return steps;
}
function resolveSuggestedNextSteps(responseMode, path7, kind) {
  if (responseMode === "planner") {
    return [
      "Collect the smallest relevant context first, then stop at planning output.",
      "Produce scope, risks, task breakdown, and acceptance/verification contracts without changing code.",
      "Carry the recommended workflow/spec hints forward so execution can resume without re-routing."
    ];
  }
  if (path7 === "direct") {
    return [
      "Read the explicit contract and the smallest relevant file set first.",
      "Change code directly without starting task-orchestrator by default.",
      `Keep the task focused on one pass${kind !== "unknown" ? ` (${kind})` : ""} and only escalate if complexity grows.`
    ];
  }
  return [
    "Escalate to task-orchestrator or TaskBook-based execution for durable tracking.",
    "Keep staged review, handoff, and validation evidence inside the orchestrated path.",
    "Use quick gate plus focused E2E as the task scope expands."
  ];
}
function resolveResponseMode(routeText, recommendedPath) {
  const planningOnly = PLANNING_ONLY_SIGNAL.test(routeText);
  const hasExecutionIntent = EXECUTION_INTENT_SIGNAL.test(routeText);
  if (planningOnly && !hasExecutionIntent) {
    return "planner";
  }
  if (recommendedPath === "direct") {
    return "direct";
  }
  return "task-orchestrator";
}
function resolveComplexityTier(responseMode, workflowId) {
  if (responseMode === "direct" && workflowId === "micro") {
    return "simple";
  }
  if (workflowId === "default") {
    return "complex";
  }
  return "standard";
}
function resolveSuggestedValidation(responseMode, path7, kind) {
  if (responseMode === "planner") {
    return [
      "Validate that scope, constraints, risks, and dependencies are explicit.",
      "Validate each task includes acceptanceCriteria and executionSpec verification."
    ];
  }
  return path7 === "direct" ? resolveDirectValidation(kind) : ["Use task-orchestrator / TaskBook-based execution.", "Run quick gate and the narrowest relevant E2E for the affected workflow."];
}
function resolveDocumentationPlan(responseMode, complexityTier) {
  if (responseMode === "direct") {
    return {
      documentationTier: "minimal",
      documentationArtifacts: [
        "requirement-summary",
        "change-summary",
        "verification-summary"
      ]
    };
  }
  if (responseMode === "planner" || complexityTier === "standard") {
    return {
      documentationTier: "standard",
      documentationArtifacts: [
        "00-requirement.md",
        "02-plan.md",
        "taskbook",
        "acceptance-report"
      ]
    };
  }
  return {
    documentationTier: "full",
    documentationArtifacts: [
      "00-requirement.md",
      "01-design.md",
      "02-plan.md",
      "taskbook",
      "review-report",
      "test-evidence",
      "acceptance-report"
    ]
  };
}
function resolveRecommendedWorkflowId(params) {
  if (params.recommendedPath === "direct") {
    return "micro";
  }
  const highComplexity = params.contractState === "none" || params.uncertainty === "high" || params.requiresHandoff || params.requiresParallelWork || params.requiresDurableTracking || params.changesArchitecture || params.changesStateModel || params.changesRouting || params.changesWorkflow || typeof params.estimatedDomainCount === "number" && params.estimatedDomainCount > 1 || typeof params.estimatedModuleCount === "number" && params.estimatedModuleCount > 2 || typeof params.estimatedFileCount === "number" && params.estimatedFileCount > 12;
  return highComplexity ? "default" : "sprint";
}
function resolveRecommendedSpecMode(workflowId) {
  if (workflowId === "default") {
    return "linked-spec-kit";
  }
  return "inline-open-spec";
}
function normalizeTaskIntakeInput(input) {
  const title = input.title?.trim() || null;
  const description = input.description?.trim() || null;
  const routeHints = uniqStrings(input.routeHints ?? []);
  const routeText = uniqStrings([
    title ?? "",
    description ?? "",
    ...routeHints
  ]).join(" ");
  const estimatedModuleCount = normalizeNullableCount(input.estimatedModuleCount) ?? (CROSS_MODULE_SIGNAL.test(routeText) ? 2 : null);
  return {
    title,
    description,
    kind: input.kind ?? null,
    contractState: input.contractState,
    uncertainty: input.uncertainty,
    estimatedFileCount: normalizeNullableCount(input.estimatedFileCount),
    estimatedModuleCount,
    estimatedDomainCount: normalizeNullableCount(input.estimatedDomainCount),
    estimatedEndpointCount: normalizeNullableCount(input.estimatedEndpointCount),
    requiresHandoff: Boolean(input.requiresHandoff) || HANDOFF_SIGNAL.test(routeText),
    requiresParallelWork: Boolean(input.requiresParallelWork) || PARALLEL_WORK_SIGNAL.test(routeText),
    requiresDurableTracking: Boolean(input.requiresDurableTracking) || DURABLE_TRACKING_SIGNAL.test(routeText),
    changesArchitecture: Boolean(input.changesArchitecture) || ARCHITECTURE_CHANGE_SIGNAL.test(routeText),
    changesStateModel: Boolean(input.changesStateModel) || STATE_MODEL_CHANGE_SIGNAL.test(routeText),
    changesRouting: Boolean(input.changesRouting) || ROUTING_CHANGE_SIGNAL.test(routeText),
    changesWorkflow: Boolean(input.changesWorkflow) || WORKFLOW_CHANGE_SIGNAL.test(routeText),
    routeHints
  };
}
function routeTaskIntake(rawInput, options) {
  const input = normalizeTaskIntakeInput(rawInput);
  const routeText = collectRouteText(input);
  const inferredKind = resolveKind(input);
  const estimatedFileCount = input.estimatedFileCount;
  const estimatedModuleCount = input.estimatedModuleCount;
  const estimatedDomainCount = input.estimatedDomainCount;
  const estimatedEndpointCount = input.estimatedEndpointCount;
  const signals = [
    buildSignal(
      "explicit_contract",
      input.contractState === "explicit",
      input.contractState === "explicit" ? "The external contract is explicit." : void 0,
      3
    ),
    buildSignal(
      "partial_contract",
      input.contractState === "partial",
      input.contractState === "partial" ? "The external contract is only partially explicit." : void 0,
      1
    ),
    buildSignal(
      "missing_contract",
      input.contractState === "none",
      input.contractState === "none" ? "The external contract is incomplete or missing." : void 0,
      4,
      true
    ),
    buildSignal(
      "low_uncertainty",
      input.uncertainty === "low",
      input.uncertainty === "low" ? "The task has low uncertainty." : void 0,
      2
    ),
    buildSignal(
      "medium_uncertainty",
      input.uncertainty === "medium",
      input.uncertainty === "medium" ? "The task has medium uncertainty." : void 0,
      1
    ),
    buildSignal(
      "high_uncertainty",
      input.uncertainty === "high",
      input.uncertainty === "high" ? "The task has high uncertainty." : void 0,
      4,
      true
    ),
    buildSignal(
      "small_file_set",
      typeof estimatedFileCount === "number" && estimatedFileCount <= 5,
      typeof estimatedFileCount === "number" ? `estimatedFileCount=${estimatedFileCount}` : void 0,
      2
    ),
    buildSignal(
      "wide_file_set",
      typeof estimatedFileCount === "number" && estimatedFileCount > 8,
      typeof estimatedFileCount === "number" ? `estimatedFileCount=${estimatedFileCount}` : void 0,
      2
    ),
    buildSignal(
      "cross_module",
      typeof estimatedModuleCount === "number" && estimatedModuleCount > 1,
      typeof estimatedModuleCount === "number" ? `estimatedModuleCount=${estimatedModuleCount}` : void 0,
      4,
      true
    ),
    buildSignal(
      "cross_domain",
      typeof estimatedDomainCount === "number" && estimatedDomainCount > 1,
      typeof estimatedDomainCount === "number" ? `estimatedDomainCount=${estimatedDomainCount}` : void 0,
      4,
      true
    ),
    buildSignal(
      "small_endpoint_set",
      typeof estimatedEndpointCount === "number" && estimatedEndpointCount > 0 && estimatedEndpointCount <= 3,
      typeof estimatedEndpointCount === "number" ? `estimatedEndpointCount=${estimatedEndpointCount}` : void 0,
      1
    ),
    buildSignal(
      "wide_endpoint_set",
      typeof estimatedEndpointCount === "number" && estimatedEndpointCount > 5,
      typeof estimatedEndpointCount === "number" ? `estimatedEndpointCount=${estimatedEndpointCount}` : void 0,
      1
    ),
    buildSignal("requires_handoff", input.requiresHandoff, "The task needs staged handoff.", 4, true),
    buildSignal("requires_parallel_work", input.requiresParallelWork, "The task needs parallel ownership.", 4, true),
    buildSignal("requires_durable_tracking", input.requiresDurableTracking, "The task needs durable tracking.", 4, true),
    buildSignal("changes_architecture", input.changesArchitecture, "The task changes architecture boundaries.", 5, true),
    buildSignal("changes_state_model", input.changesStateModel, "The task changes state flow or state-model behavior.", 5, true),
    buildSignal("changes_routing", input.changesRouting, "The task changes routing or navigation behavior.", 4, true),
    buildSignal("changes_workflow", input.changesWorkflow, "The task changes workflow or execution behavior.", 4, true),
    buildSignal(
      "kind_api_adaptation",
      inferredKind === "api-adaptation",
      inferredKind === "api-adaptation" ? "The task looks like API adaptation or mock replacement." : void 0,
      2
    ),
    buildSignal(
      "kind_localized_fix",
      inferredKind === "bugfix" || inferredKind === "refactor",
      inferredKind === "bugfix" || inferredKind === "refactor" ? `The task looks like a focused ${inferredKind}.` : void 0,
      1
    ),
    buildSignal(
      "kind_feature",
      inferredKind === "feature",
      inferredKind === "feature" ? "The task looks like a broader feature request." : void 0,
      2
    ),
    buildSignal(
      "planning_only_intent",
      PLANNING_ONLY_SIGNAL.test(routeText),
      PLANNING_ONLY_SIGNAL.test(routeText) ? "The request explicitly asks for planning only before coding." : void 0,
      2
    )
  ];
  const hardEscalationTriggers = signals.filter((signal) => signal.matched && signal.hardEscalation).map((signal) => normalizeReason(signal.detail, signal.id));
  let directScore = 0;
  let orchestratedScore = 0;
  for (const signal of signals) {
    if (!signal.matched) continue;
    switch (signal.id) {
      case "explicit_contract":
      case "low_uncertainty":
      case "small_file_set":
      case "small_endpoint_set":
      case "kind_api_adaptation":
      case "kind_localized_fix":
        directScore += signal.weight ?? 1;
        break;
      case "partial_contract":
      case "medium_uncertainty":
      case "wide_file_set":
      case "wide_endpoint_set":
      case "kind_feature":
        orchestratedScore += signal.weight ?? 1;
        break;
      default:
        if (signal.hardEscalation) {
          orchestratedScore += signal.weight ?? 1;
        }
        break;
    }
  }
  const recommendedPath = hardEscalationTriggers.length > 0 ? "orchestrated" : directScore >= orchestratedScore ? "direct" : "orchestrated";
  const reasons = recommendedPath === "direct" ? uniqStrings([
    "The task stays within the small-change direct-execution boundary.",
    ...signals.find((signal) => signal.id === "explicit_contract" && signal.matched)?.detail ? [signals.find((signal) => signal.id === "explicit_contract" && signal.matched).detail] : [],
    ...signals.find((signal) => signal.id === "low_uncertainty" && signal.matched)?.detail ? [signals.find((signal) => signal.id === "low_uncertainty" && signal.matched).detail] : [],
    ...signals.find((signal) => signal.id === "small_file_set" && signal.matched)?.detail ? [signals.find((signal) => signal.id === "small_file_set" && signal.matched).detail] : [],
    ...signals.find((signal) => signal.id === "kind_api_adaptation" && signal.matched)?.detail ? [signals.find((signal) => signal.id === "kind_api_adaptation" && signal.matched).detail] : [],
    ...signals.find((signal) => signal.id === "kind_localized_fix" && signal.matched)?.detail ? [signals.find((signal) => signal.id === "kind_localized_fix" && signal.matched).detail] : []
  ]) : uniqStrings([
    hardEscalationTriggers.length > 0 ? "One or more orchestration escalation triggers are active." : "The task is broader or less certain than a one-pass direct execution.",
    ...hardEscalationTriggers,
    ...signals.find((signal) => signal.id === "wide_file_set" && signal.matched)?.detail ? [signals.find((signal) => signal.id === "wide_file_set" && signal.matched).detail] : [],
    ...signals.find((signal) => signal.id === "wide_endpoint_set" && signal.matched)?.detail ? [signals.find((signal) => signal.id === "wide_endpoint_set" && signal.matched).detail] : [],
    ...signals.find((signal) => signal.id === "kind_feature" && signal.matched)?.detail ? [signals.find((signal) => signal.id === "kind_feature" && signal.matched).detail] : []
  ]);
  const confidence = recommendedPath === "direct" ? input.contractState === "explicit" && input.uncertainty === "low" && typeof estimatedFileCount === "number" && estimatedFileCount <= 5 ? "high" : "medium" : hardEscalationTriggers.length > 0 || input.uncertainty === "high" ? "high" : "medium";
  const recommendedWorkflowId = resolveRecommendedWorkflowId({
    recommendedPath,
    contractState: input.contractState,
    uncertainty: input.uncertainty,
    estimatedFileCount,
    estimatedModuleCount,
    estimatedDomainCount,
    requiresHandoff: input.requiresHandoff,
    requiresParallelWork: input.requiresParallelWork,
    requiresDurableTracking: input.requiresDurableTracking,
    changesArchitecture: input.changesArchitecture,
    changesStateModel: input.changesStateModel,
    changesRouting: input.changesRouting,
    changesWorkflow: input.changesWorkflow
  });
  const recommendedSpecMode = resolveRecommendedSpecMode(recommendedWorkflowId);
  const recommendedResponseMode = resolveResponseMode(routeText, recommendedPath);
  const complexityTier = resolveComplexityTier(recommendedResponseMode, recommendedWorkflowId);
  const documentationPlan = resolveDocumentationPlan(recommendedResponseMode, complexityTier);
  const normalizedReasons = recommendedResponseMode === "planner" ? uniqStrings([
    "The request should stop at planning before coding.",
    ...reasons
  ]) : reasons;
  return {
    recommendedResponseMode,
    recommendedPath,
    complexityTier,
    documentationTier: documentationPlan.documentationTier,
    documentationArtifacts: documentationPlan.documentationArtifacts,
    recommendedWorkflowId,
    recommendedSpecMode,
    confidence,
    inferredKind,
    reasons: normalizedReasons,
    signals,
    hardEscalationTriggers,
    suggestedNextSteps: resolveSuggestedNextSteps(recommendedResponseMode, recommendedPath, inferredKind),
    suggestedValidation: resolveSuggestedValidation(recommendedResponseMode, recommendedPath, inferredKind),
    generatedAt: getGeneratedAt(options?.generatedAt)
  };
}
function createDefaultTaskIntakeInput(overrides = {}) {
  return normalizeTaskIntakeInput({
    title: null,
    description: null,
    kind: null,
    contractState: "partial",
    uncertainty: "medium",
    estimatedFileCount: null,
    estimatedModuleCount: null,
    estimatedDomainCount: null,
    estimatedEndpointCount: null,
    requiresHandoff: false,
    requiresParallelWork: false,
    requiresDurableTracking: false,
    changesArchitecture: false,
    changesStateModel: false,
    changesRouting: false,
    changesWorkflow: false,
    routeHints: [],
    ...overrides
  });
}
function normalizeTaskIntakeKind(value) {
  if (value === "api-adaptation" || value === "bugfix" || value === "refactor" || value === "feature" || value === "review" || value === "analysis" || value === "unknown") {
    return value;
  }
  return null;
}

// scripts/src/lib/workflow-routing-selection.ts
var fs3 = __toESM(require("fs"));
var path5 = __toESM(require("path"));

// scripts/src/lib/project-detection.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
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
    return fs2.existsSync(filePath) ? fs2.readFileSync(filePath, "utf-8") : "";
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
  return markers.filter((marker) => fs2.existsSync(path3.join(projectDir, marker.file))).map((marker) => marker.tag);
}
function detectGenericNodeBackendProject(projectDir, packageJson) {
  const scripts = packageJson.scripts || {};
  const scriptValues = Object.values(scripts).filter((value) => typeof value === "string");
  const hasBackendScript = scriptValues.some(
    (command) => /(node|nodemon|tsx|ts-node|ts-node-dev|bun|pm2)/i.test(command) && /(server|api|listen|http)/i.test(command)
  );
  for (const relativePath of NODE_BACKEND_STRONG_ENTRY_FILES) {
    if (fs2.existsSync(path3.join(projectDir, relativePath))) {
      return true;
    }
  }
  for (const relativePath of NODE_BACKEND_WEAK_ENTRY_FILES) {
    const absolutePath = path3.join(projectDir, relativePath);
    if (!fs2.existsSync(absolutePath)) {
      continue;
    }
    const content = readProjectFileIfExists(absolutePath);
    if (/(createServer|listen\s*\(|process\.env\.PORT|IncomingMessage|ServerResponse)/.test(content)) {
      return true;
    }
  }
  const layoutClues = NODE_BACKEND_LAYOUT_DIRS.filter(
    (relativePath) => fs2.existsSync(path3.join(projectDir, relativePath))
  ).length;
  if (layoutClues >= 2) {
    return true;
  }
  return hasBackendScript && layoutClues >= 1;
}
function detectJavaProjectMetadata(projectDir) {
  const pomContent = readProjectFileIfExists(path3.join(projectDir, "pom.xml"));
  const gradleContent = readProjectFileIfExists(path3.join(projectDir, "build.gradle")) || readProjectFileIfExists(path3.join(projectDir, "build.gradle.kts"));
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
  const cargoContent = readProjectFileIfExists(path3.join(projectDir, "Cargo.toml"));
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
  const projectFiles = fs2.readdirSync(projectDir).filter((entry) => entry.endsWith(".csproj") || entry.endsWith(".fsproj"));
  const combinedContent = projectFiles.map((file) => readProjectFileIfExists(path3.join(projectDir, file))).join("\n").toLowerCase();
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
      realDir = fs2.realpathSync(dir);
    } catch {
      return;
    }
    if (visited.has(realDir)) return;
    visited.add(realDir);
    const relativePath = path3.relative(targetDir, dir).replace(/\\/g, "/") || ".";
    let detected = false;
    for (const marker of PROJECT_MARKERS) {
      const markerFile = marker.files.find((file) => fs2.existsSync(path3.join(dir, file)));
      if (!markerFile) continue;
      let lang = marker.lang;
      if (marker.refinements) {
        for (const refinement of marker.refinements) {
          if (refinement.files.some((file) => fs2.existsSync(path3.join(dir, file)))) {
            lang = refinement.lang;
            break;
          }
        }
      }
      if (markerFile === "package.json") {
        try {
          const pkgContent = JSON.parse(fs2.readFileSync(path3.join(dir, "package.json"), "utf-8"));
          const metadata = detectProjectMetadata(dir, lang, pkgContent);
          projects.push({
            name: pkgContent.name || path3.basename(dir),
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
          logger.warn(`\u89E3\u6790 package.json \u5931\u8D25: ${path3.join(dir, "package.json")}`);
        }
      } else {
        const metadata = detectProjectMetadata(dir, lang);
        projects.push({
          name: path3.basename(dir),
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
        const entries = fs2.readdirSync(dir);
        const hasCsproj = entries.some((entry) => entry.endsWith(".csproj") || entry.endsWith(".sln"));
        if (hasCsproj) {
          const metadata = detectProjectMetadata(dir, "dotnet");
          projects.push({
            name: path3.basename(dir),
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
        entries = fs2.readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.startsWith(".") || WORKSPACE_EXCLUDE_DIRS.has(entry)) continue;
        const childPath = path3.join(dir, entry);
        try {
          if (fs2.statSync(childPath).isDirectory()) {
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
var path4 = __toESM(require("path"));
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
  const baseName = path4.basename(workflowPath).replace(/\.workflow\.json$/i, "").replace(/\.json$/i, "");
  return baseName || "custom";
}
function asBuiltinWorkflowId(value) {
  if (value === "micro" || value === "sprint" || value === "default") {
    return value;
  }
  return null;
}
function getGeneratedAt2(value) {
  return value || (/* @__PURE__ */ new Date()).toISOString();
}
function getWorkflowRank(workflowId) {
  return workflowId ? BUILTIN_WORKFLOW_RANK[workflowId] : Number.POSITIVE_INFINITY;
}
function getWorkflowBaseDir(options) {
  return options?.workflowBaseDir || path4.join(".codebuddy", "workflows");
}
function normalizeWorkflowCatalog(options) {
  const baseDir = getWorkflowBaseDir(options);
  return {
    default: options?.catalog?.default || path4.join(baseDir, "default.workflow.json"),
    sprint: options?.catalog?.sprint || path4.join(baseDir, "sprint.workflow.json"),
    micro: options?.catalog?.micro || path4.join(baseDir, "micro.workflow.json")
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
    generatedAt: getGeneratedAt2(params.generatedAt)
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
function buildSignal2(id, matched, detail, weight) {
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
    buildSignal2("has_requirement_or_prd", input.hasRequirementOrPrdTasks, input.hasRequirementOrPrdTasks ? "TaskBook \u5305\u542B requirement/prd \u4EFB\u52A1" : void 0, 5),
    buildSignal2("has_design_tasks", input.hasDesignTasks, input.hasDesignTasks ? "TaskBook \u5305\u542B design \u4EFB\u52A1" : void 0, 4),
    buildSignal2("has_build_fix_tasks", input.hasBuildFixTasks, input.hasBuildFixTasks ? "TaskBook \u5305\u542B\u72EC\u7ACB build-fix \u4EFB\u52A1" : void 0, 4),
    buildSignal2("large_task_count", input.taskCount > 8, `taskCount=${input.taskCount}`, 4),
    buildSignal2("deep_dependency_graph", input.maxDependencyDepth > 4, `maxDependencyDepth=${input.maxDependencyDepth}`, 3),
    buildSignal2("cross_project_scope", hasCrossProjectScope, `selectedProjectCount=${input.selectedProjectCount}`, 5),
    buildSignal2("wide_module_scope", input.scopedModuleCount > 2, `scopedModuleCount=${input.scopedModuleCount}`, 3),
    buildSignal2("hotfix_signal", hasHotfixSignal, hasHotfixSignal ? "routeHints \u547D\u4E2D hotfix/quick-fix \u4FE1\u53F7" : void 0, 2),
    buildSignal2("small_scope", smallScope, `scopedFileCount=${input.scopedFileCount}, scopedModuleCount=${input.scopedModuleCount}`, 2),
    buildSignal2("has_review_tasks", input.hasReviewTasks, input.hasReviewTasks ? "TaskBook \u5305\u542B review \u4EFB\u52A1" : void 0, 2),
    buildSignal2("has_high_priority_tasks", input.hasHighPriorityTasks, input.hasHighPriorityTasks ? "\u5B58\u5728 critical/high \u4EFB\u52A1" : void 0, 2),
    buildSignal2("large_scope_signal", hasLargeScopeSignal, hasLargeScopeSignal ? "routeHints \u547D\u4E2D feature/refactor/architecture \u4FE1\u53F7" : void 0, 2)
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
function buildWorkflowCatalog(workflowBaseDir = path4.join(".codebuddy", "workflows")) {
  return {
    default: path4.join(workflowBaseDir, "default.workflow.json"),
    sprint: path4.join(workflowBaseDir, "sprint.workflow.json"),
    micro: path4.join(workflowBaseDir, "micro.workflow.json")
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
function ensureDir(dirPath) {
  if (!fs3.existsSync(dirPath)) {
    fs3.mkdirSync(dirPath, { recursive: true });
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
  if (!fs3.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs3.readFileSync(filePath, "utf-8"));
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
  return path5.join(
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
    ensureDir(path5.dirname(reportPath));
    fs3.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}
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
    const availableWorkflowIds = Object.entries(catalog).filter(([, workflowRelativePath]) => fs3.existsSync(path5.join(params.projectRoot, workflowRelativePath))).map(([workflowId]) => workflowId);
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

// scripts/src/task-orchestrator.ts
function parseCli(argv) {
  const args = argv.slice();
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
  return { positionals, flags };
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
function toPosixPath2(value) {
  return value.replace(/\\/g, "/");
}
function computePlannerRequestId(taskBookId) {
  const hash = (0, import_crypto.createHash)("sha1").update(taskBookId).digest("hex").slice(0, 10);
  return `req-planner-${hash}`;
}
function inferBuiltinWorkflowIdFromPath(workflowPath) {
  if (!workflowPath || !workflowPath.trim()) return null;
  const normalized = workflowPath.trim().toLowerCase();
  if (normalized === "micro" || normalized.endsWith("/micro.workflow.json") || normalized.endsWith("\\micro.workflow.json")) {
    return "micro";
  }
  if (normalized === "sprint" || normalized.endsWith("/sprint.workflow.json") || normalized.endsWith("\\sprint.workflow.json")) {
    return "sprint";
  }
  if (normalized === "default" || normalized.endsWith("/default.workflow.json") || normalized.endsWith("\\default.workflow.json")) {
    return "default";
  }
  return null;
}
function specModeForWorkflow(workflowId) {
  return workflowId === "default" ? "linked-spec-kit" : "inline-open-spec";
}
function mapTaskTypeToTaskIntakeKind(taskType) {
  switch (taskType) {
    case "debugging":
      return "bugfix";
    case "refactoring":
      return "refactor";
    case "code-review":
      return "review";
    case "new-feature":
      return "feature";
    case "testing":
      return "analysis";
    default:
      return null;
  }
}
function buildTaskIntakeDecision(params) {
  const explicitWorkflowId = inferBuiltinWorkflowIdFromPath(params.explicitWorkflowPath);
  const decision = routeTaskIntake(createDefaultTaskIntakeInput({
    title: params.title ?? null,
    description: params.description ?? null,
    kind: normalizeTaskIntakeKind(mapTaskTypeToTaskIntakeKind(params.type))
  }));
  if (!explicitWorkflowId) {
    return decision;
  }
  return {
    ...decision,
    recommendedWorkflowId: explicitWorkflowId,
    recommendedSpecMode: specModeForWorkflow(explicitWorkflowId),
    reasons: [
      `Workflow explicitly requested by caller: ${explicitWorkflowId}.`,
      ...decision.reasons
    ]
  };
}
function buildPlannerHintArgs(taskBook, routingDecision) {
  const workflowId = taskBook?.plan?.recommendedWorkflowId ?? routingDecision?.recommendedWorkflowId;
  const specMode = taskBook?.plan?.specMode ?? routingDecision?.recommendedSpecMode;
  const documentationTier = taskBook?.plan?.documentationTier ?? routingDecision?.documentationTier;
  const documentationArtifacts = taskBook?.plan?.documentationArtifacts ?? routingDecision?.documentationArtifacts;
  const args = [];
  if (workflowId) args.push("--workflow-hint", workflowId);
  if (specMode) args.push("--spec-mode", specMode);
  if (documentationTier) args.push("--doc-tier", documentationTier);
  for (const artifact of documentationArtifacts ?? []) {
    args.push("--doc-artifact", artifact);
  }
  return args;
}
function shouldPreserveWorkflowPath(workflowPath) {
  return Boolean(workflowPath && workflowPath.trim() && workflowPath.trim().toLowerCase() !== "auto");
}
function quoteCommandArg(value) {
  return /^[A-Za-z0-9._:/\\=-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;
}
function buildNextCommand(params) {
  const parts = [
    "node",
    ".codebuddy/scripts/task-orchestrator.js",
    "--taskbook",
    params.taskBookId
  ];
  if (params.tasksOnly) parts.push("--tasks-only");
  if (shouldPreserveWorkflowPath(params.workflowPath)) {
    parts.push("--workflow", params.workflowPath.trim());
  }
  if (params.showWorkflowRoute) parts.push("--show-workflow-route");
  for (const gateId of params.approve ?? []) {
    parts.push("--approve", gateId);
  }
  return parts.map(quoteCommandArg).join(" ");
}
function printWorkflowRoute(details, showReasons) {
  console.log(
    `[Orchestrator] workflow route: ${details.workflowId} (${details.mode}, confidence=${details.confidence}) -> ${details.workflowPath}`
  );
  console.log(`[Orchestrator] workflow route report: ${details.reportPath}`);
  if (!showReasons) return;
  for (const reason of details.reasons) {
    console.log(`  - ${reason}`);
  }
  if (details.fallbackReason) {
    console.log(`  fallback: ${details.fallbackReason}`);
  }
}
function resolveWorkflowSelection(params) {
  return selectWorkflowForTaskBook(params);
}
function runNodeScript(scriptPath, args, opts) {
  const res = (0, import_child_process.spawnSync)(process.execPath, [scriptPath, ...args], {
    cwd: opts.cwd,
    encoding: "utf-8",
    stdio: opts.capture ? "pipe" : "inherit"
  });
  return {
    status: res.status,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? ""
  };
}
var SLEEP_INT32 = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
  Atomics.wait(SLEEP_INT32, 0, 0, ms);
}
function parseJsonOrThrow(text, hint) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${hint}: JSON \u89E3\u6790\u5931\u8D25: ${msg}`);
  }
}
function taskbookManagerPath(projectRoot) {
  return path6.join(projectRoot, ".codebuddy", "scripts", "taskbook-manager.js");
}
function taskExecutorPath(projectRoot) {
  return path6.join(projectRoot, ".codebuddy", "scripts", "task-executor.js");
}
function structureAnalyzerPath(projectRoot) {
  return path6.join(projectRoot, ".codebuddy", "scripts", "structure-analyzer.js");
}
function moduleMapperPath(projectRoot) {
  return path6.join(projectRoot, ".codebuddy", "scripts", "module-mapper.js");
}
function runTaskbookManagerJson(projectRoot, args, capture) {
  const script = taskbookManagerPath(projectRoot);
  if (!fs4.existsSync(script)) {
    throw new Error(`\u7F3A\u5C11\u811A\u672C: ${toPosixPath2(path6.relative(projectRoot, script))}\uFF08\u8BF7\u5148\u8FD0\u884C codebuddy-loader\uFF09`);
  }
  const res = runNodeScript(script, [...args, "--json"], { cwd: projectRoot, capture });
  if (res.status !== 0) {
    throw new Error(`taskbook-manager failed (exit=${res.status}): ${res.stderr || res.stdout}`);
  }
  return parseJsonOrThrow(res.stdout, "taskbook-manager --json \u8F93\u51FA");
}
function loadTaskBook(projectRoot, taskBookId) {
  const tb = runTaskbookManagerJson(projectRoot, ["show", taskBookId], true);
  return tb;
}
function loadRevision(projectRoot, taskBookId) {
  const tb = loadTaskBook(projectRoot, taskBookId);
  const rev = typeof tb.revision === "number" ? tb.revision : 0;
  return rev;
}
function listBlockedAgentCalls(taskBook) {
  const tasks = Array.isArray(taskBook.tasks) ? taskBook.tasks : [];
  const blocked = tasks.filter((t) => t && t.status === "blocked" && typeof t.blockedReason === "string" && t.blockedReason.includes("[agent-call]"));
  const results = [];
  for (const t of blocked) {
    const lines = String(t.blockedReason).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const metaLine = lines.find((l) => l.startsWith("[agent-call]"));
    if (!metaLine) continue;
    const jsonText = metaLine.slice("[agent-call]".length).trim();
    try {
      const meta = JSON.parse(jsonText);
      results.push({ taskId: t.id, title: t.title, meta });
    } catch {
      results.push({ taskId: t.id, title: t.title, meta: { parseError: true, raw: jsonText.slice(0, 2e3) } });
    }
  }
  return results;
}
function showHelp() {
  console.log(`
Task Orchestrator - \u4E00\u952E\u95ED\u73AF\u6267\u884C\u5668\uFF08MVP\uFF09

\u7528\u6CD5:
  node .codebuddy/scripts/task-orchestrator.js "<\u9700\u6C42\u63CF\u8FF0>"
  node .codebuddy/scripts/task-orchestrator.js --title "<title>" --description "<desc>" [--type <type>]
  node .codebuddy/scripts/task-orchestrator.js --taskbook <taskBookId>     # \u7EE7\u7EED\u6267\u884C

\u4EA7\u54C1\u8DEF\u5F84:
  1. \u542F\u52A8\u95ED\u73AF           \u7528\u4E00\u53E5\u9700\u6C42\u6216 title/description \u542F\u52A8
  2. \u63A5\u7BA1 / \u7EE7\u7EED\u6267\u884C     \u7528 --taskbook <id> \u63A5\u7740\u63A8\u8FDB\u5DF2\u6709 TaskBook
  3. \u67E5\u770B\u81EA\u52A8\u9009\u8DEF        \u52A0 --show-workflow-route \u8F93\u51FA workflow \u8DEF\u7531\u7406\u7531

\u5E38\u7528\u9009\u9879:
  --type <new-feature|refactoring|debugging|testing|code-review>  \uFF08\u9ED8\u8BA4 new-feature\uFF09
  --taskbook <id>          \u7EE7\u7EED\u67D0\u4E2A TaskBook
  --no-auto-confirm        \u4E0D\u81EA\u52A8 confirm\uFF08\u4EC5\u751F\u6210/\u5E94\u7528\u8BA1\u5212\uFF09
  --stop-after-plan        \u5E94\u7528 plan \u540E\u505C\u6B62\uFF08\u4E0D\u6267\u884C task-executor\uFF09
  --tasks-only             \u4EC5\u6267\u884C\u4EFB\u52A1\uFF08\u8DF3\u8FC7 workflow gates\uFF09
  --workflow <path|auto>   \u6307\u5B9A workflow\uFF1B\u7701\u7565\u6216 auto \u65F6\u81EA\u52A8\u9009\u8DEF
  --show-workflow-route    \u8F93\u51FA workflow \u8DEF\u7531\u7406\u7531
  --approve <gateId>       \u9884\u5148\u6279\u51C6 gate\uFF08\u53EF\u91CD\u590D\uFF1B\u4F8B\u5982 review_passed\uFF09
  --max-parallel <n>       \u8986\u76D6\u5E76\u884C\u5EA6\uFF08\u900F\u4F20\u7ED9 task-executor\uFF09
  --watch                 \u81EA\u52A8\u7B49\u5F85 result.json \u5E76\u7EE7\u7EED\uFF08\u76F4\u5230\u5B8C\u6210\u6216\u4E0D\u53EF\u81EA\u52A8\u63A8\u8FDB\uFF09
  --watch-poll-ms <n>      watch: \u8F6E\u8BE2\u95F4\u9694\uFF08\u9ED8\u8BA4 1500\uFF09
  --watch-timeout-ms <n>   watch: \u8D85\u65F6\uFF08\u9ED8\u8BA4 0=\u4E0D\u8D85\u65F6\uFF09
  --json                   \u8F93\u51FA JSON\uFF08\u4FBF\u4E8E\u811A\u672C/\u6D4B\u8BD5\u6D88\u8D39\uFF09

\u884C\u4E3A:
  - \u82E5\u5C1A\u672A\u89C4\u5212\u4EFB\u52A1\uFF1A\u751F\u6210 planner prompt \u5230 .codebuddy/agent-calls/ \u5E76\u7B49\u5F85 result.json
  - \u82E5\u9047\u5230 MANUAL_REQUIRED\uFF1Atask-executor \u4F1A\u81EA\u52A8\u751F\u6210 agent-call prompt\uFF1B\u5199\u56DE result.json \u540E\u91CD\u8DD1\u672C\u547D\u4EE4\u7EE7\u7EED
  - \u8FD9\u662F\u201C\u542F\u52A8\u95ED\u73AF\u201D\u7684\u4E3B\u5165\u53E3\uFF1B\u8BCA\u65AD\u548C\u62A5\u544A\u4F18\u5148\u8D70 codebuddy-loader / report-manager
`);
}
function emitOutcome(outcome, json) {
  if (json) {
    console.log(JSON.stringify(outcome, null, 2));
    return;
  }
  const details = "details" in outcome ? outcome.details ?? {} : {};
  const workflowRoute = details.workflowRoute;
  const showWorkflowRoute = details.showWorkflowRoute === true;
  if (outcome.status === "completed") {
    console.log(`[Orchestrator] \u5DF2\u5B8C\u6210: ${outcome.taskBookId}`);
    if (workflowRoute) printWorkflowRoute(workflowRoute, showWorkflowRoute);
    return;
  }
  if (outcome.status === "error") {
    console.error(outcome.message);
    if (workflowRoute) printWorkflowRoute(workflowRoute, showWorkflowRoute);
    return;
  }
  if (outcome.reason === "planner_result_missing") {
    if (details.promptPath) console.log(`[Orchestrator] \u5DF2\u751F\u6210 planner prompt: ${details.promptPath}`);
    if (details.resultPath) console.log(`[Orchestrator] \u7B49\u5F85\u5199\u56DE result.json: ${details.resultPath}`);
    if (details.next) {
      console.log("[Orchestrator] \u5199\u56DE\u540E\u91CD\u8DD1\u7EE7\u7EED\uFF1A");
      console.log(`  ${details.next}`);
    }
    return;
  }
  console.log(`
[Orchestrator] \u672A\u5B8C\u6210: ${outcome.taskBookId}`);
  if (workflowRoute) printWorkflowRoute(workflowRoute, showWorkflowRoute);
  const blockedTasks = Array.isArray(details.blockedTasks) ? details.blockedTasks : [];
  if (blockedTasks.length > 0) {
    console.log("[Orchestrator] \u53D1\u73B0\u5F85\u5904\u7406\u7684 agent-call\uFF1A");
    for (const t of blockedTasks) {
      const taskId = t && typeof t.taskId === "string" ? t.taskId : "?";
      const title = t && typeof t.title === "string" ? t.title : "";
      const meta = t && typeof t.meta !== "undefined" ? t.meta : null;
      console.log(`- ${taskId} ${title}`);
      console.log(`  meta: ${JSON.stringify(meta)}`);
    }
  } else if (details.hint) {
    console.log(`[Orchestrator] ${details.hint}`);
  }
  if (details.next) {
    console.log("[Orchestrator] \u5904\u7406\u540E\u91CD\u8DD1\uFF1A");
    console.log(`  ${details.next}`);
  }
}
function extractWaitForFiles(outcome, projectRoot) {
  if (outcome.status !== "blocked") return [];
  const details = outcome.details ?? {};
  if (outcome.reason === "planner_result_missing") {
    const p = details.resultPath;
    if (typeof p === "string" && p) return [path6.isAbsolute(p) ? p : path6.join(projectRoot, p)];
    return [];
  }
  const blockedTasks = Array.isArray(details.blockedTasks) ? details.blockedTasks : [];
  const paths = [];
  for (const t of blockedTasks) {
    if (!t || typeof t !== "object") continue;
    const meta = t.meta;
    if (!meta || typeof meta !== "object") continue;
    const resultPath = meta.resultPath;
    if (typeof resultPath === "string" && resultPath) {
      paths.push(path6.isAbsolute(resultPath) ? resultPath : path6.join(projectRoot, resultPath));
    }
  }
  return paths;
}
function runOnce(params, emit) {
  const projectRoot = params.projectRoot;
  const json = params.json;
  const noAutoConfirm = params.noAutoConfirm;
  const stopAfterPlan = params.stopAfterPlan;
  const tasksOnly = params.tasksOnly;
  const workflowPath = params.workflowPath;
  const showWorkflowRoute = params.showWorkflowRoute;
  const approve = params.approve;
  const maxParallel = params.maxParallel;
  let taskBookId = params.taskBookId;
  let outcome = null;
  let waitForFiles = [];
  let workflowRouteDetails;
  let intakeDecision = null;
  try {
    const tmPath = taskbookManagerPath(projectRoot);
    if (!fs4.existsSync(tmPath)) {
      throw new Error(`\u7F3A\u5C11\u811A\u672C: ${toPosixPath2(path6.relative(projectRoot, tmPath))}\uFF08\u8BF7\u5148\u8FD0\u884C codebuddy-loader\uFF09`);
    }
    const tePath = taskExecutorPath(projectRoot);
    if (!fs4.existsSync(tePath)) {
      throw new Error(`\u7F3A\u5C11\u811A\u672C: ${toPosixPath2(path6.relative(projectRoot, tePath))}\uFF08\u8BF7\u5148\u8FD0\u884C codebuddy-loader\uFF09`);
    }
    if (!taskBookId) {
      if (!params.title || !params.description) {
        throw new Error('\u9519\u8BEF: \u7F3A\u5C11\u8F93\u5165\u3002\u8BF7\u63D0\u4F9B "<\u9700\u6C42\u63CF\u8FF0>" \u6216 --title/--description\uFF0C\u6216\u4F7F\u7528 --taskbook \u7EE7\u7EED\u3002');
      }
      intakeDecision = buildTaskIntakeDecision({
        title: params.title,
        description: params.description,
        type: params.type,
        explicitWorkflowPath: workflowPath
      });
      const created = runTaskbookManagerJson(projectRoot, [
        "create",
        "--title",
        params.title,
        "--description",
        params.description,
        "--type",
        params.type,
        ...buildPlannerHintArgs(null, intakeDecision)
      ], true);
      taskBookId = created.id;
      if (!taskBookId) throw new Error("create \u672A\u8FD4\u56DE TaskBook.id");
    }
    const tb0 = loadTaskBook(projectRoot, taskBookId);
    const tasks0 = Array.isArray(tb0.tasks) ? tb0.tasks : [];
    if (tasks0.length === 0) {
      const reports = [
        path6.join(projectRoot, ".codebuddy", "reports", "architecture", "latest.json"),
        path6.join(projectRoot, ".codebuddy", "reports", "modules", "latest.json")
      ];
      const needReports = reports.some((p) => !fs4.existsSync(p));
      if (needReports) {
        const analyzer = structureAnalyzerPath(projectRoot);
        const mapper = moduleMapperPath(projectRoot);
        if (fs4.existsSync(mapper)) {
          runNodeScript(mapper, [".", "--mode", "summary", "--output", "json"], { cwd: projectRoot, capture: json });
        }
        if (fs4.existsSync(analyzer)) {
          runNodeScript(analyzer, [".", "--mode", "summary", "--output", "json"], { cwd: projectRoot, capture: json });
        }
      }
      const requestId = computePlannerRequestId(taskBookId);
      if (!tb0.plan?.recommendedWorkflowId || !tb0.plan?.specMode) {
        intakeDecision = buildTaskIntakeDecision({
          title: tb0.title,
          description: tb0.description,
          type: tb0.taskType,
          explicitWorkflowPath: workflowPath
        });
      }
      const plan = runTaskbookManagerJson(projectRoot, [
        "plan",
        taskBookId,
        "--request-id",
        requestId,
        ...buildPlannerHintArgs(tb0, intakeDecision)
      ], true);
      const resultAbsPath = path6.isAbsolute(plan.resultPath) ? plan.resultPath : path6.join(projectRoot, plan.resultPath);
      if (!fs4.existsSync(resultAbsPath)) {
        outcome = {
          status: "blocked",
          reason: "planner_result_missing",
          taskBookId,
          details: {
            requestId: plan.requestId,
            promptPath: toPosixPath2(plan.promptPath),
            resultPath: toPosixPath2(plan.resultPath),
            next: buildNextCommand({ taskBookId, showWorkflowRoute })
          }
        };
        waitForFiles = [resultAbsPath];
        if (emit) emitOutcome(outcome, json);
        return { exitCode: 2, taskBookId, outcome, waitForFiles };
      }
      const rev = loadRevision(projectRoot, taskBookId);
      runTaskbookManagerJson(projectRoot, ["apply-plan", taskBookId, plan.requestId, "--if-rev", String(rev)], true);
    }
    const tb1 = loadTaskBook(projectRoot, taskBookId);
    if (!noAutoConfirm && tb1.status === "draft") {
      const rev = loadRevision(projectRoot, taskBookId);
      runTaskbookManagerJson(projectRoot, ["confirm", taskBookId, "--if-rev", String(rev)], true);
    }
    if (stopAfterPlan) {
      outcome = { status: "completed", taskBookId };
      if (emit) emitOutcome(outcome, json);
      return { exitCode: 0, taskBookId, outcome, waitForFiles: [] };
    }
    const executorArgs = [];
    if (tasksOnly) executorArgs.push("--tasks-only");
    if (!tasksOnly) {
      const workflowSelection = resolveWorkflowSelection({
        projectRoot,
        taskBook: tb1,
        explicitWorkflowPath: workflowPath
      });
      workflowRouteDetails = workflowSelection.details;
      recordWorkflowRoutingMetric({
        projectRoot,
        taskBook: tb1,
        decision: workflowSelection.decision
      });
      executorArgs.push("--workflow", workflowSelection.workflowPath);
    } else if (workflowPath) {
      executorArgs.push("--workflow", workflowPath);
    }
    for (const gateId of approve) executorArgs.push("--approve", gateId);
    if (maxParallel) executorArgs.push("--max-parallel", maxParallel);
    const te = taskExecutorPath(projectRoot);
    const execRes = runNodeScript(te, [taskBookId, ...executorArgs], { cwd: projectRoot, capture: json });
    if (execRes.status === 0) {
      outcome = {
        status: "completed",
        taskBookId,
        details: workflowRouteDetails ? {
          workflowRoute: workflowRouteDetails,
          showWorkflowRoute
        } : void 0
      };
      if (emit) emitOutcome(outcome, json);
      return { exitCode: 0, taskBookId, outcome, waitForFiles: [] };
    }
    const tb2 = loadTaskBook(projectRoot, taskBookId);
    const calls = listBlockedAgentCalls(tb2);
    outcome = {
      status: "blocked",
      reason: "workflow_not_completed",
      taskBookId,
      details: {
        blockedTasks: calls.map((c) => ({ taskId: c.taskId, title: c.title, meta: c.meta })),
        hint: calls.length > 0 ? "\u8BF7\u6309 prompt \u6267\u884C\u5E76\u5199\u56DE result.json\uFF0C\u7136\u540E\u91CD\u8DD1\u672C\u547D\u4EE4\u3002" : "\u53EF\u80FD\u5B58\u5728 gate \u672A\u901A\u8FC7\u6216\u9700\u8981 --approve <gateId>\uFF08\u4F8B\u5982 review_passed\uFF09\u3002",
        next: buildNextCommand({
          taskBookId,
          tasksOnly,
          approve,
          workflowPath,
          showWorkflowRoute
        }),
        ...workflowRouteDetails ? { workflowRoute: workflowRouteDetails, showWorkflowRoute } : {}
      }
    };
    waitForFiles = extractWaitForFiles(outcome, projectRoot);
    const exitCode = execRes.status === 2 ? 2 : 1;
    if (emit) emitOutcome(outcome, json);
    return { exitCode, taskBookId, outcome, waitForFiles };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    outcome = {
      status: "error",
      message,
      details: workflowRouteDetails ? {
        workflowRoute: workflowRouteDetails,
        showWorkflowRoute
      } : void 0
    };
    if (emit) emitOutcome(outcome, json);
    return { exitCode: 1, taskBookId: taskBookId ?? "", outcome, waitForFiles: [] };
  }
}
function waitForAnyFile(filePaths, pollMs, timeoutMs) {
  const startedAt = Date.now();
  const unique = Array.from(new Set(filePaths));
  while (true) {
    for (const p of unique) {
      if (fs4.existsSync(p)) {
        return { ok: true, waitedMs: Date.now() - startedAt, hit: p };
      }
    }
    const elapsed = Date.now() - startedAt;
    if (timeoutMs > 0 && elapsed >= timeoutMs) {
      return { ok: false, waitedMs: elapsed };
    }
    sleepSync(Math.max(50, pollMs));
  }
}
function main() {
  const parsed = parseCli(process.argv.slice(2));
  const json = flagAsBool(parsed.flags, "json");
  if (flagAsBool(parsed.flags, "help") || flagAsBool(parsed.flags, "h") || flagAsBool(parsed.flags, "-h")) {
    showHelp();
    process.exit(0);
  }
  const watch = flagAsBool(parsed.flags, "watch");
  const watchPollMs = Number.parseInt(flagAsString(parsed.flags, "watch-poll-ms") ?? "1500", 10);
  const watchTimeoutMs = Number.parseInt(flagAsString(parsed.flags, "watch-timeout-ms") ?? "0", 10);
  const projectRoot = process.cwd();
  const noAutoConfirm = flagAsBool(parsed.flags, "no-auto-confirm");
  const stopAfterPlan = flagAsBool(parsed.flags, "stop-after-plan");
  const tasksOnly = flagAsBool(parsed.flags, "tasks-only");
  const workflowPath = flagAsString(parsed.flags, "workflow");
  const showWorkflowRoute = flagAsBool(parsed.flags, "show-workflow-route");
  const approve = flagAsStringArray(parsed.flags, "approve");
  const maxParallel = flagAsString(parsed.flags, "max-parallel");
  let taskBookId = flagAsString(parsed.flags, "taskbook") ?? flagAsString(parsed.flags, "taskbook-id");
  const requestText = parsed.positionals.join(" ").trim();
  const type = (flagAsString(parsed.flags, "type") ?? "new-feature").trim();
  const titleFromFlag = flagAsString(parsed.flags, "title");
  const descFromFlag = flagAsString(parsed.flags, "description");
  const title = titleFromFlag ?? (requestText ? requestText.slice(0, 40) : void 0);
  const description = descFromFlag ?? (requestText ? requestText : void 0);
  if (!watch) {
    const r = runOnce({
      projectRoot,
      json,
      noAutoConfirm,
      stopAfterPlan,
      tasksOnly,
      workflowPath,
      showWorkflowRoute,
      approve,
      maxParallel,
      taskBookId,
      type,
      title,
      description
    }, true);
    process.exit(r.exitCode);
  }
  const startedAt = Date.now();
  let iteration = 0;
  let last = null;
  while (true) {
    iteration += 1;
    const r = runOnce({
      projectRoot,
      json,
      noAutoConfirm,
      stopAfterPlan,
      tasksOnly,
      workflowPath,
      showWorkflowRoute,
      approve,
      maxParallel,
      taskBookId,
      type,
      title,
      description
    }, false);
    taskBookId = r.taskBookId;
    last = r;
    if (r.exitCode !== 2) {
      emitOutcome(r.outcome, json);
      process.exit(r.exitCode);
    }
    const missing = r.waitForFiles.filter((p) => !fs4.existsSync(p));
    if (r.waitForFiles.length === 0) {
      emitOutcome(r.outcome, json);
      process.exit(2);
    }
    if (missing.length === 0) {
      continue;
    }
    if (iteration === 1) {
      if (!json) {
        emitOutcome(r.outcome, false);
      } else if (r.outcome.status === "blocked") {
        const details = r.outcome.details ?? {};
        if (r.outcome.reason === "planner_result_missing") {
          if (details.promptPath) console.error(`[Orchestrator/watch] planner prompt: ${details.promptPath}`);
          if (details.resultPath) console.error(`[Orchestrator/watch] planner result: ${details.resultPath}`);
        } else {
          console.error(`[Orchestrator/watch] blocked: ${r.outcome.reason} taskBookId=${r.outcome.taskBookId}`);
        }
      }
    }
    const elapsedTotal = Date.now() - startedAt;
    const remaining = watchTimeoutMs > 0 ? Math.max(0, watchTimeoutMs - elapsedTotal) : 0;
    if (watchTimeoutMs > 0 && remaining === 0) {
      const outcome = {
        status: "blocked",
        reason: "watch_timeout",
        taskBookId: r.taskBookId,
        details: {
          waitedMs: elapsedTotal,
          missingFiles: missing.map(toPosixPath2),
          next: buildNextCommand({
            taskBookId: r.taskBookId,
            tasksOnly,
            approve,
            workflowPath,
            showWorkflowRoute
          })
        }
      };
      emitOutcome(outcome, json);
      process.exit(2);
    }
    console.error(`[Orchestrator/watch] waiting (${missing.length})...`);
    const waitRes = waitForAnyFile(missing, watchPollMs, remaining);
    if (!waitRes.ok) {
      const outcome = {
        status: "blocked",
        reason: "watch_timeout",
        taskBookId: r.taskBookId,
        details: {
          waitedMs: elapsedTotal + waitRes.waitedMs,
          missingFiles: missing.map(toPosixPath2),
          next: buildNextCommand({
            taskBookId: r.taskBookId,
            tasksOnly,
            approve,
            workflowPath,
            showWorkflowRoute
          })
        }
      };
      emitOutcome(outcome, json);
      process.exit(2);
    }
    if (waitRes.hit) {
      console.error(`[Orchestrator/watch] detected: ${toPosixPath2(waitRes.hit)}`);
    }
  }
}
if (isDirectCliEntry("task-orchestrator.js")) {
  main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  resolveWorkflowSelection,
  runOrchestratorOnce,
  workflowRoutingReportPath
});
