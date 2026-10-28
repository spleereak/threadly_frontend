import { describe, expect, it, vi } from "vitest";
import type { ApiModel } from "@/src/entities/generated-model/model/generation-contracts";
import { deleteApiModel, generateApiModel, getApiTask, listApiModels, normalizeApiModel, regenerateApiModel, updateApiModel } from "./api-model-service";

const config = { mode: "api" as const, apiBaseUrl: "https://backend.example.test" };
const model: ApiModel = {
  id: "task-7", name: "Платье", garmentType: "dress", provider: "mock", texture: true, quality: "standard",
  status: "queued", progress: 12, error: null, sketchUrl: "/files/sketch.png", sketchWidth: 640, sketchHeight: 800,
  modelUrl: null, previewUrl: "/files/preview.png", downloadUrl: "/api/models/task-7/download", creditsUsed: null,
  createdAt: "2026-10-28T10:00:00Z", updatedAt: "2026-10-28T10:00:00Z", completedAt: null,
};

describe("API model service", () => {
  it("sends the required image and optional generation fields as multipart form data", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      requestUrl = String(input); requestInit = init;
      return new Response(JSON.stringify({ model, warnings: ["SMALL_IMAGE"] }), { status: 202 });
    };
    const file = new File(["image"], "sketch.png", { type: "image/png" });
    const response = await generateApiModel(config, file, { name: "Летнее платье", garmentType: "dress", quality: "high", texture: false, provider: "mock" }, fetcher);
    const form = requestInit?.body as FormData;
    expect(requestUrl).toBe("https://backend.example.test/api/generate");
    expect(form.get("image")).toBe(file);
    expect(form.get("name")).toBe("Летнее платье");
    expect(form.get("garmentType")).toBe("dress");
    expect(form.get("quality")).toBe("high");
    expect(form.get("texture")).toBe("false");
    expect(form.get("provider")).toBe("mock");
    expect(new Headers(requestInit?.headers).has("Content-Type")).toBe(false);
    expect(response.warnings).toEqual(["SMALL_IMAGE"]);
  });

  it("resolves relative file URLs while keeping absent result files absent", () => {
    expect(normalizeApiModel(config, model)).toMatchObject({
      sketchUrl: "https://backend.example.test/files/sketch.png",
      previewUrl: "https://backend.example.test/files/preview.png",
      modelUrl: null,
      downloadUrl: "https://backend.example.test/api/models/task-7/download",
    });
    expect(normalizeApiModel(config, { ...model, modelUrl: "https://cdn.example.test/model.glb" }).modelUrl).toBe("https://cdn.example.test/model.glb");
  });

  it("restores the active server model through the task endpoint", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ model }), { status: 200 }));
    const restored = await getApiTask(config, "task 7", undefined, fetcher);
    expect(restored.id).toBe(model.id);
    expect(fetcher).toHaveBeenCalledWith("https://backend.example.test/api/tasks/task%207", expect.anything());
  });

  it("passes both search and type filters and supports the gallery mutations", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input); const method = init?.method ?? "GET"; calls.push({ url, method });
      if (method === "DELETE") return new Response(null, { status: 204 });
      if (method === "PATCH") return new Response(JSON.stringify({ model: { ...model, name: "Новое имя" } }), { status: 200 });
      if (url.includes("/tasks/")) return new Response(JSON.stringify({ model }), { status: 200 });
      if (url.includes("/regenerate")) return new Response(JSON.stringify({ model, warnings: [] }), { status: 202 });
      return new Response(JSON.stringify({ models: [model] }), { status: 200 });
    };
    expect(await listApiModels(config, { search: "летнее", type: "dress" }, fetcher)).toHaveLength(1);
    expect(calls[0].url).toContain("search=%D0%BB%D0%B5%D1%82%D0%BD%D0%B5%D0%B5");
    expect(calls[0].url).toContain("type=dress");
    expect((await updateApiModel(config, model.id, { name: "Новое имя" }, fetcher)).name).toBe("Новое имя");
    await deleteApiModel(config, model.id, fetcher);
    await regenerateApiModel(config, model.id, { provider: "mock" }, fetcher);
    expect(calls.map((call) => call.method)).toEqual(["GET", "PATCH", "DELETE", "POST"]);
    expect(calls[2].url).toContain("/api/models/task-7");
    expect(calls[3].url).toContain("/regenerate");
  });
});
