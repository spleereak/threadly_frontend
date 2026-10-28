import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoModelPreview, DemoModelViewer } from "./DemoModelViewer";

vi.mock("@google/model-viewer", () => ({}));

describe("DemoModelViewer", () => {
  it("loads card previews lazily and without interactive controls", async () => {
    render(<DemoModelPreview description="Превью Corset" />);
    const preview = await waitFor(() => {
      const element = document.querySelector("model-viewer") as unknown as HTMLElement & Record<string, unknown>;
      expect(element?.src).toBe("/models/corset.glb");
      return element;
    });
    expect(preview.alt).toBe("Превью Corset");
    expect(preview.loading).toBe("lazy");
    expect(preview.cameraControls).toBe(false);
  });

  beforeEach(() => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:demo"), revokeObjectURL: vi.fn() });
  });

  it("loads the local demo model and applies camera, lighting, and background controls", async () => {
    render(<DemoModelViewer />);
    const viewer = await waitFor(() => {
      const element = document.querySelector("model-viewer") as unknown as HTMLElement & Record<string, unknown>;
      expect(element?.src).toBe("/models/corset.glb");
      return element;
    });
    viewer.jumpCameraToGoal = vi.fn();
    viewer.toBlob = vi.fn(async () => new Blob(["png"], { type: "image/png" }));
    viewer.canActivateAR = true;
    viewer.activateAR = vi.fn();
    const fetchModel = vi.fn(async () => ({ ok: true, blob: async () => new Blob(["glb"]) }) as Response);
    vi.stubGlobal("fetch", fetchModel);
    expect(screen.getByRole("status")).toHaveTextContent("Загружаем");
    expect(viewer.ar).toBe(true);
    fireEvent(viewer, new Event("load"));
    expect(await screen.findByRole("button", { name: "Скачать PNG" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Сбоку" }));
    expect(viewer.cameraOrbit).toBe("90deg 75deg 105%");
    fireEvent.click(screen.getByRole("button", { name: "Сбросить камеру" }));
    expect(viewer.cameraOrbit).toBe("0deg 75deg 105%");
    expect(viewer.fieldOfView).toBe("auto");
    expect(viewer.jumpCameraToGoal).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Автоповорот" }));
    expect(viewer.autoRotate).toBe(true);
    fireEvent.change(screen.getByRole("slider", { name: "Яркость освещения" }), { target: { value: "1.5" } });
    expect(viewer.exposure).toBe(1.5);
    fireEvent.change(screen.getByRole("combobox", { name: "Фон сцены" }), { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "Открыть на весь экран" }).parentElement).toHaveStyle({ backgroundColor: "#252622" });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Скачать GLB" }));
    await waitFor(() => expect(fetchModel).toHaveBeenCalledWith("/models/corset.glb"));
    await waitFor(() => expect(anchorClick).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Скачать PNG" }));
    await waitFor(() => expect(viewer.toBlob).toHaveBeenCalledWith({ mimeType: "image/png" }));
    await waitFor(() => expect(anchorClick).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Просмотр в AR" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Просмотр в AR" }));
    expect(viewer.activateAR).toHaveBeenCalledOnce();
    const fullscreen = vi.fn(async () => {});
    const stage = viewer.closest(".demo-viewer")!;
    Object.defineProperty(stage, "requestFullscreen", { configurable: true, value: fullscreen });
    fireEvent.click(screen.getByRole("button", { name: "Открыть на весь экран" }));
    await waitFor(() => expect(fullscreen).toHaveBeenCalledOnce());
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: stage });
    fireEvent(document, new Event("fullscreenchange"));
    const exitFullscreen = vi.fn(async () => {});
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
    fireEvent.click(await screen.findByRole("button", { name: "Выйти из полноэкранного режима" }));
    await waitFor(() => expect(exitFullscreen).toHaveBeenCalledOnce());
  });

  it("shows a model error and keeps model dependent actions unavailable", async () => {
    render(<DemoModelViewer />);
    const viewer = await waitFor(() => document.querySelector("model-viewer"));
    fireEvent(viewer!, new Event("error"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить модель");
    expect(screen.getByRole("button", { name: "Скачать PNG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Просмотр в AR" })).toBeDisabled();
  });

  it("reports PNG, GLB, fullscreen, and AR failures to the user", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    render(<DemoModelViewer />);
    const viewer = await waitFor(() => {
      const element = document.querySelector("model-viewer") as unknown as HTMLElement & Record<string, unknown>;
      expect(element?.src).toBe("/models/corset.glb");
      return element;
    });
    viewer.toBlob = vi.fn(async () => { throw new Error("Canvas capture failed"); });
    viewer.canActivateAR = true;
    viewer.activateAR = vi.fn(async () => { throw new Error("AR unavailable"); });
    fireEvent(viewer, new Event("load"));
    fireEvent.click(screen.getByRole("button", { name: "Скачать PNG" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Не удалось создать PNG-снимок"));
    fireEvent.click(screen.getByRole("button", { name: "Скачать GLB" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Не удалось скачать GLB-модель"));
    const fullscreen = vi.fn(async () => { throw new Error("Fullscreen denied"); });
    Object.defineProperty(viewer.closest(".demo-viewer"), "requestFullscreen", { configurable: true, value: fullscreen });
    fireEvent.click(screen.getByRole("button", { name: "Открыть на весь экран" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Не удалось переключить полноэкранный режим"));
    fireEvent.click(screen.getByRole("button", { name: "Просмотр в AR" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Не удалось открыть AR"));
  });
});
