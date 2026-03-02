/**
 * 提示词生成模块
 *
 * 将加载的规则、技能、Agent 等数据组装为 CodeBuddy 可消费的提示词文本
 */

import { SkillMetadata, AgentMetadata, LoaderConfig } from '../types';

export function generateWorkflowsPrompt(workflows: string[]): string {
  if (workflows.length === 0) return '';

  const workflowFiles = workflows
    .filter(f => f.endsWith('.workflow.json'))
    .sort((a, b) => a.localeCompare(b));

  const schemaFiles = workflows
    .filter(f => f.endsWith('.schema.json'))
    .sort((a, b) => a.localeCompare(b));

  let table = '| 文件 | 路径 | 说明 |\n|------|------|------|\n';
  for (const wf of workflowFiles) {
    table += `| \`${wf}\` | \`.codebuddy/workflows/${wf}\` | Workflow Spec |\n`;
  }
  for (const s of schemaFiles) {
    table += `| \`${s}\` | \`.codebuddy/workflows/${s}\` | JSON Schema |\n`;
  }

  return `
# 🧭 Workflows（工作流规范）

本项目包含 **Workflow Spec**（工作流规范），用于描述"步骤依赖（DAG）+ 产物（artifacts）+ 质量闸门（gates）+ 策略（policies）"。

> 早期：可作为 Agent 的执行约束与引导；后期：可由执行引擎按规范编排并强制 gates。

## 已安装文件

${table}

## 使用约定（强建议）

1. 在创建/执行 TaskBook 前，先读取 \`.codebuddy/workflows/default.workflow.json\`。
2. 每个 step 都需要产出可验证的 artifact（例如报告、测试结果、变更说明），并写回 TaskBook 的 \`actualWork\` / 报告目录。
3. gates 失败必须进入 \`blocked\` 并记录原因，直到人工确认继续/跳过。
`;
}

export function generateTaskBooksPrompt(files: string[]): string {
  if (files.length === 0) return '';

  let table = '| 文件 | 路径 | 说明 |\n|------|------|------|\n';
  for (const f of files.sort((a, b) => a.localeCompare(b))) {
    table += `| \`${f}\` | \`.codebuddy/taskbooks/${f}\` | TaskBook Contract |\n`;
  }

  return `
# 📒 TaskBook（任务书契约）

TaskBook 是任务协作的 **唯一事实源（SSOT）**：规划、执行、产出、验收都应以 \`.codebuddy/taskbooks/active/*.json\` 为准。

## 已安装文件

${table}

## 使用约定（强建议）

1. 所有任务状态变更必须写回 TaskBook（避免"口头完成"）。
2. 每个任务的可验证产出（报告/测试结果/变更说明）应记录到 \`actualWork\` 或报告目录，并在 TaskBook 中引用。
3. gates 失败必须进入 \`blocked\` 并记录原因，直到人工确认继续/跳过。
`;
}

export function generateAgentCallsPrompt(files: string[]): string {
  if (files.length === 0) return '';

  const schemaFiles = files
    .filter(f => f.endsWith('.schema.json'))
    .sort((a, b) => a.localeCompare(b));

  let table = '| 文件 | 路径 | 说明 |\n|------|------|------|\n';
  for (const f of schemaFiles) {
    table += `| \`${f}\` | \`.codebuddy/agent-calls/${f}\` | JSON Schema |\n`;
  }

  return `
# 🧩 Agent Calls（文件协议）
本规则库支持 **Agent Call 文件协议**：\`.codebuddy/agent-calls/<requestId>.prompt.md\` ⇄ \`.result.json\`。
> 用于把「外部模型/工具执行」与「本地 CLI 状态机」解耦，实现可审计、可恢复的闭环。
## 已安装文件
${table}
`;
}

export function generateCommandsPrompt(commands: string[]): string {
  if (commands.length === 0) return '';

  let table = '| 命令 | 说明 | 触发方式 |\n|------|------|----------|\n';
  for (const cmd of commands) {
    if (cmd === 'task.md') {
      table += `| \`/task\` | 端到端计划任务编排 | \`/task 实现用户登录功能\` 或 "帮我实现xxx" |\n`;
    } else {
      const cmdName = cmd.replace('.md', '');
      table += `| \`/${cmdName}\` | - | \`/${cmdName}\` |\n`;
    }
  }

  return `
# 📋 Slash Commands 索引

本规则库包含可执行的 Slash Commands，已安装至 \`.codebuddy/commands/\`。

## 已安装命令

${table}

## 🚀 /task 命令使用指南

\`/task\` 是端到端的计划任务编排命令，支持：

### 触发方式

\`\`\`bash
# Slash Command 方式
/task 实现用户登录功能
/task 重构订单处理模块

# 关键词自动触发
帮我实现商品搜索功能
开发用户中心模块
重构购物车逻辑
\`\`\`

### 工作流程

\`\`\`
意图识别 → 上下文收集 → 需求分解 → 用户确认 → 自动执行 → 变更追踪 → 验收闭环
\`\`\`

### 核心特性

- **并行执行**: 无依赖任务自动并行，提升效率
- **变更追踪**: 实时记录偏离原计划的改动及原因
- **阻塞处理**: 遇到阻塞暂停，等待用户介入
- **验收闭环**: 生成验收报告，请求最终确认
- **任务持久化**: TaskBook 可恢复，支持中断继续

### TaskBook 存储

\`\`\`
.codebuddy/taskbooks/
├── active/      # 进行中的任务书
└── history/     # 已完成的任务书
\`\`\`

**详细使用说明**: 请读取 \`.codebuddy/commands/task.md\`
`;
}

export function generateScriptsReadme(scripts: string[]): string {
  const lines: string[] = [
    '# CodeBuddy 工具脚本',
    '',
    '> 自动生成，请勿手动编辑',
    '',
    '## 已安装脚本',
    '',
    '| 脚本 | 说明 | 用法 |',
    '|------|------|------|',
  ];

  for (const script of scripts) {
    if (script === 'structure-analyzer.js') {
      lines.push(`| \`${script}\` | 项目结构分析器 | \`node .codebuddy/scripts/${script} .\` |`);
    } else if (script === 'agent-call-manager.js') {
      lines.push(`| \`${script}\` | Agent Call 管理器（list/show/validate） | \`node .codebuddy/scripts/${script} list\` |`);
    } else if (script === 'task-orchestrator.js') {
      lines.push(`| \`${script}\` | 一键闭环执行器（创建/规划/执行/验收） | \`node .codebuddy/scripts/${script} "实现用户登录" --type new-feature\` |`);
    } else if (script === 'contract-validator.js') {
      lines.push(`| \`${script}\` | 契约校验器（TaskBook/Workflow）| \`node .codebuddy/scripts/${script} --workflows --taskbooks\` |`);
    } else {
      lines.push(`| \`${script}\` | - | \`node .codebuddy/scripts/${script}\` |`);
    }
  }

  lines.push('');
  lines.push('## 使用示例');
  lines.push('');
  lines.push('### 项目结构分析');
  lines.push('');
  lines.push('```bash');
  lines.push('# 分析当前项目');
  lines.push('node .codebuddy/scripts/structure-analyzer.js .');
  lines.push('');
  lines.push('# 输出 JSON 格式');
  lines.push('node .codebuddy/scripts/structure-analyzer.js . --output json');
  lines.push('');
  lines.push('# 完整模式（含目录树）');
  lines.push('node .codebuddy/scripts/structure-analyzer.js . --mode full');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

export function generateScriptsPrompt(scripts: string[]): string {
  if (scripts.length === 0) return '';

  let table = '| 脚本 | 说明 | 用法 |\n|------|------|------|\n';
  for (const script of scripts) {
    if (script === 'structure-analyzer.js') {
      table += `| \`${script}\` | 项目结构分析器 | \`node .codebuddy/scripts/${script} .\` |\n`;
    } else if (script === 'module-mapper.js') {
      table += `| \`${script}\` | 模块图谱分析器 | \`node .codebuddy/scripts/${script} .\` |\n`;
    } else if (script === 'report-manager.js') {
      table += `| \`${script}\` | 报告管理器 | \`node .codebuddy/scripts/${script} status\` |\n`;
    } else if (script === 'agent-call-manager.js') {
      table += `| \`${script}\` | Agent Call 管理器（list/show/validate） | \`node .codebuddy/scripts/${script} list\` |\n`;
    } else if (script === 'task-orchestrator.js') {
      table += `| \`${script}\` | 一键闭环执行器（创建/规划/执行/验收） | \`node .codebuddy/scripts/${script} "实现用户登录" --type new-feature\` |\n`;
    } else if (script === 'contract-validator.js') {
      table += `| \`${script}\` | 契约校验器（TaskBook/Workflow）| \`node .codebuddy/scripts/${script} --workflows --taskbooks\` |\n`;
    } else {
      table += `| \`${script}\` | - | \`node .codebuddy/scripts/${script}\` |\n`;
    }
  }

  return `
# 🔧 工具脚本索引 (Scripts Index)

本规则库包含可执行脚本，已安装至 \`.codebuddy/scripts/\`。

## 已安装脚本

${table}

## 🚀 脚本调用指南 (CodeBuddy)

当用户请求执行结构分析、健康度检查等任务时，可以：

1. **直接调用脚本**（推荐）:
   \`\`\`bash
   node .codebuddy/scripts/structure-analyzer.js .
   \`\`\`

2. **或使用 MCP 工具**（如已配置）:
   \`\`\`
   analyze_project_structure({ projectPath: "." })
   \`\`\`

## 📊 报告系统 (Project Memory)

分析结果自动保存到 \`.codebuddy/reports/\` 目录：

\`\`\`
.codebuddy/reports/
├── manifest.json                 # 报告索引
├── architecture/latest.json      # 架构快照
├── modules/latest.json           # 模块图谱
└── health/timeline.json          # 健康度时间线
\`\`\`

### 报告管理命令

\`\`\`bash
# 查看报告状态
node .codebuddy/scripts/report-manager.js status

# 查询模块/文件（上下游/热点/趋势）
node .codebuddy/scripts/report-manager.js inspect --module "src/features/user"
node .codebuddy/scripts/report-manager.js inspect --file "src/features/user/index.ts"

# 热点模块列表
node .codebuddy/scripts/report-manager.js hotspots --top 10

# 导出 Markdown 报告
node .codebuddy/scripts/report-manager.js export

# 清理过期报告
node .codebuddy/scripts/report-manager.js cleanup
\`\`\`

### 报告复用

当报告存在且 < 24小时时，可直接读取 JSON 文件而无需重新分析：
- 架构快照: \`.codebuddy/reports/architecture/latest.json\`
- 模块图谱: \`.codebuddy/reports/modules/latest.json\`

## 脚本与 Skill/Agent 的关系

| 组件 | 职责 | 位置 |
|------|------|------|
| **脚本** | 实际执行逻辑 | \`.codebuddy/scripts/\` |
| **Skill** | 知识上下文 | \`.codebuddy/skills/\` |
| **Agent** | 工作流定义 | \`.codebuddy/agents/\` |
| **Reports** | 项目记忆 | \`.codebuddy/reports/\` |

**调用链**: Skill/Agent 提供知识 → 脚本执行分析 → Reports 持久化 → 后续任务复用
`;
}

export function generateAgentsPrompt(agents: AgentMetadata[]): string {
  if (agents.length === 0) return '';

  // 生成 Agent 详情列表（包含工作流程摘要）
  let agentDetails = '';
  for (const agent of agents) {
    const triggerText = agent.triggers.join(', ');
    agentDetails += `### ${agent.name} (\`${agent.id}\`)\n\n`;
    agentDetails += `- **描述**: ${agent.description}\n`;
    agentDetails += `- **触发词**: ${triggerText}\n`;

    if (agent.workflowSummary) {
      agentDetails += `\n${agent.workflowSummary}\n`;
    }
    agentDetails += '\n';
  }

  // 动态生成决策树节点（从 Agent 元数据）
  let decisionNodes = '';
  for (const agent of agents) {
    if (agent.triggers.length === 0) continue;
    const triggerList = agent.triggers.join('/');
    decisionNodes += `├─ 包含"${triggerList}"？\n`;
    decisionNodes += `│  └─ YES → ${agent.id}（${agent.description}）\n│\n`;
  }
  decisionNodes += `└─ 以上均不匹配？\n`;
  decisionNodes += `   └─ 回退到【第三步：Skill 决策树】`;

  // 从 agents 中提取所有触发词和隐式模式，动态生成第一步判断依据
  const orchestratorKeywords: string[] = [];
  for (const agent of agents) {
    // 收集显式触发词（去除 /command 格式的）
    for (const t of agent.triggers) {
      if (!t.startsWith('/') && !t.startsWith('plan ') && !t.startsWith('create ')) {
        orchestratorKeywords.push(t);
      }
    }
    // 收集隐式触发模式中的关键词
    if (agent.implicitTriggers) {
      for (const it of agent.implicitTriggers) {
        // 从 pattern 中提取中文关键词，如 "帮我实现.*功能" -> "帮我实现...功能"
        const cleaned = it.pattern.replace(/\.\*/g, '').replace(/[\\^$|?+()[\]{}]/g, '');
        if (cleaned.length > 0) {
          orchestratorKeywords.push(cleaned);
        }
      }
    }
  }
  // 去重
  const uniqueKeywords = [...new Set(orchestratorKeywords)];
  const keywordHints = uniqueKeywords.length > 0
    ? uniqueKeywords.map(k => `"${k}"`).join('/')
    : '"规划/计划/帮我实现/帮我规划/开发"';

  return `
# 🤖 Agent 与 Skill 统一调度指南

本规则库支持 **Agent 执行模式** 和 **Skill 知识模式**。收到用户请求后，按以下决策树从上到下判断。

## 第一步：判断任务规模

\`\`\`
用户请求
│
├─ 是否涉及多文件、多步骤、需要规划+实现+审查？
│  │  判断依据：
│  │  - 提到"整个模块/系统/功能"（非单个文件/组件）
│  │  - 包含 ${keywordHints}
│  │  - 需要先设计再编码再测试
│  │
│  ├─ YES → 进入【第二步：Agent 决策树】
│  └─ NO（单文件/单组件/单次操作）→ 进入【第三步：Skill 决策树】
\`\`\`

## 第二步：Agent 决策树（多步骤流程）

命中即停，不再继续匹配：

\`\`\`
${decisionNodes}
\`\`\`

**Agent 调用步骤**:
1. 调用 \`read_file\` 读取 \`.codebuddy/agents/<agent-id>/AGENT.md\`
2. 严格按 AGENT.md 中定义的步骤顺序执行，不可跳过
3. 合并结果输出完整报告

## 已安装 Agents 详情

${agentDetails}

## Agent 与 Skill 的区别

| 维度 | Agent（执行者） | Skill（知识源） |
|------|----------------|----------------|
| **定位** | 独立决策执行者，驱动完整流程 | 知识包/参考文档，提供上下文 |
| **触发方式** | 多步骤流程（规划→实现→审查→修复） | 单次具体操作（审查一段代码、重构一个组件） |
| **执行模式** | 按 AGENT.md 工作流自主执行 | 读取 SKILL.md 后由 AI 执行 |
| **典型场景** | "帮我规划并实现登录功能" | "帮我重构这个组件" |
| **输出** | 完整交付物（代码+测试+报告） | 知识引导下的单次操作 |
`;
}

export function generateSkillsPrompt(skills: SkillMetadata[]): string {
  if (skills.length === 0) return '';

  let table = '| 技能名称 | 技能 ID | 触发场景 |\n|---------|---------|----------|\n';
  for (const skill of skills) {
    table += `| **${skill.name}** | \`${skill.id}\` | ${skill.description} |\n`;
  }

  // 动态生成决策树节点（从 Skill 元数据）
  let decisionNodes = '';
  for (const skill of skills) {
    if (skill.triggers.length === 0) continue;
    const triggerList = skill.triggers.join('/');
    decisionNodes += `├─ 包含"${triggerList}"？\n`;
    decisionNodes += `│  └─ YES → ${skill.id}（${skill.name}）\n│\n`;
  }
  decisionNodes += `└─ 以上均不匹配？\n`;
  decisionNodes += `   └─ 不加载技能，直接基于规则回答`;

  return `
## 第三步：Skill 决策树（单次操作）

技能文件已下载至 \`.codebuddy/skills/\`。

> **Skill 是知识源，不是执行者。** 如果任务需要多步骤自主流程，请回到第二步使用 Agent。

命中即停，不再继续匹配：

\`\`\`
${decisionNodes}
\`\`\`

**Skill 调用步骤**:
1. 调用 \`read_file\` 读取 \`.codebuddy/skills/<技能ID>/SKILL.md\`
2. 根据 SKILL.md 中的路由逻辑，读取 \`references/\` 下的相关文档
3. 基于完整上下文执行用户任务

## 已安装技能一览

${table}

## ⚠️ 何时不需要加载技能

- 概念性问题（"computed 和 watch 有什么区别?"）
- 简单语法问题（"Vue 3 怎么定义 Props?"）
- 通用最佳实践咨询

**仅当用户请求执行具体操作时**才触发技能加载。
`;
}

export function generateRuleActivationPrompt(_config: LoaderConfig): string {
  let table = '| 任务类型 | 关键词 | 重点规则 |\n|---------|--------|--------|\n';
  table += '| 重构 | refactor, optimize, cleanup | Layer1 架构规范 + Layer3 重构检查清单 |\n';
  table += '| 调试 | debug, fix, bugfix | Layer3 调试检查清单 + TypeScript 类型规范 |\n';
  table += '| 新功能 | feature, implement, add | Layer1 全部 + Layer2 UI 库规范 |\n';
  table += '| 测试 | test, unit-test, e2e | Layer3 测试策略 |\n';
  table += '| 代码审查 | review, pr | Layer3 自检清单 |\n';

  return `
# 🎯 规则激活指南

根据用户请求类型，参考以下规则：

${table}

**重要**: 当需要查看规则详情时，使用 \`read_file\` 工具读取 \`.codebuddy/rules_cache/\` 下的对应文件。
`;
}
