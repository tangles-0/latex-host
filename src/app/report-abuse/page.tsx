import Link from "next/link"
import { ReportAbuseForm } from "@/components/report-abuse-form"
import { getTurnstileSiteKey } from "@/lib/turnstile"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"
import Panel from "@/components/ui/panel"

export const metadata = {
  title: "Report abuse — latex",
  description: "Report abusive or malicious shared files on latex.gg."
}

const ReportAbusePage = () => {
  const turnstileSiteKey = getTurnstileSiteKey()

  return (
    <PageScaffold width="narrow">
      <SectionHeader
        title="report abuse"
        subtitle="Flag public share links that host malware, illegal content, or other abuse. No account required."
        actions={
          <Link
            href="/"
            className="term-btn"
          >
            home
          </Link>
        }
      />
      <Panel>
        <ReportAbuseForm turnstileSiteKey={turnstileSiteKey} />
      </Panel>
    </PageScaffold>
  )
}

export default ReportAbusePage
