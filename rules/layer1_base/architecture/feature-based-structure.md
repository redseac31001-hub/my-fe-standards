# Feature-Based Directory Structure

> Tags: #Architecture #FolderStructure #Scalability
> Priority: High

<!-- @level:summary -->
## Summary (摘要)

目录结构优先按业务特性组织，而不是按文件类型堆放。组件、状态、API、工具函数尽量围绕同一 feature 共置；`src/components` 只保留全局通用组件。

---

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| 目录组织 | 优先使用 `src/features/*` 或等价的业务模块目录 |
| 代码共置 | 组件、store、api、utils 尽量和所属 feature 放在一起 |
| 全局组件 | `src/components` 仅放可跨 feature 复用的基础组件 |
| 业务组件 | 业务专属组件必须跟随业务模块，不要塞进全局目录 |

### 自检清单

- 新增一个业务能力时，是否可以只在一个 feature 目录内完成主要改动？
- 打开一个 feature 目录后，是否能同时看到它的页面、组件、状态和请求逻辑？
- `src/components` 里是否只剩下设计系统或全局基础组件？

---

<!-- @level:full -->
## 1. Context (背景与适用范围)
适用于 Vue 3 项目的目录组织。
随着项目规模扩大，传统的按文件类型分类（Components, Views, Stores 堆在一起）会导致代码难以维护和查找。

## 2. The Rule (规则详情)

*   **必须** 采用基于特性 (Feature-First) 或 模块化 (Domain-Driven) 的目录结构。
*   相关的组件、状态 (Store)、API 请求、工具函数应尽量放在同一个 Modules 或 Features 目录下。
*   `src/components` 仅存放**全局通用**的基础组件（如 Button, Input）。
*   业务组件应紧随其业务模块。

## 3. Reasoning (核心原理)
*   **Colocation**: 将相关联的代码放在一起。修改一个功能时，不需要在文件夹之间跳跃。
*   **Scalability**: 功能模块可以独立增删，甚至拆分为独立的 npm 包。
*   **Cognitive Load**: 开发者只需关注当前开发的业务模块，无需面对庞大的全局文件夹。

## 4. Examples (代码示例)

### ✅ Good (推荐目录结构)
```text
src/
├── components/          # 全局通用组件 (Design System)
│   ├── BaseButton.vue
│   └── AppModal.vue
├── features/            # 业务特性模块
│   ├── user-profile/    # 用户资料模块
│   │   ├── components/  # 该模块专用的组件
│   │   │   └── AvatarUpload.vue
│   │   ├── store/       # 该模块的状态
│   │   │   └── userStore.ts
│   │   ├── api/         # 该模块的 API
│   │   └── index.vue    # 模块入口
│   └── dashboard/
└── main.ts
```

### ❌ Bad (传统结构的弊端)
```text
src/
├── components/
│   ├── BaseButton.vue
│   ├── AvatarUpload.vue  # 业务组件混在通用组件里
│   └── DashboardChart.vue
├── store/
│   ├── userStore.ts      # 所有 store 堆在一起
│   └── dashboard.ts
├── views/
│   ├── UserProfile.vue
│   └── Dashboard.vue
```
