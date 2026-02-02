---
title: TaskBook 并发协作 SOP（--if-rev / claim / 冲突处理）
date: 2026-02-02
---

# TaskBook 并发协作 SOP（--if-rev / claim / 冲突处理）

目标：当 **多人/多 Agent 同时操作同一个 TaskBook** 时，避免“最后一次写入覆盖前一次写入”，并让冲突可检测、可恢复。

## 1) 基本概念（SSOT + revision）

- **TaskBook 是 SSOT（单一事实源）**：所有状态流转/验收记录最终都应落在 TaskBook（JSON）里。
- `taskBook.revision`：每次写入 TaskBook 自动 `+1`（用于并发检测）。
- `--if-rev <n>`：写入前要求 `revision === n`，否则直接报冲突（防止并发覆盖）。
- `task.executedBy`：用来 **claim/认领** 任务，作为团队协作约定（谁在做、避免抢改）。

> CLI 冲突会以 **退出码 2** 结束（TaskBookConflictError）。MCP 调用会返回错误文本（同样包含 revision conflict 信息）。

## 2) 团队约定（必须遵守）

### 2.1 所有“写操作”必须带 `--if-rev`

写操作包括（但不限于）：
- `confirm` / `complete` / `abort`
- `add-task` / `update-task`
- `claim` / `append-work` / `unblock`

读取操作（不需要 `--if-rev`）：
- `list` / `show` / `report`

### 2.2 先 claim 再改（claim 规则）

1. 选定要做的任务后，先 `claim` 写入 `executedBy`（标记“我在做”）。
2. 后续对该任务的 `update-task/append-work/unblock` 默认只允许 **认领者本人** 来改（这是团队约定；如需跨人修改，先沟通或在 TaskBook 新增任务说明原因）。

## 3) 标准流程（CLI）

在业务项目根目录（存在 `.codebuddy/`）：

```bash
# 1) 读最新 revision（推荐 JSON，便于复制 revision）
node .codebuddy/scripts/taskbook-manager.js show <taskBookId> --json

# 2) claim（把 revision 填到 --if-rev）
node .codebuddy/scripts/taskbook-manager.js claim <taskBookId> <taskId> --by "<yourName>" --if-rev <revision> --json

# 3) 更新任务状态/补充实际工作（持续带 --if-rev）
node .codebuddy/scripts/taskbook-manager.js update-task <taskBookId> <taskId> --status in_progress --if-rev <revision> --json
node .codebuddy/scripts/taskbook-manager.js append-work <taskBookId> <taskId> --text "完成了 xxx，下一步 yyy" --if-rev <revision> --json
node .codebuddy/scripts/taskbook-manager.js update-task <taskBookId> <taskId> --status done --actual-work "已合并/已发布" --if-rev <revision> --json

# 4) 需要时生成验收报告（不改 TaskBook，可不带 if-rev）
node .codebuddy/scripts/taskbook-manager.js report <taskBookId> --write
```

实操建议：
- 每次写入后，把输出里的最新 `revision` 作为下一次 `--if-rev`（减少重复 `show`）。

## 4) 标准流程（MCP）

核心原则同上：**先读 revision → claim → 所有写操作都带 ifRevision**。

```ts
const tb = await mcp.call('taskbook_show', { taskBookId })
const rev = tb.revision

await mcp.call('taskbook_claim', { taskBookId, taskId, by: 'alice', ifRevision: rev })
// ...更新时继续带 ifRevision（用“上一次返回”的 revision 或重新 show 获取）
await mcp.call('taskbook_update_task', { taskBookId, taskId, status: 'in_progress', ifRevision: rev })
```

## 5) 冲突处理 SOP（必做）

当你遇到 “revision conflict / 冲突”：

1. **立刻停止继续写**（不要盲目重试写入）。
2. `show <taskBookId> --json` 重新读取最新内容与最新 `revision`。
3. 判断冲突类型：
   - **无业务冲突**（别人改了别的任务/字段）：用新 `revision` 重新执行你的写操作。
   - **同一任务冲突**（你要改的 task 被别人改了）：先沟通；必要时把你的工作拆成新任务，或用 `append-work` 记录原因与决策。

## 6) 可选：强制模式（团队/CI 推荐）

可通过环境变量开启“写操作必须提供 if-rev”的强制模式：

```bash
# PowerShell
$env:CODEBUDDY_TASKBOOK_REQUIRE_IF_REV='1'

# bash/zsh
export CODEBUDDY_TASKBOOK_REQUIRE_IF_REV=1
```

或在单次执行时追加 `--require-if-rev`（用于避免手滑漏传 `--if-rev`）。

开启后，如果缺少 `--if-rev` / `ifRevision`，写操作会直接失败，避免 silent overwrite。
