#!/usr/bin/env node
"use strict";
/**
 * Task Orchestrator (MVP)
 *
 * One-command closed-loop runner:
 * - create/resume TaskBook
 * - generate reports (structure/module) to support planning
 * - generate planner prompt + wait for result.json
 * - apply plan -> confirm -> run task-executor (workflow or tasks-only)
 *
 * Design notes:
 * - Local-first: prompt/result use `.codebuddy/agent-calls/` file protocol.
 * - Idempotent/resumable: planner requestId is deterministic per TaskBook.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
function parseCli(argv) {
    const args = argv.slice();
    const positionals = [];
    const flags = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith('--')) {
            positionals.push(arg);
            continue;
        }
        const eqIndex = arg.indexOf('=');
        const rawKey = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
        const key = rawKey.trim();
        let value = true;
        if (eqIndex >= 0) {
            value = arg.slice(eqIndex + 1);
        }
        else if (args[i + 1] && !args[i + 1].startsWith('--')) {
            value = args[++i];
        }
        const existing = flags[key];
        if (typeof existing === 'undefined') {
            flags[key] = value;
        }
        else if (Array.isArray(existing)) {
            existing.push(String(value));
            flags[key] = existing;
        }
        else {
            flags[key] = [String(existing), String(value)];
        }
    }
    return { positionals, flags };
}
function flagAsString(flags, key) {
    const v = flags[key];
    if (typeof v === 'string')
        return v;
    if (Array.isArray(v))
        return v[0];
    return undefined;
}
function flagAsBool(flags, key) {
    return flags[key] === true;
}
function flagAsStringArray(flags, key) {
    const v = flags[key];
    if (typeof v === 'string')
        return [v];
    if (Array.isArray(v))
        return v;
    return [];
}
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
function toPosixPath(value) {
    return value.replace(/\\/g, '/');
}
function sanitizeForFilename(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}
function computePlannerRequestId(taskBookId) {
    const hash = (0, crypto_1.createHash)('sha1').update(taskBookId).digest('hex').slice(0, 10);
    return `req-planner-${hash}`;
}
function runNodeScript(scriptPath, args, opts) {
    var _a, _b;
    const res = (0, child_process_1.spawnSync)(process.execPath, [scriptPath, ...args], {
        cwd: opts.cwd,
        encoding: 'utf-8',
        stdio: opts.capture ? 'pipe' : 'inherit',
    });
    return {
        status: res.status,
        stdout: (_a = res.stdout) !== null && _a !== void 0 ? _a : '',
        stderr: (_b = res.stderr) !== null && _b !== void 0 ? _b : '',
    };
}
const SLEEP_INT32 = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
    Atomics.wait(SLEEP_INT32, 0, 0, ms);
}
function parseJsonOrThrow(text, hint) {
    try {
        return JSON.parse(text);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`${hint}: JSON 解析失败: ${msg}`);
    }
}
function taskbookManagerPath(projectRoot) {
    return path.join(projectRoot, '.codebuddy', 'scripts', 'taskbook-manager.js');
}
function taskExecutorPath(projectRoot) {
    return path.join(projectRoot, '.codebuddy', 'scripts', 'task-executor.js');
}
function structureAnalyzerPath(projectRoot) {
    return path.join(projectRoot, '.codebuddy', 'scripts', 'structure-analyzer.js');
}
function moduleMapperPath(projectRoot) {
    return path.join(projectRoot, '.codebuddy', 'scripts', 'module-mapper.js');
}
function runTaskbookManagerJson(projectRoot, args, capture) {
    const script = taskbookManagerPath(projectRoot);
    if (!fs.existsSync(script)) {
        throw new Error(`缺少脚本: ${toPosixPath(path.relative(projectRoot, script))}（请先运行 codebuddy-loader）`);
    }
    const res = runNodeScript(script, [...args, '--json'], { cwd: projectRoot, capture });
    if (res.status !== 0) {
        throw new Error(`taskbook-manager failed (exit=${res.status}): ${res.stderr || res.stdout}`);
    }
    return parseJsonOrThrow(res.stdout, 'taskbook-manager --json 输出');
}
function loadTaskBook(projectRoot, taskBookId) {
    const tb = runTaskbookManagerJson(projectRoot, ['show', taskBookId], true);
    return tb;
}
function loadRevision(projectRoot, taskBookId) {
    const tb = loadTaskBook(projectRoot, taskBookId);
    const rev = typeof tb.revision === 'number' ? tb.revision : 0;
    return rev;
}
function listBlockedAgentCalls(taskBook) {
    const tasks = Array.isArray(taskBook.tasks) ? taskBook.tasks : [];
    const blocked = tasks.filter(t => t && t.status === 'blocked' && typeof t.blockedReason === 'string' && t.blockedReason.includes('[agent-call]'));
    const results = [];
    for (const t of blocked) {
        const lines = String(t.blockedReason).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const metaLine = lines.find(l => l.startsWith('[agent-call]'));
        if (!metaLine)
            continue;
        const jsonText = metaLine.slice('[agent-call]'.length).trim();
        try {
            const meta = JSON.parse(jsonText);
            results.push({ taskId: t.id, title: t.title, meta });
        }
        catch (_a) {
            results.push({ taskId: t.id, title: t.title, meta: { parseError: true, raw: jsonText.slice(0, 2000) } });
        }
    }
    return results;
}
function showHelp() {
    console.log(`
Task Orchestrator - 一键闭环执行器（MVP）

用法:
  node .codebuddy/scripts/task-orchestrator.js "<需求描述>"
  node .codebuddy/scripts/task-orchestrator.js --title "<title>" --description "<desc>" [--type <type>]
  node .codebuddy/scripts/task-orchestrator.js --taskbook <taskBookId>     # 继续执行

常用选项:
  --type <new-feature|refactoring|debugging|testing|code-review>  （默认 new-feature）
  --taskbook <id>          继续某个 TaskBook
  --no-auto-confirm        不自动 confirm（仅生成/应用计划）
  --stop-after-plan        应用 plan 后停止（不执行 task-executor）
  --tasks-only             仅执行任务（跳过 workflow gates）
  --workflow <path>        指定 workflow（默认 .codebuddy/workflows/default.workflow.json）
  --approve <gateId>       预先批准 gate（可重复；例如 review_passed）
  --max-parallel <n>       覆盖并行度（透传给 task-executor）
  --watch                 自动等待 result.json 并继续（直到完成或不可自动推进）
  --watch-poll-ms <n>      watch: 轮询间隔（默认 1500）
  --watch-timeout-ms <n>   watch: 超时（默认 0=不超时）
  --json                   输出 JSON（便于脚本/测试消费）

行为:
  - 若尚未规划任务：生成 planner prompt 到 .codebuddy/agent-calls/ 并等待 result.json
  - 若遇到 MANUAL_REQUIRED：task-executor 会自动生成 agent-call prompt；写回 result.json 后重跑本命令继续
`);
}
function emitOutcome(outcome, json) {
    var _a;
    if (json) {
        console.log(JSON.stringify(outcome, null, 2));
        return;
    }
    if (outcome.status === 'completed') {
        console.log(`[Orchestrator] 已完成: ${outcome.taskBookId}`);
        return;
    }
    if (outcome.status === 'error') {
        console.error(outcome.message);
        return;
    }
    // blocked
    const details = (_a = outcome.details) !== null && _a !== void 0 ? _a : {};
    if (outcome.reason === 'planner_result_missing') {
        if (details.promptPath)
            console.log(`[Orchestrator] 已生成 planner prompt: ${details.promptPath}`);
        if (details.resultPath)
            console.log(`[Orchestrator] 等待写回 result.json: ${details.resultPath}`);
        if (details.next) {
            console.log('[Orchestrator] 写回后重跑继续：');
            console.log(`  ${details.next}`);
        }
        return;
    }
    console.log(`\n[Orchestrator] 未完成: ${outcome.taskBookId}`);
    const blockedTasks = Array.isArray(details.blockedTasks) ? details.blockedTasks : [];
    if (blockedTasks.length > 0) {
        console.log('[Orchestrator] 发现待处理的 agent-call：');
        for (const t of blockedTasks) {
            const taskId = (t && typeof t.taskId === 'string') ? t.taskId : '?';
            const title = (t && typeof t.title === 'string') ? t.title : '';
            const meta = t && typeof t.meta !== 'undefined' ? t.meta : null;
            console.log(`- ${taskId} ${title}`);
            console.log(`  meta: ${JSON.stringify(meta)}`);
        }
    }
    else if (details.hint) {
        console.log(`[Orchestrator] ${details.hint}`);
    }
    if (details.next) {
        console.log('[Orchestrator] 处理后重跑：');
        console.log(`  ${details.next}`);
    }
}
function extractWaitForFiles(outcome, projectRoot) {
    var _a;
    if (outcome.status !== 'blocked')
        return [];
    const details = (_a = outcome.details) !== null && _a !== void 0 ? _a : {};
    if (outcome.reason === 'planner_result_missing') {
        const p = details.resultPath;
        if (typeof p === 'string' && p)
            return [path.isAbsolute(p) ? p : path.join(projectRoot, p)];
        return [];
    }
    const blockedTasks = Array.isArray(details.blockedTasks) ? details.blockedTasks : [];
    const paths = [];
    for (const t of blockedTasks) {
        if (!t || typeof t !== 'object')
            continue;
        const meta = t.meta;
        if (!meta || typeof meta !== 'object')
            continue;
        const resultPath = meta.resultPath;
        if (typeof resultPath === 'string' && resultPath) {
            paths.push(path.isAbsolute(resultPath) ? resultPath : path.join(projectRoot, resultPath));
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
        // Ensure required scripts exist (for a better error message early).
        const tmPath = taskbookManagerPath(projectRoot);
        if (!fs.existsSync(tmPath)) {
            throw new Error(`缺少脚本: ${toPosixPath(path.relative(projectRoot, tmPath))}（请先运行 codebuddy-loader）`);
        }
        const tePath = taskExecutorPath(projectRoot);
        if (!fs.existsSync(tePath)) {
            throw new Error(`缺少脚本: ${toPosixPath(path.relative(projectRoot, tePath))}（请先运行 codebuddy-loader）`);
        }
        // Create or load TaskBook
        if (!taskBookId) {
            if (!params.title || !params.description) {
                throw new Error('错误: 缺少输入。请提供 "<需求描述>" 或 --title/--description，或使用 --taskbook 继续。');
            }
            const created = runTaskbookManagerJson(projectRoot, [
                'create',
                '--title', params.title,
                '--description', params.description,
                '--type', params.type,
            ], true);
            taskBookId = created.id;
            if (!taskBookId)
                throw new Error('create 未返回 TaskBook.id');
        }
        const tb0 = loadTaskBook(projectRoot, taskBookId);
        const tasks0 = Array.isArray(tb0.tasks) ? tb0.tasks : [];
        // Plan tasks if none.
        if (tasks0.length === 0) {
            // Ensure reports exist (best-effort).
            const reports = [
                path.join(projectRoot, '.codebuddy', 'reports', 'architecture', 'latest.json'),
                path.join(projectRoot, '.codebuddy', 'reports', 'modules', 'latest.json'),
            ];
            const needReports = reports.some(p => !fs.existsSync(p));
            if (needReports) {
                const analyzer = structureAnalyzerPath(projectRoot);
                const mapper = moduleMapperPath(projectRoot);
                if (fs.existsSync(mapper)) {
                    runNodeScript(mapper, ['.', '--mode', 'summary', '--output', 'json'], { cwd: projectRoot, capture: json });
                }
                if (fs.existsSync(analyzer)) {
                    runNodeScript(analyzer, ['.', '--mode', 'summary', '--output', 'json'], { cwd: projectRoot, capture: json });
                }
            }
            const requestId = computePlannerRequestId(taskBookId);
            const plan = runTaskbookManagerJson(projectRoot, [
                'plan',
                taskBookId,
                '--request-id', requestId,
            ], true);
            const resultAbsPath = path.isAbsolute(plan.resultPath) ? plan.resultPath : path.join(projectRoot, plan.resultPath);
            if (!fs.existsSync(resultAbsPath)) {
                outcome = {
                    status: 'blocked',
                    reason: 'planner_result_missing',
                    taskBookId,
                    details: {
                        requestId: plan.requestId,
                        promptPath: toPosixPath(plan.promptPath),
                        resultPath: toPosixPath(plan.resultPath),
                        next: `node .codebuddy/scripts/task-orchestrator.js --taskbook ${taskBookId}`,
                    },
                };
                waitForFiles = [resultAbsPath];
                if (emit)
                    emitOutcome(outcome, json);
                return { exitCode: 2, taskBookId, outcome, waitForFiles };
            }
            // Apply plan (mutating; pass --if-rev).
            const rev = loadRevision(projectRoot, taskBookId);
            runTaskbookManagerJson(projectRoot, ['apply-plan', taskBookId, plan.requestId, '--if-rev', String(rev)], true);
        }
        // Confirm if needed (mutating; pass --if-rev).
        const tb1 = loadTaskBook(projectRoot, taskBookId);
        if (!noAutoConfirm && tb1.status === 'draft') {
            const rev = loadRevision(projectRoot, taskBookId);
            runTaskbookManagerJson(projectRoot, ['confirm', taskBookId, '--if-rev', String(rev)], true);
        }
        if (stopAfterPlan) {
            outcome = { status: 'completed', taskBookId };
            if (emit)
                emitOutcome(outcome, json);
            return { exitCode: 0, taskBookId, outcome, waitForFiles: [] };
        }
        // Execute workflow (or tasks-only).
        const executorArgs = [];
        if (tasksOnly)
            executorArgs.push('--tasks-only');
        if (workflowPath)
            executorArgs.push('--workflow', workflowPath);
        for (const gateId of approve)
            executorArgs.push('--approve', gateId);
        if (maxParallel)
            executorArgs.push('--max-parallel', maxParallel);
        const te = taskExecutorPath(projectRoot);
        const execRes = runNodeScript(te, [taskBookId, ...executorArgs], { cwd: projectRoot, capture: json });
        if (execRes.status === 0) {
            outcome = { status: 'completed', taskBookId };
            if (emit)
                emitOutcome(outcome, json);
            return { exitCode: 0, taskBookId, outcome, waitForFiles: [] };
        }
        // Blocked / waiting: provide actionable next steps.
        const tb2 = loadTaskBook(projectRoot, taskBookId);
        const calls = listBlockedAgentCalls(tb2);
        outcome = {
            status: 'blocked',
            reason: 'workflow_not_completed',
            taskBookId,
            details: {
                blockedTasks: calls.map(c => ({ taskId: c.taskId, title: c.title, meta: c.meta })),
                hint: calls.length > 0
                    ? '请按 prompt 执行并写回 result.json，然后重跑本命令。'
                    : '可能存在 gate 未通过或需要 --approve <gateId>（例如 review_passed）。',
                next: `node .codebuddy/scripts/task-orchestrator.js --taskbook ${taskBookId}${tasksOnly ? ' --tasks-only' : ''}${approve.map(a => ` --approve ${a}`).join('')}`,
            },
        };
        waitForFiles = extractWaitForFiles(outcome, projectRoot);
        const exitCode = execRes.status === 2 ? 2 : 1;
        if (emit)
            emitOutcome(outcome, json);
        return { exitCode, taskBookId, outcome, waitForFiles };
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        outcome = { status: 'error', message };
        if (emit)
            emitOutcome(outcome, json);
        return { exitCode: 1, taskBookId: taskBookId !== null && taskBookId !== void 0 ? taskBookId : '', outcome, waitForFiles: [] };
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
    var _a, _b, _c, _d, _e;
    const parsed = parseCli(process.argv.slice(2));
    const json = flagAsBool(parsed.flags, 'json');
    if (flagAsBool(parsed.flags, 'help') || flagAsBool(parsed.flags, 'h') || flagAsBool(parsed.flags, '-h')) {
        showHelp();
        process.exit(0);
    }
    const watch = flagAsBool(parsed.flags, 'watch');
    const watchPollMs = Number.parseInt((_a = flagAsString(parsed.flags, 'watch-poll-ms')) !== null && _a !== void 0 ? _a : '1500', 10);
    const watchTimeoutMs = Number.parseInt((_b = flagAsString(parsed.flags, 'watch-timeout-ms')) !== null && _b !== void 0 ? _b : '0', 10);
    const projectRoot = process.cwd();
    const noAutoConfirm = flagAsBool(parsed.flags, 'no-auto-confirm');
    const stopAfterPlan = flagAsBool(parsed.flags, 'stop-after-plan');
    const tasksOnly = flagAsBool(parsed.flags, 'tasks-only');
    const workflowPath = flagAsString(parsed.flags, 'workflow');
    const approve = flagAsStringArray(parsed.flags, 'approve');
    const maxParallel = flagAsString(parsed.flags, 'max-parallel');
    let taskBookId = (_c = flagAsString(parsed.flags, 'taskbook')) !== null && _c !== void 0 ? _c : flagAsString(parsed.flags, 'taskbook-id');
    const requestText = parsed.positionals.join(' ').trim();
    const type = ((_d = flagAsString(parsed.flags, 'type')) !== null && _d !== void 0 ? _d : 'new-feature').trim();
    const titleFromFlag = flagAsString(parsed.flags, 'title');
    const descFromFlag = flagAsString(parsed.flags, 'description');
    const title = titleFromFlag !== null && titleFromFlag !== void 0 ? titleFromFlag : (requestText ? requestText.slice(0, 40) : undefined);
    const description = descFromFlag !== null && descFromFlag !== void 0 ? descFromFlag : (requestText ? requestText : undefined);
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
            description,
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
            description,
        }, false);
        taskBookId = r.taskBookId;
        last = r;
        if (r.exitCode !== 2) {
            emitOutcome(r.outcome, json);
            process.exit(r.exitCode);
        }
        const missing = r.waitForFiles.filter(p => !fs.existsSync(p));
        if (r.waitForFiles.length === 0) {
            emitOutcome(r.outcome, json);
            process.exit(2);
        }
        if (missing.length === 0) {
            // All candidate files exist now; retry immediately (e.g. file appeared between checks).
            continue;
        }
        // Print blocked details once.
        if (iteration === 1) {
            if (!json) {
                emitOutcome(r.outcome, false);
            }
            else if (r.outcome.status === 'blocked') {
                const details = (_e = r.outcome.details) !== null && _e !== void 0 ? _e : {};
                if (r.outcome.reason === 'planner_result_missing') {
                    if (details.promptPath)
                        console.error(`[Orchestrator/watch] planner prompt: ${details.promptPath}`);
                    if (details.resultPath)
                        console.error(`[Orchestrator/watch] planner result: ${details.resultPath}`);
                }
                else {
                    console.error(`[Orchestrator/watch] blocked: ${r.outcome.reason} taskBookId=${r.outcome.taskBookId}`);
                }
            }
        }
        const elapsedTotal = Date.now() - startedAt;
        const remaining = watchTimeoutMs > 0 ? Math.max(0, watchTimeoutMs - elapsedTotal) : 0;
        if (watchTimeoutMs > 0 && remaining === 0) {
            const outcome = {
                status: 'blocked',
                reason: 'watch_timeout',
                taskBookId: r.taskBookId,
                details: {
                    waitedMs: elapsedTotal,
                    missingFiles: missing.map(toPosixPath),
                    next: `node .codebuddy/scripts/task-orchestrator.js --taskbook ${r.taskBookId}`,
                },
            };
            emitOutcome(outcome, json);
            process.exit(2);
        }
        console.error(`[Orchestrator/watch] waiting (${missing.length})...`);
        const waitRes = waitForAnyFile(missing, watchPollMs, remaining);
        if (!waitRes.ok) {
            const outcome = {
                status: 'blocked',
                reason: 'watch_timeout',
                taskBookId: r.taskBookId,
                details: {
                    waitedMs: elapsedTotal + waitRes.waitedMs,
                    missingFiles: missing.map(toPosixPath),
                    next: `node .codebuddy/scripts/task-orchestrator.js --taskbook ${r.taskBookId}`,
                },
            };
            emitOutcome(outcome, json);
            process.exit(2);
        }
        // Continue loop once any file appears.
        if (waitRes.hit) {
            console.error(`[Orchestrator/watch] detected: ${toPosixPath(waitRes.hit)}`);
        }
    }
}
if (require.main === module) {
    main();
}
