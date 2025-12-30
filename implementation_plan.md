# Implementation Plan - 前端架构师规则加载器 (Architect Rule Loader)

我们将设计并初始化 `my-fe-standards` 仓库，使其成为一个标准化的前端规则专家库。这个库将包含一系列针对 Vue 和 TypeScript 项目的高质量 `.md` 规则模板，旨在被 CodeBuddy 代码助手插件读取和使用，以辅助开发者编写规范代码。

## 目标
1.  **建立标准目录结构**：清晰分类不同类型的规则（Vue, TS, 架构等）。
2.  **定义规则模板格式**：创建一套统一的 Markdown 模版，确保规则对 AI (CodeBuddy) 和人类都易于理解。
3.  **预置核心专家规则**：编写首批高质量的 Vue 3 + TypeScript 最佳实践规则。
4.  **提供集成指南**：在 README 中说明如何使用此规则库。

## 目录结构设计 (Proposed Structure)

```text
my-fe-standards/
├── README.md                   # 项目说明与集成指南
├── .codebuddy/                 # (可选) CodeBuddy 插件特定的配置或索引文件
│   └── context.md              # 全局上下文设定（告诉助手这是一个专家库）
├── rules/                      # 规则库核心目录
│   ├── 00_meta/                # 元规则（定义如何写规则）
│   │   └── rule-template.md    # 规则文件的标准模板
│   ├── 01_vue/                 # Vue 相关规则
│   │   ├── component-setup.md  # 推荐使用 script setup
│   │   └── naming-convention.md# 组件命名规范
│   ├── 02_typescript/          # TypeScript 相关规则
│   │   └── no-any.md           # 严禁使用 any
│   └── 03_architecture/        # 架构级规则
│       └── directory-structure.md # 推荐的目录结构
└── workflows/                  # (可选) 自动化脚本或工作流
```

## 规则格式规范 (Prompt Engineering)

为了让 CodeBuddy 更好地“理解”规则，我们将采用结构化的 Markdown 格式：

*   **Role (角色)**: 定义专家的视角。
*   **Context (背景)**: 适用场景。
*   **Critical Rules (核心准则)**: 必须遵守的条目。
*   **Code Examples (代码示例)**: 正面示例 (Positive) 和反面示例 (Negative)。

## 分层规则引擎设计 (Layered Rule Engine)

我们将规则库重构为三层结构，并在生成脚本中体现这一逻辑：

1.  **基础层 (Base Layer)**:
    *   通用技术栈规范 (TS, Vite)。
    *   **Vue 版本分流**:
        *   若 `vue@^3` -> 加载 `layer1_base/vue3` (Script Setup)。
        *   若 `vue@^2` -> 加载 `layer1_base/vue2` (Options API)。
    *   包含架构基础 `architecture`。
2.  **业务层 (Business Layer)**:
    *   特定 UI 库规范 (如 TDesign, Element Plus)。
    *   团队 API 请求规范、数据处理约定。
    *   **触发条件**: 检测到特定依赖 (e.g. `tdesign-vue-next`) 或手动配置。
3.  **动作层 (Action Layer)**:
    *   针对特定任务的 Checklists (如 Refactoring, Testing, Debugging)。
    *   **触发条件**: 总是加载，供 Agent 根据用户 Prompt 意图调用。

## 动态加载器增强 (Loader v2)
更新 `scripts/rule-loader.js` 以支持：
*   输出文件的分层 Markdown 结构 (`# Layer 1...`, `# Layer 2...`)。
*   支持从远程 Git 拉取规则 (伪代码/预留接口)。

## 下一步行动
1.  **Refactor**: 重组 `rules/` 目录结构为 `layer1_base`, `layer2_business`, `layer3_action`。
2.  **Logic**: 更新 `rule-loader.js` 实现分层拼装。
3.  **Prompt**: 更新 `.codebuddy/context.md` 定义架构师角色和三层思维模型。
4.  **Add Rules**: 新增 `tdesign` (业务层) 和 `refactoring` (动作层) 示例规则。
