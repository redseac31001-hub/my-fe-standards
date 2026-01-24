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
  tasks: TasksConfig;
  output: OutputConfig;
  frontmatter: FrontmatterConfig;
}

export interface ManifestStats {
  totalFiles: number;
  ruleFiles: number;
  skillFiles: number;
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

// ============ Package.json 类型 ============

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
