# 遗留重构示例：jQuery 混合代码迁移到 Vue 3

> 完整的 default（7 步）工作流执行记录，展示大规模遗留代码重构的全过程。

---

## 场景描述

**用户需求**: "src/legacy/ 下有一个 jQuery 写的用户管理模块，需要迁移到 Vue 3 Composition API"

**项目背景**:
- 技术栈: Vue 3 + TypeScript（主体）+ jQuery（遗留模块）
- 遗留模块: `src/legacy/user-management/`（约 800 行 JS + 200 行 HTML 模板）
- 业务逻辑: 用户 CRUD、角色分配、批量操作

**工作流选择**: `default`（7 步），因为这是高风险的大范围重构，需要完整的 PRD 澄清、架构分析、TDD 保护网和多轮审查。

---

## Phase 1: 需求澄清 & PRD (requirement_prd)

**用户 Q&A**:

```
Q: 需要保持 jQuery 模块的向后兼容吗？
A: 不需要，直接替换。老代码可以删除。

Q: 批量操作是否需要保留？
A: 保留。批量删除、批量角色分配都要有。

Q: 有现成的 API 文档吗？
A: 后端 API 不变，Swagger 文档在 /api-docs。
```

**PRD 输出**:
```
PRD: 用户管理模块 Vue 3 迁移

目标: 将 jQuery 用户管理模块完整迁移到 Vue 3 Composition API
范围: 用户列表、CRUD、角色分配、批量操作
非范围: 后端 API、权限系统（不变）
验收标准:
  - 功能等价: 所有现有功能在新版本中可用
  - 删除遗留: src/legacy/user-management/ 全部删除
  - 测试覆盖: 核心流程覆盖率 >= 80%
  - 性能: 列表渲染 1000 行 < 500ms
```

---

## Phase 2: 项目分析 (analyze)

**structure-analyzer 输出**:

```json
{
  "legacyModule": {
    "files": [
      "src/legacy/user-management/index.js",
      "src/legacy/user-management/user-list.js",
      "src/legacy/user-management/user-form.js",
      "src/legacy/user-management/role-manager.js",
      "src/legacy/user-management/bulk-actions.js",
      "src/legacy/user-management/templates/*.html"
    ],
    "totalLines": 1023,
    "jqueryUsage": {
      "domManipulation": 45,
      "ajaxCalls": 12,
      "eventBindings": 28
    }
  },
  "targetStructure": {
    "suggestedLocation": "src/views/user-management/",
    "existingPatterns": {
      "apiLayer": "src/api/*.ts - Axios 封装",
      "storeLayer": "src/stores/*.ts - Pinia stores",
      "componentPattern": "Composition API + <script setup>"
    }
  }
}
```

**module-mapper 依赖分析**:
```
src/legacy/user-management/index.js
  ├── jQuery ($.ajax, $.fn)
  ├── src/legacy/common/utils.js → 部分可迁移到 src/utils/
  └── src/legacy/common/modal.js → 已有 Vue 替代: src/components/BaseModal.vue
```

---

## Phase 3: 任务规划 (plan)

**planner 生成 TaskBook**（12 个任务）:

```json
{
  "id": "tb-20260313-user-migration",
  "title": "用户管理模块 jQuery → Vue 3 迁移",
  "taskType": "refactoring",
  "status": "confirmed",
  "tasks": [
    {
      "id": "T1", "title": "创建 API 层 (src/api/users.ts)",
      "type": "implement", "priority": "critical", "dependencies": []
    },
    {
      "id": "T2", "title": "创建 Pinia Store (src/stores/userStore.ts)",
      "type": "implement", "priority": "critical", "dependencies": ["T1"]
    },
    {
      "id": "T3", "title": "编写 Store 单元测试",
      "type": "test", "priority": "high", "dependencies": ["T2"]
    },
    {
      "id": "T4", "title": "实现 UserList.vue 组件",
      "type": "implement", "priority": "high", "dependencies": ["T2"]
    },
    {
      "id": "T5", "title": "实现 UserForm.vue 组件",
      "type": "implement", "priority": "high", "dependencies": ["T2"]
    },
    {
      "id": "T6", "title": "实现 RoleManager.vue 组件",
      "type": "implement", "priority": "medium", "dependencies": ["T2"]
    },
    {
      "id": "T7", "title": "实现 BulkActions.vue 组件",
      "type": "implement", "priority": "medium", "dependencies": ["T4"]
    },
    {
      "id": "T8", "title": "集成路由和导航",
      "type": "implement", "priority": "medium", "dependencies": ["T4", "T5", "T6"]
    },
    {
      "id": "T9", "title": "编写组件测试",
      "type": "test", "priority": "high", "dependencies": ["T4", "T5", "T6", "T7"]
    },
    {
      "id": "T10", "title": "删除 src/legacy/user-management/",
      "type": "refactor", "priority": "high", "dependencies": ["T8", "T9"]
    },
    {
      "id": "T11", "title": "代码审查",
      "type": "review", "priority": "medium", "dependencies": ["T10"]
    },
    {
      "id": "T12", "title": "性能验证（1000行渲染 < 500ms）",
      "type": "acceptance", "priority": "medium", "dependencies": ["T10"]
    }
  ]
}
```

**用户确认**: "确认执行，但 T4 和 T5 可以并行"

**变更记录**:
```json
{
  "timestamp": "2026-03-13T10:00:00Z",
  "taskId": null,
  "changeType": "modified",
  "reason": "用户确认 T4 和 T5 可并行执行"
}
```

---

## Phase 4: TDD 实现 (tdd_implement)

### 执行顺序（考虑并行）:

```
T1 (API 层) → T2 (Store) → T3 (Store 测试)
                          → T4 (UserList) ─┐
                          → T5 (UserForm) ─┤ 并行
                                           ├→ T6 (RoleManager)
                                           ├→ T7 (BulkActions)
                                           └→ T8 (路由集成)
                                              → T9 (组件测试)
                                              → T10 (删除遗留)
```

### 批量执行记录

**批次 1** (T1, T2 - 高风险):
- tdd-driver: 实现 API 层和 Store
- smoke gate 1: 通过（5 个测试）

**批次 2** (T3, T4, T5 - 并行):
- tdd-driver: Store 测试 + UserList + UserForm
- smoke gate 2: 通过（18 个测试）

**交接记录**:
```json
{
  "from": "tdd-driver",
  "to": "tdd-driver",
  "type": "standard",
  "timestamp": "2026-03-13T12:00:00Z",
  "context": "批次 2 完成，Store/UserList/UserForm 就绪，进入批次 3",
  "deliverables": [
    "src/stores/userStore.ts",
    "src/views/user-management/UserList.vue",
    "src/views/user-management/UserForm.vue"
  ]
}
```

**批次 3** (T6, T7, T8 - 中风险):
- tdd-driver: RoleManager + BulkActions + 路由集成
- smoke gate 3: 失败 → BulkActions 批量删除后状态未更新

**修复循环**:
```
第 1 次尝试: build-fix Agent 诊断 → BulkActions.vue 未调用 store.refresh()
修复后 smoke: 通过
```

**批次 4** (T9, T10):
- tdd-driver: 组件测试（12 个新增）
- T10: 删除 `src/legacy/user-management/` 目录
- smoke gate 4: 通过（30 个测试）

---

## Phase 5: 代码审查 (review)

**code-reviewer 输出**:

```
代码审查报告 - 用户管理模块 Vue 3 迁移

整体评分: 88/100

优点:
- 完整的 API → Store → Component 分层
- 测试覆盖率 84%
- 遗留代码已完全删除

问题:
- [HIGH] UserList.vue:67 - 1000 行列表未使用虚拟滚动，可能影响性能
- [MEDIUM] userStore.ts:45 - bulkDelete 应用乐观更新模式
- [LOW] 3 个组件的 props 类型可以抽取为共享 interface

结论: 通过（HIGH 项建议在性能验证阶段确认）
```

**review gate**: 通过

---

## Phase 6: 构建修复 (build_fix)

**构建验证**:
```
npm run build → 通过
npm test      → 30/30 通过

但性能验证（T12）:
1000 行渲染: 680ms → 超过 500ms 阈值
```

**build-fix 修复循环**:
```
第 1 次: 为 UserList.vue 添加虚拟滚动（vue-virtual-scroller）
结果: 1000 行渲染: 120ms → 通过
```

**full_passed gate**: 通过

---

## Phase 7: 验收 (acceptance)

**验收报告**:

```
验收报告 - 用户管理模块 jQuery → Vue 3 迁移

执行摘要:
  完成 12 个任务，1 个经历修复循环（BulkActions 状态更新），
  1 个性能问题在构建修复阶段解决（虚拟滚动）。
  jQuery 遗留代码已完全删除。

代码变更:
  新增: 8 文件（API 层、Store、4 个组件、路由配置、测试）
  删除: 6 文件（src/legacy/user-management/ 全部）
  修改: 2 文件（路由表、导航菜单）
  净减少: ~200 行代码

测试结果:
  30 个测试通过，覆盖率 84%

性能:
  1000 行列表渲染: 120ms（目标 < 500ms）

遗留问题:
  [LOW] bulkDelete 可优化为乐观更新（非阻塞）
  [LOW] 共享 props interface 可在后续迭代抽取

整体评分: 90/100
建议: 通过验收
```

**用户操作**: "验收通过"

---

## 关键收获

1. **default 工作流** 的 7 步流程为大规模重构提供了完整的安全网
2. **PRD 阶段** 澄清了关键决策（不需要向后兼容、保留批量操作），避免了实现阶段的返工
3. **架构分析** 识别了可复用的 Vue 替代品（BaseModal.vue），减少了重复工作
4. **TDD 批次 + smoke gate** 在批次 3 捕获了 BulkActions 的状态更新 bug
5. **修复循环** 自动处理了性能问题，无需人工干预
6. **Agent 交接记录** 确保了每个批次的上下文连续性
