# 精简 `project-rules.md` 以适配弱模型

## 背景

`project-rules.md` 是 `codebuddy-loader` 生成的核心输出文件，弱模型会优先消费它来理解项目规范、可用脚本和 Agent/Skill 路由方式。

当前样例（`test/mock-projects/vue3-project/.codebuddy/rules/project-rules.md`）实测约：

- 1836 行
- 52 KB

这对弱模型不是“不可用”，但信息密度明显偏高，容易降低首轮路由和执行指令的命中率。

本方案只聚焦 **精简 `project-rules.md` 的生成逻辑**，不涉及以下内容：

- TaskBook schema 收缩
- Workflow 改造
- Agent Call 协议变更
- 执行架构重写

## 修正后的前提

### 1. 当前问题不是“执行链路没打通”，而是“主入口提示词过重”

仓库当前已具备并验证以下能力：

- `planner -> apply-plan`
- `MANUAL_REQUIRED -> agent-call -> resume`
- `worker-executor` 自动执行
- reports 注入 `task-executor` 上下文
- execution metrics 落盘

因此，本次优化的目标不是补执行链路，而是提升弱模型对主规则文件的消费效率。

### 2. 现有加载器已经有 `rule-level` 机制，不应另起一套平行抽取逻辑

当前 `codebuddy-loader.ts` 已存在：

- `--rule-level summary|quick|full`
- `filterRuleByLevel()`

因此更合理的方向是 **复用现有分段裁剪机制**，而不是在 `prompt-builder.ts` 里再发明一套完全独立的 `extractRuleSummary()` 语义。

### 3. Layer 1 的 `@level` 标记覆盖并不完整

目前 Layer 1 一共 9 个规则文件，只有 5 个具备完整的 `@level:summary / quick / full` 标记。

已覆盖：

- `rules/layer1_base/code-quality/clean-code.md`
- `rules/layer1_base/typescript/api-request.md`
- `rules/layer1_base/vue3/pinia.md`
- `rules/layer1_base/vue3/router.md`
- `rules/layer1_base/vue3/vue3-script-setup.md`

未覆盖：

- `rules/layer1_base/architecture/feature-based-structure.md`
- `rules/layer1_base/typescript/strict-types.md`
- `rules/layer1_base/vue2/vue2-general.md`
- `rules/layer1_base/vue2/vue2-composition.md`

所以“按 `@level` 直接提取”目前还不能当作现成前提，必须先补标记，或提供无标记规则的回退策略。

### 4. `scripts/README.md` 已有生成链路，`commands/README.md` 目前没有

当前仓库已存在：

- `generateScriptsReadme()`
- `.codebuddy/scripts/README.md` 的写入逻辑

但当前还没有：

- `generateCommandsReadme()`
- `.codebuddy/commands/README.md` 的生成/分发链路

因此“命令指南外迁”不只是 `prompt-builder.ts` 的文本调整，还需要补一段新的 commands README 分发逻辑。

### 5. 文中的收益数字只能视为目标值，不是既成事实

后文所有“行数下降 / token 下降 / 弱模型命中率改善”都应理解为：

- 目标值
- 估算值
- 待验证值

不能当作已经被仓库回归或业务试点证实的结果。

## 当前 `project-rules.md` 构成

按当前生成逻辑粗分：

| 部分 | 来源 | 估算占比 | 可压缩性 |
|------|------|----------|---------|
| Layer 1 全文嵌入 | `codebuddy-loader.ts` | 最高 | 高 |
| Agent 决策树 + 详情 | `generateAgentsPrompt()` | 中 | 中 |
| 脚本索引 + 指南 | `generateScriptsPrompt()` | 中 | 高 |
| Skill 决策树 + 列表 | `generateSkillsPrompt()` | 中 | 中 |
| Commands 索引 + 指南 | `generateCommandsPrompt()` | 中 | 高 |
| Workflows / TaskBooks / Agent Calls | 各 prompt 生成函数 | 低 | 低 |
| 规则激活指南 | `generateRuleActivationPrompt()` | 低 | 低 |

核心问题仍然集中在三点：

1. Layer 1 全文长期常驻，体积最大。
2. 脚本和命令说明写得过细，适合 README，不适合主入口。
3. Agent/Skill 决策树平铺展开，对弱模型不够友好。

## 优化原则

### 原则 1：先减负，不改协议

优先做输出瘦身，不动：

- TaskBook 契约
- Workflow 契约
- Agent Call 文件协议
- 执行状态机

### 原则 2：复用现有机制

优先复用：

- `--rule-level`
- `filterRuleByLevel()`
- `rules_cache`
- 已有 `README.md` 分发模式

### 原则 3：先做低风险，再考虑默认行为变更

首轮优化应先完成：

- scripts/commands 文本外迁
- 快速行动指引
- Layer 1 标记补齐 / fallback
- `quick` / `summary` 模式瘦身验证

不要一开始就直接修改默认 `ruleLevel=full` 的行为。

## 修正后的改动方向

### 改动 1：先补 Layer 1 标记治理，再做摘要抽取

**目标**：让 Layer 1 的裁剪逻辑对全部规则可用。

**涉及文件**：

- `rules/layer1_base/*`
- `scripts/src/codebuddy-loader.ts`

**推荐做法**：

1. 先为缺失的 4 个 Layer 1 规则补 `@level:summary / quick / full` 段落。
2. 若短期不补齐，则在 `filterRuleByLevel()` 上增加“无标记回退策略”。
3. 无标记回退必须可预测，例如：
   - 保留标题 + Context + The Rule
   - 丢弃长示例和扩展说明

**说明**：

这里不建议先在 `prompt-builder.ts` 新增另一套摘要提取器，否则会与现有 `rule-level` 机制语义重叠。

### 改动 2：Layer 1 精粹嵌入，完整内容进入参考缓存

**目标**：让主入口只保留弱模型第一轮真正需要的信息。

**涉及文件**：

- `scripts/src/codebuddy-loader.ts`

**具体方向**：

1. 在 Layer 1 eager 内容中仅拼接 `summary/quick` 内容。
2. 将 Layer 1 完整内容写入新的参考缓存目录，例如：
   - `.codebuddy/rules_cache/layer1_reference/`
3. 在 `project-rules.md` 中新增 Layer 1 参考索引表。

**风险控制**：

- 第一阶段只建议在 `--rule-level quick|summary` 下启用。
- 默认 `full` 是否也改为“主入口精粹 + reference full”，应放到业务试点后再决策。

### 改动 3：脚本与命令指南外迁

**目标**：主入口只保留“发现入口”，详细操作放 README。

**涉及文件**：

- `scripts/src/lib/prompt-builder.ts`
- `scripts/src/codebuddy-loader.ts`

**具体方向**：

1. `generateScriptsPrompt()` 收敛为简洁索引表 + README 指针。
2. 保留并复用现有 `.codebuddy/scripts/README.md` 生成链路。
3. 新增 `generateCommandsReadme()`。
4. 在 commands 分发阶段生成 `.codebuddy/commands/README.md`。
5. `generateCommandsPrompt()` 收敛为命令索引表 + README 指针。

### 改动 4：决策树按场景归类

**目标**：减少弱模型看到的平铺分支数。

**涉及文件**：

- `scripts/src/lib/prompt-builder.ts`

**具体方向**：

1. Agent 决策树改为按场景分组：
   - 问题诊断
   - 规划实现
   - 审查分析
2. 每个 Agent 只保留最具辨识度的少量触发词。
3. Skill 决策树同理，避免把所有触发词平铺在主入口。

### 改动 5：追加“快速行动指引”

**目标**：让弱模型在读完整个文档前先找到入口。

**涉及文件**：

- `scripts/src/lib/prompt-builder.ts`

**具体方向**：

新增一个 10-20 行的速查表，例如：

- “帮我实现 XX 功能” → `/task` / `task-orchestrator`
- “修复 bug / 报错” → `bug-investigator`
- “构建失败 / 类型错误” → `build-fix`
- “分析项目结构” → `structure-analyzer`

## 目标效果（待验证）

以下均为 **目标值**，不是已验证结果：

| 指标 | 当前 | 目标 | 备注 |
|------|------|------|------|
| `project-rules.md` 行数 | ~1836 | ~1000-1200 | 取决于 Layer 1 压缩幅度 |
| 预估 token 数 | ~13000 | ~8000 左右 | 需实际测量 |
| Layer 1 占比 | 高 | 明显下降 | 目标是不再绝对主导 |
| 弱模型快速路由入口 | 无 | 有 | 通过快速行动指引补足 |

## 风险与前置条件

| 项目 | 风险级别 | 说明 |
|------|---------|------|
| Layer 1 标记补齐 | 中 | 4 个规则文件尚未完成 `@level` 分段 |
| Layer 1 参考缓存引入 | 中 | 会扩展 `rules_cache` 语义，需要文档同步 |
| scripts/commands 文本外迁 | 低 | 输出结构变化，执行逻辑不变 |
| 默认行为变更 | 中到高 | 若直接改变默认 `full` 语义，需更严格试点验证 |

## 验证方式

1. `npm run build`
2. `node test/run-tests.js`
3. 生成样例 `project-rules.md`，检查：
   - 行数
   - 目录结构
   - Layer 1 是否仍可追溯到完整参考
4. 在 CodeBuddy 插件中，用弱模型测试典型场景：
   - 新功能
   - Bug 修复
   - 构建失败
   - 项目结构分析
5. 在 1 个真实业务项目中做受控试点

## 结论

这项优化是合理的，但应该按以下顺序推进：

1. 先修正前提
2. 先做低风险瘦身
3. 再做 Layer 1 摘要化
4. 最后再决定是否调整默认行为

详细实施计划见：

- `docs/project-rules-optimization-plan.md`
