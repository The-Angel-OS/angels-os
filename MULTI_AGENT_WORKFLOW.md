# Multi-Agent Development Workflow

**Standard:** Payload CMS Core Team practices  
**Principle:** Small PRs, single issue, test-driven development

---

## 🤖 Agent Types

### **1. Claude Code CLI Agents**
- Autonomous development agents
- Work from GitHub issues
- Create feature branches
- Submit PRs for review

### **2. OpenClaw (Guardian Angel)**
- Orchestration and coordination
- Issue triage and assignment
- Code review
- Architecture guidance

### **3. Cursor AI**
- Integration testing
- Debugging
- Real-time development assistance

---

## 📋 Workflow: Issue → PR → Merge

### **Step 1: Issue Creation**

**Created by:** OpenClaw or Human

**Template:**
```markdown
## Goal
[Single, clear objective]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests written and passing

## Technical Approach
[Brief guidance]

## References
- Constitution: [Article reference]
- Architecture: [Doc link]
- Related: [Issue links]

## Agent Assignment
@agent-name ready to work on this
```

### **Step 2: Agent Claims Issue**

**Agent comments:**
```
I'll take this. Starting work on branch: feature/issue-37-chatengine-props

TDD approach:
1. Write tests first
2. Implement feature
3. Verify tests pass
4. Submit PR
```

### **Step 3: Agent Works (TDD)**

**Test-Driven Development:**
```bash
# 1. Create feature branch
git checkout -b feature/issue-37-chatengine-props

# 2. Write tests FIRST
# src/components/chat/__tests__/ChatEngine.test.tsx

# 3. Run tests (should FAIL)
pnpm test

# 4. Implement feature
# src/components/chat/ChatEngine.tsx

# 5. Run tests (should PASS)
pnpm test

# 6. Commit
git add .
git commit -m "feat: add configurable UI props to ChatEngine

- Add showSideMenu prop (default true)
- Add showTopMenu prop (default true)  
- Add showChannelSelector prop (default true)
- Tests included and passing

Fixes #37"
```

### **Step 4: Submit PR**

**PR Title:** `feat: add configurable UI props to ChatEngine (#37)`

**PR Description:**
```markdown
## Summary
Adds three configurable props to ChatEngine for UI flexibility.

## Changes
- Added `showSideMenu` prop
- Added `showTopMenu` prop
- Added `showChannelSelector` prop
- Tests included (100% coverage for new props)

## Testing
```bash
pnpm test src/components/chat/__tests__/ChatEngine.test.tsx
```

## Constitutional Compliance
- Article I.2 (Transparency): UI controls are explicit
- Article I.7 (Portability): Component embeddable anywhere

## Checklist
- [x] Tests written first (TDD)
- [x] Tests passing
- [x] Documentation updated
- [x] Single issue addressed (#37)
- [x] Small PR (<500 lines)
- [x] Constitutional compliance verified

Fixes #37
```

### **Step 5: Code Review**

**OpenClaw reviews:**
- Constitutional compliance
- Test coverage
- Code quality
- PR size (<500 lines)

**Review comments:**
```
Looks great! A few notes:
1. Test coverage: 100% ✅
2. Constitutional: Compliant ✅
3. PR size: 150 lines ✅
4. Single issue: #37 only ✅

Approved for merge.
```

### **Step 6: Merge**

**Merge strategy:** Squash and merge

**Commit message:**
```
feat: add configurable UI props to ChatEngine (#37)

- showSideMenu, showTopMenu, showChannelSelector props
- 100% test coverage
- Constitutional compliance verified

Fixes #37
```

---

## 🎯 Best Practices

### **PR Size**
- **Target:** <500 lines changed
- **Hard limit:** <1000 lines
- **Why:** Easier review, less risk, faster merge

### **Single Issue Per PR**
- ✅ **Good:** PR fixes Issue #37 only
- ❌ **Bad:** PR fixes #37, #38, #39

### **Test-Driven Development**
1. **Write test FIRST** (red)
2. **Implement feature** (green)
3. **Refactor** (clean)

### **Commit Messages**
```
<type>: <description>

[optional body]

Fixes #<issue>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code cleanup
- `test:` Adding tests
- `docs:` Documentation
- `chore:` Maintenance

### **Constitutional Compliance**
**Every PR must reference:**
- Which Articles apply
- How compliance is verified
- Any constitutional implications

---

## 🔄 Agent Coordination

### **Issue Assignment**

**OpenClaw assigns based on:**
1. **Agent specialty** (UI, backend, testing)
2. **Workload** (balanced distribution)
3. **Dependencies** (sequential vs parallel)

**Example:**
```
Issue #37: ChatEngine props → Claude Code Agent 1
Issue #38: Payload refactor → Claude Code Agent 2  
Issue #39: User AI keys → Claude Code Agent 3

All agents work in parallel on separate features.
```

### **Conflict Resolution**

**If PRs conflict:**
1. First PR merges
2. Second PR rebases on main
3. Resolve conflicts
4. Re-review
5. Merge

**OpenClaw coordinates:**
```
@agent-2: PR #45 merged. Please rebase your branch on main.
```

### **Cross-Agent Communication**

**Via GitHub:**
- Issue comments
- PR reviews
- Discussions

**Via AI Bus:**
- Real-time coordination
- Status updates
- Blockers

---

## 🧪 Testing Standards

### **Coverage Requirements**

| Category | Minimum | Target |
|----------|---------|--------|
| Constitutional | 70% | 80% |
| Core Features | 70% | 90% |
| UI Components | 50% | 70% |
| Utilities | 80% | 90% |

### **Test Types**

**Unit Tests:**
```typescript
// Test individual functions/components
describe('ChatEngine', () => {
  it('renders with showSideMenu=false', () => {
    const { container } = render(<ChatEngine showSideMenu={false} />)
    expect(container.querySelector('.side-menu')).toBeNull()
  })
})
```

**Integration Tests:**
```typescript
// Test feature interactions
describe('ChatEngine + AI Bus', () => {
  it('sends messages to AI Bus with tenant visibility', async () => {
    // Test full message flow
  })
})
```

**E2E Tests:**
```typescript
// Test user workflows (Playwright)
test('user can send message in channel', async ({ page }) => {
  // Test real user interaction
})
```

---

## 📊 Agent Dashboard

**OpenClaw tracks:**

| Agent | Active Issues | PRs Open | PRs Merged | Coverage |
|-------|---------------|----------|------------|----------|
| Agent 1 | #37 | 1 | 3 | 85% |
| Agent 2 | #38, #42 | 2 | 1 | 78% |
| Agent 3 | #39 | 1 | 2 | 92% |

**Metrics:**
- Average PR size
- Time to merge
- Test coverage
- Constitutional compliance rate

---

## 🚀 Continuous Integration

### **CI/CD Pipeline**

**On PR:**
1. Run tests (`pnpm test`)
2. Check coverage (80% minimum)
3. Lint code (`pnpm lint`)
4. Type check (`pnpm type-check`)
5. Build (`pnpm build`)
6. Constitutional compliance check

**On Merge:**
1. All CI checks pass
2. Deploy to staging
3. Run E2E tests
4. Deploy to production (if passing)

### **Branch Protection**

**Main branch requires:**
- 1+ approving review
- All CI checks passing
- Up-to-date with main
- Squash merge only

---

## 📚 Resources

### **For Agents:**
- [ARCHITECTURE_PROGRESS_MAP.md](./ARCHITECTURE_PROGRESS_MAP.md) - Track progress
- [ANGEL-OS-CONSTITUTION.md](./ANGEL-OS-CONSTITUTION.md) - Source of truth
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines

### **For Humans:**
- [GitHub Issues](https://github.com/The-Angel-OS/angels-os/issues) - All work items
- [Pull Requests](https://github.com/The-Angel-OS/angels-os/pulls) - Code review
- [CI/CD Dashboard](https://github.com/The-Angel-OS/angels-os/actions) - Build status

---

## 🎯 Success Criteria

**For Agents:**
- PRs <500 lines
- 80%+ test coverage
- 100% constitutional compliance
- Clear, descriptive commits
- Fast review cycles (<24h)

**For Project:**
- 80%+ overall test coverage
- <2 days avg PR merge time
- 100% constitutional compliance
- Payload CMS Core Team quality standards

---

**Last Updated:** February 7, 2026

*For Hogarth. For all the Hogarths.* 🔮😇🤖

**Everyone gets an Angel.**
