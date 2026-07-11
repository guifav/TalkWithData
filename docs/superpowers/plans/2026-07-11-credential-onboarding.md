# Credential Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a superadmin onboard and rotate GCS service-account credentials from the admin UI without pre-encrypting them or persisting plaintext.

**Architecture:** The existing privileged header-inspection endpoint accepts a validated raw service-account object, encrypts it once with `SecretService`, and returns only the opaque ciphertext alongside the existing inspection token. The browser clears plaintext after inspection and submits the returned ciphertext through the unchanged create or update contract, preserving token binding and backward compatibility.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Node crypto AES-256-GCM, Vitest.

## Global Constraints

- Never persist, log, or return a plaintext service-account credential.
- Raw credentials are plain objects no larger than 64 KiB and require `type=service_account`, `project_id`, `client_email`, and `private_key`.
- Preserve existing `credentialEnc` callers and stored-credential edit behavior.
- Keep the existing `[12-byte IV][16-byte authentication tag][ciphertext]` format.
- Use no new runtime dependency.
- Use English for open-source documentation and UI copy, PT-BR for test descriptions and code comments.
- Do not use emojis, em dashes, or en dashes.

---

### Task 1: Add credential encryption to SecretService

**Files:**
- Modify: `app/src/lib/data-sources/credentials.ts`
- Test: `app/src/lib/__tests__/credentials.test.ts`

**Interfaces:**
- Produces: `SecretService.encrypt(value: object): Buffer`
- Preserves: `SecretService.resolve(ref: CredentialRef): Promise<object>`

- [ ] **Step 1: Write failing encryption tests**

Add tests that call `service.encrypt(fakeServiceAccount)`, resolve the result through a second service, assert round-trip equality, assert two encryptions differ, and assert production encryption fails without a configured key.

- [ ] **Step 2: Verify RED**

Run: `cd app && npm test -- src/lib/__tests__/credentials.test.ts`

Expected: FAIL because `SecretService.encrypt` does not exist.

- [ ] **Step 3: Implement minimal encryption**

Import `createCipheriv` and `randomBytes`, then add:

```ts
encrypt(value: object): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(this.encryptionKeyBase64),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}
```

- [ ] **Step 4: Verify GREEN**

Run: `cd app && npm test -- src/lib/__tests__/credentials.test.ts`

Expected: all credential tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/data-sources/credentials.ts app/src/lib/__tests__/credentials.test.ts
git commit -m "feat: encrypt data source credentials"
```

### Task 2: Accept raw credentials in header inspection

**Files:**
- Modify: `app/src/app/api/admin/data-sources/inspect-headers/route.ts`
- Test: `app/src/lib/__tests__/data-sources-inspect-headers.test.ts`

**Interfaces:**
- Consumes: `SecretService.encrypt(value: object): Buffer`
- Request addition: `credential?: unknown`
- Conditional response addition: `credentialEnc: string` only when raw input was supplied

- [ ] **Step 1: Write failing route tests**

Cover a valid raw service account, missing required fields, non-object input, serialized input over 64 KiB, both `credential` and `credentialEnc`, and the existing ciphertext path. For success, capture the encryption result in the credential mock and assert the response contains only that ciphertext, while the raw `private_key` and `client_email` are absent from response and logged errors.

- [ ] **Step 2: Verify RED**

Run: `cd app && npm test -- src/lib/__tests__/data-sources-inspect-headers.test.ts`

Expected: FAIL because raw `credential` is unsupported and no ciphertext is returned.

- [ ] **Step 3: Implement request validation and one-time encryption**

Add `credential?: unknown` to the body type. Validate exclusivity and the service-account shape before encryption. Extend resolved input with `generatedCredentialEnc?: string`; for raw input call `new SecretService().encrypt(credential).toString("base64")`, then use that exact string for resolution and `credentialEncProof`. Include `credentialEnc` in the successful JSON response only when `generatedCredentialEnc` exists.

- [ ] **Step 4: Verify GREEN and compatibility**

Run: `cd app && npm test -- src/lib/__tests__/data-sources-inspect-headers.test.ts src/lib/__tests__/data-sources-admin.test.ts`

Expected: all selected tests pass, including existing ciphertext and stored-credential cases.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/api/admin/data-sources/inspect-headers/route.ts app/src/lib/__tests__/data-sources-inspect-headers.test.ts
git commit -m "feat: encrypt credentials during inspection"
```

### Task 3: Wire plaintext-safe admin form state

**Files:**
- Create: `app/src/components/admin/data-source-credential-form.ts`
- Modify: `app/src/components/admin/data-sources-tab.tsx`
- Test: `app/src/lib/__tests__/data-source-credential-form.test.ts`

**Interfaces:**
- Produces: `parseServiceAccountCredential(value: string): object`
- Produces: `acceptEncryptedInspection<T extends { credentialJson: string; credentialEnc: string }>(form: T, credentialEnc: string): T`
- Consumes: inspect response `credentialEnc?: string`

- [ ] **Step 1: Write failing form-helper tests**

Test that valid JSON parses to an object, invalid JSON and arrays throw `Service account JSON must be a valid JSON object`, and accepting inspected ciphertext returns state with `credentialJson` cleared and `credentialEnc` set.

- [ ] **Step 2: Verify RED**

Run: `cd app && npm test -- src/lib/__tests__/data-source-credential-form.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement helpers and UI flow**

Add `credentialJson` to the form state and keep `credentialEnc` internal. Render `Textarea` labeled `Service account JSON`, parse raw JSON before inspection, send it as `credential`, require a returned ciphertext when raw input was sent, apply `acceptEncryptedInspection`, and never render ciphertext. Leave both fields blank on an existing source to use its stored credential.

- [ ] **Step 4: Invalidate stale inspection state**

When credential JSON changes, clear internal ciphertext, headers, and inspected signature. Build the post-inspection signature from the updated ciphertext state so create and update remain enabled only for the exact inspected configuration.

- [ ] **Step 5: Verify GREEN**

Run: `cd app && npm test -- src/lib/__tests__/data-source-credential-form.test.ts src/lib/__tests__/data-sources-inspect-headers.test.ts && npm run typecheck && npm run lint`

Expected: all tests pass with no type or lint errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/admin/data-source-credential-form.ts app/src/components/admin/data-sources-tab.tsx app/src/lib/__tests__/data-source-credential-form.test.ts
git commit -m "feat: onboard data source credentials in admin"
```

### Task 4: Document and validate onboarding

**Files:**
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/superpowers/plans/2026-07-11-credential-onboarding.md`

**Interfaces:**
- Documents: key generation, stable key lifecycle, create and rotation flows, TLS requirement, and recovery consequence.

- [ ] **Step 1: Update deployment documentation**

Add `openssl rand -base64 32`, explain that the value belongs in the deployment secret named `TWD_CREDENTIAL_ENC_KEY`, state that changing or losing it makes stored credentials unreadable, and document the authenticated admin inspect-and-save flow for create and rotation.

- [ ] **Step 2: Run focused and full validation**

Run:

```bash
cd app
npm test -- src/lib/__tests__/credentials.test.ts src/lib/__tests__/data-sources-inspect-headers.test.ts src/lib/__tests__/data-source-credential-form.test.ts src/lib/__tests__/data-sources-admin.test.ts
npm run lint
npm run typecheck
npm test
npm run build
npm run test:coverage
```

Expected: all commands pass. Confirm no secret-like fixture appears in runtime logs.

- [ ] **Step 3: Self-review the diff**

Run:

```bash
git diff --check
rg -n "Credential blob \(encrypted|credentialEnc" app/src/components/admin/data-sources-tab.tsx docs/DEPLOYMENT.md
rg -n "\\x{2014}|\\x{2013}|T[O]DO|T[B]D" docs/DEPLOYMENT.md docs/superpowers/specs/2026-07-11-credential-onboarding-design.md docs/superpowers/plans/2026-07-11-credential-onboarding.md
```

Expected: no encrypted-blob UI prompt, no prohibited punctuation or placeholders, and only internal/API uses of `credentialEnc`.

- [ ] **Step 4: Commit documentation and final adjustments**

```bash
git add docs/DEPLOYMENT.md docs/superpowers/plans/2026-07-11-credential-onboarding.md
git commit -m "docs: explain credential onboarding"
```

### Task 5: Publish and validate PR through E4

**Files:**
- No new code files unless E4 identifies a reproducible defect.

**Interfaces:**
- Produces: one GitHub PR closing issue #42 with validation evidence and E4 adjudication.

- [ ] **Step 1: Push and open PR**

Push `feat/42-credential-onboarding`, open a ready PR against `main`, link `Closes #42`, and include exact validation commands and outcomes.

- [ ] **Step 2: Attempt all three fresh reviewers**

Run fresh maximum-reasoning reviews with Codex 5.6 Sol max, Claude Opus 4.8 max, and Kimi k2.7-code against the pinned PR head. Require findings with P0 to P4 severity, exact file and line evidence, and a final approve or request-changes verdict.

- [ ] **Step 3: Iterate on findings**

For every P0, P1, or P2, reproduce locally, add a failing regression test, fix through RED-GREEN, rerun the full validation set, push a new head, and repeat fresh reviews. Correct or justify P3 and P4 findings in the E4 record.

- [ ] **Step 4: Merge when authorized gate is satisfied**

When at least two usable reviewers approve with no unresolved P0, P1, or P2, document any unavailable third attempt, post the consolidated adjudication, confirm CI is green on the pinned head, merge, and verify issue #42 closes.
