# Rust Framework Testing

Load this after `rust-testing.md` when the framework or async runtime is part of the risk.

## Axum

- Test routers with `oneshot` or equivalent request execution helpers.
- Build state explicitly and inject only what the handler needs.
- Assert extractor failure, typed error mapping, and response serialization.

## Actix Web / Rocket / Tonic

- Use the framework test harness only for transport behavior, not for pure domain logic.
- Keep async runtime setup explicit with `tokio::test` or the framework's recommended test entry.
- Verify request metadata, auth, and serialization boundaries where the framework owns them.
- For gRPC, assert status code, message shape, and metadata mapping.

## Framework-Specific Smells

- Sleeping in tests to wait for spawned work instead of exposing completion.
- Tests coupled to internal framework state or macro expansion details.
- Transport tests that accidentally depend on global runtime state.
