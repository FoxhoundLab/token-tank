import { useState, useEffect } from "react";
import { getProviders, addProvider, removeProvider } from "../api/client";
import type { ProviderResponse, DashboardData } from "../types";
import { THEMES, THEME_META } from "../theme";
import type { ThemeName } from "../theme";

interface ProviderOption {
  id: string;
  name: string;
  needsKey: boolean;
  hint: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: "anthropic", name: "Anthropic", needsKey: true, hint: "api key" },
  { id: "openai", name: "OpenAI", needsKey: true, hint: "api key" },
  { id: "zai", name: "Z.AI", needsKey: true, hint: "api key" },
  { id: "minimax", name: "MiniMax", needsKey: true, hint: "api key" },
  { id: "ollama", name: "Ollama", needsKey: false, hint: "no key" },
  { id: "lmstudio", name: "LM Studio", needsKey: false, hint: "no key" },
];

type CellState = "live" | "registered" | "offline";

interface SettingsProps {
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  usage: DashboardData | null;
}

export function Settings({ theme, onThemeChange, usage }: SettingsProps) {
  const [providers, setProviders] = useState<ProviderResponse[]>([]);
  const [selected, setSelected] = useState<ProviderOption | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

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

  const registered = new Set(providers.map((p) => p.provider));
  const trafficked = new Set(
    (usage?.providers || []).filter((p) => p.today_tokens > 0).map((p) => p.provider),
  );

  const cellState = (id: string): CellState =>
    trafficked.has(id) && registered.has(id)
      ? "live"
      : registered.has(id)
        ? "registered"
        : "offline";

  const handleConnect = async () => {
    if (!selected) return;
    if (selected.needsKey && !apiKey) {
      setError("API key required for this provider");
      return;
    }
    setConnecting(true);
    try {
      await addProvider({
        provider: selected.id,
        display_name: displayName || selected.name,
        api_key: selected.needsKey ? apiKey : "",
        org_id: orgId || undefined,
      });
      setApiKey("");
      setDisplayName("");
      setOrgId("");
      setError(null);
      setSuccess(
        `${selected.name} registered — point your tool at the proxy and the rail lights up on first traffic`,
      );
      setSelected(null);
      setTimeout(() => setSuccess(null), 6000);
      fetchProviders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add provider");
    } finally {
      setConnecting(false);
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
      {/* Connection flow — step 1: pick, step 2: credentials, step 3: live state */}
      <section className="panel" aria-label="Providers">
        <div className="panel-id">
          <span>PROVIDERS · REGISTRY</span>
          <span className="panel-id-right">TT-CFG-CONN</span>
        </div>
        <div className="panel-band">
          <span className="panel-title">Providers</span>
          <span className="tag">{providers.length}/6 registered</span>
        </div>
        <div className="panel-body">
          {error && <p className="form-msg form-error" role="alert">{error}</p>}
          {success && <p className="form-msg form-ok" role="status">{success}</p>}

          <div className="conn-grid">
            {PROVIDER_OPTIONS.map((opt) => {
              const state = cellState(opt.id);
              return (
                <button
                  key={opt.id}
                  className={`conn-cell ${selected?.id === opt.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelected(selected?.id === opt.id ? null : opt);
                    setError(null);
                  }}
                  aria-pressed={selected?.id === opt.id}
                >
                  <span className="conn-cell-name">{opt.name}</span>
                  <span className="conn-cell-state">
                    <span
                      className={`state-dot ${state === "offline" ? "off" : ""}`}
                      style={state === "live" ? undefined : state === "registered" ? { background: "var(--tank-dim)" } : undefined}
                    />
                    {state === "live" ? "live" : state === "registered" ? "registered" : "offline"}
                  </span>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="form">
              <span className="t-micro">
                {selected.name} · {selected.needsKey ? "credentials" : "no key needed — just register"}
              </span>
              <input
                placeholder={`Display name (default: ${selected.name})`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              {selected.needsKey && (
                <input
                  type="password"
                  placeholder="API key — encrypted at rest"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              )}
              {selected.id === "anthropic" && (
                <input
                  placeholder="Org ID (billing API, optional)"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                />
              )}
              <button className="btn-primary" onClick={handleConnect} disabled={connecting}>
                {connecting ? "Registering…" : `Connect ${selected.name}`}
              </button>
              <span className="t-micro">
                then point your tool at http://localhost:8848 — see CONNECT.md
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Registered providers */}
      <section className="panel" aria-label="Registered providers">
        <div className="panel-id">
          <span>MANIFOLD · UNITS</span>
          <span className="panel-id-right">TT-CFG-REG</span>
        </div>
        <div className="panel-band">
          <span className="panel-title">Registered</span>
        </div>
        <div className="panel-body">
          {providers.length === 0 ? (
            <p className="t-micro">Nothing registered.</p>
          ) : (
            <ul className="provider-list">
              {providers.map((p) => (
                <li key={p.id}>
                  <span className="provider-name">{p.display_name}</span>
                  <span className="tag">{p.provider_type}</span>
                  <span className="mono muted">{p.provider}</span>
                  {p.org_id && <span className="mono muted">org:{p.org_id}</span>}
                  <span style={{ marginLeft: "auto" }}>
                    <button className="btn-danger" onClick={() => handleRemove(p.id)}>
                      Disconnect
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Theme */}
      <section className="panel" aria-label="Theme">
        <div className="panel-id">
          <span>THEME · DISPLAY</span>
          <span className="panel-id-right">TT-CFG-THM</span>
        </div>
        <div className="panel-band">
          <span className="panel-title">Theme</span>
        </div>
        <div className="panel-body">
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
                  <span className="theme-preview-accent" />
                  <span className="theme-preview-line" />
                  <span className="theme-preview-line short" />
                </span>
                <span className="theme-card-name">{THEME_META[t].label}</span>
                <span className="theme-card-tag">{THEME_META[t].tagline}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Proxy */}
      <section className="panel" aria-label="Proxy">
        <div className="panel-id">
          <span>PROXY · MANIFOLD</span>
          <span className="panel-id-right">TT-CFG-PRX</span>
        </div>
        <div className="panel-band">
          <span className="panel-title">Proxy</span>
        </div>
        <div className="panel-body">
          <div className="config-grid">
            <div className="config-item">
              <span className="t-micro">Proxy URL</span>
              <span className="config-value">http://localhost:8848</span>
            </div>
            <div className="config-item">
              <span className="t-micro">Anthropic / Claude Code</span>
              <span className="config-value">ANTHROPIC_BASE_URL=http://localhost:8848</span>
            </div>
            <div className="config-item">
              <span className="t-micro">OpenAI SDK</span>
              <span className="config-value">OPENAI_BASE_URL=http://localhost:8848/v1</span>
            </div>
            <div className="config-item">
              <span className="t-micro">Launch</span>
              <span className="config-value">token-tank start</span>
            </div>
            <div className="config-item">
              <span className="t-micro">Full setup guide</span>
              <span className="config-value">CONNECT.md</span>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="panel" aria-label="Privacy and security">
        <div className="panel-id">
          <span>PRIVACY · SECURITY</span>
          <span className="panel-id-right">TT-CFG-SEC</span>
        </div>
        <div className="panel-band">
          <span className="panel-title">Privacy &amp; Security</span>
        </div>
        <div className="panel-body">
          <div className="config-grid">
            <div className="config-item">
              <span className="t-micro">API key encryption</span>
              <span className="config-value ok">Fernet AES-128 at rest</span>
            </div>
            <div className="config-item">
              <span className="t-micro">Content logging</span>
              <span className="config-value">Token counts only</span>
            </div>
            <div className="config-item">
              <span className="t-micro">Telemetry</span>
              <span className="config-value">None — 100% local</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
