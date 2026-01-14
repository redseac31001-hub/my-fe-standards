---
name: Testing Strategy
description: 测试策略与检查清单。涵盖测试金字塔、优先级、常见模式。用于确定测试范围和验收标准。
---

# Testing Strategy & Checklist

> Layer: Action
> Context: Writing and Organizing Tests for Vue + TypeScript Projects

<!-- @level:summary -->
## Summary (摘要)

测试行为而非实现，追求对代码变更的信心而非盲目追求覆盖率。测试金字塔：Unit (大量) → Component (中等) → E2E (少量)。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 测试金字塔

| 类型 | ��标 | 工具 |
|------|------|------|
| Unit | 纯函数、Composables、Store | Vitest |
| Component | 组件渲染、用户交互 | Vue Test Utils |
| E2E | 完整用户流程 | Playwright |

### 应该测试

- 业务逻辑：Store actions、工具函数
- 用户交互：按钮点击、表单提交
- 边界条件：空数据、错误状态

### 不必测试

- 组件内部私有方法
- UI 框架本身的功能
- 纯展示性组件

### 测试检查清单

- [ ] **Isolation**: 测试相互独立
- [ ] **Deterministic**: 结果稳定无随机性
- [ ] **Fast**: 毫秒级完成
- [ ] **Readable**: 描述清晰

<!-- @level:full -->
## 1. Philosophy (测试理念)
*   **Test Behavior, Not Implementation**: 测试用户可见的行为，而非内部实现细节。
*   **Confidence over Coverage**: 追求对代码变更的信心，而非盲目追求覆盖率数字。
*   **Fast Feedback**: 测试应快速运行，鼓励开发者频繁执行。

## 2. Testing Pyramid (测试金字塔)

```text
        /\
       /  \  E2E (少量、关键路径)
      /----\
     /      \  Component (中等、交互验证)
    /--------\
   /          \  Unit (大量、逻辑覆盖)
  --------------
```

| 类型 | 目标 | 工具推荐 |
|------|------|----------|
| **Unit** | 纯函数、Composables、Store Actions | Vitest |
| **Component** | 组件渲染、用户交互、事件触发 | Vue Test Utils + Vitest |
| **E2E** | 完整用户流程、关键业务路径 | Playwright / Cypress |

## 3. What to Test (测试优先级)

### ✅ 应该测试
*   **业务逻辑**: Store actions、工具函数、数据转换逻辑
*   **用户交互**: 按钮点击、表单提交、输入验证
*   **边界条件**: 空数据、错误状态、Loading 状态
*   **集成点**: API Mock 响应处理

### ❌ 不必测试
*   组件的内部私有方法（通过行为间接测试）
*   UI 框架本身的功能（如 Ant Design Vue 组件内部逻辑）
*   纯展示性组件（无逻辑的模板）

## 4. Checklist (测试前检查)
*   [ ] **Isolation**: 测试是否相互独立？每个测试都能单独运行？
*   [ ] **Deterministic**: 测试结果是否稳定？没有随机性或时间依赖？
*   [ ] **Fast**: 单个测试是否在毫秒级完成？
*   [ ] **Readable**: 测试描述是否清晰说明了被测行为？

## 5. Code Examples

### Unit Test (Composable)
```typescript
// useCounter.ts
export function useCounter(initial = 0) {
  const count = ref(initial);
  const increment = () => count.value++;
  return { count, increment };
}

// useCounter.spec.ts
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('should increment count', () => {
    const { count, increment } = useCounter(0);
    increment();
    expect(count.value).toBe(1);
  });
});
```

### Component Test
```typescript
// MyButton.spec.ts
import { mount } from '@vue/test-utils';
import MyButton from './MyButton.vue';

describe('MyButton', () => {
  it('emits click event when clicked', async () => {
    const wrapper = mount(MyButton);
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });
});
```

### Store Test (Pinia)
```typescript
// userStore.spec.ts
import { setActivePinia, createPinia } from 'pinia';
import { useUserStore } from './userStore';

describe('useUserStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should fetch user data', async () => {
    const store = useUserStore();
    await store.fetchUser(1);
    expect(store.user).toEqual({ id: 1, name: 'Test' });
  });
});
```

## 6. Metadata
*   **Version**: 1.0
*   **Related Rules**: `debugging.md`, `refactoring.md`
