---
name: build-optimization
description: 构建优化技能，涵盖 Vite/Webpack 配置优化、构建缓存和 CI 加速。触发条件：构建优化、构建速度慢、Vite 配置、Webpack 配置、包体积分析。
metadata:
  triggers:
    - "构建优化/Webpack/Vite/打包/分包"
---

# Build Optimization Skill

构建优化技能，专注于“先定位瓶颈，再做最小改动”的工作流。

## Routing

- **Vite 项目**：读取 [references/vite-optimization.md](references/vite-optimization.md)
- **Webpack 项目**：读取 [references/webpack-optimization.md](references/webpack-optimization.md)
- **CI、缓存、依赖分析**：读取 [references/ci-and-dependency-analysis.md](references/ci-and-dependency-analysis.md)

只加载和当前瓶颈直接相关的参考文件，不要一次性读完全部内容。

## Workflow

1. 确认构建工具、包管理器、CI 平台，以及用户感知到的慢点。
2. 建立基线：冷启动、热启动、冷构建、热构建、chunk 体积、依赖重复度。
3. 只选择 1-3 个最可能有效的改动，不要一次改完整个构建系统。
4. 变更后复测同一组指标，并记录 trade-off。

## Output

- 当前瓶颈判断
- 建议改动及优先级
- 预期收益与风险
- 验证步骤和回滚点
