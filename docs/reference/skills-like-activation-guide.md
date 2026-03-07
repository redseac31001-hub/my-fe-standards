# 智能规则激活系统使用指南

## 📋 概述

智能规则激活系统是对 CodeBuddy Rule Loader 的增强，让 CodeBuddy 能够像 Claude Code + Skills 那样**动态激活**相关规则。

## 🎯 核心能力

### 1. 任务类型识别

系统会根据用户请求中的关键词自动识别任务类型：

| 任务类型 | 关键词 | 典型场景 |
|---------|--------|---------|
| **重构 (refactoring)** | 重构、优化、清理、改进、简化 | "重构这个组件"、"优化代码结构" |
| **调试 (debugging)** | 修复、bug、错误、问题、不工作 | "修复这个 bug"、"为什么报错" |
| **测试 (testing)** | 测试、单元测试、覆盖率 | "添加测试"、"如何测试这个功能" |
| **新功能 (new-feature)** | 实现、添加、创建、开发 | "实现登录功能"、"添加搜索" |
| **代码审查 (code-review)** | 审查、检查、评审、review | "审查这段代码"、"有什么问题" |

### 2. 规则激活策略

根据任务类型，系统会自动推荐相关规则：

- **🔥 必读规则**（相关性 ≥ 0.8）：高度相关，必须参考
- **⭐ 参考规则**（相关性 0.5-0.8）：中等相关，按需参考

### 3. 智能应用原则

- **上下文优先**：优先应用用户明确提到的技术栈规则
- **渐进式应用**：先应用高相关性规则，再参考中等相关性规则
- **灵活调整**：根据实际情况综合应用多个任务类型的规则
- **显式说明**：在回复中说明应用了哪些规则

## 🚀 使用方式

### 方式 1：无任务过滤（推荐新手）

```bash
npm run build:scripts
node scripts/dist/codebuddy-loader.js
```

生成包含所有规则的 project-rules.md，AI 模型会根据用户请求自动识别任务类型并激活相关规则。

### 方式 2：任务过滤（推荐进阶）

```bash
# 重构任务
node scripts/dist/codebuddy-loader.js --task refactoring

# 调试任务
node scripts/dist/codebuddy-loader.js --task debugging --threshold 0.7

# 新功能开发
node scripts/dist/codebuddy-loader.js --task new-feature --threshold 0.5
```

**生成的文件包含**：
- 智能规则激活系统章节（针对该任务类型）
- 过滤后的相关规则（相关性 ≥ threshold）
- 更精简的内容，减少 token 消耗

**适用场景**：
- 明确知道任务类型
- 希望减少 token 消耗
- 需要更聚焦的规则集

> 说明：当前版本不支持 `--detail-level`，如需更精简的输出，建议通过 `--task` + `--threshold` 控制规则集范围。

## 📌 实际使用示例

### 示例 1：重构任务

**场景**：需要重构一个 Vue 3 组件

**命令**：
```bash
node scripts/dist/codebuddy-loader.js --task refactoring --threshold 0.8
```

**生成的规则集**：
- 🔥 Layer 1: architecture/feature-based-structure (0.90)
- 🔥 Layer 1: vue3/vue3-script-setup (0.90)
- 🔥 Layer 1: typescript/strict-types (0.85)
- 🔥 Layer 3: refactoring (1.00)
- ⭐ Layer 3: self-verification (0.80)

**AI 模型行为**：
当用户说"重构这个组件"时，AI 会：
1. 识别任务类型：refactoring
2. 激活相关规则：架构规范、Vue 3 最佳实践、重构检查清单
3. 按照规则指导进行重构

### 示例 2：调试任务

**场景**：修复一个 TypeScript 类型错误

**命令**：
```bash
node scripts/dist/codebuddy-loader.js --task debugging --threshold 0.7
```

**生成的规则集**：
- 🔥 Layer 3: debugging (1.00)
- 🔥 Layer 1: typescript/strict-types (0.70)

**AI 模型行为**：
当用户说"这个函数报错了"时，AI 会：
1. 识别任务类型：debugging
2. 激活相关规则：调试检查清单、TypeScript 类型安全
3. 按照调试流程排查问题

### 示例 3：新功能开发

**场景**：实现一个用户登录表单

**命令**：
```bash
node scripts/dist/codebuddy-loader.js --task new-feature
```

**生成的规则集**：
- 🔥 Layer 1: architecture/feature-based-structure (0.95)
- 🔥 Layer 1: vue3/vue3-script-setup (0.95)
- 🔥 Layer 1: typescript/strict-types (0.90)
- 🔥 Layer 2: antdv (0.95) [如果检测到 ant-design-vue]
- ⭐ Layer 3: testing (0.60)
- ⭐ Layer 3: self-verification (0.70)

**AI 模型行为**：
当用户说"实现一个登录表单"时，AI 会：
1. 识别任务类型：new-feature
2. 激活相关规则：架构设计、Vue 3 组件、TypeScript 类型、UI 组件库
3. 按照最佳实践实现功能

## 🎓 与 Claude Code + Skills 的对比

| 特性 | Claude Code + Skills | 智能规则激活系统 |
|------|---------------------|-----------------|
| **动态激活** | ✅ 原生支持 | ✅ 通过提示词模拟 |
| **任务识别** | ✅ 自动识别 | ✅ 通过关键词识别 |
| **规则过滤** | ✅ 自动过滤 | ✅ 预过滤 + 动态选择 |
| **跨模型兼容** | ❌ 仅 Claude | ✅ 任意模型 |
| **配置驱动** | ❌ 固定格式 | ✅ 完全可配置 |
| **渐进式披露** | ⚠️ 有限支持 | ✅ 完整支持 |

## 🔧 配置说明

### 任务类型配置

在 `config/loader-config.json` 中定义任务类型：

```json
{
  "tasks": {
    "definitions": {
      "refactoring": {
        "name": "重构",
        "description": "代码重构、优化、清理技术债务",
        "aliases": ["refactor", "optimize", "cleanup"]
      }
    }
  }
}
```

### 规则相关性配置

为每个规则定义与任务类型的相关性分数（0-1）：

```json
{
  "tasks": {
    "ruleRelevance": {
      "layer1_base": {
        "architecture/feature-based-structure": {
          "refactoring": 0.9,
          "new-feature": 0.95,
          "debugging": 0.3
        }
      }
    }
  }
}
```

## 💡 最佳实践

### 1. 选择合适的任务类型

- **明确任务**：使用 `--task` 参数预过滤规则
- **不确定任务**：不使用 `--task`，让 AI 自动判断
- **复杂任务**：可能需要多次运行，针对不同子任务

### 2. 调整相关性阈值

- **严格过滤**：`--threshold 0.7`（只加载高相关性规则）
- **标准过滤**：`--threshold 0.5`（默认，平衡精简和完整）
- **宽松过滤**：`--threshold 0.3`（加载更多规则）

### 3. 控制详略级别

当前版本不支持 `--detail-level`。建议通过提高 `--threshold` 来减少规则数量，并用 `--task` 聚焦任务场景。

### 4. 组合使用

```bash
# 重构任务 + 严格过滤
node scripts/dist/codebuddy-loader.js --task refactoring --threshold 0.7

# 新功能 + 标准过滤
node scripts/dist/codebuddy-loader.js --task new-feature --threshold 0.5
```

## 🚨 注意事项

1. **不要机械应用所有规则**：AI 模型应根据任务类型选择性应用规则
2. **保持灵活性**：用户需求可能不完全符合某个任务类型
3. **优先用户意图**：如果用户明确要求某种方式，优先遵循用户意图
4. **持续优化**：根据实际使用效果调整相关性配置

## 📊 效果对比

### 传统方式（无智能激活）

**问题**：
- AI 模型被动接收所有规则
- 不知道何时应用哪些规则
- 容易信息过载
- 回复不够聚焦

### 智能激活方式

**优势**：
- AI 模型主动识别任务类型
- 动态选择相关规则
- 避免信息过载
- 回复更加聚焦和专业

## 🎯 总结

智能规则激活系统通过在生成的 project-rules.md 中添加**元提示词**，让 CodeBuddy 能够像 Claude Code + Skills 那样动态激活规则。这个系统：

- ✅ **向后兼容**：不破坏现有功能
- ✅ **跨模型兼容**：适用于任意 AI 模型
- ✅ **配置驱动**：完全可定制
- ✅ **易于使用**：无需修改 CodeBuddy

通过这个系统，你可以让任意 AI 模型（GPT、Gemini、Claude 等）都能像 Claude Code + Skills 那样智能地应用规则！
