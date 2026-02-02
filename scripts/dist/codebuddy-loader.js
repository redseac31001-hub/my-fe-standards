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
    if (ctx.isRemote) {
        // 远程模式：从 manifest 获取 skill 文件列表并下载
        const skillFiles = ctx.remoteManifest.files.filter(f => f.path.startsWith('custom-skills/') && f.path.endsWith('.md'));
        for (const file of skillFiles) {
            const fileUrl = `${ctx.remoteBaseUrl}/${file.path}`;
            try {
                const content = await fetchUrl(fileUrl);
                // 计算本地路径：custom-skills/xxx/yyy.md -> xxx/yyy.md
                const relativePath = file.path.replace('custom-skills/', '');
                const localPath = path.join(localSkillsDir, relativePath);
                const localDir = path.dirname(localPath);
                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }
                fs.writeFileSync(localPath, content, 'utf-8');
                logVerbose(`已下载技能文件: ${relativePath}`);
                // 解析 SKILL.md 元数据
                if (file.path.endsWith('SKILL.md')) {
                    const skillId = relativePath.split('/')[0];
                    const metadata = parseSkillMetadata(skillId, content);
                    if (metadata)
                        skills.push(metadata);
                }
            }
            catch (e) {
                logWarn(`技能文件下载失败: ${file.path} - ${e.message}`);
            }
        }
    }
    else {
        // 本地模式：复制技能文件
        const sourceDir = path.join(PROJECT_ROOT, skillsPath);
        if (fs.existsSync(sourceDir)) {
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
    if (ctx.isRemote) {
        // 远程模式：从 manifest 获取 agent 文件列表并下载
        const agentFiles = ctx.remoteManifest.files.filter(f => f.path.startsWith('agents/') && f.path.endsWith('.md'));
        for (const file of agentFiles) {
            const fileUrl = `${ctx.remoteBaseUrl}/${file.path}`;
            try {
                const content = await fetchUrl(fileUrl);
                // 计算本地路径：agents/xxx/yyy.md -> xxx/yyy.md
                const relativePath = file.path.replace('agents/', '');
                const localPath = path.join(localAgentsDir, relativePath);
                const localDir = path.dirname(localPath);
                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }
                fs.writeFileSync(localPath, content, 'utf-8');
                logVerbose(`已下载Agent文件: ${relativePath}`);
                // 解析 AGENT.md 元数据
                if (file.path.endsWith('AGENT.md')) {
                    const agentId = relativePath.split('/')[0];
                    const metadata = parseAgentMetadata(agentId, content);
                    if (metadata)
                        agents.push(metadata);
                }
            }
            catch (e) {
                logWarn(`Agent文件下载失败: ${file.path} - ${e.message}`);
            }
        }
    }
    else {
        // 本地模式：复制 Agent 文件
        const sourceDir = path.join(PROJECT_ROOT, agentsPath);
        if (fs.existsSync(sourceDir)) {
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
    }
    return agents;
}
// ============ 脚本分发系统 ============
/**
 * 需要分发的脚本列表（含依赖）
 */
const SCRIPTS_TO_DISTRIBUTE = [
    {
        file: 'structure-analyzer.js',
        dependencies: ['types/structure-analyzer.js', 'types/reports.js', 'report-manager.js']
    },
    {
        file: 'module-mapper.js',
        dependencies: ['types/module-mapper.js', 'types/reports.js', 'report-manager.js']
    },
    {
        file: 'report-manager.js',
        dependencies: ['types/reports.js']
    },
    {
        file: 'taskbook-manager.js',
        dependencies: ['types/index.js']
    },
    {
        file: 'task-executor.js',
        dependencies: ['types/index.js', 'taskbook-manager.js']
    },
    {
        file: 'contract-validator.js',
    },
];
/**
 * 需要分发的命令文件列表
 */
const COMMANDS_TO_DISTRIBUTE = [
    'task.md',
];
/**
 * 需要分发的 Workflow 文件
 *
 * 说明：Workflow 用于描述“步骤依赖 + 产物 + 质量闸门 + 策略”，可作为 Agent 引导，也可被未来的执行引擎强制执行。
 *
 * 分发目标目录：{project}/.codebuddy/workflows/
 */
const WORKFLOWS_TO_DISTRIBUTE = [
    { sourcePath: 'workflows/schema/workflow.schema.json', destFile: 'workflow.schema.json' },
    { sourcePath: 'workflows/templates/default.workflow.json', destFile: 'default.workflow.json' },
];
/**
 * 需要分发的 TaskBook 契约文件（JSON Schema）
 *
 * 分发目标目录：{project}/.codebuddy/taskbooks/
 */
const TASKBOOK_FILES_TO_DISTRIBUTE = [
    { sourcePath: 'taskbooks/schema/taskbook.schema.json', destFile: 'taskbook.schema.json' },
];
/**
 * 分发可执行脚本到业务项目
 */
async function distributeScripts(targetDir) {
    const distributed = [];
    const localScriptsDir = path.join(targetDir, '.codebuddy/scripts');
    // 确保目录存在
    if (!fs.existsSync(localScriptsDir)) {
        fs.mkdirSync(localScriptsDir, { recursive: true });
    }
    if (ctx.isRemote) {
        // 远程模式：从远程下载脚本及其依赖
        for (const scriptInfo of SCRIPTS_TO_DISTRIBUTE) {
            // 下载主脚本
            const scriptUrl = `${ctx.remoteBaseUrl}/scripts/dist/${scriptInfo.file}`;
            try {
                const content = await fetchUrl(scriptUrl);
                const destPath = path.join(localScriptsDir, scriptInfo.file);
                fs.writeFileSync(destPath, content, 'utf-8');
                distributed.push(scriptInfo.file);
                logVerbose(`已下载脚本: ${scriptInfo.file}`);
                // 下载依赖文件
                if (scriptInfo.dependencies) {
                    for (const dep of scriptInfo.dependencies) {
                        const depUrl = `${ctx.remoteBaseUrl}/scripts/dist/${dep}`;
                        try {
                            const depContent = await fetchUrl(depUrl);
                            const depDir = path.dirname(path.join(localScriptsDir, dep));
                            if (!fs.existsSync(depDir)) {
                                fs.mkdirSync(depDir, { recursive: true });
                            }
                            fs.writeFileSync(path.join(localScriptsDir, dep), depContent, 'utf-8');
                            logVerbose(`已下载依赖: ${dep}`);
                        }
                        catch (e) {
                            logWarn(`依赖下载失败: ${dep} - ${e.message}`);
                        }
                    }
                }
            }
            catch (e) {
                logWarn(`脚本下载失败: ${scriptInfo.file} - ${e.message}`);
            }
        }
    }
    else {
        // 本地模式：从本地复制脚本及其依赖
        const sourceDir = path.join(PROJECT_ROOT, 'scripts/dist');
        for (const scriptInfo of SCRIPTS_TO_DISTRIBUTE) {
            const srcPath = path.join(sourceDir, scriptInfo.file);
            if (fs.existsSync(srcPath)) {
                const destPath = path.join(localScriptsDir, scriptInfo.file);
                fs.copyFileSync(srcPath, destPath);
                distributed.push(scriptInfo.file);
                logVerbose(`已复制脚本: ${scriptInfo.file}`);
                // 复制依赖文件
                if (scriptInfo.dependencies) {
                    for (const dep of scriptInfo.dependencies) {
                        const depSrc = path.join(sourceDir, dep);
                        if (fs.existsSync(depSrc)) {
                            const depDir = path.dirname(path.join(localScriptsDir, dep));
                            if (!fs.existsSync(depDir)) {
                                fs.mkdirSync(depDir, { recursive: true });
                            }
                            fs.copyFileSync(depSrc, path.join(localScriptsDir, dep));
                            logVerbose(`已复制依赖: ${dep}`);
                        }
                    }
                }
            }
            else {
                logWarn(`脚本不存在: ${srcPath}`);
            }
        }
    }
    // 生成脚本使用说明
    if (distributed.length > 0) {
        const readmePath = path.join(localScriptsDir, 'README.md');
        fs.writeFileSync(readmePath, generateScriptsReadme(distributed), 'utf-8');
    }
    return distributed;
}
/**
 * 分发 Workflows 到业务项目
 */
async function distributeWorkflows(targetDir) {
    const distributed = [];
    const localWorkflowsDir = path.join(targetDir, '.codebuddy/workflows');
    if (!fs.existsSync(localWorkflowsDir)) {
        fs.mkdirSync(localWorkflowsDir, { recursive: true });
    }
    for (const wf of WORKFLOWS_TO_DISTRIBUTE) {
        const destPath = path.join(localWorkflowsDir, wf.destFile);
        if (ctx.isRemote) {
            const wfUrl = `${ctx.remoteBaseUrl}/${wf.sourcePath}`;
            try {
                const content = await fetchUrl(wfUrl);
                fs.writeFileSync(destPath, content, 'utf-8');
                distributed.push(wf.destFile);
                logVerbose(`已下载 workflow: ${wf.destFile}`);
            }
            catch (e) {
                logWarn(`workflow 下载失败: ${wf.destFile} - ${e.message}`);
            }
        }
        else {
            const srcPath = path.join(PROJECT_ROOT, wf.sourcePath);
            if (!fs.existsSync(srcPath)) {
                logWarn(`workflow 文件不存在: ${srcPath}`);
                continue;
            }
            try {
                fs.copyFileSync(srcPath, destPath);
                distributed.push(wf.destFile);
                logVerbose(`已复制 workflow: ${wf.destFile}`);
            }
            catch (e) {
                logWarn(`workflow 复制失败: ${wf.destFile} - ${e.message}`);
            }
        }
    }
    // 生成 README，降低使用门槛
    if (distributed.length > 0) {
        const readmePath = path.join(localWorkflowsDir, 'README.md');
        const readme = [
            '# Workflows',
            '',
            '本目录包含工作流规范（Workflow Spec）。',
            '',
            '- `default.workflow.json`：默认单任务闭环工作流（分析→计划→实现→测试→审查→验收）。',
            '- `workflow.schema.json`：Workflow Spec 的 JSON Schema，用于校验/CI/MCP/多工具适配。',
            '',
            '说明：早期可将其作为 Agent 的执行约束与产物清单；后期可由 Task Executor 按步骤编排并强制执行 gates。',
            '',
        ].join('\n');
        fs.writeFileSync(readmePath, readme, 'utf-8');
    }
    return distributed;
}
/**
 * 分发 TaskBooks 契约（Schema）到业务项目
 */
async function distributeTaskBooks(targetDir) {
    const distributed = [];
    const localTaskbooksDir = path.join(targetDir, '.codebuddy/taskbooks');
    if (!fs.existsSync(localTaskbooksDir)) {
        fs.mkdirSync(localTaskbooksDir, { recursive: true });
    }
    // 预创建存储目录，降低首次使用门槛
    const activeDir = path.join(localTaskbooksDir, 'active');
    const historyDir = path.join(localTaskbooksDir, 'history');
    if (!fs.existsSync(activeDir))
        fs.mkdirSync(activeDir, { recursive: true });
    if (!fs.existsSync(historyDir))
        fs.mkdirSync(historyDir, { recursive: true });
    for (const item of TASKBOOK_FILES_TO_DISTRIBUTE) {
        const destPath = path.join(localTaskbooksDir, item.destFile);
        if (ctx.isRemote) {
            const url = `${ctx.remoteBaseUrl}/${item.sourcePath}`;
            try {
                const content = await fetchUrl(url);
                fs.writeFileSync(destPath, content, 'utf-8');
                distributed.push(item.destFile);
                logVerbose(`已下载 taskbook contract: ${item.destFile}`);
            }
            catch (e) {
                logWarn(`taskbook contract 下载失败: ${item.destFile} - ${e.message}`);
            }
        }
        else {
            const srcPath = path.join(PROJECT_ROOT, item.sourcePath);
            if (!fs.existsSync(srcPath)) {
                logWarn(`taskbook contract 文件不存在: ${srcPath}`);
                continue;
            }
            try {
                fs.copyFileSync(srcPath, destPath);
                distributed.push(item.destFile);
                logVerbose(`已复制 taskbook contract: ${item.destFile}`);
            }
            catch (e) {
                logWarn(`taskbook contract 复制失败: ${item.destFile} - ${e.message}`);
            }
        }
    }
    if (distributed.length > 0) {
        const readmePath = path.join(localTaskbooksDir, 'README.md');
        const readme = [
            '# TaskBooks',
            '',
            '本目录是 **TaskBook（任务书）** 的存储与契约（SSOT）。',
            '',
            '- `active/`：进行中的 TaskBook（*.json）',
            '- `history/`：已归档的 TaskBook（*.json）',
            '- `taskbook.schema.json`：TaskBook JSON Schema（契约）',
            '',
            '建议：任何 Agent/工具写入 TaskBook 前先按 schema 校验结构，避免“行为不一致”。',
            '',
        ].join('\n');
        fs.writeFileSync(readmePath, readme, 'utf-8');
    }
    return distributed;
}
/**
 * 分发 Slash Commands 到业务项目
 */
async function distributeCommands(targetDir) {
    const distributed = [];
    const localCommandsDir = path.join(targetDir, '.codebuddy/commands');
    // 确保目录存在
    if (!fs.existsSync(localCommandsDir)) {
        fs.mkdirSync(localCommandsDir, { recursive: true });
    }
    if (ctx.isRemote) {
        // 远程模式：从远程下载命令文件
        for (const cmdFile of COMMANDS_TO_DISTRIBUTE) {
            const cmdUrl = `${ctx.remoteBaseUrl}/.claude/commands/${cmdFile}`;
            try {
                const content = await fetchUrl(cmdUrl);
                const destPath = path.join(localCommandsDir, cmdFile);
                fs.writeFileSync(destPath, content, 'utf-8');
                distributed.push(cmdFile);
                logVerbose(`已下载命令: ${cmdFile}`);
            }
            catch (e) {
                logWarn(`命令下载失败: ${cmdFile} - ${e.message}`);
            }
        }
    }
    else {
        // 本地模式：从本地复制命令文件
        const sourceDir = path.join(PROJECT_ROOT, '.claude/commands');
        for (const cmdFile of COMMANDS_TO_DISTRIBUTE) {
            const srcPath = path.join(sourceDir, cmdFile);
            if (fs.existsSync(srcPath)) {
                const destPath = path.join(localCommandsDir, cmdFile);
                fs.copyFileSync(srcPath, destPath);
                distributed.push(cmdFile);
                logVerbose(`已复制命令: ${cmdFile}`);
            }
            else {
                logWarn(`命令文件不存在: ${srcPath}`);
            }
        }
    }
    return distributed;
}
/**
 * 生成 Workflows 使用提示词
 */
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

本项目包含 **Workflow Spec**（工作流规范），用于描述“步骤依赖（DAG）+ 产物（artifacts）+ 质量闸门（gates）+ 策略（policies）”。

> 早期：可作为 Agent 的执行约束与引导；后期：可由执行引擎按规范编排并强制 gates。

## 已安装文件

${table}

## 使用约定（强建议）

1. 在创建/执行 TaskBook 前，先读取 \`.codebuddy/workflows/default.workflow.json\`。
2. 每个 step 都需要产出可验证的 artifact（例如报告、测试结果、变更说明），并写回 TaskBook 的 \`actualWork\` / 报告目录。
3. gates 失败必须进入 \`blocked\` 并记录原因，直到人工确认继续/跳过。
`;
}
/**
 * 生成 TaskBooks 契约提示词
 */
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

1. 所有任务状态变更必须写回 TaskBook（避免“口头完成”）。
2. 每个任务的可验证产出（报告/测试结果/变更说明）应记录到 \`actualWork\` 或报告目录，并在 TaskBook 中引用。
3. gates 失败必须进入 \`blocked\` 并记录原因，直到人工确认继续/跳过。
`;
}
/**
 * 生成命令使用提示词
 */
function generateCommandsPrompt(commands) {
    if (commands.length === 0)
        return '';
    let table = '| 命令 | 说明 | 触发方式 |\n|------|------|----------|\n';
    for (const cmd of commands) {
        if (cmd === 'task.md') {
            table += `| \`/task\` | 端到端计划任务编排 | \`/task 实现用户登录功能\` 或 "帮我实现xxx" |\n`;
        }
        else {
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
/**
 * 生成脚本目录的 README
 */
function generateScriptsReadme(scripts) {
    const lines = [
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
        }
        else if (script === 'contract-validator.js') {
            lines.push(`| \`${script}\` | 契约校验器（TaskBook/Workflow）| \`node .codebuddy/scripts/${script} --workflows --taskbooks\` |`);
        }
        else {
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
/**
 * 生成脚本使用提示词
 */
function generateScriptsPrompt(scripts) {
    if (scripts.length === 0)
        return '';
    let table = '| 脚本 | 说明 | 用法 |\n|------|------|------|\n';
    for (const script of scripts) {
        if (script === 'structure-analyzer.js') {
            table += `| \`${script}\` | 项目结构分析器 | \`node .codebuddy/scripts/${script} .\` |\n`;
        }
        else if (script === 'module-mapper.js') {
            table += `| \`${script}\` | 模块图谱分析器 | \`node .codebuddy/scripts/${script} .\` |\n`;
        }
        else if (script === 'report-manager.js') {
            table += `| \`${script}\` | 报告管理器 | \`node .codebuddy/scripts/${script} status\` |\n`;
        }
        else if (script === 'contract-validator.js') {
            table += `| \`${script}\` | 契约校验器（TaskBook/Workflow）| \`node .codebuddy/scripts/${script} --workflows --taskbooks\` |\n`;
        }
        else {
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
    // 解析 workflow_summary
    let workflowSummary;
    const workflowMatch = frontmatter.match(/workflow_summary:\s*\|\s*\n((?:\s+.+\n?)+)/m);
    if (workflowMatch) {
        workflowSummary = workflowMatch[1]
            .split('\n')
            .map(line => line.replace(/^\s{2}/, ''))
            .join('\n')
            .trim();
    }
    return {
        id: agentId,
        name: nameMatch[1].trim(),
        description: descMatch[1].trim(),
        triggers,
        permissions,
        workflowSummary,
    };
}
function generateAgentsPrompt(agents) {
    if (agents.length === 0)
        return '';
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
    return `
# 🤖 Agent 系统索引 (Agents Index)

本规则库支持 **Agent 执行模式**，Agent 文件已下载至 \`.codebuddy/agents/\`。

## 已安装 Agents

${agentDetails}

## 🚀 Agent 调用指南 (CodeBuddy)

当用户请求匹配上述触发场景时，请：

1. **识别意图**: 分析用户请求是否匹配上述触发词
2. **检查工作流程**: 如果 Agent 有 "必须按顺序执行" 的工作流程，**严格按步骤执行**
3. **执行脚本**: 运行工作流程中列出的脚本命令
4. **生成报告**: 合并结果输出完整报告

**重要**: 如果 Agent 定义了工作流程摘要，必须按顺序执行所有步骤，不可跳过！

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
            if (vueProfile.type === 'composition') {
                layer1Folders.push('vue2/vue2-composition.md');
            }
            else {
                layer1Folders.push('vue2/vue2-general.md');
            }
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
    // ============ 脚本分发 ============
    log('分发工具脚本...');
    const distributedScripts = await distributeScripts(targetDir);
    if (distributedScripts.length > 0) {
        log(`已分发 ${distributedScripts.length} 个脚本`);
        finalContent += generateScriptsPrompt(distributedScripts);
    }
    // ============ Workflows 分发 ============
    log('分发 Workflows...');
    const distributedWorkflows = await distributeWorkflows(targetDir);
    if (distributedWorkflows.length > 0) {
        log(`已分发 ${distributedWorkflows.length} 个工作流`);
        finalContent += generateWorkflowsPrompt(distributedWorkflows);
    }
    // ============ TaskBooks 契约分发 ============
    log('分发 TaskBook 契约...');
    const distributedTaskBooks = await distributeTaskBooks(targetDir);
    if (distributedTaskBooks.length > 0) {
        log(`已分发 ${distributedTaskBooks.length} 个 TaskBook 契约文件`);
        finalContent += generateTaskBooksPrompt(distributedTaskBooks);
    }
    // ============ 命令分发 ============
    log('分发 Slash Commands...');
    const distributedCommands = await distributeCommands(targetDir);
    if (distributedCommands.length > 0) {
        log(`已分发 ${distributedCommands.length} 个命令`);
        finalContent += generateCommandsPrompt(distributedCommands);
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
    log(`   工具脚本: ${distributedScripts.length} 个`);
    log(`   Workflows: ${distributedWorkflows.length} 个`);
    log(`   TaskBook 契约: ${distributedTaskBooks.length} 个`);
    log(`   Slash Commands: ${distributedCommands.length} 个`);
    log('═══════════════════════════════════════════════════════════════════');
}
main().catch((err) => {
    logError(`Fatal Error: ${err.message}`);
    process.exit(1);
});
