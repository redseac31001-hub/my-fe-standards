/**
 * Contract Validator (dependency-free)
 *
 * Validate CodeBuddy contracts in the target project:
 * - Workflow Spec JSON (under .codebuddy/workflows)
 * - TaskBook JSON (under .codebuddy/taskbooks)
 *
 * This validator is intentionally dependency-free (Node built-ins only) so it can run
 * inside any business project where .codebuddy/scripts are distributed.
 */

import * as fs from 'fs';
import * as path from 'path';

type IssueLevel = 'error' | 'warning';

type Issue = {
  level: IssueLevel;
  file: string;
  message: string;
};

type ValidationReport = {
  ok: boolean;
  totals: {
    files: {
      workflows: number;
      taskbooks: number;
      agentCalls: number;
    };
    errors: number;
    warnings: number;
  };
  issues: Issue[];
};

const TASKBOOK_STATUSES = new Set(['draft', 'confirmed', 'executing', 'completed', 'aborted']);
const TASKBOOK_TYPES = new Set(['new-feature', 'refactoring', 'debugging', 'testing', 'code-review']);
const TASKBOOK_TASK_TYPES = new Set(['requirement', 'prd', 'analysis', 'design', 'test', 'implement', 'refactor', 'review', 'build-fix', 'acceptance']);
const PLANNER_TASK_TYPES = new Set(['analysis', 'design', 'test', 'implement', 'review']);
const TASK_STATUSES = new Set(['pending', 'in_progress', 'done', 'blocked', 'skipped']);
const TASK_PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);
const TASK_AGENT_HINTS = new Set(['coder', 'tester', 'reviewer', 'refactor', 'doc-writer', 'planner']);
const BUILTIN_WORKFLOW_IDS = new Set(['micro', 'sprint', 'default']);
const TASK_SPEC_MODES = new Set(['inline-open-spec', 'linked-spec-kit']);
const CHANGE_TYPES = new Set(['added', 'modified', 'removed', 'reordered']);

const AGENT_CALL_STATUSES = new Set(['success', 'failed', 'blocked']);

const KNOWN_WORKFLOW_STEP_TYPES = new Set([
  'analyze_project',
  'create_taskbook',
  'requirement_and_prd',
  'tdd_implement',
  'build_and_fix',
  'implement_tasks',
  'run_tests',
  'code_review',
  'acceptance_and_archive',
]);

const KNOWN_WORKFLOW_GATE_TYPES = new Set(['checks', 'review']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function hasNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'string' && v.trim().length > 0);
}

function isValidDateTime(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function readJsonFile(filePath: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as unknown;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function listJsonFiles(dirPath: string, opts?: { exclude?: Set<string> }): string[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile())
      .map(e => e.name)
      .filter(name => name.endsWith('.json'))
      .filter(name => !(opts?.exclude?.has(name)))
      .map(name => path.join(dirPath, name));
  } catch {
    return [];
  }
}

function readTextFile(filePath: string): { ok: true; data: string } | { ok: false; error: string } {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return { ok: true, data: raw };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

type AgentCallPromptHeader = {
  requestId: string;
  agentId?: string;
  taskBookId?: string;
  taskBookRevision?: number;
  taskId?: string;
  taskType?: string;
  recommendedWorkflowId?: string;
  recommendedSpecMode?: string;
  timestamp?: string;
  promptPath?: string;
  resultPath?: string;
};

type AgentCallKind = 'planner' | 'manual-task' | 'unknown';

function parseFirstJsonCodeBlock(markdown: string): { ok: true; jsonText: string } | { ok: false; error: string } {
  const m = markdown.match(/```json\s*([\s\S]*?)\s*```/);
  if (!m) return { ok: false, error: 'Missing ```json ... ``` block in prompt.md' };
  return { ok: true, jsonText: m[1] };
}

function parseAgentCallPromptHeader(markdown: string): { ok: true; header: AgentCallPromptHeader } | { ok: false; error: string } {
  const block = parseFirstJsonCodeBlock(markdown);
  if (!block.ok) return block;

  try {
    const parsed = JSON.parse(block.jsonText) as unknown;
    if (!isPlainObject(parsed)) return { ok: false, error: 'prompt header JSON must be an object' };
    if (!isNonEmptyString(parsed.requestId)) return { ok: false, error: 'prompt header JSON missing requestId' };
    return { ok: true, header: parsed as AgentCallPromptHeader };
  } catch (error) {
    return { ok: false, error: `Invalid prompt header JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function inferAgentCallKind(markdown: string, header: AgentCallPromptHeader | null): AgentCallKind {
  const firstLine = markdown.split(/\r?\n/, 1)[0]?.trim() ?? '';
  if (firstLine === '# Agent Call: planner' || header?.agentId === 'planner') return 'planner';
  if (firstLine === '# Agent Call: manual-task' || isNonEmptyString(header?.taskId)) return 'manual-task';
  return 'unknown';
}

function parseAgentCallResultKind(data: unknown): AgentCallKind | null {
  if (!isPlainObject(data)) return null;
  const kind = data.kind;
  if (kind === 'planner' || kind === 'manual-task') return kind;
  return null;
}

function detectDependencyCycle(tasks: Array<{ id: string; dependencies: string[] }>): string[] {
  const graph = new Map<string, string[]>();
  for (const task of tasks) graph.set(task.id, task.dependencies);

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const trail: string[] = [];

  const dfs = (node: string): string[] => {
    if (visiting.has(node)) {
      const index = trail.indexOf(node);
      return index >= 0 ? [...trail.slice(index), node] : [node, node];
    }
    if (visited.has(node)) return [];

    visiting.add(node);
    trail.push(node);
    for (const dep of graph.get(node) ?? []) {
      const cycle = dfs(dep);
      if (cycle.length > 0) return cycle;
    }
    trail.pop();
    visiting.delete(node);
    visited.add(node);
    return [];
  };

  for (const node of graph.keys()) {
    const cycle = dfs(node);
    if (cycle.length > 0) return cycle;
  }
  return [];
}

function validateTaskScope(scope: unknown, file: string, basePath: string): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: 'error', file, message });
  if (!isPlainObject(scope)) {
    error(`${basePath} must be an object`);
    return issues;
  }
  for (const scopeKey of ['files', 'modules', 'tags'] as const) {
    const scopeValue = scope[scopeKey];
    if (typeof scopeValue !== 'undefined' && !isStringArray(scopeValue)) {
      error(`${basePath}.${scopeKey} must be an array of strings`);
    }
  }
  return issues;
}

function validateExecutionSpec(spec: unknown, file: string, basePath: string, opts?: { warnIfRecommended?: boolean }): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: 'error', file, message });
  const warn = (message: string) => issues.push({ level: 'warning', file, message });

  if (!isPlainObject(spec)) {
    error(`${basePath} must be an object`);
    return issues;
  }

  if (typeof spec.summary !== 'undefined' && !isNonEmptyString(spec.summary)) {
    error(`${basePath}.summary must be a non-empty string when provided`);
  }
  if (typeof spec.agentHint !== 'undefined' && (!isNonEmptyString(spec.agentHint) || !TASK_AGENT_HINTS.has(spec.agentHint))) {
    error(`${basePath}.agentHint must be one of: ${Array.from(TASK_AGENT_HINTS).join(', ')}`);
  }
  if (typeof spec.dependenciesNote !== 'undefined' && !isNonEmptyString(spec.dependenciesNote)) {
    error(`${basePath}.dependenciesNote must be a non-empty string when provided`);
  }
  if (typeof spec.specRef !== 'undefined' && !isNonEmptyString(spec.specRef)) {
    error(`${basePath}.specRef must be a non-empty string when provided`);
  }

  for (const listKey of ['deliverables', 'verification', 'constraints'] as const) {
    const listValue = spec[listKey];
    if (typeof listValue !== 'undefined' && !hasNonEmptyStringArray(listValue)) {
      error(`${basePath}.${listKey} must be a non-empty array of strings when provided`);
    }
  }

  if (opts?.warnIfRecommended === true) {
    if (typeof spec.deliverables === 'undefined') warn(`${basePath}.deliverables is recommended`);
    if (typeof spec.verification === 'undefined') warn(`${basePath}.verification is recommended`);
  }

  return issues;
}

function validateTaskBookPlan(plan: unknown, file: string, taskBookId?: string): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: 'error', file, message });
  const warn = (message: string) => issues.push({ level: 'warning', file, message });

  if (!isPlainObject(plan)) {
    error('plan must be an object');
    return issues;
  }

  if (!isNonEmptyString(plan.planId)) {
    error('plan.planId must be a non-empty string');
  } else if (isNonEmptyString(taskBookId) && plan.planId !== taskBookId) {
    error(`plan.planId must match taskbook id (${taskBookId})`);
  }

  if (typeof plan.version !== 'number' || !Number.isInteger(plan.version) || plan.version < 1) {
    error('plan.version must be an integer >= 1');
  }

  if (typeof plan.specMode !== 'undefined' && (!isNonEmptyString(plan.specMode) || !TASK_SPEC_MODES.has(plan.specMode))) {
    error(`plan.specMode must be one of: ${Array.from(TASK_SPEC_MODES).join(', ')}`);
  }
  if (typeof plan.recommendedWorkflowId !== 'undefined' && (!isNonEmptyString(plan.recommendedWorkflowId) || !BUILTIN_WORKFLOW_IDS.has(plan.recommendedWorkflowId))) {
    error(`plan.recommendedWorkflowId must be one of: ${Array.from(BUILTIN_WORKFLOW_IDS).join(', ')}`);
  }
  if (typeof plan.documentationTier !== 'undefined' && (!isNonEmptyString(plan.documentationTier) || !new Set(['minimal', 'standard', 'full']).has(plan.documentationTier))) {
    error('plan.documentationTier must be one of: minimal, standard, full');
  }
  if (typeof plan.summary !== 'undefined' && !isNonEmptyString(plan.summary)) {
    error('plan.summary must be a non-empty string when provided');
  } else if (typeof plan.summary === 'undefined') {
    warn('plan.summary is recommended');
  }
  if (typeof plan.specRef !== 'undefined' && !isNonEmptyString(plan.specRef)) {
    error('plan.specRef must be a non-empty string when provided');
  }
  if (typeof plan.linkedTaskBookRevision !== 'undefined') {
    const revision = plan.linkedTaskBookRevision;
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
      error('plan.linkedTaskBookRevision must be a non-negative integer when provided');
    }
  }
  if (typeof plan.source !== 'undefined' && (!isNonEmptyString(plan.source) || !new Set(['planner', 'manual', 'task-intake-routing']).has(plan.source))) {
    error('plan.source must be one of: planner, manual, task-intake-routing');
  }

  for (const key of ['goals', 'outOfScope', 'assumptions', 'constraints', 'clarifications', 'documentationArtifacts'] as const) {
    const value = plan[key];
    if (typeof value === 'undefined') continue;
    if (!isStringArray(value)) error(`plan.${key} must be an array of strings`);
  }

  if (typeof plan.risks !== 'undefined') {
    if (!Array.isArray(plan.risks)) {
      error('plan.risks must be an array');
    } else {
      for (const [index, rawRisk] of plan.risks.entries()) {
        if (!isPlainObject(rawRisk)) {
          error(`plan.risks[${index}] must be an object`);
          continue;
        }
        if (!isNonEmptyString(rawRisk.summary)) error(`plan.risks[${index}].summary must be a non-empty string`);
        if (!isNonEmptyString(rawRisk.level) || !new Set(['low', 'medium', 'high']).has(rawRisk.level)) {
          error(`plan.risks[${index}].level must be one of: low, medium, high`);
        }
        if (typeof rawRisk.mitigation !== 'undefined' && !isNonEmptyString(rawRisk.mitigation)) {
          error(`plan.risks[${index}].mitigation must be a non-empty string when provided`);
        }
      }
    }
  }

  if (typeof plan.epics !== 'undefined') {
    if (!Array.isArray(plan.epics)) {
      error('plan.epics must be an array');
    } else {
      for (const [index, rawEpic] of plan.epics.entries()) {
        if (!isPlainObject(rawEpic)) {
          error(`plan.epics[${index}] must be an object`);
          continue;
        }
        if (!isNonEmptyString(rawEpic.id)) error(`plan.epics[${index}].id must be a non-empty string`);
        if (!isNonEmptyString(rawEpic.title)) error(`plan.epics[${index}].title must be a non-empty string`);
        if (typeof rawEpic.summary !== 'undefined' && !isNonEmptyString(rawEpic.summary)) {
          error(`plan.epics[${index}].summary must be a non-empty string when provided`);
        }
      }
    }
  }

  return issues;
}

function validatePlannerAgentCallOutput(output: unknown, file: string, header?: AgentCallPromptHeader | null): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: 'error', file, message });
  const warn = (message: string) => issues.push({ level: 'warning', file, message });

  if (!isPlainObject(output)) {
    error('agent-call output must be an object for planner');
    return issues;
  }

  if (!isNonEmptyString(output.planId)) {
    error('planner output.planId must be a non-empty string');
  } else if (isNonEmptyString(header?.taskBookId) && output.planId !== header?.taskBookId) {
    error(`planner output.planId must equal prompt header taskBookId (${header?.taskBookId})`);
  }

  if (typeof output.summary !== 'undefined' && !isNonEmptyString(output.summary)) {
    error('planner output.summary must be a non-empty string when provided');
  } else if (typeof output.summary === 'undefined') {
    warn('planner output.summary is recommended');
  }

  if (typeof output.recommendedWorkflowId !== 'undefined') {
    if (!isNonEmptyString(output.recommendedWorkflowId) || !BUILTIN_WORKFLOW_IDS.has(output.recommendedWorkflowId)) {
      error(`planner output.recommendedWorkflowId must be one of: ${Array.from(BUILTIN_WORKFLOW_IDS).join(', ')}`);
    } else if (isNonEmptyString(header?.recommendedWorkflowId) && output.recommendedWorkflowId !== header.recommendedWorkflowId) {
      error(`planner output.recommendedWorkflowId must match prompt header recommendation (${header?.recommendedWorkflowId})`);
    }
  } else {
    warn('planner output.recommendedWorkflowId is recommended');
  }

  if (typeof output.specMode !== 'undefined') {
    if (!isNonEmptyString(output.specMode) || !TASK_SPEC_MODES.has(output.specMode)) {
      error(`planner output.specMode must be one of: ${Array.from(TASK_SPEC_MODES).join(', ')}`);
    } else if (isNonEmptyString(header?.recommendedSpecMode) && output.specMode !== header.recommendedSpecMode) {
      error(`planner output.specMode must match prompt header recommendation (${header?.recommendedSpecMode})`);
    }
  } else {
    warn('planner output.specMode is recommended');
  }

  for (const key of ['goals', 'outOfScope', 'assumptions', 'constraints', 'clarifications'] as const) {
    const value = output[key];
    if (typeof value === 'undefined') {
      warn(`planner output.${key} is recommended`);
      continue;
    }
    if (!isStringArray(value)) {
      error(`planner output.${key} must be an array of strings`);
    }
  }

  if (typeof output.risks === 'undefined') {
    warn('planner output.risks is recommended');
  } else if (!Array.isArray(output.risks)) {
    error('planner output.risks must be an array');
  } else {
    for (const [index, rawRisk] of output.risks.entries()) {
      if (!isPlainObject(rawRisk)) {
        error(`planner output.risks[${index}] must be an object`);
        continue;
      }
      if (!isNonEmptyString(rawRisk.summary)) {
        error(`planner output.risks[${index}].summary must be a non-empty string`);
      }
      if (typeof rawRisk.level !== 'undefined' && (!isNonEmptyString(rawRisk.level) || !['low', 'medium', 'high'].includes(rawRisk.level))) {
        error(`planner output.risks[${index}].level must be one of: low, medium, high`);
      }
      if (typeof rawRisk.mitigation !== 'undefined' && !isNonEmptyString(rawRisk.mitigation)) {
        error(`planner output.risks[${index}].mitigation must be a non-empty string when provided`);
      }
    }
  }

  if (typeof output.specRef !== 'undefined' && !isNonEmptyString(output.specRef)) {
    error('planner output.specRef must be a non-empty string when provided');
  }

  if (typeof output.epics !== 'undefined') {
    if (!Array.isArray(output.epics)) {
      error('planner output.epics must be an array');
    } else {
      for (const [index, rawEpic] of output.epics.entries()) {
        if (!isPlainObject(rawEpic)) {
          error(`planner output.epics[${index}] must be an object`);
          continue;
        }
        if (!isNonEmptyString(rawEpic.id)) error(`planner output.epics[${index}].id must be a non-empty string`);
        if (!isNonEmptyString(rawEpic.title)) error(`planner output.epics[${index}].title must be a non-empty string`);
        if (typeof rawEpic.summary !== 'undefined' && !isNonEmptyString(rawEpic.summary)) {
          error(`planner output.epics[${index}].summary must be a non-empty string when provided`);
        }
      }
    }
  }

  const tasks = output.tasks;
  if (!Array.isArray(tasks)) {
    error('planner output.tasks must be an array');
    return issues;
  }

  if (tasks.length === 0) {
    issues.push({ level: 'warning', file, message: 'planner output.tasks is empty' });
    return issues;
  }

  const seenPlanIds = new Set<string>();
  const parsedTasks: Array<{ id: string; dependencies: string[] }> = [];
  for (const [index, raw] of tasks.entries()) {
    if (!isPlainObject(raw)) {
      error(`planner output.tasks[${index}] must be an object`);
      continue;
    }

    const planId = raw.planId;
    const title = raw.title;
    const type = raw.type;
    const priority = raw.priority;

    if (!isNonEmptyString(planId)) {
      error(`planner output.tasks[${index}].planId must be a non-empty string`);
    } else {
      if (seenPlanIds.has(planId)) error(`Duplicate planner planId: ${planId}`);
      seenPlanIds.add(planId);
    }

    if (!isNonEmptyString(title)) error(`planner output.tasks[${index}].title must be a non-empty string`);

    if (!isNonEmptyString(type) || !PLANNER_TASK_TYPES.has(type)) {
      error(`planner output.tasks[${index}].type must be one of: ${Array.from(PLANNER_TASK_TYPES).join(', ')}`);
    }

    if (typeof priority !== 'undefined') {
      if (!isNonEmptyString(priority) || !TASK_PRIORITIES.has(priority)) {
        error(`planner output.tasks[${index}].priority must be one of: ${Array.from(TASK_PRIORITIES).join(', ')}`);
      }
    }

    if (typeof raw.dependencies !== 'undefined') {
      const deps = raw.dependencies;
      if (!isStringArray(deps)) {
        error(`planner output.tasks[${index}].dependencies must be an array of strings (when provided)`);
      } else {
        for (const dep of deps) {
          if (!seenPlanIds.has(dep)) {
            error(`planner output.tasks[${index}].dependencies references unknown/forward planId: ${dep}`);
          }
        }
      }
    }

    if (!hasNonEmptyStringArray(raw.acceptanceCriteria)) {
      error(`planner output.tasks[${index}].acceptanceCriteria must be a non-empty array of strings`);
    }

    if (typeof raw.scope !== 'undefined') issues.push(...validateTaskScope(raw.scope, file, `planner output.tasks[${index}].scope`));
    if (typeof raw.executionSpec !== 'undefined') {
      issues.push(...validateExecutionSpec(raw.executionSpec, file, `planner output.tasks[${index}].executionSpec`, { warnIfRecommended: true }));
    } else {
      warn(`planner output.tasks[${index}].executionSpec is recommended`);
    }

    parsedTasks.push({
      id: isNonEmptyString(planId) ? planId : `invalid-${index}`,
      dependencies: isStringArray(raw.dependencies) ? raw.dependencies : [],
    });
  }

  const cycle = detectDependencyCycle(parsedTasks);
  if (cycle.length > 0) error(`planner output.tasks contains a dependency cycle: ${cycle.join(' -> ')}`);

  return issues;
}

function validateManualTaskAgentCallOutput(output: unknown, file: string): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: 'error', file, message });

  if (!isPlainObject(output)) {
    error('agent-call output must be an object for manual-task');
    return issues;
  }

  if (!isNonEmptyString(output.actualWork)) {
    error('manual-task output.actualWork must be a non-empty string');
  }

  return issues;
}

function validateAgentCallResult(
  data: unknown,
  file: string,
  opts?: { requestIdFromFile?: string; promptHeader?: AgentCallPromptHeader | null; kind?: AgentCallKind }
): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: 'error', file, message });
  const warn = (message: string) => issues.push({ level: 'warning', file, message });

  if (!isPlainObject(data)) {
    error('agent-call result must be a JSON object');
    return issues;
  }

  const requestId = data.requestId;
  const status = data.status;

  if (!isNonEmptyString(requestId)) error('agent-call requestId must be a non-empty string');
  if (isNonEmptyString(opts?.requestIdFromFile) && requestId !== opts?.requestIdFromFile) {
    error(`agent-call requestId mismatch: file=${opts?.requestIdFromFile} json=${String(requestId)}`);
  }
  if (isNonEmptyString(opts?.promptHeader?.requestId) && requestId !== opts?.promptHeader?.requestId) {
    error(`agent-call requestId mismatch: prompt=${opts?.promptHeader?.requestId} json=${String(requestId)}`);
  }

  if (!isNonEmptyString(status) || !AGENT_CALL_STATUSES.has(status)) {
    error(`agent-call status must be one of: ${Array.from(AGENT_CALL_STATUSES).join(', ')}`);
  }

  const completedAt = (data as Record<string, unknown>).completedAt;
  if (typeof completedAt !== 'undefined' && !isValidDateTime(completedAt)) {
    error('agent-call completedAt must be an ISO date-time string (when provided)');
  }

  const output = (data as Record<string, unknown>).output;
  const err = (data as Record<string, unknown>).error;
  const artifacts = (data as Record<string, unknown>).artifacts;

  if (typeof artifacts !== 'undefined') {
    if (!Array.isArray(artifacts)) {
      warn('agent-call artifacts must be an array (when provided)');
    } else {
      for (const [index, a] of artifacts.entries()) {
        if (!isPlainObject(a)) {
          warn(`agent-call artifacts[${index}] must be an object`);
          continue;
        }
        if (!isNonEmptyString(a.type)) warn(`agent-call artifacts[${index}].type must be a non-empty string`);
        if (!isNonEmptyString(a.path)) warn(`agent-call artifacts[${index}].path must be a non-empty string`);
      }
    }
  }

  if (typeof err !== 'undefined') {
    if (!isPlainObject(err)) {
      warn('agent-call error must be an object (when provided)');
    } else {
      if (typeof err.message !== 'undefined' && typeof err.message !== 'string') {
        warn('agent-call error.message must be a string (when provided)');
      }
    }
  } else if (status !== 'success') {
    warn('agent-call error is recommended when status != success');
  }

  if (status === 'success') {
    if (typeof completedAt === 'undefined') warn('agent-call completedAt is recommended when status=success');
    const kind = opts?.kind ?? 'unknown';
    if (kind === 'planner') issues.push(...validatePlannerAgentCallOutput(output, file, opts?.promptHeader ?? null));
    else if (kind === 'manual-task') issues.push(...validateManualTaskAgentCallOutput(output, file));
  }

  return issues;
}

function validateTaskBook(data: unknown, file: string): Issue[] {
  const issues: Issue[] = [];

  const error = (message: string) => issues.push({ level: 'error', file, message });
  const warn = (message: string) => issues.push({ level: 'warning', file, message });

  if (!isPlainObject(data)) {
    error('TaskBook must be a JSON object');
    return issues;
  }

  const requiredTop = ['id', 'title', 'description', 'taskType', 'createdAt', 'status', 'context', 'tasks', 'changelog'];
  for (const k of requiredTop) {
    if (!(k in data)) error(`Missing required field: ${k}`);
  }

  if ('id' in data && !isNonEmptyString(data.id)) error('id must be a non-empty string');
  if ('title' in data && !isNonEmptyString(data.title)) error('title must be a non-empty string');
  if ('description' in data && typeof data.description !== 'string') error('description must be a string');

  if ('taskType' in data) {
    if (!isNonEmptyString(data.taskType) || !TASKBOOK_TYPES.has(data.taskType)) {
      error(`taskType must be one of: ${Array.from(TASKBOOK_TYPES).join(', ')}`);
    }
  }

  if ('status' in data) {
    if (!isNonEmptyString(data.status) || !TASKBOOK_STATUSES.has(data.status)) {
      error(`status must be one of: ${Array.from(TASKBOOK_STATUSES).join(', ')}`);
    }
  }

  if ('createdAt' in data && !isValidDateTime(data.createdAt)) {
    error('createdAt must be an ISO date-time string');
  }

  if ('updatedAt' in data && typeof data.updatedAt !== 'undefined' && !isValidDateTime(data.updatedAt)) {
    error('updatedAt must be an ISO date-time string (when provided)');
  }

  if ('revision' in data && typeof data.revision !== 'undefined') {
    const n = data.revision;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
      error('revision must be a non-negative integer (when provided)');
    }
  }

  if ('confirmedAt' in data && typeof data.confirmedAt !== 'undefined' && !isValidDateTime(data.confirmedAt)) {
    error('confirmedAt must be an ISO date-time string (when provided)');
  }

  if ('completedAt' in data && typeof data.completedAt !== 'undefined' && !isValidDateTime(data.completedAt)) {
    error('completedAt must be an ISO date-time string (when provided)');
  }

  if ('context' in data) {
    if (!isPlainObject(data.context)) {
      error('context must be an object');
    } else {
      if (!('relatedFiles' in data.context) || !isStringArray(data.context.relatedFiles)) {
        error('context.relatedFiles must be an array of strings');
      }
      if (!('dependencies' in data.context) || !isStringArray(data.context.dependencies)) {
        error('context.dependencies must be an array of strings');
      }
      if ('architectureNotes' in data.context && typeof data.context.architectureNotes !== 'undefined' && typeof data.context.architectureNotes !== 'string') {
        error('context.architectureNotes must be a string (when provided)');
      }
      if ('projectHealth' in data.context && typeof data.context.projectHealth !== 'undefined') {
        const ph = data.context.projectHealth;
        if (!isPlainObject(ph)) {
          error('context.projectHealth must be an object (when provided)');
        } else {
          if (typeof ph.score !== 'number') error('context.projectHealth.score must be a number');
          if (!isStringArray(ph.issues)) error('context.projectHealth.issues must be an array of strings');
        }
      }
    }
  }

  if ('plan' in data && typeof data.plan !== 'undefined') {
    issues.push(...validateTaskBookPlan(data.plan, file, isNonEmptyString(data.id) ? data.id : undefined));
  }

  const taskIdSet = new Set<string>();
  const parsedTasks: Array<{ id: string; dependencies: string[] }> = [];

  if ('tasks' in data) {
    if (!Array.isArray(data.tasks)) {
      error('tasks must be an array');
    } else {
      for (const [index, t] of data.tasks.entries()) {
        if (!isPlainObject(t)) {
          error(`tasks[${index}] must be an object`);
          continue;
        }

        const requiredTask = ['id', 'title', 'type', 'status', 'priority', 'dependencies', 'acceptanceCriteria'];
        for (const k of requiredTask) {
          if (!(k in t)) error(`tasks[${index}] missing required field: ${k}`);
        }

        if (!isNonEmptyString(t.id)) error(`tasks[${index}].id must be a non-empty string`);
        if (isNonEmptyString(t.id)) {
          if (taskIdSet.has(t.id)) error(`Duplicate task id: ${t.id}`);
          taskIdSet.add(t.id);
        }

        if (!isNonEmptyString(t.title)) error(`tasks[${index}].title must be a non-empty string`);

        if (!isNonEmptyString(t.type) || !TASKBOOK_TASK_TYPES.has(t.type)) {
          error(`tasks[${index}].type must be one of: ${Array.from(TASKBOOK_TASK_TYPES).join(', ')}`);
        }

        if (!isNonEmptyString(t.status) || !TASK_STATUSES.has(t.status)) {
          error(`tasks[${index}].status must be one of: ${Array.from(TASK_STATUSES).join(', ')}`);
        }

        if (!isNonEmptyString(t.priority) || !TASK_PRIORITIES.has(t.priority)) {
          error(`tasks[${index}].priority must be one of: ${Array.from(TASK_PRIORITIES).join(', ')}`);
        }

        if (!isStringArray(t.dependencies)) error(`tasks[${index}].dependencies must be an array of strings`);
        if (!hasNonEmptyStringArray(t.acceptanceCriteria)) error(`tasks[${index}].acceptanceCriteria must be a non-empty array of strings`);

        if ('scope' in t && typeof t.scope !== 'undefined') issues.push(...validateTaskScope(t.scope, file, `tasks[${index}].scope`));
        if ('executionSpec' in t && typeof t.executionSpec !== 'undefined') {
          issues.push(...validateExecutionSpec(t.executionSpec, file, `tasks[${index}].executionSpec`));
        }

        if ('executedBy' in t && typeof t.executedBy !== 'undefined' && typeof t.executedBy !== 'string') {
          error(`tasks[${index}].executedBy must be a string (when provided)`);
        }
        if ('actualWork' in t && typeof t.actualWork !== 'undefined' && typeof t.actualWork !== 'string') {
          error(`tasks[${index}].actualWork must be a string (when provided)`);
        }
        if ('blockedReason' in t && typeof t.blockedReason !== 'undefined' && typeof t.blockedReason !== 'string') {
          error(`tasks[${index}].blockedReason must be a string (when provided)`);
        }
        if ('startedAt' in t && typeof t.startedAt !== 'undefined' && !isValidDateTime(t.startedAt)) {
          error(`tasks[${index}].startedAt must be an ISO date-time string (when provided)`);
        }
        if ('completedAt' in t && typeof t.completedAt !== 'undefined' && !isValidDateTime(t.completedAt)) {
          error(`tasks[${index}].completedAt must be an ISO date-time string (when provided)`);
        }
        if ('handoffs' in t && typeof t.handoffs !== 'undefined') {
          if (!Array.isArray(t.handoffs)) {
            error(`tasks[${index}].handoffs must be an array (when provided)`);
          } else {
            for (const [handoffIndex, handoff] of t.handoffs.entries()) {
              if (!isPlainObject(handoff)) {
                error(`tasks[${index}].handoffs[${handoffIndex}] must be an object`);
                continue;
              }

              if (!isNonEmptyString(handoff.from)) {
                error(`tasks[${index}].handoffs[${handoffIndex}].from must be a non-empty string`);
              }
              if (!isNonEmptyString(handoff.to)) {
                error(`tasks[${index}].handoffs[${handoffIndex}].to must be a non-empty string`);
              }
              if (!isNonEmptyString(handoff.type) || !new Set(['standard', 'qa_pass', 'qa_fail', 'escalation']).has(handoff.type)) {
                error(`tasks[${index}].handoffs[${handoffIndex}].type must be one of: standard, qa_pass, qa_fail, escalation`);
              }
              if (!isValidDateTime(handoff.timestamp)) {
                error(`tasks[${index}].handoffs[${handoffIndex}].timestamp must be an ISO date-time string`);
              }
              if ('context' in handoff && typeof handoff.context !== 'undefined' && typeof handoff.context !== 'string') {
                error(`tasks[${index}].handoffs[${handoffIndex}].context must be a string (when provided)`);
              }
              if ('deliverables' in handoff && typeof handoff.deliverables !== 'undefined' && !isStringArray(handoff.deliverables)) {
                error(`tasks[${index}].handoffs[${handoffIndex}].deliverables must be an array of strings (when provided)`);
              }
            }
          }
        }

        parsedTasks.push({
          id: isNonEmptyString(t.id) ? t.id : `invalid-${index}`,
          dependencies: isStringArray(t.dependencies) ? t.dependencies : [],
        });
      }

      // dependency check
      for (const [index, t] of data.tasks.entries()) {
        if (!isPlainObject(t)) continue;
        if (!isNonEmptyString(t.id)) continue;
        if (!isStringArray(t.dependencies)) continue;
        for (const dep of t.dependencies) {
          if (!taskIdSet.has(dep)) {
            error(`tasks[${index}].dependencies contains unknown task id: ${dep}`);
          }
        }
      }

      const cycle = detectDependencyCycle(parsedTasks);
      if (cycle.length > 0) {
        error(`tasks contains a dependency cycle: ${cycle.join(' -> ')}`);
      }
    }
  }

  if ('changelog' in data) {
    if (!Array.isArray(data.changelog)) {
      error('changelog must be an array');
    } else {
      for (const [index, c] of data.changelog.entries()) {
        if (!isPlainObject(c)) {
          error(`changelog[${index}] must be an object`);
          continue;
        }

        const requiredChange = ['timestamp', 'taskId', 'changeType', 'reason'];
        for (const k of requiredChange) {
          if (!(k in c)) error(`changelog[${index}] missing required field: ${k}`);
        }

        if (!isValidDateTime(c.timestamp)) error(`changelog[${index}].timestamp must be an ISO date-time string`);
        if (typeof c.taskId !== 'string' && c.taskId !== null) error(`changelog[${index}].taskId must be string|null`);
        if (!isNonEmptyString(c.changeType) || !CHANGE_TYPES.has(c.changeType)) {
          error(`changelog[${index}].changeType must be one of: ${Array.from(CHANGE_TYPES).join(', ')}`);
        }
        if (typeof c.reason !== 'string') error(`changelog[${index}].reason must be a string`);
      }
    }
  }

  // soft checks
  if (data.status === 'confirmed' && !('confirmedAt' in data)) warn('status is confirmed but confirmedAt is missing');
  if ((data.status === 'completed' || data.status === 'aborted') && !('completedAt' in data)) warn('status is completed/aborted but completedAt is missing');

  return issues;
}

function validateWorkflowSpec(data: unknown, file: string, opts?: { strict?: boolean }): Issue[] {
  const issues: Issue[] = [];

  const error = (message: string) => issues.push({ level: 'error', file, message });
  const warn = (message: string) => issues.push({ level: 'warning', file, message });

  const strict = opts?.strict === true;

  if (!isPlainObject(data)) {
    error('Workflow spec must be a JSON object');
    return issues;
  }

  if (!('id' in data) || !isNonEmptyString(data.id)) error('id must be a non-empty string');
  if (!('version' in data) || !isNonEmptyString(data.version)) error('version must be a non-empty string');

  if (!('steps' in data) || !Array.isArray(data.steps)) {
    error('steps must be an array');
    return issues;
  }

  const stepIds = new Set<string>();
  for (const [index, s] of data.steps.entries()) {
    if (!isPlainObject(s)) {
      error(`steps[${index}] must be an object`);
      continue;
    }

    if (!isNonEmptyString(s.id)) error(`steps[${index}].id must be a non-empty string`);
    if (isNonEmptyString(s.id)) {
      if (stepIds.has(s.id)) error(`Duplicate step id: ${s.id}`);
      stepIds.add(s.id);
    }

    if (!isNonEmptyString(s.type)) error(`steps[${index}].type must be a non-empty string`);
    if (isNonEmptyString(s.type) && strict && !KNOWN_WORKFLOW_STEP_TYPES.has(s.type)) {
      error(`steps[${index}].type is unknown: ${s.type}`);
    } else if (isNonEmptyString(s.type) && !KNOWN_WORKFLOW_STEP_TYPES.has(s.type)) {
      warn(`steps[${index}].type is not recognized by default executor: ${s.type}`);
    }

    if (!isNonEmptyString(s.title)) error(`steps[${index}].title must be a non-empty string`);

    if ('gates' in s && typeof s.gates !== 'undefined') {
      if (!isStringArray(s.gates)) error(`steps[${index}].gates must be an array of strings (when provided)`);
    }
  }

  const gateIds = new Set<string>();
  if ('gates' in data && typeof data.gates !== 'undefined') {
    if (!Array.isArray(data.gates)) {
      error('gates must be an array (when provided)');
    } else {
      for (const [index, g] of data.gates.entries()) {
        if (!isPlainObject(g)) {
          error(`gates[${index}] must be an object`);
          continue;
        }

        if (!isNonEmptyString(g.id)) error(`gates[${index}].id must be a non-empty string`);
        if (isNonEmptyString(g.id)) {
          if (gateIds.has(g.id)) error(`Duplicate gate id: ${g.id}`);
          gateIds.add(g.id);
        }

        if (!isNonEmptyString(g.type)) error(`gates[${index}].type must be a non-empty string`);
        if (isNonEmptyString(g.type) && strict && !KNOWN_WORKFLOW_GATE_TYPES.has(g.type)) {
          error(`gates[${index}].type is unknown: ${g.type}`);
        }

        if (!isNonEmptyString(g.title)) warn(`gates[${index}].title is recommended`);

        if (g.type === 'checks') {
          const params = (g.params ?? null) as unknown;
          if (!isPlainObject(params)) {
            error(`gates[${index}].params must be an object for checks gate`);
          } else {
            const commands = (params as any).commands;
            const npmScripts = (params as any).npmScripts;
            const commandsOk = Array.isArray(commands) && commands.every(c => typeof c === 'string' && c.trim().length > 0);
            const npmScriptsOk = Array.isArray(npmScripts) && npmScripts.every(s => typeof s === 'string' && s.trim().length > 0);
            if (!commandsOk && !npmScriptsOk) {
              error(`gates[${index}].params must define non-empty commands[] or npmScripts[] for checks gate`);
            }
          }
        }
      }
    }
  }

  // step.gates references
  for (const [index, s] of data.steps.entries()) {
    if (!isPlainObject(s)) continue;
    if (!('gates' in s) || typeof s.gates === 'undefined') continue;
    if (!isStringArray(s.gates)) continue;
    for (const gid of s.gates) {
      if (!gateIds.has(gid)) {
        error(`steps[${index}].gates references unknown gate: ${gid}`);
      }
    }
  }

  if ('edges' in data && typeof data.edges !== 'undefined') {
    if (!Array.isArray(data.edges)) {
      error('edges must be an array (when provided)');
    } else {
      for (const [index, e] of data.edges.entries()) {
        if (!isPlainObject(e)) {
          error(`edges[${index}] must be an object`);
          continue;
        }

        const from = e.from;
        const to = e.to;
        if (!isNonEmptyString(from) || !isNonEmptyString(to)) {
          error(`edges[${index}] must have non-empty from/to`);
          continue;
        }
        if (!stepIds.has(from)) error(`edges[${index}].from references unknown step: ${from}`);
        if (!stepIds.has(to)) error(`edges[${index}].to references unknown step: ${to}`);
      }
    }
  }

  return issues;
}

type ParsedArgs = {
  validateWorkflows: boolean;
  validateTaskbooks: boolean;
  validateAgentCalls: boolean;
  workflowPaths: string[];
  taskBookIds: string[];
  agentCallRequestIds: string[];
  strict: boolean;
  checkBatchingScope: boolean;
  strictBatchingScope: boolean;
  checkArchitectureConstraints: boolean;
  json: boolean;
  quiet: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    validateWorkflows: false,
    validateTaskbooks: false,
    validateAgentCalls: false,
    workflowPaths: [],
    taskBookIds: [],
    agentCallRequestIds: [],
    strict: false,
    checkBatchingScope: false,
    strictBatchingScope: false,
    checkArchitectureConstraints: false,
    json: false,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--workflows') parsed.validateWorkflows = true;
    else if (a === '--taskbooks') parsed.validateTaskbooks = true;
    else if (a === '--agent-calls') parsed.validateAgentCalls = true;
    else if (a === '--workflow') parsed.workflowPaths.push(String(argv[++i] ?? ''));
    else if (a === '--taskbook') parsed.taskBookIds.push(String(argv[++i] ?? ''));
    else if (a === '--agent-call') parsed.agentCallRequestIds.push(String(argv[++i] ?? ''));
    else if (a === '--strict') parsed.strict = true;
    else if (a === '--check-batching-scope') parsed.checkBatchingScope = true;
    else if (a === '--strict-batching-scope') parsed.strictBatchingScope = true;
    else if (a === '--check-architecture-constraints') parsed.checkArchitectureConstraints = true;
    else if (a === '--json') parsed.json = true;
    else if (a === '--quiet') parsed.quiet = true;
    else if (a === '--help' || a === '-h') {
      // handled by caller
    } else {
      // ignore unknown flags for forward compatibility
    }
  }

  // default: validate both
  if (
    !parsed.validateWorkflows &&
    !parsed.validateTaskbooks &&
    !parsed.validateAgentCalls &&
    parsed.workflowPaths.length === 0 &&
    parsed.taskBookIds.length === 0 &&
    parsed.agentCallRequestIds.length === 0
  ) {
    parsed.validateWorkflows = true;
    parsed.validateTaskbooks = true;
  }

  parsed.workflowPaths = parsed.workflowPaths.filter(Boolean);
  parsed.taskBookIds = parsed.taskBookIds.filter(Boolean);
  parsed.agentCallRequestIds = parsed.agentCallRequestIds.filter(Boolean);

  if (parsed.strictBatchingScope) parsed.checkBatchingScope = true;

  return parsed;
}

function showHelp(): void {
  console.log(`
Contract Validator (CodeBuddy)

Usage:
  node .codebuddy/scripts/contract-validator.js [options]

Options:
  --workflows                 validate workflows under .codebuddy/workflows
  --workflow <path>           validate a specific workflow JSON file
  --taskbooks                 validate TaskBooks under .codebuddy/taskbooks/active
  --taskbook <id>             validate a specific TaskBook id (active/history)
  --agent-calls               validate agent-call results under .codebuddy/agent-calls
  --agent-call <requestId>    validate a specific agent-call requestId
  --strict                    treat unknown workflow step/gate types as errors
  --check-batching-scope      warn when batching is enabled but tasks lack scope.files/modules
  --strict-batching-scope     error when batching is enabled but tasks lack scope.files/modules
  --check-architecture-constraints
                              warn when workflow / agent-call files drift from the documented stable contract
  --json                      output machine-readable JSON
  --quiet                     only output errors (text mode)
`);
}

function workflowHasRiskTieredBatching(data: unknown): boolean {
  if (!isPlainObject(data)) return false;
  const policies = data.policies;
  if (!isPlainObject(policies)) return false;
  const testing = policies.testing;
  if (!isPlainObject(testing)) return false;
  const batching = testing.batching;
  if (!isPlainObject(batching)) return false;
  return batching.strategy === 'risk_tiered';
}

function batchingScopeIssues(
  taskBookData: unknown,
  file: string,
  opts: { strict: boolean }
): Issue[] {
  const issues: Issue[] = [];
  const level: IssueLevel = opts.strict ? 'error' : 'warning';

  if (!isPlainObject(taskBookData)) return issues;
  const tasks = taskBookData.tasks;
  if (!Array.isArray(tasks)) return issues;

  const missing: Array<{ id: string; title: string; type: string; status: string }> = [];

  for (const t of tasks) {
    if (!isPlainObject(t)) continue;
    const type = typeof t.type === 'string' ? t.type : '';
    const status = typeof t.status === 'string' ? t.status : '';
    if (type !== 'analysis' && type !== 'design' && type !== 'implement') continue;
    if (status !== 'pending') continue;

    const id = typeof t.id === 'string' ? t.id : '<unknown>';
    const title = typeof t.title === 'string' ? t.title : '';

    const scope = t.scope;
    if (!isPlainObject(scope)) {
      missing.push({ id, title, type, status });
      continue;
    }

    const files = Array.isArray(scope.files) ? scope.files.filter(v => typeof v === 'string' && v.trim().length > 0) : [];
    const modules = Array.isArray(scope.modules) ? scope.modules.filter(v => typeof v === 'string' && v.trim().length > 0) : [];
    if (files.length === 0 && modules.length === 0) {
      missing.push({ id, title, type, status });
    }
  }

  if (missing.length > 0) {
    const examples = missing
      .slice(0, 5)
      .map(t => `${t.id}:${t.title || t.type}`)
      .join(', ');
    const more = missing.length > 5 ? ` (+${missing.length - 5} more)` : '';
    issues.push({
      level,
      file,
      message: `Batching scope check: ${missing.length} pending tasks (analysis/design/implement) lack scope.files/modules. Examples: ${examples}${more}. Consider adding tasks with --files/--modules.`,
    });
  }

  return issues;
}

function toPosixRelative(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function validateArchitectureConstraintsForWorkflow(data: unknown, file: string): Issue[] {
  const issues: Issue[] = [];
  if (!isPlainObject(data)) return issues;

  const workflowId = typeof data.id === 'string' ? data.id : '';
  const fileName = path.basename(file);
  const isDefaultWorkflow = workflowId === 'default' || fileName === 'default.workflow.json';
  if (!isDefaultWorkflow) return issues;

  const steps = Array.isArray(data.steps) ? data.steps : [];
  if (steps.length > 7) {
    issues.push({
      level: 'warning',
      file,
      message: `Architecture constraints: default workflow has ${steps.length} steps; documented stable baseline is 7. Prefer opt-in workflow variants over increasing default operator burden.`,
    });
  }

  const stepTypes = new Set(
    steps
      .filter(isPlainObject)
      .map(step => typeof step.type === 'string' ? step.type : '')
      .filter(Boolean)
  );
  const expectedStepTypes = [
    'requirement_and_prd',
    'analyze_project',
    'create_taskbook',
    'tdd_implement',
    'code_review',
    'build_and_fix',
    'acceptance_and_archive',
  ];
  const missing = expectedStepTypes.filter(type => !stepTypes.has(type));
  if (missing.length > 0) {
    issues.push({
      level: 'warning',
      file,
      message: `Architecture constraints: default workflow is missing expected stable step types: ${missing.join(', ')}. If this is intentional, treat it as an architecture-level change rather than a routine edit.`,
    });
  }

  return issues;
}

function validateArchitectureConstraintsForAgentCall(
  requestId: string,
  promptFile: string | null,
  resultFile: string | null,
  promptHeader: AgentCallPromptHeader | null
): Issue[] {
  const issues: Issue[] = [];
  if (!promptHeader) return issues;

  const expectedPromptPath = `.codebuddy/agent-calls/${requestId}.prompt.md`;
  const expectedResultPath = `.codebuddy/agent-calls/${requestId}.result.json`;

  if (isNonEmptyString(promptHeader.promptPath) && toPosixRelative(promptHeader.promptPath) !== expectedPromptPath) {
    issues.push({
      level: 'warning',
      file: promptFile ?? resultFile ?? requestId,
      message: `Architecture constraints: prompt header promptPath=${promptHeader.promptPath} differs from stable contract ${expectedPromptPath}.`,
    });
  }

  if (isNonEmptyString(promptHeader.resultPath) && toPosixRelative(promptHeader.resultPath) !== expectedResultPath) {
    issues.push({
      level: 'warning',
      file: promptFile ?? resultFile ?? requestId,
      message: `Architecture constraints: prompt header resultPath=${promptHeader.resultPath} differs from stable contract ${expectedResultPath}.`,
    });
  }

  const promptRelative = promptFile ? toPosixRelative(path.relative(process.cwd(), promptFile)) : null;
  if (promptRelative && promptRelative !== expectedPromptPath) {
    issues.push({
      level: 'warning',
      file: promptFile ?? requestId,
      message: `Architecture constraints: prompt file location ${promptRelative} differs from stable contract ${expectedPromptPath}.`,
    });
  }

  const resultRelative = resultFile ? toPosixRelative(path.relative(process.cwd(), resultFile)) : null;
  if (resultRelative && resultRelative !== expectedResultPath) {
    issues.push({
      level: 'warning',
      file: resultFile ?? requestId,
      message: `Architecture constraints: result file location ${resultRelative} differs from stable contract ${expectedResultPath}.`,
    });
  }

  return issues;
}

export function runContractValidation(argv: string[], cwd: string = process.cwd()): ValidationReport {
  const originalCwd = process.cwd();
  if (originalCwd !== cwd) {
    process.chdir(cwd);
  }

  try {
    const args = parseArgs(argv);
    const issues: Issue[] = [];

    // workflows
    const workflowFiles: string[] = [];
    if (args.workflowPaths.length > 0) {
      for (const p of args.workflowPaths) workflowFiles.push(path.resolve(process.cwd(), p));
    } else if (args.validateWorkflows) {
      const dir = path.join(process.cwd(), '.codebuddy', 'workflows');
      workflowFiles.push(...listJsonFiles(dir, { exclude: new Set(['workflow.schema.json']) }));
    }

    // If batching-scope checks are enabled, we need workflow policies even when --workflows wasn't requested.
    if (args.checkBatchingScope && workflowFiles.length === 0) {
      const dir = path.join(process.cwd(), '.codebuddy', 'workflows');
      workflowFiles.push(...listJsonFiles(dir, { exclude: new Set(['workflow.schema.json']) }));
    }

    const workflowData: Array<{ file: string; data: unknown }> = [];
    for (const f of workflowFiles) {
      const r = readJsonFile(f);
      if (!r.ok) {
        issues.push({ level: 'error', file: f, message: `Failed to read/parse JSON: ${r.error}` });
        continue;
      }
      workflowData.push({ file: f, data: r.data });
      issues.push(...validateWorkflowSpec(r.data, f, { strict: args.strict }));
      if (args.checkArchitectureConstraints) {
        issues.push(...validateArchitectureConstraintsForWorkflow(r.data, f));
      }
    }

    // taskbooks
    const taskBookFiles: string[] = [];
    if (args.taskBookIds.length > 0) {
      for (const id of args.taskBookIds) {
        const active = path.join(process.cwd(), '.codebuddy', 'taskbooks', 'active', `${id}.json`);
        const history = path.join(process.cwd(), '.codebuddy', 'taskbooks', 'history', `${id}.json`);
        if (fs.existsSync(active)) taskBookFiles.push(active);
        else if (fs.existsSync(history)) taskBookFiles.push(history);
        else issues.push({ level: 'error', file: id, message: 'TaskBook not found in active/history' });
      }
    } else if (args.validateTaskbooks) {
      const dir = path.join(process.cwd(), '.codebuddy', 'taskbooks', 'active');
      taskBookFiles.push(...listJsonFiles(dir));
    }

    if (args.checkBatchingScope && taskBookFiles.length === 0 && args.taskBookIds.length === 0) {
      const dir = path.join(process.cwd(), '.codebuddy', 'taskbooks', 'active');
      taskBookFiles.push(...listJsonFiles(dir));
    }

    const taskBookData: Array<{ file: string; data: unknown }> = [];
    for (const f of taskBookFiles) {
      const r = readJsonFile(f);
      if (!r.ok) {
        issues.push({ level: 'error', file: f, message: `Failed to read/parse JSON: ${r.error}` });
        continue;
      }
      taskBookData.push({ file: f, data: r.data });
      issues.push(...validateTaskBook(r.data, f));
    }

    if (args.checkBatchingScope) {
      const batchingEnabled = workflowData.some(w => workflowHasRiskTieredBatching(w.data));
      if (batchingEnabled) {
        for (const tb of taskBookData) {
          issues.push(...batchingScopeIssues(tb.data, tb.file, { strict: args.strictBatchingScope }));
        }
      }
    }

    // agent-calls
    const agentCallsDir = path.join(process.cwd(), '.codebuddy', 'agent-calls');
    const agentCallItems: Array<{ requestId: string; promptFile: string | null; resultFile: string | null }> = [];

    if (args.agentCallRequestIds.length > 0) {
      for (const id of args.agentCallRequestIds) {
        const promptFile = path.join(agentCallsDir, `${id}.prompt.md`);
        const resultFile = path.join(agentCallsDir, `${id}.result.json`);
        if (!fs.existsSync(resultFile)) {
          issues.push({ level: 'error', file: id, message: 'agent-call result.json not found under .codebuddy/agent-calls' });
          continue;
        }
        agentCallItems.push({
          requestId: id,
          promptFile: fs.existsSync(promptFile) ? promptFile : null,
          resultFile,
        });
      }
    } else if (args.validateAgentCalls) {
      if (fs.existsSync(agentCallsDir)) {
        const entries = fs.readdirSync(agentCallsDir, { withFileTypes: true });
        const requestIds = new Map<string, { promptFile: string | null; resultFile: string | null }>();
        for (const e of entries) {
          if (!e.isFile()) continue;
          const m = e.name.match(/^(.*)\.(prompt\.md|result\.json)$/);
          if (!m) continue;
          const requestId = m[1];
          const kind = m[2];
          const existing = requestIds.get(requestId) ?? { promptFile: null, resultFile: null };
          const absPath = path.join(agentCallsDir, e.name);
          if (kind === 'prompt.md') existing.promptFile = absPath;
          if (kind === 'result.json') existing.resultFile = absPath;
          requestIds.set(requestId, existing);
        }

        for (const [requestId, files] of Array.from(requestIds.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
          agentCallItems.push({ requestId, promptFile: files.promptFile, resultFile: files.resultFile });
        }
      }
    }

    for (const it of agentCallItems) {
      if (it.promptFile && !it.resultFile) {
        issues.push({
          level: 'warning',
          file: it.promptFile,
          message: `agent-call result.json missing (requestId=${it.requestId})`,
        });
        continue;
      }
      if (it.resultFile && !it.promptFile) {
        issues.push({
          level: 'warning',
          file: it.resultFile,
          message: `agent-call prompt.md missing (requestId=${it.requestId})`,
        });
      }
      if (!it.resultFile) continue;

      const prompt = it.promptFile ? readTextFile(it.promptFile) : null;
      const promptHeader = prompt && prompt.ok ? parseAgentCallPromptHeader(prompt.data) : null;

      if (prompt && !prompt.ok) {
        issues.push({ level: 'warning', file: it.promptFile ?? it.resultFile, message: `Failed to read prompt.md: ${prompt.error}` });
      }
      if (prompt && prompt.ok && promptHeader && !promptHeader.ok) {
        issues.push({ level: 'warning', file: it.promptFile ?? it.resultFile, message: `Invalid prompt.md header: ${promptHeader.error}` });
      }

      const r = readJsonFile(it.resultFile);
      if (!r.ok) {
        issues.push({ level: 'error', file: it.resultFile, message: `Failed to read/parse JSON: ${r.error}` });
        continue;
      }

      const kindFromPrompt = prompt && prompt.ok ? inferAgentCallKind(prompt.data, promptHeader && promptHeader.ok ? promptHeader.header : null) : 'unknown';
      const kindFromResult = parseAgentCallResultKind(r.data);

      if (kindFromPrompt !== 'unknown' && kindFromResult && kindFromPrompt !== kindFromResult) {
        issues.push({
          level: 'error',
          file: it.resultFile,
          message: `agent-call kind mismatch: prompt=${kindFromPrompt} result=${kindFromResult}`,
        });
      }

      if (isPlainObject(r.data) && typeof r.data.kind !== 'undefined' && !kindFromResult) {
        issues.push({
          level: 'warning',
          file: it.resultFile,
          message: `agent-call kind is present but not recognized: ${String(r.data.kind)}`,
        });
      }

      const kind: AgentCallKind = kindFromPrompt !== 'unknown' ? kindFromPrompt : (kindFromResult ?? 'unknown');

      issues.push(...validateAgentCallResult(r.data, it.resultFile, {
        requestIdFromFile: it.requestId,
        promptHeader: promptHeader && promptHeader.ok ? promptHeader.header : null,
        kind,
      }));

      if (args.checkArchitectureConstraints) {
        issues.push(...validateArchitectureConstraintsForAgentCall(
          it.requestId,
          it.promptFile,
          it.resultFile,
          promptHeader && promptHeader.ok ? promptHeader.header : null,
        ));
      }
    }

    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');

    return {
      ok: errors.length === 0,
      totals: {
        files: { workflows: workflowFiles.length, taskbooks: taskBookFiles.length, agentCalls: agentCallItems.length },
        errors: errors.length,
        warnings: warnings.length,
      },
      issues,
    };
  } finally {
    if (process.cwd() !== originalCwd) {
      process.chdir(originalCwd);
    }
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const args = parseArgs(argv);
  const report = runContractValidation(argv, process.cwd());

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (report.ok) {
      if (!args.quiet) {
        const agentCallsPart = args.validateAgentCalls || args.agentCallRequestIds.length > 0 ? ` agentcalls=${report.totals.files.agentCalls}` : '';
        console.log(`[OK] contracts valid | workflows=${report.totals.files.workflows} taskbooks=${report.totals.files.taskbooks}${agentCallsPart} warnings=${report.totals.warnings}`);
      }
    } else {
      console.error(`[FAIL] contract validation failed | errors=${report.totals.errors} warnings=${report.totals.warnings}`);
    }

    for (const i of report.issues) {
      if (args.quiet && i.level !== 'error') continue;
      const prefix = i.level === 'error' ? 'ERROR' : 'WARN ';
      const out = `${prefix} ${i.file}: ${i.message}`;
      if (i.level === 'error') console.error(out);
      else console.warn(out);
    }
  }

  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}
