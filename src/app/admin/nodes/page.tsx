import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import AdminNodesClient from "@/components/admin-nodes-client"
import { authOptions } from "@/lib/auth"
import { isAdminUser } from "@/lib/metadata-store"
import { listAllSelfHostedNodes } from "@/lib/self-hosted-nodes"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"

const AdminNodesPage = async () => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect("/")
  }
  if (!(await isAdminUser(userId))) {
    redirect("/gallery")
  }

  const nodes = await listAllSelfHostedNodes()

  return (
    <PageScaffold width="wide">
      <SectionHeader
        title="nodes"
        subtitle="ownership, forwarding, and removal"
      />
      <AdminNodesClient initialNodes={nodes} />
    </PageScaffold>
  )
}

export default AdminNodesPage
