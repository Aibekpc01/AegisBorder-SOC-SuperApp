/* Назначение файла: Консоль первого экрана — пример того, как система ведёт один сигнал от события до отчёта.
 * Шаги совпадают с реальной цепочкой приложения: приём события → правило → инцидент → PDF-отчёт.
 * Данные иллюстративные и явно подписаны; серверных запросов компонент не делает.
 */

import type { CSSProperties } from "react";
import { Activity, FileText, ScanLine, ShieldAlert } from "lucide-react";

const steps = [
  {
    Icon: Activity,
    title: "Событие получено",
    detail: "Подключено USB-устройство не из разрешённого списка",
    meta: "Мониторинг событий",
  },
  {
    Icon: ScanLine,
    title: "Правило сработало",
    detail: "«Неизвестный USB» · риск 75/100 · причина видна оператору",
    meta: "Анализ",
  },
  {
    Icon: ShieldAlert,
    title: "Открыт инцидент",
    detail: "Назначен ответственный, доказательства собраны",
    meta: "Центр инцидентов",
  },
  {
    Icon: FileText,
    title: "Отчёт готов",
    detail: "PDF с хронологией, выводами и решением",
    meta: "Отчёты",
  },
];

export function SignalPipeline() {
  return (
    <div className="fr-console" role="group" aria-label="Пример обработки одного сигнала">
      <div className="fr-console-head">
        <span className="fr-console-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <b>Контур обработки сигнала</b>
        <span className="fr-console-tag">Пример · учебные данные</span>
      </div>
      <ol className="fr-console-steps">
        {steps.map(({ Icon, title, detail, meta }, i) => (
          <li key={title} style={{ "--i": i } as CSSProperties}>
            <span className="fr-step-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <div>
              <b>{title}</b>
              <span>{detail}</span>
            </div>
            <small>{meta}</small>
          </li>
        ))}
      </ol>
      <p className="fr-console-foot">
        <span className="fr-console-progress" aria-hidden="true">
          <i />
        </span>
        Решение всегда принимает человек: система объясняет, почему она насторожилась.
      </p>
    </div>
  );
}
