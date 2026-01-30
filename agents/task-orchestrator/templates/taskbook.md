# TaskBook 模板

## 基本信息

```json
{
  "id": "tb-{YYYYMMDD}-{slug}",
  "title": "{任务标题}",
  "description": "{需求描述}",
  "taskType": "new-feature | refactoring | debugging | testing | code-review",
  "createdAt": "{ISO 8601 时间戳}",
  "confirmedAt": null,
  "completedAt": null,
  "status": "draft | confirmed | executing | completed | aborted"
}
```

---

## 上下文快照

```json
{
  "context": {
    "projectHealth": {
      "score": 0,
      "issues": []
    },
    "relatedFiles": [],
    "dependencies": [],
    "architectureNotes": ""
  }
}
```

---

## 任务清单

### 任务模板

```json
{
  "id": "task-{序号}",
  "parentId": null,
  "title": "{任务标题}",
  "type": "analysis | design | test | implement | review",
  "status": "pending | in_progress | done | blocked | skipped",
  "priority": "critical | high | medium | low",
  "dependencies": [],
  "acceptanceCriteria": [
    "验收标准 1",
    "验收标准 2"
  ],
  "actualWork": null,
  "blockedReason": null,
  "executedBy": null,
  "startedAt": null,
  "completedAt": null
}
```

### 示例任务清单

```json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "定义接口契约",
      "type": "design",
      "status": "pending",
      "priority": "high",
      "dependencies": [],
      "acceptanceCriteria": [
        "定义所有 API 接口的 TypeScript 类型",
        "文档化接口设计决策"
      ]
    },
    {
      "id": "task-2",
      "title": "编写单元测试",
      "type": "test",
      "status": "pending",
      "priority": "high",
      "dependencies": ["task-1"],
      "acceptanceCriteria": [
        "覆盖所有核心逻辑分支",
        "测试覆盖率 > 80%"
      ]
    },
    {
      "id": "task-3",
      "title": "实现核心功能",
      "type": "implement",
      "status": "pending",
      "priority": "high",
      "dependencies": ["task-2"],
      "acceptanceCriteria": [
        "所有测试通过",
        "代码符合项目规范"
      ]
    },
    {
      "id": "task-4",
      "title": "代码审查",
      "type": "review",
      "status": "pending",
      "priority": "medium",
      "dependencies": ["task-3"],
      "acceptanceCriteria": [
        "无 CRITICAL 或 HIGH 级别问题",
        "代码可读性良好"
      ]
    }
  ]
}
```

---

## 变更日志

```json
{
  "changelog": [
    {
      "timestamp": "{ISO 8601}",
      "taskId": "task-x",
      "changeType": "added | modified | removed | reordered",
      "reason": "{变更原因说明}",
      "before": {},
      "after": {}
    }
  ]
}
```

---

## 完整 TaskBook 示例

```json
{
  "id": "tb-20260130-user-auth",
  "title": "用户认证模块",
  "description": "实现完整的用户登录/注册功能，包括 Token 管理",
  "taskType": "new-feature",
  "createdAt": "2026-01-30T10:00:00.000Z",
  "confirmedAt": "2026-01-30T10:05:00.000Z",
  "completedAt": null,
  "status": "executing",

  "context": {
    "projectHealth": {
      "score": 85,
      "issues": ["部分组件缺少类型定义"]
    },
    "relatedFiles": [
      "src/modules/auth/index.ts",
      "src/api/auth.ts",
      "src/stores/user.ts"
    ],
    "dependencies": ["axios", "pinia"],
    "architectureNotes": "采用 Feature-Based 目录结构，认证模块位于 src/modules/auth/"
  },

  "tasks": [
    {
      "id": "task-1",
      "title": "定义 Auth 模块接口契约",
      "type": "design",
      "status": "done",
      "priority": "high",
      "dependencies": [],
      "acceptanceCriteria": [
        "定义 LoginRequest, LoginResponse 类型",
        "定义 RegisterRequest, RegisterResponse 类型",
        "定义 User 实体类型"
      ],
      "actualWork": "创建 src/modules/auth/types.ts，定义所有认证相关类型",
      "executedBy": "task-orchestrator",
      "startedAt": "2026-01-30T10:06:00.000Z",
      "completedAt": "2026-01-30T10:10:00.000Z"
    },
    {
      "id": "task-2",
      "title": "编写登录功能单元测试",
      "type": "test",
      "status": "in_progress",
      "priority": "high",
      "dependencies": ["task-1"],
      "acceptanceCriteria": [
        "测试登录成功场景",
        "测试登录失败场景（密码错误、用户不存在）",
        "测试 Token 存储"
      ],
      "executedBy": "tdd-guide",
      "startedAt": "2026-01-30T10:11:00.000Z"
    },
    {
      "id": "task-3",
      "title": "实现登录 API 调用",
      "type": "implement",
      "status": "pending",
      "priority": "high",
      "dependencies": ["task-2"]
    },
    {
      "id": "task-4",
      "title": "编写注册功能单元测试",
      "type": "test",
      "status": "pending",
      "priority": "high",
      "dependencies": ["task-1"]
    },
    {
      "id": "task-5",
      "title": "实现注册 API 调用",
      "type": "implement",
      "status": "pending",
      "priority": "high",
      "dependencies": ["task-4"]
    },
    {
      "id": "task-6",
      "title": "实现 Token 存储与刷新",
      "type": "implement",
      "status": "pending",
      "priority": "medium",
      "dependencies": ["task-3", "task-5"]
    },
    {
      "id": "task-7",
      "title": "代码安全审查",
      "type": "review",
      "status": "pending",
      "priority": "medium",
      "dependencies": ["task-6"]
    },
    {
      "id": "task-8",
      "title": "集成测试验证",
      "type": "test",
      "status": "pending",
      "priority": "medium",
      "dependencies": ["task-7"]
    }
  ],

  "changelog": [
    {
      "timestamp": "2026-01-30T10:05:00.000Z",
      "taskId": null,
      "changeType": "modified",
      "reason": "用户确认计划，状态变更为 confirmed",
      "before": { "status": "draft" },
      "after": { "status": "confirmed" }
    }
  ]
}
```

---

## 使用说明

1. **创建 TaskBook**: 复制此模板，填充基本信息
2. **收集上下文**: 运行分析工具，填充 context 字段
3. **分解任务**: 按 INVEST 原则创建任务列表
4. **用户确认**: 展示给用户，获取确认
5. **执行追踪**: 更新任务状态和 actualWork
6. **记录变更**: 任何偏离原计划的改动都要记录
7. **归档**: 完成后移动到 history 目录
