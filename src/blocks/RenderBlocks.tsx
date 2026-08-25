import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { BannerBlock } from '@/blocks/Banner/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { CarouselBlock } from '@/blocks/Carousel/Component'
import { CommentsBlock } from '@/blocks/Comments/Component'
import { ContentBlock } from '@/blocks/Content/Component'
import { FormBlock } from '@/blocks/Form/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { ThreeItemGridBlock } from '@/blocks/ThreeItemGrid/Component'
import { CalendarBlock } from '@/blocks/Calendar/Component'
import { DonationBlock } from '@/blocks/Donation/Component'
import { MembershipBlock } from '@/blocks/Membership/Component'
import { FeaturedEndeavorsBlock } from '@/blocks/FeaturedEndeavors/Component'
import { GalleryBlock } from '@/blocks/Gallery/Component'
import { MerlinControlBlock } from '@/blocks/MerlinControl/Component'
import { GoogleReviewsBlock } from '@/blocks/GoogleReviews/Component'
import { MediaTextBlock } from '@/blocks/MediaText/Component'
import { buildAlternateIndex } from '@/blocks/MediaText/alternateIndex'
import { TicketFormBlockComponent } from '@/blocks/TicketForm/Component'
import { TrustRowBlock } from '@/blocks/TrustRow/Component'
import { FaqBlock } from '@/blocks/Faq/Component'
import { WorkQuizBlockComponent } from '@/blocks/WorkQuiz/Component'
import { VideoBlockComponent } from '@/blocks/Video/Component'
import { ShowcaseBlock } from '@/blocks/Showcase/Component'
import { ProductPanelBlock } from '@/blocks/ProductPanel/Component'
import { toKebabCase } from '@/utilities/toKebabCase'
import React, { Fragment } from 'react'

import type { Page } from '../payload-types'

export type DocContext = { id: number; collection: 'posts' | 'products' | 'pages' | 'events' }

const blockComponents = {
  archive: ArchiveBlock,
  banner: BannerBlock,
  carousel: CarouselBlock,
  comments: CommentsBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  mediaBlock: MediaBlock,
  threeItemGrid: ThreeItemGridBlock,
  calendar: CalendarBlock,
  donation: DonationBlock,
  membership: MembershipBlock,
  featuredEndeavors: FeaturedEndeavorsBlock,
  gallery: GalleryBlock,
  merlinControl: MerlinControlBlock,
  googleReviews: GoogleReviewsBlock,
  mediaText: MediaTextBlock,
  ticketForm: TicketFormBlockComponent,
  trustRow: TrustRowBlock,
  faq: FaqBlock,
  workQuiz: WorkQuizBlockComponent,
  video: VideoBlockComponent,
  showcase: ShowcaseBlock,
  productPanel: ProductPanelBlock,
}

/**
 * Blocks that paint their own full-width band (their component carries the
 * background and its own py-*). These get NO wrapper margin, so a band butts
 * directly against the hero above it and the copy below — which is what makes
 * a page read as one surface instead of a column of floating cards.
 */
const FULL_BLEED_BLOCKS = new Set(['showcase', 'threeItemGrid', 'featuredEndeavors'])

export const RenderBlocks: React.FC<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: any[]
  docContext?: DocContext
  /** The hosting page's endeavor/tenant slug — used as the default endeavor for
   *  context-aware blocks (e.g. Merlin Control) so editors don't retype it. */
  tenantSlug?: string
}> = (props) => {
  const { blocks, docContext, tenantSlug } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    // Media + Text's "alternate" side is a property of POSITION, which a block
    // cannot know about itself.
    const mediaTextIndex = buildAlternateIndex(blocks)

    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockName, blockType } = block

          if (blockType && blockType in blockComponents) {
            // Each block has its own prop shape; cast to generic ComponentType
            const Block = blockComponents[blockType as keyof typeof blockComponents] as React.ComponentType<
              { id: string } & Record<string, unknown>
            >

            if (Block) {
              const blockProps =
                blockType === 'comments' && docContext
                  ? { ...block, docContext }
                  : blockType === 'merlinControl'
                    ? { ...block, endeavor: block.endeavor || tenantSlug }
                    : blockType === 'mediaText'
                      ? { ...block, blockIndex: mediaTextIndex.get(index) ?? 0 }
                      : block
              return (
                /* One place decides the rhythm between blocks. It used to be two:
                   this wrapper said my-16 and half the blocks said my-16 again
                   inside it, so a 32px line of copy sat in 64px of air and a
                   page of short Content blocks read as a column of islands. The
                   inner margins are gone; blocks that need their own band still
                   carry py-* internally, which butts them right up against this. */
                <div className={FULL_BLEED_BLOCKS.has(blockType) ? undefined : 'my-8'} key={index}>
                  <Block id={toKebabCase(blockName!)} {...blockProps} />
                </div>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
