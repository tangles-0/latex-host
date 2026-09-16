import Link from "next/link"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import SignOutActions from "@/components/signout-actions"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"
import Panel from "@/components/ui/panel"

const SignOutPage = async () => {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email ?? null
  const backHref = email ? "/gallery" : "/"
  const backLabel = email ? "Back to gallery" : "Back to home"

  return (
    <PageScaffold width="narrow">
      <SectionHeader
        title="sign out"
        subtitle={email ? `ur signed in as ${email}.` : "You're already signed out."}
        actions={
          <Link
            href={backHref}
            className="term-btn"
          >
            {backLabel}
          </Link>
        }
      />
      <Panel>
        <h2 className="font-display text-xl">confirm u r lame</h2>
        <p className="mt-2 text-neutral-600">signing out will end ur session at this battlestation</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {email ? <SignOutActions callbackUrl="/" /> : null}
          <Link
            href="/"
            className="term-btn"
          >
            &lt; back 2 home
          </Link>
        </div>
      </Panel>
    </PageScaffold>
  )
}

export default SignOutPage
