# TypeScript Strict Types & No-Any Policy

> Tags: #TypeScript #TypeSafety #BestPractices
> Priority: Critical

## 1. Context (背景与适用范围)
适用于所有 `.ts` 和 `.vue` 文件。
TypeScript 的核心价值在于类型安全。过度使用 `any` 或忽略类型检查会使 TypeScript 退化为 "AnyScript"，丧失其优势。

## 2. The Rule (规则详情)

*   **严禁** 显式使用 `any` 类型。如果类型暂时不确定，优先使用 `unknown` 并配合类型守卫 (Type Guard)。
*   **必须** 开启 `strict: true` (在 `tsconfig.json` 中)。
*   **推荐** 使用 Interface 定义对象形状，使用 Type 定义联合类型或函数签名。
*   **必须** 为所有导出的函数定义明确的返回类型 (Explicit Return Types)，这有助于编译器优化和文档生成。

## 3. Reasoning (核心原理)
*   **Safety**: 防止运行时错误（Undefined is not a function）。
*   **Refactoring Confidence**: 强类型让大规模重构变得安全且容易。
*   **Documentation**: 类型定义本身就是最好的代码文档。

## 4. Examples (代码示例)

### ✅ Good (推荐写法)
```typescript
interface User {
  id: number;
  name: string;
}

// 明确的参数类型和返回类型
function getUserName(user: User): string {
  return user.name;
}

// 处理未知数据
function parse(input: unknown): void {
  if (typeof input === 'string') {
    console.log(input.toUpperCase());
  }
}
```

### ❌ Bad (禁止写法)
```typescript
// 尽量避免 implicit any
function getData(input) {
  return input.data; // Unsafe
}

// 严禁 explicit any
const config: any = loadConfig();
config.nonExistentMethod(); // 编译期不报错，运行时崩溃
```
