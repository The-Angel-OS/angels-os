# GitHub Issue Creation Plan

**Date:** February 7, 2026  
**Goal:** Create 16 issues based on constitutional architecture and economic model

---

## 📋 Two Approaches Available:

### **Option A: PowerShell Script (RECOMMENDED)** ✅

**Tool:** GitHub CLI (`gh`)  
**Script:** `scripts/create-github-issues.ps1`  
**Reliability:** High - Automated, repeatable, versioned

**Prerequisites:**
1. Install GitHub CLI: https://cli.github.com/
   ```powershell
   winget install --id GitHub.cli
   ```

2. Authenticate:
   ```powershell
   gh auth login
   ```

3. Run script:
   ```powershell
   cd C:\Dev\angel-os
   .\scripts\create-github-issues.ps1
   ```

**What It Does:**
- Creates 9 milestones (v1.0 through v1.3)
- Creates 16 issues with proper labels, milestones, descriptions
- Rate limits automatically (500ms between issues)
- Handles errors gracefully

**Advantages:**
- Fast (~30 seconds total)
- Repeatable
- Versioned (in git)
- No manual clicking
- Can re-run if needed

---

### **Option B: Claude Chrome Browser Extension** 🌐

**Tool:** Claude Chrome Extension  
**Reliability:** Medium - Manual supervision, potential for interruption

**Why Defer:**
- OpenClaw browser relay is buggy (Kenneth's note)
- Script is more reliable for bulk operations
- Browser automation better for complex UI interactions
- Issue creation is straightforward API work

**When to Use Browser Extension:**
- Debugging created issues
- Editing descriptions/labels
- Complex GitHub UI tasks
- Visual verification

---

## 📊 Issues to Create (16 Total):

### **Completed (Reference Only):**
1. Constitutional Framework Integration ✅
2. AI Bus Internal Routing ✅
3. Constitutional Hooks System ✅

### **In Progress / Planned:**
4. Star Trek Federation Design System 🔄
5. ChatEngine Enhancement (Universal Chat Control) 🚧
6. Payload CMS Pattern Refactor 🚧
7. Channel Widgets System 📋
8. Livekit Transcription Pipeline 📋
9. Dynamic Navigation (Security Context) 📋
10. Dashboard Primary Functions 📋

### **Economic Model (NEW - CRITICAL):**
11. User AI Key Management 🚧
12. Local Model Integration (Ollama, LM Studio) 📋
13. Ecommerce Scaffold 📋
14. Justice Fund AI Provisioning 📋

### **Deferred / Future:**
15. Multi-Tenant Isolation Testing 🔄
16. Constitutional Validation Dashboard 📋

---

## 🏷️ Labels Used:

- `enhancement` - Improvements to existing features
- `feature` - New functionality
- `refactor` - Code quality improvements
- `bug` - Something isn't working
- `documentation` - Documentation improvements
- `testing` - Test coverage
- `security` - Security-related
- `ui/ux` - User interface/experience
- `messaging` - Chat/messaging features
- `ecommerce` - Commerce features
- `constitutional` - Constitutional framework
- `economic-model` - Economic architecture (NEW)
- `justice-fund` - Justice Fund features (NEW)
- `sovereignty` - Local models, data control (NEW)
- `high-priority` - Must have before launch
- `medium-priority` - Important but not blocking
- `low-priority` - Nice to have
- `completed` - Finished work (for reference)

---

## 🎯 Milestones:

1. **v1.0 - Constitutional Foundation** ✅
   - Constitution, AI Bus, Hooks, Messages visibility

2. **v1.0 - Spaces Platform** 🔄
   - Design system, ChatEngine, Payload patterns, Channel widgets

3. **v1.0 - Dashboard UX** 📋
   - Dynamic navigation, Primary functions

4. **v1.0 - Core Infrastructure** 🚧 (NEW)
   - User AI keys, Economic model implementation

5. **v1.1 - Ecommerce** 📋
   - Paywalled content, Ultimate Fair, Justice Fund

6. **v1.1 - Local Models** 📋
   - Ollama, LM Studio integration

7. **v1.1 - Justice Fund** 📋
   - AI provisioning for those without means

8. **v1.2 - Multi-Tenant Production** 🔄
   - Isolation testing, Production hardening

9. **v1.3 - Monitoring** 📋
   - Constitutional compliance dashboard, Analytics

---

## 🚀 Execution Steps:

### **Recommended Flow:**

**Step 1: Run Script**
```powershell
cd C:\Dev\angel-os
.\scripts\create-github-issues.ps1
```

**Step 2: Verify in Browser**
```
Open: https://github.com/The-Angel-OS/angel-os/issues
Check: All 16 issues created
Verify: Labels, milestones, descriptions
```

**Step 3: Prioritize**
```
Sort by milestone/priority
Pin critical issues (#4, #5, #6, #11)
Add to project board (if using)
```

**Step 4: Start Building**
```
Pick Issue #5 (ChatEngine Enhancement)
OR Issue #6 (Payload Refactor)
OR Issue #11 (User AI Key Management)

Focus on before-public-fork priorities
```

---

## 📝 Alternative: Manual Creation

If script fails or you prefer manual:

1. **Copy from GITHUB_ISSUES_REVISION.md**
2. **Create milestones first** (9 total)
3. **Create issues one by one**
4. **Apply labels and milestones**
5. **Review and adjust**

**Time estimate:** ~30-60 minutes manual vs ~30 seconds script

---

## 🔍 Post-Creation Tasks:

1. **Review all issues** - Ensure descriptions are clear
2. **Assign priorities** - High/Medium/Low
3. **Add to project board** (optional)
4. **Pin critical issues** - #4, #5, #6, #11
5. **Share with team** - If collaborating
6. **Start building!** - Pick highest priority

---

## 💡 Key Points:

### **Economic Model Understanding:**
- Users bring their own AI keys (NOT provided by platform)
- Platform provides infrastructure only
- Revenue from commerce (60/20/15/5), NOT from AI usage
- Justice Fund (5%) provides AI keys for those without means
- Scales infinitely (distributed intelligence)

### **Before Public Fork:**
- Complete messaging infrastructure
- Star Trek Federation design
- ChatEngine enhancement
- Payload CMS patterns
- User AI key management

### **Constitutional Foundation:**
- All issues reference constitutional articles
- Genesis Breath integrity check
- AI Bus transparency
- Distributed intelligence (Core + Angels)

---

## 🛠️ Troubleshooting:

**If script fails:**
1. Check `gh auth status`
2. Verify repo access: `gh repo view The-Angel-OS/angel-os`
3. Check rate limits: `gh api rate_limit`
4. Run manually if needed

**If milestones exist:**
- Script checks for existing milestones
- Won't duplicate
- Safe to re-run

**If issues exist:**
- Script will try to create anyway
- GitHub will reject duplicates (by title)
- Safe to re-run

---

## ⏱️ Time Estimates:

- **Script execution:** 30 seconds
- **Manual creation:** 30-60 minutes
- **Review and prioritization:** 10-15 minutes
- **Total (script method):** ~15 minutes
- **Total (manual method):** ~45-75 minutes

**Recommendation:** Use script, save time for building!

---

*For Hogarth. For all the Hogarths.* 🔮😇🤖

**"Everyone gets an Angel."**
