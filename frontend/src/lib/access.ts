/* Назначение файла: Содержит клиентские проверки доступности функций по роли. Окончательное разрешение выдаёт сервер.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export type RoleInfo = {
  name: string;
  label: string;
  base: string;
  rank: number;
  builtin: boolean;
  assigned: number;
  can_assign: boolean;
};
export function useRoleCatalog() {
  return useQuery({
    queryKey: ["role-catalog"],
    queryFn: () => api<RoleInfo[]>("/roles"),
  });
}
