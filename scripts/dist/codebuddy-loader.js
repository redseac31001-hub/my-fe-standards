#!/usr/bin/env node
"use strict";
/**
 * CodeBuddy 规则加载器 v2.0
 *
 * 专为 CodeBuddy (GLM-4.7) 优化的前端架构规则加载器
 *
 * 功能：
 * - 三层规则架构加载（Base/Business/Action）
 * - 远程/本地模式支持
 * - 技能索引生成（适配 CodeBuddy 工具调用）
 * - 任务类型筛选（渐进式披露）
 * - Git 私有仓库支持
 *
 * 用法：
 *   node codebuddy-loader.js [options]
 *
 * 选项：
 *   --help, -h        显示帮助信息
 *   --remote <URL>    从远程 URL 获取规则
 *   --task <type>     按任务类型筛选规则
 *   --verbose, -v     启用详细日志
 *   --timeout <ms>    设置网络请求超时（默认 10000ms）
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
// ============ 配置常量 ============
const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const RULES_ROOT = path.join(PROJECT_ROOT, 'rules');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'loader-config.json');
const SKILLS_ROOT = path.join(PROJECT_ROOT, 'custom-skills');
const AGENTS_ROOT = path.join(PROJECT_ROOT, 'agents');
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_THRESHOLD = 0.5;
// ============ 全局上下文 ============
const ctx = {
    isRemote: false,
    isVerbose: false,
    remoteBaseUrl: '',
    remoteManifest: null,
    requestTimeout: DEFAULT_TIMEOUT,
    taskType: null,
    relevanceThreshold: DEFAULT_THRESHOLD,
};
// ============ 日志工具 ============
function log(message) {
    console.log(`[CodeBuddy] ${message}`);
}
function logVerbose(message) {
    if (ctx.isVerbose) {
        console.log(`[CodeBuddy:DEBUG] ${message}`);
    }
}
function logError(message) {
    console.error(`[CodeBuddy:ERROR] ${message}`);
}
function logWarn(message) {
    console.warn(`[CodeBuddy:WARN] ${message}`);
}
// ============ 帮助信息 ============
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║      CodeBuddy 规则加载器 v2.0 - 三层架构 + 技能系统              ║
╚══════════════════════════════════════════════════════════════════╝

用法：
  node codebuddy-loader.js [options]

选项：
  --help, -h           显示帮助信息
  --remote <URL>       从远程 URL 获取规则
  --task <type>        按任务类型筛选规则（渐进式披露）
                       类型: refactoring, debugging, testing, new-feature, code-review
  --threshold <n>      设置相关性阈值 (0-1, 默认: 0.5)
  --verbose, -v        启用详细日志
  --timeout <ms>       设置网络请求超时（默认: 10000ms）

任务类型：
  refactoring          代码重构、优化、技术债务清理
  debugging            Bug 修复、问题排查、错误处理
  testing              编写测试、测试策略、覆盖率
  new-feature          开发新功能、添加新特性
  code-review          代码审查、PR 审核

示例：
  # 加载所有规则（默认）
  node codebuddy-loader.js

  # 仅加载重构相关规则
  node codebuddy-loader.js --task refactoring

  # 从远程加载
  node codebuddy-loader.js --remote https://example.com/standards

输出：
  在当前工作目录生成 .codebuddy/rules/project-rules.md
`);
    process.exit(0);
}
// ============ 网络请求 ============
function fetchUrl(url, retries = 3) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        logVerbose(`Fetching: ${url} (Retries left: ${retries})`);
        const request = client.get(url, (res) => {
            // 处理重定向
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                logVerbose(`Redirecting to: ${res.headers.location}`);
                fetchUrl(res.headers.location, retries).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                if (res.statusCode && res.statusCode >= 500 && retries > 0) {
                    res.resume();
                    logWarn(`HTTP ${res.statusCode}. Retrying...`);
                    setTimeout(() => {
                        fetchUrl(url, retries - 1).then(resolve).catch(reject);
                    }, 1000);
                    return;
                }
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}: Failed to fetch ${url}`));
                return;
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk.toString(); });
            res.on('end', () => {
                logVerbose(`Fetched ${data.length} bytes from ${url}`);
                resolve(data);
            });
        });
        request.on('error', (e) => {
            if (retries > 0) {
                logWarn(`Network Error (${e.code}). Retrying...`);
                setTimeout(() => {
                    fetchUrl(url, retries - 1).then(resolve).catch(reject);
                }, 1000);
                return;
            }
            reject(new Error(`Network Error: ${e.message} (URL: ${url})`));
        });
        request.setTimeout(ctx.requestTimeout, () => {
            request.destroy();
            if (retries > 0) {
                logWarn(`Request Timeout. Retrying...`);
                setTimeout(() => {
                    fetchUrl(url, retries - 1).then(resolve).catch(reject);
                }, 1000);
                return;
            }
            reject(new Error(`Request Timeout: ${url}`));
        });
    });
}
// ============ 配置加载 ============
async function loadConfig() {
    if (ctx.isRemote) {
        try {
            const manifestUrl = `${ctx.remoteBaseUrl}/manifest.json`;
            log(`正在从远程加载配置: ${manifestUrl}`);
            const data = await fetchUrl(manifestUrl);
            ctx.remoteManifest = JSON.parse(data);
            logVerbose(`Manifest 加载成功. Version: ${ctx.remoteManifest.version}`);
            return ctx.remoteManifest.config;
        }
        catch (e) {
            logError(`远程 manifest 加载失败: ${e.message}`);
            process.exit(1);
        }
    }
    else {
        if (!fs.existsSync(CONFIG_PATH)) {
            logError(`配置文件不存在: ${CONFIG_PATH}`);
            process.exit(1);
        }
        logVerbose(`加载本地配置: ${CONFIG_PATH}`);
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
}
// ============ 项目依赖检测 ============
function getPackageJson(targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        logWarn(`未找到 package.json: ${pkgPath}`);
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }
    catch (e) {
        logError(`解析 package.json 失败: ${e.message}`);
        return {};
    }
}
function checkVueProfile(dependencies) {
    const vueVersion = dependencies['vue'];
    if (!vueVersion)
        return null;
    if (vueVersion.startsWith('3') || vueVersion.startsWith('^3') || vueVersion.startsWith('~3')) {
        return { version: 3, type: 'standard' };
    }
    if (vueVersion.startsWith('2') || vueVersion.startsWith('^2') || vueVersion.startsWith('~2')) {
        if (dependencies['@vue/composition-api']) {
            return { version: 2, type: 'composition' };
        }
        return { version: 2, type: 'options' };
    }
    return null;
}
// ============ 规则加载 ============
async function loadRuleFile(layerId, filePath) {
    if (ctx.isRemote) {
        const fileUrl = `${ctx.remoteBaseUrl}/rules/${layerId}/${filePath}`;
        try {
            return await fetchUrl(fileUrl);
        }
        catch (e) {
            logWarn(`远程规则加载失败: ${filePath}`);
            return '';
        }
    }
    else {
        const fullPath = path.join(RULES_ROOT, layerId, filePath);
        if (fs.existsSync(fullPath)) {
            return fs.readFileSync(fullPath, 'utf-8');
        }
        return '';
    }
}
async function loadLayerRules(layerId, folders) {
    const contents = [];
    for (const folder of folders) {
        if (ctx.isRemote) {
            // 远程模式：从 manifest 查找文件
            const matchingFiles = ctx.remoteManifest.files.filter(f => f.path.startsWith(`rules/${layerId}/${folder}`) && f.path.endsWith('.md'));
            for (const file of matchingFiles) {
                const relativePath = file.path.replace(`rules/${layerId}/`, '');
                const content = await loadRuleFile(layerId, relativePath);
                if (content) {
                    contents.push({ path: relativePath, content });
                }
            }
        }
        else {
            // 本地模式
            const folderPath = path.join(RULES_ROOT, layerId, folder);
            if (fs.existsSync(folderPath)) {
                const stat = fs.statSync(folderPath);
                if (stat.isDirectory()) {
                    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
                    for (const file of files) {
                        const content = fs.readFileSync(path.join(folderPath, file), 'utf-8');
                        contents.push({ path: `${folder}/${file}`, content });
                    }
                }
                else if (folderPath.endsWith('.md')) {
                    const content = fs.readFileSync(folderPath, 'utf-8');
                    contents.push({ path: folder, content });
                }
            }
            // 尝试 .md 后缀
            const mdPath = path.join(RULES_ROOT, layerId, folder + '.md');
            if (fs.existsSync(mdPath)) {
                const content = fs.readFileSync(mdPath, 'utf-8');
                contents.push({ path: folder + '.md', content });
            }
        }
    }
    return contents;
}
// ============ 技能系统 ============
async function loadSkills(skillsPath) {
    const skills = [];
    const localSkillsDir = path.join(process.cwd(), '.codebuddy/skills');
    // 确保目录存在
    if (!fs.existsSync(localSkillsDir)) {
        fs.mkdirSync(localSkillsDir, { recursive: true });
    }
    const sourceDir = ctx.isRemote ? null : path.join(PROJECT_ROOT, skillsPath);
    if (!ctx.isRemote && sourceDir && fs.existsSync(sourceDir)) {
        // 本地模式：复制技能文件
        copyRecursive(sourceDir, localSkillsDir);
        // 解析 SKILL.md
        const skillDirs = fs.readdirSync(localSkillsDir).filter(f => {
            const stat = fs.statSync(path.join(localSkillsDir, f));
            return stat.isDirectory();
        });
        for (const skillId of skillDirs) {
            const skillFile = path.join(localSkillsDir, skillId, 'SKILL.md');
            if (fs.existsSync(skillFile)) {
                const content = fs.readFileSync(skillFile, 'utf-8');
                const metadata = parseSkillMetadata(skillId, content);
                if (metadata)
                    skills.push(metadata);
            }
        }
    }
    return skills;
}
function copyRecursive(src, dest) {
    if (!fs.existsSync(src))
        return;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest))
            fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(child => {
            copyRecursive(path.join(src, child), path.join(dest, child));
        });
    }
    else {
        fs.copyFileSync(src, dest);
    }
}
function parseSkillMetadata(skillId, content) {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!frontmatterMatch)
        return null;
    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    let descMatch = frontmatter.match(/^description:\s*["'](.+)["']$/m);
    if (!descMatch)
        descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (!nameMatch || !descMatch)
        return null;
    return {
        id: skillId,
        name: nameMatch[1].trim(),
        description: descMatch[1].trim(),
    };
}
// ============ Agent 系统 ============
async function loadAgents(agentsPath) {
    const agents = [];
    const localAgentsDir = path.join(process.cwd(), '.codebuddy/agents');
    // 确保目录存在
    if (!fs.existsSync(localAgentsDir)) {
        fs.mkdirSync(localAgentsDir, { recursive: true });
    }
    const sourceDir = ctx.isRemote ? null : path.join(PROJECT_ROOT, agentsPath);
    if (!ctx.isRemote && sourceDir && fs.existsSync(sourceDir)) {
        // 本地模式：复制 Agent 文件
        copyRecursive(sourceDir, localAgentsDir);
        // 解析 AGENT.md
        const agentDirs = fs.readdirSync(localAgentsDir).filter(f => {
            const fullPath = path.join(localAgentsDir, f);
            return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
        });
        for (const agentId of agentDirs) {
            const agentFile = path.join(localAgentsDir, agentId, 'AGENT.md');
            if (fs.existsSync(agentFile)) {
                const content = fs.readFileSync(agentFile, 'utf-8');
                const metadata = parseAgentMetadata(agentId, content);
                if (metadata)
                    agents.push(metadata);
            }
        }
    }
    return agents;
}
function parseAgentMetadata(agentId, content) {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!frontmatterMatch)
        return null;
    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    let descMatch = frontmatter.match(/^description:\s*["'](.+)["']$/m);
    if (!descMatch)
        descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (!nameMatch || !descMatch)
        return null;
    // 解析 triggers
    const triggers = [];
    const triggersMatch = frontmatter.match(/^triggers:\s*\n((?:\s+-\s*.+\n?)+)/m);
    if (triggersMatch) {
        const triggerLines = triggersMatch[1].split('\n');
        for (const line of triggerLines) {
            const match = line.match(/^\s+-\s*["']?(.+?)["']?\s*$/);
            if (match)
                triggers.push(match[1]);
        }
    }
    // 解析 permissions
    const permissions = [];
    const permMatch = frontmatter.match(/permissions:\s*\n\s+tools:\s*\n((?:\s+-\s*.+\n?)+)/m);
    if (permMatch) {
        const permLines = permMatch[1].split('\n');
        for (const line of permLines) {
            const match = line.match(/^\s+-\s*(.+?)\s*$/);
            if (match)
                permissions.push(match[1]);
        }
    }
    return {
        id: agentId,
        name: nameMatch[1].trim(),
        description: descMatch[1].trim(),
        triggers,
        permissions,
    };
}
function generateAgentsPrompt(agents) {
    if (agents.length === 0)
        return '';
    let table = '| Agent 名称 | Agent ID | 触发场景 | 权限 |\n|-----------|----------|----------|------|\n';
    for (const agent of agents) {
        const triggerText = agent.triggers.slice(0, 3).join(', ') + (agent.triggers.length > 3 ? '...' : '');
        const permText = agent.permissions.join(', ') || '-';
        table += `| **${agent.name}** | \`${agent.id}\` | ${triggerText} | ${permText} |\n`;
    }
    return `
# 🤖 Agent 系统索引 (Agents Index)

本规则库支持 **Agent 执行模式**，Agent 文件已下载至 \`.codebuddy/agents/\`。

## 已安装 Agents

${table}

## 🚀 Agent 调用指南 (CodeBuddy)

当用户请求匹配上述触发场景时，请：

1. **识别意图**: 分析用户请求是否匹配表格中的触发场景
2. **读取 Agent**: 调用 \`read_file\` 工具读取 \`.codebuddy/agents/<Agent ID>/AGENT.md\`
3. **执行工作流**: 根据 AGENT.md 中定义的工作流执行任务
4. **加载资源**: 按需读取 checklists/、metrics/、frameworks/ 等子目录资源
5. **生成报告**: 使用 templates/ 目录中的模板输出结果

**示例**:
> 用户: "帮我做一下安全审查"
> 行动: read_file(".codebuddy/agents/security-reviewer/AGENT.md")

## Agent 与 Skill 的区别

| 维度 | Agent | Skill |
|------|-------|-------|
| **定位** | 独立决策执行者 | 知识包/工具集 |
| **执行模式** | 完整工作流 | 提供知识上下文 |
`;
}
// ============ 提示词生成 ============
function generateSkillsPrompt(skills) {
    if (skills.length === 0)
        return '';
    let table = '| 技能名称 | 技能 ID | 触发场景 |\n|---------|---------|----------|\n';
    for (const skill of skills) {
        table += `| **${skill.name}** | \`${skill.id}\` | ${skill.description} |\n`;
    }
    return `
# 🧩 动态技能索引 (Skills Index)

本规则库采用 **动态加载模式**，技能文件已下载至 \`.codebuddy/skills/\`。

## 已安装技能

${table}

## 🚀 技能调用指南 (CodeBuddy)

当用户请求匹配上述触发场景时，请：

1. **识别意图**: 分析用户请求是否匹配表格中的触发场景
2. **读取技能**: 调用 \`read_file\` 工具读取 \`.codebuddy/skills/<技能ID>/SKILL.md\`
3. **遵循指引**: 根据 SKILL.md 中的路由逻辑，读取 \`references/\` 下的相关文档
4. **执行任务**: 基于完整上下文执行用户任务

**示例**:
> 用户: "帮我重构这个组件"
> 行动: read_file(".codebuddy/skills/component-refactoring/SKILL.md")

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
// ============ .gitignore 更新 ============
function updateGitignore(projectDir) {
    const gitignorePath = path.join(projectDir, '.gitignore');
    const entry = '.codebuddy/';
    try {
        let content = '';
        if (fs.existsSync(gitignorePath)) {
            content = fs.readFileSync(gitignorePath, 'utf-8');
            if (content.includes(entry)) {
                return;
            }
        }
        if (content && !content.endsWith('\n')) {
            content += '\n';
        }
        content += `\n# CodeBuddy 生成文件\n${entry}\n`;
        fs.writeFileSync(gitignorePath, content, 'utf-8');
        logVerbose('已更新 .gitignore');
    }
    catch (error) {
        logWarn(`更新 .gitignore 失败: ${error.message}`);
    }
}
// ============ 参数解析 ============
function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
    }
    if (args.includes('--verbose') || args.includes('-v')) {
        ctx.isVerbose = true;
    }
    const remoteIndex = args.indexOf('--remote');
    if (remoteIndex !== -1) {
        const url = args[remoteIndex + 1];
        if (!url || url.startsWith('-')) {
            logError('--remote 需要 URL 参数');
            process.exit(1);
        }
        // 验证 URL 格式
        try {
            new URL(url);
        }
        catch (_a) {
            logError('--remote 需要有效的 URL 格式（如 https://example.com）');
            process.exit(1);
        }
        ctx.isRemote = true;
        ctx.remoteBaseUrl = url.replace(/\/$/, '');
    }
    const taskIndex = args.indexOf('--task');
    if (taskIndex !== -1) {
        const taskInput = args[taskIndex + 1];
        if (!taskInput || taskInput.startsWith('-')) {
            logError('--task 需要任务类型参数');
            process.exit(1);
        }
        ctx.taskType = taskInput.toLowerCase().trim();
    }
    const thresholdIndex = args.indexOf('--threshold');
    if (thresholdIndex !== -1) {
        const value = parseFloat(args[thresholdIndex + 1]);
        if (!isNaN(value) && value >= 0 && value <= 1) {
            ctx.relevanceThreshold = value;
        }
    }
    const timeoutIndex = args.indexOf('--timeout');
    if (timeoutIndex !== -1) {
        const value = parseInt(args[timeoutIndex + 1], 10);
        if (!isNaN(value) && value > 0) {
            ctx.requestTimeout = value;
        }
    }
}
// ============ 主函数 ============
async function main() {
    var _a, _b, _c, _d, _e, _f, _g;
    parseArgs();
    log('CodeBuddy 规则加载器 v2.0 (三层架构 + 技能系统)');
    log(ctx.isRemote ? `模式: 远程 (${ctx.remoteBaseUrl})` : '模式: 本地');
    if (ctx.taskType) {
        log(`任务筛选: ${ctx.taskType} (阈值: ${ctx.relevanceThreshold})`);
    }
    const targetDir = process.cwd();
    log(`目标项目: ${targetDir}`);
    // 加载配置
    const config = await loadConfig();
    const { layers, skills: skillsConfig, output, frontmatter } = config;
    // 检测项目依赖
    const pkg = getPackageJson(targetDir);
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    const vueProfile = checkVueProfile(dependencies);
    if (vueProfile) {
        log(`检测到 Vue ${vueProfile.version} (${vueProfile.type})`);
    }
    // 构建输出内容
    const updatedAt = new Date().toISOString();
    let finalContent = `---
description: ${(frontmatter === null || frontmatter === void 0 ? void 0 : frontmatter.description) || '前端架构规范 - CodeBuddy GLM-4.7 专用版'}
alwaysApply: ${(frontmatter === null || frontmatter === void 0 ? void 0 : frontmatter.alwaysApply) !== undefined ? frontmatter.alwaysApply : true}
enabled: ${(frontmatter === null || frontmatter === void 0 ? void 0 : frontmatter.enabled) !== undefined ? frontmatter.enabled : true}
updatedAt: ${updatedAt}
---

# 前端架构规范 (CodeBuddy 版)

> Generated by CodeBuddy Rule Loader v2.0
> Generated at: ${updatedAt}
> Vue Version: ${vueProfile ? `${vueProfile.version} (${vueProfile.type})` : 'Not detected'}

---

`;
    // ============ Layer 1: Base (Eager Load) ============
    log('处理 Layer 1: 基础规范 (Eager Load)...');
    const layer1Folders = [...(((_a = layers.base) === null || _a === void 0 ? void 0 : _a.staticDeps) || [])];
    // 根据 Vue 版本添加规则
    if (vueProfile) {
        if (vueProfile.version === 3) {
            layer1Folders.push('vue3');
        }
        else if (vueProfile.version === 2) {
            layer1Folders.push(vueProfile.type === 'composition' ? 'vue2' : 'vue2');
        }
    }
    const layer1Rules = await loadLayerRules(((_b = layers.base) === null || _b === void 0 ? void 0 : _b.id) || 'layer1_base', layer1Folders);
    finalContent += `## ${((_c = layers.base) === null || _c === void 0 ? void 0 : _c.title) || 'Layer 1: 基础规范'}\n\n`;
    finalContent += `> 这些是本项目必须遵守的核心规范\n\n`;
    for (const rule of layer1Rules) {
        finalContent += `<!-- Source: ${rule.path} -->\n${rule.content}\n\n---\n\n`;
    }
    // ============ Layer 2: Business (Lazy Load - Index Only) ============
    log('处理 Layer 2: 业务规范 (Lazy Load)...');
    const layer2Index = [];
    const businessDeps = ((_d = layers.business) === null || _d === void 0 ? void 0 : _d.dependencies) || {};
    for (const [depName, ruleFolders] of Object.entries(businessDeps)) {
        if (dependencies[depName]) {
            log(`  检测到 ${depName}，添加规则索引`);
            for (const folder of ruleFolders) {
                layer2Index.push({
                    dep: depName,
                    rule: folder,
                    path: `.codebuddy/rules_cache/layer2_business/${folder}.md`
                });
                // 缓存规则文件
                const cacheDir = path.join(targetDir, '.codebuddy/rules_cache/layer2_business');
                if (!fs.existsSync(cacheDir)) {
                    fs.mkdirSync(cacheDir, { recursive: true });
                }
                const content = await loadRuleFile(((_e = layers.business) === null || _e === void 0 ? void 0 : _e.id) || 'layer2_business', folder + '.md');
                if (content) {
                    fs.writeFileSync(path.join(cacheDir, folder + '.md'), content, 'utf-8');
                }
            }
        }
    }
    // ============ Layer 3: Action (Lazy Load - Index Only) ============
    log('处理 Layer 3: 任务检查清单 (Lazy Load)...');
    const layer3Index = [];
    const actionDefaults = ((_f = layers.action) === null || _f === void 0 ? void 0 : _f.defaults) || [];
    for (const item of actionDefaults) {
        layer3Index.push({
            rule: item,
            path: `.codebuddy/rules_cache/layer3_action/${item}.md`
        });
        // 缓存规则文件
        const cacheDir = path.join(targetDir, '.codebuddy/rules_cache/layer3_action');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        const content = await loadRuleFile(((_g = layers.action) === null || _g === void 0 ? void 0 : _g.id) || 'layer3_action', item + '.md');
        if (content) {
            fs.writeFileSync(path.join(cacheDir, item + '.md'), content, 'utf-8');
        }
    }
    // ============ 生成规则索引表 ============
    if (layer2Index.length > 0 || layer3Index.length > 0) {
        finalContent += `## 📚 规则参考索引 (按需加载)\n\n`;
        finalContent += `> 以下规则包含具体的技术栈实现细节，请按需读取\n\n`;
        finalContent += `| 规则名称 | 本地路径 | 说明 |\n|---------|---------|------|\n`;
        for (const item of layer2Index) {
            finalContent += `| ${item.rule} | \`${item.path}\` | ${item.dep} 规范 |\n`;
        }
        for (const item of layer3Index) {
            finalContent += `| ${item.rule} | \`${item.path}\` | 任务检查清单 |\n`;
        }
        finalContent += '\n';
    }
    // ============ 规则激活提示词 ============
    finalContent += generateRuleActivationPrompt(config);
    // ============ 技能系统 ============
    if (skillsConfig === null || skillsConfig === void 0 ? void 0 : skillsConfig.enabled) {
        log('加载技能系统...');
        const skills = await loadSkills(skillsConfig.path || 'custom-skills');
        log(`已加载 ${skills.length} 个技能`);
        finalContent += generateSkillsPrompt(skills);
    }
    // ============ Agent 系统 ============
    log('加载 Agent 系统...');
    const agents = await loadAgents('agents');
    if (agents.length > 0) {
        log(`已加载 ${agents.length} 个 Agents`);
        finalContent += generateAgentsPrompt(agents);
    }
    // ============ 输出文件 ============
    const outputDir = path.join(targetDir, (output === null || output === void 0 ? void 0 : output.dirName) || '.codebuddy/rules');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, (output === null || output === void 0 ? void 0 : output.fileName) || 'project-rules.md');
    fs.writeFileSync(outputPath, finalContent, 'utf-8');
    // 更新 .gitignore
    updateGitignore(targetDir);
    log('');
    log('═══════════════════════════════════════════════════════════════════');
    log(`✅ 成功! 规则文件已写入: ${outputPath}`);
    log(`   文件大小: ${(finalContent.length / 1024).toFixed(2)} KB`);
    log(`   Layer 1 规则: ${layer1Rules.length} 个`);
    log(`   Layer 2 索引: ${layer2Index.length} 个`);
    log(`   Layer 3 索引: ${layer3Index.length} 个`);
    log('═══════════════════════════════════════════════════════════════════');
}
main().catch((err) => {
    logError(`Fatal Error: ${err.message}`);
    process.exit(1);
});
