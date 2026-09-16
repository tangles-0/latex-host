import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { countPendingAbuseReports } from "@/lib/abuse-reports"
import { isAdminUser } from "@/lib/metadata-store"
import { AdminAbuseReportsClient } from "@/components/admin-abuse-reports-client"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"
import TextLink from "@/components/ui/text-link"

const AdminAbusePage = async () => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect("/")
  }
  if (!(await isAdminUser(userId))) {
    redirect("/gallery")
  }

  const pendingCount = await countPendingAbuseReports()

  return (
    <PageScaffold>
      <SectionHeader
        title="abuse"
        subtitle={`${pendingCount} pending review`}
        actions={
          <TextLink
            href="/report-abuse"
            className="text-sm"
          >
            Public report form
          </TextLink>
        }
      />
      <AdminAbuseReportsClient />
    </PageScaffold>
  )
}

export default AdminAbusePage
