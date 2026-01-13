# Vue 2 Testing Patterns (Vue Test Utils v1)

## Setup

```javascript
import { shallowMount, mount, createLocalVue } from '@vue/test-utils'
import Vuex from 'vuex'
import Component from '@/components/Component.vue'

const localVue = createLocalVue()
localVue.use(Vuex)

describe('Component.vue', () => {
  let actions
  let store

  beforeEach(() => {
    actions = {
      actionClick: jest.fn()
    }
    store = new Vuex.Store({
      actions
    })
  })

  it('renders props.msg when passed', () => {
    const msg = 'new message'
    const wrapper = shallowMount(Component, {
      propsData: { msg }
    })
    expect(wrapper.text()).toMatch(msg)
  })

  it('dispatches action on click', async () => {
    const wrapper = shallowMount(Component, { store, localVue })
    const button = wrapper.find('button')
    await button.trigger('click')
    expect(actions.actionClick).toHaveBeenCalled()
  })
})
```

## Key API Differences (vs VTU v2)

- Use `createLocalVue()` to avoid polluting global Vue.
- `propsData` instead of `props`.
- `mocks` option to mock `$route`, `$router`.
- `stubs` to shallow render children.
