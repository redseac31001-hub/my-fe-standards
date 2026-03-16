#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, execSync } from 'child_process';
// ============================================================
// Schema 定义（运行时类型验证）
// ============================================================
const UserStorySchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    acceptanceCriteria: z.array(z.string()),
    priority: z.number(),
    passes: z.boolean(),
    notes: z.string(),
});
const PrdConfigSchema = z.object({
    project: z.string(),
    branchName: z.string(),
    description: z.string(),
    userStories: z.array(UserStorySchema),
});
const currentModuleFile = fileURLToPath(import.meta.url);
const currentModuleDir = path.dirname(currentModuleFile);
export function resolveBundledScriptPath(relativePath) {
    return path.resolve(currentModuleDir, relativePath);
}
function isDirectExecutionEntry() {
    if (!process.argv[1]) {
        return false;
    }
    return path.resolve(process.argv[1]) === currentModuleFile;
}
// 工具参数 Schema
const RalphInitArgsSchema = z.object({
    project: z.string().min(1, '项目名称不能为空'),
    branchName: z.string().min(1, '分支名称不能为空'),
    description: z.string(),
});
const RalphStatusArgsSchema = z.object({
    workDir: z.string().optional(),
});
const RalphCompleteArgsSchema = z.object({
    storyId: z.string().min(1, '故事 ID 不能为空'),
    notes: z.string().optional(),
});
const RalphAddStoryArgsSchema = z.object({
    title: z.string().min(1, '标题不能为空'),
    description: z.string(),
    acceptanceCriteria: z.array(z.string()).min(1, '至少需要一个验收标准'),
    priority: z.number().int().positive().optional(),
});
const RalphLogArgsSchema = z.object({
    storyId: z.string(),
    summary: z.string(),
    filesChanged: z.array(z.string()).optional(),
    learnings: z.array(z.string()).optional(),
});
const RalphSetWorkdirArgsSchema = z.object({
    path: z.string().min(1, '路径不能为空'),
});
// Structure Analyzer 参数 Schema
const AnalyzeProjectStructureArgsSchema = z.object({
    projectPath: z.string().min(1, '项目路径不能为空'),
    mode: z.enum(['problems_only', 'summary', 'full']).optional().default('problems_only'),
    maxDepth: z.number().int().positive().optional().default(5),
    limitTopFiles: z.number().int().positive().optional().default(20),
});
// ============================================================
// CodeBuddy TaskBook / Workflow 工具 Schema
// ============================================================
const TaskBookTypeSchema = z.enum(['new-feature', 'refactoring', 'debugging', 'testing', 'code-review']);
const TASK_TYPE_VALUES = [
    'requirement',
    'prd',
    'analysis',
    'design',
    'test',
    'implement',
    'refactor',
    'review',
    'build-fix',
    'acceptance',
];
const TaskTypeSchema = z.enum(TASK_TYPE_VALUES);
const TaskStatusSchema = z.enum(['pending', 'in_progress', 'done', 'blocked', 'skipped']);
const TaskPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
const CodebuddySetWorkdirArgsSchema = z.object({
    path: z.string().min(1, '路径不能为空'),
});
const TaskBookCreateArgsSchema = z.object({
    projectPath: z.string().optional(),
    title: z.string().min(1, '标题不能为空'),
    description: z.string(),
    taskType: TaskBookTypeSchema,
});
const TaskBookListArgsSchema = z.object({
    projectPath: z.string().optional(),
});
const TaskBookShowArgsSchema = z.object({
    projectPath: z.string().optional(),
    taskBookId: z.string().min(1, 'TaskBook ID 不能为空'),
});
const TaskBookStatusArgsSchema = z.object({
    projectPath: z.string().optional(),
    taskBookId: z.string().min(1, 'TaskBook ID 不能为空'),
    ifRevision: z.number().int().nonnegative().optional(),
});
const TaskBookAddTaskArgsSchema = z.object({
    projectPath: z.string().optional(),
    taskBookId: z.string().min(1, 'TaskBook ID 不能为空'),
    title: z.string().min(1, '标题不能为空'),
    type: TaskTypeSchema,
    priority: TaskPrioritySchema.optional(),
    deps: z.array(z.string()).optional(),
    acceptanceCriteria: z.array(z.string()).optional(),
    scopeFiles: z.array(z.string()).optional(),
    scopeModules: z.array(z.string()).optional(),
    scopeTags: z.array(z.string()).optional(),
    ifRevision: z.number().int().nonnegative().optional(),
});
const TaskBookUpdateTaskArgsSchema = z.object({
    projectPath: z.string().optional(),
    taskBookId: z.string().min(1, 'TaskBook ID 不能为空'),
    taskId: z.string().min(1, 'Task ID 不能为空'),
    title: z.string().optional(),
    status: TaskStatusSchema.optional(),
    priority: TaskPrioritySchema.optional(),
    deps: z.array(z.string()).optional(),
    acceptanceCriteria: z.array(z.string()).optional(),
    scopeFiles: z.array(z.string()).optional(),
    scopeModules: z.array(z.string()).optional(),
    scopeTags: z.array(z.string()).optional(),
    actualWork: z.string().optional(),
    blockedReason: z.string().optional(),
    executedBy: z.string().optional(),
    ifRevision: z.number().int().nonnegative().optional(),
});
const TaskBookClaimArgsSchema = z.object({
    projectPath: z.string().optional(),
    taskBookId: z.string().min(1, 'TaskBook ID 不能为空'),
    taskId: z.string().min(1, 'Task ID 不能为空'),
    by: z.string().min(1, 'by 不能为空'),
    ifRevision: z.number().int().nonnegative().optional(),
});
const TaskBookAppendWorkArgsSchema = z.object({
    projectPath: z.string().optional(),
    taskBookId: z.string().min(1, 'TaskBook ID 不能为空'),
    taskId: z.string().min(1, 'Task ID 不能为空'),
    text: z.string().min(1, 'text 不能为空'),
    ifRevision: z.number().int().nonnegative().optional(),
});
const TaskBookReportArgsSchema = z.object({
    projectPath: z.string().optional(),
    taskBookId: z.string().min(1, 'TaskBook ID 不能为空'),
    write: z.boolean().optional(),
    out: z.string().optional(),
});
const TaskBookUnblockArgsSchema = z.object({
    projectPath: z.string().optional(),
    taskBookId: z.string().min(1, 'TaskBook ID 不能为空'),
    taskId: z.string().min(1, 'Task ID 不能为空'),
    resolution: z.string().min(1, 'resolution 不能为空'),
    ifRevision: z.number().int().nonnegative().optional(),
});
// CodeBuddy Reports（report-manager.js）
const ReportsInspectArgsSchema = z.object({
    projectPath: z.string().optional(),
    module: z.string().optional(),
    file: z.string().optional(),
    depth: z.number().int().positive().optional(),
    trendPoints: z.number().int().positive().optional(),
}).refine((d) => Boolean(d.module || d.file), {
    message: 'module 或 file 必须至少提供一个',
});
const ReportsHotspotsArgsSchema = z.object({
    projectPath: z.string().optional(),
    top: z.number().int().positive().optional(),
});
const WorkflowRunArgsSchema = z.object({
    projectPath: z.string().optional(),
    taskBookId: z.string().min(1, 'TaskBook ID 不能为空'),
    workflowPath: z.string().optional(),
    approve: z.array(z.string()).optional(),
    maxParallel: z.number().int().positive().optional(),
    tasksOnly: z.boolean().optional().default(false),
});
function createServerState(initialWorkDir) {
    let state = { workDir: initialWorkDir };
    return {
        getState: () => state,
        updateWorkDir: (newDir) => {
            state = { ...state, workDir: newDir };
        },
    };
}
const serverState = createServerState(process.cwd());
async function readPrd(workDir) {
    const prdPath = path.join(workDir, 'prd.json');
    try {
        const content = await fs.readFile(prdPath, 'utf-8');
        const parsed = JSON.parse(content);
        const validated = PrdConfigSchema.parse(parsed);
        return { success: true, data: validated };
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return { success: false, error: { type: 'NOT_FOUND', message: 'prd.json 不存在' } };
        }
        if (error instanceof SyntaxError) {
            return { success: false, error: { type: 'PARSE_ERROR', message: 'prd.json JSON 格式无效' } };
        }
        if (error instanceof z.ZodError) {
            return { success: false, error: { type: 'VALIDATION_ERROR', message: `prd.json 结构无效: ${error.message}` } };
        }
        return { success: false, error: { type: 'UNKNOWN', message: String(error) } };
    }
}
async function writePrd(workDir, prd) {
    const prdPath = path.join(workDir, 'prd.json');
    await fs.writeFile(prdPath, JSON.stringify(prd, null, 2), 'utf-8');
}
async function readProgress(workDir) {
    try {
        const progressPath = path.join(workDir, 'progress.txt');
        return await fs.readFile(progressPath, 'utf-8');
    }
    catch {
        return '';
    }
}
async function appendProgress(workDir, entry) {
    const progressPath = path.join(workDir, 'progress.txt');
    let content = await readProgress(workDir);
    if (!content) {
        content = `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`;
    }
    content += `\n${entry}\n---\n`;
    await fs.writeFile(progressPath, content, 'utf-8');
}
function getNextStory(prd) {
    const pending = prd.userStories
        .filter((s) => !s.passes)
        .sort((a, b) => a.priority - b.priority);
    return pending[0] ?? null;
}
function getStatus(prd) {
    const completed = prd.userStories.filter((s) => s.passes).length;
    const total = prd.userStories.length;
    const next = getNextStory(prd);
    return { completed, total, next };
}
function markStoryComplete(prd, storyId, notes) {
    return {
        ...prd,
        userStories: prd.userStories.map((s) => s.id === storyId
            ? { ...s, passes: true, notes: notes ?? s.notes }
            : s),
    };
}
function addStory(prd, story) {
    return {
        ...prd,
        userStories: [...prd.userStories, story],
    };
}
async function validateDirectory(dirPath) {
    try {
        const resolved = path.resolve(dirPath);
        const stats = await fs.stat(resolved);
        if (!stats.isDirectory()) {
            return { valid: false, error: `路径不是目录: ${resolved}` };
        }
        return { valid: true, resolved };
    }
    catch {
        return { valid: false, error: `无法访问目录: ${dirPath}` };
    }
}
async function resolveProjectDir(projectPath, fallbackWorkDir) {
    const target = projectPath ?? fallbackWorkDir;
    const validation = await validateDirectory(target);
    if (!validation.valid) {
        return { ok: false, error: validation.error };
    }
    return { ok: true, dir: validation.resolved };
}
async function resolveCodebuddyScript(workDir, scriptFile) {
    const scriptsDir = path.join(workDir, '.codebuddy', 'scripts');
    try {
        const stats = await fs.stat(scriptsDir);
        if (!stats.isDirectory()) {
            return { ok: false, error: `路径不是目录: ${scriptsDir}` };
        }
    }
    catch {
        return { ok: false, error: `未找到 .codebuddy/scripts，请先运行 codebuddy-loader 初始化项目（生成 .codebuddy/scripts）: ${scriptsDir}` };
    }
    const scriptPath = path.join(scriptsDir, scriptFile);
    try {
        const stats = await fs.stat(scriptPath);
        if (!stats.isFile()) {
            return { ok: false, error: `脚本不是文件: ${scriptPath}` };
        }
        return { ok: true, scriptPath };
    }
    catch {
        return { ok: false, error: `未找到脚本: ${scriptPath}（请重新运行 loader 分发脚本）` };
    }
}
function formatExecError(error) {
    const anyErr = error;
    const stderr = typeof anyErr?.stderr === 'string' ? anyErr.stderr : '';
    const stdout = typeof anyErr?.stdout === 'string' ? anyErr.stdout : '';
    const parts = [
        anyErr?.message ? `message: ${anyErr.message}` : null,
        stderr ? `stderr:\n${stderr}` : null,
        stdout ? `stdout:\n${stdout}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join('\n') : String(error);
}
function execCodebuddyScript(projectDir, scriptPath, args, opts) {
    return execFileSync(process.execPath, [scriptPath, ...args], {
        cwd: projectDir,
        encoding: 'utf-8',
        timeout: opts?.timeoutMs ?? 5 * 60 * 1000,
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}
// ============================================================
// MCP 服务器定义
// ============================================================
const server = new Server({
    name: 'fe-standards-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
        resources: {},
    },
});
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'ralph_init',
            description: '初始化 Ralph 项目，创建 prd.json 模板和 progress.txt',
            inputSchema: {
                type: 'object',
                properties: {
                    project: { type: 'string', description: '项目名称' },
                    branchName: { type: 'string', description: '分支名称（如 ralph/feature-name）' },
                    description: { type: 'string', description: '功能描述' },
                },
                required: ['project', 'branchName', 'description'],
            },
        },
        {
            name: 'ralph_status',
            description: '查看 Ralph 任务状态，包括完成进度和下一个待执行的故事',
            inputSchema: {
                type: 'object',
                properties: {
                    workDir: { type: 'string', description: '工作目录（可选）' },
                },
            },
        },
        {
            name: 'ralph_next',
            description: '获取下一个待执行的用户故事详情',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        },
        {
            name: 'ralph_complete',
            description: '标记指定故事为已完成',
            inputSchema: {
                type: 'object',
                properties: {
                    storyId: { type: 'string', description: '故事 ID（如 US-001）' },
                    notes: { type: 'string', description: '完成备注（可选）' },
                },
                required: ['storyId'],
            },
        },
        {
            name: 'ralph_add_story',
            description: '添加新的用户故事到 prd.json',
            inputSchema: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: '故事标题' },
                    description: { type: 'string', description: '故事描述' },
                    acceptanceCriteria: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '验收标准列表',
                    },
                    priority: { type: 'number', description: '优先级（数字越小越优先）' },
                },
                required: ['title', 'description', 'acceptanceCriteria'],
            },
        },
        {
            name: 'ralph_log',
            description: '记录进度到 progress.txt',
            inputSchema: {
                type: 'object',
                properties: {
                    storyId: { type: 'string', description: '故事 ID' },
                    summary: { type: 'string', description: '实现摘要' },
                    filesChanged: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '修改的文件列表',
                    },
                    learnings: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '学习收获',
                    },
                },
                required: ['storyId', 'summary'],
            },
        },
        {
            name: 'ralph_set_workdir',
            description: '设置 Ralph 工作目录',
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: '工作目录路径' },
                },
                required: ['path'],
            },
        },
        {
            name: 'ralph_ping',
            description: '检查 Ralph MCP Server 是否正常运行',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        },
        {
            name: 'analyze_project_structure',
            description: '分析目标项目的目录结构，检测反模式并生成健康度报告。默认返回精简的问题列表，避免消耗过多 Token。',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: {
                        type: 'string',
                        description: '项目根目录的绝对路径',
                    },
                    mode: {
                        type: 'string',
                        enum: ['problems_only', 'summary', 'full'],
                        default: 'problems_only',
                        description: '输出模式：problems_only(仅违规项)、summary(含统计)、full(含完整树)',
                    },
                    maxDepth: {
                        type: 'number',
                        default: 5,
                        description: '最大扫描深度',
                    },
                    limitTopFiles: {
                        type: 'number',
                        default: 20,
                        description: '返回的 TopN 最大文件数量',
                    },
                },
                required: ['projectPath'],
            },
        },
        {
            name: 'codebuddy_set_workdir',
            description: '设置 CodeBuddy 工作目录（TaskBook/Workflow 默认在此目录执行）',
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: '工作目录路径（项目根目录）' },
                },
                required: ['path'],
            },
        },
        {
            name: 'taskbook_create',
            description: '创建 TaskBook（唯一事实源）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    title: { type: 'string', description: 'TaskBook 标题' },
                    description: { type: 'string', description: 'TaskBook 描述' },
                    taskType: {
                        type: 'string',
                        enum: ['new-feature', 'refactoring', 'debugging', 'testing', 'code-review'],
                        description: 'TaskBook 类型',
                    },
                },
                required: ['title', 'description', 'taskType'],
            },
        },
        {
            name: 'taskbook_list',
            description: '列出 active TaskBooks（JSON）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                },
            },
        },
        {
            name: 'taskbook_show',
            description: '查看 TaskBook（JSON）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID（如 tb-20260130-xxx）' },
                },
                required: ['taskBookId'],
            },
        },
        {
            name: 'taskbook_confirm',
            description: '确认 TaskBook（status: confirmed）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID' },
                    ifRevision: { type: 'integer', description: '可选：要求 TaskBook.revision 匹配（避免并发覆盖）' },
                },
                required: ['taskBookId'],
            },
        },
        {
            name: 'taskbook_complete',
            description: '完成并归档 TaskBook（status: completed → history）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID' },
                    ifRevision: { type: 'integer', description: '可选：要求 TaskBook.revision 匹配（避免并发覆盖）' },
                },
                required: ['taskBookId'],
            },
        },
        {
            name: 'taskbook_abort',
            description: '中止并归档 TaskBook（status: aborted → history）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID' },
                    ifRevision: { type: 'integer', description: '可选：要求 TaskBook.revision 匹配（避免并发覆盖）' },
                },
                required: ['taskBookId'],
            },
        },
        {
            name: 'taskbook_add_task',
            description: '向 TaskBook 添加任务（JSON）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID' },
                    ifRevision: { type: 'integer', description: '可选：要求 TaskBook.revision 匹配（避免并发覆盖）' },
                    title: { type: 'string', description: '任务标题' },
                    type: {
                        type: 'string',
                        enum: [...TASK_TYPE_VALUES],
                        description: '任务类型',
                    },
                    priority: {
                        type: 'string',
                        enum: ['critical', 'high', 'medium', 'low'],
                        description: '优先级（可选）',
                    },
                    deps: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '依赖任务 ID 列表（可选）',
                    },
                    acceptanceCriteria: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '验收标准列表（可选）',
                    },
                    scopeFiles: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '（可选）任务涉及文件列表（用于并发冲突检测/批量策略）',
                    },
                    scopeModules: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '（可选）任务涉及模块列表（用于并发冲突检测/批量策略）',
                    },
                    scopeTags: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '（可选）任务标签列表（用于批量/过滤/审计）',
                    },
                },
                required: ['taskBookId', 'title', 'type'],
            },
        },
        {
            name: 'taskbook_update_task',
            description: '更新 TaskBook 里的任务字段（JSON）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID' },
                    taskId: { type: 'string', description: 'Task ID（如 task-1）' },
                    ifRevision: { type: 'integer', description: '可选：要求 TaskBook.revision 匹配（避免并发覆盖）' },
                    title: { type: 'string', description: '任务标题（可选）' },
                    status: {
                        type: 'string',
                        enum: ['pending', 'in_progress', 'done', 'blocked', 'skipped'],
                        description: '任务状态（可选）',
                    },
                    priority: {
                        type: 'string',
                        enum: ['critical', 'high', 'medium', 'low'],
                        description: '优先级（可选）',
                    },
                    deps: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '依赖任务 ID 列表（可选）',
                    },
                    acceptanceCriteria: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '验收标准列表（可选，会覆盖）',
                    },
                    scopeFiles: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '（可选）任务涉及文件列表（用于并发冲突检测/批量策略）',
                    },
                    scopeModules: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '（可选）任务涉及模块列表（用于并发冲突检测/批量策略）',
                    },
                    scopeTags: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '（可选）任务标签列表（用于批量/过滤/审计）',
                    },
                    actualWork: { type: 'string', description: '实际工作记录（可选）' },
                    blockedReason: { type: 'string', description: '阻塞原因（可选）' },
                    executedBy: { type: 'string', description: '执行者标识（可选）' },
                },
                required: ['taskBookId', 'taskId'],
            },
        },
        {
            name: 'taskbook_claim',
            description: '认领任务（设置 executedBy）（JSON）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID' },
                    taskId: { type: 'string', description: 'Task ID' },
                    by: { type: 'string', description: '执行者/认领者标识' },
                    ifRevision: { type: 'integer', description: '可选：要求 TaskBook.revision 匹配（避免并发覆盖）' },
                },
                required: ['taskBookId', 'taskId', 'by'],
            },
        },
        {
            name: 'taskbook_append_work',
            description: '追加任务 actualWork 文本（JSON）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID' },
                    taskId: { type: 'string', description: 'Task ID' },
                    text: { type: 'string', description: '追加内容' },
                    ifRevision: { type: 'integer', description: '可选：要求 TaskBook.revision 匹配（避免并发覆盖）' },
                },
                required: ['taskBookId', 'taskId', 'text'],
            },
        },
        {
            name: 'taskbook_report',
            description: '生成 TaskBook 验收/批量/gates 报告（JSON，可选落盘）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID' },
                    write: { type: 'boolean', description: '可选：写入报告文件（默认 false）' },
                    out: { type: 'string', description: '可选：输出路径（等价于 CLI --out）' },
                },
                required: ['taskBookId'],
            },
        },
        {
            name: 'taskbook_unblock',
            description: '解除 blocked 任务并恢复为 pending（JSON）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID' },
                    taskId: { type: 'string', description: 'Task ID' },
                    resolution: { type: 'string', description: '解除阻塞的说明（将写入任务 actualWork）' },
                    ifRevision: { type: 'integer', description: '可选：要求 TaskBook.revision 匹配（避免并发覆盖）' },
                },
                required: ['taskBookId', 'taskId', 'resolution'],
            },
        },
        {
            name: 'workflow_run',
            description: '按 Workflow Spec 执行 TaskBook（会执行 gates；需要时可 approve 跳过人工闸门）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    taskBookId: { type: 'string', description: 'TaskBook ID' },
                    workflowPath: { type: 'string', description: 'workflow 文件路径（可选，默认 .codebuddy/workflows/default.workflow.json）' },
                    approve: { type: 'array', items: { type: 'string' }, description: '手动闸门通过列表（如 tests_passed/review_passed）' },
                    maxParallel: { type: 'number', description: '最大并发任务数（可选）' },
                    tasksOnly: { type: 'boolean', description: '仅执行 TaskBook 任务，不跑 gates（可选）' },
                },
                required: ['taskBookId'],
            },
        },
        {
            name: 'reports_inspect',
            description: '查询模块/文件的上下游、热点与趋势（report-manager.js / reports）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    module: { type: 'string', description: '按模块查询（name/chineseName/routePath/path）' },
                    file: { type: 'string', description: '按文件路径查询（会自动定位所属模块）' },
                    depth: { type: 'integer', description: '依赖图遍历深度（可选，默认 1）' },
                    trendPoints: { type: 'integer', description: '趋势点数（可选，默认 7）' },
                },
            },
        },
        {
            name: 'reports_hotspots',
            description: '列出热点模块（依赖影响/规模/健康度/违规）（report-manager.js / reports）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: '项目根目录（可选，默认当前 workDir）' },
                    top: { type: 'integer', description: '列表长度（可选，默认 10）' },
                },
            },
        },
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const { workDir } = serverState.getState();
    switch (name) {
        case 'ralph_ping': {
            return {
                content: [{ type: 'text', text: `✅ Ralph MCP Server 运行正常\n工作目录: ${workDir}` }],
            };
        }
        case 'ralph_init': {
            const parsed = RalphInitArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const { project, branchName, description } = parsed.data;
            const prd = {
                project,
                branchName,
                description,
                userStories: [],
            };
            await writePrd(workDir, prd);
            await appendProgress(workDir, `## 初始化项目\n- 项目: ${project}\n- 分支: ${branchName}`);
            return {
                content: [
                    {
                        type: 'text',
                        text: `✅ Ralph 项目已初始化\n- 项目: ${project}\n- 分支: ${branchName}\n- prd.json 已创建\n- progress.txt 已创建`,
                    },
                ],
            };
        }
        case 'ralph_status': {
            const parsed = RalphStatusArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const targetDir = parsed.data.workDir ?? workDir;
            const prdResult = await readPrd(targetDir);
            if (!prdResult.success) {
                return { content: [{ type: 'text', text: `❌ ${prdResult.error.message}` }] };
            }
            const prd = prdResult.data;
            const status = getStatus(prd);
            const statusText = `
📊 Ralph 状态
━━━━━━━━━━━━━━━━━━
项目: ${prd.project}
分支: ${prd.branchName}
进度: ${status.completed}/${status.total} 故事已完成

${status.next ? `📌 下一个故事: ${status.next.id} - ${status.next.title}` : '🎉 所有故事已完成！'}
      `.trim();
            return { content: [{ type: 'text', text: statusText }] };
        }
        case 'ralph_next': {
            const prdResult = await readPrd(workDir);
            if (!prdResult.success) {
                return { content: [{ type: 'text', text: `❌ ${prdResult.error.message}` }] };
            }
            const next = getNextStory(prdResult.data);
            if (!next) {
                return {
                    content: [{ type: 'text', text: '🎉 所有故事已完成！\n<promise>COMPLETE</promise>' }],
                };
            }
            const storyText = `
📌 下一个故事: ${next.id}
━━━━━━━━━━━━━━━━━━
标题: ${next.title}
描述: ${next.description}
优先级: ${next.priority}

验收标准:
${next.acceptanceCriteria.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}
${next.notes ? `\n备注: ${next.notes}` : ''}
      `.trim();
            return { content: [{ type: 'text', text: storyText }] };
        }
        case 'ralph_complete': {
            const parsed = RalphCompleteArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const { storyId, notes } = parsed.data;
            const prdResult = await readPrd(workDir);
            if (!prdResult.success) {
                return { content: [{ type: 'text', text: `❌ ${prdResult.error.message}` }] };
            }
            const prd = prdResult.data;
            const story = prd.userStories.find((s) => s.id === storyId);
            if (!story) {
                return { content: [{ type: 'text', text: `❌ 未找到故事: ${storyId}` }] };
            }
            const updatedPrd = markStoryComplete(prd, storyId, notes);
            await writePrd(workDir, updatedPrd);
            const status = getStatus(updatedPrd);
            let result = `✅ 故事 ${storyId} 已标记为完成\n进度: ${status.completed}/${status.total}`;
            if (!status.next) {
                result += '\n\n🎉 所有故事已完成！\n<promise>COMPLETE</promise>';
            }
            return { content: [{ type: 'text', text: result }] };
        }
        case 'ralph_add_story': {
            const parsed = RalphAddStoryArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const { title, description, acceptanceCriteria, priority } = parsed.data;
            const prdResult = await readPrd(workDir);
            if (!prdResult.success) {
                return { content: [{ type: 'text', text: `❌ ${prdResult.error.message}，请先运行 ralph_init` }] };
            }
            const prd = prdResult.data;
            const existingIds = prd.userStories
                .map((s) => parseInt(s.id.replace('US-', ''), 10))
                .filter((n) => !isNaN(n));
            const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
            const nextId = `US-${String(maxId + 1).padStart(3, '0')}`;
            const newStory = {
                id: nextId,
                title,
                description,
                acceptanceCriteria: [...acceptanceCriteria, 'Typecheck passes'],
                priority: priority ?? prd.userStories.length + 1,
                passes: false,
                notes: '',
            };
            const updatedPrd = addStory(prd, newStory);
            await writePrd(workDir, updatedPrd);
            return {
                content: [{ type: 'text', text: `✅ 已添加故事: ${nextId} - ${title}` }],
            };
        }
        case 'ralph_log': {
            const parsed = RalphLogArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const { storyId, summary, filesChanged, learnings } = parsed.data;
            const timestamp = new Date().toISOString();
            let entry = `## ${timestamp} - ${storyId}\n- ${summary}`;
            if (filesChanged?.length) {
                entry += `\n- 修改的文件:\n${filesChanged.map((f) => `  - ${f}`).join('\n')}`;
            }
            if (learnings?.length) {
                entry += `\n- **学习收获:**\n${learnings.map((l) => `  - ${l}`).join('\n')}`;
            }
            await appendProgress(workDir, entry);
            return { content: [{ type: 'text', text: '✅ 进度已记录' }] };
        }
        case 'ralph_set_workdir': {
            const parsed = RalphSetWorkdirArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const validation = await validateDirectory(parsed.data.path);
            if (!validation.valid) {
                return { content: [{ type: 'text', text: `❌ ${validation.error}` }] };
            }
            serverState.updateWorkDir(validation.resolved);
            return {
                content: [{ type: 'text', text: `✅ 工作目录已设置为: ${validation.resolved}` }],
            };
        }
        case 'codebuddy_set_workdir': {
            const parsed = CodebuddySetWorkdirArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const validation = await validateDirectory(parsed.data.path);
            if (!validation.valid) {
                return { content: [{ type: 'text', text: `❌ ${validation.error}` }] };
            }
            serverState.updateWorkDir(validation.resolved);
            return {
                content: [{ type: 'text', text: `✅ CodeBuddy 工作目录已设置为: ${validation.resolved}` }],
            };
        }
        case 'taskbook_create': {
            const parsed = TaskBookCreateArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, [
                    'create',
                    '--title', parsed.data.title,
                    '--description', parsed.data.description,
                    '--type', parsed.data.taskType,
                    '--json',
                ]);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_create 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_list': {
            const parsed = TaskBookListArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, ['list', '--json']);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_list 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_show': {
            const parsed = TaskBookShowArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, ['show', parsed.data.taskBookId, '--json']);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_show 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_confirm': {
            const parsed = TaskBookStatusArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const cliArgs = ['confirm', parsed.data.taskBookId];
                if (typeof parsed.data.ifRevision === 'number') {
                    cliArgs.push('--if-rev', String(parsed.data.ifRevision));
                }
                cliArgs.push('--json');
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_confirm 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_complete': {
            const parsed = TaskBookStatusArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const cliArgs = ['complete', parsed.data.taskBookId];
                if (typeof parsed.data.ifRevision === 'number') {
                    cliArgs.push('--if-rev', String(parsed.data.ifRevision));
                }
                cliArgs.push('--json');
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_complete 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_abort': {
            const parsed = TaskBookStatusArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const cliArgs = ['abort', parsed.data.taskBookId];
                if (typeof parsed.data.ifRevision === 'number') {
                    cliArgs.push('--if-rev', String(parsed.data.ifRevision));
                }
                cliArgs.push('--json');
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_abort 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_add_task': {
            const parsed = TaskBookAddTaskArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            const cliArgs = [
                'add-task',
                parsed.data.taskBookId,
                '--title', parsed.data.title,
                '--type', parsed.data.type,
            ];
            if (parsed.data.priority) {
                cliArgs.push('--priority', parsed.data.priority);
            }
            if (parsed.data.deps?.length) {
                cliArgs.push('--deps', parsed.data.deps.join(','));
            }
            if (parsed.data.acceptanceCriteria?.length) {
                for (const ac of parsed.data.acceptanceCriteria) {
                    cliArgs.push('--ac', ac);
                }
            }
            if (parsed.data.scopeFiles?.length) {
                cliArgs.push('--files', parsed.data.scopeFiles.join(','));
            }
            if (parsed.data.scopeModules?.length) {
                cliArgs.push('--modules', parsed.data.scopeModules.join(','));
            }
            if (parsed.data.scopeTags?.length) {
                cliArgs.push('--tags', parsed.data.scopeTags.join(','));
            }
            if (typeof parsed.data.ifRevision === 'number') {
                cliArgs.push('--if-rev', String(parsed.data.ifRevision));
            }
            cliArgs.push('--json');
            try {
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_add_task 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_update_task': {
            const parsed = TaskBookUpdateTaskArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            const cliArgs = ['update-task', parsed.data.taskBookId, parsed.data.taskId];
            if (parsed.data.title)
                cliArgs.push('--title', parsed.data.title);
            if (parsed.data.status)
                cliArgs.push('--status', parsed.data.status);
            if (parsed.data.priority)
                cliArgs.push('--priority', parsed.data.priority);
            if (parsed.data.deps?.length)
                cliArgs.push('--deps', parsed.data.deps.join(','));
            if (parsed.data.acceptanceCriteria?.length) {
                for (const ac of parsed.data.acceptanceCriteria) {
                    cliArgs.push('--ac', ac);
                }
            }
            if (parsed.data.scopeFiles?.length)
                cliArgs.push('--files', parsed.data.scopeFiles.join(','));
            if (parsed.data.scopeModules?.length)
                cliArgs.push('--modules', parsed.data.scopeModules.join(','));
            if (parsed.data.scopeTags?.length)
                cliArgs.push('--tags', parsed.data.scopeTags.join(','));
            if (parsed.data.actualWork)
                cliArgs.push('--actual-work', parsed.data.actualWork);
            if (parsed.data.blockedReason)
                cliArgs.push('--blocked-reason', parsed.data.blockedReason);
            if (parsed.data.executedBy)
                cliArgs.push('--executed-by', parsed.data.executedBy);
            if (typeof parsed.data.ifRevision === 'number')
                cliArgs.push('--if-rev', String(parsed.data.ifRevision));
            cliArgs.push('--json');
            try {
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_update_task 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_claim': {
            const parsed = TaskBookClaimArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const cliArgs = ['claim', parsed.data.taskBookId, parsed.data.taskId, '--by', parsed.data.by];
                if (typeof parsed.data.ifRevision === 'number') {
                    cliArgs.push('--if-rev', String(parsed.data.ifRevision));
                }
                cliArgs.push('--json');
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_claim 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_append_work': {
            const parsed = TaskBookAppendWorkArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const cliArgs = [
                    'append-work',
                    parsed.data.taskBookId,
                    parsed.data.taskId,
                    '--text', parsed.data.text,
                ];
                if (typeof parsed.data.ifRevision === 'number') {
                    cliArgs.push('--if-rev', String(parsed.data.ifRevision));
                }
                cliArgs.push('--json');
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_append_work 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_report': {
            const parsed = TaskBookReportArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const cliArgs = ['report', parsed.data.taskBookId];
                if (parsed.data.write)
                    cliArgs.push('--write');
                if (parsed.data.out)
                    cliArgs.push('--out', parsed.data.out);
                cliArgs.push('--json');
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_report 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'taskbook_unblock': {
            const parsed = TaskBookUnblockArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'taskbook-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const cliArgs = [
                    'unblock',
                    parsed.data.taskBookId,
                    parsed.data.taskId,
                    '--resolution', parsed.data.resolution,
                ];
                if (typeof parsed.data.ifRevision === 'number') {
                    cliArgs.push('--if-rev', String(parsed.data.ifRevision));
                }
                cliArgs.push('--json');
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ taskbook_unblock 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'reports_inspect': {
            const parsed = ReportsInspectArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'report-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const cliArgs = ['inspect'];
                if (parsed.data.module)
                    cliArgs.push('--module', parsed.data.module);
                if (parsed.data.file)
                    cliArgs.push('--file', parsed.data.file);
                if (typeof parsed.data.depth === 'number')
                    cliArgs.push('--depth', String(parsed.data.depth));
                if (typeof parsed.data.trendPoints === 'number')
                    cliArgs.push('--trend', String(parsed.data.trendPoints));
                cliArgs.push('--json');
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ reports_inspect 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'reports_hotspots': {
            const parsed = ReportsHotspotsArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'report-manager.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            try {
                const top = typeof parsed.data.top === 'number' ? parsed.data.top : 10;
                const cliArgs = ['hotspots', '--top', String(top), '--json'];
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs);
                return { content: [{ type: 'text', text: output }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ reports_hotspots 执行失败\n${formatExecError(error)}` }] };
            }
        }
        case 'workflow_run': {
            const parsed = WorkflowRunArgsSchema.safeParse(args);
            if (!parsed.success) {
                return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
            }
            const dirResult = await resolveProjectDir(parsed.data.projectPath, workDir);
            if (!dirResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${dirResult.error}` }] };
            }
            const scriptResult = await resolveCodebuddyScript(dirResult.dir, 'task-executor.js');
            if (!scriptResult.ok) {
                return { content: [{ type: 'text', text: `❌ ${scriptResult.error}` }] };
            }
            const cliArgs = [parsed.data.taskBookId];
            if (parsed.data.workflowPath) {
                cliArgs.push('--workflow', parsed.data.workflowPath);
            }
            if (parsed.data.approve?.length) {
                for (const gateId of parsed.data.approve) {
                    cliArgs.push('--approve', gateId);
                }
            }
            if (parsed.data.maxParallel) {
                cliArgs.push('--max-parallel', String(parsed.data.maxParallel));
            }
            if (parsed.data.tasksOnly) {
                cliArgs.push('--tasks-only');
            }
            try {
                const output = execCodebuddyScript(dirResult.dir, scriptResult.scriptPath, cliArgs, { timeoutMs: 20 * 60 * 1000 });
                return { content: [{ type: 'text', text: output || '✅ workflow_run completed' }] };
            }
            catch (error) {
                return { content: [{ type: 'text', text: `❌ workflow_run 执行失败\n${formatExecError(error)}` }] };
            }
        }
        default:
            // 处理 analyze_project_structure 工具
            if (name === 'analyze_project_structure') {
                const parsed = AnalyzeProjectStructureArgsSchema.safeParse(args);
                if (!parsed.success) {
                    return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] };
                }
                const { projectPath, mode, maxDepth, limitTopFiles } = parsed.data;
                // 验证路径
                const validation = await validateDirectory(projectPath);
                if (!validation.valid) {
                    return { content: [{ type: 'text', text: `❌ ${validation.error}` }] };
                }
                try {
                    // 获取 structure-analyzer 脚本路径
                    const scriptPath = resolveBundledScriptPath('../../scripts/dist/structure-analyzer.js');
                    // 构建命令
                    const cmd = `node "${scriptPath}" "${validation.resolved}" --mode ${mode} --max-depth ${maxDepth} --limit ${limitTopFiles} --output json`;
                    // 执行分析
                    const output = execSync(cmd, {
                        encoding: 'utf-8',
                        timeout: 60000, // 60秒超时
                        maxBuffer: 10 * 1024 * 1024 // 10MB 缓冲
                    });
                    // 解析 JSON 结果
                    const result = JSON.parse(output);
                    // 根据 mode 控制输出大小
                    let responseText = '';
                    if (mode === 'problems_only') {
                        // 最精简模式：仅返回违规项和评分
                        responseText = `📊 结构分析结果

**项目**: ${result.projectName}
**健康度评分**: ${result.scores.total}/100
**配置来源**: ${result.configSource}

**分项得分**:
- 特性结构: ${result.scores.breakdown.featureStructure}/25
- 目录深度: ${result.scores.breakdown.depth}/25
- 文件大小: ${result.scores.breakdown.fileSize}/25
- 命名规范: ${result.scores.breakdown.naming}/25

**违规项** (${result.violations.length} 个):
${result.violations.slice(0, 20).map((v) => `- [${v.severity}] ${v.code}: ${v.message} (${path.basename(v.path)})`).join('\n')}
${result.violations.length > 20 ? `\n... 还有 ${result.violations.length - 20} 个问题` : ''}`;
                    }
                    else if (mode === 'summary') {
                        // 摘要模式：包含统计信息
                        responseText = `📊 结构分析结果

**项目**: ${result.projectName}
**健康度评分**: ${result.scores.total}/100
**分析时间**: ${result.analyzedAt}
**配置来源**: ${result.configSource}

**统计**:
- 总文件数: ${result.summary.totalFiles}
- 总目录数: ${result.summary.totalDirectories}
- 最大深度: ${result.summary.maxDepth}

**分项得分**:
- 特性结构: ${result.scores.breakdown.featureStructure}/25
- 目录深度: ${result.scores.breakdown.depth}/25
- 文件大小: ${result.scores.breakdown.fileSize}/25
- 命名规范: ${result.scores.breakdown.naming}/25

**最大文件 Top 5**:
${result.summary.topLargestFiles.slice(0, 5).map((f) => `- ${path.basename(f.path)}: ${f.lines} 行, ${f.sizeKB}KB`).join('\n')}

**违规项** (${result.violations.length} 个):
${result.violations.slice(0, 30).map((v) => `- [${v.severity}] ${v.code}: ${v.message}\n  位置: ${v.path}\n  建议: ${v.suggestion}`).join('\n\n')}
${result.violations.length > 30 ? `\n... 还有 ${result.violations.length - 30} 个问题` : ''}`;
                    }
                    else {
                        // full 模式：返回完整 JSON
                        responseText = JSON.stringify(result, null, 2);
                    }
                    return { content: [{ type: 'text', text: responseText }] };
                }
                catch (error) {
                    const errMsg = error instanceof Error ? error.message : String(error);
                    if (errMsg.includes('ETIMEDOUT') || errMsg.includes('timeout')) {
                        return { content: [{ type: 'text', text: `❌ 分析超时，项目可能过大。请尝试减小 maxDepth 参数。` }] };
                    }
                    return { content: [{ type: 'text', text: `❌ 分析失败: ${errMsg}` }] };
                }
            }
            return { content: [{ type: 'text', text: `❌ 未知工具: ${name}` }] };
    }
});
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: [
            {
                uri: 'ralph://prd',
                name: 'prd.json',
                description: 'Ralph PRD 配置文件',
                mimeType: 'application/json',
            },
            {
                uri: 'ralph://progress',
                name: 'progress.txt',
                description: 'Ralph 进度日志',
                mimeType: 'text/plain',
            },
            {
                uri: 'codebuddy://workdir',
                name: 'workDir',
                description: 'CodeBuddy 当前工作目录（SSOT 所在目录）',
                mimeType: 'text/plain',
            },
            {
                uri: 'codebuddy://workflows/schema',
                name: 'workflow.schema.json',
                description: 'Workflow Spec JSON Schema',
                mimeType: 'application/json',
            },
            {
                uri: 'codebuddy://workflows/list',
                name: 'workflows',
                description: 'Workflow 列表（JSON）',
                mimeType: 'application/json',
            },
            {
                uri: 'codebuddy://taskbooks/schema',
                name: 'taskbook.schema.json',
                description: 'TaskBook JSON Schema',
                mimeType: 'application/json',
            },
            {
                uri: 'codebuddy://taskbooks/active',
                name: 'taskbooks.active',
                description: 'Active TaskBooks 列表（JSON）',
                mimeType: 'application/json',
            },
            {
                uri: 'codebuddy://taskbooks/history',
                name: 'taskbooks.history',
                description: 'History TaskBooks 列表（JSON）',
                mimeType: 'application/json',
            },
        ] };
});
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const { workDir } = serverState.getState();
    if (uri.startsWith('codebuddy://')) {
        const url = new URL(uri);
        const host = url.hostname;
        const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
        const readTextFile = async (absPath, mimeType) => {
            const text = await fs.readFile(absPath, 'utf-8');
            return { contents: [{ uri, mimeType, text }] };
        };
        const safeBasename = (name) => {
            const base = path.basename(name);
            if (base !== name) {
                throw new Error(`Invalid resource name: ${name}`);
            }
            if (base.includes('..')) {
                throw new Error(`Invalid resource name: ${name}`);
            }
            return base;
        };
        if (host === 'workdir') {
            return { contents: [{ uri, mimeType: 'text/plain', text: workDir }] };
        }
        if (host === 'workflows') {
            const workflowsDir = path.join(workDir, '.codebuddy', 'workflows');
            if (segments[0] === 'schema') {
                return readTextFile(path.join(workflowsDir, 'workflow.schema.json'), 'application/json');
            }
            if (segments[0] === 'list') {
                const entries = await fs.readdir(workflowsDir, { withFileTypes: true });
                const files = entries
                    .filter((e) => e.isFile())
                    .map((e) => e.name)
                    .filter((name) => name.endsWith('.json'))
                    .filter((name) => name !== 'workflow.schema.json');
                return {
                    contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ files }, null, 2) }],
                };
            }
            if (segments[0] === 'file') {
                const fileName = safeBasename(segments[1] ?? '');
                return readTextFile(path.join(workflowsDir, fileName), 'application/json');
            }
            throw new Error(`Unknown CodeBuddy workflows resource: ${uri}`);
        }
        if (host === 'taskbooks') {
            const taskbooksDir = path.join(workDir, '.codebuddy', 'taskbooks');
            if (segments[0] === 'schema') {
                return readTextFile(path.join(taskbooksDir, 'taskbook.schema.json'), 'application/json');
            }
            const listTaskbooks = async (dirName) => {
                const dir = path.join(taskbooksDir, dirName);
                const entries = await fs.readdir(dir, { withFileTypes: true });
                const files = entries
                    .filter((e) => e.isFile())
                    .map((e) => e.name)
                    .filter((name) => name.endsWith('.json'))
                    .slice(0, 200);
                const items = [];
                for (const f of files) {
                    const abs = path.join(dir, f);
                    try {
                        const raw = await fs.readFile(abs, 'utf-8');
                        const data = JSON.parse(raw);
                        items.push({
                            id: data?.id ?? f.replace(/\\.json$/i, ''),
                            title: data?.title ?? '',
                            status: data?.status ?? '',
                            taskType: data?.taskType ?? '',
                            revision: typeof data?.revision === 'number' ? data.revision : 0,
                            updatedAt: data?.updatedAt ?? null,
                            createdAt: data?.createdAt ?? null,
                        });
                    }
                    catch (error) {
                        items.push({
                            id: f.replace(/\\.json$/i, ''),
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                }
                return {
                    contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ dir: dirName, items }, null, 2) }],
                };
            };
            if (segments[0] === 'active') {
                if (!segments[1])
                    return listTaskbooks('active');
                const id = safeBasename(segments[1]);
                return readTextFile(path.join(taskbooksDir, 'active', `${id}.json`), 'application/json');
            }
            if (segments[0] === 'history') {
                if (!segments[1])
                    return listTaskbooks('history');
                const id = safeBasename(segments[1]);
                return readTextFile(path.join(taskbooksDir, 'history', `${id}.json`), 'application/json');
            }
            throw new Error(`Unknown CodeBuddy taskbooks resource: ${uri}`);
        }
        throw new Error(`Unknown CodeBuddy resource host: ${host}`);
    }
    switch (uri) {
        case 'ralph://prd': {
            const prdResult = await readPrd(workDir);
            return {
                contents: [
                    {
                        uri,
                        mimeType: 'application/json',
                        text: prdResult.success ? JSON.stringify(prdResult.data, null, 2) : '{}',
                    },
                ],
            };
        }
        case 'ralph://progress': {
            const progress = await readProgress(workDir);
            return {
                contents: [
                    {
                        uri,
                        mimeType: 'text/plain',
                        text: progress || '(empty)',
                    },
                ],
            };
        }
        default:
            throw new Error(`Unknown resource: ${uri}`);
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('FE Standards MCP Server 已启动');
}
if (isDirectExecutionEntry()) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map