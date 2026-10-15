import borderService from "../assets/border-service.png";
import knb from "../assets/knb.svg";
import { Shield } from "lucide-react";
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
  if (publicMode && !publicEmblemsEnabled)
    return (
      <Shield
        className="public-brand-mark"
        size={38}
        aria-label="Знак AegisBorder"
      />
    );
  return (
    <div className={"emblem-pair " + className}>
      <Emblem kind="border" />
      <Emblem kind="knb" />
    </div>
  );
}
