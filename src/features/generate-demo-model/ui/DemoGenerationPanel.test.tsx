import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationSettings } from "@/src/entities/generated-model/model/generation-contracts";
import { useDemoGeneration } from "../model/use-demo-generation";
import type { DemoGenerationState } from "../model/demo-generation";
import { DemoGenerationPanel } from "./DemoGenerationPanel";

const initialSettings: GenerationSettings = {
  garmentType: null,
  modelName: "",
  includeTextures: true,
  quality: "standard",
  provider: "tripo",
};

function DemoGenerationHarness({ file }: { file: File | null }) {
  const [settings, setSettings] = useState(initialSettings);
  const demo = useDemoGeneration({ settings, onSettingsRestored: setSettings });
  return (
    <>
      <span data-testid="restored-name">{settings.modelName}</span>
      <DemoGenerationPanel
        state={demo.workflow}
        canStart={demo.canStart}
        isActive={demo.isActive}
        hasImage={Boolean(file)}
        persistenceWarning={demo.persistenceWarning}
        onStart={() => { demo.start(file); }}
        onScenarioChange={demo.setScenario}
      />
    </>
  );
}

describe("DemoGenerationPanel workflow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it("requires a valid selected image and locks the action while a successful demo runs", () => {
    const file = new File(["not persisted"], "sketch.png", { type: "image/png" });
    const { rerender } = render(<DemoGenerationHarness file={null} />);
    act(() => vi.runOnlyPendingTimers());
    const startButton = screen.getByRole("button", { name: "Запустить демо-сценарий" });
    expect(startButton).toBeDisabled();
    expect(screen.getByTestId("workflow-live-status")).toHaveTextContent("Ожидает корректное изображение");

    rerender(<DemoGenerationHarness file={file} />);
    fireEvent.click(startButton);
    expect(screen.getByRole("button", { name: "Выполняется демонстрационный сценарий…" })).toBeDisabled();
    expect(screen.getByTestId("workflow-live-status")).toHaveTextContent("Имитация загрузки изображения");
    fireEvent.click(screen.getByRole("button", { name: "Выполняется демонстрационный сценарий…" }));
    expect(screen.getByTestId("workflow-live-status")).toHaveTextContent("Имитация загрузки изображения");

    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("workflow-live-status")).toHaveTextContent("ожидает в очереди");
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("workflow-live-status")).toHaveTextContent("Имитация генерации модели");
    expect(screen.getByRole("progressbar", { name: "Прогресс демонстрационного сценария" })).toBeInTheDocument();
    act(() => vi.runAllTimers());

    expect(screen.getByTestId("workflow-live-status")).toHaveTextContent("Демо-сценарий завершён");
    expect(screen.getByRole("heading", { name: "Демонстрационный результат готов" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть демонстрационную модель" })).toHaveAttribute("href", "#demo-model-viewer");
    expect(screen.getByText(/не результат обработки вашего эскиза/)).toBeInTheDocument();
  });

  it("runs the selectable failure scenario and allows retry", () => {
    render(<DemoGenerationHarness file={new File(["x"], "sketch.png", { type: "image/png" })} />);
    act(() => vi.runOnlyPendingTimers());
    fireEvent.click(screen.getByRole("radio", { name: "С ошибкой" }));
    fireEvent.click(screen.getByRole("button", { name: "Запустить демо-сценарий" }));
    expect(screen.getByRole("radio", { name: "С ошибкой" })).toBeDisabled();
    act(() => vi.runAllTimers());

    expect(screen.getByRole("alert")).toHaveTextContent("Демо-сценарий завершился ошибкой");
    expect(screen.getByRole("alert")).toHaveTextContent("Реальная генерация не запускалась");
    expect(screen.getByRole("button", { name: "Повторить демо-сценарий" })).toBeEnabled();
  });

  it("supports selecting a scenario and starting it with the keyboard", async () => {
    render(<DemoGenerationHarness file={new File(["x"], "sketch.png", { type: "image/png" })} />);
    act(() => vi.runOnlyPendingTimers());
    vi.useRealTimers();
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole("radio", { name: "Успешный" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "С ошибкой" })).toBeChecked();
    await user.tab();
    expect(screen.getByRole("button", { name: "Запустить демо-сценарий" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("workflow-live-status")).toHaveTextContent("Имитация загрузки изображения");
  });

  it("restores settings and terminal status, and asks for the original image again", () => {
    const savedState: DemoGenerationState = {
      runId: "saved-run",
      completedAt: new Date().toISOString(),
      status: "completed",
      progress: 100,
      scenario: "success",
      imageName: "saved-sketch.png",
      errorMessage: null,
      notice: null,
    };
    window.localStorage.setItem("atelier.demo-generation.v1", JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      status: savedState.status,
      progress: savedState.progress,
      scenario: savedState.scenario,
      imageName: savedState.imageName,
      errorMessage: null,
      settings: { ...initialSettings, modelName: "Сохранённая модель", provider: "meshy" },
    }));

    render(<DemoGenerationHarness file={null} />);
    act(() => vi.runOnlyPendingTimers());
    expect(screen.getByTestId("restored-name")).toHaveTextContent("Сохранённая модель");
    expect(screen.getByRole("heading", { name: "Демонстрационный результат готов" })).toBeInTheDocument();
    expect(screen.getByText(/Исходное изображение «saved-sketch\.png» не восстановлено/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Запустить демо-сценарий" })).toBeDisabled();
  });

  it("restores an interrupted task as failed instead of leaving it active", () => {
    window.localStorage.setItem("atelier.demo-generation.v1", JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      status: "generating",
      progress: 64,
      scenario: "success",
      imageName: "interrupted.png",
      errorMessage: null,
      settings: initialSettings,
    }));

    render(<DemoGenerationHarness file={null} />);
    act(() => vi.runOnlyPendingTimers());
    expect(screen.getByRole("alert")).toHaveTextContent("Демо-сценарий прервался после перезагрузки");
    expect(screen.getByText(/Исходное изображение «interrupted\.png» не сохранено/)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
