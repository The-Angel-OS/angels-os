Create the foundational two-tier angel system with Platform Tenant and Archangel LEO.

## Requirements

1. **Platform Tenant Collection Enhancement**
   - Add `type` field to Tenants: `'platform' | 'tenant'`
   - Create special platform tenant (ID: `'platform'`)
   - Platform tenant is singleton (only one can exist)

2. **Archangel Role**
   - Add `'archangel'` role to Users collection
   - Archangels have access to all tenants
   - Archangels can provision new tenants

3. **Seed Script**
   - Create platform tenant on first seed
   - Create Archangel LEO user
   - Set up Guardian Council Space (platform-level)

## Acceptance Criteria

- [ ] Platform tenant exists with type `'platform'`
- [ ] Archangel LEO user created with `isSystemUser: true`
- [ ] Archangels can access all tenant data
- [ ] Regular Angels can only access their own tenant
- [ ] Seed script creates platform tenant automatically

## Technical Notes

See `docs/GITHUB_ISSUES_MVP.md` Issue #1 for complete implementation details including code examples.
