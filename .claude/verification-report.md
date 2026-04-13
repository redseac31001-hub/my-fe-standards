# 审查报告：Skill/Agent 激活桥梁实施

> **审查时间**: 2026-04-07
> **审查人**: Claude Code
> **被审查对象**: Codex 实施的 Skill/Agent 强制激活规则
> **综合评分**: 92/100
> **结论**: ✅ 通过

---

## 一、背景

### 1.1 问题

GLM-4.7 模型在安装了 Skill/Agent 后不主动使用它们。根因分析：系统设计缺陷（70%）+ 模型能力（30%）。Skill/Agent 的定义文件停留在文件系统中，模型只能看到 `project-rules.md` 中的路由索引表，但索引表是被动路由式设计，缺少从"用户输入关键词"到"强制读取并执行 Skill/Agent"的显式绑定。

### 1.2 解决方案

采用 v1.1.0 修订方案（经 Codex 审查后收敛）：
- ❌ 取消 `generateCapabilityCatalog`（与路由表重复）
- ✅ 保留 `generateActivationRules`（紧凑的 WHEN-THEN-NEVER 指令，~500 token）
- ❌ 移除 `trigger-matcher.ts`（需要 CapabilityRegistry 才有意义，降级为后续规划）

### 1.3 关联文档

| 文档 | 状态 | 说明 |
|------|------|------|
| `.claude/design-skill-agent-activation.md` | 📦 归档（v1.0.0） | 原始设计文档，含三层方案 |
| `.claude/design-review-response.md` | 📦 归档 | Codex 6 条审查意见逐条分析与裁决 |
| `.claude/tasks-skill-agent-activation.md` | 📦 归档 | 原始 7 任务列表（已按审查意见修订执行） |

---

## 二、Codex 审查意见落地验证

### 6 条反馈逐条验证

| # | 审查意见 | 严重度 | 实现状态 | 验证方式 |
|---|---------|--------|---------|---------|
| 1 | 分类器不能复用现有函数 | 🔴 高 | ✅ 通过 | 新建了 `classifyAgentForActivation()` 和 `classifySkillForActivation()`，统一 9 分类 `ActivationCategory` 类型 |
| 2 | 正则写法 `\|` 是字面量 bug | 🔴 高 | ✅ 通过 | 所有正则使用无转义 `|`，如 `/(performance|build|render|bundle)/` |
| 3 | Prompt 拼接信息冗余 | 🟡 中 | ✅ 通过 | 取消 `generateCapabilityCatalog`，只保留紧凑 `generateActivationRules` |
| 4 | Phase 3 缺少 capability registry | 🔴 高 | ✅ 通过 | 完全移除 `trigger-matcher.ts`，无半成品遗留 |
| 5 | `relatedSkills` 需已安装交集过滤 | 🟡 中 | ✅ 通过 | `installedSkillIds = new Set(skills.map(s => s.id))`，`.filter(skillId => installedSkillIds.has(skillId))` |
| 6 | 测试任务缺失 | 🟡 中 | ✅ 通过 | 新增 `testPromptBuilderActivationRules()` 测试函数 + `promptBuilderDistPath` 路径常量 |

### 2 条细节验证

| # | 细节 | 实现状态 |
|---|------|---------|
| 细节 1 | workflowSummary 不能当主数据源 | ✅ THEN 步骤使用固定模板，不依赖 workflowSummary |
| 细节 2 | Agent 数量是 10 不是 11 | ✅ 硬编码覆盖表恰好 10 个 Agent |

---

## 三、代码质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 类型安全 | 95 | 完整的 TypeScript 类型定义，类型谓词正确使用 |
| 关注点分离 | 95 | 6 个辅助函数职责单一清晰 |
| 可维护性 | 90 | Agent 硬编码覆盖表需随 Agent 增删手动更新 |
| 代码复用 | 95 | 提取 `normalizeKeywords()` 供多处复用，使用现有 `formatCodeList()` |
| 测试覆盖 | 80 | 覆盖了主路径和交集过滤，但缺少纯 Skill 和边界场景 |
| 向后兼容 | 100 | 未修改任何现有函数签名 |
| Token 效率 | 90 | ~500 token，比 v1.0.0 的 ~1400 token 节省 64% |

**综合评分**: 92/100

---

## 四、改动文件清单

| 文件 | 改动类型 | 行数变化 |
|------|---------|---------|
| `scripts/src/lib/prompt-builder.ts` | 修改（新增函数） | +242, -4 |
| `scripts/src/codebuddy-loader.ts` | 修改（新增导入+调用） | +12 |
| `test/lib-baseline.test.mjs` | 修改（新增测试） | +60 |
| `scripts/dist/lib/prompt-builder.js` | 编译产物 | +181 |
| `scripts/dist/codebuddy-loader.js` | 编译产物 | +5 |

---

## 五、验证结果

| 验证项 | 结果 |
|--------|------|
| `npm run build:scripts` | ✅ 编译零错误 |
| `npm test` (test:lib + test:correctness) | ✅ 全部通过（30+ 用例） |
| 新增测试 PASS | ✅ `prompt builder emits compact mandatory activation rules with installed-skill filtering` |
| 回归测试 | ✅ 无破坏 |

---

## 六、遗留优化项

| # | 问题 | 严重度 | 建议 |
|---|------|--------|------|
| 1 | Skill 分类器中 `build`/`ci` 等关键词过于宽泛 | 🟡 低 | 收窄为 `build-optimization` 等复合词 |
| 2 | 跨组 relatedSkills 引用可能产生冗余 | 🟢 极低 | Agent 的 relatedSkill 路径可能同时出现在两个组中 |
| 3 | 测试覆盖可增强 | 🟡 低 | 补充纯 Skill、空 triggers、截断输出等边界测试 |
| 4 | E2E 烟雾测试未执行 | 🟡 中 | 需运行 `--profile full` 验证真实安装产物 |

---

## 七、后续规划

### Phase 3: CapabilityRegistry（不在本次范围）

Phase 3 的正确做法是新建 **CapabilityRegistry** 模块，解决以下问题：
1. **元数据来源**：在 codebuddy-loader 安装时序列化到 `.codebuddy/capability-registry.json`
2. **运行时加载**：task-executor 启动时读取 registry
3. **Trigger 匹配**：基于 registry 做匹配
4. **内容注入**：匹配成功后注入完整内容

需要横切 task-executor / agent-runtime / codebuddy-loader 三个模块，需要独立设计评审。
