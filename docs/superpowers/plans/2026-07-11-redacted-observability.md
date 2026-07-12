# Redacted Operational Observability Implementation Plan

**Goal:** Close issue #56 with vendor-neutral structured logging that remains useful after aggressive redaction.

## Task 1: Lock the contract

- [x] Define stable event names and levels.
- [x] Define recursive key removal and safe error serialization.
- [x] Define correlation ID acceptance and generation.
- [x] Define packaging boundaries for app, function, and shell.

## Task 2: Build the app logger with TDD

- [x] Add failing tests for sensitive fields, nested values, errors, cycles, bounds, log levels, and request IDs.
- [x] Implement the serializer, event writer, and request correlation helper.
- [x] Confirm focused RED then GREEN.

## Task 3: Instrument requests and storage

- [x] Emit sanitized upload rejection and failure events with response correlation IDs.
- [x] Emit storage lifecycle events without bucket names, paths, buffers, or credentials.
- [x] Add focused route and provider tests.

## Task 4: Instrument migrations and thumbnails

- [ ] Emit JSON migration lifecycle events without `DATABASE_URL`.
- [ ] Emit thumbnail lifecycle events without internal keys, paths, HTML, or dashboard capabilities.
- [ ] Add thumbnail logger tests and execute them in CI.

## Task 5: Document operations

- [ ] Document log levels, production defaults, event vocabulary, and sanitized troubleshooting.
- [ ] Document examples using only safe fields.

## Task 6: Validate and review

- [ ] Run app lint, typecheck, tests, coverage, migrations, and build.
- [ ] Run function tests and build.
- [ ] Prove a representative secret/key never appears in captured output.
- [ ] Open a ready PR closing issue #56.
- [ ] Run fresh GPT-5.6 Sol max, Claude Opus 4.8 max, and Kimi k2.7-code reviews on one pinned SHA.
- [ ] Resolve or technically adjudicate every P0/P1/P2 before merge.
