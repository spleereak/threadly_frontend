import { describe, expect, it } from "vitest";
import { createDemoGalleryModel, restoreGallery, serializeGallery, upsertGalleryModel, validateGalleryName } from "./gallery-storage";

describe("gallery storage", () => {
  it("restores valid versioned records in newest-first order and reports invalid or old data", () => {
    const old = createDemoGalleryModel({ id: "old", name: "Старое", garmentType: null, createdAt: "2025-01-01T00:00:00.000Z" });
    const fresh = createDemoGalleryModel({ id: "fresh", name: "Новое", garmentType: "dress", createdAt: "2025-02-01T00:00:00.000Z" });
    expect(restoreGallery(serializeGallery([old, fresh])).models.map((model) => model.id)).toEqual(["fresh", "old"]);
    expect(restoreGallery("{").warning).toMatch(/прочитать/);
    expect(restoreGallery(JSON.stringify({ version: 3, models: [] })).warning).toMatch(/неизвестный формат/);
  });

  it("upserts by stable id and validates trimmed, bounded names", () => {
    const first = createDemoGalleryModel({ id: "run-1", name: "Первое", garmentType: null });
    const replacement = { ...first, name: "Переименовано" };
    expect(upsertGalleryModel([first], replacement)).toHaveLength(1);
    expect(validateGalleryName("  ")).toMatch(/Введите/);
    expect(validateGalleryName("я".repeat(61))).toMatch(/60/);
    expect(validateGalleryName("  Новое  ")).toBeNull();
  });

  it("drops duplicate stable ids from damaged persisted data", () => {
    const first = createDemoGalleryModel({ id: "same", name: "Первая", garmentType: null });
    const duplicate = { ...first, name: "Повтор" };
    const restored = restoreGallery(JSON.stringify({ version: 1, models: [first, duplicate] }));
    expect(restored.models).toHaveLength(1);
    expect(restored.models[0].name).toBe("Первая");
    expect(restored.warning).toMatch(/повторные/);
  });
});
