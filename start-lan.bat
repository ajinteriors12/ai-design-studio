@echo off
REM ============================================================
REM  AI Design Studio - start on the LOCAL NETWORK (LAN)
REM  Run this ONCE as Administrator (right-click > Run as administrator)
REM  so the firewall rule can be added; after that you can also
REM  just run "npm start" normally.
REM ============================================================
cd /d "%~dp0"

echo Opening Windows Firewall for inbound TCP port 3000...
netsh advfirewall firewall delete rule name="AI Design Studio (port 3000)" >nul 2>&1
netsh advfirewall firewall add rule name="AI Design Studio (port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=private,domain >nul 2>&1
if %errorlevel%==0 (echo   Firewall rule added.) else (echo   Could NOT add firewall rule - re-run this file as Administrator.)

echo.
echo Starting the server on all network interfaces (port 3000)...
echo   Other machines on your network open:  http://YOUR-IP:3000/
echo   ^(this PC's LAN IP is shown in the banner below^)
echo.
npm start
