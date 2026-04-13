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

// scripts/src/agent-call-manager.ts
var fs = __toESM(require("fs"));
var http = __toESM(require("http"));
var path2 = __toESM(require("path"));
var import_child_process = require("child_process");

// scripts/src/lib/cli-entry.ts
var path = __toESM(require("path"));
function isDirectCliEntry(expectedFileNames) {
  const argvPath = process.argv[1];
  if (!argvPath) return false;
  const actual = path.basename(argvPath).toLowerCase();
  const expected = Array.isArray(expectedFileNames) ? expectedFileNames : [expectedFileNames];
  return expected.some((name) => actual === name.toLowerCase());
}

// scripts/src/agent-call-manager.ts
var AGENT_CALLS_DIR = path2.join(process.cwd(), ".codebuddy", "agent-calls");
var TASKBOOKS_ACTIVE_DIR = path2.join(process.cwd(), ".codebuddy", "taskbooks", "active");
var TASKBOOKS_HISTORY_DIR = path2.join(process.cwd(), ".codebuddy", "taskbooks", "history");
var CODEBUDDY_SCRIPTS_DIR = path2.join(process.cwd(), ".codebuddy", "scripts");
var DEFAULT_HOST = "127.0.0.1";
var DEFAULT_PORT = 4317;
var MAX_BODY_BYTES = 2 * 1024 * 1024;
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
function isValidDateTime(value) {
  if (typeof value !== "string") return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}
function parseFirstJsonCodeBlock(markdown) {
  const m = markdown.match(/```json\s*([\s\S]*?)\s*```/);
  if (!m) return { ok: false, error: "Missing ```json ... ``` block in prompt.md" };
  return { ok: true, jsonText: m[1] };
}
function parsePromptHeader(markdown) {
  const block = parseFirstJsonCodeBlock(markdown);
  if (!block.ok) return block;
  try {
    const parsed = JSON.parse(block.jsonText);
    if (!isPlainObject(parsed)) return { ok: false, error: "prompt header JSON must be an object" };
    if (!isNonEmptyString(parsed.requestId)) return { ok: false, error: "prompt header JSON missing requestId" };
    return { ok: true, header: parsed };
  } catch (error) {
    return { ok: false, error: `Invalid prompt header JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}
function inferKind(promptMarkdown, header) {
  const firstLine = promptMarkdown.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (firstLine === "# Agent Call: planner" || header?.agentId === "planner") return "planner";
  if (firstLine === "# Agent Call: manual-task" || isNonEmptyString(header?.taskId)) return "manual-task";
  return "unknown";
}
function validatePlannerOutput(output) {
  const issues = [];
  const error = (message) => issues.push({ level: "error", message });
  const warn = (message) => issues.push({ level: "warning", message });
  if (!isPlainObject(output)) {
    error("output must be an object for planner");
    return issues;
  }
  const tasks = output.tasks;
  if (!Array.isArray(tasks)) {
    error("planner output.tasks must be an array");
    return issues;
  }
  if (tasks.length === 0) {
    warn("planner output.tasks is empty");
    return issues;
  }
  const allowedTypes = /* @__PURE__ */ new Set(["analysis", "design", "test", "implement", "review"]);
  const allowedPriorities = /* @__PURE__ */ new Set(["critical", "high", "medium", "low"]);
  const seenPlanIds = /* @__PURE__ */ new Set();
  for (const [index, raw] of tasks.entries()) {
    if (!isPlainObject(raw)) {
      error(`planner output.tasks[${index}] must be an object`);
      continue;
    }
    const planId = raw.planId;
    const title = raw.title;
    const type = raw.type;
    const priority = raw.priority;
    if (!isNonEmptyString(planId)) {
      error(`planner output.tasks[${index}].planId must be a non-empty string`);
    } else {
      if (seenPlanIds.has(planId)) error(`Duplicate planner planId: ${planId}`);
      seenPlanIds.add(planId);
    }
    if (!isNonEmptyString(title)) error(`planner output.tasks[${index}].title must be a non-empty string`);
    if (!isNonEmptyString(type) || !allowedTypes.has(type)) {
      error(`planner output.tasks[${index}].type must be one of: ${Array.from(allowedTypes).join(", ")}`);
    }
    if (typeof priority !== "undefined") {
      if (!isNonEmptyString(priority) || !allowedPriorities.has(priority)) {
        error(`planner output.tasks[${index}].priority must be one of: ${Array.from(allowedPriorities).join(", ")}`);
      }
    }
    if (typeof raw.dependencies !== "undefined") {
      const deps = raw.dependencies;
      if (!isStringArray(deps)) {
        error(`planner output.tasks[${index}].dependencies must be an array of strings (when provided)`);
      } else {
        for (const dep of deps) {
          if (!seenPlanIds.has(dep)) {
            error(`planner output.tasks[${index}].dependencies references unknown/forward planId: ${dep}`);
          }
        }
      }
    }
  }
  return issues;
}
function validateManualTaskOutput(output) {
  const issues = [];
  const error = (message) => issues.push({ level: "error", message });
  if (!isPlainObject(output)) {
    error("output must be an object for manual-task");
    return issues;
  }
  if (!isNonEmptyString(output.actualWork)) {
    error("manual-task output.actualWork must be a non-empty string");
  }
  return issues;
}
function showHelp() {
  console.log(`
Agent Call Manager - \u7BA1\u7406 .codebuddy/agent-calls/

\u7528\u6CD5:
  node .codebuddy/scripts/agent-call-manager.js <command> [args] [options]

\u547D\u4EE4:
  list                         \u5217\u51FA\u6240\u6709 request\uFF08\u9ED8\u8BA4\uFF09
  show <requestId>             \u5C55\u793A\u67D0\u4E2A request\uFF08prompt/result \u8DEF\u5F84 + result \u6458\u8981\uFF09
  validate <requestId>         \u6821\u9A8C result.json \u662F\u5426\u4E3A\u53EF\u6D88\u8D39\u7ED3\u6784
  serve                        \u542F\u52A8 HTTP \u670D\u52A1\uFF08\u8FDC\u7A0B\u5199\u56DE + \u8FDC\u7A0B orchestrate/TaskBook \u67E5\u8BE2\uFF0C\u53EF\u9009\uFF09

\u9009\u9879:
  --json                        \u8F93\u51FA JSON
  --host <ip>                   serve: \u76D1\u542C\u5730\u5740\uFF08\u9ED8\u8BA4 127.0.0.1\uFF09
  --port <n>                    serve: \u76D1\u542C\u7AEF\u53E3\uFF08\u9ED8\u8BA4 4317\uFF09
  --token <t>                   serve: Bearer Token\uFF08\u53EF\u9009\uFF1B\u542F\u7528\u540E\u9664 /health \u5916\u90FD\u9700\u8981\u8BA4\u8BC1\uFF09
  -h, --help                    \u663E\u793A\u5E2E\u52A9
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
function flagAsBool(flags, key) {
  return flags[key] === true;
}
function flagAsString(flags, key) {
  const v = flags[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return void 0;
}
function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}
function isSafeRequestId(value) {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}
function isSafeTaskBookId(value) {
  if (!value) return false;
  if (value.includes("/") || value.includes("\\")) return false;
  if (value.includes("\0")) return false;
  if (value === "." || value === "..") return false;
  if (value.includes("..")) return false;
  return true;
}
function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.statusCode = statusCode;
  res.setHeader("content-type", contentType);
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  res.end(text);
}
function sendJson(res, statusCode, payload) {
  sendText(res, statusCode, JSON.stringify(payload, null, 2), "application/json; charset=utf-8");
}
function readRequestBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      total += buf.length;
      if (total > limitBytes) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", (err) => reject(err));
  });
}
function runNodeScript(scriptPath, args, cwd) {
  const res = (0, import_child_process.spawnSync)(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf-8",
    stdio: "pipe"
  });
  return {
    status: res.status,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? ""
  };
}
function parseAgentCallResult(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("result.json \u5FC5\u987B\u662F JSON object");
  const obj = parsed;
  const requestId = obj.requestId;
  const kind = obj.kind;
  const status = obj.status;
  if (typeof requestId !== "string" || !requestId) throw new Error("result.json \u7F3A\u5C11 requestId");
  if (status !== "success" && status !== "failed" && status !== "blocked") {
    throw new Error("result.json.status \u5FC5\u987B\u662F 'success' | 'failed' | 'blocked'");
  }
  return {
    requestId,
    kind: kind === "planner" || kind === "manual-task" ? kind : void 0,
    status,
    output: obj.output,
    artifacts: Array.isArray(obj.artifacts) ? obj.artifacts : void 0,
    error: typeof obj.error === "object" && obj.error ? obj.error : void 0,
    completedAt: typeof obj.completedAt === "string" ? obj.completedAt : void 0
  };
}
function validateAgentCallResultWithPrompt(requestId, promptPath, result) {
  const issues = [];
  if (typeof result.completedAt !== "undefined" && !isValidDateTime(result.completedAt)) {
    issues.push({ level: "error", message: "completedAt must be an ISO date-time string (when provided)" });
  }
  let kind = result.kind ?? "unknown";
  if (promptPath && fs.existsSync(promptPath)) {
    const promptRaw = fs.readFileSync(promptPath, "utf-8");
    const header = parsePromptHeader(promptRaw);
    if (!header.ok) {
      issues.push({ level: "warning", message: `prompt header invalid: ${header.error}` });
    } else {
      const inferred = inferKind(promptRaw, header.header);
      if (kind !== "unknown" && inferred !== "unknown" && kind !== inferred) {
        issues.push({ level: "error", message: `kind mismatch: result=${kind} prompt=${inferred}` });
      }
      if (inferred !== "unknown") kind = inferred;
      if (header.header.requestId !== requestId) {
        issues.push({ level: "error", message: `prompt header requestId mismatch: ${header.header.requestId}` });
      }
    }
  } else {
    issues.push({ level: "warning", message: "prompt.md missing; output validation may be limited" });
  }
  if (result.status !== "success" && !result.error?.message) {
    issues.push({ level: "warning", message: "error.message is recommended when status != success" });
  }
  if (result.status === "success") {
    if (typeof result.completedAt === "undefined") {
      issues.push({ level: "warning", message: "completedAt is recommended when status=success" });
    }
    if (kind === "planner") issues.push(...validatePlannerOutput(result.output));
    else if (kind === "manual-task") issues.push(...validateManualTaskOutput(result.output));
  }
  const ok = issues.every((i) => i.level !== "error");
  return { ok, kind, issues };
}
function ensureTaskbookDirs() {
  ensureDir(path2.join(process.cwd(), ".codebuddy", "taskbooks"));
  ensureDir(TASKBOOKS_ACTIVE_DIR);
  ensureDir(TASKBOOKS_HISTORY_DIR);
}
function listTaskBooksFromDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const items = [];
  for (const f of files) {
    const filePath = path2.join(dir, f);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (!isPlainObject(raw)) continue;
      const id = raw.id;
      if (!isNonEmptyString(id)) continue;
      items.push({
        id,
        title: typeof raw.title === "string" ? raw.title : void 0,
        status: typeof raw.status === "string" ? raw.status : void 0,
        taskType: typeof raw.taskType === "string" ? raw.taskType : void 0,
        revision: typeof raw.revision === "number" ? raw.revision : void 0,
        createdAt: typeof raw.createdAt === "string" ? raw.createdAt : void 0,
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : void 0
      });
    } catch {
      continue;
    }
  }
  items.sort((a, b) => a.id.localeCompare(b.id));
  return items;
}
function listAgentCalls() {
  ensureDir(AGENT_CALLS_DIR);
  const files = fs.readdirSync(AGENT_CALLS_DIR);
  const requestIds = /* @__PURE__ */ new Set();
  for (const f of files) {
    const m = f.match(/^(.*)\.(prompt\.md|result\.json)$/);
    if (m) requestIds.add(m[1]);
  }
  const items = [];
  for (const requestId of Array.from(requestIds).sort((a, b) => a.localeCompare(b))) {
    const promptPath = path2.join(AGENT_CALLS_DIR, `${requestId}.prompt.md`);
    const resultPath = path2.join(AGENT_CALLS_DIR, `${requestId}.result.json`);
    const hasPrompt = fs.existsSync(promptPath);
    const hasResult = fs.existsSync(resultPath);
    const item = {
      requestId,
      promptPath,
      resultPath,
      hasPrompt,
      hasResult
    };
    if (hasResult) {
      try {
        const r = parseAgentCallResult(fs.readFileSync(resultPath, "utf-8"));
        item.status = r.status;
        item.completedAt = r.completedAt;
        item.errorMessage = r.error?.message;
      } catch (e) {
        item.status = "failed";
        item.errorMessage = `invalid result.json: ${(e instanceof Error ? e.message : String(e)).slice(0, 2e3)}`;
      }
    }
    items.push(item);
  }
  return items;
}
function main() {
  const parsed = parseCli(process.argv.slice(2));
  const json = flagAsBool(parsed.flags, "json");
  const command = parsed.command ?? "list";
  if (command === "help" || command === "--help" || command === "-h") {
    showHelp();
    process.exit(0);
  }
  try {
    switch (command) {
      case "list": {
        const items = listAgentCalls();
        if (json) {
          printJson(items);
        } else {
          if (items.length === 0) {
            console.log("[AgentCall] empty");
            break;
          }
          console.log("[AgentCall] list:");
          for (const it of items) {
            const s = it.status ?? (it.hasResult ? "unknown" : "pending");
            console.log(`- ${it.requestId} | ${s} | prompt=${it.hasPrompt ? "y" : "n"} result=${it.hasResult ? "y" : "n"}`);
          }
        }
        break;
      }
      case "show": {
        const requestId = parsed.positionals[0];
        if (!requestId) {
          console.error("\u9519\u8BEF: show \u9700\u8981 <requestId>");
          process.exit(1);
        }
        const promptPath = path2.join(AGENT_CALLS_DIR, `${requestId}.prompt.md`);
        const resultPath = path2.join(AGENT_CALLS_DIR, `${requestId}.result.json`);
        const payload = {
          requestId,
          promptPath,
          resultPath,
          hasPrompt: fs.existsSync(promptPath),
          hasResult: fs.existsSync(resultPath)
        };
        if (fs.existsSync(resultPath)) {
          const r = parseAgentCallResult(fs.readFileSync(resultPath, "utf-8"));
          payload.result = r;
        }
        if (json) printJson(payload);
        else {
          console.log(`[AgentCall] ${requestId}`);
          console.log(`prompt: ${promptPath}`);
          console.log(`result: ${resultPath}`);
          if (payload.result) {
            const r = payload.result;
            console.log(`status: ${r.status}`);
            if (r.completedAt) console.log(`completedAt: ${r.completedAt}`);
            if (r.error?.message) console.log(`error: ${r.error.message}`);
          }
        }
        break;
      }
      case "validate": {
        const requestId = parsed.positionals[0];
        if (!requestId) {
          console.error("\u9519\u8BEF: validate \u9700\u8981 <requestId>");
          process.exit(1);
        }
        const promptPath = path2.join(AGENT_CALLS_DIR, `${requestId}.prompt.md`);
        const resultPath = path2.join(AGENT_CALLS_DIR, `${requestId}.result.json`);
        if (!fs.existsSync(resultPath)) {
          console.error(`\u9519\u8BEF: result.json \u4E0D\u5B58\u5728: ${resultPath}`);
          process.exit(1);
        }
        const r = parseAgentCallResult(fs.readFileSync(resultPath, "utf-8"));
        if (r.requestId !== requestId) {
          throw new Error(`requestId mismatch: expected ${requestId}, got ${r.requestId}`);
        }
        const validation = validateAgentCallResultWithPrompt(requestId, promptPath, r);
        const payload = { ok: validation.ok, requestId, kind: validation.kind, status: r.status, completedAt: r.completedAt, issues: validation.issues };
        if (json) {
          printJson(payload);
          process.exit(validation.ok ? 0 : 1);
        } else {
          const kindSuffix = validation.kind !== "unknown" ? `/${validation.kind}` : "";
          if (validation.ok) {
            console.log(`[AgentCall] OK: ${requestId} (${r.status}${kindSuffix})`);
            break;
          }
          console.error(`[AgentCall] INVALID: ${requestId} (${r.status}${kindSuffix})`);
          for (const i of validation.issues) {
            const prefix = i.level === "error" ? "ERROR" : "WARN ";
            console.error(`${prefix} ${i.message}`);
          }
          process.exit(1);
        }
      }
      case "serve": {
        const host = flagAsString(parsed.flags, "host") ?? DEFAULT_HOST;
        const portRaw = flagAsString(parsed.flags, "port");
        const token = flagAsString(parsed.flags, "token");
        const port = typeof portRaw === "string" ? Number.parseInt(portRaw, 10) : DEFAULT_PORT;
        if (!Number.isFinite(port) || port < 0 || port > 65535) {
          throw new Error(`invalid --port: ${portRaw ?? ""}`);
        }
        ensureDir(AGENT_CALLS_DIR);
        const server = http.createServer((req, res) => {
          const handle = async () => {
            const url = new URL(req.url ?? "/", "http://localhost");
            if (url.pathname !== "/health" && token) {
              const auth = String(req.headers.authorization ?? "");
              if (auth !== `Bearer ${token}`) {
                sendJson(res, 401, { ok: false, error: "unauthorized" });
                return;
              }
            }
            if (req.method === "GET" && url.pathname === "/health") {
              sendJson(res, 200, { ok: true, now: (/* @__PURE__ */ new Date()).toISOString() });
              return;
            }
            if (req.method === "GET" && url.pathname === "/taskbooks") {
              ensureTaskbookDirs();
              const active = listTaskBooksFromDir(TASKBOOKS_ACTIVE_DIR);
              const history = listTaskBooksFromDir(TASKBOOKS_HISTORY_DIR);
              sendJson(res, 200, { ok: true, active, history });
              return;
            }
            const tbMatch = url.pathname.match(/^\/taskbooks\/(.+)$/);
            if (req.method === "GET" && tbMatch) {
              ensureTaskbookDirs();
              const rawId = decodeURIComponent(tbMatch[1]);
              const taskBookId = rawId.endsWith(".json") ? rawId.slice(0, -".json".length) : rawId;
              if (!isSafeTaskBookId(taskBookId)) {
                sendJson(res, 400, { ok: false, error: "invalid_taskbook_id" });
                return;
              }
              const activePath = path2.join(TASKBOOKS_ACTIVE_DIR, `${taskBookId}.json`);
              const historyPath = path2.join(TASKBOOKS_HISTORY_DIR, `${taskBookId}.json`);
              if (fs.existsSync(activePath)) {
                sendJson(res, 200, { ok: true, location: "active", taskBook: JSON.parse(fs.readFileSync(activePath, "utf-8")) });
                return;
              }
              if (fs.existsSync(historyPath)) {
                sendJson(res, 200, { ok: true, location: "history", taskBook: JSON.parse(fs.readFileSync(historyPath, "utf-8")) });
                return;
              }
              sendJson(res, 404, { ok: false, error: "taskbook_not_found" });
              return;
            }
            if (req.method === "POST" && url.pathname === "/orchestrate") {
              const orchestratorPath = path2.join(CODEBUDDY_SCRIPTS_DIR, "task-orchestrator.js");
              if (!fs.existsSync(orchestratorPath)) {
                sendJson(res, 500, { ok: false, error: "missing_script", script: toPosixPath(path2.relative(process.cwd(), orchestratorPath)) });
                return;
              }
              let bodyText = "";
              try {
                bodyText = await readRequestBody(req, MAX_BODY_BYTES);
              } catch (e) {
                const code = e instanceof Error ? e.message : String(e);
                if (code === "payload_too_large") {
                  sendJson(res, 413, { ok: false, error: "payload_too_large" });
                  return;
                }
                sendJson(res, 400, { ok: false, error: "read_body_failed", message: code });
                return;
              }
              let payload;
              try {
                payload = bodyText ? JSON.parse(bodyText) : {};
              } catch (e) {
                sendJson(res, 400, { ok: false, error: "invalid_json", message: e instanceof Error ? e.message : String(e) });
                return;
              }
              if (!isPlainObject(payload)) {
                sendJson(res, 400, { ok: false, error: "invalid_payload", message: "payload must be a JSON object" });
                return;
              }
              const requestId2 = payload.requestId;
              const taskBookId = payload.taskBookId;
              const requirement = payload.requirement;
              const title = payload.title;
              const description = payload.description;
              const type = payload.type;
              const workflowPath = payload.workflowPath;
              const tasksOnly = payload.tasksOnly;
              const approve = payload.approve;
              const maxParallel = payload.maxParallel;
              const noAutoConfirm = payload.noAutoConfirm;
              const stopAfterPlan = payload.stopAfterPlan;
              const watch = payload.watch;
              const watchPollMs = payload.watchPollMs;
              const watchTimeoutMs = payload.watchTimeoutMs;
              const allowedTypes = /* @__PURE__ */ new Set(["new-feature", "refactoring", "debugging", "testing", "code-review"]);
              const args = [];
              if (isNonEmptyString(taskBookId)) {
                args.push("--taskbook", taskBookId);
              } else if (isNonEmptyString(requirement)) {
                args.push(requirement);
                if (typeof type === "undefined") {
                  args.push("--type", "new-feature");
                } else if (isNonEmptyString(type) && allowedTypes.has(type)) {
                  args.push("--type", type);
                } else {
                  sendJson(res, 400, { ok: false, error: "invalid_type" });
                  return;
                }
              } else if (isNonEmptyString(title) && isNonEmptyString(description)) {
                args.push("--title", title, "--description", description);
                if (typeof type === "undefined") {
                  args.push("--type", "new-feature");
                } else if (isNonEmptyString(type) && allowedTypes.has(type)) {
                  args.push("--type", type);
                } else {
                  sendJson(res, 400, { ok: false, error: "invalid_type" });
                  return;
                }
              } else {
                sendJson(res, 400, { ok: false, error: "missing_input", message: "requirement \u6216 taskBookId \u6216 (title+description) \u5FC5\u586B\u5176\u4E00" });
                return;
              }
              if (tasksOnly === true) args.push("--tasks-only");
              if (noAutoConfirm === true) args.push("--no-auto-confirm");
              if (stopAfterPlan === true) args.push("--stop-after-plan");
              if (isNonEmptyString(workflowPath)) args.push("--workflow", workflowPath);
              if (watch === true) args.push("--watch");
              if (typeof watchPollMs === "number" && Number.isFinite(watchPollMs) && watchPollMs > 0) {
                args.push("--watch-poll-ms", String(watchPollMs));
              }
              if (typeof watchTimeoutMs === "number" && Number.isFinite(watchTimeoutMs) && watchTimeoutMs >= 0) {
                args.push("--watch-timeout-ms", String(watchTimeoutMs));
              }
              if (isStringArray(approve)) {
                for (const gateId of approve.filter(isNonEmptyString)) {
                  args.push("--approve", gateId);
                }
              }
              if (typeof maxParallel === "number" && Number.isFinite(maxParallel) && maxParallel > 0) {
                args.push("--max-parallel", String(maxParallel));
              }
              if (isNonEmptyString(requestId2)) {
                args.push("--request-id", requestId2);
              }
              args.push("--json");
              const startedAt = (/* @__PURE__ */ new Date()).toISOString();
              const run = runNodeScript(orchestratorPath, args, process.cwd());
              const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
              let outcome = null;
              if (run.stdout.trim().length > 0) {
                try {
                  outcome = JSON.parse(run.stdout);
                } catch {
                  outcome = { raw: run.stdout };
                }
              }
              sendJson(res, 200, {
                ok: true,
                exitCode: run.status,
                startedAt,
                finishedAt,
                outcome,
                stderr: run.stderr ? run.stderr.slice(0, 2e4) : ""
              });
              return;
            }
            if (req.method === "GET" && url.pathname === "/agent-calls") {
              sendJson(res, 200, { ok: true, items: listAgentCalls() });
              return;
            }
            const m = url.pathname.match(/^\/agent-calls\/([^/]+)(?:\/(prompt|result))?$/);
            if (!m) {
              sendJson(res, 404, { ok: false, error: "not_found" });
              return;
            }
            const requestId = decodeURIComponent(m[1]);
            const action = m[2] ?? null;
            if (!isSafeRequestId(requestId)) {
              sendJson(res, 400, { ok: false, error: "invalid_request_id" });
              return;
            }
            const promptPath = path2.join(AGENT_CALLS_DIR, `${requestId}.prompt.md`);
            const resultPath = path2.join(AGENT_CALLS_DIR, `${requestId}.result.json`);
            if (!action) {
              if (req.method !== "GET") {
                sendJson(res, 405, { ok: false, error: "method_not_allowed" });
                return;
              }
              const payload = {
                ok: true,
                requestId,
                promptPath: toPosixPath(path2.relative(process.cwd(), promptPath)),
                resultPath: toPosixPath(path2.relative(process.cwd(), resultPath)),
                hasPrompt: fs.existsSync(promptPath),
                hasResult: fs.existsSync(resultPath)
              };
              if (fs.existsSync(resultPath)) {
                try {
                  payload.result = parseAgentCallResult(fs.readFileSync(resultPath, "utf-8"));
                } catch (e) {
                  payload.resultError = e instanceof Error ? e.message : String(e);
                }
              }
              sendJson(res, 200, payload);
              return;
            }
            if (action === "prompt") {
              if (req.method !== "GET") {
                sendJson(res, 405, { ok: false, error: "method_not_allowed" });
                return;
              }
              if (!fs.existsSync(promptPath)) {
                sendJson(res, 404, { ok: false, error: "prompt_not_found" });
                return;
              }
              sendText(res, 200, fs.readFileSync(promptPath, "utf-8"), "text/markdown; charset=utf-8");
              return;
            }
            if (action === "result") {
              if (req.method === "GET") {
                if (!fs.existsSync(resultPath)) {
                  sendJson(res, 404, { ok: false, error: "result_not_found" });
                  return;
                }
                const raw = fs.readFileSync(resultPath, "utf-8");
                try {
                  const parsed2 = JSON.parse(raw);
                  sendJson(res, 200, { ok: true, result: parsed2 });
                } catch (e) {
                  sendJson(res, 200, { ok: true, raw });
                }
                return;
              }
              if (req.method === "PUT" || req.method === "POST") {
                let bodyText = "";
                try {
                  bodyText = await readRequestBody(req, MAX_BODY_BYTES);
                } catch (e) {
                  const code = e instanceof Error ? e.message : String(e);
                  if (code === "payload_too_large") {
                    sendJson(res, 413, { ok: false, error: "payload_too_large" });
                    return;
                  }
                  sendJson(res, 400, { ok: false, error: "read_body_failed", message: code });
                  return;
                }
                let result;
                try {
                  result = parseAgentCallResult(bodyText);
                } catch (e) {
                  sendJson(res, 400, { ok: false, error: "invalid_result_json", message: e instanceof Error ? e.message : String(e) });
                  return;
                }
                if (result.requestId !== requestId) {
                  sendJson(res, 400, { ok: false, error: "request_id_mismatch", expected: requestId, got: result.requestId });
                  return;
                }
                const validation = validateAgentCallResultWithPrompt(requestId, fs.existsSync(promptPath) ? promptPath : null, result);
                if (!validation.ok) {
                  sendJson(res, 400, { ok: false, error: "validation_failed", requestId, kind: validation.kind, issues: validation.issues });
                  return;
                }
                fs.writeFileSync(resultPath, JSON.stringify(JSON.parse(bodyText), null, 2), "utf-8");
                sendJson(res, 200, {
                  ok: true,
                  requestId,
                  kind: validation.kind,
                  written: true,
                  resultPath: toPosixPath(path2.relative(process.cwd(), resultPath)),
                  issues: validation.issues
                });
                return;
              }
              sendJson(res, 405, { ok: false, error: "method_not_allowed" });
              return;
            }
            sendJson(res, 404, { ok: false, error: "not_found" });
          };
          handle().catch((err) => {
            sendJson(res, 500, { ok: false, error: "internal_error", message: err instanceof Error ? err.message : String(err) });
          });
        });
        server.on("error", (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (json) printJson({ ok: false, error: msg });
          else console.error(msg);
          process.exit(1);
        });
        server.listen(port, host, () => {
          const addr = server.address();
          const actualPort = typeof addr === "object" && addr ? addr.port : port;
          const baseUrl = `http://${host}:${actualPort}`;
          const payload = {
            ok: true,
            host,
            port: actualPort,
            baseUrl,
            tokenEnabled: Boolean(token),
            agentCallsDir: toPosixPath(path2.relative(process.cwd(), AGENT_CALLS_DIR)),
            endpoints: {
              health: "/health",
              taskbooks: "/taskbooks",
              taskbook: "/taskbooks/:taskBookId",
              orchestrate: "/orchestrate",
              list: "/agent-calls",
              show: "/agent-calls/:requestId",
              prompt: "/agent-calls/:requestId/prompt",
              result: "/agent-calls/:requestId/result"
            }
          };
          if (json) {
            printJson(payload);
            return;
          }
          console.log(`[AgentCall] serving: ${baseUrl}`);
          console.log(`[AgentCall] GET  ${payload.endpoints.taskbooks}`);
          console.log(`[AgentCall] GET  ${payload.endpoints.taskbook}`);
          console.log(`[AgentCall] POST ${payload.endpoints.orchestrate}`);
          console.log(`[AgentCall] GET  ${payload.endpoints.list}`);
          console.log(`[AgentCall] GET  ${payload.endpoints.prompt}`);
          console.log(`[AgentCall] GET  ${payload.endpoints.result}`);
          console.log(`[AgentCall] PUT  ${payload.endpoints.result}`);
          if (token) {
            console.log("[AgentCall] auth: Authorization: Bearer <token>");
          }
        });
        break;
      }
      default: {
        console.error(`\u672A\u77E5\u547D\u4EE4: ${command}`);
        showHelp();
        process.exit(1);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (json) printJson({ ok: false, error: msg });
    else console.error(msg);
    process.exit(1);
  }
}
if (isDirectCliEntry("agent-call-manager.js")) {
  main();
}
