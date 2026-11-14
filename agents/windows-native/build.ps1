# Назначение файла: Компилирует AegisDLP.cs в Windows EXE. После изменения комментариев пересборка для работы текущего EXE не нужна.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework compiler is required for the build machine' }
$output = Join-Path $PSScriptRoot 'bin'
New-Item -ItemType Directory -Path $output -Force | Out-Null
& $compiler /nologo /codepage:65001 /target:winexe /platform:x64 /optimize+ /reference:System.Web.Extensions.dll /reference:System.ServiceProcess.dll /reference:System.Configuration.Install.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Security.dll /reference:System.Core.dll ('/resource:' + (Join-Path $PSScriptRoot 'collect.ps1') + ',Aegis.Collect') ('/out:' + (Join-Path $output 'AegisDLP.exe')) (Join-Path $PSScriptRoot 'AegisDLP.cs')
if ($LASTEXITCODE -ne 0) { throw 'Aegis DLP build failed' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README.txt') -Destination (Join-Path $output 'README.txt') -Force
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $output 'AegisDLP.exe') | Select-Object Algorithm,Hash
