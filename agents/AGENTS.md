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
| `security-reviewer` | 安全审查 | XSS/CSRF/OWASP 检测 | "安全审查"、"security"、"xss" |
| `performance-profiler` | 性能分析 | Lighthouse/Web Vitals 诊断 | "性能分析"、"performance"、"lighthouse" |
| `planner` | 任务规划 | 复杂任务分解与风险评估 | "规划"、"plan"、"任务分解" |

## Agent 调用流程

```
用户请求 → 意图识别 → 读取 AGENT.md → 执行工作流 → 生成报告
```

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
├── security-reviewer/           # 安全审查 Agent
│   ├── AGENT.md                 # Agent 定义文件
│   ├── checklists/              # 检测清单
│   └── templates/               # 报告模板
├── performance-profiler/        # 性能分析 Agent
│   ├── AGENT.md
│   ├── metrics/                 # 性能指标说明
│   └── templates/
└── planner/                     # 任务规划 Agent
    ├── AGENT.md
    ├── frameworks/              # 规划框架
    └── templates/
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

- `security-reviewer` → `layer3_action/defensive-coding.md`
- `performance-profiler` → `layer3_action/self-verification.md`
- `planner` → `layer3_action/refactoring.md`, `layer3_action/testing.md`

---

**版本**: 1.0.0
**更新日期**: 2026-01-25
