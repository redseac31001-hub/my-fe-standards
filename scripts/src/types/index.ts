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

// ============ TaskBook 系统类型 ============

/**
 * TaskBook 状态
 */
export type TaskBookStatus = 'draft' | 'confirmed' | 'executing' | 'completed' | 'aborted';

/**
 * 任务类型
 */
export type TaskType = 'analysis' | 'design' | 'test' | 'implement' | 'review';

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
 * 完整的 TaskBook 结构
 */
export interface TaskBook {
  id: string;
  title: string;
  description: string;
  taskType: TaskBookType;
  createdAt: string;
  confirmedAt?: string;
  completedAt?: string;
  status: TaskBookStatus;
  context: TaskBookContext;
  tasks: TaskItem[];
  changelog: ChangeEntry[];
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
