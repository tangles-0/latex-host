import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isAdminUser, listPatchNotes } from "@/lib/metadata-store"
import AdminPatchNotesClient from "@/components/admin-patch-notes-client"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"

const AdminPatchNotesPage = async () => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect("/")
  }

  const isAdmin = await isAdminUser(userId)
  if (!isAdmin) {
    redirect("/gallery")
  }

  const notes = await listPatchNotes()

  return (
    <PageScaffold>
      <SectionHeader
        title="patch notes"
        subtitle="publish, edit, and delete updates"
      />
      <AdminPatchNotesClient initialNotes={notes} />
    </PageScaffold>
  )
}

export default AdminPatchNotesPage
