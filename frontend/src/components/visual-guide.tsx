import { useState } from "react";
import {
  Monitor,
  Play,
  Activity,
  ShieldAlert,
  Search,
  FileText,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";

const steps = [
  {
    title: "Выберите ситуацию",
    lines: ["Выберите", "ситуацию"],
    Icon: Monitor,
    color: "#38bdf8",
    text: "Нажмите на карточку учебного сценария. Справа появится описание того, что вы будете проверять.",
    action: "Открыть учебный полигон",
    path: "/scenarios",
  },
  {
    title: "Запустите тренировку",
    lines: ["Запустите", "тренировку"],
    Icon: Play,
    color: "#a78bfa",
    text: "Нажмите «Запустить сценарий». Генератор передаст синтетические события серверу. Никакие реальные устройства не затрагиваются.",
    action: "Перейти к тренировке",
    path: "/scenarios",
  },
  {
    title: "Посмотрите события",
    lines: ["Посмотрите", "события"],
    Icon: Activity,
    color: "#2dd4bf",
    text: "Откройте каждое событие в результате тренировки: что произошло, на каком устройстве и в какое время. Это сохранённые записи из базы.",
    action: "Открыть мониторинг",
    path: "/events",
  },
  {
    title: "Прочитайте объяснение",
    lines: ["Прочитайте", "объяснение"],
    Icon: ShieldAlert,
    color: "#fbbf24",
    text: "Откройте созданный инцидент. Система покажет правило, доказательства и причину оценки риска. Предупреждение нужно проверить, оно не доказывает атаку.",
    action: "Открыть инциденты",
    path: "/incidents",
  },
  {
    title: "Проведите расследование",
    lines: ["Проведите", "расследование"],
    Icon: Search,
    color: "#60a5fa",
    text: "Переведите инцидент «На проверке», отметьте выполненные проверки, добавьте комментарий и сохраните свой вывод.",
    action: "Открыть расследования",
    path: "/investigations",
  },
  {
    title: "Сохраните PDF",
    lines: ["Сохраните", "PDF-отчёт"],
    Icon: FileText,
    color: "#34d399",
    text: "В карточке инцидента нажмите «Сформировать PDF». Затем скачайте готовый документ в разделе «Отчёты».",
    action: "Открыть отчёты",
    path: "/reports",
  },
];
export function VisualGuide({
  onNavigate,
  compact = false,
}: {
  onNavigate: (path: string) => void;
  compact?: boolean;
}) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  return (
    <section className={"visual-guide " + (compact ? "compact" : "")}>
      <div className="guide-heading">
        <div>
          <span className="eyebrow">НАЖМИТЕ НА ЛЮБОЙ ШАГ</span>
          <h2>От первого события до готового отчёта</h2>
          <p>Наглядная карта действий — без сложных терминов.</p>
        </div>
        <span className="guide-counter">{step + 1} / 6</span>
      </div>
      <svg
        className="guide-picture"
        viewBox="0 0 1120 410"
        role="group"
        aria-label="Интерактивная схема: шесть шагов расследования"
      >
        <defs>
          <linearGradient id="guide-bg" x2="1" y2="1">
            <stop stopColor="#163653" />
            <stop offset="1" stopColor="#101c32" />
          </linearGradient>
          <pattern
            id="guide-dots"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#527b9c" opacity=".22" />
          </pattern>
        </defs>
        <rect width="1120" height="410" rx="18" fill="url(#guide-bg)" />
        <rect width="1120" height="410" rx="18" fill="url(#guide-dots)" />
        <path
          d="M 286 100 H 438 M 628 100 H 782 M 877 168 V 214 Q 877 242 852 242 M 780 307 H 628 M 438 307 H 286"
          stroke="#365675"
          strokeWidth="2"
          fill="none"
          strokeDasharray="6 6"
        />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const item = steps[i],
            Icon = item.Icon,
            x = i < 3 ? 96 + i * 342 : 96 + (5 - i) * 342,
            y = i < 3 ? 35 : 241;
          return (
            <g
              key={item.title}
              transform={`translate(${x},${y})`}
              role="button"
              aria-label={`Шаг ${i + 1}: ${item.title}`}
              aria-pressed={step === i}
              tabIndex={0}
              onClick={() => setStep(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setStep(i);
                }
              }}
              className="guide-node"
            >
              <rect
                width="190"
                height="132"
                rx="15"
                fill={step === i ? "#193d58" : "#142840"}
                stroke={step === i ? item.color : "#304966"}
                strokeWidth={step === i ? 2 : 1}
              />
              <rect
                x="18"
                y="18"
                width="42"
                height="42"
                rx="12"
                fill={item.color}
                opacity=".12"
              />
              <g transform="translate(27,27)" color={item.color}>
                <Icon size={24} />
              </g>
              <text
                x="158"
                y="35"
                fill={item.color}
                fontSize="13"
                fontWeight="600"
              >
                0{i + 1}
              </text>
              {item.lines.map((line, j) => (
                <text
                  key={line}
                  x="18"
                  y={86 + j * 21}
                  fill="#e5edf7"
                  fontSize="15"
                  fontWeight="500"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
        <text
          x="560"
          y="211"
          textAnchor="middle"
          fill="#91b2d0"
          fontSize="12"
          letterSpacing="3"
        >
          СОБЫТИЯ → ДОКАЗАТЕЛЬСТВА → РЕШЕНИЕ
        </text>
      </svg>
      <div className="guide-detail">
        <div className="guide-detail-icon" style={{ color: current.color }}>
          <current.Icon size={26} />
        </div>
        <div>
          <small>ШАГ {step + 1}</small>
          <h3>{current.title}</h3>
          <p>{current.text}</p>
        </div>
        <Button variant="outline" onClick={() => onNavigate(current.path)}>
          {current.action}
          <ArrowRight size={15} />
        </Button>
      </div>
      <div className="guide-navigation">
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          <ChevronLeft size={16} /> Предыдущий шаг
        </Button>
        <div className="guide-pagination">
          {steps.map((s, i) => (
            <button
              key={s.title}
              aria-label={`Показать шаг ${i + 1}`}
              aria-pressed={step === i}
              onClick={() => setStep(i)}
              className={step === i ? "active" : ""}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          disabled={step === 5}
          onClick={() => setStep(step + 1)}
        >
          Следующий шаг <ChevronRight size={16} />
        </Button>
      </div>
    </section>
  );
}
