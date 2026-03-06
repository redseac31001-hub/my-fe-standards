# Execution And Modes

先决定分析深度，再决定工具，不要默认跑最重的模式。

## Tool Preference

默认优先级：

1. 本地脚本 `.codebuddy/scripts/structure-analyzer.js`
2. MCP 工具 `analyze_project_structure`

优先用本地脚本的场景：

- 当前仓库已经安装了 `.codebuddy/scripts/structure-analyzer.js`
- 需要更可控、可复现的 CLI 输出
- 不想引入额外 MCP 往返

优先用 MCP 的场景：

- 当前环境不方便直接跑本地脚本
- 宿主已经配置好相关 MCP 工具

## Mode Selection

| Mode | 适用场景 | 说明 |
|------|----------|------|
| `problems_only` | 只想找问题 | token 最低，适合快速排查 |
| `summary` | 默认推荐 | 兼顾统计和问题 |
| `full` | 需要完整目录树 | 最重，只在需要时使用 |

## Commands

### Local Script

```bash
node .codebuddy/scripts/structure-analyzer.js . --mode problems_only
node .codebuddy/scripts/structure-analyzer.js . --mode summary
node .codebuddy/scripts/structure-analyzer.js . --mode full
```

### MCP

```typescript
analyze_project_structure({
  projectPath: "/path/to/project",
  mode: "summary"
})
```

## Default Sequence

1. 如果用户只问“有没有结构问题”，先跑 `problems_only`
2. 如果用户问“整体结构怎么样”，先跑 `summary`
3. 只有在需要完整目录树或迁移规划时才跑 `full`

## Guardrails

- 不要默认跑 `full`
- 不要在未拿到结构化结果前直接判断“项目必须重构”
- 不要忽略用户的时间窗口和风险承受能力
