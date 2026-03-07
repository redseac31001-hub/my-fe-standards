# Worker Executor

## Purpose

`Worker Executor` lets `task-executor` hand an `AgentRuntime` rendered prompt to an external command for automatic execution.

If the worker succeeds, the task is marked `done` directly.

If the worker is missing or returns a non-success result, the existing `MANUAL_REQUIRED -> agent-call` fallback still applies.

## Configuration

- `CODEBUDDY_WORKER_COMMAND`
  - Required to enable automatic execution.
  - The command is started with `shell=true`.
  - The current project root is used as `cwd`.
- `CODEBUDDY_WORKER_TIMEOUT_MS`
  - Optional.
  - Defaults to `600000` (`10` minutes).

Example:

```bash
set CODEBUDDY_WORKER_COMMAND=node .mock-worker.js
set CODEBUDDY_WORKER_TIMEOUT_MS=900000
node .codebuddy/scripts/task-executor.js <taskBookId> --tasks-only
```

## Input Contract

The worker receives a JSON payload on `stdin`:

```json
{
  "requestId": "req-task-1-abcdef1234",
  "taskBookId": "tb_xxx",
  "agentId": "tdd-driver",
  "projectRoot": "E:/project",
  "prompt": "...rendered prompt...",
  "task": {},
  "context": {}
}
```

Important fields:

- `requestId`: stable per `taskBookId + taskId`
- `agentId`: selected execution agent
- `prompt`: final rendered prompt from `AgentRuntime`
- `task`: current task snapshot
- `context`: injected reports/files context

## Output Contract

The worker must write a JSON object to `stdout`.

Success:

```json
{
  "requestId": "req-task-1-abcdef1234",
  "status": "success",
  "output": {
    "actualWork": "Implemented feature X and verified with npm test."
  },
  "artifacts": [
    { "type": "report", "path": ".codebuddy/reports/worker/result.json" }
  ],
  "completedAt": "2026-03-07T12:00:00.000Z"
}
```

Failure or blocked:

```json
{
  "requestId": "req-task-1-abcdef1234",
  "status": "blocked",
  "error": {
    "message": "Provider unavailable"
  }
}
```

Accepted statuses:

- `success`
- `blocked`
- `failed`

On `success`, `output.actualWork` is required.

## Runtime Behavior

1. `task-executor` renders a prompt with `AgentRuntime`
2. If `CODEBUDDY_WORKER_COMMAND` is configured, it sends the payload to the worker
3. On `success`, the task is completed directly and a `worker-executor` changelog event is recorded
4. On `blocked` / `failed` / spawn failure, execution falls back to the normal `agent-call` manual path

## Recommended First Backend

Use an external command wrapper first.

Reasons:

- no provider lock-in
- no SDK coupling inside `task-executor`
- easy to replace with Codex / Claude / internal model runners later
