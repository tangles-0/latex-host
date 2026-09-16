export const formatBytes = (value?: number | null): string => {
  if (!value) {
    return "0 B"
  }
  const units = ["B", "KB", "MB", "GB", "TB"]
  let index = 0
  let size = value
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(size < 10 && index > 0 ? 1 : 0)} ${units[index]}`
}

export const formatShortBytes = (value?: number | null): string => {
  if (!value) {
    return "0B"
  }
  if (value < 1024) {
    return `${value}B`
  }
  if (value < 1048576) {
    return `${(value / 1024).toFixed(1)}K`
  }
  if (value < 1073741824) {
    return `${(value / 1048576).toFixed(1)}M`
  }
  return `${(value / 1073741824).toFixed(1)}G`
}

export const formatIsoDate = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toISOString().slice(0, 10)
}
