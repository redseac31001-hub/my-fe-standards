/**
 * 共享类型定义
 * 用于 rule-loader 和 generate-manifest 脚本
 */

// ============ Manifest 相关类型 ============

/**
 * 清单文件条目
 */
export interface ManifestFile {
  /** 相对路径 (POSIX 格式) */
  path: string;
  /** 文件大小 (字节) */
  size: number;
  /** 文件名 */
  name: string;
}

/**
 * 完整清单结构
 */
export interface Manifest {
  /** 生成时间 (ISO 格式) */
  generatedAt: string;
  /** 版本号 */
  version: string;
  /** 内嵌的加载器配置 */
  config: RawLoaderConfig;
  /** 文件列表 */
  files: ManifestFile[];
}

// ============ 配置相关类型 ============

/**
 * 基础层配置
 */
export interface BaseLayerConfig {
  /** 层级 ID */
  id: string;
  /** 层级标题 */
  title: string;
  /** 静态依赖 (始终加载的文件夹) */
  staticDeps: string[];
  /** 注释 */
  _comment?: string;
}

/**
 * 业务层配置
 */
export interface BusinessLayerConfig {
  /** 层级 ID */
  id: string;
  /** 层级标题 */
  title: string;
  /** 依赖映射: npm包名 -> 规则文件夹数组 */
  dependencies: Record<string, string[]>;
  /** 注释 */
  _comment?: string;
}

/**
 * 动作层配置
 */
export interface ActionLayerConfig {
  /** 层级 ID */
  id: string;
  /** 层级标题 */
  title: string;
  /** 默认加载的规则 */
  defaults: string[];
  /** 注释 */
  _comment?: string;
}

/**
 * 输出配置
 */
export interface OutputConfig {
  /** 输出目录名 */
  dirName: string;
  /** 输出文件名 */
  fileName: string;
}

/**
 * Frontmatter 配置
 */
export interface FrontmatterConfig {
  /** 描述 */
  description?: string;
  /** 是否始终应用 */
  alwaysApply?: boolean;
  /** 是否启用 */
  enabled?: boolean;
  /** 提供者 */
  provider?: string;
}

// ============ Vue 检测相关类型 ============

/**
 * Vue 版本类型
 */
export type VueVersionType = 'standard' | 'composition' | 'options';

/**
 * Vue 版本检测结果
 */
export interface VueProfile {
  /** Vue 主版本号 (2 或 3) */
  version: 2 | 3;
  /** Vue 使用类型 */
  type: VueVersionType;
}

// ============ Package.json 相关类型 ============

/**
 * 简化的 package.json 结构
 */
export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

// ============ 详略级别类型 ============

/**
 * 详略级别
 * - summary: 仅摘要
 * - quick: 摘要 + 快速参考
 * - full: 完整内容
 */
export type DetailLevel = 'summary' | 'quick' | 'full';

/**
 * 详略级别配置
 */
export interface DetailLevelConfig {
  /** 级别名称 */
  name: string;
  /** 级别描述 */
  description: string;
  /** 包含的标记 */
  markers: string[];
}

/**
 * 详略级别配置集合
 */
export interface DetailLevelsConfig {
  _comment?: string;
  summary: DetailLevelConfig;
  quick: DetailLevelConfig;
  full: DetailLevelConfig;
}

// ============ 全局上下文类型 ============

/**
 * 加载器全局上下文
 */
export interface LoaderContext {
  /** 是否为远程模式 */
  isRemote: boolean;
  /** 是否启用详细日志 */
  isVerbose: boolean;
  /** 远程基础 URL */
  remoteBaseUrl: string;
  /** 远程清单 */
  remoteManifest: Manifest | null;
  /** 请求超时时间 (毫秒) */
  requestTimeout: number;
  /** 当前任务类型 (用于渐进式披露) */
  taskType: string | null;
  /** 相关性阈值 */
  relevanceThreshold: number;
  /** 详略级别 (用于渐进式披露) */
  detailLevel: DetailLevel;
}

// ============ 任务系统类型 ============

/**
 * 任务定义
 */
export interface TaskDefinition {
  /** 任务名称 */
  name: string;
  /** 任务描述 */
  description: string;
  /** 任务别名 */
  aliases: string[];
}

/**
 * 规则相关性配置
 */
export type RuleRelevance = Record<string, Record<string, number>>;

/**
 * 阈值配置
 */
export interface ThresholdConfig {
  default: number;
  strict: number;
  loose: number;
  _comment?: string;
}

/**
 * 任务配置
 */
export interface TasksConfig {
  _comment?: string;
  definitions: Record<string, TaskDefinition>;
  ruleRelevance: {
    layer1_base: RuleRelevance;
    layer2_business: RuleRelevance;
    layer3_action: RuleRelevance;
  };
  thresholds: ThresholdConfig;
}

/**
 * 原始加载器配置 (JSON 文件格式) - 扩展版
 */
export interface RawLoaderConfig {
  _comment?: string;
  layers: {
    base: BaseLayerConfig;
    business: BusinessLayerConfig;
    action: ActionLayerConfig;
  };
  tasks?: TasksConfig;
  detailLevels?: DetailLevelsConfig;
  skills?: SkillsConfig;
  output: OutputConfig;
  frontmatter?: FrontmatterConfig;
}

/**
 * 解析后的加载器配置 (运行时使用) - 扩展版
 */
export interface LoaderConfig {
  LAYERS: {
    BASE: BaseLayerConfig;
    BUSINESS: BusinessLayerConfig;
    ACTION: ActionLayerConfig;
  };
  TASKS: TasksConfig | null;
  DETAIL_LEVELS: DetailLevelsConfig | null;
  SKILLS: SkillsConfig | null;
  OUTPUT_DIR_NAME: string;
  OUTPUT_FILE_NAME: string;
  FRONTMATTER: FrontmatterConfig;
}

// ============ Skills 系统类型 ============

/**
 * 技能元数据（从 YAML frontmatter 解析）
 */
export interface SkillMetadata {
  /** 技能 ID（文件夹名） */
  id: string;
  /** 技能名称 */
  name: string;
  /** 技能描述（包含触发条件） */
  description: string;
}

/**
 * 完整技能结构
 */
export interface Skill {
  /** 技能元数据 */
  metadata: SkillMetadata;
  /** 技能内容（SKILL.md 的 markdown 内容，不含 frontmatter） */
  content: string;
}

/**
 * Skills 配置
 */
export interface SkillsConfig {
  /** 是否启用 skills */
  enabled: boolean;
  /** skills 目录路径（相对于项目根目录） */
  path: string;
  /** 注释 */
  _comment?: string;
}
