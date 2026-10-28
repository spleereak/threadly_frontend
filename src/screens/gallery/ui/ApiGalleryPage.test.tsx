import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiGalleryPage } from "./ApiGalleryPage";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/src/features/view-demo-model/ui/DemoModelViewer", () => ({ DemoModelViewer: ({ description }: { description: string }) => <div>{description}</div> }));

const config = { mode: "api" as const, apiBaseUrl: "https://backend.example.test" };
const model = { id: "model-1", name: "Платье", garmentType: "dress", provider: "mock", texture: true, quality: "standard", status: "success", progress: 100, error: null, sketchUrl: "/sketch.png", sketchWidth: 700, sketchHeight: 900, modelUrl: "/model.glb", previewUrl: "/preview.png", downloadUrl: "/api/models/model-1/download", creditsUsed: 0, createdAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-20T10:00:00Z", completedAt: "2026-10-20T10:01:00Z" };

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("API gallery", () => {
  it("combines server search and type filters and offers server model actions", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    let currentModel = model;
    let deleted = false;
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input); const method = init?.method ?? "GET"; calls.push({ url, method });
      if (url.includes("/api/models?") || url.endsWith("/api/models")) return new Response(JSON.stringify({ models: deleted ? [] : [currentModel] }), { status: 200 });
      if (url.endsWith("/regenerate")) return new Response(JSON.stringify({ model: { ...currentModel, id: "task-new", status: "queued", progress: 0 }, warnings: [] }), { status: 202 });
      if (method === "PATCH") { currentModel = { ...currentModel, name: JSON.parse(String(init?.body)).name }; return new Response(JSON.stringify({ model: currentModel }), { status: 200 }); }
      if (method === "DELETE") { deleted = true; return new Response(null, { status: 204 }); }
      if (url.includes("/api/tasks/")) return new Response(JSON.stringify({ model: { ...currentModel, status: "queued" } }), { status: 200 });
      return new Response(JSON.stringify({ model: currentModel }), { status: 200 });
    };
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ApiGalleryPage config={config} />);
    expect(await screen.findByRole("heading", { name: "Платье" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск по названию" }), { target: { value: "летнее" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Тип одежды" }), { target: { value: "dress" } });
    await waitFor(() => expect(calls.some((call) => { const params = new URL(call.url).searchParams; return params.get("search") === "летнее" && params.get("type") === "dress"; })).toBe(true));

    const card = screen.getByRole("article");
    expect(within(card).getByRole("img", { name: "Превью модели «Платье»" })).toHaveAttribute("src", "https://backend.example.test/preview.png");
    expect(within(card).getByRole("link", { name: "Скачать GLB" })).toHaveAttribute("href", "https://backend.example.test/api/models/model-1/download");
    fireEvent.click(within(card).getByRole("button", { name: "Открыть 3D" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Серверная 3D-модель Платье");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Закрыть просмотр" }));

    fireEvent.click(within(card).getByRole("button", { name: "Переименовать" }));
    fireEvent.change(screen.getByLabelText("Новое название"), { target: { value: "Платье летнее" } });
    fireEvent.click(within(card).getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByRole("heading", { name: "Платье летнее" })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Повторить генерацию" }));
    await waitFor(() => expect(calls.some((call) => call.url.endsWith("/api/models/model-1/regenerate"))).toBe(true));
    expect(screen.getByText(/Повторная генерация запущена/)).toBeInTheDocument();
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(within(card).getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(calls.some((call) => call.method === "DELETE")).toBe(true));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Ничего не найдено" })).toBeInTheDocument();
  });
});
