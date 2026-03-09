# Node Service Review

Use this as the baseline for backend services in Node / TypeScript.

Pair it with [node-frameworks.md](node-frameworks.md) when the project uses NestJS, Express, Fastify, Koa, or Hono.

## Focus Areas

- Keep handlers thin; move orchestration and policy decisions into service or use-case layers.
- Validate payloads once at the transport boundary and convert them into stable domain input types.
- Await async calls deliberately; do not leave floating promises or implicit background work in request paths.
- Map infra failures into stable HTTP or RPC errors; do not leak raw client or driver errors.
- Keep framework request/response objects out of domain services.

## Common Smells

- Controller or route handler performs validation, query building, persistence, and side effects together.
- Mixed transport types and domain types in one function or DTO.
- Missing timeout, abort, or retry ownership around upstream calls.
- Catch-all `try/catch` that erases status semantics and observability.
- Hidden mutable request state shared across middleware or decorators.
