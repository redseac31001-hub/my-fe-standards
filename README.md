# my-fe-standards

> AI 辅助开发标准工程：规则、技能、Agent、TaskBook、Workflow 与分发脚本的统一仓库。

## 这是什么

`my-fe-standards` 提供一套可安装到业务项目的本地 AI 协作能力，核心包括：

- 三层规则体系：`rules/`
- 技能系统：`custom-skills/`
- Agent 系统：`agents/`
- TaskBook / Workflow 契约：`taskbooks/`、`workflows/`
- 加载与执行脚本：`scripts/`
- 远程分发清单与 content pack：`manifest.json`、`packs/`

最终目标不是“写一堆提示词”，而是把这些能力稳定分发到业务仓库的 `.codebuddy/` 中，并支持分析、规划、执行、验收闭环。

## 三份主文档

- [README.md](./README.md)：项目入口、快速开始、文档导航
- [PROJECT.md](./PROJECT.md)：能力与结构真理源
- [ROADMAP.md](./ROADMAP.md)：执行状态、优先级、里程碑
- [ARCHITECTURE.md](./ARCHITECTURE.md)：目标架构与分层边界

## 快速开始

### 本地构建

```bash
npm install
npm run build
```

### 本地安装到业务项目

```bash
node scripts/dist/codebuddy-loader.js
```

### 远程模式验证

```bash
npm run remote
```

### 本地业务夹具远程 Smoke

```bash
npm run smoke:business-remote
```

### 全量回归

```bash
node test/run-tests.js
```

## 常用命令

```bash
npm run build
npm run build:release
npm run codebuddy
npm run remote
npm run remote:full
npm run smoke:business-remote
node scripts/dist/codebuddy-loader.js --workspace-scope project-targeted --project mcp-server --role backend
node scripts/dist/skill-validator.js check
node test/run-tests.js
```

## 仓库结构

```text
my-fe-standards/
├── agents/          # Agent 定义
├── config/          # loader 配置
├── custom-skills/   # 技能库
├── docs/            # 分层文档
├── mcp-server/      # MCP 服务实现
├── packs/           # 远程 content packs
├── rules/           # 三层规则
├── scripts/         # 源码与构建产物
├── taskbooks/       # TaskBook schema / 模板
├── test/            # 回归测试
└── workflows/       # Workflow schema / 模板
```

详细能力、目录责任与实现位置请看 [PROJECT.md](./PROJECT.md)。

## 文档索引

- [文档总索引](./docs/README.md)
- [业务项目使用指南](./docs/guides/business-project-guide.md)
- [业务项目试点方案](./docs/guides/business-pilot-plan.md)
- [交接说明](./docs/guides/HANDOFF.md)
- [私有化发布与业务安装指南](./docs/guides/private-deployment-guide.md)
- [远程接入指南](./docs/guides/remote-usage-guide.md)
- [本地业务夹具 Smoke](./docs/guides/local-business-fixture-smoke.md)
- [E2E 验证方案](./docs/guides/e2e-validation-playbook.md)
- [Workflow 使用指南](./docs/guides/workflows-guide.md)
- [Agent Call 远程写回](./docs/guides/agent-call-remote.md)
- [TaskBook 并发协作 SOP](./docs/guides/taskbook-collaboration-sop.md)
- [Skills 索引](./custom-skills/skills-index.md)
- [技能系统说明（legacy）](./custom-skills/custom-skills-guide.md)

## 当前状态

- 能力主干已完成，重点转向分发可用性、提示瘦身与真实项目验证
- `task-orchestrator / task-executor / agent-call / TaskBook` 闭环已打通
- `Model Router` 仍是延后项，当前执行路径保持单 worker 稳定优先

具体状态请看 [ROADMAP.md](./ROADMAP.md)。

## 许可证

MIT
