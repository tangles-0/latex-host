import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { listMessageThreads } from "@/lib/messaging-store"
import MessagesClient from "@/components/messages-client"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"

const MessagesPage = async () => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect("/")
  }

  const { hasClaimedKey, threads } = await listMessageThreads(userId)

  return (
    <PageScaffold>
      <SectionHeader
        title="messages"
        subtitle="Encrypted inbox addressed by PGP fingerprint."
      />
      <MessagesClient
        initialHasClaimedKey={hasClaimedKey}
        initialThreads={threads.map(thread => ({
          ...thread,
          lastMessageAt: thread.lastMessageAt.toISOString()
        }))}
      />
    </PageScaffold>
  )
}

export default MessagesPage
