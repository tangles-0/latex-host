import { getAdminStats } from "@/lib/metadata-store"
import { SectionHeader } from "@/components/ui/section-header"
import { PageScaffold } from "@/components/ui/page-scaffold"
import TextLink from "@/components/ui/text-link"
import StatCard from "@/components/ui/stat-card"
import Panel from "@/components/ui/panel"
import { formatBytes } from "@/lib/format"

const AdminHomePage = async () => {
  const stats = await getAdminStats()

  return (
    <PageScaffold width="wide">
      <SectionHeader
        title="⚡ ADMIN PANEL"
        subtitle="platform overview"
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total disk usage" value={formatBytes(stats.totalBytes)} />
        <StatCard label="Files" value={stats.imageCount} />
        <StatCard label="Users" value={stats.userCount} />
        <StatCard label="Uploads last 24h" value={stats.uploadsLast24h} />
        <StatCard label="Signups last 24h" value={stats.signupsLast24h} />
        <StatCard label="Signups last 30d" value={stats.signupsLast30d} />
        <StatCard label="Albums" value={stats.albumCount} />
        <StatCard label="Shared files" value={`${stats.sharedPercent}%`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="text-xs">
          <div className="text-neutral-500">Average file size</div>
          <div className="mt-2 font-display text-lg">{formatBytes(stats.averageFileSize)}</div>
        </Panel>
        <Panel>
          <div className="text-xs text-neutral-500">File types</div>
          <div className="mt-3 space-y-2 text-xs">
            {stats.filetypeBreakdown.length === 0 ? (
              <div className="text-neutral-500">No uploads yet.</div>
            ) : (
              stats.filetypeBreakdown.map(item => (
                <div
                  key={item.ext}
                  className="flex items-center justify-between"
                >
                  <span>.{item.ext}</span>
                  <span>{item.count}</span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <TextLink href="/gallery">back 2 gallery</TextLink>
    </PageScaffold>
  )
}

export default AdminHomePage
