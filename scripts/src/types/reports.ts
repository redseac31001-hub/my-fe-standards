/**
 * Reports 模块类型定义
 *
 * 项目记忆系统（Project Memory）的接口和类型
 */

// ============ 基础类型 ============

/**
 * 报告类型
 */
export type ReportType =
  | 'architecture-snapshot'
  | 'module-map'
  | 'health-timeline'
  | 'task-context';

export type ValidatorGateScope = 'all' | 'rules' | 'skills';

export interface ValidatorGateEmbeddedReport {
  ok: boolean;
  strictMode: boolean;
  effectiveOk: boolean;
  errorCount: number;
  warningCount: number;
  issueCount: number;
}

export interface ValidatorGateSummary {
  ok: boolean;
  effectiveOk: boolean;
  strictMode: boolean;
  scope: ValidatorGateScope;
  generatedAt: string;
  errorCount: number;
  warningCount: number;
  issueCount: number;
  outputDir: string | null;
  reportFiles: string[];
  reports: {
    rules?: ValidatorGateEmbeddedReport;
    skills?: ValidatorGateEmbeddedReport;
  };
}

export interface ReportStatusSection {
  present: boolean;
  generatedAt: string | null;
  ageHours: number | null;
  ageLabel: string | null;
  freshness: 'fresh' | 'stale' | 'missing';
}

export interface ReportManagerStatusSnapshot {
  generatedAt: string;
  targetDir: string;
  reportsPath: string;
  manifest: {
    projectName: string;
    lastUpdated: string;
  };
  sections: {
    architecture: ReportStatusSection;
    modules: ReportStatusSection;
    health: ReportStatusSection & {
      trackedDays: number;
    };
    tasks: {
      present: boolean;
    };
    workflowRouting: {
      present: boolean;
      generatedAt: string | null;
      ageHours: number | null;
      ageLabel: string | null;
      workflowId: string | null;
      mode: string | null;
      confidence: 'high' | 'medium' | 'low' | null;
      taskBookId: string | null;
    };
    validatorGate: {
      present: boolean;
      generatedAt: string | null;
      ageHours: number | null;
      ageLabel: string | null;
      scope: ValidatorGateScope | null;
      strictMode: boolean | null;
      effectiveOk: boolean | null;
      errorCount: number | null;
      warningCount: number | null;
      issueCount: number | null;
      outputDir: string | null;
      reportFiles: string[];
    };
  };
}

/**
 * 报告元数据
 */
export interface ReportMeta {
  /** 报告类型 */
  type: ReportType;
  /** 文件路径 */
  path: string;
  /** 生成时间 */
  generatedAt: string;
  /** 生成者 */
  generatedBy: 'structure-analyzer' | 'module-mapper' | 'report-manager' | 'manual';
  /** 内容哈希 */
  hash: string;
  /** 文件大小 (bytes) */
  size: number;
}

/**
 * 报告索引 (manifest.json)
 */
export interface ReportsManifest {
  /** 版本 */
  version: '1.0.0';
  /** 项目名称 */
  projectName: string;
  /** 最后更新时间 */
  lastUpdated: string;

  /** 报告列表 */
  reports: {
    architecture: ReportMeta | null;
    modules: ReportMeta | null;
    health: ReportMeta | null;
    tasks: ReportMeta | null;
  };

  /** 设置 */
  settings: {
    /** 历史保留天数 */
    retentionDays: number;
    /** 最大快照数 */
    maxSnapshots: number;
    /** 自动清理 */
    autoCleanup: boolean;
  };
}

// ============ 架构快照 ============

/**
 * 违规项
 */
export interface Violation {
  /** 规则 ID */
  rule: string;
  /** 严重度 */
  severity: 'error' | 'warning' | 'info';
  /** 路径 */
  path: string;
  /** 消息 */
  message: string;
  /** 建议 */
  suggestion?: string;
}

/**
 * 架构快照
 */
export interface ArchitectureSnapshot {
  meta: {
    version: '1.0.0';
    projectName: string;
    analyzedAt: string;
    analyzedBy: 'structure-analyzer';
  };

  summary: {
    /** 健康度评分 0-100 */
    healthScore: number;
    /** 总文件数 */
    totalFiles: number;
    /** 总行数 */
    totalLines: number;
    /** 问题数量 */
    issueCount: {
      error: number;
      warning: number;
      info: number;
    };
  };

  structure: {
    /** 结构类型 */
    type: 'feature-based' | 'type-based' | 'hybrid' | 'unknown';
    /** 最大深度 */
    depth: number;
    /** 目录数 */
    directories: number;
  };

  /** 违规项列表 */
  violations: Violation[];

  /** 分项得分 */
  scores: {
    /** 特性结构 0-25 */
    featureStructure: number;
    /** 目录深度 0-25 */
    directoryDepth: number;
    /** 文件大小 0-25 */
    fileSize: number;
    /** 命名规范 0-25 */
    namingConvention: number;
  };
}

// ============ 模块图谱 ============

/**
 * 模块摘要
 */
export interface ModuleSummary {
  /** 模块名 */
  name: string;
  /** 中文名 */
  chineseName: string;
  /** 业务分类 */
  category: string;
  /** 模块类型 */
  type: 'page' | 'feature' | 'shared' | 'util' | 'api' | 'store' | 'layout';
  /** 路径 */
  path: string;
  /** 路由路径 */
  routePath?: string;
  /** 统计 */
  stats: {
    files: number;
    lines: number;
    components: number;
  };
  /** 健康度 */
  healthScore: number;
  /** 子模块 */
  subModules: Array<{
    name: string;
    chineseName: string;
    files: number;
    lines: number;
  }>;
  /** 依赖 */
  dependencies: string[];
  /** 被依赖 */
  dependents: string[];
}

/**
 * 模块图谱快照
 */
export interface ModuleMapSnapshot {
  meta: {
    version: '1.0.0';
    projectName: string;
    analyzedAt: string;
    analyzedBy: 'module-mapper';
  };

  summary: {
    /** 总模块数 */
    totalModules: number;
    /** 平均健康度 */
    avgHealthScore: number;
    /** 循环依赖数 */
    circularDeps: number;
    /** 孤立模块数 */
    isolatedModules: number;
  };

  /** 按分类统计 */
  categories: {
    [category: string]: {
      modules: string[];
      totalFiles: number;
      totalLines: number;
    };
  };

  /** 模块列表 */
  modules: ModuleSummary[];

  /** 依赖图 */
  graph: {
    nodes: string[];
    edges: Array<{
      from: string;
      to: string;
      weight: number;
    }>;
  };
}

// ============ 健康度时间线 ============

/**
 * 健康度数据点
 */
export interface HealthDataPoint {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 健康度评分 */
  healthScore: number;
  /** 分项 */
  breakdown: {
    architecture: number;
    modules: number;
    codeQuality: number;
  };
  /** 关联快照路径 */
  snapshot: string;
}

/**
 * 健康度时间线
 */
export interface HealthTimeline {
  meta: {
    version: '1.0.0';
    projectName: string;
    lastUpdated: string;
  };

  /** 数据点 */
  dataPoints: HealthDataPoint[];

  /** 趋势 */
  trends: {
    /** 方向 */
    direction: 'improving' | 'stable' | 'declining';
    /** 变化率（每周百分比） */
    changeRate: number;
    /** 预测值 */
    prediction: number;
  };
}

// ============ 任务上下文 ============

/**
 * 任务类型
 */
export type TaskType = 'refactor' | 'feature' | 'bugfix' | 'optimization';

/**
 * 任务状态
 */
export type TaskStatus = 'planning' | 'in-progress' | 'review' | 'completed';

/**
 * 任务阶段
 */
export interface TaskPhase {
  /** 阶段名 */
  name: string;
  /** 状态 */
  status: 'pending' | 'in-progress' | 'completed';
  /** 涉及文件 */
  files: string[];
}

/**
 * 当前任务
 */
export interface CurrentTask {
  /** 任务 ID */
  id: string;
  /** 类型 */
  type: TaskType;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 状态 */
  status: TaskStatus;
  /** 目标模块 */
  targetModules: string[];
  /** 计划 */
  plan?: {
    phases: TaskPhase[];
  };
  /** 基线快照 */
  baselineSnapshot: string;
  /** 变更记录 */
  changes: Array<{
    file: string;
    type: 'created' | 'modified' | 'deleted';
    timestamp: string;
  }>;
}

/**
 * 历史任务
 */
export interface HistoricalTask {
  /** 任务 ID */
  id: string;
  /** 标题 */
  title: string;
  /** 完成时间 */
  completedAt: string;
  /** 结果 */
  outcome: 'success' | 'partial' | 'failed';
  /** 影响的模块 */
  impactedModules: string[];
}

/**
 * 任务上下文
 */
export interface TaskContext {
  meta: {
    version: '1.0.0';
    createdAt: string;
    updatedAt: string;
  };

  /** 当前任务 */
  currentTask: CurrentTask | null;

  /** 最近任务 */
  recentTasks: HistoricalTask[];
}

// ============ 报告管理器配置 ============

/**
 * 保留策略
 */
export interface RetentionPolicy {
  /** 快照 */
  snapshots: {
    maxCount: number;
    maxAgeDays: number;
  };
  /** 健康度 */
  health: {
    dailyRetentionDays: number;
    weeklyRetentionDays: number;
  };
  /** 任务 */
  tasks: {
    maxCount: number;
    maxAgeDays: number;
  };
  /** 缓存 */
  cache: {
    maxAgeDays: number;
  };
}

/**
 * 默认保留策略
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  snapshots: {
    maxCount: 10,
    maxAgeDays: 30,
  },
  health: {
    dailyRetentionDays: 90,
    weeklyRetentionDays: 365,
  },
  tasks: {
    maxCount: 50,
    maxAgeDays: 180,
  },
  cache: {
    maxAgeDays: 7,
  },
};

/**
 * 默认 Manifest
 */
export const DEFAULT_MANIFEST: ReportsManifest = {
  version: '1.0.0',
  projectName: '',
  lastUpdated: '',
  reports: {
    architecture: null,
    modules: null,
    health: null,
    tasks: null,
  },
  settings: {
    retentionDays: 30,
    maxSnapshots: 10,
    autoCleanup: true,
  },
};
