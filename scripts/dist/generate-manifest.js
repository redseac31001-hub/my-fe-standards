#!/usr/bin/env node
"use strict";
/**
 * Manifest 生成器 - CodeBuddy 版
 *
 * 扫描 rules/、custom-skills/ 和 agents/ 目录，生成 manifest.json
 * 用于远程加载模式
 *
 * 用法：
 *   node generate-manifest.js
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
const distribution_profiles_1 = require("./lib/distribution-profiles");
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RULES_ROOT = path.join(PROJECT_ROOT, 'rules');
const SKILLS_ROOT = path.join(PROJECT_ROOT, 'custom-skills');
const AGENTS_ROOT = path.join(PROJECT_ROOT, 'agents');
const WORKFLOWS_ROOT = path.join(PROJECT_ROOT, 'workflows');
const TASKBOOKS_ROOT = path.join(PROJECT_ROOT, 'taskbooks');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'loader-config.json');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'manifest.json');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
const PACKS_ROOT = path.join(PROJECT_ROOT, 'packs');
const RULE_FILE_EXTENSIONS = ['.md'];
const SKILL_FILE_EXTENSIONS = ['.md', '.json', '.py', '.txt', '.yaml', '.yml', '.js', '.sh', '.docx'];
const AGENT_FILE_EXTENSIONS = ['.md', '.json', '.txt', '.yaml', '.yml'];
const BINARY_FILE_EXTENSIONS = new Set(['.docx']);
function log(message) {
    console.log(`[Manifest] ${message}`);
}
function isBinaryFilePath(filePath) {
    return BINARY_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
/**
 * 递归扫描目录，收集指定后缀的文件
 *
 * 说明：用于远程加载模式的文件清单（manifest.json）。
 */
function scanDirectory(dir, basePath = '', extensions = RULE_FILE_EXTENSIONS) {
    const files = [];
    if (!fs.existsSync(dir)) {
        return files;
    }
    const items = fs.readdirSync(dir);
    for (const item of items) {
        // 跳过 _meta 目录
        if (item === '_meta')
            continue;
        const fullPath = path.join(dir, item);
        const relativePath = basePath ? `${basePath}/${item}` : item;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            files.push(...scanDirectory(fullPath, relativePath, extensions));
        }
        else if (extensions.some(ext => item.endsWith(ext))) {
            files.push({
                path: relativePath,
                name: path.parse(item).name,
                size: stat.size,
                mtime: stat.mtime.toISOString(),
                encoding: isBinaryFilePath(relativePath) ? 'base64' : 'utf8',
            });
        }
    }
    return files;
}
function computeSha256(content) {
    return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
}
function toPosixPath(filePath) {
    return filePath.replace(/\\/g, '/');
}
function buildContentPackEntries(relativePaths) {
    const uniquePaths = Array.from(new Set(relativePaths.map(toPosixPath))).sort();
    return uniquePaths.map(relativePath => {
        const absolutePath = path.join(PROJECT_ROOT, relativePath);
        const buffer = fs.readFileSync(absolutePath);
        const encoding = isBinaryFilePath(relativePath) ? 'base64' : 'utf8';
        return {
            path: relativePath,
            sha256: computeSha256(buffer),
            content: encoding === 'base64' ? buffer.toString('base64') : buffer.toString('utf-8'),
            encoding,
        };
    });
}
function getPackSourcePaths(profile, ruleFiles, skillFiles, agentFiles) {
    const sourcePaths = [
        ...ruleFiles.map(file => file.path),
        ...skillFiles.map(file => file.path),
        ...agentFiles.map(file => file.path),
        ...distribution_profiles_1.COMMANDS_TO_DISTRIBUTE.map(item => item.sourcePath),
        ...(0, distribution_profiles_1.getScriptArtifactsForProfile)(profile).map(file => `scripts/dist/${file}`),
    ];
    if ((0, distribution_profiles_1.isOrchestratorProfile)(profile)) {
        sourcePaths.push(...distribution_profiles_1.WORKFLOWS_TO_DISTRIBUTE.map(item => item.sourcePath), ...distribution_profiles_1.TASKBOOK_FILES_TO_DISTRIBUTE.map(item => item.sourcePath), ...distribution_profiles_1.AGENT_CALL_FILES_TO_DISTRIBUTE.map(item => item.sourcePath));
    }
    return sourcePaths;
}
function buildContentPackManifest(profile, version, ruleFiles, skillFiles, agentFiles) {
    if (!fs.existsSync(PACKS_ROOT)) {
        fs.mkdirSync(PACKS_ROOT, { recursive: true });
    }
    const entries = buildContentPackEntries(getPackSourcePaths(profile, ruleFiles, skillFiles, agentFiles));
    const pack = {
        schemaVersion: '1.0.0',
        version,
        profile,
        generatedAt: new Date().toISOString(),
        entryCount: entries.length,
        entries,
    };
    const serialized = JSON.stringify(pack, null, 2);
    const file = `packs/content-pack-${profile}.json`;
    const absolutePath = path.join(PROJECT_ROOT, file);
    fs.writeFileSync(absolutePath, serialized, 'utf-8');
    return {
        profile,
        file,
        format: 'content-pack-json-v1',
        sha256: computeSha256(serialized),
        size: Buffer.byteLength(serialized, 'utf-8'),
        entryCount: entries.length,
        generatedAt: pack.generatedAt,
    };
}
/**
 * 主函数
 */
function main() {
    log('开始生成 manifest.json...');
    // 0. 读取版本号（单一事实源：package.json）
    let manifestVersion = '0.0.0';
    if (fs.existsSync(PACKAGE_JSON_PATH)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
            if (pkg.version)
                manifestVersion = pkg.version;
            log(`版本号来源: package.json -> ${manifestVersion}`);
        }
        catch (_a) {
            log('警告: package.json 解析失败，使用默认版本号 0.0.0');
        }
    }
    // 1. 加载配置
    let config = {};
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            log('已加载配置文件');
        }
        catch (e) {
            log(`错误: 配置文件格式无效 - ${e.message}`);
            process.exit(1);
        }
    }
    else {
        log('警告: 配置文件不存在，使用默认配置');
    }
    // 2. 扫描规则文件
    log('扫描 rules/ 目录...');
    const ruleFiles = scanDirectory(RULES_ROOT, '', RULE_FILE_EXTENSIONS).map(f => ({
        ...f,
        path: `rules/${f.path}`,
    }));
    log(`  找到 ${ruleFiles.length} 个规则文件`);
    // 3. 扫描技能文件
    log('扫描 custom-skills/ 目录...');
    const skillFiles = scanDirectory(SKILLS_ROOT, '', SKILL_FILE_EXTENSIONS).map(f => ({
        ...f,
        path: `custom-skills/${f.path}`,
    }));
    log(`  找到 ${skillFiles.length} 个技能文件`);
    // 4. 扫描 Agent 文件
    log('扫描 agents/ 目录...');
    const agentFiles = scanDirectory(AGENTS_ROOT, '', AGENT_FILE_EXTENSIONS).map(f => ({
        ...f,
        path: `agents/${f.path}`,
    }));
    log(`  找到 ${agentFiles.length} 个 Agent 文件`);
    // 5. 扫描 Workflows 文件（JSON Schema + workflow templates）
    log('扫描 workflows/ 目录...');
    const workflowFiles = scanDirectory(WORKFLOWS_ROOT, '', ['.json', '.md']).map(f => ({
        ...f,
        path: `workflows/${f.path}`,
    }));
    log(`  找到 ${workflowFiles.length} 个 workflow 文件`);
    // 6. 扫描 TaskBooks 文件（JSON Schema）
    log('扫描 taskbooks/ 目录...');
    const taskbookFiles = scanDirectory(TASKBOOKS_ROOT, '', ['.json', '.md']).map(f => ({
        ...f,
        path: `taskbooks/${f.path}`,
    }));
    log(`  找到 ${taskbookFiles.length} 个 taskbook 文件`);
    // 7. 生成远程 content packs（按 profile）
    log('生成远程 content packs...');
    const packs = {
        core: buildContentPackManifest('core', manifestVersion, ruleFiles, skillFiles, agentFiles),
        analysis: buildContentPackManifest('analysis', manifestVersion, ruleFiles, skillFiles, agentFiles),
        orchestrator: buildContentPackManifest('orchestrator', manifestVersion, ruleFiles, skillFiles, agentFiles),
        full: buildContentPackManifest('full', manifestVersion, ruleFiles, skillFiles, agentFiles),
    };
    log(`  已生成 ${Object.keys(packs).length} 个 content packs`);
    // 8. 构建 manifest
    const manifest = {
        version: manifestVersion,
        generatedAt: new Date().toISOString(),
        aiTool: 'CodeBuddy',
        model: 'GLM-4.7',
        config: {
            layers: config.layers || {},
            skills: config.skills || { enabled: false, path: '' },
            tasks: config.tasks || {},
            output: config.output || { dirName: '', fileName: '' },
            frontmatter: config.frontmatter || {},
        },
        files: [...ruleFiles, ...skillFiles, ...agentFiles, ...workflowFiles, ...taskbookFiles],
        packs,
        stats: {
            totalFiles: ruleFiles.length + skillFiles.length + agentFiles.length + workflowFiles.length + taskbookFiles.length,
            ruleFiles: ruleFiles.length,
            skillFiles: skillFiles.length,
            agentFiles: agentFiles.length,
            workflowFiles: workflowFiles.length,
            taskbookFiles: taskbookFiles.length,
        },
    };
    // 9. 写入文件
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    log('');
    log('═══════════════════════════════════════════════════════════════════');
    log(`✅ 成功! manifest.json 已生成`);
    log(`   规则文件: ${ruleFiles.length} 个`);
    log(`   技能文件: ${skillFiles.length} 个`);
    log(`   Agent文件: ${agentFiles.length} 个`);
    log(`   Workflow文件: ${workflowFiles.length} 个`);
    log(`   TaskBook文件: ${taskbookFiles.length} 个`);
    log(`   Content Packs: ${Object.keys(packs).length} 个`);
    log(`   总计: ${manifest.stats.totalFiles} 个文件`);
    log('═══════════════════════════════════════════════════════════════════');
}
main();
