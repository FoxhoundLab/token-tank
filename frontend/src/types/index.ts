/** Shared TypeScript types. */

export interface ProviderSummary {
  provider: string;
  display_name: string;
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
  org_id: string | null;
  enabled: boolean;
  created_at: string;
}
