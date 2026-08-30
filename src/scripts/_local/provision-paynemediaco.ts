/**
 * One-off: stand up the PayneMediaCo (Chris Payne, wedding photo/video) demo
 * portal — real content pulled from paynemediaco.com, not trade-pack filler.
 * Reachable at paynemediaco.spacesangels.com. Idempotent (prospectIntake +
 * provisionPagesFromSpec are both find-or-update by slug).
 * Run: node_modules/.bin/payload run src/scripts/_local/provision-paynemediaco.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { prospectIntake } from '@/utilities/prospectIntake'
import { provisionPagesFromSpec, type PageFromSpec } from '@/utilities/provisionPagesFromSpec'
import { applyBrochureNav } from '@/utilities/applyBrochureNav'
import { resolveMediaSource } from '@/utilities/setMediaField'
import { updatePageLayout } from './_updatePageLayout'
import { h, p as para, rich, column } from './_lexical'

const payload = await getPayload({ config })

// 1. Provision the portal (tenant + endeavor + pages + nav + CRM prospect record)
const intake = await prospectIntake(payload, {
  businessName: 'PayneMediaCo',
  trade: 'photography',
  slug: 'paynemediaco',
  city: 'Southwest Florida',
  phone: '502-442-1142',
  email: 'ChrizPayne@icloud.com',
  contactName: 'Chris Payne',
  adUrl: 'https://www.paynemediaco.com/',
  generateHero: false,
})
if (!intake.ok) {
  console.log('INTAKE_FAILED', intake.error, intake.log)
  process.exit(1)
}
const tenantId = intake.tenant.id
console.log('PROSPECT', JSON.stringify({ url: intake.url, contactId: intake.contactId, place: intake.place?.name }))
console.log(intake.log.join('\n'))

// 2. Pull real photos from the live Squarespace CDN into this tenant's Media —
// hotlinking isn't an option (the Gallery block's `image` field is a real
// upload relationship), so each curated URL is fetched once and re-hosted.
// Curated, not "all 200+": a cold-outreach demo doesn't need Chris's whole
// catalogue, and re-hosting hundreds of files on a maybe-customer is waste.
const HERO_URL =
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/12300a6b-d9c7-40d4-a79f-2f0ca6288e89/5A3A6027.JPG'

const GALLERY_URLS = [
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/fc1b7729-cfff-49a4-9abd-8497ceb820b8/PayneMediaCo-83196.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/d55832c3-97c2-4f38-a84d-cf583fdf0309/_MG_2220.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/530d5090-aa1c-41ae-a8a6-0dd77942919b/_MG_4749.JPG',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/a3753d2d-3217-40cb-9e58-f848dbfa8222/PayneMediaCo-51593.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/b61d69de-4016-459f-8e86-b92727f6a76d/PayneMediaCo-27769+copy2.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/20b9977a-9e72-4ba4-8d19-354a4a118914/PayneMediaCo-51706.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/7833d68f-5949-4035-96d3-2e86b7ee5f32/PayneMediaCo-51524.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/23e30911-7e18-4227-ab44-f890fd5a1c47/PayneMediaCo-52037.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/2128d978-ea01-470f-ac76-5eb6fe4ef300/PayneMediaCo-47725.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/c4a1c05b-430d-4610-b6c9-55a022278354/PayneMediaCo-46489.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/0c5c6316-47e2-4926-8a2f-1910508daa04/PayneMediaCo-46147.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/82850e44-2144-4af3-ad2b-9e90e203b92b/IMG_0736.JPG',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/b95c997f-cc04-4571-ab1a-c6427d9fe770/IMG_9849.JPG',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/860d91ae-7ab4-41da-9749-9c1406bc5858/IMG_9289.JPG',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/988e0ba6-e9c5-481c-a404-adaeb80d29d8/PayneMediaCo-79816+copy.JPG',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/7913b43b-c8e2-4f14-9246-88f98dabe2c6/PayneMediaCo-74175.JPG',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/d4d9586f-5e33-4e65-bb5c-6d5d38233b8d/PayneMediaCo-82058.JPG',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/ce6023c1-36d1-4834-88d6-c812fc802320/PayneMediaCo-87758.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/a150fefb-6d5f-422f-b881-59c4358b307a/PayneMediaCo-85313.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/4a32eb46-8da2-4754-a78e-f7e4ad767cad/PayneMediaCo-85388.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/a1aac485-27be-457e-8617-aa13a7640619/PayneMediaCo-96414.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/3e24d765-0278-43b2-9829-0d2d348cf0ce/PayneMediaCo-95099.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/548fbaf2-2c8c-4adc-93f7-83957278137a/PayneMediaCo-97347.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/6fa7a4b2-4e0e-4636-8a0a-a7141f2949ec/IMG_5303.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/f7fcd5cb-7f50-4332-8ea2-4249a548ab26/PayneMediaCo-38223.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/f76df5b6-8485-4480-a30a-2172e2e6d1c7/PayneMediaCo-183+-+2.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/02fba303-3268-436d-9d79-aec3412d52f3/52897933750_b226e9fbdc_o.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/c65e29e0-1ec5-4651-828c-cbcb27871b35/52896967132_bd374b56e8_o.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/da0e3a5c-1d76-4be4-949c-caf230186b5c/52897670424_e92f7a4512_o.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/453769c6-9114-4d2a-a850-1dc809d8fbe1/PayneMediaCo-35252.jpg',
]

// A real wedding, whole. Chris's site has exactly ONE published gallery —
// Mercyanna & Jacob — and 285 photos in it. Taken in DOCUMENT order, not sorted:
// a wedding gallery is a narrative (prep, ceremony, portraits, reception) and
// sorting by filename shuffles the day. 48 of 285 is the demo's share; the point
// is to show Chris the shape, not to re-host his catalogue onto a maybe-customer.
const MERCYANNA_URLS = [
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/bc31e139-5b4f-4dd6-8e2a-33dc8f0d12d5/IMG_0232.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/44bf7d82-aac8-4eb5-babf-ea528d74c38c/DJI_0941.jpg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/2f7020b6-39f6-4fd5-81c9-3ea6c231e7f2/A94A4408.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/9c57255e-54ac-46a1-b763-5f9d70987109/A94A4420.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/2b995c8b-a644-4947-97d2-bd8638887183/A94A4447.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/11dd7ad3-510f-4c20-82f3-c068a2cad855/A94A4462.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/55f00adb-c799-4833-bf6b-e72e24699941/A94A4497.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/994c65ad-bfdd-458c-9243-d75a5449d84e/A94A4490.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/ed9b2566-6b48-4f93-953f-dbeb623f1da9/A94A4503.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/a319b01f-9ec3-4f84-8897-ac7465f7b0a9/A94A4515.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/8db1788c-c134-4ea7-a480-19503e7adb58/A94A4524.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/00426dde-e8af-462c-a2f8-d00b20a889bd/A94A4557.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/486cd2a1-78c8-48eb-8cae-b7be2d908343/A94A4537.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/c2fb4ad9-8055-44a5-8f6e-139ee2ab6aa6/A94A4549.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/08de2350-a16d-4499-af6d-5a47f63b2339/A94A4650.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/f67f77d0-fd98-4d35-9a2a-100b18e56858/A94A4612.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/0b6baef0-e359-47d7-8aa3-c2bb9650e0c4/A94A4625.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/967ed849-9105-4961-8565-6d47d345027f/A94A4638.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/3aea4523-280b-4df8-914a-52db25776ca8/A94A4654.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/b8be5924-7336-4d33-95e5-7c59113717eb/A94A4660.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/2c362f3a-84d4-48f5-b7eb-94546162f9f6/A94A4671.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/bf58c07c-918d-4218-8929-a69c36de7806/A94A4676.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/26bfd8ba-f946-4776-931b-4b23d3233912/A94A4679.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/f6311b48-543c-4446-8de4-15a6be06ffaf/A94A4688.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/5256d22d-3b13-4174-82f2-18c1995ca460/A94A4692.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/14bb6415-fa57-43c7-a378-4b5fb9b7eb41/A94A4713.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/80c73438-0a90-439a-95f3-92d0a1e88a38/A94A4717.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/fdff2495-5989-4112-ba56-adb0c643b6be/A94A4734.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/4cf85663-7622-4324-9005-8bf9ca86aca6/A94A4740.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/0a831828-db49-466f-89fe-acdcfe9f30d8/A94A4758.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/751ed628-4d45-477b-8739-afd688a12f9d/A94A4768.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/a1992e36-71ae-473a-8340-adc2f2ed03e9/A94A4772.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/8b7c4c49-5874-4498-bcaf-833f36ab451a/A94A4789.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/fa763c47-6b28-4666-81bb-388a485065a9/A94A4808.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/d805620b-9190-4583-8941-c3903f42786b/A94A4835.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/dcf79fc4-0aba-49ab-be43-6f8e1c402230/A94A4845.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/88de5689-93e4-4b64-b22e-73d85280d5ce/A94A4869.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/fbfa6cd5-14d6-4c02-a766-189c3697c13b/A94A4884-2.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/c85c36aa-d786-4f3b-b60a-81b8e69f2f5f/A94A4880.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/5c3401b0-129e-4542-a797-b32f01637273/A94A4904.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/7502b6e3-6022-432e-b781-3a190f71f1c9/A94A4904-3.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/3166b022-dfb0-41a6-a550-b8922dd310aa/A94A4918.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/57a889f4-a83b-4824-93bb-edd2af9bbd6c/A94A4933.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/d15947cf-a2fd-4c70-86b3-8b9e8a033b21/A94A4943-2.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/a9f5b8ec-6a1f-45f4-a7a3-f12c0e068eab/A94A4967.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/6f7a9f5c-70b4-4ef5-a6a3-81d6722bd06a/A94A4975.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/0881e972-a815-4e91-9838-a42151a8906d/A94A4944.jpeg',
  'https://images.squarespace-cdn.com/content/v1/61d753d26b945d29404d3a71/99459a8f-354e-4f2b-b978-ec87e43dc0cc/A94A4968.jpeg',
]

/**
 * Fetch-and-rehost, but reuse what is already here.
 *
 * resolveMediaSource has no dedupe — it uploads on every call. This script is
 * meant to be re-runnable, and without this check a second run silently doubles
 * the tenant's Media library (it did: 79 images became 158).
 *
 * Keyed on ALT, not filename. The uploader does not keep the source filename —
 * every fetched image lands as `leo-generated-<timestamp>.webp`, so a filename
 * comparison matches nothing and dedupes nothing. Alt is the only field this
 * script controls that stays stable across runs, so alt is the identity.
 */
async function upload(url: string, alt: string): Promise<number | null> {
  const hit = await payload.find({
    collection: 'media',
    where: { and: [{ alt: { equals: alt } }, { tenant: { equals: tenantId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const existing = hit.docs[0] as { id: number } | undefined
  if (existing) return existing.id

  const res = await resolveMediaSource(payload, { imageUrl: url }, { tenantId: Number(tenantId), alt })
  if ('error' in res) {
    console.log('UPLOAD_FAILED', url, res.error)
    return null
  }
  return res.mediaId
}

const heroId = await upload(HERO_URL, 'PayneMediaCo wedding photography')
const galleryIds: number[] = []
for (const [i, url] of GALLERY_URLS.entries()) {
  const id = await upload(url, `PayneMediaCo wedding photo ${i + 1}`)
  if (id != null) galleryIds.push(id)
}
console.log(`MEDIA uploaded: hero=${heroId ?? 'FAILED'}, gallery=${galleryIds.length}/${GALLERY_URLS.length}`)

const mercyannaIds: number[] = []
for (const [i, url] of MERCYANNA_URLS.entries()) {
  const id = await upload(url, `Mercyanna & Jacob wedding photo ${i + 1}`)
  if (id != null) mercyannaIds.push(id)
}
console.log(`MEDIA mercyanna: ${mercyannaIds.length}/${MERCYANNA_URLS.length}`)

// 3. Real wedding films — the Video block takes a Vimeo URL directly, no
// re-hosting needed (Vimeo already serves the player).
const FILMS = [
  { id: '1039559272', caption: 'Char & Joseph — 9.7.24' },
  { id: '1032353807', caption: 'Stephanie & Danny — 8.3.24' },
  { id: '1028499664', caption: 'Jessica & Hussein — 7.20.24' },
  { id: '1025303620', caption: 'Hailey & Joseph — 3.24.22' },
]

// 4. Overwrite the generic trade-pack pages with Chris's real words, and add
// the two pages his real site actually has that the 5-page template doesn't:
// a full gallery and a films page. 'services'/'faq' are dropped — his real
// site has neither, and inventing FAQ copy for him is worse than no FAQ page.
const heroImage = heroId != null ? { heroImage: heroId } : {}
const CONTACT_LINE = '502-442-1142 · ChrizPayne@icloud.com'

const pages: PageFromSpec[] = [
  {
    slug: 'home',
    title: 'Home',
    showInNav: false,
    navOrder: 0,
    heroType: heroId != null ? 'fullScreen' : 'lowImpact',
    heroHeading: 'PAYNEMEDIACO',
    heroSub: 'Wedding Photography & Videography — Fort Myers to Miami',
    ...heroImage,
    meta: {
      title: 'PayneMediaCo — Wedding Photography & Videography',
      description: 'Wedding photography and videography across Southwest and South Florida.',
    },
    sections: [
      {
        content: [
          { h2: 'Make it stand out.' },
          { p: 'We can create what your heart desires — real weddings, real light, no two galleries the same.' },
        ],
      },
      {
        trustRow: {
          items: [
            { icon: 'star', label: 'Locally Owned', detail: 'Fort Myers · Naples · Sarasota · Tampa · St. Pete' },
            { icon: 'shield', label: 'Reaches South Florida', detail: 'West Palm · Ft. Lauderdale · Miami' },
            { icon: 'support', label: 'Text-Friendly', detail: '502-442-1142' },
            { icon: 'rosette', label: 'Always On', detail: '24-7-365' },
          ],
        },
      },
      {
        cta: {
          heading: 'Ready to book your date?',
          body: 'Text or call for a custom quote — a very competitive rate, and a real person every time.',
          links: [
            { label: 'See the weddings', url: '/weddings' },
            { label: 'Watch the films', url: '/videos', outline: true },
          ],
        },
      },
    ],
  },
  {
    slug: 'weddings',
    title: 'Weddings',
    navOrder: 1,
    heroType: 'splitPanel',
    heroHeading: 'Weddings',
    heroSub: 'Every wedding, its own gallery.',
    ...heroImage,
    meta: { title: 'Weddings — PayneMediaCo', description: 'Recent weddings photographed by PayneMediaCo.' },
    // The Archive block (appended in step 6) lists the wedding POSTS here, so
    // this page never needs editing again — a new wedding is a new post.
    sections: galleryIds.length
      ? [{ gallery: { heading: 'Selected Work', columns: '3', images: galleryIds } }]
      : [],
  },
  {
    slug: 'videos',
    title: 'Videos',
    navOrder: 2,
    heroType: 'splitPanel',
    heroHeading: 'Wedding Videography',
    heroSub: 'Producing wedding films is a passion of ours.',
    ...heroImage,
    meta: { title: 'Videos — PayneMediaCo', description: 'Wedding highlight films by PayneMediaCo.' },
    sections: [
      {
        content: [
          { p: 'Here at PayneMediaCo, we create a film you will want to watch with friends and family for years to come.' },
        ],
      },
    ],
  },
  {
    slug: 'about',
    title: 'About',
    navOrder: 3,
    heroType: 'splitPanel',
    heroHeading: 'About Chris',
    heroSub: 'Wedding photographer & videographer.',
    ...heroImage,
    meta: { title: 'About — PayneMediaCo', description: "About Chris Payne, PayneMediaCo." },
    sections: [
      {
        content: [
          { h2: "Hey! I'm Chris Payne." },
          {
            p: "I'm a professional wedding photographer and videographer offering my services in Fort Myers, Sanibel, Captiva, Naples, Sarasota, Tampa, St. Pete, Miami, Fort Lauderdale and West Palm — all at a very competitive rate.",
          },
          {
            p: 'I moved to Florida a few years ago and have a passion for capturing amazing high-quality photos and video for you, your family and friends to enjoy and reminisce for years to come.',
          },
        ],
      },
      {
        cta: {
          heading: 'Text or call for a custom quote',
          body: CONTACT_LINE,
          links: [{ label: 'Contact', url: '/contact' }],
        },
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact',
    navOrder: 4,
    heroType: 'splitPanel',
    heroHeading: 'Get in touch',
    heroSub: CONTACT_LINE,
    ...heroImage,
    meta: { title: 'Contact — PayneMediaCo', description: 'Contact PayneMediaCo.' },
    sections: [
      { content: [{ h2: 'Contact us' }, { p: `Call or text ${CONTACT_LINE}, or use the form below.` }] },
      { contactForm: true },
    ],
  },
]

const result = await provisionPagesFromSpec(payload, tenantId, pages, { overwrite: true })
console.log('PAGES', JSON.stringify(result))

// 5. Append the real Vimeo embeds to the videos page (no spec key for the
// Video block yet, so this is a direct layout append after create/update).
const videosPage = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'videos' } }, { tenant: { equals: tenantId } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const vp = videosPage.docs[0] as { id: number | string; layout?: unknown[]; _status?: string } | undefined
if (vp) {
  const layout = Array.isArray(vp.layout) ? [...vp.layout] : []
  for (const f of FILMS) {
    layout.push({
      blockType: 'video',
      videoUrl: `https://vimeo.com/${f.id}`,
      aspect: '16/9',
      caption: f.caption,
    })
  }
  await updatePageLayout(payload, vp, layout as never[], 'pages')
  console.log(`VIDEOS page: ${FILMS.length} films appended`)
} else {
  console.log('VIDEOS page not found — films NOT added')
}

// 6. A wedding is a POST, not a page. That is the structural argument this demo
// makes to Chris: his Squarespace site has one hand-built gallery page, and
// every new wedding means building another one by hand. Here a wedding is a row
// — it gets its own URL, it shows up in the Weddings archive and in the nav
// dropdown with a thumbnail, all of it automatically, and adding the next one is
// filling in a form.
//
// The films are weddings too, so they are posts as well — Posts gained the Video
// block in 20260830_050000. Chris's site keeps photos and films on separate
// pages; here one wedding is one post that holds both.
const WEDDINGS: Array<{
  slug: string
  title: string
  date: string
  intro: string
  imageIds: number[]
  /** Vimeo id — rendered as a Video block inside the post. */
  filmId?: string
}> = [
  {
    slug: 'mercyanna-and-jacob',
    title: 'Mercyanna & Jacob',
    date: '2024-11-09T17:00:00.000Z',
    intro:
      'A full day, start to finish — getting ready, the first look, the ceremony, and a reception that ran long in the best way.',
    imageIds: mercyannaIds,
  },
  // The four film weddings. No photo galleries published for these, so each post
  // leads with its film. A cover image is borrowed from the curated pool purely
  // so the archive card and the nav dropdown have a thumbnail — a card with no
  // image reads as a broken post, not a video post.
  {
    slug: 'char-and-joseph',
    title: 'Char & Joseph',
    date: '2024-09-07T17:00:00.000Z',
    intro: "The highlight film from Char and Joseph's September wedding.",
    imageIds: [],
    filmId: '1039559272',
  },
  {
    slug: 'stephanie-and-danny',
    title: 'Stephanie & Danny',
    date: '2024-08-03T17:00:00.000Z',
    intro: "The highlight film from Stephanie and Danny's August wedding.",
    imageIds: [],
    filmId: '1032353807',
  },
  {
    slug: 'jessica-and-hussein',
    title: 'Jessica & Hussein',
    date: '2024-07-20T17:00:00.000Z',
    intro: "The highlight film from Jessica and Hussein's July wedding.",
    imageIds: [],
    filmId: '1028499664',
  },
  {
    slug: 'hailey-and-joseph',
    title: 'Hailey & Joseph',
    date: '2022-03-24T17:00:00.000Z',
    intro: "The highlight film from Hailey and Joseph's spring wedding.",
    imageIds: [],
    filmId: '1025303620',
  },
]

// Film-only posts still need a cover, or the archive card renders as a hole.
let coverCursor = 0
const borrowCover = (): number | undefined => galleryIds[coverCursor++ % Math.max(galleryIds.length, 1)]

for (const w of WEDDINGS) {
  const cover = w.imageIds[0] ?? borrowCover()
  if (!w.imageIds.length && !w.filmId) {
    console.log('WEDDING skipped (nothing to show)', w.slug)
    continue
  }
  const existing = await payload.find({
    collection: 'posts',
    where: { and: [{ slug: { equals: w.slug } }, { tenant: { equals: tenantId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const layout: Record<string, unknown>[] = [
    {
      blockType: 'content',
      columns: [column('full', [h('h2', w.title), para(w.intro)])],
    },
  ]
  if (w.filmId) {
    layout.push({
      blockType: 'video',
      videoUrl: `https://vimeo.com/${w.filmId}`,
      aspect: '16/9',
      caption: `${w.title} — highlight film`,
    })
  }
  if (w.imageIds.length) {
    layout.push({
      blockType: 'gallery',
      heading: 'The Gallery',
      columns: '3',
      // Gallery.images is an ARRAY FIELD of { image } rows, not a list of media
      // ids. Passing ids directly fails deep inside beforeValidate with
      // "Cannot create property 'image' on number" — the id, being told it is a row.
      images: w.imageIds.map((id) => ({ image: id })),
    })
  }
  layout.push(
    {
      blockType: 'cta',
      richText: rich([
        h('h2', 'Planning a wedding?'),
        para(`Text or call ${CONTACT_LINE} for a custom quote.`),
      ]),
      links: [{ link: { type: 'custom', label: 'Get in touch', url: '/contact' } }],
    },
  )
  const data = {
    title: w.title,
    slug: w.slug,
    tenant: tenantId,
    publishedOn: w.date,
    hero: {
      type: 'splitPanel',
      richText: rich([h('h2', w.title), para(w.intro)]),
      media: cover,
    },
    layout,
    meta: {
      title: `${w.title} — PayneMediaCo`,
      description: w.intro,
      image: cover,
    },
    _status: 'published',
  }
  const doc = existing.docs[0] as { id: number | string } | undefined
  if (doc) {
    await (payload.update as never as (a: unknown) => Promise<unknown>)({
      collection: 'posts', id: doc.id, data, overrideAccess: true,
    })
    console.log('WEDDING updated', w.slug, `${w.imageIds.length} photos`, w.filmId ? 'film' : '')
  } else {
    await (payload.create as never as (a: unknown) => Promise<unknown>)({
      collection: 'posts', data, overrideAccess: true,
    })
    console.log('WEDDING created', w.slug, `${w.imageIds.length} photos`, w.filmId ? 'film' : '')
  }
}

// 7. The Weddings page indexes those posts, so it never needs editing again.
const weddingsPage = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'weddings' } }, { tenant: { equals: tenantId } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const wp = weddingsPage.docs[0] as { id: number | string; layout?: unknown[]; _status?: string } | undefined
if (wp) {
  const layout = Array.isArray(wp.layout) ? [...wp.layout] : []
  layout.unshift({
    blockType: 'archive',
    populateBy: 'collection',
    relationTo: 'posts',
    limit: 12,
    introContent: rich([h('h2', 'Recent Weddings'), para('Each one has its own gallery.')]),
  })
  await updatePageLayout(payload, wp, layout as never[], 'pages')
  console.log('WEDDINGS page: archive block prepended')
} else {
  console.log('WEDDINGS page not found — archive NOT added')
}

// 8. Point nav at the real page set.
const nav = await applyBrochureNav(payload, tenantId, pages)
console.log('NAV', JSON.stringify(nav))

console.log('DONE', intake.url)
process.exit(0)
