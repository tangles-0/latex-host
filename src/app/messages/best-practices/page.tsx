import type { Metadata } from "next";

import NoteMarkdown from "@/components/note-markdown";
import Panel from "@/components/ui/panel";
import TextLink from "@/components/ui/text-link";
import { getSessionUserId } from "@/lib/auth";
import { readPgpBestPracticesMarkdown } from "@/lib/pgp-best-practices";

export const metadata: Metadata = {
  title: "PGP messaging best practices",
};

const PgpBestPracticesPage = async () => {
  const [content, userId] = await Promise.all([
    readPgpBestPracticesMarkdown(),
    getSessionUserId(),
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-6 py-10 text-sm">
      <TextLink href={userId ? "/messages" : "/"} className="text-sm">
        {userId ? "Back to messages" : "Back to home"}
      </TextLink>
      <Panel className="p-6 sm:p-8">
        <NoteMarkdown content={content} />
      </Panel>
    </main>
  );
};

export default PgpBestPracticesPage;
