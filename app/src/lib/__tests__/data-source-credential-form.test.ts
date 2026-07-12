import { describe, expect, it } from "vitest";
import {
  acceptEncryptedInspection,
  hasRequiredCredentialInputs,
  parseServiceAccountCredential,
  resolveInspectionResponse,
} from "@/components/admin/data-source-credential-form";

describe("data source credential form helpers", () => {
  it("converte service account JSON válido em objeto", () => {
    const credential = {
      type: "service_account",
      project_id: "external-project",
      client_email: "source@example.test",
      private_key: "private-key-material",
    };

    expect(parseServiceAccountCredential(JSON.stringify(credential))).toEqual(credential);
  });

  it.each([
    ["JSON inválido", "{"],
    ["array", "[]"],
    ["null", "null"],
  ])("rejeita %s antes de enviar", (_label, value) => {
    expect(() => parseServiceAccountCredential(value)).toThrow(
      "Service account JSON must be a valid JSON object",
    );
  });

  it("remove plaintext e mantém apenas ciphertext após inspeção", () => {
    const form = {
      name: "Sales export",
      credentialJson: "{\"private_key\":\"secret\"}",
      credentialEnc: "",
    };

    const accepted = acceptEncryptedInspection(form, "encrypted-base64");

    expect(accepted).toEqual({
      name: "Sales export",
      credentialJson: "",
      credentialEnc: "encrypted-base64",
    });
    expect(form.credentialJson).toContain("secret");
    expect(form.credentialEnc).toBe("");
  });

  it("permite rotação em fonte existente reutilizando credentialRef armazenado", () => {
    expect(
      hasRequiredCredentialInputs({
        id: "source-1",
        credentialRef: { ref: "" },
        credentialEnc: "new-encrypted-base64",
      }),
    ).toBe(true);
  });

  it("exige credentialRef e ciphertext ao criar uma fonte", () => {
    expect(
      hasRequiredCredentialInputs({
        credentialRef: { ref: "" },
        credentialEnc: "new-encrypted-base64",
      }),
    ).toBe(false);
    expect(
      hasRequiredCredentialInputs({
        credentialRef: { ref: "credential-a" },
        credentialEnc: "",
      }),
    ).toBe(false);
    expect(
      hasRequiredCredentialInputs({
        credentialRef: { ref: "credential-a" },
        credentialEnc: "new-encrypted-base64",
      }),
    ).toBe(true);
  });

  const inspectedRequestForm = {
    id: "source-1",
    name: "Original name",
    bucket: "source-bucket",
    prefix: "exports/",
    credentialRef: { kind: "encryptedBlob", ref: "credential-a" },
    credentialJson: '{"private_key":"secret"}',
    credentialEnc: "",
    ownerColumn: "email",
    assignedUsers: "user-a",
    assignedDepartments: "department-a",
  };

  it("preserva edições não relacionadas ao aplicar a resposta atual", () => {
    const currentForm = {
      ...inspectedRequestForm,
      name: "Updated while inspecting",
      assignedUsers: "user-a, user-b",
    };

    expect(
      resolveInspectionResponse({
        requestId: 2,
        currentRequestId: 2,
        requestForm: inspectedRequestForm,
        currentForm,
        credentialEnc: "encrypted-base64",
        headers: ["email", "amount"],
      }),
    ).toEqual({
      ...currentForm,
      credentialJson: "",
      credentialEnc: "encrypted-base64",
    });
  });

  it("rejeita resposta quando a entrada de inspeção mudou", () => {
    expect(
      resolveInspectionResponse({
        requestId: 2,
        currentRequestId: 2,
        requestForm: inspectedRequestForm,
        currentForm: { ...inspectedRequestForm, bucket: "other-bucket" },
        credentialEnc: "encrypted-base64",
        headers: ["email"],
      }),
    ).toBeNull();
  });

  it("rejeita resposta após reset ou reseleção da fonte", () => {
    expect(
      resolveInspectionResponse({
        requestId: 2,
        currentRequestId: 2,
        requestForm: inspectedRequestForm,
        currentForm: { ...inspectedRequestForm, id: "source-2" },
        credentialEnc: "encrypted-base64",
        headers: ["email"],
      }),
    ).toBeNull();
  });

  it("rejeita resposta de inspeção substituída por outra requisição", () => {
    expect(
      resolveInspectionResponse({
        requestId: 1,
        currentRequestId: 2,
        requestForm: inspectedRequestForm,
        currentForm: inspectedRequestForm,
        credentialEnc: "encrypted-base64",
        headers: ["email"],
      }),
    ).toBeNull();
  });
});
