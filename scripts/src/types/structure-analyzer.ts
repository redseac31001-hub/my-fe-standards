/**
 * Structure Analyzer 类型定义
 *
 * 项目结构分析器的核心接口定义
 */

// ============ 输入参数 ============

/**
 * 分析选项
 */
export interface AnalyzeOptions {
  /** 目标项目路径（必填） */
  targetPath: string;
  /** src 目录名，默认 'src' */
  srcDir?: string;
  /** 最大扫描深度，默认 10 */
  maxDepth?: number;
  /** 输出模式，默认 'problems_only' */
  mode?: 'problems_only' | 'summary' | 'full';
  /** TopN 文件数量，默认 20 */
  limitTopFiles?: number;
  /** 忽略的文件/目录模式 */
  ignorePatterns?: string[];
  /** 自定义配置文件路径 */
  configPath?: string;
  /** 输出格式 */
  outputFormat?: 'json' | 'markdown' | 'both';
}

// ============ 输出结构 ============

/**
 * 分析结果
 */
export interface AnalysisResult {
  /** 项目名称 */
  projectName: string;
  /** 分析时间（ISO 8601） */
  analyzedAt: string;
  /** 配置来源 */
  configSource: 'project' | 'global' | 'default';

  /** 摘要统计 */
  summary: AnalysisSummary;

  /** 违规项列表 */
  violations: Violation[];

  /** 评分 */
  scores: AnalysisScores;

  /** 目录结构（仅 mode='full' 时包含） */
  structure?: DirectoryNode;
}

/**
 * 摘要统计
 */
export interface AnalysisSummary {
  /** 总文件数 */
  totalFiles: number;
  /** 总目录数 */
  totalDirectories: number;
  /** 最大深度 */
  maxDepth: number;
  /** 最大文件列表 */
  topLargestFiles: FileInfo[];
  /** 扩展名统计 */
  extensionStats: Record<string, number>;
}

/**
 * 文件信息
 */
export interface FileInfo {
  /** 文件路径 */
  path: string;
  /** 行数 */
  lines: number;
  /** 文件大小（KB） */
  sizeKB: number;
}

/**
 * 评分结构
 */
export interface AnalysisScores {
  /** 工程健康度总分（0-100） */
  total: number;
  /** 结构健康度总分（0-100） */
  structureTotal: number;
  /** 分项得分 */
  breakdown: ScoreBreakdown;
  /** 工程健康度评分卡 */
  scorecard: EngineeringScorecard;
}

/**
 * 分项得分
 */
export interface ScoreBreakdown {
  /** 特性结构得分（0-25） */
  featureStructure: number;
  /** 深度得分（0-25） */
  depth: number;
  /** 文件大小得分（0-25） */
  fileSize: number;
  /** 命名得分（0-25） */
  naming: number;
}

export type HealthDimensionId =
  | 'architecture-structure'
  | 'code-quality'
  | 'type-safety'
  | 'test-coverage'
  | 'dependency-health'
  | 'build-performance'
  | 'naming-convention'
  | 'documentation';

export type HealthDimensionStatus = 'excellent' | 'good' | 'needs-improvement' | 'unmeasured';

export interface HealthDimensionCriterion {
  /** 子规则名称 */
  label: string;
  /** 当前子规则得分 */
  score: number;
  /** 子规则满分 */
  maxScore: number;
  /** 是否真正完成检测 */
  measured: boolean;
  /** 子规则是否命中 */
  met: boolean | null;
  /** 附加说明 */
  note?: string;
}

export interface HealthDimensionScore {
  /** 维度 ID */
  id: HealthDimensionId;
  /** 维度名称 */
  label: string;
  /** 维度权重 */
  weight: number;
  /** 当前得分；未检测时为 null */
  score: number | null;
  /** 满分 */
  maxScore: number;
  /** 是否已检测 */
  measured: boolean;
  /** 维度状态 */
  status: HealthDimensionStatus;
  /** 当前维度摘要 */
  summary: string;
  /** 子规则 */
  criteria: HealthDimensionCriterion[];
}

export interface EngineeringScorecard {
  /** 评分卡版本 */
  version: '2.0.0';
  /** 已测维度的原始累计得分 */
  measuredScore: number;
  /** 已测维度累计权重 */
  measuredWeight: number;
  /** 总权重 */
  totalWeight: number;
  /** 归一化后的工程健康度 */
  normalizedScore: number | null;
  /** 已测维度数量 */
  measuredDimensions: number;
  /** 未测维度数量 */
  unmeasuredDimensions: number;
  /** 各维度详情 */
  dimensions: HealthDimensionScore[];
}

// ============ 违规项 ============

/**
 * 违规项
 */
export interface Violation {
  /** 规则代码 */
  code: ViolationCode;
  /** 严重度 */
  severity: 'error' | 'warning' | 'info';
  /** 问题描述 */
  message: string;
  /** 问题位置 */
  path: string;
  /** 具体证据 */
  evidence?: string;
  /** 改进建议 */
  suggestion: string;
}

/**
 * 违规代码
 */
export type ViolationCode = 'SA001' | 'SA002' | 'SA003' | 'SA004' | 'SA005';

// ============ 目录节点 ============

/**
 * 目录节点
 */
export interface DirectoryNode {
  /** 名称 */
  name: string;
  /** 类型 */
  type: 'file' | 'directory';
  /** 完整路径 */
  path: string;
  /** 子节点 */
  children?: DirectoryNode[];
  /** 统计信息 */
  stats?: NodeStats;
}

/**
 * 节点统计
 */
export interface NodeStats {
  /** 行数（仅文件） */
  lines?: number;
  /** 文件大小（KB） */
  sizeKB?: number;
}

// ============ 配置相关 ============

/**
 * Structure Analyzer 配置
 */
export interface StructureAnalyzerConfig {
  /** 阈值配置 */
  thresholds: ThresholdConfig;
  /** 启用的规则 */
  enabledRules: ViolationCode[];
  /** 忽略模式 */
  ignorePatterns: string[];
  /** 按类型分组的目录名模式 */
  typeGroupedPatterns: string[];
  /** SA001 白名单 */
  sa001Whitelist: string[];
  /** SA001 最小文件数阈值 */
  sa001MinFiles: number;
  /** SA004 配置 */
  sa004: SA004Config;
}

/**
 * 阈值配置
 */
export interface ThresholdConfig {
  /** 最大文件行数 */
  maxFileLines: number;
  /** 最大目录深度 */
  maxDirectoryDepth: number;
  /** 最大文件大小（KB） */
  maxFileSizeKB: number;
  /** 命名相似度阈值 */
  similarityThreshold: number;
}

/**
 * SA004 性能防护配置
 */
export interface SA004Config {
  /** 是否启用 */
  enabled: boolean;
  /** 相似度阈值 */
  similarityThreshold: number;
  /** 同目录最多比较对数 */
  maxPairsPerDirectory: number;
  /** 全局最多检查次数 */
  maxTotalChecks: number;
  /** 最小名称长度 */
  minNameLength: number;
}

// ============ 分析上下文 ============

/**
 * SA001 上下文
 */
export interface SA001Context {
  /** 项目是否存在 features/ 目录 */
  hasFeatureDir: boolean;
  /** 当前目录内文件数量 */
  fileCount: number;
}

/**
 * 扫描上下文
 */
export interface ScanContext {
  /** 当前深度 */
  currentDepth: number;
  /** 是否存在 features 目录 */
  hasFeatureDir: boolean;
  /** SA004 已检查次数 */
  sa004CheckCount: number;
  /** 文件列表（用于统计） */
  allFiles: FileInfo[];
  /** 扩展名统计 */
  extensionStats: Record<string, number>;
}

// ============ 默认配置 ============

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: StructureAnalyzerConfig = {
  thresholds: {
    maxFileLines: 500,
    maxDirectoryDepth: 5,
    maxFileSizeKB: 100,
    similarityThreshold: 0.8,
  },
  enabledRules: ['SA001', 'SA002', 'SA003', 'SA004', 'SA005'],
  ignorePatterns: ['node_modules', 'dist', '.git', '*.min.js', '*.map', 'coverage', '.nyc_output'],
  typeGroupedPatterns: ['components', 'views', 'store', 'stores', 'utils', 'hooks', 'services', 'helpers', 'api', 'apis'],
  sa001Whitelist: ['components', 'shared', 'common', 'assets', 'styles', 'types', 'constants'],
  sa001MinFiles: 10,
  sa004: {
    enabled: true,
    similarityThreshold: 0.8,
    maxPairsPerDirectory: 50,
    maxTotalChecks: 500,
    minNameLength: 3,
  },
};
