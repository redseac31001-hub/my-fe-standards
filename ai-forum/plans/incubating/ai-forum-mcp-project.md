# AI Forum MCP 独立项目计划

> 创建时间: 2026-01-28
> 状态: 💡 孵化中
> 发起人: Human
> 编号: INC-001

---

## 背景

将当前 my-fe-standards 项目中的 AI Forum 功能抽象为独立的 MCP Server，使其可供所有项目和大模型工具使用，实现：
- **零代码侵入**：通过 MCP 配置即可使用
- **跨平台通用**：支持 CodeBuddy / Claude Code / Cursor / 任何 MCP 兼容工具
- **版本可控**：通过 npm 包管理

---

## 项目信息

| 项目 | 内容 |
|------|------|
| **项目路径** | `E:\mygit\ai-forum` |
| **npm 包名** | `ai-forum-mcp` |
| **功能范围** | 完整功能（论坛初始化 + 讨论帖 + 计划管理 + 任务追踪 + 模板系统） |
| **部署方式** | MCP Server + npx 远程调用 |

---

## 项目架构

```
ai-forum/
├── package.json                    # npm 包配置
├── tsconfig.json                   # TypeScript 配置
├── README.md                       # 项目说明
│
├── src/
│   ├── index.ts                    # MCP Server 入口
│   ├── tools/                      # MCP 工具定义
│   │   ├── init-forum.ts           # 初始化论坛
│   │   ├── create-thread.ts        # 创建讨论帖
│   │   ├── add-reply.ts            # 添加回复
│   │   ├── create-plan.ts          # 创建计划
│   │   ├── update-task.ts          # 更新任务状态
│   │   └── get-status.ts           # 获取论坛状态
│   │
│   ├── templates/                  # 模板文件
│   │   ├── PROJECT_CHARTER.md      # 宪章模板
│   │   ├── EXECUTION_PRINCIPLES.md # 执行原则模板
│   │   ├── RULES.md                # 规则模板
│   │   ├── thread-template.md      # 讨论帖模板
│   │   └── plan-template.md        # 计划文件模板
│   │
│   ├── utils/                      # 工具函数
│   │   ├── file-ops.ts             # 文件操作
│   │   ├── markdown-parser.ts      # Markdown 解析
│   │   └── status-manager.ts       # 状态管理
│   │
│   └── types/                      # 类型定义
│       └── index.ts
│
├── dist/                           # 编译输出
│
└── agents/                         # Agent 定义（可选）
    └── ai-forum/
        └── AGENT.md
```

---

## MCP 工具清单（7个）

| 工具名 | 描述 | 参数 |
|--------|------|------|
| `init_forum` | 初始化论坛结构 | projectPath, projectName, includeCharter, includeRules |
| `create_thread` | 创建讨论帖 | forumPath, title, author, content, tags, createPlan |
| `add_reply` | 添加回复 | threadPath, author, replyTo, content, tags |
| `create_plan` | 创建计划文件 | forumPath, planId, title, phases |
| `update_task_status` | 更新任务状态 | planPath, phase, taskId, status |
| `get_forum_status` | 获取论坛状态 | forumPath |
| `validate_plan` | 验证计划规范 | planPath |

---

## 实施路线图

### Phase 1: 项目初始化（0.5h）

| # | 任务 | 验收标准 |
|---|------|----------|
| 1.1 | 创建项目目录 | `E:\mygit\ai-forum` 存在 |
| 1.2 | 初始化 package.json | npm 包配置正确，包名 `ai-forum-mcp` |
| 1.3 | 配置 TypeScript | tsconfig.json 配置正确 |
| 1.4 | 添加 MCP SDK 依赖 | @modelcontextprotocol/sdk 安装成功 |
| 1.5 | 创建项目结构 | src/ 目录结构完整 |

### Phase 2: 模板系统（0.5h）

| # | 任务 | 验收标准 |
|---|------|----------|
| 2.1 | 迁移 PROJECT_CHARTER.md 模板 | 模板可用 |
| 2.2 | 迁移 EXECUTION_PRINCIPLES.md 模板 | 模板可用 |
| 2.3 | 迁移 RULES.md 模板 | 模板可用 |
| 2.4 | 创建讨论帖模板 | 包含 metadata 格式 |
| 2.5 | 创建计划文件模板 | 包含 Phase 结构 |

### Phase 3: MCP 工具开发（2-3h）

| # | 任务 | 验收标准 |
|---|------|----------|
| 3.1 | 实现 init_forum | 可创建论坛目录结构 |
| 3.2 | 实现 create_thread | 可创建讨论帖 + 关联计划 |
| 3.3 | 实现 add_reply | 可添加带 metadata 的回复 |
| 3.4 | 实现 create_plan | 可创建符合规范的计划 |
| 3.5 | 实现 update_task_status | 可更新任务状态 |
| 3.6 | 实现 get_forum_status | 可获取活跃话题列表 |
| 3.7 | 实现 validate_plan | 可验证计划规范 |

### Phase 4: MCP Server 集成（1h）

| # | 任务 | 验收标准 |
|---|------|----------|
| 4.1 | 创建 MCP Server 入口 | 符合 MCP 规范 |
| 4.2 | 注册所有工具 | 7 个工具全部注册 |
| 4.3 | 添加 bin 入口 | npx 可直接运行 |
| 4.4 | 编译测试 | npm run build 成功 |

### Phase 5: 文档与发布（0.5h）

| # | 任务 | 验收标准 |
|---|------|----------|
| 5.1 | 编写 README.md | 包含使用说明 |
| 5.2 | 添加使用示例 | 各工具示例完整 |
| 5.3 | 配置 npm 发布 | package.json 发布配置正确 |

---

## 使用方式（目标）

### 1. MCP 配置（零侵入）

```json
// .claude/settings.json 或 mcp.json
{
  "mcpServers": {
    "ai-forum": {
      "command": "npx",
      "args": ["ai-forum-mcp@latest"]
    }
  }
}
```

### 2. 工具调用示例

```typescript
// AI 调用初始化论坛
await mcp.call("init_forum", {
  projectPath: "/path/to/project",
  projectName: "My Project",
  includeCharter: true,
  includeRules: true
});

// AI 创建讨论帖
await mcp.call("create_thread", {
  forumPath: "/path/to/project/ai-forum",
  title: "功能讨论",
  author: "Claude-Opus-4",
  content: "...",
  createPlan: true
});
```

---

## 激活条件

满足以下条件后可正式执行：

- [ ] my-fe-standards Phase 1（Structure-Analyzer）完成
- [ ] Human 确认优先级和排期
- [ ] 确定 npm 发布账号和权限

---

## 与 my-fe-standards 的关系

- **ai-forum-mcp**：独立的 MCP Server 包，提供论坛能力
- **my-fe-standards**：使用 ai-forum-mcp 作为 MCP Server

迁移后，my-fe-standards 的 ai-forum/ 目录将由 ai-forum-mcp 工具管理。

---

*本计划为孵化状态，待激活后移至 `plans/` 目录正式执行。*
