/**
 * 任务执行引擎
 *
 * 负责 TaskBook 中任务的调度和执行，支持并行执行无依赖任务
 */

import {
  TaskBook,
  TaskItem,
  TaskExecutionResult,
} from './types';
import { TaskBookManager } from './taskbook-manager';

/**
 * 任务执行器配置
 */
export interface TaskExecutorConfig {
  maxParallel: number;           // 最大并行数
  onTaskStart?: (task: TaskItem) => void;
  onTaskComplete?: (task: TaskItem, result: TaskExecutionResult) => void;
  onTaskBlocked?: (task: TaskItem, reason: string) => void;
  onAllComplete?: (taskBook: TaskBook) => void;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TaskExecutorConfig = {
  maxParallel: 3,
};

/**
 * 任务执行引擎
 */
export class TaskExecutor {
  private manager: TaskBookManager;
  private config: TaskExecutorConfig;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  constructor(manager: TaskBookManager, config: Partial<TaskExecutorConfig> = {}) {
    this.manager = manager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 开始执行 TaskBook
   */
  async execute(taskBookId: string): Promise<TaskBook | null> {
    const taskBook = this.manager.load(taskBookId);
    if (!taskBook) {
      console.error(`[TaskExecutor] TaskBook not found: ${taskBookId}`);
      return null;
    }

    if (taskBook.status !== 'confirmed') {
      console.error(`[TaskExecutor] TaskBook must be confirmed before execution. Current status: ${taskBook.status}`);
      return null;
    }

    // 更新状态为执行中
    this.manager.updateStatus(taskBookId, 'executing');
    this.isRunning = true;
    this.isPaused = false;

    console.log(`[TaskExecutor] 开始执行 TaskBook: ${taskBook.title}`);
    console.log(`[TaskExecutor] 任务总数: ${taskBook.tasks.length}`);

    // 执行循环
    while (this.isRunning && !this.isPaused) {
      const pendingTasks = this.manager.getParallelizableTasks(taskBookId);

      if (pendingTasks.length === 0) {
        // 检查是否所有任务都完成了
        const currentTaskBook = this.manager.load(taskBookId);
        if (!currentTaskBook) break;

        const allDone = currentTaskBook.tasks.every(
          t => t.status === 'done' || t.status === 'skipped'
        );
        const hasBlocked = currentTaskBook.tasks.some(t => t.status === 'blocked');

        if (allDone) {
          console.log('[TaskExecutor] 所有任务执行完成');
          this.manager.updateStatus(taskBookId, 'completed');
          this.config.onAllComplete?.(currentTaskBook);
          break;
        }

        if (hasBlocked) {
          console.log('[TaskExecutor] 存在阻塞任务，暂停执行');
          this.isPaused = true;
          break;
        }

        // 没有可执行的任务，可能存在循环依赖
        console.error('[TaskExecutor] 无法继续执行，可能存在循环依赖');
        break;
      }

      // 并行执行任务（限制并行数）
      const tasksToExecute = pendingTasks.slice(0, this.config.maxParallel);
      console.log(`[TaskExecutor] 并行执行 ${tasksToExecute.length} 个任务`);

      const results = await Promise.all(
        tasksToExecute.map(task => this.executeTask(taskBookId, task))
      );

      // 处理执行结果
      for (const result of results) {
        if (!result.success && result.error) {
          console.log(`[TaskExecutor] 任务 ${result.taskId} 执行失败: ${result.error}`);
        }
      }
    }

    return this.manager.load(taskBookId);
  }

  /**
   * 执行单个任务
   */
  private async executeTask(taskBookId: string, task: TaskItem): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    // 更新任务状态为进行中
    this.manager.updateTaskStatus(taskBookId, task.id, 'in_progress');
    this.config.onTaskStart?.(task);

    console.log(`[TaskExecutor] 开始执行任务: ${task.title} (${task.type})`);

    try {
      // 根据任务类型调用不同的执行逻辑
      const actualWork = await this.dispatchTask(task);

      // 更新任务状态为完成
      this.manager.updateTaskStatus(taskBookId, task.id, 'done', actualWork);

      const result: TaskExecutionResult = {
        taskId: task.id,
        success: true,
        actualWork,
        duration: Date.now() - startTime,
      };

      this.config.onTaskComplete?.(task, result);
      console.log(`[TaskExecutor] 任务完成: ${task.title}`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 判断是否为可恢复的错误
      if (this.isRecoverableError(error)) {
        // 标记为阻塞，等待用户介入
        this.manager.updateTaskStatus(taskBookId, task.id, 'blocked', undefined, errorMessage);
        this.config.onTaskBlocked?.(task, errorMessage);

        return {
          taskId: task.id,
          success: false,
          error: errorMessage,
          duration: Date.now() - startTime,
        };
      }

      // 不可恢复的错误，保留为 pending 状态等待重试
      console.error(`[TaskExecutor] 任务执行出错: ${task.title}`, error);

      return {
        taskId: task.id,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 分发任务到对应的 Agent
   */
  private async dispatchTask(task: TaskItem): Promise<string> {
    // 根据任务类型分发到不同的处理逻辑
    // 实际实现中，这里会调用对应的 Agent
    switch (task.type) {
      case 'analysis':
        return this.executeAnalysisTask(task);
      case 'design':
        return this.executeDesignTask(task);
      case 'test':
        return this.executeTestTask(task);
      case 'implement':
        return this.executeImplementTask(task);
      case 'review':
        return this.executeReviewTask(task);
      default:
        throw new Error(`未知的任务类型: ${task.type}`);
    }
  }

  /**
   * 执行分析任务
   */
  private async executeAnalysisTask(task: TaskItem): Promise<string> {
    // 模拟分析任务执行
    // 实际实现中会调用 structure-analyzer 或相关工具
    console.log(`[TaskExecutor] 执行分析任务: ${task.title}`);
    return `完成分析: ${task.title}`;
  }

  /**
   * 执行设计任务
   */
  private async executeDesignTask(task: TaskItem): Promise<string> {
    // 模拟设计任务执行
    // 实际实现中会生成接口定义或架构文档
    console.log(`[TaskExecutor] 执行设计任务: ${task.title}`);
    return `完成设计: ${task.title}`;
  }

  /**
   * 执行测试任务
   */
  private async executeTestTask(task: TaskItem): Promise<string> {
    // 模拟测试任务执行
    // 实际实现中会调用 tdd-guide Agent
    console.log(`[TaskExecutor] 执行测试任务: ${task.title}`);
    return `完成测试编写: ${task.title}`;
  }

  /**
   * 执行实现任务
   */
  private async executeImplementTask(task: TaskItem): Promise<string> {
    // 模拟实现任务执行
    // 实际实现中会调用 tdd-guide Agent 或直接编写代码
    console.log(`[TaskExecutor] 执行实现任务: ${task.title}`);
    return `完成实现: ${task.title}`;
  }

  /**
   * 执行审查任务
   */
  private async executeReviewTask(task: TaskItem): Promise<string> {
    // 模拟审查任务执行
    // 实际实现中会调用 code-reviewer Agent
    console.log(`[TaskExecutor] 执行审查任务: ${task.title}`);
    return `完成审查: ${task.title}`;
  }

  /**
   * 判断是否为可恢复的错误
   */
  private isRecoverableError(error: unknown): boolean {
    if (error instanceof Error) {
      // 这些错误类型需要用户介入
      const recoverablePatterns = [
        /missing.*file/i,
        /permission denied/i,
        /not found/i,
        /authentication/i,
        /authorization/i,
        /需要.*确认/,
        /缺少.*配置/,
      ];

      return recoverablePatterns.some(pattern => pattern.test(error.message));
    }
    return false;
  }

  /**
   * 暂停执行
   */
  pause(): void {
    console.log('[TaskExecutor] 暂停执行');
    this.isPaused = true;
  }

  /**
   * 恢复执行
   */
  async resume(taskBookId: string): Promise<TaskBook | null> {
    console.log('[TaskExecutor] 恢复执行');
    this.isPaused = false;
    return this.execute(taskBookId);
  }

  /**
   * 停止执行
   */
  stop(): void {
    console.log('[TaskExecutor] 停止执行');
    this.isRunning = false;
    this.isPaused = false;
  }

  /**
   * 跳过阻塞的任务
   */
  skipBlockedTask(taskBookId: string, taskId: string, reason: string): TaskBook | null {
    const taskBook = this.manager.load(taskBookId);
    if (!taskBook) return null;

    const task = taskBook.tasks.find(t => t.id === taskId);
    if (!task || task.status !== 'blocked') return null;

    this.manager.updateTaskStatus(taskBookId, taskId, 'skipped');
    this.manager.logChange(
      taskBookId,
      taskId,
      'modified',
      `用户跳过阻塞任务: ${reason}`,
      { status: 'blocked' },
      { status: 'skipped' }
    );

    return this.manager.load(taskBookId);
  }

  /**
   * 解决阻塞并继续
   */
  async resolveBlockedTask(
    taskBookId: string,
    taskId: string,
    resolution: string
  ): Promise<TaskBook | null> {
    const taskBook = this.manager.load(taskBookId);
    if (!taskBook) return null;

    const task = taskBook.tasks.find(t => t.id === taskId);
    if (!task || task.status !== 'blocked') return null;

    // 重置为 pending 状态
    this.manager.updateTaskStatus(taskBookId, taskId, 'pending');
    this.manager.logChange(
      taskBookId,
      taskId,
      'modified',
      `用户解决阻塞: ${resolution}`,
      { status: 'blocked', blockedReason: task.blockedReason },
      { status: 'pending' }
    );

    // 继续执行
    return this.resume(taskBookId);
  }
}

/**
 * 创建任务执行器
 */
export function createTaskExecutor(
  manager: TaskBookManager,
  config?: Partial<TaskExecutorConfig>
): TaskExecutor {
  return new TaskExecutor(manager, config);
}
