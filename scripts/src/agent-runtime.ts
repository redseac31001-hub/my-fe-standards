/**
 * Agent Runtime — 子 Agent 自动加载与调用核心模块
 *
 * 职责:
 * - 扫描 agents/ 目录，加载所有 Agent 定义（AGENT.md + prompts/）
 * - 解析 Agent frontmatter / legacy YAML 元数据
 * - 渲染 prompt 模板（变量替换）
 * - 提供统一的 invoke() 调用接口
 *
 * 约束:
 * - 零外部依赖（仅 Node.js 内置模块 + 项目内共享解析工具）
 * - 不引入新的通信协议，复用现有 Agent Call 文件协议作为降级路径
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    LoadedAgent,
    AgentFrontmatter,
    AgentPermissions,
    AgentContext,
    AgentResult,
    AgentInvocation,
    AgentRuntimeConfig,
} from './types/agent-runtime';
import { AgentMetadata } from './types';
import {
    extractYamlScalar,
    extractYamlSection,
    listYamlKeys,
    parseYamlList,
    splitFrontmatterDocument,
} from './lib/frontmatter-utils';
import {
    getProjectRuleRootCandidatePaths,
    getProjectSkillRootCandidatePaths,
} from './lib/install-roots';

// ============ 日志工具 ============

let _verbose = false;

function rtLog(message: string): void {
    console.log(`[AgentRuntime] ${message}`);
}

function rtDebug(message: string): void {
    if (_verbose) console.log(`[AgentRuntime:DEBUG] ${message}`);
}

function rtWarn(message: string): void {
    console.warn(`[AgentRuntime:WARN] ${message}`);
}

// ============ Agent 元数据解析 ============

function normalizeAgentDocument(content: string): string {
    return content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

function extractFirstYamlCodeBlock(content: string): { yaml: string; body: string } | null {
    const normalized = normalizeAgentDocument(content);
    const match = normalized.match(/```ya?ml\s*\n([\s\S]*?)\n```\n?/);
    if (!match) return null;

    const start = match.index ?? 0;
    const body = `${normalized.slice(0, start)}${normalized.slice(start + match[0].length)}`.trimStart();
    return { yaml: match[1], body };
}

function parseOptionalVersion(yaml: string): string | undefined {
    const version = extractYamlScalar(yaml, 'version');
    if (!version || version === 'null') return undefined;
    return version;
}

function parseAgentFrontmatter(yaml: string): AgentFrontmatter | null {
    const name = extractYamlScalar(yaml, 'name');
    const description = extractYamlScalar(yaml, 'description');
    if (!name || !description) return null;

    const triggersBlock = extractYamlSection(yaml, 'triggers');
    const explicitTriggers = triggersBlock ? parseYamlList(triggersBlock, 'explicit', 2) : [];
    const plainTriggers = parseYamlList(yaml, 'triggers');
    const triggers = explicitTriggers.length > 0 ? explicitTriggers : plainTriggers;

    const permissionsBlock = extractYamlSection(yaml, 'permissions');
    const tools = permissionsBlock ? parseYamlList(permissionsBlock, 'tools', 2) : [];
    const skills = permissionsBlock ? parseYamlList(permissionsBlock, 'skills', 2) : [];
    const flatPermissions = parseYamlList(yaml, 'permissions');

    let permissions: AgentPermissions | undefined;
    if (tools.length > 0 || skills.length > 0) {
        permissions = {
            tools: tools.length > 0 ? tools : undefined,
            skills: skills.length > 0 ? skills : undefined,
        };
    } else if (flatPermissions.length > 0) {
        permissions = flatPermissions;
    }

    const dependenciesBlock = extractYamlSection(yaml, 'dependencies');
    let dependencies: Record<string, string[]> | undefined;
    if (dependenciesBlock) {
        const parsedDependencies: Record<string, string[]> = {};
        for (const key of listYamlKeys(dependenciesBlock, 2)) {
            const values = parseYamlList(dependenciesBlock, key, 2);
            if (values.length > 0) {
                parsedDependencies[key] = values;
            }
        }
        if (Object.keys(parsedDependencies).length > 0) {
            dependencies = parsedDependencies;
        }
    }

    return {
        name,
        description,
        version: parseOptionalVersion(yaml),
        triggers: triggers.length > 0 ? triggers : undefined,
        permissions,
        dependencies,
        model: extractYamlScalar(yaml, 'model'),
    };
}

type RuleCandidate = {
    kind: 'file' | 'directory';
    path: string;
};

const RULE_CACHE_LAYER_ROOTS: Record<string, string> = {
    layer1_base: 'layer1_reference',
    layer2_business: 'layer2_business',
    layer3_action: 'layer3_action',
};

function dedupeRuleCandidates(candidates: RuleCandidate[]): RuleCandidate[] {
    const seen = new Set<string>();
    const result: RuleCandidate[] = [];

    for (const candidate of candidates) {
        const normalizedPath = path.normalize(candidate.path);
        if (seen.has(normalizedPath)) continue;
        seen.add(normalizedPath);
        result.push(candidate);
    }

    return result;
}

function normalizeRuleName(ruleName: string): string {
    return ruleName.replace(/\\/g, '/').replace(/\.md$/i, '').replace(/^\/+|\/+$/g, '');
}

function findRuleFileByBasename(rootDir: string, fileName: string): string | null {
    if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
        return null;
    }

    const matches: string[] = [];
    const stack = [rootDir];

    while (stack.length > 0) {
        const currentDir = stack.pop()!;
        let entries: string[];

        try {
            entries = fs.readdirSync(currentDir);
        } catch {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry);
            let stat: fs.Stats;

            try {
                stat = fs.statSync(fullPath);
            } catch {
                continue;
            }

            if (stat.isDirectory()) {
                stack.push(fullPath);
                continue;
            }

            if (stat.isFile() && entry === fileName) {
                matches.push(fullPath);
            }
        }
    }

    if (matches.length === 0) {
        return null;
    }

    matches.sort((left, right) => {
        const leftSegments = left.split(path.sep).length;
        const rightSegments = right.split(path.sep).length;
        if (leftSegments !== rightSegments) return leftSegments - rightSegments;
        return left.localeCompare(right);
    });

    return matches[0];
}

function buildRuleCandidates(ruleRoot: string, layer: string, ruleName: string): RuleCandidate[] {
    const normalizedRuleName = normalizeRuleName(ruleName);
    const basename = path.posix.basename(normalizedRuleName);
    const fileName = `${basename}.md`;
    const isCacheRoot = path.basename(ruleRoot) === 'rules_cache';
    const baseRoot = isCacheRoot
        ? path.join(ruleRoot, RULE_CACHE_LAYER_ROOTS[layer] || layer)
        : path.join(ruleRoot, layer);

    const candidates: RuleCandidate[] = [
        {
            kind: 'directory',
            path: path.join(baseRoot, normalizedRuleName),
        },
        {
            kind: 'file',
            path: path.join(baseRoot, `${normalizedRuleName}.md`),
        },
    ];

    if (!normalizedRuleName.includes('/')) {
        const recursiveMatch = findRuleFileByBasename(baseRoot, fileName);
        if (recursiveMatch) {
            candidates.push({
                kind: 'file',
                path: recursiveMatch,
            });
        }
    }

    return dedupeRuleCandidates(candidates);
}

function formatIncomingHandoffs(context: AgentContext): string {
    const handoffs = context.task.incomingHandoffs ?? [];
    if (handoffs.length === 0) {
        return '(无上游 handoff)';
    }

    return handoffs.map((handoff, index) => {
        const lines = [
            `${index + 1}. ${handoff.sourceTaskId} ${handoff.sourceTaskTitle} [${handoff.sourceTaskType}] -> ${handoff.to} (${handoff.type})`,
            `   from: ${handoff.from}${handoff.sourceTaskExecutedBy ? ` / executedBy: ${handoff.sourceTaskExecutedBy}` : ''}`,
            `   status: ${handoff.sourceTaskStatus ?? 'unknown'} / at: ${handoff.timestamp}`,
        ];

        if (handoff.context) {
            lines.push(`   context: ${handoff.context}`);
        }

        if (handoff.deliverables && handoff.deliverables.length > 0) {
            lines.push(`   deliverables: ${handoff.deliverables.join(', ')}`);
        }

        return lines.join('\n');
    }).join('\n');
}

function buildIncomingHandoffSection(context: AgentContext): string {
    const handoffs = context.task.incomingHandoffs ?? [];
    if (handoffs.length === 0) {
        return '';
    }

    const handoffParts = handoffs.map((handoff, index) => {
        const lines = [
            `### Handoff ${index + 1}: ${handoff.sourceTaskTitle}`,
            '',
            `- Source Task: ${handoff.sourceTaskId} (${handoff.sourceTaskType})`,
            `- From: ${handoff.from}${handoff.sourceTaskExecutedBy ? ` / executedBy: ${handoff.sourceTaskExecutedBy}` : ''}`,
            `- Status: ${handoff.sourceTaskStatus ?? 'unknown'}`,
            `- Type: ${handoff.type}`,
            `- Timestamp: ${handoff.timestamp}`,
        ];

        if (handoff.context) {
            lines.push(`- Context: ${handoff.context}`);
        }

        if (handoff.deliverables && handoff.deliverables.length > 0) {
            lines.push(`- Deliverables: ${handoff.deliverables.join(', ')}`);
        }

        return lines.join('\n');
    });

    return [
        '## Incoming Handoffs',
        '',
        '> 以下是上游任务交接给当前 Agent 的最新上下文，请优先吸收这些信息。',
        '',
        ...handoffParts,
        '',
    ].join('\n');
}

// ============ 核心类 ============

/**
 * AgentRuntime — 子 Agent 加载与调用运行时
 */
export class AgentRuntime {
    private config: Required<Pick<AgentRuntimeConfig, 'projectRoot' | 'verbose'>> & AgentRuntimeConfig;
    private registry: Map<string, LoadedAgent> = new Map();
    private loaded = false;

    constructor(config: AgentRuntimeConfig) {
        this.config = {
            ...config,
            agentsDir: config.agentsDir || 'agents',
            verbose: config.verbose || false,
        };
        _verbose = this.config.verbose;
    }

    // ============ 加载 ============

    /**
     * 扫描并加载所有 Agent 定义
     */
    loadAll(): void {
        if (this.loaded) return;

        const searchDirs = [
            path.join(this.config.projectRoot, this.config.agentsDir || 'agents'),
        ];

        if (this.config.fallbackAgentsDir) {
            searchDirs.push(path.join(this.config.projectRoot, this.config.fallbackAgentsDir));
        }

        for (const dir of searchDirs) {
            if (!fs.existsSync(dir)) {
                rtDebug(`Agent 目录不存在，跳过: ${dir}`);
                continue;
            }

            const entries = fs.readdirSync(dir).filter(name => {
                const fullPath = path.join(dir, name);
                return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
            });

            for (const agentId of entries) {
                if (this.registry.has(agentId)) {
                    rtDebug(`Agent '${agentId}' 已注册，跳过重复`);
                    continue;
                }

                const agent = this.loadAgent(agentId, dir);
                if (agent) {
                    this.registry.set(agentId, agent);
                    rtDebug(`已加载 Agent: ${agentId} (${agent.metadata.description})`);
                }
            }
        }

        this.loaded = true;
        rtLog(`已加载 ${this.registry.size} 个 Agent`);
    }

    /**
     * 加载单个 Agent 定义
     */
    loadAgent(agentId: string, baseDir?: string): LoadedAgent | null {
        const dirs = baseDir
            ? [baseDir]
            : [
                path.join(this.config.projectRoot, this.config.agentsDir || 'agents'),
                ...(this.config.fallbackAgentsDir
                    ? [path.join(this.config.projectRoot, this.config.fallbackAgentsDir)]
                    : []),
            ];

        for (const dir of dirs) {
            const agentDir = path.join(dir, agentId);
            const agentMdPath = path.join(agentDir, 'AGENT.md');

            if (!fs.existsSync(agentMdPath)) continue;

            try {
                const content = fs.readFileSync(agentMdPath, 'utf-8');
                const parsedDocument = splitFrontmatterDocument(content);
                let metadata: AgentFrontmatter | null;
                let body: string;

                if (parsedDocument.ok) {
                    metadata = parseAgentFrontmatter(parsedDocument.frontmatter);
                    body = parsedDocument.body;
                    if (!metadata) {
                        rtWarn(`Agent '${agentId}': frontmatter 缺少必填字段 name/description`);
                        continue;
                    }
                } else {
                    const normalized = normalizeAgentDocument(content);
                    if (normalized.startsWith('---')) {
                        rtWarn(`Agent '${agentId}': ${parsedDocument.error}`);
                        continue;
                    }

                    const legacyDocument = extractFirstYamlCodeBlock(content);
                    if (!legacyDocument) {
                        rtWarn(`Agent '${agentId}': AGENT.md 缺少 frontmatter 或 legacy YAML metadata`);
                        continue;
                    }

                    metadata = parseAgentFrontmatter(legacyDocument.yaml);
                    body = legacyDocument.body;
                    if (!metadata) {
                        rtWarn(`Agent '${agentId}': legacy YAML metadata 缺少必填字段 name/description`);
                        continue;
                    }
                    rtDebug(`Agent '${agentId}' 使用 legacy YAML metadata 回退路径`);
                }

                // 加载 prompts/ 子目录
                const prompts: Record<string, string> = {};
                const promptsDir = path.join(agentDir, 'prompts');

                if (fs.existsSync(promptsDir) && fs.statSync(promptsDir).isDirectory()) {
                    const promptFiles = fs.readdirSync(promptsDir).filter(f => f.endsWith('.md'));
                    for (const file of promptFiles) {
                        const name = path.basename(file, '.md');
                        prompts[name] = fs.readFileSync(path.join(promptsDir, file), 'utf-8');
                    }
                }

                // 加载声明的 Skills 内容
                const skills = this.loadDeclaredSkills(metadata);

                // 加载声明的 Rules 内容
                const rules = this.loadDeclaredRules(metadata);

                return {
                    id: agentId,
                    definitionPath: agentMdPath,
                    metadata,
                    body,
                    prompts,
                    skills,
                    rules,
                };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                rtWarn(`Agent '${agentId}' 加载失败: ${msg}`);
            }
        }

        return null;
    }

    /**
     * 获取已注册的 Agent
     */
    getAgent(agentId: string): LoadedAgent | null {
        this.ensureLoaded();
        return this.registry.get(agentId) || null;
    }

    /**
     * 列出所有已注册 Agent 的元信息
     */
    listAgents(): AgentMetadata[] {
        this.ensureLoaded();
        const result: AgentMetadata[] = [];

        for (const [id, agent] of this.registry) {
            const triggers: string[] = [];
            if (agent.metadata.triggers) {
                triggers.push(...agent.metadata.triggers);
            }

            const permissions: string[] = [];
            let relatedSkills: string[] | undefined;
            if (agent.metadata.permissions) {
                if (Array.isArray(agent.metadata.permissions)) {
                    permissions.push(...agent.metadata.permissions);
                } else {
                    if (agent.metadata.permissions.tools) permissions.push(...agent.metadata.permissions.tools);
                    if (agent.metadata.permissions.skills?.length) {
                        relatedSkills = [...agent.metadata.permissions.skills];
                    }
                }
            }

            const relatedRules = agent.metadata.dependencies
                ? Object.values(agent.metadata.dependencies).flat()
                : undefined;

            result.push({
                id,
                name: agent.metadata.name,
                description: agent.metadata.description,
                triggers,
                permissions,
                relatedSkills,
                relatedRules: relatedRules && relatedRules.length > 0 ? relatedRules : undefined,
            });
        }

        return result;
    }

    // ============ Prompt 渲染 ============

    /**
     * 渲染 Agent prompt
     *
     * 将 Agent 定义 + prompts 模板 + 上下文合并为完整的可用 prompt
     */
    renderPrompt(agentId: string, context: AgentContext, promptKey?: string): string {
        this.ensureLoaded();
        const agent = this.registry.get(agentId);
        if (!agent) {
            throw new Error(`Agent '${agentId}' 未注册`);
        }

        // 选择 prompt 模板
        let template: string;
        if (promptKey && agent.prompts[promptKey]) {
            template = agent.prompts[promptKey];
        } else if (Object.keys(agent.prompts).length > 0) {
            // 根据任务类型智能选择 prompt
            const taskType = context.task.type;
            const promptMapping: Record<string, string> = {
                'test': 'red',
                'implement': 'green',
                'refactor': 'refactor',
                'review': 'review',
                'build-fix': 'diagnose-fix',
            };
            const autoKey = promptMapping[taskType];
            if (autoKey && agent.prompts[autoKey]) {
                template = agent.prompts[autoKey];
            } else {
                // 使用第一个可用的 prompt
                const firstKey = Object.keys(agent.prompts)[0];
                template = agent.prompts[firstKey];
            }
        } else {
            // 没有独立 prompt 文件，使用 AGENT.md body
            template = agent.body;
        }

        // 变量替换
        const vars = this.buildTemplateVariables(agent, context);
        let rendered = template;

        for (const [varName, varValue] of Object.entries(vars)) {
            // 支持 {{var}} 和 {{#each var}}...{{/each}} 简单循环
            const simplePattern = new RegExp(`\\{\\{\\s*${escapeRegex(varName)}\\s*\\}\\}`, 'g');
            rendered = rendered.replace(simplePattern, String(varValue));
        }

        // 处理 {{#each task.acceptanceCriteria}}...{{/each}} 循环标签
        rendered = rendered.replace(
            /\{\{#each\s+task\.acceptanceCriteria\}\}([\s\S]*?)\{\{\/each\}\}/g,
            (_match, body: string) => {
                return context.task.acceptanceCriteria
                    .map(criterion => body.replace(/\{\{\s*this\s*\}\}/g, criterion))
                    .join('');
            },
        );

        // 前置 Agent 角色说明
        const header = [
            `## Agent: ${agent.metadata.name}`,
            '',
            `> ${agent.metadata.description}`,
            `> TaskBook: ${context.taskBookId}`,
            `> Task: ${context.task.title} (${context.task.type})`,
            '',
        ].join('\n');

        const handoffSection = buildIncomingHandoffSection(context);

        // 注入 Skill 知识
        let skillSection = '';
        if (Object.keys(agent.skills).length > 0) {
            const skillParts = Object.entries(agent.skills).map(
                ([name, content]) => `### Skill: ${name}\n\n${content.slice(0, 3000)}`,
            );
            skillSection = [
                '## 参考知识: Skills (技能库)',
                '',
                '> 以下是与当前任务相关的 Skill 知识，请按照其中的最佳实践和模板执行任务。',
                '',
                ...skillParts,
                '',
            ].join('\n');
        }

        // 注入 Rule 知识
        let ruleSection = '';
        if (Object.keys(agent.rules).length > 0) {
            const ruleParts = Object.entries(agent.rules).map(
                ([name, content]) => `### Rule: ${name}\n\n${content.slice(0, 2000)}`,
            );
            ruleSection = [
                '## 参考知识: Rules (规范库)',
                '',
                '> 以下是与当前任务相关的编码规范，请严格遵守。',
                '',
                ...ruleParts,
                '',
            ].join('\n');
        }

        return header + handoffSection + skillSection + ruleSection + rendered;
    }

    /** 构建模板变量表 */
    private buildTemplateVariables(
        agent: LoadedAgent,
        context: AgentContext,
    ): Record<string, string> {
        const task = context.task;
        const vars: Record<string, string> = {
            'task.title': task.title,
            'task.type': task.type,
            'task.description': task.description || '',
            'task.id': task.id,
            'task.priority': task.priority || 'medium',
            'task.acceptanceCriteria': task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n'),
            'task.scope.files': task.scope?.files?.join(', ') || '(未指定)',
            'task.scope.modules': task.scope?.modules?.join(', ') || '(未指定)',
            'task.incomingHandoffs': formatIncomingHandoffs(context),
            'task.incomingHandoffCount': String(task.incomingHandoffs?.length ?? 0),
            'taskBook.id': context.taskBookId,
            'agent.name': agent.metadata.name,
            'agent.id': agent.id,
            'project.root': context.projectRoot,
            'project.testFramework': '(auto-detect)',
        };

        // 相关文件
        if (context.relatedFiles && context.relatedFiles.length > 0) {
            vars['context.files'] = context.relatedFiles
                .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
                .join('\n\n');
        } else {
            vars['context.files'] = '(无预加载文件)';
        }

        vars['context.handoffs'] = formatIncomingHandoffs(context);

        return vars;
    }

    // ============ 调用 ============

    /**
     * 调用指定 Agent 并返回结果
     *
     * 当前实现为「渲染 prompt + 生成结构化 AgentResult」。
     * 在进程内模式下，prompt 由调用方（如 AI 工具）消费后自行执行。
     * 当 Agent 定义不可用或需要人工介入时，返回 needs_human 状态。
     */
    invoke(invocation: AgentInvocation): AgentResult {
        const startTime = Date.now();
        const { agentId, context } = invocation;

        this.ensureLoaded();
        const agent = this.registry.get(agentId);

        if (!agent) {
            return {
                status: 'needs_human',
                actualWork: '',
                executedBy: agentId,
                duration: Date.now() - startTime,
                humanReason: `Agent '${agentId}' 未注册，需要人工执行`,
            };
        }

        try {
            const prompt = this.renderPrompt(agentId, context);

            rtDebug(`为 Agent '${agentId}' 渲染了 ${prompt.length} 字符的 prompt`);

            // 返回包含渲染 prompt 的结果，供外部 AI 工具消费
            return {
                status: 'done',
                actualWork: `[AgentRuntime] 已为 ${agent.metadata.name} 生成执行 prompt（${prompt.length} 字符）`,
                executedBy: agentId,
                duration: Date.now() - startTime,
                renderedPrompt: prompt,
            };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return {
                status: 'error',
                actualWork: '',
                executedBy: agentId,
                duration: Date.now() - startTime,
                error: `Agent '${agentId}' 调用失败: ${msg}`,
            };
        }
    }

    /**
     * 并行调用多个 Agent
     */
    invokeParallel(invocations: AgentInvocation[]): AgentResult[] {
        return invocations.map(inv => this.invoke(inv));
    }

    // ============ 辅助 ============

    private ensureLoaded(): void {
        if (!this.loaded) {
            this.loadAll();
        }
    }

    // ============ Skill / Rule 加载 ============

    /**
     * 加载 Agent 声明的 Skills 内容
     *
     * 从 permissions.skills 中解析 skill 名称，
     * 优先读取 install.json 记录的 active skills root，其次回退到 legacy/custom-skills 目录
     */
    private loadDeclaredSkills(metadata: AgentFrontmatter): Record<string, string> {
        const skills: Record<string, string> = {};
        const perms = metadata.permissions;
        if (!perms || Array.isArray(perms) || !perms.skills) return skills;

        const root = this.config.projectRoot;

        for (const skillName of perms.skills) {
            const candidates = getProjectSkillRootCandidatePaths(root)
                .map(skillRoot => path.join(skillRoot, skillName, 'SKILL.md'));

            let found = false;
            for (const candidate of candidates) {
                if (fs.existsSync(candidate)) {
                    try {
                        skills[skillName] = fs.readFileSync(candidate, 'utf-8');
                        rtDebug(`已加载 Skill: ${skillName} (${candidate})`);
                        found = true;
                        break;
                    } catch {
                        // 读取失败，尝试下一个候选
                    }
                }
            }

            if (!found) {
                rtDebug(`Skill '${skillName}' 未找到，跳过`);
            }
        }

        return skills;
    }

    /**
     * 加载 Agent 声明的 Rules 内容
     *
     * 从 dependencies 中解析 layer/rule-name，
     * 优先读取 .codebuddy/rules_cache 中的已安装规则，再回退到源码 rules/ 目录
     */
    private loadDeclaredRules(metadata: AgentFrontmatter): Record<string, string> {
        const rules: Record<string, string> = {};
        if (!metadata.dependencies) return rules;

        const root = this.config.projectRoot;
        const ruleRoots = getProjectRuleRootCandidatePaths(root);

        for (const [layer, ruleNames] of Object.entries(metadata.dependencies)) {
            if (!Array.isArray(ruleNames)) continue;

            for (const ruleName of ruleNames) {
                const key = `${layer}/${ruleName}`;

                let found = false;
                for (const ruleRoot of ruleRoots) {
                    for (const candidate of buildRuleCandidates(ruleRoot, layer, ruleName)) {
                        if (!fs.existsSync(candidate.path)) {
                            continue;
                        }

                        if (candidate.kind === 'directory' && fs.statSync(candidate.path).isDirectory()) {
                            try {
                                const mdFiles = fs.readdirSync(candidate.path).filter(f => f.endsWith('.md')).sort();
                                if (mdFiles.length === 0) {
                                    continue;
                                }
                                rules[key] = mdFiles.map(f => {
                                    const content = fs.readFileSync(path.join(candidate.path, f), 'utf-8');
                                    return `<!-- ${f} -->\n${content}`;
                                }).join('\n\n');
                                rtDebug(`已加载 Rule: ${key} (${candidate.path}, ${mdFiles.length} 个文件)`);
                                found = true;
                                break;
                            } catch {
                                // 读取失败，尝试下一个候选
                            }
                        }

                        if (candidate.kind === 'file' && fs.statSync(candidate.path).isFile()) {
                            try {
                                rules[key] = fs.readFileSync(candidate.path, 'utf-8');
                                rtDebug(`已加载 Rule: ${key} (${candidate.path})`);
                                found = true;
                                break;
                            } catch {
                                // 读取失败，尝试下一个候选
                            }
                        }
                    }

                    if (found) {
                        break;
                    }
                }

                if (!found) {
                    rtDebug(`Rule '${key}' 未找到，跳过`);
                }
            }
        }

        return rules;
    }
}

/** 转义正则特殊字符 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============ 工厂函数 ============

/**
 * 创建 AgentRuntime 实例
 */
export function createAgentRuntime(config: AgentRuntimeConfig): AgentRuntime {
    return new AgentRuntime(config);
}
