# Remove the AI Design Studio auto-start Scheduled Task(s).
#   powershell -ExecutionPolicy Bypass -File uninstall-autostart.ps1
$ErrorActionPreference = "SilentlyContinue"
foreach ($n in @("AI Design Studio", "AI Design Studio (open window)")) {
  $t = Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue
  if ($t) {
    try { Stop-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue } catch {}
    Unregister-ScheduledTask -TaskName $n -Confirm:$false -ErrorAction Stop
    Write-Host "Removed scheduled task '$n'." -ForegroundColor Yellow
  } else {
    Write-Host "No task named '$n' found (already removed)."
  }
}
