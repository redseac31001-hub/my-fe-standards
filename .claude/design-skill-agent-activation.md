# 详细设计：Skill/Agent 激活桥梁 — 静态摘要注入 + 强制 When-Then 指令 + Trigger Matcher

> **版本**: 1.0.0
> **生成时间**: 2026-04-07
> **状态**: ✅ 已完成（v1.1.0 修订后由 Codex 实施，审查通过 92/100）
> **适用范围**: scripts/src/ 下的 TypeScript 源码
> **审查报告**: `.claude/verification-report.md`
> **修订记录**: `.claude/design-review-response.md`（v1.1.0 修订，采纳 Codex 6 条审查意见）

---

## 一、问题回顾与设计目标

### 1.1 问题本质

当前 `codebuddy-loader.ts` 生成 `project-rules.md` 时，Skill/Agent 的信息已通过 `generateSkillsPrompt()` 和 `generateAgentsPrompt()` 注入了**索引表**。但索引表的设计是**被动路由式**的——它告诉模型"按场景分类找 Agent/Skill"，假设模型会主动关联用户请求和能力清单。

**实际表现**：GLM-4.7 面对索引表时，倾向于用自身通用知识回答，而不是按索引去读取对应 SKILL.md/AGENT.md。

**根因**：缺少从"用户输入关键词"到"强制读取并执行 Skill/Agent"的**显式绑定**。

### 1.2 设计目标

| 目标 | 衡量标准 |
|------|---------|
| **模型可见性** | `project-rules.md` 中包含每个 Skill/Agent 的触发关键词和强制执行指令 |
| **强制性** | 使用 WHEN-THEN-NEVER 格式，模型匹配到关键词时被**命令式要求**读取对应文件 |
| **零架构破坏** | 不修改现有 `generateSkillsPrompt` / `generateAgentsPrompt` 的签名和输出 |
| **运行时匹配** | task-executor 在编排任务时可自动匹配 trigger 并注入完整 Skill/Agent 内容 |
| **可维护性** | 摘要和指令从 SKILL.md/AGENT.md 的 frontmatter 自动提取，无需手动维护 |

---

## 二、整体架构：三层递进方案

```
project-rules.md 文件内容结构（生成顺序）：

  ┌─ Frontmatter (YAML) ──────────────────────────────┐
  ├─ Layer 1: 基础规范（完整内容）                      │
  ├─ 规则参考索引（Layer 2/3 索引表）                   │
  ├─ Workspace 提示词（多项目路由）                     │
  ├─ 规则激活指南 + 快速行动指引                        │
  ├─ Skill 路由表 ← generateSkillsPrompt() [现有]      │
  ├─ Agent 路由表 ← generateAgentsPrompt() [现有]      │
  │                                                     │
  │  ╔══════════════════════════════════════════════╗    │
  │  ║ 🆕 第一层：静态能力摘要                      ║    │ ← NEW
  │  ║    generateCapabilityCatalog()               ║    │
  │  ╠══════════════════════════════════════════════╣    │
  │  ║ 🆕 第二层：强制 When-Then 指令               ║    │ ← NEW
  │  ║    generateActivationRules()                 ║    │
  │  ╚══════════════════════════════════════════════╝    │
  │                                                     │
  ├─ 脚本索引 ← generateScriptsPrompt()                │
  ├─ Workflows / TaskBooks / Agent Calls                │
  ├─ Slash Commands                                     │
  └─────────────────────────────────────────────────────┘

  ┌─ 第三层：运行时 Trigger Matcher ───────────────────┐
  │  scripts/src/lib/trigger-matcher.ts [新文件]        │ ← NEW
  │  被 task-executor.ts 调用，编排时按需注入            │
  └─────────────────────────────────────────────────────┘
```

### 2.1 各层职责边界

| 层级 | 职责 | 触发时机 | 产出位置 |
|------|------|---------|---------|
| 第一层：静态摘要 | 让模型知道"有哪些能力可用" | `codebuddy-loader` 构建时 | `project-rules.md` 内联 |
| 第二层：When-Then 指令 | 让模型在匹配关键词时**被强制要求**执行 | `codebuddy-loader` 构建时 | `project-rules.md` 内联 |
| 第三层：Trigger Matcher | 编排任务时自动匹配并注入完整内容 | `task-executor` 运行时 | Agent Call prompt 中 |

---

## 三、第一层：静态能力摘要（`generateCapabilityCatalog`）

### 3.1 设计决策

**Q: 为什么不直接在 `generateSkillsPrompt` 里加？**

A: `generateSkillsPrompt` 的设计是**按场景分组的路由索引**，侧重"如何选择"。摘要章节侧重"有什么可用"和"什么时候必须用"，两者关注点不同。分离为独立函数可以：
1. 独立控制输出位置（放在路由表之后、脚本索引之前）
2. 独立控制输出格式（紧凑的 trigger 关键词表 vs 分组路由表）
3. 不影响现有路由表的 token 预算

**Q: ��什么同时生成 Skill 和 Agent 的摘要？**

A: 因为摘要表的核心目的是让模型在**一个位置**看到所有可用能力的触发关键词，形成统一的"能力目录"。如果分散在两个地方，模型需要跨章节关联，增加遗漏风险。

### 3.2 函数签名

**文件**：`scripts/src/lib/prompt-builder.ts`（在现有文件中新增导出函数）

```typescript
/**
 * 生成统一的能力目录，包含所有已安装 Skill 和 Agent 的触发关键词摘要。
 *
 * 设计意图：让模型在 project-rules.md 中就能看到完整的能力清单，
 * 无需遍历文件系统即可知道何时应该激活哪个 Skill/Agent。
 */
export function generateCapabilityCatalog(
  skills: SkillMetadata[],
  agents: AgentMetadata[],
  skillsRootDir: string,
  agentsRootDir: string,
): string;
```

### 3.3 输出格式规范

```markdown
# 📋 已安装能力目录（CAPABILITY CATALOG）

> ⚠️ **强制规则**：当用户请求匹配下表任一触发条件时，**必须**读取对应文件并按其工作流程执行。
> **禁止**跳过已安装能力而使用通用知识替代。

## 技能清单（Skills）

| 技能 ID | 名称 | 触发关键词 | 文件路径 |
|---------|------|-----------|---------|
| `frontend-code-review` | 前端代码审查 | `审查代码`, `代码质量`, `code review` | `.codebuddy/skill-snapshots/<id>/frontend-code-review/SKILL.md` |
| `performance-optimization` | 性能优化 | `性能优化`, `懒加载`, `虚拟滚动`, `首屏` | `.codebuddy/skill-snapshots/<id>/performance-optimization/SKILL.md` |
| ... | ... | ... | ... |

## 代理清单（Agents）

| 代理 ID | 名称 | 触发关键词 | 文件路径 |
|---------|------|-----------|---------|
| `code-reviewer` | 代码审查器 | `代码审查`, `code review`, `CR` | `.codebuddy/agent-snapshots/<id>/code-reviewer/AGENT.md` |
| `bug-investigator` | Bug 调查器 | `修复bug`, `debug`, `排查问题`, `报错` | `.codebuddy/agent-snapshots/<id>/bug-investigator/AGENT.md` |
| ... | ... | ... | ... |
```

### 3.4 实现细节

**Skill 触发词提取逻辑**：

Skill 的 `triggers` 字段格式为 `["审查代码/代码质量/code review"]`，使用 `/` 分隔同义词。需要：
1. 按 `/` 拆分每个 trigger 条目
2. 展平为独立关键词列表
3. 格式化为反引号包裹的内联代码

```typescript
// 示例：将 ["审查代码/代码质量/code review"] 转换为 "`审查代码`, `代码质量`, `code review`"
function flattenSkillTriggers(triggers: string[]): string[] {
  return triggers.flatMap(t => t.split('/').map(s => s.trim()).filter(Boolean));
}
```

**Agent 触发词提取逻辑**：

Agent 的 `triggers` 字段格式为 `["代码审查", "code review", "CR"]`，已经是独立关键词。直接使用。

**路径构建逻辑**：

使用 `skillsRootDir` 和 `agentsRootDir` 参数（如 `.codebuddy/skill-snapshots/20260407-100000`）拼接完整路径。

### 3.5 依据：现有代码模式

参照 `generateRuleActivationPrompt()` （prompt-builder.ts:908-926）的表格生成模式，以及 `buildSkillHint()` / `summarizeRouteTriggers()` 的辅助函数风格。

---

## 四、第二层：强制 When-Then 指令（`generateActivationRules`）

### 4.1 设计决策

**Q: 为什么选择 WHEN-THEN-NEVER 格式而不是普通表格？**

A: 研究表明，命令式指令（"当 X 时，你**必须**做 Y"）比描述式指令（"X 可以用 Y"）在 LLM 上的遵循率显著更高。特别对 GLM-4.7 这类指令遵循能力中等的模型，强约束格式是必要的。

**Q: 为什么要同时列出 NEVER 条款？**

A: "反面示例"是增强指令约束力的已知有效手段。告诉模型"不要做什么"和"要做什么"同样重要。

**Q: 每个 Skill/Agent 都生成一条 WHEN-THEN 还是分组？**

A: **分组生成**。按 Agent 路由分类（orchestration/diagnosis/review/documentation）和 Skill 路由分类（architecture/implementation/quality/performance/documentation/workflow）分组，每组一条规则。原因：
1. 减少 token 消耗
2. 同组的 Skill/Agent 触发条件有重叠，分组可以合并关键词
3. 避免 project-rules.md 过长导致模型"中间注意力衰减"

### 4.2 函数签名

**文件**：`scripts/src/lib/prompt-builder.ts`（在现有文件中新增导出函数）

```typescript
/**
 * 生成强制 When-Then 激活指令，按场景分组。
 *
 * 每条规则采用 WHEN-THEN-NEVER 格式，当用户请求匹配触发条件时，
 * 强制模型读取并执行对应的 Skill/Agent。
 */
export function generateActivationRules(
  skills: SkillMetadata[],
  agents: AgentMetadata[],
  skillsRootDir: string,
  agentsRootDir: string,
): string;
```

### 4.3 输出格式规范

```markdown
# ⚡ 强制激活规则（MANDATORY ACTIVATION RULES）

> 以下规则**不可跳过、不可替代**。匹配到触发条件时，必须按指定步骤执行。

## 规则 1：代码审查流程

- **WHEN**：用户请求中包含以下任一关键词：
  `代码审查` | `code review` | `CR` | `审查代码` | `代码质量`
- **THEN**：
  1. 读取 Agent 定义：`<agentsRootDir>/code-reviewer/AGENT.md`
  2. 读取关联技能：`<skillsRootDir>/frontend-code-review/SKILL.md`
  3. 读取检查清单：`<skillsRootDir>/frontend-code-review/references/` 下的参考文件
  4. 严格按照 AGENT.md 中定义的工作流程执行
- **NEVER**：
  - ❌ 不得跳过已安装的审查流程，直接用通用知识回答
  - ❌ 不得省略检查清单中的必选检查项

## 规则 2：Bug 排查与修复

- **WHEN**：用户请求中包含以下任一关键词：
  `修复bug` | `debug` | `排查问题` | `报错` | `异常` | `白屏` | `不生效`
- **THEN**：
  1. 读取 Agent 定义：`<agentsRootDir>/bug-investigator/AGENT.md`
  2. 按照 AGENT.md 中的根因分析流程执行（不得直接猜测原因）
  3. 使用工具链收集上下文（grep_search、read_file 等）
- **NEVER**：
  - ❌ 不得直接猜测 Bug 原因，必须先按流程排查
  - ❌ 不得跳过上下文收集步骤

[... 更多规则按分组生成 ...]
```

### 4.4 分组策略

复用 `prompt-builder.ts` 中已有的分组逻辑：

| 分组 | 对应函数/常量 | 包含的 Agent/Skill |
|------|-------------|-------------------|
| **代码审查** | REVIEW_ROUTE_KEYWORDS | code-reviewer Agent + frontend-code-review / backend-code-review Skill |
| **Bug 排查与修复** | DIAGNOSIS_ROUTE_KEYWORDS | bug-investigator / build-fix Agent |
| **规划与执行** | ORCHESTRATION_ROUTE_KEYWORDS | planner / task-orchestrator Agent |
| **性能优化** | 'performance' category | performance-profiler Agent + performance-optimization / build-optimization Skill |
| **架构分析** | 'architecture' category | structure-analyzer Agent + structure-review / module-mapping Skill |
| **文档与设计** | DOCUMENTATION_ROUTE_KEYWORDS | system-overview-writer Agent + system-overview-design / prd Skill |
| **测试** | QUALITY_SKILL_ROUTE_KEYWORDS | tdd-driver Agent + frontend-testing / backend-testing Skill |
| **重构** | IMPLEMENTATION_SKILL_ROUTE_KEYWORDS | component-refactoring / state-management Skill |

### 4.5 实��细节

**合并触发词的逻辑**：

```typescript
// 对于每个分组，合并其中所有 Agent 和 Skill 的 triggers
function collectGroupTriggers(
  agents: AgentMetadata[],
  skills: SkillMetadata[],
): string[] {
  const allTriggers = new Set<string>();

  for (const agent of agents) {
    for (const trigger of agent.triggers) {
      allTriggers.add(trigger);
    }
  }

  for (const skill of skills) {
    for (const trigger of skill.triggers) {
      // Skill trigger 格式: "审查代码/代码质量/code review"
      for (const part of trigger.split('/')) {
        allTriggers.add(part.trim());
      }
    }
  }

  return [...allTriggers];
}
```

**生成 THEN 步骤的逻辑**：

对于每个分组，按以下优先级排列执行步骤：
1. 如果组内有 Agent → 优先读取 AGENT.md（Agent 是执行者，有完整工作流）
2. 如果组内有 Skill → 读取 SKILL.md 和 references/（Skill 是知识源）
3. 具体步骤从 Agent 的 `workflowSummary` 字段提取摘要

### 4.6 依据：现有代码模式

- 分组逻辑复用 `classifyAgentRouteCategory()` 和 `classifySkillRouteCategory()`（prompt-builder.ts:664-748）
- 关键词常量复用 `ORCHESTRATION_ROUTE_KEYWORDS`、`DIAGNOSIS_ROUTE_KEYWORDS` 等（prompt-builder.ts:556-626）
- 触发词格式化复用 `summarizeRouteTriggers()`（prompt-builder.ts:636-641）

---

## 五、第三层：运行�� Trigger Matcher（`trigger-matcher.ts`）

### 5.1 设计决策

**Q: 为什么需要运行时匹配？前两层不够吗？**

A: 前两层解决了"模型知道有什么能力"和"模型被要求去用"的问题。但在 task-executor 编排场景下，任务描述可能包含隐式触发词（如"这个页面好卡"隐含 performance-optimization），此时需要运行时匹配来自动注入完整的 Skill/Agent 内容到 prompt 中。

**Q: 为什么不直接在 selectManualAgentId 里做？**

A: `selectManualAgentId`（task-executor.ts:142-180）目前是**硬编码的启发式路由**。Trigger Matcher 是**数据驱动的通用匹配器**，从 SKILL.md/AGENT.md 的 frontmatter 动态读取触发条件，无需为每个新 Skill/Agent 修改代码。两者职责不同：
- `selectManualAgentId`：任务类型 → Agent ID 的映射（粗粒度）
- Trigger Matcher：用户输入 → 匹配的 Skill/Agent 列表（细粒度，含置信度��

### 5.2 文件位置与签名

**文件**：`scripts/src/lib/trigger-matcher.ts`（新建文件）

```typescript
import { SkillMetadata, AgentMetadata } from '../types';

/**
 * 触发匹配结果
 */
export interface TriggerMatchResult {
  /** 匹配到的实体 ID */
  entityId: string;
  /** 实体类型 */
  entityType: 'skill' | 'agent';
  /** 匹配到的 trigger 原文 */
  matchedTrigger: string;
  /** 匹配方式 */
  matchType: 'explicit' | 'implicit';
  /** 置信度（0-1），explicit 匹配固定为 1.0 */
  confidence: number;
  /** 实体描述（用于 prompt 注入时的上下文说明） */
  description: string;
}

/**
 * 对用户输入进行 trigger 匹配，返回匹配到的 Skill/Agent 列表。
 *
 * 匹配优先级：
 * 1. Agent explicit triggers（精确匹配，confidence = 1.0）
 * 2. Skill triggers（关键词匹配，confidence = 0.9）
 * 3. Agent implicit triggers（正则匹配，confidence 取 AGENT.md 中定义的值）
 *
 * @param userInput - 用户的自然语言输入
 * @param skills - 已加载的 Skill 元数据列表
 * @param agents - 已加载的 Agent 元数据列表
 * @param options - 可选配置
 * @returns 按置信度降序排列的匹配结果
 */
export function matchTriggers(
  userInput: string,
  skills: SkillMetadata[],
  agents: AgentMetadata[],
  options?: TriggerMatchOptions,
): TriggerMatchResult[];

export interface TriggerMatchOptions {
  /** 最小置信度阈值，低于此值的匹配结果将被过滤。默认 0.75 */
  minConfidence?: number;
  /** 最大返回结果数。默认 5 */
  maxResults?: number;
}
```

### 5.3 匹配算法

```
输入: userInput = "这个页面好卡，帮我优化一下性能"

Step 1: 规范化输入
  normalized = userInput.toLowerCase().trim()

Step 2: Agent explicit 匹配（精确子串包含）
  for each agent:
    for each trigger in agent.triggers:
      if normalized.includes(trigger.toLowerCase()):
        results.push({ entityId: agent.id, matchType: 'explicit', confidence: 1.0, ... })

Step 3: Skill 关键词匹配（拆分 / 后逐个子串匹配）
  for each skill:
    for each triggerGroup in skill.triggers:
      for each keyword in triggerGroup.split('/'):
        if normalized.includes(keyword.trim().toLowerCase()):
          results.push({ entityId: skill.id, matchType: 'explicit', confidence: 0.9, ... })

Step 4: Agent implicit 匹配（正则匹配）
  for each agent:
    if agent.implicitTriggers:
      for each { pattern, confidence } in agent.implicitTriggers:
        if new RegExp(pattern, 'i').test(normalized):
          results.push({ entityId: agent.id, matchType: 'implicit', confidence, ... })

Step 5: 去重和排序
  按 entityId 去重（保留最高 confidence 的匹配）
  按 confidence 降序排序
  取前 maxResults 条
```

### 5.4 与 task-executor 的集成点

在 `task-executor.ts` 的 `selectManualAgentId` 函数附近，可以在未来集成 trigger-matcher：

```typescript
// task-executor.ts 中的集成方式（Phase 3 实施时修改）
//
// 当前 selectManualAgentId 是硬编码路由，可通过以下方式增强：
// 1. 在 executeTask() 调用 selectManualAgentId 之前，先调用 matchTriggers
// 2. 如果 matchTriggers 返回了高置信度结果（>=0.85），优先使用该 Agent
// 3. 匹配到的 Skill 内容可以注入到 Agent Call 的 prompt 中
//
// 注意：这是 Phase 3 的改动，Phase 1-2 不涉及 task-executor.ts
```

### 5.5 依据

- 匹配逻辑参照 `selectManualAgentId`（task-executor.ts:142-180）和 `isRuntimeBugInvestigationTask`（task-executor.ts:134-140）中的正则匹配模式
- 数据源复用 `parseAgentMetadata`（metadata-parser.ts:116-163）已解析的 `implicitTriggers` 字段
- 置信度机制参照 AGENT.md 中已定义的 confidence 分层（0.75-0.95）

---

## 六、改动文件清单

### 6.1 修改的文件

| 文件 | 改动类型 | 改动说明 |
|------|---------|---------|
| `scripts/src/lib/prompt-builder.ts` | **新增函数** | 新增 `generateCapabilityCatalog()` 和 `generateActivationRules()` 两个导出函数，以及相关辅助函数 |
| `scripts/src/codebuddy-loader.ts` | **新增调用** | 在 main() 中 `generateAgentsPrompt()` 之后、`generateScriptsPrompt()` 之前，调用新增的两个函数并追加到 `finalContent` |

### 6.2 新建的文件

| 文件 | 说明 |
|------|------|
| `scripts/src/lib/trigger-matcher.ts` | 运行时 trigger 匹配器 |

### 6.3 不需要修改的文件（及原因）

| 文件 | 不修改原因 |
|------|-----------|
| `scripts/src/types/index.ts` | `SkillMetadata` 和 `AgentMetadata` 已包含 `triggers` 和 `implicitTriggers`，无需新增类型 |
| `scripts/src/lib/metadata-parser.ts` | trigger 解析逻辑已完整，无需修改 |
| `scripts/src/lib/context-targeting.ts` | 仅处理 Skill 的 workspace/role 过滤，与 trigger 匹配无关 |
| `scripts/src/lib/distribution-profiles.ts` | 仅定义分发文件列表，与本功能无关 |
| `scripts/src/task-executor.ts` | Phase 3 集成在独立阶段实施，Phase 1-2 不涉及 |
| `scripts/src/generate-manifest.ts` | manifest 只负责文件索引，不涉及 prompt 生成 |

---

## 七、接口契约

### 7.1 prompt-builder.ts 新增导出

```typescript
// 新增导出（追加到现有导出列表）
export { generateCapabilityCatalog } from './lib/prompt-builder';
export { generateActivationRules } from './lib/prompt-builder';
```

### 7.2 codebuddy-loader.ts 导入变更

```typescript
// 在现有的 prompt-builder 导入列表中追加：
import {
  // ... 现有导入 ...
  generateCapabilityCatalog,    // 新增
  generateActivationRules,      // 新增
} from './lib/prompt-builder';
```

### 7.3 codebuddy-loader.ts 调用位置

```typescript
// 在 codebuddy-loader.ts 的 main() 函数中，
// 位于 generateAgentsPrompt() 之后、generateScriptsPrompt() 之前

// ============ 技能系统 ============
// ... 现有代码 ...
finalContent += generateSkillsPrompt(skills, skillsRootDir);  // 现有

// ============ Agent 系统 ============
// ... 现有代码 ...
finalContent += generateAgentsPrompt(agents, agentsRootDir);  // 现有

// ============ 🆕 能力激活桥梁 ============
if (skills.length > 0 || agents.length > 0) {
  finalContent += generateCapabilityCatalog(skills, agents, skillsRootDir, agentsRootDir);
  finalContent += generateActivationRules(skills, agents, skillsRootDir, agentsRootDir);
}

// ============ 脚本分发 ============
// ... 现有代码继续 ...
```

---

## 八、Token 预算评估

### 8.1 当前 project-rules.md 的 token 分布

| 章节 | 预估 token |
|------|-----------|
| Frontmatter + Layer 1 完整内容 | ~3000-5000 |
| Layer 2/3 索引表 | ~500 |
| Workspace 提示词 | ~800 |
| 规则激活指南 + 快速行动指引 | ~500 |
| Skill 路由表 | ~800 |
| Agent 路由表 | ~1200 |
| 脚本/Workflow/TaskBook/命令索引 | ~1500 |
| **合计** | **~8300-10300** |

### 8.2 新增内容的 token 预算

| 新增章节 | 预估 token | 说明 |
|---------|-----------|------|
| 能力目录表格（15 Skill + 11 Agent） | ~600 | 每行约 20 token |
| When-Then 指令（约 8 组规则） | ~800 | 每组约 100 token |
| **新增合计** | **~1400** | 约占总量 12-15% |

**结论**：新增 ~1400 token 在 GLM-4.7 的 128K 上下文窗口中微不足道，且集中在文件末尾（避免首尾效应问题时，可考虑调整到 Layer 1 之后）。

### 8.3 位置优化

考虑到 GLM-4.7 的"首尾注意力效应"，**将 When-Then 指令放在 project-rules.md 的靠前位置**可能效果更好。但这需要修改 finalContent 的拼接顺序，可能影响现有结构。

**建议**：Phase 1 先放在 Agent 路由表之后（最小改动）。Phase 2 测试后，如果效果不理想，再调整位置。

---

## 九、测试策略

### 9.1 单元测试

| 测试用例 | 验证点 |
|---------|--------|
| `generateCapabilityCatalog` 空输入返回空字符串 | `skills=[], agents=[]` → `''` |
| `generateCapabilityCatalog` 包含所有 Skill 的触发词 | 每个 Skill 的 triggers 都出现在输出中 |
| `generateCapabilityCatalog` 包含所有 Agent 的触发词 | 每个 Agent 的 triggers 都出现在输出中 |
| `generateCapabilityCatalog` 路径正确拼接 | 使用 skillsRootDir/agentsRootDir 参数 |
| `generateActivationRules` 空输入返回空字符串 | `skills=[], agents=[]` → `''` |
| `generateActivationRules` 包含 WHEN/THEN/NEVER 关键词 | 输出包含强制格式 |
| `generateActivationRules` 分组合并触发词 | 同组 Skill/Agent 的 triggers 合并 |
| `flattenSkillTriggers` 正确拆分 | `["a/b/c"]` → `["a", "b", "c"]` |
| `matchTriggers` explicit 匹配 | 包含 Agent trigger 关键词 → confidence = 1.0 |
| `matchTriggers` implicit 匹配 | 匹配 Agent implicit pattern → 使用定义的 confidence |
| `matchTriggers` Skill 关键词匹配 | 包含 Skill trigger 的子关键词 → confidence = 0.9 |
| `matchTriggers` 去重逻辑 | 同一实体多次匹配 → 保留最高 confidence |
| `matchTriggers` 阈值过滤 | 低于 minConfidence 的结果被过滤 |

### 9.2 集成测试

在 `test/lib-baseline.test.mjs` 中新增测试（遵循现有模式：`require()` 编译后的 `scripts/dist/lib/prompt-builder.js`）：

```javascript
// 示例测试结构
{
  const { generateCapabilityCatalog, generateActivationRules } = require(promptBuilderDistPath);

  // 测试 1: 空输入
  assert.strictEqual(generateCapabilityCatalog([], [], '', ''), '');

  // 测试 2: 包含 Skill 触发词
  const skills = [{ id: 'test-skill', name: '测试', description: '测试技能', triggers: ['关键词A/关键词B'] }];
  const result = generateCapabilityCatalog(skills, [], '.codebuddy/skills', '.codebuddy/agents');
  assert.ok(result.includes('关键词A'));
  assert.ok(result.includes('关键词B'));
}
```

### 9.3 E2E 验证

在测试项目中运行 `node scripts/dist/codebuddy-loader.js --profile full`，检查：
1. `.codebuddy/rules/project-rules.md` 包含"已安装能力目录"章节
2. `.codebuddy/rules/project-rules.md` 包含"强制激活规则"章节
3. 所有已安装的 Skill/Agent 都在能力目录中列出
4. When-Then 指令的触发词覆盖了所有 SKILL.md/AGENT.md 的 triggers

---

## 十、风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| project-rules.md 过长导致 GLM-4.7 注意力分散 | 中 | 高 | 控制新增 token 在 1500 以内；Phase 2 测试位置优化 |
| 模型仍然忽略 When-Then 指令 | 低 | 中 | Phase 2 针对 GLM-4.7 优化措辞；添加反面示例 |
| 改动引入编译错误 | 低 | 低 | 只新增函数，不修改现有函数签名；运行 `npm run build:scripts` 验证 |
| trigger-matcher 正则匹配性能问题 | 极低 | 低 | Skill/Agent 总数 ~26 个，trigger 总数 <100，毫秒级完成 |
| 与现有路由表信息重复 | 低 | 低 | 摘要表和路由表关注点不同：摘要重触发词，路由重场景分类 |

---

## 十一、遗留问题与后续规划

### 11.1 当前范围不包含

- **task-executor.ts 的集成修改**：Trigger Matcher 在 Phase 3 集成到 task-executor
- **指令位置 A/B 测试**：When-Then 指令放在 project-rules.md 的不同位置（靠前 vs 靠后）对 GLM-4.7 的效果对比
- **多模型适配**：不同模型（GLM-4.7 vs Claude vs GPT）对 When-Then 指令的遵循差异

### 11.2 后续优化方向

1. **自适应指令强度**：根据模型类型调整指令措辞（GLM-4.7 用更强约束，Claude 用更柔和表述）
2. **Trigger 热更新**：修改 SKILL.md/AGENT.md 后，无需重新运行 loader 即可更新 trigger 匹配规则
3. **激活率监测**：在 Agent Call 结果中记录是否通过 trigger 匹配激活，用于评估效果
