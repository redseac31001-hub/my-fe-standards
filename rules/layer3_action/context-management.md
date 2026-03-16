---
name: Context Management
description: 上下文裁剪分级策略。为所有 Agent 提供统一的文件读取预算控制和依赖图驱动的优先级排序。
tags:
  - ContextManagement
  - LargeCodebase
  - Navigation
priority: High
alwaysApply: true
---

# Context Management Strategy

> Layer: Action
> Context: Multi-File Task / Large Codebase Navigation

<!-- @level:summary -->
## Summary (摘要)

当任务涉及多个文件时，不加限制地读取所有关联文件会导致上下文溢出、注意力分散和效率下降。本规则定义 4 级上下文裁剪策略，所有 Agent 在读取文件前必须先评估关联文件数量，选择对应级别的读取策略。

**核心原则**：先评估范围，再按预算读取，边读边验证假设，按需扩展。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 裁剪分级速查

| 级别 | 文件数 | 策略 | 说明 |
|------|--------|------|------|
| Level 1 | ≤ 5 | 全量读取 | 直接读取所有文件全文 |
| Level 2 | 6-15 | 焦点读取 | 入口全文 + 其余只读接口签名 |
| Level 3 | 16-30 | 分批读取 | 按模块分批，每批 ≤ 8 个 |
| Level 4 | > 30 | 结构化扫描 | 先全局视图，再深入 1-2 个模块 |

### 权重排序速查

| 文件类型 | 权重 |
|----------|------|
| 报错堆栈中直接出现的文件 | 10 |
| 深度 1 直接依赖 | 5 |
| 深度 2 间接依赖 | 2 |
| 全局共享模块（utils/helpers） | 1 |

<!-- @level:full -->
## 1. 上下文裁剪分级策略

### Level 1: 全量读取（≤ 5 文件）

```
策略: 直接读取所有文件全文
适用: 单模块修改、小范围 bug 修复
```

- 无需裁剪，直接读取所有关联文件
- 每个文件读取全文内容
- 适合大部分单组件/单模块任务

### Level 2: 焦点读取（6-15 文件）

```
策略: 入口文件全文 + 其余文件只读接口定义
适用: 跨模块修改、中等规模重构
```

- 入口文件（触发任务的核心文件）：读取全文
- 其余文件：只读取以下内容
  - 类型声明（interface/type/enum）
  - 导出函数签名（export function xxx(...)）
  - 组件 Props/Emits 定义
  - Store 的 state/getters/actions 签名
- 深入读取哪些文件由 module-mapper 依赖权重决定
- 按权重从高到低选择，累计不超过 5 个文件深入读取

### Level 3: 分批读取（16-30 文件）

```
策略: 按模块分批，每批不超过 8 个文件
适用: 大规模重构、跨多模块功能
```

- 按模块/目录将文件分组
- 每批不超过 8 个文件
- 每批读完先提出假设，验证后再决定是否扩展下一批
- 优先级排序：
  1. 报错堆栈中出现的文件
  2. 直接依赖（depth 1）
  3. 间接依赖（depth 2）
  4. 工具/辅助模块

### Level 4: 结构化扫描（> 30 文件）

```
策略: 先全局视图，再深入 1-2 个模块
适用: 系统级重构、架构迁移
```

- 第一步：运行 `module-mapper --mode summary` 获取全局模块概览
- 第二步：根据任务目标选择相关度最高的 1-2 个模块
- 第三步：对选定模块执行 Level 2 或 Level 3 策略
- 第四步：明确告知用户需要分阶段处理，单次不覆盖所有模块

## 2. 依赖图驱动的优先级排序

当需要从多个文件中选择读取优先级时，按以下流程排序：

### 获取依赖信息

```bash
# 如果 module-mapper 可用
node .codebuddy/scripts/module-mapper.js . --entry <entryFile>

# 如果 report-manager 可用
node .codebuddy/scripts/report-manager.js inspect --module <targetModule>
```

### 权重计算

```
1. 获取目标模块的上下游依赖列表
2. 为每个文件分配权重:
   - 报错堆栈中直接出现的文件: 权重 10
   - 深度 1 直接依赖（import/export 直接关联）: 权重 5
   - 深度 2 间接依赖: 权重 2
   - 全局共享模块（utils/helpers/constants）: 权重 1
3. 按权重从高到低排序
4. 按当前 Level 的上限截取
```

### 无依赖分析工具时的降级方案

如果 module-mapper 和 report-manager 不可用：

1. 读取入口文件的 import 语句，手动构建深度 1 依赖列表
2. 按文件路径判断模块归属（同目录 > 相邻目录 > 远端目录）
3. 优先读取与入口文件同目录的文件

## 3. Agent 适用指南

### 各 Agent 的上下文控制要点

| Agent | 典型 Level | 说明 |
|-------|-----------|------|
| `bug-investigator` | Level 1-3 | Phase 2 依赖图裁剪直接使用本规则 |
| `task-orchestrator` | Level 2-4 | Phase 2 上下文收集应替换无限制的 `Glob: **/*` |
| `code-reviewer` | Level 2-3 | 已有 ">20 文件分批" 策略，与本规则对齐 |
| `build-fix` | Level 1-2 | 按 P0-P4 优先级修复，通常文件范围小 |
| `tdd-driver` | Level 1-2 | 测试范围通常聚焦单模块 |

### 通用执行流程

```
1. 收到任务后，首先统计关联文件数量
2. 确定当前 Level（1/2/3/4）
3. 按对应策略控制读取范围
4. 读取过程中如发现需要扩展，记录理由后可升级一个 Level
5. 单次升级后仍不足，告知用户需分阶段处理
```

## 4. Metadata
*   **Version**: 1.0
*   **Related Rules**: `debugging.md`, `refactoring.md`, `self-verification.md`
*   **Related Agents**: `bug-investigator`, `task-orchestrator`, `code-reviewer`
