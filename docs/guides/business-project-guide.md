# 业务项目使用指南

> 面向业务项目开发者，介绍如何接入 my-fe-standards 规则库，覆盖资源加载、预期目标、检测验证和常见问题。

## 目录

1. [前置条件](#1-前置条件)
2. [资源下载与加载](#2-资源下载与加载)
3. [本仓库内的影子业务项目 Smoke](#3-本仓库内的影子业务项目-smoke)
4. [加载后的目录结构](#4-加载后的目录结构)
5. [任务执行路径选择](#5-任务执行路径选择)
6. [预期完成目标](#6-预期完成目标)
7. [检测验证标准](#7-检测验证标准)
8. [常见问题与排查](#8-常见问题与排查)
9. [进阶用法](#9-进阶用法)

---

## 1. 前置条件

| 项目 | 要求 |
|------|------|
| Node.js | ≥ 16.x（推荐 18+） |
| AI 工具 | CodeBuddy (GLM-4.7)、Claude Code 或 Amp |
| 项目类型 | 含 `package.json` 的前端项目（Vue 2/3、React 等） |
| 网络 | 远程模式需要能访问 GitHub Raw（或内网静态服务器） |

---

## 2. 资源下载与加载

### 方式一：远程一键加载（推荐）

优先使用跨平台安装脚本 `codebuddy-install.js`。它会自动下载 loader，并默认补齐：

```text
--profile analysis --rule-level quick --pack-only
```

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/glm-v2/scripts/dist/codebuddy-install.js | node - --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/glm-v2
```

Windows PowerShell：

```powershell
iwr https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/glm-v2/scripts/dist/codebuddy-install.js -OutFile codebuddy-install.js
node codebuddy-install.js --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/glm-v2
```

如需完整编排能力，追加：

```text
--profile full
```

### 方式一补充：直接执行 loader

无需下载任何文件，在**业务项目根目录**执行：

```bash
curl -fsSL https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/glm-v2/scripts/dist/codebuddy-loader.bundle.js | node - --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/glm-v2
```

Windows PowerShell：

```powershell
iwr https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/glm-v2/scripts/dist/codebuddy-loader.bundle.js -OutFile codebuddy-loader.bundle.js
node codebuddy-loader.bundle.js --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/glm-v2
```

**执行过程**：
1. 下载 `codebuddy-loader.bundle.js` 到内存
2. 拉取远程 `manifest.json` 获取文件清单
3. 下载规则、技能、Agent、脚本到业务项目的 `.codebuddy/` 目录
4. 生成 `.codebuddy/rules/project-rules.md` 主规则文件
5. 自动更新 `.gitignore`

### 方式二：本地克隆模式

```bash
# 1. 克隆规则库（一次性）
git clone -b feature/codebuddy-glm https://github.com/redseac31001-hub/my-fe-standards.git ~/my-fe-standards

# 2. 在业务项目根目录运行加载器
cd /path/to/your-business-project
node ~/my-fe-standards/scripts/dist/codebuddy-loader.js
```

### 方式三：内网部署模式

适用于无法访问外网的企业环境：

```bash
# 1. 将规则库部署到内网静态服务器
# 服务器需提供 manifest.json 和所有规则文件

# 2. 在业务项目中使用 --remote 指向内网地址
node codebuddy-loader.js --remote https://internal.company.com/fe-standards
```

### 加载选项

| 选项 | 说明 | 示例 |
|------|------|------|
| `--task <type>` | 按任务类型筛选规则 | `--task debugging` |
| `--rule-level <lvl>` | 规则裁剪等级 | `--rule-level quick` |
| `--enable-orchestrator` | 启用完整编排体系 | 含 Workflow/TaskBook/AgentCall |
| `--verbose` | 详细日志 | 调试问题时使用 |

---

## 3. 本仓库内的影子业务项目 Smoke

如果你在维护 `my-fe-standards` 本身，建议先不要直接拿真实业务项目做回归。

先在本仓库执行：

```bash
npm run smoke:business-remote
```

它会把 `test/fixtures/business-projects/` 下的 source fixture 复制到 `temp/business-fixtures/`，再在那个运行态目录里模拟真实业务项目的远程加载和最小闭环。

说明见：`docs/guides/local-business-fixture-smoke.md`

---

## 4. 加载后的目录结构

加载成功后，业务项目根目录会新增 `.codebuddy/` 目录：

```
your-project/
├── .codebuddy/                    # 自动生成，已加入 .gitignore
│   ├── rules/
│   │   └── project-rules.md       # ⭐ 主规则文件（AI 自动读取）
│   ├── rules_cache/               # 规则缓存（按需读取）
│   │   ├── layer2_business/       #    UI 库规范（检测到依赖时生成）
│   │   └── layer3_action/         #    任务检查清单
│   │       ├── refactoring.md
│   │       ├── debugging.md
│   │       ├── testing.md
│   │       ├── self-verification.md
│   │       ├── defensive-coding.md
│   │       └── context-management.md
│   ├── agents/                    # Agent 定义文件
│   │   ├── bug-investigator/      #    Bug 调查 Agent
│   │   ├── build-fix/             #    构建修复 Agent
│   │   ├── code-reviewer/         #    代码审查 Agent
│   │   ├── planner/               #    任务规划 Agent
│   │   ├── task-orchestrator/     #    任务编排 Agent
│   │   ├── tdd-driver/            #    TDD 驱动 Agent
│   │   ├── security-reviewer/     #    安全审查 Agent
│   │   ├── performance-profiler/  #    性能分析 Agent
│   │   └── structure-analyzer/    #    结构分析 Agent
│   ├── skills/                    # 技能文件
│   ├── scripts/                   # 可执行脚本
│   │   ├── structure-analyzer.js  #    项目结构分析
│   │   ├── module-mapper.js       #    模块图谱分析
│   │   ├── report-manager.js      #    报告管理
│   │   └── README.md
│   └── commands/                  # Slash Commands
│       ├── task.md                #    /task 命令
│       └── agent-call.md          #    /agent-call 命令
├── .gitignore                     # 已自动追加 .codebuddy/、codebuddy-loader.bundle.js
├── package.json
└── src/
```

**关键文件说明**：

| 文件 | 作用 | AI 如何使用 |
|------|------|------------|
| `project-rules.md` | 主规则文件，包含 Layer1 规范全文 + Layer2/3 索引 + Agent/Skill 决策树 | CodeBuddy 的 `alwaysApply` 自动注入每次对话 |
| `rules_cache/*.md` | Layer2/3 规则详细内容 | AI 通过 `read_file` 按需加载 |
| `agents/*/AGENT.md` | Agent 工作流定义 | AI 匹配触发词后读取并执行 |
| `skills/*/SKILL.md` | 技能知识文档 | AI 匹配触发词后读取作为上下文 |

---

## 5. 任务执行路径选择

当前业务项目默认遵循一条基础约定：`Small-Change Direct Execution First`。

含义：

- 小范围、契约明确、低不确定性的任务，默认直接由 AI 执行
- 不默认拉起 `task-orchestrator`、workflow、agent handoff
- 已安装的 rules、skills、validators 仍可作为参考和校验层，但不应成为小任务的固定仪式

典型适用场景：

- 已提供 API 文档的 mock -> real API 替换
- 单一模块内的请求参数、返回参数适配
- 局部交互问题修复或小范围业务补丁

建议做法：

1. 先让 AI 阅读 API/需求文档和当前相关代码
2. 边界不明显时，先运行：

```bash
node .codebuddy/scripts/task-intake-router.js --description "replace mock login API with the provided contract" --files 4 --contract explicit --uncertainty low
```

3. 再给出一个极短执行计划
4. 直接修改代码并做最小验证
5. 只有在复杂度上升后，才升级到编排路径

升级到编排路径的信号：

- 跨多个页面、store、service 或业务域
- 接口契约不完整或存在明显歧义
- 需要阶段性交接、并行协作或持久 task tracking
- 涉及状态流、路由、权限、缓存、错误恢复等重设计

直执行任务的推荐最小验证：

```bash
npm run build
npm test
```

然后补一条最窄的业务验证，例如：

- 单页面 smoke
- 单模块请求链路验证
- 一条本地 E2E case

## 6. 预期完成目标

### 6.1 加载完成标准

| 检查项 | 预期结果 | 验证方法 |
|--------|---------|---------|
| 主规则文件生成 | `.codebuddy/rules/project-rules.md` 存在且非空 | `ls -la .codebuddy/rules/project-rules.md` |
| Layer1 规范嵌入 | project-rules.md 包含 clean-code、architecture、strict-types 内容 | 搜索 `Layer 1: 基础规范` |
| Layer3 索引完整 | 索引表包含 6 项规则（含 context-management） | 搜索 `规则参考索引` |
| Agent 系统加载 | 当前激活 Agent root 已写入 `install.json` 且 Agent 表可见 | `node .codebuddy/scripts/codebuddy-loader.js status --json` |
| 技能系统加载 | 当前激活技能已写入 `install.json` 且 rules 中技能表可见 | `node .codebuddy/scripts/codebuddy-loader.js status --json` |
| 脚本分发完成 | scripts/ 下有 5 个核心脚本 | `ls .codebuddy/scripts/*.js` |
| .gitignore 更新 | 包含 `.codebuddy/`、`codebuddy-loader.bundle.js` 条目 | `grep codebuddy .gitignore` |
| Vue 版本检测 | 正确识别 Vue 2/3（如适用） | 查看加载日志 |

### 6.2 AI 行为预期

加载规则后，AI 助手的行为应满足：

**代码质量**：
- 遵循整洁代码原则（命名规范、函数不超过 50 行、SOLID 原则）
- TypeScript 严格模式（禁止 `any`、必须声明返回类型）
- 功能目录结构（按 feature 而非 type 组织代码）

**任务调度**：
- 输入 "修复bug" / "排查问题" → 触发 `bug-investigator` Agent
- 输入 "帮我实现功能" → 触发 `task-orchestrator` Agent
- 输入 "帮我规划" / "方案对比" → 触发 `planner` Agent
- 输入 "代码审查" → 触发 `code-reviewer` Agent
- 输入 "构建失败" → 触发 `build-fix` Agent

**上下文管理**：
- 关联文件 ≤ 5 个时全量读取
- 关联文件 > 15 个时自动裁剪，只读核心文件
- 调试场景按数据层→业务层→视图层分层验证

### 6.3 技术栈覆盖

| 技术栈 | 规则覆盖 | 触发条件 |
|--------|---------|---------|
| Vue 3 | Layer1 vue3 规范 + Composition API 最佳实践 | package.json 中 vue@^3 |
| Vue 2 | Layer1 vue2 规范（Options API / Composition API） | package.json 中 vue@^2 |
| TypeScript | Layer1 strict-types 规范 | 始终加载 |
| Ant Design Vue | Layer2 antdv 规范 | package.json 中 ant-design-vue |
| Vant | Layer2 vant 规范 | package.json 中 vant |
| Backend Service | Layer2 backend-service 规范 | 命中 `kind:backend` |
| Node Backend | Layer2 node-backend 规范 | 命中 `stack:nestjs/express/fastify/koa/hono` |
| Java Backend | Layer2 java-backend 规范 | 命中 `stack:springboot/quarkus/micronaut/jakartarest` |
| Rust Backend | Layer2 rust-backend 规范 | 命中 `stack:axum/actixweb/rocket/tonic` |

---

## 7. 检测验证标准

### 7.1 加载验证（自动化检查脚本）

在业务项目根目录执行以下命令逐项验证：

```bash
# ✅ 检查 1: 主规则文件存在
test -f .codebuddy/rules/project-rules.md && echo "PASS: 主规则文件存在" || echo "FAIL: 主规则文件不存在"

# ✅ 检查 2: Agent 数量（期望 9 个）
node .codebuddy/scripts/codebuddy-loader.js status --json

# ✅ 检查 3: 核心脚本存在
for script in structure-analyzer.js module-mapper.js report-manager.js; do
  test -f ".codebuddy/scripts/$script" && echo "PASS: $script" || echo "FAIL: $script 缺失"
done

# ✅ 检查 4: Layer3 规则缓存完整（期望 6 个）
L3_COUNT=$(ls .codebuddy/rules_cache/layer3_action/*.md 2>/dev/null | wc -l)
echo "Layer3 规则: $L3_COUNT (期望 6)"

# ✅ 检查 5: bug-investigator Agent 存在
node .codebuddy/scripts/agent-registry.js show bug-investigator --json && echo "PASS: bug-investigator 已安装" || echo "FAIL: bug-investigator 缺失"

# ✅ 检查 6: context-management 规则存在
test -f .codebuddy/rules_cache/layer3_action/context-management.md && echo "PASS: context-management 已安装" || echo "FAIL: context-management 缺失"
```

### 7.2 规则有效性验证

```bash
# 使用内置校验器检查规则完整性
node .codebuddy/scripts/rule-validator.js check

# 使用内置校验器检查技能完整性
node .codebuddy/scripts/skill-validator.js check
```

### 7.3 项目分析验证

```bash
# 运行项目结构分析（验证脚本可执行）
node .codebuddy/scripts/structure-analyzer.js .

# 运行模块图谱分析
node .codebuddy/scripts/module-mapper.js .

# 查看分析报告状态
node .codebuddy/scripts/report-manager.js status
```

### 7.4 AI 行为验证清单

在 CodeBuddy 中逐项测试以下场景：

| 测试输入 | 预期 Agent | 验证方法 |
|----------|-----------|---------|
| "页面报错白屏" | bug-investigator | AI 应读取 `bug-investigator/AGENT.md` 并执行 4 阶段流程 |
| "帮我实现用户登录功能" | task-orchestrator | AI 应读取 `task-orchestrator/AGENT.md` 并展示任务计划书 |
| "帮我规划这个功能怎么做" | planner | AI 应读取 `planner/AGENT.md` 并输出规划方案（不编码） |
| "构建失败了" | build-fix | AI 应读取 `build-fix/AGENT.md` 并按 P0→P4 修复 |
| "审查这段代码" | code-reviewer | AI 应读取 `code-reviewer/AGENT.md` 并输出审查报告 |
| "重构这个组件" | 加载 skill | AI 应读取 `skills/component-refactoring/SKILL.md` |

---

## 8. 常见问题与排查

### Q1: 远程加载失败，提示网络超时

**原因**：无法访问 GitHub Raw。

**解决**：
```bash
# 方案 A: 增加超时时间
curl ... | node - --remote <URL> --timeout 30000

# 方案 B: 使用代理
export https_proxy=http://proxy:port
curl ... | node - --remote <URL>

# 方案 C: 切换到本地模式
git clone ... && node /path/to/codebuddy-loader.js
```

### Q2: 加载后 project-rules.md 为空或内容不完整

**排查**：
```bash
# 1. 加详细日志重新运行
node codebuddy-loader.js --verbose

# 2. 检查 config/loader-config.json 配置是否正确
# 3. 确认 rules/ 目录下的 .md 文件存在
```

### Q3: AI 没有按预期触发 Agent

**原因**：`project-rules.md` 未被 AI 工具正确加载。

**排查**：
- **CodeBuddy**：确认 `.codebuddy/rules/project-rules.md` 的 frontmatter 中 `alwaysApply: true`
- **Claude Code**：需要将规则文件路径添加到 `.claude/settings.json` 或复制内容到 `CLAUDE.md`
- **Amp**：按 Amp 的 Rules 配置方式引用

### Q4: Vue 版本未被检测到

**原因**：`package.json` 中 Vue 版本格式不标准。

**排查**：
```bash
# 确认 package.json 中的 Vue 版本
cat package.json | grep vue

# 支持的格式: "^3.x", "~3.x", "3.x", "^2.x", "~2.x", "2.x"
```

### Q5: Layer2 业务规范未加载

**原因**：未检测到对应的 npm 依赖。

**排查**：
```bash
# 确认 package.json 中包含 UI 库依赖
# ant-design-vue → 加载 antdv 规范
# vant → 加载 vant 规范
# backend stack selector → 加载 backend-service / 对应语言规则
cat package.json | grep -E "ant-design-vue|vant"
```

### Q6: Windows 环境下路径问题

**解决**：
```bash
# 使用 PowerShell 或 Git Bash 执行
# 确保 Node.js 在 PATH 中
node --version
```

Windows PowerShell 下不要使用 `irm ... | node -` 直接把远程脚本文本通过管道送给 Node。
推荐统一采用“先下载到文件，再执行”的方式，避免脚本文本在 PowerShell 到原生命令之间发生转码。

### Q7: 重复运行加载器会覆盖已有配置吗

**是**。每次运行加载器会完全重新生成 `.codebuddy/` 目录内容。这是设计行为，确保规则总是最新版本。业务项目的源码不受影响。

---

## 9. 进阶用法

### 7.1 按任务类型筛选

只加载与特定任务相关的规则，减少上下文消耗：

```bash
# 只加载调试相关规则
node codebuddy-loader.js --task debugging

# 只加载重构相关规则
node codebuddy-loader.js --task refactoring

# 可用类型: refactoring | debugging | testing | new-feature | code-review
```

### 7.2 规则裁剪等级

控制 Layer1 规则的详细程度：

```bash
# summary - 仅摘要（最小上下文）
node codebuddy-loader.js --rule-level summary

# quick - 摘要 + 快速参考
node codebuddy-loader.js --rule-level quick

# full - 完整内容（默认）
node codebuddy-loader.js --rule-level full
```

### 7.3 启用完整编排体系

适合需要端到端任务管理的团队：

```bash
node codebuddy-loader.js --enable-orchestrator
```

额外分发：
- Workflow Spec（`default.workflow.json` + Schema）
- TaskBook 契约（Schema + active/history 目录）
- Agent Call 协议（Schema + 管理脚本）
- 编排脚本（task-orchestrator.js、task-executor.js 等）

### 7.4 项目记忆系统

分析结果自动持久化，支持跨会话复用：

```bash
# 结构分析 → 生成 .codebuddy/reports/architecture/latest.json
node .codebuddy/scripts/structure-analyzer.js .

# 模块图谱 → 生成 .codebuddy/reports/modules/latest.json
node .codebuddy/scripts/module-mapper.js .

# 查看健康度趋势
node .codebuddy/scripts/report-manager.js trend

# 对比两次分析的差异
node .codebuddy/scripts/report-manager.js diff
```

报告有效期 24 小时，AI 可直接读取 JSON 文件而无需重新分析。

### 7.5 与 Claude Code 集成

Claude Code 使用 `.claude/` 目录作为规则源，需要额外配置：

```bash
# 方案 A: 在 .claude/CLAUDE.md 中引用
echo "请读取 .codebuddy/rules/project-rules.md 作为项目规范。" >> .claude/CLAUDE.md

# 方案 B: 直接复制规则内容
cp .codebuddy/rules/project-rules.md .claude/rules/fe-standards.md
```

---

## 附录：版本与兼容性

| 组件 | 当前版本 | 说明 |
|------|---------|------|
| 规则库 | 3.3.0 | 三层架构 + 技能系统 + Agent 系统 + 私有化发布能力 |
| 加载器 | 3.3.0 | 支持本地/远程、profile、规则裁剪、content pack、pack-only |
| Agent 数量 | 9 | 含 bug-investigator（新增） |
| Skill 数量 | 12 | 前端开发专业技能库 |
| Layer3 规则 | 6 | 含 context-management（新增） |
| 适用 AI 工具 | CodeBuddy / Claude Code / Amp | 多工具支持 |
