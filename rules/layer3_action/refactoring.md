# Refactoring Checklist & Strategy

> Layer: Action
> Context: Code Refactoring / Technical Debt Paydown

## 1. Strategy
Prioritize **readability** and **testability** over micro-optimizations.
Follow the "Boy Scout Rule": Leave the code cleaner than you found it.

## 2. Checklist
*   [ ] **Type Safety**: Are all `any` types removed?
*   [ ] **Composition**: Is complex logic extracted into `composables`?
*   [ ] **Naming**: Do variable names clearly describe their purpose? (e.g., `isModalOpen` vs `flag`)
*   [ ] **Dead Code**: Remove unused imports, variables, and comments.

## 3. Guide (Architecture)
When refactoring a large component:
1.  Isolate logic into a `.ts` file first.
2.  Add tests for that `.ts` file.
3.  Simplify the Vue template.
