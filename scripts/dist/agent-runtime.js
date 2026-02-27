"use strict";
/**
 * Agent Runtime — 子 Agent 自动加载与调用核心模块
 *
 * 职责:
 * - 扫描 agents/ 目录，加载所有 Agent 定义（AGENT.md + prompts/）
 * - 解析 YAML frontmatter 元数据
 * - 渲染 prompt 模板（变量替换）
 * - 提供统一的 invoke() 调用接口
 *
 * 约束:
 * - 零外部依赖（仅 Node.js 内置模块）
 * - 不引入新的通信协议，复用现有 Agent Call 文件协议作为降级路径
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRuntime = void 0;
exports.createAgentRuntime = createAgentRuntime;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ============ 日志工具 ============
let _verbose = false;
function rtLog(message) {
    console.log(`[AgentRuntime] ${message}`);
}
function rtDebug(message) {
    if (_verbose)
        console.log(`[AgentRuntime:DEBUG] ${message}`);
}
function rtWarn(message) {
    console.warn(`[AgentRuntime:WARN] ${message}`);
}
// ============ YAML Frontmatter 解析（零依赖） ============
/**
 * 从 Markdown 文件内容中提取 YAML frontmatter 块
 * 返回 [frontmatter字符串, body正文] 或 null
 */
function extractFrontmatter(content) {
    const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
    if (!match)
        return null;
    return { yaml: match[1], body: match[2] };
}
/**
 * 简易 YAML 解析器（覆盖 AGENT.md 的 frontmatter 格式）
 *
 * 支持:
 * - 标量值: key: value
 * - 字符串数组: key:\n  - item1\n  - item2
 * - 嵌套对象（一级）: key:\n  subkey:\n    - item
 * - 引号字符串: key: "value" / key: 'value'
 *
 * 不支持: 多行字符串、锚点、复杂嵌套等完整 YAML 特性
 */
function parseSimpleYaml(yamlStr) {
    const result = {};
    const lines = yamlStr.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trimEnd();
        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith('#')) {
            i++;
            continue;
        }
        // 顶层 key: value
        const kvMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)/);
        if (!kvMatch) {
            i++;
            continue;
        }
        const key = kvMatch[1];
        const inlineValue = kvMatch[2].trim();
        if (inlineValue && !inlineValue.startsWith('#')) {
            // 内联标量值
            result[key] = unquote(inlineValue);
            i++;
            continue;
        }
        // 值在下一行（数组或嵌套对象）
        const children = collectIndentedBlock(lines, i + 1);
        if (children.items.length > 0) {
            if (isArrayBlock(children.items)) {
                result[key] = parseArrayItems(children.items);
            }
            else {
                result[key] = parseNestedObject(children.items);
            }
            i = children.nextIndex;
        }
        else {
            result[key] = '';
            i++;
        }
    }
    return result;
}
/** 去除引号 */
function unquote(value) {
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}
/** 收集缩进块 */
function collectIndentedBlock(lines, startIndex) {
    const items = [];
    let i = startIndex;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trimEnd()) {
            i++;
            continue;
        }
        // 缩进的行（至少 2 空格或 1 tab）
        if (/^[ \t]{2,}/.test(line) || /^\t/.test(line) || /^  /.test(line)) {
            items.push(line);
            i++;
        }
        else {
            break;
        }
    }
    return { items, nextIndex: i };
}
/** 判断是否为数组块 */
function isArrayBlock(items) {
    return items.some(line => /^\s*-\s/.test(line));
}
/** 解析数组项 */
function parseArrayItems(items) {
    const result = [];
    for (const line of items) {
        const m = line.match(/^\s*-\s+(.*)/);
        if (m) {
            result.push(unquote(m[1].trim()));
        }
    }
    return result;
}
/** 解析嵌套对象（一级） */
function parseNestedObject(items) {
    const result = {};
    let i = 0;
    while (i < items.length) {
        const line = items[i].trim();
        if (!line || line.startsWith('#')) {
            i++;
            continue;
        }
        const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
        if (!kvMatch) {
            i++;
            continue;
        }
        const key = kvMatch[1];
        const inlineValue = kvMatch[2].trim();
        if (inlineValue && !inlineValue.startsWith('#')) {
            result[key] = unquote(inlineValue);
            i++;
            continue;
        }
        // 子数组
        const subItems = [];
        i++;
        while (i < items.length) {
            const subLine = items[i];
            if (/^\s{4,}-\s/.test(subLine) || /^\s{2,}-\s/.test(subLine.replace(/^\s{2}/, ''))) {
                subItems.push(subLine);
                i++;
            }
            else if (subLine.trim() === '' || /^\s{4,}/.test(subLine)) {
                i++;
            }
            else {
                break;
            }
        }
        if (subItems.length > 0) {
            result[key] = parseArrayItems(subItems);
        }
        else {
            result[key] = '';
        }
    }
    return result;
}
/** 将解析的 raw 对象转换为 AgentFrontmatter */
function toAgentFrontmatter(raw) {
    const name = String(raw['name'] || '');
    const description = String(raw['description'] || '');
    const version = raw['version'] ? String(raw['version']) : undefined;
    const model = raw['model'] ? String(raw['model']) : undefined;
    // triggers: 支持两种格式
    let triggers;
    if (raw['triggers']) {
        if (Array.isArray(raw['triggers'])) {
            triggers = raw['triggers'].map(String);
        }
        else if (typeof raw['triggers'] === 'object') {
            // triggers: { explicit: [...], implicit: [...] }
            const tObj = raw['triggers'];
            const explicit = Array.isArray(tObj['explicit']) ? tObj['explicit'].map(String) : [];
            // implicit 中可能有复杂对象，这里简化处理
            triggers = explicit;
        }
    }
    // permissions: 支持字符串数组或 { tools, skills } 对象
    let permissions;
    if (raw['permissions']) {
        if (Array.isArray(raw['permissions'])) {
            permissions = raw['permissions'].map(String);
        }
        else if (typeof raw['permissions'] === 'object') {
            const pObj = raw['permissions'];
            permissions = {
                tools: Array.isArray(pObj['tools']) ? pObj['tools'].map(String) : undefined,
                skills: Array.isArray(pObj['skills']) ? pObj['skills'].map(String) : undefined,
            };
        }
    }
    // dependencies
    let dependencies;
    if (raw['dependencies'] && typeof raw['dependencies'] === 'object' && !Array.isArray(raw['dependencies'])) {
        dependencies = {};
        const dObj = raw['dependencies'];
        for (const [k, v] of Object.entries(dObj)) {
            if (Array.isArray(v)) {
                dependencies[k] = v.map(String);
            }
        }
    }
    return { name, description, version, triggers, permissions, dependencies, model };
}
// ============ 核心类 ============
/**
 * AgentRuntime — 子 Agent 加载与调用运行时
 */
class AgentRuntime {
    constructor(config) {
        this.registry = new Map();
        this.loaded = false;
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
    loadAll() {
        if (this.loaded)
            return;
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
    loadAgent(agentId, baseDir) {
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
            if (!fs.existsSync(agentMdPath))
                continue;
            try {
                const content = fs.readFileSync(agentMdPath, 'utf-8');
                const extracted = extractFrontmatter(content);
                if (!extracted) {
                    rtWarn(`Agent '${agentId}': AGENT.md 缺少 YAML frontmatter`);
                    continue;
                }
                const raw = parseSimpleYaml(extracted.yaml);
                const metadata = toAgentFrontmatter(raw);
                if (!metadata.name) {
                    metadata.name = agentId;
                }
                // 加载 prompts/ 子目录
                const prompts = {};
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
                    body: extracted.body,
                    prompts,
                    skills,
                    rules,
                };
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                rtWarn(`Agent '${agentId}' 加载失败: ${msg}`);
            }
        }
        return null;
    }
    /**
     * 获取已注册的 Agent
     */
    getAgent(agentId) {
        this.ensureLoaded();
        return this.registry.get(agentId) || null;
    }
    /**
     * 列出所有已注册 Agent 的元信息
     */
    listAgents() {
        this.ensureLoaded();
        const result = [];
        for (const [id, agent] of this.registry) {
            const triggers = [];
            if (agent.metadata.triggers) {
                triggers.push(...agent.metadata.triggers);
            }
            const permissions = [];
            if (agent.metadata.permissions) {
                if (Array.isArray(agent.metadata.permissions)) {
                    permissions.push(...agent.metadata.permissions);
                }
                else {
                    if (agent.metadata.permissions.tools)
                        permissions.push(...agent.metadata.permissions.tools);
                    if (agent.metadata.permissions.skills)
                        permissions.push(...agent.metadata.permissions.skills);
                }
            }
            result.push({
                id,
                name: agent.metadata.name,
                description: agent.metadata.description,
                triggers,
                permissions,
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
    renderPrompt(agentId, context, promptKey) {
        this.ensureLoaded();
        const agent = this.registry.get(agentId);
        if (!agent) {
            throw new Error(`Agent '${agentId}' 未注册`);
        }
        // 选择 prompt 模板
        let template;
        if (promptKey && agent.prompts[promptKey]) {
            template = agent.prompts[promptKey];
        }
        else if (Object.keys(agent.prompts).length > 0) {
            // 根据任务类型智能选择 prompt
            const taskType = context.task.type;
            const promptMapping = {
                'test': 'red',
                'implement': 'green',
                'refactor': 'refactor',
                'review': 'review',
                'build-fix': 'diagnose-fix',
            };
            const autoKey = promptMapping[taskType];
            if (autoKey && agent.prompts[autoKey]) {
                template = agent.prompts[autoKey];
            }
            else {
                // 使用第一个可用的 prompt
                const firstKey = Object.keys(agent.prompts)[0];
                template = agent.prompts[firstKey];
            }
        }
        else {
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
        rendered = rendered.replace(/\{\{#each\s+task\.acceptanceCriteria\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, body) => {
            return context.task.acceptanceCriteria
                .map(criterion => body.replace(/\{\{\s*this\s*\}\}/g, criterion))
                .join('');
        });
        // 前置 Agent 角色说明
        const header = [
            `## Agent: ${agent.metadata.name}`,
            '',
            `> ${agent.metadata.description}`,
            `> TaskBook: ${context.taskBookId}`,
            `> Task: ${context.task.title} (${context.task.type})`,
            '',
        ].join('\n');
        // 注入 Skill 知识
        let skillSection = '';
        if (Object.keys(agent.skills).length > 0) {
            const skillParts = Object.entries(agent.skills).map(([name, content]) => `### Skill: ${name}\n\n${content.slice(0, 3000)}`);
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
            const ruleParts = Object.entries(agent.rules).map(([name, content]) => `### Rule: ${name}\n\n${content.slice(0, 2000)}`);
            ruleSection = [
                '## 参考知识: Rules (规范库)',
                '',
                '> 以下是与当前任务相关的编码规范，请严格遵守。',
                '',
                ...ruleParts,
                '',
            ].join('\n');
        }
        return header + skillSection + ruleSection + rendered;
    }
    /** 构建模板变量表 */
    buildTemplateVariables(agent, context) {
        var _a, _b, _c, _d;
        const task = context.task;
        const vars = {
            'task.title': task.title,
            'task.type': task.type,
            'task.description': task.description || '',
            'task.id': task.id,
            'task.priority': task.priority || 'medium',
            'task.acceptanceCriteria': task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n'),
            'task.scope.files': ((_b = (_a = task.scope) === null || _a === void 0 ? void 0 : _a.files) === null || _b === void 0 ? void 0 : _b.join(', ')) || '(未指定)',
            'task.scope.modules': ((_d = (_c = task.scope) === null || _c === void 0 ? void 0 : _c.modules) === null || _d === void 0 ? void 0 : _d.join(', ')) || '(未指定)',
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
        }
        else {
            vars['context.files'] = '(无预加载文件)';
        }
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
    invoke(invocation) {
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
        }
        catch (e) {
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
    invokeParallel(invocations) {
        return invocations.map(inv => this.invoke(inv));
    }
    // ============ 辅助 ============
    ensureLoaded() {
        if (!this.loaded) {
            this.loadAll();
        }
    }
    // ============ Skill / Rule 加载 ============
    /**
     * 加载 Agent 声明的 Skills 内容
     *
     * 从 permissions.skills 中解析 skill 名称，
     * 依次在 .codebuddy/custom-skills/ 和 custom-skills/ 中查找 SKILL.md
     */
    loadDeclaredSkills(metadata) {
        const skills = {};
        const perms = metadata.permissions;
        if (!perms || Array.isArray(perms) || !perms.skills)
            return skills;
        const root = this.config.projectRoot;
        for (const skillName of perms.skills) {
            // 搜索顺序：.codebuddy/custom-skills/ → custom-skills/
            const candidates = [
                path.join(root, '.codebuddy', 'custom-skills', skillName, 'SKILL.md'),
                path.join(root, 'custom-skills', skillName, 'SKILL.md'),
            ];
            let found = false;
            for (const candidate of candidates) {
                if (fs.existsSync(candidate)) {
                    try {
                        skills[skillName] = fs.readFileSync(candidate, 'utf-8');
                        rtDebug(`已加载 Skill: ${skillName} (${candidate})`);
                        found = true;
                        break;
                    }
                    catch (_a) {
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
     * 在 rules/<layer>/<rule-name>/ 目录或 rules/<layer>/<rule-name>.md 中查找
     */
    loadDeclaredRules(metadata) {
        const rules = {};
        if (!metadata.dependencies)
            return rules;
        const root = this.config.projectRoot;
        for (const [layer, ruleNames] of Object.entries(metadata.dependencies)) {
            if (!Array.isArray(ruleNames))
                continue;
            for (const ruleName of ruleNames) {
                const key = `${layer}/${ruleName}`;
                // 搜索顺序：目录 → 单文件
                const dirPath = path.join(root, 'rules', layer, ruleName);
                const filePath = path.join(root, 'rules', layer, `${ruleName}.md`);
                if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
                    // 目录模式：拼接所有 .md 文件
                    try {
                        const mdFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.md')).sort();
                        if (mdFiles.length > 0) {
                            const combined = mdFiles.map(f => {
                                const content = fs.readFileSync(path.join(dirPath, f), 'utf-8');
                                return `<!-- ${f} -->\n${content}`;
                            }).join('\n\n');
                            rules[key] = combined;
                            rtDebug(`已加载 Rule: ${key} (${mdFiles.length} 个文件)`);
                        }
                    }
                    catch (_a) {
                        // 读取失败跳过
                    }
                }
                else if (fs.existsSync(filePath)) {
                    // 单文件模式
                    try {
                        rules[key] = fs.readFileSync(filePath, 'utf-8');
                        rtDebug(`已加载 Rule: ${key}`);
                    }
                    catch (_b) {
                        // 读取失败跳过
                    }
                }
                else {
                    rtDebug(`Rule '${key}' 未找到，跳过`);
                }
            }
        }
        return rules;
    }
}
exports.AgentRuntime = AgentRuntime;
/** 转义正则特殊字符 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// ============ 工厂函数 ============
/**
 * 创建 AgentRuntime 实例
 */
function createAgentRuntime(config) {
    return new AgentRuntime(config);
}
