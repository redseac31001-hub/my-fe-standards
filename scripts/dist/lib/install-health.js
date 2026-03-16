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
const child_process_1 = require("child_process");
const install_roots_1 = require("./install-roots");
const install_sync_1 = require("./install-sync");
const workflow_routing_selection_1 = require("./workflow-routing-selection");
const SUPPORTED_INSTALL_STATE_SCHEMAS = new Set(['1.0.0', '1.1.0', '1.2.0']);
const DEFAULT_WORKFLOW_STABLE_STEP_TYPES = [
    'requirement_and_prd',
    'analyze_project',
    'create_taskbook',
    'tdd_implement',
    'code_review',
    'build_and_fix',
    'acceptance_and_archive',
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
const PYTHON_COMMAND_CANDIDATES = process.platform === 'win32'
    ? [
        { command: 'python', args: [], label: 'python' },
        { command: 'py', args: ['-3'], label: 'py -3' },
        { command: 'python3', args: [], label: 'python3' },
    ]
    : [
        { command: 'python3', args: [], label: 'python3' },
        { command: 'python', args: [], label: 'python' },
    ];
function canRunCommand(command, args) {
    const result = (0, child_process_1.spawnSync)(command, [...args, '--version'], {
        encoding: 'utf-8',
        stdio: 'ignore',
        timeout: 5000,
    });
    return !result.error && result.status === 0;
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function readJsonFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    catch (_a) {
        return null;
    }
}
function readTextFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    }
    catch (_a) {
        return null;
    }
}
function parseFirstJsonCodeBlock(markdown) {
    var _a;
    const match = markdown.match(/```json\s*([\s\S]*?)\s*```/);
    return (_a = match === null || match === void 0 ? void 0 : match[1]) !== null && _a !== void 0 ? _a : null;
}
function parseAgentCallPromptHeaderPaths(markdown) {
    const jsonText = parseFirstJsonCodeBlock(markdown);
    if (!jsonText)
        return null;
    try {
        const parsed = JSON.parse(jsonText);
        if (!isPlainObject(parsed))
            return null;
        return parsed;
    }
    catch (_a) {
        return null;
    }
}
function collectArchitectureConstraintDetails(inspection) {
    var _a;
    const details = [];
    const defaultWorkflowPath = path.join(inspection.targetDir, '.codebuddy', 'workflows', 'default.workflow.json');
    if (fs.existsSync(defaultWorkflowPath)) {
        const workflow = readJsonFile(defaultWorkflowPath);
        if (isPlainObject(workflow)) {
            const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
            if (steps.length > 7) {
                details.push(`default workflow has ${steps.length} steps; documented stable baseline is 7`);
            }
            const stepTypes = new Set(steps
                .filter(isPlainObject)
                .map(step => typeof step.type === 'string' ? step.type : '')
                .filter(Boolean));
            const missingStepTypes = DEFAULT_WORKFLOW_STABLE_STEP_TYPES.filter(type => !stepTypes.has(type));
            if (missingStepTypes.length > 0) {
                details.push(`default workflow is missing expected stable step types: ${missingStepTypes.join(', ')}`);
            }
        }
    }
    const agentCallsDir = path.join(inspection.targetDir, '.codebuddy', 'agent-calls');
    if (fs.existsSync(agentCallsDir)) {
        const requestIds = new Map();
        for (const entry of fs.readdirSync(agentCallsDir, { withFileTypes: true })) {
            if (!entry.isFile())
                continue;
            const match = entry.name.match(/^(.*)\.(prompt\.md|result\.json)$/);
            if (!match)
                continue;
            const requestId = match[1];
            const suffix = match[2];
            const fileState = (_a = requestIds.get(requestId)) !== null && _a !== void 0 ? _a : { promptFile: null, resultFile: null };
            const filePath = path.join(agentCallsDir, entry.name);
            if (suffix === 'prompt.md')
                fileState.promptFile = filePath;
            if (suffix === 'result.json')
                fileState.resultFile = filePath;
            requestIds.set(requestId, fileState);
        }
        for (const [requestId, fileState] of requestIds.entries()) {
            const expectedPromptPath = `.codebuddy/agent-calls/${requestId}.prompt.md`;
            const expectedResultPath = `.codebuddy/agent-calls/${requestId}.result.json`;
            if (fileState.promptFile) {
                const promptRelative = (0, install_sync_1.toProjectRelativePath)(inspection.targetDir, fileState.promptFile);
                if (promptRelative !== expectedPromptPath) {
                    details.push(`${requestId}: prompt file location ${promptRelative} differs from stable contract ${expectedPromptPath}`);
                }
                const promptContent = readTextFile(fileState.promptFile);
                const promptHeader = promptContent ? parseAgentCallPromptHeaderPaths(promptContent) : null;
                if (promptHeader) {
                    if (isNonEmptyString(promptHeader.promptPath) && promptHeader.promptPath.replace(/\\/g, '/') !== expectedPromptPath) {
                        details.push(`${requestId}: prompt header promptPath=${promptHeader.promptPath} differs from stable contract ${expectedPromptPath}`);
                    }
                    if (isNonEmptyString(promptHeader.resultPath) && promptHeader.resultPath.replace(/\\/g, '/') !== expectedResultPath) {
                        details.push(`${requestId}: prompt header resultPath=${promptHeader.resultPath} differs from stable contract ${expectedResultPath}`);
                    }
                }
            }
            if (fileState.resultFile) {
                const resultRelative = (0, install_sync_1.toProjectRelativePath)(inspection.targetDir, fileState.resultFile);
                if (resultRelative !== expectedResultPath) {
                    details.push(`${requestId}: result file location ${resultRelative} differs from stable contract ${expectedResultPath}`);
                }
            }
        }
    }
    return Array.from(new Set(details));
}
function collectWorkflowRoutingReportDetails(inspection) {
    var _a, _b, _c;
    const report = (0, workflow_routing_selection_1.readLatestWorkflowRoutingReport)(inspection.targetDir);
    const details = [];
    if (!report) {
        return { report, details };
    }
    const selectedWorkflowPath = ((_a = report.decision) === null || _a === void 0 ? void 0 : _a.selectedWorkflowPath) || '';
    if (selectedWorkflowPath) {
        const absoluteWorkflowPath = path.isAbsolute(selectedWorkflowPath)
            ? selectedWorkflowPath
            : path.join(inspection.targetDir, selectedWorkflowPath);
        if (!fs.existsSync(absoluteWorkflowPath)) {
            details.push(`latest route points to a missing workflow file: ${selectedWorkflowPath}`);
        }
    }
    if (((_b = report.decision) === null || _b === void 0 ? void 0 : _b.mode) === 'fallback') {
        details.push(`latest route fell back to ${report.decision.selectedWorkflowId}: ${report.decision.fallbackReason || 'unknown reason'}`);
    }
    if (((_c = report.decision) === null || _c === void 0 ? void 0 : _c.confidence) === 'low') {
        details.push(`latest route confidence is low (${report.decision.selectedWorkflowId})`);
    }
    return { report, details: Array.from(new Set(details)) };
}
function detectPythonRuntime() {
    let fallback = null;
    for (const candidate of PYTHON_COMMAND_CANDIDATES) {
        if (!canRunCommand(candidate.command, candidate.args)) {
            continue;
        }
        const importResult = (0, child_process_1.spawnSync)(candidate.command, [...candidate.args, '-c', 'import docx'], {
            encoding: 'utf-8',
            stdio: 'ignore',
            timeout: 5000,
        });
        const status = {
            available: true,
            label: candidate.label,
            pythonDocx: !importResult.error && importResult.status === 0,
        };
        if (status.pythonDocx) {
            return status;
        }
        if (!fallback) {
            fallback = status;
        }
    }
    return fallback || {
        available: false,
        label: null,
        pythonDocx: false,
    };
}
function needsSystemOverviewPythonRuntime(inspection) {
    var _a;
    const managedFiles = ((_a = inspection.installState) === null || _a === void 0 ? void 0 : _a.managedFiles) || [];
    return managedFiles.some(file => /system-overview-design\/scripts\/(extract_template|render_overview_doc)\.py$/.test(file.path.replace(/\\/g, '/')));
}
function buildPipInstallCommand(pythonLabel) {
    return pythonLabel ? `${pythonLabel} -m pip install python-docx` : 'python -m pip install python-docx';
}
function resolveManagedRoots(installState) {
    const roots = [
        '.codebuddy/agent-calls',
        '.codebuddy/commands',
        '.codebuddy/rules',
        '.codebuddy/rules_cache',
        '.codebuddy/scripts',
        '.codebuddy/taskbooks',
        '.codebuddy/workflows',
    ];
    const agentsRootDir = (0, install_roots_1.resolveInstalledAgentsRootDir)(installState);
    if (agentsRootDir) {
        roots.push(agentsRootDir);
    }
    const skillsRootDir = (0, install_roots_1.resolveInstalledSkillsRootDir)(installState);
    if (skillsRootDir) {
        roots.push(skillsRootDir);
    }
    return roots;
}
function inspectInstallState(targetDir, installState, installStateExists) {
    const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
    const rulesFilePath = (installState === null || installState === void 0 ? void 0 : installState.outputs.rulesFile)
        ? path.join(targetDir, installState.outputs.rulesFile)
        : null;
    const workspaceIndexPath = (installState === null || installState === void 0 ? void 0 : installState.outputs.workspaceIndexFile)
        ? path.join(targetDir, installState.outputs.workspaceIndexFile)
        : null;
    const agentsRootDir = (0, install_roots_1.resolveInstalledAgentsRootDir)(installState);
    const agentsRootPath = agentsRootDir
        ? path.join(targetDir, agentsRootDir)
        : null;
    const skillsRootDir = (0, install_roots_1.resolveInstalledSkillsRootDir)(installState);
    const skillsRootPath = skillsRootDir
        ? path.join(targetDir, skillsRootDir)
        : null;
    const managedFiles = (installState === null || installState === void 0 ? void 0 : installState.managedFiles) || [];
    const managedFileSet = new Set(managedFiles.map(file => file.path));
    const missingManagedFiles = managedFiles
        .filter(file => !fs.existsSync(path.join(targetDir, file.path)))
        .map(file => file.path)
        .sort();
    const unexpectedStaticFiles = managedFileSet.size > 0
        ? resolveManagedRoots(installState).flatMap(relativeRoot => {
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
        agentsRootPath,
        agentsRootExists: agentsRootPath ? fs.existsSync(agentsRootPath) : false,
        skillsRootPath,
        skillsRootExists: skillsRootPath ? fs.existsSync(skillsRootPath) : false,
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
    const agentsRootDir = (0, install_roots_1.resolveInstalledAgentsRootDir)(installState);
    if (agentsRootDir) {
        checks.push({
            id: 'agents-root',
            status: inspection.agentsRootExists ? 'pass' : 'fail',
            message: inspection.agentsRootExists
                ? `agents 根存在: ${agentsRootDir}`
                : `agents 根缺失: ${agentsRootDir}`,
        });
    }
    const skillsRootDir = (0, install_roots_1.resolveInstalledSkillsRootDir)(installState);
    if (skillsRootDir) {
        checks.push({
            id: 'skills-root',
            status: inspection.skillsRootExists ? 'pass' : 'fail',
            message: inspection.skillsRootExists
                ? `skills 根存在: ${skillsRootDir}`
                : `skills 根缺失: ${skillsRootDir}`,
        });
    }
    if (needsSystemOverviewPythonRuntime(inspection)) {
        const pythonRuntime = detectPythonRuntime();
        checks.push({
            id: 'system-overview-python',
            status: pythonRuntime.available ? 'pass' : 'warn',
            message: pythonRuntime.available
                ? `system-overview-design Python runtime ready: ${pythonRuntime.label}`
                : 'system-overview-design requires Python 3, but no python command was detected on PATH',
            details: pythonRuntime.available ? undefined : [
                'Install Python 3 and ensure `python`, `python3`, or `py -3` is available in PATH.',
            ],
        });
        checks.push({
            id: 'system-overview-python-docx',
            status: !pythonRuntime.available || pythonRuntime.pythonDocx ? 'pass' : 'warn',
            message: !pythonRuntime.available
                ? 'Skip python-docx check because Python runtime is unavailable'
                : (pythonRuntime.pythonDocx
                    ? `python-docx import ok via ${pythonRuntime.label}`
                    : `python-docx is missing for ${pythonRuntime.label}`),
            details: !pythonRuntime.available || pythonRuntime.pythonDocx
                ? undefined
                : [`Install dependency: \`${buildPipInstallCommand(pythonRuntime.label)}\``],
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
    const architectureConstraintDetails = collectArchitectureConstraintDetails(inspection);
    if (architectureConstraintDetails.length > 0) {
        checks.push({
            id: 'architecture-constraints',
            status: 'warn',
            message: `发现 ${architectureConstraintDetails.length} 个架构约束漂移信号`,
            details: architectureConstraintDetails.slice(0, 10),
        });
    }
    else if (installState.enableOrchestrator || installState.stats.workflows > 0 || installState.stats.agentCalls > 0) {
        checks.push({
            id: 'architecture-constraints',
            status: 'pass',
            message: '未发现默认 workflow / agent-call 稳定契约漂移',
        });
    }
    const workflowRoutingReport = collectWorkflowRoutingReportDetails(inspection);
    if (workflowRoutingReport.report) {
        checks.push({
            id: 'workflow-routing-report',
            status: workflowRoutingReport.details.length > 0 ? 'warn' : 'pass',
            message: workflowRoutingReport.details.length > 0
                ? `最近一次 workflow 路由存在 ${workflowRoutingReport.details.length} 个需关注信号`
                : `最近一次 workflow 路由正常: ${workflowRoutingReport.report.decision.selectedWorkflowId} (${workflowRoutingReport.report.decision.mode})`,
            details: workflowRoutingReport.details.length > 0
                ? workflowRoutingReport.details.slice(0, 10)
                : [
                    `taskBookId=${workflowRoutingReport.report.taskBookId}`,
                    `workflow=${workflowRoutingReport.report.decision.selectedWorkflowId}`,
                    `mode=${workflowRoutingReport.report.decision.mode}`,
                    `confidence=${workflowRoutingReport.report.decision.confidence}`,
                ],
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
    var _a, _b;
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
        `Pack Mode: ${installState.options.strictRemotePack ? 'strict' : 'fallback-allowed'}`,
        `Content Pack: ${installState.source.contentPackFile || 'n/a'}${installState.source.contentPackSha256 ? ` (${installState.source.contentPackSha256.slice(0, 12)})` : ''}`,
        `Content Hash: ${installState.contentHash}`,
        `Rules File: ${installState.outputs.rulesFile} (${inspection.rulesFileExists ? 'present' : 'missing'})`,
        `Workspace Index: ${installState.outputs.workspaceIndexFile || 'n/a'}${installState.outputs.workspaceIndexFile ? ` (${inspection.workspaceIndexExists ? 'present' : 'missing'})` : ''}`,
        `Agents Root: ${(0, install_roots_1.resolveInstalledAgentsRootDir)(installState) || 'n/a'}${(0, install_roots_1.resolveInstalledAgentsRootDir)(installState) ? ` (${inspection.agentsRootExists ? 'present' : 'missing'})` : ''}`,
        `Agents Snapshot Retention: ${(_a = (0, install_roots_1.resolveInstalledAgentsSnapshotRetention)(installState)) !== null && _a !== void 0 ? _a : 'n/a'}`,
        `Skills Root: ${(0, install_roots_1.resolveInstalledSkillsRootDir)(installState) || 'n/a'}${(0, install_roots_1.resolveInstalledSkillsRootDir)(installState) ? ` (${inspection.skillsRootExists ? 'present' : 'missing'})` : ''}`,
        `Skills Snapshot Retention: ${(_b = (0, install_roots_1.resolveInstalledSkillsSnapshotRetention)(installState)) !== null && _b !== void 0 ? _b : 'n/a'}`,
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
