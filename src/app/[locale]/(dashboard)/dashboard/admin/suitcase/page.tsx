import SuitcaseManager from './SuitcaseManager'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function SuitcasePage() {
  await requirePortalManager()
  return <SuitcaseManager />
}
