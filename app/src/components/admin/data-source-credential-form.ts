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

type InspectionTrackedForm = {
  id?: string;
  bucket: string;
  prefix: string;
  credentialRef: { kind: string; ref: string };
  credentialJson: string;
  credentialEnc: string;
  ownerColumn: string;
};

export function isInspectionRequestCurrent<T extends InspectionTrackedForm>({
  requestId,
  currentRequestId,
  requestForm,
  currentForm,
}: {
  requestId: number;
  currentRequestId: number;
  requestForm: T;
  currentForm: T;
}): boolean {
  return requestId === currentRequestId && sameInspectionInput(requestForm, currentForm);
}

export function resolveInspectionResponse<T extends InspectionTrackedForm>({
  requestId,
  currentRequestId,
  requestForm,
  currentForm,
  credentialEnc,
  headers,
}: {
  requestId: number;
  currentRequestId: number;
  requestForm: T;
  currentForm: T;
  credentialEnc?: string;
  headers: string[];
}): T | null {
  if (
    !isInspectionRequestCurrent({
      requestId,
      currentRequestId,
      requestForm,
      currentForm,
    })
  ) {
    return null;
  }

  let inspectedForm = credentialEnc
    ? acceptEncryptedInspection(currentForm, credentialEnc)
    : currentForm;
  if (!headers.includes(inspectedForm.ownerColumn)) {
    inspectedForm = { ...inspectedForm, ownerColumn: headers[0] || "" };
  }
  return inspectedForm;
}

function sameInspectionInput(
  requestForm: InspectionTrackedForm,
  currentForm: InspectionTrackedForm,
): boolean {
  return (
    requestForm.id === currentForm.id &&
    requestForm.bucket === currentForm.bucket &&
    requestForm.prefix === currentForm.prefix &&
    requestForm.credentialRef.kind === currentForm.credentialRef.kind &&
    requestForm.credentialRef.ref === currentForm.credentialRef.ref &&
    requestForm.credentialJson === currentForm.credentialJson &&
    requestForm.credentialEnc === currentForm.credentialEnc
  );
}

function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
