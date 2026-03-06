# Store Design

Use this reference when the task is about store boundaries, state normalization, or Pinia design patterns.

## Single Responsibility

```typescript
const useUserStore = defineStore('user', { /* user domain */ });
const useUIStore = defineStore('ui', { /* ui state */ });
const useCartStore = defineStore('cart', { /* cart state */ });
```

Avoid one giant store that mixes user data, UI state, notifications, products, and workflow logic.

## Normalized State

```typescript
interface NormalizedState {
  posts: Record<number, Post>;
  users: Record<number, User>;
  comments: Record<number, Comment>;
  postIds: number[];
}
```

Normalize when collections are large, nested, or updated independently.

## Pinia Setup Store

```typescript
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0);
  const doubleCount = computed(() => count.value * 2);

  function increment() {
    count.value++;
  }

  return { count, doubleCount, increment };
});
```

## Cross-Store Coordination

```typescript
export const useCheckoutStore = defineStore('checkout', () => {
  const userStore = useUserStore();
  const cartStore = useCartStore();
  const canCheckout = computed(() => userStore.isLoggedIn && cartStore.itemCount > 0);
  return { canCheckout };
});
```

## Common Pitfalls

- Resolve cyclic dependencies by acquiring other stores inside actions.
- Use `storeToRefs()` when destructuring reactive values from a store.
- Keep API orchestration close to the domain store, not spread across components.
