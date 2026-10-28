"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { RuntimeConfig } from "@/src/shared/config/runtime-config";
import { ApiRequestError, requestApi } from "@/src/shared/api/api-client";

interface ApiModeGateProps {
  config: RuntimeConfig;
  screen: "create" | "gallery";
  children: ReactNode;
}

export function ApiModeGate({ config, screen, children }: ApiModeGateProps) {
  const [state, setState] = useState<{ checking: boolean; reachable: boolean; message: string | null }>({ checking: true, reachable: false, message: null });
  const checkConnection = useCallback(async () => {
    setState({ checking: true, reachable: false, message: null });
    try {
      await requestApi<{ ok: true }>(config, "/api/health");
      setState({ checking: false, reachable: true, message: null });
    } catch (error) {
      setState({ checking: false, reachable: error instanceof ApiRequestError && error.kind !== "network", message: error instanceof Error ? error.message : "Не удалось проверить соединение." });
    }
  }, [config]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void checkConnection(); }, 0);
    return () => window.clearTimeout(timer);
  }, [checkConnection]);

  return <>
    <section className="api-mode-connection" aria-label="Состояние подключения к backend">
      <span><strong>API MODE</strong> · {screen === "create" ? "Создание" : "Галерея"}</span>
      <span role="status">{state.checking ? "Проверяем соединение…" : state.reachable ? "Сервер доступен" : "Нет соединения с сервером"}</span>
      {state.message && <span className="api-mode-error" role="alert">{state.message}</span>}
      <button type="button" className="text-button" onClick={() => void checkConnection()} disabled={state.checking}>{state.checking ? "Проверяем…" : "Повторить"}</button>
    </section>
    {children}
  </>;
}
