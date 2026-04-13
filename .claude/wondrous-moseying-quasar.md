# 演示优化分支方案：CodeBuddy GLM-4.7 弱模型适配

## Context

当前 my-fe-standards 项目 v3.3.0 的 `project-rules.md` 输出体积约 **55 KB / 1711 行**，包含大量冗余的路由表、激活规则和契约说明。GLM-4.7 作为弱模型，上下文窗口小、指令遵循能力弱，导致实际使用时存在：
- 路由误判（Agent/Skill 选项过多，弱模型无法准确匹配）
- Token 浪费（大量全文内联规则占据有限窗口）
- 交互体验差（无欢迎引导，进度展示不直观）

需要新开分支，做一版**面向公司内部演示**的优化版本，展示项目接入真实业务项目后的智能编码效果。

---

## 方案概览

### 分支策略

- **基准分支**：`glm-v2`（当前活跃开发分支，已有所有最新功能）
- **新分支名**：`demo/glm-optimize`

### 预期效果

| 指标 | 当前（full） | 目标（demo） |
|------|-------------|-------------|
| project-rules.md 体积 | ~55 KB / 1711 行 | ~18-22 KB / ~600 行 |
| 预估 token | ~15,900 | ~5,500-6,300 |
| Agent/Skill 路由 | 3 个独立段落 | 1 个统一扁平表 |
| 激活规则格式 | WHEN/THEN/NEVER（9 组） | 扁平关键词→文件映射 |
| 编排契约段落 | 4 个详细段 | 1 个紧凑汇总 |
| 欢迎/引导 | 无 | 技术栈识别 Banner + 快速上手 |
| 规则内联内容 | full（~1180 行） | quick（~225 行） |

Token 消耗预计减少 **60-65%**。

---

## 实现步骤

### Phase 1：核心基础设施

#### 1.1 类型定义扩展
**文件**：`scripts/src/types/index.ts:279`

- `InstallProfile` 类型增加 `'demo'` 值

#### 1.2 分发档位映射
**文件**：`scripts/src/lib/distribution-profiles.ts`

- `getScriptsForProfile()` 为 `demo` profile 仅分发 `CORE_SCRIPTS` + `structure-analyzer.js`（不含完整 ANALYSIS_SCRIPTS 和 ORCHESTRATOR_SCRIPTS）
- `isOrchestratorProfile()` 对 `demo` 返回 `false`

#### 1.3 Loader 主流程适配
**文件**：`scripts/src/codebuddy-loader.ts`

- `INSTALL_PROFILES` 数组（行 127）增加 `'demo'`
- `parseContextArgs()`（行 825）：当 `profile === 'demo'` 且未显式指定 `--rule-level` 时，默认 `ruleLevel = 'quick'`
- 主函数中：`demo` profile 默认 `enableOrchestrator = false`，跳过 Workflows/TaskBooks/AgentCalls 分发
- Agent/Skill 加载后增加上限裁剪：demo 模式下最多保留 6 个 Agent + 8 个 Skill（按技术栈匹配度排序）

---

### Phase 2：Prompt 重写（核心改动）

**文件**：`scripts/src/lib/prompt-builder.ts`

#### 2.1 新增：统一路由表 `generateUnifiedRoutingPrompt()`

**替代现有三个独立段落**：
- `generateAgentsPrompt()`（行 986-1041，按场景分组的 Agent 表 + 详细子表）
- `generateSkillsPrompt()`（行 1044-1088，按场景分组的 Skill 表 + 详细子表）
- `generateActivationRules()`（行 1090-1146，9 组 WHEN/THEN/NEVER 块）

**新格式**：一个扁平的关键词→文件映射表

```markdown
# 能力路由表

用户请求 → 匹配关键词 → 读取对应文件 → 按文件中步骤执行

| 关键词 | 读取文件 |
|--------|----------|
| 代码审查, code review, CR | .codebuddy/agents/code-reviewer/AGENT.md |
| 修复bug, 报错, 白屏, 排查 | .codebuddy/agents/bug-investigator/AGENT.md |
| 构建失败, 编译错误, 类型错误 | .codebuddy/agents/build-fix/AGENT.md |
| 重构组件, 拆分组件 | .codebuddy/skills/component-refactoring/SKILL.md |
| ... | ... |

规则：命中关键词后必须先读取对应文件，不得跳过。
```

约 50-60 行取代现有 300+ 行。

#### 2.2 新增：欢迎 Banner `generateDemoWelcomeBanner()`

在 project-rules.md 头部生成技术栈识别结果和快速上手指引：

```markdown
# CodeBuddy 前端架构助手

已识别技术栈: Vue 3 + TypeScript + Ant Design Vue
已加载: 4 条核心规范 | 6 个 Agent | 8 个 Skill

快速上手:
- 输入 `/task 实现用户登录` 启动任务编排
- 输入 "审查这段代码" 触发代码审查
- 输入 "分析项目结构" 执行架构分析
```

#### 2.3 精简：快速行动指引

`generateQuickActionGuide()` 在 demo 模式下仅保留 4 个核心场景（现有 7 个）。

#### 2.4 精简：契约段落汇总

demo 模式下将 Scripts/Workflows/TaskBooks/Commands 4 个详细段落合并为一个紧凑汇总表（约 10 行取代 100+ 行）。

#### 2.5 移除：规则激活指南

demo 模式下跳过 `generateRuleActivationPrompt()`，因为统一路由表已覆盖其功能。

#### 2.6 所有 prompt 生成函数增加 `demoMode` 参数

通过参数控制输出详略度，不影响现有 profile 的行为。

---

### Phase 3：测试与验证

#### 3.1 现有测试适配
**文件**：`test/lib-baseline.test.mjs`

- 为 `demo` profile 增加基线测试用例

#### 3.2 输出体积回归测试

- 断言 demo profile 输出 < 30 KB
- 断言包含统一路由表
- 断言不包含 WHEN/THEN/NEVER 块

#### 3.3 构建验证

```bash
npm run build
npm run test:lib
```

---

## 关键文件变更清单

| 优先级 | 文件 | 变更类型 | 说明 |
|--------|------|----------|------|
| P0 | `scripts/src/types/index.ts` | 修改 | InstallProfile 增加 `'demo'` |
| P0 | `scripts/src/codebuddy-loader.ts` | 修改 | demo profile 处理逻辑（rule-level 默认、编排跳过、Agent/Skill 上限裁剪） |
| P0 | `scripts/src/lib/prompt-builder.ts` | 修改 | 新增统一路由表、欢迎 Banner、demoMode 分支 |
| P1 | `scripts/src/lib/distribution-profiles.ts` | 修改 | demo profile 的脚本分发映射 |
| P1 | `config/loader-config.json` | 修改 | demo 相关默认配置 |
| P2 | `test/lib-baseline.test.mjs` | 修改 | demo profile 测试用例 |

**不需要改动**：
- 规则文件（`rules/*.md`）— 已有 `@level:summary/quick/full` 标记，`filterRuleByLevel()` 已完整支持
- 内容包生成逻辑 — demo profile 不需要独立内容包

---

## 验证方案

### 自动化验证
```bash
# 构建
npm run build

# 基线测试
npm run test:lib

# 对目标项目运行 demo profile
cd <业务项目路径>
node <loader路径>/codebuddy-loader.bundle.js --profile demo -v
```

### 手动验证（4 个演示场景）

1. **智能技术栈识别**：运行 loader，检查控制台输出和欢迎 Banner 中的技术栈信息
2. **规范化编码辅助**：在 CodeBuddy 中要求写组件，验证是否遵循 TypeScript/Vue 规范
3. **任务编排闭环**：输入 `/task 实现用户搜索`，验证任务分解和执行流程
4. **Agent 自动执行**：输入 "审查代码"，验证 code-reviewer Agent 正确激活

### 关键指标
- project-rules.md 体积 < 25 KB
- 统一路由表条目数 = 已加载 Agent 数 + 已加载 Skill 数
- 无 WHEN/THEN/NEVER 格式的激活规则
- 欢迎 Banner 正确显示检测到的技术栈
