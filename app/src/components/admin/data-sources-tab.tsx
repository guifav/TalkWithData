"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import { authFetch } from "@/lib/firebase/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptEncryptedInspection,
  hasRequiredCredentialInputs,
  isInspectionCurrent,
  parseServiceAccountCredential,
} from "@/components/admin/data-source-credential-form";
import type { Department } from "@/lib/types";
import type { UserRow } from "@/components/admin/admin-shared";

type CredentialRef = { kind: "encryptedBlob" | "secretManager"; ref: string };

type DataSourceRow = {
  id: string;
  kind: "csv";
  name?: string;
  bucket: string;
  prefix: string;
  ownerColumn: string;
  accessGrants: { assignedUsers: string[]; assignedDepartments: string[] };
  configVersion: number;
  updatedAt?: string;
};

type HeaderInspectResult = {
  headers: string[];
  duplicateIdentities: string[];
  inspectionToken: string;
  objectName?: string;
  credentialEnc?: string;
};

type FormState = {
  id?: string;
  name: string;
  bucket: string;
  prefix: string;
  credentialRef: CredentialRef;
  credentialJson: string;
  credentialEnc: string;
  ownerColumn: string;
  assignedUsers: string;
  assignedDepartments: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  bucket: "",
  prefix: "",
  credentialRef: { kind: "encryptedBlob", ref: "" },
  credentialJson: "",
  credentialEnc: "",
  ownerColumn: "",
  assignedUsers: "",
  assignedDepartments: "",
};

export function DataSourcesTab({
  users,
  departments,
  isSuperAdmin,
}: {
  users: UserRow[];
  departments: Department[];
  isSuperAdmin: boolean;
}) {
  const [dataSources, setDataSources] = useState<DataSourceRow[]>([]);
  const [form, setFormState] = useState<FormState>(EMPTY_FORM);
  const formRevision = useRef(0);
  const inspectionRequestId = useRef(0);
  const setForm = useCallback((next: SetStateAction<FormState>) => {
    formRevision.current += 1;
    setFormState(next);
  }, []);
  const [headers, setHeaders] = useState<HeaderInspectResult | null>(null);
  const [inspectedSignature, setInspectedSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadDataSources = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/data-sources");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load data sources");
      setDataSources(body.dataSources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data sources");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void loadDataSources();
  }, [loadDataSources]);

  const duplicateHeader = headers?.duplicateIdentities.length ? headers.duplicateIdentities.join(", ") : "";
  const currentInspectSignature = buildInspectSignature(form);
  const hasFreshInspection =
    headers !== null && inspectedSignature === currentInspectSignature;
  const canSave = useMemo(() => {
    if (!form.bucket.trim()) return false;
    if (!hasRequiredCredentialInputs(form)) return false;
    if (!form.ownerColumn.trim()) return false;
    if (!hasFreshInspection || !headers) return false;
    if (!headers.headers.includes(form.ownerColumn)) return false;
    if (duplicateHeader) return false;
    return true;
  }, [duplicateHeader, form, hasFreshInspection, headers]);

  function startEdit(ds: DataSourceRow) {
    setForm({
      id: ds.id,
      name: ds.name || "",
      bucket: ds.bucket,
      prefix: ds.prefix,
      credentialRef: { kind: "encryptedBlob", ref: "" },
      credentialJson: "",
      credentialEnc: "",
      ownerColumn: ds.ownerColumn,
      assignedUsers: ds.accessGrants.assignedUsers.join(", "),
      assignedDepartments: ds.accessGrants.assignedDepartments.join(", "),
    });
    setHeaders(null);
    setInspectedSignature(null);
    setError(null);
    setMessage("Editing existing source. Credential fields are write-only; leave them empty to keep the current credential.");
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setHeaders(null);
    setInspectedSignature(null);
    setError(null);
    setMessage(null);
  }

  async function inspectHeaders() {
    const requestId = inspectionRequestId.current + 1;
    inspectionRequestId.current = requestId;
    const requestFormRevision = formRevision.current;
    setInspecting(true);
    setError(null);
    setMessage(null);
    try {
      const hasRawCredential = form.credentialJson.trim().length > 0;
      const rawCredential = hasRawCredential
        ? parseServiceAccountCredential(form.credentialJson)
        : undefined;
      const body = form.id
        ? {
            dataSourceId: form.id,
            bucket: form.bucket,
            prefix: form.prefix,
            ...(hasRawCredential
              ? {
                  credentialRef: form.credentialRef,
                  credential: rawCredential,
                }
              : form.credentialEnc.trim()
                ? {
                    credentialRef: form.credentialRef,
                    credentialEnc: form.credentialEnc,
                  }
                : {}),
          }
        : {
            bucket: form.bucket,
            prefix: form.prefix,
            credentialRef: form.credentialRef,
            ...(hasRawCredential
              ? {
                  credential: rawCredential,
                }
              : { credentialEnc: form.credentialEnc }),
          };
      const res = await authFetch("/api/admin/data-sources/inspect-headers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (
        !isInspectionCurrent({
          requestId,
          currentRequestId: inspectionRequestId.current,
          formRevision: requestFormRevision,
          currentFormRevision: formRevision.current,
        })
      ) {
        return;
      }
      if (!res.ok) throw new Error(result.error || "Failed to inspect headers");
      if (typeof result.inspectionToken !== "string" || !result.inspectionToken) {
        throw new Error("Header inspection did not return a verification token");
      }
      if (hasRawCredential && (typeof result.credentialEnc !== "string" || !result.credentialEnc)) {
        throw new Error("Header inspection did not return an encrypted credential");
      }
      let inspectedForm = hasRawCredential
        ? acceptEncryptedInspection(form, result.credentialEnc)
        : form;
      if (!result.headers.includes(inspectedForm.ownerColumn)) {
        inspectedForm = { ...inspectedForm, ownerColumn: result.headers[0] || "" };
      }
      setForm(inspectedForm);
      setHeaders(result);
      setInspectedSignature(buildInspectSignature(inspectedForm));
      setMessage(`Inspected ${result.objectName || "CSV"}: ${result.headers.length} header(s).`);
    } catch (err) {
      if (
        !isInspectionCurrent({
          requestId,
          currentRequestId: inspectionRequestId.current,
          formRevision: requestFormRevision,
          currentFormRevision: formRevision.current,
        })
      ) {
        return;
      }
      setHeaders(null);
      setInspectedSignature(null);
      setError(err instanceof Error ? err.message : "Failed to inspect headers");
    } finally {
      if (requestId === inspectionRequestId.current) {
        setInspecting(false);
      }
    }
  }

  function updateCredentialJson(value: string) {
    setForm((current) => ({
      ...current,
      credentialJson: value,
      credentialEnc: "",
    }));
    setHeaders(null);
    setInspectedSignature(null);
  }

  async function saveSource() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        kind: "csv",
        name: form.name,
        bucket: form.bucket,
        prefix: form.prefix,
        ownerColumn: form.ownerColumn,
        accessGrants: {
          assignedUsers: splitCsv(form.assignedUsers),
          assignedDepartments: splitCsv(form.assignedDepartments),
        },
        inspectionToken: headers?.inspectionToken,
      };
      if (!form.id || form.credentialRef.ref.trim()) {
        payload.credentialRef = form.credentialRef;
      }
      if (form.credentialEnc.trim()) {
        payload.credentialEnc = form.credentialEnc.trim();
      }

      const res = await authFetch(
        form.id ? `/api/admin/data-sources/${form.id}` : "/api/admin/data-sources",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save data source");
      setMessage(form.id ? "Data source updated." : "Data source created.");
      resetForm();
      await loadDataSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save data source");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSource(id: string) {
    if (!window.confirm("Delete this data source?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/data-sources/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete data source");
      setMessage("Data source deleted.");
      await loadDataSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete data source");
    } finally {
      setSaving(false);
    }
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSV Data Sources</CardTitle>
          <CardDescription>
            Register governed CSV buckets for row-scoped dataset chat. Credentials are write-only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {message && <div className="rounded border bg-muted p-3 text-sm">{message}</div>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading data sources...</p>
          ) : dataSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data sources registered yet.</p>
          ) : (
            <div className="space-y-3">
              {dataSources.map((ds) => (
                <div key={ds.id} className="rounded border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{ds.name || ds.id}</div>
                      <div className="text-sm text-muted-foreground">gs://{ds.bucket}/{ds.prefix}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(ds)}>Edit</Button>
                      <Button variant="destructive" size="sm" disabled={saving} onClick={() => deleteSource(ds.id)}>Delete</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">owner: {ds.ownerColumn}</Badge>
                    <Badge variant="secondary">v{ds.configVersion}</Badge>
                    <Badge variant="outline">users: {ds.accessGrants.assignedUsers.length}</Badge>
                    <Badge variant="outline">departments: {ds.accessGrants.assignedDepartments.length}</Badge>
                    <Badge>credential configured</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{form.id ? "Edit data source" : "Create data source"}</CardTitle>
          <CardDescription>
            Inspect headers server-side, then choose the owner column that controls row scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sales export" />
            </Field>
            <Field label="Bucket">
              <Input value={form.bucket} onChange={(e) => setForm({ ...form, bucket: e.target.value })} placeholder="my-gcs-bucket" />
            </Field>
            <Field label="Prefix">
              <Input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} placeholder="exports/" />
            </Field>
            <Field label="Credential ref">
              <Input value={form.credentialRef.ref} onChange={(e) => setForm({ ...form, credentialRef: { ...form.credentialRef, ref: e.target.value } })} placeholder="credential-a" />
            </Field>
            <Field label="Service account JSON">
              <Textarea
                value={form.credentialJson}
                onChange={(event) => updateCredentialJson(event.target.value)}
                placeholder={form.id ? "Leave empty to keep current" : "Paste the service account JSON"}
                rows={6}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field label="Owner column">
              {headers?.headers.length ? (
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.ownerColumn}
                  onChange={(event) => setForm({ ...form, ownerColumn: event.target.value })}
                >
                  {headers.headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              ) : (
                <Input value={form.ownerColumn} onChange={(e) => setForm({ ...form, ownerColumn: e.target.value })} placeholder="Inspect headers first" />
              )}
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Assigned users (UIDs, comma-separated)">
              <Input value={form.assignedUsers} onChange={(e) => setForm({ ...form, assignedUsers: e.target.value })} placeholder={users.slice(0, 2).map((u) => u.uid).join(", ")} />
            </Field>
            <Field label="Assigned departments (IDs, comma-separated)">
              <Input value={form.assignedDepartments} onChange={(e) => setForm({ ...form, assignedDepartments: e.target.value })} placeholder={departments.slice(0, 2).map((d) => d.id).join(", ")} />
            </Field>
          </div>

          {headers && (
            <div className="rounded border p-3 text-sm space-y-2">
              <div className="font-medium">Headers</div>
              <div className="flex flex-wrap gap-2">
                {headers.headers.map((header) => <Badge key={header} variant="outline">{header}</Badge>)}
              </div>
              {duplicateHeader && (
                <p className="text-destructive">Duplicate normalized header identity: {duplicateHeader}. Save is blocked.</p>
              )}
            </div>
          )}

          <div className="border-t" />
          <div className="flex gap-2">
            <Button variant="outline" disabled={inspecting || saving} onClick={inspectHeaders}>
              {inspecting ? "Inspecting..." : "Inspect headers"}
            </Button>
            <Button disabled={!canSave || saving} onClick={saveSource}>
              {saving ? "Saving..." : form.id ? "Update source" : "Create source"}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={resetForm}>Reset</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function buildInspectSignature(form: FormState): string {
  return JSON.stringify({
    id: form.id ?? "",
    bucket: form.bucket.trim(),
    prefix: form.prefix.trim(),
    credentialRefKind: form.credentialRef.kind,
    credentialRef: form.credentialRef.ref.trim(),
    credentialEnc: form.credentialEnc.trim(),
  });
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
