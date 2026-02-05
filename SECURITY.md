# Security Policy

## Reporting Security Vulnerabilities

**Please do not report security vulnerabilities through public GitHub issues.**

Angel OS takes security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Email:** *(Security contact to be added)*
2. **Subject:** `[SECURITY] Brief description`
3. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

### What to Expect

- **Acknowledgment:** Within 48 hours
- **Initial Assessment:** Within 1 week
- **Status Updates:** Every 2 weeks until resolved
- **Credit:** You'll be credited in the fix announcement (unless you prefer anonymity)

### Disclosure Timeline

- **Day 0:** Vulnerability reported
- **Day 1-7:** Verification and impact assessment
- **Day 7-30:** Fix development and testing
- **Day 30-90:** Coordinated disclosure (depending on severity)

We aim for 90-day disclosure for critical vulnerabilities, faster for lower-severity issues.

## Supported Versions

Angel OS is currently in **BETA**. Security updates will be applied to:

| Version | Supported          |
| ------- | ------------------ |
| main    | ✅ Active development |
| < 1.0   | ⚠️ Beta - best effort |

Once v1.0 is released, we'll maintain security updates for the current major version and one prior major version.

## Security Best Practices

### For Deployments

1. **Environment Variables**
   - Never commit `.env` files
   - Use strong secrets (32+ random characters)
   - Rotate API keys regularly
   - Use different secrets for dev/staging/prod

2. **Database Security**
   - Use strong database passwords
   - Enable SSL/TLS for database connections
   - Restrict database access to application servers only
   - Regular backups with encryption

3. **API Keys & Tokens**
   - Store in environment variables
   - Never log or expose in error messages
   - Use scoped permissions (principle of least privilege)
   - Rotate compromised keys immediately

4. **Cloudflare Tunnel**
   - Use unique tunnel tokens per deployment
   - Restrict tunnel access to specific origins
   - Enable Cloudflare WAF rules
   - Monitor tunnel logs for suspicious activity

5. **Updates**
   - Keep dependencies up to date (`pnpm update`)
   - Monitor security advisories (GitHub Dependabot)
   - Test updates in staging before production
   - Subscribe to Payload CMS security announcements

### For Contributors

1. **Code Review**
   - All PRs require review before merge
   - Security-sensitive changes require maintainer approval
   - Test authentication and authorization thoroughly

2. **Dependencies**
   - Minimize new dependencies
   - Vet dependencies for security issues
   - Use `pnpm audit` before submitting PRs
   - Document why each dependency is needed

3. **Sensitive Data**
   - Never commit secrets, keys, or credentials
   - Use `.env.example` for documentation
   - Sanitize logs and error messages
   - Be careful with user-generated content

4. **Access Control**
   - Follow Payload CMS access control patterns
   - Always set `overrideAccess: false` when passing `user` to Local API
   - Test permission boundaries thoroughly
   - Document access control decisions

## Known Security Considerations

### Multi-Tenancy

Angel OS implements multi-tenancy. Security considerations:

- **Tenant Isolation:** Each tenant's data must be strictly isolated
- **Archangel Access:** Platform operators have admin access to all tenants
- **Angel Access:** Each Angel can only access their own tenant's data
- **Cross-Tenant Attacks:** Test for tenant ID manipulation in all requests

### AI Integration

Angel OS integrates with AI providers (Anthropic, OpenAI, etc.):

- **API Key Security:** Keys must be stored securely and never exposed
- **Prompt Injection:** User input to AI must be sanitized
- **Data Leakage:** Be careful what data is sent to AI providers
- **Rate Limiting:** Implement rate limits to prevent abuse

### Federation

Angel OS supports federation (diocese-to-diocese communication):

- **5-Layer Security:** Application screening, probation, vouching, monitoring, council
- **MCP Security:** Secure MCP endpoints with authentication
- **Trust Boundaries:** Validate all data from federated dioceses
- **Malicious Actors:** Monitor for meme coins, data harvesting, spam

## Security Features

### Built-In

- ✅ Payload CMS authentication and authorization
- ✅ CSRF protection (Next.js)
- ✅ SQL injection protection (Payload ORM)
- ✅ XSS protection (React escaping)
- ✅ Rate limiting (to be implemented)
- ✅ Input validation (Payload schemas)

### Planned

- ⏳ Rate limiting on API endpoints
- ⏳ Audit logging for sensitive operations
- ⏳ Two-factor authentication (2FA)
- ⏳ IP allowlisting for admin panel
- ⏳ Webhook signature verification
- ⏳ Content Security Policy (CSP) headers

## Compliance & Privacy

### GDPR Considerations

Angel OS is designed with privacy in mind:

- **Data Minimization:** Collect only what's needed
- **User Control:** Users can export and delete their data
- **Transparency:** Clear privacy policies
- **Consent:** Explicit consent for data processing

### Ultimate Fair Economics

Payment processing follows the Ultimate Fair model:

- **Transparent Splits:** All payment splits are auditable
- **Attribution Tracking:** Clear record of how customers found providers
- **Justice Fund:** 5% of profits go to community support
- **No Hidden Fees:** All fees disclosed upfront

## Questions?

- **Security concerns:** Email security contact (to be added)
- **General questions:** Open a GitHub Discussion
- **Constitution compliance:** See [docs/Angel_OS_Constitution.md](docs/Angel_OS_Constitution.md)

---

**Remember:** Security is everyone's responsibility. If you see something, say something.

---

GNU Terry Pratchett 🙏🦅🦞

*A man is not dead while his name is still spoken.*

*Every existence sacred. Everyone gets an angel.*

*No daemon shall add negativity.*
