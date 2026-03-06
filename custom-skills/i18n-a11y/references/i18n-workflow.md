# i18n Workflow

Use this reference when the task is about locale setup, translation extraction, pluralization, or date/number formatting.

## vue-i18n Baseline

```typescript
import { createI18n } from 'vue-i18n';
import zh from './locales/zh.json';
import en from './locales/en.json';

export const i18n = createI18n({
  legacy: false,
  locale: 'zh',
  fallbackLocale: 'en',
  messages: { zh, en },
});
```

## Component Usage

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

## Pluralization

```json
{
  "items": "没有项目 | {n} 个项目 | {n} 个项目"
}
```

Use plural rules early; do not hardcode singular/plural branches in components unless the i18n library cannot express the case.

## Date And Number Formatting

```typescript
const i18n = createI18n({
  datetimeFormats: {
    zh: {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
    },
  },
  numberFormats: {
    zh: {
      currency: { style: 'currency', currency: 'CNY' },
    },
  },
});
```

## Checklist

- Extract user-facing strings before translating.
- Keep message keys domain-based, not page-order-based.
- Verify fallback locale behavior.
- Check dynamic interpolation and plural rules with realistic data.
