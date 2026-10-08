export type AssetServerType =
  | "model"
  | "texture"
  | "material"
  | "hdri"
  | "sprite"
  | "ui"
  | "audio"
  | "font"
  | "pack"
  | "other";

export interface AssetLicense {
  name: string;
  url?: string;
  commercialUse?: boolean;
  attributionRequired?: boolean;
}

export interface AssetPrice {
  free: boolean;
  amount?: number;
  currency?: string;
}

export interface AssetServerAsset {
  id: string;
  provider: string;
  nativeId: string;
  title: string;
  description?: string;
  type: AssetServerType | string;
  tags: string[];
  categories?: string[];
  url: string;
  thumbnailUrl?: string;
  author?: string;
  license?: AssetLicense;
  price?: AssetPrice;
  formats?: string[];
  resolutions?: string[];
  polyCount?: number;
  downloadable: boolean;
  score?: number;
}

export interface AssetProviderReport {
  provider: string;
  name: string;
  status: "ok" | "error" | "timeout" | "skipped" | "link" | string;
  count: number;
  tookMs: number;
  searchUrl?: string;
  error?: string;
  total?: number;
}

export interface AssetSearchResponse {
  query: string;
  types?: string[];
  results: AssetServerAsset[];
  providers: AssetProviderReport[];
}

export interface AssetSearchQuery {
  q: string;
  type?: string;
  providers?: string[];
  free?: boolean;
  downloadable?: boolean;
  limit?: number;
  offset?: number;
}

export interface ImportedAssetFile {
  relativePath: string;
  contentBase64: string;
  mimeType: string;
  bytes: number;
}

export interface ImportedProjectAsset {
  id: string;
  assetServerId: string;
  title: string;
  provider: string;
  path: string;
  bytes: number;
  mimeType: string;
  licenseSpdx: string;
  licenseName: string;
  attributionRequired: boolean;
  sourceUrl: string;
  author: string;
  createdAt: string;
}

export interface ImportedAssetsView {
  assets: ImportedProjectAsset[];
  licensesMarkdown: string;
}

export interface ImportExternalAssetInput {
  expectedVersion: number;
  idempotencyKey: string;
  asset: AssetServerAsset;
  files?: ImportedAssetFile[];
  format?: string;
  resolution?: string;
}

export interface ImportExternalAssetResult {
  projectId: string;
  version: number;
  importedAssets: ImportedProjectAsset[];
  licensesMarkdown: string;
  studioUrl: string;
}

export interface AssetServerConfig {
  baseUrl: string;
}
