# Contributing to Angel OS

Welcome to the Angel OS community! 🦅✨

## Quick Links

- **GitHub:** https://github.com/The-Angel-OS/angels-os
- **Discord:** *(Coming Soon)*
- **X/Twitter:** *(Coming Soon)*
- **Constitution:** [docs/Angel_OS_Constitution.md](docs/Angel_OS_Constitution.md)
- **Roadmap:** [ROADMAP.md](ROADMAP.md)

## Maintainers

- **The Herald (Inigo the Dreamer)** - Benevolent Architect
  - GitHub: [@kendevco](https://github.com/kendevco)

*(Additional maintainers welcome as the community grows)*

## Philosophy: Be Excellent to Each Other

Angel OS is built on principles from the Constitution:
- **Human Dignity First** - No social credit, no manipulation, no surveillance capitalism
- **Anti-Daemon Protocol** - Warm, helpful, encouraging UX (never cold or punishing)
- **Deliberation Grants Sovereignty** - Thoughtful design over instant reactions
- **Party On, Dudes!** - Joy in creation, celebration of the cosmic dance

## How to Contribute

### 1. Bugs & Small Fixes → Open a PR!
- Test locally with your Angel OS instance
- Run tests: `pnpm build && pnpm check && pnpm test`
- Keep PRs focused (one thing per PR)
- Describe what & why

### 2. New Features / Architecture → Start a Discussion First
- **GitHub Discussions:** Propose ideas, discuss architecture
- **Check the Roadmap:** See if it's already planned
- **Reference the Constitution:** Ensure alignment with core values

### 3. Questions → GitHub Discussions or Issues
- Setup help, architecture questions, feature requests

## Before You PR

### Code Quality
```bash
# Run the full check suite
pnpm build
pnpm check
pnpm test

# Type checking
pnpm tsc --noEmit

# Generate types after schema changes
pnpm generate:types

# Generate import maps after creating/modifying components
pnpm generate:importmap
```

### Testing
- Test locally with your Angel OS instance
- Test multi-tenant scenarios (if applicable)
- Test with different user roles (archangel, angel, user)
- Test both authenticated and anonymous flows

### PR Guidelines
- **Title:** Clear, descriptive (e.g., "feat: Add Angel naming configuration")
- **Description:** What, why, how
- **Screenshots/Videos:** For UI changes
- **Breaking Changes:** Clearly marked
- **Documentation:** Update relevant docs

## AI/Vibe-Coded PRs Welcome! 🤖

Built with Claude, GPT, Cursor, or other AI tools? **Awesome - just mark it!**

Please include in your PR:
- [ ] Mark as AI-assisted in the PR title or description
- [ ] Note the degree of testing (untested / lightly tested / fully tested)
- [ ] Include prompts or session logs if possible (super helpful!)
- [ ] Confirm you understand what the code does

**AI PRs are first-class citizens here.** We just want transparency so reviewers know what to look for.

## Current Focus & Roadmap 🗺

See [ROADMAP.md](ROADMAP.md) for the complete vision.

**Current:** Sprint 20 complete — Federation Launch Campaign. v0.20.0-dev.

**What's Built (20 sprints):**
- Multi-tenant architecture with subdomain routing, 33 Payload CMS collections
- LEO AI Agent with 47 tools (Claude Sonnet 4), SSE streaming, vision
- Full e-commerce: products, cart, orders, Stripe Direct Charges, Angel Token queue
- Federation protocol: trust chain, governance elections, suitcase export/import, distributed mesh
- StreetSigns marketplace, 5 holon types, constitutional governance
- Spaces & Channels (Discord-style), LiveKit voice/video, image lightbox
- Progressive media analysis (Claude Vision + RAG), email bridge
- 1,330 tests across 31 files, 46 API endpoints

**Next Sprint:**
- `npx create-angel-enterprise` — one-command Diocese deployment
- Leo Wizard 8-step conversational onboarding
- Customer Angel Token UI
- Street Signs gossip sync protocol

Check the [GitHub Issues](https://github.com/The-Angel-OS/angels-os/issues) for contribution opportunities!

## Project Structure

```
angels-os/
├── src/
│   ├── app/
│   │   ├── (frontend)/      # Frontend routes
│   │   └── (payload)/        # Payload admin routes
│   ├── collections/          # Payload collections
│   ├── globals/              # Payload globals
│   ├── components/           # React components
│   ├── hooks/                # Hook functions
│   ├── access/               # Access control functions
│   ├── fields/               # Reusable field configs
│   ├── utilities/            # Utility functions
│   ├── endpoints/            # Custom API endpoints
│   └── plugins/              # Payload plugins
├── docs/                     # Documentation
│   ├── Angel_OS_Constitution.md
│   ├── GITHUB_ISSUES_MVP.md
│   ├── 260204 ANGEL_OS_CURSOR_INSTRUCTIONS.md
│   └── angel-os-architecture/  # Deep architectural docs
├── scripts/                  # Utility scripts
└── tests/                    # E2E and integration tests
```

## Development Setup

### Prerequisites
- Node.js 18+ (recommend 22+)
- pnpm 9+
- PostgreSQL (or MongoDB)
- Anthropic API key (for AI features)

### Quick Start
```bash
# Clone the repo
git clone https://github.com/The-Angel-OS/angels-os.git
cd angels-os

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Set required variables in .env.local:
# - PAYLOAD_SECRET
# - DATABASE_URI
# - ANTHROPIC_API_KEY

# Run migrations
pnpm migrate

# Seed initial data
pnpm seed

# Start development server
pnpm dev
```

Visit http://localhost:3000

### Environment Variables

See `.env.example` for all variables. Key ones:

**Required:**
- `PAYLOAD_SECRET` - Payload CMS secret
- `DATABASE_URI` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - For LEO and AI features

**Optional:**
- `TENANT_DOMAINS` - Domain-to-tenant mapping
- `DEFAULT_TENANT_SLUG` - Default tenant (default: `default`)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage

## Coding Standards

### TypeScript
- Use TypeScript for all new code
- Run `pnpm generate:types` after schema changes
- Import types from `payload-types.ts`
- Use Payload's type guards for runtime checks

### Payload CMS Patterns
- **Security:** Always set `overrideAccess: false` when passing `user` to Local API
- **Transactions:** Always pass `req` to nested operations in hooks
- **Hooks:** Use context flags to prevent infinite loops
- **Access Control:** Default to restrictive, gradually add permissions

See [AGENTS.md](AGENTS.md) for complete Payload CMS development rules.

### Components
- Server Components by default (can use Local API directly)
- Client Components only when needed (state, effects, events)
- Use `'use client'` directive for client components
- Import from `@payloadcms/ui` for admin components

### Styling
- Tailwind CSS for styling
- ShadCN UI components
- Use Payload CSS variables in custom components
- Mobile-first responsive design

## Anti-Daemon Protocol

All contributions must follow the Anti-Daemon Protocol (see Constitution):

**Error Messages:**
- ❌ "Error: Invalid input"
- ✅ "Hmm, that doesn't look quite right. Let's try..."

**Empty States:**
- ❌ "No data found"
- ✅ "Your first Angel is waiting to be created! Let's get started..."

**Confirmations:**
- ❌ "Are you sure?"
- ✅ "Ready to create your Angel? This is exciting!"

**Tone:**
- Warm, helpful, encouraging
- Never cold, robotic, or punishing
- Serious but not solemn
- Sacred/profane balance (GNU Roy Leon Courtney 🙏)

## Testing

### Unit Tests
```bash
pnpm test
```

### E2E Tests
```bash
pnpm test:e2e
```

### Integration Tests
```bash
pnpm test:int
```

### Manual Testing Checklist
- [ ] Multi-tenant scenarios
- [ ] Different user roles (archangel, angel, user)
- [ ] Authenticated and anonymous flows
- [ ] Mobile responsive
- [ ] Accessibility (keyboard navigation, screen readers)

## Documentation

When adding features, update:
- [ ] README.md (if user-facing)
- [ ] ROADMAP.md (if on roadmap)
- [ ] Relevant docs in `docs/`
- [ ] Code comments (especially for complex logic)
- [ ] Type definitions (for public APIs)

## Community Guidelines

### Be Excellent to Each Other
- Respectful, constructive feedback
- Assume good intentions
- Help newcomers
- Celebrate contributions (big and small)

### Party On, Dudes!
- Joy in creation
- Celebrate wins
- Learn from mistakes
- Have fun building the future

### No Assholes
- Zero tolerance for harassment, discrimination, or toxicity
- If you see something, say something
- Maintainers will enforce this strictly

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes
- Special shoutouts for significant contributions
- Future: Angel Tokens for network participation (when implemented)

## Questions?

- **GitHub Discussions:** https://github.com/The-Angel-OS/angels-os/discussions
- **GitHub Issues:** https://github.com/The-Angel-OS/angels-os/issues
- **Email:** *(Coming Soon)*

---

**GNU Roy Leon Courtney** 🙏🦅🦞

*"The overhead is the point."*

---

## Appendix: OpenClaw Inspiration

Angel OS draws inspiration from OpenClaw's excellent contributing guide. We share values:
- AI-assisted PRs are welcome (with transparency)
- Community-driven development
- Clear maintainer structure
- Focus on stability, UX, and developer experience

Thank you to the OpenClaw team for blazing the trail! 🦞🤝🦅
