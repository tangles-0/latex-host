import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import {
  getLatestPatchNote,
  getUserLastPatchNoteDismissed,
  isAdminUser,
  listAlbums
} from "@/lib/metadata-store"
import { listMediaForUser } from "@/lib/media-store"
import GalleryTabs from "@/components/gallery-tabs"
import PatchNoteBanner from "@/components/patch-note-banner"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"
import { isNodeMode } from "@/lib/self-hosted-nodes"
import { getNodeShareContext } from "@/lib/public-share-urls"

const GalleryPage = async ({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string }>
}) => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect("/")
  }

  const nodeMode = isNodeMode()
  const [albums, media, isAdmin, latestPatchNote, dismissedAt, nodeShareContext] = await Promise.all([
    listAlbums(userId),
    listMediaForUser(userId),
    isAdminUser(userId),
    getLatestPatchNote(),
    getUserLastPatchNoteDismissed(userId),
    getNodeShareContext()
  ])

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const initialTab = resolvedSearchParams?.tab === "albums" ? "albums" : "files"
  const pageTitle = initialTab === "albums" ? "ur albums" : "ur gallery"
  const shouldShowPatchBanner =
    latestPatchNote &&
    (!dismissedAt || new Date(latestPatchNote.publishedAt).getTime() > new Date(dismissedAt).getTime())

  return (
    <PageScaffold width="flush">
      <SectionHeader
        title={pageTitle}
        subtitle={`${media.length} file${media.length === 1 ? "" : "s"} uploaded.`}
      />

      {shouldShowPatchBanner ? (
        <PatchNoteBanner
          publishedAt={latestPatchNote.publishedAt}
          firstLine={latestPatchNote.firstLine}
        />
      ) : null}

      <GalleryTabs
        initialTab={initialTab}
        albums={albums.map(album => ({ id: album.id, name: album.name }))}
        media={media}
        isAdmin={isAdmin}
        isImageGenerationAvailable={!nodeMode}
        nodeShareContext={nodeShareContext}
      />
    </PageScaffold>
  )
}

export default GalleryPage
