import { Context } from '../types';

export interface ScriptDistributionFile {
  file: string;
  dependencies?: string[];
}

export interface StaticDistributionFile {
  sourcePath: string;
  destFile: string;
}

const CLI_ENTRY_DEPENDENCIES = ['lib/cli-entry.js'];
const FRONTMATTER_DEPENDENCIES = ['lib/frontmatter-utils.js'];
const INSTALL_ROOTS_DEPENDENCIES = ['lib/install-roots.js', 'lib/install-sync.js'];
const MODULE_MAPPER_DEPENDENCIES = [...CLI_ENTRY_DEPENDENCIES, 'types/module-mapper.js'];
const STRUCTURE_ANALYZER_DEPENDENCIES = [...CLI_ENTRY_DEPENDENCIES, 'types/structure-analyzer.js'];
const WORKFLOW_ROUTING_DEPENDENCIES = [
  'lib/project-detection.js',
  'lib/workflow-routing.js',
  'lib/workflow-routing-selection.js',
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

export const CORE_SCRIPTS: ScriptDistributionFile[] = [
  { file: 'rule-validator.js' },
  { file: 'skill-validator.js', dependencies: FRONTMATTER_DEPENDENCIES },
];

export const ANALYSIS_SCRIPTS: ScriptDistributionFile[] = [
  { file: 'structure-analyzer.js', dependencies: STRUCTURE_ANALYZER_DEPENDENCIES },
  { file: 'module-mapper.js', dependencies: MODULE_MAPPER_DEPENDENCIES },
  { file: 'report-manager.js', dependencies: [...CLI_ENTRY_DEPENDENCIES, ...WORKFLOW_ROUTING_DEPENDENCIES] },
];

export const ORCHESTRATOR_SCRIPTS: ScriptDistributionFile[] = [
  { file: 'agent-call-manager.js', dependencies: CLI_ENTRY_DEPENDENCIES },
  { file: 'task-orchestrator.js', dependencies: [...CLI_ENTRY_DEPENDENCIES, ...WORKFLOW_ROUTING_DEPENDENCIES, 'lib/execution-metrics.js'] },
  { file: 'taskbook-manager.js', dependencies: INSTALL_ROOTS_DEPENDENCIES },
  { file: 'task-executor.js', dependencies: TASK_EXECUTOR_DEPENDENCIES },
  { file: 'contract-validator.js' },
  { file: 'reference-finder.js', dependencies: CLI_ENTRY_DEPENDENCIES },
  { file: 'context-collector.js', dependencies: CLI_ENTRY_DEPENDENCIES },
];

export const FULL_SCRIPTS: ScriptDistributionFile[] = [
  { file: 'agent-registry.js', dependencies: [...FRONTMATTER_DEPENDENCIES, ...INSTALL_ROOTS_DEPENDENCIES] },
];

export const COMMANDS_TO_DISTRIBUTE: StaticDistributionFile[] = [
  { sourcePath: '.claude/commands/task.md', destFile: 'task.md' },
  { sourcePath: '.claude/commands/agent-call.md', destFile: 'agent-call.md' },
];

export const WORKFLOWS_TO_DISTRIBUTE: StaticDistributionFile[] = [
  { sourcePath: 'workflows/schema/workflow.schema.json', destFile: 'workflow.schema.json' },
  { sourcePath: 'workflows/templates/default.workflow.json', destFile: 'default.workflow.json' },
  { sourcePath: 'workflows/templates/sprint.workflow.json', destFile: 'sprint.workflow.json' },
  { sourcePath: 'workflows/templates/micro.workflow.json', destFile: 'micro.workflow.json' },
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

export function getScriptArtifactsForProfile(profile: Context['profile']): string[] {
  const artifacts = new Set<string>();

  for (const script of getScriptsForProfile(profile)) {
    artifacts.add(script.file);
    for (const dependency of script.dependencies || []) {
      artifacts.add(dependency);
    }
  }

  return Array.from(artifacts).sort((left, right) => left.localeCompare(right));
}
