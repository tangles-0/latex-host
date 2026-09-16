"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import clsx from "clsx";

import {
  nextUserSort,
  sortUsers,
  type UserSortDirection,
  type UserSortKey,
} from "@/components/manage-users-table-sort";
import { StatusBadge } from "@/components/ui/status-badge";
import { TermButton } from "@/components/ui/term-button";
import { TermTable } from "@/components/ui/term-table";
import { formatBytes } from "@/lib/format";

type UserStats = {
  id: string;
  username: string;
  email: string;
  groupName?: string;
  imageCount: number;
  totalBytes: number;
  averageBytes: number;
  lastUploadAt?: string;
  lastLoginAt?: string;
  bannedAt?: string;
};

const SORTABLE_COLUMNS: { key: UserSortKey; label: string }[] = [
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  { key: "groupName", label: "Group" },
  { key: "imageCount", label: "Files" },
  { key: "totalBytes", label: "Total Size" },
  { key: "averageBytes", label: "Avg Size" },
  { key: "lastUploadAt", label: "Last Upload" },
  { key: "lastLoginAt", label: "Last Login" },
];

const SortHeader = ({
  column,
  label,
  sortKey,
  sortDirection,
  onSort,
}: {
  column: UserSortKey;
  label: string;
  sortKey: UserSortKey;
  sortDirection: UserSortDirection;
  onSort: (key: UserSortKey) => void;
}) => {
  const isActive = sortKey === column;
  const ariaSort = isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none";
  const Icon = isActive ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th className="px-3 py-2" aria-sort={ariaSort} scope="col">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={clsx(
          "inline-flex items-center gap-1 uppercase hover:text-neutral-800",
          isActive ? "text-neutral-700" : "text-neutral-500",
        )}
      >
        {label}
        <Icon
          aria-hidden="true"
          className={clsx("size-3", isActive ? "text-neutral-700" : "text-neutral-300")}
        />
      </button>
    </th>
  );
};

export default function ManageUsersTable({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: UserStats[];
}) {
  const [items, setItems] = useState(users);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<UserSortKey>("email");
  const [sortDirection, setSortDirection] = useState<UserSortDirection>("asc");

  const sortedItems = useMemo(
    () => sortUsers(items, sortKey, sortDirection),
    [items, sortKey, sortDirection],
  );

  const requestSort = (key: UserSortKey) => {
    const nextSort = nextUserSort(sortKey, sortDirection, key);
    setSortKey(nextSort.key);
    setSortDirection(nextSort.direction);
  };

  async function requestDeleteFiles(userId: string) {
    setError(null);
    setBusyUserId(userId);
    const response = await fetch(`/api/admin/users/${userId}/files`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Unable to delete files.");
      setBusyUserId(null);
      return;
    }

    setItems((current) =>
      current.map((user) =>
        user.id === userId
          ? {
              ...user,
              imageCount: 0,
              totalBytes: 0,
              averageBytes: 0,
              lastUploadAt: undefined,
            }
          : user,
      ),
    );
    setBusyUserId(null);
  }

  async function requestDeleteUser(userId: string) {
    setError(null);
    setBusyUserId(userId);
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Unable to delete user.");
      setBusyUserId(null);
      return;
    }

    setItems((current) => current.filter((user) => user.id !== userId));
    setBusyUserId(null);
  }

  async function requestBanUser(userId: string) {
    setError(null);
    setBusyUserId(userId);
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Unable to ban user.");
      setBusyUserId(null);
      return;
    }

    setItems((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, bannedAt: new Date().toISOString() } : user,
      ),
    );
    setBusyUserId(null);
  }

  const formatTimestamp = (value?: string) =>
    value ? `${new Date(value).toISOString().replace("T", " ").slice(0, 19)} UTC` : "—";

  return (
    <div className="space-y-3">
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <TermTable className="min-w-[920px] text-xs">
          <thead className="text-left text-[11px] uppercase text-neutral-500">
            <tr>
              {SORTABLE_COLUMNS.map((column) => (
                <SortHeader
                  key={column.key}
                  column={column.key}
                  label={column.label}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={requestSort}
                />
              ))}
              <th className="px-3 py-2" scope="col">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((user) => (
              <tr key={user.id} className="border-t border-neutral-200">
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/users/${user.id}/gallery`}
                      className="underline"
                      title={`Browse ${user.username}'s files`}
                    >
                      {user.username}
                    </Link>
                    {user.bannedAt ? <StatusBadge tone="err">Banned</StatusBadge> : null}
                  </div>
                </td>
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2">{user.groupName ?? "—"}</td>
                <td className="px-3 py-2">{user.imageCount}</td>
                <td className="px-3 py-2">{formatBytes(user.totalBytes)}</td>
                <td className="px-3 py-2">{formatBytes(user.averageBytes)}</td>
                <td className="px-3 py-2">{formatTimestamp(user.lastUploadAt)}</td>
                <td className="px-3 py-2">{formatTimestamp(user.lastLoginAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <TermButton
                      onClick={() => void requestDeleteFiles(user.id)}
                      disabled={busyUserId === user.id}
                    >
                      Delete files
                    </TermButton>
                    {user.bannedAt || user.id === currentUserId ? null : (
                      <TermButton
                        variant="danger"
                        onClick={() => void requestBanUser(user.id)}
                        disabled={busyUserId === user.id}
                      >
                        Ban user
                      </TermButton>
                    )}
                    <TermButton
                      variant="danger"
                      onClick={() => void requestDeleteUser(user.id)}
                      disabled={busyUserId === user.id}
                    >
                      Delete user
                    </TermButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
      </TermTable>
    </div>
  );
}

