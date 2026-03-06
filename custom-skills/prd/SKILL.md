---
name: prd
description: "Generate a Product Requirements Document (PRD) for a new feature. Use when planning a feature, starting a new project, or when asked to create a PRD. Triggers on: create a prd, write prd for, plan this feature, requirements for, spec out."
metadata:
  triggers:
    - "PRD/需求文档/产品文档"
---

# PRD Skill

生成可执行的 PRD，只做需求澄清和文档产出，不直接进入实现。

## Routing

- **需要先补关键背景、目标、边界**：读取 [references/discovery-questions.md](references/discovery-questions.md)
- **需要生成正式 PRD、用户故事、验收标准、JSON 摘要**：读取 [references/prd-sections.md](references/prd-sections.md)

## Workflow

1. 先判断用户输入是否足够完整；只有在关键范围不清时才追问。
2. 追问时只问 3-5 个高价值问题，使用编号 + 字母选项，方便用户快速回复。
3. 如果已经整理成结构化输入，优先运行 `scripts/create_prd.py` 生成 Markdown PRD，并附带结构化 JSON 摘要供 task-orchestrator 消费。
4. 将结果保存到 `tasks/prd-[feature-name].md`，文件名使用 kebab-case。
5. 如果仍有不确定项，保留在 `Open Questions`，不要自行假设成确定需求。

## Scripts

- 标准 PRD 生成器： [scripts/create_prd.py](scripts/create_prd.py)

## Assets

PRD 模板： [assets/prd-template.md](assets/prd-template.md)
结构化输入模板： [assets/prd-input.template.json](assets/prd-input.template.json)

## Output

- 完整 PRD 文档
- 对应的 JSON 摘要块
- 明确的范围边界、验收标准、开放问题
