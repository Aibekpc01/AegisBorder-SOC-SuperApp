/* Назначение файла: Показывает помощника по сайту и ответы на вопросы о работе разделов.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Compass,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { appPage } from "../lib/routes";
import { explainers } from "../lib/explainers";
import { localGuideAnswer, siteTour } from "../lib/local-guide";
import "../site-assistant.css";

type Block = {
  title: string;
  text: string;
  steps: string;
  element: HTMLElement;
};
type Message = { role: "assistant" | "user"; text: string };

function shown(element: HTMLElement) {
  return (
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden"
  );
}

function pageBlocks(page: string): Block[] {
  const result: Block[] = [],
    seen = new Set<HTMLElement>();
  const add = (
    element: HTMLElement | null,
    title: string,
    text: string,
    steps: string,
  ) => {
    if (element && shown(element) && !seen.has(element)) {
      seen.add(element);
      result.push({ title, text, steps, element });
    }
  };
  const guide = explainers[page];
  add(
    document.querySelector(".page-heading, .landing-hero"),
    "Назначение страницы",
    guide?.description || siteTour[0].text,
    guide?.steps.join("\n") ||
      "Нажмите «Открыть SuperApp», чтобы перейти к рабочей панели.",
  );
  add(
    document.querySelector(".first-visit"),
    "С чего начать",
    "Этот блок предлагает понятную демонстрацию от учебного действия до отчёта.",
    "Нажмите «Показать систему по шагам». Действия выполняете вы; помощник только объясняет.",
  );
  document
    .querySelectorAll<HTMLElement>("main .metric")
    .forEach((element) =>
      add(
        element,
        element.querySelector(".row span")?.textContent || "Показатель",
        element.querySelector(".metric-instruction")?.textContent ||
          "Показатель рассчитан по сохранённым данным.",
        "Нажмите карточку, чтобы открыть соответствующий список. Риск не означает процент вероятности атаки.",
      ),
    );
  document
    .querySelectorAll<HTMLElement>("[data-guide-title]")
    .forEach((element) =>
      add(
        element.closest<HTMLElement>("section, article, .panel") || element,
        element.dataset.guideTitle || "Блок",
        element.dataset.guideText || "",
        element.dataset.guideSteps || "",
      ),
    );
  document
    .querySelectorAll<HTMLElement>("main form, main .friendly-event-form")
    .forEach((element) =>
      add(
        element,
        "Форма: заполнение данных",
        guide?.description || "Заполните поля формы.",
        "Заполните обязательные поля. Прочитайте действие на кнопке перед нажатием. Помощник не отправляет формы и не меняет данные.",
      ),
    );
  document
    .querySelectorAll<HTMLElement>(
      "main form label, main .friendly-event-form label",
    )
    .forEach((element) => {
      const control = element.querySelector<HTMLInputElement>(
        "input, select, textarea",
      );
      if (!control || control.type === "password" || control.type === "hidden")
        return;
      const title = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(" ")
        .trim();
      add(
        element,
        title || "Поле формы",
        element.querySelector("small")?.textContent ||
          (control.tagName === "SELECT"
            ? "Выберите подходящий вариант из списка."
            : control.type === "number"
              ? "Укажите число в допустимом диапазоне."
              : "Введите данные, которые относятся к вашей учебной ситуации."),
        control.type === "file"
          ? "Выберите подготовленный учебный файл. Его проверка и загрузка выполняются отдельными кнопками."
          : "После заполнения проверьте остальные поля. Для подготовки тренировки используйте вымышленные данные.",
      );
    });
  document
    .querySelectorAll<HTMLElement>(
      "main .module-card, main .landing-section-heading",
    )
    .forEach((element) =>
      add(
        element,
        element.querySelector("h2, h3")?.textContent || "Карточка результата",
        guide?.outcome || "Этот блок описывает возможность учебной платформы.",
        guide?.steps.join("\n") ||
          "Прочитайте описание и перейдите к нужному разделу.",
      ),
    );
  return result;
}

export function SiteAssistant() {
  const location = useLocation(),
    navigate = useNavigate(),
    page = location.pathname === "/" ? "landing" : appPage(location.pathname);
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<"chat" | "blocks" | "tour">("chat"),
    [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]),
    [blocks, setBlocks] = useState<Block[]>([]),
    [index, setIndex] = useState(0),
    [tourIndex, setTourIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null),
    log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setBlocks([]);
    setIndex(0);
    setMessages([]);
    setQuestion("");
    setMode((current) =>
      current === "blocks" ||
      (current === "tour" && location.pathname !== siteTour[tourIndex].path)
        ? "chat"
        : current,
    );
  }, [location.pathname, tourIndex]);
  useEffect(() => {
    if (!open || mode !== "blocks") return;
    const block = blocks[index];
    if (!block || !block.element.isConnected) return;
    block.element.classList.add("aegis-guide-highlight");
    block.element.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
    return () => block.element.classList.remove("aegis-guide-highlight");
  }, [open, mode, blocks, index]);
  useEffect(() => {
    const handle = (event: Event) => {
      const element = (event as CustomEvent<HTMLElement>).detail;
      if (!(element instanceof HTMLElement)) return;
      setBlocks([
        {
          title: element.dataset.guideTitle || "Блок",
          text: element.dataset.guideText || "",
          steps: element.dataset.guideSteps || "",
          element:
            element.closest<HTMLElement>("section, article, .panel") || element,
        },
      ]);
      setIndex(0);
      setMode("blocks");
      setOpen(true);
    };
    window.addEventListener("aegis-explain-block", handle);
    return () => window.removeEventListener("aegis-explain-block", handle);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]'))
        setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages]);
  function answer(text: string) {
    setMessages((items) => [
      ...items.slice(-18),
      { role: "user", text },
      { role: "assistant", text: localGuideAnswer(text, page) },
    ]);
    setQuestion("");
    setMode("chat");
  }
  function tourStep(next: number) {
    if (
      !window.dispatchEvent(
        new Event("aegis-before-navigation", { cancelable: true }),
      )
    ) {
      setMode("chat");
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: "Дождитесь сохранения документа перед переходом. Помощник оставил вас на текущей странице, чтобы изменения не потерялись.",
        },
      ]);
      return;
    }
    setTourIndex(next);
    setMode("tour");
    navigate(siteTour[next].path);
  }
  const block = blocks[index],
    tour = siteTour[tourIndex];
  return (
    <>
      <button
        className="site-assistant-launcher"
        aria-label="Помощник по сайту"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <Bot size={22} />
        <span>Помощник по сайту</span>
      </button>
      {open && (
        <aside
          className="site-assistant-panel"
          aria-label="Локальный помощник по сайту"
        >
          <header>
            <span className="assistant-avatar">
              <Bot size={24} />
            </span>
            <div>
              <h2>Aegis · помощник по сайту</h2>
              <small>Бесплатный локальный гид</small>
            </div>
            <button
              className="icon-btn"
              aria-label="Закрыть помощника"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </header>
          <p className="assistant-disclosure">
            Объяснения по встроенной инструкции. Без интернета и API. Языковая
            модель не подключена.
          </p>
          <nav aria-label="Режимы помощника">
            <button
              aria-pressed={mode === "chat"}
              onClick={() => {
                setMode("chat");
                input.current?.focus();
              }}
            >
              <MessageCircle size={15} /> Объяснения
            </button>
            <button
              aria-pressed={mode === "blocks"}
              onClick={() => {
                setBlocks(pageBlocks(page));
                setIndex(0);
                setMode("blocks");
              }}
            >
              <Compass size={15} /> Покажи блоки
            </button>
            <button aria-pressed={mode === "tour"} onClick={() => tourStep(0)}>
              Весь сайт
            </button>
          </nav>
          <div className="assistant-content" ref={log}>
            {mode === "chat" ? (
              <>
                <article className="assistant-message">
                  <b>Объясню, куда нажать и что получится.</b>
                  <p>{explainers[page]?.description || siteTour[0].text}</p>
                </article>
                {messages.map((message, i) => (
                  <article
                    key={i}
                    className={"assistant-message " + message.role}
                  >
                    <small>
                      {message.role === "user"
                        ? "Ваш вопрос"
                        : "Aegis · локальное объяснение"}
                    </small>
                    <p>{message.text}</p>
                  </article>
                ))}
                <div className="assistant-suggestions">
                  {[
                    "Объясни страницу",
                    "Как пользоваться?",
                    "Что такое риск?",
                    "Что умеет весь сайт?",
                  ].map((text) => (
                    <button key={text} onClick={() => answer(text)}>
                      {text}
                    </button>
                  ))}
                </div>
              </>
            ) : mode === "blocks" ? (
              block ? (
                <article className="assistant-message" aria-live="polite">
                  <small>
                    Блок {index + 1} из {blocks.length}
                  </small>
                  <h3>{block.title}</h3>
                  <p>{block.text}</p>
                  <h4>Что делать</h4>
                  <p>{block.steps}</p>
                </article>
              ) : (
                <p>
                  На этой странице пока нет доступных блоков. Дождитесь загрузки
                  или войдите в приложение, затем нажмите «Покажи блоки» снова.
                </p>
              )
            ) : (
              <article className="assistant-message" aria-live="polite">
                <small>
                  Шаг {tourIndex + 1} из {siteTour.length}
                </small>
                <h3>{tour.title}</h3>
                <p>{tour.text}</p>
                <p>
                  Если появилась форма входа, войдите с выданной учётной
                  записью. Гид не знает пароли и не выполняет действия за вас.
                </p>
              </article>
            )}
          </div>
          {mode === "chat" ? (
            <form
              className="assistant-question"
              onSubmit={(e) => {
                e.preventDefault();
                if (question.trim()) answer(question);
              }}
            >
              <input
                ref={input}
                aria-label="Вопрос помощнику по сайту"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={500}
                placeholder="Например: как пользоваться?"
              />
              <button aria-label="Задать вопрос" disabled={!question.trim()}>
                <Send size={18} />
              </button>
            </form>
          ) : (
            <footer>
              <button
                disabled={mode === "blocks" ? index === 0 : tourIndex === 0}
                onClick={() =>
                  mode === "blocks"
                    ? setIndex((i) => i - 1)
                    : tourStep(tourIndex - 1)
                }
              >
                <ArrowLeft size={16} /> Назад
              </button>
              <button
                disabled={mode === "blocks" && !block}
                onClick={() => {
                  if (mode === "blocks") {
                    if (index < blocks.length - 1) setIndex((i) => i + 1);
                    else setMode("chat");
                  } else if (tourIndex < siteTour.length - 1)
                    tourStep(tourIndex + 1);
                  else setMode("chat");
                }}
              >
                {(
                  mode === "blocks"
                    ? index === blocks.length - 1
                    : tourIndex === siteTour.length - 1
                )
                  ? "Завершить"
                  : "Следующий шаг"}
                <ArrowRight size={16} />
              </button>
            </footer>
          )}
        </aside>
      )}
    </>
  );
}
