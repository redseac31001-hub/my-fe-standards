---
title: 业务项目 E2E 验证方案（remote 加载 → 工作流闭环）
date: 2026-01-31
---

# 业务项目 E2E 验证方案（remote 加载 → 工作流闭环）

目标：在你的**业务项目**中远程加载本工程（CodeBuddy Loader + workflows + scripts），并验证：

1. `npm run remote` 能拉取/执行 JS，并拉取配置资源，项目可启动
2. 能执行架构审查（analyze step），产出报告并落盘
3. 能按 workflow 推进“单需求闭环”（任务分解 → 批量实现+Smoke gates → Review gate → Full gate → 验收归档），并在阻塞/失败时可恢复

> 说明：本文是“可执行的人工验收脚本”。你可以按步骤逐条跑，并把“实际输出 vs 预期”对比作为验收依据。

---

## 0. 前置条件

- Node.js + npm 可用（建议 Node 18+ / 20+）
- 业务项目可正常 `npm i`
- 你已确认业务项目侧 `npm run remote` 当前可用（可启动）

---

## 1. 安装/更新 CodeBuddy 产物到业务项目

在业务项目根目录执行（你现有方式）：

```bash
npm run remote
```

预期结果：

- 业务项目根目录生成或更新 `.codebuddy/`
- `.codebuddy/scripts/` 下存在（至少）：
  - `task-executor.js`
  - `taskbook-manager.js`
  - `contract-validator.js`
  - `module-mapper.js`
  - `structure-analyzer.js`
- `.codebuddy/workflows/` 下存在：
  - `default.workflow.json`
  - `workflow.schema.json`
- `.codebuddy/taskbooks/` 下存在：
  - `taskbook.schema.json`

---

## 2. 运行契约校验（Contracts Gate 手工复现）

```bash
node .codebuddy/scripts/contract-validator.js --workflows --taskbooks
```

预期结果：

- 输出包含 `[OK] contracts valid`
- 若失败，输出会列出 `ERROR <file>: <message>`，先按提示修复再继续

如果你使用默认 workflow（启用 `risk_tiered` batching），建议额外跑一次“批量 scope 完整性提示”：

```bash
node .codebuddy/scripts/contract-validator.js --workflows --taskbooks --check-batching-scope
```

预期结果：

- 仍然 `[OK]`（即便有 `WARN` 也不影响退出码）
- 若出现 `WARN` 提示某些 task 缺少 `scope.files/modules`，后续在创建/拆分 implement 类任务时补齐即可（见第 3 步）

---

## 3. 创建一个“架构审查 + 重构闭环”的 TaskBook（最小闭环）

### 3.1 创建 TaskBook

```bash
node .codebuddy/scripts/taskbook-manager.js create --title "架构审查与模块重构验证" --description "验证 analyze → implement(batch+smoke) → review/full → acceptance" --type refactoring
```

记下输出中的 `<taskBookId>`。

### 3.2 添加任务（示例）

1）架构审查（analysis）

```bash
node .codebuddy/scripts/taskbook-manager.js add-task <taskBookId> --title "生成架构/模块/健康度报告" --type analysis
```

2）重构实现（implement，建议补齐 scope）

```bash
node .codebuddy/scripts/taskbook-manager.js add-task <taskBookId> --title "拆分超大模块（示例）" --type implement --modules "views/selfRegistry" --files "src/views/selfRegistry/..."
```

> 重点：当你希望批量推进更稳定（更符合 smoke gate 的价值）时，`implement` 任务尽量提供 `--files/--modules`，以便 batching 做“范围预算”和冲突规避。

3）验收标准（可重复追加 `--ac`）

```bash
node .codebuddy/scripts/taskbook-manager.js update-task <taskBookId> <taskId> --ac "npm test 通过" --ac "npm run build 通过"
```

### 3.3 确认 TaskBook

```bash
node .codebuddy/scripts/taskbook-manager.js confirm <taskBookId>
```

预期结果：

- TaskBook 状态变为 `confirmed`

---

## 4. 执行 workflow（端到端闭环）

```bash
node .codebuddy/scripts/task-executor.js <taskBookId>
```

预期结果（关键点）：

- `analyze` step 会自动运行 `module-mapper` + `structure-analyzer`，并写入 `.codebuddy/reports/`
- `implement` step 会按 batching 策略分批推进，并在 batch 之间执行 `smoke_passed` gate
- `review` step 若是手动 gate，可能进入阻塞/等待审查
- `test_full` step 执行 `full_passed` gate（默认 `npm test` + `npm run build`）
- `acceptance` step 归档 TaskBook 到 history（若 workflow 设计如此）

---

## 5. 阻塞/失败时的“恢复动作”（验证闭环可恢复）

### 5.1 解除 blocked 任务

当某任务被标记为 `blocked`（例如需要人工介入、冲突处理、补充设计）：

```bash
node .codebuddy/scripts/taskbook-manager.js unblock <taskBookId> <taskId> --resolution "已处理冲突/补充设计/修复测试"
```

### 5.2 手动放行 review gate（如需要）

```bash
node .codebuddy/scripts/task-executor.js <taskBookId> --approve review_passed
```

### 5.3 继续推进

```bash
node .codebuddy/scripts/task-executor.js <taskBookId>
```

---

## 6. 生成验收报告（Acceptance Report）

```bash
node .codebuddy/scripts/taskbook-manager.js report <taskBookId> --write
```

预期结果：

- 生成 `.codebuddy/reports/taskbooks/<taskBookId>.acceptance.json`
- 报告包含：
  - `gates[]`：gate 执行历史（支持多次 smoke gate）
  - `batches[]`：批量推进摘要（每批对应 smoke gate 结果）
  - `recommendations`：对“阻塞/跳过/缺少 scope”的建议

---

## 7. 对照验收清单（你关心的 3 个目标）

1）remote 能启动：✅ 已在第 1 步验证

2）架构审查产出：✅ 第 4 步后检查 `.codebuddy/reports/architecture/`、`.codebuddy/reports/modules/`、`.codebuddy/reports/health/`

3）需求闭环自动化：✅ 第 4–6 步确认：

- batching 生效（`acceptance.json` 里 `batches[].batchIndex` 有多条）
- smoke gate 有多次历史（`gates[]` 里 `smoke_passed` 出现多次）
- 阻塞可恢复（第 5 步 `unblock` 后能继续推进）
- 最终有验收报告并完成归档（`history/` 有对应 TaskBook，或状态为 `completed`）

