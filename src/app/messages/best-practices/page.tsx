import type { Metadata } from "next"
import NoteMarkdown from "@/components/note-markdown"
import Panel from "@/components/ui/panel"
import TextLink from "@/components/ui/text-link"
import { getSessionUserId } from "@/lib/auth"
import { readPgpBestPracticesMarkdown } from "@/lib/pgp-best-practices"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"

export const metadata: Metadata = {
  title: "PGP messaging best practices"
}

const PgpBestPracticesPage = async () => {
  const [content, userId] = await Promise.all([
    readPgpBestPracticesMarkdown(),
    getSessionUserId()
  ])

  return (
    <PageScaffold>
      <SectionHeader
        title="best practices"
        actions={
          <TextLink
            href={userId ? "/messages" : "/"}
            className="text-sm"
          >
            {userId ? "Back to messages" : "Back to home"}
          </TextLink>
        }
      />
      <Panel className="p-6 sm:p-8">
        <NoteMarkdown content={content} />
      </Panel>
    </PageScaffold>
  )
}

export default PgpBestPracticesPage
