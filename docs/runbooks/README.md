# 场景指南（Runbook）

> 针对常见开发场景的操作指南，帮助快速选择工作流和 Agent 组合。

## Runbook 列表

| Runbook | 场景 | 推荐工作流 |
|---------|------|-----------|
| [功能开发](./feature-development.md) | 新功能开发（组件、页面、API 集成） | sprint / default |
| [遗留重构](./legacy-refactoring.md) | 旧代码迁移、架构升级、技术债清理 | default |
| [生产排查](./production-troubleshooting.md) | 线上 bug、性能问题、数据异常 | micro |

## 工作流选择决策树

```
任务规模如何？
├─ 小（单文件、< 50 行、1-2 小时）
│  └─ micro（3 步：Plan → Implement → Verify）
│
├─ 中（多文件、< 500 行、1-3 天）
│  └─ sprint（5 步：Analyze → Plan → Implement → Review → Accept）
│
└─ 大（跨模块、> 500 行、3 天以上）
   └─ default（7 步：PRD → Analyze → Plan → TDD → Review → Build → Accept）
```

## 快速参考

### 工作流对比

| 维度 | micro | sprint | default |
|------|-------|--------|---------|
| 步骤数 | 3 | 5 | 7 |
| PRD 生成 | 跳过 | 跳过 | 包含 |
| 架构分析 | 跳过 | 包含 | 包含 |
| 代码审查 | 跳过 | 包含 | 包含 |
| 构建修复 | 内嵌在实现中 | 内嵌在实现中 | 独立步骤 |
| 并行任务 | 1 | 2 | 2 |
| 适用场景 | hotfix, 小 bug | 功能迭代 | 大型重构 |
| 预估时间 | 30 分钟 - 2 小时 | 半天 - 3 天 | 3 天以上 |

### Agent 选择参考

| 任务类型 | 首选 Agent | 备选 Agent |
|---------|-----------|-----------|
| 规划分解 | planner | task-orchestrator |
| 测试+实现 | tdd-driver | - |
| 代码审查 | code-reviewer | - |
| 构建修复 | build-fix | - |
| Bug 调查 | bug-investigator | - |
| 结构分析 | structure-analyzer | - |
| 安全审查 | security-reviewer | - |
| 性能分析 | performance-profiler | - |
| 概要设计 | system-overview-writer | - |
