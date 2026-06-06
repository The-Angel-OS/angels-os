import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kiosk QR Code' }

/**
 * /kiosk/qr — printable QR code for the market stand.
 *
 *   /kiosk/qr               → QR links to /kiosk (the quick-shop)
 *   /kiosk/qr?event=<slug>  → QR links to /kiosk?event=<slug> and shows the
 *                             event name on the poster (for this stand/date)
 *   /kiosk/qr?product=<id>  → QR links directly to /products/<slug> (per-plant)
 *
 * Print this page from the browser (Ctrl+P / mobile Share → Print).
 * No QR library needed — uses qrserver.com (free, no API key).
 */
export default async function KioskQRPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; product?: string }>
}) {
  const { event: eventSlug, product: productId } = await searchParams
  const { tenant } = await resolveTenantFromHeaders()
  const siteName = (tenant as any)?.branding?.siteName || (tenant as any)?.name || 'Shop'

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()

  // Build the destination URL the QR will encode
  const host =
    (tenant as any)?.domain ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'https://spacesangels.com'
  const baseUrl = host.startsWith('http') ? host : `https://${host}`

  let qrUrl = `${baseUrl}/kiosk`
  let title = `${siteName}`
  let subtitle = 'Scan to browse & buy'
  let eventLabel = ''

  // Event context — label the poster with the market name + date
  if (eventSlug) {
    const events = await payload.find({
      collection: 'events',
      where: { and: [{ slug: { equals: eventSlug } }, tenantFilter] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: { title: true, startDateTime: true, location: true } as never,
    })
    const ev = events.docs?.[0] as any
    if (ev) {
      qrUrl = `${baseUrl}/kiosk?event=${eventSlug}`
      const d = new Date(ev.startDateTime)
      eventLabel = `${ev.title} · ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
      subtitle = ev.location?.address || ev.location?.venueName || 'Scan to browse & buy'
    }
  }

  // Product context — deep-link to a specific product page
  if (productId) {
    const prod = await payload.find({
      collection: 'products',
      where: { and: [{ id: { equals: productId } }, tenantFilter] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: { title: true, slug: true, priceInUSD: true } as never,
    })
    const p = prod.docs?.[0] as any
    if (p) {
      qrUrl = `${baseUrl}/products/${p.slug}`
      title = p.title || siteName
      subtitle = p.priceInUSD ? `$${p.priceInUSD.toFixed(2)}` : 'Scan to learn more'
    }
  }

  // QR image via qrserver.com (free, no API key, 300×300)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=2&data=${encodeURIComponent(qrUrl)}`

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-8 py-12 text-center print:bg-white">
      <div className="max-w-sm w-full">
        <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-gray-400">
          {eventLabel || siteName}
        </p>
        <h1 className="mb-2 text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mb-8 text-gray-500">{subtitle}</p>

        {/* QR code */}
        <div className="mx-auto mb-8 flex h-64 w-64 items-center justify-center rounded-2xl border-4 border-gray-900 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="Scan to shop"
            width={240}
            height={240}
            className="h-full w-full"
          />
        </div>

        <p className="text-sm text-gray-400 break-all">{qrUrl}</p>

        {/* Print button — hidden when printing */}
        <button
          onClick={() => window.print()}
          className="mt-8 rounded-full bg-gray-900 px-8 py-3 text-sm font-semibold text-white hover:bg-gray-700 print:hidden"
        >
          Print this QR
        </button>
      </div>

      <style>{`
        @media print {
          nav, header, footer, button { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}
