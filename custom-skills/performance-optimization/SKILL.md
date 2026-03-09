---
name: performance-optimization
description: 前端性能优化技能，涵盖渲染优化、虚拟滚动、懒加载策略和包体积分析。触发条件：性能优化、渲染卡顿、列表性能、包体积过大、加载速度慢。
metadata:
  triggers:
    - "性能优化/懒加载/虚拟滚动/首屏"
  frameworks:
    - react
    - vue
    - vue2
    - vue3
    - nextjs
  roles:
    - frontend
    - fullstack
  scenarios:
    - performance
    - rendering
    - loading
---

# Performance Optimization Skill

前端性能优化技能，按“渲染 / 列表”和“加载 / 包体积”两个方向路由。

## Routing

- **重渲染、长列表、响应式开销**：读取 [references/rendering-and-lists.md](references/rendering-and-lists.md)
- **懒加载、代码分割、资源体积**：读取 [references/loading-bundle-assets.md](references/loading-bundle-assets.md)

## Workflow

1. 先确认慢的是启动、首屏、交互、滚动还是构建产物。
2. 不同时优化所有层面，先挑最可能产生体感收益的一层。
3. 每次只做一组可复测的改动，并保留 before/after 指标。
4. 优先删除不必要工作量，其次再做缓存、分块或懒加载。

## Output

- 具体瓶颈位置
- 推荐改动和适用范围
- 观测指标
- 副作用与验证方法
