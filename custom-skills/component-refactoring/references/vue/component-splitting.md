# Vue Component Splitting Patterns

## Pattern 1: Component Extraction (General)

**When**: A single `.vue` file exceeds 300 lines or handles multiple distinct UI responsibilities.

**Structure**:
```
components/
  UserDashboard/
    UserDashboard.vue   (Main container)
    UserProfile.vue     (Sub-component)
    UserSettings.vue    (Sub-component)
    composables/        (Local logic)
```

## Pattern 2: Slot Pattern (Templates)

**When**: Passing large chunks of HTML/components as props makes the component rigid.

```vue
<!-- ❌ Before: Configuration via Props -->
<Card 
  title="My Card" 
  actionLabel="Edit" 
  @action="onEdit" 
  content="Some content string..." 
/>

<!-- ✅ After: Slots for Flexibility -->
<Card>
  <template #header>
    My Card
    <Button @click="onEdit">Edit</Button>
  </template>
  <template #default>
    <div>Complex content...</div>
  </template>
</Card>
```

## Pattern 3: Async Components (Performance)

**When**: Heavy components (charts, maps, editors) that are not immediately visible.

```typescript
// Vue 3
import { defineAsyncComponent } from 'vue'

const AsyncChart = defineAsyncComponent(() =>
  import('./components/HeavyChart.vue')
)
```

```javascript
// Vue 2
const AsyncChart = () => import('./components/HeavyChart.vue')
```

## Pattern 4: Generic Components (TypeScript)

**When**: Building reusable UI libraries (Tables, Lists) that handle different data types.

```vue
<!-- Vue 3.3+ Generic Components -->
<script setup lang="ts" generic="T">
defineProps<{
  items: T[]
  renderItem: (item: T) => any
}>()
</script>
```
