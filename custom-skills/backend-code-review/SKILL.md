---
name: backend-code-review
description: Review backend services and APIs in Node/TypeScript, Java, or Rust. Use when reviewing handlers, controllers, services, repositories, API contracts, validation, error handling, concurrency, or production-readiness.
metadata:
  triggers:
    - "后端代码审查/backend review/API review"
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
    - architect
  scenarios:
    - code-review
    - api-review
    - service-review
---

# Backend Code Review

Review backend code by loading the smallest useful language guide first, then the matching framework guide, and finally the shared checklist.

## Routing

- **Node / TypeScript service**: Start with [references/node-service.md](references/node-service.md). If the stack is NestJS / Express / Fastify / Koa / Hono, also read [references/node-frameworks.md](references/node-frameworks.md).
- **Java service**: Start with [references/java-service.md](references/java-service.md). If the stack is Spring Boot / Quarkus / Micronaut / Jakarta REST, also read [references/java-frameworks.md](references/java-frameworks.md).
- **Rust service**: Start with [references/rust-service.md](references/rust-service.md). If the stack is Axum / Actix Web / Rocket / Tonic, also read [references/rust-frameworks.md](references/rust-frameworks.md).
- **Cross-stack review dimensions**: Finish with [references/common-checklist.md](references/common-checklist.md).

## Workflow

1. Identify the language, framework, and layer first: transport, service, repository, job, middleware, worker.
2. Load the language baseline reference; load the framework reference only when the stack actually matches.
3. Review contract shape, validation, and error mapping before style or abstraction discussions.
4. Check timeout, retry, idempotency, transaction scope, concurrency safety, observability, and config leakage.
5. Report highest-risk issues first, then give the smallest safe remediation path.

## Output

- Contract and data-shape risks
- Reliability and observability risks
- Maintainability and coupling issues
- Minimal safe remediation plan
