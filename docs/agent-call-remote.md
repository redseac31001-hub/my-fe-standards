# Agent Call 远程闭环指南（可选）

适用场景：业务项目在 **A 机器/容器** 里跑一键闭环（`task-orchestrator`），但你希望在 **B 机器**（本地 Codex / Claude Code / 其他 LLM 工具）远程获取 prompt、写回 result，并远程触发继续执行。

## 1) 在项目根目录启动服务

在 A 机器的业务项目根目录运行：

```bash
node .codebuddy/scripts/agent-call-manager.js serve --host 127.0.0.1 --port 4317 --token <token>
```

然后在 B 机器通过网络访问该地址（如需跨机器访问，把 `--host` 改为 `0.0.0.0`，并确保防火墙/内网/VPN 配置正确）。

## 2) API（核心）

- `GET /health`
- `GET /taskbooks`（列出 active/history TaskBooks）
- `GET /taskbooks/<taskBookId>`（读取 TaskBook JSON）
- `POST /orchestrate`（远程触发/继续执行 task-orchestrator，返回 `exitCode + outcome`；可选 `watch/watchPollMs/watchTimeoutMs`）
- `GET /agent-calls`（列出 prompt/result 状态）
- `GET /agent-calls/<requestId>`（show）
- `GET /agent-calls/<requestId>/prompt`（读取 prompt.md）
- `GET /agent-calls/<requestId>/result`（读取 result.json）
- `PUT /agent-calls/<requestId>/result`（写回 result.json；也支持 `POST`）

> 若启用 `--token`，除 `/health` 外都需要 Header：`Authorization: Bearer <token>`。

## 3) 写回示例

### curl

```bash
curl -H "Authorization: Bearer <token>" http://127.0.0.1:4317/taskbooks

# 远程触发一键闭环（首次通常会 blocked，等待 planner 写回）
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data-binary "{\"requirement\":\"实现用户登录/登出\",\"type\":\"new-feature\",\"tasksOnly\":true}" \
  http://127.0.0.1:4317/orchestrate

curl -H "Authorization: Bearer <token>" http://127.0.0.1:4317/agent-calls/<requestId>/prompt

curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data-binary @<requestId>.result.json \
  http://127.0.0.1:4317/agent-calls/<requestId>/result

# 写回后继续（用上一步返回的 taskBookId）
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data-binary "{\"taskBookId\":\"<taskBookId>\",\"tasksOnly\":true}" \
  http://127.0.0.1:4317/orchestrate
```

### PowerShell（Invoke-RestMethod）

```powershell
$token = "<token>"
$id = "<requestId>"
$base = "http://127.0.0.1:4317"

Invoke-RestMethod -Headers @{ Authorization = "Bearer $token" } -Uri "$base/taskbooks"

Invoke-RestMethod -Headers @{ Authorization = "Bearer $token" } -Uri "$base/agent-calls/$id/prompt"

$body = Get-Content ".codebuddy/agent-calls/$id.result.json" -Raw -Encoding UTF8
Invoke-RestMethod -Method Put -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body -Uri "$base/agent-calls/$id/result"
```

## 4) 写回后如何继续闭环

- 方式 A（HTTP）：调用 `POST /orchestrate`，传入 `{ "taskBookId": "<taskBookId>" }` 继续执行
- 方式 B（本地命令）：重跑 `node .codebuddy/scripts/task-orchestrator.js --taskbook <taskBookId>`
- 若只想推进任务执行器：重跑 `node .codebuddy/scripts/task-executor.js <taskBookId>`

## 5) 安全边界（重要）

- 默认仅监听 `127.0.0.1`；如需跨机器，建议：`--host 0.0.0.0` + `--token` + 内网/VPN/防火墙限制。
- 仅允许安全的 `requestId`（字母/数字/`._-`），避免路径穿越。
- 请求体限制约 2MB；更大的产物请通过 `artifacts[]` 记录文件路径，不要塞进 JSON。
