"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTaskIntakeInput = normalizeTaskIntakeInput;
exports.routeTaskIntake = routeTaskIntake;
exports.createDefaultTaskIntakeInput = createDefaultTaskIntakeInput;
exports.normalizeContractState = normalizeContractState;
exports.normalizeUncertainty = normalizeUncertainty;
exports.normalizeTaskIntakeKind = normalizeTaskIntakeKind;
const API_ADAPTATION_SIGNAL = /(api|mock|request|response|field mapping|parameter mapping|adapter|adapt|replace mock|switch api|wire up|integration|联调|对接|接入接口|切接口|接口|参数映射|返回映射|真实接口)/i;
const BUGFIX_SIGNAL = /(bug|fix|hotfix|repair|debug|修复|报错|错误|异常|故障|白屏)/i;
const REFACTOR_SIGNAL = /(refactor|cleanup|extract|split|migration|upgrade|modernize|revamp|重构|改造|升级|迁移|治理|整理|提取|拆分)/i;
const REVIEW_SIGNAL = /(review|audit|审查|审阅|检查)/i;
const FEATURE_SIGNAL = /(feature|需求|新功能|新增|prd|方案|落地|推进|交付|接入|集成)/i;
const CROSS_MODULE_SIGNAL = /(cross[- ]module|cross[- ]domain|multi[- ]module|across .* (module|page|flow)|跨模块|多模块|多个模块|跨页面|跨流程|联动改造)/i;
const HANDOFF_SIGNAL = /(handoff|staged review|交接|多人协作|多 agent|multi[- ]agent|分阶段|阶段性交付)/i;
const PARALLEL_WORK_SIGNAL = /(parallel|并行|多人协作|多 agent|协同开发)/i;
const DURABLE_TRACKING_SIGNAL = /(closed loop|durable tracking|trackable|milestone|验收闭环|测试闭环|review 闭环|测试和 review|review 和测试|里程碑|可追踪|可审计|阶段性验收)/i;
const ARCHITECTURE_CHANGE_SIGNAL = /(architecture|module boundary|layering|架构调整|架构边界|模块边界|分层调整|目录结构调整)/i;
const STATE_MODEL_CHANGE_SIGNAL = /(state model|state management|shared state|store|vuex|pinia|状态模型|状态管理|统一状态|共享状态)/i;
const ROUTING_CHANGE_SIGNAL = /(route change|router|navigation|redirect|路由|跳转|导航)/i;
const WORKFLOW_CHANGE_SIGNAL = /(workflow|execution flow|提交流程|审批流程|业务流程|执行流|编排|闭环)/i;
function uniqStrings(values) {
    return Array.from(new Set(values.filter(value => typeof value === 'string' && value.trim().length > 0)));
}
function buildSignal(id, matched, detail, weight, hardEscalation = false) {
    return { id, matched, detail, weight, hardEscalation };
}
function normalizeNullableCount(value) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        return null;
    const normalized = Math.max(0, Math.floor(value));
    return Number.isFinite(normalized) ? normalized : null;
}
function getGeneratedAt(value) {
    return value || new Date().toISOString();
}
function collectRouteText(input) {
    var _a, _b;
    return uniqStrings([
        (_a = input.title) !== null && _a !== void 0 ? _a : '',
        (_b = input.description) !== null && _b !== void 0 ? _b : '',
        ...input.routeHints,
    ]).join(' ');
}
function inferKindFromText(routeText) {
    if (!routeText.trim())
        return 'unknown';
    if (API_ADAPTATION_SIGNAL.test(routeText))
        return 'api-adaptation';
    if (BUGFIX_SIGNAL.test(routeText))
        return 'bugfix';
    if (REFACTOR_SIGNAL.test(routeText))
        return 'refactor';
    if (REVIEW_SIGNAL.test(routeText))
        return 'review';
    if (FEATURE_SIGNAL.test(routeText))
        return 'feature';
    return 'unknown';
}
function resolveKind(input) {
    if (input.kind && input.kind !== 'unknown')
        return input.kind;
    return inferKindFromText(collectRouteText(input));
}
function normalizeReason(detail, fallback) {
    return (detail === null || detail === void 0 ? void 0 : detail.trim()) || fallback;
}
function resolveDirectValidation(kind) {
    const steps = ['npm run build', 'npm test'];
    if (kind === 'api-adaptation') {
        steps.push('Run one narrow API/request smoke for the affected module');
    }
    else if (kind === 'bugfix') {
        steps.push('Run one focused smoke or regression for the affected interaction');
    }
    else if (kind === 'refactor') {
        steps.push('Run one focused before/after behavior check for the touched module');
    }
    else {
        steps.push('Add the narrowest domain-specific verification that proves the change');
    }
    return steps;
}
function resolveSuggestedNextSteps(path, kind) {
    if (path === 'direct') {
        return [
            'Read the explicit contract and the smallest relevant file set first.',
            'Change code directly without starting task-orchestrator by default.',
            `Keep the task focused on one pass${kind !== 'unknown' ? ` (${kind})` : ''} and only escalate if complexity grows.`,
        ];
    }
    return [
        'Escalate to task-orchestrator or TaskBook-based execution for durable tracking.',
        'Keep staged review, handoff, and validation evidence inside the orchestrated path.',
        'Use quick gate plus focused E2E as the task scope expands.',
    ];
}
function resolveRecommendedWorkflowId(params) {
    if (params.recommendedPath === 'direct') {
        return 'micro';
    }
    const highComplexity = params.contractState === 'none'
        || params.uncertainty === 'high'
        || params.requiresHandoff
        || params.requiresParallelWork
        || params.requiresDurableTracking
        || params.changesArchitecture
        || params.changesStateModel
        || params.changesRouting
        || params.changesWorkflow
        || (typeof params.estimatedDomainCount === 'number' && params.estimatedDomainCount > 1)
        || (typeof params.estimatedModuleCount === 'number' && params.estimatedModuleCount > 2)
        || (typeof params.estimatedFileCount === 'number' && params.estimatedFileCount > 12);
    return highComplexity ? 'default' : 'sprint';
}
function resolveRecommendedSpecMode(workflowId) {
    if (workflowId === 'default') {
        return 'linked-spec-kit';
    }
    return 'inline-open-spec';
}
function normalizeTaskIntakeInput(input) {
    var _a, _b, _c, _d, _e;
    const title = ((_a = input.title) === null || _a === void 0 ? void 0 : _a.trim()) || null;
    const description = ((_b = input.description) === null || _b === void 0 ? void 0 : _b.trim()) || null;
    const routeHints = uniqStrings((_c = input.routeHints) !== null && _c !== void 0 ? _c : []);
    const routeText = uniqStrings([
        title !== null && title !== void 0 ? title : '',
        description !== null && description !== void 0 ? description : '',
        ...routeHints,
    ]).join(' ');
    const estimatedModuleCount = (_d = normalizeNullableCount(input.estimatedModuleCount)) !== null && _d !== void 0 ? _d : (CROSS_MODULE_SIGNAL.test(routeText) ? 2 : null);
    return {
        title,
        description,
        kind: (_e = input.kind) !== null && _e !== void 0 ? _e : null,
        contractState: input.contractState,
        uncertainty: input.uncertainty,
        estimatedFileCount: normalizeNullableCount(input.estimatedFileCount),
        estimatedModuleCount,
        estimatedDomainCount: normalizeNullableCount(input.estimatedDomainCount),
        estimatedEndpointCount: normalizeNullableCount(input.estimatedEndpointCount),
        requiresHandoff: Boolean(input.requiresHandoff) || HANDOFF_SIGNAL.test(routeText),
        requiresParallelWork: Boolean(input.requiresParallelWork) || PARALLEL_WORK_SIGNAL.test(routeText),
        requiresDurableTracking: Boolean(input.requiresDurableTracking) || DURABLE_TRACKING_SIGNAL.test(routeText),
        changesArchitecture: Boolean(input.changesArchitecture) || ARCHITECTURE_CHANGE_SIGNAL.test(routeText),
        changesStateModel: Boolean(input.changesStateModel) || STATE_MODEL_CHANGE_SIGNAL.test(routeText),
        changesRouting: Boolean(input.changesRouting) || ROUTING_CHANGE_SIGNAL.test(routeText),
        changesWorkflow: Boolean(input.changesWorkflow) || WORKFLOW_CHANGE_SIGNAL.test(routeText),
        routeHints,
    };
}
function routeTaskIntake(rawInput, options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const input = normalizeTaskIntakeInput(rawInput);
    const inferredKind = resolveKind(input);
    const estimatedFileCount = input.estimatedFileCount;
    const estimatedModuleCount = input.estimatedModuleCount;
    const estimatedDomainCount = input.estimatedDomainCount;
    const estimatedEndpointCount = input.estimatedEndpointCount;
    const signals = [
        buildSignal('explicit_contract', input.contractState === 'explicit', input.contractState === 'explicit' ? 'The external contract is explicit.' : undefined, 3),
        buildSignal('partial_contract', input.contractState === 'partial', input.contractState === 'partial' ? 'The external contract is only partially explicit.' : undefined, 1),
        buildSignal('missing_contract', input.contractState === 'none', input.contractState === 'none' ? 'The external contract is incomplete or missing.' : undefined, 4, true),
        buildSignal('low_uncertainty', input.uncertainty === 'low', input.uncertainty === 'low' ? 'The task has low uncertainty.' : undefined, 2),
        buildSignal('medium_uncertainty', input.uncertainty === 'medium', input.uncertainty === 'medium' ? 'The task has medium uncertainty.' : undefined, 1),
        buildSignal('high_uncertainty', input.uncertainty === 'high', input.uncertainty === 'high' ? 'The task has high uncertainty.' : undefined, 4, true),
        buildSignal('small_file_set', typeof estimatedFileCount === 'number' && estimatedFileCount <= 5, typeof estimatedFileCount === 'number' ? `estimatedFileCount=${estimatedFileCount}` : undefined, 2),
        buildSignal('wide_file_set', typeof estimatedFileCount === 'number' && estimatedFileCount > 8, typeof estimatedFileCount === 'number' ? `estimatedFileCount=${estimatedFileCount}` : undefined, 2),
        buildSignal('cross_module', typeof estimatedModuleCount === 'number' && estimatedModuleCount > 1, typeof estimatedModuleCount === 'number' ? `estimatedModuleCount=${estimatedModuleCount}` : undefined, 4, true),
        buildSignal('cross_domain', typeof estimatedDomainCount === 'number' && estimatedDomainCount > 1, typeof estimatedDomainCount === 'number' ? `estimatedDomainCount=${estimatedDomainCount}` : undefined, 4, true),
        buildSignal('small_endpoint_set', typeof estimatedEndpointCount === 'number' && estimatedEndpointCount > 0 && estimatedEndpointCount <= 3, typeof estimatedEndpointCount === 'number' ? `estimatedEndpointCount=${estimatedEndpointCount}` : undefined, 1),
        buildSignal('wide_endpoint_set', typeof estimatedEndpointCount === 'number' && estimatedEndpointCount > 5, typeof estimatedEndpointCount === 'number' ? `estimatedEndpointCount=${estimatedEndpointCount}` : undefined, 1),
        buildSignal('requires_handoff', input.requiresHandoff, 'The task needs staged handoff.', 4, true),
        buildSignal('requires_parallel_work', input.requiresParallelWork, 'The task needs parallel ownership.', 4, true),
        buildSignal('requires_durable_tracking', input.requiresDurableTracking, 'The task needs durable tracking.', 4, true),
        buildSignal('changes_architecture', input.changesArchitecture, 'The task changes architecture boundaries.', 5, true),
        buildSignal('changes_state_model', input.changesStateModel, 'The task changes state flow or state-model behavior.', 5, true),
        buildSignal('changes_routing', input.changesRouting, 'The task changes routing or navigation behavior.', 4, true),
        buildSignal('changes_workflow', input.changesWorkflow, 'The task changes workflow or execution behavior.', 4, true),
        buildSignal('kind_api_adaptation', inferredKind === 'api-adaptation', inferredKind === 'api-adaptation' ? 'The task looks like API adaptation or mock replacement.' : undefined, 2),
        buildSignal('kind_localized_fix', inferredKind === 'bugfix' || inferredKind === 'refactor', inferredKind === 'bugfix' || inferredKind === 'refactor' ? `The task looks like a focused ${inferredKind}.` : undefined, 1),
        buildSignal('kind_feature', inferredKind === 'feature', inferredKind === 'feature' ? 'The task looks like a broader feature request.' : undefined, 2),
    ];
    const hardEscalationTriggers = signals
        .filter(signal => signal.matched && signal.hardEscalation)
        .map(signal => normalizeReason(signal.detail, signal.id));
    let directScore = 0;
    let orchestratedScore = 0;
    for (const signal of signals) {
        if (!signal.matched)
            continue;
        switch (signal.id) {
            case 'explicit_contract':
            case 'low_uncertainty':
            case 'small_file_set':
            case 'small_endpoint_set':
            case 'kind_api_adaptation':
            case 'kind_localized_fix':
                directScore += (_a = signal.weight) !== null && _a !== void 0 ? _a : 1;
                break;
            case 'partial_contract':
            case 'medium_uncertainty':
            case 'wide_file_set':
            case 'wide_endpoint_set':
            case 'kind_feature':
                orchestratedScore += (_b = signal.weight) !== null && _b !== void 0 ? _b : 1;
                break;
            default:
                if (signal.hardEscalation) {
                    orchestratedScore += (_c = signal.weight) !== null && _c !== void 0 ? _c : 1;
                }
                break;
        }
    }
    const recommendedPath = hardEscalationTriggers.length > 0
        ? 'orchestrated'
        : directScore >= orchestratedScore
            ? 'direct'
            : 'orchestrated';
    const reasons = recommendedPath === 'direct'
        ? uniqStrings([
            'The task stays within the small-change direct-execution boundary.',
            ...(((_d = signals.find(signal => signal.id === 'explicit_contract' && signal.matched)) === null || _d === void 0 ? void 0 : _d.detail)
                ? [signals.find(signal => signal.id === 'explicit_contract' && signal.matched).detail]
                : []),
            ...(((_e = signals.find(signal => signal.id === 'low_uncertainty' && signal.matched)) === null || _e === void 0 ? void 0 : _e.detail)
                ? [signals.find(signal => signal.id === 'low_uncertainty' && signal.matched).detail]
                : []),
            ...(((_f = signals.find(signal => signal.id === 'small_file_set' && signal.matched)) === null || _f === void 0 ? void 0 : _f.detail)
                ? [signals.find(signal => signal.id === 'small_file_set' && signal.matched).detail]
                : []),
            ...(((_g = signals.find(signal => signal.id === 'kind_api_adaptation' && signal.matched)) === null || _g === void 0 ? void 0 : _g.detail)
                ? [signals.find(signal => signal.id === 'kind_api_adaptation' && signal.matched).detail]
                : []),
            ...(((_h = signals.find(signal => signal.id === 'kind_localized_fix' && signal.matched)) === null || _h === void 0 ? void 0 : _h.detail)
                ? [signals.find(signal => signal.id === 'kind_localized_fix' && signal.matched).detail]
                : []),
        ])
        : uniqStrings([
            hardEscalationTriggers.length > 0
                ? 'One or more orchestration escalation triggers are active.'
                : 'The task is broader or less certain than a one-pass direct execution.',
            ...hardEscalationTriggers,
            ...(((_j = signals.find(signal => signal.id === 'wide_file_set' && signal.matched)) === null || _j === void 0 ? void 0 : _j.detail)
                ? [signals.find(signal => signal.id === 'wide_file_set' && signal.matched).detail]
                : []),
            ...(((_k = signals.find(signal => signal.id === 'wide_endpoint_set' && signal.matched)) === null || _k === void 0 ? void 0 : _k.detail)
                ? [signals.find(signal => signal.id === 'wide_endpoint_set' && signal.matched).detail]
                : []),
            ...(((_l = signals.find(signal => signal.id === 'kind_feature' && signal.matched)) === null || _l === void 0 ? void 0 : _l.detail)
                ? [signals.find(signal => signal.id === 'kind_feature' && signal.matched).detail]
                : []),
        ]);
    const confidence = recommendedPath === 'direct'
        ? (input.contractState === 'explicit'
            && input.uncertainty === 'low'
            && typeof estimatedFileCount === 'number'
            && estimatedFileCount <= 5
            ? 'high'
            : 'medium')
        : (hardEscalationTriggers.length > 0
            || input.uncertainty === 'high'
            ? 'high'
            : 'medium');
    const recommendedWorkflowId = resolveRecommendedWorkflowId({
        recommendedPath,
        contractState: input.contractState,
        uncertainty: input.uncertainty,
        estimatedFileCount,
        estimatedModuleCount,
        estimatedDomainCount,
        requiresHandoff: input.requiresHandoff,
        requiresParallelWork: input.requiresParallelWork,
        requiresDurableTracking: input.requiresDurableTracking,
        changesArchitecture: input.changesArchitecture,
        changesStateModel: input.changesStateModel,
        changesRouting: input.changesRouting,
        changesWorkflow: input.changesWorkflow,
    });
    const recommendedSpecMode = resolveRecommendedSpecMode(recommendedWorkflowId);
    return {
        recommendedPath,
        recommendedWorkflowId,
        recommendedSpecMode,
        confidence,
        inferredKind,
        reasons,
        signals,
        hardEscalationTriggers,
        suggestedNextSteps: resolveSuggestedNextSteps(recommendedPath, inferredKind),
        suggestedValidation: recommendedPath === 'direct'
            ? resolveDirectValidation(inferredKind)
            : ['Use task-orchestrator / TaskBook-based execution.', 'Run quick gate and the narrowest relevant E2E for the affected workflow.'],
        generatedAt: getGeneratedAt(options === null || options === void 0 ? void 0 : options.generatedAt),
    };
}
function createDefaultTaskIntakeInput(overrides = {}) {
    return normalizeTaskIntakeInput({
        title: null,
        description: null,
        kind: null,
        contractState: 'partial',
        uncertainty: 'medium',
        estimatedFileCount: null,
        estimatedModuleCount: null,
        estimatedDomainCount: null,
        estimatedEndpointCount: null,
        requiresHandoff: false,
        requiresParallelWork: false,
        requiresDurableTracking: false,
        changesArchitecture: false,
        changesStateModel: false,
        changesRouting: false,
        changesWorkflow: false,
        routeHints: [],
        ...overrides,
    });
}
function normalizeContractState(value) {
    if (value === 'explicit' || value === 'partial' || value === 'none')
        return value;
    return 'partial';
}
function normalizeUncertainty(value) {
    if (value === 'low' || value === 'medium' || value === 'high')
        return value;
    return 'medium';
}
function normalizeTaskIntakeKind(value) {
    if (value === 'api-adaptation'
        || value === 'bugfix'
        || value === 'refactor'
        || value === 'feature'
        || value === 'review'
        || value === 'analysis'
        || value === 'unknown') {
        return value;
    }
    return null;
}
