# TypeScript Strict Types & No-Any Policy

> Tags: #TypeScript #TypeSafety #BestPractices
> Priority: Critical

<!-- @level:summary -->
## Summary (摘要)

必须开启 `strict: true`，禁止显式 `any`，优先使用 `unknown` + 类型守卫。所有导出函数应声明明确返回类型；遗留代码只在顺手修改相关逻辑时逐步收敛，不做无关清扫。

---

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| 编译选项 | `tsconfig.json` 必须启用 `strict: true` |
| 不确定类型 | 优先 `unknown`，再用类型守卫缩窄 |
| 导出函数 | 必须声明明确返回类型 |
| 对象形状 | 优先 `interface` |
| 联合/函数签名 | 优先 `type` |

### 允许与禁止

| 类型 | 说明 |
|------|------|
| ✅ 允许 | 为第三方库兼容临时使用 `as unknown as T` |
| ✅ 允许 | 修改到的遗留代码顺手补齐类型 |
| ❌ 禁止 | 新代码显式写 `any` |
| ❌ 禁止 | 为省事关闭 `strict` 或绕过类型错误 |
| ❌ 禁止 | 与当前任务无关时大面积“顺手修类型” |

---

<!-- @level:full -->
## 1. Context (背景与适用范围)
适用于所有 `.ts` 和 `.vue` 文件。
TypeScript 的核心价值在于类型安全。过度使用 `any` 或忽略类型检查会使 TypeScript 退化为 "AnyScript"，丧失其优势。

## 2. The Rule (规则详情)

*   **严禁** 显式使用 `any` 类型。如果类型暂时不确定，优先使用 `unknown` 并配合类型守卫 (Type Guard)。
*   **必须** 开启 `strict: true` (在 `tsconfig.json` 中)。
*   **推荐** 使用 Interface 定义对象形状，使用 Type 定义联合类型或函数签名。
*   **必须** 为所有导出的函数定义明确的返回类型 (Explicit Return Types)，这有助于编译器优化和文档生成。

## 2.1 ⚠️ 灵活性指南（重要）

### 何时可以放宽类型要求

| 场景 | 处理方式 | 说明 |
|------|----------|------|
| **遗留代码兼容** | 不强制立即修复 | 仅在修改相关逻辑时顺便优化 |
| **快速原型** | 允许临时 `any` | 正式代码必须移除 |
| **第三方库兼容** | 允许 `as unknown as T` | 当库类型定义不完整时 |
| **与当前任务无关的代码** | 保持现状 | 不要"顺手"修复无关问题 |

### 遗留代码处理原则

```typescript
// ✅ 正确：修改的代码移除 any
function updateUser(user: User): void {  // 修改这个函数时，同时修复类型
  // ...
}

// ❌ 错误：顺手修复无关代码
function unrelatedFunction(data: any) {  // 与当前任务无关，保持现状
  // ...
}
```

### 第三方库兼容

```typescript
// ✅ 允许：第三方库类型不完整时
const result = thirdPartyLib.getData() as unknown as ExpectedType

// ✅ 允许：声明文件补丁
declare module 'some-library' {
  interface SomeType {
    missingProperty: string
  }
}
```

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
