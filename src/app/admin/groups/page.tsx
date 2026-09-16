import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isAdminUser, listGroupsWithCounts, listUsersWithStats } from "@/lib/metadata-store"
import ManageGroupsClient from "@/components/manage-groups-client"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"

const AdminGroupsPage = async () => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect("/")
  }

  const isAdmin = await isAdminUser(userId)
  if (!isAdmin) {
    redirect("/gallery")
  }

  const [groups, users] = await Promise.all([listGroupsWithCounts(), listUsersWithStats()])

  return (
    <PageScaffold width="wide">
      <SectionHeader
        title="groups"
        subtitle="create groups and manage membership"
      />
      <ManageGroupsClient
        currentUserId={userId}
        groups={groups}
        users={users}
      />
    </PageScaffold>
  )
}

export default AdminGroupsPage
