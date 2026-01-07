# Ant Design Vue Usage Guidelines

> Layer: Business
> Context: UI Component Library Usage (Vue 3 + Ant Design Vue 4.x / Vue 2 + Ant Design Vue 1.x)

<!-- @level:summary -->
## Summary (摘要)

Ant Design Vue 组件库使用规范。核心要点：按需引入组件、使用 a-form 进行表单校验、表格指定唯一 rowKey、Modal 设置 destroyOnClose。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| 组件引入 | 按需引入，使用 `unplugin-vue-components` |
| 样式定制 | 使用 CSS Variables 或 ConfigProvider，禁止 `!important` |
| 表单校验 | 使用 `<a-form>` + `rules`，禁止手写校验逻辑 |
| 表格 | 指定唯一 `rowKey`，大数据量使用 `virtual` |
| 弹窗 | 设置 `destroyOnClose`，避免状态残留 |

### 常用消息提示

```typescript
import { message, notification, Modal } from 'ant-design-vue';

message.success('保存成功');           // 操作反馈
notification.info({ message, description }); // 重要通知
Modal.confirm({ title, onOk });        // 确认操作
```

### 禁止写法

- 全量引入 Ant Design Vue
- 使用数组索引作为 rowKey
- 手动校验表单字段（应使用 rules）
- 在循环中创建大量 Modal 实例

<!-- @level:full -->
## 1. The Rule

### 组件使用原则
*   **必须** 使用 `a-` 前缀的组件，而非原生 HTML 元素实现相同功能。
*   **禁止** 使用 `!important` 覆盖 Ant Design 样式。优先使用 CSS Variables 或 ConfigProvider 进行主题定制。
*   **必须** 按需引入组件，避免全量导入导致打包体积过大。

### 表单处理
*   **必须** 使用 `<a-form>` 配合 `rules` 属性进行表单校验，禁止手写校验逻辑。
*   **推荐** 使用 `useForm` (Composition API) 或 `this.$refs.formRef.validate()` 进行表单提交前校验。

### 表格 (Table)
*   **必须** 为表格数据指定唯一的 `rowKey`，避免使用数组索引。
*   **推荐** 大数据量时使用 `virtual` 虚拟滚动属性。
*   **推荐** 使用 `#bodyCell` 或 `#customRender` 插槽自定义列渲染。

### 弹窗 (Modal)
*   **禁止** 在循环中创建大量 Modal 实例。使用 `Modal.confirm()` 或单一 Modal + 动态内容。
*   **必须** 为 Modal 设置 `destroyOnClose` 以避免状态残留。

## 2. Common Patterns

### 按需引入 (推荐配置)
```typescript
// vite.config.ts
import Components from 'unplugin-vue-components/vite';
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers';

export default {
  plugins: [
    Components({
      resolvers: [AntDesignVueResolver({ importStyle: 'less' })],
    }),
  ],
};
```

### 表单校验
```vue
<script setup lang="ts">
import { reactive } from 'vue';
import type { FormInstance, Rule } from 'ant-design-vue';

interface FormState {
  username: string;
  password: string;
}

const formRef = ref<FormInstance>();
const formState = reactive<FormState>({
  username: '',
  password: '',
});

const rules: Record<string, Rule[]> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, min: 6, message: '密码至少6位', trigger: 'blur' }],
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    // 提交逻辑
  } catch (error) {
    console.error('表单校验失败', error);
  }
};
</script>

<template>
  <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical">
    <a-form-item label="用户名" name="username">
      <a-input v-model:value="formState.username" />
    </a-form-item>
    <a-form-item label="密码" name="password">
      <a-input-password v-model:value="formState.password" />
    </a-form-item>
    <a-button type="primary" @click="handleSubmit">提交</a-button>
  </a-form>
</template>
```

### 表格自定义渲染
```vue
<template>
  <a-table :columns="columns" :data-source="dataSource" row-key="id">
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'action'">
        <a-button type="link" @click="handleEdit(record)">编辑</a-button>
        <a-popconfirm title="确定删除?" @confirm="handleDelete(record.id)">
          <a-button type="link" danger>删除</a-button>
        </a-popconfirm>
      </template>
      <template v-else-if="column.key === 'status'">
        <a-tag :color="record.status === 'active' ? 'green' : 'red'">
          {{ record.status === 'active' ? '启用' : '禁用' }}
        </a-tag>
      </template>
    </template>
  </a-table>
</template>
```

### 消息提示
```typescript
import { message, notification, Modal } from 'ant-design-vue';

// ✅ 操作反馈用 message
message.success('保存成功');
message.error('操作失败，请重试');

// ✅ 重要通知用 notification
notification.info({
  message: '系统通知',
  description: '您有一条新消息，请查收。',
});

// ✅ 确认操作用 Modal.confirm
Modal.confirm({
  title: '确认删除?',
  content: '此操作不可恢复',
  onOk: () => handleDelete(),
});
```

## 3. Anti-Patterns (禁止写法)

```typescript
// ❌ 全量引入 (打包体积过大)
import Antd from 'ant-design-vue';
app.use(Antd);

// ❌ 使用数组索引作为 rowKey
<a-table :data-source="list" :row-key="(_, index) => index" />

// ❌ 手动校验表单字段
if (!formState.username) {
  alert('请输入用户名'); // 应使用 a-form 的 rules
}
```

## 4. Metadata
*   **Version**: 1.0
*   **Compatible**: ant-design-vue@4.x (Vue 3), ant-design-vue@1.x (Vue 2)
*   **Related Rules**: `vue3-script-setup.md`, `strict-types.md`
