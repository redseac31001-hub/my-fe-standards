# Vue 2 Best Practices (Legacy/Maintenance Mode)

> Tags: #Vue2 #OptionsAPI #LegacyMaintenance
> Priority: Medium

<!-- @level:summary -->
## Summary (摘要)

Vue 2 项目处于维护模式，默认使用一致的 Options API 组织顺序。禁止用 Mixins 承载新逻辑、禁止直接修改 props，并且必须避开 Vue 2 响应式系统对对象新增属性和数组索引赋值的已知陷阱。

---

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| 组件组织 | 按 `name -> components -> props -> data -> computed -> watch -> lifecycle -> methods` 排序 |
| 逻辑复用 | 新逻辑不要继续堆 Mixins，优先工厂函数或 Provide/Inject |
| Props 使用 | 只读，不直接修改，不在 `data` 中直接复制 |
| 响应式更新 | 新增对象属性用 `$set`，数组索引更新用 `$set/splice` |
| 生命周期 | `created` 做数据初始化，`mounted` 做 DOM 操作，`beforeDestroy` 做清理 |

### 快速避坑

- `this.obj.newKey = value` 不会被可靠追踪，改用 `this.$set(this.obj, 'newKey', value)`。
- `this.arr[index] = value` 不要直接写，改用 `this.$set(this.arr, index, value)`。
- 维护老项目时优先保持稳定，不要为了“现代化”一次性重写整片组件。

---

<!-- @level:full -->
## 1. Context (背景与适用范围)
适用于需要维护的 Vue 2.x 项目。
对于新项目，**强烈建议直接使用 Vue 3**。本规则仅为维护旧项目提供指导。

## 2. The Rule (规则详情)

### 2.1 Options API 组织规范
按以下顺序组织组件选项，保持团队一致性：

```javascript
export default {
  name: 'MyComponent',       // 1. 名称 (必须)
  components: {},            // 2. 子组件注册
  mixins: [],                // 3. Mixins (尽量避免)
  props: {},                 // 4. Props
  data() {},                 // 5. Data (必须是函数)
  computed: {},              // 6. 计算属性
  watch: {},                 // 7. 侦听器
  // 8. 生命周期钩子 (按执行顺序)
  beforeCreate() {},
  created() {},
  beforeMount() {},
  mounted() {},
  beforeUpdate() {},
  updated() {},
  beforeDestroy() {},
  destroyed() {},
  methods: {}                // 9. 方法
}
```

### 2.2 核心禁止项

*   **严禁** 使用 Mixins 处理新逻辑。Mixins 导致隐式依赖、命名冲突，难以追踪。如需复用逻辑，使用工厂函数或 Provide/Inject。
*   **严禁** 直接修改 `props`。Props 是单向数据流。
*   **严禁** 在 `data` 中将 `props` 直接赋值（丢失响应性），应使用 `computed` 或 `watch`。

### 2.3 响应式陷阱 (Vue 2 特有)

Vue 2 的响应式基于 `Object.defineProperty`，有以下限制：

```javascript
// ❌ 无法检测的变化
this.obj.newKey = 'value';        // 新增对象属性
this.arr[index] = newValue;       // 通过索引修改数组
this.arr.length = newLength;      // 修改数组长度

// ✅ 正确做法
this.$set(this.obj, 'newKey', 'value');
this.$set(this.arr, index, newValue);
this.arr.splice(newLength);
```

### 2.4 生命周期使用指南

| 钩子 | 推荐用途 | 禁止用途 |
|------|----------|----------|
| `created` | API 数据初始化 | DOM 操作 |
| `mounted` | DOM 操作、第三方库初始化 | - |
| `beforeDestroy` | 清理定时器、解绑事件、销毁第三方实例 | - |

## 3. Reasoning (核心原理)
*   **Maintainability**: 遵循一致的组织顺序，降低维护成本。
*   **Avoid Pitfalls**: Vue 2 响应式系统有已知限制，规避可避免隐蔽 Bug。
*   **Migration Path**: 避免 Mixins 有助于未来迁移至 Vue 3 Composition API。

## 4. Examples (代码示例)

### ✅ Good (推荐写法)
```javascript
export default {
  name: 'UserCard',
  props: {
    userId: {
      type: Number,
      required: true
    }
  },
  data() {
    return {
      user: null,
      loading: false
    };
  },
  computed: {
    displayName() {
      return this.user?.name || 'Unknown';
    }
  },
  watch: {
    userId: {
      immediate: true,
      handler(newId) {
        this.fetchUser(newId);
      }
    }
  },
  beforeDestroy() {
    // 清理订阅或定时器
    this.unsubscribe?.();
  },
  methods: {
    async fetchUser(id) {
      this.loading = true;
      try {
        this.user = await api.getUser(id);
      } finally {
        this.loading = false;
      }
    }
  }
};
```

### ❌ Bad (禁止写法)
```javascript
export default {
  mixins: [userMixin, loadingMixin], // ❌ 多个 Mixins 难以追踪
  props: ['userId'],                 // ❌ 缺少类型定义
  data: {                            // ❌ data 不是函数
    user: null
  },
  created() {
    this.userId = 123;               // ❌ 直接修改 props
  },
  methods: {
    addTag(tag) {
      this.user.tags.push(tag);      // ⚠️ 可能不触发更新，需用 $set
    }
  }
};
```

## 5. Migration Notes (迁移提示)
如果计划迁移至 Vue 3：
1.  优先重构 Mixins 为独立的工具函数。
2.  将复杂的 `watch` 逻辑提取为可复用函数。
3.  使用 `@vue/compat` 构建模式逐步迁移。

## 6. Metadata
*   **Version**: 1.0
*   **Related Rules**: `vue3-script-setup.md`

