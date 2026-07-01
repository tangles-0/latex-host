export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import NoteShareView from "@/components/note-share-view";
import { getNote, getNoteSharePublicMeta } from "@/lib/media-store";
import {
  getNoteShareUnlockCookieName,
  isNoteShareUnlockTokenValid,
} from "@/lib/note-share-access";

export default async function InternalNoteSharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const share = await getNoteSharePublicMeta(shareId);
  if (!share) {
    notFound();
  }

  const cookieStore = await cookies();
  const unlockToken = cookieStore.get(
    getNoteShareUnlockCookieName(share.code),
  )?.value;
  const hasAccess =
    !share.hasPassword ||
    isNoteShareUnlockTokenValid(share.code, share.accessTokenSeed, unlockToken);
  if (!hasAccess) {
    return (
      <NoteShareView
        shareCode={share.code}
        fileName={share.fileName}
        updatedAt={share.updatedAt}
        requiresPassword
      />
    );
  }

  const note = await getNote(share.mediaId);
  if (!note) {
    notFound();
  }

  return (
    <NoteShareView
      shareCode={share.code}
      fileName={note.originalFileName || note.baseName}
      content={note.content}
      updatedAt={note.updatedAt}
      requiresPassword={share.hasPassword}
    />
  );
}
