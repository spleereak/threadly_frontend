import { describe, expect, it } from "vitest";
import type { GenerationSettings } from "@/src/entities/generated-model/model/generation-contracts";
import {
  demoGenerationMaxAgeMs,
  initialDemoGenerationState,
  reduceDemoGeneration,
  restoreDemoGeneration,
  serializeDemoGeneration,
} from "./demo-generation";

const settings: GenerationSettings = {
  garmentType: "dress",
  modelName: "Летнее платье",
  includeTextures: true,
  quality: "high",
  provider: "meshy",
};

describe("demo generation state and recovery", () => {
  it("allows only the expected state transitions and caps progress", () => {
    let state = reduceDemoGeneration(initialDemoGenerationState, { type: "start", imageName: "sketch.png", runId: "run-a" });
    expect(state.status).toBe("uploading");
    expect(reduceDemoGeneration(state, { type: "start", imageName: "again.png", runId: "run-b" })).toBe(state);
    state = reduceDemoGeneration(state, { type: "queued" });
    expect(state.status).toBe("queued");
    state = reduceDemoGeneration(state, { type: "generating" });
    state = reduceDemoGeneration(state, { type: "progress", value: 500 });
    expect(state.progress).toBe(99);
    state = reduceDemoGeneration(state, { type: "complete" });
    expect(state).toMatchObject({ status: "completed", progress: 100 });
    expect(reduceDemoGeneration(state, { type: "fail", message: "late failure" })).toBe(state);
  });

  it("persists settings and task metadata without file contents or preview URLs", () => {
    const state = reduceDemoGeneration(initialDemoGenerationState, { type: "start", imageName: "sketch.png", runId: "run-a" });
    const raw = serializeDemoGeneration(state, settings, 1_000);
    const restored = restoreDemoGeneration(raw, 1_001);

    expect(restored.settings).toEqual(settings);
    expect(restored.state.imageName).toBe("sketch.png");
    expect(raw).not.toContain("blob:");
    expect(raw).not.toContain("sketch contents");
  });

  it("converts interrupted active work into a recoverable failure after reload", () => {
    let active = reduceDemoGeneration(initialDemoGenerationState, { type: "start", imageName: "jacket.png", runId: "run-a" });
    active = reduceDemoGeneration(active, { type: "queued" });
    active = reduceDemoGeneration(active, { type: "generating" });

    const restored = restoreDemoGeneration(serializeDemoGeneration(active, settings, 5_000), 5_100);
    expect(restored.state).toMatchObject({ status: "failed", progress: 0 });
    expect(restored.state.errorMessage).toMatch(/прервался после перезагрузки/);
    expect(restored.state.notice).toMatch(/jacket\.png.*Загрузите его снова/);
  });

  it("restores completed demo results and settings while explaining the missing input", () => {
    let completed = reduceDemoGeneration(initialDemoGenerationState, { type: "start", imageName: "coat.png", runId: "run-a" });
    completed = reduceDemoGeneration(completed, { type: "queued" });
    completed = reduceDemoGeneration(completed, { type: "generating" });
    completed = reduceDemoGeneration(completed, { type: "complete" });

    const restored = restoreDemoGeneration(serializeDemoGeneration(completed, settings, 10_000), 10_001);
    expect(restored.state.status).toBe("completed");
    expect(restored.settings).toEqual(settings);
    expect(restored.state.notice).toMatch(/coat\.png.*не восстановлено/);
  });

  it("resets expired and malformed records instead of restoring an endless task", () => {
    const active = reduceDemoGeneration(initialDemoGenerationState, { type: "start", imageName: "old.png", runId: "run-a" });
    const expired = restoreDemoGeneration(serializeDemoGeneration(active, settings, 1_000), 1_000 + demoGenerationMaxAgeMs + 1);
    expect(expired.state.status).toBe("idle");
    expect(expired.state.notice).toMatch(/устарел и был сброшен/);
    expect(expired.settings).toEqual(settings);

    expect(restoreDemoGeneration("{broken").state.notice).toMatch(/Не удалось восстановить/);
  });

  it("does not restore a completed result marked with the failure scenario", () => {
    const completed = reduceDemoGeneration(
      reduceDemoGeneration(reduceDemoGeneration(initialDemoGenerationState, { type: "start", imageName: "coat.png", runId: "run-fail" }), { type: "queued" }),
      { type: "generating" },
    );
    const invalidSavedData = serializeDemoGeneration({ ...completed, status: "completed", scenario: "failure", progress: 100 }, settings);
    const restored = restoreDemoGeneration(invalidSavedData);
    expect(restored.state.status).toBe("idle");
    expect(restored.state.notice).toMatch(/восстановить/);
  });
});
