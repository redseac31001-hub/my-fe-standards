---
name: Clean Code Principles
description: 整洁代码核心原则。基于《代码整洁之道》《重构》《程序员修炼之道》等经典著作，适用于所有编码、审查、重构任务。
tags:
  - CleanCode
  - Readability
  - Maintainability
priority: Critical
alwaysApply: true
---

# 整洁代码核心原则 (Clean Code Principles)

> Layer: Base (Eager Load)
> Context: 所有编码、审查、重构、修复任务的通用基础原则

<!-- @level:summary -->
## Summary (摘要)

**代码是写给人看的，顺便让机器执行。**

核心追求：**优雅、简洁、易读、易维护**

### 三大黄金法则

1. **可读性优先** - 代码的首要目标是让人能快速理解
2. **简单胜于复杂** - 最简单的解决方案往往是最好的
3. **持续改进** - 让代码比你发现时更整洁 (Boy Scout Rule)

---

<!-- @level:quick -->
## Quick Reference (快速参考)

### 代码质量速查表

| 维度 | ✅ 好代码 | ❌ 坏代码 |
|------|----------|----------|
| **命名** | `getUserById(id)` | `getData(x)` |
| **函数** | 单一职责，< 20 行 | 多职责，> 100 行 |
| **注释** | 解释"为什么" | 解释"是什么" |
| **格式** | 一致的缩进和空行 | 混乱的格式 |
| **复杂度** | 扁平结构，早返回 | 深层嵌套 |

### SOLID 原则速记

| 原则 | 一句话 | 检查问题 |
|------|--------|----------|
| **S** 单一职责 | 一个类/函数只做一件事 | "这个函数有几个修改理由？" |
| **O** 开闭原则 | 对扩展开放，对修改关闭 | "添加功能需要改现有代码吗？" |
| **L** 里氏替换 | 子类可替换父类 | "子类能完全替代父类使用吗？" |
| **I** 接口隔离 | 接口小而专注 | "接口有未使用的方法吗？" |
| **D** 依赖倒置 | 依赖抽象而非具体 | "高层模块依赖底层实现吗？" |

### 简洁性原则

| 原则 | 含义 | 实践 |
|------|------|------|
| **DRY** | Don't Repeat Yourself | 相同逻辑只写一次 |
| **KISS** | Keep It Simple, Stupid | 选择最简单的方案 |
| **YAGNI** | You Ain't Gonna Need It | 不写用不到的代码 |

---

<!-- @level:full -->
## 1. 命名原则 (Naming)

> "名称应该揭示意图" — Robert C. Martin

### 1.1 有意义的名称

```typescript
// ❌ 糟糕的命名
const d = 86400  // 什么是 d？
const list = getList()  // 什么 list？
function proc(a, b) { }  // proc 做什么？

// ✅ 清晰的命名
const SECONDS_PER_DAY = 86400
const activeUsers = getActiveUsers()
function calculateTotalPrice(items, discount) { }
```

### 1.2 命名规则

| 类型 | 规则 | 示例 |
|------|------|------|
| **变量** | 名词，描述内容 | `userName`, `orderList` |
| **布尔** | is/has/can 前缀 | `isActive`, `hasPermission` |
| **函数** | 动词开头，描述行为 | `getUserById`, `validateEmail` |
| **常量** | 全大写下划线 | `MAX_RETRY_COUNT` |
| **类** | 大驼峰，名词 | `UserService`, `OrderController` |

### 1.3 避免的命名

- ❌ 单字母变量（循环索引除外）
- ❌ 缩写（除非是广泛认可的：`id`, `url`, `html`）
- ❌ 数字后缀 `data1`, `data2`
- ❌ 类型前缀 `strName`, `arrList`（TypeScript 有类型系统）
- ❌ 无意义词汇 `info`, `data`, `temp`, `misc`

---

## 2. 函数原则 (Functions)

> "函数应该做一件事，做好这件事，只做这件事" — Robert C. Martin

### 2.1 小而专注

```typescript
// ❌ 过长的函数（做了太多事）
function processOrder(order) {
  // 验证订单... (20行)
  // 计算价格... (30行)
  // 更新库存... (25行)
  // 发送通知... (15行)
  // 记录日志... (10行)
}

// ✅ 拆分为专注的小函数
function processOrder(order: Order): ProcessResult {
  validateOrder(order)
  const totalPrice = calculateTotalPrice(order)
  updateInventory(order.items)
  notifyCustomer(order, totalPrice)
  logOrderProcessed(order)
  return { success: true, totalPrice }
}
```

### 2.2 函数规范

| 规则 | 标准 | 原因 |
|------|------|------|
| **行数** | ≤ 20 行（理想），≤ 50 行（最大） | 一屏可见 |
| **参数** | ≤ 3 个，超过用对象 | 易于理解和测试 |
| **嵌套** | ≤ 3 层 | 避免认知负担 |
| **职责** | 单一职责 | 易于测试和修改 |

### 2.3 早返回原则 (Guard Clauses)

```typescript
// ❌ 深层嵌套
function getDiscount(user, order) {
  if (user) {
    if (user.isVip) {
      if (order.total > 100) {
        return 0.2
      } else {
        return 0.1
      }
    } else {
      return 0
    }
  } else {
    return 0
  }
}

// ✅ 早返回，扁平结构
function getDiscount(user: User | null, order: Order): number {
  if (!user) return 0
  if (!user.isVip) return 0
  if (order.total <= 100) return 0.1
  return 0.2
}
```

### 2.4 无副作用

```typescript
// ❌ 有副作用（修改了外部状态）
let total = 0
function addToTotal(value) {
  total += value  // 副作用：修改外部变量
  console.log(total)  // 副作用：I/O 操作
  return total
}

// ✅ 纯函数（无副作用）
function add(a: number, b: number): number {
  return a + b
}
```

---

## 3. 代码坏味道 (Code Smells)

> "如果代码闻起来不对，它可能就是不对的" — Martin Fowler

### 3.1 常见坏味道与重构手法

| 坏味道 | 症状 | 重构手法 |
|--------|------|----------|
| **重复代码** | 相同逻辑出现多次 | 提取函数/模块 |
| **过长函数** | 函数超过 50 行 | 拆分函数 |
| **过大的类** | 类超过 300 行 | 拆分类/提取模块 |
| **过长参数列表** | 参数超过 3 个 | 引入参数对象 |
| **发散式变化** | 一个类因多种原因修改 | 拆分类 |
| **霰弹式修改** | 一个变化需要修改多处 | 移动函数/字段 |
| **依恋情结** | 函数过度使用其他类数据 | 移动函数 |
| **数据泥团** | 数据总是成群出现 | 引入数据类 |
| **基本类型偏执** | 过度使用基本类型 | 用对象替换 |
| **switch 语句** | 大量 switch/if-else | 多态替换 |
| **临时字段** | 仅在特定情况使用的字段 | 提取类 |
| **过度注释** | 注释解释糟糕的代码 | 重写代码 |

### 3.2 坏味道示例

```typescript
// ❌ 数据泥团 + 过长参数
function createUser(
  name: string,
  email: string,
  phone: string,
  street: string,
  city: string,
  zipCode: string
) { }

// ✅ 引入数据类
interface Address {
  street: string
  city: string
  zipCode: string
}

interface CreateUserParams {
  name: string
  email: string
  phone: string
  address: Address
}

function createUser(params: CreateUserParams) { }
```

```typescript
// ❌ switch 语句（难以扩展）
function getArea(shape: string, ...args: number[]): number {
  switch (shape) {
    case 'circle': return Math.PI * args[0] ** 2
    case 'rectangle': return args[0] * args[1]
    case 'triangle': return 0.5 * args[0] * args[1]
    default: throw new Error('Unknown shape')
  }
}

// ✅ 多态替换（易于扩展）
interface Shape {
  getArea(): number
}

class Circle implements Shape {
  constructor(private radius: number) {}
  getArea() { return Math.PI * this.radius ** 2 }
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  getArea() { return this.width * this.height }
}
```

---

## 4. 注释原则 (Comments)

> "好的代码是自文档化的，注释应该解释'为什么'而不是'是什么'" — Robert C. Martin

### 4.1 好注释 vs 坏注释

```typescript
// ❌ 坏注释：解释代码做什么（代码本身应该说明）
// 遍历用户列表
for (const user of users) {
  // 检查用户是否激活
  if (user.isActive) {
    // 发送邮件
    sendEmail(user.email)
  }
}

// ✅ 好注释：解释为什么这样做
// 批量发送限制：每批最多100封，避免触发邮件服务商的反垃圾机制
const BATCH_SIZE = 100

// 使用 setTimeout 而非 setInterval，因为需要等待上一次请求完成
// 参考：https://example.com/issue/123
setTimeout(pollData, POLL_INTERVAL)
```

### 4.2 注释规范

| 类型 | 应该写 | 不应该写 |
|------|--------|----------|
| **函数注释** | 复杂函数的用途和参数说明 | 简单函数的逐行解释 |
| **业务注释** | 业务规则和决策理由 | 显而易见的业务逻辑 |
| **TODO** | 临时的，附带 issue 编号 | 永久存在的 TODO |
| **警告注释** | 潜在风险或注意事项 | 无实际价值的警告 |

### 4.3 用代码替代注释

```typescript
// ❌ 用注释解释复杂逻辑
// 检查用户是否有权限访问管理后台
if (user.role === 'admin' || (user.role === 'manager' && user.department === 'IT')) {
  // ...
}

// ✅ 提取为有意义的函数
function canAccessAdminPanel(user: User): boolean {
  const isAdmin = user.role === 'admin'
  const isITManager = user.role === 'manager' && user.department === 'IT'
  return isAdmin || isITManager
}

if (canAccessAdminPanel(user)) {
  // ...
}
```

---

## 5. 格式与结构 (Formatting)

### 5.1 垂直格式

```typescript
// ✅ 良好的垂直结构
import { ref, computed } from 'vue'           // 1. 导入

interface User {                               // 2. 类型定义
  id: number
  name: string
}

const MAX_USERS = 100                          // 3. 常量

export function useUsers() {                   // 4. 主要逻辑
  const users = ref<User[]>([])

  const activeUsers = computed(() =>           // 相关代码靠近
    users.value.filter(u => u.isActive)
  )

  function addUser(user: User) {               // 函数之间空行分隔
    users.value.push(user)
  }

  return { users, activeUsers, addUser }       // 5. 导出
}
```

### 5.2 水平格式

- 行宽不超过 100-120 字符
- 操作符两侧加空格
- 逗号后加空格
- 使用一致的缩进（2 或 4 空格）

### 5.3 代码分组

```typescript
// ✅ 逻辑相关的代码放在一起
// --- 状态定义 ---
const loading = ref(false)
const error = ref<Error | null>(null)
const data = ref<Data | null>(null)

// --- 计算属性 ---
const isEmpty = computed(() => !data.value)
const hasError = computed(() => !!error.value)

// --- 方法 ---
async function fetchData() { }
function resetState() { }
```

---

## 6. 错误处理 (Error Handling)

### 6.1 原则

```typescript
// ❌ 吞掉错误
try {
  await saveData()
} catch (e) {
  // 什么都不做
}

// ❌ 返回 null 表示错误
function findUser(id: string): User | null {
  // 找不到和出错都返回 null，调用者无法区分
}

// ✅ 明确的错误处理
async function saveData(): Promise<Result<void, SaveError>> {
  try {
    await api.save(data)
    return { success: true }
  } catch (error) {
    console.error('保存失败:', error)
    return { success: false, error: new SaveError('保存失败', error) }
  }
}
```

### 6.2 错误处理规范

| 规则 | 说明 |
|------|------|
| **不要吞掉错误** | 至少要记录日志 |
| **提供上下文** | 错误信息包含足够的调试信息 |
| **区分错误类型** | 使用自定义错误类区分不同错误 |
| **快速失败** | 尽早发现和报告错误 |
| **优雅降级** | 非关键错误不应崩溃整个应用 |

---

## 7. 测试原则 (Testing)

### 7.1 测试金字塔

```
        /\
       /E2E\        少量端到端测试
      /------\
     /Integration\  适量集成测试
    /--------------\
   /   Unit Tests   \ 大量单元测试
  /------------------\
```

### 7.2 好测试的特征 (FIRST)

| 原则 | 含义 |
|------|------|
| **F**ast | 快速运行 |
| **I**ndependent | 测试间相互独立 |
| **R**epeatable | 可重复执行，结果一致 |
| **S**elf-validating | 自动判断通过/失败 |
| **T**imely | 及时编写（TDD 优先） |

### 7.3 测试命名

```typescript
// ✅ 描述性的测试名称
describe('UserService', () => {
  it('should return null when user not found', () => { })
  it('should throw error when email is invalid', () => { })
  it('should hash password before saving', () => { })
})
```

---

## 8. 重构时机 (When to Refactor)

### 8.1 三次法则

> "第一次做某件事只管去做；第二次做类似的事会产生反感，但还是做了；第三次再做类似的事，就应该重构。" — Martin Fowler

### 8.2 重构时机

| 时机 | 说明 |
|------|------|
| **添加功能前** | 让现有代码更容易添加新功能 |
| **修复 Bug 时** | 理解代码时顺便改进 |
| **代码审查时** | 发现问题及时修正 |
| **理解困难时** | 无法理解的代码需要重构 |

### 8.3 不重构的时机

| 时机 | 原因 |
|------|------|
| **即将重写** | 重构没有意义 |
| **截止日期前** | 风险太高 |
| **代码正常工作** | 如果不需要修改，不要动它 |

---

## 9. 审查清单 (Code Review Checklist)

### 9.1 必检项 (P0)

- [ ] 代码是否解决了问题？
- [ ] 是否有明显的 Bug？
- [ ] 是否有安全漏洞？
- [ ] 类型定义是否完整？

### 9.2 质量项 (P1)

- [ ] 命名是否清晰有意义？
- [ ] 函数是否足够小且专注？
- [ ] 是否有代码重复？
- [ ] 错误处理是否恰当？
- [ ] 是否有不必要的复杂度？

### 9.3 风格项 (P2)

- [ ] 格式是否一致？
- [ ] 注释是否必要且有价值？
- [ ] 是否遵循项目约定？

---

## 10. 经典语录

> "任何傻瓜都能写出计算机能理解的代码。优秀的程序员写出人能理解的代码。" — Martin Fowler

> "简单是可靠的先决条件。" — Edsger W. Dijkstra

> "先让它工作，再让它正确，最后让它快。" — Kent Beck

> "代码是给人看的，附带能在机器上运行。" — Harold Abelson

> "我不是一个伟大的程序员，我只是一个有着良好习惯的程序员。" — Kent Beck
