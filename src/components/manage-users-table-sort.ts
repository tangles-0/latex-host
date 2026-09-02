export type UserSortKey =
  | "username"
  | "email"
  | "groupName"
  | "imageCount"
  | "totalBytes"
  | "averageBytes"
  | "lastUploadAt"
  | "lastLoginAt"

export type UserSortDirection = "asc" | "desc"

export type SortableUserStats = {
  username: string
  email: string
  groupName?: string
  imageCount: number
  totalBytes: number
  averageBytes: number
  lastUploadAt?: string
  lastLoginAt?: string
}

export const DEFAULT_USER_SORT_DIRECTION: Record<UserSortKey, UserSortDirection> = {
  username: "asc",
  email: "asc",
  groupName: "asc",
  imageCount: "desc",
  totalBytes: "desc",
  averageBytes: "desc",
  lastUploadAt: "desc",
  lastLoginAt: "desc"
}

const STRING_SORT_KEYS = new Set<UserSortKey>(["username", "email", "groupName", "lastUploadAt", "lastLoginAt"])

const compareOptionalString = (left?: string, right?: string): number => {
  const isLeftMissing = !left
  const isRightMissing = !right
  if (isLeftMissing && isRightMissing) {
    return 0
  }
  if (isLeftMissing) {
    return 1
  }
  if (isRightMissing) {
    return -1
  }
  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true })
}

const compareNumber = (left: number, right: number): number => left - right

const valueForKey = (user: SortableUserStats, key: UserSortKey): string | number | undefined => {
  switch (key) {
    case "username":
      return user.username
    case "email":
      return user.email
    case "groupName":
      return user.groupName
    case "imageCount":
      return user.imageCount
    case "totalBytes":
      return user.totalBytes
    case "averageBytes":
      return user.averageBytes
    case "lastUploadAt":
      return user.lastUploadAt
    case "lastLoginAt":
      return user.lastLoginAt
  }
}

export const nextUserSort = (
  currentKey: UserSortKey,
  currentDirection: UserSortDirection,
  nextKey: UserSortKey
): { key: UserSortKey; direction: UserSortDirection } => {
  if (currentKey === nextKey) {
    return { key: nextKey, direction: currentDirection === "asc" ? "desc" : "asc" }
  }
  return { key: nextKey, direction: DEFAULT_USER_SORT_DIRECTION[nextKey] }
}

export const sortUsers = <T extends SortableUserStats>(
  users: T[],
  key: UserSortKey,
  direction: UserSortDirection
): T[] => {
  const directionFactor = direction === "asc" ? 1 : -1
  return [...users].sort((left, right) => {
    const leftValue = valueForKey(left, key)
    const rightValue = valueForKey(right, key)
    const result = STRING_SORT_KEYS.has(key)
      ? compareOptionalString(
          typeof leftValue === "string" ? leftValue : undefined,
          typeof rightValue === "string" ? rightValue : undefined
        )
      : compareNumber(Number(leftValue ?? 0), Number(rightValue ?? 0))

    if (result !== 0) {
      if (STRING_SORT_KEYS.has(key) && (!leftValue || !rightValue)) {
        return result
      }
      return result * directionFactor
    }
    return left.email.localeCompare(right.email, undefined, { sensitivity: "base" })
  })
}
