import { describe, expect, it, vi } from "vitest";
import { requestApi, resolveApiUrl } from "./api-client";
import type { RuntimeConfig } from "@/src/shared/config/runtime-config";

const apiConfig: RuntimeConfig = { mode: "api", apiBaseUrl: "https://api.example.test/v2" };

describe("API client", () => {
  it("resolves relative paths and absolute response URLs", () => {
    expect(resolveApiUrl(apiConfig, "/api/models/m1")).toBe("https://api.example.test/api/models/m1");
    expect(resolveApiUrl(apiConfig, "api/models/m1")).toBe("https://api.example.test/v2/api/models/m1");
    expect(resolveApiUrl(apiConfig, "https://cdn.example.test/model.glb")).toBe("https://cdn.example.test/model.glb");
  });

  it("surfaces the API message while keeping details out of the user-facing error", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { code: "invalid_sketch", message: "Эскиз не подходит.", details: { internal: "private" } } }), { status: 422 }));
    await expect(requestApi(apiConfig, "/api/generate", { method: "POST" }, fetcher)).rejects.toMatchObject({
      name: "ApiRequestError", message: "Эскиз не подходит.", code: "invalid_sketch", kind: "http", status: 422,
    });
    await expect(requestApi(apiConfig, "/api/generate", { method: "POST" }, fetcher)).rejects.not.toHaveProperty("details");
  });

  it("identifies network failure without changing the configured API mode", async () => {
    const fetcher = vi.fn(async () => { throw new TypeError("Network down"); });
    const request = requestApi(apiConfig, "/api/health", {}, fetcher);
    await expect(request).rejects.toMatchObject({ name: "ApiRequestError", kind: "network", code: "connection_failed" });
    expect(apiConfig.mode).toBe("api");
  });

  it("does not set Content-Type for multipart form data", async () => {
    let observedUrl: RequestInfo | URL | undefined;
    let observedInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      observedUrl = input;
      observedInit = init;
      return new Response("{}", { status: 200 });
    };
    const form = new FormData();
    form.set("sketch", new Blob(["sketch"], { type: "image/png" }), "sketch.png");
    await requestApi(apiConfig, "/api/generate", { method: "POST", body: form, headers: { "Content-Type": "application/json" } }, fetcher);
    const headers = new Headers(observedInit?.headers);
    expect(String(observedUrl)).toBe("https://api.example.test/api/generate");
    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.get("Accept")).toBe("application/json");
  });
});
