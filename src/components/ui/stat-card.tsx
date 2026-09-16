import Panel from "@/components/ui/panel"

export default function StatCard({
  label,
  value
}: {
  label: string
  value: string | number
}) {
  return (
    <Panel>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-2 font-display text-lg text-[var(--theme-accent)]">{value}</div>
    </Panel>
  )
}
