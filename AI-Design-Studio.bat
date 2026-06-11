@echo off
title AI Design Studio
cd /d "%~dp0"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest 'http://localhost:3000/api/stats' -UseBasicParsing -TimeoutSec 1 | Out-Null } catch { Start-Process -WindowStyle Minimized cmd -ArgumentList '/c','npx tsx index.ts'; foreach($i in 1..60){ try { Invoke-WebRequest 'http://localhost:3000/api/stats' -UseBasicParsing -TimeoutSec 1 | Out-Null; break } catch { Start-Sleep -Milliseconds 500 } } }"
set "APPDIR=%LocalAppData%\AIDesignStudioApp"
if exist "%CHROME%" ( start "" "%CHROME%" --app=http://localhost:3000 --user-data-dir="%APPDIR%" --window-size=1440,920 ) else ( start "" msedge --app=http://localhost:3000 --user-data-dir="%APPDIR%" --window-size=1440,920 )
exit
