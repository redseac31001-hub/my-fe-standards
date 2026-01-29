---
name: structure-review
description: "Trigger when the user asks about project structure, directory organization, or code architecture health. Automatically invokes local script or MCP tool for analysis."
tools:
  - script:.codebuddy/scripts/structure-analyzer.js
  - mcp:analyze_project_structure
triggers:
  - "结构"
  - "目录"
  - "架构健康"
  - "项目组织"
  - "structure"
  - "directory"
---

# Structure Review Skill

项目结构审查技能，用于评估目录组织健康度并提供改进建议。

> ⚠️ 本技能为"指令层可执行"，即 AI 读取后按流程调用脚本或 MCP 工具，非平台自动编排执行。

## Intent

Use this skill when the user asks to:
- Review project structure
- Check directory organization
- Assess code architecture health
- Analyze project layout

This skill can invoke:
1. **本地脚本**（推荐）: `.codebuddy/scripts/structure-analyzer.js`
2. **MCP 工具**（如已配置）: `analyze_project_structure`

## Workflow

### Step 1: Confirm Target
Ask user for project path if not provided:
```
请确认要分析的项目路径：
1. 使用当前目录
2. 指定其他路径

或直接告诉我项目路径。
```

### Step 2: Run Analysis

**方式一：本地脚本（推荐）**

```bash
# 快速检查（仅违规项）
node .codebuddy/scripts/structure-analyzer.js . --mode problems_only

# 标准审查（含统计）
node .codebuddy/scripts/structure-analyzer.js . --mode summary

# 深度分析（含目录树）
node .codebuddy/scripts/structure-analyzer.js . --mode full
```

**方式二：MCP 工具（如已配置）**

| 场景 | Mode | 说明 |
|------|------|------|
| 快速检查 | `problems_only` | 仅返回违规项，Token 最少 |
| 标准审查 | `summary` | 含统计信息，推荐默认 |
| 深度分析 | `full` | 含完整目录树，Token 较多 |

```typescript
// 默认调用
analyze_project_structure({
  projectPath: "/path/to/project",
  mode: "summary"
})
```

### Step 3: Format Report
Use the output template below to present results.

### Step 4: Provide Advice
Based on score, recommend next steps:
- Score ≥ 90: 继续保持
- Score 70-89: 逐步改进
- Score 50-69: 建议重构
- Score < 50: 急需改进

## Tool Integration

本技能绑定以下工具（优先级从高到低）：

| 工具类型 | 路径/名称 | 适用场景 |
|---------|----------|---------|
| 本地脚本 | `.codebuddy/scripts/structure-analyzer.js` | 无需 MCP，直接执行 |
| MCP 工具 | `analyze_project_structure` | 已配置 MCP Server |

## Required Output Template

When invoked, follow this template:

```markdown
## 项目结构审查报告

### 1. 当前状态判定
- **结构类型**: [Feature-Based / Type-Grouped / 混合]
- **健康度评分**: [X/100]
- **配置来源**: [project / global / default]

### 2. 分项得分
| 维度 | 得分 | 说明 |
|------|------|------|
| 特性结构 | X/25 | 是否采用 Feature-Based |
| 目录深度 | X/25 | 嵌套是否合理 |
| 文件大小 | X/25 | 是否存在巨型文件 |
| 命名规范 | X/25 | 命名是否清晰 |

### 3. 关键违规项
| 严重度 | 规则 | 位置 | 问题 | 建议 |
|--------|------|------|------|------|
| 🔴 error | SA003 | src/utils/mega.ts | 文件超过500行 | 拆分为多个模块 |
| 🟡 warning | SA001 | src/components/ | 按类型分组 | 改用 Feature-Based |

### 4. 改造建议
| 路径 | 适用场景 | 风险 | 预估工时 |
|------|----------|------|----------|
| 小步迁移 | 临近发布、测试不足 | 低 | 高 |
| 一次性迁移 | 新项目、测试完善 | 中 | 中 |
| 适配层过渡 | 历史包袱重 | 低 | 高 |

### 5. 不建议动结构的场景
- ⚠️ 距离发布 < 2 周
- ⚠️ 单元测试覆盖率 < 60%
- ⚠️ 存在未解决的 P0 Bug
```

## References

- [正确模式示例](references/feature-based-patterns.md)
- [反模式清单](references/anti-patterns.md)
- [重构策略](references/refactoring-strategies.md)

## Related

- **Agent**: `structure-analyzer` - 完整的结构分析 Agent
- **Script**: `.codebuddy/scripts/structure-analyzer.js` - 可执行分析脚本
- **Rule**: `layer1_base/architecture/feature-based-structure.md` - 架构规范
