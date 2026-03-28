import type { Footer, Tenant } from '@/payload-types'

import { FooterMenu } from '@/components/Footer/menu'
import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { getTenantCachedDoc } from '@/utilities/getTenantCachedDoc'
import Link from 'next/link'
import React, { Suspense } from 'react'
import { LogoIcon } from '@/components/icons/logo'

const { COMPANY_NAME, SITE_NAME } = process.env

type Props = {
  tenant: Tenant | null
}

export async function Footer({ tenant }: Props) {
  const tenantId = tenant?.id ?? null
  let footer: Footer | null = null
  try {
    footer = tenantId
      ? await getTenantCachedDoc('footer', tenantId, 1)()
      : null
  } catch (err) {
    console.error('[Footer] Failed to fetch footer doc:', err)
  }
  const menu = footer?.navItems ?? []
  const currentYear = new Date().getFullYear()
  const copyrightDate = 2023 + (currentYear > 2023 ? `-${currentYear}` : '')
  const skeleton = 'w-full h-6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700'

  const copyrightName = COMPANY_NAME || SITE_NAME || ''

  return (
    <footer className="text-sm text-neutral-500 dark:text-neutral-400">
      <div className="container">
        <div className="flex w-full flex-col gap-6 border-t border-neutral-200 py-12 text-sm md:flex-row md:gap-12 dark:border-neutral-700">
          <div>
            <Link className="flex items-center gap-2 text-black md:pt-1 dark:text-white" href="/">
              {tenant?.branding?.logo && typeof tenant.branding.logo === 'object' && 'url' in tenant.branding.logo ? (
                <img src={tenant.branding.logo.url ?? ''} alt={`${tenant.branding?.siteName || 'Site'} logo`} className="h-6 w-auto object-contain" />
              ) : (
                <LogoIcon className="w-6" />
              )}
              <span className="sr-only">{tenant?.branding?.siteName ?? SITE_NAME}</span>
            </Link>
          </div>
          <Suspense
            fallback={
              <div className="flex h-[188px] w-[200px] flex-col gap-2">
                <div className={skeleton} />
                <div className={skeleton} />
                <div className={skeleton} />
                <div className={skeleton} />
                <div className={skeleton} />
                <div className={skeleton} />
              </div>
            }
          >
            <FooterMenu menu={menu} />
          </Suspense>
          <div className="md:ml-auto flex flex-col gap-4 items-end">
            <ThemeSelector />
          </div>
        </div>
      </div>
      {/* Angel OS community links — only shown for platform tenant or when no tenant */}
      {(!tenant || (tenant as any).type === 'platform') && (
        <div className="border-t border-neutral-200 py-6 dark:border-neutral-700">
          <div className="container mx-auto flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <a
                href="https://github.com/the-angel-os/angels-os"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                GitHub
              </a>
              <span className="hidden text-neutral-300 dark:text-neutral-600 md:inline">|</span>
              <a
                href="https://github.com/the-angel-os/angels-os/wiki"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors"
              >
                Wiki
              </a>
              <span className="hidden text-neutral-300 dark:text-neutral-600 md:inline">|</span>
              <a
                href="https://github.com/the-angel-os/angels-os/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors"
              >
                Report Issue
              </a>
              <span className="hidden text-neutral-300 dark:text-neutral-600 md:inline">|</span>
              <Link
                href="/dashboard/spaces"
                className="text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors"
              >
                Join a Space
              </Link>
            </div>
          </div>
        </div>
      )}
      <div className="border-t border-neutral-200 pt-6 pb-20 md:pb-6 text-sm dark:border-neutral-700">
        <div className="container mx-auto flex w-full flex-col items-center gap-1 md:flex-row md:gap-0">
          <p>
            &copy; {copyrightDate} {copyrightName}
            {copyrightName.length && !copyrightName.endsWith('.') ? '.' : ''} All rights reserved.
          </p>
          {(!tenant || (tenant as any).type === 'platform') && (
            <>
              <hr className="mx-4 hidden h-4 w-px border-l border-neutral-400 md:inline-block" />
              <p className="flex items-center gap-1">
                Designed in Clearwater, FL
                <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">&middot;</span>
                <a
                  href="https://github.com/the-angel-os/angels-os"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-black dark:text-white hover:underline"
                >
                  Open Source
                </a>
              </p>
            </>
          )}
          <p className="md:ml-auto flex items-center gap-2">
            <span>Powered by</span>
            <a className="text-black dark:text-white hover:underline" href="https://payloadcms.com" target="_blank" rel="noopener noreferrer">
              Payload
            </a>
            <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">&middot;</span>
            <a className="text-black dark:text-white hover:underline" href="https://nextjs.org" target="_blank" rel="noopener noreferrer">
              Next.js
            </a>
            <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">&middot;</span>
            <a className="text-black dark:text-white hover:underline" href="https://livekit.io" target="_blank" rel="noopener noreferrer">
              LiveKit
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
