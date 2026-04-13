"use strict";
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
exports.runInit = runInit;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const install_sync_1 = require("./install-sync");
function toPosixPath(filePath) {
    return filePath.replace(/\\/g, '/');
}
function toProjectRelativePath(targetDir, filePath) {
    return toPosixPath(path.relative(targetDir, filePath));
}
function readProjectPackageJson(targetDir) {
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('未找到 package.json。当前版本的 init 仅支持 Node 项目。');
    }
    try {
        return {
            path: packageJsonPath,
            data: JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')),
        };
    }
    catch (error) {
        throw new Error(`解析 package.json 失败: ${error.message}`);
    }
}
function buildNpxCodeBuddyCommand(packageName, subCommand) {
    return `npx --yes --package ${packageName} codebuddy-loader ${subCommand}`.trim();
}
function buildWorkflowTemplate(packageName) {
    return [
        'name: CodeBuddy Gate',
        'on: [push, pull_request]',
        'jobs:',
        '  validate:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: actions/setup-node@v4',
        '        with:',
        '          node-version: 20',
        '      - run: npm ci',
        `      - run: ${buildNpxCodeBuddyCommand(packageName, 'install --if-deps-changed')}`,
        '      - run: node .codebuddy/scripts/validator-gate.js run --json',
        `      - run: ${buildNpxCodeBuddyCommand(packageName, 'doctor --json')}`,
        '',
    ].join('\n');
}
function createHookFileContent(existingContent, command, huskyShimPathExists) {
    if (existingContent && existingContent.includes(command)) {
        return null;
    }
    if (!existingContent) {
        const headerLines = ['#!/usr/bin/env sh'];
        if (huskyShimPathExists) {
            headerLines.push('. "$(dirname -- "$0")/_/husky.sh"');
        }
        headerLines.push('', command, '');
        return headerLines.join('\n');
    }
    let nextContent = existingContent;
    if (!nextContent.endsWith('\n')) {
        nextContent += '\n';
    }
    if (!nextContent.endsWith('\n\n')) {
        nextContent += '\n';
    }
    nextContent += `${command}\n`;
    return nextContent;
}
function upsertFile(targetDir, filePath, content, force, dryRun, result) {
    const relativePath = toProjectRelativePath(targetDir, filePath);
    if (fs.existsSync(filePath) && !force) {
        result.skipped.push(relativePath);
        return;
    }
    result.generated.push(relativePath);
    if (dryRun) {
        return;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
}
function tryMakeExecutable(filePath) {
    try {
        fs.chmodSync(filePath, 0o755);
    }
    catch (_a) { }
}
function ensureInstallState(targetDir) {
    const installState = (0, install_sync_1.readInstallState)(targetDir);
    if (!installState) {
        throw new Error('未找到 .codebuddy/install.json，请先执行 install。');
    }
}
function runInit(options, logger) {
    var _a;
    ensureInstallState(options.targetDir);
    const result = {
        generated: [],
        skipped: [],
        injected: [],
        notes: [],
    };
    const packageJson = readProjectPackageJson(options.targetDir);
    if (options.scripts) {
        const nextPackageJson = {
            ...packageJson.data,
            scripts: { ...(packageJson.data.scripts || {}) },
        };
        const desiredScripts = {
            'codebuddy:install': buildNpxCodeBuddyCommand(options.bootstrapPackageName, 'install'),
            'codebuddy:doctor': buildNpxCodeBuddyCommand(options.bootstrapPackageName, 'doctor'),
            'codebuddy:validate': 'node .codebuddy/scripts/validator-gate.js run',
        };
        for (const [scriptName, scriptCommand] of Object.entries(desiredScripts)) {
            const currentCommand = (_a = nextPackageJson.scripts) === null || _a === void 0 ? void 0 : _a[scriptName];
            if (currentCommand === scriptCommand) {
                continue;
            }
            if (currentCommand && !options.force) {
                result.skipped.push(`package.json:scripts.${scriptName}`);
                continue;
            }
            nextPackageJson.scripts[scriptName] = scriptCommand;
            result.injected.push(scriptName);
        }
        if (result.injected.length > 0) {
            result.generated.push('package.json');
            if (!options.dryRun) {
                fs.writeFileSync(packageJson.path, `${JSON.stringify(nextPackageJson, null, 2)}\n`, 'utf-8');
            }
        }
    }
    if (options.ci) {
        const workflowPath = path.join(options.targetDir, '.github', 'workflows', 'codebuddy-gate.yml');
        upsertFile(options.targetDir, workflowPath, buildWorkflowTemplate(options.bootstrapPackageName), options.force, options.dryRun, result);
    }
    if (options.gitHooks) {
        const huskyDir = path.join(options.targetDir, '.husky');
        if (!fs.existsSync(huskyDir) || !fs.statSync(huskyDir).isDirectory()) {
            result.notes.push('未检测到 .husky/，已跳过 git hooks 生成。');
        }
        else {
            const huskyShimPathExists = fs.existsSync(path.join(huskyDir, '_', 'husky.sh'));
            const hookTargets = [
                {
                    filePath: path.join(huskyDir, 'pre-commit'),
                    command: 'node .codebuddy/scripts/validator-gate.js run --scope rules',
                },
                {
                    filePath: path.join(huskyDir, 'pre-push'),
                    command: buildNpxCodeBuddyCommand(options.bootstrapPackageName, 'doctor'),
                },
            ];
            for (const hookTarget of hookTargets) {
                const relativePath = toProjectRelativePath(options.targetDir, hookTarget.filePath);
                const existingContent = fs.existsSync(hookTarget.filePath)
                    ? fs.readFileSync(hookTarget.filePath, 'utf-8')
                    : null;
                const nextContent = createHookFileContent(existingContent, hookTarget.command, huskyShimPathExists);
                if (!nextContent) {
                    result.skipped.push(relativePath);
                    continue;
                }
                result.generated.push(relativePath);
                if (options.dryRun) {
                    continue;
                }
                fs.mkdirSync(path.dirname(hookTarget.filePath), { recursive: true });
                fs.writeFileSync(hookTarget.filePath, nextContent, 'utf-8');
                tryMakeExecutable(hookTarget.filePath);
            }
        }
    }
    logger.verbose(`init generated=${result.generated.length}, skipped=${result.skipped.length}, injected=${result.injected.length}`);
    return {
        generated: [...new Set(result.generated)].sort((left, right) => left.localeCompare(right)),
        skipped: [...new Set(result.skipped)].sort((left, right) => left.localeCompare(right)),
        injected: [...new Set(result.injected)].sort((left, right) => left.localeCompare(right)),
        notes: [...new Set(result.notes)],
    };
}
