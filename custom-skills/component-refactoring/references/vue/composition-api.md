# Vue 3 Composition API Refactoring Patterns

This document provides patterns for refactoring Vue components using the Composition API (Vue 3 / Vue 2.7+).

## When to Refactor to Composition API

Use Composition API when:
1. **Component is too large**: Options API organizes code by type (data, methods, computed), forcing you to jump around for a single feature.
2. **Logic Reuse**: Mixins are considered harmful; Composables are the standard for logic reuse.
3. **TypeScript Support**: Better type inference than Options API.

## Core Refactoring Patterns

### Pattern 1: Extract Composables (Custom Hooks)

**When**: Component has complex state logic, multiple watchers, or business logic mixed with UI.

**Naming Convention**: `composables/use-<feature>.ts` or `src/composables/use<Feature>.ts`.

```typescript
// ❌ Before: Options API with mixed concerns
export default {
  data() {
    return {
      products: [],
      cart: [],
      loading: false
    }
  },
  methods: {
    async fetchProducts() { /* ... */ },
    addToCart(product) { /* ... */ }
  },
  mounted() {
    this.fetchProducts()
  }
}

// ✅ After: Extract to Composable
// composables/useCart.ts
import { ref, computed } from 'vue'

export function useCart() {
  const cart = ref([])
  const addToCart = (product) => cart.value.push(product)
  const cartCount = computed(() => cart.value.length)
  
  return { cart, addToCart, cartCount }
}

// Component.vue
<script setup lang="ts">
import { useProducts } from './composables/useProducts'
import { useCart } from './composables/useCart'

const { products, loading } = useProducts()
const { cart, addToCart } = useCart()
</script>
```

### Pattern 2: Simplify `watch` and `computed`

**When**: Complex observers or computed properties dependent on multiple sources.

```typescript
// ✅ Use `watchEffect` for automatic dependency tracking if specific sources aren't strict
import { watchEffect } from 'vue'

watchEffect(() => {
  if (props.id) {
    fetchData(props.id)
  }
})
```

### Pattern 3: Provide/Inject for Deep State

**When**: Prop drilling through multiple layers.

```typescript
// Parent
import { provide, readonly } from 'vue'
const theme = ref('dark')
provide('theme', readonly(theme))

// Deep Child
import { inject } from 'vue'
const theme = inject('theme', 'light') // 'light' is default
```

## Common Pitfalls

1. **Destructuring Reactivity**: 
   ```typescript
   const { data } = useFetch() // ❌ data loses reactivity if it's a reactive object spread returned
   // Ensure composables return refs individually or use toRefs
   const { data } = toRefs(reactiveState)
   ```
2. **Lifecycle Hooks**: `setup()` runs before `created`. `mounted` becomes `onMounted`.
