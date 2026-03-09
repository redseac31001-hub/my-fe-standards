---
name: backend-testing
description: Generate backend tests for Node/TypeScript, Java, or Rust services. Use when adding unit, integration, or API contract tests for handlers, controllers, services, repositories, and background jobs.
metadata:
  triggers:
    - "后端测试/backend testing/API 测试"
  languages:
    - typescript
    - javascript
    - java
    - rust
  frameworks:
    - nestjs
    - express
    - fastify
    - koa
    - hono
    - springboot
    - quarkus
    - micronaut
    - jakartarest
    - axum
    - actixweb
    - rocket
    - tonic
  roles:
    - backend
    - fullstack
    - qa
  scenarios:
    - testing
    - integration-testing
    - api-testing
---

# Backend Testing

Generate backend tests with the narrowest reliable scope first, then load the framework-specific testing guidance only when the stack needs it.

## Routing

- **Node / TypeScript service**: Start with [references/node-testing.md](references/node-testing.md). If the stack is NestJS / Express / Fastify / Koa / Hono, also read [references/node-frameworks.md](references/node-frameworks.md).
- **Java service**: Start with [references/java-testing.md](references/java-testing.md). If the stack is Spring Boot / Quarkus / Micronaut / Jakarta REST, also read [references/java-frameworks.md](references/java-frameworks.md).
- **Rust service**: Start with [references/rust-testing.md](references/rust-testing.md). If the stack is Axum / Actix Web / Rocket / Tonic, also read [references/rust-frameworks.md](references/rust-frameworks.md).
- **Cross-stack ordering**: Use [references/workflow.md](references/workflow.md) for the test layering sequence.

## Workflow

1. Identify the test target first: pure function, service, repository, HTTP handler, integration flow, background job.
2. Start with the language baseline reference; add the framework reference only when transport/runtime behavior matters.
3. Add the smallest unit or slice test that proves the behavior, then expand to routing, serialization, persistence, or contract coverage.
4. Keep external systems behind stable doubles unless the test is explicitly an integration boundary test.

## Output

- Recommended test layers
- High-risk cases to cover first
- Mock / fixture / harness strategy
- Remaining gaps and why they matter
