import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserById, isAdminUser, listAlbums } from "@/lib/metadata-store";
import { listMediaForUser } from "@/lib/media-store";
import GalleryTabs from "@/components/gallery-tabs";
import PageHeader from "@/components/ui/page-header";

export default async function AdminUserGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!sessionUserId) {
    redirect("/");
  }

  const isAdmin = await isAdminUser(sessionUserId);
  if (!isAdmin) {
    redirect("/gallery");
  }

  const { userId } = await params;
  const targetUser = await getUserById(userId);
  if (!targetUser) {
    redirect("/admin/users");
  }

  const [albums, media] = await Promise.all([
    listAlbums(userId),
    listMediaForUser(userId),
  ]);

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialTab =
    resolvedSearchParams?.tab === "albums" ? "albums" : "files";

  return (
    <main className="flex min-h-screen w-full flex-col gap-2 sm:gap-6 px-2 sm:px-6 py-2 sm:py-10 text-sm">
      <PageHeader
        title={`${targetUser.username}'s gallery`}
        subtitle={`${media.length} file${media.length === 1 ? "" : "s"} uploaded. Viewing as admin (read-only).`}
        backLink={{ href: "/admin/users", label: "cd .. (back 2 users)" }}
      />

      <GalleryTabs
        initialTab={initialTab}
        albums={albums.map((album) => ({ id: album.id, name: album.name }))}
        media={media}
        isAdmin
        readOnly
        albumHrefBase={`/admin/users/${userId}/album`}
      />
    </main>
  );
}
