# Vue 3 Testing Patterns (Vue Test Utils v2)

## Setup

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import Component from '@/components/Component.vue'
import { createStore } from 'vuex' // or Pinia

describe('Component.vue', () => {
  it('renders props properly', () => {
    const wrapper = mount(Component, {
      props: {
        title: 'Hello'
      }
    })
    expect(wrapper.text()).toContain('Hello')
  })

  it('emits event on button click', async () => {
    const wrapper = mount(Component)
    await wrapper.find('button').trigger('click')
    
    expect(wrapper.emitted()).toHaveProperty('submit')
    expect(wrapper.emitted('submit')![0]).toEqual([123])
  })
})
```

## Testing Pinia

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { useCounterStore } from '@/stores/counter'

describe('Counter Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('increments', () => {
    const counter = useCounterStore()
    expect(counter.count).toBe(0)
    counter.increment()
    expect(counter.count).toBe(1)
  })
})
```

## Key API Differences (vs VTU v1)

- No `createLocalVue`. Plugins are installed via `global.plugins`.
- `props` instead of `propsData`.
- `wrapper.emitted()` returns array of arrays.
- `slots` configuration is slightly different.
