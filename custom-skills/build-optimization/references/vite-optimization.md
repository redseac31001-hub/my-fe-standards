# Vite Optimization

Use this reference when the project is on Vite and the problem is slow dev startup, long production builds, or oversized chunks.

## Development Startup

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    warmup: {
      clientFiles: ['./src/main.ts', './src/App.vue'],
    },
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', 'axios'],
    exclude: ['your-local-package'],
  },
});
```

Use this when startup is slow because dependency pre-bundling is incomplete or unstable.

## Production Build

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          ui: ['ant-design-vue'],
          utils: ['lodash-es', 'dayjs'],
        },
      },
    },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500,
  },
});
```

Use this when you need to reduce first-load cost or make bundle composition easier to reason about.

## Cache Strategy

```typescript
export default defineConfig({
  cacheDir: 'node_modules/.vite',
});
```

Keep cache keys stable in CI. Cache invalidation should track lockfile plus Vite config changes.

## Verification

- Compare cold and warm build times.
- Inspect chunk sizes before and after.
- Confirm lazy chunks still load correctly in the browser.
- Re-check source maps and error reporting after minification changes.
