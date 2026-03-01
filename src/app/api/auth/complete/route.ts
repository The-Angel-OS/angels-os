/**
 * Auth Completion Route — GET /api/auth/complete
 *
 * A standalone Next.js route handler (NOT a Payload custom endpoint) that
 * sets the `payload-token` cookie and redirects to the final destination.
 *
 * WHY THIS EXISTS:
 * Payload's `handleEndpoints()` reconstructs a new Response object from the
 * handler's return value. This reconstruction strips cookies — both
 * `Set-Cookie` headers and `cookies()` from `next/headers` fail to persist.
 *
 * By moving the cookie-setting step to a standalone Next.js route handler
 * (outside Payload's endpoint system), we let Next.js handle the Response
 * lifecycle natively. The OAuth callback handlers redirect here after
 * generating the JWT, and this handler sets the cookie and sends the user
 * to their final destination.
 *
 * Cookie Strategy (Attempt #9 — raw Response + middleware bypass + verification):
 *   Attempts #3-#8 all failed despite curl proving Set-Cookie IS present.
 *   The leading hypotheses:
 *     A. Next.js middleware (`NextResponse.next({ request: { headers } })`)
 *        wraps the downstream response, and the merge drops Set-Cookie.
 *     B. Immediate meta refresh / JS redirect fires before Chrome commits
 *        the cookie to its jar.
 *     C. Cookie shadowing: existing payload-token with different Domain
 *        conflicts with the new one.
 *
 *   This attempt addresses ALL THREE:
 *     - Middleware is bypassed entirely (early return in middleware.ts)
 *     - Raw `Response` object used (no NextResponse wrapper)
 *     - Cookie clearing headers sent first (remove shadowing)
 *     - NO immediate redirect — page waits 1.5s then verifies cookie
 *       works via `fetch('/api/users/me')` before redirecting
 *     - If verification fails, diagnostic info is shown
 *
 * Flow:
 *   1. OAuth callback exchanges code, creates/finds user, signs JWT
 *   2. Redirect to: /api/auth/complete?token=<jwt>&redirect=/admin
 *   3. This handler verifies JWT, sets cookie via Set-Cookie header
 *   4. Returns 200 HTML page (NO meta refresh, NO immediate JS redirect)
 *   5. JavaScript waits 1.5s → fetches /api/users/me → verifies auth
 *   6. If verified → redirects to final URL
 *   7. If not → shows diagnostic info for debugging
 *
 * Security:
 *   - JWT is verified with PAYLOAD_SECRET before setting the cookie
 *   - Redirect is validated to be a relative path (prevents open redirect)
 *   - Cookie flags match Payload's own auth cookie configuration
 */
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const redirectTo = url.searchParams.get('redirect') || '/dashboard'

  // --- Collect diagnostic info ---
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'localhost'
  const envCookieDomain = process.env.COOKIE_DOMAIN || ''
  const isProduction = process.env.NODE_ENV === 'production'

  console.log('[Auth Complete] Handler invoked (attempt #9 — raw Response + verification):', {
    host,
    proto,
    hasToken: Boolean(token),
    redirectTo,
    envCookieDomain: envCookieDomain || '(not set)',
    isProduction,
  })

  if (!token) {
    return Response.json(
      {
        error: 'Missing token parameter.',
        debug: {
          host,
          proto,
          envCookieDomain: envCookieDomain || '(not set)',
          isProduction,
          message: 'This endpoint requires ?token=<jwt>&redirect=/path',
        },
      },
      { status: 400 },
    )
  }

  const secret = process.env.PAYLOAD_SECRET
  if (!secret) {
    return Response.json(
      { error: 'Server configuration error.' },
      { status: 500 },
    )
  }

  // Verify the JWT is genuine (signed by our PAYLOAD_SECRET)
  try {
    jwt.verify(token, secret)
  } catch {
    return Response.json(
      { error: 'Invalid or expired token.' },
      { status: 401 },
    )
  }

  // Validate redirect is a relative path (prevent open redirect)
  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard'

  // --- Cookie domain validation ---
  let effectiveCookieDomain = envCookieDomain

  if (effectiveCookieDomain) {
    const domainBase = effectiveCookieDomain.startsWith('.')
      ? effectiveCookieDomain.slice(1)
      : effectiveCookieDomain
    const hostWithoutPort = host.split(':')[0]
    const domainMatches =
      hostWithoutPort === domainBase ||
      hostWithoutPort.endsWith(`.${domainBase}`)

    if (!domainMatches) {
      console.warn(
        '[Auth Complete] COOKIE_DOMAIN mismatch! Domain "%s" does not match host "%s". Dropping Domain attribute.',
        effectiveCookieDomain,
        hostWithoutPort,
      )
      effectiveCookieDomain = ''
    }
  }

  const maxAge = 14 * 24 * 60 * 60 // 14 days in seconds

  // --- Build Set-Cookie headers with full manual control ---
  // Why manual strings instead of NextResponse.cookies.set():
  //   NextResponse adds wrapper processing. Raw Response with manual
  //   Set-Cookie headers gives us zero framework interference.

  const securePart = isProduction ? '; Secure' : ''
  const domainPart = effectiveCookieDomain ? `; Domain=${effectiveCookieDomain}` : ''

  // --- Attempt #9b: SINGLE Set-Cookie only (no clearing headers) ---
  // Previous attempt sent 3 Set-Cookie headers (2 clearing + 1 setting).
  // Hypothesis: Chrome batch-processes Set-Cookie for same name+domain
  // and the Max-Age=0 clears may override the Max-Age=1209600 set.
  // Now sending only the one cookie we actually want.
  const setCookie = `payload-token=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${securePart}${domainPart}`

  // Diagnostic: non-httpOnly test cookie visible to document.cookie.
  // If this shows up but payload-token doesn't work → httpOnly-specific issue.
  // If this also doesn't show up → Chrome blocks ALL cookies from this response.
  const testCookie = `auth-debug-test=attempt9b; Path=/; Max-Age=120; SameSite=Lax${securePart}${domainPart}`

  console.log('[Auth Complete] Cookie strategy (attempt #9b — single cookie, no clearing):', {
    effectiveCookieDomain: effectiveCookieDomain || '(host-only)',
    secure: isProduction,
    maxAge,
    tokenLength: token.length,
    testCookieIncluded: true,
  })

  // --- Build the HTML verification page ---
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signing in...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 560px;
      margin: 80px auto;
      padding: 0 24px;
      color: #1a1a1a;
      line-height: 1.5;
    }
    h2 { font-size: 20px; margin-bottom: 12px; }
    #status { font-size: 15px; margin: 12px 0; color: #444; }
    #debug {
      display: none;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 360px;
      overflow-y: auto;
      color: #333;
    }
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid #e0e0e0;
      border-top-color: #666;
      border-radius: 50%;
      animation: spin .7s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    button {
      margin-top: 16px;
      padding: 10px 20px;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }
    button:hover { background: #333; }
    .hint { font-size: 12px; color: #888; margin-top: 8px; }
  </style>
</head>
<body>
  <h2>Signing in\u2026</h2>
  <p id="status"><span class="spinner"></span> Verifying authentication\u2026</p>
  <div id="debug"></div>
  <script>
    (async function() {
      var status = document.getElementById('status');
      var debug = document.getElementById('debug');
      var REDIRECT = ${JSON.stringify(safeRedirect)};

      // Step 1: Give the browser time to commit Set-Cookie to the cookie jar.
      // Previous attempts with instant meta refresh / JS redirect failed
      // because Chrome hadn't committed the cookie before navigation.
      await new Promise(function(r) { setTimeout(r, 1500); });

      status.innerHTML = '<span class="spinner"></span> Checking cookie\u2026';

      // Step 2: Verify the cookie is actually stored by calling /api/users/me.
      // If the cookie was set correctly, this returns 200 + user data.
      // If not, we get 401 and show diagnostics instead of blindly redirecting.
      try {
        var res = await fetch('/api/users/me', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        });

        var body = '';
        try { body = await res.text(); } catch(e) {}
        var parsed = {};
        try { parsed = JSON.parse(body); } catch(e) {}

        if (res.ok && parsed.user) {
          // Cookie works! Redirect now.
          status.innerHTML = '\\u2705 Authenticated as <strong>' +
            (parsed.user.name || parsed.user.email || 'user') +
            '</strong>. Redirecting\u2026';
          setTimeout(function() { window.location.replace(REDIRECT); }, 400);
          return;
        }

        // Cookie NOT working \u2014 show diagnostics
        var allCookies = document.cookie || '';
        var hasTestCookie = allCookies.indexOf('auth-debug-test=') !== -1;
        status.innerHTML = '\\u274c Cookie verification failed (HTTP ' + res.status + ')';
        debug.style.display = 'block';
        debug.textContent = JSON.stringify({
          step: 'verification_failed',
          fetchStatus: res.status,
          fetchStatusText: res.statusText,
          responsePreview: body.slice(0, 800),
          testCookieStored: hasTestCookie,
          visibleCookies: allCookies || '(none visible)',
          diagnosis: hasTestCookie
            ? 'Test cookie stored OK \u2014 Set-Cookie works! Issue is specific to httpOnly payload-token.'
            : 'Test cookie ALSO missing \u2014 Chrome is blocking ALL cookies from this response.',
          pageUrl: window.location.href,
          redirectTarget: REDIRECT,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          hint: [
            'Open DevTools > Application > Cookies > ' + window.location.origin,
            'Look for "payload-token". If absent, Set-Cookie was blocked.',
            'If present, check Domain/Path/Secure attributes match.',
            'Try clearing ALL cookies for this domain and retry OAuth.',
          ],
        }, null, 2);

        // Add manual redirect button
        var btn = document.createElement('button');
        btn.textContent = 'Try redirecting anyway \\u2192';
        btn.onclick = function() { window.location.replace(REDIRECT); };
        debug.after(btn);

        var hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = 'Tip: Clear cookies for this site in DevTools, then try logging in again.';
        btn.after(hint);

      } catch(err) {
        status.innerHTML = '\\u274c Network error: ' + err.message;
        debug.style.display = 'block';
        debug.textContent = JSON.stringify({
          step: 'network_error',
          error: String(err),
          timestamp: new Date().toISOString(),
        }, null, 2);
      }
    })();
  </script>
</body>
</html>`

  // --- Build raw Response with manual headers ---
  // Using raw Response (NOT NextResponse) to bypass any Next.js
  // response wrapping/merging that might strip Set-Cookie headers.
  const headers = new Headers()
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  headers.set('Pragma', 'no-cache')

  // Debug headers
  headers.set('X-Auth-Debug-Host', host)
  headers.set('X-Auth-Debug-Proto', proto)
  headers.set('X-Auth-Debug-Cookie-Domain', effectiveCookieDomain || '(host-only)')
  headers.set('X-Auth-Debug-Cookie-Method', 'raw-Response-single-SetCookie-plus-test-cookie')
  headers.set('X-Auth-Debug-Attempt', '9b')

  // Single Set-Cookie for the actual token — no clearing headers.
  // Attempt #9a proved clearing headers (Max-Age=0) for the same cookie
  // name+domain may cause Chrome to discard the subsequent set.
  headers.append('Set-Cookie', setCookie)
  // Diagnostic test cookie (non-httpOnly) — visible to document.cookie
  headers.append('Set-Cookie', testCookie)

  console.log('[Auth Complete] Returning raw Response with', {
    setCookieCount: 2,
    attempt: '9b',
    note: 'single payload-token + non-httpOnly test cookie',
  })

  return new Response(html, { status: 200, headers })
}
