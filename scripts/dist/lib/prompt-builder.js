"use strict";
/**
 * 提示词生成模块
 *
 * 将加载的规则、技能、Agent 等数据组装为 CodeBuddy 可消费的提示词文本
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWorkflowsPrompt = generateWorkflowsPrompt;
exports.generateTaskBooksPrompt = generateTaskBooksPrompt;
exports.generateAgentCallsPrompt = generateAgentCallsPrompt;
exports.generateCommandsPrompt = generateCommandsPrompt;
exports.generateCommandsReadme = generateCommandsReadme;
exports.generateScriptsReadme = generateScriptsReadme;
exports.generateScriptsPrompt = generateScriptsPrompt;
exports.generateQuickActionGuide = generateQuickActionGuide;
exports.generateAgentsPrompt = generateAgentsPrompt;
exports.generateSkillsPrompt = generateSkillsPrompt;
exports.generateRuleActivationPrompt = generateRuleActivationPrompt;
exports.generateWorkspacePrompt = generateWorkspacePrompt;
function summarizeHintItems(values, maxItems = 2) {
    if (!values || values.length === 0)
        return null;
    const uniqueValues = [...new Set(values.map(value => value.trim()).filter(Boolean))];
    if (uniqueValues.length === 0)
        return null;
    if (uniqueValues.length <= maxItems)
        return uniqueValues.join(', ');
    return `${uniqueValues.slice(0, maxItems).join(', ')} +${uniqueValues.length - maxItems}`;
}
function buildSkillHint(skill) {
    const parts = [];
    const tools = summarizeHintItems(skill.tools);
    const related = summarizeHintItems(skill.related);
    const languages = summarizeHintItems(skill.languages);
    const frameworks = summarizeHintItems(skill.frameworks);
    const roles = summarizeHintItems(skill.roles);
    if (tools)
        parts.push(`tools: ${tools}`);
    if (related)
        parts.push(`related: ${related}`);
    if (languages)
        parts.push(`langs: ${languages}`);
    if (frameworks)
        parts.push(`stacks: ${frameworks}`);
    if (roles)
        parts.push(`roles: ${roles}`);
    if (skill.workspaceScope && skill.workspaceScope !== 'both')
        parts.push(`scope: ${skill.workspaceScope}`);
    return parts.length > 0 ? parts.join('; ') : '-';
}
function generateWorkflowsPrompt(workflows) {
    if (workflows.length === 0)
        return '';
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
function generateTaskBooksPrompt(files) {
    if (files.length === 0)
        return '';
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
function generateAgentCallsPrompt(files) {
    if (files.length === 0)
        return '';
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
function getCommandPromptEntry(cmd) {
    const commandName = cmd.replace(/\.md$/, '');
    const path = `.codebuddy/commands/${cmd}`;
    if (cmd === 'task.md') {
        return {
            command: '/task',
            path,
            description: '端到端计划任务编排',
            example: '/task 实现用户登录功能',
        };
    }
    if (cmd === 'agent-call.md') {
        return {
            command: '/agent-call',
            path,
            description: '执行 Agent Call 并写回 result.json',
            example: '/agent-call req-20260204-xxxxxx',
        };
    }
    return {
        command: `/${commandName}`,
        path,
        description: '-',
        example: `/${commandName}`,
    };
}
function getScriptPromptEntry(script) {
    const path = `.codebuddy/scripts/${script}`;
    if (script === 'structure-analyzer.js') {
        return {
            file: script,
            path,
            description: '项目结构分析器',
            usage: `node ${path} .`,
        };
    }
    if (script === 'module-mapper.js') {
        return {
            file: script,
            path,
            description: '模块图谱分析器',
            usage: `node ${path} .`,
        };
    }
    if (script === 'report-manager.js') {
        return {
            file: script,
            path,
            description: '报告管理器',
            usage: `node ${path} status`,
        };
    }
    if (script === 'task-intake-router.js') {
        return {
            file: script,
            path,
            description: '任务入口判断器（直执行 vs 编排）',
            usage: `node ${path} --description "replace mock login API" --files 4 --contract explicit`,
        };
    }
    if (script === 'agent-call-manager.js') {
        return {
            file: script,
            path,
            description: 'Agent Call 管理器（list/show/validate）',
            usage: `node ${path} list`,
        };
    }
    if (script === 'task-orchestrator.js') {
        return {
            file: script,
            path,
            description: '一键闭环执行器（创建/规划/执行/验收）',
            usage: `node ${path} "实现用户登录" --type new-feature`,
        };
    }
    if (script === 'contract-validator.js') {
        return {
            file: script,
            path,
            description: '契约校验器（TaskBook/Workflow）',
            usage: `node ${path} --workflows --taskbooks`,
        };
    }
    return {
        file: script,
        path,
        description: '-',
        usage: `node ${path}`,
    };
}
function buildCommandsTable(commands) {
    const entries = commands
        .map(getCommandPromptEntry)
        .sort((a, b) => a.command.localeCompare(b.command));
    let table = '| 命令 | 路径 | 说明 | 示例 |\n|------|------|------|------|\n';
    for (const entry of entries) {
        table += `| \`${entry.command}\` | \`${entry.path}\` | ${entry.description} | \`${entry.example}\` |\n`;
    }
    return table;
}
function buildScriptsTable(scripts) {
    const entries = scripts
        .map(getScriptPromptEntry)
        .sort((a, b) => a.file.localeCompare(b.file));
    let table = '| 脚本 | 路径 | 说明 | 用法 |\n|------|------|------|------|\n';
    for (const entry of entries) {
        table += `| \`${entry.file}\` | \`${entry.path}\` | ${entry.description} | \`${entry.usage}\` |\n`;
    }
    return table;
}
function formatCodeList(values) {
    return values.map(value => `\`${value}\``).join('、');
}
function buildCommandsSummaryTable(commands) {
    const entries = commands
        .map(getCommandPromptEntry)
        .sort((a, b) => a.command.localeCompare(b.command));
    let table = '| 场景 | 首选入口 | 说明 |\n|------|----------|------|\n';
    for (const entry of entries) {
        table += `| ${entry.description} | \`${entry.example}\` | 详情见 \`${entry.path}\` |\n`;
    }
    return table;
}
function buildScriptPromptGroups(scripts) {
    const scriptSet = new Set(scripts);
    const consumed = new Set();
    const groups = [];
    const addGroup = (title, summary, entry, files) => {
        const present = files.filter(file => scriptSet.has(file));
        if (present.length === 0)
            return;
        for (const file of present) {
            consumed.add(file);
        }
        groups.push({
            title,
            summary,
            entry,
            files: present,
        });
    };
    addGroup('任务入口判断', '任务边界不明显时，先判断是直执行还是进入编排', 'node .codebuddy/scripts/task-intake-router.js --description "replace mock login API" --files 4 --contract explicit', ['task-intake-router.js']);
    addGroup('结构分析', '先生成结构和模块边界，再决定是否继续深挖', 'node .codebuddy/scripts/structure-analyzer.js .', ['structure-analyzer.js', 'module-mapper.js']);
    addGroup('报告查询', '优先复用已有报告，避免重复扫描', 'node .codebuddy/scripts/report-manager.js status', ['report-manager.js']);
    addGroup('规则与契约校验', '规则、技能、TaskBook/Workflow 变更前先校验', 'node .codebuddy/scripts/contract-validator.js --workflows --taskbooks', ['rule-validator.js', 'skill-validator.js', 'validator-gate.js', 'contract-validator.js', 'agent-registry.js']);
    addGroup('编排执行', '需要完整任务闭环时走编排入口', 'node .codebuddy/scripts/task-orchestrator.js "实现用户登录" --type new-feature', ['task-orchestrator.js', 'taskbook-manager.js', 'task-executor.js']);
    addGroup('Agent Call 与上下文', '处理外部执行、上下文采集和结果写回', 'node .codebuddy/scripts/agent-call-manager.js list', ['agent-call-manager.js', 'reference-finder.js', 'context-collector.js']);
    const remaining = [...scripts]
        .filter(file => !consumed.has(file))
        .sort((a, b) => a.localeCompare(b));
    if (remaining.length > 0) {
        groups.push({
            title: '其他入口',
            summary: '仅在上述入口不匹配时再按需读取',
            entry: `node .codebuddy/scripts/${remaining[0]}`,
            files: remaining,
        });
    }
    return groups;
}
function buildScriptsSummaryTable(scripts) {
    const groups = buildScriptPromptGroups(scripts);
    let table = '| 场景 | 首选入口 | 覆盖脚本 |\n|------|----------|----------|\n';
    for (const group of groups) {
        table += `| ${group.title} | \`${group.entry}\` | ${formatCodeList(group.files)} |\n`;
    }
    return table;
}
function generateCommandsPrompt(commands) {
    if (commands.length === 0)
        return '';
    const entries = commands
        .map(getCommandPromptEntry)
        .sort((a, b) => a.command.localeCompare(b.command));
    const installedCommands = formatCodeList(entries.map(entry => entry.command));
    const installedFiles = formatCodeList(entries.map(entry => entry.path));
    return `
# 📋 Slash Commands 索引

本规则库只保留少量高频命令作为短入口；详细参数和完整说明已外迁到 \`.codebuddy/commands/README.md\`。

## 快速入口

${buildCommandsSummaryTable(commands)}

已安装命令：${installedCommands}

命令文件：${installedFiles}

先读 README，再按需打开对应命令文件，不要一次性扫读全部 command 说明。
`;
}
function generateCommandsReadme(commands) {
    const table = buildCommandsTable(commands);
    return [
        '# CodeBuddy Slash Commands',
        '',
        '> 自动生成，请勿手动编辑',
        '',
        '## 产品入口',
        '',
        '优先按下面四条路径理解当前安装，而不是先扫完整命令表：',
        '',
        '1. 安装 / 同步 / 诊断：先看 `.codebuddy/scripts/README.md` 里的 `codebuddy-loader.js` 入口。',
        '2. 启动闭环：需求、缺陷、重构优先走 `/task`。',
        '3. 接管 / 写回：需要处理 `.codebuddy/agent-calls/*.prompt.md` 时，使用 `/agent-call`。',
        '4. 观察 / 汇报：报告与趋势优先走 `.codebuddy/scripts/report-manager.js`。',
        '',
        '## 已安装命令',
        '',
        table.trimEnd(),
        '',
        '## 快速入口',
        '',
        '- 业务需求、重构、缺陷修复：优先使用 `/task`，详细说明见 `task.md`。',
        '- 需要执行 `.codebuddy/agent-calls/*.prompt.md`：使用 `/agent-call`，详细说明见 `agent-call.md`。',
        '',
        '## 推荐阅读顺序',
        '',
        '1. 先看本 README 确认入口。',
        '2. 再按需读取对应命令文件，避免一次性扫读全部说明。',
    ].join('\n');
}
function generateScriptsReadme(scripts) {
    const table = buildScriptsTable(scripts);
    return [
        '# CodeBuddy 工具脚本',
        '',
        '> 自动生成，请勿手动编辑',
        '',
        '## 产品入口',
        '',
        '优先把脚本理解成四类入口：',
        '',
        '### 1. 安装 / 同步 / 诊断',
        '',
        '```bash',
        'node .codebuddy/scripts/codebuddy-loader.js',
        'node .codebuddy/scripts/codebuddy-loader.js status',
        'node .codebuddy/scripts/codebuddy-loader.js doctor --json',
        '```',
        '',
        '### 2. 启动闭环',
        '',
        '```bash',
        'node .codebuddy/scripts/task-intake-router.js --description "replace mock login API" --files 4 --contract explicit',
        'node .codebuddy/scripts/task-orchestrator.js "实现用户登录" --type new-feature',
        'node .codebuddy/scripts/task-orchestrator.js --taskbook <taskBookId> --show-workflow-route --json',
        '```',
        '',
        '### 3. 接管 / 继续执行',
        '',
        '```bash',
        'node .codebuddy/scripts/taskbook-manager.js show <taskBookId>',
        'node .codebuddy/scripts/task-executor.js <taskBookId>',
        'node .codebuddy/scripts/task-executor.js <taskBookId> --workflow auto --show-workflow-route',
        '```',
        '',
        '### 4. 观察 / 汇报',
        '',
        '```bash',
        'node .codebuddy/scripts/report-manager.js status',
        'node .codebuddy/scripts/report-manager.js export',
        'node .codebuddy/scripts/report-manager.js hotspots --top 10',
        '```',
        '',
        '## 已安装脚本',
        '',
        table.trimEnd(),
        '',
        '## 常用场景',
        '',
        '### 结构分析',
        '',
        '```bash',
        'node .codebuddy/scripts/structure-analyzer.js .',
        'node .codebuddy/scripts/structure-analyzer.js . --output json',
        '```',
        '',
        '### 查看分析报告',
        '',
        '```bash',
        'node .codebuddy/scripts/report-manager.js status',
        'node .codebuddy/scripts/report-manager.js inspect --module "src/features/user"',
        '```',
        '',
        '### 编排 / 契约校验',
        '',
        '```bash',
        'node .codebuddy/scripts/task-intake-router.js --description "replace mock login API" --files 4 --contract explicit',
        'node .codebuddy/scripts/contract-validator.js --workflows --taskbooks',
        'node .codebuddy/scripts/task-orchestrator.js "实现用户登录" --type new-feature',
        '```',
        '',
        '报告默认写入 `.codebuddy/reports/`，优先复用已有分析结果，再决定是否重跑脚本。',
    ].join('\n');
}
function generateScriptsPrompt(scripts) {
    if (scripts.length === 0)
        return '';
    const sortedScripts = [...scripts].sort((a, b) => a.localeCompare(b));
    return `
# 🔧 工具脚本索引 (Scripts Index)

本规则库的脚本细节已外迁到 \`.codebuddy/scripts/README.md\`；这里仅保留高频入口和能力分组。

## 快速入口

${buildScriptsSummaryTable(sortedScripts)}

已安装脚本：${formatCodeList(sortedScripts)}

分析类脚本默认把结果写入 \`.codebuddy/reports/\`。优先先看 README，再按需读取具体脚本帮助。
`;
}
function generateQuickActionGuide() {
    return `
## ⚡ 快速行动指引

| 场景 | 优先动作 | 入口 |
|------|----------|------|
| 新功能 / 重构 / 缺陷修复 | 走任务闭环，不要手工跳步骤 | \`/task <需求>\` |
| 需要理解项目结构 | 先做结构分析，再读相关规则/代码 | \`node .codebuddy/scripts/structure-analyzer.js .\` |
| 需要查看已有分析结果 | 先查报告状态，避免重复扫描 | \`node .codebuddy/scripts/report-manager.js status\` |
| 需要生成系统概要设计 / 设计文档 | 优先路由到专用设计文档 Agent，再按需加载 skill 和模板 | \`system-overview-writer\` |
| 需要执行外部 Agent Call | 读取 prompt，写回 result.json | \`/agent-call <requestId>\` |
| 需要校验 TaskBook / Workflow 契约 | 先跑契约校验 | \`node .codebuddy/scripts/contract-validator.js --workflows --taskbooks\` |
| 需要细节规范 | 按需读取缓存规则，不要全文扫读全部规则 | \`.codebuddy/rules_cache/\` |

优先读短入口：\`.codebuddy/scripts/README.md\`、\`.codebuddy/commands/README.md\`、\`.codebuddy/rules_cache/\`。
`;
}
const ORCHESTRATION_ROUTE_KEYWORDS = [
    'orchestrator',
    'planner',
    'tdd',
    '\u7f16\u6392',
    '\u89c4\u5212',
    '\u4ea4\u4ed8',
];
const DOCUMENTATION_ROUTE_KEYWORDS = [
    'overview',
    'design',
    'documentation',
    'document',
    '\u6982\u8981\u8bbe\u8ba1',
    '\u8bbe\u8ba1\u6587\u6863',
    '\u6587\u6863\u751f\u6210',
    '\u65b9\u6848\u8f93\u51fa',
    'word',
];
const DIAGNOSIS_ROUTE_KEYWORDS = [
    'build',
    'bug',
    'fix',
    'debug',
    'investigator',
    'profiler',
    '\u4fee\u590d',
    '\u6392\u67e5',
    '\u8bca\u65ad',
    '\u6784\u5efa',
    '\u6027\u80fd',
];
const REVIEW_ROUTE_KEYWORDS = [
    'review',
    'security',
    'structure',
    'analyzer',
    '\u5ba1\u67e5',
    '\u67b6\u6784',
    '\u5b89\u5168',
];
const QUALITY_SKILL_ROUTE_KEYWORDS = [
    'review',
    'testing',
    'a11y',
    'i18n',
    'wcag',
    '\u65e0\u969c\u788d',
];
const IMPLEMENTATION_SKILL_ROUTE_KEYWORDS = [
    'component',
    'state',
    'refactor',
    '\u91cd\u6784',
    'store',
];
const DOCUMENTATION_SKILL_ROUTE_KEYWORDS = [
    'system-overview',
    'design-document',
    'overview design',
    '\u6982\u8981\u8bbe\u8ba1',
    '\u8bbe\u8ba1\u6587\u6863',
    'word \u6a21\u677f',
];
function truncateText(value, max = 48) {
    if (value.length <= max)
        return value;
    return `${value.slice(0, max - 1).trimEnd()}...`;
}
function includesAnyKeyword(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
}
function summarizeRouteTriggers(triggers, maxItems = 3) {
    const values = [...new Set((triggers || []).map(trigger => trigger.trim()).filter(Boolean))];
    if (values.length === 0)
        return '-';
    const formatted = values.slice(0, maxItems).map(trigger => `\`${trigger}\``).join(', ');
    return values.length > maxItems ? `${formatted} +${values.length - maxItems}` : formatted;
}
function formatRouteIds(ids) {
    return ids.map(id => `\`${id}\``).join(', ');
}
function buildAgentHint(agent) {
    const parts = [];
    if (agent.relatedSkills && agent.relatedSkills.length > 0) {
        parts.push(`skills ${agent.relatedSkills.length}`);
    }
    if (agent.relatedRules && agent.relatedRules.length > 0) {
        parts.push(`rules ${agent.relatedRules.length}`);
    }
    if (agent.permissions.length > 0) {
        parts.push(`tools ${Math.min(agent.permissions.length, 3)}+`);
    }
    return parts.length > 0 ? parts.join(' / ') : '-';
}
function classifyAgentRouteCategory(agent) {
    const text = `${agent.id} ${agent.name} ${agent.description}`.toLowerCase();
    if (includesAnyKeyword(text, ORCHESTRATION_ROUTE_KEYWORDS)) {
        return 'orchestration';
    }
    if (includesAnyKeyword(text, DOCUMENTATION_ROUTE_KEYWORDS)) {
        return 'documentation';
    }
    if (includesAnyKeyword(text, DIAGNOSIS_ROUTE_KEYWORDS)) {
        return 'diagnosis';
    }
    if (includesAnyKeyword(text, REVIEW_ROUTE_KEYWORDS)) {
        return 'review';
    }
    return 'other';
}
function groupAgentsByScenario(agents) {
    const groups = [
        {
            key: 'orchestration',
            title: '计划与执行',
            signal: '多文件、多步骤、需要规划/实现/验收闭环',
            items: [],
        },
        {
            key: 'documentation',
            title: '文档与设计',
            signal: '系统概要设计、设计方案、正式设计文档输出',
            items: [],
        },
        {
            key: 'diagnosis',
            title: '诊断与修复',
            signal: '构建失败、运行时报错、根因排查、性能异常',
            items: [],
        },
        {
            key: 'review',
            title: '分析与审查',
            signal: '结构分析、代码审查、安全检查、专项评估',
            items: [],
        },
        {
            key: 'other',
            title: '其他',
            signal: '未落入以上场景的专用 Agent',
            items: [],
        },
    ];
    for (const agent of [...agents].sort((a, b) => a.id.localeCompare(b.id))) {
        const group = groups.find(item => item.key === classifyAgentRouteCategory(agent));
        group === null || group === void 0 ? void 0 : group.items.push(agent);
    }
    return groups.filter(group => group.items.length > 0);
}
function classifySkillRouteCategory(skill) {
    const text = `${skill.id} ${skill.name} ${skill.description}`.toLowerCase();
    if (/(structure|module|architecture)/.test(text)) {
        return 'architecture';
    }
    if (includesAnyKeyword(text, IMPLEMENTATION_SKILL_ROUTE_KEYWORDS)) {
        return 'implementation';
    }
    if (includesAnyKeyword(text, QUALITY_SKILL_ROUTE_KEYWORDS)) {
        return 'quality';
    }
    if (/(performance|build|render|bundle)/.test(text)) {
        return 'performance';
    }
    if (includesAnyKeyword(text, DOCUMENTATION_SKILL_ROUTE_KEYWORDS)) {
        return 'documentation';
    }
    if (/(prd|ralph|skill-creator|requirements|spec)/.test(text)) {
        return 'workflow';
    }
    return 'other';
}
function groupSkillsByScenario(skills) {
    const groups = [
        {
            key: 'architecture',
            title: '架构与分析',
            signal: '项目结构、目录治理、模块关系、架构健康度',
            items: [],
        },
        {
            key: 'implementation',
            title: '实现与重构',
            signal: '组件拆分、状态管理、具体代码改造',
            items: [],
        },
        {
            key: 'quality',
            title: '质量与体验',
            signal: '代码审查、测试、国际化、可访问性',
            items: [],
        },
        {
            key: 'performance',
            title: '性能与构建',
            signal: '渲染性能、包体积、构建速度、配置优化',
            items: [],
        },
        {
            key: 'documentation',
            title: '文档与设计',
            signal: '概要设计、设计文档、模板驱动导出',
            items: [],
        },
        {
            key: 'workflow',
            title: '产品与流程',
            signal: 'PRD、格式转换、技能定义与维护',
            items: [],
        },
        {
            key: 'other',
            title: '其他',
            signal: '未落入以上场景的专用 Skill',
            items: [],
        },
    ];
    for (const skill of [...skills].sort((a, b) => a.id.localeCompare(b.id))) {
        const group = groups.find(item => item.key === classifySkillRouteCategory(skill));
        group === null || group === void 0 ? void 0 : group.items.push(skill);
    }
    return groups.filter(group => group.items.length > 0);
}
function generateAgentsPrompt(agents, agentsRootDir = '.codebuddy/agents') {
    if (agents.length === 0)
        return '';
    const groups = groupAgentsByScenario(agents);
    let routeTable = '| 场景 | 判断信号 | 优先 Agent |\n|------|----------|------------|\n';
    for (const group of groups) {
        routeTable += `| ${group.title} | ${group.signal} | ${formatRouteIds(group.items.map(agent => agent.id))} |\n`;
    }
    let groupSections = '';
    for (const group of groups) {
        let table = '| Agent | 何时使用 | 入口提示 | 补充 |\n|-------|----------|----------|------|\n';
        for (const agent of group.items) {
            table += `| \`${agent.id}\` | ${truncateText(agent.description)} | ${summarizeRouteTriggers(agent.triggers, 2)} | ${buildAgentHint(agent)} |\n`;
        }
        groupSections += `### ${group.title}\n\n${table}\n`;
    }
    return `
# 🤖 Agent 与 Skill 统一调度指南

本规则库支持 **Agent 执行模式** 和 **Skill 知识模式**。优先按任务规模判断，再按场景分类路由。

## 第一步：判断任务规模

| 任务规模 | 处理方式 |
|----------|----------|
| 多文件、多步骤、需要规划/执行/验收 | 进入【第二步：Agent 分类路由】 |
| 单文件、单组件、单次具体操作 | 进入【第三步：Skill 分类路由】 |
| 纯概念问答或简单语法说明 | 不加载 Agent/Skill，直接基于规则回答 |

## 第二步：Agent 分类路由（多步骤流程）

${routeTable}

Agent 文件已下载至 \`${agentsRootDir}/\`。

> **以当前规则文件中的 Agent 表和 \`.codebuddy/install.json\` 为准。** 若目录中同时存在历史 snapshot，请只读取这里列出的 active root。

命中某个场景后，再按需读取对应 \`${agentsRootDir}/<agent-id>/AGENT.md\`，不要先把所有 Agent 全文扫一遍。

## 已安装 Agents（按场景分组）

${groupSections}

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
function generateSkillsPrompt(skills, skillsRootDir = '.codebuddy/skills') {
    if (skills.length === 0)
        return '';
    const groups = groupSkillsByScenario(skills);
    let routeTable = '| 场景 | 判断信号 | 优先 Skill |\n|------|----------|------------|\n';
    for (const group of groups) {
        routeTable += `| ${group.title} | ${group.signal} | ${formatRouteIds(group.items.map(skill => skill.id))} |\n`;
    }
    let groupSections = '';
    for (const group of groups) {
        let table = '| Skill | 何时使用 | 入口提示 | Hints |\n|-------|----------|----------|-------|\n';
        for (const skill of group.items) {
            table += `| \`${skill.id}\` | ${truncateText(skill.description)} | ${summarizeRouteTriggers(skill.triggers, 2)} | ${buildSkillHint(skill)} |\n`;
        }
        groupSections += `### ${group.title}\n\n${table}\n`;
    }
    return `
## 第三步：Skill 分类路由（单次操作）

技能文件已下载至 \`${skillsRootDir}/\`。

> **以当前规则文件中的技能表和 \`.codebuddy/install.json\` 为准。** 若目录中同时存在历史 snapshot，请只读取这里列出的 active root。

> **Skill 是知识源，不是执行者。** 如果任务需要多步骤自主流程，请回到第二步使用 Agent。

${routeTable}

命中某个场景后，再按需读取 \`${skillsRootDir}/<技能ID>/SKILL.md\` 与相关 \`references/\`，避免一次性加载全部技能。

## 已安装技能（按场景分组）

${groupSections}

## ⚠️ 何时不需要加载技能

- 概念性问题（"computed 和 watch 有什么区别?"）
- 简单语法问题（"Vue 3 怎么定义 Props?"）
- 通用最佳实践咨询

**仅当用户请求执行具体操作时**才触发技能加载。
`;
}
function generateRuleActivationPrompt(_config) {
    let table = '| 任务类型 | 关键词 | 重点规则 |\n|---------|--------|--------|\n';
    table += '| 重构 | refactor, optimize, cleanup | Layer1 架构规范 + Layer3 重构检查清单 |\n';
    table += '| **调试/Bug修复** | debug, fix, bugfix, 报错, 排查 | Layer3 调试清单 + **上下文管理** + TypeScript 类型规范 |\n';
    table += '| 新功能 | feature, implement, add | Layer1 全部 + Layer2 UI 库规范 |\n';
    table += '| 测试 | test, unit-test, e2e | Layer3 测试策略 |\n';
    table += '| 代码审查 | review, pr | Layer3 自检清单 |\n';
    table += '| **大规模改动** | refactor entire, 重构模块, 系统重构 | Layer3 上下文管理 + 重构检查清单 |\n';
    return `
# 🎯 规则激活指南

根据用户请求类型，参考以下规则：

${table}

**重要**: 当需要查看规则详情时，使用 \`read_file\` 工具读取 \`.codebuddy/rules_cache/\` 下的对应文件。
`;
}
function generateWorkspacePrompt(workspaceInfo) {
    var _a;
    if (workspaceInfo.totalProjectCount <= 1)
        return '';
    const { projects } = workspaceInfo;
    const scopeNote = workspaceInfo.scope === 'project-targeted' && workspaceInfo.selectedProject
        ? `当前以 \`project-targeted\` 模式锁定 \`${workspaceInfo.selectedProject}\`（workspace 总计 ${workspaceInfo.totalProjectCount} 个项目）。`
        : `当前以 \`workspace-union\` 模式聚合 ${workspaceInfo.totalProjectCount} 个项目。`;
    // 项目索引表
    let indexTable = '| 项目名称 | 路径前缀 | 语言 | 框架 | UI 库 | Vue 版本 | 规则缓存路径 |\n';
    indexTable += '|---------|---------|------|------|-------|---------|-------------|\n';
    for (const p of projects) {
        const vueVer = p.vueProfile ? `v${p.vueProfile.version}` : '-';
        const uiLibs = p.uiLibLabels.length > 0 ? p.uiLibLabels.join(', ') : '-';
        const cachePath = p.relativePath === '.'
            ? '`.codebuddy/rules_cache/layer2_business/`'
            : `\`.codebuddy/rules_cache/projects/${p.relativePath}/layer2_business/\``;
        indexTable += `| ${p.name} | \`${p.relativePath}/\` | ${p.lang} | ${p.frameworkLabel || '-'} | ${uiLibs} | ${vueVer} | ${cachePath} |\n`;
    }
    // 路由规则（按路径长度从深到浅排列）
    const sortedProjects = [...projects]
        .filter(p => p.relativePath !== '.')
        .sort((a, b) => b.relativePath.length - a.relativePath.length);
    let routingRules = '';
    for (const p of sortedProjects) {
        const label = [p.lang, p.frameworkLabel, ...p.uiLibLabels].filter(Boolean).join(' + ') || '通用';
        routingRules += `├─ 路径以 \`${p.relativePath}/\` 开头？ → 应用 **${p.name}** 的规则（${label}）\n`;
    }
    // 根项目（relativePath === '.'）
    const rootProject = projects.find(p => p.relativePath === '.');
    if (rootProject) {
        const rootLabel = [rootProject.frameworkLabel, ...rootProject.uiLibLabels].filter(Boolean).join(' + ') || '通用';
        routingRules += `└─ 其他路径 → 应用 **${rootProject.name}** 根项目规则（${rootLabel}）\n`;
    }
    else {
        routingRules += `└─ 其他路径 → 使用通用规则（无根项目 package.json）\n`;
    }
    // 示例路径路由（取第一个非根项目）
    const exampleProject = sortedProjects[0];
    let routingExample = '';
    if (exampleProject) {
        routingExample = `
### 路由示例

当用户编辑 \`${exampleProject.relativePath}/src/App.vue\` 时：

1. 获取文件相对路径：\`${exampleProject.relativePath}/src/App.vue\`
2. 匹配路径前缀：\`${exampleProject.relativePath}/\` → **${exampleProject.name}**
3. 加载对应 Layer2 规则缓存：\`.codebuddy/rules_cache/projects/${exampleProject.relativePath}/layer2_business/\`
4. 应用技术栈约定：${exampleProject.frameworkLabel || '通用'}${exampleProject.uiLibLabels.length > 0 ? ' + ' + exampleProject.uiLibLabels.join(' + ') : ''}
`;
    }
    // 禁止混用警告
    const hasVue2 = projects.some(p => { var _a; return ((_a = p.vueProfile) === null || _a === void 0 ? void 0 : _a.version) === 2; });
    const hasVue3 = projects.some(p => { var _a; return ((_a = p.vueProfile) === null || _a === void 0 ? void 0 : _a.version) === 3; });
    let mixWarning = '';
    if (hasVue2 && hasVue3) {
        mixWarning = `
### ⚠️ 跨项目技术栈隔离警告

本 Workspace 同时包含 Vue 2 和 Vue 3 项目，**严禁混用**：

- **Vue 2 项目**禁止使用：\`<script setup>\`、\`defineProps()\`、\`defineEmits()\`
- **Vue 3 项目**禁止使用：Options API（\`data()\`、\`methods\`、\`computed\`）、\`this.$refs\`
- 编辑文件前**必须**先确认所属项目，再应用对应版本的规范
`;
    }
    // 生成快捷定位项目列表
    let projectList = '';
    for (const p of projects) {
        const techStack = [p.frameworkLabel, ...p.uiLibLabels].filter(Boolean).join(' + ') || '-';
        // 别名：取最后一段路径作为短名，加上项目名本身
        const shortName = p.relativePath === '.' ? '根项目' : p.relativePath.split('/').pop();
        const aliases = [p.name, shortName, p.relativePath].filter((v, i, a) => a.indexOf(v) === i);
        projectList += `| **${p.name}** | \`${p.relativePath}\` | ${p.lang} | ${techStack} | ${aliases.map(a => `\`${a}\``).join(', ')} |\n`;
    }
    return `
# 🏢 Workspace 多项目路由

本目录为 **Workspace 模式**，包含 ${projects.length} 个子项目。编辑文件时必须先判断所属项目，再应用对应规则。

> ${scopeNote}

## 🎯 快捷项目定位

在对话消息中使用 \`@project <名称>\` 可快速锁定当前操作的目标项目，后续操作将自动应用该项目的技术栈规则。

### 用法

\`\`\`
@project <项目名称|路径前缀|别名>
<你的需求描述>
\`\`\`

### 示例

\`\`\`
@project ${((_a = sortedProjects[0]) === null || _a === void 0 ? void 0 : _a.name) || projects[0].name}
帮我添加一个新的列表页

@project ${projects.length > 1 ? projects[1].name : projects[0].name}
检查登录逻辑有没有问题
\`\`\`

### 可用项目列表

| 项目名称 | 路径 | 语言 | 框架 | 可用别名 |
|---------|------|------|------|---------|
${projectList}

### 匹配规则

1. **精确匹配**：优先匹配项目名称或路径前缀
2. **模糊匹配**：输入的名称是项目名/路径的子串时自动匹配（如 \`@project mobile\` 可匹配 \`app-mobile\`）
3. **歧义处理**：如果匹配到多个项目，请使用更具体的名称或完整路径

### 行为约定

- 指定 \`@project\` 后，**本轮对话**中所有文件操作默认限定在该项目目录下
- 引用文件路径时自动补全项目路径前缀
- 应用该项目对应的 Layer2 规则缓存
- 未指定 \`@project\` 时，按文件路径自动路由（见下方路由规则）

## 项目索引

${indexTable}

## 路径路由规则

获取当前操作文件相对于 Workspace 根目录的路径，按以下规则从上到下匹配（最具体的路径优先）：

\`\`\`
${routingRules}\`\`\`

### 路由判定步骤

1. 获取当前文件相对于 Workspace 根目录的路径
2. 按路径前缀从上到下匹配（最长匹配优先）
3. 加载匹配项目的 Layer2 规则缓存
4. 应用对应技术栈的编码约定
${routingExample}${mixWarning}
**重要**: 每个子项目的 Layer2 规则缓存独立存放在 \`.codebuddy/rules_cache/projects/{项目路径}/layer2_business/\` 下。
`;
}
