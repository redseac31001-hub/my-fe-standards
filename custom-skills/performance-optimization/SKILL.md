---
name: performance-optimization
description: 前端性能优化技能，涵盖渲染优化、虚拟滚动、懒加载策略和包体积分析。触发条件：性能优化、渲染卡顿、列表性能、包体积过大、加载速度慢。
---

# Performance Optimization Skill

前端性能优化专项技能，提供渲染优化、资源加载和包体积优化的最佳实践。

## 核心能力

1. **渲染性能优化** - Vue/React 渲染优化模式
2. **虚拟滚动** - 长列表性能优化
3. **懒加载策略** - 组件/图片/路由懒加载
4. **包体积优化** - Tree Shaking、代码分割
5. **资源优化** - 图片/字体/CSS 优化

## 渲染优化模式

### Vue 3 优化

```vue
<!-- 使用 v-memo 缓存复杂渲染 -->
<div v-for="item in list" :key="item.id" v-memo="[item.id, item.selected]">
  <ComplexComponent :data="item" />
</div>

<!-- 使用 v-once 渲染静态内容 -->
<div v-once>
  {{ staticContent }}
</div>

<!-- 使用 shallowRef 优化大型对象 -->
<script setup>
import { shallowRef } from 'vue';
const largeData = shallowRef(fetchLargeData());
</script>
```

### 避免不必要的响应式

```typescript
// ❌ 问题：静态数据使用 ref
const config = ref(STATIC_CONFIG); // 不会变化

// ✅ 优化：直接使用或 shallowRef
const config = STATIC_CONFIG;
// 或
const config = shallowRef(STATIC_CONFIG);
```

## 虚拟滚动实现

### 使用 vue-virtual-scroller

```vue
<template>
  <RecycleScroller
    class="scroller"
    :items="items"
    :item-size="50"
    key-field="id"
    v-slot="{ item }"
  >
    <div class="item">{{ item.name }}</div>
  </RecycleScroller>
</template>

<script setup>
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
</script>
```

### 何时使用虚拟滚动

| 列表规模 | 推荐方案 |
|----------|----------|
| < 100 项 | 普通渲染 |
| 100-500 项 | 分页或虚拟滚动 |
| > 500 项 | 虚拟滚动（必须） |

## 懒加载策略

### 路由懒加载

```typescript
// router/index.ts
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/settings',
    component: () => import('@/views/Settings.vue')
  }
];
```

### 组件懒加载

```vue
<script setup>
import { defineAsyncComponent } from 'vue';

const HeavyChart = defineAsyncComponent({
  loader: () => import('./HeavyChart.vue'),
  loadingComponent: LoadingSpinner,
  delay: 200,
  timeout: 3000
});
</script>
```

### 图片懒加载

```vue
<template>
  <img v-lazy="imageSrc" alt="..." />
</template>

<!-- 或使用 Intersection Observer -->
<img
  :src="isVisible ? realSrc : placeholder"
  ref="imageRef"
/>
```

## 包体积优化

### 按需引入

```typescript
// ❌ 全量引入
import _ from 'lodash';
import * as icons from '@ant-design/icons-vue';

// ✅ 按需引入
import debounce from 'lodash/debounce';
import { SearchOutlined } from '@ant-design/icons-vue';
```

### 代码分割策略

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'ui': ['ant-design-vue'],
          'charts': ['echarts']
        }
      }
    }
  }
});
```

## 资源文件

根据具体需求，读取以下参考文档：

- **Vue 响应式优化**: `references/rendering/vue-reactivity.md`
- **虚拟滚动详解**: `references/rendering/virtual-scrolling.md`
- **组件懒加载**: `references/rendering/component-lazy.md`
- **代码分割策略**: `references/bundle/code-splitting.md`
- **Tree Shaking 验证**: `references/bundle/tree-shaking.md`
- **Chunk 分析**: `references/bundle/chunk-analysis.md`
- **图片优化**: `references/assets/image-optimization.md`
- **字体加载**: `references/assets/font-loading.md`

## 分析工具

```bash
# Vite 包分析
npx vite-bundle-visualizer

# 查看依赖大小
npx bundlephobia lodash

# 分析未使用的依赖
npx depcheck
```
