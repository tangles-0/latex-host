import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { countPendingAbuseReports } from "@/lib/abuse-reports";
import { isAdminUser } from "@/lib/metadata-store";
import PageHeader from "@/components/ui/page-header";
import TextLink from "@/components/ui/text-link";
import { AdminAbuseReportsClient } from "@/components/admin-abuse-reports-client";

export default async function AdminAbusePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/");
  }
  if (!(await isAdminUser(userId))) {
    redirect("/gallery");
  }

  const pendingCount = await countPendingAbuseReports();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 text-sm sm:px-6 sm:py-10">
      <PageHeader
        title="Abuse reports"
        subtitle={`${pendingCount} pending review`}
        backLink={{ href: "/admin", label: "back 2 admin" }}
      >
        <TextLink
          href="/report-abuse"
          className="text-sm"
        >
          Public report form
        </TextLink>
      </PageHeader>

      <AdminAbuseReportsClient />
    </main>
  );
}
