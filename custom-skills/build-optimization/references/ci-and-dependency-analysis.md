# CI And Dependency Analysis

Use this reference when the main pain point is pipeline duration, dependency bloat, or repeated cache misses.

## Dependency Analysis

```bash
# Unused dependencies
npx depcheck
npx knip

# Duplicate dependencies
npm ls --all
npm dedupe --dry-run
```

Prioritize removing unused packages before chasing more advanced build tuning.

## GitHub Actions Cache Example

```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: |
      node_modules
      ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

- name: Cache Vite
  uses: actions/cache@v4
  with:
    path: node_modules/.vite
    key: ${{ runner.os }}-vite-${{ hashFiles('**/vite.config.ts') }}
```

## Parallelization Example

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
```

## Verification

- Compare pipeline duration by stage, not just total time.
- Track cache hit rate if the CI provider exposes it.
- Confirm parallel jobs do not duplicate expensive installation work.
- Re-run with cache disabled once to validate true baseline.
