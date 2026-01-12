# 🎯 Skills-like 智能规则激活增强

## 快速开始

### 什么是智能规则激活？

这是对 Architect Rule Loader 的增强，让 **CodeBuddy + 任意模型** 能够像 **Claude Code + Skills** 那样动态激活规则。

### 核心能力

- ✅ **任务类型识别**：自动识别用户的任务类型（重构、调试、测试、新功能、代码审查）
- ✅ **动态规则激活**：根据任务类型智能选择相关规则
- ✅ **渐进式应用**：优先应用高相关性规则，按需参考中等相关性规则
- ✅ **跨模型兼容**：适用于 GPT、Gemini、Claude 等任意 AI 模型

## 使用方式

### 方式 1：无任务过滤（推荐新手）

```bash
npm run build:scripts
node scripts/dist/rule-loader.js
```

生成包含所有规则的 project-rules.md，AI 模型会根据用户请求自动识别任务类型并激活相关规则。

### 方式 2：任务过滤（推荐进阶）

```bash
# 重构任务
node scripts/dist/rule-loader.js --task refactoring

# 调试任务
node scripts/dist/rule-loader.js --task debugging --threshold 0.7

# 新功能开发
node scripts/dist/rule-loader.js --task new-feature --detail-level quick
```

预先过滤规则，只加载与特定任务相关的规则，减少 token 消耗。

## 实际效果

### 场景：重构任务

**用户**："重构这个组件，使用 Composition API"

**AI 模型行为**：
1. 识别任务类型：refactoring
2. 激活规则：
   - 🔥 architecture/feature-based-structure (0.9)
   - 🔥 vue3/vue3-script-setup (0.9)
   - 🔥 refactoring checklist (1.0)
3. 按照规则指导进行重构

**回复示例**：
"我将按照 Vue 3 Composition API 最佳实践和重构检查清单来重构这个组件。首先，我会分析现有组件的结构..."

### 场景：调试任务

**用户**："这个函数报错了，帮我看看"

**AI 模型行为**：
1. 识别任务类型：debugging
2. 激活规则：
   - 🔥 debugging checklist (1.0)
   - 🔥 typescript/strict-types (0.7)
3. 按照调试流程排查问题

**回复示例**：
"让我按照调试检查清单来排查这个错误。首先，我会检查错误信息和堆栈跟踪..."

## 与 Claude Code + Skills 的对比

| 特性 | Claude Code + Skills | 智能规则激活系统 |
|------|---------------------|-----------------|
| 动态激活 | ✅ 原生支持 | ✅ 通过提示词模拟 |
| 任务识别 | ✅ 自动识别 | ✅ 通过关键词识别 |
| 跨模型兼容 | ❌ 仅 Claude | ✅ 任意模型 |
| 配置驱动 | ❌ 固定格式 | ✅ 完全可配置 |

## 详细文档

- [完整使用指南](docs/skills-like-activation-guide.md)
- [配置说明](config/loader-config.json)
- [原始 README](README.md)

## 技术实现

通过在生成的 project-rules.md 中添加**智能规则激活系统**章节，包含：

1. **任务类型识别表格**：教会 AI 如何识别任务类型
2. **规则激活策略**：告诉 AI 在不同任务下应该重点关注哪些规则
3. **智能应用原则**：指导 AI 如何灵活应用规则
4. **示例对话**：提供具体的应用示例

这样，虽然 CodeBuddy 仍然是静态加载 project-rules.md，但通过智能提示词，AI 模型可以模拟 Skills 的动态激活能力。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT
