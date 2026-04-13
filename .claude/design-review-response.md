# 设计修订分析：回应 Codex 审查意见

> **版本**: 1.1.0
> **生成时间**: 2026-04-07
> **状态**: ✅ 已完成（全部 6 条反馈已落地实施并通过审查）
> **关联文档**: `.claude/design-skill-agent-activation.md`（v1.0.0，已按本文修订实施）
> **审查来源**: Codex 对 v1.0.0 的 6 条反馈 + 2 条细节
> **审查报告**: `.claude/verification-report.md`

---

## 逐条分析与裁决

### 反馈 1：Task-2 的"复用现有分类函数"在实现上不成立

**Codex 原文**：classifyAgentRouteCategory() 只产出 orchestration/documentation/diagnosis/review/other，没有任务单里的 architecture/testing/performance/implementation。

**代码验证**：

| 函数 | 文件位置 | 实际返回值 |
|------|---------|-----------|
| `classifyAgentRouteCategory` | prompt-builder.ts:664-681 | `'orchestration' \| 'documentation' \| 'diagnosis' \| 'review' \| 'other'` |
| `classifySkillRouteCategory` | prompt-builder.ts:725-748 | `'architecture' \| 'implementation' \| 'quality' \| 'performance' \| 'documentation' \| 'workflow' \| 'other'` |

**结论**：**完全正确**。这两个函数的返回值类型不同——Agent 只有 5 种分类，Skill 有 7 种分类。v1.0.0 设计中说"复用现有分类"是不精确的，因为：

1. Agent 和 Skill 的分类维度不对齐（Agent 没有 architecture/testing 等）
2. 将两者"合并分组"需要一套新的统一分类体系，不能简单复用任何一边

**修订方案**：Task-2 需要**新建一套 Activation 分类器**，���不是声称"复用"。具体做法：
- 定义新的 `ActivationCategory` 类型，从两边的分类中提取有意义的并集
- 新建 `classifyForActivation(entity)` 函数，对 Agent 和 Skill 统一分类
- 分类关键词常量可以**引用**（不是复用）现有的 `DIAGNOSIS_ROUTE_KEYWORDS` 等，但分类逻辑本身是独立的

**影响范围**：设计文档第四节 4.4"分组策略"和 4.6"依据"需要重写。任务单 Task-2 需要重写。

---

### 反馈 2：Task-2 正则写法有 bug

**Codex 原文**：`/(performance\|build\|render\|bundle)/` 会匹配字面量 `|`，不是"或"。

**代码验证**：

在 prompt-builder.ts 中，**现有代码**实际写法是（第 728-729 行、第 737-738 行）：

```typescript
// 第 728 行 - 实际代码
if (/(structure|module|architecture)/.test(text)) {
// 第 737 行 - 实际代码
if (/(performance|build|render|bundle)/.test(text)) {
```

现有代码用的是**无转义**的 `|`，这是正确的正则"或"。

但 v1.0.0 设计文档和任务单中写成了 `/(performance\|build\|render\|bundle)/`（带反斜杠转义），这在 JavaScript 正则中 `\|` 匹配的是字面量竖线符号，不是"或"操作符。

**结论**：**完全正确，这是文档中的 bug**。设计文档在 Markdown 转义过程中引入了错误。如果执行者照抄实现，分组逻辑会彻底失败。

**修订方案**：任务单中所有正则表达式需要去掉 `\` 转义，改为：
- `/(performance|build|render|bundle)/` ✅
- `/(structure|module|architecture)/` ✅
- `/(prd|ralph|skill-creator|requirements|spec)/` ✅

**影响范围**：任务单 Task-2 的正则表达式纠正。

---

### 反馈 3：Prompt 拼接顺序问题

**Codex 原文**：loader 先拼 generateSkillsPrompt()（第 1407 行），再拼 generateAgentsPrompt()（第 1418 行），但文案里 Agent 是"第二步"，Skill 是"第三步"。新规则如果还是插在 Agent 后面，只是叠加，不是顺序纠偏。

**代码验证**：

```
codebuddy-loader.ts 拼接顺序：
  第 1407 行: finalContent += generateSkillsPrompt(skills, skillsRootDir);    ← Skill 先
  第 1418 行: finalContent += generateAgentsPrompt(agents, agentsRootDir);    ← Agent 后
```

但在 `generateAgentsPrompt` 的输出中（prompt-builder.ts:823-860）：
```markdown
# 🤖 Agent 与 Skill 统一调度指南
## 第一步：判断任务规模
## 第二步：Agent 分类路由（多步骤流程）   ← Agent 在"第二步"
```

而 `generateSkillsPrompt` 的输出中（prompt-builder.ts:862-905）：
```markdown
## 第三步：Skill 分类路由（单次操作）     ← Skill 在"第三步"
```

**矛盾**：文件拼接顺序是 Skill → Agent，但内容中的步骤编号是 Agent（第二步）→ Skill（第三步）。这实际上是**刻意设计**——`generateSkillsPrompt` 输出的标题是"第三步"，它在内容上是 Agent 调度指南（第二步）的延续。所以虽然拼接顺序是 Skill 先、Agent 后，但阅读语义上 Agent（第二步）的标题和 Skill（第三步）的标题是连贯的。

**但 Codex 的核心质疑是对的**：新增的"能力目录"和"强制规则"如果再叠加在 Agent 之后，会造成 3 层重复的能力信息（路由表 + 能力目录 + 强制规则），加剧信息冗余。

**结论**：**有效质疑，但解法不应该是调整拼接顺序，而是压缩新增内容**。

**修订方案**：采纳 Codex 的建议——"把能力目录和强制规则压成更紧凑的一段"。具体做法：
1. **取消独立的"能力目录表格"**（`generateCapabilityCatalog` 与现有路由表高度重复）
2. **只保留一个紧凑的 `generateActivationRules` 函数**，输出格式为：
   - 一段全局强制声明（~100 token）
   - 每组一个紧凑的 WHEN-THEN 块（~50 token/组 × 8 组 = ~400 token）
   - 总计 ~500 token，比原设计的 ~1400 token 节省 64%
3. 不再单独生成能力目录表格——现有路由表已经提供了同等信息

**影响范围**：
- 设计文档第三节（能力摘要）整节删除或合并到第四节
- 任务单 Task-3 删除或合并到 Task-4
- `generateCapabilityCatalog` 函数取消
- Token 预算从 ~1400 降至 ~500

---

### 反馈 4：Phase 3 缺少 capability registry/loader

**Codex 原文**：task-executor 现在只有硬编码路由和 AgentRuntime 初始化，没有通用的 Skill 元数据装载链路。agent-runtime 只是在 Agent 已被选中后按 permissions.skills 去读 SKILL.md。Phase 3 真正缺的是 capability registry/loader，不只是 matcher。

**代码验证**：

```
task-executor.ts 第 3269-3289 行：
  createDefaultRuntime() → createAgentRuntime({ projectRoot, agentsDir, ... })
  只有 Agent 目录路径，没有 Skill 元数据

agent-runtime.ts 第 732-763 行：
  loadDeclaredSkills() → 仅读取 permissions.skills 中声明的 Skill
  是"Agent 被选中后"的按需加载，不是通用检索

task-executor.ts 第 142-180 行：
  selectManualAgentId() → 纯硬编码路由，无数据驱动
```

**结论**：**完全正确，这是架构层面的关键洞察**。

当前的数据流是：
```
用户输入 → selectManualAgentId（硬编码）→ Agent 确定
→ AgentRuntime.loadDeclaredSkills（按 permissions.skills 加载）→ Skill 内容
```

如果只加一个 trigger-matcher 纯函数，它：
- **没有 Skill 元数据来源**：trigger-matcher 需要 `SkillMetadata[]` 作为输入，但 task-executor 的运行上下文中没有这个数据
- **没有 Skill 内容加载能力**：匹配到 Skill 后，还需要读取完整的 SKILL.md 内容注入 prompt，但这个读取逻辑在 agent-runtime 的 private 方法里
- **���有 Agent 元数据来源**：同理，task-executor 不持有 `AgentMetadata[]`

所以真正需要的是一个 **CapabilityRegistry**：
```typescript
interface CapabilityRegistry {
  // 注册和查询所有已安装的 Skill/Agent 元数据
  getAllSkillMetadata(): SkillMetadata[];
  getAllAgentMetadata(): AgentMetadata[];
  // 按 trigger 匹配
  matchByTrigger(userInput: string): TriggerMatchResult[];
  // 加载匹配到的实体的完整内容
  loadEntityContent(entityId: string, entityType: 'skill' | 'agent'): string | null;
}
```

**修订方案**：Phase 3 **从本次实施范围中移除**，不作为 Task-6 交付。原因：
1. 它需要一个跨越 task-executor / agent-runtime / codebuddy-loader 三个模块的注册中心
2. 这涉及数据流架构变更，不是单个纯函数能解决的
3. 与 Phase 1-2（prompt 注入）是完全不同的技术路线

在设计文档中将 Phase 3 降级为"后续规划"，明确记录 capability registry 的需求和架构方向，但不产出代码。

**影响范围**：
- 任务单 Task-6（trigger-matcher.ts）移除
- 设计文档第五节改为"后续规划：Capability Registry"
- 测试中移除 trigger-matcher 相关用例

---

### 反馈 5：THEN 步骤引用 relatedSkills 存在未安装风险

**Codex 原文**：relatedSkills 只是 frontmatter 原样解析出来（metadata-parser.ts:127），而实际安装的 Skill 还会经过 shouldIncludeSkill 过滤（codebuddy-loader.ts:517）。必须做已安装 skill IDs 的交集。

**代码验证**：

```typescript
// metadata-parser.ts 第 129 行
const relatedSkills = permissionsBlock ? parseYamlList(permissionsBlock, 'skills', 2) : [];

// codebuddy-loader.ts 第 526-533 行
return loadEntities<SkillMetadata>(ctx, logger, skillsPath, {
  // ...
  includeEntity: (metadata) => shouldIncludeSkill(metadata, workspaceInfo, ctx.targetRole),
}, tracker, targetDir);
```

**场景举例**：
- Agent `code-reviewer` 的 `permissions.skills` 声明了 `frontend-code-review` 和 `backend-code-review`
- 如果用户用 `--role frontend` 安装，`shouldIncludeSkill` 可能过滤掉 `backend-code-review`
- 但 `code-reviewer.relatedSkills` 仍然包含 `backend-code-review`
- 如果 When-Then 规则的 THEN 步骤写"读取 backend-code-review/SKILL.md"，文件不存在

**结论**：**完全正确，这是运行时数据一致性问题**。

**修订方案**：`generateActivationRules` 函数需要接收**已安装的 Skill ID 集合**作为额外参数，在生成 THEN 步骤时做交集过滤。

```typescript
export function generateActivationRules(
  skills: SkillMetadata[],
  agents: AgentMetadata[],
  skillsRootDir: string,
  agentsRootDir: string,
): string;
// skills 参数本身就是已过滤的列表，所以只需要用 skills.map(s => s.id) 构建已安装集合
```

具体做法：在生成 THEN 步骤时：
```typescript
const installedSkillIds = new Set(skills.map(s => s.id));

// 对每个 Agent 的 relatedSkills 做交集
const validRelatedSkills = (agent.relatedSkills || [])
  .filter(skillId => installedSkillIds.has(skillId));
```

**影响范围**：
- `generateActivationRules` 的实现细节调整（无签名变更，因为 `skills` 参数已经是过滤后的列表）
- 任务单 Task-4 的实现规范中需要明确"已安装交集"逻辑

---

### 反馈 6：测试拆分不完整

**Codex 原文**：设计文档要求改 test/lib-baseline.test.mjs 增加新函数测试，但任务单没有单独的"写测试"任务。当前测试文件顶部也没有 prompt-builder 的 dist 路径常量。

**代码验证**：

```javascript
// lib-baseline.test.mjs 第 14-31 行：已有的 dist 路径常量
const frontmatterUtilsDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'frontmatter-utils.js');
const metadataParserDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'metadata-parser.js');
// ... 等等
// ❌ 没有 promptBuilderDistPath
```

**结论**：**完全正确**。当前测试文件没有 `prompt-builder.js` 的路径常量，且任务单确实缺少独立的测试编写任务。

**修订方案**：
1. 新增 Task-X（测试编写），作为 Task-4 之后、Task-5 之前的显式任务
2. 该任务需要：
   - 在 `lib-baseline.test.mjs` 顶部新增 `const promptBuilderDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'prompt-builder.js');`
   - 编写 `generateActivationRules` 的单元测试（空输入、非空输入、交集过滤）
3. E2E 断言中 Agent 数量改为动态获取，不写���数字

**影响范围**：任务单新增 Task-X（测试编写）。

---

### 细节 1：workflowSummary 不能当主要数据源

**Codex 原文**：解析器只读 frontmatter 的 workflow_summary，当前只有 structure-analyzer 有这个字段，其他 9 个 Agent 都没有。

**代码验证**：

| Agent | 有 workflow_summary? |
|-------|---------------------|
| structure-analyzer | ✅ 有（第 16-33 行） |
| 其他 9 个 | ❌ 全部没有 |

**结论**：**完全正确**。如果 THEN 步骤用 `workflowSummary` 生成摘要，10 个 Agent 中只有 1 个能产出有意义的内容。

**修订方案**：THEN 步骤不依赖 `workflowSummary`，改��固定模板：
```markdown
- **THEN**：
  1. 读取 `<path>/AGENT.md` 完整内容
  2. 按照 AGENT.md 中定义的工作流程执行
  [3. 读取关联技能（如有已安装的关联 Skill）]
```

**影响范围**：设计文档第四节 4.5 的"生成 THEN 步骤的逻辑"修改。任务单 Task-4 的实现规范修改。

---

### 细节 2：Agent 数量是 10 个，不是 11 个

**代码验证**：`agents/` 下有 10 个子目录（已在探索阶段确认）。

**结论**：**完全正确**。

**修订方案**：设计文档和任务单中所有提到"11 个 Agent"的地方改为"10 个"。E2E 断言改为动态获取，不写死数字。

---

## 综合裁决

### 6 条反馈全部采纳的理由

| # | 反馈 | 严重程度 | 理由 |
|---|------|---------|------|
| 1 | 分类器不能复用 | 🔴 高 | 直接导致实现方向错误 |
| 2 | 正则写法有 bug | 🔴 高 | 照抄实现会导致分组逻辑全部失败 |
| 3 | 拼接顺序信息冗余 | 🟡 中 | Token 浪费和注意力分散是真实风险 |
| 4 | Phase 3 缺 registry | 🔴 高 | 架构缺失不是加一个纯函数能解决的 |
| 5 | relatedSkills 未过滤 | 🟡 中 | 运行时引用不存在的文件会导致模型困惑 |
| 6 | 测试任务缺失 | 🟡 中 | 不可验证的交付物 = 不可信的交付物 |

### Codex 建议的收敛策略

| 建议 | 采纳? | 理由 |
|------|-------|------|
| 第一版只做 Phase 1/2 | ✅ 采纳 | Phase 3 需要 capability registry，不是当前范围能闭环的 |
| 能力目录和强制规则压成更紧凑的一段 | ✅ 采纳 | 避免与路由表信息重复，减少 token 浪费 |
| 单独定义 activation group 分类器 | ✅ 采纳 | 现有两套分类器维度不对齐，硬融合只会出错 |
| 先补 capability metadata loader 再谈 Phase 3 | ✅ 采纳 | 正确识别了架构缺口 |
| 测试任务显式加入任务单 | ✅ 采纳 | 必须可验证 |
| E2E 断言改为动态获取 | ✅ 采纳 | 避免硬编码数字导致维护负担 |

---

## 修订后的整体方案

### 范围缩减

```
v1.0.0 方案（3 层 + 3 个新产出）     v1.1.0 方案（2 层 + 1 个新产出）
───────────────────────────────      ──────────────────────────────
✅ generateCapabilityCatalog         ❌ 取消（与路由表重复）
✅ generateActivationRules           ✅ 保留（压缩到 ~500 token）
✅ trigger-matcher.ts                ❌ 移除（需要 capability registry 才有意义）
✅ 8 个分组规则                      ✅ 保留（用新分类器）
```

### 修订后的任务列表（6 个任务）

```
Task-1: 辅助函数（flattenSkillTriggers, formatTriggerKeywords）     → 保留
Task-2: 新建 Activation 分类器（独立逻辑，不复用现有分��器）          → 重写
Task-3: generateCapabilityCatalog                                   → 删除
Task-4: generateActivationRules（含 relatedSkills 交集过滤）         → 修订
Task-5: codebuddy-loader 集成                                       → 简化（只调一个函数）
Task-6: trigger-matcher.ts                                          → 删除
Task-X: 测试编写（lib-baseline.test.mjs 新增测试）                   → 新增
Task-7: 编译验证和回归测试                                           → 修订（动态 Agent 数量）
```

修订后的依赖关系：
```
Task-1（辅助函数）──┐
                    ├──→ Task-4（generateActivationRules）
Task-2（分类器）───┘         │
                             ├──→ Task-5（loader 集成）──→ Task-7（编译测试）
Task-X（测试编写）──────────┘
```

---

## 后续规划：Capability Registry（不在本次范围）

Phase 3 的正确做法是新建一个 **CapabilityRegistry** 模块，解决��下问题：

1. **元数据来源**：在 codebuddy-loader 安装时，将 SkillMetadata[] 和 AgentMetadata[] 序列化到 `.codebuddy/capability-registry.json`
2. **运行时加载**：task-executor 启动时读取 registry.json，获得所有已安装能力的元数据
3. **Trigger 匹配**：基于 registry 中的 triggers 做匹配（即 trigger-matcher 的输入数据来源）
4. **内容注入**：匹配成功后，从 skill-snapshots/agent-snapshots 读取完整内容注入 prompt

这需要：
- 在 `install-state.ts` 或新文件中扩展序列化逻辑
- 在 `task-executor.ts` 中新增 registry 加载逻辑
- 在 `agent-runtime.ts` 中暴露 Skill 内容加载接口（当前是 private 方法）
- 定义 `capability-registry.json` 的 schema

这是一个横切多个模块的架构变更，需要独立的设计评审。
