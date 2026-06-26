"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDER_VALUES,
  SUPPORTED_MODELS,
  type AiProvider,
} from "@/lib/ai-provider-metadata";
import { authFetch } from "@/lib/firebase/auth";

interface SanitizedAiConfig {
  provider: AiProvider;
  model: string;
  baseUrl?: string;
  apiKeyConfigured?: boolean;
}

interface AiConfigUser {
  uid: string;
  email: string;
  displayName: string;
  aiConfig?: SanitizedAiConfig | null;
}

function AiConfigForm({
  selectedUser,
  users,
  onUsersUpdate,
}: {
  selectedUser: AiConfigUser;
  users: AiConfigUser[];
  onUsersUpdate: (users: AiConfigUser[]) => void;
}) {
  const initial = selectedUser.aiConfig;
  const [provider, setProvider] = useState<AiProvider>(initial?.provider || "anthropic");
  const [model, setModel] = useState(initial?.model || SUPPORTED_MODELS[initial?.provider || "anthropic"][0]);
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl || "");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const modelOptions = SUPPORTED_MODELS[provider];

  function onProviderChange(nextProvider: AiProvider) {
    setProvider(nextProvider);
    setModel(SUPPORTED_MODELS[nextProvider][0]);
    if (nextProvider !== "custom") {
      setBaseUrl("");
      setApiKey("");
    }
  }

  async function saveConfig() {
    if (provider === "custom" && (!baseUrl.trim() || !model.trim())) {
      toast.error("Custom provider requires base URL and model");
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch("/api/admin/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: selectedUser.uid,
          aiConfig: {
            provider,
            model: model.trim(),
            ...(provider === "custom" ? { baseUrl: baseUrl.trim(), apiKey: apiKey.trim() } : {}),
          },
          keepExistingApiKey: provider === "custom" && !apiKey.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save AI config");

      onUsersUpdate(
        users.map((user) =>
          user.uid === selectedUser.uid ? { ...user, aiConfig: data.aiConfig } : user
        )
      );
      setApiKey("");
      toast.success("AI configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save AI config");
    } finally {
      setSaving(false);
    }
  }

  async function clearConfig() {
    if (!confirm("Clear this user's AI config and use environment defaults?")) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: selectedUser.uid, aiConfig: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clear AI config");
      onUsersUpdate(
        users.map((user) => user.uid === selectedUser.uid ? { ...user, aiConfig: null } : user)
      );
      toast.success("AI configuration cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear AI config");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-provider">Provider</Label>
          <select
            id="ai-provider"
            value={provider}
            onChange={(event) => onProviderChange(event.target.value as AiProvider)}
            className="w-full bg-transparent border rounded-md px-3 py-2 text-sm"
          >
            {AI_PROVIDER_VALUES.map((value) => (
              <option key={value} value={value}>
                {AI_PROVIDER_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-model">Model</Label>
          {provider === "custom" ? (
            <Input
              id="ai-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="model-name"
            />
          ) : (
            <select
              id="ai-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="w-full bg-transparent border rounded-md px-3 py-2 text-sm"
            >
              {modelOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {provider === "custom" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-base-url">Base URL</Label>
            <Input
              id="ai-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-api-key">API Key</Label>
            <Input
              id="ai-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={selectedUser.aiConfig?.apiKeyConfigured ? "Existing key configured" : "sk-..."}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={saveConfig} disabled={saving}>
          Save AI config
        </Button>
        <Button variant="outline" onClick={clearConfig} disabled={saving}>
          Use defaults
        </Button>
      </div>
    </div>
  );
}

export function AiConfigTab({
  users,
  onUsersUpdate,
}: {
  users: AiConfigUser[];
  onUsersUpdate: (users: AiConfigUser[]) => void;
}) {
  const [selectedUid, setSelectedUid] = useState("");
  const effectiveSelectedUid = selectedUid || users[0]?.uid || "";
  const selectedUser = useMemo(
    () => users.find((user) => user.uid === effectiveSelectedUid),
    [effectiveSelectedUid, users]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Provider Configuration</CardTitle>
        <CardDescription>
          Select the provider and model used for each user. API keys stay server-side.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ai-user">User</Label>
          <select
            id="ai-user"
            value={effectiveSelectedUid}
            onChange={(event) => setSelectedUid(event.target.value)}
            className="w-full bg-transparent border rounded-md px-3 py-2 text-sm"
          >
            {users.map((user) => (
              <option key={user.uid} value={user.uid}>
                {user.displayName} ({user.email})
              </option>
            ))}
          </select>
        </div>

        {selectedUser ? (
          <AiConfigForm
            key={selectedUser.uid}
            selectedUser={selectedUser}
            users={users}
            onUsersUpdate={onUsersUpdate}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No users found.</p>
        )}
      </CardContent>
    </Card>
  );
}
