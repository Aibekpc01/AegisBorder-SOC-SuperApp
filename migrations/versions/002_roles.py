# Назначение файла: Изменение схемы БД: 002_roles. Применяется Alembic в порядке связей revision/down_revision.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Справочник ролей и внешний ключ, без удаления пользовательских данных."""

import sqlalchemy as sa
from alembic import op

revision = "002_roles"
down_revision = "001_command_center"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if not sa.inspect(bind).has_table("cc_roles"):
        op.create_table(
            "cc_roles",
            sa.Column("name", sa.String(30), primary_key=True),
            sa.Column("description", sa.String(150), nullable=False),
        )
    roles = sa.table("cc_roles", sa.column("name"), sa.column("description"))
    for name, label in [
        ("admin", "Администратор"),
        ("analyst", "Аналитик"),
        ("observer", "Наблюдатель"),
        ("demo", "Демонстрационный пользователь"),
    ]:
        if not bind.execute(sa.select(roles.c.name).where(roles.c.name == name)).first():
            bind.execute(roles.insert().values(name=name, description=label))
    keys = sa.inspect(bind).get_foreign_keys("cc_users")
    if not any(k["referred_table"] == "cc_roles" for k in keys):
        with op.batch_alter_table("cc_users") as batch:
            batch.create_foreign_key("fk_cc_users_role", "cc_roles", ["role"], ["name"])


def downgrade():
    raise RuntimeError("Удаление справочника ролей запрещено")
