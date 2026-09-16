import { LightDownload } from "@energiz3r/icon-library/Icons/Light/LightDownload"

const downloadFileName = (title: string): string => {
  const trimmed = title.replace(/\s+/g, " ").trim() || "watch-party"
  const withoutExt = trimmed.replace(/\.mp4$/i, "")
  const safe = withoutExt.replace(/[\\/:*?"<>|]/g, "-")
  return `${safe}.mp4`
}

const downloadHref = (url: string): string => {
  const parsed = new URL(url)
  parsed.searchParams.set("download", "1")
  return parsed.toString()
}

export const WatchPartyVideoDownload = ({
  url,
  title
}: {
  url: string
  title: string
}) => {
  return (
    <a
      href={downloadHref(url)}
      download={downloadFileName(title)}
      target="_blank"
      rel="noreferrer"
      className="absolute right-2 top-2 inline-flex rounded bg-[var(--theme-overlay)] p-2 text-[var(--theme-text)]"
      aria-label="Download video"
      title="Download video"
    >
      <LightDownload
        className="h-4 w-4"
        fill="currentColor"
      />
    </a>
  )
}
