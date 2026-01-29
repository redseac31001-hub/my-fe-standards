# 项目结构反模式清单

> 应该避免的目录组织方式

## 反模式 1: 按类型全局分组 (Type-Grouped)

**严重度**: ⚠️ Warning

**错误示例**:
```
src/
├── components/          # 所有组件混在一起
│   ├── UserCard.vue
│   ├── ProductList.vue
│   ├── CartButton.vue
│   ├── OrderTable.vue
│   └── ... (100+ 组件)
├── views/               # 所有页面
├── store/               # 所有状态
│   ├── user.ts
│   ├── product.ts
│   ├── cart.ts
│   └── order.ts
├── api/                 # 所有 API
├── utils/               # 所有工具
└── types/               # 所有类型
```

**问题**:
- ❌ 相关代码分散在不同目录
- ❌ 修改一个功能需要跨多个目录
- ❌ 难以独立开发和测试
- ❌ 组件目录膨胀难以管理

**正确做法**:
```
src/features/user-profile/
├── components/
├── store/
├── api/
└── types/
```

---

## 反模式 2: 过深嵌套 (Deep Nesting)

**严重度**: ⚠️ Warning

**错误示例**:
```
src/
└── modules/
    └── features/
        └── user/
            └── profile/
                └── components/
                    └── forms/
                        └── inputs/
                            └── TextInput.vue  # 8 层嵌套！
```

**问题**:
- ❌ 导入路径过长：`../../../../components/forms/inputs/TextInput`
- ❌ 模块定位困难
- ❌ 可能存在职责划分不清

**正确做法**:
```
src/features/user-profile/
├── components/
│   └── ProfileForm/
│       └── TextInput.vue  # 最多 4-5 层
└── index.ts
```

**建议**: 目录深度不超过 5 层（从 src 开始计算）

---

## 反模式 3: 巨型文件 (Giant File)

**严重度**: 🔴 Error

**错误示例**:
```typescript
// src/utils/helpers.ts - 2000+ 行！
export function formatDate() { ... }
export function formatCurrency() { ... }
export function validateEmail() { ... }
export function parseQuery() { ... }
export function debounce() { ... }
export function throttle() { ... }
// ... 还有 100+ 个函数
```

**问题**:
- ❌ 难以理解和维护
- ❌ 测试困难
- ❌ 容易产生合并冲突
- ❌ 违反单一职责原则

**正确做法**:
```
src/shared/utils/
├── date.ts           # 日期相关
├── currency.ts       # 货币相关
├── validation.ts     # 验证相关
├── url.ts            # URL 相关
├── timing.ts         # 防抖节流
└── index.ts          # 统一导出
```

**建议**: 单文件不超过 500 行

---

## 反模式 4: 命名混乱 (Confusing Names)

**严重度**: ⚠️ Warning

**错误示例**:
```
src/
├── user.ts
├── users.ts
├── userInfo.ts
├── user-info.ts
├── UserData.ts
└── userData.ts
```

**问题**:
- ❌ 容易混淆和误用
- ❌ 代码审查时难以区分
- ❌ 可能存在重复实现
- ❌ 新成员学习成本高

**正确做法**:
```
src/features/user/
├── user.model.ts      # 用户模型
├── user.api.ts        # 用户 API
├── user.store.ts      # 用户状态
└── user.types.ts      # 用户类型
```

**命名规范建议**:
- 使用一致的命名风格（kebab-case 或 camelCase）
- 使用后缀区分文件类型：`.model.ts`, `.api.ts`, `.store.ts`
- 避免复数和单数混用

---

## 反模式 5: 循环依赖 (Circular Dependencies)

**严重度**: 🔴 Error

**错误示例**:
```typescript
// features/user/index.ts
import { getOrdersByUser } from '../order'
export function getUserWithOrders() { ... }

// features/order/index.ts
import { getUserById } from '../user'  // 循环依赖！
export function getOrdersByUser() { ... }
```

**问题**:
- ❌ 可能导致运行时错误
- ❌ 模块加载顺序不确定
- ❌ 难以理解代码流程
- ❌ 测试困难

**正确做法**:
```typescript
// shared/services/user-order.service.ts
import { getUserById } from '@/features/user'
import { getOrdersByUser } from '@/features/order'

export function getUserWithOrders(userId: string) {
  const user = getUserById(userId)
  const orders = getOrdersByUser(userId)
  return { user, orders }
}
```

---

## 反模式 6: 跨功能直接引用 (Cross-Feature Direct Import)

**严重度**: ℹ️ Info

**错误示例**:
```typescript
// features/order/components/OrderItem.vue
import UserAvatar from '@/features/user/components/internal/UserAvatar.vue'
//                                              ^^^^^^^^ 直接引用内部组件！
```

**问题**:
- ❌ 破坏模块边界
- ❌ 内部实现变更影响其他模块
- ❌ 增加模块间耦合

**正确做法**:
```typescript
// features/user/index.ts
export { UserAvatar } from './components/UserAvatar.vue'  // 公开导出

// features/order/components/OrderItem.vue
import { UserAvatar } from '@/features/user'  // 通过公开 API 引用
```

---

## 反模式 7: 配置散落 (Scattered Config)

**严重度**: ⚠️ Warning

**错误示例**:
```
src/
├── components/Button.vue    # 内含 API_URL 常量
├── utils/request.ts         # 内含 TIMEOUT 常量
├── store/user.ts            # 内含 TOKEN_KEY 常量
└── views/Login.vue          # 内含 REDIRECT_URL 常量
```

**问题**:
- ❌ 配置难以统一管理
- ❌ 环境切换困难
- ❌ 容易遗漏需要修改的地方

**正确做法**:
```
src/
├── config/
│   ├── api.config.ts        # API 相关配置
│   ├── auth.config.ts       # 认证相关配置
│   └── index.ts             # 统一导出
└── ...
```

---

## 反模式检测清单

| 反模式 | 检测规则 | 自动化检测 |
|--------|----------|------------|
| 按类型分组 | SA001 | ✅ |
| 过深嵌套 | SA002 | ✅ |
| 巨型文件 | SA003 | ✅ |
| 命名混乱 | SA004 | ✅ |
| 循环依赖 | - | 需要 import 分析 |
| 跨功能引用 | SA005 (简化版) | ⚠️ 部分 |
| 配置散落 | - | 手动检查 |

## 修复优先级

```
1. 🔴 巨型文件 (SA003)      → 立即拆分
2. 🔴 循环依赖              → 立即解耦
3. 🟡 按类型分组 (SA001)    → 规划迁移
4. 🟡 过深嵌套 (SA002)      → 逐步扁平化
5. 🟡 命名混乱 (SA004)      → 统一规范
6. 🔵 跨功能引用 (SA005)    → 长期优化
7. 🔵 配置散落              → 集中管理
```
