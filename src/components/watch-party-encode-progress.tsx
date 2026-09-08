import { encodeStepViews } from "@/lib/watch-party-encode-progress"
import type { WatchPartyEncodeStep } from "@/lib/watch-party-types"

export const WatchPartyEncodeProgress = ({
  step,
  percent
}: {
  step: WatchPartyEncodeStep | null
  percent: number
}) => {
  const steps = encodeStepViews(step, percent)

  return (
    <div className="space-y-4 rounded border border-neutral-200 px-3 py-4">
      <p className="text-sm text-neutral-600">Preparing a browser-safe copy of this video…</p>
      <ol className="space-y-3">
        {steps.map(item => {
          const status = item.isComplete ? "Done" : item.isActive ? `${item.percent}%` : "Waiting"
          return (
            <li
              key={item.step}
              className="space-y-1"
            >
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{item.label}</span>
                <span className="tabular-nums">{status}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-neutral-200">
                <div
                  className={`h-full ${item.isComplete ? "bg-emerald-500" : "bg-neutral-800"}`}
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
