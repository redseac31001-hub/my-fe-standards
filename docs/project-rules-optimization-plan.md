---
title: project-rules 优化实施计划
date: 2026-03-07
---

# project-rules 优化实施计划

目标：在不改执行架构的前提下，降低 `project-rules.md` 的首屏负担，提升弱模型在业务项目中的首轮路由与执行指令命中率。

## 范围

本计划只覆盖：

- `project-rules.md` 的生成内容
- Layer 1 eager 内容的瘦身方式
- scripts / commands 的说明文本外迁
- Agent / Skill 决策树的展示方式

本计划不覆盖：

- TaskBook schema 改造
- Workflow 契约变更
- Agent Call 协议变更
- `task.type` 收缩
- 执行器状态机重写

## 修正后的事实基线

1. 当前仓库已打通并验证：
   - `planner -> apply-plan`
   - `MANUAL_REQUIRED -> agent-call -> resume`
   - `worker-executor`
   - reports 注入
   - execution metrics
2. 当前加载器已具备：
   - `--rule-level summary|quick|full`
   - `filterRuleByLevel()`
3. 当前 Layer 1 规则共 9 个，只有 5 个具备完整 `@level` 标记。
4. 当前已有 `.codebuddy/scripts/README.md` 生成逻辑，但没有 `.codebuddy/commands/README.md` 生成逻辑。

## 总体策略

按“低风险优先”推进：

1. 先做纯输出层瘦身
2. 再补 Layer 1 标记覆盖
3. 再做 Layer 1 reference 缓存
4. 最后才讨论是否调整默认行为

## Phase 0：基线固化与安全边界

### 目标

把当前体积、覆盖率和回退点量化清楚，避免边改边猜。

### 改动

- 记录样例 `project-rules.md` 的当前行数、大小、主要区段占比
- 统计 Layer 1 `@level` 覆盖率
- 明确现有 `--rule-level` 行为不能被破坏

### 涉及文件

- `giggly-moseying-pancake.md`
- `docs/project-rules-optimization-plan.md`

### 完成标准

- 已知当前基线值
- 已知 9 个 Layer 1 规则里哪些缺少标记
- 已知哪些优化可先做、哪些需要后置

### 回退点

- 文档阶段，无代码回退成本

## Phase 1：低风险瘦身

### 目标

先减少 scripts / commands 部分的冗余文本，不碰 Layer 1 主体语义。

### 改动

1. 收敛 `generateScriptsPrompt()`
   - 主入口只保留索引表 + README 指针
2. 新增 `generateCommandsReadme()`
3. 在 commands 分发阶段生成 `.codebuddy/commands/README.md`
4. 收敛 `generateCommandsPrompt()`
   - 主入口只保留命令索引表 + README 指针
5. 新增“快速行动指引”

### 涉及文件

- `scripts/src/lib/prompt-builder.ts`
- `scripts/src/codebuddy-loader.ts`

### 验收标准

- `npm run build` 通过
- `node test/run-tests.js` 通过
- `.codebuddy/scripts/README.md` 仍正常生成
- `.codebuddy/commands/README.md` 新增且内容完整
- `project-rules.md` 行数有可见下降

### 风险

- 低
- 主要是输出结构变化，不改执行逻辑

### 回退点

- 直接回退 prompt 生成函数和 commands README 分发逻辑

## Phase 2：Layer 1 标记治理

### 目标

让全部 Layer 1 规则都能稳定参与 `summary / quick / full` 裁剪。

### 改动

优先方案：

1. 为缺失标记的 4 个规则补 `@level:summary / quick / full`

备选方案：

2. 若短期不补齐，则在 `filterRuleByLevel()` 上增加无标记回退逻辑

### 涉及文件

- `rules/layer1_base/architecture/feature-based-structure.md`
- `rules/layer1_base/typescript/strict-types.md`
- `rules/layer1_base/vue2/vue2-general.md`
- `rules/layer1_base/vue2/vue2-composition.md`
- `scripts/src/codebuddy-loader.ts`

### 验收标准

- 9/9 Layer 1 规则都能稳定产出 `summary` 和 `quick` 结果
- 不出现“无标记规则仍被全文嵌入”的失控情况
- `--rule-level full` 行为保持兼容

### 风险

- 中
- 规则文本本身会有结构性调整

### 回退点

- 保留规则原文不动，仅撤回新增标记或回退 `filterRuleByLevel()` 变更

## Phase 3：Layer 1 Reference 缓存

### 目标

把 Layer 1 的“完整原文”从主入口挪到参考缓存，主入口只保留精粹。

### 改动

1. 在 Layer 1 eager 输出中优先使用 `summary / quick`
2. 将完整 Layer 1 规则写入：
   - `.codebuddy/rules_cache/layer1_reference/`
3. 在 `project-rules.md` 末尾追加 Layer 1 参考索引

### 关键约束

第一轮不建议直接改变默认 `full` 语义。

建议先做：

- `summary / quick` 模式下生效
- 或通过受控开关试用

待插件试点证明收益后，再决定是否把默认行为切换为“主入口精粹 + 完整参考缓存”。

### 涉及文件

- `scripts/src/codebuddy-loader.ts`

### 验收标准

- `summary / quick` 模式下，Layer 1 行数显著下降
- 完整规则仍可从 `layer1_reference` 找回
- 现有回归全部通过

### 风险

- 中
- 会扩展当前 `rules_cache` 的目录语义

### 回退点

- 停止生成 `layer1_reference`
- 恢复主入口全文嵌入

## Phase 4：决策树分类化

### 目标

降低弱模型处理 Agent / Skill 决策树时的认知负担。

### 改动

1. Agent 决策树按场景分组
2. 每个 Agent 只保留高辨识度触发词
3. Skill 决策树同理
4. 补“快速行动指引”

### 涉及文件

- `scripts/src/lib/prompt-builder.ts`

### 验收标准

- 决策树行数下降
- 不丢失关键 Agent / Skill 发现入口
- 人工审查确认分类无明显误导

### 风险

- 低到中
- 风险在于分类不当会影响弱模型首轮路由

### 回退点

- 恢复当前按 Agent / Skill 平铺生成逻辑

## Phase 5：插件验证与默认行为决策

### 目标

用真实弱模型验证“瘦身是否真的带来收益”，再决定是否调整默认行为。

### 试验场景

至少覆盖以下 5 类：

1. “帮我实现登录功能”
2. “修复这个报错”
3. “构建失败了”
4. “帮我分析项目结构”
5. “审查这段代码”

### 验证对象

- 当前版本
- 仅做 Phase 1 的版本
- 完成 Phase 1-4 的版本

### 观察指标

- 首轮路由是否更快命中
- 是否减少误读和二次追问
- 是否减少“读很多但没有行动”的情况
- 是否影响已有强模型行为

### Go / No-Go

满足以下条件才考虑调整默认行为：

1. build 和回归持续通过
2. 至少 1 个业务项目试点通过
3. 弱模型首轮命中率和行动性有可观察提升
4. 未出现明显的信息缺失回归

否则：

- 保留优化为可选模式
- 不修改默认 `ruleLevel=full`

## 推荐执行顺序

1. Phase 0：固化基线
2. Phase 1：先做低风险瘦身
3. Phase 2：补齐 Layer 1 标记
4. Phase 3：引入 Layer 1 reference 缓存
5. Phase 4：分类决策树 + 快速行动指引
6. Phase 5：插件和业务项目试点验证

## 最终交付物

完成后应至少产出：

1. 更轻的 `project-rules.md`
2. `commands/README.md` 生成链路
3. Layer 1 reference 缓存目录
4. 一份优化前后对比记录
5. 一份弱模型试点验证结论
