---
title: 自动 Workflow 路由增强计划
date: 2026-03-14
source: user requirement
---

# 自动 Workflow 路由增强计划

目标：把现有 `micro / sprint / default` 三档 workflow 从“用户手工选择的三个模板”，升级为“系统可解释、可复用、可回放的自动路由能力”，让现有 TaskBook / Workflow / Handoff / Validator / Doctor 形成联动增益，而不是继续增加孤立能力点。

## 为什么这是 `1 + 1 > 2`

当前仓库已经具备：

- 三档 workflow 模板
- TaskBook 作为 SSOT
- `task-orchestrator` / `task-executor` 执行链
- `handoff` 持久化
- `contract-validator` / `doctor` 诊断能力

但它们之间还缺少一个“自动选择正确执行路径”的连接层。

如果只增加更多 workflow 模板，结果只是：

- 能力数量变多
- 用户判断成本上升
- AI IDE / 调用方仍然要自己选 workflow

这属于 `1 + 1 = 2`。

本计划追求的增强结果是：

1. 同一个入口，根据任务规模/风险自动走更合适的 workflow。
2. 已有的 workflow、gates、handoff、metrics 不再孤立存在，而是由同一套路由决策触发。
3. 同一份 TaskBook 能在重跑/回流时保持一致的 workflow 选择，减少人工判断和上下文丢失。

这才是 `1 + 1 > 2`。

## 范围

本计划覆盖：

- workflow 自动路由规则
- `task-orchestrator` 的自动 workflow 选择
- `task-executor` 的可选自动 workflow 模式
- 路由决策报告与可观测性
- 相关 CLI / 文档 / 测试

本计划不覆盖：

- Model Router / 弱模型强模型分流
- 新增第四档默认 workflow
- `agent-call` 协议变更
- `.codebuddy/` 核心目录重构
- 让安装命令变长或新增 mandatory dependency

## 硬约束

以下约束必须满足，任何设计不得突破：

1. 默认安装方式不变。
2. AI IDE / 工具调用链不增加新的必做步骤。
3. `.codebuddy/agent-calls/*` 协议不变。
4. 明确指定的 `--workflow <path>` 永远优先于自动路由。
5. 自动路由必须可解释、可回放、可审计，不能是黑盒。
6. 失败时必须安全回退到 `default.workflow.json`，不能阻断主链路。

## 详细需求

## R1. 自动路由必须是增量能力，不是强制迁移

- `task-orchestrator` 在未显式指定 `--workflow` 时，默认启用自动路由。
- `task-executor` 保持当前兼容行为：
  - 直接执行时，`--workflow <path>` 继续可用
  - 不带参数时默认仍可读取 `default.workflow.json`
  - 新增显式 `--workflow auto` 或等价开关时才进入自动路由

理由：

- 这样可以让“一键闭环入口”先获益
- 又不会破坏已有直接调用 `task-executor` 的脚本、AI IDE、测试和人工习惯

## R2. 路由决策必须可解释

系统必须输出：

- 选中了哪个 workflow
- 为什么选它
- 命中了哪些信号
- 哪些信号让更轻/更重的 workflow 被排除

决策不能只输出一个最终结果。

## R3. 路由决策必须可复用

同一个 TaskBook 在以下场景应优先复用同一次决策：

- review 返工后重跑
- build-fix 回流后重跑
- `task-orchestrator --watch` 持续推进
- 人工写回 `agent-call` 结果后继续执行

除非用户显式切换 workflow，或检测到 TaskBook 规模/结构已发生“跨阈值变化”。

## R4. 路由决策必须安全

自动路由失败时：

- 不得中断执行入口
- 必须回退到 `default.workflow.json`
- 必须记录 fallback 原因

## R5. 路由信号必须来自已有事实源

第一阶段不引入新的外部服务或复杂依赖，路由输入仅使用：

- TaskBook 元数据
- TaskBook tasks / dependencies / scope
- workspace/project detection 信息
- workflow 模板本身的已知能力边界
- 已有 reports / install state 中可直接读取的信息

## R6. 路由必须与已有 workflow 形成明确边界

### `micro`

适合：

- hotfix
- 单文件或少量文件变更
- 小 bug 修复
- 1-3 个任务
- 无 requirement/prd
- 无独立 review 阶段刚性要求

### `sprint`

适合：

- 中等规模功能迭代
- 单模块或单子项目的中等改动
- 4-8 个任务
- 需要 review，但不需要 requirement/prd 和独立 build-fix step

### `default`

适合：

- 大型功能
- 跨模块重构
- 多子项目或多边界联动
- 存在 requirement/prd/design/build-fix/review 全闭环需求
- 任务规模较大或风险较高

## R7. 路由结果必须纳入可观测性

系统至少需要记录：

- route mode: explicit / reused / auto / fallback
- selected workflow id/path
- route reasons
- route timestamp

这样后续才能分析：

- workflow 选择是否准确
- 哪种任务经常被误判
- 哪条 workflow 的返工率更高

## 详细设计

## 总体架构

新增一层独立的“workflow 路由模块”，位置建议：

- `scripts/src/lib/workflow-routing.ts`

职责：

1. 收集路由输入
2. 对 `micro / sprint / default` 做规则判断或评分
3. 产出结构化决策对象
4. 提供安全 fallback

它不负责执行 workflow，也不直接修改 TaskBook 状态。

执行职责仍留在：

- `task-orchestrator.ts`
- `task-executor.ts`

## 核心数据结构

建议新增以下类型：

```ts
type WorkflowRouteId = 'micro' | 'sprint' | 'default';

interface WorkflowRoutingSignal {
  id: string;
  matched: boolean;
  weight?: number;
  detail?: string;
}

interface WorkflowRoutingDecision {
  mode: 'explicit' | 'reused' | 'auto' | 'fallback';
  selectedWorkflowId: WorkflowRouteId;
  selectedWorkflowPath: string;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  signals: WorkflowRoutingSignal[];
  reusedFromTaskBook?: boolean;
  fallbackReason?: string;
  generatedAt: string;
}
```

## 路由输入模型

建议使用一个纯数据输入对象：

```ts
interface WorkflowRoutingInput {
  taskBookId: string;
  taskType: string | null;
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
  existingDecision?: WorkflowRoutingDecision | null;
}
```

## 路由规则

第一阶段建议采用“规则优先 + 轻量评分”的确定性实现，而不是黑盒打分模型。

### Step 1: 强制规则

以下情况直接选 `default`：

- 存在 `requirement` / `prd` / `design` 任务
- 存在跨多个子项目的信号
- 任务数 > 8
- 明显需要独立 `build-fix` 闭环
- 任务标题/描述命中“新功能 / 架构调整 / 大规模重构 / 跨模块”

以下情况可直接选 `micro`：

- 任务数 <= 3
- 无 `review`、`requirement`、`prd`、`design`
- `scope.files + scope.modules` 总量很小
- 标题/描述命中“hotfix / 小 bug / 单文件 / 快速修复”

### Step 2: 中间层判断

若未命中上述强制规则，则根据以下信号判定 `sprint`：

- 任务数在 4-8 之间
- 有 `review` 但无 `requirement/prd/design`
- 范围集中在单模块或单子项目
- 需要完整 review，但不需要最重的 requirement/build-fix 闭环

### Step 3: 保守 fallback

当信号不够清晰时，默认选 `default`。

设计原则：

- 宁可重，不可轻错
- `default` 是保守路径
- `micro` 是最需要谨慎分配的路径

## 决策优先级

最终优先级顺序：

1. 用户显式传入 `--workflow <path>`
2. 已存在且仍然有效的路由决策
3. 自动路由重新计算
4. fallback 到 `default.workflow.json`

## 决策持久化

为避免改动 TaskBook schema 的稳定面，第一阶段不建议把路由结果写入 TaskBook 顶层结构。

建议写入：

- `.codebuddy/reports/workflow-routing/<taskBookId>.routing.json`

并同步写入 changelog：

- `workflow routing selected: micro|sprint|default`
- `workflow routing reused`
- `workflow routing fallback`

这样可以：

- 保持 TaskBook schema 稳定
- 让 `doctor/report` 后续容易读取
- 保持业务项目与远程分发兼容

## `task-orchestrator` 集成设计

### 现状

`task-orchestrator` 目前接收：

- `--workflow <path>`
- 然后直接透传给 `task-executor`

### 目标行为

当未显式指定 `--workflow` 时：

1. 读取 TaskBook
2. 收集 route inputs
3. 调用 `workflow-routing.ts`
4. 生成 routing report
5. 将结果透传给 `task-executor`

新增建议：

- `--workflow auto`
- `--show-workflow-route`

但默认对 `task-orchestrator` 来说，可直接启用 auto，无需用户加新参数。

## `task-executor` 集成设计

### 现状

- 默认读取 `.codebuddy/workflows/default.workflow.json`

### 目标行为

保持向后兼容：

- `node task-executor.js <id>` 仍默认走 `default`
- 新增 `--workflow auto` 时才执行自动路由

理由：

- 直接调用 `task-executor` 的往往是脚本、测试、现有工具链
- 不应在这里引入“静默行为变化”

## 诊断与报告集成

第二阶段可把 routing report 接到：

- `report-manager`
- `loader doctor`

但第一阶段只要求：

- 路由报告可落盘
- JSON 结构稳定

## CLI 设计

### `task-orchestrator`

支持：

- `--workflow <path>`：显式指定，最高优先级
- `--workflow auto`：显式要求自动路由
- 不带 `--workflow`：默认自动路由
- `--show-workflow-route`：打印决策理由

### `task-executor`

支持：

- `--workflow <path>`：保持不变
- `--workflow auto`：启用自动路由
- 不带 `--workflow`：保持当前兼容行为，继续使用 `default`

## 指标设计

建议新增以下 execution metrics 事件：

- `workflow_route_selected`
- `workflow_route_reused`
- `workflow_route_fallback`

至少记录：

- taskBookId
- workflowId
- mode
- confidence
- routeReasons

## 分阶段任务

## Phase 0：基线与规则冻结

### 目标

先把路由边界和三档 workflow 的定位冻结，避免边实现边改变定义。

### 改动

- 固化 `micro / sprint / default` 的适用边界
- 固化自动路由的兼容策略
- 决定 report 落盘路径和 JSON 结构

### 涉及文件

- `docs/plans/automatic-workflow-routing-plan.md`
- `ROADMAP.md`

### 完成标准

- 路由优先级清晰
- fallback 规则清晰
- 与架构约束清单无冲突

## Phase 1：纯路由库

### 目标

先实现纯函数路由能力，不碰执行链主逻辑。

### 改动

1. 新增 `scripts/src/lib/workflow-routing.ts`
2. 实现：
   - 输入收集适配函数
   - 规则判断
   - 决策对象输出
   - fallback 逻辑
3. 新增最小单元级 baseline 测试

### 涉及文件

- `scripts/src/lib/workflow-routing.ts`
- `scripts/src/types/index.ts`
- `test/lib-baseline.test.mjs`

### 验收标准

- 给定固定输入，输出稳定可预测
- 至少覆盖：
  - micro case
  - sprint case
  - default case
  - fallback case

## Phase 2：接入 `task-orchestrator`

### 目标

让“一键闭环入口”先获得自动路由收益。

### 改动

1. 在 `task-orchestrator.ts` 中新增自动路由集成
2. 生成 routing report
3. 透传选中的 workflow 给 `task-executor`
4. 增加 `--show-workflow-route`

### 涉及文件

- `scripts/src/task-orchestrator.ts`
- `scripts/src/lib/workflow-routing.ts`
- `test/test-correctness-regressions.mjs`

### 验收标准

- 未指定 workflow 时，orchestrator 能自动选择 workflow
- 显式 `--workflow <path>` 不被覆盖
- report 正常落盘
- rerun 时可复用既有决策

## Phase 3：接入 `task-executor` 可选 auto 模式

### 目标

给直接执行入口提供增强，但不破坏兼容默认值。

### 改动

1. `task-executor` 支持 `--workflow auto`
2. 使用同一套路由库
3. 保持无参数默认行为不变

### 涉及文件

- `scripts/src/task-executor.ts`
- `scripts/src/lib/workflow-routing.ts`
- `docs/guides/workflows-guide.md`

### 验收标准

- `--workflow auto` 生效
- 不带参数仍走当前默认
- 不影响现有 correctness 和 E2E

## Phase 4：可观测性与诊断集成

### 目标

让自动路由不是“一次性决策”，而是可持续优化的能力。

### 改动

1. 路由事件进入 metrics
2. 报告入口可读取 routing report
3. `doctor` 可在未来识别明显的路由漂移信号

### 涉及文件

- `scripts/src/lib/execution-metrics.ts`
- `scripts/src/report-manager.ts`
- `scripts/src/lib/install-health.ts`

### 验收标准

- 可以回答“系统最近更偏向选择哪档 workflow”
- 可以定位误判和 fallback 的原因

## Phase 5：文档、回归、推广

### 目标

把这项能力变成“默认可用但不增加步骤”的产品能力。

### 改动

1. 更新 workflow guide / README
2. 补 E2E：
   - 微型任务自动选 micro
   - 中型任务自动选 sprint
   - 高风险任务自动选 default
3. 输出升级说明

### 验收标准

- 新用户不需要知道三档 workflow 也能走通主链路
- 老用户显式指定 workflow 的方式不受影响

## 测试方案

## 单元/基线测试

- 纯路由规则判断
- 决策优先级
- fallback 逻辑

## 正确性测试

- orchestrator 自动选路
- rerun 复用路由决策
- 显式 `--workflow` 覆盖 auto

## E2E 测试

至少覆盖三类用例：

1. hotfix / 单文件 bug -> `micro`
2. 中等功能迭代 -> `sprint`
3. 跨模块 / requirement-prd -> `default`

## 风险与控制

## 风险 1：误把重任务判成 `micro`

控制：

- 默认保守
- 模糊场景回退 `default`

## 风险 2：重跑时 workflow 来回切换

控制：

- 优先复用既有决策
- 只有检测到任务规模跨阈值变化才重新选择

## 风险 3：直接调用 `task-executor` 的现有脚本被静默改变

控制：

- `task-executor` 默认行为不变
- auto 仅在显式模式下生效

## 风险 4：又增加一个孤立报告文件

控制：

- routing report 必须成为后续 metrics/report-manager 可消费输入
- 不做一次性文档产物

## 最终交付物

完成后应至少产出：

1. 一套可解释的 workflow 自动路由规则
2. 一个共享的路由库实现
3. `task-orchestrator` 自动选路能力
4. `task-executor --workflow auto`
5. routing report + metrics
6. 对应 baseline / correctness / E2E 回归

## 推荐执行顺序

1. Phase 0：冻结边界和契约
2. Phase 1：实现纯路由库
3. Phase 2：先接 orchestrator
4. Phase 3：再接 executor 的可选 auto 模式
5. Phase 4：补 metrics / doctor / report
6. Phase 5：补文档和 E2E，形成正式能力
