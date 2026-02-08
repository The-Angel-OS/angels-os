/**
 * Theme-aware color utilities for Angel OS
 * Provides consistent color mappings that work with light/dark themes
 */

export const themeColors = {
  // Primary brand colors (theme-aware)
  primary: {
    bg: 'bg-primary',
    text: 'text-primary',
    foreground: 'text-primary-foreground',
    hover: 'hover:bg-primary/90',
    light: 'bg-primary/10',
    border: 'border-primary'
  },

  // Status colors (semantic)
  success: {
    bg: 'bg-green-500 dark:bg-green-600',
    text: 'text-green-600 dark:text-green-400',
    light: 'bg-green-100 dark:bg-green-900/20',
    border: 'border-green-500 dark:border-green-600'
  },

  warning: {
    bg: 'bg-yellow-500 dark:bg-yellow-600',
    text: 'text-yellow-600 dark:text-yellow-400',
    light: 'bg-yellow-100 dark:bg-yellow-900/20',
    border: 'border-yellow-500 dark:border-yellow-600'
  },

  error: {
    bg: 'bg-red-500 dark:bg-red-600',
    text: 'text-red-600 dark:text-red-400',
    light: 'bg-red-100 dark:bg-red-900/20',
    border: 'border-red-500 dark:border-red-600'
  },

  info: {
    bg: 'bg-blue-500 dark:bg-blue-600',
    text: 'text-blue-600 dark:text-blue-400',
    light: 'bg-blue-100 dark:bg-blue-900/20',
    border: 'border-blue-500 dark:border-blue-600'
  },

  // Accent colors for variety (theme-aware)
  accent: {
    purple: {
      bg: 'bg-purple-500 dark:bg-purple-600',
      text: 'text-purple-600 dark:text-purple-400',
      light: 'bg-purple-100 dark:bg-purple-900/20',
      gradient: 'from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500'
    },
    indigo: {
      bg: 'bg-indigo-500 dark:bg-indigo-600',
      text: 'text-indigo-600 dark:text-indigo-400',
      light: 'bg-indigo-100 dark:bg-indigo-900/20',
      gradient: 'from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500'
    },
    cyan: {
      bg: 'bg-cyan-500 dark:bg-cyan-600',
      text: 'text-cyan-600 dark:text-cyan-400',
      light: 'bg-cyan-100 dark:bg-cyan-900/20',
      gradient: 'from-cyan-500 to-cyan-600 dark:from-cyan-400 dark:to-cyan-500'
    }
  },

  // Gradients (theme-aware)
  gradients: {
    primary: 'bg-gradient-to-r from-primary/80 to-primary',
    blue: 'bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500',
    purple: 'bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500',
    indigo: 'bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500',
    success: 'bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-400 dark:to-emerald-500'
  }
}

// Status badge colors
export const statusColors = {
  active: themeColors.success,
  inactive: 'bg-gray-500 dark:bg-gray-600 text-white',
  pending: themeColors.warning,
  error: themeColors.error,
  setup: themeColors.info,
  trial: themeColors.info,
  suspended: themeColors.error,
  archived: 'bg-gray-500 dark:bg-gray-600 text-white'
}

// Progress bar colors
export const progressColors = {
  low: themeColors.error.bg,      // 0-25%
  medium: themeColors.warning.bg, // 26-50%
  good: themeColors.info.bg,      // 51-75%
  excellent: themeColors.success.bg // 76-100%
}

// Helper function to get progress color
export const getProgressColor = (percentage: number): string => {
  if (percentage >= 75) return progressColors.excellent
  if (percentage >= 50) return progressColors.good
  if (percentage >= 25) return progressColors.medium
  return progressColors.low
}

// Helper function to get status color
export const getStatusColor = (status: string): string => {
  const color = statusColors[status as keyof typeof statusColors] || statusColors.inactive
  return typeof color === 'string' ? color : color.bg
}
