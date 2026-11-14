# Назначение файла: Подготавливает окружение и установку Python-варианта Windows-агента.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

# Aegis DLP per-user pilot. No USB restrictions are enabled by installation.
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne 'Win32NT') { throw 'Windows 10/11 required' }
$python = (Get-Command python.exe -ErrorAction Stop).Source
$target = Join-Path $env:LOCALAPPDATA 'AegisDLP'
if (Test-Path -LiteralPath (Join-Path $target 'endpoint_agent.py')) {
    throw 'Aegis DLP is already installed here. Stop the existing agent and use a separate migration procedure.'
}
New-Item -ItemType Directory -Path $target -Force | Out-Null
$names = @('endpoint_agent.py','local_security.py','usb_policy.py','device_link.py','console.py','requirements.txt','README.md','enrollment.json')
foreach ($name in $names) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $target $name) }
& $python -m venv (Join-Path $target 'venv')
if ($LASTEXITCODE -ne 0) { throw 'Python virtual environment creation failed' }
$runtime = Join-Path $target 'venv\Scripts\python.exe'
$wheels = Join-Path $PSScriptRoot 'wheels'
if (Test-Path -LiteralPath $wheels) {
    & $runtime -m pip install --no-index --find-links $wheels -r (Join-Path $target 'requirements.txt')
} else {
    & $runtime -m pip install -r (Join-Path $target 'requirements.txt')
}
if ($LASTEXITCODE -ne 0) { throw 'Dependencies unavailable. Prepare the wheels folder for an offline install.' }
& $runtime (Join-Path $target 'endpoint_agent.py') init --enrollment (Join-Path $target 'enrollment.json')
if ($LASTEXITCODE -ne 0) { throw 'Aegis DLP initialization failed' }
Remove-Item -LiteralPath (Join-Path $target 'enrollment.json')
Write-Host 'The downloaded archive still contains an activation key. Keep it private or delete it after enrollment.'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $runtime -Argument ('"' + (Join-Path $target 'endpoint_agent.py') + '" run') -WorkingDirectory $target
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'AegisDLP' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Aegis DLP visible per-user Windows monitoring pilot' | Out-Null
Start-ScheduledTask -TaskName 'AegisDLP'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Aegis DLP.lnk'))
$shortcut.TargetPath = Join-Path $target 'venv\Scripts\pythonw.exe'
$shortcut.Arguments = '"' + (Join-Path $target 'console.py') + '"'
$shortcut.WorkingDirectory = $target
$shortcut.Description = 'Aegis DLP password-protected local console'
$shortcut.Save()
Write-Host 'Aegis DLP installed for this Windows user. No USB block applied. Open console.py for password-gated settings.'
