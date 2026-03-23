---
title: 交接/接力说明（my-fe-standards）
date: 2026-02-07
---

# 交接/接力说明（my-fe-standards）

目的：让团队成员 **clone 本仓库 + 登录自己的 Codex** 后，不依赖聊天上下文，也能快速知道“现在做到哪 / 下一步做什么 / 怎么验证”。

## 1) 当前状态（以 `git status` 为准）

- 默认协作分支建议：`feature/codebuddy-glm`（或你当下用于开发的 `wip/*` 分支）
- 2026-02-02 已验证通过：`npm run build` + `node test/run-tests.js`
- 2026-02-04 已验证通过：`npm run build` + `node test/run-tests.js`（含 `task-orchestrator --watch` + `agent-call-manager serve /orchestrate` E2E + validators）
- 2026-02-07 已验证通过：`npm run build` + `node test/run-tests.js`（Workflow v2.0.0 七步闭环 + 3 个新 Agent + Prompt 模板体系）
- 2026-03-12 已重新验证通过：`npm run build` + `npm run test:correctness` + `npm run test:full`
- 2026-03-12 已确认主链路失败根因不是 `EPERM`，而是业务项目内 `.codebuddy/scripts/*.js` 缺少随脚本一起分发的 `scripts/dist/lib/*.js` 运行时依赖；该问题已修复并通过本地/远程 E2E 回归
- 2026-03-23 `P11 Release Readiness and Collaboration Reliability` 已完成：`P11.1 repo-state-validator`、`P11.2 quick/release gate`、`P11.3 audit 标准报告通道`、`P11.4 mcp-server` 依赖健康例外收口均已落地；`gate:release` 的本地长链路稳定性继续封存为非阻塞项
- 2026-03-20 `P11.3` 已重新验证通过：`npm run build`、`npm run test:lib`、`node test/run-tests.js --suite local --case vue3-project`
- 2026-03-23 已新增基础执行约定 `Small-Change Direct Execution First`：小范围、契约明确、低不确定性的任务默认直执行，不默认拉起 orchestrator/workflow/agent；复杂或跨域任务再升级到编排路径
- 2026-03-23 `P12 Task Intake Router` Phase 1 已完成：共享 intake 决策模型与独立 CLI 已落地，团队现在可以在不改变现有 orchestrator 默认行为的前提下，用统一命令判断“直执行 vs 编排”
- 2026-03-23 `P12 Task Intake Router` 已延伸到业务项目安装面：`analysis` 及更重 profile 会分发 `.codebuddy/scripts/task-intake-router.js`，安装后 README 也会显式提示先判断“直执行 vs 编排”
- 2026-02-02 MCP Server 已对齐 CLI：新增 `taskbook_report` / `taskbook_unblock`
- 2026-03-23 `P11.4` 已按“明确的非阻塞发布例外”收口：`npm run doctor:mcp-server-deps` 默认只暴露 `mcp-server` 依赖基线问题，不阻塞业务项目封版；只有 `npm run doctor:mcp-server-deps:strict` 才将其升级为硬失败
- 2026-02-02 TaskBook 并发协作 SOP 已落地：`docs/guides/taskbook-collaboration-sop.md`（含可选强制模式 `CODEBUDDY_TASKBOOK_REQUIRE_IF_REV=1` / `--require-if-rev`）
- 2026-02-02 Reports 查询入口已落地：`report-manager.js inspect/hotspots` + MCP `reports_inspect/reports_hotspots`
- 2026-02-02 质量门禁 gates 已扩大：lint/typecheck/security/perf（`default.workflow.json@1.3.0`，默认 optional；证据落盘到 `.codebuddy/reports/gates/<taskBookId>/...`，并在验收报告 `gates[].evidencePath` 汇总）
- 接手前先看：
  - `PROJECT.md`：能力清单/架构图谱（权威概览）
  - `README.md`：快速入口与命令
  - `docs/guides/team-collaboration-protocol.md`：团队读取进度、更新事实源、交接与验证约定
  - `docs/plans/task-intake-router-plan.md`：P12 intake 路由边界与验收标准
  - `docs/guides/business-project-guide.md`：业务项目端的任务路径选择与 intake advisor 用法
  - `docs/guides/workflows-guide.md`：Workflow Spec 与闭环执行方式
  - `docs/guides/e2e-validation-playbook.md`：业务项目端到端验收脚本（remote 加载 → 闭环）

### 2026-03-16 当前主线交付边界

本轮主线目标是：**完成产品面整理，不改变业务项目执行契约**。

建议纳入本轮交付的文件：

- `README.md`
- `ROADMAP.md`
- `docs/README.md`
- `docs/guides/product-surface-guide.md`
- `docs/guides/business-project-quickstart.md`
- `docs/guides/workflows-guide.md`
- `scripts/src/lib/prompt-builder.ts`
- `scripts/src/codebuddy-loader.ts`
- `scripts/src/task-orchestrator.ts`
- `scripts/src/report-manager.ts`

这些改动的共同特征：

- 不新增安装步骤
- 不改变 `.codebuddy/` 契约
- 不改变 `agent-call` prompt/result 文件协议
- 主要收口入口、帮助信息、安装后生成的 README、以及主线路线图状态

不建议混入本轮交付的文件：

- `package.json`
- `scripts/src/taskbook-manager.ts`
- `test/test-correctness-regressions.mjs`

原因：

- 这三处属于已封存的 Windows correctness 稳定性尝试性改动
- 目前不应和“纯产品面整理”一起发布
- 如需继续推进，应单独作为 `Windows correctness stability` 跟踪项恢复

当前主线最小验证结果：

- `npm run build:scripts` 通过

当前未作为本轮交付门槛的项目：

- Windows 下 `dead-process lock reclaim` correctness 回归稳定性
- 任何需要把封存项重新纳入发布的额外验证

> Codex 不会继承你同事的对话上下文，所以“进度”必须落在仓库文件里（本文 + PROJECT/README）。

## 2) 接手者 10 分钟快速验证（必跑）

在仓库根目录：

```bash
npm i
npm run build
npm run doctor:mcp-server-deps
npm run test:correctness
npm run test:full
```

预期：

- `npm run build` 成功（会编译 `scripts/src/*` 并生成 `manifest.json`）
- `npm run doctor:mcp-server-deps` 默认不会因为 `needs_attention` 阻断主线；它现在会把这类问题明确标成 `non_blocking_exception`
- 如果当前任务是 loader / rules / skills / agents / TaskBook / orchestrator 主链路，并且 `npm run test:correctness` 与 `npm run test:full` 已通过，可先继续开发
- 对当前业务项目封版，继续优先看 `npm run gate:quick` 和定点 smoke 是否通过
- 如果当前任务涉及 `mcp-server` 本身、准备做 handoff / release、或要让别人从干净环境直接使用 MCP Server，则改跑 `npm run doctor:mcp-server-deps:strict`，并在联网环境执行 `cd mcp-server && npm install` 后提交刷新后的依赖基线
- 离线环境不能可靠模拟“干净安装 + 正确 lockfile 刷新”的场景；当前工作区在 `2026-03-12` 用 `npm install --package-lock-only --offline --ignore-scripts --dry-run` 实测返回 `ENOTCACHED`
- `npm run test:correctness` 通过（覆盖已知高优先级正确性缺陷回归）
- `npm run test:full` 全部通过（会在 mock projects 中跑通单任务闭环 + batching + gates）

> `test:full` 依赖 Node 允许 `child_process` 再次拉起子进程；若当前终端/沙箱受限，会直接 fail-fast 给出环境提示。
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
- 验收/恢复操作的命令（可人工介入后继续闭环）：`docs/guides/workflows-guide.md`

## 5) 下一步建议（Backlog，按优先级）

P0（团队接力/协作体验）
- ✅（2026-02-02）MCP Server 已补齐 `taskbook_report` / `taskbook_unblock`（与 CLI 对齐）
- ✅（2026-02-02）已梳理“多人并发改同一 TaskBook”协作约定：强制 `--if-rev` / claim 规则 / 冲突处理 SOP（见 `docs/guides/taskbook-collaboration-sop.md`）
- ✅（2026-02-03）MVP：planner 生成 TaskBook 任务（`taskbook-manager plan/apply-plan`，文件协议 `.codebuddy/agent-calls/`）
- ✅（2026-02-03）MVP：MANUAL_REQUIRED 自动生成 agent-call（`task-executor` 生成 prompt，写回 result.json 后自动 apply 回写 `actualWork` 并继续）
- ✅（2026-02-03）Task 执行按优先级调度：`critical > high > medium > low`（依赖满足前提下）
- ✅（2026-02-04）P0：一键闭环入口 `task-orchestrator`（创建/规划/执行/阻塞恢复/验收）
- ✅（2026-02-04）P0+：`task-orchestrator --watch` 自动等待 result.json 并继续（无需手动重跑）

P1（老项目接手效率）
- ✅（2026-02-02）在 reports 基础上补“查询入口”（按模块/文件查上下游、热点、变更趋势），让重构定位更快
- ✅（2026-02-04）contract-validator 支持 `--agent-calls/--agent-call`：校验 `.codebuddy/agent-calls/*.result.json` 的可消费结构（planner/manual-task）
- ✅（2026-02-04）agent-call-manager validate 支持基于 prompt header 推断类型并输出 issues（便于排查/恢复闭环）
- ✅（2026-02-04）loader 分发 `.codebuddy/agent-calls/agent-call.schema.json`（agent-call result.json 契约，推荐 result 写回 kind 字段提升可诊断性）

P2（质量门禁扩大）
- ✅（2026-02-02）将 lint/typecheck/security/perf 等标准化为 gates（默认 optional：缺脚本 skipped；证据落盘 → acceptance report 汇总）
- ✅（2026-02-04）acceptance report 汇总 agent-call 关键事件（created/applied + kind/artifacts），便于审计与闭环恢复

P3（可选远程接力/跨机器写回）
- ✅（2026-02-04）agent-call-manager serve：HTTP 写回 result.json + 查询 TaskBooks + 远程触发/继续一键闭环（`/orchestrate`）
- ✅（2026-02-04）文档：补充“远程写回/远程 orchestrate”的使用说明与安全边界（`docs/guides/agent-call-remote.md`）

P4（下一阶段：Agent Runtime 工程化）
- ✅（2026-02-04）Agent Registry：扫描 `AGENT.md` 元数据，输出可消费 JSON（list/show）
- ✅（2026-02-04）Registry 接入 agent-call：prompt header 对齐（agentVersion/taskBookRevision）+ 缺失降级提示
- ✅（2026-02-04）E2E：覆盖 registry 行为与错误路径（`test/run-tests.js`）
- ✅（2026-02-04）文档：沉淀“CLI 核心 + Prompt 扩展 + 文件协议桥接”的最佳实践与远程边界（见 `README.md` / `ARCHITECTURE.md`）

P5（规则/技能/调度：可控性与工程化）
- ✅（2026-02-04）新增 `rule-validator` / `skill-validator`（可在业务项目直接运行，默认非阻塞；JSON 输出可消费）
- ✅（2026-02-04）`codebuddy-loader --rule-level summary|quick|full`：裁剪 Layer1 Eager 内容（rules_cache 保持 full 以便按需读取）
- ✅（2026-02-04）manual-task 的 agentId 选择更灵活：按任务类型/关键词做轻量路由；可用 `CODEBUDDY_MANUAL_AGENT_ID` 强制覆盖
- ✅（2026-03-17）已把 `rule-validator` 扩展到推荐元数据提示（`tags/priority/alwaysApply`），并把当前仓库 rules warning 清到 0
- ⬜（可选）若后续需要把规则元数据真正升级为强约束，再单独评估 CI 中启用 `rule-validator --strict`
- ✅（2026-03-17）已把 `skill-validator` 扩展到更强的引用完整性检查（含 bundled file discoverability），并补充简洁的 Skill 发布流程文档 `docs/guides/skill-release-guide.md`
- ✅（2026-03-17）`rule-validator` / `skill-validator` 的 strict 模式产品化已落地：补齐 README / 发布文档 / `package.json` 脚本入口 / 审查清单；并新增手动触发的 GitHub Actions workflow `Validator Strict Gate` 作为可选 CI gate（默认 `npm test` 与 push/PR correctness gate 不变）
- ✅（2026-03-17）strict validator 已补齐聚合 gate：`validate:gate[:strict]` 可同时输出 `validator-gate-summary.json`、`rule-validator-report.json`、`skill-validator-report.json`；手动 workflow `Validator Strict Gate` 会上传这些 JSON artifact
- ✅（2026-03-17）strict validator 已标准化报告落点：`validate:gate:strict:report` 默认写入 `.codebuddy/reports/validators/latest/`，`report-manager status/export` 可直接读取最近一次 validator gate 摘要
- ✅（2026-03-17）`codebuddy-loader doctor` 已接入最近一次 validator gate 摘要；若标准报告目录下存在 `validator-gate-summary.json`，诊断结果会额外输出 `validator-gate-report` 检查
- ✅（2026-03-17）标准 validator gate 报告目录已补齐历史快照：`validate:gate:strict:report` 会额外写入 `.codebuddy/reports/validators/history/<timestamp>/`，`report-manager status/export` 可读取最近几次 gate 记录
- ✅（2026-03-17）validator gate 历史已补齐趋势判断：`report-manager status --json` / `export` 和 `codebuddy-loader doctor` 会给出相对上一轮的回退或改善信号
- ✅（2026-03-17）`report-manager cleanup` 已纳入 validator gate history 保留策略，会按 `maxCount/maxAgeDays` 清理过旧目录
- ✅（2026-03-17）`report-manager history --json` 已纳入 validator gate runs，可一次性导出 architecture/modules/validators 三类历史视图
- ✅（2026-03-17）`report-manager trend --json` 已纳入 validator trend，可一次性导出 health + validator 两类趋势视图
- ✅（2026-03-17）`report-manager diff --json` 已纳入 module diff，可一次性导出 architecture + modules 两类差异视图
- ✅（2026-03-17）`report-manager export --json` 已补齐统一导出包，可一次性导出 status/history/trend/diff，并同步写出 `export.md`
- ✅（2026-03-17）`test/run-tests.js` 的业务项目 observability E2E 已覆盖 `validator-gate -> doctor/status/history/trend/diff/export` 整条链路
- ✅（2026-03-17）`test/run-tests.js` 已支持 `--list-cases` 与 `--case <name-or-dir>`，后续复现单个业务项目场景时不必再跑整套 `local`
- ✅（2026-03-17）`report-manager audit --json` 已成为单命令审计入口，业务项目 E2E 现已覆盖 `validator-gate -> doctor/status/history/trend/diff/export/audit`
- ✅（2026-03-19）已完成 `P11.1 repo-state-validator`：`README / ROADMAP / HANDOFF / docs/README / Team Collaboration Protocol` 的一致性现在可以被机器检查，并已接入 `validator-gate`

### 2026-03-17 Validator 审查顺序

推荐把 validator 用法分成两层：

1. 开发期默认检查
   - `npm run validate:all`
   - 目标：尽快暴露 warning，但不因为 warning 阻断本地迭代
2. 发布前 / 审查前严格检查
   - `npm run validate:all:strict`
   - 目标：把 warning 和 error 一起提升为 gate
3. 需要聚合 gate + 机器可读证明时：
   - `npm run validate:gate:strict -- --scope all --json --out-dir artifacts/validator-strict-gate`
4. 需要把结果写入标准报告目录并供 `report-manager` 查看时：
   - `npm run validate:gate:strict:report`
5. 只需要单个 validator 的机器可读证明时，再补 JSON 版：
   - `node scripts/dist/rule-validator.js check --strict --json`
   - `node scripts/dist/skill-validator.js check --strict --json`

当前约束：

- 默认 `npm test` 仍不自动包含 strict validator gate
- 默认 push/PR 的 `Correctness Gate` 仍不自动包含 strict validator gate
- strict validator 目前是显式 opt-in，用于 release/review，而不是每次本地改动都强制执行
- `repo-state-validator` 仅面向本仓库；安装到业务项目后的 `validator-gate` 在缺少仓库事实源时会自动跳过 repo-state 检查

### 2026-03-19 Gate 收口顺序

当前统一两条 gate：

1. Quick Gate
   - `npm run gate:quick`
   - 适用：日常开发收口、代码评审前、快速确认主线没有被打断
   - 等价于：
     - `npm run build`
     - `npm run test:lib`
     - `npm run validate:all`
2. Release Gate
   - `npm run gate:release`
   - 适用：准备合并、发布、或阶段性交接前
   - 等价于：
     - `npm run build`
     - `npm test`
     - `npm run test:full`
     - `npm run validate:all:strict`
     - `node scripts/dist/validator-gate.js run --strict --scope all --json`
     - `node scripts/dist/report-manager.js audit --json`

说明：

- `Release Gate` 里的 `audit --json` 负责补充审计证据，不单独承担硬失败语义
- `doctor:mcp-server-deps` 已正式定义为独立环境健康检查；默认非阻塞，`--strict` 才升级为 MCP 相关任务的硬门槛
- 本地 Windows 下 `gate:release` 的长链路执行体验目前已封存为非阻塞项，不作为业务项目安装/下载/使用的阻塞门槛

### 2026-03-19 Release Gate 封存边界

- 当前封存项：
  - `npm run test:correctness` 的长时间执行/稳定性
  - `npm run gate:release` 在本地 Windows 下的一次性长链路执行体验
- 当前不受影响的主线：
  - `codebuddy-loader` 安装
  - remote 下载与 content-pack 使用
  - `.codebuddy/` 契约
  - `task-orchestrator / task-executor / report-manager`
  - validator / validator-gate / doctor / audit 的日常使用
- 当前建议门槛：
  - 主线开发和业务项目接入以 `npm run gate:quick` + 定点 smoke/E2E 为主
  - `gate:release` 暂作为发布治理辅助，而不是业务项目安装可用性的硬前提

### 2026-03-19 P11.1 最小验证

- `npm run build:scripts`
- `npm run validate:repo`
- `npm run validate:repo:strict`
- `npm run test:lib`
- `npm run build`
- `npm run validate:all:strict`
- `node scripts/dist/validator-gate.js run --strict --scope all --json`

P6（开发闭环流程优化：11 步→7 步）
- ✅（2026-02-07）Workflow v2.0.0：7 步闭环（需求澄清+PRD → 项目分析 → 任务分解 → TDD 实现 → 代码审查 → 构建修复 → 验收提交）
- ✅（2026-02-07）TaskType 扩展为 10 种：requirement/prd/analysis/design/test/implement/refactor/review/build-fix/acceptance
- ✅（2026-02-07）新增 tdd-driver Agent：驱动 RED→GREEN→REFACTOR 循环，含 3 个 prompt 模板（red.md/green.md/refactor.md）
- ✅（2026-02-07）新增 build-fix Agent：构建失败自动诊断修复（最多 3 轮），含 diagnose-fix.md prompt 模板
- ✅（2026-02-07）新增 code-reviewer Agent：按 clean-code 规则结构化审查 + 分级输出 + 自动修复，含 review.md prompt 模板
- ✅（2026-02-07）task-executor 新增任务类型→Agent 路由 + prompt 模板自动注入（`loadAgentPromptTemplate()`）
- ✅（2026-02-07）task-orchestrator AGENT.md 更新为 v2.0.0：引用新 Agent 协作矩阵
- ✅（2026-02-07）PRD Skill 增加结构化 JSON 输出 + TaskBook 衔接说明

---

如需“更强的实时接力”（少 pull、多人同时改同一份事实源），建议把 TaskBook/Workflow 的事实源放到共享工作目录或集中式服务（例如团队内网部署 MCP Server），但先保持 Git 方案最稳。
