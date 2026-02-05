# Angel OS Theme Implementation Flow

## Overview
The Angel OS theme system integrates Payload CMS's theme provider with ShadCN UI components. This document details the complete flow of how themes are applied and where potential issues may occur.

## Theme Flow Path

### 1. Initial HTML Load
- **File**: `src/providers/Theme/InitTheme/index.tsx`
- **Purpose**: Injects a script that runs before React hydration
- **Process**:
  1. Reads theme preference from localStorage (`payload-theme`)
  2. Falls back to system preference via `prefers-color-scheme`
  3. Sets `data-theme` attribute on `<html>`
  4. Adds class (`light` or `dark`) to `<html>`
  
### 2. Theme Provider Initialization
- **File**: `src/providers/Theme/index.tsx`
- **Component**: `ThemeProvider`
- **Process**:
  1. Reads initial theme state from DOM
  2. Initializes theme preset (default: 'default')
  3. Applies CSS variables for the selected preset
  4. Manages state for theme and theme preset

### 3. CSS Variable Application
- **Files**:
  - `src/app/(frontend)/globals.css` - Base styles
  - `src/app/dashboard/theme-base.css` - Dashboard-specific base
  - Theme presets in `src/providers/Theme/shared.ts`
- **Process**:
  1. Base CSS variables defined in CSS files
  2. Theme provider overrides with preset-specific values
  3. Applied via `document.documentElement.style.setProperty()`

### 4. Component Theme Usage
- **ShadCN Components**: Use CSS variables like `--background`, `--foreground`
- **Tailwind Classes**: `bg-background`, `text-foreground`
- **Dark Mode**: Classes prefixed with `dark:`

## Critical Files and Their Roles

### Theme Provider Files
1. **`src/providers/Theme/index.tsx`**
   - Main theme provider component
   - Manages theme state and preset state
   - Applies CSS variables dynamically

2. **`src/providers/Theme/InitTheme/index.tsx`**
   - Pre-hydration script
   - Prevents flash of wrong theme

3. **`src/providers/Theme/shared.ts`**
   - Theme preset definitions
   - Color values for each preset/theme combination

4. **`src/providers/Theme/types.ts`**
   - TypeScript types for theme system

### CSS Files
1. **`src/app/(frontend)/globals.css`**
   - Base Tailwind imports
   - Fallback CSS variables
   - Global styles

2. **`src/app/dashboard/theme-base.css`**
   - Dashboard-specific base variables
   - Ensures ShadCN components have required variables

### Layout Files
1. **`src/app/dashboard/layout.tsx`**
   - Dashboard layout wrapper
   - Imports theme CSS files
   - Wraps with Providers component

2. **`src/app/(frontend)/layout.tsx`**
   - Frontend layout wrapper
   - Similar theme setup

## Known Issues and Solutions

### 1. White Flash in Dark Mode (FIXED)
**Issue**: Background flashes white ~300ms after load
**Cause**: CSS variables were applied after initial render
**Solution**:
- Added immediate inline styles in InitTheme script
- Added fallback classes to body element
- Critical dark mode styles applied before CSS loads

### 2. Transparent Modal (FIXED)
**Issue**: Calendar add event modal has transparent background
**Cause**: Dialog portals render outside theme context
**Solution**:
- Added explicit background styles for `[role="dialog"]`
- Ensured portal elements inherit CSS variables
- Added dark mode specific overrides

### 3. Theme Application Order
1. InitTheme script runs (immediate)
2. CSS files load
3. React hydrates
4. ThemeProvider useEffect runs
5. Theme preset applied

## CSS Variable Hierarchy

```css
/* Base layer - from CSS files */
:root {
  --background: 0 0% 100%;  /* Default light */
}

/* Theme provider override */
/* Applied via JavaScript to documentElement.style */
--background: hsl(222.2 84% 4.9%);  /* Dark mode */

/* Component usage */
.modal {
  background-color: hsl(var(--background));
}
```

## Fixes Applied

### 1. Dialog Background Fix
- **File**: `src/app/dashboard/theme-base.css`
- Added explicit styles for `[role="dialog"]` elements
- Ensured portals inherit theme variables
- Added dark mode specific overrides with `!important`

### 2. White Flash Prevention
- **File**: `src/providers/Theme/InitTheme/index.tsx`
- Added immediate inline style application
- Set backgroundColor and color before theme classes
- **File**: `src/app/(frontend)/globals.css`
- Changed from opacity to visibility for smoother transition
- Added explicit background colors for html[data-theme]
- **File**: `src/app/dashboard/layout.tsx`
- Added fallback Tailwind classes to body element

### 3. CSS Variable Inheritance
- **File**: `src/app/dashboard/theme-base.css`
- Ensured Radix UI portals inherit variables
- Added specific selectors for portal wrappers

## Debugging Tips

1. Check `document.documentElement` attributes:
   - `data-theme` should be 'light' or 'dark'
   - `class` should include the theme
   - `data-theme-preset` shows current preset

2. Inspect CSS variables:
   - Use DevTools to check computed styles on `:root`
   - Verify variables are in HSL format

3. Theme timing:
   - Add console logs in InitTheme script
   - Log in ThemeProvider useEffect
   - Check order of execution

4. Portal-rendered components:
   - Check if component renders in a portal
   - Verify CSS variables are available in portal context
   - Use browser DevTools to inspect computed styles
