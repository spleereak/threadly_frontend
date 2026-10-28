import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiModel } from "@/src/entities/generated-model/model/generation-contracts";
import { apiActiveTaskStorageKey, useApiGeneration } from "./use-api-generation";

const config = { mode: "api" as const, apiBaseUrl: "https://backend.example.test" };
const queued: ApiModel = { id: "task-1", name: "Набросок", garmentType: "dress", provider: "mock", texture: true, quality: "standard", status: "queued", progress: 15, error: null, sketchUrl: null, sketchWidth: 600, sketchHeight: 800, modelUrl: null, previewUrl: null, downloadUrl: null, creditsUsed: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: null };
const success = { ...queued, status: "success" as const, progress: 100, modelUrl: "/model.glb", completedAt: new Date().toISOString() };

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("API generation state", () => {
  it("submits a task, polls status, and clears the saved task after success", async () => {
    vi.useFakeTimers();
    let pollCount = 0;
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/api/generate")) return new Response(JSON.stringify({ model: queued, warnings: ["SMALL_IMAGE"] }), { status: 202 });
      pollCount += 1;
      return new Response(JSON.stringify({ model: pollCount === 1 ? success : success }), { status: 200 });
    };
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useApiGeneration(config));
    await act(async () => { await result.current.start(new File(["image"], "sketch.png", { type: "image/png" }), { provider: "mock" }); });
    expect(result.current.model?.status).toBe("queued");
    expect(result.current.warnings).toEqual(["SMALL_IMAGE"]);
    expect(JSON.parse(window.localStorage.getItem(apiActiveTaskStorageKey) ?? "{}").id).toBe("task-1");
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(result.current.model?.status).toBe("success");
    expect(window.localStorage.getItem(apiActiveTaskStorageKey)).toBeNull();
  });

  it("restores the saved task by requesting the server task endpoint", async () => {
    window.localStorage.setItem(apiActiveTaskStorageKey, JSON.stringify({ id: "task-1", startedAt: Date.now() }));
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ model: success }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useApiGeneration(config));
    await waitFor(() => expect(result.current.model?.status).toBe("success"));
    expect(fetcher).toHaveBeenCalledWith("https://backend.example.test/api/tasks/task-1", expect.anything());
    expect(window.localStorage.getItem(apiActiveTaskStorageKey)).toBeNull();
  });

  it("stops browser polling without sending a server cancellation request", async () => {
    vi.useFakeTimers();
    const fetcher: typeof fetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://backend.example.test/api/generate");
      return new Response(JSON.stringify({ model: queued, warnings: [] }), { status: 202 });
    });
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useApiGeneration(config));
    await act(async () => { await result.current.start(new File(["image"], "sketch.png", { type: "image/png" }), {}); });
    await act(async () => { result.current.stopWaiting(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatch(/задача на сервере не отменена/i);
  });

  it("warns after five minutes and stops frontend polling after fifteen without cancelling the task", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-28T10:00:00Z");
    vi.setSystemTime(now);
    const requested: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input); requested.push(url);
      return new Response(JSON.stringify(url.endsWith("/api/generate") ? { model: queued, warnings: [] } : { model: queued }), { status: url.endsWith("/api/generate") ? 202 : 200 });
    };
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useApiGeneration(config));
    await act(async () => { await result.current.start(new File(["image"], "sketch.png", { type: "image/png" }), {}); });
    vi.setSystemTime(new Date(now.getTime() + 5 * 60_000));
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(result.current.longWait).toBe(true);
    vi.setSystemTime(new Date(now.getTime() + 15 * 60_000));
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(result.current.watching).toBe(false);
    expect(result.current.timedOut).toBe(true);
    expect(result.current.error).toMatch(/сервере не отменена/i);
    expect(requested.every((url) => !url.includes("cancel"))).toBe(true);
  });
});
