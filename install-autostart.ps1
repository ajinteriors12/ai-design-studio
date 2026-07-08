# ============================================================
#  AI Design Studio — install auto-start via Windows Task Scheduler
#
#  Default : starts the server (hidden) at THIS user's logon.
#            Run normally — no admin needed:
#              powershell -ExecutionPolicy Bypass -File install-autostart.ps1
#
#  -AtBoot : starts at machine boot as SYSTEM (no logon needed).
#            Must be run from an ELEVATED (Administrator) PowerShell, and
#            npm/node must be on the SYSTEM PATH.
#
#  -OpenBrowser : also register a companion task that opens the app window.
#
#  Remove it any time with:  uninstall-autostart.ps1
# ============================================================
param([switch]$AtBoot, [switch]$OpenBrowser, [string]$StartDelay = "PT20S")
$ErrorActionPreference = "Stop"
$dir = $PSScriptRoot
$vbs = Join-Path $dir "autostart-run.vbs"
$taskName = "AI Design Studio"
if (-not (Test-Path $vbs)) { Write-Error "autostart-run.vbs not found next to this script."; exit 1 }

$action   = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('"' + $vbs + '"') -WorkingDirectory $dir
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
              -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

if ($AtBoot) {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) { Write-Error "-AtBoot needs an elevated PowerShell (Run as Administrator)."; exit 1 }
  $trigger   = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force -Description "Starts the AI Design Studio server on boot." | Out-Null
  Write-Host "Registered '$taskName' to start at BOOT (as SYSTEM)." -ForegroundColor Green
} else {
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  # Stagger the start so the server boot doesn't collide with the logon rush
  # (other apps auto-starting at the same time saturate the CPU). ISO-8601 duration.
  if ($StartDelay) { $trigger.Delay = $StartDelay }
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force -Description "Starts the AI Design Studio server at logon." | Out-Null
  Write-Host "Registered '$taskName' to start at YOUR logon (delay $StartDelay)." -ForegroundColor Green
}

if ($OpenBrowser) {
  $bat = Join-Path $dir "AI-Design-Studio.bat"
  if (Test-Path $bat) {
    $a2 = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ('/c "' + $bat + '"') -WorkingDirectory $dir
    $t2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    Register-ScheduledTask -TaskName "AI Design Studio (open window)" -Action $a2 -Trigger $t2 -Settings $settings -Force -Description "Opens the AI Design Studio app window at logon." | Out-Null
    Write-Host "Also registered a companion task to open the app window at logon." -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Start it now without rebooting:   Start-ScheduledTask -TaskName '$taskName'"
Write-Host "Check status:                     Get-ScheduledTask -TaskName '$taskName'"
Write-Host "Remove it:                        powershell -ExecutionPolicy Bypass -File uninstall-autostart.ps1"
