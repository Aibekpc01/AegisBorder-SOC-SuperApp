/* Назначение файла: Декоративная сцена первого экрана — «цифровой рубеж».
 * Рельеф местности, линия рубежа с контрольными точками и сигналы, которые проходят проверку.
 * Решение: чистый SVG + CSS вместо WebGL — ноль зависимостей, мгновенная отрисовка, работа в закрытой сети.
 * Движение отключается при prefers-reduced-motion (см. styles/landing.css).
 */

/** Горизонтальные линии рельефа: детерминированные кривые, одинаковые при каждой отрисовке. */
const contours = Array.from({ length: 14 }, (_, i) => {
  const y = 70 + i * 62;
  const a = 26 + (i % 4) * 9;
  const b = 18 + ((i * 7) % 5) * 8;
  return `M-60 ${y} C 220 ${y - a}, 420 ${y + b}, 640 ${y - b / 2} S 1080 ${y + a}, 1500 ${y - a / 3}`;
});

/** Линия рубежа проходит между текстом и консолью. */
const FRONTIER = "M744 -40 Q 726 90 712 190 T 668 470 T 718 742 T 690 960";

/** Контрольные точки на линии рубежа. */
const checkpoints = [
  { x: 712, y: 190, label: "КПП-01" },
  { x: 668, y: 470, label: "КПП-02" },
  { x: 718, y: 742, label: "КПП-03" },
];

/** Маршруты сигналов: от внешнего края к контрольной точке. */
const signals = [
  { d: "M-40 120 C 220 150, 460 120, 712 190", dur: 7.5, begin: 0, tone: "ok" },
  { d: "M-40 330 C 240 300, 480 520, 668 470", dur: 9, begin: 1.6, tone: "ok" },
  { d: "M-40 600 C 260 640, 480 700, 718 742 C 880 780, 1020 830, 1196 846", dur: 10, begin: 3.2, tone: "alert" },
  { d: "M-40 820 C 240 780, 500 820, 718 742", dur: 8, begin: 0.8, tone: "ok" },
  { d: "M-40 470 C 260 430, 480 500, 668 470", dur: 11, begin: 5.1, tone: "ok" },
] as const;

export function FrontierScene() {
  return (
    <svg
      className="fr-scene"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="fr-zone" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--fr-zone)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--fr-zone)" stopOpacity="1" />
        </linearGradient>
        <radialGradient id="fr-node-glow">
          <stop offset="0" stopColor="var(--ab-accent)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--ab-accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fr-alert-glow">
          <stop offset="0" stopColor="var(--ab-warning)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--ab-warning)" stopOpacity="0" />
        </radialGradient>
        <pattern id="fr-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" className="fr-grid-line" />
        </pattern>
      </defs>

      <rect width="1440" height="900" fill="url(#fr-grid)" className="fr-grid" />
      {/* Защищённая сторона рубежа слегка подсвечена. */}
      <path d={`${FRONTIER} L1500 960 L1500 -40 Z`} fill="url(#fr-zone)" className="fr-zone" />

      <g className="fr-contours">
        {contours.map((d, i) => (
          <path key={d} d={d} style={{ animationDelay: `${-i * 1.7}s` }} />
        ))}
      </g>

      <g className="fr-routes">
        {signals.map((s) => (
          <path key={s.d} d={s.d} className={s.tone === "alert" ? "is-alert" : undefined} />
        ))}
      </g>

      <g className="fr-frontier">
        <path d={FRONTIER} className="fr-frontier-glow" />
        <path d={FRONTIER} className="fr-frontier-line" />
        <path d={FRONTIER} className="fr-frontier-ticks" />
      </g>

      <g className="fr-checkpoints">
        {checkpoints.map((c, i) => (
          <g key={c.label} transform={`translate(${c.x} ${c.y})`}>
            <circle r="46" fill="url(#fr-node-glow)" className="fr-node-halo" style={{ animationDelay: `${i * 1.3}s` }} />
            <circle r="13" className="fr-node-ring" />
            <circle r="4.5" className="fr-node-core" />
            <text x="24" y="-16" className="fr-node-label">
              {c.label}
            </text>
          </g>
        ))}
      </g>

      {/* Точка инцидента: сюда уходит сигнал, не прошедший проверку. */}
      <g transform="translate(1196 846)" className="fr-incident">
        <circle r="54" fill="url(#fr-alert-glow)" className="fr-incident-halo" />
        <rect x="-9" y="-9" width="18" height="18" rx="3" transform="rotate(45)" />
      </g>

      <g className="fr-signals">
        {signals.map((s) => (
          <circle key={s.d} r={s.tone === "alert" ? 5 : 3.5} className={s.tone === "alert" ? "is-alert" : undefined}>
            <animateMotion dur={`${s.dur}s`} begin={`${s.begin}s`} repeatCount="indefinite" path={s.d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
          </circle>
        ))}
      </g>

      <g className="fr-coords">
        <text x="40" y="880">УСЛОВНАЯ СХЕМА · БЕЗ РЕАЛЬНЫХ ДАННЫХ</text>
      </g>
    </svg>
  );
}
