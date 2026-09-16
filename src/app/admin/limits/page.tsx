import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import ManageLimitsClient from "@/components/manage-limits-client"
import { authOptions } from "@/lib/auth"
import { getGroupLimits, isAdminUser, listGroupsWithCounts } from "@/lib/metadata-store"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"

const AdminLimitsPage = async () => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect("/")
  }

  const isAdmin = await isAdminUser(userId)
  if (!isAdmin) {
    redirect("/gallery")
  }

  const groups = await listGroupsWithCounts()
  const ungroupedLimits = await getGroupLimits(null)
  const groupLimits = await Promise.all(
    groups.map(async group => ({
      groupId: group.id,
      groupName: group.name,
      userCount: group.userCount,
      limits: await getGroupLimits(group.id)
    }))
  )

  return (
    <PageScaffold width="wide">
      <SectionHeader
        title="limits"
        subtitle="upload policies per group"
      />
      <ManageLimitsClient
        ungroupedLimits={ungroupedLimits}
        groupLimits={groupLimits}
      />
    </PageScaffold>
  )
}

export default AdminLimitsPage
