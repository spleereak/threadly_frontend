/** Typed frontend boundary for a future server-backed generation adapter. */
export type GarmentType =
  | "dress"
  | "t-shirt"
  | "shirt"
  | "jacket"
  | "trousers"
  | "skirt"
  | "other";

export type ModelQuality = "standard" | "high";
export type GenerationProvider = "tripo" | "meshy" | "mock" | (string & {});
export type GenerationStatus = "queued" | "running" | "success" | "failed" | "processing" | "completed";

export interface GenerationSettings {
  garmentType: GarmentType | null;
  modelName: string;
  includeTextures: boolean;
  quality: ModelQuality;
  provider: GenerationProvider;
}

export interface StartGenerationInput {
  sketch: File;
  settings: GenerationSettings;
}

export interface GeneratedModel {
  id: string;
  name: string;
  garmentType: GarmentType | null;
  glbUrl: string;
}

export interface GenerationTask {
  id: string;
  status: GenerationStatus;
  progress?: number;
  model?: GeneratedModel;
  errorMessage?: string;
}

export interface GenerationService {
  submit(input: StartGenerationInput): Promise<Pick<GenerationTask, "id" | "status">>;
  getTask(taskId: string, signal?: AbortSignal): Promise<GenerationTask>;
}

/** Server model returned by the API contract. File URLs are resolved by the API adapter. */
export interface ApiModel {
  id: string;
  name: string;
  garmentType: GarmentType | null;
  provider: GenerationProvider;
  texture: boolean;
  quality: ModelQuality;
  status: GenerationStatus;
  progress: number | null;
  error: string | null;
  sketchUrl: string | null;
  sketchWidth: number | null;
  sketchHeight: number | null;
  modelUrl: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  creditsUsed: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ApiConfig {
  garmentTypes: Array<string | ApiConfigOption>;
  qualities: Array<string | ApiConfigOption>;
  providers: Array<string | ApiConfigOption>;
  limits?: { maxFileSizeBytes?: number; minImageSide?: number };
  errors?: Record<string, string>;
}

export interface ApiConfigOption { value: string; label?: string }

export interface ApiGenerationOptions {
  name?: string;
  garmentType?: GarmentType;
  quality?: ModelQuality;
  texture?: boolean;
  provider?: GenerationProvider;
}

