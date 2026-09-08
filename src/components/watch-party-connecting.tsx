export const WatchPartyConnecting = ({
  isFailed,
  isHost,
  onRetry
}: {
  isFailed: boolean
  isHost: boolean
  onRetry: () => void
}) => {
  const message = isFailed
    ? isHost
      ? "Could not join the room as host."
      : "Could not connect to the room."
    : "Connecting to the watch party…"

  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded border border-neutral-200 px-4 py-12 text-center">
      <p className="text-sm text-neutral-600">{message}</p>
      {isFailed ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-neutral-200 px-3 py-1 text-xs"
        >
          Retry
        </button>
      ) : (
        <p className="text-xs text-neutral-500">Waiting for presence. The video stays unloaded until this succeeds.</p>
      )}
    </div>
  )
}
