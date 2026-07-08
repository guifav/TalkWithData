import type { DataSource } from "@/lib/data-sources/types";

export class DataSourceAlreadyRegisteredError extends Error {
  constructor(dataSourceId: string) {
    super(`Data source already registered: ${dataSourceId}`);
    this.name = "DataSourceAlreadyRegisteredError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DataSourceNotFoundError extends Error {
  constructor(dataSourceId: string) {
    super(`Data source not found: ${dataSourceId}`);
    this.name = "DataSourceNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

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
