'use client'

import React from 'react'
import Link from 'next/link'

/**
 * EmptyState — Anti-Daemon Protocol Empty State Component
 *
 * Replaces cold "No X yet" messages with warm, encouraging content.
 * Each empty state includes:
 * - A friendly icon
 * - An encouraging message
 * - A primary CTA button
 * - An optional LEO conversation starter
 */

interface EmptyStateProps {
  /** The icon to display (ReactNode) */
  icon?: React.ReactNode
  /** The heading text */
  title: string
  /** The description text */
  description: string
  /** Primary action button text */
  actionLabel?: string
  /** Primary action URL */
  actionHref?: string
  /** Primary action click handler (alternative to href) */
  onAction?: () => void
  /** Optional LEO prompt suggestion */
  leoPrompt?: string
  /** Optional LEO chat link */
  leoChatHref?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  leoPrompt,
  leoChatHref = '/dashboard/spaces',
}: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">{description}</p>

      <div className="flex flex-col items-center gap-3">
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {actionLabel}
          </Link>
        )}
        {actionLabel && onAction && !actionHref && (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {actionLabel}
          </button>
        )}
        {leoPrompt && (
          <Link
            href={leoChatHref}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            Ask LEO: &ldquo;{leoPrompt}&rdquo;
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Pre-configured Empty States ──────────────────────────────────

export function EmptyProducts() {
  return (
    <EmptyState
      icon={
        <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      }
      title="Your store is ready!"
      description="Add your first product to start selling. LEO can help you create products with descriptions, pricing, and even generate product images."
      actionLabel="Add Product"
      actionHref="/admin/collections/products/create"
      leoPrompt="Help me create my first product"
    />
  )
}

export function EmptyOrders() {
  return (
    <EmptyState
      icon={
        <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      }
      title="Orders will flow in soon"
      description="Once your store is live and customers start purchasing, their orders will appear here. Make sure your products are published and your payment processing is connected."
      actionLabel="Check Payment Settings"
      actionHref="/dashboard/admin/payments"
      leoPrompt="Help me get my store ready for orders"
    />
  )
}

export function EmptyEvents() {
  return (
    <EmptyState
      icon={
        <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      title="No events scheduled yet"
      description="Create events for workshops, meetups, classes, or any gathering. Customers can register and you can manage capacity and waitlists."
      actionLabel="Create Event"
      actionHref="/admin/collections/events/create"
      leoPrompt="Help me create an event"
    />
  )
}

export function EmptyBookings() {
  return (
    <EmptyState
      icon={
        <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      title="No appointments booked yet"
      description="When customers book with you, they'll appear here. Set up your availability first, then share your booking page."
      actionLabel="Set Up Availability"
      actionHref="/dashboard/availability"
      leoPrompt="Help me set up my availability schedule"
    />
  )
}

export function EmptyProjects() {
  return (
    <EmptyState
      icon={
        <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      }
      title="No projects yet"
      description="Organize your work into projects to track progress and collaborate with your team. Projects can include tasks, milestones, and notes."
      actionLabel="Create Project"
      actionHref="/admin/collections/projects/create"
      leoPrompt="Help me plan a new project"
    />
  )
}

export function EmptyPosts() {
  return (
    <EmptyState
      icon={
        <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
        </svg>
      }
      title="No posts published yet"
      description="Share updates, articles, or announcements with your audience. LEO can help you write and polish your content."
      actionLabel="Write a Post"
      actionHref="/admin/collections/posts/create"
      leoPrompt="Help me write a blog post"
    />
  )
}

export function EmptyMedia() {
  return (
    <EmptyState
      icon={
        <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      title="No media uploaded yet"
      description="Upload images, documents, and files to use across your site. LEO can also generate images for you using AI."
      actionLabel="Upload Media"
      actionHref="/admin/collections/media/create"
      leoPrompt="Generate an image for my business"
    />
  )
}

export function EmptyPages() {
  return (
    <EmptyState
      icon={
        <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      title="No pages created yet"
      description="Build your website with custom pages. Add landing pages, about pages, contact forms, and more."
      actionLabel="Create Page"
      actionHref="/admin/collections/pages/create"
      leoPrompt="Help me create a landing page"
    />
  )
}

export function EmptySpaces() {
  return (
    <EmptyState
      icon={
        <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      }
      title="Welcome to your spaces"
      description="Spaces are where conversations happen. Create channels for different topics, invite your team, and chat with LEO — your AI assistant."
      actionLabel="Create a Space"
      actionHref="/admin/collections/spaces/create"
      leoPrompt="Set up channels for my business"
    />
  )
}
