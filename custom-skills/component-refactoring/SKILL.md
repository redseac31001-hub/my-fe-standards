---
name: component-refactoring
description: Refactor high-complexity React or Vue components. Use when complexity > 50, lineCount > 300, or user asks for code splitting, hook/composable extraction. Supports React (Hooks) and Vue (2 Options API, 3 Composition API).
---

# Component Refactoring Skill

Refactor high-complexity React or Vue components with established patterns.

## Detection & Routing

**Step 1: Identify Framework**
Look at the file extension and code patterns:
- **React**: `.tsx`, `.jsx`, `useState`, `useEffect`
- **Vue 3**: `.vue` (with `<script setup>`), `ref`, `reactive`, `computed` (from 'vue')
- **Vue 2**: `.vue` (Options API: `data()`, `methods`, `mixins`)

**Step 2: Choose Strategy**

| Framework | Strategy Ref | Key Actions |
|-----------|--------------|-------------|
| **React** | [references/react-hook-extraction.md](references/react-hook-extraction.md) | Extract custom hooks, sub-components |
| **Vue 3** | [references/vue/composition-api.md](references/vue/composition-api.md) | Extract composables, use `script setup` |
| **Vue 2** | [references/vue/options-api.md](references/vue/options-api.md) | Remove mixins, extract sub-components |

## Quick Reference Commands

```bash
# Analyze complexity (Works for both .tsx and .vue)
pnpm analyze-component <path> --json

# Generate refactoring prompt
pnpm refactor-component <path>
```

## Core Refactoring Workflow

1. **Analyze**: Check complexity limits (Score > 50, Lines > 300).
2. **Plan**: Select 1-2 refactoring moves (e.g., "Extract logic to hook/composable").
3. **Execute**: Apply changes incrementally.
4. **Verify**: Functionality check + Type check.

### React Specifics
See [references/react-hook-extraction.md](references/react-hook-extraction.md) and [references/react-component-splitting.md](references/react-component-splitting.md).

### Vue Specifics
See [references/vue/component-splitting.md](references/vue/component-splitting.md) for general splitting advice.

#### Vue 3 Composition API
- Prefer **Composables** (`useFeature.ts`) over wrapper components for logic.
- Use `defineProps` and `defineEmits` in `<script setup>`.

#### Vue 2 Options API
- **Avoid Mixins**: They hide dependencies. Refactor to pure functions or functional components if possible.
- **Strict Prop Types**: Ensure all props have types and defaults.

## Common Pitfalls

- **State Fragmentation**: Don't split related state variables into different files/hooks unless they are truly independent.
- **Over-abstraction**: Don't create a hook/composable for a single variable. Abstraction should reduce cognitive load, not increase file hopping.
