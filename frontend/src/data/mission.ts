/**
 * Mission Control — static mission data.
 * Curated from the 2026-07-18 home-directory / usage-db / n8n audit.
 * Live telemetry (quota windows, 7d history) joins onto these rows at
 * render time via `providerId` (the backend provider slug). Everything
 * here is real; nothing is fabricated at runtime.
 */

/* ── Zone 1: subscriptions ─────────────────────────────────────── */

export interface SubscriptionRow {
  id: string;
  name: string;
  vendor: string;
  kind: "subscription" | "api" | "local";
  planNote: string;
  /** Backend provider slug (ProviderSummary.provider) or null = no telemetry. */
  providerId: string | null;
  /** Quota window_type preference order — first match renders. */
  windowPreference: string[];
}

export const subscriptions: SubscriptionRow[] = [
  {
    id: "claude-max",
    name: "Claude Max",
    vendor: "Anthropic",
    kind: "subscription",
    planNote: "Fable 5 · Opus 4.8 · Sonnet",
    providerId: "anthropic",
    // Fable 5's own weekly cap matters more than the blended weekly.
    windowPreference: ["model:fable-5", "5h"],
  },
  {
    id: "ollama-pro",
    name: "Ollama Pro",
    vendor: "Ollama",
    kind: "subscription",
    planNote: "Kimi K2.x cloud",
    providerId: "ollama",
    windowPreference: ["weekly", "5h"],
  },
  {
    id: "grok",
    name: "Grok",
    vendor: "xAI",
    kind: "subscription",
    planNote: "SuperGrok · grok-4",
    providerId: "grok",
    windowPreference: ["weekly", "monthly", "5h"],
  },
  {
    id: "zai-glm",
    name: "GLM Plan",
    vendor: "Z.AI",
    kind: "subscription",
    planNote: "GLM-5.2 + web search",
    providerId: "zai",
    windowPreference: ["weekly", "monthly", "5h"],
  },
  {
    id: "minimax",
    name: "MiniMax",
    vendor: "MiniMax",
    kind: "subscription",
    planNote: "abab6.5 family",
    providerId: "minimax",
    windowPreference: ["monthly", "weekly", "5h"],
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    vendor: "local",
    kind: "local",
    planNote: "on-metal · $0",
    providerId: "lmstudio",
    windowPreference: ["weekly", "5h"],
  },
  {
    id: "n8n-cloud",
    name: "n8n Cloud",
    vendor: "n8n",
    kind: "subscription",
    planNote: "oshinaka.app.n8n.cloud",
    providerId: null,
    windowPreference: [],
  },
];

/* ── Zone 2: operations ────────────────────────────────────────── */

export type ProjectStatus = "hot" | "active" | "frozen" | "icebox";

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  summary: string;
  /** ISO datetime with zone. Renders a T-minus countdown. */
  deadline?: string;
}

export const projects: Project[] = [
  {
    id: "preflight",
    name: "Preflight",
    status: "hot",
    summary: "VA claim navigator — ship core + Stripe @ $59",
    deadline: "2026-07-20T23:59:59Z",
  },
  {
    id: "wargames",
    name: "WarGames",
    status: "active",
    summary: "battle-plan extraction — bank Fable 5 judgment",
  },
  { id: "manospy", name: "ManosPY", status: "frozen", summary: "Paraguay services marketplace" },
  { id: "token-tank", name: "Token Tank", status: "frozen", summary: "this cockpit" },
  { id: "anchormind", name: "AnchorMind", status: "frozen", summary: "voice-first memory companion" },
  { id: "argos", name: "Argos", status: "frozen", summary: "lifelong companion + memory ledger" },
  { id: "bizcore", name: "BizCore", status: "frozen", summary: "SMB business OS" },
  { id: "tablesettle", name: "TableSettle", status: "frozen", summary: "bill splitting" },
  { id: "foxtrot", name: "Foxtrot Fitness", status: "frozen", summary: "AI workout operations" },
  { id: "survivalseed", name: "SurvivalSeed", status: "icebox", summary: "offline survival AI — frozen until revenue" },
];

export interface Campaign {
  label: string;
  breakEvenSalesPerMonth: number;
  windowStart: string; // ISO date
  windowEnd: string; // ISO date
  cadence: { label: string; target: number; unit: string }[];
}

export const campaign: Campaign = {
  label: "TOC CONSTRAINT CAMPAIGN",
  breakEvenSalesPerMonth: 26,
  windowStart: "2026-07-07",
  windowEnd: "2026-10-04",
  cadence: [
    { label: "posts in veteran channels", target: 5, unit: "/wk" },
    { label: "avatar conversations", target: 3, unit: "/wk" },
  ],
};

/* ── Zone 3: commander ─────────────────────────────────────────── */

export interface Persona {
  callsign: string;
  org: string;
  constraint: string;
  doctrine: string[];
  directives: string[];
}

export const persona: Persona = {
  callsign: "SNAKE",
  org: "FOXHOUNDLAB",
  constraint: "Market contact = 0. The broken rule: build first, sell later.",
  doctrine: [
    "origin/main is the source of truth",
    "zero tolerance for hallucination",
    "action over exposition",
    "an 8th product adds $0",
  ],
  directives: [
    "Ship Preflight core + Stripe @ $59 — Jul 20",
    "Post-ship: ≥60% market-facing hours, ≤30% code",
    "25–50 Preflight sales/mo by Oct 4",
    "Bank Fable 5 judgment into WarGames before handoff",
    "SurvivalSeed stays frozen until revenue",
  ],
};

/** Document trail — the papers behind the mission. */
export interface MissionDoc {
  label: string;
  path: string;
  note: string;
}

export const documents: MissionDoc[] = [
  { label: "Constraint Strategy", path: "~/theory-of-constraints/CONSTRAINT-STRATEGY.md", note: "90d" },
  { label: "Hot Threads", path: "~/brain/hot.md", note: "live" },
  { label: "WarGames Ledger", path: "~/WarGames/LEDGER.md", note: "meta" },
  { label: "Strategic Blueprints", path: "~/strategic_blueprints.md", note: "iced" },
  { label: "About Business", path: "~/brain/about-business.md", note: "doctrine" },
];

/* ── Zone 4: the Agentic OS graph ──────────────────────────────── */

export type NodeKind =
  | "human"
  | "orchestrator"
  | "agent"
  | "lane"
  | "model"
  | "workflow"
  | "vault"
  | "project"
  | "hardware"
  | "service";

export type EdgeKind =
  | "commands"
  | "runs_on"
  | "uses"
  | "feeds"
  | "stores"
  | "builds"
  | "hosts";

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  /** Cluster anchor key — nodes sharing a group gravitate together. */
  group: string;
  weight?: 1 | 2 | 3;
  detail?: string[];
  /** Live-telemetry join: backend provider slug. */
  providerId?: string;
  /** Join to projects[] — a hot project gets the warn ring. */
  projectId?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
}

const nodes: GraphNode[] = [
  // core
  {
    id: "snake",
    label: "SNAKE",
    kind: "human",
    group: "core",
    weight: 3,
    detail: ["commander · FoxhoundLab", "the only human in the loop"],
  },

  // hermes runtime
  {
    id: "hermes",
    label: "HERMES",
    kind: "orchestrator",
    group: "hermes",
    weight: 2,
    detail: ["agent runtime · ~/.hermes", "gateway daemon · cron · sessions"],
  },
  { id: "otacon", label: "OTACON", kind: "agent", group: "hermes", weight: 2, detail: ["architect / orchestrator", "runs on GLM-5.2"] },
  { id: "meryl", label: "MERYL", kind: "agent", group: "hermes", detail: ["ops & delivery", "morning briefs · Telegram · cron"] },
  { id: "naomi", label: "NAOMI", kind: "agent", group: "hermes", detail: ["research", "local Qwen 3.6 35B"] },
  { id: "campbell", label: "CAMPBELL", kind: "agent", group: "hermes", detail: ["QA gate"] },

  // claude code lane
  {
    id: "claude-code",
    label: "CLAUDE CODE",
    kind: "lane",
    group: "claude",
    weight: 2,
    detail: ["heavy planning + coding lane", "separate from Hermes by policy"],
  },
  { id: "fable5", label: "FABLE 5", kind: "model", group: "claude", weight: 2, providerId: "anthropic", detail: ["Claude Max", "planning judgment being banked"] },
  { id: "opus48", label: "OPUS 4.8", kind: "model", group: "claude", providerId: "anthropic", detail: ["Claude Max", "executor after handoff"] },
  { id: "sonnet", label: "SONNET", kind: "model", group: "claude", providerId: "anthropic", detail: ["Claude Max", "default workhorse"] },

  // local fleet
  { id: "lmstudio-host", label: "LM STUDIO", kind: "service", group: "local", providerId: "lmstudio", detail: ["local inference host · $0"] },
  { id: "ollama-host", label: "OLLAMA PRO", kind: "service", group: "local", providerId: "ollama", detail: ["local + cloud inference"] },
  { id: "glm52", label: "GLM-5.2", kind: "model", group: "local", providerId: "zai", detail: ["Z.AI plan", "Otacon's brain-metal"] },
  { id: "kimi", label: "KIMI K2.X", kind: "model", group: "local", providerId: "ollama", detail: ["via Ollama Pro"] },
  { id: "minimax-m3", label: "MINIMAX M3", kind: "model", group: "local", providerId: "minimax", detail: ["MiniMax plan"] },
  { id: "grok4", label: "GROK 4", kind: "model", group: "local", providerId: "grok", detail: ["SuperGrok subscription"] },
  { id: "qwen", label: "QWEN 3.6 35B", kind: "model", group: "local", providerId: "lmstudio", detail: ["Naomi's local engine"] },

  // n8n automation
  {
    id: "n8n",
    label: "N8N CLOUD",
    kind: "service",
    group: "n8n",
    weight: 2,
    detail: ["oshinaka.app.n8n.cloud", "8 workflows · 1 active"],
  },
  { id: "wf-gadget-rag", label: "GADGET RAG", kind: "workflow", group: "n8n", detail: ["support email auto-drafter", "ACTIVE · 13 nodes"] },
  { id: "wf-lime-rag", label: "LIME RAG", kind: "workflow", group: "n8n", detail: ["support email auto-drafter · off"] },
  { id: "wf-gadget-kb", label: "GADGET KB", kind: "workflow", group: "n8n", detail: ["knowledge-base indexer · off"] },
  { id: "wf-foxtrot-kb", label: "FOXTROT KB", kind: "workflow", group: "n8n", detail: ["knowledge-base indexer · off"] },
  { id: "wf-foxtrot-cls", label: "EQUIP CLASSIFIER", kind: "workflow", group: "n8n", detail: ["Foxtrot equipment classifier · off"] },
  { id: "wf-foxtrot-ops", label: "OP NAMER", kind: "workflow", group: "n8n", detail: ["Foxtrot operation names · off"] },
  { id: "wf-preflight-cls", label: "SIDECAR CLS", kind: "workflow", group: "n8n", detail: ["Preflight sidecar classifier · test"] },
  { id: "wf-urgent-log", label: "URGENT LOG", kind: "workflow", group: "n8n", detail: ["urgent email logger · off"] },

  // memory
  { id: "foxhound-vault", label: "FOXHOUND VAULT", kind: "vault", group: "memory", detail: ["Obsidian · 3-layer shared memory"] },
  { id: "otacon-vault", label: "OTACON VAULT", kind: "vault", group: "memory", detail: ["Obsidian · 4-layer agent memory"] },
  { id: "brain", label: "BRAIN", kind: "vault", group: "memory", detail: ["~/brain — ADR log · ideas · hot threads"] },

  // fleet
  { id: "preflight", label: "PREFLIGHT", kind: "project", group: "fleet", weight: 2, projectId: "preflight", detail: ["THE constraint bet", "ship Jul 20 · $59"] },
  { id: "wargames", label: "WARGAMES", kind: "project", group: "fleet", projectId: "wargames" },
  { id: "manospy", label: "MANOSPY", kind: "project", group: "fleet", projectId: "manospy" },
  { id: "token-tank", label: "TOKEN TANK", kind: "project", group: "fleet", projectId: "token-tank", detail: ["you are here"] },
  { id: "anchormind", label: "ANCHORMIND", kind: "project", group: "fleet", projectId: "anchormind" },
  { id: "argos", label: "ARGOS", kind: "project", group: "fleet", projectId: "argos" },
  { id: "bizcore", label: "BIZCORE", kind: "project", group: "fleet", projectId: "bizcore" },
  { id: "tablesettle", label: "TABLESETTLE", kind: "project", group: "fleet", projectId: "tablesettle" },
  { id: "foxtrot", label: "FOXTROT", kind: "project", group: "fleet", projectId: "foxtrot" },
  { id: "survivalseed", label: "SURVIVALSEED", kind: "project", group: "fleet", projectId: "survivalseed" },

  // hardware
  { id: "mac-daily", label: "DAILY DRIVER", kind: "hardware", group: "hardware", detail: ["Mac · command seat"] },
  { id: "mac-box", label: "24/7 AI BOX", kind: "hardware", group: "hardware", detail: ["Mac · always-on inference"] },
  { id: "vpn", label: "VPN LINK", kind: "hardware", group: "hardware", detail: ["private mesh between the two Macs"] },
];

const edges: GraphEdge[] = [
  // command chain
  { source: "snake", target: "hermes", kind: "commands" },
  { source: "snake", target: "claude-code", kind: "commands" },
  // hermes hosts its agents
  { source: "hermes", target: "otacon", kind: "hosts" },
  { source: "hermes", target: "meryl", kind: "hosts" },
  { source: "hermes", target: "naomi", kind: "hosts" },
  { source: "hermes", target: "campbell", kind: "hosts" },
  // agents on their engines
  { source: "otacon", target: "glm52", kind: "runs_on" },
  { source: "naomi", target: "qwen", kind: "runs_on" },
  { source: "meryl", target: "n8n", kind: "uses" },
  // claude lane models
  { source: "claude-code", target: "fable5", kind: "uses" },
  { source: "claude-code", target: "opus48", kind: "uses" },
  { source: "claude-code", target: "sonnet", kind: "uses" },
  // local fleet plumbing
  { source: "kimi", target: "ollama-host", kind: "runs_on" },
  { source: "qwen", target: "lmstudio-host", kind: "runs_on" },
  { source: "hermes", target: "minimax-m3", kind: "uses" },
  { source: "hermes", target: "grok4", kind: "uses" },
  { source: "lmstudio-host", target: "mac-box", kind: "runs_on" },
  { source: "ollama-host", target: "mac-box", kind: "runs_on" },
  { source: "hermes", target: "mac-box", kind: "runs_on" },
  { source: "claude-code", target: "mac-daily", kind: "runs_on" },
  // hardware mesh
  { source: "mac-daily", target: "vpn", kind: "hosts" },
  { source: "vpn", target: "mac-box", kind: "hosts" },
  // n8n hosts workflows
  { source: "n8n", target: "wf-gadget-rag", kind: "hosts" },
  { source: "n8n", target: "wf-lime-rag", kind: "hosts" },
  { source: "n8n", target: "wf-gadget-kb", kind: "hosts" },
  { source: "n8n", target: "wf-foxtrot-kb", kind: "hosts" },
  { source: "n8n", target: "wf-foxtrot-cls", kind: "hosts" },
  { source: "n8n", target: "wf-foxtrot-ops", kind: "hosts" },
  { source: "n8n", target: "wf-preflight-cls", kind: "hosts" },
  { source: "n8n", target: "wf-urgent-log", kind: "hosts" },
  // workflows feed products
  { source: "wf-foxtrot-kb", target: "foxtrot", kind: "feeds" },
  { source: "wf-foxtrot-cls", target: "foxtrot", kind: "feeds" },
  { source: "wf-foxtrot-ops", target: "foxtrot", kind: "feeds" },
  { source: "wf-preflight-cls", target: "preflight", kind: "feeds" },
  // memory loops
  { source: "otacon", target: "brain", kind: "stores" },
  { source: "otacon", target: "otacon-vault", kind: "stores" },
  { source: "hermes", target: "foxhound-vault", kind: "stores" },
  { source: "brain", target: "claude-code", kind: "feeds" },
  { source: "wargames", target: "opus48", kind: "feeds" },
  { source: "fable5", target: "wargames", kind: "feeds" },
  // build lane
  { source: "claude-code", target: "preflight", kind: "builds" },
  { source: "claude-code", target: "token-tank", kind: "builds" },
  { source: "claude-code", target: "wargames", kind: "builds" },
  { source: "claude-code", target: "manospy", kind: "builds" },
  { source: "claude-code", target: "anchormind", kind: "builds" },
  { source: "claude-code", target: "argos", kind: "builds" },
  { source: "claude-code", target: "bizcore", kind: "builds" },
  { source: "claude-code", target: "tablesettle", kind: "builds" },
  { source: "otacon", target: "foxtrot", kind: "builds" },
  { source: "snake", target: "preflight", kind: "commands" },
  { source: "hermes", target: "survivalseed", kind: "stores" },
];

export const graph: { nodes: GraphNode[]; edges: GraphEdge[] } = { nodes, edges };

/** Dev-only integrity check — a typo'd edge endpoint fails loudly. */
export function validateGraph(): void {
  const ids = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) {
      throw new Error(`mission graph: dangling edge ${e.source} → ${e.target}`);
    }
  }
}

if (import.meta.env.DEV) validateGraph();
