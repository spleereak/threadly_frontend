import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "../../../../app/page";

vi.mock("@google/model-viewer", () => ({}));

describe("create route viewer integration", () => {
  it("shows the demo model viewer through the App Router page composition", async () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "Демонстрационный просмотр модели" })).toBeInTheDocument();
    expect(screen.getByText("Локальная модель Corset для знакомства с управлением. Это не результат генерации.")).toBeInTheDocument();

    await waitFor(() => {
      const viewer = document.querySelector("model-viewer");
      expect(viewer).not.toBeNull();
      expect((viewer as unknown as { src: string }).src).toBe("/models/corset.glb");
    });
  });
});
