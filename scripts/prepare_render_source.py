"""Export allowlisted source for GitHub/Render, excluding secrets and runtime data."""
import zipfile

from package_release import ROOT, selected_files

destination = ROOT / "release"
destination.mkdir(exist_ok=True)
archive = destination / "AegisBorder-Render-source.zip"
folder = destination / "render-source"
if folder.exists():
    raise SystemExit("release/render-source already exists; use the existing prepared directory")
files = [p for p in selected_files() if not p.relative_to(ROOT).as_posix().startswith("app/web/")]
folder.mkdir()
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
    for path in files:
        relative = path.relative_to(ROOT)
        target = folder / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(path.read_bytes())
        bundle.write(path, relative.as_posix())
print(f"Prepared {len(files)} source files in release/render-source and {archive.name}")
