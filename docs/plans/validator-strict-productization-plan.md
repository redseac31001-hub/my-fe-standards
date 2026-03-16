# Validator Strict Productization Plan

> Last updated: 2026-03-17
> Type: execution plan
> Scope: `rule-validator` / `skill-validator` strict-mode usability, script entrypoints, and review checklist

## Goal

Turn validator strict mode into a reviewable, auditable product surface instead of a hidden implementation detail.

Target outcome:

1. users understand default mode vs. `--strict`
2. repository provides stable script entrypoints for both modes
3. release reviewers can verify the same task list every time

## Current Baseline

Already completed:

- `rule-validator --strict` fails on warnings and errors
- `skill-validator --strict` fails on warnings and errors
- JSON output now exposes `strictMode` and `effectiveOk`
- baseline tests and `run-tests.js` fixtures cover strict-mode behavior
- skill release guidance exists in `docs/guides/skill-release-guide.md`

Current commits that established the baseline:

- `d20e61c docs: add skill release guide`
- `b266a1e feat: make validator strict mode fail on warnings`

## Scope

### In Scope

- validator usage documentation
- `package.json` script entrypoints
- release/review checklist
- optional CI usage guidance without changing default install or default `npm test`

### Out of Scope

- changing validator parsing rules again
- forcing strict mode into default local developer commands
- adding new remote protocol or `.codebuddy/` contract changes
- enabling strict mode in CI by default without an explicit decision

## Workstreams

### W1. Usage Documentation

Status: `DONE`

Goal:

- make default mode vs. `--strict` understandable from repository entry docs

Detailed tasks:

1. update `README.md`
2. add a short validator section:
   - what `rule-validator` checks
   - what `skill-validator` checks
   - when to use default mode
   - when to use `--strict`
3. update `docs/guides/skill-release-guide.md`
4. add explicit examples:
   - development check
   - pre-release check
   - warning-only fixture expectations

Files:

- `README.md`
- `docs/guides/skill-release-guide.md`

Acceptance:

- a reviewer can understand strict-mode intent without reading source code
- doc examples match actual CLI behavior

Review checklist:

- wording does not imply strict mode is mandatory for every local edit
- examples use current CLI names and flags only

Completed notes:

- `README.md` now explains default validator mode vs. `--strict`
- `docs/guides/skill-release-guide.md` now includes development-time and pre-release examples
- documentation now points reviewers to `effectiveOk` as the final mode-aware pass/fail signal

### W2. Script Entry Standardization

Status: `DONE`

Goal:

- provide stable script names for review and release usage

Detailed tasks:

1. update `package.json`
2. add scripts:
   - `validate:rules`
   - `validate:rules:strict`
   - `validate:skills`
   - `validate:skills:strict`
3. optionally add grouped scripts if useful:
   - `validate:all`
   - `validate:all:strict`
4. ensure script naming remains descriptive and does not collide with existing build/test commands

Files:

- `package.json`

Acceptance:

- a reviewer can run validator checks without remembering raw Node commands
- default install and `npm test` behavior remain unchanged

Review checklist:

- no existing command semantics are broken
- script names are explicit enough for CI use

Completed notes:

- `package.json` now exposes `validate:rules`, `validate:rules:strict`, `validate:skills`, `validate:skills:strict`
- grouped entrypoints `validate:all` and `validate:all:strict` are now available for review and release flows

### W3. Review and Release Checklist

Status: `DONE`

Goal:

- make later review reproducible

Detailed tasks:

1. update `docs/guides/HANDOFF.md`
2. record the recommended validator order:
   - default mode during development
   - strict mode before release or policy review
3. optionally add a short note in roadmap/backlog if strict CI promotion is still deferred
4. define a minimal review command set

Files:

- `docs/guides/HANDOFF.md`
- optionally `ROADMAP.md`

Acceptance:

- future reviewers can follow one short checklist instead of reconstructing the process

Review checklist:

- checklist is short enough to be used in practice
- no statement implies CI is already enforcing strict mode if it is not

Completed notes:

- `docs/guides/HANDOFF.md` now records the recommended validator order
- current wording keeps strict mode explicitly opt-in and release-oriented

### W4. Validation and Close-out

Status: `DONE`

Goal:

- close the loop with the smallest reliable verification set

Detailed tasks:

1. run `npm run build:scripts`
2. run `npm run test:lib`
3. run any new validator scripts added to `package.json`
4. if `package.json` scripts were added, verify command names in docs match actual scripts

Acceptance:

- new entrypoints and docs are consistent
- no regression in baseline validator behavior

Review checklist:

- build output synced if distributed files changed
- commit boundary stays clean: docs/productization vs. future CI enforcement

Completed notes:

- ran `npm run build:scripts`
- ran `npm run test:lib`
- ran `npm run validate:all`
- ran `npm run validate:all:strict`

## Execution Order

1. `W1 Usage Documentation`
2. `W2 Script Entry Standardization`
3. `W3 Review and Release Checklist`
4. `W4 Validation and Close-out`

## Deferred Follow-up

These are intentionally not part of this plan:

- enabling strict validator commands inside default CI
- making warnings fatal for all local developer flows
- extending validator scope beyond current rule/skill checks

If those become necessary later, create a separate plan and treat them as policy changes, not routine cleanup.
