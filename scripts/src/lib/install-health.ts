import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { InstallState } from '../types';
import {
  resolveInstalledAgentsRootDir,
  resolveInstalledAgentsSnapshotRetention,
  resolveInstalledSkillsRootDir,
  resolveInstalledSkillsSnapshotRetention,
} from './install-roots';
import { listFilesRecursive, toProjectRelativePath } from './install-sync';
import {
  buildValidatorGateDelta,
  getPreviousValidatorGateEntry,
  readLatestValidatorGateReport,
  readValidatorGateHistory,
} from './validator-gate-report';
import { readLatestWorkflowRoutingReport } from './workflow-routing-selection';

export type DoctorCheckStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
  id: string;
  status: DoctorCheckStatus;
  message: string;
  details?: string[];
}

export interface InstallInspection {
  targetDir: string;
  installStatePath: string;
  installStateExists: boolean;
  installState: InstallState | null;
  rulesFilePath: string | null;
  rulesFileExists: boolean;
  workspaceIndexPath: string | null;
  workspaceIndexExists: boolean;
  agentsRootPath: string | null;
  agentsRootExists: boolean;
  skillsRootPath: string | null;
  skillsRootExists: boolean;
  trackedManagedFileCount: number;
  presentManagedFileCount: number;
  missingManagedFiles: string[];
  unexpectedStaticFiles: string[];
  unexpectedProfileFiles: string[];
}

type AgentCallPromptHeaderPaths = {
  promptPath?: string;
  resultPath?: string;
};

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
const PROFILE_RESIDUAL_ARTIFACTS: Record<InstallState['profile'], string[]> = {
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
const OPTIONAL_STATIC_SUPPORT_FILES = new Set([
  '.codebuddy/scripts/agent-runtime.js',
  '.codebuddy/scripts/types/agent-runtime.js',
  '.codebuddy/scripts/types/index.js',
]);

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

interface PythonRuntimeStatus {
  available: boolean;
  label: string | null;
  pythonDocx: boolean;
}

function canRunCommand(command: string, args: string[]): boolean {
  const result = spawnSync(command, [...args, '--version'], {
    encoding: 'utf-8',
    stdio: 'ignore',
    timeout: 5000,
  });
  return !result.error && result.status === 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readJsonFile(filePath: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
  } catch {
    return null;
  }
}

function readTextFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function parseFirstJsonCodeBlock(markdown: string): string | null {
  const match = markdown.match(/```json\s*([\s\S]*?)\s*```/);
  return match?.[1] ?? null;
}

function parseAgentCallPromptHeaderPaths(markdown: string): AgentCallPromptHeaderPaths | null {
  const jsonText = parseFirstJsonCodeBlock(markdown);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!isPlainObject(parsed)) return null;
    return parsed as AgentCallPromptHeaderPaths;
  } catch {
    return null;
  }
}

function collectArchitectureConstraintDetails(inspection: InstallInspection): string[] {
  const details: string[] = [];
  const defaultWorkflowPath = path.join(inspection.targetDir, '.codebuddy', 'workflows', 'default.workflow.json');

  if (fs.existsSync(defaultWorkflowPath)) {
    const workflow = readJsonFile(defaultWorkflowPath);
    if (isPlainObject(workflow)) {
      const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
      if (steps.length > 7) {
        details.push(`default workflow has ${steps.length} steps; documented stable baseline is 7`);
      }

      const stepTypes = new Set(
        steps
          .filter(isPlainObject)
          .map(step => typeof step.type === 'string' ? step.type : '')
          .filter(Boolean),
      );
      const missingStepTypes = DEFAULT_WORKFLOW_STABLE_STEP_TYPES.filter(type => !stepTypes.has(type));
      if (missingStepTypes.length > 0) {
        details.push(`default workflow is missing expected stable step types: ${missingStepTypes.join(', ')}`);
      }
    }
  }

  const agentCallsDir = path.join(inspection.targetDir, '.codebuddy', 'agent-calls');
  if (fs.existsSync(agentCallsDir)) {
    const requestIds = new Map<string, { promptFile: string | null; resultFile: string | null }>();
    for (const entry of fs.readdirSync(agentCallsDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const match = entry.name.match(/^(.*)\.(prompt\.md|result\.json)$/);
      if (!match) continue;

      const requestId = match[1];
      const suffix = match[2];
      const fileState = requestIds.get(requestId) ?? { promptFile: null, resultFile: null };
      const filePath = path.join(agentCallsDir, entry.name);
      if (suffix === 'prompt.md') fileState.promptFile = filePath;
      if (suffix === 'result.json') fileState.resultFile = filePath;
      requestIds.set(requestId, fileState);
    }

    for (const [requestId, fileState] of requestIds.entries()) {
      const expectedPromptPath = `.codebuddy/agent-calls/${requestId}.prompt.md`;
      const expectedResultPath = `.codebuddy/agent-calls/${requestId}.result.json`;

      if (fileState.promptFile) {
        const promptRelative = toProjectRelativePath(inspection.targetDir, fileState.promptFile);
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
        const resultRelative = toProjectRelativePath(inspection.targetDir, fileState.resultFile);
        if (resultRelative !== expectedResultPath) {
          details.push(`${requestId}: result file location ${resultRelative} differs from stable contract ${expectedResultPath}`);
        }
      }
    }
  }

  return Array.from(new Set(details));
}

function collectWorkflowRoutingReportDetails(inspection: InstallInspection): {
  report: ReturnType<typeof readLatestWorkflowRoutingReport>;
  details: string[];
} {
  const report = readLatestWorkflowRoutingReport(inspection.targetDir);
  const details: string[] = [];

  if (!report) {
    return { report, details };
  }

  const selectedWorkflowPath = report.decision?.selectedWorkflowPath || '';
  if (selectedWorkflowPath) {
    const absoluteWorkflowPath = path.isAbsolute(selectedWorkflowPath)
      ? selectedWorkflowPath
      : path.join(inspection.targetDir, selectedWorkflowPath);
    if (!fs.existsSync(absoluteWorkflowPath)) {
      details.push(`latest route points to a missing workflow file: ${selectedWorkflowPath}`);
    }
  }

  if (report.decision?.mode === 'fallback') {
    details.push(`latest route fell back to ${report.decision.selectedWorkflowId}: ${report.decision.fallbackReason || 'unknown reason'}`);
  }

  if (report.decision?.confidence === 'low') {
    details.push(`latest route confidence is low (${report.decision.selectedWorkflowId})`);
  }

  return { report, details: Array.from(new Set(details)) };
}

function collectValidatorGateReportDetails(inspection: InstallInspection): {
  report: ReturnType<typeof readLatestValidatorGateReport>;
  details: string[];
  trend: 'regressed' | 'improved' | 'stable' | 'unknown' | null;
} {
  const report = readLatestValidatorGateReport(inspection.targetDir);
  const details: string[] = [];

  if (!report) {
    return { report, details, trend: null };
  }

  const history = readValidatorGateHistory(inspection.targetDir, Number.POSITIVE_INFINITY);
  const previous = getPreviousValidatorGateEntry(report, history);
  const delta = buildValidatorGateDelta(report, previous);

  if (!report.effectiveOk) {
    details.push(`latest validator gate reported fail: scope=${report.scope}, strict=${report.strictMode ? 'on' : 'off'}`);
  }

  if ((report.errorCount || 0) > 0 || (report.warningCount || 0) > 0) {
    details.push(`latest validator gate counts: errors=${report.errorCount || 0}, warnings=${report.warningCount || 0}`);
  }

  if (report.outputDir) {
    details.push(`report output dir: ${report.outputDir}`);
  }
  if (report.historyDir) {
    details.push(`report history dir: ${report.historyDir}`);
  }
  if (previous && delta) {
    details.push(`previous validator gate: ${previous.generatedAt} (${previous.scope}, ${previous.strictMode ? 'strict' : 'default'})`);
    details.push(`validator gate trend: ${delta.direction}`);
    details.push(`validator gate delta: errors=${delta.errorDelta >= 0 ? '+' : ''}${delta.errorDelta}, warnings=${delta.warningDelta >= 0 ? '+' : ''}${delta.warningDelta}, issues=${delta.issueDelta >= 0 ? '+' : ''}${delta.issueDelta}`);
  }

  return { report, details: Array.from(new Set(details)), trend: delta?.direction ?? null };
}

function detectPythonRuntime(): PythonRuntimeStatus {
  let fallback: PythonRuntimeStatus | null = null;

  for (const candidate of PYTHON_COMMAND_CANDIDATES) {
    if (!canRunCommand(candidate.command, candidate.args)) {
      continue;
    }

    const importResult = spawnSync(candidate.command, [...candidate.args, '-c', 'import docx'], {
      encoding: 'utf-8',
      stdio: 'ignore',
      timeout: 5000,
    });

    const status: PythonRuntimeStatus = {
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

function needsSystemOverviewPythonRuntime(inspection: InstallInspection): boolean {
  const managedFiles = inspection.installState?.managedFiles || [];
  return managedFiles.some(file => /system-overview-design\/scripts\/(extract_template|render_overview_doc)\.py$/.test(file.path.replace(/\\/g, '/')));
}

function buildPipInstallCommand(pythonLabel: string | null): string {
  return pythonLabel ? `${pythonLabel} -m pip install python-docx` : 'python -m pip install python-docx';
}

function resolveManagedRoots(installState: InstallState | null): string[] {
  const roots = [
    '.codebuddy/agent-calls',
    '.codebuddy/commands',
    '.codebuddy/rules',
    '.codebuddy/rules_cache',
    '.codebuddy/scripts',
    '.codebuddy/taskbooks',
    '.codebuddy/workflows',
  ];

  const agentsRootDir = resolveInstalledAgentsRootDir(installState);
  if (agentsRootDir) {
    roots.push(agentsRootDir);
  }

  const skillsRootDir = resolveInstalledSkillsRootDir(installState);
  if (skillsRootDir) {
    roots.push(skillsRootDir);
  }

  return roots;
}

export function inspectInstallState(
  targetDir: string,
  installState: InstallState | null,
  installStateExists: boolean,
): InstallInspection {
  const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
  const rulesFilePath = installState?.outputs.rulesFile
    ? path.join(targetDir, installState.outputs.rulesFile)
    : null;
  const workspaceIndexPath = installState?.outputs.workspaceIndexFile
    ? path.join(targetDir, installState.outputs.workspaceIndexFile)
    : null;
  const agentsRootDir = resolveInstalledAgentsRootDir(installState);
  const agentsRootPath = agentsRootDir
    ? path.join(targetDir, agentsRootDir)
    : null;
  const skillsRootDir = resolveInstalledSkillsRootDir(installState);
  const skillsRootPath = skillsRootDir
    ? path.join(targetDir, skillsRootDir)
    : null;

  const managedFiles = installState?.managedFiles || [];
  const managedFileSet = new Set(managedFiles.map(file => file.path));
  const missingManagedFiles = managedFiles
    .filter(file => !fs.existsSync(path.join(targetDir, file.path)))
    .map(file => file.path)
    .sort();

  const unexpectedStaticFiles = managedFileSet.size > 0
    ? resolveManagedRoots(installState).flatMap(relativeRoot => {
        const absoluteRoot = path.join(targetDir, relativeRoot);
        return listFilesRecursive(absoluteRoot)
          .map(filePath => toProjectRelativePath(targetDir, filePath))
          .filter(filePath => !managedFileSet.has(filePath))
          .filter(filePath => !OPTIONAL_STATIC_SUPPORT_FILES.has(filePath));
      }).sort()
    : [];

  const expectedResiduals = installState ? PROFILE_RESIDUAL_ARTIFACTS[installState.profile] : [];
  const unexpectedProfileFiles = expectedResiduals.filter(relativePath => {
    if (managedFileSet.has(relativePath)) return false;
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

export function buildDoctorChecks(inspection: InstallInspection): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
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

  const agentsRootDir = resolveInstalledAgentsRootDir(installState);
  if (agentsRootDir) {
    checks.push({
      id: 'agents-root',
      status: inspection.agentsRootExists ? 'pass' : 'fail',
      message: inspection.agentsRootExists
        ? `agents 根存在: ${agentsRootDir}`
        : `agents 根缺失: ${agentsRootDir}`,
    });
  }

  const skillsRootDir = resolveInstalledSkillsRootDir(installState);
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
      if (inspection.installState?.profile === 'orchestrator' || inspection.installState?.profile === 'full') {
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
  } else if (installState.enableOrchestrator || installState.stats.workflows > 0 || installState.stats.agentCalls > 0) {
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

  const validatorGateReport = collectValidatorGateReportDetails(inspection);
  if (validatorGateReport.report) {
    const validatorGateStatus: DoctorCheckStatus = !validatorGateReport.report.effectiveOk || validatorGateReport.trend === 'regressed'
      ? 'warn'
      : 'pass';
    checks.push({
      id: 'validator-gate-report',
      status: validatorGateStatus,
      message: validatorGateStatus === 'pass'
        ? `最近一次 validator gate 正常: ${validatorGateReport.report.scope} (${validatorGateReport.report.strictMode ? 'strict' : 'default'})`
        : `最近一次 validator gate 需关注: ${validatorGateReport.report.scope} (${validatorGateReport.report.strictMode ? 'strict' : 'default'})${validatorGateReport.trend === 'regressed' ? '，且相对上一轮有回退' : ''}`,
      details: validatorGateReport.details.length > 0
        ? validatorGateReport.details.slice(0, 10)
        : [
            `scope=${validatorGateReport.report.scope}`,
            `strict=${validatorGateReport.report.strictMode ? 'on' : 'off'}`,
            `errors=${validatorGateReport.report.errorCount}`,
            `warnings=${validatorGateReport.report.warningCount}`,
          ],
    });
  }

  return checks;
}

export function summarizeDoctorChecks(checks: DoctorCheck[]): {
  status: DoctorCheckStatus;
  passCount: number;
  warnCount: number;
  failCount: number;
} {
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const check of checks) {
    if (check.status === 'pass') passCount += 1;
    if (check.status === 'warn') warnCount += 1;
    if (check.status === 'fail') failCount += 1;
  }

  return {
    status: failCount > 0 ? 'fail' : (warnCount > 0 ? 'warn' : 'pass'),
    passCount,
    warnCount,
    failCount,
  };
}

export function formatStatusReport(inspection: InstallInspection): string {
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
    `Agents Root: ${resolveInstalledAgentsRootDir(installState) || 'n/a'}${resolveInstalledAgentsRootDir(installState) ? ` (${inspection.agentsRootExists ? 'present' : 'missing'})` : ''}`,
    `Agents Snapshot Retention: ${resolveInstalledAgentsSnapshotRetention(installState) ?? 'n/a'}`,
    `Skills Root: ${resolveInstalledSkillsRootDir(installState) || 'n/a'}${resolveInstalledSkillsRootDir(installState) ? ` (${inspection.skillsRootExists ? 'present' : 'missing'})` : ''}`,
    `Skills Snapshot Retention: ${resolveInstalledSkillsSnapshotRetention(installState) ?? 'n/a'}`,
    `Managed Files: tracked=${inspection.trackedManagedFileCount}, present=${inspection.presentManagedFileCount}, missing=${inspection.missingManagedFiles.length}`,
    `Stats: skills=${installState.stats.skills}, agents=${installState.stats.agents}, scripts=${installState.stats.scripts}, workflows=${installState.stats.workflows}, taskbooks=${installState.stats.taskbooks}, agentCalls=${installState.stats.agentCalls}, commands=${installState.stats.commands}`,
  ].join('\n');
}

export function formatDoctorReport(
  inspection: InstallInspection,
  checks: DoctorCheck[],
  summary: ReturnType<typeof summarizeDoctorChecks>,
): string {
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
