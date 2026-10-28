import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryPage } from "./GalleryPage";
import { createDemoGalleryModel, galleryStorageKey, serializeGallery } from "@/src/entities/generated-model/model/gallery-storage";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/src/features/view-demo-model/ui/DemoModelViewer", () => ({ DemoModelViewer: ({ src }: { src: string }) => <div data-testid="viewer" data-src={src} />, DemoModelPreview: ({ src }: { src: string }) => <div data-testid="preview" data-src={src} /> }));

const models = [
  createDemoGalleryModel({ id: "one", name: "Летнее платье", garmentType: "dress", createdAt: "2025-01-01T00:00:00.000Z" }),
  createDemoGalleryModel({ id: "two", name: "Белая рубашка", garmentType: "shirt", createdAt: "2025-02-01T00:00:00.000Z" }),
];

describe("gallery screen", () => {
  beforeEach(() => { window.localStorage.clear(); vi.restoreAllMocks(); });

  it("restores records and combines search with garment filtering", async () => {
    window.localStorage.setItem(galleryStorageKey, serializeGallery(models));
    const user = userEvent.setup();
    render(<GalleryPage />);
    expect(await screen.findByRole("heading", { name: "Белая рубашка" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Поиск по названию" }), "летнее");
    await user.selectOptions(screen.getByLabelText("Тип одежды"), "dress");
    expect(screen.getByRole("heading", { name: "Летнее платье" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Белая рубашка" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    expect(screen.getByText("2 из 2")).toBeInTheDocument();
  });

  it("renames with validation, opens the viewer and downloads the local demo", async () => {
    window.localStorage.setItem(galleryStorageKey, serializeGallery([models[0]]));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<GalleryPage />);
    await user.click(await screen.findByRole("button", { name: "Переименовать" }));
    await user.clear(screen.getByLabelText("Новое название"));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Введите название");
    await user.type(screen.getByLabelText("Новое название"), "Новый образ");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByRole("heading", { name: "Новый образ" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(galleryStorageKey)!).models[0].name).toBe("Новый образ");
    await user.click(screen.getByRole("button", { name: "Открыть 3D" }));
    expect(screen.getByTestId("viewer")).toHaveAttribute("data-src", "/models/corset.glb");
    expect(screen.getByRole("button", { name: "Закрыть просмотр" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Открыть 3D" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Скачать GLB" }));
    expect(click).toHaveBeenCalled();
  });

  it("deletes only after confirmation, and shows empty and malformed storage states", async () => {
    window.localStorage.setItem(galleryStorageKey, serializeGallery([models[0]]));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<GalleryPage />);
    await user.click(await screen.findByRole("button", { name: "Удалить" }));
    expect(screen.getByRole("heading", { name: "Летнее платье" })).toBeInTheDocument();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Летнее платье" })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Пока нет моделей" })).toBeInTheDocument();
    expect(window.localStorage.getItem(galleryStorageKey)).not.toContain("Летнее платье");
  });

  it("explains when localStorage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    render(<GalleryPage />);
    await waitFor(() => expect(screen.getByText("Локальное хранилище недоступно. Галерея работает только до закрытия страницы.")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Пока нет моделей" })).toBeInTheDocument();
  });

  it("shows a recovery message and remains usable with malformed saved JSON", async () => {
    window.localStorage.setItem(galleryStorageKey, "{broken");
    render(<GalleryPage />);
    await waitFor(() => expect(screen.getByText(/Не удалось прочитать локальные данные галереи/)).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Пока нет моделей" })).toBeInTheDocument();
  });
});
