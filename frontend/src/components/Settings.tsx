import { useState, useEffect } from "react";
import { getProviders, addProvider, removeProvider } from "../api/client";
import type { ProviderResponse } from "../types";
import { THEMES, THEME_META } from "../theme";
import type { ThemeName } from "../theme";

interface ProviderOption {
  id: string;
  name: string;
  needsKey: boolean;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: "anthropic", name: "Anthropic", needsKey: true },
  { id: "minimax", name: "MiniMax", needsKey: true },
  { id: "zai", name: "Z.AI", needsKey: true },
  { id: "ollama", name: "Ollama", needsKey: false },
  { id: "lmstudio", name: "LM Studio", needsKey: false },
];

interface SettingsProps {
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
}

export function Settings({ theme, onThemeChange }: SettingsProps) {
  const [providers, setProviders] = useState<ProviderResponse[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchProviders = async () => {
    try {
      setProviders(await getProviders());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load providers");
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleAdd = async () => {
    if (!selectedProvider) return;
    if (selectedProvider.needsKey && !apiKey) {
      setError("API key required for this provider");
      return;
    }
    try {
      await addProvider({
        provider: selectedProvider.id,
        display_name: displayName || selectedProvider.name,
        api_key: selectedProvider.needsKey ? apiKey : "",
        org_id: orgId || undefined,
      });
      setApiKey("");
      setDisplayName("");
      setOrgId("");
      setSelectedProvider(null);
      setError(null);
      setSuccess(`${selectedProvider.name} connected`);
      setTimeout(() => setSuccess(null), 3000);
      fetchProviders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add provider");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeProvider(id);
      fetchProviders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove provider");
    }
  };

  return (
    <div className="settings">
      {/* Theme */}
      <section className="settings-section">
        <h2 className="section-head">Theme</h2>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t}
              className={`theme-card ${theme === t ? "selected" : ""}`}
              data-theme={t}
              onClick={() => onThemeChange(t)}
              aria-pressed={theme === t}
            >
              <span className="theme-preview">
                <span className="theme-preview-panel">
                  <span className="theme-preview-accent" />
                  <span className="theme-preview-line" />
                  <span className="theme-preview-line short" />
                </span>
              </span>
              <span className="theme-card-name">{THEME_META[t].label}</span>
              <span className="theme-card-tag">{THEME_META[t].tagline}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Provider Picker */}
      <section className="settings-section">
        <h2 className="section-head">Connect a provider</h2>
        {error && <p className="form-msg form-error">{error}</p>}
        {success && <p className="form-msg form-ok">{success}</p>}

        {!selectedProvider ? (
          <div className="provider-picker">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className="provider-tile"
                onClick={() => setSelectedProvider(opt)}
              >
                <span className="provider-tile-name">{opt.name}</span>
                <span className="provider-tile-sub">{opt.needsKey ? "API key" : "No key"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="form">
            <div className="form-header">
              <span className="form-header-name">{selectedProvider.name}</span>
              <button
                className="btn-text"
                onClick={() => setSelectedProvider(null)}
              >Cancel</button>
            </div>
            <input
              placeholder={`Display name (default: ${selectedProvider.name})`}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            {selectedProvider.needsKey && (
              <input
                type="password"
                placeholder="API key (encrypted at rest)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            )}
            {selectedProvider.id === "anthropic" && (
              <input
                placeholder="Org ID (for billing API, optional)"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
              />
            )}
            <button className="btn-primary" onClick={handleAdd}>
              Connect {selectedProvider.name}
            </button>
          </div>
        )}
      </section>

      {/* Connected Providers */}
      <section className="settings-section">
        <h2 className="section-head">Connected providers</h2>
        {providers.length === 0 ? (
          <p className="muted">None connected.</p>
        ) : (
          <ul className="provider-list">
            {providers.map((p) => (
              <li key={p.id}>
                <span className="provider-name">{p.display_name}</span>
                <span className="type-badge">{p.provider_type}</span>
                <span className="muted mono">{p.provider}</span>
                {p.org_id && <span className="muted mono">org:{p.org_id}</span>}
                <button className="btn-danger" onClick={() => handleRemove(p.id)}>Disconnect</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Proxy Config */}
      <section className="settings-section">
        <h2 className="section-head">Proxy</h2>
        <div className="config-grid">
          <div className="config-item">
            <span className="config-label">Proxy URL</span>
            <span className="config-value">http://localhost:8848</span>
          </div>
          <div className="config-item">
            <span className="config-label">Launch</span>
            <span className="config-value">token-tank start</span>
          </div>
          <div className="config-item">
            <span className="config-label">Data retention</span>
            <span className="config-value">90 days</span>
          </div>
          <div className="config-item">
            <span className="config-label">Billing poll interval</span>
            <span className="config-value">5 minutes</span>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="settings-section">
        <h2 className="section-head">Privacy &amp; security</h2>
        <div className="config-grid">
          <div className="config-item">
            <span className="config-label">API key encryption</span>
            <span className="config-value ok">Fernet AES-128 at rest</span>
          </div>
          <div className="config-item">
            <span className="config-label">Content logging</span>
            <span className="config-value">Token counts only</span>
          </div>
          <div className="config-item">
            <span className="config-label">Telemetry</span>
            <span className="config-value">None — 100% local</span>
          </div>
        </div>
      </section>
    </div>
  );
}
