export type AppMode = "demo" | "api";

export interface RuntimeConfig {
  mode: AppMode;
  apiBaseUrl: string | null;
}

/** Resolve once at the application boundary. Network health never changes this mode. */
export function resolveRuntimeConfig(rawApiBaseUrl: string | undefined): RuntimeConfig {
  const apiBaseUrl = rawApiBaseUrl?.trim() ?? "";
  return apiBaseUrl
    ? { mode: "api", apiBaseUrl: apiBaseUrl.replace(/\/+$/, "") }
    : { mode: "demo", apiBaseUrl: null };
}

export const runtimeConfig = resolveRuntimeConfig(process.env.NEXT_PUBLIC_API_BASE_URL);
