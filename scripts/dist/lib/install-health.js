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
exports.inspectInstallState = inspectInstallState;
exports.buildDoctorChecks = buildDoctorChecks;
exports.summarizeDoctorChecks = summarizeDoctorChecks;
exports.formatStatusReport = formatStatusReport;
exports.formatDoctorReport = formatDoctorReport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const install_sync_1 = require("./install-sync");
const SUPPORTED_INSTALL_STATE_SCHEMAS = new Set(['1.0.0']);
const STATIC_MANAGED_DIRS = [
    '.codebuddy/agent-calls',
    '.codebuddy/agents',
    '.codebuddy/commands',
    '.codebuddy/rules',
    '.codebuddy/rules_cache',
    '.codebuddy/scripts',
    '.codebuddy/skills',
    '.codebuddy/taskbooks',
    '.codebuddy/workflows',
];
const PROFILE_RESIDUAL_ARTIFACTS = {
    core: [
        '.codebuddy/scripts/structure-analyzer.js',
        '.codebuddy/scripts/module-mapper.js',
        '.codebuddy/scripts/report-manager.js',
        '.codebuddy/scripts/reference-finder.js',
        '.codebuddy/scripts/context-collector.js',
        '.codebuddy/scripts/contract-validator.js',
        '.codebuddy/scripts/agent-call-manager.js',
        '.codebuddy/scripts/task-orchestrator.js',
        '.codebuddy/scripts/taskbook-manager.js',
        '.codebuddy/scripts/task-executor.js',
        '.codebuddy/scripts/agent-registry.js',
        '.codebuddy/agent-calls/agent-call.schema.json',
        '.codebuddy/agent-calls/README.md',
        '.codebuddy/taskbooks/taskbook.schema.json',
        '.codebuddy/taskbooks/README.md',
        '.codebuddy/workflows/default.workflow.json',
        '.codebuddy/workflows/workflow.schema.json',
        '.codebuddy/workflows/README.md',
    ],
    analysis: [
        '.codebuddy/scripts/contract-validator.js',
        '.codebuddy/scripts/agent-call-manager.js',
        '.codebuddy/scripts/task-orchestrator.js',
        '.codebuddy/scripts/taskbook-manager.js',
        '.codebuddy/scripts/task-executor.js',
        '.codebuddy/scripts/agent-registry.js',
        '.codebuddy/agent-calls/agent-call.schema.json',
        '.codebuddy/agent-calls/README.md',
        '.codebuddy/taskbooks/taskbook.schema.json',
        '.codebuddy/taskbooks/README.md',
        '.codebuddy/workflows/default.workflow.json',
        '.codebuddy/workflows/workflow.schema.json',
        '.codebuddy/workflows/README.md',
    ],
    orchestrator: [
        '.codebuddy/scripts/agent-registry.js',
    ],
    full: [],
};
const LEGACY_ORCHESTRATOR_ARTIFACTS = [
    '.codebuddy/agent-calls/agent-call.schema.json',
    '.codebuddy/agent-calls/README.md',
    '.codebuddy/taskbooks/taskbook.schema.json',
    '.codebuddy/taskbooks/README.md',
    '.codebuddy/workflows/default.workflow.json',
    '.codebuddy/workflows/workflow.schema.json',
    '.codebuddy/workflows/README.md',
];
function inspectInstallState(targetDir, installState, installStateExists) {
    const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
    const rulesFilePath = (installState === null || installState === void 0 ? void 0 : installState.outputs.rulesFile)
        ? path.join(targetDir, installState.outputs.rulesFile)
        : null;
    const workspaceIndexPath = (installState === null || installState === void 0 ? void 0 : installState.outputs.workspaceIndexFile)
        ? path.join(targetDir, installState.outputs.workspaceIndexFile)
        : null;
    const managedFiles = (installState === null || installState === void 0 ? void 0 : installState.managedFiles) || [];
    const managedFileSet = new Set(managedFiles.map(file => file.path));
    const missingManagedFiles = managedFiles
        .filter(file => !fs.existsSync(path.join(targetDir, file.path)))
        .map(file => file.path)
        .sort();
    const unexpectedStaticFiles = managedFileSet.size > 0
        ? STATIC_MANAGED_DIRS.flatMap(relativeRoot => {
            const absoluteRoot = path.join(targetDir, relativeRoot);
            return (0, install_sync_1.listFilesRecursive)(absoluteRoot)
                .map(filePath => (0, install_sync_1.toProjectRelativePath)(targetDir, filePath))
                .filter(filePath => !managedFileSet.has(filePath));
        }).sort()
        : [];
    const expectedResiduals = installState ? PROFILE_RESIDUAL_ARTIFACTS[installState.profile] : [];
    const unexpectedProfileFiles = expectedResiduals.filter(relativePath => {
        if (managedFileSet.has(relativePath))
            return false;
        return fs.existsSync(path.join(targetDir, relativePath));
    });
    return {
        targetDir,
        installStatePath,
        installStateExists,
        installState,
        rulesFilePath,
        rulesFileExists: rulesFilePath ? fs.existsSync(rulesFilePath) : false,
        workspaceIndexPath,
        workspaceIndexExists: workspaceIndexPath ? fs.existsSync(workspaceIndexPath) : false,
        trackedManagedFileCount: managedFiles.length,
        presentManagedFileCount: managedFiles.length - missingManagedFiles.length,
        missingManagedFiles,
        unexpectedStaticFiles,
        unexpectedProfileFiles,
    };
}
function buildDoctorChecks(inspection) {
    const checks = [];
    const { installState } = inspection;
    if (!inspection.installStateExists) {
        checks.push({
            id: 'install-state-missing',
            status: 'fail',
            message: '未找到 .codebuddy/install.json，请先执行 loader 安装。',
        });
        return checks;
    }
    if (!installState) {
        checks.push({
            id: 'install-state-invalid',
            status: 'fail',
            message: 'install.json 存在，但无法解析。',
        });
        return checks;
    }
    checks.push({
        id: 'install-state-schema',
        status: SUPPORTED_INSTALL_STATE_SCHEMAS.has(installState.schemaVersion) ? 'pass' : 'warn',
        message: SUPPORTED_INSTALL_STATE_SCHEMAS.has(installState.schemaVersion)
            ? `install.json schemaVersion=${installState.schemaVersion}`
            : `install.json schemaVersion=${installState.schemaVersion} 不在当前受支持列表中`,
    });
    checks.push({
        id: 'rules-file',
        status: inspection.rulesFileExists ? 'pass' : 'fail',
        message: inspection.rulesFileExists
            ? `规则文件存在: ${installState.outputs.rulesFile}`
            : `规则文件缺失: ${installState.outputs.rulesFile}`,
    });
    if (installState.outputs.workspaceIndexFile) {
        checks.push({
            id: 'workspace-index',
            status: inspection.workspaceIndexExists ? 'pass' : 'fail',
            message: inspection.workspaceIndexExists
                ? `workspace 索引存在: ${installState.outputs.workspaceIndexFile}`
                : `workspace 索引缺失: ${installState.outputs.workspaceIndexFile}`,
        });
    }
    checks.push({
        id: 'managed-files-tracked',
        status: inspection.trackedManagedFileCount > 0 ? 'pass' : 'fail',
        message: `tracked managed files: ${inspection.trackedManagedFileCount}`,
    });
    checks.push({
        id: 'managed-files-missing',
        status: inspection.missingManagedFiles.length === 0 ? 'pass' : 'fail',
        message: inspection.missingManagedFiles.length === 0
            ? '所有 managed files 均存在'
            : `缺失 ${inspection.missingManagedFiles.length} 个 managed files`,
        details: inspection.missingManagedFiles.slice(0, 10),
    });
    checks.push({
        id: 'unexpected-static-files',
        status: inspection.unexpectedStaticFiles.length === 0 ? 'pass' : 'warn',
        message: inspection.unexpectedStaticFiles.length === 0
            ? '未发现未跟踪的静态分发文件'
            : `发现 ${inspection.unexpectedStaticFiles.length} 个未跟踪的静态分发文件`,
        details: inspection.unexpectedStaticFiles.slice(0, 10),
    });
    if (installState.profile !== 'full') {
        const legacyArtifactCount = LEGACY_ORCHESTRATOR_ARTIFACTS.filter(relativePath => {
            var _a, _b;
            if (((_a = inspection.installState) === null || _a === void 0 ? void 0 : _a.profile) === 'orchestrator' || ((_b = inspection.installState) === null || _b === void 0 ? void 0 : _b.profile) === 'full') {
                return false;
            }
            return inspection.unexpectedProfileFiles.includes(relativePath);
        }).length;
        checks.push({
            id: 'profile-residual-cleanup',
            status: inspection.unexpectedProfileFiles.length === 0 ? 'pass' : 'warn',
            message: inspection.unexpectedProfileFiles.length === 0
                ? `${installState.profile} profile 未发现越界残留文件`
                : `${installState.profile} profile 仍存在 ${inspection.unexpectedProfileFiles.length} 个越界残留文件`
                    + (legacyArtifactCount > 0 ? `（其中 ${legacyArtifactCount} 个为编排契约残留）` : ''),
            details: inspection.unexpectedProfileFiles.slice(0, 10),
        });
    }
    return checks;
}
function summarizeDoctorChecks(checks) {
    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;
    for (const check of checks) {
        if (check.status === 'pass')
            passCount += 1;
        if (check.status === 'warn')
            warnCount += 1;
        if (check.status === 'fail')
            failCount += 1;
    }
    return {
        status: failCount > 0 ? 'fail' : (warnCount > 0 ? 'warn' : 'pass'),
        passCount,
        warnCount,
        failCount,
    };
}
function formatStatusReport(inspection) {
    if (!inspection.installState) {
        return [
            'CodeBuddy Status',
            `Target: ${inspection.targetDir}`,
            `Install File: ${inspection.installStatePath}`,
            'Status: missing',
            'Hint: 先执行 loader 安装，例如 `npm run codebuddy` 或 `node scripts/dist/codebuddy-loader.js`。',
        ].join('\n');
    }
    const installState = inspection.installState;
    return [
        'CodeBuddy Status',
        `Target: ${inspection.targetDir}`,
        `Install File: ${inspection.installStatePath}`,
        'Status: installed',
        `Version: ${installState.version}`,
        `Installed At: ${installState.installedAt}`,
        `Mode: ${installState.mode}`,
        `Profile: ${installState.profile}`,
        `Orchestrator: ${installState.enableOrchestrator}`,
        `Content Pack: ${installState.source.contentPackFile || 'n/a'}${installState.source.contentPackSha256 ? ` (${installState.source.contentPackSha256.slice(0, 12)})` : ''}`,
        `Content Hash: ${installState.contentHash}`,
        `Rules File: ${installState.outputs.rulesFile} (${inspection.rulesFileExists ? 'present' : 'missing'})`,
        `Workspace Index: ${installState.outputs.workspaceIndexFile || 'n/a'}${installState.outputs.workspaceIndexFile ? ` (${inspection.workspaceIndexExists ? 'present' : 'missing'})` : ''}`,
        `Managed Files: tracked=${inspection.trackedManagedFileCount}, present=${inspection.presentManagedFileCount}, missing=${inspection.missingManagedFiles.length}`,
        `Stats: skills=${installState.stats.skills}, agents=${installState.stats.agents}, scripts=${installState.stats.scripts}, workflows=${installState.stats.workflows}, taskbooks=${installState.stats.taskbooks}, agentCalls=${installState.stats.agentCalls}, commands=${installState.stats.commands}`,
    ].join('\n');
}
function formatDoctorReport(inspection, checks, summary) {
    const lines = [
        'CodeBuddy Doctor',
        `Target: ${inspection.targetDir}`,
        `Overall: ${summary.status.toUpperCase()} (pass=${summary.passCount}, warn=${summary.warnCount}, fail=${summary.failCount})`,
        '',
    ];
    for (const check of checks) {
        const marker = check.status === 'pass'
            ? 'PASS'
            : (check.status === 'warn' ? 'WARN' : 'FAIL');
        lines.push(`[${marker}] ${check.id}: ${check.message}`);
        if (check.details && check.details.length > 0) {
            for (const detail of check.details) {
                lines.push(`  - ${detail}`);
            }
        }
    }
    return lines.join('\n');
}
