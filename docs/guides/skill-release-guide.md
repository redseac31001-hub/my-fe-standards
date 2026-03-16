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

### 1. Repository-level integrity check

Validate the whole skill tree:

```bash
node scripts/dist/skill-validator.js check --dir custom-skills
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

## Release Checklist

Before considering a skill change complete:

1. `SKILL.md` is still short and routeable.
2. All bundled `references/`, `assets/`, and `scripts/` are discoverable through Markdown links.
3. `node scripts/dist/skill-validator.js check --dir custom-skills` passes without new errors.
4. `python custom-skills/skill-creator/scripts/quick_validate.py custom-skills/<skill-name>` passes.
5. `python custom-skills/skill-creator/scripts/package_skill.py custom-skills/<skill-name> <output-dir>` passes.
6. If the repository inventory changed, update `custom-skills/skills-index.md`.
7. If released repository content changed, regenerate `manifest.json` and content packs.

## Useful References

- Skill maintenance skill: [`custom-skills/skill-creator/SKILL.md`](../../custom-skills/skill-creator/SKILL.md)
- Skill inventory: [`custom-skills/skills-index.md`](../../custom-skills/skills-index.md)
- Minimal template: [`custom-skills/skill-creator/assets/minimal-skill-template/SKILL.md`](../../custom-skills/skill-creator/assets/minimal-skill-template/SKILL.md)
- Release workflow reference: [`custom-skills/skill-creator/references/release-workflow.md`](../../custom-skills/skill-creator/references/release-workflow.md)
