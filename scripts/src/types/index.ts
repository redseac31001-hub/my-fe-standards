/**
 * 类型定义文件
 *
 * 定义项目中使用的核心接口和类型
 */

// ============ Manifest 相关类型 ============

/**
 * Manifest 文件条目
 */
export interface ManifestFile {
  path: string;
  name: string;
  size: number;
  mtime: string;
}

/**
 * 完整的 Manifest 结构
 */
export interface Manifest {
  version: string;
  generatedAt: string;
  aiTool: string;
  model: string;
  config: ManifestConfig;
  files: ManifestFile[];
  stats: ManifestStats;
}

export interface ManifestConfig {
  layers: LayersConfig;
  skills: SkillsConfig;
  agents?: AgentConfig;
  tasks: TasksConfig;
  output: OutputConfig;
  frontmatter: FrontmatterConfig;
}

export interface ManifestStats {
  totalFiles: number;
  ruleFiles: number;
  skillFiles: number;
  agentFiles?: number;
  workflowFiles?: number;
  taskbookFiles?: number;
}

// ============ 配置相关类型 ============

/**
 * 加载器配置 (loader-config.json)
 */
export interface LoaderConfig {
  layers: LayersConfig;
  skills: SkillsConfig;
  tasks: TasksConfig;
  output: OutputConfig;
  frontmatter: FrontmatterConfig;
}

export interface LayersConfig {
  base?: LayerConfig;
  business?: BusinessLayerConfig;
  action?: ActionLayerConfig;
}

export interface LayerConfig {
  id: string;
  title: string;
  staticDeps?: string[];
}

export interface BusinessLayerConfig extends LayerConfig {
  dependencies?: Record<string, string[]>;
}

export interface ActionLayerConfig extends LayerConfig {
  defaults?: string[];
}

export interface SkillsConfig {
  enabled: boolean;
  path: string;
}

export interface TasksConfig {
  definitions?: Record<string, TaskDefinition>;
}

export interface TaskDefinition {
  keywords: string[];
  layers: string[];
}

export interface OutputConfig {
  dirName: string;
  fileName: string;
}

export interface FrontmatterConfig {
  description?: string;
  alwaysApply?: boolean;
  enabled?: boolean;
}

// ============ 加载器上下文类型 ============

/**
 * 全局上下文状态
 */
export interface Context {
  isRemote: boolean;
  isVerbose: boolean;
  remoteBaseUrl: string;
  remoteManifest: Manifest | null;
  requestTimeout: number;
  taskType: string | null;
  relevanceThreshold: number;
  ruleLevel: 'summary' | 'quick' | 'full';
  /** 是否启用 B 路线编排脚本（task-executor、agent-call 协议等）。默认 false */
  enableOrchestrator: boolean;
  /** --no-workspace 时为 true，禁用 workspace 多项目发现 */
  disableWorkspace?: boolean;
}

/**
 * Vue 版本检测结果
 */
export interface VueProfile {
  version: 2 | 3;
  type: 'standard' | 'composition' | 'options';
}

/**
 * 规则内容
 */
export interface RuleContent {
  path: string;
  content: string;
}

/**
 * 规则索引项
 */
export interface RuleIndexItem {
  dep?: string;
  rule: string;
  path: string;
}

// ============ 技能系统类型 ============

/**
 * 技能元数据
 */
export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  triggers: string[];
}

// ============ Agent 系统类型 ============

/**
 * Agent 元数据
 */
export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  /** 隐式触发模式（从 AGENT.md body 中的 implicit triggers 解析） */
  implicitTriggers?: Array<{ pattern: string; confidence: number }>;
  permissions: string[];
  workflowSummary?: string;
  relatedSkills?: string[];
  relatedRules?: string[];
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  enabled: boolean;
  path: string;
  loadMode: 'eager' | 'lazy';
  definitions?: Record<string, AgentDefinition>;
}

/**
 * Agent 定义
 */
export interface AgentDefinition {
  name: string;
  description: string;
  triggers: string[];
  permissions: string[];
  relatedSkills?: string[];
  relatedRules?: string[];
}

// ============ Package.json 类型 ============

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// ============ Workflow Spec 类型 ============

export interface WorkflowEdge {
  from: string;
  to: string;
  when?: string;
}

export interface WorkflowGate {
  id: string;
  type: string;
  title?: string;
  required?: boolean;
  params?: Record<string, unknown>;
}

export interface WorkflowArtifact {
  id: string;
  path: string;
  mimeType?: string;
  producerStepId?: string;
}

export interface WorkflowStep {
  id: string;
  type: string;
  title: string;
  description?: string;
  owner?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  gates?: string[];
  toolHints?: Record<string, unknown>;
  /**
   * 步骤跳过条件。满足时自动跳过该步骤。
   * 格式：`no_tasks_of_type:<type1>,<type2>` — TaskBook 中无指定类型的 pending 任务时跳过
   */
  skipWhen?: string;
}

export interface WorkflowSpec {
  id: string;
  version: string;
  name?: string;
  description?: string;
  steps: WorkflowStep[];
  edges?: WorkflowEdge[];
  gates?: WorkflowGate[];
  policies?: Record<string, unknown>;
  artifacts?: WorkflowArtifact[];
}

// ============ TaskBook 系统类型 ============

/**
 * TaskBook 状态
 */
export type TaskBookStatus = 'draft' | 'confirmed' | 'executing' | 'completed' | 'aborted';

/**
 * 任务类型
 *
 * - requirement: 需求澄清
 * - prd: PRD 生成
 * - analysis: 项目分析
 * - design: 技术设计（融入任务分解）
 * - test: 测试编写（TDD RED 阶段）
 * - implement: 代码实现（TDD GREEN 阶段）
 * - refactor: 重构（TDD REFACTOR 阶段）
 * - review: 代码审查
 * - build-fix: 构建修复
 * - acceptance: 验收
 */
export type TaskType =
  | 'requirement'
  | 'prd'
  | 'analysis'
  | 'design'
  | 'test'
  | 'implement'
  | 'refactor'
  | 'review'
  | 'build-fix'
  | 'acceptance';

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked' | 'skipped';

/**
 * 任务优先级
 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * 变更类型
 */
export type ChangeType = 'added' | 'modified' | 'removed' | 'reordered';

/**
 * 任务书类型（用于分类）
 */
export type TaskBookType = 'new-feature' | 'refactoring' | 'debugging' | 'testing' | 'code-review';

/**
 * 任务作用域（用于并发冲突检测、批量策略、审计）
 */
export interface TaskScope {
  files?: string[];
  modules?: string[];
  tags?: string[];
}

/**
 * 单个任务定义
 */
export interface TaskItem {
  id: string;
  parentId?: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[];
  acceptanceCriteria: string[];
  scope?: TaskScope;
  actualWork?: string;
  blockedReason?: string;
  executedBy?: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * 变更日志条目
 */
export interface ChangeEntry {
  timestamp: string;
  taskId: string | null;
  changeType: ChangeType;
  reason: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/**
 * 项目健康度快照
 */
export interface ProjectHealthSnapshot {
  score: number;
  issues: string[];
}

/**
 * TaskBook 上下文
 */
export interface TaskBookContext {
  projectHealth?: ProjectHealthSnapshot;
  relatedFiles: string[];
  dependencies: string[];
  architectureNotes?: string;
}

/**
 * 单个子 Agent 的执行结果摘要
 */
export interface AgentResultSummary {
  requestId: string;
  agentId: string;
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  status: 'success' | 'failed' | 'blocked';
  actualWork?: string;
  artifacts?: Array<{ type: string; path: string }>;
  completedAt?: string;
  error?: string;
}

/**
 * 主 Agent 汇总报告（Phase 7 生成）
 */
export interface FinalReport {
  generatedAt: string;
  taskBookId: string;
  executionSummary: string;
  agentResults: AgentResultSummary[];
  issueList: string[];
  nextSteps: string[];
  stats: {
    totalAgentCalls: number;
    successCount: number;
    failedCount: number;
    blockedCount: number;
  };
}

/**
 * 完整的 TaskBook 结构
 */
export interface TaskBook {
  id: string;
  title: string;
  description: string;
  taskType: TaskBookType;
  createdAt: string;
  revision?: number;
  updatedAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  status: TaskBookStatus;
  context: TaskBookContext;
  tasks: TaskItem[];
  changelog: ChangeEntry[];
  meta?: Record<string, unknown>;
  /** Phase 7 汇总报告（由 result-aggregator 生成） */
  finalReport?: FinalReport;
}

/**
 * TaskBook 创建参数
 */
export interface CreateTaskBookParams {
  title: string;
  description: string;
  taskType: TaskBookType;
}

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  actualWork?: string;
  error?: string;
  duration?: number;
}

/**
 * 验收报告
 */
export interface AcceptanceReport {
  taskBookId: string;
  title: string;
  createdAt: string;
  completedAt: string;
  duration: string;
  summary: {
    totalTasks: number;
    doneTasks: number;
    skippedTasks: number;
    blockedTasks: number;
    completionRate: number;
    changelogCount: number;
  };
  agentCalls?: Array<{
    requestId: string;
    action?: 'created' | 'applied';
    timestamp?: string;
    taskId?: string | null;
    agentId?: string;
    kind?: 'planner' | 'manual-task';
    status?: 'success' | 'failed' | 'blocked';
    createdAt?: string;
    completedAt?: string;
    promptPath?: string;
    resultPath?: string;
    artifacts?: Array<{ type: string; path: string; description?: string }>;
  }>;
  gates?: Array<{
    gateId: string;
    stepId?: string;
    timestamp?: string;
    passed: boolean;
    skipped?: boolean;
    skipReason?: string;
    approved?: boolean;
    evidencePath?: string;
    eventContext?: string;
    batchIndex?: number;
    riskTier?: string;
    budgetMinutes?: number;
    totalDurationMs?: number;
    commandRuns?: Array<{ command: string; ok: boolean; code: number | null; durationMs: number }>;
    missingScripts?: string[];
  }>;
  batches?: Array<{
    stepId: string;
    batchIndex: number;
    taskIds: string[];
    riskTier?: string;
    maxFiles?: number;
    status?: string;
    startedAt?: string;
    endedAt?: string;
    smokeGate?: { passed: boolean; budgetMinutes?: number; totalDurationMs?: number };
  }>;
  codeChanges?: {
    addedFiles: number;
    modifiedFiles: number;
    deletedFiles: number;
    linesAdded: number;
    linesDeleted: number;
  };
  testResults?: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    coverage: number;
  };
  recommendations: {
    mustDo: string[];
    suggested: string[];
    technicalDebt: string[];
  };
}

// ============ Workspace 多项目类型 ============

/**
 * 项目语言类型
 */
export type ProjectLang = 'typescript' | 'javascript' | 'java' | 'python' | 'go' | 'rust' | 'dotnet' | 'unknown';

/**
 * 单个子项目描述
 */
export interface SubProject {
  /** 项目名称（来自 package.json name 或目录名） */
  name: string;
  /** 相对于 workspace 根目录的路径（始终用 / 分隔） */
  relativePath: string;
  /** 绝对路径 */
  absolutePath: string;
  /** 项目语言 */
  lang: ProjectLang;
  /** package.json 内容（仅 JS/TS 项目） */
  packageJson?: PackageJson;
  /** Vue 版本检测结果 */
  vueProfile: VueProfile | null;
  /** 合并后的依赖（dependencies + devDependencies，仅 JS/TS 项目） */
  dependencies: Record<string, string>;
  /** 匹配到的 Layer2 规则列表（由 main 填充） */
  matchedLayer2Rules: RuleIndexItem[];
  /** 框架标签，如 "Vue 3"、"React" */
  frameworkLabel: string;
  /** UI 库标签列表，如 ["ant-design-vue", "vant"] */
  uiLibLabels: string[];
}

/**
 * Workspace 发现结果
 */
export interface WorkspaceInfo {
  /** 是否为多项目 workspace（projects.length > 1） */
  isWorkspace: boolean;
  /** workspace 根目录 */
  rootDir: string;
  /** 发现的子项目列表 */
  projects: SubProject[];
  /** 发现时间戳 */
  discoveredAt: string;
}

/**
 * 序列化到 workspace-index.json 的结构
 */
export interface WorkspaceIndex {
  version: string;
  generatedAt: string;
  rootDir: string;
  projectCount: number;
  projects: Array<{
    name: string;
    relativePath: string;
    lang: ProjectLang;
    frameworkLabel: string;
    uiLibLabels: string[];
    vueVersion: number | null;
    layer2CachePath: string;
    matchedRules: string[];
  }>;
}

// ============ 上下文收集类型 ============

/**
 * 引用追踪结果（单条）
 */
export interface ReferenceEntry {
  filePath: string;
  line: number;
  column: number;
  matchText: string;
  kind: 'import' | 'require' | 'from' | 'usage';
}

/**
 * 引用追踪汇总
 */
export interface ReferenceFindResult {
  target: string;
  references: ReferenceEntry[];
  searchedFiles: number;
  durationMs: number;
}

/**
 * 关联测试文件
 */
export interface RelatedTestFile {
  testPath: string;
  sourcePath: string;
  confidence: 'exact' | 'pattern' | 'directory';
}

/**
 * Git 最近变更条目
 */
export interface GitChangeEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

/**
 * 上下文收集结果（完整）
 */
export interface CollectedContext {
  targetFiles: Array<{
    path: string;
    content: string;
    lines: number;
  }>;
  references: ReferenceFindResult[];
  relatedTests: RelatedTestFile[];
  gitHistory: GitChangeEntry[];
  collectedAt: string;
  durationMs: number;
}
