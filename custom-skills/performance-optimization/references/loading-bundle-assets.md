# Loading, Bundle, And Assets

Use this reference when the problem is slow first paint, heavy routes, or oversized asset payloads.

## Route And Component Lazy Loading

```typescript
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
  },
];
```

```typescript
const HeavyChart = defineAsyncComponent({
  loader: () => import('./HeavyChart.vue'),
  loadingComponent: LoadingSpinner,
  delay: 200,
  timeout: 3000,
});
```

## Bundle Reduction

```typescript
// Prefer narrow imports.
import debounce from 'lodash/debounce';
import { SearchOutlined } from '@ant-design/icons-vue';
```

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          ui: ['ant-design-vue'],
          charts: ['echarts'],
        },
      },
    },
  },
});
```

## Asset Checks

- Compress and right-size images before code-side lazy loading.
- Audit font loading strategy and fallback behavior.
- Use bundle analysis after every chunking change.

## Useful Commands

```bash
npx vite-bundle-visualizer
npx bundlephobia lodash
npx depcheck
```
