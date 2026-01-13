# Vue 2 Options API Refactoring Patterns

This document focuses on refactoring legacy Vue 2 components, primarily to clean up Options API standard patterns or prepare for migration.

## Refactoring Goals for Options API

Even without Composition API, Vue 2 components can be improved.

### Pattern 1: Remove Mixins

**Problem**: Mixins cause naming collisions and implicit dependencies.
**Solution**:
1. If possible, migrate to Composition API (`@vue/composition-api` plugin) and use Composables.
2. If staying in Options API, extract logic into pure utility functions or "Renderless Components" (Slots).

### Pattern 2: Extract Sub-Components

**When**: `template` is exceeding 200-300 lines.

```vue
<!-- ❌ Before: Monolithic Template -->
<template>
  <div>
    <header>...</header> <!-- 50 lines -->
    <div class="content">...</div> <!-- 200 lines -->
    <modal>...</modal> <!-- 100 lines -->
  </div>
</template>

<!-- ✅ After: Sub-components -->
<template>
  <div>
    <AppHeader />
    <AppContent />
    <AppModal />
  </div>
</template>
```

### Pattern 3: Prop Validation

**When**: Props are defined as arrays or without types.

```javascript
// ❌ Before
props: ['userId', 'config']

// ✅ After
props: {
  userId: {
    type: String,
    required: true
  },
  config: {
    type: Object,
    default: () => ({})
  }
}
```

### Pattern 4: Smart vs Dumb Components

- **Smart (Container)**: Handles API calls, Vuex store interaction.
- **Dumb (Presentation)**: Receives props, emits events. No API calls.

Refactor by moving API logic out of leaf components up to a parent container.
