@echo off
REM Ship the current main to angel-node-01. Double-click, or run from anywhere.
REM
REM Everything happens inside WSL: the build needs a real Linux Docker engine,
REM and Docker Desktop is deliberately NOT a dependency (it is a paid GUI over an
REM engine that `apt install docker.io` provides for free).
title Push to angel-node-01
wsl -d Ubuntu-22.04 -u root -e bash /mnt/c/Dev/angels-os/docs/selfhost/thinkpad/push-to-node.sh
echo.
echo Done. Press any key to close.
pause >nul
