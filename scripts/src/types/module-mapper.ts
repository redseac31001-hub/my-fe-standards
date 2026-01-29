/**
 * Module Mapper 类型定义
 *
 * 功能模块图谱分析器的接口和类型
 */

// ============ 模块类型定义 ============

/**
 * 模块类型
 */
export type ModuleType = 'page' | 'feature' | 'shared' | 'util' | 'api' | 'store' | 'layout';

/**
 * 模块信息
 */
export interface ModuleInfo {
  /** 模块名称 */
  name: string;
  /** 模块路径 */
  path: string;
  /** 模块类型 */
  type: ModuleType;
  /** 页面入口列表 */
  entries: string[];
  /** 子模块列表 */
  subModules: string[];
  /** 内部依赖（项目内模块） */
  internalDeps: string[];
  /** 外部依赖（npm 包） */
  externalDeps: string[];
  /** 关联模块（被其他模块引用） */
  relatedModules: string[];
  /** 统计信息 */
  stats: ModuleStats;
  /** 健康度评分 */
  healthScore: number;
  /** 问题列表 */
  issues: ModuleIssue[];
}

/**
 * 模块统计
 */
export interface ModuleStats {
  /** 文件数量 */
  files: number;
  /** 代码行数 */
  lines: number;
  /** Vue 组件数量 */
  components: number;
  /** TypeScript 文件数量 */
  tsFiles: number;
  /** 最大文件行数 */
  maxFileLines: number;
  /** 平均文件行数 */
  avgFileLines: number;
}

/**
 * 模块问题
 */
export interface ModuleIssue {
  /** 问题类型 */
  type: 'size' | 'complexity' | 'coupling' | 'naming';
  /** 严重度 */
  severity: 'error' | 'warning' | 'info';
  /** 问题描述 */
  message: string;
  /** 相关文件 */
  file?: string;
}

// ============ 依赖关系类型 ============

/**
 * 依赖边
 */
export interface DependencyEdge {
  /** 来源模块 */
  from: string;
  /** 目标模块 */
  to: string;
  /** 依赖类型 */
  type: 'import' | 'dynamic' | 'lazy';
  /** 引用次数 */
  count: number;
}

/**
 * 依赖图
 */
export interface DependencyGraph {
  /** 节点列表（模块名） */
  nodes: string[];
  /** 边列表 */
  edges: DependencyEdge[];
}

// ============ 分析结果类型 ============

/**
 * 分析选项
 */
export interface MapperOptions {
  /** 目标项目路径 */
  targetPath: string;
  /** 源码目录 */
  srcDir?: string;
  /** 最大扫描深度 */
  maxDepth?: number;
  /** 输出模式 */
  mode?: 'summary' | 'full' | 'graph';
  /** 输出格式 */
  outputFormat?: 'json' | 'markdown' | 'mermaid';
  /** 是否分析依赖 */
  analyzeDeps?: boolean;
  /** 忽略模式 */
  ignorePatterns?: string[];
}

/**
 * 分析结果
 */
export interface MapperResult {
  /** 项目名称 */
  projectName: string;
  /** 分析时间 */
  analyzedAt: string;
  /** 模块列表 */
  modules: ModuleInfo[];
  /** 依赖图 */
  dependencyGraph: DependencyGraph;
  /** 摘要统计 */
  summary: MapperSummary;
  /** Mermaid 图表代码 */
  mermaidGraph?: string;
}

/**
 * 摘要统计
 */
export interface MapperSummary {
  /** 总模块数 */
  totalModules: number;
  /** 按类型统计 */
  modulesByType: Record<ModuleType, number>;
  /** 总文件数 */
  totalFiles: number;
  /** 总代码行数 */
  totalLines: number;
  /** 平均模块健康度 */
  avgHealthScore: number;
  /** 循环依赖数 */
  circularDeps: number;
  /** 孤立模块数 */
  isolatedModules: number;
}

// ============ 配置类型 ============

/**
 * 模块映射配置
 */
export interface ModuleMapperConfig {
  /** 模块识别模式 */
  modulePatterns: ModulePattern[];
  /** 入口文件模式 */
  entryPatterns: string[];
  /** 忽略模式 */
  ignorePatterns: string[];
  /** 健康度阈值 */
  thresholds: {
    /** 模块最大文件数 */
    maxFilesPerModule: number;
    /** 模块最大行数 */
    maxLinesPerModule: number;
    /** 最大依赖数 */
    maxDependencies: number;
    /** 最大被依赖数 */
    maxDependents: number;
  };
}

/**
 * 模块识别模式
 */
export interface ModulePattern {
  /** 目录模式 */
  pattern: string;
  /** 模块类型 */
  type: ModuleType;
  /** 是否递归子目录 */
  recursive?: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_MAPPER_CONFIG: ModuleMapperConfig = {
  modulePatterns: [
    { pattern: 'views', type: 'page', recursive: true },
    { pattern: 'pages', type: 'page', recursive: true },
    { pattern: 'features', type: 'feature', recursive: true },
    { pattern: 'modules', type: 'feature', recursive: true },
    { pattern: 'components', type: 'shared', recursive: false },
    { pattern: 'composables', type: 'util', recursive: false },
    { pattern: 'hooks', type: 'util', recursive: false },
    { pattern: 'utils', type: 'util', recursive: false },
    { pattern: 'api', type: 'api', recursive: true },
    { pattern: 'services', type: 'api', recursive: true },
    { pattern: 'store', type: 'store', recursive: true },
    { pattern: 'stores', type: 'store', recursive: true },
    { pattern: 'layouts', type: 'layout', recursive: false },
  ],
  entryPatterns: [
    'index.vue',
    'index.tsx',
    'index.ts',
    'App.vue',
    '*.page.vue',
    '*.view.vue',
  ],
  ignorePatterns: [
    'node_modules',
    'dist',
    '.git',
    '.vscode',
    '__tests__',
    '*.test.*',
    '*.spec.*',
  ],
  thresholds: {
    maxFilesPerModule: 50,
    maxLinesPerModule: 5000,
    maxDependencies: 10,
    maxDependents: 20,
  },
};
