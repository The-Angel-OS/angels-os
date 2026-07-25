@echo off
title Angel OS Cloudflare Tunnel
REM Angel OS edge. Keeps merlin/payloadnuke/spacesangels reachable.
REM Auto-restarts if cloudflared crashes, so a blip doesn't take the edge down.
REM Closing this window still stops the tunnel -- for a boot-survivable tunnel,
REM install it as a real service (see docs/TUNNEL.md).
:loop
echo [%date% %time%] starting cloudflared...
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --config "C:\Users\kenne\.cloudflared\config.yml" run 21d122ac-84b0-4cd4-be5b-7fddbf8d8458
echo [%date% %time%] cloudflared exited. Restarting in 5s. Ctrl+C to stop for good.
timeout /t 5 /nobreak >nul
goto loop
