import * as fs from 'fs';
import * as path from 'path';
import { discoverWorkspace } from './project-detection';
import {
  buildWorkflowCatalog,
  buildWorkflowRoutingInput,
  selectWorkflowRoutingDecision,
} from './workflow-routing';
import {
  TaskBook,
  WorkflowRoutingDecision,
  WorkflowRoutingInput,
} from '../types';

export interface WorkflowRoutingReport {
  version: '1.0.0';
  taskBookId: string;
  generatedAt: string;
  workspace: {
    scope: string;
    selectedProject: string | null;
    totalProjectCount: number;
  };
  input: WorkflowRoutingInput;
  decision: WorkflowRoutingDecision;
}

export interface WorkflowRouteDetails {
  mode: WorkflowRoutingDecision['mode'];
  workflowId: string;
  workflowPath: string;
  canonicalWorkflowId: WorkflowRoutingDecision['canonicalWorkflowId'];
  confidence: WorkflowRoutingDecision['confidence'];
  reasons: string[];
  fallbackReason?: string;
  reusedFromTaskBook?: boolean;
  reportPath: string;
}

export interface WorkflowSelection {
  workflowPath: string;
  reportPath: string;
  report: WorkflowRoutingReport;
  decision: WorkflowRoutingDecision;
  details: WorkflowRouteDetails;
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createNoopLogger() {
  const noop = (): void => {};
  return {
    log: noop,
    verbose: noop,
    error: noop,
    warn: noop,
  };
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function normalizeWorkflowRoutingDecision(decision: WorkflowRoutingDecision): WorkflowRoutingDecision {
  return {
    ...decision,
    selectedWorkflowPath: toPosixPath(decision.selectedWorkflowPath),
  };
}

export function workflowRoutingReportPath(projectRoot: string, taskBookId: string): string {
  return path.join(
    projectRoot,
    '.codebuddy',
    'reports',
    'workflow-routing',
    `${sanitizeForFilename(taskBookId)}.routing.json`,
  );
}

export function readWorkflowRoutingReport(projectRoot: string, taskBookId: string): WorkflowRoutingReport | null {
  const parsed = readJsonFile<WorkflowRoutingReport>(workflowRoutingReportPath(projectRoot, taskBookId));
  if (!parsed || parsed.taskBookId !== taskBookId || !parsed.decision) return null;
  return parsed;
}

export function listWorkflowRoutingReportPaths(projectRoot: string): string[] {
  const reportsDir = path.join(projectRoot, '.codebuddy', 'reports', 'workflow-routing');
  if (!fs.existsSync(reportsDir)) return [];

  return fs.readdirSync(reportsDir)
    .filter(fileName => fileName.endsWith('.routing.json'))
    .map(fileName => path.join(reportsDir, fileName))
    .sort((left, right) => {
      try {
        return fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs;
      } catch {
        return 0;
      }
    });
}

export function readLatestWorkflowRoutingReport(projectRoot: string): WorkflowRoutingReport | null {
  for (const reportPath of listWorkflowRoutingReportPaths(projectRoot)) {
    const parsed = readJsonFile<WorkflowRoutingReport>(reportPath);
    if (parsed && parsed.taskBookId && parsed.decision) {
      return parsed;
    }
  }
  return null;
}

export function writeWorkflowRoutingReport(projectRoot: string, report: WorkflowRoutingReport): string | null {
  const reportPath = workflowRoutingReportPath(projectRoot, report.taskBookId);

  try {
    ensureDir(path.dirname(reportPath));
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
    return reportPath;
  } catch {
    return null;
  }
}

export function buildWorkflowRouteDetails(decision: WorkflowRoutingDecision, reportPath: string): WorkflowRouteDetails {
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

function buildWorkflowRoutingReport(params: {
  taskBook: TaskBook;
  input: WorkflowRoutingInput;
  decision: WorkflowRoutingDecision;
  workspaceInfo: WorkflowRoutingReport['workspace'];
}): WorkflowRoutingReport {
  return {
    version: '1.0.0',
    taskBookId: params.taskBook.id,
    generatedAt: params.decision.generatedAt,
    workspace: params.workspaceInfo,
    input: params.input,
    decision: normalizeWorkflowRoutingDecision(params.decision),
  };
}

export function selectWorkflowForTaskBook(params: {
  projectRoot: string;
  taskBook: TaskBook;
  explicitWorkflowPath?: string;
}): WorkflowSelection {
  const generatedAt = new Date().toISOString();
  const catalog = buildWorkflowCatalog();
  const reportPath = workflowRoutingReportPath(params.projectRoot, params.taskBook.id);
  const explicitWorkflowPath = params.explicitWorkflowPath?.trim();
  const existingReport = readWorkflowRoutingReport(params.projectRoot, params.taskBook.id);
  const existingDecision = !explicitWorkflowPath || explicitWorkflowPath.toLowerCase() === 'auto'
    ? (existingReport?.decision?.mode === 'explicit' ? null : existingReport?.decision ?? null)
    : null;

  let input: WorkflowRoutingInput;
  let decision: WorkflowRoutingDecision;
  let workspaceInfo: WorkflowRoutingReport['workspace'] = {
    scope: 'workspace-union',
    selectedProject: null,
    totalProjectCount: 1,
  };

  try {
    const workspace = discoverWorkspace(createNoopLogger(), params.projectRoot);
    workspaceInfo = {
      scope: workspace.scope,
      selectedProject: workspace.selectedProject,
      totalProjectCount: workspace.totalProjectCount || workspace.projects.length || 1,
    };
    input = buildWorkflowRoutingInput(params.taskBook, workspace);

    const availableWorkflowIds = Object.entries(catalog)
      .filter(([, workflowRelativePath]) => fs.existsSync(path.join(params.projectRoot, workflowRelativePath)))
      .map(([workflowId]) => workflowId);

    decision = selectWorkflowRoutingDecision(input, {
      explicitWorkflowPath,
      existingDecision,
      availableWorkflowIds,
      generatedAt,
    });
  } catch (error) {
    input = buildWorkflowRoutingInput(params.taskBook, null);
    if (explicitWorkflowPath && explicitWorkflowPath.toLowerCase() !== 'auto') {
      decision = selectWorkflowRoutingDecision(input, {
        explicitWorkflowPath,
        generatedAt,
      });
    } else {
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
  const writtenReportPath = writeWorkflowRoutingReport(params.projectRoot, report) ?? reportPath;

  return {
    workflowPath: decision.selectedWorkflowPath,
    reportPath: writtenReportPath,
    report,
    decision,
    details: buildWorkflowRouteDetails(decision, writtenReportPath),
  };
}
