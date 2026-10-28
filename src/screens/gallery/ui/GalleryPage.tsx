"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GarmentType } from "@/src/entities/generated-model/model/generation-contracts";
import { sortGalleryModels, validateGalleryName, type GalleryModel } from "@/src/entities/generated-model/model/gallery-storage";
import { demoGalleryRepository } from "@/src/features/gallery/model/demo-gallery-repository";
import { DemoModelPreview, DemoModelViewer } from "@/src/features/view-demo-model/ui/DemoModelViewer";

const garments: { value: GarmentType | ""; label: string }[] = [
  { value: "", label: "Все типы" }, { value: "dress", label: "Платье" }, { value: "t-shirt", label: "Футболка" },
  { value: "shirt", label: "Рубашка" }, { value: "jacket", label: "Куртка" }, { value: "trousers", label: "Брюки" },
  { value: "skirt", label: "Юбка" }, { value: "other", label: "Другое" },
];

const garmentLabel = (type: GarmentType | null) => garments.find((item) => item.value === type)?.label ?? "Тип не указан";

export function GalleryPage() {
  const [models, setModels] = useState<GalleryModel[]>([]);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [garment, setGarment] = useState<GarmentType | "">("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<GalleryModel | null>(null);
  const closeViewerRef = useRef<HTMLButtonElement>(null);
  const viewerOpenerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const restored = demoGalleryRepository.list();
        setModels(restored.models);
        setWarning(restored.warning);
      } catch {
        setWarning("Локальное хранилище недоступно. Галерея работает только до закрытия страницы.");
      } finally {
        setReady(true);
      }
    }, 0);
    const unsubscribe = demoGalleryRepository.subscribe((restored) => {
      setModels(restored.models);
      setWarning(restored.warning);
    });
    return () => { window.clearTimeout(hydrationTimer); unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!viewing) return;
    closeViewerRef.current?.focus();
    const restoreFocus = viewerOpenerRef.current;
    return () => restoreFocus?.focus();
  }, [viewing]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    return sortGalleryModels(models).filter((model) => (!needle || model.name.toLocaleLowerCase("ru").includes(needle)) && (!garment || model.garmentType === garment));
  }, [garment, models, query]);

  function saveName(model: GalleryModel) {
    const error = validateGalleryName(name);
    if (error) { setNameError(error); return; }
    const result = demoGalleryRepository.rename(model.id, name.trim());
    setModels(result.models);
    setWarning(result.warning);
    setRenaming(null);
    setNameError(null);
  }

  function remove(model: GalleryModel) {
    if (!window.confirm(`Удалить запись «${model.name}» из галереи? Общий файл демонстрационной модели останется доступен.`)) return;
    const result = demoGalleryRepository.remove(model.id);
    setModels(result.models);
    setWarning(result.warning);
  }

  function download(model: GalleryModel) {
    const anchor = document.createElement("a");
    anchor.href = model.modelUrl;
    anchor.download = `${model.name.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/g, "") || "demo-model"}.glb`;
    anchor.click();
  }

  function handleViewerKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setViewing(null);
      return;
    }
    if (event.key !== "Tab") return;
    const modal = event.currentTarget;
    const focusable = Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <main className="workspace-shell gallery-shell">
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Threadly — начало"><span className="brand-mark" aria-hidden="true">t</span><span>threadly</span></Link>
      <nav className="main-nav" aria-label="Основная навигация"><Link className="nav-link" href="/">Создать</Link><Link className="nav-link nav-link-active" href="/gallery" aria-current="page">Галерея</Link></nav>
      <span className="header-note">ИНСТРУМЕНТ ДЛЯ ДИЗАЙНЕРОВ</span>
    </header>
    <div className="gallery-heading"><div><p className="eyebrow">ВАША КОЛЛЕКЦИЯ</p><h1>Галерея моделей</h1><p className="page-intro">Завершённые демонстрационные сценарии и доступные локальные модели.</p></div><Link className="gallery-create button" href="/">Создать новую модель <span aria-hidden="true">↗</span></Link></div>
    <section className="gallery-notice" aria-label="О локальных данных"><strong>Локальная галерея</strong><span>Записи хранятся только в этом браузере. Демо-модель не создана из загруженного эскиза; бинарные файлы здесь не сохраняются.</span></section>
    {warning && <p className="gallery-warning" role="status">{warning}</p>}
    <div className="gallery-filters"><label>Поиск по названию<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например, летнее платье" /></label><label>Тип одежды<select value={garment} onChange={(event) => setGarment(event.target.value as GarmentType | "")}>{garments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button type="button" className="gallery-clear" onClick={() => { setQuery(""); setGarment(""); }} disabled={!query && !garment}>Сбросить</button><span className="gallery-count">{filtered.length} из {models.length}</span></div>
    {!ready ? <p className="gallery-empty" role="status">Загружаем локальную галерею…</p> : filtered.length === 0 ? <div className="gallery-empty"><span className="gallery-empty-mark" aria-hidden="true">◌</span><h2>{models.length ? "Ничего не найдено" : "Пока нет моделей"}</h2><p>{models.length ? "Измените поиск или фильтр, чтобы увидеть записи." : "Завершите успешный демо-сценарий на экране создания. Локальный Corset будет помечен как демонстрационный результат."}</p>{(query || garment) && <button type="button" className="button button-secondary" onClick={() => { setQuery(""); setGarment(""); }}>Очистить поиск и фильтр</button>}</div> : <div className="gallery-grid">{filtered.map((model) => <article className="gallery-card" key={model.id}>
      <div className="gallery-preview"><DemoModelPreview src={model.modelUrl} description={`${model.name}, демонстрационное 3D-превью`} /><span className="gallery-demo-tag">ДЕМО · CC0</span><span className="gallery-preview-type">3D · GLB</span></div>
      <div className="gallery-card-body">{renaming === model.id ? <form className="gallery-rename" onSubmit={(event) => { event.preventDefault(); saveName(model); }}><label htmlFor={`rename-${model.id}`}>Новое название</label><input id={`rename-${model.id}`} autoFocus maxLength={60} value={name} onChange={(event) => { setName(event.target.value); setNameError(null); }} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? `rename-error-${model.id}` : undefined} />{nameError && <small id={`rename-error-${model.id}`} role="alert">{nameError}</small>}<div><button type="submit">Сохранить</button><button type="button" onClick={() => { setRenaming(null); setNameError(null); }}>Отмена</button></div></form> : <><div className="gallery-card-title"><h2>{model.name}</h2><span className="gallery-status">Готова · демо</span></div><dl><div><dt>Тип</dt><dd>{garmentLabel(model.garmentType)}</dd></div><div><dt>Создана</dt><dd><time dateTime={model.createdAt}>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(model.createdAt))}</time></dd></div></dl><div className="gallery-actions"><button type="button" className="gallery-open" onClick={(event) => { viewerOpenerRef.current = event.currentTarget; setViewing(model); }}>Открыть 3D</button><button type="button" onClick={() => download(model)}>Скачать GLB</button><button type="button" onClick={() => { setName(model.name); setRenaming(model.id); }}>Переименовать</button><button type="button" className="gallery-delete" onClick={() => remove(model)}>Удалить</button></div></>}</div>
    </article>)}</div>}
    {viewing && <div className="gallery-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewing(null); }}><section className="gallery-modal" role="dialog" aria-modal="true" aria-labelledby="gallery-modal-title" onKeyDown={handleViewerKeyDown}><div className="gallery-modal-heading"><div><p className="eyebrow">ДЕМО-МОДЕЛЬ · CC0</p><h2 id="gallery-modal-title">{viewing.name}</h2></div><button ref={closeViewerRef} type="button" aria-label="Закрыть просмотр" onClick={() => setViewing(null)}>×</button></div><DemoModelViewer src={viewing.modelUrl} description={`${viewing.name}, демонстрационная 3D-модель`} /><p className="gallery-modal-note">Локальный Corset для демонстрации просмотра; он не был сгенерирован из эскиза.</p></section></div>}
    <footer className="page-footer"><span>THREADLY · STUDIO TOOLS</span><span>СОЗДАНО ДЛЯ ИДЕЙ, КОТОРЫЕ МОЖНО ПОТРОГАТЬ</span></footer>
  </main>;
}
