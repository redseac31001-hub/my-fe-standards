# Rendering And Lists

Use this reference when the bottleneck is re-render frequency, long lists, or reactive overhead.

## Vue Rendering Patterns

```vue
<div v-for="item in list" :key="item.id" v-memo="[item.id, item.selected]">
  <ComplexComponent :data="item" />
</div>

<div v-once>
  {{ staticContent }}
</div>

<script setup>
import { shallowRef } from 'vue';
const largeData = shallowRef(fetchLargeData());
</script>
```

## Reactive Overhead

```typescript
// Avoid making static config reactive.
const config = STATIC_CONFIG;
```

Prefer plain constants or `shallowRef` for large immutable objects.

## Virtual Scrolling

```vue
<RecycleScroller
  class="scroller"
  :items="items"
  :item-size="50"
  key-field="id"
  v-slot="{ item }"
>
  <div class="item">{{ item.name }}</div>
</RecycleScroller>
```

| List Size | Recommendation |
|-----------|----------------|
| `< 100` | Regular render |
| `100-500` | Pagination or virtualization |
| `> 500` | Virtualization required |

## Verification

- Measure list scroll smoothness and interaction latency.
- Confirm memoization does not hide legitimate updates.
- Test with realistic data volume, not demo-size arrays.
