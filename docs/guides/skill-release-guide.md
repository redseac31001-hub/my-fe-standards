# Skill Release Guide

> Last updated: 2026-03-17
> Scope: custom skill authoring, validation, packaging, and repository release hygiene

## When To Use This Guide

Use this guide when you:

- create a new skill under `custom-skills/`
- refactor an existing skill into `SKILL.md` + `references/` + `assets/` + `scripts/`
- want to validate whether a skill is ready to ship
- need a short release checklist instead of re-reading the whole `skill-creator` skill

## Minimal Release Shape

A release-ready skill should have:

1. a focused `SKILL.md`
2. explicit links to every bundled `references/`, `assets/`, or `scripts/` file that the user or host should discover
3. valid frontmatter with at least:
   - `name`
   - `description`
4. optional `metadata.*` fields only when they improve routing or portability

Recommended `metadata` keys:

- `triggers`
- `tools`
- `related`
- `languages`
- `frameworks`
- `roles`
- `scenarios`
- `workspace_scope`
- `link_whitelist` for intentional cross-root relative links

## Authoring Rules

### Keep `SKILL.md` lean

`SKILL.md` should mainly answer:

- what the skill does
- when it should trigger
- which bundled files to open next
- what workflow to follow
- what output shape to produce

Do not keep all framework details or deep examples in `SKILL.md`. Move those into `references/`.

### Make bundled files discoverable

If a file is bundled under `references/`, `assets/`, or `scripts/`, add an explicit Markdown link to it from `SKILL.md` or another bundled Markdown file.

This is now enforced by `skill-validator` as a warning-level integrity check.

### Prefer portable wording

Use `Codex`, `agent`, or `host` unless behavior is truly host-specific. Avoid unnecessary tool branding inside reusable skills.

## Validation Flow

### Choose the mode first

Use validator modes intentionally:

- default mode: development-time feedback, warning-tolerant
- `--strict`: release/review gate, warning-intolerant

Behavior summary:

- default mode exits non-zero only on `error`
- `--strict` exits non-zero on both `warning` and `error`
- JSON output exposes:
  - `strictMode`
  - `effectiveOk`

Treat `effectiveOk` as the final pass/fail signal for the chosen mode.

### 1. Repository-level integrity check

Validate the whole skill tree:

```bash
npm run validate:skills
```

Recommended development-time variant:

```bash
node scripts/dist/skill-validator.js check --dir custom-skills --json
```

What this catches:

- missing `SKILL.md`
- broken relative Markdown links
- cross-root relative links without `metadata.link_whitelist`
- bundled files under `references/`, `assets/`, `scripts/` that are never linked from Markdown

### 2. Skill-local structure check

Validate a single skill with the Python helper:

```bash
python custom-skills/skill-creator/scripts/quick_validate.py custom-skills/<skill-name>
```

Use this before packaging to catch local structure issues quickly.

### 3. Packaging check

Verify that the skill can actually be packaged:

```bash
python custom-skills/skill-creator/scripts/package_skill.py custom-skills/<skill-name> <output-dir>
```

This is the closest local proxy to release-readiness.

### 4. Pre-release strict gate

Before merge or release, rerun the validator in strict mode:

```bash
npm run validate:skills:strict
node scripts/dist/skill-validator.js check --dir custom-skills --strict --json
```

Expected interpretation:

- if `warningCount > 0`, strict mode should fail
- `ok` may still stay `true` for backward compatibility
- `effectiveOk` must be `true` before treating the release check as passed

If you want CI-backed proof without changing the default repository gate, use the manually triggered GitHub Actions workflow `Validator Strict Gate`.

## Release Checklist

Before considering a skill change complete:

1. `SKILL.md` is still short and routeable.
2. All bundled `references/`, `assets/`, and `scripts/` are discoverable through Markdown links.
3. `npm run validate:skills` passes without new errors.
4. `npm run validate:skills:strict` passes before release/review gate.
5. `node scripts/dist/skill-validator.js check --dir custom-skills --strict --json` shows `effectiveOk: true` when you need machine-readable proof.
6. `python custom-skills/skill-creator/scripts/quick_validate.py custom-skills/<skill-name>` passes.
7. `python custom-skills/skill-creator/scripts/package_skill.py custom-skills/<skill-name> <output-dir>` passes.
8. If the repository inventory changed, update `custom-skills/skills-index.md`.
9. If released repository content changed, regenerate `manifest.json` and content packs.

## Example Sequences

### Development-time check

```bash
npm run validate:skills
python custom-skills/skill-creator/scripts/quick_validate.py custom-skills/<skill-name>
```

Interpretation:

- warnings can be fixed iteratively
- only hard errors should block active development

### Pre-release check

```bash
npm run validate:skills:strict
python custom-skills/skill-creator/scripts/package_skill.py custom-skills/<skill-name> <output-dir>
```

Interpretation:

- warning-only skills are not considered release-ready in strict mode
- packaging is the final portability check
- if you need a CI-side confirmation, manually trigger `Validator Strict Gate`

## Useful References

- Skill maintenance skill: [`custom-skills/skill-creator/SKILL.md`](../../custom-skills/skill-creator/SKILL.md)
- Skill inventory: [`custom-skills/skills-index.md`](../../custom-skills/skills-index.md)
- Minimal template: [`custom-skills/skill-creator/assets/minimal-skill-template/SKILL.md`](../../custom-skills/skill-creator/assets/minimal-skill-template/SKILL.md)
- Release workflow reference: [`custom-skills/skill-creator/references/release-workflow.md`](../../custom-skills/skill-creator/references/release-workflow.md)
