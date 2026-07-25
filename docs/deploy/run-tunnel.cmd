@echo off
rem Auto-start the cloudflared tunnel: *.payloadnuke.com -> local Core.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --config "C:\Users\kenne\.cloudflared\config.yml" run merlin
