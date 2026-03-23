# Architecture Constraints

> Last updated: 2026-03-23
> Scope: change constraints for delivery, install, execution, and tool compatibility

## Purpose

This document defines the non-negotiable architecture constraints for
`my-fe-standards`.

It exists to prevent a common failure mode:

- the repository keeps gaining new capabilities
- the default install path gets longer and harder
- AI IDE / tool integrations start depending on unstable local conventions
- remote/private deployment becomes harder to operate

The goal is not to slow down evolution. The goal is to keep the core stable
while allowing optional expansion.

## Core Rule

New complexity should be added to the optional layer, not the default path.

In practice:

- keep the default install and execution path short
- keep existing filesystem and file-protocol contracts stable
- make advanced capabilities opt-in
- push complexity to maintainers and publishers before pushing it to business projects

## Frozen Surfaces

These surfaces should be treated as compatibility-sensitive.

### 1. Default install entry

The standard install/update commands should remain valid without extra required
steps.

Examples:

- `node scripts/dist/codebuddy-loader.js`
- `curl ... codebuddy-install.js | node - --remote <URL>`
- `curl ... codebuddy-loader.bundle.js | node - --remote <URL>`

Constraint:

- do not require new mandatory flags, services, or manual preparation steps for baseline use

### 2. `.codebuddy/` runtime contract

Installed projects rely on a stable `.codebuddy/` structure.

Constraint:

- do not rename, remove, or repurpose core directories casually
- additive changes are acceptable; breaking reshapes are not

Core compatibility-sensitive areas include:

- `.codebuddy/install.json`
- `.codebuddy/scripts/`
- `.codebuddy/workflows/`
- `.codebuddy/taskbooks/`
- `.codebuddy/agent-calls/`

### 3. Agent-call file protocol

The prompt/result protocol is part of the execution contract.

Constraint:

- keep `.codebuddy/agent-calls/<requestId>.prompt.md`
- keep `.codebuddy/agent-calls/<requestId>.result.json`
- keep result writeback semantics backward-compatible
- keep remote writeback API compatible unless a versioned migration exists

### 4. Remote minimal artifact set

Remote and private deployment depend on a small stable publish surface.

Constraint:

- keep the minimal remote set small:
  - `manifest.json`
  - `scripts/dist/codebuddy-install.js`
  - `scripts/dist/codebuddy-loader.bundle.js`
  - `packs/*.json`
- do not make source directories mandatory for normal remote installs

### 4a. Remote bootstrap downloadability

Business projects must remain able to download and start the remote runtime
from a maintainer machine before push.

Constraint:

- if a change touches the remote bootstrap surface, run a local bootstrap
  simulation before push
- the minimum Windows-compatible simulation command is
  `npm run smoke:remote-powershell`
- the simulation must prove both supported bootstrap paths still work:
  - `codebuddy-install.js` downloaded to a file, then executed
  - `codebuddy-loader.bundle.js` piped through PowerShell into `node -`

Trigger conditions:

- changes to `scripts/src/codebuddy-install.ts`
- changes to `scripts/src/codebuddy-loader.ts`
- changes to loader-bundled dependencies that can affect install, routing,
  distribution, prompt selection, or text parsing
- changes to `scripts/dist/codebuddy-install.js`
- changes to `scripts/dist/codebuddy-loader.bundle.js`
- changes to `manifest.json` or `packs/*.json`
- changes to remote install copy-paste commands in `README` or business-project
  guides
- changes that introduce new non-ASCII parsing or matching logic into code that
  ships inside `codebuddy-loader.bundle.js`

### 5. Default workflow usability

The default workflow is part of the product surface, not an internal detail.

Constraint:

- do not increase default operator burden casually
- additional review/evidence/memory steps should start as opt-in workflow variants
- the default path should remain runnable in a normal business project without extra infrastructure

## Design Principles

### Small-Change Direct Execution First

Small, low-uncertainty tasks should default to direct execution before they
escalate into workflow orchestration.

This is a product rule, not just a team preference.

Why:

- small tasks should not pay orchestration overhead by default
- the system should stay lighter for business projects and daily use
- complex execution machinery should remain focused on tasks that actually need
  traceability, branching, or handoff

Typical direct-execution candidates:

- clear API replacement based on an explicit contract document
- mock-to-real request migration in a small scope
- a localized bug fix with limited file churn
- a focused refactor that does not reshape cross-module contracts

Constraint:

- do not force small, well-bounded tasks through `task-orchestrator`,
  multi-step workflow, or agent handoff unless complexity actually requires it
- do not ban rules, skills, or validators from helping these tasks; they remain
  reference and quality layers, not mandatory ceremony

Escalate to orchestrated execution when any of these become true:

- the change spans multiple pages, stores, services, or business domains
- the external contract is incomplete or materially ambiguous
- the task needs staged review, handoff, or parallel ownership
- the task requires durable task tracking beyond a single direct execution pass
- the task introduces architectural, routing, state-model, or workflow changes

### Default Path First

The shortest path must stay the primary path.

A new capability is healthy when:

- existing users can ignore it
- existing commands still work
- business projects do not need to understand the new subsystem to keep using the old one

### Optional Capability Overlay

Advanced capabilities should be introduced as one of:

- optional workflow
- optional profile
- optional tool adapter
- optional validator warning
- optional documentation and prompt layer

They should not silently become mandatory for every install.

### Transport Can Change; Local Consumption Should Not

Remote mode may evolve, but it should still resolve into the same local
consumption model.

Constraint:

- remote delivery may change transport, caching, or packing
- remote delivery should not require business projects or AI tools to adopt a different local runtime contract

### Complexity Belongs Upstream

When possible, put complexity in:

- build/release
- conversion
- packaging
- validation
- documentation

Avoid putting it in:

- business project bootstrap
- every AI IDE interaction
- every remote writeback session

### Backward Compatibility Over Purity

If a better design would break the installed contract, prefer compatibility
unless the benefit is large enough to justify a versioned migration.

Preferred order:

1. additive change
2. opt-in variant
3. versioned migration with fallback
4. breaking default change only as a last resort

## What Is Safe To Expand

These areas are encouraged, as long as they remain additive:

- playbooks
- runbooks
- examples
- prompt templates
- new workflow templates
- optional agents
- validator warnings
- multi-tool conversion outputs
- optional MCP memory guidance
- capability matrix / routing metadata

These increase reach without destabilizing baseline usage.

## What Requires Extra Review

Changes in the following categories should be treated as architecture reviews,
not routine edits:

- loader CLI behavior
- remote publishing layout
- `.codebuddy/` directory contract
- `install.json` meaning
- agent-call prompt/result schema
- default workflow step count or operator burden
- task-executor resume semantics
- business-project required commands

## Current Enforcement

These constraints are intentionally enforced as additive guidance first, not as
mandatory install blockers.

- `node .codebuddy/scripts/contract-validator.js --workflows --agent-calls --check-architecture-constraints`
  emits opt-in warnings for workflow and agent-call contract drift
- `node scripts/dist/codebuddy-loader.js doctor --json`
  surfaces the same class of drift as doctor warnings when an installed project
  already contains workflow or agent-call artifacts

This keeps the default install path unchanged while making compatibility drift
visible in normal maintenance flows.

## When To Change This Document

This document should not change just because a design looks cleaner or a new
idea feels more elegant.

Changing these constraints should be triggered only when at least one of the
following is true:

- the current constraints repeatedly block a core product goal
- external ecosystem changes make the current constraints actively harmful
- security, compliance, or operations requirements require a different baseline
- repeated business-project validation shows that the current boundary is wrong
- the long-term cost of compatibility is now clearly higher than a controlled migration

These are not sufficient triggers by themselves:

- maintainer preference
- a single feature wanting a shorter implementation path
- a theoretical future scenario with no concrete evidence
- a desire to make the design more internally pure

## Constraint Change Process

If a constraint needs to change, use this process.

### 1. Write A Change Case

Document:

- which constraint is failing
- which real scenario demonstrates the failure
- why an additive or opt-in approach is not enough
- which compatibility-sensitive surfaces are affected

### 2. Classify The Change

Use one of these levels:

- Level A: clarify wording only; no behavior or boundary change
- Level B: add an explicit exception or opt-in path; default path unchanged
- Level C: modify the constraint but preserve backward compatibility
- Level D: breaking change; requires migration, rollback, and transition coverage

### 3. Review The Impact Surface

Every proposed change must be checked against:

- default install commands
- `.codebuddy/` runtime contract
- agent-call file/API protocol
- remote minimum artifact set
- remote bootstrap downloadability
- default workflow burden
- AI IDE / tool invocation flow

### 4. Prefer The Lowest-Risk Option

Preferred order:

1. clarify the rule
2. add an opt-in variant
3. add a versioned path with fallback
4. change the default baseline only if the earlier options are insufficient

### 5. Land In The Right Order

When the change is approved:

1. update this document first
2. update implementation and tests
3. document migration and rollback if needed
4. validate local, remote, and business-project paths
5. only then treat the new rule as the repository baseline

## Change Review Checklist

Before merging a new capability, answer these questions.

### Install Path

- Does this change make the default install command longer?
- Does this change add a mandatory dependency?
- Does this change add a mandatory service?
- Does this change add a new manual business-project setup step?

If any answer is `yes`, the feature should default to opt-in.

### AI IDE / Tooling Path

- Does this change require AI IDEs to learn a new file location?
- Does this change alter agent-call request/result semantics?
- Does this change require extra manual glue between prompt and result handling?
- Does this change make remote writeback or retry flows harder?

If any answer is `yes`, the protocol should remain backward-compatible or be versioned.

### Remote / Private Deployment Path

- Does this change enlarge the minimal remote artifact set?
- Does this change make `--pack-only` less viable?
- Does this change require exposing more repository internals to business projects?
- Does this change touch the remote bootstrap/download path used by business projects?

If any answer is `yes`, the feature should remain optional or publisher-side only.
If the last answer is `yes`, run `npm run smoke:remote-powershell` before push.

### Workflow / Execution Path

- Does this change make the default workflow harder to finish?
- Does this change add mandatory evidence or memory steps?
- Does this change require extra human intervention in the normal happy path?

If any answer is `yes`, prefer a new workflow template over changing the default one.

## Migration Guidance

When a breaking change is unavoidable:

1. keep the old path working for at least one transition period
2. introduce a version marker or explicit opt-in
3. document upgrade and rollback steps
4. add regression coverage for old and new paths
5. do not break remote/private deployment silently

## Short Decision Rule

Reject or redesign a change if it:

- adds mandatory steps to baseline installation
- breaks the `.codebuddy/` contract
- breaks the agent-call protocol
- enlarges the remote minimum publish surface
- forces all users onto an advanced capability

Prefer the change if it:

- is additive
- is opt-in
- preserves current install/use commands
- keeps AI IDE integration stable
- moves complexity to maintainers instead of consumers
