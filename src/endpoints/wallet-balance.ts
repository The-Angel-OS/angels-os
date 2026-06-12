/**
 * Wallet balance — GET /api/wallet-ops/balance
 *
 * The read side of the token economy. Returns the authenticated user's token
 * balances (AT/KC/LT) + recent ledger for the active tenant — what the dashboard
 * widget and the Nimue (Android) thin client render. Custodial: the server holds
 * the balance; the client just displays it.
 *
 * A signed-in user sees their own (`user:<id>`). super_admin/admin may pass
 * ?account=<account> (e.g. a float) to inspect any holder in the active tenant.
 * `-ops` prefix avoids the `wallets` collection route shadowing.
 *
 * @see src/utilities/walletSummary.ts
 */
import type { PayloadHandler } from 'payload'
import { getWalletSummary } from '@/utilities/walletSummary'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

export const walletBalanceHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 })

  const { tenantId } = await resolveTenantFromHeaders()
  if (tenantId == null) return Response.json({ error: 'no tenant context' }, { status: 400 })

  const url = new URL(req.url || '', 'http://localhost')
  const roles = (user as { roles?: string[] }).roles ?? []
  const isAdmin = roles.includes('super_admin') || roles.includes('admin')
  const requested = url.searchParams.get('account')

  // Default to the caller's own account; only admins may inspect another holder.
  const account = requested && isAdmin ? requested : `user:${(user as { id: number | string }).id}`

  const limit = Number(url.searchParams.get('limit')) || 25
  const summary = await getWalletSummary(payload, { tenantId, account, limit })
  return Response.json(summary)
}
