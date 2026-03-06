# Story Sizing And Ordering

Ralph 每次迭代都会在新的上下文里执行一个故事。故事过大，成功率就会明显下降。

## Sizing Rule

每个故事都必须能在一次 Ralph 迭代内完成。经验标准：

- 能用 2-3 句话说清楚改动范围
- 只覆盖一个清晰目标
- 不需要跨多个子系统大面积联动

## Good Story Shapes

- 新增一个数据库字段和迁移
- 为已有页面增加一个 UI 组件
- 给现有 server action 增加一段逻辑
- 增加一个筛选器、排序器、状态切换器

## Stories That Need Splitting

以下通常过大，应拆分：

- “做完整个 dashboard”
- “加上认证系统”
- “重构整个 API”
- “增加通知系统”

可拆成：

1. schema / migration
2. backend service or action
3. UI entry point
4. detail interaction
5. preferences / secondary views

## Ordering Rule

故事按依赖顺序执行，前面的故事不能依赖后面的故事。

推荐顺序：

1. Schema / database
2. Backend logic / API / server actions
3. UI components that consume the backend
4. Aggregated dashboards or summary pages

## Priority Guidance

- `priority: 1` 给最底层、最先决的变更
- 后续故事按依赖和文档顺序递增
- 如果两个故事互不依赖，先放更基础、更容易验证的那个

## Guardrails

- 不要把多个独立页面塞进一个故事
- 不要让一个故事同时包含 schema、service、UI 全链路，除非范围极小
- 如果 PRD 原文故事过粗，先重写为更小的 stories，再做 JSON 映射
