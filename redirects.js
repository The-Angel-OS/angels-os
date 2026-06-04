const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  // The Library moved from /learn/souls to /learn/works. Keep old links alive
  // (handoffs, screenshots, bookmarks) — covers the en path and any locale prefix.
  const worksRename = [
    { source: '/learn/souls', destination: '/learn/works', permanent: true },
    { source: '/:locale/learn/souls', destination: '/:locale/learn/works', permanent: true },
  ]

  const redirects = [internetExplorerRedirect, ...worksRename]

  return redirects
}

export default redirects
