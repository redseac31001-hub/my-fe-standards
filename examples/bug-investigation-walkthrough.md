# Bug 调查示例：生产环境数据不一致

> 完整的 micro 工作流执行记录，展示使用 bug-investigator Agent 快速定位和修复问题。

---

## 场景描述

**用户需求**: "用户反馈订单列表页面的金额显示不对，有时候会显示 NaN"

**项目背景**:
- 技术栈: Vue 3 + Pinia + Axios
- 问题模块: `src/views/OrderList.vue` + `src/stores/orderStore.ts`
- 频率: 约 10% 的订单会出现

**工作流选择**: `micro`（3 步），因为这是一个明确的 bug 修复，不需要架构分析或代码审查。

---

## Phase 1: 快速规划 (plan)

**TaskBook**（极简版）:

```json
{
  "id": "tb-20260313-order-nan",
  "title": "修复订单金额显示 NaN",
  "taskType": "debugging",
  "status": "confirmed",
  "context": {
    "relatedFiles": [
      "src/views/OrderList.vue",
      "src/stores/orderStore.ts",
      "src/api/orders.ts"
    ],
    "dependencies": [],
    "architectureNotes": "Pinia store + Axios API 层"
  },
  "tasks": [
    {
      "id": "T1",
      "title": "定位 NaN 根因",
      "type": "analysis",
      "status": "pending",
      "priority": "critical",
      "dependencies": [],
      "acceptanceCriteria": [
        "确定 NaN 的具体来源（API 返回、类型转换、计算逻辑）",
        "找到可复现的条件"
      ]
    },
    {
      "id": "T2",
      "title": "修复 NaN 问题并补充防御",
      "type": "implement",
      "status": "pending",
      "priority": "critical",
      "dependencies": ["T1"],
      "acceptanceCriteria": [
        "NaN 场景不再出现",
        "补充回归测试",
        "npm test 通过"
      ]
    }
  ],
  "changelog": []
}
```

---

## Phase 2: 实现 (implement)

### T1: 根因定位

**bug-investigator 分层调查过程**:

**第 1 层 - 症状收集**:
```
用户报告: 订单金额显示 NaN
影响范围: ~10% 的订单
页面: OrderList.vue
```

**第 2 层 - 数据流追踪**:
```
API (orders.ts)
  → Pinia store (orderStore.ts)
    → 模板渲染 (OrderList.vue)
```

**第 3 层 - 关键代码审查**:

```typescript
// src/stores/orderStore.ts:34
// 问题代码
const totalAmount = computed(() =>
  orders.value.reduce((sum, order) => sum + order.amount * order.quantity, 0)
);
```

```typescript
// src/api/orders.ts:12
// API 响应示例
{
  "orders": [
    { "id": 1, "amount": "99.50", "quantity": 2 },     // amount 是字符串!
    { "id": 2, "amount": null, "quantity": 1 },          // amount 为 null!
    { "id": 3, "amount": 150.00, "quantity": 3 }         // amount 是数字
  ]
}
```

**根因确认**:
1. 后端 API 返回的 `amount` 类型不一致：有时是 `string`，有时是 `number`，偶尔是 `null`
2. `reduce` 中直接使用 `order.amount * order.quantity`，当 `amount` 为 `string` 时得到 `NaN`（字符串乘法），当 `amount` 为 `null` 时也得到 `NaN`
3. 出现率约 10% 与后端不同序列化路径一致

**复现条件**: 订单金额为空或后端返回字符串类型时

### T2: 修复实现

**tdd-driver 处理**:

**RED - 编写回归测试**:

```typescript
// tests/stores/orderStore.test.ts

describe('orderStore - 金额计算', () => {
  it('处理 amount 为字符串的情况', () => {
    const store = useOrderStore();
    store.orders = [{ id: 1, amount: '99.50' as any, quantity: 2 }];
    expect(store.totalAmount).toBe(199.00);
  });

  it('处理 amount 为 null 的情况', () => {
    const store = useOrderStore();
    store.orders = [{ id: 2, amount: null as any, quantity: 1 }];
    expect(store.totalAmount).toBe(0);
  });

  it('处理混合类型 amount', () => {
    const store = useOrderStore();
    store.orders = [
      { id: 1, amount: '99.50' as any, quantity: 2 },
      { id: 2, amount: null as any, quantity: 1 },
      { id: 3, amount: 150.00, quantity: 3 },
    ];
    expect(store.totalAmount).toBe(649.00);
  });
});
```

**测试结果**: 3/3 失败（预期 - RED 阶段）

**GREEN - 修复代码**:

```typescript
// src/stores/orderStore.ts:34 - 修复后
function safeAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const totalAmount = computed(() =>
  orders.value.reduce((sum, order) => sum + safeAmount(order.amount) * order.quantity, 0)
);
```

**测试结果**: 3/3 通过 + 原有测试全部通过

**smoke gate**: `npm test` - 通过

---

## Phase 3: 验证 & 关闭 (verify)

**全量验证**:
```
npm run build  → 通过
npm test       → 通过（15/15 tests）
```

**验收报告**:

```
验收报告 - 修复订单金额显示 NaN

执行摘要:
  根因: 后端 API 返回的 amount 字段类型不一致（string/null/number），
  前端直接参与计算导致 NaN。
  修复: 添加 safeAmount() 防御函数，对 null/undefined/字符串做安全转换。

代码变更:
  修改: 1 文件（src/stores/orderStore.ts - 添加 safeAmount 函数）
  新增: 1 文件（tests/stores/orderStore.test.ts - 3 个回归测试）

根因分析:
  后端不同序列化路径导致金额字段类型不一致。
  建议与后端团队协调统一 API 响应类型。

整体评分: 95/100
建议: 通过验收
```

---

## 关键收获

1. **micro 工作流** 仅 3 步完成 bug 修复，省去了 PRD、架构分析、独立审查等步骤
2. **bug-investigator 分层调查** 快速定位根因：症状 → 数据流 → 代码 → 根因
3. **防御性修复** 而非只修表面：`safeAmount()` 处理所有边界情况
4. **回归测试** 确保问题不会复发
