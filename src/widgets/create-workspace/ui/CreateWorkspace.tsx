"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { UploadSketch } from "@/src/features/upload-sketch/ui/UploadSketch";
import type { GarmentType, GenerationProvider, GenerationSettings, ModelQuality } from "@/src/entities/generated-model/model/generation-contracts";
import { DemoGenerationPanel } from "@/src/features/generate-demo-model/ui/DemoGenerationPanel";
import { useDemoGeneration } from "@/src/features/generate-demo-model/model/use-demo-generation";
import { workspaceCopy as copy } from "../config/copy";
import { DemoModelViewer } from "@/src/features/view-demo-model/ui/DemoModelViewer";
import { demoGalleryRepository } from "@/src/features/gallery/model/demo-gallery-repository";

export function CreateWorkspace() {
  const [modelName, setModelName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [garment, setGarment] = useState<GarmentType | null>(null);
  const [textures, setTextures] = useState(true);
  const [quality, setQuality] = useState<ModelQuality>("standard");
  const [service, setService] = useState<GenerationProvider>("tripo");
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [galleryPersistenceWarning, setGalleryPersistenceWarning] = useState(false);
  const sketchFileRef = useRef<File | null>(null);

  const suggestModelName = useCallback((name: string) => {
    if (!nameEdited) setModelName(name);
  }, [nameEdited]);

  const generationSettings = useMemo<GenerationSettings>(() => ({
    garmentType: garment,
    modelName,
    includeTextures: textures,
    quality,
    provider: service,
  }), [garment, modelName, quality, service, textures]);

  const restoreSettings = useCallback((settings: GenerationSettings) => {
    setGarment(settings.garmentType);
    if (sketchFileRef.current) {
      setModelName((currentName) => currentName || settings.modelName);
    } else {
      setModelName(settings.modelName);
      setNameEdited(settings.modelName.length > 0);
    }
    setTextures(settings.includeTextures);
    setQuality(settings.quality);
    setService(settings.provider);
  }, []);

  const demo = useDemoGeneration({ settings: generationSettings, onSettingsRestored: restoreSettings });
  const setDemoSourceImageName = demo.setSourceImageName;

  useEffect(() => {
    if (!demo.ready || demo.workflow.status !== "completed" || !demo.workflow.runId) return;
    const result = demoGalleryRepository.addCompleted({
      id: demo.workflow.runId,
      name: generationSettings.modelName,
      garmentType: generationSettings.garmentType,
      createdAt: demo.workflow.completedAt ?? undefined,
    });
    const warningTimer = result.warning ? window.setTimeout(() => setGalleryPersistenceWarning(true), 0) : undefined;
    return () => { if (warningTimer !== undefined) window.clearTimeout(warningTimer); };
  }, [demo.ready, demo.workflow.completedAt, demo.workflow.runId, demo.workflow.status, generationSettings]);

  const handleSketchChange = useCallback((file: File | null) => {
    sketchFileRef.current = file;
    setSketchFile(file);
    setDemoSourceImageName(file?.name ?? null);
  }, [setDemoSourceImageName]);

  return (
    <main className="workspace-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label={copy.brandAria}>
          <span className="brand-mark" aria-hidden="true">t</span><span>{copy.brand}</span>
        </a>
        <nav className="main-nav" aria-label={copy.mainNavigation}>
          <a className="nav-link nav-link-active" href="#create" aria-current="page">{copy.createTab}</a>
          <Link className="nav-link" href="/gallery">{copy.galleryTab}</Link>
        </nav>
        <span className="header-note">{copy.headerNote}</span>
      </header>

      <div className="page-heading" id="top">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="page-intro">{copy.intro}</p>
        </div>
        <div className="step-indicator" aria-label={copy.stepLabel}>
          <span className="step-current">{copy.firstStep}</span><span className="step-line" /><span>{copy.secondStep}</span>
        </div>
      </div>

      <div className="create-grid" id="create">
        <section className="form-column" aria-label="Подготовка эскиза и настройки">
          <UploadSketch onFileNameSuggested={suggestModelName} onSelectionChange={handleSketchChange} disabled={demo.isActive} />

          <section className="panel settings-panel" aria-labelledby="settings-heading">
            <div className="section-heading">
              <div className="section-number">02</div>
              <div><h2 id="settings-heading">{copy.settingsTitle}</h2><p>{copy.settingsIntro}</p></div>
            </div>
            <details className="advanced-settings">
              <summary>{copy.advancedTitle}<ChevronDown className="summary-caret size-4" aria-hidden="true" /></summary>
              <fieldset className="settings-fields settings-fields-lock" disabled={demo.isActive || !demo.ready} aria-label="Настройки генерации">
                <label className="field">
                  <span>{copy.garmentLabel}</span>
                  <select value={garment ?? ""} onChange={(event) => setGarment((event.target.value || null) as GarmentType | null)}>
                    <option value="">{copy.garmentPlaceholder}</option>
                    {copy.garments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>{copy.nameLabel}</span>
                  <input value={modelName} maxLength={60} placeholder={copy.namePlaceholder} onChange={(event) => { setModelName(event.target.value); setNameEdited(true); }} />
                  <small>{copy.nameHelp}</small>
                </label>
                <fieldset className="field fieldset">
                  <legend>{copy.textureLabel}</legend>
                  <label className="switch-row">
                    <span className="switch-copy">{textures ? copy.enabled : copy.disabled}<small>{copy.textureHelp}</small></span>
                    <input type="checkbox" role="switch" checked={textures} onChange={(event) => setTextures(event.target.checked)} />
                  </label>
                </fieldset>
                <fieldset className="field fieldset">
                  <legend>{copy.qualityLabel}</legend>
                  <div className="segmented-control" role="radiogroup" aria-label={copy.qualityLabel}>
                    <label><input type="radio" name="quality" value="standard" checked={quality === "standard"} onChange={() => setQuality("standard")} /><span>{copy.standard}</span></label>
                    <label><input type="radio" name="quality" value="high" checked={quality === "high"} onChange={() => setQuality("high")} /><span>{copy.high}</span></label>
                  </div>
                </fieldset>
                <label className="field">
                  <span>{copy.serviceLabel}</span>
                  <select value={service} onChange={(event) => setService(event.target.value as GenerationProvider)}>
                    <option value="tripo">{copy.tripo}</option><option value="meshy">{copy.meshy}</option>
                  </select>
                </label>
              </fieldset>
            </details>
            <div className="generate-area">
              <DemoGenerationPanel
                state={demo.workflow}
                canStart={demo.canStart}
                isActive={demo.isActive}
                hasImage={Boolean(sketchFile)}
                persistenceWarning={demo.persistenceWarning}
                onStart={() => { setGalleryPersistenceWarning(false); demo.start(sketchFile); }}
                onScenarioChange={demo.setScenario}
              />
              {galleryPersistenceWarning && <p className="demo-workflow-notice" role="alert">Не удалось сохранить результат в локальную галерею. Он останется только на этом экране до закрытия страницы.</p>}
            </div>
          </section>
        </section>

        <section className="viewer-column" aria-labelledby="viewer-heading">
          <div className="viewer-topline">
            <div><p className="eyebrow">{copy.viewerEyebrow}</p><span className="viewer-format">{copy.viewerFormat}</span></div>
            <span className="viewer-status"><span className="status-dot" />{copy.viewerLabel}</span>
          </div>
          <div className="viewer-empty">
            <div className="viewer-demo-intro"><span className="viewer-lockup" aria-hidden="true">◌</span><h2 id="viewer-heading">Демонстрационный просмотр модели</h2><p>Локальная модель Corset для знакомства с управлением. Это не результат генерации.</p></div>
            <DemoModelViewer />
          </div>
          <p className="viewer-footnote">{copy.viewerFoot}</p>
        </section>
      </div>
      <footer className="page-footer"><span>{copy.footerBrand}</span><span>{copy.footerSlogan}</span></footer>
    </main>
  );
}
