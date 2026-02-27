/**
 * Agent Runtime 类型定义
 *
 * 定义 AgentRuntime 系统的核心接口，用于子 Agent 的自动加载、调用和结果收集。
 */

// ============ Agent 加载相关 ============

/**
 * 已加载的 Agent 定义（从 AGENT.md 解析）
 */
export interface LoadedAgent {
    /** Agent 唯一标识 */
    id: string;
    /** AGENT.md 的文件系统绝对路径 */
    definitionPath: string;
    /** 解析后的元数据（YAML frontmatter） */
    metadata: AgentFrontmatter;
    /** AGENT.md 正文内容（去掉 frontmatter 后的 Markdown） */
    body: string;
    /** prompts/ 目录下的模板文件，key 为文件名（不含扩展名） */
    prompts: Record<string, string>;
    /** 从 custom-skills/ 目录加载的 Skill 内容，key 为 skill 名称 */
    skills: Record<string, string>;
    /** 从 rules/ 目录加载的 Rule 内容，key 为 "layer/rule-name" */
    rules: Record<string, string>;
}

/**
 * AGENT.md YAML frontmatter 解析结果
 */
export interface AgentFrontmatter {
    name: string;
    version?: string;
    description: string;
    triggers?: string[];
    permissions?: AgentPermissions;
    dependencies?: Record<string, string[]>;
    model?: string;
}

/**
 * Agent 权限声明（兼容两种格式）
 * - 字符串数组: ["Read", "Write", ...]
 * - 结构化对象: { tools: [...], skills: [...] }
 */
export type AgentPermissions =
    | string[]
    | { tools?: string[]; skills?: string[] };

// ============ 调用上下文 ============

/**
 * Worker Agent 执行上下文
 *
 * 由主 Agent（Orchestrator）构建，传递给 Worker Agent
 */
export interface AgentContext {
    /** TaskBook ID */
    taskBookId: string;
    /** 当前执行的任务 */
    task: AgentTaskSnapshot;
    /** 项目根目录绝对路径 */
    projectRoot: string;
    /** 项目报告快照（如存在） */
    reports?: {
        architecture?: unknown;
        modules?: unknown;
    };
    /** 相关文件内容（由主 Agent 预读取后注入） */
    relatedFiles?: Array<{ path: string; content: string }>;
    /** 依赖任务的执行结果（用于跨任务信息传递） */
    parentResults?: Record<string, AgentResult>;
}

/**
 * 任务快照（传递给 Agent 的精简版本）
 */
export interface AgentTaskSnapshot {
    id: string;
    title: string;
    type: string;
    description?: string;
    priority?: string;
    acceptanceCriteria: string[];
    scope?: {
        files?: string[];
        modules?: string[];
        tags?: string[];
    };
}

// ============ 调用与结果 ============

/**
 * 单次 Agent 调用请求
 */
export interface AgentInvocation {
    /** 目标 Agent ID */
    agentId: string;
    /** 执行上下文 */
    context: AgentContext;
}

/**
 * Agent 执行结果状态
 */
export type AgentResultStatus = 'done' | 'needs_human' | 'error';

/**
 * Agent 执行结果
 */
export interface AgentResult {
    /** 执行状态 */
    status: AgentResultStatus;
    /** 实际完成的工作描述 */
    actualWork: string;
    /** 执行者 Agent ID */
    executedBy: string;
    /** 执行耗时（毫秒） */
    duration: number;
    /** 产出物路径列表 */
    artifacts?: Array<{ type: string; path: string }>;
    /** 需要人工介入时的原因 */
    humanReason?: string;
    /** 执行出错时的错误信息 */
    error?: string;
    /** 渲染后的完整 prompt（用于调试/审计） */
    renderedPrompt?: string;
}

// ============ Runtime 配置 ============

/**
 * AgentRuntime 初始化配置
 */
export interface AgentRuntimeConfig {
    /** 项目根目录（规则库根目录） */
    projectRoot: string;
    /** Agent 定义目录路径（相对于 projectRoot），默认 'agents' */
    agentsDir?: string;
    /** 备用 Agent 定义搜索路径（如 .codebuddy/agents） */
    fallbackAgentsDir?: string;
    /** 是否启用详细日志 */
    verbose?: boolean;
}
