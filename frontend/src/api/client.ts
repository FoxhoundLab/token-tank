/** API client for Token Tank backend. */

import type { DashboardData, ProviderResponse, QuotaWindowsResponse } from "../types";

const BASE_URL = "/api/v1";

export async function getDashboard(): Promise<DashboardData> {
  const resp = await fetch(`${BASE_URL}/dashboard`);
  if (!resp.ok) throw new Error(`Dashboard fetch failed: ${resp.status}`);
  return resp.json();
}

export async function getProviders(): Promise<ProviderResponse[]> {
  const resp = await fetch(`${BASE_URL}/providers`);
  if (!resp.ok) throw new Error(`Providers fetch failed: ${resp.status}`);
  return resp.json();
}

export async function addProvider(payload: {
  provider: string;
  display_name: string;
  api_key: string;
  org_id?: string;
  api_tier?: string;
}): Promise<ProviderResponse> {
  const resp = await fetch(`${BASE_URL}/providers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Add provider failed: ${resp.status}`);
  return resp.json();
}

export async function removeProvider(id: string): Promise<void> {
  const resp = await fetch(`${BASE_URL}/providers/${id}`, { method: "DELETE" });
  if (!resp.ok) throw new Error(`Delete provider failed: ${resp.status}`);
}

export async function getAllQuotas(): Promise<QuotaWindowsResponse[]> {
  const resp = await fetch(`${BASE_URL}/quota`);
  if (!resp.ok) throw new Error(`Quota fetch failed: ${resp.status}`);
  return resp.json();
}
