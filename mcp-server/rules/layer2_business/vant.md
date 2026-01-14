# Vant Usage Guidelines

> Layer: Business
> Context: Mobile UI Component Library Usage (Vue 3 + Vant 4.x / Vue 2 + Vant 2.x)

<!-- @level:summary -->
## Summary (摘要)

Vant 移动端 UI 组件库使用规范。核心要点：按需引入组件、使用 postcss 适配移动端、长列表使用虚拟滚动、表单设置正确的 inputmode。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| 组件引入 | 按需引入，使用 `unplugin-vue-components` |
| 样式定制 | 使用 CSS Variables，禁止 `!important` |
| 移动端适配 | 使用 `postcss-px-to-viewport`，基准 375px |
| 长列表 | 使用 `<van-list>` + 无限滚动 |
| 表单输入 | 设置正确的 `type` 和 `inputmode` |

### 常用场景速查

| 场景 | 推荐方案 |
|------|----------|
| 数字输入 | `type="tel"` + `inputmode="numeric"` |
| 下拉刷新 | `<van-pull-refresh>` 包裹列表 |
| 骨架屏 | `<van-skeleton>` 提升首屏体验 |
| 图片懒加载 | `<van-image lazy-load>` |
| 安全区域 | 使用 `safe-area-inset-bottom` CSS 变量 |

### 禁止写法

- 全量引入 Vant（打包体积过大）
- 硬编码像素值（不适配不同屏幕）
- 长列表不使用虚拟滚动
- 移动端表单不设置 inputmode

<!-- @level:full -->
## 1. The Rule

### 组件使用原则
*   **必须** 使用 `van-` 前缀的组件，而非原生 HTML 元素实现相同功能。
*   **禁止** 使用 `!important` 覆盖 Vant 样式。优先使用 CSS Variables 进行主题定制。
*   **必须** 按需引入组件，使用 `unplugin-vue-components` 自动导入。

### 移动端适配
*   **必须** 配合 `postcss-pxtorem` 或 `postcss-px-to-viewport` 实现移动端适配。
*   **推荐** 设计稿宽度使用 375px 作为基准。

### 列表与虚拟滚动
*   **必须** 长列表使用 `<van-list>` 配合 `load` 事件实现无限滚动。
*   **推荐** 超大数据量 (>500 条) 使用 `@vant/use` 的 `useVirtualList`。

### 表单处理
*   **必须** 使用 `<van-form>` 配合 `rules` 属性进行表单校验。
*   **必须** 为输入框设置合适的 `type` 和 `inputmode` 以优化移动端键盘体验。

### 弹出层 (Popup/Dialog)
*   **推荐** 使用 `teleport` 将弹出层挂载到 body，避免层级问题。
*   **必须** 为 Dialog 设置 `close-on-click-overlay` 的合理行为。

## 2. Common Patterns

### 按需引入 (推荐配置)
```typescript
// vite.config.ts
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';

export default {
  plugins: [
    Components({
      resolvers: [VantResolver()],
    }),
  ],
};
```

### 移动端适配 (postcss-px-to-viewport)
```javascript
// postcss.config.js
module.exports = {
  plugins: {
    'postcss-px-to-viewport': {
      viewportWidth: 375, // 设计稿宽度
      unitPrecision: 5,
      viewportUnit: 'vw',
      selectorBlackList: ['.ignore'],
      minPixelValue: 1,
    },
  },
};
```

### 无限滚动列表
```vue
<script setup lang="ts">
import { ref } from 'vue';

interface ListItem {
  id: number;
  title: string;
}

const list = ref<ListItem[]>([]);
const loading = ref(false);
const finished = ref(false);

const onLoad = async () => {
  loading.value = true;
  try {
    const newItems = await fetchList(list.value.length);
    list.value.push(...newItems);
    if (newItems.length < 10) {
      finished.value = true; // 没有更多数据
    }
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <van-list
    v-model:loading="loading"
    :finished="finished"
    finished-text="没有更多了"
    @load="onLoad"
  >
    <van-cell v-for="item in list" :key="item.id" :title="item.title" />
  </van-list>
</template>
```

### 表单校验
```vue
<script setup lang="ts">
import { ref, reactive } from 'vue';
import type { FormInstance } from 'vant';

const formRef = ref<FormInstance>();
const formData = reactive({
  phone: '',
  code: '',
});

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    // 提交逻辑
  } catch (error) {
    console.error('表单校验失败');
  }
};

// 自定义校验器
const validatePhone = (value: string) => {
  if (!/^1[3-9]\d{9}$/.test(value)) {
    return '请输入正确的手机号';
  }
  return true;
};
</script>

<template>
  <van-form ref="formRef" @submit="handleSubmit">
    <van-field
      v-model="formData.phone"
      name="phone"
      label="手机号"
      type="tel"
      inputmode="numeric"
      placeholder="请输入手机号"
      :rules="[{ required: true, message: '请输入手机号' }, { validator: validatePhone }]"
    />
    <van-field
      v-model="formData.code"
      name="code"
      label="验证码"
      type="number"
      inputmode="numeric"
      placeholder="请输入验证码"
      :rules="[{ required: true, message: '请输入验证码' }]"
    />
    <div style="margin: 16px;">
      <van-button round block type="primary" native-type="submit">
        提交
      </van-button>
    </div>
  </van-form>
</template>
```

### 轻量级反馈
```typescript
import { showToast, showDialog, showNotify, showConfirmDialog } from 'vant';

// ✅ 操作反馈用 Toast
showToast('保存成功');
showToast({ message: '加载中...', type: 'loading', duration: 0 });

// ✅ 重要操作用 Dialog
showConfirmDialog({
  title: '确认删除?',
  message: '删除后数据无法恢复',
}).then(() => {
  // 确认删除
}).catch(() => {
  // 取消
});

// ✅ 通知提示用 Notify
showNotify({ type: 'warning', message: '网络连接不稳定' });
```

### ActionSheet 选择器
```vue
<script setup lang="ts">
import { ref } from 'vue';

const showSheet = ref(false);
const actions = [
  { name: '拍照', value: 'camera' },
  { name: '从相册选择', value: 'album' },
];

const onSelect = (action: { name: string; value: string }) => {
  showSheet.value = false;
  // 处理选择
};
</script>

<template>
  <van-action-sheet
    v-model:show="showSheet"
    :actions="actions"
    cancel-text="取消"
    close-on-click-action
    @select="onSelect"
  />
</template>
```

## 3. Anti-Patterns (禁止写法)

```typescript
// ❌ 全量引入 (打包体积过大)
import Vant from 'vant';
import 'vant/lib/index.css';
app.use(Vant);

// ❌ 硬编码像素值 (不适配不同屏幕)
.button {
  width: 375px; // 应使用 vw 或 rem
  font-size: 14px;
}

// ❌ 长列表不使用虚拟滚动
<div v-for="item in hugeList" :key="item.id">...</div>

// ❌ 移动端表单不设置 inputmode
<van-field type="text" /> // 应设置 type="tel" inputmode="numeric"
```

## 4. Mobile-Specific Tips

| 场景 | 推荐方案 |
|------|----------|
| 数字输入 | `type="tel"` + `inputmode="numeric"` |
| 下拉刷新 | `<van-pull-refresh>` 包裹列表 |
| 骨架屏 | `<van-skeleton>` 提升首屏体验 |
| 图片懒加载 | `<van-image lazy-load>` |
| 安全区域 | 使用 `safe-area-inset-bottom` CSS 变量 |

## 5. Metadata
*   **Version**: 1.0
*   **Compatible**: vant@4.x (Vue 3), vant@2.x (Vue 2)
*   **Related Rules**: `vue3-script-setup.md`, `strict-types.md`
