# Rust Service Review

Use this as the baseline for backend services in Rust.

Pair it with [rust-frameworks.md](rust-frameworks.md) when the project uses Axum, Actix Web, Rocket, or Tonic.

## Focus Areas

- Separate extractor or transport glue from domain logic.
- Prefer explicit error enums and stable response mapping over ad-hoc string errors.
- Watch shared state access, lock scope, and `Arc` ownership around async paths.
- Bound async task lifetime, cancellation behavior, and background work ownership.
- Keep serialization contracts explicit and versionable.

## Common Smells

- Handler owns business logic and storage orchestration.
- Long-lived lock or borrow across `await`.
- Hidden panics or `unwrap`/`expect` in request paths.
- Spawned tasks without ownership, cancellation, or error reporting.
- Serialization shape inferred indirectly from internal structs.
