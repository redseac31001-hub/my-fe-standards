## Summary

- What changed?
- Why is this needed?

## Change Type

- [ ] Docs only
- [ ] Additive feature
- [ ] Opt-in workflow/profile/tooling change
- [ ] Compatibility-sensitive runtime change
- [ ] Breaking change

## Architecture Constraints Review

Reference: [docs/reference/architecture-constraints.md](docs/reference/architecture-constraints.md)

### Install Path

- [ ] Default install/update commands are unchanged
- [ ] No new mandatory dependency was introduced
- [ ] No new mandatory service was introduced
- [ ] No new manual business-project bootstrap step was introduced

### Runtime Contract

- [ ] `.codebuddy/` core structure remains backward-compatible
- [ ] `install.json` meaning remains backward-compatible, or migration is documented
- [ ] Existing business-project paths remain valid

### Agent-Call / Tooling Path

- [ ] `.codebuddy/agent-calls/<requestId>.prompt.md` contract remains compatible
- [ ] `.codebuddy/agent-calls/<requestId>.result.json` contract remains compatible
- [ ] Remote writeback/API semantics remain compatible, or versioning/migration is documented
- [ ] AI IDE / tool invocation flow does not gain extra mandatory glue steps

### Remote / Release Path

- [ ] Minimal remote artifact set is unchanged
- [ ] `--pack-only` viability is unchanged
- [ ] No extra repository internals became mandatory for remote installs

### Workflow / Execution Path

- [ ] Default workflow operator burden is unchanged
- [ ] New review/evidence/memory steps are opt-in, or the default-path impact is justified below
- [ ] Resume/retry behavior remains backward-compatible, or the migration is documented

## If Any Constraint Changed

- Constraint level:
  - [ ] Level A: wording only
  - [ ] Level B: opt-in / exception only
  - [ ] Level C: compatible baseline change
  - [ ] Level D: breaking change
- Why additive or opt-in was not enough:
- Affected compatibility-sensitive surfaces:
- Migration plan:
- Rollback plan:

## Validation

- [ ] `npm run build`
- [ ] `npm test`
- [ ] Docs/links checked
- [ ] Relevant remote/private-deployment path checked
- [ ] If remote bootstrap/download surface changed, `npm run smoke:remote-powershell` was run

Commands/results:

```text
paste commands and the key result lines here
```

## Notes For Reviewers

- Areas that need extra scrutiny:
- Known limitations or follow-up items:
