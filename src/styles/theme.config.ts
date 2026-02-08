/**
 * Star Trek Federation Theme Configuration
 * Natural tones + pastels, dark mode preferred
 * Elegant but not overwhelming
 */

export const federationTheme = {
  colors: {
    // Base colors (dark mode optimized)
    background: {
      primary: 'hsl(222, 47%, 11%)',      // Deep space blue-black
      secondary: 'hsl(222, 47%, 15%)',    // Slightly lighter panels
      tertiary: 'hsl(222, 47%, 18%)',     // Elevated surfaces
    },
    
    // Natural tones
    natural: {
      slate: 'hsl(215, 16%, 47%)',        // Cool gray
      stone: 'hsl(24, 6%, 50%)',          // Warm gray
      moss: 'hsl(120, 15%, 45%)',         // Soft green
      sky: 'hsl(199, 89%, 48%)',          // Federation blue
    },
    
    // Pastels (Federation accents)
    pastel: {
      lavender: 'hsl(270, 30%, 75%)',     // Soft purple
      peach: 'hsl(25, 70%, 78%)',         // Warm accent
      mint: 'hsl(150, 40%, 75%)',         // Soft green
      rose: 'hsl(350, 50%, 80%)',         // Gentle pink
      azure: 'hsl(195, 60%, 75%)',        // Light blue
    },
    
    // Federation primary (command gold)
    primary: {
      DEFAULT: 'hsl(43, 96%, 56%)',       // Federation gold
      hover: 'hsl(43, 96%, 50%)',
      active: 'hsl(43, 96%, 45%)',
    },
    
    // Status colors
    status: {
      online: 'hsl(142, 71%, 45%)',       // Green
      away: 'hsl(38, 92%, 50%)',          // Amber
      busy: 'hsl(0, 84%, 60%)',           // Red
      offline: 'hsl(215, 16%, 47%)',      // Gray
    },
    
    // Text
    text: {
      primary: 'hsl(210, 40%, 98%)',      // Almost white
      secondary: 'hsl(215, 20%, 65%)',    // Muted
      tertiary: 'hsl(215, 16%, 47%)',     // Subtle
      muted: 'hsl(215, 20%, 35%)',        // Very subtle
    },
    
    // Borders
    border: {
      DEFAULT: 'hsl(217, 33%, 17%)',      // Subtle borders
      hover: 'hsl(217, 33%, 25%)',        // Hover state
      focus: 'hsl(43, 96%, 56%)',         // Focus (gold)
    },
  },
  
  // Typography
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
  },
  
  // Spacing (based on 4px grid)
  spacing: {
    unit: 4,
    scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96],
  },
  
  // Border radius
  radius: {
    sm: '0.25rem',
    DEFAULT: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },
  
  // Shadows (subtle, Federation-style)
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    DEFAULT: '0 2px 8px 0 rgba(0, 0, 0, 0.4)',
    md: '0 4px 16px 0 rgba(0, 0, 0, 0.5)',
    lg: '0 8px 24px 0 rgba(0, 0, 0, 0.6)',
    xl: '0 12px 32px 0 rgba(0, 0, 0, 0.7)',
  },
  
  // Animations
  animations: {
    duration: {
      fast: '150ms',
      normal: '250ms',
      slow: '350ms',
    },
    easing: {
      DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
}

export type FederationTheme = typeof federationTheme
