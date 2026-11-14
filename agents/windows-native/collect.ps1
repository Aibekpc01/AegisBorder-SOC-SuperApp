# Назначение файла: Собирает доступные Windows сведения о состоянии устройства для нативного агента.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.


$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$status = Get-MpComputerStatus
$cpu = $null; $memory = $null
try {
    $cpu = [double](Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
    $os = Get-CimInstance Win32_OperatingSystem
    $memory = [Math]::Round(100 * (1 - $os.FreePhysicalMemory / $os.TotalVisibleMemorySize), 1)
} catch {}
$usb = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices\{53f5630d-b6bf-11d0-94f2-00a0c91efb8b}' -ErrorAction SilentlyContinue
$threats = @(Get-MpThreatDetection | Select-Object -Last 100 | ForEach-Object {
    @{id=[string]$_.DetectionID; threat_id=[string]$_.ThreatID; action_success=[bool]$_.ActionSuccess;
      time=if ($_.InitialDetectionTime) {$_.InitialDetectionTime.ToUniversalTime().ToString('o')} else {$null}}
})
@{status=@{antivirus=[bool]$status.AntivirusEnabled; realtime=[bool]$status.RealTimeProtectionEnabled;
            service=[bool]$status.AMServiceEnabled; signatures_age=$status.AntivirusSignatureAge;
            cpu_percent=$cpu; memory_percent=$memory;
            usb_read_denied=if ($null -ne $usb.Deny_Read) {[bool]$usb.Deny_Read} else {$null};
            usb_write_denied=if ($null -ne $usb.Deny_Write) {[bool]$usb.Deny_Write} else {$null}};
  threats=$threats} | ConvertTo-Json -Depth 5 -Compress
