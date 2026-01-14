---
name: Refactoring Checklist
description: 重构检查清单与策略。关注可读性、可测试性、代码整洁度。
---

# Refactoring Checklist & Strategy

> Layer: Action
> Context: Code Refactoring / Technical Debt Paydown

<!-- @level:summary -->
## Summary (摘要)

重构优先考虑**可读性**和**可测试性**，遵循 Boy Scout Rule：让代码比你发现时更整洁。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 重构检查清单

- [ ] **Type Safety**: 所有 `any` 类型已移除
- [ ] **Composition**: 复杂逻辑已抽取为 `composables`
- [ ] **Naming**: 变量名清晰描述用途 (如 `isModalOpen` 而非 `flag`)
- [ ] **Dead Code**: 移除未使用的 imports、变量和注释

### 大组件重构步骤

1. 将逻辑隔离到 `.ts` 文件
2. 为该 `.ts` 文件添加测试
3. 简化 Vue 模板

<!-- @level:full -->
## 1. Strategy
Prioritize **readability** and **testability** over micro-optimizations.
Follow the "Boy Scout Rule": Leave the code cleaner than you found it.

## 2. Checklist
*   [ ] **Type Safety**: Are all `any` types removed?
*   [ ] **Composition**: Is complex logic extracted into `composables`?
*   [ ] **Naming**: Do variable names clearly describe their purpose? (e.g., `isModalOpen` vs `flag`)
*   [ ] **Dead Code**: Remove unused imports, variables, and comments.

## 3. Guide (Architecture)
When refactoring a large component:
1.  Isolate logic into a `.ts` file first.
2.  Add tests for that `.ts` file.
3.  Simplify the Vue template.
