import { useState, useEffect } from "react";
import { getProviders, addProvider, removeProvider } from "../api/client";
import type { ProviderResponse } from "../types";

export function Settings() {
  const [providers, setProviders] = useState<ProviderResponse[]>([]);
  const [provider, setProvider] = useState("anthropic");
  const [displayName, setDisplayName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    try {
      await addProvider({
        provider,
        display_name: displayName || provider,
        api_key: apiKey,
        org_id: orgId || undefined,
      });
      setApiKey("");
      setDisplayName("");
      setOrgId("");
      setError(null);
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
      <section className="settings-section">
        <h2>Add Provider</h2>
        {error && <p className="error">⚠️ {error}</p>}
        <div className="form">
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="zai">Z.AI</option>
            <option value="ollama">Ollama</option>
          </select>
          <input
            placeholder="Display name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <input
            type="password"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <input
            placeholder="Org ID (Anthropic admin only)"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          />
          <button onClick={handleAdd}>Connect</button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Connected Providers</h2>
        {providers.length === 0 ? (
          <p className="muted">No providers connected.</p>
        ) : (
          <ul className="provider-list">
            {providers.map((p) => (
              <li key={p.id}>
                <span>{p.display_name}</span>
                <span className="muted">({p.provider})</span>
                <button onClick={() => handleRemove(p.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
