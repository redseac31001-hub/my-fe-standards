---
name: i18n-a11y
description: 国际化与可访问性技能，涵盖 vue-i18n 配置、WCAG 合规性检测和无障碍最佳实践。触发条件：国际化、i18n、多语言、可访问性、a11y、WCAG、无障碍。
---

# i18n & Accessibility Skill

国际化与可访问性专项技能，提供 vue-i18n 最佳实践和 WCAG 合规性指南。

## 核心能力

1. **vue-i18n 配置** - 多语言方案设置
2. **文案管理** - 提取、组织、维护翻译文案
3. **WCAG 合规** - 2.1 AA 级别检查
4. **ARIA 模式** - 正确使用 ARIA 属性
5. **键盘导航** - 完整的键盘操作支持

---

## 国际化 (i18n)

### vue-i18n 基础配置

```typescript
// i18n/index.ts
import { createI18n } from 'vue-i18n';
import zh from './locales/zh.json';
import en from './locales/en.json';

export const i18n = createI18n({
  legacy: false, // 使用 Composition API
  locale: 'zh',
  fallbackLocale: 'en',
  messages: { zh, en }
});
```

### 组件中使用

```vue
<template>
  <h1>{{ t('welcome.title') }}</h1>
  <p>{{ t('welcome.message', { name: userName }) }}</p>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();
</script>
```

### 复数处理

```json
// locales/zh.json
{
  "items": "没有项目 | {n} 个项目 | {n} 个项目"
}
```

```vue
<template>
  <p>{{ t('items', itemCount) }}</p>
</template>
```

### 日期/数字格式化

```typescript
const i18n = createI18n({
  datetimeFormats: {
    zh: {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
    }
  },
  numberFormats: {
    zh: {
      currency: { style: 'currency', currency: 'CNY' }
    }
  }
});
```

---

## 可访问性 (a11y)

### WCAG 2.1 核心检查清单

#### 感知性 (Perceivable)

- [ ] 图片有描述性 alt 文本
- [ ] 视频有字幕和描述
- [ ] 颜色对比度 ≥ 4.5:1 (文本) / ≥ 3:1 (大文本)
- [ ] 不仅依赖颜色传达信息

#### 可操作性 (Operable)

- [ ] 所有功能可通过键盘访问
- [ ] 有可见的焦点指示器
- [ ] 没有键盘陷阱
- [ ] 提供跳过导航的链接

#### 可理解性 (Understandable)

- [ ] 页面语言已声明 (`lang` 属性)
- [ ] 表单有明确的标签和错误提示
- [ ] 一致的导航和命名

#### 健壮性 (Robust)

- [ ] HTML 语义正确
- [ ] ARIA 属性使用正确
- [ ] 兼容辅助技术

### ARIA 模式示例

```vue
<!-- 按钮 -->
<button
  :aria-pressed="isActive"
  :aria-label="t('toggleMenu')"
>
  <Icon name="menu" aria-hidden="true" />
</button>

<!-- 模态框 -->
<div
  role="dialog"
  aria-modal="true"
  :aria-labelledby="titleId"
  :aria-describedby="descId"
>
  <h2 :id="titleId">{{ title }}</h2>
  <p :id="descId">{{ description }}</p>
</div>

<!-- 加载状态 -->
<div :aria-busy="isLoading" aria-live="polite">
  <span v-if="isLoading">{{ t('loading') }}</span>
  <div v-else>{{ content }}</div>
</div>
```

### 键盘导航

```vue
<script setup>
function handleKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      focusNextItem();
      event.preventDefault();
      break;
    case 'ArrowUp':
      focusPrevItem();
      event.preventDefault();
      break;
    case 'Enter':
    case ' ':
      selectItem();
      event.preventDefault();
      break;
    case 'Escape':
      closeMenu();
      break;
  }
}
</script>
```

### 焦点管理

```vue
<script setup>
import { ref, nextTick } from 'vue';

const dialogRef = ref<HTMLElement>();

async function openDialog() {
  isOpen.value = true;
  await nextTick();
  dialogRef.value?.focus();
}

function closeDialog() {
  isOpen.value = false;
  triggerButtonRef.value?.focus(); // 返回触发元素
}
</script>
```

## 资源文件

根据具体需求，读取以下参考文档：

- **vue-i18n 配置**: `references/i18n/vue-i18n-setup.md`
- **文案提取**: `references/i18n/message-extraction.md`
- **复数处理**: `references/i18n/pluralization.md`
- **日期数字格式**: `references/i18n/datetime-number.md`
- **WCAG 检查清单**: `references/a11y/wcag-checklist.md`
- **ARIA 模式**: `references/a11y/aria-patterns.md`
- **键盘导航**: `references/a11y/keyboard-nav.md`
- **屏幕阅读器兼容**: `references/a11y/screen-reader.md`

## 检测工具

```bash
# axe-core 自动化测试
npm install -D @axe-core/cli
npx axe http://localhost:3000

# ESLint a11y 插件
npm install -D eslint-plugin-vuejs-accessibility
```
