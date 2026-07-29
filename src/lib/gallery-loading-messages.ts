export const GALLERY_LOADING_MESSAGES = [
  "pontificating solar flares...",
  "scrollin thru ur warez for good games...",
  "developing homestuck brainrot...",
  "asking the hard drives nicely...",
  "bribing the thumbnail daemon...",
  "untangling symlink spaghetti...",
  "warming up the spinny rust...",
  "negotiating with the postgres goblin...",
  "rerouting packets thru the shadow realm...",
  "compiling ur vibes into jpeg...",
  "calibrating irony sensors...",
  "feeding the rats in the server rack...",
  "decrypting ancient .nfo files...",
  "summoning album sprites...",
  "buffering existential dread...",
  "polishing pixels with spit and hope...",
  "rehydrating dehydrated memes...",
  "grepping for meaning in /dev/null...",
  "assembling gallery from spare parts...",
  "petting the load balancer...",
  "whispering sweet nothings to ffmpeg...",
  "mining for lost screenshots...",
  "syncing chakras with S3...",
  "flushing dns cache of shame...",
  "teaching nginx emotional intelligence...",
  "counting frames until dopamine...",
  "invoking sudo make me a sandwich...",
  "translating binary into feelings...",
  "charging flux capacitor (again)...",
  "consulting the README of holding...",
  "sharpening thumbnails with a butter knife...",
  "politely waking hibernating blobs...",
  "sorting files by vibe check...",
  "deflating egos, inflating pngs...",
  "running fsck on ur attention span...",
  "beaming jpegs thru the aether...",
  "recruiting spare cycles from the void...",
  "auditioning loading bars...",
  "braiding ethernet cables into friendship...",
  "tickling the inode table...",
  "persuading CDN nodes to gossip...",
  "unspooling the scroll of lost media...",
  "hyperventilating the image pipeline...",
  "dusting off the warez shelf...",
  "aligning saturn return with cache TTL...",
  "brewing espresso for the worker threads...",
  "fact-checking ur folder names...",
  "manifesting more RAM (spiritual)...",
  "rolling initiative for file listing...",
  "softlocking in the loading zone on purpose..."
] as const

export function pickGalleryLoadingMessage(exclude?: string): string {
  const pool =
    exclude == null
      ? GALLERY_LOADING_MESSAGES
      : GALLERY_LOADING_MESSAGES.filter(message => message !== exclude)

  if (pool.length === 0) {
    return GALLERY_LOADING_MESSAGES[0]
  }

  const index = Math.floor(Math.random() * pool.length)
  return pool[index] ?? GALLERY_LOADING_MESSAGES[0]
}
