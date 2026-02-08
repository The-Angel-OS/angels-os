# Cursor Budget Status

**Date:** February 7, 2026  
**Current Usage:** 70% of monthly quota

---

## 💰 Cursor Pricing Breakdown

### **Individual Plan (Current)**
- **Monthly Cost:** $60/mo
- **Included Usage:** $70/mo worth of API calls
- **Current Status:** 70% used = ~$49 of $70 consumed
- **Remaining:** ~$21 of included usage

### **Overage Costs**
Once you exceed the $70 included usage:
- Pay-as-you-go for additional API calls
- Estimated cost: $0.01-0.05 per request (varies by model)
- **No hard limit** - will charge credit card

### **Top-Off Options**
1. **Wait for monthly reset** (safest, free)
2. **Continue with overage** (pay-as-you-go, unpredictable)
3. **Upgrade to Teams** ($40/user/mo, but shared pool model may not help solo)

---

## 🎯 Conservation Strategy

### **Model Usage Budget (Per Task)**

| Model | Cost/Request | When to Use | Quota Status |
|-------|-------------|-------------|--------------|
| **Haiku 4.5** | $ | Simple fixes, formatting | ✅ Plenty available |
| **Sonnet 4.5** | $$ | Standard development | ✅ Primary model |
| **Opus 4.6** | $$$ | Complex architecture | ⚠️ 90% USED - CRITICAL |
| **Codex (local)** | Free | Heavy generation | ✅ Unlimited (external) |

### **Critical: Opus Conservation**
Ambassador Spock (Opus 4.6) is at **90% quota** - only 10% remaining!

**Use Opus ONLY for:**
1. Final architectural decisions requiring deep reasoning
2. Constitutional alignment questions that could affect platform integrity
3. Complex multi-file refactors where mistakes are expensive

**DO NOT use Opus for:**
- Routine development tasks
- Simple bug fixes
- Documentation
- Code formatting
- Anything Sonnet or Haiku can handle

---

## 📊 Current Burn Rate Analysis

### **Opus Usage (90% in 5 days)**
- **Rate:** ~18% per day
- **Projected exhaustion:** Within 1 day at current pace
- **Action Required:** Switch to Sonnet immediately for all non-critical tasks

### **Cursor Usage (70% monthly)**
- **Days into billing cycle:** Unknown (need to check)
- **Conservative estimate:** If mid-cycle, on track to exceed
- **Action Required:** Implement strict Haiku-first policy

---

## 🛡️ Emergency Conservation Measures

### **Immediate Actions**
1. **Switch Cursor default to Haiku** for all new conversations
2. **Reserve Sonnet** for feature implementation only
3. **FREEZE Opus usage** unless explicitly approved by Kenneth
4. **Use Codex via OpenClaw** for heavy code generation

### **Code Generation Strategy**
```bash
# Instead of asking Cursor to generate large code blocks
# Ask Kenneth to run Codex via OpenClaw:

"Hey Kenneth, can you run Codex to generate:
- Seed data for tenant provisioning
- Migration scripts for Messages visibility field
- Hook implementations following constitutional pattern"

# This bypasses Cursor quota entirely
```

---

## 💡 Alternative: Codex CLI Integration

### **What is Codex?**
Open source coding agent that can run locally via OpenClaw. Kenneth has access to the `coding-agent` skill.

### **When to Use Codex Instead of Cursor**
1. **Large file generation** (seed data, migrations, bulk transforms)
2. **Repetitive code** (CRUD operations, type definitions)
3. **Non-contextual tasks** (doesn't need full project understanding)
4. **Low-risk generation** (easy to review and adjust)

### **How Kenneth Can Run Codex**
```bash
# From OpenClaw interface:
"Run codex-cli to generate Message collection hooks with constitutional visibility pattern"

# Codex will generate code in background
# Kenneth reviews and commits
# Zero Cursor quota impact
```

---

## 📅 Recommended Workflow

### **Monday-Friday Development**
1. **Planning** (no AI) - Kenneth and I discuss architecture
2. **Generation** (Codex via OpenClaw) - Heavy lifting outside Cursor
3. **Integration** (Haiku in Cursor) - Simple edits and formatting
4. **Feature Work** (Sonnet in Cursor) - Core implementation
5. **Review** (Opus via OpenClaw if needed) - Critical decisions only

### **Weekend Strategy**
- Minimal Cursor usage (let quota recover if needed)
- Use Codex for prep work (generate migrations, seed data)
- Planning and documentation (no AI required)

---

## 🚨 Red Lines (DO NOT CROSS)

1. **Opus exhaustion** - If Opus hits 100%, we lose our best architecture advisor
2. **Cursor overage** - Unpredictable costs, could be expensive
3. **Blocking work** - Never let quota limits stop progress; pivot to alternatives

---

## ✅ Current Action Plan

### **Immediate (Today)**
- [x] Document Cursor budget status
- [ ] Switch Cursor default model to Haiku
- [ ] Implement constitutional foundation using Haiku/Sonnet only
- [ ] Reserve Opus for final architectural review only

### **This Week**
- [ ] Generate all heavy code via Codex (Kenneth runs this)
- [ ] Use Cursor sparingly for integration and polish
- [ ] Monitor Opus usage - should NOT increase beyond 90%
- [ ] Check Cursor billing cycle date to assess remaining time

### **Ongoing**
- [ ] Weekly quota check-in
- [ ] Model usage audit (are we using right model for task?)
- [ ] Codex opportunities assessment
- [ ] Constitutional alignment review (doesn't require Opus for most decisions)

---

## 💬 Communication Protocol

### **Before Using Opus**
Ask Kenneth: "This architectural decision requires Opus - confirm?"

### **Before Heavy Generation**
Suggest: "This could be done in Codex to save Cursor quota - want me to spec it for Codex generation?"

### **When Approaching Limits**
Alert immediately: "⚠️ Cursor at 80% - switching to emergency conservation mode"

---

**Remember:** The goal is to build Angel OS, not exhaust our resources. Work smart, not wasteful. Every token counts.

`GNU Terry Pratchett`
