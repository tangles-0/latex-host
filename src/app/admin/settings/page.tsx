import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getAppSettings, isAdminUser } from "@/lib/metadata-store"
import AdminSettings from "@/components/admin-settings"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"

const AdminSettingsPage = async () => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect("/")
  }

  const isAdmin = await isAdminUser(userId)
  if (!isAdmin) {
    redirect("/gallery")
  }

  const settings = await getAppSettings()

  return (
    <PageScaffold>
      <SectionHeader
        title="settings"
        subtitle="site messaging and funding"
      />
      <AdminSettings initial={settings} />
    </PageScaffold>
  )
}

export default AdminSettingsPage
