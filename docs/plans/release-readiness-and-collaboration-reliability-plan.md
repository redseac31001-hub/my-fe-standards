# Release Readiness and Collaboration Reliability Plan

> Last updated: 2026-03-23
> Type: execution plan
> Scope: repository fact sources, release gates, audit persistence, and collaboration reliability

## Goal

Turn the current loader, validator, report, and team-protocol surfaces into a more reliable release and collaboration baseline.

Target outcome:

1. repository progress sources stay consistent enough to be machine-checked
2. release and review commands collapse into a small number of repeatable gates
3. audit results become first-class persisted artifacts instead of terminal-only output
4. the known `mcp-server` dependency-health drift is either resolved or downgraded into a clear non-blocking rule

## Current Baseline

Already present:

- `task-orchestrator`, `task-executor`, `TaskBook`, and `agent-call` mainline paths are working
- workflow auto-routing is implemented and covered by baseline, correctness, and fixture E2E
- validator strict mode, validator gate, validator history, and validator trend are already in place
- `report-manager` now exposes machine-readable `status/history/trend/diff/export/audit`
- team handoff and collaboration rules are documented in `docs/guides/team-collaboration-protocol.md`

Current gap:

- repository fact sources can still drift apart without an explicit validator
- quick review vs. release review command sets are still more implicit than formal
- `report-manager audit` has a strong CLI surface, but no dedicated standard history lane yet
- `doctor:mcp-server-deps` is still a known environment-quality exception

## Scope

### In Scope

- repository fact-source validation
- quick/release gate definition
- audit report standardization
- `mcp-server` dependency-health cleanup or explicit downgrade policy

### Out of Scope

- new execution-layer features
- model-routing changes
- breaking `.codebuddy/` contract changes
- forcing new mandatory install steps into business projects

## Workstreams

### W1. Repository Fact-Source Validator

Status: `DONE`

Goal:

- warn when `README`, `ROADMAP`, `HANDOFF`, docs index, and collaboration protocol drift out of the expected baseline

Detailed tasks:

1. add `scripts/src/repo-state-validator.ts`
2. validate existence of required fact-source files
3. validate a minimum set of cross-links between:
   - `README.md`
   - `docs/README.md`
   - `docs/guides/HANDOFF.md`
   - `docs/guides/team-collaboration-protocol.md`
4. validate required sections:
   - `ROADMAP.md` current snapshot
   - `HANDOFF.md` current state / backlog
   - collaboration protocol bootstrap guidance
5. add freshness warnings for stale repository fact sources
6. wire the validator into `validator-gate`
7. expose script entrypoints in `package.json`

Files:

- `scripts/src/repo-state-validator.ts`
- `scripts/src/validator-gate.ts`
- `scripts/src/types/reports.ts`
- `package.json`
- `test/lib-baseline.test.mjs`

Acceptance:

- `npm run validate:repo` exists
- `npm run validate:repo:strict` exists
- `validate:gate[:strict]` includes repo-state checks in `scope=all`
- warnings stay non-blocking by default

Review checklist:

- no business-project install surface changes
- no `.codebuddy/` protocol changes
- stale-doc warnings are conservative enough to avoid noisy false positives

Completed notes:

- added `repo-state-validator` with required-file, cross-link, section, and freshness checks
- added `validate:repo` and `validate:repo:strict`
- wired `repo-state-validator` into `validator-gate`
- kept business-project compatibility by auto-skipping repo-state checks when repository fact-source sentinels are not present
- passed:
  - `npm run build:scripts`
  - `npm run validate:repo`
  - `npm run validate:repo:strict`
  - `npm run test:lib`
  - `npm run build`
  - `npm run validate:all:strict`
  - `node scripts/dist/validator-gate.js run --strict --scope all --json`

### W2. Quick Gate and Release Gate Standardization

Status: `DONE`

Goal:

- reduce review-time command sprawl to two named validation paths

Detailed tasks:

1. define `quick gate`
   - `npm run build`
   - `npm run test:lib`
   - `npm run validate:all`
2. define `release gate`
   - `npm run build`
   - `npm test`
   - `node test/run-tests.js`
   - `npm run validate:all:strict`
   - `node .codebuddy/scripts/report-manager.js audit --json`
3. document both gates in:
   - `README.md`
   - `docs/guides/HANDOFF.md`
   - `docs/guides/team-collaboration-protocol.md`
4. keep these gates advisory unless a later decision promotes them to default CI

Acceptance:

- team members can choose the right gate without reconstructing commands manually
- docs stop mixing review and release command sets

Completed notes:

- added `npm run gate:quick`
- added `npm run gate:release`
- documented both gates in `README.md`, `docs/guides/HANDOFF.md`, and `docs/guides/team-collaboration-protocol.md`
- explicitly documented that `report-manager audit --json` in the release gate is evidence collection rather than a standalone hard blocker

### W3. Audit Standard Report Lane

Status: `DONE`

Goal:

- persist `report-manager audit` results into a standard report lane with `latest + history`

Detailed tasks:

1. add a standard report location for audit output
2. write `latest` audit artifacts
3. write `history/<timestamp>` snapshots
4. expose the latest audit verdict in `status/history/trend` where appropriate
5. ensure retention/cleanup covers audit history

Acceptance:

- one command can generate an audit artifact that later tooling can read
- the report lane matches the current validator-gate persistence pattern
- verified in a business-project local E2E after install

### W4. MCP Server Dependency-Health Closure

Status: `DONE`

Goal:

- either remove the `doctor:mcp-server-deps` drift warning or make it a clearly documented non-blocking exception

Detailed tasks:

1. inspect current `mcp-server` lockfile/package baseline
2. decide whether the repo should commit a refreshed lockfile
3. if the environment constraint remains, document the exact non-blocking rule
4. update `HANDOFF.md` and `README.md` accordingly

Acceptance:

- `doctor:mcp-server-deps` is no longer an ambiguous warning source
- future handoff does not need to rediscover the same caveat
- current business-project release can proceed with this item documented as non-blocking while follow-up remains open

Completed notes:

- `doctor:mcp-server-deps` now explicitly reports a `non_blocking_exception` release impact in default mode
- default mode stays non-blocking for mainline repository work and business-project release decisions
- `doctor:mcp-server-deps:strict` now exists for tasks that directly target `mcp-server` dependency hygiene
- README and HANDOFF now document the exact escalation boundary instead of treating the command as an ambiguous warning source

## Execution Order

1. `W1 Repository Fact-Source Validator`
2. `W2 Quick Gate and Release Gate Standardization`
3. `W3 Audit Standard Report Lane`
4. `W4 MCP Server Dependency-Health Closure`

## Validation Strategy

For `W1`, the minimum reliable validation set is:

```bash
npm run build:scripts
npm run test:lib
npm run validate:repo
npm run validate:repo:strict
```

Only expand beyond that when a workstream changes install/runtime behavior.

## Deferred Follow-up

Still not part of this plan:

- Windows-only `dead-process lock reclaim` correctness recovery
- enabling strict validators or release gates by default in CI
- multi-tier model routing
