import type { GarmentType } from "./generation-contracts";

export type GalleryStatus = "completed";

export interface GalleryModel {
  id: string;
  name: string;
  garmentType: GarmentType | null;
  createdAt: string;
  status: GalleryStatus;
  isDemo: true;
  modelUrl: "/models/corset.glb";
}

export const galleryStorageKey = "atelier.gallery.v1";
const garmentTypes: GarmentType[] = ["dress", "t-shirt", "shirt", "jacket", "trousers", "skirt", "other"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validModel(value: unknown): value is GalleryModel {
  if (!isRecord(value)) return false;
  const date = typeof value.createdAt === "string" ? new Date(value.createdAt) : null;
  return typeof value.id === "string" && /^[\w-]{1,80}$/.test(value.id) &&
    typeof value.name === "string" && value.name.trim().length > 0 && value.name.length <= 60 &&
    (value.garmentType === null || garmentTypes.includes(value.garmentType as GarmentType)) &&
    date !== null && Number.isFinite(date.getTime()) && value.status === "completed" &&
    value.isDemo === true && value.modelUrl === "/models/corset.glb";
}

export type GalleryRestoreResult = { models: GalleryModel[]; warning: string | null };

export function restoreGallery(raw: string | null): GalleryRestoreResult {
  if (!raw) return { models: [], warning: null };
  try {
    const saved: unknown = JSON.parse(raw);
    if (!isRecord(saved) || saved.version !== 1 || !Array.isArray(saved.models)) {
      return { models: [], warning: "Сохранённые данные галереи имеют неизвестный формат и не были загружены." };
    }
    const validModels = saved.models.filter(validModel);
    const seenIds = new Set<string>();
    const models = validModels.filter((model) => {
      if (seenIds.has(model.id)) return false;
      seenIds.add(model.id);
      return true;
    });
    return { models: sortGalleryModels(models), warning: models.length !== saved.models.length ? "Повреждённые или повторные записи галереи были пропущены." : null };
  } catch {
    return { models: [], warning: "Не удалось прочитать локальные данные галереи. Можно начать с чистого списка." };
  }
}

export function serializeGallery(models: GalleryModel[]): string {
  return JSON.stringify({ version: 1, models: sortGalleryModels(models) });
}

export function sortGalleryModels(models: GalleryModel[]): GalleryModel[] {
  return [...models].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
}

export function createDemoGalleryModel(input: { id: string; name: string; garmentType: GarmentType | null; createdAt?: string }): GalleryModel {
  const name = input.name.trim().slice(0, 60) || "Демонстрационная модель";
  return { id: input.id, name, garmentType: input.garmentType, createdAt: input.createdAt ?? new Date().toISOString(), status: "completed", isDemo: true, modelUrl: "/models/corset.glb" };
}

export function upsertGalleryModel(models: GalleryModel[], model: GalleryModel): GalleryModel[] {
  return sortGalleryModels([model, ...models.filter((item) => item.id !== model.id)]);
}

export function validateGalleryName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Введите название модели.";
  if (name.length > 60) return "Название должно содержать не более 60 символов.";
  return null;
}
