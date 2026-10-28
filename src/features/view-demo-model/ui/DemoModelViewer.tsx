"use client";

import { useEffect, useRef, useState } from "react";
import type { ModelViewerElement } from "@google/model-viewer";

type Viewer = ModelViewerElement & HTMLElement;
type LoadState = "loading" | "ready" | "error";

interface DemoModelViewerProps {
  src?: string;
  description?: string;
  demo?: boolean;
  downloadUrl?: string;
  modelName?: string;
}

const backgrounds = [
  { label: "Светлый", value: "#f5f5f2" },
  { label: "Тёмный", value: "#252622" },
  { label: "Тёплый", value: "#e9dfd2" },
] as const;

const views = [
  { label: "Спереди", orbit: "0deg 75deg 105%" },
  { label: "Сбоку", orbit: "90deg 75deg 105%" },
  { label: "Сзади", orbit: "180deg 75deg 105%" },
] as const;

export function DemoModelViewer({ src = "/models/corset.glb", description = "Демонстрационная 3D-модель корсета", demo = true, downloadUrl, modelName = "threadly-model" }: DemoModelViewerProps) {
  const viewerRef = useRef<Viewer | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [autoRotate, setAutoRotate] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [exposure, setExposure] = useState(1);
  const [arAvailable, setArAvailable] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    const viewer = viewerRef.current;
    let handleLoad: (() => void) | undefined;
    let handleError: (() => void) | undefined;
    import("@google/model-viewer").then(() => {
      if (!active || !viewer) return;
      handleLoad = () => {
        setLoadState("ready");
        setArAvailable(viewer.canActivateAR);
      };
      handleError = () => setLoadState("error");
      viewer.addEventListener("load", handleLoad);
      viewer.addEventListener("error", handleError);
      viewer.src = src;
      viewer.alt = description;
      viewer.cameraControls = true;
      viewer.ar = true;
      viewer.interactionPrompt = "auto";
    }).catch(() => { if (active) setLoadState("error"); });
    return () => {
      active = false;
      if (viewer && handleLoad && handleError) {
        viewer.removeEventListener("load", handleLoad);
        viewer.removeEventListener("error", handleError);
      }
    };
  }, [description, src]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === viewerRef.current?.closest(".demo-viewer"));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function setView(orbit: string) {
    if (viewerRef.current) viewerRef.current.cameraOrbit = orbit;
  }

  function resetCamera() {
    if (!viewerRef.current) return;
    viewerRef.current.cameraOrbit = "0deg 75deg 105%";
    viewerRef.current.cameraTarget = "auto";
    viewerRef.current.fieldOfView = "auto";
    viewerRef.current.jumpCameraToGoal();
  }

  async function takePng() {
    let url: string | undefined;
    try {
      const blob = await viewerRef.current?.toBlob({ mimeType: "image/png" });
      if (!blob) throw new Error("Screenshot unavailable");
      url = URL.createObjectURL(blob);
      triggerDownload(url, "threadly-demo-model.png");
      setActionError(null);
    } catch {
      setActionError("Не удалось создать PNG-снимок. Попробуйте ещё раз.");
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  async function downloadModel() {
    let url: string | undefined;
    try {
      const response = await fetch(downloadUrl ?? "/models/corset.glb");
      if (!response.ok) throw new Error("Model download failed");
      url = URL.createObjectURL(await response.blob());
      triggerDownload(url, `${modelName}.glb`);
      setActionError(null);
    } catch {
      setActionError("Не удалось скачать GLB-модель. Попробуйте ещё раз.");
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  function triggerDownload(url: string, filename: string) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  }

  async function toggleFullscreen() {
    const stage = viewerRef.current?.closest(".demo-viewer");
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) await document.exitFullscreen();
      else await stage.requestFullscreen();
      setActionError(null);
    } catch {
      setActionError("Не удалось переключить полноэкранный режим в этом браузере.");
    }
  }

  async function activateAr() {
    try {
      if (!viewerRef.current?.canActivateAR) return;
      await viewerRef.current.activateAR();
      setActionError(null);
    } catch {
      setActionError("Не удалось открыть AR на этом устройстве.");
    }
  }

  return (
    <div id="demo-model-viewer" className="demo-viewer" tabIndex={-1} aria-label="Просмотр демонстрационной 3D-модели">
      <div className="demo-stage" style={{ backgroundColor: backgrounds[backgroundIndex].value }}>
        <model-viewer ref={viewerRef as React.RefObject<HTMLElement & ModelViewerElement>} camera-controls touch-action="pan-y" shadow-intensity="1" exposure={exposure} environment-image="neutral" />
        {loadState === "loading" && <div className="demo-viewer-state" role="status">Загружаем демонстрационную модель…</div>}
        {loadState === "error" && <div className="demo-viewer-state demo-viewer-error" role="alert"><strong>Не удалось загрузить модель</strong><span>Попробуйте обновить страницу.</span></div>}
        <span className="demo-badge">{demo ? "Демо-модель · CC0" : "Серверная модель"}</span>
        <button className="demo-fullscreen" type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Выйти из полноэкранного режима" : "Открыть на весь экран"}>⛶</button>
      </div>
      <div className="demo-controls" aria-label="Управление просмотром">
        <div className="demo-control-group" aria-label="Ракурс">
          {views.map((view) => <button type="button" key={view.label} onClick={() => setView(view.orbit)}>{view.label}</button>)}
          <button type="button" onClick={resetCamera}>Сбросить камеру</button>
        </div>
        <div className="demo-control-group">
          <button type="button" aria-pressed={autoRotate} onClick={() => { const nextAutoRotate = !autoRotate; setAutoRotate(nextAutoRotate); if (viewerRef.current) viewerRef.current.autoRotate = nextAutoRotate; }}>{autoRotate ? "Остановить поворот" : "Автоповорот"}</button>
          <label>Фон <select aria-label="Фон сцены" value={backgroundIndex} onChange={(event) => setBackgroundIndex(Number(event.target.value))}>{backgrounds.map((bg, index) => <option key={bg.label} value={index}>{bg.label}</option>)}</select></label>
          <label>Свет <input aria-label="Яркость освещения" type="range" min="0.5" max="1.8" step="0.1" value={exposure} onChange={(event) => { const value = Number(event.target.value); setExposure(value); if (viewerRef.current) viewerRef.current.exposure = value; }} /></label>
        </div>
        <div className="demo-control-group">
          {downloadUrl || demo ? <button type="button" onClick={() => void downloadModel()}>Скачать GLB</button> : null}
          <button type="button" onClick={takePng} disabled={loadState !== "ready"}>Скачать PNG</button>
          <button type="button" onClick={() => void activateAr()} disabled={!arAvailable} title={arAvailable ? "Открыть модель в AR" : "AR недоступна на этом устройстве или в этом браузере"}>Просмотр в AR</button>
        </div>
      </div>
      {actionError && <p className="demo-action-error" role="alert">{actionError}</p>}
      <p className="demo-viewer-help">Вращайте мышью или касанием, прокручивайте для приближения. AR зависит от поддержки устройства и браузера.</p>
    </div>
  );
}

export function DemoModelPreview({ src = "/models/corset.glb", description = "Демонстрационная модель Corset" }: DemoModelViewerProps) {
  const previewRef = useRef<Viewer | null>(null);

  useEffect(() => {
    let active = true;
    import("@google/model-viewer").then(() => {
      const preview = previewRef.current;
      if (!active || !preview) return;
      preview.src = src;
      preview.alt = description;
      preview.cameraControls = false;
      preview.interactionPrompt = "none";
      preview.reveal = "auto";
      preview.loading = "lazy";
    }).catch(() => undefined);
    return () => { active = false; };
  }, [description, src]);

  return <model-viewer ref={previewRef as React.RefObject<HTMLElement & ModelViewerElement>} className="demo-model-preview" aria-label={description} environment-image="neutral" />;
}
