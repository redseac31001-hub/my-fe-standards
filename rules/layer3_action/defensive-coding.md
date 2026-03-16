---
name: Defensive Coding Guide
description: 防御性编程边界指南。明确何时需要防御性编程，何时不需要，避免过度防御。
tags:
  - DefensiveCoding
  - ErrorHandling
  - Validation
priority: High
alwaysApply: true
---

# Defensive Coding Guide (防御性编程指南)

> Layer: Action
> Context: 明确防御性编程的边界，避免过度防御导致代码膨胀

<!-- @level:summary -->
## Summary (摘要)

防御性编程是必要的，但**过度防御会导致代码膨胀、可读性下降**。本指南明确何时需要防御，何时不需要。

### 核心原则

- **信任内部数据结构**：稳定的 Vuex store、props 不需要每次都可选链
- **保护外部边界**：用户输入、API 响应必须验证
- **异步操作必须处理错误**：async/await 需要 try-catch
- **简单同步操作不需要 try-catch**：UI 弹窗、样式切换等

<!-- @level:quick -->
## Quick Reference (快速参考)

### 防御性编程优先级

#### P0 级（必须防御）
- [ ] 用户输入验证（表单、URL 参数、query string）
- [ ] 异步操作错误处理（网络请求、文件读写）
- [ ] 敏感数据保护（加密、脱敏）
- [ ] API 响应验证（检查响应结构）

#### P1 级（推荐防御）
- [ ] 可能为空的外部数据使用可选链
- [ ] 关键业务逻辑错误处理
- [ ] 第三方库调用错误处理

#### P2 级（可选，通常不需要）
- [ ] 内部稳定数据结构的可选链
- [ ] 简单同步操作的 try-catch
- [ ] 全面的默认值

### 决策表

| 场景 | 是否需要防御 | 示例 |
|------|-------------|------|
| 用户输入 | ✅ 必须 | 表单验证、URL 参数解析 |
| 外部 API 响应 | ✅ 必须 | `response.data?.user?.name` |
| 异步操作 | ✅ 必须 | `try { await fetch() } catch {}` |
| Vuex/Pinia store | ❌ 不需要 | `store.state.user.name` |
| 组件 props | ❌ 不需要 | `props.title` |
| 简单 UI 操作 | ❌ 不需要 | `visible.value = true` |
| 内部固定常量 | ❌ 不需要 | `CONFIG.API_URL` |

<!-- @level:full -->
## 1. 何时需要防御性编程

### 1.1 用户输入（必须）

用户输入是不可信的，必须验证和转义。

```typescript
// ✅ 正确：验证用户输入
const handleSubmit = (formData: unknown) => {
  // 使用 zod 或其他验证库
  const result = formSchema.safeParse(formData)
  if (!result.success) {
    showError('表单数据无效')
    return
  }
  // 使用验证后的数据
  submitForm(result.data)
}

// ✅ 正确：URL 参数验证
const getUserId = () => {
  const id = route.query.id
  if (typeof id !== 'string' || !id) {
    return null
  }
  return id
}
```

### 1.2 外部 API 响应（必须）

API 响应结构可能与预期不符，需要验证。

```typescript
// ✅ 正确：API 响应验证
const fetchUser = async (id: string) => {
  try {
    const response = await api.get(`/users/${id}`)
    // 验证响应结构
    if (!response.data?.user?.id) {
      throw new Error('Invalid response structure')
    }
    return response.data.user
  } catch (error) {
    console.error('Failed to fetch user:', error)
    return null
  }
}
```

### 1.3 异步操作（必须）

所有异步操作都可能失败，必须处理错误。

```typescript
// ✅ 正确：异步操作错误处理
const saveData = async () => {
  try {
    await api.post('/save', data)
    showSuccess('保存成功')
  } catch (error) {
    showError('保存失败，请重试')
  }
}
```

---

## 2. 何时不需要防御性编程

### 2.1 稳定的内部数据结构

Vuex/Pinia store、组件 props 等内部数据结构是稳定的，不需要每次都可选链。

```typescript
// ❌ 过度防御：稳定的 store 不需要可选链
const payAmt = computed(() => store.state?.nopassword?.payAmt ?? 0)
const userName = computed(() => store.state?.user?.name ?? '')
const goodsName = computed(() => store.state?.nopassword?.goodsName ?? '')

// ✅ 正确：信任稳定的数据结构
const payAmt = computed(() => store.state.nopassword.payAmt)
const userName = computed(() => store.state.user.name)
const goodsName = computed(() => store.state.nopassword.goodsName)
```

**例外情况**：如果 store 的某个字段确实可能为空（如用户未登录时的 user），则需要处理：

```typescript
// ✅ 合理：user 可能为空的情况
const userName = computed(() => store.state.user?.name ?? '游客')
```

### 2.2 简单同步操作

简单的 UI 操作不会抛出异常，不需要 try-catch。

```typescript
// ❌ 过度防御：简单操作不需要 try-catch
const showModal = () => {
  try {
    visible.value = true
  } catch (error) {
    console.error('显示弹窗失败:', error)
  }
}

const toggleExpand = () => {
  try {
    expanded.value = !expanded.value
  } catch (error) {
    console.error('切换展开状态失败:', error)
  }
}

// ✅ 正确：简单操作直接执行
const showModal = () => {
  visible.value = true
}

const toggleExpand = () => {
  expanded.value = !expanded.value
}
```

### 2.3 内部固定 URL/常量

对于内部固定的 URL 或常量，不需要复杂的验证逻辑。

```typescript
// ❌ 过度防御：内部 URL 不需要白名单验证
const ALLOWED_DOMAINS = ['example.com', 'api.example.com']
const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    return ALLOWED_DOMAINS.some(d => parsed.hostname.endsWith(d))
  } catch {
    return false
  }
}

// ✅ 正确：对于内部固定 URL，简单格式检查即可
const isValidUrl = (url: string): boolean => {
  return url.startsWith('http://') || url.startsWith('https://')
}

// ✅ 更简单：对于完全可信的内部 URL，直接使用
const openLink = (url: string) => {
  window.location.href = url  // 内部系统生成的 URL
}
```

---

## 3. 常见过度防御示例

### 3.1 computed 过度可选链

```typescript
// ❌ 过度：9 个 computed 全部使用可选链和默认值
const payAmt = computed(() => store.state?.nopassword?.payAmt ?? 0)
const goodsName = computed(() => store.state?.nopassword?.goodsName ?? '')
const merName = computed(() => store.state?.nopassword?.merName ?? '')
const orderNo = computed(() => store.state?.nopassword?.orderNo ?? '')
const payTypeArr = computed(() => store.state?.nopassword?.payTypeArr ?? [])
const agrChecked = computed(() => store.state?.nopassword?.agrChecked ?? false)
const payMethods = computed(() => store.state?.nopassword?.payMethods ?? [])
const nopassSwitch = computed(() => store.state?.nopassword?.nopassSwitch ?? false)
const callbackUrl = computed(() => store.state?.nopassword?.callbackUrl ?? '')

// ✅ 正确：信任稳定的 store 结构
const payAmt = computed(() => store.state.nopassword.payAmt)
const goodsName = computed(() => store.state.nopassword.goodsName)
const merName = computed(() => store.state.nopassword.merName)
// ... 其他类似
```

### 3.2 所有函数都包裹 try-catch

```typescript
// ❌ 过度：每个函数都 try-catch
const showDetail = () => {
  try {
    window.$vue.$alert({ ... })
  } catch (error) {
    logger.error('显示扣款说明失败:', error)
  }
}

const toAgr = (type: string) => {
  try {
    // 简单的路由跳转
    router.push({ path: '/agreement', query: { type } })
  } catch (error) {
    logger.error('跳转协议页失败:', error)
  }
}

// ✅ 正确：只在异步操作和关键路径使用
const showDetail = () => {
  window.$vue.$alert({ ... })
}

const toAgr = (type: string) => {
  router.push({ path: '/agreement', query: { type } })
}

// ✅ 异步操作需要 try-catch
const paySign = async () => {
  try {
    const result = await signNopasswordAgr(params)
    handleSuccess(result)
  } catch (error) {
    showError('开通失败，请重试')
  }
}
```

---

## 4. 最佳实践总结

### 4.1 决策流程图

```
开始
  │
  ▼
这是用户输入吗？ ──是──▶ ✅ 必须验证
  │
  否
  ▼
这是外部 API 响应吗？ ──是──▶ ✅ 必须验证 + 可选链
  │
  否
  ▼
这是异步操作吗？ ──是──▶ ✅ 必须 try-catch
  │
  否
  ▼
数据来源稳定吗？ ──是──▶ ❌ 不需要过度防御
  │
  否
  ▼
根据具体情况判断
```

### 4.2 一句话总结

> **保护边界，信任内部**：在应用边界（用户输入、API 响应）做防御，在内部稳定结构（store、props）保持简洁。

---

## 5. Metadata

*   **Version**: 1.0
*   **Related Rules**: `refactoring.md`, `self-verification.md`, `strict-types.md`
*   **Purpose**: 防止过度防御性编程导致的代码膨胀
