---
title: Workflow Spec 使用指南
date: 2026-01-30
---

# Workflow Spec 使用指南

Workflow Spec（工作流规范）用于描述“步骤依赖（DAG）+ 产物（artifacts）+ 质量闸门（gates）+ 策略（policies）”。

它的定位是：**工具/模型无关的工作流契约**。

## 目标项目里的文件位置

当你在业务项目根目录运行 `codebuddy-loader` 后，会生成：

```text
.codebuddy/workflows/
├── default.workflow.json
└── workflow.schema.json
```

## Contracts Gate（新增）

默认 workflow 在测试阶段会先执行 `contracts_valid` 闸门，用于校验 TaskBook/Workflow 的 JSON 契约是否满足最基本约束，提前发现“跑不起来/行为不一致”。

你也可以手动执行：

```bash
# 基础：校验 workflows + active taskbooks
node .codebuddy/scripts/contract-validator.js --workflows --taskbooks

# 可选：当启用 risk_tiered batching 时，提示（warning）缺少 scope.files/modules 的任务
node .codebuddy/scripts/contract-validator.js --workflows --taskbooks --check-batching-scope

# 可选（严格模式）：将上述提示升级为 error（用于 CI/团队强约束）
node .codebuddy/scripts/contract-validator.js --workflows --taskbooks --strict-batching-scope
```

## Smoke/Full Tests Gates

默认 workflow 已将测试拆为两级 gate：
- `smoke_passed`：高频快速验证（默认 `npm test`）
- `full_passed`：里程碑/合并前验证（默认 `npm test` + `npm run build`）

你可以在 `.codebuddy/workflows/default.workflow.json` 里调整 commands / budgetMinutes，并在 `policies.testing` 里记录团队的批量策略（供主 Agent/协作调度使用）。

## Batched Implement（批量推进）

从 `default.workflow.json@1.2.0` 开始：

- `implement` step 直接挂载 `contracts_valid` + `smoke_passed`（不再单独保留 `test_smoke` step）。
- `task-executor` 会读取 `policies.testing.batching`，将 `implement_tasks` 按 batch 推进，并在 batch 之间运行 smoke gate；失败则中止并把证据写入 TaskBook changelog。
- batch 的“范围预算”目前基于 TaskScope（`task.scope.files/modules`），用于限制单批改动面与避免并行冲突；后续可以扩展为按 git diff 的 changed lines/auto-tune。

## MCP Resources（只读 SSOT）

MCP Server 现在提供只读资源，方便不同工具/Agent 通过统一 URI 获取同一份事实源：

```text
codebuddy://workdir
codebuddy://workflows/schema
codebuddy://workflows/list
codebuddy://workflows/file/<filename>
codebuddy://taskbooks/schema
codebuddy://taskbooks/active
codebuddy://taskbooks/active/<id>
codebuddy://taskbooks/history
codebuddy://taskbooks/history/<id>
```

- `default.workflow.json`：默认单任务闭环工作流（分析→计划→实现(批量+Smoke gates)→审查→Full tests/build→验收/归档）
- `workflow.schema.json`：Workflow Spec 的 JSON Schema（用于校验/CI/MCP/多工具适配）

配套的 TaskBook 契约也会同时分发：

```text
.codebuddy/taskbooks/
└── taskbook.schema.json
```

## 这是不是“只用于约束/引导模型”？

早期是（主要用于约束/引导 Agent 输出正确的产物与状态变化）。

中长期它会升级为“可执行编排”：执行引擎读取 workflow spec，按 step 编排执行并强制 gates（例如测试失败则阻塞）。

## 如何定制工作流（建议）

1. 复制 `default.workflow.json` 生成新工作流（例如 `legacy.workflow.json`）
2. 修改：
   - `id` / `version` / `description`
   - `steps`：增删/调整顺序（配合 `edges`）
   - `gates`：新增质量门槛（测试/审查/安全/性能/结构阈值等）
   - `policies`：并发策略、冲突策略、阻塞处理策略
3. 在团队约定里明确“默认 workflow 文件名”（例如始终使用 `default.workflow.json`）

## 如何适配不同工具/模型

核心原则：**workflow spec 不变，执行方式可变**。

- workflow spec 描述“做什么/产物是什么/闸门是什么”
- 不同工具/模型只需要适配“如何执行 step / 如何落盘 artifacts / 如何更新 TaskBook 状态”

这样可以在切换 AI 工具（CodeBuddy / Claude Code / Cursor / Amp 等）时，保持团队工作流一致，只替换执行适配层。

## 如何执行（当前版本）

当前版本已提供一个“workflow 驱动”的执行入口：

如果你要在业务项目里做端到端验收，可直接按 [业务项目 E2E 验证方案](e2e-validation-playbook.md) 跑一遍。

```bash
# 在目标项目根目录执行（默认读取 .codebuddy/workflows/default.workflow.json）
node .codebuddy/scripts/task-executor.js <taskBookId>
```

常用选项：

```bash
# 指定 workflow 文件
node .codebuddy/scripts/task-executor.js <taskBookId> --workflow .codebuddy/workflows/default.workflow.json

# 人工审查 gate（当前为手动 gate），可用 approve 继续
node .codebuddy/scripts/task-executor.js <taskBookId> --approve review_passed

# 旧模式：不读取 workflow，直接执行所有任务（不推荐）
node .codebuddy/scripts/task-executor.js <taskBookId> --tasks-only
```

说明：
- 遇到 `MANUAL_REQUIRED` 的任务类型（例如设计/实现/审查），会将任务标记为 `blocked` 并暂停，等待人工或 Agent 介入。
- `smoke_passed`/`full_passed` gate（例如 `npm test` / `npm run build`）失败会阻塞后续步骤；必要时可用 `--approve <gateId>` 临时跳过。

配合 TaskBook 管理命令可以完成“人工介入后继续推进”：

```bash
# 查看任务状态
node .codebuddy/scripts/taskbook-manager.js show <taskBookId>

# 解除阻塞（blocked）任务：恢复为 pending，并记录解除原因
node .codebuddy/scripts/taskbook-manager.js unblock <taskBookId> <taskId> --resolution "已补充 scope 并拆分任务"

# 人工完成后，将任务标记 done 并补充 actualWork
node .codebuddy/scripts/taskbook-manager.js update-task <taskBookId> <taskId> --status done --actual-work "完成实现/已合并"

# 可选：随时生成验收/批量/闸门报告（可落盘到 .codebuddy/reports/taskbooks/）
node .codebuddy/scripts/taskbook-manager.js report <taskBookId> --write

# 继续执行 workflow
node .codebuddy/scripts/task-executor.js <taskBookId>
```

## 通过 MCP 调用（可选）

如果你使用 MCP Client（例如 Claude Desktop / 自研 Agent 运行器），可以通过 MCP 工具直接驱动 TaskBook + Workflow。

示例（概念性伪代码）：

```ts
// 可选：设置默认工作目录（项目根目录）
await mcp.call('codebuddy_set_workdir', { path: '/path/to/project' })

// 创建 TaskBook
const tb = await mcp.call('taskbook_create', {
  title: '用户登录',
  description: '实现登录/登出',
  taskType: 'new-feature',
})

// 运行 workflow（遇到手动闸门可用 approve 继续）
await mcp.call('workflow_run', {
  taskBookId: tb.id,
  approve: ['review_passed'],
})
```
