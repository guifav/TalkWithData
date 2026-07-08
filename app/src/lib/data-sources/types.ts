export enum DataSourceKind {
  CSV = "csv",
}

export interface DataSource {
  id: string;
  kind: DataSourceKind;
  orgId: string;
  configVersion: number;
  // Coluna que identifica o dono da linha nesta fonte. E a fonte de verdade
  // para o filtro de linha (P1.4/P1.6) e NAO e o access grant (grants chegam
  // em P1.3 via Firestore). Mantido aqui para o registry carrega-lo no lookup.
  ownerColumn?: string;
}
