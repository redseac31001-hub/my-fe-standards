/**
 * 子 Agent 结果汇总器
 *
 * 扫描 TaskBook 的 agent-calls changelog，读取所有子 Agent 的 result.json，
 * 生成结构化的 FinalReport 写入 TaskBook.finalReport。
 */

import * as fs from 'fs';
import * as path from 'path';
import { TaskBook, TaskItem, FinalReport, AgentResultSummary } from './types';
import { TaskBookManager } from './taskbook-manager';

const AGENT_CALLS_DIR = '.codebuddy/agent-calls';

type RawAgentCallResult = {
  requestId: string;
  kind?: 'planner' | 'manual-task';
  status: 'success' | 'failed' | 'blocked';
  output?: unknown;
  artifacts?: Array<{ type: string; path: string }>;
  error?: { code?: string; message?: string };
  completedAt?: string;
};

/**
 * 从 agent-call changelog 中提取所有 manual-task 类型的 requestId
 *
 * 注：只统计 kind==='manual-task' 的调用（即子 Agent 任务），
 * planner 类型（kind==='planner'）不计入子 Agent 结果汇总。
 */
function extractAgentCallRequestIds(taskBook: TaskBook): Array<{ requestId: string; taskId: string; agentId: string }> {
  const seen = new Set<string>();
  const results: Array<{ requestId: string; taskId: string; agentId: string }> = [];

  for (const entry of taskBook.changelog) {
    const after = entry.after as Record<string, unknown> | undefined;
    if (!after) continue;
    if (after['event'] !== 'agent-call') continue;
    if (after['kind'] !== 'manual-task') continue;

    const requestId = typeof after['requestId'] === 'string' ? after['requestId'] : null;
    const taskId = typeof entry.taskId === 'string' ? entry.taskId : null;
    const agentId = typeof after['agentId'] === 'string' ? after['agentId'] : 'unknown';

    if (!requestId || !taskId || seen.has(requestId)) continue;
    seen.add(requestId);
    results.push({ requestId, taskId, agentId });
  }

  return results;
}

/**
 * 读取单个 agent-call result.json，容错处理
 * 使用 try/catch 包裹整个读取操作，避免 existsSync + readFileSync 之间的 TOCTOU 问题
 */
function readAgentCallResult(projectRoot: string, requestId: string): RawAgentCallResult | null {
  const resultPath = path.join(projectRoot, AGENT_CALLS_DIR, `${requestId}.result.json`);
  try {
    const raw = fs.readFileSync(resultPath, 'utf-8');
    return JSON.parse(raw) as RawAgentCallResult;
  } catch {
    return null;
  }
}

/**
 * 从 TaskBook 任务列表中查找任务
 */
function findTask(taskBook: TaskBook, taskId: string): TaskItem | undefined {
  return taskBook.tasks.find(t => t.id === taskId);
}

/**
 * 从 output 中提取 actualWork 文本
 */
function extractActualWork(output: unknown): string | undefined {
  if (!output || typeof output !== 'object') return undefined;
  const o = output as Record<string, unknown>;
  if (typeof o['actualWork'] === 'string' && o['actualWork'].trim()) {
    return o['actualWork'];
  }
  if (typeof o['summary'] === 'string' && o['summary'].trim()) {
    return o['summary'];
  }
  return undefined;
}

/**
 * 生成执行摘要文本
 */
function buildExecutionSummary(taskBook: TaskBook, agentResults: AgentResultSummary[]): string {
  const done = taskBook.tasks.filter(t => t.status === 'done').length;
  const total = taskBook.tasks.length;
  const successAgents = agentResults.filter(r => r.status === 'success').length;
  const failedAgents = agentResults.filter(r => r.status === 'failed').length;
  const blockedAgents = agentResults.filter(r => r.status === 'blocked').length;

  const lines: string[] = [
    `TaskBook「${taskBook.title}」执行完成。`,
    `共 ${total} 个任务，其中 ${done} 个已完成。`,
  ];

  if (agentResults.length > 0) {
    lines.push(`共调用 ${agentResults.length} 个子 Agent：${successAgents} 成功、${failedAgents} 失败、${blockedAgents} 阻塞。`);
  }

  const blockedTasks = taskBook.tasks.filter(t => t.status === 'blocked');
  if (blockedTasks.length > 0) {
    lines.push(`尚有 ${blockedTasks.length} 个阻塞任务待处理。`);
  }

  return lines.join(' ');
}

/**
 * 从所有 Agent 结果中提取问题列表
 */
function buildIssueList(taskBook: TaskBook, agentResults: AgentResultSummary[]): string[] {
  const issues: string[] = [];

  // 从 Agent 执行结果中提取失败/阻塞问题，并记录已报告的任务 ID
  const reportedTaskIds = new Set<string>();

  for (const result of agentResults) {
    if (result.status === 'failed' && result.error) {
      issues.push(`[${result.agentId}] 任务「${result.taskTitle}」失败：${result.error}`);
      reportedTaskIds.add(result.taskId);
    }
    if (result.status === 'blocked') {
      issues.push(`[${result.agentId}] 任务「${result.taskTitle}」阻塞，等待人工介入`);
      reportedTaskIds.add(result.taskId);
    }
  }

  // 补充 TaskBook 中阻塞但未通过 Agent 结果报告过的任务（使用 taskId 精确去重）
  for (const task of taskBook.tasks) {
    if (task.status === 'blocked' && task.blockedReason && !reportedTaskIds.has(task.id)) {
      issues.push(`任务「${task.title}」阻塞：${task.blockedReason.slice(0, 120)}`);
    }
  }

  return issues;
}

/**
 * 从 TaskBook 状态推导下一步建议
 */
function buildNextSteps(taskBook: TaskBook, agentResults: AgentResultSummary[]): string[] {
  const steps: string[] = [];

  const blockedTasks = taskBook.tasks.filter(t => t.status === 'blocked');
  if (blockedTasks.length > 0) {
    steps.push(`处理 ${blockedTasks.length} 个阻塞任务：${blockedTasks.map(t => t.title).join('、')}`);
  }

  const failedAgents = agentResults.filter(r => r.status === 'failed');
  if (failedAgents.length > 0) {
    steps.push(`重新执行失败的 Agent 任务：${failedAgents.map(r => r.taskTitle).join('、')}`);
  }

  // 检查是否有 review 类型任务未完成
  const pendingReviews = taskBook.tasks.filter(t => t.type === 'review' && t.status === 'pending');
  if (pendingReviews.length > 0) {
    steps.push('完成待审查任务后进行人工验收');
  }

  if (steps.length === 0) {
    steps.push('所有任务已完成，可进行最终人工验收');
    steps.push('建议运行完整测试套件确认功能正常');
  }

  return steps;
}

/**
 * 汇总所有子 Agent 结果，生成 FinalReport
 */
export function aggregateResults(taskBook: TaskBook, projectRoot: string = process.cwd()): FinalReport {
  const callRefs = extractAgentCallRequestIds(taskBook);

  const agentResults: AgentResultSummary[] = [];

  for (const ref of callRefs) {
    const task = findTask(taskBook, ref.taskId);
    const rawResult = readAgentCallResult(projectRoot, ref.requestId);

    const summary: AgentResultSummary = {
      requestId: ref.requestId,
      agentId: ref.agentId,
      taskId: ref.taskId,
      taskTitle: task?.title ?? ref.taskId,
      taskType: task?.type ?? 'implement',
      status: rawResult?.status ?? 'blocked',
      completedAt: rawResult?.completedAt,
      artifacts: rawResult?.artifacts,
    };

    if (rawResult?.output) {
      summary.actualWork = extractActualWork(rawResult.output);
    }

    if (rawResult?.status !== 'success' && rawResult?.error) {
      summary.error = rawResult.error.message ?? String(rawResult.error);
    }

    agentResults.push(summary);
  }

  const successCount = agentResults.filter(r => r.status === 'success').length;
  const failedCount = agentResults.filter(r => r.status === 'failed').length;
  const blockedCount = agentResults.filter(r => r.status === 'blocked').length;

  return {
    generatedAt: new Date().toISOString(),
    taskBookId: taskBook.id,
    executionSummary: buildExecutionSummary(taskBook, agentResults),
    agentResults,
    issueList: buildIssueList(taskBook, agentResults),
    nextSteps: buildNextSteps(taskBook, agentResults),
    stats: {
      totalAgentCalls: agentResults.length,
      successCount,
      failedCount,
      blockedCount,
    },
  };
}

/**
 * 汇总结果并持久化到 TaskBook
 *
 * 使用场景：在 TaskExecutor.execute() 完成阶段调用
 */
export function aggregateAndPersist(
  manager: TaskBookManager,
  taskBookId: string,
  projectRoot: string = process.cwd(),
): FinalReport | null {
  const taskBook = manager.load(taskBookId);
  if (!taskBook) {
    // 调用方已确认 TaskBook 存在，此处出现 null 属于不应发生的错误
    console.error(`[ResultAggregator] TaskBook not found: ${taskBookId}`);
    return null;
  }

  const report = aggregateResults(taskBook, projectRoot);

  try {
    manager.saveFinalReport(taskBookId, report);
    console.log(
      `[ResultAggregator] 汇总完成：${report.stats.totalAgentCalls} 个 Agent 调用，` +
      `${report.stats.successCount} 成功 / ${report.stats.failedCount} 失败 / ${report.stats.blockedCount} 阻塞`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ResultAggregator] 持久化失败，报告仅在内存中：${msg}`);
  }

  return report;
}
