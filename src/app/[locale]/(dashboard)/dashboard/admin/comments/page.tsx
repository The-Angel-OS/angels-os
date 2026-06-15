import CommentsManager from './CommentsManager'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function CommentsPage() {
  await requirePortalManager()
  return <CommentsManager />
}
