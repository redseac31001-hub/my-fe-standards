# Common Backend Review Checklist

Use this checklist across Node, Java, and Rust services.

## Contract

- Validate request shape at the boundary.
- Reject invalid or incomplete input early.
- Keep response schema stable and explicit.
- Avoid leaking internal error details to clients.

## Reliability

- Set timeout and retry policy consciously.
- Make side-effect operations idempotent where possible.
- Keep transaction boundaries short and explicit.
- Handle partial failure paths, not only happy paths.

## Data Access

- Keep query scope narrow and indexed.
- Avoid N+1 access patterns.
- Do not mix transport DTOs with persistence entities carelessly.

## Observability

- Log with request or trace context when available.
- Emit structured errors, not only free-form strings.
- Avoid logging secrets, tokens, or PII.

## Maintainability

- Keep controller/handler thin.
- Isolate business logic in services or domain modules.
- Use typed contracts and explicit dependency boundaries.
