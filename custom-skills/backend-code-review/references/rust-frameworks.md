# Rust Framework Review

Load this after `rust-service.md` when the project uses a Rust server framework.

## Axum

- Keep extractors thin and deterministic; convert to domain input types early.
- Prefer typed application state and layered middleware over ad-hoc globals.
- Error types should implement `IntoResponse` in a stable, explicit way.
- Review tower layers for ordering, timeout, and auth behavior.

## Actix Web / Rocket / Tonic

- Keep macro-heavy handlers readable by moving business logic out of attribute-decorated functions.
- Review request context and state-sharing patterns carefully; framework magic should not hide ownership.
- For gRPC or message-oriented services, keep transport schema changes versionable and explicit.
- Avoid spawning background work from handlers without lifecycle ownership.

## Framework-Specific Smells

- Extractor or responder types leaking deep into service logic.
- Blocking work on async executors.
- Hidden panics or implicit conversions in transport glue.
