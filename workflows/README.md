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

## 三档工作流模板

| 模板 | 步骤数 | 适用场景 | 文件 |
|------|-------|---------|------|
| **micro** | 3 步 | hotfix、单文件改动、小 bug 修复 | `micro.workflow.json` |
| **sprint** | 5 步 | 功能迭代、中等规模重构 | `sprint.workflow.json` |
| **default** | 7 步 | 大型功能、跨模块重构、新项目 | `default.workflow.json` |

### 选择决策

```
任务规模？
├─ 小（< 50 行，1-2 小时）  → micro
├─ 中（< 500 行，1-3 天）   → sprint
└─ 大（> 500 行，3 天以上）  → default
```

### 步骤对比

| 步骤 | micro | sprint | default |
|------|:-----:|:------:|:-------:|
| PRD 生成 | - | - | v |
| 架构分析 | - | v | v |
| 任务规划 | v | v | v |
| TDD 实现 | v | v | v |
| 代码审查 | - | v | v |
| 构建修复 | - | - | v |
| 验收归档 | v | v | v |

### 使用方式

通过 `--workflow` 参数指定模板：

```bash
node .codebuddy/scripts/task-executor.js <taskBookId> --workflow .codebuddy/workflows/micro.workflow.json
node .codebuddy/scripts/task-executor.js <taskBookId> --workflow .codebuddy/workflows/sprint.workflow.json
node .codebuddy/scripts/task-executor.js <taskBookId>  # 默认使用 default
```

## 分发到业务项目的位置

`codebuddy-loader` 会将本目录的模板复制/下载到目标项目：

```
.codebuddy/workflows/
  workflow.schema.json
  default.workflow.json
  sprint.workflow.json
  micro.workflow.json
```

目标项目可在 `.codebuddy/workflows/` 内进行本地定制（例如增加 gates、调整并发策略、引入新 step），并保持对不同 AI 工具/模型的快速适配。
