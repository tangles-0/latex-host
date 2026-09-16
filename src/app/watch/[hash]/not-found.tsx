import { StatusBadge } from "@/components/ui/status-badge"
import { TermButton } from "@/components/ui/term-button"
import { PageScaffold } from "@/components/ui/page-scaffold"

const WatchPartyNotFound = () => {
  return (
    <PageScaffold width="narrow">
      <div className="flex items-center gap-3">
        <StatusBadge tone="err" />
        <h1 className="font-display text-3xl">watch party not found</h1>
      </div>
      <p className="text-neutral-600">This room is inactive or does not exist.</p>
      <TermButton
        variant="primary"
        href="/gallery"
      >
        back to gallery
      </TermButton>
    </PageScaffold>
  )
}

export default WatchPartyNotFound
