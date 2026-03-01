/**
 * Auth Completion Route — GET /api/auth/complete
 *
 * A standalone Next.js route handler (NOT a Payload custom endpoint) that
 * orchestrates cookie setting and redirects to the final destination.
 *
 * WHY THIS EXISTS:
 * Payload's `handleEndpoints()` reconstructs a new Response object from the
 * handler's return value. This reconstruction strips cookies — both
 * `Set-Cookie` headers and `cookies()` from `next/headers` fail to persist.
 *
 * Cookie Strategy (Attempt #10 — fetch-based cookie delivery):
 *   Attempts #3-#9b all sent correct Set-Cookie headers on this page's
 *   response (proven by curl), but Chrome NEVER stored the cookie. The
 *   Vercel edge / Next.js response pipeline appears to strip Set-Cookie
 *   from page-load HTML responses.
 *
 *   Attempt #10 takes a fundamentally different approach:
 *     - This page returns plain HTML with NO Set-Cookie headers at all
 *     - Client-side JavaScript calls POST /api/auth/set-cookie with the JWT
 *     - The cookie is set on the fetch() response (different browser path)
 *     - Then verifies with GET /api/users/me
 *     - If verified → redirects to final destination
 *     - If not → shows diagnostics
 *
 *   Both /api/auth/complete and /api/auth/set-cookie are EXCLUDED from the
 *   middleware matcher, so Next.js middleware never touches these responses.
 *
 * Flow:
 *   1. OAuth callback exchanges code, creates/finds user, signs JWT
 *   2. Redirect to: /api/auth/complete?token=<jwt>&redirect=/admin
 *   3. This handler verifies JWT, returns HTML page (NO cookies on response)
 *   4. JavaScript POSTs token to /api/auth/set-cookie (cookie set via fetch)
 *   5. JavaScript GETs /api/users/me to verify
 *   6. If verified → redirects to final URL
 *   7. If not → shows diagnostic info
 *
 * Security:
 *   - JWT is verified with PAYLOAD_SECRET before rendering the page
 *   - Token is passed to client-side JS only for the fetch call
 *   - Redirect is validated to be a relative path (prevents open redirect)
 *   - Cookie flags match Payload's own auth cookie configuration
 */
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const redirectTo = url.searchParams.get('redirect') || '/dashboard'

  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'localhost'
  const isProduction = process.env.NODE_ENV === 'production'

  console.log('[Auth Complete] Handler invoked (attempt #10 — fetch-based cookie delivery):', {
    host,
    hasToken: Boolean(token),
    redirectTo,
    isProduction,
  })

  if (!token) {
    return Response.json(
      { error: 'Missing token parameter.', hint: 'This endpoint requires ?token=<jwt>&redirect=/path' },
      { status: 400 },
    )
  }

  const secret = process.env.PAYLOAD_SECRET
  if (!secret) {
    return Response.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  // Verify the JWT is genuine (signed by our PAYLOAD_SECRET)
  try {
    jwt.verify(token, secret)
  } catch {
    return Response.json({ error: 'Invalid or expired token.' }, { status: 401 })
  }

  // Validate redirect is a relative path (prevent open redirect)
  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard'

  // --- Build the HTML page ---
  // NOTE: NO Set-Cookie headers on this response!
  // The cookie is set via client-side fetch to /api/auth/set-cookie.
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
  <h2>Signing in\\u2026</h2>
  <p id="status"><span class="spinner"></span> Setting authentication cookie\\u2026</p>
  <div id="debug"></div>
  <script>
    (async function() {
      var status = document.getElementById('status');
      var debug = document.getElementById('debug');
      var REDIRECT = ${JSON.stringify(safeRedirect)};
      var TOKEN = ${JSON.stringify(token)};

      // Step 1: Set the cookie via fetch to /api/auth/set-cookie.
      // This is fundamentally different from all previous attempts (#3-#9b)
      // which set Set-Cookie on this page's response. Fetch responses follow
      // a different browser cookie processing path.
      try {
        var setCookieRes = await fetch('/api/auth/set-cookie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: TOKEN }),
          credentials: 'include',
          cache: 'no-store',
        });

        if (!setCookieRes.ok) {
          var errBody = '';
          try { errBody = await setCookieRes.text(); } catch(e) {}
          status.innerHTML = '\\u274c Cookie endpoint error (HTTP ' + setCookieRes.status + ')';
          debug.style.display = 'block';
          debug.textContent = JSON.stringify({
            step: 'set_cookie_failed',
            fetchStatus: setCookieRes.status,
            response: errBody.slice(0, 500),
            timestamp: new Date().toISOString(),
          }, null, 2);
          return;
        }

        status.innerHTML = '<span class="spinner"></span> Verifying cookie\\u2026';

        // Step 2: Small delay to let browser commit the cookie
        await new Promise(function(r) { setTimeout(r, 500); });

        // Step 3: Verify cookie works by calling /api/users/me
        var meRes = await fetch('/api/users/me', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        });

        var meBody = '';
        try { meBody = await meRes.text(); } catch(e) {}
        var parsed = {};
        try { parsed = JSON.parse(meBody); } catch(e) {}

        if (meRes.ok && parsed.user) {
          // Cookie works! Redirect now.
          status.innerHTML = '\\u2705 Authenticated as <strong>' +
            (parsed.user.name || parsed.user.email || 'user') +
            '</strong>. Redirecting\\u2026';
          setTimeout(function() { window.location.replace(REDIRECT); }, 400);
          return;
        }

        // Cookie NOT working \u2014 show diagnostics
        var allCookies = document.cookie || '';
        status.innerHTML = '\\u274c Cookie verification failed (HTTP ' + meRes.status + ')';
        debug.style.display = 'block';
        debug.textContent = JSON.stringify({
          step: 'verification_failed',
          approach: 'attempt_10_fetch_based',
          setCookieStatus: setCookieRes.status,
          meStatus: meRes.status,
          meResponse: meBody.slice(0, 800),
          visibleCookies: allCookies || '(none visible)',
          pageUrl: window.location.href,
          redirectTarget: REDIRECT,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          hint: [
            'This is attempt #10 (fetch-based cookie delivery).',
            'The cookie was set via POST /api/auth/set-cookie, not on the page response.',
            'Open DevTools > Application > Cookies > ' + window.location.origin,
            'Look for "payload-token". Check Domain/Path/Secure attributes.',
            'Try: Chrome Incognito mode (disables extensions that may block cookies).',
          ],
        }, null, 2);

        // Add manual redirect button
        var btn = document.createElement('button');
        btn.textContent = 'Try redirecting anyway \\u2192';
        btn.onclick = function() { window.location.replace(REDIRECT); };
        debug.after(btn);

        var hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = 'Tip: Try in Chrome Incognito mode. If it works there, a browser extension is blocking cookies.';
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

  // --- Return plain HTML with NO Set-Cookie headers ---
  // The cookie is set entirely via the client-side fetch call above.
  const headers = new Headers()
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  headers.set('Pragma', 'no-cache')
  headers.set('X-Auth-Debug-Attempt', '10')
  headers.set('X-Auth-Debug-Method', 'fetch-based-cookie-delivery')

  return new Response(html, { status: 200, headers })
}
