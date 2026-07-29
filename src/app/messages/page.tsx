import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { listMessageThreads } from "@/lib/messaging-store";
import MessagesClient from "@/components/messages-client";
import PageHeader from "@/components/ui/page-header";

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/");
  }

  const { hasClaimedKey, threads } = await listMessageThreads(userId);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10 text-sm">
      <PageHeader
        title="Messages"
        subtitle="Encrypted inbox addressed by PGP fingerprint."
        backLink={{ href: "/gallery", label: "back 2 gallery" }}
      />
      <MessagesClient
        initialHasClaimedKey={hasClaimedKey}
        initialThreads={threads.map((thread) => ({
          ...thread,
          lastMessageAt: thread.lastMessageAt.toISOString(),
        }))}
      />
    </main>
  );
}
