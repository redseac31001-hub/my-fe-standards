---
name: Debugging Checklist
description: 调试检查清单与策略。涵盖数据流追踪、常见问题排查、调试工具推荐。
---

# Debugging Checklist & Strategy

> Layer: Action
> Context: Bug Investigation / Runtime Issue Resolution

<!-- @level:summary -->
## Summary (摘要)

调试是理解系统行为的过程。采用**假设-验证**的科学思维：先提出假设，再用日志/断点验证。按 Vue 数据流方向逐层排查：用户操作 → 事件处理 → Store → API → 状态更新 → 视图渲染。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 调试前检查

- [ ] **Console**: 查看 DevTools Console 是否有错误
- [ ] **Network**: 检查 API 请求状态码和响应
- [ ] **Version**: 确认代码版本 (`git status`)
- [ ] **Cache**: 清除缓存或硬刷新 (`Ctrl+Shift+R`)

### 常见问题速查

| 问题 | 排查点 |
|------|--------|
| 响应性丢失 | 检查是否解构了 store，使用 `storeToRefs` |
| 异步时序 | 检查 `await` 是否正确使用 |
| Props 未更新 | 检查是否使用 `:prop` 动态绑定 |

### 调试工具

| 工具 | 用途 |
|------|------|
| Vue DevTools | 组件树、状态、事件追踪 |
| Console.log | 快速验证数据值 |
| Breakpoints | 复杂逻辑单步调试 |
| Network Tab | API 请求/响应分析 |

<!-- @level:full -->
## 1. Mindset (思维模式)
调试不仅仅是"找 Bug"，更是理解系统行为的过程。
保持**假设-验证**的科学思维：先提出假设，再用日志/断点验证。

## 2. Pre-Flight Checklist (调试前检查)
*   [ ] **Console**: 打开浏览器 DevTools Console，查看是否有红色错误或警告。
*   [ ] **Network**: 检查 Network Tab，确认 API 请求状态码、响应内容是否符合预期。
*   [ ] **Version**: 确认本地代码是否与预期版本一致（`git status`, `git log -1`）。
*   [ ] **Cache**: 尝试清除浏览器缓存或执行硬刷新 (`Ctrl+Shift+R`)。

## 3. Data Flow Tracing (数据流追踪)
按 Vue 数据流方向逐层排查：

```text
[用户操作] → [事件处理] → [Store/Composable] → [API 请求] → [响应处理] → [状态更新] → [视图渲染]
```

*   **Input**: 事件处理函数是否被正确触发？参数是否正确？
*   **Logic**: Store action/mutation 或 Composable 逻辑是否执行？
*   **Output**: `computed` 或 `watch` 是否响应数据变化？

## 4. Common Patterns (常见排查点)

### 响应性丢失
```typescript
// ❌ 常见错误：解构导致响应性丢失
const { user } = storeToRefs(useUserStore()); // ✅ 正确
const { user } = useUserStore(); // ❌ user 失去响应性

// ❌ 常见错误：直接赋值替换响应式对象
state.list = newList; // ✅ 正确
state = { list: newList }; // ❌ 整个 state 失去响应性
```

### 异步时序问题
```typescript
// 确保 await 或 .then() 正确处理异步逻辑
await fetchData(); // 确认此处是否需要等待
updateUI(); // 如果 fetchData 未 await，这里可能先执行
```

### Props 未更新
*   检查父组件是否传递了正确的 `:prop` (动态绑定) 而非 `prop` (静态字符串)。
*   检查是否误用了 `v-if` 导致组件重新挂载而非更新。

## 5. Tools (调试工具)

| 工具 | 用途 |
|------|------|
| **Vue DevTools** | 组件树、状态、事件追踪 |
| **Console.log** | 快速验证数据值（调试后务必清理） |
| **Breakpoints** | 复杂逻辑的单步调试 |
| **Network Tab** | API 请求/响应分析 |
| **Performance Tab** | 性能瓶颈定位 |

## 6. Metadata
*   **Version**: 1.0
*   **Related Rules**: `refactoring.md`, `testing.md`
