# Назначение файла: Изменение схемы БД: 009_roles. Применяется Alembic в порядке связей revision/down_revision.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Additional organisational roles; existing accounts and password hashes are retained."""
import sqlalchemy as sa
from alembic import op

revision = "009_roles"
down_revision = "008_presence"
branch_labels = None
depends_on = None


def upgrade():
    table = sa.table("cc_roles", sa.column("name", sa.String), sa.column("description", sa.String))
    existing = set(op.get_bind().execute(sa.select(table.c.name)).scalars())
    for name, label in (
        ("creator", "Создатель"), ("cto", "Chief Technical Director"),
        ("deputy_cto", "Заместитель CTO"), ("team_lead", "Руководитель команды"),
        ("developer", "Разработчик"), ("auditor", "Аудитор"),
    ):
        if name not in existing:
            op.execute(table.insert().values(name=name, description=label))


def downgrade():
    # Role assignments may reference these names. Preserve organisational records.
    pass
