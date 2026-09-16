import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  getAlbumForUser,
  getLatestPatchNote,
  getUserLastPatchNoteDismissed,
} from "@/lib/metadata-store";
import { listMediaForAlbum } from "@/lib/media-store";
import GalleryClient from "@/components/gallery-client";
import AlbumShareControls from "@/components/album-share-controls";
import PatchNoteBanner from "@/components/patch-note-banner";
import { PageScaffold } from "@/components/ui/page-scaffold";
import { SectionHeader } from "@/components/ui/section-header";
import { getNodeShareContext } from "@/lib/public-share-urls";
import { isNodeMode } from "@/lib/self-hosted-nodes";

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/");
  }

  const { albumId } = await params;
  const album = await getAlbumForUser(albumId, userId);
  if (!album) {
    redirect("/gallery");
  }

  const [media, latestPatchNote, dismissedAt, nodeShareContext] =
    await Promise.all([
      listMediaForAlbum(userId, albumId),
      getLatestPatchNote(),
      getUserLastPatchNoteDismissed(userId),
      getNodeShareContext(),
    ]);
  const shouldShowPatchBanner =
    latestPatchNote &&
    (!dismissedAt ||
      new Date(latestPatchNote.publishedAt).getTime() >
        new Date(dismissedAt).getTime());

  return (
    <PageScaffold>
      <SectionHeader
        title={album.name}
        subtitle={`${media.length} file${media.length === 1 ? "" : "s"} in this album.`}
      />
      {media.length === 0 ? (
        <p className="text-xs text-neutral-500">
          go 2 the imgs tab, select some imgs, then choose “add 2 album”.
        </p>
      ) : null}

      {shouldShowPatchBanner ? (
        <PatchNoteBanner
          publishedAt={latestPatchNote.publishedAt}
          firstLine={latestPatchNote.firstLine}
        />
      ) : null}

      <AlbumShareControls
        albumId={albumId}
        isDisplayAsDownloadPage={album.displayAsDownloadPage}
        isDisplayAsCompactView={album.displayAsCompactView}
        nodeShareContext={nodeShareContext}
      />

      <GalleryClient
        media={media}
        showAlbumImageToggle={false}
        uploadAlbumId={albumId}
        showDownloadLinks={album.displayAsDownloadPage}
        isCompactView={album.displayAsCompactView}
        isImageGenerationAvailable={!isNodeMode()}
        nodeShareContext={nodeShareContext}
      />
    </PageScaffold>
  );
}
