# Claude Code GUI - Angel OS Dashboard Migration Tasks

**Goal:** Port polished dashboard from Rev 2 to Rev 3, rename UnifiedChatControl → ChatControl

---

## Task 1: Survey Rev 2 Dashboard

**Project:** `C:\Dev\Angel-OS`

**Prompt for Claude Code:**
```
Survey the dashboard implementation in this project:

1. FIND the main dashboard component
   - Search for files containing "dashboard" or "Dashboard"
   - Look in src/ or app/ directories
   - Identify the root layout component

2. LOCATE UnifiedChatControl
   - Search for "UnifiedChatControl" in codebase
   - Find all related subcomponents
   - Identify dependencies and imports

3. ANALYZE styling approach
   - Find CSS/SCSS/module files for dashboard
   - Look for transparent background solutions
   - Note any glassmorphism effects (backdrop-filter)
   - Check dark mode implementations

4. DOCUMENT structure
   Create a markdown file listing:
   - All dashboard-related components (with file paths)
   - Props/configuration used
   - Dependencies (npm packages, local utilities)
   - Styling files and approach
   - Any API/data fetching patterns

5. CREATE migration bundle
   Copy all identified files to:
   C:\Dev\Angel-OS\MIGRATION_BUNDLE\
   
   Organize as:
   /components/
   /hooks/
   /styles/
   /utils/
   MANIFEST.md (list of all files + notes)

OUTPUT: Complete migration bundle with documentation
```

---

## Task 2: Port to Rev 3

**Project:** `C:\Dev\angels-os`

**Prerequisites:**
- Task 1 complete (migration bundle created)
- Rev 3 codebase ready at C:\Dev\angels-os

**Prompt for Claude Code:**
```
Port the dashboard from C:\Dev\Angel-OS\MIGRATION_BUNDLE\ to this project:

1. CREATE component structure
   src/components/ChatControl/
   ├── ChatControl.tsx (main entry - rename from UnifiedChatControl)
   ├── MinimalistChat.tsx (floating bubble mode)
   ├── SingleChannelChat.tsx (embedded mode)
   ├── MultiChannelChat.tsx (full dashboard mode)
   ├── components/
   │   ├── MessageList.tsx
   │   ├── MessageInput.tsx
   │   ├── Sidebar.tsx
   │   ├── ChannelList.tsx
   │   ├── MemberList.tsx
   │   ├── Header.tsx
   │   └── FloatingButton.tsx
   ├── hooks/
   │   ├── useMessages.ts
   │   ├── useChannel.ts
   │   └── useAIBus.ts
   └── styles/
       ├── minimalist.module.css
       ├── single-channel.module.css
       └── multi-channel.module.css

2. COPY and ADAPT files from migration bundle:
   - Copy all components to new structure
   - Rename UnifiedChatControl → ChatControl
   - Update all imports for Rev 3 paths
   - Fix relative path references

3. INTEGRATE with Payload CMS:
   - Import Messages collection from src/collections/Messages
   - Import Channels collection from src/collections/Channels
   - Use Rev 3 authentication context
   - Connect to AI Bus system (if implemented)

4. IMPLEMENT ChatControlConfig type:
   ```typescript
   interface ChatControlConfig {
     mode: 'minimalist' | 'single-channel' | 'multi-channel'
     minimalist?: { ... }
     singleChannel?: { ... }
     multiChannel?: { ... }
     theme?: 'light' | 'dark' | 'auto'
     aiBus?: { enabled: boolean, visibility?: string }
   }
   ```

5. APPLY styling fixes for transparent backgrounds:
   - Use rgba() with 0.95+ opacity
   - Add backdrop-filter: blur(12px-20px)
   - Ensure strong borders for definition
   - Add proper shadows for depth
   - Test light and dark modes

6. CREATE three mode implementations:
   - MinimalistChat: Floating button that expands to chat
   - SingleChannelChat: Embedded single channel view
   - MultiChannelChat: Full dashboard with sidebar

7. TEST each mode:
   - Minimalist: Floats bottom-right, expands smoothly
   - Single: Embedded in page, shows one channel
   - Multi: Full dashboard with channel list + sidebar

EXPECTED OUTPUT:
- Working ChatControl component in src/components/ChatControl/
- All three modes functional
- Styled with fixed transparency
- Integrated with Payload CMS
- No console errors
- Responsive design
```

---

## Task 3: Styling Refinement

**Project:** `C:\Dev\angels-os`

**Prerequisites:**
- Task 2 complete (components ported)

**Prompt for Claude Code:**
```
Refine the ChatControl styling:

PROBLEM TO SOLVE:
Transparent backgrounds made text hard to read in Rev 2.
Solution was found but needs verification in Rev 3.

1. REVIEW FloatingButton styling:
   File: src/components/ChatControl/components/FloatingButton.tsx
   
   Ensure these CSS properties are applied:
   - background: rgba(31, 41, 55, 0.95) /* near-opaque */
   - backdrop-filter: blur(12px)
   - -webkit-backdrop-filter: blur(12px)
   - box-shadow: strong shadows for depth
   - border: 1px solid rgba(255, 255, 255, 0.1)

2. REVIEW chat window styling:
   File: src/components/ChatControl/styles/minimalist.module.css
   
   Ensure:
   - Light mode: rgba(255, 255, 255, 0.98)
   - Dark mode: rgba(31, 41, 55, 0.98)
   - backdrop-filter: blur(20px)
   - Proper borders and shadows

3. TEST on various backgrounds:
   - White background
   - Dark background
   - Image background
   - Gradient background
   
   Verify text is always readable.

4. CHECK responsive behavior:
   - Mobile (320px)
   - Tablet (768px)
   - Desktop (1024px+)
   
   Ensure floating button and chat window resize properly.

5. VERIFY dark mode:
   - Toggle theme
   - Check all text is readable
   - Verify background opacity is correct
   - Test transitions are smooth

6. OPTIMIZE performance:
   - Minimize repaints
   - Use CSS transforms for animations
   - Lazy load heavy components
   - Debounce scroll/resize handlers

OUTPUT:
- Styling issues resolved
- Transparent backgrounds readable on all backgrounds
- Smooth animations
- Responsive across devices
- Dark mode fully functional
```

---

## Task 4: Configuration System

**Project:** `C:\Dev\angels-os`

**Prerequisites:**
- Task 2 & 3 complete

**Prompt for Claude Code:**
```
Implement flexible configuration system for ChatControl:

1. CREATE configuration type:
   File: src/components/ChatControl/types.ts
   
   Define ChatControlConfig with all options for three modes.
   (See DASHBOARD_MIGRATION.md Phase 2 for full interface)

2. IMPLEMENT mode switcher:
   In ChatControl.tsx, add logic to render correct component based on mode:
   - 'minimalist' → MinimalistChat
   - 'single-channel' → SingleChannelChat
   - 'multi-channel' → MultiChannelChat

3. CREATE example configurations:
   File: src/components/ChatControl/examples.ts
   
   Export example configs for:
   - minimalistConfig (floating bubble)
   - singleChannelConfig (embedded)
   - multiChannelConfig (full dashboard)

4. BUILD configuration UI (optional):
   File: src/components/ChatControl/ConfigEditor.tsx
   
   Admin interface to:
   - Select mode
   - Configure options visually
   - Preview changes live
   - Export config JSON

5. DOCUMENT configuration options:
   File: src/components/ChatControl/README.md
   
   Explain:
   - Each configuration option
   - When to use each mode
   - How to customize
   - Example use cases

6. TEST all configurations:
   - Create test page with all three modes
   - Verify each config applies correctly
   - Test switching between modes
   - Check edge cases (missing options, invalid values)

OUTPUT:
- Flexible configuration system
- Three working modes
- Example configs
- Documentation
- (Optional) Config UI for admins
```

---

## Task 5: Payload Integration

**Project:** `C:\Dev\angels-os`

**Prerequisites:**
- Tasks 2, 3, 4 complete

**Prompt for Claude Code:**
```
Integrate ChatControl with Payload CMS:

1. CONNECT to Messages collection:
   File: src/collections/Messages.ts
   
   ChatControl should:
   - Fetch messages from Payload API
   - Send new messages to Payload
   - Subscribe to real-time updates (if available)
   - Handle pagination (load more)

2. CONNECT to Channels collection:
   File: src/collections/Channels.ts
   
   ChatControl should:
   - Fetch channel list
   - Subscribe to channel updates
   - Handle channel switching
   - Show channel metadata (name, description, members)

3. USE authentication context:
   Import auth from Payload context
   - Get current user
   - Show user avatar/name
   - Apply permissions (who can see what)
   - Handle unauthorized states

4. IMPLEMENT AI Bus integration:
   If AI Bus is implemented in Rev 3:
   - Send messages with visibility metadata
   - Filter messages by visibility level
   - Show Angel presence indicators
   - Handle network-wide messages

5. APPLY Constitutional prompts:
   File: constitutional-prompt.ts (if exists)
   
   When sending messages:
   - Include constitutional prompt as system context
   - Validate responses for anti-demonic content
   - Show warning if response violates constitution

6. HANDLE errors gracefully:
   - Network failures
   - Permission errors
   - Invalid data
   - Rate limiting
   
   Show user-friendly error messages.

7. TEST integration:
   - Send message → appears in Payload admin
   - Create channel → appears in ChatControl
   - Switch users → permissions apply
   - Test AI Bus visibility levels

OUTPUT:
- Full Payload CMS integration
- Real-time messaging working
- Permissions enforced
- AI Bus connected (if available)
- Constitutional alignment applied
- Error handling complete
```

---

## Task 6: Final Testing & Polish

**Project:** `C:\Dev\angels-os`

**Prerequisites:**
- All previous tasks complete

**Prompt for Claude Code:**
```
Final testing and polish:

1. VISUAL TESTING:
   Test on:
   - Chrome (latest)
   - Firefox (latest)
   - Safari (latest, if available)
   - Edge (latest)
   
   Verify:
   - No visual glitches
   - Animations smooth
   - Transparent backgrounds perfect
   - Responsive layout works

2. FUNCTIONAL TESTING:
   Test:
   - Send message → arrives immediately
   - Receive message → shows in real-time
   - Switch channels → loads correctly
   - Toggle modes → switches smoothly
   - Dark/light theme → applies correctly

3. ACCESSIBILITY TESTING:
   Check:
   - Keyboard navigation works
   - Screen reader compatible
   - Focus indicators visible
   - Color contrast meets WCAG AA
   - ARIA labels present

4. PERFORMANCE TESTING:
   Measure:
   - Initial load time
   - Message send latency
   - Channel switch speed
   - Memory usage
   - Network requests
   
   Target:
   - < 2s initial load
   - < 100ms interactions
   - < 50MB memory
   - Minimal network requests

5. EDGE CASES:
   Test:
   - No internet connection
   - Slow network
   - Very long messages
   - Many channels (100+)
   - Empty channels
   - No permissions

6. POLISH:
   - Fix any discovered bugs
   - Improve animations
   - Optimize bundle size
   - Add loading states
   - Improve error messages

7. DOCUMENT:
   Update:
   - README.md (usage guide)
   - DEVELOPMENT.md (dev guide)
   - CHANGELOG.md (what changed)
   - Migration notes (for future reference)

OUTPUT:
- Production-ready ChatControl
- All tests passing
- Documentation complete
- No known bugs
- Performance optimized
```

---

## Quick Reference

**Task Order:**
1. Survey (Rev 2) → Extract components
2. Port (Rev 3) → Copy and adapt
3. Style → Fix transparency issues
4. Configure → Build flexible system
5. Integrate → Connect Payload CMS
6. Test → Final polish

**Estimated Time:**
- Task 1: 30-60 min (survey + extract)
- Task 2: 60-90 min (port + adapt)
- Task 3: 30-45 min (styling)
- Task 4: 45-60 min (configuration)
- Task 5: 60-90 min (integration)
- Task 6: 45-60 min (testing)

**Total:** 4-6 hours (Claude Code does heavy lifting)

---

## Success Indicators

**Know it's working when:**
- ✅ Three modes all render correctly
- ✅ Transparent backgrounds look professional
- ✅ Messages send/receive in Payload
- ✅ No console errors
- ✅ Responsive on all devices
- ✅ Dark mode works perfectly
- ✅ Configuration system is intuitive

**Ready for production when:**
- ✅ All tests pass
- ✅ Documentation complete
- ✅ Performance acceptable
- ✅ Accessible (WCAG AA)
- ✅ No known bugs
- ✅ Code reviewed

---

## Stripe Integration (Later)

**When ready for Ultimate Fair splits:**

Claude Code already understands Stripe context, so integration will be straightforward:

```
Add Stripe to ChatControl:

1. Install @stripe/stripe-js
2. Add payment UI for paid features
3. Implement 60/20/15/5 splits
4. Track transactions in AI Bus
5. Show Justice Fund contributions
6. Enable tipping in chat

Claude Code will handle Stripe setup naturally.
```

**For now:** Focus on dashboard migration. Payments come later.

---

**Start with Task 1 in Claude Code GUI!** 🚀
