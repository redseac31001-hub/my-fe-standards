# /agent-call - 执行 Agent Call（读 prompt → 写 result.json）

---
name: agent-call
description: 执行 .codebuddy/agent-calls/<requestId>.prompt.md，并将结果写回 .codebuddy/agent-calls/<requestId>.result.json
triggers:
  - "agent-call"
  - "执行 prompt"
  - "写回 result.json"
---

## 概述

本命令用于执行 **文件协议桥接** 的 Agent Call：

- 输入：`.codebuddy/agent-calls/<requestId>.prompt.md`
- 输出：`.codebuddy/agent-calls/<requestId>.result.json`

> 约束：`result.json` 必须是 **纯 JSON**，供脚本自动消费；不要输出 Markdown 或解释性文本。

---

## 使用方式

### 方式 1：给 requestId

```
/agent-call req-20260204-xxxxxx
```

### 方式 2：给 prompt 路径

```
/agent-call .codebuddy/agent-calls/req-20260204-xxxxxx.prompt.md
```

---

## 执行步骤（必须遵守）

1. **定位 prompt 文件**
   - 若输入的是 requestId：拼接 prompt 路径为 `.codebuddy/agent-calls/<requestId>.prompt.md`
   - 若输入的是路径：从文件名解析 `<requestId>`

2. **读取 prompt 并严格执行**
   - prompt 内一般包含：Header(JSON) + Agent Definition + Context + Instructions + JSON 输出示例
   - 你必须按 Instructions 的要求生成输出结构

3. **只输出 JSON（不要 Markdown）**
   - 必须包含 `requestId`，且与 prompt header 的 `requestId` 一致
   - 推荐包含 `kind`：`planner | manual-task`（便于校验/诊断；以 prompt 为准）
   - 必须包含 `status`：`success | failed | blocked`
   - 成功时建议包含 `output`（由 prompt 决定结构）
   - 必须包含 `completedAt`（ISO 8601 时间戳）

4. **写回 result.json**
   - 写入路径：`.codebuddy/agent-calls/<requestId>.result.json`

5. **提示下一步命令**
   - 如果这是 planner：提示 `node .codebuddy/scripts/taskbook-manager.js apply-plan <taskBookId> <requestId>`
   - 如果这是 task-executor 的 MANUAL_REQUIRED：提示重跑 `node .codebuddy/scripts/task-executor.js <taskBookId>` 或 `task-orchestrator`

---

## result.json 统一外壳（示例）

> 注意：具体 `output` 结构以 prompt 中的 schema 为准。

```json
{
  "requestId": "req-20260204-xxxxxx",
  "kind": "planner",
  "status": "success",
  "output": {},
  "completedAt": "2026-02-04T12:34:56.000Z"
}
```
