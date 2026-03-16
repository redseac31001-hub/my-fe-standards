---
name: Refactoring Checklist
description: 重构检查清单与策略。关注可读性、可测试性、代码整洁度。
tags:
  - Refactoring
  - CodeQuality
  - Maintainability
priority: High
alwaysApply: true
---

# Refactoring Checklist & Strategy

> Layer: Action
> Context: Code Refactoring / Technical Debt Paydown

<!-- @level:summary -->
## Summary (摘要)

重构优先考虑**可读性**和**可测试性**，遵循 Boy Scout Rule：让代码比你发现时更整洁。

### ⚠️ 重构边界原则（Anti-Over-Engineering）

**最小改动原则**：
- **仅重构与当前任务直接相关的代码**
- **不要"顺手"修复无关问题**
- **遗留代码保持现状，除非明确要求重构**

**不需要重构的情况**：
- 简单的 UI 展示逻辑
- 已稳定运行的遗留代码
- 与当前任务无关的代码

<!-- @level:quick -->
## Quick Reference (快速参考)

### 重构检查清单（分级）

#### P0 级（必须）
- [ ] **Bug 修复**: 修复已知 Bug（如未定义的函数、语法错误）
- [ ] **功能等价**: 重构后功能与原代码完全一致
- [ ] **编译通过**: 代码能正常编译，无类型错误

#### P1 级（推荐，仅对新代码或明确要求时）
- [ ] **Type Safety**: 移除显式 `any` 类型
- [ ] **Composition**: 复杂逻辑抽取为 `composables`（仅当逻辑确实复杂时）
- [ ] **Naming**: 变量名清晰描述用途

#### P2 级（可选，仅在明确要求全面重构时）
- [ ] **Dead Code**: 移除未使用的 imports、变量
- [ ] **常量提取**: 魔法字符串/数字提取为常量
- [ ] **完整类型定义**: 为所有数据结构添加接口定义

### 大组件重构步骤

1. 将逻辑隔离到 `.ts` 文件
2. 为该 `.ts` 文件添加测试
3. 简化 Vue 模板

<!-- @level:full -->
## 1. Strategy

Prioritize **readability** and **testability** over micro-optimizations.
Follow the "Boy Scout Rule": Leave the code cleaner than you found it.

**但要注意边界**：
- 不要让 Boy Scout Rule 变成"重写整个文件"
- 改动范围应与任务范围匹配
- 遗留代码的技术债务应单独立项处理

## 2. Checklist（完整版）

### P0 级（必须 - 每次重构都要检查）
*   [ ] **Bug 修复**: 是否修复了发现的明显 Bug？
*   [ ] **功能等价**: 重构后是否保持了原有功能？
*   [ ] **编译通过**: 代码是否能正常编译？

### P1 级（推荐 - 对于新代码或主动重构）
*   [ ] **Type Safety**: Are all `any` types removed?
*   [ ] **Composition**: Is complex logic extracted into `composables`?
*   [ ] **Naming**: Do variable names clearly describe their purpose?

### P2 级（可选 - 仅在全面重构时）
*   [ ] **Dead Code**: Remove unused imports, variables, and comments.
*   [ ] **常量提取**: Magic strings/numbers extracted to constants.
*   [ ] **完整类型**: Full interface definitions for all data structures.

## 3. Guide (Architecture)

When refactoring a large component:
1.  Isolate logic into a `.ts` file first.
2.  Add tests for that `.ts` file.
3.  Simplify the Vue template.

## 4. ❌ 过度重构示例（应避免）

```typescript
// ❌ 过度：为稳定的 Vuex store 添加不必要的可选链
const payAmt = computed(() => store.state?.nopassword?.payAmt ?? 0)

// ✅ 合理：信任稳定的数据结构
const payAmt = computed(() => store.state.nopassword.payAmt)

// ❌ 过度：简单的 UI 操作添加 try-catch
const showModal = () => {
  try {
    visible.value = true
  } catch (error) {
    console.error('显示失败:', error)
  }
}

// ✅ 合理：简单操作直接执行
const showModal = () => {
  visible.value = true
}

// ❌ 过度：为内部固定 URL 添加白名单验证
const ALLOWED_DOMAINS = ['example.com', 'api.example.com']
const isValidUrl = (url: string) => { /* 复杂验证逻辑 */ }

// ✅ 合理：对于内部固定 URL，简单格式检查即可
const isValidUrl = (url: string) => url.startsWith('http')
```

## 5. 何时应该重构 vs 保持现状

| 情况 | 建议 |
|------|------|
| 修改的代码有明显 Bug | ✅ 必须修复 |
| 修改的代码有 `any` 类型 | ⚠️ 推荐修复（如果容易） |
| 相邻代码有 `any` 类型 | ❌ 不要修改（超出范围） |
| 整个文件风格不统一 | ❌ 不要统一（应单独立项） |
| 用户明确要求全面重构 | ✅ 可以全面重构 |
