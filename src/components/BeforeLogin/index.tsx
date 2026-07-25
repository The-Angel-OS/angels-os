import React from 'react'

/**
 * Rendered above the Payload admin login form.
 *
 * Its job is to be the way OUT. Logging out of the admin lands you on
 * /admin/login, which otherwise has no route back to the portal you were just
 * in — a dead end that reads like a loop, since the only affordance on the page
 * is to log in again (Ken, 260725).
 *
 * Links are RELATIVE on purpose: the admin is served from the same host as the
 * tenant site, so "/" is the portal you came from on every subdomain. The old
 * copy interpolated PAYLOAD_PUBLIC_SERVER_URL, which isn't set on this node —
 * it rendered a link to "undefined/login".
 */
export const BeforeLogin: React.FC = () => {
  return (
    <div>
      <p>
        <b>Admin sign-in.</b>
        {' This is where site admins manage the portal. To reach your own account, orders, and spaces, '}
        <a href="/login">sign in to the site instead</a>.
      </p>
      <p>
        <a href="/">← Back to the site</a>
      </p>
    </div>
  )
}
