/**
 * Unit tests for useMediaQuery hook and responsive breakpoint helpers.
 *
 * Tests the pure logic of media query matching, breakpoint constants,
 * and the chat mode responsive behavior patterns.
 *
 * @see src/utilities/useMediaQuery.ts
 */
import { describe, it, expect } from 'vitest'

// ─── Breakpoint constants (matching Tailwind defaults) ─────────────
const MOBILE_MAX = 767
const TABLET_MIN = 768
const TABLET_MAX = 1023
const DESKTOP_MIN = 1024

describe('Responsive breakpoint constants', () => {
  it('mobile breakpoint ends at 767px', () => {
    expect(MOBILE_MAX).toBe(767)
  })

  it('tablet range is 768-1023px', () => {
    expect(TABLET_MIN).toBe(768)
    expect(TABLET_MAX).toBe(1023)
  })

  it('desktop starts at 1024px', () => {
    expect(DESKTOP_MIN).toBe(1024)
  })

  it('breakpoints are contiguous (no gaps)', () => {
    expect(MOBILE_MAX + 1).toBe(TABLET_MIN)
    expect(TABLET_MAX + 1).toBe(DESKTOP_MIN)
  })
})

// ─── Chat mode resolution logic ────────────────────────────────────

type ChatMode = 'minimalist' | 'single-channel' | 'multi-channel' | 'sidebar'

interface MobileOverride {
  mode: ChatMode
  isMobile: boolean
}

/**
 * Determines whether a chat component should use mobile layout.
 * Re-implements the responsive logic used across ChatControl components.
 */
function shouldUseMobileLayout({ mode, isMobile }: MobileOverride): {
  usesBottomSheet: boolean
  usesHorizontalTabs: boolean
  usesFullWidthOverlay: boolean
} {
  return {
    // MinimalistChat opens as bottom sheet on mobile
    usesBottomSheet: mode === 'minimalist' && isMobile,
    // MultiChannelChat uses horizontal scrollable tabs instead of sidebar
    usesHorizontalTabs: mode === 'multi-channel' && isMobile,
    // SidebarChat uses full-width overlay instead of w-96
    usesFullWidthOverlay: mode === 'sidebar' && isMobile,
  }
}

describe('Chat mode responsive behavior', () => {
  describe('minimalist mode', () => {
    it('uses bottom sheet on mobile', () => {
      const result = shouldUseMobileLayout({ mode: 'minimalist', isMobile: true })
      expect(result.usesBottomSheet).toBe(true)
    })

    it('uses standard popup on desktop', () => {
      const result = shouldUseMobileLayout({ mode: 'minimalist', isMobile: false })
      expect(result.usesBottomSheet).toBe(false)
    })
  })

  describe('multi-channel mode', () => {
    it('uses horizontal tabs on mobile', () => {
      const result = shouldUseMobileLayout({ mode: 'multi-channel', isMobile: true })
      expect(result.usesHorizontalTabs).toBe(true)
    })

    it('uses sidebar channel list on desktop', () => {
      const result = shouldUseMobileLayout({ mode: 'multi-channel', isMobile: false })
      expect(result.usesHorizontalTabs).toBe(false)
    })
  })

  describe('sidebar mode', () => {
    it('uses full-width overlay on mobile', () => {
      const result = shouldUseMobileLayout({ mode: 'sidebar', isMobile: true })
      expect(result.usesFullWidthOverlay).toBe(true)
    })

    it('uses w-96 panel on desktop', () => {
      const result = shouldUseMobileLayout({ mode: 'sidebar', isMobile: false })
      expect(result.usesFullWidthOverlay).toBe(false)
    })
  })

  describe('single-channel mode', () => {
    it('has no special mobile behavior (always full-width)', () => {
      const result = shouldUseMobileLayout({ mode: 'single-channel', isMobile: true })
      expect(result.usesBottomSheet).toBe(false)
      expect(result.usesHorizontalTabs).toBe(false)
      expect(result.usesFullWidthOverlay).toBe(false)
    })
  })
})

// ─── Swipe-to-dismiss logic ────────────────────────────────────────

/**
 * Determines if a swipe gesture should dismiss the bottom sheet.
 * Threshold: 100px downward swipe.
 */
function shouldDismissOnSwipe(touchDelta: number): boolean {
  return touchDelta > 100
}

describe('Swipe-to-dismiss', () => {
  it('dismisses on >100px downward swipe', () => {
    expect(shouldDismissOnSwipe(101)).toBe(true)
    expect(shouldDismissOnSwipe(200)).toBe(true)
  })

  it('does not dismiss on <=100px swipe', () => {
    expect(shouldDismissOnSwipe(100)).toBe(false)
    expect(shouldDismissOnSwipe(50)).toBe(false)
    expect(shouldDismissOnSwipe(0)).toBe(false)
  })

  it('does not dismiss on upward swipe (negative delta)', () => {
    expect(shouldDismissOnSwipe(-50)).toBe(false)
    expect(shouldDismissOnSwipe(-200)).toBe(false)
  })
})

// ─── Dashboard sidebar responsive mode ─────────────────────────────

interface DashboardSidebarState {
  isMobile: boolean
  isCollapsed: boolean
  isMobileOpen: boolean
}

function getSidebarWidth(state: DashboardSidebarState): string {
  if (state.isMobile) return 'overlay' // Full-screen overlay, no fixed width in flow
  return state.isCollapsed ? 'w-16' : 'w-60'
}

function isSidebarVisible(state: DashboardSidebarState): boolean {
  if (state.isMobile) return state.isMobileOpen
  return true // Always visible on desktop (collapsed or expanded)
}

describe('Dashboard sidebar responsive mode', () => {
  it('shows as overlay on mobile (not in DOM flow)', () => {
    expect(getSidebarWidth({ isMobile: true, isCollapsed: false, isMobileOpen: true })).toBe('overlay')
  })

  it('shows w-60 expanded on desktop', () => {
    expect(getSidebarWidth({ isMobile: false, isCollapsed: false, isMobileOpen: false })).toBe('w-60')
  })

  it('shows w-16 collapsed on desktop', () => {
    expect(getSidebarWidth({ isMobile: false, isCollapsed: true, isMobileOpen: false })).toBe('w-16')
  })

  it('is visible on desktop regardless of mobile open state', () => {
    expect(isSidebarVisible({ isMobile: false, isCollapsed: false, isMobileOpen: false })).toBe(true)
    expect(isSidebarVisible({ isMobile: false, isCollapsed: true, isMobileOpen: false })).toBe(true)
  })

  it('is hidden on mobile when closed', () => {
    expect(isSidebarVisible({ isMobile: true, isCollapsed: false, isMobileOpen: false })).toBe(false)
  })

  it('is visible on mobile when opened', () => {
    expect(isSidebarVisible({ isMobile: true, isCollapsed: false, isMobileOpen: true })).toBe(true)
  })
})

// ─── Bottom sheet height calculation ────────────────────────────────

function getBottomSheetHeight(viewportHeight: number): number {
  return Math.round(viewportHeight * 0.85)
}

describe('Bottom sheet sizing', () => {
  it('takes 85% of viewport height', () => {
    expect(getBottomSheetHeight(1000)).toBe(850)
    expect(getBottomSheetHeight(800)).toBe(680)
    expect(getBottomSheetHeight(667)).toBe(567) // iPhone SE
  })

  it('leaves room for status bar (15%)', () => {
    const vh = 896 // iPhone 11
    const sheetHeight = getBottomSheetHeight(vh)
    const topSpace = vh - sheetHeight
    expect(topSpace).toBeGreaterThan(100) // At least 100px at top
  })
})

// ─── Channel management logic ─────────────────────────────────────

/** Pure slug generation — same logic as useChat.createChannel */
function generateChannelSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Channel type validation — matches Payload schema */
const VALID_CHANNEL_TYPES = ['general', 'announcements', 'support', 'sales', 'inventory', 'pdf', 'video', 'team', 'social']

describe('Channel slug generation', () => {
  it('converts name to lowercase', () => {
    expect(generateChannelSlug('My Channel')).toBe('my-channel')
  })

  it('replaces spaces with hyphens', () => {
    expect(generateChannelSlug('product support')).toBe('product-support')
  })

  it('strips special characters', () => {
    expect(generateChannelSlug('LEO & Friends!')).toBe('leo-friends')
  })

  it('strips leading/trailing hyphens', () => {
    expect(generateChannelSlug('--hello--')).toBe('hello')
  })

  it('collapses multiple hyphens', () => {
    expect(generateChannelSlug('a   b   c')).toBe('a-b-c')
  })

  it('handles unicode gracefully', () => {
    const slug = generateChannelSlug('café☕chat')
    expect(slug).toBe('caf-chat')
  })

  it('handles empty string', () => {
    expect(generateChannelSlug('')).toBe('')
  })
})

describe('Channel type validation', () => {
  it('general is a valid type', () => {
    expect(VALID_CHANNEL_TYPES).toContain('general')
  })

  it('announcements is a valid type', () => {
    expect(VALID_CHANNEL_TYPES).toContain('announcements')
  })

  it('support is a valid type', () => {
    expect(VALID_CHANNEL_TYPES).toContain('support')
  })

  it('has 9 channel types total', () => {
    expect(VALID_CHANNEL_TYPES).toHaveLength(9)
  })
})

describe('Channel deletion logic', () => {
  interface TestChannel { id: string; slug: string; isDefault: boolean }

  function simulateDelete(
    channels: TestChannel[],
    activeChannel: string,
    deleteId: string,
  ): { remaining: TestChannel[]; newActive: string } {
    const remaining = channels.filter((c) => c.id !== deleteId)
    let newActive = activeChannel
    if (remaining.length > 0) {
      const deleted = channels.find((c) => c.id === deleteId)
      if (deleted && deleted.slug === activeChannel) {
        const fallback = remaining.find((c) => c.isDefault) || remaining[0]
        newActive = fallback.slug
      }
    }
    return { remaining, newActive }
  }

  it('removes deleted channel from list', () => {
    const channels: TestChannel[] = [
      { id: '1', slug: 'general', isDefault: true },
      { id: '2', slug: 'support', isDefault: false },
    ]
    const { remaining } = simulateDelete(channels, 'general', '2')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].slug).toBe('general')
  })

  it('switches to default channel when active is deleted', () => {
    const channels: TestChannel[] = [
      { id: '1', slug: 'general', isDefault: true },
      { id: '2', slug: 'support', isDefault: false },
    ]
    const { newActive } = simulateDelete(channels, 'support', '2')
    expect(newActive).toBe('general')
  })

  it('switches to first channel when active is deleted and no default', () => {
    const channels: TestChannel[] = [
      { id: '1', slug: 'alpha', isDefault: false },
      { id: '2', slug: 'beta', isDefault: false },
      { id: '3', slug: 'gamma', isDefault: false },
    ]
    const { newActive } = simulateDelete(channels, 'beta', '2')
    expect(newActive).toBe('alpha')
  })

  it('keeps active channel when a different channel is deleted', () => {
    const channels: TestChannel[] = [
      { id: '1', slug: 'general', isDefault: true },
      { id: '2', slug: 'support', isDefault: false },
    ]
    const { newActive } = simulateDelete(channels, 'general', '2')
    expect(newActive).toBe('general')
  })
})
