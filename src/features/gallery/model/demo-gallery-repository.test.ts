import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoGalleryModel, galleryStorageKey, serializeGallery } from "@/src/entities/generated-model/model/gallery-storage";
import { demoGalleryRepository } from "./demo-gallery-repository";

describe("demo gallery repository", () => {
  beforeEach(() => window.localStorage.clear());

  it("reads, adds idempotently, renames, and removes only local metadata", () => {
    const entry = createDemoGalleryModel({ id: "run-1", name: "Эскиз", garmentType: "dress" });
    window.localStorage.setItem(galleryStorageKey, serializeGallery([entry]));
    demoGalleryRepository.addCompleted({ id: entry.id, name: entry.name, garmentType: entry.garmentType, createdAt: entry.createdAt });
    expect(demoGalleryRepository.list().models).toHaveLength(1);
    expect(demoGalleryRepository.rename(entry.id, "Новое имя").models[0].name).toBe("Новое имя");
    expect(demoGalleryRepository.remove(entry.id).models).toEqual([]);
    expect(window.localStorage.getItem(galleryStorageKey)).toContain('"models":[]');
  });

  it("reports storage access and write failures instead of throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    expect(demoGalleryRepository.list().warning).toMatch(/недоступно/);
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(demoGalleryRepository.addCompleted({ id: "run-2", name: "Модель", garmentType: null }).warning).toMatch(/Не удалось сохранить/);
  });
});
