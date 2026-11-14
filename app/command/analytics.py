# Назначение файла: Выполняет дополнительную модельную оценку событий и сохраняет результаты анализа.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Isolation Forest: явный синтетический профиль, без заявлений о точности."""

import numpy as np
from sklearn.ensemble import IsolationForest

from .models import ModelVersion

FEATURES = ["Час входа", "Попытки входа", "Файлы", "CPU", "Соединения", "Нетипичное действие"]


def run_model(db, events, user_id):
    rng = np.random.default_rng(42)
    normal = np.column_stack(
        [
            rng.uniform(8, 20, 512),
            rng.poisson(0.5, 512),
            rng.poisson(4, 512),
            rng.uniform(5, 55, 512),
            rng.poisson(2, 512),
            np.zeros(512),
        ]
    )
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42).fit(normal)
    results = []
    for e in events:
        f = e.features
        values = [
            f.get("local_hour", (e.time.hour + 5) % 24),
            int(e.type == "login_failed"),
            f.get("files", 0),
            f.get("cpu", 20),
            int(e.type == "network"),
            int(f.get("unusual", False)),
        ]
        score = float(model.decision_function([values])[0])
        reasons = [
            FEATURES[i] + ": " + str(v)
            for i, v in enumerate(values)
            if v < normal[:, i].min() or v > normal[:, i].max()
        ]
        results.append(
            {
                "event_id": e.id,
                "anomaly": score < 0,
                "score": round(score, 4),
                "reasons": reasons or ["Нетипичное сочетание признаков"],
                "features": dict(zip(FEATURES, values)),
            }
        )
    row = ModelVersion(
        version="isolation-forest-synthetic-v1",
        parameters={
            "random_state": 42,
            "n_estimators": 100,
            "contamination": 0.05,
            "training_rows": 512,
            "training": "Синтетический нормальный профиль; качество на реальных данных не измерялось",
        },
        results=results,
        owner_id=user_id,
    )
    db.add(row)
    db.flush()
    return row
