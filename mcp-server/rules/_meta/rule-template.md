# [Rule Name] 规则名称

> Tags: #Topic #Framework #KeyConcept
> Priority: High | Medium | Low

## 1. Context (背景与适用范围)
简要描述该规则适用的场景。例如：在编写 Vue 组件时，或者在定义数据接口时。
说明为什么这个场景需要规范。

## 2. The Rule (规则详情)
清楚、明确地陈述规则。使用祈使句。

*   **Do**: 应该怎么做。
*   **Don't**: 严禁怎么做。
*   **Preferred**: 推荐的做法（如果有多种选择）。

## 3. Reasoning (核心原理)
解释制定该规则的原因。这有助于 AI 理解并在边缘情况下做出正确判断。
*   **Performance**: 是否关乎性能？
*   **Maintainability**: 是否为了更好维护？
*   **Type Safety**: 是否为了类型安全？

## 4. Examples (代码示例)

### ✅ Good (推荐写法)
```typescript
// 展示符合规范的代码
const formattedValue = computed(() => props.value.trim());
```

### ❌ Bad (禁止写法)
```typescript
// 展示不符合规范的代码
// 解释为什么它是错的
const formattedValue = props.value.trim(); // 失去了响应性
```

## 5. Metadata (For AI Indexing)
*   **Version**: 1.0
*   **Related Rules**: [Link to other rules]
