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
import { toKebabCase } from '@/utilities/toKebabCase'
import React, { Fragment } from 'react'

import type { Page } from '../payload-types'

export type DocContext = { id: number; collection: 'posts' | 'products' }

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
}

export const RenderBlocks: React.FC<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: any[]
  docContext?: DocContext
}> = (props) => {
  const { blocks, docContext } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
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
                  : block
              return (
                <div className="my-16" key={index}>
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
