# Node Framework Testing

Load this after `node-testing.md` when framework harnesses matter.

## NestJS

- Use `TestingModule` to isolate controller and provider wiring.
- Override external providers explicitly; do not let real infra leak into unit tests.
- Use controller tests for validation and exception mapping, then a small number of e2e tests for module wiring.
- Keep global pipes, guards, and interceptors visible in tests when they affect contracts.

## Express / Fastify / Koa / Hono

- Prefer route-level tests through a lightweight app instance or framework inject helper.
- Assert middleware order effects only where order is contractually important.
- Keep handler unit tests separate from transport tests.
- Verify timeout, auth, and error middleware behavior at the adapter boundary.

## Framework-Specific Smells

- Full app boot for simple service tests.
- Brittle tests that assert framework internals instead of contract behavior.
- Hidden global middleware changing tests without explicit setup.
