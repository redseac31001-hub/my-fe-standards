# 实施任务列表：Skill/Agent 激活桥梁

> **关联设计文档**: `.claude/design-skill-agent-activation.md`
> **生成时间**: 2026-04-07
> **状态**: ✅ 已完成（按 v1.1.0 修订方案执行：Task-3/6 取消，Task-X 新增，其余完成）
> **总任务数**: 7 个（含 1 个可选任务） → 实际执行 5 个（Task-1/2/4/5/X/7）
> **预估总工时**: 4-6 小时
> **审查报告**: `.claude/verification-report.md`

---

## 依赖关系图

```
Task-1 ─────────────────────┐
  (辅助函数)                │
                            ├──→ Task-3 (generateCapabilityCatalog)
Task-2 ─────────────────────┤
  (分组策略重构)            ├──→ Task-4 (generateActivationRules)
                            │
                            └──→ Task-5 (codebuddy-loader 集成)
                                   │
Task-6 (trigger-matcher) ←─────── │ (独立，无依赖)
                                   │
                                   ↓
                            Task-7 (编译 + 测试)
```

---

## Task-1: 在 prompt-builder.ts 中新增 Trigger 辅助函数

### 元信息
- **阻塞**: Task-3, Task-4
- **被阻塞**: 无
- **改动文件**: `scripts/src/lib/prompt-builder.ts`
- **改动类型**: 新增函数（文件末尾追加）

### 需求

在 `scripts/src/lib/prompt-builder.ts` 文件中新增以下**内部辅助函数**（不导出）：

#### 1.1 `flattenSkillTriggers(triggers: string[]): string[]`

**功能**: 将 Skill 格式的 trigger 拆分为独立关键词。

**输入**: Skill 的 `triggers` 字段，格式如 `["审查代码/代码质量/code review", "性能/优化"]`

**输出**: 展平的关键词数组，如 `["审查代码", "代码质量", "code review", "性能", "优化"]`

**实现逻辑**:
```typescript
function flattenSkillTriggers(triggers: string[]): string[] {
  return triggers.flatMap(t => t.split('/').map(s => s.trim()).filter(Boolean));
}
```

**参考**: Skill trigger 格式见 `parseSkillMetadata`（metadata-parser.ts:70-72），其中 triggers 由 `parseYamlList` 解析为字符串数组。

#### 1.2 `formatTriggerKeywords(keywords: string[], maxItems?: number): string`

**功能**: 将关键词列表格式化为反引号包裹的展示字符串。

**输入**: `["代码审查", "code review", "CR"]`, maxItems = 5

**输出**: `` "`代码审查`, `code review`, `CR`" ``

**如果超过 maxItems**: 截断并追加 `+N`，如 `` "`代码审查`, `code review` +4" ``

**实现逻辑**:
```typescript
function formatTriggerKeywords(keywords: string[], maxItems = 5): string {
  const unique = [...new Set(keywords.map(k => k.trim()).filter(Boolean))];
  if (unique.length === 0) return '-';
  if (unique.length <= maxItems) {
    return unique.map(k => `\`${k}\``).join(', ');
  }
  return `${unique.slice(0, maxItems).map(k => `\`${k}\``).join(', ')} +${unique.length - maxItems}`;
}
```

**参考**: 参照 `summarizeRouteTriggers`（prompt-builder.ts:636-641）和 `formatCodeList`（prompt-builder.ts:272-274）的风格。

#### 1.3 `collectAllTriggerKeywords(agents: AgentMetadata[], skills: SkillMetadata[]): Map<string, string[]>`

**功能**: 按实体 ID 收集所有触发关键词（合并 Agent explicit + Skill 拆分后的关键词）。

**输入**: Agent 和 Skill 元数据列表

**输出**: `Map<entityId, keywords[]>`

**实现逻辑**:
```typescript
function collectAllTriggerKeywords(
  agents: AgentMetadata[],
  skills: SkillMetadata[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const agent of agents) {
    result.set(agent.id, [...agent.triggers]);
  }

  for (const skill of skills) {
    result.set(skill.id, flattenSkillTriggers(skill.triggers));
  }

  return result;
}
```

### 验收标准

- [ ] 三个函数在 `prompt-builder.ts` 中定义（函数签名、参数类型、返回值类型正确）
- [ ] `flattenSkillTriggers` 正确处理空数组、单条 trigger、多条 trigger、含空格的 trigger
- [ ] `formatTriggerKeywords` 正确处理空数组、未超限、超限截断
- [ ] `collectAllTriggerKeywords` 返回的 Map 包含所有传入的 Agent 和 Skill 的 ID
- [ ] 不修改任何现有函数

---

## Task-2: 提取可复用的 Activation 分组策略

### 元信息
- **阻塞**: Task-4
- **被阻塞**: 无
- **改动文件**: `scripts/src/lib/prompt-builder.ts`
- **改动类型**: 新增接口和函数

### 需求

When-Then 指令需要将 Agent 和 Skill **合并分组**（现有的 `groupAgentsByScenario` 和 `groupSkillsByScenario` 是分别分组的）。新增一个**统一分组函数**。

#### 2.1 新增类型 `ActivationGroup`

```typescript
interface ActivationGroupEntry {
  id: string;
  entityType: 'skill' | 'agent';
  name: string;
  description: string;
  triggers: string[];  // 已展平的关键词列表
  filePath: string;    // 相对路径，如 ".codebuddy/agent-snapshots/<id>/code-reviewer/AGENT.md"
  workflowSummary?: string; // 仅 Agent 有
  relatedSkills?: string[];  // 仅 Agent 有
}

interface ActivationGroup {
  key: string;
  title: string;
  entries: ActivationGroupEntry[];
  /** 合并后的所有触发关键词（去重） */
  mergedTriggers: string[];
}
```

#### 2.2 新增函数 `buildActivationGroups`

```typescript
function buildActivationGroups(
  skills: SkillMetadata[],
  agents: AgentMetadata[],
  skillsRootDir: string,
  agentsRootDir: string,
): ActivationGroup[];
```

**分组规则**（8 组，基于现有分类常量）：

| key | title | 匹配逻辑 | 相关常量 |
|-----|-------|---------|---------|
| `review` | 代码审查 | Agent/Skill 文本包含 REVIEW_ROUTE_KEYWORDS 或 QUALITY_SKILL_ROUTE_KEYWORDS 中审查相关词 | `REVIEW_ROUTE_KEYWORDS` |
| `diagnosis` | Bug 排查与修复 | Agent/Skill 文本包含 DIAGNOSIS_ROUTE_KEYWORDS | `DIAGNOSIS_ROUTE_KEYWORDS` |
| `orchestration` | 规划与执行 | Agent/Skill 文本包含 ORCHESTRATION_ROUTE_KEYWORDS | `ORCHESTRATION_ROUTE_KEYWORDS` |
| `performance` | 性能与构建优化 | 文本包含 `performance`, `build`, `render`, `bundle`, `性能` | 正则 `/(performance\|build\|render\|bundle)/` |
| `architecture` | 架构与结构分析 | 文本包含 `structure`, `module`, `architecture` | 正则 `/(structure\|module\|architecture)/` |
| `documentation` | 文档与设计 | Agent/Skill 文本包含 DOCUMENTATION_ROUTE_KEYWORDS 或 DOCUMENTATION_SKILL_ROUTE_KEYWORDS | 相关常量 |
| `testing` | 测试 | 文本包含 `testing`, `test`, `tdd`, `测试` | `QUALITY_SKILL_ROUTE_KEYWORDS` 子集 |
| `implementation` | 实现与重构 | Agent/Skill 文本包含 IMPLEMENTATION_SKILL_ROUTE_KEYWORDS | `IMPLEMENTATION_SKILL_ROUTE_KEYWORDS` |

**分类逻辑**：复用 `classifyAgentRouteCategory` 和 `classifySkillRouteCategory` 的匹配思路，但输出统一的 `ActivationGroup`。

**处理同时匹配多个组的实体**：一个 Agent/Skill 只归入第一个匹配的组（按上表顺序优先匹配）。

**处理无法分类的实体**：归入 `other` 组（第 9 组，仅在有未分类实体时出现）。

### 验收标准

- [ ] `ActivationGroupEntry` 和 `ActivationGroup` 类型定义正确
- [ ] `buildActivationGroups` 的分组结果覆盖所有输入的 Agent 和 Skill（无遗漏）
- [ ] 每个 `ActivationGroup.mergedTriggers` 包含该组所有实体的触发关键词（去重）
- [ ] `filePath` 正确使用 `skillsRootDir`/`agentsRootDir` 拼接
- [ ] 空输入返回空数组

---

## Task-3: 实现 generateCapabilityCatalog 函数

### 元信息
- **阻塞**: Task-5
- **被阻塞**: Task-1
- **改动文件**: `scripts/src/lib/prompt-builder.ts`
- **改动类型**: 新增导出函数

### 需求

实现设计文档第三节定义的 `generateCapabilityCatalog` 函数。

#### 函数签名

```typescript
export function generateCapabilityCatalog(
  skills: SkillMetadata[],
  agents: AgentMetadata[],
  skillsRootDir: string,
  agentsRootDir: string,
): string;
```

#### 输出要求

1. 当 `skills` 和 `agents` 都为空时，返��空字符串 `''`
2. 输出以 `# 📋 已安装能力目录（CAPABILITY CATALOG）` 开头
3. 包含一段强制性警告文本（见设计文档 3.3）
4. 分为两个表格："技能清单（Skills）" 和 "代理清单（Agents）"
5. 每个表格包含 4 列：ID、名称、触发关键词、文件路径
6. 触发关键词使用 `formatTriggerKeywords` 格式化（Task-1 的辅助函数）
7. 文件路径格式：`<rootDir>/<entityId>/SKILL.md` 或 `<rootDir>/<entityId>/AGENT.md`
8. 按 ID 字母序排列
9. 只有��应列表非空时才输出对应表格

#### 实现参考

参照 `generateRuleActivationPrompt`（prompt-builder.ts:908-926）的 Markdown 表格生成模式。

### 验收标准

- [ ] 空输入 → 空字符串
- [ ] 只有 Skills → 只输出技能清单表格
- [ ] 只有 Agents → 只输出代理清单表格
- [ ] 表格每行包含正确的 ID、名称、触发关键词、文件路径
- [ ] Skill 触发词正确拆分（`/` 分隔的同义词展平为独立关键词）
- [ ] Agent 触发词直接列出
- [ ] 输出包含强制性警告文本

---

## Task-4: 实现 generateActivationRules 函数

### 元信息
- **阻塞**: Task-5
- **被阻塞**: Task-1, Task-2
- **改动文件**: `scripts/src/lib/prompt-builder.ts`
- **改动类型**: 新增导出函数

### 需求

实现设计文档第四节定义的 `generateActivationRules` 函数。

#### 函数签名

```typescript
export function generateActivationRules(
  skills: SkillMetadata[],
  agents: AgentMetadata[],
  skillsRootDir: string,
  agentsRootDir: string,
): string;
```

#### 输出要求

1. 当 `skills` 和 `agents` 都为空时，返回空字符串 `''`
2. 输出以 `# ⚡ 强制激活规则（MANDATORY ACTIVATION RULES）` 开头
3. 包含一段不可跳过的警告文本
4. 调用 `buildActivationGroups`（Task-2）获取分组
5. ��每个非空分组生成一条 WHEN-THEN-NEVER 规则
6. **WHEN** 部分：列出该组的 `mergedTriggers`，用 `|` 分隔，每个关键词用反引号包裹
7. **THEN** 部分：
   - 如果组内有 Agent → 第一步读取 AGENT.md
   - 如果组内有 Skill → 第二步读取 SKILL.md 和 references/
   - 如果 Agent 有 `workflowSummary` → 添加"按照工作流程执行"的步骤
   - 如果 Agent 有 `relatedSkills` → 添加"读取关联技能"的步骤
8. **NEVER** 部分：固定两条否定指令：
   - ❌ 不得跳过已安装的 Skill/Agent，直接用通用知识替代
   - ❌ 不得省略工作流程中的必要步骤
9. 规则编号按组顺序递增（规则 1、规则 2、...）

#### 实现参考

- 分组逻辑来自 Task-2 的 `buildActivationGroups`
- WHEN 部分的关键词格式参照能力目录表格（紧凑、高密度信息）
- THEN 部分的步骤编号参照 `generateQuickActionGuide`（prompt-builder.ts:528-544）的行动指引格式

### 验收标准

- [ ] 空输入 → 空字符串
- [ ] 每个非空分组都有一条 WHEN-THEN-NEVER 规则
- [ ] WHEN 部分包含该组所有实体的合并触发词
- [ ] THEN 部分的文件路径使用正确的 rootDir
- [ ] THEN 步骤区分 Agent 优先（读 AGENT.md）和 Skill 补充（读 SKILL.md）
- [ ] NEVER 部分包含两条否定指令
- [ ] 输出的 Markdown 格式正确（标题层级、列表缩进）

---

## Task-5: 在 codebuddy-loader.ts 中集成调用

### 元信息
- **阻塞**: Task-7
- **被阻塞**: Task-3, Task-4
- **改动文件**: `scripts/src/codebuddy-loader.ts`
- **改动类型**: 新增导入 + 新增调用代码

### 需求

在 `codebuddy-loader.ts` 的 main() 函数中集成新增的两个函数。

#### 5.1 新增导入

在文件顶部的 `import { ... } from './lib/prompt-builder'` 导入列表中追加两个函数名：

```typescript
import {
  // ... 现有导入保持不变 ...
  generateCapabilityCatalog,    // 新增
  generateActivationRules,      // 新增
} from './lib/prompt-builder';
```

**具体位置**：在 `codebuddy-loader.ts` 第 91-103 行的现有导入块中。当前导入列表为：

```typescript
import {
  generateWorkflowsPrompt,      // 第 91 行
  generateTaskBooksPrompt,
  generateAgentCallsPrompt,
  generateCommandsReadme,
  generateCommandsPrompt,
  generateQuickActionGuide,
  generateScriptsReadme,
  generateScriptsPrompt,
  generateAgentsPrompt,
  generateSkillsPrompt,         // 第 100 行
  generateRuleActivationPrompt,
  generateWorkspacePrompt,
} from './lib/prompt-builder';   // 第 103 行
```

在 `generateWorkspacePrompt,` 之后（第 102 行后）追加两行。

#### 5.2 新增调用代码

在 `codebuddy-loader.ts` 的 main() 函数中，**在第 1418 行**（`generateAgentsPrompt` 调用后）和**第 1422 行**（`generateScriptsPrompt` 调用前）之间插入：

```typescript
  // ============ 能力激活桥梁 ============
  if (skills.length > 0 || agents.length > 0) {
    logger.log('生成能力激活指令...');
    finalContent += generateCapabilityCatalog(
      skills, agents,
      skillsRootDir || '',
      agentsRootDir || '',
    );
    finalContent += generateActivationRules(
      skills, agents,
      skillsRootDir || '',
      agentsRootDir || '',
    );
    logger.log('能力激活指令已注入');
  }
```

**注意 null 处理**：`skillsRootDir` 类型为 `string | null`（第 1391 行），需要用 `|| ''` 处理 null 值。`agentsRootDir` 同理（第 1412 行）。

#### 5.3 不需要修改的部分

- `buildInstallState` 调用（第 1502 行起）：不需要新增��计字段
- `cleanupStaleManagedFiles`（第 1488 行）：不涉及新文件
- `gcSnapshotEntries`（第 1526 行起）：不涉及 snapshot 管理
- `updateGitignore`（第 1486 行）：不涉及新的 ignore 规则

### 验收标准

- [ ] 导入列表正确追加两个函数
- [ ] 调用位置在 Agent 路由表之后、脚本分发之前
- [ ] 正确处理 `skillsRootDir` 和 `agentsRootDir` 为 null 的情况
- [ ] 有日志输出（`logger.log`）
- [ ] 条件判断正确：只有至少有 Skill 或 Agent 时才生成
- [ ] 不修改任何现有代码行

---

## Task-6: 新建 trigger-matcher.ts 模块

### 元信息
- **阻塞**: 无（独立模块，Phase 3 才集成到 task-executor）
- **被阻塞**: 无
- **改动文件**: 无（新建文件）
- **新建文件**: `scripts/src/lib/trigger-matcher.ts`

### 需求

新建 `scripts/src/lib/trigger-matcher.ts`，实现设计文档第五节定义的 trigger 匹配逻辑。

#### 6.1 导出接口

```typescript
export interface TriggerMatchResult {
  entityId: string;
  entityType: 'skill' | 'agent';
  matchedTrigger: string;
  matchType: 'explicit' | 'implicit';
  confidence: number;
  description: string;
}

export interface TriggerMatchOptions {
  minConfidence?: number;  // 默认 0.75
  maxResults?: number;     // 默认 5
}
```

#### 6.2 导出函数

```typescript
export function matchTriggers(
  userInput: string,
  skills: SkillMetadata[],
  agents: AgentMetadata[],
  options?: TriggerMatchOptions,
): TriggerMatchResult[];
```

#### 6.3 实现规范

**匹配流程**（按优先级）：

1. **规范化输入**: `userInput.toLowerCase().trim()`
2. **Agent explicit 匹配**: 遍历 `agent.triggers`，检查 `normalized.includes(trigger.toLowerCase())`
   - 命中 → `{ matchType: 'explicit', confidence: 1.0 }`
3. **Skill 关键词匹配**: 遍历 `skill.triggers`，按 `/` 拆分，逐个检查 `normalized.includes(keyword)`
   - 命中 → `{ matchType: 'explicit', confidence: 0.9 }`
4. **Agent implicit 匹配**: 遍历 `agent.implicitTriggers`，检查 `new RegExp(pattern, 'i').test(normalized)`
   - 命中 → `{ matchType: 'implicit', confidence: 从定义中读取 }`
   - **异常安全**: RegExp 构造可能抛出异常（pattern 格式错误），需要 try-catch 跳过
5. **去重**: 按 `entityId` 去重，保留 `confidence` 最高的匹配
6. **过滤**: ���除 `confidence < minConfidence` 的结果
7. **排序**: 按 `confidence` 降序排列
8. **截断**: 取前 `maxResults` 条

**零依赖原则**: 仅导入 `../types` 中的类型定义。

**文件头注释**:
```typescript
/**
 * 触发匹配器
 *
 * 基于 Skill/Agent 的 frontmatter triggers 对用户输入进行匹配。
 * 供 task-executor 在编排任务时自动识别应注入的 Skill/Agent 内容。
 *
 * 当前为独立模块，Phase 3 集成到 task-executor 时调用。
 */
```

### 验收标准

- [ ] 文件位置正确：`scripts/src/lib/trigger-matcher.ts`
- [ ] 导出类型和函数签名与设计文档一致
- [ ] explicit 匹配逻辑正确（Agent 和 Skill 两种格式）
- [ ] implicit 匹配逻辑正确（正则匹配 + confidence 读取）
- [ ] 异常安全：错误的正则 pattern 不导致整个匹配失败
- [ ] 去重逻辑正确：同一实体保留最高 confidence
- [ ] 过滤和排序逻辑正确
- [ ] 仅依赖 `../types`，无外部依赖
- [ ] TypeScript 编译无错误

---

## Task-7: 编译验证和回归测试

### 元信息
- **阻塞**: 无（最终验证任务）
- **被阻塞**: Task-5, Task-6
- **改动文件**: 无（仅运行命令）

### 需求

#### 7.1 TypeScript 编译

运行以下命令确保无类型错误：

```bash
cd E:\mygit\my-fe-standards
npm run build:scripts
```

**预期结果**: 编译成功，无错误输出。`scripts/dist/` 下生成更新的 JS 文件。

#### 7.2 回归测试

运行以下命令确保现有测试不被破坏：

```bash
npm test
```

**预期结果**: `test:lib`（lib-baseline.test.mjs）和 `test:correctness`（test-correctness-regressions.mjs）全部通过。

#### 7.3 E2E 烟雾测试

在项目根目录运行完整安装：

```bash
node scripts/dist/codebuddy-loader.js --profile full
```

**预期结果**:
1. 命令成功完成，日志中包含 `生成能力激活指令...` 和 `能力激活指令已注入`
2. 生成的 `.codebuddy/rules/project-rules.md` 包含：
   - 标题 `# 📋 已安装能力目录（CAPABILITY CATALOG）`
   - 标题 `# ⚡ 强制激活规则（MANDATORY ACTIVATION RULES）`
   - 技能清单表格（至少包含已安装的 15 个 Skill）
   - 代理清单表格（至少包含已安装的 11 个 Agent）
   - 至少 5 条 WHEN-THEN-NEVER 规则

#### 7.4 验证检查清单

- [ ] `npm run build:scripts` 编译无错误
- [ ] `npm test` 所有测试通过
- [ ] `node scripts/dist/codebuddy-loader.js --profile full` 成功运行
- [ ] project-rules.md 包含能力目录章节
- [ ] project-rules.md 包含强制激活规则章节
- [ ] 能力目录中 Skill 数量与实际安装的一致
- [ ] 能力目录中 Agent 数量与实际安装的一致
- [ ] When-Then 规则的触发关键词来源于 SKILL.md/AGENT.md 的 frontmatter
- [ ] When-Then 规则的文件路径正确可访问

---

## 执行顺序建议

**最优执行路径**（考虑依赖关系和并行度）：

```
阶段 1（并行）:
  ├─ Task-1: 辅助函数（30 分钟）
  ├─ Task-2: 分组策略（45 分钟）
  └─ Task-6: trigger-matcher（60 分钟）

阶段 2（串行，依赖阶段 1 的 Task-1 + Task-2）:
  ├─ Task-3: generateCapabilityCatalog（45 分钟）
  └─ Task-4: generateActivationRules（60 分钟）

阶段 3（串行，依赖阶段 2）:
  └─ Task-5: codebuddy-loader 集成（20 分钟）

阶段 4（串行，依赖阶段 3 + 阶段 1 的 Task-6）:
  └─ Task-7: 编译验证和回归测试（30 分钟）
```

**单人串行执行路径**: Task-1 → Task-2 → Task-3 → Task-4 → Task-6 → Task-5 → Task-7

---

## 注意事项（给执行者）

1. **不要修改现有函数签名**: `generateSkillsPrompt`、`generateAgentsPrompt` 等现有导出函数的签名和行为不得改变。
2. **编码规范**: 使用 UTF-8 无 BOM。注释使用简体中文。代码标识符使用英文。
3. **文件编辑工具**: 在 Windows 上使用 Edit 工具时，文件路径必须使用反斜杠。
4. **导入顺序**: 项目内导入在外部导入之后，遵循现有 prompt-builder.ts 的导入顺序。
5. **零外部依赖**: 新建的 trigger-matcher.ts 只能使用 Node.js 内置模块和项目内类型。
6. **测试先行**: 建议在实现函数前先阅读 `test/lib-baseline.test.mjs` 的测试模式，了解如何为新函数编写测试。
