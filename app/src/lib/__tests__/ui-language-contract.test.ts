import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const surfaceFiles = [
  "src/app/login/page.tsx",
  "src/app/page.tsx",
  "src/components/layout/app-shell.tsx",
  "src/components/home/home-empty-state.tsx",
  "src/components/home/home-header.tsx",
  "src/components/home/create-menu.tsx",
  "src/components/home/dashboard-card.tsx",
  "src/components/home/dashboard-grid.tsx",
  "src/lib/ai-prompt.ts",
];

const surfaceSource = surfaceFiles
  .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
  .join("\n");

describe("default UI language contract", () => {
  it("keeps first-impression and home surfaces in English", () => {
    const forbiddenPortuguese = [
      "Olá,",
      "Bem-vindo",
      "Você ainda",
      "Ninguém",
      "Nenhum dashboard",
      "Início",
      "Explorar",
      "Guia",
      "Buscar dashboards",
      "Todas",
      "Criar pasta",
      "Vistos recentemente",
      "Meus (",
      "Compartilhados",
      "Favoritos",
      "Arquivados",
      "Novo dashboard",
      "Como você quer começar?",
      "Criar com IA",
      "Conversar com dados",
      "Upload de arquivo",
      "Gerado com IA",
      "Específico",
      "Atualizado",
      "Compartilhamento",
      "Renomear",
      "Substituir arquivo",
      "Versões anteriores",
      "Adicionar à pasta",
      "Copiar link de embed",
      "Desarquivar",
      "Arquivar",
      "Excluir",
      "Mostrar mais",
      "Falha ao",
      "Sem dados disponíveis para este período",
      'toLocaleDateString("pt-BR"',
    ];

    for (const phrase of forbiddenPortuguese) {
      expect(surfaceSource, `unexpected PT-BR surface text: ${phrase}`).not.toContain(phrase);
    }
  });

  it("documents English as the current default until i18n exists", () => {
    const projectRules = readFileSync(join(process.cwd(), "..", "CLAUDE.md"), "utf8");
    expect(projectRules).toContain("English is the default UI language");
    expect(projectRules).toContain("PT-BR requires an explicit i18n locale");
  });
});
