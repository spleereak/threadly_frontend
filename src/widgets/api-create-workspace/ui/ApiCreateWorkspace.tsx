"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ApiConfig, ApiConfigOption, ApiGenerationOptions, ApiModel } from "@/src/entities/generated-model/model/generation-contracts";
import { UploadSketch } from "@/src/features/upload-sketch/ui/UploadSketch";
import { DemoModelViewer } from "@/src/features/view-demo-model/ui/DemoModelViewer";
import { getApiConfig, apiModelDownloadUrl } from "@/src/features/api-models/model/api-model-service";
import { useApiGeneration } from "@/src/features/api-models/model/use-api-generation";
import type { RuntimeConfig } from "@/src/shared/config/runtime-config";

interface Props { config: RuntimeConfig }
const labelFor = (value: string | ApiConfigOption) => typeof value === "string" ? value : value.label ?? value.value;
const valueFor = (value: string | ApiConfigOption) => typeof value === "string" ? value : value.value;
const garmentLabels: Record<string, string> = { dress: "Платье", "t-shirt": "Футболка", shirt: "Рубашка", jacket: "Куртка", trousers: "Брюки", skirt: "Юбка", other: "Другое" };

export function ApiCreateWorkspace({ config }: Props) {
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [garmentType, setGarmentType] = useState("");
  const [quality, setQuality] = useState("");
  const [texture, setTexture] = useState(true);
  const [provider, setProvider] = useState("");
  const api = useApiGeneration(config);

  const loadConfig = useCallback(async () => {
    try {
      const result = await getApiConfig(config);
      setApiConfig(result);
      setQuality((current) => current || valueFor(result.qualities[0]));
      setProvider((current) => current || valueFor(result.providers[0]));
    } catch (error) { setConfigError(error instanceof Error ? error.message : "Не удалось загрузить параметры генерации."); }
  }, [config]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadConfig(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConfig]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    const options: ApiGenerationOptions = {
      ...(name.trim() ? { name: name.trim() } : {}),
      ...(garmentType ? { garmentType: garmentType as ApiGenerationOptions["garmentType"] } : {}),
      ...(quality ? { quality: quality as ApiGenerationOptions["quality"] } : {}),
      texture,
      ...(provider ? { provider } : {}),
    };
    void api.start(file, options);
  };

  const model = api.model;
  const isRunning = model?.status === "queued" || model?.status === "running";
  const percent = typeof model?.progress === "number" ? Math.max(0, Math.min(100, model.progress)) : null;
  const resolvedDownload = model ? apiModelDownloadUrl(config, model) : null;

  return <main className="workspace-shell">
    <header className="site-header"><Link className="brand" href="/" aria-label="Threadly — начало"><span className="brand-mark" aria-hidden="true">t</span><span>threadly</span></Link><nav className="main-nav" aria-label="Основная навигация"><a className="nav-link nav-link-active" href="#create" aria-current="page">Создать</a><Link className="nav-link" href="/gallery">Галерея</Link></nav><span className="header-note">API MODE</span></header>
    <div className="page-heading" id="top"><div><p className="eyebrow">ЭСКИЗ → 3D</p><h1>Начните с вашего эскиза</h1><p className="page-intro">Изображение отправляется настроенному backend. Результат и статус получены от сервера.</p></div><div className="step-indicator"><span className="step-current">01</span><span className="step-line" /><span>02</span></div></div>
    <div className="create-grid" id="create">
      <section className="form-column" aria-label="Подготовка эскиза и настройки">
        <UploadSketch onFileNameSuggested={(suggested) => setName((current) => current || suggested)} onSelectionChange={setFile} disabled={Boolean(api.busy || api.watching)} maxFileSizeBytes={apiConfig?.limits?.maxFileSizeBytes} minImageSide={apiConfig?.limits?.minImageSide} />
        <form className="panel settings-panel" onSubmit={submit}>
          <div className="section-heading"><div className="section-number">02</div><div><h2>Настройки</h2><p>Доступные параметры загружаются из конфигурации backend.</p></div></div>
          {configError && <div role="alert" className="api-operation-error"><p>{configError}</p><button className="button button-secondary" type="button" onClick={() => void loadConfig()}>Повторить</button></div>}
          {!apiConfig && !configError && <p role="status">Загружаем параметры backend…</p>}
          {apiConfig && <div className="api-settings-grid">
            <label className="field"><span>Тип изделия</span><select value={garmentType} onChange={(event) => setGarmentType(event.target.value)}><option value="">Не выбран</option>{apiConfig.garmentTypes.map((option) => <option key={valueFor(option)} value={valueFor(option)}>{garmentLabels[valueFor(option)] ?? labelFor(option)}</option>)}</select></label>
            <label className="field"><span>Название модели</span><input maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, летнее платье" /></label>
            <label className="field"><span>Качество</span><select value={quality} onChange={(event) => setQuality(event.target.value)}>{apiConfig.qualities.map((option) => <option key={valueFor(option)} value={valueFor(option)}>{labelFor(option)}</option>)}</select></label>
            <label className="field"><span>Провайдер</span><select value={provider} onChange={(event) => setProvider(event.target.value)}>{apiConfig.providers.map((option) => <option key={valueFor(option)} value={valueFor(option)}>{labelFor(option)}</option>)}</select></label>
            <label className="switch-row"><span className="switch-copy">Сохранить цвет и текстуры</span><input type="checkbox" role="switch" checked={texture} onChange={(event) => setTexture(event.target.checked)} /></label>
          </div>}
          <div className="generate-area"><button className="button button-primary" type="submit" disabled={!file || !apiConfig || api.busy || api.watching}>{api.busy ? "Отправляем эскиз…" : isRunning ? "Генерация выполняется" : "Создать 3D-модель"}</button>
            {api.error && <p className="api-operation-error" role="alert">{api.error}</p>}
            {api.warnings.map((warning, index) => <p className="inline-warning" role="status" key={`${warning}-${index}`}>{warning}</p>)}
            {model && <section className="api-task-status" aria-live="polite"><strong>{statusLabel(model)}</strong>{percent !== null && isRunning && <><progress max={100} value={percent} aria-label="Прогресс генерации" /><span>{percent}%</span></>}{isRunning && <p>Запрос выполняется на сервере. Закрытие вкладки не отменяет генерацию.</p>}{api.longWait && <p role="status">Генерация длится больше пяти минут. Можно продолжить ожидание.</p>}{api.timedOut && <p role="status">Ожидание остановлено на frontend; задача на сервере могла продолжиться.</p>}{api.watching && <button type="button" className="text-button" onClick={api.stopWaiting}>Остановить ожидание</button>}{model.status === "failed" && model.error && <p role="alert">{model.error}</p>}</section>}
          </div>
        </form>
      </section>
      <section className="viewer-column" aria-labelledby="api-viewer-title"><div className="viewer-topline"><div><p className="eyebrow">ПРЕДПРОСМОТР</p><span className="viewer-format">GLB · 3D</span></div><span className="viewer-status"><span className="status-dot" />{model?.status === "success" && model.modelUrl ? "Готовый результат" : "Ожидание результата"}</span></div>
        <div className="viewer-empty">{model?.status === "success" && model.modelUrl ? <><h2 className="sr-only" id="api-viewer-title">{model.name}</h2><DemoModelViewer key={model.id} src={model.modelUrl} description={`Серверная модель: ${model.name}`} demo={false} downloadUrl={resolvedDownload ?? undefined} modelName={fileSafeName(model.name)} /></> : <div className="viewer-demo-intro"><span className="viewer-lockup" aria-hidden="true">◌</span><h2 id="api-viewer-title">3D-просмотр результата</h2><p>{model?.status === "success" ? "Сервер не вернул ссылку на GLB для этой модели." : "Здесь появится модель после успешной генерации на backend. Демонстрационный Corset не подменяет серверный результат."}</p></div>}</div>
        <p className="viewer-footnote">Файл модели предоставляется backend.</p></section>
    </div>
    <footer className="page-footer"><span>THREADLY · STUDIO TOOLS</span><span>РЕЖИМ API</span></footer>
  </main>;
}

function statusLabel(model: ApiModel): string {
  if (model.status === "queued") return "В очереди";
  if (model.status === "running") return "Генерация модели";
  if (model.status === "success") return "Модель готова";
  if (model.status === "failed") return "Генерация завершилась с ошибкой";
  return model.status;
}

function fileSafeName(name: string): string {
  return name.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/g, "") || "model";
}
