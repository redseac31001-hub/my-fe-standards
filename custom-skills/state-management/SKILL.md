---
name: state-management
description: Pinia/Vuex 状态管理重构与测试技能。触发条件：Store 重构、状态逻辑复杂化、Vuex 迁移 Pinia、Store 单元测试编写、状态规范化设计。
triggers:
  - "状态管理/Vuex/Pinia/Store"
---

# State Management Skill

状态管理专项技能，专注于 Pinia/Vuex 的最佳实践、重构模式和测试策略。

## 核心能力

1. **Store 设计模式** - 模块化、组合式 Store 设计
2. **状态规范化** - 复杂状态结构规范化处理
3. **Pinia 最佳实践** - Composition API 集成、类型安全
4. **Vuex → Pinia 迁移** - 渐进式迁移策略
5. **Store 测试** - 单元测试和集成测试

## Store 设计原则

### 单一职责

```typescript
// ❌ 错误：Store 职责过重
const useAppStore = defineStore('app', {
  state: () => ({
    user: null,
    theme: 'light',
    notifications: [],
    cart: [],
    products: []
  })
});

// ✅ 正确：按领域拆分
const useUserStore = defineStore('user', { /* 用户相关 */ });
const useUIStore = defineStore('ui', { /* UI 状态 */ });
const useCartStore = defineStore('cart', { /* 购物车 */ });
```

### 状态规范化

```typescript
// ❌ 错误：嵌套数据结构
interface State {
  posts: Array<{
    id: number;
    author: User;
    comments: Comment[];
  }>;
}

// ✅ 正确：规范化结构
interface NormalizedState {
  posts: Record<number, Post>;
  users: Record<number, User>;
  comments: Record<number, Comment>;
  postIds: number[];
}
```

## Pinia 最佳实践

### Setup Store 模式（推荐）

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCounterStore = defineStore('counter', () => {
  // State
  const count = ref(0);

  // Getters
  const doubleCount = computed(() => count.value * 2);

  // Actions
  function increment() {
    count.value++;
  }

  async function fetchCount() {
    const response = await api.getCount();
    count.value = response.data;
  }

  return {
    count,
    doubleCount,
    increment,
    fetchCount
  };
});
```

### 组合多个 Store

```typescript
import { useUserStore } from './user';
import { useCartStore } from './cart';

export const useCheckoutStore = defineStore('checkout', () => {
  const userStore = useUserStore();
  const cartStore = useCartStore();

  const canCheckout = computed(() =>
    userStore.isLoggedIn && cartStore.itemCount > 0
  );

  return { canCheckout };
});
```

## 资源文件

根据具体需求，读取以下参考文档：

- **Pinia 设计模式**: `references/pinia/store-patterns.md`
- **Composition API 集成**: `references/pinia/composition-api.md`
- **Pinia 测试策略**: `references/pinia/testing.md`
- **Vuex 模块化**: `references/vuex/module-patterns.md`
- **迁移指南**: `references/vuex/migration-to-pinia.md`
- **状态规范化**: `references/complex-state/normalized-state.md`
- **乐观更新**: `references/complex-state/optimistic-updates.md`

## Store 测试模板

使用 `assets/pinia-test.template.ts` 作为测试基础模板。

```typescript
import { setActivePinia, createPinia } from 'pinia';
import { useCounterStore } from '@/stores/counter';

describe('Counter Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('increments count', () => {
    const store = useCounterStore();
    expect(store.count).toBe(0);
    store.increment();
    expect(store.count).toBe(1);
  });

  it('computes double count', () => {
    const store = useCounterStore();
    store.count = 5;
    expect(store.doubleCount).toBe(10);
  });
});
```

## 常见问题处理

### 循环依赖

```typescript
// ❌ 问题：Store 间循环依赖
// storeA.ts
import { useStoreB } from './storeB'; // B 也引用 A

// ✅ 解决：在 action 内部获取
export const useStoreA = defineStore('a', () => {
  function someAction() {
    const storeB = useStoreB(); // 延迟获取
    // ...
  }
});
```

### 响应式丢失

```typescript
// ❌ 问题：解构导致响应式丢失
const { count } = useCounterStore();

// ✅ 解决：使用 storeToRefs
import { storeToRefs } from 'pinia';
const store = useCounterStore();
const { count } = storeToRefs(store);
```
