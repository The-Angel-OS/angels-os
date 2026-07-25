<#
  Registers 'AngelOS-Tunnel' — auto-starts the cloudflared tunnel that fronts
  *.payloadnuke.com -> local Core, on logon, and restarts it if it ever drops.
  Non-elevated, current-user. Works because the box is always-on and logged in.
  (The Windows service path is broken — bare ImagePath, no `tunnel run`.)
#>
$exe = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$argline = 'tunnel --config "C:\Users\kenne\.cloudflared\config.yml" run merlin'

$action  = New-ScheduledTaskAction -Execute $exe -Argument $argline
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd `
  -MultipleInstances IgnoreNew -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
$settings.ExecutionTimeLimit = 'PT0S'  # no time limit (run forever)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName 'AngelOS-Tunnel' -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal -Force `
  -Description 'cloudflared tunnel for *.payloadnuke.com -> local Core' | Out-Null

$t = Get-ScheduledTask -TaskName 'AngelOS-Tunnel'
Write-Output "Registered: $($t.TaskName) / state=$($t.State)"
