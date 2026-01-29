# 项目结构重构策略

> 从反模式迁移到正确模式的路径

## 策略 1: 小步迁移 (Incremental Migration)

### 适用场景
- ✅ 临近发布期（< 2 周）
- ✅ 测试覆盖率不足（< 60%）
- ✅ 团队对新结构不熟悉
- ✅ 需要保持系统稳定

### 风险评估
| 风险 | 等级 | 说明 |
|------|------|------|
| 系统中断 | 低 | 每次只改动少量文件 |
| 回滚复杂度 | 低 | 每步都可独立回滚 |
| 时间成本 | 高 | 需要多次迭代 |
| 认知负担 | 中 | 新旧结构并存期间 |

### 执行步骤

#### Phase 1: 准备工作（1-2 天）
```bash
# 1. 创建目标目录结构
mkdir -p src/features
mkdir -p src/shared

# 2. 配置路径别名
# tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/features/*": ["src/features/*"],
      "@/shared/*": ["src/shared/*"],
      "@/legacy/*": ["src/*"]  // 兼容旧路径
    }
  }
}
```

#### Phase 2: 迁移共享代码（3-5 天）
```
# 优先迁移无依赖的工具函数
src/utils/format.ts → src/shared/utils/format.ts
src/utils/validation.ts → src/shared/utils/validation.ts

# 更新导入并保留重导出
// src/utils/format.ts (旧位置)
export * from '@/shared/utils/format'  // 兼容旧导入
```

#### Phase 3: 逐个功能迁移（每功能 1-2 天）
```
# 选择一个独立功能开始
1. 创建 features/user-profile/ 目录
2. 移动相关组件、store、api
3. 更新内部导入路径
4. 测试功能正常
5. 更新外部引用
6. 重复下一个功能
```

#### Phase 4: 清理（1-2 天）
```bash
# 删除旧目录中的重导出文件
# 更新文档
# 全量回归测试
```

### 回滚方案
```bash
# 每个 Phase 都可以独立回滚
git revert <phase-commit>

# 保留旧路径别名直到迁移完成
# 可随时切换回旧路径
```

---

## 策略 2: 一次性迁移 (Big Bang Migration)

### 适用场景
- ✅ 新项目或项目初期
- ✅ 测试覆盖率充足（> 80%）
- ✅ 团队熟悉目标结构
- ✅ 有足够时间窗口（> 1 周）

### 风险评估
| 风险 | 等级 | 说明 |
|------|------|------|
| 系统中断 | 中 | 大量文件同时变更 |
| 回滚复杂度 | 中 | 需要回滚整个变更集 |
| 时间成本 | 低 | 一次性完成 |
| 认知负担 | 低 | 直接使用新结构 |

### 执行步骤

#### 准备工作
```bash
# 1. 创建迁移分支
git checkout -b refactor/feature-based-structure

# 2. 备份当前结构
cp -r src src.backup

# 3. 确保所有测试通过
npm test
```

#### 执行迁移
```bash
# 使用自动化脚本（推荐）
node scripts/migrate-to-feature-based.js

# 或手动执行
# 1. 创建新目录结构
# 2. 批量移动文件
# 3. 批量更新导入路径
# 4. 运行测试验证
```

#### 迁移脚本示例
```javascript
// scripts/migrate-to-feature-based.js
const fs = require('fs')
const path = require('path')

const FEATURE_MAPPING = {
  'user': ['UserCard', 'UserList', 'userStore', 'userApi'],
  'product': ['ProductCard', 'ProductList', 'productStore', 'productApi'],
  'cart': ['CartButton', 'CartList', 'cartStore', 'cartApi'],
}

function migrate() {
  for (const [feature, files] of Object.entries(FEATURE_MAPPING)) {
    // 创建目录
    fs.mkdirSync(`src/features/${feature}/components`, { recursive: true })
    fs.mkdirSync(`src/features/${feature}/store`, { recursive: true })
    fs.mkdirSync(`src/features/${feature}/api`, { recursive: true })

    // 移动文件并更新导入
    // ...
  }
}
```

### 回滚方案
```bash
# 回滚整个迁移
git checkout main
git branch -D refactor/feature-based-structure

# 或从备份恢复
rm -rf src
mv src.backup src
```

---

## 策略 3: 适配层过渡 (Adapter Layer)

### 适用场景
- ✅ 历史包袱重（遗留代码多）
- ✅ 需要兼容旧 API
- ✅ 多团队并行开发
- ✅ 不能中断现有开发

### 风险评估
| 风险 | 等级 | 说明 |
|------|------|------|
| 系统中断 | 低 | 通过适配层隔离 |
| 回滚复杂度 | 低 | 删除适配层即可 |
| 时间成本 | 高 | 需要维护两套代码 |
| 认知负担 | 高 | 理解适配层逻辑 |

### 执行步骤

#### Phase 1: 创建适配层
```typescript
// src/adapters/user.adapter.ts
// 新接口
export interface UserService {
  getUser(id: string): Promise<User>
  updateUser(id: string, data: UserUpdateDto): Promise<User>
}

// 适配旧实现
import { legacyGetUser, legacyUpdateUser } from '@/legacy/user'

export const userService: UserService = {
  getUser: async (id) => {
    const legacyUser = await legacyGetUser(id)
    return transformToNewFormat(legacyUser)
  },
  updateUser: async (id, data) => {
    const legacyData = transformToLegacyFormat(data)
    const legacyUser = await legacyUpdateUser(id, legacyData)
    return transformToNewFormat(legacyUser)
  }
}
```

#### Phase 2: 新功能使用新结构
```typescript
// 新功能直接使用 features 结构
// src/features/user-profile/
//   ├── components/
//   ├── composables/
//   └── index.ts

// 通过适配层调用旧功能
import { userService } from '@/adapters/user.adapter'
```

#### Phase 3: 逐步迁移旧功能
```typescript
// 当旧功能需要修改时，迁移到新结构
// 然后更新适配层指向新实现

// src/adapters/user.adapter.ts
import { userService as newUserService } from '@/features/user'

export const userService: UserService = newUserService
```

#### Phase 4: 移除适配层
```bash
# 当所有功能都迁移完成
# 1. 更新所有导入指向 features
# 2. 删除 adapters 目录
# 3. 删除 legacy 目录
```

### 回滚方案
```bash
# 适配层本身就是隔离层
# 只需将适配层重新指向旧实现
export const userService = legacyUserService
```

---

## 策略对比

| 维度 | 小步迁移 | 一次性迁移 | 适配层过渡 |
|------|----------|------------|------------|
| 风险 | 低 | 中 | 低 |
| 时间 | 长 | 短 | 最长 |
| 复杂度 | 中 | 低 | 高 |
| 适用场景 | 生产环境 | 新项目 | 遗留系统 |
| 团队要求 | 低 | 高 | 高 |

## 选择决策树

```
距离发布 < 2 周？
  └─ 是 → 等待发布后再迁移
  └─ 否 → 测试覆盖率 > 80%？
              └─ 是 → 团队熟悉新结构？
              │         └─ 是 → 一次性迁移
              │         └─ 否 → 小步迁移
              └─ 否 → 遗留代码多？
                        └─ 是 → 适配层过渡
                        └─ 否 → 小步迁移
```

## 通用注意事项

1. **备份先行**: 任何迁移前都要备份
2. **测试覆盖**: 迁移前确保测试覆盖关键路径
3. **文档同步**: 更新相关文档和 README
4. **团队同步**: 确保团队了解新结构
5. **监控告警**: 迁移后密切关注错误日志
