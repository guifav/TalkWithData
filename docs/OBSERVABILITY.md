# Operational Observability

Talk With Data emits vendor-neutral, one-line JSON events to standard output and standard error. The default is designed for self-hosted deployments and does not require a monitoring service.

## Production defaults

`TWD_LOG_LEVEL` controls the minimum emitted level:

| Value | Emits | Intended use |
| --- | --- | --- |
| `info` | `info`, `warn`, `error` | Default. Lifecycle and failure diagnosis. |
| `warn` | `warn`, `error` | Lower-volume production logging. |
| `error` | `error` | Failure-only logging. |

Missing or invalid values use `info`. Logs remain JSON at every level.

## Event vocabulary

| Event | Level | Meaning |
| --- | --- | --- |
| `request.upload.rejected` | `warn` | Upload authentication or input rejection. |
| `request.upload.failed` | `error` | Unexpected upload failure. |
| `storage.operation.started` | `info` | Storage adapter operation started. |
| `storage.operation.succeeded` | `info` | Storage adapter operation completed. |
| `storage.operation.failed` | `error` | Storage adapter operation failed. |
| `migration.verification.started` | `info` | Checked-in migration verification started. |
| `migration.verification.succeeded` | `info` | Migration deploy, schema probe, and idempotency checks passed. |
| `migration.verification.failed` | `error` | Migration verification stopped at the reported safe stage. |
| `thumbnail.generation.started` | `info` | Authenticated thumbnail generation started. |
| `thumbnail.generation.succeeded` | `info` | Thumbnail generation completed. |
| `thumbnail.generation.failed` | `error` | Thumbnail generation failed. |

Events use `correlationId` for grouping. Upload responses and thumbnail function responses return the selected identifier in `x-request-id`. Caller-provided identifiers are accepted only when they are valid UUIDs; all others are replaced with a generated UUID.

Example:

```json
{"timestamp":"2026-07-11T21:00:00.000Z","level":"error","event":"storage.operation.failed","correlationId":"a safe generated UUID","outcome":"failed","operation":"download","durationMs":17,"error":{"name":"Error","code":"ECONNRESET"}}
```

## Data that is not logged

The serializer recursively removes known sensitive field families, including:

- authorization headers and cookies,
- API keys, provider keys, internal keys, secrets, tokens, and capabilities,
- service-account credentials and private keys,
- user email addresses,
- database URLs, bucket names, object paths, and buffers,
- request and response bodies,
- row contents, prompts, HTML, and uploaded document content,
- error messages, stacks, causes, and arbitrary error properties.

Errors retain only a normalized name plus a bounded scalar code or numeric status when present. Metadata also has depth, collection, key-count, and string-length bounds.

## Sanitized troubleshooting

1. Ask the caller for the `x-request-id` response header. Do not ask for credentials or request bodies.
2. Search logs for the matching `correlationId`.
3. Inspect `event`, `outcome`, `operation`, `durationMs`, safe counts, and the error name/code.
4. For migration failures, inspect `stage`: `preflight`, `initial_deploy`, `schema_probe`, or `idempotency_deploy`.
5. Reproduce with the same operation type and a new correlation ID. Never add body, prompt, row, credential, bucket, or object-path logging to diagnose a failure.

If sanitized signals are insufficient, add a bounded non-sensitive field to the event contract with a regression test proving that known sensitive keys and representative values remain absent.
