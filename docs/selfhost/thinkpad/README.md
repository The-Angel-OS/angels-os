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

## Step 1 — Download the ISO

Get the current **Ubuntu Server LTS** (24.04 or newer) from
<https://ubuntu.com/download/server>. Server, not Desktop — you want no GUI.

The autoinstall format below is stable across LTS releases, so a newer one is
fine.

## Step 2 — Write it with Rufus

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
> `user-data` embeds a shell heredoc, and a trailing `` on its terminator
> means `EOF` never matches `EOF` — the logind block is silently dropped and
> you get a server that suspends when you close the lid, with nothing in any log
> to explain it. `.gitattributes` pins these two files to LF; if you edit them,
> use an editor that keeps it that way (VS Code: the `CRLF`/`LF` toggle is in
> the status bar, bottom right).

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
