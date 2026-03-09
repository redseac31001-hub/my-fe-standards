# Backend Testing Workflow

## Recommended Order

1. Pure functions
2. Service layer
3. Repository or persistence layer
4. HTTP handlers or controllers
5. Integration or end-to-end flow

## High-Risk Paths

- Validation failure
- Upstream timeout or retry exhaustion
- Duplicate submission or idempotency path
- Transaction rollback or partial failure
- Permission or authentication denial
