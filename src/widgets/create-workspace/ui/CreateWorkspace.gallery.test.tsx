import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateWorkspace } from "./CreateWorkspace";
import { galleryStorageKey } from "@/src/entities/generated-model/model/gallery-storage";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/src/features/upload-sketch/ui/UploadSketch", () => ({ UploadSketch: ({ onFileNameSuggested, onSelectionChange }: { onFileNameSuggested: (name: string) => void; onSelectionChange: (file: File) => void }) => <button type="button" onClick={() => { const file = new File(["sketch"], "coat.png", { type: "image/png" }); onFileNameSuggested("coat"); onSelectionChange(file); }}>Выбрать эскиз (тест)</button> }));
vi.mock("@/src/features/view-demo-model/ui/DemoModelViewer", () => ({ DemoModelViewer: () => <div /> }));

describe("create workflow gallery integration", () => {
  beforeEach(() => { window.localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("adds one demo record after success and none after failure", () => {
    const { unmount } = render(<CreateWorkspace />);
    act(() => vi.runOnlyPendingTimers());
    expect(screen.getByRole("link", { name: "Галерея" })).toHaveAttribute("href", "/gallery");
    fireEvent.click(screen.getByRole("button", { name: "Выбрать эскиз (тест)" }));
    fireEvent.click(screen.getByRole("button", { name: "Запустить демо-сценарий" }));
    act(() => vi.runAllTimers());
    let saved = JSON.parse(window.localStorage.getItem(galleryStorageKey) ?? "null");
    expect(saved.models).toHaveLength(1);
    expect(saved.models[0]).toMatchObject({ name: "coat", isDemo: true, modelUrl: "/models/corset.glb" });
    unmount();

    const reloaded = render(<CreateWorkspace />);
    act(() => vi.runOnlyPendingTimers());
    saved = JSON.parse(window.localStorage.getItem(galleryStorageKey) ?? "null");
    expect(saved.models).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Демонстрационный результат готов" })).toBeInTheDocument();
    reloaded.unmount();

    window.localStorage.clear();
    const failed = render(<CreateWorkspace />);
    act(() => vi.runOnlyPendingTimers());
    fireEvent.click(screen.getByRole("button", { name: "Выбрать эскиз (тест)" }));
    fireEvent.click(screen.getByRole("radio", { name: "С ошибкой" }));
    fireEvent.click(screen.getByRole("button", { name: "Запустить демо-сценарий" }));
    act(() => vi.runAllTimers());
    saved = JSON.parse(window.localStorage.getItem(galleryStorageKey) ?? "null");
    expect(saved).toBeNull();
    failed.unmount();
  });

  it("warns if the successful demo cannot be written to the gallery storage", async () => {
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === galleryStorageKey) throw new DOMException("Storage full", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });
    render(<CreateWorkspace />);
    act(() => vi.runOnlyPendingTimers());
    fireEvent.click(screen.getByRole("button", { name: "Выбрать эскиз (тест)" }));
    fireEvent.click(screen.getByRole("button", { name: "Запустить демо-сценарий" }));
    act(() => vi.runAllTimers());
    act(() => vi.runOnlyPendingTimers());
    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось сохранить результат в локальную галерею");
  });
});
