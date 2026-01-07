#!/usr/bin/env node
"use strict";
/**
 * Architect Rule Loader Script V7 (TypeScript Version)
 *
 * Features:
 * - Supports Remote Fetch Mode via --remote <URL>
 * - Task-aware progressive disclosure via --task <type>
 * - Async architecture
 * - Enhanced error handling and user-friendly messages
 * - Verbose mode for debugging
 * - Request timeout handling
 * - Full TypeScript type safety
 *
 * Usage:
 *   node rule-loader.js [options]
 *
 * Options:
 *   --help, -h        Show this help message
 *   --remote <URL>    Fetch rules from remote URL
 *   --task <type>     Filter rules by task type (progressive disclosure)
 *   --threshold <n>   Set relevance threshold (0-1, default: 0.5)
 *   --verbose, -v     Enable verbose logging for debugging
 *   --timeout <ms>    Set network request timeout in milliseconds (default: 10000)
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
// --- 路径配置 ---
const RULES_ROOT = path.resolve(__dirname, '../../rules');
const CONFIG_PATH = path.resolve(__dirname, '../../config/loader-config.json');
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_DETAIL_LEVEL = 'full';
// --- 全局上下文 ---
const ctx = {
    isRemote: false,
    isVerbose: false,
    remoteBaseUrl: '',
    remoteManifest: null,
    requestTimeout: DEFAULT_TIMEOUT,
    taskType: null,
    relevanceThreshold: DEFAULT_THRESHOLD,
    detailLevel: DEFAULT_DETAIL_LEVEL,
};
// --- 全局配置缓存 ---
let tasksConfig = null;
let detailLevelsConfig = null;
// ============ 日志工具 ============
function log(message) {
    console.log(`[Architect] ${message}`);
}
function logVerbose(message) {
    if (ctx.isVerbose) {
        console.log(`[Architect:DEBUG] ${message}`);
    }
}
function logError(message) {
    console.error(`[Architect:ERROR] ${message}`);
}
function logWarn(message) {
    console.warn(`[Architect:WARN] ${message}`);
}
// ============ 帮助信息 ============
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║      Architect Rule Loader v7 - Progressive Disclosure           ║
╚══════════════════════════════════════════════════════════════════╝

USAGE:
  node rule-loader.js [options]

OPTIONS:
  --help, -h           Show this help message and exit
  --remote <URL>       Fetch rules from a remote URL instead of local files
  --task <type>        Filter rules by task type (progressive disclosure)
                       Types: refactoring, debugging, testing, new-feature, code-review
  --threshold <n>      Set relevance threshold (0-1, default: 0.5)
                       Use 0.7 for strict filtering, 0.3 for loose filtering
  --detail-level <l>   Set content detail level (default: full)
                       Levels: summary, quick, full
  --verbose, -v        Enable verbose/debug logging
  --timeout <ms>       Set network request timeout (default: 10000ms)

TASK TYPES:
  refactoring          Code refactoring, optimization, tech debt cleanup
  debugging            Bug fixing, troubleshooting, error handling
  testing              Writing tests, test strategy, coverage
  new-feature          Developing new features, adding functionality
  code-review          Code review, PR review

DETAIL LEVELS:
  summary              Only rule summaries (minimal context)
  quick                Summaries + quick reference (daily use)
  full                 Complete content (default, for deep learning)

EXAMPLES:
  # Load all rules (default)
  node rule-loader.js

  # Load only refactoring-relevant rules
  node rule-loader.js --task refactoring

  # Strict filtering for debugging task
  node rule-loader.js --task debugging --threshold 0.7

  # Load quick reference only
  node rule-loader.js --detail-level quick

  # Remote mode with task filtering and quick reference
  node rule-loader.js --remote https://example.com/standards --task new-feature --detail-level quick

OUTPUT:
  Generates .codebuddy/.rules/project-rules.md in the current working directory.
`);
    process.exit(0);
}
// ============ 网络请求 ============
function fetchUrl(url, retries = 3) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        logVerbose(`Fetching: ${url} (Retries left: ${retries})`);
        const request = client.get(url, (res) => {
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
            res.on('data', (chunk) => {
                data += chunk.toString();
            });
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
            if (e.code === 'ETIMEDOUT' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
                logError(`Connection failed: ${e.code}`);
                logError('If you are in a restricted network region, please try using a proxy or mirror URL.');
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
            reject(new Error(`Request Timeout: ${url} did not respond within ${ctx.requestTimeout}ms`));
        });
    });
}
// ============ 任务相关性检查 ============
/**
 * 解析任务类型（支持别名）
 */
function resolveTaskType(input) {
    if (!tasksConfig)
        return null;
    const normalized = input.toLowerCase().trim();
    // 直接匹配
    if (tasksConfig.definitions[normalized]) {
        return normalized;
    }
    // 别名匹配
    for (const [taskId, def] of Object.entries(tasksConfig.definitions)) {
        if (def.aliases.includes(normalized)) {
            return taskId;
        }
    }
    return null;
}
/**
 * 获取规则的任务相关性分数
 */
function getRuleRelevance(layerId, ruleId, taskType) {
    var _a;
    if (!tasksConfig || !taskType)
        return 1.0; // 无任务筛选时，所有规则都加载
    const layerRelevance = tasksConfig.ruleRelevance[layerId];
    if (!layerRelevance)
        return DEFAULT_THRESHOLD; // 未配置的层级使用默认阈值
    const ruleRelevance = layerRelevance[ruleId];
    if (!ruleRelevance)
        return DEFAULT_THRESHOLD; // 未配置的规则使用默认阈值
    return (_a = ruleRelevance[taskType]) !== null && _a !== void 0 ? _a : DEFAULT_THRESHOLD;
}
/**
 * 检查规则是否应该加载
 */
function shouldLoadRule(layerId, ruleId) {
    if (!ctx.taskType)
        return true; // 无任务筛选时，加载所有规则
    const relevance = getRuleRelevance(layerId, ruleId, ctx.taskType);
    const shouldLoad = relevance >= ctx.relevanceThreshold;
    logVerbose(`Rule ${layerId}/${ruleId}: relevance=${relevance.toFixed(2)}, threshold=${ctx.relevanceThreshold}, load=${shouldLoad}`);
    return shouldLoad;
}
// ============ 详略级别内容解析 ============
/**
 * 根据详略级别提取规则内容
 * 使用 <!-- @level:xxx --> 标记分隔不同级别的内容
 */
function extractContentByLevel(content, level) {
    // 如果是 full 级别，返回完整内容
    if (level === 'full') {
        return content;
    }
    // 定义各级别包含的标记
    const levelMarkers = {
        summary: ['@level:summary'],
        quick: ['@level:summary', '@level:quick'],
        full: ['@level:summary', '@level:quick', '@level:full'],
    };
    const allowedMarkers = levelMarkers[level];
    // 解析内容，提取标记区块
    const markerRegex = /<!--\s*(@level:\w+)\s*-->/g;
    const sections = [];
    let lastIndex = 0;
    let lastMarker = '@level:full'; // 默认未标记的内容视为 full 级别
    let match;
    // 查找所有标记位置
    const markers = [];
    while ((match = markerRegex.exec(content)) !== null) {
        markers.push({ marker: match[1], index: match.index });
    }
    // 如果没有任何标记，根据级别决定是否返回内容
    if (markers.length === 0) {
        // 无标记的文件，返回全部内容（向后兼容）
        logVerbose(`No level markers found in content, returning full content`);
        return content;
    }
    // 提取标记前的内容（视为 summary）
    if (markers[0].index > 0) {
        const preContent = content.substring(0, markers[0].index).trim();
        if (preContent) {
            sections.push({ marker: '@level:summary', content: preContent });
        }
    }
    // 提取各标记区块
    for (let i = 0; i < markers.length; i++) {
        const currentMarker = markers[i];
        const nextMarker = markers[i + 1];
        // 计算当前区块的起始位置（跳过标记本身）
        const markerEndMatch = content.substring(currentMarker.index).match(/<!--\s*@level:\w+\s*-->/);
        const markerLength = markerEndMatch ? markerEndMatch[0].length : 0;
        const startIndex = currentMarker.index + markerLength;
        // 计算当前区块的结束位置
        const endIndex = nextMarker ? nextMarker.index : content.length;
        const sectionContent = content.substring(startIndex, endIndex).trim();
        if (sectionContent) {
            sections.push({ marker: currentMarker.marker, content: sectionContent });
        }
    }
    // 根据允许的标记过滤内容
    const filteredSections = sections.filter((section) => allowedMarkers.includes(section.marker));
    if (filteredSections.length === 0) {
        logVerbose(`No content found for level: ${level}`);
        return '';
    }
    // 合并过滤后的内容
    const result = filteredSections.map((s) => s.content).join('\n\n');
    logVerbose(`Extracted ${filteredSections.length} sections for level: ${level}`);
    return result;
}
// ============ 配置加载 ============
async function loadConfig() {
    if (ctx.isRemote) {
        try {
            const manifestUrl = `${ctx.remoteBaseUrl}/manifest.json`;
            log(`Fetching manifest from: ${manifestUrl}`);
            const data = await fetchUrl(manifestUrl);
            ctx.remoteManifest = JSON.parse(data);
            logVerbose(`Manifest loaded. Version: ${ctx.remoteManifest.version}, Files: ${ctx.remoteManifest.files.length}`);
            const config = ctx.remoteManifest.config;
            tasksConfig = config.tasks || null;
            detailLevelsConfig = config.detailLevels || null;
            return {
                LAYERS: {
                    BASE: config.layers.base,
                    BUSINESS: config.layers.business,
                    ACTION: config.layers.action,
                },
                TASKS: tasksConfig,
                DETAIL_LEVELS: detailLevelsConfig,
                OUTPUT_DIR_NAME: config.output.dirName,
                OUTPUT_FILE_NAME: config.output.fileName,
                FRONTMATTER: config.frontmatter || {},
            };
        }
        catch (e) {
            const error = e;
            logError(`Failed to fetch remote manifest: ${error.message}`);
            logError('Please ensure the URL is correct and the manifest.json is accessible.');
            process.exit(1);
        }
    }
    else {
        if (!fs.existsSync(CONFIG_PATH)) {
            logError(`Config file not found: ${CONFIG_PATH}`);
            logError('Run this script from the my-fe-standards repository root, or use --remote mode.');
            process.exit(1);
        }
        logVerbose(`Loading local config from: ${CONFIG_PATH}`);
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        tasksConfig = config.tasks || null;
        detailLevelsConfig = config.detailLevels || null;
        return {
            LAYERS: {
                BASE: config.layers.base,
                BUSINESS: config.layers.business,
                ACTION: config.layers.action,
            },
            TASKS: tasksConfig,
            DETAIL_LEVELS: detailLevelsConfig,
            OUTPUT_DIR_NAME: config.output.dirName,
            OUTPUT_FILE_NAME: config.output.fileName,
            FRONTMATTER: config.frontmatter || {},
        };
    }
}
// ============ 规则加载 ============
async function loadRulesFromFolder(layerDir, subFolder, layerId) {
    // 提取规则 ID 用于相关性检查
    const ruleId = subFolder.replace(/\.md$/, '');
    // 检查是否应该加载此规则
    if (!shouldLoadRule(layerId, ruleId)) {
        logVerbose(`Skipping rule: ${layerId}/${ruleId} (below threshold)`);
        return [];
    }
    if (ctx.isRemote) {
        const targetPathStart = `rules/${layerDir}/${subFolder}`;
        const matches = ctx.remoteManifest.files.filter((f) => f.path.startsWith(targetPathStart));
        if (matches.length === 0)
            return [];
        const contentPromises = matches.map(async (file) => {
            const fileUrl = `${ctx.remoteBaseUrl}/${file.path}`;
            try {
                const sourceLabel = file.path.split('/').slice(-2).join('/');
                const rawContent = await fetchUrl(fileUrl);
                const filteredContent = extractContentByLevel(rawContent, ctx.detailLevel);
                if (!filteredContent)
                    return '';
                return `\n<!-- Source: ${sourceLabel} -->\n${filteredContent}`;
            }
            catch (e) {
                console.warn(`[Architect] Warning: Failed to fetch ${fileUrl}`);
                return '';
            }
        });
        return Promise.all(contentPromises);
    }
    else {
        const targetPath = path.join(layerDir, subFolder);
        if (!fs.existsSync(targetPath))
            return [];
        if (targetPath.endsWith('.md')) {
            const rawContent = fs.readFileSync(targetPath, 'utf-8');
            const filteredContent = extractContentByLevel(rawContent, ctx.detailLevel);
            if (!filteredContent)
                return [];
            return [`\n<!-- Source: ${subFolder} -->\n${filteredContent}`];
        }
        if (fs.statSync(targetPath).isDirectory()) {
            const files = fs.readdirSync(targetPath);
            return files
                .filter((f) => f.endsWith('.md'))
                .map((f) => {
                const rawContent = fs.readFileSync(path.join(targetPath, f), 'utf-8');
                const filteredContent = extractContentByLevel(rawContent, ctx.detailLevel);
                if (!filteredContent)
                    return '';
                return `\n<!-- Source: ${subFolder}/${f} -->\n${filteredContent}`;
            })
                .filter((content) => content !== '');
        }
        return [];
    }
}
// ============ 辅助函数 ============
function getPackageJson(targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        logWarn(`No package.json found at: ${pkgPath}`);
        logWarn('Running without dependency detection. Only default rules will be loaded.');
        return {};
    }
    logVerbose(`Reading package.json from: ${pkgPath}`);
    try {
        return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }
    catch (e) {
        const error = e;
        logError(`Failed to parse package.json: ${error.message}`);
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
async function getSystemPrompt(targetDir, localRulesRoot) {
    if (ctx.isRemote) {
        return '';
    }
    else {
        const contextPath = path.join(localRulesRoot, '..', '.codebuddy', 'context.md');
        if (fs.existsSync(contextPath)) {
            console.log('[Architect] Loaded context.md as System Prompt.');
            return fs.readFileSync(contextPath, 'utf-8');
        }
        return '';
    }
}
// ============ 参数解析 ============
function parseArgs() {
    const args = process.argv.slice(2);
    // Help
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
    }
    // Verbose
    if (args.includes('--verbose') || args.includes('-v')) {
        ctx.isVerbose = true;
        logVerbose('Verbose mode enabled.');
    }
    // Remote
    const remoteIndex = args.indexOf('--remote');
    if (remoteIndex !== -1) {
        const url = args[remoteIndex + 1];
        if (!url || url.startsWith('-')) {
            logError('--remote requires a URL argument.');
            process.exit(1);
        }
        ctx.isRemote = true;
        ctx.remoteBaseUrl = url.replace(/\/$/, '');
        logVerbose(`Remote mode enabled. Base URL: ${ctx.remoteBaseUrl}`);
    }
    // Task
    const taskIndex = args.indexOf('--task');
    if (taskIndex !== -1) {
        const taskInput = args[taskIndex + 1];
        if (!taskInput || taskInput.startsWith('-')) {
            logError('--task requires a task type argument.');
            logError('Available types: refactoring, debugging, testing, new-feature, code-review');
            process.exit(1);
        }
        ctx.taskType = taskInput.toLowerCase().trim();
        logVerbose(`Task mode enabled. Task type: ${ctx.taskType}`);
    }
    // Threshold
    const thresholdIndex = args.indexOf('--threshold');
    if (thresholdIndex !== -1) {
        const thresholdValue = parseFloat(args[thresholdIndex + 1]);
        if (isNaN(thresholdValue) || thresholdValue < 0 || thresholdValue > 1) {
            logWarn('Invalid --threshold value (must be 0-1), using default 0.5.');
        }
        else {
            ctx.relevanceThreshold = thresholdValue;
            logVerbose(`Relevance threshold set to: ${ctx.relevanceThreshold}`);
        }
    }
    // Timeout
    const timeoutIndex = args.indexOf('--timeout');
    if (timeoutIndex !== -1) {
        const timeoutValue = parseInt(args[timeoutIndex + 1], 10);
        if (isNaN(timeoutValue) || timeoutValue <= 0) {
            logWarn('Invalid --timeout value, using default 10000ms.');
        }
        else {
            ctx.requestTimeout = timeoutValue;
            logVerbose(`Request timeout set to: ${ctx.requestTimeout}ms`);
        }
    }
    // Detail Level
    const detailLevelIndex = args.indexOf('--detail-level');
    if (detailLevelIndex !== -1) {
        const levelInput = args[detailLevelIndex + 1];
        if (!levelInput || levelInput.startsWith('-')) {
            logError('--detail-level requires a level argument.');
            logError('Available levels: summary, quick, full');
            process.exit(1);
        }
        const normalizedLevel = levelInput.toLowerCase().trim();
        if (!['summary', 'quick', 'full'].includes(normalizedLevel)) {
            logWarn(`Invalid --detail-level value: ${levelInput}`);
            logWarn('Available levels: summary, quick, full. Using default: full');
        }
        else {
            ctx.detailLevel = normalizedLevel;
            logVerbose(`Detail level set to: ${ctx.detailLevel}`);
        }
    }
}
// ============ 主函数 ============
async function main() {
    parseArgs();
    log('Architect Rule Loader v7 (Progressive Disclosure)');
    log(ctx.isRemote ? `Mode: REMOTE (${ctx.remoteBaseUrl})` : 'Mode: LOCAL');
    if (ctx.taskType) {
        log(`Task: ${ctx.taskType} (threshold: ${ctx.relevanceThreshold})`);
    }
    else {
        log('Task: ALL (no filtering)');
    }
    log(`Detail Level: ${ctx.detailLevel}`);
    const targetDir = process.cwd();
    log(`Project: ${targetDir}`);
    // 加载配置
    const { LAYERS, TASKS, OUTPUT_DIR_NAME, OUTPUT_FILE_NAME, FRONTMATTER } = await loadConfig();
    // 验证任务类型
    if (ctx.taskType && TASKS) {
        const resolvedTask = resolveTaskType(ctx.taskType);
        if (!resolvedTask) {
            logWarn(`Unknown task type: ${ctx.taskType}`);
            logWarn(`Available types: ${Object.keys(TASKS.definitions).join(', ')}`);
            logWarn('Proceeding without task filtering.');
            ctx.taskType = null;
        }
        else if (resolvedTask !== ctx.taskType) {
            log(`Task resolved: ${ctx.taskType} -> ${resolvedTask}`);
            ctx.taskType = resolvedTask;
        }
    }
    const pkg = getPackageJson(targetDir);
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    const projectDeps = Object.keys(dependencies);
    logVerbose(`Detected ${projectDeps.length} dependencies.`);
    const systemPrompt = await getSystemPrompt(targetDir, RULES_ROOT);
    // 生成 YAML frontmatter
    const updatedAt = new Date().toISOString();
    const taskInfo = ctx.taskType ? `\ntask: ${ctx.taskType}\nthreshold: ${ctx.relevanceThreshold}` : '';
    const detailInfo = `\ndetailLevel: ${ctx.detailLevel}`;
    const frontmatterBlock = `---
description: ${FRONTMATTER.description || 'Frontend Architecture Standards'}
alwaysApply: ${FRONTMATTER.alwaysApply !== undefined ? FRONTMATTER.alwaysApply : true}
enabled: ${FRONTMATTER.enabled !== undefined ? FRONTMATTER.enabled : true}
updatedAt: ${updatedAt}
provider: ${FRONTMATTER.provider || ''}${taskInfo}${detailInfo}
---

`;
    let finalContent = `${frontmatterBlock}# Architect Rule Set
> Generated by Architect Rule Loader V7 (${ctx.isRemote ? 'Remote' : 'Local'})
> Generated at: ${updatedAt}
${ctx.taskType ? `> Task Filter: ${ctx.taskType} (threshold: ${ctx.relevanceThreshold})` : '> Task Filter: None (all rules loaded)'}
> Detail Level: ${ctx.detailLevel}
> For: CodeBuddy / AI Coding Assistants

---

${systemPrompt}
`;
    let rulesLoaded = 0;
    let rulesSkipped = 0;
    // 处理 Layer 1: Base
    log('Processing Base Layer...');
    finalContent += `\n# ${LAYERS.BASE.title}\n`;
    const baseDir = ctx.isRemote ? LAYERS.BASE.id : path.join(RULES_ROOT, LAYERS.BASE.id);
    for (const folder of LAYERS.BASE.staticDeps) {
        const parts = await loadRulesFromFolder(baseDir, folder, 'layer1_base');
        if (parts.length > 0) {
            finalContent += parts.join('\n');
            rulesLoaded++;
        }
        else if (ctx.taskType) {
            rulesSkipped++;
        }
    }
    // Vue 版本特定规则
    const vueProfile = checkVueProfile(dependencies);
    if (vueProfile) {
        if (vueProfile.version === 3) {
            log('Detected Vue 3. Loading Script Setup rules.');
            const parts = await loadRulesFromFolder(baseDir, 'vue3', 'layer1_base');
            if (parts.length > 0) {
                finalContent += parts.join('\n');
                rulesLoaded++;
            }
        }
        else if (vueProfile.version === 2) {
            if (vueProfile.type === 'composition') {
                log('Detected Vue 2 + Composition API.');
                const parts = await loadRulesFromFolder(baseDir, 'vue2/vue2-composition.md', 'layer1_base');
                if (parts.length > 0) {
                    finalContent += parts.join('\n');
                    rulesLoaded++;
                }
            }
            else {
                log('Detected Vue 2 (Standard).');
                const parts = await loadRulesFromFolder(baseDir, 'vue2/vue2-general.md', 'layer1_base');
                if (parts.length > 0) {
                    finalContent += parts.join('\n');
                    rulesLoaded++;
                }
            }
        }
    }
    else {
        logWarn('No Vue detected. Skipping Vue-specific rules.');
    }
    // 处理 Layer 2: Business
    log('Processing Business Layer...');
    finalContent += `\n# ${LAYERS.BUSINESS.title}\n`;
    const bizDir = ctx.isRemote ? LAYERS.BUSINESS.id : path.join(RULES_ROOT, LAYERS.BUSINESS.id);
    for (const depKey of Object.keys(LAYERS.BUSINESS.dependencies)) {
        if (projectDeps.includes(depKey)) {
            log(`Detected ${depKey}. Loading related rules.`);
            for (const folder of LAYERS.BUSINESS.dependencies[depKey]) {
                const parts = await loadRulesFromFolder(bizDir, folder, 'layer2_business');
                if (parts.length > 0) {
                    finalContent += parts.join('\n');
                    rulesLoaded++;
                }
                else if (ctx.taskType) {
                    rulesSkipped++;
                }
            }
        }
    }
    // 处理 Layer 3: Action
    log('Processing Action Layer...');
    finalContent += `\n# ${LAYERS.ACTION.title}\n`;
    const actionDir = ctx.isRemote ? LAYERS.ACTION.id : path.join(RULES_ROOT, LAYERS.ACTION.id);
    for (const item of LAYERS.ACTION.defaults) {
        const parts = await loadRulesFromFolder(actionDir, item + '.md', 'layer3_action');
        if (parts.length > 0) {
            finalContent += parts.join('\n');
            rulesLoaded++;
        }
        else if (ctx.taskType) {
            rulesSkipped++;
        }
    }
    // 输出
    const outputDir = path.join(targetDir, OUTPUT_DIR_NAME);
    if (!fs.existsSync(outputDir))
        fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, OUTPUT_FILE_NAME);
    fs.writeFileSync(outputPath, finalContent, 'utf-8');
    log('');
    log('═══════════════════════════════════════════════════════════════════');
    log(`✅ Success! Rules written to ${outputPath}`);
    log(`   Content size: ${(finalContent.length / 1024).toFixed(2)} KB`);
    if (ctx.taskType) {
        log(`   Rules loaded: ${rulesLoaded}, Skipped: ${rulesSkipped}`);
    }
    log('═══════════════════════════════════════════════════════════════════');
}
main().catch((err) => {
    console.error('[Architect] Fatal Error:', err);
    process.exit(1);
});
