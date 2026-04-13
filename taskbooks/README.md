# TaskBooks

本目录提供 **TaskBook（任务书）** 的契约与说明，用于“单任务闭环 / 多 Agent 协作”的唯一事实源（SSOT）。

## 你会用到的文件

- `taskbooks/schema/taskbook.schema.json`：TaskBook JSON Schema（可用于校验/CI/MCP/多工具适配）
- `taskbooks/examples/minimal-open-spec.taskbook.json`：最小可运行示例，演示 `plan + executionSpec`

## 业务项目中的落地位置

加载器会分发到业务项目：

```
.codebuddy/taskbooks/
├── taskbook.schema.json     # TaskBook JSON Schema
├── README.md                # 使用说明（本文件的精简版）
├── active/                  # 进行中的 TaskBook
└── history/                 # 已归档的 TaskBook
```

## 设计要点（为什么需要 Schema）

- **契约稳定**：多 Agent / 多工具围绕同一份 JSON 结构协作，降低“行为不一致”
- **可验证**：任何写入 TaskBook 的动作都能在本地/CI 校验结构合法性
- **可演进**：通过 schema 版本与扩展字段（如 `meta`）支持后续能力扩展

## 契约约定

- 第一阶段强制 `1 TaskBook = 1 Plan`，`plan.planId === taskBook.id`
- `acceptanceCriteria` 表示业务/结果层验收
- `executionSpec.verification` 表示技术/工程层校验
- `plan.documentationTier` 表示当前任务的文档留存级别：`minimal | standard | full`
- `plan.documentationArtifacts` 表示建议留存的文档/报告清单
- 如需外部 Spec Kit，建议使用版本化路径：
  `.codebuddy/specs/<taskBookId>-v1/00-overview.md`

## 文档留存分级

建议由 routing 自动决定，不要所有任务一律生成整套文档。

| 场景 | 留存级别 | 建议产物 |
|------|----------|----------|
| `direct` 小改动 | `minimal` | `requirement-summary`、`change-summary`、`verification-summary` |
| `planner` / 中等复杂度 | `standard` | `00-requirement.md`、`02-plan.md`、`taskbook`、`acceptance-report` |
| `task-orchestrator + default` | `full` | `00-requirement.md`、`01-design.md`、`02-plan.md`、`taskbook`、`review-report`、`test-evidence`、`acceptance-report` |

## 推荐路径约定

- `00-requirement.md` → `.codebuddy/specs/<taskBookId>-v1/00-requirement.md`
- `01-design.md` → `.codebuddy/specs/<taskBookId>-v1/01-design.md`
- `02-plan.md` → `.codebuddy/specs/<taskBookId>-v1/02-plan.md`
- `taskbook` → `.codebuddy/taskbooks/active/<taskBookId>.json`
- `acceptance-report` → `.codebuddy/reports/taskbooks/<taskBookId>.acceptance.json`
