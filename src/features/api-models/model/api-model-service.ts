import type { ApiConfig, ApiGenerationOptions, ApiModel, GarmentType } from "@/src/entities/generated-model/model/generation-contracts";
import { ApiRequestError, requestApi } from "@/src/shared/api/api-client";
import type { RuntimeConfig } from "@/src/shared/config/runtime-config";

export interface ApiGenerationResponse {
  model: ApiModel;
  warnings: string[];
}

export interface ApiModelsResponse { models: ApiModel[] }

export async function getApiConfig(config: RuntimeConfig, fetcher: typeof fetch = fetch): Promise<ApiConfig> {
  const data = await requestApi<unknown>(config, "/api/config", {}, fetcher);
  if (!isRecord(data) || !isOptionArray(data.garmentTypes) || !isOptionArray(data.qualities) || !isOptionArray(data.providers)) {
    throw protocolError("Сервер вернул некорректную конфигурацию.");
  }
  return data as unknown as ApiConfig;
}

export async function generateApiModel(config: RuntimeConfig, file: File, options: ApiGenerationOptions, fetcher: typeof fetch = fetch): Promise<ApiGenerationResponse> {
  const form = new FormData();
  form.append("image", file);
  if (options.name?.trim()) form.append("name", options.name.trim());
  if (options.garmentType) form.append("garmentType", options.garmentType);
  if (options.quality) form.append("quality", options.quality);
  if (options.texture !== undefined) form.append("texture", String(options.texture));
  if (options.provider) form.append("provider", options.provider);
  const data = await requestApi<{ model: ApiModel; warnings?: string[] }>(config, "/api/generate", { method: "POST", body: form }, fetcher);
  return { model: normalizeApiModel(config, data.model), warnings: normalizeWarnings(data.warnings) };
}

export async function getApiTask(config: RuntimeConfig, id: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<ApiModel> {
  const data = await requestApi<{ model: ApiModel }>(config, `/api/tasks/${encodeURIComponent(id)}`, { signal }, fetcher);
  return normalizeApiModel(config, data.model);
}

export async function listApiModels(config: RuntimeConfig, filters: { search?: string; type?: GarmentType | ""; status?: string } = {}, fetcher: typeof fetch = fetch): Promise<ApiModel[]> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  const query = params.size ? `?${params.toString()}` : "";
  const data = await requestApi<ApiModelsResponse>(config, `/api/models${query}`, {}, fetcher);
  if (!Array.isArray(data.models)) throw protocolError("Сервер вернул некорректный список моделей.");
  return data.models.map((model) => normalizeApiModel(config, model));
}

export async function getApiModel(config: RuntimeConfig, id: string, fetcher: typeof fetch = fetch): Promise<ApiModel> {
  const data = await requestApi<{ model: ApiModel }>(config, `/api/models/${encodeURIComponent(id)}`, {}, fetcher);
  return normalizeApiModel(config, data.model);
}

export async function updateApiModel(config: RuntimeConfig, id: string, updates: { name?: string; garmentType?: GarmentType }, fetcher: typeof fetch = fetch): Promise<ApiModel> {
  const data = await requestApi<{ model: ApiModel }>(config, `/api/models/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
  }, fetcher);
  return normalizeApiModel(config, data.model);
}

export function deleteApiModel(config: RuntimeConfig, id: string, fetcher: typeof fetch = fetch): Promise<void> {
  return requestApi<void>(config, `/api/models/${encodeURIComponent(id)}`, { method: "DELETE" }, fetcher);
}

export async function regenerateApiModel(config: RuntimeConfig, id: string, options: ApiGenerationOptions = {}, fetcher: typeof fetch = fetch): Promise<ApiGenerationResponse> {
  const data = await requestApi<{ model: ApiModel; warnings?: string[] }>(config, `/api/models/${encodeURIComponent(id)}/regenerate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(options),
  }, fetcher);
  return { model: normalizeApiModel(config, data.model), warnings: normalizeWarnings(data.warnings) };
}

export function apiModelDownloadUrl(config: RuntimeConfig, model: ApiModel): string | null {
  return model.downloadUrl ?? (model.modelUrl ? model.modelUrl : null) ?? apiUrl(config, `/api/models/${encodeURIComponent(model.id)}/download`);
}

export function normalizeApiModel(config: RuntimeConfig, model: ApiModel): ApiModel {
  if (!isRecord(model) || typeof model.id !== "string" || typeof model.name !== "string" ||
      !["queued", "running", "success", "failed", "processing", "completed"].includes(String(model.status))) {
    throw protocolError("Сервер вернул некорректные данные модели.");
  }
  return {
    ...model,
    sketchUrl: resolveOptionalUrl(config, typeof model.sketchUrl === "string" ? model.sketchUrl : null),
    modelUrl: resolveOptionalUrl(config, typeof model.modelUrl === "string" ? model.modelUrl : null),
    previewUrl: resolveOptionalUrl(config, typeof model.previewUrl === "string" ? model.previewUrl : null),
    downloadUrl: resolveOptionalUrl(config, typeof model.downloadUrl === "string" ? model.downloadUrl : null),
  };
}

function resolveOptionalUrl(config: RuntimeConfig, value: string | null): string | null {
  return value ? apiUrl(config, value) : null;
}

function apiUrl(config: RuntimeConfig, path: string): string {
  return new URL(path, `${config.apiBaseUrl}/`).toString();
}

function protocolError(message: string): ApiRequestError {
  return new ApiRequestError({ message, code: "invalid_response", status: null, kind: "protocol" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === "string" || (isRecord(item) && typeof item.value === "string"));
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (isRecord(item) && typeof item.message === "string") return [item.message];
    if (isRecord(item) && typeof item.code === "string") return [item.code];
    return [];
  });
}
