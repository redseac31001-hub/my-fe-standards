# 分析报告：GLM-4.7 模型不使用已安装的 Skill/Agent 的根因与解决方案

## Context

**问题描述**：my-fe-standards 项目通过 codebuddy-loader 安装到业务项目后，`.codebuddy/` 目录下已包含完整的 skill-snapshots/ 和 agent-snapshots/，但 GLM-4.7 模型在实际对话中"判断无需使用"，完全不调用这些能力。

**问题本质**：这既不是纯粹的模型能力问题，也不是纯粹的系统设计问题，而是**两者叠加**。

---

## 一、根因分析：系统设计缺陷 70% + 模型能力 30%

### 1.1 系统设计缺陷（占 70%）— 这是主因

#### 缺陷 A：Skill/Agent 内容未注入模型上下文

这是**最关键的问题**。项目当前的注入机制：

| 内容类型 | 注入方式 | 模型是否可见 |
|---------|---------|------------|
| 三层规则 (rules/) | ✅ 合并为 `project-rules.md`，直接进入模型 context | ✅ **可见** |
| Skill (custom-skills/) | ❌ 仅复制文件到 `.codebuddy/skill-snapshots/` | ❌ **不可见**（除非模型主动读文件） |
| Agent (agents/) | ❌ 仅复制文件到 `.codebuddy/agent-snapshots/` | ❌ **不可见**（除非模型主动读文件） |

**核心矛盾**：模型只能看到 `project-rules.md` 中的内容。Skill/Agent 的定义、触发条件、工作流程全部停留在文件系统中，模型**根本不知道它们的存在和用途**。

#### 缺陷 B：缺少"激活桥梁"

项目有完整的生命周期设计，但中间缺少关键环节：

```
✅ 定义层：AGENT.md / SKILL.md 完整定义（含 triggers、workflows）
✅ 分发层：codebuddy-loader 完美安装到 .codebuddy/
❌ 激活层：【缺失】没有 trigger 匹配器、没有自动注入机制
✅ 执行层：task-executor + agent-runtime（但需要显式调用才能触发）
```

#### 缺陷 C���被动式设计 vs 模型实际行为

当前设计假设模型会"主动发现和使用"文件系统中的 Skill/Agent，但实际上：
- 模型只处理已加载到上下文中的内容
- 模型不会主动遍历目录去发现可用能力
- 即使 `project-rules.md` 中有"请查阅 .codebuddy/skills/"的提示，模型也倾向于忽略

### 1.2 模型能力因素（占 30%）— 放大了问题

| 能力维度 | Claude（对比） | GLM-4.7 |
|---------|--------------|---------|
| 指令遵循 | 强：复杂嵌套指令也能执行 | 中：长指令容易遗漏 |
| 工具/Skill 原生支持 | ✅ Claude Code 有原生 Skill 系统 | ❌ 无原生支持，完全依赖 prompt |
| 上下文利用 | 强：会主动关联上下文中的能力声明 | 弱：倾向于用自身知识回答 |
| 长文本注意力 | 较均匀 | 首尾效应明显，中间内容易被忽略 |

**结论**：即使系统设计完美，GLM-4.7 的指令遵循能力也会导致部分 Skill/Agent 不被使用。但当前的主要问题是**系统根本没有把信息送到模型面前**。

---

## 二、解决方案：混合三层递进方案

### 方案总览

```
┌─────────────────────────────────────────────────────────┐
│  第一层：静态摘要注入（解决"模型不知道"的问题）           │
│  将 Skill/Agent 的核心摘要内联到 project-rules.md        │
│  → 模型在任何对话中都能看到可用能力清单                   │
├─────────────────────────────────────────────────────────┤
│  第二层：强制 When-Then 指令（解决"模型不执行"的问题）     │
│  用 "当...时，必须..." 格式写死触发条件                    │
│  → 模型匹配到条件时被强制要求执行                         │
├─────────────────────────────────────────────────────────┤
│  第三层：编排时深度注入（解决"信息不够"的问题）            │
│  task-executor 执行时通过 trigger 匹配注入完整 Skill 内容  │
│  → 精确任务场景下获得完整知识                              │
└─────────────────────────────────────────────────────────┘
```

### 2.1 第一层：静态摘要注入（最高优先级）

**目标**：让模型在 project-rules.md 中就能看到所有可用 Skill/Agent 的概览。

**实现方式**：在 `codebuddy-loader.ts` 生成 `project-rules.md` 时，追加一个"可用能力清单"章节。

**生成内容示例**：

```markdown
## 可用技能清单（Skills）

以下技能已安装，当用户请求匹配时**必须**激活对应技能：

| 技能 | 触发条件 | 用途 |
|------|---------|------|
| frontend-code-review | 用户要求"代码审查"、"review" | 前端代码质量审查，含检查清单 |
| frontend-testing | 用户要求"写测试"、"测试覆盖" | 前端测试策略和实施 |
| performance-optimization | 用户提到"性能"、"优化"、"卡顿" | 性能诊断和优化方案 |
| component-refactoring | 用户要求"重构"、"拆分组件" | 组件级重构工作流 |
| ... | ... | ... |

⚠️ 当用户请求匹配上述触发条件时，你**必须**：
1. 读取对应技能文件：`.codebuddy/skill-snapshots/<最新快照>/<技能名>/SKILL.md`
2. 按照技能中定义的工作流程执行
3. **禁止**跳过已安装技能而使用自身通用知识替代

## 可用代理清单（Agents）

| 代理 | 触发条件 | 职责 |
|------|---------|------|
| code-reviewer | "代码审查"、"CR" | 按 clean-code 规则结构化审查 |
| bug-investigator | "修复bug"、"排查问题" | Bug 根因分析 |
| planner | "规划"、"任务分解" | 复杂任务分解和风险评估 |
| ... | ... | ... |
```

**关键文件**：
- `scripts/src/codebuddy-loader.ts` — 修改 `buildProjectRules()` 或等效函数，追加摘要章节
- `scripts/src/generate-manifest.ts` — 可能需要在 manifest 中预生成摘要数据

### 2.2 第二层：强制 When-Then 指令

**目标**：用模型难以忽略的指令格式，强制触发 Skill/Agent。

**实现方式**：在生成的 `project-rules.md` 中注入条件指令块。

**指令格式**：

```markdown
## 强制执行规则（MANDATORY）

### 触发规则 1：代码审查
- **WHEN**：用户请求中包含"审查"、"review"、"代码质量"、"CR"
- **THEN**：必须执行以下步骤
  1. 读取 `.codebuddy/skill-snapshots/*/frontend-code-review/SKILL.md`
  2. 读取 `.codebuddy/skill-snapshots/*/frontend-code-review/references/` 下的检查清单
  3. 严格按照 SKILL.md 中定义的审查流程执行
- **NEVER**：不得跳过此技能，不得用通用知识替代

### 触发规则 2：Bug 修复
- **WHEN**：用户请求中包含"bug"、"修复"、"报错"、"异常"
- **THEN**：必须激活 bug-investigator Agent
  1. 读取 `.codebuddy/agent-snapshots/*/bug-investigator/AGENT.md`
  2. 按照 Agent 定义的根因分析流程执行
- **NEVER**：不得直接猜测原因，必须先按流程排查
```

**关键文件**：
- `scripts/src/codebuddy-loader.ts` — 从 AGENT.md/SKILL.md 的 frontmatter 提取 triggers，生成 When-Then 块

### 2.3 第三层：编排时深度注入（中优先级）

**目标**：在 task-executor 编排任务时，自动匹配和注入完整 Skill/Agent 内容。

**实现方式**：新增 `trigger-matcher.ts` 模块。

**核心逻辑**：
```
用户输入 → trigger-matcher 扫描所有 AGENT.md/SKILL.md 的 triggers
         → 匹配成功 → 读取完整内容 → 注入到 task-executor 的 prompt 中
         → 匹配失败 → 走常规流程
```

**关键文件**：
- 新建 `scripts/src/lib/trigger-matcher.ts` — trigger 匹配逻辑
- `scripts/src/task-executor.ts` — 集成 trigger-matcher，在任务执行前注入匹配内容
- `scripts/src/agent-runtime.ts` — 可能需要暴露 trigger 读取接口

---

## 三、实施计划

### 阶段 1：静态摘要注入（2-3 天，最高优先级）

**改动范围**：
1. **`scripts/src/codebuddy-loader.ts`**
   - 在生成 `project-rules.md` 的流程中，追加"可用能力清单"和"强制 When-Then 指令"章节
   - 从已安装的 skill-snapshots/ 和 agent-snapshots/ 中提取 frontmatter 元数据
   - 生成摘要表格 + 触发指令块

2. **`scripts/src/lib/`** （可能新增）
   - `skill-summarizer.ts` — 提取 Skill/Agent 的 frontmatter 并生成摘要
   - 复用现有 `agent-runtime.ts` 中的 frontmatter 解析逻辑

**验收标准**：
- 运行 codebuddy-loader 后，生成的 `project-rules.md` 末尾包含完整的能力清单和 When-Then 指令
- GLM-4.7 在对话中提到"代码审查"时，能主动读取对应 Skill 文件

### 阶段 2：优化指令格式（1-2 天）

**改动范围**：
- 针对 GLM-4.7 的指令遵循特点，优化 When-Then 指令的措辞
- 添加"反面示例"（❌ 不要这样做）增强约束力
- 测试不同措辞在 GLM-4.7 上的激活率

### 阶段 3：Trigger Matcher 集成（3-5 天，中优先级）

**改动范围**：
1. 新建 `scripts/src/lib/trigger-matcher.ts`
2. 修改 `scripts/src/task-executor.ts` 集成 trigger 匹配
3. 更新 `scripts/dist/` 编译产物

---

## 四、验证方案

### 测试场景

| # | 用户输入 | 预期行为 | 验证方式 |
|---|---------|---------|---------|
| 1 | "帮我审查这个组件的代码" | 模型读取 frontend-code-review SKILL.md 并按流程执行 | 观察模型是否引用了 Skill 中的检查清单 |
| 2 | "这个页面好卡，帮我优化" | 模型激活 performance-optimization Skill | 观察模型是否按 Skill 定义的诊断步骤���行 |
| 3 | "修复登录页 401 报错" | 模型激活 bug-investigator Agent | 观察模型是否按 Agent 的根因分析流程排查 |
| 4 | "帮我写个工具函数" | 模型**不应**激活任何 Skill/Agent（无匹配） | 观察模型正常编码，不做额外操作 |

### 验证步骤
1. 在测试项目中运行 `node scripts/dist/codebuddy-loader.js --profile full`
2. 检查生成的 `.codebuddy/rules/project-rules.md` 是否包含能力清单和 When-Then 指令
3. 在 CodeBuddy 中进行上述 4 个测试场景的对话
4. 记录模型是否正确激活了对应的 Skill/Agent

---

## 五、关键结论

1. **这不主要是模型能力问题**。系统设计缺陷（70%）是主因——Skill/Agent 的内容根本没有进入模型的上下文窗口，模型"不知道"而非"不愿意"。

2. **修复方向明确**：将 Skill/Agent 的摘要和强制触发指令注入到 `project-rules.md` 中，让模型在上下文中就能看到。

3. **不需要重构架构**：保持现有的"知识-分发-执行"三层分离，只需在 Delivery Plane 输出时追加摘要注入环节。

4. **模型差异需要适配**：不同模型（GLM-4.7 vs Claude vs GPT）对指令的遵循程度不同，When-Then 指令的措辞需要针对性优化。
