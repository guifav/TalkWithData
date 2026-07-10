/**
 * Headers de seguranca para conteudo de dashboard enviado por usuarios.
 *
 * O HTML de dashboard e conteudo arbitrario com script. Na UI ele sempre roda
 * dentro de iframe sandbox="allow-scripts" (sem allow-same-origin), ou seja,
 * em origem opaca. O CSP "sandbox allow-scripts" replica exatamente esse
 * ambiente quando a URL da rota e aberta direto no browser: os scripts rodam,
 * mas sem document.cookie, sem o IndexedDB da origem do app e sem reutilizar a
 * sessao do app em chamadas de API. Requests de subrecurso ainda transportam o
 * cookie dash_session (SameSite=None, escopo de path), que autoriza apenas os
 * proprios assets do dashboard. Sem esse header, abrir a rota direto
 * executaria o HTML enviado com a sessao da vitima (vetor de account takeover
 * entre usuarios do mesmo dominio).
 *
 * Isso vale para todo tipo que o browser trata como documento ativo, nao so
 * text/html. Um SVG enviado, servido como image/svg+xml e aberto direto na
 * barra de endereco, executa <script> na origem do app e le o cookie
 * twd_auth (ID token do Firebase, nao HttpOnly). Por isso HTML, SVG e XML
 * recebem o mesmo sandbox; assets inertes (CSS, JS, imagens raster, fontes)
 * recebem apenas nosniff.
 *
 * Referrer-Policy: no-referrer evita vazar o embed_token (que viaja na URL)
 * como Referer em requests de saida do documento.
 *
 * Vive em modulo proprio (e nao em dashboard-html.ts) para que os testes de
 * rota possam mockar dashboard-html sem engolir estas constantes.
 */
export const DASHBOARD_HTML_SECURITY_HEADERS = {
  "Content-Security-Policy": "sandbox allow-scripts",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

export const DASHBOARD_ASSET_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

/**
 * Tipos que o browser renderiza como documento ativo (com contexto de
 * navegacao e script) quando abertos como top-level, e portanto precisam do
 * sandbox mesmo servidos como asset. O nosniff ja bloqueia o sniffing de
 * imagem raster para HTML, entao o residuo real e SVG e as familias XML/XHTML.
 *
 * O sufixo `+xml` (RFC 6839) cobre tipos estruturados registrados alem de SVG
 * (application/xhtml+xml, etc.). Marcar um `+xml` inerte como ativo e inofensivo
 * (o header CSP so importa em navegacao top-level; fetch/subrecurso ignora), mas
 * deixar um ativo de fora abriria a mesma brecha do SVG.
 */
export function isActiveDocumentContentType(contentType: string): boolean {
  const type = contentType.split(";")[0].trim().toLowerCase();
  return (
    type === "text/html" ||
    type === "application/xml" ||
    type === "text/xml" ||
    type.endsWith("+xml")
  );
}
