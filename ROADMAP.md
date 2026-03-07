# ROADMAP

> Last updated: 2026-03-07
> Type: living roadmap
> Scope: loader, skills, agents, orchestrator, execution layer

## Related Documents

- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)

## How To Use This File

This file is no longer just a static plan. It is the single place to track:

- current priority
- execution status
- next action
- completion criteria
- follow-up notes

Update this file whenever a roadmap item changes state.

## Status Legend

- `TODO`: not started
- `IN_PROGRESS`: currently being executed
- `DONE`: completed and verified
- `BLOCKED`: cannot continue until a dependency or decision is resolved
- `DEFERRED`: intentionally postponed

## Update Rules

### Before starting a task

- Change `Status` to `IN_PROGRESS`
- Fill `Started`
- Update `Next Action`
- Add a short note if scope changed

### After finishing a task

- Change `Status` to `DONE`
- Fill `Completed`
- Record the key validation commands that passed
- Update the next dependent task if priority changed

### If a task is blocked

- Change `Status` to `BLOCKED`
- Fill `Blocked By`
- Add the exact decision or dependency required to resume

## Current Baseline

The current version has already completed the protocol and structure cleanup stage:

- Skill frontmatter, validator, packaging, and runtime consumption are aligned.
- Agent frontmatter parsing is aligned across metadata parser, registry, and runtime.
- Monolithic skills have been split into progressive-disclosure structures.
- `prd` and `ralph-converter` already support executable scripts.
- `task-orchestrator`, `task-executor`, `agent-call`, and `TaskBook` pass end-to-end integration tests.

Current strategic focus:

- make the loader lighter
- make install and sync easier to operate
- preserve local file-based knowledge delivery
- keep the current single-worker execution path stable
- defer weak-model/strong-model routing until it becomes a real requirement

## Global Done Criteria

Each roadmap item should be considered complete only if all of the following pass:

- `npm run build`
- `node scripts/dist/skill-validator.js check`
- `node test/run-tests.js`

If an item changes packaging or skill lifecycle behavior, also verify:

- `python custom-skills/skill-creator/scripts/quick_validate.py <skill>`
- `python custom-skills/skill-creator/scripts/package_skill.py <skill> <output-dir>`

## Current Snapshot

| Item | Status | Priority | Estimate | Goal | Next Action |
|------|--------|----------|----------|------|-------------|
| P1 Script Bundling | DONE | Highest | M | Reduce script count and simplify distribution | Move to `P2 Installation State File` schema design |
| P2 Installation State File | DONE | High | S | Make installed state observable | Move to `P3 Incremental Sync` hash and ownership design |
| P3 Incremental Sync | DONE | High | M | Avoid full-copy install on every run | Move to `P4 Management Commands` CLI surface design |
| P4 Management Commands | DONE | High | M | Improve installation and diagnosis ergonomics | Move to `P5 Distribution Profiles` boundary definition |
| P5 Distribution Profiles | DONE | High | M | Install only required runtime subsets | Move to `P6 Remote Content Pack` archive design |
| P6 Remote Content Pack | DONE | Medium | M | Reduce remote request count | Move to `P7 Worker Executor` interface design |
| P7 Worker Executor | DONE | Medium | L | Convert rendered prompt into real execution | Observability baseline is now in place via `P9` |
| P8 Model Router | DEFERRED | Medium | L | Split cheap routing from expensive implementation | Revisit only if multi-tier model routing becomes necessary |
| P9 Evaluation and Metrics | DONE | Medium | M | Measure failure points and optimization impact | Extend metrics only when a concrete operational question appears |

## Milestone 1: Loader Consolidation

### P1. Script Bundling

- Status: DONE
- Priority: Highest
- Estimate: M
- Started: 2026-03-06
- Completed: 2026-03-06
- Blocked By:
- Goal: reduce `.codebuddy/scripts/` file count and simplify runtime dependencies in business projects.
- Why Now: this is the highest ROI improvement for the current loading problem.
- Deliverables:
  - self-contained validator entry bundles
  - self-contained analysis entry bundles
  - self-contained orchestrator entry bundles
  - simplified loader distribution map without helper-file fan-out
- Acceptance:
  - Business-project distributed script count drops significantly.
  - Existing orchestrator mode still works without missing dependency issues.
  - Build and end-to-end tests remain green.
- Next Action: start `P2 Installation State File`.
- Notes:
  - Start with the lowest-risk path first.
  - Do not bundle skill, agent, or rule content files; bundle runtime scripts only.
  - Preserve existing user-facing script entry names unless there is a strong reason to change them.
  - Inventory baseline is recorded in `docs/loader-script-inventory.md`.

#### P1 Execution Breakdown

| Subtask | Status | Goal | Exit Criteria |
|---------|--------|------|---------------|
| P1.1 Script Inventory | DONE | List all distributed scripts and who depends on them | A complete distribution/dependency table exists |
| P1.2 Entry Point Freeze | DONE | Decide which CLI names must remain stable in business projects | Stable entry list is recorded before bundling starts |
| P1.3 Validators Bundle | DONE | Convert validator-oriented scripts into self-contained entry bundles | Bundled validator entrypoints work and existing validation commands still pass |
| P1.4 Analysis Bundle | DONE | Convert analysis-oriented scripts into self-contained entry bundles | Analysis entrypoints work and preserved CLI commands still pass |
| P1.5 Orchestrator Bundle | DONE | Convert orchestrator-oriented scripts into self-contained entry bundles | Orchestrator entrypoints work and preserved CLI commands still pass |
| P1.6 Loader Distribution Update | DONE | Change loader distribution map to ship bundles instead of fragmented scripts | Business-project script count is reduced and no dependency is missing |
| P1.7 Regression Sweep | DONE | Re-run build, validators, and end-to-end tests after bundling | All required verification commands are green |

#### P1 Working Notes

- Preferred implementation order:
  1. validator entry bundles
  2. `analysis-tools.js`
  3. `orchestrator-runtime.js`
- Reason:
  - validators are the most independent
  - analysis tools are moderately coupled
  - orchestrator runtime has the highest dependency density and should move last
- P1.3 implementation note:
  - The first pass uses self-contained bundled entrypoints for `rule-validator.js`, `skill-validator.js`, `contract-validator.js`, and `agent-registry.js`.
  - This preserves business-project CLI names while removing `skill-validator.js` and `agent-registry.js` from the shared `lib/frontmatter-utils.js` copy path.
  - A single public `validators.js` file is not required if preserved entry bundles keep the loader lighter with lower migration risk.
- P1.4 implementation note:
  - `structure-analyzer.js`, `module-mapper.js`, `report-manager.js`, `reference-finder.js`, and `context-collector.js` now build as self-contained entry bundles.
  - CLI guards for analysis scripts now match by expected script basename instead of `require.main === module`, so bundled imports do not accidentally execute nested `main()` functions.
  - Default business-project installs now drop the analysis type helper files entirely.
- P1.5 implementation note:
  - `task-orchestrator.js`, `taskbook-manager.js`, `task-executor.js`, and `agent-call-manager.js` now build as self-contained entry bundles.
  - `task-executor.ts` now imports `createAgentRuntime` directly, so bundling no longer relies on a runtime string `require('./agent-runtime')`.
  - Orchestrator installs no longer ship `agent-runtime.js`, `result-aggregator.js`, `types/*.js`, or `lib/frontmatter-utils.js` into business projects.
- P1.6/P1.7 outcome:
  - Default installs now copy 6 files under `.codebuddy/scripts/` (including `README.md`).
  - Full orchestrator installs now copy 14 files under `.codebuddy/scripts/` (including `README.md`).
  - Required regression commands all passed after the bundling sweep.

### P2. Installation State File

- Status: DONE
- Priority: High
- Estimate: S
- Started: 2026-03-06
- Completed: 2026-03-06
- Blocked By:
- Goal: make installed state observable and prepare for incremental sync.
- Deliverable: `.codebuddy/install.json`
- Acceptance:
  - A business project can inspect current install mode and version directly from the generated file.
- Next Action: move to `P4 Management Commands`, using `install.json` as the shared status source.
- Notes:
  - `install.json` is now written only after a successful loader run.
  - Current fields include `schemaVersion`, `version`, `mode`, `profile`, `enableOrchestrator`, `source`, `options`, `outputs`, `stats`, `contentHash`, and `managedFiles`.
  - `contentHash` is the stable install fingerprint for sync decisions. It ignores timestamp-only generated files but still changes when managed source content or install options change.

### P3. Incremental Sync

- Status: DONE
- Priority: High
- Estimate: M
- Started: 2026-03-06
- Completed: 2026-03-06
- Blocked By:
- Goal: avoid full-copy installation on every loader run.
- Deliverables:
  - file hash comparison
  - changed-file-only updates
  - stale-file cleanup
- Acceptance:
  - Re-running the loader updates only changed files.
  - Removed upstream files are cleaned from the business project.
  - Repeat runs are noticeably faster than full copy.
- Next Action: start `P4 Management Commands` with `status/doctor` backed by `install.json`.
- Notes:
  - Loader now writes managed files through content-hash comparison and skips unchanged copies.
  - `install.json` now stores `managedFiles` ownership records for stale-file cleanup.
  - Stable `contentHash` excludes timestamp-only generated files, so repeated installs keep the same sync fingerprint when no source content changes.
  - Verified behaviors: a second core run rewrites only `project-rules.md`; an orchestrator -> core transition cleans 15 stale files in a real environment.

## Milestone 2: Operational UX

### P4. Management Commands

- Status: DONE
- Priority: High
- Estimate: M
- Started: 2026-03-06
- Completed: 2026-03-06
- Blocked By:
- Goal: reduce manual troubleshooting and installation friction.
- Commands:
  - existing `install` command continues to serve as init/sync entry
  - `codebuddy status`
  - `codebuddy doctor`
- Acceptance:
  - A user can initialize/sync via the loader entrypoint and inspect/diagnose installation state without manually inspecting `.codebuddy/`.
- Next Action: move to `P6 Remote Content Pack`.
- Notes:
  - `status` and `doctor` now live inside the existing loader CLI as positional subcommands.
  - Both commands support `--json`.
  - `status` reads `.codebuddy/install.json` and reports version/mode/profile/hash/output presence.
  - `doctor` validates install state, managed file existence, and stale static artifact drift.

### P5. Distribution Profiles

- Status: DONE
- Priority: High
- Estimate: M
- Started: 2026-03-06
- Completed: 2026-03-06
- Blocked By: P1
- Goal: install only the necessary subset for different project types.
- Profiles:
  - `core`
  - `analysis`
  - `orchestrator`
  - `full`
- Acceptance:
  - A normal business project does not need to carry the full orchestrator stack by default.
  - Orchestrator projects can opt into the complete runtime explicitly.
- Next Action: start `P6 Remote Content Pack`.
- Notes:
  - Loader now supports `--profile core|analysis|orchestrator|full`, with `analysis` as the default install profile.
  - `core` ships validator-only runtime scripts.
  - `analysis` preserves the previous default 6-file script footprint while keeping orchestration files out of normal business projects.
  - `orchestrator` adds task runtime, workflow/taskbook/agent-call contracts, and deeper analysis helpers without `agent-registry.js`.
  - `full` restores the old `--enable-orchestrator` distribution set for backward compatibility, including `agent-registry.js`.
  - `--enable-orchestrator` now maps to `full`; existing integration tests continue to pass on the legacy flag.
  - `doctor` now scans `.codebuddy/taskbooks` and `.codebuddy/agent-calls` for stale managed artifacts and reports profile-boundary residue.

## Milestone 3: Remote Delivery Optimization

### P6. Remote Content Pack

- Status: DONE
- Priority: Medium
- Estimate: M
- Started: 2026-03-07
- Completed: 2026-03-07
- Blocked By: P1, P3
- Goal: replace multi-file remote fetching with manifest plus packaged content delivery.
- Deliverables:
  - remote manifest
  - content pack archive
  - local unpack flow
- Acceptance:
  - Remote mode reduces request count from file-count scale to roughly one or two requests.
  - Business-project runtime behavior remains file-based after unpack.
- Next Action: start `P7 Worker Executor`.
- Notes:
  - `npm run build` now generates four profile-scoped content packs under `packs/`.
  - `manifest.json` now exposes `packs.core|analysis|orchestrator|full` with file path, format, sha256, size, and entry count.
  - Remote loader installs now try content-pack download first and unpack into `.codebuddy/cache/content-packs/...`.
  - If a content pack is missing or validation fails, remote mode automatically falls back to the previous per-file fetch path.
  - `install.json` now records content-pack provenance in `source.contentPackFile/contentPackFormat/contentPackSha256`.
  - A UTF-8 chunk-decoding bug in remote fetching was fixed by buffering bytes before decoding text.
  - Regression now includes:
    - remote install from `manifest + content pack` only
    - remote install fallback with no pack metadata

## Milestone 4: Automatic Execution Layer

### P7. Worker Executor

- Status: DONE
- Priority: Medium
- Estimate: L
- Started: 2026-03-07
- Completed: 2026-03-07
- Blocked By: P1, P4
- Goal: convert `AgentRuntime.renderedPrompt` into real model execution and result writeback.
- Deliverables:
  - pluggable worker-executor contract
  - external command adapter
  - `task-executor` integration with automatic success path
  - fallback preservation for `MANUAL_REQUIRED -> agent-call`
- Acceptance:
  - When a worker is configured and returns `success`, `task-executor` completes the task without manual `result.json` authoring.
  - When the worker is unavailable or returns non-success, the existing `MANUAL_REQUIRED -> agent-call` path still works.
- Next Action: start `P9 Evaluation and Metrics` baseline instrumentation.
- Notes:
  - `task-executor` now supports an external worker contract via `CODEBUDDY_WORKER_COMMAND`.
  - The worker receives JSON payload on `stdin` and must return JSON on `stdout`.
  - A successful worker run records a `worker-executor` changelog event and sets `executedBy=worker-executor:<agentId>`.
  - Worker invocation uses a timeout controlled by `CODEBUDDY_WORKER_TIMEOUT_MS` and defaults to 10 minutes.
- Regression now covers:
    - automatic worker success path
    - existing `MANUAL_REQUIRED -> agent-call -> resume` fallback path
  - Usage details live in [docs/worker-executor.md](./docs/worker-executor.md).
  - Weak-model/strong-model routing is intentionally deferred; the current execution path stays on a single worker tier.

### P8. Model Router

- Status: DEFERRED
- Priority: Medium
- Estimate: L
- Started:
- Completed:
- Blocked By: not needed for the current phase
- Goal: separate cheap routing/planning from expensive implementation work.
- Target Split:
  - weak model: classification, routing, planning, context compression
  - strong model: implement, debug, review, refactor
- Acceptance:
  - A single requirement can trigger the orchestrator and route work to the right execution tier automatically.
  - Execution cost is controlled without collapsing quality for high-difficulty tasks.
- Next Action: revisit after single-worker execution and observability prove a real need for multi-tier routing.
- Notes:
  - Deferred by product decision.
  - The current system keeps `worker-executor` as the only execution tier and preserves `agent-call` as the fallback path.

## Milestone 5: Observability

### P9. Evaluation and Metrics

- Status: DONE
- Priority: Medium
- Estimate: M
- Started: 2026-03-07
- Completed: 2026-03-07
- Blocked By: P7
- Goal: measure failure points and optimization impact.
- Metrics:
  - task success rate
  - blocked reasons
  - agent call counts
  - average task duration
  - resume counts
- Acceptance:
  - The team can identify the highest-friction stage in the pipeline using recorded metrics rather than guesswork.
- Next Action: extend the schema only when a specific optimization question cannot be answered from the current metrics.
- Notes:
  - Execution metrics now write to `.codebuddy/reports/metrics/execution-events.jsonl` and `.codebuddy/reports/metrics/latest-summary.json`.
  - Current hook points cover task start/success/block/failure, `agent-call` creation, and `agent-call` resume success.
  - Regression now validates both the `worker-executor` path and the `agent-call -> resume` path.
  - Usage details live in [docs/execution-metrics.md](./docs/execution-metrics.md).

## Recommended Execution Order

1. P1 Script Bundling
2. P2 Installation State File
3. P3 Incremental Sync
4. P4 Management Commands
5. P5 Distribution Profiles
6. P6 Remote Content Pack
7. P7 Worker Executor
8. P9 Evaluation and Metrics
9. P8 Model Router (deferred)

## Explicit Non-Goals For Now

- Do not replace local file delivery of skills, agents, and rules with MCP content fetching.
- Do not merge `references/`, `assets/`, and `scripts/` back into monolithic skill files just to reduce file count.
- Do not make `postinstall` the primary installation path across all project types.

## Change Log

- 2026-03-06: Initial roadmap created.
- 2026-03-06: Converted roadmap from static plan into a living status document with update rules and per-task tracking fields.
- 2026-03-06: Completed P1.1 script inventory and recorded stable CLI entry points in `docs/loader-script-inventory.md`.
- 2026-03-06: Completed P1.3 by bundling validator entrypoints individually and removing validator-only `frontmatter-utils` distribution dependencies from the loader.
- 2026-03-06: Completed P1.4 by bundling analysis entrypoints individually, switching bundled CLI guards to basename checks, and reducing default distributed scripts to 6 files.
- 2026-03-06: Completed P1.5/P1.6/P1.7 by bundling orchestrator entrypoints individually, removing internal runtime helper files from business-project distribution, and passing full end-to-end regression.
- 2026-03-06: Completed P2 by generating .codebuddy/install.json after successful installs, recording mode/profile/options/stats, and validating both core and orchestrator loader outputs.
- 2026-03-06: Completed P3 by adding managed-file ownership tracking, content-hash-based write skipping, stable install fingerprints, and stale-file cleanup for profile transitions.
- 2026-03-06: Completed P4 by adding `status` / `doctor` loader subcommands, JSON output support, and integration-test coverage for install-state inspection.
- 2026-03-06: Completed P5 by introducing explicit `core/analysis/orchestrator/full` distribution profiles, preserving `--enable-orchestrator` as a backward-compatible alias for `full`, and adding profile-matrix regression coverage.
- 2026-03-07: Linked the roadmap to `ARCHITECTURE.md` so implementation planning and target-system design stay navigable together.
- 2026-03-07: Completed P6 by generating profile-scoped remote content packs, caching remote pack installs locally with fallback to per-file fetch, and adding remote pack regression coverage.
- 2026-03-07: Completed P7 by adding a pluggable `worker-executor` contract, wiring `task-executor` to auto-run rendered prompts through an external command, preserving manual `agent-call` fallback, and documenting the worker payload/output contract.
- 2026-03-07: Deferred P8 by decision; the roadmap now keeps a single worker execution tier and moves the next focus to P9 observability.
- 2026-03-07: Completed P9 by adding local execution metrics files, task-execution instrumentation, summary aggregation, and regression coverage for both worker and agent-call resume flows.

## Short Version

Make the loader lighter and more reliable first. Build automatic execution only after delivery, sync, and operational ergonomics are stable.
