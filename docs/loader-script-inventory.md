# Loader Script Inventory

> Last updated: 2026-03-06
> Purpose: inventory distributed scripts before script bundling work

## Scope

This document inventories the files currently distributed into business projects under `.codebuddy/scripts/`.

It separates:

- stable CLI entry points
- distributed but non-user-facing runtime files
- internal dependency files copied only because current scripts import them directly

This inventory is the baseline for `P1 Script Bundling`.

## Source of Truth

The current distribution map comes from:

- `scripts/src/codebuddy-loader.ts`
- generated script README and prompt metadata
- integration-test invocations under `test/run-tests.js`

## Distribution Profiles

### `core`

Minimal validation-oriented runtime.

| Script | Category | User-facing CLI | Current Dependencies | Evidence |
|--------|----------|-----------------|----------------------|----------|
| `rule-validator.js` | validator | Yes | none | integration tests invoke it directly |
| `skill-validator.js` | validator | Yes | none | integration tests invoke it directly |

### `analysis` (default)

Default business-project runtime. Adds local analysis tools on top of `core`.

| Script | Category | User-facing CLI | Current Dependencies | Evidence |
|--------|----------|-----------------|----------------------|----------|
| `structure-analyzer.js` | analysis | Yes | none | distributed in default installs, documented in scripts README/prompt |
| `module-mapper.js` | analysis | Yes | none | distributed in default installs, shown in scripts prompt |
| `report-manager.js` | analysis/report | Yes | none | documented in scripts prompt and usage examples |

### `orchestrator`

Execution-oriented runtime. Adds orchestration, contracts, and deeper analysis helpers on top of `analysis`.

| Script | Category | User-facing CLI | Current Dependencies | Evidence |
|--------|----------|-----------------|----------------------|----------|
| `agent-call-manager.js` | runtime/contract | Yes | none | integration tests and generated docs invoke it directly |
| `task-orchestrator.js` | orchestration | Yes | none | integration tests invoke it directly |
| `taskbook-manager.js` | orchestration/state | Yes | none | integration tests invoke create/add/confirm/report/plan/apply-plan directly |
| `task-executor.js` | orchestration/execution | Yes | none | integration tests invoke it directly |
| `contract-validator.js` | validator/contract | Yes | none | generated docs expose it directly |
| `reference-finder.js` | analysis/helper | Yes | none | has explicit CLI help and is used by `context-collector.js` |
| `context-collector.js` | analysis/helper | Yes | none | has explicit CLI help |

In addition to scripts, this profile also distributes:

- `.codebuddy/workflows/*`
- `.codebuddy/taskbooks/*`
- `.codebuddy/agent-calls/*`

### `full`

Compatibility and admin superset. Adds discovery tooling on top of `orchestrator`.

| Script | Category | User-facing CLI | Current Dependencies | Evidence |
|--------|----------|-----------------|----------------------|----------|
| `agent-registry.js` | validator/discovery | Yes | none | integration tests invoke `list/show` directly |

Notes:

- `--enable-orchestrator` now maps to `full` for backward compatibility with the pre-profile distribution set.
- Explicit `--profile orchestrator` gives a leaner runtime that skips `agent-registry.js`.

## Internal Distributed Dependencies

There are no internal helper files copied into business projects after `P1.5`.

All currently distributed `.codebuddy/scripts/*` files are direct entry bundles or the generated `README.md`.

## Stable CLI Entry Points

These names should be treated as stable in business projects during bundling. If implementation changes, preserve these entry names via thin wrappers or equivalent compatibility shims.

| Script | Why It Should Stay Stable |
|--------|---------------------------|
| `structure-analyzer.js` | documented in generated scripts prompt and README |
| `module-mapper.js` | documented in generated scripts prompt |
| `report-manager.js` | documented in generated scripts prompt with multiple subcommands |
| `rule-validator.js` | integration tests invoke it directly |
| `skill-validator.js` | integration tests invoke it directly |
| `agent-registry.js` | integration tests invoke it directly |
| `agent-call-manager.js` | integration tests and generated docs invoke it directly |
| `task-orchestrator.js` | integration tests invoke it directly |
| `taskbook-manager.js` | integration tests invoke it directly |
| `task-executor.js` | integration tests invoke it directly |
| `contract-validator.js` | generated docs expose it directly |
| `reference-finder.js` | explicit CLI contract exists in source |
| `context-collector.js` | explicit CLI contract exists in source |

## Internal-Only Runtime Files

These files are currently distributed because of direct imports, but they should be considered implementation details during bundling.

| File | Stability |
|------|-----------|
| `agent-runtime.js` | internal build artifact, no longer distributed |
| `types/*.js` | internal build artifacts, no longer distributed |
| `lib/frontmatter-utils.js` | internal build artifact, no longer distributed |
| `result-aggregator.js` | internal build artifact, no longer distributed |

## Bundling Implications

### Lowest-Risk First Bundle

Validator entry bundling is the safest first target because it has:

- low runtime coupling
- clear CLI contracts
- direct integration-test coverage

Recommended first-wave contents:

- `rule-validator.js`
- `skill-validator.js`
- `agent-registry.js`
- `contract-validator.js`

Implementation note:

- preserve current CLI entry filenames
- prefer self-contained entry bundles first, then decide later whether a shared `validators.js` runtime is still worth it

### P1.3 Result

`P1.3` chose the lower-risk path:

- `rule-validator.js`
- `skill-validator.js`
- `contract-validator.js`
- `agent-registry.js`

are now built as self-contained bundles during `npm run build`.

Practical effect:

- `skill-validator.js` no longer needs `.codebuddy/scripts/lib/frontmatter-utils.js` in default installs
- `agent-registry.js` no longer needs the shared frontmatter helper as a separate copied dependency
- existing CLI names stay unchanged for tests, generated docs, and business projects

### Second Bundle

`analysis-tools.js`

Recommended contents:

- `structure-analyzer.js`
- `module-mapper.js`
- `report-manager.js`
- `reference-finder.js`
- `context-collector.js`

### P1.4 Result

`P1.4` chose the same lower-risk pattern as `P1.3`:

- keep the public CLI filenames
- build each analysis entry as a self-contained bundle
- remove loader-time distribution of shared analysis type files

Practical effect:

- default business-project installs now copy only:
  - `structure-analyzer.js`
  - `module-mapper.js`
  - `report-manager.js`
  - `rule-validator.js`
  - `skill-validator.js`
  - `README.md`
- the previous helper files `types/reports.js`, `types/structure-analyzer.js`, and `types/module-mapper.js` are no longer needed in default installs
- bundled imports no longer risk accidentally running nested CLIs because analysis scripts now check the expected script basename before calling `main()`

### Last Bundle

`orchestrator-runtime.js`

Recommended contents:

- `task-orchestrator.js`
- `taskbook-manager.js`
- `task-executor.js`
- `agent-call-manager.js`
- `agent-runtime.js`
- `result-aggregator.js`

### P1.5 Result

`P1.5` completed the orchestrator/runtime pass with the same preserved-entry strategy:

- `task-orchestrator.js`
- `taskbook-manager.js`
- `task-executor.js`
- `agent-call-manager.js`

are now built as self-contained entry bundles.

Practical effect:

- full orchestrator installs now copy only:
  - `agent-call-manager.js`
  - `agent-registry.js`
  - `context-collector.js`
  - `contract-validator.js`
  - `module-mapper.js`
  - `README.md`
  - `reference-finder.js`
  - `report-manager.js`
  - `rule-validator.js`
  - `skill-validator.js`
  - `structure-analyzer.js`
  - `taskbook-manager.js`
  - `task-executor.js`
  - `task-orchestrator.js`
- previously required helper files are no longer shipped:
  - `agent-runtime.js`
  - `result-aggregator.js`
  - `types/index.js`
  - `types/agent-runtime.js`
  - `types/reports.js`
  - `types/structure-analyzer.js`
  - `types/module-mapper.js`
  - `lib/frontmatter-utils.js`

### P5 Result

`P5 Distribution Profiles` added explicit loader profiles without changing the stable CLI filenames:

- `core`: validator-only
- `analysis`: default install; same 6-file footprint as the post-`P1.4` default bundle (`README.md` included)
- `orchestrator`: analysis runtime plus task execution/contracts, but without `agent-registry.js`
- `full`: pre-profile compatibility set; equivalent to the old `--enable-orchestrator` script surface

Compatibility note:

- `--enable-orchestrator` is preserved as a backward-compatible alias for `--profile full`
- `--profile orchestrator` is the new lean execution profile introduced by `P5`

## Constraints

- Do not bundle skill, agent, rule, workflow, or taskbook content files into runtime script bundles.
- Do not remove stable business-project CLI names during the first bundling pass.
- Preserve existing integration-test command lines until compatibility coverage is in place.

## Exit Criteria For P1.1

`P1.1 Script Inventory` is complete when:

- the full distributed script list is recorded
- stable CLI entry points are explicitly identified
- internal dependency files are explicitly identified
- bundling order and risk grouping are documented
