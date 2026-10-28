import type { DemoGenerationState, DemoGenerationStatus, DemoScenario } from "../model/demo-generation";

interface DemoGenerationPanelProps {
  state: DemoGenerationState;
  canStart: boolean;
  isActive: boolean;
  hasImage: boolean;
  persistenceWarning: boolean;
  onStart: () => void;
  onScenarioChange: (scenario: DemoScenario) => void;
}

const statusLabels: Record<DemoGenerationStatus, string> = {
  idle: "Готово к запуску",
  uploading: "Имитация загрузки изображения",
  queued: "Демо-сценарий ожидает в очереди",
  generating: "Имитация генерации модели",
  completed: "Демо-сценарий завершён",
  failed: "Демо-сценарий завершился ошибкой",
};

export function DemoGenerationPanel({ state, canStart, isActive, hasImage, persistenceWarning, onStart, onScenarioChange }: DemoGenerationPanelProps) {
  return (
    <div className="demo-generation-panel" aria-labelledby="demo-generation-heading">
      <div className="demo-generation-notice">
        <strong id="demo-generation-heading">Демонстрационный режим</strong>
        <p>Этапы ниже воспроизводятся локально. Tripo и Meshy не вызываются, реальная 3D-модель из эскиза не создаётся.</p>
      </div>

      <fieldset className="demo-scenario-picker" disabled={isActive || !canStart}>
        <legend>Сценарий для проверки</legend>
        <label><input type="radio" name="demo-scenario" value="success" checked={state.scenario === "success"} onChange={() => onScenarioChange("success")} /> Успешный</label>
        <label><input type="radio" name="demo-scenario" value="failure" checked={state.scenario === "failure"} onChange={() => onScenarioChange("failure")} /> С ошибкой</label>
      </fieldset>

      <button className="button button-primary demo-start-button" type="button" disabled={!canStart || !hasImage} onClick={onStart}>
        {isActive ? "Выполняется демонстрационный сценарий…" : state.status === "failed" ? "Повторить демо-сценарий" : "Запустить демо-сценарий"}
      </button>

      <div className="demo-workflow-status">
        <div className="demo-workflow-announcement" data-testid="workflow-live-status" role={state.status === "failed" ? "alert" : "status"} aria-live={state.status === "failed" ? "assertive" : "polite"} aria-atomic="true">
          <strong>{state.status === "idle" && !hasImage ? "Ожидает корректное изображение" : statusLabels[state.status]}</strong>
          {state.errorMessage && <p>{state.errorMessage}</p>}
        </div>
        {isActive && <progress max={100} value={state.progress} aria-label="Прогресс демонстрационного сценария" />}
        {isActive && <span>{state.progress}%</span>}
      </div>

      {!hasImage && <p className="demo-workflow-hint">Загрузите корректное изображение, чтобы запустить сценарий. После перезагрузки страницы файл нужно выбрать заново.</p>}
      {state.notice && <p className="demo-workflow-notice" role="status">{state.notice}</p>}
      {persistenceWarning && <p className="demo-workflow-notice" role="status">Браузер не сохранил демо-состояние. Оно будет доступно только до закрытия страницы.</p>}

      {state.status === "completed" && (
        <section className="demo-result" aria-labelledby="demo-result-heading">
          <h3 id="demo-result-heading">Демонстрационный результат готов</h3>
          <p>Это локальная модель Corset для примера, а не результат обработки вашего эскиза.</p>
          <a className="button button-secondary" href="#demo-model-viewer">Открыть демонстрационную модель</a>
        </section>
      )}
    </div>
  );
}
