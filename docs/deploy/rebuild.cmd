@echo off
rem ============================================================================
rem  Angel OS local self-host — rebuild the whole stack after a code edit.
rem  Usage: just double-click, or `C:\Dev\datacenter\stack\rebuild.cmd`
rem  Rebuilds Core from C:\Dev\angels-os, restarts it (runs DB migrations on
rem  boot), leaves Postgres + the cloudflared tunnel untouched. ~1-3 min.
rem ============================================================================
setlocal
cd /d C:\Dev\datacenter\stack

echo.
echo [1/3] Rebuilding Core image from C:\Dev\angels-os ...
docker compose up -d --build core
if errorlevel 1 (
  echo.
  echo BUILD FAILED — see the output above. The old container is still running.
  exit /b 1
)

echo.
echo [2/3] Waiting for Core to boot ^(migrations + start^) ...
set /a n=0
:waitloop
"%SystemRoot%\System32\timeout.exe" /t 3 /nobreak >nul 2>&1 || ping -n 4 127.0.0.1 >nul
for /f %%c in ('curl -s -o nul -w "%%{http_code}" http://localhost:3000/api/health') do set CODE=%%c
if "%CODE%"=="200" goto ready
set /a n+=1
if %n% GEQ 20 ( echo Timed out waiting for health. Check: docker logs angelos-core & exit /b 1 )
goto waitloop
:ready

echo.
echo [3/3] Live. Verifying a tenant through the public edge ...
curl -s -o nul -w "   local health : %%{http_code}\n" http://localhost:3000/api/health
curl -s -o nul -w "   www          : %%{http_code}\n" https://www.payloadnuke.com/api/health
curl -s -o nul -w "   a tenant     : %%{http_code}\n" https://clearwater-cruisin.payloadnuke.com/api/health
echo.
echo Done. Your edit is live at https://www.payloadnuke.com
endlocal
