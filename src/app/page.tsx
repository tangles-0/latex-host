import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import {
  DEFAULT_SETTINGS,
  getAppSettings,
  getLatestPatchNote,
  getPublicSiteStats,
  getUserUploadStats
} from "@/lib/metadata-store"
import AuthForms from "@/components/auth-forms"
import AlertBanner from "@/components/ui/alert-banner"
import TextLink from "@/components/ui/text-link"
import GalleryEntryLink from "@/components/gallery-entry-link"
import { redirect } from "next/navigation"
import PatchNoteMarkdown from "@/components/patch-note-markdown"
import NodeHome from "@/components/node-home"
import { isNodeMode } from "@/lib/self-hosted-nodes"
import { getNodeUpdateInfo } from "@/lib/node-version"
import { formatBytes } from "@/lib/format"
import { StatusBadge } from "@/components/ui/status-badge"
import { TermButton } from "@/components/ui/term-button"
import HomeStatusBanner from "@/components/chrome/home-status-banner"

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T, label: string): T {
  if (result.status === "fulfilled") {
    return result.value
  }
  console.error(`Homepage failed to load ${label}`, result.reason)
  return fallback
}

const Home = async ({
  searchParams
}: {
  searchParams?: Promise<{ node_authorize?: string }>
}) => {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (isNodeMode()) {
    return (
      <NodeHome
        isSignedIn={Boolean(userId)}
        updateInfo={await getNodeUpdateInfo()}
      />
    )
  }
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nodeAuthorize = resolvedSearchParams?.node_authorize
  if (userId && nodeAuthorize && /^[A-Za-z0-9]{2,64}$/.test(nodeAuthorize)) {
    redirect(`/account/nodes/${encodeURIComponent(nodeAuthorize)}/authorize`)
  }

  const [settingsResult, latestPatchNoteResult, userStatsResult, siteStatsResult] =
    await Promise.allSettled([
      getAppSettings(),
      getLatestPatchNote(),
      userId ? getUserUploadStats(userId) : Promise.resolve(null),
      userId ? Promise.resolve(null) : getPublicSiteStats()
    ])
  const settings = settledValue(settingsResult, DEFAULT_SETTINGS, "settings")
  const latestPatchNote = settledValue(latestPatchNoteResult, undefined, "patch notes")
  const userStats = settledValue(userStatsResult, null, "user stats")
  const siteStats = settledValue(siteStatsResult, null, "site stats")
  const funded = settings.fundedThisMonth
  const cost = settings.costThisMonth
  const progress = cost > 0 ? Math.min(100, Math.round((funded / cost) * 100)) : 0

  return (
    <div className="flex min-h-screen flex-col">
      {!userId ? (
        <HomeStatusBanner
          userCount={siteStats?.userCount ?? null}
          fileCount={siteStats?.fileCount ?? null}
          initialUtc={new Date().toISOString().replace("T", " ").slice(0, 19)}
        />
      ) : null}

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="space-y-6">
          <div>
            <div className="relative ml-8 inline-block">
              <h1 className="font-display glow-accent text-6xl leading-none">
                latex.gg
              </h1>
              <div className="absolute top-[-22px] left-[-33px] z-[5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/latex-logo.png"
                  alt="latex"
                  width={48}
                  className="latex-logo z-5"
                />
              </div>
            </div>
            <p className="mt-2 text-neutral-500">file_serv</p>
            <p className="mt-3 text-sm text-neutral-600">
              create acct to upload imgs, mkdir albums, and create symlinks to send to frendz/foez
            </p>
          </div>

          {userId ? (
            <section className="space-y-3 border border-neutral-200 bg-[var(--theme-card)] p-4">
              <h2 className="font-display text-2xl text-[var(--theme-accent)]">
                u r <span className="font-bold">{session?.user?.name ?? session?.user?.email ?? "...who r u?"}</span>.
                wb fren &lt;3
              </h2>
              <p className="text-xs text-neutral-600">
                u hav {userStats?.imageCount ?? 0} imgs, {userStats?.videoCount ?? 0} vids, and{" "}
                {userStats?.otherFileCount ?? 0} other files uploaded using {formatBytes(userStats?.totalBytes ?? 0)} of
                spinning rust
              </p>
              <GalleryEntryLink
                href="/gallery"
                className="term-btn primary inline-flex"
              >
                clk here 2 go 2 ur gallery <span aria-hidden="true">&gt;</span>
              </GalleryEntryLink>
            </section>
          ) : (
            <>
              {!settings.signupsEnabled ? (
                <AlertBanner>New signups are currently disabled. Existing users can still log in.</AlertBanner>
              ) : null}
              <AuthForms signupsEnabled={settings.signupsEnabled} />
            </>
          )}
        </section>

        <aside className="space-y-4">
          <section className="border border-neutral-200 bg-[var(--theme-card)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl text-[var(--theme-accent)]">latest update</h2>
              <TextLink
                href="/patch-notes"
                className="text-xs"
              >
                view all
              </TextLink>
            </div>
            {latestPatchNote ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <StatusBadge tone="feat" />
                  <span>{new Date(latestPatchNote.publishedAt).toLocaleString()}</span>
                </div>
                <PatchNoteMarkdown content={latestPatchNote.content} />
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No patch notes published yet.</p>
            )}
          </section>

          {settings.supportEnabled ? (
            <section className="space-y-3 border border-neutral-200 bg-[var(--theme-card)] p-4">
              <h2 className="font-display text-xl">Support this thing</h2>
              <p className="text-xs text-neutral-600">
                This site is developed and maintained by a single dev. If you found it useful, please consider supporting
                it :)
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    ${funded} / ${cost} funded this month
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              {settings.donateUrl ? (
                <a
                  href={settings.donateUrl}
                  className="term-btn primary inline-flex"
                >
                  Donate
                </a>
              ) : (
                <TermButton disabled>Donate</TermButton>
              )}
            </section>
          ) : null}
        </aside>
      </div>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-6 py-4 text-xs text-neutral-500">
        <TextLink href="/report-abuse">Report abuse</TextLink>
        <span>direct file links · no nonsense</span>
      </footer>
    </div>
  )
}

export default Home
