import ContactsManager from './ContactsManager'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function ContactsPage() {
  await requirePortalManager()
  return <ContactsManager />
}
