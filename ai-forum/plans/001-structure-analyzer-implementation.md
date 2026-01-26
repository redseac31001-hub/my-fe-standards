# 项目结构分析器实施计划

> 计划编号: PLAN-001
> 关联话题: [001-structure-analysis-enhancement](../threads/001-structure-analysis-enhancement.md)
> 创建时间: 2026-01-26
> 状态: 🟢 已批准
> 负责人: AI 协作团队

---

## 📋 决策记录

| 决策点 | 最终决定 | 决策者 | 日期 |
|--------|----------|--------|------|
| 配置策略 | 双层都支持（全局 + 项目级） | @Human | 2026-01-26 |
| P0 规则数量 | 5条（含简化版SA005） | @Human | 2026-01-26 |
| 是否先做文档清理 | 是 | @Human | 2026-01-26 |
| MCP get_structure_tree | 暂缓 | @Human | 2026-01-26 |

---

## 🎯 项目目标

为 my-fe-standards 项目增加**项目结构分析审核能力**，实现：

1. 自动扫描目标项目目录结构
2. 检测常见反模式（5条规则）
3. 生成健康度评分（0-100分）
4. 通过 MCP 工具暴露给 AI 调用
5. 沉淀为可复用的 Skill

---

## 📅 实施路线图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            实施时间线（更新版）                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 0.5      Phase 1        Phase 2       Phase 2.5      Phase 3        │
│  文档清理       核心脚本        MCP集成        Agent创建      Skill沉淀      │
│  ─────────     ─────────      ─────────     ──────────     ─────────       │
│  [0.5h]        [2-3h]         [1-2h]        [0.5h]         [1h]            │
│                                                                             │
│  ●──────●──────●──────────────●─────────────●──────────────●               │
│  ▼      ▼      ▼              ▼             ▼              ▼               │
│  开始   P0.5   P0完成          P1完成        P2.5完成       P2完成           │
│                                                                             │
│  总预估时间: 5-7 小时                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 调用能力实现进度

| 调用方式 | 实现阶段 | 状态 |
|----------|----------|------|
| CLI 命令行 | Phase 1 (P0) | ⬜ |
| MCP 工具调用 | Phase 2 (P1) | ⬜ |
| **Agent 调用** | **Phase 2.5 (新增)** | ⬜ |
| **Skill 触发** | **Phase 3 (增强)** | ⬜ |

---

## 📦 Phase 0.5: 文档一致性清理

**预估时间**: 0.5 小时
**优先级**: 🔴 高（阻塞后续工作）

### 任务清单

| # | 任务 | 验收标准 | 状态 |
|---|------|----------|------|
| 0.5.1 | 搜索所有引用 `rule-loader.js` 的文件 | 输出文件列表 | ⬜ |
| 0.5.2 | 统一更新为 `codebuddy-loader.js` | 所有引用一致 | ⬜ |
| 0.5.3 | 更新 README.md 中的命令示例 | 示例可执行 | ⬜ |
| 0.5.4 | 检查 docs/ 目录的一致性 | 无过时引用 | ⬜ |

### 交付物

- 更新后的文档文件列表
- 变更日志记录

---

## 📦 Phase 1 (P0): Structure-Analyzer 核心脚本

**预估时间**: 2-3 小时
**优先级**: 🔴 高（核心能力）

### 文件结构

```
scripts/
├── src/
│   ├── structure-analyzer.ts      # 主入口
│   └── types/
│       └── structure-analyzer.d.ts # 类型定义
├── dist/
│   └── structure-analyzer.js      # 编译输出（提交到Git）
└── tsconfig.json
```

### 任务清单

| # | 任务 | 验收标准 | 预估 | 状态 |
|---|------|----------|------|------|
| 1.1 | 创建类型定义文件 | TypeScript 编译通过 | 15min | ⬜ |
| 1.2 | 实现目录扫描功能 | 正确生成目录树 | 30min | ⬜ |
| 1.3 | 实现配置加载（双层） | 优先级正确 | 20min | ⬜ |
| 1.4 | 实现 SA001 检测 | 识别 type-grouped 目录 | 15min | ⬜ |
| 1.5 | 实现 SA002 检测 | 识别过深嵌套 | 15min | ⬜ |
| 1.6 | 实现 SA003 检测 | 识别巨型文件 | 15min | ⬜ |
| 1.7 | 实现 SA004 检测 | 识别近似命名 | 20min | ⬜ |
| 1.8 | 实现 SA005 检测（简化版） | 路径规则检测 | 20min | ⬜ |
| 1.9 | 实现评分算法 | 输出 0-100 分数 | 10min | ⬜ |
| 1.10 | 实现 JSON 输出 | 符合契约格式 | 15min | ⬜ |
| 1.11 | 实现 Markdown 输出 | 人类可读报告 | 15min | ⬜ |
| 1.12 | 添加 CLI 入口 | 命令行可执行 | 10min | ⬜ |
| 1.13 | 编译并测试 | `npm run build` 成功 | 10min | ⬜ |

### 接口契约（最终版）

```typescript
// ============ 输入参数 ============
interface AnalyzeOptions {
  targetPath: string;                    // 目标项目路径（必填）
  srcDir?: string;                       // src 目录名，默认 'src'
  maxDepth?: number;                     // 最大扫描深度，默认 10
  mode?: 'problems_only' | 'summary' | 'full';  // 输出模式，默认 'problems_only'
  limitTopFiles?: number;                // TopN 文件数量，默认 20
  ignorePatterns?: string[];             // 忽略的文件/目录模式
  configPath?: string;                   // 自定义配置文件路径
}

// ============ 输出结构 ============
interface AnalysisResult {
  projectName: string;
  analyzedAt: string;                    // ISO 8601 时间戳
  configSource: 'project' | 'global' | 'default';  // 配置来源

  summary: {
    totalFiles: number;
    totalDirectories: number;
    maxDepth: number;
    topLargestFiles: Array<{ path: string; lines: number; sizeKB: number }>;
    extensionStats: Record<string, number>;
  };

  violations: Violation[];

  scores: {
    total: number;                       // 0-100
    breakdown: {
      featureStructure: number;          // 0-25
      depth: number;                     // 0-25
      fileSize: number;                  // 0-25
      naming: number;                    // 0-25
    };
  };

  // 仅 mode='full' 时包含
  structure?: DirectoryNode;
}

// ============ 违规项 ============
interface Violation {
  code: 'SA001' | 'SA002' | 'SA003' | 'SA004' | 'SA005';
  severity: 'error' | 'warning' | 'info';
  message: string;
  path: string;
  evidence?: string;                     // 具体证据（如文件行数）
  suggestion: string;                    // 改进建议
}

// ============ 目录节点 ============
interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: DirectoryNode[];
  stats?: {
    lines?: number;
    sizeKB?: number;
  };
}
```

### 配置文件格式

**全局配置** (`config/loader-config.json`)：

```json
{
  "structureAnalyzer": {
    "thresholds": {
      "maxFileLines": 500,
      "maxDirectoryDepth": 5,
      "maxFileSizeKB": 100,
      "similarityThreshold": 0.8
    },
    "enabledRules": ["SA001", "SA002", "SA003", "SA004", "SA005"],
    "ignorePatterns": ["node_modules", "dist", ".git", "*.min.js"],
    "typeGroupedPatterns": ["components", "views", "store", "utils", "hooks", "services", "helpers"]
  }
}
```

**项目级配置** (`.structure-analyzer.json`)：

```json
{
  "extends": "default",
  "thresholds": {
    "maxFileLines": 800
  },
  "ignorePatterns": ["legacy/"]
}
```

### 检测规则详细说明

| 规则 | 类型 | 严重度 | 检测逻辑 | 扣分 |
|------|------|--------|----------|------|
| SA001 | type-grouped | warning | 顶层目录名匹配 `typeGroupedPatterns` | -5/个 |
| SA002 | deep-nesting | warning | 目录深度 > `maxDirectoryDepth` | -5/个 |
| SA003 | giant-file | error | 文件行数 > `maxFileLines` 或大小 > `maxFileSizeKB` | -10/个 |
| SA004 | similar-naming | warning | 同级目录下命名相似度 > `similarityThreshold` | -5/对 |
| SA005 | feature-violation | info | `features/*/internal/` 被其他 feature 路径引用 | -1/个 |

### 评分算法

```
基础分 = 100

featureStructure = 25 - (SA001数量 × 5)，最低 0
depth = 25 - (SA002数量 × 5)，最低 0
fileSize = 25 - (SA003数量 × 10)，最低 0
naming = 25 - (SA004数量 × 5) - (SA005数量 × 1)，最低 0

总分 = featureStructure + depth + fileSize + naming
```

### 交付物

- `scripts/src/structure-analyzer.ts`
- `scripts/src/types/structure-analyzer.d.ts`
- `scripts/dist/structure-analyzer.js`
- `config/loader-config.json` 更新（添加 structureAnalyzer 节点）

---

## 📦 Phase 2 (P1): MCP 工具集成

**预估时间**: 1-2 小时
**优先级**: 🟠 中

### 文件结构

```
mcp-server/
└── src/
    ├── index.ts                   # MCP 服务入口
    └── tools/
        └── structure-analyzer.ts  # 结构分析工具定义
```

### 任务清单

| # | 任务 | 验收标准 | 预估 | 状态 |
|---|------|----------|------|------|
| 2.1 | 定义 `analyze_project_structure` 工具 | 符合 MCP 规范 | 20min | ⬜ |
| 2.2 | 集成 structure-analyzer 脚本 | 可调用脚本 | 30min | ⬜ |
| 2.3 | 实现 mode 参数切换 | 三种模式正确 | 15min | ⬜ |
| 2.4 | 添加错误处理 | 友好错误提示 | 15min | ⬜ |
| 2.5 | 测试 MCP 工具调用 | AI 可成功调用 | 20min | ⬜ |

### MCP 工具定义

```typescript
{
  name: "analyze_project_structure",
  description: "分析目标项目的目录结构，检测反模式并生成健康度报告。默认返回精简的问题列表，避免消耗过多 Token。",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: {
        type: "string",
        description: "项目根目录的绝对路径"
      },
      mode: {
        type: "string",
        enum: ["problems_only", "summary", "full"],
        default: "problems_only",
        description: "输出模式：problems_only(仅违规项)、summary(含统计)、full(含完整树)"
      },
      maxDepth: {
        type: "number",
        default: 5,
        description: "最大扫描深度"
      },
      limitTopFiles: {
        type: "number",
        default: 20,
        description: "返回的 TopN 最大文件数量"
      }
    },
    required: ["projectPath"]
  }
}
```

### 交付物

- `mcp-server/src/tools/structure-analyzer.ts`
- 更新 `mcp-server/src/index.ts` 注册工具

---

## 📦 Phase 2.5 (新增): Structure-Analyzer Agent

**预估时间**: 0.5 小时
**优先级**: 🟠 中（实现 Agent 调用能力）

### 文件结构

```
agents/
└── structure-analyzer/
    ├── AGENT.md                       # Agent 定义文件
    ├── checklists/
    │   └── structure-checklist.md     # 结构检查清单
    └── templates/
        └── structure-report.md        # 报告模板
```

### 任务清单

| # | 任务 | 验收标准 | 预估 | 状态 |
|---|------|----------|------|------|
| 2.5.1 | 创建 AGENT.md | 符合 Agent 规范 | 15min | ⬜ |
| 2.5.2 | 编写结构检查清单 | 5 条规则说明 | 10min | ⬜ |
| 2.5.3 | 编写报告模板 | 完整输出格式 | 5min | ⬜ |
| 2.5.4 | 更新 AGENTS.md 注册 | 新 Agent 列入 | 5min | ⬜ |

### AGENT.md 内容

```yaml
---
name: structure-analyzer
version: 1.0.0
description: 项目结构分析 Agent，用于检测目录反模式并生成健康度报告
triggers:
  - "结构分析"
  - "目录审查"
  - "structure"
  - "架构检查"
  - "项目健康度"
permissions:
  tools:
    - read_file
    - list_directory
    - grep_search
    - mcp:analyze_project_structure
  skills:
    - structure-review
dependencies:
  layer1_base:
    - architecture/feature-based-structure
---

# Structure Analyzer Agent

项目结构分析专用 Agent，自动检测目录反模式并生成健康度报告。

## 职责范围

- **结构扫描**：扫描目标项目目录结构
- **反模式检测**：识别 5 种常见反模式（SA001-SA005）
- **健康度评分**：生成 0-100 分的量化评分
- **改进建议**：提供具体的重构建议

## 工作流程

### Phase 1: 环境检测
1. 确认目标项目路径
2. 检查是否存在项目级配置 `.structure-analyzer.json`
3. 加载配置（项目级 > 全局 > 默认）

### Phase 2: 结构分析
1. 调用 MCP 工具 `analyze_project_structure`
2. 获取 violations 和 scores
3. 识别关键问题

### Phase 3: 报告生成
1. 使用报告模板格式化输出
2. 按严重度排序违规项
3. 提供改进建议

### Phase 4: 后续建议
1. 判断是否需要重构
2. 推荐改造路径
3. 提示风险事项

## 调用示例

用户输入：
- "帮我分析一下这个项目的结构"
- "检查 src 目录的健康度"
- "这个项目的目录组织合理吗"

Agent 响应：
1. 确认目标路径
2. 执行结构分析
3. 输出结构化报告

## 与其他 Agent 协作

| 场景 | 协作 Agent | 协作方式 |
|------|------------|----------|
| 发现需要重构 | `planner` | 交接任务分解 |
| 发现性能问题 | `performance-profiler` | 建议深入分析 |
| 发现安全风险 | `security-reviewer` | 建议安全审查 |

## 输出格式

参见 `templates/structure-report.md` 获取完整报告模板。
```

### 交付物

- `agents/structure-analyzer/AGENT.md`
- `agents/structure-analyzer/checklists/structure-checklist.md`
- `agents/structure-analyzer/templates/structure-report.md`
- 更新 `agents/AGENTS.md`

---

## 📦 Phase 3 (P2): Skill 知识沉淀（增强版）

**预估时间**: 1 小时
**优先级**: 🟡 中（支持 Agent 和直接调用）

### 文件结构

```
custom-skills/
└── structure-review/
    ├── SKILL.md                       # 技能定义（可执行）
    └── references/
        ├── feature-based-patterns.md  # 正确模式示例
        ├── anti-patterns.md           # 反模式清单
        └── refactoring-strategies.md  # 重构策略
```

### 任务清单

| # | 任务 | 验收标准 | 预估 | 状态 |
|---|------|----------|------|------|
| 3.1 | 创建 SKILL.md（可执行版） | 符合技能规范，含工具绑定 | 20min | ⬜ |
| 3.2 | 编写正确模式示例 | 3+ 示例 | 15min | ⬜ |
| 3.3 | 编写反模式清单 | 5+ 反模式 | 15min | ⬜ |
| 3.4 | 编写重构策略 | 3 套路径 | 10min | ⬜ |

### SKILL.md 内容（可执行版）

```yaml
---
name: structure-review
description: "Trigger when the user asks about project structure, directory organization, or code architecture health. Automatically invokes MCP tool for analysis."
tools:
  - mcp:analyze_project_structure
triggers:
  - "结构"
  - "目录"
  - "架构健康"
  - "项目组织"
---

# Structure Review Skill

## Intent

Use this skill when the user asks to review project structure, check directory organization, or assess code architecture health. This skill automatically invokes the MCP `analyze_project_structure` tool and formats the results.

## Workflow

1. **Confirm target**: Ask user for project path if not provided
2. **Run analysis**: Call `analyze_project_structure` with `mode: "summary"`
3. **Format report**: Use the output template below
4. **Provide advice**: Recommend next steps based on score

## Tool Integration

This skill binds to MCP tool:

| Tool | Default Parameters | When to Use |
|------|-------------------|-------------|
| `analyze_project_structure` | `mode: "problems_only"` | Quick check |
| `analyze_project_structure` | `mode: "summary"` | Standard review |
| `analyze_project_structure` | `mode: "full"` | Deep analysis |

## Required Output

When invoked, follow this template:
```

### Skill 输出模板

```markdown
## 项目结构审查报告

### 1. 当前状态判定
- **结构类型**: [Feature-Based / Type-Grouped / 混合]
- **健康度评分**: [X/100]
- **配置来源**: [project / global / default]

### 2. 关键违规项
| 严重度 | 规则 | 位置 | 问题 | 建议 |
|--------|------|------|------|------|
| 🔴 error | SA003 | src/utils/mega.ts | 文件超过500行 | 拆分为多个模块 |
| 🟡 warning | SA001 | src/components/ | 按类型分组 | 改用 Feature-Based |

### 3. 改造建议
| 路径 | 适用场景 | 风险 | 预估工时 |
|------|----------|------|----------|
| 小步迁移 | 临近发布、测试不足 | 低 | 高 |
| 一次性迁移 | 新项目、测试完善 | 中 | 中 |
| 适配层过渡 | 历史包袱重 | 低 | 高 |

### 4. 不建议动结构的场景
- ⚠️ 距离发布 < 2 周
- ⚠️ 单元测试覆盖率 < 60%
- ⚠️ 存在未解决的 P0 Bug
```

### 交付物

- `custom-skills/structure-review/SKILL.md`
- `custom-skills/structure-review/references/feature-based-patterns.md`
- `custom-skills/structure-review/references/anti-patterns.md`
- `custom-skills/structure-review/references/refactoring-strategies.md`

---

## 📦 Phase 4 (P3): 依赖分析（暂缓）

**状态**: ⏸️ 暂缓
**原因**: TS paths / Webpack alias 处理成本较高，容易产生误报

### 未来考虑

- 实现 import 解析（ES6/CommonJS）
- 生成依赖图（Mermaid 格式）
- 循环依赖检测
- 需要处理的 alias 类型：
  - TypeScript paths (`tsconfig.json`)
  - Webpack resolve.alias
  - Vite resolve.alias
  - babel-plugin-module-resolver

---

## ✅ 验收标准

### Phase 0.5 验收
- [ ] 所有文档中的 `rule-loader.js` 已更新为 `codebuddy-loader.js`
- [ ] README.md 中的命令示例可正常执行

### Phase 1 验收
- [ ] `npm run build:scripts` 编译成功
- [ ] `node scripts/dist/structure-analyzer.js <path>` 可执行
- [ ] JSON 输出符合接口契约
- [ ] Markdown 输出人类可读
- [ ] 5 条规则全部生效
- [ ] 双层配置优先级正确

### Phase 2 验收
- [ ] MCP 工具注册成功
- [ ] AI 可通过 MCP 调用 `analyze_project_structure`
- [ ] 三种 mode 输出正确
- [ ] Token 消耗在合理范围内

### Phase 2.5 验收（新增）
- [ ] `agents/structure-analyzer/AGENT.md` 符合规范
- [ ] Agent 已在 `agents/AGENTS.md` 中注册
- [ ] 触发词可正确识别（"结构分析"、"目录审查"等）
- [ ] Agent 可成功调用 MCP 工具
- [ ] 报告模板输出格式正确

### Phase 3 验收（增强）
- [ ] SKILL.md 符合技能规范，含工具绑定
- [ ] Skill 触发词可正确识别
- [ ] Skill 可自动调用 MCP 工具
- [ ] 包含 3+ 正确模式示例
- [ ] 包含 5+ 反模式说明
- [ ] 包含 3 套重构策略

---

## 📝 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 大型项目扫描耗时过长 | 中 | 中 | 添加 maxDepth 限制，实现增量扫描 |
| 规则误报率高 | 低 | 高 | 提供配置选项关闭特定规则 |
| MCP 输出 Token 过多 | 中 | 中 | 默认 problems_only 模式 |
| 命名相似度算法不准确 | 低 | 低 | 可配置 similarityThreshold |

---

## 📚 参考资料

- [Feature-Based Structure 规范](../../../rules/layer1_base/architecture/feature-based-structure.md)
- [MCP 协议规范](https://modelcontextprotocol.io/)
- [原始讨论帖](../threads/001-structure-analysis-enhancement.md)

---

*计划版本: 1.0 | 创建日期: 2026-01-26 | 最后更新: 2026-01-26*
