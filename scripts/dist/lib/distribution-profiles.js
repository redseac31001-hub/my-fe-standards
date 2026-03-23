"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_CALL_FILES_TO_DISTRIBUTE = exports.TASKBOOK_FILES_TO_DISTRIBUTE = exports.WORKFLOWS_TO_DISTRIBUTE = exports.COMMANDS_TO_DISTRIBUTE = exports.FULL_SCRIPTS = exports.ORCHESTRATOR_SCRIPTS = exports.ANALYSIS_SCRIPTS = exports.CORE_SCRIPTS = void 0;
exports.isOrchestratorProfile = isOrchestratorProfile;
exports.getScriptsForProfile = getScriptsForProfile;
exports.getScriptArtifactsForProfile = getScriptArtifactsForProfile;
const CLI_ENTRY_DEPENDENCIES = ['lib/cli-entry.js'];
const FRONTMATTER_DEPENDENCIES = ['lib/frontmatter-utils.js'];
const INSTALL_ROOTS_DEPENDENCIES = ['lib/install-roots.js', 'lib/install-sync.js'];
const MODULE_MAPPER_DEPENDENCIES = [...CLI_ENTRY_DEPENDENCIES, 'types/module-mapper.js'];
const STRUCTURE_ANALYZER_DEPENDENCIES = [...CLI_ENTRY_DEPENDENCIES, 'types/structure-analyzer.js'];
const TASK_INTAKE_ROUTER_DEPENDENCIES = [...CLI_ENTRY_DEPENDENCIES, 'lib/task-intake-routing.js'];
const VALIDATOR_GATE_DEPENDENCIES = [
    'rule-validator.js',
    'skill-validator.js',
    'repo-state-validator.js',
    'lib/validator-gate-report.js',
    'types/reports.js',
];
const WORKFLOW_ROUTING_DEPENDENCIES = [
    'lib/project-detection.js',
    'lib/workflow-routing.js',
    'lib/workflow-routing-selection.js',
];
const REPORT_MANAGER_DEPENDENCIES = [
    ...CLI_ENTRY_DEPENDENCIES,
    ...WORKFLOW_ROUTING_DEPENDENCIES,
    'lib/validator-gate-report.js',
    'lib/audit-report.js',
    'types/reports.js',
];
const TASK_EXECUTOR_DEPENDENCIES = [
    ...CLI_ENTRY_DEPENDENCIES,
    ...FRONTMATTER_DEPENDENCIES,
    ...INSTALL_ROOTS_DEPENDENCIES,
    ...WORKFLOW_ROUTING_DEPENDENCIES,
    'agent-runtime.js',
    'result-aggregator.js',
    'lib/worker-executor.js',
    'lib/execution-metrics.js',
];
exports.CORE_SCRIPTS = [
    { file: 'rule-validator.js' },
    { file: 'skill-validator.js', dependencies: FRONTMATTER_DEPENDENCIES },
    { file: 'validator-gate.js', dependencies: VALIDATOR_GATE_DEPENDENCIES },
];
exports.ANALYSIS_SCRIPTS = [
    { file: 'task-intake-router.js', dependencies: TASK_INTAKE_ROUTER_DEPENDENCIES },
    { file: 'structure-analyzer.js', dependencies: STRUCTURE_ANALYZER_DEPENDENCIES },
    { file: 'module-mapper.js', dependencies: MODULE_MAPPER_DEPENDENCIES },
    { file: 'report-manager.js', dependencies: REPORT_MANAGER_DEPENDENCIES },
];
exports.ORCHESTRATOR_SCRIPTS = [
    { file: 'agent-call-manager.js', dependencies: CLI_ENTRY_DEPENDENCIES },
    { file: 'task-orchestrator.js', dependencies: [...CLI_ENTRY_DEPENDENCIES, ...WORKFLOW_ROUTING_DEPENDENCIES, 'lib/execution-metrics.js'] },
    { file: 'taskbook-manager.js', dependencies: INSTALL_ROOTS_DEPENDENCIES },
    { file: 'task-executor.js', dependencies: TASK_EXECUTOR_DEPENDENCIES },
    { file: 'contract-validator.js' },
    { file: 'reference-finder.js', dependencies: CLI_ENTRY_DEPENDENCIES },
    { file: 'context-collector.js', dependencies: CLI_ENTRY_DEPENDENCIES },
];
exports.FULL_SCRIPTS = [
    { file: 'agent-registry.js', dependencies: [...FRONTMATTER_DEPENDENCIES, ...INSTALL_ROOTS_DEPENDENCIES] },
];
exports.COMMANDS_TO_DISTRIBUTE = [
    { sourcePath: '.claude/commands/task.md', destFile: 'task.md' },
    { sourcePath: '.claude/commands/agent-call.md', destFile: 'agent-call.md' },
];
exports.WORKFLOWS_TO_DISTRIBUTE = [
    { sourcePath: 'workflows/schema/workflow.schema.json', destFile: 'workflow.schema.json' },
    { sourcePath: 'workflows/templates/default.workflow.json', destFile: 'default.workflow.json' },
    { sourcePath: 'workflows/templates/sprint.workflow.json', destFile: 'sprint.workflow.json' },
    { sourcePath: 'workflows/templates/micro.workflow.json', destFile: 'micro.workflow.json' },
];
exports.TASKBOOK_FILES_TO_DISTRIBUTE = [
    { sourcePath: 'taskbooks/schema/taskbook.schema.json', destFile: 'taskbook.schema.json' },
];
exports.AGENT_CALL_FILES_TO_DISTRIBUTE = [
    { sourcePath: 'agent-calls/schema/agent-call.schema.json', destFile: 'agent-call.schema.json' },
];
function isOrchestratorProfile(profile) {
    return profile === 'orchestrator' || profile === 'full';
}
function getScriptsForProfile(profile) {
    const scripts = [...exports.CORE_SCRIPTS];
    if (profile !== 'core') {
        scripts.push(...exports.ANALYSIS_SCRIPTS);
    }
    if (isOrchestratorProfile(profile)) {
        scripts.push(...exports.ORCHESTRATOR_SCRIPTS);
    }
    if (profile === 'full') {
        scripts.push(...exports.FULL_SCRIPTS);
    }
    return scripts;
}
function getScriptArtifactsForProfile(profile) {
    const artifacts = new Set();
    for (const script of getScriptsForProfile(profile)) {
        artifacts.add(script.file);
        for (const dependency of script.dependencies || []) {
            artifacts.add(dependency);
        }
    }
    return Array.from(artifacts).sort((left, right) => left.localeCompare(right));
}
