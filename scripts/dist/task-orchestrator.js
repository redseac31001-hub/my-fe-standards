#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// scripts/src/task-orchestrator.ts
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));
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
function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}
function computePlannerRequestId(taskBookId) {
  const hash = (0, import_crypto.createHash)("sha1").update(taskBookId).digest("hex").slice(0, 10);
  return `req-planner-${hash}`;
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
  return path2.join(projectRoot, ".codebuddy", "scripts", "taskbook-manager.js");
}
function taskExecutorPath(projectRoot) {
  return path2.join(projectRoot, ".codebuddy", "scripts", "task-executor.js");
}
function structureAnalyzerPath(projectRoot) {
  return path2.join(projectRoot, ".codebuddy", "scripts", "structure-analyzer.js");
}
function moduleMapperPath(projectRoot) {
  return path2.join(projectRoot, ".codebuddy", "scripts", "module-mapper.js");
}
function runTaskbookManagerJson(projectRoot, args, capture) {
  const script = taskbookManagerPath(projectRoot);
  if (!fs.existsSync(script)) {
    throw new Error(`\u7F3A\u5C11\u811A\u672C: ${toPosixPath(path2.relative(projectRoot, script))}\uFF08\u8BF7\u5148\u8FD0\u884C codebuddy-loader\uFF09`);
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

\u5E38\u7528\u9009\u9879:
  --type <new-feature|refactoring|debugging|testing|code-review>  \uFF08\u9ED8\u8BA4 new-feature\uFF09
  --taskbook <id>          \u7EE7\u7EED\u67D0\u4E2A TaskBook
  --no-auto-confirm        \u4E0D\u81EA\u52A8 confirm\uFF08\u4EC5\u751F\u6210/\u5E94\u7528\u8BA1\u5212\uFF09
  --stop-after-plan        \u5E94\u7528 plan \u540E\u505C\u6B62\uFF08\u4E0D\u6267\u884C task-executor\uFF09
  --tasks-only             \u4EC5\u6267\u884C\u4EFB\u52A1\uFF08\u8DF3\u8FC7 workflow gates\uFF09
  --workflow <path>        \u6307\u5B9A workflow\uFF08\u9ED8\u8BA4 .codebuddy/workflows/default.workflow.json\uFF09
  --approve <gateId>       \u9884\u5148\u6279\u51C6 gate\uFF08\u53EF\u91CD\u590D\uFF1B\u4F8B\u5982 review_passed\uFF09
  --max-parallel <n>       \u8986\u76D6\u5E76\u884C\u5EA6\uFF08\u900F\u4F20\u7ED9 task-executor\uFF09
  --watch                 \u81EA\u52A8\u7B49\u5F85 result.json \u5E76\u7EE7\u7EED\uFF08\u76F4\u5230\u5B8C\u6210\u6216\u4E0D\u53EF\u81EA\u52A8\u63A8\u8FDB\uFF09
  --watch-poll-ms <n>      watch: \u8F6E\u8BE2\u95F4\u9694\uFF08\u9ED8\u8BA4 1500\uFF09
  --watch-timeout-ms <n>   watch: \u8D85\u65F6\uFF08\u9ED8\u8BA4 0=\u4E0D\u8D85\u65F6\uFF09
  --json                   \u8F93\u51FA JSON\uFF08\u4FBF\u4E8E\u811A\u672C/\u6D4B\u8BD5\u6D88\u8D39\uFF09

\u884C\u4E3A:
  - \u82E5\u5C1A\u672A\u89C4\u5212\u4EFB\u52A1\uFF1A\u751F\u6210 planner prompt \u5230 .codebuddy/agent-calls/ \u5E76\u7B49\u5F85 result.json
  - \u82E5\u9047\u5230 MANUAL_REQUIRED\uFF1Atask-executor \u4F1A\u81EA\u52A8\u751F\u6210 agent-call prompt\uFF1B\u5199\u56DE result.json \u540E\u91CD\u8DD1\u672C\u547D\u4EE4\u7EE7\u7EED
`);
}
function emitOutcome(outcome, json) {
  if (json) {
    console.log(JSON.stringify(outcome, null, 2));
    return;
  }
  if (outcome.status === "completed") {
    console.log(`[Orchestrator] \u5DF2\u5B8C\u6210: ${outcome.taskBookId}`);
    return;
  }
  if (outcome.status === "error") {
    console.error(outcome.message);
    return;
  }
  const details = outcome.details ?? {};
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
    if (typeof p === "string" && p) return [path2.isAbsolute(p) ? p : path2.join(projectRoot, p)];
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
      paths.push(path2.isAbsolute(resultPath) ? resultPath : path2.join(projectRoot, resultPath));
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
  const approve = params.approve;
  const maxParallel = params.maxParallel;
  let taskBookId = params.taskBookId;
  let outcome = null;
  let waitForFiles = [];
  try {
    const tmPath = taskbookManagerPath(projectRoot);
    if (!fs.existsSync(tmPath)) {
      throw new Error(`\u7F3A\u5C11\u811A\u672C: ${toPosixPath(path2.relative(projectRoot, tmPath))}\uFF08\u8BF7\u5148\u8FD0\u884C codebuddy-loader\uFF09`);
    }
    const tePath = taskExecutorPath(projectRoot);
    if (!fs.existsSync(tePath)) {
      throw new Error(`\u7F3A\u5C11\u811A\u672C: ${toPosixPath(path2.relative(projectRoot, tePath))}\uFF08\u8BF7\u5148\u8FD0\u884C codebuddy-loader\uFF09`);
    }
    if (!taskBookId) {
      if (!params.title || !params.description) {
        throw new Error('\u9519\u8BEF: \u7F3A\u5C11\u8F93\u5165\u3002\u8BF7\u63D0\u4F9B "<\u9700\u6C42\u63CF\u8FF0>" \u6216 --title/--description\uFF0C\u6216\u4F7F\u7528 --taskbook \u7EE7\u7EED\u3002');
      }
      const created = runTaskbookManagerJson(projectRoot, [
        "create",
        "--title",
        params.title,
        "--description",
        params.description,
        "--type",
        params.type
      ], true);
      taskBookId = created.id;
      if (!taskBookId) throw new Error("create \u672A\u8FD4\u56DE TaskBook.id");
    }
    const tb0 = loadTaskBook(projectRoot, taskBookId);
    const tasks0 = Array.isArray(tb0.tasks) ? tb0.tasks : [];
    if (tasks0.length === 0) {
      const reports = [
        path2.join(projectRoot, ".codebuddy", "reports", "architecture", "latest.json"),
        path2.join(projectRoot, ".codebuddy", "reports", "modules", "latest.json")
      ];
      const needReports = reports.some((p) => !fs.existsSync(p));
      if (needReports) {
        const analyzer = structureAnalyzerPath(projectRoot);
        const mapper = moduleMapperPath(projectRoot);
        if (fs.existsSync(mapper)) {
          runNodeScript(mapper, [".", "--mode", "summary", "--output", "json"], { cwd: projectRoot, capture: json });
        }
        if (fs.existsSync(analyzer)) {
          runNodeScript(analyzer, [".", "--mode", "summary", "--output", "json"], { cwd: projectRoot, capture: json });
        }
      }
      const requestId = computePlannerRequestId(taskBookId);
      const plan = runTaskbookManagerJson(projectRoot, [
        "plan",
        taskBookId,
        "--request-id",
        requestId
      ], true);
      const resultAbsPath = path2.isAbsolute(plan.resultPath) ? plan.resultPath : path2.join(projectRoot, plan.resultPath);
      if (!fs.existsSync(resultAbsPath)) {
        outcome = {
          status: "blocked",
          reason: "planner_result_missing",
          taskBookId,
          details: {
            requestId: plan.requestId,
            promptPath: toPosixPath(plan.promptPath),
            resultPath: toPosixPath(plan.resultPath),
            next: `node .codebuddy/scripts/task-orchestrator.js --taskbook ${taskBookId}`
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
    if (workflowPath) executorArgs.push("--workflow", workflowPath);
    for (const gateId of approve) executorArgs.push("--approve", gateId);
    if (maxParallel) executorArgs.push("--max-parallel", maxParallel);
    const te = taskExecutorPath(projectRoot);
    const execRes = runNodeScript(te, [taskBookId, ...executorArgs], { cwd: projectRoot, capture: json });
    if (execRes.status === 0) {
      outcome = { status: "completed", taskBookId };
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
        next: `node .codebuddy/scripts/task-orchestrator.js --taskbook ${taskBookId}${tasksOnly ? " --tasks-only" : ""}${approve.map((a) => ` --approve ${a}`).join("")}`
      }
    };
    waitForFiles = extractWaitForFiles(outcome, projectRoot);
    const exitCode = execRes.status === 2 ? 2 : 1;
    if (emit) emitOutcome(outcome, json);
    return { exitCode, taskBookId, outcome, waitForFiles };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    outcome = { status: "error", message };
    if (emit) emitOutcome(outcome, json);
    return { exitCode: 1, taskBookId: taskBookId ?? "", outcome, waitForFiles: [] };
  }
}
function waitForAnyFile(filePaths, pollMs, timeoutMs) {
  const startedAt = Date.now();
  const unique = Array.from(new Set(filePaths));
  while (true) {
    for (const p of unique) {
      if (fs.existsSync(p)) {
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
    const missing = r.waitForFiles.filter((p) => !fs.existsSync(p));
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
          missingFiles: missing.map(toPosixPath),
          next: `node .codebuddy/scripts/task-orchestrator.js --taskbook ${r.taskBookId}`
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
          missingFiles: missing.map(toPosixPath),
          next: `node .codebuddy/scripts/task-orchestrator.js --taskbook ${r.taskBookId}`
        }
      };
      emitOutcome(outcome, json);
      process.exit(2);
    }
    if (waitRes.hit) {
      console.error(`[Orchestrator/watch] detected: ${toPosixPath(waitRes.hit)}`);
    }
  }
}
if (isDirectCliEntry("task-orchestrator.js")) {
  main();
}
