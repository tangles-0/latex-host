import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"

import ManageLimitsClient from "@/components/manage-limits-client"
import { authOptions } from "@/lib/auth"
import { getGroupLimits, isAdminUser, listGroupsWithCounts } from "@/lib/metadata-store"

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
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-8 text-sm sm:px-6 sm:py-10">
      <header className="space-y-2">
        <Link
          href="/admin"
          className="text-sm text-neutral-500 underline"
        >
          Back to admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Upload policies</h1>
        <p className="max-w-3xl text-neutral-600">
          Configure upload limits, find allowed file types quickly, and synchronize policies across user groups.
        </p>
      </header>

      <ManageLimitsClient
        ungroupedLimits={ungroupedLimits}
        groupLimits={groupLimits}
      />
    </main>
  )
}

export default AdminLimitsPage
