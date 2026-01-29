# Reports 模块设计规范

> 版本: 1.0.0
> 状态: 设计中
> 最后更新: 2026-01-29

## 1. 概述

### 1.1 定位

Reports 模块是 CodeBuddy 的 **项目记忆系统**（Project Memory），负责：

- **持久化**：保存分析结果，避免重复计算
- **追踪**：记录项目健康度变化趋势
- **上下文**：为后续 Agent 任务提供决策依据
- **加速**：增量分析，减少 Token 消耗

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **机器优先** | JSON 格式为主，Markdown 按需生成 |
| **增量更新** | 支持部分更新，避免全量重算 |
| **版本追踪** | 保留历史快照，支持对比分析 |
| **零配置** | 自动管理生命周期，无需用户干预 |

## 2. 目录结构

```
.codebuddy/
├── reports/                          # 项目记忆根目录
│   ├── manifest.json                 # 报告索引（元数据）
│   │
│   ├── architecture/                 # 架构分析报告
│   │   ├── latest.json              # 最新架构快照
│   │   ├── 2026-01-29T10-00-00.json # 历史快照（按需保留）
│   │   └── diff/                    # 差异报告
│   │       └── 2026-01-28_2026-01-29.json
│   │
│   ├── modules/                      # 模块图谱报告
│   │   ├── latest.json              # 最新模块图谱
│   │   ├── graph.mermaid            # Mermaid 依赖图（可视化）
│   │   └── business-map.json        # 业务分类映射
│   │
│   ├── health/                       # 健康度历史
│   │   ├── timeline.json            # 健康度时间线
│   │   └── trends.json              # 趋势分析
│   │
│   └── tasks/                        # 任务上下文
│       ├── active.json              # 当前活跃任务
│       └── history/                 # 历史任务存档
│           └── 2026-01-29_refactor-registry.json
│
└── cache/                            # 临时缓存（可安全删除）
    ├── ast/                         # AST 解析缓存
    └── deps/                        # 依赖分析缓存
```

## 3. 报告类型定义

### 3.1 报告索引 (manifest.json)

```typescript
interface ReportsManifest {
  version: '1.0.0';
  projectName: string;
  lastUpdated: string;  // ISO 8601

  reports: {
    architecture: ReportMeta | null;
    modules: ReportMeta | null;
    health: ReportMeta | null;
    tasks: ReportMeta | null;
  };

  settings: {
    retentionDays: number;      // 历史保留天数，默认 30
    maxSnapshots: number;       // 最大快照数，默认 10
    autoCleanup: boolean;       // 自动清理，默认 true
  };
}

interface ReportMeta {
  type: ReportType;
  path: string;
  generatedAt: string;
  generatedBy: string;          // 'structure-analyzer' | 'module-mapper' | 'manual'
  hash: string;                 // 内容哈希，用于变更检测
  size: number;                 // 文件大小 (bytes)
}

type ReportType =
  | 'architecture-snapshot'
  | 'module-map'
  | 'health-timeline'
  | 'task-context';
```

### 3.2 架构快照 (architecture/latest.json)

```typescript
interface ArchitectureSnapshot {
  meta: {
    version: '1.0.0';
    projectName: string;
    analyzedAt: string;
    analyzedBy: 'structure-analyzer';
  };

  summary: {
    healthScore: number;        // 0-100
    totalFiles: number;
    totalLines: number;
    issueCount: {
      error: number;
      warning: number;
      info: number;
    };
  };

  structure: {
    type: 'feature-based' | 'type-based' | 'hybrid' | 'unknown';
    depth: number;
    directories: number;
  };

  violations: Array<{
    rule: string;               // 'SA001' | 'SA002' | ...
    severity: 'error' | 'warning' | 'info';
    path: string;
    message: string;
    suggestion?: string;
  }>;

  scores: {
    featureStructure: number;   // 0-25
    directoryDepth: number;     // 0-25
    fileSize: number;           // 0-25
    namingConvention: number;   // 0-25
  };
}
```

### 3.3 模块图谱 (modules/latest.json)

```typescript
interface ModuleMapSnapshot {
  meta: {
    version: '1.0.0';
    projectName: string;
    analyzedAt: string;
    analyzedBy: 'module-mapper';
  };

  summary: {
    totalModules: number;
    avgHealthScore: number;
    circularDeps: number;
    isolatedModules: number;
  };

  categories: {
    [category: string]: {       // '用户认证' | '业务办理' | ...
      modules: string[];
      totalFiles: number;
      totalLines: number;
    };
  };

  modules: Array<{
    name: string;
    chineseName: string;
    category: string;
    type: 'page' | 'feature' | 'shared' | 'util' | 'api' | 'store' | 'layout';
    path: string;
    routePath?: string;
    stats: {
      files: number;
      lines: number;
      components: number;
    };
    healthScore: number;
    subModules: Array<{
      name: string;
      chineseName: string;
      files: number;
      lines: number;
    }>;
    dependencies: string[];     // 依赖的其他模块
    dependents: string[];       // 被哪些模块依赖
  }>;

  graph: {
    nodes: string[];
    edges: Array<{
      from: string;
      to: string;
      weight: number;
    }>;
  };
}
```

### 3.4 健康度时间线 (health/timeline.json)

```typescript
interface HealthTimeline {
  meta: {
    version: '1.0.0';
    projectName: string;
    lastUpdated: string;
  };

  dataPoints: Array<{
    date: string;               // YYYY-MM-DD
    healthScore: number;
    breakdown: {
      architecture: number;
      modules: number;
      codeQuality: number;
    };
    snapshot: string;           // 关联的快照路径
  }>;

  trends: {
    direction: 'improving' | 'stable' | 'declining';
    changeRate: number;         // 每周变化百分比
    prediction: number;         // 预测下周健康度
  };
}
```

### 3.5 任务上下文 (tasks/active.json)

```typescript
interface TaskContext {
  meta: {
    version: '1.0.0';
    createdAt: string;
    updatedAt: string;
  };

  currentTask: {
    id: string;
    type: 'refactor' | 'feature' | 'bugfix' | 'optimization';
    title: string;
    description: string;
    status: 'planning' | 'in-progress' | 'review' | 'completed';
    targetModules: string[];

    plan?: {
      phases: Array<{
        name: string;
        status: 'pending' | 'in-progress' | 'completed';
        files: string[];
      }>;
    };

    baselineSnapshot: string;   // 开始时的架构快照
    changes: Array<{
      file: string;
      type: 'created' | 'modified' | 'deleted';
      timestamp: string;
    }>;
  } | null;

  recentTasks: Array<{
    id: string;
    title: string;
    completedAt: string;
    outcome: 'success' | 'partial' | 'failed';
    impactedModules: string[];
  }>;
}
```

## 4. 生命周期管理

### 4.1 自动生成时机

| 触发条件 | 生成的报告 |
|----------|-----------|
| `架构审查` 命令 | architecture + modules |
| `模块分析` 命令 | modules |
| 每日首次分析 | 健康度快照追加到 timeline |
| 任务开始 | task-context 创建/更新 |
| 任务结束 | task-context 归档 |

### 4.2 过期策略

```typescript
const DEFAULT_RETENTION = {
  // 快照保留策略
  snapshots: {
    maxCount: 10,           // 最多保留 10 个历史快照
    maxAgeDays: 30,         // 最多保留 30 天
  },

  // 健康度数据
  health: {
    dailyRetentionDays: 90, // 每日数据保留 90 天
    weeklyRetentionDays: 365, // 周汇总保留 1 年
  },

  // 任务历史
  tasks: {
    maxCount: 50,           // 最多保留 50 个任务记录
    maxAgeDays: 180,        // 最多保留 180 天
  },

  // 缓存
  cache: {
    maxAgeDays: 7,          // 缓存 7 天后清理
  },
};
```

### 4.3 清理机制

```bash
# 自动清理（在分析时触发）
node .codebuddy/scripts/report-manager.js cleanup

# 手动清理
node .codebuddy/scripts/report-manager.js cleanup --force

# 清理缓存但保留报告
node .codebuddy/scripts/report-manager.js cleanup --cache-only
```

## 5. Agent 集成

### 5.1 报告读取 API

Agent 和 Skill 通过以下方式读取报告：

```typescript
// 读取最新架构快照
const arch = readReport('architecture/latest.json');

// 读取健康度趋势
const health = readReport('health/timeline.json');

// 检查是否有可用报告
const hasReport = reportExists('modules/latest.json');

// 获取报告年龄（小时）
const age = getReportAge('architecture/latest.json');
```

### 5.2 工作流程集成

**structure-analyzer Agent 更新后的工作流程：**

```yaml
workflow_summary: |
  ⚠️ **执行以下步骤**:

  1. **检查现有报告**:
     - 读取 `.codebuddy/reports/manifest.json`
     - 如果 architecture 报告存在且 < 24小时，提示用户是否复用

  2. **并行分析**（如需重新分析）:
     - 模块识别: `node .codebuddy/scripts/module-mapper.js . --mode summary`
     - 结构分析: `node .codebuddy/scripts/structure-analyzer.js . --mode summary`

  3. **持久化报告**:
     - 自动写入 `.codebuddy/reports/` 目录
     - 更新 manifest.json

  4. **增量对比**:
     - 如果存在历史快照，生成差异报告
     - 显示健康度变化趋势

  5. **综合报告**:
     - 合并分析结果
     - 输出改进建议
```

### 5.3 后续任务加速

当用户发起重构/优化任务时：

```yaml
# planner Agent 工作流程
workflow:
  1. 读取 `.codebuddy/reports/modules/latest.json`
     - 获取模块列表和依赖关系
     - 无需重新扫描目录

  2. 读取 `.codebuddy/reports/architecture/latest.json`
     - 获取已知问题列表
     - 确定改造优先级

  3. 创建任务上下文
     - 写入 `.codebuddy/reports/tasks/active.json`
     - 记录基线快照引用

  4. 生成计划
     - 基于已有分析数据
     - 预估影响范围
```

## 6. 命令行接口

### 6.1 报告管理脚本

```bash
# 查看报告状态
node .codebuddy/scripts/report-manager.js status

# 输出示例：
# ┌─────────────────────────────────────────────────────┐
# │           CodeBuddy Reports Status                  │
# ├─────────────────────────────────────────────────────┤
# │ Architecture:  2026-01-29 10:30  (2h ago)  ✓ Fresh │
# │ Modules:       2026-01-29 10:30  (2h ago)  ✓ Fresh │
# │ Health Points: 15 days tracked                      │
# │ Active Task:   None                                 │
# └─────────────────────────────────────────────────────┘

# 导出 Markdown 报告
node .codebuddy/scripts/report-manager.js export --format markdown

# 查看健康度趋势
node .codebuddy/scripts/report-manager.js trend --days 30

# 对比两个快照
node .codebuddy/scripts/report-manager.js diff \
  --from 2026-01-28 \
  --to 2026-01-29
```

## 7. 实现计划

### Phase 1: 基础框架
- [ ] 创建 `reports/` 目录结构
- [ ] 实现 `manifest.json` 管理
- [ ] 更新 `structure-analyzer.js` 支持报告输出
- [ ] 更新 `module-mapper.js` 支持报告输出

### Phase 2: 生命周期管理
- [ ] 实现 `report-manager.js` 脚本
- [ ] 自动清理过期报告
- [ ] 历史快照保留

### Phase 3: Agent 集成
- [ ] 更新 `structure-analyzer` Agent 工作流程
- [ ] 实现报告读取 API
- [ ] 增量对比功能

### Phase 4: 趋势分析
- [ ] 健康度时间线追踪
- [ ] 趋势预测
- [ ] 可视化图表

## 8. 附录

### 8.1 与竞品对比

| 特性 | CodeBuddy Reports | Backstage | Sourcegraph |
|------|-------------------|-----------|-------------|
| 项目记忆 | ✅ 本地持久化 | ❌ 需数据库 | ❌ 需服务端 |
| 零配置 | ✅ | ❌ | ❌ |
| 离线可用 | ✅ | ❌ | ❌ |
| Agent 集成 | ✅ 原生 | ❌ | 部分 |
| 健康度追踪 | ✅ | 部分 | ❌ |

### 8.2 文件大小预估

| 报告类型 | 典型大小 | 中型项目 (100 模块) |
|----------|----------|---------------------|
| architecture/latest.json | 5-20 KB | ~15 KB |
| modules/latest.json | 10-50 KB | ~35 KB |
| health/timeline.json | 2-10 KB | ~5 KB |
| tasks/active.json | 1-5 KB | ~3 KB |
| **总计** | ~20-85 KB | ~60 KB |

对 Token 消耗影响：
- 直接读取报告：~15K tokens（中型项目）
- 重新分析项目：~50K+ tokens
- **节省率：~70%**
