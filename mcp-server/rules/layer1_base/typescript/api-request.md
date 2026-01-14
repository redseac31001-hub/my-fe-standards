# API 请求规范

> Layer: Base
> Context: HTTP Request Management (Axios/Fetch + TypeScript)

<!-- @level:summary -->
## Summary (摘要)

统一封装 HTTP 请求，使用 Axios 实例配置 baseURL/timeout，拦截器处理 Token 和错误，TypeScript 定义请求/响应类型。请求取消使用 AbortController，网络错误自动重试最多3次。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| 请求封装 | 统一封装 Axios 实例，配置 baseURL/timeout |
| 拦截器 | 请求拦截添加 Token，响应拦截处理错误 |
| 错误处理 | 统一错误码映射，区分业务错误和网络错误 |
| 请求取消 | 使用 AbortController，路由切换时取消 |
| 重试机制 | 网络错误自动重试，最多3次，指数退避 |
| 类型安全 | 定义 API 接口类型，使用泛型约束响应 |

### 常用场景速查

| 场景 | 推荐方案 |
|------|----------|
| Token 刷新 | 拦截器 + 请求队列 + 无感刷新 |
| 文件上传 | FormData + onUploadProgress 进度回调 |
| 并发控制 | Promise.all + p-limit 限流 |
| 请求去重 | Map 缓存 pending 请求 |
| 超时处理 | timeout: 10000 + 重试机制 |
| 取消请求 | AbortController + 路由守卫 |

### 禁止写法

- 在组件中直接调用 `axios.get/post`
- 硬编码 API 地址和 Token
- 不处理错误响应（静默失败）
- 使用 `any` 类型定义响应数据
- 在拦截器中执行耗时同步操作

<!-- @level:full -->
## 1. The Rule

### 请求封装原则

*   **必须** 统一封装 Axios 实例，配置 `baseURL`、`timeout`、`headers`。
*   **禁止** 在组件中直接调用 `axios.get/post`，必须通过封装的 API 模块。
*   **必须** 为每个 API 接口定义 TypeScript 类型（请求参数 + 响应数据）。

### 拦截器设计

*   **必须** 在请求拦截器中添加 Token（从 Store 或 localStorage 获取）。
*   **必须** 在响应拦截器中统一处理错误（业务错误码 + 网络错误）。
*   **推荐** 实现 Token 刷新机制（401 时自动刷新 + 请求队列）。

### 错误处理策略

*   **必须** 区分业务错误（code !== 0）和网络错误（status !== 200）。
*   **必须** 统一错误码映射，提供友好的错误提示。
*   **推荐** 使用 `message.error()` 或 `Toast` 显示错误信息。
*   **禁止** 静默失败（catch 后不处理）。

### 请求取消

*   **必须** 使用 `AbortController` 实现请求取消。
*   **推荐** 在路由切换时取消未完成的请求。
*   **推荐** 为长时间请求提供取消按钮。

### 重试机制

*   **推荐** 网络错误（timeout、network error）自动重试，最多3次。
*   **推荐** 使用指数退避策略（1s、2s、4s）。
*   **禁止** 业务错误（401、403、404）自动重试。

### 类型安全

*   **必须** 为 API 接口定义请求参数和响应数据的 TypeScript 类型。
*   **必须** 使用泛型约束响应数据类型（`request<T>`）。
*   **禁止** 使用 `any` 类型定义响应数据。

## 2. Common Patterns

### 基础封装（Axios 实例）

```typescript
// src/utils/request.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'ant-design-vue';
import { useUserStore } from '@/stores/user';

// 响应数据结构
interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

// 创建 Axios 实例
const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器：添加 Token
instance.interceptors.request.use(
  (config) => {
    const userStore = useUserStore();
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一错误处理
instance.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { code, data, message: msg } = response.data;

    // 业务成功
    if (code === 0) {
      return data;
    }

    // 业务错误
    message.error(msg || '请求失败');
    return Promise.reject(new Error(msg));
  },
  (error) => {
    // 网络错误
    if (error.response) {
      const { status } = error.response;
      const errorMap: Record<number, string> = {
        401: '未授权，请重新登录',
        403: '拒绝访问',
        404: '请求的资源不存在',
        500: '服务器错误',
        503: '服务不可用'
      };
      message.error(errorMap[status] || '请求失败');
    } else if (error.code === 'ECONNABORTED') {
      message.error('请求超时，请稍后重试');
    } else {
      message.error('网络错误，请检查网络连接');
    }
    return Promise.reject(error);
  }
);

// 封装请求方法
export function request<T = any>(config: AxiosRequestConfig): Promise<T> {
  return instance.request<any, T>(config);
}

export default instance;
```

### Token 刷新机制

```typescript
// src/utils/request.ts
import axios from 'axios';

let isRefreshing = false;
let requestQueue: Array<(token: string) => void> = [];

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Token 过期，刷新 Token
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 正在刷新，将请求加入队列
        return new Promise((resolve) => {
          requestQueue.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(instance(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // 刷新 Token
        const userStore = useUserStore();
        const newToken = await userStore.refreshToken();

        // 更新队列中的请求
        requestQueue.forEach((cb) => cb(newToken));
        requestQueue = [];

        // 重试原始请求
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return instance(originalRequest);
      } catch (refreshError) {
        // 刷新失败，跳转登录
        const userStore = useUserStore();
        userStore.logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

### API 接口定义（类型安全）

```typescript
// src/api/user.ts
import { request } from '@/utils/request';

// 请求参数类型
interface LoginParams {
  username: string;
  password: string;
}

// 响应数据类型
interface LoginResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

interface UserInfo {
  id: number;
  name: string;
  email: string;
  avatar: string;
}

// API 接口
export const userApi = {
  // 登录
  login(params: LoginParams) {
    return request<LoginResponse>({
      url: '/auth/login',
      method: 'POST',
      data: params
    });
  },

  // 获取用户信息
  getUserInfo(userId: number) {
    return request<UserInfo>({
      url: `/users/${userId}`,
      method: 'GET'
    });
  },

  // 更新用户信息
  updateUser(userId: number, data: Partial<UserInfo>) {
    return request<UserInfo>({
      url: `/users/${userId}`,
      method: 'PUT',
      data
    });
  }
};
```

### 请求取消（AbortController）

```typescript
// src/composables/useRequest.ts
import { ref, onUnmounted } from 'vue';
import { request } from '@/utils/request';
import type { AxiosRequestConfig } from 'axios';

export function useRequest<T = any>() {
  const loading = ref(false);
  const data = ref<T | null>(null);
  const error = ref<Error | null>(null);
  const abortController = ref<AbortController | null>(null);

  const execute = async (config: AxiosRequestConfig) => {
    loading.value = true;
    error.value = null;

    // 创建 AbortController
    abortController.value = new AbortController();

    try {
      const result = await request<T>({
        ...config,
        signal: abortController.value.signal
      });
      data.value = result;
      return result;
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Request canceled:', err.message);
      } else {
        error.value = err as Error;
      }
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const cancel = (message?: string) => {
    abortController.value?.abort(message);
  };

  // 组件卸载时取消请求
  onUnmounted(() => {
    cancel('Component unmounted');
  });

  return { loading, data, error, execute, cancel };
}

// 使用示例
const { loading, data, execute, cancel } = useRequest<UserInfo>();

// 发起请求
execute({ url: '/users/1', method: 'GET' });

// 取消请求
cancel('User canceled');
```

### 路由切换时取消请求

```typescript
// src/router/index.ts
import { createRouter } from 'vue-router';

const router = createRouter({
  // ...
});

// 全局请求取消器
const pendingRequests = new Map<string, AbortController>();

// 添加请求到 pending 列表
export function addPendingRequest(config: AxiosRequestConfig) {
  const key = `${config.method}:${config.url}`;
  const controller = new AbortController();
  config.signal = controller.signal;
  pendingRequests.set(key, controller);
}

// 移除已完成的请求
export function removePendingRequest(config: AxiosRequestConfig) {
  const key = `${config.method}:${config.url}`;
  pendingRequests.delete(key);
}

// 取消所有 pending 请求
export function cancelAllPendingRequests() {
  pendingRequests.forEach((controller) => {
    controller.abort('Route changed');
  });
  pendingRequests.clear();
}

// 路由守卫：切换路由时取消请求
router.beforeEach((to, from, next) => {
  cancelAllPendingRequests();
  next();
});
```

### 重试机制（指数退避）

```typescript
// src/utils/request.ts
import axios, { AxiosRequestConfig } from 'axios';

interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: any) => boolean;
}

async function requestWithRetry<T>(
  config: AxiosRequestConfig,
  retryConfig: RetryConfig = { retries: 3, retryDelay: 1000 }
): Promise<T> {
  const { retries, retryDelay, retryCondition } = retryConfig;

  for (let i = 0; i <= retries; i++) {
    try {
      return await request<T>(config);
    } catch (error) {
      // 最后一次重试失败，抛出错误
      if (i === retries) {
        throw error;
      }

      // 检查是否应该重试
      const shouldRetry = retryCondition
        ? retryCondition(error)
        : isNetworkError(error);

      if (!shouldRetry) {
        throw error;
      }

      // 指数退避：1s, 2s, 4s
      const delay = retryDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${retries} after ${delay}ms`);
      await sleep(delay);
    }
  }

  throw new Error('Max retries exceeded');
}

// 判断是否为网络错误
function isNetworkError(error: any): boolean {
  return (
    !error.response || // 无响应（网络错误）
    error.code === 'ECONNABORTED' || // 超时
    error.code === 'ERR_NETWORK' // 网络错误
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 使用示例
const data = await requestWithRetry<UserInfo>({
  url: '/users/1',
  method: 'GET'
}, {
  retries: 3,
  retryDelay: 1000,
  retryCondition: isNetworkError
});
```

### 文件上传（进度回调）

```typescript
// src/api/upload.ts
import { request } from '@/utils/request';
import type { AxiosProgressEvent } from 'axios';

interface UploadResponse {
  url: string;
  filename: string;
  size: number;
}

export function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
) {
  const formData = new FormData();
  formData.append('file', file);

  return request<UploadResponse>({
    url: '/upload',
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total) {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress?.(progress);
      }
    }
  });
}

// 使用示例
const progress = ref(0);

uploadFile(file, (p) => {
  progress.value = p;
  console.log(`Upload progress: ${p}%`);
});
```

### 并发控制（限流）

```typescript
// src/utils/request.ts
import pLimit from 'p-limit';

// 创建限流器（最多同时3个请求）
const limit = pLimit(3);

// 批量请求
async function batchRequest<T>(
  configs: AxiosRequestConfig[]
): Promise<T[]> {
  const tasks = configs.map((config) =>
    limit(() => request<T>(config))
  );
  return Promise.all(tasks);
}

// 使用示例
const userIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const configs = userIds.map((id) => ({
  url: `/users/${id}`,
  method: 'GET' as const
}));

const users = await batchRequest<UserInfo>(configs);
```

### 请求去重

```typescript
// src/utils/request.ts
const pendingMap = new Map<string, Promise<any>>();

function generateKey(config: AxiosRequestConfig): string {
  const { method, url, params, data } = config;
  return [method, url, JSON.stringify(params), JSON.stringify(data)].join('&');
}

function requestWithDedup<T>(config: AxiosRequestConfig): Promise<T> {
  const key = generateKey(config);

  // 如果已有相同请求在进行中，返回该请求的 Promise
  if (pendingMap.has(key)) {
    return pendingMap.get(key)!;
  }

  // 发起新请求
  const promise = request<T>(config).finally(() => {
    pendingMap.delete(key);
  });

  pendingMap.set(key, promise);
  return promise;
}

// 使用示例
// 短时间内多次调用，只会发起一次请求
requestWithDedup<UserInfo>({ url: '/users/1', method: 'GET' });
requestWithDedup<UserInfo>({ url: '/users/1', method: 'GET' });
requestWithDedup<UserInfo>({ url: '/users/1', method: 'GET' });
```

## 3. Metadata

*   **Version**: 1.0
*   **Related Rules**: `pinia.md`, `router.md`, `testing.md`
