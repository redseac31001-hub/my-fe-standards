# Common Vue Testing Patterns

## Finding Elements

Prefer `findComponent` for Vue components and `find` (with role/class selectors) for DOM elements.

```typescript
// Find by Component
const child = wrapper.findComponent(ChildComponent)
expect(child.exists()).toBe(true)

// Find by class (discouraged if role available)
const btn = wrapper.find('.submit-btn')

// Find by role (Testing Library style)
// Requires @testing-library/vue if you prefer that style, 
// but VTU `find` is dominant in Vue ecosystem.
```

## Testing Events (Emits)

Events are the primary contract of a Vue component.

```typescript
// Triggering
await wrapper.find('input').setValue('new text')
await wrapper.find('form').trigger('submit.prevent')

// Asserting
expect(wrapper.emitted('update:modelValue')).toBeTruthy()
expect(wrapper.emitted('update:modelValue')![0]).toEqual(['new text'])
```

## Testing Slots

```typescript
const wrapper = mount(Component, {
  slots: {
    default: 'Default Content',
    header: '<div class="header">Header Content</div>'
  }
})

expect(wrapper.html()).toContain('Header Content')
```

## Snapshot Testing

Use sparingly for regression testing of complex static UI.

```typescript
it('matches snapshot', () => {
  const wrapper = mount(Component)
  expect(wrapper.html()).toMatchSnapshot()
})
```
