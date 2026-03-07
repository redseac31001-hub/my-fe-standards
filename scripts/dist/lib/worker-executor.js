"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKER_TIMEOUT_ENV = exports.WORKER_COMMAND_ENV = void 0;
exports.createConfiguredWorkerExecutor = createConfiguredWorkerExecutor;
const child_process_1 = require("child_process");
exports.WORKER_COMMAND_ENV = 'CODEBUDDY_WORKER_COMMAND';
exports.WORKER_TIMEOUT_ENV = 'CODEBUDDY_WORKER_TIMEOUT_MS';
const DEFAULT_WORKER_TIMEOUT_MS = 10 * 60 * 1000;
function createConfiguredWorkerExecutor(env = process.env) {
    var _a, _b;
    const command = String((_a = env[exports.WORKER_COMMAND_ENV]) !== null && _a !== void 0 ? _a : '').trim();
    if (!command)
        return null;
    const parsedTimeout = Number.parseInt(String((_b = env[exports.WORKER_TIMEOUT_ENV]) !== null && _b !== void 0 ? _b : DEFAULT_WORKER_TIMEOUT_MS), 10);
    const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
        ? parsedTimeout
        : DEFAULT_WORKER_TIMEOUT_MS;
    return new CommandWorkerExecutor(command, timeoutMs);
}
class CommandWorkerExecutor {
    constructor(command, timeoutMs) {
        this.command = command;
        this.timeoutMs = timeoutMs;
    }
    describe() {
        return `command:${this.command}`;
    }
    execute(payload) {
        var _a, _b, _c, _d, _e;
        const rawInput = JSON.stringify(payload, null, 2);
        const res = (0, child_process_1.spawnSync)(this.command, [], {
            cwd: payload.projectRoot,
            shell: true,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            input: rawInput,
            timeout: this.timeoutMs,
        });
        if (res.error) {
            const message = res.error.message || String(res.error);
            const status = /timeout/i.test(message) ? 'blocked' : 'unavailable';
            return { status, error: `worker spawn failed: ${message}` };
        }
        if (res.status !== 0) {
            const stderr = String((_a = res.stderr) !== null && _a !== void 0 ? _a : '').trim();
            const stdout = String((_b = res.stdout) !== null && _b !== void 0 ? _b : '').trim();
            const detail = truncateMessage(stderr || stdout || `exit=${String((_c = res.status) !== null && _c !== void 0 ? _c : 'null')}`);
            return {
                status: 'blocked',
                error: `worker exited with code ${String((_d = res.status) !== null && _d !== void 0 ? _d : 'null')}: ${detail}`,
            };
        }
        const stdout = String((_e = res.stdout) !== null && _e !== void 0 ? _e : '').trim();
        if (!stdout) {
            return { status: 'failed', error: 'worker returned empty stdout' };
        }
        let parsed;
        try {
            parsed = JSON.parse(stdout);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                status: 'failed',
                error: `worker stdout is not valid JSON: ${message}`,
            };
        }
        return normalizeWorkerResult(parsed, payload.requestId);
    }
}
function normalizeWorkerResult(parsed, expectedRequestId) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { status: 'failed', error: 'worker result must be a JSON object' };
    }
    const data = parsed;
    const rawRequestId = data.requestId;
    if (typeof rawRequestId === 'string' && rawRequestId.trim() && rawRequestId !== expectedRequestId) {
        return {
            status: 'failed',
            error: `worker result requestId mismatch: expected=${expectedRequestId} actual=${rawRequestId}`,
        };
    }
    const normalizedStatus = normalizeStatus(data.status);
    if (!normalizedStatus) {
        return { status: 'failed', error: 'worker result.status must be success | blocked | failed' };
    }
    if (normalizedStatus === 'success') {
        const actualWork = extractActualWork(data);
        if (!actualWork) {
            return { status: 'failed', error: 'worker success result must include output.actualWork or actualWork' };
        }
        return {
            status: 'success',
            actualWork,
            artifacts: parseArtifacts(data.artifacts),
            completedAt: typeof data.completedAt === 'string' ? data.completedAt : undefined,
        };
    }
    return {
        status: normalizedStatus,
        error: extractErrorMessage(data) || `worker reported status=${normalizedStatus}`,
        artifacts: parseArtifacts(data.artifacts),
        completedAt: typeof data.completedAt === 'string' ? data.completedAt : undefined,
    };
}
function normalizeStatus(status) {
    if (status === 'success' || status === 'blocked' || status === 'failed')
        return status;
    if (status === 'error')
        return 'failed';
    return null;
}
function extractActualWork(data) {
    if (typeof data.actualWork === 'string' && data.actualWork.trim()) {
        return data.actualWork.trim();
    }
    const output = data.output;
    if (!output || typeof output !== 'object' || Array.isArray(output))
        return null;
    const actualWork = output.actualWork;
    if (typeof actualWork !== 'string' || !actualWork.trim())
        return null;
    return actualWork.trim();
}
function extractErrorMessage(data) {
    if (typeof data.message === 'string' && data.message.trim()) {
        return data.message.trim();
    }
    const error = data.error;
    if (typeof error === 'string' && error.trim()) {
        return error.trim();
    }
    if (!error || typeof error !== 'object' || Array.isArray(error))
        return null;
    const message = error.message;
    return typeof message === 'string' && message.trim() ? message.trim() : null;
}
function parseArtifacts(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const parsed = raw
        .map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return null;
        const record = item;
        const type = typeof record.type === 'string' ? record.type.trim() : '';
        const filePath = typeof record.path === 'string' ? record.path.trim() : '';
        if (!type || !filePath)
            return null;
        return { type, path: filePath };
    })
        .filter((item) => Boolean(item));
    return parsed.length > 0 ? parsed : undefined;
}
function truncateMessage(message, maxLength = 500) {
    const trimmed = message.trim();
    if (trimmed.length <= maxLength)
        return trimmed;
    return `${trimmed.slice(0, maxLength)}...`;
}
