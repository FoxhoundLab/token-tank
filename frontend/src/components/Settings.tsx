import { useState, useEffect } from "react";
import { getProviders, addProvider, removeProvider } from "../api/client";
import type { ProviderResponse } from "../types";

interface ProviderOption {
  id: string;
  name: string;
  icon: string;
  needsKey: boolean;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: "anthropic", name: "Anthropic", icon: "🤖", needsKey: true },
  { id: "minimax", name: "MiniMax", icon: "⚡", needsKey: true },
  { id: "zai", name: "Z.AI", icon: "🔮", needsKey: true },
  { id: "ollama", name: "Ollama Pro", icon: "🦙", needsKey: false },
  { id: "lmstudio", name: "LM Studio", icon: "💻", needsKey: false },
];

export function Settings() {
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
      setSuccess(`${selectedProvider.name} connected!`);
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
      {/* Provider Picker */}
      <section className="settings-section">
        <h2>Connect a Provider</h2>
        {error && <p className="error">⚠️ {error}</p>}
        {success && <p style={{ color: "var(--accent-green)", marginBottom: "0.5rem" }}>✅ {success}</p>}

        {!selectedProvider ? (
          <div className="provider-picker">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className="provider-tile"
                onClick={() => setSelectedProvider(opt)}
              >
                <span className="provider-tile-icon">{opt.icon}</span>
                <span className="provider-tile-name">{opt.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="form">
            <div className="form-header">
              <span className="provider-tile-icon">{selectedProvider.icon}</span>
              <span>{selectedProvider.name}</span>
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
                placeholder="API Key (encrypted at rest)"
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
        <h2>Connected Providers</h2>
        {providers.length === 0 ? (
          <p className="muted">No providers connected yet.</p>
        ) : (
          <ul className="provider-list">
            {providers.map((p) => (
              <li key={p.id}>
                <span className="provider-name">{p.display_name}</span>
                <span className="muted">({p.provider})</span>
                {p.org_id && <span className="muted">· Org: {p.org_id}</span>}
                <button onClick={() => handleRemove(p.id)}>Disconnect</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Proxy Config */}
      <section className="settings-section">
        <h2>Proxy Configuration</h2>
        <div className="config-grid">
          <div className="config-item">
            <span className="config-label">Proxy URL</span>
            <span className="config-value">http://localhost:8848</span>
          </div>
          <div className="config-item">
            <span className="config-label">Auto-start</span>
            <span className="config-value">Manual (run scripts/run_proxy.sh)</span>
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
        <h2>🔒 Privacy & Security</h2>
        <div className="config-grid">
          <div className="config-item">
            <span className="config-label">API key encryption</span>
            <span className="config-value" style={{ color: "var(--accent-green)" }}>
              ✅ Fernet AES-128 at rest
            </span>
          </div>
          <div className="config-item">
            <span className="config-label">Content logging</span>
            <span className="config-value">Token counts only — no prompts/responses stored</span>
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
