@echo off
REM Double-click to make AI Design Studio start automatically at your logon.
REM (For boot-as-SYSTEM instead, run in an admin PowerShell:
REM    powershell -ExecutionPolicy Bypass -File install-autostart.ps1 -AtBoot )
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1"
echo.
pause
