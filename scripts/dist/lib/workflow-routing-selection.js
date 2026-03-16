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
exports.workflowRoutingReportPath = workflowRoutingReportPath;
exports.readWorkflowRoutingReport = readWorkflowRoutingReport;
exports.listWorkflowRoutingReportPaths = listWorkflowRoutingReportPaths;
exports.readLatestWorkflowRoutingReport = readLatestWorkflowRoutingReport;
exports.writeWorkflowRoutingReport = writeWorkflowRoutingReport;
exports.buildWorkflowRouteDetails = buildWorkflowRouteDetails;
exports.selectWorkflowForTaskBook = selectWorkflowForTaskBook;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const project_detection_1 = require("./project-detection");
const workflow_routing_1 = require("./workflow-routing");
function toPosixPath(value) {
    return value.replace(/\\/g, '/');
}
function sanitizeForFilename(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
function createNoopLogger() {
    const noop = () => { };
    return {
        log: noop,
        verbose: noop,
        error: noop,
        warn: noop,
    };
}
function readJsonFile(filePath) {
    if (!fs.existsSync(filePath))
        return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    catch (_a) {
        return null;
    }
}
function normalizeWorkflowRoutingDecision(decision) {
    return {
        ...decision,
        selectedWorkflowPath: toPosixPath(decision.selectedWorkflowPath),
    };
}
function workflowRoutingReportPath(projectRoot, taskBookId) {
    return path.join(projectRoot, '.codebuddy', 'reports', 'workflow-routing', `${sanitizeForFilename(taskBookId)}.routing.json`);
}
function readWorkflowRoutingReport(projectRoot, taskBookId) {
    const parsed = readJsonFile(workflowRoutingReportPath(projectRoot, taskBookId));
    if (!parsed || parsed.taskBookId !== taskBookId || !parsed.decision)
        return null;
    return parsed;
}
function listWorkflowRoutingReportPaths(projectRoot) {
    const reportsDir = path.join(projectRoot, '.codebuddy', 'reports', 'workflow-routing');
    if (!fs.existsSync(reportsDir))
        return [];
    return fs.readdirSync(reportsDir)
        .filter(fileName => fileName.endsWith('.routing.json'))
        .map(fileName => path.join(reportsDir, fileName))
        .sort((left, right) => {
        try {
            return fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs;
        }
        catch (_a) {
            return 0;
        }
    });
}
function readLatestWorkflowRoutingReport(projectRoot) {
    for (const reportPath of listWorkflowRoutingReportPaths(projectRoot)) {
        const parsed = readJsonFile(reportPath);
        if (parsed && parsed.taskBookId && parsed.decision) {
            return parsed;
        }
    }
    return null;
}
function writeWorkflowRoutingReport(projectRoot, report) {
    const reportPath = workflowRoutingReportPath(projectRoot, report.taskBookId);
    try {
        ensureDir(path.dirname(reportPath));
        fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
        return reportPath;
    }
    catch (_a) {
        return null;
    }
}
function buildWorkflowRouteDetails(decision, reportPath) {
    return {
        mode: decision.mode,
        workflowId: decision.selectedWorkflowId,
        workflowPath: toPosixPath(decision.selectedWorkflowPath),
        canonicalWorkflowId: decision.canonicalWorkflowId,
        confidence: decision.confidence,
        reasons: [...decision.reasons],
        fallbackReason: decision.fallbackReason,
        reusedFromTaskBook: decision.reusedFromTaskBook,
        reportPath: toPosixPath(reportPath),
    };
}
function buildWorkflowRoutingReport(params) {
    return {
        version: '1.0.0',
        taskBookId: params.taskBook.id,
        generatedAt: params.decision.generatedAt,
        workspace: params.workspaceInfo,
        input: params.input,
        decision: normalizeWorkflowRoutingDecision(params.decision),
    };
}
function selectWorkflowForTaskBook(params) {
    var _a, _b, _c, _d;
    const generatedAt = new Date().toISOString();
    const catalog = (0, workflow_routing_1.buildWorkflowCatalog)();
    const reportPath = workflowRoutingReportPath(params.projectRoot, params.taskBook.id);
    const explicitWorkflowPath = (_a = params.explicitWorkflowPath) === null || _a === void 0 ? void 0 : _a.trim();
    const existingReport = readWorkflowRoutingReport(params.projectRoot, params.taskBook.id);
    const existingDecision = !explicitWorkflowPath || explicitWorkflowPath.toLowerCase() === 'auto'
        ? (((_b = existingReport === null || existingReport === void 0 ? void 0 : existingReport.decision) === null || _b === void 0 ? void 0 : _b.mode) === 'explicit' ? null : (_c = existingReport === null || existingReport === void 0 ? void 0 : existingReport.decision) !== null && _c !== void 0 ? _c : null)
        : null;
    let input;
    let decision;
    let workspaceInfo = {
        scope: 'workspace-union',
        selectedProject: null,
        totalProjectCount: 1,
    };
    try {
        const workspace = (0, project_detection_1.discoverWorkspace)(createNoopLogger(), params.projectRoot);
        workspaceInfo = {
            scope: workspace.scope,
            selectedProject: workspace.selectedProject,
            totalProjectCount: workspace.totalProjectCount || workspace.projects.length || 1,
        };
        input = (0, workflow_routing_1.buildWorkflowRoutingInput)(params.taskBook, workspace);
        const availableWorkflowIds = Object.entries(catalog)
            .filter(([, workflowRelativePath]) => fs.existsSync(path.join(params.projectRoot, workflowRelativePath)))
            .map(([workflowId]) => workflowId);
        decision = (0, workflow_routing_1.selectWorkflowRoutingDecision)(input, {
            explicitWorkflowPath,
            existingDecision,
            availableWorkflowIds,
            generatedAt,
        });
    }
    catch (error) {
        input = (0, workflow_routing_1.buildWorkflowRoutingInput)(params.taskBook, null);
        if (explicitWorkflowPath && explicitWorkflowPath.toLowerCase() !== 'auto') {
            decision = (0, workflow_routing_1.selectWorkflowRoutingDecision)(input, {
                explicitWorkflowPath,
                generatedAt,
            });
        }
        else {
            const message = error instanceof Error ? error.message : String(error);
            decision = {
                mode: 'fallback',
                selectedWorkflowId: 'default',
                canonicalWorkflowId: 'default',
                selectedWorkflowPath: catalog.default,
                confidence: 'low',
                reasons: [
                    '自动 workflow 路由失败，回退到 default.workflow.json。',
                    message,
                ],
                signals: [],
                fallbackReason: 'route_resolution_error',
                generatedAt,
            };
        }
    }
    const report = buildWorkflowRoutingReport({
        taskBook: params.taskBook,
        input,
        decision,
        workspaceInfo,
    });
    const writtenReportPath = (_d = writeWorkflowRoutingReport(params.projectRoot, report)) !== null && _d !== void 0 ? _d : reportPath;
    return {
        workflowPath: decision.selectedWorkflowPath,
        reportPath: writtenReportPath,
        report,
        decision,
        details: buildWorkflowRouteDetails(decision, writtenReportPath),
    };
}
