---
name: ralph-converter
description: "Convert PRDs to prd.json format for the Ralph autonomous agent system. Use when you have an existing PRD and need to convert it to Ralph's JSON format. Triggers on: convert this prd, turn this into ralph format, create prd.json from this, ralph json."
metadata:
  triggers:
    - "Ralph/转换/迁移"
  roles:
    - product
    - architect
  scenarios:
    - conversion
    - planning
---

# Ralph PRD Converter

把现有 PRD 转成 Ralph 可执行的 `prd.json`，重点是故事拆分、依赖顺序和可验证标准。

## Routing

- **需要判断故事是否过大、如何排序依赖**：读取 [references/story-sizing-and-ordering.md](references/story-sizing-and-ordering.md)
- **需要确认 JSON 字段、转换规则、归档流程**：读取 [references/conversion-rules.md](references/conversion-rules.md)

## Workflow

1. 读取源 PRD，先抽取目标、范围和已有用户故事。
2. 把过大的故事拆成 Ralph 一次迭代内可完成的粒度。
3. 按依赖顺序排序：先 schema，再 backend，再 UI，再聚合视图。
4. 如果输入是标准 PRD Markdown，优先运行 `scripts/convert_prd.py` 生成 `prd.json`，确保每个故事都有可验证的 acceptance criteria。
5. 写入前检查是否需要归档旧的 `prd.json` 和 `progress.txt`。

## Scripts

- PRD -> Ralph 转换器： [scripts/convert_prd.py](scripts/convert_prd.py)

## Assets

JSON 模板： [assets/prd.template.json](assets/prd.template.json)

## Output

- `prd.json`
- 依赖顺序正确的 `userStories`
- 每个故事对应的优先级和验收标准
