# Task Intake Router Plan

> Last updated: 2026-03-23
> Scope: turn `Small-Change Direct Execution First` into an executable advisory capability
> Status: Phase 1 and business-project distribution completed on 2026-03-23

## Goal

Build a lightweight intake decision layer that helps maintainers and AI sessions
choose between:

- direct execution
- orchestrated execution

without changing the current default behavior of `task-orchestrator`.

## Why Now

The repository now has a documented small-change execution rule, but that rule
still lives only in docs.

Without an executable intake layer, the team still has to decide manually every
time whether a task should:

- stay direct and cheap
- escalate into workflow / TaskBook / agent handoff

This item converts that rule into a shared, testable capability.

## Phase 1 Scope

Phase 1 is intentionally advisory-only.

Deliverables:

- shared intake routing types
- shared intake routing library
- standalone CLI entrypoint
- roadmap / handoff / README documentation
- focused baseline coverage

Phase 1 does **not**:

- auto-start `task-orchestrator`
- change default loader/install behavior
- change business-project runtime contracts
- change existing workflow-routing behavior

## Decision Model

Default recommendation:

- `direct`

Escalate to `orchestrated` when one or more hard triggers appear:

- cross-module or cross-domain scope
- incomplete or missing external contract
- high uncertainty
- staged handoff / parallel work / durable tracking
- architecture / state-model / routing / workflow changes

Keep `direct` when the task is small, bounded, and explicit:

- explicit contract
- low uncertainty
- small file set
- focused API adaptation / bugfix / refactor pattern

## Acceptance

- A maintainer can run one command and get `direct` vs `orchestrated` plus
  reasons.
- The decision model is shared in code, not re-implemented inside docs only.
- The capability is additive and does not change current orchestrator defaults.
- Focused baseline tests cover both direct and escalation examples.

## Validation

- `npm run build:scripts`
- `npm run test:lib`
- `npm run intake:route -- --description "replace mock login API with the provided contract" --files 4 --contract explicit --uncertainty low`

## Follow-up Options

Possible future follow-ups, only if they become useful:

- connect the advisory decision to orchestrator entrypoints as an explicit opt-in
- add richer task-shape signals if real projects show misclassification
- expose intake decisions in report/audit surfaces only if teams need durable traceability

## Completed Follow-up

The first follow-up has already been completed:

- installed business projects now receive `task-intake-router.js` in `analysis`
  and heavier profiles
- generated `.codebuddy/scripts/README.md` now surfaces the intake decision
  command
- business-project docs now show when to run the intake advisor before deciding
  whether to enter orchestration
