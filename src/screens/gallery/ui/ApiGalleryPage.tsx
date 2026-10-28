"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiConfig, ApiModel, GarmentType } from "@/src/entities/generated-model/model/generation-contracts";
import { validateGalleryName } from "@/src/entities/generated-model/model/gallery-storage";
import { apiModelDownloadUrl, deleteApiModel, getApiConfig, getApiModel, listApiModels, regenerateApiModel, updateApiModel } from "@/src/features/api-models/model/api-model-service";
import { useApiGeneration } from "@/src/features/api-models/model/use-api-generation";
import { DemoModelViewer } from "@/src/features/view-demo-model/ui/DemoModelViewer";
import type { RuntimeConfig } from "@/src/shared/config/runtime-config";

interface Props { config: RuntimeConfig }
const fallbackGarmentOptions: Array<{ value: GarmentType | ""; label: string }> = [
  { value: "", label: "Все типы" }, { value: "dress", label: "Платье" }, { value: "t-shirt", label: "Футболка" },
  { value: "shirt", label: "Рубашка" }, { value: "jacket", label: "Куртка" }, { value: "trousers", label: "Брюки" }, { value: "skirt", label: "Юбка" }, { value: "other", label: "Другое" },
];
const garmentLabel = (type: string | null, options: Array<{ value: string; label: string }>) => options.find((item) => item.value === type)?.label ?? type ?? "Тип не указан";

export function ApiGalleryPage({ config }: Props) {
  const [models, setModels] = useState<ApiModel[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [query, setQuery] = useState("");
  const [garment, setGarment] = useState<GarmentType | "">("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ApiModel | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const requestIdRef = useRef(0);
  const generation = useApiGeneration(config);

  const reload = useCallback(async (search = query, type = garment) => {
    const requestId = ++requestIdRef.current;
    try {
      const result = await listApiModels(config, { search, type });
      if (requestId === requestIdRef.current) { setModels(result); setError(null); }
    } catch (reason) {
      if (requestId === requestIdRef.current) setError(reason instanceof Error ? reason.message : "Не удалось загрузить галерею.");
    } finally {
      if (requestId === requestIdRef.current) { setLoading(false); setReady(true); }
    }
  }, [config, garment, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(query, garment); }, 0);
    return () => window.clearTimeout(timer);
  }, [query, garment, reload]);
  useEffect(() => {
    void getApiConfig(config).then((result) => { setApiConfig(result); setConfigError(null); }).catch((reason: unknown) => setConfigError(reason instanceof Error ? reason.message : "Не удалось загрузить конфигурацию backend."));
  }, [config]);
  const generationModelId = generation.model?.id;
  const generationStatus = generation.model?.status;
  const generationProgress = generation.model?.progress;
  useEffect(() => {
    if (!generationModelId) return;
    const timer = window.setTimeout(() => { void reload(query, garment); }, 0);
    return () => window.clearTimeout(timer);
  }, [generationModelId, generationProgress, generationStatus, query, garment, reload]);
  useEffect(() => {
    if (viewing) closeButtonRef.current?.focus();
    const restore = openerRef.current;
    return () => restore?.focus();
  }, [viewing]);

  const orderedModels = useMemo(() => [...models].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [models]);

  async function saveName(model: ApiModel) {
    const invalid = validateGalleryName(name);
    if (invalid) { setNameError(invalid); return; }
    setActionBusy(model.id); setError(null);
    try {
      await updateApiModel(config, model.id, { name: name.trim() });
      setRenaming(null); setNameError(null); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось переименовать модель."); }
    finally { setActionBusy(null); }
  }

  async function remove(model: ApiModel) {
    if (!window.confirm(`Удалить модель «${model.name}» из серверной галереи?`)) return;
    setActionBusy(model.id); setError(null);
    try { await deleteApiModel(config, model.id); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось удалить модель."); }
    finally { setActionBusy(null); }
  }

  async function openViewer(model: ApiModel, opener: HTMLElement) {
    openerRef.current = opener; setViewing(model); setDetailLoading(true); setError(null);
    try { setViewing(await getApiModel(config, model.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось загрузить модель."); }
    finally { setDetailLoading(false); }
  }

  async function regenerate(model: ApiModel) {
    setActionBusy(model.id); setError(null); setNotice(null);
    try {
      const result = await regenerateApiModel(config, model.id, { garmentType: model.garmentType ?? undefined, quality: model.quality, texture: model.texture, provider: model.provider });
      setNotice(result.warnings.join(" ") || `Повторная генерация запущена: ${result.model.name}.`);
      generation.watchModel(result.model);
      await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось запустить повторную генерацию."); }
    finally { setActionBusy(null); }
  }

  async function retryConfig() {
    setConfigError(null);
    try { setApiConfig(await getApiConfig(config)); }
    catch (reason) { setConfigError(reason instanceof Error ? reason.message : "Не удалось загрузить конфигурацию backend."); }
  }

  const currentGeneration = generation.model;
  const garmentOptions = apiConfig?.garmentTypes.map((option) => typeof option === "string" ? { value: option, label: option } : { value: option.value, label: option.label ?? option.value }) ?? fallbackGarmentOptions;

  return <main className="workspace-shell gallery-shell api-gallery-shell">
    <header className="site-header"><Link className="brand" href="/" aria-label="Threadly — начало"><span className="brand-mark" aria-hidden="true">t</span><span>threadly</span></Link><nav className="main-nav" aria-label="Основная навигация"><Link className="nav-link" href="/">Создать</Link><a className="nav-link nav-link-active" href="#models" aria-current="page">Галерея</a></nav><span className="header-note">API MODE · СЕРВЕРНАЯ ГАЛЕРЕЯ</span></header>
    <div className="gallery-heading"><div><p className="eyebrow">ВАША КОЛЛЕКЦИЯ</p><h1>Галерея моделей</h1><p className="page-intro">Модели загружаются с backend. Здесь отображаются серверные статусы и файлы.</p></div><Link className="gallery-create button" href="/">Создать новую модель <span aria-hidden="true">↗</span></Link></div>
    <section className="gallery-notice"><strong>Серверная галерея</strong><span>Данные и файлы принадлежат настроенному backend. Локальные демо-записи здесь не показываются.</span></section>
    {configError && <p className="gallery-warning" role="alert">{configError}<button type="button" className="text-button" onClick={() => void retryConfig()}>Повторить загрузку конфигурации</button></p>}{error && <p className="gallery-warning" role="alert">{error}<button type="button" className="text-button" onClick={() => void reload()}>Повторить загрузку галереи</button></p>}{notice && <p className="gallery-warning" role="status">{notice}</p>}
    {currentGeneration && <p className="gallery-warning" role="status">Задача «{currentGeneration.name}»: {statusLabel(currentGeneration)}{generation.watching && currentGeneration.progress !== null ? ` · ${currentGeneration.progress}%` : ""}{generation.longWait ? " · генерация длится больше пяти минут" : ""}{generation.timedOut ? " · ожидание на frontend прекращено; серверная задача не отменена" : ""}{generation.watching && <button type="button" className="text-button" onClick={generation.stopWaiting}>Остановить ожидание</button>}</p>}
    <div className="gallery-filters"><label>Поиск по названию<input type="search" value={query} onChange={(event) => { setLoading(true); setQuery(event.target.value); }} placeholder="Например, летнее платье" /></label><label>Тип одежды<select value={garment} onChange={(event) => { setLoading(true); setGarment(event.target.value as GarmentType | ""); }}>{garmentOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button type="button" className="gallery-clear" onClick={() => { setLoading(true); setQuery(""); setGarment(""); }} disabled={!query && !garment}>Сбросить</button><span className="gallery-count">{models.length} моделей</span></div>
    {loading && <p role="status" className="gallery-empty">Обновляем серверную галерею…</p>}
    {!loading && ready && orderedModels.length === 0 && <div className="gallery-empty" id="models"><span className="gallery-empty-mark" aria-hidden="true">◌</span><h2>{query || garment ? "Ничего не найдено" : "Пока нет моделей"}</h2><p>{query || garment ? "Измените поиск или фильтр, чтобы увидеть записи." : "Создайте модель на сервере — она появится здесь после ответа API."}</p>{(query || garment) && <button type="button" className="button button-secondary" onClick={() => { setQuery(""); setGarment(""); }}>Очистить поиск и фильтр</button>}</div>}
    {!loading && orderedModels.length > 0 && <div className="gallery-grid" id="models">{orderedModels.map((model) => <article className="gallery-card" key={model.id}>
      <div className="gallery-preview api-gallery-preview">{model.previewUrl ? <Image src={model.previewUrl} alt={`Превью модели «${model.name}»`} width={600} height={420} unoptimized /> : <span className="gallery-preview-symbol" aria-hidden="true">◌</span>}<span className="gallery-preview-type">{model.status === "success" && model.modelUrl ? "3D · GLB" : statusLabel(model)}</span></div>
      <div className="gallery-card-body">{renaming === model.id ? <form className="gallery-rename" onSubmit={(event) => { event.preventDefault(); void saveName(model); }}><label htmlFor={`api-rename-${model.id}`}>Новое название</label><input id={`api-rename-${model.id}`} autoFocus maxLength={60} value={name} onChange={(event) => { setName(event.target.value); setNameError(null); }} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? `api-rename-error-${model.id}` : undefined} />{nameError && <small id={`api-rename-error-${model.id}`} role="alert">{nameError}</small>}<div><button type="submit" disabled={actionBusy === model.id}>Сохранить</button><button type="button" onClick={() => { setRenaming(null); setNameError(null); }}>Отмена</button></div></form> : <><div className="gallery-card-title"><h2>{model.name}</h2><span className="gallery-status">{statusLabel(model)}</span></div><dl><div><dt>Тип</dt><dd>{garmentLabel(model.garmentType, garmentOptions)}</dd></div><div><dt>Создана</dt><dd><time dateTime={model.createdAt}>{formatDate(model.createdAt)}</time></dd></div></dl>{model.error && <p className="gallery-warning">{model.error}</p>}<div className="gallery-actions">{model.status === "success" && model.modelUrl && <button type="button" className="gallery-open" onClick={(event) => void openViewer(model, event.currentTarget)}>Открыть 3D</button>}{model.status === "success" && apiModelDownloadUrl(config, model) && <a className="gallery-action-link" href={apiModelDownloadUrl(config, model)!} download>Скачать GLB</a>}<button type="button" onClick={() => { setName(model.name); setRenaming(model.id); }} disabled={actionBusy === model.id}>Переименовать</button><button type="button" onClick={() => void regenerate(model)} disabled={actionBusy === model.id || model.status === "queued" || model.status === "running"}>Повторить генерацию</button><button type="button" className="gallery-delete" onClick={() => void remove(model)} disabled={actionBusy === model.id}>Удалить</button></div></>}</div>
    </article>)}</div>}
    {viewing && <div className="gallery-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewing(null); }}><section className="gallery-modal" role="dialog" aria-modal="true" aria-labelledby="api-gallery-modal-title" onKeyDown={(event) => { if (event.key === "Escape") setViewing(null); }}><div className="gallery-modal-heading"><div><p className="eyebrow">СЕРВЕРНАЯ МОДЕЛЬ</p><h2 id="api-gallery-modal-title">{viewing.name}</h2></div><button ref={closeButtonRef} type="button" aria-label="Закрыть просмотр" onClick={() => setViewing(null)}>×</button></div>{detailLoading ? <p role="status">Загружаем данные модели…</p> : <>{viewing.sketchUrl && <figure className="api-sketch-source"><Image src={viewing.sketchUrl} alt={`Исходный эскиз модели «${viewing.name}»`} width={480} height={360} unoptimized /><figcaption>Исходный эскиз{viewing.sketchWidth && viewing.sketchHeight ? ` · ${viewing.sketchWidth} × ${viewing.sketchHeight} px` : ""}</figcaption></figure>}{viewing.status === "success" && viewing.modelUrl ? <DemoModelViewer key={viewing.id} src={viewing.modelUrl} description={`Серверная 3D-модель ${viewing.name}`} demo={false} downloadUrl={apiModelDownloadUrl(config, viewing) ?? undefined} modelName={viewing.id} /> : <p>Для этой модели пока нет готового GLB.</p>}</>}</section></div>}
    <footer className="page-footer"><span>THREADLY · STUDIO TOOLS</span><span>СЕРВЕРНАЯ ГАЛЕРЕЯ</span></footer>
  </main>;
}

function statusLabel(model: ApiModel): string {
  if (model.status === "queued") return "В очереди";
  if (model.status === "running" || model.status === "processing") return "Генерация";
  if (model.status === "success" || model.status === "completed") return "Готова";
  if (model.status === "failed") return "Ошибка";
  return model.status;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(date) : "Дата неизвестна";
}
