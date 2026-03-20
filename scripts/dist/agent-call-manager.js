#!/usr/bin/env node
"use strict";
/**
 * Agent Call Manager
 *
 * Manage `.codebuddy/agent-calls/` prompt/result files.
 *
 * Commands:
 * - list (default): list all requests
 * - show <requestId>
 * - validate <requestId>
 * - serve: optional HTTP server for remote writeback
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
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const cli_entry_1 = require("./lib/cli-entry");
const AGENT_CALLS_DIR = path.join(process.cwd(), '.codebuddy', 'agent-calls');
const TASKBOOKS_ACTIVE_DIR = path.join(process.cwd(), '.codebuddy', 'taskbooks', 'active');
const TASKBOOKS_HISTORY_DIR = path.join(process.cwd(), '.codebuddy', 'taskbooks', 'history');
const CODEBUDDY_SCRIPTS_DIR = path.join(process.cwd(), '.codebuddy', 'scripts');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4317;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function isStringArray(value) {
    return Array.isArray(value) && value.every(v => typeof v === 'string');
}
function isValidDateTime(value) {
    if (typeof value !== 'string')
        return false;
    const t = Date.parse(value);
    return Number.isFinite(t);
}
function parseFirstJsonCodeBlock(markdown) {
    const m = markdown.match(/```json\s*([\s\S]*?)\s*```/);
    if (!m)
        return { ok: false, error: 'Missing ```json ... ``` block in prompt.md' };
    return { ok: true, jsonText: m[1] };
}
function parsePromptHeader(markdown) {
    const block = parseFirstJsonCodeBlock(markdown);
    if (!block.ok)
        return block;
    try {
        const parsed = JSON.parse(block.jsonText);
        if (!isPlainObject(parsed))
            return { ok: false, error: 'prompt header JSON must be an object' };
        if (!isNonEmptyString(parsed.requestId))
            return { ok: false, error: 'prompt header JSON missing requestId' };
        return { ok: true, header: parsed };
    }
    catch (error) {
        return { ok: false, error: `Invalid prompt header JSON: ${error instanceof Error ? error.message : String(error)}` };
    }
}
function inferKind(promptMarkdown, header) {
    var _a, _b;
    const firstLine = (_b = (_a = promptMarkdown.split(/\r?\n/, 1)[0]) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
    if (firstLine === '# Agent Call: planner' || (header === null || header === void 0 ? void 0 : header.agentId) === 'planner')
        return 'planner';
    if (firstLine === '# Agent Call: manual-task' || isNonEmptyString(header === null || header === void 0 ? void 0 : header.taskId))
        return 'manual-task';
    return 'unknown';
}
function validatePlannerOutput(output) {
    const issues = [];
    const error = (message) => issues.push({ level: 'error', message });
    const warn = (message) => issues.push({ level: 'warning', message });
    if (!isPlainObject(output)) {
        error('output must be an object for planner');
        return issues;
    }
    const tasks = output.tasks;
    if (!Array.isArray(tasks)) {
        error('planner output.tasks must be an array');
        return issues;
    }
    if (tasks.length === 0) {
        warn('planner output.tasks is empty');
        return issues;
    }
    const allowedTypes = new Set(['analysis', 'design', 'test', 'implement', 'review']);
    const allowedPriorities = new Set(['critical', 'high', 'medium', 'low']);
    const seenPlanIds = new Set();
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
        }
        else {
            if (seenPlanIds.has(planId))
                error(`Duplicate planner planId: ${planId}`);
            seenPlanIds.add(planId);
        }
        if (!isNonEmptyString(title))
            error(`planner output.tasks[${index}].title must be a non-empty string`);
        if (!isNonEmptyString(type) || !allowedTypes.has(type)) {
            error(`planner output.tasks[${index}].type must be one of: ${Array.from(allowedTypes).join(', ')}`);
        }
        if (typeof priority !== 'undefined') {
            if (!isNonEmptyString(priority) || !allowedPriorities.has(priority)) {
                error(`planner output.tasks[${index}].priority must be one of: ${Array.from(allowedPriorities).join(', ')}`);
            }
        }
        if (typeof raw.dependencies !== 'undefined') {
            const deps = raw.dependencies;
            if (!isStringArray(deps)) {
                error(`planner output.tasks[${index}].dependencies must be an array of strings (when provided)`);
            }
            else {
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
    const error = (message) => issues.push({ level: 'error', message });
    if (!isPlainObject(output)) {
        error('output must be an object for manual-task');
        return issues;
    }
    if (!isNonEmptyString(output.actualWork)) {
        error('manual-task output.actualWork must be a non-empty string');
    }
    return issues;
}
function showHelp() {
    console.log(`
Agent Call Manager - 管理 .codebuddy/agent-calls/

用法:
  node .codebuddy/scripts/agent-call-manager.js <command> [args] [options]

命令:
  list                         列出所有 request（默认）
  show <requestId>             展示某个 request（prompt/result 路径 + result 摘要）
  validate <requestId>         校验 result.json 是否为可消费结构
  serve                        启动 HTTP 服务（远程写回 + 远程 orchestrate/TaskBook 查询，可选）

选项:
  --json                        输出 JSON
  --host <ip>                   serve: 监听地址（默认 127.0.0.1）
  --port <n>                    serve: 监听端口（默认 4317）
  --token <t>                   serve: Bearer Token（可选；启用后除 /health 外都需要认证）
  -h, --help                    显示帮助
`);
}
function parseCli(argv) {
    var _a;
    const args = argv.slice();
    const command = (_a = args.shift()) !== null && _a !== void 0 ? _a : null;
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
    return { command, positionals, flags };
}
function flagAsBool(flags, key) {
    return flags[key] === true;
}
function flagAsString(flags, key) {
    const v = flags[key];
    if (typeof v === 'string')
        return v;
    if (Array.isArray(v))
        return v[0];
    return undefined;
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
    return value.replace(/\\/g, '/');
}
function isSafeRequestId(value) {
    return /^[a-zA-Z0-9._-]+$/.test(value);
}
function isSafeTaskBookId(value) {
    if (!value)
        return false;
    if (value.includes('/') || value.includes('\\'))
        return false;
    if (value.includes('\0'))
        return false;
    if (value === '.' || value === '..')
        return false;
    if (value.includes('..'))
        return false;
    return true;
}
function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
    res.statusCode = statusCode;
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.end(text);
}
function sendJson(res, statusCode, payload) {
    sendText(res, statusCode, JSON.stringify(payload, null, 2), 'application/json; charset=utf-8');
}
function readRequestBody(req, limitBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', chunk => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
            total += buf.length;
            if (total > limitBytes) {
                reject(new Error('payload_too_large'));
                req.destroy();
                return;
            }
            chunks.push(buf);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', err => reject(err));
    });
}
function runNodeScript(scriptPath, args, cwd) {
    var _a, _b;
    const res = (0, child_process_1.spawnSync)(process.execPath, [scriptPath, ...args], {
        cwd,
        encoding: 'utf-8',
        stdio: 'pipe',
    });
    return {
        status: res.status,
        stdout: (_a = res.stdout) !== null && _a !== void 0 ? _a : '',
        stderr: (_b = res.stderr) !== null && _b !== void 0 ? _b : '',
    };
}
function parseAgentCallResult(raw) {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object')
        throw new Error('result.json 必须是 JSON object');
    const obj = parsed;
    const requestId = obj.requestId;
    const kind = obj.kind;
    const status = obj.status;
    if (typeof requestId !== 'string' || !requestId)
        throw new Error('result.json 缺少 requestId');
    if (status !== 'success' && status !== 'failed' && status !== 'blocked') {
        throw new Error("result.json.status 必须是 'success' | 'failed' | 'blocked'");
    }
    return {
        requestId,
        kind: kind === 'planner' || kind === 'manual-task' ? kind : undefined,
        status,
        output: obj.output,
        artifacts: Array.isArray(obj.artifacts) ? obj.artifacts : undefined,
        error: (typeof obj.error === 'object' && obj.error ? obj.error : undefined),
        completedAt: typeof obj.completedAt === 'string' ? obj.completedAt : undefined,
    };
}
function validateAgentCallResultWithPrompt(requestId, promptPath, result) {
    var _a, _b;
    const issues = [];
    if (typeof result.completedAt !== 'undefined' && !isValidDateTime(result.completedAt)) {
        issues.push({ level: 'error', message: 'completedAt must be an ISO date-time string (when provided)' });
    }
    let kind = (_a = result.kind) !== null && _a !== void 0 ? _a : 'unknown';
    if (promptPath && fs.existsSync(promptPath)) {
        const promptRaw = fs.readFileSync(promptPath, 'utf-8');
        const header = parsePromptHeader(promptRaw);
        if (!header.ok) {
            issues.push({ level: 'warning', message: `prompt header invalid: ${header.error}` });
        }
        else {
            const inferred = inferKind(promptRaw, header.header);
            if (kind !== 'unknown' && inferred !== 'unknown' && kind !== inferred) {
                issues.push({ level: 'error', message: `kind mismatch: result=${kind} prompt=${inferred}` });
            }
            if (inferred !== 'unknown')
                kind = inferred;
            if (header.header.requestId !== requestId) {
                issues.push({ level: 'error', message: `prompt header requestId mismatch: ${header.header.requestId}` });
            }
        }
    }
    else {
        issues.push({ level: 'warning', message: 'prompt.md missing; output validation may be limited' });
    }
    if (result.status !== 'success' && !((_b = result.error) === null || _b === void 0 ? void 0 : _b.message)) {
        issues.push({ level: 'warning', message: 'error.message is recommended when status != success' });
    }
    if (result.status === 'success') {
        if (typeof result.completedAt === 'undefined') {
            issues.push({ level: 'warning', message: 'completedAt is recommended when status=success' });
        }
        if (kind === 'planner')
            issues.push(...validatePlannerOutput(result.output));
        else if (kind === 'manual-task')
            issues.push(...validateManualTaskOutput(result.output));
    }
    const ok = issues.every(i => i.level !== 'error');
    return { ok, kind, issues };
}
function ensureTaskbookDirs() {
    ensureDir(path.join(process.cwd(), '.codebuddy', 'taskbooks'));
    ensureDir(TASKBOOKS_ACTIVE_DIR);
    ensureDir(TASKBOOKS_HISTORY_DIR);
}
function listTaskBooksFromDir(dir) {
    if (!fs.existsSync(dir))
        return [];
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const items = [];
    for (const f of files) {
        const filePath = path.join(dir, f);
        try {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (!isPlainObject(raw))
                continue;
            const id = raw.id;
            if (!isNonEmptyString(id))
                continue;
            items.push({
                id,
                title: typeof raw.title === 'string' ? raw.title : undefined,
                status: typeof raw.status === 'string' ? raw.status : undefined,
                taskType: typeof raw.taskType === 'string' ? raw.taskType : undefined,
                revision: typeof raw.revision === 'number' ? raw.revision : undefined,
                createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
                updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
            });
        }
        catch (_a) {
            continue;
        }
    }
    items.sort((a, b) => a.id.localeCompare(b.id));
    return items;
}
function listAgentCalls() {
    var _a;
    ensureDir(AGENT_CALLS_DIR);
    const files = fs.readdirSync(AGENT_CALLS_DIR);
    const requestIds = new Set();
    for (const f of files) {
        const m = f.match(/^(.*)\.(prompt\.md|result\.json)$/);
        if (m)
            requestIds.add(m[1]);
    }
    const items = [];
    for (const requestId of Array.from(requestIds).sort((a, b) => a.localeCompare(b))) {
        const promptPath = path.join(AGENT_CALLS_DIR, `${requestId}.prompt.md`);
        const resultPath = path.join(AGENT_CALLS_DIR, `${requestId}.result.json`);
        const hasPrompt = fs.existsSync(promptPath);
        const hasResult = fs.existsSync(resultPath);
        const item = {
            requestId,
            promptPath,
            resultPath,
            hasPrompt,
            hasResult,
        };
        if (hasResult) {
            try {
                const r = parseAgentCallResult(fs.readFileSync(resultPath, 'utf-8'));
                item.status = r.status;
                item.completedAt = r.completedAt;
                item.errorMessage = (_a = r.error) === null || _a === void 0 ? void 0 : _a.message;
            }
            catch (e) {
                item.status = 'failed';
                item.errorMessage = `invalid result.json: ${(e instanceof Error ? e.message : String(e)).slice(0, 2000)}`;
            }
        }
        items.push(item);
    }
    return items;
}
function main() {
    var _a, _b, _c, _d;
    const parsed = parseCli(process.argv.slice(2));
    const json = flagAsBool(parsed.flags, 'json');
    const command = (_a = parsed.command) !== null && _a !== void 0 ? _a : 'list';
    if (command === 'help' || command === '--help' || command === '-h') {
        showHelp();
        process.exit(0);
    }
    try {
        switch (command) {
            case 'list': {
                const items = listAgentCalls();
                if (json) {
                    printJson(items);
                }
                else {
                    if (items.length === 0) {
                        console.log('[AgentCall] empty');
                        break;
                    }
                    console.log('[AgentCall] list:');
                    for (const it of items) {
                        const s = (_b = it.status) !== null && _b !== void 0 ? _b : (it.hasResult ? 'unknown' : 'pending');
                        console.log(`- ${it.requestId} | ${s} | prompt=${it.hasPrompt ? 'y' : 'n'} result=${it.hasResult ? 'y' : 'n'}`);
                    }
                }
                break;
            }
            case 'show': {
                const requestId = parsed.positionals[0];
                if (!requestId) {
                    console.error('错误: show 需要 <requestId>');
                    process.exit(1);
                }
                const promptPath = path.join(AGENT_CALLS_DIR, `${requestId}.prompt.md`);
                const resultPath = path.join(AGENT_CALLS_DIR, `${requestId}.result.json`);
                const payload = {
                    requestId,
                    promptPath,
                    resultPath,
                    hasPrompt: fs.existsSync(promptPath),
                    hasResult: fs.existsSync(resultPath),
                };
                if (fs.existsSync(resultPath)) {
                    const r = parseAgentCallResult(fs.readFileSync(resultPath, 'utf-8'));
                    payload.result = r;
                }
                if (json)
                    printJson(payload);
                else {
                    console.log(`[AgentCall] ${requestId}`);
                    console.log(`prompt: ${promptPath}`);
                    console.log(`result: ${resultPath}`);
                    if (payload.result) {
                        const r = payload.result;
                        console.log(`status: ${r.status}`);
                        if (r.completedAt)
                            console.log(`completedAt: ${r.completedAt}`);
                        if ((_c = r.error) === null || _c === void 0 ? void 0 : _c.message)
                            console.log(`error: ${r.error.message}`);
                    }
                }
                break;
            }
            case 'validate': {
                const requestId = parsed.positionals[0];
                if (!requestId) {
                    console.error('错误: validate 需要 <requestId>');
                    process.exit(1);
                }
                const promptPath = path.join(AGENT_CALLS_DIR, `${requestId}.prompt.md`);
                const resultPath = path.join(AGENT_CALLS_DIR, `${requestId}.result.json`);
                if (!fs.existsSync(resultPath)) {
                    console.error(`错误: result.json 不存在: ${resultPath}`);
                    process.exit(1);
                }
                const r = parseAgentCallResult(fs.readFileSync(resultPath, 'utf-8'));
                if (r.requestId !== requestId) {
                    throw new Error(`requestId mismatch: expected ${requestId}, got ${r.requestId}`);
                }
                const validation = validateAgentCallResultWithPrompt(requestId, promptPath, r);
                const payload = { ok: validation.ok, requestId, kind: validation.kind, status: r.status, completedAt: r.completedAt, issues: validation.issues };
                if (json) {
                    printJson(payload);
                    process.exit(validation.ok ? 0 : 1);
                }
                else {
                    const kindSuffix = validation.kind !== 'unknown' ? `/${validation.kind}` : '';
                    if (validation.ok) {
                        console.log(`[AgentCall] OK: ${requestId} (${r.status}${kindSuffix})`);
                        break;
                    }
                    console.error(`[AgentCall] INVALID: ${requestId} (${r.status}${kindSuffix})`);
                    for (const i of validation.issues) {
                        const prefix = i.level === 'error' ? 'ERROR' : 'WARN ';
                        console.error(`${prefix} ${i.message}`);
                    }
                    process.exit(1);
                }
            }
            case 'serve': {
                const host = (_d = flagAsString(parsed.flags, 'host')) !== null && _d !== void 0 ? _d : DEFAULT_HOST;
                const portRaw = flagAsString(parsed.flags, 'port');
                const token = flagAsString(parsed.flags, 'token');
                const port = typeof portRaw === 'string' ? Number.parseInt(portRaw, 10) : DEFAULT_PORT;
                if (!Number.isFinite(port) || port < 0 || port > 65535) {
                    throw new Error(`invalid --port: ${portRaw !== null && portRaw !== void 0 ? portRaw : ''}`);
                }
                ensureDir(AGENT_CALLS_DIR);
                const server = http.createServer((req, res) => {
                    const handle = async () => {
                        var _a, _b, _c;
                        const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : '/', 'http://localhost');
                        if (url.pathname !== '/health' && token) {
                            const auth = String((_b = req.headers.authorization) !== null && _b !== void 0 ? _b : '');
                            if (auth !== `Bearer ${token}`) {
                                sendJson(res, 401, { ok: false, error: 'unauthorized' });
                                return;
                            }
                        }
                        if (req.method === 'GET' && url.pathname === '/health') {
                            sendJson(res, 200, { ok: true, now: new Date().toISOString() });
                            return;
                        }
                        if (req.method === 'GET' && url.pathname === '/taskbooks') {
                            ensureTaskbookDirs();
                            const active = listTaskBooksFromDir(TASKBOOKS_ACTIVE_DIR);
                            const history = listTaskBooksFromDir(TASKBOOKS_HISTORY_DIR);
                            sendJson(res, 200, { ok: true, active, history });
                            return;
                        }
                        const tbMatch = url.pathname.match(/^\/taskbooks\/(.+)$/);
                        if (req.method === 'GET' && tbMatch) {
                            ensureTaskbookDirs();
                            const rawId = decodeURIComponent(tbMatch[1]);
                            const taskBookId = rawId.endsWith('.json') ? rawId.slice(0, -'.json'.length) : rawId;
                            if (!isSafeTaskBookId(taskBookId)) {
                                sendJson(res, 400, { ok: false, error: 'invalid_taskbook_id' });
                                return;
                            }
                            const activePath = path.join(TASKBOOKS_ACTIVE_DIR, `${taskBookId}.json`);
                            const historyPath = path.join(TASKBOOKS_HISTORY_DIR, `${taskBookId}.json`);
                            if (fs.existsSync(activePath)) {
                                sendJson(res, 200, { ok: true, location: 'active', taskBook: JSON.parse(fs.readFileSync(activePath, 'utf-8')) });
                                return;
                            }
                            if (fs.existsSync(historyPath)) {
                                sendJson(res, 200, { ok: true, location: 'history', taskBook: JSON.parse(fs.readFileSync(historyPath, 'utf-8')) });
                                return;
                            }
                            sendJson(res, 404, { ok: false, error: 'taskbook_not_found' });
                            return;
                        }
                        if (req.method === 'POST' && url.pathname === '/orchestrate') {
                            const orchestratorPath = path.join(CODEBUDDY_SCRIPTS_DIR, 'task-orchestrator.js');
                            if (!fs.existsSync(orchestratorPath)) {
                                sendJson(res, 500, { ok: false, error: 'missing_script', script: toPosixPath(path.relative(process.cwd(), orchestratorPath)) });
                                return;
                            }
                            let bodyText = '';
                            try {
                                bodyText = await readRequestBody(req, MAX_BODY_BYTES);
                            }
                            catch (e) {
                                const code = e instanceof Error ? e.message : String(e);
                                if (code === 'payload_too_large') {
                                    sendJson(res, 413, { ok: false, error: 'payload_too_large' });
                                    return;
                                }
                                sendJson(res, 400, { ok: false, error: 'read_body_failed', message: code });
                                return;
                            }
                            let payload;
                            try {
                                payload = bodyText ? JSON.parse(bodyText) : {};
                            }
                            catch (e) {
                                sendJson(res, 400, { ok: false, error: 'invalid_json', message: e instanceof Error ? e.message : String(e) });
                                return;
                            }
                            if (!isPlainObject(payload)) {
                                sendJson(res, 400, { ok: false, error: 'invalid_payload', message: 'payload must be a JSON object' });
                                return;
                            }
                            const requestId = payload.requestId;
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
                            const allowedTypes = new Set(['new-feature', 'refactoring', 'debugging', 'testing', 'code-review']);
                            const args = [];
                            if (isNonEmptyString(taskBookId)) {
                                args.push('--taskbook', taskBookId);
                            }
                            else if (isNonEmptyString(requirement)) {
                                args.push(requirement);
                                if (typeof type === 'undefined') {
                                    args.push('--type', 'new-feature');
                                }
                                else if (isNonEmptyString(type) && allowedTypes.has(type)) {
                                    args.push('--type', type);
                                }
                                else {
                                    sendJson(res, 400, { ok: false, error: 'invalid_type' });
                                    return;
                                }
                            }
                            else if (isNonEmptyString(title) && isNonEmptyString(description)) {
                                args.push('--title', title, '--description', description);
                                if (typeof type === 'undefined') {
                                    args.push('--type', 'new-feature');
                                }
                                else if (isNonEmptyString(type) && allowedTypes.has(type)) {
                                    args.push('--type', type);
                                }
                                else {
                                    sendJson(res, 400, { ok: false, error: 'invalid_type' });
                                    return;
                                }
                            }
                            else {
                                sendJson(res, 400, { ok: false, error: 'missing_input', message: 'requirement 或 taskBookId 或 (title+description) 必填其一' });
                                return;
                            }
                            if (tasksOnly === true)
                                args.push('--tasks-only');
                            if (noAutoConfirm === true)
                                args.push('--no-auto-confirm');
                            if (stopAfterPlan === true)
                                args.push('--stop-after-plan');
                            if (isNonEmptyString(workflowPath))
                                args.push('--workflow', workflowPath);
                            if (watch === true)
                                args.push('--watch');
                            if (typeof watchPollMs === 'number' && Number.isFinite(watchPollMs) && watchPollMs > 0) {
                                args.push('--watch-poll-ms', String(watchPollMs));
                            }
                            if (typeof watchTimeoutMs === 'number' && Number.isFinite(watchTimeoutMs) && watchTimeoutMs >= 0) {
                                args.push('--watch-timeout-ms', String(watchTimeoutMs));
                            }
                            if (isStringArray(approve)) {
                                for (const gateId of approve.filter(isNonEmptyString)) {
                                    args.push('--approve', gateId);
                                }
                            }
                            if (typeof maxParallel === 'number' && Number.isFinite(maxParallel) && maxParallel > 0) {
                                args.push('--max-parallel', String(maxParallel));
                            }
                            if (isNonEmptyString(requestId)) {
                                args.push('--request-id', requestId);
                            }
                            args.push('--json');
                            const startedAt = new Date().toISOString();
                            const run = runNodeScript(orchestratorPath, args, process.cwd());
                            const finishedAt = new Date().toISOString();
                            let outcome = null;
                            if (run.stdout.trim().length > 0) {
                                try {
                                    outcome = JSON.parse(run.stdout);
                                }
                                catch (_d) {
                                    outcome = { raw: run.stdout };
                                }
                            }
                            sendJson(res, 200, {
                                ok: true,
                                exitCode: run.status,
                                startedAt,
                                finishedAt,
                                outcome,
                                stderr: run.stderr ? run.stderr.slice(0, 20000) : '',
                            });
                            return;
                        }
                        if (req.method === 'GET' && url.pathname === '/agent-calls') {
                            sendJson(res, 200, { ok: true, items: listAgentCalls() });
                            return;
                        }
                        const m = url.pathname.match(/^\/agent-calls\/([^/]+)(?:\/(prompt|result))?$/);
                        if (!m) {
                            sendJson(res, 404, { ok: false, error: 'not_found' });
                            return;
                        }
                        const requestId = decodeURIComponent(m[1]);
                        const action = (_c = m[2]) !== null && _c !== void 0 ? _c : null;
                        if (!isSafeRequestId(requestId)) {
                            sendJson(res, 400, { ok: false, error: 'invalid_request_id' });
                            return;
                        }
                        const promptPath = path.join(AGENT_CALLS_DIR, `${requestId}.prompt.md`);
                        const resultPath = path.join(AGENT_CALLS_DIR, `${requestId}.result.json`);
                        if (!action) {
                            if (req.method !== 'GET') {
                                sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
                                return;
                            }
                            const payload = {
                                ok: true,
                                requestId,
                                promptPath: toPosixPath(path.relative(process.cwd(), promptPath)),
                                resultPath: toPosixPath(path.relative(process.cwd(), resultPath)),
                                hasPrompt: fs.existsSync(promptPath),
                                hasResult: fs.existsSync(resultPath),
                            };
                            if (fs.existsSync(resultPath)) {
                                try {
                                    payload.result = parseAgentCallResult(fs.readFileSync(resultPath, 'utf-8'));
                                }
                                catch (e) {
                                    payload.resultError = e instanceof Error ? e.message : String(e);
                                }
                            }
                            sendJson(res, 200, payload);
                            return;
                        }
                        if (action === 'prompt') {
                            if (req.method !== 'GET') {
                                sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
                                return;
                            }
                            if (!fs.existsSync(promptPath)) {
                                sendJson(res, 404, { ok: false, error: 'prompt_not_found' });
                                return;
                            }
                            sendText(res, 200, fs.readFileSync(promptPath, 'utf-8'), 'text/markdown; charset=utf-8');
                            return;
                        }
                        if (action === 'result') {
                            if (req.method === 'GET') {
                                if (!fs.existsSync(resultPath)) {
                                    sendJson(res, 404, { ok: false, error: 'result_not_found' });
                                    return;
                                }
                                const raw = fs.readFileSync(resultPath, 'utf-8');
                                try {
                                    const parsed = JSON.parse(raw);
                                    sendJson(res, 200, { ok: true, result: parsed });
                                }
                                catch (e) {
                                    sendJson(res, 200, { ok: true, raw });
                                }
                                return;
                            }
                            if (req.method === 'PUT' || req.method === 'POST') {
                                let bodyText = '';
                                try {
                                    bodyText = await readRequestBody(req, MAX_BODY_BYTES);
                                }
                                catch (e) {
                                    const code = e instanceof Error ? e.message : String(e);
                                    if (code === 'payload_too_large') {
                                        sendJson(res, 413, { ok: false, error: 'payload_too_large' });
                                        return;
                                    }
                                    sendJson(res, 400, { ok: false, error: 'read_body_failed', message: code });
                                    return;
                                }
                                let result;
                                try {
                                    result = parseAgentCallResult(bodyText);
                                }
                                catch (e) {
                                    sendJson(res, 400, { ok: false, error: 'invalid_result_json', message: e instanceof Error ? e.message : String(e) });
                                    return;
                                }
                                if (result.requestId !== requestId) {
                                    sendJson(res, 400, { ok: false, error: 'request_id_mismatch', expected: requestId, got: result.requestId });
                                    return;
                                }
                                const validation = validateAgentCallResultWithPrompt(requestId, fs.existsSync(promptPath) ? promptPath : null, result);
                                if (!validation.ok) {
                                    sendJson(res, 400, { ok: false, error: 'validation_failed', requestId, kind: validation.kind, issues: validation.issues });
                                    return;
                                }
                                fs.writeFileSync(resultPath, JSON.stringify(JSON.parse(bodyText), null, 2), 'utf-8');
                                sendJson(res, 200, {
                                    ok: true,
                                    requestId,
                                    kind: validation.kind,
                                    written: true,
                                    resultPath: toPosixPath(path.relative(process.cwd(), resultPath)),
                                    issues: validation.issues,
                                });
                                return;
                            }
                            sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
                            return;
                        }
                        sendJson(res, 404, { ok: false, error: 'not_found' });
                    };
                    handle().catch(err => {
                        sendJson(res, 500, { ok: false, error: 'internal_error', message: err instanceof Error ? err.message : String(err) });
                    });
                });
                server.on('error', err => {
                    const msg = err instanceof Error ? err.message : String(err);
                    if (json)
                        printJson({ ok: false, error: msg });
                    else
                        console.error(msg);
                    process.exit(1);
                });
                server.listen(port, host, () => {
                    const addr = server.address();
                    const actualPort = typeof addr === 'object' && addr ? addr.port : port;
                    const baseUrl = `http://${host}:${actualPort}`;
                    const payload = {
                        ok: true,
                        host,
                        port: actualPort,
                        baseUrl,
                        tokenEnabled: Boolean(token),
                        agentCallsDir: toPosixPath(path.relative(process.cwd(), AGENT_CALLS_DIR)),
                        endpoints: {
                            health: '/health',
                            taskbooks: '/taskbooks',
                            taskbook: '/taskbooks/:taskBookId',
                            orchestrate: '/orchestrate',
                            list: '/agent-calls',
                            show: '/agent-calls/:requestId',
                            prompt: '/agent-calls/:requestId/prompt',
                            result: '/agent-calls/:requestId/result',
                        },
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
                        console.log('[AgentCall] auth: Authorization: Bearer <token>');
                    }
                });
                break;
            }
            default: {
                console.error(`未知命令: ${command}`);
                showHelp();
                process.exit(1);
            }
        }
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (json)
            printJson({ ok: false, error: msg });
        else
            console.error(msg);
        process.exit(1);
    }
}
if ((0, cli_entry_1.isDirectCliEntry)('agent-call-manager.js')) {
    main();
}
