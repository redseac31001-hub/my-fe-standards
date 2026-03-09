# Rust Backend Testing

Use this as the baseline for backend tests in Rust.

Pair it with [rust-frameworks.md](rust-frameworks.md) when router, framework harness, or async runtime behavior matters.

## Focus Areas

- Prefer small deterministic unit tests for domain logic.
- For async handlers, test success and typed error mapping.
- Keep shared state fixtures minimal and explicit.
- Use integration tests for routing, serialization, and storage boundaries.
- Make spawned-task behavior observable when the code owns background execution.
