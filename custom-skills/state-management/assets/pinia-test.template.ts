import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
// import { useExampleStore } from '@/stores/example'

describe('ExampleStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes default state', () => {
    // const store = useExampleStore()
    // expect(store.someState).toEqual(...)
  })

  it('updates derived state through actions', async () => {
    // const store = useExampleStore()
    // await store.loadSomething()
    // expect(store.someGetter).toBe(...)
  })
})
