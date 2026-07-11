# Credential Onboarding Design

## Context

Talk With Data stores GCS service-account credentials as AES-256-GCM ciphertext under `TWD_CREDENTIAL_ENC_KEY`. The current admin API and UI require an operator to supply that ciphertext, but the repository provides no supported way to create it. This prevents a self-hoster from onboarding a credentialed CSV data source without reimplementing the encryption format.

## Goals

- Let a superadmin paste a raw Google service-account JSON credential in the data-source form.
- Encrypt the credential on the server with the same `SecretService` key and wire format used for decryption.
- Never persist, log, or return the plaintext credential.
- Preserve the existing inspection-token binding so the credential that was inspected is the credential that is saved.
- Keep existing ciphertext-based API clients working.
- Document key generation and the complete onboarding flow.

## Non-goals

- Implement Google Secret Manager support.
- Store plaintext credentials in Firestore, browser storage, logs, or repository files.
- Replace or migrate ciphertext already stored in existing data sources.
- Add a separate credential-management subsystem.

## Considered Approaches

### 1. Encrypt during the existing header inspection request (selected)

The inspect-headers endpoint accepts either the existing `credentialEnc` field or a new raw `credential` object. For a raw credential, it validates and encrypts the object once, uses that ciphertext for GCS inspection and token proof, and returns the ciphertext with the inspection result. The UI immediately clears its plaintext state and retains only the returned ciphertext until save.

This preserves the mandatory inspect-before-save flow and ensures the token proof binds the exact randomized ciphertext submitted to create or update.

### 2. Add a dedicated encryption endpoint

This separates encryption from inspection, but it adds another privileged API surface and still requires the browser to coordinate encryption, inspection, and token freshness. It offers no security benefit for the current workflow.

### 3. Accept plaintext in the create and update endpoints

This shortens the browser flow, but encryption would happen after inspection. Because AES-GCM uses a random IV, the create route could not recreate the ciphertext bound into the inspection token. Expanding the token contract to bind plaintext-derived material would add unnecessary complexity and secret-handling risk.

## Architecture

### Credential service

`SecretService` gains an encryption operation that:

1. accepts a plain JSON object,
2. serializes it as UTF-8 JSON,
3. generates a fresh 12-byte IV,
4. encrypts with AES-256-GCM and the configured 32-byte key,
5. returns `[IV][authentication tag][ciphertext]` as a `Buffer`.

Encryption and decryption use the same key resolution and validation. Each encryption produces different ciphertext for the same input because the IV is random. Configuration errors remain explicit, while cryptographic failures use generic messages that contain no credential material.

### Inspection endpoint

`POST /api/admin/data-sources/inspect-headers` remains superadmin-only and backward-compatible.

The request may contain exactly one of:

- `credentialEnc`: an existing base64 ciphertext, or
- `credential`: a raw service-account JSON object.

For an existing data source, omitting both continues to use its stored credential. Supplying both is rejected with HTTP 400.

Raw credentials must be a plain object no larger than 64 KiB when serialized and must contain:

- `type` equal to `service_account`,
- a non-empty `project_id`,
- a non-empty `client_email`,
- a non-empty `private_key`.

After validation, the endpoint encrypts the object once. The resulting ciphertext is used to resolve the credential, inspect GCS, and create the existing inline credential proof. A successful response includes `credentialEnc` only when the request supplied `credential`. It never includes the raw object or any of its field values.

Failures return generic validation or inspection messages. Server logs may include the operation failure but must never include the request body, plaintext credential, or ciphertext.

### Admin UI

The form replaces the encrypted base64 input with a multiline service-account JSON input. The plaintext exists only in React state while the operator is editing it.

When the operator selects `Inspect headers`:

1. the browser parses the text as JSON and reports invalid syntax locally,
2. it sends the parsed object to the authenticated inspect endpoint,
3. it requires both a valid inspection token and returned ciphertext,
4. it stores the ciphertext in internal form state,
5. it clears the plaintext field immediately after success,
6. it saves using the existing create or update payload contract.

Changing the raw credential, credential reference, bucket, or prefix invalidates the prior inspection. Editing an existing source with the credential field blank continues to inspect and retain the stored credential. The UI never displays returned ciphertext.

## Security Boundaries

- Only an authenticated superadmin can submit a raw credential.
- TLS termination is a deployment prerequisite because the browser sends the credential to the server.
- Plaintext is transient in browser memory and request memory only.
- The endpoint does not persist credentials. Firestore receives only ciphertext through the existing create or update route.
- The inspection token binds the exact ciphertext and data-source configuration version, preserving stale-token protection.
- No secret values appear in success bodies beyond opaque ciphertext, error bodies, or logs.

## Compatibility

- Existing callers that send `credentialEnc` keep the current behavior and response shape.
- Existing source edits that omit credential fields keep using the stored ciphertext.
- Stored ciphertext format and decryption behavior do not change.
- `secretManager` remains explicitly unsupported.

## Testing

Unit and route tests must cover:

- encryption and decryption round trips,
- fresh IVs producing distinct ciphertext for the same credential,
- invalid encryption-key configuration,
- raw credential validation, including malformed shape, missing fields, oversize input, and conflicting credential inputs,
- inspection with a raw credential returning ciphertext but no plaintext,
- inspection-token proof binding the returned ciphertext,
- existing ciphertext and stored-credential inspection paths remaining compatible,
- no plaintext credential appearing in logged errors or API responses.

The implementation must pass the full repository lint, typecheck, unit-test, build, and relevant coverage gates before E4 review.

## Documentation

`docs/DEPLOYMENT.md` will document:

- generating a 32-byte base64 key with `openssl rand -base64 32`,
- storing `TWD_CREDENTIAL_ENC_KEY` as a deployment secret,
- keeping the key stable for the lifetime of stored credentials,
- pasting the raw service-account JSON only into the authenticated admin form,
- inspecting headers before saving,
- rotating a credential by repeating the inspect-and-save flow,
- the consequence of losing or changing the encryption key.
