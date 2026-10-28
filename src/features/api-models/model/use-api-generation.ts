"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiGenerationOptions, ApiModel } from "@/src/entities/generated-model/model/generation-contracts";
import { ApiRequestError } from "@/src/shared/api/api-client";
import type { RuntimeConfig } from "@/src/shared/config/runtime-config";
import { generateApiModel, getApiTask, type ApiGenerationResponse } from "./api-model-service";

export const apiActiveTaskStorageKey = "atelier.api-active-task.v1";
const pollIntervalMs = 3_000;
const longWaitMs = 5 * 60_000;
const maxWaitMs = 15 * 60_000;

interface SavedTask { id: string; startedAt: number }
interface ApiGenerationState {
  model: ApiModel | null;
  warnings: string[];
  error: string | null;
  busy: boolean;
  watching: boolean;
  restored: boolean;
  startedAt: number | null;
  now: number;
  timedOut: boolean;
}

function getSavedTask(): SavedTask | null {
  try {
    const raw = localStorage.getItem(apiActiveTaskStorageKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "string" || value.id.length === 0 || !("startedAt" in value) || typeof value.startedAt !== "number" || !Number.isFinite(value.startedAt) || value.startedAt > Date.now() + 60_000) {
      localStorage.removeItem(apiActiveTaskStorageKey);
      return null;
    }
    return { id: value.id, startedAt: value.startedAt };
  } catch {
    try { localStorage.removeItem(apiActiveTaskStorageKey); } catch { /* Storage may be unavailable. */ }
    return null;
  }
}

function saveTask(task: SavedTask | null) {
  try {
    if (task) localStorage.setItem(apiActiveTaskStorageKey, JSON.stringify(task));
    else localStorage.removeItem(apiActiveTaskStorageKey);
  } catch { /* API task remains server-side when browser storage is unavailable. */ }
}

function isActive(model: ApiModel | null): boolean {
  return model?.status === "queued" || model?.status === "running";
}

export function useApiGeneration(config: RuntimeConfig) {
  const [state, setState] = useState<ApiGenerationState>({ model: null, warnings: [], error: null, busy: false, watching: false, restored: false, startedAt: null, now: Date.now(), timedOut: false });
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const applyTask = useCallback((model: ApiModel, startedAt: number) => {
    setState((current) => ({ ...current, model, startedAt, busy: false, error: model.status === "failed" ? model.error || "Генерация завершилась с ошибкой." : null, watching: isActive(model), timedOut: false }));
    if (isActive(model)) saveTask({ id: model.id, startedAt });
    else saveTask(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    const saved = getSavedTask();
    if (!saved) {
      setState((current) => ({ ...current, restored: true }));
      return () => { mounted = false; };
    }
    const elapsed = Date.now() - saved.startedAt;
    if (elapsed >= maxWaitMs) {
      setState((current) => ({ ...current, restored: true, startedAt: saved.startedAt, timedOut: true, error: "Прекратили ожидание через 15 минут. Задача на сервере могла продолжить работу; откройте галерею или начните новую." }));
      return () => { mounted = false; };
    }
    void getApiTask(config, saved.id).then((model) => {
      if (mounted) applyTask(model, saved.startedAt);
    }).catch((error: unknown) => {
      if (mounted) setState((current) => ({ ...current, restored: true, startedAt: saved.startedAt, error: messageOf(error) }));
    }).finally(() => {
      if (mounted) setState((current) => ({ ...current, restored: true }));
    });
    return () => { mounted = false; };
  }, [applyTask, config]);

  useEffect(() => {
    if (!state.watching || !state.model || !state.startedAt) return;
    const activeModelId = state.model.id;
    const startedAt = state.startedAt;
    let mounted = true;
    const poll = async () => {
      if (inFlight.current) return;
      const elapsed = Date.now() - startedAt;
      setState((current) => ({ ...current, now: Date.now() }));
      if (elapsed >= maxWaitMs) {
        setState((current) => ({ ...current, watching: false, timedOut: true, error: "Прекратили ожидание через 15 минут. Задача на сервере не отменена; проверьте галерею позже." }));
        return;
      }
      inFlight.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const model = await getApiTask(config, activeModelId, controller.signal);
        if (mounted) applyTask(model, startedAt);
      } catch (error) {
        if (mounted && !(error instanceof ApiRequestError && error.code === "aborted")) setState((current) => ({ ...current, error: messageOf(error) }));
      } finally {
        inFlight.current = false;
      }
    };
    const pollId = window.setInterval(() => { void poll(); }, pollIntervalMs);
    const clockId = window.setInterval(() => setState((current) => ({ ...current, now: Date.now() })), 1_000);
    return () => { mounted = false; window.clearInterval(pollId); window.clearInterval(clockId); abortRef.current?.abort(); };
  }, [applyTask, config, state.model, state.startedAt, state.watching]);

  const start = useCallback(async (file: File, options: ApiGenerationOptions) => {
    setState((current) => ({ ...current, busy: true, error: null, warnings: [], timedOut: false, model: null }));
    const startedAt = Date.now();
    try {
      const response: ApiGenerationResponse = await generateApiModel(config, file, options);
      applyTask(response.model, startedAt);
      setState((current) => ({ ...current, warnings: response.warnings }));
    } catch (error) {
      saveTask(null);
      setState((current) => ({ ...current, busy: false, model: null, watching: false, error: messageOf(error) }));
    }
  }, [applyTask, config]);

  const stopWaiting = useCallback(() => {
    abortRef.current?.abort();
    saveTask(null);
    setState((current) => ({ ...current, watching: false, error: "Ожидание остановлено только в браузере. Задача на сервере не отменена и может продолжиться." }));
  }, []);

  const watchModel = useCallback((model: ApiModel, startedAt = Date.now()) => {
    applyTask(model, startedAt);
    setState((current) => ({ ...current, error: null }));
  }, [applyTask]);

  const elapsed = state.startedAt ? state.now - state.startedAt : 0;
  return { ...state, longWait: state.watching && elapsed >= longWaitMs, start, stopWaiting, watchModel };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось выполнить запрос. Попробуйте ещё раз.";
}
