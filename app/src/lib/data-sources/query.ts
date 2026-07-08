import {
  getDataSource,
  getDataSourceWithCredentials,
  type DataSourceMetadata,
} from "@/lib/data-sources/firestore";
import { canQueryDataSource, resolveViewerScope } from "@/lib/data-sources/access";
import { loadSource } from "@/lib/data-sources/duckdb-engine";
import { createGcsStorage } from "@/lib/data-sources/storage";
import { SecretService } from "@/lib/data-sources/credentials";
import {
  DataSourceNotFoundError,
  DataSourceUnavailableError,
  QueryDatasetAccessDeniedError,
  QueryDatasetInvalidInputError,
} from "@/lib/data-sources/errors";
import type { DataSource } from "@/lib/data-sources/types";
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

export interface QueryDatasetDeps {
  /**
   * Leitura do CSV da fonte. Em producao usa readDataSourceCsv (GCS + credenciais
   * descriptografadas). Em testes, injeta um stub para nao tocar o GCS real.
   */
  readCsv?: (dsMeta: DataSourceMetadata) => Promise<ReadCsvResult>;
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

  const dsMeta = await getDataSource(args.dataSourceId);
  if (!dsMeta) {
    throw new DataSourceNotFoundError(args.dataSourceId);
  }
  const ds = dataSourceToRuntime(dsMeta);

  const auth = await canQueryDataSource(args.uid, ds);
  if (!auth.canQuery) {
    throw new QueryDatasetAccessDeniedError(args.dataSourceId);
  }

  const viewerScope = await resolveViewerScope(args.uid, ds);
  const { csvBuffer, etag } = deps.readCsv
    ? await deps.readCsv(dsMeta)
    : await readDataSourceCsv(
        await getAuthorizedDataSourceWithCredentials(args.dataSourceId),
        dsMeta,
      );

  const engine = await loadSource({
    source: ds,
    csvBuffer,
    viewerScope,
    etag,
    configVersion: dsMeta.configVersion,
  });

  // Substitui a referencia de tabela `view` (convencao do prompt) pelo
  // viewName interno determinístico ANTES de rodar. So troca em contexto de
  // tabela (apos FROM/JOIN). Para nao corromper strings literais (ex.:
  // 'from view') nem dollar-quoted strings DuckDB/Postgres (ex.:
  // $$from view$$), protegemos literais em placeholders, aplicamos o replace
  // e restauramos. O guardSql ainda valida a viewName real, entao nao ha
  // vazamento mesmo em casos nao cobertos (join implicito por virgula).
  const SQL_STRING_RE = /\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$|'([^']|'')*'|"([^"]|"")*"/g;
  const protectedStrings: string[] = [];
  const sqlWithPlaceholders = args.sql.replace(
    SQL_STRING_RE,
    (m) => `\u0000${protectedStrings.push(m) - 1}\u0000`,
  );
  const guardedSql = sqlWithPlaceholders
    .replace(/\b(?:from|join)\s+view\b/gi, (match) =>
      match.replace(/\bview\b/i, engine.viewName),
    )
    .replace(/\u0000(\d+)\u0000/g, (_, i) => protectedStrings[Number(i)]);
  const result = await engine.run(guardedSql);
  return {
    columns: result.columns,
    rows: result.rows,
    truncated: result.truncated,
  };
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
 * Leitura real do CSV da fonte: recebe o doc (com credentialEnc) ja obtido
 * pelo caller e resolve a credencial GCS (AES-GCM) lendo o primeiro .csv do
 * prefixo. Funcao interna (nao exportada) para forcar acesso via camada de
 * autorizacao (P3 E4/Kimi).
 */
async function readDataSourceCsv(
  doc: NonNullable<Awaited<ReturnType<typeof getDataSourceWithCredentials>>>,
  dsMeta: DataSourceMetadata,
): Promise<ReadCsvResult> {
  if (!doc) {
    throw new DataSourceUnavailableError(`Fonte indisponivel: ${dsMeta.id}`);
  }

  // O blob criptografado (credentialEnc, AES-GCM em base64) ja veio no
  // documento server-only; conectamos um loader in-memory que resolve o
  // ref ao blob, em vez do loader default (que lanca "not implemented").
  // Assim o fluxo de producao descriptografa a credencial GCS de ponta a
  // ponta. O secretManager ainda nao esta implementado (SecretService.resolve
  // lanca), entao bloqueamos cedo se o ref for desse kind.
  const credentialRef = doc.credentialRef;
  if (
    !credentialRef ||
    typeof credentialRef !== "object" ||
    typeof credentialRef.kind !== "string" ||
    typeof credentialRef.ref !== "string" ||
    credentialRef.ref.trim() === ""
  ) {
    throw new DataSourceUnavailableError(
      `Fonte ${dsMeta.id} sem credentialRef valido`,
    );
  }
  if (credentialRef.kind === "secretManager") {
    throw new DataSourceUnavailableError(
      `credentialRef secretManager ainda nao suportado para ${dsMeta.id}`,
    );
  }
  if (!doc.credentialEnc) {
    throw new DataSourceUnavailableError(
      `Fonte ${dsMeta.id} sem credentialEnc configurado`,
    );
  }

  try {
    const secretService = new SecretService({
      loadEncryptedBlob: async (ref: string) => {
        if (ref !== credentialRef.ref) {
          throw new Error(`credentialRef ${ref} nao corresponde a fonte`);
        }
        return Buffer.from(doc.credentialEnc as string, "base64");
      },
    });
    const credentials = await secretService.resolve(credentialRef);
    const storage = createGcsStorage({
      bucketName: doc.bucket,
      credentials,
    });

    const listed = await storage.list(doc.prefix);
    const csvObject = listed.objects.find((o) =>
      String(o.name).toLowerCase().endsWith(".csv"),
    );
    if (!csvObject) {
      throw new DataSourceUnavailableError(
        `Nenhum objeto CSV encontrado em ${doc.prefix}`,
      );
    }

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
