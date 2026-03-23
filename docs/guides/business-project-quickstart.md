---
title: Business Project Quickstart
date: 2026-03-23
---

# Business Project Quickstart

这份文档只保留最短路径：

- 安装
- 启动闭环
- blocked 后继续
- 查看诊断和报告

如果你要看完整接入说明，再读 [Business Project Guide](./business-project-guide.md)。

## 1. 安装

在业务项目根目录执行：

```bash
node scripts/dist/codebuddy-loader.js
```

如果你使用远程源，Windows PowerShell 推荐：

```powershell
iwr https://your-server.com/standards/scripts/dist/codebuddy-install.js -OutFile codebuddy-install.js
node codebuddy-install.js --remote https://your-server.com/standards --profile full --pack-only
```

如果你使用远程源，按你的远程安装方式执行即可；Quickstart 不改变安装步骤。

安装后先确认：

```bash
node .codebuddy/scripts/codebuddy-loader.js status
node .codebuddy/scripts/codebuddy-loader.js doctor --json
```

预期结果：

- `.codebuddy/` 已生成
- `status` 可看到当前安装档位
- `doctor` 没有明显阻塞项

## 2. 启动闭环

直接从一句需求开始：

```bash
node .codebuddy/scripts/task-orchestrator.js "修复登录页 401 重试逻辑"
```

也可以显式指定类型：

```bash
node .codebuddy/scripts/task-orchestrator.js --title "修复登录 401" --description "处理重试和错误提示" --type debugging
```

如果想看系统为什么选到某个 workflow：

```bash
node .codebuddy/scripts/task-orchestrator.js --taskbook <taskBookId> --show-workflow-route --json
```

如果当前任务很小、边界清楚、契约明确，优先走直执行，不必默认先拉起 orchestrator。

典型场景：

- 已提供 API 文档的 mock -> real API 替换
- 单模块字段映射调整
- 小范围局部修复

这类任务建议先让 AI：

1. 阅读需求/API 文档和当前相关代码
2. 给出一个极短执行计划
3. 直接改代码并做最小验证

只有当任务跨模块、跨业务域、或需要交接/追踪时，再切回 `task-orchestrator` 路径。

## 3. blocked 后继续

先看当前 TaskBook：

```bash
node .codebuddy/scripts/taskbook-manager.js show <taskBookId>
```

如果只是继续执行：

```bash
node .codebuddy/scripts/task-executor.js <taskBookId>
```

如果需要显式启用自动 workflow 路由：

```bash
node .codebuddy/scripts/task-executor.js <taskBookId> --workflow auto --show-workflow-route
```

如果某个任务需要人工解除阻塞：

```bash
node .codebuddy/scripts/taskbook-manager.js unblock <taskBookId> <taskId> --resolution "已补充上下文"
```

如果执行过程中生成了外部写回文件：

```text
.codebuddy/agent-calls/<requestId>.prompt.md
.codebuddy/agent-calls/<requestId>.result.json
```

处理完写回后，重新执行 `task-orchestrator` 或 `task-executor` 即可继续。

## 4. 查看诊断和报告

安装与稳定性诊断：

```bash
node .codebuddy/scripts/codebuddy-loader.js doctor --json
```

当前报告状态：

```bash
node .codebuddy/scripts/report-manager.js status
```

导出 Markdown 报告：

```bash
node .codebuddy/scripts/report-manager.js export
```

热点模块：

```bash
node .codebuddy/scripts/report-manager.js hotspots --top 10
```

自动 workflow 路由报告位置：

```text
.codebuddy/reports/workflow-routing/<taskBookId>.routing.json
```

## 5. 一分钟版本

```bash
# 1) 安装/同步
node scripts/dist/codebuddy-loader.js

# 2) 确认状态
node .codebuddy/scripts/codebuddy-loader.js status
node .codebuddy/scripts/codebuddy-loader.js doctor --json

# 3) 启动闭环
node .codebuddy/scripts/task-orchestrator.js "修复登录页 401 重试逻辑"

# 4) 查看结果
node .codebuddy/scripts/report-manager.js status

# 5) 继续推进
node .codebuddy/scripts/task-executor.js <taskBookId>
```

小任务版本：

```bash
# 1) 安装/同步
node scripts/dist/codebuddy-loader.js

# 2) 让 AI 先读 API/需求文档与当前相关代码

# 3) 直接执行小范围替换

# 4) 做最小验证
npm run build
npm test
```

## 6. 下一步

- 想看完整接入：读 [Business Project Guide](./business-project-guide.md)
- 想看 workflow 细节：读 [Workflows Guide](./workflows-guide.md)
- 想看远程接入：读 [Remote Usage Guide](./remote-usage-guide.md)
- 想看试点范围：读 [Business Pilot Plan](./business-pilot-plan.md)
