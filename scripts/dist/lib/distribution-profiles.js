"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_CALL_FILES_TO_DISTRIBUTE = exports.TASKBOOK_FILES_TO_DISTRIBUTE = exports.WORKFLOWS_TO_DISTRIBUTE = exports.COMMANDS_TO_DISTRIBUTE = exports.FULL_SCRIPTS = exports.ORCHESTRATOR_SCRIPTS = exports.ANALYSIS_SCRIPTS = exports.CORE_SCRIPTS = void 0;
exports.isOrchestratorProfile = isOrchestratorProfile;
exports.getScriptsForProfile = getScriptsForProfile;
exports.CORE_SCRIPTS = [
    { file: 'rule-validator.js' },
    { file: 'skill-validator.js' },
];
exports.ANALYSIS_SCRIPTS = [
    { file: 'structure-analyzer.js' },
    { file: 'module-mapper.js' },
    { file: 'report-manager.js' },
];
exports.ORCHESTRATOR_SCRIPTS = [
    { file: 'agent-call-manager.js' },
    { file: 'task-orchestrator.js' },
    { file: 'taskbook-manager.js' },
    { file: 'task-executor.js' },
    { file: 'contract-validator.js' },
    { file: 'reference-finder.js' },
    { file: 'context-collector.js' },
];
exports.FULL_SCRIPTS = [
    { file: 'agent-registry.js' },
];
exports.COMMANDS_TO_DISTRIBUTE = [
    { sourcePath: '.claude/commands/task.md', destFile: 'task.md' },
    { sourcePath: '.claude/commands/agent-call.md', destFile: 'agent-call.md' },
];
exports.WORKFLOWS_TO_DISTRIBUTE = [
    { sourcePath: 'workflows/schema/workflow.schema.json', destFile: 'workflow.schema.json' },
    { sourcePath: 'workflows/templates/default.workflow.json', destFile: 'default.workflow.json' },
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
