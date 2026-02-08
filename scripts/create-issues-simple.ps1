# Simplified GitHub Issues Creation
$repo = "The-Angel-OS/angel-os"

Write-Host "Creating GitHub Issues..." -ForegroundColor Cyan

# Issue 4: Star Trek Federation Design System
gh issue create --repo $repo `
  --title "Star Trek Federation Design System" `
  --label "enhancement,ui/ux,high-priority" `
  --body "Theme configuration created. Next: CSS variables, Framer Motion, component library integration."

# Issue 5: ChatEngine Enhancement
gh issue create --repo $repo `
  --title "ChatEngine Enhancement (Universal Chat Control)" `
  --label "enhancement,messaging,high-priority" `
  --body "Enhance existing ChatEngine.tsx to be THE universal chat component. Add showSideMenu, showTopMenu, showChannelSelector props. ONE component for ALL use cases."

# Issue 6: Payload CMS Pattern Refactor  
gh issue create --repo $repo `
  --title "Payload CMS Pattern Refactor" `
  --label "refactor,technical-debt,high-priority" `
  --body "Remove all custom database queries. Use pure Payload patterns exclusively. Audit Spaces data layer and convert to hooks."

# Issue 11: User AI Key Management
gh issue create --repo $repo `
  --title "User AI Key Management (Economic Model)" `
  --label "feature,security,high-priority,economic-model" `
  --body "CRITICAL: Users bring their own AI keys. Platform provides infrastructure only. API Key management UI with secure storage, multi-provider support, usage transparency."

# Issue 12: Local Model Integration
gh issue create --repo $repo `
  --title "Local Model Integration (Ollama, LM Studio)" `
  --label "feature,sovereignty,medium-priority,economic-model" `
  --body "Support local AI models for complete sovereignty. Ollama integration (localhost:11434), model selection UI, constitutional prompt injection."

# Issue 14: Justice Fund AI Provisioning
gh issue create --repo $repo `
  --title "Justice Fund AI Provisioning" `
  --label "feature,justice-fund,constitutional,medium-priority" `
  --body "5% of commerce revenue provides AI access for those without means. Article V.4: This is not charity. This is architecture. Recipients: unhoused, incarcerated, undocumented."

Write-Host "Done! Check issues at: https://github.com/$repo/issues" -ForegroundColor Green
