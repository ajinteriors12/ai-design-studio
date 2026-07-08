@echo off
title AI Design Studio
cd /d "%~dp0"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
REM --- Ensure the server is up, but NEVER spawn a second racing instance ---
REM   $up  : true only when /api/stats answers 200 (3s timeout tolerates load)
REM   bound: port 3000 already has a listener => a server is booting, just wait
REM   Only run "npm start" when the port is genuinely free. Wait up to 45s.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$up={try{(Invoke-WebRequest 'http://localhost:3000/api/stats' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200}catch{$false}}; if(& $up){exit}; $bound=[bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue); if(-not $bound){Start-Process -WindowStyle Minimized cmd -ArgumentList '/c','npm start'}; foreach($i in 1..90){ if(& $up){break}; Start-Sleep -Milliseconds 500 }"
set "APPDIR=%LocalAppData%\AIDesignStudioApp"
if exist "%CHROME%" ( start "" "%CHROME%" --app=http://localhost:3000 --user-data-dir="%APPDIR%" --window-size=1440,920 ) else ( start "" msedge --app=http://localhost:3000 --user-data-dir="%APPDIR%" --window-size=1440,920 )
exit
