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
  encoding?: ContentPackEntryEncoding;
}

export interface ManifestContentPack {
  profile: InstallProfile;
  file: string;
  format: 'content-pack-json-v1';
  sha256: string;
  size: number;
  entryCount: number;
  generatedAt: string;
}

export type ContentPackEntryEncoding = 'utf8' | 'base64';

export interface ContentPackEntry {
  path: string;
  sha256: string;
  content: string;
  encoding?: ContentPackEntryEncoding;
}

export interface ContentPack {
  schemaVersion: '1.0.0';
  version: string;
  profile: InstallProfile;
  generatedAt: string;
  entryCount: number;
  entries: ContentPackEntry[];
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
  packs?: Partial<Record<InstallProfile, ManifestContentPack>>;
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
  /**
   * Layer2 selector -> rule file names.
   * Supported selector forms:
   * - `dependency:<package>` / plain `<package>` (backward compatible)
   * - `stack:<tag>`
   * - `lang:<language>`
   * - `kind:<project-kind>`
   */
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
  remoteBearerToken: string | null;
  remoteManifest: Manifest | null;
  remoteContentRoot: string | null;
  remoteContentPack: ManifestContentPack | null;
  strictRemotePack: boolean;
  requestTimeout: number;
  taskType: string | null;
  relevanceThreshold: number;
  ruleLevel: 'summary' | 'quick' | 'full';
  /** 当前分发档位。默认 analysis；orchestrator/full 会隐含 enableOrchestrator=true。 */
  profile: InstallProfile;
  /** 是否启用 B 路线编排脚本（task-executor、agent-call 协议等）。默认 false */
  enableOrchestrator: boolean;
  /** --no-workspace 时为 true，禁用 workspace 多项目发现 */
  disableWorkspace?: boolean;
  /** Workspace 分发范围：共享安装或定向项目安装 */
  workspaceScope: WorkspaceScope;
  /** project-targeted 模式下的目标项目选择器 */
  targetProject: string | null;
  /** 可选岗位过滤 */
  targetRole: SkillRole | null;
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
  tools?: string[];
  related?: string[];
  languages?: ProjectLang[];
  frameworks?: string[];
  roles?: SkillRole[];
  scenarios?: string[];
  workspaceScope?: SkillWorkspaceScope;
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
  type?: string;
  private?: boolean;
  bin?: string | Record<string, string>;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// ============ 安装状态类型 ============

export type InstallMode = 'local' | 'remote';
export type InstallProfile = 'core' | 'analysis' | 'orchestrator' | 'full' | 'demo';

export interface InstallManagedFile {
  path: string;
  sha256: string;
  size: number;
}

export interface InstallState {
  /** install.json 自身 schema 版本 */
  schemaVersion: string;
  /** 当前 loader 版本 */
  version: string;
  installedAt: string;
  mode: InstallMode;
  profile: InstallProfile;
  enableOrchestrator: boolean;
  contentHash: string;
  depsFingerprint?: string | null;
  source: {
    remoteBaseUrl: string | null;
    manifestVersion: string | null;
    manifestGeneratedAt?: string | null;
    contentPackFile?: string | null;
    contentPackFormat?: string | null;
    contentPackSha256?: string | null;
  };
  options: {
    taskType: string | null;
    ruleLevel: 'summary' | 'quick' | 'full';
    strictRemotePack: boolean;
    relevanceThreshold: number;
    workspaceDiscovery: boolean;
    workspaceScope: WorkspaceScope;
    targetProject: string | null;
    targetRole: SkillRole | null;
  };
  outputs: {
    rulesFile: string;
    workspaceIndexFile: string | null;
    skillsRootDir?: string | null;
    skillsSnapshotRetention?: number | null;
    agentsRootDir?: string | null;
    agentsSnapshotRetention?: number | null;
  };
  managedFiles: InstallManagedFile[];
  stats: {
    layer1Rules: number;
    layer2Indexes: number;
    layer3Indexes: number;
    skills: number;
    agents: number;
    scripts: number;
    workflows: number;
    taskbooks: number;
    agentCalls: number;
    commands: number;
    workspaceProjects: number;
  };
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

export type BuiltinWorkflowId = 'micro' | 'sprint' | 'default';

export interface WorkflowRoutingSignal {
  id: string;
  matched: boolean;
  weight?: number;
  detail?: string;
}

export interface WorkflowRoutingInput {
  taskBookId: string;
  taskType: TaskBookType | null;
  taskCount: number;
  maxDependencyDepth: number;
  hasRequirementOrPrdTasks: boolean;
  hasDesignTasks: boolean;
  hasReviewTasks: boolean;
  hasBuildFixTasks: boolean;
  hasHighPriorityTasks: boolean;
  scopedFileCount: number;
  scopedModuleCount: number;
  workspaceProjectCount: number;
  selectedProjectCount: number;
  projectKinds: string[];
  routeHints: string[];
}

export interface WorkflowRoutingDecision {
  mode: 'explicit' | 'reused' | 'auto' | 'fallback';
  selectedWorkflowId: string;
  canonicalWorkflowId: BuiltinWorkflowId | null;
  selectedWorkflowPath: string;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  signals: WorkflowRoutingSignal[];
  reusedFromTaskBook?: boolean;
  fallbackReason?: string;
  generatedAt: string;
}

export type TaskIntakeExecutionPath = 'direct' | 'orchestrated';
export type TaskIntakeContractState = 'explicit' | 'partial' | 'none';
export type TaskIntakeUncertainty = 'low' | 'medium' | 'high';
export type TaskIntakeKind =
  | 'api-adaptation'
  | 'bugfix'
  | 'refactor'
  | 'feature'
  | 'review'
  | 'analysis'
  | 'unknown';

export interface TaskIntakeRoutingInput {
  title: string | null;
  description: string | null;
  kind: TaskIntakeKind | null;
  contractState: TaskIntakeContractState;
  uncertainty: TaskIntakeUncertainty;
  estimatedFileCount: number | null;
  estimatedModuleCount: number | null;
  estimatedDomainCount: number | null;
  estimatedEndpointCount: number | null;
  requiresHandoff: boolean;
  requiresParallelWork: boolean;
  requiresDurableTracking: boolean;
  changesArchitecture: boolean;
  changesStateModel: boolean;
  changesRouting: boolean;
  changesWorkflow: boolean;
  routeHints: string[];
}

export interface TaskIntakeRoutingSignal {
  id: string;
  matched: boolean;
  detail?: string;
  weight?: number;
  hardEscalation?: boolean;
}

export interface TaskIntakeRoutingDecision {
  recommendedPath: TaskIntakeExecutionPath;
  confidence: 'high' | 'medium' | 'low';
  inferredKind: TaskIntakeKind;
  reasons: string[];
  signals: TaskIntakeRoutingSignal[];
  hardEscalationTriggers: string[];
  suggestedNextSteps: string[];
  suggestedValidation: string[];
  generatedAt: string;
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

export type HandoffType = 'standard' | 'qa_pass' | 'qa_fail' | 'escalation';

export interface HandoffEntry {
  from: string;
  to: string;
  type: HandoffType;
  timestamp: string;
  context?: string;
  deliverables?: string[];
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
  handoffs?: HandoffEntry[];
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
export type ProjectKind = 'frontend' | 'backend' | 'fullstack' | 'library' | 'unknown';

export type WorkspaceScope = 'workspace-union' | 'project-targeted';

export type SkillWorkspaceScope = WorkspaceScope | 'both';

export type SkillRole =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'qa'
  | 'architect'
  | 'product'
  | 'devops';

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
  /** 项目形态，用于多岗位/多技术栈路由 */
  projectKind: ProjectKind;
  /** 归一化后的技术栈标签，用于 skill/agent 过滤 */
  stackTags: string[];
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
  /** 当前安装使用的 workspace 分发范围 */
  scope: WorkspaceScope;
  /** 当前锁定的项目（project-targeted 时） */
  selectedProject: string | null;
  /** 原始发现到的总项目数 */
  totalProjectCount: number;
}

/**
 * 序列化到 workspace-index.json 的结构
 */
export interface WorkspaceIndex {
  version: string;
  generatedAt: string;
  rootDir: string;
  projectCount: number;
  totalProjectCount: number;
  scope: WorkspaceScope;
  selectedProject: string | null;
  projects: Array<{
    name: string;
    relativePath: string;
    lang: ProjectLang;
    frameworkLabel: string;
    uiLibLabels: string[];
    projectKind: ProjectKind;
    stackTags: string[];
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
