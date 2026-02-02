---
title: 交接/接力说明（my-fe-standards）
date: 2026-02-02
---

# 交接/接力说明（my-fe-standards）

目的：让团队成员 **clone 本仓库 + 登录自己的 Codex** 后，不依赖聊天上下文，也能快速知道“现在做到哪 / 下一步做什么 / 怎么验证”。

## 1) 当前状态（以 `git status` 为准）

- 默认协作分支建议：`feature/codebuddy-glm`（或你当下用于开发的 `wip/*` 分支）
- 2026-02-02 已验证通过：`npm run build` + `node test/run-tests.js`
- 2026-02-02 MCP Server 已对齐 CLI：新增 `taskbook_report` / `taskbook_unblock`
- 2026-02-02 TaskBook 并发协作 SOP 已落地：`docs/taskbook-collaboration-sop.md`（含可选强制模式 `CODEBUDDY_TASKBOOK_REQUIRE_IF_REV=1` / `--require-if-rev`）
- 2026-02-02 Reports 查询入口已落地：`report-manager.js inspect/hotspots` + MCP `reports_inspect/reports_hotspots`
- 2026-02-02 质量门禁 gates 已扩大：lint/typecheck/security/perf（`default.workflow.json@1.3.0`，默认 optional；证据落盘到 `.codebuddy/reports/gates/<taskBookId>/...`，并在验收报告 `gates[].evidencePath` 汇总）
- 接手前先看：
  - `PROJECT.md`：能力清单/架构图谱（权威概览）
  - `README.md`：快速入口与命令
  - `docs/workflows-guide.md`：Workflow Spec 与闭环执行方式
  - `docs/e2e-validation-playbook.md`：业务项目端到端验收脚本（remote 加载 → 闭环）

> Codex 不会继承你同事的对话上下文，所以“进度”必须落在仓库文件里（本文 + PROJECT/README）。

## 2) 接手者 10 分钟快速验证（必跑）

在仓库根目录：

```bash
npm i
npm run build
node test/run-tests.js
```

预期：

- `npm run build` 成功（会编译 `scripts/src/*` 并生成 `manifest.json`）
- `node test/run-tests.js` 全部通过（会在 mock projects 中跑通单任务闭环 + batching + gates）

> 如果你只改了 docs，可跳过测试；但准备交接/合并前建议完整跑一遍。

## 3) 交接时怎么“提交未完成任务”（WIP 最佳实践）

推荐用 WIP 分支承载进行中工作，避免污染稳定分支：

```bash
git checkout -b wip/2026-02-01-handoff
git add -A
git commit -m "wip: handoff snapshot"
git push -u origin wip/2026-02-01-handoff
```

接手者：

```bash
git fetch
git checkout wip/2026-02-01-handoff
```

建议在 commit message 或 PR 描述里写清：

- 这次 WIP 的目标/边界
- 当前已完成点
- 未完成点（下一步按什么顺序做）
- 如何验证（命令 + 预期）

## 4) 已落地的关键“事实源”（用于接力）

- 工作流契约（可被工具/模型复用）：`workflows/templates/default.workflow.json`
- 编译后可分发的脚本（业务项目 remote 会用到）：`scripts/dist/`
- 集成验证（保证别人接手不跑偏）：`test/run-tests.js`
- 验收/恢复操作的命令（可人工介入后继续闭环）：`docs/workflows-guide.md`

## 5) 下一步建议（Backlog，按优先级）

P0（团队接力/协作体验）
- ✅（2026-02-02）MCP Server 已补齐 `taskbook_report` / `taskbook_unblock`（与 CLI 对齐）
- ✅（2026-02-02）已梳理“多人并发改同一 TaskBook”协作约定：强制 `--if-rev` / claim 规则 / 冲突处理 SOP（见 `docs/taskbook-collaboration-sop.md`）

P1（老项目接手效率）
- ✅（2026-02-02）在 reports 基础上补“查询入口”（按模块/文件查上下游、热点、变更趋势），让重构定位更快

P2（质量门禁扩大）
- ✅（2026-02-02）将 lint/typecheck/security/perf 等标准化为 gates（默认 optional：缺脚本 skipped；证据落盘 → acceptance report 汇总）

---

如需“更强的实时接力”（少 pull、多人同时改同一份事实源），建议把 TaskBook/Workflow 的事实源放到共享工作目录或集中式服务（例如团队内网部署 MCP Server），但先保持 Git 方案最稳。
