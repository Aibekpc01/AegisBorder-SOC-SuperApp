# Назначение файла: Создаёт подключение SQLAlchemy и выдаёт отдельную сессию БД каждому запросу. Локально используется SQLite, на сервере — PostgreSQL.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .hosting import database_url


class Base(DeclarativeBase):
    pass


DATABASE_URL = database_url(os.getenv("DATABASE_URL", "sqlite:///./aegisborder_local.db"))
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


# Сессия живёт в пределах запроса; with закрывает соединение и при исключении.
def get_db():
    with SessionLocal() as db:
        yield db
