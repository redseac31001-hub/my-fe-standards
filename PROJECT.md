# MY-FE-STANDARDS 项目架构图谱

> Role: capability and structure source of truth
> Updated: 2026-03-10
> Use `README.md` for entry and `ROADMAP.md` for execution status.

---

## 项目概述

**AI 辅助开发平台**：集成规则引擎 + 技能系统 + Agent 系统 + Reports 项目记忆 + MCP Server，为团队提供统一的 AI 辅助能力。

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MY-FE-STANDARDS 架构图谱                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         用户接入层                                   │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │   │
│  │  │ CodeBuddy │  │Claude Code│  │    Amp    │  │  Cursor   │        │   │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘        │   │
│  └────────┼──────────────┼──────────────┼──────────────┼───────────────┘   │
│           │              │              │              │                    │
│           ▼              ▼              ▼              ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      规则加载器 (codebuddy-loader)                   │   │
│  │  ├─ 技术栈检测 (Vue2/3, TypeScript, UI库)                           │   │
│  │  ├─ 三层规则架构加载                                                 │   │
│  │  ├─ 工具脚本分发 (structure-analyzer, module-mapper, report-manager) │   │
│  │  └─ .codebuddy 配置生成                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│           ┌────────────────────────┼────────────────────────┐              │
│           ▼                        ▼                        ▼              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   Rules 规则层   │    │  Skills 技能层  │    │  Agents 代理层  │        │
│  │                 │    │                 │    │                 │        │
│  │  Layer1: 基础   │    │  15 个技能      │    │  9 个 Agent     │        │
│  │  Layer2: 业务   │    │  (详见下方)     │    │  (详见下方)     │        │
│  │  Layer3: 行为   │    │                 │    │                 │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Reports 项目记忆系统                             │   │
│  │  ├─ architecture/latest.json: 架构快照                               │   │
│  │  ├─ modules/latest.json: 模块图谱                                    │   │
│  │  ├─ health/timeline.json: 健康度时间线                               │   │
│  │  └─ 差异对比 + 趋势分析 + ASCII 可视化                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         MCP Server                                   │   │
│  │  ├─ get_rules: 获取规则内容                                          │   │
│  │  ├─ get_skills: 获取技能定义                                         │   │
│  │  └─ get_manifest: 获取资源清单                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
my-fe-standards/
├── .claude/                    # Claude Code 项目配置
│   └── CLAUDE.md              # 项目架构设计文档
│
├── agents/                     # Agent 代理系统
│   ├── AGENTS.md              # Agent 注册表
│   ├── task-orchestrator/     # 任务编排 Agent (v2.0.0)
│   ├── planner/               # 规划 Agent
│   ├── tdd-driver/            # TDD 驱动 Agent (v1.0.0)
│   ├── code-reviewer/         # 代码审查 Agent (v1.0.0)
│   ├── build-fix/             # 构建修复 Agent (v1.0.0)
│   ├── security-reviewer/     # 安全审查 Agent
│   ├── performance-profiler/  # 性能分析 Agent
│   ├── structure-analyzer/    # 结构分析 Agent (v2.1.0)
│   └── system-overview-writer/ # 概要设计文档生成 Agent
│
├── config/                     # 配置文件
│   └── loader-config.json     # 加载器配置
│
├── custom-skills/              # 技能系统
│   ├── backend-code-review/   # 后端代码审查技能
│   ├── backend-testing/       # 后端测试技能
│   ├── frontend-code-review/  # 代码审查技能
│   ├── component-refactoring/ # 组件重构技能
│   ├── frontend-testing/      # 前端测试技能
│   ├── state-management/      # 状态管理技能
│   ├── performance-optimization/ # 性能优化技能
│   ├── build-optimization/    # 构建优化技能
│   ├── i18n-a11y/            # 国际化/无障碍技能
│   ├── module-mapping/        # 模块图谱技能
│   ├── structure-review/      # 结构审查技能
│   ├── prd/                   # PRD 分析技能
│   ├── ralph-converter/       # Ralph 转换技能
│   ├── system-overview-design/ # 系统概要设计技能
│   └── skill-creator/         # 技能创建器
│
├── mcp-server/                 # MCP 服务器
│   └── src/
│       └── index.ts           # MCP 服务入口
│
├── rules/                      # 三层规则架构
│   ├── layer1_base/           # 基础层规则
│   │   ├── architecture/      # 架构规范
│   │   ├── vue2/              # Vue 2 规范
│   │   ├── vue3/              # Vue 3 规范
│   │   └── typescript/        # TypeScript 规范
│   ├── layer2_business/       # 业务层规则
│   │   ├── vant.md            # Vant UI 规范
│   │   └── antdv.md           # Ant Design Vue 规范
│   └── layer3_action/         # 行为层规则
│       ├── testing.md         # 测试规范
│       └── debugging.md       # 调试规范
│
├── scripts/                    # 脚本工具
│   ├── src/                   # TypeScript 源码
│   │   ├── codebuddy-loader.ts # 规则加载器
│   │   ├── generate-manifest.ts # 清单生成器
│   │   ├── structure-analyzer.ts # 项目结构分析器
│   │   ├── module-mapper.ts   # 模块图谱分析器
│   │   ├── report-manager.ts  # 报告管理器
│   │   ├── taskbook-manager.ts # TaskBook 管理器 (v2.2.0)
│   │   ├── task-executor.ts   # 任务执行引擎 (v2.3.0, AgentRuntime 集成)
│   │   ├── agent-runtime.ts   # Agent 运行时 (v1.0.0, Agent 自动加载/prompt 渲染)
│   │   └── types/             # 类型定义
│   │       ├── index.ts
│   │       ├── agent-runtime.ts  # AgentRuntime 类型定义
│   │       ├── structure-analyzer.ts
│   │       ├── module-mapper.ts
│   │       └── reports.ts
│   └── dist/                  # 编译输出
│
└── manifest.json              # 资源清单
```

---

## 功能能力矩阵

### ✅ 已具备能力

| 分类 | 能力名称 | 实现位置 | 说明 |
|------|----------|----------|------|
| **核心能力** | | | |
| | 技术栈检测 | `scripts/src/codebuddy-loader.ts` | Vue 2/3 版本、UI 库、状态管理检测 |
| | 三层规则加载 | `scripts/src/codebuddy-loader.ts` | Layer1/2/3 规则动态加载 |
| | 配置生成 | `scripts/src/codebuddy-loader.ts` | .codebuddy 目录配置生成 |
| | 远程加载 | `scripts/src/codebuddy-loader.ts` | 支持远程拉取规则 |
| | Workspace 多项目识别 | `scripts/src/codebuddy-loader.ts` | 多语言项目自动发现（JS/TS/Java/Go/Python/Rust/.NET） |
| | @project 快捷定位 | `scripts/src/lib/prompt-builder.ts` | 对话中使用 `@project` 锁定目标项目，自动应用对应规则 |
| **Rules 规则** | | | |
| | 整洁代码原则 | `rules/layer1_base/code-quality/` | 命名、函数、SOLID、代码坏味道、审查清单 |
| | 架构规范 | `rules/layer1_base/architecture/` | Feature-Based 目录结构 |
| | Vue 2 规范 | `rules/layer1_base/vue2/` | 通用规范、Composition API |
| | Vue 3 规范 | `rules/layer1_base/vue3/` | Script Setup、Pinia、Router |
| | TypeScript | `rules/layer1_base/typescript/` | API 请求规范 |
| | UI 库规范 | `rules/layer2_business/` | Vant、Ant Design Vue |
| | 行为规范 | `rules/layer3_action/` | 测试、调试规范 |
| **Skills 技能** | | | |
| | 代码审查 | `custom-skills/frontend-code-review/` | 业务逻辑、代码质量、性能审查 |
| | 后端代码审查 | `custom-skills/backend-code-review/` | Node/Java/Rust 服务与 API 审查 |
| | 后端测试 | `custom-skills/backend-testing/` | Node/Java/Rust 单测、集成测试、API 测试 |
| | 组件重构 | `custom-skills/component-refactoring/` | 复杂度分析、组件拆分、Hook 提取 |
| | 前端测试 | `custom-skills/frontend-testing/` | Vue 2/3 测试、异步测试、Mock |
| | 状态管理 | `custom-skills/state-management/` | Vuex/Pinia 状态管理 |
| | 性能优化 | `custom-skills/performance-optimization/` | 前端性能优化 |
| | 构建优化 | `custom-skills/build-optimization/` | Webpack/Vite 构建优化 |
| | 国际化/无障碍 | `custom-skills/i18n-a11y/` | i18n 和 a11y 支持 |
| | 模块图谱 | `custom-skills/module-mapping/` | 模块边界识别、依赖图谱、热点分析 |
| | 结构审查 | `custom-skills/structure-review/` | 目录结构审查、健康度评分、重构建议 |
| | PRD 分析 | `custom-skills/prd/` | PRD 文档分析 |
| | Ralph 转换 | `custom-skills/ralph-converter/` | Ralph 格式转换 |
| | 系统概要设计 | `custom-skills/system-overview-design/` | 基于 Word 模板生成系统概要设计文档 |
| | 技能创建 | `custom-skills/skill-creator/` | 创建新技能 |
| **Agents 代理** | | | |
| | 任务编排 Agent | `agents/task-orchestrator/` | 端到端计划任务执行与验收，/task 命令 |
| | 规划 Agent | `agents/planner/` | 实施计划制定 |
| | TDD 驱动 Agent | `agents/tdd-driver/` | RED→GREEN→REFACTOR 循环驱动实现 |
| | 代码审查 Agent | `agents/code-reviewer/` | 按 clean-code 规则结构化审查 + 分级输出 |
| | 构建修复 Agent | `agents/build-fix/` | 构建失败自动诊断修复（最多 3 轮） |
| | 安全审查 Agent | `agents/security-reviewer/` | XSS 等安全检查 |
| | 性能分析 Agent | `agents/performance-profiler/` | 性能问题分析 |
| | 结构分析 Agent | `agents/structure-analyzer/` | 综合架构审查，模块识别，健康度评分 |
| | 概要设计文档生成 Agent | `agents/system-overview-writer/` | 读取 Word 模板并生成系统概要设计文档 |
| **Scripts 工具脚本** | | | |
| | 项目结构分析器 | `scripts/src/structure-analyzer.ts` | 目录结构健康度检测 (SA001-SA005) |
| | 模块图谱分析器 | `scripts/src/module-mapper.ts` | 功能模块识别、依赖分析、业务分类 |
| | 报告管理器 | `scripts/src/report-manager.ts` | 报告 CRUD、差异对比、趋势分析 |
| | TaskBook 管理器 | `scripts/src/taskbook-manager.ts` | 任务书 CRUD、变更追踪、验收报告 |
| | 任务执行引擎 | `scripts/src/task-executor.ts` | 并行任务调度、AgentRuntime 集成、批次汇报 |
| | Agent 运行时 | `scripts/src/agent-runtime.ts` | Agent 自动加载、YAML frontmatter 解析、Prompt 渲染 |
| **Reports 项目记忆** | | | |
| | 架构快照 | `.codebuddy/reports/architecture/` | 健康度评分、违规项、结构类型 |
| | 模块图谱 | `.codebuddy/reports/modules/` | 模块列表、依赖图、业务分类 |
| | 健康度时间线 | `.codebuddy/reports/health/` | 每日数据点、趋势预测 |
| | 差异对比 | `report-manager.js diff` | 快照对比、变更检测 |
| | 趋势分析 | `report-manager.js trend` | ASCII 图表、趋势预测 |
| **MCP Server** | | | |
| | ralph_* | `mcp-server/src/index.ts` | Ralph PRD/进度管理工具 |
| | analyze_project_structure | `mcp-server/src/index.ts` | 结构分析（反模式检测 + 健康度评分） |
| | codebuddy_set_workdir | `mcp-server/src/index.ts` | 设置默认项目工作目录 |
| | taskbook_* | `mcp-server/src/index.ts` | TaskBook CRUD/协作（JSON 输出） |
| | workflow_run | `mcp-server/src/index.ts` | Workflow 驱动执行 TaskBook（含 gates） |
### 🔄 开发中能力

| 能力名称 | 计划编号 | 状态 | 说明 |
|----------|----------|------|------|
| MCP analyze_project_structure | PLAN-001 | 🟢 已实现 | 结构分析 MCP 工具 |
| MCP taskbook_* / workflow_run | PLAN-003 | 🟢 已实现 | TaskBook/Workflow MCP 工具 |
| Agent 一拖多并行架构 | PLAN-006 | 🟢 已实现 | AgentRuntime + TaskExecutor 集成、并行调度、批次汇报 |

### ❌ 暂缓能力

| 能力名称 | 原因 | 备注 |
|----------|------|------|
| 依赖关系分析 | TS paths/Webpack alias 处理成本高 | 留待 P3+ |
| MCP get_structure_tree | Token 消耗过大 | 按需评估 |

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 开发语言 | TypeScript | 5.x |
| 运行环境 | Node.js | ES2018+ |
| 模块规范 | CommonJS | - |
| MCP SDK | @modelcontextprotocol/sdk | latest |

---

## 调用方式

### 1. CLI 命令行

```bash
# 本地运行
node scripts/dist/codebuddy-loader.js

# 远程运行（一键加载）
npx -y -q codebuddy-glm@latest
```

### 2. MCP 工具调用

```typescript
// AI 通过 MCP 调用
await mcp.call("get_rules", { layer: "layer1_base" });
await mcp.call("get_skills", { name: "frontend-code-review" });
```

### 3. Agent 调用

用户输入触发词即可激活对应 Agent：
- "帮我规划这个功能" → planner Agent
- "检查安全问题" → security-reviewer Agent
- "分析性能瓶颈" → performance-profiler Agent

### 4. Skill 触发

用户输入相关关键词自动触发技能：
- "审查这段代码" → frontend-code-review Skill
- "重构这个组件" → component-refactoring Skill

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-03-10 | unreleased | 新增 `system-overview-design` Skill、`system-overview-writer` Agent，以及系统概要设计模板抽取/Word 回填脚本 |
| 2026-03-07 | 3.3.0 | 新增私有化发布产物收集（`build:release`）、远程 Bearer Token、`--pack-only` 严格模式与对应安装/发布文档 |
| 2026-03-05 | 3.2.0 | Workspace 多语言项目识别（JS/TS/Java/Go/Python/Rust/.NET）；新增 `@project` 快捷项目定位约定；提示词和索引表增加语言列 |
| 2026-02-07 | 3.0.0 | Workflow v2.0.0 七步闭环；新增 tdd-driver/code-reviewer/build-fix Agent + Prompt 模板体系；TaskType 扩展为 10 种；task-executor Agent 路由 + prompt 注入 |
| 2026-01-30 | 2.3.0 | 新增整洁代码核心原则 (Clean Code)；code-quality 加入 Layer1 基础规则；更新评分系统 |
| 2026-01-30 | 2.2.0 | 新增 Task Orchestrator Agent；新增 /task 命令；新增 taskbook-manager、task-executor 脚本；支持端到端计划任务执行与验收 |
| 2026-01-29 | 2.1.0 | 新增 Reports 项目记忆系统；新增 structure-analyzer、module-mapper、report-manager 脚本；新增差异对比和趋势分析功能 |
| 2026-01-27 | 2.0.0 | 初始架构图谱；记录 10 个 Skills、3 个 Agents、MCP Server |

---

## 维护规范

### 新增能力时必须更新

1. **功能能力矩阵**：在对应分类下添加新行
2. **开发中能力**：计划批准后添加
3. **更新日志**：记录变更内容

### 能力完成后

1. 将「开发中能力」移至「已具备能力」
2. 更新版本号
3. 记录更新日志

---

*本文档是项目能力的唯一真理源，并与 `ROADMAP.md`、`ARCHITECTURE.md` 保持同步。*
