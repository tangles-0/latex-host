import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isAdminUser, listUsersWithStats } from "@/lib/metadata-store"
import ManageUsersTable from "@/components/manage-users-table"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"

const ManageUsersPage = async () => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect("/")
  }

  const isAdmin = await isAdminUser(userId)
  if (!isAdmin) {
    redirect("/gallery")
  }

  const users = await listUsersWithStats()

  return (
    <PageScaffold width="wide">
      <SectionHeader
        title="users"
        subtitle="admin-only access"
      />
      <ManageUsersTable
        currentUserId={userId}
        users={users}
      />
    </PageScaffold>
  )
}

export default ManageUsersPage
