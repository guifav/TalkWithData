<p align="center">
  <img src="docs/banner.svg" alt="Talk With Data" width="100%">
</p>

# Talk With Data

[Read in English](README.md)

Hub open-source de dashboards com IA. Envie, organize, pesquise, converse e incorpore dashboards.

Talk With Data ajuda equipes a publicar pacotes HTML de dashboards, pesquisar conteudo, explorar dados com IA, conectar ferramentas MCP e compartilhar visualizacoes com autenticacao ou tokens de embed.

## Pre-requisitos

- Node.js 22 ou superior para desenvolvimento local sem Docker.
- Docker, opcional, usado no inicio rapido e recomendado para paridade com producao.
- Um banco PostgreSQL. PostgreSQL e obrigatorio, inclusive para desenvolvimento local.
- Um projeto Firebase com Authentication, Firestore e Storage habilitados.
- Um bucket no Google Cloud Storage, ou `STORAGE_PROVIDER=local` para armazenar uploads no disco local.
- Pelo menos uma chave de API de um provedor de IA para os recursos de IA.

## Inicio rapido com Docker

Rode localmente com Docker em tres comandos:

```bash
cp .env.example .env
docker build -t talk-with-data -f app/Dockerfile app
docker run --rm --env-file .env -p 3000:8080 talk-with-data
```

O container escuta na porta `8080`. O parametro `-p 3000:8080` mapeia a porta para 3000 na sua maquina. Abra http://localhost:3000.

O arquivo `.env` copiado tem placeholders. Configure Firebase, storage e pelo menos um provedor de IA antes de usar login e recursos de IA.

## Recursos

- Upload de dashboards em HTML unico ou pacotes com multiplos arquivos.
- Chat com IA para criar, editar, explicar e explorar dados.
- Busca por dashboards, categorias, donos, departamentos e pastas compartilhadas.
- APIs de dados para bases estruturadas especificas de cada dashboard.
- Integracao MCP para chamadas controladas a ferramentas externas.
- Tokens de embed para compartilhamento externo.
- Base para configuracao multi-modelo por usuario.
- Painel admin para usuarios, permissoes, categorias, departamentos, prompts, MCP e metricas.

## Stack tecnica

- Next.js 16 com App Router.
- React 19.
- Firebase Authentication, Firestore e Firebase Storage sobre Google Cloud Storage.
- Prisma para bases estruturadas por dashboard.
- shadcn/ui com tema Neutral.
- Tailwind CSS 4.
- TypeScript em modo strict.
- Vitest e ESLint.

## Configuracao

Copie `.env.example` para `.env` e preencha as variaveis do seu projeto.

Variaveis principais:

- `ALLOWED_AUTH_DOMAIN`, dominio permitido para login Google.
- `NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN`, copia do `ALLOWED_AUTH_DOMAIN` exposta ao navegador. Use o mesmo valor nas duas variaveis.
- `NEXT_PUBLIC_FIREBASE_*`, configuracao publica do app Firebase.
- `FIREBASE_PROJECT_ID`, projeto usado pelo Firebase Admin.
- `SA_KEY_JSON`, service account opcional para desenvolvimento local.
- `STORAGE_BUCKET_NAME`, bucket para HTML e assets dos dashboards.
- `DATABASE_URL`, string de conexao PostgreSQL usada pelo Prisma. PostgreSQL e obrigatorio, inclusive para desenvolvimento local.
- `DASHBOARD_SESSION_SECRET`, segredo para tokens de sessao e embed.
- `APP_URL`, URL publica da aplicacao.
- `ANTHROPIC_API_KEY`, chave para recursos de IA com Anthropic.
- `MCP_ALLOWED_HOSTS`, `MCP_API_KEY` e `MCP_URL`, configuracao opcional de MCP.
- `THUMBNAIL_FUNCTION_URL` e `THUMBNAIL_SECRET`, thumbnails opcionais.
- `STORAGE_PROVIDER` e `LOCAL_STORAGE_ROOT`, storage local opcional. `LOCAL_STORAGE_ROOT` tem padrao `/data/uploads` quando `STORAGE_PROVIDER=local`.

Veja [.env.example](.env.example) para o template completo.

## Desenvolvimento

```bash
cd app
npm install
npm run db:generate
npm run dev
```

Comandos uteis:

```bash
npm test
npm run lint
npm run build
```

## Deploy

Docker e o caminho portavel recomendado. Use `app/Dockerfile`, forneca as variaveis de ambiente e exponha a porta `8080` do container.

Consulte [DEPLOYMENT.md](docs/DEPLOYMENT.md) para Docker, Google Cloud Run, Firebase, storage, provedores de IA e MCP opcional.

## Como contribuir

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir issues ou pull requests.

## Licenca

Talk With Data usa a [licenca MIT](LICENSE).
