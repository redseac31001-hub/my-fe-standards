# Architect Rule Loader (前端架构师规则库)

这是一个标准化的前端专家规则库，旨在作为 **CodeBuddy** 等 AI 编程助手的知识源 (Context Source)。
通过维护一系列高质量、结构化的 `.md` 规则文件，我们确保 AI 助手在辅助编码时能够遵循团队的最佳实践、设计模式和代码规范。

## 🎯 核心目标

*   **统一规范**: 确保所有团队成员（及 AI 助手）产出的代码风格一致。
*   **最佳实践**: 内置 Vue 3 + TypeScript 生态的架构师级建议。
*   **知识沉淀**: 将团队的隐性知识转化为显性的 Markdown 文档。

## 📂 目录结构（三层架构）

本规则库采用 **分层规则引擎** 设计，将规则按职责划分为三层：

```text
rules/
├── _meta/                 # 📋 元信息 (不被加载到项目)
│   └── rule-template.md   #    规则编写模板
│
├── layer1_base/           # 🧱 基础层 - 通用技术标准
│   ├── architecture/      #    架构规范 (目录结构等)
│   ├── typescript/        #    TypeScript 类型安全规范
│   ├── vue3/              #    Vue 3 最佳实践 (Script Setup)
│   └── vue2/              #    Vue 2 兼容规则 (Options API)
│
├── layer2_business/       # 🏢 业务层 - 项目特定规范
│   └── tdesign.md         #    TDesign UI 库使用规范
│
└── layer3_action/         # ⚡ 动作层 - 任务型检查清单
    ├── refactoring.md     #    重构检查清单
    ├── debugging.md       #    调试检查清单
    └── testing.md         #    测试策略
```

### 三层职责说明

| 层级 | 加载条件 | 内容 |
|------|----------|------|
| **Layer 1 (Base)** | 自动加载 | 通用的 Vue/TS/架构规范，根据项目 Vue 版本自动分流 |
| **Layer 2 (Business)** | 检测到特定依赖时加载 | 如检测到 `tdesign-vue-next`，则加载 TDesign 规范 |
| **Layer 3 (Action)** | 始终加载 | 供 AI Agent 根据用户任务（重构/调试/测试）调用 |

## 🛠️ 自动化工具 (Rule Loader v3)

本仓库提供了一个自动化脚本，能够：
- 扫描目标项目的 `package.json` 依赖
- **智能检测 Vue 2/Vue 3** 并加载对应规则
- 按三层架构拼装规则文件

**使用方法:**

1.  克隆本仓库到本地。
2.  在您的业务项目中运行以下命令（假设本仓库路径为 `E:/mygit/my-fe-standards`）：

```bash
node E:/mygit/my-fe-standards/scripts/rule-loader.js .
```

脚本将会在您的项目目录下生成 `.codebuddy/project-rules.md`。CodeBuddy 代码助手会自动读取此文件作为编程上下文。

## 🚀 如何使用 (For CodeBuddy)

在 VSCode 中使用 CodeBuddy 时，可以通过配置将本仓库的 `rules` 目录添加为上下文来源，或者在 Prompt 中引用特定的规则文件。

**例如：**
> "Refactor this component following the rules in @rules/layer1_base/vue3/vue3-script-setup.md"

## 📝 规则编写指南

请参考 `rules/_meta/rule-template.md` 编写新的规则。每条规则应包含：
1.  **Context**: 适用场景。
2.  **The Rule**: 具体的规范描述。
3.  **Reasoning**: 背后的原理（帮助 AI 理解权衡）。
4.  **Examples**: 正面 (✅) 与反面 (❌) 的代码示例。
