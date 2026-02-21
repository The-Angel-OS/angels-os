'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * AngelErrorBoundary — Anti-Daemon Protocol Error Boundary
 *
 * Wraps dashboard sections to catch runtime errors gracefully.
 * Follows the Anti-Daemon Protocol: no stack traces, no jargon,
 * always a warm message and a clear next step.
 *
 * Template: "Hmm, [thing] didn't work as expected.
 *            [What happened in plain English].
 *            [What you can do next]."
 */

interface Props {
  children: ReactNode
  /** What section this boundary wraps (e.g. "Products", "Orders") */
  section?: string
  /** Optional fallback UI to render instead of default */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string | null
}

export class AngelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console for debugging (not shown to user)
    console.error(`[AngelErrorBoundary] Error in ${this.props.section || 'component'}:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const section = this.props.section || 'this section'

      return (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
            <svg
              className="h-7 w-7 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">
            Hmm, {section} didn&apos;t load as expected
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Something unexpected happened while loading this content. Don&apos;t worry — your data is safe.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, errorMessage: null })
              window.location.reload()
            }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
