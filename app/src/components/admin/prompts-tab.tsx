"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "@/lib/firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Sparkles,
  RotateCcw,
  History,
  ChevronLeft,
  FileText,
  GitCompare,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { diffLines, diffStats, type DiffSegment } from "@/lib/diff-lines";
import {
  findUnknownGlobalVariables,
  renderGlobalPromptVariables,
  type PromptGlobalVariable,
  type PromptGovernance,
} from "@/lib/prompt-governance";

interface PromptAuthor {
  uid: string;
  email: string;
  name?: string;
}

interface PromptSummary {
  key: string;
  label: string;
  description: string;
  governance: PromptGovernance;
  globalVariables: PromptGlobalVariable[];
  requiredPlaceholders: string[];
  activeVersion: number | null;
  hasActive: boolean;
  hasDraft: boolean;
  updatedAt: string | null;
  updatedBy: PromptAuthor | null;
  draftUpdatedAt: string | null;
  draftUpdatedBy: PromptAuthor | null;
  isTemplate: boolean;
}

interface PromptDetail extends PromptSummary {
  activeContent: string | null;
  draftContent: string | null;
  fallbackContent: string;
}

interface PromptVersion {
  id: string;
  version: number;
  content: string;
  status: "active" | "archived";
  changeSummary: string;
  authorUid: string;
  authorEmail: string;
  authorName?: string;
  createdAt: string;
  restoredFromVersion: number | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

function authorLabel(a: PromptAuthor | null): string {
  if (!a) return "—";
  return a.name || a.email;
}

function consumerLabel(consumers: PromptGovernance["consumers"]): string {
  return consumers.join(", ");
}

function PlaceholderToken({ token }: { token: string }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
      {token}
    </code>
  );
}

// ── List view ────────────────────────────────────────────────────────────────

function PromptList({
  prompts,
  onSelect,
}: {
  prompts: PromptSummary[];
  onSelect: (key: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {prompts.map((p) => (
        <Card
          key={p.key}
          className="cursor-pointer hover:border-foreground/30 transition-colors"
          onClick={() => onSelect(p.key)}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{p.label}</CardTitle>
                <CardDescription className="mt-1">
                  {p.governance.purpose}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                {p.activeVersion !== null ? (
                  <Badge variant="secondary">v{p.activeVersion}</Badge>
                ) : (
                  <Badge variant="outline">fallback</Badge>
                )}
                {p.hasDraft && <Badge variant="default">draft</Badge>}
                {p.isTemplate && (
                  <Badge variant="outline" className="text-[10px]">
                    template
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <div className="flex flex-wrap gap-1">
              {p.governance.badges.map((badge) => (
                <Badge
                  key={badge}
                  variant="outline"
                  className="text-[10px] font-normal"
                >
                  {badge}
                </Badge>
              ))}
            </div>
            <div>
              <span className="font-medium">Fluxos:</span>{" "}
              {consumerLabel(p.governance.consumers)}
            </div>
            <div>
              <span className="font-medium">Key:</span>{" "}
              <code className="text-[11px]">{p.key}</code>
            </div>
            <div>
              <span className="font-medium">Last published:</span>{" "}
              {formatDate(p.updatedAt)} by {authorLabel(p.updatedBy)}
            </div>
            {p.hasDraft && (
              <div>
                <span className="font-medium">Draft updated:</span>{" "}
                {formatDate(p.draftUpdatedAt)} by{" "}
                {authorLabel(p.draftUpdatedBy)}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GovernancePanel({ prompt }: { prompt: PromptDetail }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="size-4" /> Impacto deste prompt
          </CardTitle>
          <CardDescription>{prompt.governance.purpose}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Fluxos consumidores
            </div>
            <div className="flex flex-wrap gap-1">
              {prompt.governance.consumers.map((consumer) => (
                <Badge key={consumer} variant="secondary">
                  {consumer}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Publicar uma versao afeta
            </div>
            <p className="text-muted-foreground">{prompt.governance.impact}</p>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Origem no codigo
            </div>
            <ul className="space-y-1">
              {prompt.governance.sourceFiles.map((file) => (
                <li key={file}>
                  <code className="text-xs">{file}</code>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Composicao e riscos</CardTitle>
          <CardDescription>
            Ordem de montagem, dependencias e limites de edicao.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Onde entra no pipeline
            </div>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              {prompt.governance.composition.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Dependencias
            </div>
            <div className="flex flex-wrap gap-1">
              {prompt.governance.dependencies.map((dependency) => (
                <Badge
                  key={dependency}
                  variant="outline"
                  className="font-normal"
                >
                  {dependency}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Riscos comuns
            </div>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              {prompt.governance.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Mudancas seguras
              </div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {prompt.governance.safeChanges.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Evitar
              </div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {prompt.governance.dangerousChanges.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PromptVariablesPanel({
  prompt,
  onInsert,
}: {
  prompt: PromptDetail;
  onInsert: (token: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Variaveis e placeholders</CardTitle>
        <CardDescription>
          Use <code>{"{{variavel}}"}</code> para variaveis globais resolvidas
          antes da chamada ao modelo. Placeholders tecnicos usam{" "}
          <code>${"{"}placeholder{"}"}</code> e sao preservados ate o renderer
          do fluxo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Variaveis globais disponiveis
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {prompt.globalVariables.map((variable) => (
              <button
                key={variable.name}
                type="button"
                onClick={() => onInsert(variable.token)}
                className="rounded-md border p-2 text-left hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <PlaceholderToken token={variable.token} />
                  <span className="text-[10px] text-muted-foreground">
                    inserir
                  </span>
                </div>
                <div className="mt-2 text-xs font-medium">{variable.label}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {variable.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Placeholders tecnicos obrigatorios
          </div>
          {prompt.requiredPlaceholders.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {prompt.requiredPlaceholders.map((name) => (
                <PlaceholderToken key={name} token={`\${${name}}`} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Este prompt nao exige placeholders tecnicos para publicacao.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Detail view ──────────────────────────────────────────────────────────────

function PromptEditor({
  promptKey,
  onBack,
}: {
  promptKey: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PromptDetail | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [editorContent, setEditorContent] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishSummary, setPublishSummary] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [tab, setTab] = useState<"edit" | "history">("edit");
  const [diffVersion, setDiffVersion] = useState<PromptVersion | null>(null);
  const [diffMode, setDiffMode] = useState<"raw" | "diff">("diff");
  const [restoreTarget, setRestoreTarget] = useState<PromptVersion | null>(
    null
  );
  const [restoreSummary, setRestoreSummary] = useState("");
  const [restoring, setRestoring] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `/api/admin/prompts/${encodeURIComponent(promptKey)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        prompt: PromptDetail;
        versions: PromptVersion[];
      };
      setDetail(data.prompt);
      setVersions(data.versions);
      setEditorContent(
        data.prompt.draftContent ??
          data.prompt.activeContent ??
          data.prompt.fallbackContent
      );
    } catch (err) {
      console.error(err);
      toast.error("Falha ao carregar prompt");
    } finally {
      setLoading(false);
    }
  }, [promptKey]);

  useEffect(() => {
    load();
  }, [load]);

  const previousContent = useMemo(() => {
    return detail?.activeContent ?? detail?.fallbackContent ?? "";
  }, [detail]);

  const dirty = useMemo(() => {
    if (!detail) return false;
    const baseline =
      detail.draftContent ??
      detail.activeContent ??
      detail.fallbackContent ??
      "";
    return editorContent !== baseline;
  }, [editorContent, detail]);

  const unknownGlobalVariables = useMemo(
    () => findUnknownGlobalVariables(editorContent),
    [editorContent]
  );

  const renderedPreview = useMemo(
    () => renderGlobalPromptVariables(editorContent).content,
    [editorContent]
  );

  const handleInsertVariable = useCallback(
    (token: string) => {
      const textarea = editorRef.current;
      const start = textarea?.selectionStart ?? editorContent.length;
      const end = textarea?.selectionEnd ?? editorContent.length;
      const next =
        editorContent.slice(0, start) + token + editorContent.slice(end);
      setEditorContent(next);
      requestAnimationFrame(() => {
        editorRef.current?.focus();
        const cursor = start + token.length;
        editorRef.current?.setSelectionRange(cursor, cursor);
      });
    },
    [editorContent]
  );

  const handleSaveDraft = useCallback(async () => {
    if (!editorContent.trim()) {
      toast.error("Conteudo nao pode estar vazio");
      return;
    }
    setSavingDraft(true);
    try {
      const res = await authFetch(
        `/api/admin/prompts/${encodeURIComponent(promptKey)}/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editorContent }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
      }
      toast.success("Rascunho salvo");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar rascunho");
    } finally {
      setSavingDraft(false);
    }
  }, [editorContent, promptKey, load]);

  const handleDiscardDraft = useCallback(async () => {
    if (!detail?.hasDraft) return;
    try {
      const res = await authFetch(
        `/api/admin/prompts/${encodeURIComponent(promptKey)}/draft`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Rascunho descartado");
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao descartar rascunho"
      );
    }
  }, [detail, promptKey, load]);

  const handleExplainChange = useCallback(async () => {
    if (!editorContent.trim()) {
      toast.error("Edite o conteudo antes de gerar resumo");
      return;
    }
    setExplaining(true);
    try {
      const res = await authFetch(
        `/api/admin/prompts/${encodeURIComponent(promptKey)}/explain-change`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previousContent,
            newContent: editorContent,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { summary: string };
      setPublishSummary(data.summary);
      toast.success("Resumo gerado");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao gerar resumo"
      );
    } finally {
      setExplaining(false);
    }
  }, [editorContent, previousContent, promptKey]);

  const handlePublish = useCallback(async () => {
    if (!publishSummary.trim()) {
      toast.error("Resumo da mudanca e obrigatorio");
      return;
    }
    if (publishSummary.length > 500) {
      toast.error("Resumo deve ter no maximo 500 caracteres");
      return;
    }
    if (unknownGlobalVariables.length > 0) {
      toast.error(
        `Variaveis desconhecidas: ${unknownGlobalVariables.join(", ")}`
      );
      return;
    }
    setPublishing(true);
    try {
      const res = await authFetch(
        `/api/admin/prompts/${encodeURIComponent(promptKey)}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: editorContent,
            changeSummary: publishSummary,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { version: number };
      toast.success(`Versao v${data.version} publicada`);
      setPublishOpen(false);
      setPublishSummary("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao publicar");
    } finally {
      setPublishing(false);
    }
  }, [editorContent, publishSummary, unknownGlobalVariables, promptKey, load]);

  const handleRestore = useCallback(async () => {
    if (!restoreTarget) return;
    if (!restoreSummary.trim()) {
      toast.error("Resumo da mudanca e obrigatorio");
      return;
    }
    setRestoring(true);
    try {
      const res = await authFetch(
        `/api/admin/prompts/${encodeURIComponent(promptKey)}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versionId: restoreTarget.id,
            changeSummary: restoreSummary,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { version: number };
      toast.success(`Restaurado como v${data.version}`);
      setRestoreTarget(null);
      setRestoreSummary("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao restaurar");
    } finally {
      setRestoring(false);
    }
  }, [restoreTarget, restoreSummary, promptKey, load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="size-4 mr-1" /> Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Prompt nao encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="size-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-lg font-medium">{detail.label}</h2>
          {detail.activeVersion !== null ? (
            <Badge variant="secondary">v{detail.activeVersion} ativa</Badge>
          ) : (
            <Badge variant="outline">usando fallback</Badge>
          )}
          {detail.hasDraft && <Badge>rascunho</Badge>}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Button
            variant={tab === "edit" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab("edit")}
          >
            <FileText className="size-3.5 mr-1" /> Editar
          </Button>
          <Button
            variant={tab === "history" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab("history")}
          >
            <History className="size-3.5 mr-1" /> Historico ({versions.length})
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{detail.description}</p>
      {detail.isTemplate && (
        <p className="text-xs text-muted-foreground">
          Este e um template com placeholders no formato{" "}
          <code>${"{"}placeholder{"}"}</code>. Preserve os placeholders ao editar.
        </p>
      )}

      <GovernancePanel prompt={detail} />

      {tab === "edit" && (
        <div className="space-y-3">
          <PromptVariablesPanel
            prompt={detail}
            onInsert={handleInsertVariable}
          />
          {unknownGlobalVariables.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-destructive">
                Variaveis desconhecidas
              </div>
              <p className="mt-1 text-muted-foreground">
                Corrija ou remova antes de publicar:{" "}
                {unknownGlobalVariables.join(", ")}
              </p>
            </div>
          )}
          <Textarea
            ref={editorRef}
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            rows={22}
            className="font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{editorContent.length.toLocaleString()} caracteres</span>
            <span>
              {dirty ? "Alteracoes nao salvas" : "Sincronizado com versao salva"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={savingDraft || !dirty}
            >
              {savingDraft && (
                <Loader2 className="size-4 mr-1 animate-spin" />
              )}
              Salvar rascunho
            </Button>
            <Button
              onClick={() => setPublishOpen(true)}
              disabled={!editorContent.trim()}
            >
              Publicar nova versao
            </Button>
            {detail.hasDraft && (
              <Button variant="ghost" onClick={handleDiscardDraft}>
                Descartar rascunho
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() =>
                setEditorContent(detail.activeContent ?? detail.fallbackContent)
              }
              disabled={
                editorContent ===
                (detail.activeContent ?? detail.fallbackContent)
              }
            >
              Reverter para versao ativa
            </Button>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {versions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma versao publicada ainda. O app esta usando o fallback do
              codigo.
            </p>
          )}
          <ul className="divide-y border rounded-md">
            {versions.map((v) => (
              <li key={v.id} className="p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={v.status === "active" ? "secondary" : "outline"}
                    >
                      v{v.version} {v.status === "active" && "• ativa"}
                    </Badge>
                    <span className="text-sm">{v.changeSummary}</span>
                    {v.restoredFromVersion !== null && (
                      <Badge variant="outline" className="text-[10px]">
                        restaurada de v{v.restoredFromVersion}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDiffVersion(v)}
                    >
                      Ver
                    </Button>
                    {v.status !== "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRestoreTarget(v)}
                      >
                        <RotateCcw className="size-3.5 mr-1" /> Restaurar
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(v.createdAt)} •{" "}
                  {v.authorName || v.authorEmail}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Publish dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Publicar nova versao</DialogTitle>
            <DialogDescription>
              Isso cria uma versao imutavel e a torna ativa imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {unknownGlobalVariables.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <div className="font-medium text-destructive">
                  Publicacao bloqueada
                </div>
                <p className="mt-1 text-muted-foreground">
                  Variaveis desconhecidas: {unknownGlobalVariables.join(", ")}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-1">
                Resumo da mudanca
              </label>
              <Textarea
                value={publishSummary}
                onChange={(e) => setPublishSummary(e.target.value)}
                rows={3}
                placeholder="O que mudou e por que"
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                <span>{publishSummary.length}/500</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExplainChange}
                  disabled={explaining}
                >
                  {explaining ? (
                    <Loader2 className="size-3.5 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5 mr-1" />
                  )}
                  Explain the change
                </Button>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">
                Preview com variaveis resolvidas
              </div>
              <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                {renderedPreview}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPublishOpen(false)}
              disabled={publishing}
            >
              Cancelar
            </Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing && <Loader2 className="size-4 mr-1 animate-spin" />}
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore dialog */}
      <Dialog
        open={!!restoreTarget}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Restaurar versao v{restoreTarget?.version}
            </DialogTitle>
            <DialogDescription>
              Isso cria uma NOVA versao ativa baseada no conteudo de v
              {restoreTarget?.version}. O historico original e preservado.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={restoreSummary}
            onChange={(e) => setRestoreSummary(e.target.value)}
            rows={3}
            placeholder="Por que esta restaurando esta versao"
            maxLength={500}
          />
          <div className="text-xs text-muted-foreground">
            {restoreSummary.length}/500
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRestoreTarget(null)}
              disabled={restoring}
            >
              Cancelar
            </Button>
            <Button onClick={handleRestore} disabled={restoring}>
              {restoring && <Loader2 className="size-4 mr-1 animate-spin" />}
              Restaurar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diff / view dialog */}
      <DiffDialog
        diffVersion={diffVersion}
        detail={detail}
        mode={diffMode}
        onModeChange={setDiffMode}
        onClose={() => setDiffVersion(null)}
        onRestore={(v) => {
          setRestoreTarget(v);
          setDiffVersion(null);
        }}
      />
    </div>
  );
}

// ── Diff dialog ──────────────────────────────────────────────────────────────

function DiffSegmentRow({ segment }: { segment: DiffSegment }) {
  const oldNum = "oldNum" in segment ? segment.oldNum : "";
  const newNum = "newNum" in segment ? segment.newNum : "";
  const bg =
    segment.type === "add"
      ? "bg-green-50 dark:bg-green-950/30"
      : segment.type === "remove"
        ? "bg-red-50 dark:bg-red-950/30"
        : "";
  const marker =
    segment.type === "add" ? "+" : segment.type === "remove" ? "-" : " ";
  return (
    <div className={`flex font-mono text-xs ${bg}`}>
      <span className="w-10 text-right pr-1 text-muted-foreground tabular-nums select-none">
        {oldNum}
      </span>
      <span className="w-10 text-right pr-1 text-muted-foreground tabular-nums select-none">
        {newNum}
      </span>
      <span className="w-4 text-center select-none">{marker}</span>
      <span className="flex-1 whitespace-pre-wrap break-words pr-2">
        {segment.line || " "}
      </span>
    </div>
  );
}

function DiffDialog({
  diffVersion,
  detail,
  mode,
  onModeChange,
  onClose,
  onRestore,
}: {
  diffVersion: PromptVersion | null;
  detail: PromptDetail | null;
  mode: "raw" | "diff";
  onModeChange: (m: "raw" | "diff") => void;
  onClose: () => void;
  onRestore: (v: PromptVersion) => void;
}) {
  const activeContent = detail?.activeContent ?? detail?.fallbackContent ?? "";

  const segments = useMemo(() => {
    if (!diffVersion) return [];
    return diffLines(diffVersion.content, activeContent);
  }, [diffVersion, activeContent]);

  const stats = useMemo(() => diffStats(segments), [segments]);

  if (!diffVersion) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            v{diffVersion.version} — {diffVersion.changeSummary}
          </DialogTitle>
          <DialogDescription>
            {formatDate(diffVersion.createdAt)} •{" "}
            {diffVersion.authorName || diffVersion.authorEmail}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Button
              variant={mode === "diff" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onModeChange("diff")}
            >
              <GitCompare className="size-3.5 mr-1" /> Diff vs ativa
            </Button>
            <Button
              variant={mode === "raw" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onModeChange("raw")}
            >
              <FileText className="size-3.5 mr-1" /> Conteudo bruto
            </Button>
          </div>
          {mode === "diff" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-700 dark:text-green-400">
                +{stats.added}
              </span>
              <span className="text-red-700 dark:text-red-400">
                -{stats.removed}
              </span>
              <span>={stats.unchanged}</span>
            </div>
          )}
        </div>

        {mode === "diff" ? (
          <div className="border rounded bg-muted/30 max-h-[60vh] overflow-auto">
            <div className="sticky top-0 bg-background border-b px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground flex">
              <span className="w-10 text-right pr-1">v{diffVersion.version}</span>
              <span className="w-10 text-right pr-1">ativa</span>
              <span className="w-4" />
              <span>Linhas removidas vs adicionadas pela versao ativa</span>
            </div>
            {segments.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">
                Conteudos identicos.
              </p>
            ) : (
              segments.map((s, idx) => (
                <DiffSegmentRow key={idx} segment={s} />
              ))
            )}
          </div>
        ) : (
          <pre className="text-xs font-mono bg-muted p-3 rounded max-h-[60vh] overflow-auto whitespace-pre-wrap">
            {diffVersion.content}
          </pre>
        )}

        <DialogFooter>
          {diffVersion.status !== "active" && (
            <Button
              variant="outline"
              onClick={() => onRestore(diffVersion)}
            >
              <RotateCcw className="size-3.5 mr-1" /> Restaurar esta versao
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Top-level component ──────────────────────────────────────────────────────

export function PromptsTab() {
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/prompts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { prompts: PromptSummary[] };
      setPrompts(data.prompts);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao listar prompts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  if (selectedKey) {
    return (
      <PromptEditor
        promptKey={selectedKey}
        onBack={() => {
          setSelectedKey(null);
          fetchList();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Prompts do app</h2>
        <p className="text-sm text-muted-foreground">
          Edite, versione e restaure prompts usados pelo AI Dashboard Builder,
          pelo refresh de dashboards e pelo Data Chat. Cada card mostra fluxos,
          impacto e dependencias para ajudar a avaliar o efeito de uma
          publicacao. Quando nao ha versao publicada, o app usa o fallback
          hardcoded no codigo.
        </p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <PromptList prompts={prompts} onSelect={setSelectedKey} />
      )}
    </div>
  );
}
