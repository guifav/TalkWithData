import type { DataSource } from "@/lib/data-sources/types";

export class DataSourceAlreadyRegisteredError extends Error {
  constructor(dataSourceId: string) {
    super(`Fonte de dados já registrada: ${dataSourceId}`);
    this.name = "DataSourceAlreadyRegisteredError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DataSourceNotFoundError extends Error {
  constructor(dataSourceId: string) {
    super(`Fonte de dados não encontrada: ${dataSourceId}`);
    this.name = "DataSourceNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Registro em memória de fontes de dados de uma org. `id` é globalmente
// único (UUID da fonte no Firestore, P1.3): o Map usa `id` como chave, não
// par (orgId, id). `list(orgId)` filtra por org e ordena por `id` em ordem
// lexicográfica (ids são UUIDs, então sem ambiguidade de caixa). `register`
// não valida campos (delega a P1.3, que persiste no Firestore); apenas
// bloqueia id duplicado. `get` de id inexistente lança. Sem I/O:
// persistência/grants chegam em P1.3/P1.4.
export class DataSourceRegistry {
  private readonly sources = new Map<string, DataSource>();

  register(src: DataSource): void {
    if (this.sources.has(src.id)) {
      throw new DataSourceAlreadyRegisteredError(src.id);
    }

    this.sources.set(src.id, src);
  }

  get(id: string): DataSource {
    const source = this.sources.get(id);

    if (!source) {
      throw new DataSourceNotFoundError(id);
    }

    return source;
  }

  list(orgId: string): DataSource[] {
    return Array.from(this.sources.values())
      .filter((source) => source.orgId === orgId)
      .sort((first, second) => {
        if (first.id < second.id) return -1;
        if (first.id > second.id) return 1;
        return 0;
      });
  }
}
