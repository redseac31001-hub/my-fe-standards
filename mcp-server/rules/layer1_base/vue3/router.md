# Vue Router 路由规范

> Tags: #Vue3 #VueRouter #Routing
> Priority: High

<!-- @level:summary -->
## Summary (摘要)

Vue 3 项目必须使用 Vue Router 4.x 进行路由管理。路由配置必须使用 TypeScript 类型定义，组件采用懒加载方式导入。导航守卫用于权限控制和数据预加载，路由元信息存储页面级配置。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

- **必须** 使用 TypeScript 定义路由类型
- **必须** 组件采用懒加载（动态 import）
- **必须** 使用路由元信息存储页面配置
- **禁止** 在路由配置中直接 import 组件
- **禁止** 在守卫中执行耗时同步操作
- **推荐** 按功能模块组织路由配置

### 路由配置模板

```typescript
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/user',
    name: 'User',
    component: () => import('@/views/User.vue'),
    meta: {
      title: '用户中心',
      requiresAuth: true,
      roles: ['user', 'admin']
    }
  }
];
```

### 导航守卫模板

```typescript
router.beforeEach(async (to, from, next) => {
  // 1. 权限检查
  if (to.meta.requiresAuth && !isAuthenticated()) {
    return next('/login');
  }

  // 2. 数据预加载
  if (to.meta.preload) {
    await loadData(to.params.id);
  }

  next();
});
```

<!-- @level:full -->
## 1. Context (背景与适用范围)

适用于所有 Vue 3 单页应用（SPA）的路由管理。Vue Router 4.x 是 Vue 3 官方路由库，提供声明式路由配置、导航守卫、动态路由等功能。适用场景：多页面应用、权限控制、页面切换动画、数据预加载。

## 2. The Rule (规则详情)

### 必须 (Must)

*   **必须** 使用 TypeScript 定义路由类型（`RouteRecordRaw`）
*   **必须** 组件采用懒加载方式导入（`() => import()`）
*   **必须** 使用路由元信息（`meta`）存储页面级配置
*   **必须** 在导航守卫中调用 `next()` 或返回导航结果
*   **必须** 为动态路由参数定义类型

### 禁止 (Don't)

*   **禁止** 在路由配置中直接 import 组件（影响首屏加载）
*   **禁止** 在导航守卫中执行耗时同步操作（阻塞导航）
*   **禁止** 在守卫中直接修改全局状态（使用 Store）
*   **禁止** 硬编码路由路径（使用命名路由）
*   **禁止** 在组件内部直接操作 `window.location`

### 推荐 (Preferred)

*   **推荐** 按功能模块组织路由配置（`routes/modules/`）
*   **推荐** 使用路由懒加载分组（Webpack Magic Comments）
*   **推荐** 在 `meta` 中定义页面标题、权限、缓存策略
*   **推荐** 使用 `scrollBehavior` 控制滚动行为
*   **推荐** 为路由添加过渡动画

## 3. Reasoning (核心原理)

### 懒加载优势

组件懒加载可以将代码分割成多个 chunk，按需加载，减少首屏加载时间。使用 `() => import()` 语法，Webpack/Vite 会自动进行代码分割。

### 导航守卫时机

- `beforeEach`：全局前置守卫，适合权限检查
- `beforeEnter`：路由独享守卫，适合单个路由的逻辑
- `beforeRouteEnter`：组件内守卫，适合数据预加载

### 路由元信息设计

`meta` 字段用于存储路由级别的配置，避免在组件中硬编码。常见用途：页面标题、权限角色、是否缓存、面包屑数据。

## 4. Examples (代码示例)

### 示例 1: 路由配置方式

```typescript
// ✅ Good: 懒加载 + TypeScript 类型
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: {
      title: '仪表盘',
      requiresAuth: true,
      icon: 'dashboard'
    }
  },
  {
    path: '/user/:id',
    name: 'UserDetail',
    component: () => import(
      /* webpackChunkName: "user" */
      '@/views/UserDetail.vue'
    ),
    props: true // 将路由参数作为 props 传递
  }
];

// ❌ Bad: 直接 import（影响首屏加载）
import Dashboard from '@/views/Dashboard.vue';

const routes = [
  {
    path: '/dashboard',
    component: Dashboard // 所有组件都会打包到主 bundle
  }
];
```

### 示例 2: 导航守卫使用

```typescript
// ✅ Good: 异步守卫 + 清晰的逻辑分层
router.beforeEach(async (to, from, next) => {
  // 1. 设置页面标题
  document.title = to.meta.title || '默认标题';

  // 2. 权限检查
  if (to.meta.requiresAuth) {
    const userStore = useUserStore();
    if (!userStore.isLoggedIn) {
      return next({ name: 'Login', query: { redirect: to.fullPath } });
    }

    // 3. 角色检查
    if (to.meta.roles && !to.meta.roles.includes(userStore.role)) {
      return next({ name: 'Forbidden' });
    }
  }

  next();
});

// ❌ Bad: 同步阻塞 + 直接修改全局状态
router.beforeEach((to, from, next) => {
  // 同步的 localStorage 读取（阻塞）
  const token = localStorage.getItem('token');

  // 直接修改全局变量（难以追踪）
  window.currentUser = JSON.parse(localStorage.getItem('user'));

  if (to.meta.requiresAuth && !token) {
    next('/login');
  } else {
    next();
  }
});
```

### 示例 3: 动态路由与参数

```typescript
// ✅ Good: 类型安全的路由参数
import { useRoute } from 'vue-router';

// 定义路由参数类型
interface UserRouteParams {
  id: string;
}

// 组件中使用
const route = useRoute();
const userId = route.params.id as string;

// 或使用 props
defineProps<{
  id: string;
}>();

// 路由配置
{
  path: '/user/:id(\\d+)', // 参数验证：只接受数字
  name: 'UserDetail',
  component: () => import('@/views/UserDetail.vue'),
  props: true
}

// ❌ Bad: 未验证的参数 + 类型不安全
const route = useRoute();
const userId = route.params.id; // any 类型
fetchUser(userId); // 可能传入非法值
```

### 示例 4: 路由元信息与权限

```typescript
// ✅ Good: 结构化的 meta 定义
import type { RouteMeta } from 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
    roles?: string[];
    keepAlive?: boolean;
    icon?: string;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/Admin.vue'),
    meta: {
      title: '管理后台',
      requiresAuth: true,
      roles: ['admin'],
      keepAlive: true
    }
  }
];

// 守卫中使用
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth) {
    // TypeScript 可以推断 meta 的类型
    const requiredRoles = to.meta.roles || [];
    // ...
  }
  next();
});

// ❌ Bad: 未定义类型的 meta
const routes = [
  {
    path: '/admin',
    meta: {
      auth: true, // 拼写错误
      role: 'admin' // 应该是 roles 数组
    }
  }
];
```

### 示例 5: 滚动行为控制

```typescript
// ✅ Good: 智能滚动行为
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // 1. 浏览器前进/后退时恢复位置
    if (savedPosition) {
      return savedPosition;
    }

    // 2. 锚点跳转
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth'
      };
    }

    // 3. 默认滚动到顶部
    return { top: 0 };
  }
});

// ❌ Bad: 未处理滚动行为
const router = createRouter({
  history: createWebHistory(),
  routes
  // 缺少 scrollBehavior，用户体验差
});
```

## 5. Metadata

*   **Version**: 1.0
*   **Related Rules**: `vue3-script-setup.md`, `pinia.md`, `testing.md`
