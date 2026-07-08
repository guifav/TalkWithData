/**
 * Erros compartilhados da camada de Data Sources (P1.4-P1.7).
 * Modulo isolado para evitar ciclo de importes entre duckdb-engine e query.
 */
import { DuckDbSandboxError } from "@/lib/data-sources/duckdb-sandbox";

export class QueryDatasetAccessDeniedError extends Error {
  readonly status = 403;

  constructor(dataSourceId: string) {
    super(`Acesso negado a fonte de dados: ${dataSourceId}`);
    this.name = "QueryDatasetAccessDeniedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DataSourceNotFoundError extends Error {
  readonly status = 404;

  constructor(dataSourceId: string) {
    super(`Fonte de dados nao encontrada: ${dataSourceId}`);
    this.name = "DataSourceNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DataSourceUnavailableError extends Error {
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = "DataSourceUnavailableError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class QueryDatasetInvalidInputError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "QueryDatasetInvalidInputError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Mapeia erros internos para mensagens publicas seguras (sem vazar storage
 * paths, emails de owner, stack traces ou detalhes operacionais).
 */
export function publicErrorMessage(err: unknown): string {
  if (err instanceof QueryDatasetAccessDeniedError)
    return "You do not have access to this data source.";
  if (err instanceof DataSourceNotFoundError) return "Data source not found.";
  if (err instanceof DataSourceUnavailableError)
    return "Data source temporarily unavailable.";
  if (err instanceof QueryDatasetInvalidInputError)
    return "Invalid query input.";
  if (err instanceof DuckDbSandboxError) return "Invalid query.";
  return "Query failed. Please try again.";
}

/**
 * Status HTTP publico para o erro (separado da mensagem para nao vazar
 * detalhes). SQL invalido/bloqueado pelo guard vira 400 (input do cliente);
 * erros de acesso/inexistencia mantem 403/404/503; o resto e 500.
 */
export function publicErrorStatus(err: unknown): number {
  if (err instanceof QueryDatasetAccessDeniedError) return 403;
  if (err instanceof DataSourceNotFoundError) return 404;
  if (err instanceof DataSourceUnavailableError) return 503;
  if (err instanceof DuckDbSandboxError) {
    // Guard blocks (input do cliente) -> 400. Erros de execucao/infra do
    // engine (timeout, memoria, falha interna) -> 500. Discriminamos por
    // mensagem: se menciona guard/SQL invalido, e input; caso contrario,
    // falha de execucao.
    const msg = err.message || "";
    if (/timeout/i.test(msg)) return 504;
    if (
      /(statement proibido|tabela (nao autorizada|ausente)|query (muito longa|invalida)|function scan|função bloqueada)/i.test(
        msg,
      )
    ) {
      return 400;
    }
    return 500;
  }
  if (err instanceof Error && "status" in err) {
    const s = (err as { status?: number }).status;
    if (typeof s === "number") return s;
  }
  return 500;
}
