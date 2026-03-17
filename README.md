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
- [架构约束清单](./docs/reference/architecture-constraints.md)：新增能力时的兼容性与复杂度边界

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

### 业务项目跨平台安装

```bash
curl -fsSL https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/glm-v2/scripts/dist/codebuddy-install.js | node - --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/glm-v2
```

### 本地业务夹具远程 Smoke

```bash
npm run smoke:business-remote
```

### 快速正确性回归

```bash
npm test
```

`npm test` 默认执行仓库内的轻量正确性套件（`test:lib` + `test:correctness`），适合 workflow 的 smoke gate 和本地快速回归。

### 全量 E2E 回归

```bash
npm run test:full
```

> `test:full` 依赖 Node 允许 `child_process` 再次拉起子进程；受限沙箱会直接 fail-fast 提示环境限制。
> 仓库已提供手动触发的 GitHub Actions workflow `Full E2E`，适合在正常 CI 环境下执行整套回归。

## 产品入口

如果你不想先理解内部结构，直接按产品入口走：

- 安装 / 同步：`node scripts/dist/codebuddy-loader.js`
- 启动闭环：`node .codebuddy/scripts/task-orchestrator.js "<需求描述>"`
- 接管 / 继续：`node .codebuddy/scripts/task-executor.js <taskBookId>`
- 观察 / 诊断：`node .codebuddy/scripts/codebuddy-loader.js doctor --json` 和 `node .codebuddy/scripts/report-manager.js status`

完整入口说明见 [Product Surface Guide](./docs/guides/product-surface-guide.md)。

### 多工具格式转换

```bash
npm run tool:convert -- --tool cursor
```

## 常用命令

```bash
npm run build
npm run build:release
npm run tool:convert -- --tool all
npm test
npm run ci:correctness
npm run ci:full
npm run doctor:mcp-server-deps
npm run codebuddy
npm run remote
npm run remote:full
npm run smoke:business-remote
node scripts/dist/codebuddy-loader.js --workspace-scope project-targeted --project mcp-server --role backend
node scripts/dist/skill-validator.js check
npm run test:full
node test/run-tests.js --list-cases
node test/run-tests.js --suite local --case antdv-project
```

## Validator 模式

仓库当前有两个轻量 validator：

- `rule-validator`：检查 `rules/` 的元数据和结构完整性
- `skill-validator`：检查 `custom-skills/` 的 frontmatter、Markdown 链接和 bundled file discoverability

默认模式用于开发期回看，不会因为 warning 中断本地流：

```bash
npm run validate:rules
npm run validate:skills
```

默认模式语义：

- `error` 会导致非零退出
- `warning` 只会报告，不会导致非零退出

`--strict` 用于发布前、审查前或后续可选 CI gate：

```bash
npm run validate:rules:strict
npm run validate:skills:strict
```

> 仓库已提供手动触发的 GitHub Actions workflow `Validator Strict Gate`，适合在正常 CI 环境下显式执行 strict validator，而不改变默认 push/PR 的 correctness gate。

`--strict` 语义：

- `warning` 和 `error` 都会导致非零退出
- JSON 输出会带 `strictMode` 和 `effectiveOk`
- `ok` 保持基础兼容语义，`effectiveOk` 才是当前模式下的最终通过结果

推荐顺序：

1. 日常开发先跑默认模式，快速看 warning
2. 准备发布、收口仓库内容或做审查 gate 时，再跑 `--strict`

如果需要一次性执行两类 validator：

```bash
npm run validate:all
npm run validate:all:strict
```

如果需要一次性执行聚合 gate，并同时产出可审计 JSON 报告：

```bash
npm run validate:gate:strict -- --scope all --json --out-dir artifacts/validator-strict-gate
```

该命令会输出：

- `validator-gate-summary.json`
- `rule-validator-report.json`
- `skill-validator-report.json`

如果要把结果写入标准报告目录，供 `report-manager status/export` 读取：

```bash
npm run validate:gate:strict:report
```

默认会写到 `.codebuddy/reports/validators/latest/`。
同时会在 `.codebuddy/reports/validators/history/<timestamp>/` 留下同批次快照，供后续审计和趋势回看。

写入标准报告目录后，`node .codebuddy/scripts/codebuddy-loader.js doctor --json` 也会带上最近一次 validator gate 的诊断结果。
`node .codebuddy/scripts/report-manager.js status --json` 和 `export` 则会带出最近几次 validator gate 历史摘要，并给出相对上一轮的 trend/delta。
`node .codebuddy/scripts/report-manager.js cleanup` 现在也会按保留策略清理过旧的 validator gate history 目录。

如果需要机器可读的当前报告摘要：

```bash
node .codebuddy/scripts/report-manager.js status --json
```

如果需要机器可读的报告历史视图（含 validator gate runs）：

```bash
node .codebuddy/scripts/report-manager.js history --json
```

如果需要机器可读的趋势视图（含 health + validator trend）：

```bash
node .codebuddy/scripts/report-manager.js trend --json
```

如果需要机器可读的差异视图（含 architecture + module diff）：

```bash
node .codebuddy/scripts/report-manager.js diff --json
```

如果需要一次性导出统一的机器可读报告包（含 status/history/trend/diff，并同步写出 `export.md`）：

```bash
node .codebuddy/scripts/report-manager.js export --json
```

```bash
node .codebuddy/scripts/report-manager.js audit --json
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
- [产品入口指南](./docs/guides/product-surface-guide.md)
- [业务项目 Quickstart](./docs/guides/business-project-quickstart.md)
- [业务项目使用指南](./docs/guides/business-project-guide.md)
- [业务项目试点方案](./docs/guides/business-pilot-plan.md)
- [交接说明](./docs/guides/HANDOFF.md)
- [私有化发布与业务安装指南](./docs/guides/private-deployment-guide.md)
- [远程接入指南](./docs/guides/remote-usage-guide.md)
- [系统概要设计模板使用指南](./docs/guides/system-overview-design-guide.md)
- [本地业务夹具 Smoke](./docs/guides/local-business-fixture-smoke.md)
- [E2E 验证方案](./docs/guides/e2e-validation-playbook.md)
- [Workflow 使用指南](./docs/guides/workflows-guide.md)
- [Agent Call 远程写回](./docs/guides/agent-call-remote.md)
- [TaskBook 并发协作 SOP](./docs/guides/taskbook-collaboration-sop.md)
- [架构约束清单](./docs/reference/architecture-constraints.md)
- [Skills 索引](./custom-skills/skills-index.md)
- [技能系统说明（legacy）](./custom-skills/custom-skills-guide.md)

## 当前状态

- 能力主干已完成，重点转向分发可用性、提示瘦身与真实项目验证
- `task-orchestrator / task-executor / agent-call / TaskBook` 闭环已打通
- `Model Router` 仍是延后项，当前执行路径保持单 worker 稳定优先

具体状态请看 [ROADMAP.md](./ROADMAP.md)。

## 许可证

MIT
