# 功能开发示例：Vue 3 表单验证组件

> 完整的 sprint 工作流执行记录，展示从需求分析到验收的全过程。

---

## 场景描述

**用户需求**: "帮我实现一个通用的表单验证组件，支持必填、邮箱、手机号、自定义规则"

**项目背景**:
- 技术栈: Vue 3 + TypeScript + Vite
- 已有: `src/components/` 目录，使用 Composition API
- 测试框架: Vitest + @vue/test-utils

**工作流选择**: `sprint`（5 步），因为这是一个中等规模的功能开发，不需要 PRD 生成，但需要代码审查。

---

## Phase 1: 项目分析 (analyze)

**structure-analyzer 输出摘要**:

```json
{
  "moduleSummary": {
    "totalFiles": 47,
    "components": 12,
    "composables": 5,
    "utils": 8
  },
  "relevantPatterns": [
    "Composition API with <script setup>",
    "Props 使用 defineProps<T>() 泛型",
    "组件测试使用 mount() + wrapper.find()"
  ],
  "existingValidation": [
    "src/utils/validators.ts - 基础验证函数（isEmpty, isEmail）",
    "src/composables/useForm.ts - 表单状态管理（但无验证逻辑）"
  ]
}
```

**关键发现**:
- 已有 `validators.ts` 可复用 `isEmpty` 和 `isEmail`
- `useForm.ts` 需要扩展以集成验证逻辑
- 项目命名约定: composable 以 `use` 开头，组件使用 PascalCase

---

## Phase 2: 任务规划 (plan)

**planner Agent 生成的 TaskBook**:

```json
{
  "id": "tb-20260313-form-validation",
  "title": "通用表单验证组件",
  "taskType": "new-feature",
  "status": "confirmed",
  "context": {
    "relatedFiles": [
      "src/utils/validators.ts",
      "src/composables/useForm.ts",
      "src/components/BaseInput.vue"
    ],
    "dependencies": ["vitest", "@vue/test-utils"],
    "architectureNotes": "复用 validators.ts，扩展 useForm composable"
  },
  "tasks": [
    {
      "id": "T1",
      "title": "设计 useValidation composable 接口",
      "type": "design",
      "status": "pending",
      "priority": "high",
      "dependencies": [],
      "acceptanceCriteria": [
        "定义 ValidationRule 类型（required/email/phone/pattern/custom）",
        "定义 useValidation 返回值类型（errors/validate/reset）",
        "接口支持异步自定义验证规则"
      ]
    },
    {
      "id": "T2",
      "title": "编写 useValidation 测试用例",
      "type": "test",
      "status": "pending",
      "priority": "high",
      "dependencies": ["T1"],
      "acceptanceCriteria": [
        "覆盖 required/email/phone 三种内置规则",
        "覆盖自定义同步和异步规则",
        "覆盖多字段同时验证",
        "覆盖 reset 清除错误状态"
      ]
    },
    {
      "id": "T3",
      "title": "实现 useValidation composable",
      "type": "implement",
      "status": "pending",
      "priority": "high",
      "dependencies": ["T2"],
      "acceptanceCriteria": [
        "所有 T2 测试通过",
        "复用 validators.ts 中已有的 isEmpty/isEmail",
        "新增 isPhone 验证函数到 validators.ts"
      ],
      "scope": {
        "files": [
          "src/composables/useValidation.ts",
          "src/utils/validators.ts"
        ]
      }
    },
    {
      "id": "T4",
      "title": "实现 FormField 组件",
      "type": "implement",
      "status": "pending",
      "priority": "medium",
      "dependencies": ["T3"],
      "acceptanceCriteria": [
        "组件接收 rules prop 并在 blur 时触发验证",
        "错误状态显示红色边框和错误消息",
        "组件通过 v-model 双向绑定"
      ],
      "scope": {
        "files": [
          "src/components/FormField.vue",
          "tests/components/FormField.test.ts"
        ]
      }
    },
    {
      "id": "T5",
      "title": "代码审查",
      "type": "review",
      "status": "pending",
      "priority": "medium",
      "dependencies": ["T3", "T4"],
      "acceptanceCriteria": [
        "代码符合 clean-code 规范",
        "无重复逻辑",
        "类型安全，无 any"
      ]
    }
  ],
  "changelog": [
    {
      "timestamp": "2026-03-13T09:00:00Z",
      "taskId": null,
      "changeType": "added",
      "reason": "初始任务分解"
    }
  ]
}
```

**用户确认**: "确认执行"

---

## Phase 3: TDD 实现 (tdd_implement)

### T1: 接口设计

**tdd-driver 输出**:

```typescript
// src/composables/useValidation.ts - 接口定义

export type ValidationRule =
  | { type: 'required'; message?: string }
  | { type: 'email'; message?: string }
  | { type: 'phone'; message?: string }
  | { type: 'pattern'; pattern: RegExp; message: string }
  | { type: 'custom'; validator: (value: unknown) => boolean | Promise<boolean>; message: string };

export interface FieldValidation {
  rules: ValidationRule[];
}

export interface ValidationResult {
  errors: Record<string, string[]>;
  validate: (fields?: string[]) => Promise<boolean>;
  reset: () => void;
  isValid: Ref<boolean>;
}

export declare function useValidation(
  fields: Record<string, FieldValidation>
): ValidationResult;
```

**交接记录**:
```json
{
  "from": "tdd-driver",
  "to": "tdd-driver",
  "type": "standard",
  "timestamp": "2026-03-13T09:15:00Z",
  "context": "T1 接口设计完成，进入 T2 测试编写",
  "deliverables": ["src/composables/useValidation.ts"]
}
```

### T2: 测试编写 (RED)

**tdd-driver RED 阶段**:

```typescript
// tests/composables/useValidation.test.ts

describe('useValidation', () => {
  it('必填规则 - 空值返回错误', async () => {
    const { errors, validate } = useValidation({
      name: { rules: [{ type: 'required' }] }
    });
    const form = reactive({ name: '' });
    await validate();
    expect(errors.name).toContain('此字段为必填项');
  });

  it('邮箱规则 - 无效格式返回错误', async () => {
    // ... 测试代码
  });

  it('手机号规则 - 非11位返回错误', async () => {
    // ... 测试代码
  });

  it('自定义异步规则 - 支持 Promise', async () => {
    // ... 测试代码
  });

  it('reset 清除所有错误', async () => {
    // ... 测试代码
  });

  it('多字段同时验证', async () => {
    // ... 测试代码
  });
});
```

**测试运行**: 6 个测试全部失败（预期）

### T3: 实现 (GREEN)

**tdd-driver GREEN 阶段 - 最终实现**:

逐个通过测试，最终：
- 测试运行: 6/6 通过
- 复用了 `validators.ts` 的 `isEmpty` 和 `isEmail`
- 新增 `isPhone` 到 `validators.ts`

**smoke gate**: `npm test` - 通过

### T4: FormField 组件

**同样的 RED → GREEN 循环**:
- 4 个组件测试全部通过
- 集成 `useValidation`
- 支持 `v-model` + `blur` 验证

**smoke gate**: `npm test` - 通过（10/10 测试）

---

## Phase 4: 代码审查 (review)

**code-reviewer 输出**:

```
代码审查报告 - 通用表单验证组件

整体评分: 92/100

优点:
- 类型定义完整，无 any 使用
- 复用了已有 validators.ts 函数
- 测试覆盖率达 89%

建议改进:
- [MEDIUM] useValidation.ts:45 - 可用 Map 替代 Object 存储错误，提升性能
- [LOW] FormField.vue:23 - 建议抽取错误消息为 i18n key

结论: 通过
```

**交接记录**:
```json
{
  "from": "code-reviewer",
  "to": "task-orchestrator",
  "type": "qa_pass",
  "timestamp": "2026-03-13T11:30:00Z",
  "context": "代码审查通过，评分 92/100，2 个 MEDIUM/LOW 建议（非阻塞）"
}
```

**review gate**: 通过

---

## Phase 5: 验收 (acceptance)

**全量验证**:
```
npm run build  → 通过（0 errors, 0 warnings）
npm test       → 通过（10/10 tests, 89% coverage）
```

**验收报告**:

```
验收报告 - 通用表单验证组件

执行摘要:
  5 个任务全部完成，0 个阻塞，0 个跳过。
  实现了 useValidation composable 和 FormField 组件，
  复用了已有的 validators.ts 验证函数。

代码变更:
  新增: 3 文件（useValidation.ts, FormField.vue, useValidation.test.ts）
  修改: 1 文件（validators.ts - 新增 isPhone）

测试结果:
  10 个测试通过，覆盖率 89%

遗留问题:
  [LOW] 国际化支持（可在后续迭代添加）

整体评分: 92/100
建议: 通过验收
```

**用户操作**: "验收通过" → TaskBook 归档为 completed

---

## 关键收获

1. **sprint 工作流** 跳过了 PRD 生成和独立 build-fix 步骤，节省约 40% 时间
2. **TDD 循环** 确保每一步都有测试保障，最终覆盖率 89%
3. **复用已有代码**（validators.ts）避免了重复造轮子
4. **Agent 交接记录** 保证了上下文连续性，code-reviewer 能看到完整的变更历史
