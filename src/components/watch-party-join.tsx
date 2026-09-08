export const WatchPartyJoin = ({
  isReady,
  onJoin
}: {
  isReady: boolean
  onJoin: () => void
}) => {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded border border-neutral-200 px-4 py-12 text-center">
      <p className="text-sm text-neutral-600">
        {isReady ? "Click join to connect and unlock playback." : "The video is still being prepared."}
      </p>
      <button
        type="button"
        disabled={!isReady}
        onClick={onJoin}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
      >
        Join watch party
      </button>
    </div>
  )
}