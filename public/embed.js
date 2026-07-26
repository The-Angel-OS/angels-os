/**
 * Angel OS capture widget — one script tag on any site, anywhere.
 *
 *   <script src="https://www.payloadnuke.com/embed.js"
 *           data-tenant="kessela" data-campaign="clearout"></script>
 *
 * Renders into <div data-angel-capture></div>, or appends itself to the end of
 * <body> if no target exists. No dependencies, no build step, no cookies — it
 * posts one JSON body to /api/capture and gets out of the way.
 *
 * ponytail: plain DOM and inline styles on purpose. A framework here would mean
 * a build pipeline for 60 lines that must run inside someone else's WordPress.
 */
;(function () {
  var script = document.currentScript
  if (!script) return

  var tenant = script.getAttribute('data-tenant')
  if (!tenant) return console.warn('[angel-capture] missing data-tenant')

  var campaign = script.getAttribute('data-campaign') || ''
  var heading = script.getAttribute('data-heading') || 'Get the deal before it’s gone'
  var cta = script.getAttribute('data-cta') || 'Send it to me'
  var origin = new URL(script.src).origin

  function el(tag, style, props) {
    var n = document.createElement(tag)
    if (style) n.style.cssText = style
    for (var k in props || {}) n[k] = props[k]
    return n
  }

  var wrap = el('div', 'font:inherit;max-width:420px;margin:1.5rem auto;padding:1.25rem;border:1px solid rgba(128,128,128,.3);border-radius:12px')
  var title = el('div', 'font-size:1.05rem;font-weight:600;margin-bottom:.75rem', { textContent: heading })
  var form = el('form', 'display:flex;flex-direction:column;gap:.5rem')

  var email = el('input', 'padding:.6rem .75rem;border:1px solid rgba(128,128,128,.4);border-radius:8px;font:inherit;width:100%;box-sizing:border-box')
  email.type = 'email'
  email.required = true
  email.placeholder = 'Your email'
  email.autocomplete = 'email'

  // Honeypot — hidden from people, irresistible to bots.
  var pot = el('input', 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0')
  pot.setAttribute('tabindex', '-1')
  pot.setAttribute('aria-hidden', 'true')
  pot.name = 'company'
  pot.autocomplete = 'off'

  var button = el('button', 'padding:.65rem 1rem;border:0;border-radius:8px;font:inherit;font-weight:600;cursor:pointer;background:#111;color:#fff', { textContent: cta })
  button.type = 'submit'

  var note = el('div', 'font-size:.8rem;opacity:.7;margin-top:.5rem', { textContent: '' })
  note.setAttribute('role', 'status') // announced to screen readers on change

  form.appendChild(email)
  form.appendChild(pot)
  form.appendChild(button)
  wrap.appendChild(title)
  wrap.appendChild(form)
  wrap.appendChild(note)

  form.addEventListener('submit', function (e) {
    e.preventDefault()
    if (!email.value) return
    button.disabled = true
    note.textContent = 'One moment…'

    fetch(origin + '/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No cookies, deliberately — this is why the endpoint can allow any origin.
      credentials: 'omit',
      body: JSON.stringify({
        tenant: tenant,
        campaign: campaign,
        email: email.value,
        company: pot.value,
      }),
    })
      .then(function (r) {
        return r.json().catch(function () {
          return {}
        })
      })
      .then(function (data) {
        if (data && data.ok) {
          form.style.display = 'none'
          note.textContent = 'Got it — check your inbox.'
        } else {
          button.disabled = false
          note.textContent = (data && data.error) || 'That didn’t go through. Try again?'
        }
      })
      .catch(function () {
        button.disabled = false
        // Honest: no background retry exists, so don't imply one.
        note.textContent = 'Couldn’t reach the server. Try again?'
      })
  })

  var target = document.querySelector('[data-angel-capture]')
  ;(target || document.body).appendChild(wrap)
})()
