# Workflows

本目录用于存放 **Workflow Spec（工作流规范）** 的模板与 Schema。

## 设计目标

- **工具/模型无关**：Workflow Spec 描述“做什么、先后依赖、产物与质量闸门”，不绑定具体 AI 工具或模型。
- **可验证**：每个 workflow 文件都能用 JSON Schema 校验，便于 CI、MCP、CLI 统一消费。
- **可渐进落地**：
  - 早期：作为 Agent 的约束/引导（生成计划、提示必须产出哪些 artifacts、通过哪些 gates）。
  - 后期：由执行引擎（Task Executor）按 spec 编排执行并强制 gates（测试/审查/验收）。

## 目录约定

- `workflows/schema/`：JSON Schema（契约形式化）。
- `workflows/templates/`：可分发到目标项目的 workflow 模板。

## 分发到业务项目的位置

`codebuddy-loader` 会将本目录的模板复制/下载到目标项目：

```
.codebuddy/workflows/
  workflow.schema.json
  default.workflow.json
```

目标项目可在 `.codebuddy/workflows/` 内进行本地定制（例如增加 gates、调整并发策略、引入新 step），并保持对不同 AI 工具/模型的快速适配。

默认模板（`default.workflow.json@1.2.0`）已将 smoke gate 挂载到 `implement` step，并配合 `policies.testing.batching` 支持批量推进与批间 smoke 验证。
