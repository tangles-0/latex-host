import { getSessionUserId } from "@/lib/auth"
import TextLink from "@/components/ui/text-link"
import PatchNotesList from "@/components/patch-notes-list"
import {
  getLatestPatchNote,
  listPatchNotes,
  setUserLastPatchNoteDismissed
} from "@/lib/metadata-store"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"

const PatchNotesPage = async () => {
  const userId = await getSessionUserId()
  const [notes, latestNote] = await Promise.all([listPatchNotes(), getLatestPatchNote()])

  if (userId && latestNote) {
    await setUserLastPatchNoteDismissed(userId, new Date(latestNote.publishedAt))
  }

  return (
    <PageScaffold>
      <SectionHeader
        title="patch notes"
        subtitle="Latest updates, newest first."
        actions={
          <TextLink
            href="/"
            className="text-sm"
          >
            Back home
          </TextLink>
        }
      />
      <PatchNotesList notes={notes} />
    </PageScaffold>
  )
}

export default PatchNotesPage
