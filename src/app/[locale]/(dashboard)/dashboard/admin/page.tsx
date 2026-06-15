import AdminPanel from './AdminPanel'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  await requirePortalManager()
  return <AdminPanel />
}
