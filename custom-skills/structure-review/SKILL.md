---
name: structure-review
description: "Trigger when the user asks about project structure, directory organization, or code architecture health. Automatically invokes local script or MCP tool for analysis."
metadata:
  triggers:
    - "结构"
    - "目录"
    - "架构健康"
    - "项目组织"
    - "项目分析"
    - "当前项目分析"
    - "分析当前项目"
    - "项目评估"
    - "项目体检"
    - "项目健康度"
    - "structure"
    - "directory"
  roles:
    - architect
    - frontend
    - backend
    - fullstack
  scenarios:
    - architecture
    - structure-analysis
  workspace_scope: both
  tools:
    - script:.codebuddy/scripts/structure-analyzer.js
    - mcp:analyze_project_structure
---

# Structure Review Skill

评估项目目录组织和架构健康度。默认必须基于脚本或 MCP 的结构化结果给出判断，不能只凭目录印象下结论。

## Routing

- **需要选择脚本/MCP、mode、执行顺序**：读取 [references/execution-and-modes.md](references/execution-and-modes.md)
- **需要解释评分、组织输出、给出改造建议**：读取 [references/scoring-and-reporting.md](references/scoring-and-reporting.md)
- **需要对照正确结构模式**：读取 [references/feature-based-patterns.md](references/feature-based-patterns.md)
- **需要识别反模式**：读取 [references/anti-patterns.md](references/anti-patterns.md)
- **需要设计迁移路径**：读取 [references/refactoring-strategies.md](references/refactoring-strategies.md)

## Workflow

1. 先确认目标目录和用户想要的粒度：快速问题、标准审查、还是深度分析。
2. 如果用户说“分析当前项目 / 项目分析 / 项目评估 / 项目健康度”，默认必须跑结构化分析，不允许只做口头判断。
3. 默认优先使用本地脚本；只有在当前环境更适合 MCP 时才切到 MCP。
4. 标准审查默认读取 JSON 结果，并优先使用 `scores.scorecard` 输出 8 维工程健康度评分卡。
5. 只有在收益明显且风险可控时才建议结构重构；临近发布或测试不足时要明确保守建议。

## Tools

- `.codebuddy/scripts/structure-analyzer.js`
- `analyze_project_structure`（如已配置 MCP）

## Output

- 工程健康度评分卡（8 维）
- 结构健康度（4 维结构项单独展示）
- 关键违规项
- 改造建议或保持现状的理由
