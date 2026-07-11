export function parseServiceAccountCredential(value: string): object {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isPlainObject(parsed)) {
      throw new Error("invalid credential shape");
    }
    return parsed;
  } catch {
    throw new Error("Service account JSON must be a valid JSON object");
  }
}

export function acceptEncryptedInspection<
  T extends { credentialJson: string; credentialEnc: string },
>(form: T, credentialEnc: string): T {
  return {
    ...form,
    credentialJson: "",
    credentialEnc,
  };
}

export function hasRequiredCredentialInputs(form: {
  id?: string;
  credentialRef: { ref: string };
  credentialEnc: string;
}): boolean {
  if (form.id) return true;
  return Boolean(form.credentialRef.ref.trim() && form.credentialEnc.trim());
}

function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
