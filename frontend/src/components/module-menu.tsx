import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Grid2X2, Search } from "lucide-react";
import { modules, moduleGroups, platformNavigation } from "../lib/modules";
import { appPath } from "../lib/routes";
import { Dialog } from "./ui/dialog";
import { explainers } from "../lib/explainers";

export function ModuleMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  return (
    <>
      <button
        className={compact ? "icon-btn" : "mega-trigger"}
        aria-label="Открыть меню модулей"
        title="Разделы приложения — выберите, что хотите сделать"
        onClick={() => setOpen(true)}
      >
        <Grid2X2 size={18} />
        <span className={compact ? "compact-menu-caption" : ""}>
          {compact ? "Разделы" : "Платформа"}
        </span>
      </button>
      <Dialog
        title="Модули AegisBorder Supper"
        open={open}
        onClose={() => setOpen(false)}
      >
        <div className="mega-menu">
          <p>
            Выберите, что хотите сделать. Под названием каждого раздела есть
            короткое объяснение. Для первого знакомства начните с демонстрации
            проекта или учебной ситуации.
          </p>
          <div className="row">
            <Search size={17} />
            <input
              aria-label="Найти модуль"
              placeholder="Название или возможность…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="mega-groups">
            {moduleGroups.map((group) => {
              const list = platformNavigation.filter(
                (m) =>
                  m.group === group &&
                  (m.name + m.description)
                    .toLocaleLowerCase("ru")
                    .includes(query.toLocaleLowerCase("ru")),
              );
              return list.length ? (
                <section key={group}>
                  <h3>{group}</h3>
                  {list.map((m) => (
                    <div className="mega-item" key={m.id}>
                      <m.Icon size={19} />
                      <div>
                        <Link
                          to={appPath(m.path)}
                          onClick={() => setOpen(false)}
                        >
                          {m.name}
                          <ArrowUpRight size={13} />
                        </Link>
                        <small>
                          {explainers[m.path]?.description || m.description}
                        </small>
                        <span
                          className={
                            "module-state " +
                            (m.status.startsWith("Протестирован")
                              ? "tested"
                              : "planned")
                          }
                        >
                          {m.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </section>
              ) : null;
            })}
          </div>
          {!platformNavigation.some((m) =>
            (m.name + m.description)
              .toLocaleLowerCase("ru")
              .includes(query.toLocaleLowerCase("ru")),
          ) && <p>Модули не найдены.</p>}
        </div>
      </Dialog>
    </>
  );
}

export function ModuleCatalog() {
  const [group, setGroup] = useState("Все");
  return (
    <section className="landing-catalog" id="modules">
      <div className="landing-section-heading">
        <div>
          <span className="landing-kicker">ПЛАТФОРМА / 20 НАПРАВЛЕНИЙ</span>
          <h2>
            Рабочие инструменты.
            <br />
            Понятная польза каждого модуля.
          </h2>
        </div>
        <p>
          Каталог отражает фактическую реализацию. Для частичных модулей указаны
          уже доступные функции и оставшиеся задачи.
        </p>
      </div>
      <div className="catalog-filters" aria-label="Категории модулей">
        {["Все", ...moduleGroups].map((value) => (
          <button
            key={value}
            aria-pressed={group === value}
            onClick={() => setGroup(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="catalog-grid">
        {modules
          .filter((m) => group === "Все" || m.group === group)
          .map((m) => (
            <article key={m.id}>
              <div className="row between">
                <m.Icon size={25} />
                <small>{String(m.id).padStart(2, "0")}</small>
              </div>
              <h3>{m.name}</h3>
              <p>{explainers[m.path]?.description || m.description}</p>
              <span
                className={
                  "module-state " +
                  (m.status.startsWith("Протестирован") ? "tested" : "planned")
                }
              >
                {m.status}
              </span>
              {"path" in m && (
                <Link to={appPath(m.path)}>
                  Открыть доступные функции <ArrowUpRight size={14} />
                </Link>
              )}
            </article>
          ))}
      </div>
    </section>
  );
}
