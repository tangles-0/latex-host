import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import AdminNodesClient from "@/components/admin-nodes-client";
import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/metadata-store";
import { listAllSelfHostedNodes } from "@/lib/self-hosted-nodes";

export default async function AdminNodesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/");
  }
  if (!(await isAdminUser(userId))) {
    redirect("/gallery");
  }

  const nodes = await listAllSelfHostedNodes();

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-10 text-sm">
      <header className="space-y-2">
        <Link href="/admin" className="text-sm text-neutral-500 underline">
          Back to admin
        </Link>
        <h1 className="text-2xl font-semibold">Self-hosted nodes</h1>
        <p className="text-neutral-600">
          Review node ownership, suspend forwarding, or permanently remove a
          node.
        </p>
      </header>

      <AdminNodesClient initialNodes={nodes} />
    </main>
  );
}
