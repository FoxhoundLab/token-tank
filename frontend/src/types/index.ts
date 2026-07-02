/** Shared TypeScript types. */

export interface ProviderSummary {
  provider: string;
  display_name: string;
  provider_type: "subscription" | "api" | "local";
  api_tier: "plan" | "pay_as_you_go";
  today_tokens: number;
  today_cost: number;
  month_tokens: number;
  month_cost: number;
  burn_rate_tokens_per_hour: number;
  burn_rate_cost_per_hour: number;
  fuel_level: number; // 0.0 (empty) to 1.0 (full)
}

export interface DashboardData {
  providers: ProviderSummary[];
}

export interface ProviderResponse {
  id: string;
  provider: string;
  display_name: string;
  provider_type: "subscription" | "api" | "local";
  api_tier: "plan" | "pay_as_you_go";
  org_id: string | null;
  enabled: boolean;
  created_at: string;
}

export interface QuotaWindow {
  id: string;
  provider_id: string;
  window_type: string; // '5h' | 'weekly' | 'monthly' | 'model:*'
  label: string | null;
  used: number;
  limit: number;
  unit: string; // 'tokens' | 'requests' | 'credits' | 'usd'
  reset_at: string | null;
  source: "api" | "extension" | "manual";
  updated_at: string;
  percentage: number;
}

export interface QuotaWindowsResponse {
  provider_id: string;
  provider: string;
  display_name: string;
  windows: QuotaWindow[];
}
