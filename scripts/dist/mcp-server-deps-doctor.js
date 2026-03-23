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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function parseArgs(argv) {
    return {
        strict: argv.includes('--strict'),
        json: argv.includes('--json'),
    };
}
function readJsonFile(filePath) {
    if (!fs.existsSync(filePath))
        return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
function parseVersion(version) {
    const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match)
        return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function compareVersions(left, right) {
    for (let i = 0; i < 3; i++) {
        if (left[i] > right[i])
            return 1;
        if (left[i] < right[i])
            return -1;
    }
    return 0;
}
function satisfiesRange(installedVersion, declaredRange) {
    const normalizedRange = declaredRange.trim();
    if (!normalizedRange)
        return false;
    if (/^\d+\.\d+\.\d+$/.test(normalizedRange)) {
        return installedVersion === normalizedRange;
    }
    const installed = parseVersion(installedVersion);
    const rangeVersion = parseVersion(normalizedRange.replace(/^[~^]/, ''));
    if (!installed || !rangeVersion) {
        return false;
    }
    if (normalizedRange.startsWith('^')) {
        if (installed[0] !== rangeVersion[0])
            return false;
        return compareVersions(installed, rangeVersion) >= 0;
    }
    if (normalizedRange.startsWith('~')) {
        if (installed[0] !== rangeVersion[0] || installed[1] !== rangeVersion[1])
            return false;
        return compareVersions(installed, rangeVersion) >= 0;
    }
    return installedVersion === normalizedRange;
}
function getInstalledVersion(lockfile, nodeModulesDir, packageName) {
    var _a, _b;
    const lockfileKey = `node_modules/${packageName}`;
    const fromLock = (_b = (_a = lockfile === null || lockfile === void 0 ? void 0 : lockfile.packages) === null || _a === void 0 ? void 0 : _a[lockfileKey]) === null || _b === void 0 ? void 0 : _b.version;
    if (typeof fromLock === 'string' && fromLock.trim()) {
        return fromLock.trim();
    }
    const packageJsonPath = path.join(nodeModulesDir, ...packageName.split('/'), 'package.json');
    const packageJson = readJsonFile(packageJsonPath);
    return typeof (packageJson === null || packageJson === void 0 ? void 0 : packageJson.version) === 'string' ? packageJson.version : null;
}
function buildResult(packageJson, missingLockfile, invalidDeps, missingDeps, strictMode) {
    const hasProblems = missingLockfile || invalidDeps.length > 0 || missingDeps.length > 0;
    return {
        project: packageJson.name || 'mcp-server',
        version: packageJson.version || 'unknown',
        lockfilePresent: !missingLockfile,
        dependencyState: hasProblems ? 'needs_attention' : 'ok',
        releaseImpact: hasProblems ? 'non_blocking_exception' : 'none',
        strictMode,
        effectiveOk: hasProblems ? !strictMode : true,
        invalidDependencies: invalidDeps,
        missingDependencies: missingDeps,
        suggestedNextSteps: hasProblems
            ? [
                'For business-project release and normal repository work, treat this as a documented non-blocking exception.',
                'If the task touches mcp-server itself or must prove a clean-environment MCP setup, run `cd mcp-server && npm install` in a normal networked environment and commit the refreshed dependency baseline.',
            ]
            : [
                'Dependency baseline is consistent.',
            ],
    };
}
function formatTextReport(result) {
    const lines = [
        'MCP Server Dependency Doctor',
        `Project: ${result.project}@${result.version}`,
        `Lockfile: ${result.lockfilePresent ? 'present' : 'missing'}`,
        `Dependency state: ${result.dependencyState}`,
        `Release impact: ${result.releaseImpact}`,
        `Strict mode: ${result.strictMode ? 'on' : 'off'}`,
        `Effective result: ${result.effectiveOk ? 'ok' : 'fail'}`,
        '',
    ];
    if (result.invalidDependencies.length > 0) {
        lines.push(`Invalid dependencies (${result.invalidDependencies.length}):`);
        for (const issue of result.invalidDependencies) {
            lines.push(`- ${issue.name}: installed=${issue.installed || 'unknown'}, declared=${issue.declared}`);
        }
        lines.push('');
    }
    if (result.missingDependencies.length > 0) {
        lines.push(`Missing dependencies (${result.missingDependencies.length}):`);
        for (const issue of result.missingDependencies) {
            lines.push(`- ${issue.name}: required=${issue.declared}`);
        }
        lines.push('');
    }
    if (!result.lockfilePresent) {
        lines.push('Lockfile issue:');
        lines.push('- missing mcp-server/package-lock.json');
        lines.push('');
    }
    lines.push('Suggested next step:');
    for (const step of result.suggestedNextSteps) {
        lines.push(`- ${step}`);
    }
    if (result.releaseImpact === 'non_blocking_exception' && !result.strictMode) {
        lines.push('');
        lines.push('Note: default mode keeps this check non-blocking for mainline repository and business-project release decisions.');
        lines.push('Use `--strict` only when the task specifically targets mcp-server dependency hygiene.');
    }
    return lines.join('\n');
}
function main() {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = process.cwd();
    const mcpServerDir = path.join(repoRoot, 'mcp-server');
    const packageJsonPath = path.join(mcpServerDir, 'package.json');
    const packageLockPath = path.join(mcpServerDir, 'package-lock.json');
    const hiddenLockfilePath = path.join(mcpServerDir, 'node_modules', '.package-lock.json');
    const nodeModulesDir = path.join(mcpServerDir, 'node_modules');
    if (!fs.existsSync(packageJsonPath)) {
        console.error(`[mcp-server-deps-doctor] missing package.json: ${packageJsonPath}`);
        process.exit(1);
    }
    const packageJson = readJsonFile(packageJsonPath);
    if (!packageJson) {
        console.error(`[mcp-server-deps-doctor] failed to read package.json: ${packageJsonPath}`);
        process.exit(1);
    }
    const hiddenLockfile = readJsonFile(hiddenLockfilePath);
    const declaredDependencies = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
    };
    const missingLockfile = !fs.existsSync(packageLockPath);
    const dependencyIssues = [];
    for (const [name, declaredRange] of Object.entries(declaredDependencies)) {
        const installedVersion = getInstalledVersion(hiddenLockfile, nodeModulesDir, name);
        if (!installedVersion) {
            dependencyIssues.push({
                name,
                declared: declaredRange,
                installed: null,
                kind: 'missing',
            });
            continue;
        }
        if (!satisfiesRange(installedVersion, declaredRange)) {
            dependencyIssues.push({
                name,
                declared: declaredRange,
                installed: installedVersion,
                kind: 'invalid',
            });
        }
    }
    const invalidDeps = dependencyIssues.filter(issue => issue.kind === 'invalid');
    const missingDeps = dependencyIssues.filter(issue => issue.kind === 'missing');
    const result = buildResult(packageJson, missingLockfile, invalidDeps, missingDeps, args.strict);
    if (args.json) {
        console.log(JSON.stringify(result, null, 2));
    }
    else {
        console.log(formatTextReport(result));
    }
    process.exit(result.effectiveOk ? 0 : 1);
}
main();
