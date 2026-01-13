# Rule Catalog — Code Quality

## Conditional class names use utility function

IsUrgent: True
Category: Code Quality

### Description

Ensure conditional CSS is handled via the shared `classNames` instead of custom ternaries, string concatenation, or template strings. Centralizing class logic keeps components consistent and easier to maintain.

### Suggested Fix

```ts
import { cn } from '@/utils/classnames'
const classNames = cn(isActive ? 'text-primary-600' : 'text-gray-500')
```

## Tailwind-first styling

IsUrgent: True
Category: Code Quality

### Description

Favor Tailwind CSS utility classes instead of adding new `.module.css` files unless a Tailwind combination cannot achieve the required styling. Keeping styles in Tailwind improves consistency and reduces maintenance overhead.

## Vue Specific: v-if used with v-for

IsUrgent: True
Category: Code Quality

### Description

Never use `v-if` on the same element as `v-for`. This hurts performance as the directive priority causes the list to be rendered before filtering.

### Suggested Fix

Use a computed property to filter the list before iterating.

```vue
<!-- ❌ Bad -->
<div v-for="item in items" v-if="item.isActive" :key="item.id"></div>

<!-- ✅ Good -->
<div v-for="item in activeItems" :key="item.id"></div>

<script>
computed: {
  activeItems() {
    return this.items.filter(i => i.isActive)
  }
}
</script>
```

## Vue Specific: Prop Mutation

IsUrgent: True
Category: Code Quality

### Description

Avoid mutating props directly. Props should be considered immutable. Mutating them can cause data flow issues and warnings.

### Suggested Fix

Emit an event to the parent to update the value, or use a local data/computed property if it's for internal display.

```vue
<!-- Child.vue -->
<script setup>
const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue'])

function update(value) {
  emit('update:modelValue', value)
}
</script>
```

## Classname ordering for easy overrides

### Description

When writing components, always place the incoming `className` prop after the component’s own class values so that downstream consumers can override or extend the styling. This keeps your component’s defaults but still lets external callers change or remove specific styles.

Example:

```tsx
import { cn } from '@/utils/classnames'

const Button = ({ className }) => {
  return <div className={cn('bg-primary-600', className)}></div>
}
```
