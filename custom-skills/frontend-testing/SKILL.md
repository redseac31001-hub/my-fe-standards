---
name: frontend-testing
description: Generate tests for frontend components (React/Vue). Supports Vitest, Jest, Vue Test Utils, and React Testing Library. Triggers on testing requests, spec files, or coverage improvements.
metadata:
  triggers:
    - "写测试/测试用例/Mock/断言"
  frameworks:
    - react
    - vue
    - vue2
    - vue3
  roles:
    - frontend
    - fullstack
    - qa
  scenarios:
    - testing
    - coverage
---

# Frontend Testing Skill

Generate high-quality frontend tests for React & Vue components.

## Framework Detection

**Step 1: Identify Framework**
- **React**: `.tsx` files, imports from `@testing-library/react`.
- **Vue 3**: `.vue` files, imports from `vitest`, `@vue/test-utils` (v2), `pinia`.
- **Vue 2**: `.vue` files, imports from `@vue/test-utils` (v1), `vuex`.

**Step 2: Choose Strategy**

| Stack | Reference | Key Tools |
|-------|-----------|-----------|
| **React** | [references/common-patterns.md](references/common-patterns.md) | RTL, Vitest, UserEvent |
| **Vue 3** | [references/vue/testing-vue3.md](references/vue/testing-vue3.md) | VTU v2, Vitest, Pinia |
| **Vue 2** | [references/vue/testing-vue2.md](references/vue/testing-vue2.md) | VTU v1, Jest/Vitest, Vuex |

## Core Testing Workflow

1. **Arrange**: Set up mocks, mount component, define props.
2. **Act**: Trigger events (`fireEvent`, `userEvent`, `wrapper.trigger`).
3. **Assert**: Check DOM state, emitted events, or store state.

### Shared References

- **Execution order**: Start with [references/workflow.md](references/workflow.md) when you need a stable arrange/act/assert sequence across stacks.
- **Mock strategy**: Read [references/mocking.md](references/mocking.md) before mocking network, router, store, or timers.
- **Async behavior**: Use [references/async-testing.md](references/async-testing.md) for `nextTick`, promises, timers, and retryable assertions.
- **Complex domain components**: Use [references/domain-components.md](references/domain-components.md) when the component depends on stores, providers, or feature context.
- **Final checklist**: End with [references/checklist.md](references/checklist.md) before claiming the test is complete.

### React Testing (RTL)

Focus on **User-centric** testing using `screen.getByRole` and `userEvent`.
See `references/common-patterns.md` for RTL patterns.

### Vue Testing (VTU)

Focus on **Component Contract** testing (Props in, Events out).

- **Mounting**: Use `shallowMount` (Vue 2) or `mount` (Vue 3, default) based on need.
- **Events**: Verify `wrapper.emitted()`.
- **State**: Check local state or store integration.

See [references/vue/common-patterns.md](references/vue/common-patterns.md) for shared Vue patterns.

## Coverage Goals

- **Branches**: >95% (Test logic paths)
- **Functions**: 100% (Test handlers)
- **Lines**: >95%

## Templates

- React component template: [assets/component-test.template.tsx](assets/component-test.template.tsx)
- Hook template: [assets/hook-test.template.ts](assets/hook-test.template.ts)
- Utility template: [assets/utility-test.template.ts](assets/utility-test.template.ts)

## Common Mistakes

1. **Testing Implementation Details**:
   - ❌ `wrapper.vm.internalData`
   - ✅ `wrapper.text()` contains result
2. **Not waiting for DOM updates**:
   - ❌ `trigger('click'); expect(...)`
   - ✅ `await trigger('click'); expect(...)` (Vue updates are async)
