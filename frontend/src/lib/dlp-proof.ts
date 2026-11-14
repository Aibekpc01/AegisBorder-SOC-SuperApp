/* Назначение файла: Получает одноразовый код у сервера и передаёт его локальной службе на 127.0.0.1:17645 для подтверждения текущего ПК.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { api } from "../api";

export async function proveLocalDlp() {
  // Код выдаёт сервер для текущего сеанса. Сам браузер не объявляет устройство доверенным.
  const { code } = await api<{ code: string }>("/dlp/pair-code", "POST", {});
  const options: RequestInit & { targetAddressSpace: string } = {
    method: "POST",
    mode: "cors",
    // Cookie сайта остаётся на сервере; локальной службе передаётся только код привязки.
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(15000),
    targetAddressSpace: "loopback",
  };
  // Служба на этом компьютере завершает привязку через собственное соединение с сервером.
  const response = await fetch("http://127.0.0.1:17645/pair", options);
  if (!response.ok || !(await response.json()).paired)
    throw new Error("Локальная служба не подтвердила подключение");
}
