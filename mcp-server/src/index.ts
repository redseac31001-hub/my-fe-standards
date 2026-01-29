#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'
import { execSync } from 'child_process'

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
})

const PrdConfigSchema = z.object({
  project: z.string(),
  branchName: z.string(),
  description: z.string(),
  userStories: z.array(UserStorySchema),
})

type UserStory = z.infer<typeof UserStorySchema>
type PrdConfig = z.infer<typeof PrdConfigSchema>

// 工具参数 Schema
const RalphInitArgsSchema = z.object({
  project: z.string().min(1, '项目名称不能为空'),
  branchName: z.string().min(1, '分支名称不能为空'),
  description: z.string(),
})

const RalphStatusArgsSchema = z.object({
  workDir: z.string().optional(),
})

const RalphCompleteArgsSchema = z.object({
  storyId: z.string().min(1, '故事 ID 不能为空'),
  notes: z.string().optional(),
})

const RalphAddStoryArgsSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()).min(1, '至少需要一个验收标准'),
  priority: z.number().int().positive().optional(),
})

const RalphLogArgsSchema = z.object({
  storyId: z.string(),
  summary: z.string(),
  filesChanged: z.array(z.string()).optional(),
  learnings: z.array(z.string()).optional(),
})

const RalphSetWorkdirArgsSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
})

// Structure Analyzer 参数 Schema
const AnalyzeProjectStructureArgsSchema = z.object({
  projectPath: z.string().min(1, '项目路径不能为空'),
  mode: z.enum(['problems_only', 'summary', 'full']).optional().default('problems_only'),
  maxDepth: z.number().int().positive().optional().default(5),
  limitTopFiles: z.number().int().positive().optional().default(20),
})

// ============================================================
// 服务器状态（使用闭包封装，避免全局可变状态）
// ============================================================

interface ServerState {
  readonly workDir: string
}

function createServerState(initialWorkDir: string): {
  getState: () => ServerState
  updateWorkDir: (newDir: string) => void
} {
  let state: ServerState = { workDir: initialWorkDir }

  return {
    getState: () => state,
    updateWorkDir: (newDir: string) => {
      state = { ...state, workDir: newDir }
    },
  }
}

const serverState = createServerState(process.cwd())

// ============================================================
// 辅助函数（纯函数，无副作用）
// ============================================================

type PrdReadResult = {
  success: true
  data: PrdConfig
} | {
  success: false
  error: { type: 'NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN'; message: string }
}

async function readPrd(workDir: string): Promise<PrdReadResult> {
  const prdPath = path.join(workDir, 'prd.json')

  try {
    const content = await fs.readFile(prdPath, 'utf-8')
    const parsed = JSON.parse(content)
    const validated = PrdConfigSchema.parse(parsed)
    return { success: true, data: validated }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { success: false, error: { type: 'NOT_FOUND', message: 'prd.json 不存在' } }
    }
    if (error instanceof SyntaxError) {
      return { success: false, error: { type: 'PARSE_ERROR', message: 'prd.json JSON 格式无效' } }
    }
    if (error instanceof z.ZodError) {
      return { success: false, error: { type: 'VALIDATION_ERROR', message: `prd.json 结构无效: ${error.message}` } }
    }
    return { success: false, error: { type: 'UNKNOWN', message: String(error) } }
  }
}

async function writePrd(workDir: string, prd: PrdConfig): Promise<void> {
  const prdPath = path.join(workDir, 'prd.json')
  await fs.writeFile(prdPath, JSON.stringify(prd, null, 2), 'utf-8')
}

async function readProgress(workDir: string): Promise<string> {
  try {
    const progressPath = path.join(workDir, 'progress.txt')
    return await fs.readFile(progressPath, 'utf-8')
  } catch {
    return ''
  }
}

async function appendProgress(workDir: string, entry: string): Promise<void> {
  const progressPath = path.join(workDir, 'progress.txt')
  let content = await readProgress(workDir)
  if (!content) {
    content = `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`
  }
  content += `\n${entry}\n---\n`
  await fs.writeFile(progressPath, content, 'utf-8')
}

function getNextStory(prd: PrdConfig): UserStory | null {
  const pending = prd.userStories
    .filter((s) => !s.passes)
    .sort((a, b) => a.priority - b.priority)
  return pending[0] ?? null
}

function getStatus(prd: PrdConfig): { completed: number; total: number; next: UserStory | null } {
  const completed = prd.userStories.filter((s) => s.passes).length
  const total = prd.userStories.length
  const next = getNextStory(prd)
  return { completed, total, next }
}

function markStoryComplete(prd: PrdConfig, storyId: string, notes?: string): PrdConfig {
  return {
    ...prd,
    userStories: prd.userStories.map((s) =>
      s.id === storyId
        ? { ...s, passes: true, notes: notes ?? s.notes }
        : s
    ),
  }
}

function addStory(prd: PrdConfig, story: UserStory): PrdConfig {
  return {
    ...prd,
    userStories: [...prd.userStories, story],
  }
}

async function validateDirectory(dirPath: string): Promise<{ valid: true; resolved: string } | { valid: false; error: string }> {
  try {
    const resolved = path.resolve(dirPath)
    const stats = await fs.stat(resolved)
    if (!stats.isDirectory()) {
      return { valid: false, error: `路径不是目录: ${resolved}` }
    }
    return { valid: true, resolved }
  } catch {
    return { valid: false, error: `无法访问目录: ${dirPath}` }
  }
}

// ============================================================
// MCP 服务器定义
// ============================================================

const server = new Server(
  {
    name: 'fe-standards-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
)

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
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const { workDir } = serverState.getState()

  switch (name) {
    case 'ralph_ping': {
      return {
        content: [{ type: 'text', text: `✅ Ralph MCP Server 运行正常\n工作目录: ${workDir}` }],
      }
    }

    case 'ralph_init': {
      const parsed = RalphInitArgsSchema.safeParse(args)
      if (!parsed.success) {
        return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] }
      }
      const { project, branchName, description } = parsed.data

      const prd: PrdConfig = {
        project,
        branchName,
        description,
        userStories: [],
      }
      await writePrd(workDir, prd)
      await appendProgress(workDir, `## 初始化项目\n- 项目: ${project}\n- 分支: ${branchName}`)
      return {
        content: [
          {
            type: 'text',
            text: `✅ Ralph 项目已初始化\n- 项目: ${project}\n- 分支: ${branchName}\n- prd.json 已创建\n- progress.txt 已创建`,
          },
        ],
      }
    }

    case 'ralph_status': {
      const parsed = RalphStatusArgsSchema.safeParse(args)
      if (!parsed.success) {
        return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] }
      }

      const targetDir = parsed.data.workDir ?? workDir
      const prdResult = await readPrd(targetDir)

      if (!prdResult.success) {
        return { content: [{ type: 'text', text: `❌ ${prdResult.error.message}` }] }
      }

      const prd = prdResult.data
      const status = getStatus(prd)
      const statusText = `
📊 Ralph 状态
━━━━━━━━━━━━━━━━━━
项目: ${prd.project}
分支: ${prd.branchName}
进度: ${status.completed}/${status.total} 故事已完成

${status.next ? `📌 下一个故事: ${status.next.id} - ${status.next.title}` : '🎉 所有故事已完成！'}
      `.trim()
      return { content: [{ type: 'text', text: statusText }] }
    }

    case 'ralph_next': {
      const prdResult = await readPrd(workDir)
      if (!prdResult.success) {
        return { content: [{ type: 'text', text: `❌ ${prdResult.error.message}` }] }
      }

      const next = getNextStory(prdResult.data)
      if (!next) {
        return {
          content: [{ type: 'text', text: '🎉 所有故事已完成！\n<promise>COMPLETE</promise>' }],
        }
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
      `.trim()
      return { content: [{ type: 'text', text: storyText }] }
    }

    case 'ralph_complete': {
      const parsed = RalphCompleteArgsSchema.safeParse(args)
      if (!parsed.success) {
        return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] }
      }
      const { storyId, notes } = parsed.data

      const prdResult = await readPrd(workDir)
      if (!prdResult.success) {
        return { content: [{ type: 'text', text: `❌ ${prdResult.error.message}` }] }
      }

      const prd = prdResult.data
      const story = prd.userStories.find((s) => s.id === storyId)
      if (!story) {
        return { content: [{ type: 'text', text: `❌ 未找到故事: ${storyId}` }] }
      }

      const updatedPrd = markStoryComplete(prd, storyId, notes)
      await writePrd(workDir, updatedPrd)

      const status = getStatus(updatedPrd)
      let result = `✅ 故事 ${storyId} 已标记为完成\n进度: ${status.completed}/${status.total}`
      if (!status.next) {
        result += '\n\n🎉 所有故事已完成！\n<promise>COMPLETE</promise>'
      }
      return { content: [{ type: 'text', text: result }] }
    }

    case 'ralph_add_story': {
      const parsed = RalphAddStoryArgsSchema.safeParse(args)
      if (!parsed.success) {
        return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] }
      }
      const { title, description, acceptanceCriteria, priority } = parsed.data

      const prdResult = await readPrd(workDir)
      if (!prdResult.success) {
        return { content: [{ type: 'text', text: `❌ ${prdResult.error.message}，请先运行 ralph_init` }] }
      }

      const prd = prdResult.data

      const existingIds = prd.userStories
        .map((s) => parseInt(s.id.replace('US-', ''), 10))
        .filter((n) => !isNaN(n))
      const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0
      const nextId = `US-${String(maxId + 1).padStart(3, '0')}`

      const newStory: UserStory = {
        id: nextId,
        title,
        description,
        acceptanceCriteria: [...acceptanceCriteria, 'Typecheck passes'],
        priority: priority ?? prd.userStories.length + 1,
        passes: false,
        notes: '',
      }

      const updatedPrd = addStory(prd, newStory)
      await writePrd(workDir, updatedPrd)

      return {
        content: [{ type: 'text', text: `✅ 已添加故事: ${nextId} - ${title}` }],
      }
    }

    case 'ralph_log': {
      const parsed = RalphLogArgsSchema.safeParse(args)
      if (!parsed.success) {
        return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] }
      }
      const { storyId, summary, filesChanged, learnings } = parsed.data

      const timestamp = new Date().toISOString()
      let entry = `## ${timestamp} - ${storyId}\n- ${summary}`
      if (filesChanged?.length) {
        entry += `\n- 修改的文件:\n${filesChanged.map((f) => `  - ${f}`).join('\n')}`
      }
      if (learnings?.length) {
        entry += `\n- **学习收获:**\n${learnings.map((l) => `  - ${l}`).join('\n')}`
      }
      await appendProgress(workDir, entry)
      return { content: [{ type: 'text', text: '✅ 进度已记录' }] }
    }

    case 'ralph_set_workdir': {
      const parsed = RalphSetWorkdirArgsSchema.safeParse(args)
      if (!parsed.success) {
        return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] }
      }

      const validation = await validateDirectory(parsed.data.path)
      if (!validation.valid) {
        return { content: [{ type: 'text', text: `❌ ${validation.error}` }] }
      }

      serverState.updateWorkDir(validation.resolved)
      return {
        content: [{ type: 'text', text: `✅ 工作目录已设置为: ${validation.resolved}` }],
      }
    }

    default:
      // 处理 analyze_project_structure 工具
      if (name === 'analyze_project_structure') {
        const parsed = AnalyzeProjectStructureArgsSchema.safeParse(args)
        if (!parsed.success) {
          return { content: [{ type: 'text', text: `❌ 参数错误: ${parsed.error.message}` }] }
        }

        const { projectPath, mode, maxDepth, limitTopFiles } = parsed.data

        // 验证路径
        const validation = await validateDirectory(projectPath)
        if (!validation.valid) {
          return { content: [{ type: 'text', text: `❌ ${validation.error}` }] }
        }

        try {
          // 获取 structure-analyzer 脚本路径
          const scriptPath = path.resolve(__dirname, '../../scripts/dist/structure-analyzer.js')

          // 构建命令
          const cmd = `node "${scriptPath}" "${validation.resolved}" --mode ${mode} --max-depth ${maxDepth} --limit ${limitTopFiles} --output json`

          // 执行分析
          const output = execSync(cmd, {
            encoding: 'utf-8',
            timeout: 60000, // 60秒超时
            maxBuffer: 10 * 1024 * 1024 // 10MB 缓冲
          })

          // 解析 JSON 结果
          const result = JSON.parse(output)

          // 根据 mode 控制输出大小
          let responseText = ''

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
${result.violations.slice(0, 20).map((v: { severity: string; code: string; message: string; path: string }) =>
  `- [${v.severity}] ${v.code}: ${v.message} (${path.basename(v.path)})`
).join('\n')}
${result.violations.length > 20 ? `\n... 还有 ${result.violations.length - 20} 个问题` : ''}`
          } else if (mode === 'summary') {
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
${result.summary.topLargestFiles.slice(0, 5).map((f: { path: string; lines: number; sizeKB: number }) =>
  `- ${path.basename(f.path)}: ${f.lines} 行, ${f.sizeKB}KB`
).join('\n')}

**违规项** (${result.violations.length} 个):
${result.violations.slice(0, 30).map((v: { severity: string; code: string; message: string; path: string; suggestion: string }) =>
  `- [${v.severity}] ${v.code}: ${v.message}\n  位置: ${v.path}\n  建议: ${v.suggestion}`
).join('\n\n')}
${result.violations.length > 30 ? `\n... 还有 ${result.violations.length - 30} 个问题` : ''}`
          } else {
            // full 模式：返回完整 JSON
            responseText = JSON.stringify(result, null, 2)
          }

          return { content: [{ type: 'text', text: responseText }] }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          if (errMsg.includes('ETIMEDOUT') || errMsg.includes('timeout')) {
            return { content: [{ type: 'text', text: `❌ 分析超时，项目可能过大。请尝试减小 maxDepth 参数。` }] }
          }
          return { content: [{ type: 'text', text: `❌ 分析失败: ${errMsg}` }] }
        }
      }

      return { content: [{ type: 'text', text: `❌ 未知工具: ${name}` }] }
  }
})

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
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
  ],
}))

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params
  const { workDir } = serverState.getState()

  switch (uri) {
    case 'ralph://prd': {
      const prdResult = await readPrd(workDir)
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: prdResult.success ? JSON.stringify(prdResult.data, null, 2) : '{}',
          },
        ],
      }
    }
    case 'ralph://progress': {
      const progress = await readProgress(workDir)
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: progress || '(empty)',
          },
        ],
      }
    }
    default:
      throw new Error(`Unknown resource: ${uri}`)
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('FE Standards MCP Server 已启动')
}

main().catch(console.error)
