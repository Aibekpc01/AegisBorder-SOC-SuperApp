"""Local tasks and module histories, without replacing existing data."""

import sqlalchemy as sa
from alembic import op

revision = "005_superapp"
down_revision = "004_workspace"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cc_work_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=False),
        sa.Column("assignee_id", sa.Integer(), sa.ForeignKey("cc_users.id")),
        sa.Column(
            "incident_id", sa.Integer(), sa.ForeignKey("cc_incidents.id", ondelete="SET NULL")
        ),
        sa.Column("private", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("due", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("revision >= 1", name="ck_task_revision"),
        sa.CheckConstraint(
            "status IN ('Новая', 'В работе', 'На проверке', 'Завершена')", name="ck_task_status"
        ),
    )
    op.create_index("ix_cc_work_tasks_owner_id", "cc_work_tasks", ["owner_id"])
    op.create_table(
        "cc_module_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created", sa.DateTime(timezone=True), nullable=False),
    )
    for name in ("kind", "owner_id"):
        op.create_index("ix_cc_module_records_" + name, "cc_module_records", [name])


def downgrade():
    raise RuntimeError("Удаление задач и журналов SuperApp запрещено")
