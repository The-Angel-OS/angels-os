import { ErrorLogViewer } from './ErrorLogViewer'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function ErrorLogsPage() {
  await requirePortalManager()
  return <ErrorLogViewer />
}
