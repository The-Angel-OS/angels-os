import type { Footer } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import React from 'react'

interface Props {
  menu: Footer['navItems']
  /**
   * Columns. `navItems` is capped at 6, so any footer with a real link set (the
   * WordPress sites we mirror carry 12) has to use groups — and until now nothing
   * rendered them, so filling them in made the footer go BLANK. Groups win when
   * present; flat `navItems` stays the fallback for footers that never grew.
   */
  groups?: Footer['navGroups']
}

export function FooterMenu({ menu, groups }: Props) {
  if (groups?.length) {
    return (
      <nav className="grid grid-cols-2 gap-8 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.id}>
            <h3 className="mb-2 font-semibold text-black dark:text-white">{group.heading}</h3>
            <ul className="flex flex-col gap-1">
              {(group.items ?? []).map((item) => (
                <li key={item.id}>
                  <CMSLink appearance="link" {...item.link} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    )
  }

  if (!menu?.length) return null

  return (
    <nav>
      <ul>
        {menu.map((item) => {
          return (
            <li key={item.id}>
              <CMSLink appearance="link" {...item.link} />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
