---
title: Product Surface Guide
date: 2026-03-16
---

# Product Surface Guide

这份文档不解释内部实现细节，只回答一个问题：

**当你把 `my-fe-standards` 当成产品来用时，应该从哪里进入、遇到问题去哪里看、要推进闭环时走哪条路径。**

## 设计原则

- 默认路径最短，不新增必做步骤
- 高级能力可选开启，不污染主链路
- 安装、执行、观察、扩展四条路径分开描述
- CLI 协议与 `.codebuddy/` 契约保持稳定

## 四个产品入口

### 1. 安装 / 同步

适用对象：

- 首次接入业务项目的人
- 维护安装状态的人
- 需要本地 / 远程分发的人

主入口：

```bash
# 安装或同步到当前项目
node scripts/dist/codebuddy-loader.js

# 查看当前项目安装状态
node scripts/dist/codebuddy-loader.js status

# 诊断当前项目安装问题
node scripts/dist/codebuddy-loader.js doctor --json
```

你需要关注的结果：

- `.codebuddy/` 是否已生成
- 当前安装档位是 `core / analysis / orchestrator / full` 哪一档
- `doctor` 是否有明显 warning

相关文档：

- [Business Project Guide](./business-project-guide.md)
- [Private Deployment Guide](./private-deployment-guide.md)
- [Remote Usage Guide](./remote-usage-guide.md)

### 2. 开始执行闭环

适用对象：

- 想从需求直接推进到 TaskBook / Workflow / gate / agent-call 闭环的人

主入口：

```bash
# 一句话启动闭环
node .codebuddy/scripts/task-orchestrator.js "修复登录页 401 重试逻辑"

# 也可以用结构化输入
node .codebuddy/scripts/task-orchestrator.js --title "修复登录 401" --description "处理重试和提示" --type debugging
```

当你不显式指定 `--workflow` 时，`task-orchestrator` 会自动选择 `micro / sprint / default`。

如果你只关心为什么选到某个 workflow：

```bash
node .codebuddy/scripts/task-orchestrator.js --taskbook <taskBookId> --show-workflow-route --json
```

相关文档：

- [Workflows Guide](./workflows-guide.md)
- [E2E Validation Playbook](./e2e-validation-playbook.md)

### 3. 接管 / 继续推进

适用对象：

- orchestrator 已经生成 TaskBook，但你要人工介入
- 某个任务 blocked，需要补信息或继续执行
- 你想只执行 workflow，不重跑规划

主入口：

```bash
# 查看 TaskBook
node .codebuddy/scripts/taskbook-manager.js show <taskBookId>

# 继续执行 workflow
node .codebuddy/scripts/task-executor.js <taskBookId>

# 显式启用自动 workflow 路由
node .codebuddy/scripts/task-executor.js <taskBookId> --workflow auto --show-workflow-route

# 人工解除阻塞
node .codebuddy/scripts/taskbook-manager.js unblock <taskBookId> <taskId> --resolution "已补充上下文"
```

当执行过程需要外部 AI IDE / Agent 写回时，`task-executor` 会生成：

```text
.codebuddy/agent-calls/<requestId>.prompt.md
.codebuddy/agent-calls/<requestId>.result.json
```

这个文件契约是当前主链路的一部分，不建议随意改变。

相关文档：

- [Agent Call Remote](./agent-call-remote.md)
- [TaskBook Collaboration SOP](./taskbook-collaboration-sop.md)

### 4. 观察 / 诊断 / 汇报

适用对象：

- 想知道系统最近发生了什么
- 想看 workflow 路由、报告、趋势、热点
- 想判断“该继续调优哪里”

主入口：

```bash
# 安装层诊断
node .codebuddy/scripts/codebuddy-loader.js doctor --json

# 查看报告状态
node .codebuddy/scripts/report-manager.js status

# 导出 Markdown 报告
node .codebuddy/scripts/report-manager.js export

# 查看热点模块
node .codebuddy/scripts/report-manager.js hotspots --top 10
```

自动 workflow 路由的报告位置：

```text
.codebuddy/reports/workflow-routing/<taskBookId>.routing.json
```

执行指标的报告位置：

```text
.codebuddy/reports/metrics/execution-events.jsonl
.codebuddy/reports/metrics/latest-summary.json
```

相关文档：

- [Execution Metrics](../reference/execution-metrics.md)
- [Architecture Constraints](../reference/architecture-constraints.md)

## 推荐路径

### Day 0：接入

1. 运行 `codebuddy-loader`
2. 用 `status` / `doctor` 确认安装状态
3. 不做任何高级配置，先保持默认路径

### Day 1：闭环

1. 用 `task-orchestrator` 启动需求
2. 用 `taskbook-manager` / `task-executor` 继续推进
3. 遇到人工介入点时处理 `agent-call`

### Day 2：观察与调优

1. 看 `doctor`
2. 看 `report-manager status/export`
3. 看 workflow routing report 和 metrics summary
4. 只有看到真实误判或真实 friction，再去调优 workflow / doctor / routing

## 什么不应该做

- 不要默认把所有高级能力都开起来
- 不要为了一个新场景改变默认安装命令
- 不要修改 `.codebuddy/agent-calls/*.prompt.md` / `.result.json` 的契约
- 不要把产品入口重新拆回“到处找脚本名”

## 一句话版本

把它当成四个稳定入口来理解：

- `loader` 负责安装与诊断
- `orchestrator / executor / taskbook-manager` 负责执行闭环
- `report-manager` 负责观察与汇报
- 远程分发、工具转换、架构约束属于扩展层，不进入默认主路径
