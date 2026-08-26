# Bootable USB: Angel OS node on a ThinkPad

Turns a 16 GB stick into an **unattended** Ubuntu Server installer that leaves you
with a headless, SSH-only, lid-proof box ready for the stack.

## Why there is no custom ISO here

Building a remastered ISO would mean a Linux build host, `xorriso`, and ~3 GB of
downloads — to reproduce something Ubuntu already supports natively. Ubuntu's
installer looks at **every attached volume for one labelled `CIDATA`** and reads
its autoinstall config from there.

So: the stock ISO, written normally, plus two small text files in a second
partition on the same stick. Nothing to build, nothing to trust that Canonical
didn't sign, and you can edit the config later in Notepad.

---

## Preflight — three things that can stop you dead

**1. BIOS supervisor password.** You described this ThinkPad as locked out. If
that lockout is a *BIOS* password rather than a Windows one, you cannot change
the boot order and **none of this will work** — on most ThinkPads that's a
mainboard replacement or a service call. Find out first: power on, tap `F1`. If
it demands a password before showing you setup, stop here.

**2. Which disk.** Check whether it has an SSD or spinning rust. `bootstrap.sh`
tests this and warns, but you'd rather know before you wipe anything. Postgres on
a 5400 rpm laptop drive is misery that no amount of RAM fixes.

**3. Ethernet.** Have a cable ready. Wi-Fi during an unattended install is a
whole extra config section and a whole extra failure mode, and this box should
be on ethernet permanently anyway.

> ⚠️ **The autoinstall erases the entire disk with no prompt.** That's what makes
> it unattended, and it's the entire risk. Do not leave this stick in a laptop
> you care about.

---

## Steps 1-4, as one script

[`make-stick.ps1`](make-stick.ps1) does the whole build. Run it **elevated**:

```powershell
Start-Process powershell -Verb RunAs -ArgumentList '-NoExit','-File','C:\Dev\datacenter\cidata\make-stick.ps1'
```

It expects the verified ISO and your filled-in `user-data`/`meta-data` in
`C:\Dev\datacenter\cidata\`. Everything below is what it does, and what to do
by hand if it fails.

**One partition, not two.** It formats the whole stick FAT32 labelled `CIDATA`
and extracts the ISO contents onto it, rather than DD-writing the image and
carving out a second partition. UEFI boots straight from
`\EFI\BOOT\BOOTX64.EFI` on a FAT32 volume, and cloud-init only cares about a
volume *label* — so one partition is both the boot media and the datasource. No
Rufus, no raw disk write, and it sidesteps the snag where Windows refuses to add
a partition after a DD write.

If the ThinkPad won't boot it: Rufus in DD mode, plus a second stick labelled
`CIDATA` holding just the two config files. Ubuntu scans every attached volume.

---

## Step 1 — Download the ISO

Get the current **Ubuntu Server LTS** (24.04 or newer) from
<https://ubuntu.com/download/server>. Server, not Desktop — you want no GUI.

The autoinstall format below is stable across LTS releases, so a newer one is
fine.

## Step 2 — Write it (what the script automates)

[Rufus](https://rufus.ie) → select the stick → select the ISO → **Write in DD
Image mode** when it asks. Partition scheme GPT, target UEFI.

DD mode matters: it writes the image byte-for-byte, which keeps the ISO's own
partitions intact and leaves the rest of the 16 GB as free space — which is
exactly where the next step goes.

## Step 3 — Fill in the two placeholders

Both live in [`user-data`](user-data), and **the install will lock you out of
your own machine if you skip either.**

**A hashed password.** In Git Bash on your desktop:

```bash
openssl passwd -6
```

Type a password twice, paste the `$6$...` output over the `password:` line.

**An SSH key.** You have `railway_iam0` already, but give the node its own — one
key per purpose means revoking one thing never breaks another:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/angel_node -C "angel-node-01"
```

Paste the contents of `~/.ssh/angel_node.pub` over the `ssh-ed25519 AAAA_REPLACE...`
line.

## Step 4 — Add the CIDATA partition

Windows **Disk Management** (`diskmgmt.msc`) → find the USB → right-click the
unallocated space → **New Simple Volume** → FAT32 → **volume label `CIDATA`**
(exactly that, uppercase).

Copy both files to the root of that new partition:

```
CIDATA:\user-data
CIDATA:\meta-data
```

No extension, no `.txt`. Windows Explorer likes to add one — check with
`dir /a` if the installer later claims it found nothing.

> ⚠️ **Copy them out of the git checkout, not out of a Notepad round-trip.**
> `user-data` embeds a shell heredoc. A trailing carriage return on its
> terminator line means the shell hunts for `EOF` and finds `EOF<CR>`, which
> never matches — the logind block is silently dropped and you get a
> server that suspends when you close the lid, with nothing in any log to
> explain it.
> `.gitattributes` pins these two files to LF; if you edit them, use an editor
> that keeps it that way (VS Code: the `CRLF`/`LF` toggle is in the status bar,
> bottom right).

## Step 5 — Install

Plug in ethernet and the stick, power on, tap `F12`, pick the USB.

Then walk away. It partitions, installs, applies the config, and reboots — 10 to
20 minutes depending on the disk. There is nothing to answer.

## Step 6 — Bootstrap

From your desktop:

```bash
ssh -i ~/.ssh/angel_node angel@angel-node-01.local 'bash -s' < docs/selfhost/thinkpad/bootstrap.sh
```

That installs Docker (from Docker's repo, not Ubuntu's — the packaged one has no
compose v2), adds 4 GB of swap, checks the disk, creates `/opt/angelos`, and
installs a nightly `pg_dump`. Then it prints what it deliberately did *not* do.

---

## What the config already handles for you

**The lid.** A laptop suspends when you close it. Close the lid on your server
and 22 portals go dark with no error anywhere explaining why. `user-data` masks
every sleep target and tells logind to ignore the lid entirely. This is the
single most important line in the file.

**Password SSH is off.** Keys only. This box ends up on a residential connection
behind a tunnel and will still get scanned within the hour.

**Security updates apply themselves.** A node nobody logs into for three months
is a node running three-month-old OpenSSH.

**Backups from night one.** The whole database is ~86 MB. There was never an
excuse, and now there's a cron line.

## What it deliberately does not handle

- **Secrets.** `.env.local` is copied by hand, once. Nothing on a USB stick that
  gets left in a drawer should contain a Stripe key.
- **Building Core.** The node pulls a pre-built image. `next build` with
  `--max-old-space-size=4096` will OOM or thrash 8 GB — and that failure is what
  makes people wrongly conclude the hardware is too small. Build on the 32 GB
  desktop or in CI, push a tag, pull it here.
- **Cutover.** Run it as a second node for two weeks first.

## The laptop's one genuine advantage

It has a built-in UPS. The battery is the cheapest clean-shutdown insurance you
can buy, and it's already in the box — assuming it still holds a charge, which
is worth checking before you count on it.

---

## Day two: making it a workstation as well as a node

Proven on a T440s, 260824. None of this is required for the node to serve; it's
here because a Linux laptop you can actually use is worth more than a headless
one, and because each of these cost an hour to find out.

**Desktop.** `kubuntu-desktop` gives KDE Plasma 6.6. Two traps:

- **Plasma 6.6 on 26.04 is Wayland-only, and LightDM does not list Wayland
  sessions** — so Plasma can never appear at the login screen until SDDM replaces
  it. There is no `plasma-workspace-x11` package to fall back to.
- **`sddm.service` guards itself** with
  `ExecStartPre=[ "$(cat /etc/X11/default-display-manager)" = "/usr/bin/sddm" ]`.
  Write `/usr/sbin/sddm` — the path LightDM genuinely uses — and it fails five
  times, hits the restart limiter, and leaves a blinking cursor. Run
  `command -v sddm`; do not reason by analogy about paths.

Set the default session in **both** `~/.dmrc` and
`/var/lib/AccountsService/users/<user>`; they disagree about who decides and you
get whichever wins that boot. Don't swap display managers while someone is logged
in — configure it and let the next reboot apply it.

**⚠️ NetworkManager.** `kubuntu-desktop` pulls it, and NM's default is to manage
every interface it finds. On a Wi-Fi-only node that interface is the uplink *and*
the SSH session you are configuring through. Fence it off BEFORE installing:

```
# /etc/NetworkManager/conf.d/99-angel-unmanaged.conf
[keyfile]
unmanaged-devices=interface-name:wlp3s0
```

The cost is a Plasma network applet that manages nothing. Migrating to NM
properly is fine — just do it sitting at the laptop, where losing the link costs
a retry instead of a drive.

> ✅ **MIGRATED 260826 — this fence is GONE on angel-node-01, deliberately.**
> Ken wanted the Plasma applet to actually manage the Wi-Fi. The clean way is
> **netplan's renderer**, not a hand-written NM profile: add
> `renderer: NetworkManager` to `/etc/netplan/99-wifi.yaml`, delete
> `99-angel-unmanaged.conf`, `netplan apply`, restart NetworkManager. Netplan
> writes the NM connection itself, so the PSK is never retyped and cannot be
> mistyped.
>
> Two things that bit, both worth knowing before repeating this:
>
> 1. **The link drops for ~20 seconds and the DHCP lease CHANGES** (.170 → .171
>    here). Anything addressing the box by IP breaks at exactly the moment you
>    are watching it. This is the argument for the tunnel in one sentence.
> 2. **A rollback guard must be cancelled by the VERIFICATION, not by you.** The
>    first attempt worked, then the guard restored it four minutes later while
>    the SSH session was still reconnecting to the new address — so it looked
>    like a failure and was a success that got undone. Have the script confirm
>    connectivity and cancel its own timer, and remember an `ssh host 'bash -s'`
>    heredoc dies with the connection: put the verification INSIDE what runs on
>    the box.
>
> Do not re-add the unmanaged conf without asking — it is a decision now, not a
> default.

**GitHub auth in VS Code.** The OAuth handoff needs a browser that can hand a
`vscode://` URI back, which a snap-installed Code on a fresh Plasma session
generally cannot. Skip it: `gh auth login` (installed 260826) does device-code
auth — it prints a code, you type it on any machine, and Code's GitHub extension
picks up the credential from `gh` afterwards. Git pushes work immediately either
way once `gh auth setup-git` has run.

**Claude Code runs natively.** `/usr/local/bin/claude`, 2.1.241 as of 260826 —
the Linux build, not a wrapper. `claude` in any terminal on the box.

**Snap browsers don't register as browsers.** XFCE's "Web Browser" button runs
`exo-open --launch WebBrowser`, which reads `helpers.rc` — unset, so a perfectly
working Firefox gives "Failed to execute child process". Fix `helpers.rc`,
`~/.config/mimeapps.list`, and the `x-www-browser` alternative.

**Preseed the display-manager question** before any unattended install that pulls
one, or apt blocks forever on a prompt nobody can see:

```
echo "sddm shared/default-x-display-manager select sddm" | sudo debconf-set-selections
```

**The snap store fails transiently.** One `api.snapcraft.io` DNS error, then the
identical command worked. Retry before believing it.

### What it cost

| | |
|---|---|
| Bare server, idle | 578 MB |
| With KDE Plasma | ~1.3 GB of 7.1 GB |
| Disk, everything installed | 20 GB of 163 GB |

RAM was never the constraint. The build is, which is why the node pulls images
instead of making them.
