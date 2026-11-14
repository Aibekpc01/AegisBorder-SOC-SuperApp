/* Назначение файла: Показывает подсказки для первого знакомства с интерфейсом.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleHelp,
  Compass,
  Lightbulb,
  Search,
  ShieldCheck,
} from "lucide-react";
import { explainers, glossary } from "../lib/explainers";
import { Dialog } from "./ui/dialog";

export function PlainLanguageHelp() {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const terms = glossary.filter((item) =>
    (item.term + " " + item.text)
      .toLocaleLowerCase("ru")
      .includes(search.toLocaleLowerCase("ru")),
  );
  return (
    <>
      <button
        type="button"
        className="plain-help-trigger"
        onClick={() => setOpen(true)}
        aria-label="Словарь простыми словами"
      >
        <CircleHelp size={19} />
        <span>Понятная справка</span>
      </button>
      <Dialog
        title="Словарь простыми словами"
        open={open}
        onClose={() => setOpen(false)}
      >
        <p className="glossary-intro">
          Специальные знания не нужны. Здесь объясняются слова, которые
          встречаются на экранах.
        </p>
        <label className="glossary-search">
          <Search size={18} />
          <input
            aria-label="Найти слово в словаре"
            placeholder="Например: риск, инцидент, PDF…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <dl className="plain-glossary">
          {terms.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
        {!terms.length && (
          <p>
            Такого слова пока нет. Попробуйте другое слово или часть названия.
          </p>
        )}
      </Dialog>
    </>
  );
}

export function PagePrimer({
  page,
  technical,
}: {
  page: string;
  technical: boolean;
}) {
  const guide = explainers[page];
  if (!guide || technical) return null;
  return (
    <section
      className="page-primer"
      aria-label="Объяснение раздела простыми словами"
    >
      <div className="primer-purpose">
        <span className="primer-icon">
          <Lightbulb size={21} />
        </span>
        <div>
          <h2>Что вы получите</h2>
          <p>{guide.outcome}</p>
        </div>
      </div>
      <details key={page} open={page === "commission"}>
        <summary>
          <BookOpen size={16} /> Как пользоваться — 3 простых шага
          <span>Развернуть</span>
        </summary>
        <ol>
          {guide.steps.map((step, index) => (
            <li key={step}>
              <b>{index + 1}</b>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

export function FirstVisit({ observer }: { observer: boolean }) {
  return (
    <section className="first-visit" aria-label="Первое знакомство с системой">
      <div className="first-visit-copy">
        <span className="welcome-kicker">
          <Compass size={16} /> ПЕРВОЕ ЗНАКОМСТВО
        </span>
        <h2>
          Посмотрите, как работает защита.
          <br />
          Шаг за шагом, без сложных терминов.
        </h2>
        <p>
          Выберите учебную ситуацию. Система покажет, что произошло и почему это
          заслуживает внимания. Затем можно записать вывод и получить отчёт.
        </p>
        <div className="row wrap">
          <Link
            className="btn btn-primary"
            to={observer ? "/app/academy" : "/app/commission"}
          >
            {observer
              ? "Начать с короткого урока"
              : "Показать систему по шагам"}
            <ArrowRight size={17} />
          </Link>
          <Link className="welcome-secondary" to="/app/help">
            Посмотреть инструкцию
          </Link>
        </div>
        <small className="welcome-note">
          <ShieldCheck size={15} /> Все примеры учебные. Реальные компьютеры не
          затрагиваются.
        </small>
      </div>
      <ol className="welcome-journey">
        {[
          ["Выберите ситуацию", "Например, подключение неизвестной флешки."],
          [
            "Разберитесь в причине",
            "Посмотрите факты и объяснение предупреждения.",
          ],
          ["Сохраните результат", "Запишите вывод и скачайте готовый отчёт."],
        ].map(([title, text], index) => (
          <li key={title}>
            <span>{index + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
            <Check size={16} />
          </li>
        ))}
      </ol>
    </section>
  );
}
