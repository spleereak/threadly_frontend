import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateWorkspace } from "@/src/widgets/create-workspace/ui/CreateWorkspace";

vi.mock("@google/model-viewer", () => ({}));

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:sketch-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("sketch upload", () => {
  it("shows a preview and file details after selecting a supported image, then removes it", async () => {
    const user = userEvent.setup();
    render(<CreateWorkspace />);

    const input = screen.getByLabelText("Выбрать файл");
    expect(screen.getByRole("button", { name: "Запустить демо-сценарий" })).toBeDisabled();
    const sketch = new File(["sketch contents"], "linen-dress.png", { type: "image/png" });
    await user.upload(input, sketch);

    expect(await screen.findByAltText("Предпросмотр эскиза: linen-dress.png")).toBeInTheDocument();
    expect(screen.getByText("linen-dress.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Запустить демо-сценарий" })).toBeEnabled();
    await user.click(screen.getByText("Дополнительно"));
    expect(screen.getByPlaceholderText("Например, летнее платье")).toHaveValue("linen-dress");

    await user.click(screen.getByRole("button", { name: "Убрать" }));
    expect(screen.queryByAltText("Предпросмотр эскиза: linen-dress.png")).not.toBeInTheDocument();
    expect(screen.getByText("Перетащите изображение сюда")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Запустить демо-сценарий" })).toBeDisabled();
  });

  it("explains why an unsupported file was rejected and keeps the input available", async () => {
    render(<CreateWorkspace />);
    const input = screen.getByLabelText("Выбрать файл");

    fireEvent.change(input, {
      target: { files: [new File(["text"], "notes.pdf", { type: "application/pdf" })] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Этот файл не подходит. Загрузите JPG, PNG или WEBP.");
    expect(screen.getByRole("button", { name: "Заменить файл" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Запустить демо-сценарий" })).toBeDisabled();
  });

  it("rejects an oversized image in the upload UI", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    render(<CreateWorkspace />);
    fireEvent.change(screen.getByLabelText("Выбрать файл"), { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Файл слишком большой");
    expect(screen.getByRole("button", { name: "Запустить демо-сценарий" })).toBeDisabled();
  });

  it("shows the low-resolution warning and keeps the demo action enabled", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 320, height: 480, close: vi.fn() })));
    const user = userEvent.setup();
    render(<CreateWorkspace />);
    await user.upload(screen.getByLabelText("Выбрать файл"), new File(["sketch"], "small.png", { type: "image/png" }));
    expect(await screen.findByText(/Картинка мелкая/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Запустить демо-сценарий" })).toBeEnabled();
  });

  it("accepts a valid image dropped into the upload area", async () => {
    render(<CreateWorkspace />);
    const image = new File(["sketch"], "front-view.jpg", { type: "image/jpeg" });

    fireEvent.drop(screen.getByText("Перетащите изображение сюда").closest(".drop-zone") as HTMLElement, {
      dataTransfer: { files: [image] },
    });

    expect(await screen.findByText("front-view.jpg")).toBeInTheDocument();
  });

  it("accepts an image pasted from the clipboard", async () => {
    render(<CreateWorkspace />);
    const image = new File(["sketch"], "pasted-sketch.png", { type: "image/png" });
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { items: [{ type: "image/png", getAsFile: () => image }] },
    });
    fireEvent(window, paste);

    await waitFor(() => expect(screen.getByText("pasted-sketch.png")).toBeInTheDocument());
  });

  it("lets the user change the optional generation settings", async () => {
    const user = userEvent.setup();
    render(<CreateWorkspace />);
    await user.click(screen.getByText("Дополнительно"));

    await user.selectOptions(screen.getByLabelText("Тип изделия"), "dress");
    expect(screen.getByLabelText("Тип изделия")).toHaveValue("dress");

    const textureSwitch = screen.getByRole("switch");
    expect(textureSwitch).toBeChecked();
    await user.click(textureSwitch);
    expect(textureSwitch).not.toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Высокое" }));
    expect(screen.getByRole("radio", { name: "Высокое" })).toBeChecked();

    await user.selectOptions(screen.getByLabelText("Сервис генерации"), "meshy");
    expect(screen.getByLabelText("Сервис генерации")).toHaveValue("meshy");
  });
});
