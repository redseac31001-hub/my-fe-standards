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
exports.buildWorkflowRoutingInput = buildWorkflowRoutingInput;
exports.buildWorkflowCatalog = buildWorkflowCatalog;
exports.selectWorkflowRoutingDecision = selectWorkflowRoutingDecision;
const path = __importStar(require("path"));
const BUILTIN_WORKFLOW_RANK = {
    micro: 1,
    sprint: 2,
    default: 3,
};
const HOTFIX_SIGNAL = /(hotfix|quick fix|single[-\s]?file|单文件|快速修复|小\s*bug|小问题|补丁|patch)/i;
const LARGE_SCOPE_SIGNAL = /(新功能|feature|需求|prd|架构|跨模块|跨项目|大规模|major|multi[-\s]?module|multi[-\s]?project)/i;
function uniqStrings(values) {
    return Array.from(new Set(values.filter(value => typeof value === 'string' && value.trim().length > 0)));
}
function inferWorkflowIdFromPath(workflowPath) {
    const baseName = path.basename(workflowPath).replace(/\.workflow\.json$/i, '').replace(/\.json$/i, '');
    return baseName || 'custom';
}
function asBuiltinWorkflowId(value) {
    if (value === 'micro' || value === 'sprint' || value === 'default') {
        return value;
    }
    return null;
}
function getGeneratedAt(value) {
    return value || new Date().toISOString();
}
function getWorkflowRank(workflowId) {
    return workflowId ? BUILTIN_WORKFLOW_RANK[workflowId] : Number.POSITIVE_INFINITY;
}
function getWorkflowBaseDir(options) {
    return (options === null || options === void 0 ? void 0 : options.workflowBaseDir) || path.join('.codebuddy', 'workflows');
}
function normalizeWorkflowCatalog(options) {
    var _a, _b, _c;
    const baseDir = getWorkflowBaseDir(options);
    return {
        default: ((_a = options === null || options === void 0 ? void 0 : options.catalog) === null || _a === void 0 ? void 0 : _a.default) || path.join(baseDir, 'default.workflow.json'),
        sprint: ((_b = options === null || options === void 0 ? void 0 : options.catalog) === null || _b === void 0 ? void 0 : _b.sprint) || path.join(baseDir, 'sprint.workflow.json'),
        micro: ((_c = options === null || options === void 0 ? void 0 : options.catalog) === null || _c === void 0 ? void 0 : _c.micro) || path.join(baseDir, 'micro.workflow.json'),
    };
}
function normalizeAvailableWorkflowIds(options) {
    const ids = (options === null || options === void 0 ? void 0 : options.availableWorkflowIds)
        ? Array.from(options.availableWorkflowIds)
        : ['default', 'sprint', 'micro'];
    return new Set(ids.map(value => value.trim()).filter(Boolean));
}
function createDecision(params) {
    var _a;
    return {
        mode: params.mode,
        selectedWorkflowId: params.workflowId,
        canonicalWorkflowId: params.canonicalWorkflowId,
        selectedWorkflowPath: params.workflowPath,
        confidence: params.confidence,
        reasons: uniqStrings(params.reasons),
        signals: (_a = params.signals) !== null && _a !== void 0 ? _a : [],
        reusedFromTaskBook: params.reusedFromTaskBook,
        fallbackReason: params.fallbackReason,
        generatedAt: getGeneratedAt(params.generatedAt),
    };
}
function computeTaskDepth(taskId, tasksById, visiting, memo) {
    var _a;
    const cached = memo.get(taskId);
    if (typeof cached === 'number')
        return cached;
    if (visiting.has(taskId)) {
        return 1;
    }
    visiting.add(taskId);
    const task = tasksById.get(taskId);
    const dependencies = (_a = task === null || task === void 0 ? void 0 : task.dependencies) !== null && _a !== void 0 ? _a : [];
    let depth = 1;
    for (const dependencyId of dependencies) {
        if (!tasksById.has(dependencyId))
            continue;
        depth = Math.max(depth, 1 + computeTaskDepth(dependencyId, tasksById, visiting, memo));
    }
    visiting.delete(taskId);
    memo.set(taskId, depth);
    return depth;
}
function computeMaxDependencyDepth(tasks) {
    const tasksById = new Map(tasks.map(task => [task.id, task]));
    const memo = new Map();
    let maxDepth = 0;
    for (const task of tasks) {
        maxDepth = Math.max(maxDepth, computeTaskDepth(task.id, tasksById, new Set(), memo));
    }
    return maxDepth;
}
function collectScopeCount(tasks, key) {
    var _a, _b;
    const values = new Set();
    for (const task of tasks) {
        const items = (_b = (_a = task.scope) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : [];
        for (const item of items) {
            if (typeof item === 'string' && item.trim()) {
                values.add(item.trim());
            }
        }
    }
    return values.size;
}
function collectRouteHints(taskBook) {
    var _a, _b;
    const values = [taskBook.title, taskBook.description];
    for (const task of taskBook.tasks) {
        values.push(task.title);
        values.push(...task.acceptanceCriteria);
        values.push(...((_b = (_a = task.scope) === null || _a === void 0 ? void 0 : _a.tags) !== null && _b !== void 0 ? _b : []));
    }
    return uniqStrings(values);
}
function buildSignal(id, matched, detail, weight) {
    return { id, matched, detail, weight };
}
function decideAutomaticWorkflow(input, options) {
    const catalog = normalizeWorkflowCatalog(options);
    const availableWorkflowIds = normalizeAvailableWorkflowIds(options);
    const routeText = input.routeHints.join(' ');
    const hasHotfixSignal = HOTFIX_SIGNAL.test(routeText);
    const hasLargeScopeSignal = LARGE_SCOPE_SIGNAL.test(routeText);
    const hasCrossProjectScope = input.selectedProjectCount > 1;
    const smallScope = input.scopedModuleCount <= 1 && (input.scopedFileCount === 0 || input.scopedFileCount <= 5);
    const tinyScope = input.scopedModuleCount <= 1 && (input.scopedFileCount === 0 || input.scopedFileCount <= 2);
    const signals = [
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
        .filter(signal => signal.matched && (signal.id === 'has_requirement_or_prd'
        || signal.id === 'has_design_tasks'
        || signal.id === 'has_build_fix_tasks'
        || signal.id === 'large_task_count'
        || signal.id === 'deep_dependency_graph'
        || signal.id === 'cross_project_scope'
        || signal.id === 'wide_module_scope'))
        .map(signal => signal.detail || signal.id);
    if (defaultReasons.length > 0) {
        const selectedWorkflowId = 'default';
        return resolveAutomaticDecision(selectedWorkflowId, {
            confidence: 'high',
            reasons: [
                '检测到高复杂度或高风险信号，选择 default.workflow.json 保持完整闭环。',
                ...defaultReasons,
            ],
            signals,
            catalog,
            availableWorkflowIds,
            generatedAt: options === null || options === void 0 ? void 0 : options.generatedAt,
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
        const selectedWorkflowId = 'micro';
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
            generatedAt: options === null || options === void 0 ? void 0 : options.generatedAt,
        });
    }
    const sprintEligible = input.taskCount <= 8
        && input.maxDependencyDepth <= 4
        && input.selectedProjectCount <= 1
        && input.scopedModuleCount <= 2;
    if (sprintEligible) {
        const selectedWorkflowId = 'sprint';
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
            generatedAt: options === null || options === void 0 ? void 0 : options.generatedAt,
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
        generatedAt: options === null || options === void 0 ? void 0 : options.generatedAt,
    });
}
function resolveAutomaticDecision(selectedWorkflowId, params) {
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
function shouldReuseExistingDecision(automaticDecision, existingDecision) {
    if (!existingDecision || !existingDecision.selectedWorkflowPath) {
        return false;
    }
    const existingCanonical = existingDecision.canonicalWorkflowId;
    if (!existingCanonical) {
        return false;
    }
    return getWorkflowRank(existingCanonical) >= getWorkflowRank(automaticDecision.canonicalWorkflowId);
}
function toExplicitDecision(explicitWorkflowPath, options) {
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
        generatedAt: options === null || options === void 0 ? void 0 : options.generatedAt,
    });
}
function buildWorkflowRoutingInput(taskBook, workspaceInfo) {
    var _a, _b, _c, _d, _e;
    const tasks = (_a = taskBook.tasks) !== null && _a !== void 0 ? _a : [];
    const selectedProjectCount = (workspaceInfo === null || workspaceInfo === void 0 ? void 0 : workspaceInfo.scope) === 'project-targeted'
        ? 1
        : (((_b = workspaceInfo === null || workspaceInfo === void 0 ? void 0 : workspaceInfo.projects) === null || _b === void 0 ? void 0 : _b.length) || 1);
    return {
        taskBookId: taskBook.id,
        taskType: (_c = taskBook.taskType) !== null && _c !== void 0 ? _c : null,
        taskCount: tasks.length,
        maxDependencyDepth: computeMaxDependencyDepth(tasks),
        hasRequirementOrPrdTasks: tasks.some(task => task.type === 'requirement' || task.type === 'prd'),
        hasDesignTasks: tasks.some(task => task.type === 'design'),
        hasReviewTasks: tasks.some(task => task.type === 'review'),
        hasBuildFixTasks: tasks.some(task => task.type === 'build-fix'),
        hasHighPriorityTasks: tasks.some(task => task.priority === 'critical' || task.priority === 'high'),
        scopedFileCount: collectScopeCount(tasks, 'files'),
        scopedModuleCount: collectScopeCount(tasks, 'modules'),
        workspaceProjectCount: (workspaceInfo === null || workspaceInfo === void 0 ? void 0 : workspaceInfo.totalProjectCount) || ((_d = workspaceInfo === null || workspaceInfo === void 0 ? void 0 : workspaceInfo.projects) === null || _d === void 0 ? void 0 : _d.length) || 1,
        selectedProjectCount,
        projectKinds: uniqStrings(((_e = workspaceInfo === null || workspaceInfo === void 0 ? void 0 : workspaceInfo.projects) !== null && _e !== void 0 ? _e : []).map(project => project.projectKind)),
        routeHints: collectRouteHints(taskBook),
    };
}
function buildWorkflowCatalog(workflowBaseDir = path.join('.codebuddy', 'workflows')) {
    return {
        default: path.join(workflowBaseDir, 'default.workflow.json'),
        sprint: path.join(workflowBaseDir, 'sprint.workflow.json'),
        micro: path.join(workflowBaseDir, 'micro.workflow.json'),
    };
}
function selectWorkflowRoutingDecision(input, options) {
    var _a, _b, _c, _d;
    const explicitWorkflowPath = (_a = options === null || options === void 0 ? void 0 : options.explicitWorkflowPath) === null || _a === void 0 ? void 0 : _a.trim();
    if (explicitWorkflowPath && explicitWorkflowPath.toLowerCase() !== 'auto') {
        return toExplicitDecision(explicitWorkflowPath, options);
    }
    const automaticDecision = decideAutomaticWorkflow(input, options);
    const existingDecision = (_b = options === null || options === void 0 ? void 0 : options.existingDecision) !== null && _b !== void 0 ? _b : null;
    if (shouldReuseExistingDecision(automaticDecision, existingDecision)) {
        const workflowPath = (existingDecision === null || existingDecision === void 0 ? void 0 : existingDecision.selectedWorkflowPath)
            || ((existingDecision === null || existingDecision === void 0 ? void 0 : existingDecision.canonicalWorkflowId)
                ? normalizeWorkflowCatalog(options)[existingDecision.canonicalWorkflowId]
                : automaticDecision.selectedWorkflowPath);
        return createDecision({
            mode: 'reused',
            workflowId: (existingDecision === null || existingDecision === void 0 ? void 0 : existingDecision.selectedWorkflowId) || automaticDecision.selectedWorkflowId,
            workflowPath,
            canonicalWorkflowId: (_c = existingDecision === null || existingDecision === void 0 ? void 0 : existingDecision.canonicalWorkflowId) !== null && _c !== void 0 ? _c : automaticDecision.canonicalWorkflowId,
            confidence: (existingDecision === null || existingDecision === void 0 ? void 0 : existingDecision.confidence) || automaticDecision.confidence,
            reasons: [
                '复用既有 workflow 决策以保持 rerun/reflow 稳定性。',
                ...((_d = existingDecision === null || existingDecision === void 0 ? void 0 : existingDecision.reasons) !== null && _d !== void 0 ? _d : automaticDecision.reasons),
            ],
            signals: automaticDecision.signals,
            reusedFromTaskBook: true,
            generatedAt: options === null || options === void 0 ? void 0 : options.generatedAt,
        });
    }
    return automaticDecision;
}
