import { spawnSync } from 'child_process';
import { AgentContext } from '../types/agent-runtime';
import { TaskItem } from '../types';

export const WORKER_COMMAND_ENV = 'CODEBUDDY_WORKER_COMMAND';
export const WORKER_TIMEOUT_ENV = 'CODEBUDDY_WORKER_TIMEOUT_MS';
const DEFAULT_WORKER_TIMEOUT_MS = 10 * 60 * 1000;

export interface WorkerExecutionPayload {
  requestId: string;
  taskBookId: string;
  agentId: string;
  projectRoot: string;
  prompt: string;
  task: TaskItem;
  context: AgentContext;
}

export type WorkerExecutionStatus = 'success' | 'blocked' | 'failed' | 'unavailable';

export interface WorkerExecutionResult {
  status: WorkerExecutionStatus;
  actualWork?: string;
  artifacts?: Array<{ type: string; path: string }>;
  completedAt?: string;
  error?: string;
}

export interface WorkerExecutor {
  describe(): string;
  execute(payload: WorkerExecutionPayload): WorkerExecutionResult;
}

export function createConfiguredWorkerExecutor(env: NodeJS.ProcessEnv = process.env): WorkerExecutor | null {
  const command = String(env[WORKER_COMMAND_ENV] ?? '').trim();
  if (!command) return null;

  const parsedTimeout = Number.parseInt(String(env[WORKER_TIMEOUT_ENV] ?? DEFAULT_WORKER_TIMEOUT_MS), 10);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : DEFAULT_WORKER_TIMEOUT_MS;

  return new CommandWorkerExecutor(command, timeoutMs);
}

class CommandWorkerExecutor implements WorkerExecutor {
  constructor(
    private readonly command: string,
    private readonly timeoutMs: number,
  ) {}

  describe(): string {
    return `command:${this.command}`;
  }

  execute(payload: WorkerExecutionPayload): WorkerExecutionResult {
    const rawInput = JSON.stringify(payload, null, 2);
    const res = spawnSync(this.command, [], {
      cwd: payload.projectRoot,
      shell: true,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      input: rawInput,
      timeout: this.timeoutMs,
    });

    if (res.error) {
      const message = res.error.message || String(res.error);
      const status: WorkerExecutionStatus = /timeout/i.test(message) ? 'blocked' : 'unavailable';
      return { status, error: `worker spawn failed: ${message}` };
    }

    if (res.status !== 0) {
      const stderr = String(res.stderr ?? '').trim();
      const stdout = String(res.stdout ?? '').trim();
      const detail = truncateMessage(stderr || stdout || `exit=${String(res.status ?? 'null')}`);
      return {
        status: 'blocked',
        error: `worker exited with code ${String(res.status ?? 'null')}: ${detail}`,
      };
    }

    const stdout = String(res.stdout ?? '').trim();
    if (!stdout) {
      return { status: 'failed', error: 'worker returned empty stdout' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: 'failed',
        error: `worker stdout is not valid JSON: ${message}`,
      };
    }

    return normalizeWorkerResult(parsed, payload.requestId);
  }
}

function normalizeWorkerResult(parsed: unknown, expectedRequestId: string): WorkerExecutionResult {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 'failed', error: 'worker result must be a JSON object' };
  }

  const data = parsed as Record<string, unknown>;
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

function normalizeStatus(status: unknown): Exclude<WorkerExecutionStatus, 'unavailable'> | null {
  if (status === 'success' || status === 'blocked' || status === 'failed') return status;
  if (status === 'error') return 'failed';
  return null;
}

function extractActualWork(data: Record<string, unknown>): string | null {
  if (typeof data.actualWork === 'string' && data.actualWork.trim()) {
    return data.actualWork.trim();
  }

  const output = data.output;
  if (!output || typeof output !== 'object' || Array.isArray(output)) return null;
  const actualWork = (output as Record<string, unknown>).actualWork;
  if (typeof actualWork !== 'string' || !actualWork.trim()) return null;
  return actualWork.trim();
}

function extractErrorMessage(data: Record<string, unknown>): string | null {
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }

  const error = data.error;
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (!error || typeof error !== 'object' || Array.isArray(error)) return null;
  const message = (error as Record<string, unknown>).message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}

function parseArtifacts(raw: unknown): Array<{ type: string; path: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;

  const parsed = raw
    .map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const type = typeof record.type === 'string' ? record.type.trim() : '';
      const filePath = typeof record.path === 'string' ? record.path.trim() : '';
      if (!type || !filePath) return null;
      return { type, path: filePath };
    })
    .filter((item): item is { type: string; path: string } => Boolean(item));

  return parsed.length > 0 ? parsed : undefined;
}

function truncateMessage(message: string, maxLength: number = 500): string {
  const trimmed = message.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}
