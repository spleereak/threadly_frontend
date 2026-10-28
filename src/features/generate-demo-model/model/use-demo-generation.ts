import { useCallback, useEffect, useRef, useState } from "react";
import type { GenerationSettings } from "@/src/entities/generated-model/model/generation-contracts";
import {
  demoGenerationStorageKey,
  initialDemoGenerationState,
  isDemoGenerationActive,
  reduceDemoGeneration,
  restoreDemoGeneration,
  serializeDemoGeneration,
  type DemoGenerationEvent,
  type DemoGenerationState,
  type DemoScenario,
} from "./demo-generation";

const uploadDelayMs = 500;
const queueDelayMs = 500;
const generationTickMs = 250;
const progressStep = 14;

interface UseDemoGenerationOptions {
  settings: GenerationSettings;
  onSettingsRestored: (settings: GenerationSettings) => void;
}

export function useDemoGeneration({ settings, onSettingsRestored }: UseDemoGenerationOptions) {
  const [workflow, setWorkflow] = useState<DemoGenerationState>(initialDemoGenerationState);
  const [ready, setReady] = useState(false);
  const [persistenceWarning, setPersistenceWarning] = useState(false);
  const workflowRef = useRef(workflow);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceNameBeforeRestoreRef = useRef<string | null | undefined>(undefined);

  const commit = useCallback((event: DemoGenerationEvent) => {
    const next = reduceDemoGeneration(workflowRef.current, event);
    workflowRef.current = next;
    setWorkflow(next);
  }, []);

  useEffect(() => {
    const hydrationTimer = setTimeout(() => {
      try {
        const restored = restoreDemoGeneration(window.localStorage.getItem(demoGenerationStorageKey));
        const stateToRestore = sourceNameBeforeRestoreRef.current === undefined
          ? restored.state
          : reduceDemoGeneration(restored.state, { type: "source-image", name: sourceNameBeforeRestoreRef.current });
        workflowRef.current = stateToRestore;
        setWorkflow(stateToRestore);
        sourceNameBeforeRestoreRef.current = undefined;
        if (restored.settings) onSettingsRestored(restored.settings);
      } catch {
        const unavailable = {
          ...initialDemoGenerationState,
          imageName: sourceNameBeforeRestoreRef.current ?? null,
          notice: "Локальное сохранение недоступно. Демо-состояние останется только до закрытия страницы.",
        };
        sourceNameBeforeRestoreRef.current = undefined;
        workflowRef.current = unavailable;
        setWorkflow(unavailable);
        setPersistenceWarning(true);
      } finally {
        setReady(true);
      }
    }, 0);
    return () => clearTimeout(hydrationTimer);
  }, [onSettingsRestored]);

  useEffect(() => {
    if (!ready) return;
    let warningTimer: ReturnType<typeof setTimeout> | undefined;
    const persist = () => {
      try {
      window.localStorage.setItem(demoGenerationStorageKey, serializeDemoGeneration(workflow, settings));
      } catch {
        warningTimer = setTimeout(() => setPersistenceWarning(true), 0);
      }
    };
    if (workflow.status !== "generating") {
      persist();
      return () => { if (warningTimer) clearTimeout(warningTimer); };
    }
    const persistTimer = window.setTimeout(persist, 400);
    return () => { window.clearTimeout(persistTimer); if (warningTimer) clearTimeout(warningTimer); };
  }, [ready, settings, workflow]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const start = useCallback((file: File | null) => {
    if (!ready || !file || isDemoGenerationActive(workflowRef.current.status)) return false;

    commit({ type: "start", imageName: file.name, runId: crypto.randomUUID() });
    timerRef.current = setTimeout(() => {
      commit({ type: "queued" });
      timerRef.current = setTimeout(() => {
        commit({ type: "generating" });
        const tick = () => {
          const current = workflowRef.current;
          const nextProgress = current.progress + progressStep;
          if (nextProgress >= 100) {
            if (current.scenario === "success") commit({ type: "complete" });
            else commit({ type: "fail", message: "Демо-сценарий завершился выбранной ошибкой. Реальная генерация не запускалась." });
            timerRef.current = null;
            return;
          }
          commit({ type: "progress", value: nextProgress });
          timerRef.current = setTimeout(tick, generationTickMs);
        };
        timerRef.current = setTimeout(tick, generationTickMs);
      }, queueDelayMs);
    }, uploadDelayMs);
    return true;
  }, [commit, ready]);

  const setScenario = useCallback((scenario: DemoScenario) => commit({ type: "scenario", value: scenario }), [commit]);
  const setSourceImageName = useCallback((name: string | null) => {
    if (!ready) sourceNameBeforeRestoreRef.current = name;
    commit({ type: "source-image", name });
  }, [commit, ready]);

  return {
    workflow,
    ready,
    isActive: isDemoGenerationActive(workflow.status),
    canStart: ready && !isDemoGenerationActive(workflow.status),
    persistenceWarning,
    start,
    setScenario,
    setSourceImageName,
  };
}
