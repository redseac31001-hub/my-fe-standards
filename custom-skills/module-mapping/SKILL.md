---
name: module-mapping
description: "分析项目功能模块划分，生成模块依赖图谱。当用户询问项目有哪些模块、模块关系、依赖图谱时触发。"
metadata:
  triggers:
    - "功能模块"
    - "模块划分"
    - "模块图谱"
    - "依赖图谱"
    - "模块关系"
    - "项目地图"
    - "有哪些模块"
    - "module"
  tools:
    - script:.codebuddy/scripts/module-mapper.js
  related:
    - structure-review
    - structure-analyzer
---

# Module Mapping Skill

分析项目模块边界与依赖关系，优先通过 `.codebuddy/scripts/module-mapper.js` 获取结构化结果，再给出解读和后续建议。

## Routing

- **需要确定分析模式、执行顺序、脚本调用方式**：读取 [references/analysis-workflow.md](references/analysis-workflow.md)
- **需要理解 Vue 项目的模块识别、健康度判断**：读取 [references/vue-module-patterns.md](references/vue-module-patterns.md)
- **需要理解依赖类型、循环依赖、Mermaid 图语义**：读取 [references/dependency-analysis.md](references/dependency-analysis.md)
- **需要组织输出报告、决定后续动作**：读取 [references/reporting-and-followups.md](references/reporting-and-followups.md)

## Workflow

1. 先确认分析目标目录，未给路径时默认当前项目。
2. 默认先跑 `summary`，只有在需要依赖图或深入排查时才升级到 `full` 或 `graph`。
3. 先描述模块边界和依赖热点，再判断哪些问题需要继续转给其他 skill 或 agent。
4. 如果发现循环依赖、巨型模块或边界穿透，明确指出后续最合适的处理路径。

## Tool

- `.codebuddy/scripts/module-mapper.js`

## Output

- 模块概览
- 依赖热点或循环依赖
- 模块健康风险
- 下一步建议
