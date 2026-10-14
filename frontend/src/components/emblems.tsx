import borderService from "../assets/border-service.png";
import knb from "../assets/knb.svg";

export function Emblem({
  kind,
  className = "",
}: {
  kind: "border" | "knb";
  className?: string;
}) {
  const border = kind === "border";
  return (
    <img
      className={"institution-emblem " + className}
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
  );
}

export function EmblemPair({ className = "" }: { className?: string }) {
  return (
    <div className={"emblem-pair " + className}>
      <Emblem kind="border" />
      <Emblem kind="knb" />
    </div>
  );
}
