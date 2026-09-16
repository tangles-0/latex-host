import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import type { ReactNode } from "react"
import { authOptions } from "@/lib/auth"
import { isAdminUser } from "@/lib/metadata-store"
import { AdminNav } from "@/components/chrome/admin-nav"

const AdminLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect("/")
  }
  const isAdmin = await isAdminUser(userId)
  if (!isAdmin) {
    redirect("/gallery")
  }

  return (
    <div>
      <AdminNav />
      {children}
    </div>
  )
}

export default AdminLayout
