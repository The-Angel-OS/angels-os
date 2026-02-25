/**
 * Google Analytics 4 Script Component
 *
 * Injects the GA4 gtag.js script when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * Renders nothing when the env var is absent (graceful no-op).
 *
 * Usage: Add <GoogleAnalytics /> in the <head> section of the root layout.
 *
 * Sprint 19 — GA4 Event Wiring
 */
import Script from 'next/script'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            send_page_view: true,
          });
        `}
      </Script>
    </>
  )
}
