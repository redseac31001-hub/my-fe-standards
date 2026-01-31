# TaskBooks

本目录提供 **TaskBook（任务书）** 的契约与说明，用于“单任务闭环 / 多 Agent 协作”的唯一事实源（SSOT）。

## 你会用到的文件

- `taskbooks/schema/taskbook.schema.json`：TaskBook JSON Schema（可用于校验/CI/MCP/多工具适配）

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

