---
name: state-management
description: Pinia/Vuex 状态管理重构与测试技能。触发条件：Store 重构、状态逻辑复杂化、Vuex 迁移 Pinia、Store 单元测试编写、状态规范化设计。
metadata:
  triggers:
    - "状态管理/Vuex/Pinia/Store"
---

# State Management Skill

状态管理技能，覆盖 store 设计、Vuex → Pinia 迁移、以及 store 测试。

## Routing

- **Store 边界、状态规范化、Pinia 设计**：读取 [references/store-design.md](references/store-design.md)
- **Vuex 迁移、测试策略、验收顺序**：读取 [references/migration-and-testing.md](references/migration-and-testing.md)

## Workflow

1. 先判断当前任务是设计问题、迁移问题，还是测试补强。
2. 优先修 store 边界和数据形状，再处理组件接入。
3. 迁移时保持分阶段切换，避免全局一次性替换。
4. 测试先锁定 store 合同，再验证组件消费路径。

## Assets

Pinia 单测模板： [assets/pinia-test.template.ts](assets/pinia-test.template.ts)

## Output

- store 拆分或迁移方案
- 影响范围
- 测试清单
- 回归关注点
