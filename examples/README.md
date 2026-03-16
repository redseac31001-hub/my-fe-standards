# 完整执行示例

> 端到端的 TaskBook 执行记录，展示不同场景下工作流的完整过程。

## 示例列表

| 示例 | 场景 | 使用工作流 | Agent 参与 |
|------|------|-----------|-----------|
| [功能开发](./feature-development-walkthrough.md) | Vue 3 表单验证组件开发 | sprint (5 步) | planner, tdd-driver, code-reviewer |
| [Bug 调查](./bug-investigation-walkthrough.md) | 生产环境数据不一致问题 | micro (3 步) | bug-investigator, build-fix |
| [遗留重构](./legacy-refactoring-walkthrough.md) | jQuery 混合代码迁移到 Vue 3 Composition API | default (7 步) | planner, structure-analyzer, tdd-driver, code-reviewer, build-fix |

## 如何阅读示例

每个示例包含：

1. **场景描述** - 用户需求和项目背景
2. **工作流选择** - 为什么选择该档位
3. **TaskBook 快照** - 各阶段的 JSON 状态变化
4. **Agent 交互记录** - 每个 Agent 的输入输出
5. **交接记录** - Agent 间的上下文传递
6. **最终结果** - 验收报告和产出物

## 与 Runbook 的区别

| 维度 | 示例（Examples） | Runbook（场景指南） |
|------|----------------|-------------------|
| 内容 | 完整执行记录（包含具体代码、JSON、输出） | 操作流程指南（步骤、决策点、检查清单） |
| 用途 | 学习系统如何工作 | 指导实际操作 |
| 粒度 | 展示每一步的输入输出 | 聚焦关键步骤和决策 |
