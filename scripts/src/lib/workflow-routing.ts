import * as path from 'path';
import {
  BuiltinWorkflowId,
  TaskBook,
  TaskItem,
  WorkspaceInfo,
  WorkflowRoutingDecision,
  WorkflowRoutingInput,
  WorkflowRoutingSignal,
} from '../types';

export interface WorkflowRoutingOptions {
  explicitWorkflowPath?: string | null;
  existingDecision?: WorkflowRoutingDecision | null;
  workflowBaseDir?: string;
  availableWorkflowIds?: Iterable<string>;
  catalog?: Partial<Record<BuiltinWorkflowId, string>>;
  generatedAt?: string;
}

const BUILTIN_WORKFLOW_RANK: Record<BuiltinWorkflowId, number> = {
  micro: 1,
  sprint: 2,
  default: 3,
};

const HOTFIX_SIGNAL = /(hotfix|quick fix|single[-\s]?file|单文件|快速修复|小\s*bug|小问题|补丁|patch)/i;
const LARGE_SCOPE_SIGNAL = /(新功能|feature|需求|prd|架构|跨模块|跨项目|大规模|major|multi[-\s]?module|multi[-\s]?project)/i;

function uniqStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(value => typeof value === 'string' && value.trim().length > 0)));
}

function inferWorkflowIdFromPath(workflowPath: string): string {
  const baseName = path.basename(workflowPath).replace(/\.workflow\.json$/i, '').replace(/\.json$/i, '');
  return baseName || 'custom';
}

function asBuiltinWorkflowId(value: string | null | undefined): BuiltinWorkflowId | null {
  if (value === 'micro' || value === 'sprint' || value === 'default') {
    return value;
  }
  return null;
}

function getGeneratedAt(value?: string): string {
  return value || new Date().toISOString();
}

function getWorkflowRank(workflowId: BuiltinWorkflowId | null): number {
  return workflowId ? BUILTIN_WORKFLOW_RANK[workflowId] : Number.POSITIVE_INFINITY;
}

function getWorkflowBaseDir(options?: WorkflowRoutingOptions): string {
  return options?.workflowBaseDir || path.join('.codebuddy', 'workflows');
}

function normalizeWorkflowCatalog(options?: WorkflowRoutingOptions): Record<BuiltinWorkflowId, string> {
  const baseDir = getWorkflowBaseDir(options);
  return {
    default: options?.catalog?.default || path.join(baseDir, 'default.workflow.json'),
    sprint: options?.catalog?.sprint || path.join(baseDir, 'sprint.workflow.json'),
    micro: options?.catalog?.micro || path.join(baseDir, 'micro.workflow.json'),
  };
}

function normalizeAvailableWorkflowIds(options?: WorkflowRoutingOptions): Set<string> {
  const ids = options?.availableWorkflowIds
    ? Array.from(options.availableWorkflowIds)
    : ['default', 'sprint', 'micro'];
  return new Set(ids.map(value => value.trim()).filter(Boolean));
}

function createDecision(params: {
  mode: WorkflowRoutingDecision['mode'];
  workflowId: string;
  workflowPath: string;
  canonicalWorkflowId: BuiltinWorkflowId | null;
  confidence: WorkflowRoutingDecision['confidence'];
  reasons: string[];
  signals?: WorkflowRoutingSignal[];
  reusedFromTaskBook?: boolean;
  fallbackReason?: string;
  generatedAt?: string;
}): WorkflowRoutingDecision {
  return {
    mode: params.mode,
    selectedWorkflowId: params.workflowId,
    canonicalWorkflowId: params.canonicalWorkflowId,
    selectedWorkflowPath: params.workflowPath,
    confidence: params.confidence,
    reasons: uniqStrings(params.reasons),
    signals: params.signals ?? [],
    reusedFromTaskBook: params.reusedFromTaskBook,
    fallbackReason: params.fallbackReason,
    generatedAt: getGeneratedAt(params.generatedAt),
  };
}

function computeTaskDepth(taskId: string, tasksById: Map<string, TaskItem>, visiting: Set<string>, memo: Map<string, number>): number {
  const cached = memo.get(taskId);
  if (typeof cached === 'number') return cached;

  if (visiting.has(taskId)) {
    return 1;
  }

  visiting.add(taskId);
  const task = tasksById.get(taskId);
  const dependencies = task?.dependencies ?? [];
  let depth = 1;

  for (const dependencyId of dependencies) {
    if (!tasksById.has(dependencyId)) continue;
    depth = Math.max(depth, 1 + computeTaskDepth(dependencyId, tasksById, visiting, memo));
  }

  visiting.delete(taskId);
  memo.set(taskId, depth);
  return depth;
}

function computeMaxDependencyDepth(tasks: TaskItem[]): number {
  const tasksById = new Map(tasks.map(task => [task.id, task] as const));
  const memo = new Map<string, number>();
  let maxDepth = 0;

  for (const task of tasks) {
    maxDepth = Math.max(maxDepth, computeTaskDepth(task.id, tasksById, new Set<string>(), memo));
  }

  return maxDepth;
}

function collectScopeCount(tasks: TaskItem[], key: 'files' | 'modules'): number {
  const values = new Set<string>();
  for (const task of tasks) {
    const items = task.scope?.[key] ?? [];
    for (const item of items) {
      if (typeof item === 'string' && item.trim()) {
        values.add(item.trim());
      }
    }
  }
  return values.size;
}

function collectRouteHints(taskBook: TaskBook): string[] {
  const values: string[] = [taskBook.title, taskBook.description];
  for (const task of taskBook.tasks) {
    values.push(task.title);
    values.push(...task.acceptanceCriteria);
    values.push(...(task.scope?.tags ?? []));
  }
  return uniqStrings(values);
}

function buildSignal(id: string, matched: boolean, detail?: string, weight?: number): WorkflowRoutingSignal {
  return { id, matched, detail, weight };
}

function decideAutomaticWorkflow(input: WorkflowRoutingInput, options?: WorkflowRoutingOptions): WorkflowRoutingDecision {
  const catalog = normalizeWorkflowCatalog(options);
  const availableWorkflowIds = normalizeAvailableWorkflowIds(options);
  const routeText = input.routeHints.join(' ');

  const hasHotfixSignal = HOTFIX_SIGNAL.test(routeText);
  const hasLargeScopeSignal = LARGE_SCOPE_SIGNAL.test(routeText);
  const hasCrossProjectScope = input.selectedProjectCount > 1;
  const smallScope = input.scopedModuleCount <= 1 && (input.scopedFileCount === 0 || input.scopedFileCount <= 5);
  const tinyScope = input.scopedModuleCount <= 1 && (input.scopedFileCount === 0 || input.scopedFileCount <= 2);

  const signals: WorkflowRoutingSignal[] = [
    buildSignal('has_requirement_or_prd', input.hasRequirementOrPrdTasks, input.hasRequirementOrPrdTasks ? 'TaskBook 包含 requirement/prd 任务' : undefined, 5),
    buildSignal('has_design_tasks', input.hasDesignTasks, input.hasDesignTasks ? 'TaskBook 包含 design 任务' : undefined, 4),
    buildSignal('has_build_fix_tasks', input.hasBuildFixTasks, input.hasBuildFixTasks ? 'TaskBook 包含独立 build-fix 任务' : undefined, 4),
    buildSignal('large_task_count', input.taskCount > 8, `taskCount=${input.taskCount}`, 4),
    buildSignal('deep_dependency_graph', input.maxDependencyDepth > 4, `maxDependencyDepth=${input.maxDependencyDepth}`, 3),
    buildSignal('cross_project_scope', hasCrossProjectScope, `selectedProjectCount=${input.selectedProjectCount}`, 5),
    buildSignal('wide_module_scope', input.scopedModuleCount > 2, `scopedModuleCount=${input.scopedModuleCount}`, 3),
    buildSignal('hotfix_signal', hasHotfixSignal, hasHotfixSignal ? 'routeHints 命中 hotfix/quick-fix 信号' : undefined, 2),
    buildSignal('small_scope', smallScope, `scopedFileCount=${input.scopedFileCount}, scopedModuleCount=${input.scopedModuleCount}`, 2),
    buildSignal('has_review_tasks', input.hasReviewTasks, input.hasReviewTasks ? 'TaskBook 包含 review 任务' : undefined, 2),
    buildSignal('has_high_priority_tasks', input.hasHighPriorityTasks, input.hasHighPriorityTasks ? '存在 critical/high 任务' : undefined, 2),
    buildSignal('large_scope_signal', hasLargeScopeSignal, hasLargeScopeSignal ? 'routeHints 命中 feature/refactor/architecture 信号' : undefined, 2),
  ];

  const defaultReasons = signals
    .filter(signal => signal.matched && (
      signal.id === 'has_requirement_or_prd'
      || signal.id === 'has_design_tasks'
      || signal.id === 'has_build_fix_tasks'
      || signal.id === 'large_task_count'
      || signal.id === 'deep_dependency_graph'
      || signal.id === 'cross_project_scope'
      || signal.id === 'wide_module_scope'
    ))
    .map(signal => signal.detail || signal.id);

  if (defaultReasons.length > 0) {
    const selectedWorkflowId: BuiltinWorkflowId = 'default';
    return resolveAutomaticDecision(selectedWorkflowId, {
      confidence: 'high',
      reasons: [
        '检测到高复杂度或高风险信号，选择 default.workflow.json 保持完整闭环。',
        ...defaultReasons,
      ],
      signals,
      catalog,
      availableWorkflowIds,
      generatedAt: options?.generatedAt,
    });
  }

  const microEligible = input.taskCount <= 3
    && !input.hasRequirementOrPrdTasks
    && !input.hasDesignTasks
    && !input.hasReviewTasks
    && !input.hasBuildFixTasks
    && input.maxDependencyDepth <= 2
    && smallScope;

  if (microEligible && (hasHotfixSignal || tinyScope || input.taskType === 'debugging' || input.taskType === 'testing' || input.taskType === 'code-review')) {
    const selectedWorkflowId: BuiltinWorkflowId = 'micro';
    return resolveAutomaticDecision(selectedWorkflowId, {
      confidence: hasHotfixSignal || tinyScope ? 'high' : 'medium',
      reasons: [
        '任务规模较小且不需要 requirement/review/build-fix 全闭环，优先选择 micro.workflow.json。',
        `taskCount=${input.taskCount}`,
        `maxDependencyDepth=${input.maxDependencyDepth}`,
        `scopedFileCount=${input.scopedFileCount}`,
      ],
      signals,
      catalog,
      availableWorkflowIds,
      generatedAt: options?.generatedAt,
    });
  }

  const sprintEligible = input.taskCount <= 8
    && input.maxDependencyDepth <= 4
    && input.selectedProjectCount <= 1
    && input.scopedModuleCount <= 2;

  if (sprintEligible) {
    const selectedWorkflowId: BuiltinWorkflowId = 'sprint';
    return resolveAutomaticDecision(selectedWorkflowId, {
      confidence: input.hasReviewTasks || hasLargeScopeSignal ? 'high' : 'medium',
      reasons: [
        '任务属于中等规模迭代，适合分析→计划→实现→审查→验收的 sprint.workflow.json。',
        `taskCount=${input.taskCount}`,
        `maxDependencyDepth=${input.maxDependencyDepth}`,
        input.hasReviewTasks ? 'TaskBook 已包含 review 任务。' : '无需 requirement/prd/design 的最重闭环。',
      ],
      signals,
      catalog,
      availableWorkflowIds,
      generatedAt: options?.generatedAt,
    });
  }

  return resolveAutomaticDecision('default', {
    confidence: 'medium',
    reasons: [
      '路由信号不够明确，按保守策略回退到 default.workflow.json。',
    ],
    signals,
    catalog,
    availableWorkflowIds,
    generatedAt: options?.generatedAt,
  });
}

function resolveAutomaticDecision(
  selectedWorkflowId: BuiltinWorkflowId,
  params: {
    confidence: WorkflowRoutingDecision['confidence'];
    reasons: string[];
    signals: WorkflowRoutingSignal[];
    catalog: Record<BuiltinWorkflowId, string>;
    availableWorkflowIds: Set<string>;
    generatedAt?: string;
  },
): WorkflowRoutingDecision {
  if (params.availableWorkflowIds.has(selectedWorkflowId)) {
    return createDecision({
      mode: 'auto',
      workflowId: selectedWorkflowId,
      workflowPath: params.catalog[selectedWorkflowId],
      canonicalWorkflowId: selectedWorkflowId,
      confidence: params.confidence,
      reasons: params.reasons,
      signals: params.signals,
      generatedAt: params.generatedAt,
    });
  }

  return createDecision({
    mode: 'fallback',
    workflowId: 'default',
    workflowPath: params.catalog.default,
    canonicalWorkflowId: 'default',
    confidence: 'low',
    reasons: [
      ...params.reasons,
      `目标 workflow(${selectedWorkflowId}) 当前不可用，回退到 default.workflow.json。`,
    ],
    signals: params.signals,
    fallbackReason: `workflow_unavailable:${selectedWorkflowId}`,
    generatedAt: params.generatedAt,
  });
}

function shouldReuseExistingDecision(
  automaticDecision: WorkflowRoutingDecision,
  existingDecision: WorkflowRoutingDecision | null | undefined,
): boolean {
  if (!existingDecision || !existingDecision.selectedWorkflowPath) {
    return false;
  }

  const existingCanonical = existingDecision.canonicalWorkflowId;
  if (!existingCanonical) {
    return false;
  }

  return getWorkflowRank(existingCanonical) >= getWorkflowRank(automaticDecision.canonicalWorkflowId);
}

function toExplicitDecision(explicitWorkflowPath: string, options?: WorkflowRoutingOptions): WorkflowRoutingDecision {
  const workflowId = inferWorkflowIdFromPath(explicitWorkflowPath);
  const canonicalWorkflowId = asBuiltinWorkflowId(workflowId);
  return createDecision({
    mode: 'explicit',
    workflowId,
    workflowPath: explicitWorkflowPath,
    canonicalWorkflowId,
    confidence: 'high',
    reasons: ['显式指定了 workflow，跳过自动路由。'],
    signals: [],
    generatedAt: options?.generatedAt,
  });
}

export function buildWorkflowRoutingInput(
  taskBook: TaskBook,
  workspaceInfo?: Pick<WorkspaceInfo, 'projects' | 'totalProjectCount' | 'selectedProject' | 'scope'> | null,
): WorkflowRoutingInput {
  const tasks = taskBook.tasks ?? [];
  const selectedProjectCount = workspaceInfo?.scope === 'project-targeted'
    ? 1
    : (workspaceInfo?.projects?.length || 1);

  return {
    taskBookId: taskBook.id,
    taskType: taskBook.taskType ?? null,
    taskCount: tasks.length,
    maxDependencyDepth: computeMaxDependencyDepth(tasks),
    hasRequirementOrPrdTasks: tasks.some(task => task.type === 'requirement' || task.type === 'prd'),
    hasDesignTasks: tasks.some(task => task.type === 'design'),
    hasReviewTasks: tasks.some(task => task.type === 'review'),
    hasBuildFixTasks: tasks.some(task => task.type === 'build-fix'),
    hasHighPriorityTasks: tasks.some(task => task.priority === 'critical' || task.priority === 'high'),
    scopedFileCount: collectScopeCount(tasks, 'files'),
    scopedModuleCount: collectScopeCount(tasks, 'modules'),
    workspaceProjectCount: workspaceInfo?.totalProjectCount || workspaceInfo?.projects?.length || 1,
    selectedProjectCount,
    projectKinds: uniqStrings((workspaceInfo?.projects ?? []).map(project => project.projectKind)),
    routeHints: collectRouteHints(taskBook),
  };
}

export function buildWorkflowCatalog(workflowBaseDir = path.join('.codebuddy', 'workflows')): Record<BuiltinWorkflowId, string> {
  return {
    default: path.join(workflowBaseDir, 'default.workflow.json'),
    sprint: path.join(workflowBaseDir, 'sprint.workflow.json'),
    micro: path.join(workflowBaseDir, 'micro.workflow.json'),
  };
}

export function selectWorkflowRoutingDecision(
  input: WorkflowRoutingInput,
  options?: WorkflowRoutingOptions,
): WorkflowRoutingDecision {
  const explicitWorkflowPath = options?.explicitWorkflowPath?.trim();
  if (explicitWorkflowPath && explicitWorkflowPath.toLowerCase() !== 'auto') {
    return toExplicitDecision(explicitWorkflowPath, options);
  }

  const automaticDecision = decideAutomaticWorkflow(input, options);
  const existingDecision = options?.existingDecision ?? null;
  if (shouldReuseExistingDecision(automaticDecision, existingDecision)) {
    const workflowPath = existingDecision?.selectedWorkflowPath
      || (existingDecision?.canonicalWorkflowId
        ? normalizeWorkflowCatalog(options)[existingDecision.canonicalWorkflowId]
        : automaticDecision.selectedWorkflowPath);

    return createDecision({
      mode: 'reused',
      workflowId: existingDecision?.selectedWorkflowId || automaticDecision.selectedWorkflowId,
      workflowPath,
      canonicalWorkflowId: existingDecision?.canonicalWorkflowId ?? automaticDecision.canonicalWorkflowId,
      confidence: existingDecision?.confidence || automaticDecision.confidence,
      reasons: [
        '复用既有 workflow 决策以保持 rerun/reflow 稳定性。',
        ...(existingDecision?.reasons ?? automaticDecision.reasons),
      ],
      signals: automaticDecision.signals,
      reusedFromTaskBook: true,
      generatedAt: options?.generatedAt,
    });
  }

  return automaticDecision;
}
