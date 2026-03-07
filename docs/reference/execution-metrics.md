# Execution Metrics

This document defines the first metrics layer for the execution pipeline.

## Goal

Capture enough data to answer:

- which task types complete successfully
- which paths block most often
- whether `worker-executor` actually reduces manual fallback
- how many tasks resume through `agent-call`

## Storage

Metrics are written inside the business project:

- `.codebuddy/reports/metrics/execution-events.jsonl`
- `.codebuddy/reports/metrics/latest-summary.json`

The system remains local-first. No remote service is required.

## Event Log

`execution-events.jsonl` is append-only JSON Lines.

Current event types:

- `task_started`
- `task_completed`
- `task_blocked`
- `task_failed`
- `agent_call_created`
- `agent_call_applied`

Common fields:

- `taskBookId`
- `taskId`
- `taskType`
- `taskTitle`
- `executionMode`
- `agentId`
- `requestId`
- `status`
- `durationMs`
- `blockedReasonCode`
- `blockedReason`
- `recordedAt`

## Summary File

`latest-summary.json` is the current aggregate snapshot.

Key counters:

- `totals.started`
- `totals.completed`
- `totals.blocked`
- `totals.failed`
- `totals.resumed`
- `totals.agentCallsCreated`
- `totals.agentCallsApplied`
- `totals.workerExecutions`

Key breakdowns:

- `byTaskType`
- `byExecutionMode`
- `blockedReasons`

## Current Hook Points

Metrics are recorded at these points:

1. `task-executor`
   - task start
   - task success
   - task blocked
   - task failed
2. `task-executor.ensureManualTaskAgentCall()`
   - agent-call prompt creation
3. `task-executor.tryAutoApplyAgentCallResults()`
   - agent-call success apply / resume

## Current Scope

This first version does not try to solve everything.

Not included yet:

- loader install timing metrics
- remote download metrics
- provider/model cost accounting
- dashboard or visualization layer
- cross-project aggregation

## How To Inspect

Examples:

```powershell
Get-Content -Raw -Encoding UTF8 .codebuddy/reports/metrics/latest-summary.json
Get-Content .codebuddy/reports/metrics/execution-events.jsonl
```

## Design Notes

- Keep the schema small and append-only.
- Prefer execution facts over inferred analytics.
- Add new event types only when they answer a real operational question.
