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
 * Cookie Strategy (Attempt #11 — document.cookie + dual verification):
 *   Attempts #3-#10 all failed: Set-Cookie headers on page responses,
 *   meta-refresh pages, middleware bypass, AND fetch-based cookie delivery
 *   all produced correct Set-Cookie headers (proven by curl), but Chrome
 *   NEVER stored the cookie. Something in the Vercel/Chrome pipeline
 *   silently drops all Set-Cookie headers.
 *
 *   Attempt #11 bypasses ALL server-side response processing:
 *     - Cookie is set via document.cookie in client-side JavaScript
 *     - No Set-Cookie header needed — browser sets its own cookie directly
 *     - Also tries fetch-based Set-Cookie as backup (for HttpOnly version)
 *     - Verifies with GET /api/users/me
 *     - If cookie fails, tries Authorization header to confirm JWT validity
 *     - If JWT valid but cookie won't stick → likely browser extension blocking
 *
 *   /api/auth/complete and /api/auth/set-cookie are EXCLUDED from the
 *   middleware matcher, so Next.js middleware never touches these responses.
 *
 * Flow:
 *   1. OAuth callback exchanges code, creates/finds user, signs JWT
 *   2. Redirect to: /api/auth/complete?token=<jwt>&redirect=/admin
 *   3. This handler verifies JWT, returns HTML page
 *   4. JavaScript sets cookie via document.cookie (primary)
 *   5. JavaScript also POSTs to /api/auth/set-cookie (backup, HttpOnly)
 *   6. JavaScript GETs /api/users/me to verify
 *   7. If verified → redirects to final URL
 *   8. If not → tries Authorization header to confirm JWT validity
 *   9. If JWT valid → shows "cookie blocked" diagnostic
 *
 * Security:
 *   - JWT is verified with PAYLOAD_SECRET before rendering the page
 *   - Token is passed to client-side JS (already visible in URL query param)
 *   - document.cookie sets non-HttpOnly cookie (acceptable tradeoff vs no auth)
 *   - Redirect is validated to be a relative path (prevents open redirect)
 */
import { jwtVerify } from 'jose'

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

  console.log('[Auth Complete] Handler invoked (attempt #11 — document.cookie + dual verification):', {
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
  // MUST use jose (same library as Payload CMS 3.x) for consistent verification.
  try {
    const secretKey = new TextEncoder().encode(secret)
    await jwtVerify(token, secretKey)
  } catch {
    return Response.json({ error: 'Invalid or expired token.' }, { status: 401 })
  }

  // Validate redirect is a relative path (prevent open redirect)
  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard'

  // --- Build the HTML page ---
  // Attempt #11: Set cookie via document.cookie (bypasses ALL server-side processing)
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
      var log = [];

      try {
        // ═══════════════════════════════════════════════════════════════
        // Strategy A: Set cookie via document.cookie (PRIMARY)
        // This bypasses ALL server-side response processing entirely.
        // No Set-Cookie header needed — the browser sets its own cookie.
        // Tradeoff: not HttpOnly (impossible from JS), but the token is
        // already visible in this page's URL and JS source.
        // ═══════════════════════════════════════════════════════════════
        var cookieParts = [
          'payload-token=' + TOKEN,
          'path=/',
          'max-age=1209600',
          'samesite=lax',
        ];
        // Only add Secure flag on HTTPS (production)
        if (window.location.protocol === 'https:') {
          cookieParts.push('secure');
        }
        document.cookie = cookieParts.join('; ');
        log.push('A1: document.cookie set (no domain, host-only)');

        // Also try with explicit domain for subdomain coverage
        var hostParts = window.location.hostname.split('.');
        if (hostParts.length >= 2) {
          var domainRoot = hostParts.slice(-2).join('.');
          var domainCookieParts = cookieParts.concat(['domain=.' + domainRoot]);
          document.cookie = domainCookieParts.join('; ');
          log.push('A2: document.cookie set (domain=.' + domainRoot + ')');
        }

        // Check if document.cookie shows our cookie
        var hasCookieA = document.cookie.indexOf('payload-token') !== -1;
        log.push('A3: document.cookie visible = ' + hasCookieA);

        // ═══════════════════════════════════════════════════════════════
        // Strategy B: Also try fetch-based Set-Cookie (BACKUP)
        // This may set an HttpOnly cookie that document.cookie can't see
        // but the server CAN receive.
        // ═══════════════════════════════════════════════════════════════
        var fetchOk = false;
        try {
          var setCookieRes = await fetch('/api/auth/set-cookie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: TOKEN }),
            credentials: 'include',
            cache: 'no-store',
          });
          fetchOk = setCookieRes.ok;
          log.push('B1: fetch /api/auth/set-cookie = ' + setCookieRes.status);
        } catch(fetchErr) {
          log.push('B1: fetch failed = ' + fetchErr.message);
        }

        status.innerHTML = '<span class="spinner"></span> Verifying\\u2026';

        // Brief pause for browser to commit cookies
        await new Promise(function(r) { setTimeout(r, 500); });

        // ═══════════════════════════════════════════════════════════════
        // Verification: Call /api/users/me with cookies
        // ═══════════════════════════════════════════════════════════════
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

        log.push('C1: /api/users/me status = ' + meRes.status);
        log.push('C2: user = ' + (parsed.user ? parsed.user.email : 'null'));

        if (meRes.ok && parsed.user) {
          // SUCCESS! Cookie works — redirect now.
          status.innerHTML = '\\u2705 Authenticated as <strong>' +
            (parsed.user.name || parsed.user.email || 'user') +
            '</strong>. Redirecting\\u2026';
          setTimeout(function() { window.location.replace(REDIRECT); }, 400);
          return;
        }

        // ═══════════════════════════════════════════════════════════════
        // Fallback: Try Authorization header (confirms JWT is valid)
        // If this works, we know the JWT is good but cookies are blocked.
        // ═══════════════════════════════════════════════════════════════
        var authHeaderRes = await fetch('/api/users/me', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': 'JWT ' + TOKEN,
          },
          cache: 'no-store',
        });
        var authHeaderBody = '';
        try { authHeaderBody = await authHeaderRes.text(); } catch(e) {}
        var authParsed = {};
        try { authParsed = JSON.parse(authHeaderBody); } catch(e) {}

        log.push('D1: Authorization header status = ' + authHeaderRes.status);
        log.push('D2: user = ' + (authParsed.user ? authParsed.user.email : 'null'));

        var jwtValid = authHeaderRes.ok && authParsed.user;

        if (jwtValid) {
          // JWT is valid! The problem is purely cookie storage.
          // Last resort: try navigating with the token in a cookie set right before
          status.innerHTML = '\\u26a0\\ufe0f JWT valid but cookie not stored. Trying direct navigation\\u2026';
          log.push('E1: JWT confirmed valid, cookie storage blocked');

          // One more attempt: set cookie RIGHT before navigation
          document.cookie = cookieParts.join('; ');
          if (hostParts && hostParts.length >= 2) {
            document.cookie = cookieParts.concat(['domain=.' + hostParts.slice(-2).join('.')]).join('; ');
          }

          // Navigate and hope the cookie sticks during same-origin navigation
          await new Promise(function(r) { setTimeout(r, 200); });

          // Check one more time
          var finalCheck = await fetch('/api/users/me', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
          });
          var finalBody = '';
          try { finalBody = await finalCheck.text(); } catch(e) {}
          var finalParsed = {};
          try { finalParsed = JSON.parse(finalBody); } catch(e) {}

          if (finalCheck.ok && finalParsed.user) {
            status.innerHTML = '\\u2705 Authenticated! Redirecting\\u2026';
            setTimeout(function() { window.location.replace(REDIRECT); }, 400);
            return;
          }

          // Cookie truly blocked — show diagnostics
          var allCookies = document.cookie || '';
          status.innerHTML = '\\u274c Cookie storage blocked by browser';
          debug.style.display = 'block';
          debug.textContent = JSON.stringify({
            step: 'cookie_blocked',
            approach: 'attempt_11_document_cookie',
            jwtValid: true,
            jwtUser: authParsed.user ? authParsed.user.email : null,
            documentCookieVisible: hasCookieA,
            allVisibleCookies: allCookies || '(none)',
            log: log,
            diagnosis: hasCookieA
              ? 'document.cookie shows payload-token but server does not receive it (bizarre)'
              : 'document.cookie CANNOT set cookies on this domain (browser extension or policy blocking)',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            action: [
              '1. Try Chrome Incognito mode (disables extensions)',
              '2. Check DevTools > Application > Cookies > ' + window.location.origin,
              '3. Check if any extension blocks cookies (uBlock, Privacy Badger, etc.)',
              '4. Try a different browser (Firefox, Edge)',
            ],
          }, null, 2);

          // Manual redirect button
          var btn = document.createElement('button');
          btn.textContent = 'Continue to dashboard \\u2192';
          btn.onclick = function() { window.location.replace(REDIRECT); };
          debug.after(btn);

          var hint = document.createElement('p');
          hint.className = 'hint';
          hint.textContent = 'Your JWT is valid. The dashboard may work if cookies are allowed on the next page load.';
          btn.after(hint);
          return;
        }

        // JWT itself is not valid — different problem
        status.innerHTML = '\\u274c Authentication failed';
        debug.style.display = 'block';
        debug.textContent = JSON.stringify({
          step: 'jwt_invalid',
          approach: 'attempt_11_document_cookie',
          meStatus: meRes.status,
          authHeaderStatus: authHeaderRes.status,
          authHeaderResponse: authHeaderBody.slice(0, 500),
          log: log,
          timestamp: new Date().toISOString(),
        }, null, 2);

      } catch(err) {
        status.innerHTML = '\\u274c Error: ' + err.message;
        debug.style.display = 'block';
        debug.textContent = JSON.stringify({
          step: 'error',
          error: String(err),
          log: log,
          timestamp: new Date().toISOString(),
        }, null, 2);
      }
    })();
  </script>
</body>
</html>`

  // --- Return HTML page ---
  // Cookie is set via document.cookie in client-side JS (attempt #11).
  // NO Set-Cookie headers on this response.
  const headers = new Headers()
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  headers.set('Pragma', 'no-cache')
  headers.set('X-Auth-Debug-Attempt', '11')
  headers.set('X-Auth-Debug-Method', 'document-cookie-direct')

  return new Response(html, { status: 200, headers })
}
