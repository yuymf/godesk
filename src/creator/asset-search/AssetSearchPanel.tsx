import { useEffect, useState, type FormEvent } from "react";
import {
  downloadImportedAssetBytes,
  getAssetServerConfig,
  getImportedAssets,
  importExternalAsset,
  searchExternalAssets,
} from "../project-api";
import { bytesToBase64 } from "./client";
import {
  isLinkOnlyAsset,
  importEligibility,
  importedAssetFolder,
  todayUtcDate,
} from "./licenses";
import {
  PREFERRED_PROVIDERS,
  SEARCH_TYPES,
  providerLabel,
} from "./config";
import type { AssetSearchResponse, AssetServerAsset, ImportedProjectAsset } from "./types";
import "./AssetSearchPanel.css";

export interface AssetSearchPanelProps {
  projectId: string;
  expectedVersion: number;
  disabled?: boolean;
  onImported?: () => void;
}

export default function AssetSearchPanel({
  projectId,
  expectedVersion,
  disabled,
  onImported,
}: AssetSearchPanelProps) {
  const [query, setQuery] = useState("trees");
  const [type, setType] = useState("model");
  const [freeOnly, setFreeOnly] = useState(true);
  const [downloadableOnly, setDownloadableOnly] = useState(true);
  const [preferredOnly, setPreferredOnly] = useState(true);
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8787");
  const [busy, setBusy] = useState(false);
  const [importingId, setImportingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [response, setResponse] = useState<AssetSearchResponse>();
  const [imported, setImported] = useState<ImportedProjectAsset[]>([]);

  useEffect(() => {
    getAssetServerConfig()
      .then((config) => setBaseUrl(config.baseUrl))
      .catch(() => undefined);
    getImportedAssets(projectId)
      .then((view) => setImported(view.assets))
      .catch(() => undefined);
  }, [projectId]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await searchExternalAssets({
        q: query,
        type: type || undefined,
        providers: preferredOnly ? [...PREFERRED_PROVIDERS] : undefined,
        free: freeOnly || undefined,
        downloadable: downloadableOnly || undefined,
        limit: 24,
      });
      setResponse(next);
      if (next.results.length === 0) {
        setNotice("没有匹配的资产。可关掉「仅可直接下载」查看仅外链来源。");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "资产搜索失败。");
    } finally {
      setBusy(false);
    }
  }

  async function joinProject(asset: AssetServerAsset) {
    const eligibility = importEligibility(asset);
    if (!eligibility.ok) {
      setError(eligibility.reason);
      return;
    }
    setImportingId(asset.id);
    setError("");
    setNotice("");
    try {
      const downloaded = await downloadImportedAssetBytes(asset.id, {
        format: asset.type === "hdri" ? "hdr" : "glb",
        resolution: "1k",
      });
      const bytes = new Uint8Array(downloaded.bytes);
      const filename = downloaded.filename.replace(/[^A-Za-z0-9._-]+/g, "-") || "asset.bin";
      const relativePath = `${importedAssetFolder(asset)}/${filename}`;
      const result = await importExternalAsset(projectId, {
        expectedVersion,
        idempotencyKey: `import-${asset.id}-${todayUtcDate()}`,
        asset,
        files: [{
          relativePath,
          contentBase64: bytesToBase64(bytes),
          mimeType: downloaded.mimeType,
          bytes: bytes.byteLength,
        }],
      });
      setImported(result.importedAssets);
      setNotice(`已加入项目：${asset.title}（${eligibility.license.spdx}）`);
      onImported?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加入项目失败。");
    } finally {
      setImportingId("");
    }
  }

  return (
    <section className="asset-search-panel" id="asset-search">
      <header className="studio-section-heading">
        <div>
          <h2>资产搜索</h2>
          <p>
            自然语言检索模型 / 材质 / HDRI。默认只查免费可直链来源（Poly Haven、ambientCG、Kenney、TextureCan、BlenderKit 免费、HDRMaps 免费）。
            服务：<code>{baseUrl}</code>
          </p>
        </div>
      </header>

      <form className="asset-search-form" onSubmit={search} role="search">
        <label htmlFor="asset-search-q">
          <span>搜索模型、材质或 HDRI</span>
          <input
            id="asset-search-q"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="例如：trees、mossy rock、sunset"
            value={query}
          />
        </label>
        <label htmlFor="asset-search-type">
          <span>类型</span>
          <select
            id="asset-search-type"
            onChange={(event) => setType(event.currentTarget.value)}
            value={type}
          >
            {SEARCH_TYPES.map((option) => (
              <option key={option.id || "all"} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <fieldset className="asset-search-filters">
          <legend>筛选</legend>
          <label>
            <input
              checked={freeOnly}
              onChange={(event) => setFreeOnly(event.currentTarget.checked)}
              type="checkbox"
            />
            仅免费
          </label>
          <label>
            <input
              checked={downloadableOnly}
              onChange={(event) => setDownloadableOnly(event.currentTarget.checked)}
              type="checkbox"
            />
            可直接下载
          </label>
          <label>
            <input
              checked={preferredOnly}
              onChange={(event) => setPreferredOnly(event.currentTarget.checked)}
              type="checkbox"
            />
            优先免费直链源
          </label>
        </fieldset>
        <button disabled={busy || disabled || !query.trim()} type="submit">
          {busy ? "正在搜索…" : "搜索"}
        </button>
      </form>

      {error && <p className="creator-error" role="alert">{error}</p>}
      {notice && <p className="creator-notice" role="status">{notice}</p>}

      {imported.length > 0 && (
        <p className="asset-search-imported" role="status">
          本项目已导入 {imported.length} 个外部资产，许可证见来源库 <code>assets/LICENSES.md</code>。
        </p>
      )}

      {response && (
        <ul className="asset-search-results">
          {response.results.map((asset) => {
            const linkOnly = isLinkOnlyAsset(asset);
            const eligibility = importEligibility(asset);
            const already = imported.some((item) => item.assetServerId === asset.id);
            return (
              <li className="asset-search-card" key={asset.id}>
                {asset.thumbnailUrl ? (
                  <img alt="" src={asset.thumbnailUrl} />
                ) : (
                  <div className="asset-search-thumb-fallback" aria-hidden="true" />
                )}
                <div>
                  <strong>{asset.title}</strong>
                  <p>
                    {providerLabel(asset.provider)}
                    {asset.author ? ` · ${asset.author}` : ""}
                    {asset.type ? ` · ${asset.type}` : ""}
                  </p>
                  <p>
                    许可证：{asset.license?.name ?? "未标明"}
                    {asset.license?.attributionRequired ? " · 需署名" : " · 无需署名"}
                    {asset.price?.free === false ? " · 付费" : " · 免费"}
                  </p>
                  <div className="asset-search-badges">
                    {linkOnly && <span className="asset-search-badge">仅外链</span>}
                    {asset.license?.attributionRequired && (
                      <span className="asset-search-badge">需署名</span>
                    )}
                    {already && <span className="asset-search-badge">已在项目中</span>}
                  </div>
                  <div className="asset-search-actions">
                    {asset.url && (
                      <a href={asset.url} rel="noreferrer" target="_blank">打开来源</a>
                    )}
                    {linkOnly || !eligibility.ok ? (
                      <span className="asset-search-hint">
                        {eligibility.ok ? "仅外链，不能写入项目" : eligibility.reason}
                      </span>
                    ) : (
                      <button
                        disabled={disabled || Boolean(importingId)}
                        onClick={() => void joinProject(asset)}
                        type="button"
                      >
                        {importingId === asset.id ? "正在加入…" : "加入项目"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
