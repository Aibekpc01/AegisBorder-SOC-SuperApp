/* Назначение файла: Отображает эмблемы с учётом настройки их публичного показа.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import borderService from "../assets/border-service.png";
import knb from "../assets/knb.svg";
export const publicEmblemsEnabled =
  import.meta.env.VITE_PUBLIC_OFFICIAL_EMBLEMS !== "false";

export function Emblem({
  kind,
  className = "",
}: {
  kind: "border" | "knb";
  className?: string;
}) {
  const border = kind === "border";
  return (
    <span className={"institution-emblem emblem-" + kind + " " + className}>
      <img
        className="emblem-art"
        src={border ? borderService : knb}
        alt={
          border
            ? "Эмблема Пограничной службы КНБ РК"
            : "Эмблема Комитета национальной безопасности РК"
        }
        width={64}
        height={64}
        decoding="async"
        draggable={false}
      />
      <span className="emblem-light" aria-hidden="true" />
    </span>
  );
}

export function EmblemPair({
  className = "",
  publicMode = false,
}: {
  className?: string;
  publicMode?: boolean;
}) {
  const showOfficial = !publicMode || publicEmblemsEnabled;
  return (
    <div className={"emblem-pair " + className}>
      {showOfficial && <Emblem kind="border" />}
      {showOfficial && <Emblem kind="knb" />}
    </div>
  );
}
