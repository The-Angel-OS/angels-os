# Angel OS node -- build the install stick. Run ELEVATED.
#
#   Start-Process powershell -Verb RunAs -ArgumentList '-NoExit','-File','C:\Dev\datacenter\cidata\make-stick.ps1'
#
# ONE partition does both jobs: it is the UEFI boot media (extracted ISO
# contents) AND the cloud-init datasource (labelled CIDATA). No DD write, no
# second partition, no Rufus -- Ubuntu boots fine from an extracted ISO on FAT32
# under UEFI, and cloud-init only cares about the volume label.
#
# If the ThinkPad refuses to boot it, fall back to Rufus in DD mode plus a
# second stick labelled CIDATA holding just user-data + meta-data.
#
# !! THIS ERASES THE TARGET DISK.

$ErrorActionPreference = 'Stop'
$DiskNumber = 1
$Iso        = 'C:\Dev\datacenter\cidata\ubuntu-26.04-live-server-amd64.iso'
$Staged     = 'C:\Dev\datacenter\cidata'

# -- Guard --------------------------------------------------------------------
# Never trust the disk NUMBER; numbers move between reboots. Re-derive the
# facts that make this disk safe to erase, and refuse if any of them is wrong.
$d = Get-Disk -Number $DiskNumber
if ($d.BusType  -ne 'USB') { throw "Disk $DiskNumber is $($d.BusType), not USB -- STOP" }
if ($d.IsSystem)           { throw "Disk $DiskNumber is the SYSTEM disk -- STOP" }
if ($d.IsBoot)             { throw "Disk $DiskNumber is the BOOT disk -- STOP" }
if ($d.Size -gt 128GB)     { throw "Disk $DiskNumber is $([math]::Round($d.Size/1GB))GB -- too big to be the stick -- STOP" }
if (-not (Test-Path $Iso)) { throw "ISO not found: $Iso" }

Write-Host "`nAbout to ERASE:" -ForegroundColor Yellow
$d | Select-Object Number,FriendlyName,BusType,@{n='SizeGB';e={[math]::Round($_.Size/1GB,1)}} | Format-Table -AutoSize
Write-Host "Ctrl+C now if that is not your USB stick. Continuing in 8 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# -- Wipe and lay out ---------------------------------------------------------
Write-Host "`n== Clearing disk $DiskNumber" -ForegroundColor Cyan
Set-Disk -Number $DiskNumber -IsReadOnly $false
# Idempotent: safe to re-run after a failure partway through.
if (Get-Partition -DiskNumber $DiskNumber -ErrorAction SilentlyContinue) {
    Clear-Disk -Number $DiskNumber -RemoveData -RemoveOEM -Confirm:$false
}
# Clear-Disk wipes the partitions but LEAVES the partition style, so
# Initialize-Disk then throws "already been initialized". Only initialize a RAW
# disk; convert an already-styled one with Set-Disk instead.
$style = (Get-Disk -Number $DiskNumber).PartitionStyle
if ($style -eq 'RAW') {
    Initialize-Disk -Number $DiskNumber -PartitionStyle GPT
} elseif ($style -ne 'GPT') {
    Set-Disk -Number $DiskNumber -PartitionStyle GPT
}

Write-Host "== Creating FAT32 partition labelled CIDATA" -ForegroundColor Cyan
$part = New-Partition -DiskNumber $DiskNumber -UseMaximumSize -AssignDriveLetter
# The label is load-bearing twice over: cloud-init finds its config by looking
# for a volume named CIDATA, and this is also the boot media.
Format-Volume -Partition $part -FileSystem FAT32 -NewFileSystemLabel CIDATA -Confirm:$false | Out-Null
$Target = "$($part.DriveLetter):\"
Write-Host "   -> $Target"

# -- Extract the ISO onto it --------------------------------------------------
Write-Host "== Mounting ISO" -ForegroundColor Cyan
$img = Mount-DiskImage -ImagePath $Iso -PassThru
try {
    $src = ($img | Get-Volume).DriveLetter + ':\'
    Write-Host "== Copying installer files ($src -> $Target). Several minutes." -ForegroundColor Cyan
    # robocopy: resumable, shows progress, and does not choke on the deep paths
    # inside the ISO the way Copy-Item -Recurse can.
    $log = Join-Path $env:TEMP 'make-stick-robocopy.log'
    robocopy $src $Target /E /NFL /NDL /NJH /NP /R:2 /W:2 /LOG:$log | Out-Null
    # Do NOT abort on the exit code. Robocopy returns >=8 for things that do not
    # matter here -- it cannot set attributes on the destination's own
    # "System Volume Information", and FAT32 rejects metadata the CD carries.
    # The ISO ships md5sum.txt, so VERIFY THE RESULT instead of trusting the
    # return value; the check at the bottom is the real gate.
    if ($LASTEXITCODE -ge 8) {
        Write-Host "   robocopy exit $LASTEXITCODE (see $log) - checking md5sums below" -ForegroundColor Yellow
    }
} finally {
    Dismount-DiskImage -ImagePath $Iso | Out-Null
}

# -- The autoinstall payload --------------------------------------------------
Write-Host "== Copying autoinstall config" -ForegroundColor Cyan
Copy-Item "$Staged\user-data","$Staged\meta-data" -Destination $Target -Force

# -- Verify -------------------------------------------------------------------
# A CR in user-data breaks the heredoc that stops the laptop suspending when
# you close the lid -- silently, with nothing in any log. Check, do not assume.
Write-Host "`n== Verification" -ForegroundColor Cyan
$ok = $true
foreach ($f in 'user-data','meta-data') {
    $p = Join-Path $Target $f
    if (-not (Test-Path $p)) { Write-Host "  MISSING: $f" -ForegroundColor Red; $ok=$false; continue }
    $b  = [IO.File]::ReadAllBytes($p)
    $cr = $b -contains 13
    if ($cr) { $ok = $false }
    "  {0,-10} {1,6} bytes   CR:{2}" -f $f, $b.Length, $cr
}
foreach ($f in 'EFI\BOOT\BOOTX64.EFI','casper') {
    $present = Test-Path (Join-Path $Target $f)
    if (-not $present) { $ok = $false }
    "  {0,-22} present:{1}" -f $f, $present
}
"  volume label          {0}" -f (Get-Volume -DriveLetter $part.DriveLetter).FileSystemLabel

# The real integrity gate: every file the ISO lists, hashed off the stick.
# Takes a couple of minutes and is worth every second -- a half-copied installer
# fails at 3am in front of a laptop with no keyboard shortcut for "try again".
Write-Host "  verifying md5sums (a few minutes)..." -ForegroundColor Cyan
$bad = @(); $n = 0
foreach ($l in Get-Content (Join-Path $Target 'md5sum.txt')) {
    if ($l -match '^([0-9a-f]{32})\s+\.?[\/]?(.+)$') {
        $want = $matches[1]; $rel = $matches[2].Trim() -replace '/','\'
        $f = Join-Path $Target $rel; $n++
        if (-not (Test-Path $f)) { $bad += "MISSING $rel"; continue }
        if ((Get-FileHash $f -Algorithm MD5).Hash.ToLower() -ne $want) { $bad += "BAD $rel" }
    }
}
"  md5sum                {0} files, {1} problems" -f $n, $bad.Count
if ($bad.Count) { $ok = $false; $bad | Select-Object -First 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red } }

if ($ok) {
    Write-Host "`nSTICK READY." -ForegroundColor Green
    Write-Host "Ethernet in, stick in, power on, F12, pick the USB, walk away.`n"
} else {
    Write-Host "`nNOT READY -- see the red lines above." -ForegroundColor Red
}
