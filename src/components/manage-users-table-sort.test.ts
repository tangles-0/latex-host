import { describe, expect, it } from "vitest"

import {
  nextUserSort,
  sortUsers,
  type SortableUserStats,
  type UserSortKey
} from "./manage-users-table-sort"

const createUser = (overrides: Partial<SortableUserStats> & { email: string }): SortableUserStats => ({
  username: overrides.email.split("@")[0] ?? "user",
  imageCount: 0,
  totalBytes: 0,
  averageBytes: 0,
  ...overrides
})

describe("nextUserSort", () => {
  it("toggles direction when the same column is selected", () => {
    expect(nextUserSort("email", "asc", "email")).toEqual({ key: "email", direction: "desc" })
    expect(nextUserSort("totalBytes", "desc", "totalBytes")).toEqual({
      key: "totalBytes",
      direction: "asc"
    })
  })

  it("uses text ascending and numeric or date descending for a new column", () => {
    expect(nextUserSort("email", "desc", "username")).toEqual({ key: "username", direction: "asc" })
    expect(nextUserSort("email", "asc", "imageCount")).toEqual({ key: "imageCount", direction: "desc" })
    expect(nextUserSort("username", "asc", "lastLoginAt")).toEqual({
      key: "lastLoginAt",
      direction: "desc"
    })
  })
})

describe("sortUsers", () => {
  const users = [
    createUser({
      email: "zeta@example.com",
      username: "zeta",
      groupName: "member",
      imageCount: 2,
      totalBytes: 200,
      averageBytes: 100,
      lastUploadAt: "2026-01-01T00:00:00.000Z",
      lastLoginAt: "2026-02-01T00:00:00.000Z"
    }),
    createUser({
      email: "alpha@example.com",
      username: "Alpha",
      groupName: "admin",
      imageCount: 10,
      totalBytes: 50,
      averageBytes: 5,
      lastUploadAt: "2026-03-01T00:00:00.000Z"
    }),
    createUser({
      email: "beta@example.com",
      username: "beta",
      imageCount: 1,
      totalBytes: 1000,
      averageBytes: 1000,
      lastLoginAt: "2026-01-15T00:00:00.000Z"
    })
  ]

  it("does not mutate the original array", () => {
    const original = [...users]
    sortUsers(users, "username", "asc")
    expect(users).toEqual(original)
  })

  it("sorts usernames case-insensitively", () => {
    expect(sortUsers(users, "username", "asc").map(user => user.username)).toEqual([
      "Alpha",
      "beta",
      "zeta"
    ])
  })

  it("sorts numeric columns and keeps missing optional values last in both directions", () => {
    expect(sortUsers(users, "totalBytes", "desc").map(user => user.email)).toEqual([
      "beta@example.com",
      "zeta@example.com",
      "alpha@example.com"
    ])
    expect(sortUsers(users, "groupName", "asc").map(user => user.email)).toEqual([
      "alpha@example.com",
      "zeta@example.com",
      "beta@example.com"
    ])
    expect(sortUsers(users, "groupName", "desc").map(user => user.email)).toEqual([
      "zeta@example.com",
      "alpha@example.com",
      "beta@example.com"
    ])
  })

  it("sorts timestamps and keeps empty dates last", () => {
    const byLastLogin = sortUsers(users, "lastLoginAt", "desc").map(user => user.email)
    expect(byLastLogin).toEqual(["zeta@example.com", "beta@example.com", "alpha@example.com"])
  })

  it("uses email as a stable tie-breaker", () => {
    const tied = [
      createUser({ email: "b@example.com", imageCount: 3 }),
      createUser({ email: "a@example.com", imageCount: 3 })
    ]
    expect(sortUsers(tied, "imageCount", "desc").map(user => user.email)).toEqual([
      "a@example.com",
      "b@example.com"
    ])
  })

  it("covers every sortable key", () => {
    const keys: UserSortKey[] = [
      "username",
      "email",
      "groupName",
      "imageCount",
      "totalBytes",
      "averageBytes",
      "lastUploadAt",
      "lastLoginAt"
    ]
    for (const key of keys) {
      expect(sortUsers(users, key, "asc")).toHaveLength(users.length)
      expect(sortUsers(users, key, "desc")).toHaveLength(users.length)
    }
  })
})
