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
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: radial-gradient(ellipse at center, #0d1117 0%, #010409 100%);
      color: #e6edf3;
      overflow: hidden;
    }
    .card {
      text-align: center;
      padding: 48px 40px;
      max-width: 420px;
      position: relative;
      z-index: 1;
    }
    /* Starfield background */
    .stars {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: transparent;
      z-index: 0;
    }
    .stars::before, .stars::after {
      content: '';
      position: absolute;
      width: 2px; height: 2px;
      background: white;
      border-radius: 50%;
      box-shadow:
        20px 80px 0 #fff3, 100px 40px 0 #fff4, 200px 120px 0 #fff3,
        300px 60px 0 #fff2, 50px 200px 0 #fff3, 400px 150px 0 #fff4,
        150px 300px 0 #fff3, 350px 250px 0 #fff2, 500px 100px 0 #fff3,
        250px 50px 0 #fff4, 600px 200px 0 #fff3, 450px 300px 0 #fff2,
        700px 80px 0 #fff3, 550px 350px 0 #fff4, 100px 400px 0 #fff3,
        800px 150px 0 #fff2, 650px 280px 0 #fff3, 320px 380px 0 #fff4,
        180px 180px 0 #fff3, 750px 320px 0 #fff2, 420px 70px 0 #fff3;
      animation: twinkle 4s ease-in-out infinite alternate;
    }
    .stars::after { animation-delay: 2s; transform: translate(60px, 30px); }
    @keyframes twinkle { 0% { opacity: 0.4; } 100% { opacity: 1; } }
    /* Angel logo — golden halo + wings */
    .logo-container {
      width: 100px; height: 100px;
      margin: 0 auto 24px;
      position: relative;
    }
    .logo-ring {
      width: 100px; height: 100px;
      border: 2px solid #C4973B40;
      border-top-color: #C4973B;
      border-radius: 50%;
      animation: orbit 2s linear infinite;
      position: absolute; top: 0; left: 0;
    }
    .logo-ring-outer {
      width: 100px; height: 100px;
      border: 1px solid #C4973B20;
      border-bottom-color: #C4973B80;
      border-radius: 50%;
      animation: orbit 3s linear infinite reverse;
      position: absolute; top: 0; left: 0;
    }
    .logo-icon {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 36px;
      filter: drop-shadow(0 0 12px #C4973B80);
      animation: pulse-glow 2s ease-in-out infinite;
    }
    @keyframes orbit { to { transform: rotate(360deg); } }
    @keyframes pulse-glow {
      0%, 100% { filter: drop-shadow(0 0 8px #C4973B60); }
      50% { filter: drop-shadow(0 0 20px #C4973BCC); }
    }
    .brand {
      font-size: 11px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #C4973B;
      margin-bottom: 20px;
      font-weight: 300;
    }
    h1 {
      font-size: 20px; font-weight: 500;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    p { font-size: 14px; color: #8b949e; }
    .error { color: #f85149; }
    .success { color: #C4973B; }
    a { color: #C4973B; text-decoration: underline; margin-top: 16px; display: inline-block; font-size: 14px; }
    /* Progress bar */
    .progress-track {
      width: 200px; height: 2px;
      background: #21262d;
      border-radius: 1px;
      margin: 20px auto 0;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #C4973B, #E8C547);
      border-radius: 1px;
      animation: fill-progress 2.5s ease-in-out forwards;
    }
    @keyframes fill-progress {
      0% { width: 0%; }
      60% { width: 70%; }
      100% { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="stars"></div>
  <div class="card">
    <div class="logo-container" id="spinner">
      <div class="logo-ring"></div>
      <div class="logo-ring-outer"></div>
      <div class="logo-icon">\u{1F47C}</div>
    </div>
    <div class="brand">Angel OS</div>
    <h1 id="title">Signing in\u2026</h1>
    <p id="message">Establishing secure connection</p>
    <div class="progress-track"><div class="progress-bar"></div></div>
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
          spinner.innerHTML = '<div class="logo-icon" style="position:static;transform:none;font-size:48px;">\u{1F47C}</div>';
          title.textContent = 'Welcome, ' + (data.user.name || data.user.email || '') + '!';
          title.className = 'success';
          message.textContent = 'Entering the bridge\u2026';
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
