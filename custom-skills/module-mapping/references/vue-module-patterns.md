# Vue 模块识别模式

本文档定义了 Vue 项目中功能模块的识别规则和最佳实践。

## 模块类型定义

| 类型 | 目录模式 | 说明 | 识别特征 |
|------|----------|------|----------|
| `page` | `views/`, `pages/` | 页面模块 | 包含路由入口组件 |
| `feature` | `features/`, `modules/` | 功能模块 | 独立业务逻辑单元 |
| `shared` | `components/` | 共享组件 | 可复用 UI 组件 |
| `util` | `utils/`, `composables/`, `hooks/` | 工具模块 | 通用函数/组合式函数 |
| `api` | `api/`, `services/` | API 模块 | 接口请求封装 |
| `store` | `store/`, `stores/` | 状态模块 | Vuex/Pinia 状态管理 |
| `layout` | `layouts/` | 布局模块 | 页面布局组件 |

## 模块识别规则

### 1. 页面模块 (page)

```
src/views/
├── login/              ← 模块: views/login
│   ├── index.vue       ← 入口
│   ├── components/     ← 私有组件
│   └── hooks/          ← 私有 hooks
├── registry/           ← 模块: views/registry
│   ├── selfSign/       ← 子模块
│   ├── fillInfo/       ← 子模块
│   └── openAccount/    ← 子模块
```

**识别特征**：
- 位于 `views/` 或 `pages/` 目录下
- 包含 `index.vue` 或 `*.page.vue` 入口文件
- 通常对应路由配置

### 2. 功能模块 (feature)

```
src/features/
├── user-management/    ← 模块: features/user-management
│   ├── index.ts        ← 公共导出
│   ├── components/     ← 模块内组件
│   ├── api/            ← 模块内 API
│   ├── store/          ← 模块内状态
│   └── types/          ← 模块内类型
```

**识别特征**：
- 位于 `features/` 或 `modules/` 目录下
- 包含完整的业务逻辑单元
- 通常有独立的 API、状态、组件

### 3. 共享组件 (shared)

```
src/components/
├── Button/             ← 组件: Button
├── Modal/              ← 组件: Modal
├── Form/               ← 组件组: Form
│   ├── Input.vue
│   ├── Select.vue
│   └── index.ts
```

**识别特征**：
- 位于 `components/` 目录下
- 可被多个模块复用
- 通常是纯 UI 组件

## 模块健康度评估

### 评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| 文件数量 | 20% | 模块内文件数是否合理 |
| 代码行数 | 25% | 模块总代码量 |
| 最大文件 | 20% | 是否存在超大文件 |
| 依赖数量 | 20% | 对外依赖是否过多 |
| 问题数量 | 15% | 检测到的问题数 |

### 健康度等级

| 等级 | 分数范围 | 图标 | 建议 |
|------|----------|------|------|
| 优秀 | 80-100 | 🟢 | 保持现状 |
| 良好 | 60-79 | 🟡 | 逐步改进 |
| 较差 | 0-59 | 🔴 | 需要重构 |

## 常见问题模式

### 1. 模块过大
```
❌ views/registry/ (8000+ 行)
   └── 建议拆分为多个子模块
```

### 2. 循环依赖
```
❌ moduleA → moduleB → moduleA
   └── 提取公共逻辑到 shared 模块
```

### 3. 越权引用
```
❌ views/login 直接引用 views/registry/internal
   └── 通过公共接口暴露必要 API
```

## 与其他技能关联

| 场景 | 推荐技能 |
|------|----------|
| 健康度低于 60 | `structure-review` 深度分析 |
| 需要重构模块 | `component-refactoring` |
| 发现大文件 | `structure-analyzer` Agent |
