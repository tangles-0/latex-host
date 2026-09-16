import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserById, isAdminUser, listAlbums } from "@/lib/metadata-store";
import { listMediaForUser } from "@/lib/media-store";
import GalleryTabs from "@/components/gallery-tabs";
import { PageScaffold } from "@/components/ui/page-scaffold";
import { SectionHeader } from "@/components/ui/section-header";
import TextLink from "@/components/ui/text-link";

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
    <PageScaffold width="wide">
      <SectionHeader
        title={`${targetUser.username}'s gallery`}
        subtitle={`${media.length} file${media.length === 1 ? "" : "s"} uploaded. Viewing as admin (read-only).`}
        actions={
          <TextLink href="/admin/users">cd .. (back 2 users)</TextLink>
        }
      />

      <GalleryTabs
        initialTab={initialTab}
        albums={albums.map((album) => ({ id: album.id, name: album.name }))}
        media={media}
        isAdmin
        readOnly
        albumHrefBase={`/admin/users/${userId}/album`}
      />
    </PageScaffold>
  );
}
