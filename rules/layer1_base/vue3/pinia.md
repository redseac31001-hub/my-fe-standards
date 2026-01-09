# Pinia Store 状态管理规范

> Tags: #Vue3 #Pinia #StateManagement
> Priority: High

<!-- @level:summary -->
## Summary (摘要)

Vue 3 项目必须使用 Pinia 作为状态管理库。优先使用 Setup Store 语法（函数式），为所有 State/Getters/Actions 定义完整 TypeScript 类型。组件中使用 `storeToRefs()` 解构响应式数据，避免响应性丢失。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

- **必须** 使用 Setup Store 语法（函数式）
- **必须** 为 State/Getters/Actions 定义完整 TypeScript 类型
- **必须** 组件中使用 `storeToRefs()` 解构 state/getters
- **禁止** 直接解构 Store（会丢失响应性）
- **禁止** 在 Store 外直接修改 state
- **推荐** 按功能域拆分 Store（user/product/cart）

### Store 定义模板

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null);

  // Getters
  const isLoggedIn = computed(() => !!user.value);

  // Actions
  async function login(credentials: LoginForm) {
    const res = await api.login(credentials);
    user.value = res.user;
  }

  return { user, isLoggedIn, login };
});
```

### 组件使用模板

```typescript
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const { user, isLoggedIn } = storeToRefs(userStore); // 响应式
const { login, logout } = userStore; // actions 不需要 toRefs
```

<!-- @level:full -->
## 1. Context (背景与适用范围)

适用于所有 Vue 3 项目的状态管理。Pinia 是 Vue 3 官方推荐的状态管理库，相比 Vuex 更加简洁、类型安全、模块化。适用场景：跨组件状态共享、复杂业务逻辑管理、全局数据缓存。

## 2. The Rule (规则详情)

### 必须 (Must)

*   **必须** 使用 Setup Store 语法（函数式），而非 Options Store
*   **必须** 为 State/Getters/Actions 定义完整 TypeScript 类型
*   **必须** 组件中使用 `storeToRefs()` 解构 state/getters
*   **必须** 每个 Store 只管理一个业务领域（单一职责）
*   **必须** Store 文件命名 `use[Domain]Store.ts`

### 禁止 (Don't)

*   **禁止** 直接解构 Store（会丢失响应性）
*   **禁止** 在 Store 外直接修改 state（必须通过 actions）
*   **禁止** Store 之间循环依赖
*   **禁止** 在 getters 中执行异步操作
*   **禁止** 新增 Options Store 代码

### 推荐 (Preferred)

*   **推荐** 按功能域拆分 Store（user/product/cart）
*   **推荐** 使用 `pinia-plugin-persistedstate` 实现持久化
*   **推荐** 每个 action 必须有单元测试
*   **推荐** actions 中统一处理异步错误

## 3. Reasoning (核心原理)

### Setup Store 优势

*   **更好的 TypeScript 类型推断**：Setup Store 使用 Composition API 风格，类型推断更加自然和准确
*   **更灵活的组合式 API 风格**：可以使用 `ref`、`computed`、`watch` 等 Vue 3 API
*   **更少的样板代码**：无需手动定义 state/getters/actions 的结构

### 响应性保护

直接解构 Store 会导致响应性丢失，因为解构操作会将响应式对象的属性转换为普通值。`storeToRefs()` 会将 state 和 getters 转换为 ref，保持响应性。actions 是方法，不需要 toRefs。

### 模块化设计

遵循单一职责原则，每个 Store 只管理一个业务领域。避免单一巨型 Store 难以维护。Store 间通信应在 action 中进行，避免顶层导入导致循环依赖。

## 4. Examples (代码示例)

### 示例 1: Store 定义方式

```typescript
// ✅ Good: Setup Store（推荐）
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string>('');

  // Getters
  const isLoggedIn = computed(() => !!token.value);
  const userName = computed(() => user.value?.name ?? 'Guest');

  // Actions
  async function login(credentials: LoginForm) {
    const res = await api.login(credentials);
    user.value = res.user;
    token.value = res.token;
  }

  function logout() {
    user.value = null;
    token.value = '';
  }

  return { user, token, isLoggedIn, userName, login, logout };
});

// ❌ Bad: Options Store（不推荐）
export const useUserStore = defineStore('user', {
  state: () => ({ user: null, token: '' }),
  getters: {
    isLoggedIn: (state) => !!state.token // 类型推断较弱
  },
  actions: {
    async login(credentials) { /* ... */ } // 缺少类型
  }
});
```

### 示例 2: 组件中使用 Store

```typescript
// ✅ Good: 使用 storeToRefs 保持响应性
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const { user, isLoggedIn } = storeToRefs(userStore); // 响应式
const { login, logout } = userStore; // actions 不需要 toRefs

// ❌ Bad: 直接解构导致响应性丢失
const { user, isLoggedIn, login } = useUserStore(); // user 失去响应性
```

### 示例 3: Store 间通信

```typescript
// ✅ Good: 在 action 中调用其他 Store
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([]);

  async function checkout() {
    const userStore = useUserStore(); // 在 action 内部调用
    if (!userStore.isLoggedIn) {
      throw new Error('请先登录');
    }
    await api.checkout(items.value, userStore.token);
  }

  return { items, checkout };
});

// ❌ Bad: 顶层导入导致循环依赖风险
const userStore = useUserStore(); // 可能在 Pinia 初始化前执行

export const useCartStore = defineStore('cart', () => {
  // ...
});
```

### 示例 4: 持久化配置

```typescript
// ✅ Good: 使用插件实现持久化
import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', () => {
  // ...
}, {
  persist: {
    key: 'user-store',
    storage: localStorage,
    paths: ['token'] // 只持久化 token，不持久化敏感信息
  }
});
```

### 示例 5: 测试 Store

```typescript
// ✅ Good: 完整的 Store 测试
import { setActivePinia, createPinia } from 'pinia';
import { useUserStore } from './userStore';

describe('useUserStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); // 每次测试前重置
  });

  it('should login successfully', async () => {
    const store = useUserStore();
    await store.login({ username: 'test', password: '123' });

    expect(store.user).toEqual({ id: 1, name: 'Test' });
    expect(store.isLoggedIn).toBe(true);
  });

  it('should clear state on logout', () => {
    const store = useUserStore();
    store.user = { id: 1, name: 'Test' };
    store.logout();

    expect(store.user).toBeNull();
    expect(store.isLoggedIn).toBe(false);
  });
});
```

## 5. Metadata

*   **Version**: 1.0
*   **Related Rules**: `vue3-script-setup.md`, `testing.md`, `debugging.md`
