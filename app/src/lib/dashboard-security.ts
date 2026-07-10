/**
 * Headers de seguranca para conteudo de dashboard enviado por usuarios.
 *
 * O HTML de dashboard e conteudo arbitrario com script. Na UI ele sempre roda
 * dentro de iframe sandbox="allow-scripts" (sem allow-same-origin), ou seja,
 * em origem opaca. O CSP "sandbox allow-scripts" replica exatamente esse
 * ambiente quando a URL da rota e aberta direto no browser: os scripts rodam,
 * mas sem acesso a cookies, IndexedDB e APIs autenticadas da origem do app.
 * Sem esse header, abrir a rota direto executaria o HTML enviado com a sessao
 * da vitima (vetor de account takeover entre usuarios do mesmo dominio).
 *
 * Vive em modulo proprio (e nao em dashboard-html.ts) para que os testes de
 * rota possam mockar dashboard-html sem engolir estas constantes.
 */
export const DASHBOARD_HTML_SECURITY_HEADERS = {
  "Content-Security-Policy": "sandbox allow-scripts",
  "X-Content-Type-Options": "nosniff",
} as const;

export const DASHBOARD_ASSET_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
} as const;
