export enum DataSourceKind {
  CSV = "csv",
}

export interface DataSourceAccessGrants {
  assignedUsers: string[];
  assignedDepartments: string[];
}

export interface DataSource {
  id: string;
  kind: DataSourceKind;
  orgId: string;
  configVersion: number;
  // Coluna que identifica o dono da linha nesta fonte. É a fonte de verdade
  // para o filtro de linha (P1.4/P1.6) e NÃO é o access grant (grants chegam
  // em P1.3 via Firestore). Mantido aqui para que o registry o disponibilize
  // no lookup.
  ownerColumn?: string;
  accessGrants?: DataSourceAccessGrants;
  ownerColumnIdentity?: "email" | "uid";
}

export interface ViewerScope {
  ownerKeys: string[];
}

export interface QueryAuthorization {
  canQuery: boolean;
}
