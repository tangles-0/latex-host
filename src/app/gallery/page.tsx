import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  getLatestPatchNote,
  getUserLastPatchNoteDismissed,
  isAdminUser,
  listAlbums,
} from "@/lib/metadata-store";
import { listMediaForUser } from "@/lib/media-store";
import GalleryTabs from "@/components/gallery-tabs";
import PatchNoteBanner from "@/components/patch-note-banner";
import PageHeader from "@/components/ui/page-header";
import { LightSignOut } from "@energiz3r/icon-library/Icons/Light/LightSignOut";
import { LightUpload } from "@energiz3r/icon-library/Icons/Light/LightUpload";
import { LightUserSecret } from "@energiz3r/icon-library/Icons/Light/LightUserSecret";

const headerButtonClass =
  "inline-flex flex-1 items-center justify-center gap-1 rounded border border-neutral-200 px-3 py-1 sm:flex-none";

export default async function GalleryPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/");
  }

  const [albums, media, isAdmin, latestPatchNote, dismissedAt] =
    await Promise.all([
      listAlbums(userId),
      listMediaForUser(userId),
      isAdminUser(userId),
      getLatestPatchNote(),
      getUserLastPatchNoteDismissed(userId),
    ]);

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialTab =
    resolvedSearchParams?.tab === "albums" ? "albums" : "files";
  const pageTitle = initialTab === "albums" ? "ur albums" : "ur gallery";
  const shouldShowPatchBanner =
    latestPatchNote &&
    (!dismissedAt ||
      new Date(latestPatchNote.publishedAt).getTime() >
        new Date(dismissedAt).getTime());

  return (
    <main className="flex min-h-screen w-full flex-col gap-2 sm:gap-6 px-2 sm:px-6 py-2 sm:py-10 text-sm">
      <PageHeader
        title={pageTitle}
        subtitle={`${media.length} file${media.length === 1 ? "" : "s"} uploaded.`}
        backLink={{ href: "/", label: "cd .. (back 2 home)" }}
      />

      {shouldShowPatchBanner ? (
        <PatchNoteBanner
          publishedAt={latestPatchNote.publishedAt}
          firstLine={latestPatchNote.firstLine}
        />
      ) : null}

      <GalleryTabs
        initialTab={initialTab}
        albums={albums.map((album) => ({ id: album.id, name: album.name }))}
        media={media}
        isAdmin={isAdmin}
        actions={
          <>
            <Link href="/upload" className={headerButtonClass}>
              <LightUpload className="h-6.5 sm:h-3.5 w-3.5" fill="currentColor" />
              upload
            </Link>
            {isAdmin ? (
              <Link href="/admin" className={headerButtonClass}>
                <LightUserSecret className="h-6.5 sm:h-3.5 w-3.5" fill="currentColor" />
                admin
              </Link>
            ) : null}
            <Link href="/signout" className={headerButtonClass}>
              <LightSignOut className="h-6.5 sm:h-3.5 w-3.5" fill="currentColor" />
              sign out
            </Link>
          </>
        }
      />
    </main>
  );
}
