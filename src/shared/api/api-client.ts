import type { RuntimeConfig } from "@/src/shared/config/runtime-config";

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly kind: "network" | "http" | "protocol";

  constructor(options: { message: string; code: string; status: number | null; kind: ApiRequestError["kind"] }) {
    super(options.message);
    this.name = "ApiRequestError";
    this.code = options.code;
    this.status = options.status;
    this.kind = options.kind;
  }
}

export function resolveApiUrl(config: RuntimeConfig, pathOrUrl: string): string {
  if (config.mode !== "api" || !config.apiBaseUrl) {
    throw new ApiRequestError({ message: "API-режим не настроен.", code: "api_not_configured", status: null, kind: "protocol" });
  }
  try {
    return new URL(pathOrUrl, `${config.apiBaseUrl}/`).toString();
  } catch {
    throw new ApiRequestError({ message: "Некорректный адрес API.", code: "invalid_api_url", status: null, kind: "protocol" });
  }
}

export async function requestApi<T>(
  config: RuntimeConfig,
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (typeof FormData !== "undefined" && init.body instanceof FormData) headers.delete("Content-Type");

  let response: Response;
  try {
    response = await fetcher(resolveApiUrl(config, path), { ...init, headers });
  } catch {
    throw new ApiRequestError({ message: "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.", code: "connection_failed", status: null, kind: "network" });
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError({ message: "Сервер вернул ответ в неизвестном формате.", code: "invalid_response", status: response.status, kind: "protocol" });
  }

  if (!response.ok) {
    const error = isApiErrorPayload(payload) ? payload.error : null;
    throw new ApiRequestError({
      message: error?.message ?? "Не удалось выполнить запрос. Попробуйте ещё раз.",
      code: error?.code ?? "request_failed",
      status: response.status,
      kind: "http",
    });
  }

  return payload as T;
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = value.error;
  return typeof error === "object" && error !== null &&
    "code" in error && typeof error.code === "string" &&
    "message" in error && typeof error.message === "string";
}
