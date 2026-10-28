import type { GenerationSettings, GarmentType, GenerationProvider, ModelQuality } from "@/src/entities/generated-model/model/generation-contracts";

export type DemoGenerationStatus = "idle" | "uploading" | "queued" | "generating" | "completed" | "failed";
export type DemoScenario = "success" | "failure";

export interface DemoGenerationState {
  runId: string | null;
  completedAt: string | null;
  status: DemoGenerationStatus;
  progress: number;
  scenario: DemoScenario;
  imageName: string | null;
  errorMessage: string | null;
  notice: string | null;
}

export type DemoGenerationEvent =
  | { type: "start"; imageName: string; runId: string }
  | { type: "queued" }
  | { type: "generating" }
  | { type: "progress"; value: number }
  | { type: "complete" }
  | { type: "fail"; message: string }
  | { type: "scenario"; value: DemoScenario }
  | { type: "source-image"; name: string | null };

export const demoGenerationStorageKey = "atelier.demo-generation.v1";
export const demoGenerationMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

export const initialDemoGenerationState: DemoGenerationState = {
  runId: null,
  completedAt: null,
  status: "idle",
  progress: 0,
  scenario: "success",
  imageName: null,
  errorMessage: null,
  notice: null,
};

const activeStatuses: DemoGenerationStatus[] = ["uploading", "queued", "generating"];
const garmentTypes: GarmentType[] = ["dress", "t-shirt", "shirt", "jacket", "trousers", "skirt", "other"];
const providers: GenerationProvider[] = ["tripo", "meshy"];
const qualities: ModelQuality[] = ["standard", "high"];

export function isDemoGenerationActive(status: DemoGenerationStatus): boolean {
  return activeStatuses.includes(status);
}

export function reduceDemoGeneration(state: DemoGenerationState, event: DemoGenerationEvent): DemoGenerationState {
  switch (event.type) {
    case "start":
      if (isDemoGenerationActive(state.status)) return state;
      return { ...state, runId: event.runId, status: "uploading", progress: 8, imageName: event.imageName.slice(0, 255), errorMessage: null, notice: null };
    case "queued":
      return state.status === "uploading" ? { ...state, status: "queued", progress: 22 } : state;
    case "generating":
      return state.status === "queued" ? { ...state, status: "generating", progress: 30 } : state;
    case "progress":
      return state.status === "generating" ? { ...state, progress: Math.min(99, Math.max(state.progress, Math.round(event.value))) } : state;
    case "complete":
      return state.status === "generating" ? { ...state, status: "completed", completedAt: new Date().toISOString(), progress: 100, errorMessage: null } : state;
    case "fail":
      return isDemoGenerationActive(state.status) ? { ...state, status: "failed", errorMessage: event.message.slice(0, 300) } : state;
    case "scenario":
      return isDemoGenerationActive(state.status) ? state : { ...state, scenario: event.value };
    case "source-image":
      return isDemoGenerationActive(state.status) ? state : { ...state, imageName: event.name?.slice(0, 255) ?? null, notice: null };
  }
}

export interface RestoredDemoGeneration {
  state: DemoGenerationState;
  settings: GenerationSettings | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSettings(value: unknown): GenerationSettings | null {
  if (!isRecord(value)) return null;
  const { garmentType, modelName, includeTextures, quality, provider } = value;
  if ((garmentType !== null && !garmentTypes.includes(garmentType as GarmentType)) ||
      typeof modelName !== "string" || modelName.length > 60 ||
      typeof includeTextures !== "boolean" || !qualities.includes(quality as ModelQuality) ||
      !providers.includes(provider as GenerationProvider)) return null;
  return { garmentType: garmentType as GarmentType | null, modelName, includeTextures, quality: quality as ModelQuality, provider: provider as GenerationProvider };
}

export function restoreDemoGeneration(raw: string | null, now = Date.now()): RestoredDemoGeneration {
  if (!raw) return { state: initialDemoGenerationState, settings: null };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Number.isFinite(parsed.savedAt) || typeof parsed.savedAt !== "number" || parsed.savedAt > now + 60_000) {
      throw new Error("Invalid saved state");
    }
    const settings = parseSettings(parsed.settings);
    const validStatuses: DemoGenerationStatus[] = ["idle", "uploading", "queued", "generating", "completed", "failed"];
    if (!settings || !validStatuses.includes(parsed.status as DemoGenerationStatus) ||
        (parsed.scenario !== "success" && parsed.scenario !== "failure") ||
        (parsed.status === "completed" && parsed.scenario !== "success") ||
        typeof parsed.progress !== "number" || !Number.isFinite(parsed.progress) ||
        (parsed.imageName !== null && typeof parsed.imageName !== "string")) throw new Error("Invalid saved state");

    const imageName = typeof parsed.imageName === "string" ? parsed.imageName.slice(0, 255) : null;
    const runId = typeof parsed.runId === "string" && /^[\w-]{1,80}$/.test(parsed.runId) ? parsed.runId : null;
    const completedAt = typeof parsed.completedAt === "string" && Number.isFinite(Date.parse(parsed.completedAt)) ? new Date(parsed.completedAt).toISOString() : null;
    const isExpired = now - parsed.savedAt > demoGenerationMaxAgeMs;
    const wasActive = isDemoGenerationActive(parsed.status as DemoGenerationStatus);
    if (isExpired) {
      return {
        settings,
        state: {
          ...initialDemoGenerationState,
          scenario: parsed.scenario,
          notice: "Сохранённый демо-сценарий устарел и был сброшен. Выберите изображение, чтобы начать заново.",
        },
      };
    }
    if (wasActive) {
      return {
        settings,
        state: {
          status: "failed",
          runId,
          completedAt: null,
          progress: 0,
          scenario: parsed.scenario,
          imageName,
          errorMessage: "Демо-сценарий прервался после перезагрузки и не продолжался в фоне.",
          notice: imageName ? `Исходное изображение «${imageName}» не сохранено. Загрузите его снова, чтобы повторить сценарий.` : null,
        },
      };
    }

    return {
      settings,
      state: {
        status: parsed.status as DemoGenerationStatus,
        runId,
        completedAt: parsed.status === "completed" ? completedAt ?? new Date(parsed.savedAt).toISOString() : null,
        progress: parsed.status === "completed" ? 100 : Math.min(99, Math.max(0, Math.round(parsed.progress))),
        scenario: parsed.scenario,
        imageName,
        errorMessage: typeof parsed.errorMessage === "string" ? parsed.errorMessage.slice(0, 300) : null,
        notice: imageName ? `Исходное изображение «${imageName}» не восстановлено. Загрузите его снова, чтобы повторить сценарий.` : null,
      },
    };
  } catch {
    return {
      state: { ...initialDemoGenerationState, notice: "Не удалось восстановить демо-состояние. Можно начать новый сценарий." },
      settings: null,
    };
  }
}

export function serializeDemoGeneration(state: DemoGenerationState, settings: GenerationSettings, savedAt = Date.now()): string {
  return JSON.stringify({
    version: 1,
    savedAt,
    status: state.status,
    runId: state.runId,
    completedAt: state.completedAt,
    progress: state.progress,
    scenario: state.scenario,
    imageName: state.imageName,
    errorMessage: state.errorMessage,
    settings,
  });
}
