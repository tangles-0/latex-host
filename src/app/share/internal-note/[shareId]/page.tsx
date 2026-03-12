export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import NoteShareView from "@/components/note-share-view";
import { getNote, getShareByCode } from "@/lib/media-store";

export default async function InternalNoteSharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const share = await getShareByCode("note", shareId);
  if (!share) {
    notFound();
  }

  const note = await getNote(share.mediaId);
  if (!note) {
    notFound();
  }

  return (
    <NoteShareView
      fileName={note.originalFileName || note.baseName}
      content={note.content}
      updatedAt={note.updatedAt}
    />
  );
}
