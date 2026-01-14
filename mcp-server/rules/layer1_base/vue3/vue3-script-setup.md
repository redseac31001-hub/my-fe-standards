# Vue 3 Component Structure & Script Setup

> Tags: #Vue3 #CompositionAPI #ScriptSetup
> Priority: High

<!-- @level:summary -->
## Summary (摘要)

Vue 3 组件必须使用 `<script setup lang="ts">` 编写，禁止新增 Options API 代码。复杂逻辑抽取为 Composable 函数 (`use...`)。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

- **必须** 使用 `<script setup lang="ts">`
- **禁止** 新增 Options API 代码
- **必须** 复杂逻辑抽取为 Composable
- **推荐** 宏定义顺序：`defineProps` → `defineEmits` → `defineExpose`

### 组件模板

```vue
<script setup lang="ts">
// 1. Types & Props
interface Props { title: string; count?: number; }
const props = withDefaults(defineProps<Props>(), { count: 0 });

// 2. Emits
const emit = defineEmits<{ (e: 'update', value: number): void; }>();

// 3. Logic
const { userInfo } = useUser();
</script>
```

<!-- @level:full -->
## 1. Context (背景与适用范围)
适用于所有 Vue 3 单文件组件 (SFC)。
Vue 3 提供了多种编写组件的方式（Options API, Composition API with `setup()`, `<script setup>`）。为了统一团队风格并获得更好的 TypeScript 支持和运行时性能，我们需要明确首选方案。

## 2. The Rule (规则详情)

*   **必须** 使用 `<script setup lang="ts">` 作为编写 Vue 组件的默认方式。
*   **禁止** 新增使用 Options API 的代码（除非维护极旧的遗留代码）。
*   **必须** 保持顶层代码的整洁。将复杂的逻辑抽取为 Composable 函数 (`use...`)。
*   **推荐** 宏定义顺序：`defineProps`, `defineEmits`, `defineExpose`。

## 3. Reasoning (核心原理)
*   **Less Boilerplate**: `<script setup>` 减少了大量的样板代码（无需手动 return 变量）。
*   **Better Types**: 对 TypeScript 的支持更加原生和友好，尤其是 props 和 emits 的类型定义。
*   **Performance**: 编译出的代码通常具有更好的运行时性能（模板编译优化）。

## 4. Examples (代码示例)

### ✅ Good (推荐写法)
```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useUser } from '@/composables/useUser';

// 1. Types & Props
interface Props {
  title: string;
  count?: number;
}
const props = withDefaults(defineProps<Props>(), {
  count: 0
});

// 2. Emits
const emit = defineEmits<{
  (e: 'update', value: number): void;
}>();

// 3. Logic
const { userInfo } = useUser();
const doubleCount = computed(() => props.count * 2);

function handeClick() {
  emit('update', doubleCount.value);
}
</script>

<template>
  <div @click="handeClick">
    <h1>{{ title }} - {{ userInfo.name }}</h1>
  </div>
</template>
```

### ❌ Bad (禁止写法)
```vue
<script lang="ts">
import { defineComponent, ref } from 'vue';

export default defineComponent({
  props: {
    title: String
  },
  setup(props, { emit }) {
    // 需要手动返回所有绑定的变量，容易遗漏且冗余
    const internalValue = ref(0);
    return {
      internalValue
    };
  }
});
</script>
```
