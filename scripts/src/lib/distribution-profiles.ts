import { Context } from '../types';

export interface ScriptDistributionFile {
  file: string;
  dependencies?: string[];
}

export interface StaticDistributionFile {
  sourcePath: string;
  destFile: string;
}

export const CORE_SCRIPTS: ScriptDistributionFile[] = [
  { file: 'rule-validator.js' },
  { file: 'skill-validator.js' },
];

export const ANALYSIS_SCRIPTS: ScriptDistributionFile[] = [
  { file: 'structure-analyzer.js' },
  { file: 'module-mapper.js' },
  { file: 'report-manager.js' },
];

export const ORCHESTRATOR_SCRIPTS: ScriptDistributionFile[] = [
  { file: 'agent-call-manager.js' },
  { file: 'task-orchestrator.js' },
  { file: 'taskbook-manager.js' },
  { file: 'task-executor.js' },
  { file: 'contract-validator.js' },
  { file: 'reference-finder.js' },
  { file: 'context-collector.js' },
];

export const FULL_SCRIPTS: ScriptDistributionFile[] = [
  { file: 'agent-registry.js' },
];

export const COMMANDS_TO_DISTRIBUTE: StaticDistributionFile[] = [
  { sourcePath: '.claude/commands/task.md', destFile: 'task.md' },
  { sourcePath: '.claude/commands/agent-call.md', destFile: 'agent-call.md' },
];

export const WORKFLOWS_TO_DISTRIBUTE: StaticDistributionFile[] = [
  { sourcePath: 'workflows/schema/workflow.schema.json', destFile: 'workflow.schema.json' },
  { sourcePath: 'workflows/templates/default.workflow.json', destFile: 'default.workflow.json' },
];

export const TASKBOOK_FILES_TO_DISTRIBUTE: StaticDistributionFile[] = [
  { sourcePath: 'taskbooks/schema/taskbook.schema.json', destFile: 'taskbook.schema.json' },
];

export const AGENT_CALL_FILES_TO_DISTRIBUTE: StaticDistributionFile[] = [
  { sourcePath: 'agent-calls/schema/agent-call.schema.json', destFile: 'agent-call.schema.json' },
];

export function isOrchestratorProfile(profile: Context['profile']): boolean {
  return profile === 'orchestrator' || profile === 'full';
}

export function getScriptsForProfile(profile: Context['profile']): ScriptDistributionFile[] {
  const scripts = [...CORE_SCRIPTS];

  if (profile !== 'core') {
    scripts.push(...ANALYSIS_SCRIPTS);
  }

  if (isOrchestratorProfile(profile)) {
    scripts.push(...ORCHESTRATOR_SCRIPTS);
  }

  if (profile === 'full') {
    scripts.push(...FULL_SCRIPTS);
  }

  return scripts;
}
