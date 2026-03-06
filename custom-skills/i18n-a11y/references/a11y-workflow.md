# Accessibility Workflow

Use this reference when the task is about WCAG compliance, ARIA usage, keyboard navigation, or focus management.

## WCAG 2.1 AA Checklist

### Perceivable

- [ ] Images have meaningful `alt` text
- [ ] Video content has captions where needed
- [ ] Text contrast meets 4.5:1, large text meets 3:1
- [ ] Color is not the only signal

### Operable

- [ ] Every interaction works by keyboard
- [ ] Focus styles are visible
- [ ] No keyboard trap exists
- [ ] Skip links exist for repeated navigation

### Understandable

- [ ] `lang` is declared
- [ ] Forms have explicit labels and clear errors
- [ ] Naming and navigation are consistent

### Robust

- [ ] Semantic HTML is preferred over ARIA recreation
- [ ] ARIA attributes match actual behavior
- [ ] Screen-reader announcements are intentional

## ARIA Patterns

```vue
<button
  :aria-pressed="isActive"
  :aria-label="t('toggleMenu')"
>
  <Icon name="menu" aria-hidden="true" />
</button>

<div
  role="dialog"
  aria-modal="true"
  :aria-labelledby="titleId"
  :aria-describedby="descId"
>
  <h2 :id="titleId">{{ title }}</h2>
  <p :id="descId">{{ description }}</p>
</div>
```

## Keyboard And Focus

```typescript
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
```

```typescript
async function openDialog() {
  isOpen.value = true;
  await nextTick();
  dialogRef.value?.focus();
}

function closeDialog() {
  isOpen.value = false;
  triggerButtonRef.value?.focus();
}
```

## Tooling

```bash
npm install -D @axe-core/cli
npx axe http://localhost:3000

npm install -D eslint-plugin-vuejs-accessibility
```

Always pair automated checks with at least one keyboard-only walkthrough.
