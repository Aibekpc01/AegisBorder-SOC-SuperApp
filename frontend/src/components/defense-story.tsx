import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { defenseModules, defensePhases } from "../lib/defense-story";
import { Emblem, publicEmblemsEnabled } from "./emblems";
import hacker from "../assets/story/hacker.png";
import operator from "../assets/story/operator.png";
import "../defense-story.css";

export function DefenseStory({ publicMode = false }: { publicMode?: boolean }) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false);
  const module = defenseModules[index],
    phase = defensePhases[module.phase];
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setIndex((current) => {
          if (current === defenseModules.length - 1) {
            setPlaying(false);
            return current;
          }
          return current + 1;
        }),
      6500,
    );
    return () => clearInterval(timer);
  }, [playing]);
  function select(next: number) {
    setIndex(next);
    setPlaying(false);
  }
  return (
    <section
      className="defense-story"
      aria-label="Как оператор защищает организацию"
      id="defense-story"
    >
      <header className="defense-heading">
        <span className="experience-kicker">
          <ShieldCheck size={17} /> AegisBorder Supper / ИСТОРИЯ ЗАЩИТЫ
        </span>
        <h2>
          Попытка атаки.
          <br />
          <em>Команда знает, что делать.</em>
        </h2>
        <p>
          Посмотрите на одну ситуацию глазами оператора. Выберите любой модуль —
          узнайте, зачем он нужен, что сделать и какой результат получить.
        </p>
        <span className="defense-disclaimer">
          Учебная иллюстрация · вымышленные персонажи · просмотр не запускает
          атаки и не изменяет данные
        </span>
      </header>
      <nav className="defense-phases" aria-label="Этапы истории защиты">
        {defensePhases.map((item, i) => (
          <button
            key={item.title}
            aria-pressed={module.phase === i}
            onClick={() =>
              select(defenseModules.findIndex((m) => m.phase === i))
            }
          >
            <span>0{i + 1}</span>
            {item.title}
          </button>
        ))}
      </nav>
      <div className="defense-scene" data-phase={module.phase}>
        <figure className="defense-character attacker">
          <img
            src={hacker}
            alt="Вымышленный злоумышленник у ноутбука"
            width={1024}
            height={1536}
            loading="lazy"
          />
          <figcaption>
            <span>ИСТОЧНИК УГРОЗЫ</span>
            <b>Неизвестный злоумышленник</b>
            <p>{phase.threat}</p>
          </figcaption>
        </figure>
        <div className="defense-console">
          <div className="defense-signal" aria-hidden="true">
            <span />
            <span />
            <span />
            <ShieldCheck size={38} />
          </div>
          <span className="defense-module-count">
            МОДУЛЬ {index + 1} / {defenseModules.length}
          </span>
          <article
            key={module.path}
            className="defense-explanation"
            aria-live="polite"
          >
            <module.Icon size={32} />
            <h3>{module.name}</h3>
            <p className="defense-purpose">{module.purpose}</p>
            <dl>
              <div>
                <dt>Что делает оператор</dt>
                <dd>{module.action}</dd>
              </div>
              <div>
                <dt>
                  <CheckCircle2 size={16} /> Что получает команда
                </dt>
                <dd>{module.result}</dd>
              </div>
            </dl>
            <Link
              className="btn btn-outline"
              to={"/app" + (module.path ? "/" + module.path : "")}
            >
              Открыть модуль <ArrowRight size={16} />
            </Link>
          </article>
          <div className="defense-controls">
            <button
              aria-label="Предыдущий модуль истории"
              disabled={index === 0}
              onClick={() => select(index - 1)}
            >
              <ArrowLeft size={18} />
            </button>
            <button aria-pressed={playing} onClick={() => setPlaying(!playing)}>
              {playing ? <Pause size={17} /> : <Play size={17} />}
              {playing ? "Пауза" : "Смотреть историю"}
            </button>
            <button
              aria-label="Следующий модуль истории"
              disabled={index === defenseModules.length - 1}
              onClick={() => select(index + 1)}
            >
              <ArrowRight size={18} />
            </button>
            <button
              aria-label="Начать историю заново"
              onClick={() => select(0)}
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </div>
        <figure className="defense-character operator">
          <img
            src={operator}
            alt="Вымышленный SOC-оператор в центре мониторинга"
            width={1024}
            height={1536}
            loading="lazy"
          />
          <figcaption>
            {(!publicMode || publicEmblemsEnabled) && <Emblem kind="knb" />}
            <span>AegisBorder Supper</span>
            <b>Оператор центра безопасности</b>
            <p>{phase.action}</p>
          </figcaption>
        </figure>
      </div>
      <div className="defense-outcome">
        <ShieldCheck size={24} />
        <div>
          <b>{phase.result}</b>
          <p>
            Автоматически работают приём событий и правила обнаружения. Решение
            принимает человек. Изоляция устройства и блокировка во внешних
            продуктах требуют подключённой системы реагирования.
          </p>
        </div>
      </div>
      <details className="defense-all" open>
        <summary>
          Польза всех {defenseModules.length} модулей — выберите интересующий
        </summary>
        <div className="defense-module-grid">
          {defenseModules.map((item, i) => (
            <button
              key={item.path}
              aria-pressed={i === index}
              onClick={() => select(i)}
            >
              <item.Icon size={20} />
              <span>
                <b>{item.name}</b>
                <small>{item.purpose}</small>
              </span>
            </button>
          ))}
        </div>
      </details>
      <footer>
        <Link to="/app/help">
          Объяснения всех разделов и примеры <ArrowRight size={15} />
        </Link>
        <Link to="/app/commission">
          Попробовать настоящую учебную проверку <ArrowRight size={15} />
        </Link>
      </footer>
    </section>
  );
}
