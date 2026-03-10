# Skills Index

> Updated: 2026-03-10
> Scope: current `custom-skills/` inventory, routing, and maintenance conventions

This file is the current entry point for the repository's custom skills. Use each skill's `SKILL.md` and bundled `references/`, `scripts/`, and `assets/` for execution details.

## Inventory

There are **15** custom skills in this repository.

| Category | Skill | Purpose | Typical triggers |
|----------|-------|---------|------------------|
| Quality | `frontend-code-review` | Review frontend changes and files | code review, pending changes, review this file |
| Quality | `component-refactoring` | Refactor large React/Vue components | split component, reduce complexity, extract hook |
| Quality | `frontend-testing` | Generate React/Vue tests | spec, test, coverage, Vitest, Jest |
| Quality | `state-management` | Refactor and test Vuex/Pinia stores | store redesign, Vuex migration, state tests |
| Quality | `performance-optimization` | Improve frontend runtime performance | slow rendering, large lists, loading slow |
| Quality | `build-optimization` | Improve Vite/Webpack and CI builds | slow build, bundle size, cache tuning |
| Quality | `i18n-a11y` | Handle i18n and accessibility | i18n, multilingual, a11y, WCAG |
| Analysis | `structure-review` | Audit project structure and health | project structure, architecture health, directory review |
| Analysis | `module-mapping` | Map modules and dependencies | module map, dependency graph, project map |
| Backend | `backend-code-review` | Review backend services and APIs | backend review, API review, service review |
| Backend | `backend-testing` | Generate backend tests | backend testing, integration test, API testing |
| Product | `prd` | Generate a PRD | write PRD, plan feature, create requirements |
| Product | `system-overview-design` | Generate a system overview design document from the bundled official Word template and project materials | 系统概要设计, 概要设计文档, 生成概要设计, 设计方案 |
| Product | `ralph-converter` | Convert a PRD to Ralph `prd.json` | convert PRD, Ralph format, prd.json |
| Meta | `skill-creator` | Create or refactor skills | new skill, update skill, restructure skill |

## Recommended Routing

### Structure and architecture

Use this chain when the user starts from architecture or directory concerns:

1. `structure-review`
2. `module-mapping`
3. `component-refactoring`
4. `frontend-testing`

### Code quality delivery

Use this chain when the user starts from implementation quality:

1. `frontend-code-review`
2. `component-refactoring`
3. `frontend-testing`
4. `performance-optimization` / `build-optimization` / `i18n-a11y`

### Backend delivery

Use this chain for backend services:

1. `structure-review` / `module-mapping`
2. `backend-code-review`
3. `backend-testing`

### Product to execution

Use this chain for product planning flows:

1. `prd`
2. `structure-review` / `module-mapping`
3. `system-overview-design`
4. `ralph-converter`

### Skill maintenance

Use `skill-creator` for:

- defining triggers
- restructuring `SKILL.md`
- moving detailed content into `references/`
- validating and packaging skills

## Maintenance Rules

### Keep `SKILL.md` lean

Put only the routing skeleton in `SKILL.md`:

- what the skill does
- when it triggers
- which reference files to load
- the workflow and output expectations

Move framework details, deep examples, and product-specific notes into `references/`.

Recommended `metadata` keys:

- `triggers`
- `tools`
- `related`
- `languages`
- `frameworks`
- `roles`
- `scenarios`
- `workspace_scope`
- `link_whitelist` (only for intentional links outside the skill root)

### Keep host wording neutral

Prefer `Codex`, `agent`, or `host` over tool-specific wording unless a behavior is truly host-specific.

### Separate generic knowledge from project knowledge

- keep generic workflow in `SKILL.md`
- keep framework-specific details in focused reference files
- keep business-product specifics isolated so they can later move into stack or product packs

### Script repeated operations

Move high-repeat or deterministic actions into `scripts/` when they are:

- easy to get wrong by hand
- used across multiple skills
- expected to produce stable structured output

## Validation

Validate a single skill:

```bash
python custom-skills/skill-creator/scripts/quick_validate.py custom-skills/<skill-name>
```

Package-check a single skill:

```bash
python custom-skills/skill-creator/scripts/package_skill.py custom-skills/<skill-name> <output-dir>
```

Bulk-validate all skills in PowerShell:

```powershell
Get-ChildItem custom-skills -Directory | ForEach-Object {
  $skill = Join-Path $_.FullName 'SKILL.md'
  if (Test-Path $skill) {
    python custom-skills\skill-creator\scripts\quick_validate.py $_.FullName
  }
}
```

Release references:

- Minimal template: `custom-skills/skill-creator/assets/minimal-skill-template/SKILL.md`
- Release flow: `custom-skills/skill-creator/references/release-workflow.md`

## Relationship to Agents

- **Skills** provide reusable knowledge, workflows, and assets
- **Agents** coordinate multi-step execution and reporting

If a flow needs long-term reuse, stabilize it as a skill first and let agents orchestrate it later.
