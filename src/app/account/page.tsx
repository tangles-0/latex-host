import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserById } from "@/lib/metadata-store";
import { getUserPgpKey } from "@/lib/messaging-store";
import AccountClient from "@/components/account-client";
import PageHeader from "@/components/ui/page-header";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/");
  }

  const [user, key] = await Promise.all([getUserById(userId), getUserPgpKey(userId)]);
  if (!user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10 text-sm">
      <PageHeader
        title="Account"
        subtitle="Profile, PGP key, and account controls."
        backLink={{ href: "/gallery", label: "back 2 gallery" }}
      />
      <AccountClient
        username={user.username}
        email={user.email}
        initialKey={
          key
            ? {
                ...key,
                verifyExpiresAt: key.verifyExpiresAt?.toISOString() ?? null,
                updatedAt: key.updatedAt.toISOString(),
              }
            : null
        }
      />
    </main>
  );
}
