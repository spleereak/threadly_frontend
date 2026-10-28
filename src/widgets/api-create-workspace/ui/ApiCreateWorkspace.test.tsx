import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiCreateWorkspace } from "./ApiCreateWorkspace";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/src/features/view-demo-model/ui/DemoModelViewer", () => ({ DemoModelViewer: ({ description }: { description: string }) => <div>{description}</div> }));

const config = { mode: "api" as const, apiBaseUrl: "https://backend.example.test" };
const model = { id: "task-3", name: "Эскиз", garmentType: "dress", provider: "mock", texture: true, quality: "standard", status: "queued", progress: 10, error: null, sketchUrl: null, sketchWidth: null, sketchHeight: null, modelUrl: null, previewUrl: null, downloadUrl: null, creditsUsed: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: null };

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("API create workspace", () => {
  it("loads server form options and shows generation warnings and task status", async () => {
    const submitted = { form: null as FormData | null };
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/config")) return new Response(JSON.stringify({ garmentTypes: ["dress"], qualities: ["standard"], providers: ["mock"] }), { status: 200 });
      if (url.endsWith("/api/generate")) {
        submitted.form = init?.body as FormData;
        return new Response(JSON.stringify({ model, warnings: ["SMALL_IMAGE: Низкое разрешение"] }), { status: 202 });
      }
      return new Response(JSON.stringify({ model }), { status: 200 });
    };
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetcher);
    render(<ApiCreateWorkspace config={config} />);
    await screen.findByRole("combobox", { name: "Провайдер" });
    const file = new File(["image"], "sketch.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Выбрать файл"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Создать 3D-модель" }));
    expect(await screen.findByText("SMALL_IMAGE: Низкое разрешение")).toBeInTheDocument();
    expect(await screen.findByText("В очереди")).toBeInTheDocument();
    await waitFor(() => expect(submitted.form?.get("image")).toBeTruthy());
    expect(submitted.form?.get("provider")).toBe("mock");
    expect(submitted.form?.get("garmentType")).toBeNull();
  });

  it("shows server generation errors and does not create a ready result", async () => {
    const fetcher: typeof fetch = async (input) => {
      if (String(input).endsWith("/api/config")) return new Response(JSON.stringify({ garmentTypes: ["dress"], qualities: ["standard"], providers: ["mock"] }), { status: 200 });
      return new Response(JSON.stringify({ error: { code: "generation_failed", message: "Mock generation failed.", details: { hidden: true } } }), { status: 500 });
    };
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetcher);
    render(<ApiCreateWorkspace config={config} />);
    await screen.findByRole("combobox", { name: "Провайдер" });
    fireEvent.change(screen.getByLabelText("Выбрать файл"), { target: { files: [new File(["image"], "fail.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Создать 3D-модель" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mock generation failed.");
    expect(screen.queryByText("Модель готова")).not.toBeInTheDocument();
    expect(screen.queryByText(/hidden/)).not.toBeInTheDocument();
  });
});
