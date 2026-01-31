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
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RULES_ROOT = path.join(PROJECT_ROOT, 'rules');
const SKILLS_ROOT = path.join(PROJECT_ROOT, 'custom-skills');
const AGENTS_ROOT = path.join(PROJECT_ROOT, 'agents');
const WORKFLOWS_ROOT = path.join(PROJECT_ROOT, 'workflows');
const TASKBOOKS_ROOT = path.join(PROJECT_ROOT, 'taskbooks');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'loader-config.json');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'manifest.json');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
function log(message) {
    console.log(`[Manifest] ${message}`);
}
/**
 * 递归扫描目录，收集指定后缀的文件
 *
 * 说明：用于远程加载模式的文件清单（manifest.json）。
 */
function scanDirectory(dir, basePath = '', extensions = ['.md']) {
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
            });
        }
    }
    return files;
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
    const ruleFiles = scanDirectory(RULES_ROOT).map(f => ({
        ...f,
        path: `rules/${f.path}`,
    }));
    log(`  找到 ${ruleFiles.length} 个规则文件`);
    // 3. 扫描技能文件
    log('扫描 custom-skills/ 目录...');
    const skillFiles = scanDirectory(SKILLS_ROOT).map(f => ({
        ...f,
        path: `custom-skills/${f.path}`,
    }));
    log(`  找到 ${skillFiles.length} 个技能文件`);
    // 4. 扫描 Agent 文件
    log('扫描 agents/ 目录...');
    const agentFiles = scanDirectory(AGENTS_ROOT).map(f => ({
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
    // 7. 构建 manifest
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
        stats: {
            totalFiles: ruleFiles.length + skillFiles.length + agentFiles.length + workflowFiles.length + taskbookFiles.length,
            ruleFiles: ruleFiles.length,
            skillFiles: skillFiles.length,
            agentFiles: agentFiles.length,
            workflowFiles: workflowFiles.length,
            taskbookFiles: taskbookFiles.length,
        },
    };
    // 8. 写入文件
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    log('');
    log('═══════════════════════════════════════════════════════════════════');
    log(`✅ 成功! manifest.json 已生成`);
    log(`   规则文件: ${ruleFiles.length} 个`);
    log(`   技能文件: ${skillFiles.length} 个`);
    log(`   Agent文件: ${agentFiles.length} 个`);
    log(`   Workflow文件: ${workflowFiles.length} 个`);
    log(`   TaskBook文件: ${taskbookFiles.length} 个`);
    log(`   总计: ${manifest.stats.totalFiles} 个文件`);
    log('═══════════════════════════════════════════════════════════════════');
}
main();
