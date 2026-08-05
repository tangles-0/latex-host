"use client";

import { useCallback, useEffect, useState } from "react";
import type { AbuseReportRow } from "@/lib/abuse-reports";

export const AdminAbuseReportsClient = () => {
  const [reports, setReports] = useState<AbuseReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notifyByReport, setNotifyByReport] = useState<Record<string, boolean>>(
    {},
  );

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/admin/abuse-reports", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      reports?: AbuseReportRow[];
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Unable to load abuse reports.");
      return;
    }
    setReports(payload.reports ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchReport = async (
    reportId: string,
    body: Record<string, unknown>,
  ) => {
    setBusyId(reportId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/abuse-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Action failed.");
      }
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Action failed.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <p className="text-lg font-medium text-neutral-900">Inbox zero</p>
          <p className="mt-2 text-sm text-neutral-500">
            No pending abuse reports right now.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {reports.map((report) => {
            const owners = [
              ...new Map(
                report.resolvedUrls
                  .filter((item) => item.ownerUserId)
                  .map((item) => [
                    item.ownerUserId!,
                    {
                      userId: item.ownerUserId!,
                      username: item.ownerUsername,
                      email: item.ownerEmail,
                    },
                  ]),
              ).values(),
            ];
            const deletable = report.resolvedUrls.filter(
              (item) =>
                item.valid &&
                item.mediaId &&
                item.ownerUserId &&
                item.kind &&
                item.kind !== "album",
            );
            const notify = Boolean(
              notifyByReport[report.id] && report.reporterEmail,
            );

            return (
              <article
                key={report.id}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">
                      Report · {new Date(report.createdAt).toLocaleString()}
                    </p>
                    <p className="text-base font-medium leading-snug text-neutral-900">
                      {report.description}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Reporter:{" "}
                      {report.reporterEmail ? (
                        <span className="text-neutral-700">
                          {report.reporterEmail}
                        </span>
                      ) : (
                        <span>anonymous</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800">
                    pending
                  </div>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      URLs
                    </h3>
                    <ul className="space-y-2">
                      {report.resolvedUrls.map((item) => (
                        <li
                          key={`${report.id}-${item.url}`}
                          className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs"
                        >
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all font-medium text-emerald-700 underline"
                          >
                            {item.url}
                          </a>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-neutral-500">
                            <span>
                              {item.valid
                                ? `${item.kind ?? "unknown"} · ${item.fileName ?? item.shareCode}`
                                : "unresolved share"}
                            </span>
                            {item.ownerUsername ? (
                              <span>
                                owner: {item.ownerUsername}
                                {item.ownerEmail ? ` (${item.ownerEmail})` : ""}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {owners.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Owners
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {owners.map((owner) => (
                          <button
                            key={owner.userId}
                            type="button"
                            disabled={busyId === report.id}
                            onClick={() =>
                              void patchReport(report.id, {
                                action: "ban_user",
                                userId: owner.userId,
                              })
                            }
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50"
                          >
                            Ban {owner.username}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <label className="inline-flex items-center gap-2 text-xs text-neutral-600">
                      <input
                        type="checkbox"
                        checked={notify}
                        disabled={!report.reporterEmail}
                        onChange={(event) =>
                          setNotifyByReport((current) => ({
                            ...current,
                            [report.id]: event.target.checked,
                          }))
                        }
                      />
                      Email reporter on resolve
                      {!report.reporterEmail ? " (no email)" : ""}
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {deletable.length > 0 ? (
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() =>
                            void patchReport(report.id, {
                              action: "delete_files",
                              mediaItems: deletable.map((item) => ({
                                userId: item.ownerUserId,
                                mediaId: item.mediaId,
                                kind: item.kind,
                              })),
                            })
                          }
                          className="rounded border border-neutral-200 px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          Delete file(s)
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() =>
                          void patchReport(report.id, {
                            action: "reject",
                            notifyReporter: notify,
                          })
                        }
                        className="rounded border border-neutral-200 px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() =>
                          void patchReport(report.id, {
                            action: "action_taken",
                            notifyReporter: notify,
                          })
                        }
                        className="rounded bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        Mark action taken
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
