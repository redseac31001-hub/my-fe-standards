/**
 * Module Mapper 类型定义
 *
 * 功能模块图谱分析器的接口和类型
 */

// ============ 业务分类定义 ============

/**
 * 业务分类
 */
export type BusinessCategory =
  | '用户认证'
  | '用户管理'
  | '业务办理'
  | '数据管理'
  | '系统设置'
  | '通用组件'
  | '工具函数'
  | '其他';

/**
 * 业务关键词映射
 */
export interface BusinessKeywordMapping {
  /** 关键词（目录名/文件名） */
  keyword: string;
  /** 中文名称 */
  name: string;
  /** 业务分类 */
  category: BusinessCategory;
  /** 别名列表 */
  aliases?: string[];
}

/**
 * 默认业务关键词映射表
 */
export const BUSINESS_KEYWORDS: BusinessKeywordMapping[] = [
  // 用户认证
  { keyword: 'login', name: '登录', category: '用户认证', aliases: ['signin', 'auth'] },
  { keyword: 'register', name: '注册', category: '用户认证', aliases: ['signup'] },
  { keyword: 'verification', name: '身份验证', category: '用户认证', aliases: ['verify', 'validate'] },
  { keyword: 'password', name: '密码管理', category: '用户认证', aliases: ['pwd', 'forgot'] },
  { keyword: 'captcha', name: '验证码', category: '用户认证' },
  { keyword: 'sso', name: '单点登录', category: '用户认证' },

  // 用户管理
  { keyword: 'account', name: '账户', category: '用户管理', aliases: ['user', 'profile'] },
  { keyword: 'personal', name: '个人中心', category: '用户管理', aliases: ['mine', 'my'] },
  { keyword: 'settings', name: '设置', category: '用户管理', aliases: ['setting', 'config'] },
  { keyword: 'enterprise', name: '企业信息', category: '用户管理', aliases: ['company', 'corp'] },

  // 业务办理
  { keyword: 'registry', name: '注册开户', category: '业务办理', aliases: ['reg'] },
  { keyword: 'selfSign', name: '自助签约', category: '业务办理', aliases: ['self-sign', 'selfsign'] },
  { keyword: 'fillInfo', name: '信息填写', category: '业务办理', aliases: ['fill-info', 'fillinfo'] },
  { keyword: 'openAccount', name: '开户', category: '业务办理', aliases: ['open-account', 'openaccount'] },
  { keyword: 'apply', name: '申请', category: '业务办理', aliases: ['application'] },
  { keyword: 'order', name: '订单', category: '业务办理', aliases: ['orders'] },
  { keyword: 'payment', name: '支付', category: '业务办理', aliases: ['pay'] },
  { keyword: 'transaction', name: '交易', category: '业务办理', aliases: ['trans'] },

  // 数据管理
  { keyword: 'dashboard', name: '仪表盘', category: '数据管理', aliases: ['home', 'index'] },
  { keyword: 'report', name: '报表', category: '数据管理', aliases: ['reports', 'statistics'] },
  { keyword: 'list', name: '列表', category: '数据管理', aliases: ['table'] },
  { keyword: 'detail', name: '详情', category: '数据管理', aliases: ['details', 'info'] },

  // 系统设置
  { keyword: 'admin', name: '管理后台', category: '系统设置', aliases: ['management'] },
  { keyword: 'permission', name: '权限管理', category: '系统设置', aliases: ['role', 'auth'] },
  { keyword: 'system', name: '系统管理', category: '系统设置', aliases: ['sys'] },

  // 通用组件
  { keyword: 'components', name: '公共组件', category: '通用组件', aliases: ['component', 'common'] },
  { keyword: 'layouts', name: '布局组件', category: '通用组件', aliases: ['layout'] },

  // 工具函数
  { keyword: 'utils', name: '工具函数', category: '工具函数', aliases: ['util', 'helpers', 'helper'] },
  { keyword: 'hooks', name: 'Hooks', category: '工具函数', aliases: ['composables', 'composable'] },
  { keyword: 'api', name: 'API接口', category: '工具函数', aliases: ['apis', 'services', 'service'] },
  { keyword: 'store', name: '状态管理', category: '工具函数', aliases: ['stores', 'vuex', 'pinia'] },
];

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
  /** 业务信息 */
  business: {
    /** 中文名称 */
    chineseName: string;
    /** 业务分类 */
    category: BusinessCategory;
    /** 路由路径 */
    routePath?: string;
  };
  /** 页面入口列表 */
  entries: string[];
  /** 子模块列表 */
  subModules: SubModuleInfo[];
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
 * 子模块信息
 */
export interface SubModuleInfo {
  /** 子模块名称 */
  name: string;
  /** 中文名称 */
  chineseName: string;
  /** 业务分类 */
  category: BusinessCategory;
  /** 路径 */
  path: string;
  /** 文件数 */
  files: number;
  /** 代码行数 */
  lines: number;
  /** 健康度 */
  healthScore: number;
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
