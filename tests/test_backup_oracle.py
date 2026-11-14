"""Backup targets the selected deployment and never publishes an incomplete dump."""
import subprocess

import pytest

from scripts.backup_oracle import backup


def test_backup_can_target_existing_multi_file_deployment(tmp_path, monkeypatch):
    calls = []

    def run(command, **kwargs):
        calls.append((command, kwargs["cwd"], kwargs["check"]))
        kwargs["stdout"].write(b"PGDMP-test-only")

    monkeypatch.setattr(subprocess, "run", run)
    target = backup(tmp_path, "aegisborder_soc_v02", ".env", ["compose.yaml", "compose.oracle.yaml"])
    assert calls == [([
        "docker", "compose", "-p", "aegisborder_soc_v02", "--env-file", ".env",
        "-f", "compose.yaml", "-f", "compose.oracle.yaml", "exec", "-T", "db",
        "pg_dump", "-U", "aegis", "-d", "aegisborder", "-Fc",
    ], tmp_path, True)]
    assert target.read_bytes() == b"PGDMP-test-only"
    assert not list(target.parent.glob("*.partial"))


@pytest.mark.parametrize("empty", [False, True])
def test_failed_or_empty_backup_does_not_leave_a_final_file(tmp_path, monkeypatch, empty):
    def run(command, **kwargs):
        if not empty:
            kwargs["stdout"].write(b"partial")
            raise subprocess.CalledProcessError(1, command)

    monkeypatch.setattr(subprocess, "run", run)
    with pytest.raises(RuntimeError if empty else subprocess.CalledProcessError):
        backup(tmp_path)
    assert not list((tmp_path / "backups").iterdir())
