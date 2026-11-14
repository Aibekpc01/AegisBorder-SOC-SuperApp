# Назначение файла: Собирает локальную поставку приложения через PowerShell.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $projectRoot 'frontend')
try {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось установить frontend' }
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать frontend' }
    $destination = Join-Path $projectRoot 'app/web'
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Copy-Item -Path 'dist/*' -Destination $destination -Recurse -Force
} finally { Pop-Location }
