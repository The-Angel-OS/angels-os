import Link from 'next/link'

export interface WorkspaceSubNavTab {
  label: string
  href: string
  active?: boolean
}

export function WorkspaceSubNav({ tabs }: { tabs: WorkspaceSubNavTab[] }) {
  return (
    <div className="mb-6 border-b border-border">
      <nav className="flex gap-6 overflow-x-auto" aria-label="Workspace sections">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative whitespace-nowrap pb-3 text-sm font-medium transition-colors ${
              tab.active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.active && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
            )}
          </Link>
        ))}
      </nav>
    </div>
  )
}
