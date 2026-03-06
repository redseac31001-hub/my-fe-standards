# Migration And Testing

Use this reference when the task is migrating Vuex to Pinia, tightening store contracts, or adding store tests.

## Vuex To Pinia Migration

Recommended order:

1. Map current Vuex modules by domain and ownership.
2. Migrate low-risk read-heavy modules first.
3. Replace component access patterns with explicit Pinia stores.
4. Remove legacy Vuex helpers only after the new store path is stable.

Do not migrate every module in one pass if multiple pages still depend on legacy mutations.

## Store Test Baseline

Use [assets/pinia-test.template.ts](../assets/pinia-test.template.ts) as the starting point for new Pinia store tests.

### What To Assert

- State defaults
- Getter/computed behavior
- Action side effects
- Error handling and rollback behavior
- Cross-store coordination when relevant

### Verification

- Run store tests in isolation first.
- Re-check components that consume the store after API or shape changes.
- Validate no reactive contract changed silently for existing pages.
