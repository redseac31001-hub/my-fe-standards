# AI 辅助开发平台

> **前端架构师规则库 + Ralph 自主编码系统 + 项目记忆系统 + 计划任务系统**

这是一个完整的 AI 辅助开发平台，集成了：
- **规则引擎**：三层规则架构，为 CodeBuddy (GLM-4.7) 提供知识源
- **技能系统**：可扩展的专业技能库
- **Agent 系统**：任务编排、结构分析、安全审查、性能分析等智能代理
- **Reports 项目记忆**：持久化分析结果，避免重复分析，追踪健康度趋势
- **TaskBook 计划任务**：端到端的需求分解→执行→验收闭环
- **MCP Server**：标准化工具接口

## 🎯 核心特性

- **三层规则架构**：基础层 + 业务层 + 动作层，渐进式加载
- **整洁代码原则**：命名、函数、SOLID、代码坏味道，所有任务自动遵循
# AI 辅助开发平台

> **前端架构师规则库 + Ralph 自主编码系统 + 项目记忆系统 + 计划任务系统**

这是一个完整的 AI 辅助开发平台，集成了：
- **规则引擎**：三层规则架构，为 CodeBuddy (GLM-4.7) 提供知识源
- **技能系统**：可扩展的专业技能库
- **Agent 系统**：任务编排、结构分析、安全审查、性能分析等智能代理
- **Reports 项目记忆**：持久化分析结果，避免重复分析，追踪健康度趋势
- **TaskBook 计划任务**：端到端的需求分解→执行→验收闭环
- **MCP Server**：标准化工具接口

## 🎯 核心特性

- **三层规则架构**：基础层 + 业务层 + 动作层，渐进式加载
- **整洁代码原则**：命名、函数、SOLID、代码坏味道，所有任务自动遵循
- **技能系统**：支持 CodeBuddy Skills，动态加载专业技能
- **计划任务系统**：/task 命令，端到端的需求分解→执行→验收
- **Workflow Spec**：工作流规范（步骤依赖 DAG + 质量闸门 gates + 策略 policies），支持多工具/多模型快速适配
- **项目记忆系统**：架构快照、模块图谱、健康度时间线，差异对比和趋势分析
- **智能检测**：自动识别 Vue 2/3 版本和 UI 库依赖
- **远程加载**：支持 HTTP 远程模式和 Git 私有仓库模式
- **多工具支持**：CodeBuddy / Claude Code / Amp
- **Workspace 多项目定位**：`@project` 快捷锁定目标项目，自动应用对应规则
- **全中文支持**：规则内容和提示词全部使用简体中文

## 📂 目录结构

```text
my-fe-standards/
├── agents/                     # 🤖 Agent 系统
│   ├── task-orchestrator/     #    任务编排 Agent (v2.2.0)
│   ├── structure-analyzer/     #    结构分析 Agent (v2.1.0)
│   ├── planner/               #    规划 Agent
│   ├── tdd-driver/            #    TDD 驱动 Agent
│   ├── code-reviewer/         #    代码审查 Agent
│   ├── build-fix/             #    构建修复 Agent
│   ├── bug-investigator/      #    Bug 调查 Agent (NEW)
│   ├── security-reviewer/     #    安全审查 Agent
│   └── performance-profiler/  #    性能分析 Agent
├── config/
│   └── loader-config.json      # 加载器配置
├── custom-skills/              # 🧩 技能库
│   ├── component-refactoring/  #    组件重构技能
│   ├── frontend-code-review/   #    代码审查技能
│   ├── frontend-testing/       #    前端测试技能
│   ├── prd/                    #    PRD 生成技能
│   ├── ralph-converter/        #    PRD 转换技能
│   └── skill-creator/          #    技能创建指南
├── mcp-server/                 # 🔌 MCP Server
├── rules/
│   ├── layer1_base/            # 🧱 基础层 - 通用技术标准
│   ├── layer2_business/        # 🏢 业务层 - UI 库规范
│   └── layer3_action/          # ⚡ 动作层 - 任务检查清单
├── workflows/                  # 🧭 Workflow Spec（模板 + Schema）
├── taskbooks/                  # 📒 TaskBook（契约 + Schema）
└── scripts/
    ├── dist/                   # 编译后的脚本
    └── src/                    # TypeScript 源码
        ├── codebuddy-loader.ts #    规则加载器
        ├── structure-analyzer.ts #  项目结构分析器
        ├── module-mapper.ts    #    模块图谱分析器
        ├── report-manager.ts   #    报告管理器
        ├── taskbook-manager.ts #    TaskBook 管理器 (v2.2.0)
        └── task-executor.ts    #    任务执行引擎 (v2.2.0)
```

## 🚀 快速开始

### 方式一：远程一键执行 (推荐)

无需下载任何文件，直接从远程拉取脚本并执行：

```bash
# 一键远程加载规则（无需预先下载脚本）
curl -fsSL https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/codebuddy-glm/scripts/dist/codebuddy-loader.bundle.js | node - --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/codebuddy-glm
```

### 方式二：本地模式

```bash
# 1. 克隆仓库
git clone -b feature/codebuddy-glm https://github.com/redseac31001-hub/my-fe-standards.git
cd my-fe-standards

# 2. 在目标项目根目录运行加载器
cd /path/to/your/project
node /path/to/my-fe-standards/scripts/dist/codebuddy-loader.js

# 或使用 npm 脚本
npm run codebuddy
```

### 方式三：Git 私有仓库模式（暂未支持）

当前版本的 `codebuddy-loader.js` 仅支持：
- 本地模式：从本仓库读取 `rules/` + `config/`
- 远程模式：通过 `--remote <URL>` 从静态 HTTP 源读取 `manifest.json` + `rules/`

如需在企业内网/私有环境使用，建议将规则仓库构建产物（`manifest.json`、`rules/`、`config/`）部署到内网静态服务器，然后使用 `--remote` 接入。

## 📋 三层规则架构

| 层级 | 加载模式 | 内容 |
|------|----------|------|
| **Layer 1 (Base)** | Eager 加载 | 通用的 Vue/TS/架构规范，根据项目自动分流 |
| **Layer 2 (Business)** | Lazy 加载 | 检测到特定 UI 库依赖时加载对应规范 |
| **Layer 3 (Action)** | Lazy 加载 | 任务检查清单，按需读取 |

### 渐进式加载

- **Layer 1** 规则直接嵌入 `project-rules.md`（核心规范常驻）
- **Layer 2/3** 规则生成索引，缓存到 `.codebuddy/rules_cache/`
- CodeBuddy 根据任务类型使用 `read_file` 按需加载

## 📊 项目记忆系统 (Reports)

加载器会自动分发工具脚本到业务项目，支持项目分析和报告持久化：

### 分析脚本

```bash
# 项目结构分析（健康度评分、违规检测）
node .codebuddy/scripts/structure-analyzer.js .

# 模块图谱分析（模块识别、依赖关系、业务分类）
node .codebuddy/scripts/module-mapper.js .
```

### 报告管理

```bash
# 查看报告状态
node .codebuddy/scripts/report-manager.js status

# 对比架构快照差异
node .codebuddy/scripts/report-manager.js diff

# 查看健康度趋势（含 ASCII 图表）
node .codebuddy/scripts/report-manager.js trend

# 列出历史快照
node .codebuddy/scripts/report-manager.js history

# 导出 Markdown 报告
node .codebuddy/scripts/report-manager.js export
```

## 📋 计划任务系统 (TaskBook)

使用 `/task` 命令创建端到端的计划任务：

### 使用方式

```bash
# Slash Command 方式
/task 实现用户登录功能
/task 重构订单处理模块
/task --type=debugging 修复支付失败问题

# 关键词触发（自动识别）
帮我实现商品搜索功能
开发用户中心模块
重构购物车逻辑
```

### 工作流程

```
意图识别 → 上下文收集 → 需求分解 → 用户确认 → 自动执行 → 变更追踪 → 验收闭环
```

### 核心特性

| 特性 | 说明 |
|------|------|
| **并行执行** | 无依赖任务自动并行，提升效率 |
| **优先级调度** | 默认按 `critical > high > medium > low` 选择可执行任务 |
| **变更追踪** | 实时记录偏离原计划的改动及原因 |
| **阻塞处理** | 遇到阻塞暂停，等待用户介入 |
| **验收闭环** | 生成验收报告，请求最终确认 |
| **任务持久化** | TaskBook 可恢复，支持中断继续 |

### TaskBook 存储

```text
.codebuddy/taskbooks/
├── taskbook.schema.json         # TaskBook JSON Schema（契约）
├── active/                      # 进行中的任务书
│   └── tb-20260130-user-auth.json
└── history/                     # 已完成的任务书
    └── tb-20260129-refactor.json
```

### 执行 TaskBook（Workflow 驱动）

```bash
# 默认读取 .codebuddy/workflows/default.workflow.json
node .codebuddy/scripts/task-executor.js <taskBookId>

# 若遇到 MANUAL_REQUIRED：会自动生成 .codebuddy/agent-calls/<requestId>.prompt.md，并将任务置为 blocked。
# 外部 Agent 按 prompt 执行并写回 .codebuddy/agent-calls/<requestId>.result.json 后，重跑 task-executor 会自动 apply 并继续。
```

### Agent Call 管理（可选）

```bash
# 列出所有 agent-calls（prompt/result 状态）
node .codebuddy/scripts/agent-call-manager.js list

# 查看某个 request
node .codebuddy/scripts/agent-call-manager.js show <requestId>

# 校验 result.json（若 prompt 存在，会推断 planner/manual-task 并对 output 做更严格校验）
node .codebuddy/scripts/agent-call-manager.js validate <requestId>

# 可选：启动 HTTP 服务（跨进程/跨机器写回 result.json；也支持 /taskbooks 与 /orchestrate 远程触发闭环）
node .codebuddy/scripts/agent-call-manager.js serve --host 127.0.0.1 --port 4317 --token <token>
```

### Agent Registry（可选）

```bash
# 列出已安装的 Agents（用于发现/校验）
node .codebuddy/scripts/agent-registry.js list --json

# 查看单个 Agent 元数据
node .codebuddy/scripts/agent-registry.js show <agentId> --json
```

### Rule / Skill Validator（可选）

```bash
# 校验已加载的 rules（默认探测 .codebuddy/rules_cache 或 repo 下的 rules/）
node .codebuddy/scripts/rule-validator.js check --json

# 校验已加载的 skills（默认探测 .codebuddy/skills 或 repo 下的 custom-skills/）
node .codebuddy/scripts/skill-validator.js check --json
```

### 管理 TaskBook（命令行）

```bash
# 一键闭环（推荐）：创建 → 规划（planner prompt/result）→ confirm → 执行（含 agent-call 阻塞/恢复）→ 验收归档
node .codebuddy/scripts/task-orchestrator.js "实现用户登录/登出" --type new-feature
  # 若 workflow 卡在 review gate，可加：--approve review_passed
  # 若中断/阻塞后继续：--taskbook <taskBookId>
  # 可选：自动等待 result.json 并继续到完成：加 --watch（可配 --watch-timeout-ms）

# 创建 TaskBook
node .codebuddy/scripts/taskbook-manager.js create --title "用户登录" --description "实现登录/登出" --type new-feature

# 添加任务
node .codebuddy/scripts/taskbook-manager.js add-task <taskBookId> --title "生成架构/模块报告" --type analysis

  # 生成 planner prompt（让外部 Agent 产出任务分解，并写回 result.json）
  node .codebuddy/scripts/taskbook-manager.js plan <taskBookId>

  # 应用 planner 结果：把 result.json 追加为 TaskBook 任务（可选：--dry-run 预览）
  node .codebuddy/scripts/taskbook-manager.js apply-plan <taskBookId> <requestId>
  # 若启用并发保护：加上 --if-rev <revision>

  # 确认并开始执行（先 confirm，再执行 executor）
  node .codebuddy/scripts/taskbook-manager.js confirm <taskBookId>
  node .codebuddy/scripts/task-executor.js <taskBookId>

  # 解除阻塞（blocked）任务：恢复为 pending，并记录解除原因
  node .codebuddy/scripts/taskbook-manager.js unblock <taskBookId> <taskId> --resolution "已补充 scope 并拆分任务"

  # 可选：随时生成验收/批量/闸门报告（可落盘到 .codebuddy/reports/taskbooks/）
  node .codebuddy/scripts/taskbook-manager.js report <taskBookId> --write
  # 报告会汇总：gates / batches / agent-calls 等关键事件，便于审计与恢复

  # 可选：手动校验契约（TaskBook/Workflow）
  node .codebuddy/scripts/contract-validator.js --workflows --taskbooks

  # 可选：校验 agent-call result.json（.codebuddy/agent-calls）
  node .codebuddy/scripts/contract-validator.js --agent-call <requestId>

  # 可选：当启用 risk_tiered batching 时，提示（warning）缺少 scope.files/modules 的任务
  node .codebuddy/scripts/contract-validator.js --workflows --taskbooks --check-batching-scope

  # 可选（严格模式）：将上述提示升级为 error（用于 CI/团队强约束）
  node .codebuddy/scripts/contract-validator.js --workflows --taskbooks --strict-batching-scope
  ```

### 报告目录结构

```text
.codebuddy/reports/
├── manifest.json                 # 报告索引
├── architecture/
│   ├── latest.json              # 最新架构快照
│   └── 2026-01-29T10-30-00.json # 历史快照
├── modules/
│   ├── latest.json              # 模块图谱
│   └── 2026-01-29T10-30-00.json # 历史快照
├── gates/
│   └── <taskBookId>/
│       └── <timestamp>.<stepId>.<gateId>.json # 质量闸门执行证据
├── taskbooks/
│   └── <taskBookId>.acceptance.json # 验收报告
└── health/
    └── timeline.json            # 健康度时间线
```

## 🏢 Workspace 多项目定位

当 Workspace 包含多个子项目时，加载器会自动发现并生成项目索引。在对话中使用 `@project` 可快速锁定目标项目：

### 用法

```
@project <项目名称|路径前缀|别名>
<你的需求描述>
```

### 示例

```
@project app-mobile
帮我添加一个新的列表页

@project admin
检查登录逻辑有没有问题
```

### 匹配规则

| 规则 | 说明 |
|------|------|
| **精确匹配** | 优先匹配项目名称或路径前缀 |
| **模糊匹配** | 输入名称是项目名/路径的子串时自动匹配 |
| **自动路由** | 未指定 `@project` 时，按编辑文件路径自动路由到对应项目 |

### 行为约定

- 指定 `@project` 后，本轮对话中所有文件操作默认限定在该项目目录下
- 自动应用该项目对应的 Layer2 规则缓存
- 相关命令行选项：`--no-workspace` 可禁用多项目自动发现

## 🧩 技能系统

本规则库支持 CodeBuddy Skills 功能，提供以下技能：

| 技能 | 触发场景 |
|------|----------|
| **component-refactoring** | 组件重构、代码优化 |
| **frontend-code-review** | 代码审查、PR Review |
| **frontend-testing** | 编写测试、测试策略 |
| **skill-creator** | 创建新技能 |

### 技能调用

当 CodeBuddy 识别到相关任务时，会自动：
1. 读取 `.codebuddy/skills/<技能ID>/SKILL.md`
2. 根据路由逻辑加载 `references/` 下的详细文档
3. 基于完整上下文执行任务

## 🔧 命令行选项

```bash
node codebuddy-loader.js [options]
```

| 选项 | 说明 |
|------|------|
| `--help, -h` | 显示帮助信息 |
| `--remote <URL>` | 从远程 URL 获取规则 |
| `--task <type>` | 按任务类型筛选规则 |
| `--threshold <n>` | 设置相关性阈值 (0-1) |
| `--rule-level <lvl>` | 规则裁剪等级：`summary` / `quick` / `full`（默认 `full`） |
| `--enable-orchestrator` | 启用 B 路线编排脚本分发 |
| `--no-workspace` | 禁用 Workspace 多项目自动发现 |
| `--verbose, -v` | 启用详细日志 |
| `--timeout <ms>` | 设置网络请求超时 |

### 任务类型

- `refactoring` - 代码重构、优化
- `debugging` - Bug 修复、问题排查
- `testing` - 编写测试、测试策略
- `new-feature` - 开发新功能
- `code-review` - 代码审查

## 📖 输出说明

加载器会在目标项目生成以下文件：

```text
.codebuddy/
├── rules/
│   └── project-rules.md    # 主规则文件 (CodeBuddy 自动读取)
├── rules_cache/            # 规则缓存 (按需读取)
│   ├── layer2_business/
│   └── layer3_action/
├── scripts/                # 可执行脚本（TaskBook/Executor/Validator 等）
├── workflows/              # Workflow Spec（工作流规范 + schema）
├── taskbooks/              # TaskBook SSOT（active/history + schema）
├── agent-calls/            # Agent Call 文件协议（prompt/result + schema）
├── commands/               # Slash Commands（/task、/agent-call）
└── skills/                 # 技能文件 (动态加载)
```

## 🔨 开发指南

### 可用的 npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run build` | 编译 TypeScript + 生成 manifest.json |
| `npm run build:scripts` | 仅编译 TypeScript 脚本 |
| `npm run build:manifest` | 仅生成规则清单 manifest.json |
| `npm run codebuddy` | 本地模式运行加载器 |
| `npm run serve` | 启动本地 HTTP 服务器（测试用） |
| `npm run remote` | **远程模式测试（核心）**：下载 `codebuddy-loader.bundle.js` 并拉取规则 |
| `npm run remote:full` | **远程模式测试（完整编排）**：额外启用 `--enable-orchestrator` |

### 远程模式测试

`npm run remote` 命令用于验证完整的远程拉取流程：

```bash
# 1. 先将代码推送到 GitHub
git add . && git commit -m "更新规则" && git push

# 2. 运行远程测试
npm run remote
```

该命令会：
1. 从 GitHub Raw URL 下载 `codebuddy-loader.bundle.js`
2. 执行加载器，从远程拉取 `manifest.json` 和规则文件
3. 在当前目录生成 `.codebuddy/` 配置

### 生成 Manifest

```bash
node scripts/generate-manifest.js
```

### 测试加载器

```bash
# 本地模式测试
node scripts/codebuddy-loader.js

# 远程模式测试
node scripts/codebuddy-loader.js --remote <URL> --verbose
```

### 添加新规则

1. 在对应层级目录创建 `.md` 文件
2. 参考 `rules/_meta/rule-template.md` 编写规则
3. 运行 `node scripts/generate-manifest.js` 更新清单

## 📝 规则编写指南

每条规则应包含：

1. **Context**: 适用场景
2. **The Rule**: 具体的规范描述
3. **Reasoning**: 背后的原理（帮助 AI 理解权衡）
4. **Examples**: 正面 (✅) 与反面 (❌) 的代码示例

## 🔗 相关文档

- [业务项目使用指南（接入必读）](docs/business-project-guide.md)
- [交接/接力说明（团队协作）](docs/HANDOFF.md)
- [远程接入指南](docs/remote-usage-guide.md)
- [业务项目 E2E 验证方案](docs/e2e-validation-playbook.md)
- [Workflow Spec 使用指南](docs/workflows-guide.md)
- [Agent Call 远程写回指南（可选）](docs/agent-call-remote.md)
- [TaskBook 并发协作 SOP](docs/taskbook-collaboration-sop.md)
- [技能系统说明](custom-skills/custom-skills-guide.md)
- [技能增强文档](README-SKILLS-ENHANCEMENT.md)

## 📌 版本信息

- **版本**: 2.3.0
- **适用工具**: CodeBuddy (GLM-4.7) / Claude Code / Amp
- **分支**: feature/codebuddy-glm
- **更新日期**: 2026-01-30

## 📄 许可证

MIT
