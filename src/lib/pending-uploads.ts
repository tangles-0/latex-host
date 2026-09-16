let pendingUploads: File[] = []

export const stashPendingUploads = (files: File[]) => {
  pendingUploads = files
}

export const takePendingUploads = (): File[] => {
  const files = pendingUploads
  pendingUploads = []
  return files
}
