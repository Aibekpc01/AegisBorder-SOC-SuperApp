/* Назначение файла: Даёт администратору интерфейс управления сетевой политикой доступа.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  LockKeyhole,
} from "lucide-react";
import { api, type Row } from "../api";
import { Button } from "./ui/button";
import { BlockGuide } from "./block-guide";

export function AccessPolicy() {
  const client = useQueryClient(),
    [draft, setDraft] = useState<Row | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [ip, setIp] = useState(""),
    [check, setCheck] = useState<Row | null>(null);
  const query = useQuery({
    queryKey: ["access-policy"],
    queryFn: () => api("/access-policy"),
  });
  const connection = useQuery({
    queryKey: ["my-connection"],
    queryFn: () => api("/auth/connection"),
  });
  const value = draft || query.data;
  function change(key: string, data: unknown) {
    setDraft({ ...value, [key]: data });
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await api("/access-policy", "PUT", {
        block_anonymizers: value.block_anonymizers,
        restrict_to_trusted: value.restrict_to_trusted,
        trusted_cidrs: value.trusted_cidrs,
        blocked_cidrs: value.blocked_cidrs,
        networks: value.networks,
      });
      await client.invalidateQueries();
      setDraft(null);
      setCheck(null);
      setMessage(
        "Политика сохранена. Она действует для входов и текущих сеансов.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (query.isLoading) return <p>Загрузка сетевой политики…</p>;
  if (query.error)
    return (
      <p role="alert" className="error">
        {query.error.message}
      </p>
    );
  function lines(text: string) {
    return text
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return (
    <section className="access-policy">
      <div className="row between">
        <div>
          <span className="eyebrow">КОНТРОЛЬ СЕТЕВОГО ДОСТУПА</span>
          <h2>VPN, прокси и доверенные сети</h2>
          <p>
            Текущее соединение:{" "}
            <code>{connection.data?.ip || "Проверка…"}</code>
          </p>
        </div>
        <ShieldCheck size={36} />
      </div>
      <div className="policy-options">
        <label className="policy-option">
          <input
            aria-label="Блокировать известные VPN и прокси"
            type="checkbox"
            checked={value.block_anonymizers}
            onChange={(e) => change("block_anonymizers", e.target.checked)}
          />
          <span>
            <b>Блокировать известные VPN, прокси, Tor и хостинг</b>
            <small>
              Блокируются адреса, помеченные в локальном справочнике ниже. Для
              неизвестных сетей наличие VPN не установлено.
            </small>
          </span>
        </label>
        <label className="policy-option">
          <input
            aria-label="Только доверенные сети"
            type="checkbox"
            checked={value.restrict_to_trusted}
            onChange={(e) => change("restrict_to_trusted", e.target.checked)}
          />
          <span>
            <b>Разрешать только доверенные сети</b>
            <small>
              Более строгий режим: остальные адреса не смогут войти или
              продолжать пользоваться API.
            </small>
          </span>
        </label>
      </div>
      <div className="personal-form">
        <label>
          Доверенные IP / CIDR
          <textarea
            aria-label="Доверенные сети"
            rows={3}
            placeholder="127.0.0.1/32&#10;192.168.1.0/24"
            value={value.trusted_cidrs.join("\n")}
            onChange={(e) => change("trusted_cidrs", lines(e.target.value))}
          />
        </label>
        <label>
          Запрещённые IP / CIDR
          <textarea
            aria-label="Запрещённые сети"
            rows={3}
            placeholder="Укажите адрес или диапазон"
            value={value.blocked_cidrs.join("\n")}
            onChange={(e) => change("blocked_cidrs", lines(e.target.value))}
          />
        </label>
      </div>
      <div className="row between">
        <h3>Локальный справочник сетей</h3>
        <Button
          variant="outline"
          onClick={() =>
            change("networks", [
              ...value.networks,
              { cidr: "", kind: "vpn", label: "", country: "", city: "" },
            ])
          }
        >
          <Plus size={15} /> Добавить сеть
        </Button>
      </div>
      <p>
        Укажите известные диапазоны и их источник в названии. Город здесь —
        сведения администратора о сети, а не точное местоположение человека.
      </p>
      <div className="network-entries">
        {value.networks.map((entry: Row, index: number) => (
          <div className="network-entry" key={index}>
            {[
              ["cidr", "IP или CIDR"],
              ["label", "Название / источник"],
              ["country", "Страна (необязательно)"],
              ["city", "Город (необязательно)"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={label + " " + (index + 1)}
                  value={entry[key]}
                  onChange={(e) =>
                    change(
                      "networks",
                      value.networks.map((n: Row, i: number) =>
                        i === index ? { ...n, [key]: e.target.value } : n,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <label>
              Категория
              <select
                aria-label={"Категория сети " + (index + 1)}
                value={entry.kind}
                onChange={(e) =>
                  change(
                    "networks",
                    value.networks.map((n: Row, i: number) =>
                      i === index ? { ...n, kind: e.target.value } : n,
                    ),
                  )
                }
              >
                {[
                  ["vpn", "VPN"],
                  ["proxy", "Прокси"],
                  ["tor", "Tor"],
                  ["hosting", "Хостинг"],
                  ["blocked", "Запрещённая сеть"],
                  ["trusted", "Доверенная сеть"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              aria-label={"Убрать сеть " + (index + 1)}
              onClick={() =>
                change(
                  "networks",
                  value.networks.filter((_: Row, i: number) => i !== index),
                )
              }
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
      <Button disabled={busy} onClick={save}>
        <LockKeyhole size={16} /> Сохранить политику доступа
      </Button>
      {message && (
        <p className="profile-message" role="status">
          {message}
        </p>
      )}
      <div className="policy-check">
        <h3>Проверить адрес по сохранённой политике</h3>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            setMessage("");
            try {
              setCheck(await api("/access-policy/check", "POST", { ip }));
            } catch (err) {
              setMessage((err as Error).message);
            }
          }}
        >
          <input
            aria-label="IP для проверки политики"
            placeholder="Например, 203.0.113.10"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            required
          />
          <Button variant="outline">
            <Globe size={16} /> Проверить IP
          </Button>
        </form>
        {check && (
          <div className={"policy-result " + (check.allowed ? "" : "denied")}>
            <CheckCircle2 size={18} />
            <div>
              <b>{check.allowed ? "Доступ разрешён" : "Доступ запрещён"}</b>
              <p>{check.reason}</p>
              <small>
                {check.network_label} · {check.anonymizer_status}
              </small>
            </div>
          </div>
        )}
      </div>
      <BlockGuide
        title="Сетевая политика"
        text="Сервер применяет запреты по диапазонам IP и локальному справочнику. Полное обнаружение всех VPN не гарантируется."
        steps="Сначала заполните диапазоны, сохраните и проверьте IP. Сервер не позволит сохранить конфигурацию, запрещающую ваше текущее соединение. В Docker и за NAT может быть виден адрес шлюза. Заголовки прокси учитываются только от явно доверенных серверов."
      />
    </section>
  );
}
