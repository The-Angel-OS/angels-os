/**
 * Auth Completion Route — GET /api/auth/complete
 *
 * Standalone Next.js route handler that sets the authentication cookie
 * and redirects to the final destination after OAuth login.
 *
 * Flow:
 *   1. OAuth callback signs JWT and redirects here with ?token=<jwt>&redirect=/path
 *   2. This handler verifies the JWT and returns a minimal HTML page
 *   3. Client JS sets cookie via document.cookie + fetch-based backup
 *   4. Verifies auth with /api/users/me, then redirects
 *
 * Cookie is set client-side via document.cookie because Payload's
 * handleEndpoints() strips Set-Cookie headers from responses.
 *
 * This route is EXCLUDED from middleware (see middleware.ts matcher).
 *
 * Security:
 *   - JWT verified with payload.secret before rendering
 *   - Redirect validated to be a relative path (prevents open redirect)
 */
import { jwtVerify } from 'jose'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const redirectTo = url.searchParams.get('redirect') || '/dashboard'

  if (!token) {
    return Response.json(
      { error: 'Missing token parameter.' },
      { status: 400 },
    )
  }

  // Verify the JWT using Payload's hashed secret
  const payload = await getPayload({ config: configPromise })
  try {
    const secretKey = new TextEncoder().encode(payload.secret)
    await jwtVerify(token, secretKey)
  } catch {
    return Response.json({ error: 'Invalid or expired token.' }, { status: 401 })
  }

  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard'

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signing in\u2026</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #fafafa;
      color: #1a1a1a;
    }
    .card {
      text-align: center;
      padding: 48px 40px;
      max-width: 380px;
    }
    .spinner {
      width: 32px; height: 32px;
      border: 3px solid #e5e5e5;
      border-top-color: #1a1a1a;
      border-radius: 50%;
      animation: spin .8s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 14px; color: #666; }
    .error { color: #dc2626; }
    .success { color: #16a34a; }
    a { color: #1a1a1a; text-decoration: underline; margin-top: 16px; display: inline-block; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner" id="spinner"></div>
    <h1 id="title">Signing in\u2026</h1>
    <p id="message">Setting up your session</p>
  </div>
  <script>
    (async function() {
      var title = document.getElementById('title');
      var message = document.getElementById('message');
      var spinner = document.getElementById('spinner');
      var REDIRECT = ${JSON.stringify(safeRedirect)};
      var TOKEN = ${JSON.stringify(token)};

      try {
        // Set cookie via document.cookie
        var cookieParts = [
          'payload-token=' + TOKEN,
          'path=/',
          'max-age=1209600',
          'samesite=lax',
        ];
        if (window.location.protocol === 'https:') {
          cookieParts.push('secure');
        }
        document.cookie = cookieParts.join('; ');

        // Also set with domain for subdomain coverage
        var hostParts = window.location.hostname.split('.');
        if (hostParts.length >= 2) {
          document.cookie = cookieParts.concat([
            'domain=.' + hostParts.slice(-2).join('.')
          ]).join('; ');
        }

        // Backup: fetch-based Set-Cookie for HttpOnly version
        try {
          await fetch('/api/auth/set-cookie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: TOKEN }),
            credentials: 'include',
            cache: 'no-store',
          });
        } catch(e) {}

        // Brief pause for browser to commit cookies
        await new Promise(function(r) { setTimeout(r, 300); });

        // Verify authentication
        var meRes = await fetch('/api/users/me', {
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        });
        var data = {};
        try { data = await meRes.json(); } catch(e) {}

        if (meRes.ok && data.user) {
          spinner.style.display = 'none';
          title.textContent = 'Welcome, ' + (data.user.name || data.user.email || '') + '!';
          title.className = 'success';
          message.textContent = 'Redirecting\u2026';
          setTimeout(function() { window.location.replace(REDIRECT); }, 300);
          return;
        }

        // Cookie may not have been received — redirect anyway.
        // The dashboard will handle unauthenticated state gracefully.
        spinner.style.display = 'none';
        title.textContent = 'Almost there\u2026';
        message.innerHTML = 'Redirecting to your dashboard. <a href="' + REDIRECT + '">Click here</a> if not redirected.';
        setTimeout(function() { window.location.replace(REDIRECT); }, 1500);

      } catch(err) {
        spinner.style.display = 'none';
        title.textContent = 'Something went wrong';
        title.className = 'error';
        message.innerHTML = 'Please <a href="/en/login">try signing in again</a>.';
      }
    })();
  </script>
</body>
</html>`

  const headers = new Headers()
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')

  return new Response(html, { status: 200, headers })
}
