# Team Collaboration Protocol

> Last updated: 2026-05-20
> Scope: repository progress tracking, handoff, review, and verification

## Goal

This guide defines how team members should read current progress, continue work, and hand off changes without relying on chat history.

The core rule is simple:

- repository facts must live in repository files
- chat can explain work, but it must not be the only place that progress exists
- this branch is the maintenance line for the real-business-project pilot; do not add new platform capabilities without pilot evidence
- personal/small-scope standards-library work belongs in a separate `my-dev-standards-lite` repository

## Canonical Sources

When a team member wants to know "where are we now?", use these files in order:

1. [Handoff](./HANDOFF.md)
2. [Roadmap](../../ROADMAP.md)
3. [README](../../README.md)
4. [PROJECT](../../PROJECT.md)
5. [Architecture Constraints](../reference/architecture-constraints.md)

Each file has a different responsibility:

- [Handoff](./HANDOFF.md): current state, recent completions, validation notes, recommended next steps
- [Roadmap](../../ROADMAP.md): task priority, execution status, next action, deferred items
- [README](../../README.md): product entrypoints, common commands, validation entrypoints
- [PROJECT](../../PROJECT.md): capability map and structural truth
- [Architecture Constraints](../reference/architecture-constraints.md): compatibility boundaries and change rules

## 10-Minute Read Path

A new or returning team member should use this path:

1. `git pull`
2. `git log -5 --oneline`
3. Read [Handoff](./HANDOFF.md)
4. Read `Current Snapshot` in [Roadmap](../../ROADMAP.md)
5. Read the command section in [README](../../README.md)
6. Run the minimum validation needed for the task

Recommended quick commands:

```bash
npm run build
npm test
node test/run-tests.js --list-cases
```

If the member only needs one local E2E case:

```bash
node test/run-tests.js --suite local --case vue3-project
```

If the member needs the latest observability verdict for an installed business project:

```bash
node .codebuddy/scripts/report-manager.js audit --json
```

## Standard AI Session Bootstrap

When a team member opens a new AI session, do not assume the model already knows current progress.

Use a fixed bootstrap prompt so the AI reads repository facts first.

Recommended prompt:

```text
Please do not change code yet.

First read these repository sources of truth:
- docs/guides/team-collaboration-protocol.md
- docs/guides/HANDOFF.md
- ROADMAP.md
- README.md
- PROJECT.md

Then run:
- git status -sb
- git log -5 --oneline

Based on repository files instead of chat history, summarize:
1. current progress
2. recent completions
3. unfinished or deferred items
4. recommended next step
5. minimum validation commands
```

If the task touches installed business-project behavior, observability, or reports, append:

```text
Also inspect:
- node test/run-tests.js --list-cases
- node .codebuddy/scripts/report-manager.js audit --json
```

Short form is also acceptable:

```text
Please follow Team Collaboration Protocol and read the current repository progress before changing anything.
```

## Update Rules

These updates are mandatory when repository state changes.

### Update `HANDOFF.md` when:

- a task batch is completed
- the current recommended next step changes
- validation expectations change
- a known blocker is discovered, deferred, or cleared

Minimum content to add:

- what changed
- what passed
- what is still pending or deferred
- what the next person should do next

### Update `ROADMAP.md` when:

- a roadmap item changes status
- priority changes
- the next action changes
- a new deferred or blocked item is created

Minimum content to update:

- `Status`
- `Started` / `Completed` when applicable
- `Next Action`
- validation notes if the task is done

### Update `README.md` when:

- a user-facing entrypoint changes
- a common command is added or removed
- a new recommended validation path is introduced
- a new product surface becomes important enough for daily use

### Update `PROJECT.md` or architecture/reference docs when:

- capability boundaries change
- structural assumptions change
- a new subsystem becomes part of the stable repository model

## Commit and PR Conventions

Every implementation PR or merge-ready commit should make it easy for another person to continue work.

Recommended commit/PR summary structure:

1. outcome
2. scope boundaries
3. validation run
4. explicit deferred items

At minimum, include:

- what was changed
- what was intentionally not changed
- what commands were used to validate
- whether remote bootstrap simulation was required and, if so, which command was run

Good examples:

- `feat: expand report observability and audit flows`
- `feat: surface validator gate status in doctor`
- `docs: add skill release guide`

## Verification Rules

Use the smallest validation that still proves the change.

## Execution Path Selection

Use the lightest execution path that still provides enough control.

### Small-Change Direct Execution Rule

Default to direct AI execution when the task is small, explicit, and likely to
finish within one focused implementation pass.

Typical signals:

- the requirement or API contract is already written down
- the change is confined to a small file set
- the change stays within one business area
- the work is primarily adaptation, replacement, or parameter mapping
- no multi-person coordination or staged handoff is needed

Examples:

- replace mock API calls with a provided real API contract
- adjust request/response field mapping for one module
- fix a localized interaction bug without changing surrounding architecture

Direct execution means:

- do not start with `task-orchestrator`
- do not require a workflow/taskbook by default
- use rules, skills, validators, and local docs as reference material only when
  they materially help
- still record outcome and validation in normal repository facts when the change
  lands

### Escalation To Orchestration

Escalate from direct execution to workflow/taskbook/agent orchestration when
the task stops being small or predictable.

Escalation triggers:

- more than one module boundary or business domain is affected
- the API or requirement is incomplete, contradictory, or risky
- state flow, routing, permissions, caching, or error handling must be redesigned
- the change needs staged review, durable handoff, or parallel work ownership
- the expected validation path is too large for one direct pass

Short decision rule:

- small and explicit: direct execution first
- broad or uncertain: orchestrate

If the boundary is not obvious, run the intake advisor before choosing a path:

```bash
npm run intake:route -- --description "replace mock login API with the provided contract" --files 4 --contract explicit --uncertainty low
```

Interpretation:

- `direct` means stay on the lightweight path and avoid `task-orchestrator` by default
- `orchestrated` means promote the task into workflow / TaskBook / handoff execution

### Docs-only changes

Usually enough:

```bash
git diff --check
```

### Source or distribution logic changes

Usually required:

```bash
npm run build
npm test
```

### Installed business-project behavior changes

Run a focused case first:

```bash
node test/run-tests.js --suite local --case vue3-project
```

Then expand only if needed:

```bash
node test/run-tests.js --suite local
node test/run-tests.js --suite remote
```

### Remote bootstrap / download path changes

If a change can affect how a business project downloads or starts the remote
runtime, run a local PowerShell bootstrap simulation before push:

```bash
npm run smoke:remote-powershell
```

This rule is triggered when any of these are true:

- `codebuddy-install.js` behavior changed
- `codebuddy-loader.bundle.js` behavior changed
- a loader-bundled dependency changed and may affect remote install, prompt
  routing, distribution, or text parsing
- `manifest.json` or `packs/*.json` changed
- remote install copy-paste commands changed in README or business-project guides
- a loader-bundled file gained new non-ASCII matching/parsing logic

If the same change also affects installed-project runtime behavior after
bootstrap, add:

```bash
node test/run-tests.js --suite remote
```

### Validator/report surface changes

Recommended:

```bash
npm run gate:quick
npm run validate:repo
npm run validate:all
node .codebuddy/scripts/report-manager.js audit --json
```

### Direct-execution task changes

If the task intentionally follows the small-change direct-execution path,
prefer a short, targeted validation set over full orchestration validation.

Typical pattern:

```bash
npm run build
npm test
```

Then add the narrowest domain-specific verification that proves the change.

Examples:

- one focused page/module smoke
- one targeted local E2E case
- one API adaptation path with visible request/response confirmation

Do not escalate validation to full workflow coverage unless the task itself
crosses the direct-execution boundary.

### Named gate paths

Use these names in handoff, review, and PR notes instead of restating long command lists every time:

- `quick gate`
  - command: `npm run gate:quick`
  - use when: day-to-day implementation is ready for local review
- `release gate`
  - command: `npm run gate:release`
  - use when: preparing merge, release, or stage handoff

Interpretation:

- `quick gate` is confidence-oriented and warning-tolerant
- `release gate` includes strict validator checks and full E2E coverage
- `report-manager audit --json` inside `release gate` is evidence collection, not a standalone hard blocker

## Handoff Checklist

Before handing work to another team member, confirm:

- current progress is written to [Handoff](./HANDOFF.md)
- roadmap state is updated in [Roadmap](../../ROADMAP.md)
- new command surfaces are reflected in [README](../../README.md)
- deferred items are clearly separated from merge-ready work
- validation commands and outcomes are recorded

## Deferred and WIP Rules

Do not mix unstable or deferred work into a clean delivery batch unless the handoff explicitly says so.

If a task is intentionally postponed:

- mark it as deferred in [Roadmap](../../ROADMAP.md)
- mention it in [Handoff](./HANDOFF.md)
- keep it out of "ready to merge" scope unless validation is complete

If work must be handed over unfinished, prefer:

1. a dedicated branch
2. a WIP commit
3. an updated [Handoff](./HANDOFF.md)

## Team Default

If there is ever a conflict between chat context and repository documents, prefer the repository documents, then re-verify with commands.
