# Vue 2 Composition API 规范

> Tags: #Vue2 #CompositionAPI #TypeScript
> Priority: High

<!-- @level:summary -->
## Summary (摘要)

在 Vue 2 + `@vue/composition-api` 项目中，组件必须通过 `defineComponent` 定义，复用逻辑应沉淀到 composables，并在 `setup()` 中显式返回模板依赖的数据和方法。避免长期混用 Options API，也不要引入 Vue 3 专属的 `<script setup>`。

---

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| 组件定义 | 必须使用 `defineComponent` |
| 逻辑复用 | 状态和副作用沉淀到 `use*` composables |
| 模板暴露 | 模板用到的数据和方法必须从 `setup()` 返回 |
| 迁移过渡 | Options API 混用只作为短期过渡方案 |
| 语法边界 | 不要默认使用 Vue 3 的 `<script setup>` |

### 推荐做法

- 先把复杂逻辑抽到 composables，再逐步减少 `data/methods/watch` 混用。
- 结合 TypeScript 为 `props`、`ref` 和返回值补足类型。
- 把这套写法当成迁移到 Vue 3 的过渡层，而不是再造一套长期双轨规范。

---

<!-- @level:full -->
## 1. Context
适用于引入了 `@vue/composition-api` 的 Vue 2 项目。旨在让现有项目享受 Vue 3 的逻辑复用优势，同时保持对 Vue 2 的兼容性。

## 2. The Rule

*   **Do**: 必须使用 `defineComponent` 来定义组件，以获得正确的类型推导。
*   **Do**: 将由于逻辑复用产生的状态封装在 `useHooks` (Composables) 中。
*   **Do**: 在 `setup()` 函数中返回所有模板需要使用的数据和方法。
*   **Don't**: 尽量避免与 Options API (`data`, `methods`) 混用，除非是迁移过渡期。
*   **Don't**: 不要使用 Vue 3 特有的 `<script setup>` 语法（除非升级到了 Vue 2.7+ 且配置了相应构建工具）。

## 3. Reasoning
*   **Type Safety**: `defineComponent` 在 Vue 2 + TS 环境下提供了极其重要的类型检查。
*   **Maintainability**: 提前适应 Vue 3 的编程思维，为未来升级铺路。

## 4. Examples

### ✅ Good
```typescript
import { defineComponent, ref, onMounted } from '@vue/composition-api';

export default defineComponent({
  name: 'UserProfile',
  props: {
    userId: { type: String, required: true }
  },
  setup(props) {
    const user = ref(null);

    onMounted(() => {
      // 逻辑处理
    });

    return { user };
  }
});
```

### ❌ Bad
```typescript
// 缺少 defineComponent，类型丢失
export default {
  setup() {
    // ...
  }
}
```
