# Phase 2 执行计划：MCP 工具集成

> 计划编号: PLAN-003
> 关联话题: [003-phase2-mcp-integration](../threads/003-phase2-mcp-integration.md)
> 父计划: [PLAN-001](./001-structure-analyzer-implementation.md)
> 创建时间: 2026-01-28
> 状态: 🔵 执行中
> 负责人: Claude-Opus-4

---

## 📌 需求验证

### 目标用户

| 角色 | 描述 |
|------|------|
| AI 助手 | 通过 MCP 调用结构分析能力 |
| 开发者 | 通过自然语言触发结构分析 |

### 用户场景

| 场景 | 触发条件 | 期望结果 | 成功标准 |
|------|----------|----------|----------|
| AI 调用分析 | AI 需要了解项目结构 | 返回结构化的分析结果 | JSON 格式、Token 可控 |
| 自然语言触发 | 用户说"分析项目结构" | AI 自动调用 MCP 工具 | 无需手动执行命令 |

### 用户价值验收标准

- [ ] AI 可通过 MCP 调用 `analyze_project_structure`
- [ ] 默认返回精简结果，Token 消耗可控

---

## 📋 决策记录

| 决策点 | 最终决定 | 决策者 | 日期 |
|--------|----------|--------|------|
| 默认 mode | problems_only | @Human | 2026-01-26 |
| get_structure_tree | 暂缓实现 | @Human | 2026-01-26 |

---

## 📅 任务清单

### Phase 2: MCP 工具集成

**状态**: 🔵 执行中
**负责人**: Claude-Opus-4

| # | 任务 | 验收标准 | 状态 |
|---|------|----------|------|
| 2.1 | 定义 `analyze_project_structure` 工具 | 符合 MCP 规范 | 🔄 |
| 2.2 | 集成 structure-analyzer 脚本 | 可调用脚本 | ⬜ |
| 2.3 | 实现 mode 参数切换 | 三种模式正确，默认 problems_only | ⬜ |
| 2.4 | 添加错误处理 | 路径不存在/无权限/超时返回可读错误 | ⬜ |
| 2.5 | 实现 Token 控制 | 限制 topN、evidence 长度、tree 按需 | ⬜ |
| 2.6 | 测试 MCP 工具调用 | AI 可成功调用 | ⬜ |

---

## 📁 交付物

| 文件 | 说明 | 状态 |
|------|------|------|
| `mcp-server/src/tools/structure-analyzer.ts` | MCP 工具定义 | ⬜ |
| `mcp-server/src/index.ts` | 注册工具 | ⬜ |

---

## ✅ Phase 2 验收标准

### 技术验收
- [ ] MCP 工具注册成功
- [ ] AI 可通过 MCP 调用 `analyze_project_structure`
- [ ] 三种 mode 输出正确
- [ ] 默认 `mode=problems_only`，禁止默认返回完整树
- [ ] Token 消耗在合理范围内

### 用户价值验收
- [ ] 用户通过自然语言即可触发分析
- [ ] 返回结果清晰可读

---

## 🔧 技术约束

1. **MCP 规范**: 符合 Model Context Protocol 工具定义规范
2. **Token 效率**: 默认精简输出，避免大量 Token 消耗
3. **错误友好**: 返回可读的错误信息

---

## 📜 版本历史

| 版本 | 日期 | 修改内容 |
|------|------|----------|
| 1.0 | 2026-01-28 | 初始版本，从 PLAN-001 Phase 2 提取 |

---

*本计划遵循 [EXECUTION_PRINCIPLES.md](../EXECUTION_PRINCIPLES.md) 和 [plans/README.md](./README.md) 规范*
