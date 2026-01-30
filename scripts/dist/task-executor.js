"use strict";
/**
 * 任务执行引擎
 *
 * 负责 TaskBook 中任务的调度和执行，支持并行执行无依赖任务
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskExecutor = void 0;
exports.createTaskExecutor = createTaskExecutor;
/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
    maxParallel: 3,
};
/**
 * 任务执行引擎
 */
class TaskExecutor {
    constructor(manager, config = {}) {
        this.isRunning = false;
        this.isPaused = false;
        this.manager = manager;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * 开始执行 TaskBook
     */
    async execute(taskBookId) {
        var _a, _b;
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
                if (!currentTaskBook)
                    break;
                const allDone = currentTaskBook.tasks.every(t => t.status === 'done' || t.status === 'skipped');
                const hasBlocked = currentTaskBook.tasks.some(t => t.status === 'blocked');
                if (allDone) {
                    console.log('[TaskExecutor] 所有任务执行完成');
                    this.manager.updateStatus(taskBookId, 'completed');
                    (_b = (_a = this.config).onAllComplete) === null || _b === void 0 ? void 0 : _b.call(_a, currentTaskBook);
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
            const results = await Promise.all(tasksToExecute.map(task => this.executeTask(taskBookId, task)));
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
    async executeTask(taskBookId, task) {
        var _a, _b, _c, _d, _e, _f;
        const startTime = Date.now();
        // 更新任务状态为进行中
        this.manager.updateTaskStatus(taskBookId, task.id, 'in_progress');
        (_b = (_a = this.config).onTaskStart) === null || _b === void 0 ? void 0 : _b.call(_a, task);
        console.log(`[TaskExecutor] 开始执行任务: ${task.title} (${task.type})`);
        try {
            // 根据任务类型调用不同的执行逻辑
            const actualWork = await this.dispatchTask(task);
            // 更新任务状态为完成
            this.manager.updateTaskStatus(taskBookId, task.id, 'done', actualWork);
            const result = {
                taskId: task.id,
                success: true,
                actualWork,
                duration: Date.now() - startTime,
            };
            (_d = (_c = this.config).onTaskComplete) === null || _d === void 0 ? void 0 : _d.call(_c, task, result);
            console.log(`[TaskExecutor] 任务完成: ${task.title}`);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // 判断是否为可恢复的错误
            if (this.isRecoverableError(error)) {
                // 标记为阻塞，等待用户介入
                this.manager.updateTaskStatus(taskBookId, task.id, 'blocked', undefined, errorMessage);
                (_f = (_e = this.config).onTaskBlocked) === null || _f === void 0 ? void 0 : _f.call(_e, task, errorMessage);
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
    async dispatchTask(task) {
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
    async executeAnalysisTask(task) {
        // 模拟分析任务执行
        // 实际实现中会调用 structure-analyzer 或相关工具
        console.log(`[TaskExecutor] 执行分析任务: ${task.title}`);
        return `完成分析: ${task.title}`;
    }
    /**
     * 执行设计任务
     */
    async executeDesignTask(task) {
        // 模拟设计任务执行
        // 实际实现中会生成接口定义或架构文档
        console.log(`[TaskExecutor] 执行设计任务: ${task.title}`);
        return `完成设计: ${task.title}`;
    }
    /**
     * 执行测试任务
     */
    async executeTestTask(task) {
        // 模拟测试任务执行
        // 实际实现中会调用 tdd-guide Agent
        console.log(`[TaskExecutor] 执行测试任务: ${task.title}`);
        return `完成测试编写: ${task.title}`;
    }
    /**
     * 执行实现任务
     */
    async executeImplementTask(task) {
        // 模拟实现任务执行
        // 实际实现中会调用 tdd-guide Agent 或直接编写代码
        console.log(`[TaskExecutor] 执行实现任务: ${task.title}`);
        return `完成实现: ${task.title}`;
    }
    /**
     * 执行审查任务
     */
    async executeReviewTask(task) {
        // 模拟审查任务执行
        // 实际实现中会调用 code-reviewer Agent
        console.log(`[TaskExecutor] 执行审查任务: ${task.title}`);
        return `完成审查: ${task.title}`;
    }
    /**
     * 判断是否为可恢复的错误
     */
    isRecoverableError(error) {
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
    pause() {
        console.log('[TaskExecutor] 暂停执行');
        this.isPaused = true;
    }
    /**
     * 恢复执行
     */
    async resume(taskBookId) {
        console.log('[TaskExecutor] 恢复执行');
        this.isPaused = false;
        return this.execute(taskBookId);
    }
    /**
     * 停止执行
     */
    stop() {
        console.log('[TaskExecutor] 停止执行');
        this.isRunning = false;
        this.isPaused = false;
    }
    /**
     * 跳过阻塞的任务
     */
    skipBlockedTask(taskBookId, taskId, reason) {
        const taskBook = this.manager.load(taskBookId);
        if (!taskBook)
            return null;
        const task = taskBook.tasks.find(t => t.id === taskId);
        if (!task || task.status !== 'blocked')
            return null;
        this.manager.updateTaskStatus(taskBookId, taskId, 'skipped');
        this.manager.logChange(taskBookId, taskId, 'modified', `用户跳过阻塞任务: ${reason}`, { status: 'blocked' }, { status: 'skipped' });
        return this.manager.load(taskBookId);
    }
    /**
     * 解决阻塞并继续
     */
    async resolveBlockedTask(taskBookId, taskId, resolution) {
        const taskBook = this.manager.load(taskBookId);
        if (!taskBook)
            return null;
        const task = taskBook.tasks.find(t => t.id === taskId);
        if (!task || task.status !== 'blocked')
            return null;
        // 重置为 pending 状态
        this.manager.updateTaskStatus(taskBookId, taskId, 'pending');
        this.manager.logChange(taskBookId, taskId, 'modified', `用户解决阻塞: ${resolution}`, { status: 'blocked', blockedReason: task.blockedReason }, { status: 'pending' });
        // 继续执行
        return this.resume(taskBookId);
    }
}
exports.TaskExecutor = TaskExecutor;
/**
 * 创建任务执行器
 */
function createTaskExecutor(manager, config) {
    return new TaskExecutor(manager, config);
}
