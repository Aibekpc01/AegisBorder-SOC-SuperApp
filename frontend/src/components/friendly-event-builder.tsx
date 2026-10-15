import { useState } from "react";
import {
  buildTrainingEvents,
  trainingPresets,
  type TrainingEvent,
} from "../lib/training-events";
import { Button } from "./ui/button";

export function FriendlyEventBuilder({
  onPrepared,
  onEdited,
  disabled,
}: {
  onPrepared: (events: TrainingEvent[]) => void;
  onEdited: () => void;
  disabled: boolean;
}) {
  const [preset, setPreset] = useState("unknown-usb"),
    [device, setDevice] = useState("TRAINING-PC"),
    [account, setAccount] = useState("training-user"),
    [repeats, setRepeats] = useState("1"),
    [error, setError] = useState("");
  return (
    <div className="friendly-event-form">
      <h3>Опишите учебное действие</h3>
      <p>
        Заполните обычные поля. Система сама подготовит записи в нужном формате.
      </p>
      <label>
        Что произошло?
        <select
          value={preset}
          disabled={disabled}
          onChange={(e) => {
            setPreset(e.target.value);
            setRepeats(
              String(
                trainingPresets.find((p) => p.id === e.target.value)?.repeats ||
                  1,
              ),
            );
            setError("");
            onEdited();
          }}
        >
          {trainingPresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <div className="module-form-grid">
        <label>
          Учебный компьютер
          <input
            value={device}
            maxLength={80}
            disabled={disabled}
            onChange={(e) => {
              setDevice(e.target.value);
              onEdited();
            }}
          />
          <small className="field-note">
            Любое вымышленное название, например «Учебный компьютер 1».
          </small>
        </label>
        <label>
          Учебный пользователь
          <input
            value={account}
            maxLength={80}
            disabled={disabled}
            onChange={(e) => {
              setAccount(e.target.value);
              onEdited();
            }}
          />
          <small className="field-note">
            Вымышленное имя участника, например «Учебный сотрудник».
          </small>
        </label>
        <label>
          Сколько раз повторилось
          <input
            type="number"
            min={1}
            max={20}
            value={repeats}
            disabled={disabled}
            onChange={(e) => {
              setRepeats(e.target.value);
              onEdited();
            }}
          />
          <small className="field-note">
            От 1 до 20 действий с интервалом в одну секунду.
          </small>
        </label>
      </div>
      <Button
        type="button"
        disabled={disabled}
        onClick={() => {
          try {
            onPrepared(
              buildTrainingEvents(preset, device, account, Number(repeats)),
            );
            setError("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Проверьте поля");
          }
        }}
      >
        Подготовить учебные записи
      </Button>
      {error && <p role="alert">{error}</p>}
      <small>
        Это описание вымышленной ситуации. Настоящие действия на компьютере не
        выполняются.
      </small>
    </div>
  );
}
