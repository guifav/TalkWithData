import { createHash } from "node:crypto";
import {
  getDataSource,
  getDataSourceWithCredentials,
  type DataSourceMetadata,
} from "@/lib/data-sources/firestore";
import { canQueryDataSource, resolveViewerScope } from "@/lib/data-sources/access";
import { loadSource } from "@/lib/data-sources/duckdb-engine";
import {
  getCachedGcsStorage,
  type ExternalBucketStorage,
} from "@/lib/data-sources/storage";
import { SecretService, type CredentialRef } from "@/lib/data-sources/credentials";
import {
  DataSourceNotFoundError,
  DataSourceUnavailableError,
  QueryDatasetAccessDeniedError,
  QueryDatasetInvalidInputError,
} from "@/lib/data-sources/errors";
import type {
  DataSource,
  QueryAuthorization,
  ViewerScope,
} from "@/lib/data-sources/types";
import { DataSourceKind } from "@/lib/data-sources/types";

export interface QueryDatasetResult {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
}

/**
 * Converte a metadata persistida em Firestore para o contrato de runtime
 * consumido pelo engine DuckDB (P1.6). Mantem apenas os campos de escopo de
 * linha e grants; nunca inclui credenciais.
 */
export function dataSourceToRuntime(dsMeta: DataSourceMetadata): DataSource {
  const ds: DataSource = {
    id: dsMeta.id,
    kind: DataSourceKind.CSV,
    orgId: dsMeta.orgId,
    configVersion: dsMeta.configVersion,
    accessGrants: dsMeta.accessGrants,
    ownerColumnIdentity: dsMeta.ownerColumnIdentity ?? "email",
  };

  if (dsMeta.ownerColumn) {
    ds.ownerColumn = dsMeta.ownerColumn;
  }

  return ds;
}

export interface ReadCsvResult {
  csvBuffer: Buffer;
  etag: string;
}

type DataSourceDocWithCredentials = NonNullable<
  Awaited<ReturnType<typeof getDataSourceWithCredentials>>
>;

/**
 * Memoizacao com escopo de UMA requisicao de chat: um loop agentico dispara
 * varias chamadas de query_dataset para as mesmas fontes, e sem isso cada tool
 * call repete as mesmas leituras Firestore (metadata, auth, viewer scope e o
 * doc com credenciais). As entradas sao promises para dedupar chamadas
 * concorrentes; rejeicoes sao removidas do map para nao envenenar a sessao.
 */
export interface QuerySession {
  dsMeta: Map<string, Promise<DataSourceMetadata | null>>;
  auth: Map<string, Promise<QueryAuthorization>>;
  viewerScope: Map<string, Promise<ViewerScope>>;
  credDoc: Map<string, Promise<DataSourceDocWithCredentials>>;
}

export function createQuerySession(): QuerySession {
  return {
    dsMeta: new Map(),
    auth: new Map(),
    viewerScope: new Map(),
    credDoc: new Map(),
  };
}

function memo<K, V>(
  map: Map<K, Promise<V>>,
  key: K,
  compute: () => Promise<V>,
): Promise<V> {
  const hit = map.get(key);
  if (hit) return hit;
  const promise = compute();
  map.set(key, promise);
  promise.catch(() => {
    if (map.get(key) === promise) map.delete(key);
  });
  return promise;
}

export interface QueryDatasetDeps {
  /**
   * Leitura do CSV da fonte. Em producao usa o fluxo GCS com loader lazy
   * (resolveCsvSource). Em testes, injeta um stub para nao tocar o GCS real.
   */
  readCsv?: (dsMeta: DataSourceMetadata) => Promise<ReadCsvResult>;
  /**
   * Sessao por requisicao para dedupar leituras Firestore entre tool calls.
   * O caller (rota data-chat) pode semear dsMeta/auth ja resolvidos.
   */
  session?: QuerySession;
}

// === Caches modulo (sobrevivem entre requisicoes na mesma instancia) ===

// Credencial descriptografada: o SecretService tem TTL interno, mas era
// instanciado a cada query e o cache nunca acertava. A chave inclui o hash do
// blob criptografado, entao rotacao de credencial invalida sozinha.
const CREDENTIAL_CACHE_TTL_MS = 5 * 60 * 1000;
const credentialCache = new Map<string, { expiresAt: number; value: object }>();

// Metadata do objeto CSV (nome + md5) por fonte: permite pular ate o list()
// do GCS em queries repetidas. Janela de staleness limitada pelo TTL curto;
// trocas de config invalidam via configVersion na chave.
const DEFAULT_CSV_META_TTL_MS = 45_000;
const csvMetaCache = new Map<
  string,
  { expiresAt: number; objectName: string; etag: string }
>();

function resolveCsvMetaTtlMs(): number {
  const envValue = Number(process.env.TWD_CSV_META_TTL_MS);
  if (Number.isFinite(envValue) && envValue >= 0) return Math.floor(envValue);
  return DEFAULT_CSV_META_TTL_MS;
}

export function __queryCacheReset(): void {
  credentialCache.clear();
  csvMetaCache.clear();
}

/**
 * Tool query_dataset: recebe SQL (ja convertido de NL pelo modelo antes) e
 * executa sobre a VIEW filtrada por viewer, respeitando os guards de acesso
 * (P1.4) e o row-scope (P1.6). Nunca retorna a tabela bruta.
 */
export async function queryDataset(
  args: { uid: string; dataSourceId: string; sql: string },
  deps: QueryDatasetDeps = {},
): Promise<QueryDatasetResult> {
  if (args.sql.length > 50_000) {
    throw new QueryDatasetInvalidInputError("query muito longa (max 50000 caracteres)");
  }

  const session = deps.session;
  const dsMeta = await (session
    ? memo(session.dsMeta, args.dataSourceId, () => getDataSource(args.dataSourceId))
    : getDataSource(args.dataSourceId));
  if (!dsMeta) {
    throw new DataSourceNotFoundError(args.dataSourceId);
  }
  const ds = dataSourceToRuntime(dsMeta);

  const authKey = `${args.uid}:${args.dataSourceId}`;
  const auth = await (session
    ? memo(session.auth, authKey, () => canQueryDataSource(args.uid, ds))
    : canQueryDataSource(args.uid, ds));
  if (!auth.canQuery) {
    throw new QueryDatasetAccessDeniedError(args.dataSourceId);
  }

  const viewerScope = await (session
    ? memo(session.viewerScope, authKey, () => resolveViewerScope(args.uid, ds))
    : resolveViewerScope(args.uid, ds));

  let etag: string;
  let loadCsv: () => Promise<Buffer>;
  if (deps.readCsv) {
    const read = await deps.readCsv(dsMeta);
    etag = read.etag;
    loadCsv = async () => read.csvBuffer;
  } else {
    ({ etag, loadCsv } = await resolveCsvSource(args.dataSourceId, dsMeta, session));
  }

  const engine = await loadSource({
    source: ds,
    loadCsv,
    viewerScope,
    etag,
    configVersion: dsMeta.configVersion,
  });

  // Substitui a referencia de tabela `view` (convencao do prompt) pelo
  // viewName interno determinístico ANTES de rodar. So troca na clausula FROM
  // (inclui JOIN e join implicito por virgula). Para nao corromper strings,
  // dollar-quoted strings nem comentarios, protegemos esses trechos em
  // placeholders, aplicamos o replace e restauramos. O guardSql ainda valida a
  // viewName real, entao nao ha vazamento mesmo em casos nao cobertos.
  const SQL_PROTECTED_RE = /\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$|'([^']|'')*'|"([^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g;
  const protectedSegments: string[] = [];
  const sqlWithPlaceholders = args.sql.replace(
    SQL_PROTECTED_RE,
    (m) => `\u0000${protectedSegments.push(m) - 1}\u0000`,
  );
  const guardedSql = rewriteViewReferences(sqlWithPlaceholders, engine.viewName)
    .replace(/\u0000(\d+)\u0000/g, (_, i) => protectedSegments[Number(i)]);
  const result = await engine.run(guardedSql);
  return {
    columns: result.columns,
    rows: result.rows,
    truncated: result.truncated,
  };
}

function rewriteViewReferences(sql: string, viewName: string): string {
  const clauseBoundary = /\b(where|group\s+by|having|order\s+by|limit|offset|union|intersect|except)\b/gi;
  return sql.replace(/\bfrom\b[\s\S]*?(?=\bwhere\b|\bgroup\s+by\b|\bhaving\b|\border\s+by\b|\blimit\b|\boffset\b|\bunion\b|\bintersect\b|\bexcept\b|$)/gi, (fromClause) => {
    // Reset regex state for each clause because clauseBoundary is global.
    clauseBoundary.lastIndex = 0;
    return fromClause.replace(/\bview\b/gi, viewName);
  });
}

/**
 * Leitura real do CSV da fonte por id: busca primeiro metadata SEM credenciais,
 * valida autorizacao (P1.4) e so entao busca o doc server-only com credentialEnc.
 * A dupla leitura Firestore e intencional: evita carregar credentialRef/credentialEnc
 * antes de canQueryDataSource, que e o invariante de seguranca mais forte.
 * Exportada para testes/APIs externas, mas OBRIGATORIAMENTE passa por
 * canQueryDataSource antes de ler.
 */
export async function readDataSourceCsvById(
  uid: string,
  dataSourceId: string,
): Promise<ReadCsvResult> {
  const dsMeta = await getDataSource(dataSourceId);
  if (!dsMeta) {
    throw new DataSourceNotFoundError(dataSourceId);
  }
  const ds = dataSourceToRuntime(dsMeta);
  const auth = await canQueryDataSource(uid, ds);
  if (!auth.canQuery) {
    throw new QueryDatasetAccessDeniedError(dataSourceId);
  }
  return readDataSourceCsv(
    await getAuthorizedDataSourceWithCredentials(dataSourceId),
    dsMeta,
  );
}

async function getAuthorizedDataSourceWithCredentials(dataSourceId: string) {
  const doc = await getDataSourceWithCredentials(dataSourceId);
  if (!doc) {
    // A metadata ja foi encontrada antes da checagem de autorizacao. Se o doc
    // com credenciais desapareceu entre as leituras, trate como 404 sem vazar
    // detalhe operacional.
    throw new DataSourceNotFoundError(dataSourceId);
  }
  return doc;
}

/**
 * Resolve o client GCS da fonte a partir do doc server-only: valida o
 * credentialRef, descriptografa (com cache TTL modulo) e reutiliza o client
 * cacheado por bucket+credencial. As credenciais nunca saem deste modulo.
 */
async function storageForDoc(
  doc: DataSourceDocWithCredentials,
  sourceId: string,
): Promise<ExternalBucketStorage> {
  // O blob criptografado (credentialEnc, AES-GCM em base64) ja veio no
  // documento server-only. O secretManager ainda nao esta implementado
  // (SecretService.resolve lanca), entao bloqueamos cedo se o ref for desse
  // kind.
  const credentialRef = doc.credentialRef;
  if (
    !credentialRef ||
    typeof credentialRef !== "object" ||
    typeof credentialRef.kind !== "string" ||
    typeof credentialRef.ref !== "string" ||
    credentialRef.ref.trim() === ""
  ) {
    throw new DataSourceUnavailableError(
      `Fonte ${sourceId} sem credentialRef valido`,
    );
  }
  if (credentialRef.kind === "secretManager") {
    throw new DataSourceUnavailableError(
      `credentialRef secretManager ainda nao suportado para ${sourceId}`,
    );
  }
  if (!doc.credentialEnc) {
    throw new DataSourceUnavailableError(
      `Fonte ${sourceId} sem credentialEnc configurado`,
    );
  }

  try {
    const credentials = await resolveCredentialsCached(
      credentialRef,
      doc.credentialEnc,
    );
    return getCachedGcsStorage({
      bucketName: doc.bucket,
      credentials,
    });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) throw error;
    throw new DataSourceUnavailableError(
      `Fonte ${sourceId} indisponivel para leitura do CSV`,
    );
  }
}

async function resolveCredentialsCached(
  credentialRef: CredentialRef,
  credentialEnc: string,
): Promise<object> {
  const cacheKey = `${credentialRef.ref}:${createHash("sha256").update(credentialEnc).digest("hex")}`;
  const cached = credentialCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const secretService = new SecretService({
    loadEncryptedBlob: async (ref: string) => {
      if (ref !== credentialRef.ref) {
        throw new Error(`credentialRef ${ref} nao corresponde a fonte`);
      }
      return Buffer.from(credentialEnc, "base64");
    },
  });
  const value = await secretService.resolve(credentialRef);
  credentialCache.set(cacheKey, {
    expiresAt: now + CREDENTIAL_CACHE_TTL_MS,
    value,
  });
  return value;
}

function findCsvObject(
  objects: { name: string; md5Hash: string }[],
  prefix: string,
): { name: string; md5Hash: string } {
  const csvObject = objects.find((o) =>
    String(o.name).toLowerCase().endsWith(".csv"),
  );
  if (!csvObject) {
    throw new DataSourceUnavailableError(
      `Nenhum objeto CSV encontrado em ${prefix}`,
    );
  }
  return csvObject;
}

/**
 * Resolve o etag do CSV SEM baixar o conteudo: o list() do GCS ja retorna o
 * md5Hash do objeto, entao o download vira um loader lazy que o engine so
 * invoca em cache miss. Em metadata-cache hit (TTL curto) ate o list() e
 * evitado, e o doc com credenciais so e lido se o download for necessario.
 */
async function resolveCsvSource(
  dataSourceId: string,
  dsMeta: DataSourceMetadata,
  session: QuerySession | undefined,
): Promise<{ etag: string; loadCsv: () => Promise<Buffer> }> {
  const getDoc = (): Promise<DataSourceDocWithCredentials> =>
    session
      ? memo(session.credDoc, dataSourceId, () =>
          getAuthorizedDataSourceWithCredentials(dataSourceId),
        )
      : getAuthorizedDataSourceWithCredentials(dataSourceId);

  const downloadByName = async (objectName: string): Promise<Buffer> => {
    const storage = await storageForDoc(await getDoc(), dataSourceId);
    try {
      const { content } = await storage.readByKey(objectName);
      return content;
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      throw new DataSourceUnavailableError(
        `Fonte ${dataSourceId} indisponivel para leitura do CSV`,
      );
    }
  };

  const metaKey = `${dataSourceId}:${dsMeta.configVersion}`;
  const cachedMeta = csvMetaCache.get(metaKey);
  if (cachedMeta && cachedMeta.expiresAt > Date.now()) {
    return {
      etag: cachedMeta.etag,
      loadCsv: () => downloadByName(cachedMeta.objectName),
    };
  }

  const doc = await getDoc();
  const storage = await storageForDoc(doc, dataSourceId);

  let csvObject: { name: string; md5Hash: string };
  try {
    const listed = await storage.list(doc.prefix);
    csvObject = findCsvObject(listed.objects, doc.prefix);
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) throw error;
    throw new DataSourceUnavailableError(
      `Fonte ${dataSourceId} indisponivel para leitura do CSV`,
    );
  }

  if (csvObject.md5Hash) {
    csvMetaCache.set(metaKey, {
      expiresAt: Date.now() + resolveCsvMetaTtlMs(),
      objectName: csvObject.name,
      etag: csvObject.md5Hash,
    });
    return {
      etag: csvObject.md5Hash,
      loadCsv: () => downloadByName(csvObject.name),
    };
  }

  // Fallback: objetos sem md5Hash (ex.: composite objects) nao permitem saber
  // o etag antes do download; baixamos ja e derivamos o etag do resultado.
  try {
    const { content, md5Hash } = await storage.readByKey(csvObject.name);
    return {
      etag: md5Hash || "",
      loadCsv: async () => content,
    };
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) throw error;
    throw new DataSourceUnavailableError(
      `Fonte ${dataSourceId} indisponivel para leitura do CSV`,
    );
  }
}

/**
 * Leitura eager do CSV da fonte: recebe o doc (com credentialEnc) ja obtido
 * pelo caller. Funcao interna (nao exportada) para forcar acesso via camada
 * de autorizacao (P3 E4/Kimi). Usada por readDataSourceCsvById, que precisa
 * do buffer completo.
 */
async function readDataSourceCsv(
  doc: DataSourceDocWithCredentials,
  dsMeta: DataSourceMetadata,
): Promise<ReadCsvResult> {
  if (!doc) {
    throw new DataSourceUnavailableError(`Fonte indisponivel: ${dsMeta.id}`);
  }

  const storage = await storageForDoc(doc, dsMeta.id);

  try {
    const listed = await storage.list(doc.prefix);
    const csvObject = findCsvObject(listed.objects, doc.prefix);
    const { content, md5Hash } = await storage.readByKey(csvObject.name);
    return {
      csvBuffer: content,
      etag: md5Hash || csvObject.md5Hash || "",
    };
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) throw error;
    throw new DataSourceUnavailableError(
      `Fonte ${dsMeta.id} indisponivel para leitura do CSV`,
    );
  }
}
