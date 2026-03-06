# Analysis Workflow

优先把 `module-mapper.js` 当成事实源，再基于脚本输出做解释，而不是先凭目录名主观推断。

## Default Sequence

1. 确认目标目录
2. 先跑 `summary`
3. 如果需要依赖图，再跑 `full` 或 `graph`
4. 基于输出识别热点模块、异常依赖、健康度问题
5. 给出下一步建议

## Mode Selection

| Mode | 适用场景 | 说明 |
|------|----------|------|
| `summary` | 默认首选 | 模块列表、规模、健康度，token 最省 |
| `full` | 需要解释依赖关系 | 包含更完整的模块详情和依赖视图 |
| `graph` | 用户明确要图 | 只输出图表，适合配合 Mermaid |

## Commands

```bash
# 默认：先拿摘要
node .codebuddy/scripts/module-mapper.js . --mode summary

# 深入分析
node .codebuddy/scripts/module-mapper.js . --mode full

# 只要图
node .codebuddy/scripts/module-mapper.js . --mode graph --output mermaid
```

如果用户指定了项目路径，把 `.` 替换成目标路径。

## Interpretation Order

不要一上来就评论“架构好坏”。先按下面顺序讲：

1. 模块是怎么切的
2. 哪些模块最大、最复杂、最脆弱
3. 哪些依赖关系异常
4. 哪些地方需要进一步重构或结构审查

## Escalation Rules

- **边界健康度问题为主**：转给 `structure-review`
- **单个模块或组件过大**：转给 `component-refactoring`
- **只是想看整体项目地图**：停留在本 skill 输出即可
