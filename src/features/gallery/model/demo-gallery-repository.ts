import {
  createDemoGalleryModel,
  galleryStorageKey,
  restoreGallery,
  serializeGallery,
  upsertGalleryModel,
} from "@/src/entities/generated-model/model/gallery-storage";
import type { GarmentType } from "@/src/entities/generated-model/model/generation-contracts";
import type { GalleryModel } from "@/src/entities/generated-model/model/gallery-storage";

export interface DemoGalleryReadResult {
  models: GalleryModel[];
  warning: string | null;
}

function unavailable(): DemoGalleryReadResult {
  return { models: [], warning: "Локальное хранилище недоступно. Галерея работает только до закрытия страницы." };
}

export const demoGalleryRepository = {
  list(): DemoGalleryReadResult {
    try {
      return restoreGallery(window.localStorage.getItem(galleryStorageKey));
    } catch {
      return unavailable();
    }
  },

  addCompleted(input: { id: string; name: string; garmentType: GarmentType | null; createdAt?: string }): { warning: string | null } {
    try {
      const current = this.list();
      const model = createDemoGalleryModel(input);
      window.localStorage.setItem(galleryStorageKey, serializeGallery(upsertGalleryModel(current.models, model)));
      return { warning: null };
    } catch {
      return { warning: "Не удалось сохранить результат в локальную галерею." };
    }
  },

  rename(id: string, name: string): DemoGalleryReadResult {
    const current = this.list();
    if (current.warning && current.models.length === 0) return current;
    try {
      const models = current.models.map((model) => model.id === id ? { ...model, name } : model);
      window.localStorage.setItem(galleryStorageKey, serializeGallery(models));
      return { models, warning: null };
    } catch {
      return { models: current.models, warning: "Не удалось сохранить изменение в этом браузере." };
    }
  },

  remove(id: string): DemoGalleryReadResult {
    const current = this.list();
    if (current.warning && current.models.length === 0) return current;
    try {
      const models = current.models.filter((model) => model.id !== id);
      window.localStorage.setItem(galleryStorageKey, serializeGallery(models));
      return { models, warning: null };
    } catch {
      return { models: current.models, warning: "Не удалось сохранить изменение в этом браузере." };
    }
  },

  subscribe(onChange: (result: DemoGalleryReadResult) => void): () => void {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === galleryStorageKey) onChange(this.list());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  },
};
