# Назначение файла: Сопоставляет доступные координаты и локальные справочники с географическими сведениями.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Local approximate settlement label; coordinates never leave the server."""

from math import asin, cos, radians, sin, sqrt

# City centres, not administrative borders or a full reverse-geocoding service.
CITIES = [
    ("Алматы", 43.2389, 76.8897),
    ("Астана", 51.1694, 71.4491),
    ("Шымкент", 42.3155, 69.5869),
    ("Караганда", 49.8064, 73.0855),
    ("Актобе", 50.2839, 57.1670),
    ("Тараз", 42.9000, 71.3667),
    ("Павлодар", 52.2873, 76.9674),
    ("Усть-Каменогорск", 49.9483, 82.6275),
    ("Семей", 50.4111, 80.2275),
    ("Атырау", 47.0945, 51.9238),
    ("Костанай", 53.2144, 63.6246),
    ("Кызылорда", 44.8488, 65.4823),
    ("Уральск", 51.2278, 51.3865),
    ("Петропавловск", 54.8728, 69.1430),
    ("Актау", 43.6532, 51.1975),
    ("Туркестан", 43.2973, 68.2517),
    ("Кокшетау", 53.2833, 69.3833),
    ("Талдыкорган", 45.0156, 78.3739),
    ("Жезказган", 47.7833, 67.7000),
    ("Конаев", 43.8844, 77.0686),
    ("Экибастуз", 51.7298, 75.3266),
    ("Темиртау", 50.0549, 72.9646),
]


def city_label(latitude, longitude, accuracy):
    def distance(city):
        lat, lon = radians(city[1] - latitude), radians(city[2] - longitude)
        a = sin(lat / 2) ** 2 + cos(radians(latitude)) * cos(radians(city[1])) * sin(lon / 2) ** 2
        return 6371 * 2 * asin(sqrt(min(1, a)))

    city = min(CITIES, key=distance)
    km = distance(city)
    nearby = km + accuracy / 1000 <= 30
    return {
        "city": city[0] if nearby else "",
        "country": "Казахстан" if nearby else "",
        "city_source": "Приблизительно по координатам браузера и локальному справочнику городов"
        if nearby
        else "Город не определён: вне покрытия справочника или недостаточная точность",
        "distance_to_city_km": round(km, 1) if nearby else None,
    }
