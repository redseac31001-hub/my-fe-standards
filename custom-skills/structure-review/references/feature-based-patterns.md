# Feature-Based 正确模式示例

> 项目结构的正确组织方式

## 模式 1: 标准 Feature-Based 结构

**适用场景**: 中大型前端项目

```
src/
├── features/                    # 业务功能模块
│   ├── user-profile/           # 用户资料功能
│   │   ├── components/         # 功能私有组件
│   │   │   ├── ProfileCard.vue
│   │   │   ├── AvatarUploader.vue
│   │   │   └── index.ts        # 统一导出
│   │   ├── composables/        # 功能私有组合式函数
│   │   │   └── useProfile.ts
│   │   ├── store/              # 功能私有状态
│   │   │   └── profile.ts
│   │   ├── api/                # 功能私有 API
│   │   │   └── profile.api.ts
│   │   ├── types/              # 功能私有类型
│   │   │   └── profile.types.ts
│   │   └── index.ts            # 功能公共导出
│   │
│   ├── shopping-cart/          # 购物车功能
│   │   ├── components/
│   │   ├── composables/
│   │   ├── store/
│   │   └── index.ts
│   │
│   └── order-management/       # 订单管理功能
│       ├── components/
│       ├── composables/
│       ├── store/
│       └── index.ts
│
├── shared/                      # 真正的共享代码
│   ├── components/             # 通用 UI 组件
│   │   ├── Button/
│   │   ├── Modal/
│   │   └── index.ts
│   ├── composables/            # 通用组合式函数
│   │   ├── useDebounce.ts
│   │   └── useFetch.ts
│   ├── utils/                  # 通用工具函数
│   │   ├── format.ts
│   │   └── validation.ts
│   └── types/                  # 通用类型定义
│       └── common.types.ts
│
├── layouts/                     # 页面布局
│   ├── DefaultLayout.vue
│   └── AdminLayout.vue
│
├── router/                      # 路由配置
│   └── index.ts
│
├── App.vue
└── main.ts
```

**优点**:
- ✅ 相关代码聚合在一起
- ✅ 功能模块可独立开发和测试
- ✅ 清晰的模块边界
- ✅ 易于团队并行开发

---

## 模式 2: 微前端友好结构

**适用场景**: 需要拆分为微前端的大型项目

```
src/
├── apps/                        # 子应用
│   ├── main-app/               # 主应用
│   │   ├── features/
│   │   ├── shared/
│   │   └── index.ts
│   │
│   ├── admin-app/              # 管理后台
│   │   ├── features/
│   │   ├── shared/
│   │   └── index.ts
│   │
│   └── mobile-app/             # 移动端
│       ├── features/
│       ├── shared/
│       └── index.ts
│
├── packages/                    # 共享包
│   ├── ui-components/          # UI 组件库
│   ├── utils/                  # 工具库
│   └── api-client/             # API 客户端
│
└── config/                      # 全局配置
    ├── webpack.common.js
    └── tsconfig.base.json
```

**优点**:
- ✅ 子应用可独立部署
- ✅ 共享包版本可控
- ✅ 团队可完全独立开发

---

## 模式 3: Domain-Driven 结构

**适用场景**: 复杂业务逻辑的企业应用

```
src/
├── domains/                     # 业务领域
│   ├── identity/               # 身份认证领域
│   │   ├── application/        # 应用服务
│   │   │   └── AuthService.ts
│   │   ├── domain/             # 领域模型
│   │   │   ├── User.ts
│   │   │   └── Session.ts
│   │   ├── infrastructure/     # 基础设施
│   │   │   └── AuthRepository.ts
│   │   └── presentation/       # 展示层
│   │       ├── LoginPage.vue
│   │       └── RegisterPage.vue
│   │
│   ├── catalog/                # 商品目录领域
│   │   ├── application/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── presentation/
│   │
│   └── ordering/               # 订单领域
│       ├── application/
│       ├── domain/
│       ├── infrastructure/
│       └── presentation/
│
├── shared-kernel/               # 共享内核
│   ├── value-objects/
│   └── events/
│
└── infrastructure/              # 全局基础设施
    ├── http/
    └── storage/
```

**优点**:
- ✅ 业务逻辑清晰分层
- ✅ 符合 DDD 原则
- ✅ 易于理解复杂业务

---

## 模式对比

| 模式 | 复杂度 | 适用规模 | 学习曲线 |
|------|--------|----------|----------|
| 标准 Feature-Based | 低 | 中型 | 低 |
| 微前端友好 | 中 | 大型 | 中 |
| Domain-Driven | 高 | 企业级 | 高 |

## 选择建议

```
项目规模 < 10 个页面？
  └─ 是 → 简单的 Feature-Based
  └─ 否 → 需要多团队并行？
              └─ 是 → 微前端友好结构
              └─ 否 → 业务逻辑复杂？
                        └─ 是 → Domain-Driven
                        └─ 否 → 标准 Feature-Based
```
