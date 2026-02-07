# Agent 接入与自调用系统设计方案

> 落地进度以 `docs/HANDOFF.md` 为准；本文保留“设计 → 实现”的思考链路，用于解释为什么选择 **CLI 核心能力 + Prompt 扩展能力 + 文件协议桥接** 的架构。

## 1. 项目现状分析

### 1.1 已实现的核心功能

| 组件 | 文件 | 功能 |
|------|------|------|
| **规则加载器** | `scripts/src/codebuddy-loader.ts` | 三层规则架构、远程/本地模式、分发 Skills/Agents/Scripts |
| **TaskBook 管理** | `scripts/src/taskbook-manager.ts` | 任务书 CRUD、状态管理、变更日志、并发锁 |
| **任务执行器** | `scripts/src/task-executor.ts` | Workflow 驱动执行、批量处理、质量闸门 |
| **Workflow 规范** | `workflows/templates/default.workflow.json` | 完整工作流定义（analyze→plan→implement→review→test→acceptance） |
| **Agent 定义** | `agents/*/AGENT.md` | 5 个 Agent（task-orchestrator, structure-analyzer, security-reviewer, performance-profiler, planner） |

### 1.2 当前架构缺口

1. **Agent 调用仍依赖外部执行** - `task-executor.ts` 通过 `MANUAL_REQUIRED → agent-call(prompt/result) → resume` 已实现可恢复闭环，但尚无“内置 LLM runner”自动执行 prompt 的能力
2. **Registry 仍是 MVP** - 已有 `agent-registry`（扫描 AGENT.md 元数据），但尚未接入能力匹配/自动选 Agent
3. **通信协议仍需统一** - 已有 agent-call result.json schema + validator，但尚无更通用的 agent-to-agent 结构化调用层
4. **生命周期仍可加强** - TaskBook/agent-call 已可审计与恢复（含 orchestrator --watch），但缺少系统化的超时/重试/并发路由策略

---

## 2. 设计目标

### 2.1 核心目标

1. **业务项目接入** - 业务项目通过 `codebuddy-loader` 获取 Agent 能力
2. **Agent 自调用** - Agent 可以调用其他 Agent 完成子任务
3. **全流程闭环** - 设计→开发→验证→发布的完整自动化

### 2.2 设计原则

- **零依赖** - 编译后的 JS 仅使用 Node.js 内置模块
- **渐进式** - 支持从手动到全自动的渐进式采用
- **可观测** - 所有 Agent 执行过程可追踪、可审计
- **可恢复** - 支持中断后恢复执行

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     业务项目 (.codebuddy/)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Skills    │  │   Agents    │  │  Workflows  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                     Agent Runtime Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Registry   │  │  Executor   │  │ Orchestrator│              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                     Core Infrastructure                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  TaskBook   │  │   Reports   │  │   Context   │              │
│  │  Manager    │  │   Manager   │  │   Manager   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 新增组件

| 组件 | 文件 | 职责 |
|------|------|------|
| **Agent Registry** | `scripts/src/agent-registry.ts` | Agent 注册、发现、能力匹配 |
| **Agent Executor** | `scripts/src/agent-executor.ts` | Agent 实际调用、结果收集 |
| **Agent Protocol** | `scripts/src/types/agent-protocol.ts` | 标准化输入/输出格式 |
| **Context Manager** | `scripts/src/context-manager.ts` | 上下文传递、快照管理 |

---

## 4. 详细设计

### 4.1 Agent Protocol（Agent 协议）

```typescript
// scripts/src/types/agent-protocol.ts

/** Agent 能力声明 */
interface AgentCapability {
  id: string;                    // agent-id
  name: string;                  // 显示名称
  description: string;           // 描述
  version: string;               // 版本
  triggers: string[];            // 触发词
  taskTypes: TaskType[];         // 支持的任务类型
  permissions: string[];         // 所需权限
  dependencies?: string[];       // 依赖的其他 Agent
}

/** Agent 调用请求 */
interface AgentRequest {
  requestId: string;             // 请求 ID
  agentId: string;               // 目标 Agent
  taskBookId: string;            // 关联的 TaskBook
  taskId?: string;               // 关联的任务
  input: {
    type: 'task' | 'query' | 'action';
    payload: unknown;
  };
  context: AgentContext;         // 执行上下文
  options?: {
    timeout?: number;
    retries?: number;
    async?: boolean;
  };
}

/** Agent 执行上下文 */
interface AgentContext {
  projectRoot: string;           // 项目根目录
  taskBook?: TaskBook;           // 当前 TaskBook
  reports?: ReportManifest;      // 项目报告
  parentAgent?: string;          // 父 Agent（用于链式调用）
  callStack: string[];           // 调用栈（防止循环调用）
  sharedState?: Record<string, unknown>;  // 共享状态
}

/** Agent 执行结果 */
interface AgentResponse {
  requestId: string;
  agentId: string;
  status: 'success' | 'failed' | 'blocked' | 'timeout';
  output?: {
    type: 'result' | 'artifact' | 'report';
    payload: unknown;
  };
  artifacts?: AgentArtifact[];   // 产出物
  childCalls?: AgentCallRecord[]; // 子 Agent 调用记录
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  metrics?: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
}

/** Agent 产出物 */
interface AgentArtifact {
  type: 'file' | 'report' | 'code' | 'test';
  path: string;
  description: string;
}
```

### 4.2 Agent Registry（Agent 注册表）

```typescript
// scripts/src/agent-registry.ts

class AgentRegistry {
  private agents: Map<string, AgentCapability>;
  private localAgentsDir: string;

  /** 扫描并注册所有 Agent */
  async scanAndRegister(): Promise<void>;

  /** 根据任务类型查找匹配的 Agent */
  findByTaskType(taskType: TaskType): AgentCapability[];

  /** 根据触发词查找 Agent */
  findByTrigger(trigger: string): AgentCapability | null;

  /** 获取 Agent 定义文件路径 */
  getAgentPath(agentId: string): string;

  /** 检查 Agent 依赖是否满足 */
  checkDependencies(agentId: string): { satisfied: boolean; missing: string[] };
}
```

### 4.3 Agent Executor（Agent 执行器）

```typescript
// scripts/src/agent-executor.ts

class AgentExecutor {
  private registry: AgentRegistry;
  private contextManager: ContextManager;
  private taskBookManager: TaskBookManager;

  /** 执行 Agent */
  async execute(request: AgentRequest): Promise<AgentResponse>;

  /** 执行 Agent 链（多个 Agent 顺序执行） */
  async executeChain(requests: AgentRequest[]): Promise<AgentResponse[]>;

  /** 并行执行多个 Agent */
  async executeParallel(requests: AgentRequest[]): Promise<AgentResponse[]>;

  /** 生成 Agent 调用的 Prompt */
  private generatePrompt(agent: AgentCapability, request: AgentRequest): string;

  /** 解析 Agent 输出 */
  private parseOutput(agentId: string, rawOutput: string): AgentResponse['output'];
}
```

### 4.4 Context Manager（上下文管理器）

```typescript
// scripts/src/context-manager.ts

class ContextManager {
  private snapshotsDir: string;

  /** 创建上下文快照 */
  createSnapshot(taskBookId: string, context: AgentContext): string;

  /** 加载上下文快照 */
  loadSnapshot(snapshotId: string): AgentContext | null;

  /** 合并上下文（子 Agent 结果合并到父上下文） */
  mergeContext(parent: AgentContext, child: AgentContext): AgentContext;

  /** 收集项目上下文（报告、架构、依赖等） */
  async collectProjectContext(projectRoot: string): Promise<Partial<AgentContext>>;
}
```

### 4.5 增强 Task Executor

修改 `task-executor.ts` 的 `dispatchTask` 方法，实现真正的 Agent 调用：

```typescript
// scripts/src/task-executor.ts (修改)

private async dispatchTask(task: TaskItem): Promise<string> {
  const executor = new AgentExecutor(this.registry, this.contextManager, this.manager);

  // 根据任务类型选择 Agent
  const agents = this.registry.findByTaskType(task.type);
  if (agents.length === 0) {
    throw new Error(`MANUAL_REQUIRED: 没有找到支持 ${task.type} 类型的 Agent`);
  }

  // 构建请求
  const request: AgentRequest = {
    requestId: generateRequestId(),
    agentId: agents[0].id,
    taskBookId: this.currentTaskBookId,
    taskId: task.id,
    input: {
      type: 'task',
      payload: {
        title: task.title,
        acceptanceCriteria: task.acceptanceCriteria,
        scope: task.scope,
      },
    },
    context: await this.contextManager.collectProjectContext(process.cwd()),
  };

  // 执行 Agent
  const response = await executor.execute(request);

  if (response.status === 'success') {
    return JSON.stringify(response.output?.payload ?? response.artifacts);
  } else if (response.status === 'blocked') {
    throw new Error(`MANUAL_REQUIRED: ${response.error?.message}`);
  } else {
    throw new Error(response.error?.message ?? 'Agent 执行失败');
  }
}
```

---

## 5. 实现计划

### Phase 1: 基础设施（核心）

| 任务 | 文件 | 说明 |
|------|------|------|
| 1.1 | `scripts/src/types/agent-protocol.ts` | 定义 Agent 协议类型 |
| 1.2 | `scripts/src/agent-registry.ts` | 实现 Agent 注册表 |
| 1.3 | `scripts/src/context-manager.ts` | 实现上下文管理器 |

### Phase 2: 执行引擎

| 任务 | 文件 | 说明 |
|------|------|------|
| 2.1 | `scripts/src/agent-executor.ts` | 实现 Agent 执行器 |
| 2.2 | `scripts/src/task-executor.ts` | 修改 dispatchTask 方法 |
| 2.3 | `scripts/src/agent-prompt-builder.ts` | Agent Prompt 生成器 |

### Phase 3: 分发与集成

| 任务 | 文件 | 说明 |
|------|------|------|
| 3.1 | `scripts/src/codebuddy-loader.ts` | 更新分发逻辑 |
| 3.2 | `agents/*/AGENT.md` | 更新 Agent 定义格式 |
| 3.3 | 测试 | 端到端测试 |

### Phase 4: 文档与示例

| 任务 | 文件 | 说明 |
|------|------|------|
| 4.1 | `docs/agent-integration.md` | 集成文档 |
| 4.2 | `examples/` | 使用示例 |

---

## 6. 关键文件清单

### 新增文件

- `scripts/src/types/agent-protocol.ts` - Agent 协议类型定义
- `scripts/src/agent-registry.ts` - Agent 注册表
- `scripts/src/agent-executor.ts` - Agent 执行器
- `scripts/src/context-manager.ts` - 上下文管理器
- `scripts/src/agent-prompt-builder.ts` - Prompt 生成器

### 修改文件

- `scripts/src/task-executor.ts` - 集成 Agent 执行器
- `scripts/src/codebuddy-loader.ts` - 更新分发逻辑
- `scripts/src/types/index.ts` - 导出新类型

---

## 7. 确认的设计决策

| 决策项 | 选择 | 说明 |
|--------|------|------|
| **执行模式** | 混合模式 | 核心 Agent（task-orchestrator, structure-analyzer）用 CLI 脚本；扩展 Agent（planner, code-reviewer 等）用 Prompt 注入 |
| **目标平台** | CodeBuddy GLM-4.7 | 专为智谱 AI 的 CodeBuddy 优化 |
| **调用范围** | 仅本地调用 | Agent 只在本地项目内调用，简化实现 |
| **调用深度** | 默认 3 层 | 防止循环调用，可配置 |
| **冲突策略** | scope.files 检测 | 冲突时串行执行 |

---

## 8. 混合模式详细设计

### 8.1 CLI Agent（核心 Agent）

这些 Agent 作为独立的 Node.js 脚本运行，提供稳定的基础能力：

| Agent | 文件 | 职责 |
|-------|------|------|
| `task-orchestrator` | `scripts/src/agents/task-orchestrator.ts` | 任务编排、流程控制 |
| `structure-analyzer` | `scripts/src/structure-analyzer.ts` | 项目结构分析（已存在） |
| `module-mapper` | `scripts/src/module-mapper.ts` | 模块依赖分析（已存在） |

**CLI Agent 调用方式**：
```bash
node .codebuddy/scripts/task-orchestrator.js --taskbook <id> --task <taskId>
```

### 8.2 Prompt Agent（扩展 Agent）

这些 Agent 通过 Prompt 注入到 CodeBuddy，由 AI 模型解释执行：

| Agent | 定义文件 | 职责 |
|-------|----------|------|
| `planner` | `agents/planner/AGENT.md` | 任务规划、分解 |
| `code-reviewer` | `agents/code-reviewer/AGENT.md` | 代码审查 |
| `security-reviewer` | `agents/security-reviewer/AGENT.md` | 安全审查 |
| `performance-profiler` | `agents/performance-profiler/AGENT.md` | 性能分析 |

**Prompt Agent 调用方式**：
1. CLI Agent 生成调用请求
2. 将 AGENT.md 内容 + 任务上下文组装成 Prompt
3. 输出到 `.codebuddy/agent-calls/<requestId>.prompt.md`
4. CodeBuddy 读取并执行
5. 结果写回 `.codebuddy/agent-calls/<requestId>.result.json`

### 8.3 Agent 调用协议

```typescript
// .codebuddy/agent-calls/<requestId>.prompt.md 格式
interface AgentCallPrompt {
  header: {
    requestId: string;
    agentId: string;
    taskBookId: string;
    taskId?: string;
    parentAgent?: string;
    timestamp: string;
  };
  agentDefinition: string;  // AGENT.md 内容
  context: {
    projectRoot: string;
    taskBook: TaskBook;
    task?: TaskItem;
    reports?: ReportManifest;
  };
  instructions: string;     // 具体执行指令
}

// .codebuddy/agent-calls/<requestId>.result.json 格式
interface AgentCallResult {
  requestId: string;
  status: 'success' | 'failed' | 'blocked';
  output?: unknown;
  artifacts?: Array<{ type: string; path: string }>;
  error?: { code: string; message: string };
  completedAt: string;
}
```

---

## 9. 更新后的实现计划

### Phase 1: Agent 协议与注册（基础）

| 任务 | 文件 | 说明 |
|------|------|------|
| 1.1 | `scripts/src/types/agent-protocol.ts` | Agent 协议类型定义 |
| 1.2 | `scripts/src/agent-registry.ts` | Agent 注册表（扫描 AGENT.md） |
| 1.3 | `scripts/src/agent-call-manager.ts` | Agent 调用管理（生成/读取调用文件） |

### Phase 2: CLI Agent 实现

| 任务 | 文件 | 说明 |
|------|------|------|
| 2.1 | `scripts/src/agents/task-orchestrator.ts` | 任务编排 CLI Agent |
| 2.2 | `scripts/src/task-executor.ts` | 修改 dispatchTask，集成 Agent 调用 |
| 2.3 | `scripts/src/context-manager.ts` | 上下文收集与传递 |

### Phase 3: Prompt Agent 集成

| 任务 | 文件 | 说明 |
|------|------|------|
| 3.1 | `scripts/src/agent-prompt-builder.ts` | Prompt 生成器 |
| 3.2 | `agents/*/AGENT.md` | 更新 Agent 定义格式（添加输入/输出规范） |
| 3.3 | `.claude/commands/agent-call.md` | Agent 调用 Slash Command |

### Phase 4: 分发与测试

| 任务 | 文件 | 说明 |
|------|------|------|
| 4.1 | `scripts/src/codebuddy-loader.ts` | 更新分发逻辑 |
| 4.2 | `test/agent-integration.test.ts` | 集成测试 |
| 4.3 | `docs/agent-integration.md` | 集成文档 |

---

## 10. 关键文件清单（最终）

### 新增文件

| 文件 | 说明 |
|------|------|
| `scripts/src/types/agent-protocol.ts` | Agent 协议类型 |
| `scripts/src/agent-registry.ts` | Agent 注册表 |
| `scripts/src/agent-call-manager.ts` | Agent 调用管理 |
| `scripts/src/agents/task-orchestrator.ts` | 任务编排 CLI Agent |
| `scripts/src/context-manager.ts` | 上下文管理 |
| `scripts/src/agent-prompt-builder.ts` | Prompt 生成器 |
| `.claude/commands/agent-call.md` | Agent 调用命令 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `scripts/src/task-executor.ts` | 集成 Agent 调用逻辑 |
| `scripts/src/codebuddy-loader.ts` | 分发 Agent 调用相关文件 |
| `scripts/src/types/index.ts` | 导出新类型 |
| `agents/*/AGENT.md` | 添加输入/输出规范 |

---

## 11. 全流程示例

### 业务项目接入流程

```bash
# 1. 业务项目运行 codebuddy-loader
node path/to/my-fe-standards/scripts/dist/codebuddy-loader.js

# 2. 生成的文件结构
.codebuddy/
├── agents/                    # Agent 定义
│   ├── task-orchestrator/
│   ├── planner/
│   └── ...
├── scripts/                   # CLI Agent 脚本
│   ├── task-orchestrator.js
│   ├── taskbook-manager.js
│   └── ...
├── agent-calls/               # Agent 调用文件（运行时生成）
│   ├── <requestId>.prompt.md
│   └── <requestId>.result.json
├── taskbooks/                 # TaskBook 存储
└── workflows/                 # Workflow 定义
```

### Agent 自调用流程

```
用户请求 "帮我实现用户登录功能"
    │
    ▼
┌─────────────────────────────────────────┐
│ task-orchestrator (CLI Agent)           │
│ 1. 创建 TaskBook                         │
│ 2. 调用 structure-analyzer 分析项目      │
│ 3. 生成 planner Agent 调用请求           │
└─────────────────────────────────────────┘
    │
    ▼ 生成 .codebuddy/agent-calls/req-001.prompt.md
    │
┌─────────────────────────────────────────┐
│ CodeBuddy 读取并执行 planner Agent       │
│ 1. 读取 AGENT.md 定义                    │
│ 2. 分析上下文                            │
│ 3. 生成任务分解                          │
│ 4. 写回 req-001.result.json              │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ task-orchestrator 继续执行               │
│ 1. 读取 planner 结果                     │
│ 2. 更新 TaskBook                         │
│ 3. 按顺序执行各任务                      │
│ 4. 生成验收报告                          │
└─────────────────────────────────────────┘
```

---

## 12. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| Agent 调用文件被意外删除 | 调用前检查文件存在，支持重新生成 |
| 循环调用 | callStack 记录调用链，检测循环 |
| 超时 | 默认 5 分钟超时，可配置 |
| 结果解析失败 | 定义严格的 JSON Schema，校验输出 |












codex
• 可以落地，而且你这份方案的核心思路（“CLI 核心能力 + Prompt 扩展能力 + 文件协议桥接”）是对的；要做到“优秀”，MVP 需
  要把“谁执行 prompt、怎么回写、怎么校验与恢复”做成可验证闭环（而不是只停在架构图）。

  现状对齐

  - 现在闭环强项在 Workflow/TaskBook/gates；真正的“Agent 执行任务”仍是占位：scripts/src/task-executor.ts:306（设计/
    实现/测试/审查会 MANUAL_REQUIRED）。
  - docs/fancy-floating-dolphin.md 已明确缺口与目标（见 1.2、4.5、8 章：docs/fancy-floating-dolphin.md:24、docs/
    fancy-floating-dolphin.md:230、docs/fancy-floating-dolphin.md:343）。

  推荐 MVP（最小可用切片，local-first，无需远程服务）

  1. 文件协议（SSOT）

  - 目录：.codebuddy/agent-calls/（文档也这么定义：docs/fancy-floating-dolphin.md:493）
  - 产物：<requestId>.prompt.md + <requestId>.result.json（docs/fancy-floating-dolphin.md:374、docs/fancy-floating-
    dolphin.md:376）
  - 先把 result.json 的 schema 定死：status + output（并约束允许的 output 类型），避免自由文本无法自动消费。

  2. AgentCallManager（CLI）

  - 一个最小脚本就够：create/status/apply（文档叫 scripts/src/agent-call-manager.ts：docs/fancy-floating-
    dolphin.md:422）
  - create：生成 prompt.md（包含 header + AGENT.md + context 摘要 + 要求的 JSON 输出格式）
  - apply：校验 result.json → 更新 TaskBook（任务 done/blocked、写 changelog、记录 evidencePath）

  3. 接入 task-executor（阻塞/恢复模式）

  - 不建议把 LLM 变成同步依赖；建议：遇到可交给 Prompt Agent 的任务 → 生成 agent-call → 把任务置为 blocked（reason
    含 requestId/文件路径）→ 退出；下次运行检测到 result.json 再 apply 并继续。
  - 这正好复用你们已有的“blocked→unblock→继续闭环”机制。

  4. Claude 侧最小接入

  - 新增一个命令文件（类似现有 .claude/commands/task.md），用于：读取 prompt.md → 按要求输出 JSON → 写回
    result.json（文档提到 .claude/commands/agent-call.md：docs/fancy-floating-dolphin.md:462）。
  - 先接受“人触发/半自动”（MVP 不做 watcher/服务端）。

  MVP 验收标准（可自动测）

  - 当 TaskBook 包含一个 implement/test/design/review 任务，运行 task-executor：
      - 必须生成 .codebuddy/agent-calls/<id>.prompt.md
      - 必须把对应任务置为 blocked，且 blockedReason 含 requestId/路径
      - 重复运行不重复生成新 request（幂等）
  - 当写入一个合法的 .result.json 后再次运行：
      - 必须自动 apply：任务变 done（或按 result 指令更新/追加任务）
      - 必须写 changelog（可在验收报告里看到）
  - 非法/半写入 result.json：
      - 不能把任务标 done；必须保持 blocked，并给出可恢复错误信息

  如果你确认就按这个 MVP 做，我建议优先实现 “2) AgentCallManager + 3) task-executor 阻塞/恢复”，Claude 命令文件可以
  最后补。你希望 MVP 的首个落地目标是 planner（生成 TaskBook 任务），还是先做 implement/test/review 的“回写
  actualWork”（更简单、验证闭环更快）？/
