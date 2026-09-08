export const WatchPartyVolumeControls = ({
  volume,
  isMuted,
  onVolumeChange,
  onMutedChange
}: {
  volume: number
  isMuted: boolean
  onVolumeChange: (volume: number) => void
  onMutedChange: (isMuted: boolean) => void
}) => {
  return (
    <div className="flex w-40 shrink-0 items-center justify-end gap-2 text-xs text-neutral-600">
      <button
        type="button"
        onClick={() => onMutedChange(!isMuted)}
        className="rounded border border-neutral-200 px-2 py-1"
        aria-pressed={isMuted}
      >
        {isMuted || volume === 0 ? "Unmute" : "Mute"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={isMuted ? 0 : volume}
        onChange={event => {
          const nextVolume = Number(event.target.value)
          onVolumeChange(nextVolume)
          onMutedChange(nextVolume === 0)
        }}
        className="w-24"
        aria-label="Volume"
      />
    </div>
  )
}
