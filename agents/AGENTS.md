# 🤖 Agent 系统

> 本目录包含前端开发专用 Agent，用于自动化执行特定领域的复杂任务。

## Agent 与 Skill 的区别

| 维度 | Agent | Skill |
|------|-------|-------|
| **定位** | 独立决策执行者 | 知识包/工具集 |
| **触发方式** | 被外部调度或用户直接调用 | 被 Agent/AI 按需加载 |
| **执行模式** | 完整工作流，可调用多个 Skills | 提供知识和模板 |
| **状态管理** | 可维护执行状态 | 无状态 |
| **输出** | 完整报告/执行结果 | 知识上下文 |

## 已安装 Agents

| Agent | 名称 | 职责 | 触发场景 |
|-------|------|------|----------|
| `task-orchestrator` | 任务编排 | 端到端计划任务执行与验收 | "规划任务"、"帮我实现"、"/task" |
| `structure-analyzer` | 结构分析 | 目录反模式检测、健康度评分 | "结构分析"、"目录审查"、"架构检查" |
| `security-reviewer` | 安全审查 | XSS/CSRF/OWASP 检测 | "安全审查"、"security"、"xss" |
| `performance-profiler` | 性能分析 | Lighthouse/Web Vitals 诊断 | "性能分析"、"performance"、"lighthouse" |
| `planner` | 任务规划 | 复杂任务分解与风险评估（仅规划，不编码） | "帮我规划"、"规划"、"plan"、"任务分解"、"方案对比" |
| `tdd-driver` | TDD 驱动 | RED→GREEN→REFACTOR 循环驱动实现 | "TDD"、"测试驱动"、"test first" |
| `build-fix` | 构建修复 | 自动诊断修复构建/类型/Lint 错误 | "构建失败"、"build failed"、"类型错误" |
| `code-reviewer` | 代码审查 | 按 clean-code 规则结构化审查 | "代码审查"、"code review"、"CR" |
| `bug-investigator` | Bug 调查 | 运行时 bug 分层定位、依赖图裁剪、根因分析 | "修复bug"、"排查问题"、"报错"、"不生效" |
| `system-overview-writer` | 概要设计文档生成 | 自动完成需求分析、项目上下文分析并基于官方模板生成系统概要设计文档 | "系统概要设计"、"概要设计文档"、"生成概要设计"、"设计方案" |

## Agent 调用流程

### 手动模式（传统）
```
用户请求 → 意图识别 → 读取 AGENT.md → 执行工作流 → 生成报告
```

### 自动模式（AgentRuntime, v1.0.0）
```
TaskExecutor → AgentRuntime.loadAll() → 扫描 agents/*/AGENT.md
                                       ↓
                        TaskItem → selectAgent(taskType)
                                       ↓
                        AgentRuntime.invoke() → renderPrompt()
                                       ↓
                        生成高质量 prompt → MANUAL_REQUIRED 协议
                                       ↓
                        外部 AI 工具消费 prompt → 执行任务
```

> **AgentRuntime** 自动加载所有 Agent 定义（YAML frontmatter + prompts/ 模板），
> 根据任务类型智能匹配 Agent 并渲染上下文感知的 prompt。
> 支持 **并行调度**（`maxParallelTasks: 2`），无冲突的任务可同时执行。

### 调用示例

当用户请求匹配 Agent 触发场景时：

1. **识别意图**：分析用户请求是否匹配表格中的触发场景
2. **读取 Agent**：调用 `read_file` 工具读取 `.codebuddy/agents/<Agent ID>/AGENT.md`
3. **执行工作流**：根据 AGENT.md 中定义的工作流执行任务
4. **加载资源**：按需读取 checklists/、metrics/、frameworks/ 等子目录资源
5. **生成报告**：使用 templates/ 目录中的模板输出结果

## Agent 目录结构

```
agents/
├── AGENTS.md                    # 本文件 - Agent 系统说明
├── task-orchestrator/           # 任务编排 Agent
│   ├── AGENT.md                 # Agent 定义文件
│   └── templates/               # TaskBook 和验收报告模板
├── structure-analyzer/          # 结构分析 Agent
│   ├── AGENT.md                 # Agent 定义文件
│   ├── checklists/              # 检测清单
│   └── templates/               # 报告模板
├── security-reviewer/           # 安全审查 Agent
│   ├── AGENT.md                 # Agent 定义文件
│   ├── checklists/              # 检测清单
│   └── templates/               # 报告模板
├── performance-profiler/        # 性能分析 Agent
│   ├── AGENT.md
│   ├── metrics/                 # 性能指标说明
│   └── templates/
├── planner/                     # 任务规划 Agent
│   ├── AGENT.md
│   ├── frameworks/              # 规划框架
│   └── templates/
├── tdd-driver/                  # TDD 驱动 Agent
│   ├── AGENT.md
│   └── prompts/                 # 弱模型引导模板
│       ├── red.md               # RED 阶段 prompt
│       ├── green.md             # GREEN 阶段 prompt
│       └── refactor.md          # REFACTOR 阶段 prompt
├── build-fix/                   # 构建修复 Agent
│   ├── AGENT.md
│   └── prompts/
│       └── diagnose-fix.md      # 诊断修复 prompt
├── code-reviewer/               # 代码审查 Agent
│   ├── AGENT.md
│   └── prompts/
│       └── review.md            # 审查 prompt
├── system-overview-writer/      # 概要设计文档生成 Agent
│   ├── AGENT.md
│   └── prompts/
│       └── execute.md           # 概要设计生成 prompt
└── bug-investigator/            # Bug 调查 Agent
    ├── AGENT.md
    └── prompts/
        └── investigate.md       # 调查 prompt
```

## AGENT.md 规范

每个 Agent 的 AGENT.md 文件必须包含：

```yaml
---
name: agent-id
version: 1.0.0
description: Agent 描述
triggers:
  - "触发词1"
  - "触发词2"
permissions:
  tools:
    - read_file
    - grep_search
  skills:
    - related-skill
---

# Agent 名称

## 职责范围
...

## 工作流程
...

## 检测规则/执行步骤
...

## 输出格式
...
```

## 与规则系统集成

Agent 可以关联 Layer3 Action 规则：

- `task-orchestrator` → 协调 `planner`, `tdd-driver`, `code-reviewer` 执行完整任务
- `structure-analyzer` → `layer1_base/architecture/feature-based-structure.md`
- `security-reviewer` → `layer3_action/defensive-coding.md`
- `performance-profiler` → `layer3_action/self-verification.md`
- `planner` → `layer3_action/refactoring.md`, `layer3_action/testing.md`
- `tdd-driver` → `layer3_action/testing.md`, `layer1_base/code-quality/clean-code.md`
- `build-fix` → `layer1_base/typescript/strict-types.md`
- `code-reviewer` → `layer1_base/code-quality/clean-code.md`, `layer3_action/defensive-coding.md`
- `bug-investigator` → `layer3_action/debugging.md`, `layer3_action/context-management.md`
- `system-overview-writer` → `layer3_action/system-design-documentation.md`, `layer3_action/context-management.md`, `layer3_action/self-verification.md`

---

**版本**: 2.1.0
**更新日期**: 2026-03-10
