import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  getAlbumForUser,
  getUserById,
  isAdminUser,
} from "@/lib/metadata-store";
import { listMediaForAlbum } from "@/lib/media-store";
import GalleryClient from "@/components/gallery-client";
import { PageScaffold } from "@/components/ui/page-scaffold";
import { SectionHeader } from "@/components/ui/section-header";
import TextLink from "@/components/ui/text-link";

export default async function AdminUserAlbumPage({
  params,
}: {
  params: Promise<{ userId: string; albumId: string }>;
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

  const { userId, albumId } = await params;
  const targetUser = await getUserById(userId);
  if (!targetUser) {
    redirect("/admin/users");
  }

  const album = await getAlbumForUser(albumId, userId);
  if (!album) {
    redirect(`/admin/users/${userId}/gallery?tab=albums`);
  }

  const media = await listMediaForAlbum(userId, albumId);

  return (
    <PageScaffold width="wide">
      <SectionHeader
        title={`${targetUser.username} / ${album.name}`}
        subtitle={`${media.length} file${media.length === 1 ? "" : "s"} in this album. Viewing as admin (read-only).`}
        actions={
          <TextLink href={`/admin/users/${userId}/gallery?tab=albums`}>
            cd .. (albums)
          </TextLink>
        }
      />

      <GalleryClient
        media={media}
        showAlbumImageToggle={false}
        showCreateNoteButton={false}
        uploadAlbumId={albumId}
        isAdmin
        readOnly
        showDownloadLinks={album.displayAsDownloadPage}
        isCompactView={album.displayAsCompactView}
      />
    </PageScaffold>
  );
}
