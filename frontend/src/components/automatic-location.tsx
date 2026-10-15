import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { api, type Row } from "../api";

export function AutomaticLocation({ userId }: { userId: number }) {
  const [city, setCity] = useState(""),
    [status, setStatus] = useState(
      "Для определения города браузер запросит разрешение.",
    );
  const connection = useQuery({
    queryKey: ["entry-connection", userId],
    queryFn: () => api("/auth/connection"),
  });
  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("Геолокация недоступна в браузере");
      return;
    }
    let stopped = false;
    const key = `aegis-location-${userId}`;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const value = JSON.parse(saved);
        setCity(value.city || "");
        setStatus(value.status);
        return;
      }
    } catch {
      /* Storage may be disabled. */
    }
    function save(city: string, status: string) {
      if (stopped) return;
      setCity(city);
      setStatus(status);
      try {
        sessionStorage.setItem(key, JSON.stringify({ city, status }));
      } catch {
        /* Optional cache. */
      }
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (stopped) return;
        void api<Row>("/auth/location", "POST", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          observed_at: new Date(position.timestamp).toISOString(),
        })
          .then((result) => save(result.city || "", result.city_source))
          .catch(() =>
            save(
              "",
              "Местоположение не сохранено; повторите запрос в профиле.",
            ),
          );
      },
      (error) =>
        save(
          "",
          error.code === 1
            ? "Доступ к геолокации не разрешён. IP отображается; город можно определить в профиле."
            : "Браузер не определил город. Повторить можно в профиле.",
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
    return () => {
      stopped = true;
    };
  }, [userId]);
  const network = connection.data?.network;
  return (
    <aside className="entry-location" aria-label="IP и город текущего входа">
      <MapPin size={17} />
      <div>
        <b>
          IP: {connection.data?.ip || "определяется…"} ·{" "}
          {city || network?.city || "Город не определён"}
        </b>
        <small>
          {city ? status : network?.city ? network.location_source : status}
        </small>
      </div>
    </aside>
  );
}
