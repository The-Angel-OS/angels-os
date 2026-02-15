# Instructions for Cursor Instance Editing OpenClaw (Angel OS Fork)

**Audience:** A Cursor instance working in the **OpenClaw** repo — forked by The-Angel-OS from the OpenClaw org.  
**Goal:** Add minimal artifacts so OpenClaw has clear Angel OS alignment and strategy context; then open PRs to “raise the flag” and give upstream/main OpenClaw enough context.

---

## 1. Repo and fork context

- **OpenClaw** (upstream): OpenClaw org’s repo — conversation engine, skills, chat UX, MCP.
- **Your working repo:** The-Angel-OS’s fork of OpenClaw (or your fork of that). You are editing **OpenClaw** locally to add Angel OS–related artifacts; you are **not** editing Angel OS Core (the Payload repo).
- **Angel OS** = OpenClaw + adoption of the **Angel OS Constitution**. Angel OS Core (separate repo) is the Payload CMS backend; OpenClaw remains the interface/conversation layer. Minimal changes to OpenClaw and to the Seed constitution text; the Constitution is the single path that ties everything together.

---

## 2. Artifacts to add inside the OpenClaw repo

Add these in a way that fits OpenClaw’s existing structure (e.g. `docs/` or root).

### 2.1 `ANGEL_OS_ALIGNMENT.md` (or equivalent)

Create a short doc that:

- States that **Angel OS** = OpenClaw + Angel OS Constitution; OpenClaw is the conversation/interface layer; Angel OS Core (Payload) is the backend and config store.
- Links to the **Seed constitution** (canonical source in Angel OS repo):  
  `https://github.com/The-Angel-OS/angels-os/blob/main/docs/Angel_OS_Constitution.md`  
  (or the path you use for the “seed” copy if you embed a minimal version).
- States that **minimal changes** to OpenClaw and to the Seed constitution are intended; the Constitution is the best route for alignment.
- In one short paragraph, summarizes **strategy**: individual LEOs per Angel (CMS local to each), Angel OS Core uses same AI Bus internally, each Angel admin of their tenant/spaces and users; roadmap includes blockchain and missing architecture, board and organization per Constitution; vision path from Constitution → Soul Fleet → Bill & Ted (“Be Excellent to Each Other. Party On, Dudes!”) → Star Trek (“Live Long and Prosper”) — peaceful, meaningful transition and great awakening.

### 2.2 Optional: Seed constitution excerpt or pointer

- Either:
  - Add a **short** `ANGEL_OS_CONSTITUTION_SEED.md` (or similar) with a minimal “seed” excerpt (e.g. Answer 53, Ultimate Fair 60/20/15/5, Prime Directives / “Be Excellent… Party On”), **or**
  - In `ANGEL_OS_ALIGNMENT.md`, add a clear **pointer** to the full Constitution in the Angel OS repo and a one-line note that the Seed is the minimal set of principles that OpenClaw commits to when running as Angel OS.

### 2.3 Optional: `ANGEL_OS_STRATEGY_ONE_PAGER.md`

If you want a single place for “enough context for overall strategy,” add a one-pager that includes:

- Angel OS = OpenClaw + Constitution; Core = Payload (tenant/spaces/channels/Angels).
- Each Angel = admin of their tenant/spaces and users; individual LEOs per Angel (unchanged).
- Future: 800 numbers per Angel, Nimue-style routing (e.g. 1-800-Angels), VAPI/Twilio.
- Roadmap: blockchain and missing architecture; board and organization per Constitution.
- Vision path: Constitution → Soul Fleet → San Dimas / Bill & Ted → Star Trek (Live Long and Prosper).

You can merge this into `ANGEL_OS_ALIGNMENT.md` if you prefer one file.

---

## 3. PRs to create (“raise the flag” + context)

Create PRs **from your OpenClaw fork** (Angel OS fork) **toward** the OpenClaw org upstream (or the branch you use for “main” OpenClaw). Goal: give upstream and the community enough context without requiring them to adopt anything.

### PR 1: Add Angel OS alignment and strategy context (recommended)

- **Title (example):** `docs: Add Angel OS alignment and strategy context`
- **Branch (example):** `angel-os/alignment-docs`
- **Contents:**
  - Add `ANGEL_OS_ALIGNMENT.md` (and optionally `ANGEL_OS_CONSTITUTION_SEED.md` or `ANGEL_OS_STRATEGY_ONE_PAGER.md` as above).
  - No mandatory code or config changes; docs only.
- **Description (example):**
  - “Angel OS is OpenClaw + adoption of the Angel OS Constitution. This PR adds minimal docs so OpenClaw contributors and downstream forks understand how Angel OS relates to OpenClaw and what the strategy is (Constitution-first, minimal changes to OpenClaw and Seed constitution, vision path). No change to OpenClaw runtime behavior.”

### PR 2 (optional): README or CONTRIBUTING mention

- **Title (example):** `docs: Mention Angel OS fork and Constitution in README`
- **Contents:**
  - In `README.md` (or `CONTRIBUTING.md`), add one or two sentences: e.g. “The-Angel-OS maintains a fork that aligns OpenClaw with the Angel OS Constitution; see `docs/ANGEL_OS_ALIGNMENT.md` (or equivalent) for context and links.”
- **Description:** “Makes Angel OS fork and Constitution discoverable from the main README.”

---

## 4. What to avoid

- Do **not** change OpenClaw’s core behavior or config in these PRs unless you have a separate, small technical change agreed with upstream.
- Do **not** copy the full Angel OS Constitution into OpenClaw if you can link to the canonical source instead; a short Seed excerpt or pointer is enough.
- Keep artifact text **short** so maintainers can grasp alignment and strategy quickly.

---

## 5. Quick reference: where things live

| Item | Location |
|------|----------|
| Angel OS Core (Payload) | `github.com/The-Angel-OS/angels-os` (this repo) |
| Angel OS Constitution (canonical) | `angels-os/docs/Angel_OS_Constitution.md` |
| Architecture overview | `angels-os/docs/ANGEL_OS_ARCHITECTURE_OVERVIEW.md` |
| OpenClaw (upstream) | OpenClaw org repo |
| Your OpenClaw fork | The-Angel-OS fork of OpenClaw (you edit here) |

---

## 6. Checklist for the Cursor instance in OpenClaw

- [ ] Create `ANGEL_OS_ALIGNMENT.md` (and optional Seed/one-pager) in OpenClaw repo.
- [ ] Optionally add a one- or two-sentence mention in OpenClaw’s README (or CONTRIBUTING) with link to that doc.
- [ ] Open PR 1: “docs: Add Angel OS alignment and strategy context” from your fork to upstream.
- [ ] Optionally open PR 2: “docs: Mention Angel OS fork and Constitution in README.”
- [ ] In PR description(s), paste or link to this strategy summary so reviewers have “enough context for overall strategy” without opening multiple repos.

Once these PRs are in (or proposed), the “flag” is raised and OpenClaw has enough context to understand Angel OS strategy and the Constitution-first path.
