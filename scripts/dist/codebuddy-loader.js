#!/usr/bin/env node
"use strict";
/**
 * CodeBuddy 规则加载器 v3.3.0
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
const crypto_1 = require("crypto");
const logger_1 = require("./lib/logger");
const fetcher_1 = require("./lib/fetcher");
const distributor_1 = require("./lib/distributor");
const distribution_profiles_1 = require("./lib/distribution-profiles");
const install_sync_1 = require("./lib/install-sync");
const install_health_1 = require("./lib/install-health");
const remote_content_pack_1 = require("./lib/remote-content-pack");
const metadata_parser_1 = require("./lib/metadata-parser");
const prompt_builder_1 = require("./lib/prompt-builder");
// ============ 配置常量 ============
const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
const RULES_ROOT = path.join(PROJECT_ROOT, 'rules');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'loader-config.json');
const SKILLS_ROOT = path.join(PROJECT_ROOT, 'custom-skills');
const AGENTS_ROOT = path.join(PROJECT_ROOT, 'agents');
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_RULE_LEVEL = 'full';
const DEFAULT_PROFILE = 'analysis';
const INSTALL_STATE_SCHEMA_VERSION = '1.2.0';
const SKILL_SNAPSHOT_RETAIN_COUNT = 3;
const AGENT_SNAPSHOT_RETAIN_COUNT = 3;
const COMMANDS = new Set(['install', 'status', 'doctor']);
const INSTALL_PROFILES = ['core', 'analysis', 'orchestrator', 'full'];
const WORKSPACE_SCOPES = ['workspace-union', 'project-targeted'];
const SKILL_ROLES = ['frontend', 'backend', 'fullstack', 'qa', 'architect', 'product', 'devops'];
const LOADER_DISPLAY_VERSION = 'v3.3.0';
// ============ 帮助信息 ============
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║     CodeBuddy 规则加载器 ${LOADER_DISPLAY_VERSION} - 三层架构 + 技能系统        ║
╚══════════════════════════════════════════════════════════════════╝

用法：
  node codebuddy-loader.js [command] [options]

命令：
  install              安装/同步 CodeBuddy 规则和运行时（默认）
  status               显示当前项目的 CodeBuddy 安装状态
  doctor               诊断当前项目的 CodeBuddy 安装问题

选项：
  --help, -h           显示帮助信息
  --json               status / doctor 输出 JSON
  --remote <URL>       从远程 URL 获取规则
  --remote-bearer-token <token>
                       远程请求附带 Bearer Token（也支持环境变量 CODEBUDDY_REMOTE_BEARER_TOKEN）
  --pack-only          远程模式只允许使用 manifest.packs 内容包，不回退逐文件拉取
  --strict-pack-only   --pack-only 的兼容别名
  --task <type>        按任务类型筛选规则（渐进式披露）
                       类型: refactoring, debugging, testing, new-feature, code-review
  --threshold <n>      设置相关性阈值 (0-1, 默认: 0.5)
  --rule-level <lvl>   规则内容裁剪等级（基于 @level:summary/quick/full 分段标记，默认: full）
  --profile <name>     分发档位: core | analysis | orchestrator | full（默认: analysis）
  --enable-orchestrator 兼容旧参数，等价于旧版完整分发（即 --profile full）
  --no-workspace       禁用 workspace 多项目自动发现
  --workspace-scope <scope>
                       Workspace 分发范围: workspace-union | project-targeted（默认: workspace-union）
  --project <selector> project-targeted 模式下锁定目标项目（名称/路径/目录别名）
  --role <role>        按岗位过滤技能: frontend | backend | fullstack | qa | architect | product | devops
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

  # 查看当前项目安装状态
  node codebuddy-loader.js status

  # 诊断安装问题（JSON 输出）
  node codebuddy-loader.js doctor --json

  # 仅加载重构相关规则
  node codebuddy-loader.js --task refactoring

  # 只安装最小运行时
  node codebuddy-loader.js --profile core

  # 安装完整运行时
  node codebuddy-loader.js --profile full

  # Workspace 共享安装
  node codebuddy-loader.js --workspace-scope workspace-union

  # Workspace 锁定某个子项目
  node codebuddy-loader.js --workspace-scope project-targeted --project packages/api

  # 仅安装后端岗位相关技能
  node codebuddy-loader.js --role backend

  # 从远程加载
  node codebuddy-loader.js --remote https://example.com/standards

  # 从受保护远程源加载并强制使用内容包
  node codebuddy-loader.js --remote https://example.com/standards --pack-only --remote-bearer-token YOUR_TOKEN

输出：
  在当前工作目录生成 .codebuddy/rules/project-rules.md
`);
    process.exit(0);
}
// ============ 配置加载 ============
async function loadConfig(ctx, logger) {
    if (ctx.isRemote) {
        try {
            const manifestUrl = `${ctx.remoteBaseUrl}/manifest.json`;
            logger.log(`正在从远程加载配置: ${manifestUrl}`);
            const data = await (0, fetcher_1.fetchUrl)(ctx, logger, manifestUrl);
            const manifest = JSON.parse(data);
            logger.verbose(`Manifest 加载成功. Version: ${manifest.version}`);
            return { config: manifest.config, manifest };
        }
        catch (e) {
            logger.error(`远程 manifest 加载失败: ${e.message}`);
            process.exit(1);
        }
    }
    else {
        if (!fs.existsSync(CONFIG_PATH)) {
            logger.error(`配置文件不存在: ${CONFIG_PATH}`);
            process.exit(1);
        }
        logger.verbose(`加载本地配置: ${CONFIG_PATH}`);
        return { config: JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')), manifest: null };
    }
}
// ============ 项目依赖检测 ============
function getPackageJson(logger, targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        logger.warn(`未找到 package.json: ${pkgPath}`);
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }
    catch (e) {
        logger.error(`解析 package.json 失败: ${e.message}`);
        return {};
    }
}
function getLoaderVersion(ctx, logger) {
    var _a;
    if ((_a = ctx.remoteManifest) === null || _a === void 0 ? void 0 : _a.version) {
        return ctx.remoteManifest.version;
    }
    if (!fs.existsSync(PACKAGE_JSON_PATH)) {
        logger.warn(`未找到 loader package.json: ${PACKAGE_JSON_PATH}`);
        return '0.0.0';
    }
    try {
        const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
        return pkg.version || '0.0.0';
    }
    catch (error) {
        logger.warn(`读取 loader package.json 失败: ${error.message}`);
        return '0.0.0';
    }
}
function createInstallSnapshotId() {
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d+Z$/, 'Z');
    const entropy = (0, crypto_1.createHash)('sha256')
        .update(`${process.pid}-${Math.random()}-${Date.now()}`)
        .digest('hex')
        .slice(0, 8);
    return `${timestamp}-${entropy}`;
}
function buildSnapshotSortKey(name, absolutePath) {
    if (/^\d{8}T\d{6}Z-[a-f0-9]+$/i.test(name)) {
        return `0-${name}`;
    }
    try {
        const stat = fs.statSync(absolutePath);
        return `1-${String(Math.trunc(stat.mtimeMs)).padStart(16, '0')}-${name}`;
    }
    catch (_a) {
        return `2-${name}`;
    }
}
function listSnapshotEntries(targetDir, snapshotRootDir) {
    const snapshotsRoot = path.join(targetDir, snapshotRootDir);
    if (!fs.existsSync(snapshotsRoot)) {
        return [];
    }
    return fs.readdirSync(snapshotsRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => {
        const absolutePath = path.join(snapshotsRoot, entry.name);
        return {
            name: entry.name,
            absolutePath,
            relativePath: (0, install_sync_1.toProjectRelativePath)(targetDir, absolutePath),
            sortKey: buildSnapshotSortKey(entry.name, absolutePath),
        };
    })
        .sort((left, right) => right.sortKey.localeCompare(left.sortKey));
}
function gcSnapshotEntries(targetDir, snapshotRootDir, activeRootDir, retainCount, logger) {
    if (!activeRootDir) {
        return [];
    }
    const normalizedRetainCount = Math.max(1, retainCount);
    const entries = listSnapshotEntries(targetDir, snapshotRootDir);
    if (entries.length <= normalizedRetainCount) {
        return [];
    }
    const keep = new Set();
    const activeEntry = entries.find(entry => entry.relativePath === activeRootDir);
    if (activeEntry) {
        keep.add(activeEntry.relativePath);
    }
    else {
        keep.add(activeRootDir);
    }
    for (const entry of entries) {
        if (keep.has(entry.relativePath)) {
            continue;
        }
        keep.add(entry.relativePath);
        if (keep.size >= normalizedRetainCount) {
            break;
        }
    }
    const removed = [];
    for (const entry of entries) {
        if (keep.has(entry.relativePath)) {
            continue;
        }
        try {
            if ((0, install_sync_1.removeManagedPath)(targetDir, entry.absolutePath)) {
                removed.push(entry.relativePath);
            }
        }
        catch (error) {
            logger.warn(`清理旧技能快照失败: ${entry.relativePath} - ${error.message}`);
        }
    }
    return removed.sort();
}
function buildInstallState(params) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { ctx, logger, targetDir, outputPath, workspaceIndexPath, skillsRootDir, skillsSnapshotRetention, agentsRootDir, agentsSnapshotRetention, layer1RulesCount, layer2IndexCount, layer3IndexCount, skillsCount, agentsCount, distributedScripts, distributedWorkflows, distributedTaskBooks, distributedAgentCalls, distributedCommands, managedFiles, workspaceInfo, } = params;
    const version = getLoaderVersion(ctx, logger);
    const installedAt = new Date().toISOString();
    const profile = ctx.profile;
    const mode = ctx.isRemote ? 'remote' : 'local';
    const rulesFile = (0, install_sync_1.toProjectRelativePath)(targetDir, outputPath);
    const workspaceIndexFile = workspaceIndexPath
        ? (0, install_sync_1.toProjectRelativePath)(targetDir, workspaceIndexPath)
        : null;
    const normalizedManagedFiles = managedFiles
        .map(file => ({ path: file.path, sha256: file.sha256, size: file.size }))
        .sort((left, right) => left.path.localeCompare(right.path));
    const stableManagedFiles = normalizedManagedFiles.filter(file => file.path !== rulesFile && file.path !== workspaceIndexFile);
    const hashPayload = {
        version,
        mode,
        profile,
        enableOrchestrator: ctx.enableOrchestrator,
        source: {
            remoteBaseUrl: ctx.isRemote ? ctx.remoteBaseUrl : null,
            manifestVersion: ((_a = ctx.remoteManifest) === null || _a === void 0 ? void 0 : _a.version) || null,
            contentPackFile: ((_b = ctx.remoteContentPack) === null || _b === void 0 ? void 0 : _b.file) || null,
            contentPackFormat: ((_c = ctx.remoteContentPack) === null || _c === void 0 ? void 0 : _c.format) || null,
            contentPackSha256: ((_d = ctx.remoteContentPack) === null || _d === void 0 ? void 0 : _d.sha256) || null,
        },
        options: {
            taskType: ctx.taskType,
            ruleLevel: ctx.ruleLevel,
            strictRemotePack: ctx.strictRemotePack,
            relevanceThreshold: ctx.relevanceThreshold,
            workspaceDiscovery: !ctx.disableWorkspace,
            workspaceScope: ctx.workspaceScope,
            targetProject: ctx.targetProject,
            targetRole: ctx.targetRole,
        },
        outputs: {
            rulesFile,
            workspaceIndexFile,
            skillsRootDir,
            skillsSnapshotRetention,
            agentsRootDir,
            agentsSnapshotRetention,
        },
        managedFiles: stableManagedFiles,
        stats: {
            layer1Rules: layer1RulesCount,
            layer2Indexes: layer2IndexCount,
            layer3Indexes: layer3IndexCount,
            skills: skillsCount,
            agents: agentsCount,
            scripts: distributedScripts.slice().sort(),
            workflows: distributedWorkflows.slice().sort(),
            taskbooks: distributedTaskBooks.slice().sort(),
            agentCalls: distributedAgentCalls.slice().sort(),
            commands: distributedCommands.slice().sort(),
            workspaceProjects: workspaceInfo.projects.map(project => project.relativePath).sort(),
        },
    };
    const contentHash = (0, crypto_1.createHash)('sha256')
        .update(JSON.stringify(hashPayload))
        .digest('hex');
    return {
        schemaVersion: INSTALL_STATE_SCHEMA_VERSION,
        version,
        installedAt,
        mode,
        profile,
        enableOrchestrator: ctx.enableOrchestrator,
        contentHash,
        source: {
            remoteBaseUrl: ctx.isRemote ? ctx.remoteBaseUrl : null,
            manifestVersion: ((_e = ctx.remoteManifest) === null || _e === void 0 ? void 0 : _e.version) || null,
            contentPackFile: ((_f = ctx.remoteContentPack) === null || _f === void 0 ? void 0 : _f.file) || null,
            contentPackFormat: ((_g = ctx.remoteContentPack) === null || _g === void 0 ? void 0 : _g.format) || null,
            contentPackSha256: ((_h = ctx.remoteContentPack) === null || _h === void 0 ? void 0 : _h.sha256) || null,
        },
        options: {
            taskType: ctx.taskType,
            ruleLevel: ctx.ruleLevel,
            strictRemotePack: ctx.strictRemotePack,
            relevanceThreshold: ctx.relevanceThreshold,
            workspaceDiscovery: !ctx.disableWorkspace,
            workspaceScope: ctx.workspaceScope,
            targetProject: ctx.targetProject,
            targetRole: ctx.targetRole,
        },
        outputs: {
            rulesFile,
            workspaceIndexFile,
            skillsRootDir,
            skillsSnapshotRetention,
            agentsRootDir,
            agentsSnapshotRetention,
        },
        managedFiles: normalizedManagedFiles,
        stats: {
            layer1Rules: layer1RulesCount,
            layer2Indexes: layer2IndexCount,
            layer3Indexes: layer3IndexCount,
            skills: skillsCount,
            agents: agentsCount,
            scripts: distributedScripts.length,
            workflows: distributedWorkflows.length,
            taskbooks: distributedTaskBooks.length,
            agentCalls: distributedAgentCalls.length,
            commands: distributedCommands.length,
            workspaceProjects: workspaceInfo.projects.length,
        },
    };
}
function writeInstallState(targetDir, installState) {
    const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
    const installStateDir = path.dirname(installStatePath);
    if (!fs.existsSync(installStateDir)) {
        fs.mkdirSync(installStateDir, { recursive: true });
    }
    fs.writeFileSync(installStatePath, JSON.stringify(installState, null, 2), 'utf-8');
    return installStatePath;
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
// ============ Workspace 多项目发现 ============
/** 应排除的目录名 */
const WORKSPACE_EXCLUDE_DIRS = new Set([
    'node_modules', 'dist', 'build', '.codebuddy', '.git',
    'coverage', '.next', '.nuxt', '.output', '.cache',
]);
/** 最大发现子项目数 */
const MAX_SUB_PROJECTS = 20;
const PROJECT_MARKERS = [
    {
        files: ['package.json'], lang: 'javascript', refinements: [
            { files: ['tsconfig.json'], lang: 'typescript' },
        ]
    },
    { files: ['pom.xml'], lang: 'java' },
    { files: ['build.gradle', 'build.gradle.kts'], lang: 'java' },
    { files: ['go.mod'], lang: 'go' },
    { files: ['pyproject.toml', 'setup.py'], lang: 'python' },
    { files: ['Cargo.toml'], lang: 'rust' },
    // .NET: *.csproj 通过单独逻辑检测（通配符）
];
/**
 * 检测框架标签
 */
/** 已知 UI 库映射（包名 → 显示名） */
const KNOWN_UI_LIBS = {
    'ant-design-vue': 'Ant Design Vue',
    'vant': 'Vant',
    'element-plus': 'Element Plus',
    'element-ui': 'Element UI',
    'naive-ui': 'Naive UI',
    'vuetify': 'Vuetify',
    '@arco-design/web-vue': 'Arco Design Vue',
    'antd': 'Ant Design',
    '@mui/material': 'MUI',
};
/**
 * 检测项目使用的 UI 库
 */
function detectUILibs(deps) {
    const result = [];
    for (const [pkg, label] of Object.entries(KNOWN_UI_LIBS)) {
        if (deps[pkg]) {
            result.push(label);
        }
    }
    return result;
}
function normalizeStackTag(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function finalizeStackTags(values) {
    return [...new Set([...values].map(normalizeStackTag).filter(Boolean))].sort();
}
function readProjectFileIfExists(filePath) {
    try {
        return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    }
    catch (_a) {
        return '';
    }
}
function detectNodePackageManagers(projectDir) {
    const markers = [
        { file: 'pnpm-lock.yaml', tag: 'pnpm' },
        { file: 'yarn.lock', tag: 'yarn' },
        { file: 'package-lock.json', tag: 'npm' },
        { file: 'bun.lockb', tag: 'bun' },
        { file: 'bun.lock', tag: 'bun' },
    ];
    return markers
        .filter(marker => fs.existsSync(path.join(projectDir, marker.file)))
        .map(marker => marker.tag);
}
const NODE_BACKEND_STRONG_ENTRY_FILES = [
    'src/server.ts',
    'src/server.js',
    'src/server.mjs',
    'src/server.cjs',
    'server.ts',
    'server.js',
    'server.mjs',
    'server.cjs',
];
const NODE_BACKEND_WEAK_ENTRY_FILES = [
    'src/main.ts',
    'src/main.js',
    'src/app.ts',
    'src/app.js',
    'main.ts',
    'main.js',
    'app.ts',
    'app.js',
    'index.ts',
    'index.js',
];
const NODE_BACKEND_LAYOUT_DIRS = [
    'src/routes',
    'src/controllers',
    'src/middleware',
    'src/handlers',
    'src/api',
    'routes',
    'controllers',
    'middleware',
    'handlers',
    'api',
];
function detectGenericNodeBackendProject(projectDir, packageJson) {
    const scripts = packageJson.scripts || {};
    const scriptValues = Object.values(scripts).filter((value) => typeof value === 'string');
    const hasBackendScript = scriptValues.some(command => /(node|nodemon|tsx|ts-node|ts-node-dev|bun|pm2)/i.test(command)
        && /(server|api|listen|http)/i.test(command));
    for (const relativePath of NODE_BACKEND_STRONG_ENTRY_FILES) {
        if (fs.existsSync(path.join(projectDir, relativePath))) {
            return true;
        }
    }
    for (const relativePath of NODE_BACKEND_WEAK_ENTRY_FILES) {
        const absolutePath = path.join(projectDir, relativePath);
        if (!fs.existsSync(absolutePath)) {
            continue;
        }
        const content = readProjectFileIfExists(absolutePath);
        if (/(createServer|listen\s*\(|process\.env\.PORT|IncomingMessage|ServerResponse)/.test(content)) {
            return true;
        }
    }
    const layoutClues = NODE_BACKEND_LAYOUT_DIRS.filter(relativePath => fs.existsSync(path.join(projectDir, relativePath))).length;
    if (layoutClues >= 2) {
        return true;
    }
    return hasBackendScript && layoutClues >= 1;
}
function detectJavaProjectMetadata(projectDir) {
    const pomContent = readProjectFileIfExists(path.join(projectDir, 'pom.xml'));
    const gradleContent = readProjectFileIfExists(path.join(projectDir, 'build.gradle'))
        || readProjectFileIfExists(path.join(projectDir, 'build.gradle.kts'));
    const combinedContent = `${pomContent}\n${gradleContent}`.toLowerCase();
    const stackTags = new Set(['java']);
    if (pomContent)
        stackTags.add('maven');
    if (gradleContent)
        stackTags.add('gradle');
    let frameworkLabel = '';
    let projectKind = 'library';
    if (/org\.springframework\.boot|spring-boot/.test(combinedContent)) {
        frameworkLabel = 'Spring Boot';
        projectKind = 'backend';
        stackTags.add('springboot');
        stackTags.add('spring');
    }
    else if (/io\.quarkus|quarkus/.test(combinedContent)) {
        frameworkLabel = 'Quarkus';
        projectKind = 'backend';
        stackTags.add('quarkus');
    }
    else if (/io\.micronaut|micronaut/.test(combinedContent)) {
        frameworkLabel = 'Micronaut';
        projectKind = 'backend';
        stackTags.add('micronaut');
    }
    else if (/jakarta\.ws\.rs|javax\.ws\.rs/.test(combinedContent)) {
        frameworkLabel = 'Jakarta REST';
        projectKind = 'backend';
        stackTags.add('jakartarest');
    }
    if (/spring-data-jpa|starter-data-jpa|hibernate-core|jakarta\.persistence|javax\.persistence/.test(combinedContent)) {
        stackTags.add('jpa');
    }
    if (/mybatis/.test(combinedContent)) {
        stackTags.add('mybatis');
    }
    return {
        frameworkLabel,
        uiLibLabels: [],
        projectKind,
        stackTags: finalizeStackTags(stackTags),
    };
}
function detectRustProjectMetadata(projectDir) {
    const cargoContent = readProjectFileIfExists(path.join(projectDir, 'Cargo.toml'));
    const normalizedContent = cargoContent.toLowerCase();
    const stackTags = new Set(['rust', 'cargo']);
    let frameworkLabel = '';
    let projectKind = 'library';
    if (/\baxum\b/.test(normalizedContent)) {
        frameworkLabel = 'Axum';
        projectKind = 'backend';
        stackTags.add('axum');
    }
    else if (/actix-web/.test(normalizedContent)) {
        frameworkLabel = 'Actix Web';
        projectKind = 'backend';
        stackTags.add('actixweb');
    }
    else if (/\brocket\b/.test(normalizedContent)) {
        frameworkLabel = 'Rocket';
        projectKind = 'backend';
        stackTags.add('rocket');
    }
    else if (/\btonic\b/.test(normalizedContent)) {
        frameworkLabel = 'Tonic';
        projectKind = 'backend';
        stackTags.add('tonic');
    }
    if (/\btokio\b/.test(normalizedContent))
        stackTags.add('tokio');
    if (/\bserde\b/.test(normalizedContent))
        stackTags.add('serde');
    if (/^\s*\[workspace\]/m.test(cargoContent))
        stackTags.add('cargoworkspace');
    return {
        frameworkLabel,
        uiLibLabels: [],
        projectKind,
        stackTags: finalizeStackTags(stackTags),
    };
}
function detectDotnetProjectMetadata(projectDir) {
    const projectFiles = fs.readdirSync(projectDir)
        .filter(entry => entry.endsWith('.csproj') || entry.endsWith('.fsproj'));
    const combinedContent = projectFiles
        .map(file => readProjectFileIfExists(path.join(projectDir, file)))
        .join('\n')
        .toLowerCase();
    const stackTags = new Set(['dotnet']);
    let frameworkLabel = '';
    let projectKind = 'library';
    if (/microsoft\.aspnetcore|aspnetcore/.test(combinedContent)) {
        frameworkLabel = 'ASP.NET Core';
        projectKind = 'backend';
        stackTags.add('aspnetcore');
    }
    else if (/microsoft\.aspnetcore\.components|blazor/.test(combinedContent)) {
        frameworkLabel = 'Blazor';
        projectKind = 'frontend';
        stackTags.add('blazor');
    }
    return {
        frameworkLabel,
        uiLibLabels: [],
        projectKind,
        stackTags: finalizeStackTags(stackTags),
    };
}
function detectGenericProjectMetadata(lang) {
    return {
        frameworkLabel: '',
        uiLibLabels: [],
        projectKind: 'unknown',
        stackTags: finalizeStackTags([lang]),
    };
}
function detectNodeProjectMetadata(projectDir, packageJson, lang) {
    const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };
    const vueProfile = checkVueProfile(dependencies);
    const uiLibLabels = detectUILibs(dependencies);
    const stackTags = new Set([lang, 'nodejs', ...detectNodePackageManagers(projectDir)]);
    const detectedKinds = new Set();
    let frameworkLabel = '';
    const markFramework = (label, kind, ...tags) => {
        if (!frameworkLabel)
            frameworkLabel = label;
        detectedKinds.add(kind);
        for (const tag of tags)
            stackTags.add(tag);
    };
    if (packageJson.type === 'module')
        stackTags.add('esm');
    if (packageJson.workspaces)
        stackTags.add('monorepo');
    if (dependencies['vite'])
        stackTags.add('vite');
    if (dependencies['webpack'])
        stackTags.add('webpack');
    if (dependencies['next'])
        markFramework('Next.js', 'fullstack', 'nextjs');
    if (dependencies['nuxt'] || dependencies['nuxt3'])
        markFramework(frameworkLabel || 'Nuxt', 'fullstack', 'nuxt');
    if (dependencies['@remix-run/node'] || dependencies['@remix-run/react']) {
        markFramework(frameworkLabel || 'Remix', 'fullstack', 'remix');
    }
    if (dependencies['@nestjs/core'])
        markFramework(frameworkLabel || 'NestJS', 'backend', 'nestjs');
    if (dependencies['express'])
        markFramework(frameworkLabel || 'Express', 'backend', 'express');
    if (dependencies['fastify'])
        markFramework(frameworkLabel || 'Fastify', 'backend', 'fastify');
    if (dependencies['koa'])
        markFramework(frameworkLabel || 'Koa', 'backend', 'koa');
    if (dependencies['hono'])
        markFramework(frameworkLabel || 'Hono', 'backend', 'hono');
    if (dependencies['vue']) {
        const vueTags = (vueProfile === null || vueProfile === void 0 ? void 0 : vueProfile.version) === 3
            ? ['vue', 'vue3']
            : (vueProfile === null || vueProfile === void 0 ? void 0 : vueProfile.version) === 2
                ? ['vue', 'vue2']
                : ['vue'];
        markFramework(frameworkLabel || ((vueProfile === null || vueProfile === void 0 ? void 0 : vueProfile.version) === 3 ? 'Vue 3' : (vueProfile === null || vueProfile === void 0 ? void 0 : vueProfile.version) === 2 ? 'Vue 2' : 'Vue'), 'frontend', ...vueTags);
    }
    if (dependencies['react'])
        markFramework(frameworkLabel || 'React', 'frontend', 'react');
    if (dependencies['@angular/core'])
        markFramework(frameworkLabel || 'Angular', 'frontend', 'angular');
    if (dependencies['svelte'])
        markFramework(frameworkLabel || 'Svelte', 'frontend', 'svelte');
    if (!detectedKinds.has('backend') && !detectedKinds.has('frontend') && detectGenericNodeBackendProject(projectDir, packageJson)) {
        markFramework(frameworkLabel || 'Node Service', 'backend', 'nodeservice');
    }
    for (const uiLibLabel of uiLibLabels) {
        stackTags.add(uiLibLabel);
    }
    let projectKind = 'library';
    if (detectedKinds.has('fullstack') || (detectedKinds.has('frontend') && detectedKinds.has('backend'))) {
        projectKind = 'fullstack';
    }
    else if (detectedKinds.has('backend')) {
        projectKind = 'backend';
    }
    else if (detectedKinds.has('frontend')) {
        projectKind = 'frontend';
    }
    return {
        dependencies,
        vueProfile,
        frameworkLabel,
        uiLibLabels,
        projectKind,
        stackTags: finalizeStackTags(stackTags),
    };
}
function detectProjectMetadata(projectDir, lang, packageJson) {
    if (packageJson) {
        return detectNodeProjectMetadata(projectDir, packageJson, lang);
    }
    const metadata = (() => {
        switch (lang) {
            case 'java':
                return detectJavaProjectMetadata(projectDir);
            case 'rust':
                return detectRustProjectMetadata(projectDir);
            case 'dotnet':
                return detectDotnetProjectMetadata(projectDir);
            default:
                return detectGenericProjectMetadata(lang);
        }
    })();
    return {
        dependencies: {},
        vueProfile: null,
        ...metadata,
    };
}
/**
 * 从 targetDir 递归扫描子项目
 *
 * - 最多扫描 2 层深度
 * - 排除 node_modules、dist 等目录
 * - 防循环：维护 visited Set（处理 symlink）
 * - 超过 MAX_SUB_PROJECTS 截断并警告
 */
function discoverWorkspace(logger, targetDir) {
    const projects = [];
    const visited = new Set();
    /**
     * 递归扫描目录
     * @param dir 当前目录
     * @param depth 当前深度（0 = targetDir 本身）
     */
    function scan(dir, depth) {
        if (depth > 2)
            return;
        if (projects.length >= MAX_SUB_PROJECTS)
            return;
        // 防循环：解析真实路径
        let realDir;
        try {
            realDir = fs.realpathSync(dir);
        }
        catch (_a) {
            return;
        }
        if (visited.has(realDir))
            return;
        visited.add(realDir);
        // 检测当前目录是否为项目（多语言标志文件检测）
        const relativePath = path.relative(targetDir, dir).replace(/\\/g, '/') || '.';
        let detected = false;
        // 按 PROJECT_MARKERS 优先级逐个检测
        for (const marker of PROJECT_MARKERS) {
            const markerFile = marker.files.find(f => fs.existsSync(path.join(dir, f)));
            if (!markerFile)
                continue;
            // 匹配到标志文件
            let lang = marker.lang;
            // 细化语言（如 JS → TS）
            if (marker.refinements) {
                for (const ref of marker.refinements) {
                    if (ref.files.some(f => fs.existsSync(path.join(dir, f)))) {
                        lang = ref.lang;
                        break;
                    }
                }
            }
            if (markerFile === 'package.json') {
                // JS/TS 项目：解析 package.json
                try {
                    const pkgContent = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
                    const metadata = detectProjectMetadata(dir, lang, pkgContent);
                    projects.push({
                        name: pkgContent.name || path.basename(dir),
                        relativePath,
                        absolutePath: dir,
                        lang,
                        packageJson: pkgContent,
                        vueProfile: metadata.vueProfile,
                        dependencies: metadata.dependencies,
                        matchedLayer2Rules: [],
                        frameworkLabel: metadata.frameworkLabel,
                        uiLibLabels: metadata.uiLibLabels,
                        projectKind: metadata.projectKind,
                        stackTags: metadata.stackTags,
                    });
                }
                catch (_b) {
                    logger.warn(`解析 package.json 失败: ${path.join(dir, 'package.json')}`);
                }
            }
            else {
                // 非 JS 项目：用目录名作为项目名
                const metadata = detectProjectMetadata(dir, lang);
                projects.push({
                    name: path.basename(dir),
                    relativePath,
                    absolutePath: dir,
                    lang,
                    vueProfile: metadata.vueProfile,
                    dependencies: metadata.dependencies,
                    matchedLayer2Rules: [],
                    frameworkLabel: metadata.frameworkLabel,
                    uiLibLabels: metadata.uiLibLabels,
                    projectKind: metadata.projectKind,
                    stackTags: metadata.stackTags,
                });
            }
            detected = true;
            break; // 匹配即停
        }
        // .NET 项目特殊检测（通配符 *.csproj）
        if (!detected) {
            try {
                const entries = fs.readdirSync(dir);
                const hasCsproj = entries.some(e => e.endsWith('.csproj') || e.endsWith('.sln'));
                if (hasCsproj) {
                    const metadata = detectProjectMetadata(dir, 'dotnet');
                    projects.push({
                        name: path.basename(dir),
                        relativePath,
                        absolutePath: dir,
                        lang: 'dotnet',
                        vueProfile: metadata.vueProfile,
                        dependencies: metadata.dependencies,
                        matchedLayer2Rules: [],
                        frameworkLabel: metadata.frameworkLabel,
                        uiLibLabels: metadata.uiLibLabels,
                        projectKind: metadata.projectKind,
                        stackTags: metadata.stackTags,
                    });
                    detected = true;
                }
            }
            catch (_c) {
                // 无法访问，跳过
            }
        }
        // 继续扫描子目录
        if (depth < 2) {
            let entries;
            try {
                entries = fs.readdirSync(dir);
            }
            catch (_d) {
                return;
            }
            for (const entry of entries) {
                // 排除隐藏目录和已知无关目录
                if (entry.startsWith('.') || WORKSPACE_EXCLUDE_DIRS.has(entry))
                    continue;
                const childPath = path.join(dir, entry);
                try {
                    const stat = fs.statSync(childPath);
                    if (stat.isDirectory()) {
                        scan(childPath, depth + 1);
                    }
                }
                catch (_e) {
                    // 无法访问的目录，跳过
                }
            }
        }
    }
    scan(targetDir, 0);
    if (projects.length >= MAX_SUB_PROJECTS) {
        logger.warn(`子项目数量已达上限 ${MAX_SUB_PROJECTS}，后续子项目被截断`);
    }
    const isWorkspace = projects.length > 1;
    if (isWorkspace) {
        logger.log(`发现 Workspace 模式：${projects.length} 个子项目`);
        for (const p of projects) {
            const label = [p.lang, p.frameworkLabel, ...p.uiLibLabels].filter(Boolean).join(' + ');
            logger.verbose(`  - ${p.relativePath} (${label || '无框架检测'})`);
        }
    }
    return {
        isWorkspace,
        rootDir: targetDir,
        projects,
        discoveredAt: new Date().toISOString(),
        scope: 'workspace-union',
        selectedProject: null,
        totalProjectCount: projects.length,
    };
}
function normalizeSelector(value) {
    return value.trim().toLowerCase().replace(/\\/g, '/');
}
function normalizeStackLabel(value) {
    return normalizeStackTag(value);
}
function detectProjectLangFromDir(projectDir) {
    for (const marker of PROJECT_MARKERS) {
        const markerFile = marker.files.find(file => fs.existsSync(path.join(projectDir, file)));
        if (!markerFile)
            continue;
        let lang = marker.lang;
        if (marker.refinements) {
            for (const refinement of marker.refinements) {
                if (refinement.files.some(file => fs.existsSync(path.join(projectDir, file)))) {
                    lang = refinement.lang;
                    break;
                }
            }
        }
        return lang;
    }
    try {
        const entries = fs.readdirSync(projectDir);
        if (entries.some(entry => entry.endsWith('.csproj') || entry.endsWith('.fsproj'))) {
            return 'dotnet';
        }
    }
    catch (_a) {
        return 'unknown';
    }
    return 'unknown';
}
function getProjectAliases(project) {
    const aliases = new Set();
    aliases.add(project.relativePath);
    aliases.add(project.name);
    aliases.add(project.relativePath.split('/').pop() || project.relativePath);
    if (project.relativePath === '.') {
        aliases.add('root');
        aliases.add('.');
    }
    return [...aliases].map(normalizeSelector).filter(Boolean);
}
function resolveTargetProject(workspaceInfo, selector) {
    const normalizedSelector = normalizeSelector(selector);
    if (!normalizedSelector)
        return null;
    const exact = workspaceInfo.projects.find(project => getProjectAliases(project).includes(normalizedSelector));
    if (exact)
        return exact;
    const prefixMatches = workspaceInfo.projects.filter(project => normalizeSelector(project.relativePath).startsWith(normalizedSelector));
    if (prefixMatches.length === 1)
        return prefixMatches[0];
    const fuzzyMatches = workspaceInfo.projects.filter(project => getProjectAliases(project).some(alias => alias.includes(normalizedSelector)));
    if (fuzzyMatches.length === 1)
        return fuzzyMatches[0];
    return null;
}
function createScopedWorkspaceInfo(logger, workspaceInfo, workspaceScope, targetProjectSelector) {
    var _a;
    if (!workspaceInfo.isWorkspace || workspaceInfo.projects.length <= 1) {
        return {
            ...workspaceInfo,
            scope: workspaceScope,
            selectedProject: ((_a = workspaceInfo.projects[0]) === null || _a === void 0 ? void 0 : _a.relativePath) || null,
            totalProjectCount: workspaceInfo.projects.length,
        };
    }
    if (workspaceScope !== 'project-targeted') {
        return {
            ...workspaceInfo,
            scope: 'workspace-union',
            selectedProject: null,
            totalProjectCount: workspaceInfo.projects.length,
        };
    }
    if (!targetProjectSelector) {
        (0, logger_1.logError)('project-targeted 模式需要配合 --project <selector>');
        process.exit(1);
    }
    const selectedProject = resolveTargetProject(workspaceInfo, targetProjectSelector);
    if (!selectedProject) {
        (0, logger_1.logError)(`未找到匹配的子项目: ${targetProjectSelector}`);
        process.exit(1);
    }
    logger.log(`Workspace 定向模式: ${selectedProject.name} (${selectedProject.relativePath})`);
    return {
        ...workspaceInfo,
        isWorkspace: true,
        projects: [selectedProject],
        scope: 'project-targeted',
        selectedProject: selectedProject.relativePath,
        totalProjectCount: workspaceInfo.projects.length,
    };
}
function collectSkillContextProjects(workspaceInfo) {
    return workspaceInfo.projects;
}
function collectProjectFrameworkTags(project) {
    const tags = new Set(project.stackTags || []);
    if (project.frameworkLabel)
        tags.add(normalizeStackLabel(project.frameworkLabel));
    if (project.vueProfile)
        tags.add(`vue${project.vueProfile.version}`);
    for (const uiLib of project.uiLibLabels) {
        tags.add(normalizeStackLabel(uiLib));
    }
    return tags;
}
function matchesSkillLanguages(skill, projects) {
    if (!skill.languages || skill.languages.length === 0)
        return true;
    const languages = new Set(projects.map(project => project.lang));
    return skill.languages.some(language => languages.has(language));
}
function matchesSkillFrameworks(skill, projects) {
    if (!skill.frameworks || skill.frameworks.length === 0)
        return true;
    const frameworkTags = new Set();
    for (const project of projects) {
        for (const tag of collectProjectFrameworkTags(project)) {
            frameworkTags.add(tag);
        }
    }
    return skill.frameworks.some(framework => frameworkTags.has(normalizeStackLabel(framework)));
}
function matchesSkillStack(skill, projects) {
    const hasLanguages = Boolean(skill.languages && skill.languages.length > 0);
    const hasFrameworks = Boolean(skill.frameworks && skill.frameworks.length > 0);
    if (!hasLanguages && !hasFrameworks)
        return true;
    if (hasLanguages && hasFrameworks) {
        return matchesSkillLanguages(skill, projects) || matchesSkillFrameworks(skill, projects);
    }
    if (hasLanguages)
        return matchesSkillLanguages(skill, projects);
    return matchesSkillFrameworks(skill, projects);
}
function matchesSkillWorkspaceScope(skill, workspaceInfo) {
    if (!skill.workspaceScope || skill.workspaceScope === 'both')
        return true;
    if (workspaceInfo.totalProjectCount <= 1)
        return true;
    return skill.workspaceScope === workspaceInfo.scope;
}
function matchesSkillRole(skill, targetRole) {
    if (!targetRole || !skill.roles || skill.roles.length === 0)
        return true;
    if (targetRole === 'fullstack') {
        return skill.roles.includes('fullstack') || skill.roles.includes('frontend') || skill.roles.includes('backend');
    }
    return skill.roles.includes(targetRole);
}
function matchesBusinessRuleSelector(project, selector) {
    const normalizedSelector = selector.trim();
    if (!normalizedSelector)
        return false;
    const separatorIndex = normalizedSelector.indexOf(':');
    const selectorType = separatorIndex >= 0
        ? normalizeStackTag(normalizedSelector.slice(0, separatorIndex))
        : '';
    const selectorValue = separatorIndex >= 0
        ? normalizedSelector.slice(separatorIndex + 1).trim()
        : normalizedSelector;
    if (!selectorValue)
        return false;
    const hasDependency = (packageName) => Boolean(project.dependencies[packageName]);
    const normalizedValue = normalizeStackTag(selectorValue);
    switch (selectorType) {
        case '':
            return hasDependency(selectorValue);
        case 'dependency':
        case 'dep':
        case 'package':
        case 'pkg':
            return hasDependency(selectorValue);
        case 'stack':
        case 'framework':
        case 'uilib':
            return project.stackTags.some(tag => normalizeStackTag(tag) === normalizedValue);
        case 'lang':
        case 'language':
            return normalizeStackTag(project.lang) === normalizedValue;
        case 'kind':
        case 'projectkind':
            return normalizeStackTag(project.projectKind) === normalizedValue;
        default:
            return false;
    }
}
function collectMatchedBusinessRules(project, businessSelectors) {
    const matches = [];
    const seenRules = new Set();
    for (const [selector, ruleFolders] of Object.entries(businessSelectors)) {
        if (!matchesBusinessRuleSelector(project, selector))
            continue;
        for (const rule of ruleFolders) {
            if (seenRules.has(rule))
                continue;
            seenRules.add(rule);
            matches.push({ selector, rule });
        }
    }
    return matches;
}
function shouldIncludeSkill(skill, ctx, workspaceInfo) {
    const projects = collectSkillContextProjects(workspaceInfo);
    return matchesSkillWorkspaceScope(skill, workspaceInfo)
        && matchesSkillStack(skill, projects)
        && matchesSkillRole(skill, ctx.targetRole);
}
// ============ 规则加载 ============
async function loadRuleFile(ctx, logger, layerId, filePath) {
    if (ctx.isRemote) {
        try {
            return await (0, remote_content_pack_1.readRemoteTextAsset)(ctx, logger, `rules/${layerId}/${filePath}`);
        }
        catch (e) {
            logger.warn(`远程规则加载失败: ${filePath}`);
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
async function loadLayerRules(ctx, logger, layerId, folders) {
    const contents = [];
    for (const folder of folders) {
        if (ctx.isRemote) {
            // 远程模式：从 manifest 查找文件
            const matchingFiles = ctx.remoteManifest.files.filter(f => f.path.startsWith(`rules/${layerId}/${folder}`) && f.path.endsWith('.md'));
            for (const file of matchingFiles) {
                const relativePath = file.path.replace(`rules/${layerId}/`, '');
                const content = await loadRuleFile(ctx, logger, layerId, relativePath);
                if (content) {
                    contents.push({ path: relativePath, content: filterRuleByLevel(content, ctx.ruleLevel) });
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
                        contents.push({ path: `${folder}/${file}`, content: filterRuleByLevel(content, ctx.ruleLevel) });
                    }
                }
                else if (folderPath.endsWith('.md')) {
                    const content = fs.readFileSync(folderPath, 'utf-8');
                    contents.push({ path: folder, content: filterRuleByLevel(content, ctx.ruleLevel) });
                }
            }
            // 尝试 .md 后缀
            const mdPath = path.join(RULES_ROOT, layerId, folder + '.md');
            if (fs.existsSync(mdPath)) {
                const content = fs.readFileSync(mdPath, 'utf-8');
                contents.push({ path: folder + '.md', content: filterRuleByLevel(content, ctx.ruleLevel) });
            }
        }
    }
    return contents;
}
function filterRuleByLevel(content, level) {
    if (level === 'full')
        return content;
    const hasAny = /<!--\s*@level:/i.test(content);
    if (!hasAny)
        return content;
    const rank = { summary: 0, quick: 1, full: 2 };
    const target = rank[level];
    const re = /<!--\s*@level:(summary|quick|full)\s*-->/gi;
    const matches = [];
    let m;
    while ((m = re.exec(content))) {
        matches.push({ level: m[1], index: m.index, len: m[0].length });
    }
    if (matches.length === 0)
        return content;
    matches.sort((a, b) => a.index - b.index);
    const prefix = content.slice(0, matches[0].index);
    const picked = [prefix];
    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
        const segLevel = matches[i].level;
        if (rank[segLevel] <= target) {
            picked.push(content.slice(start, end));
        }
    }
    return picked.join('').trimEnd() + '\n';
}
async function loadEntities(ctx, logger, sourcePath, options, tracker, targetDir) {
    const entities = [];
    const localDir = path.join(targetDir, options.targetSubDir);
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }
    if (ctx.isRemote) {
        const files = ctx.remoteManifest.files.filter(f => f.path.startsWith(options.manifestPrefix) && f.path.endsWith('.md'));
        const rootFiles = files.filter(file => !file.path.replace(options.manifestPrefix, '').includes('/'));
        const entityGroups = new Map();
        for (const file of files) {
            const relativePath = file.path.replace(options.manifestPrefix, '');
            const parts = relativePath.split('/');
            if (parts.length <= 1)
                continue;
            const entityId = parts[0];
            const group = entityGroups.get(entityId) || [];
            group.push(file);
            entityGroups.set(entityId, group);
        }
        for (const file of rootFiles) {
            try {
                const content = await (0, remote_content_pack_1.readRemoteTextAsset)(ctx, logger, file.path);
                const relativePath = file.path.replace(options.manifestPrefix, '');
                (0, install_sync_1.writeManagedFile)(tracker, path.join(localDir, relativePath), content);
                logger.verbose(`已下载${options.label}根文件: ${relativePath}`);
            }
            catch (e) {
                logger.warn(`${options.label}根文件下载失败: ${file.path} - ${e.message}`);
            }
        }
        for (const [entityId, groupFiles] of entityGroups) {
            const metadataFile = groupFiles.find(file => file.path.endsWith(`/${options.metadataFileName}`));
            if (!metadataFile)
                continue;
            try {
                const metadataContent = await (0, remote_content_pack_1.readRemoteTextAsset)(ctx, logger, metadataFile.path);
                const metadata = options.parseMetadata(entityId, metadataContent);
                if (!metadata)
                    continue;
                if (options.includeEntity && !options.includeEntity(metadata, entityId)) {
                    logger.verbose(`已跳过${options.label}: ${entityId}`);
                    continue;
                }
                entities.push(metadata);
                for (const file of groupFiles) {
                    try {
                        const content = file.path === metadataFile.path
                            ? metadataContent
                            : await (0, remote_content_pack_1.readRemoteTextAsset)(ctx, logger, file.path);
                        const relativePath = file.path.replace(options.manifestPrefix, '');
                        const localPath = path.join(localDir, relativePath);
                        (0, install_sync_1.writeManagedFile)(tracker, localPath, content);
                        logger.verbose(`已下载${options.label}文件: ${relativePath}`);
                    }
                    catch (e) {
                        logger.warn(`${options.label}文件下载失败: ${file.path} - ${e.message}`);
                    }
                }
            }
            catch (e) {
                logger.warn(`${options.label}元数据下载失败: ${metadataFile.path} - ${e.message}`);
            }
        }
    }
    else {
        const sourceDir = path.join(PROJECT_ROOT, sourcePath);
        if (fs.existsSync(sourceDir)) {
            const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile())
                    continue;
                const sourceFile = path.join(sourceDir, entry.name);
                const destinationPath = path.join(localDir, entry.name);
                (0, install_sync_1.copyManagedFile)(tracker, sourceFile, destinationPath);
            }
            const entityDirs = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(entry => entry.name);
            for (const entityId of entityDirs) {
                const entitySourceDir = path.join(sourceDir, entityId);
                const metadataFile = path.join(entitySourceDir, options.metadataFileName);
                if (!fs.existsSync(metadataFile))
                    continue;
                const content = fs.readFileSync(metadataFile, 'utf-8');
                const metadata = options.parseMetadata(entityId, content);
                if (!metadata)
                    continue;
                if (options.includeEntity && !options.includeEntity(metadata, entityId)) {
                    logger.verbose(`已跳过${options.label}: ${entityId}`);
                    continue;
                }
                entities.push(metadata);
                const sourceFiles = (0, install_sync_1.listFilesRecursive)(entitySourceDir);
                for (const sourceFile of sourceFiles) {
                    const relativePath = path.relative(sourceDir, sourceFile);
                    const destinationPath = path.join(localDir, relativePath);
                    (0, install_sync_1.copyManagedFile)(tracker, sourceFile, destinationPath);
                }
            }
        }
    }
    return entities;
}
// ============ 技能系统 ============
async function loadSkills(ctx, logger, skillsPath, tracker, targetDir, workspaceInfo, targetSubDir) {
    return loadEntities(ctx, logger, skillsPath, {
        manifestPrefix: 'custom-skills/',
        targetSubDir,
        metadataFileName: 'SKILL.md',
        parseMetadata: metadata_parser_1.parseSkillMetadata,
        label: '技能',
        includeEntity: (metadata) => shouldIncludeSkill(metadata, ctx, workspaceInfo),
    }, tracker, targetDir);
}
// ============ Agent 系统 ============
async function loadAgents(ctx, logger, agentsPath, tracker, targetDir, targetSubDir) {
    return loadEntities(ctx, logger, agentsPath, {
        manifestPrefix: 'agents/',
        targetSubDir,
        metadataFileName: 'AGENT.md',
        parseMetadata: metadata_parser_1.parseAgentMetadata,
        label: 'Agent',
    }, tracker, targetDir);
}
// ============ 脚本分发系统 ============
/**
 * 分发可执行脚本到业务项目
 */
async function distributeScripts(ctx, logger, targetDir, tracker) {
    const distributed = [];
    const localScriptsDir = path.join(targetDir, '.codebuddy/scripts');
    const scriptsToDistribute = (0, distribution_profiles_1.getScriptsForProfile)(ctx.profile);
    if (!fs.existsSync(localScriptsDir)) {
        fs.mkdirSync(localScriptsDir, { recursive: true });
    }
    if (ctx.isRemote) {
        for (const scriptInfo of scriptsToDistribute) {
            try {
                const content = await (0, remote_content_pack_1.readRemoteTextAsset)(ctx, logger, `scripts/dist/${scriptInfo.file}`);
                const destPath = path.join(localScriptsDir, scriptInfo.file);
                (0, install_sync_1.writeManagedFile)(tracker, destPath, content);
                distributed.push(scriptInfo.file);
                logger.verbose(`已下载脚本: ${scriptInfo.file}`);
                if (scriptInfo.dependencies) {
                    for (const dep of scriptInfo.dependencies) {
                        try {
                            const depContent = await (0, remote_content_pack_1.readRemoteTextAsset)(ctx, logger, `scripts/dist/${dep}`);
                            (0, install_sync_1.writeManagedFile)(tracker, path.join(localScriptsDir, dep), depContent);
                            logger.verbose(`已下载依赖: ${dep}`);
                        }
                        catch (e) {
                            logger.warn(`依赖下载失败: ${dep} - ${e.message}`);
                        }
                    }
                }
            }
            catch (e) {
                logger.warn(`脚本下载失败: ${scriptInfo.file} - ${e.message}`);
            }
        }
    }
    else {
        const sourceDir = path.join(PROJECT_ROOT, 'scripts/dist');
        for (const scriptInfo of scriptsToDistribute) {
            const srcPath = path.join(sourceDir, scriptInfo.file);
            if (fs.existsSync(srcPath)) {
                const destPath = path.join(localScriptsDir, scriptInfo.file);
                (0, install_sync_1.copyManagedFile)(tracker, srcPath, destPath);
                distributed.push(scriptInfo.file);
                logger.verbose(`已复制脚本: ${scriptInfo.file}`);
                if (scriptInfo.dependencies) {
                    for (const dep of scriptInfo.dependencies) {
                        const depSrc = path.join(sourceDir, dep);
                        if (fs.existsSync(depSrc)) {
                            (0, install_sync_1.copyManagedFile)(tracker, depSrc, path.join(localScriptsDir, dep));
                            logger.verbose(`已复制依赖: ${dep}`);
                        }
                    }
                }
            }
            else {
                logger.warn(`脚本不存在: ${srcPath}`);
            }
        }
    }
    if (distributed.length > 0) {
        const scriptsPackageJsonPath = path.join(localScriptsDir, 'package.json');
        (0, install_sync_1.writeManagedFile)(tracker, scriptsPackageJsonPath, `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
        const readmePath = path.join(localScriptsDir, 'README.md');
        (0, install_sync_1.writeManagedFile)(tracker, readmePath, (0, prompt_builder_1.generateScriptsReadme)(distributed));
    }
    return distributed;
}
/**
 * 分发 Workflows 到业务项目
 */
async function distributeWorkflows(ctx, logger, targetDir, tracker) {
    return (0, distributor_1.distributeItems)(ctx, logger, targetDir, PROJECT_ROOT, {
        targetSubDir: '.codebuddy/workflows',
        items: distribution_profiles_1.WORKFLOWS_TO_DISTRIBUTE,
        label: 'workflow',
        tracker,
        readme: [
            '# Workflows', '',
            '本目录包含工作流规范（Workflow Spec）。', '',
            '- `default.workflow.json`：默认单任务闭环工作流（分析→计划→实现→测试→审查→验收）。',
            '- `workflow.schema.json`：Workflow Spec 的 JSON Schema，用于校验/CI/MCP/多工具适配。', '',
            '说明：早期可将其作为 Agent 的执行约束与产物清单；后期可由 Task Executor 按步骤编排并强制执行 gates。', '',
        ].join('\n'),
    });
}
/**
 * 分发 TaskBooks 契约（Schema）到业务项目
 */
async function distributeTaskBooks(ctx, logger, targetDir, tracker) {
    return (0, distributor_1.distributeItems)(ctx, logger, targetDir, PROJECT_ROOT, {
        targetSubDir: '.codebuddy/taskbooks',
        items: distribution_profiles_1.TASKBOOK_FILES_TO_DISTRIBUTE,
        label: 'taskbook contract',
        tracker,
        preCreateDirs: ['active', 'history'],
        readme: [
            '# TaskBooks', '',
            '本目录是 **TaskBook（任务书）** 的存储与契约（SSOT）。', '',
            '- `active/`：进行中的 TaskBook（*.json）',
            '- `history/`：已归档的 TaskBook（*.json）',
            '- `taskbook.schema.json`：TaskBook JSON Schema（契约）', '',
            '建议：任何 Agent/工具写入 TaskBook 前先按 schema 校验结构，避免"行为不一致"。', '',
        ].join('\n'),
    });
}
/**
 * 分发 Agent Calls 契约（Schema）到业务项目
 */
async function distributeAgentCalls(ctx, logger, targetDir, tracker) {
    return (0, distributor_1.distributeItems)(ctx, logger, targetDir, PROJECT_ROOT, {
        targetSubDir: '.codebuddy/agent-calls',
        items: distribution_profiles_1.AGENT_CALL_FILES_TO_DISTRIBUTE,
        label: 'agent-call contract',
        tracker,
        readme: [
            '# Agent Calls', '',
            '本目录用于 **Agent Call 文件协议**：prompt.md ⇄ result.json（可审计、可恢复）。', '',
            '- `agent-call.schema.json`：result.json 的 JSON Schema（契约）', '',
            '强校验/诊断：',
            '- `node .codebuddy/scripts/contract-validator.js --agent-calls`',
            '- `node .codebuddy/scripts/agent-call-manager.js validate <requestId>`', '',
            '可选：远程写回 result.json（跨进程/跨机器）：',
            '- `node .codebuddy/scripts/agent-call-manager.js serve --host 127.0.0.1 --port 4317 --token <t>`', '',
        ].join('\n'),
    });
}
async function distributeCommands(ctx, logger, targetDir, tracker) {
    return (0, distributor_1.distributeItems)(ctx, logger, targetDir, PROJECT_ROOT, {
        targetSubDir: '.codebuddy/commands',
        items: distribution_profiles_1.COMMANDS_TO_DISTRIBUTE,
        label: '命令',
        tracker,
        readme: (0, prompt_builder_1.generateCommandsReadme)(distribution_profiles_1.COMMANDS_TO_DISTRIBUTE.map(item => item.destFile)),
    });
}
// ============ .gitignore 更新 ============
function updateGitignore(logger, projectDir) {
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
        logger.verbose('已更新 .gitignore');
    }
    catch (error) {
        logger.warn(`更新 .gitignore 失败: ${error.message}`);
    }
}
// ============ 参数解析 ============
function parseContextArgs(args) {
    let isVerbose = false;
    let isRemote = false;
    let remoteBaseUrl = '';
    let remoteBearerToken = null;
    let taskType = null;
    let relevanceThreshold = DEFAULT_THRESHOLD;
    let ruleLevel = DEFAULT_RULE_LEVEL;
    let requestTimeout = DEFAULT_TIMEOUT;
    let profile = DEFAULT_PROFILE;
    let disableWorkspace = false;
    let strictRemotePack = false;
    let workspaceScope = 'workspace-union';
    let targetProject = null;
    let targetRole = null;
    let profileExplicit = false;
    let remoteBearerTokenExplicit = false;
    if (args.includes('--verbose') || args.includes('-v')) {
        isVerbose = true;
    }
    if (args.includes('--no-workspace')) {
        disableWorkspace = true;
    }
    if (args.includes('--pack-only') || args.includes('--strict-pack-only')) {
        strictRemotePack = true;
    }
    const workspaceScopeIndex = args.indexOf('--workspace-scope');
    if (workspaceScopeIndex !== -1) {
        const value = (args[workspaceScopeIndex + 1] || '').trim().toLowerCase();
        if (!value || value.startsWith('-')) {
            (0, logger_1.logError)('--workspace-scope 需要 scope 参数');
            process.exit(1);
        }
        if (!WORKSPACE_SCOPES.includes(value)) {
            (0, logger_1.logError)(`--workspace-scope 仅支持 ${WORKSPACE_SCOPES.join('|')}，当前: ${value}`);
            process.exit(1);
        }
        workspaceScope = value;
    }
    const projectIndex = args.indexOf('--project');
    if (projectIndex !== -1) {
        const value = (args[projectIndex + 1] || '').trim();
        if (!value || value.startsWith('-')) {
            (0, logger_1.logError)('--project 需要项目选择器参数');
            process.exit(1);
        }
        targetProject = value;
        workspaceScope = 'project-targeted';
    }
    const roleIndex = args.indexOf('--role');
    if (roleIndex !== -1) {
        const value = (args[roleIndex + 1] || '').trim().toLowerCase();
        if (!value || value.startsWith('-')) {
            (0, logger_1.logError)('--role 需要岗位参数');
            process.exit(1);
        }
        if (!SKILL_ROLES.includes(value)) {
            (0, logger_1.logError)(`--role 仅支持 ${SKILL_ROLES.join('|')}，当前: ${value}`);
            process.exit(1);
        }
        targetRole = value;
    }
    const profileIndex = args.indexOf('--profile');
    if (profileIndex !== -1) {
        const value = (args[profileIndex + 1] || '').trim().toLowerCase();
        if (!value || value.startsWith('-')) {
            (0, logger_1.logError)('--profile 需要 profile 名称参数');
            process.exit(1);
        }
        if (!INSTALL_PROFILES.includes(value)) {
            (0, logger_1.logError)(`--profile 仅支持 ${INSTALL_PROFILES.join('|')}，当前: ${value}`);
            process.exit(1);
        }
        profile = value;
        profileExplicit = true;
    }
    const legacyEnableOrchestrator = args.includes('--enable-orchestrator');
    if (legacyEnableOrchestrator) {
        if (profileExplicit && !(0, distribution_profiles_1.isOrchestratorProfile)(profile)) {
            (0, logger_1.logError)('--enable-orchestrator 只能与 --profile orchestrator|full 一起使用');
            process.exit(1);
        }
        if (!profileExplicit) {
            profile = 'full';
        }
    }
    const remoteIndex = args.indexOf('--remote');
    if (remoteIndex !== -1) {
        const url = args[remoteIndex + 1];
        if (!url || url.startsWith('-')) {
            (0, logger_1.logError)('--remote 需要 URL 参数');
            process.exit(1);
        }
        try {
            new URL(url);
        }
        catch (_a) {
            (0, logger_1.logError)('--remote 需要有效的 URL 格式（如 https://example.com）');
            process.exit(1);
        }
        isRemote = true;
        remoteBaseUrl = url.replace(/\/$/, '');
    }
    const remoteBearerTokenIndex = args.indexOf('--remote-bearer-token');
    if (remoteBearerTokenIndex !== -1) {
        const token = args[remoteBearerTokenIndex + 1];
        if (!token || token.startsWith('-')) {
            (0, logger_1.logError)('--remote-bearer-token requires a token value');
            process.exit(1);
        }
        remoteBearerToken = token;
        remoteBearerTokenExplicit = true;
    }
    else if (process.env.CODEBUDDY_REMOTE_BEARER_TOKEN) {
        remoteBearerToken = process.env.CODEBUDDY_REMOTE_BEARER_TOKEN.trim() || null;
    }
    if (strictRemotePack && !isRemote) {
        (0, logger_1.logError)('--pack-only can only be used with --remote');
        process.exit(1);
    }
    if (remoteBearerTokenExplicit && !isRemote) {
        (0, logger_1.logError)('--remote-bearer-token can only be used with --remote');
        process.exit(1);
    }
    const taskIndex = args.indexOf('--task');
    if (taskIndex !== -1) {
        const taskInput = args[taskIndex + 1];
        if (!taskInput || taskInput.startsWith('-')) {
            (0, logger_1.logError)('--task 需要任务类型参数');
            process.exit(1);
        }
        taskType = taskInput.toLowerCase().trim();
    }
    const thresholdIndex = args.indexOf('--threshold');
    if (thresholdIndex !== -1) {
        const value = parseFloat(args[thresholdIndex + 1]);
        if (!isNaN(value) && value >= 0 && value <= 1) {
            relevanceThreshold = value;
        }
    }
    const ruleLevelIndex = args.indexOf('--rule-level');
    if (ruleLevelIndex !== -1) {
        const value = (args[ruleLevelIndex + 1] || '').trim().toLowerCase();
        if (value === 'summary' || value === 'quick' || value === 'full') {
            ruleLevel = value;
        }
        else if (value) {
            (0, logger_1.logError)(`--rule-level 仅支持 summary|quick|full，当前: ${value}`);
            process.exit(1);
        }
    }
    const timeoutIndex = args.indexOf('--timeout');
    if (timeoutIndex !== -1) {
        const value = parseInt(args[timeoutIndex + 1], 10);
        if (!isNaN(value) && value > 0) {
            requestTimeout = value;
        }
    }
    return {
        isRemote,
        isVerbose,
        remoteBaseUrl,
        remoteBearerToken,
        remoteManifest: null,
        remoteContentRoot: null,
        remoteContentPack: null,
        strictRemotePack,
        requestTimeout,
        taskType,
        relevanceThreshold,
        ruleLevel,
        profile,
        enableOrchestrator: (0, distribution_profiles_1.isOrchestratorProfile)(profile),
        disableWorkspace,
        workspaceScope,
        targetProject,
        targetRole,
    };
}
function parseCliArgs() {
    const rawArgs = process.argv.slice(2);
    if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
        showHelp();
    }
    let command = 'install';
    let args = rawArgs;
    if (rawArgs[0] && !rawArgs[0].startsWith('-')) {
        const candidate = rawArgs[0].toLowerCase();
        if (COMMANDS.has(candidate)) {
            command = candidate;
            args = rawArgs.slice(1);
        }
        else {
            (0, logger_1.logError)(`未知命令: ${rawArgs[0]}`);
            process.exit(1);
        }
    }
    const json = args.includes('--json');
    const filteredArgs = args.filter(arg => arg !== '--json');
    return {
        command,
        ctx: parseContextArgs(filteredArgs),
        json,
    };
}
function runStatusCommand(targetDir, logger, json) {
    const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
    const installStateExists = fs.existsSync(installStatePath);
    const installState = (0, install_sync_1.readInstallState)(targetDir, logger);
    const inspection = (0, install_health_1.inspectInstallState)(targetDir, installState, installStateExists);
    if (json) {
        console.log(JSON.stringify({
            ok: inspection.installState !== null,
            inspection,
        }, null, 2));
    }
    else {
        console.log((0, install_health_1.formatStatusReport)(inspection));
    }
    return inspection.installState !== null ? 0 : 1;
}
function runDoctorCommand(targetDir, logger, json) {
    const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
    const installStateExists = fs.existsSync(installStatePath);
    const installState = (0, install_sync_1.readInstallState)(targetDir, logger);
    const inspection = (0, install_health_1.inspectInstallState)(targetDir, installState, installStateExists);
    const checks = (0, install_health_1.buildDoctorChecks)(inspection);
    const summary = (0, install_health_1.summarizeDoctorChecks)(checks);
    if (json) {
        console.log(JSON.stringify({
            ok: summary.status !== 'fail',
            summary,
            inspection,
            checks,
        }, null, 2));
    }
    else {
        console.log((0, install_health_1.formatDoctorReport)(inspection, checks, summary));
    }
    return summary.status === 'fail' ? 1 : 0;
}
// ============ 主函数 ============
async function main() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const parsedCli = parseCliArgs();
    const parsedCtx = parsedCli.ctx;
    const logger = (0, logger_1.createLogger)(parsedCtx);
    const targetDir = process.cwd();
    if (parsedCli.command === 'status') {
        process.exit(runStatusCommand(targetDir, logger, parsedCli.json));
    }
    if (parsedCli.command === 'doctor') {
        process.exit(runDoctorCommand(targetDir, logger, parsedCli.json));
    }
    // loadConfig 可能返回 manifest，需要合并到 ctx
    const { config, manifest } = await loadConfig(parsedCtx, logger);
    let ctx = manifest
        ? { ...parsedCtx, remoteManifest: manifest }
        : parsedCtx;
    if (ctx.isRemote && ctx.remoteManifest) {
        const packResolution = await (0, remote_content_pack_1.ensureRemoteContentPack)(ctx, logger, targetDir);
        ctx = {
            ...ctx,
            remoteContentRoot: packResolution.contentRoot,
            remoteContentPack: packResolution.pack,
        };
    }
    logger.log(`CodeBuddy 规则加载器 ${LOADER_DISPLAY_VERSION} (三层架构 + 技能系统)`);
    logger.log(ctx.isRemote ? `模式: 远程 (${ctx.remoteBaseUrl})` : '模式: 本地');
    logger.log(`安装档位: ${ctx.profile}`);
    logger.log(`Workspace 范围: ${ctx.workspaceScope}`);
    if (ctx.targetProject)
        logger.log(`目标项目: ${ctx.targetProject}`);
    if (ctx.enableOrchestrator)
        logger.log('编排模式: 已启用（含 TaskBook / Agent Call / Workflow 契约）');
    if (ctx.ruleLevel !== 'full') {
        logger.log(`规则裁剪: ${ctx.ruleLevel}（Layer1 主入口使用 ${ctx.ruleLevel}；完整原文写入 .codebuddy/rules_cache/layer1_reference/）`);
    }
    if (ctx.taskType) {
        logger.log(`任务筛选: ${ctx.taskType} (阈值: ${ctx.relevanceThreshold})`);
    }
    const previousInstallState = (0, install_sync_1.readInstallState)(targetDir, logger);
    const managedFileTracker = (0, install_sync_1.createManagedFileTracker)(targetDir);
    logger.log(`目标项目: ${targetDir}`);
    // ============ Workspace 多项目发现 ============
    const discoveredWorkspaceInfo = ctx.disableWorkspace
        ? {
            isWorkspace: false,
            rootDir: targetDir,
            projects: [],
            discoveredAt: new Date().toISOString(),
            scope: ctx.workspaceScope,
            selectedProject: null,
            totalProjectCount: 0,
        }
        : discoverWorkspace(logger, targetDir);
    const workspaceInfo = ctx.disableWorkspace
        ? discoveredWorkspaceInfo
        : createScopedWorkspaceInfo(logger, discoveredWorkspaceInfo, ctx.workspaceScope, ctx.targetProject);
    if (ctx.disableWorkspace) {
        logger.verbose('Workspace 发现已禁用（--no-workspace）');
    }
    else if (workspaceInfo.isWorkspace) {
        logger.log(`Workspace 模式: ${workspaceInfo.totalProjectCount} 个子项目（当前范围: ${workspaceInfo.scope}）`);
    }
    else {
        logger.verbose('单项目模式（未发现多个子项目）');
    }
    if (ctx.targetRole) {
        logger.log(`岗位过滤: ${ctx.targetRole}`);
    }
    const { layers, skills: skillsConfig, output, frontmatter } = config;
    // 检测项目依赖（向后兼容：选择 primaryProject 作为 Layer1 基准）
    let pkg;
    let dependencies;
    let vueProfile;
    let primaryProject = null;
    if ((workspaceInfo.isWorkspace || workspaceInfo.projects.length > 0) && workspaceInfo.projects.length > 0) {
        // Workspace 模式：选择第一个有 Vue 依赖的项目，否则取第一个
        primaryProject =
            workspaceInfo.projects.find(p => p.vueProfile !== null) ||
                workspaceInfo.projects[0];
        pkg = (_a = primaryProject.packageJson) !== null && _a !== void 0 ? _a : {};
        dependencies = primaryProject.dependencies;
        vueProfile = primaryProject.vueProfile;
        logger.verbose(`主项目（Layer1 基准）: ${primaryProject.name} (${primaryProject.relativePath})`);
    }
    else {
        pkg = getPackageJson(logger, targetDir);
        dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
        vueProfile = checkVueProfile(dependencies);
    }
    if (vueProfile) {
        logger.log(`检测到 Vue ${vueProfile.version} (${vueProfile.type})`);
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

> Generated by CodeBuddy Rule Loader ${LOADER_DISPLAY_VERSION}
> Generated at: ${updatedAt}
> Vue Version: ${vueProfile ? `${vueProfile.version} (${vueProfile.type})` : 'Not detected'}

---

`;
    // ============ Layer 1: Base (Eager Load) ============
    logger.log('处理 Layer 1: 基础规范 (Eager Load)...');
    const layer1Folders = [...(((_b = layers.base) === null || _b === void 0 ? void 0 : _b.staticDeps) || [])];
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
    const layer1Rules = await loadLayerRules(ctx, logger, ((_c = layers.base) === null || _c === void 0 ? void 0 : _c.id) || 'layer1_base', layer1Folders);
    const layer1ReferenceIndex = [];
    if (ctx.ruleLevel !== 'full') {
        const layer1FullRules = await loadLayerRules({ ...ctx, ruleLevel: 'full' }, logger, ((_d = layers.base) === null || _d === void 0 ? void 0 : _d.id) || 'layer1_base', layer1Folders);
        for (const rule of layer1FullRules) {
            const referencePath = `.codebuddy/rules_cache/layer1_reference/${rule.path}`.replace(/\\/g, '/');
            (0, install_sync_1.writeManagedFile)(managedFileTracker, path.join(targetDir, referencePath), rule.content);
            layer1ReferenceIndex.push({
                rule: rule.path.replace(/\.md$/, ''),
                path: referencePath,
            });
        }
        if (layer1ReferenceIndex.length > 0) {
            logger.log(`已生成 ${layer1ReferenceIndex.length} 个 Layer 1 完整参考缓存`);
        }
    }
    finalContent += `## ${((_e = layers.base) === null || _e === void 0 ? void 0 : _e.title) || 'Layer 1: 基础规范'}\n\n`;
    finalContent += `> 这些是本项目必须遵守的核心规范\n\n`;
    for (const rule of layer1Rules) {
        finalContent += `<!-- Source: ${rule.path} -->\n${rule.content}\n\n---\n\n`;
    }
    // ============ Layer 2: Business (Lazy Load - Index Only) ============
    logger.log('处理 Layer 2: 业务规范 (Lazy Load)...');
    const layer2Index = [];
    const businessDeps = ((_f = layers.business) === null || _f === void 0 ? void 0 : _f.dependencies) || {};
    const standaloneLang = primaryProject ? primaryProject.lang : detectProjectLangFromDir(targetDir);
    const standalonePackageJson = !primaryProject && fs.existsSync(path.join(targetDir, 'package.json')) ? pkg : undefined;
    const standaloneMetadata = primaryProject
        ? null
        : detectProjectMetadata(targetDir, standaloneLang, standalonePackageJson);
    const layer2TargetProject = primaryProject !== null && primaryProject !== void 0 ? primaryProject : {
        lang: standaloneLang,
        projectKind: (standaloneMetadata === null || standaloneMetadata === void 0 ? void 0 : standaloneMetadata.projectKind) || 'unknown',
        stackTags: (standaloneMetadata === null || standaloneMetadata === void 0 ? void 0 : standaloneMetadata.stackTags) || [],
        dependencies: (standaloneMetadata === null || standaloneMetadata === void 0 ? void 0 : standaloneMetadata.dependencies) || dependencies,
    };
    for (const match of collectMatchedBusinessRules(layer2TargetProject, businessDeps)) {
        logger.log(`  命中 ${match.selector}，添加规则索引`);
        layer2Index.push({
            dep: match.selector,
            rule: match.rule,
            path: `.codebuddy/rules_cache/layer2_business/${match.rule}.md`
        });
        // 缓存规则文件
        const cacheDir = path.join(targetDir, '.codebuddy/rules_cache/layer2_business');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        const content = await loadRuleFile(ctx, logger, ((_g = layers.business) === null || _g === void 0 ? void 0 : _g.id) || 'layer2_business', `${match.rule}.md`);
        if (content) {
            (0, install_sync_1.writeManagedFile)(managedFileTracker, path.join(cacheDir, `${match.rule}.md`), content);
        }
    }
    // ============ Workspace: 为每个子项目匹配并缓存 Layer2 规则 ============
    if (workspaceInfo.totalProjectCount > 1) {
        logger.log('处理 Workspace 子项目 Layer2 规则...');
        for (const project of workspaceInfo.projects) {
            // 跳过根项目（已在上面处理）
            if (project.relativePath === '.')
                continue;
            for (const match of collectMatchedBusinessRules(project, businessDeps)) {
                logger.verbose(`  ${project.name}: 命中 ${match.selector}，添加规则索引`);
                project.matchedLayer2Rules.push({
                    dep: match.selector,
                    rule: match.rule,
                    path: `.codebuddy/rules_cache/projects/${project.relativePath}/layer2_business/${match.rule}.md`,
                });
                // 缓存到子项目独立目录
                const projectCacheDir = path.join(targetDir, `.codebuddy/rules_cache/projects/${project.relativePath}/layer2_business`);
                if (!fs.existsSync(projectCacheDir)) {
                    fs.mkdirSync(projectCacheDir, { recursive: true });
                }
                const content = await loadRuleFile(ctx, logger, ((_h = layers.business) === null || _h === void 0 ? void 0 : _h.id) || 'layer2_business', `${match.rule}.md`);
                if (content) {
                    (0, install_sync_1.writeManagedFile)(managedFileTracker, path.join(projectCacheDir, `${match.rule}.md`), content);
                }
            }
        }
        // 同时填充根项目的 matchedLayer2Rules（如果存在）
        const rootProject = workspaceInfo.projects.find(p => p.relativePath === '.');
        if (rootProject) {
            rootProject.matchedLayer2Rules = [...layer2Index];
        }
    }
    // ============ Layer 3: Action (Lazy Load - Index Only) ============
    logger.log('处理 Layer 3: 任务检查清单 (Lazy Load)...');
    const layer3Index = [];
    const actionDefaults = ((_j = layers.action) === null || _j === void 0 ? void 0 : _j.defaults) || [];
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
        const content = await loadRuleFile(ctx, logger, ((_k = layers.action) === null || _k === void 0 ? void 0 : _k.id) || 'layer3_action', item + '.md');
        if (content) {
            (0, install_sync_1.writeManagedFile)(managedFileTracker, path.join(cacheDir, item + '.md'), content);
        }
    }
    // ============ 生成规则索引表 ============
    if (layer1ReferenceIndex.length > 0 || layer2Index.length > 0 || layer3Index.length > 0) {
        finalContent += `## 📚 规则参考索引 (按需加载)\n\n`;
        if (layer1ReferenceIndex.length > 0) {
            finalContent += `> 当前主入口仅内嵌 Layer 1 的 ${ctx.ruleLevel} 内容；完整原文与 Layer 2/3 细节规则请按需读取\n\n`;
        }
        else {
            finalContent += `> 以下规则包含具体的技术栈实现细节，请按需读取\n\n`;
        }
        finalContent += `| 规则名称 | 本地路径 | 说明 |\n|---------|---------|------|\n`;
        for (const item of layer1ReferenceIndex) {
            finalContent += `| ${item.rule} | \`${item.path}\` | Layer 1 完整参考 |\n`;
        }
        for (const item of layer2Index) {
            finalContent += `| ${item.rule} | \`${item.path}\` | Layer 2 匹配：${item.dep} |\n`;
        }
        for (const item of layer3Index) {
            finalContent += `| ${item.rule} | \`${item.path}\` | 任务检查清单 |\n`;
        }
        finalContent += '\n';
    }
    // ============ Workspace: 生成索引文件和提示词 ============
    let workspaceIndexPath = null;
    if (workspaceInfo.totalProjectCount > 1) {
        // 生成 workspace-index.json
        const workspaceIndex = {
            version: '1.1.0',
            generatedAt: new Date().toISOString(),
            rootDir: targetDir,
            projectCount: workspaceInfo.projects.length,
            totalProjectCount: workspaceInfo.totalProjectCount,
            scope: workspaceInfo.scope,
            selectedProject: workspaceInfo.selectedProject,
            projects: workspaceInfo.projects.map(p => {
                var _a, _b;
                return ({
                    name: p.name,
                    relativePath: p.relativePath,
                    lang: p.lang,
                    frameworkLabel: p.frameworkLabel,
                    uiLibLabels: p.uiLibLabels,
                    projectKind: p.projectKind,
                    stackTags: p.stackTags,
                    vueVersion: (_b = (_a = p.vueProfile) === null || _a === void 0 ? void 0 : _a.version) !== null && _b !== void 0 ? _b : null,
                    layer2CachePath: p.relativePath === '.'
                        ? '.codebuddy/rules_cache/layer2_business/'
                        : `.codebuddy/rules_cache/projects/${p.relativePath}/layer2_business/`,
                    matchedRules: p.matchedLayer2Rules.map(r => r.rule),
                });
            }),
        };
        workspaceIndexPath = path.join(targetDir, '.codebuddy/workspace-index.json');
        const workspaceIndexDir = path.dirname(workspaceIndexPath);
        if (!fs.existsSync(workspaceIndexDir)) {
            fs.mkdirSync(workspaceIndexDir, { recursive: true });
        }
        (0, install_sync_1.writeManagedFile)(managedFileTracker, workspaceIndexPath, JSON.stringify(workspaceIndex, null, 2));
        logger.log(`已生成 workspace-index.json (${workspaceInfo.projects.length} 个项目)`);
        // 注入 workspace 提示词
        finalContent += (0, prompt_builder_1.generateWorkspacePrompt)(workspaceInfo);
    }
    // ============ 规则激活提示词 ============
    finalContent += (0, prompt_builder_1.generateRuleActivationPrompt)(config);
    finalContent += (0, prompt_builder_1.generateQuickActionGuide)();
    // ============ 技能系统 ============
    let skills = [];
    let skillsRootDir = null;
    const skillsSnapshotRetention = (skillsConfig === null || skillsConfig === void 0 ? void 0 : skillsConfig.enabled) ? SKILL_SNAPSHOT_RETAIN_COUNT : null;
    if (skillsConfig === null || skillsConfig === void 0 ? void 0 : skillsConfig.enabled) {
        logger.log('加载技能系统...');
        skillsRootDir = `.codebuddy/skill-snapshots/${createInstallSnapshotId()}`;
        logger.verbose(`Skills active root: ${skillsRootDir}`);
        skills = await loadSkills(ctx, logger, skillsConfig.path || 'custom-skills', managedFileTracker, targetDir, workspaceInfo, skillsRootDir);
        logger.log(`已加载 ${skills.length} 个技能`);
        finalContent += (0, prompt_builder_1.generateSkillsPrompt)(skills, skillsRootDir);
    }
    // ============ Agent 系统 ============
    logger.log('加载 Agent 系统...');
    let agentsRootDir = `.codebuddy/agent-snapshots/${createInstallSnapshotId()}`;
    const agentsSnapshotRetention = AGENT_SNAPSHOT_RETAIN_COUNT;
    logger.verbose(`Agents active root: ${agentsRootDir}`);
    const agents = await loadAgents(ctx, logger, 'agents', managedFileTracker, targetDir, agentsRootDir);
    if (agents.length > 0) {
        logger.log(`已加载 ${agents.length} 个 Agents`);
        finalContent += (0, prompt_builder_1.generateAgentsPrompt)(agents, agentsRootDir);
    }
    // ============ 脚本分发 ============
    logger.log('分发工具脚本...');
    const distributedScripts = await distributeScripts(ctx, logger, targetDir, managedFileTracker);
    if (distributedScripts.length > 0) {
        logger.log(`已分发 ${distributedScripts.length} 个脚本`);
        finalContent += (0, prompt_builder_1.generateScriptsPrompt)(distributedScripts);
    }
    // ============ Workflows 分发（orchestrator/full） ============
    let distributedWorkflows = [];
    if (ctx.enableOrchestrator) {
        logger.log('分发 Workflows...');
        distributedWorkflows = await distributeWorkflows(ctx, logger, targetDir, managedFileTracker);
        if (distributedWorkflows.length > 0) {
            logger.log(`已分发 ${distributedWorkflows.length} 个工作流`);
            finalContent += (0, prompt_builder_1.generateWorkflowsPrompt)(distributedWorkflows);
        }
    }
    else {
        logger.verbose('跳过 Workflows 分发（当前 profile 不包含编排契约）');
    }
    // ============ TaskBooks 契约分发（orchestrator/full） ============
    let distributedTaskBooks = [];
    if (ctx.enableOrchestrator) {
        logger.log('分发 TaskBook 契约...');
        distributedTaskBooks = await distributeTaskBooks(ctx, logger, targetDir, managedFileTracker);
        if (distributedTaskBooks.length > 0) {
            logger.log(`已分发 ${distributedTaskBooks.length} 个 TaskBook 契约文件`);
            finalContent += (0, prompt_builder_1.generateTaskBooksPrompt)(distributedTaskBooks);
        }
    }
    else {
        logger.verbose('跳过 TaskBook 契约分发（当前 profile 不包含编排契约）');
    }
    // ============ Agent Calls 契约分发（orchestrator/full） ============
    let distributedAgentCalls = [];
    if (ctx.enableOrchestrator) {
        logger.log('分发 Agent Call 契约...');
        distributedAgentCalls = await distributeAgentCalls(ctx, logger, targetDir, managedFileTracker);
        if (distributedAgentCalls.length > 0) {
            logger.log(`已分发 ${distributedAgentCalls.length} 个 Agent Call 契约文件`);
            finalContent += (0, prompt_builder_1.generateAgentCallsPrompt)(distributedAgentCalls);
        }
    }
    else {
        logger.verbose('跳过 Agent Call 契约分发（当前 profile 不包含编排契约）');
    }
    // ============ 命令分发 ============
    logger.log('分发 Slash Commands...');
    const distributedCommands = await distributeCommands(ctx, logger, targetDir, managedFileTracker);
    if (distributedCommands.length > 0) {
        logger.log(`已分发 ${distributedCommands.length} 个命令`);
        finalContent += (0, prompt_builder_1.generateCommandsPrompt)(distributedCommands);
    }
    // ============ 输出文件 ============
    const outputDir = path.join(targetDir, (output === null || output === void 0 ? void 0 : output.dirName) || '.codebuddy/rules');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, (output === null || output === void 0 ? void 0 : output.fileName) || 'project-rules.md');
    (0, install_sync_1.writeManagedFile)(managedFileTracker, outputPath, finalContent);
    // 更新 .gitignore
    updateGitignore(logger, targetDir);
    const removedManagedFiles = (0, install_sync_1.cleanupStaleManagedFiles)(managedFileTracker, previousInstallState, {
        preservePrefixes: [
            '.codebuddy/agent-snapshots/',
            '.codebuddy/agents/',
            '.codebuddy/skill-snapshots/',
            '.codebuddy/skills/',
        ],
    }, logger);
    const installState = buildInstallState({
        ctx,
        logger,
        targetDir,
        outputPath,
        workspaceIndexPath,
        skillsRootDir,
        skillsSnapshotRetention,
        agentsRootDir,
        agentsSnapshotRetention,
        layer1RulesCount: layer1Rules.length,
        layer2IndexCount: layer2Index.length,
        layer3IndexCount: layer3Index.length,
        skillsCount: skills.length,
        agentsCount: agents.length,
        distributedScripts,
        distributedWorkflows,
        distributedTaskBooks,
        distributedAgentCalls,
        distributedCommands,
        managedFiles: (0, install_sync_1.getManagedFiles)(managedFileTracker),
        workspaceInfo,
    });
    const installStatePath = writeInstallState(targetDir, installState);
    const removedAgentSnapshots = gcSnapshotEntries(targetDir, '.codebuddy/agent-snapshots', agentsRootDir, agentsSnapshotRetention || AGENT_SNAPSHOT_RETAIN_COUNT, logger);
    const removedSkillSnapshots = gcSnapshotEntries(targetDir, '.codebuddy/skill-snapshots', skillsRootDir, skillsSnapshotRetention || SKILL_SNAPSHOT_RETAIN_COUNT, logger);
    logger.log(`已生成 install.json: ${installStatePath}`);
    logger.log(`同步结果: 写入 ${managedFileTracker.summary.written}，复用 ${managedFileTracker.summary.unchanged}，清理 ${removedManagedFiles.length}`);
    if (removedAgentSnapshots.length > 0) {
        logger.log(`Agent 快照回收: ${removedAgentSnapshots.length} 个（保留最近 ${agentsSnapshotRetention || AGENT_SNAPSHOT_RETAIN_COUNT} 个）`);
    }
    if (removedSkillSnapshots.length > 0) {
        logger.log(`技能快照回收: ${removedSkillSnapshots.length} 个（保留最近 ${skillsSnapshotRetention || SKILL_SNAPSHOT_RETAIN_COUNT} 个）`);
    }
    logger.log('');
    logger.log('═══════════════════════════════════════════════════════════════════');
    logger.log(`✅ 成功! 规则文件已写入: ${outputPath}`);
    logger.log(`   文件大小: ${(finalContent.length / 1024).toFixed(2)} KB`);
    logger.log(`   Layer 1 规则: ${layer1Rules.length} 个`);
    logger.log(`   Layer 2 索引: ${layer2Index.length} 个`);
    logger.log(`   Layer 3 索引: ${layer3Index.length} 个`);
    logger.log(`   工具脚本: ${distributedScripts.length} 个`);
    logger.log(`   Workflows: ${distributedWorkflows.length} 个`);
    logger.log(`   TaskBook 契约: ${distributedTaskBooks.length} 个`);
    logger.log(`   Agent Call 契约: ${distributedAgentCalls.length} 个`);
    logger.log(`   Slash Commands: ${distributedCommands.length} 个`);
    if (workspaceInfo.totalProjectCount > 1) {
        logger.log(`   Workspace 子项目: ${workspaceInfo.projects.length} 个`);
        for (const p of workspaceInfo.projects) {
            const rules = p.matchedLayer2Rules.map(r => r.rule).join(', ') || '无';
            logger.log(`     - ${p.name} (${p.relativePath}): ${p.frameworkLabel || '无框架'} | 规则: ${rules}`);
        }
    }
    logger.log('═══════════════════════════════════════════════════════════════════');
}
main().catch((err) => {
    (0, logger_1.logError)(`Fatal Error: ${err.message}`);
    process.exit(1);
});
