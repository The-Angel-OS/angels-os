Allow each tenant's Angel to be named and configured with personality/capabilities.

## Requirements

1. **Angel Configuration Fields**
   - Add `angelName` field to Tenants collection (default: "LEO")
   - Add `angelPersonality` field (text, optional)
   - Add `angelCapabilities` field (array of strings)
   - Add `angelAppearance` field (upload, optional avatar)

2. **Angel Naming UI**
   - During tenant provisioning, prompt for Angel name
   - Allow renaming in tenant settings
   - Display Angel name in chat interface

3. **Personality Configuration**
   - Allow custom personality traits
   - Pre-defined personality templates (Professional, Friendly, Technical, Creative)
   - Custom system prompt override (advanced)

## Acceptance Criteria

- [ ] Tenants can name their Angel during provisioning
- [ ] Angel name appears in all chat interactions
- [ ] Personality configuration affects conversation tone
- [ ] Angel avatar can be customized
- [ ] Settings page allows updating Angel configuration

## Technical Notes

```typescript
// src/collections/Tenants.ts
{
  name: 'angelName',
  type: 'text',
  defaultValue: 'LEO',
  required: true,
  admin: {
    description: 'Your Angel\'s name (e.g., "LEO", "Guardian", "Sophia")',
  },
}

{
  name: 'angelPersonality',
  type: 'select',
  options: [
    { label: 'Professional', value: 'professional' },
    { label: 'Friendly', value: 'friendly' },
    { label: 'Technical', value: 'technical' },
    { label: 'Creative', value: 'creative' },
    { label: 'Custom', value: 'custom' },
  ],
  defaultValue: 'friendly',
}

{
  name: 'angelSystemPrompt',
  type: 'textarea',
  admin: {
    condition: (data) => data.angelPersonality === 'custom',
    description: 'Custom system prompt for your Angel',
  },
}
```

See `docs/GITHUB_ISSUES_MVP.md` Issue #2 for complete implementation details.
